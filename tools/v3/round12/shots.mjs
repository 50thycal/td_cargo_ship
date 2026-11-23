// Test Lab round 12's screenshots (docs/design/v3-round12-encounter-versions.md):
// the hub's version cards, a v2 call-out on each reference map, and the
// pause screen's script on a v3 wave. 844 x 390, 1x, touch. Round 12's
// fixes: wave 1's opener on each map (a version each), and a boss round
// on The Strait (Hydras in the rush) and on Harbor Mouth (the trucks).
// ONLY=fixes takes just those.
//
// Usage: npx vite preview --outDir <dist> --port 4771 &
//        BASE_URL=http://localhost:4771 SHOT_DIR=<dir> [ONLY=fixes] node tools/v3/round12/shots.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.SHOT_DIR ?? 'docs/design/img/round12';
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

/** Clear wave 1 (no loss), then start `wave` from its draft. */
async function jumpTo(page, wave) {
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.tempo.lossLimit = 999;
    g.carrierHp = g.stats.carrierHp = 1e6;
    window.__v3.advance(300);
  });
  await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
  await page.evaluate((w) => { window.__v3.game().wave = w - 1; }, wave);
  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction((w) => window.__v3.game()?.phase === 'wave' && window.__v3.game().wave === w, wave, { timeout: 8000 });
}

async function open(page, card) {
  await page.goto(`${BASE_URL}/v3.html?lab=${card}&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
}

/** Step the run on in quarter seconds until `cond` holds in the page (or
 *  `max` s go by); true if it did. */
async function until(page, cond, max = 60) {
  return page.evaluate(
    ({ src, max }) => {
      const f = new Function('g', `return (${src})`);
      const g = window.__v3.game();
      for (let t = 0; t < max; t += 0.25) {
        if (f(g)) return true;
        window.__v3.advance(0.25);
      }
      return !!f(g);
    },
    { src: cond, max },
  );
}

/** The run can't be lost while a shot is set up. */
async function tough(page) {
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.tempo.lossLimit = 999;
    g.carrierHp = g.stats.carrierHp = 1e6;
  });
}

async function fixes(page) {
  // ---- Wave 1's opener, a version on each map ----
  for (const [card, id, text] of [
    ['map-strait', 'strait-ranging-opener', null],
    ['map-gauntlet-v2', 'gauntlet-v2-first-look', /TWO SHORES/],
    ['map-harbor-v3', 'harbor-v3-hydra-opener', null],
  ]) {
    await open(page, card);
    await tough(page);
    const played = await page.evaluate(() => window.__v3.game().enc?.played ?? []);
    check(played[0] === id, `${card}: wave 1 opens with ${id} (${played.join(', ')})`);
    // On until the opener's launches are well up on the screen.
    const seen = await until(page, `g.wave === 1 && g.threats.some((t) => t.enc === '${id}' && t.y > 160 && t.y < 820 && (t.kind !== 'drone' || g.threats.filter((o) => o.enc === '${id}').length >= 2))`, 45);
    check(seen, `${card}: the opener is in the air on wave 1`);
    // On a little, so the launches are out over the water.
    await page.evaluate((s) => window.__v3.advance(s), card.includes('harbor') ? 4 : 1.5);
    await page.waitForTimeout(500);
    if (text) check(text.test(await page.evaluate(() => document.body.innerText)), `${card}: its call-out is on screen`);
    await page.evaluate(() => window.__v3.freeze(true));
    // Without a call-out to show, let the opening cards fade first.
    if (!text) await page.waitForTimeout(7000);
    await page.screenshot({ path: `${OUT}/wave1-${card.replace('map-', '')}-844x390.jpg`, quality: 85 });
    await page.evaluate(() => window.__v3.freeze(false));
  }

  // ---- A boss round on The Strait and on Harbor Mouth ----
  for (const [card, kind, at] of [
    ['map-strait', 'hydra', 'g.threats.filter((t) => t.kind === "hydra" && !t.dead).length >= 2 && g.threats.filter((t) => t.kind === "sprinter" && !t.dead).length >= 6'],
    ['map-harbor', 'rocketTruck', 'g.threats.filter((t) => t.kind === "rocketTruck" && !t.dead && t.foe && t.foe.state >= 2).length >= 2'],
  ]) {
    await open(page, card);
    await jumpTo(page, 11);
    await tough(page);
    const boss = await page.evaluate(() => ({ id: window.__v3.game().event?.id, run: window.__v3.game().event?.run }));
    check(!!boss.id && boss.run === 1, `${card}: boss round 1 (${boss.id})`);
    check(await until(page, at, 40), `${card}: the boss round's ${kind}s are in`);
    // The rush: on until its Hydras are out over the water with the sprinters.
    if (kind === 'hydra') check(await until(page, 'g.threats.filter((t) => t.kind === "hydra" && !t.dead && t.y > 300).length >= 1', 10), `${card}: a Hydra over the water`);
    await page.evaluate(() => window.__v3.freeze(true));
    // The boss banner and the restore card fade first (real time).
    await page.waitForTimeout(7000);
    await page.screenshot({ path: `${OUT}/boss-${card.replace('map-', '')}-844x390.jpg`, quality: 85 });
    await page.evaluate(() => window.__v3.freeze(false));
  }
}

