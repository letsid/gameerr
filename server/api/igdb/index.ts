import ExternalAPI from '@server/api/externalapi';
import type {
  IgdbGame,
  IgdbPlatform,
  IgdbReleaseDate,
  IgdbTokenResponse,
} from '@server/api/igdb/interfaces';
import { IGDB_STANDALONE_GAME_TYPES } from '@server/api/igdb/interfaces';
import cacheManager from '@server/lib/cache';
import { getMetadataCredentials } from '@server/lib/settings';
import logger from '@server/logger';
import axios, { isAxiosError } from 'axios';

const IGDB_API_URL = 'https://api.igdb.com/v4';
const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

// IGDB allows 4 requests per second and at most 8 open requests
const MAX_RPS = 4;
const MAX_CONCURRENT = 8;
const MAX_RETRIES = 4;
// IGDB caps the page size of every endpoint at 500
export const IGDB_MAX_LIMIT = 500;
// Refresh the token this long before Twitch says it expires
const TOKEN_REFRESH_MARGIN_MS = 60 * 60 * 1000;

const DETAIL_TTL = 6 * 60 * 60;

export class IgdbNotConfiguredError extends Error {}

const GAME_LIST_FIELDS = [
  'name',
  'slug',
  'summary',
  'first_release_date',
  'game_type',
  'platforms',
  'cover.image_id',
  'total_rating',
  'total_rating_count',
  'aggregated_rating',
  'aggregated_rating_count',
  'hypes',
];

const GAME_DETAIL_FIELDS = [
  ...GAME_LIST_FIELDS,
  'storyline',
  'url',
  'genres.name',
  'themes.name',
  'game_modes.name',
  'screenshots.image_id',
  'artworks.image_id',
  'videos.name',
  'videos.video_id',
  'websites.url',
  'websites.type',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'release_dates.date',
  'release_dates.platform',
  'release_dates.release_region',
  'release_dates.status',
  'external_games.uid',
  'external_games.external_game_source',
  'version_parent',
  'parent_game',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Escapes a string for use inside an Apicalypse string literal
 */
export const apicalypseString = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Formats ids as an Apicalypse list, e.g. (6,167)
 */
export const apicalypseList = (ids: number[]): string =>
  `(${ids.map((id) => Math.trunc(id)).join(',')})`;

/**
 * Standalone games only: no DLC or bundles, and no editions, which IGDB
 * models as main games with a version parent
 */
const STANDALONE_GAME_FILTER = `game_type = ${apicalypseList(
  IGDB_STANDALONE_GAME_TYPES
)} & version_parent = null`;

class Semaphore {
  private active = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly limit: number) {}

  public async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      this.waiting.shift()?.();
    }
  }
}

class IgdbAPI extends ExternalAPI {
  private token?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  private readonly openRequests = new Semaphore(MAX_CONCURRENT);

  constructor() {
    super(
      IGDB_API_URL,
      {},
      {
        nodeCache: cacheManager.getCache('igdb').data,
        rateLimit: { maxRPS: MAX_RPS, maxRequests: MAX_RPS },
      }
    );

    this.axios.interceptors.request.use(async (config) => {
      const { igdbClientId } = getMetadataCredentials();
      config.headers.set('Client-ID', igdbClientId);
      config.headers.set('Authorization', `Bearer ${await this.getToken()}`);
      config.headers.set('Content-Type', 'text/plain');
      return config;
    });
  }

  public isConfigured(): boolean {
    const { igdbClientId, igdbClientSecret } = getMetadataCredentials();
    return !!igdbClientId && !!igdbClientSecret;
  }

  /**
   * Drops the cached access token, e.g. after the credentials changed
   */
  public resetToken(): void {
    this.token = undefined;
  }

  private async getToken(): Promise<string> {
    if (
      this.token &&
      this.token.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()
    ) {
      return this.token.value;
    }

    if (!this.tokenRequest) {
      this.tokenRequest = this.requestToken().finally(() => {
        this.tokenRequest = undefined;
      });
    }

    return this.tokenRequest;
  }

