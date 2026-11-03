import type Media from '@server/entity/Media';

/**
 * Minimal game search/discover result shape used by the client until the
 * IGDB metadata layer finalizes the API response format.
 */
export interface GameResult {
  /**
   * IGDB game id
   */
  id: number;
  name: string;
  coverImageId?: string | null;
  year?: string;
  summary?: string;
  mediaInfo?: Media;
}

export interface GameResultsResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: GameResult[];
}
