import ExternalAPI from '@server/api/externalapi';
import type {
  RomarrCreateRequest,
  RomarrHandshake,
  RomarrLibraryLookup,
  RomarrLookupTitle,
  RomarrRequestState,
} from '@server/api/romarr/interfaces';
import { getMetadataCredentials } from '@server/lib/settings';

const CONTRACT_PATH = '/api/integration/seerrng/v1';

// ROMarrNG allows 120 requests per minute per client address
const MAX_RPS = 2;

// Titles per library lookup, the most ROMarrNG accepts
export const ROMARR_LOOKUP_CHUNK = 100;

export class RomarrNotConfiguredError extends Error {}

/**
 * ROMarrNG rejected the platform name, it does not manage that system
 */
export const isUnknownPlatformError = (e: unknown): boolean => {
  const response = (
    e as { response?: { status?: number; data?: { error?: string } } }
  )?.response;
  return (
    response?.status === 400 &&
    /valid platform|invalid title or platform/i.test(response.data?.error ?? '')
  );
};

/**
 * ROMarrNG runs at most four acquisitions at once and answers 503 when full
 */
export const isBusyError = (e: unknown): boolean =>
  (e as { response?: { status?: number } })?.response?.status === 503;

/**
 * Client for ROMarrNG's provider contract for Seerr-style request apps.
 * One instance per configured URL, created through getRomarr().
 */
class RomarrAPI extends ExternalAPI {
  constructor(baseUrl: string, apiKey: string) {
    super(
      `${baseUrl}${CONTRACT_PATH}`,
      {},
      {
        headers: { 'X-Api-Key': apiKey },
        rateLimit: { maxRPS: MAX_RPS, maxRequests: MAX_RPS },
      }
    );
  }

  public async ping(): Promise<RomarrHandshake> {
    return this.get<RomarrHandshake>('/ping', undefined, 0);
  }

  /**
   * Submits a request. Replaying the same id, game and platform returns the
   * current state instead of a second request.
   */
  public async submitRequest(
    body: RomarrCreateRequest
  ): Promise<RomarrRequestState> {
    const response = await this.axios.post<RomarrRequestState>(
      '/requests',
      body
    );
    return response.data;
  }

  public async getRequest(
    externalRequestId: string
  ): Promise<RomarrRequestState> {
    const response = await this.axios.get<RomarrRequestState>(
      `/requests/${encodeURIComponent(externalRequestId)}`
    );
    return response.data;
  }

  public async retryRequest(
    externalRequestId: string
  ): Promise<RomarrRequestState> {
    const response = await this.axios.post<RomarrRequestState>(
      `/requests/${encodeURIComponent(externalRequestId)}/retry`,
      {}
    );
    return response.data;
  }

  /**
   * Which of the titles are in the ROMarrNG library. Matching is by title
   * and system, ROMarrNG has no IGDB ids for its library.
   */
  public async lookupLibrary(
    titles: RomarrLookupTitle[]
  ): Promise<RomarrLookupTitle[]> {
    const matches: RomarrLookupTitle[] = [];

    for (let i = 0; i < titles.length; i += ROMARR_LOOKUP_CHUNK) {
      const response = await this.axios.post<RomarrLibraryLookup>(
        '/library/lookup',
        { titles: titles.slice(i, i + ROMARR_LOOKUP_CHUNK) }
      );
      if (!response.data.ready) {
        throw new Error('ROMarrNG is still reading its library.');
      }
      matches.push(...(response.data.matches ?? []));
    }

    return matches;
  }
}

let cached: { key: string; client: RomarrAPI } | undefined;

export const isRomarrConfigured = (): boolean => {
  const { romarrUrl, romarrApiKey } = getMetadataCredentials();
  return !!romarrUrl && !!romarrApiKey;
};

/**
 * The client for the configured ROMarrNG, rebuilt when URL or key change
 */
export const getRomarr = (): RomarrAPI => {
  const { romarrUrl, romarrApiKey } = getMetadataCredentials();

  if (!romarrUrl || !romarrApiKey) {
    throw new RomarrNotConfiguredError(
      'ROMarrNG URL and API key are not configured.'
    );
  }

  const key = `${romarrUrl}|${romarrApiKey}`;
  if (cached?.key !== key) {
    cached = { key, client: new RomarrAPI(romarrUrl, romarrApiKey) };
  }

  return cached.client;
};

export type { RomarrAPI };