  private async requestToken(): Promise<string> {
    const { igdbClientId, igdbClientSecret } = getMetadataCredentials();

    if (!igdbClientId || !igdbClientSecret) {
      throw new IgdbNotConfiguredError(
        'IGDB client id and secret are not configured.'
      );
    }

    const response = await axios.post<IgdbTokenResponse>(
      TWITCH_TOKEN_URL,
      new URLSearchParams({
        client_id: igdbClientId,
        client_secret: igdbClientSecret,
        grant_type: 'client_credentials',
      })
    );

    this.token = {
      value: response.data.access_token,
      expiresAt: Date.now() + response.data.expires_in * 1000,
    };

    logger.debug('Obtained IGDB access token', {
      label: 'IGDB',
      expiresIn: response.data.expires_in,
    });

    return this.token.value;
  }

  /**
   * Runs an Apicalypse query against an IGDB endpoint. Retries with
   * exponential backoff when IGDB answers 429, and once with a fresh
   * token when it answers 401.
   */
  public async query<T>(
    endpoint: string,
    body: string,
    ttl?: number
  ): Promise<T> {
    let tokenRefreshed = false;

    for (let attempt = 0; ; attempt++) {
      try {
        return await this.openRequests.run(() =>
          this.post<T>(`/${endpoint}`, body, undefined, ttl)
        );
      } catch (e) {
        const status = isAxiosError(e) ? e.response?.status : undefined;

        if (status === 401 && !tokenRefreshed) {
          tokenRefreshed = true;
          this.resetToken();
          continue;
        }

        if (status === 429 && attempt < MAX_RETRIES) {
          const retryAfter = Number(
            isAxiosError(e) ? e.response?.headers['retry-after'] : undefined
          );
          const delay =
            retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
          logger.warn('IGDB rate limit hit, backing off', {
            label: 'IGDB',
            endpoint,
            delay,
          });
          await sleep(delay);
          continue;
        }

        throw e;
      }
    }
  }

  public async getPlatforms(): Promise<IgdbPlatform[]> {
    return this.query<IgdbPlatform[]>(
      'platforms',
      'fields id,name,abbreviation,alternative_name,slug,generation,platform_family,platform_type; sort id asc; limit 500;',
      DETAIL_TTL
    );
  }

  public async getGame(id: number): Promise<IgdbGame | undefined> {
    const [game] = await this.query<IgdbGame[]>(
      'games',
      `fields ${GAME_DETAIL_FIELDS.join(',')}; where id = ${Math.trunc(id)};`,
      DETAIL_TTL
    );

    return game;
  }

  /**
   * Fetches list fields for many games, in pages of the IGDB page limit
   */
  public async getGames(ids: number[], ttl?: number): Promise<IgdbGame[]> {
    const unique = [...new Set(ids)];
    const games: IgdbGame[] = [];

    for (let i = 0; i < unique.length; i += IGDB_MAX_LIMIT) {
      const chunk = unique.slice(i, i + IGDB_MAX_LIMIT);
      games.push(
        ...(await this.query<IgdbGame[]>(
          'games',
          `fields ${GAME_LIST_FIELDS.join(',')}; where id = ${apicalypseList(chunk)}; limit ${IGDB_MAX_LIMIT};`,
          ttl
        ))
      );
    }

    return games;
  }

  public async searchGames({
    query,
    platforms,
    limit = 40,
    offset = 0,
  }: {
    query: string;
    platforms?: number[];
    limit?: number;
    offset?: number;
  }): Promise<IgdbGame[]> {
    const filters = [
      STANDALONE_GAME_FILTER,
      ...(platforms?.length
        ? [`platforms = ${apicalypseList(platforms)}`]
        : []),
    ];

    return this.query<IgdbGame[]>(
      'games',
      `search ${apicalypseString(query)}; fields ${GAME_LIST_FIELDS.join(',')}; where ${filters.join(' & ')}; limit ${Math.min(limit, IGDB_MAX_LIMIT)}; offset ${Math.max(0, offset)};`,
      DETAIL_TTL
    );
  }

