import Tooltip from '@app/components/Common/Tooltip';
import usePlatforms, { platformLabel } from '@app/hooks/usePlatforms';
import defineMessages from '@app/utils/defineMessages';
import type { GameScoresResponse } from '@server/interfaces/api/gameInterfaces';
import type { ScoreBadge, ScoreSource } from '@server/lib/gameScores';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.GameDetails.ScoreBadges', {
  metacritic: 'Metacritic',
  opencritic: 'OpenCritic',
  igdb: 'IGDB',
  steam: 'Steam',
  rawg: 'RAWG',
  ratingCount: '{count, plural, one {# rating} other {# ratings}}',
  forPlatform: 'Score for {platform}',
  viaSource: 'Provided by {source}',
  noScores: 'No scores yet',
  igdbCombined: 'Users and critics combined',
});

const sourceStyle: Record<ScoreSource, string> = {
  metacritic: 'from-yellow-500 to-yellow-600',
  opencritic: 'from-orange-500 to-red-600',
  igdb: 'from-indigo-500 to-purple-600',
  steam: 'from-sky-600 to-blue-700',
};

const ScoreBadgeItem = ({ badge }: { badge: ScoreBadge }) => {
  const intl = useIntl();
  const { byId } = usePlatforms();

  const details = [
    badge.source === 'igdb'
      ? intl.formatMessage(messages.igdbCombined)
      : undefined,
    badge.count !== undefined
      ? intl.formatMessage(messages.ratingCount, { count: badge.count })
      : undefined,
    badge.platform !== undefined
      ? intl.formatMessage(messages.forPlatform, {
          platform: platformLabel(badge.platform, byId),
        })
      : undefined,
    badge.via
      ? intl.formatMessage(messages.viaSource, {
          source: intl.formatMessage(messages[badge.via]),
        })
      : undefined,
  ].filter(Boolean);

  const content = (
    <span className="flex items-center overflow-hidden rounded-md text-sm font-semibold text-white shadow ring-1 ring-gray-700">
      <span className="bg-gray-800 px-2 py-1 text-gray-200">
        {intl.formatMessage(messages[badge.source])}
        {badge.platform !== undefined && (
          <span className="ml-1 text-xs text-gray-400">
            {platformLabel(badge.platform, byId)}
          </span>
        )}
      </span>
      <span
        className={`bg-gradient-to-br px-2 py-1 ${sourceStyle[badge.source]}`}
        data-testid={`score-${badge.source}`}
      >
        {badge.score}
      </span>
    </span>
  );

  return (
    <Tooltip content={details.join(' · ')}>
      {badge.url ? (
        <a href={badge.url} target="_blank" rel="noreferrer">
          {content}
        </a>
      ) : (
        content
      )}
    </Tooltip>
  );
};

const ScoreBadges = ({ gameId }: { gameId: number }) => {
  const intl = useIntl();
  const { data, error } = useSWR<GameScoresResponse>(
    `/api/v1/game/${gameId}/scores`,
    { revalidateOnFocus: false }
  );

  if (error) {
    return null;
  }

  if (!data) {
    return (
      <div className="flex space-x-2">
        {[0, 1].map((i) => (
          <span
            key={`score-placeholder-${i}`}
            className="h-7 w-24 animate-pulse rounded-md bg-gray-700"
          />
        ))}
      </div>
    );
  }

  if (data.results.length === 0) {
    return (
      <span className="text-sm text-gray-400">
        {intl.formatMessage(messages.noScores)}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2" data-testid="score-badges">
      {data.results.map((badge) => (
        <ScoreBadgeItem
          key={`${badge.source}-${badge.platform}`}
          badge={badge}
        />
      ))}
    </div>
  );
};

export default ScoreBadges;
