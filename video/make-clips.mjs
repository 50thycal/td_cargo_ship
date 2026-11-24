// Straitwatch promo-clip pipeline.
//
//   npm run video                      # every clip  -> video/out/
//   npm run video -- railgun           # one clip by name
//   npm run video -- --list
//
// 1. Serves the built game (builds it first if dist/ is missing).
// 2. Plays a scripted session in headless Chromium through real mouse clicks
//    (the same hooks e2e/v3.mjs uses) while Playwright records the page.
// 3. ffmpeg trims the menu dead-air, burns the captions in, and encodes two
//    X-ready H.264/AAC MP4s per clip:
//      <name>-16x9.mp4   1280x720   (timeline / default X video)
//      <name>-9x16.mp4   1080x1920  (vertical: the game on a blurred copy of itself)
//
// Needs: node, ffmpeg, Chromium (Playwright's, at /opt/pw-browsers or CHROMIUM_PATH).

import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.VIDEO_OUT ?? join(ROOT, 'video', 'out');
const WORK = join(OUT, '.work');
const PORT = Number(process.env.VIDEO_PORT ?? 4180);
const W = 1280;
const H = 720;
const FONT = ['/usr/share/fonts/opentype/inter/Inter-Bold.otf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'].find(existsSync);

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  return undefined; // let Playwright look for its own
}

/** Playwright's chromium headless shell: the build that can draw a frame only when asked (frames mode). */
function findHeadlessShell() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  for (const d of readdirSync(root)) {
    if (!d.startsWith('chromium_headless_shell-')) continue;
    const exe = `${root}/${d}/chrome-headless-shell-linux64/chrome-headless-shell`;
    if (existsSync(exe)) return exe;
  }
  throw new Error(`frames mode needs Playwright's chromium headless shell (chromium_headless_shell-*) in ${root}`);
}

// The director's clock. Normally real time. In frames mode (see recordTake) it is the number of frames rendered so far
// (exactly 1/60 s of game time each), so a 0.8 s hold is always 48 frames however slow the machine is.
let VCLOCK = null;
const nowMs = () => (VCLOCK ? (VCLOCK() * 1000) / 60 : Date.now());
const sleep = (ms) =>
  VCLOCK
    ? (async () => {
        const target = VCLOCK() + Math.ceil((ms * 60) / 1000);
        while (VCLOCK() < target) await new Promise((r) => setTimeout(r, 2));
      })()
    : new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- game moves
// Everything here plays the way a person does: taps on threats and pickups
// the game itself spawned. Nothing is placed or spawned by the script. The
// only setup is Free Play's own screen (wave, weapons held, frequent drops).

const g = (page, fn, arg) => page.evaluate(fn, arg);

const NAMES = {
  railgun: ['Railgun', 'every tap fires a beam'],
  airstrike: ['Air Strike', 'calls in a jet'],
  thermo: ['Thermobaric Shell', 'big blast, slow shell'],
  well: ['Gravity Well', 'pulls the swarm together'],
};

/** Live threats on screen with no interceptor on them yet, nearest the carrier first (client coords). */
const openThreats = (page) =>
  g(page, () => {
    const gm = window.__v3.game();
    if (!gm || gm.phase !== 'wave') return [];
    return gm.threats
      .filter((t) => !t.dead && !gm.interceptors.some((i) => i.target === t.id))
      .sort((a, b) => b.y - a.y)
      .map((t) => window.__v3.toClient(t.x, t.y))
      .filter((p) => p.x > 5 && p.x < innerWidth - 90 && p.y > 5 && p.y < innerHeight - 5);
  });

let lastTap = 0;
/**
 * Tap the nearest open threat with the normal gun: only with rounds in the rack, at most one tap
 * every `gap` ms, and not while several interceptors are already in the air. (A bot that taps
 * constantly just drains the rack into the reload, which looks like spam.)
 */
async function defend(page, max = 1, gap = 420) {
  if (nowMs() - lastTap < gap) return;
  const pts = await g(page, () => {
    const gm = window.__v3.game();
    if (!gm || gm.phase !== 'wave' || gm.ammo < 1 || gm.interceptors.length >= 3) return [];
    return gm.threats
      .filter((t) => !t.dead && !gm.interceptors.some((i) => i.target === t.id))
      .sort((a, b) => b.y - a.y)
      .map((t) => window.__v3.toClient(t.x, t.y))
      .filter((p) => p.x > 5 && p.x < innerWidth - 90 && p.y > 140 && p.y < innerHeight - 5);
  });
  for (const p of pts.slice(0, max)) {
    await page.mouse.click(p.x, p.y);
    lastTap = nowMs();
  }
}

/** A weapon pickup lying on the water, if any (client coords). */
const weaponPickup = (page) =>
  g(page, () => {
    const gm = window.__v3.game();
    const p = gm?.phase === 'wave' ? gm.pickups.find((q) => q.kind === 'weapon' && !q.chute) : null;
    return p ? { ...window.__v3.toClient(p.x, p.y), weapon: p.weapon } : null;
  });

/** How many live threats are out over the water (not just launched at the top edge). */
const fieldThreats = (page) =>
  g(page, () => {
    const gm = window.__v3.game();
    return gm?.phase === 'wave' ? gm.threats.filter((t) => !t.dead && window.__v3.toClient(t.x, t.y).y > 150).length : 0;
  });

/** Tap any non-weapon pickup (ammo, repair) like a player would. */
async function grabSupplies(page) {
  const pts = await g(page, () => {
    const gm = window.__v3.game();
    return gm?.phase === 'wave' ? gm.pickups.filter((q) => q.kind !== 'weapon' && !q.chute).map((q) => window.__v3.toClient(q.x, q.y)) : [];
  });
  for (const p of pts) await page.mouse.click(p.x, p.y);
}

/** The loaded weapon, the rounds left and the score, read from the game. */
const state = (page) =>
  g(page, () => {
    const gm = window.__v3.game();
    return gm ? { weapon: gm.weapon?.id ?? null, ammo: gm.ammo, score: gm.score, phase: gm.phase, threats: gm.threats.filter((t) => !t.dead).length, ints: gm.interceptors.length } : null;
  });

