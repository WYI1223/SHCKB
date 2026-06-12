/**
 * Screenshot run for the Paste-Up UI fork (ui-fork/free).
 * Drives a system Chrome via playwright (channel) against a TEMP
 * instance (server :3121, vite :5273) seeded with examples + devdocs.
 *
 * Usage (playwright npm pkg available, e.g. installed in a scratch dir):
 *   node shoot.mjs --base http://localhost:5273 --email <admin> --password <pw> --out shots
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const BASE = arg('base', 'http://localhost:5273');
const EMAIL = arg('email');
const PASSWORD = arg('password');
const OUT = arg('out', 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: arg('channel', 'chrome') });

async function shot(page, name) {
  await page.waitForTimeout(600); // let fonts/hover states settle
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`✓ ${name}`);
}

// ---------- author side ----------
const author = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await author.newPage();

// 1. login page (the shop door)
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[type=email]');
await shot(page, '01-login');

await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PASSWORD);
await page.click('button[type=submit]');
await page.waitForURL(`${BASE}/`);

// 2. workspace home: the rack (sidebar tree) + author welcome
await page.waitForSelector('nav[aria-label="Notepages"] a');
await shot(page, '02-rack-tree');

// find a content-rich page id through the API (same session)
const tree = await (await page.request.get(`${BASE}/api/tree`)).json();
const pick = (t) => tree.notepages.find((p) => p.title.includes(t));
const codePage = pick('重力算法') ?? tree.notepages[0];
const proseSlug = (pick('手帐') ?? codePage).slug;

// 3. editor panorama with blocks (job ticket + tray + sheet + spec sheet)
await page.goto(`${BASE}/edit/${codePage.id}`);
await page.waitForSelector('[data-block-id]');
await page.waitForTimeout(800); // highlight.js etc.
await shot(page, '03-editor-panorama');

// 4. properties open state: select a code block → spec sheet shows tools
const codeBlock = page.locator('[data-block-kind=code]').first();
await codeBlock.click();
await page.waitForSelector('[data-skb-properties] select');
await codeBlock.hover(); // reveal the non-photo-blue instrument marks
await shot(page, '04-editor-properties');

await author.close();

// ---------- reader side (zero instrumentation) ----------
const reader = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const rpage = await reader.newPage();

// 5. public directory (the colophon)
await rpage.goto(`${BASE}/`);
await rpage.waitForSelector('text=table of contents');
await rpage.waitForTimeout(500);
await shot(rpage, '05-public-directory');

// 6. public read page (the print — themed, no chrome)
await rpage.goto(`${BASE}/notes/${encodeURIComponent(proseSlug)}`);
await rpage.waitForSelector('.skb-canvas, [class*=canvas], h1', { timeout: 15000 });
await rpage.waitForTimeout(1200); // images
await shot(rpage, '06-public-read');

await reader.close();
await browser.close();
console.log('all shots done →', OUT);
