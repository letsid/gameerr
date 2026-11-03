import igdb from '@server/api/igdb';
import type { IgdbGame } from '@server/api/igdb/interfaces';
import { getRepository } from '@server/datasource';
import { UserSettings } from '@server/entity/UserSettings';
import {
  getCachedMetadata,
  pruneCachedMetadata,
  setCachedMetadata,
} from '@server/lib/gameMetadataCache';
import { normalizePlatformIds } from '@server/lib/platforms';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

export const DISCOVER_LISTS = ['recent', 'upcoming', 'best'] as const;
export type DiscoverListId = (typeof DISCOVER_LISTS)[number];

export const isDiscoverListId = (value: unknown): value is DiscoverListId =>
  DISCOVER_LISTS.includes(value as DiscoverListId);

// Number of games kept per list
export const DISCOVER_LIST_SIZE = 40;
// Score based lists fetch more than they keep, the vote filter thins them out
const TOP_RATED_FETCH_SIZE = 100;

const DAY = 24 * 60 * 60;

export interface DiscoverGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  coverImageId?: string;
  firstReleaseDate?: number;
  platforms: number[];
  totalRating?: number;
  totalRatingCount?: number;
  aggregatedRating?: number;
  aggregatedRatingCount?: number;
  hypes?: number;
}

export interface DiscoverList {
  list: DiscoverListId;
  platform: number;
  generatedAt: string;
  results: DiscoverGame[];
}

export const toDiscoverGame = (game: IgdbGame): DiscoverGame => ({
  id: game.id,
  name: game.name ?? `IGDB #${game.id}`,
  slug: game.slug,
  summary: game.summary,
  coverImageId: game.cover?.image_id,
  firstReleaseDate: game.first_release_date,
  platforms: game.platforms ?? [],
  totalRating: game.total_rating,
  totalRatingCount: game.total_rating_count,
  aggregatedRating: game.aggregated_rating,
  aggregatedRatingCount: game.aggregated_rating_count,
  hypes: game.hypes,
});

/**
 * Drops games with too few ratings, so a game rated 100 by three people
 * cannot top a score list. Strictly greater, matching the IGDB filter.
 */
export const filterByMinRatingCount = <T extends { totalRatingCount?: number }>(
  games: T[],
  minRatingCount: number
): T[] => games.filter((game) => (game.totalRatingCount ?? 0) > minRatingCount);

const byName = (a: DiscoverGame, b: DiscoverGame) =>
  a.name.localeCompare(b.name);

/**
 * Most hyped first, then most rated, then by name
 */
export const rankByHype = (games: DiscoverGame[]): DiscoverGame[] =>
  [...games].sort(
    (a, b) =>
      (b.hypes ?? 0) - (a.hypes ?? 0) ||
      (b.totalRatingCount ?? 0) - (a.totalRatingCount ?? 0) ||
      byName(a, b)
  );

/**
 * Best rated first among games with enough ratings
 */
export const rankByRating = (
  games: DiscoverGame[],
  minRatingCount: number
): DiscoverGame[] =>
  filterByMinRatingCount(games, minRatingCount).sort(
    (a, b) =>
      (b.totalRating ?? 0) - (a.totalRating ?? 0) ||
      (b.totalRatingCount ?? 0) - (a.totalRatingCount ?? 0) ||
      byName(a, b)
  );

export const discoverListKey = (list: DiscoverListId, platform: number) =>
  `discover:${list}:${platform}`;

/**
 * Games whose first release on the platform falls inside the window, most
 * hyped first. A later release date of a game that is already out on the
 * platform, such as an early access title reaching 1.0, does not count.
 */
const firstReleasesInWindow = async (
  platform: number,
  from: number,
  to: number
): Promise<DiscoverGame[]> => {
  const ids = await igdb.getReleasedGameIds({ platform, from, to });
  const earlier = new Set(
    await igdb.getGameIdsReleasedBefore({ platform, ids, before: from })
  );
  const games = (
    await igdb.getGames(
      ids.filter((id) => !earlier.has(id)),
      0
    )
  ).map(toDiscoverGame);

  return rankByHype(games).slice(0, DISCOVER_LIST_SIZE);
};

