// Test Lab round 10 in the browser (docs/design/v3-map-cards-production.md):
// a map card is the full production map. Expects `vite preview` (or dev) at
// BASE_URL. On a landscape phone (874 x 402), by touch:
// - the hub's map cards say what they play and how they open;
// - The Strait's card, tapped from the hub, starts at wave 1 of 10 with
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
//   (v28, `labResult.score`, `variant: 'v1'`); a lost run on wave 7 offers
//   waves 1-7 and no boss row; a won run offers the boss row and B1-B3.
// - scorecard revision 2 (2026-11-17): Pacing, Variety, Readability and Map
//   feel are no longer asked; the wave rows are a strip (ships lost and the
//   moments marked in each wave); "Your last scores" shows this map's last
//   score and the other map cards' (seeded for The Gauntlet), and the row
//   "Compared with The Gauntlet" saves `vs` and `vsCard`.
// - scorecard revision 4 (docs/design/v3-rate-and-review.md): the end
//   screen is the normal game's "Rate & review this run" with a Test Lab
//   section: the rating rows (Fun, Difficulty, Intensity ...), the run's
//   timeline with its moments, Watch it and Note on this, Best and Weakest
//   wave under it, then the verdict. Best moment is gone. Waves rated on
//   the draft ("Rate wave N") show on the timeline and suggest Best and
//   Weakest wave; the score keeps them (`waves`, `bestSuggested`, ...).
// Screenshots for the doc go to docs/design/img/map-cards/.
// Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/v3-map-cards.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT_DIR = process.env.OUT_DIR ?? 'e2e/shots/v3-map-cards';
const DOC_DIR = process.env.DOC_DIR ?? 'docs/design/img/map-cards';
// Rate & review's screenshots for the player (docs/design/v3-rate-and-review.md).
const RR_DIR = process.env.RR_DIR ?? 'docs/design/img/rate-review';
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(DOC_DIR, { recursive: true });
mkdirSync(RR_DIR, { recursive: true });

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
  await page.waitForFunction(() => !!document.querySelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]') || (window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open')), null, { timeout: 15000 });
  if (!(await page.$('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]'))) await page.evaluate(() => document.querySelector('.v2-pause').click());
  await page.waitForSelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]');
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
      title: document.querySelector('.v3-lab-verdict .v3-review-title')?.textContent ?? '',
      rows: [...document.querySelectorAll('[data-score-row]')].map((r) => r.dataset.scoreRow),
      waves: [...document.querySelectorAll('[data-score="best"]')].map((b) => b.querySelector('.v3-wave-n')?.textContent ?? b.textContent),
      // The strip: every wave chip (both rows) says what happened in it.
      strip: [...document.querySelectorAll('[data-score="best"], [data-score="weakest"]')].every((b) => !!b.querySelector('.v3-wave-info') && b.dataset.lost !== undefined),
      moment: !!document.querySelector('[data-score="moment"]'),
      // One screen, in the normal review's order: the rating rows, the run
      // (timeline, its legend, the selected moment; Best and Weakest under
      // it), then the Test Lab section.
      order: [...document.querySelectorAll('.v3-lab-verdict > *')].map((e) => (e.matches('[data-lab-score]') ? 'score' : e.matches('[data-review-run]') ? 'run' : e.matches('[data-lab-section]') ? 'lab' : e.matches('.v3-lab-sheet-acts') ? 'acts' : e.matches('.v3-review-title') ? 'title' : '')).filter(Boolean).join(),
      timeline: !!document.querySelector('[data-review-run] .v3-timeline') && !!document.querySelector('[data-review-run] .v3-tl-legend') && !!document.querySelector('[data-review-run] .v3-stop'),
      wavesInRun: !!document.querySelector('[data-review-run] [data-score-waves] [data-score-row="best"]'),
      bands: [...document.querySelectorAll('.v3-tl-wave[data-wave]')].map((b) => `${b.dataset.wave}${b.dataset.waveRating ? `:${b.dataset.waveRating}` : ''}${b.classList.contains('best') ? '^' : b.classList.contains('weakest') ? 'v' : ''}`),
      lostSum: [...document.querySelectorAll('[data-score="best"]')].reduce((m, b) => m + Number(b.dataset.lost ?? 0), 0),
      last: [...document.querySelectorAll('[data-score-last-card]')].map((l) => l.dataset.scoreLastCard),
      lastText: [...document.querySelectorAll('[data-score-last-card]')].map((l) => l.textContent),
      vs: document.querySelector('[data-score-row="vs"] .v3-score-lab b')?.textContent ?? null,
      wide: document.documentElement.scrollWidth > innerWidth,
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

