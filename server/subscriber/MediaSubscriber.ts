import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import logger from '@server/logger';
import { withNestedTransaction } from '@server/utils/nestedTransaction';
import type {
  EntityManager,
  EntitySubscriberInterface,
  UpdateEvent,
} from 'typeorm';
import { EventSubscriber, In } from 'typeorm';

@EventSubscriber()
export class MediaSubscriber implements EntitySubscriberInterface<Media> {
  private async updateChildRequestStatus(manager: EntityManager, event: Media) {
    const requestRepository = manager.getRepository(MediaRequest);

    const requests = await requestRepository.find({
      where: {
        media: { id: event.id },
        status: MediaRequestStatus.PENDING,
      },
    });

    for (const request of requests) {
      request.status = MediaRequestStatus.APPROVED;
      await requestRepository.save(request);
    }
  }

  private async updateRelatedMediaRequest(
    manager: EntityManager,
    event: Media
  ) {
    const requestRepository = manager.getRepository(MediaRequest);

    // Only a game that is available or deleted completes its requests
    if (
      event.status !== MediaStatus.AVAILABLE &&
      event.status !== MediaStatus.DELETED
    ) {
      return;
    }

    const relatedRequests = await requestRepository.find({
      relations: {
        media: true,
      },
      where: {
        media: { id: event.id },
        status: In([MediaRequestStatus.APPROVED, MediaRequestStatus.FAILED]),
      },
    });

    // A batched save would run each afterUpdate concurrently on this connection
    for (const request of relatedRequests) {
      request.status = MediaRequestStatus.COMPLETED;
      await requestRepository.save(request);
    }
  }

  public async beforeUpdate(event: UpdateEvent<Media>): Promise<void> {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    try {
      if (
        event.entity.status === MediaStatus.AVAILABLE &&
        event.databaseEntity?.status === MediaStatus.PENDING
      ) {
        await withNestedTransaction(event.manager, async (manager) => {
          await this.updateChildRequestStatus(manager, event.entity as Media);
        });
      }
    } catch (e) {
      logger.error(
        'Error while updating child request status in beforeUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }
  }

  public async afterUpdate(event: UpdateEvent<Media>): Promise<void> {
    if (!event.entity || !event.databaseEntity) {
      return;
    }

    try {
      if (event.entity.status !== event.databaseEntity?.status) {
        await withNestedTransaction(event.manager, async (manager) => {
          await this.updateRelatedMediaRequest(manager, event.entity as Media);
        });
      }
    } catch (e) {
      logger.error(
        'Error while updating related requests in afterUpdate subscriber',
        {
          label: 'Media',
          mediaId: event.entity.id,
          errorMessage: e instanceof Error ? e.message : String(e),
        }
      );
    }
  }

  public listenTo(): typeof Media {
    return Media;
  }
}
