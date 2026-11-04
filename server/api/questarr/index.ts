import ExternalAPI from '@server/api/externalapi';
import type {
  QuestarrCreateRequest,
  QuestarrHandshake,
  QuestarrLibraryLookup,
  QuestarrRequestState,
} from '@server/api/questarr/interfaces';
import { getMetadataCredentials } from '@server/lib/settings';

const CONTRACT_PATH = '/api/integration/seerrng/v1';

// Questarr allows 300 requests per minute per key
const MAX_RPS = 4;

// Ids per library lookup, keeps the query string short
export const QUESTARR_LOOKUP_CHUNK = 100;

export class QuestarrNotConfiguredError extends Error {}

/**
 * Client for Questarr's provider contract for Seerr-style request apps.
 * One instance per configured URL, created through getQuestarr().
 */
class QuestarrAPI extends ExternalAPI {
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

  public async ping(): Promise<QuestarrHandshake> {
    return this.get<QuestarrHandshake>('/ping', undefined, 0);
  }

  /**
   * Submits a request. Replaying the same id, title and variant returns the
   * current state instead of a second request.
   */
  public async submitRequest(
    body: QuestarrCreateRequest
  ): Promise<QuestarrRequestState> {
    const response = await this.axios.post<QuestarrRequestState>(
      '/requests',
      body
    );
    return response.data;
  }

  public async getRequest(
    externalRequestId: string
  ): Promise<QuestarrRequestState> {
    const response = await this.axios.get<QuestarrRequestState>(
      `/requests/${encodeURIComponent(externalRequestId)}`
    );
    return response.data;
  }

  public async retryRequest(
    externalRequestId: string
  ): Promise<QuestarrRequestState> {
    const response = await this.axios.post<QuestarrRequestState>(
      `/requests/${encodeURIComponent(externalRequestId)}/retry`,
      {}
    );
    return response.data;
  }

  /**
   * Library status of the given games in the Questarr account. Games
   * Questarr does not know are absent from the answer.
   */
  public async lookupLibrary(
    igdbIds: number[]
  ): Promise<QuestarrLibraryLookup['games']> {
    const unique = [...new Set(igdbIds)].filter(
      (id) => Number.isInteger(id) && id > 0
    );
    const games: QuestarrLibraryLookup['games'] = [];

    for (let i = 0; i < unique.length; i += QUESTARR_LOOKUP_CHUNK) {
      const chunk = unique.slice(i, i + QUESTARR_LOOKUP_CHUNK);
      const response = await this.axios.get<QuestarrLibraryLookup>(
        '/library/lookup',
        { params: { igdbIds: chunk.join(',') } }
      );
      games.push(...(response.data.games ?? []));
    }

    return games;
  }
}

let cached: { key: string; client: QuestarrAPI } | undefined;

export const isQuestarrConfigured = (): boolean => {
  const { questarrUrl, questarrApiKey } = getMetadataCredentials();
  return !!questarrUrl && !!questarrApiKey;
};

/**
 * The client for the configured Questarr, rebuilt when URL or key change
 */
export const getQuestarr = (): QuestarrAPI => {
  const { questarrUrl, questarrApiKey } = getMetadataCredentials();

  if (!questarrUrl || !questarrApiKey) {
    throw new QuestarrNotConfiguredError(
      'Questarr URL and API key are not configured.'
    );
  }

  const key = `${questarrUrl}|${questarrApiKey}`;
  if (cached?.key !== key) {
    cached = { key, client: new QuestarrAPI(questarrUrl, questarrApiKey) };
  }

  return cached.client;
};

export type { QuestarrAPI };
