import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import igdb from '@server/api/igdb';
import type { IgdbGame } from '@server/api/igdb/interfaces';
import {
  computeDiscoverList,
  discoverListKey,
  filterByMinRatingCount,
  getDiscoverList,
  rankByHype,
  rankByRating,
  toDiscoverGame,
} from '@server/lib/discover';
import { setCachedMetadata } from '@server/lib/gameMetadataCache';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import bestPc from '@server/test/fixtures/igdb/best-pc-main.json';
import recentPc from '@server/test/fixtures/igdb/recent-pc.json';

const PC = 6;
const DAY = 24 * 60 * 60;

type TopRatedArgs = Parameters<typeof igdb.getTopRatedGames>[0];
type ReleaseWindow = Parameters<typeof igdb.getReleasedGameIds>[0];

const barelyRated: IgdbGame = {
  id: 999999,
  name: 'Barely Rated',
  total_rating: 100,
  total_rating_count: 3,
};

setupTestDb();

afterEach(() => {
  mock.restoreAll();
});

describe('filterByMinRatingCount', () => {
  it('drops games at or below the minimum vote count', () => {
    const games = [
      { id: 1, totalRatingCount: 3 },
      { id: 2, totalRatingCount: 50 },
      { id: 3, totalRatingCount: 51 },
      { id: 4 },
    ];

    assert.deepStrictEqual(
      filterByMinRatingCount(games, 50).map((game) => game.id),
      [3]
    );
  });

  it('still requires at least one vote when the minimum is zero', () => {
    const games = [{ id: 1, totalRatingCount: 1 }, { id: 2 }];

    assert.deepStrictEqual(
      filterByMinRatingCount(games, 0).map((game) => game.id),
      [1]
    );
  });
});

describe('rankByRating', () => {
  it('lets well rated games beat a perfect score with three votes', () => {
    const games = [...(bestPc as IgdbGame[]), barelyRated].map(toDiscoverGame);

    const ranked = rankByRating(games, 50);

    assert.ok(!ranked.some((game) => game.id === barelyRated.id));
    assert.strictEqual(ranked[0].name, 'Suikoden II');
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(
        (ranked[i - 1].totalRating ?? 0) >= (ranked[i].totalRating ?? 0)
      );
    }
  });
});

describe('rankByHype', () => {
  it('orders the live recent release sample by hypes', () => {
    const ranked = rankByHype((recentPc as IgdbGame[]).map(toDiscoverGame));

    assert.strictEqual(ranked[0].name, 'Control Resonant');
    for (let i = 1; i < ranked.length; i++) {
      assert.ok((ranked[i - 1].hypes ?? 0) >= (ranked[i].hypes ?? 0));
    }
  });

  it('breaks ties by rating count, then name', () => {
    const ranked = rankByHype([
      { id: 1, name: 'B', platforms: [], hypes: 5, totalRatingCount: 1 },
      { id: 2, name: 'A', platforms: [], hypes: 5, totalRatingCount: 1 },
      { id: 3, name: 'C', platforms: [], hypes: 5, totalRatingCount: 9 },
      { id: 4, name: 'D', platforms: [] },
    ]);

    assert.deepStrictEqual(
      ranked.map((game) => game.id),
      [3, 2, 1, 4]
    );
  });
});

