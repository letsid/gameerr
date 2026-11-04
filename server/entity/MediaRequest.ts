import { igdbImageUrl } from '@server/api/igdb/images';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import type { MediaRequestBody } from '@server/interfaces/api/requestInterfaces';
import notificationManager, { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import requestLock, {
  mediaKey,
  mediaLock,
  userKey,
} from '@server/utils/requestLock';
import { truncate } from 'lodash';
import {
  AfterInsert,
  AfterUpdate,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import Media from './Media';
import { User } from './User';

/**
 * Display name of an IGDB platform for notifications, from the cached
 * platform list. Notifications still go out when IGDB is unavailable.
 */
const platformName = async (id: number): Promise<string | undefined> => {
  try {
    const { getPlatforms } = await import('@server/lib/platforms');
    return (await getPlatforms()).find((platform) => platform.id === id)?.name;
  } catch {
    return undefined;
  }
};

export class RequestPermissionError extends Error {}
export class QuotaRestrictedError extends Error {}
export class DuplicateMediaRequestError extends Error {}
export class BlocklistedMediaError extends Error {}
export class InvalidPlatformError extends Error {}
export class AlreadyOwnedError extends Error {}

/**
 * Game data resolved by the caller (from the metadata layer) before a
 * request is created. Used to validate the platform and to keep the
 * denormalized fields on the media row fresh.
 */
export interface RequestGameInfo {
  title: string;
  summary?: string;
  coverImageId?: string;
  platforms: number[];
  steamAppId?: number;
  releaseYear?: number;
}

@Entity()
export class MediaRequest {
  public static async request(
    requestBody: MediaRequestBody,
    user: User,
    game?: RequestGameInfo
  ): Promise<MediaRequest> {
    // Only a caller allowed to set the request user may queue on their lock
    const lockUserId =
      requestBody.userId &&
      user.hasPermission([Permission.MANAGE_USERS, Permission.MANAGE_REQUESTS])
        ? requestBody.userId
        : user.id;

    return requestLock.dispatch(userKey(lockUserId), () =>
      mediaLock.dispatch(mediaKey(MediaType.GAME, requestBody.igdbId), () =>
        MediaRequest.createRequest(requestBody, user, game)
      )
    );
  }

  private static async createRequest(
    requestBody: MediaRequestBody,
    user: User,
    game?: RequestGameInfo
  ): Promise<MediaRequest> {
    const mediaRepository = getRepository(Media);
    const requestRepository = getRepository(MediaRequest);
    const userRepository = getRepository(User);

    let requestUser = user;

    if (
      requestBody.userId &&
      !requestUser.hasPermission([
        Permission.MANAGE_USERS,
        Permission.MANAGE_REQUESTS,
      ])
    ) {
      throw new RequestPermissionError(
        'You do not have permission to modify the request user.'
      );
    } else if (requestBody.userId) {
      requestUser = await userRepository.findOneOrFail({
        where: { id: requestBody.userId },
      });
    }

    if (!requestUser) {
      throw new Error('User missing from request context.');
    }

    if (!requestUser.hasPermission(Permission.REQUEST)) {
      throw new RequestPermissionError(
        'You do not have permission to make game requests.'
      );
    }

    if (game && !game.platforms.includes(requestBody.platform)) {
      throw new InvalidPlatformError(
        'The game is not available for the requested platform.'
      );
    }

    const { isOwnedOnPlatform } = await import('@server/lib/library');
    if (await isOwnedOnPlatform(requestBody.igdbId, requestBody.platform)) {
      throw new AlreadyOwnedError(
        'The game is already in the library for this platform.'
      );
    }

    const quotas = await requestUser.getQuota();

    const canBypassQuota = user.hasPermission(Permission.MANAGE_REQUESTS);
    const ignoreQuota =
      requestBody.ignoreQuota === true &&
      canBypassQuota &&
      (quotas.game.limit ?? 0) > 0;

    if (!ignoreQuota) {
      if (requestBody.ignoreQuota && !canBypassQuota) {
        throw new RequestPermissionError(
          'You do not have permission to bypass user quota limits.'
        );
      } else if (quotas.game.restricted) {
        throw new QuotaRestrictedError('Game quota exceeded.');
      }
    }

    let media = await mediaRepository.findOne({
      where: { igdbId: requestBody.igdbId },
    });

    if (!media) {
      media = new Media({
        igdbId: requestBody.igdbId,
        mediaType: MediaType.GAME,
        status: MediaStatus.PENDING,
      });
    } else {
      if (media.status === MediaStatus.BLOCKLISTED) {
        logger.warn('Request for media blocked due to being blocklisted', {
          igdbId: requestBody.igdbId,
          label: 'Media Request',
        });

        throw new BlocklistedMediaError('This game is blocklisted.');
      }

      if (
        media.status === MediaStatus.UNKNOWN ||
        media.status === MediaStatus.DELETED
      ) {
        media.status = MediaStatus.PENDING;
      }
    }

    if (game) {
      media.title = game.title;
      media.coverImageId = game.coverImageId ?? null;
      media.platforms = game.platforms;
      media.steamAppId = game.steamAppId ?? media.steamAppId ?? null;
    }

    const existing = await requestRepository
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.media', 'media')
      .where('media.igdbId = :igdbId', { igdbId: requestBody.igdbId })
      .andWhere('request.platform = :platform', {
        platform: requestBody.platform,
      })
      .andWhere('request.status NOT IN (:...statuses)', {
        statuses: [MediaRequestStatus.DECLINED, MediaRequestStatus.COMPLETED],
      })
      .getCount();

    if (existing > 0) {
      logger.warn('Duplicate request for media blocked', {
        igdbId: requestBody.igdbId,
        platform: requestBody.platform,
        label: 'Media Request',
      });

      throw new DuplicateMediaRequestError(
        'A request for this game and platform already exists.'
      );
    }

    await mediaRepository.save(media);

    const autoApprove = user.hasPermission(
      [Permission.AUTO_APPROVE, Permission.MANAGE_REQUESTS],
      { type: 'or' }
    );

    const request = new MediaRequest({
      type: MediaType.GAME,
      media,
      platform: requestBody.platform,
      requestedBy: requestUser,
      // If the user is an admin or has the "auto approve" permission, automatically approve the request
      status: autoApprove
        ? MediaRequestStatus.APPROVED
        : MediaRequestStatus.PENDING,
      modifiedBy: autoApprove ? user : undefined,
      ignoreQuota,
    });

    await requestRepository.save(request);
    return request;
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  @Index()
  public status: MediaRequestStatus;

  @ManyToOne(() => Media, (media) => media.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public media: Media;

  @ManyToOne(() => User, (user) => user.requests, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public requestedBy: User;

  @ManyToOne(() => User, {
    nullable: true,
    eager: true,
    onDelete: 'SET NULL',
  })
  @Index()
  public modifiedBy?: User;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  @Column({ type: 'varchar', default: MediaType.GAME })
  public type: MediaType;

  /**
   * IGDB platform id the game was requested for
   */
  @Column({ type: 'integer' })
  @Index()
  public platform: number;

  @Column({ default: false })
  public ignoreQuota: boolean;

  /**
   * Fulfillment backend the request was handed to, e.g. manual or questarr
   */
  @Column({ type: 'varchar', nullable: true })
  @Index()
  public fulfillmentProvider?: string | null;

  /**
   * Last state the backend reported, in its own words
   */
  @Column({ type: 'varchar', nullable: true })
  public fulfillmentState?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public fulfillmentMessage?: string | null;

  @DbAwareColumn({ type: 'datetime', nullable: true })
  public fulfillmentCheckedAt?: Date | null;

  constructor(init?: Partial<MediaRequest>) {
    Object.assign(this, init);
  }

  @AfterInsert()
  public async notifyNewRequest(): Promise<void> {
    if (this.status === MediaRequestStatus.PENDING) {
      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOne({
        where: { id: this.media.id },
      });
      if (!media) {
        logger.error('Media data not found', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
        return;
      }

      MediaRequest.sendNotification(this, media, Notification.MEDIA_PENDING);
    }
  }

  /**
   * Notification for approval
   *
   * We only check on AfterUpdate as to not trigger this for
   * auto approved content
   */
  @AfterUpdate()
  public async notifyApprovedOrDeclined(autoApproved = false): Promise<void> {
    if (
      this.status === MediaRequestStatus.APPROVED ||
      this.status === MediaRequestStatus.DECLINED
    ) {
      const mediaRepository = getRepository(Media);
      const media = await mediaRepository.findOne({
        where: { id: this.media.id },
      });
      if (!media) {
        logger.error('Media data not found', {
          label: 'Media Request',
          requestId: this.id,
          mediaId: this.media.id,
        });
        return;
      }

      // No shortcut to "available" here: availability is tracked per game,
      // so a game available on one platform still needs the requested one

      MediaRequest.sendNotification(
        this,
        media,
        this.status === MediaRequestStatus.APPROVED
          ? autoApproved
            ? Notification.MEDIA_AUTO_APPROVED
            : Notification.MEDIA_APPROVED
          : Notification.MEDIA_DECLINED
      );
    }
  }

  @AfterInsert()
  public async autoapprovalNotification(): Promise<void> {
    if (this.status === MediaRequestStatus.APPROVED) {
      this.notifyApprovedOrDeclined(true);
    }
  }

  static async sendNotification(
    entity: MediaRequest,
    media: Media,
    type: Notification,
    extra: { name: string; value: string }[] = []
  ) {
    try {
      let event: string | undefined;
      let notifyAdmin = true;
      let notifySystem = true;

      switch (type) {
        case Notification.MEDIA_AVAILABLE:
          event = 'Game Now Available';
          notifyAdmin = false;
          break;
        case Notification.MEDIA_APPROVED:
          event = 'Game Request Approved';
          notifyAdmin = false;
          break;
        case Notification.MEDIA_DECLINED:
          event = 'Game Request Declined';
          notifyAdmin = false;
          break;
        case Notification.MEDIA_PENDING:
          event = 'New Game Request';
          break;
        case Notification.MEDIA_AUTO_APPROVED:
          event = 'Game Request Automatically Approved';
          break;
        case Notification.MEDIA_FAILED:
          event = 'Game Request Failed';
          break;
        case Notification.MEDIA_FULFILLMENT:
          event = 'Game Request Needs Fulfillment';
          notifySystem = true;
          break;
      }

      notificationManager.sendNotification(type, {
        media,
        request: entity,
        notifyAdmin,
        notifySystem,
        notifyUser: notifyAdmin ? undefined : entity.requestedBy,
        event,
        subject: media.title ?? `IGDB #${media.igdbId}`,
        message: entity.summary
          ? truncate(entity.summary, {
              length: 500,
              separator: /\s/,
              omission: '…',
            })
          : undefined,
        image: media.coverImageId
          ? igdbImageUrl(media.coverImageId, 'cover_big')
          : undefined,
        extra: [
          {
            name: 'Platform',
            value:
              entity.platformName ??
              (await platformName(entity.platform)) ??
              `${entity.platform}`,
          },
          ...extra,
        ],
      });
    } catch (e) {
      logger.error('Something went wrong sending media notification(s)', {
        label: 'Notifications',
        errorMessage: e.message,
        requestId: entity.id,
        mediaId: entity.media.id,
      });
    }
  }

  /**
   * Transient display fields, filled in by the metadata layer when known
   */
  public platformName?: string;
  public summary?: string;
}

export default MediaRequest;
