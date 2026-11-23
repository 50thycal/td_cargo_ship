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

const g = (page, fn, arg) => page.evaluate(fn, arg);
const w2c = (page, x, y) => page.evaluate(([x, y]) => window.__v3.toClient(x, y), [x, y]);

/** Tap threats that have no interceptor on them yet (real clicks), nearest the carrier first. */
async function defend(page, max = 2) {
  const pts = await g(page, (max) => {
    const gm = window.__v3.game();
    if (!gm || gm.phase !== 'wave') return [];
    return gm.threats
      .filter((t) => !gm.interceptors.some((i) => i.target === t.id))
      .sort((a, b) => b.y - a.y)
      .slice(0, max)
      .map((t) => window.__v3.toClient(t.x, t.y));
  }, max);
  for (const p of pts) await page.mouse.click(p.x, p.y);
}

/** Tap any pickup lying on the water. */
async function grab(page) {
  const pts = await g(page, () => {
    const gm = window.__v3.game();
    return gm && gm.phase === 'wave' ? gm.pickups.map((p) => window.__v3.toClient(p.x, p.y)) : [];
  });
  for (const p of pts) await page.mouse.click(p.x, p.y);
  return pts.length;
}

/** Hold these weapons and drop one as a pickup at (x,y), as a kill would. */
async function dropWeapon(page, id, x, y) {
  await g(page, ([id, x, y]) => {
    const gm = window.__v3.game();
    gm.levels = { ...gm.levels, [id]: Math.max(gm.levels?.[id] ?? 0, 2) };
    if (!gm.slots.includes(id) && gm.slots.length < 3) gm.slots.push(id);
    gm.weapon = null;
    gm.pickups.push({ id: 90000 + Math.floor(Math.random() * 9999), kind: 'weapon', weapon: id, x, y, age: 0 });
  }, [id, x, y]);
}

/** Fire the loaded weapon at the most dangerous threat (or open water). */
async function fireAtThreat(page, aimAtThreat = true) {
  const p = await g(page, (aim) => {
    const gm = window.__v3.game();
    if (!gm || gm.phase !== 'wave') return null;
    const t = aim ? [...gm.threats].sort((a, b) => b.y - a.y)[0] : null;
    return t ? window.__v3.toClient(t.x, t.y) : window.__v3.toClient(700, 260);
  }, aimAtThreat);
  if (p) await page.mouse.click(p.x, p.y);
}

/** Bring in a pack of enemies now (the game's own test hook), spread over the launch bases. */
async function swarm(page, kind, n = 6) {
  await g(page, ([kind, n]) => {
    const bases = window.__v3.game().map.bases.length;
    for (let i = 0; i < n; i++) window.__v3.foe(kind, i % bases);
  }, [kind, n]);
}

