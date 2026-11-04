import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import {
  getQuestarr,
  isQuestarrConfigured,
  QUESTARR_LOOKUP_CHUNK,
} from '@server/api/questarr';
import type { QuestarrRequestState } from '@server/api/questarr/interfaces';
import {
  MediaRequestStatus,
  MediaStatus,
  MediaType,
} from '@server/constants/media';
import { getRepository } from '@server/datasource';
import Media from '@server/entity/Media';
import { MediaRequest } from '@server/entity/MediaRequest';
import { User } from '@server/entity/User';
import {
  getFulfillmentProvider,
  submitForFulfillment,
  syncFulfillment,
} from '@server/lib/fulfillment';
import {
  questarrRequestId,
  toFulfillmentResult,
} from '@server/lib/fulfillment/questarr';
import { Notification } from '@server/lib/notifications';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

const PC = 6;
const PS5 = 167;

let sendNotificationMock: ReturnType<
  typeof mock.method<typeof MediaRequest, 'sendNotification'>
>['mock'];

const state = (
  status: QuestarrRequestState['status'],
  extra: Partial<QuestarrRequestState> = {}
): QuestarrRequestState => ({
  externalRequestId: 'gameerr-1',
  status,
  deliverable: status === 'available',
  title: 'Baldur’s Gate III',
  actions: { retry: status === 'failed', cancel: true },
  ...extra,
});

setupTestDb();

beforeEach(() => {
  process.env.QUESTARR_URL = 'http://questarr.test:5000/';
  process.env.QUESTARR_API_KEY = 'qsr_test_key';
  getSettings().fulfillment.questarrEnabled = true;
  sendNotificationMock = mock.method(
    MediaRequest,
    'sendNotification',
    async () => undefined
  ).mock;
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.QUESTARR_URL;
  delete process.env.QUESTARR_API_KEY;
  getSettings().fulfillment.questarrEnabled = false;
});

const captureAxios = (
  handler: (config: InternalAxiosRequestConfig) => unknown
) => {
  const instance = (getQuestarr() as unknown as { axios: AxiosInstance }).axios;
  const seen: InternalAxiosRequestConfig[] = [];
  instance.defaults.adapter = async (config) => {
    seen.push(config);
    return {
      data: handler(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
      request: {},
    } as AxiosResponse;
  };
  return seen;
};

async function seedApproved(platform = PC) {
  const requestedBy = await getRepository(User).findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });
  const media = await getRepository(Media).save(
    new Media({
      mediaType: MediaType.GAME,
      igdbId: 119171,
      title: "Baldur's Gate III",
      platforms: [PC, PS5],
      status: MediaStatus.PROCESSING,
    })
  );
  // Inserted without listeners, so no automatic hand-over runs
  const result = await getRepository(MediaRequest)
    .createQueryBuilder()
    .insert()
    .values({
      type: MediaType.GAME,
      status: MediaRequestStatus.APPROVED,
      platform,
      media,
      requestedBy,
    })
    .callListeners(false)
    .execute();

  return getRepository(MediaRequest).findOneOrFail({
    where: { id: result.identifiers[0].id },
    relations: { requestedBy: true },
  });
}

describe('Questarr client', () => {
  it('talks to the provider contract with the integration key', async () => {
    const seen = captureAxios(() => state('accepted'));

    await getQuestarr().submitRequest({
      externalRequestId: 'gameerr-7',
      title: 'Elden Ring',
      igdbId: 119133,
      variant: { operatingSystem: 'windows', architecture: 'x64' },
    });

    const [config] = seen;
    assert.strictEqual(
      config?.baseURL,
      'http://questarr.test:5000/api/integration/seerrng/v1'
    );
    assert.strictEqual(config?.url, '/requests');
    assert.strictEqual(config?.method, 'post');
    assert.strictEqual(config?.headers.get('X-Api-Key'), 'qsr_test_key');
    assert.deepStrictEqual(JSON.parse(String(config?.data)), {
      externalRequestId: 'gameerr-7',
      title: 'Elden Ring',
      igdbId: 119133,
      variant: { operatingSystem: 'windows', architecture: 'x64' },
    });
  });

  it('looks up the library in chunks Questarr accepts', async () => {
    const seen = captureAxios((config) => ({
      games: String(config.params.igdbIds)
        .split(',')
        .slice(0, 1)
        .map((id) => ({ igdbId: Number(id), status: 'owned' })),
    }));
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);

    const games = await getQuestarr().lookupLibrary(ids);

    assert.strictEqual(QUESTARR_LOOKUP_CHUNK, 100);
    assert.strictEqual(seen.length, 2);
    assert.strictEqual(String(seen[0]?.params.igdbIds).split(',').length, 100);
    assert.deepStrictEqual(
      games.map((game) => game.igdbId),
      [1, 101]
    );
  });

  it('is not configured without URL or key', () => {
    delete process.env.QUESTARR_API_KEY;
    assert.strictEqual(isQuestarrConfigured(), false);
    assert.throws(() => getQuestarr());
  });
});