describe('computeDiscoverList', () => {
  it('asks IGDB for top rated games with the configured vote minimum', async () => {
    getSettings().metadata.minRatingCount = 50;
    const topRated = mock.method(
      igdb,
      'getTopRatedGames',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_args: TopRatedArgs) => [...(bestPc as IgdbGame[]), barelyRated]
    );

    const results = await computeDiscoverList('best', PC);

    assert.strictEqual(topRated.mock.callCount(), 1);
    assert.strictEqual(topRated.mock.calls[0]?.arguments[0]?.platform, PC);
    assert.strictEqual(
      topRated.mock.calls[0]?.arguments[0]?.minRatingCount,
      50
    );
    assert.ok(results.every((game) => (game.totalRatingCount ?? 0) > 50));
  });

  it('collects recent releases from the platform release window', async () => {
    getSettings().metadata.recentReleaseDays = 60;
    const now = 1_800_000_000;
    const releasedIds = mock.method(
      igdb,
      'getReleasedGameIds',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_window: ReleaseWindow) =>
        (recentPc as IgdbGame[]).map((game) => game.id)
    );
    mock.method(igdb, 'getGameIdsReleasedBefore', async () => []);
    mock.method(igdb, 'getGames', async () => recentPc as IgdbGame[]);

    const results = await computeDiscoverList('recent', PC, now);

    const releaseWindow = releasedIds.mock.calls[0]
      ?.arguments[0] as ReleaseWindow;
    assert.strictEqual(releaseWindow.platform, PC);
    assert.strictEqual(releaseWindow.to, now);
    assert.strictEqual(releaseWindow.from, now - 60 * DAY);
    assert.strictEqual(results[0].name, 'Control Resonant');
  });

  it('only looks ahead for upcoming games', async () => {
    getSettings().metadata.upcomingReleaseDays = 90;
    const now = 1_800_000_000;
    const releasedIds = mock.method(
      igdb,
      'getReleasedGameIds',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_window: ReleaseWindow): Promise<number[]> => []
    );
    mock.method(igdb, 'getGameIdsReleasedBefore', async () => []);
    mock.method(igdb, 'getGames', async () => []);

    await computeDiscoverList('upcoming', PC, now);

    const releaseWindow = releasedIds.mock.calls[0]
      ?.arguments[0] as ReleaseWindow;
    assert.ok(releaseWindow.from > now);
    assert.strictEqual(releaseWindow.to, now + 90 * DAY);
  });
});

describe('first releases', () => {
  it('leaves out games already released on the platform before the window', async () => {
    const now = 1_800_000_000;
    const earlyAccess = 125642;
    mock.method(igdb, 'getReleasedGameIds', async () => [1942, earlyAccess]);
    const releasedBefore = mock.method(
      igdb,
      'getGameIdsReleasedBefore',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (_args: { platform: number; ids: number[]; before: number }) => [
        earlyAccess,
      ]
    );
    const getGames = mock.method(
      igdb,
      'getGames',
      async (ids: number[]): Promise<IgdbGame[]> =>
        ids.map((id) => ({ id, name: `Game ${id}` }))
    );

    const results = await computeDiscoverList('upcoming', PC, now);

    assert.deepStrictEqual(
      results.map((game) => game.id),
      [1942]
    );
    assert.deepStrictEqual(getGames.mock.calls[0]?.arguments[0], [1942]);
    const args = releasedBefore.mock.calls[0]?.arguments[0];
    assert.strictEqual(args?.platform, PC);
    assert.strictEqual(args?.before, now + 1);
  });
});

describe('getDiscoverList', () => {
  it('serves a fresh precomputed list without calling IGDB', async () => {
    const topRated = mock.method(igdb, 'getTopRatedGames', async () => []);
    await setCachedMetadata(discoverListKey('best', PC), 'list', {
      list: 'best',
      platform: PC,
      generatedAt: '2026-11-03T03:30:00.000Z',
      results: [{ id: 1942, name: 'The Witcher 3: Wild Hunt', platforms: [6] }],
    });

    const list = await getDiscoverList('best', PC);

    assert.strictEqual(topRated.mock.callCount(), 0);
    assert.strictEqual(list.results[0].id, 1942);
  });

  it('computes a missing list once for concurrent callers', async () => {
    const topRated = mock.method(
      igdb,
      'getTopRatedGames',
      async () => bestPc as IgdbGame[]
    );

    const [first, second] = await Promise.all([
      getDiscoverList('best', PC),
      getDiscoverList('best', PC),
    ]);

    assert.strictEqual(topRated.mock.callCount(), 1);
    assert.deepStrictEqual(first, second);

    // The result is persisted for the next request
    await getDiscoverList('best', PC);
    assert.strictEqual(topRated.mock.callCount(), 1);
  });
});
