import NotificationType from '@app/components/NotificationTypeSelector/NotificationType';
import type { User } from '@app/hooks/useUser';
import { Permission, useUser } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { sortBy } from 'lodash';
import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

const messages = defineMessages('components.NotificationTypeSelector', {
  notificationTypes: 'Notification Types',
  mediarequested: 'Request Pending Approval',
  mediarequestedDescription:
    'Send notifications when users submit new game requests which require approval.',
  usermediarequestedDescription:
    'Get notified when other users submit new game requests which require approval.',
  mediaapproved: 'Request Approved',
  mediaapprovedDescription:
    'Send notifications when game requests are manually approved.',
  usermediaapprovedDescription:
    'Get notified when your game requests are approved.',
  mediaAutoApproved: 'Request Automatically Approved',
  mediaAutoApprovedDescription:
    'Send notifications when users submit new game requests which are automatically approved.',
  usermediaAutoApprovedDescription:
    'Get notified when other users submit new game requests which are automatically approved.',
  mediaavailable: 'Request Available',
  mediaavailableDescription:
    'Send notifications when game requests become available.',
  usermediaavailableDescription:
    'Get notified when your game requests become available.',
  mediafailed: 'Request Processing Failed',
  mediafailedDescription:
    'Send notifications when game requests fail to be processed.',
  usermediafailedDescription:
    'Get notified when game requests fail to be processed.',
  mediadeclined: 'Request Declined',
  mediadeclinedDescription:
    'Send notifications when game requests are declined.',
  usermediadeclinedDescription:
    'Get notified when your game requests are declined.',
  mediafulfillment: 'Fulfillment Required',
  mediafulfillmentDescription:
    'Send notifications when an approved game request needs to be fulfilled manually.',
  usermediafulfillmentDescription:
    'Get notified when an approved game request needs to be fulfilled manually.',
});

export const hasNotificationType = (
  types: Notification | Notification[],
  value: number
): boolean => {
  let total: number;

  // If we are not checking any notifications, bail out and return true
  if (types === 0) {
    return true;
  }

  if (Array.isArray(types)) {
    // Combine all notification values into one
    total = types.reduce((a, v) => a + v, 0);
  } else {
    total = types;
  }

  // Test notifications don't need to be enabled
  if (!(value & Notification.TEST_NOTIFICATION)) {
    value += Notification.TEST_NOTIFICATION;
  }

  return !!(value & total);
};

export enum Notification {
  NONE = 0,
  MEDIA_PENDING = 2,
  MEDIA_APPROVED = 4,
  MEDIA_AVAILABLE = 8,
  MEDIA_FAILED = 16,
  TEST_NOTIFICATION = 32,
  MEDIA_DECLINED = 64,
  MEDIA_AUTO_APPROVED = 128,
  MEDIA_FULFILLMENT = 256,
}

export const ALL_NOTIFICATIONS = Object.values(Notification)
  .filter((v) => !isNaN(Number(v)))
  .reduce((a, v) => a + Number(v), 0);

export interface NotificationItem {
  id: string;
  name: string;
  description: string;
  value: Notification;
  hasNotifyUser: boolean;
  children?: NotificationItem[];
  hidden?: boolean;
}

interface NotificationTypeSelectorProps {
  user?: User;
  enabledTypes?: number;
  currentTypes: number;
  onUpdate: (newTypes: number) => void;
  error?: string;
}

