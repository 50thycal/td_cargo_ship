// The App Store flavour in a real browser. Expects the STORE build served at
// BASE_URL (default http://localhost:4174):
//
//   npm run build:store && npx vite preview --port 4174 &  node e2e/v3-store.mjs
//
// Checks, at 874×402, 844×390 and 667×375 (landscape phones):
// - the bundle's single page is the store flavour (meta app-flavor=store);
// - no playtest UI: no Note button, no Playtest/Developer settings, no log
//   line on the result screen, no ?dev=1 back door;
// - Settings: version, credits, privacy policy link, reset (with confirm);
// - chapters 2–4 are locked behind the full-game unlock, and tapping one opens
//   the unlock sheet; with the unlock owned they open;
// - Free Play offers only the free chapter's maps until the unlock;
// - a run pauses when the page is hidden;
// - no request leaves the page's own origin.
// Screenshots go to SHOT_DIR (default e2e/shots/v3-store).

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4174';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3-store';
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

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let failures = 0;
const check = (ok, msg) => {
  if (ok) console.log('ok:', msg);
  else {
    failures++;
    console.error('FAIL:', msg);
  }
};

const origin = new URL(BASE_URL).origin;
const SIZES = [
  [874, 402],
  [844, 390],
  [667, 375],
];

/** A save with the first chapter cleared and a few cards. */
const CH1_DONE = {
  unlocked: 6,
  best: { },
  cards: 4,
  armory: {},
  equipped: { gun: null, hull: null, supply: null },
  cleared: [],
  armoryV: 2,
  open: [],
  mapsV: 2,
};

async function page(w, h, seed = null, fullGame = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errors = [];
  const foreign = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith('data:') && !u.startsWith('blob:')) foreign.push(u);
  });
  await p.addInitScript(
    ([s, full]) => {
      if (s) localStorage.setItem('straitwatch.v3.progress', JSON.stringify(s));
      if (full) localStorage.setItem('straitwatch.v3.fullgame', '1');
    },
    [seed, fullGame],
  );
  await p.goto(`${BASE_URL}/?dev=1`);
  await p.waitForSelector('.v2-map-card');
  return { ctx, p, errors, foreign };
}

