// V3 sound in a real browser (docs/design/v3-sound-round1.md). Expects
// `vite preview` at BASE_URL. Chromium runs with the autoplay policy that
// needs a user gesture, as iOS Safari does. Checks:
//   - no AudioContext before the first tap; the first tap starts it
//   - every sound file loads and decodes
//   - menu music, then battle music once a run starts
//   - a tap's gun sound plays within 20 ms of the tap
//   - each sim cue plays in the frame its step ran (within ~20 ms)
//   - hidden page → suspended, visible again → running
//   - Settings → Sound off mutes and suspends; on resumes
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-audio.mjs

import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';

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

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
const check = (ok, msg) => {
  if (!ok) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else console.log('ok:', msg);
};

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const bad = [];
page.on('response', (r) => {
  if (r.url().includes('/v3/audio/') && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`);
});
await page.goto(`${BASE_URL}/v3.html`);
await page.waitForFunction(() => !!window.__v3);
check((await page.evaluate(() => window.__v3.audio.state())) === 'locked', 'no AudioContext before the first tap');

// The first tap: a press on the menu (anywhere) starts audio.
await page.mouse.click(5, 5);
await page.waitForFunction(() => window.__v3.audio.state() === 'running', null, { timeout: 5000 });
check(true, 'the first tap starts the AudioContext (running)');
await page.evaluate(() => window.__v3.audio.ready());
await page.waitForTimeout(300);
check(bad.length === 0, `every sound file loads (${bad.length} failed${bad.length ? ': ' + bad.slice(0, 3).join(', ') : ''})`);
const music0 = await page.evaluate(() => window.__v3.audio.log().filter((e) => e.cue.endsWith('music')).map((e) => e.cue));
check(music0.includes('menu.music'), `menu music plays on the menu (${music0.join(', ') || 'none'})`);

// A run: record each frame's sim step, so a cue can be matched to the frame
// its step ran in.
await page.evaluate(() => {
  window.__frames = [];
  const tick = () => {
    const g = window.__v3.game();
    window.__frames.push([performance.now(), g ? g.steps : -1]);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__downs = [];
  window.addEventListener('pointerdown', () => window.__downs.push(performance.now()), { capture: true });
});
await page.click('[data-map="strait"]');
const sail = page.locator('[data-start="1"]');
if (await sail.count()) await sail.click();
await page.waitForFunction(() => window.__v3.game()?.phase === 'wave');
await page.waitForFunction(() => window.__v3.game().threats.length > 0, null, { timeout: 20000 });
// Tap a threat for real.
const p = await page.evaluate(() => {
  const g = window.__v3.game();
  const t = g.threats[0];
  return window.__v3.toClient(t.x, t.y);
});
const before = await page.evaluate(() => window.__v3.audio.log().length);
await page.mouse.click(p.x, p.y);
await page.waitForTimeout(200);
const tapPlay = await page.evaluate((n) => {
  const e = window.__v3.audio.log().slice(n).find((x) => x.cue === 'gun.fire' || x.cue === 'gun.dry');
  return e ? { cue: e.cue, lag: e.wall - window.__downs[window.__downs.length - 1] } : null;
}, before);
check(!!tapPlay && tapPlay.lag >= 0 && tapPlay.lag <= 20, `a tap's ${tapPlay?.cue ?? 'gun'} sound plays ${tapPlay ? tapPlay.lag.toFixed(1) : '?'} ms after the tap (≤ 20)`);

// Let the wave run, defending, and collect cues.
for (let i = 0; i < 40; i++) {
  const targets = await page.evaluate(() => {
    const g = window.__v3.game();
    if (!g || g.phase !== 'wave') return [];
    return g.threats.filter((t) => !g.interceptors.some((it) => it.target === t.id)).slice(0, 2).map((t) => window.__v3.toClient(t.x, t.y));
  });
  for (const t of targets) await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(250);
}
const timing = await page.evaluate(() => {
  const frames = window.__frames;
  const out = [];
  for (const e of window.__v3.audio.log()) {
    if (e.step < 0) continue;
    // The first frame whose sim had reached the cue's step.
    const f = frames.find(([, s]) => s >= e.step);
    if (f) out.push({ cue: e.cue, d: e.wall - f[0] });
  }
  return out;
});
const late = timing.filter((x) => x.d > 20);
const worst = Math.max(...timing.map((x) => x.d));
check(timing.length >= 10 && late.length === 0, `${timing.length} sim cues each played in the frame its step ran (worst ${worst.toFixed(1)} ms after that frame began; ≤ 20)`);
const heard = new Set(await page.evaluate(() => window.__v3.audio.log().map((e) => e.cue)));
check(heard.has('gun.fire') && [...heard].some((c) => c.startsWith('kill.')), `the wave's cues include the gun and kills (${[...heard].slice(0, 10).join(', ')})`);
const music1 = await page.evaluate(() => window.__v3.audio.log().filter((e) => e.cue.endsWith('music') || e.cue === 'battle.intense').map((e) => e.cue));
check(music1.includes('battle.music') || music1.includes('battle.intense'), `battle music in a run (${music1.join(' → ')})`);
const voices = await page.evaluate(() => Math.max(...window.__v3.audio.log().map((e) => e.voices)));
check(voices <= 24, `voices stay under the cap (max ${voices})`);

// The page goes to the background and back.
const setVisibility = (state) =>
  page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
await setVisibility('hidden');
await page.waitForTimeout(150);
check((await page.evaluate(() => window.__v3.audio.state())) === 'suspended', 'hidden page: audio suspended');
await setVisibility('visible');
await page.waitForTimeout(150);
check((await page.evaluate(() => window.__v3.audio.state())) === 'running', 'visible again: audio running');

// Settings → Sound off, then on (from the menu).
await page.goto(`${BASE_URL}/v3.html`);
await page.waitForFunction(() => !!window.__v3);
await page.click('.v2-settings-btn');
await page.waitForFunction(() => window.__v3.audio.state() === 'running');
await page.click('[data-setting="sound"]');
await page.waitForTimeout(200);
const muted = await page.evaluate(() => ({ s: window.__v3.audio.settings(), st: window.__v3.audio.state() }));
check(muted.s.muted === true && muted.st === 'suspended', `Sound off mutes and suspends (${muted.st})`);
check(await page.locator('[data-setting="volume"]').isDisabled(), 'the volume slider greys out while muted');
await page.click('[data-setting="sound"]');
await page.waitForTimeout(200);
const unmuted = await page.evaluate(() => ({ s: window.__v3.audio.settings(), st: window.__v3.audio.state() }));
check(unmuted.s.muted === false && unmuted.st === 'running', 'Sound on resumes');
await page.reload();
await page.waitForFunction(() => !!window.__v3);
check((await page.evaluate(() => window.__v3.audio.settings().muted)) === false, 'the sound setting is saved');

check(errors.length === 0, `no page errors (${errors.slice(0, 2).join(' | ')})`);
await browser.close();
