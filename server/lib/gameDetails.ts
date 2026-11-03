import igdb from '@server/api/igdb';
import type { IgdbGame, IgdbReleaseDate } from '@server/api/igdb/interfaces';
import {
  IGDB_EXTERNAL_SOURCE_STEAM,
  IGDB_REGION_EUROPE,
  IGDB_REGION_WORLDWIDE,
  IGDB_WEBSITE_STEAM,
} from '@server/api/igdb/interfaces';
import type { RequestGameInfo } from '@server/entity/MediaRequest';

/**
 * How a store id was tied to the IGDB game. Ids from IGDB itself are
 * reliable; a fuzzy name match is only a guess and is labelled as such.
 */
export type MatchType = 'igdb_external_game' | 'igdb_website' | 'fuzzy_name';

export interface SteamMatch {
  appId: number;
  match: MatchType;
}

export interface PlatformRelease {
  platform: number;
  // Unix timestamp, missing while the date is unknown
  date?: number;
  region?: number;
  status?: number;
}

export interface GameVideo {
  name?: string;
  youtubeId: string;
}

export interface GameWebsite {
  url: string;
  type?: number;
}

export interface GameDetails {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  igdbUrl?: string;
  firstReleaseDate?: number;
  gameType?: number;
  coverImageId?: string;
  backdropImageId?: string;
  screenshots: string[];
  videos: GameVideo[];
  genres: string[];
  themes: string[];
  gameModes: string[];
  developers: string[];
  publishers: string[];
  platforms: number[];
  releases: PlatformRelease[];
  websites: GameWebsite[];
  steam?: SteamMatch;
  totalRating?: number;
  totalRatingCount?: number;
  aggregatedRating?: number;
  aggregatedRatingCount?: number;
  hypes?: number;
}

const STEAM_APP_URL = /store\.steampowered\.com\/app\/(\d+)/;

const positiveInt = (value: unknown): number | undefined => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * Steam app id of an IGDB game. external_games is the primary key; the
 * Steam store link IGDB lists is the fallback. No name matching here, a
 * game IGDB does not tie to Steam has no Steam data.
 */
export const resolveSteamAppId = (game: IgdbGame): SteamMatch | undefined => {
  const external = (game.external_games ?? [])
    .filter(
      (entry) => entry.external_game_source === IGDB_EXTERNAL_SOURCE_STEAM
    )
    .map((entry) => positiveInt(entry.uid))
    .filter((id): id is number => id !== undefined);

  if (external.length > 0) {
    // IGDB may list a re-release next to the original; the lowest id is the
    // oldest store page
    return { appId: Math.min(...external), match: 'igdb_external_game' };
  }

  for (const website of game.websites ?? []) {
    const match =
      website.type === IGDB_WEBSITE_STEAM && website.url
        ? STEAM_APP_URL.exec(website.url)
        : null;
    const appId = positiveInt(match?.[1]);
    if (appId) {
      return { appId, match: 'igdb_website' };
    }
  }

  return undefined;
};

const regionRank = (region?: number) =>
  region === IGDB_REGION_WORLDWIDE ? 0 : region === IGDB_REGION_EUROPE ? 1 : 2;

/**
 * One release per platform: the earliest dated one, preferring worldwide,
 * then European dates when a platform launched on the same day in several
 * regions. Platforms with only undated entries keep an entry without date.
 */
export const releasesByPlatform = (
  releaseDates: IgdbReleaseDate[] = []
): PlatformRelease[] => {
  const best = new Map<number, IgdbReleaseDate>();

  for (const release of releaseDates) {
    if (!release.platform) {
      continue;
    }

    const current = best.get(release.platform);
    const better =
      !current ||
      (release.date !== undefined &&
        (current.date === undefined ||
          release.date < current.date ||
          (release.date === current.date &&
            regionRank(release.release_region) <
              regionRank(current.release_region))));

    if (better) {
      best.set(release.platform, release);
    }
  }

  return [...best.values()]
    .map((release) => ({
      platform: release.platform as number,
      date: release.date,
      region: release.release_region,
      status: release.status,
    }))
    .sort(
      (a, b) =>
        (a.date ?? Number.MAX_SAFE_INTEGER) -
          (b.date ?? Number.MAX_SAFE_INTEGER) || a.platform - b.platform
    );
};

const names = (items?: { name?: string }[]): string[] =>
  (items ?? [])
    .map((item) => item.name)
    .filter((name): name is string => !!name);

export const toGameDetails = (game: IgdbGame): GameDetails => {
  const companies = game.involved_companies ?? [];
  const screenshots = (game.screenshots ?? [])
    .map((image) => image.image_id)
    .filter((id): id is string => !!id);
  const artworks = (game.artworks ?? [])
    .map((image) => image.image_id)
    .filter((id): id is string => !!id);

  return {
    id: game.id,
    name: game.name ?? `IGDB #${game.id}`,
    slug: game.slug,
    summary: game.summary,
    storyline: game.storyline,
    igdbUrl: game.url,
    firstReleaseDate: game.first_release_date,
    gameType: game.game_type,
    coverImageId: game.cover?.image_id,
    backdropImageId: artworks[0] ?? screenshots[0],
    screenshots,
    videos: (game.videos ?? [])
      .filter((video) => !!video.video_id)
      .map((video) => ({
        name: video.name,
        youtubeId: video.video_id as string,
      })),
    genres: names(game.genres),
    themes: names(game.themes),
    gameModes: names(game.game_modes),
    developers: names(
      companies.filter((c) => c.developer).map((c) => c.company ?? {})
    ),
    publishers: names(
      companies.filter((c) => c.publisher).map((c) => c.company ?? {})
    ),
    platforms: game.platforms ?? [],
    releases: releasesByPlatform(game.release_dates),
    websites: (game.websites ?? [])
      .filter((website) => !!website.url)
      .map((website) => ({ url: website.url as string, type: website.type })),
    steam: resolveSteamAppId(game),
    totalRating: game.total_rating,
    totalRatingCount: game.total_rating_count,
    aggregatedRating: game.aggregated_rating,
    aggregatedRatingCount: game.aggregated_rating_count,
    hypes: game.hypes,
  };
};

/**
 * The game data a request keeps on its media row
 */
export const toRequestGameInfo = (game: GameDetails): RequestGameInfo => ({
  title: game.name,
  summary: game.summary,
  coverImageId: game.coverImageId,
  platforms: game.platforms,
  steamAppId: game.steam?.appId,
  releaseYear: game.firstReleaseDate
    ? new Date(game.firstReleaseDate * 1000).getUTCFullYear()
    : undefined,
});

export const getGameDetails = async (
  id: number
): Promise<GameDetails | undefined> => {
  const game = await igdb.getGame(id);
  return game ? toGameDetails(game) : undefined;
};
