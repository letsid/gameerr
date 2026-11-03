import { IgdbNotConfiguredError } from '@server/api/igdb';
import { getRepository } from '@server/datasource';
import { Watchlist } from '@server/entity/Watchlist';
import type { WatchlistResponse } from '@server/interfaces/api/discoverInterfaces';
import type { DiscoverListResponse } from '@server/interfaces/api/gameInterfaces';
import { getDiscoverList, isDiscoverListId } from '@server/lib/discover';
import { withMediaInfo } from '@server/lib/gameResults';
import { resolvePlatforms } from '@server/lib/platforms';
import logger from '@server/logger';
import { Router } from 'express';
import { z } from 'zod';

const DISCOVER_PAGE_SIZE = 20;

const discoverListQuery = z.object({
  platform: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
});

const discoverRoutes = Router();

discoverRoutes.get<Record<string, unknown>, WatchlistResponse>(
  '/watchlist',
  async (req, res) => {
    const itemsPerPage = 20;
    const page = req.query.page ? Number(req.query.page) : 1;
    const offset = (page - 1) * itemsPerPage;

    if (!req.user) {
      return res.json({
        page: 1,
        totalPages: 1,
        totalResults: 0,
        results: [],
      });
    }

    const [result, total] = await getRepository(Watchlist).findAndCount({
      where: { requestedBy: { id: req.user.id } },
      order: { createdAt: 'DESC' },
      take: itemsPerPage,
      skip: offset,
    });

    return res.json({
      page,
      totalPages: Math.max(1, Math.ceil(total / itemsPerPage)),
      totalResults: total,
      results: result.map((item) => ({
        id: item.id,
        igdbId: item.igdbId,
        mediaType: item.mediaType,
        title: item.title,
        coverImageId: item.media?.coverImageId ?? null,
      })),
    });
  }
);

discoverRoutes.get<{ list: string }, DiscoverListResponse>(
  '/:list',
  async (req, res, next) => {
    const { list } = req.params;

    if (!isDiscoverListId(list)) {
      return next({ status: 404, message: 'Unknown discover list.' });
    }

    const query = discoverListQuery.safeParse(req.query);

    if (!query.success) {
      return next({ status: 400, message: 'Invalid query.' });
    }

    const platform =
      query.data.platform ??
      resolvePlatforms(req.user?.settings?.preferredPlatforms)[0];
    const page = query.data.page;

    try {
      const discoverList = await getDiscoverList(list, platform);
      const total = discoverList.results.length;
      const offset = (page - 1) * DISCOVER_PAGE_SIZE;

      return res.status(200).json({
        list,
        platform,
        generatedAt: discoverList.generatedAt,
        minRatingCount: discoverList.minRatingCount,
        page,
        totalPages: Math.max(1, Math.ceil(total / DISCOVER_PAGE_SIZE)),
        totalResults: total,
        results: await withMediaInfo(
          discoverList.results.slice(offset, offset + DISCOVER_PAGE_SIZE),
          req.user
        ),
      });
    } catch (e) {
      if (e instanceof IgdbNotConfiguredError) {
        return next({ status: 503, message: e.message });
      }

      logger.error('Failed to load discover list', {
        label: 'API',
        list,
        platform,
        errorMessage: e.message,
      });
      return next({ status: 500, message: 'Unable to load discover list.' });
    }
  }
);

export default discoverRoutes;