export const computeDiscoverList = async (
  list: DiscoverListId,
  platform: number,
  now = Math.floor(Date.now() / 1000)
): Promise<DiscoverGame[]> => {
  const { recentReleaseDays, upcomingReleaseDays, minRatingCount } =
    getSettings().metadata;

  switch (list) {
    case 'recent':
      return firstReleasesInWindow(
        platform,
        now - recentReleaseDays * DAY,
        now
      );
    case 'upcoming':
      return firstReleasesInWindow(
        platform,
        now + 1,
        now + upcomingReleaseDays * DAY
      );
    case 'best': {
      const games = (
        await igdb.getTopRatedGames({
          platform,
          minRatingCount,
          limit: TOP_RATED_FETCH_SIZE,
        })
      ).map(toDiscoverGame);
      return rankByRating(games, minRatingCount).slice(0, DISCOVER_LIST_SIZE);
    }
  }
};

const pending = new Map<string, Promise<DiscoverList>>();

export const refreshDiscoverList = (
  list: DiscoverListId,
  platform: number
): Promise<DiscoverList> => {
  const key = discoverListKey(list, platform);
  const running = pending.get(key);

  if (running) {
    return running;
  }

  const task = (async () => {
    const results = await computeDiscoverList(list, platform);
    const value: DiscoverList = {
      list,
      platform,
      generatedAt: new Date().toISOString(),
      results,
    };
    await setCachedMetadata(key, 'list', value);
    return value;
  })().finally(() => pending.delete(key));

  pending.set(key, task);
  return task;
};

/**
 * Serves the precomputed list. Only computes at request time when the
 * nightly job has not produced one yet; a stale copy is preferred over an
 * error when IGDB is unavailable.
 */
export const getDiscoverList = async (
  list: DiscoverListId,
  platform: number
): Promise<DiscoverList> => {
  const cached = await getCachedMetadata<DiscoverList>(
    discoverListKey(list, platform)
  );

  if (cached && !cached.expired) {
    return cached.value;
  }

  if (cached) {
    // Serve stale data now, refresh for the next visitor
    refreshDiscoverList(list, platform).catch((e) =>
      logger.warn('Discover list refresh failed', {
        label: 'Discover',
        list,
        platform,
        errorMessage: e.message,
      })
    );
    return cached.value;
  }

  return refreshDiscoverList(list, platform);
};

/**
 * Platforms anyone browses by: the admin default plus every user's choice
 */
export const getActivePlatforms = async (): Promise<number[]> => {
  const settings = await getRepository(UserSettings).find({
    select: { id: true, preferredPlatforms: true },
  });

  return normalizePlatformIds([
    ...getSettings().metadata.defaultPlatforms,
    ...settings.flatMap((setting) => setting.preferredPlatforms ?? []),
  ]);
};

let refreshRunning = false;

export const isDiscoverRefreshRunning = () => refreshRunning;

/**
 * Recomputes the lists of every active platform. The nightly job forces a
 * full rebuild, startup only fills in lists that are missing or expired.
 */
export const refreshAllDiscoverLists = async ({
  force = true,
}: { force?: boolean } = {}): Promise<void> => {
  if (refreshRunning) {
    return;
  }

  if (!igdb.isConfigured()) {
    logger.warn('Skipping discover refresh, IGDB is not configured', {
      label: 'Discover',
    });
    return;
  }

  refreshRunning = true;

  try {
    const platforms = await getActivePlatforms();

    for (const platform of platforms) {
      for (const list of DISCOVER_LISTS) {
        try {
          if (!force) {
            const cached = await getCachedMetadata<DiscoverList>(
              discoverListKey(list, platform)
            );
            if (cached && !cached.expired) {
              continue;
            }
          }

          const result = await refreshDiscoverList(list, platform);
          logger.info('Refreshed discover list', {
            label: 'Discover',
            list,
            platform,
            count: result.results.length,
          });
        } catch (e) {
          logger.error('Failed to refresh discover list', {
            label: 'Discover',
            list,
            platform,
            errorMessage: e.message,
          });
        }
      }
    }

    const pruned = await pruneCachedMetadata();
    if (pruned > 0) {
      logger.debug('Pruned expired metadata cache entries', {
        label: 'Discover',
        pruned,
      });
    }
  } finally {
    refreshRunning = false;
  }
};
