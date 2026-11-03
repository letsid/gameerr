import Spinner from '@app/assets/spinner.svg';
import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import CachedImage from '@app/components/Common/CachedImage';
import ConfirmButton from '@app/components/Common/ConfirmButton';
import StatusBadge from '@app/components/StatusBadge';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import {
  ArrowPathIcon,
  CheckIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import { igdbImageUrl } from '@server/api/igdb/images';
import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import type { MediaRequest } from '@server/entity/MediaRequest';
import type { NonFunctionProperties } from '@server/interfaces/api/common';
import type { RequestResultsResponse } from '@server/interfaces/api/requestInterfaces';
import axios from 'axios';
import Link from 'next/link';
import { useState } from 'react';
import { FormattedRelativeTime, useIntl } from 'react-intl';
import useSWR, { mutate } from 'swr';

const messages = defineMessages('components.RequestList.RequestItem', {
  failedretry: 'Something went wrong while retrying the request.',
  failedmodify: 'Something went wrong while modifying the request.',
  requested: 'Requested',
  requesteddate: 'Requested',
  modified: 'Modified',
  modifieduserdate: '{date} by {user}',
  deleterequest: 'Delete Request',
  cancelRequest: 'Cancel Request',
});

interface RequestItemProps {
  request: RequestResultsResponse['results'][number];
  revalidateList: () => void;
}

const RequestItem = ({ request, revalidateList }: RequestItemProps) => {
  const { addToast } = useToasts();
  const intl = useIntl();
  const { user, hasPermission } = useUser();
  const { data: requestData, mutate: revalidate } = useSWR<
    NonFunctionProperties<MediaRequest>
  >(`/api/v1/request/${request.id}`, {
    fallbackData: request,
  });

  const [isRetrying, setRetrying] = useState(false);
  const [updatingType, setUpdatingType] = useState<
    'approve' | 'decline' | null
  >(null);

  const modifyRequest = async (type: 'approve' | 'decline') => {
    setUpdatingType(type);
    try {
      await axios.post(`/api/v1/request/${request.id}/${type}`);
      revalidate();
      revalidateList();
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

    revalidateList();
    mutate('/api/v1/request/count');
  };

  const retryRequest = async () => {
    setRetrying(true);

    try {
      const result = await axios.post(`/api/v1/request/${request.id}/retry`);
      revalidate(result.data);
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
    return (
      <div className="h-64 w-full animate-pulse rounded-xl bg-gray-800 xl:h-28" />
    );
  }

  const gameTitle =
    requestData.media.title ?? `IGDB #${requestData.media.igdbId}`;
  const platformName =
    requestData.platformName ??
    `${intl.formatMessage(globalMessages.platform)} ${requestData.platform}`;

  return (
    <div className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gray-800 py-2 text-gray-400 shadow-md ring-1 ring-gray-700 xl:h-28 xl:flex-row">
      <div className="relative flex w-full flex-col justify-between overflow-hidden sm:flex-row">
        <div className="relative z-10 flex w-full items-center overflow-hidden pl-4 pr-4 sm:pr-0 xl:w-7/12 2xl:w-2/3">
          <Link
            href={`/game/${requestData.media.igdbId}`}
            className="relative h-auto w-12 flex-shrink-0 scale-100 transform-gpu overflow-hidden rounded-md transition duration-300 hover:scale-105"
          >
            <CachedImage
              type="igdb"
              src={
                requestData.media.coverImageId
                  ? igdbImageUrl(requestData.media.coverImageId, 'cover_big')
                  : '/images/seerr_poster_not_found.png'
              }
              alt=""
              sizes="100vw"
              style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
              width={264}
              height={352}
            />
          </Link>
          <div className="flex flex-col justify-center overflow-hidden pl-2 xl:pl-4">
            <Link
              href={`/game/${requestData.media.igdbId}`}
              className="mr-2 min-w-0 truncate text-lg font-bold text-white hover:underline xl:text-xl"
            >
              {gameTitle}
            </Link>
            <div className="card-field">
              <span className="card-field-name">
                {intl.formatMessage(globalMessages.platform)}
              </span>
              <Badge>{platformName}</Badge>
            </div>
          </div>
        </div>
        <div className="z-10 ml-4 mt-4 flex w-full flex-col justify-center gap-1 overflow-hidden pr-4 text-sm sm:ml-2 sm:mt-0 xl:flex-1 xl:pr-0">
          <div className="card-field">
            <span className="card-field-name">
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
          <div className="card-field">
            {hasPermission(
              [Permission.MANAGE_REQUESTS, Permission.REQUEST_VIEW],
              { type: 'or' }
            ) ? (
              <>
                <span className="card-field-name">
                  {intl.formatMessage(messages.requested)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  {intl.formatMessage(messages.modifieduserdate, {
                    date: (
                      <FormattedRelativeTime
                        value={Math.floor(
                          (new Date(requestData.createdAt).getTime() -
                            Date.now()) /
                            1000
                        )}
                        updateIntervalInSeconds={1}
                        numeric="auto"
                      />
                    ),
                    user: (
                      <Link
                        href={`/users/${requestData.requestedBy.id}`}
                        className="group flex items-center truncate"
                      >
                        <span className="avatar-sm ml-1.5">
                          <CachedImage
                            type="avatar"
                            src={requestData.requestedBy.avatar}
                            alt=""
                            className="avatar-sm object-cover"
                            width={20}
                            height={20}
                          />
                        </span>
                        <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                          {requestData.requestedBy.displayName}
                        </span>
                      </Link>
                    ),
                  })}
                </span>
              </>
            ) : (
              <>
                <span className="card-field-name">
                  {intl.formatMessage(messages.requesteddate)}
                </span>
                <span className="flex truncate text-sm text-gray-300">
                  <FormattedRelativeTime
                    value={Math.floor(
                      (new Date(requestData.createdAt).getTime() - Date.now()) /
                        1000
                    )}
                    updateIntervalInSeconds={1}
                    numeric="auto"
                  />
                </span>
              </>
            )}
          </div>
          {requestData.modifiedBy && (
            <div className="card-field">
              <span className="card-field-name">
                {intl.formatMessage(messages.modified)}
              </span>
              <span className="flex truncate text-sm text-gray-300">
                {intl.formatMessage(messages.modifieduserdate, {
                  date: (
                    <FormattedRelativeTime
                      value={Math.floor(
                        (new Date(requestData.updatedAt).getTime() -
                          Date.now()) /
                          1000
                      )}
                      updateIntervalInSeconds={1}
                      numeric="auto"
                    />
                  ),
                  user: (
                    <Link
                      href={`/users/${requestData.modifiedBy.id}`}
                      className="group flex items-center truncate"
                    >
                      <span className="avatar-sm ml-1.5">
                        <CachedImage
                          type="avatar"
                          src={requestData.modifiedBy.avatar}
                          alt=""
                          className="avatar-sm object-cover"
                          width={20}
                          height={20}
                        />
                      </span>
                      <span className="truncate text-sm font-semibold group-hover:text-white group-hover:underline">
                        {requestData.modifiedBy.displayName}
                      </span>
                    </Link>
                  ),
                })}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="z-10 mt-4 flex w-full flex-col justify-center space-y-2 pl-4 pr-4 xl:mt-0 xl:w-96 xl:items-end xl:pl-0">
        {requestData.status === MediaRequestStatus.FAILED &&
          hasPermission(Permission.MANAGE_REQUESTS) && (
            <Button
              className="w-full"
              buttonType="primary"
              disabled={isRetrying}
              onClick={() => retryRequest()}
            >
              <ArrowPathIcon
                className={isRetrying ? 'animate-spin' : ''}
                style={{ animationDirection: 'reverse' }}
              />
              <span>
                {intl.formatMessage(
                  isRetrying ? globalMessages.retrying : globalMessages.retry
                )}
              </span>
            </Button>
          )}
        {requestData.status !== MediaRequestStatus.PENDING &&
          hasPermission(Permission.MANAGE_REQUESTS) && (
            <ConfirmButton
              onClick={() => deleteRequest()}
              confirmText={intl.formatMessage(globalMessages.areyousure)}
              className="w-full"
            >
              <TrashIcon />
              <span>{intl.formatMessage(messages.deleterequest)}</span>
            </ConfirmButton>
          )}
        {requestData.status === MediaRequestStatus.PENDING &&
          hasPermission(Permission.MANAGE_REQUESTS) && (
            <div className="flex w-full flex-row space-x-2">
              <span className="w-full">
                <Button
                  className="w-full"
                  buttonType="success"
                  onClick={() => modifyRequest('approve')}
                  disabled={updatingType !== null}
                >
                  {updatingType === 'approve' ? <Spinner /> : <CheckIcon />}
                  <span>{intl.formatMessage(globalMessages.approve)}</span>
                </Button>
              </span>
              <span className="w-full">
                <Button
                  className="w-full"
                  buttonType="danger"
                  onClick={() => modifyRequest('decline')}
                  disabled={updatingType !== null}
                >
                  {updatingType === 'decline' ? <Spinner /> : <XMarkIcon />}
                  <span>{intl.formatMessage(globalMessages.decline)}</span>
                </Button>
              </span>
            </div>
          )}
        {requestData.status === MediaRequestStatus.PENDING &&
          !hasPermission(Permission.MANAGE_REQUESTS) &&
          requestData.requestedBy.id === user?.id && (
            <ConfirmButton
              onClick={() => deleteRequest()}
              confirmText={intl.formatMessage(globalMessages.areyousure)}
              className="w-full"
            >
              <XMarkIcon />
              <span>{intl.formatMessage(messages.cancelRequest)}</span>
            </ConfirmButton>
          )}
      </div>
    </div>
  );
};

export default RequestItem;
