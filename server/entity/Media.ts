import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import { Blocklist } from '@server/entity/Blocklist';
import type { User } from '@server/entity/User';
import { Watchlist } from '@server/entity/Watchlist';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import { numberArrayTransformer } from '@server/utils/columnTransformers';
import {
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MediaRequest } from './MediaRequest';

@Entity()
class Media {
  public static async getRelatedMedia(
    user: User | undefined,
    igdbIds: number[],
    { includeActiveRequest = false }: { includeActiveRequest?: boolean } = {}
  ): Promise<Media[]> {
    const mediaRepository = getRepository(Media);

    try {
      if (igdbIds.length === 0) {
        return [];
      }

      const finalIds = [...new Set(igdbIds)];

      const relatedMedia = await mediaRepository
        .createQueryBuilder('media')
        .leftJoinAndSelect(
          'media.watchlists',
          'watchlist',
          'media.id= watchlist.media and watchlist.requestedBy = :userId',
          { userId: user?.id }
        )
        .where(' media.igdbId in (:...finalIds)', { finalIds })
        .getMany();

      if (
        includeActiveRequest &&
        getSettings().main.hideRequested &&
        relatedMedia.length > 0
      ) {
        const activeRequestMediaIds = await mediaRepository
          .createQueryBuilder('media')
          .select('media.id', 'id')
          .distinct(true)
          .innerJoin('media.requests', 'request')
          .where('media.id IN (:...mediaIds)', {
            mediaIds: relatedMedia.map((m) => m.id),
          })
          .andWhere('request.status IN (:...statuses)', {
            statuses: [MediaRequestStatus.PENDING, MediaRequestStatus.APPROVED],
          })
          .getRawMany<{ id: number }>();

        const activeIds = new Set(activeRequestMediaIds.map((row) => row.id));

        relatedMedia.forEach((m) => {
          m.hasActiveRequest = activeIds.has(m.id);
        });
      }

      return relatedMedia;
    } catch (e) {
      logger.error(e.message);
      return [];
    }
  }

  public static async getMedia(igdbId: number): Promise<Media | undefined> {
    const mediaRepository = getRepository(Media);

    try {
      const media = await mediaRepository.findOne({
        where: { igdbId },
        relations: { requests: true },
      });

      return media ?? undefined;
    } catch (e) {
      logger.error(e.message);
      return undefined;
    }
  }

  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar', default: MediaType.GAME })
  public mediaType: MediaType;

  @Column({ unique: true })
  @Index()
  public igdbId: number;

  @Column({ type: 'int', nullable: true })
  @Index()
  public steamAppId?: number | null;

  /**
   * Denormalized from IGDB so request lists and notifications do not need
   * a metadata round trip. Refreshed whenever the game is looked up.
   */
  @Column({ type: 'varchar', nullable: true })
  public title?: string | null;

  @Column({ type: 'varchar', nullable: true })
  public coverImageId?: string | null;

  /**
   * IGDB platform ids the game has been released on (or announced for)
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: numberArrayTransformer,
  })
  public platforms?: number[] | null;

  @Column({ type: 'int', default: MediaStatus.UNKNOWN })
  @Index()
  public status: MediaStatus;

  @OneToMany(() => MediaRequest, (request) => request.media, {
    cascade: ['insert', 'remove'],
  })
  public requests: MediaRequest[];

  @OneToMany(() => Watchlist, (watchlist) => watchlist.media)
  public watchlists: null | Watchlist[];

  @OneToOne(() => Blocklist, (blocklist) => blocklist.media)
  public blocklist: Promise<Blocklist>;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  /**
   * Date and time the game was found in a connected library.
   * Null as long as the game has not been seen in a library.
   */
  @DbAwareColumn({
    type: 'datetime',
    nullable: true,
  })
  public mediaAddedAt?: Date | null;

  public hasActiveRequest?: boolean;

  constructor(init?: Partial<Media>) {
    Object.assign(this, init);
  }
}

export default Media;
