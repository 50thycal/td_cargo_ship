// Saltgate Canal's locks and frigates (docs/design/v3-saltgate-locks.md):
// the convoy waiting in a full chamber with the next pair held short of the
// entry gate, frigates sailing in from the sides, and the frigates on their
// berths. 844 x 390, 1x, touch.
//
// Usage: npx vite preview --outDir <dist> --port 4771 &
//        BASE_URL=http://localhost:4771 SHOT_DIR=<dir> node tools/v3/saltgate/shots.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? 'docs/design/img/saltgate';
mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) {
      const c = `${root}/${entry}/${dir}/chrome`;
      if (existsSync(c)) return c;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true };
const errs = [];
let bad = 0;
const check = (ok, msg) => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok' : 'FAIL'}: ${msg}`);
};

/** Saltgate's lab card, a run that can't be lost, the enemy held off (the
 *  shots are of the canal), at a flow above the default. */
async function open(page, flow) {
  await page.goto(`${BASE_URL}/v3.html?lab=map-saltgate&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.evaluate((flow) => {
    const g = window.__v3.game();
    g.tempo.lossLimit = 999;
    g.carrierHp = g.stats.carrierHp = 1e6;
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    g.threats = [];
    g.flow = flow;
  }, flow);
}

/** Step the run on in twentieths of a second until `cond` holds (or `max`
 *  s go by); true if it did. */
async function until(page, cond, max = 60) {
  return page.evaluate(
    ({ src, max }) => {
      const f = new Function('g', `return (${src})`);
      const g = window.__v3.game();
      for (let t = 0; t < max; t += 0.05) {
        if (f(g)) return true;
        window.__v3.advance(0.05);
      }
      return !!f(g);
    },
    { src: cond, max },
  );
}

/** Frigate Escort at `level`, called in as a player would: tap its drop. */
async function callFrigates(page, level) {
  const at = await page.evaluate((level) => {
    const g = window.__v3.game();
    g.levels.frigate = level;
    g.slots = ['frigate'];
    g.pickups.push({ id: 99901, kind: 'weapon', weapon: 'frigate', x: 900, y: 520, age: 0 });
    return window.__v3.toClient(900, 520);
  }, level);
  await page.touchscreen.tap(at.x, at.y);
  return page.evaluate(() => window.__v3.game().escorts.length);
}

async function shot(page, name) {
  await page.evaluate(() => window.__v3.freeze(true));
  // The opening cards fade first (real time).
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${OUT}/${name}-844x390.jpg`, quality: 85 });
  await page.evaluate(() => window.__v3.freeze(false));
}

try {
  const page = await browser.newPage(PHONE);
  page.on('pageerror', (e) => errs.push(e.message));

  // ---- A full chamber: the first lock's entry still open, its chamber
  // full in both files, the next pair held short of the gate (flow 3,
  // pairs). Before the fix that pair sailed on into the gateway. ----
  await open(page, 3);
  const full = await until(
    page,
    `(() => {
      const st = g.lockState[0];
      if (st.phase !== 'in' || st.t < 5) return false;
      const inChamber = g.ships.filter((s) => s.x > 480 && s.x < 660).length;
      const held = g.ships.filter((s) => Math.abs(s.x - 456) < 1).length;
      return inChamber >= 4 && held >= 2;
    })()`,
    90,
  );
  check(full, 'lock 0 open with four in its chamber and the next pair held at the entry');
  await shot(page, 'full-chamber');

  // ---- Frigates sailing in from the sides (level 3: two from the west,
  // one from the east) ----
  await open(page, 3);
  await until(page, `g.waveT > 12`, 20);
  check((await callFrigates(page, 3)) === 3, 'three frigates called in');
  await page.evaluate(() => window.__v3.advance(0.6));
  const inbound = await page.evaluate(() => window.__v3.game().escorts.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y), from: e.from })));
  check(inbound.every((e) => e.y > 590) && inbound.some((e) => e.from === -1 && e.x > 0 && e.x < 330) && inbound.some((e) => e.from === 1 && e.x > 1490), `sailing in beside the lane from both sides (${JSON.stringify(inbound)})`);
  await shot(page, 'frigates-in');

  // ---- On their berths, the convoy in the locks ----
  await until(page, `g.escorts.length === 3 && g.escorts.every((e) => Math.hypot(e.x - e.sx, e.y - e.sy) < 1)`, 10);
  await page.evaluate(() => window.__v3.advance(1.5));
  const berthed = await page.evaluate(() => window.__v3.game().escorts.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y) })));
  check(berthed.every((e) => e.x < 438 || e.x > 1362), `berthed outside the locks (${JSON.stringify(berthed)})`);
  await shot(page, 'frigates-berthed');

  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
} catch (e) {
  bad++;
  console.log('FAIL:', e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(bad ? 'SALTGATE SHOTS FAILED' : 'SALTGATE SHOTS DONE');
if (bad) process.exitCode = 1;
