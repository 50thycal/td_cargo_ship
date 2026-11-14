// Round 11, part B screenshots (docs/design/v3-round11-map-notes.md), on a
// phone held both ways (844 x 390 and 390 x 844, at 1x): the Drone Storm
// running, The Breakout's opening (plain drone swarms now), Point Defense
// firing at a bomber's missiles while the bomber flies on untouched, and a
// Laser Cutter tap (no shell; "SWIPE TO CUT").
// Usage (with `npx vite preview --port <port>` serving a fresh build):
//   BASE_URL=http://localhost:<port> node tools/v3/round11/shots-b.mjs [outDir]
// Writes docs/design/img/round11/b-*.jpg (or to outDir).
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4741';
const OUT = process.argv[2] ? `${process.argv[2].replace(/\/$/, '')}/` : new URL('../../../docs/design/img/round11/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) if (existsSync(`${root}/${entry}/${dir}/chrome`)) return `${root}/${entry}/${dir}/chrome`;
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const errors = [];
const facts = {};
let page;
let tag = '';

const wait = async (cond, ms = 30000, arg) => {
  for (let t = 0; t < ms; t += 25) {
    if (await page.evaluate(cond, arg)) return true;
    await page.waitForTimeout(25);
  }
  return false;
};
const shot = async (name, clip) => {
  const file = `${OUT}b-${name}-${tag}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 78, ...(clip ? { clip } : {}) });
  console.log('wrote', file);
};
/** A world box round (x, y), `w` wide (16:9), as a clip on the page. */
const around = (x, y, w) =>
  page.evaluate(([cx, cy, cw]) => {
    const a = window.__v3.toClient(cx - cw / 2, cy - (cw * 9) / 32);
    const b = window.__v3.toClient(cx + cw / 2, cy + (cw * 9) / 32);
    return { x: Math.max(0, a.x), y: Math.max(0, a.y), width: Math.min(innerWidth, b.x) - Math.max(0, a.x), height: Math.min(innerHeight, b.y) - Math.max(0, a.y) };
  }, [x, y, w]);
const freeze = (on) => page.evaluate((o) => window.__v3.freeze(o), on);

async function newPage(w, h, dsf = 1) {
  page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
  await page.goto(`${BASE}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.callouts', 'off');
  });
}

/** A Free Play wave on The Strait holding `weapons`, nothing launching on
 *  its own, the convoy sailing in. */
async function freePlay(weapons) {
  await page.evaluate((ws) => localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: 'strait', wave: 4, weapons: ws, armory: { gun: null, hull: null, supply: null }, frequentDrops: false, enemies: 'none' })), weapons);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-free-play]');
  await page.waitForSelector('[data-screen="freeplay"]');
  await page.click('[data-free-start]');
  await page.waitForSelector('.playing');
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    g.threats = [];
    g.pickups = [];
    g.flow = 3;
    g.lost = -99;
    g.carrierHp = 99;
  });
  await wait(() => window.__v3.game().ships.filter((s) => s.x > 250 && s.x < 1400).length >= 3, 40000);
}

const load = (id, level) =>
  page.evaluate(([i, l]) => {
    const g = window.__v3.game();
    g.levels[i] = l;
    if (!g.slots.includes(i)) g.slots.push(i);
    g.weapon = { id: i, level: l, t: 30, t0: g.t };
  }, [id, level]);

