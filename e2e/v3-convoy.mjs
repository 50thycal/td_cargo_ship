// The Map & Convoy Lab's tactical commands in the browser
// (docs/design/v3-map-convoy-lab-plan.md, slice 4; round 11: Rush and
// Disperse are cut, and Hold is on Sowers' Reach only, where mines drift
// across the lane). Expects `vite preview` (or dev) at BASE_URL. On a
// landscape phone, by touch:
// - under the Tactical policy The Strait has no command: the dock shows
//   nothing (round 16: no "CONVOY sails itself");
// - round 16, full width: no left rail; the battlefield starts at the
//   screen's left edge and the right rail is the only column kept;
// - on Sowers' Reach, Hold is the big button in the dock, over the
//   battlefield's lower-left corner, a thumb's size;
// - a touch on it gives it and never fires the gun; a touch on the water
//   right beside it fires and never gives a command;
// - Hold (at 874 x 402 and 667 x 375): every ship afloat stops and stays
//   stopped, the button and the board say so, it ends by itself, and a press
//   while it cools down is refused with the reason on the screen;
// - no policy shows a flow slider or a formation button (round 16), and the
//   setup sheet has no Convoy row;
// - the test's log carries its policy and commands and replays to the
//   same telemetry; an ordinary campaign or Free Play run has none of this,
//   and no slider, formation button or note either.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-convoy.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-convoy';
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
// A run left mid-game by the page before is kept to continue, and starting
// another over it asks first (docs/design/v3-resume-run.md). These checks
// open run after run by link and reload: each page starts with no saved run.
{
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await newContext(o);
    await c.addInitScript(() => {
      try {
        localStorage.removeItem('straitwatch.v3.run');
      } catch {
        // no storage
      }
    });
    return c;
  };
}
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => {
  if (!ok) fail(msg);
  else console.log('ok:', msg);
};

// A test's commands are on the pause menu (pause-menu round: no bar over the
// field): pause, if the menu isn't up, and wait for them.
const labMenu = async (page) => {
  // A run just (re)started, or a sheet closing: wait for play, or for a
  // menu or a draft (between a full run's waves) that has Done on it.
  await page.waitForFunction(() => !!document.querySelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]') || (window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open')), null, { timeout: 15000 });
  if (!(await page.$('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]'))) await page.evaluate(() => document.querySelector('.v2-pause').click());
  await page.waitForSelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]');
};
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const snap = (page) =>
  page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    const c = g.convoy;
    return {
      steps: g.steps, shots: g.shots, taps: log.commands.filter((x) => x[1] === 't').length, ks: log.commands.filter((x) => x[1] === 'k').map((x) => x[2]),
      policy: c?.setup.policy ?? null, holding: c?.holding ?? false, owed: c?.owed ?? 0, refused: c?.refused ?? 0, used: c?.used ?? null,
      ships: g.ships.length, flow: g.flow, formation: g.formation,
    };
  });
