// The Armory overhaul's screenshots (docs/design/v3-armory-overhaul.md):
// the Armory with Scrap (each bay, a card ready to level, one short of
// Scrap), the HUD's Scrap read-out, and the result screen's Scrap, at a
// phone held sideways (844×390, 667×375) and on a desktop. Expects
// `vite preview` at BASE_URL. Fails on any page error or overflow.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-armory-shots.mjs
// Env:    BASE_URL (default http://localhost:4173), SHOT_DIR (default docs/design/img/armory)

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'docs/design/img/armory';
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

// A player part way in: the usual build, a few more cards, Scrap banked.
const SAVE = {
  unlocked: 5,
  best: {},
  cards: 16,
  // (Boilers and Quartermaster: two of the four new upgrades, found.)
  armory: { reload: 5, warhead: 2, fuse: 1, plating: 3, pointdef: 1, repair: 4, boilers: 1, magazine: 2, longload: 1, stockpile: 5, quartermaster: 2 },
  equipped: { gun: 'reload', hull: 'repair', supply: 'stockpile' },
  cleared: ['strait', 'kesh', 'marrow', 'gauntlet'],
  armoryV: 3,
  scrap: 420,
  scrapEarned: 3870,
  open: [],
  mapsV: 2,
};

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const errors = [];
const fits = (page) => page.evaluate(() => {
  const o = document.querySelector('.v2-overlay.open');
  const els = [...(o?.querySelectorAll('.v3-armory-bar, .v3-armory-card, .v3-bay-tab') ?? [])];
  return els.every((e) => { const b = e.getBoundingClientRect(); return b.right <= innerWidth + 1 && b.left >= -1; }) && document.documentElement.scrollWidth <= innerWidth;
});

for (const [w, h, tag] of [[844, 390, 'phone'], [667, 375, 'small'], [1280, 720, 'desktop']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === 'desktop' ? 1 : 2, hasTouch: true, isMobile: tag !== 'desktop' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('straitwatch.v3.progress', JSON.stringify(s)); }, SAVE);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await page.locator('.v3-armory-btn').tap();
  await page.waitForSelector('[data-screen="armory"]');
  await page.waitForTimeout(500);
  // Gun: Quick Reload 5 equipped (maxed); pick Wide Warhead (300 to level, 420 banked).
  await page.locator('.v3-armory-card[data-armory="warhead"]').tap();
  await page.waitForTimeout(300);
  if (!(await fits(page))) errors.push(`${tag}: the Armory overflows`);
  await page.screenshot({ path: `${SHOT_DIR}/${tag}-gun-ready.png` });
  // Hull (five cards with Boilers and Lifeboats): Armor Plating 3 → 4 costs 500: short.
  await page.locator('[data-bay="hull"]').tap();
  await page.locator('.v3-armory-card[data-armory="plating"]').tap();
  await page.waitForTimeout(300);
  if (!(await fits(page))) errors.push(`${tag}: the Hull bay overflows`);
  await page.screenshot({ path: `${SHOT_DIR}/${tag}-hull-short.png` });
  // Supply: Deep Magazine (moved here), Long Loads, Supply Lines, Stockpile,
  // Quartermaster and Salvage Crews: six cards.
  await page.locator('[data-bay="supply"]').tap();
  await page.locator('.v3-armory-card[data-armory="magazine"]').tap();
  await page.waitForTimeout(300);
  if (!(await fits(page))) errors.push(`${tag}: the Supply bay overflows`);
  await page.screenshot({ path: `${SHOT_DIR}/${tag}-supply.png` });
  if (tag === 'phone') {
    // A run: the HUD's Scrap, then the result screen's ledger.
    await page.locator('[data-back]').tap();
    await page.locator('[data-map="strait"]').tap();
    await page.waitForSelector('[data-screen="loadout"]');
    await page.locator('[data-start]').tap();
    await page.waitForSelector('.playing');
    await page.evaluate(() => {
      const g = window.__v3.game();
      const base = { t: 1, outcome: 'cleared', score: 0, delivered: 0, lost: 0, carrierHp: 10, shots: 0, kills: {}, sunkBy: {}, taps: {} };
      for (let k = 1; k <= 6; k++) g.history.push({ ...base, wave: k });
      g.wave = 7;
    });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/${tag}-hud.png` });
    await page.evaluate(() => { window.__v3.game().carrierHp = 0; });
    await page.waitForSelector('[data-screen="result"] .v3-scrap-ledger', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOT_DIR}/${tag}-result.png` });
  }
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`shots in ${SHOT_DIR}`);
