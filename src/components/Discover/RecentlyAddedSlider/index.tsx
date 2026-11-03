import { sliderTitles } from '@app/components/Discover/constants';
import Slider from '@app/components/Slider';
import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import type { MediaResultsResponse } from '@server/interfaces/api/mediaInterfaces';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const RecentlyAddedSlider = () => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  const { data: media, error: mediaError } = useSWR<MediaResultsResponse>(
    '/api/v1/media?filter=allavailable&take=20&sort=mediaAdded',
    { revalidateOnMount: true }
  );

  if (
    (media && !media.results.length) ||
    mediaError ||
    !hasPermission([Permission.MANAGE_REQUESTS, Permission.RECENT_VIEW], {
      type: 'or',
    })
  ) {
    return null;
  }

  return (
    <>
      <div className="slider-header">
        <div className="slider-title">
          <span>{intl.formatMessage(sliderTitles.recentlyAdded)}</span>
        </div>
      </div>
      <Slider
        sliderKey="media"
        isLoading={!media}
        items={(media?.results ?? []).map((item) => (
          <TitleCard
            key={`media-slider-item-${item.id}`}
            id={item.igdbId}
            title={item.title ?? `IGDB #${item.igdbId}`}
            coverImageId={item.coverImageId}
            status={item.status}
          />
        ))}
      />
    </>
  );
};

export default RecentlyAddedSlider;
