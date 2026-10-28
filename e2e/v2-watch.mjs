// V2 watch-mode browser test (round 9). Expects `vite preview` at BASE_URL.
// Settings → Developer → Watch mode; the bot plays a watched run at 10×;
// a human ¼ run picks both cards of a stride draft.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  npm run e2e:v2:watch

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v2-watch';
mkdirSync(SHOT_DIR, { recursive: true });
const chromiumPath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const phone = () => browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const game = (page, f) => page.evaluate(f);

async function devSettings(page, settings) {
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v2.dev', '1');
    localStorage.setItem('straitwatch.v2.dev.settings', JSON.stringify(s));
  }, settings);
  await page.reload({ waitUntil: 'networkidle' });
}

try {
  // 1. Turned on from Settings; hidden until dev mode is.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=11`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.v2-settings-btn').tap();
    if (await page.locator('[data-setting="watch"]').count()) fail('watch switch shows before dev mode is on');
    await page.locator('[data-setting="dev"]').tap();
    await page.locator('[data-setting="watch"]').tap();
    if ((await page.locator('[data-setting="watch"]').getAttribute('aria-checked')) !== 'true') fail('watch switch did not turn on');
    await page.screenshot({ path: `${SHOT_DIR}/01-settings.png` });
    await page.locator('[data-screen="settings"] .v2-btn').tap();
    if (!(await page.locator('.v2-dev-title').textContent()).includes('WATCH')) fail('menu strip does not say watch mode');
    await page.locator('[data-preset="eighth"]').tap();
    await page.locator('[data-map="island"]').tap();
    await page.waitForSelector('.playing');
    // The bot plays on its own: taps appear without any input from us.
    await page.waitForFunction(() => window.__v2.game().shots > 0, null, { timeout: 15000 });
    await page.screenshot({ path: `${SHOT_DIR}/02-watching.png` });
    const track = await page.locator('.v2-rail-right .v2-track').boundingBox();
    await page.mouse.click(track.x + track.width / 2, track.y + 2);
    const speed = await page.locator('.v2-rail-right .v2-slider-value').textContent();
    if (speed !== '10×') fail(`top watch speed is ${speed}`);
    // A bot draft: its pick lights up before it takes it.
    await page.waitForFunction(() => window.__v2.game().phase === 'draft', null, { timeout: 30000, polling: 50 });
    await page.waitForSelector('.bot-pick', { timeout: 2000 });
    await page.screenshot({ path: `${SHOT_DIR}/03-bot-draft.png` });
    await page.waitForFunction(() => ['won', 'lost'].includes(window.__v2.game().phase), null, { timeout: 90000, polling: 250 });
    const end = await game(page, () => ({ phase: window.__v2.game().phase, wave: window.__v2.game().wave }));
    console.log('watched ⅛ Island run:', JSON.stringify(end));
    await page.screenshot({ path: `${SHOT_DIR}/04-result.png` });
    await page.close();
  }

  // 2. A human ¼ run: a stride draft deals two cards in a row, both pickable.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=12`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'quarter', wave: 1, watch: false, watchSpeed: 1 });
    await page.locator('[data-map="strait"]').tap();
    await page.waitForSelector('.playing');
    // Clear the wave at once: no launches left, nothing in the air.
    await game(page, () => {
      const g = window.__v2.game();
      g.queue = [];
      g.raiderQueue = [];
      g.threats = [];
      g.raiders = [];
    });
    await page.waitForSelector('[data-screen="draft"] .v2-card');
    const title1 = await page.locator('[data-screen="draft"] h2').textContent();
    await page.locator('.v2-card:not(.locked)').first().tap();
    await page.waitForFunction(() => window.__v2.game().wave === 3 && window.__v2.game().phase === 'draft');
    // Round 8 bug: the second draft never redrew, leaving the first one's
    // cards on screen (taps on them did nothing).
    await page
      .waitForFunction(() => document.querySelector('[data-screen="draft"] h2')?.textContent.includes('skipped'), null, { timeout: 3000 })
      .catch(() => fail('the stride draft for the skipped wave never appeared'));
    await page.locator('.v2-card:not(.locked)').first().tap();
    await page.waitForFunction(() => window.__v2.game().phase === 'wave' && window.__v2.game().wave === 4, null, { timeout: 3000 }).catch(() => fail('second stride card did not start wave 4'));
    console.log('stride drafts:', title1, '→ wave', await game(page, () => window.__v2.game().wave));
    await page.close();
  }

  console.log(process.exitCode ? 'V2 watch test FAILED' : 'V2 watch test passed');
} finally {
  await browser.close();
}