  /**
   * Ids of standalone games with a release on the platform inside the
   * window. Uses release dates instead of first_release_date, so a game that
   * came to PC years after its console launch counts as a PC release.
   */
  public async getReleasedGameIds({
    platform,
    from,
    to,
    maxPages = 10,
  }: {
    platform: number;
    from: number;
    to: number;
    maxPages?: number;
  }): Promise<number[]> {
    const ids = new Set<number>();

    for (let page = 0; page < maxPages; page++) {
      const releases = await this.query<IgdbReleaseDate[]>(
        'release_dates',
        `fields game; where platform = ${Math.trunc(platform)} & date >= ${Math.trunc(from)} & date <= ${Math.trunc(to)} & game.game_type = ${apicalypseList(IGDB_STANDALONE_GAME_TYPES)} & game.version_parent = null; sort date asc; limit ${IGDB_MAX_LIMIT}; offset ${page * IGDB_MAX_LIMIT};`,
        0
      );

      releases.forEach((release) => {
        if (release.game) {
          ids.add(release.game);
        }
      });

      if (releases.length < IGDB_MAX_LIMIT) {
        break;
      }
    }

    return [...ids];
  }

  /**
   * Of the given games, the ids that already had a release on the platform
   * before `before`. Used to keep early access titles and re-releases out
   * of the release lists.
   */
  public async getGameIdsReleasedBefore({
    platform,
    ids,
    before,
  }: {
    platform: number;
    ids: number[];
    before: number;
  }): Promise<number[]> {
    const released = new Set<number>();
    const unique = [...new Set(ids)];

    for (let i = 0; i < unique.length; i += IGDB_MAX_LIMIT) {
      const chunk = unique.slice(i, i + IGDB_MAX_LIMIT);
      const releases = await this.query<IgdbReleaseDate[]>(
        'release_dates',
        `fields game; where platform = ${Math.trunc(platform)} & date < ${Math.trunc(before)} & game = ${apicalypseList(chunk)}; limit ${IGDB_MAX_LIMIT};`,
        0
      );

      releases.forEach((release) => {
        if (release.game) {
          released.add(release.game);
        }
      });
    }

    return [...released];
  }

  /**
   * Earliest release date of each given game on the platform
   */
  public async getEarliestReleaseDates({
    platform,
    ids,
  }: {
    platform: number;
    ids: number[];
  }): Promise<Map<number, number>> {
    const earliest = new Map<number, number>();
    const unique = [...new Set(ids)];

    for (let i = 0; i < unique.length; i += IGDB_MAX_LIMIT) {
      const chunk = unique.slice(i, i + IGDB_MAX_LIMIT);
      const releases = await this.query<IgdbReleaseDate[]>(
        'release_dates',
        `fields game,date; where platform = ${Math.trunc(platform)} & date != null & game = ${apicalypseList(chunk)}; limit ${IGDB_MAX_LIMIT};`,
        0
      );

      releases.forEach((release) => {
        if (release.game && release.date !== undefined) {
          const current = earliest.get(release.game);
          if (current === undefined || release.date < current) {
            earliest.set(release.game, release.date);
          }
        }
      });
    }

    return earliest;
  }

  public async getTopRatedGames({
    platform,
    minRatingCount,
    limit,
    releasedFrom,
    releasedTo,
  }: {
    platform: number;
    minRatingCount: number;
    limit: number;
    releasedFrom?: number;
    releasedTo?: number;
  }): Promise<IgdbGame[]> {
    const filters = [
      `platforms = (${Math.trunc(platform)})`,
      `total_rating_count > ${Math.trunc(minRatingCount)}`,
      STANDALONE_GAME_FILTER,
      ...(releasedFrom !== undefined
        ? [`first_release_date >= ${Math.trunc(releasedFrom)}`]
        : []),
      ...(releasedTo !== undefined
        ? [`first_release_date <= ${Math.trunc(releasedTo)}`]
        : []),
    ];

    return this.query<IgdbGame[]>(
      'games',
      `fields ${GAME_LIST_FIELDS.join(',')}; where ${filters.join(' & ')}; sort total_rating desc; limit ${Math.min(limit, IGDB_MAX_LIMIT)};`,
      0
    );
  }
}

// One shared instance, so the rate limit and the open request cap apply
// across every caller
const igdb = new IgdbAPI();

export default igdb;
