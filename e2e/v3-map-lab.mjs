// The Map & Convoy Lab's browser check (docs/design/v3-map-convoy-lab-plan.md,
// slices 0 and 1). Expects `vite preview` (or dev) at BASE_URL.
//
// On a landscape phone (874x402, touch), with real touches:
// - a Test Lab run on Harbor Mouth records telemetry as it is played; taps,
//   pickups, a formation change and a flow change all land in it;
// - the sidecar the live run made is the one its play log replays to, here
//   and (written out) under Node: tools/v3/map-lab/run.ts reads the files;
// - an ordinary campaign run records none, and `?tel=1` turns it on;
// - what recording costs a step, at full speed and with the CPU slowed 4x
//   (a stand-in for a phone; not a phone).
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-map-lab.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-map-lab';
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

/** One round of a player's touches: every threat with no shot on its way,
 *  and any pickup, each a real touch on the canvas. */
async function touchDefend(page) {
  const targets = await page.evaluate(() => {
    const g = window.__v3.game();
    if (!g || g.phase !== 'wave') return [];
    const on = (p) => p.x > 20 && p.x < 1580 && p.y > 20 && p.y < 880;
    return [
      ...g.pickups.filter(on).slice(0, 1),
      ...g.threats.filter((t) => on(t) && t.speed > 0 && !g.interceptors.some((i) => i.target === t.id)).slice(0, 3),
    ].map((t) => window.__v3.toClient(t.x, t.y));
  });
  for (const p of targets) await page.touchscreen.tap(p.x, p.y);
  return targets.length;
}

