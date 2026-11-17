// Resume a run in progress (docs/design/v3-resume-run.md). The player: "Do
// we have a way to save when you leave mid game, so I can come back and
// finish it?" Plays a few waves of a campaign run, goes to the background
// (as an iPhone does), reloads the page (iOS closing the app), taps Continue
// and checks the run is back paused at the same wave, score and step, its
// log still one run (the same id, and the later upload replaces the one the
// background sealed), then finishes the wave. Then the pause menu's Quit
// (Save and quit, Abandon run), starting a new run over a saved one, a save
// from an older version, a replay that no longer matches, a Test Lab map
// card continued from the hub (Done, Note and Setup on its pause menu;
// Setup → Apply restarts and clears the save), Free Play, and the replay
// time of a long run in this browser.
//
// Usage:  npx vite build && npx vite preview --port 4173 &
//         BASE_URL=http://localhost:4173 DOC_DIR=docs/design/img/resume node e2e/v3-resume.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const DOC_DIR = process.env.DOC_DIR ?? 'docs/design/img/resume';
const LONG_LOG = process.env.LONG_LOG ?? '';
mkdirSync(DOC_DIR, { recursive: true });
// The Vercel build's host, served from BASE_URL, so the log uploads can be
// watched (the playlog API stores a log by its id: a later upload replaces it).
const HOST = 'https://straitwatch-resume-e2e.vercel.app';

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
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const shot = (page, name) => page.screenshot({ path: `${DOC_DIR}/${name}.jpg`, type: 'jpeg', quality: 82 });
const SAVE = { unlocked: 3, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: 2, open: [], mapsV: 2 };
const SEEN = { v: 1, ids: ['tip:basics', 'tip:ships', 'tip:formations'] };

/** A fresh device with the first maps open and the first-run tips seen. */
async function fresh(page, url = `${HOST}/v3.html`) {
  await page.goto(url);
  await page.evaluate(([save, seen]) => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify(save));
    localStorage.setItem('straitwatch.v3.seen', JSON.stringify(seen));
  }, [SAVE, SEEN]);
  await page.reload();
  await page.waitForSelector('[data-screen="menu"]');
}

/** Tap the live threats nobody is shooting at yet: real input, logged. */
async function defend(page) {
  const targets = await page.evaluate(() => {
    const g = window.__v3.game();
    if (!g || g.phase !== 'wave') return [];
    return g.threats.filter((t) => !t.dead && !g.interceptors.some((i) => i.target === t.id)).slice(0, 3).map((t) => window.__v3.toClient(t.x, t.y));
  });
  for (const p of targets) await page.mouse.click(p.x, p.y);
}

/** Play on: run the sim a second at a time, defending between (every input
 *  through the game's own taps, so the log replays it); pick the first
 *  card in a draft. Until `until` holds. */
async function playUntil(page, until, maxSeconds = 400) {
  for (let i = 0; i < maxSeconds; i++) {
    const st = await page.evaluate(() => ({ phase: window.__v3.game()?.phase, wave: window.__v3.game()?.wave, waveT: window.__v3.game()?.waveT, screen: document.querySelector('.v2-overlay.open')?.dataset.screen ?? null }));
    if (await until(st)) return st;
    if (st.phase === 'lost' || st.phase === 'won') return st;
    if (st.phase === 'draft') {
      const card = page.locator('.v2-draft[data-armed] .v2-card:not([disabled])').first();
      if (await card.count()) {
        await card.click();
        await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 5000 }).catch(() => null);
      } else await page.waitForTimeout(150);
      continue;
    }
    await defend(page);
    await page.evaluate(() => window.__v3.advance(1));
    await page.waitForTimeout(20);
  }
  return null;
}

const gameNow = (page) => page.evaluate(() => { const g = window.__v3.game(); return g ? { wave: g.wave, score: g.score, steps: g.steps, phase: g.phase, lost: g.lost, map: g.map.id } : null; });
const savedRun = (page) => page.evaluate(() => window.__v3.savedRun());

/** The app goes to the background (no pagehide: an iPhone swiped away). */
const hide = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

