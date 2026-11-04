import { IgdbNotConfiguredError } from '@server/api/igdb';
import Media from '@server/entity/Media';
import type {
  GameDetailsResponse,
  GameScoresResponse,
} from '@server/interfaces/api/gameInterfaces';
import { getGameDetails } from '@server/lib/gameDetails';
import { getGameScores } from '@server/lib/gameScores';
import { getLibraryEntries } from '@server/lib/library';
import logger from '@server/logger';
import { Router } from 'express';

const gameRoutes = Router();

const parseId = (value: string): number | undefined => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
};

gameRoutes.get<{ id: string }, GameDetailsResponse>(
  '/:id',
  async (req, res, next) => {
    const id = parseId(req.params.id);

    if (!id) {
      return next({ status: 400, message: 'Invalid game id.' });
    }

    try {
      const game = await getGameDetails(id);

      if (!game) {
        return next({ status: 404, message: 'Game not found.' });
      }

      const [mediaInfo] = await Media.getRelatedMedia(req.user, [id]);
      const media = mediaInfo
        ? await Media.getMedia(id).then((full) => ({
            ...full,
            watchlists: mediaInfo.watchlists,
          }))
        : undefined;

      const library = (await getLibraryEntries([id])).get(id) ?? [];

      return res
        .status(200)
        .json({ ...game, mediaInfo: media as Media, library });
    } catch (e) {
      if (e instanceof IgdbNotConfiguredError) {
        return next({ status: 503, message: e.message });
      }

      logger.error('Failed to load game details', {
        label: 'API',
        id,
        errorMessage: e.message,
      });
      return next({ status: 500, message: 'Unable to load game details.' });
    }
  }
);

// Separate from the details so the page renders before slow score sources
gameRoutes.get<{ id: string }, GameScoresResponse>(
  '/:id/scores',
  async (req, res, next) => {
    const id = parseId(req.params.id);

    if (!id) {
      return next({ status: 400, message: 'Invalid game id.' });
    }

    try {
      const game = await getGameDetails(id);

      if (!game) {
        return next({ status: 404, message: 'Game not found.' });
      }

      return res.status(200).json({ results: await getGameScores(game) });
    } catch (e) {
      if (e instanceof IgdbNotConfiguredError) {
        return next({ status: 503, message: e.message });
      }

      logger.error('Failed to load game scores', {
        label: 'API',
        id,
        errorMessage: e.message,
      });
      return next({ status: 500, message: 'Unable to load scores.' });
    }
  }
);

export default gameRoutes;