try {
  for (const [w, h] of [[844, 390], [390, 844]]) {
    tag = `${w}x${h}`;

    // ---- The Drone Storm (Kesh), from its Test Lab card, a few seconds in.
    await newPage(w, h);
    await page.goto(`${BASE}/v3.html?lab=ev-drone-storm&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.playing.lab-on');
    await wait(() => {
      const g = window.__v3.game();
      return g.event && g.threats.filter((t) => t.kind === 'drone' && !t.dead && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900).length >= 10;
    }, 40000);
    await freeze(true);
    facts[`storm-${tag}`] = await page.evaluate(() => {
      const g = window.__v3.game();
      return { event: g.event?.id, kinds: [...new Set(g.threats.map((t) => t.kind))], drones: g.threats.filter((t) => t.kind === 'drone' && !t.dead).length, sent: g.event?.sent };
    });
    await shot('drone-storm');
    await page.close();
    // Held upright the game asks to be turned and pauses (it is landscape
    // only): one frame of that is all there is to see.
    if (h > w) continue;

    // ---- The Breakout (Harbor Mouth): its opening, drone swarms and a
    // sprint swarm, no ammo drops.
    await newPage(w, h);
    await page.goto(`${BASE}/v3.html?lab=ev-breakout&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.playing.lab-on');
    await wait(() => {
      const g = window.__v3.game();
      return g.event && g.threats.some((t) => t.kind === 'sprinter' && !t.dead && t.age > 1.2) && g.threats.filter((t) => t.kind === 'drone' && !t.dead).length >= 5;
    }, 40000);
    await freeze(true);
    facts[`breakout-${tag}`] = await page.evaluate(() => {
      const g = window.__v3.game();
      return { event: g.event?.id, kinds: [...new Set(g.threats.filter((t) => !t.dead).map((t) => t.kind))], sent: g.event?.sent };
    });
    await shot('breakout-opening');
    await page.close();

    // ---- Point Defense (MAX) over a bomber's run: its interceptors go for
    // the bomber's missiles; the bomber is never a target. The phone frame
    // at 1x, then the same moment again at 3x for a close-up.
    for (const dsf of [1, 3]) {
    await newPage(w, h, dsf);
    await freePlay([{ id: 'aegis', level: 3 }]);
    await load('aegis', 3);
    await page.evaluate(() => {
      const g = window.__v3.game();
      g.queue.unshift({ at: g.waveT, kind: 'bomber', base: -1 });
      window.__aim = [];
    });
    const got = await wait(() => {
      const g = window.__v3.game();
      g.weapon && (g.weapon.t = 30);
      for (const i of g.interceptors) if (i.by === 'aegis' && i.target !== null && !window.__aim.includes(i.target)) window.__aim.push(i.target);
      const b = g.threats.find((t) => t.kind === 'bomber' && !t.dead);
      const live = g.interceptors.filter((i) => i.by === 'aegis' && g.threats.some((t) => t.id === i.target && t.kind === 'guided' && !t.dead));
      return !!b && b.x > 60 && b.x < 1540 && live.length >= 1 && live.some((i) => i.life > 0.2);
    }, 40000);
    await freeze(true);
    facts[`aegis-${tag}-${dsf}x`] = await page.evaluate((ok) => {
      const g = window.__v3.game();
      const b = g.threats.find((t) => t.kind === 'bomber' && !t.dead);
      const aimed = window.__aim.map((id) => g.threats.find((t) => t.id === id)?.kind ?? 'gone');
      return { ok, bomberHp: b ? `${b.hp}/3` : 'gone', aimedAt: aimed, missiles: g.threats.filter((t) => t.kind === 'guided' && t.parent === 'bomber' && !t.dead).length };
    }, got);
    if (dsf === 1) await shot('aegis-bomber');
    const near = await page.evaluate(() => {
      const g = window.__v3.game();
      const b = g.threats.find((t) => t.kind === 'bomber' && !t.dead);
      const it = g.interceptors.find((i) => i.by === 'aegis');
      return b && it ? { x: (b.x + it.x) / 2, y: (b.y + it.y) / 2, w: Math.max(420, Math.abs(b.x - it.x) * 1.4 + 160) } : null;
    });
    if (near && dsf > 1) await shot('aegis-bomber-close', await around(near.x, near.y, near.w));
    await page.close();
    }

    // ---- Laser Cutter: a tap on a drone fires nothing and says so.
    await newPage(w, h);
    await freePlay([{ id: 'cutter', level: 1 }]);
    await load('cutter', 1);
    await page.evaluate(() => {
      const g = window.__v3.game();
      for (let k = 0; k < 3; k++) g.queue.unshift({ at: g.waveT, kind: 'drone', base: 1 });
    });
    await wait(() => window.__v3.game().threats.filter((t) => t.kind === 'drone').length >= 3);
    const target = await page.evaluate(() => {
      const g = window.__v3.game();
      const s = g.ships.filter((o) => o.x > 300 && o.x < 1300).sort((a, b) => a.x - b.x)[0] ?? g.ships[0];
      const d = g.threats.filter((t) => t.kind === 'drone');
      d.forEach((t, k) => {
        t.x = s.x - 120 + k * 110;
        t.y = s.y - 230 + (k % 2) * 30;
        t.speed = 8;
      });
      const t = d[1] ?? d[0];
      return { ...window.__v3.toClient(t.x, t.y), ammo: g.ammo, shells: g.interceptors.length };
    });
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForTimeout(140);
    await freeze(true);
    facts[`cutter-${tag}`] = await page.evaluate((t0) => {
      const g = window.__v3.game();
      return { ammoBefore: t0.ammo, ammo: g.ammo, shells: g.interceptors.length, hint: g.fx.filter((f) => f.text === 'SWIPE TO CUT').length, taps: g.taps };
    }, target);
    await shot('cutter-tap');
    await page.close();
  }
} catch (e) {
  errors.push(String(e.stack ?? e));
} finally {
  await browser.close();
}
console.log(JSON.stringify(facts, null, 1));
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
