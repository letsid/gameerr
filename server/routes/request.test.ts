import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, mock } from 'node:test';

import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import { getSettings } from '@server/lib/settings';
import { checkUser } from '@server/middleware/auth';
import { setupTestDb } from '@server/test/db';
import {
  assertNoCredentials,
  seedUserSettings,
} from '@server/test/userSettings';
import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import request from 'supertest';
import authRoutes from './auth';
import requestRoutes from './request';

// IGDB platform ids
const PC = 6;
const PS5 = 167;
const SWITCH = 130;

const sendNotificationMock = mock.method(
  MediaRequest,
  'sendNotification',
  async () => undefined
).mock;

let app: Express;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(checkUser);
  app.use('/auth', authRoutes);
  app.use('/request', requestRoutes);
  app.use(
    (
      err: { status?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: express.NextFunction
    ) => {
      res
        .status(err.status ?? 500)
        .json({ status: err.status ?? 500, message: err.message });
    }
  );
  return app;
}

before(async () => {
  app = createApp();
});

beforeEach(() => {
  sendNotificationMock.resetCalls();
});

setupTestDb();

async function loginAs(email: string, password: string) {
  const settings = getSettings();
  const priorLocalLogin = settings.main.localLogin;
  settings.main.localLogin = true;

  try {
    const agent = request.agent(app);
    const res = await agent.post('/auth/local').send({ email, password });
    assert.strictEqual(res.status, 200);
    return agent;
  } finally {
    settings.main.localLogin = priorLocalLogin;
  }
}

let nextIgdbId = 10000;

async function seedRequest(
  status = MediaRequestStatus.PENDING,
  {
    ownerEmail = 'demo@seerr.dev',
    platform = PC,
    platforms = [PC, PS5],
    media: existingMedia,
  }: {
    ownerEmail?: string;
    platform?: number;
    platforms?: number[];
    media?: Media;
  } = {}
) {
  const userRepo = getRepository(User);
  const mediaRepo = getRepository(Media);
  const requestRepo = getRepository(MediaRequest);

  const requestedBy = await userRepo.findOneOrFail({
    where: { email: ownerEmail },
  });

  const media =
    existingMedia ??
    (await mediaRepo.save(
      new Media({
        mediaType: MediaType.GAME,
        igdbId: nextIgdbId++,
        title: 'Test Game',
        platforms,
        status: MediaStatus.UNKNOWN,
      })
    ));

  const created = await requestRepo.save(
    new MediaRequest({
      type: MediaType.GAME,
      status,
      media,
      platform,
      requestedBy,
      updatedAt: new Date('2025-03-01T00:00:00.000Z'),
    })
  );

  return requestRepo.findOneOrFail({
    where: { id: created.id },
    relations: { requestedBy: true, modifiedBy: true },
  });
}

describe('POST /request', () => {
  it('creates a pending game request for the given platform', async () => {
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .post('/request')
      .send({ igdbId: 1942, platform: PC });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.platform, PC);
    assert.strictEqual(res.body.type, MediaType.GAME);

    const media = await getRepository(Media).findOneOrFail({
      where: { igdbId: 1942 },
    });
    assert.strictEqual(media.status, MediaStatus.PENDING);
  });

  it('rejects a body without a platform', async () => {
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent.post('/request').send({ igdbId: 1942 });

    assert.strictEqual(res.status, 400);
  });

  it('rejects a second request for the same game and platform', async () => {
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const first = await agent
      .post('/request')
      .send({ igdbId: 2000, platform: PC });
    const second = await agent
      .post('/request')
      .send({ igdbId: 2000, platform: PC });

    assert.strictEqual(first.status, 201);
    assert.strictEqual(second.status, 409);
  });

  it('allows the same game on another platform', async () => {
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const pc = await agent
      .post('/request')
      .send({ igdbId: 2001, platform: PC });
    const ps5 = await agent
      .post('/request')
      .send({ igdbId: 2001, platform: PS5 });

    assert.strictEqual(pc.status, 201);
    assert.strictEqual(ps5.status, 201);
  });

  it('requires a signed-in user', async () => {
    const res = await request(app)
      .post('/request')
      .send({ igdbId: 1942, platform: PC });

    assert.strictEqual(res.status, 401);
  });
});

