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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Tap up to `max` threats with the normal gun. */
async function defend(page, max = 2) {
  for (const p of (await openThreats(page)).slice(0, max)) await page.mouse.click(p.x, p.y);
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
  await page.addInitScript(() => {
    const seen = new Set();
    let prev = new Set();
    window.__vc = { kills: 0, seen: 0 };
    const tick = () => {
      const gm = window.__v3?.game?.();
      if (gm) {
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
  });
}
const kills = (page) => page.evaluate(() => ({ ...window.__vc }));

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

const sinceS = (t0) => (Date.now() - t0) / 1000;

/** Play the normal gun until `until()` says stop, with a hard timeout. */
async function playUntil(page, until, { limit = 45, tapEvery = 140 } = {}) {
  const t0 = Date.now();
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
    if (weapon === 'railgun') {
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
  await page.mouse.click(aim.x, aim.y);
  return aim.n;
}

// ------------------------------------------------------------------- clips
// `t` is the director: t.mark() = where the clip starts (all before is cut),
// t.cue(head, sub, secs) = a caption from now, t.stop() = where it ends.
// Captions fire when the game event happens, so they always match the frame.

const CLIPS = {
  // Menu -> Free Play wave 3 -> real intercepts with the normal gun.
  convoy: {
    title: 'Defend the convoy',
    takes: 4,
    capture: 'cdp',
    async play(page, t) {
      await startFreePlay(page, { wave: 7, weapons: [], frequentDrops: false });
      t.start = t.now();
      t.cue('Straitwatch', 'my convoy-defense prototype', 2.6);
      const k0 = (await kills(page)).kills;
      let cued = 0;
      await playUntil(page, async (sec) => {
        if (sec > 2.8 && cued < 1) {
          cued = 1;
          t.cue('Tap a missile to intercept it', 'drones, ballistic, guided', 4.5);
        }
        if (sec > 8 && cued < 2) {
          cued = 2;
          t.cue('Goal: get the cargo ships across', null, 5);
        }
        return sec > 18 || (await state(page))?.phase !== 'wave';
      });
      const k = (await kills(page)).kills - k0;
      t.score = k;
      t.note(`${k} threats shot down`);
      t.stop();
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
      for (let attempt = 0; attempt < 8 && !pk; attempt++) {
        await playUntil(page, async () => t.now() - tPlay > 5 && !!(await weaponPickup(page)), { limit: 40 });
        tCue = t.now();
        t.cue('Weapons drop as pickups', 'tap one to grab it', 1.4);
        const c0 = Date.now();
        await playUntil(page, async () => sinceS(c0) > 1.2, { limit: 6 });
        pk = await weaponPickup(page);
        // Only worth loading with a burst already out on the water; otherwise let it go and wait for the next drop.
        if (!pk || (await fieldThreats(page)) < 2) {
          t.cues.pop(); // this attempt's caption: not used
          pk = null;
        }
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
      const l0 = Date.now();
      let lastBeam = Date.now();
      let worstGap = 0;
      while (sinceS(l0) < 17) {
        const s = await state(page);
        if (!s || s.weapon !== 'railgun') break;
        worstGap = Math.max(worstGap, sinceS(lastBeam));
        const n = s.ammo > 0 ? await fireAt(page, 'railgun', sinceS(lastBeam) > 1.5 ? 1 : 2) : 0;
        if (n) {
          shots++;
          hits += n;
          lastBeam = Date.now();
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
      let lastLoad = Date.now() - 2000;
      let shots = 0;
      let hits = 0;
      let lastShot = 0;
      const m0 = Date.now();
      // Normal gun, and whichever of the three weapons the game drops next. Load each on a real
      // threat count, then fire only where it will hit. Different weapons only.
      while (seen.length < 3 && sinceS(m0) < 70 && (tFirst === null || t.now() - tFirst < 17.5)) {
        const s = await state(page);
        if (s?.phase !== 'wave') break;
        const field = await fieldThreats(page);
        if (s?.weapon) {
          const n = s.ammo > 0 && Date.now() - lastShot > 1000 ? await fireAt(page, s.weapon, s.weapon === 'airstrike' ? 1 : 2) : 0;
          if (n) {
            lastShot = Date.now();
            shots++;
            hits += n;
          }
        } else {
          await defend(page, 2);
        }
        await grabSupplies(page);
        const pk = Date.now() - lastLoad > 3600 && field >= 2 && t.now() - tPlay > 5 ? await weaponPickup(page) : null;
        if (pk && !seen.includes(pk.weapon)) {
          await page.mouse.click(pk.x, pk.y);
          await sleep(120);
          const w = (await state(page))?.weapon;
          if (w) {
            seen.push(w);
            if (tFirst === null) tFirst = t.now();
            lastLoad = Date.now();
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
  const cdpMode = (process.env.VIDEO_CAPTURE ?? clip.capture) === 'cdp';
  const dir = join(WORK, `${name}-${take}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, ...(cdpMode ? {} : { recordVideo: { dir, size: { width: W, height: H } } }) });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const t = { now, start: 0, stopAt: null, score: 0, notes: [], cues: [], mark: () => (t.start = now()), stop: () => (t.stopAt = now()), note: (n) => t.notes.push(n), cue: (head, sub, dur) => t.cues.push({ at: now(), head, sub, dur }) };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const frames = [];
  let cdp = null;
  if (cdpMode) {
    mkdirSync(join(dir, 'f'), { recursive: true });
    cdp = await ctx.newCDPSession(page);
    cdp.on('Page.screencastFrame', (f) => {
      const file = join(dir, 'f', `${String(frames.length).padStart(6, '0')}.jpg`);
      writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, ts: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  }

  let failed = null;
  try {
    await clip.play(page, t);
  } catch (e) {
    failed = e;
  }
  const end = t.stopAt ?? now();
  let raw;
  let fps = 30;
  let offset = 0; // seconds between the director's clock and the first captured frame
  if (cdpMode) {
    await cdp.send('Page.stopScreencast').catch(() => {});
    await ctx.close();
    if (frames.length < 10) throw new Error('screencast produced no frames');
    // A constant 60 fps timeline: each frame is held until the next one arrives.
    const list = frames.map((f, i) => `file '${f.file}'\nduration ${(((frames[i + 1]?.ts ?? f.ts + 1 / 60) - f.ts) || 1 / 60).toFixed(5)}`).join('\n') + `\nfile '${frames.at(-1).file}'\n`;
    writeFileSync(join(dir, 'list.txt'), list);
    raw = join(dir, `${name}.mkv`);
    ffmpeg(['-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'), '-vf', 'fps=60', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', '-pix_fmt', 'yuv420p', raw]);
    rmSync(join(dir, 'f'), { recursive: true, force: true });
    fps = 60;
    offset = frames[0].ts - t0 / 1000;
  } else {
    const video = page.video();
    await ctx.close();
    raw = join(dir, `${name}.webm`);
    renameSync(await video.path(), raw);
  }
  return { raw, t, end, failed, errors, take, fps, offset };
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
    if (c.sub) out.push(`drawtext=text='${esc(c.sub)}':fontsize=${subSize}:y=${ySub}:fontcolor=0x8fe3ff:${en}:${fade}:x=(w-text_w)/2:fontfile='${FONT}':shadowcolor=black@0.8:shadowx=0:shadowy=2`);
  }
  return out;
}

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  if (r.status) throw new Error('ffmpeg failed');
}

function encode(name, { raw, t, end, fps = 30, offset = 0 }) {
  const start = Math.max(0, t.start - 0.1);
  t.cues = t.cues.filter((c) => c.at >= start); // nothing from before the clip starts
  const dur = Math.min(end - start + 0.6, 25);
  const tail = Math.max(0, dur - 0.6);
  // Silent AAC track: X's uploader and some players reject video with no audio stream.
  const silent = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart'];
  const fadeOut = `fade=t=out:st=${tail.toFixed(2)}:d=0.6`;
  const base = ['-ss', Math.max(0, start - offset).toFixed(3), '-t', dur.toFixed(2), '-i', raw];

  // 16:9
  const land = captionFilters(t.cues, start, { headSize: 40, subSize: 24, yHead: 'h*0.80', ySub: 'h*0.80+62', boxPad: 14 });
  ffmpeg([...base, ...silent, '-vf', [`fps=${fps}`, ...land, fadeOut].join(','), ...enc, join(OUT, `${name}-16x9.mp4`)]);

  // 9:16: sharp game in the middle band over a blurred, zoomed copy of itself.
  const vert = captionFilters(t.cues, start, { headSize: 54, subSize: 34, yHead: 'h*0.18', ySub: 'h*0.18+100', boxPad: 20 });
  const graph = [
    `[0:v]fps=${fps},split=2[a][b]`,
    `[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4,eq=brightness=-0.12[bg]`,
    `[b]scale=1080:-2[fg]`,
    `[bg][fg]overlay=0:(H-h)/2[v0]`,
    `[v0]${[...vert, fadeOut].join(',')}[v]`,
  ].join(';');
  const timeline = t.cues.map((c, i) => {
    const a = Math.max(0, c.at - start);
    const next = t.cues[i + 1] ? Math.max(0, t.cues[i + 1].at - start) - 0.15 : Infinity;
    return { from: +a.toFixed(1), to: +Math.min(a + c.dur, next, dur).toFixed(1), headline: c.head, sub: c.sub ?? null };
  });
  writeFileSync(join(OUT, `${name}.captions.json`), JSON.stringify({ seconds: +dur.toFixed(1), notes: t.notes, captions: timeline }, null, 2));
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
    console.log(`  -> ${name}-16x9.mp4, ${name}-9x16.mp4 (${dur.toFixed(1)}s)`);
  }
  writeFileSync(join(OUT, 'index.json'), JSON.stringify(names.map((n) => ({ name: n, title: CLIPS[n].title, files: [`${n}-16x9.mp4`, `${n}-9x16.mp4`] })), null, 2));
} finally {
  await browser.close();
  server.kill();
  rmSync(WORK, { recursive: true, force: true });
}