try {
  const page = await browser.newPage(PHONE);
  page.on('pageerror', (e) => errs.push(e.message));
  if (process.env.ONLY === 'fixes') {
    await fixes(page);
    check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
    throw null;
  }
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // ---- The hub: the version cards beside their map's card ----
  await page.tap('[data-lab]');
  await page.waitForSelector('[data-screen="lab"]');
  for (const s of ['event', 'enemy', 'combo']) await page.evaluate((s) => { document.querySelector(`[data-section="${s}"]`).open = false; }, s);
  await page.tap('[data-section="map"] summary');
  await page.locator('[data-card="map-strait"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('[data-section="map"] summary').scrollIntoView());
  const hub = await page.evaluate(() => [...document.querySelectorAll('[data-section="map"] [data-card]')].slice(0, 3).map((c) => c.querySelector('b')?.textContent));
  check(hub.join(' | ') === 'The Strait | The Strait · v2 Set pieces | The Strait · v3 Enemy pairs', `the hub lists The Strait's versions together (${hub.join(' | ')})`);
  await page.screenshot({ path: `${OUT}/hub-versions-844x390.jpg`, quality: 85 });

  // ---- A v2 call-out on each map, at the moment its warning shows ----
  for (const [map, wave] of [['strait', 3], ['gauntlet', 3], ['harbor', 2]]) {
    await open(page, `map-${map}-v2`);
    await jumpTo(page, wave);
    const at = await page.evaluate(() => {
      const g = window.__v3.game();
      g.tempo.lossLimit = 999;
      g.carrierHp = g.stats.carrierHp = 1e6;
      return { at: g.enc.calls[0]?.at ?? null, id: g.enc.calls[0]?.id ?? null, t: g.waveT };
    });
    check(at.at !== null, `${map} v2 wave ${wave} has a call-out to come (${at.id} at ${at.at?.toFixed(1)} s)`);
    await page.evaluate((s) => window.__v3.advance(s), at.at - at.t + 0.6);
    await page.waitForTimeout(700);
    const shown = await page.evaluate(() => document.body.innerText);
    const name = await page.evaluate((id) => window.__v3.game().enc.played.includes(id), at.id);
    check(name, `${map}: ${at.id} played`);
    check(/PINCER|THE SWEEP|AMBUSH/.test(shown), `${map}: the call-out is on screen`);
    await page.evaluate(() => window.__v3.freeze(true));
    await page.screenshot({ path: `${OUT}/callout-${map}-v2-844x390.jpg`, quality: 85 });
    await page.evaluate(() => window.__v3.freeze(false));
  }

  // ---- The pause screen's script on a v3 wave ----
  await open(page, 'map-harbor-v3');
  await jumpTo(page, 9);
  await page.evaluate(() => window.__v3.advance(8));
  await page.tap('.v2-pause');
  await page.waitForSelector('.v3-enc-script');
  const script = await page.evaluate(() => ({ head: document.querySelector('.v3-enc-script h3')?.textContent, ids: document.querySelector('.v3-enc-script')?.dataset.encScript, beats: [...document.querySelectorAll('.v3-enc-beats li')].map((l) => l.textContent) }));
  check(/v3 Enemy pairs · wave 9/.test(script.head ?? '') && script.ids === 'harbor-v3-escalate-2' && script.beats.some((b) => /enemy pair/.test(b)), `the pause script shows the v3 wave's encounter and its pairs (${JSON.stringify(script)})`);
  await page.screenshot({ path: `${OUT}/pause-v3-harbor-844x390.jpg`, quality: 85 });
  await fixes(page);
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
} catch (e) {
  if (e !== null) {
    bad++;
    console.log('FAIL:', e.stack ?? String(e));
  }
} finally {
  await browser.close();
}
console.log(bad ? 'ROUND 12 SHOTS FAILED' : 'ROUND 12 SHOTS DONE');
if (bad) process.exitCode = 1;
