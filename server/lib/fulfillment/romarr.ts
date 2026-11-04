import {
  getRomarr,
  isBusyError,
  isRomarrConfigured,
  isUnknownPlatformError,
} from '@server/api/romarr';
import type { RomarrRequestState } from '@server/api/romarr/interfaces';
import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import { isQuestarrPlatform } from '@server/lib/fulfillment/questarr';
import type {
  FulfillmentProvider,
  FulfillmentResult,
  FulfillmentState,
} from '@server/lib/fulfillment/types';
import { UnsupportedPlatformError } from '@server/lib/fulfillment/types';
import type { Platform } from '@server/lib/platforms';
import { getPlatforms } from '@server/lib/platforms';

/**
 * Stable per Gameerr request, like the Questarr id. ROMarrNG accepts
 * letters, digits, periods, underscores, colons and hyphens.
 */
export const romarrRequestId = (request: MediaRequest) =>
  `gameerr-${request.id}-${new Date(request.createdAt).getTime()}`;

/**
 * Names ROMarrNG may know an IGDB platform by, most specific first.
 * ROMarrNG system slugs are RomM folder names, which follow IGDB slugs, and
 * its aliases carry IGDB's long names such as "Sega Mega Drive/Genesis".
 */
export const romarrPlatformNames = (platform?: Platform): string[] => [
  ...new Set(
    [platform?.slug, platform?.name, platform?.abbreviation].filter(
      (name): name is string => !!name?.trim()
    )
  ),
];

// How long the name ROMarrNG knows a platform by, or that it knows none,
// is remembered, so syncs do not probe every name each time
const PLATFORM_NAME_TTL = 24 * 60 * 60 * 1000;
const platformNames = new Map<number, { name: string | null; at: number }>();

export const resetRomarrPlatformNames = () => platformNames.clear();

/**
 * Runs a call that needs a ROMarrNG system name with the first name of the
 * IGDB platform that ROMarrNG accepts. Resolves to undefined when ROMarrNG
 * manages no system under any of them.
 */
export const withRomarrPlatform = async <T>(
  platformId: number,
  run: (name: string) => Promise<T>
): Promise<T | undefined> => {
  const known = platformNames.get(platformId);
  const fresh = known && Date.now() - known.at < PLATFORM_NAME_TTL;
  if (fresh && known.name === null) {
    return undefined;
  }

  const platform = (await getPlatforms()).find(
    (candidate) => candidate.id === platformId
  );
  const names = romarrPlatformNames(platform);
  const candidates =
    fresh && known.name
      ? [known.name, ...names.filter((name) => name !== known.name)]
      : names;

  for (const name of candidates) {
    try {
      const result = await run(name);
      platformNames.set(platformId, { name, at: Date.now() });
      return result;
    } catch (e) {
      if (!isUnknownPlatformError(e)) {
        throw e;
      }
    }
  }

  platformNames.set(platformId, { name: null, at: Date.now() });
  return undefined;
};

export const toFulfillmentResult = (
  state: RomarrRequestState
): FulfillmentResult => {
  const map: Record<RomarrRequestState['status'], FulfillmentState> = {
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
    message: state.failureMessage ?? state.error ?? undefined,
  };
};

// Request is not with ROMarrNG yet because its queue was full; the status
// sync hands it over again
const BUSY_STATE = 'queued';

const busyResult = (): FulfillmentResult => ({
  state: 'submitted',
  backendState: BUSY_STATE,
  message: 'ROMarrNG is at its request limit, Gameerr retries shortly.',
});

/**
 * Hands console and other emulated platform requests to ROMarrNG through
 * its provider contract for Seerr-style request apps
 */
class RomarrFulfillmentProvider implements FulfillmentProvider {
  public readonly id = 'romarr';
  public readonly name = 'ROMarrNG';

  public supports(platform: number): boolean {
    return !isQuestarrPlatform(platform) && isRomarrConfigured();
  }

  public async submit(
    request: MediaRequest,
    media: Media
  ): Promise<FulfillmentResult> {
    const romarr = getRomarr();
    let state: RomarrRequestState | undefined;

    try {
      state = await withRomarrPlatform(request.platform, (name) =>
        romarr.submitRequest({
          externalRequestId: romarrRequestId(request),
          game: media.title ?? `IGDB #${media.igdbId}`,
          platform: name,
          identity: {
            catalogProvider: 'igdb',
            catalogId: media.igdbId,
            platformId: request.platform,
          },
        })
      );
    } catch (e) {
      if (isBusyError(e)) {
        return busyResult();
      }
      throw e;
    }

    if (!state) {
      const platform = (await getPlatforms()).find(
        (candidate) => candidate.id === request.platform
      );
      throw new UnsupportedPlatformError(
        `ROMarrNG does not manage ${platform?.name ?? `platform ${request.platform}`}.`
      );
    }

    // A replay of a failed request returns it unchanged, a retry in Gameerr
    // means a new attempt in ROMarrNG
    if (
      (state.status === 'failed' || state.status === 'cancelled') &&
      state.actions?.retry
    ) {
      return toFulfillmentResult(
        await romarr.retryRequest(romarrRequestId(request))
      );
    }

    return toFulfillmentResult(state);
  }

  public async status(
    request: MediaRequest,
    media: Media
  ): Promise<FulfillmentResult> {
    if (request.fulfillmentState === BUSY_STATE) {
      return this.submit(request, media);
    }

    return toFulfillmentResult(
      await getRomarr().getRequest(romarrRequestId(request))
    );
  }
}

export default RomarrFulfillmentProvider;
