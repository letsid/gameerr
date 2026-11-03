import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import igdb, {
  apicalypseList,
  apicalypseString,
  IgdbNotConfiguredError,
} from '@server/api/igdb';
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';

const instance = (igdb as unknown as { axios: AxiosInstance }).axios;
const originalAdapter = instance.defaults.adapter;

const respond = (
  config: InternalAxiosRequestConfig,
  status: number,
  data: unknown,
  headers: Record<string, string> = {}
): Promise<AxiosResponse> => {
  const response = {
    data,
    status,
    statusText: String(status),
    headers,
    config,
    request: {},
  } as AxiosResponse;

  if (status >= 400) {
    return Promise.reject(
      new AxiosError('failed', String(status), config, {}, response)
    );
  }

  return Promise.resolve(response);
};

let tokenCalls = 0;

beforeEach(() => {
  process.env.IGDB_CLIENT_ID = 'test-client';
  process.env.IGDB_CLIENT_SECRET = 'test-secret';
  tokenCalls = 0;
  igdb.resetToken();
  mock.method(axios, 'post', async () => {
    tokenCalls++;
    return {
      data: {
        access_token: `token-${tokenCalls}`,
        expires_in: 5000000,
        token_type: 'bearer',
      },
    };
  });
});

afterEach(() => {
  instance.defaults.adapter = originalAdapter;
  mock.restoreAll();
  delete process.env.IGDB_CLIENT_ID;
  delete process.env.IGDB_CLIENT_SECRET;
});

describe('apicalypse helpers', () => {
  it('escapes quotes and backslashes in search terms', () => {
    assert.strictEqual(apicalypseString('a "b" \\ c'), '"a \\"b\\" \\\\ c"');
  });

  it('formats integer id lists', () => {
    assert.strictEqual(apicalypseList([6, 167.9]), '(6,167)');
  });
});

describe('IGDB client', () => {
  it('sends the client id and bearer token', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    instance.defaults.adapter = (config) => {
      seen = config;
      return respond(config, 200, []);
    };

    await igdb.query('games', 'fields id; where id = 1;', 0);

    assert.strictEqual(seen?.headers.get('Client-ID'), 'test-client');
    assert.strictEqual(seen?.headers.get('Authorization'), 'Bearer token-1');
    assert.strictEqual(seen?.data, 'fields id; where id = 1;');
  });

  it('reuses the token across queries', async () => {
    instance.defaults.adapter = (config) => respond(config, 200, []);

    await igdb.query('games', 'fields id; where id = 2;', 0);
    await igdb.query('games', 'fields id; where id = 3;', 0);

    assert.strictEqual(tokenCalls, 1);
  });

  it('fetches a new token once when IGDB rejects the old one', async () => {
    const auth: string[] = [];
    instance.defaults.adapter = (config) => {
      auth.push(String(config.headers.get('Authorization')));
      return auth.length === 1
        ? respond(config, 401, { message: 'Authorization Failure' })
        : respond(config, 200, [{ id: 4 }]);
    };

    const result = await igdb.query('games', 'fields id; where id = 4;', 0);

    assert.deepStrictEqual(result, [{ id: 4 }]);
    assert.deepStrictEqual(auth, ['Bearer token-1', 'Bearer token-2']);
  });

  it('backs off and retries when rate limited', async () => {
    let calls = 0;
    instance.defaults.adapter = (config) => {
      calls++;
      return calls === 1
        ? respond(config, 429, {}, { 'retry-after': '1' })
        : respond(config, 200, [{ id: 5 }]);
    };

    const started = Date.now();
    const result = await igdb.query('games', 'fields id; where id = 5;', 0);

    assert.deepStrictEqual(result, [{ id: 5 }]);
    assert.strictEqual(calls, 2);
    assert.ok(Date.now() - started >= 900);
  });

  it('searches standalone games on the given platforms only', async () => {
    let body: unknown;
    instance.defaults.adapter = (config) => {
      body = config.data;
      return respond(config, 200, []);
    };

    await igdb.searchGames({ query: 'witcher "3"', platforms: [6, 167] });

    assert.match(String(body), /^search "witcher \\"3\\""; /);
    assert.match(String(body), /game_type = \(0,8,9\) & version_parent = null/);
    assert.match(String(body), /platforms = \(6,167\)/);
  });

  it('refuses to run without credentials', async () => {
    delete process.env.IGDB_CLIENT_ID;
    delete process.env.IGDB_CLIENT_SECRET;
    instance.defaults.adapter = (config) => respond(config, 200, []);

    assert.strictEqual(igdb.isConfigured(), false);
    await assert.rejects(
      igdb.query('games', 'fields id; where id = 6;', 0),
      IgdbNotConfiguredError
    );
  });
});
