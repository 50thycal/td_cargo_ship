// Enemy round 8 screenshots (docs/design/v3-enemies-round8.md), all at a
// landscape phone's size (874×402): the Decoy Drones' new tint against real
// drones (and up close, marked); a Torpedo Sub firing one by one on
// Saltgate Canal; a Scavenger's denial ring over locked pickups; a Spotter
// and its shells coming in from off the map; Beacon Strike on Dunmar
// Crossing. A Free Play wave, the enemy brought in through the dev hook,
// the clock frozen for each frame; Beacon Strike from its Test Lab card.
// Usage (with `npx vite preview --port <port>` serving a fresh build):
//   BASE_URL=http://localhost:<port> node tools/v3/enemies-round8/shots.mjs
// Writes docs/design/img/enemies-round8/*.jpg.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4295';
const OUT = new URL('../../../docs/design/img/enemies-round8/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const errors = [];
let page;

const quiet = () =>
  page.evaluate(() => {
    const g = window.__v3.game();
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    g.raiders = [];
    g.threats = [];
    g.pickups = [];
    g.flow = 3;
    g.foe.marks = [];
    g.lost = -99;
    g.carrierHp = Math.max(g.carrierHp, 99);
  });

/** A Free Play wave on `map`, `dsf` device pixels a CSS pixel, nothing
 *  launching on its own, the convoy sailing in. */
async function open(map, dsf = 2) {
  page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: dsf, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/v3.html?seed=3`, { waitUntil: 'networkidle' });
  await page.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.callouts', 'off');
    localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: m, wave: 4, weapons: [{ id: 'flak', level: 1 }], armory: { gun: null, hull: null, supply: null }, frequentDrops: false, enemies: 'none' }));
  }, map);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('[data-free-play]');
  await page.waitForSelector('[data-screen="freeplay"]');
  await page.click('[data-free-start]');
  await page.waitForSelector('.playing');
  await page.addStyleTag({ content: '.v2-overlay, #overlay, .v2-alerts { display: none !important; }' });
  await quiet();
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250);
    const n = await page.evaluate(() => window.__v3.game().ships.filter((s) => s.x > 250 && s.x < 1400).length);
    if (n >= 4) break;
  }
}

const wait = async (cond, ms = 30000, arg) => {
  for (let t = 0; t < ms; t += 40) {
    if (await page.evaluate(cond, arg)) return true;
    await page.waitForTimeout(40);
  }
  return false;
};

/** A world box {x, y, w} (16:9) as a clip on the page. */
const clip = (box) =>
  page.evaluate((f) => {
    const a = window.__v3.toClient(f.x, f.y);
    const b = window.__v3.toClient(f.x + f.w, f.y + (f.w * 9) / 16);
    return { x: Math.max(0, a.x), y: Math.max(0, a.y), width: Math.min(innerWidth, b.x) - Math.max(0, a.x), height: Math.min(innerHeight, b.y) - Math.max(0, a.y) };
  }, box);

const shot = async (name, box) => {
  const file = `${OUT}${name}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 84, ...(box ? { clip: await clip(box) } : {}) });
  console.log('wrote', file);
};
const freeze = (on) => page.evaluate((o) => window.__v3.freeze(o), on);

