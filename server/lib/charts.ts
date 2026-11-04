import igdb from '@server/api/igdb';
import type { DiscoverGame } from '@server/lib/discover';
import { rankByRating, toDiscoverGame } from '@server/lib/discover';
import {
  getCachedMetadata,
  setCachedMetadata,
} from '@server/lib/gameMetadataCache';
import logger from '@server/logger';

/**
 * Categories of the all-time charts. Most are IGDB genres. Roguelike and
 * Action RPG are no IGDB genres, they are built from genre and keyword ids.
 * The filter is an Apicalypse condition, `(a, b)` matches any of the ids.
 */
export const CHART_CATEGORIES = [
  { id: 'rpg', filter: 'genres = (12)' },
  {
    id: 'action-rpg',
    filter: 'genres = (12) & (genres = (25) | keywords = (43599, 581, 17326))',
  },
  { id: 'roguelike', filter: 'keywords = (416, 17292, 27419)' },
  { id: 'shooter', filter: 'genres = (5)' },
  { id: 'strategy', filter: 'genres = (15, 16, 11)' },
  { id: 'adventure', filter: 'genres = (31)' },
  { id: 'indie', filter: 'genres = (32)' },
  { id: 'platform', filter: 'genres = (8)' },
  { id: 'puzzle', filter: 'genres = (9)' },
  { id: 'simulator', filter: 'genres = (13)' },
  { id: 'hack-and-slash', filter: 'genres = (25)' },
  { id: 'arcade', filter: 'genres = (33)' },
  { id: 'racing', filter: 'genres = (10)' },
  { id: 'sport', filter: 'genres = (14)' },
  { id: 'fighting', filter: 'genres = (4)' },
  { id: 'turn-based-strategy', filter: 'genres = (16)' },
  { id: 'real-time-strategy', filter: 'genres = (11)' },
  { id: 'tactical', filter: 'genres = (24)' },
  { id: 'point-and-click', filter: 'genres = (2)' },
  { id: 'visual-novel', filter: 'genres = (34)' },
  { id: 'card-and-board-game', filter: 'genres = (35)' },
  { id: 'music', filter: 'genres = (7)' },
] as const;

export type ChartId = (typeof CHART_CATEGORIES)[number]['id'];

export const isChartId = (value: unknown): value is ChartId =>
  CHART_CATEGORIES.some((category) => category.id === value);

// Games kept per chart
export const CHART_SIZE = 100;

// Vote minimums to try, strictest first. A game rated by three people must
// not top a chart, small categories such as visual novels still fill up.
export const CHART_RATING_MINIMUMS = [200, 100, 50, 20];
// A chart with this many games is full enough, stricter minimums stop here
export const CHART_TARGET = 40;

export interface Chart {
  chart: ChartId;
  // 0 for all platforms
  platform: number;
  generatedAt: string;
  results: DiscoverGame[];
  // Vote minimum the chart was built with
  minRatingCount: number;
}

export const chartKey = (chart: ChartId, platform: number) =>
  `chart:${chart}:${platform}`;

export const computeChart = async (
  chart: ChartId,
  platform: number
): Promise<Chart> => {
  const category = CHART_CATEGORIES.find(({ id }) => id === chart);

  if (!category) {
    throw new Error(`Unknown chart ${chart}`);
  }

  let best: Chart = {
    chart,
    platform,
    generatedAt: new Date().toISOString(),
    results: [],
    minRatingCount: CHART_RATING_MINIMUMS[CHART_RATING_MINIMUMS.length - 1],
  };

  for (const minRatingCount of CHART_RATING_MINIMUMS) {
    const games = await igdb.getTopRatedByCategory({
      categoryFilter: category.filter,
      platform: platform || undefined,
      minRatingCount,
      limit: CHART_SIZE,
    });

    best = {
      ...best,
      results: rankByRating(games.map(toDiscoverGame), minRatingCount).slice(
        0,
        CHART_SIZE
      ),
      minRatingCount,
    };

    if (best.results.length >= CHART_TARGET) {
      break;
    }
  }

  return best;
};

const pending = new Map<string, Promise<Chart>>();

export const refreshChart = (
  chart: ChartId,
  platform: number
): Promise<Chart> => {
  const key = chartKey(chart, platform);
  const running = pending.get(key);

  if (running) {
    return running;
  }

  const task = (async () => {
    const value = await computeChart(chart, platform);
    await setCachedMetadata(key, 'list', value);
    return value;
  })().finally(() => pending.delete(key));

  pending.set(key, task);
  return task;
};

/**
 * Serves the stored chart. A stale copy is preferred over an error and
 * refreshed in the background, the nightly job keeps the all-platform
 * charts warm.
 */
export const getChart = async (
  chart: ChartId,
  platform: number
): Promise<Chart> => {
  const cached = await getCachedMetadata<Chart>(chartKey(chart, platform));

  if (cached && !cached.expired) {
    return cached.value;
  }

  if (cached) {
    refreshChart(chart, platform).catch((e) =>
      logger.warn('Chart refresh failed', {
        label: 'Charts',
        chart,
        platform,
        errorMessage: e.message,
      })
    );
    return cached.value;
  }

  return refreshChart(chart, platform);
};

/**
 * Rebuilds the all-platform chart of every category
 */
export const refreshAllCharts = async ({
  force = true,
}: { force?: boolean } = {}): Promise<void> => {
  if (!igdb.isConfigured()) {
    return;
  }

  for (const { id } of CHART_CATEGORIES) {
    try {
      if (!force) {
        const cached = await getCachedMetadata<Chart>(chartKey(id, 0));
        if (cached && !cached.expired) {
          continue;
        }
      }

      const result = await refreshChart(id, 0);
      logger.info('Refreshed chart', {
        label: 'Charts',
        chart: id,
        count: result.results.length,
        minRatingCount: result.minRatingCount,
      });
    } catch (e) {
      logger.error('Failed to refresh chart', {
        label: 'Charts',
        chart: id,
        errorMessage: e.message,
      });
    }
  }
};