const centre = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};
const open = async (page, q, ships = 4) => {
  await page.goto(`${BASE_URL}/v3.html?${q}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  // Ships on the water before anything is asked of them (run on, no input,
  // so the wait is short: Sowers' Reach sails a pair every 11 s).
  await page.evaluate((n) => { const g = window.__v3.game(); for (let i = 0; i < 60 * 60 && g.ships.length < n; i++) window.__v3.advance(1 / 60); }, ships);
  await page.waitForFunction((n) => window.__v3.game().ships.length >= n, ships, { timeout: 30000 });
};


/** Hold on Sowers' Reach, by touch, at this page's size (round 9: the
 *  player's Hold "did not work at all" on an iPhone at 874 x 402; round 11:
 *  every ship afloat stops, there is no line, and Hold is on the map whose
 *  mines cross the lane). The button is where a thumb lands and nothing
 *  covers it; a touch holds; every ship stops and stays stopped, with a
 *  pause mark on each; the button reads Release / HOLDING n and beats; words
 *  beside it say what it stopped; left alone it ends by itself; a press
 *  while it cools down is refused and the reason is on the screen. */
async function holdCheck(page, shot) {
  const size = page.viewportSize();
  const tag = `${size.width} x ${size.height}`;
  await open(page, 'lab=map-sowers&seed=7');
  const hb = await page.evaluate(() => [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command).join());
  const hold = await centre(page, '[data-command="hold"]');
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-command]')?.dataset.command ?? document.elementFromPoint(x, y)?.className, hold);
  check(hb === 'hold' && top === 'hold' && hold.w >= 44 && hold.h >= 44 && hold.y + hold.h / 2 <= size.height, `${tag}: Sowers' Reach has Hold alone (its production setup), a thumb's size, on screen, and nothing covers it (${hold.w.toFixed(0)}x${hold.h.toFixed(0)}; under the thumb: ${top})`);
  const h0 = await snap(page);
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(700);
  const h1 = await snap(page);
  const d1 = await page.evaluate(() => window.__v3.game().ships.map((s) => [s.id, s.d]));
  // The words beside the buttons (up for two seconds).
  const said = await page.evaluate(() => {
    const says = document.querySelector('.v3-command-says');
    const r = says.getBoundingClientRect();
    return { says: says.textContent, saysOn: says.classList.contains('on'), saysBox: { l: r.left, r: r.right, t: r.top, b: r.bottom } };
  });
  await page.waitForTimeout(1200);
  const st = await page.evaluate(() => {
    const g = window.__v3.game();
    return { ships: g.ships.map((s) => [s.id, s.d]), owed: g.convoy.owed, holding: g.convoy.holding };
  });
  const before = new Map(d1);
  const short = st.ships.filter(([id]) => before.has(id));
  const still = short.every(([id, d]) => Math.abs(d - before.get(id)) < 0.5);
  const hui = await page.evaluate(() => {
    return { name: document.querySelector('[data-command="hold"] b').textContent, label: document.querySelector('[data-command="hold"] small').textContent, cls: document.querySelector('[data-command="hold"]').className, anim: getComputedStyle(document.querySelector('[data-command="hold"]')).animationName };
  });
  check(h1.holding && h1.ks.join() === 'hold' && h1.taps === h0.taps && h1.shots === h0.shots, `${tag}: a touch on Hold holds, as a logged input, and fires nothing (${h1.ks.join()})`);
  check(st.holding && short.length >= 4 && still && st.owed === st.ships.length, `${tag}: every ship afloat has stopped and stays stopped (${short.length} stopped, ${st.owed} held)`);
  check(hui.name === 'Release' && /^HOLDING \d$/.test(hui.label) && /active/.test(hui.cls) && hui.anim === 'v3-hold-beat', `${tag}: the button reads Release / ${hui.label} and beats gold`);
  check(said.saysOn && /^HOLDING: \d+ ships? stopped$/.test(said.says) && said.saysBox.r <= size.width && said.saysBox.t >= 0 && said.saysBox.b <= size.height, `${tag}: words beside it say what it did ("${said.says}")`);
  await page.screenshot({ path: `${OUT_DIR}/${shot}-${size.width}.png` });
  // Left alone it ends by itself, and the ships sail on.
  await page.waitForFunction(() => !window.__v3.game().convoy.holding, null, { timeout: 9000 });
  const h2 = await page.evaluate(() => ({ label: document.querySelector('[data-command="hold"] small').textContent, name: document.querySelector('[data-command="hold"] b').textContent, waited: window.__v3.game().convoy.waited, rel: window.__v3.telemetry().events.filter((e) => e.k === 'cmd' && e.what === 'release').map((e) => e.req) }));
  check(h2.name === 'Hold' && /^WAIT \d+$/.test(h2.label) && h2.waited <= 6.05 && h2.rel[0] === 'max', `${tag}: left alone, the Hold ends by itself (${h2.rel[0]}, after ${h2.waited.toFixed(1)} s) and cools down ("${h2.label}")`);
  const d2 = await page.evaluate(() => window.__v3.game().ships.map((s) => [s.id, s.d]));
  await page.waitForTimeout(800);
  const d3 = new Map(await page.evaluate(() => window.__v3.game().ships.map((s) => [s.id, s.d])));
  check(d2.filter(([id]) => d3.has(id)).every(([id, d]) => d3.get(id) > d + 10), `${tag}: released, they sail on`);
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(150);
  const r = await page.evaluate(() => { const says = document.querySelector('.v3-command-says'); return { refused: window.__v3.game().convoy.refused, says: says.textContent, on: says.classList.contains('on'), red: says.classList.contains('refused'), op: getComputedStyle(says).opacity }; });
  check(r.refused === 1 && r.on && r.red && /^HOLD: Ready again in \d+ s$/.test(r.says), `${tag}: Hold while cooling down is refused, and the reason is on the screen ("${r.says}")`);
}

try {
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());

  // ---- The Strait under the Tactical policy: no command (round 11) ----
  await open(page, 'lab=map-strait&seed=7');
  const strait = await page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    return { policy: window.__v3.game().convoy?.setup.policy, cmds: document.querySelectorAll('.v3-command').length, foot: document.querySelector('.v3-commands').children.length, note: !!document.querySelector('.v3-convoy-auto'), formation: vis('.v2-formation-btn'), flow: vis('[data-flow], .v2-slider') };
  });
  check(strait.policy === 'tactical' && strait.cmds === 0 && strait.foot === 0 && !strait.note && !strait.formation && !strait.flow, `The Strait's production setup: no command, and the dock shows nothing (no "sails itself") (${JSON.stringify(strait)})`);
  await page.screenshot({ path: `${OUT_DIR}/strait-tactical-none.png` });
  await open(page, 'lab=map-harbor&seed=7');
  const harbor = await page.evaluate(() => ({ policy: window.__v3.game().convoy?.setup.policy, cmds: document.querySelectorAll('.v3-command').length }));
  check(harbor.policy === 'tactical' && harbor.cmds === 0, `Harbor Mouth has no Hold now (${JSON.stringify(harbor)})`);

  // ---- Sowers' Reach: Hold, by touch ----
  await open(page, 'lab=map-sowers&seed=7');
  const rail = await page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    const btns = [...document.querySelectorAll('.v3-command')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.command, w: r.width, h: r.height, top: r.top, bottom: r.bottom, label: b.textContent, aria: b.getAttribute('aria-label') }; });
    const hb = document.querySelector('[data-command="hold"]').getBoundingClientRect();
    const tl = window.__v3.toClient(0, 0);
    const br = window.__v3.toClient(1600, 900);
    const right = document.querySelector('.v2-rail-right').getBoundingClientRect();
    return { btns, formation: vis('.v2-formation-btn'), flow: vis('[data-flow]'), cls: document.querySelector('.v2-root').className, h: innerHeight, w: innerWidth, holdRight: hb.right, hold: { l: hb.left, b: hb.bottom }, map: { l: tl.x, t: tl.y, r: br.x, b: br.y }, rightRail: { l: right.left, r: right.right } };
  });
  check(rail.btns.map((b) => b.id).join() === 'hold' && !rail.formation && !rail.flow && /convoy-tactical/.test(rail.cls) && /convoy-command/.test(rail.cls), `Sowers' Reach under Tactical: Hold is the big button in the dock (${rail.btns.map((b) => b.id).join()}; formation ${rail.formation}, flow ${rail.flow})`);
  // Round 16, full width: no dead strip on the left. The battlefield starts
  // at the screen's edge and runs to the right rail; Hold sits over its
  // lower-left corner.
  check(Math.abs(rail.map.l) < 0.5 && Math.abs(rail.map.r - rail.rightRail.l) < 0.5 && Math.abs(rail.rightRail.r - rail.w) < 0.5 && rail.hold.l >= rail.map.l + 4 && rail.hold.l < rail.map.l + 24 && rail.hold.b <= rail.map.b && rail.hold.b > rail.map.b - 24, `full width: the battlefield runs from the left edge to the right rail, and Hold sits in its lower-left corner (${JSON.stringify({ map: rail.map, rightRail: rail.rightRail, hold: rail.hold })})`);
  check(rail.btns.every((b) => b.w >= 44 && b.h >= 44 && b.top >= 0 && b.bottom <= rail.h), `the button is a thumb's size and on the screen (${rail.btns.map((b) => `${b.id} ${b.w.toFixed(0)}x${b.h.toFixed(0)}`).join(', ')})`);
  check(/Hold: Every ship stops where it is \(up to 6 s\)\. Tap again to release\./.test(rail.btns[0].aria ?? ''), `its label says what it does and what it costs ("${rail.btns[0].aria}")`);

  const s0 = await snap(page);
  const hold = await centre(page, '[data-command="hold"]');
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(250);
  const s1 = await snap(page);
  check(s1.ks.join() === 'hold' && s1.holding && s1.taps === s0.taps && s1.shots === s0.shots, `a touch on Hold gives it, as a logged input, and fires nothing (commands ${s1.ks.join()}; taps ${s0.taps} to ${s1.taps}, shots ${s0.shots} to ${s1.shots})`);
  // The field right beside the button: the gun's, never a command's.
  await page.touchscreen.tap(rail.holdRight + 12, hold.y);
  await page.waitForTimeout(80);
  const s3 = await snap(page);
  check(s3.taps === s1.taps + 1 && s3.ks.length === s1.ks.length, `a touch on the field 12 px right of the button is a tap on the field, not a command (taps ${s1.taps} to ${s3.taps})`);
  // Round 16, full width: a touch maps to the world by the new layout, worked
  // out here on its own (not through the game's toClient): at 874 x 402 with
  // no insets the 1600 x 900 field is height-bound (402 / 900) and starts at
  // the screen's left edge. A touch on a live threat lands on it.
  const k = 402 / 900;
  const foe = await page.evaluate(() => {
    const t = window.__v3.game().threats.find((t) => !t.dead && t.x > 150 && t.x < 1450 && t.y > 80 && t.y < 820);
    return t ? { x: t.x, y: t.y } : null;
  });
  if (foe) {
    await page.touchscreen.tap(foe.x * k, foe.y * k);
    await page.waitForTimeout(40);
    const last = await page.evaluate(() => window.__v3.log().commands.filter((c) => c[1] === 't').at(-1));
    check(Math.hypot(last[2] - foe.x, last[3] - foe.y) < 6, `a touch on a threat at (${foe.x.toFixed(0)}, ${foe.y.toFixed(0)}) lands on it in the world (${last[2]}, ${last[3]})`);
  } else fail('no live threat on the field to touch');
  // Paused: the button does nothing.
  await page.tap('.v2-pause');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-command="hold"]').click());
  const s5 = await snap(page);
  check(s5.ks.length === s3.ks.length, 'paused, a command is not given');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /resume/i.test(b.textContent))?.click());
  await page.waitForTimeout(200);
  // Released by a tap, then refused while it cools down.
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(120);
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(120);
  const s6 = await snap(page);
  const shook = await page.evaluate(() => [...document.querySelectorAll('.v3-command.refused')].map((b) => b.dataset.command));
  check(s6.ks.join() === 'hold,hold,hold' && !s6.holding && s6.refused === 1 && s6.used.hold === 2 && shook.join() === 'hold', `a second tap releases; a third, while it cools down, is refused, logged and shaken (refused ${s6.refused}; used ${s6.used.hold})`);

  // Done: the log carries the policy and the commands, and replays to the same telemetry.
  await labMenu(page);
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const done = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('straitwatch.v3.playlogs') || '[]').find((l) => l.lab?.card === 'map-sowers');
    const live = window.__v3.telemetry();
    const again = window.__v3.replayTelemetry(log);
    return { convoy: log.convoy, ks: log.commands.filter((c) => c[1] === 'k').map((c) => c[2]), v: log.v, same: again.digest === window.__v3.telemetryDigest(live), problems: again.problems, header: live.header.convoy, cmds: live.events.filter((e) => e.k === 'cmd').map((e) => `${e.what}:${e.ok}${e.why ? `:${e.why}` : ''}`) };
  });
  check(done.convoy?.policy === 'tactical' && done.convoy?.rev === 3 && done.ks.join() === 'hold,hold,hold' && done.v === 65, `the log carries its policy (rules rev 3) and every command given (${JSON.stringify(done.convoy)}; ${done.ks.join()})`);
  check(done.same && done.problems.length === 0 && done.header.policy === 'tactical' && done.cmds.join() === 'hold:1,release:1,hold:0:cooldown', `the log replays to the telemetry the live run made, commands and refusals included (${done.cmds.join()})`);

  // The Map Analytics screen lists them.
  // The UI overhaul: Map Analytics is in the hub's Tools drawer.
  await page.tap('[data-lab-tools-open]');
  await page.tap('[data-maplab-open]');
  await page.waitForSelector('[data-maplab]');
  await page.waitForFunction(() => { const s = window.__v3.mapLab()?.state(); return s && s.runs.length >= 1 && !s.busy; }, null, { timeout: 60000 });
  await page.tap('[data-maplab-layer="commands"]');
  const listed = await page.evaluate(() => [...document.querySelectorAll('.v3-maplab-refs li span')].map((s) => s.textContent));
  check(listed.some((t) => /hold \(\d+ ships\)/.test(t)) && listed.some((t) => /hold, refused \(cooldown\)/.test(t)), `Map Analytics lists the commands in time, with the ships each took and why each was refused (${listed.join(' | ')})`);

  // ---- Sowers' Reach: Hold, and its release ----
  await holdCheck(page, 'sowers-holding');

  // ---- No policy shows the old controls (round 16) ----
  // A comparison link's ?convoy= still plays a policy (for the bots), but the
  // rail never shows a flow slider, a formation button or a note.
  for (const policy of ['auto', 'formation', 'current']) {
    await open(page, `lab=map-strait&convoy=${policy}&seed=7`);
    const r = await page.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
      return { formation: vis('.v2-formation-btn'), flow: vis('[data-flow], .v2-slider'), note: !!document.querySelector('.v3-convoy-auto'), foot: document.querySelector('.v3-commands').children.length, cmds: document.querySelectorAll('.v3-command').length, policy: window.__v3.game().convoy?.setup.policy ?? 'current' };
    });
    check(r.policy === policy && !r.formation && !r.flow && !r.note && r.foot === 0 && r.cmds === 0, `${policy}: nothing in the dock for the convoy (${JSON.stringify(r)})`);
    if (policy === 'auto') await page.screenshot({ path: `${OUT_DIR}/strait-auto.png` });
  }

  // ---- The setup sheet: no Convoy row; Reset puts the command back ----
  // (Test Lab round 10: a map card opens under its production setup, which
  // on Sowers' Reach is Commands; a link asks for today's convoy.)
  await open(page, 'lab=map-sowers&convoy=current&seed=7', 1);
  const plain = await page.evaluate(() => ({ convoy: window.__v3.game().convoy, cmds: document.querySelectorAll('.v3-command').length, cls: document.querySelector('.v2-root').className }));
  check(plain.convoy === null && plain.cmds === 0 && !/convoy-/.test(plain.cls), 'a test asked for today\'s convoy plays with no convoy layer and no command');
  await labMenu(page);
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-reset]');
  const opts = await page.evaluate(() => document.querySelectorAll('[data-lab-convoy]').length);
  await page.tap('[data-lab-reset]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.convoy?.setup.policy === 'tactical' && document.querySelectorAll('.v3-command').length === 1, null, { timeout: 8000 });
  check(opts === 0, `the setup sheet has no Convoy row (round 16); Reset to production setup restarts the test with Hold (${opts} policy buttons)`);
  await page.screenshot({ path: `${OUT_DIR}/sowers-tactical.png` });
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();

  // ---- A smaller phone: the dock still fits ----
  const small = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await open(small, 'lab=map-sowers&seed=7');
  const fit = await small.evaluate(() => {
    const kids = [...document.querySelector('.v3-dock-col').children].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect());
    const overlap = kids.some((a, i) => kids.some((b, j) => j > i && a.bottom > b.top + 1 && b.bottom > a.top + 1 && a.right > b.left + 1 && b.right > a.left + 1));
    return { overlap, bottom: Math.max(...kids.map((k) => k.bottom)), h: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  check(!fit.overlap && fit.bottom <= fit.h && fit.sw <= fit.iw, `at 667 x 375 the dock's parts fit without overlapping (${JSON.stringify(fit)})`);
  await small.screenshot({ path: `${OUT_DIR}/sowers-tactical-667.png` });
  await holdCheck(small, 'sowers-holding');
  await small.close();

  // ---- An ordinary campaign run ----
  const camp = await browser.newPage(PHONE);
  await camp.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await camp.evaluate(() => localStorage.clear());
  await camp.reload({ waitUntil: 'networkidle' });
  await camp.waitForSelector('[data-screen="menu"]');
  await camp.tap('[data-map="strait"]');
  await camp.waitForSelector('[data-screen="loadout"]');
  await camp.tap('[data-start]');
  await camp.waitForSelector('.playing');
  const ordinary = await camp.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    return { convoy: window.__v3.game().convoy, cmds: vis('.v3-command'), formation: vis('.v2-formation-btn'), flow: vis('[data-flow], .v2-slider'), note: !!document.querySelector('.v3-convoy-auto'), foot: document.querySelector('.v3-commands').children.length, log: 'convoy' in window.__v3.log() };
  });
  check(ordinary.convoy === null && !ordinary.cmds && !ordinary.formation && !ordinary.flow && !ordinary.note && ordinary.foot === 0 && !ordinary.log, `an ordinary campaign run: no convoy layer, and no flow slider, formation button or note (round 16) (${JSON.stringify(ordinary)})`);
  await camp.close();
  // Free Play: the same rail.
  const fp = await browser.newPage(PHONE);
  await fp.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await fp.waitForSelector('[data-screen="menu"]');
  await fp.tap('[data-free-play]');
  await fp.waitForSelector('[data-screen="freeplay"]');
  await fp.tap('[data-free-start]');
  await fp.waitForSelector('.playing');
  const free = await fp.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    return { free: !!window.__v3.log().freePlay, convoy: window.__v3.game().convoy, cmds: vis('.v3-command'), formation: vis('.v2-formation-btn'), flow: vis('[data-flow], .v2-slider'), note: !!document.querySelector('.v3-convoy-auto'), foot: document.querySelector('.v3-commands').children.length };
  });
  check(free.free && free.convoy === null && !free.cmds && !free.formation && !free.flow && !free.note && free.foot === 0, `a Free Play run: no flow slider, formation button or note (round 16) (${JSON.stringify(free)})`);
  await fp.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 CONVOY E2E FAILED' : 'V3 CONVOY E2E PASSED');