try {
  // ---- A Test Lab run on Harbor Mouth, played by touch ----
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=5`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  const start = await page.evaluate(() => {
    const g = window.__v3.game();
    const h = g.tel?.header;
    return { on: !!g.tel, map: g.map.id, mode: h?.mode, player: h?.player, input: h?.input, lab: h?.lab, schema: h?.schema, frame: h?.frame };
  });
  check(start.on && start.map === 'harbor' && start.mode === 'lab' && start.player === 'human' && start.lab?.card === 'map-harbor' && start.input?.touch && start.input.landscape && start.input.w === 874 && start.frame.w === 1600, `a Test Lab run records telemetry, its header naming the card, the player and the phone (${JSON.stringify(start)})`);

  let touches = 0;
  const t0 = Date.now();
  let formed = false;
  let flowed = false;
  let shot = false;
  while (Date.now() - t0 < 34_000) {
    touches += await touchDefend(page);
    const el = Date.now() - t0;
    if (!formed && el > 9_000) {
      formed = true;
      await page.tap('.v2-formation-btn');
      await page.tap('[data-formation="spread"]');
    }
    if (!flowed && el > 15_000) {
      flowed = true;
      // The top of the SHIPS slider: the fastest flow.
      const box = await page.locator('.v2-slider .v2-track').first().boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + 2);
    }
    if (!shot && el > 20_000) {
      shot = true;
      // Recording puts nothing on the screen: the field as the player sees it.
      await page.screenshot({ path: `${OUT_DIR}/harbor-lab-run.png` });
      const hud = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => /telemetr/i.test(e.className?.toString?.() ?? '') || /telemetry/i.test(e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent : '')).length);
      check(hud === 0, 'nothing about telemetry is on the screen during play');
    }
    await page.waitForTimeout(90);
  }
  const mid = await page.evaluate(() => {
    const g = window.__v3.game();
    const sc = window.__v3.telemetry();
    const count = (k) => sc.events.filter((e) => e.k === k).length;
    return {
      steps: g.steps, wave: g.wave, phase: g.phase, taps: count('tap'), hits: count('hit'), spawns: count('thr+'), pickups: count('pk+'), taken: sc.totals.pickups.collected,
      cmds: sc.events.filter((e) => e.k === 'cmd').map((e) => `${e.what}:${e.was}>${e.req}:${e.ok}`), audits: sc.totals.audits, samples: sc.samples.length, gameTaps: g.taps, telTaps: sc.totals.taps,
      flow: g.flow, formation: g.formation, bytes: JSON.stringify(sc).length,
    };
  });
  check(mid.taps > 20 && mid.spawns > 10 && mid.samples > 50 && mid.audits === 0, `${touches} touches in ${(mid.steps / 60).toFixed(0)} s of play: taps, launches and position samples are in the stream, with no gaps (${JSON.stringify({ taps: mid.taps, spawns: mid.spawns, hits: mid.hits, pickups: mid.pickups, taken: mid.taken, samples: mid.samples, audits: mid.audits, bytes: mid.bytes })})`);
  check(JSON.stringify(mid.gameTaps) === JSON.stringify(mid.telTaps), `every touch the game counted is a tap event (${JSON.stringify(mid.telTaps)})`);
  check(mid.formation === 'spread' && mid.cmds.includes('formation:pairs>spread:1'), `the formation change made on the rail is a command event (${JSON.stringify(mid.cmds)})`);
  check(mid.cmds.some((c) => c.startsWith('flow:') && c.endsWith(':1')) && mid.flow === 4, `the flow change made on the slider is a command event (flow ${mid.flow}; ${JSON.stringify(mid.cmds)})`);

  // Done: the verdict, and the log kept on the device.
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const done = await page.evaluate(() => {
    const logs = JSON.parse(localStorage.getItem('straitwatch.v3.playlogs') || '[]');
    const log = logs.find((l) => l.lab?.card === 'map-harbor');
    const live = window.__v3.telemetry();
    const again = window.__v3.replayTelemetry(log);
    return { log, live, liveDigest: window.__v3.telemetryDigest(live), again, inLog: JSON.stringify(log).includes('"thr+"'), keys: Object.keys(log) };
  });
  check(!!done.log && done.log.v === 21 && done.log.end === 'quit' && !done.inLog && !done.keys.includes('telemetry'), `the play log is as it was: version 21, no telemetry in it (${done.keys.join(',')})`);
  check(done.again.steps === done.live.steps && done.again.digest === done.liveDigest, `replaying the log in the browser makes the sidecar the live run made (${done.again.events} events, digest ${done.again.digest} = ${done.liveDigest})`);
  check(done.again.problems.length === 0, `the telemetry adds up to the game: hulls, sinkings, deliveries, kills, launches, pickups, taps (${done.again.problems.join('; ') || 'no differences'})`);
  check(done.live.phases.at(-1).end === 'left' && done.live.header.runId === done.log.id, `the sidecar is keyed to its log (${done.live.header.runId}) and ends where the run was left`);
  writeFileSync(`${OUT_DIR}/harbor-lab-log.json`, JSON.stringify(done.log));
  writeFileSync(`${OUT_DIR}/harbor-lab-telemetry.json`, JSON.stringify(done.live));
  writeFileSync(`${OUT_DIR}/harbor-lab-digest.txt`, done.liveDigest);
  // The run's numbers, for the slice's notes and review page (tools/v3/map-lab/page.ts).
  writeFileSync(
    `${OUT_DIR}/run.json`,
    JSON.stringify({ viewport: `${PHONE.viewport.width} x ${PHONE.viewport.height}`, touches, seconds: Math.round(done.live.steps / 60), taps: mid.taps, launches: mid.spawns, samples: mid.samples, events: done.again.events, bytes: JSON.stringify(done.live).length, digestLive: done.liveDigest, digestBrowserReplay: done.again.digest }, null, 1),
  );
  check(errs.length === 0, `no page errors in the lab run (${errs[0] ?? 'none'})`);
  await page.close();

  // ---- An ordinary campaign run records nothing; ?tel=1 turns it on ----
  for (const [q, want] of [['', false], ['?tel=1&seed=101&wave=9', true]]) {
    const p = await browser.newPage(PHONE);
    const e2 = [];
    p.on('pageerror', (e) => e2.push(e.message));
    await p.goto(`${BASE_URL}/v3.html${q}`, { waitUntil: 'networkidle' });
    await p.evaluate(() => localStorage.clear());
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForSelector('[data-screen="menu"]');
    await p.tap('[data-map="strait"]');
    await p.waitForSelector('[data-screen="loadout"]');
    await p.tap('[data-start]');
    await p.waitForSelector('.playing');
    await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ tel: !!window.__v3.game().tel, any: !!window.__v3.telemetry(), mode: window.__v3.game().tel?.header.mode }));
    check(st.tel === want && st.any === want && (!want || st.mode === 'campaign'), want ? `?tel=1 records a campaign run (${JSON.stringify(st)})` : `an ordinary campaign run records no telemetry (${JSON.stringify(st)})`);
    if (want) {
      // Undefended to the end: the result screen offers the telemetry beside the log.
      await p.evaluate(() => window.__v3.advance(240));
      await p.waitForSelector('[data-screen="result"], .v2-result', { timeout: 8000 });
      await p.waitForFunction(() => /Download telemetry/.test(document.querySelector('.v2-log-status')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => {});
      const res = await p.evaluate(() => {
        const sc = window.__v3.telemetry();
        return { line: document.querySelector('.v2-log-status')?.textContent, lastEnd: sc?.phases.at(-1)?.end, sunk: sc?.totals.sunk, hits: sc?.totals.hits, audits: sc?.totals.audits, w: document.documentElement.scrollWidth <= window.innerWidth };
      });
      check(/Download log/.test(res.line ?? '') && /Download telemetry/.test(res.line ?? '') && res.lastEnd === 'lost' && res.sunk >= 6 && res.audits === 0 && res.w, `a lost run: the result screen offers its telemetry beside its log, and the sinkings are in it (${JSON.stringify(res)})`);
      await p.screenshot({ path: `${OUT_DIR}/result-download-telemetry.png` });
    }
    check(e2.length === 0, `no page errors (${e2[0] ?? 'none'})`);
    await p.close();
  }

  // ---- What recording costs a step ----
  // The same undefended Harbor run, stepped as fast as the page can, with
  // telemetry on and off; then again with the CPU slowed 4x.
  const cost = {};
  for (const rate of [1, 4]) {
    for (const tel of [0, 1]) {
      const best = [];
      for (let k = 0; k < 3; k++) {
        const p = await browser.newPage(PHONE);
        const cdp = await p.context().newCDPSession(p);
        await p.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
        await p.evaluate(() => localStorage.clear());
        await p.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=5&tel=${tel}`, { waitUntil: 'networkidle' });
        await p.waitForSelector('.playing.lab-on');
        await p.evaluate(() => window.__v3.freeze(true));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate });
        const r = await p.evaluate(() => {
          const g = window.__v3.game();
          const s0 = g.steps;
          const t0 = performance.now();
          window.__v3.advance(60);
          const ms = performance.now() - t0;
          return { steps: g.steps - s0, ms, tel: !!g.tel, events: g.tel ? g.tel.events.length + g.tel.samples.length : 0 };
        });
        best.push(r);
        await p.close();
      }
      const b = best.sort((x, y) => x.ms / x.steps - y.ms / y.steps)[0];
      cost[`${rate}x-${tel ? 'on' : 'off'}`] = { usPerStep: +((b.ms * 1000) / b.steps).toFixed(1), steps: b.steps, events: b.events, tel: b.tel };
    }
  }
  const frame = 1000 / 60;
  const line = (rate) => {
    const off = cost[`${rate}x-off`];
    const on = cost[`${rate}x-on`];
    return `CPU ${rate}x: ${off.usPerStep} us a step off, ${on.usPerStep} us on (+${(on.usPerStep - off.usPerStep).toFixed(1)} us, ${(((on.usPerStep - off.usPerStep) / 1000 / frame) * 100).toFixed(2)}% of a 60 fps frame; ${on.steps} steps, ${on.events} events and samples)`;
  };
  console.log(`cost: ${line(1)}`);
  console.log(`cost: ${line(4)}`);
  writeFileSync(`${OUT_DIR}/cost.json`, JSON.stringify(cost, null, 1));
  check(cost['1x-on'].tel && !cost['1x-off'].tel, 'the cost runs had telemetry on and off as asked (?tel=0 turns a lab run\'s off)');
  check(cost['4x-on'].usPerStep - cost['4x-off'].usPerStep < 0.05 * frame * 1000, `with the CPU slowed 4x, recording costs under 5% of a frame a step (${(cost['4x-on'].usPerStep - cost['4x-off'].usPerStep).toFixed(1)} us of ${(frame * 1000).toFixed(0)})`);
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 MAP LAB E2E FAILED' : 'V3 MAP LAB E2E PASSED');
