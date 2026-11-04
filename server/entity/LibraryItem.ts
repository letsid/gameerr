import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type LibrarySource = 'steam' | 'questarr';

/**
 * A game a library source reports as present, per IGDB game and platform.
 * Rebuilt by the library sync, never edited by hand.
 */
@Entity()
@Unique('UNIQUE_LIBRARY_ITEM', ['igdbId', 'platform', 'source'])
export class LibraryItem {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'integer' })
  @Index()
  public igdbId: number;

  /**
   * IGDB platform id
   */
  @Column({ type: 'integer' })
  public platform: number;

  @Column({ type: 'varchar' })
  @Index()
  public source: LibrarySource;

  /**
   * Id of the game in the source, e.g. the Steam app id
   */
  @Column({ type: 'varchar', nullable: true })
  public externalId?: string | null;

  /**
   * Status the source reported, e.g. a Questarr library status
   */
  @Column({ type: 'varchar', nullable: true })
  public sourceStatus?: string | null;

  @DbAwareColumn({ type: 'datetime' })
  public syncedAt: Date;

  constructor(init?: Partial<LibraryItem>) {
    Object.assign(this, init);
  }
}

export default LibraryItem;
