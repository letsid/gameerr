import { MediaRequestStatus } from '@server/constants/media';
import type Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import type {
  FulfillmentProvider,
  FulfillmentResult,
} from '@server/lib/fulfillment/types';
import { Notification } from '@server/lib/notifications';

/**
 * Fulfillment by hand: tells the request managers that a game needs to be
 * obtained. A manager marks the request as completed once it is done.
 */
class ManualFulfillmentProvider implements FulfillmentProvider {
  public readonly id = 'manual';
  public readonly name = 'Manual';

  public async submit(
    request: MediaRequest,
    media: Media
  ): Promise<FulfillmentResult> {
    await MediaRequest.sendNotification(
      request,
      media,
      Notification.MEDIA_FULFILLMENT
    );

    return { state: 'submitted' };
  }

  public async status(request: MediaRequest): Promise<FulfillmentResult> {
    return {
      state:
        request.status === MediaRequestStatus.COMPLETED
          ? 'completed'
          : 'in_progress',
    };
  }
}

export default ManualFulfillmentProvider;
