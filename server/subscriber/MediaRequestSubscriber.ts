import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { submitForFulfillment } from '@server/lib/fulfillment';
import { Notification } from '@server/lib/notifications';
import logger from '@server/logger';
import { withNestedTransaction } from '@server/utils/nestedTransaction';
import type {
  EntityManager,
  EntitySubscriberInterface,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber, In, Not } from 'typeorm';

/**
 * Starts fulfillment once the saving transaction is done, so the provider
 * can write to the database without waiting on it
 */
const scheduleFulfillment = (request: MediaRequest) => {
  setImmediate(() => {
    submitForFulfillment(request).catch((e) =>
      logger.error('Fulfillment could not be started', {
        label: 'Fulfillment',
        requestId: request.id,
        errorMessage: e instanceof Error ? e.message : String(e),
      })
    );
  });
};

@EventSubscriber()
export class MediaRequestSubscriber implements EntitySubscriberInterface<MediaRequest> {
  private async notifyAvailable(
    entity: MediaRequest,
    event?: UpdateEvent<MediaRequest>
  ) {
    // Get fresh media state using event manager
    let latestMedia: Media | null = null;
    if (event?.manager) {
      latestMedia = await event.manager.findOne(Media, {
        where: { id: entity.media.id },
      });
    }
    if (!latestMedia) {
      const mediaRepository = getRepository(Media);
      latestMedia = await mediaRepository.findOne({
        where: { id: entity.media.id },
      });
    }

    if (!latestMedia || latestMedia.status !== MediaStatus.AVAILABLE) {
      return;
    }

    MediaRequest.sendNotification(
      entity,
      latestMedia,
      Notification.MEDIA_AVAILABLE
    );
  }

  public async updateParentStatus(
    manager: EntityManager,
    entity: MediaRequest
  ): Promise<void> {
    const mediaRepository = manager.getRepository(Media);
    const requestRepository = manager.getRepository(MediaRequest);
    const media = await mediaRepository.findOne({
      where: { id: entity.media.id },
    });
    if (!media) {
      logger.error('Media data not found', {
        label: 'Media Request',
        requestId: entity.id,
        mediaId: entity.media.id,
      });
      return;
    }

    if (
      entity.status === MediaRequestStatus.APPROVED &&
      // Do not update the status if the item is already available or processing
      media.status !== MediaStatus.AVAILABLE &&
      media.status !== MediaStatus.PARTIALLY_AVAILABLE &&
      media.status !== MediaStatus.PROCESSING
    ) {
      media.status = MediaStatus.PROCESSING;
      await mediaRepository.save(media);
    }

    /**
     * A game can be requested for several platforms. When declining a request
     * only reset the media status if no other request is still active.
     */
    if (
      entity.status === MediaRequestStatus.DECLINED &&
      (media.status === MediaStatus.PENDING ||
        media.status === MediaStatus.PROCESSING)
    ) {
      const activeCount = await requestRepository.count({
        where: {
          media: { id: media.id },
          status: In([MediaRequestStatus.PENDING, MediaRequestStatus.APPROVED]),
          id: Not(entity.id),
        },
      });

      if (activeCount === 0) {
        media.status = MediaStatus.UNKNOWN;
        await mediaRepository.save(media);
      }
    }
  }

  public async handleRemoveParentUpdate(
    manager: EntityManager,
    entity: MediaRequest
  ): Promise<void> {
    const fullMedia = await manager.findOneOrFail(Media, {
      where: { id: entity.media.id },
      relations: { requests: true },
    });

    const hasActive = fullMedia.requests.some(
      (request) =>
        request.status !== MediaRequestStatus.COMPLETED &&
        request.status !== MediaRequestStatus.DECLINED
    );

    if (
      !hasActive &&
      fullMedia.status !== MediaStatus.AVAILABLE &&
      fullMedia.status !== MediaStatus.PARTIALLY_AVAILABLE &&
      fullMedia.status !== MediaStatus.BLOCKLISTED
    ) {
      // Re-fetch WITHOUT requests to avoid cascade issues on save
      const cleanMedia = await manager.findOneOrFail(Media, {
        where: { id: entity.media.id },
      });
      const hadCompleted = fullMedia.requests.some(
        (r) => r.status === MediaRequestStatus.COMPLETED
      );
      cleanMedia.status = hadCompleted
        ? MediaStatus.DELETED
        : MediaStatus.UNKNOWN;
      await manager.save(cleanMedia);
    }
  }

  public async afterUpdate(event: UpdateEvent<MediaRequest>): Promise<void> {
    if (!event.entity) {
      return;
    }

    try {
      await withNestedTransaction(event.manager, async (manager) => {
        await this.updateParentStatus(manager, event.entity as MediaRequest);
      });

      if (event.entity.status === MediaRequestStatus.COMPLETED) {
        await this.notifyAvailable(event.entity as MediaRequest, event);
      }

      // Approval, or a retry of a failed request
      if (
        event.entity.status === MediaRequestStatus.APPROVED &&
        event.databaseEntity?.status !== MediaRequestStatus.APPROVED
      ) {
        scheduleFulfillment(event.entity as MediaRequest);
      }
    } catch (e) {
      logger.error(
        'Error while updating parent status in afterUpdate subscriber',
        {
          label: 'Media Request',
          requestId: (event.entity as MediaRequest).id,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }
  }

  public async afterInsert(event: InsertEvent<MediaRequest>): Promise<void> {
    if (!event.entity) {
      return;
    }

    try {
      await withNestedTransaction(event.manager, async (manager) => {
        await this.updateParentStatus(manager, event.entity as MediaRequest);
      });

      // Auto-approved requests skip the approval step
      if (event.entity.status === MediaRequestStatus.APPROVED) {
        scheduleFulfillment(event.entity as MediaRequest);
      }
    } catch (e) {
      logger.error(
        'Error while updating parent status in afterInsert subscriber',
        {
          label: 'Media Request',
          requestId: (event.entity as MediaRequest).id,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }
  }

  public async afterRemove(event: RemoveEvent<MediaRequest>): Promise<void> {
    if (!event.entity) {
      return;
    }

    await this.handleRemoveParentUpdate(
      event.manager as EntityManager,
      event.entity as MediaRequest
    );
  }

  public listenTo(): typeof MediaRequest {
    return MediaRequest;
  }
}
