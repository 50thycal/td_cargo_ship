// Screenshots of enemy pairs together on screen (docs/design/v3-enemy-pairs.md),
// at 874×402: each pair's Test Lab card, taken the moment every member is up.
// Usage: BASE_URL=http://localhost:4299 node tools/v3/test-lab/pair-shots.mjs [out-dir]
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.argv[2] ?? 'docs/design/img/pairs';
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

// Each pair: what must be up (threat kinds, or a mark kind), and how long
// after they are all up to take the picture.
const SHOTS = [
  { id: 'spotter-dive', need: [['spotter'], ['diveBomber', 'mark:dive']], hold: 1.2, paint: true },
  { id: 'heli-sub', need: [['attackHeli'], ['torpedoSub', 'torpedo']], hold: 1.5 },
  { id: 'tender-truck', need: [['tender'], ['rocketTruck']], hold: 3.2 },
  { id: 'guard-spotter', need: [['spotter'], ['guard']], hold: 7 },
  { id: 'decoy-cluster', need: [['decoy'], ['cluster']], hold: 1.5 },
  { id: 'lure-stealth', need: [['lure'], ['stealthJet']], hold: 0.8 },
  { id: 'siege-truck', need: [['rocketTruck'], ['siege']], hold: 0.8 },
];

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
let bad = 0;
for (const s of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 1, hasTouch: true });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?lab=combo-${s.id}&seed=4`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on', { timeout: 20000 });
  const at = await page.evaluate(
    ({ need, paint }) =>
      new Promise((done) => {
        const t0 = performance.now();
        const tick = () => {
          const g = window.__v3.game();
          const up = (k) => (k.startsWith('mark:') ? g.foe.marks.some((m) => m.kind === k.slice(5)) : g.threats.some((t) => !t.dead && t.kind === k && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900));
          if (need.every((alts) => alts.some(up)) && (!paint || g.foe.paint)) done(g.waveT);
          else if (performance.now() - t0 > 90000) done(-1);
          else setTimeout(tick, 50);
        };
        tick();
      }),
    s,
  );
  if (at < 0) {
    console.error(`FAIL: ${s.id}: never all up`);
    bad++;
  } else {
    await page.waitForTimeout(s.hold * 1000);
    await page.screenshot({ path: `${OUT}/${s.id}.png` });
    console.log(`ok: ${s.id} all up at ${at.toFixed(1)} s${errs.length ? `; page error: ${errs[0]}` : ''}`);
  }
  await page.close();
}
await browser.close();
process.exitCode = bad ? 1 : 0;
