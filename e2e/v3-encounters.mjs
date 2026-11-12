// The Map & Convoy Lab's authored encounters in the browser
// (docs/design/v3-map-convoy-lab-plan.md, slice 5). Expects `vite preview`
// (or dev) at BASE_URL. On a landscape phone:
// - a map card of a reference map, opened with ?enc=1 (or with "Authored
//   encounters" picked in its setup sheet), plays that map's encounter for
//   the wave: named in a call-out, its launches in the wave's queue;
// - played on, its launches come from the launcher it names, each tagged
//   in the telemetry, and the log replays to the same telemetry;
// - the setup sheet offers the choice on the three reference maps only,
//   and never on an event card;
// - an ordinary campaign run has no encounter layer.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-encounters.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-encounters';
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
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const open = async (page, q) => {
  await page.goto(`${BASE_URL}/v3.html?${q}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
};
const state = (page) =>
  page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    return {
      wave: g.wave, enc: g.enc ? { rev: g.enc.setup.rev, now: g.enc.now, played: g.enc.played } : null,
      queued: g.queue.filter((l) => l.enc).map((l) => `${l.kind}@${l.base}`), subs: g.raiderQueue.filter((r) => r.enc).length,
      log: log.encounters ?? null, v: log.v, text: document.body.innerText,
    };
  });

try {
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());

  // ---- The Strait with its authored encounters ----
  await open(page, 'lab=map-strait&enc=1&seed=7');
  const s0 = await state(page);
  check(s0.enc?.rev === 1 && s0.log?.rev === 1, `a map card opened with ?enc=1 carries the encounter layer, and its log says so (wave ${s0.wave}; log ${JSON.stringify(s0.log)})`);
  check(s0.enc?.now.length === 1 && /^strait-/.test(s0.enc.now[0]) && s0.queued.length > 0, `the wave has the map's encounter for it, its launches in the queue (${s0.enc?.now.join()}: ${s0.queued.join(' ')})`);
  const named = await page.waitForFunction(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0], null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => '');
  check(/ENCOUNTER: THE SCREEN/.test(named), `the encounter is named as the wave starts ("${named}")`);
  await page.screenshot({ path: `${OUT_DIR}/strait-encounter-named.png` });

  // Played on with nobody shooting: its launches come, tagged, and the log replays.
  await page.evaluate(() => window.__v3.advance(40));
  const run = await page.evaluate(() => {
    const live = window.__v3.telemetry();
    const log = window.__v3.log();
    const again = window.__v3.replayTelemetry(log);
    const mine = live.events.filter((e) => e.k === 'thr+' && e.enc);
    return {
      header: live.header.encounters, named: live.events.filter((e) => e.k === 'env' && e.what === 'encounter').map((e) => e.st),
      mine: mine.map((e) => `${e.kind}:${e.o}:${e.base ?? ''}`), ids: [...new Set(mine.map((e) => e.enc))],
      same: again.digest === window.__v3.telemetryDigest(live), problems: again.problems,
    };
  });
  check(run.header === 1 && run.named.includes(s0.enc.now[0]) && run.mine.length > 0 && run.ids.join() === s0.enc.now[0], `played on, the encounter's launches come and the telemetry tags each one (${run.mine.join(' ')}; named ${run.named.join()})`);
  check(run.same && run.problems.length === 0, `the test's log replays to the same telemetry, and it reconciles (${run.problems[0] ?? 'no problems'})`);
  await page.screenshot({ path: `${OUT_DIR}/strait-encounter-playing.png` });

  // ---- The setup sheet: the choice, and back to the shared waves ----
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-encounters]');
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-lab-encounters]')].map((b) => `${b.textContent}${b.classList.contains('on') ? '*' : ''}`));
  check(opts.join(' | ') === 'Shared | Authored encounters*', `the setup sheet offers the map's shared waves or its authored encounters, the one in play marked (${opts.join(' | ')})`);
  await page.screenshot({ path: `${OUT_DIR}/setup-sheet.png` });
  await page.tap('[data-lab-encounters="shared"]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.steps < 600 && window.__v3.game().enc === null, null, { timeout: 8000 });
  const s1 = await state(page);
  check(s1.enc === null && s1.log === null && s1.queued.length === 0 && !/ENCOUNTER: /.test(s1.text), `"Shared" restarts the test on the map's shared waves: no layer, nothing authored in the queue`);
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-encounters]');
  await page.tap('[data-lab-encounters="authored"]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.enc?.now.length === 1, null, { timeout: 8000 });
  check(true, `"Authored encounters" restarts it with them`);

  // ---- With the Tactical policy: both layers at once ----
  await open(page, 'lab=map-harbor&enc=1&convoy=tactical&seed=7');
  const both = await page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    return { enc: g.enc?.now ?? null, policy: g.convoy?.setup.policy ?? null, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command), log: [!!log.encounters, log.convoy?.policy] };
  });
  check(both.enc?.length === 1 && /^harbor-/.test(both.enc[0]) && both.policy === 'tactical' && both.cmds.join() === 'hold' && both.log.join() === 'true,tactical', `Harbor Mouth with its encounters under the Tactical policy: both in the run and in its log (${JSON.stringify(both)})`);
  await page.evaluate(() => window.__v3.advance(30));
  const bothRun = await page.evaluate(() => {
    const live = window.__v3.telemetry();
    const again = window.__v3.replayTelemetry(window.__v3.log());
    return { same: again.digest === window.__v3.telemetryDigest(live), problems: again.problems };
  });
  check(bothRun.same && bothRun.problems.length === 0, `and that run replays to the same telemetry (${bothRun.problems[0] ?? 'no problems'})`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-encounter-tactical.png` });

  // ---- Where the choice is not offered ----
  for (const [card, why] of [['map-kesh', 'a map with no authored encounters'], ['ev-rush', 'an event card']]) {
    await open(page, `lab=${card}&enc=1&seed=7`);
    await page.tap('[data-lab-setup]');
    await page.waitForSelector('[data-lab-apply]');
    const none = await page.evaluate(() => ({ row: document.querySelectorAll('[data-lab-encounters]').length, enc: window.__v3.game().enc, log: 'encounters' in window.__v3.log() }));
    check(none.row === 0 && none.enc === null && !none.log, `${why} (${card}): no choice in the sheet, and ?enc=1 does nothing (${JSON.stringify(none)})`);
  }
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();

  // ---- An ordinary campaign run ----
  const camp = await browser.newPage(PHONE);
  await camp.goto(`${BASE_URL}/v3.html?enc=1`, { waitUntil: 'networkidle' });
  await camp.evaluate(() => localStorage.clear());
  await camp.reload({ waitUntil: 'networkidle' });
  await camp.waitForSelector('[data-screen="menu"]');
  await camp.tap('[data-map="strait"]');
  await camp.waitForSelector('[data-screen="loadout"]');
  await camp.tap('[data-start]');
  await camp.waitForSelector('.playing');
  const ordinary = await camp.evaluate(() => ({ enc: window.__v3.game().enc, log: 'encounters' in window.__v3.log(), queued: window.__v3.game().queue.filter((l) => l.enc).length }));
  check(ordinary.enc === null && !ordinary.log && ordinary.queued === 0, `an ordinary campaign run, even with ?enc=1 in the link: no encounter layer (${JSON.stringify(ordinary)})`);
  await camp.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 ENCOUNTERS E2E FAILED' : 'V3 ENCOUNTERS E2E PASSED');
