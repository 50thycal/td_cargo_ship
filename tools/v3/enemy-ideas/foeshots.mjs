// Screenshots of the new enemies as built, in a real Free Play wave at phone
// size (667×375): each one frozen at its tell, cropped round it. They are the
// build's visual check, and the review page's Build tab shows them.
// Usage (with `npx vite preview --port 4173` running on a fresh build):
//   node tools/v3/enemy-ideas/foeshots.mjs [id ...]
// Writes docs/design/img/enemy-build/<id>-<moment>.jpg.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = new URL('../../../docs/design/img/enemy-build/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

/**
 * Each scenario: the foe to bring in, then moments to catch. `until` runs in
 * the page with `g` (the game) and `foes` (the live threats of that kind);
 * `focus` returns the world box {x, y, w} to crop to (16:9).
 */
export const SCENES = {
  sprinter: {
    kind: 'sprinter',
    moments: [
      { name: 'flare', until: `foes.some((t) => t.foe.state === 1)`, focus: `(() => { const t = foes.find((t) => t.foe.state === 1); return { x: t.x - 330, y: t.y - 160, w: 660 }; })()` },
      { name: 'sprint', until: `foes.some((t) => t.foe.state === 2 && t.foe.t > 0.12)`, focus: `(() => { const t = foes.find((t) => t.foe.state === 2); return { x: t.x - 330, y: t.y - 200, w: 660 }; })()` },
    ],
  },
  decoy: {
    kind: 'decoy',
    moments: [
      { name: 'far', until: `g.threats.filter((t) => t.kind === 'decoy' || t.kind === 'drone').every((t) => t.y > 190)`, focus: `(() => { const t = foes[0]; return { x: t.x - 330, y: t.y - 140, w: 660 }; })()` },
      { name: 'close', until: `foes.some((t) => t.foe.state === 1)`, focus: `(() => { const t = foes.find((t) => t.foe.state === 1); return { x: t.x - 330, y: t.y - 160, w: 660 }; })()` },
    ],
  },
  hydra: {
    kind: 'hydra',
    // Two taps on it once it is out, so it splits.
    shoot: 2,
    moments: [
      { name: 'flying', until: `foes.length && foes[0].age > 0.6`, focus: `(() => { const t = foes[0]; return { x: t.x - 300, y: t.y - 150, w: 600 }; })()` },
      { name: 'split', until: `g.threats.some((t) => t.kind === 'dart' && t.age > 0.15)`, focus: `(() => { const t = g.threats.find((t) => t.kind === 'dart'); return { x: t.x - 300, y: t.y - 170, w: 600 }; })()` },
    ],
  },
  rocketTruck: {
    kind: 'rocketTruck',
    moments: [
      { name: 'raise', until: `foes.some((t) => t.foe.state === 1 && t.foe.t > 1.4)`, focus: `(() => { const t = foes[0]; return { x: t.x - 380, y: t.y - 60, w: 760 }; })()` },
      { name: 'fire', until: `g.foe.shots.some((s) => s.t / s.dur > 0.45)`, focus: `(() => { const t = foes[0]; const s = g.foe.shots[0]; const x = Math.min(t.x, s.tx) - 120; return { x, y: Math.min(t.y, s.ty) - 80, w: Math.max(700, Math.abs(t.x - s.tx) + 240) }; })()` },
    ],
  },
  loiter: {
    kind: 'loiter',
    moments: [
      { name: 'circle', until: `foes.length && foes.every((t) => t.foe.state === 1) && foes[0].foe.t > 0.6`, focus: `(() => { const f = foes[0].foe; return { x: f.px - 360, y: f.py - 230, w: 720 }; })()` },
      { name: 'dive', until: `foes.some((t) => t.foe.state === 2 && t.foe.t > 0.35)`, focus: `(() => { const f = foes[0].foe; return { x: f.px - 360, y: f.py - 210, w: 720 }; })()` },
    ],
  },
  // ---- Chapter 2.
  attackHeli: {
    kind: 'attackHeli',
    moments: [
      { name: 'arrive', until: `foes.length && foes[0].foe.state === 0 && foes[0].age > 1.6`, focus: `(() => { const t = foes[0], f = t.foe; const x = Math.min(t.x, f.px) - 160; return { x, y: Math.min(t.y, f.py) - 140, w: Math.max(640, Math.abs(t.x - f.px) + 320) }; })()` },
      { name: 'fire', until: `g.threats.some((t) => t.kind === 'heliRocket' && t.age > 0.5)`, focus: `(() => { const t = foes[0]; return { x: t.x - 340, y: t.y - 140, w: 680 }; })()` },
    ],
  },
  torpedoSub: {
    kind: 'torpedoSub',
    moments: [
      { name: 'periscope', until: `g.foe.marks.some((m) => m.kind === 'periscope' && m.t > 0.9)`, focus: `(() => { const m = g.foe.marks[0]; return { x: m.x - 320, y: m.y - 180, w: 640 }; })()` },
      { name: 'torpedo', until: `g.threats.some((t) => t.kind === 'torpedo' && t.age > 1.4)`, focus: `(() => { const t = g.threats.find((t) => t.kind === 'torpedo'); const f = t.foe; const x = Math.min(f.sx, f.px) - 120; return { x, y: Math.min(f.sy, f.py) - 120, w: Math.max(640, Math.abs(f.sx - f.px) + 240) }; })()` },
    ],
  },
  armored: {
    kind: 'armored',
    moments: [
      { name: 'plate', until: `foes.length && foes[0].age > 1.2 && foes[0].foe.state === 0`, focus: `(() => { const t = foes[0]; return { x: t.x - 300, y: t.y - 150, w: 600 }; })()` },
      { name: 'bank', until: `foes.length && foes[0].foe.state === 1 && foes[0].foe.t > 0.6`, focus: `(() => { const t = foes[0]; return { x: t.x - 300, y: t.y - 170, w: 600 }; })()` },
    ],
  },
  crossWing: {
    kind: 'crosser',
    base: 0,
    moments: [
      { name: 'closing', until: `foes.length && foes.every((t) => t.foe.state === 0) && foes[0].age > 1.6`, focus: `(() => { const f = foes[0].foe; return { x: f.px - 420, y: f.py - 260, w: 840 }; })()` },
      { name: 'peel', until: `foes.length && foes.filter((t) => t.foe.state === 1).length >= 4`, focus: `(() => { const f = foes[0].foe; return { x: f.px - 420, y: f.py - 220, w: 840 }; })()` },
    ],
  },
  scavenger: {
    kind: 'scavenger',
    setup: `g.pickups.push({ id: 99001, kind: 'repair', x: 760, y: 330, age: -6 })`,
    moments: [
      { name: 'seek', until: `foes.length && foes[0].foe.link === 99001 && foes[0].y > 150`, focus: `(() => { const t = foes[0]; return { x: Math.min(t.x, 760) - 260, y: 80, w: Math.max(600, Math.abs(t.x - 760) + 520) }; })()` },
    ],
  },
  // ---- Chapter 3.
  stealthJet: {
    kind: 'stealthJet',
    moments: [{ name: 'run', until: `foes.length && foes[0].x > 200 && foes[0].x < 1400`, focus: `(() => { const t = foes[0]; return { x: t.x - 330, y: t.y - 180, w: 660 }; })()` }],
  },
  stealthBomber: {
    kind: 'stealthBomber',
    moments: [{ name: 'run', until: `foes.length && foes[0].x > 260 && foes[0].x < 1340`, focus: `(() => { const t = foes[0]; return { x: t.x - 330, y: t.y - 180, w: 660 }; })()` }],
  },
  diveBomber: {
    kind: 'diveBomber',
    moments: [
      { name: 'circle', until: `g.foe.marks.some((m) => m.kind === 'dive' && m.t > 1.3)`, focus: `(() => { const m = g.foe.marks.find((m) => m.kind === 'dive'); return { x: m.x - 300, y: m.y - 230, w: 600 }; })()` },
      { name: 'dive', until: `foes.length && foes[0].foe.state === 0 && foes[0].foe.t > 1.0`, focus: `(() => { const f = foes[0].foe; return { x: f.px - 300, y: f.py - 250, w: 600 }; })()` },
    ],
  },
  siege: {
    kind: 'siege',
    moments: [
      { name: 'circles', until: `g.foe.marks.some((m) => m.kind === 'shell' && m.t > 1.2)`, focus: `(() => { const t = foes[0]; return { x: 140, y: Math.max(0, t.y - 60), w: 1320 }; })()` },
      { name: 'shells', until: `g.foe.marks.some((m) => m.kind === 'shell' && m.fired && m.dur - m.t < 0.6)`, focus: `(() => { const t = foes[0]; return { x: 140, y: Math.max(0, t.y - 60), w: 1320 }; })()` },
    ],
  },
  spotter: {
    kind: 'spotter',
    moments: [{ name: 'paint', until: `!!g.foe.paint && foes.length && foes[0].foe.t > 3`, focus: `(() => { const t = foes[0]; const s = g.ships.find((o) => o.id === g.foe.paint.ship); const x = Math.min(t.x, s.x) - 180; return { x, y: Math.min(t.y, s.y) - 160, w: Math.max(680, Math.abs(t.x - s.x) + 360) }; })()` }],
  },
  // ---- Chapter 4.
  tender: {
    kind: 'tender',
    // A hurt heavy, slow, within the tender's reach, so it mends it.
    setup: `setTimeout(() => { const g2 = window.__v3.game(); const h = g2.threats.find((t) => t.kind === 'heavy'); const t = g2.threats.find((o) => o.kind === 'tender'); if (h && t) { h.hp = 3; h.speed = 8; h.x = t.x + 180; h.y = t.y - 40; } }, 200)`,
    moments: [{ name: 'beam', until: `foes.length && foes[0].foe.state === 1 && foes[0].foe.t > 0.6`, focus: `(() => { const t = foes[0]; const h = g.threats.find((o) => o.id === t.foe.link) ?? t; const x = Math.min(t.x, h.x) - 200; return { x, y: Math.min(t.y, h.y) - 140, w: Math.max(640, Math.abs(t.x - h.x) + 400) }; })()` }],
  },
  bodyguard: {
    kind: 'guard',
    moments: [{ name: 'ring', until: `foes.length && foes[0].age > 1.8`, focus: `(() => { const h = g.threats.find((t) => t.kind === 'heavy'); return { x: h.x - 280, y: h.y - 150, w: 560 }; })()` }],
  },
  picket: {
    kind: 'picket',
    moments: [{ name: 'ring', until: `foes.length && foes[0].age > 1`, focus: `(() => { const t = foes[0]; return { x: t.x - 360, y: t.y - 200, w: 720 }; })()` }],
  },
  lure: {
    kind: 'lure',
    moments: [{ name: 'flash', until: `foes.length && foes[0].age > 1 && Math.floor(g.t * 5) % 2 === 0`, focus: `(() => { const t = foes[0]; return { x: t.x - 300, y: t.y - 170, w: 600 }; })()` }],
  },
  barge: {
    kind: 'barge',
    moments: [{ name: 'tags', until: `foes.length && foes[0].age > 1`, focus: `(() => { const t = foes[0]; return { x: 100, y: 0, w: 1400 }; })()` }],
  },
  cloud: {
    kind: 'cloud',
    moments: [
      { name: 'drift', until: `foes.length && foes[0].age > 5`, focus: `(() => { const t = foes[0]; return { x: t.x - 330, y: t.y - 190, w: 660 }; })()` },
      { name: 'over', until: `foes.length && g.ships.some((s) => Math.hypot(s.x - foes[0].x, s.y - foes[0].y) < 70)`, focus: `(() => { const t = foes[0]; return { x: t.x - 330, y: t.y - 190, w: 660 }; })()` },
    ],
  },
};

