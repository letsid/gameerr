import TitleCard from '@app/components/TitleCard';
import { Permission, useUser } from '@app/hooks/useUser';
import useVerticalScroll from '@app/hooks/useVerticalScroll';
import globalMessages from '@app/i18n/globalMessages';
import type { GameResult } from '@app/types/game';
import { MediaStatus } from '@server/constants/media';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import { useIntl } from 'react-intl';

type ListViewProps = {
  items?: GameResult[];
  watchlistItems?: WatchlistItem[];
  isEmpty?: boolean;
  isLoading?: boolean;
  isReachingEnd?: boolean;
  onScrollBottom: () => void;
  mutateParent?: () => void;
};

const ListView = ({
  items,
  isEmpty,
  isLoading,
  onScrollBottom,
  isReachingEnd,
  watchlistItems,
  mutateParent,
}: ListViewProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser();
  useVerticalScroll(onScrollBottom, !isLoading && !isEmpty && !isReachingEnd);

  const blocklistVisibility = hasPermission(
    [Permission.MANAGE_BLOCKLIST, Permission.VIEW_BLOCKLIST],
    { type: 'or' }
  );

  return (
    <>
      {isEmpty && (
        <div className="mt-64 w-full text-center text-2xl text-gray-400">
          {intl.formatMessage(globalMessages.noresults)}
        </div>
      )}
      <ul className="cards-vertical">
        {watchlistItems?.map((item, index) => {
          return (
            <li key={`${item.igdbId}-${index}`}>
              <TitleCard
                id={item.igdbId}
                title={item.title}
                coverImageId={item.coverImageId}
                isAddedToWatchlist={true}
                canExpand
                mutateParent={mutateParent}
              />
            </li>
          );
        })}
        {items
          ?.filter((title) => {
            if (!blocklistVisibility)
              return title.mediaInfo?.status !== MediaStatus.BLOCKLISTED;
            return title;
          })
          .map((title, index) => (
            <li key={`${title.id}-${index}`}>
              <TitleCard
                id={title.id}
                title={title.name}
                coverImageId={title.coverImageId}
                summary={title.summary}
                year={title.year}
                status={title.mediaInfo?.status}
                inLibrary={!!title.library?.length}
                isAddedToWatchlist={title.mediaInfo?.watchlists?.length ?? 0}
                canExpand
              />
            </li>
          ))}
        {isLoading &&
          !isReachingEnd &&
          [...Array(20)].map((_item, i) => (
            <li key={`placeholder-${i}`}>
              <TitleCard.Placeholder canExpand />
            </li>
          ))}
      </ul>
    </>
  );
};

export default ListView;
