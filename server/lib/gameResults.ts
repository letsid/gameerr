import Media from '@server/entity/Media';
import type { User } from '@server/entity/User';
import type { GameResult } from '@server/interfaces/api/gameInterfaces';
import type { DiscoverGame } from '@server/lib/discover';
import { getLibraryEntries } from '@server/lib/library';

export const releaseYear = (timestamp?: number): string | undefined =>
  timestamp ? String(new Date(timestamp * 1000).getUTCFullYear()) : undefined;

/**
 * Adds the local request and watchlist state to games from IGDB
 */
export const withMediaInfo = async (
  games: DiscoverGame[],
  user?: User
): Promise<GameResult[]> => {
  const media = await Media.getRelatedMedia(
    user,
    games.map((game) => game.id),
    { includeActiveRequest: true }
  );
  const byIgdbId = new Map(media.map((item) => [item.igdbId, item]));
  const library = await getLibraryEntries(games.map((game) => game.id));

  return games.map((game) => ({
    ...game,
    year: releaseYear(game.firstReleaseDate),
    mediaInfo: byIgdbId.get(game.id),
    library: library.get(game.id),
  }));
};
