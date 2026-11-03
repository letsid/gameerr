import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { MediaRequestStatus, MediaStatus } from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Permission } from '@server/lib/permissions';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';

const PC = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

mock.method(MediaRequest, 'sendNotification', async () => undefined);

setupTestDb();

const originalDefaultQuotas = structuredClone(getSettings().main.defaultQuotas);

afterEach(() => {
  getSettings().main.defaultQuotas = structuredClone(originalDefaultQuotas);
});

async function seedUser(
  email: string,
  {
    permissions,
    gameQuotaLimit,
    gameQuotaDays,
  }: {
    permissions?: number;
    gameQuotaLimit?: number;
    gameQuotaDays?: number;
  } = {}
): Promise<User> {
  const userRepository = getRepository(User);
  const user = await userRepository.findOneOrFail({ where: { email } });
  if (permissions !== undefined) {
    user.permissions = permissions;
  }
  user.gameQuotaLimit = gameQuotaLimit;
  user.gameQuotaDays = gameQuotaDays;

  return userRepository.save(user);
}

let nextIgdbId = 1;

async function seedRequest(
  requestedBy: User,
  {
    status = MediaRequestStatus.PENDING,
    ignoreQuota = false,
    createdAt = new Date(),
  }: {
    status?: MediaRequestStatus;
    ignoreQuota?: boolean;
    createdAt?: Date;
  } = {}
): Promise<MediaRequest> {
  const media = await getRepository(Media).save(
    new Media({ igdbId: nextIgdbId++, status: MediaStatus.PENDING })
  );

  return getRepository(MediaRequest).save(
    new MediaRequest({
      status,
      media,
      platform: PC,
      requestedBy,
      ignoreQuota,
      createdAt,
    })
  );
}

describe('User.getQuota', () => {
  it('reports no limit when neither the user nor the defaults set one', async () => {
    const user = await seedUser('demo@seerr.dev');
    await seedRequest(user);

    const quota = await user.getQuota();

    assert.deepStrictEqual(quota.game, {
      days: undefined,
      limit: undefined,
      used: 0,
      remaining: undefined,
      restricted: false,
    });
  });

  it('counts every request except declined and quota-bypassing ones', async () => {
    const user = await seedUser('demo@seerr.dev', { gameQuotaLimit: 5 });

    for (const status of [
      MediaRequestStatus.PENDING,
      MediaRequestStatus.APPROVED,
      MediaRequestStatus.FAILED,
      MediaRequestStatus.COMPLETED,
      MediaRequestStatus.DECLINED,
    ]) {
      await seedRequest(user, { status });
    }
    await seedRequest(user, { ignoreQuota: true });

    const quota = await user.getQuota();

    assert.strictEqual(quota.game.limit, 5);
    assert.strictEqual(quota.game.used, 4);
    assert.strictEqual(quota.game.remaining, 1);
    assert.strictEqual(quota.game.restricted, false);
  });

  it('is restricted once the limit is used up', async () => {
    const user = await seedUser('demo@seerr.dev', { gameQuotaLimit: 2 });
    await seedRequest(user);
    await seedRequest(user);

    const quota = await user.getQuota();

    assert.strictEqual(quota.game.used, 2);
    assert.strictEqual(quota.game.remaining, 0);
    assert.strictEqual(quota.game.restricted, true);
  });

  it('only counts requests inside the quota window', async () => {
    const user = await seedUser('demo@seerr.dev', {
      gameQuotaLimit: 1,
      gameQuotaDays: 7,
    });
    await seedRequest(user, { createdAt: new Date(Date.now() - 30 * DAY_MS) });

    const quota = await user.getQuota();

    assert.strictEqual(quota.game.days, 7);
    assert.strictEqual(quota.game.used, 0);
    assert.strictEqual(quota.game.restricted, false);

    await seedRequest(user, { createdAt: new Date(Date.now() - DAY_MS) });

    assert.strictEqual((await user.getQuota()).game.restricted, true);
  });

  it('falls back to the default game quota from the settings', async () => {
    getSettings().main.defaultQuotas.game = { quotaLimit: 1, quotaDays: 3 };
    const user = await seedUser('demo@seerr.dev');
    await seedRequest(user);

    const quota = await user.getQuota();

    assert.strictEqual(quota.game.limit, 1);
    assert.strictEqual(quota.game.days, 3);
    assert.strictEqual(quota.game.restricted, true);
  });

  it("prefers the user's own limit over the default", async () => {
    getSettings().main.defaultQuotas.game = { quotaLimit: 1 };
    const user = await seedUser('demo@seerr.dev', { gameQuotaLimit: 3 });
    await seedRequest(user);

    const quota = await user.getQuota();

    assert.strictEqual(quota.game.limit, 3);
    assert.strictEqual(quota.game.remaining, 2);
    assert.strictEqual(quota.game.restricted, false);
  });

  for (const permissions of [Permission.ADMIN, Permission.MANAGE_USERS]) {
    it(`is never restricted for ${Permission[permissions]}`, async () => {
      getSettings().main.defaultQuotas.game = { quotaLimit: 1 };
      const user = await seedUser('demo@seerr.dev', {
        permissions: permissions | Permission.REQUEST,
        gameQuotaLimit: 1,
      });
      await seedRequest(user);
      await seedRequest(user);

      const quota = await user.getQuota();

      assert.strictEqual(quota.game.limit, 0);
      assert.strictEqual(quota.game.used, 0);
      assert.strictEqual(quota.game.restricted, false);
    });
  }
});
