// Test Lab round 10 in the browser (docs/design/v3-map-cards-production.md):
// a map card is the full production map. Expects `vite preview` (or dev) at
// BASE_URL. On a landscape phone (874 x 402), by touch:
// - the hub's map cards say what they play and how they open;
// - The Strait's card, tapped from the hub, starts at wave 1 of 13 with
//   no convoy command on the rail (round 11), nothing of the test over the
//   field (pause-menu round: its name, count and commands are on the pause
//   menu) and no Bring one, and an encounter is called out by wave 2-4;
// - the draft between waves keeps Done in reach;
// - its log says it is a full production run, and how it was set up;
// - the setup sheet marks the production setup, Reset returns to it, and
//   the Quick slice (the old short lab run) is still there;
// - Next up and the bare link (?lab=map-harbor) open the same setup;
// - round 11's scorecard: Done on The Strait shows it above the verdict
//   (no boss row on wave 1), Skip folds it, its chips land in the log
//   (v25, `labResult.score`, `variant: 'v1'`); a lost run on wave 7 offers
//   waves 1-7 and no boss row; a won run offers the boss row and B1-B3.
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
// A run left mid-game by the page before is kept to continue, and starting
// another over it asks first (docs/design/v3-resume-run.md). These checks
// open run after run by link and reload: each page starts with no saved run.
{
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (o) => {
    const c = await newContext(o);
    await c.addInitScript(() => {
      try {
        localStorage.removeItem('straitwatch.v3.run');
      } catch {
        // no storage
      }
    });
    return c;
  };
}
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

/** The test's commands are on the pause menu (pause-menu round): pause, if
 *  the menu isn't up, and wait for them. */
const labMenu = async (page) => {
  // A run just (re)started, or a sheet closing: wait for play, or for a
  // menu or a draft (between a full run's waves) that has Done on it.
  await page.waitForFunction(() => !!document.querySelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done]') || (window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open')), null, { timeout: 15000 });
  if (!(await page.$('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done]'))) await page.evaluate(() => document.querySelector('.v2-pause').click());
  await page.waitForSelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done]');
};

/** The run in play, as the tests read it; the test's name, count and
 *  commands from its pause menu (opened and closed again). */
const runState = async (page) => {
  const bar = await page.evaluate(() => !!document.querySelector('.v3-lab-bar'));
  await labMenu(page);
  const menu = await page.evaluate(() => {
    const vis = (sel) => [...document.querySelectorAll(sel)].some((e) => e.getBoundingClientRect().width > 0);
    const panel = document.querySelector('.v2-pause-panel').getBoundingClientRect();
    const small = [...document.querySelectorAll('.v2-pause-panel button')].map((b) => b.getBoundingClientRect()).filter((r) => r.height < 44).length;
    return { script: !!document.querySelector('.v2-pause-panel .v3-enc-script'), fits: panel.top >= 0 && panel.bottom <= innerHeight && panel.left >= 0 && panel.right <= innerWidth && document.documentElement.scrollWidth <= innerWidth, small, bring: vis('.v2-pause-panel [data-lab-bring]'), head: document.querySelector('.v3-lab-pause-name')?.textContent, count: document.querySelector('.v3-lab-pause-head .v3-lab-count')?.textContent, acts: [...document.querySelectorAll('.v2-pause-panel [data-lab-note], .v2-pause-panel [data-lab-setup], .v2-pause-panel [data-lab-done]')].map((b) => b.dataset.labNote ? 'note' : b.dataset.labSetup ? 'setup' : 'done') };
  });
  await page.evaluate(() => document.querySelector('.v2-pause').click());
  await page.waitForFunction(() => !document.querySelector('.v2-overlay.open'));
  const run = await page.evaluate(() => {
    const g = window.__v3.game();
    const log = window.__v3.log();
    return {
      map: g.map.id, wave: g.wave, phase: g.phase, endless: g.endless, freePlay: g.freePlay, plays: g.lab?.setup.plays ?? null, full: g.lab?.full ?? null,
      policy: g.convoy?.setup.policy ?? null, enc: g.enc?.setup.rev ?? null,
      cmds: [...document.querySelectorAll('.v3-command')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.dataset.command),
      hud: document.querySelector('.v2-hud')?.textContent,
      log: { firstWave: log.firstWave, freePlay: 'freePlay' in log, lab: log.lab, convoy: log.convoy?.policy ?? null, encounters: log.encounters?.rev ?? null },
    };
  });
  return { ...run, ...menu, bar };
};

