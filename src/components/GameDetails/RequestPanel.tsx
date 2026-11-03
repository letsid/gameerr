import Badge from '@app/components/Common/Badge';
import Button from '@app/components/Common/Button';
import usePlatforms, {
  platformLabel,
  usePreferredPlatforms,
} from '@app/hooks/usePlatforms';
import useToasts from '@app/hooks/useToasts';
import { Permission, useUser } from '@app/hooks/useUser';
import globalMessages from '@app/i18n/globalMessages';
import defineMessages from '@app/utils/defineMessages';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { MediaRequestStatus } from '@server/constants/media';
import type Media from '@server/entity/Media';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.GameDetails.RequestPanel', {
  requestFor: 'Request for',
  requestSuccess: '<strong>{title}</strong> requested for {platform}!',
  requestFailed: 'Something went wrong while requesting the game.',
  noPlatforms: 'No platforms are known for this game yet.',
});

interface RequestPanelProps {
  gameId: number;
  title: string;
  platforms: number[];
  media?: Media;
  onRequested: () => void;
}

const statusMessage = (status: MediaRequestStatus) => {
  switch (status) {
    case MediaRequestStatus.PENDING:
      return globalMessages.pending;
    case MediaRequestStatus.APPROVED:
      return globalMessages.approved;
    case MediaRequestStatus.DECLINED:
      return globalMessages.declined;
    case MediaRequestStatus.COMPLETED:
      return globalMessages.completed;
    default:
      return globalMessages.failed;
  }
};

const RequestPanel = ({
  gameId,
  title,
  platforms,
  media,
  onRequested,
}: RequestPanelProps) => {
  const intl = useIntl();
  const { addToast } = useToasts();
  const { hasPermission } = useUser();
  const { byId } = usePlatforms();
  const preferred = usePreferredPlatforms();
  const [isSubmitting, setSubmitting] = useState(false);

  // Requests that still block a new one on the same platform
  const activeByPlatform = useMemo(() => {
    const active = new Map<number, MediaRequestStatus>();
    (media?.requests ?? []).forEach((request) => {
      if (
        request.status !== MediaRequestStatus.DECLINED &&
        request.status !== MediaRequestStatus.COMPLETED
      ) {
        active.set(request.platform, request.status);
      }
    });
    return active;
  }, [media?.requests]);

  // The user's own platforms first, then the rest by name
  const options = useMemo(
    () =>
      [...platforms].sort((a, b) => {
        const rank = (id: number) =>
          preferred.includes(id) ? preferred.indexOf(id) : preferred.length;
        return (
          rank(a) - rank(b) ||
          platformLabel(a, byId).localeCompare(platformLabel(b, byId))
        );
      }),
    [platforms, preferred, byId]
  );

  const [platform, setPlatform] = useState<number | undefined>(options[0]);

  useEffect(() => {
    if (platform === undefined || !options.includes(platform)) {
      setPlatform(
        options.find((id) => !activeByPlatform.has(id)) ?? options[0]
      );
    }
  }, [options, platform, activeByPlatform]);

  if (!hasPermission([Permission.REQUEST], { type: 'or' })) {
    return null;
  }

  if (options.length === 0) {
    return (
      <span className="text-sm text-gray-400">
        {intl.formatMessage(messages.noPlatforms)}
      </span>
    );
  }

  const blocked = platform !== undefined && activeByPlatform.has(platform);

  const submit = async () => {
    if (platform === undefined) {
      return;
    }
    setSubmitting(true);
    try {
      await axios.post('/api/v1/request', { igdbId: gameId, platform });
      addToast(
        intl.formatMessage(messages.requestSuccess, {
          title,
          platform: byId.get(platform)?.name ?? platformLabel(platform, byId),
          strong: (msg: React.ReactNode) => <strong>{msg}</strong>,
        }),
        { appearance: 'success', autoDismiss: true }
      );
      onRequested();
    } catch (e) {
      addToast(
        e?.response?.data?.message ??
          intl.formatMessage(messages.requestFailed),
        { appearance: 'error', autoDismiss: true }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 sm:items-end">
      <div className="flex items-center gap-2">
        <label htmlFor="request-platform" className="sr-only">
          {intl.formatMessage(messages.requestFor)}
        </label>
        <select
          id="request-platform"
          className="rounded-md border border-gray-500 bg-gray-700 py-2 text-sm text-white"
          value={platform}
          onChange={(e) => setPlatform(Number(e.target.value))}
          data-testid="request-platform"
        >
          {options.map((id) => (
            <option key={`request-platform-${id}`} value={id}>
              {byId.get(id)?.name ?? platformLabel(id, byId)}
            </option>
          ))}
        </select>
        <Button
          buttonType="primary"
          disabled={isSubmitting || blocked}
          onClick={submit}
          data-testid="request-button"
        >
          <ArrowDownTrayIcon />
          <span>
            {isSubmitting
              ? intl.formatMessage(globalMessages.requesting)
              : intl.formatMessage(globalMessages.request)}
          </span>
        </Button>
      </div>
      {activeByPlatform.size > 0 && (
        <div className="flex flex-wrap justify-center gap-1 sm:justify-end">
          {[...activeByPlatform.entries()].map(([id, status]) => (
            <Badge
              key={`request-status-${id}`}
              badgeType={
                status === MediaRequestStatus.PENDING ? 'warning' : 'primary'
              }
            >
              {platformLabel(id, byId)}:{' '}
              {intl.formatMessage(statusMessage(status))}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default RequestPanel;
