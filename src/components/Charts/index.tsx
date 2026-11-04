import Header from '@app/components/Common/Header';
import ListView from '@app/components/Common/ListView';
import PageTitle from '@app/components/Common/PageTitle';
import useDiscover from '@app/hooks/useDiscover';
import usePlatforms, {
  platformLabel,
  usePreferredPlatforms,
} from '@app/hooks/usePlatforms';
import ErrorPage from '@app/pages/_error';
import type { GameResult } from '@app/types/game';
import defineMessages from '@app/utils/defineMessages';
import type { ChartResponse } from '@server/interfaces/api/gameInterfaces';
import type { ChartId } from '@server/lib/charts';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Charts', {
  charts: 'Charts',
  chartsDescription:
    'The best rated games of all time per genre, by IGDB rating. Games need a minimum number of ratings to enter.',
  category: 'Genre',
  platform: 'Platform',
  allPlatforms: 'All platforms',
  minRatings: 'At least {count} ratings',
  rpg: 'RPG',
  actionRpg: 'Action RPG',
  roguelike: 'Roguelike',
  shooter: 'Shooter',
  strategy: 'Strategy',
  adventure: 'Adventure',
  indie: 'Indie',
  platformer: 'Platformer',
  puzzle: 'Puzzle',
  simulator: 'Simulator',
  hackAndSlash: "Hack and Slash / Beat 'em up",
  arcade: 'Arcade',
  racing: 'Racing',
  sport: 'Sports',
  fighting: 'Fighting',
  turnBasedStrategy: 'Turn-based Strategy',
  realTimeStrategy: 'Real-time Strategy',
  tactical: 'Tactical',
  pointAndClick: 'Point-and-click',
  visualNovel: 'Visual Novel',
  cardAndBoardGame: 'Card & Board Game',
  music: 'Music',
});

const categoryMessages: Record<ChartId, keyof typeof messages> = {
  rpg: 'rpg',
  'action-rpg': 'actionRpg',
  roguelike: 'roguelike',
  shooter: 'shooter',
  strategy: 'strategy',
  adventure: 'adventure',
  indie: 'indie',
  platform: 'platformer',
  puzzle: 'puzzle',
  simulator: 'simulator',
  'hack-and-slash': 'hackAndSlash',
  arcade: 'arcade',
  racing: 'racing',
  sport: 'sport',
  fighting: 'fighting',
  'turn-based-strategy': 'turnBasedStrategy',
  'real-time-strategy': 'realTimeStrategy',
  tactical: 'tactical',
  'point-and-click': 'pointAndClick',
  'visual-novel': 'visualNovel',
  'card-and-board-game': 'cardAndBoardGame',
  music: 'music',
};

export const pill = (selected: boolean) =>
  `rounded-full border px-4 py-1 text-sm font-medium transition ${
    selected
      ? 'border-indigo-500 bg-indigo-600 text-white'
      : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400 hover:text-white'
  }`;

export const useChartLabel = () => {
  const intl = useIntl();

  return (id: ChartId) => intl.formatMessage(messages[categoryMessages[id]]);
};

const Charts = () => {
  const intl = useIntl();
  const chartLabel = useChartLabel();
  const router = useRouter();
  const { byId } = usePlatforms();
  const preferred = usePreferredPlatforms();
  const { data: categories } = useSWR<{ results: ChartId[] }>(
    '/api/v1/charts'
  );

  const chart = (
    categories?.results.includes(router.query.chart as ChartId)
      ? router.query.chart
      : (categories?.results[0] ?? 'rpg')
  ) as ChartId;
  const platform = Number(router.query.platform) || 0;

  const select = (next: { chart?: ChartId; platform?: number }) =>
    router.replace(
      {
        pathname: router.pathname,
        query: {
          chart: next.chart ?? chart,
          ...((next.platform ?? platform)
            ? { platform: next.platform ?? platform }
            : {}),
        },
      },
      undefined,
      { shallow: true }
    );

  const {
    isLoadingInitialData,
    isEmpty,
    isLoadingMore,
    isReachingEnd,
    titles,
    fetchMore,
    error,
    firstResultData,
  } = useDiscover<GameResult, Pick<ChartResponse, 'minRatingCount'>>(
    `/api/v1/charts/${chart}`,
    { platform },
    { hideAvailable: false, hideBlocklisted: false, hideRequested: false }
  );

  if (error) {
    return <ErrorPage statusCode={500} />;
  }

  return (
    <>
      <PageTitle title={intl.formatMessage(messages.charts)} />
      <div className="mb-5 mt-1">
        <Header subtext={intl.formatMessage(messages.chartsDescription)}>
          {intl.formatMessage(messages.charts)}
        </Header>
      </div>
      <div
        className="mb-2 flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label={intl.formatMessage(messages.category)}
        data-testid="charts-category-tabs"
      >
        {categories?.results.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === chart}
            onClick={() => select({ chart: id })}
            className={pill(id === chart)}
          >
            {chartLabel(id)}
          </button>
        ))}
      </div>
      <div
        className="mb-4 mt-4 flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label={intl.formatMessage(messages.platform)}
        data-testid="charts-platform-tabs"
      >
        {[0, ...preferred].map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === platform}
            onClick={() => select({ platform: id })}
            className={pill(id === platform)}
          >
            {id === 0
              ? intl.formatMessage(messages.allPlatforms)
              : platformLabel(id, byId)}
          </button>
        ))}
      </div>
      {firstResultData?.minRatingCount !== undefined && (
        <p className="mb-4 text-sm text-gray-400">
          {intl.formatMessage(messages.minRatings, {
            count: firstResultData.minRatingCount,
          })}
        </p>
      )}
      <ListView
        items={titles}
        isEmpty={isEmpty}
        isLoading={
          isLoadingInitialData || (isLoadingMore && (titles?.length ?? 0) > 0)
        }
        isReachingEnd={isReachingEnd}
        onScrollBottom={fetchMore}
      />
    </>
  );
};

export default Charts;
