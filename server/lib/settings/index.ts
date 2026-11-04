import { MediaServerType } from '@server/constants/server';
import { Permission } from '@server/lib/permissions';
import { runMigrations } from '@server/lib/settings/migrator';
import type { AvailableLocale } from '@server/types/languages';
import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs/promises';
import { mergeWith } from 'lodash';
import path from 'path';
import webpush from 'web-push';

// Prevents stale array entries when incoming data has fewer elements
const mergeSettings = <T>(current: T, incoming: Partial<T>): T =>
  mergeWith({}, current, incoming, (_objValue, srcValue) =>
    Array.isArray(srcValue) ? srcValue : undefined
  ) as T;

export interface PlexSettings {
  name: string;
  machineId?: string;
  ip: string;
  port: number;
  useSsl?: boolean;
  webAppUrl?: string;
}

export interface JellyfinSettings {
  name: string;
  ip: string;
  port: number;
  useSsl?: boolean;
  urlBase?: string;
  externalHostname?: string;
  jellyfinForgotPasswordUrl?: string;
  serverId: string;
  apiKey: string;
}
interface Quota {
  quotaLimit?: number;
  quotaDays?: number;
}

export interface ProxySettings {
  enabled: boolean;
  hostname: string;
  port: number;
  useSsl: boolean;
  user: string;
  password: string;
  bypassFilter: string;
  bypassLocalAddresses: boolean;
}

export interface MainSettings {
  apiKey: string;
  applicationTitle: string;
  applicationUrl: string;
  cacheImages: boolean;
  defaultPermissions: number;
  defaultQuotas: {
    game: Quota;
  };
  hideAvailable: boolean;
  hideBlocklisted: boolean;
  hideRequested: boolean;
  localLogin: boolean;
  mediaServerLogin: boolean;
  newPlexLogin: boolean;
  mediaServerType: number;
  locale: string;
  versionCheck: boolean;
}

export interface ProxySettings {
  enabled: boolean;
  hostname: string;
  port: number;
  useSsl: boolean;
  user: string;
  password: string;
  bypassFilter: string;
  bypassLocalAddresses: boolean;
}

export interface DnsCacheSettings {
  enabled: boolean;
  forceMinTtl?: number;
  forceMaxTtl?: number;
}

export interface NetworkSettings {
  csrfProtection: boolean;
  forceIpv4First: boolean;
  trustProxy: boolean;
  proxy: ProxySettings;
  dnsCache: DnsCacheSettings;
  apiRequestTimeout: number;
}

/**
 * Metadata sources and discover defaults. API credentials may also be
 * supplied through the environment, which takes precedence (see
 * getMetadataCredentials).
 */
export interface MetadataSettings {
  igdbClientId: string;
  igdbClientSecret: string;
  rawgApiKey: string;
  rapidApiKey: string;
  /**
   * IGDB platform ids used when a user has not picked their own
   */
  defaultPlatforms: number[];
  /**
   * Minimum number of IGDB ratings before a game can enter score based lists
   */
  minRatingCount: number;
  recentReleaseDays: number;
  upcomingReleaseDays: number;
  /**
   * A game only enters a platform's best list when it came to that platform
   * at most this many years after its first release. Keeps re-releases such
   * as PS one Classics out of PS3 lists. 0 turns the rule off.
   */
  bestReleaseGapYears: number;
}

export type FulfillmentProviderId = 'manual' | 'questarr';

export interface FulfillmentSettings {
  // Backend approved requests are handed to. Questarr only takes PC, Linux
  // and Mac games, requests for other platforms stay manual.
  provider: FulfillmentProviderId;
  questarrUrl: string;
  questarrApiKey: string;
}

export interface LibrarySettings {
  steamApiKey: string;
  // SteamID64 values whose public libraries count as owned games
  steamIds: string[];
}

interface PublicSettings {
  initialized: boolean;
}

