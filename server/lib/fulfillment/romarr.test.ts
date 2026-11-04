import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import igdb from '@server/api/igdb';
import type { IgdbPlatform } from '@server/api/igdb/interfaces';
import { getRomarr, isRomarrConfigured } from '@server/api/romarr';
import type {
  RomarrCreateRequest,
  RomarrRequestState,
} from '@server/api/romarr/interfaces';
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
  resetRomarrPlatformNames,
  romarrPlatformNames,
  romarrRequestId,
  toFulfillmentResult,
} from '@server/lib/fulfillment/romarr';
import { fetchRomarrLibrary } from '@server/lib/library';
import { Notification } from '@server/lib/notifications';
import { toPlatform } from '@server/lib/platforms';
import { getSettings } from '@server/lib/settings';
import { setupTestDb } from '@server/test/db';
import platformsAll from '@server/test/fixtures/igdb/platforms-all.json';
import {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

const PC = 6;
const PS1 = 7;
const SNES = 19;
const N64 = 4;
// Not a ROMarrNG system
const ZEEBO = 240;

let sendNotificationMock: ReturnType<
  typeof mock.method<typeof MediaRequest, 'sendNotification'>
>['mock'];

const state = (
  status: RomarrRequestState['status'],
  extra: Partial<RomarrRequestState> = {}
): RomarrRequestState => ({
  externalRequestId: 'gameerr-1',
  status,
  deliverable: status === 'available',
  title: 'Chrono Trigger',
  platform: 'snes',
  actions: { retry: status === 'failed', cancel: status === 'searching' },
  ...extra,
});

const httpError = (status: number, error: string) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: { error } },
  });

const unknownPlatform = () =>
  httpError(400, 'externalRequestId, game and a valid platform are required');

setupTestDb();

beforeEach(() => {
  process.env.ROMARR_URL = 'http://romarr.test:6868/';
  process.env.ROMARR_API_KEY = 'romarr_test_key';
  process.env.QUESTARR_URL = 'http://questarr.test:5000';
  process.env.QUESTARR_API_KEY = 'qsr_test_key';
  getSettings().fulfillment.questarrEnabled = true;
  getSettings().fulfillment.romarrEnabled = true;
  resetRomarrPlatformNames();
  mock.method(igdb, 'getPlatforms', async () => platformsAll);
  sendNotificationMock = mock.method(
    MediaRequest,
    'sendNotification',
    async () => undefined
  ).mock;
});

afterEach(() => {
  mock.restoreAll();
  delete process.env.ROMARR_URL;
  delete process.env.ROMARR_API_KEY;
  delete process.env.QUESTARR_URL;
  delete process.env.QUESTARR_API_KEY;
  getSettings().fulfillment.questarrEnabled = false;
  getSettings().fulfillment.romarrEnabled = false;
});

