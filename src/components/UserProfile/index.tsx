import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import ProgressCircle from '@app/components/Common/ProgressCircle';
import RequestCard from '@app/components/RequestCard';
import Slider from '@app/components/Slider';
import TitleCard from '@app/components/TitleCard';
import ProfileHeader from '@app/components/UserProfile/ProfileHeader';
import { Permission, useUser } from '@app/hooks/useUser';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { ArrowRightCircleIcon } from '@heroicons/react/24/outline';
import type { WatchlistResponse } from '@server/interfaces/api/discoverInterfaces';
import type {
  QuotaResponse,
  UserRequestsResponse,
} from '@server/interfaces/api/userInterfaces';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.UserProfile', {
  recentrequests: 'Recent Requests',
  limit: '{remaining} of {limit}',
  requestsperdays: '{limit} remaining',
  unlimited: 'Unlimited',
  totalrequests: 'Total Requests',
  pastdays: '{type} (past {days} days)',
  gamerequests: 'Game Requests',
  localWatchlist: "{username}'s Watchlist",
  emptywatchlist:
    'Games added to the watchlist will appear here. Hover over a game and click the star to add it.',
});

const UserProfile = () => {
  const intl = useIntl();
  const router = useRouter();
  const { user, error } = useUser({
    id: Number(router.query.userId),
  });
  const { user: currentUser, hasPermission: currentHasPermission } = useUser();
  const { data: requests, error: requestError } = useSWR<UserRequestsResponse>(
    user &&
      (user.id === currentUser?.id ||
        currentHasPermission(
          [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
          { type: 'or' }
        ))
      ? `/api/v1/user/${user?.id}/requests?take=10&skip=0`
      : null
  );
  const { data: quota } = useSWR<QuotaResponse>(
    user &&
      (user.id === currentUser?.id ||
        currentHasPermission(
          [Permission.MANAGE_USERS, Permission.MANAGE_REQUESTS],
          { type: 'and' }
        ))
      ? `/api/v1/user/${user.id}/quota`
      : null
  );

  const { data: watchlistItems, error: watchlistError } =
    useSWR<WatchlistResponse>(
      user?.id === currentUser?.id ||
        currentHasPermission(
          [Permission.MANAGE_REQUESTS, Permission.WATCHLIST_VIEW],
          {
            type: 'or',
          }
        )
        ? `/api/v1/user/${user?.id}/watchlist`
        : null,
      {
        revalidateOnMount: true,
      }
    );

  if (!user && !error) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <ErrorPage statusCode={404} />;
  }

  return (
    <>
      <PageTitle title={user.displayName} />
      <ProfileHeader user={user} />
      {quota &&
        (user.id === currentUser?.id ||
          currentHasPermission(
            [Permission.MANAGE_USERS, Permission.MANAGE_REQUESTS],
            { type: 'and' }
          )) && (
          <div className="relative z-40">
            <dl className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg bg-gray-800/50 px-4 py-5 shadow ring-1 ring-gray-700 sm:p-6">
                <dt className="truncate text-sm font-bold text-gray-300">
                  {intl.formatMessage(messages.totalrequests)}
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-white">
                  <Link
                    href={
                      currentHasPermission(
                        [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                        { type: 'or' }
                      )
                        ? `/users/${user?.id}/requests?filter=all`
                        : '/requests'
                    }
                  >
                    {intl.formatNumber(user.requestCount)}
                  </Link>
                </dd>
              </div>
              <div
                className={`overflow-hidden rounded-lg bg-gray-800/50 px-4 py-5 shadow ring-1 ${
                  quota.game.restricted
                    ? 'bg-gradient-to-t from-red-900 to-transparent ring-red-500'
                    : 'ring-gray-700'
                } sm:p-6`}
              >
                <dt
                  className={`truncate text-sm font-bold ${
                    quota.game.restricted ? 'text-red-500' : 'text-gray-300'
                  }`}
                >
                  {quota.game.limit
                    ? intl.formatMessage(messages.pastdays, {
                        type: intl.formatMessage(messages.gamerequests),
                        days: quota?.game.days,
                      })
                    : intl.formatMessage(messages.gamerequests)}
                </dt>
                <dd
                  className={`mt-1 flex items-center text-sm ${
                    quota.game.restricted ? 'text-red-500' : 'text-white'
                  }`}
                >
                  {quota.game.limit ? (
                    <>
                      <ProgressCircle
                        progress={Math.round(
                          ((quota?.game.remaining ?? 0) /
                            (quota?.game.limit ?? 1)) *
                            100
                        )}
                        useHeatLevel
                        className="mr-2 h-8 w-8"
                      />
                      <div>
                        {intl.formatMessage(messages.requestsperdays, {
                          limit: (
                            <span className="text-3xl font-semibold">
                              {intl.formatMessage(messages.limit, {
                                remaining: quota.game.remaining,
                                limit: quota.game.limit,
                              })}
                            </span>
                          ),
                        })}
                      </div>
                    </>
                  ) : (
                    <span className="text-3xl font-semibold">
                      {intl.formatMessage(messages.unlimited)}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        )}
      {(user.id === currentUser?.id ||
        currentHasPermission(
          [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
          { type: 'or' }
        )) &&
        (!requests || !!requests.results.length) &&
        !requestError && (
          <>
            <div className="slider-header">
              <Link
                href={
                  currentHasPermission(
                    [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
                    { type: 'or' }
                  )
                    ? `/users/${user?.id}/requests?filter=all`
                    : '/requests'
                }
                className="slider-title"
              >
                <span>{intl.formatMessage(messages.recentrequests)}</span>
                <ArrowRightCircleIcon />
              </Link>
            </div>
            <Slider
              sliderKey="requests"
              isLoading={!requests}
              items={(requests?.results ?? []).map((request) => (
                <RequestCard
                  key={`request-slider-item-${request.id}`}
                  request={request}
                />
              ))}
              placeholder={<RequestCard.Placeholder />}
            />
          </>
        )}
      {(user.id === currentUser?.id ||
        currentHasPermission(
          [Permission.MANAGE_REQUESTS, Permission.WATCHLIST_VIEW],
          { type: 'or' }
        )) &&
        (!watchlistItems ||
          !!watchlistItems.results.length ||
          user.id === currentUser?.id) &&
        !watchlistError && (
          <>
            <div className="slider-header">
              <Link
                href={
                  user.id === currentUser?.id
                    ? '/profile/watchlist'
                    : `/users/${user.id}/watchlist`
                }
                className="slider-title"
              >
                <span>
                  {intl.formatMessage(messages.localWatchlist, {
                    username: user.displayName,
                  })}
                </span>
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
        )}
    </>
  );
};

export default UserProfile;
