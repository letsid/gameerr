import { MediaType } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { User } from '@server/entity/User';
import type { WatchlistItem } from '@server/interfaces/api/discoverInterfaces';
import logger from '@server/logger';
import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import type { ZodNumber, ZodOptional, ZodString } from 'zod';

export class DuplicateWatchlistRequestError extends Error {}
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

@Entity()
@Unique('UNIQUE_USER_DB', ['igdbId', 'requestedBy'])
export class Watchlist implements WatchlistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: MediaType.GAME })
  public mediaType: MediaType;

  @Column({ type: 'varchar' })
  title = '';

  @Column()
  @Index()
  public igdbId: number;

  @ManyToOne(() => User, (user) => user.watchlists, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public requestedBy: User;

  @ManyToOne(() => Media, (media) => media.watchlists, {
    eager: true,
    onDelete: 'CASCADE',
  })
  @Index()
  public media: Media;

  @DbAwareColumn({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<Watchlist>) {
    Object.assign(this, init);
  }

  public static async createWatchlist({
    watchlistRequest,
    user,
  }: {
    watchlistRequest: {
      title?: ZodOptional<ZodString>['_output'];
      igdbId: ZodNumber['_output'];
    };
    user: User;
  }): Promise<Watchlist> {
    const watchlistRepository = getRepository(this);
    const mediaRepository = getRepository(Media);

    const existing = await watchlistRepository
      .createQueryBuilder('watchlist')
      .leftJoinAndSelect('watchlist.requestedBy', 'user')
      .where('user.id = :userId', { userId: user.id })
      .andWhere('watchlist.igdbId = :igdbId', {
        igdbId: watchlistRequest.igdbId,
      })
      .getMany();

    if (existing && existing.length > 0) {
      logger.warn('Duplicate request for watchlist blocked', {
        igdbId: watchlistRequest.igdbId,
        label: 'Watchlist',
      });

      throw new DuplicateWatchlistRequestError();
    }

    let media = await mediaRepository.findOne({
      where: { igdbId: watchlistRequest.igdbId },
    });

    if (!media) {
      media = new Media({
        igdbId: watchlistRequest.igdbId,
        mediaType: MediaType.GAME,
        title: watchlistRequest.title,
      });
    }

    const watchlist = new this({
      ...watchlistRequest,
      mediaType: MediaType.GAME,
      requestedBy: user,
      media,
    });

    await mediaRepository.save(media);
    await watchlistRepository.save(watchlist);
    return watchlist;
  }

  public static async deleteWatchlist(
    igdbId: Watchlist['igdbId'],
    user: User
  ): Promise<Watchlist | null> {
    const watchlistRepository = getRepository(this);
    const watchlist = await watchlistRepository.findOneBy({
      igdbId,
      requestedBy: { id: user.id },
    });
    if (!watchlist) {
      throw new NotFoundError('not Found');
    }

    if (watchlist) {
      await watchlistRepository.delete(watchlist.id);
    }

    return watchlist;
  }
}
