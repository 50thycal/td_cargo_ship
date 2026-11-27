// The note keyboard and the typing dialog stay clear of the camera cut-out
// (the Dynamic Island), upright and sideways. iPhone 16 Pro insets are set the
// way iOS feeds them (--sa-* on :root, which the game's safe-area probe reads).
//
// Usage:  npm run dev -- --port 5173 &  BASE_URL=http://localhost:5173 node e2e/v3-keys-safe-area.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3-keys';
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

// iPhone 16 Pro: 402×874 upright (island on top), 874×402 sideways (island on the left).
const CASES = [
  { name: 'upright', viewport: { width: 402, height: 874 }, insets: { t: 62, r: 0, b: 34, l: 0 }, angle: 0 },
  { name: 'sideways, island left', viewport: { width: 874, height: 402 }, insets: { t: 0, r: 62, b: 21, l: 62 }, angle: 90 },
  { name: 'sideways, island right', viewport: { width: 874, height: 402 }, insets: { t: 0, r: 62, b: 21, l: 62 }, angle: 270 },
];

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
try {
  for (const c of CASES) {
    const ctx = await browser.newContext({
      viewport: c.viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await ctx.addInitScript(() => {
      try { localStorage.removeItem('straitwatch.v3.run'); } catch { /* no storage */ }
      window.__angle = 90;
      Object.defineProperty(screen, 'orientation', { value: { get angle() { return window.__angle; }, addEventListener() {}, removeEventListener() {} } });
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { console.error('page error', e.message); failures++; });
    const setInsets = (sa, angle) => page.evaluate(([sa, angle]) => {
      window.__angle = angle;
      const s = document.documentElement.style;
      s.setProperty('--sa-t', `${sa.t}px`);
      s.setProperty('--sa-r', `${sa.r}px`);
      s.setProperty('--sa-b', `${sa.b}px`);
      s.setProperty('--sa-l', `${sa.l}px`);
    }, [sa, angle]);
    // Menus are landscape-only: get to the note dialog sideways, then turn the phone if the case says so.
    await page.setViewportSize({ width: 874, height: 402 });
    await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
    await setInsets({ t: 0, r: 62, b: 21, l: 62 }, 90);
    await page.waitForTimeout(300);
    await page.tap('[data-map="strait"]');
    await page.tap('[data-start]');
    await page.waitForSelector('.playing');
    await page.waitForTimeout(1200);
    await page.tap('.v2-pause');
    await page.tap('.v3-pause-note');
    await page.waitForSelector('.v3-note-text');
    await page.setViewportSize(c.viewport);
    await setInsets(c.insets, c.angle);
    await page.waitForTimeout(600);
    await page.tap('.v3-note-text');
    await page.waitForSelector('.pk.pk-visible');
    await page.waitForTimeout(600);

    const m = await page.evaluate(() => {
      const rect = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
      const keys = [...document.querySelectorAll('.pk-row .pk-key')].map(rect);
      const cs = getComputedStyle(document.documentElement);
      return {
        w: innerWidth,
        box: rect(document.querySelector('.v3-note-text')),
        save: rect(document.querySelector('.v3-note-save')),
        keysLeft: Math.min(...keys.map((k) => k.l)),
        keysRight: Math.max(...keys.map((k) => k.r)),
        kbLeftVar: cs.getPropertyValue('--kb-safe-left').trim(),
        clipped: [...document.querySelectorAll('.pk-key-custom .pk-key-label')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent),
      };
    });
    console.log(c.name, JSON.stringify(m));
    // Where the island is: the top, or the side the phone's top is on.
    const left = c.insets.l, right = c.insets.r;
    const islandLeft = c.angle === 90 ? left : c.angle === 270 ? 0 : left;
    const islandRight = c.angle === 270 ? right : c.angle === 90 ? 0 : right;
    check(m.box.t >= c.insets.t, `${c.name}: the text box starts below the island (top ${Math.round(m.box.t)} ≥ ${c.insets.t})`);
    check(m.box.l >= islandLeft && m.box.r <= m.w - islandRight, `${c.name}: the text box is clear of the island sideways (${Math.round(m.box.l)}–${Math.round(m.box.r)} of ${m.w})`);
    check(m.save.r <= m.w - islandRight && m.save.l >= islandLeft, `${c.name}: Save is clear of the island`);
    check(m.keysLeft >= islandLeft - 0.5 && m.keysRight <= m.w - islandRight + 0.5, `${c.name}: every key is clear of the island (${Math.round(m.keysLeft)}–${Math.round(m.keysRight)}, island ${islandLeft}/${islandRight})`);
    check(m.clipped.length === 0, `${c.name}: no hotkey label is cut off (${m.clipped.join(', ') || 'none'})`);
    await page.screenshot({ path: `${SHOT_DIR}/safe-${c.name.replace(/[^a-z]+/gi, '-')}.png` });
    await ctx.close();
  }
} finally {
  await browser.close();
}
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('v3 keys safe-area e2e: all checks passed');
