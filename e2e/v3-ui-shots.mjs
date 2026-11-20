// The UI overhaul's screenshots (docs/design/v3-ui-overhaul.md): the root
// page, the V3 menu, Settings, the Test Lab and the in-game HUD at a phone
// held sideways (844×390), plus the menu and lab upright. Expects
// `vite preview` at BASE_URL. Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-ui-shots.mjs
// Env:    BASE_URL (default http://localhost:4173), SHOT_DIR, PREFIX

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3-ui';
const PREFIX = process.env.PREFIX ?? 'after';
mkdirSync(SHOT_DIR, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) {
      const candidate = `${root}/${entry}/${dir}/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const errors = [];
const shot = (page, name) => page.screenshot({ path: `${SHOT_DIR}/${PREFIX}-${name}.png` });

async function landscape() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  console.log('root lands on:', page.url());
  await shot(page, 'root');
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.v2-menu');
  await page.waitForTimeout(1500);
  await shot(page, 'menu');
  await page.click('.v2-settings-btn');
  await page.waitForSelector('.v2-settings');
  await page.waitForTimeout(700);
  await shot(page, 'settings');
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-lab]');
  await page.click('[data-lab]');
  await page.waitForSelector('.v3-lab');
  await page.waitForTimeout(900);
  await shot(page, 'lab');
  if (await page.$('[data-lab-tools-open]')) {
    await page.click('[data-lab-tools-open]');
    await page.waitForTimeout(700);
    await shot(page, 'lab-tools');
    // A build already played ticks off and drops below the rest.
    await page.evaluate(() => localStorage.setItem('straitwatch.v3.lab.ready', JSON.stringify(['island@31'])));
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('[data-lab]');
    await page.waitForSelector('.v3-lab');
    await page.waitForTimeout(700);
    const order = await page.evaluate(() => [...document.querySelectorAll('[data-ready]')].map((e) => `${e.dataset.ready}:${e.dataset.played}`).join());
    console.log('ready order:', order);
    if (order !== 'behemoth:0,kesh:0,marrow:0,island:1') errors.push(`played item not last (${order})`);
    await shot(page, 'lab-played');
    await page.evaluate(() => localStorage.removeItem('straitwatch.v3.lab.ready'));
  }
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.v2-map-card[data-map]');
  await page.click('.v2-map-card[data-map]');
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(900);
    if ((await page.evaluate(() => window.__v3?.game()?.phase)) === 'wave' && !(await page.$('.v2-overlay.open'))) break;
    const b = await page.$('.v2-overlay.open .v2-btn.primary');
    if (b) await b.click().catch(() => {});
  }
  await page.waitForTimeout(5000);
  await shot(page, 'hud');
  await ctx.close();
}

async function portrait() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot(page, 'portrait-menu');
  await ctx.close();
}

try {
  await landscape();
  await portrait();
} finally {
  await browser.close();
}
if (errors.length) {
  console.error('FAIL: page errors', errors);
  process.exitCode = 1;
} else console.log('ok: shots in', SHOT_DIR);
