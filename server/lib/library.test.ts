import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import igdb from '@server/api/igdb';
import { getQuestarr } from '@server/api/questarr';
import { MediaStatus, MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import LibraryItem from '@server/entity/LibraryItem';
import Media from '@server/entity/Media';
import { AlreadyOwnedError, MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import {
  QUESTARR_ACQUIRED_STATUSES,
  fetchQuestarrLibrary,
  fetchSteamLibrary,
  getLibraryEntries,
  isOwnedOnPlatform,
  replaceSourceItems,
} from '@server/lib/library';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import axios from 'axios';

const PC = 6;
const PS5 = 167;

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

beforeEach(() => {
  getSettings().library.steamIds = [];
});

afterEach(() => {
  mock.restoreAll();
  mock.method(MediaRequest, 'sendNotification', async () => undefined);
  delete process.env.STEAM_API_KEY;
  delete process.env.QUESTARR_URL;
  delete process.env.QUESTARR_API_KEY;
});

describe('library items', () => {
  it('replaces what a source reported, leaving other sources alone', async () => {
    await replaceSourceItems('questarr', [{ igdbId: 1, platform: PC }]);
    await replaceSourceItems('steam', [
      { igdbId: 1942, platform: PC, externalId: '292030' },
      { igdbId: 119133, platform: PC, externalId: '1245620' },
    ]);

    const result = await replaceSourceItems('steam', [
      { igdbId: 1942, platform: PC, externalId: '292030' },
    ]);

    assert.deepStrictEqual(result, { added: 0, removed: 1 });
    const items = await getRepository(LibraryItem).find({
      order: { igdbId: 'ASC' },
    });
    assert.deepStrictEqual(
      items.map((item) => [item.igdbId, item.source]),
      [
        [1, 'questarr'],
        [1942, 'steam'],
      ]
    );
  });

  it('knows the platforms and sources a game is owned on', async () => {
    await replaceSourceItems('steam', [{ igdbId: 1942, platform: PC }]);
    await replaceSourceItems('questarr', [{ igdbId: 1942, platform: PC }]);

    const entries = await getLibraryEntries([1942, 5]);

    assert.deepStrictEqual(
      entries
        .get(1942)
        ?.map((e) => e.source)
        .sort(),
      ['questarr', 'steam']
    );
    assert.strictEqual(entries.get(5), undefined);
    assert.strictEqual(await isOwnedOnPlatform(1942, PC), true);
    assert.strictEqual(await isOwnedOnPlatform(1942, PS5), false);
  });
});

describe('library sources', () => {
  it('maps Steam libraries to IGDB games on PC', async () => {
    process.env.STEAM_API_KEY = 'steam-key';
    getSettings().library.steamIds = ['76561197960287930'];
    const steamCall = mock.method(axios, 'get', async () => ({
      data: {
        response: {
          game_count: 2,
          games: [
            { appid: 292030, playtime_forever: 10 },
            { appid: 999999999 },
          ],
        },
      },
    }));
    mock.method(
      igdb,
      'getGameIdsForSteamApps',
      async () => new Map([[292030, 1942]])
    );

    const owned = await fetchSteamLibrary();

    const config = steamCall.mock.calls[0]?.arguments[1] as {
      params: Record<string, unknown>;
    };
    assert.match(
      String(steamCall.mock.calls[0]?.arguments[0]),
      /IPlayerService\/GetOwnedGames\/v1/
    );
    assert.strictEqual(config.params.steamid, '76561197960287930');
    assert.deepStrictEqual(owned, [
      { igdbId: 1942, platform: PC, externalId: '292030' },
    ]);
  });

  it('skips Steam without a key or accounts', async () => {
    assert.strictEqual(await fetchSteamLibrary(), undefined);
  });

  it('keeps only acquired Questarr games', async () => {
    process.env.QUESTARR_URL = 'http://questarr.test:5000';
    process.env.QUESTARR_API_KEY = 'qsr_test_key';
    await getRepository(Media).save([
      new Media({ igdbId: 1, mediaType: MediaType.GAME }),
      new Media({ igdbId: 2, mediaType: MediaType.GAME }),
      new Media({ igdbId: 3, mediaType: MediaType.GAME }),
    ]);
    const lookup = mock.method(getQuestarr(), 'lookupLibrary', async () => [
      { igdbId: 1, status: 'owned' },
      { igdbId: 2, status: 'wanted' },
      { igdbId: 3, status: 'downloading' },
    ]);

    const owned = await fetchQuestarrLibrary();

    assert.deepStrictEqual(
      [...(lookup.mock.calls[0]?.arguments[0] ?? [])].sort(),
      [1, 2, 3]
    );
    assert.deepStrictEqual(owned, [
      { igdbId: 1, platform: PC, sourceStatus: 'owned' },
    ]);
    assert.deepStrictEqual(QUESTARR_ACQUIRED_STATUSES, [
      'owned',
      'playing',
      'shelved',
      'completed',
    ]);
  });
});

describe('requests for owned games', () => {
  it('refuses a request for a platform the game is owned on', async () => {
    await replaceSourceItems('steam', [{ igdbId: 1942, platform: PC }]);
    const user = await getRepository(User).findOneOrFail({
      where: { email: 'demo@seerr.dev' },
    });

    await assert.rejects(
      MediaRequest.request({ igdbId: 1942, platform: PC }, user),
      AlreadyOwnedError
    );

    const other = await MediaRequest.request(
      { igdbId: 1942, platform: PS5 },
      user
    );
    assert.strictEqual(other.platform, PS5);
    const media = await getRepository(Media).findOneOrFail({
      where: { igdbId: 1942 },
    });
    assert.notStrictEqual(media.status, MediaStatus.AVAILABLE);
  });
});