for (const [w, h] of SIZES) {
  const tag = `${w}x${h}`;
  const { ctx, p, errors, foreign } = await page(w, h, (() => {
    const s = structuredClone(CH1_DONE);
    return s;
  })());
  // Fill in a cleared first chapter from the game's own map order.
  const order = await p.evaluate(() => [...document.querySelectorAll('.v2-map-card')].map((c) => c.dataset.map));
  await p.evaluate((ids) => {
    const s = JSON.parse(localStorage.getItem('straitwatch.v3.progress'));
    s.cleared = ids;
    s.best = Object.fromEntries(ids.map((id, i) => [id, { score: 4200 + i * 900, wave: 10 }]));
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify(s));
  }, order);
  await p.reload();
  await p.waitForSelector('.v2-map-card');

  check((await p.getAttribute('meta[name="app-flavor"]', 'content')) === 'store', `${tag}: store flavour page`);
  check((await p.title()) === 'Straitwatch', `${tag}: title is Straitwatch`);
  check(!(await p.$('.v3-menu-note')), `${tag}: no Note button on the menu`);
  check(!(await p.$('.v2-classic')), `${tag}: no Play V2 link (and ?dev=1 is ignored)`);
  check(!(await p.$('.v2-hud-dev, .v2-dev')), `${tag}: no developer panel`);
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-menu-ch1.png` });

  // Chapter 2: shown with a lock; its maps open the unlock sheet.
  const tab2 = await p.$('.v3-chapter-tab[data-chapter="2"]');
  check(!!(await tab2.$('svg')), `${tag}: chapter 2 tab shows a lock`);
  await tab2.click();
  await p.waitForSelector('.v2-map-card');
  const lockedAll = await p.$$eval('.v2-map-card', (cs) => cs.every((c) => c.classList.contains('locked')));
  check(lockedAll, `${tag}: chapter 2 maps are locked without the unlock`);
  check(!!(await p.$('.v3-full-flag')), `${tag}: FULL GAME flag on chapter 2`);
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-menu-ch2-locked.png` });
  await p.click('.v2-map-card');
  await p.waitForSelector('.v3-unlock');
  const sheet = await p.textContent('.v3-unlock');
  check(/Fifteen more maps/.test(sheet) && /Chapter 4/.test(sheet), `${tag}: unlock sheet lists what it opens`);
  check(/not available/.test(sheet), `${tag}: no store in a browser → says purchases are unavailable, no fake buy button`);
  const fitsUnlock = await p.$eval('.v3-unlock', (e) => e.getBoundingClientRect().bottom <= window.innerHeight + 1);
  check(fitsUnlock, `${tag}: unlock sheet fits the screen`);
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-unlock.png` });
  await p.click('text=Not now');
  await p.waitForSelector('.v2-map-card');

  // Free Play: only chapter 1 maps.
  await p.click('.v3-free-btn');
  await p.waitForSelector('select[data-fp="map"]');
  const fpMaps = await p.$$eval('select[data-fp="map"] option', (os) => os.map((o) => o.value));
  check(fpMaps.length === 5 && fpMaps.every((m) => order.includes(m)), `${tag}: Free Play offers the 5 free maps (${fpMaps.length})`);
  await p.click('.v3-back');
  await p.waitForSelector('.v2-map-card');

  // Settings.
  await p.click('.v2-settings-btn');
  await p.waitForSelector('.v2-settings');
  const st = await p.textContent('.v2-settings');
  check(!/Playtest|Developer|Watch mode/.test(st), `${tag}: no Playtest or Developer settings`);
  check(/Version/.test(st) && /1\.0\.0/.test(st), `${tag}: Settings shows the version`);
  check(/Credits/.test(st) && /CC0/.test(st), `${tag}: Settings shows credits`);
  const href = await p.getAttribute('.v2-settings a.v3-set-link', 'href');
  check(href === 'https://app-farm-legal.vercel.app/straitwatch/privacy', `${tag}: privacy policy link`);
  check(/Full game/.test(st), `${tag}: Settings offers the full game`);
  const fitsSettings = await p.$eval('.v2-settings', (e) => e.scrollHeight <= e.clientHeight + 1 || getComputedStyle(e).overflowY !== 'visible');
  check(fitsSettings, `${tag}: Settings fits or scrolls`);
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-settings.png` });

  // Reset progress: confirm, then everything but map 1 locks again.
  await p.click('[data-reset]');
  await p.waitForSelector('.v3-confirm');
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-reset-confirm.png` });
  await p.click('text=Cancel');
  await p.waitForSelector('.v2-settings');
  await p.click('[data-reset]');
  await p.click('[data-confirm-reset]');
  await p.waitForSelector('.v2-map-card');
  const afterReset = await p.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress') ?? 'null'));
  const openCards = await p.$$eval('.v2-map-card:not(.locked)', (cs) => cs.length);
  check(!afterReset || (afterReset.unlocked === 1 && afterReset.cleared.length === 0), `${tag}: reset cleared progress`);
  check(openCards === 1, `${tag}: after reset only map 1 is open (${openCards})`);

  // A run pauses when the app goes to the background.
  await p.click('.v2-map-card:not(.locked)');
  const sail = await p.waitForSelector('.v3-sail, .v2-draft .v2-card', { timeout: 10000 }).catch(() => null);
  if (sail) await sail.click();
  await p.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 15000 });
  check(!(await p.$('.v3-note-btn:not([hidden])')), `${tag}: no NOTE/RATE button in a run`);
  await p.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await p.waitForSelector('.v2-pause-panel', { timeout: 3000 }).catch(() => null);
  check(!!(await p.$('.v2-pause-panel')), `${tag}: hiding the page pauses the run`);
  const pauseText = await p.textContent('.v2-pause-panel').catch(() => '');
  check(!/note|Rate/i.test(pauseText), `${tag}: pause menu has no note/rate`);
  await p.screenshot({ path: `${SHOT_DIR}/${tag}-paused.png` });

  check(errors.length === 0, `${tag}: no page errors ${errors.slice(0, 3).join(' | ')}`);
  check(foreign.length === 0, `${tag}: no requests off the app's origin ${foreign.slice(0, 3).join(' ')}`);
  await ctx.close();
}

// With the unlock owned: chapter 2 opens.
{
  const { ctx, p, errors } = await page(844, 390, { ...CH1_DONE }, true);
  await p.click('.v3-chapter-tab[data-chapter="2"]');
  await p.waitForSelector('.v2-map-card');
  const first = await p.$eval('.v2-map-card', (c) => !c.classList.contains('locked'));
  check(first, 'owned: chapter 2 map 1 opens (save had chapter 1 cleared)');
  check(!(await p.$('.v3-full-flag')), 'owned: no FULL GAME flag');
  await p.click('.v3-free-btn');
  await p.waitForSelector('select[data-fp="map"]');
  const n = await p.$$eval('select[data-fp="map"] option', (os) => os.length);
  check(n === 20, `owned: Free Play offers all 20 maps (${n})`);
  await p.click('.v3-back');
  await p.click('.v2-settings-btn');
  const st = await p.textContent('.v2-settings');
  check(!/Full game/.test(st), 'owned: Settings no longer offers the unlock');
  await p.screenshot({ path: `${SHOT_DIR}/owned-settings.png` });
  check(errors.length === 0, `owned: no page errors ${errors.join(' | ')}`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall store checks passed');
process.exitCode = failures ? 1 : 0;
