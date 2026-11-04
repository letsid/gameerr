import Badge from '@app/components/Common/Badge';
import CachedImage from '@app/components/Common/CachedImage';
import LoadingSpinner from '@app/components/Common/LoadingSpinner';
import PageTitle from '@app/components/Common/PageTitle';
import RequestPanel from '@app/components/GameDetails/RequestPanel';
import ScoreBadges from '@app/components/GameDetails/ScoreBadges';
import TimeToBeat from '@app/components/GameDetails/TimeToBeat';
import Slider from '@app/components/Slider';
import StatusBadge from '@app/components/StatusBadge';
import usePlatforms, { platformLabel } from '@app/hooks/usePlatforms';
import ErrorPage from '@app/pages/_error';
import defineMessages from '@app/utils/defineMessages';
import { PlayIcon } from '@heroicons/react/24/solid';
import { igdbImageUrl } from '@server/api/igdb/images';
import type { GameDetailsResponse } from '@server/interfaces/api/gameInterfaces';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR from 'swr';

const messages = defineMessages('components.GameDetails', {
  overview: 'Overview',
  overviewunavailable: 'Overview unavailable.',
  storyline: 'Storyline',
  releases: 'Releases',
  tba: 'TBA',
  developer: 'Developer',
  publisher: 'Publisher',
  genres: 'Genres',
  gameModes: 'Game Modes',
  screenshots: 'Screenshots',
  videos: 'Videos',
  playVideo: 'Play {name}',
  trailer: 'Trailer',
  steamStore: 'Steam Store',
  igdbPage: 'IGDB',
  links: 'Links',
  attribution: 'Game data by <IgdbLink>IGDB</IgdbLink>',
  inLibraryOn: 'In library: {platform} ({source})',
  sourceSteam: 'Steam',
  sourceQuestarr: 'Questarr',
});

// release_date_statuses that are not a full release
const RELEASE_STATUS_LABEL: Record<number, string> = {
  1: 'Alpha',
  2: 'Beta',
  3: 'Early Access',
  4: 'Offline',
  5: 'Cancelled',
};

const YouTubeEmbed = ({ id, name }: { id: string; name?: string }) => {
  const intl = useIntl();
  const [playing, setPlaying] = useState(false);

  // Nothing is loaded from YouTube until the viewer asks for the video
  return (
    <div className="relative aspect-video w-72 overflow-hidden rounded-lg bg-gray-800 ring-1 ring-gray-700 md:w-96">
      {playing ? (
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={name ?? intl.formatMessage(messages.trailer)}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 transition hover:text-white"
          aria-label={intl.formatMessage(messages.playVideo, {
            name: name ?? intl.formatMessage(messages.trailer),
          })}
        >
          <PlayIcon className="h-12 w-12" />
          <span className="mt-2 px-4 text-center text-sm">
            {name ?? intl.formatMessage(messages.trailer)}
          </span>
        </button>
      )}
    </div>
  );
};

