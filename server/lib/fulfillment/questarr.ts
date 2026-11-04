import { getQuestarr, isQuestarrConfigured } from '@server/api/questarr';
import type {
  QuestarrRequestState,
  QuestarrVariant,
} from '@server/api/questarr/interfaces';
import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type {
  FulfillmentProvider,
  FulfillmentResult,
  FulfillmentState,
} from '@server/lib/fulfillment/types';

// IGDB platform ids Questarr acquires for, with the operating system its
// contract expects
const QUESTARR_PLATFORMS: Record<number, QuestarrVariant['operatingSystem']> = {
  6: 'windows',
  3: 'linux',
  14: 'macos',
};

export const isQuestarrPlatform = (platform: number): boolean =>
  platform in QUESTARR_PLATFORMS;

/**
 * Stable per Gameerr request, so a repeated hand-over replays the request
 * in Questarr instead of creating a second one. The creation time is part
 * of it because SQLite can hand out the id of a deleted request again.
 */
export const questarrRequestId = (request: MediaRequest) =>
  `gameerr-${request.id}-${new Date(request.createdAt).getTime()}`;

export const toFulfillmentResult = (
  state: QuestarrRequestState
): FulfillmentResult => {
  const map: Record<QuestarrRequestState['status'], FulfillmentState> = {
    accepted: 'submitted',
    searching: 'in_progress',
    downloading: 'in_progress',
    importing: 'in_progress',
    available: 'completed',
    failed: 'failed',
    cancelled: 'failed',
  };

  return {
    state: map[state.status] ?? 'unknown',
    backendState: state.status,
    message: state.error ?? undefined,
  };
};

/**
 * Hands PC, Linux and Mac requests to Questarr through its provider
 * contract for Seerr-style request apps
 */
class QuestarrFulfillmentProvider implements FulfillmentProvider {
  public readonly id = 'questarr';
  public readonly name = 'Questarr';

  public supports(platform: number): boolean {
    return isQuestarrPlatform(platform) && isQuestarrConfigured();
  }

  public async submit(
    request: MediaRequest,
    media: Media
  ): Promise<FulfillmentResult> {
    const questarr = getQuestarr();
    const state = await questarr.submitRequest({
      externalRequestId: questarrRequestId(request),
      title: media.title ?? `IGDB #${media.igdbId}`,
      igdbId: media.igdbId,
      variant: {
        operatingSystem: QUESTARR_PLATFORMS[request.platform],
        architecture: 'x64',
      },
    });

    // A replay of a failed request returns it unchanged, a retry in Gameerr
    // means a new attempt in Questarr
    if (
      (state.status === 'failed' || state.status === 'cancelled') &&
      state.actions?.retry
    ) {
      return toFulfillmentResult(
        await questarr.retryRequest(questarrRequestId(request))
      );
    }

    return toFulfillmentResult(state);
  }

  public async status(request: MediaRequest): Promise<FulfillmentResult> {
    return toFulfillmentResult(
      await getQuestarr().getRequest(questarrRequestId(request))
    );
  }
}

export default QuestarrFulfillmentProvider;
