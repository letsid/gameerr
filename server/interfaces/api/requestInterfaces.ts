import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties, PaginatedResponse } from './common';

export interface RequestResultsResponse extends PaginatedResponse {
  results: (NonFunctionProperties<MediaRequest> & {
    canRemove?: boolean;
  })[];
}

export type MediaRequestBody = {
  igdbId: number;
  /**
   * IGDB platform id the game is requested for
   */
  platform: number;
  userId?: number;
  ignoreQuota?: boolean;
};

export interface RequestCountResponse {
  total: number;
  pending: number;
  approved: number;
  declined: number;
  processing: number;
  available: number;
  completed: number;
  failed: number;
}
