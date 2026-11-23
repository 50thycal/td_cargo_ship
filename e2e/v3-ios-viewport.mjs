// V3 on an iPhone home-screen app, landscape (the player's device: iPhone,
// iOS 18, 874×402 at 3×). The player: "when I first load … it's just not
// scaled properly and rotating it back-and-forth seems to reset it".
//
// iOS settles a freshly launched standalone page after its first paint (the
// safe-area insets arrive late; a size reading can be stale) and fires no
// event when it does. These checks block every resize / orientation event
// the page could hear, then change things under it the way iOS does, and
// check the game re-fits by itself:
//   1. safe-area insets that arrive after load (the notch, home indicator);
//   2. a first load at the wrong size, corrected with no event;
//   3. a stale, too-tall visualViewport reading in a home-screen app.
// Then the game on screen, in a run, at the player's size (deviceScaleFactor 1).
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-ios-viewport.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3';
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

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures++;
};

/** iPhone 16 Pro, landscape with the island on the left: env(safe-area-inset-*). */
const INSETS = { t: 0, r: 62, b: 21, l: 62 };
const W = 874;
const H = 402;

/** Runs before the page: no resize, orientationchange or visualViewport
 *  event reaches the game (what iOS does as a launch settles), and, with
 *  `standalone`, the page is a home-screen app whose visualViewport reads
 *  `staleVV` px tall until `window.__fixVV()`. */
function initScript({ standalone, staleVV }) {
  for (const t of ['resize', 'orientationchange']) window.addEventListener(t, (e) => e.stopImmediatePropagation(), true);
  const vv = window.visualViewport;
  if (vv) vv.addEventListener = () => {};
  if (screen.orientation) screen.orientation.addEventListener = () => {};
  if (standalone) Object.defineProperty(navigator, 'standalone', { value: true });
  if (staleVV && vv) {
    const real = Object.getOwnPropertyDescriptor(VisualViewport.prototype, 'height').get;
    let stale = true;
    window.__fixVV = () => (stale = false);
    Object.defineProperty(vv, 'height', { get: () => (stale ? staleVV : real.call(vv)) });
  }
  try {
    localStorage.removeItem('straitwatch.v3.run');
  } catch {
    // no storage
  }
}

/** Where the root, the canvas and the battlefield are, in CSS px. */
const measure = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    };
    const tl = window.__v3.toClient(0, 0);
    const br = window.__v3.toClient(1600, 900);
    return {
      root: box(document.getElementById('app')),
      canvas: box(document.querySelector('.v2-canvas')),
      backing: { w: document.querySelector('.v2-canvas').width, h: document.querySelector('.v2-canvas').height },
      map: { x: tl.x, y: tl.y, right: br.x, bottom: br.y },
    };
  });

/** iOS hands over the insets late: set them on :root (what env() feeds). */
const giveInsets = (page, sa) =>
  page.evaluate((sa) => {
    const s = document.documentElement.style;
    s.setProperty('--sa-t', `${sa.t}px`);
    s.setProperty('--sa-r', `${sa.r}px`);
    s.setProperty('--sa-b', `${sa.b}px`);
    s.setProperty('--sa-l', `${sa.l}px`);
  }, sa);

const fits = (m, w, h, label) => {
  const near = (a, b) => Math.abs(a - b) < 0.5;
  check(near(m.root.x, 0) && near(m.root.y, 0) && near(m.root.w, w) && near(m.root.h, h), `${label}: the game's root fills the ${w}×${h} screen exactly (${m.root.w}×${m.root.h})`);
  check(near(m.canvas.w, w) && near(m.canvas.h, h) && m.canvas.bottom <= h + 0.5, `${label}: the canvas fits the screen, nothing below it (${m.canvas.w}×${m.canvas.h})`);
};