interface FullPublicSettings extends PublicSettings {
  applicationTitle: string;
  applicationUrl: string;
  hideAvailable: boolean;
  hideBlocklisted: boolean;
  hideRequested: boolean;
  localLogin: boolean;
  mediaServerLogin: boolean;
  mediaServerType: number;
  jellyfinExternalHost?: string;
  jellyfinForgotPasswordUrl?: string;
  jellyfinServerName?: string;
  cacheImages: boolean;
  vapidPublic: string;
  enablePushRegistration: boolean;
  locale: string;
  emailEnabled: boolean;
  userEmailRequired: boolean;
  newPlexLogin: boolean;
  versionCheck: boolean;
  plexClientIdentifier: string;
  defaultPlatforms: number[];
  metadataConfigured: boolean;
}

export interface NotificationAgentConfig {
  enabled: boolean;
  embedPoster: boolean;
  types?: number;
  options: Record<string, unknown>;
}
export interface NotificationAgentDiscord extends NotificationAgentConfig {
  options: {
    botUsername?: string;
    botAvatarUrl?: string;
    webhookUrl: string;
    webhookRoleId?: string;
    webhookThreadId?: string;
    enableMentions: boolean;
    locale: AvailableLocale;
    useUserLocale: boolean;
  };
}

export interface NotificationAgentSlack extends NotificationAgentConfig {
  options: {
    webhookUrl: string;
    locale: AvailableLocale;
  };
}

export interface NotificationAgentEmail extends NotificationAgentConfig {
  options: {
    userEmailRequired: boolean;
    emailFrom: string;
    smtpHost: string;
    smtpPort: number;
    secure: boolean;
    ignoreTls: boolean;
    requireTls: boolean;
    authUser?: string;
    authPass?: string;
    allowSelfSigned: boolean;
    senderName: string;
    usePublicLogo: boolean;
    pgpPrivateKey?: string;
    pgpPassword?: string;
  };
}

export interface NotificationAgentTelegram extends NotificationAgentConfig {
  options: {
    botUsername?: string;
    botAPI: string;
    chatId: string;
    messageThreadId: string;
    sendSilently: boolean;
  };
}

export interface NotificationAgentPushbullet extends NotificationAgentConfig {
  options: {
    accessToken: string;
    channelTag?: string;
  };
}

export interface NotificationAgentPushover extends NotificationAgentConfig {
  options: {
    accessToken: string;
    userToken: string;
    sound: string;
  };
}

export interface NotificationAgentWebhook extends NotificationAgentConfig {
  options: {
    webhookUrl: string;
    jsonPayload: string;
    authHeader?: string;
    customHeaders?: { key: string; value: string }[];
    supportVariables?: boolean;
  };
}

export interface NotificationAgentGotify extends NotificationAgentConfig {
  options: {
    url: string;
    token: string;
    priority: number;
    locale: AvailableLocale;
  };
}

export interface NotificationAgentNtfy extends NotificationAgentConfig {
  options: {
    url: string;
    topic: string;
    tags?: string;
    authMethodUsernamePassword?: boolean;
    username?: string;
    password?: string;
    authMethodToken?: boolean;
    token?: string;
    priority?: number;
    locale: AvailableLocale;
  };
}

export enum NotificationAgentKey {
  DISCORD = 'discord',
  EMAIL = 'email',
  GOTIFY = 'gotify',
  NTFY = 'ntfy',
  PUSHBULLET = 'pushbullet',
  PUSHOVER = 'pushover',
  SLACK = 'slack',
  TELEGRAM = 'telegram',
  WEBHOOK = 'webhook',
  WEBPUSH = 'webpush',
}

interface NotificationAgents {
  discord: NotificationAgentDiscord;
  email: NotificationAgentEmail;
  gotify: NotificationAgentGotify;
  ntfy: NotificationAgentNtfy;
  pushbullet: NotificationAgentPushbullet;
  pushover: NotificationAgentPushover;
  slack: NotificationAgentSlack;
  telegram: NotificationAgentTelegram;
  webhook: NotificationAgentWebhook;
  webpush: NotificationAgentConfig;
}

interface NotificationSettings {
  agents: NotificationAgents;
}

