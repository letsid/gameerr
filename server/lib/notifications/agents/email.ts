import { getRepository } from '@server/datasource';
import { User } from '@server/entity/User';
import { defineMessages, getIntl } from '@server/i18n';
import PreparedEmail from '@server/lib/email';
import type { NotificationAgentEmail } from '@server/lib/settings';
import { NotificationAgentKey, getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import type { AvailableLocale } from '@server/types/languages';
import type { EmailOptions } from 'email-templates';
import path from 'path';
import validator from 'validator';
import { Notification, shouldSendAdminNotification } from '..';
import type { NotificationAgent, NotificationPayload } from './agent';
import { BaseAgent } from './agent';

const PUBLIC_LOGO_URL =
  'https://raw.githubusercontent.com/letsid/gameerr/refs/heads/gameerr/public/logo_full.svg';

const messages = defineMessages('notifications.agents.email', {
  pendingRequest: 'A new request for the following game is pending approval:',
  approvedRequest: 'Your request for the following game has been approved:',
  autoApproved:
    'A new request for the following game has been automatically approved:',
  availableRequest: 'Your request for the following game is now available:',
  declinedRequest: 'Your request for the following game was declined:',
  failedRequest:
    'A request for the following game could not be handed over to {service}:',
  fulfillmentRequest:
    'The following approved game request needs to be fulfilled manually:',
});

class EmailAgent
  extends BaseAgent<NotificationAgentEmail>
  implements NotificationAgent
{
  protected getSettings(): NotificationAgentEmail {
    if (this.settings) {
      return this.settings;
    }

    const settings = getSettings();

    return settings.notifications.agents.email;
  }

  public shouldSend(): boolean {
    const settings = this.getSettings();

    if (
      settings.enabled &&
      settings.options.emailFrom &&
      settings.options.smtpHost &&
      settings.options.smtpPort
    ) {
      return true;
    }

    return false;
  }

  private buildMessage(
    type: Notification,
    payload: NotificationPayload,
    recipientEmail: string,
    recipientName?: string,
    locale?: AvailableLocale
  ): EmailOptions | undefined {
    const intl = getIntl(locale);
    const settings = getSettings();
    const { applicationUrl, applicationTitle } = settings.main;
    const { embedPoster } = settings.notifications.agents.email;
    const { usePublicLogo } = settings.notifications.agents.email.options;
    const logoUrl = usePublicLogo
      ? PUBLIC_LOGO_URL
      : applicationUrl
        ? `${applicationUrl}/logo_full.svg`
        : undefined;

    if (type === Notification.TEST_NOTIFICATION) {
      return {
        template: path.join(__dirname, '../../../templates/email/test-email'),
        message: {
          to: recipientEmail,
        },
        locals: {
          body: payload.message,
          applicationUrl,
          applicationTitle,
          logoUrl,
          recipientName,
          recipientEmail,
        },
      };
    }

    if (payload.request) {
      let body = '';

      switch (type) {
        case Notification.MEDIA_PENDING:
          body = intl.formatMessage(messages.pendingRequest);
          break;
        case Notification.MEDIA_APPROVED:
          body = intl.formatMessage(messages.approvedRequest);
          break;
        case Notification.MEDIA_AUTO_APPROVED:
          body = intl.formatMessage(messages.autoApproved);
          break;
        case Notification.MEDIA_AVAILABLE:
          body = intl.formatMessage(messages.availableRequest);
          break;
        case Notification.MEDIA_DECLINED:
          body = intl.formatMessage(messages.declinedRequest);
          break;
        case Notification.MEDIA_FAILED:
          body = intl.formatMessage(messages.failedRequest, {
            service: payload.fulfillmentProvider ?? 'the fulfillment provider',
          });
          break;
        case Notification.MEDIA_FULFILLMENT:
          body = intl.formatMessage(messages.fulfillmentRequest);
          break;
      }

      return {
        template: path.join(
          __dirname,
          '../../../templates/email/media-request'
        ),
        message: {
          to: recipientEmail,
        },
        locals: {
          event: payload.event,
          body,
          mediaName: payload.subject,
          mediaExtra: payload.extra ?? [],
          imageUrl: embedPoster ? payload.image : undefined,
          timestamp: new Date().toTimeString(),
          requestedBy: payload.request.requestedBy.displayName,
          actionUrl: applicationUrl
            ? `${applicationUrl}/game/${payload.media?.igdbId}`
            : undefined,
          applicationUrl,
          applicationTitle,
          logoUrl,
          recipientName,
          recipientEmail,
        },
      };
    }

    return undefined;
  }

  public async send(
    type: Notification,
    payload: NotificationPayload
  ): Promise<boolean> {
    if (payload.notifyUser) {
      if (
        !payload.notifyUser.settings ||
        (payload.notifyUser.settings.hasNotificationType(
          NotificationAgentKey.EMAIL,
          type
        ) ??
          true)
      ) {
        logger.debug('Sending email notification', {
          label: 'Notifications',
          recipient: payload.notifyUser.displayName,
          type: Notification[type],
          subject: payload.subject,
        });

        try {
          const email = new PreparedEmail(
            this.getSettings(),
            payload.notifyUser.settings?.pgpKey
          );
          if (
            validator.isEmail(payload.notifyUser.email, { require_tld: false })
          ) {
            await email.send(
              this.buildMessage(
                type,
                payload,
                payload.notifyUser.email,
                payload.notifyUser.displayName,
                payload.notifyUser.settings?.locale as AvailableLocale
              )
            );
          } else {
            logger.warn('Invalid email address provided for user', {
              label: 'Notifications',
              recipient: payload.notifyUser.displayName,
              type: Notification[type],
              subject: payload.subject,
            });
          }
        } catch (e) {
          logger.error('Error sending email notification', {
            label: 'Notifications',
            recipient: payload.notifyUser.displayName,
            type: Notification[type],
            subject: payload.subject,
            errorMessage: e.message,
          });

          return false;
        }
      }
    }

    if (payload.notifyAdmin) {
      const userRepository = getRepository(User);
      const users = await userRepository.find();

      await Promise.all(
        users
          .filter(
            (user) =>
              (!user.settings ||
                (user.settings.hasNotificationType(
                  NotificationAgentKey.EMAIL,
                  type
                ) ??
                  true)) &&
              shouldSendAdminNotification(type, user, payload)
          )
          .map(async (user) => {
            logger.debug('Sending email notification', {
              label: 'Notifications',
              recipient: user.displayName,
              type: Notification[type],
              subject: payload.subject,
            });

            try {
              const email = new PreparedEmail(
                this.getSettings(),
                user.settings?.pgpKey
              );
              if (validator.isEmail(user.email, { require_tld: false })) {
                await email.send(
                  this.buildMessage(
                    type,
                    payload,
                    user.email,
                    user.displayName,
                    user.settings?.locale as AvailableLocale
                  )
                );
              } else {
                logger.warn('Invalid email address provided for user', {
                  label: 'Notifications',
                  recipient: user.displayName,
                  type: Notification[type],
                  subject: payload.subject,
                });
              }
            } catch (e) {
              logger.error('Error sending email notification', {
                label: 'Notifications',
                recipient: user.displayName,
                type: Notification[type],
                subject: payload.subject,
                errorMessage: e.message,
              });

              return false;
            }
          })
      );
    }

    return true;
  }
}

export default EmailAgent;
