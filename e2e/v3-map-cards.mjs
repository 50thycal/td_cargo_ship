// Test Lab round 10 in the browser (docs/design/v3-map-cards-production.md):
// a map card is the full production map. Expects `vite preview` (or dev) at
// BASE_URL. On a landscape phone (874 x 402), by touch:
// - the hub's map cards say what they play and how they open;
// - The Strait's card, tapped from the hub, starts at wave 1 of 13 with
//   Rush and Disperse on the rail and no Bring one, and an encounter is
//   called out by wave 2-4;
// - its log says it is a full production run, and how it was set up;
// - the setup sheet marks the production setup, Reset returns to it, and
//   the Quick slice (the old short lab run) is still there;
// - Next up and the bare link (?lab=map-harbor) open the same setup.
// Screenshots for the doc go to docs/design/img/map-cards/.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-map-cards.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-map-cards';
const DOC_DIR = process.env.DOC_DIR ?? 'docs/design/img/map-cards';
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOC_DIR, { recursive: true });

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
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const shot = (page, name) => page.screenshot({ path: `${DOC_DIR}/${name}.jpg`, type: 'jpeg', quality: 82 });

/** The run in play, as the tests read it. */
const runState = (page) =>
  page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    return {
      map: g.map.id, wave: g.wave, phase: g.phase, endless: g.endless, freePlay: g.freePlay, plays: g.lab?.setup.plays ?? null, full: g.lab?.full ?? null,
      policy: g.convoy?.setup.policy ?? null, enc: g.enc?.setup.rev ?? null,
      cmds: [...document.querySelectorAll('.v3-command')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.dataset.command),
      bring: vis('[data-lab-bring]'), head: document.querySelector('.v3-lab-bar-head b')?.textContent, count: document.querySelector('.v3-lab-count')?.textContent,
      hud: document.querySelector('.v2-hud')?.textContent,
      log: { firstWave: log.firstWave, freePlay: 'freePlay' in log, lab: log.lab, convoy: log.convoy?.policy ?? null, encounters: log.encounters?.rev ?? null },
    };
  });

/** A run that can't be lost (nobody shoots in this check). */
const tough = (page) => page.evaluate(() => { const g = window.__v3.game(); g.tempo.lossLimit = 999; g.carrierHp = g.stats.carrierHp = 1e6; });