try {
  const ctx = await browser.newContext(PHONE);
  const posts = [];
  await ctx.route(`${HOST}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/api/playlog') {
      if (req.method() === 'POST') {
        const j = JSON.parse(req.postData() ?? '{}');
        posts.push({ id: j.id, end: j.end ?? null, left: !!j.left, steps: j.summary?.steps ?? 0, resumes: j.resumes?.length ?? 0, commands: j.commands?.length ?? 0 });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    }
    const r = await fetch(`${BASE_URL}${url.pathname}${url.search}`);
    return route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
    fail(`page error: ${err.message}`);
  });

  // ---- A campaign run, a few waves in ----
  await fresh(page);
  check(!(await page.$('[data-continue]')), 'no saved run: the menu has no Continue');
  await page.locator('[data-map="kesh"]').tap();
  await page.locator('[data-start]').tap();
  await page.waitForSelector('.playing');
  const reached = await playUntil(page, (s) => s.phase === 'wave' && s.wave === 3 && s.waveT > 12);
  check(reached?.wave === 3 && reached.phase === 'wave', `played into wave 3 (${JSON.stringify(reached)})`);
  const id = await page.evaluate(() => window.__v3.log().id);

  // ---- The background: paused, and kept ----
  await hide(page);
  await page.waitForTimeout(400);
  // Read where the game stopped once it is paused: the live loop can run a
  // step between a read made before the background and the save itself.
  const before = await gameNow(page);
  const kept = await savedRun(page);
  const paused = await page.evaluate(() => document.querySelector('.v2-pause').textContent === '▶' && !!document.querySelector('.v2-pause-panel'));
  check(paused, 'going to the background pauses the wave');
  check(kept?.log.id === id && kept.step === before.steps && kept.wave === 3 && kept.phase === 'wave' && kept.kind === 'campaign', `the run is kept at its step (${JSON.stringify(kept && { id: kept.log.id, step: kept.step, wave: kept.wave, phase: kept.phase })} vs ${before.steps})`);
  await page.waitForTimeout(800);
  const leftPost = posts.find((p) => p.id === id && p.left);
  check(!!leftPost && leftPost.end === 'quit', `the background still seals the log as left (${JSON.stringify(leftPost)})`);

  // ---- iOS closes the app; it opens on the menu with Continue ----
  await page.reload();
  await page.waitForSelector('[data-screen="menu"] [data-continue]');
  const entry = await page.evaluate(() => document.querySelector('[data-continue]').innerText.replace(/\s+/g, ' '));
  check(/The Kesh Hook/.test(entry) && /Wave 3/.test(entry) && /(just now|min ago)/.test(entry), `the menu offers Continue: map, wave, time ago (${entry})`);
  const fits = await page.evaluate(() => {
    const r = document.querySelector('[data-continue]').getBoundingClientRect();
    const tabs = document.querySelector('.v3-chapter-tabs').getBoundingClientRect();
    return r.top >= 0 && r.bottom <= tabs.top + 1 && r.right <= innerWidth && r.height >= 44 && document.documentElement.scrollWidth <= innerWidth;
  });
  check(fits, 'Continue sits beside the title, above the chapter tabs, on a phone (and is a full-size target)');
  await shot(page, '01-menu-continue');

  // ---- Continue: Restoring…, then the run paused ----
  // Every screen the overlay shows from here, in order.
  await page.evaluate(() => {
    window.__screens = [];
    const o = document.querySelector('.v2-overlay');
    new MutationObserver(() => window.__screens.push(o.dataset.screen)).observe(o, { attributes: true, childList: true });
  });
  // (Held part way for its picture: on a desktop the replay of a few waves
  // is over in a blink.)
  await page.evaluate(() => window.__v3.restoreHold(0.45));
  await page.locator('[data-continue]').tap();
  await page.waitForFunction(() => parseFloat(document.querySelector('[data-screen="restore"] .v3-restore-track i')?.style.width || '0') > 40, null, { timeout: 15000 });
  const restoringText = await page.evaluate(() => document.querySelector('[data-screen="restore"]').innerText.replace(/\s+/g, ' '));
  await shot(page, '02-restoring');
  await page.evaluate(() => window.__v3.restoreHold(null));
  await page.waitForSelector('.v2-pause-panel .v3-restored', { timeout: 15000 });
  const screens = await page.evaluate(() => [...new Set(window.__screens)]);
  check(screens[0] === 'restore' && screens.includes('pause-panel') && !screens.includes('draft'), `Continue goes through "Restoring…" to the pause menu (${screens.join(' → ')})`);
  const after = await gameNow(page);
  check(after.wave === before.wave && after.score === before.score && after.steps === before.steps && after.lost === before.lost && after.phase === 'wave', `the run is back at the same wave, score and step (${JSON.stringify(after)} vs ${JSON.stringify(before)})`);
  const pausedNow = await page.evaluate(() => ({ btn: document.querySelector('.v2-pause').textContent, line: document.querySelector('.v3-restored')?.textContent, quit: [...document.querySelectorAll('.v2-pause-panel .v2-btn')].map((b) => b.textContent) }));
  check(pausedNow.btn === '▶' && /Run restored · wave 3/.test(pausedNow.line ?? '') && pausedNow.quit.includes('Resume') && pausedNow.quit.includes('Quit to menu'), `it opens paused with the pause menu up (${JSON.stringify(pausedNow)})`);
  await shot(page, '03-resumed-paused');
  const log1 = await page.evaluate(() => window.__v3.log());
  check(log1.id === id && log1.resumes?.length === 1 && log1.resumes[0].step === before.steps && !log1.end && !log1.left, `the same log goes on: id ${log1.id}, resumed at step ${log1.resumes?.[0]?.step}`);

  // ---- Play on and finish the wave ----
  await page.locator('.v2-pause-panel .v2-btn:has-text("Resume")').tap();
  const done = await playUntil(page, (s) => s.phase === 'draft' || (s.phase === 'wave' && s.wave === 4));
  check(done && (done.phase === 'draft' || done.wave === 4), `the resumed run finishes wave 3 (${JSON.stringify(done)})`);
  const rep = await page.evaluate(() => {
    const log = window.__v3.log();
    const g = window.__v3.game();
    const r = window.__v3.replay(log);
    return { live: { steps: g.steps, score: g.score, lost: g.lost, wave: g.wave }, replay: r, cmds: log.commands.length, first: log.commands[0]?.[0] };
  });
  check(rep.replay.steps === rep.live.steps && rep.replay.score === rep.live.score && rep.replay.lost === rep.live.lost && rep.replay.wave === rep.live.wave, `the one log replays to the whole run, both sittings (${JSON.stringify(rep)})`);
  await page.waitForTimeout(1000);
  const later = posts.filter((p) => p.id === id && !p.left && p.resumes === 1);
  check(later.length > 0 && later.every((p) => p.steps > before.steps), `the later upload has the same id (it replaces the background's on the server) and covers both sittings (${JSON.stringify(posts.filter((p) => p.id === id))})`);
  const kept2 = await savedRun(page);
  check(kept2?.log.id === id && kept2.step > before.steps, 'the wave end saves the run again, same id');

  // ---- Quit: Save and quit / Abandon run ----
  await playUntil(page, (s) => s.phase === 'wave' && s.wave === 4 && s.waveT > 3);
  await page.locator('.v2-pause').tap();
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.waitForSelector('[data-quit-save]');
  const prompt = await page.evaluate(() => [...document.querySelectorAll('.v3-quit .v2-btn')].map((b) => b.textContent));
  check(prompt.join('|') === 'Save and quit|Abandon run|Back' && (await page.evaluate(() => document.querySelector('[data-quit-save]').classList.contains('primary'))), `Quit asks: Save and quit (the default), Abandon run, Back (${prompt.join(', ')})`);
  await shot(page, '04-quit-prompt');
  await page.locator('[data-quit-back]').tap();
  await page.waitForSelector('.v2-pause-panel .v2-btn:has-text("Resume")');
  check(true, 'Back returns to the pause menu');
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-save]').tap();
  await page.waitForSelector('[data-screen="menu"] [data-continue]');
  const sq = await savedRun(page);
  check(sq?.log.id === id && sq.wave === 4, 'Save and quit keeps the run: the menu offers Continue');
  await page.waitForTimeout(600);
  check(posts.some((p) => p.id === id && p.left && p.resumes === 1), 'Save and quit seals the log as left, same id (a later save replaces it)');

  // Starting another run over it asks first.
  await page.locator('[data-map="strait"]').tap();
  await page.locator('[data-start]').tap();
  await page.waitForSelector('[data-ask-continue]');
  const ask = await page.evaluate(() => document.querySelector('[data-screen="pause-panel v3-ask-saved"]')?.innerText.replace(/\s+/g, ' ') ?? document.querySelector('.v3-ask-saved').innerText.replace(/\s+/g, ' '));
  check(/Continue your saved run, or start new \(the saved run is lost\)\?/.test(ask) && /The Kesh Hook/.test(ask), `a new run over a saved one asks (${ask})`);
  await shot(page, '05-start-new-prompt');
  await page.locator('[data-ask-continue]').tap();
  await page.waitForSelector('.v2-pause-panel .v3-restored', { timeout: 15000 });
  const back4 = await gameNow(page);
  check(back4.map === 'kesh' && back4.wave === 4, `"Continue saved run" continues it (${JSON.stringify(back4)})`);
  // Abandon.
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-abandon]').tap();
  await page.waitForSelector('[data-screen="menu"]');
  await page.waitForTimeout(500);
  check(!(await page.$('[data-continue]')) && !(await savedRun(page)), 'Abandon run: no saved run, no Continue');
  check(posts.some((p) => p.id === id && p.end === 'quit' && !p.left), 'the abandoned run is sealed as a quit, same id');

  // Start new over a saved run: it is lost.
  await page.locator('[data-map="strait"]').tap();
  await page.locator('[data-start]').tap();
  await page.waitForSelector('.playing');
  await playUntil(page, (s) => s.phase === 'wave' && s.waveT > 4);
  const strait = await page.evaluate(() => window.__v3.log().id);
  await page.locator('.v2-pause').tap();
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-save]').tap();
  await page.waitForSelector('[data-screen="menu"] [data-continue]');
  await page.locator('[data-map="kesh"]').tap();
  await page.locator('[data-start]').tap();
  await page.locator('[data-ask-new]').tap();
  await page.waitForSelector('.playing');
  await page.waitForTimeout(300);
  const fresh2 = await page.evaluate(() => ({ map: window.__v3.game().map.id, id: window.__v3.log().id, saved: window.__v3.savedRun()?.log.id ?? null }));
  check(fresh2.map === 'kesh' && fresh2.id !== strait && fresh2.saved !== strait, `"Start new" starts the new run and the saved one is gone (${JSON.stringify(fresh2)})`);

  // ---- A save this build can't continue ----
  await playUntil(page, (s) => s.phase === 'wave' && s.waveT > 5);
  await page.locator('.v2-pause').tap();
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-save]').tap();
  await page.waitForSelector('[data-continue]');
  // An older log version.
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('straitwatch.v3.run'));
    r.logVersion = 3;
    r.log.v = 3;
    localStorage.setItem('straitwatch.v3.run', JSON.stringify(r));
  });
  await page.reload();
  await page.locator('[data-continue]').tap();
  await page.waitForSelector('[data-old-again]');
  const old = await page.evaluate(() => document.querySelector('.v3-old-run').innerText.replace(/\s+/g, ' '));
  check(/This run was from an older version and can't be continued\./.test(old), `an older version's save says so in one line (${old})`);
  await shot(page, '06-older-version');
  await page.locator('[data-old-again]').tap();
  await page.waitForSelector('.playing');
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => ({ map: window.__v3.game().map.id, wave: window.__v3.game().wave, steps: window.__v3.game().steps, saved: window.__v3.savedRun() }));
  check(again.map === 'kesh' && again.wave === 1 && again.saved === null, `"Start this map again" starts the same map from the start (${JSON.stringify({ ...again, saved: !!again.saved })})`);
  // A build that plays the inputs differently (the fingerprint differs).
  await playUntil(page, (s) => s.phase === 'wave' && s.waveT > 5);
  await page.locator('.v2-pause').tap();
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-save]').tap();
  await page.waitForSelector('[data-continue]');
  await page.evaluate(() => {
    const r = JSON.parse(localStorage.getItem('straitwatch.v3.run'));
    r.print.hash = 'deadbeef';
    localStorage.setItem('straitwatch.v3.run', JSON.stringify(r));
  });
  await page.reload();
  await page.locator('[data-continue]').tap();
  await page.waitForSelector('[data-old-again]', { timeout: 15000 });
  check(!(await page.$('.playing')) && !(await savedRun(page)), 'a replay that no longer matches is not continued as a different game');
  await page.locator('.v3-old-run .v2-btn:has-text("Back")').tap();
  await page.waitForSelector('[data-screen="menu"]');
  check(!(await page.$('[data-continue]')), 'and its Continue is gone');

  // ---- Free Play ----
  await page.locator('[data-free-play]').tap();
  await page.locator('[data-free-start]').tap();
  await page.waitForSelector('.playing');
  await playUntil(page, (s) => s.phase === 'wave' && s.waveT > 6);
  await hide(page);
  await page.waitForTimeout(300);
  const fp = await gameNow(page); // read once paused (see the campaign run)
  await page.reload();
  await page.waitForSelector('[data-continue="free"]');
  const fpEntry = await page.evaluate(() => document.querySelector('[data-continue]').innerText.replace(/\s+/g, ' '));
  check(/Free Play/i.test(fpEntry), `a Free Play run is offered as Free Play (${fpEntry})`);
  await page.locator('[data-continue]').tap();
  await page.waitForSelector('.v2-pause-panel .v3-restored', { timeout: 15000 });
  const fpBack = await page.evaluate(() => ({ ...(() => { const g = window.__v3.game(); return { wave: g.wave, score: g.score, steps: g.steps, freePlay: g.freePlay }; })(), hud: document.querySelector('.v2-hud').textContent }));
  check(fpBack.wave === fp.wave && fpBack.steps === fp.steps && fpBack.score === fp.score && fpBack.freePlay && /FREE PLAY/.test(fpBack.hud), `Free Play continues as Free Play (${JSON.stringify(fpBack)})`);
  await page.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
  await page.locator('[data-quit-abandon]').tap();
  await page.waitForSelector('[data-screen="menu"]');

  // ---- A Test Lab map card (encounters and the convoy's commands) ----
  await page.goto(`${HOST}/v3.html?lab=map-harbor`);
  await page.waitForSelector('.playing');
  await page.waitForTimeout(300);
  const labStart = await page.evaluate(() => { const g = window.__v3.game(); return { full: g.lab?.full, enc: !!g.enc, convoy: g.convoy?.setup.policy ?? null }; });
  check(labStart.full && labStart.enc && labStart.convoy === 'tactical', `the Harbor Mouth card: full run, encounters, convoy commands (${JSON.stringify(labStart)})`);
  await playUntil(page, (s) => s.phase === 'wave' && s.waveT > 14);
  await hide(page);
  await page.waitForTimeout(300);
  const lab = await gameNow(page); // read once paused (see the campaign run)
  const labLog = await page.evaluate(() => window.__v3.log());
  const convoyBox = await page.evaluate(() => document.querySelector('.v3-commands').innerText.replace(/\s+/g, ' '));
  await page.goto(`${HOST}/v3.html`);
  await page.waitForSelector('[data-continue="lab"]');
  await page.locator('[data-lab]').tap();
  await page.waitForSelector('[data-screen="lab"] [data-continue="lab"]');
  const hubEntry = await page.evaluate(() => document.querySelector('[data-screen="lab"] [data-continue]').innerText.replace(/\s+/g, ' '));
  check(/Test Lab/i.test(hubEntry) && /Harbor Mouth/.test(hubEntry), `the Test Lab hub offers the test to continue (${hubEntry})`);
  await shot(page, '07-lab-hub-continue');
  await page.locator('[data-screen="lab"] [data-continue]').tap();
  await page.waitForSelector('.v2-pause-panel .v3-restored', { timeout: 15000 });
  const labBack = await page.evaluate(() => {
    const g = window.__v3.game();
    return {
      wave: g.wave, steps: g.steps, score: g.score, full: g.lab?.full, enc: !!g.enc, convoy: g.convoy?.setup.policy ?? null, id: window.__v3.log().id,
      acts: [...document.querySelectorAll('.v2-pause-panel [data-lab-note], .v2-pause-panel [data-lab-setup], .v2-pause-panel [data-lab-done]')].map((b) => (b.dataset.labNote ? 'note' : b.dataset.labSetup ? 'setup' : 'done')),
      convoyBox: document.querySelector('.v3-commands').innerText.replace(/\s+/g, ' '),
      lab: document.querySelector('.v2-root').classList.contains('lab-on'),
    };
  });
  check(labBack.wave === lab.wave && labBack.steps === lab.steps && labBack.score === lab.score && labBack.full && labBack.enc && labBack.convoy === 'tactical' && labBack.id === labLog.id && labBack.lab, `the test continues as it was (${JSON.stringify(labBack)})`);
  check(['note', 'setup', 'done'].every((a) => labBack.acts.includes(a)) && labBack.convoyBox === convoyBox, `its pause menu has Note, Setup and Done, and the convoy rail is as it was (${labBack.acts.join(',')}; "${labBack.convoyBox}")`);
  await shot(page, '08-lab-resumed');
  // Setup → Apply restarts it, and the save goes.
  await page.locator('.v2-pause-panel [data-lab-setup]').tap();
  await page.waitForSelector('[data-screen="lab-setup"]');
  const apply = page.locator('[data-screen="lab-setup"] .v2-btn.primary').first();
  await apply.tap();
  await page.waitForFunction(() => window.__v3.game()?.steps < 30 && window.__v3.game()?.phase === 'wave', null, { timeout: 8000 });
  const restarted = await page.evaluate(() => ({ id: window.__v3.log().id, saved: window.__v3.savedRun() }));
  check(restarted.id !== labLog.id && restarted.saved === null, `Setup → Apply restarts the test as today and clears the save (${JSON.stringify({ id: restarted.id, saved: !!restarted.saved })})`);

  // ---- A long run's replay in this browser (wave 12-13) ----
  if (LONG_LOG) {
    const { readFileSync } = await import('node:fs');
    const log = JSON.parse(readFileSync(LONG_LOG, 'utf8'));
    const step = (log.summary?.steps ?? 0) - 120;
    const times = [];
    for (let k = 0; k < 3; k++) times.push(await page.evaluate(([log, step]) => window.__v3.restoreTiming(log, step), [log, step]));
    console.log(`info: a long run's replay in Chromium: ${times.map((t) => `${Math.round(t.ms)} ms`).join(', ')} for ${times[0].steps} steps (wave ${times[0].wave})`);
    // The same with the CPU slowed 4× (DevTools' "mid-tier mobile").
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const slow = await page.evaluate(([log, step]) => window.__v3.restoreTiming(log, step), [log, step]);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(`info: the same at 4× CPU slowdown: ${Math.round(slow.ms)} ms`);
  }
  check(errors.length === 0, 'no page errors');
  await ctx.close();

  // ---- No storage: the feature is off, nothing breaks ----
  {
    const nctx = await browser.newContext(PHONE);
    await nctx.addInitScript(() => {
      const deny = () => {
        throw new DOMException('denied', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', { get: deny, configurable: true });
    });
    const np = await nctx.newPage();
    const errs = [];
    np.on('pageerror', (e) => errs.push(e.message));
    await np.goto(`${BASE_URL}/v3.html`);
    await np.waitForSelector('[data-screen="menu"]');
    await np.locator('[data-map="strait"]').tap();
    const sail = np.locator('[data-start]');
    if (await sail.count()) await sail.tap();
    await np.waitForSelector('.playing');
    await np.waitForTimeout(1500);
    await np.locator('.v2-pause').tap();
    await np.locator('.v2-pause-panel .v2-btn:has-text("Quit to menu")').tap();
    await np.waitForSelector('[data-screen="menu"]');
    check(!(await np.$('[data-continue]')) && !(await np.$('[data-quit-save]')) && errs.length === 0, `with no storage, Quit goes straight to the menu, there's no Continue, and nothing throws (${errs.join('; ')})`);
    await nctx.close();
  }
} finally {
  await browser.close();
}