/** Counts real threats taken down (gone from play) so a clip can prove its shots hit. */
async function installCounter(page) {
  await page.addInitScript((evenClock) => {
    // An even 60 Hz clock for the game. Its loop adds the time since the last frame to an accumulator and takes a fixed
    // 1/60 s step each time it passes one; on a real phone display that is one step per frame, but headless Chromium's
    // frame timestamps wobble by a fraction of a millisecond, and every wobble gives a frame with no step (everything
    // freezes) followed by one with two (everything jumps). Reporting exact 1/60 s frame times (a hair over, so float
    // rounding can never fall short) makes it one step per frame, like a real display.
    if (evenClock) {
      const orig = window.requestAnimationFrame.bind(window);
      const STEP = 1000 / 60 + 0.003;
      let virt = 0;
      let lastReal = -1;
      window.requestAnimationFrame = (cb) =>
        orig((t) => {
          if (t !== lastReal) {
            lastReal = t;
            virt = virt ? virt + STEP : t;
          }
          cb(virt);
        });
    }
    const seen = new Set();
    let prev = new Set();
    window.__vc = { kills: 0, seen: 0, log: [], dt: [], frames: 0 };
    { let l = performance.now(); const f = (n) => { window.__vc.dt.push(n - l); l = n; requestAnimationFrame(f); }; requestAnimationFrame(f); }
    const tick = () => {
      window.__vc.frames++;
      const gm = window.__v3?.game?.();
      if (gm) {
        // Scene filter (a clip opts in): only ammo and repair pickups stay on the water.
        if (window.__onlySupplies) for (let i = gm.pickups.length - 1; i >= 0; i--) if (gm.pickups[i].kind !== 'ammo' && gm.pickups[i].kind !== 'repair' && !(window.__allowWeapon && gm.pickups[i].kind === 'weapon')) gm.pickups.splice(i, 1);
        const stamp = window.__vc.frames;
        if (!window.__vc.last || stamp - window.__vc.last >= 15) {
          window.__vc.last = stamp;
          window.__vc.log.push([stamp, [...new Set(gm.threats.filter((x) => !x.dead).map((x) => x.kind))]]);
        }
        const now = new Set();
        for (const t of gm.threats) {
          if (!seen.has(t.id)) { seen.add(t.id); window.__vc.seen++; }
          if (!t.dead) now.add(t.id);
        }
        // Gone from play (shot down, or flown into the convoy: the carrier's hull tells the two apart in the notes).
        for (const id of prev) if (!now.has(id)) window.__vc.kills++;
        prev = now;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, !page.__frames);
}
const kills = (page) => page.evaluate(() => ({ kills: window.__vc.kills, seen: window.__vc.seen }));
/** Which enemy kinds were on the water between two animation frames (counted by the page). */
const pageFrames = (page) => page.evaluate(() => window.__vc.frames);
const kindsBetween = (page, a, b) => page.evaluate(([a, b]) => [...new Set(window.__vc.log.filter(([ts]) => ts >= a && ts <= b).flatMap(([, k]) => k))], [a, b]);

async function openMenu(page) {
  await installCounter(page);
  await page.goto(`http://localhost:${PORT}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('straitwatch.v3.run'));
  await page.waitForSelector('[data-screen="menu"]');
}

/** Free Play's own setup (the player's Free Play screen), then Start. */
async function startFreePlay(page, { wave, weapons = [], map = 'strait', frequentDrops = true, speedClicks = 0 }) {
  if (page.url() === 'about:blank') await openMenu(page);
  await page.evaluate(
    (fp) => localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify(fp)),
    { map, wave, weapons: [0, 1, 2].map((i) => (weapons[i] ? { id: weapons[i], level: 1 } : null)), armory: { gun: null, hull: null, supply: null }, frequentDrops, enemies: 'campaign' },
  );
  // The clips are silent, and the game's sound effects hitch the frame (about 270 ms the first time each plays): mute them.
  await page.evaluate(() => localStorage.setItem('straitwatch-v3-audio', JSON.stringify({ volume: 0, music: 0, muted: true })));
  // The game's playtest notes (Note buttons, the "Rate wave" scorecard after each wave) are not part of the game a viewer sees.
  await page.evaluate(() => localStorage.setItem('straitwatch.v3.notes', '0'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await sleep(600);
  await page.click('[data-free-play]');
  await page.waitForSelector('[data-free-start]');
  await sleep(500);
  await page.click('[data-free-start]');
  await page.waitForSelector('.playing');
  for (let i = 0; i < speedClicks; i++) await page.click('.v3-speed');
}

const sinceS = (t0) => (nowMs() - t0) / 1000;

/** Play the normal gun until `until()` says stop, with a hard timeout. */
async function playUntil(page, until, { limit = 45, tapEvery = 140 } = {}) {
  const t0 = nowMs();
  for (;;) {
    if (sinceS(t0) > limit) throw new Error(`timed out after ${limit}s waiting for the moment`);
    await defend(page, 2);
    await grabSupplies(page);
    if (await until(sinceS(t0))) return;
    await sleep(tapEvery);
  }
}

/** Threats that are worth a shot: air and missile threats in the open, not subs, mines or shore kit. */
const SKIP = ['torpedoSub', 'mine', 'rig', 'generator', 'citadel', 'dreadnought', 'rocketTruck', 'missileTruck'];

/**
 * Aim the loaded weapon the way a player would: the beam through the most
 * threats (railgun), or the densest cluster (shells, well, air strike). Returns
 * the number of threats the shot should hit, or 0 when it did not fire
 * (nothing worth a round, so no shot goes into empty water).
 */
async function fireAt(page, weapon, minHits = 1) {
  const aim = await g(page, ([weapon, SKIP]) => {
    const gm = window.__v3.game();
    if (!gm || gm.phase !== 'wave') return null;
    const th = gm.threats.filter((t) => !t.dead && !SKIP.includes(t.kind) && window.__v3.toClient(t.x, t.y).y > 120 && window.__v3.toClient(t.x, t.y).x < innerWidth - 90);
    if (!th.length) return null;
    const c = gm.map.carrier;
    let best = null;
    if (weapon === 'railgun' || weapon === 'lance') {
      for (let a = -Math.PI * 0.98; a <= -Math.PI * 0.02; a += Math.PI / 180) {
        const ux = Math.cos(a), uy = Math.sin(a);
        let n = 0;
        for (const t of th) {
          const along = (t.x - c.x) * ux + (t.y - c.y) * uy;
          if (along < 0) continue;
          if (Math.abs((t.x - c.x) * uy - (t.y - c.y) * ux) <= 30) n++;
        }
        if (!best || n > best.n) best = { n, x: c.x + ux * 300, y: c.y + uy * 300 };
      }
    } else {
      const R = weapon === 'well' ? 130 : weapon === 'thermo' ? 70 : 110;
      for (const t of th) {
        const near = th.filter((u) => Math.hypot(u.x - t.x, u.y - t.y) <= R);
        const n = near.length;
        if (!best || n > best.n) best = { n, x: near.reduce((a, u) => a + u.x, 0) / n, y: near.reduce((a, u) => a + u.y, 0) / n };
      }
    }
    return best && { n: best.n, ...window.__v3.toClient(best.x, best.y) };
  }, [weapon, SKIP]);
  if (!aim || aim.n < minHits) return 0;
  if (weapon === 'lance') {
    // Charge Lance: hold to charge (0.7 s is a full lance), let go to fire.
    await page.mouse.move(aim.x, aim.y);
    await page.mouse.down();
    await sleep(800);
    await page.mouse.up();
  } else await page.mouse.click(aim.x, aim.y);
  return aim.n;
}

// ------------------------------------------------------------------- studio mode
// A studio scene is a script: what appears, when, and what the caption says, so the
// footage matches the script instead of hunting through waves for it. It still runs
// the game's own simulation (its enemies, its interceptors, its draft screens) and the
// director still plays with real taps. What it adds is control over WHAT is launched
// and WHEN: it empties the wave's own spawn list and launches what the scene asks for.
// Clips made this way are flagged `studio: true` in <clip>.captions.json.

/** Take over the wave: drop its own launches, hold it open until the scene ends it. */
const studioBegin = (page) =>
  g(page, () => {
    const gm = window.__v3.game();
    gm.queue.length = 0;
    gm.raids.length = 0;
    gm.raiderQueue.length = 0;
    gm.queue.push({ at: 1e9, kind: 'drone', base: 0 }); // placeholder: keeps the wave open
  });
/** Let the wave finish once everything on the water is gone. */
const studioEnd = (page) => g(page, () => (window.__v3.game().queue.length = 0));
/** Launch `n` enemies of a kind from the map's bases, through the wave's own launch queue. */
const studioSpawn = (page, kind, n = 1) =>
  g(page, ([kind, n]) => {
    const gm = window.__v3.game();
    const bases = gm.map.bases.length;
    for (let i = 0; i < n; i++) gm.queue.push({ at: gm.waveT + 0.05 + i * 0.2, kind, base: i % bases });
    gm.queue.sort((a, b) => a.at - b.at); // the queue is read from the front; the placeholder stays last
  }, [kind, n]);
/** Deal a chosen weapon card first in the upgrade draft (as the game's own Test Lab does for a weapon under test). */
const studioOffer = (page, id) =>
  g(page, (id) => {
    const gm = window.__v3.game();
    gm.offer = [id, ...gm.offer.filter((x) => x !== id)].slice(0, 3);
  }, id);
/** Hold a weapon with no draft (a studio rehearsal), and put it away again. */
const studioGive = (page, id) => g(page, (id) => { const gm = window.__v3.game(); gm.levels = { ...gm.levels, [id]: 1 }; gm.slots = [id]; }, id);
const studioTake = (page) => g(page, () => { const gm = window.__v3.game(); gm.levels = {}; gm.slots = []; gm.weapon = null; gm.pickups = gm.pickups.filter((p) => p.kind !== 'weapon'); });
/** Drop a weapon pickup the player holds (as a kill would) at (x, y). */
const studioDropWeapon = (page, x, y) =>
  g(page, ([x, y]) => {
    const gm = window.__v3.game();
    const id = gm.slots[gm.slots.length - 1];
    if (id) gm.pickups.push({ id: 80500 + Math.floor(Math.random() * 999), kind: 'weapon', weapon: id, x, y, age: 0 });
    return id ?? null;
  }, [x, y]);
/** Put an ammo or repair drop on the water (world coordinates). */
const studioDrop = (page, kind, x, y) =>
  g(page, ([kind, x, y]) => window.__v3.game().pickups.push({ id: 80000 + Math.floor(Math.random() * 9999), kind, x, y, age: 0 }), [kind, x, y]);

/**
 * Run a timeline while the director plays. Events: { at, spawn: [kind, n] } | { at, drop: [kind, x, y] }
 * | { at, cue: [head, sub, secs] } | { at, end: true }. `at` is seconds from this call.
 * Returns when the wave has ended (phase no longer 'wave') or `limit` seconds pass.
 */
async function runTimeline(page, t, events, { limit = 60, tick = null } = {}) {
  const todo = [...events].sort((a, b) => a.at - b.at);
  const t0 = nowMs();
  while (sinceS(t0) < limit) {
    while (todo.length && todo[0].at <= sinceS(t0)) {
      const e = todo.shift();
      if (e.spawn) await studioSpawn(page, ...e.spawn);
      if (e.drop) await studioDrop(page, ...e.drop);
      if (e.weaponDrop) await studioDropWeapon(page, ...e.weaponDrop);
      if (e.cue) t.cue(...e.cue);
      if (e.end) await studioEnd(page);
    }
    if (tick) await tick(sinceS(t0));
    else await defend(page, 1);
    await grabSupplies(page);
    if ((await state(page))?.phase !== 'wave') return;
    await sleep(140);
  }
}

// ------------------------------------------------------------ explain beats (for viewers with no context)
// Reading a caption while watching action is hard when you do not know the game. So the key moments are "explain beats": the game
// pauses, a ring and a short label are drawn ON the thing being explained (your carrier, a cargo ship, an incoming missile, the
// new weapon), it holds long enough to read, then play carries on. The top captions stay short and sit in their own area.

/** Pause or resume the game's clock (the game's own test hook; the scene stays drawn). */
const freeze = (page, on) => g(page, (on) => window.__v3.freeze(on), on);

/** Draw rings and labels over things in the game. Each spec: { what: 'carrier'|'ship'|'threat'|'pickup'|'card', kind?, idx?, head, sub? }. */
const showLabels = (page, specs) =>
  g(page, (specs) => {
    document.getElementById('vc-labels')?.remove();
    const gm = window.__v3.game();
    const tc = (x, y) => window.__v3.toClient(x, y);
    const root = document.createElement('div');
    root.id = 'vc-labels';
    root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;font-family:Inter,system-ui,sans-serif';
    const css = document.createElement('style');
    css.textContent = '@keyframes vcpulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.75}}';
    root.append(css);
    const W = innerWidth;
    for (const sp of specs) {
      let p = null;
      let r = 44;
      if (sp.what === 'carrier') { p = tc(gm.map.carrier.x, gm.map.carrier.y); r = 78; }
      else if (sp.what === 'ship') { const sh = gm.ships.filter((q) => !q.sunk)[sp.idx ?? 0]; if (sh) { p = tc(sh.x, sh.y); r = 40; } }
      else if (sp.what === 'threat') { const th = gm.threats.find((q) => !q.dead && q.kind === sp.kind); if (th) { p = tc(th.x, th.y); r = 44; } }
      else if (sp.what === 'pickup') { const pk = gm.pickups.find((q) => q.kind === 'weapon') ?? gm.pickups[0]; if (pk) { p = tc(pk.x, pk.y); r = 48; } }
      else if (sp.what === 'card') { const c = document.querySelectorAll('.v2-draft .v2-card')[sp.idx ?? 0]; if (c) { const b = c.getBoundingClientRect(); p = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; r = Math.max(b.width, b.height) / 2 + 6; } }
      if (!p) continue;
      const x = Math.min(W - 100, Math.max(60, p.x));
      const y = p.y;
      const ring = document.createElement('div');
      ring.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;border:5px solid #8fe3ff;border-radius:50%;box-shadow:0 0 18px #8fe3ff,inset 0 0 12px rgba(143,227,255,.5);animation:vcpulse .9s ease-in-out infinite`;
      const box = document.createElement('div');
      box.style.cssText = 'position:absolute;background:rgba(8,18,28,.94);border:2px solid #8fe3ff;border-radius:12px;padding:8px 16px;text-align:center;white-space:nowrap';
      box.innerHTML = `<div style="font:800 30px/1.15 Inter,system-ui,sans-serif;color:#fff;letter-spacing:.02em">${sp.head}</div>${sp.sub ? `<div style="font:700 21px/1.2 Inter,system-ui,sans-serif;color:#8fe3ff;margin-top:2px">${sp.sub}</div>` : ''}`;
      root.append(ring, box);
      // below the ring when there is room under it, else above
      const below = y + r + 110 < innerHeight;
      document.body.append(root);
      const bw = box.offsetWidth;
      const left = Math.min(W - 100 - bw, Math.max(8, x - bw / 2));
      box.style.left = `${left}px`;
      box.style.top = below ? `${y + r + 10}px` : `${Math.max(150, y - r - 10 - box.offsetHeight)}px`;
    }
    document.body.append(root);
  }, specs);
const hideLabels = (page) => g(page, () => document.getElementById('vc-labels')?.remove());

/** An explain beat: pause the game, label things, hold, carry on. `ms` is game-free time (frames). */
async function explain(page, specs, ms) {
  await freeze(page, true);
  await showLabels(page, specs);
  await sleep(ms);
  await hideLabels(page);
  await freeze(page, false);
}

/** Wait (without shooting) until a live threat of this kind is out over the water, so a beat can point at it. */
async function waitForThreat(page, kind, limitS = 5) {
  const t0 = nowMs();
  while ((nowMs() - t0) / 1000 < limitS) {
    const ok = await g(page, (kind) => {
      const gm = window.__v3.game();
      const th = gm.threats.find((q) => !q.dead && q.kind === kind);
      return !!th && window.__v3.toClient(th.x, th.y).y > 190;
    }, kind);
    if (ok) return true;
    await sleep(60);
  }
  return false;
}

/** Play with the normal gun for a number of seconds. Returns false if the wave ended meanwhile. */
async function playFor(page, secs) {
  const end = nowMs() + secs * 1000;
  while (nowMs() < end) {
    await defend(page, 1);
    await grabSupplies(page);
    if ((await state(page))?.phase !== 'wave') return false;
    await sleep(140);
  }
  return true;
}

/** Deal a chosen weapon card first, whenever the game next opens the upgrade draft (it deals, then sets the phase). */
const studioDealOnDraft = (page, id) =>
  g(page, (id) => {
    const gm = window.__v3.game();
    let ph = gm.phase;
    Object.defineProperty(gm, 'phase', {
      configurable: true,
      enumerable: true,
      get: () => ph,
      set: (v) => {
        if (v === 'draft' && ph !== 'draft') gm.offer = [id, ...gm.offer.filter((x) => x !== id)].slice(0, 3);
        ph = v;
      },
    });
  }, id);

// ------------------------------------------------------------------- clips
// `t` is the director: t.mark() = where the clip starts (all before is cut),
// t.cue(head, sub, secs) = a caption from now, t.stop() = where it ends.
// Captions fire when the game event happens, so they always match the frame.

const CLIPS = {
  // Menu -> Free Play wave 3 -> real intercepts with the normal gun.
  // The launch clip, scripted for someone who has never seen the game (studio mode, frames mode). Storyboard:
  //   1 Title, game paused: rings on YOUR CARRIER and the CARGO SHIPS. 2 Wave 1: protect the ships; the first missile and the first
  //   supersonic missile are pointed at (pause, ring, label). 3 The upgrade draft, a card ringed. 4 Wave 2, harder: the new
  //   weapon drops (ringed), is loaded, and the carrier is ringed for "hold, then let go". 5 Still in development.
  // VIDEO_EXPLAIN=0 renders the captions-only version of the same footage (no pauses or rings) to compare.
  convoy: {
    title: 'Defend the convoy (studio)',
    studio: true,
    vertical: true,
    takes: 2,
    viewport: { width: 1080, height: 608 },
    async play(page, t) {
      const EXPLAIN = process.env.VIDEO_EXPLAIN !== '0';
      t.maxSeconds = 120;
      await startFreePlay(page, { wave: 1, weapons: [], frequentDrops: false });
      await page.evaluate(() => {
        window.__onlySupplies = true;
        window.__allowWeapon = true;
      });
      await studioBegin(page);
      await studioDealOnDraft(page, 'lance'); // the draft deals the Charge Lance first (studio)
      const k0 = (await kills(page)).kills;
      t.start = t.now();
      const cue = (head, sub, dur) => t.cue(head, sub, dur);
      // A beat: with explain on, pause and point; with it off, the same words as a top caption over live play.
      const beat = async (specs, secs, head, sub) => {
        if (EXPLAIN) await explain(page, specs, secs * 1000);
        else {
          cue(head, sub, secs + 0.4);
          await playFor(page, secs);
        }
      };

      // 1. Title (paused): what you are looking at.
      cue('Straitwatch', "a convoy defence game I'm building", 4.4);
      await beat([{ what: 'carrier', head: 'YOUR CARRIER', sub: 'it defends the convoy' }, { what: 'ship', idx: 0, head: 'CARGO SHIPS', sub: 'keep them alive' }], 4.2, 'Your carrier', 'it defends the cargo ships');

      // 2. Wave 1.
      await studioSpawn(page, 'drone', 2);
      cue('Protect the ships', 'survive every wave', 3.6);
      await playFor(page, 3.2);
      await studioSpawn(page, 'ballistic', 1);
      await waitForThreat(page, 'ballistic', 5);
      await beat([{ what: 'threat', kind: 'ballistic', head: 'ENEMY MISSILE', sub: 'tap it to shoot it down' }], 2.4, 'Enemy missiles', 'tap them to shoot them down');
      cue('Tap to shoot them down', 'before they hit', 3.4);
      await playFor(page, 4.5);
      await studioSpawn(page, 'supersonic', 1);
      await studioDrop(page, 'ammo', 760, 330);
      await waitForThreat(page, 'supersonic', 5);
      await beat([{ what: 'threat', kind: 'supersonic', head: 'SUPERSONIC MISSILE', sub: 'much faster' }], 1.6, 'Supersonic missiles', 'much faster');
      await playFor(page, 3);
      await studioSpawn(page, 'drone', 3);
      await playFor(page, 2.5);
      await studioSpawn(page, 'ballistic', 2);
      await studioDrop(page, 'repair', 900, 320);
      await playFor(page, 3);
      await studioEnd(page);
      for (const w0 = nowMs(); (await state(page))?.phase === 'wave' && nowMs() - w0 < 30000; ) {
        await defend(page, 1);
        await grabSupplies(page);
        await sleep(140);
      }
      if ((await state(page))?.phase !== 'draft') throw new Error('wave 1 did not clear');

      // 3. The upgrade draft.
      await page.waitForSelector('.v2-draft .v2-card', { timeout: 8000 });
      const cards = await page.$$eval('.v2-draft .v2-card', (cs) => cs.map((c) => ({ id: c.dataset.upgrade ?? '', name: c.querySelector('.v2-card-name')?.textContent?.trim() ?? '' })));
      const pickIx = Math.max(0, cards.findIndex((c) => c.id === 'lance'));
      const pickedName = cards[pickIx]?.name || 'New weapon';
      cue('Upgrade your defences', 'the attacks intensify each wave', 5.2);
      if (EXPLAIN) await showLabels(page, [{ what: 'card', idx: pickIx, head: 'PICK AN UPGRADE', sub: 'a new weapon each wave' }]);
      await sleep(3600);
      await hideLabels(page);
      await page.locator('.v2-draft .v2-card').nth(pickIx).click();
      await page.waitForFunction(() => window.__v3.game()?.wave === 2 && window.__v3.game()?.phase === 'wave', null, { timeout: 15000 });
      await studioBegin(page);

      // 4. Wave 2: harder; the new weapon drops and is used.
      await studioSpawn(page, 'drone', 4);
      await playFor(page, 2.2);
      await studioSpawn(page, 'ballistic', 2);
      await studioSpawn(page, 'supersonic', 1);
      await playFor(page, 2.6);
      await studioDropWeapon(page, 740, 320);
      await sleep(250);
      await beat([{ what: 'pickup', head: 'NEW WEAPON', sub: 'tap it to load your gun' }], 2.2, 'New weapon drops', 'tap it to load your gun');
      const wp = await weaponPickup(page);
      if (!wp) throw new Error('the new weapon pickup was gone');
      await page.mouse.click(wp.x, wp.y);
      await sleep(200);
      if ((await state(page))?.weapon == null) throw new Error('the weapon did not load');
      await beat([{ what: 'carrier', head: pickedName.toUpperCase(), sub: 'hold to charge, then let go' }], 2.2, pickedName, 'hold to charge, then let go');
      let shots = 0;
      let lastShot = 0;
      const until = nowMs() + 12000;
      let nextWave = nowMs();
      while (nowMs() < until) {
        if (nowMs() >= nextWave) {
          await studioSpawn(page, 'drone', 4);
          await studioSpawn(page, 'ballistic', 1);
          nextWave = nowMs() + 3600;
        }
        const s = await state(page);
        if (s?.weapon) {
          if (s.ammo > 0 && nowMs() - lastShot > 1100 && (await fireAt(page, s.weapon, nowMs() - lastShot > 2600 ? 1 : 2))) {
            lastShot = nowMs();
            shots++;
          }
        } else await defend(page, 1);
        await grabSupplies(page);
        await sleep(140);
      }

      // 5. Close.
      t.cues.push({ at: t.now() - 4.6, head: 'Still in development', sub: 'Free Play testing soon', dur: 4.8 });
      t.stopAt = t.now() - 0.1;
      const k = (await kills(page)).kills - k0;
      t.score = k + shots * 3;
      t.note(`studio scene (${EXPLAIN ? 'explain beats' : 'captions only'}): ${k} enemies shot down; ${pickedName} fired ${shots} aimed shots; ammo/repair drops and the weapon pickup placed`);
    },
  },

  // A real wave: normal gun, then a railgun pickup the game drops, then beams, then back to normal.
  railgun: {
    title: 'Railgun',
    takes: 4,
    async play(page, t) {
      await startFreePlay(page, { wave: 7, weapons: ['railgun'] });
      const tPlay = t.now();
      // Normal gun until the game drops a railgun pickup with a burst on the water. The clip
      // then starts ~5 s earlier (the footage is already recorded), so the lead-in is real play.
      let pk = null;
      let tCue = 0;
      for (let attempt = 0; attempt < 6 && !pk; attempt++) {
        await playUntil(page, async () => t.now() - tPlay > 5 && !!(await weaponPickup(page)), { limit: 60 });
        // The pickup floats for about 7 s: give a burst up to 2.5 s to come out over the water, then take it either way.
        const w0 = nowMs();
        while ((nowMs() - w0) / 1000 < 2.5 && (await fieldThreats(page)) < 2 && (await weaponPickup(page))) {
          await defend(page, 1);
          await sleep(140);
        }
        if (!(await weaponPickup(page))) continue; // it expired meanwhile: wait for the next drop
        tCue = t.now();
        t.cue('Weapons drop as pickups', 'tap one to grab it', 1.4);
        const c0 = nowMs();
        await playUntil(page, async () => sinceS(c0) > 1.2, { limit: 6 });
        pk = await weaponPickup(page);
        if (!pk) t.cues.pop(); // gone before it could be tapped: this attempt's caption is not used
      }
      if (!pk) throw new Error('no weapon pickup could be tapped in time');
      t.start = Math.max(tPlay, tCue - 3.6);
      t.cues.unshift({ at: t.start + 0.2, head: 'Tap a missile to intercept it', sub: 'normal main gun', dur: 3.4 });
      await page.mouse.click(pk.x, pk.y);
      await sleep(150);
      const loaded = await state(page);
      if (loaded?.weapon !== 'railgun') throw new Error(`railgun not loaded (${loaded?.weapon})`);
      t.cue('Railgun loaded for 15 seconds', 'every tap fires a beam', 3.5);
      // Beams at real threats until the 15 s run out and the gun reverts.
      let shots = 0;
      let hits = 0;
      const k0 = (await kills(page)).kills;
      const l0 = nowMs();
      let lastBeam = nowMs();
      let worstGap = 0;
      while (sinceS(l0) < 17) {
        const s = await state(page);
        if (!s || s.weapon !== 'railgun') break;
        worstGap = Math.max(worstGap, sinceS(lastBeam));
        const n = s.ammo > 0 ? await fireAt(page, 'railgun', sinceS(lastBeam) > 1.5 ? 1 : 2) : 0;
        if (n) {
          shots++;
          hits += n;
          lastBeam = nowMs();
        }
        await sleep(300);
      }
      worstGap = Math.max(worstGap, sinceS(lastBeam));
      t.score = hits * 2 - worstGap * 3;
      t.cue('Then it goes back to the normal gun', null, 3);
      await playUntil(page, async (s) => s > 3);
      t.note(`railgun: longest gap ${worstGap.toFixed(1)}s, ${shots} beams, ${hits} threats lined up in the beams, ${(await kills(page)).kills - k0} threats gone while loaded`);
      t.stop();
    },
  },

  // Three different weapons the game dropped, each used on real threats.
  arsenal: {
    title: 'Arsenal',
    takes: 4,
    async play(page, t) {
      await startFreePlay(page, { wave: 7, weapons: ['airstrike', 'thermo', 'well'] });
      const tPlay = t.now();
      const k0 = (await kills(page)).kills;
      const seen = [];
      let tFirst = null;
      let lastLoad = nowMs() - 2000;
      let shots = 0;
      let hits = 0;
      let lastShot = 0;
      const m0 = nowMs();
      // Normal gun, and whichever of the three weapons the game drops next. Load each on a real
      // threat count, then fire only where it will hit. Different weapons only.
      while (seen.length < 3 && sinceS(m0) < 70 && (tFirst === null || t.now() - tFirst < 17.5)) {
        const s = await state(page);
        if (s?.phase !== 'wave') break;
        const field = await fieldThreats(page);
        if (s?.weapon) {
          const n = s.ammo > 0 && nowMs() - lastShot > 1000 ? await fireAt(page, s.weapon, s.weapon === 'airstrike' ? 1 : 2) : 0;
          if (n) {
            lastShot = nowMs();
            shots++;
            hits += n;
          }
        } else {
          await defend(page, 2);
        }
        await grabSupplies(page);
        const pk = nowMs() - lastLoad > 3600 && field >= 2 && t.now() - tPlay > 5 ? await weaponPickup(page) : null;
        if (pk && !seen.includes(pk.weapon)) {
          await page.mouse.click(pk.x, pk.y);
          await sleep(120);
          const w = (await state(page))?.weapon;
          if (w) {
            seen.push(w);
            if (tFirst === null) tFirst = t.now();
            lastLoad = nowMs();
            lastShot = 0;
            const [head, sub] = NAMES[w] ?? [w, null];
            t.cue(head, sub, 3.2);
          }
        }
        await sleep(140);
      }
      if (tFirst === null) throw new Error('no weapon was loaded');
      t.start = Math.max(tPlay, tFirst - 4);
      t.cues.unshift({ at: t.start + 0.2, head: 'Tap a missile to intercept it', sub: 'normal main gun', dur: 3.3 });
      const kk = (await kills(page)).kills - k0;
      t.score = hits + 8 * seen.length;
      t.note(`loaded ${seen.join(', ')}; ${shots} shots aimed at ${hits} threats; ${kk} threats gone`);
      // End on the action, before the wave-cleared banner takes the screen.
      if ((await state(page))?.phase === 'wave') await sleep(1000);
      else t.cues = t.cues.filter((c) => c.at < t.now() - 0.6);
      t.stop();
      t.stopAt -= (await state(page))?.phase === 'wave' ? 0 : 0.9;
    },
  },
};

// ---------------------------------------------------------------- recording

async function serve() {
  if (!existsSync(join(ROOT, 'dist', 'v3.html'))) {
    console.log('building the game (dist/ missing)...');
    const b = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
    if (b.status) throw new Error('build failed');
  }
  const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/v3.html`)).ok) return proc;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  proc.kill();
  throw new Error('preview server did not start');
}

/**
 * Two ways to capture the page:
 *  - Playwright's recordVideo: a fixed 25 fps screen grab (simple, but steppy on fast motion).
 *  - 'cdp': Chromium's own frame stream (about 60 fps, each frame with its real timestamp),
 *    laid out on a constant 60 fps timeline by ffmpeg. Smooth; use it for fast scenes.
 * A clip picks with `capture: 'cdp'`, or set VIDEO_CAPTURE=cdp for all.
 */
async function recordTake(browser, name, clip, take) {
  const mode = process.env.VIDEO_CAPTURE ?? clip.capture ?? 'frames';
  const cdpMode = mode === 'cdp';
  const framesMode = mode === 'frames';
  const dir = join(WORK, `${name}-${take}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const vp = clip.viewport ?? { width: W, height: H };
  // Frames mode (the smooth one): the browser draws a frame only when told to, with an exact timestamp, so the game steps exactly
  // 1/60 s per frame and nothing can be dropped, however slow the machine is. See the README.
  const fbrowser = framesMode
    ? await chromium.launch({ executablePath: findHeadlessShell(), args: ['--no-sandbox', '--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout', '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging', '--disable-image-animation-resync'] })
    : null;
  const ctx = await (fbrowser ?? browser).newContext({ viewport: vp, ...(cdpMode || framesMode ? {} : { recordVideo: { dir, size: { width: W, height: H } } }) });
  const page = await ctx.newPage();
  page.__frames = framesMode;
  const t0 = Date.now();
  let nframes = 0;
  const now = framesMode ? () => nframes / 60 : () => (nowMs() - t0) / 1000;
  const shots = [];
  let firstShotAt = -1;
  let pumping = false;
  let pump = null;
  if (framesMode) {
    const fcdp = await ctx.newCDPSession(page);
    await fcdp.send('HeadlessExperimental.enable');
    await fcdp.send('Performance.enable');
    const ticks0 = (await fcdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'Timestamp').value * 1000;
    const FR = 1000 / 60;
    let lastShot = null;
    pumping = true;
    VCLOCK = () => nframes;
    pump = (async () => {
      while (pumping) {
        try {
          const r = await fcdp.send('HeadlessExperimental.beginFrame', { frameTimeTicks: ticks0 + nframes * FR, interval: FR, screenshot: { format: 'jpeg', quality: 90 } });
          if (r.screenshotData) lastShot = r.screenshotData; // a frame with nothing changed returns no image: it is the previous one
          if (lastShot) {
            if (firstShotAt < 0) firstShotAt = nframes;
            shots.push(lastShot);
          }
          nframes++;
        } catch {
          await new Promise((r) => setTimeout(r, 20));
        }
      }
    })();
  }
  const t = { now, studio: !!clip.studio, vertical: !!clip.vertical, cuts: [], start: 0, stopAt: null, score: 0, notes: [], cues: [], mark: () => (t.start = now()), stop: () => (t.stopAt = now()), note: (n) => t.notes.push(n), cue: (head, sub, dur) => t.cues.push({ at: now(), head, sub, dur }) };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const frames = [];
  let cdp = null;
  if (cdpMode) {
    mkdirSync(join(dir, 'f'), { recursive: true });
    cdp = await ctx.newCDPSession(page);
    // Frames are only buffered while the scene plays (no disk work competing with the game); written afterwards.
    cdp.on('Page.screencastFrame', (f) => {
      frames.push({ data: f.data, ts: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 82, maxWidth: vp.width, maxHeight: vp.height, everyNthFrame: 1 });
  }

  let failed = null;
  try {
    await clip.play(page, t);
  } catch (e) {
    failed = e;
  }
  const end = t.stopAt ?? now();
  let raw;
  let rebuild = null;
  let fps = 30;
  let offset = 0; // seconds between the director's clock and the first captured frame
  if (framesMode) {
    pumping = false;
    await pump;
    VCLOCK = null;
    await ctx.close();
    await fbrowser.close();
    if (shots.length < 10) throw new Error('frames mode produced no frames');
    mkdirSync(join(dir, 'f'), { recursive: true });
    shots.forEach((d, i) => writeFileSync(join(dir, 'f', `${String(i).padStart(6, '0')}.jpg`), Buffer.from(d, 'base64')));
    raw = join(dir, `${name}.mkv`);
    ffmpeg(['-framerate', '60', '-i', join(dir, 'f', '%06d.jpg'), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', raw]);
    t.notes.push(`frames mode: ${shots.length} frames, every one exactly 1/60 s of game time (no dropped or repeated frames)`);
    fps = 60;
    offset = firstShotAt / 60;
  } else if (cdpMode) {
    await cdp.send('Page.stopScreencast').catch(() => {});
    {
      const gaps = frames.slice(1).map((f, i) => (f.ts - frames[i].ts) * 1000);
      const raf = await page.evaluate(() => window.__vc.dt.slice(5)).catch(() => []);
      const q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] ?? 0;
      const stalls = gaps.map((x, i) => [x, (frames[i].ts - frames[0].ts - (t.start - (frames[0].ts - t0 / 1000)))]).filter(([x]) => x > 50).map(([x, at]) => `${at.toFixed(0)}s:${x.toFixed(0)}ms`);
      t.notes.push(`stalls over 50ms (clip time): ${stalls.join(' ') || 'none'}`);
      t.notes.push(`capture: ${frames.length} frames, gaps p50 ${q(gaps, 0.5).toFixed(1)} p95 ${q(gaps, 0.95).toFixed(1)} max ${Math.max(0, ...gaps).toFixed(0)} ms, ${gaps.filter((x) => x > 25).length} over 25ms; game rAF p50 ${q(raf, 0.5).toFixed(1)} p95 ${q(raf, 0.95).toFixed(1)} ms, ${raf.filter((x) => x > 25).length}/${raf.length} over 25ms`);
    }
    await ctx.close();
    if (frames.length < 10) throw new Error('screencast produced no frames');
    // Every frame must be exactly the viewport's size (an odd one out would stop the encoder): read each JPEG's size and drop strays.
    const jpegSize = (b) => {
      for (let i = 2; i < b.length - 9; ) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + b.readUInt16BE(i + 2);
      }
      return [0, 0];
    };
    const sized = frames.filter((f) => {
      const [w, h] = jpegSize(Buffer.from(f.data, 'base64'));
      return w === vp.width && h === vp.height;
    });
    if (sized.length !== frames.length) t.notes.push(`dropped ${frames.length - sized.length} frames of the wrong size`);
    frames.length = 0;
    frames.push(...sized);
    frames.forEach((f, i) => {
      f.file = join(dir, 'f', `${String(i).padStart(6, '0')}.jpg`);
      writeFileSync(f.file, Buffer.from(f.data, 'base64'));
      f.data = null;
    });
    // A constant 60 fps timeline: each frame is held until the next one arrives.
    // The game renders at an even 60 fps (its own frame timer shows it), but the capture's timestamps jitter a few
    // milliseconds, and laying frames out by those timestamps turns the jitter into repeated frames followed by a jump.
    // So frames go on an even 1/60 s grid, in order; only a real hole (a frame or more missing) gets extra time.
    const FRAME = 1 / 60;
    const holeMs = 28;
    const writeList = (arr) => {
      const list = arr.map((f) => `file '${f.file}'\nduration ${(f.dur ?? FRAME).toFixed(6)}`).join('\n') + `\nfile '${arr.at(-1).file}'\n`;
      writeFileSync(join(dir, 'list.txt'), list);
    };
    raw = join(dir, `${name}.mkv`);
    const build = () => ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-vf', 'fps=60', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', raw]);
    // The capture stream drops a handful of frames at a time now and then (a Chromium headless quirk; the game keeps
    // running at 60 fps through them). A plain constant-60 fps version is made now, so takes can be judged. The kept take
    // is rebuilt with ONLY those holes filled by motion interpolation (every other frame is untouched, so nothing else
    // can smear or jump): see record().
    const holeAt = frames.map((f, i) => (frames[i + 1] ? (frames[i + 1].ts - f.ts) * 1000 : 0)).map((ms, i) => (ms > holeMs && ms <= 100 ? i : -1)).filter((i) => i >= 0);
    const longHoles = frames.filter((f, i) => frames[i + 1] && frames[i + 1].ts - f.ts > 0.1).length;
    t.notes.push(`capture holes: ${holeAt.length} short (${holeMs}-100 ms, filled), ${longHoles} long (held)`);
    const base = t0 / 1000;
    const cutEnds = t.cuts.map(([, b]) => b);
    const inClip = frames.filter((f, i) => {
      if (!(frames[i + 1] && frames[i + 1].ts - f.ts > 0.1)) return false;
      const x = f.ts - base; // director clock
      if (x < t.start || x > (t.stopAt ?? Infinity)) return false;
      return !t.cuts.some(([a, b]) => x >= a - 1 && x <= b + 3.5); // the cleared banner and draft screen are static anyway
    }).length;
    t.notes.push(`long holes (over 100 ms) inside the clip: ${inClip}`);
    t.score -= holeAt.length * 0.2 + inClip * 8 + longHoles * 0.5; // between near-equal takes, prefer the smoother capture
    // The plain version (for judging takes): even frames, and a hole simply holds the frame before it.
    // (A hole over 100 ms is held: motion interpolation cannot span fast movement, and a wrong fill looks like a jump.)
    frames.forEach((f, i) => (f.dur = holeAt.includes(i) || (frames[i + 1] && frames[i + 1].ts - f.ts > 0.1 && frames[i + 1].ts - f.ts < 1) ? frames[i + 1].ts - f.ts : FRAME));
    writeList(frames);
    build();
    rebuild = holeAt.length && process.env.VIDEO_FILL !== '0'
      ? () => {
          const hd = join(dir, 'h');
          mkdirSync(hd, { recursive: true });
          const out = [];
          frames.forEach((f, i) => {
            if (!holeAt.includes(i)) {
              const gapS = frames[i + 1] ? frames[i + 1].ts - f.ts : 0;
              out.push({ ...f, dur: gapS > 0.1 && gapS < 1 ? gapS : FRAME });
              return;
            }
            out.push({ ...f, dur: FRAME });
            const gap = frames[i + 1].ts - f.ts;
            const n = Math.round(gap * 60) - 1; // the in-between frames a 60 fps timeline needs here
            const lst = join(hd, `${i}.txt`);
            writeFileSync(lst, `file '${f.file}'\nduration ${gap.toFixed(5)}\nfile '${frames[i + 1].file}'\nduration 0.01667\nfile '${frames[i + 1].file}'\n`);
            ffmpeg(['-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'minterpolate=fps=60:mi_mode=mci:mc_mode=obmc:me_mode=bidir:me=hexbs:vsbmc=0', '-q:v', '2', join(hd, `${i}-%03d.jpg`)]);
            for (let k = 1; k <= n; k++) {
              const file = join(hd, `${i}-${String(k + 1).padStart(3, '0')}.jpg`); // output 1 is the frame itself
              if (existsSync(file)) out.push({ file, ts: f.ts + k / 60, dur: FRAME });
            }
          });
          writeList(out);
          build();
        }
      : null;
    fps = 60;
    offset = frames[0].ts - t0 / 1000;
  } else {
    const video = page.video();
    await ctx.close();
    raw = join(dir, `${name}.webm`);
    renameSync(await video.path(), raw);
  }
  return { raw, t, end, failed, errors, take, fps, offset, rebuild };
}

/** Record `clip.takes` real runs (the game's waves are random) and keep the best-scoring one. */
async function record(browser, name, clip) {
  const takes = Number(process.env.VIDEO_TAKES ?? clip.takes ?? 1);
  let best = null;
  for (let i = 1; i <= takes; i++) {
    const r = await recordTake(browser, name, clip, i);
    const tag = r.failed ? `failed: ${r.failed.message}` : `score ${r.t.score}`;
    console.log(`  take ${i}/${takes}: ${tag}${r.t.notes.length ? ` (${r.t.notes.join('; ')})` : ''}`);
    if (r.errors.length) console.warn(`  page errors: ${r.errors.join(' | ')}`);
    if (!r.failed && (!best || r.t.score > best.t.score)) best = r;
  }
  if (!best) throw new Error(`${name}: every take failed`);
  console.log(`  keeping take ${best.take}`);
  if (best.rebuild) {
    console.log('  filling capture holes by motion interpolation (the slow step)...');
    best.rebuild();
  }
  return best;
}

// ---------------------------------------------------------------- encoding

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\u2019").replace(/%/g, '\\%');

/** drawtext chain for the cues, shifted onto the trimmed clock. y/size/offsets differ per layout. */
function captionFilters(cues, start, { headSize, subSize, yHead, ySub, boxPad }) {
  const out = [];
  for (const [i, c] of cues.entries()) {
    const a = Math.max(0, c.at - start);
    const next = cues[i + 1] ? Math.max(0, cues[i + 1].at - start) - 0.15 : Infinity;
    const b = Math.min(a + c.dur, next);
    const en = `enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'`;
    const fade = `alpha='min(1,(t-${a.toFixed(2)})/0.25)'`;
    const common = `fontfile='${FONT}':fontcolor=white:${en}:${fade}:x=(w-text_w)/2:shadowcolor=black@0.8:shadowx=0:shadowy=3`;
    out.push(`drawtext=text='${esc(c.head)}':fontsize=${headSize}:y=${yHead}:box=1:boxcolor=0x0a1620@0.72:boxborderw=${boxPad}:${common}`);
    for (const [li, line] of (c.sub ? c.sub.split('|') : []).entries()) {
      out.push(`drawtext=text='${esc(line)}':fontsize=${subSize}:y=${ySub}+${Math.round(li * subSize * 1.35)}:fontcolor=0x8fe3ff:${en}:${fade}:x=(w-text_w)/2:fontfile='${FONT}':shadowcolor=black@0.8:shadowx=0:shadowy=2`);
    }
  }
  return out;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed');
}

function encode(name, { raw, t, end, fps = 30, offset = 0 }) {
  const start = Math.max(0, t.start - (t.studio ? 0 : 0.1));
  t.cues = t.cues.filter((c) => c.at >= start); // nothing from before the clip starts
  const rawDur = Math.min(end - start + (t.studio ? 0.3 : 0.6), (t.maxSeconds ?? 25) + t.cuts.reduce((x, [a, b]) => x + (b - a), 0));
  // Cuts (seconds on the director's clock) are taken out of the video; later captions move up to match.
  const cuts = t.cuts.map(([a, b]) => [Math.max(a, start), Math.min(b, start + rawDur)]).filter(([a, b]) => b > a);
  const cutBefore = (x) => cuts.reduce((sum, [a, b]) => sum + Math.max(0, Math.min(x, b) - a), 0);
  const m = (x) => x - cutBefore(x);
  t.cues = t.cues.map((c) => ({ ...c, at: m(c.at), dur: Math.max(2.8, m(c.at + c.dur) - m(c.at)) })); // never on screen for less than 2.8 s
  const mStart = m(start);
  const dur = rawDur - cuts.reduce((x, [a, b]) => x + (b - a), 0);
  const tail = Math.max(0, dur - 0.6);
  const cutFilter = cuts.length ? [`select='not(${cuts.map(([a, b]) => `between(t,${(a - start).toFixed(3)},${(b - start).toFixed(3)})`).join('+')})'`, `setpts=N/(${fps}*TB)`] : [];
  // Silent AAC track: X's uploader and some players reject video with no audio stream.
  const silent = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart'];
  const fadeOut = `fade=t=out:st=${tail.toFixed(2)}:d=0.6`;
  const base = ['-ss', Math.max(0, start - offset).toFixed(3), '-t', rawDur.toFixed(2), '-i', raw];

  // 16:9
  const land = captionFilters(t.cues, mStart, { headSize: 40, subSize: 24, yHead: 'h*0.80', ySub: 'h*0.80+62', boxPad: 14 });
  if (!t.vertical) ffmpeg([...base, ...silent, '-vf', [`fps=${fps}`, ...cutFilter, ...land, fadeOut].join(','), ...enc, join(OUT, `${name}-16x9.mp4`)]);

  // 9:16: sharp game in the middle band over a blurred, zoomed copy of itself.
  const vert = captionFilters(t.cues, mStart, { headSize: 62, subSize: 38, yHead: 'h*0.17', ySub: 'h*0.17+112', boxPad: 22 });
  const graph = [
    `[0:v]${[`fps=${fps}`, ...cutFilter].join(',')},split=2[a][b]`,
    `[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4,eq=brightness=-0.12[bg]`,
    `[b]scale=1080:-2[fg]`,
    `[bg][fg]overlay=0:(H-h)/2[v0]`,
    `[v0]${[...vert, fadeOut].join(',')}[v]`,
  ].join(';');
  const timeline = t.cues.map((c, i) => {
    const a = Math.max(0, c.at - mStart);
    const next = t.cues[i + 1] ? Math.max(0, t.cues[i + 1].at - mStart) - 0.15 : Infinity;
    return { from: +a.toFixed(1), to: +Math.min(a + c.dur, next, dur).toFixed(1), headline: c.head, sub: c.sub ?? null };
  });
  writeFileSync(join(OUT, `${name}.captions.json`), JSON.stringify({ seconds: +dur.toFixed(1), studio: !!t.studio, notes: t.notes, captions: timeline }, null, 2));
  ffmpeg([...base, ...silent, '-filter_complex', graph, '-map', '[v]', '-map', '1:a', ...enc, join(OUT, `${name}-9x16.mp4`)]);
  return dur;
}

// -------------------------------------------------------------------- main

const args = process.argv.slice(2);
if (args.includes('--list')) {
  for (const [k, v] of Object.entries(CLIPS)) console.log(`${k.padEnd(10)} ${v.title}`);
  process.exit(0);
}
if (!FONT) throw new Error('no usable font found for captions');
const wanted = args.filter((a) => !a.startsWith('-'));
const names = wanted.length ? wanted : Object.keys(CLIPS);
for (const n of names) if (!CLIPS[n]) throw new Error(`unknown clip "${n}" (try --list)`);

mkdirSync(OUT, { recursive: true });
const server = await serve();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
try {
  for (const name of names) {
    console.log(`recording ${name}...`);
    const rec = await record(browser, name, CLIPS[name]);
    const dur = encode(name, rec);
    console.log(`  -> ${CLIPS[name].vertical ? '' : name + '-16x9.mp4, '}${name}-9x16.mp4 (${dur.toFixed(1)}s)`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(names.map((n) => ({ name: n, title: CLIPS[n].title, files: [`${n}-16x9.mp4`, `${n}-9x16.mp4`] })), null, 2));
} finally {
  await browser.close();
  server.kill();
  rmSync(WORK, { recursive: true, force: true });
}
