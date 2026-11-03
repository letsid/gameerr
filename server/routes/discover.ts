import { getRepository } from '@server/datasource';
import { Watchlist } from '@server/entity/Watchlist';
import type { WatchlistResponse } from '@server/interfaces/api/discoverInterfaces';
import { Router } from 'express';

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

export default discoverRoutes;
