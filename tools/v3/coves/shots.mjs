// The Coves' boats (log v72): a boat surfacing in its cove, a gunboat on its
// station off a ship's beam, a rocket boat holding its range. 874 x 402 at
// 2x, touch, as the iPhone plays it.
//
// Usage: npx vite preview --outDir <dist> --port 4772 &
//        BASE_URL=http://localhost:4772 SHOT_DIR=<dir> node tools/v3/coves/shots.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? 'docs/design/img/coves';
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
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const errs = [];
let bad = 0;
const check = (ok, msg) => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok' : 'FAIL'}: ${msg}`);
};

/** The Coves' lab card, a run that can't be lost, nothing launching. */
async function open(wave = 6) {
  const page = await browser.newPage(PHONE);
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?lab=map-coves&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.evaluate((wave) => {
    const g = window.__v3.game();
    g.tempo.lossLimit = 999;
    g.carrierHp = g.stats.carrierHp = 1e6;
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    g.threats = [];
    g.wave = wave;
    // No "new enemy" card over the pictures.
    g.seen.add('fastboat');
  }, wave);
  // Let the opening cards go (real time), the game frozen meanwhile.
  await page.evaluate(() => window.__v3.freeze(true));
  await page.waitForTimeout(6500);
  await page.evaluate(() => window.__v3.freeze(false));
  return page;
}

/** Step the run on in twentieths of a second until `cond` holds. */
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

async function launch(page, kind, base, boat) {
  await page.evaluate(
    ({ kind, base, boat }) => {
      const g = window.__v3.game();
      g.queue = [{ at: g.waveT + 0.02, kind, base, aim: 'mid', ...(boat ? { boat } : {}) }, { at: 1e9, kind: 'drone', base: 0 }];
    },
    { kind, base, boat },
  );
}

async function shot(page, name, clip) {
  await page.evaluate(() => window.__v3.freeze(true));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  await page.evaluate(() => window.__v3.freeze(false));
}

/** A client-space box round a world point. */
async function around(page, x, y, w, h) {
  const c = await page.evaluate(([x, y]) => window.__v3.toClient(x, y), [x, y]);
  return { x: Math.max(0, c.x - w / 2), y: Math.max(0, c.y - h / 2), width: w, height: h };
}

try {
  let page = await open(3);

  // ---- A speedboat surfacing in the north-east cove ----
  await launch(page, 'fastboat', 6);
  await until(page, `g.threats.some((t) => t.kind === 'fastboat')`, 2);
  const cove = await page.evaluate(() => {
    const g = window.__v3.game();
    return g.map.bases[6];
  });
  for (const [name, age] of [['a-under', 0.15], ['b-rising', 0.5], ['c-up', 0.95], ['d-out', 1.9]]) {
    await until(page, `(g.threats.find((t) => t.kind === 'fastboat')?.age ?? 9) >= ${age}`, 3);
    const clip = await around(page, cove.x, cove.y + 20, 220, 150);
    await shot(page, `cove-${name}`, clip);
  }
  const lane = await page.evaluate(() => {
    const t = window.__v3.game().threats.find((x) => x.kind === 'fastboat');
    return t ? { x: t.x, y: t.y, mouth: !!t.mouth } : null;
  });
  check(lane && !lane.mouth, `the boat is out of the mouth (${JSON.stringify(lane)})`);
  await shot(page, 'cove-wide');

  // ---- A gunboat on its station off a ship's beam ----
  await page.close();
  page = await open(6);
  await until(page, `g.ships.length >= 6`, 60);
  await launch(page, 'fastboat', 7, 'gun');
  const ok = await until(page, `g.threats.some((t) => t.boat === 'gun' && t.bs && t.bs.mode === 'side' && g.t - t.bs.flash < 0.3)`, 40);
  check(ok, 'a gunboat on station, shelling');
  const info = await page.evaluate(() => {
    const g = window.__v3.game();
    const t = g.threats.find((x) => x.boat === 'gun');
    const s = t && g.ships.find((o) => o.id === t.bs.ship);
    return t && s ? { d: Math.hypot(t.x - s.x, t.y - s.y), x: t.x, y: t.y, near: Math.min(...g.ships.map((o) => Math.hypot(t.x - o.x, t.y - o.y))) } : null;
  });
  check(info && info.d > 130 && info.near > 60, `the gunboat stands off its ship (${JSON.stringify(info)})`);
  await shot(page, 'gunboat-standoff');
  const clip = info ? await around(page, info.x, info.y - 70, 360, 220) : undefined;
  await shot(page, 'gunboat-standoff-close', clip);

  // ---- A rocket boat holding its range ----
  await page.close();
  page = await open(6);
  await until(page, `g.ships.length >= 6`, 60);
  await launch(page, 'fastboat', 4, 'rocket');
  const up = await until(page, `g.threats.some((t) => t.boat === 'rocket' && t.bs && t.bs.mode === 'raise')`, 40);
  check(up, 'a rocket boat raising its launcher');
  await shot(page, 'rocket-standoff');

  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
} catch (e) {
  bad++;
  console.log('FAIL:', e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(bad ? 'COVES SHOTS FAILED' : 'COVES SHOTS DONE');
if (bad) process.exitCode = 1;