const NotificationTypeSelector = ({
  user,
  enabledTypes = ALL_NOTIFICATIONS,
  currentTypes,
  onUpdate,
  error,
}: NotificationTypeSelectorProps) => {
  const intl = useIntl();
  const { hasPermission } = useUser({ id: user?.id });
  const [allowedTypes, setAllowedTypes] = useState(enabledTypes);

  const availableTypes = useMemo(() => {
    const allRequestsAutoApproved =
      user &&
      // Has Manage Requests perm, which grants Auto-Approve
      (hasPermission(Permission.MANAGE_REQUESTS) ||
        // Cannot submit requests
        !hasPermission(Permission.REQUEST) ||
        // Requests are automatically approved
        hasPermission(Permission.AUTO_APPROVE));

    const types: NotificationItem[] = [
      {
        id: 'media-requested',
        name: intl.formatMessage(messages.mediarequested),
        description: intl.formatMessage(
          user
            ? messages.usermediarequestedDescription
            : messages.mediarequestedDescription
        ),
        value: Notification.MEDIA_PENDING,
        hasNotifyUser: false,
        hidden: user && !hasPermission(Permission.MANAGE_REQUESTS),
      },
      {
        id: 'media-auto-approved',
        name: intl.formatMessage(messages.mediaAutoApproved),
        description: intl.formatMessage(
          user
            ? messages.usermediaAutoApprovedDescription
            : messages.mediaAutoApprovedDescription
        ),
        value: Notification.MEDIA_AUTO_APPROVED,
        hasNotifyUser: false,
        hidden: user && !hasPermission(Permission.MANAGE_REQUESTS),
      },
      {
        id: 'media-approved',
        name: intl.formatMessage(messages.mediaapproved),
        description: intl.formatMessage(
          user
            ? messages.usermediaapprovedDescription
            : messages.mediaapprovedDescription
        ),
        value: Notification.MEDIA_APPROVED,
        hasNotifyUser: true,
        hidden: allRequestsAutoApproved,
      },
      {
        id: 'media-declined',
        name: intl.formatMessage(messages.mediadeclined),
        description: intl.formatMessage(
          user
            ? messages.usermediadeclinedDescription
            : messages.mediadeclinedDescription
        ),
        value: Notification.MEDIA_DECLINED,
        hasNotifyUser: true,
        hidden: allRequestsAutoApproved,
      },
      {
        id: 'media-available',
        name: intl.formatMessage(messages.mediaavailable),
        description: intl.formatMessage(
          user
            ? messages.usermediaavailableDescription
            : messages.mediaavailableDescription
        ),
        value: Notification.MEDIA_AVAILABLE,
        hasNotifyUser: true,
      },
      {
        id: 'media-failed',
        name: intl.formatMessage(messages.mediafailed),
        description: intl.formatMessage(
          user
            ? messages.usermediafailedDescription
            : messages.mediafailedDescription
        ),
        value: Notification.MEDIA_FAILED,
        hidden: user && !hasPermission(Permission.MANAGE_REQUESTS),
        hasNotifyUser: false,
      },
      {
        id: 'media-fulfillment',
        name: intl.formatMessage(messages.mediafulfillment),
        description: intl.formatMessage(
          user
            ? messages.usermediafulfillmentDescription
            : messages.mediafulfillmentDescription
        ),
        value: Notification.MEDIA_FULFILLMENT,
        hidden: user && !hasPermission(Permission.MANAGE_REQUESTS),
        hasNotifyUser: false,
      },
    ];

    const filteredTypes = types.filter(
      (type) => !type.hidden && hasNotificationType(type.value, enabledTypes)
    );

    const newAllowedTypes = filteredTypes.reduce((a, v) => a + v.value, 0);
    if (newAllowedTypes !== allowedTypes) {
      setAllowedTypes(newAllowedTypes);
    }

    return user
      ? sortBy(filteredTypes, 'hasNotifyUser', 'DESC')
      : filteredTypes;
  }, [user, hasPermission, intl, allowedTypes, enabledTypes]);

  if (!availableTypes.length) {
    return null;
  }

  return (
    <div role="group" aria-labelledby="group-label" className="form-group">
      <div className="form-row">
        <span id="group-label" className="group-label">
          {intl.formatMessage(messages.notificationTypes)}
          {!user && <span className="label-required">*</span>}
        </span>
        <div className="form-input-area">
          <div className="max-w-lg">
            {availableTypes.map((type) => (
              <NotificationType
                key={`notification-type-${type.id}`}
                option={type}
                currentTypes={currentTypes}
                onUpdate={onUpdate}
              />
            ))}
          </div>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    </div>
  );
};

export default NotificationTypeSelector;
