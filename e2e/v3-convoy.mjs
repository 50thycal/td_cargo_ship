// The Map & Convoy Lab's tactical commands in the browser
// (docs/design/v3-map-convoy-lab-plan.md, slice 4). Expects `vite preview`
// (or dev) at BASE_URL. On a landscape phone, by touch:
// - under the Tactical policy the map's commands are buttons where the
//   formation button and the flow slider were, each a thumb's size;
// - a touch on a command gives it and never fires the gun; a touch on the
//   water beside the rail fires and never gives a command;
// - a refusal (cooling down, another posture running) is logged, shakes
//   the button, and changes nothing;
// - Hold on Harbor Mouth keeps the next ships out, counts down, and ends
//   by itself;
// - the other policies hide what the map has taken over;
// - the test's log carries its policy and commands and replays to the
//   same telemetry; an ordinary run has none of this.
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
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => {
  if (!ok) fail(msg);
  else console.log('ok:', msg);
};
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const snap = (page) =>
  page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    const c = g.convoy;
    return {
      steps: g.steps, shots: g.shots, taps: log.commands.filter((x) => x[1] === 't').length, ks: log.commands.filter((x) => x[1] === 'k').map((x) => x[2]),
      policy: c?.setup.policy ?? null, rushT: c?.rushT ?? 0, coastT: c?.coastT ?? 0, disperseT: c?.disperseT ?? 0, holding: c?.holding ?? false, owed: c?.owed ?? 0, refused: c?.refused ?? 0, used: c?.used ?? null,
      ships: g.ships.length, flow: g.flow, formation: g.formation,
    };
  });
