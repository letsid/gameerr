#!/usr/bin/env node

/**
 * Generates the Gameerr logo set (logos, favicons, PWA icons, splash screens
 * and cover placeholders) into public/ from the shapes defined below.
 *
 * Usage: node bin/generate-brand-assets.mjs . [--preview-dir <dir>]
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? '.');
const sharp = createRequire(path.join(root, 'package.json'))('sharp');
const previewIdx = process.argv.indexOf('--preview-dir');
const previewDir = previewIdx > 0 ? process.argv[previewIdx + 1] : null;
const pub = (...p) => path.join(root, 'public', ...p);

const GRAD_FROM = '#C395FC';
const GRAD_TO = '#4F65F5';
const DARK = '#131928';
const SPLASH_BG = '#181828';
const COVER_BG = '#1F2937';
const COVER_ICON = '#4B5563';

// ---------- icon: a gamepad, drawn on a 96 x 96 grid ----------
const gamepadBody =
  // rounded body with two grips, one closed outline
  'M27 22 H69 C83 22 92 33 93 49 L95 66 C96 77 89 84 81 84 C75 84 71 81 67 75 L63 69 H33 L29 75 C25 81 21 84 15 84 C7 84 0 77 1 66 L3 49 C4 33 13 22 27 22 Z';
const dpad = 'M24 38 H32 V45 H39 V53 H32 V60 H24 V53 H17 V45 H24 Z';
const buttons = [
  [68, 41, 5.5],
  [78, 51, 5.5],
];

const iconDefs = (id) => `<defs>
  <linearGradient id="${id}" x1="10" y1="18" x2="88" y2="86" gradientUnits="userSpaceOnUse">
    <stop stop-color="${GRAD_FROM}"/>
    <stop offset="1" stop-color="${GRAD_TO}"/>
  </linearGradient>
  <linearGradient id="${id}-gloss" x1="48" y1="22" x2="48" y2="52" gradientUnits="userSpaceOnUse">
    <stop stop-color="white" stop-opacity="0.45"/>
    <stop offset="1" stop-color="white" stop-opacity="0"/>
  </linearGradient>
</defs>`;

// Icon group at 96 x 96. `mono` draws a single colour silhouette with cut-outs.
const iconGroup = (id, { mono, cutout = DARK } = {}) => {
  const fill = mono ?? `url(#${id})`;
  const holes = mono
    ? // cut the details out of the silhouette
      `<path fill-rule="evenodd" d="${gamepadBody} ${dpad} ${buttons
        .map(
          ([cx, cy, r]) =>
            `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`
        )
        .join(' ')}" fill="${fill}"/>`
    : `<path d="${gamepadBody}" fill="${fill}"/>
  <path d="M27 24 H69 C80 24 88 32 90 44 C76 40 20 40 6 44 C8 32 16 24 27 24 Z" fill="url(#${id}-gloss)"/>
  <path d="${dpad}" fill="${cutout}"/>
  ${buttons.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${cutout}"/>`).join('\n  ')}`;
  return holes;
};

// ---------- wordmark "gameerr": monoline letters, x-height 40, stroke 11 ----------
const SW = 11; // stroke width
const R = 14.5; // bowl radius
const MID = 50; // bowl centre line
const TOP = MID - R; // 35.5
const BASE = MID + R; // 64.5
const GAP = 7;

const bowl = (cx) =>
  `M${cx + R} ${MID} A${R} ${R} 0 1 0 ${cx - R} ${MID} A${R} ${R} 0 1 0 ${cx + R} ${MID}`;
const letters = {
  g: (x) => {
    const cx = x + R;
    return {
      d: `${bowl(cx)} M${cx + R} ${TOP} V${BASE + 8} A${R} ${R} 0 0 1 ${cx} ${BASE + 8 + R} H${cx - 6}`,
      w: 2 * R,
    };
  },
  a: (x) => {
    const cx = x + R;
    return { d: `${bowl(cx)} M${cx + R} ${TOP} V${BASE}`, w: 2 * R };
  },
  m: (x) => {
    const r = 10;
    return {
      d: `M${x} ${BASE} V${TOP} M${x} ${TOP + r} A${r} ${r} 0 0 1 ${x + 2 * r} ${TOP + r} V${BASE} M${x + 2 * r} ${TOP + r} A${r} ${r} 0 0 1 ${x + 4 * r} ${TOP + r} V${BASE}`,
      w: 4 * r,
    };
  },
  e: (x) => {
    const cx = x + R;
    const ex = cx + R * Math.cos(Math.PI / 4);
    const ey = MID + R * Math.sin(Math.PI / 4);
    return {
      d: `M${cx - R} ${MID} H${cx + R} A${R} ${R} 0 1 0 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
      w: 2 * R,
    };
  },
  r: (x) => ({
    d: `M${x} ${BASE} V${TOP} M${x} ${TOP + 13} C${x} ${TOP + 3} ${x + 7} ${TOP} ${x + 16} ${TOP}`,
    w: 16,
  }),
};

const wordmark = (word, x0) => {
  let x = x0 + SW / 2;
  const parts = [];
  for (const ch of word) {
    const { d, w } = letters[ch](x);
    parts.push(d);
    x += w + SW + GAP;
  }
  return { d: parts.join(' '), width: x - GAP - SW / 2 - x0 };
};

const wordPath = (d, color) =>
  `<path d="${d}" stroke="${color}" stroke-width="${SW}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

// ---------- SVG documents ----------
const iconSvg = (size = 96, opts = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96" fill="none">
${iconDefs('g')}
${iconGroup('g', opts)}
</svg>
`;

const fullSvg = (textColor = 'white') => {
  const word = wordmark('gameerr', 112);
  const width = Math.ceil(112 + word.width + 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="96" viewBox="0 0 ${width} 96" fill="none">
${iconDefs('g')}
${iconGroup('g')}
${wordPath(word.d, textColor)}
</svg>
`;
};

const stackedSvg = () => {
  const word = wordmark('gameerr', 0);
  const width = Math.ceil(word.width + 2);
  const iconScale = 1.4;
  const iconSize = 96 * iconScale;
  const iconX = (width - iconSize) / 2;
  // The wordmark path starts 30 units below its origin (top of the x-height)
  const wordY = iconSize - 30 + 14;
  const height = Math.ceil(wordY + 93);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
${iconDefs('g')}
<g transform="translate(${iconX.toFixed(2)} 0) scale(${iconScale})">
${iconGroup('g')}
</g>
<g transform="translate(0 ${wordY.toFixed(2)})">
${wordPath(word.d, 'white')}
</g>
</svg>
`;
};

// Icon centred on a square background, `scale` is the icon share of the side
const tileSvg = (size, bg, scale, rounded = false) => {
  const icon = size * scale;
  const off = (size - icon) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${bg ? `<rect width="${size}" height="${size}" ${rounded ? `rx="${size * 0.22}"` : ''} fill="${bg}"/>` : ''}
<g transform="translate(${off} ${off}) scale(${icon / 96})">
${iconDefs('g')}
${iconGroup('g')}
</g>
</svg>`;
};

const coverSvg = (pos) => {
  const w = 1000;
  const h = 1500;
  const icon = 440;
  const x = (w - icon) / 2;
  const y = pos === 'top' ? 260 : (h - icon) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${COVER_BG}"/>
<g transform="translate(${x} ${y}) scale(${icon / 96})">${iconGroup('g', { mono: COVER_ICON })}</g>
</svg>`;
};

// ---------- ICO with embedded PNGs ----------
const ico = (pngs) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
};

const png = (svg, opts = {}) => {
  let img = sharp(Buffer.from(svg), { density: opts.density ?? 72 });
  if (opts.resize) img = img.resize(opts.resize, opts.resize);
  if (opts.flatten) img = img.flatten({ background: opts.flatten });
  return img.png({ compressionLevel: 9 }).toBuffer();
};

(async () => {
  const write = (rel, data) => {
    fs.writeFileSync(pub(rel), data);
    console.log('wrote', rel, data.length);
  };

  write('logo_full.svg', fullSvg());
  write('logo_stacked.svg', stackedSvg());
  write('os_icon.svg', iconSvg());

  write('logo_full.png', await png(fullSvg()));
  write('os_logo_filled.png', await png(tileSvg(96, DARK, 0.86, true)));

  const fav16 = await png(tileSvg(16, null, 1));
  const fav32 = await png(tileSvg(32, null, 1));
  write('favicon-16x16.png', fav16);
  write('favicon-32x32.png', fav32);
  write(
    'favicon.ico',
    ico([
      { size: 16, data: fav16 },
      { size: 32, data: fav32 },
    ])
  );

  write(
    'apple-touch-icon.png',
    await png(tileSvg(180, SPLASH_BG, 0.7), { flatten: SPLASH_BG })
  );
  write('android-chrome-192x192.png', await png(tileSvg(192, null, 0.92)));
  write('android-chrome-512x512.png', await png(tileSvg(512, null, 0.92)));
  // Maskable icons keep the art inside the 80% safe zone
  write(
    'android-chrome-192x192_maskable.png',
    await png(tileSvg(192, SPLASH_BG, 0.62), { flatten: SPLASH_BG })
  );
  write(
    'android-chrome-512x512_maskable.png',
    await png(tileSvg(512, SPLASH_BG, 0.62), { flatten: SPLASH_BG })
  );

  // Notification badge: white silhouette, transparent background
  write(
    'badge-128x128.png',
    await sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g transform="translate(8 8) scale(${112 / 96})">${iconGroup('g', { mono: '#F8F8F8' })}</g></svg>`
      )
    )
      .png({ compressionLevel: 9 })
      .toBuffer()
  );

  for (const file of fs
    .readdirSync(pub())
    .filter((f) => /^apple-splash-\d+-\d+\.jpg$/.test(f))) {
    const [, w, h] = file.match(/(\d+)-(\d+)/).map(Number);
    const icon = Math.round(Math.min(w, h) * 0.36);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${SPLASH_BG}"/>
<g transform="translate(${(w - icon) / 2} ${(h - icon) / 2}) scale(${icon / 96})">${iconDefs('g')}${iconGroup('g')}</g></svg>`;
    write(file, await sharp(Buffer.from(svg)).jpeg({ quality: 86 }).toBuffer());
  }

  write('images/gameerr_cover_not_found.png', await png(coverSvg('center')));
  write(
    'images/gameerr_cover_not_found_logo_center.png',
    await png(coverSvg('center'))
  );
  write(
    'images/gameerr_cover_not_found_logo_top.png',
    await png(coverSvg('top'))
  );

  if (previewDir) {
    fs.mkdirSync(previewDir, { recursive: true });
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#111827"/>
<g transform="translate(137 110) scale(2.2)">${fullSvg().replace(/<\/?svg[^>]*>/g, '')}</g>
<g transform="translate(140 430) scale(1.1)">${iconDefs('g2')}${iconGroup('g2')}</g>
<rect x="290" y="420" width="128" height="128" rx="28" fill="${SPLASH_BG}"/>
<g transform="translate(306 436) scale(1)">${iconDefs('g3')}${iconGroup('g3')}</g>
<g transform="translate(470 430) scale(1.1)">${iconGroup('g4', { mono: '#F8F8F8' })}</g>
<g transform="translate(620 446) scale(0.9)">${iconGroup('g5', { mono: COVER_ICON })}</g>
</svg>`;
    await sharp(Buffer.from(sheet))
      .png()
      .toFile(path.join(previewDir, 'gameerr-brand.png'));
    console.log('preview', path.join(previewDir, 'gameerr-brand.png'));
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