/** Rate the wave just played on its "Rate wave N" screen (before the
 *  draft since the 2026-11-20 playtest). */
const rateWave = async (page, axes) => {
  for (const [axis, n] of Object.entries(axes)) await page.tap(`[data-screen="rate"] [data-wave-rate] [data-axis="${axis}"] [data-n="${n}"]`);
};

/** From a wave's end to its draft: the rating screen (`axes` to rate on
 *  it, then Next; else Skip), if it comes. */
const pastRate = async (page, axes) => {
  await page.waitForSelector('[data-screen="draft"], [data-screen="rate"]', { timeout: 20000 });
  if (await page.$('[data-screen="rate"]')) {
    if (axes) await rateWave(page, axes);
    await page.tap(axes ? '[data-rate-next]' : '[data-rate-skip]');
  }
  await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
};

/** Clear wave 1 and jump the run to `wave` (its draft says the wave before;
 *  the pick starts it). Only the scorecard's checks use this shortcut.
 *  `rate1`: rate wave 1 on its draft first. */
const jumpTo = async (page, wave, rate1) => {
  await page.evaluate(() => { const g = window.__v3.game(); const [limit, hp] = [g.tempo.lossLimit, g.carrierHp]; g.tempo.lossLimit = 999; g.carrierHp = 1e6; window.__v3.advance(300); g.carrierHp = hp; g.tempo.lossLimit = limit; });
  await pastRate(page, rate1);
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
  // The UI overhaul: the maps are a grid always in view (no summary to open).
  await page.locator('[data-card="map-strait"]').scrollIntoViewIfNeeded();
  const hub = await page.evaluate(() => {
    const t = (id) => document.querySelector(`[data-card="${id}"] [data-lab-plays]`)?.textContent;
    return { strait: t('map-strait'), harbor: t('map-harbor'), kesh: t('map-kesh'), marrow: t('map-marrow'), island: t('map-island'), behemoth: t('map-behemoth'), needle: t('map-needle'), archipelago: t('map-archipelago'), saltgate: t('map-saltgate'), battery: t('map-battery'), blurb: document.querySelector('[data-section="map"] summary i')?.textContent, n: document.querySelectorAll('[data-section="map"] [data-lab-plays]').length };
  });
  // Round 12: 20 maps and two more versions of each reference map.
  check(hub.n === 26 && hub.strait === "Full map: waves 1–10 and 3 boss rounds · The map's own convoy (no commands) · encounters v1 Original" && hub.harbor === "Full map: waves 1–10 and 3 boss rounds · The map's own convoy (no commands) · encounters v1 Original", `every map card says what it plays and how it opens (${hub.strait} | ${hub.harbor})`);
  // Chapter 1 (docs/design/v3-ch1-kesh.md, v3-ch1-marrow.md): Kesh and
  // Marrow open with their encounters, as the reference maps do (v1 only).
  const enc1 = "Full map: waves 1–10 and 3 boss rounds · The map's own convoy (no commands) · encounters v1 Original";
  check(hub.kesh === enc1 && hub.marrow === enc1, `Kesh and Marrow say they open with their encounters (${hub.kesh} | ${hub.marrow})`);
  // Chapter 2 (docs/design/v3-ch2-island.md, v3-ch2-behemoth.md): the
  // Island and the Behemoth Run too.
  check(hub.island === enc1 && hub.behemoth === enc1, `the Island and the Behemoth Run say they open with their encounters (${hub.island} | ${hub.behemoth})`);
  // The Needle of Bosk (docs/design/v3-ch2-needle.md): the same.
  check(hub.needle === enc1, `the Needle of Bosk says it opens with its encounters (${hub.needle})`);
  // The Archipelago (docs/design/v3-ch2-archipelago.md): the same.
  check(hub.archipelago === enc1, `the Archipelago says it opens with its encounters (${hub.archipelago})`);
  // Saltgate Canal (docs/design/v3-ch2-saltgate.md): the same.
  check(hub.saltgate === enc1, `Saltgate Canal says it opens with its encounters (${hub.saltgate})`);
  check(/^Full map: waves 1–10 and 3 boss rounds · Today's convoy controls/.test(hub.battery ?? ''), `a map with no commands or encounters yet says so ("${hub.battery}")`);
  await shot(page, 'hub-card');

  // ---- Tap The Strait's card: wave 1, no command (round 11), no Bring one ----
  await page.tap('[data-card="map-strait"]');
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => window.__v3.game().ships.length >= 2, null, { timeout: 30000 });
  const s0 = await runState(page);
  check(s0.map === 'strait' && s0.wave === 1 && s0.full && s0.plays === 'full' && !s0.endless && !s0.freePlay, `The Strait's card from the hub starts the full map at wave 1 (${JSON.stringify({ wave: s0.wave, plays: s0.plays, endless: s0.endless, freePlay: s0.freePlay })})`);
  check(s0.policy === 'tactical' && s0.cmds.length === 0 && s0.enc === 4, `its production setup: the map's own convoy with no command (round 11: Rush and Disperse are gone), authored encounters on (${s0.cmds.join()}; enc ${s0.enc})`);
  check(s0.script && s0.fits && s0.small === 0, `the pause menu shows the encounter script with the test's commands, fits the phone and every button is 44 px or more (${JSON.stringify({ script: s0.script, fits: s0.fits, small: s0.small })})`);
  check(!s0.bar && !s0.bring && s0.acts.join() === 'note,setup,done' && s0.head === 'THE STRAIT' && s0.count === 'full map · wave 1 of 10' && /WAVE\s*1 of 10/.test(s0.hud ?? '') && /TEST LAB/.test(s0.hud ?? ''), `no bar over the field; the pause menu reads "${s0.head} · ${s0.count}" with Note, Setup and Done and no Bring one; the HUD says WAVE 1 of 10 and TEST LAB`);
  check(s0.log.firstWave === 1 && !s0.log.freePlay && s0.log.lab?.plays === 'full' && s0.log.lab?.config?.convoy === 'tactical' && s0.log.lab?.config?.encounters === 4 && s0.log.lab?.config?.production === true && s0.log.convoy === 'tactical' && s0.log.encounters === 4 && !('length' in s0.log.lab), `the log says it is a full production run, and its setup (${JSON.stringify(s0.log.lab)})`);
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
    await pastRate(page);
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
  check(!!called && calledOn >= 1 && calledOn <= 4 && s1.wave >= 2 && s1.count === `full map · wave ${s1.wave} of 10`, `an encounter is called out on wave ${calledOn} ("${called}"); on wave ${s1.wave} the pause menu reads "${s1.count}"`);

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
  check(s3.wave === 1 && s3.policy === 'tactical' && s3.enc === 4 && s3.log.lab?.config?.production === true, 'Reset from the slice restarts the full map under the production setup');

  // Done (on the pause menu): the verdict sheet, with the scorecard, then
  // back to the list.
  await labMenu(page);
  await page.tap('[data-lab-done]');
  await page.waitForSelector('[data-screen="lab-verdict"]');
  const ev = await page.evaluate(() => document.querySelector('.v3-lab-evidence')?.textContent ?? '');
  check(/Full map: 0 of 10 waves cleared/.test(ev), `the verdict sheet counts the full map ("${ev.slice(0, 80)}")`);
  const sc0 = await scoreSheet(page);
  check(sc0.rows.join() === 'fun,difficulty,intensity,again,effort,best,weakest' && !sc0.moment && sc0.waves.join() === '1' && sc0.strip && sc0.above && sc0.small.length === 0 && !sc0.wide, `the scorecard (revision 4) sits above the verdict: Fun, Difficulty, Intensity, Play again, Effort and the wave strips (Best, Weakest), no Best moment, no Pacing, Variety, Readability or Map feel, no boss row on wave 1, every chip 40 px or more (${JSON.stringify(sc0)})`);
  check(/^Rate & review this run/.test(sc0.title) && /The Strait/.test(sc0.title) && sc0.order === 'title,score,run,lab,acts' && sc0.timeline && sc0.wavesInRun, `one screen, the normal game's review with a Test Lab section: "${sc0.title}", ${sc0.order}; the run's timeline, legend and moment, with Best and Weakest under it`);
  check(sc0.last.length === 0 && sc0.vs === null, `nothing scored before: no last scores and no comparison row (${JSON.stringify({ last: sc0.last, vs: sc0.vs })})`);
  await page.tap('[data-score-skip]');
  const skipped = await page.evaluate(() => ({ hidden: document.querySelector('.v3-score-rows').hidden, text: document.querySelector('[data-score-skip]').textContent }));
  await page.tap('[data-score-skip]');
  check(skipped.hidden && skipped.text === 'Show it' && (await page.evaluate(() => !document.querySelector('.v3-score-rows').hidden)), 'Skip folds the scorecard away, and Show it brings it back');
  for (const [row, v] of [['fun', '4'], ['difficulty', 'bit-hard'], ['intensity', '5'], ['best', '1'], ['again', 'maybe'], ['effort', '2'], ['weakest', '1'], ['weakest', '1']]) await page.tap(`[data-score="${row}"][data-value="${v}"]`);
  const on = await page.evaluate(() => [...document.querySelectorAll('.v3-score-chip.on')].map((b) => `${b.dataset.score}=${b.dataset.value}`));
  check(on.join() === 'fun=4,difficulty=bit-hard,intensity=5,again=maybe,effort=2,best=1', `a tap answers a row and a second tap clears it; a tap on the Best row's strip answers Best only (${on.join()})`);
  // A pick marks its wave's band on the timeline.
  check((await scoreSheet(page)).bands.join() === '1^', `Best wave 1 is marked on the timeline's band (${(await scoreSheet(page)).bands.join()})`);
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const saved = await savedRun(page, 'map-strait');
  check(saved.v === 42 && JSON.stringify(saved.score) === JSON.stringify({ rev: 4, fun: 4, difficulty: 'bit-hard', intensity: 5, again: 'maybe', effort: 2, best: 1 }) && saved.variant === 'v1' && saved.labVariant === 'v1' && JSON.stringify(saved.entryScore) === JSON.stringify(saved.score), `the scorecard lands in the log (v${saved.v}, ${JSON.stringify(saved.score)}, variant ${saved.variant}) and on the device`);

  // ---- A lost run on wave 7: waves 1-7, no boss row; Skip saves none ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-strait&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await jumpTo(page, 7);
  await page.evaluate(() => { const g = window.__v3.game(); g.carrierHp = 0; window.__v3.advance(1); });
  await page.waitForSelector('[data-screen="lab-verdict"]', { timeout: 10000 });
  const sc1 = await scoreSheet(page);
  check(/the convoy was lost/.test(sc1.title) && !sc1.rows.includes('boss') && sc1.waves.join() === '1,2,3,4,5,6,7' && sc1.strip && sc1.small.length === 0, `a run lost on wave 7: "${sc1.title}", wave chips ${sc1.waves.join(' ')} with what happened in each, no boss row`);
  // The Strait's own last score shows; no other map card is scored, so no
  // comparison.
  check(sc1.last.join() === 'map-strait' && /^Last time · Fun 4 · Bit hard · Again maybe · today$/.test(sc1.lastText[0] ?? '') && sc1.vs === null && !sc1.rows.includes('vs'), `your last scores: this map's last one ("${sc1.lastText[0]}"), and no comparison without another map scored`);
  // Log v30 (the player: "still has my old notes from the previous run"):
  // the sheet starts blank on every run; the earlier verdict is history.
  const fresh = await page.evaluate(() => ({ on: [...document.querySelectorAll('[data-lab-verdict].on')].map((b) => b.dataset.labVerdict), note: document.querySelector('#lab-note')?.value, tags: [...document.querySelectorAll('.v3-lab-tags .on')].length, history: document.querySelector('[data-lab-history]')?.textContent ?? '' }));
  check(fresh.on.length === 0 && fresh.note === '' && fresh.tags === 0 && /Keep/.test(fresh.history), `a second run's sheet starts blank, the first run's verdict under "Your earlier verdicts" (${JSON.stringify(fresh)})`);
  await page.tap('[data-score="fun"][data-value="2"]');
  await page.tap('[data-score-skip]');
  await page.tap('[data-lab-verdict="tune"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const lost = await savedRun(page, 'map-strait');
  check(lost.end === 'lost' && lost.score === null && lost.verdict === 'tune', `a skipped scorecard saves no score (end ${lost.end}, score ${JSON.stringify(lost.score)})`);

  // ---- A won run: the boss row and B1-B3; with The Gauntlet scored
  // yesterday, its last score shows and the run is compared with it ----
  await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem('straitwatch.v3.lab'));
    const stats = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
    const at = new Date(Date.now() - 86400000).toISOString();
    p.results['map-gauntlet'] = [{ verdict: 'keep', tags: [], note: '', waves: 13, ended: 'length', stats, at, rev: 1, round: 13, plays: 'full', score: { rev: 2, fun: 5, difficulty: 'right', again: 'yes' } }];
    localStorage.setItem('straitwatch.v3.lab', JSON.stringify(p));
  });
  await page.goto(`${BASE_URL}/v3.html?lab=map-strait&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await tough(page);
  // Rate & review: wave 1 rated on its draft (fun 2), then waves 9 and 10
  // on theirs (fun 5 and intensity 5; fun 3). The boss rounds run on with
  // no draft between them.
  await jumpTo(page, 9, { fun: 2 });
  const draftRates = { 9: { fun: 5, intensity: 5 }, 10: { fun: 3 } };
  let draftShot = false;
  for (let i = 0; i < 40 && !(await page.$('[data-screen="lab-verdict"]')); i++) {
    await page.evaluate(() => window.__v3.advance(300));
    await page.waitForTimeout(300);
    if (await page.$('[data-screen="rate"]')) {
      const w = await page.evaluate(() => Number(document.querySelector('[data-screen="rate"] [data-wave-rate]')?.dataset.waveRate ?? 0));
      if (draftRates[w]) await rateWave(page, draftRates[w]);
      if (w === 9 && !draftShot) {
        // The wave's rating screen, for the player (phone size).
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${RR_DIR}/draft-rate-wave.png` });
        draftShot = true;
      }
      await page.tap('[data-rate-next]');
      await page.waitForSelector('[data-screen="draft"]', { timeout: 8000 });
    }
    if (await page.$('[data-screen="draft"]')) {
      await page.locator('.v2-card:not([disabled])').first().click();
      await page.waitForFunction(() => window.__v3.game()?.phase !== 'draft', null, { timeout: 8000 });
    }
  }
  await page.waitForSelector('[data-screen="lab-verdict"]', { timeout: 10000 });
  const rated = await page.evaluate(() => window.__v3.log().waveRatings?.map((w) => [w.wave, w.rating]));
  check(JSON.stringify(rated) === JSON.stringify([[1, { fun: 2 }], [9, { fun: 5, intensity: 5 }], [10, { fun: 3 }]]), `the waves rated on the Test Lab's drafts are in the run's log (${JSON.stringify(rated)})`);
  const sc2 = await scoreSheet(page);
  check(/map cleared/.test(sc2.title) && sc2.rows.join() === 'fun,difficulty,intensity,boss,vs,again,effort,best,weakest' && sc2.waves.slice(9).join() === '10,B1,B2,B3' && sc2.strip && sc2.small.length === 0 && !sc2.wide, `a won run: "${sc2.title}", rows ${sc2.rows.join(' ')}, wave chips ${sc2.waves.join(' ')}`);
  // The draft's ratings on the timeline's bands and the wave chips, and the
  // most and least fun waves suggested as Best (9) and Weakest (1).
  const sug = await page.evaluate(() => ({
    on: [...document.querySelectorAll('[data-score-waves] .v3-score-chip.on')].map((b) => `${b.dataset.score}=${b.dataset.value}`).join(),
    chip: document.querySelector('[data-score="best"][data-value="9"]')?.dataset.waveRating,
    notes: [...document.querySelectorAll('[data-score-suggest]')].filter((n) => !n.hidden).map((n) => n.dataset.scoreSuggest).join(),
  }));
  check(sc2.bands.includes('1:F2v') && sc2.bands.includes('9:F5 I5^') && sc2.bands.includes('10:F3') && sug.on === 'best=9,weakest=1' && sug.chip === 'F5 I5' && sug.notes === 'best,weakest', `each wave's draft rating shows on the timeline, and Best (9) and Weakest (1) are suggested from them (${JSON.stringify({ bands: sc2.bands, ...sug })})`);
  await page.evaluate(() => document.querySelector('[data-review-run]').scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${RR_DIR}/lab-end-run.png` });
  await page.evaluate(() => document.querySelector('.v2-panel').scrollTop = 0);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${RR_DIR}/lab-end-top.png` });
  // A moment picked on the timeline redraws the sheet as it was.
  if (await page.$('[data-review-run] .v3-stop-step')) {
    await page.tap('[data-score="fun"][data-value="4"]');
    await page.locator('[data-review-run] .v3-stop-step').first().tap();
    const kept = await page.evaluate(() => !!document.querySelector('[data-score="fun"][data-value="4"].on') && !!document.querySelector('[data-score="best"][data-value="9"].on'));
    check(kept, 'stepping through the moments keeps the answers so far');
    await page.tap('[data-score="fun"][data-value="4"]');
  }
  check(sc2.last.join() === 'map-strait,map-gauntlet' && /^The Gauntlet · Fun 5 · Right · Again yes · yesterday$/.test(sc2.lastText[1] ?? '') && sc2.vs === 'Compared with The Gauntlet', `your last scores: this map's, then The Gauntlet's ("${sc2.lastText[1]}"); the comparison names it ("${sc2.vs}")`);
  {
    // The last scores stay compact: two lines at most on a landscape phone.
    const h = await page.evaluate(() => Math.round(document.querySelector('[data-score-last]').getBoundingClientRect().height));
    check(h <= 70, `the last scores take ${h} px`);
  }
  // The player's own picks replace the suggestions.
  for (const [row, v] of [['intensity', '4'], ['boss', '5'], ['vs', 'better'], ['best', '12'], ['weakest', '10']]) await page.tap(`[data-score="${row}"][data-value="${v}"]`);
  check((await scoreSheet(page)).bands.filter((b) => /[\^v]$/.test(b)).join() === '10:F3v,12^', `the picks move their marks on the timeline (${(await scoreSheet(page)).bands.join()})`);
  await page.tap('[data-lab-verdict="keep"]');
  await page.tap('[data-lab-list]');
  await page.waitForSelector('[data-screen="lab"]');
  const won = await savedRun(page, 'map-strait');
  const wonScore = { rev: 4, intensity: 4, boss: 5, vs: 'better', vsCard: 'map-gauntlet', best: 12, weakest: 10, waves: [{ n: 1, fun: 2 }, { n: 9, fun: 5, intensity: 5 }, { n: 10, fun: 3 }], bestSuggested: 9, weakestSuggested: 1 };
  check(won.end === 'won' && JSON.stringify(won.score) === JSON.stringify(wonScore) && JSON.stringify(won.entryScore) === JSON.stringify(won.score), `a won run's boss score, its comparison with The Gauntlet, the waves rated on the draft and what was suggested land in the log and on the device (${JSON.stringify(won.score)})`);

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
  // The UI overhaul: Next up is in the hub's Tools drawer.
  await page.tap('[data-lab-tools-open]');
  await page.tap('[data-lab-next]');
  await page.waitForSelector('.playing.lab-on');
  const s4 = await runState(page);
  check(next === 'The Gauntlet' && s4.map === 'gauntlet' && s4.wave === 1 && s4.plays === 'full' && s4.policy === 'tactical' && s4.cmds.length === 0 && s4.enc === 4, `Next up (${next}) opens the full map under its production setup (${JSON.stringify({ wave: s4.wave, policy: s4.policy, cmds: s4.cmds, enc: s4.enc })})`);

  // ---- The bare link ----
  await page.goto(`${BASE_URL}/v3.html?lab=map-harbor&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => !!document.querySelector('.v3-convoy-auto'), null, { timeout: 8000 });
  const s5 = await runState(page);
  check(s5.map === 'harbor' && s5.wave === 1 && s5.plays === 'full' && s5.policy === 'tactical' && s5.cmds.length === 0 && s5.enc === 4 && s5.count === 'full map · wave 1 of 10', `the bare link v3.html?lab=map-harbor opens the full map with its encounters and no Hold (round 11) (${JSON.stringify({ wave: s5.wave, cmds: s5.cmds, enc: s5.enc, count: s5.count })})`);
  // Chapter 1: the bare link to the Kesh Hook and Lee of Marrow opens the
  // full map with their encounters (rev 4) and no command; chapter 2's
  // Island, Behemoth Run, Needle of Bosk, Archipelago and Saltgate Canal the same.
  for (const map of ['kesh', 'marrow', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate']) {
    await page.goto(`${BASE_URL}/v3.html?lab=map-${map}&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.playing.lab-on');
    await page.waitForFunction(() => !!document.querySelector('.v3-convoy-auto'), null, { timeout: 8000 });
    const sk = await runState(page);
    check(sk.map === map && sk.wave === 1 && sk.plays === 'full' && sk.policy === 'tactical' && sk.cmds.length === 0 && sk.enc === 4 && sk.count === 'full map · wave 1 of 10' && sk.log.encounters === 4 && sk.log.lab?.config?.production === true, `the bare link v3.html?lab=map-${map} opens the full map with its encounters and no command (${JSON.stringify({ wave: sk.wave, policy: sk.policy, cmds: sk.cmds, enc: sk.enc, count: sk.count })})`);
  }
  // Round 11: Hold is on Sowers' Reach, where mines drift across the lane.
  await page.goto(`${BASE_URL}/v3.html?lab=map-sowers&seed=7`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
  await page.waitForFunction(() => document.querySelectorAll('.v3-command').length > 0, null, { timeout: 8000 });
  const s6 = await runState(page);
  check(s6.map === 'sowers' && s6.wave === 1 && s6.plays === 'full' && s6.policy === 'tactical' && s6.cmds.join() === 'hold' && s6.enc === null, `the bare link v3.html?lab=map-sowers opens the full map with Hold (${JSON.stringify({ wave: s6.wave, cmds: s6.cmds, enc: s6.enc, count: s6.count })})`);
  // Round 8: a map card always gives its own new enemies their debut card
  // ("NEW · The Narrows: …"), even on a device that has met them (say in the
  // Test Lab's enemy cards), at Call-outs: Essential too. Another map's card
  // and Call-outs: Off keep it quiet.
  const debutTitles = async (map, level, kind) => {
    await page.evaluate((lv) => {
      localStorage.setItem('straitwatch.v3.seen', JSON.stringify({ v: 1, ids: ['threat:attackHeli', 'threat:torpedoSub', 'tip:basics'] }));
      localStorage.setItem('straitwatch.v3.callouts', lv);
    }, level);
    await page.goto(`${BASE_URL}/v3.html?lab=map-${map}&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.playing.lab-on');
    await page.evaluate((k) => window.__v3.foe(k), kind);
    const seen = new Set();
    for (let t = 0; t < 2500; t += 100) {
      for (const s of await page.locator('.v2-alert:not(.leaving) strong').allTextContents()) seen.add(s);
      await page.waitForTimeout(100);
    }
    return [...seen];
  };
  const onIsland = await debutTitles('island', 'essential', 'attackHeli');
  check(onIsland.includes('NEW · The Narrows: Attack helicopter'), `the Island's card: the Attack Helicopter's debut card, though met before, at Call-outs: Essential (${onIsland.join(' | ')})`);
  const onStrait = await debutTitles('strait', 'all', 'attackHeli');
  check(!onStrait.some((t) => t.startsWith('NEW')), `the Strait's card (not its debut): no card for an enemy met before (${onStrait.join(' | ')})`);
  const off = await debutTitles('island', 'off', 'torpedoSub');
  check(!off.some((t) => t.startsWith('NEW')), `Call-outs: Off: no debut card (${off.join(' | ')})`);
  await page.evaluate(() => localStorage.removeItem('straitwatch.v3.callouts'));
  check(errs.length === 0, `no page errors (${errs[0] ?? 'none'})`);
  await page.close();
} catch (e) {
  fail(e.stack ?? String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V3 MAP CARDS E2E FAILED' : 'V3 MAP CARDS E2E PASSED');
