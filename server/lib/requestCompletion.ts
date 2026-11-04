import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import type { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import { In } from 'typeorm';

/**
 * Completes one approved request: by hand from the request list or when
 * the fulfillment backend reports the game as available.
 *
 * Completing one platform must not close the requests of others, which a
 * media save would do through the media subscriber, so the game only turns
 * available once no request for it is left open.
 */
export const completeRequest = async (
  request: MediaRequest,
  modifiedBy?: User
): Promise<MediaRequest> => {
  const requestRepository = getRepository(MediaRequest);
  const mediaRepository = getRepository(Media);

  // When the game is already available the request subscriber sends the
  // availability notification itself
  const wasAvailable =
    (await mediaRepository.findOneOrFail({ where: { id: request.media.id } }))
      .status === MediaStatus.AVAILABLE;

  request.status = MediaRequestStatus.COMPLETED;
  if (modifiedBy) {
    request.modifiedBy = modifiedBy;
  }
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
    MediaRequest.sendNotification(request, media, Notification.MEDIA_AVAILABLE);
  }

  return request;
};
