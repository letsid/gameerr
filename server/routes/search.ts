import igdb, { IgdbNotConfiguredError } from '@server/api/igdb';
import type { GameResultsResponse } from '@server/interfaces/api/gameInterfaces';
import { toDiscoverGame } from '@server/lib/discover';
import { withMediaInfo } from '@server/lib/gameResults';
import { normalizePlatformIds, resolvePlatforms } from '@server/lib/platforms';
import logger from '@server/logger';
import { Router } from 'express';
import { z } from 'zod';

const searchRoutes = Router();

const SEARCH_PAGE_SIZE = 20;

const searchQuery = z.object({
  query: z.string().trim().min(1).max(200),
  page: z.coerce.number().int().positive().max(25).default(1),
  // Comma separated IGDB platform ids, "all" searches every platform
  platforms: z.string().optional(),
});

searchRoutes.get<never, GameResultsResponse>('/', async (req, res, next) => {
  const parsed = searchQuery.safeParse(req.query);

  if (!parsed.success) {
    return res.status(200).json({
      page: 1,
      totalPages: 1,
      totalResults: 0,
      results: [],
    });
  }

  const { query, page } = parsed.data;
  const platforms =
    parsed.data.platforms === 'all'
      ? []
      : parsed.data.platforms
        ? normalizePlatformIds(parsed.data.platforms.split(','))
        : resolvePlatforms(req.user?.settings?.preferredPlatforms);

  try {
    // Ask for one extra result to learn whether another page exists
    const games = await igdb.searchGames({
      query,
      platforms,
      limit: SEARCH_PAGE_SIZE + 1,
      offset: (page - 1) * SEARCH_PAGE_SIZE,
    });
    const hasMore = games.length > SEARCH_PAGE_SIZE;
    const results = await withMediaInfo(
      games.slice(0, SEARCH_PAGE_SIZE).map(toDiscoverGame),
      req.user
    );

    return res.status(200).json({
      page,
      totalPages: hasMore ? page + 1 : page,
      totalResults: (page - 1) * SEARCH_PAGE_SIZE + games.length,
      results,
    });
  } catch (e) {
    if (e instanceof IgdbNotConfiguredError) {
      return next({ status: 503, message: e.message });
    }

    logger.error('Game search failed', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Unable to search games.' });
  }
});

export default searchRoutes;