interface JobSettings {
  schedule: string;
}

export type JobId =
  | 'plex-refresh-token'
  | 'image-cache-cleanup'
  | 'discover-lists-refresh'
  | 'library-sync'
  | 'fulfillment-sync';

export interface AllSettings {
  clientId: string;
  sessionSecret?: string;
  vapidPublic: string;
  vapidPrivate: string;
  main: MainSettings;
  plex: PlexSettings;
  jellyfin: JellyfinSettings;
  metadata: MetadataSettings;
  fulfillment: FulfillmentSettings;
  library: LibrarySettings;
  public: PublicSettings;
  notifications: NotificationSettings;
  jobs: Record<JobId, JobSettings>;
  network: NetworkSettings;
  migrations: string[];
}

export interface MetadataCredentials {
  igdbClientId: string;
  igdbClientSecret: string;
  rawgApiKey: string;
  rapidApiKey: string;
  questarrUrl: string;
  questarrApiKey: string;
  steamApiKey: string;
}

/**
 * Resolves API credentials, preferring environment variables over the
 * settings file so keys never have to be written to disk.
 */
export const getMetadataCredentials = (
  settings: Settings = getSettings()
): MetadataCredentials => {
  const metadata = settings.metadata;
  const env = process.env;

  return {
    igdbClientId: env.IGDB_CLIENT_ID || metadata.igdbClientId,
    igdbClientSecret: env.IGDB_CLIENT_SECRET || metadata.igdbClientSecret,
    rawgApiKey: env.RAWG_API_KEY || metadata.rawgApiKey,
    rapidApiKey: env.RAPIDAPI_KEY || metadata.rapidApiKey,
    questarrUrl: (env.QUESTARR_URL || settings.fulfillment.questarrUrl).replace(
      /\/+$/,
      ''
    ),
    questarrApiKey: env.QUESTARR_API_KEY || settings.fulfillment.questarrApiKey,
    steamApiKey: env.STEAM_API_KEY || settings.library.steamApiKey,
  };
};

const SETTINGS_PATH = process.env.CONFIG_DIRECTORY
  ? `${process.env.CONFIG_DIRECTORY}/settings.json`
  : path.join(__dirname, '../../../config/settings.json');

class Settings {
  private data: AllSettings;
  private saveLock: Promise<void> = Promise.resolve();

