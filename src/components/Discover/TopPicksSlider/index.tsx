import { pill, useChartLabel } from '@app/components/Charts';
import { sliderTitles } from '@app/components/Discover/constants';
import MediaSlider from '@app/components/MediaSlider';
import type { ChartId } from '@server/lib/charts';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

interface TopPicksSliderProps {
  platform?: number;
}

const TopPicksSlider = ({ platform }: TopPicksSliderProps) => {
  const intl = useIntl();
  const chartLabel = useChartLabel();
  const { data: categories } = useSWR<{ results: ChartId[] }>('/api/v1/charts');
  const [selected, setSelected] = useState<ChartId>();

  const ids = categories?.results ?? [];
  const chart = selected && ids.includes(selected) ? selected : ids[0];

  if (!chart) {
    return null;
  }

  return (
    <>
      <div
        className="mt-6 flex gap-2 overflow-x-auto pb-1"
        role="tablist"
        data-testid="top-picks-tabs"
      >
        {ids.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === chart}
            onClick={() => setSelected(id)}
            data-testid={`top-picks-${id}`}
            className={`flex-shrink-0 ${pill(id === chart)}`}
          >
            {chartLabel(id)}
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
