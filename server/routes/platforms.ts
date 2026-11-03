import type { PlatformsResponse } from '@server/interfaces/api/gameInterfaces';
import { getPlatforms } from '@server/lib/platforms';
import logger from '@server/logger';
import { Router } from 'express';

const platformRoutes = Router();

platformRoutes.get<never, PlatformsResponse>('/', async (_req, res, next) => {
  try {
    const platforms = await getPlatforms();

    return res.status(200).json({
      results: [...platforms].sort((a, b) => a.name.localeCompare(b.name)),
    });
  } catch (e) {
    logger.error('Failed to load platforms', {
      label: 'API',
      errorMessage: e.message,
    });
    return next({ status: 500, message: 'Unable to load platforms.' });
  }
});

export default platformRoutes;
