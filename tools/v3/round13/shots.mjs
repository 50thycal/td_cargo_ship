// Round 13 screenshots (docs/design/v3-round13-escorts-munitions-nuke.md):
// a Battle Group holding station beside a Spread convoy on The Strait and on
// Harbor Mouth, a frigate giving way to the convoy on the Needle of Bosk, and
// a supersonic arming on its rail. 844 x 390, 1x, touch.
//
// Usage: npx vite preview --outDir <dist> --port 4772 &
//        BASE_URL=http://localhost:4772 SHOT_DIR=<dir> node tools/v3/round13/shots.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? 'docs/design/img/round13';
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

/** A map's lab card, a run that can't be lost; `quiet`: the enemy held off
 *  (the shots are of the frigates and the convoy). */
async function open(page, map, { formation = 'spread', flow = 2, quiet = true } = {}) {
  await page.goto(`${BASE_URL}/v3.html?lab=map-${map}&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.evaluate(
    ({ formation, flow, quiet }) => {
      const g = window.__v3.game();
      g.tempo.lossLimit = 999;
      g.carrierHp = g.stats.carrierHp = 1e6;
      g.formation = formation;
      g.flow = flow;
      if (quiet) {
        g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
        g.raiderQueue = [];
        g.threats = [];
      }
    },
    { formation, flow, quiet },
  );
}

/** Step the run on in twentieths of a second until `cond` holds (or `max`
 *  s go by); true if it did. */
async function until(page, cond, max = 60) {
  return page.evaluate(
    ({ src, max }) => {
      const f = new Function('g', `return (${src})`);
      const g = window.__v3.game();
      for (let t = 0; t < max; t += 0.05) {
        for (const s of g.ships) s.hp = Math.max(s.hp, 1);
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
    g.pickups.push({ id: 99901, kind: 'weapon', weapon: 'frigate', x: 800, y: 470, age: 0 });
    return window.__v3.toClient(800, 470);
  }, level);
  await page.touchscreen.tap(at.x, at.y);
  return page.evaluate(() => window.__v3.game().escorts.length);
}

/** The closest any frigate's hull comes to a cargo hull right now (px of
 *  water between the boxes as drawn, roughly: centre to centre less the
 *  half-beams, across). */
const clearance = (page) =>
  page.evaluate(() => {
    const g = window.__v3.game();
    let m = Infinity;
    for (const e of g.escorts)
      for (const s of g.ships) {
        const dx = s.x - e.x;
        const dy = s.y - e.y;
        const along = Math.abs(dx * Math.cos(e.heading) + dy * Math.sin(e.heading));
        const across = Math.abs(-dx * Math.sin(e.heading) + dy * Math.cos(e.heading));
        if (along < 76 + 34) m = Math.min(m, across - 12 - 10);
      }
    return Math.round(m);
  });

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

  // ---- A Battle Group on station beside a Spread convoy ----
  for (const map of ['strait', 'harbor']) {
    await open(page, map);
    await until(page, `g.ships.filter((s) => s.x > 300 && s.x < 1300).length >= 7`, 60);
    check((await callFrigates(page, 3)) === 3, `${map}: three frigates called in`);
    const on = await until(page, `g.escorts.length === 3 && g.escorts.every((e) => Math.abs(e.d - e.sd) < 1)`, 15);
    await page.evaluate(() => window.__v3.advance(1));
    const gap = await clearance(page);
    check(on && gap >= 4, `${map}: all three on station, ${gap} px of water to the nearest hull beside them`);
    await shot(page, `battlegroup-${map}`);
  }

  // ---- The Needle: a frigate giving way (holding back behind or abeam a
  // hull, or stepping aside) as it sails in or out among the convoy ----
  await open(page, 'needle', { formation: 'spread', flow: 3 });
  await until(page, `g.waveT > 30`, 40);
  let found = false;
  for (let k = 0; k < 6 && !found; k++) {
    await callFrigates(page, 3);
    found = await page.evaluate(() => {
      const g = window.__v3.game();
      const prev = new Map();
      for (let t = 0; t < 40; t += 1 / 60) {
        for (const s of g.ships) s.hp = Math.max(s.hp, 1);
        for (const e of g.escorts) {
          const was = prev.get(e.id);
          prev.set(e.id, e.d);
          if (was === undefined || Math.abs(e.d - e.sd) < 1) continue;
          const v = Math.abs(e.d - was) * 60;
          const near = Math.min(...g.ships.map((s) => Math.hypot(s.x - e.x, s.y - e.y)));
          if (v < 150 && near < 120 && e.x > 120 && e.x < 1480 && e.y > 60 && e.y < 840) return true;
        }
        window.__v3.advance(1 / 60);
        if (!g.weapon && !g.escorts.length) return false;
      }
      return false;
    });
  }
  const gap = await clearance(page);
  check(found && gap >= 0, `needle: a frigate slowed to give way beside the convoy (${gap} px of water to the nearest hull)`);
  await shot(page, 'giveway-needle');

  // ---- A supersonic arming on its rail (The Strait): no target yet ----
  await open(page, 'strait', { formation: 'pairs', quiet: true });
  await until(page, `g.ships.filter((s) => s.x > 300 && s.x < 1300).length >= 4`, 40);
  const base = await page.evaluate(() => {
    const g = window.__v3.game();
    const i = g.map.bases.findIndex((b) => b.kinds.includes('supersonic'));
    g.queue.unshift({ at: g.waveT, kind: 'supersonic', base: i });
    return i;
  });
  await page.evaluate(() => window.__v3.advance(0.6));
  const rail = await page.evaluate(() => {
    const g = window.__v3.game();
    const m = g.threats.find((t) => t.kind === 'supersonic');
    return m ? { x: Math.round(m.x), y: Math.round(m.y), age: m.age } : null;
  });
  check(base >= 0 && !!rail && rail.age < 1.1, `a supersonic arming on its rail (${JSON.stringify(rail)})`);
  // A tap right on it: nothing is fired at it.
  const at = await page.evaluate((r) => window.__v3.toClient(r.x, r.y), rail);
  await page.touchscreen.tap(at.x, at.y);
  const shotAt = await page.evaluate(() => {
    const g = window.__v3.game();
    const m = g.threats.find((t) => t.kind === 'supersonic');
    return g.interceptors.some((i) => i.target === m?.id);
  });
  check(!shotAt, 'a tap on it fires nothing at it');
  await shot(page, 'supersonic-rail');

  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
} catch (e) {
  bad++;
  console.log('FAIL:', e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(bad ? 'ROUND 13 SHOTS FAILED' : 'ROUND 13 SHOTS DONE');
if (bad) process.exitCode = 1;
