import type Media from '@server/entity/Media';
import type { MediaRequest } from '@server/entity/MediaRequest';

/**
 * Where a request stands with its fulfillment backend
 */
export type FulfillmentState =
  | 'submitted'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'unknown';

export interface FulfillmentResult {
  state: FulfillmentState;
  message?: string;
  // Id of the request in the backend, for later status checks
  externalId?: string;
}

/**
 * A backend that obtains approved games, such as an admin doing it by hand
 * or a download manager. Replaces Seerr's Radarr and Sonarr services.
 */
export interface FulfillmentProvider {
  readonly id: string;
  readonly name: string;
  /**
   * Hands an approved request to the backend. Throwing marks the request
   * as failed.
   */
  submit(request: MediaRequest, media: Media): Promise<FulfillmentResult>;
  status(request: MediaRequest, media: Media): Promise<FulfillmentResult>;
}