try {
  const page = await browser.newPage(PHONE);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // ---- The hub: the map cards say what they play ----
  await page.tap('[data-lab]');
  await page.waitForSelector('[data-screen="lab"]');
  await page.tap('[data-section="map"] summary');
  await page.locator('[data-card="map-strait"]').scrollIntoViewIfNeeded();
  const hub = await page.evaluate(() => {
    const t = (id) => document.querySelector(`[data-card="${id}"] [data-lab-plays]`)?.textContent;
    return { strait: t('map-strait'), harbor: t('map-harbor'), kesh: t('map-kesh'), blurb: document.querySelector('[data-section="map"] summary i')?.textContent, n: document.querySelectorAll('[data-section="map"] [data-lab-plays]').length };
  });
  check(hub.n === 20 && hub.strait === 'Full map: waves 1–10 and its event ending · Commands: Rush and Disperse · authored encounters' && hub.harbor === 'Full map: waves 1–10 and its event ending · Commands: Hold · authored encounters', `every map card says what it plays and how it opens (${hub.strait} | ${hub.harbor})`);
  check(/^Full map: waves 1–10 and its event ending · Today's convoy controls/.test(hub.kesh ?? ''), `a map with no commands or encounters yet says so ("${hub.kesh}")`);
  await shot(page, 'hub-card');

  // ---- Tap The Strait's card: wave 1, Rush and Disperse, no Bring one ----
  await page.tap('[data-card="map-strait"]');
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => window.__v3.game().ships.length >= 2, null, { timeout: 30000 });
  const s0 = await runState(page);
  check(s0.map === 'strait' && s0.wave === 1 && s0.full && s0.plays === 'full' && !s0.endless && !s0.freePlay, `The Strait's card from the hub starts the full map at wave 1 (${JSON.stringify({ wave: s0.wave, plays: s0.plays, endless: s0.endless, freePlay: s0.freePlay })})`);
  check(s0.policy === 'tactical' && s0.cmds.join() === 'rush,disperse' && s0.enc === 1, `its production setup: Rush and Disperse on the rail, authored encounters on (${s0.cmds.join()}; enc ${s0.enc})`);
  check(!s0.bring && s0.head === 'THE STRAIT' && s0.count === 'full map · wave 1/13' && /WAVE\s*1\/13/.test(s0.hud ?? '') && /TEST LAB/.test(s0.hud ?? ''), `the bar reads "${s0.head} · ${s0.count}", with no Bring one; the HUD says WAVE 1/13 and TEST LAB`);
  check(s0.log.firstWave === 1 && !s0.log.freePlay && s0.log.lab?.plays === 'full' && s0.log.lab?.config?.convoy === 'tactical' && s0.log.lab?.config?.encounters === 1 && s0.log.lab?.config?.production === true && s0.log.convoy === 'tactical' && s0.log.encounters === 1 && !('length' in s0.log.lab), `the log says it is a full production run, and its setup (${JSON.stringify(s0.log.lab)})`);
  await page.waitForTimeout(1500);
  await shot(page, 'strait-wave1-commands');

  // ---- An encounter is called out by wave 2-4 ----
  await tough(page);
  let called = '';
  for (let w = 1; w <= 4 && !called; w++) {
    called = await page.evaluate(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0] ?? '');
    if (called) break;
    await page.evaluate(() => window.__v3.advance(200));
    await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
    await page.waitForTimeout(400);
    if (w === 1) {
      // The campaign's draft after every wave, and Done still in reach over it.
      const d = await page.evaluate(() => {
        const b = document.querySelector('[data-lab-done]').getBoundingClientRect();
        const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('[data-lab-done]');
        const cards = [...document.querySelectorAll('.v2-card')].map((c) => c.getBoundingClientRect());
        return { done: !!top, cards: cards.length, clear: cards.every((c) => c.bottom <= b.top + 1), h2: document.querySelector('.v2-draft h2')?.textContent };
      });
      check(d.done && d.cards >= 3 && d.clear && d.h2 === 'Choose your weapon', `after wave 1 the campaign's draft deals ${d.cards} weapons, and Done is still in reach above it (${JSON.stringify(d)})`);
      await page.screenshot({ path: `${OUT_DIR}/draft-with-bar.png` });
    }
    await page.locator('.v2-card:not([disabled])').first().click();
    await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 8000 });
    called = await page.waitForFunction(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0], null, { timeout: 6000 }).then((h) => h.jsonValue()).catch(() => '');
  }
  const s1 = await runState(page);
  check(!!called && s1.wave >= 2 && s1.wave <= 4 && s1.count === `full map · wave ${s1.wave}/13`, `an encounter is called out on wave ${s1.wave} ("${called}"); the bar reads "${s1.count}"`);

  // ---- The setup sheet: Production setup, Reset, Quick slice ----
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-production]');
  const sh0 = await page.evaluate(() => {
    const p = document.querySelector('[data-lab-production]');
    const on = (k) => [...document.querySelectorAll(`[data-${k}]`)].filter((b) => b.classList.contains('on')).map((b) => b.textContent);
    return { prod: p.dataset.labProduction, text: p.textContent, reset: document.querySelector('[data-lab-reset]').disabled, plays: on('lab-plays'), convoy: on('lab-convoy'), enc: on('lab-encounters'), slice: document.querySelector('.v3-lab-slice').hidden, wave: !!document.querySelector('.v3-lab-wave')?.offsetParent };
  });
  check(sh0.prod === '1' && /^Production setup/.test(sh0.text) && sh0.reset && sh0.plays.join() === 'Full map · 13 waves' && sh0.convoy.join() === 'Commands: Rush and Disperse' && sh0.enc.join() === 'Authored encounters' && sh0.slice && !sh0.wave, `the sheet marks the production setup; the lab's wave, kit, mix and length are folded away (${JSON.stringify(sh0)})`);
  await shot(page, 'setup-production');
  await page.tap('[data-lab-convoy="current"]');
  const sh1 = await page.evaluate(() => ({ prod: document.querySelector('[data-lab-production]').dataset.labProduction, text: document.querySelector('[data-lab-production] b').textContent, reset: document.querySelector('[data-lab-reset]').disabled }));
  check(sh1.prod === '0' && sh1.text === 'Changed from the production setup' && !sh1.reset, `changing the convoy leaves the production setup, and Reset is offered (${JSON.stringify(sh1)})`);
  await page.tap('[data-lab-reset]');
  const sh2 = await page.evaluate(() => ({ prod: document.querySelector('[data-lab-production]').dataset.labProduction, convoy: [...document.querySelectorAll('[data-lab-convoy].on')].map((b) => b.dataset.labConvoy) }));
  check(sh2.prod === '1' && sh2.convoy.join() === 'tactical', `Reset to production setup puts it back in one tap (${JSON.stringify(sh2)})`);
  await page.tap('[data-lab-plays="slice"]');
  const sh3 = await page.evaluate(() => ({ slice: document.querySelector('.v3-lab-slice').hidden, prod: document.querySelector('[data-lab-production]').dataset.labProduction }));
  check(!sh3.slice && sh3.prod === '0', 'the Quick slice shows the lab\'s wave, kit, mix and length, and is not the production setup');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.lab?.setup.plays === 'slice' && !!document.querySelector('.v3-lab-count')?.textContent, null, { timeout: 8000 });
  const s2 = await runState(page);
  check(s2.wave === 5 && s2.endless && s2.freePlay && s2.count === 'quick slice · 1/8' && s2.log.lab?.plays === 'slice' && s2.log.lab?.length === 'full' && s2.log.firstWave === 5, `the Quick slice is the old short lab run, and its log says so (wave ${s2.wave}; "${s2.count}"; ${JSON.stringify(s2.log.lab)})`);
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-reset]');
  await page.tap('[data-lab-reset]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.lab?.setup.plays === 'full', null, { timeout: 8000 });
  const s3 = await runState(page);
  check(s3.wave === 1 && s3.policy === 'tactical' && s3.enc === 1 && s3.log.lab?.config?.production === true, 'Reset from the slice restarts the full map under the production setup');

  // Done: the verdict sheet, then back to the list.
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  const ev = await page.evaluate(() => document.querySelector('.v3-lab-evidence')?.textContent ?? '');
  check(/Full map: 0 of 13 waves cleared/.test(ev), `the verdict sheet counts the full map ("${ev.slice(0, 80)}")`);
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');

  // ---- Next up opens the same setup ----
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-card]')].map((c) => c.dataset.card));
  await page.evaluate((ids) => {
    const p = JSON.parse(localStorage.getItem('straitwatch.v3.lab'));
    const e = { verdict: 'keep', tags: [], note: '', waves: 1, ended: 'done', stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] }, at: '2026-11-13T07:00:00Z', rev: 99, round: 10 };
    for (const id of ids) if (id !== 'map-gauntlet') p.results[id] = [e];
    localStorage.setItem('straitwatch.v3.lab', JSON.stringify(p));
  }, ids);
  await page.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
  await page.tap('[data-lab]');
  await page.waitForSelector('[data-screen="lab"]');
  const next = await page.evaluate(() => document.querySelector('[data-lab-next] small')?.textContent);
  await page.tap('[data-lab-next]');
  await page.waitForSelector('.playing.lab-on');
  const s4 = await runState(page);
  check(next === 'The Gauntlet' && s4.map === 'gauntlet' && s4.wave === 1 && s4.plays === 'full' && s4.policy === 'tactical' && s4.cmds.join() === 'rush,disperse' && s4.enc === 1, `Next up (${next}) opens the full map under its production setup (${JSON.stringify({ wave: s4.wave, policy: s4.policy, cmds: s4.cmds, enc: s4.enc })})`);

  // ---- The bare link ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => document.querySelectorAll('.v3-command').length > 0, null, { timeout: 8000 });
  const s5 = await runState(page);
  check(s5.map === 'harbor' && s5.wave === 1 && s5.plays === 'full' && s5.policy === 'tactical' && s5.cmds.join() === 'hold' && s5.enc === 1 && s5.count === 'full map · wave 1/13', `the bare link v3.html?lab=map-harbor opens the full map with Hold and its encounters (${JSON.stringify({ wave: s5.wave, cmds: s5.cmds, enc: s5.enc, count: s5.count })})`);
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 MAP CARDS E2E FAILED' : 'V3 MAP CARDS E2E PASSED');
