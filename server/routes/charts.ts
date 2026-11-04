import { IgdbNotConfiguredError } from '@server/api/igdb';
import type {
  ChartCategoriesResponse,
  ChartResponse,
} from '@server/interfaces/api/gameInterfaces';
import { CHART_CATEGORIES, getChart, isChartId } from '@server/lib/charts';
import { withMediaInfo } from '@server/lib/gameResults';
import logger from '@server/logger';
import { Router } from 'express';
import { z } from 'zod';

const CHART_PAGE_SIZE = 20;

const chartQuery = z.object({
  // 0 or none: all platforms
  platform: z.coerce.number().int().nonnegative().default(0),
  page: z.coerce.number().int().positive().default(1),
});

const chartRoutes = Router();

chartRoutes.get<Record<string, unknown>, ChartCategoriesResponse>(
  '/',
  (_req, res) => res.json({ results: CHART_CATEGORIES.map(({ id }) => id) })
);

chartRoutes.get<{ chart: string }, ChartResponse>(
  '/:chart',
  async (req, res, next) => {
    const { chart } = req.params;

    if (!isChartId(chart)) {
      return next({ status: 404, message: 'Unknown chart.' });
    }

    const query = chartQuery.safeParse(req.query);

    if (!query.success) {
      return next({ status: 400, message: 'Invalid query.' });
    }

    const { platform, page } = query.data;

    try {
      const result = await getChart(chart, platform);
      const total = result.results.length;
      const offset = (page - 1) * CHART_PAGE_SIZE;

      return res.status(200).json({
        chart,
        platform,
        generatedAt: result.generatedAt,
        minRatingCount: result.minRatingCount,
        page,
        totalPages: Math.max(1, Math.ceil(total / CHART_PAGE_SIZE)),
        totalResults: total,
        results: await withMediaInfo(
          result.results.slice(offset, offset + CHART_PAGE_SIZE),
          req.user
        ),
      });
    } catch (e) {
      if (e instanceof IgdbNotConfiguredError) {
        return next({ status: 503, message: e.message });
      }

      logger.error('Failed to load chart', {
        label: 'API',
        chart,
        platform,
        errorMessage: e.message,
      });
      return next({ status: 500, message: 'Unable to load chart.' });
    }
  }
);

export default chartRoutes;
