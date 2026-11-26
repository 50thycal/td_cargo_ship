// Saltgate Canal's Gatecrashers, the Missile Truck parade (log v62; v71: the
// ordinary truck, a raider no shot hits,
// docs/design/v3-ch2-saltgate.md): phone-size shots mid-boss in round 1
// (ripples) and round 3 (the dense parade and its rolling barrage). The run
// can't be lost (every hull kept afloat) and nothing is shot, so the whole
// parade is on the road. 874 x 402, 2x, touch.
//
// Usage: npx vite preview --outDir <dist> --port 4772 &
//        BASE_URL=http://localhost:4772 SHOT_DIR=<dir> node tools/v3/saltgate/parade-shots.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? 'docs/design/img/saltgate';
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
const ctx = await browser.newContext(PHONE);
await ctx.addInitScript(() => {
  try {
    localStorage.removeItem('straitwatch.v3.run');
  } catch {
    // no storage
  }
});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
let bad = 0;
const check = (ok, msg) => {
  if (!ok) bad++;
  console.log(`${ok ? 'ok' : 'FAIL'}: ${msg}`);
};

await page.goto(`${BASE_URL}/v3.html?lab=map-saltgate&seed=7`, { waitUntil: 'networkidle' });
await page.waitForSelector('.playing.lab-on');
// Skip to the boss from the pause menu.
await page.waitForFunction(() => window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open'), null, { timeout: 15000 });
await page.evaluate(() => document.querySelector('.v2-pause').click());
await page.waitForSelector('.v2-pause-panel [data-lab-skip]');
await page.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
await page.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });

/** Step on (keeping every hull afloat, tapping through the boss's cards)
 *  until `cond` holds in round `wave`. */
async function until(wave, cond, max = 90) {
  for (let t = 0; t < max; t += 0.1) {
    const st = await page.evaluate(
      ({ src, wave }) => {
        const g = window.__v3.game();
        g.tempo.lossLimit = 999;
        g.carrierHp = Math.max(g.carrierHp, 1e5);
        for (const s of g.ships) s.hp = Math.max(s.hp, 50);
        const f = new Function('g', `return (${src})`);
        if (g.wave === wave && g.phase === 'wave' && f(g)) return 'done';
        return g.phase;
      },
      { src: cond, wave },
    );
    if (st === 'done') return true;
    if (st !== 'wave') await page.mouse.click(437, 300);
    await page.evaluate(() => window.__v3.advance(0.1));
    await page.waitForTimeout(5);
  }
  return false;
}

const onRoad = "g.raiders.filter((t) => t.kind === 'parade' && t.x > 30 && t.x < 1570).length";
const lobs = "g.threats.filter((t) => t.kind === 'ballistic' && !t.dead).length";
const raising = "g.raiders.filter((t) => t.kind === 'parade' && t.state === 'raise').length";

const r1 = await until(11, `${onRoad} >= 5 && ${lobs} >= 2 && ${raising} >= 2`);
check(r1, 'round 1: five or more trucks on the road, missiles in the air and rings filling');
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/saltgate-parade-r1.png` });
const r3 = await until(13, `${onRoad} >= 7 && ${lobs} >= 4 && ${raising} >= 3`);
check(r3, 'round 3: seven or more trucks on the road, the barrage in the air');
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/saltgate-parade-r3.png` });
const st = await page.evaluate(() => ({ wave: window.__v3.game().wave, parade: window.__v3.game().event?.parade?.shots.length }));
console.log(JSON.stringify(st));
check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
await browser.close();
process.exit(bad ? 1 : 0);
