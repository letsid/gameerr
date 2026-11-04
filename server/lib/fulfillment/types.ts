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
  // The backend's own status word, e.g. Questarr's "downloading"
  backendState?: string;
  message?: string;
}

/**
 * A backend that obtains approved games, such as an admin doing it by hand
 * or a download manager. Replaces Seerr's Radarr and Sonarr services.
 */
export interface FulfillmentProvider {
  readonly id: string;
  readonly name: string;
  /**
   * Whether the backend is set up and can take requests for the platform
   */
  supports(platform: number): boolean;
  /**
   * Hands an approved request to the backend. Throwing marks the request
   * as failed.
   */
  submit(request: MediaRequest, media: Media): Promise<FulfillmentResult>;
  status(request: MediaRequest, media: Media): Promise<FulfillmentResult>;
}
