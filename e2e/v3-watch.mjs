// Test Lab Watch mode in the browser (log v65; the player: "I should be able
// to run a simulator on that too so I can do my testing faster ... watch it
// be played and I can jump in at any time and make comments and play too").
// Expects `vite preview` (or dev) at BASE_URL. On a landscape phone
// (874 x 402), by touch:
// - the hub's map tiles and Ready to test cards have Watch;
// - Watch on The Strait starts its card with the "you" bot at the controls:
//   the rail's control says Take over, the bot shoots, and a tap on the
//   field does nothing while it plays; the speed button speeds it up;
// - a note while watching is the bot's; Take over hands the controls over
//   at once (back to 1x), a tap on a threat fires, and a note then is the
//   player's; Let the bot play hands them back;
// - Done: the scorecard says it was a mixed run, and the downloaded log
//   has the control segments (bot, player, bot), the label and the notes,
//   and replays to the same game.
// Screenshots (phone landscape, 2x) go to SHOT_DIR with the prefix watch-.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-watch.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3-watch';
mkdirSync(SHOT_DIR, { recursive: true });

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

const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => (ok ? console.log('ok:', msg) : fail(msg));
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, acceptDownloads: true };
const shot = (page, name) => page.screenshot({ path: `${SHOT_DIR}/watch-${name}.png` });

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext(PHONE);
  await ctx.addInitScript(() => {
    try {
      localStorage.removeItem('straitwatch.v3.run');
    } catch {
      // no storage
    }
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // ---- The hub: Watch on the map tiles and the Ready to test cards ----
  await page.tap('[data-lab]');
  await page.waitForSelector('[data-screen="lab"]');
  const hub = await page.evaluate(() => ({
    tiles: document.querySelectorAll('.v3-lab-tiles [data-watch]').length,
    maps: document.querySelectorAll('.v3-lab-tiles .v3-lab-info').length,
    ready: document.querySelectorAll('.v3-ready [data-watch]').length,
    readyCards: document.querySelectorAll('.v3-ready').length,
    wide: document.documentElement.scrollWidth > innerWidth,
  }));
  check(hub.tiles === hub.maps && hub.tiles >= 20 && hub.ready === hub.readyCards && !hub.wide, `every map tile and Ready to test card has Watch (${JSON.stringify(hub)})`);

  // ---- Watch The Strait: the bot plays ----
  await page.locator('[data-watch="map-strait"]').first().scrollIntoViewIfNeeded();
  await page.tap('.v3-lab-tiles [data-watch="map-strait"]');
  await page.waitForSelector('.playing.lab-on.watch-lab', { timeout: 10000 });
  const start = await page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    const c = document.querySelector('.v2-control');
    return { control: window.__v3.control(), btn: c.textContent, shown: c.getBoundingClientRect().width > 0, card: log.lab?.card, plays: log.lab?.plays, mode: log.control?.mode, bot: log.control?.bot, wave: g.wave, armory: log.lab?.armory, speed: document.querySelector('.v3-speed b')?.textContent };
  });
  check(start.control === 'bot' && /Take over/.test(start.btn) && start.shown && start.card === 'map-strait' && start.plays === 'full' && start.mode === 'watch' && start.bot === 'you' && start.wave === 1 && !!start.armory && start.speed === '1×', `Watch starts The Strait's card (the same full run and Test Lab Armory) with the "you" bot at the controls, at 1x, Take over on the rail (${JSON.stringify(start)})`);

  // The bot shoots something.
  await page.waitForFunction(() => window.__v3.game().shots > 0 && window.__v3.log().commands.some((c) => c[1] === 't'), null, { timeout: 30000 });
  check(true, 'the bot shoots: its taps land in the log as commands');
  // A tap on the field while the bot plays does nothing (not a shot, not a take-over).
  const dead = await page.evaluate(() => window.__v3.toClient(777, 333));
  const before = await page.evaluate(() => window.__v3.log().commands.length);
  await page.touchscreen.tap(dead.x, dead.y);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ control: window.__v3.control(), mine: window.__v3.log().commands.some((c) => c[1] === 't' && Math.abs(c[2] - 777) <= 2 && Math.abs(c[3] - 333) <= 2) }));
  check(after.control === 'bot' && !after.mine, `while the bot plays, a tap on the field neither fires nor takes over (${JSON.stringify(after)}, ${before} commands before)`);
  // The speed button: 2x, then back toward 1x later (the bot is watched at it).
  await page.tap('.v3-speed');
  check((await page.textContent('.v3-speed b')) === '2×', 'the speed button speeds the bot up (2x)');
  await page.waitForFunction(() => window.__v3.game().kills && Object.values(window.__v3.game().kills).reduce((a, b) => a + b, 0) > 0, null, { timeout: 30000 });
  await shot(page, '01-bot-playing');

  // A note while watching: the bot's.
  await page.tap('.v2-pause');
  await page.waitForSelector('.v2-pause-panel [data-lab-note]');
  const menu = await page.evaluate(() => ({ swap: document.querySelector('.v2-pause-panel [data-watch-swap]')?.textContent ?? null }));
  check(/Take over/.test(menu.swap ?? ''), `the pause menu has Take over too (${menu.swap})`);
  await page.tap('.v2-pause-panel [data-lab-note]');
  await page.waitForSelector('.v3-note-text');
  await page.locator('.v3-note-text').fill('Bot left the north open');
  await page.tap('.v3-note-save');
  await page.waitForSelector('.v2-pause-panel [data-lab-note]');
  await page.tap('.v2-pause-panel .v2-btn.primary');
  await page.waitForFunction(() => !document.querySelector('.v2-overlay.open'));

  // ---- Take over ----
  await page.waitForFunction(() => window.__v3.game().phase === 'wave', null, { timeout: 20000 });
  await page.tap('.v2-control');
  const took = await page.evaluate(() => {
    const log = window.__v3.log();
    const c = log.commands.filter((x) => x[1] === 'c').at(-1);
    return { control: window.__v3.control(), c, step: window.__v3.game().steps, btn: document.querySelector('.v2-control').textContent, speed: document.querySelector('.v3-speed b')?.textContent };
  });
  check(took.control === 'you' && took.c?.[2] === 'you' && took.c[0] <= took.step && /Let bot play/.test(took.btn) && took.speed === '1×', `Take over: the controls are the player's from that tick, back at 1x, the button now Let bot play (${JSON.stringify(took)})`);
  await page.waitForTimeout(250);
  await shot(page, '02-take-over');

  // Tap a threat: it fires.
  const target = await page.waitForFunction(() => {
    const g = window.__v3.game();
    if (g.phase !== 'wave') return null;
    const t = g.threats.find((th) => !th.dead && !th.hidden && th.x > 120 && th.x < 1480 && th.y > 80 && th.y < 820);
    return t ? { ...window.__v3.toClient(t.x, t.y), wx: t.x, wy: t.y } : null;
  }, null, { timeout: 30000 });
  const at = await target.jsonValue();
  const shots0 = await page.evaluate(() => ({ shots: window.__v3.game().shots, n: window.__v3.log().commands.length }));
  await page.touchscreen.tap(at.x, at.y);
  await page.waitForTimeout(100);
  const fired = await page.evaluate(({ n }) => window.__v3.log().commands.slice(n).filter((c) => c[1] === 't' || c[1] === 'd'), shots0);
  check(fired.length >= 1 && Math.abs(fired[0][2] - at.wx) < 60 && Math.abs(fired[0][3] - at.wy) < 60, `a tap on a threat after taking over is a shot in the log (${JSON.stringify(fired[0])} at ${Math.round(at.wx)},${Math.round(at.wy)})`);

  // A note while playing: the player's.
  await page.tap('.v2-pause');
  await page.waitForSelector('.v2-pause-panel [data-lab-note]');
  await page.tap('.v2-pause-panel [data-lab-note]');
  await page.waitForSelector('.v3-note-text');
  // The in-game touch keyboard (#232).
  await page.tap('.v3-note-text');
  const kb = await page.waitForSelector('.pk.pk-visible', { timeout: 3000 }).then(() => true, () => false);
  if (kb) {
    await page.waitForTimeout(500);
    for (const ch of 'ok') {
      const p = await page.evaluate((label) => {
        const k = [...document.querySelectorAll('.pk-key')].find((e) => e.querySelector('.pk-key-label')?.textContent.trim().toLowerCase() === label);
        if (!k) return null;
        const r = k.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, ch);
      if (p) await page.touchscreen.tap(p.x, p.y);
      await page.waitForTimeout(40);
    }
  }
  const typed = await page.evaluate(() => document.querySelector('.v3-note-text').value);
  check(!kb || /ok/i.test(typed), `the note box takes the in-game keyboard (${kb ? `typed "${typed}"` : 'no keyboard here'})`);
  if (!/ok/i.test(typed)) await page.locator('.v3-note-text').fill('ok');
  await page.tap('.v3-note-save');
  await page.waitForSelector('.v2-pause-panel [data-watch-swap]');
  // ---- Hand back: Let the bot play, from the pause menu ----
  const swap = await page.textContent('.v2-pause-panel [data-watch-swap]');
  check(/Let the bot play/.test(swap), `the pause menu offers Let the bot play while you play (${swap})`);
  await page.tap('.v2-pause-panel [data-watch-swap]');
  await page.waitForSelector('.v2-pause-panel [data-watch-swap="you"]');
  await page.tap('.v2-pause-panel .v2-btn.primary');
  await page.waitForFunction(() => !document.querySelector('.v2-overlay.open'));
  const back = await page.evaluate(() => ({ control: window.__v3.control(), btn: document.querySelector('.v2-control').textContent }));
  check(back.control === 'bot' && /Take over/.test(back.btn), `Let the bot play hands the controls back (${JSON.stringify(back)})`);
  const handStep = await page.evaluate(() => window.__v3.log().commands.filter((c) => c[1] === 'c').at(-1)[0]);
  await page.waitForFunction((s) => window.__v3.log().commands.some((c) => c[1] === 't' && c[0] > s) && window.__v3.game().steps > s + 120, handStep, { timeout: 30000 });
  check(true, 'the bot plays on after the hand-back');

  // ---- Done: the scorecard says it was mixed; the downloaded log ----
  await page.tap('.v2-pause');
  await page.waitForSelector('.v2-pause-panel [data-lab-done]');
  await page.tap('.v2-pause-panel [data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"] [data-watch-label]');
  const sheet = await page.evaluate(() => {
    const l = document.querySelector('[data-watch-label]');
    const r = l.getBoundingClientRect();
    return { label: l.dataset.watchLabel, text: l.textContent, share: Number(l.dataset.playerShare), visible: r.width > 0 && r.top < innerHeight, wide: document.documentElement.scrollWidth > innerWidth };
  });
  check(sheet.label === 'mixed' && /Mixed run · you played \d+%/.test(sheet.text) && sheet.share > 0 && sheet.share < 1 && sheet.visible && !sheet.wide, `the end-of-run scorecard says it was a mixed run ("${sheet.text}")`);
  await shot(page, '03-scorecard-mixed');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('[data-watch-download]')]);
  const file = await dl.path();
  const log = JSON.parse(readFileSync(file, 'utf8'));
  const segs = log.control?.segments ?? [];
  const cmdsC = log.commands.filter((c) => c[1] === 'c');
  check(log.v === 66 && log.control?.mode === 'watch' && log.control.bot === 'you' && log.control.label === 'mixed', `the downloaded log: v${log.v}, mode ${log.control?.mode}, bot ${log.control?.bot}, label ${log.control?.label}`);
  check(
    segs.map((s) => s.by).join() === 'bot,player,bot' && segs[0].fromTick === 0 && segs[1].fromTick === cmdsC[0][0] && segs[2].fromTick === cmdsC[1][0] && segs[2].toTick === log.summary.steps && segs.every((s, i) => !i || s.fromTick === segs[i - 1].toTick),
    `its control segments: bot, then the player from the take-over tick, then the bot from the hand-back (${JSON.stringify(segs)})`,
  );
  const share = (segs[1].toTick - segs[1].fromTick) / log.summary.steps;
  check(Math.abs(log.control.playerShare - share) < 0.002 && log.control.switches === 2 && log.control.playerTicks + log.control.botTicks === log.summary.steps, `the player's share of ticks (${log.control.playerShare}) and two hand-overs`);
  const notes = (log.notes ?? []).map((n) => ({ by: n.by, wave: n.wave, step: n.step }));
  check(notes.length === 2 && notes[0].by === 'bot' && notes[1].by === 'player' && notes.every((n) => n.wave >= 1 && n.step > 0) && notes[1].step >= segs[1].fromTick && notes[1].step <= segs[1].toTick, `each note says who was playing, the wave and the tick (${JSON.stringify(notes)})`);
  const re = await page.evaluate((l) => window.__v3.replay(l), log);
  check(re.steps === log.summary.steps && re.score === log.summary.score && re.lost === log.summary.lost && re.wave === log.summary.wave, `the log replays to the same game, bot and player inputs alike (${JSON.stringify(re)} vs steps ${log.summary.steps}, score ${log.summary.score})`);

  // Save the verdict: the result says how it was played.
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const kept = await page.evaluate(() => {
    const l = JSON.parse(localStorage.getItem('straitwatch.v3.lab.logs') ?? '[]')[0] ?? {};
    return { played: l.labResult?.played, label: l.control?.label };
  });
  check(kept.played === 'mixed' && kept.label === 'mixed', `the saved verdict carries the run's label (${JSON.stringify(kept)})`);
  check(errs.length === 0, `no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
}
