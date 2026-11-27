// Screenshots for log v74 (docs/design/v3-playtest-fixes.md): the Dreadnought's
// sinking in frames, the Test Lab's pause menu with Done testing this map, the
// hub's cards (new / played, not done / done) and the end screen. 874x402 @2x.
//
//   npx vite build && npx vite preview --port 4318 &
//   BASE_URL=http://localhost:4318 node tools/v3/playtest-fixes/dread-lab-shots.mjs
//
// Writes docs/design/img/v3-dread-lab/*.png (OUT_DIR to change).

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4318';
const OUT = process.env.OUT_DIR ?? 'docs/design/img/v3-dread-lab';
mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
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

// ---- The sinking, frame by frame ----
{
  const p = await browser.newPage(PHONE);
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${BASE_URL}/v3.html`);
  await p.evaluate(() => localStorage.clear());
  await p.goto(`${BASE_URL}/v3.html?lab=map-dreadnought&plays=full&seed=7`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.playing.lab-on');
  // Sail until the glimpse's battleship is well on screen.
  for (let k = 0; k < 400; k++) {
    const x = await p.evaluate(() => {
      const g = window.__v3.game();
      for (const s of g.ships) s.hp = Math.max(s.hp, 3);
      g.carrierHp = Math.max(g.carrierHp, 5);
      window.__v3.advance(0.2);
      const d = g.threats.find((t) => t.kind === 'dreadnought' && !t.dead);
      return d ? d.x : -1;
    });
    if (x > 0 && x < 1300) break;
  }

  const ages = [0.1, 0.4, 0.8, 1.2, 1.7, 2.2, 2.7, 3.15];
  let i = 0;
  for (const age of ages) {
    await p.evaluate((a) => {
      const g = window.__v3.game();
      const d = g.threats.find((t) => t.kind === 'dreadnought' && !t.dead);
      if (!window.__wreck && d) window.__wreck = { x: d.x, y: d.y, rot: d.heading };
      if (!d) { for (const t of g.threats) if (t.kind === 'turret') t.dead = true; g.fx = g.fx.filter((f) => f.kind !== 'wreck'); g.fx.push({ kind: 'wreck', x: window.__wreck.x, y: window.__wreck.y, x2: 0, y2: 0, r: 0, age: a - 0.06, life: 3.4, rot: window.__wreck.rot, size: 1 }); return; }
      d.dead = true;
      for (const t of g.threats) if (t.kind === 'turret') t.dead = true;
      g.fx = g.fx.filter((f) => f.kind !== 'wreck');
      g.fx.push({ kind: 'wreck', x: window.__wreck.x, y: window.__wreck.y, x2: 0, y2: 0, r: 0, age: a - 0.06, life: 3.4, rot: window.__wreck.rot, size: 1 });
    }, age);
    await p.waitForTimeout(30);
    await p.screenshot({ path: `${OUT}/sinking-${String(++i).padStart(2, '0')}-${age}s.png` });
  }
  await p.close();
}

// ---- The pause menu, the end screen and the hub ----
{
  const p = await browser.newPage(PHONE);
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${BASE_URL}/v3.html`);
  await p.evaluate(() => localStorage.clear());
  await p.goto(`${BASE_URL}/v3.html?lab=map-dreadnought&plays=full&seed=7`, { waitUntil: 'networkidle' });
  await p.waitForSelector('.playing.lab-on');
  await p.evaluate(() => window.__v3.advance(8));
  await p.click('.v2-pause');
  await p.waitForSelector('.v2-pause-panel [data-lab-markdone]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/pause-menu.png` });
  const sizes = await p.evaluate(() => [...document.querySelectorAll('.v2-pause-panel [data-lab-markdone], .v2-pause-panel [data-lab-done]')].map((b) => Math.round(b.getBoundingClientRect().height)));
  console.log('pause button heights', sizes);
  // Done testing this map: back to the list, the card played-not-done? No: done.
  await p.click('[data-lab-markdone]');
  await p.waitForSelector('.v3-lab-ready');
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => [...document.querySelectorAll('[data-ready]')].map((e) => `${e.dataset.ready}:${e.dataset.state}`).slice(0, 4).join());
  console.log('hub after Done:', st);
  await p.screenshot({ path: `${OUT}/hub-after-done.png` });
  // An abandoned run: seed a quit log for the Rig Field and Tidewater, a played one stays "played, not done".
  await p.evaluate(() => {
    const mk = (map, end, id) => ({ v: 74, game: 'v3', id, map, end, commands: [], lab: { card: `map-${map}`, length: 'full', mix: 'normal' } });
    localStorage.setItem('straitwatch.v3.lab.logs', JSON.stringify([mk('tide', 'quit', 'v3-a'), mk('saltgate', 'lost', 'v3-b')]));
  });
  await p.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await p.click('[data-lab]');
  await p.waitForSelector('.v3-lab-ready');
  await p.waitForTimeout(600);
  const st2 = await p.evaluate(() => [...document.querySelectorAll('[data-ready]')].map((e) => `${e.dataset.ready}:${e.dataset.state}`).join());
  console.log('hub with an abandoned and a lost run:', st2);
  await p.screenshot({ path: `${OUT}/hub-cards.png` });
  await p.evaluate(() => document.querySelector('[data-state="played"]')?.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${OUT}/hub-cards-played.png` });
  await p.close();
}
console.log(errs.length ? `page errors: ${errs.join(' | ')}` : 'no page errors');
await browser.close();