describe('DELETE /request/:requestId', () => {
  it('allows the owner to delete their own pending request', async () => {
    const mediaRequest = await seedRequest();

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('allows an admin to delete any pending request', async () => {
    const mediaRequest = await seedRequest();

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 204);
  });

  it('prevents a non-owner non-admin from deleting a pending request', async () => {
    const mediaRequest = await seedRequest(MediaRequestStatus.PENDING, {
      ownerEmail: 'admin@seerr.dev',
    });

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('prevents the owner from deleting an approved request', async () => {
    const mediaRequest = await seedRequest(MediaRequestStatus.APPROVED);

    const agent = await loginAs('demo@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${mediaRequest.id}`);

    assert.strictEqual(res.status, 401);
  });

  it('returns 404 for a non-existent request', async () => {
    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete('/request/99999999');

    assert.strictEqual(res.status, 404);
  });

  it('deletes a request once when two deletes race', async () => {
    const repo = getRepository(MediaRequest);
    const mediaRequest = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const results = await Promise.all([
      admin.delete(`/request/${mediaRequest.id}`),
      admin.delete(`/request/${mediaRequest.id}`),
    ]);

    assert.deepStrictEqual(results.map((r) => r.status).sort(), [204, 404]);
    assert.strictEqual(await repo.count({ where: { id: mediaRequest.id } }), 0);
  });
});

describe('PUT /request/:requestId', () => {
  it('moves a pending request to another platform of the game', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .put(`/request/${pending.id}`)
      .send({ platform: PS5 });

    assert.strictEqual(res.status, 200);
    const persisted = await repo.findOneOrFail({ where: { id: pending.id } });
    assert.strictEqual(persisted.platform, PS5);
  });

  it('rejects a platform the game is not released on', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .put(`/request/${pending.id}`)
      .send({ platform: SWITCH });

    assert.strictEqual(res.status, 400);
    const persisted = await repo.findOneOrFail({ where: { id: pending.id } });
    assert.strictEqual(persisted.platform, PC);
  });

  it('rejects moving onto a platform another request already holds', async () => {
    const first = await seedRequest();
    await seedRequest(MediaRequestStatus.PENDING, {
      platform: PS5,
      media: first.media,
    });
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent.put(`/request/${first.id}`).send({ platform: PS5 });

    assert.strictEqual(res.status, 409);
  });

  it('refuses to modify a request that is no longer pending', async () => {
    const approved = await seedRequest(MediaRequestStatus.APPROVED);
    const agent = await loginAs('admin@seerr.dev', 'test1234');

    const res = await agent
      .put(`/request/${approved.id}`)
      .send({ platform: PS5 });

    assert.strictEqual(res.status, 409);
  });

  it('prevents a regular user from reassigning the request owner', async () => {
    const admin = await getRepository(User).findOneOrFail({
      where: { email: 'admin@seerr.dev' },
    });
    const pending = await seedRequest();
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent
      .put(`/request/${pending.id}`)
      .send({ userId: admin.id });

    assert.strictEqual(res.status, 403);
  });
});

describe('GET /request/:requestId', () => {
  it('omits notification settings from requestedBy and modifiedBy', async () => {
    const pending = await seedRequest();
    await seedUserSettings('demo@seerr.dev');
    await seedUserSettings('admin@seerr.dev');

    const admin = await loginAs('admin@seerr.dev', 'test1234');
    const approved = await admin.post(`/request/${pending.id}/approve`);
    assert.strictEqual(approved.status, 200);

    const res = await admin.get(`/request/${pending.id}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requestedBy.email, 'demo@seerr.dev');
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');
    assert.ok(!('settings' in res.body.requestedBy));
    assert.ok(!('settings' in res.body.modifiedBy));
    assertNoCredentials(res.body);
  });
});

describe('POST /request/:requestId/:status', () => {
  const cases = [
    { action: 'approve', expected: MediaRequestStatus.APPROVED },
    { action: 'decline', expected: MediaRequestStatus.DECLINED },
  ] as const;

  for (const { action, expected } of cases) {
    it(`transitions to ${action}d and records the acting user`, async () => {
      const repo = getRepository(MediaRequest);
      const pending = await seedRequest();
      const admin = await loginAs('admin@seerr.dev', 'test1234');

      const res = await admin.post(`/request/${pending.id}/${action}`);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, expected);
      assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

      const persisted = await repo.findOneOrFail({
        where: { id: pending.id },
        relations: { modifiedBy: true },
      });

      assert.strictEqual(persisted.status, expected);
      assert.strictEqual(persisted.modifiedBy?.email, 'admin@seerr.dev');
      assert.ok(persisted.updatedAt > pending.updatedAt);
    });
  }

  it('marks the game as processing once a request is approved', async () => {
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/approve`);

    assert.strictEqual(res.status, 200);
    const media = await getRepository(Media).findOneOrFail({
      where: { id: pending.media.id },
    });
    assert.strictEqual(media.status, MediaStatus.PROCESSING);
  });

  it('forbids a regular user from approving', async () => {
    const pending = await seedRequest();
    const agent = await loginAs('demo@seerr.dev', 'test1234');

    const res = await agent.post(`/request/${pending.id}/approve`);

    assert.strictEqual(res.status, 403);
  });

  it('rejects a status the route does not define', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/frobnicate`);

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /approve/i);

    const persisted = await repo.findOneOrFail({
      where: { id: pending.id },
      relations: { modifiedBy: true },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.PENDING);
    assert.ok(!persisted.modifiedBy);
  });

  it('refuses to act on a request that is no longer pending', async () => {
    const repo = getRepository(MediaRequest);
    const approved = await seedRequest(MediaRequestStatus.APPROVED);
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${approved.id}/decline`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /pending/i);

    const persisted = await repo.findOneOrFail({ where: { id: approved.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });

  it('applies only one of a concurrent approve and decline', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const [approve, decline] = await Promise.all([
      admin.post(`/request/${pending.id}/approve`),
      admin.post(`/request/${pending.id}/decline`),
    ]);

    assert.deepStrictEqual([approve.status, decline.status].sort(), [200, 409]);

    const persisted = await repo.findOneOrFail({ where: { id: pending.id } });
    assert.strictEqual(
      persisted.status,
      approve.status === 200
        ? MediaRequestStatus.APPROVED
        : MediaRequestStatus.DECLINED
    );
  });
});

describe('POST /request/:requestId/retry', () => {
  it('re-approves a failed request and records the acting user', async () => {
    const repo = getRepository(MediaRequest);
    const failed = await seedRequest(MediaRequestStatus.FAILED);
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${failed.id}/retry`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(res.body.modifiedBy.email, 'admin@seerr.dev');

    const persisted = await repo.findOneOrFail({
      where: { id: failed.id },
      relations: { modifiedBy: true },
    });

    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(persisted.modifiedBy?.email, 'admin@seerr.dev');
    assert.ok(persisted.updatedAt > failed.updatedAt);
  });

  it('refuses to retry a request that has not failed', async () => {
    const repo = getRepository(MediaRequest);
    const pending = await seedRequest();
    const admin = await loginAs('admin@seerr.dev', 'test1234');

    const res = await admin.post(`/request/${pending.id}/retry`);

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /failed/i);

    const persisted = await repo.findOneOrFail({ where: { id: pending.id } });
    assert.strictEqual(persisted.status, MediaRequestStatus.PENDING);
  });
});

describe('DELETE /request/:requestId, media status restoration', () => {
  it('restores DELETED when the re-request is deleted and a stale completed request remains', async () => {
    const mediaRepo = getRepository(Media);
    const stale = await seedRequest(MediaRequestStatus.COMPLETED, {
      ownerEmail: 'admin@seerr.dev',
    });
    const media = stale.media;
    media.status = MediaStatus.PENDING;
    await mediaRepo.save(media);
    const fresh = await seedRequest(MediaRequestStatus.APPROVED, {
      ownerEmail: 'admin@seerr.dev',
      platform: PS5,
      media,
    });

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${fresh.id}`);

    assert.strictEqual(res.status, 204);
    const updated = await mediaRepo.findOneOrFail({ where: { id: media.id } });
    assert.strictEqual(updated.status, MediaStatus.DELETED);
  });

  it('resets to UNKNOWN once the last request is gone', async () => {
    const mediaRepo = getRepository(Media);
    const only = await seedRequest(MediaRequestStatus.APPROVED, {
      ownerEmail: 'admin@seerr.dev',
    });

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${only.id}`);

    assert.strictEqual(res.status, 204);
    const updated = await mediaRepo.findOneOrFail({
      where: { id: only.media.id },
    });
    assert.strictEqual(updated.status, MediaStatus.UNKNOWN);
  });

  it('keeps the status while another active request still exists', async () => {
    const mediaRepo = getRepository(Media);
    const first = await seedRequest(MediaRequestStatus.APPROVED, {
      ownerEmail: 'admin@seerr.dev',
    });
    await seedRequest(MediaRequestStatus.APPROVED, {
      ownerEmail: 'admin@seerr.dev',
      platform: PS5,
      media: first.media,
    });
    const before = await mediaRepo.findOneOrFail({
      where: { id: first.media.id },
    });

    const agent = await loginAs('admin@seerr.dev', 'test1234');
    const res = await agent.delete(`/request/${first.id}`);

    assert.strictEqual(res.status, 204);
    const updated = await mediaRepo.findOneOrFail({
      where: { id: first.media.id },
    });
    assert.strictEqual(updated.status, before.status);
    assert.notStrictEqual(updated.status, MediaStatus.UNKNOWN);
  });
});
