// Draws the brand files in public/ from the mark's glyph (src/ui/mark.ts) and
// the colour tokens (docs/tokens.css), so none of them is edited by hand:
//
//   public/favicon.svg           the mark at 32 units, gradient and glyph
//   public/apple-touch-icon.png  180 px, full bleed: iOS rounds it itself
//   public/og.png                1200 x 630, the preview a shared link shows
//
// Run with `pnpm brand` after changing the glyph, a mark colour or the
// landing image. Fonts are the self-hosted ones the console ships.
import { readFileSync, writeFileSync } from 'node:fs';

import { chromium } from '@playwright/test';

import { MARK_PATHS } from '../src/ui/mark.ts';

const tokens = readFileSync('docs/tokens.css', 'utf8');
function colour(name) {
  const match = tokens.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, 'i'));
  if (match === null) throw new Error(`docs/tokens.css has no --color-${name}`);
  return match[1];
}
const C = {
  from: colour('iris-violet'),
  to: colour('plum-violet'),
  canvas: colour('void'),
  emphasis: colour('white'),
  secondary: colour('smoke-gray'),
  hairline: colour('graphite-hairline'),
};

function dataUrl(path, type) {
  return `data:${type};base64,${readFileSync(path).toString('base64')}`;
}
const font = (pkg, file) =>
  dataUrl(`node_modules/@fontsource-variable/${pkg}/files/${file}`, 'font/woff2');

/** The mark as SVG: `size` units square, the glyph inset by `inset` on each side. */
function markSvg({ size, radius, inset, stroke }) {
  const scale = (size - 2 * inset) / 16;
  const paths = MARK_PATHS.map((d) => `<path d="${d}"/>`).join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<defs><linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="${C.from}"/><stop offset="1" stop-color="${C.to}"/>`,
    `</linearGradient></defs>`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#mark)"/>`,
    `<g transform="translate(${inset} ${inset}) scale(${scale})" fill="none" stroke="${C.emphasis}"`,
    ` stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
    `</svg>`,
  ].join('');
}

const FAVICON = markSvg({ size: 32, radius: 7, inset: 4, stroke: 1.75 });
writeFileSync(
  'public/favicon.svg',
  `<!-- Drawn by scripts/brand.mjs from src/ui/mark.ts and docs/tokens.css; do not edit. -->\n${FAVICON}\n`,
);

const OG = `<!doctype html><html><head><style>
@font-face { font-family: Inter; src: url(${font('inter', 'inter-latin-wght-normal.woff2')}); font-weight: 100 900; }
@font-face { font-family: Playfair; src: url(${font('playfair-display', 'playfair-display-latin-wght-normal.woff2')}); font-weight: 400 900; }
@font-face { font-family: Mono; src: url(${font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2')}); font-weight: 100 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: ${C.canvas}; color: ${C.emphasis}; font-family: Inter; overflow: hidden; position: relative; }
.copy { position: absolute; left: 72px; top: 72px; bottom: 64px; width: 520px; display: flex; flex-direction: column; }
.lockup { display: flex; align-items: center; gap: 16px; font-size: 26px; font-weight: 600; }
.lockup svg { width: 56px; height: 56px; }
h1 { font-family: Playfair; font-weight: 500; font-size: 58px; line-height: 1.08; margin-top: 56px; }
.wire { font-family: Mono; font-size: 20px; color: ${C.secondary}; margin-top: auto; }
.wire b { color: ${C.from}; font-weight: 500; }
.shot { position: absolute; left: 650px; top: 96px; width: 900px; border: 1px solid ${C.hairline}; border-radius: 14px; overflow: hidden; }
.shot img { display: block; width: 100%; }
</style></head><body>
<div class="copy">
  <div class="lockup">${markSvg({ size: 56, radius: 12, inset: 12, stroke: 1.6 })}Umapi Console</div>
  <h1>An admin console that does not hide HTTP</h1>
  <p class="wire">If-None-Match → <b>304 Not Modified</b></p>
</div>
<div class="shot"><img src="${dataUrl('src/features/landing/directory.webp', 'image/webp')}" alt=""></div>
</body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 180, height: 180 } });
  await page.setContent(
    `<style>*{margin:0}svg{display:block;width:180px;height:180px}</style>${markSvg({ size: 180, radius: 0, inset: 40, stroke: 1.5 })}`,
  );
  await page.screenshot({ path: 'public/apple-touch-icon.png' });

  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(OG);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'public/og.png' });
} finally {
  await browser.close();
}
console.log('Drew public/favicon.svg, public/apple-touch-icon.png and public/og.png');