const captureAxios = (
  handler: (config: InternalAxiosRequestConfig) => unknown
) => {
  const instance = (getRomarr() as unknown as { axios: AxiosInstance }).axios;
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

async function seedApproved(platform = SNES) {
  const requestedBy = await getRepository(User).findOneOrFail({
    where: { email: 'demo@seerr.dev' },
  });
  const media = await getRepository(Media).save(
    new Media({
      mediaType: MediaType.GAME,
      igdbId: 1236,
      title: 'Chrono Trigger',
      platforms: [SNES, PS1],
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

const platform = (id: number) =>
  toPlatform(
    (platformsAll as IgdbPlatform[]).find((candidate) => candidate.id === id)!
  );

describe('ROMarrNG client', () => {
  it('talks to the provider contract with the integration key', async () => {
    const seen = captureAxios(() => state('searching'));

    await getRomarr().submitRequest({
      externalRequestId: 'gameerr-7-1',
      game: 'Chrono Trigger',
      platform: 'snes',
      identity: { catalogProvider: 'igdb', catalogId: 1236, platformId: SNES },
    });

    const [config] = seen;
    assert.strictEqual(
      config?.baseURL,
      'http://romarr.test:6868/api/integration/seerrng/v1'
    );
    assert.strictEqual(config?.url, '/requests');
    assert.strictEqual(config?.method, 'post');
    assert.strictEqual(config?.headers.get('X-Api-Key'), 'romarr_test_key');
    assert.deepStrictEqual(JSON.parse(String(config?.data)), {
      externalRequestId: 'gameerr-7-1',
      game: 'Chrono Trigger',
      platform: 'snes',
      identity: { catalogProvider: 'igdb', catalogId: 1236, platformId: SNES },
    });
  });

  it('looks up the library in chunks ROMarrNG accepts', async () => {
    const seen = captureAxios((config) => ({
      ready: true,
      partial: false,
      matches: JSON.parse(String(config.data)).titles.slice(0, 1),
    }));
    const titles = Array.from({ length: 150 }, (_, i) => ({
      title: `Game ${i}`,
      platform: 'snes',
    }));

    const matches = await getRomarr().lookupLibrary(titles);

    assert.strictEqual(seen.length, 2);
    assert.strictEqual(seen[0]?.url, '/library/lookup');
    assert.strictEqual(JSON.parse(String(seen[0]?.data)).titles.length, 100);
    assert.deepStrictEqual(
      matches.map((match) => match.title),
      ['Game 0', 'Game 100']
    );
  });

  it('refuses a library that is still loading', async () => {
    captureAxios(() => ({ ready: false, partial: false, matches: [] }));

    await assert.rejects(
      getRomarr().lookupLibrary([{ title: 'Chrono Trigger', platform: 'snes' }])
    );
  });

  it('is not configured without URL or key', () => {
    delete process.env.ROMARR_API_KEY;
    assert.strictEqual(isRomarrConfigured(), false);
    assert.throws(() => getRomarr());
  });
});

describe('ROMarrNG fulfillment', () => {
  it('routes PC to Questarr and every other platform to ROMarrNG', () => {
    assert.strictEqual(getFulfillmentProvider(PC).id, 'questarr');
    assert.strictEqual(getFulfillmentProvider(SNES).id, 'romarr');
    assert.strictEqual(getFulfillmentProvider(167).id, 'romarr');

    getSettings().fulfillment.romarrEnabled = false;
    assert.strictEqual(getFulfillmentProvider(SNES).id, 'manual');
    assert.strictEqual(getFulfillmentProvider(PC).id, 'questarr');

    getSettings().fulfillment.romarrEnabled = true;
    delete process.env.ROMARR_API_KEY;
    assert.strictEqual(getFulfillmentProvider(SNES).id, 'manual');
  });

  it('names platforms the way ROMarrNG knows them', () => {
    assert.deepStrictEqual(romarrPlatformNames(platform(SNES)), [
      'snes',
      'Super Nintendo Entertainment System',
      'SNES',
    ]);
    // IGDB's slug for the PlayStation is "ps", ROMarrNG answers to its name
    assert.deepStrictEqual(romarrPlatformNames(platform(PS1)), [
      'ps',
      'PlayStation',
      'PS1',
    ]);
    assert.deepStrictEqual(romarrPlatformNames(undefined), []);
  });

  it('maps every contract status', () => {
    assert.deepStrictEqual(
      (
        [
          'searching',
          'downloading',
          'importing',
          'available',
          'failed',
          'cancelled',
        ] as const
      ).map((status) => toFulfillmentResult(state(status)).state),
      [
        'in_progress',
        'in_progress',
        'in_progress',
        'completed',
        'failed',
        'failed',
      ]
    );
    assert.strictEqual(
      toFulfillmentResult(
        state('failed', {
          failureCode: 'NO_RELEASE_FOUND',
          failureMessage: 'No usable release was found.',
        })
      ).message,
      'No usable release was found.'
    );
  });

  it('submits an approved console request with its IGDB identity', async () => {
    const request = await seedApproved(PS1);
    const submit = mock.method(
      getRomarr(),
      'submitRequest',
      async (body: RomarrCreateRequest) => {
        if (body.platform === 'ps') {
          throw unknownPlatform();
        }
        return state('searching', { platform: 'psx' });
      }
    );

    await submitForFulfillment(request);

    // IGDB's slug is unknown to ROMarrNG, its name is an alias
    assert.deepStrictEqual(
      submit.mock.calls.map((call) => call.arguments[0].platform),
      ['ps', 'PlayStation']
    );
    const body = submit.mock.calls[1]?.arguments[0];
    assert.strictEqual(body?.externalRequestId, romarrRequestId(request));
    assert.match(
      String(body?.externalRequestId),
      /^gameerr-[0-9]+-[0-9]{10,}$/
    );
    assert.strictEqual(body?.game, 'Chrono Trigger');
    assert.deepStrictEqual(body?.identity, {
      catalogProvider: 'igdb',
      catalogId: 1236,
      platformId: PS1,
    });
    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.fulfillmentProvider, 'romarr');
    assert.strictEqual(persisted.fulfillmentState, 'searching');
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
  });

  it('hands systems ROMarrNG does not manage to the request managers', async () => {
    const request = await seedApproved(ZEEBO);
    mock.method(getRomarr(), 'submitRequest', async () => {
      throw unknownPlatform();
    });

    await submitForFulfillment(request);

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.fulfillmentProvider, 'manual');
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.ok(
      sendNotificationMock.calls.some(
        (call) => call.arguments[2] === Notification.MEDIA_FULFILLMENT
      )
    );
  });

  it('waits and hands over again while ROMarrNG is busy', async () => {
    const request = await seedApproved();
    const submit = mock.method(getRomarr(), 'submitRequest', async () => {
      throw httpError(
        503,
        'ROMarr is at its SeerrNG dispatch limit; retry shortly'
      );
    });

    await submitForFulfillment(request);

    let persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.APPROVED);
    assert.strictEqual(persisted.fulfillmentProvider, 'romarr');
    assert.strictEqual(persisted.fulfillmentState, 'queued');

    submit.mock.mockImplementation(async () => state('searching'));
    const getRequest = mock.method(getRomarr(), 'getRequest', async () =>
      state('searching')
    );
    await syncFulfillment();

    assert.strictEqual(submit.mock.callCount(), 2);
    assert.strictEqual(getRequest.mock.callCount(), 0);
    persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.fulfillmentState, 'searching');
  });

  it('retries in ROMarrNG when a replay comes back failed', async () => {
    const request = await seedApproved();
    mock.method(getRomarr(), 'submitRequest', async () => state('failed'));
    const retry = mock.method(getRomarr(), 'retryRequest', async () =>
      state('searching')
    );

    await submitForFulfillment(request);

    assert.strictEqual(retry.mock.callCount(), 1);
  });

  it('completes the request once ROMarrNG reports it available', async () => {
    const request = await seedApproved();
    await getRepository(MediaRequest).update(request.id, {
      fulfillmentProvider: 'romarr',
      fulfillmentState: 'downloading',
    });
    mock.method(getRomarr(), 'getRequest', async () => state('available'));

    await syncFulfillment();

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.COMPLETED);
  });

  it('fails the request with the reason ROMarrNG gives', async () => {
    const request = await seedApproved();
    await getRepository(MediaRequest).update(request.id, {
      fulfillmentProvider: 'romarr',
      fulfillmentState: 'searching',
    });
    mock.method(getRomarr(), 'getRequest', async () =>
      state('failed', {
        failureCode: 'NO_RELEASE_FOUND',
        failureMessage: 'No usable release was found.',
      })
    );

    await syncFulfillment();

    const persisted = await getRepository(MediaRequest).findOneOrFail({
      where: { id: request.id },
    });
    assert.strictEqual(persisted.status, MediaRequestStatus.FAILED);
    assert.strictEqual(
      persisted.fulfillmentMessage,
      'No usable release was found.'
    );
  });
});

