// V2 watch-mode browser test (round 9). Expects `vite preview` at BASE_URL.
// Settings → Developer → Watch mode and a bot personality (round 12); the
// bot plays a watched run at 10×;
// a human ¼ run picks both cards of a stride draft.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  npm run e2e:v2:watch

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v2-watch';
mkdirSync(SHOT_DIR, { recursive: true });
const chromiumPath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chromiumPath, args: ['--no-sandbox'] });
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const phone = () => browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const game = (page, f, arg) => page.evaluate(f, arg);

async function devSettings(page, settings) {
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v2.dev', '1');
    localStorage.setItem('straitwatch.v2.dev.settings', JSON.stringify(s));
  }, settings);
  await page.reload({ waitUntil: 'networkidle' });
}

try {
  // 1. Turned on from Settings; hidden until dev mode is.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=11`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('.v2-settings-btn').tap();
    if (await page.locator('[data-setting="watch"]').count()) fail('watch switch shows before dev mode is on');
    await page.locator('[data-setting="dev"]').tap();
    await page.locator('[data-setting="watch"]').tap();
    if ((await page.locator('[data-setting="watch"]').getAttribute('aria-checked')) !== 'true') fail('watch switch did not turn on');
    await page.screenshot({ path: `${SHOT_DIR}/01-settings.png` });
    // Round 12: the bot personality picker, "You" chosen by default.
    const chips = await page.locator('[data-persona]').evaluateAll((els) => els.map((e) => [e.dataset.persona, e.classList.contains('on')]));
    if (chips.length < 7) fail(`only ${chips.length} bot personalities offered`);
    if (chips.find((c) => c[1])?.[0] !== 'you') fail(`default personality is ${chips.find((c) => c[1])?.[0]}`);
    await page.locator('[data-persona="rusher"]').tap();
    if (!(await page.locator('[data-persona="rusher"]').getAttribute('class')).includes('on')) fail('rusher chip did not light up');
    if (!(await page.locator('.v2-persona-blurb').textContent()).includes('2×')) fail('rusher blurb not shown');
    await page.locator('.v2-overlay.open').evaluate((e) => (e.scrollTop = e.scrollHeight));
    await page.screenshot({ path: `${SHOT_DIR}/01b-personas.png` });
    await page.locator('[data-screen="settings"] .v2-btn').tap();
    if (!(await page.locator('.v2-dev-title').textContent()).includes('WATCH')) fail('menu strip does not say watch mode');
    await page.locator('[data-preset="eighth"]').tap();
    await page.locator('[data-map="island"]').tap();
    await page.waitForSelector('.playing');
    // The bot plays on its own: taps appear without any input from us.
    await page.waitForFunction(() => window.__v2.game().shots > 0, null, { timeout: 15000 });
    if (!(await page.locator('.v2-hud-dev').textContent()).includes('RUSHER')) fail('HUD does not name the rusher bot');
    const meta = await game(page, () => window.__v2.log()?.dev);
    if (meta?.bot !== 'rusher' || !meta?.watch) fail(`log says the bot was ${JSON.stringify(meta)}`);
    await page.screenshot({ path: `${SHOT_DIR}/02-watching.png` });
    const track = await page.locator('.v2-rail-right .v2-track').boundingBox();
    await page.mouse.click(track.x + track.width / 2, track.y + 2);
    const speed = await page.locator('.v2-rail-right .v2-slider-value').textContent();
    if (speed !== '10×') fail(`top watch speed is ${speed}`);
    // A bot draft: its pick lights up before it takes it.
    await page.waitForFunction(() => window.__v2.game().phase === 'draft', null, { timeout: 30000, polling: 50 });
    await page.waitForSelector('.bot-pick', { timeout: 2000 });
    await page.screenshot({ path: `${SHOT_DIR}/03-bot-draft.png` });
    await page.waitForFunction(() => ['won', 'lost'].includes(window.__v2.game().phase), null, { timeout: 90000, polling: 250 });
    const end = await game(page, () => ({ phase: window.__v2.game().phase, wave: window.__v2.game().wave }));
    console.log('watched ⅛ Island run:', JSON.stringify(end));
    await page.screenshot({ path: `${SHOT_DIR}/04-result.png` });
    await page.close();
  }

  // 2. A human ¼ run: a stride draft deals two cards in a row, both pickable.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=12`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'quarter', wave: 1, watch: false, watchSpeed: 1 });
    await page.locator('[data-map="strait"]').tap();
    await page.waitForSelector('.playing');
    // Clear the wave at once: no launches left, nothing in the air.
    await game(page, () => {
      const g = window.__v2.game();
      g.queue = [];
      g.raiderQueue = [];
      g.threats = [];
      g.raiders = [];
    });
    await page.waitForSelector('[data-screen="draft"] .v2-card');
    const title1 = await page.locator('[data-screen="draft"] .v2-draft-eyebrow').textContent();
    await page.locator('.v2-card:not(.locked)').first().tap();
    await page.waitForFunction(() => window.__v2.game().wave === 3 && window.__v2.game().phase === 'draft');
    // Round 8 bug: the second draft never redrew, leaving the first one's
    // cards on screen (taps on them did nothing).
    await page
      .waitForFunction(() => document.querySelector('[data-screen="draft"] .v2-draft-eyebrow')?.textContent.includes('skipped'), null, { timeout: 3000 })
      .catch(() => fail('the stride draft for the skipped wave never appeared'));
    await page.locator('.v2-card:not(.locked)').first().tap();
    await page.waitForFunction(() => window.__v2.game().phase === 'wave' && window.__v2.game().wave === 4, null, { timeout: 3000 }).catch(() => fail('second stride card did not start wave 4'));
    console.log('stride drafts:', title1, '→ wave', await game(page, () => window.__v2.game().wave));
    await page.close();
  }

  // 3. Take over and hand back: one touch on the battlefield gives you the
  //    controls at 1×; the BOT button hands them back at the watch speed. The
  //    mixed run's log replays exactly.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=13`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'half', wave: 3, watch: true, watchSpeed: 4 });
    await page.locator('[data-map="island"]').tap();
    await page.waitForSelector('.playing');
    await page.waitForFunction(() => window.__v2.game().shots > 3, null, { timeout: 20000 });
    if ((await page.locator('.v2-rail-right .v2-slider-value').textContent()) !== '4×') fail('watch speed not remembered');
    if ((await page.locator('.v2-control b').textContent()) !== 'BOT') fail('control button does not say BOT');
    await page.screenshot({ path: `${SHOT_DIR}/05-bot-control.png` });
    // Touch open water mid-screen.
    const water = await game(page, () => window.__v2.toClient(800, 500));
    await page.touchscreen.tap(water.x, water.y);
    const taken = await game(page, () => ({ control: window.__v2.control(), shots: window.__v2.game().shots }));
    const speed1 = await page.locator('.v2-rail-right .v2-slider-value').textContent();
    if (taken.control !== 'you' || speed1 !== '1×') fail(`take over: ${JSON.stringify(taken)} at ${speed1}`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOT_DIR}/06-you-control.png` });
    // While you have it, the bot keeps its hands off: no taps but ours.
    const before = await game(page, () => window.__v2.log().commands.filter((c) => c[1] === 't').length);
    await page.waitForTimeout(1500);
    const after = await game(page, () => window.__v2.log().commands.filter((c) => c[1] === 't').length);
    if (after !== before) fail(`bot tapped ${after - before} times while you had control`);
    // Tap a live threat ourselves.
    const target = await game(page, () => {
      const g = window.__v2.game();
      const th = g.threats.find((t) => !t.dead);
      return th ? window.__v2.toClient(th.x, th.y) : null;
    });
    if (target) await page.touchscreen.tap(target.x, target.y);
    await page.locator('.v2-control').tap();
    const back = await game(page, () => window.__v2.control());
    const speed2 = await page.locator('.v2-rail-right .v2-slider-value').textContent();
    if (back !== 'bot' || speed2 !== '4×') fail(`hand back: ${back} at ${speed2}`);
    await page.waitForFunction((n) => window.__v2.log().commands.filter((c) => c[1] === 't').length > n + 2, after, { timeout: 15000 });
    const log = await game(page, () => window.__v2.log());
    const controls = log.commands.filter((c) => c[1] === 'c').map((c) => c[2]);
    if (controls.join() !== 'you,bot') fail(`control changes logged as ${controls}`);
    const live = await game(page, () => ({ steps: window.__v2.game().steps }));
    const r = await game(page, (l) => window.__v2.replay(l), log);
    console.log('mixed run: controls', controls.join('→'), 'replay', JSON.stringify(r), 'live steps', live.steps);
    if (r.steps !== log.summary.steps) fail(`mixed log replays to step ${r.steps}, logged ${log.summary.steps}`);
    await page.close();
  }

  // 4. Flag a moment: 🚩 pauses on the step, a reason lands in the log there.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=17`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'half', wave: 6, watch: true, watchSpeed: 2 });
    await page.locator('[data-map="island"]').tap();
    await page.waitForFunction(() => window.__v2.game().threats.length >= 3, null, { timeout: 30000, polling: 50 });
    await page.locator('.v2-flag-btn').tap();
    await page.waitForSelector('[data-screen="flag"]');
    const at = await game(page, () => window.__v2.game().steps);
    await page.waitForTimeout(700);
    if ((await game(page, () => window.__v2.game().steps)) !== at) fail('the game ran on behind the flag dialog');
    await page.screenshot({ path: `${SHOT_DIR}/07-flag.png` });
    await page.locator('.v2-flag-kind', { hasText: 'Too hard' }).tap();
    const flag = await game(page, () => window.__v2.log().commands.find((c) => c[1] === 'g'));
    if (!flag || flag[0] !== at || flag[2] !== 'hard') fail(`flag logged as ${JSON.stringify(flag)}, paused at ${at}`);
    if ((await page.locator('[data-screen]').count()) && (await page.locator('.v2-overlay.open').count())) fail('flag dialog did not close');
    await page.waitForFunction((s) => window.__v2.game().steps > s + 30, at, { timeout: 5000 }).catch(() => fail('the game did not resume after flagging'));
    console.log('flagged:', JSON.stringify(flag));
    await page.close();
  }

  // 5. Ghost check: after a run you played, bot-you plays the same seed and
  //    the result screen compares; a run the bot played alone gets none.
  {
    const page = await phone();
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=19`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'quarter', wave: 1, watch: false, watchSpeed: 1 });
    await page.locator('[data-map="gauntlet"]').tap();
    await page.waitForSelector('.playing');
    await page.waitForTimeout(800);
    await game(page, () => {
      const g = window.__v2.game();
      g.lost = g.tempo.lossLimit;
    });
    await page.waitForSelector('.v2-ghost');
    await page.waitForSelector('.v2-ghost.done', { timeout: 30000 }).catch(() => fail('ghost check never finished'));
    const text = await page.locator('.v2-ghost').innerText();
    console.log('ghost:', text.replace(/\n/g, ' | '));
    if (!/Bot-you: (lost on wave \d+|cleared)/.test(text)) fail(`ghost line reads: ${text}`);
    await page.screenshot({ path: `${SHOT_DIR}/08-ghost.png` });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v2.playlogs') || '[]').at(-1));
    if (!saved?.ghost || saved.ghost.bot !== 'you') fail(`ghost not saved in the log: ${JSON.stringify(saved?.ghost)}`);
    // A watched run (the bot alone) has nothing to compare.
    await devSettings(page, { preset: 'eighth', wave: 1, watch: true, watchSpeed: 10 });
    await page.locator('[data-map="strait"]').tap();
    await page.waitForSelector('.playing');
    await game(page, () => {
      const g = window.__v2.game();
      g.lost = g.tempo.lossLimit;
    });
    await page.waitForSelector('[data-screen="result"]');
    if (await page.locator('.v2-ghost').count()) fail('a bot-only run showed a ghost check');
    await page.close();
  }

  // 6. Round 14: the notification tray, on every map, in a busy late wave
  //    (every new threat's notice queues up at once). Cards never overlap
  //    each other or the carrier, never leave the screen, and never exceed
  //    the map's limit.
  for (const [map, w, h] of [
    ['strait', 874, 402],
    ['gauntlet', 874, 402],
    ['island', 874, 402],
    ['harbor', 874, 402],
    ['archipelago', 874, 402],
    ['strait', 844, 390],
    ['gauntlet', 844, 390],
    ['island', 844, 390],
    ['harbor', 844, 390],
    ['archipelago', 844, 390],
  ]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    page.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await page.goto(`${BASE_URL}/v2.html?seed=31`, { waitUntil: 'networkidle' });
    await devSettings(page, { preset: 'full', wave: 6, watch: true, watchSpeed: 3, bot: 'you' });
    await page.locator(`[data-map="${map}"]`).tap();
    await page.waitForSelector('.playing');
    let most = 0;
    let samples = 0;
    for (let k = 0; k < 70; k++) {
      const r = await page.evaluate(() => {
        const g = window.__v2.game();
        const cards = [...document.querySelectorAll('.v2-alert')].map((e) => e.getBoundingClientRect());
        const c = g.map.carrier;
        const a = window.__v2.toClient(c.x - 80, c.y - 26);
        const b = window.__v2.toClient(c.x + 80, c.y + 26);
        const hit = (p, q) => p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1;
        const carrier = { left: a.x, top: a.y, right: b.x, bottom: b.y };
        return {
          n: cards.length,
          max: g.map.alerts.max ?? 2,
          overlap: cards.some((p, i) => cards.some((q, j) => j > i && hit(p, q))),
          onCarrier: cards.some((p) => hit(p, carrier)),
          off: cards.some((p) => p.bottom > innerHeight + 0.5 || p.top < 0 || p.left < 0 || p.right > innerWidth),
          phase: g.phase,
        };
      });
      if (r.phase !== 'wave') break;
      samples++;
      most = Math.max(most, r.n);
      if (r.n > r.max) fail(`${map}: ${r.n} notices up (limit ${r.max})`);
      if (r.overlap) fail(`${map}: notices overlap each other`);
      if (r.onCarrier) fail(`${map}: a notice covers the carrier`);
      if (r.off) fail(`${map}: a notice runs off the screen`);
      if (process.exitCode) break;
      await page.waitForTimeout(120);
    }
    if (most === 0) fail(`${map}: no notices seen in a busy wave`);
    console.log(`tray on ${map} ${w}×${h}: ${samples} samples, up to ${most} cards at once, no overlaps`);
    await page.close();
  }

  console.log(process.exitCode ? 'V2 watch test FAILED' : 'V2 watch test passed');
} finally {
  await browser.close();
}