const GameDetails = () => {
  const intl = useIntl();
  const router = useRouter();
  const { byId } = usePlatforms();
  const gameId = Number(router.query.gameId);
  const { data, error, mutate } = useSWR<GameDetailsResponse>(
    Number.isInteger(gameId) && gameId > 0 ? `/api/v1/game/${gameId}` : null
  );

  if (!data && !error) {
    return <LoadingSpinner />;
  }

  if (!data) {
    return <ErrorPage statusCode={error?.response?.status ?? 404} />;
  }

  const year = data.firstReleaseDate
    ? new Date(data.firstReleaseDate * 1000).getUTCFullYear()
    : undefined;
  const steamUrl = data.steam
    ? `https://store.steampowered.com/app/${data.steam.appId}`
    : undefined;

  return (
    <div
      className="media-page"
      style={{ height: 493 }}
      data-testid="game-details"
    >
      <PageTitle title={data.name} />
      {data.backdropImageId && (
        <div className="media-page-bg-image">
          <CachedImage
            type="igdb"
            alt=""
            src={igdbImageUrl(data.backdropImageId, '1080p')}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            fill
            priority
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(180deg, rgba(17, 24, 39, 0.47) 0%, rgba(17, 24, 39, 1) 100%)',
            }}
          />
        </div>
      )}
      <div className="media-header">
        <div className="media-poster">
          <CachedImage
            type="igdb"
            src={
              data.coverImageId
                ? igdbImageUrl(data.coverImageId, 'cover_big')
                : '/images/gameerr_cover_not_found.png'
            }
            alt=""
            layout="responsive"
            width={600}
            height={800}
            priority
          />
        </div>
        <div className="media-title">
          <div className="media-status">
            {data.mediaInfo && <StatusBadge status={data.mediaInfo.status} />}
          </div>
          <h1 data-testid="game-title">
            {data.name} {year && <span className="media-year">({year})</span>}
          </h1>
          <span className="media-attributes">
            {[...data.developers.slice(0, 2), ...data.genres.slice(0, 3)].map(
              (value, index, all) => (
                <span key={`attribute-${value}-${index}`}>
                  {value}
                  {index < all.length - 1 && <span className="mx-1">|</span>}
                </span>
              )
            )}
          </span>
          <div className="mt-3 flex justify-center xl:justify-start">
            <ScoreBadges gameId={data.id} />
          </div>
          <div className="mt-2 flex justify-center xl:justify-start">
            <TimeToBeat gameId={data.id} />
          </div>
          {data.library.length > 0 && (
            <div
              className="mt-2 flex flex-wrap justify-center gap-1 xl:justify-start"
              data-testid="library-badges"
            >
              {data.library.map((entry) => (
                <Badge
                  key={`library-${entry.platform}-${entry.source}`}
                  badgeType="success"
                >
                  {intl.formatMessage(messages.inLibraryOn, {
                    platform: platformLabel(entry.platform, byId),
                    source: intl.formatMessage(
                      entry.source === 'steam'
                        ? messages.sourceSteam
                        : messages.sourceQuestarr
                    ),
                  })}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="media-actions">
          <RequestPanel
            gameId={data.id}
            title={data.name}
            platforms={data.platforms}
            media={data.mediaInfo}
            ownedPlatforms={data.library.map((entry) => entry.platform)}
            onRequested={() => mutate()}
          />
        </div>
      </div>
      <div className="media-overview">
        <div className="media-overview-left">
          <h2>{intl.formatMessage(messages.overview)}</h2>
          <p>
            {data.summary ?? intl.formatMessage(messages.overviewunavailable)}
          </p>
          {data.storyline && (
            <>
              <h2 className="mt-6">{intl.formatMessage(messages.storyline)}</h2>
              <p>{data.storyline}</p>
            </>
          )}
          {data.gameModes.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {data.gameModes.map((mode) => (
                <Badge key={`mode-${mode}`} badgeType="dark">
                  {mode}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="media-overview-right">
          <div className="media-facts">
            <div className="media-fact">
              <span>{intl.formatMessage(messages.releases)}</span>
            </div>
            {data.releases.map((release) => (
              <div
                className="media-fact"
                key={`release-${release.platform}`}
                data-testid={`release-${release.platform}`}
              >
                <span className="font-normal">
                  {byId.get(release.platform)?.name ??
                    platformLabel(release.platform, byId)}
                </span>
                <span className="media-fact-value">
                  {release.date
                    ? intl.formatDate(release.date * 1000, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })
                    : intl.formatMessage(messages.tba)}
                  {release.status !== undefined &&
                    RELEASE_STATUS_LABEL[release.status] && (
                      <span className="ml-1 text-xs text-yellow-500">
                        {RELEASE_STATUS_LABEL[release.status]}
                      </span>
                    )}
                </span>
              </div>
            ))}
          </div>
          <div className="media-facts mt-4">
            {data.developers.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.developer)}</span>
                <span className="media-fact-value">
                  {data.developers.join(', ')}
                </span>
              </div>
            )}
            {data.publishers.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.publisher)}</span>
                <span className="media-fact-value">
                  {data.publishers.join(', ')}
                </span>
              </div>
            )}
            {data.genres.length > 0 && (
              <div className="media-fact">
                <span>{intl.formatMessage(messages.genres)}</span>
                <span className="media-fact-value">
                  {data.genres.join(', ')}
                </span>
              </div>
            )}
            <div className="media-fact">
              <span>{intl.formatMessage(messages.links)}</span>
              <span className="media-fact-value flex flex-col items-end">
                {data.igdbUrl && (
                  <a href={data.igdbUrl} target="_blank" rel="noreferrer">
                    {intl.formatMessage(messages.igdbPage)}
                  </a>
                )}
                {steamUrl && (
                  <a href={steamUrl} target="_blank" rel="noreferrer">
                    {intl.formatMessage(messages.steamStore)}
                  </a>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      {data.screenshots.length > 0 && (
        <>
          <div className="slider-header">
            <div className="slider-title">
              <span>{intl.formatMessage(messages.screenshots)}</span>
            </div>
          </div>
          <Slider
            sliderKey="screenshots"
            isLoading={false}
            items={data.screenshots.map((imageId) => (
              <a
                key={`screenshot-${imageId}`}
                href={igdbImageUrl(imageId, '1080p')}
                target="_blank"
                rel="noreferrer"
                className="block w-72 overflow-hidden rounded-lg ring-1 ring-gray-700 md:w-96"
              >
                <CachedImage
                  type="igdb"
                  src={igdbImageUrl(imageId, 'screenshot_big')}
                  alt=""
                  width={889}
                  height={500}
                  style={{ width: '100%', height: 'auto' }}
                />
              </a>
            ))}
          />
        </>
      )}
      {data.videos.length > 0 && (
        <>
          <div className="slider-header">
            <div className="slider-title">
              <span>{intl.formatMessage(messages.videos)}</span>
            </div>
          </div>
          <Slider
            sliderKey="videos"
            isLoading={false}
            items={data.videos.slice(0, 10).map((video) => (
              <YouTubeEmbed
                key={`video-${video.youtubeId}`}
                id={video.youtubeId}
                name={video.name}
              />
            ))}
          />
        </>
      )}
      <p className="py-6 text-center text-xs text-gray-500">
        {intl.formatMessage(messages.attribution, {
          IgdbLink: (msg: React.ReactNode) => (
            <a
              href="https://www.igdb.com/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-gray-300"
            >
              {msg}
            </a>
          ),
        })}
      </p>
    </div>
  );
};

export default GameDetails;
