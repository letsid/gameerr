import { DbAwareColumn, resolveDbType } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Persistent cache for metadata that is expensive or quota limited to
 * fetch: precomputed discover lists, scores and prices. Entries outlive
 * restarts, unlike the in-memory API caches.
 */
@Entity()
export class GameMetadataCache {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ type: 'varchar', unique: true })
  public key: string;

  /**
   * Category of the entry (list, score, price), which sets its default TTL
   */
  @Column({ type: 'varchar' })
  @Index()
  public kind: string;

  @Column({ type: 'text' })
  public payload: string;

  @DbAwareColumn({ type: 'datetime' })
  @Index()
  public expiresAt: Date;

  @UpdateDateColumn({
    type: resolveDbType('datetime'),
    default: () => 'CURRENT_TIMESTAMP',
  })
  public updatedAt: Date;

  constructor(init?: Partial<GameMetadataCache>) {
    Object.assign(this, init);
  }
}

export default GameMetadataCache;
