import type { User } from '@server/entity/User';
import type { PaginatedResponse } from '@server/interfaces/api/common';

export interface BlocklistItem {
  igdbId: number;
  mediaType: 'game';
  title?: string;
  createdAt?: Date;
  user?: User;
}

export interface BlocklistResultsResponse extends PaginatedResponse {
  results: BlocklistItem[];
}
