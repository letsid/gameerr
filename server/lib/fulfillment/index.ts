import { MediaRequestStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import ManualFulfillmentProvider from '@server/lib/fulfillment/manual';
import QuestarrFulfillmentProvider from '@server/lib/fulfillment/questarr';
import type {
  FulfillmentProvider,
  FulfillmentResult,
} from '@server/lib/fulfillment/types';
import { Notification } from '@server/lib/notifications';
import { completeRequest } from '@server/lib/requestCompletion';
import type { FulfillmentProviderId } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';

const providers: Record<FulfillmentProviderId, FulfillmentProvider> = {
  manual: new ManualFulfillmentProvider(),
  questarr: new QuestarrFulfillmentProvider(),
};

export const getProviderById = (id?: string | null) =>
  providers[id as FulfillmentProviderId];

/**
 * The configured backend when it takes the platform, else manual
 */
export const getFulfillmentProvider = (
  platform?: number
): FulfillmentProvider => {
  const configured =
    providers[getSettings().fulfillment.provider] ?? providers.manual;

  return platform === undefined || configured.supports(platform)
    ? configured
    : providers.manual;
};

// Without listeners, so the request subscriber neither resubmits nor
// touches the media status
const recordFulfillment = async (
  requestId: number,
  values: Partial<
    Pick<
      MediaRequest,
      | 'status'
      | 'fulfillmentProvider'
      | 'fulfillmentState'
      | 'fulfillmentMessage'
      | 'fulfillmentCheckedAt'
    >
  >
) =>
  getRepository(MediaRequest)
    .createQueryBuilder()
    .update()
    .set(values)
    .where('id = :id', { id: requestId })
    .callListeners(false)
    .execute();

const failRequest = async (
  request: MediaRequest,
  media: Media,
  provider: FulfillmentProvider,
  message: string
) => {
  await recordFulfillment(request.id, {
    status: MediaRequestStatus.FAILED,
    fulfillmentProvider: provider.id,
    fulfillmentState: 'failed',
    fulfillmentMessage: message.slice(0, 500),
    fulfillmentCheckedAt: new Date(),
  });
  MediaRequest.sendNotification(request, media, Notification.MEDIA_FAILED, [
    { name: 'Fulfillment', value: `${provider.name}: ${message}` },
  ]);
};

const applyResult = async (
  request: MediaRequest,
  media: Media,
  provider: FulfillmentProvider,
  result: FulfillmentResult
) => {
  if (result.state === 'failed') {
    await failRequest(
      request,
      media,
      provider,
      result.message ?? result.backendState ?? 'failed'
    );
    return;
  }

  await recordFulfillment(request.id, {
    fulfillmentProvider: provider.id,
    fulfillmentState: result.backendState ?? result.state,
    fulfillmentMessage: result.message ?? null,
    fulfillmentCheckedAt: new Date(),
  });

  if (result.state === 'completed') {
    const fresh = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
      relations: { requestedBy: true, modifiedBy: true },
    });
    await completeRequest(fresh);
  }
};

/**
 * Hands an approved request to the backend for its platform. A backend
 * error marks the request as failed so a manager can retry it.
 */
export const submitForFulfillment = async (
  request: MediaRequest
): Promise<void> => {
  const provider = getFulfillmentProvider(request.platform);
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
      state: result.backendState ?? result.state,
    });
    await applyResult(request, media, provider, result);
  } catch (e) {
    const message = e?.response?.data?.error ?? e.message;
    logger.error('Fulfillment submission failed', {
      label: 'Fulfillment',
      provider: provider.id,
      requestId: request.id,
      errorMessage: message,
    });
    await failRequest(request, media, provider, message);
  }
};

let syncRunning = false;

export const isFulfillmentSyncRunning = () => syncRunning;

/**
 * Polls backends that work on their own, like Questarr, for approved
 * requests and completes or fails them as reported
 */
export const syncFulfillment = async (): Promise<void> => {
  if (syncRunning) {
    return;
  }
  syncRunning = true;

  try {
    const requests = await getRepository(MediaRequest).find({
      where: {
        status: MediaRequestStatus.APPROVED,
        fulfillmentProvider: 'questarr',
      },
    });

    for (const request of requests) {
      const provider = getProviderById(request.fulfillmentProvider);
      if (!provider) {
        continue;
      }

      try {
        const result = await provider.status(request, request.media);
        await applyResult(request, request.media, provider, result);
      } catch (e) {
        // A backend that is down leaves the request as it is
        logger.warn('Fulfillment status check failed', {
          label: 'Fulfillment',
          provider: provider.id,
          requestId: request.id,
          errorMessage: e?.response?.data?.error ?? e.message,
        });
      }
    }
  } finally {
    syncRunning = false;
  }
};
