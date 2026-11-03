import igdb from '@server/api/igdb';
import type { IgdbPlatform } from '@server/api/igdb/interfaces';
import {
  getCachedMetadata,
  setCachedMetadata,
} from '@server/lib/gameMetadataCache';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

/**
 * Platforms are identified by their IGDB platform id throughout Gameseerr.
 * Only PC is pinned, every other id comes from IGDB /platforms at runtime.
 */
export const PC_PLATFORM_ID = 6;

const PLATFORMS_CACHE_KEY = 'platforms:igdb';
const PLATFORMS_TTL = 7 * 24 * 60 * 60;

export interface Platform {
  id: number;
  name: string;
  abbreviation?: string;
  slug?: string;
  generation?: number;
  platformFamily?: number;
  platformType?: number;
}

export const toPlatform = (platform: IgdbPlatform): Platform => ({
  id: platform.id,
  name: platform.name ?? platform.abbreviation ?? `#${platform.id}`,
  abbreviation: platform.abbreviation,
  slug: platform.slug,
  generation: platform.generation,
  platformFamily: platform.platform_family,
  platformType: platform.platform_type,
});

/**
 * Keeps only positive integer ids, without duplicates, in their original order
 */
export const normalizePlatformIds = (ids: unknown): number[] => {
  if (!Array.isArray(ids)) {
    return [];
  }

  const seen = new Set<number>();

  for (const value of ids) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) {
      seen.add(id);
    }
  }

  return [...seen];
};

/**
 * Platforms a user browses by: their own choice, else the admin default,
 * else PC.
 */
export const resolvePlatforms = (
  userPlatforms?: number[] | null,
  defaultPlatforms: number[] = getSettings().metadata.defaultPlatforms
): number[] => {
  const own = normalizePlatformIds(userPlatforms);
  if (own.length > 0) {
    return own;
  }

  const fallback = normalizePlatformIds(defaultPlatforms);
  return fallback.length > 0 ? fallback : [PC_PLATFORM_ID];
};

/**
 * All IGDB platforms, cached in the database for a week. Falls back to the
 * stale copy when IGDB cannot be reached.
 */
export const getPlatforms = async (): Promise<Platform[]> => {
  const cached = await getCachedMetadata<Platform[]>(PLATFORMS_CACHE_KEY);

  if (cached && !cached.expired) {
    return cached.value;
  }

  try {
    const platforms = (await igdb.getPlatforms()).map(toPlatform);
    await setCachedMetadata(
      PLATFORMS_CACHE_KEY,
      'list',
      platforms,
      PLATFORMS_TTL
    );
    return platforms;
  } catch (e) {
    if (cached) {
      logger.warn('Serving stale platform list, IGDB lookup failed', {
        label: 'Platforms',
        errorMessage: e.message,
      });
      return cached.value;
    }
    throw e;
  }
};

/**
 * Keeps ids IGDB knows about. Unknown ids are dropped so a typo in the
 * settings file cannot break discover.
 */
export const filterKnownPlatformIds = (
  ids: number[],
  platforms: Platform[]
): number[] => {
  const known = new Set(platforms.map((platform) => platform.id));
  return ids.filter((id) => known.has(id));
};
