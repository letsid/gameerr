import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import type { RequestGameInfo } from '@server/entity/MediaRequest';
import {
  BlocklistedMediaError,
  DuplicateMediaRequestError,
  InvalidPlatformError,
  MediaRequest,
  QuotaRestrictedError,
  RequestPermissionError,
} from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { Notification } from '@server/lib/notifications';
import { Permission } from '@server/lib/permissions';
import { setupTestDb } from '@server/test/db';

// IGDB platform ids
const PC = 6;
const PS5 = 167;
const SWITCH = 130;

const sendNotificationMock = mock.method(
  MediaRequest,
  'sendNotification',
  async () => undefined
).mock;

setupTestDb();

beforeEach(() => {
  sendNotificationMock.resetCalls();
});

async function seedRequester(gameQuotaLimit?: number): Promise<User> {
  const userRepository = getRepository(User);

  const requester = await userRepository.findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });
  requester.gameQuotaLimit = gameQuotaLimit;

  return userRepository.save(requester);
}

async function getAdmin(): Promise<User> {
  return getRepository(User).findOneOrFail({
    where: { email: 'admin@seerr.dev' },
  });
}

async function createRequester(
  email: string,
  permissions = Permission.REQUEST
): Promise<User> {
  return getRepository(User).save(new User({ email, permissions, avatar: '' }));
}

function requestGames(
  requests: { igdbId: number; platform: number }[],
  requester: User
) {
  return Promise.allSettled(
    requests.map((body) => MediaRequest.request(body, requester))
  );
}

function rejections(results: PromiseSettledResult<MediaRequest>[]) {
  return results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
}

function fakeGame(overrides: Partial<RequestGameInfo> = {}): RequestGameInfo {
  return {
    title: 'Hollow Knight',
    coverImageId: 'co1rgi',
    platforms: [PC, SWITCH],
    steamAppId: 367520,
    ...overrides,
  };
}

