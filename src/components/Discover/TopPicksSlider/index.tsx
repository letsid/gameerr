import { sliderTitles } from '@app/components/Discover/constants';
import MediaSlider from '@app/components/MediaSlider';
import defineMessages from '@app/utils/defineMessages';
import type { ChartId } from '@server/lib/charts';
import { useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.Discover.TopPicksSlider', {
  rpg: 'RPG',
  actionRpg: 'Action RPG',
  roguelike: 'Roguelike',
  shooter: 'Shooter',
  strategy: 'Strategy',
});

// The genres shown on Discover, the Charts page has all of them
const picks: { chart: ChartId; label: keyof typeof messages }[] = [
  { chart: 'rpg', label: 'rpg' },
  { chart: 'action-rpg', label: 'actionRpg' },
  { chart: 'roguelike', label: 'roguelike' },
  { chart: 'shooter', label: 'shooter' },
  { chart: 'strategy', label: 'strategy' },
];

interface TopPicksSliderProps {
  platform?: number;
}

const TopPicksSlider = ({ platform }: TopPicksSliderProps) => {
  const intl = useIntl();
  const [chart, setChart] = useState<ChartId>(picks[0].chart);

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {picks.map((pick) => (
          <button
            key={pick.chart}
            type="button"
            onClick={() => setChart(pick.chart)}
            data-testid={`top-picks-${pick.chart}`}
            className={`rounded-full border px-4 py-1 text-sm font-medium transition ${
              chart === pick.chart
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400 hover:text-white'
            }`}
          >
            {intl.formatMessage(messages[pick.label])}
          </button>
        ))}
      </div>
      <MediaSlider
        sliderKey={`top-picks-${chart}-${platform ?? 0}`}
        title={intl.formatMessage(sliderTitles.toppicks)}
        url={`/api/v1/charts/${chart}`}
        linkUrl={`/charts?chart=${chart}${platform ? `&platform=${platform}` : ''}`}
        hideWhenEmpty
        extraParams={platform ? `platform=${platform}` : undefined}
      />
    </>
  );
};

export default TopPicksSlider;
