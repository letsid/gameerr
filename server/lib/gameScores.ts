import steam from '@server/api/steam';
import type { SteamAppData } from '@server/api/steam/interfaces';
import type { GameDetails, MatchType } from '@server/lib/gameDetails';
import {
  getCachedMetadata,
  setCachedMetadata,
} from '@server/lib/gameMetadataCache';
import { PC_PLATFORM_ID } from '@server/lib/platforms';
import logger from '@server/logger';

export type ScoreSource = 'metacritic' | 'opencritic' | 'igdb' | 'steam';

/**
 * One score as published by its source. Scores are shown as the source
 * reports them, never converted or estimated.
 */
export interface ScoreBadge {
  source: ScoreSource;
  score: number;
  // Highest possible score on the source scale
  scale: number;
  count?: number;
  url?: string;
  // IGDB platform id the score is for, absent for cross-platform scores
  platform?: number;
  // Where Gameerr got the score from, when that is not the source itself
  via?: 'steam' | 'rawg';
  match?: MatchType;
}

interface SteamScoreEntry {
  appId: number;
  metacritic?: { score: number; url?: string };
}

const steamScoreKey = (appId: number) => `score:steam:${appId}`;

export const steamScoreEntry = (
  appId: number,
  data?: SteamAppData
): SteamScoreEntry => {
  const score = data?.metacritic?.score;

  return {
    appId,
    metacritic:
      typeof score === 'number' && score > 0
        ? { score, url: data?.metacritic?.url }
        : undefined,
  };
};

const getSteamScores = async (
  appId: number
): Promise<SteamScoreEntry | undefined> => {
  const cached = await getCachedMetadata<SteamScoreEntry>(steamScoreKey(appId));

  if (cached && !cached.expired) {
    return cached.value;
  }

  try {
    const entry = steamScoreEntry(appId, await steam.getAppDetails(appId));
    await setCachedMetadata(steamScoreKey(appId), 'score', entry);
    return entry;
  } catch (e) {
    logger.warn('Steam store lookup failed', {
      label: 'Scores',
      appId,
      errorMessage: e.message,
    });
    // An outdated score beats none
    return cached?.value;
  }
};

/**
 * The IGDB badge: the combined critic and user rating, only when it is
 * backed by at least one rating
 */
export const igdbBadge = (game: GameDetails): ScoreBadge | undefined =>
  game.totalRating !== undefined && (game.totalRatingCount ?? 0) > 0
    ? {
        source: 'igdb',
        score: Math.round(game.totalRating),
        scale: 100,
        count: game.totalRatingCount,
        url: game.igdbUrl,
      }
    : undefined;

export const metacriticBadgeFromSteam = (
  entry: SteamScoreEntry | undefined,
  match: MatchType | undefined
): ScoreBadge | undefined =>
  entry?.metacritic
    ? {
        source: 'metacritic',
        score: entry.metacritic.score,
        scale: 100,
        url: entry.metacritic.url,
        // Steam reports the Metacritic score of the PC version
        platform: PC_PLATFORM_ID,
        via: 'steam',
        match,
      }
    : undefined;

const BADGE_ORDER: ScoreSource[] = [
  'metacritic',
  'opencritic',
  'igdb',
  'steam',
];

/**
 * Score badges for a game, in display order. Sources without a score are
 * left out rather than shown empty.
 */
export const getGameScores = async (
  game: GameDetails
): Promise<ScoreBadge[]> => {
  const steamScores = game.steam
    ? await getSteamScores(game.steam.appId)
    : undefined;

  return [
    metacriticBadgeFromSteam(steamScores, game.steam?.match),
    igdbBadge(game),
  ]
    .filter((badge): badge is ScoreBadge => !!badge)
    .sort(
      (a, b) => BADGE_ORDER.indexOf(a.source) - BADGE_ORDER.indexOf(b.source)
    );
};
