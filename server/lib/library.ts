import igdb from '@server/api/igdb';
import { getQuestarr, isQuestarrConfigured } from '@server/api/questarr';
import { getRomarr, isRomarrConfigured } from '@server/api/romarr';
import { getOwnedAppIds } from '@server/api/steam';
import { getRepository } from '@server/datasource';
import type { LibrarySource } from '@server/entity/LibraryItem';
import LibraryItem from '@server/entity/LibraryItem';
import Media from '@server/entity/Media';
import { isQuestarrPlatform } from '@server/lib/fulfillment/questarr';
import { withRomarrPlatform } from '@server/lib/fulfillment/romarr';
import { PC_PLATFORM_ID } from '@server/lib/platforms';
import { getMetadataCredentials, getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { In } from 'typeorm';

/**
 * Questarr statuses meaning the account has the game, as defined by
 * Questarr's ACQUIRED_GAME_STATUSES (shared/schema.ts). "wanted" and
 * "downloading" are not owned yet.
 */
export const QUESTARR_ACQUIRED_STATUSES = [
  'owned',
  'playing',
  'shelved',
  'completed',
];

export interface LibraryEntry {
  platform: number;
  source: LibrarySource;
}

export interface OwnedGame {
  igdbId: number;
  platform: number;
  externalId?: string;
  sourceStatus?: string;
}

/**
 * Replaces everything a source reported with its current answer
 */
export const replaceSourceItems = async (
  source: LibrarySource,
  owned: OwnedGame[]
): Promise<{ added: number; removed: number }> => {
  const repository = getRepository(LibraryItem);
  const syncedAt = new Date();
  const existing = await repository.find({ where: { source } });
  const key = (igdbId: number, platform: number) => `${igdbId}:${platform}`;
  const wanted = new Map(
    owned.map((game) => [key(game.igdbId, game.platform), game])
  );

  const stale = existing.filter(
    (item) => !wanted.has(key(item.igdbId, item.platform))
  );
  if (stale.length > 0) {
    await repository.remove(stale);
  }

  const byKey = new Map(
    existing.map((item) => [key(item.igdbId, item.platform), item])
  );
  let added = 0;
  const items = [...wanted.values()].map((game) => {
    const item = byKey.get(key(game.igdbId, game.platform));
    if (!item) {
      added++;
    }
    return Object.assign(item ?? new LibraryItem(), {
      igdbId: game.igdbId,
      platform: game.platform,
      source,
      externalId: game.externalId ?? null,
      sourceStatus: game.sourceStatus ?? null,
      syncedAt,
    });
  });

  for (let i = 0; i < items.length; i += 200) {
    await repository.save(items.slice(i, i + 200));
  }

  return { added, removed: stale.length };
};

/**
 * Steam libraries of the configured accounts, mapped to IGDB through
 * external_games. Steam games count as PC games.
 */
export const fetchSteamLibrary = async (): Promise<OwnedGame[] | undefined> => {
  const { steamApiKey } = getMetadataCredentials();
  const { steamIds } = getSettings().library;

  if (!steamApiKey || steamIds.length === 0) {
    return undefined;
  }

  const appIds = new Set<number>();
  for (const steamId of steamIds) {
    const owned = await getOwnedAppIds(steamApiKey, steamId);
    if (!owned) {
      logger.warn('Steam library is private or empty', {
        label: 'Library',
        steamId,
      });
      continue;
    }
    owned.forEach((appId) => appIds.add(appId));
  }

  const byAppId = await igdb.getGameIdsForSteamApps([...appIds]);

  return [...byAppId.entries()].map(([appId, igdbId]) => ({
    igdbId,
    platform: PC_PLATFORM_ID,
    externalId: String(appId),
  }));
};

/**
 * Questarr can only be asked about given games, so the sync asks about
 * every game Gameerr knows: requested, watchlisted or otherwise stored.
 */
export const fetchQuestarrLibrary = async (): Promise<
  OwnedGame[] | undefined
> => {
  if (!isQuestarrConfigured()) {
    return undefined;
  }

  const media = await getRepository(Media).find({ select: { igdbId: true } });
  const games = await getQuestarr().lookupLibrary(
    media.map((item) => item.igdbId)
  );

  return games
    .filter((game) => QUESTARR_ACQUIRED_STATUSES.includes(game.status))
    .map((game) => ({
      igdbId: game.igdbId,
      // Questarr manages PC games
      platform: PC_PLATFORM_ID,
      sourceStatus: game.status,
    }));
};

/**
 * ROMarrNG knows its library by title and system, so the sync asks about
 * every game Gameerr knows on each of its non-PC platforms. Systems
 * ROMarrNG does not manage are skipped.
 */
export const fetchRomarrLibrary = async (): Promise<
  OwnedGame[] | undefined
> => {
  if (!isRomarrConfigured()) {
    return undefined;
  }

  const media = await getRepository(Media).find({
    select: { igdbId: true, title: true, platforms: true },
  });
  const byPlatform = new Map<number, Map<string, number[]>>();
  media.forEach((item) => {
    const title = item.title?.trim();
    if (!title) {
      return;
    }
    (item.platforms ?? [])
      .filter((platform) => !isQuestarrPlatform(platform))
      .forEach((platform) => {
        const titles = byPlatform.get(platform) ?? new Map<string, number[]>();
        titles.set(title, [...(titles.get(title) ?? []), item.igdbId]);
        byPlatform.set(platform, titles);
      });
  });

  if (byPlatform.size === 0) {
    return [];
  }

  const romarr = getRomarr();
  const owned: OwnedGame[] = [];

  for (const [platformId, titles] of byPlatform) {
    const matches = await withRomarrPlatform(platformId, (name) =>
      romarr.lookupLibrary(
        [...titles.keys()].map((title) => ({ title, platform: name }))
      )
    );
    (matches ?? []).forEach((match) =>
      (titles.get(match.title) ?? []).forEach((igdbId) =>
        owned.push({
          igdbId,
          platform: platformId,
          externalId: match.platform,
        })
      )
    );
  }

  return owned;
};

let syncRunning = false;

export const isLibrarySyncRunning = () => syncRunning;

/**
 * Rebuilds the library from every configured source. A source that fails
 * keeps its previous items.
 */
export const syncLibrary = async (): Promise<void> => {
  if (syncRunning) {
    return;
  }
  syncRunning = true;

  try {
    const sources: [LibrarySource, () => Promise<OwnedGame[] | undefined>][] = [
      ['steam', fetchSteamLibrary],
      ['questarr', fetchQuestarrLibrary],
      ['romarr', fetchRomarrLibrary],
    ];

    for (const [source, fetch] of sources) {
      try {
        const owned = await fetch();
        if (!owned) {
          continue;
        }
        const result = await replaceSourceItems(source, owned);
        logger.info('Synced library source', {
          label: 'Library',
          source,
          games: owned.length,
          ...result,
        });
      } catch (e) {
        logger.error('Library source sync failed', {
          label: 'Library',
          source,
          errorMessage: e?.response?.data?.error ?? e.message,
        });
      }
    }
  } finally {
    syncRunning = false;
  }
};

/**
 * Platforms and sources each game is in the library on
 */
export const getLibraryEntries = async (
  igdbIds: number[]
): Promise<Map<number, LibraryEntry[]>> => {
  const entries = new Map<number, LibraryEntry[]>();
  if (igdbIds.length === 0) {
    return entries;
  }

  const items = await getRepository(LibraryItem).find({
    where: { igdbId: In([...new Set(igdbIds)]) },
  });

  items.forEach((item) => {
    const list = entries.get(item.igdbId) ?? [];
    list.push({ platform: item.platform, source: item.source });
    entries.set(item.igdbId, list);
  });

  return entries;
};

export const isOwnedOnPlatform = async (
  igdbId: number,
  platform: number
): Promise<boolean> =>
  (await getRepository(LibraryItem).count({ where: { igdbId, platform } })) > 0;
