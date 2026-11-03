import type Media from '@server/entity/Media';
import type { DiscoverGame, DiscoverListId } from '@server/lib/discover';
import type { Platform } from '@server/lib/platforms';

/**
 * A game as listed in discover and search results
 */
export interface GameResult extends DiscoverGame {
  year?: string;
  mediaInfo?: Media;
}

export interface GameResultsResponse {
  page: number;
  totalPages: number;
  totalResults: number;
  results: GameResult[];
}

export interface DiscoverListResponse extends GameResultsResponse {
  list: DiscoverListId;
  platform: number;
  generatedAt: string;
}

export interface PlatformsResponse {
  results: Platform[];
}
