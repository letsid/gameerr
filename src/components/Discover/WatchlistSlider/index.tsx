import { sliderTitles } from '@app/components/Discover/constants';
import Slider from '@app/components/Slider';
import TitleCard from '@app/components/TitleCard';
import defineMessages from '@app/utils/defineMessages';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { WatchlistResponse } from '@server/interfaces/api/discoverInterfaces';
import Link from 'next/link';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.Discover.WatchlistSlider', {
  emptywatchlist:
    'Games you add to your watchlist will appear here. Hover over a game and click the star to add it.',
});

const WatchlistSlider = () => {
  const intl = useIntl();

  const { data: watchlistItems, error: watchlistError } =
    useSWR<WatchlistResponse>('/api/v1/discover/watchlist', {
      revalidateOnMount: true,
    });

  if (watchlistError) {
    return null;
  }

  return (
    <>
      <div className="slider-header">
        <Link href="/discover/watchlist" className="slider-title">
          <span>{intl.formatMessage(sliderTitles.watchlist)}</span>
          <ArrowRightCircleIcon />
        </Link>
      </div>
      <Slider
        sliderKey="watchlist"
        isLoading={!watchlistItems}
        isEmpty={!!watchlistItems && watchlistItems.results.length === 0}
        emptyMessage={intl.formatMessage(messages.emptywatchlist)}
        items={watchlistItems?.results.map((item) => (
          <TitleCard
            key={`watchlist-slider-item-${item.igdbId}`}
            id={item.igdbId}
            title={item.title}
            coverImageId={item.coverImageId}
            isAddedToWatchlist={true}
          />
        ))}
      />
    </>
  );
};

export default WatchlistSlider;
