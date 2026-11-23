// Round 9 screenshots (docs/design/v3-round9-fixes.md), at a landscape
// phone's size (874×402): a decoy swarm at the bottom and the top of the
// decoys' beat (the real drones never fade), the Scavenger's wider ring, and
// Hold engaged on Harbor Mouth under the Commands policy. A Free Play wave
// with the enemy brought in through the dev hook, the clock frozen for each
// frame; Hold from its Test Lab map card.
// Usage (with `npx vite preview --port <port>` serving a fresh build):
//   BASE_URL=http://localhost:<port> node tools/v3/round9/shots.mjs
// Writes docs/design/img/round9/*.jpg.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4311';
const OUT = new URL('../../../docs/design/img/round9/', import.meta.url).pathname;
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

/** A Free Play wave on `map`, nothing launching on its own, the convoy
 *  sailing in. */
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
  for (let t = 0; t < ms; t += 20) {
    if (await page.evaluate(cond, arg)) return true;
    await page.waitForTimeout(20);
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
  // ---- Decoy Drones: a swarm of six (three decoys), about 2.5 s out, at
  // the bottom of the decoys' beat and at the top.
  await open('strait', 2);
  await page.evaluate(() => window.__v3.foe('decoy', 1));
  const swarmBox = () =>
    page.evaluate(() => {
      const s = window.__v3.game().threats.filter((t) => (t.kind === 'decoy' || t.kind === 'drone') && !t.dead);
      const x0 = Math.min(...s.map((t) => t.x));
      const x1 = Math.max(...s.map((t) => t.x));
      const y0 = Math.min(...s.map((t) => t.y));
      const y1 = Math.max(...s.map((t) => t.y));
      const w = Math.max(360, x1 - x0 + 140, ((y1 - y0 + 120) * 16) / 9);
      return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - (w * 9) / 32, w };
    });
  // The beat is 1.6 a second (ui/foes.ts DECOY_PULSE): its phase from a decoy's age.
  const phase = (want) => wait((p) => {
    const d = window.__v3.game().threats.find((t) => t.kind === 'decoy' && !t.dead);
    if (!d || d.age < 2.2) return false;
    const k = (d.age * 1.6) % 1;
    return Math.abs(k - p) < 0.04;
  }, 30000, want);
  await phase(0.5);
  await freeze(true);
  await shot('decoys-phone-dim');
  const box = await swarmBox();
  await shot('decoys-close-dim', box);
  await freeze(false);
  await phase(0);
  await freeze(true);
  await shot('decoys-phone-bright');
  await shot('decoys-close-bright', await swarmBox());
  await page.close();

  // ---- Scavenger: its ring (240 px) over three pickups, a fourth outside it.
  await open('strait', 2);
  await page.evaluate(() => {
    const g = window.__v3.game();
    const s = g.ships.filter((o) => o.x > 300 && o.x < 1100).sort((a, b) => a.x - b.x)[0] ?? g.ships[0];
    const y = s.y - 170;
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'flak', x: s.x, y, age: 0 });
    g.pickups.push({ id: g.nextId++, kind: 'repair', x: s.x + 150, y: y + 40, age: 0 });
    g.pickups.push({ id: g.nextId++, kind: 'ammo', x: s.x - 180, y: y + 60, age: 0 });
    g.pickups.push({ id: g.nextId++, kind: 'ammo', x: s.x + 420, y: y + 10, age: 0 });
    window.__v3.foe('scavenger');
  });
  await wait(() => {
    const g = window.__v3.game();
    const sc = g.threats.find((t) => t.kind === 'scavenger');
    if (!sc) return false;
    for (const p of g.pickups) p.age = 0;
    return g.pickups.filter((p) => Math.hypot(p.x - sc.x, p.y - sc.y) <= 240).length >= 3;
  });
  await page.waitForTimeout(500);
  await freeze(true);
  await shot('scavenger-phone');
  const sbox = await page.evaluate(() => {
    const sc = window.__v3.game().threats.find((t) => t.kind === 'scavenger');
    return { x: sc.x - 420, y: sc.y - 240, w: 840 };
  });
  await shot('scavenger-close', sbox);
  await page.close();

  // ---- Hold on Harbor Mouth (Commands policy): the ships short of the
  // hold line stopped, the line lit, the button and the words beside it.
  page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('straitwatch.v3.callouts', 'off'); });
  await page.goto(`${BASE}/v3.html?lab=map-harbor&convoy=tactical&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await wait(() => window.__v3.game().ships.length >= 4);
  await page.waitForTimeout(1500);
  await shot('hold-ready');
  const b = await page.locator('[data-command="hold"]').boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(1300);
  await shot('hold-engaged');
} catch (e) {
  errors.push(String(e.stack ?? e));
} finally {
  await browser.close();
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