/** The verdict sheet's scorecard, as the tests read it: its rows, its wave
 *  chips, whether it sits above the verdict row, and any chip under 40 px. */
const scoreSheet = (page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-lab-score]');
    const v = document.querySelector('.v3-lab-v');
    return {
      title: document.querySelector('.v3-lab-verdict h2')?.textContent ?? '',
      rows: [...document.querySelectorAll('[data-score-row]')].map((r) => r.dataset.scoreRow),
      waves: [...document.querySelectorAll('[data-score="best"]')].map((b) => b.textContent),
      above: !!box && !!v && box.getBoundingClientRect().bottom <= v.getBoundingClientRect().top,
      small: [...document.querySelectorAll('.v3-score-chip, [data-score-skip]')].map((b) => b.getBoundingClientRect()).filter((r) => r.width < 40 || r.height < 40).map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`),
    };
  });

/** The newest test log kept on the device, and the card's newest entry. */
const savedRun = (page, card) =>
  page.evaluate((card) => {
    const log = JSON.parse(localStorage.getItem('straitwatch.v3.lab.logs') ?? '[]')[0] ?? {};
    const entry = (JSON.parse(localStorage.getItem('straitwatch.v3.lab') ?? '{}').results?.[card] ?? []).at(-1) ?? {};
    return { v: log.v, end: log.end, verdict: log.labResult?.verdict, score: log.labResult?.score ?? null, variant: log.labResult?.variant, labVariant: log.lab?.variant, entryScore: entry.score ?? null };
  }, card);

/** Clear wave 1 and jump the run to `wave` (its draft says the wave before;
 *  the pick starts it). Only the scorecard's checks use this shortcut. */
const jumpTo = async (page, wave) => {
  await page.evaluate(() => { const g = window.__v3.game(); const [limit, hp] = [g.tempo.lossLimit, g.carrierHp]; g.tempo.lossLimit = 999; g.carrierHp = 1e6; window.__v3.advance(300); g.carrierHp = hp; g.tempo.lossLimit = limit; });
  await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
  await page.evaluate((w) => { window.__v3.game().wave = w - 1; }, wave);
  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction((w) => window.__v3.game()?.phase === 'wave' && window.__v3.game().wave === w, wave, { timeout: 8000 });
};

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
  // Round 12: 20 maps and two more versions of each reference map.
  check(hub.n === 26 && hub.strait === "Full map: waves 1–10 and 3 boss rounds · The map's own convoy (no commands) · encounters v1 Original" && hub.harbor === "Full map: waves 1–10 and 3 boss rounds · The map's own convoy (no commands) · encounters v1 Original", `every map card says what it plays and how it opens (${hub.strait} | ${hub.harbor})`);
  check(/^Full map: waves 1–10 and 3 boss rounds · Today's convoy controls/.test(hub.kesh ?? ''), `a map with no commands or encounters yet says so ("${hub.kesh}")`);
  await shot(page, 'hub-card');

  // ---- Tap The Strait's card: wave 1, no command (round 11), no Bring one ----
  await page.tap('[data-card="map-strait"]');
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => window.__v3.game().ships.length >= 2, null, { timeout: 30000 });
  const s0 = await runState(page);
  check(s0.map === 'strait' && s0.wave === 1 && s0.full && s0.plays === 'full' && !s0.endless && !s0.freePlay, `The Strait's card from the hub starts the full map at wave 1 (${JSON.stringify({ wave: s0.wave, plays: s0.plays, endless: s0.endless, freePlay: s0.freePlay })})`);
  check(s0.policy === 'tactical' && s0.cmds.length === 0 && s0.enc === 3, `its production setup: the map's own convoy with no command (round 11: Rush and Disperse are gone), authored encounters on (${s0.cmds.join()}; enc ${s0.enc})`);
  check(s0.script && s0.fits && s0.small === 0, `the pause menu shows the encounter script with the test's commands, fits the phone and every button is 44 px or more (${JSON.stringify({ script: s0.script, fits: s0.fits, small: s0.small })})`);
  check(!s0.bar && !s0.bring && s0.acts.join() === 'note,setup,done' && s0.head === 'THE STRAIT' && s0.count === 'full map · wave 1/13' && /WAVE\s*1\/13/.test(s0.hud ?? '') && /TEST LAB/.test(s0.hud ?? ''), `no bar over the field; the pause menu reads "${s0.head} · ${s0.count}" with Note, Setup and Done and no Bring one; the HUD says WAVE 1/13 and TEST LAB`);
  check(s0.log.firstWave === 1 && !s0.log.freePlay && s0.log.lab?.plays === 'full' && s0.log.lab?.config?.convoy === 'tactical' && s0.log.lab?.config?.encounters === 3 && s0.log.lab?.config?.production === true && s0.log.convoy === 'tactical' && s0.log.encounters === 3 && !('length' in s0.log.lab), `the log says it is a full production run, and its setup (${JSON.stringify(s0.log.lab)})`);
  await page.waitForTimeout(1500);
  await shot(page, 'strait-wave1-commands');

  // ---- An encounter is called out by wave 1-4 (pause-menu round: with no
  // TESTING card ahead of it, wave 1's shows on wave 1); the draft after
  // wave 1 is checked either way ----
  await tough(page);
  let called = '';
  let calledOn = 0;
  for (let w = 1; w <= 4; w++) {
    called ||= await page.evaluate(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0] ?? '');
    if (called && !calledOn) calledOn = w;
    if (called && w > 1) break;
    await page.evaluate(() => window.__v3.advance(200));
    await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
    await page.waitForTimeout(400);
    if (w === 1) {
      // The campaign's draft after every wave, and Done still in reach on it
      // (in its header: the bar it was on is gone).
      await page.waitForTimeout(500);
      const d = await page.evaluate(() => {
        const b = document.querySelector('.v2-draft [data-lab-done]').getBoundingClientRect();
        const top = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('[data-lab-done]');
        const cards = [...document.querySelectorAll('.v2-card')].map((c) => c.getBoundingClientRect());
        return { done: !!top, h: Math.round(b.height), onScreen: b.top >= 0 && b.bottom <= innerHeight, cards: cards.length, clear: cards.every((c) => c.top >= b.bottom - 1 || c.bottom <= b.top + 1 || c.left >= b.right - 1 || c.right <= b.left + 1), h2: document.querySelector('.v2-draft h2')?.textContent };
      });
      check(d.done && d.h >= 44 && d.onScreen && d.cards >= 3 && d.clear && d.h2 === 'Choose your weapon', `after wave 1 the campaign's draft deals ${d.cards} weapons, and Done is still in reach on it, clear of the cards (${JSON.stringify(d)})`);
      await page.screenshot({ path: `${OUT_DIR}/draft-with-done.png` });
    }
    await page.locator('.v2-card:not([disabled])').first().click();
    await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 8000 });
    if (!called) {
      called = await page.waitForFunction(() => document.body.innerText.match(/ENCOUNTER: [^\n]*/)?.[0], null, { timeout: 6000 }).then((h) => h.jsonValue()).catch(() => '');
      if (called) calledOn = w + 1;
    }
  }
  const s1 = await runState(page);
  check(!!called && calledOn >= 1 && calledOn <= 4 && s1.wave >= 2 && s1.count === `full map · wave ${s1.wave}/13`, `an encounter is called out on wave ${calledOn} ("${called}"); on wave ${s1.wave} the pause menu reads "${s1.count}"`);

  // ---- The setup sheet (from the pause menu): Production setup, Reset,
  // Quick slice ----
  await labMenu(page);
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-production]');
  const sh0 = await page.evaluate(() => {
    const p = document.querySelector('[data-lab-production]');
    const on = (k) => [...document.querySelectorAll(`[data-${k}]`)].filter((b) => b.classList.contains('on')).map((b) => b.textContent);
    return { prod: p.dataset.labProduction, text: p.textContent, reset: document.querySelector('[data-lab-reset]').disabled, plays: on('lab-plays'), convoy: on('lab-convoy'), enc: on('lab-encounters'), slice: document.querySelector('.v3-lab-slice').hidden, wave: !!document.querySelector('.v3-lab-wave')?.offsetParent };
  });
  check(sh0.prod === '1' && /^Production setup/.test(sh0.text) && sh0.reset && sh0.plays.join() === 'Full map · 13 waves' && sh0.convoy.join() === 'Commands (none here)' && sh0.enc.join() === 'Authored encounters' && sh0.slice && !sh0.wave, `the sheet marks the production setup; the lab's wave, kit, mix and length are folded away (${JSON.stringify(sh0)})`);
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
  await page.waitForFunction(() => window.__v3.game()?.lab?.setup.plays === 'slice' && window.__v3.game().phase === 'wave' && !document.querySelector('.v2-overlay.open'), null, { timeout: 8000 });
  const s2 = await runState(page);
  check(s2.wave === 5 && s2.endless && s2.freePlay && s2.count === 'quick slice · 1/8' && s2.log.lab?.plays === 'slice' && s2.log.lab?.length === 'full' && s2.log.firstWave === 5, `the Quick slice is the old short lab run, and its log says so (wave ${s2.wave}; "${s2.count}"; ${JSON.stringify(s2.log.lab)})`);
  await labMenu(page);
  await page.tap('[data-lab-setup]');
  await page.waitForSelector('[data-lab-reset]');
  await page.tap('[data-lab-reset]');
  await page.tap('[data-lab-apply]');
  await page.waitForFunction(() => window.__v3.game()?.lab?.setup.plays === 'full', null, { timeout: 8000 });
  const s3 = await runState(page);
  check(s3.wave === 1 && s3.policy === 'tactical' && s3.enc === 3 && s3.log.lab?.config?.production === true, 'Reset from the slice restarts the full map under the production setup');

  // Done (on the pause menu): the verdict sheet, with the scorecard, then
  // back to the list.
  await labMenu(page);
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  const ev = await page.evaluate(() => document.querySelector('.v3-lab-evidence')?.textContent ?? '');
  check(/Full map: 0 of 13 waves cleared/.test(ev), `the verdict sheet counts the full map ("${ev.slice(0, 80)}")`);
  const sc0 = await scoreSheet(page);
  check(sc0.rows.join() === 'fun,difficulty,pacing,variety,readability,mapFeel,best,weakest,again' && sc0.waves.join() === '1' && sc0.above && sc0.small.length === 0, `the scorecard sits above the verdict, one row per category, no boss row on wave 1, every chip 40 px or more (${JSON.stringify(sc0)})`);
  await page.tap('[data-score-skip]');
  const skipped = await page.evaluate(() => ({ hidden: document.querySelector('.v3-score-rows').hidden, text: document.querySelector('[data-score-skip]').textContent }));
  await page.tap('[data-score-skip]');
  check(skipped.hidden && skipped.text === 'Show it' && (await page.evaluate(() => !document.querySelector('.v3-score-rows').hidden)), 'Skip folds the scorecard away, and Show it brings it back');
  for (const [row, v] of [['fun', '4'], ['difficulty', 'bit-hard'], ['pacing', 'right'], ['readability', '2'], ['best', '1'], ['again', 'maybe'], ['variety', '3'], ['variety', '3']]) await page.tap(`[data-score="${row}"][data-value="${v}"]`);
  const on = await page.evaluate(() => [...document.querySelectorAll('.v3-score-chip.on')].map((b) => `${b.dataset.score}=${b.dataset.value}`));
  check(on.join() === 'fun=4,difficulty=bit-hard,pacing=right,readability=2,best=1,again=maybe', `a tap answers a row and a second tap clears it (${on.join()})`);
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const saved = await savedRun(page, 'map-strait');
  check(saved.v === 25 && JSON.stringify(saved.score) === JSON.stringify({ rev: 1, fun: 4, difficulty: 'bit-hard', pacing: 'right', readability: 2, best: 1, again: 'maybe' }) && saved.variant === 'v1' && saved.labVariant === 'v1' && JSON.stringify(saved.entryScore) === JSON.stringify(saved.score), `the scorecard lands in the log (v${saved.v}, ${JSON.stringify(saved.score)}, variant ${saved.variant}) and on the device`);

  // ---- A lost run on wave 7: waves 1-7, no boss row; Skip saves none ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-strait&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await jumpTo(page, 7);
  await page.evaluate(() => { const g = window.__v3.game(); g.carrierHp = 0; window.__v3.advance(1); });
  await page.waitForSelector('[data-screen="lab-verdict"]', { timeout: 10000 });
  const sc1 = await scoreSheet(page);
  check(/the convoy was lost/.test(sc1.title) && !sc1.rows.includes('boss') && sc1.waves.join() === '1,2,3,4,5,6,7' && sc1.small.length === 0, `a run lost on wave 7: "${sc1.title}", wave chips ${sc1.waves.join(' ')}, no boss row`);
  await page.tap('[data-score="fun"][data-value="2"]');
  await page.tap('[data-score-skip]');
  await page.tap('[data-lab-verdict="tune"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const lost = await savedRun(page, 'map-strait');
  check(lost.end === 'lost' && lost.score === null && lost.verdict === 'tune', `a skipped scorecard saves no score (end ${lost.end}, score ${JSON.stringify(lost.score)})`);

  // ---- A won run: the boss row and B1-B3 ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-strait&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await tough(page);
  await jumpTo(page, 11);
  for (let i = 0; i < 6 && !(await page.$('[data-screen="lab-verdict"]')); i++) {
    await page.evaluate(() => window.__v3.advance(300));
    await page.waitForTimeout(300);
    if (await page.$('[data-screen="draft"]')) await page.locator('.v2-card:not([disabled])').first().click();
  }
  await page.waitForSelector('[data-screen="lab-verdict"]', { timeout: 10000 });
  const sc2 = await scoreSheet(page);
  check(/map cleared/.test(sc2.title) && sc2.rows.includes('boss') && sc2.waves.slice(9).join() === '10,B1,B2,B3' && sc2.small.length === 0, `a won run: "${sc2.title}", the boss row, and wave chips ${sc2.waves.join(' ')}`);
  for (const [row, v] of [['boss', '5'], ['best', '12'], ['weakest', '3']]) await page.tap(`[data-score="${row}"][data-value="${v}"]`);
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const won = await savedRun(page, 'map-strait');
  check(won.end === 'won' && JSON.stringify(won.score) === JSON.stringify({ rev: 1, boss: 5, best: 12, weakest: 3 }), `a won run's boss score lands in the log (${JSON.stringify(won.score)})`);

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
  check(next === 'The Gauntlet' && s4.map === 'gauntlet' && s4.wave === 1 && s4.plays === 'full' && s4.policy === 'tactical' && s4.cmds.length === 0 && s4.enc === 3, `Next up (${next}) opens the full map under its production setup (${JSON.stringify({ wave: s4.wave, policy: s4.policy, cmds: s4.cmds, enc: s4.enc })})`);

  // ---- The bare link ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => !!document.querySelector('.v3-convoy-auto'), null, { timeout: 8000 });
  const s5 = await runState(page);
  check(s5.map === 'harbor' && s5.wave === 1 && s5.plays === 'full' && s5.policy === 'tactical' && s5.cmds.length === 0 && s5.enc === 3 && s5.count === 'full map · wave 1/13', `the bare link v3.html?lab=map-harbor opens the full map with its encounters and no Hold (round 11) (${JSON.stringify({ wave: s5.wave, cmds: s5.cmds, enc: s5.enc, count: s5.count })})`);
  // Round 11: Hold is on Sowers' Reach, where mines drift across the lane.
  await page.goto(`${BASE_URL}/v3.html?lab=map-sowers&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => document.querySelectorAll('.v3-command').length > 0, null, { timeout: 8000 });
  const s6 = await runState(page);
  check(s6.map === 'sowers' && s6.wave === 1 && s6.plays === 'full' && s6.policy === 'tactical' && s6.cmds.join() === 'hold' && s6.enc === null, `the bare link v3.html?lab=map-sowers opens the full map with Hold (${JSON.stringify({ wave: s6.wave, cmds: s6.cmds, enc: s6.enc, count: s6.count })})`);
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 MAP CARDS E2E FAILED' : 'V3 MAP CARDS E2E PASSED');
