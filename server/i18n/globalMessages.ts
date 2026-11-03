import { defineMessages } from '@server/i18n';

const globalMessages = defineMessages('notifications.common', {
  requestedBy: 'Requested By',
  requestStatus: 'Request Status',
  pendingApproval: 'Pending Approval',
  processing: 'Processing',
  available: 'Available',
  declined: 'Declined',
  failed: 'Failed',
  viewMedia: 'View Game in {applicationTitle}',
  openIn: 'Open in {applicationTitle}',
});

export default globalMessages;
