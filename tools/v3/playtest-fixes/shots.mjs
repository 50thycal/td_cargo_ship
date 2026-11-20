// Before/after screenshots for the 2026-11-20 playtest fixes
// (docs/design/v3-playtest-fixes.md): the draft's NEW tag at 667×375 and
// 844×390, the Shield over the convoy, the Torpedo Sub, and the wave rating
// (on the draft before, its own screen after).
//
//   npx vite build && npx vite preview --port 4318 &
//   TAG=after BASE_URL=http://localhost:4318 node tools/v3/playtest-fixes/shots.mjs
//
// Writes docs/design/img/playtest-fixes/<TAG>-*.jpg (OUT_DIR to change).

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const TAG = process.env.TAG ?? 'after';
const OUT_DIR = process.env.OUT_DIR ?? 'docs/design/img/playtest-fixes';
mkdirSync(OUT_DIR, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) {
      const c = `${root}/${entry}/${dir}/chrome`;
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

const NEW_CH2 = ['lance', 'gunships', 'shield', 'fullSteam'];
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const shot = (page, name) => page.screenshot({ path: `${OUT_DIR}/${TAG}-${name}.jpg`, type: 'jpeg', quality: 84 });
const errs = [];

async function open(size, seed = 7) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    try {
      localStorage.removeItem('straitwatch.v3.run');
    } catch {
      // no storage
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?lab=map-island&seed=${seed}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on', { timeout: 20000 });
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.tempo.lossLimit = 999;
    g.carrierHp = g.stats.carrierHp = 1e6;
  });
  return { ctx, page };
}

/** Play waves until the draft (or the rating screen before it) is up. */
async function toDraft(page) {
  for (let i = 0; i < 60; i++) {
    if (await page.$('[data-screen="draft"], [data-screen="rate"]')) return;
    await page.evaluate(() => window.__v3.advance(30));
    await page.waitForTimeout(150);
  }
  throw new Error('no draft');
}

/** Past a rating screen to the draft. */
async function pastRate(page) {
  if (await page.$('[data-screen="rate"]')) {
    await page.locator('[data-rate-skip]').click();
    await page.waitForSelector('[data-screen="draft"]');
  }
}

// ---- The draft's NEW tag, at the two phone sizes ----
for (const size of [{ width: 667, height: 375 }, { width: 844, height: 390 }]) {
  const { ctx, page } = await open(size);
  let found = false;
  for (let wave = 0; wave < 8 && !found; wave++) {
    await toDraft(page);
    await pastRate(page);
    await page.waitForTimeout(900);
    found = (await page.locator('.v2-card[data-debut]').count()) > 0;
    if (found) break;
    // Take a card that isn't new and play on.
    await page.locator('.v2-card:not([disabled])').first().click();
    await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 8000 });
  }
  if (found) {
    await shot(page, `draft-tag-${size.width}x${size.height}`);
    const fit = await page.evaluate(() => {
      const tag = document.querySelector('.v2-card[data-debut] .v3-card-debut');
      const card = tag?.closest('.v2-card');
      const art = card?.querySelector('.v2-card-art');
      const t = tag?.getBoundingClientRect();
      const c = card?.getBoundingClientRect();
      const a = art?.getBoundingClientRect();
      const row = document.querySelector('.v2-card-row')?.getBoundingClientRect();
      return { tagTop: t && c ? Math.round(t.top - c.top) : null, aboveArt: t && a ? t.bottom <= a.top + 0.5 : null, rowBottom: row ? Math.round(row.bottom) : null, h: innerHeight };
    });
    console.log(`draft tag ${size.width}x${size.height}:`, JSON.stringify(fit));
  } else console.log(`draft tag ${size.width}x${size.height}: no new card dealt`);
  await ctx.close();
}

// ---- The wave rating: the draft row before, its own screen after ----
{
  const { ctx, page } = await open({ width: 844, height: 390 });
  await toDraft(page);
  await page.waitForTimeout(900);
  await shot(page, 'rate-wave');
  await ctx.close();
}

// ---- The Shield over the convoy, with hits on it ----
{
  const { ctx, page } = await open({ width: 844, height: 390 }, 11);
  await page.evaluate(() => {
    const g = window.__v3.game();
    window.__v3.advance(8);
    g.levels.shield = 3;
    if (!g.slots.includes('shield')) g.slots.push('shield');
    // One of its two hits (MAX) taken: cracked, one pip left.
    g.boost = { id: 'shield', level: 3, t: 14, n: 0, bank: 0, crateT: 0, age: 1, hits: 1 };
  });
  await page.evaluate(() => window.__v3.advance(4));
  await page.evaluate(() => window.__v3.freeze(true));
  await page.waitForTimeout(400);
  await shot(page, 'shield');
  await ctx.close();
}

// ---- The Torpedo Sub, firing ----
{
  const { ctx, page } = await open({ width: 844, height: 390 }, 5);
  await page.evaluate(() => window.__v3.advance(6));
  await page.evaluate(() => window.__v3.foe('torpedoSub'));
  await page.evaluate(() => window.__v3.advance(3.4));
  await page.evaluate(() => window.__v3.freeze(true));
  await page.waitForTimeout(400);
  await shot(page, 'sub');
  await ctx.close();
}

await browser.close();
if (errs.length) {
  console.error('page errors:', errs);
  process.exitCode = 1;
}
