// The Test Lab's Tools round (docs/design/v3-playtest-fixes.md): the hub is
// Ready to test and the rebuilt maps by chapter, nothing else; Tools is a
// sheet over it with the Armory, call-outs, logs and Map Analytics; the
// Armory editor opens from Tools and Back returns to Tools. On a landscape
// phone (874 x 402, DPR 2), by touch. Screenshots go to OUT_DIR as
// tools-*.png. Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-lab-tools.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-lab-tools';
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

let failed = 0;
function check(ok, msg) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!ok) failed++;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

try {
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.tap('[data-lab]');
  await page.waitForSelector('[data-screen="lab"]');
  await page.waitForTimeout(400);

  // ---- The hub: only the new tests ----
  const hub = await page.evaluate(() => ({
    ready: document.querySelectorAll('[data-ready]').length,
    notes: document.querySelectorAll('[data-ready-notes]').length,
    maps: document.querySelectorAll('[data-section="map"] [data-card]').length,
    cards: document.querySelectorAll('[data-card]').length,
    info: document.querySelectorAll('[data-map-notes]').length,
    old: document.querySelectorAll('[data-section="event"], [data-section="enemy"], [data-section="weapon"], [data-section="combo"], .v3-lab-sec, .v3-lab-row, [data-lab-next], [data-lab-five], [data-lab-length], .v3-lab-round').length,
    armory: document.querySelectorAll('[data-lab-armory], [data-ready-armory], .v3-lab-arm, .v3-ready-arm').length,
    sheet: !!document.querySelector('[data-lab-tools]')?.hidden,
    scroll: document.querySelector('.v2-panel.v3-lab').scrollHeight,
  }));
  check(hub.ready > 0 && hub.notes === hub.ready && hub.maps === 26 && hub.cards === 26 && hub.info === 20, `the hub shows Ready to test (${hub.ready}, each with Notes) and the 20 maps by chapter (26 cards, an "i" each) (${JSON.stringify(hub)})`);
  check(hub.old === 0, 'no old testing on the hub: no event, enemy, weapon or combo cards, Next up, Play 5, length or round tally');
  check(hub.armory === 0, 'no Armory button on a chapter row or a Ready card');
  check(hub.sheet, 'Tools starts closed');
  await page.screenshot({ path: `${OUT_DIR}/tools-hub.png` });

  // ---- Tools opens in place ----
  const before = await page.evaluate(() => document.querySelector('.v2-panel.v3-lab').scrollTop);
  await page.tap('[data-lab-tools-open]');
  await page.waitForSelector('[data-lab-tools]:not([hidden])');
  await page.waitForTimeout(250);
  const tools = await page.evaluate(() => {
    const sheet = document.querySelector('[data-lab-tools]');
    const panel = sheet.querySelector('.v3-lab-tools-panel').getBoundingClientRect();
    const small = [...sheet.querySelectorAll('button, a')].filter((b) => b.getBoundingClientRect().height < 34).map((b) => b.textContent);
    return {
      scrollTop: document.querySelector('.v2-panel.v3-lab').scrollTop,
      fits: panel.top >= 0 && panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth,
      entries: [...sheet.querySelectorAll('.v3-tool-text > b')].map((b) => b.textContent),
      callouts: [...sheet.querySelectorAll('[data-lab-callouts]')].map((b) => `${b.dataset.labCallouts}${b.classList.contains('on') ? '*' : ''}`).join(),
      download: sheet.querySelector('[data-lab-download]').disabled,
      expanded: document.querySelector('[data-lab-tools-open]').getAttribute('aria-expanded'),
      small,
    };
  });
  check(tools.scrollTop === before && tools.fits, `Tools opens in place over the hub, not by scrolling, and fits the phone (${JSON.stringify({ scrollTop: tools.scrollTop, fits: tools.fits })})`);
  check(tools.entries.join() === 'Armory,Call-outs,Session report,Send logs now,Download last log,Map Analytics,Feedback page ↗', `its entries: ${tools.entries.join(', ')}`);
  check(tools.callouts === 'all*,essential,off' && tools.download && tools.expanded === 'true', `Call-outs (All on), Download greyed with no test yet (${JSON.stringify(tools)})`);
  check(tools.small.length === 0, `every Tools button is thumb-sized (${tools.small.join(', ')})`);
  await page.screenshot({ path: `${OUT_DIR}/tools-panel.png` });

  // Call-outs is the game's own setting.
  await page.tap('[data-lab-callouts="essential"]');
  check((await page.evaluate(() => localStorage.getItem('straitwatch.v3.callouts'))) === 'essential', 'Call-outs in Tools saves the game setting');
  await page.tap('[data-lab-callouts="all"]');

  // ✕ closes it; the key opens it again.
  await page.tap('[data-lab-tools-close]');
  check(await page.evaluate(() => document.querySelector('[data-lab-tools]').hidden), '✕ closes Tools');
  await page.tap('[data-lab-tools-open]');
  await page.mouse.click(10, 200);
  check(await page.evaluate(() => document.querySelector('[data-lab-tools]').hidden), 'a tap outside closes Tools');
  await page.tap('[data-lab-tools-open]');

  // ---- The Armory, from Tools ----
  await page.tap('[data-lab-tools-armory]');
  await page.waitForSelector('[data-screen="labarmory"]');
  const arm = await page.evaluate(() => ({ tabs: document.querySelectorAll('[data-lab-armory-chapter]').length, bays: document.querySelectorAll('.v3-lab-bay').length, auto: document.querySelectorAll('[data-lab-level="auto"].on').length }));
  check(arm.tabs === 4 && arm.bays === 3 && arm.auto === 3, `the Armory editor opens from Tools with its chapter tabs, three bays and Auto (${JSON.stringify(arm)})`);
  await page.tap('[data-lab-armory-chapter="2"]');
  await page.tap('.v3-lab-bay[data-bay="gun"] [data-lab-level]:not([data-lab-level="auto"])');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT_DIR}/tools-armory.png` });
  await page.tap('[data-back]');
  await page.waitForSelector('[data-lab-tools]:not([hidden])');
  const back = await page.evaluate(() => ({ screen: document.querySelector('.v2-overlay').dataset.screen, open: !document.querySelector('[data-lab-tools]').hidden, line: document.querySelector('[data-lab-tools-armory] small')?.textContent }));
  check(back.screen === 'lab' && back.open && /set for ch 2$/.test(back.line ?? ''), `Back from the Armory is the hub with Tools open, the change shown (${JSON.stringify(back)})`);
  await page.tap('[data-lab-tools-close]');

  // ---- A map's notes: the Armory in one line, read only ----
  await page.tap('[data-map-notes="island"]');
  await page.waitForSelector('[data-map-notes-sheet="island"]');
  const notes = await page.evaluate(() => {
    const a = document.querySelector('[data-notes-armory]');
    return { state: a?.dataset.notesArmory, lines: a ? Math.round(a.getBoundingClientRect().height) : 0, buttons: a?.querySelectorAll('button').length, edit: !!document.querySelector('[data-notes-armory-edit]'), text: a?.textContent };
  });
  check(notes.state === 'set' && notes.lines <= 26 && notes.buttons === 0 && !notes.edit, `a map's notes show its Armory in one read-only line (${JSON.stringify(notes)})`);
  await page.tap('[data-back]');
  await page.waitForSelector('[data-screen="lab"]');

  // ---- An old card's link still opens headless ----
  await page.goto(`${BASE_URL}/v3.html?lab=diveBomber&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  check((await page.evaluate(() => window.__v3.game().lab?.setup.card)) === 'diveBomber', 'an old card\'s ?lab= link still opens its test');

  check(errs.length === 0, `no page errors${errs.length ? `: ${errs[0]}` : ''}`);
} catch (e) {
  console.error(e);
  failed++;
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
