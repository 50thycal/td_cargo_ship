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
// The authored data itself (type-only imports, so Node loads the .ts as is):
// the checks expect the current encounter rev and what it plays, not a copy.
const { ENCOUNTER_REV, encountersFor } = await import(new URL('../src/v3/data/encounters.ts', import.meta.url).href);
const { TIDE_TURN } = await import(new URL('../src/v3/sim/tide.ts', import.meta.url).href);

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
  // (Test Lab round 10: the map card's Quick slice, from wave 5; the full
  // map is e2e/v3-map-cards.mjs. Which encounter plays there, and under
  // which rev, comes from the data: rev 4's Strait has Swarm screen.)
  const [strait5] = encountersFor('strait', 5);
  await open(page, 'lab=map-strait&enc=1&plays=slice&seed=7');
  const s0 = await state(page);
  check(s0.wave === 5 && s0.enc?.rev === ENCOUNTER_REV && s0.log?.rev === ENCOUNTER_REV, `a map card opened with ?enc=1 carries the encounter layer at the current rev (${ENCOUNTER_REV}), and its log says so (wave ${s0.wave}; log ${JSON.stringify(s0.log)})`);
  check(s0.enc?.now.length === 1 && s0.enc.now[0] === strait5?.id && s0.queued.length > 0, `the wave has the map's encounter for it (${strait5?.id}), its launches in the queue (${s0.enc?.now.join()}: ${s0.queued.join(' ')})`);
  const named = await page.waitForFunction(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0], null, { timeout: 10000 }).then((h) => h.jsonValue()).catch(() => '');
  check(!!strait5 && named === `ENCOUNTER: ${strait5.name.toUpperCase()}`, `the encounter is named as the wave starts ("${named}")`);
  await page.screenshot({ path: `${OUT_DIR}/strait-encounter-named.png` });

  // Played on with nobody shooting: its launches come, tagged, and the log
  // replays. (Round 12's fixes: The Strait's wave 5 sends 10% more, and after
  // 40 s with nobody shooting the run was over; 32 s still takes in the
  // encounter, its swarm and the guided missile behind it.)
  await page.evaluate(() => window.__v3.advance(32));
  check(await page.evaluate(() => window.__v3.game().phase === 'wave'), 'the run is still going after 32 s with nobody shooting');
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
  check(run.header === ENCOUNTER_REV && run.named.includes(s0.enc.now[0]) && run.mine.length > 0 && run.ids.join() === s0.enc.now[0], `played on, the encounter's launches come and the telemetry tags each one (${run.mine.join(' ')}; named ${run.named.join()})`);
  check(run.same && run.problems.length === 0, `the test's log replays to the same telemetry, and it reconciles (${run.problems[0] ?? 'no problems'})`);
  await page.screenshot({ path: `${OUT_DIR}/strait-encounter-playing.png` });

  // ---- The setup sheet: the choice, and back to the shared waves ----
  await labMenu(page);
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
  await labMenu(page);
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
  check(both.enc?.length === 1 && /^harbor-/.test(both.enc[0]) && both.policy === 'tactical' && both.cmds.length === 0 && both.log.join() === 'true,tactical', `Harbor Mouth with its encounters under the Tactical policy (no command since round 11): both in the run and in its log (${JSON.stringify(both)})`);
  await page.evaluate(() => window.__v3.advance(30));
  const bothRun = await page.evaluate(() => {
    const live = window.__v3.telemetry();
    const again = window.__v3.replayTelemetry(window.__v3.log());
    return { same: again.digest === window.__v3.telemetryDigest(live), problems: again.problems };
  });
  check(bothRun.same && bothRun.problems.length === 0, `and that run replays to the same telemetry (${bothRun.problems[0] ?? 'no problems'})`);
  await page.screenshot({ path: `${OUT_DIR}/harbor-encounter-tactical.png` });

  // ---- Saltgate Canal (log v42): the trucks come to the locks, and the
  // boss is the Gatecrashers ----
  // The full map from wave 1: the pause screen's script names the boss
  // and sends no torpedo sub.
  await open(page, 'lab=map-saltgate&seed=7');
  const sg = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev }));
  check(sg.map === 'saltgate' && sg.rev === ENCOUNTER_REV, `Saltgate's card opens with its encounters (${JSON.stringify(sg)})`);
  await labMenu(page);
  const arcLine = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Gatecrashers/.test(arcLine), `Saltgate's script names its boss, the Gatecrashers (${arcLine})`);
  check(!/torpedo sub/i.test(await page.evaluate(() => document.querySelector('.v3-enc-script, [data-enc-version]')?.textContent ?? '')), 'and its script sends no torpedo sub');
  await page.screenshot({ path: `${OUT_DIR}/saltgate-script.png` });
  // Log v62: Skip to boss. The Gatecrashers are a parade of Missile Trucks
  // (no Rocket Truck) along the road behind the silos, west to east, never
  // stopping, lobbing ballistic missiles at the locks on the move.
  await page.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
  await page.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
  let parade = { trucks: 0, rockets: 0, lobs: 0, raised: 0 };
  for (let k = 0; k < 400 && (parade.lobs === 0 || parade.trucks === 0); k++) {
    // (The boss's intro cards hold the round: small steps, a tap through.)
    if (await page.evaluate(() => window.__v3.game().phase !== 'wave')) await page.mouse.click(437, 300);
    await page.evaluate(() => window.__v3.advance(0.1));
    await page.waitForTimeout(20);
    parade = await page.evaluate(() => {
      const g = window.__v3.game();
      const tr = g.threats.filter((t) => t.kind === 'missileTruck' && !t.dead);
      const ids = new Set(tr.map((t) => t.id));
      return {
        trucks: tr.length,
        rockets: g.threats.filter((t) => t.kind === 'rocketTruck').length,
        lobs: g.threats.filter((t) => t.kind === 'ballistic' && !t.dead && (ids.has(t.from) || (g.event?.sent.missileTruck ?? 0) > 0)).length,
        raised: tr.filter((t) => t.foe?.state === 1).length,
      };
    });
  }
  check(parade.trucks > 0 && parade.rockets === 0 && parade.lobs > 0, `the Gatecrashers' parade: Missile Trucks on the road lobbing ballistic missiles, no Rocket Truck (${JSON.stringify(parade)})`);
  const along = () => page.evaluate(() => Object.fromEntries(window.__v3.game().threats.filter((t) => t.kind === 'missileTruck' && !t.dead).map((t) => [t.id, { a: t.foe?.along ?? 0, y: t.y }])));
  const a0 = await along();
  await page.evaluate(() => window.__v3.advance(0.25));
  const a1 = await along();
  const kept = Object.keys(a0).filter((id) => a1[id]);
  check(kept.length > 0 && kept.every((id) => a1[id].a > a0[id].a) && kept.every((id) => a1[id].y < 300), `and every truck drives on along the road behind the silos (${JSON.stringify(kept.map((id) => [a0[id].a | 0, a1[id].a | 0, a1[id].y | 0]))})`);
  check(errs.length === 0, `no page errors in the missile parade (${errs[0] ?? 'none'})`);
  await page.screenshot({ path: `${OUT_DIR}/saltgate-missile-parade.png` });

  // ---- Battery Point (log v45): chapter 3's first map, the Blackout at
  // the guns ----
  await open(page, 'lab=map-battery&seed=7');
  const bp = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, posts: window.__v3.game().posts.length }));
  check(bp.map === 'battery' && bp.rev === ENCOUNTER_REV && bp.posts === 2, `Battery Point's card opens with its encounters and its two shore guns (${JSON.stringify(bp)})`);
  await labMenu(page);
  const bpArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Blackout/.test(bpArc), `Battery Point's script names its boss, the Blackout (${bpArc})`);
  await page.screenshot({ path: `${OUT_DIR}/battery-script.png` });

  // ---- Sowers' Reach (log v48): chapter 3's second map, mines on the
  // current, stealth bombers that sow them, and the Carpet Run ----
  await open(page, 'lab=map-sowers&seed=7');
  const sw = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command) }));
  check(sw.map === 'sowers' && sw.rev === ENCOUNTER_REV && sw.cmds.join() === '', `Sowers' Reach's card opens with its encounters and no Hold button (the Hold is automatic, log v68) (${JSON.stringify(sw)})`);
  await labMenu(page);
  const swArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Carpet Run/.test(swArc), `Sowers' Reach's script names its boss, the Carpet Run (${swArc})`);
  await page.screenshot({ path: `${OUT_DIR}/sowers-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): the vees of stealth bombers sow mines ahead of the convoy.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-sowers&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let carpet = { bombers: 0, sown: 0, sowing: 0 };
    for (let k = 0; k < 400 && carpet.sown < 4; k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      carpet = await one.evaluate(() => {
        const g = window.__v3.game();
        return {
          bombers: g.threats.filter((t) => t.kind === 'stealthBomber' && !t.dead).length,
          sowing: g.threats.filter((t) => t.kind === 'stealthBomber' && t.sow).length,
          sown: g.threats.filter((t) => t.kind === 'mine' && t.parent === 'stealthBomber' && !t.dead).length,
        };
      });
    }
    check(carpet.sown >= 1 && carpet.sowing >= 1, `the Carpet Run's stealth bombers sow mines ahead of the convoy (${JSON.stringify(carpet)})`);
    await one.screenshot({ path: `${OUT_DIR}/sowers-boss.png` });
    await one.close();
  }

  // ---- The Rig Field (log v49): chapter 3's third map, rigs in the sea
  // you can bring down, relief rigs towed in, and the Rig Barrage ----
  await open(page, 'lab=map-rigs&seed=7');
  const rg = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command) }));
  check(rg.map === 'rigs' && rg.rev === ENCOUNTER_REV && rg.cmds.length === 0, `the Rig Field's card opens with its encounters and no command (${JSON.stringify(rg)})`);
  await labMenu(page);
  const rgArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Rig Barrage/.test(rgArc) && /The relief tow/.test(rgArc), `the Rig Field's script names its boss, the Rig Barrage, and its first relief tow (${rgArc})`);
  await page.screenshot({ path: `${OUT_DIR}/rigs-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): the rigs risen again fire their volleys together.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-rigs&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let barrage = { rigs: 0, volley: 0, name: '' };
    for (let k = 0; k < 400 && barrage.volley < 3; k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      barrage = await one.evaluate(() => {
        const g = window.__v3.game();
        const rigs = g.threats.filter((t) => t.kind === 'rig' && !t.dead && t.tow === undefined);
        return {
          rigs: rigs.length,
          // Launches in the air off a rig's own station, as the volleys go.
          volley: g.threats.filter((t) => !t.dead && t.age < 3 && ['guided', 'ballistic', 'drone'].includes(t.kind) && rigs.some((r) => Math.hypot(r.x - t.sx, r.y - t.sy) < 4)).length,
          name: g.event?.id ?? '',
        };
      });
    }
    check(barrage.name === 'dive-circus' && barrage.rigs >= 2 && barrage.volley >= 3, `the Rig Barrage: the rigs risen again fire their volleys together (${JSON.stringify(barrage)})`);
    await one.screenshot({ path: `${OUT_DIR}/rigs-boss.png` });
    await one.close();
  }

  // ---- Dreadnought Pass (log v51): chapter 3's finale, the battleship's
  // passes, its spotters laying its guns, and the Dreadnought as the boss ----
  await open(page, 'lab=map-dreadnought&seed=7');
  const dn = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command) }));
  check(dn.map === 'dreadnought' && dn.rev === ENCOUNTER_REV && dn.cmds.length === 0, `Dreadnought Pass's card opens with its encounters and no command (${JSON.stringify(dn)})`);
  await labMenu(page);
  const dnArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: The Dreadnought/.test(dnArc), `Dreadnought Pass's script names its boss, the Dreadnought (${dnArc})`);
  await page.screenshot({ path: `${OUT_DIR}/dreadnought-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): the battleship heaves to and fires while its spotter
  // paints a ship.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-dreadnought&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let boss = { ship: 0, x: 0, held: false, broadside: 0, spotter: 0 };
    for (let k = 0; k < 400 && !(boss.held && boss.broadside >= 2); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      boss = await one.evaluate(() => {
        const g = window.__v3.game();
        const d = g.threats.find((t) => t.kind === 'dreadnought' && !t.dead);
        return {
          ship: d ? 1 : 0,
          x: d ? Math.round(d.x) : 0,
          held: !!d && d.holdT !== undefined,
          broadside: g.threats.filter((t) => t.parent === 'dreadnought' && !t.dead).length,
          spotter: g.threats.filter((t) => t.kind === 'spotter' && !t.dead).length,
        };
      });
    }
    check(boss.ship === 1 && boss.held && boss.broadside >= 1, `the Dreadnought heaves to and fires its broadside (${JSON.stringify(boss)})`);
    await one.screenshot({ path: `${OUT_DIR}/dreadnought-boss.png` });
    await one.close();
  }

  // ---- The Black Strait, the Lantern (log v52): chapter 3's night map,
  // fire out of the dark bank behind the ships, siege guns rising there,
  // and the Bombardment walking the far shore ----
  await open(page, 'lab=map-lantern&seed=7');
  const ln = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: document.querySelectorAll('.v3-command').length }));
  check(ln.map === 'lantern' && ln.rev === ENCOUNTER_REV && ln.cmds === 0, `the Black Strait's card opens with its encounters and no command (${JSON.stringify(ln)})`);
  await labMenu(page);
  const lnArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Bombardment/.test(lnArc) && /Glows in the dark/.test(lnArc), `the Black Strait's script names its first encounter and its boss, the Bombardment (${lnArc.slice(0, 120)})`);
  await page.screenshot({ path: `${OUT_DIR}/lantern-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): a line of siege guns along the far shore, the night over
  // it, their circles on the lane drawn over the dark.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-lantern&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let guns = { up: 0, hatches: 0, circles: 0, event: '' };
    for (let k = 0; k < 400 && !(guns.up >= 2 && guns.circles >= 2); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      guns = await one.evaluate(() => {
        const g = window.__v3.game();
        return {
          up: g.threats.filter((t) => t.kind === 'siege' && !t.dead).length,
          hatches: g.foe.marks.filter((m) => m.kind === 'hatch').length,
          circles: g.foe.marks.filter((m) => m.kind === 'shell').length,
          event: g.event?.id ?? '',
        };
      });
    }
    check(guns.event === 'bombardment' && guns.up >= 2 && guns.circles >= 2, `the Bombardment's guns rise along the shore and mark the lane (${JSON.stringify(guns)})`);
    await one.screenshot({ path: `${OUT_DIR}/lantern-boss.png` });
    await one.close();
  }

  // ---- The Coves (log v53): chapter 4's first map, fast boats out of four
  // coves, fire ships, and the Fire Fleet ----
  await open(page, 'lab=map-coves&seed=7');
  const cv = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command) }));
  check(cv.map === 'coves' && cv.rev === ENCOUNTER_REV && cv.cmds.length === 0, `the Coves' card opens with its encounters and no command (${JSON.stringify(cv)})`);
  await labMenu(page);
  const cvArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Fire Fleet/.test(cvArc) && /Fire ship/.test(cvArc), `the Coves' script names its boss, the Fire Fleet, and its first fire ship (${cvArc})`);
  await page.screenshot({ path: `${OUT_DIR}/coves-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): fire ships out of the coves at once, burning.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-coves&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let fleet = { fire: 0, name: '' };
    for (let k = 0; k < 400 && fleet.fire < 2; k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      fleet = await one.evaluate(() => {
        const g = window.__v3.game();
        return { fire: g.threats.filter((t) => t.kind === 'fastboat' && t.fire && !t.dead && t.age > 0.8).length, name: g.event?.id ?? '' };
      });
    }
    check(fleet.name === 'repair-yard' && fleet.fire >= 2, `the Fire Fleet: fire ships out of the coves at once (${JSON.stringify(fleet)})`);
    await one.screenshot({ path: `${OUT_DIR}/coves-boss.png` });
    await one.close();
  }

  // ---- The Delta (log v57; one long river, log v69): chapter 4's second
  // map, one lane about three times the usual length, a truck on every
  // bank, and the Long Gauntlet ----
  await open(page, 'lab=map-delta&seed=7');
  const dl = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: document.querySelectorAll('.v3-command').length }));
  check(dl.map === 'delta' && dl.rev === ENCOUNTER_REV && dl.cmds === 0, `the Delta's card opens with its encounters and no command (${JSON.stringify(dl)})`);
  await labMenu(page);
  const dlArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Long Gauntlet/.test(dlArc) && /The long river/.test(dlArc), `the Delta's script names its first encounter and its boss, the Long Gauntlet (${dlArc.slice(0, 120)})`);
  await page.screenshot({ path: `${OUT_DIR}/delta-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): the shore firing down the river silo by silo, each lit first.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-delta&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let burn = { lit: 0, raid: 0, event: '' };
    for (let k = 0; k < 500 && !(burn.lit >= 1 && burn.raid >= 3); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      burn = await one.evaluate(() => {
        const g = window.__v3.game();
        return {
          lit: g.fx.filter((f) => f.kind === 'launch' && f.r === 52).length,
          raid: g.threats.filter((t) => !t.dead && ['drone', 'guided', 'ballistic', 'cluster'].includes(t.kind)).length,
          event: g.event?.id ?? '',
        };
      });
    }
    check(burn.event === 'escort-run' && burn.lit >= 1 && burn.raid >= 3, `the Long Gauntlet: a silo is lit down the river and the raid comes (${JSON.stringify(burn)})`);
    await one.screenshot({ path: `${OUT_DIR}/delta-boss.png` });
    await one.close();
  }

  // ---- Dunmar Crossing (log v58): chapter 4's third map, two convoys
  // passing, spotter beacons at the crossing, and the Beacon Line ----
  await open(page, 'lab=map-crossing&seed=7');
  const cr = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: document.querySelectorAll('.v3-command').length }));
  check(cr.map === 'crossing' && cr.rev === ENCOUNTER_REV && cr.cmds === 0, `Dunmar Crossing's card opens with its encounters and no command (${JSON.stringify(cr)})`);
  await labMenu(page);
  const crArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Beacon Line/.test(crArc) && /Spotter/.test(crArc), `Dunmar Crossing's script names its first spotter and its boss, the Beacon Line (${crArc.slice(0, 120)})`);
  await page.screenshot({ path: `${OUT_DIR}/crossing-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): a line of beacons between the lanes, marking their ships.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-crossing&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let line = { up: 0, marked: 0, event: '' };
    for (let k = 0; k < 400 && !(line.up >= 3 && line.marked >= 2); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      line = await one.evaluate(() => {
        const g = window.__v3.game();
        const up = g.threats.filter((t) => t.kind === 'lure' && !t.dead && t.foe?.spot);
        return { up: up.length, marked: up.filter((t) => (t.foe.marked ?? -1) >= 0).length, event: g.event?.id ?? '' };
      });
    }
    check(line.event === 'beacon-strike' && line.up >= 3 && line.marked >= 2, `the Beacon Line: beacons between the lanes marking their ships together (${JSON.stringify(line)})`);
    await one.screenshot({ path: `${OUT_DIR}/crossing-boss.png` });
    await one.close();
  }

  // ---- Tidewater Flats (log v61): the tide goes out once a wave, the ships
  // crowd the deep channel, and Low Water ----
  await open(page, 'lab=map-tide&seed=7');
  const td = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: [...document.querySelectorAll('.v3-command')].map((b) => b.dataset.command), ebb: window.__v3.game().ebb }));
  check(td.map === 'tide' && td.rev === ENCOUNTER_REV && td.cmds.length === 0 && Array.isArray(td.ebb), `the Tide's card opens with its encounters, no command and the wave's own tide (${JSON.stringify(td)})`);
  await labMenu(page);
  const tdArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: Low Water/.test(tdArc) && /The first ebb/.test(tdArc), `the Tide's script names its boss, Low Water, and its first ebb (${tdArc})`);
  await page.screenshot({ path: `${OUT_DIR}/tide-script.png` });
  // Skip to the boss at the phone's own size and one pixel a point (the
  // record shot): the tide out, the ships crowded in the deep channel and a
  // strike in the air at them.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-tide&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let low = { air: 0, low: false, name: '' };
    for (let k = 0; k < 400 && !(low.low && low.air >= 2); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      low = await one.evaluate(() => {
        const g = window.__v3.game();
        const out = !!g.ebb && g.waveT >= g.ebb[0] && g.waveT < g.ebb[1];
        return { air: g.threats.filter((t) => !t.dead && ['ballistic', 'cluster', 'guided', 'supersonic'].includes(t.kind)).length, low: out, name: g.event?.id ?? '' };
      });
    }
    check(low.name === 'firestorm' && low.low && low.air >= 2, `Low Water: the tide out and a strike in the air at the crowd (${JSON.stringify(low)})`);
    await one.screenshot({ path: `${OUT_DIR}/tide-boss.png` });
    await one.close();
  }
  // The tide turning (log v68, the player: "the whole water should pull back
  // ... the ships left in the low tide are just stuck until the next high
  // tide ... slower too"): wave 1 played through its ebb at the phone's own
  // size, shots at high water with ships on both lanes, as the sea goes out
  // (the sand showing along both shores), at low water (the whole sea back
  // in the deep channel's bed, the carrier on sand, the ships on the flats
  // aground) and as it floods back. No ship changes lane on the way.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-tide&seed=7');
    const tideAt = () =>
      one.evaluate(
        ({ fall, rise }) => {
          const g = window.__v3.game();
          const [a, b] = g.ebb ?? [Infinity, Infinity];
          const t = g.waveT;
          const phase = t < a - fall ? 'high' : t < a ? 'falling' : t < b ? 'low' : t < b + rise ? 'rising' : 'high';
          const flats = g.map.channels.findIndex((c) => c.tide);
          const on = g.ships.filter((s) => s.channel === flats);
          return { wave: g.wave, phase, t: Math.round(t * 10) / 10, a, b, ships: g.ships.length, onFlats: on.length, lanes: Object.fromEntries(g.ships.map((s) => [s.id, s.channel])), ds: on.map((s) => Math.round(s.d * 100) / 100) };
        },
        { fall: TIDE_TURN.fall, rise: TIDE_TURN.rise },
      );
    const shots = {};
    const lane = new Map();
    let switched = 0;
    let st = await tideAt();
    for (let k = 0; k < 1500 && !shots.rising; k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      st = await tideAt();
      if (st.wave < 1) continue;
      for (const [id, ch] of Object.entries(st.lanes)) {
        if (lane.has(id) && lane.get(id) !== ch) switched++;
        lane.set(id, ch);
      }
      if (!shots.high && st.phase === 'high' && st.t > st.a - TIDE_TURN.fall - 6 && st.onFlats > 0) {
        await one.screenshot({ path: `${OUT_DIR}/tide-high.png` });
        shots.high = st;
      } else if (shots.high && !shots.mid && st.phase === 'falling' && st.t >= st.a - TIDE_TURN.fall / 2) {
        await one.screenshot({ path: `${OUT_DIR}/tide-falling.png` });
        shots.mid = st;
      } else if (shots.mid && !shots.low && st.phase === 'low' && st.t >= st.a + 3) {
        // Aground: the flats' hulls have not moved over the next second.
        await one.evaluate(() => window.__v3.advance(1));
        const later = await tideAt();
        await one.screenshot({ path: `${OUT_DIR}/tide-low.png` });
        shots.low = { ...st, stuck: st.ds.length > 0 && st.ds.join() === later.ds.slice(0, st.ds.length).join() };
      } else if (shots.low && !shots.rising && st.phase === 'rising' && st.t >= st.b + TIDE_TURN.rise / 2) {
        await one.screenshot({ path: `${OUT_DIR}/tide-rising.png` });
        shots.rising = st;
      }
    }
    const brief = (x) => (x ? { phase: x.phase, t: x.t, onFlats: x.onFlats, stuck: x.stuck } : x);
    check(!!shots.high && !!shots.mid && !!shots.low && !!shots.rising && shots.low.onFlats > 0 && shots.low.stuck && switched === 0, `the tide turns: ships on the flats at high water, none changing lane as it falls, aground and still at low water, the sea coming back (${JSON.stringify({ high: brief(shots.high), mid: brief(shots.mid), low: brief(shots.low), rising: brief(shots.rising), switched })})`);
    await one.close();
  }

  // ---- The Citadel (log v60): the game's last map, the shield that rises
  // every wave, fire under the dome, and the Last Stand ----
  await open(page, 'lab=map-citadel&seed=7');
  const ct = await page.evaluate(() => ({ map: window.__v3.game().map.id, rev: window.__v3.game().enc?.setup.rev, cmds: document.querySelectorAll('.v3-command').length, gens: window.__v3.game().threats.filter((t) => t.kind === 'generator').map((t) => t.hp) }));
  check(ct.map === 'citadel' && ct.rev === ENCOUNTER_REV && ct.cmds === 0 && ct.gens.join() === '3,3,3', `the Citadel's card opens with its encounters, no command, and three generators that count shots (${JSON.stringify(ct)})`);
  await labMenu(page);
  const ctArc = await page.evaluate(() => document.querySelector('.v3-enc-arc')?.textContent ?? '');
  check(/Boss rounds: The Last Stand/.test(ctArc) && /Under the guns/.test(ctArc), `the Citadel's script names its first encounter and its boss, the Last Stand (${ctArc.slice(0, 120)})`);
  await page.screenshot({ path: `${OUT_DIR}/citadel-script.png` });
  // Skip to the boss, at the phone's own size and one pixel a point (the
  // record shot): the shield up, the keep lit, a grand salvo under the dome.
  {
    const one = await browser.newPage({ ...PHONE, deviceScaleFactor: 1 });
    await open(one, 'lab=map-citadel&seed=7');
    await labMenu(one);
    await one.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await one.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    let st = { domed: 0, shield: false, event: '' };
    for (let k = 0; k < 500 && !(st.domed >= 2 && st.shield); k++) {
      if (await one.evaluate(() => window.__v3.game().phase !== 'wave')) await one.mouse.click(437, 300);
      await one.evaluate(() => window.__v3.advance(0.1));
      await one.waitForTimeout(20);
      st = await one.evaluate(() => {
        const g = window.__v3.game();
        const s = g.map.shield;
        return {
          domed: g.threats.filter((t) => !t.dead && t.dome && Math.hypot(t.x - s.x, t.y - s.y) <= s.r).length,
          shield: g.threats.some((t) => !t.dead && t.kind === 'generator'),
          event: g.event?.id ?? '',
        };
      });
    }
    check(st.event === 'siege-of-vey' && st.domed >= 2 && st.shield, `the Last Stand: the shield is up and a grand salvo leaves the keep under the dome (${JSON.stringify(st)})`);
    await one.screenshot({ path: `${OUT_DIR}/citadel-boss.png` });
    await one.close();
  }

  // ---- Where the choice is not offered ----
  // (Every map has its authored encounters since the Tide and the Citadel,
  // chapter 4's last two: only an event card is left.)
  for (const [card, why] of [['ev-rush', 'an event card']]) {
    await open(page, `lab=${card}&enc=1&seed=7`);
    await labMenu(page);
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
