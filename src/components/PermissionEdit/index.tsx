import type { PermissionItem } from '@app/components/PermissionOption';
import PermissionOption from '@app/components/PermissionOption';
import type { User } from '@app/hooks/useUser';
import { Permission } from '@app/hooks/useUser';
import defineMessages from '@app/utils/defineMessages';
import { useIntl } from 'react-intl';

export const messages = defineMessages('components.PermissionEdit', {
  admin: 'Admin',
  adminDescription:
    'Full administrator access. Bypasses all other permission checks.',
  users: 'Manage Users',
  usersDescription:
    'Grant permission to manage users. Users with this permission cannot modify users with or grant the Admin privilege.',
  managerequests: 'Manage Requests',
  managerequestsDescription:
    'Grant permission to manage game requests. All requests made by a user with this permission will be automatically approved.',
  request: 'Request',
  requestDescription: 'Grant permission to submit game requests.',
  autoapprove: 'Auto-Approve',
  autoapproveDescription: 'Grant automatic approval for all game requests.',
  viewrequests: 'View Requests',
  viewrequestsDescription:
    'Grant permission to view game requests submitted by other users.',
  viewrecent: 'View Recently Added',
  viewrecentDescription:
    'Grant permission to view the list of recently added games.',
  viewwatchlists: 'View Watchlists',
  viewwatchlistsDescription:
    "Grant permission to view other users' watchlists.",
  manageblocklist: 'Manage Blocklist',
  manageblocklistDescription: 'Grant permission to manage blocklisted games.',
  viewblocklistedItems: 'View blocklisted games.',
  viewblocklistedItemsDescription:
    'Grant permission to view blocklisted games.',
});

interface PermissionEditProps {
  actingUser?: User;
  currentUser?: User;
  currentPermission: number;
  onUpdate: (newPermissions: number) => void;
}

export const PermissionEdit = ({
  actingUser,
  currentUser,
  currentPermission,
  onUpdate,
}: PermissionEditProps) => {
  const intl = useIntl();

  const permissionList: PermissionItem[] = [
    {
      id: 'admin',
      name: intl.formatMessage(messages.admin),
      description: intl.formatMessage(messages.adminDescription),
      permission: Permission.ADMIN,
    },
    {
      id: 'users',
      name: intl.formatMessage(messages.users),
      description: intl.formatMessage(messages.usersDescription),
      permission: Permission.MANAGE_USERS,
    },
    {
      id: 'managerequest',
      name: intl.formatMessage(messages.managerequests),
      description: intl.formatMessage(messages.managerequestsDescription),
      permission: Permission.MANAGE_REQUESTS,
      children: [
        {
          id: 'viewrequests',
          name: intl.formatMessage(messages.viewrequests),
          description: intl.formatMessage(messages.viewrequestsDescription),
          permission: Permission.REQUEST_VIEW,
        },
        {
          id: 'viewrecent',
          name: intl.formatMessage(messages.viewrecent),
          description: intl.formatMessage(messages.viewrecentDescription),
          permission: Permission.RECENT_VIEW,
        },
        {
          id: 'viewwatchlists',
          name: intl.formatMessage(messages.viewwatchlists),
          description: intl.formatMessage(messages.viewwatchlistsDescription),
          permission: Permission.WATCHLIST_VIEW,
        },
      ],
    },
    {
      id: 'request',
      name: intl.formatMessage(messages.request),
      description: intl.formatMessage(messages.requestDescription),
      permission: Permission.REQUEST,
    },
    {
      id: 'autoapprove',
      name: intl.formatMessage(messages.autoapprove),
      description: intl.formatMessage(messages.autoapproveDescription),
      permission: Permission.AUTO_APPROVE,
      requires: [{ permissions: [Permission.REQUEST] }],
    },
    {
      id: 'manageblocklist',
      name: intl.formatMessage(messages.manageblocklist),
      description: intl.formatMessage(messages.manageblocklistDescription),
      permission: Permission.MANAGE_BLOCKLIST,
      children: [
        {
          id: 'viewblocklisteditems',
          name: intl.formatMessage(messages.viewblocklistedItems),
          description: intl.formatMessage(
            messages.viewblocklistedItemsDescription
          ),
          permission: Permission.VIEW_BLOCKLIST,
        },
      ],
    },
  ];

  return (
    <>
      {permissionList.map((permissionItem) => (
        <PermissionOption
          key={`permission-option-${permissionItem.id}`}
          option={permissionItem}
          actingUser={actingUser}
          currentUser={currentUser}
          currentPermission={currentPermission}
          onUpdate={(newPermission) => onUpdate(newPermission)}
        />
      ))}
    </>
  );
};

export default PermissionEdit;
