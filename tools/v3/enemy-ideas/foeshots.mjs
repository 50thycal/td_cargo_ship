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
  await page.evaluate((k) => window.__v3.foe(k), sc.kind);
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
    if (await page.evaluate((kind) => !window.__v3.game().threats.some((t) => t.kind === kind || t.kind === 'dart') && !window.__v3.game().foe.shots.length, sc.kind)) break;
  }
}
console.log(shots.map((s) => s.split('/').pop()).join('\n'));
if (errors.length) console.log('page errors:', errors);
await browser.close();
