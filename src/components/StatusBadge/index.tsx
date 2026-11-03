import Spinner from '@app/assets/spinner.svg';
import Badge from '@app/components/Common/Badge';
import globalMessages from '@app/i18n/globalMessages';
import { MediaStatus } from '@server/constants/media';
import { useIntl } from 'react-intl';

interface StatusBadgeProps {
  status?: MediaStatus;
  inProgress?: boolean;
  statusLabelOverride?: string;
}

const StatusBadge = ({
  status,
  inProgress = false,
  statusLabelOverride,
}: StatusBadgeProps) => {
  const intl = useIntl();

  switch (status) {
    case MediaStatus.AVAILABLE:
      return (
        <Badge badgeType="success">
          <div className="flex items-center">
            <span>
              {intl.formatMessage(
                inProgress
                  ? globalMessages.processing
                  : globalMessages.available
              )}
            </span>
            {inProgress && <Spinner className="ml-1 h-3 w-3" />}
          </div>
        </Badge>
      );

    case MediaStatus.PARTIALLY_AVAILABLE:
      return (
        <Badge badgeType="success">
          {intl.formatMessage(globalMessages.partiallyavailable)}
        </Badge>
      );

    case MediaStatus.PROCESSING:
      return (
        <Badge badgeType="primary">
          <div className="flex items-center">
            <span>
              {intl.formatMessage(
                inProgress
                  ? globalMessages.processing
                  : globalMessages.requested
              )}
            </span>
            {inProgress && <Spinner className="ml-1 h-3 w-3" />}
          </div>
        </Badge>
      );

    case MediaStatus.PENDING:
      return (
        <Badge badgeType="warning">
          {intl.formatMessage(globalMessages.pending)}
        </Badge>
      );

    case MediaStatus.BLOCKLISTED:
      return (
        <Badge badgeType="danger">
          {statusLabelOverride ??
            intl.formatMessage(globalMessages.blocklisted)}
        </Badge>
      );

    case MediaStatus.DELETED:
      return (
        <Badge badgeType="danger">
          {intl.formatMessage(globalMessages.deleted)}
        </Badge>
      );

    default:
      return null;
  }
};

export default StatusBadge;
