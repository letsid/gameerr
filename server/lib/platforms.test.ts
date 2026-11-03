import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { IgdbPlatform } from '@server/api/igdb/interfaces';
import {
  filterKnownPlatformIds,
  normalizePlatformIds,
  PC_PLATFORM_ID,
  resolvePlatforms,
  toPlatform,
} from '@server/lib/platforms';
import platformsAll from '@server/test/fixtures/igdb/platforms-all.json';
import platformsMain from '@server/test/fixtures/igdb/platforms-main.json';

const platforms = (platformsMain as IgdbPlatform[]).map(toPlatform);

describe('platform mapping', () => {
  it('pins PC to the IGDB id of Microsoft Windows', () => {
    const pc = (platformsAll as IgdbPlatform[]).find(
      (platform) => platform.id === PC_PLATFORM_ID
    );

    assert.strictEqual(pc?.abbreviation, 'PC');
    assert.strictEqual(pc?.slug, 'win');
  });

  it('maps IGDB platforms to their display data', () => {
    const ps5 = platforms.find((platform) => platform.slug === 'ps5');

    assert.deepStrictEqual(ps5, {
      id: 167,
      name: 'PlayStation 5',
      abbreviation: 'PS5',
      slug: 'ps5',
      generation: 9,
      platformFamily: 1,
      platformType: 1,
    });
  });

  it('falls back to the abbreviation or id when IGDB has no name', () => {
    assert.strictEqual(toPlatform({ id: 1, abbreviation: 'X' }).name, 'X');
    assert.strictEqual(toPlatform({ id: 2 }).name, '#2');
  });

  it('drops ids IGDB does not know', () => {
    const switchId = platforms.find((platform) => platform.slug === 'switch')
      ?.id as number;

    assert.deepStrictEqual(
      filterKnownPlatformIds([PC_PLATFORM_ID, 999999, switchId], platforms),
      [PC_PLATFORM_ID, switchId]
    );
  });
});

describe('normalizePlatformIds', () => {
  it('keeps positive integers once, in order', () => {
    assert.deepStrictEqual(
      normalizePlatformIds([6, '167', 6, -1, 0, 1.5, 'x', null]),
      [6, 167]
    );
  });

  it('treats anything but an array as empty', () => {
    assert.deepStrictEqual(normalizePlatformIds('6,167'), []);
    assert.deepStrictEqual(normalizePlatformIds(undefined), []);
  });
});

describe('resolvePlatforms', () => {
  it('prefers the user selection', () => {
    assert.deepStrictEqual(resolvePlatforms([167, 6], [130]), [167, 6]);
  });

  it('uses the admin default when the user picked nothing', () => {
    assert.deepStrictEqual(resolvePlatforms(null, [130]), [130]);
    assert.deepStrictEqual(resolvePlatforms([], [130]), [130]);
  });

  it('falls back to PC when nothing is configured', () => {
    assert.deepStrictEqual(resolvePlatforms(undefined, []), [PC_PLATFORM_ID]);
  });
});
