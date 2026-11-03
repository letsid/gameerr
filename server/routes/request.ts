import igdb from '@server/api/igdb';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type { RequestGameInfo } from '@server/entity/MediaRequest';
import {
  BlocklistedMediaError,
  DuplicateMediaRequestError,
  InvalidPlatformError,
  MediaRequest,
  QuotaRestrictedError,
  RequestPermissionError,
} from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import type {
  MediaRequestBody,
  RequestCountResponse,
  RequestResultsResponse,
} from '@server/interfaces/api/requestInterfaces';
import { getGameDetails, toRequestGameInfo } from '@server/lib/gameDetails';
import { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { isAuthenticated } from '@server/middleware/auth';
import requestLock, { requestKey, userKey } from '@server/utils/requestLock';
import { Router } from 'express';
import { In } from 'typeorm';
import { z } from 'zod';

const requestRoutes = Router();

const requestCreate = z.object({
  igdbId: z.coerce.number().int().positive(),
  platform: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive().optional(),
  ignoreQuota: z.boolean().optional(),
});

const requestUpdate = z.object({
  platform: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
});

requestRoutes.get<Record<string, unknown>, RequestResultsResponse>(
  '/',
  async (req, res, next) => {
    try {
      const pageSize = req.query.take ? Number(req.query.take) : 10;
      const skip = req.query.skip ? Number(req.query.skip) : 0;
      const requestedBy = req.query.requestedBy
        ? Number(req.query.requestedBy)
        : null;

      let statusFilter: MediaRequestStatus[];

      switch (req.query.filter) {
        case 'approved':
        case 'processing':
          statusFilter = [MediaRequestStatus.APPROVED];
          break;
        case 'pending':
          statusFilter = [MediaRequestStatus.PENDING];
          break;
        case 'unavailable':
          statusFilter = [
            MediaRequestStatus.PENDING,
            MediaRequestStatus.APPROVED,
          ];
          break;
        case 'failed':
          statusFilter = [MediaRequestStatus.FAILED];
          break;
        case 'completed':
        case 'available':
        case 'deleted':
          statusFilter = [MediaRequestStatus.COMPLETED];
          break;
        default:
          statusFilter = [
            MediaRequestStatus.PENDING,
            MediaRequestStatus.APPROVED,
            MediaRequestStatus.DECLINED,
            MediaRequestStatus.FAILED,
            MediaRequestStatus.COMPLETED,
          ];
      }

      let mediaStatusFilter: MediaStatus[];

      switch (req.query.filter) {
        case 'available':
          mediaStatusFilter = [MediaStatus.AVAILABLE];
          break;
        case 'processing':
        case 'unavailable':
          mediaStatusFilter = [
            MediaStatus.UNKNOWN,
            MediaStatus.PENDING,
            MediaStatus.PROCESSING,
            MediaStatus.PARTIALLY_AVAILABLE,
          ];
          break;
        case 'deleted':
          mediaStatusFilter = [MediaStatus.DELETED];
          break;
        default:
          mediaStatusFilter = [
            MediaStatus.UNKNOWN,
            MediaStatus.PENDING,
            MediaStatus.PROCESSING,
            MediaStatus.PARTIALLY_AVAILABLE,
            MediaStatus.AVAILABLE,
            MediaStatus.DELETED,
          ];
      }

      let sortFilter: string;
      let sortDirection: 'ASC' | 'DESC';

      switch (req.query.sort) {
        case 'modified':
          sortFilter = 'request.updatedAt';
          break;
        case 'added':
          sortFilter = 'request.createdAt';
          break;
        default:
          sortFilter = 'request.id';
      }

      switch (req.query.sortDirection) {
        case 'asc':
          sortDirection = 'ASC';
          break;
        default:
          sortDirection = 'DESC';
      }

      let query = getRepository(MediaRequest)
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.media', 'media')
        .leftJoinAndSelect('request.modifiedBy', 'modifiedBy')
        .leftJoinAndSelect('request.requestedBy', 'requestedBy')
        .where('request.status IN (:...requestStatus)', {
          requestStatus: statusFilter,
        })
        .andWhere('media.status IN (:...mediaStatus)', {
          mediaStatus: mediaStatusFilter,
        });

      if (
        !req.user?.hasPermission(
          [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
          { type: 'or' }
        )
      ) {
        if (requestedBy && requestedBy !== req.user?.id) {
          return next({
            status: 403,
            message: "You do not have permission to view this user's requests.",
          });
        }

        query = query.andWhere('requestedBy.id = :id', {
          id: req.user?.id,
        });
      } else if (requestedBy) {
        query = query.andWhere('requestedBy.id = :id', {
          id: requestedBy,
        });
      }

      const [requests, requestCount] = await query
        .orderBy(sortFilter, sortDirection)
        .addOrderBy('request.id', sortDirection)
        .take(pageSize)
        .skip(skip)
        .getManyAndCount();

      const canRemove = !!req.user?.hasPermission(Permission.MANAGE_REQUESTS);

      return res.status(200).json({
        pageInfo: {
          pages: Math.ceil(requestCount / pageSize),
          pageSize,
          results: requestCount,
          page: Math.ceil(skip / pageSize) + 1,
        },
        results: requests.map((r) => ({ ...r, canRemove })),
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

requestRoutes.post<never, MediaRequest, MediaRequestBody>(
  '/',
  async (req, res, next) => {
    try {
      if (!req.user) {
        return next({
          status: 401,
          message: 'You must be logged in to request media.',
        });
      }

      const body = requestCreate.safeParse(req.body);

      if (!body.success) {
        return next({ status: 400, message: 'Invalid request body.' });
      }

      // Validates the platform and keeps title and cover on the media row.
      // Without IGDB the request still goes through, just without both.
      let game: RequestGameInfo | undefined;
      if (igdb.isConfigured()) {
        const details = await getGameDetails(body.data.igdbId);

        if (!details) {
          return next({ status: 404, message: 'Game not found.' });
        }

        game = toRequestGameInfo(details);
      }

      const request = await MediaRequest.request(body.data, req.user, game);

      return res.status(201).json(request);
    } catch (error) {
      if (!(error instanceof Error)) {
        return;
      }

      switch (error.constructor) {
        case RequestPermissionError:
        case QuotaRestrictedError:
          return next({ status: 403, message: error.message });
        case DuplicateMediaRequestError:
          return next({ status: 409, message: error.message });
        case InvalidPlatformError:
          return next({ status: 400, message: error.message });
        case BlocklistedMediaError:
          return next({ status: 403, message: error.message });
        default:
          return next({ status: 500, message: error.message });
      }
    }
  }
);

requestRoutes.get('/count', async (_req, res, next) => {
  const requestRepository = getRepository(MediaRequest);

  try {
    const query = requestRepository
      .createQueryBuilder('request')
      .innerJoinAndSelect('request.media', 'media');

    const countByStatus = (status: MediaRequestStatus) =>
      query
        .where('request.status = :requestStatus', { requestStatus: status })
        .getCount();

    const totalCount = await query.getCount();
    const pendingCount = await countByStatus(MediaRequestStatus.PENDING);
    const approvedCount = await countByStatus(MediaRequestStatus.APPROVED);
    const declinedCount = await countByStatus(MediaRequestStatus.DECLINED);
    const completedCount = await countByStatus(MediaRequestStatus.COMPLETED);
    const failedCount = await countByStatus(MediaRequestStatus.FAILED);

    const processingCount = await query
      .where('request.status = :requestStatus', {
        requestStatus: MediaRequestStatus.APPROVED,
      })
      .andWhere('media.status != :availableStatus', {
        availableStatus: MediaStatus.AVAILABLE,
      })
      .getCount();

    const availableCount = await query
      .where('request.status = :requestStatus', {
        requestStatus: MediaRequestStatus.APPROVED,
      })
      .andWhere('media.status = :availableStatus', {
        availableStatus: MediaStatus.AVAILABLE,
      })
      .getCount();

    return res.status(200).json({
      total: totalCount,
      pending: pendingCount,
      approved: approvedCount,
      declined: declinedCount,
      processing: processingCount,
      available: availableCount,
      completed: completedCount,
      failed: failedCount,
    } as RequestCountResponse);
  } catch (e) {
    logger.error('Something went wrong retrieving request counts', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 500, message: 'Unable to retrieve request counts.' });
  }
});

requestRoutes.get('/:requestId', async (req, res, next) => {
  const requestRepository = getRepository(MediaRequest);

  try {
    const request = await requestRepository.findOneOrFail({
      where: { id: Number(req.params.requestId) },
      relations: { requestedBy: true, modifiedBy: true },
    });

    if (
      request.requestedBy.id !== req.user?.id &&
      !req.user?.hasPermission(
        [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
        { type: 'or' }
      )
    ) {
      return next({
        status: 403,
        message: 'You do not have permission to view this request.',
      });
    }

    return res.status(200).json(request);
  } catch (e) {
    logger.debug('Failed to retrieve request.', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 404, message: 'Request not found.' });
  }
});

requestRoutes.put<{ requestId: string }>(
  '/:requestId',
  async (req, res, next) => {
    const requestRepository = getRepository(MediaRequest);
    const userRepository = getRepository(User);
    const requestId = Number(req.params.requestId);

    const body = requestUpdate.safeParse(req.body);

    if (!body.success) {
      return next({ status: 400, message: 'Invalid request body.' });
    }

    try {
      // Ordering is request then owner here, user then media on create, so no cycle
      return await requestLock.dispatch(requestKey(requestId), async () => {
        const request = await requestRepository.findOne({
          where: {
            id: requestId,
          },
        });

        if (!request) {
          return next({ status: 404, message: 'Request not found.' });
        }

        if (
          request.requestedBy.id !== req.user?.id &&
          !req.user?.hasPermission(Permission.MANAGE_REQUESTS)
        ) {
          return next({
            status: 403,
            message: 'You do not have permission to modify this request.',
          });
        }

        if (request.status !== MediaRequestStatus.PENDING) {
          return next({
            status: 409,
            message: 'Only pending requests can be modified.',
          });
        }

        let requestUser = request.requestedBy;

        if (
          body.data.userId &&
          body.data.userId !== request.requestedBy.id &&
          !req.user?.hasPermission([
            Permission.MANAGE_USERS,
            Permission.MANAGE_REQUESTS,
          ])
        ) {
          return next({
            status: 403,
            message: 'You do not have permission to modify the request user.',
          });
        } else if (body.data.userId) {
          requestUser = await userRepository.findOneOrFail({
            where: { id: body.data.userId },
          });
        }

        // Reassignment moves the request onto the new owner's quota
        const ownerChanging = requestUser.id !== request.requestedBy.id;

        return requestLock.dispatch(userKey(requestUser.id), async () => {
          if (ownerChanging && !request.ignoreQuota) {
            const quotas = await requestUser.getQuota();

            if (quotas.game.restricted) {
              return next({
                status: 403,
                message: 'Game quota exceeded.',
              });
            }
          }

          if (body.data.platform && body.data.platform !== request.platform) {
            const duplicate = await requestRepository
              .createQueryBuilder('request')
              .leftJoin('request.media', 'media')
              .where('media.id = :mediaId', { mediaId: request.media.id })
              .andWhere('request.id != :requestId', { requestId: request.id })
              .andWhere('request.platform = :platform', {
                platform: body.data.platform,
              })
              .andWhere('request.status NOT IN (:...statuses)', {
                statuses: [
                  MediaRequestStatus.DECLINED,
                  MediaRequestStatus.COMPLETED,
                ],
              })
              .getCount();

            if (duplicate > 0) {
              return next({
                status: 409,
                message: 'A request for this game and platform already exists.',
              });
            }

            if (
              request.media.platforms?.length &&
              !request.media.platforms.includes(body.data.platform)
            ) {
              return next({
                status: 400,
                message:
                  'The game is not available for the requested platform.',
              });
            }

            request.platform = body.data.platform;
          }

          request.requestedBy = requestUser as User;

          await requestRepository.save(request);

          return res.status(200).json(request);
        });
      });
    } catch (e) {
      next({ status: 500, message: e.message });
    }
  }
);

requestRoutes.delete('/:requestId', async (req, res, next) => {
  const requestRepository = getRepository(MediaRequest);
  const requestId = Number(req.params.requestId);

  try {
    return await requestLock.dispatch(requestKey(requestId), async () => {
      const request = await requestRepository.findOneOrFail({
        where: { id: requestId },
        relations: { requestedBy: true, modifiedBy: true },
      });

      if (
        !req.user?.hasPermission(Permission.MANAGE_REQUESTS) &&
        (request.requestedBy.id !== req.user?.id ||
          request.status !== MediaRequestStatus.PENDING)
      ) {
        return next({
          status: 401,
          message: 'You do not have permission to delete this request.',
        });
      }

      await requestRepository.remove(request);

      return res.status(204).send();
    });
  } catch (e) {
    logger.error('Something went wrong deleting a request.', {
      label: 'API',
      errorMessage: e.message,
    });
    next({ status: 404, message: 'Request not found.' });
  }
});

requestRoutes.post<{
  requestId: string;
}>(
  '/:requestId/retry',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const requestRepository = getRepository(MediaRequest);
    const requestId = Number(req.params.requestId);

    try {
      return await requestLock.dispatch(requestKey(requestId), async () => {
        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        if (request.status !== MediaRequestStatus.FAILED) {
          return next({
            status: 409,
            message: 'Only failed requests can be retried.',
          });
        }

        // this also triggers updating the parent media's status
        request.status = MediaRequestStatus.APPROVED;
        request.modifiedBy = req.user;
        await requestRepository.save(request);

        return res.status(200).json(request);
      });
    } catch (e) {
      logger.error('Error processing request retry', {
        label: 'Media Request',
        message: e.message,
      });
      next({ status: 404, message: 'Request not found.' });
    }
  }
);

requestRoutes.post<{
  requestId: string;
}>(
  '/:requestId/complete',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const requestRepository = getRepository(MediaRequest);
    const mediaRepository = getRepository(Media);
    const requestId = Number(req.params.requestId);

    try {
      return await requestLock.dispatch(requestKey(requestId), async () => {
        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        if (request.status !== MediaRequestStatus.APPROVED) {
          return next({
            status: 409,
            message: 'Only approved requests can be marked as completed.',
          });
        }

        // Completing one platform must not close the requests of others,
        // which a media save would do through the media subscriber.
        // When the game is already available the request subscriber sends
        // the availability notification itself.
        const wasAvailable =
          (
            await mediaRepository.findOneOrFail({
              where: { id: request.media.id },
            })
          ).status === MediaStatus.AVAILABLE;

        request.status = MediaRequestStatus.COMPLETED;
        request.modifiedBy = req.user;
        await requestRepository.save(request);

        const media = await mediaRepository.findOneOrFail({
          where: { id: request.media.id },
        });
        const stillOpen = await requestRepository.count({
          where: {
            media: { id: media.id },
            status: In([
              MediaRequestStatus.PENDING,
              MediaRequestStatus.APPROVED,
              MediaRequestStatus.FAILED,
            ]),
          },
        });

        if (stillOpen === 0 && media.status !== MediaStatus.AVAILABLE) {
          media.status = MediaStatus.AVAILABLE;
          media.mediaAddedAt = new Date();
          await mediaRepository
            .createQueryBuilder()
            .update()
            .set({ status: media.status, mediaAddedAt: media.mediaAddedAt })
            .where('id = :id', { id: media.id })
            .callListeners(false)
            .execute();
        }

        if (!wasAvailable) {
          MediaRequest.sendNotification(
            request,
            media,
            Notification.MEDIA_AVAILABLE
          );
        }

        return res.status(200).json(request);
      });
    } catch (e) {
      logger.error('Error completing request', {
        label: 'Media Request',
        message: e.message,
      });
      next({ status: 404, message: 'Request not found.' });
    }
  }
);

requestRoutes.post<{
  requestId: string;
  status: 'approve' | 'decline';
}>(
  '/:requestId/:status',
  isAuthenticated(Permission.MANAGE_REQUESTS),
  async (req, res, next) => {
    const requestRepository = getRepository(MediaRequest);
    const requestId = Number(req.params.requestId);

    try {
      return await requestLock.dispatch(requestKey(requestId), async () => {
        const request = await requestRepository.findOneOrFail({
          where: { id: requestId },
          relations: { requestedBy: true, modifiedBy: true },
        });

        let newStatus: MediaRequestStatus;

        switch (req.params.status) {
          case 'approve':
            newStatus = MediaRequestStatus.APPROVED;
            break;
          case 'decline':
            newStatus = MediaRequestStatus.DECLINED;
            break;
          default:
            return next({
              status: 400,
              message: 'Status must be approve or decline.',
            });
        }

        if (request.status !== MediaRequestStatus.PENDING) {
          return next({
            status: 409,
            message: 'Only pending requests can be approved or declined.',
          });
        }

        request.status = newStatus;
        request.modifiedBy = req.user;
        await requestRepository.save(request);

        return res.status(200).json(request);
      });
    } catch (e) {
      logger.error('Error processing request update', {
        label: 'Media Request',
        message: e.message,
      });
      next({ status: 404, message: 'Request not found.' });
    }
  }
);

export default requestRoutes;