describe('Questarr fulfillment', () => {
  it('routes PC, Linux and Mac to Questarr and the rest to manual', () => {
    assert.strictEqual(getFulfillmentProvider(PC).id, 'questarr');
    assert.strictEqual(getFulfillmentProvider(3).id, 'questarr');
    assert.strictEqual(getFulfillmentProvider(14).id, 'questarr');
    assert.strictEqual(getFulfillmentProvider(PS5).id, 'manual');

    delete process.env.QUESTARR_API_KEY;
    assert.strictEqual(getFulfillmentProvider(PC).id, 'manual');
  });

  it('maps every contract status', () => {
    assert.deepStrictEqual(
      (
        [
          'accepted',
          'searching',
          'downloading',
          'importing',
          'available',
          'failed',
          'cancelled',
        ] as const
      ).map((status) => toFulfillmentResult(state(status)).state),
      [
        'submitted',
        'in_progress',
        'in_progress',
        'in_progress',
        'completed',
        'failed',
        'failed',
      ]
    );
  });

  it('submits an approved PC request and records the state', async () => {
    const request = await seedApproved();
    const submit = mock.method(getQuestarr(), 'submitRequest', async () =>
      state('searching')
    );

    await submitForFulfillment(request);

    const body = submit.mock.calls[0]?.arguments[0];
    assert.strictEqual(body?.externalRequestId, questarrRequestId(request));
    // Unique even when SQLite reuses the id of a deleted request
    assert.match(
      String(body?.externalRequestId),
      new RegExp(`^gameerr-${request.id}-[0-9]{10,}$`)
    );
    assert.strictEqual(body?.igdbId, 119171);
    assert.deepStrictEqual(body?.variant, {
      operatingSystem: 'windows',
      architecture: 'x64',
    });
    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.fulfillmentProvider, 'questarr');
    assert.strictEqual(persisted.fulfillmentState, 'searching');
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });

  it('retries in Questarr when a replay comes back failed', async () => {
    const request = await seedApproved();
    mock.method(getQuestarr(), 'submitRequest', async () => state('failed'));
    const retry = mock.method(getQuestarr(), 'retryRequest', async () =>
      state('searching')
    );

    await submitForFulfillment(request);

    assert.strictEqual(retry.mock.callCount(), 1);
  });

  it('fails the request when Questarr refuses it', async () => {
    const request = await seedApproved();
    mock.method(getQuestarr(), 'submitRequest', async () => {
      throw Object.assign(new Error('Request failed'), {
        response: { data: { error: 'Game not found in catalog.' } },
      });
    });

    await submitForFulfillment(request);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.FAILED);
    assert.strictEqual(
      persisted.fulfillmentMessage,
      'Game not found in catalog.'
    );
    assert.strictEqual(
      sendNotificationMock.calls.filter(
        (call) => call.arguments[2] === Notification.MEDIA_FAILED
      ).length,
      1
    );
  });

  it('completes the request once Questarr reports it available', async () => {
    const request = await seedApproved();
    await getRepository(MediaRequest).update(request.id, {
      fulfillmentProvider: 'questarr',
      fulfillmentState: 'downloading',
    });
    mock.method(getQuestarr(), 'getRequest', async () => state('available'));

    await syncFulfillment();

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.COMPLETED);
    const media = await getRepository(Media).findOneOrFail({
      where: { id: request.media.id },
    });
    assert.strictEqual(media.status, MediaStatus.AVAILABLE);
    assert.ok(
      sendNotificationMock.calls.some(
        (call) => call.arguments[2] === Notification.MEDIA_AVAILABLE
      )
    );
  });

  it('leaves the request alone while Questarr is unreachable', async () => {
    const request = await seedApproved();
    await getRepository(MediaRequest).update(request.id, {
      fulfillmentProvider: 'questarr',
      fulfillmentState: 'downloading',
    });
    mock.method(getQuestarr(), 'getRequest', async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await syncFulfillment();

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(persisted.fulfillmentState, 'downloading');
  });
});
