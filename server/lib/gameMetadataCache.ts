import { getRepository } from '@server/datasource';
import GameMetadataCache from '@server/entity/GameMetadataCache';
import { LessThan } from 'typeorm';

export type MetadataCacheKind = 'list' | 'score' | 'price';

// Default lifetimes in seconds
export const METADATA_CACHE_TTL: Record<MetadataCacheKind, number> = {
  list: 24 * 60 * 60,
  score: 7 * 24 * 60 * 60,
  price: 6 * 60 * 60,
};

export interface CachedMetadata<T> {
  value: T;
  updatedAt: Date;
  expiresAt: Date;
  expired: boolean;
}

/**
 * Reads an entry, including expired ones so callers can serve stale data
 * while a refresh is pending.
 */
export const getCachedMetadata = async <T>(
  key: string
): Promise<CachedMetadata<T> | undefined> => {
  const entry = await getRepository(GameMetadataCache).findOne({
    where: { key },
  });

  if (!entry) {
    return undefined;
  }

  return {
    value: JSON.parse(entry.payload) as T,
    updatedAt: entry.updatedAt,
    expiresAt: entry.expiresAt,
    expired: entry.expiresAt.getTime() <= Date.now(),
  };
};

export const setCachedMetadata = async <T>(
  key: string,
  kind: MetadataCacheKind,
  value: T,
  ttl: number = METADATA_CACHE_TTL[kind]
): Promise<void> => {
  const repository = getRepository(GameMetadataCache);
  const expiresAt = new Date(Date.now() + ttl * 1000);
  const payload = JSON.stringify(value);

  const existing = await repository.findOne({ where: { key } });

  if (existing) {
    existing.kind = kind;
    existing.payload = payload;
    existing.expiresAt = expiresAt;
    await repository.save(existing);
    return;
  }

  await repository.save(
    new GameMetadataCache({ key, kind, payload, expiresAt })
  );
};

/**
 * Removes entries that expired more than `graceSeconds` ago
 */
export const pruneCachedMetadata = async (
  graceSeconds = 7 * 24 * 60 * 60
): Promise<number> => {
  const result = await getRepository(GameMetadataCache).delete({
    expiresAt: LessThan(new Date(Date.now() - graceSeconds * 1000)),
  });

  return result.affected ?? 0;
};
