import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import igdb from '@server/api/igdb';
import type { IgdbGame } from '@server/api/igdb/interfaces';
import {
  CHART_CATEGORIES,
  CHART_RATING_MINIMUMS,
  chartKey,
  computeChart,
  getChart,
  isChartId,
} from '@server/lib/charts';
import { setCachedMetadata } from '@server/lib/gameMetadataCache';
import { setupTestDb } from '@server/test/db';

type CategoryArgs = Parameters<typeof igdb.getTopRatedByCategory>[0];

setupTestDb();

afterEach(() => {
  mock.restoreAll();
});

const games = (count: number, ratingCount: number): IgdbGame[] =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Game ${i + 1}`,
    total_rating: 99 - i * 0.1,
    total_rating_count: ratingCount,
  }));

describe('chart categories', () => {
  it('has unique ids and a filter each', () => {
    const ids = CHART_CATEGORIES.map(({ id }) => id);

    assert.equal(new Set(ids).size, ids.length);
    assert.ok(CHART_CATEGORIES.every(({ filter }) => filter.length > 0));
  });

  it('covers the genres the request names', () => {
    for (const id of [
      'rpg',
      'action-rpg',
      'roguelike',
      'shooter',
      'strategy',
    ]) {
      assert.ok(isChartId(id), id);
    }
    assert.ok(!isChartId('pinball'));
  });
});

describe('computeChart', () => {
  it('queries the category over all platforms with the strictest minimum', async () => {
    const calls: CategoryArgs[] = [];
    mock.method(igdb, 'getTopRatedByCategory', async (args: CategoryArgs) => {
      calls.push(args);
      return games(60, 500);
    });

    const chart = await computeChart('rpg', 0);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].categoryFilter, 'genres = (12)');
    assert.equal(calls[0].platform, undefined);
    assert.equal(calls[0].minRatingCount, CHART_RATING_MINIMUMS[0]);
    assert.equal(chart.results.length, 60);
    assert.equal(chart.minRatingCount, CHART_RATING_MINIMUMS[0]);
  });

  it('passes a platform through', async () => {
    const calls: CategoryArgs[] = [];
    mock.method(igdb, 'getTopRatedByCategory', async (args: CategoryArgs) => {
      calls.push(args);
      return games(50, 500);
    });

    await computeChart('shooter', 6);

    assert.equal(calls[0].platform, 6);
  });

  it('lowers the vote minimum for small categories', async () => {
    const minimums: number[] = [];
    mock.method(igdb, 'getTopRatedByCategory', async (args: CategoryArgs) => {
      minimums.push(args.minRatingCount);
      // Only the loosest minimum yields enough games
      return args.minRatingCount <= 50 ? games(45, 80) : games(5, 80);
    });

    const chart = await computeChart('visual-novel', 0);

    assert.deepStrictEqual(minimums, [200, 100, 50]);
    assert.equal(chart.minRatingCount, 50);
    assert.equal(chart.results.length, 45);
  });

  it('keeps the best rated first and drops games below the minimum', async () => {
    mock.method(igdb, 'getTopRatedByCategory', async () => [
      { id: 1, name: 'Lower', total_rating: 80, total_rating_count: 500 },
      { id: 2, name: 'Higher', total_rating: 95, total_rating_count: 500 },
      { id: 3, name: 'Barely', total_rating: 100, total_rating_count: 2 },
    ]);

    const chart = await computeChart('rpg', 0);

    assert.deepStrictEqual(
      chart.results.map((game) => game.name),
      ['Higher', 'Lower']
    );
  });
});

describe('getChart', () => {
  it('serves a stored chart without asking IGDB', async () => {
    const stored = {
      chart: 'rpg',
      platform: 0,
      generatedAt: '2026-01-01T00:00:00.000Z',
      results: [],
      minRatingCount: 200,
    };
    await setCachedMetadata(chartKey('rpg', 0), 'list', stored);
    const query = mock.method(igdb, 'getTopRatedByCategory', async () => []);

    assert.deepStrictEqual(await getChart('rpg', 0), stored);
    assert.equal(query.mock.callCount(), 0);
  });

  it('computes and stores a missing chart', async () => {
    const query = mock.method(igdb, 'getTopRatedByCategory', async () =>
      games(45, 500)
    );

    const first = await getChart('roguelike', 0);
    const second = await getChart('roguelike', 0);

    assert.equal(first.results.length, 45);
    assert.equal(second.generatedAt, first.generatedAt);
    assert.equal(second.results.length, first.results.length);
    assert.equal(query.mock.callCount(), 1);
  });
});
