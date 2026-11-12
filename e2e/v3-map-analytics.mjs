// The Map Analytics screen's browser check (docs/design/v3-map-convoy-lab-plan.md,
// slice 2). Expects `vite preview` (or dev) at BASE_URL.
//
// - A Test Lab run played by touch is kept on the device and shows up as a run.
// - On the three reference maps, a bending map (The Kesh Hook) and a forked
//   one (Sharra Delta): bot runs played on the spot, every layer drawn, and
//   every square with damage is a square ships sailed through.
// - A square opens what is behind it; a hit is traced from launcher to
//   impact; Watch plays the log from just before it and comes back.
// - The time window narrows the numbers; one run against another is a
//   difference on one scale; the filters cut what they say.
// - Usable on a landscape phone: no sideways scroll, controls big enough.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-map-analytics.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-map-analytics';
mkdirSync(OUT_DIR, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) {
      const candidate = `${root}/${entry}/${dir}/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => {
  if (!ok) fail(msg);
  else console.log('ok:', msg);
};
const state = (page) => page.evaluate(() => window.__v3.mapLab().state());
const idle = (page, runs) => page.waitForFunction((n) => { const s = window.__v3.mapLab()?.state(); return s && s.runs.length >= n && !s.busy; }, runs, { timeout: 180000 });
const setLayer = async (page, layer, metric) => {
  await page.click(`[data-maplab-layer="${layer}"]`);
  if (metric) await page.click(`[data-maplab-metric="${metric}"]`);
};
/** Every layer's grid for the runs shown, read through the screen's own hook. */
const grids = (page, list) =>
  page.evaluate(async (list) => {
    const out = {};
    for (const [layer, metric] of list) {
      document.querySelector(`[data-maplab-layer="${layer}"]`).click();
      document.querySelector(`[data-maplab-metric="${metric}"]`)?.click();
      const lab = window.__v3.mapLab();
      const s = lab.state();
      out[`${layer}/${metric}`] = { total: s.total, top: s.top, cells: Array.from({ length: 576 }, (_, i) => lab.cellAt(i)?.v ?? null), nums: Array.from({ length: 576 }, (_, i) => lab.cellAt(i)?.num ?? 0) };
    }
    return out;
  }, list);

try {
  // ---- A phone: a touch-played lab run is kept, and read as a run ----
  const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
  const phone = await browser.newPage(PHONE);
  const errs = [];
  phone.on('pageerror', (e) => errs.push(e.message));
  await phone.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await phone.evaluate(() => localStorage.clear());
  await phone.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=5`, { waitUntil: 'networkidle' });
  await phone.waitForSelector('.playing.lab-on');
  const t0 = Date.now();
  while (Date.now() - t0 < 22_000) {
    const targets = await phone.evaluate(() => {
      const g = window.__v3.game();
      if (!g || g.phase !== 'wave') return [];
      return [...g.pickups.slice(0, 1), ...g.threats.filter((t) => t.speed > 0 && t.x > 20 && t.x < 1580 && t.y > 20 && t.y < 880 && !g.interceptors.some((i) => i.target === t.id)).slice(0, 2)].map((t) => window.__v3.toClient(t.x, t.y));
    });
    for (const p of targets) await phone.touchscreen.tap(p.x, p.y);
    await phone.waitForTimeout(140);
  }
  await phone.tap('[data-lab-done]');
  await phone.waitForSelector('[data-screen="lab-verdict"]');
  await phone.tap('[data-lab-verdict="keep"]');
  await phone.tap('[data-lab-list]');
  await phone.waitForSelector('[data-screen="lab"]');
  await phone.tap('[data-maplab-open]');
  await phone.waitForSelector('[data-maplab]');
  await idle(phone, 1);
  const kept = await phone.evaluate(() => {
    const s = window.__v3.mapLab().state();
    const row = document.querySelector('[data-maplab-run]');
    const small = [...document.querySelectorAll('.v3-maplab button, .v3-maplab select')].filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 30).length;
    return { map: s.map, runs: s.runs.length, label: row?.textContent, total: s.total, sw: document.documentElement.scrollWidth, iw: innerWidth, small, taps: s.summary.taps.fire };
  });
  check(kept.map === 'harbor' && kept.runs === 1 && /you · map-harbor/.test(kept.label ?? '') && kept.taps > 5, `the Test Lab's button opens Map Analytics, and the run just played by touch is there (${JSON.stringify(kept)})`);
  check(kept.sw <= kept.iw && kept.small === 0, `on a landscape phone: no sideways scroll, no control under 30 px (${kept.sw}/${kept.iw}, ${kept.small} small)`);
  await phone.screenshot({ path: `${OUT_DIR}/phone-harbor-human.png` });
  check(errs.length === 0, `no page errors on the phone (${errs[0] ?? 'none'})`);
  await phone.close();

  // ---- A desktop: bots on five maps, every layer ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
  const e2 = [];
  page.on('pageerror', (e) => e2.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/v3.html?maplab=1`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-maplab]');
  const LIST = [['launches', 'count'], ['sources', 'hp'], ['damage', 'hp'], ['damage', 'sinks'], ['pickups', 'dropped'], ['pickups', 'taken'], ['intercepts', 'taps'], ['intercepts', 'kills'], ['traffic', 'shipSeconds'], ['traffic', 'risk'], ['traffic', 'entered']];
  for (const map of ['strait', 'gauntlet', 'harbor', 'kesh', 'delta']) {
    await page.selectOption('[data-maplab-pick="map"]', map);
    await page.click('[data-maplab-bots]');
    await idle(page, 2);
    const g = await grids(page, LIST);
    const traffic = g['traffic/shipSeconds'].cells;
    // (Ship damage: the risk layer's numerator. The carrier's own square has no traffic.)
    const stray = g['traffic/risk'].nums.filter((v, i) => v > 0 && !(traffic[i] > 0)).length;
    const through = g['traffic/entered'].cells.filter((v) => v > 0).length;
    check(
      g['launches/count'].total > 50 && g['sources/hp'].total > 0 && g['damage/hp'].total > 0 && g['pickups/dropped'].total > 5 && g['intercepts/taps'].total > 50 && g['intercepts/kills'].total > 30 && through > 20 && stray === 0,
      `${map}: every layer has its numbers, and every square with ship damage is a square ships sailed through (launches ${g['launches/count'].total}, hull ${g['damage/hp'].total}, pickups ${g['pickups/dropped'].total}, kills ${g['intercepts/kills'].total}, ${through} squares of traffic, ${stray} stray)`,
    );
    // Hull lost counted where it landed and where it came from: the same hull.
    const s = await state(page);
    check(Math.abs(g['damage/hp'].total - (s.summary.hpShip + s.summary.hpCarrier)) < 1e-6 && Math.abs(g['sources/hp'].total - g['damage/hp'].total) < 1e-6, `${map}: hull by square adds up to the summary (${g['damage/hp'].total} = ${s.summary.hpShip} + ${s.summary.hpCarrier}; ${g['sources/hp'].total} traced to a launch)`);
    await setLayer(page, 'traffic', 'shipSeconds');
    await page.screenshot({ path: `${OUT_DIR}/${map}-traffic.png` });
    await setLayer(page, 'sources', 'hp');
    await page.screenshot({ path: `${OUT_DIR}/${map}-sources.png` });
  }

  // ---- Harbor Mouth: a square, its events, a trace, the replay ----
  await page.selectOption('[data-maplab-pick="map"]', 'harbor');
  await setLayer(page, 'damage', 'hp');
  const hot = await page.evaluate(() => window.__v3.mapLab().hottest());
  const box = await page.locator('.v3-maplab-canvas').boundingBox();
  const at = { x: box.x + (((hot % 32) + 0.5) / 32) * box.width, y: box.y + ((Math.floor(hot / 32) + 0.5) / 18) * box.height };
  await page.mouse.click(at.x, at.y);
  const picked = await page.evaluate(() => {
    const s = window.__v3.mapLab().state();
    return { cell: s.cell, head: document.querySelector('.v3-maplab-detail h4')?.textContent, refs: document.querySelectorAll('.v3-maplab-refs li').length, watch: document.querySelectorAll('[data-maplab-watch]').length, trace: document.querySelectorAll('[data-maplab-trace-btn]').length, v: window.__v3.mapLab().cellAt(s.cell)?.v };
  });
  check(picked.cell === hot && picked.refs > 0 && picked.watch === picked.refs && picked.trace > 0 && picked.v > 0, `a tap on the map picks the square under it and lists what is behind it, each with Watch and Trace (${JSON.stringify(picked)})`);
  await page.click('[data-maplab-trace-btn]');
  const tr = await page.evaluate(() => ({ steps: [...document.querySelectorAll('[data-maplab-trace] li')].map((li) => li.textContent), n: window.__v3.mapLab().state().trace }));
  check(tr.n >= 3 && tr.steps.some((t) => /launched from/.test(t)) && tr.steps.some((t) => /landed/.test(t)) && /hit (ship|the carrier)/.test(tr.steps.at(-1)), `Trace reads the hit from launcher to impact (${tr.steps.join(' | ')})`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-trace.png` });
  const step = Number(await page.getAttribute('[data-maplab-watch]', 'data-maplab-watch'));
  await page.click('[data-maplab-watch]');
  await page.waitForSelector('.replaying', { timeout: 5000 });
  await page.waitForTimeout(1200);
  const rp = await page.evaluate(() => ({ steps: window.__v3.game().steps, map: window.__v3.game().map.id, hud: /REPLAY/.test(document.querySelector('.v2-hud')?.textContent ?? '') }));
  check(rp.map === 'harbor' && rp.steps >= step - 200 && rp.steps < step + 400 && rp.hud, `Watch plays the log from three seconds before the event (event at step ${step + 180}, replay at ${rp.steps})`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-replay.png` });
  await page.click('.v2-pause');
  await page.waitForSelector('[data-maplab]');
  await idle(page, 2);
  const back = await state(page);
  check(back.map === 'harbor' && back.layer === 'damage' && back.cell === hot && back.runs.length === 2, `stopping the replay comes back to the same map, layer and square (${JSON.stringify({ map: back.map, layer: back.layer, cell: back.cell })})`);

  // ---- The time window ----
  const whole = await state(page);
  await page.evaluate(() => {
    const to = document.querySelector('[data-maplab-range="to"]');
    to.value = '60';
    to.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  const first = await state(page);
  check(first.window && first.window[1] === 60 && first.total < whole.total && first.summary.seconds <= 2 * 60 + 0.5 && first.summary.shipMinutes < whole.summary.shipMinutes, `the first minute alone: fewer hits, less traffic, ${first.summary.seconds.toFixed(0)} s of play under it (hull ${first.total} of ${whole.total})`);
  await page.click('[data-maplab-whole]');
  const again = await state(page);
  check(again.window === null && again.total === whole.total, 'Whole run puts it back');

  // ---- Filters ----
  await page.click('[data-maplab-scope="waves"]');
  const waves = await state(page);
  await page.click('[data-maplab-scope="mapEvent"]');
  const ev = await state(page);
  await page.click('[data-maplab-scope="all"]');
  check(waves.total + ev.total <= whole.total + 1e-6 && waves.total > 0, `normal waves and the map event are separate: ${waves.total} + ${ev.total} of ${whole.total} hull`);
  const kind = await page.evaluate(() => [...document.querySelector('[data-maplab-pick="kind"]').options].map((o) => o.value).find((v) => v === 'strafer' || v === 'ballistic'));
  await page.selectOption('[data-maplab-pick="kind"]', kind);
  const byKind = await state(page);
  check(byKind.total > 0 && byKind.total < whole.total && byKind.summary.byKind.length === 1 && byKind.summary.byKind[0][0] === kind, `the enemy filter keeps only ${kind}: ${byKind.total} of ${whole.total} hull`);
  await page.selectOption('[data-maplab-pick="kind"]', 'all');

  // ---- One run against another ----
  await page.click('[data-maplab-run]:last-of-type');
  const cmp = await page.evaluate(() => ({ s: window.__v3.mapLab().state(), legend: document.querySelector('.v3-maplab-keys')?.textContent, cols: document.querySelectorAll('.v3-maplab-table tr:first-child th').length }));
  check(cmp.s.runs.filter((r) => r.set === 'b').length === 1 && cmp.s.diffTop > 0 && /more in B/.test(cmp.legend ?? '') && cmp.cols === 3, `a second tap on a run makes it set B: the map shows B less A on one scale, the table both (largest difference ${cmp.s.diffTop})`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-compare.png` });
  await page.click('[data-maplab-run][data-set="b"]');
  await page.click('[data-maplab-run][data-set="off"]');

  // ---- Commands ----
  await setLayer(page, 'commands');
  const cmds = await page.evaluate(() => ({ head: document.querySelector('.v3-maplab-detail h4')?.textContent, n: document.querySelectorAll('.v3-maplab-refs li').length }));
  check(/commands? and changes, in time/.test(cmds.head ?? '') && cmds.n > 0, `the Commands layer lists flow and formation changes in time (${cmds.head})`);
  check(e2.length === 0, `no page errors (${e2[0] ?? 'none'})`);
  await page.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 MAP ANALYTICS E2E FAILED' : 'V3 MAP ANALYTICS E2E PASSED');