describe('ROMarrNG library', () => {
  it('asks per system and maps matches back to IGDB games', async () => {
    await getRepository(Media).save([
      new Media({
        igdbId: 1236,
        title: 'Chrono Trigger',
        mediaType: MediaType.GAME,
        platforms: [SNES, PC],
      }),
      new Media({
        igdbId: 1070,
        title: 'Super Mario 64',
        mediaType: MediaType.GAME,
        platforms: [N64],
      }),
      new Media({
        igdbId: 9999,
        title: 'Zeebo Exclusive',
        mediaType: MediaType.GAME,
        platforms: [ZEEBO],
      }),
    ]);
    const lookup = mock.method(
      getRomarr(),
      'lookupLibrary',
      async (titles: { title: string; platform: string }[]) => {
        const system = titles[0]?.platform;
        if (system === 'snes') {
          return [{ title: 'Chrono Trigger', platform: 'snes' }];
        }
        if (system === 'n64') {
          return [];
        }
        throw unknownPlatform();
      }
    );

    const owned = await fetchRomarrLibrary();

    assert.deepStrictEqual(owned, [
      { igdbId: 1236, platform: SNES, externalId: 'snes' },
    ]);
    const asked = lookup.mock.calls.map(
      (call) => call.arguments[0][0]?.platform
    );
    // PC is Questarr's, the Zeebo is tried under every name and skipped
    assert.ok(!asked.includes('win'));
    assert.deepStrictEqual(asked.slice(0, 2).sort(), ['n64', 'snes']);
    assert.ok(asked.length > 2);
  });

  it('remembers which names ROMarrNG knows between syncs', async () => {
    await getRepository(Media).save([
      new Media({
        igdbId: 1236,
        title: 'Chrono Trigger',
        mediaType: MediaType.GAME,
        platforms: [PS1, ZEEBO],
      }),
    ]);
    const lookup = mock.method(
      getRomarr(),
      'lookupLibrary',
      async (titles: { title: string; platform: string }[]) => {
        if (titles[0]?.platform === 'PlayStation') {
          return [];
        }
        throw unknownPlatform();
      }
    );

    await fetchRomarrLibrary();
    const firstSync = lookup.mock.callCount();
    await fetchRomarrLibrary();

    // First sync: "ps" then "PlayStation", and every Zeebo name
    assert.strictEqual(
      firstSync,
      2 + romarrPlatformNames(platform(ZEEBO)).length
    );
    // Second sync: only the name that worked, the Zeebo is skipped
    assert.strictEqual(lookup.mock.callCount() - firstSync, 1);
    assert.strictEqual(
      lookup.mock.calls.at(-1)?.arguments[0][0]?.platform,
      'PlayStation'
    );
  });

  it('skips ROMarrNG when it is not configured', async () => {
    delete process.env.ROMARR_URL;
    assert.strictEqual(await fetchRomarrLibrary(), undefined);
  });
});