async function startRun(page, map = 'strait') {
  await page.goto(`http://localhost:${PORT}/v3.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('straitwatch.v3.run'));
  await page.waitForSelector('[data-screen="menu"]');
}

/** Run `fn` every `every` ms until `ms` have passed. */
async function loop(ms, every, fn) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await fn();
    await sleep(every);
  }
}

// ------------------------------------------------------------------- clips
// `cues` are [startSecond, endSecond, text] on the FINAL clip's clock, filled
// in by the scenario through cue(); the scenario also marks `t.start`, the
// second of the recording where the clip should begin (menu dead-air is cut).

const CLIPS = {
  // Menu -> pick a map -> a wave: the 20-second "what is this game" clip.
  convoy: {
    title: 'Defend the convoy',
    async play(page, t) {
      await startRun(page);
      t.mark();
      await sleep(800);
      t.cue('STRAITWATCH', 'Cargo convoy defence', 2.4);
      await sleep(1200);
      await page.click('[data-map="strait"]');
      await page.waitForSelector('[data-screen="loadout"]');
      await sleep(900);
      await page.click('[data-start]');
      await page.waitForSelector('.playing');
      t.cue('Missiles inbound', 'Tap a threat to launch an interceptor', 5);
      await loop(9000, 140, () => defend(page, 2));
      t.cue('Keep the convoy alive', null, 4.5);
      await loop(9000, 140, async () => {
        await defend(page, 2);
        await grab(page);
      });
    },
  },

  // A kill-drop weapon: tap the pickup, then the railgun beam rips through everything.
  railgun: {
    title: 'Railgun',
    async play(page, t) {
      await startRun(page);
      await page.click('[data-map="strait"]');
      await page.waitForSelector('[data-screen="loadout"]');
      await page.click('[data-start]');
      await page.waitForSelector('.playing');
      await loop(6000, 140, () => defend(page, 2));
      t.mark();
      await page.mouse.move(640, 360);
      t.cue('Enemy weapons drop as pickups', 'Tap to grab', 3.2);
      await dropWeapon(page, 'railgun', 760, 330);
      await sleep(900);
      const p = await w2c(page, 760, 330);
      await page.mouse.click(p.x, p.y);
      t.cue('RAILGUN loaded', 'Every tap is a beam', 3.2);
      await swarm(page, 'drone', 9);
      await sleep(1800);
      await swarm(page, 'guided', 3);
      // Rack: every round now fires the railgun for 15 s.
      await loop(9500, 520, () => fireAtThreat(page));
      t.cue('One beam. Whole formation.', null, 3);
      await loop(2500, 140, () => defend(page, 2));
    },
  },

  // Three weapons back to back: the satisfying-kills montage.
  arsenal: {
    title: 'Arsenal',
    async play(page, t) {
      await startRun(page);
      await page.click('[data-map="strait"]');
      await page.waitForSelector('[data-screen="loadout"]');
      await page.click('[data-start]');
      await page.waitForSelector('.playing');
      await loop(5000, 140, () => defend(page, 2));
      t.mark();
      const kit = [
        ['airstrike', 'AIR STRIKE', 'Call in a jet'],
        ['thermo', 'THERMOBARIC', 'Level whatever is under it'],
        ['well', 'GRAVITY WELL', 'Pull the swarm together'],
      ];
      for (const [id, name, sub] of kit) {
        await dropWeapon(page, id, 700, 300);
        await sleep(500);
        const p = await w2c(page, 700, 300);
        await page.mouse.click(p.x, p.y);
        t.cue(name, sub, 3.6);
        await swarm(page, 'drone', 7);
        await loop(1400, 140, () => defend(page, 1));
        await fireAtThreat(page);
        await loop(2000, 140, () => defend(page, 1));
        await fireAtThreat(page);
        await sleep(300);
      }
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

async function record(browser, name, clip) {
  const dir = join(WORK, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const now = () => (Date.now() - t0) / 1000;
  const t = { start: 0, cues: [], mark: () => (t.start = now()), cue: (head, sub, dur) => t.cues.push({ at: now(), head, sub, dur }) };
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await clip.play(page, t);
  const end = now();
  const video = page.video();
  await ctx.close();
  const raw = join(dir, `${name}.webm`);
  renameSync(await video.path(), raw);
  if (errors.length) console.warn(`  page errors: ${errors.join(' | ')}`);
  return { raw, t, end };
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

function encode(name, { raw, t, end }) {
  const start = Math.max(0, t.start - 0.1);
  const dur = Math.min(end - start, 120);
  const tail = Math.max(0, dur - 0.6);
  // Silent AAC track: X's uploader and some players reject video with no audio stream.
  const silent = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
  const enc = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '30', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart'];
  const fadeOut = `fade=t=out:st=${tail.toFixed(2)}:d=0.6`;
  const base = ['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', raw];

  // 16:9
  const land = captionFilters(t.cues, start, { headSize: 40, subSize: 24, yHead: 'h*0.80', ySub: 'h*0.80+62', boxPad: 14 });
  ffmpeg([...base, ...silent, '-vf', ['fps=30', ...land, fadeOut].join(','), ...enc, join(OUT, `${name}-16x9.mp4`)]);

  // 9:16: sharp game in the middle band over a blurred, zoomed copy of itself.
  const vert = captionFilters(t.cues, start, { headSize: 54, subSize: 34, yHead: 'h*0.18', ySub: 'h*0.18+100', boxPad: 20 });
  const graph = [
    `[0:v]fps=30,split=2[a][b]`,
    `[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=28:4,eq=brightness=-0.12[bg]`,
    `[b]scale=1080:-2[fg]`,
    `[bg][fg]overlay=0:(H-h)/2[v0]`,
    `[v0]${[...vert, fadeOut].join(',')}[v]`,
  ].join(';');
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