try {
  // ---- Decoy Drones: a swarm of six (three decoys), 3 s out.
  for (const close of [false, true]) {
    await open('strait', close ? 3 : 2);
    await page.evaluate(() => window.__v3.foe('decoy', 1));
    await wait(() => window.__v3.game().threats.some((t) => (t.kind === 'decoy' || t.kind === 'drone') && t.age > 3.2));
    await freeze(true);
    if (!close) await shot('decoys-phone');
    else {
      const box = await page.evaluate(() => {
        const s = window.__v3.game().threats.filter((t) => (t.kind === 'decoy' || t.kind === 'drone') && !t.dead);
        const x0 = Math.min(...s.map((t) => t.x));
        const x1 = Math.max(...s.map((t) => t.x));
        const y0 = Math.min(...s.map((t) => t.y));
        const y1 = Math.max(...s.map((t) => t.y));
        const w = Math.max(320, x1 - x0 + 120, ((y1 - y0 + 110) * 16) / 9);
        return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * 9) / 32, w };
      });
      await shot('decoys-close', box);
      await page.evaluate(() => {
        for (const t of window.__v3.game().threats.filter((o) => o.kind === 'decoy' && !o.dead)) {
          const p = window.__v3.toClient(t.x, t.y);
          const el = document.createElement('div');
          el.className = 'r8-mark';
          el.textContent = 'decoy';
          el.style.cssText = `position:fixed;left:${p.x - 16}px;top:${p.y + 12}px;width:32px;text-align:center;font:600 7px system-ui;color:#fff;background:rgba(0,0,0,.6);border-radius:2px;z-index:99;pointer-events:none`;
          document.body.appendChild(el);
        }
      });
      await shot('decoys-close-marked', box);
    }
    await page.close();
  }

  // ---- Torpedo Sub on Saltgate Canal: five torpedoes, one by one.
  await open('saltgate', 2);
  await page.evaluate(() => {
    window.__v3.foe('torpedoSub');
    const m = window.__v3.game().foe.marks.find((o) => o.kind === 'periscope');
    m.spread = 5;
    m.fast = -1;
  });
  for (const [k, name] of [[1, 'sub-1'], [3, 'sub-3'], [5, 'sub-5']]) {
    await wait((n) => (window.__v3.game().threats.find((t) => t.kind === 'torpedoSub')?.foe?.n ?? 0) >= n && window.__v3.game().threats.filter((t) => t.kind === 'torpedo').every((t) => t.age > 0.35), 30000, k);
    await freeze(true);
    await shot(name);
    await freeze(false);
  }
  await page.close();

  // ---- Scavenger: its ring over two pickups (a weapon among them), a
  // third outside it.
  for (const close of [false, true]) {
    await open('strait', close ? 3 : 2);
    await page.evaluate(() => {
      const g = window.__v3.game();
      const s = g.ships.filter((o) => o.x > 300 && o.x < 1300).sort((a, b) => a.x - b.x)[0] ?? g.ships[0];
      const y = s.y - 150;
      g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'flak', x: s.x, y, age: 0 });
      g.pickups.push({ id: g.nextId++, kind: 'repair', x: s.x + 70, y: y + 30, age: 0 });
      g.pickups.push({ id: g.nextId++, kind: 'ammo', x: s.x + 330, y: y + 10, age: 0 });
      window.__v3.foe('scavenger');
    });
    await wait(() => {
      const g = window.__v3.game();
      const sc = g.threats.find((t) => t.kind === 'scavenger');
      if (!sc) return false;
      for (const p of g.pickups) if (p.kind === 'ammo') p.age = 0;
      return g.pickups.filter((p) => Math.hypot(p.x - sc.x, p.y - sc.y) <= 120).length >= 2;
    });
    await page.waitForTimeout(600);
    await freeze(true);
    if (!close) await shot('scavenger-phone');
    else {
      const box = await page.evaluate(() => {
        const g = window.__v3.game();
        const sc = g.threats.find((t) => t.kind === 'scavenger');
        return { x: sc.x - 300, y: sc.y - 170, w: 600 };
      });
      await shot('scavenger-close', box);
    }
    await page.close();
  }

  // ---- Spotter: painting, then its shells coming in from off the map.
  await open('strait', 2);
  await page.evaluate(() => window.__v3.foe('spotter'));
  await wait(() => !!window.__v3.game().foe.paint, 40000);
  await page.waitForTimeout(1500);
  await freeze(true);
  await shot('spotter-paint');
  await freeze(false);
  // A shell fired but still beyond the edge (the chevron), then on screen.
  await wait(() => window.__v3.game().foe.marks.some((m) => m.kind === 'shell' && m.far && m.fired), 20000);
  await freeze(true);
  await shot('spotter-incoming-edge');
  await freeze(false);
  await wait(() => window.__v3.game().foe.marks.some((m) => m.kind === 'shell' && m.far && m.fired && m.dur - m.t < 0.8), 20000);
  await freeze(true);
  await shot('spotter-incoming');
  await freeze(false);
  await page.close();

  // ---- Beacon Strike: its Test Lab card on Dunmar Crossing, a beacon
  // marking a ship.
  page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('straitwatch.v3.callouts', 'off'));
  await page.goto(`${BASE}/v3.html?lab=ev-beacon-strike&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.v3-event-card.show');
  await page.waitForTimeout(400);
  await shot('beacon-strike-card');
  await page.waitForSelector('.playing.lab-on');
  await page.waitForTimeout(3600);
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.tempo = { ...g.tempo, lossLimit: 99 };
    g.carrierHp = Math.max(g.carrierHp, 99);
    const ev = g.event;
    window.__v3.advance(Math.max(0, ev.t0 + 3 + 3.2 - g.waveT));
  });
  await wait(() => window.__v3.game().threats.some((t) => t.kind === 'lure' && (t.foe?.marked ?? -1) >= 0 && t.foe.call - t.foe.t < 0.9), 20000);
  await freeze(true);
  // Back to the real limits for the HUD (its SUNK pips).
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.lossBase = g.lost;
    g.tempo = { ...g.tempo, lossLimit: 6 };
  });
  await page.waitForTimeout(150);
  await shot('beacon-strike');
  await page.close();
} finally {
  await browser.close();
}
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