const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/v3.html?seed=3`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: 'strait', wave: 4, weapons: [{ id: 'flak', level: 1 }], armory: { gun: null, hull: null, supply: null }, frequentDrops: false, enemies: 'none' }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.click('[data-free-play]');
await page.waitForSelector('[data-screen="freeplay"]');
await page.click('[data-free-start]');
await page.waitForSelector('.playing');
await page.addStyleTag({ content: '.v2-overlay, #overlay, .v2-alerts { display: none !important; }' });
const quiet = () => page.evaluate(() => { const g = window.__v3.game(); g.queue = [{ at: 1e9, kind: 'drone', base: 0 }]; g.raiderQueue = []; g.raiders = []; g.threats = []; g.pickups = []; g.flow = 3; });
await quiet();
// Let the convoy sail in first.
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(250);
  const n = await page.evaluate(() => window.__v3.game().ships.filter((s) => s.x > 250 && s.x < 1400).length);
  if (n >= 5) break;
}
const shots = [];
for (const id of ids) {
  const sc = SCENES[id];
  await quiet();
  if (sc.setup) await page.evaluate((js) => { const g = window.__v3.game(); eval(js); }, sc.setup);
  await page.evaluate(([k, b]) => window.__v3.foe(k, b), [sc.kind, sc.base ?? 1]);
  let shot = 0;
  for (const m of sc.moments) {
    let ok = false;
    for (let i = 0; i < 400 && !ok; i++) {
      await page.waitForTimeout(50);
      ok = await page.evaluate(([kind, until]) => { const g = window.__v3.game(); const foes = g.threats.filter((t) => t.kind === kind && !t.dead); return !!eval(until); }, [sc.kind, m.until]);
      if (!ok && sc.shoot && shot < sc.shoot) {
        // Fire on it once it is well clear of its base.
        const did = await page.evaluate((kind) => { const g = window.__v3.game(); const t = g.threats.find((t) => t.kind === kind && !t.dead && t.age > 0.5); if (!t) return false; const p = window.__v3.toClient(t.x, t.y); const el = document.elementFromPoint(p.x, p.y); el?.dispatchEvent(new PointerEvent('pointerdown', { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, isPrimary: true })); el?.dispatchEvent(new PointerEvent('pointerup', { clientX: p.x, clientY: p.y, bubbles: true, pointerId: 1, isPrimary: true })); return true; }, sc.kind);
        if (did) shot++;
      }
    }
    if (!ok) {
      console.log(`${id}/${m.name}: never happened`);
      continue;
    }
    const box = await page.evaluate(([kind, focus]) => {
      const g = window.__v3.game();
      const foes = g.threats.filter((t) => t.kind === kind && !t.dead);
      window.__v3.freeze(true);
      g.steps += 1;
      const f = eval(focus);
      const a = window.__v3.toClient(f.x, f.y);
      const b = window.__v3.toClient(f.x + f.w, f.y + (f.w * 9) / 16);
      return { x: Math.max(0, a.x), y: Math.max(0, a.y), width: Math.min(667, b.x) - Math.max(0, a.x), height: Math.min(375, b.y) - Math.max(0, a.y) };
    }, [sc.kind, m.focus]);
    await page.waitForTimeout(120);
    const file = `${OUT}${id}-${m.name}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 82, clip: box });
    shots.push(file);
    await page.evaluate(() => window.__v3.freeze(false));
  }
  // Wait out the rest of it.
  for (let i = 0; i < 100; i++) {
    await page.waitForTimeout(100);
    if (await page.evaluate((kind) => !window.__v3.game().threats.some((t) => t.kind === kind || t.kind === 'dart') && !window.__v3.game().foe.shots.length && !window.__v3.game().foe.marks.length, sc.kind)) break;
  }
}
console.log(shots.map((s) => s.split('/').pop()).join('\n'));
if (errors.length) console.log('page errors:', errors);
await browser.close();