describe('MediaRequest.request', () => {
  it('creates a pending request and pending media for a regular requester', async () => {
    const requester = await seedRequester();

    const created = await MediaRequest.request(
      { igdbId: 1001, platform: PC },
      requester
    );

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: created.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.PENDING);
    assert.strictEqual(persisted.type, MediaType.GAME);
    assert.strictEqual(persisted.platform, PC);
    assert.strictEqual(persisted.ignoreQuota, false);
    assert.strictEqual(persisted.requestedBy.id, requester.id);
    assert.ok(!persisted.modifiedBy);
    assert.strictEqual(persisted.media.igdbId, 1001);
    assert.strictEqual(persisted.media.status, MediaStatus.PENDING);

    assert.deepStrictEqual(
      sendNotificationMock.calls.map((call) => call.arguments[2]),
      [Notification.MEDIA_PENDING]
    );
  });

  for (const permission of [
    Permission.AUTO_APPROVE,
    Permission.MANAGE_REQUESTS,
  ] as const) {
    it(`auto approves for ${Permission[permission]} and moves the media to processing`, async () => {
      const requester = await createRequester(
        'approver@seerr.dev',
        Permission.REQUEST | permission
      );

      const created = await MediaRequest.request(
        { igdbId: 1002, platform: PC },
        requester
      );

      const persisted = await getRepository(MediaRequest).findOneOrFail({
        where: { id: created.id },
      });
      assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
      assert.strictEqual(persisted.modifiedBy?.id, requester.id);
      assert.strictEqual(persisted.media.status, MediaStatus.PROCESSING);
    });
  }

  it('rejects a user without the request permission', async () => {
    const requester = await createRequester('voter@seerr.dev', Permission.VOTE);

    await assert.rejects(
      () => MediaRequest.request({ igdbId: 1003, platform: PC }, requester),
      RequestPermissionError
    );
    assert.strictEqual(await getRepository(MediaRequest).count(), 0);
    assert.strictEqual(await getRepository(Media).count(), 0);
  });

  it('rejects setting the request user without manage users and manage requests', async () => {
    const admin = await getAdmin();
    const requester = await seedRequester();
    const manager = await createRequester(
      'manager@seerr.dev',
      Permission.REQUEST | Permission.MANAGE_REQUESTS
    );

    for (const user of [requester, manager]) {
      await assert.rejects(
        () =>
          MediaRequest.request(
            { igdbId: 1004, platform: PC, userId: admin.id },
            user
          ),
        RequestPermissionError
      );
    }
    assert.strictEqual(await getRepository(MediaRequest).count(), 0);
  });

  it('creates the request on behalf of another user when allowed', async () => {
    const admin = await getAdmin();
    const requester = await seedRequester();

    const created = await MediaRequest.request(
      { igdbId: 1005, platform: PS5, userId: requester.id },
      admin
    );

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: created.id },
    });
    assert.strictEqual(persisted.requestedBy.id, requester.id);
    assert.strictEqual(persisted.modifiedBy?.id, admin.id);
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });

  it("checks the target user's permission and quota for a request on their behalf", async () => {
    const admin = await getAdmin();
    const voter = await createRequester('voter@seerr.dev', Permission.VOTE);
    const requester = await seedRequester(1);

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 1006, platform: PC, userId: voter.id },
          admin
        ),
      RequestPermissionError
    );

    await MediaRequest.request({ igdbId: 1007, platform: PC }, requester);

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 1008, platform: PC, userId: requester.id },
          admin
        ),
      QuotaRestrictedError
    );
    assert.strictEqual(await getRepository(MediaRequest).count(), 1);
  });

  it('rejects the second of two concurrent requests at the game quota', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(1);

    const results = await requestGames(
      [
        { igdbId: 11111, platform: PC },
        { igdbId: 22222, platform: PC },
      ],
      requester
    );
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof QuotaRestrictedError);
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('serializes a request on behalf of a user with their own requests', async () => {
    const requestRepository = getRepository(MediaRequest);
    const admin = await getAdmin();
    const requester = await seedRequester(1);

    const results = await Promise.allSettled([
      MediaRequest.request({ igdbId: 11112, platform: PC }, requester),
      MediaRequest.request(
        { igdbId: 22223, platform: PC, userId: requester.id },
        admin
      ),
    ]);
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof QuotaRestrictedError);
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('does not count declined requests against the quota', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(1);

    const first = await MediaRequest.request(
      { igdbId: 11113, platform: PC },
      requester
    );
    first.status = MediaRequestStatus.DECLINED;
    await requestRepository.save(first);

    await MediaRequest.request({ igdbId: 22224, platform: PC }, requester);

    assert.strictEqual(await requestRepository.count(), 2);
  });

  it('rejects a concurrent duplicate request for the same game and platform', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);

    const results = await requestGames(
      [
        { igdbId: 33333, platform: PC },
        { igdbId: 33333, platform: PC },
      ],
      requester
    );
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DuplicateMediaRequestError);
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('rejects a concurrent duplicate request from a different user', async () => {
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    const results = await Promise.allSettled(
      [requester, otherRequester].map((user) =>
        MediaRequest.request({ igdbId: 44444, platform: PS5 }, user)
      )
    );
    const rejected = rejections(results);

    assert.strictEqual(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof DuplicateMediaRequestError);
    assert.strictEqual(await requestRepository.count(), 1);
  });

  it('creates one media row for concurrent requests on different platforms', async () => {
    const mediaRepository = getRepository(Media);
    const requestRepository = getRepository(MediaRequest);
    const requester = await seedRequester(5);
    const otherRequester = await createRequester('second@seerr.dev');

    const results = await Promise.allSettled([
      MediaRequest.request({ igdbId: 55555, platform: PC }, requester),
      MediaRequest.request({ igdbId: 55555, platform: SWITCH }, otherRequester),
    ]);

    assert.strictEqual(rejections(results).length, 0);
    assert.strictEqual(await mediaRepository.count(), 1);

    const requests = await requestRepository.find({ order: { id: 'ASC' } });
    assert.deepStrictEqual(
      requests.map((r) => r.platform).sort((a, b) => a - b),
      [PC, SWITCH]
    );
    assert.ok(requests.every((r) => r.media.igdbId === 55555));
  });

  for (const status of [
    MediaRequestStatus.DECLINED,
    MediaRequestStatus.COMPLETED,
  ] as const) {
    it(`allows a new request for a platform whose request is ${MediaRequestStatus[status]}`, async () => {
      const requestRepository = getRepository(MediaRequest);
      const requester = await seedRequester();

      const first = await MediaRequest.request(
        { igdbId: 66666, platform: PC },
        requester
      );
      first.status = status;
      await requestRepository.save(first);

      await MediaRequest.request({ igdbId: 66666, platform: PC }, requester);

      assert.strictEqual(await requestRepository.count(), 2);
    });
  }

  for (const status of [
    MediaRequestStatus.APPROVED,
    MediaRequestStatus.FAILED,
  ] as const) {
    it(`rejects a new request for a platform whose request is ${MediaRequestStatus[status]}`, async () => {
      const requestRepository = getRepository(MediaRequest);
      const requester = await seedRequester();

      const first = await MediaRequest.request(
        { igdbId: 66667, platform: PC },
        requester
      );
      first.status = status;
      await requestRepository.save(first);

      await assert.rejects(
        () => MediaRequest.request({ igdbId: 66667, platform: PC }, requester),
        DuplicateMediaRequestError
      );
      assert.strictEqual(await requestRepository.count(), 1);
    });
  }

  it('rejects a request for a blocklisted game', async () => {
    const requester = await seedRequester();
    await getRepository(Media).save(
      new Media({ igdbId: 77777, status: MediaStatus.BLOCKLISTED })
    );

    await assert.rejects(
      () => MediaRequest.request({ igdbId: 77777, platform: PC }, requester),
      BlocklistedMediaError
    );
    assert.strictEqual(await getRepository(MediaRequest).count(), 0);
  });

  for (const status of [MediaStatus.UNKNOWN, MediaStatus.DELETED] as const) {
    it(`moves ${MediaStatus[status]} media back to pending`, async () => {
      const requester = await seedRequester();
      const media = await getRepository(Media).save(
        new Media({ igdbId: 77778, status })
      );

      await MediaRequest.request({ igdbId: 77778, platform: PC }, requester);

      const persisted = await getRepository(Media).findOneOrFail({
        where: { id: media.id },
      });
      assert.strictEqual(persisted.status, MediaStatus.PENDING);
    });
  }

  it('keeps available media available', async () => {
    const requester = await seedRequester();
    const media = await getRepository(Media).save(
      new Media({ igdbId: 77779, status: MediaStatus.AVAILABLE })
    );

    await MediaRequest.request({ igdbId: 77779, platform: PS5 }, requester);

    const persisted = await getRepository(Media).findOneOrFail({
      where: { id: media.id },
    });
    assert.strictEqual(persisted.status, MediaStatus.AVAILABLE);
  });
});

