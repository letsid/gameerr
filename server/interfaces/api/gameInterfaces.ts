import type Media from '@server/entity/Media';
import type { DiscoverGame, DiscoverListId } from '@server/lib/discover';
import type { GameDetails } from '@server/lib/gameDetails';
import type { ScoreBadge } from '@server/lib/gameScores';
import type { LibraryEntry } from '@server/lib/library';
import type { Platform } from '@server/lib/platforms';

/**
 * A game as listed in discover and search results
 */
export interface GameResult extends DiscoverGame {
  year?: string;
  mediaInfo?: Media;
  // Platforms the game is already in the library on
  library?: LibraryEntry[];
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
  // Vote minimum the best list was built with
  minRatingCount?: number;
}

export interface GameDetailsResponse extends GameDetails {
  mediaInfo?: Media;
  library: LibraryEntry[];
}

export interface GameScoresResponse {
  results: ScoreBadge[];
}

export interface PlatformsResponse {
  results: Platform[];
}
