// The in-game touch keyboard (palate-keys) in a landscape iPhone, with real
// touch input: the pause menu's note box takes it instead of the phone's,
// the dialog fits above it, the hotkeys and swipe-up work, and the note
// lands in the log.
//
// Usage:  npm run dev -- --port 5173 &  BASE_URL=http://localhost:5173 npm run e2e:v3:keys

import { chromium, devices } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3-keys';
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

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'], serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    try {
      localStorage.removeItem('straitwatch.v3.run');
    } catch {
      // no storage
    }
  });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => fail(`page error: ${err.message}`));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });

  await page.waitForSelector('[data-screen="menu"]');
  await page.tap('[data-map="strait"]');
  await page.waitForSelector('[data-screen="loadout"]');
  await page.tap('[data-start]');
  await page.waitForSelector('.playing');
  await page.waitForTimeout(1500);
  await page.tap('.v2-pause');
  await page.tap('.v3-pause-note');
  await page.waitForSelector('.v3-note-text');

  const field = () => page.evaluate(() => {
    const t = document.querySelector('.v3-note-text');
    return { value: t.value, inputmode: t.getAttribute('inputmode'), pk: t.hasAttribute('data-pk'), set: t.dataset.pkHotkeys };
  });
  const f0 = await field();
  check(f0.pk && f0.inputmode === 'none' && f0.set === 'note', `the note box takes the in-app keyboard (${JSON.stringify(f0)})`);

  await page.tap('.v3-note-text');
  await page.waitForSelector('.pk.pk-visible');
  await page.waitForTimeout(500);

  const layout = await page.evaluate(() => {
    const pk = document.querySelector('.pk').getBoundingClientRect();
    const box = document.querySelector('.v3-note-text').getBoundingClientRect();
    const save = document.querySelector('.v3-note-save').getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    return {
      vh: innerHeight, kbTop: Math.round(pk.top), kbH: Math.round(pk.height), cssKb: cs.getPropertyValue('--kb-h'),
      boxBottom: Math.round(box.bottom), boxH: Math.round(box.height), saveBottom: Math.round(save.bottom),
      typing: !!document.querySelector('.typing'), vv: document.querySelector('.typing, #app')?.style.getPropertyValue('--vv-h'),
    };
  });
  console.log('layout', JSON.stringify(layout));
  check(layout.typing, 'typing mode is on');
  check(layout.kbH < layout.vh * 0.62, `the keyboard leaves room: ${layout.kbH}px of ${layout.vh}px`);
  check(layout.boxBottom <= layout.kbTop && layout.saveBottom <= layout.kbTop, `the note box and Save sit above the keyboard (box ${layout.boxBottom}, save ${layout.saveBottom}, keyboard ${layout.kbTop})`);
  check(layout.boxH >= 30, `the note box is tall enough to read (${layout.boxH}px)`);
  await page.screenshot({ path: `${SHOT_DIR}/01-typing.png` });

  const key = (label) => page.evaluate((label) => {
    const k = [...document.querySelectorAll('.pk-key')].find((el) =>
      (label === 'bs' && el.classList.contains('pk-key-backspace')) || el.querySelector('.pk-key-label').textContent.trim().toLowerCase() === label.toLowerCase());
    if (!k) return null;
    const r = k.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, label);
  const tapKey = async (label) => {
    const p = await key(label);
    if (!p) throw new Error(`no key ${label}`);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(40);
  };
  const swipeUp = async (label, id) => {
    const p = await key(label);
    await page.evaluate(({ x, y, id }) => {
      const el = document.querySelector('.pk-rows');
      const ev = (t, f) => el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: x, clientY: y - 36 * f }));
      ev('pointerdown', 0);
      for (let i = 1; i <= 10; i++) ev('pointermove', i / 10);
      ev('pointerup', 1);
    }, { ...p, id });
    await page.waitForTimeout(60);
  };

  const setText = (v) => page.evaluate((v) => {
    const t = document.querySelector('.v3-note-text');
    t.value = v;
    t.setSelectionRange(v.length, v.length);
    t.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  const keyLabels = () => page.$$eval('.pk-row-hot .pk-key-label', (els) => els.map((e) => e.textContent.trim()));

  // The note strip: what the player writes most, from their own notes.
  check(JSON.stringify(await keyLabels()) === JSON.stringify(['🎤', '✓ Fix', 'Note', 'Make', 'Fun', 'Overlap', 'Audit', 'Hard']), `the note hotkeys (${(await keyLabels()).join(' ')})`);

  await tapKey('Hard');
  await tapKey('Make');
  await tapKey('t');
  await tapKey('h');
  await tapKey('e');
  await tapKey('space');
  await swipeUp('q', 21); // swipe up on a letter: its digit
  const f1 = await field();
  check(/^Hard but doable\. Make sure the 1$/i.test(f1.value), `hotkeys and keys typed into the note (${JSON.stringify(f1.value)})`);
  await swipeUp('Fun', 22);
  const f2 = await field();
  check(f2.value.endsWith('That was a clutch moment. '), `swipe up on a hotkey gives its alternate (${JSON.stringify(f2.value.slice(-26))})`);

  // Suggestions follow the player's own phrasing: after "good", "overall".
  await setText('');
  for (const ch of 'good ') await tapKey(ch === ' ' ? 'space' : ch);
  await page.waitForTimeout(250);
  const preds = await page.$$eval('.pk-pred', (els) => els.map((e) => e.textContent.trim()));
  check(preds.includes('overall'), `after "good", the bar offers "overall" (${preds.join(' | ')})`);

  // The Fix key: typos and dictation mishears in one tap.
  await setText('The missle did damange to Dual weld, cna you see it');
  await tapKey('✓ Fix');
  await page.waitForTimeout(100);
  check((await field()).value === 'The missile did damage to Dual Wield, can you see it', `the Fix key corrects the note (${JSON.stringify((await field()).value)})`);
  await page.evaluate(() => document.execCommand('undo'));
  check((await field()).value.startsWith('The missle'), 'a fix is one undo step');

  // The game's words are not "corrected"; the keyboard's undo/return are untouched.
  await setText('');
  for (const ch of 'torpedo frigate ') await tapKey(ch === ' ' ? 'space' : ch);
  check((await field()).value.toLowerCase() === 'torpedo frigate ', `game words survive autocorrect (${JSON.stringify((await field()).value)})`);
  await page.screenshot({ path: `${SHOT_DIR}/02-typed.png` });

  // Save: the note lands in the log, the dialog closes and the keyboard goes.
  await page.tap('.v3-note-save');
  await page.waitForTimeout(500);
  const noted = await page.evaluate(() => window.__v3.log().notes?.at(-1));
  check(!!noted && /torpedo/i.test(noted.text ?? ''), `the note reaches the log (${JSON.stringify(noted?.text)})`);
  check(!(await page.evaluate(() => document.querySelector('.pk').classList.contains('pk-visible'))), 'the keyboard goes when the dialog closes');
  check((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kb-h').trim())) === '0px', '--kb-h is back to 0');
  check(!(await page.evaluate(() => !!document.querySelector('.typing'))), 'typing mode is off');
  await page.screenshot({ path: `${SHOT_DIR}/03-after.png` });

  // A Test Lab verdict note box gets the verdict strip.
  const verdict = await page.evaluate(async () => {
    const box = document.createElement('textarea');
    box.className = 'v3-lab-note';
    document.querySelector('#app').append(box);
    await new Promise((r) => setTimeout(r, 50));
    const set = box.dataset.pkHotkeys;
    box.remove();
    return set;
  });
  check(verdict === 'verdict', `a Test Lab note box takes the verdict keys (${verdict})`);

  // Desktop keeps its real keyboard.
  const desk = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await desk.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  await desk.waitForTimeout(300);
  check(await desk.evaluate(() => !document.querySelector('.pk.pk-visible')), 'desktop: no on-screen keyboard until a note box is focused');
  await desk.close();
} catch (err) {
  fail(String(err?.stack ?? err));
} finally {
  await browser.close();
}
if (!process.exitCode) console.log('v3 keys e2e: all checks passed');
