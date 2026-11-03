import Spinner from '@app/assets/spinner.svg';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import Tooltip from '@app/components/Common/Tooltip';
import StatusBadge from '@app/components/StatusBadge';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { withProperties } from '@app/utils/typeHelpers';
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/solid';
import { igdbImageUrl } from '@server/api/igdb/images';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestCard', {
  failedretry: 'Something went wrong while retrying the request.',
  failedmodify: 'Something went wrong while modifying the request.',
  approverequest: 'Approve Request',
  declinerequest: 'Decline Request',
  cancelrequest: 'Cancel Request',
});

const RequestCardPlaceholder = () => {
  return (
    <div className="relative w-72 animate-pulse rounded-xl bg-gray-700 p-4 sm:w-96">
      <div className="w-20 sm:w-28">
        <div className="w-full" style={{ paddingBottom: '133.33%' }} />
      </div>
    </div>
  );
};

interface RequestCardProps {
  request: NonFunctionProperties<MediaRequest>;
}

const RequestCard = ({ request }: RequestCardProps) => {
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { addToast } = useToasts();
  const [isRetrying, setRetrying] = useState(false);
  const [updatingType, setUpdatingType] = useState<
    'approve' | 'decline' | null
  >(null);
  const { data: requestData, mutate: revalidate } = useSWR<
    NonFunctionProperties<MediaRequest>
  >(`/api/v1/request/${request.id}`, {
    fallbackData: request,
  });

  const modifyRequest = async (type: 'approve' | 'decline') => {
    setUpdatingType(type);
    try {
      await axios.post(`/api/v1/request/${request.id}/${type}`);
      revalidate();
      mutate('/api/v1/request/count');
    } catch {
      addToast(intl.formatMessage(messages.failedmodify), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setUpdatingType(null);
    }
  };

  const deleteRequest = async () => {
    await axios.delete(`/api/v1/request/${request.id}`);
    mutate('/api/v1/request?filter=all&take=10&sort=added&skip=0');
    mutate('/api/v1/request/count');
  };

  const retryRequest = async () => {
    setRetrying(true);

    try {
      const response = await axios.post(`/api/v1/request/${request.id}/retry`);

      if (response) {
        revalidate();
      }
    } catch {
      addToast(intl.formatMessage(messages.failedretry), {
        autoDismiss: true,
        appearance: 'error',
      });
    } finally {
      setRetrying(false);
    }
  };

  if (!requestData) {
    return <RequestCardPlaceholder />;
  }

  const gameTitle =
    requestData.media.title ?? `IGDB #${requestData.media.igdbId}`;
  const platformName =
    requestData.platformName ??
    `${intl.formatMessage(globalMessages.platform)} ${requestData.platform}`;

  return (
    <div
      className="relative flex w-72 overflow-hidden rounded-xl bg-gray-800 bg-cover bg-center p-4 text-gray-400 shadow ring-1 ring-gray-700 sm:w-96"
      data-testid="request-card"
    >
      <div
        className="relative z-10 flex min-w-0 flex-1 flex-col pr-4"
        data-testid="request-card-title"
      >
        <Link
          href={`/game/${requestData.media.igdbId}`}
          className="overflow-hidden overflow-ellipsis whitespace-nowrap text-base font-bold text-white hover:underline sm:text-lg"
        >
          {gameTitle}
        </Link>
        {hasPermission([Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW], {
          type: 'or',
        }) && (
          <div className="card-field">
            <Link
              href={`/users/${requestData.requestedBy.id}`}
              className="group flex items-center"
            >
              <span className="avatar-sm">
                <CachedImage
                  type="avatar"
                  src={requestData.requestedBy.avatar}
                  alt=""
                  className="avatar-sm object-cover"
                  width={20}
                  height={20}
                />
              </span>
              <span className="truncate font-semibold group-hover:text-white group-hover:underline">
                {requestData.requestedBy.displayName}
              </span>
            </Link>
          </div>
        )}
        <div className="my-0.5 flex items-center text-sm sm:my-1">
          <span className="mr-2 hidden font-bold sm:block">
            {intl.formatMessage(globalMessages.platform)}
          </span>
          <span className="truncate">
            <Badge>{platformName}</Badge>
          </span>
        </div>
        <div className="mt-2 flex items-center text-sm sm:mt-1">
          <span className="mr-2 hidden font-bold sm:block">
            {intl.formatMessage(globalMessages.status)}
          </span>
          {requestData.status === MediaRequestStatus.DECLINED ? (
            <Badge badgeType="danger">
              {intl.formatMessage(globalMessages.declined)}
            </Badge>
          ) : requestData.status === MediaRequestStatus.FAILED ? (
            <Badge badgeType="danger">
              {intl.formatMessage(globalMessages.failed)}
            </Badge>
          ) : requestData.status === MediaRequestStatus.PENDING &&
            requestData.media.status === MediaStatus.DELETED ? (
            <Badge badgeType="warning">
              {intl.formatMessage(globalMessages.pending)}
            </Badge>
          ) : (
            <StatusBadge status={requestData.media.status} />
          )}
        </div>
        <div className="flex flex-1 items-end space-x-2">
          {requestData.status === MediaRequestStatus.FAILED &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <Button
                buttonType="primary"
                buttonSize="sm"
                disabled={isRetrying}
                onClick={() => retryRequest()}
              >
                <ArrowPathIcon
                  className={isRetrying ? 'animate-spin' : ''}
                  style={{ marginRight: '0', animationDirection: 'reverse' }}
                />
                <span className="ml-1.5 hidden sm:block">
                  {intl.formatMessage(globalMessages.retry)}
                </span>
              </Button>
            )}
          {requestData.status === MediaRequestStatus.PENDING &&
            hasPermission(Permission.MANAGE_REQUESTS) && (
              <>
                <div>
                  <Button
                    buttonType="success"
                    buttonSize="sm"
                    className="hidden sm:block"
                    onClick={() => modifyRequest('approve')}
                    disabled={updatingType !== null}
                  >
                    {updatingType === 'approve' ? <Spinner /> : <CheckIcon />}
                    <span>{intl.formatMessage(globalMessages.approve)}</span>
                  </Button>
                  <Tooltip
                    content={intl.formatMessage(messages.approverequest)}
                  >
                    <Button
                      buttonType="success"
                      buttonSize="sm"
                      className="sm:hidden"
                      onClick={() => modifyRequest('approve')}
                      disabled={updatingType !== null}
                    >
                      {updatingType === 'approve' ? <Spinner /> : <CheckIcon />}
                    </Button>
                  </Tooltip>
                </div>
                <div>
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    className="hidden sm:block"
                    onClick={() => modifyRequest('decline')}
                    disabled={updatingType !== null}
                  >
                    {updatingType === 'decline' ? <Spinner /> : <XMarkIcon />}
                    <span>{intl.formatMessage(globalMessages.decline)}</span>
                  </Button>
                  <Tooltip
                    content={intl.formatMessage(messages.declinerequest)}
                  >
                    <Button
                      buttonType="danger"
                      buttonSize="sm"
                      className="sm:hidden"
                      onClick={() => modifyRequest('decline')}
                      disabled={updatingType !== null}
                    >
                      {updatingType === 'decline' ? <Spinner /> : <XMarkIcon />}
                    </Button>
                  </Tooltip>
                </div>
              </>
            )}
          {requestData.status === MediaRequestStatus.PENDING &&
            !hasPermission(Permission.MANAGE_REQUESTS) &&
            requestData.requestedBy.id === user?.id && (
              <div>
                <Button
                  buttonType="danger"
                  buttonSize="sm"
                  className="hidden sm:block"
                  onClick={() => deleteRequest()}
                >
                  <XMarkIcon />
                  <span>{intl.formatMessage(globalMessages.cancel)}</span>
                </Button>
                <Tooltip content={intl.formatMessage(messages.cancelrequest)}>
                  <Button
                    buttonType="danger"
                    buttonSize="sm"
                    className="sm:hidden"
                    onClick={() => deleteRequest()}
                  >
                    <XMarkIcon />
                  </Button>
                </Tooltip>
              </div>
            )}
        </div>
      </div>
      <Link
        href={`/game/${requestData.media.igdbId}`}
        className="w-20 flex-shrink-0 scale-100 transform-gpu cursor-pointer overflow-hidden rounded-md shadow-sm transition duration-300 hover:scale-105 hover:shadow-md sm:w-28"
      >
        <CachedImage
          type="igdb"
          src={
            requestData.media.coverImageId
              ? igdbImageUrl(requestData.media.coverImageId, 'cover_big')
              : '/images/gameerr_cover_not_found.png'
          }
          alt=""
          sizes="100vw"
          style={{ width: '100%', height: 'auto', aspectRatio: '3 / 4' }}
          className="object-cover"
          width={264}
          height={352}
        />
      </Link>
    </div>
  );
};

export default withProperties(RequestCard, {
  Placeholder: RequestCardPlaceholder,
});
