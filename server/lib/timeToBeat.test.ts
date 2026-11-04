import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import igdb from '@server/api/igdb';
import { trendingOnPlatform } from '@server/lib/discover';
import { getTimeToBeat } from '@server/lib/timeToBeat';
import { setupTestDb } from '@server/test/db';

setupTestDb();

afterEach(() => {
  mock.restoreAll();
});

describe('getTimeToBeat', () => {
  it('returns the IGDB times unchanged and remembers them', async () => {
    const query = mock.method(igdb, 'getTimeToBeat', async () => ({
      id: 1,
      game_id: 1942,
      hastily: 134552,
      normally: 254778,
      completely: 579755,
      count: 42,
    }));

    const first = await getTimeToBeat(1942);
    const second = await getTimeToBeat(1942);

    assert.deepStrictEqual(first, {
      hastily: 134552,
      normally: 254778,
      completely: 579755,
      count: 42,
    });
    assert.deepStrictEqual(second, first);
    assert.equal(query.mock.callCount(), 1);
  });

  it('drops times IGDB reports as zero', async () => {
    mock.method(igdb, 'getTimeToBeat', async () => ({
      id: 1,
      hastily: 0,
      normally: 7200,
    }));

    const time = await getTimeToBeat(5);

    assert.equal(time?.normally, 7200);
    assert.equal(time?.hastily, undefined);
  });

  it('is empty for a game nobody timed, and remembers that too', async () => {
    const query = mock.method(igdb, 'getTimeToBeat', async () => undefined);

    assert.equal(await getTimeToBeat(77), undefined);
    assert.equal(await getTimeToBeat(77), undefined);
    assert.equal(query.mock.callCount(), 1);
  });
});

describe('trendingOnPlatform', () => {
  it('keeps the popularity order and asks for the platform', async () => {
    mock.method(igdb, 'getPopularGameIds', async () => [30, 10, 20]);
    const query = mock.method(
      igdb,
      'getStandaloneGames',
      async (ids: number[]) => ids.map((id) => ({ id, name: `Game ${id}` }))
    );

    const games = await trendingOnPlatform(6);

    assert.deepStrictEqual(
      games.map((game) => game.id),
      [30, 10, 20]
    );
    assert.deepStrictEqual(query.mock.calls[0].arguments, [[30, 10, 20], 6]);
  });
});