const centre = async (page, sel) => {
  const b = await page.locator(sel).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
};
const open = async (page, q) => {
  await page.goto(`${BASE_URL}/v3.html?${q}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  // Ships on the water before anything is asked of them.
  await page.waitForFunction(() => window.__v3.game().ships.length >= 4, null, { timeout: 30000 });
};

try {
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());

  // ---- The Strait under the Tactical policy: Rush and Disperse ----
  await open(page, 'lab=map-strait&convoy=tactical&seed=7');
  const rail = await page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    const btns = [...document.querySelectorAll('.v3-command')].map((b) => { const r = b.getBoundingClientRect(); return { id: b.dataset.command, w: r.width, h: r.height, top: r.top, bottom: r.bottom, label: b.textContent, aria: b.getAttribute('aria-label') }; });
    const railBox = document.querySelector('.v2-rail-left').getBoundingClientRect();
    return { btns, formation: vis('.v2-formation-btn'), flow: vis('[data-flow]'), cls: document.querySelector('.v2-root').className, h: innerHeight, railRight: railBox.right, canvasLeft: document.querySelector('canvas').getBoundingClientRect().left };
  });
  check(rail.btns.map((b) => b.id).join() === 'rush,disperse' && !rail.formation && !rail.flow && /convoy-tactical/.test(rail.cls), `The Strait under Tactical: Rush and Disperse are where the formation button and the flow slider were (${rail.btns.map((b) => b.id).join()}; formation ${rail.formation}, flow ${rail.flow})`);
  check(rail.btns.every((b) => b.w >= 44 && b.h >= 44 && b.top >= 0 && b.bottom <= rail.h), `each command is a thumb's size and on the screen (${rail.btns.map((b) => `${b.id} ${b.w.toFixed(0)}x${b.h.toFixed(0)}`).join(', ')})`);
  check(/Rush: Ships afloat sail faster for 6 s\. Then slower for 10 s\./.test(rail.btns[0].aria ?? ''), `a command's label says what it does and what it costs ("${rail.btns[0].aria}")`);
  await page.screenshot({ path: `${OUT_DIR}/strait-tactical-ready.png` });

  const s0 = await snap(page);
  const rush = await centre(page, '[data-command="rush"]');
  await page.touchscreen.tap(rush.x, rush.y);
  await page.waitForTimeout(250);
  const s1 = await snap(page);
  const ui1 = await page.evaluate(() => ({ cls: document.querySelector('[data-command="rush"]').className, label: document.querySelector('[data-command="rush"] small').textContent, banner: document.querySelector('.v3-alert, .v2-banner, [class*="callout"]')?.textContent ?? document.body.innerText.match(/RUSH[^\n]*\n?[^\n]*slower[^\n]*/)?.[0] ?? '' }));
  check(s1.ks.join() === 'rush' && s1.rushT > 0 && s1.taps === s0.taps && s1.shots === s0.shots, `a touch on Rush gives it, as a logged input, and fires nothing (commands ${s1.ks.join()}; taps ${s0.taps} to ${s1.taps}, shots ${s0.shots} to ${s1.shots})`);
  check(/active/.test(ui1.cls) && /^RUSHING \d$/.test(ui1.label) && /slower/i.test(ui1.banner), `the button shows it running with its seconds, and its cost is said once ("${ui1.label}"; "${ui1.banner.replace(/\s+/g, ' ').slice(0, 80)}")`);
  await page.screenshot({ path: `${OUT_DIR}/strait-tactical-rushing.png` });

  // Again, and Disperse while rushing: both refused, both logged, nothing changed.
  await page.touchscreen.tap(rush.x, rush.y);
  const dis = await centre(page, '[data-command="disperse"]');
  await page.touchscreen.tap(dis.x, dis.y);
  await page.waitForTimeout(120);
  const s2 = await snap(page);
  const shook = await page.evaluate(() => [...document.querySelectorAll('.v3-command.refused')].map((b) => b.dataset.command));
  check(s2.ks.join() === 'rush,rush,disperse' && s2.refused === 2 && s2.used.rush === 1 && s2.used.disperse === 0 && s2.disperseT === 0 && shook.length === 2, `Rush again and Disperse meanwhile are refused: logged, shaken, nothing changed (refused ${s2.refused}; shook ${shook.join()})`);

  // The water right beside the rail, and a threat: the gun's, never a command's.
  const edge = await page.evaluate(() => window.__v3.toClient(0, 450));
  await page.touchscreen.tap(edge.x + 10, rush.y);
  await page.waitForTimeout(80);
  const s3 = await snap(page);
  check(edge.x + 10 - rail.railRight < 24 && s3.taps === s2.taps + 1 && s3.ks.length === s2.ks.length, `a touch on the water ${(edge.x + 10 - rail.railRight).toFixed(0)} px from the rail is a tap on the water, not a command (taps ${s2.taps} to ${s3.taps})`);
  await page.waitForFunction(() => window.__v3.game().threats.some((t) => t.speed > 0 && t.x > 80 && t.x < 1500 && t.y > 60 && t.y < 840), null, { timeout: 30000 });
  const th = await page.evaluate(() => { const t = window.__v3.game().threats.find((t) => t.speed > 0 && t.x > 80 && t.x < 1500 && t.y > 60 && t.y < 840); return window.__v3.toClient(t.x, t.y); });
  await page.touchscreen.tap(th.x, th.y);
  await page.waitForTimeout(80);
  const s4 = await snap(page);
  check(s4.shots > s3.shots || s4.taps > s3.taps, `the gun still answers while a command runs (shots ${s3.shots} to ${s4.shots})`);

  // Paused: a command's button does nothing.
  await page.tap('.v2-pause');
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-command="disperse"]').click());
  const s5 = await snap(page);
  check(s5.ks.length === s4.ks.length, 'paused, a command is not given');
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /resume/i.test(b.textContent))?.click());
  await page.waitForTimeout(200);

  // Done: the log carries the policy and the commands, and replays to the same telemetry.
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const done = await page.evaluate(() => {
    const log = JSON.parse(localStorage.getItem('straitwatch.v3.playlogs') || '[]').find((l) => l.lab?.card === 'map-strait');
    const live = window.__v3.telemetry();
    const again = window.__v3.replayTelemetry(log);
    return { convoy: log.convoy, ks: log.commands.filter((c) => c[1] === 'k').map((c) => c[2]), v: log.v, same: again.digest === window.__v3.telemetryDigest(live), problems: again.problems, header: live.header.convoy, cmds: live.events.filter((e) => e.k === 'cmd').map((e) => `${e.what}:${e.ok}${e.why ? `:${e.why}` : ''}`) };
  });
  check(done.convoy?.policy === 'tactical' && done.ks.join() === 'rush,rush,disperse' && done.v === 20, `the log carries its policy and every command given (${JSON.stringify(done.convoy)}; ${done.ks.join()})`);
  check(done.same && done.problems.length === 0 && done.header.policy === 'tactical' && done.cmds.join() === 'rush:1,rush:0:cooldown,disperse:0:busy', `the log replays to the telemetry the live run made, commands and refusals included (${done.cmds.join()})`);

  // The Map Analytics screen lists them.
  await page.tap('[data-maplab-open]');
  await page.waitForSelector('[data-maplab]');
  await page.waitForFunction(() => { const s = window.__v3.mapLab()?.state(); return s && s.runs.length >= 1 && !s.busy; }, null, { timeout: 60000 });
  await page.tap('[data-maplab-layer="commands"]');
  const listed = await page.evaluate(() => [...document.querySelectorAll('.v3-maplab-refs li span')].map((s) => s.textContent));
  check(listed.some((t) => /rush \(\d+ ships\)/.test(t)) && listed.some((t) => /rush, refused \(cooldown\)/.test(t)) && listed.some((t) => /disperse, refused \(busy\)/.test(t)), `Map Analytics lists the commands in time, with the ships each took and why each was refused (${listed.join(' | ')})`);

  // ---- Harbor Mouth: Hold, and its release ----
  await open(page, 'lab=map-harbor&convoy=tactical&seed=7');
  const hb = await page.evaluate(() => [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command).join());
  const h0 = await snap(page);
  const hold = await centre(page, '[data-command="hold"]');
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(300);
  const h1 = await snap(page);
  const hui = await page.evaluate(() => ({ name: document.querySelector('[data-command="hold"] b').textContent, label: document.querySelector('[data-command="hold"] small').textContent, cls: document.querySelector('[data-command="hold"]').className }));
  check(hb === 'hold' && h1.holding && h1.ks.join() === 'hold' && h1.taps === h0.taps && hui.name === 'Release' && /^RELEASE \d$/.test(hui.label) && /active/.test(hui.cls), `Harbor Mouth has Hold alone; a touch holds, and the button becomes Release with its seconds ("${hui.name}", "${hui.label}")`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-holding.png` });
  // Left alone it ends by itself.
  await page.waitForFunction(() => !window.__v3.game().convoy.holding, null, { timeout: 9000 });
  const h2 = await page.evaluate(() => ({ label: document.querySelector('[data-command="hold"] small').textContent, name: document.querySelector('[data-command="hold"] b').textContent, waited: window.__v3.game().convoy.waited, rel: window.__v3.telemetry().events.filter((e) => e.k === 'cmd' && e.what === 'release').map((e) => e.req) }));
  check(h2.name === 'Hold' && /^WAIT \d+$/.test(h2.label) && h2.waited <= 6.05 && ['max', 'queue'].includes(h2.rel[0]), `left alone, the Hold ends by itself (${h2.rel[0]}, after ${h2.waited.toFixed(1)} s) and cools down ("${h2.label}")`);
  await page.touchscreen.tap(hold.x, hold.y);
  await page.waitForTimeout(100);
  check((await snap(page)).refused === 1, 'Hold while cooling down is refused');

  // ---- The other policies hide what the map has taken over ----
  for (const [policy, want] of [['auto', { formation: false, flow: false, note: true }], ['formation', { formation: true, flow: false, note: false }]]) {
    await open(page, `lab=map-strait&convoy=${policy}&seed=7`);
    const r = await page.evaluate(() => {
      const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
      return { formation: vis('.v2-formation-btn'), flow: vis('[data-flow]'), note: vis('.v3-convoy-auto'), cmds: document.querySelectorAll('.v3-command').length, policy: window.__v3.game().convoy?.setup.policy };
    });
    check(r.policy === policy && r.formation === want.formation && r.flow === want.flow && r.note === want.note && r.cmds === 0, `${policy}: ${JSON.stringify(r)}`);
    if (policy === 'auto') await page.screenshot({ path: `${OUT_DIR}/strait-auto.png` });
  }

  // ---- The setup sheet picks the policy ----
  await open(page, 'lab=map-gauntlet&seed=7');
  const plain = await page.evaluate(() => ({ convoy: window.__v3.game().convoy, cmds: document.querySelectorAll('.v3-command').length, cls: document.querySelector('.v2-root').className }));
  check(plain.convoy === null && plain.cmds === 0 && !/convoy-/.test(plain.cls), 'a test with no policy asked for plays with today\'s controls, and no convoy layer at all');
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-convoy="tactical"]');
  const opts = await page.evaluate(() => [...document.querySelectorAll('[data-lab-convoy]')].map((b) => b.textContent));
  await page.tap('[data-lab-convoy="tactical"]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.convoy?.setup.policy === 'tactical' && document.querySelectorAll('.v3-command').length === 2, null, { timeout: 8000 });
  check(opts.join(' | ') === "Today's | Automatic | Formations | Commands: Rush and Disperse", `the setup sheet offers the four policies, naming the map's commands (${opts.join(' | ')}); picking one restarts the test under it`);
  await page.screenshot({ path: `${OUT_DIR}/gauntlet-tactical.png` });
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();

  // ---- A smaller phone: the rail still fits ----
  const small = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await open(small, 'lab=map-strait&convoy=tactical&seed=7');
  const fit = await small.evaluate(() => {
    const kids = [...document.querySelector('.v2-rail-left').children].filter((e) => e.getBoundingClientRect().height > 0).map((e) => e.getBoundingClientRect());
    const overlap = kids.some((a, i) => kids.some((b, j) => j > i && a.bottom > b.top + 1 && b.bottom > a.top + 1 && a.right > b.left + 1 && b.right > a.left + 1));
    return { overlap, bottom: Math.max(...kids.map((k) => k.bottom)), h: innerHeight, sw: document.documentElement.scrollWidth, iw: innerWidth };
  });
  check(!fit.overlap && fit.bottom <= fit.h && fit.sw <= fit.iw, `at 667 x 375 the rail's parts fit without overlapping (${JSON.stringify(fit)})`);
  await small.screenshot({ path: `${OUT_DIR}/strait-tactical-667.png` });
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
    return { convoy: window.__v3.game().convoy, cmds: vis('.v3-command'), formation: vis('.v2-formation-btn'), flow: vis('[data-flow]'), log: 'convoy' in window.__v3.log() };
  });
  check(ordinary.convoy === null && !ordinary.cmds && ordinary.formation && ordinary.flow && !ordinary.log, `an ordinary campaign run: no convoy layer, the formation button and flow slider as ever (${JSON.stringify(ordinary)})`);
  await camp.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 CONVOY E2E FAILED' : 'V3 CONVOY E2E PASSED');
