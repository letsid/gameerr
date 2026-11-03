import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import type { IgdbGame } from '@server/api/igdb/interfaces';
import steam from '@server/api/steam';
import type { SteamAppDetailsResponse } from '@server/api/steam/interfaces';
import {
  releasesByPlatform,
  resolveSteamAppId,
  toGameDetails,
  toRequestGameInfo,
} from '@server/lib/gameDetails';
import {
  getGameScores,
  igdbBadge,
  metacriticBadgeFromSteam,
  steamScoreEntry,
} from '@server/lib/gameScores';
import { setupTestDb } from '@server/test/db';
import detailFixture from '@server/test/fixtures/igdb/games-detail-full.json';
import steamWitcher from '@server/test/fixtures/steam/appdetails-292030.json';

const PC = 6;
const PS4 = 48;

const details = detailFixture as IgdbGame[];
const byName = (name: string) => {
  const game = details.find((entry) => entry.name === name);
  assert.ok(game, `fixture has ${name}`);
  return game;
};

setupTestDb();

afterEach(() => {
  mock.restoreAll();
});

describe('resolveSteamAppId', () => {
  it('takes the Steam id from IGDB external games', () => {
    assert.deepStrictEqual(
      resolveSteamAppId(byName('The Witcher 3: Wild Hunt')),
      { appId: 292030, match: 'igdb_external_game' }
    );
    assert.strictEqual(resolveSteamAppId(byName('Elden Ring'))?.appId, 1245620);
  });

  it('has no Steam id for a game IGDB does not tie to Steam', () => {
    assert.strictEqual(
      resolveSteamAppId(byName('The Legend of Zelda: Tears of the Kingdom')),
      undefined
    );
  });

  it('falls back to the Steam store link IGDB lists', () => {
    assert.deepStrictEqual(
      resolveSteamAppId({
        id: 1,
        websites: [
          { id: 1, type: 1, url: 'https://example.com' },
          {
            id: 2,
            type: 13,
            url: 'https://store.steampowered.com/app/1174180',
          },
        ],
      }),
      { appId: 1174180, match: 'igdb_website' }
    );
  });

  it('ignores non-numeric external ids', () => {
    assert.strictEqual(
      resolveSteamAppId({
        id: 1,
        external_games: [{ id: 1, external_game_source: 1, uid: 'abc' }],
      }),
      undefined
    );
  });
});

describe('releasesByPlatform', () => {
  it('keeps the earliest release per platform', () => {
    const releases = releasesByPlatform([
      { id: 1, platform: PC, date: 2000, release_region: 8 },
      { id: 2, platform: PC, date: 1000, release_region: 2 },
      { id: 3, platform: PS4, date: 1500, release_region: 8 },
    ]);

    assert.deepStrictEqual(
      releases.map((release) => [release.platform, release.date]),
      [
        [PC, 1000],
        [PS4, 1500],
      ]
    );
  });

  it('prefers worldwide over European over other dates on the same day', () => {
    const [release] = releasesByPlatform([
      { id: 1, platform: PC, date: 1000, release_region: 5 },
      { id: 2, platform: PC, date: 1000, release_region: 1 },
      { id: 3, platform: PC, date: 1000, release_region: 8 },
    ]);

    assert.strictEqual(release.region, 8);
  });

  it('keeps undated platforms after the dated ones', () => {
    const releases = releasesByPlatform([
      { id: 1, platform: 130 },
      { id: 2, platform: PC, date: 1000 },
    ]);

    assert.deepStrictEqual(
      releases.map((release) => release.platform),
      [PC, 130]
    );
    assert.strictEqual(releases[1].date, undefined);
  });

  it('lists every platform of a live game once', () => {
    const witcher = toGameDetails(byName('The Witcher 3: Wild Hunt'));
    const platforms = witcher.releases.map((release) => release.platform);

    assert.strictEqual(new Set(platforms).size, platforms.length);
    assert.ok(platforms.includes(PC));
  });
});

describe('toGameDetails', () => {
  it('maps the live IGDB detail response', () => {
    const game = toGameDetails(byName('Red Dead Redemption 2'));

    assert.strictEqual(game.id, 25076);
    assert.ok(game.developers.includes('Rockstar Games'));
    assert.ok(game.publishers.includes('Take-Two Interactive'));
    assert.ok(game.screenshots.length > 0);
    assert.ok(game.videos.every((video) => video.youtubeId.length > 0));
    assert.strictEqual(game.steam?.appId, 1174180);
    assert.strictEqual(
      game.igdbUrl,
      'https://www.igdb.com/games/red-dead-redemption-2'
    );
  });

  it('builds the request info from the details', () => {
    const info = toRequestGameInfo(
      toGameDetails(byName('The Witcher 3: Wild Hunt'))
    );

    assert.strictEqual(info.title, 'The Witcher 3: Wild Hunt');
    assert.strictEqual(info.steamAppId, 292030);
    assert.strictEqual(info.releaseYear, 2015);
    assert.ok(info.platforms.includes(PC));
  });
});

describe('score badges', () => {
  it('reads the PC Metacritic score from the live Steam response', () => {
    const data = (steamWitcher as SteamAppDetailsResponse)['292030'].data;
    const badge = metacriticBadgeFromSteam(
      steamScoreEntry(292030, data),
      'igdb_external_game'
    );

    assert.deepStrictEqual(
      { ...badge, url: undefined },
      {
        source: 'metacritic',
        score: 93,
        scale: 100,
        url: undefined,
        platform: PC,
        via: 'steam',
        match: 'igdb_external_game',
      }
    );
    assert.match(
      badge?.url ?? '',
      /^https:\/\/www\.metacritic\.com\/game\/pc\//
    );
  });

  it('leaves the Metacritic badge out when Steam has no score', () => {
    assert.strictEqual(
      metacriticBadgeFromSteam(steamScoreEntry(1, { name: 'x' }), undefined),
      undefined
    );
  });

  it('rounds the IGDB rating and leaves out unrated games', () => {
    const witcher = toGameDetails(byName('The Witcher 3: Wild Hunt'));

    assert.deepStrictEqual(igdbBadge(witcher), {
      source: 'igdb',
      score: 93,
      scale: 100,
      count: 5539,
      url: 'https://www.igdb.com/games/the-witcher-3-wild-hunt',
    });
    assert.strictEqual(
      igdbBadge({ ...witcher, totalRatingCount: 0 }),
      undefined
    );
  });

  it('asks Steam once and serves the cached score afterwards', async () => {
    const lookup = mock.method(
      steam,
      'getAppDetails',
      async () => (steamWitcher as SteamAppDetailsResponse)['292030'].data
    );
    const witcher = toGameDetails(byName('The Witcher 3: Wild Hunt'));

    const first = await getGameScores(witcher);
    const second = await getGameScores(witcher);

    assert.strictEqual(lookup.mock.callCount(), 1);
    assert.deepStrictEqual(first, second);
    assert.deepStrictEqual(
      first.map((badge) => badge.source),
      ['metacritic', 'igdb']
    );
  });

  it('shows only the IGDB score for a game without Steam data', async () => {
    const lookup = mock.method(steam, 'getAppDetails', async () => undefined);
    const zelda = toGameDetails(
      byName('The Legend of Zelda: Tears of the Kingdom')
    );

    const scores = await getGameScores(zelda);

    assert.strictEqual(lookup.mock.callCount(), 0);
    assert.deepStrictEqual(
      scores.map((badge) => badge.source),
      ['igdb']
    );
  });
});