  constructor(initialSettings?: AllSettings) {
    this.data = {
      clientId: randomUUID(),
      sessionSecret: '',
      vapidPrivate: '',
      vapidPublic: '',
      main: {
        apiKey: '',
        applicationTitle: 'Gameerr',
        applicationUrl: '',
        cacheImages: false,
        defaultPermissions: Permission.REQUEST,
        defaultQuotas: {
          game: {},
        },
        hideAvailable: false,
        hideBlocklisted: false,
        hideRequested: false,
        localLogin: true,
        mediaServerLogin: true,
        newPlexLogin: true,
        mediaServerType: MediaServerType.NOT_CONFIGURED,
        locale: 'en',
        // Release checks point at upstream Seerr, which says nothing about this fork
        versionCheck: false,
      },
      plex: {
        name: '',
        ip: '',
        port: 32400,
        useSsl: false,
      },
      jellyfin: {
        name: '',
        ip: '',
        port: 8096,
        useSsl: false,
        urlBase: '',
        externalHostname: '',
        jellyfinForgotPasswordUrl: '',
        serverId: '',
        apiKey: '',
      },
      metadata: {
        igdbClientId: '',
        igdbClientSecret: '',
        rawgApiKey: '',
        rapidApiKey: '',
        // PC (Microsoft Windows)
        defaultPlatforms: [6],
        minRatingCount: 50,
        recentReleaseDays: 60,
        upcomingReleaseDays: 90,
        bestReleaseGapYears: 5,
      },
      fulfillment: {
        provider: 'manual',
        questarrUrl: '',
        questarrApiKey: '',
      },
      library: {
        steamApiKey: '',
        steamIds: [],
      },
      public: {
        initialized: false,
      },
      notifications: {
        agents: {
          email: {
            enabled: false,
            embedPoster: true,
            options: {
              userEmailRequired: false,
              emailFrom: '',
              smtpHost: '',
              smtpPort: 587,
              secure: false,
              ignoreTls: false,
              requireTls: false,
              allowSelfSigned: false,
              senderName: 'Gameerr',
              usePublicLogo: false,
            },
          },
          discord: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
              webhookRoleId: '',
              enableMentions: true,
              locale: 'en',
              useUserLocale: true,
            },
          },
          slack: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
              locale: 'en',
            },
          },
          telegram: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              botAPI: '',
              chatId: '',
              messageThreadId: '',
              sendSilently: false,
            },
          },
          pushbullet: {
            enabled: false,
            embedPoster: false,
            types: 0,
            options: {
              accessToken: '',
            },
          },
          pushover: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              accessToken: '',
              userToken: '',
              sound: '',
            },
          },
          webhook: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              webhookUrl: '',
              jsonPayload:
                'IntcbiAgXCJub3RpZmljYXRpb25fdHlwZVwiOiBcInt7bm90aWZpY2F0aW9uX3R5cGV9fVwiLFxuICBcImV2ZW50XCI6IFwie3tldmVudH19XCIsXG4gIFwic3ViamVjdFwiOiBcInt7c3ViamVjdH19XCIsXG4gIFwibWVzc2FnZVwiOiBcInt7bWVzc2FnZX19XCIsXG4gIFwiaW1hZ2VcIjogXCJ7e2ltYWdlfX1cIixcbiAgXCJ7e21lZGlhfX1cIjoge1xuICAgIFwibWVkaWFfdHlwZVwiOiBcInt7bWVkaWFfdHlwZX19XCIsXG4gICAgXCJpZ2RiSWRcIjogXCJ7e21lZGlhX2lnZGJpZH19XCIsXG4gICAgXCJzdGVhbUFwcElkXCI6IFwie3ttZWRpYV9zdGVhbWFwcGlkfX1cIixcbiAgICBcInN0YXR1c1wiOiBcInt7bWVkaWFfc3RhdHVzfX1cIlxuICB9LFxuICBcInt7cmVxdWVzdH19XCI6IHtcbiAgICBcInJlcXVlc3RfaWRcIjogXCJ7e3JlcXVlc3RfaWR9fVwiLFxuICAgIFwicGxhdGZvcm1cIjogXCJ7e3JlcXVlc3RfcGxhdGZvcm19fVwiLFxuICAgIFwicmVxdWVzdGVkQnlfZW1haWxcIjogXCJ7e3JlcXVlc3RlZEJ5X2VtYWlsfX1cIixcbiAgICBcInJlcXVlc3RlZEJ5X3VzZXJuYW1lXCI6IFwie3tyZXF1ZXN0ZWRCeV91c2VybmFtZX19XCIsXG4gICAgXCJyZXF1ZXN0ZWRCeV9hdmF0YXJcIjogXCJ7e3JlcXVlc3RlZEJ5X2F2YXRhcn19XCIsXG4gICAgXCJyZXF1ZXN0ZWRCeV9zZXR0aW5nc19kaXNjb3JkSWRcIjogXCJ7e3JlcXVlc3RlZEJ5X3NldHRpbmdzX2Rpc2NvcmRJZH19XCIsXG4gICAgXCJyZXF1ZXN0ZWRCeV9zZXR0aW5nc190ZWxlZ3JhbUNoYXRJZFwiOiBcInt7cmVxdWVzdGVkQnlfc2V0dGluZ3NfdGVsZWdyYW1DaGF0SWR9fVwiXG4gIH0sXG4gIFwie3tleHRyYX19XCI6IFtdXG59Ig==',
            },
          },
          webpush: {
            enabled: false,
            embedPoster: true,
            options: {},
          },
          gotify: {
            enabled: false,
            embedPoster: false,
            types: 0,
            options: {
              url: '',
              token: '',
              priority: 0,
              locale: 'en',
            },
          },
          ntfy: {
            enabled: false,
            embedPoster: true,
            types: 0,
            options: {
              url: '',
              topic: '',
              tags: '',
              priority: 3,
              locale: 'en',
            },
          },
        },
      },
      jobs: {
        'plex-refresh-token': {
          schedule: '0 0 5 * * *',
        },
        'image-cache-cleanup': {
          schedule: '0 0 5 * * *',
        },
        'discover-lists-refresh': {
          schedule: '0 30 3 * * *',
        },
        'library-sync': {
          schedule: '0 15 */6 * * *',
        },
        'fulfillment-sync': {
          schedule: '0 */5 * * * *',
        },
      },
      network: {
        csrfProtection: false,
        forceIpv4First: false,
        trustProxy: false,
        proxy: {
          enabled: false,
          hostname: '',
          port: 8080,
          useSsl: false,
          user: '',
          password: '',
          bypassFilter: '',
          bypassLocalAddresses: true,
        },
        dnsCache: {
          enabled: false,
          forceMinTtl: 0,
          forceMaxTtl: -1,
        },
        apiRequestTimeout: 10000,
      },
      migrations: [],
    };
    if (initialSettings) {
      this.data = mergeSettings(this.data, initialSettings);
    }
  }

  get main(): MainSettings {
    return this.data.main;
  }

  set main(data: MainSettings) {
    this.data.main = mergeSettings(this.data.main, data);
  }

  get plex(): PlexSettings {
    return this.data.plex;
  }

  set plex(data: PlexSettings) {
    this.data.plex = mergeSettings(this.data.plex, data);
  }

  get jellyfin(): JellyfinSettings {
    return this.data.jellyfin;
  }

  set jellyfin(data: JellyfinSettings) {
    this.data.jellyfin = mergeSettings(this.data.jellyfin, data);
  }

  get metadata(): MetadataSettings {
    return this.data.metadata;
  }

  set metadata(data: MetadataSettings) {
    this.data.metadata = mergeSettings(this.data.metadata, data);
  }

  get fulfillment(): FulfillmentSettings {
    return this.data.fulfillment;
  }

  set fulfillment(data: FulfillmentSettings) {
    this.data.fulfillment = mergeSettings(this.data.fulfillment, data);
  }

  get library(): LibrarySettings {
    return this.data.library;
  }

  set library(data: LibrarySettings) {
    this.data.library = mergeSettings(this.data.library, data);
  }

  get public(): PublicSettings {
    return this.data.public;
  }

  set public(data: PublicSettings) {
    this.data.public = mergeSettings(this.data.public, data);
  }

  get fullPublicSettings(): FullPublicSettings {
    return {
      ...this.data.public,
      applicationTitle: this.data.main.applicationTitle,
      applicationUrl: this.data.main.applicationUrl,
      hideAvailable: this.data.main.hideAvailable,
      hideBlocklisted: this.data.main.hideBlocklisted,
      hideRequested: this.data.main.hideRequested,
      localLogin: this.data.main.localLogin,
      mediaServerLogin: this.data.main.mediaServerLogin,
      jellyfinExternalHost: this.data.jellyfin.externalHostname,
      jellyfinForgotPasswordUrl: this.data.jellyfin.jellyfinForgotPasswordUrl,
      mediaServerType: this.main.mediaServerType,
      cacheImages: this.data.main.cacheImages,
      vapidPublic: this.vapidPublic,
      enablePushRegistration: this.data.notifications.agents.webpush.enabled,
      locale: this.data.main.locale,
      emailEnabled: this.data.notifications.agents.email.enabled,
      userEmailRequired:
        this.data.notifications.agents.email.options.userEmailRequired,
      newPlexLogin: this.data.main.newPlexLogin,
      versionCheck: this.data.main.versionCheck,
      plexClientIdentifier: this.data.clientId,
      defaultPlatforms: this.data.metadata.defaultPlatforms,
      metadataConfigured: !!getMetadataCredentials(this).igdbClientId,
    };
  }

  get notifications(): NotificationSettings {
    return this.data.notifications;
  }

  set notifications(data: NotificationSettings) {
    this.data.notifications = mergeSettings(this.data.notifications, data);
  }

  get jobs(): Record<JobId, JobSettings> {
    return this.data.jobs;
  }

  set jobs(data: Record<JobId, JobSettings>) {
    this.data.jobs = mergeSettings(this.data.jobs, data);
  }

  get network(): NetworkSettings {
    return this.data.network;
  }

  set network(data: NetworkSettings) {
    this.data.network = mergeSettings(this.data.network, data);
  }

  get migrations(): string[] {
    return this.data.migrations;
  }

  set migrations(data: string[]) {
    this.data.migrations = data;
  }

  get clientId(): string {
    return this.data.clientId;
  }

  get sessionSecret(): string {
    return this.data.sessionSecret!;
  }

  get vapidPublic(): string {
    return this.data.vapidPublic;
  }

  get vapidPrivate(): string {
    return this.data.vapidPrivate;
  }

  public async regenerateApiKey(): Promise<MainSettings> {
    this.main.apiKey = this.generateApiKey();
    await this.save();
    return this.main;
  }

  private generateApiKey(): string {
    if (process.env.API_KEY) {
      return process.env.API_KEY;
    } else {
      return Buffer.from(`${Date.now()}${randomUUID()}`).toString('base64');
    }
  }

  /**
   * Settings Load
   *
   * This will load settings from file unless an optional argument of the object structure
   * is passed in.
   * @param overrideSettings If passed in, will override all existing settings with these
   * @param raw If true, will load the settings without running migrations or generating missing
   * values
   */
  public async load(
    overrideSettings?: AllSettings,
    raw = false
  ): Promise<Settings> {
    if (overrideSettings) {
      this.data = overrideSettings;
      return this;
    }

    let data;
    try {
      data = await fs.readFile(SETTINGS_PATH, 'utf-8');
    } catch {
      await this.save();
    }

    let change = false;
    if (data && !raw) {
      const parsedJson = JSON.parse(data);
      const migratedData = await runMigrations(parsedJson, SETTINGS_PATH);
      const merged = mergeSettings(this.data, migratedData);

      if (JSON.stringify(merged) !== JSON.stringify(migratedData)) {
        change = true;
      }

      this.data = merged;
    } else if (data) {
      this.data = JSON.parse(data);
    }

    // generate keys and ids if it's missing
    if (!this.data.main.apiKey) {
      this.data.main.apiKey = this.generateApiKey();
      change = true;
    } else if (process.env.API_KEY) {
      if (this.main.apiKey != process.env.API_KEY) {
        this.main.apiKey = process.env.API_KEY;
      }
    }
    if (!this.data.clientId) {
      this.data.clientId = randomUUID();
      change = true;
    }
    if (!this.data.sessionSecret) {
      this.data.sessionSecret = randomBytes(32).toString('hex');
      change = true;
    }
    if (!this.data.vapidPublic || !this.data.vapidPrivate) {
      const vapidKeys = webpush.generateVAPIDKeys();
      this.data.vapidPrivate = vapidKeys.privateKey;
      this.data.vapidPublic = vapidKeys.publicKey;
      change = true;
    }
    if (change) {
      await this.save();
    }

    return this;
  }

  public async save(): Promise<void> {
    const savePromise = this.saveLock.then(async () => {
      const tmp = SETTINGS_PATH + '.tmp';
      await fs.writeFile(tmp, JSON.stringify(this.data, undefined, ' '));
      await fs.rename(tmp, SETTINGS_PATH);
    });

    this.saveLock = savePromise.catch(() => {
      // Keep the chain alive so future saves aren't blocked by past failures
    });

    return savePromise;
  }
}

let settings: Settings | undefined;

export const getSettings = (initialSettings?: AllSettings): Settings => {
  if (!settings) {
    settings = new Settings(initialSettings);
  }

  return settings;
};

export default Settings;
