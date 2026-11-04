import igdb from '@server/api/igdb';
import {
  getCachedMetadata,
  setCachedMetadata,
} from '@server/lib/gameMetadataCache';

/**
 * How long users took to finish a game, as submitted to IGDB. All values in
 * seconds. IGDB users report them, Gameerr shows them unchanged.
 */
export interface TimeToBeat {
  // Rushing the main story
  hastily?: number;
  // Main story at a normal pace
  normally?: number;
  // Everything there is to do
  completely?: number;
  // Number of submissions
  count?: number;
}

// A game nobody has timed is remembered too, so detail pages do not ask
// IGDB again for every visit
interface TimeToBeatEntry {
  timeToBeat: TimeToBeat | null;
}

export const timeToBeatKey = (gameId: number) => `score:ttb:${gameId}`;

const positive = (value?: number) =>
  typeof value === 'number' && value > 0 ? value : undefined;

export const getTimeToBeat = async (
  gameId: number
): Promise<TimeToBeat | undefined> => {
  const cached = await getCachedMetadata<TimeToBeatEntry>(
    timeToBeatKey(gameId)
  );

  if (cached && !cached.expired) {
    return cached.value.timeToBeat ?? undefined;
  }

  try {
    const row = await igdb.getTimeToBeat(gameId);
    const timeToBeat: TimeToBeat = {
      hastily: positive(row?.hastily),
      normally: positive(row?.normally),
      completely: positive(row?.completely),
      count: positive(row?.count),
    };
    const known =
      timeToBeat.hastily || timeToBeat.normally || timeToBeat.completely;

    await setCachedMetadata<TimeToBeatEntry>(timeToBeatKey(gameId), 'score', {
      timeToBeat: known ? timeToBeat : null,
    });

    return known ? timeToBeat : undefined;
  } catch (e) {
    // A stale copy beats an error when IGDB is unavailable
    if (cached) {
      return cached.value.timeToBeat ?? undefined;
    }
    throw e;
  }
};
