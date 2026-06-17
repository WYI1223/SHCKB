/*
 * Render every src/*.html diagram to out/<name>.png at 2x (retina-crisp)
 * by screenshotting the single #art element (tight bounds, no letterbox
 * baked in — the page paper shows through transparent margins later).
 *
 *   bun tools/block-doc-art/render.mjs            # render all
 *   bun tools/block-doc-art/render.mjs 01         # render only names containing "01"
 *
 * Output PNGs are then uploaded as image-block blobs by
 * apps/server/scripts/seed-block-system-doc.ts.
 */
import { chromium } from 'playwright';
import { readdirSync, mkdirSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = resolve('tools/block-doc-art/src');
const OUT = resolve('tools/block-doc-art/out');
mkdirSync(OUT, { recursive: true });

const only = process.argv[2];
const files = readdirSync(SRC)
  .filter((f) => f.endsWith('.html') && (!only || f.includes(only)))
  .sort();

if (files.length === 0) {
  console.error(`no html in ${SRC}${only ? ` matching "${only}"` : ''}`);
  process.exit(1);
}

const browser = await chromium.launch({ timeout: 60_000 });
const ctx = await browser.newContext({ deviceScaleFactor: 2 });
const page = await ctx.newPage();

for (const f of files) {
  await page.goto(pathToFileURL(join(SRC, f)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$('#art');
  if (!el) {
    console.error(`  ✗ ${f} — no #art element`);
    continue;
  }
  const out = join(OUT, basename(f, '.html') + '.png');
  await el.screenshot({ path: out });
  const box = await el.boundingBox();
  console.log(`  ✓ ${basename(f, '.html')}  ${Math.round(box.width)}×${Math.round(box.height)} -> out/${basename(out)}`);
}

await browser.close();
