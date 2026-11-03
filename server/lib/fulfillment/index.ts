import { MediaRequestStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import ManualFulfillmentProvider from '@server/lib/fulfillment/manual';
import type { FulfillmentProvider } from '@server/lib/fulfillment/types';
import { Notification } from '@server/lib/notifications';
import type { FulfillmentProviderId } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

const providers: Record<FulfillmentProviderId, FulfillmentProvider> = {
  manual: new ManualFulfillmentProvider(),
};

export const getFulfillmentProvider = (): FulfillmentProvider =>
  providers[getSettings().fulfillment.provider] ?? providers.manual;

/**
 * Hands an approved request to the configured backend. A backend error
 * marks the request as failed so a manager can retry it.
 */
export const submitForFulfillment = async (
  request: MediaRequest
): Promise<void> => {
  const provider = getFulfillmentProvider();
  const media = await getRepository(Media).findOne({
    where: { id: request.media.id },
  });

  if (!media) {
    logger.error('Media missing for fulfillment', {
      label: 'Fulfillment',
      requestId: request.id,
    });
    return;
  }

  try {
    const result = await provider.submit(request, media);
    logger.info('Submitted request for fulfillment', {
      label: 'Fulfillment',
      provider: provider.id,
      requestId: request.id,
      igdbId: media.igdbId,
      platform: request.platform,
      state: result.state,
    });
  } catch (e) {
    logger.error('Fulfillment submission failed', {
      label: 'Fulfillment',
      provider: provider.id,
      requestId: request.id,
      errorMessage: e.message,
    });

    // Without listeners, so the subscriber neither resubmits nor touches
    // the media status
    await getRepository(MediaRequest)
      .createQueryBuilder()
      .update()
      .set({ status: MediaRequestStatus.FAILED })
      .where('id = :id', { id: request.id })
      .callListeners(false)
      .execute();
    MediaRequest.sendNotification(request, media, Notification.MEDIA_FAILED, [
      { name: 'Fulfillment', value: provider.name },
    ]);
  }
};
