// Enemy round 7 screenshots (docs/design/v3-enemies-round7.md): the Decoy
// Drones' tint against real drones at phone size (874×402) and up close,
// the same swarm with the decoys marked, and a Torpedo Sub's spread with a
// fast torpedo in it. A Free Play wave on The Strait, the enemy brought in
// through the dev hook, the clock frozen for each frame.
// Usage (with `npx vite preview --port 4261` serving a fresh build):
//   BASE_URL=http://localhost:4261 node tools/v3/enemies-round7/shots.mjs
// Writes docs/design/img/enemies-round7/*.jpg.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4261';
const OUT = new URL('../../../docs/design/img/enemies-round7/', import.meta.url).pathname;
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
  });

/** A Free Play wave on The Strait at 874×402, `dsf` device pixels a CSS
 *  pixel (2: a phone's look; 3: the close-ups), nothing launching on its
 *  own, the convoy sailing in. */
async function open(dsf) {
  page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: dsf, hasTouch: true });
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
  await quiet();
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(250);
    const n = await page.evaluate(() => window.__v3.game().ships.filter((s) => s.x > 250 && s.x < 1400).length);
    if (n >= 5) break;
  }
}

const wait = async (cond, ms = 30000) => {
  for (let t = 0; t < ms; t += 50) {
    if (await page.evaluate(cond)) return true;
    await page.waitForTimeout(50);
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
  await page.screenshot({ path: file, type: 'jpeg', quality: 86, ...(box ? { clip: await clip(box) } : {}) });
  console.log('wrote', file);
};

/** Decoy Drones: a swarm of six (three decoys), 3 s out. */
async function decoys(close) {
  await quiet();
  await page.evaluate(() => window.__v3.foe('decoy', 1));
  await wait(() => window.__v3.game().threats.some((t) => (t.kind === 'decoy' || t.kind === 'drone') && t.age > 3.2));
  await page.evaluate(() => window.__v3.freeze(true));
  if (!close) {
    await shot('decoys-phone');
    await page.evaluate(() => window.__v3.freeze(false));
    return;
  }
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
  // The same frame with the decoys marked (for this page only: the game
  // marks nothing).
  await page.evaluate(() => {
    for (const t of window.__v3.game().threats.filter((o) => o.kind === 'decoy' && !o.dead)) {
      const p = window.__v3.toClient(t.x, t.y);
      const el = document.createElement('div');
      el.className = 'r7-mark';
      el.textContent = 'decoy';
      el.style.cssText = `position:fixed;left:${p.x - 16}px;top:${p.y + 12}px;width:32px;text-align:center;font:600 7px system-ui;color:#fff;background:rgba(0,0,0,.6);border-radius:2px;z-index:99;pointer-events:none`;
      document.body.appendChild(el);
    }
  });
  await shot('decoys-close-marked', box);
  await page.evaluate(() => document.querySelectorAll('.r7-mark').forEach((e) => e.remove()));
  await page.evaluate(() => window.__v3.freeze(false));
}

/** Torpedo Sub: a spread of five with a fast one (the third) in it. */
async function sub(close) {
  await quiet();
  await page.evaluate(() => {
    window.__v3.foe('torpedoSub');
    const m = window.__v3.game().foe.marks.find((o) => o.kind === 'periscope');
    m.spread = 5;
    m.fast = 2;
  });
  await wait(() => window.__v3.game().foe.marks.some((m) => m.kind === 'periscope' && m.t > 0.9));
  if (!close) {
    await page.evaluate(() => window.__v3.freeze(true));
    await shot('sub-periscope');
    await page.evaluate(() => window.__v3.freeze(false));
  }
  await wait(() => window.__v3.game().threats.some((t) => t.kind === 'torpedo' && t.age > 0.9));
  await page.evaluate(() => window.__v3.freeze(true));
  if (!close) {
    await shot('sub-spread-phone');
  } else {
    const box = await page.evaluate(() => {
      const ts = window.__v3.game().threats.filter((t) => t.kind === 'torpedo' && !t.dead);
      const f = ts[0].foe;
      const xs = [f.sx, ...ts.map((t) => t.x)];
      const ys = [f.sy, ...ts.map((t) => t.y)];
      const x0 = Math.min(...xs) - 260;
      const w = Math.max(760, Math.max(...xs) - x0 + 260);
      return { x: x0, y: (Math.min(...ys) + Math.max(...ys)) / 2 - (w * 9) / 32, w };
    });
    await shot('sub-spread-close', box);
  }
  await page.evaluate(() => window.__v3.freeze(false));
}

await open(2);
await decoys(false);
await sub(false);
await page.close();
await open(3);
await decoys(true);
await sub(true);
await browser.close();
if (errors.length) {
  console.error('page errors:', errors);
  process.exit(1);
}
