// V2 browser smoke test. Expects `vite preview` (or dev) at BASE_URL.
// Drives: menu → map 1 → defends wave 1 with real taps → upgrade draft →
// formation popup → phone-size layout. Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  npm run e2e:v2

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v2';
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
  return undefined; // let playwright-core try its own registry
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};

/** Tap every live threat that has no interceptor on it yet, via real clicks. */
async function defend(page) {
  const targets = await page.evaluate(() => {
    const g = window.__v2.game();
    if (!g || g.phase !== 'wave') return [];
    return g.threats
      .filter((t) => !g.interceptors.some((i) => i.target === t.id))
      .slice(0, 3)
      .map((t) => window.__v2.toClient(t.x, t.y));
  });
  for (const p of targets) await page.mouse.click(p.x, p.y);
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (err) => fail(`page error: ${err.message}`));
  await page.goto(`${BASE_URL}/v2.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.waitForSelector('[data-screen="menu"]');
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  if (!(await page.locator('[data-map="gauntlet"]').isDisabled())) fail('map 2 should start locked');
  await page.click('[data-map="strait"]');
  await page.waitForSelector('.playing');

  // 3× speed via the right rail: tap the top of its track.
  const track = page.locator('.v2-rail-right .v2-track');
  const box = await track.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 2);
  const speedLabel = await page.locator('.v2-rail-right .v2-slider-value').textContent();
  if (speedLabel !== '3×') fail(`speed slider read ${speedLabel}`);

  let shot = false;
  for (let i = 0; i < 400; i++) {
    const phase = await page.evaluate(() => window.__v2.game()?.phase);
    if (phase !== 'wave') break;
    await defend(page);
    if (!shot && i === 30) {
      await page.screenshot({ path: `${SHOT_DIR}/02-wave1.png` });
      shot = true;
    }
    await page.waitForTimeout(60);
  }
  const state = await page.evaluate(() => {
    const g = window.__v2.game();
    return { phase: g.phase, kills: g.kills, lost: g.lost, shots: g.shots };
  });
  console.log('after wave 1:', JSON.stringify(state));
  if (state.phase !== 'draft') fail(`expected the draft after wave 1, got ${state.phase}`);
  if (state.shots === 0 || state.kills.drone === 0) fail('real clicks never shot anything down');

  await page.waitForSelector('[data-screen="draft"] .v2-card');
  await page.screenshot({ path: `${SHOT_DIR}/03-draft.png` });
  const cards = await page.locator('.v2-card').count();
  if (cards !== 3) fail(`draft offered ${cards} cards`);
  await page.locator('.v2-card').first().click();
  await page.waitForFunction(() => window.__v2.game()?.phase === 'wave' && window.__v2.game().wave === 2);

  // Formation popup mid-wave.
  await page.click('.v2-formation-btn');
  await page.screenshot({ path: `${SHOT_DIR}/04-formations.png` });
  await page.click('[data-formation="spread"]');
  const formation = await page.evaluate(() => window.__v2.game().formation);
  if (formation !== 'spread') fail(`formation is ${formation}`);

  // Flow slider to max.
  const flow = page.locator('.v2-rail-left .v2-track');
  const fb = await flow.boundingBox();
  await page.mouse.click(fb.x + fb.width / 2, fb.y + 2);
  const flowStep = await page.evaluate(() => window.__v2.game().flow);
  if (flowStep !== 4) fail(`flow step is ${flowStep}`);
  for (let i = 0; i < 60; i++) {
    await defend(page);
    await page.waitForTimeout(60);
  }
  await page.screenshot({ path: `${SHOT_DIR}/05-wave2-spread.png` });

  // Phone landscape.
  const phone = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  phone.on('pageerror', (err) => fail(`phone page error: ${err.message}`));
  await phone.goto(`${BASE_URL}/v2.html?seed=11`, { waitUntil: 'networkidle' });
  await phone.screenshot({ path: `${SHOT_DIR}/06-phone-menu.png` });
  await phone.tap('[data-map="strait"]');
  await phone.waitForSelector('.playing');
  // Wave 1's first swarm can launch anywhere in the first ~20 s; keep tapping
  // until touch has actually fired a few interceptors.
  for (let i = 0; i < 400; i++) {
    const { targets, shots } = await phone.evaluate(() => {
      const g = window.__v2.game();
      return { shots: g.shots, targets: g.threats.slice(0, 2).map((t) => window.__v2.toClient(t.x, t.y)) };
    });
    if (shots >= 3) break;
    for (const p of targets) await phone.touchscreen.tap(p.x, p.y);
    await phone.waitForTimeout(80);
  }
  await phone.screenshot({ path: `${SHOT_DIR}/07-phone-play.png` });
  const phoneShots = await phone.evaluate(() => window.__v2.game().shots);
  if (phoneShots === 0) fail('touch taps never fired');

  // iPhone 16 Pro landscape (874×402, Dynamic Island inset 62 px each side,
  // home indicator 21 px). The rails must clear the island, and a late size
  // report (iOS after a rotation) must not leave the battlefield half off screen.
  const iphone = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
  iphone.on('pageerror', (err) => fail(`iphone page error: ${err.message}`));
  const cdp = await iphone.context().newCDPSession(iphone);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { left: 62, right: 62, top: 0, bottom: 21 } });
  await iphone.goto(`${BASE_URL}/v2.html?seed=5`, { waitUntil: 'networkidle' });
  await iphone.tap('[data-map="strait"]');
  await iphone.waitForSelector('.playing');
  await iphone.evaluate(() => {
    const a = document.getElementById('app');
    a.style.bottom = 'auto';
    a.style.height = '811px';
    window.dispatchEvent(new Event('resize'));
  });
  await iphone.waitForTimeout(150);
  await iphone.evaluate(() => {
    const a = document.getElementById('app');
    a.style.bottom = '';
    a.style.height = '';
  });
  await iphone.waitForTimeout(400);
  const lay = await iphone.evaluate(() => {
    const tl = window.__v2.toClient(0, 0);
    const br = window.__v2.toClient(1600, 900);
    const rail = document.querySelector('.v2-formation-btn').getBoundingClientRect();
    return { top: tl.y, bottom: br.y, railLeft: rail.left, h: innerHeight };
  });
  if (lay.top < 0 || lay.bottom > lay.h + 0.5) fail(`battlefield off screen after a late resize: ${JSON.stringify(lay)}`);
  if (lay.railLeft < 62) fail(`left rail under the Dynamic Island: starts at ${lay.railLeft}px`);
  await iphone.screenshot({ path: `${SHOT_DIR}/08-iphone16pro.png` });

  // Swapping a card in with all three slots full, by touch, at iPhone size.
  await iphone.evaluate(() => {
    const g = window.__v2.game();
    g.levels = { twin: 2, frigate: 1, speed: 1 };
    g.queue = [];
    g.threats = [];
  });
  await iphone.waitForSelector('[data-screen="draft"] .v2-card');
  const swapCard = iphone.locator('.v2-card.swappable').first();
  if (!(await swapCard.count())) fail('full loadout draft offered no card to swap in');
  else {
    const incoming = await swapCard.getAttribute('data-upgrade');
    await swapCard.tap();
    await iphone.waitForSelector('.v2-slot.swap');
    if ((await iphone.locator('.v2-slot.swap').count()) !== 3) fail('swap mode should offer all three held cards');
    await iphone.screenshot({ path: `${SHOT_DIR}/09-swap-choose.png` });
    // Cancel goes back to the plain draft; then swap for real.
    await iphone.locator('.v2-swap-prompt .v2-link').tap();
    if (await iphone.locator('.v2-slot.swap').count()) fail('cancel left swap mode on');
    await iphone.locator(`.v2-card[data-upgrade="${incoming}"]`).tap();
    await iphone.locator('.v2-slot.swap[data-slot="frigate"]').tap();
    await iphone.waitForFunction(() => window.__v2.game()?.phase === 'wave');
    const { levels, frigate } = await iphone.evaluate(() => ({ levels: window.__v2.game().levels, frigate: window.__v2.game().frigate }));
    console.log('after swap:', JSON.stringify(levels));
    if (levels.frigate || levels[incoming] !== 1 || levels.twin !== 2) fail(`swap gave ${JSON.stringify(levels)}`);
    if (frigate) fail('the Escort Frigate stayed after its card was swapped out');
  }

  // Loaded with Safari's toolbar showing (874×340), then the toolbar goes away
  // (874×402): the battlefield must grow to fill the screen, even when no
  // resize event arrives (round 5: a black strip was left at the bottom).
  {
    const tb = await browser.newPage({ viewport: { width: 874, height: 340 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await tb.addInitScript(() => {
      const add = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function (type, ...rest) {
        if (type === 'resize' || type === 'orientationchange' || type === 'change') return undefined;
        return add.call(this, type, ...rest);
      };
      window.ResizeObserver = class { observe() {} disconnect() {} };
    });
    await tb.goto(`${BASE_URL}/v2.html?seed=3`, { waitUntil: 'networkidle' });
    await tb.locator('[data-map="strait"]').tap();
    await tb.waitForSelector('.playing');
    await tb.setViewportSize({ width: 874, height: 402 });
    await tb.waitForTimeout(400);
    const fill = await tb.evaluate(() => ({ root: document.getElementById('app').getBoundingClientRect().height, mapBottom: window.__v2.toClient(0, 900).y }));
    console.log('after the toolbar hides:', JSON.stringify(fill));
    if (fill.root !== 402 || fill.mapBottom < 401) fail(`layout stuck at the old height: ${JSON.stringify(fill)}`);
    await tb.close();
  }

  console.log(process.exitCode ? 'V2 smoke test FAILED' : 'V2 smoke test passed');
} finally {
  await browser.close();
}