const inSafeArea = (m, w, h, sa, label) => {
  const ok = m.map.x >= sa.l - 0.5 && m.map.y >= sa.t - 0.5 && m.map.right <= w - sa.r + 0.5 && m.map.bottom <= h - sa.b + 0.5;
  check(ok, `${label}: the battlefield sits inside the safe area (${m.map.x.toFixed(1)},${m.map.y.toFixed(1)} → ${m.map.right.toFixed(1)},${m.map.bottom.toFixed(1)}; bottom ≤ ${h - sa.b})`);
  // Fills the height it has: no smaller than the safe area allows.
  check(m.map.bottom - m.map.y >= h - sa.t - sa.b - 1 || m.map.right - m.map.x >= w - sa.l - sa.r - 144 - 1, `${label}: the battlefield is scaled to the room it has`);
};

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const phone = { viewport: { width: W, height: H }, screen: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
const errors = [];

// ---- 1. Safe-area insets that arrive after the first paint ----
{
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(initScript, { standalone: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  const before = await measure(page);
  fits(before, W, H, 'first load');
  check(before.backing.w === W * 2 && before.backing.h === H * 2, `first load: the canvas backing is ${W * 2}×${H * 2} (dpr capped at 2) (${before.backing.w}×${before.backing.h})`);
  // Past the launch's settling window: only the steady check can see them.
  await page.waitForTimeout(2200);
  await giveInsets(page, INSETS);
  await page.waitForTimeout(500);
  const after = await measure(page);
  fits(after, W, H, 'late insets');
  inSafeArea(after, W, H, INSETS, 'late insets, with no event');
  await ctx.close();
}

// ---- 2. First load at the wrong size, corrected with no event ----
{
  const ctx = await browser.newContext({ ...phone, viewport: { width: W, height: 440 } });
  await ctx.addInitScript(initScript, { standalone: false });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await giveInsets(page, INSETS);
  await page.setViewportSize({ width: W, height: H });
  await page.waitForTimeout(400);
  const m = await measure(page);
  fits(m, W, H, 'resized under it');
  inSafeArea(m, W, H, INSETS, 'resized under it');
  // And back to a size after a "rotation" with, again, no event heard.
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const m2 = await measure(page);
  fits(m2, 844, 390, 'resized again');
  inSafeArea(m2, 844, 390, INSETS, 'resized again');
  await ctx.close();
}

// ---- 3. A home-screen launch whose visualViewport reads too tall ----
{
  const ctx = await browser.newContext({ ...phone, screen: { width: H, height: W } });
  await ctx.addInitScript(initScript, { standalone: true, staleVV: 440 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await giveInsets(page, INSETS);
  await page.waitForTimeout(400);
  const m = await measure(page);
  check(await page.evaluate(() => window.visualViewport.height === 440), 'the stale visualViewport height is in place (440)');
  fits(m, W, H, 'stale visualViewport');
  inSafeArea(m, W, H, INSETS, 'stale visualViewport');
  await page.evaluate(() => window.__fixVV());
  await page.waitForTimeout(300);
  fits(await measure(page), W, H, 'visualViewport corrected');
  await ctx.close();
}

// ---- The player's screen, in a run (screenshot at deviceScaleFactor 1) ----
{
  const ctx = await browser.newContext({ ...phone, deviceScaleFactor: 1 });
  await ctx.addInitScript(initScript, { standalone: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await page.waitForTimeout(2200);
  await giveInsets(page, INSETS);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOT_DIR}/16-ios-landscape-menu.png` });
  await page.click('[data-map="strait"]');
  await page.waitForSelector('[data-screen="loadout"]');
  await page.click('[data-start]');
  await page.waitForSelector('.playing');
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__v3.freeze(true));
  const m = await measure(page);
  fits(m, W, H, 'in a run');
  inSafeArea(m, W, H, INSETS, 'in a run');
  // The rails stay on screen, inside the safe area.
  const rails = await page.evaluate(() => [...document.querySelectorAll('.v2-rail')].map((r) => r.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, b: r.bottom })));
  check(rails.length === 2 && rails.every((r) => r.l >= -0.5 && r.r <= W + 0.5 && r.b <= H - INSETS.b + 0.5), `in a run: both rails on screen, above the home indicator (${JSON.stringify(rails)})`);
  await page.screenshot({ path: `${SHOT_DIR}/16-ios-landscape-run.png` });
  await ctx.close();
}

check(errors.length === 0, `no page errors${errors.length ? ` (${errors[0]})` : ''}`);
await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall iOS viewport checks passed');
process.exit(failures ? 1 : 0);