describe('MediaRequest.request, ignoreQuota', () => {
  it("lets a request manager bypass the requester's quota", async () => {
    const admin = await getAdmin();
    const requester = await seedRequester(1);

    await MediaRequest.request({ igdbId: 12001, platform: PC }, requester);

    const created = await MediaRequest.request(
      {
        igdbId: 12002,
        platform: PC,
        userId: requester.id,
        ignoreQuota: true,
      },
      admin
    );

    assert.strictEqual(created.ignoreQuota, true);
    assert.strictEqual(created.requestedBy.id, requester.id);

    // the bypassing request does not use up quota
    const quota = await requester.getQuota();
    assert.strictEqual(quota.game.used, 1);
  });

  it('rejects ignoreQuota from a user without manage requests', async () => {
    const requester = await seedRequester(1);

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 12003, platform: PC, ignoreQuota: true },
          requester
        ),
      RequestPermissionError
    );
    assert.strictEqual(await getRepository(MediaRequest).count(), 0);
  });

  it('rejects ignoreQuota from a regular user even without a quota limit', async () => {
    const requester = await seedRequester();

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 12004, platform: PC, ignoreQuota: true },
          requester
        ),
      RequestPermissionError
    );
  });

  it('does not flag ignoreQuota when the requester has no limit', async () => {
    const admin = await getAdmin();
    const requester = await seedRequester();

    const created = await MediaRequest.request(
      {
        igdbId: 12005,
        platform: PC,
        userId: requester.id,
        ignoreQuota: true,
      },
      admin
    );

    assert.strictEqual(created.ignoreQuota, false);
  });

  it('lets concurrent quota-bypassing requests through at the quota', async () => {
    const admin = await getAdmin();
    const requester = await seedRequester(1);

    await MediaRequest.request({ igdbId: 12006, platform: PC }, requester);

    const results = await Promise.allSettled(
      [12007, 12008].map((igdbId) =>
        MediaRequest.request(
          { igdbId, platform: PC, userId: requester.id, ignoreQuota: true },
          admin
        )
      )
    );

    assert.strictEqual(rejections(results).length, 0);
    assert.strictEqual(await getRepository(MediaRequest).count(), 3);
  });
});

