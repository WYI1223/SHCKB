/* One-off: full-page screenshot the two published dev-doc pages to verify
 * the image-forward layout renders (figures sized, no clip/overflow).
 *   node tools/block-doc-art/shoot.mjs */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const shots = [
  ['http://localhost:5173/notes/' + encodeURIComponent('块系统-抽象逻辑'), 'verify-abstract.png'],
  ['http://localhost:5173/notes/' + encodeURIComponent('块系统-实现与权衡'), 'verify-impl.png'],
];
const OUT = resolve('tools/block-doc-art/out');

const browser = await chromium.launch({ timeout: 60_000 });
const page = await browser.newContext({ viewport: { width: 860, height: 1000 }, deviceScaleFactor: 1 }).then((c) => c.newPage());
for (const [url, name] of shots) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(OUT, name), fullPage: true });
  console.log('  ✓', name);
}
await browser.close();