describe('MediaRequest.request, game info', () => {
  it('rejects a platform the game is not released on', async () => {
    const requester = await seedRequester();

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 13001, platform: PS5 },
          requester,
          fakeGame()
        ),
      InvalidPlatformError
    );
    assert.strictEqual(await getRepository(MediaRequest).count(), 0);
    assert.strictEqual(await getRepository(Media).count(), 0);
  });

  it('stores title, cover, platforms and steam app id on new media', async () => {
    const requester = await seedRequester();

    const created = await MediaRequest.request(
      { igdbId: 13002, platform: SWITCH },
      requester,
      fakeGame()
    );

    const media = await getRepository(Media).findOneOrFail({
      where: { id: created.media.id },
    });
    assert.strictEqual(media.title, 'Hollow Knight');
    assert.strictEqual(media.coverImageId, 'co1rgi');
    assert.deepStrictEqual(media.platforms, [PC, SWITCH]);
    assert.strictEqual(media.steamAppId, 367520);
  });

  it('refreshes the stored game info on existing media', async () => {
    const requester = await seedRequester();
    const existing = await getRepository(Media).save(
      new Media({
        igdbId: 13003,
        status: MediaStatus.UNKNOWN,
        title: 'Old Title',
        coverImageId: 'old',
        platforms: [PC],
        steamAppId: 4242,
      })
    );

    await MediaRequest.request(
      { igdbId: 13003, platform: PS5 },
      requester,
      fakeGame({
        title: 'New Title',
        coverImageId: undefined,
        platforms: [PC, PS5],
        steamAppId: undefined,
      })
    );

    const media = await getRepository(Media).findOneOrFail({
      where: { id: existing.id },
    });
    assert.strictEqual(media.title, 'New Title');
    assert.strictEqual(media.coverImageId, null);
    assert.deepStrictEqual(media.platforms, [PC, PS5]);
    // a lookup without a steam id keeps the one already known
    assert.strictEqual(media.steamAppId, 4242);
    assert.strictEqual(media.status, MediaStatus.PENDING);
  });

  it('does not store game info when the request is rejected as a duplicate', async () => {
    const requester = await seedRequester();

    await MediaRequest.request(
      { igdbId: 13004, platform: PC },
      requester,
      fakeGame()
    );

    await assert.rejects(
      () =>
        MediaRequest.request(
          { igdbId: 13004, platform: PC },
          requester,
          fakeGame({ title: 'Renamed' })
        ),
      DuplicateMediaRequestError
    );

    const media = await getRepository(Media).findOneOrFail({
      where: { igdbId: 13004 },
    });
    assert.strictEqual(media.title, 'Hollow Knight');
  });
});
