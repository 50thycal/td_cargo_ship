// V3 browser smoke test. Expects `vite preview` (or dev) at BASE_URL.
// Drives: menu → Armory (cards: equip a gun card and a hull card from a
// seeded save) → loadout picker →
// map 1 → weapon pickups through real input (tap the pickup, then tap to
// fire it: Railgun, Air Strike, Flak, Gravity Well, Shrapnel, Thermobaric,
// Scattergun, Boomerang, Seekers, Aegis, Frigates) →
// defends to the
// draft → picks a weapon → phone-size layout → the notice tray on every
// map. Fails on any page error.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  npm run e2e:v3

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots/v3';
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
// A test's commands are on the pause menu (pause-menu round: no bar over the
// field): pause, if the menu isn't up, and wait for them.
const labMenu = async (page) => {
  // A run just (re)started, or a sheet closing: wait for play, or for a
  // menu or a draft (between a full run's waves) that has Done on it.
  await page.waitForFunction(() => !!document.querySelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]') || (window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open')), null, { timeout: 15000 });
  if (!(await page.$('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]'))) await page.evaluate(() => document.querySelector('.v2-pause').click());
  await page.waitForSelector('.v2-pause-panel [data-lab-done], .v2-draft [data-lab-done], .v3-rate [data-lab-done]');
};
const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};
const check = (ok, msg) => {
  if (!ok) fail(msg);
  else console.log('ok:', msg);
};

/** Tap every live threat that has no interceptor on it yet, via real clicks. */
async function defend(page) {
  const targets = await page.evaluate(() => {
    const g = window.__v3.game();
    if (!g || g.phase !== 'wave') return [];
    return g.threats
      .filter((t) => !g.interceptors.some((i) => i.target === t.id))
      .slice(0, 3)
      .map((t) => window.__v3.toClient(t.x, t.y));
  });
  for (const p of targets) await page.mouse.click(p.x, p.y);
}

/** Hold these weapons (in the drop pool, nothing loaded), rack full. */
async function equip(page, ids, level = 1) {
  await page.evaluate(
    ([ids, level]) => {
      const g = window.__v3.game();
      g.levels = Object.fromEntries(ids.map((id) => [id, level]));
      g.slots = [...ids];
      g.weapon = null;
      g.pickups = [];
      g.ammo = g.stats.rack;
    },
    [ids, level],
  );
  await page.waitForTimeout(80);
}

/** A weapon pickup on the water at (x, y), as a kill would drop it. */
async function dropWeapon(page, id, x, y) {
  await page.evaluate(([id, x, y]) => window.__v3.game().pickups.push({ id: 90000 + Math.floor(Math.random() * 9999), kind: 'weapon', weapon: id, x, y, age: 0 }), [id, x, y]);
}

const w2c = (page, x, y) => page.evaluate(([x, y]) => window.__v3.toClient(x, y), [x, y]);

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (err) => fail(`page error: ${err.message}`));
  await page.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
  // A save holding a few Armory cards.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 1, best: {}, cards: 4, armory: { warhead: 1, magazine: 2, pointdef: 1 }, equipped: { gun: 'magazine', hull: null, supply: null }, cleared: [], armoryV: 2 }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  // Round 7: a save from before the cards (salvage-era levels, no armoryV)
  // loads with its Armory cleared; the seeded one above is current.
  const legacy = await page.evaluate(() => {
    const keep = localStorage.getItem('straitwatch.v3.progress');
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 1, salvage: 500, armory: { warhead: 4 }, equipped: 'warhead', cleared: [] }));
    return keep;
  });
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator('.v3-armory-btn').getAttribute('data-cards')) === '0' && !(await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')).armory.warhead)), 'an old salvage-era save loads with its Armory cleared');
  await page.evaluate((keep) => localStorage.setItem('straitwatch.v3.progress', keep), legacy);
  await page.reload({ waitUntil: 'networkidle' });

  // The Armory overhaul: the round 7 save above (Armory version 2, Deep
  // Magazine equipped in the Gun bay) keeps its levels, starts at 0 Scrap,
  // and Deep Magazine moves to the Supply bay; the Gun bay takes its best
  // gun card.
  {
    const m = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
    check(m.armoryV === 3 && m.scrap === 0 && m.armory.magazine === 2 && m.armory.warhead === 1 && m.equipped.supply === 'magazine' && m.equipped.gun === 'warhead', `a round 7 save migrates: levels kept, 0 Scrap, Deep Magazine in Supply (${JSON.stringify({ v: m.armoryV, scrap: m.scrap, eq: m.equipped })})`);
    // Some Scrap to spend.
    await page.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('straitwatch.v3.progress'));
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ ...p, scrap: 400 }));
    });
    await page.reload({ waitUntil: 'networkidle' });
  }

  // ---- Menu and Armory ----
  await page.waitForSelector('[data-screen="menu"]');
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  check((await page.locator('.v3-armory-btn').getAttribute('data-cards')) === '4' && (await page.locator('.v3-armory-btn .v3-count').textContent()) === '4', 'menu shows the Armory cards found');
  check((await page.locator('.v3-armory-btn.v3-can-level').count()) === 1, 'the menu\'s Armory key lights when a level can be bought');
  await page.click('.v3-armory-btn');
  await page.waitForSelector('[data-screen="armory"]');
  check((await page.locator('.v3-scrap-count').getAttribute('data-scrap')) === '400', 'the Armory shows the Scrap banked');
  // Every upgrade is a card; the ones not found yet are greyed out.
  check((await page.locator('.v3-armory-card').count()) === 4, 'the Gun bay shows its four cards (Deep Magazine moved to Supply)');
  check(await page.locator('.v3-armory-card[data-armory="reload"]').isDisabled(), 'a card not found yet cannot be picked');
  check((await page.locator('.v3-armory-card[data-armory="warhead"] .v2-card-text').textContent()).length > 10, 'a card says what it does');
  // The equipped card's bar is open: level it with Scrap.
  await page.click('.v3-armory-card[data-armory="warhead"]');
  const lvBtn = page.locator('[data-armory-bar="warhead"] [data-armory-level]');
  check((await lvBtn.getAttribute('data-cost')) === '150' && !(await lvBtn.isDisabled()) && /150 scrap/.test(await lvBtn.textContent()), 'Level up shows its cost (150 Scrap for level 2)');
  await lvBtn.click();
  {
    const p = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
    check(p.armory.warhead === 2 && p.scrap === 250, `Level up spends the Scrap and adds a level (${p.armory.warhead}, ${p.scrap} left)`);
  }
  const lvBtn3 = page.locator('[data-armory-bar="warhead"] [data-armory-level]');
  check((await lvBtn3.getAttribute('data-cost')) === '300' && (await lvBtn3.isDisabled()) && /need 50 more/.test(await lvBtn3.textContent()), 'the next level is greyed with what is missing (300, need 50 more)');
  check(/Next:.*220% blast/.test(await page.locator('[data-armory-bar="warhead"]').textContent()), 'the bar says what the next level gives');
  await page.screenshot({ path: `${SHOT_DIR}/02-armory.png` });
  await page.click('[data-bay="hull"]');
  check((await page.locator('.v3-armory-card[data-armory="pointdef"] .v2-card-name').textContent()) === 'Deck Guns', 'the Armory\'s Point Defense reads Deck Guns');
  await page.click('.v3-armory-card[data-armory="pointdef"]');
  await page.click('[data-armory-bar="pointdef"] [data-armory-equip]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
  check(saved.equipped.gun === 'warhead' && saved.equipped.hull === 'pointdef' && saved.armory.warhead === 2, `equipped one card from each bay (${JSON.stringify(saved.equipped)})`);
  check(!('salvage' in saved) && !(await page.locator('[data-buy]').count()), 'no salvage, no old Upgrade buttons');
  await page.click('[data-bay="supply"]');
  check((await page.locator('.v3-armory-card').count()) === 6 && (await page.locator('.v3-armory-card:disabled').count()) === 5 && !(await page.locator('.v3-armory-card[data-armory="magazine"]').isDisabled()), 'the Supply bay: six cards (Quartermaster and Salvage Crews new), Deep Magazine held');
  await page.click('[data-screen="armory"] [data-back]');
  await page.waitForSelector('[data-screen="menu"]');

  // ---- A run: the map's briefing asks which ONE upgrade each bay gives ----
  await page.click('[data-map="strait"]');
  await page.waitForSelector('[data-screen="loadout"]');
  check((await page.locator('[data-bay="gun"] .v3-gun.on').getAttribute('data-gun')) === 'warhead' && (await page.locator('[data-bay="hull"] .v3-gun.on').getAttribute('data-gun')) === 'pointdef' && (await page.locator('[data-bay="supply"] .v3-gun.on').getAttribute('data-gun')) === 'magazine', 'the loadout picker has one upgrade from each open bay');
  check(!(await page.locator('.v3-gun[data-gun="reload"]').count()), 'only cards found can be picked');
  await page.screenshot({ path: `${SHOT_DIR}/02b-gun-picker.png` });
  await page.click('[data-start]');
  await page.waitForSelector('.playing');
  const blast = await page.evaluate(() => window.__v3.game().stats.blast);
  check(Math.abs(blast - 22 * 1.8) < 1e-6, `the run's gun has the Armory's warhead at level 2 (blast ${blast})`);
  check((await page.evaluate(() => window.__v3.game().stats.pdGap)) > 0, 'the run has the Hull bay\'s Deck Guns');
  check((await page.evaluate(() => window.__v3.game().stats.rack)) === 8, 'the run has the Supply bay\'s Deep Magazine (8 rounds)');
  check((await page.locator('.v2-hud .v3-hud-scrap').getAttribute('data-scrap')) === '0', 'the HUD shows the run\'s Scrap (0 at the start)');
  // Speed: one button now, stepping 1× → 1.25× → 1.5× → 2×.
  for (let k = 0; k < 3; k++) await page.click('.v3-speed');
  check((await page.locator('.v3-speed b').textContent()) === '2×', 'speed button steps to 2×');
  await page.click('.v3-speed');

  // Let the first threats appear.
  for (let i = 0; i < 40; i++) {
    await defend(page);
    await page.waitForTimeout(60);
  }

  // ---- Weapons (round 2): drafted weapons drop as pickups; a tap on the
  // pickup loads the gun for 15 s; every tap then fires it. No buttons. ----
  await equip(page, ['railgun', 'airstrike', 'seeker']);
  await page.screenshot({ path: `${SHOT_DIR}/03-loadout.png` });
  check((await page.locator('.v3-weapon.held').count()) === 3, 'the loadout shows the three weapons held');
  check((await page.locator('.v3-weapons button, .v3-ability').count()) === 0, 'there are no ability buttons to press');
  check((await page.locator('.v3-weapon.loaded').count()) === 0, 'nothing is loaded before a pickup');

  // Drop a Railgun pickup and tap it, like any pickup.
  await dropWeapon(page, 'railgun', 700, 500);
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${SHOT_DIR}/04-weapon-pickup.png` });
  const pk = await w2c(page, 700, 500);
  await page.mouse.click(pk.x, pk.y);
  const loaded = await page.evaluate(() => window.__v3.game().weapon);
  check(loaded?.id === 'railgun' && loaded.t > 14, `tapping the pickup loads the Railgun for 15 s (${loaded?.t?.toFixed(1)} s)`);
  await page.waitForTimeout(150);
  check((await page.locator('.v3-weapon.loaded[data-ability="railgun"]').count()) === 1, 'its loadout chip lights up');
  check(/1[45]s/.test(await page.locator('.v3-weapon.loaded .v3-weapon-tag').textContent()), 'the chip counts the seconds down');
  // Playthrough round: its seconds are on its chip only; a second copy in
  // the left rail pushed the power-ups over the note button.
  check(!(await page.locator('.v2-timer').allTextContents()).some((t) => t.includes('RAILGUN')), 'the left rail leaves the weapon to its chip (no second timer)');
  check((await page.locator('.v2-alert').allTextContents()).some((t) => t.includes('RAILGUN') && t.includes('Tap anywhere')), 'a notice says what was loaded and how to fire it');
  // A tap on open water fires a beam through it, spending a round.
  const ammo0 = await page.evaluate(() => window.__v3.game().ammo);
  const open = await w2c(page, 1100, 200);
  await page.mouse.click(open.x, open.y);
  const fired = await page.evaluate(() => ({ ammo: window.__v3.game().ammo, beam: window.__v3.game().fx.some((f) => f.kind === 'beam') }));
  check(fired.beam && fired.ammo === ammo0 - 1, `a tap fires the Railgun's beam and spends a round (rack ${ammo0} → ${fired.ammo})`);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${SHOT_DIR}/05-railgun-loaded.png` });

  // Each of the others through the same real taps: pickup, then a tap —
  // on open water for the shells and the jet, on a threat for the seekers
  // and the Aegis Dome (it domes the hull the threat is after: the carrier).
  const sig = {
    airstrike: { open: true, ok: () => window.__v3.game().allies.length > 0 },
    flak: { open: true, ok: () => window.__v3.game().interceptors.some((i) => i.weapon?.id === 'flak') },
    shrapnel: { open: true, ok: () => window.__v3.game().interceptors.some((i) => i.weapon?.id === 'shrapnel') },
    thermo: { open: true, ok: () => window.__v3.game().interceptors.some((i) => i.weapon?.id === 'thermo') },
    scatter: { open: true, ok: () => window.__v3.game().fx.some((f) => f.kind === 'frag') },
    boomerang: { open: true, ok: () => window.__v3.game().blades.length > 0 },
    frigate: { open: true, ok: () => window.__v3.game().escorts.length >= 2 },
    well: { open: true, ok: () => window.__v3.game().interceptors.some((i) => i.weapon?.id === 'well') },
    seeker: { open: false, ok: () => window.__v3.game().interceptors.some((i) => i.src === 'seeker') },
    // Round 8: the ships carry their own interceptors while it is loaded.
    // (Armed, whether or not a hull has already fired its round at something;
    // the weapons plan's Nuke changed the drops, so the convoy at this moment
    // differs run to run.)
    aegis: { open: false, ok: () => window.__v3.game().ships.length > 0 && window.__v3.game().ships.every((sh) => sh.aegis) },
  };
  for (const [id, how] of Object.entries(sig)) {
    await equip(page, [id]);
    await dropWeapon(page, id, 600, 520);
    const p = await w2c(page, 600, 520);
    await page.mouse.click(p.x, p.y);
    const on = await page.evaluate(() => window.__v3.game().weapon?.id);
    if (!how.open) {
      // A tough target that sits still, so the tap lands on it.
      await page.evaluate(() => {
        const g = window.__v3.game();
        g.threats.push({ id: 80000 + g.nextId++, kind: 'heavy', x: 900, y: 300, vx: 0, vy: 0, hp: 99, speed: 0, heading: 0, target: -1, age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0 });
      });
    }
    const t = await w2c(page, 900, 300);
    await page.mouse.click(t.x, t.y);
    // A fresh Aegis pickup rearms every hull on the next sim step (collect
    // clears them first): read the domes a frame later.
    if (id === 'aegis') await page.waitForTimeout(80);
    const ok = await page.evaluate(`(${how.ok.toString()})()`);
    check(on === id && ok, `${id}: its pickup loads it and a tap ${how.open ? 'on open water' : 'on a threat'} fires it`);
    await page.waitForTimeout(150);
    if (id === 'well' || id === 'flak') await page.screenshot({ path: `${SHOT_DIR}/06-${id}.png` });
    await page.evaluate(() => {
      const g = window.__v3.game();
      g.threats = g.threats.filter((th) => th.id < 80000);
    });
  }

  // The log has taps only (a weapon is a pickup and a tap, nothing else).
  const logged = await page.evaluate(() => {
    const log = window.__v3.log();
    return { v: log.v, acts: log.commands.filter((c) => c[1] === 'a').length, game: log.game, armory: log.armory };
  });
  check(logged.v === 74 && logged.acts === 0 && logged.game === 'v3' && logged.armory.warhead === 2 && logged.armory.pointdef === 1 && logged.armory.magazine === 2, `log v${logged.v}: taps only, the armory recorded`);

  // ---- Defend to the draft ----
  await equip(page, []);
  for (let i = 0; i < 900; i++) {
    const phase = await page.evaluate(() => window.__v3.game()?.phase);
    if (phase !== 'wave') break;
    await defend(page);
    await page.waitForTimeout(40);
  }
  // Rate & review (docs/design/v3-rate-and-review.md): an optional "Rate
  // wave 1" screen between the wave's end and the draft (the 2026-11-20
  // playtest: "move this mid round review to be its own page"); each tap
  // lands in the log at once, and the game is untouched. Next goes on to
  // the draft, which no longer has the row.
  {
    await page.waitForSelector('[data-screen="rate"]', { timeout: 20000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOT_DIR}/10-rate-wave.png` });
    const row = await page.evaluate(() => { const r = document.querySelector('[data-screen="rate"] [data-wave-rate]'); const b = r?.getBoundingClientRect(); const btns = [...document.querySelectorAll('[data-rate-skip], [data-rate-next]')].map((x) => x.getBoundingClientRect()); return r ? { wave: r.dataset.waveRate, axes: [...r.querySelectorAll('[data-axis]')].map((a) => a.dataset.axis), fits: b.bottom <= innerHeight && b.right <= innerWidth, h2: document.querySelector('.v3-rate h2')?.textContent, buttons: btns.length, btnsFit: btns.every((x) => x.bottom <= innerHeight && x.height >= 40), phase: window.__v3.game().phase } : null; });
    check(row?.wave === '1' && row.axes.join() === 'difficulty,fun,intensity' && row.fits && row.h2 === 'Rate wave 1' && row.buttons === 2 && row.btnsFit && row.phase === 'draft', `after wave 1, its own "Rate wave 1" screen: difficulty, fun and intensity, Skip and Next on screen (${JSON.stringify(row)})`);
    const steps = await page.evaluate(() => window.__v3.game().steps);
    await page.locator('[data-screen="rate"] [data-wave-rate] [data-axis="fun"] [data-n="4"]').click();
    await page.locator('[data-screen="rate"] [data-wave-rate] [data-axis="intensity"] [data-n="2"]').click();
    await page.locator('[data-screen="rate"] [data-wave-rate] [data-axis="intensity"] [data-n="2"]').click();
    await page.locator('[data-screen="rate"] [data-wave-rate] [data-axis="intensity"] [data-n="5"]').click();
    await page.locator('[data-screen="rate"] [data-wave-rate-note]').click();
    await page.locator('[data-screen="rate"] .v3-wave-rate-text').fill('Swarm from the left');
    // Round 12 (the player, on an iPhone home-screen app: "I can't see the
    // text when I'm typing"): typing the note, the box and Next sit in what
    // the keyboard leaves (stood in for here as 150 px), its text light on
    // the dark box.
    await page.evaluate(() => document.querySelector('.v2-overlay').parentElement.style.setProperty('--vv-h', '150px'));
    await page.waitForTimeout(150);
    const rateTyping = await page.evaluate(() => {
      const box = document.querySelector('[data-screen="rate"] .v3-wave-rate-text');
      const r = box.getBoundingClientRect();
      const next = document.querySelector('[data-rate-next]').getBoundingClientRect();
      const cs = getComputedStyle(box);
      const lum = (c) => { const m = c.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0]; return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255; };
      return { on: !!document.querySelector('.typing'), box: Math.round(r.bottom), h: Math.round(r.height), next: Math.round(next.bottom), ink: lum(cs.webkitTextFillColor || cs.color), bg: lum(cs.backgroundColor) };
    });
    check(rateTyping.on && rateTyping.box <= 150 && rateTyping.h >= 30 && rateTyping.next <= 150 && rateTyping.ink - rateTyping.bg > 0.6, `typing the wave's note: the box and Next above the keyboard, light text on a dark box (${JSON.stringify(rateTyping)})`);
    await page.locator('[data-screen="rate"] .v3-wave-rate-text').blur();
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.v2-overlay').parentElement.style.removeProperty('--vv-h'));
    const wr =await page.evaluate(() => ({ list: window.__v3.log().waveRatings, steps: window.__v3.game().steps, phase: window.__v3.game().phase }));
    check(wr.list?.length === 1 && wr.list[0].wave === 1 && JSON.stringify(wr.list[0].rating) === '{"fun":4,"intensity":5}' && wr.list[0].note === 'Swarm from the left' && wr.steps === steps && wr.phase === 'draft', `the wave's rating lands in the log at once, the game untouched (${JSON.stringify(wr)})`);
    await page.locator('[data-rate-next]').click();
  }
  await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/10-draft.png` });
  const offer = await page.locator('.v2-card').count();
  check(offer >= 3, `draft deals ${offer} weapon cards`);
  check((await page.locator('.v2-draft h2').textContent()) === 'Choose your weapon', 'the draft asks for a weapon');
  check(!(await page.locator('.v2-draft').textContent()).includes('15 s in the gun') && !/EVOLVES:/.test(await page.locator('.v2-card-row').textContent()), 'cards carry only their own text (no repeated drop rule, no "EVOLVES:")');
  check((await page.locator('.v2-draft [data-wave-rate]').count()) === 0, 'the draft itself has no rating row');
  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 5000 });
  const held = await page.evaluate(() => Object.keys(window.__v3.game().levels).length);
  check(held === 1, 'the picked weapon is held');
  check((await page.locator('.v2-hud .v3-hud-scrap').getAttribute('data-scrap')) === '40', 'wave 1 cleared: the HUD reads 40 Scrap');
  check((await page.locator('.v3-weapon.held').count()) === 1, 'its loadout chip appears, not loaded');
  check((await page.locator('.v3-weapon').evaluateAll((bs) => bs.every((b) => getComputedStyle(b).animationName === 'none'))), 'nothing in the loadout animates');

  // ---- Playtest notes: pause and say something; rate a volley ----
  // Round 15: no note button in the rail (in every game type): notes and
  // volley ratings are the pause menu's.
  check((await page.locator('.v2-rail-left .v3-note-btn').count()) === 0, 'the rail has no note button (round 15: the pause menu has it)');
  await page.locator('.v2-pause').click();
  await page.locator('.v3-pause-note').click();
  const steps0 = await page.evaluate(() => window.__v3.game().steps);
  await page.locator('.v3-note-tag[data-tag="hard"]').click();
  await page.locator('.v3-note-text').fill('Heavy from the north with no warning');
  // Typing (the phone's keyboard up): only the box and its buttons, fitted
  // to what the keyboard leaves visible (simulated here as 150 px).
  await page.evaluate(() => document.querySelector('.v2-overlay').parentElement.style.setProperty('--vv-h', '150px'));
  await page.waitForTimeout(150);
  const typing = await page.evaluate(() => {
    const box = document.querySelector('.v3-note-text').getBoundingClientRect();
    const save = document.querySelector('.v3-note-save').getBoundingClientRect();
    return { on: !!document.querySelector('.typing'), tags: getComputedStyle(document.querySelector('.v3-note-tags')).display, box: box.bottom, save: save.bottom };
  });
  check(typing.on && typing.tags === 'none' && typing.box <= 150 && typing.save <= 150, `typing a note: the box and Save fit above the keyboard (${JSON.stringify(typing)})`);
  await page.locator('.v3-note-text').blur();
  await page.waitForTimeout(400);
  check(!(await page.evaluate(() => !!document.querySelector('.typing'))), 'the keyboard gone, the whole note form is back');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOT_DIR}/13-note.png` });
  await page.locator('.v3-note-save').click();
  const noted = await page.evaluate(() => window.__v3.log().notes?.[0]);
  check(
    noted && noted.step === steps0 && noted.tags.join() === 'hard' && noted.text.startsWith('Heavy') && noted.ctx?.wave >= 1 && /^data:image\/jpeg/.test(noted.thumb ?? ''),
    'a note lands in the log at the paused step, with the game state and a thumbnail',
  );
  check((await page.locator('[data-screen="pause-panel"]').count()) === 1, 'saving a note from the pause menu goes back to it');
  await page.locator('.v2-overlay .v2-btn.primary').click();
  // Defend until a volley ends: the pause menu then offers to rate it.
  let rate = false;
  for (let i = 0; i < 600 && !rate; i++) {
    await defend(page);
    await page.waitForTimeout(40);
    rate = await page.evaluate(() => (window.__v3.log().volleys ?? []).some((v) => v.to !== undefined));
    if ((await page.evaluate(() => window.__v3.game()?.phase)) !== 'wave') break;
  }
  check(rate, 'a volley ends');
  if (rate) {
    await page.locator('.v2-pause').click();
    await page.locator('.v3-pause-rate').click();
    await page.locator('[data-axis="difficulty"] [data-n="4"]').click();
    await page.locator('[data-axis="fun"] [data-n="5"]').click();
    await page.locator('[data-axis="intensity"] [data-n="2"]').click();
    await page.screenshot({ path: `${SHOT_DIR}/14-rate.png` });
    await page.locator('.v3-note-save').click();
    const rated = await page.evaluate(() => (window.__v3.log().volleys ?? []).filter((v) => v.rating));
    check(rated.length === 1 && rated[0].rating.difficulty === 4 && rated[0].rating.fun === 5 && rated[0].rating.intensity === 2, 'the rating lands on its volley');
    check((await page.locator('[data-screen="pause-panel"]').count()) === 1, 'rating from the pause menu goes back to it');
    await page.locator('.v2-overlay .v2-btn.primary').click();
  }

  // ---- Phone landscape ----
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await equip(page, ['flak', 'railgun', 'well'], 3);
  await dropWeapon(page, 'well', 900, 450);
  await page.evaluate(() => {
    const g = window.__v3.game();
    g.weapon = { id: 'flak', level: 3, t: 9 };
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/11-phone.png` });
  const lvTags = await page.locator('.v3-weapon-lv').allTextContents();
  check(lvTags.length === 3 && lvTags.every((t) => t === 'MAX'), `the last level reads MAX, not EVO (${lvTags.join(', ')})`);

  // ---- The end of a run wins Armory cards (round 7) ----
  // Wave 1 was cleared above; two more cleared waves make the run count.
  const beforeP = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
  const before = beforeP.cards;
  await page.evaluate(() => {
    const g = window.__v3.game();
    const h = g.history[g.history.length - 1];
    g.history.push({ ...h, wave: h.wave + 1 }, { ...h, wave: h.wave + 2 });
    g.carrierHp = 0;
  });
  await page.waitForSelector('[data-screen="result"] .v3-won-cards .v3-armory-card', { timeout: 10000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOT_DIR}/12-cards-won.png` });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
  check(after.cards === before + 1 && (await page.locator('.v3-won-cards .v3-armory-card').count()) === 1, `a lost run that cleared 3 waves finds one Armory card, shown as a card (${before} → ${after.cards})`);
  {
    // Scrap: 3 waves × 40, kept though the run was lost (+100 if the card
    // found was one already held).
    const dup = (await page.locator('.v3-won-cards .v2-card.dup').count()) * 100;
    const shown = await page.locator('[data-screen="result"] .v3-scrap-stat').getAttribute('data-scrap');
    check(after.scrap === beforeP.scrap + 120 + dup && shown === String(120 + dup) && /\+\d+ scrap/.test(await page.locator('.v3-scrap-ledger').textContent()), `a lost run banks its Scrap, shown at the end (${beforeP.scrap} → ${after.scrap}, shown +${shown})`);
  }
  // The run's review shows wave 1's rating from the draft on its band.
  await page.click('[data-screen="result"] .v3-review-btn');
  await page.waitForSelector('[data-screen="review"]');
  const band = await page.evaluate(() => { const b = document.querySelector('.v3-timeline .v3-tl-wave[data-wave="1"]'); return b ? { rated: b.classList.contains('rated'), text: b.querySelector('.v3-tl-rate')?.textContent, data: b.dataset.waveRating, title: b.title } : null; });
  check(band?.rated && band.text === '♥4' && band.data === 'F4 I5' && /Swarm from the left/.test(band.title), `the review's timeline shows wave 1's draft rating on its band (${JSON.stringify(band)})`);
  // Round 11: the run's rating asks Effort too (how hard the player tried),
  // and it lands in the log's rating with the others.
  const runAxes = await page.evaluate(() => [...document.querySelectorAll('[data-screen="review"] .v3-rating [data-axis]')].map((a) => `${a.dataset.axis}:${a.querySelector('.v3-rating-head span')?.textContent}`));
  check(runAxes.map((a) => a.split(':')[0]).join() === 'difficulty,fun,intensity,effort' && runAxes[3] === 'effort:1 casual / not really trying · 5 full focus, all-out', `the run's rating rows: ${runAxes.join(' | ')}`);
  await page.click('[data-screen="review"] [data-axis="fun"] [data-n="3"]');
  await page.click('[data-screen="review"] [data-axis="effort"] [data-n="2"]');
  await page.click('.v3-review-done');
  // The sealed log is stored (and sent) again with it.
  const runRating = await page.evaluate(() => (JSON.parse(localStorage.getItem('straitwatch.v3.playlogs') ?? '[]').at(-1) ?? {}).rating ?? null);
  check(JSON.stringify(runRating) === '{"fun":3,"effort":2}', `the run's rating, Effort included, is in the stored log (${JSON.stringify(runRating)})`);
  await page.waitForSelector('[data-screen="result"]');

  // ---- Free Play (round 7): any map, wave, weapons and Armory; nothing counts ----
  await page.click('[data-screen="result"] .v2-btn:has-text("Menu")');
  await page.click('[data-free-play]');
  await page.waitForSelector('[data-screen="freeplay"]');
  await page.selectOption('[data-fp="weapon0"]', 'frigate');
  await page.selectOption('[data-fp="level0"]', '3');
  await page.selectOption('[data-fp="bay-hull"]', 'plating');
  await page.selectOption('[data-fp="bay-level-hull"]', '5');
  await page.screenshot({ path: `${SHOT_DIR}/13-free-play.png` });
  const fpFits = await page.evaluate(() => { const o = document.querySelector('.v2-overlay.open .v2-panel'); return o.scrollHeight <= o.clientHeight + 1; });
  check(fpFits, 'the Free Play setup fits a phone without scrolling');
  await page.click('[data-free-start]');
  await page.waitForSelector('.playing');
  const fp = await page.evaluate(() => { const g = window.__v3.game(); return { wave: g.wave, frigate: g.levels.frigate, glance: g.stats.glance, pity: g.stats.dropPity }; });
  check(fp.wave === 7 && fp.frigate === 3 && fp.glance > 0.3 && fp.pity <= 8, `Free Play starts on wave 7 holding Battle Group, Armor Plating 5, frequent drops (${JSON.stringify(fp)})`);
  check((await page.locator('.v2-hud-dev').textContent()).includes('FREE PLAY'), 'the HUD says FREE PLAY');
  const cardsBefore = after.cards;
  await page.evaluate(() => { window.__v3.game().carrierHp = 0; });
  await page.waitForSelector('[data-screen="result"]');
  const cardsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')).cards);
  check(cardsAfter === cardsBefore && (await page.locator('.v2-btn:has-text("Play it again")').count()) === 1 && !(await page.locator('.v3-won-cards').count()), 'a Free Play run wins nothing and offers to play it again');
  const rail = await page.locator('.v2-rail-right').boundingBox();
  const last = await page.locator('.v3-weapon').nth(2).boundingBox();
  check(last.y + last.height <= rail.y + rail.height + 1 && last.y + last.height <= 390, `the loadout fits on a phone (bottom ${Math.round(last.y + last.height)} of 390)`);

  // ---- Menus round: the screens before a run, on phones, by touch ----
  // Every one fits each landscape phone without scrolling; each fact is said
  // once; the menu's maps have pictures; a locked map says why when tapped;
  // a fresh player's map tap opens its briefing, and Sail starts the run.
  for (const [w, h] of [[667, 375], [844, 390], [874, 402]]) {
    const mp = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    mp.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await mp.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
    await mp.evaluate(() => localStorage.clear());
    await mp.reload({ waitUntil: 'networkidle' });
    const fits = () =>
      mp.evaluate(() => {
        const o = document.querySelector('.v2-overlay.open .v2-panel');
        const r = o.getBoundingClientRect();
        const wide = [...o.querySelectorAll('*')].some((e) => e.getBoundingClientRect().right > innerWidth + 1);
        return o.scrollHeight <= o.clientHeight + 2 && r.bottom <= innerHeight + 1 && !wide;
      });
    const screen = () => mp.evaluate(() => document.querySelector('.v2-overlay').dataset.screen);
    await mp.waitForSelector('[data-screen="menu"]');
    check(await fits(), `${w}×${h}: the menu fits`);
    await mp.waitForFunction(() => [...document.querySelectorAll('.v2-map-card img')].filter((i) => i.src.startsWith('data:image')).length === 5, null, { timeout: 8000 });
    check(true, `${w}×${h}: the five maps have pictures`);
    const menuText = await mp.locator('.v2-overlay').innerText();
    check(!/to unlock/i.test(menuText) && !/Not played yet/.test(menuText) && !(await mp.locator('.v2-tag').count()), `${w}×${h}: a locked map isn't spelled out on the menu, and there is no tagline`);
    check((await mp.locator('.v2-map-card.next').count()) === 1, `${w}×${h}: one map is marked as next`);
    await mp.locator('[data-map="kesh"]').tap();
    check((await screen()) === 'menu' && /Clear The Strait to open The Kesh Hook/.test(await mp.locator('.v3-menu-toast').textContent()), `${w}×${h}: a locked map, tapped, says why and stays on the menu`);
    check(await mp.evaluate(() => !!window.__v3.backdrop()), `${w}×${h}: a map sails behind the menu`);
    await mp.locator('.v3-armory-btn').tap();
    await mp.waitForSelector('[data-screen="armory"]');
    check(await fits(), `${w}×${h}: the Armory fits`);
    const armText = await mp.locator('.v2-overlay').innerText();
    check(!/NOT FOUND|Not found yet/i.test(armText) && !(await mp.locator('.v3-armory .v2-card-answers').count()), `${w}×${h}: the Armory says "not found" once per card (a lock), and no card repeats its bay`);
    await mp.locator('[data-back]').tap();
    await mp.locator('.v2-settings-btn').tap();
    await mp.waitForSelector('[data-screen="settings"]');
    check(await fits(), `${w}×${h}: Settings fits`);
    await mp.locator('[data-back]').tap();
    await mp.locator('[data-free-play]').tap();
    await mp.waitForSelector('[data-screen="freeplay"]');
    check(await fits(), `${w}×${h}: Free Play fits`);
    await mp.locator('[data-back]').tap();
    await mp.locator('[data-map="strait"]').tap();
    await mp.waitForSelector('[data-screen="loadout"]');
    check(await fits(), `${w}×${h}: the briefing fits`);
    check((await mp.locator('.v3-brief-blurb').textContent()).length > 10 && (await mp.evaluate(() => window.__v3.backdrop().map)) === 'strait', `${w}×${h}: the briefing says what the map is about, with that map behind it`);
    await mp.locator('[data-start]').tap();
    await mp.waitForSelector('.playing');
    check((await mp.evaluate(() => window.__v3.game().map.id)) === 'strait', `${w}×${h}: Sail starts the run`);
    await mp.close();
  }
  // Portrait: turn the phone, on the menu too.
  {
    const pp = await browser.newPage({ viewport: { width: 402, height: 874 }, hasTouch: true, isMobile: true });
    await pp.goto(`${BASE_URL}/v3.html`, { waitUntil: 'networkidle' });
    check(await pp.locator('.v2-rotate').isVisible(), 'portrait: the menu asks to turn the phone');
    await pp.close();
  }

  // ---- The call-outs stack (round 14's tray, moved to the corner in the
  // call-outs round), on every map ----
  // A busy late wave played by the watch bot (which also grabs weapons, so
  // weapon notices compete for the stack). Cards sit in the bottom-right
  // quarter of the field, never overlap each other or the carrier, never
  // leave the screen, and never number more than two.
  // The 20-map plan: every map at one phone size, the first five at a second.
  const ORDER = ['strait', 'kesh', 'marrow', 'gauntlet', 'harbor', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'sowers', 'rigs', 'lantern', 'dreadnought', 'coves', 'delta', 'crossing', 'tide', 'citadel'];
  // Map visual-check round: and every map at the smallest phone (667×375),
  // where the cards stand tallest over the map (13 of 20 covered the carrier).
  const trays = [...ORDER.map((m) => [m, 874, 402]), ...['strait', 'gauntlet', 'island', 'harbor', 'archipelago'].map((m) => [m, 844, 390]), ...ORDER.map((m) => [m, 667, 375])];
  for (const [map, w, h] of trays) {
    const tp = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    tp.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await tp.goto(`${BASE_URL}/v3.html?seed=31`, { waitUntil: 'networkidle' });
    await tp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.dev', '1');
      localStorage.setItem('straitwatch.v3.dev.settings', JSON.stringify({ preset: 'full', wave: 6, watch: true, watchSpeed: 3, bot: 'you', armory: 'yours' }));
    });
    await tp.reload({ waitUntil: 'networkidle' });
    // Twenty maps sit in four chapter tabs of five on the menu.
    await tp.locator(`[data-chapter="${Math.floor(ORDER.indexOf(map) / 5) + 1}"]`).tap();
    await tp.locator(`[data-map="${map}"]`).tap();
    await tp.waitForSelector('.playing');
    let most = 0;
    let samples = 0;
    for (let k = 0; k < 70; k++) {
      const r = await tp.evaluate(() => {
        const g = window.__v3.game();
        const cards = [...document.querySelectorAll('.v2-alert:not(.leaving)')].map((e) => e.getBoundingClientRect());
        const c = g.map.carrier;
        const a = window.__v3.toClient(c.x - 80, c.y - 26);
        const b = window.__v3.toClient(c.x + 80, c.y + 26);
        const hit = (p, q) => p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1;
        const carrier = { left: a.x, top: a.y, right: b.x, bottom: b.y };
        const tl = window.__v3.toClient(0, 0);
        const br = window.__v3.toClient(1600, 900);
        return {
          n: cards.length,
          max: 2,
          // The stack's own box (a card slides in from the right) ends at the
          // field's right edge and the screen's foot; its cards stay in the
          // right half, below the top third (two first-sight hints stand
          // tallest on the smallest phone).
          corner: (() => {
            const st = document.querySelector('.v2-alerts').getBoundingClientRect();
            return st.right <= br.x && br.x - st.right < 12 && innerHeight - st.bottom < 12 && cards.every((p) => p.left > (tl.x + br.x) / 2 && p.top > innerHeight / 3);
          })(),
          overlap: cards.some((p, i) => cards.some((q, j) => j > i && hit(p, q))),
          onCarrier: cards.some((p) => hit(p, carrier)),
          off: cards.some((p) => p.bottom > innerHeight + 0.5 || p.top < 0 || p.left < 0 || p.right > innerWidth),
          phase: g.phase,
        };
      });
      if (r.phase !== 'wave') break;
      samples++;
      most = Math.max(most, r.n);
      const bad = [
        r.n > r.max && `${r.n} notices up (limit ${r.max})`,
        r.overlap && 'notices overlap each other',
        r.onCarrier && 'a notice covers the carrier',
        !r.corner && 'a notice is outside the bottom-right corner',
        r.off && 'a notice runs off the screen',
      ].filter(Boolean);
      for (const b of bad) fail(`${map} ${w}×${h}: ${b}`);
      if (bad.length) break;
      await tp.waitForTimeout(120);
    }
    if (most === 0) fail(`${map}: no notices seen in a busy wave`);
    if (samples < 20) fail(`${map}: only ${samples} samples before the wave ended`);
    console.log(`ok: call-outs on ${map} ${w}×${h}: ${samples} samples, up to ${most} cards at once, in the corner, no overlaps`);
    if (map === 'island' && w === 874) await tp.screenshot({ path: `${SHOT_DIR}/12-island-tray.png` });
    await tp.close();
  }

  // ---- Call-outs round: cards in the corner that go on their own or at a
  // tap, and the Call-outs setting ----
  // The player: "The bar that says like done, note, and everything, put that
  // on the bottom and then move the notifications to the bottom right hand
  // corner ... they should also be disappearing ... you can turn them off".
  // Pause-menu round: "that banner at the bottom covers up launchers": no bar
  // over the field at all; its commands are on the pause menu.
  {
    const cp = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const errs = [];
    cp.on('pageerror', (e) => errs.push(e.message));
    await cp.goto(`${BASE_URL}/v3.html?seed=8`, { waitUntil: 'networkidle' });
    await cp.evaluate(() => localStorage.clear());
    const titlesFor = async (ms) => {
      const seen = new Set();
      for (let t = 0; t < ms; t += 100) {
        for (const s of await cp.locator('.v2-alert:not(.leaving) strong').allTextContents()) seen.add(s);
        await cp.waitForTimeout(100);
      }
      return [...seen];
    };
    await cp.goto(`${BASE_URL}/v3.html?lab=cloud`, { waitUntil: 'networkidle' });
    await cp.waitForSelector('.playing.lab-on');
    await cp.waitForSelector('.v2-alert.show');
    const lay = await cp.evaluate(() => {
      // The lowest card (two can be stacked: a new type's card above a beat).
      const card = [...document.querySelectorAll('.v2-alert.show:not(.leaving)')].map((a) => a.getBoundingClientRect()).sort((a, b) => b.bottom - a.bottom)[0] ?? document.querySelector('.v2-alert').getBoundingClientRect();
      const tl = window.__v3.toClient(0, 0);
      const br = window.__v3.toClient(1600, 900);
      // Anything of the test's over the field's bottom strip: a button or a
      // bar the player's taps would land on instead of the water.
      const strip = [...document.querySelectorAll('.v2-root button, .v2-root [class*="lab"]')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && r.bottom > br.y - 60 && r.left < br.x && r.right > tl.x && !e.closest('.v2-rail, .v2-overlay, .v2-alerts');
      }).map((e) => e.className);
      return { bar: !!document.querySelector('.v3-lab-bar'), strip, done: !!document.querySelector('[data-lab-done]'), card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, mid: (tl.x + br.x) / 2, right: br.x, h: innerHeight };
    });
    check(!lay.bar && !lay.done && lay.strip.length === 0, `no Test Lab bar over the field: nothing of the test along its bottom, Done not shown in play (${JSON.stringify({ bar: lay.bar, done: lay.done, strip: lay.strip })})`);
    check(lay.card.left > lay.mid && lay.card.top > lay.h / 2 && lay.card.right <= lay.right && lay.h - lay.card.bottom < 16, `a call-out sits in the bottom-right corner, down at the bottom (${JSON.stringify(lay.card)})`);
    // An info card (3.2 s) goes on its own: the game held still, so no raid
    // hurries it along.
    await cp.evaluate(() => window.__v3.freeze(true));
    // (What is up or queued goes first, four seconds at the most a card.)
    await cp.waitForFunction(() => !document.querySelector('.v2-alert'), null, { timeout: 20000 });
    await cp.evaluate(() => window.__v3.notify('TIMED', 'Goes on its own.', { key: 'timed' }));
    const shownAt = Date.now();
    await cp.waitForFunction(() => !document.querySelector('.v2-alert:not(.leaving)'), null, { timeout: 5000 });
    const lasted = (Date.now() - shownAt) / 1000;
    check(lasted > 2.5 && lasted < 4.2, `a call-out goes on its own within its time (${lasted.toFixed(1)} s, of 3.2 s)`);
    await cp.evaluate(() => window.__v3.freeze(false));
    // A tap sends a card away at once, and is not a shot.
    await cp.evaluate(() => window.__v3.notify('TAP ME', 'A tap sends this away.', { key: 'tap-me' }));
    await cp.waitForTimeout(300);
    const box = await cp.locator('.v2-alert:not(.leaving)', { hasText: 'TAP ME' }).boundingBox();
    const taps0 = await cp.evaluate(() => Object.values(window.__v3.game().taps).reduce((a, b) => a + b, 0));
    await cp.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await cp.waitForTimeout(80);
    const tapped = await cp.evaluate(() => ({ left: [...document.querySelectorAll('.v2-alert:not(.leaving)')].some((e) => e.textContent.includes('TAP ME')), taps: Object.values(window.__v3.game().taps).reduce((a, b) => a + b, 0) }));
    check(!tapped.left && tapped.taps === taps0, `a tap on a call-out sends it away and fires nothing (${JSON.stringify({ ...tapped, taps0 })})`);
    // At Call-outs: All a test meets its enemy with a first-sight card.
    // (Bring one, on the pause menu, brings it and goes on with the game.)
    await labMenu(cp);
    await cp.click('[data-lab-bring]');
    check(await cp.evaluate(() => !document.querySelector('.v2-overlay.open') && document.querySelector('.v2-pause').textContent === 'II'), 'Bring one on the pause menu closes it: the game goes on');
    const all = await titlesFor(2500);
    check(all.some((t) => t.startsWith('NEW:') || t.startsWith('New on ')), `at Call-outs: All, a first sight gets its card (${all.join(' | ')})`);
    // Off, from Settings: kept across a reload, and no hint, wave or test card.
    await cp.goto(`${BASE_URL}/v3.html?seed=8`, { waitUntil: 'networkidle' });
    await cp.locator('.v2-settings-btn').tap();
    await cp.waitForSelector('[data-screen="settings"]');
    check(await cp.locator('[data-callouts="all"].on').count() === 1, 'Settings: Call-outs starts at All');
    await cp.locator('[data-callouts="off"]').tap();
    await cp.reload({ waitUntil: 'networkidle' });
    await cp.locator('.v2-settings-btn').tap();
    await cp.waitForSelector('[data-screen="settings"]');
    const kept = await cp.evaluate(() => ({ on: document.querySelector('[data-callouts].on')?.dataset.callouts, stored: localStorage.getItem('straitwatch.v3.callouts') }));
    check(kept.on === 'off' && kept.stored === 'off', `Call-outs: Off is kept across a reload (${JSON.stringify(kept)})`);
    await cp.goto(`${BASE_URL}/v3.html?lab=cloud`, { waitUntil: 'networkidle' });
    await cp.waitForSelector('.playing.lab-on');
    await labMenu(cp);
    await cp.click('[data-lab-bring]');
    const off = await titlesFor(2500);
    check(off.length === 0, `at Call-outs: Off, no first-sight, wave or test card shows (${off.join(' | ') || 'none'})`);
    check(errs.length === 0, `the call-outs checks ran without a page error${errs.length ? `: ${errs[0]}` : ''}`);
    await cp.close();
  }

  // ---- Pause-menu round: a tip card only for a new type, remembered across
  // maps and modes, and Settings → Show tips again ----
  // The player: "the notification system can like be reduced to just notes
  // about new weapon types and that should carry over between maps in the
  // campaign mode so drones isn't said every time".
  {
    const sp = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
    const errs = [];
    sp.on('pageerror', (e) => errs.push(e.message));
    await sp.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await sp.evaluate(() => localStorage.clear());
    // Every card title seen until `until` is among them, or `ms` runs out.
    const titles = async (ms, until) => {
      const seen = new Set();
      for (let t = 0; t < ms && !(until && [...seen].some(until)); t += 100) {
        for (const x of await sp.locator('.v2-alert:not(.leaving) strong').allTextContents()) seen.add(x);
        for (const x of await sp.locator('.v2-alert:not(.leaving)').allTextContents()) texts.add(x);
        await sp.waitForTimeout(100);
      }
      return [...seen];
    };
    const drone = (t) => t === 'NEW: Attack drone';
    const texts = new Set();
    await sp.goto(`${BASE_URL}/v3.html?lab=map-strait&seed=7`, { waitUntil: 'networkidle' });
    await sp.waitForSelector('.playing.lab-on');
    const first = await titles(15000, drone);
    const stored = await sp.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.seen') ?? 'null'));
    check(first.some(drone) && !first.includes('TESTING: THE STRAIT') && stored?.v === 1 && stored.ids.includes('threat:drone'), `a Test Lab map meets the drone with a card, and the save remembers it (${first.join(' | ')}; ${JSON.stringify(stored)})`);
    check(first.includes('WAVE 1') && ![...texts].some((t) => t.includes('Tap threats')), `wave 1's card carries no how-to line in a lab run (${[...texts].filter((t) => t.startsWith('WAVE')).join(' | ')})`);
    // Another map, after a reload: drones again, and no card for them.
    await sp.goto(`${BASE_URL}/v3.html?lab=map-gauntlet&seed=7`, { waitUntil: 'networkidle' });
    await sp.waitForSelector('.playing.lab-on');
    await sp.waitForFunction(() => window.__v3.game().threats.some((t) => t.kind === 'drone'), null, { timeout: 20000 });
    const second = await titles(5000);
    check(!second.some(drone) && second.length > 0, `on the next map the drone is not announced again (${second.join(' | ')})`);
    // Free Play shares the memory.
    await sp.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await sp.locator('.v2-settings-btn').tap();
    await sp.waitForSelector('[data-screen="settings"]');
    const row = await sp.evaluate(() => ({ seen: Number(document.querySelector('[data-setting="tips"]')?.dataset.tipsSeen), text: document.querySelector('[data-setting="tips"]')?.textContent, h: document.querySelector('[data-tips-reset]')?.getBoundingClientRect().height }));
    check(row.seen >= 1 && /\d+ met\./.test(row.text ?? '') && row.h >= 36, `Settings has Show tips again, with the types met so far (${JSON.stringify(row)})`);
    await sp.locator('[data-tips-reset]').tap();
    const cleared = await sp.evaluate(() => ({ stored: localStorage.getItem('straitwatch.v3.seen'), disabled: document.querySelector('[data-tips-reset]')?.disabled, text: document.querySelector('[data-setting="tips"]')?.textContent }));
    check(cleared.stored === null && cleared.disabled && /None met yet/.test(cleared.text ?? ''), `Show tips again clears them (${JSON.stringify(cleared)})`);
    await sp.goto(`${BASE_URL}/v3.html?lab=map-gauntlet&seed=7`, { waitUntil: 'networkidle' });
    await sp.waitForSelector('.playing.lab-on');
    const again = await titles(15000, drone);
    check(again.some(drone), `after Show tips again the drone is introduced again (${again.join(' | ')})`);
    check(errs.length === 0, `the tip memory checks ran without a page error${errs.length ? `: ${errs[0]}` : ''}`);
    await sp.close();
  }

  // ---- The weapons plan, phases 0–1: the prototypes in Free Play, by touch ----
  // Each new verb through real pointer events at phone size: a hold charges
  // the Lance, a swipe cuts, a hold on a threat hooks it, two taps chain, taps
  // mark for the salvo; the Nuke clears the sky. The run is replayed after.
  {
    const wp = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true });
    wp.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await wp.goto(`${BASE_URL}/v3.html?seed=11`, { waitUntil: 'networkidle' });
    await wp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: 'strait', wave: 5, weapons: [{ id: 'lance', level: 1 }, { id: 'cutter', level: 1 }, { id: 'grapnel', level: 1 }], armory: { gun: null, hull: null, supply: null }, frequentDrops: true }));
    });
    await wp.reload({ waitUntil: 'networkidle' });
    await wp.click('[data-free-play]');
    await wp.waitForSelector('[data-screen="freeplay"]');
    const fpList = await wp.evaluate(() => { const o = [...document.querySelectorAll('[data-fp="weapon0"] option')]; return { all: o.filter((x) => x.value).length, protos: o.filter((x) => /prototype/.test(x.textContent)).length }; });
    check(fpList.all === 27 && fpList.protos === 0, `Free Play offers all 27 weapons (Overclock and Time Warp cut), none a prototype after the lock-in (${JSON.stringify(fpList)})`);
    await wp.click('[data-free-start]');
    await wp.waitForSelector('.playing');
    // Hand-placed targets on a quiet wave: the same picture every time.
    const place = (list) => wp.evaluate((list) => {
      const g = window.__v3.game();
      g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
      g.raiderQueue = [];
      g.threats = [];
      g.pickups = [];
      g.ammo = g.stats.rack;
      for (const [kind, hp, x, y] of list) g.threats.push({ id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp, speed: 0, heading: Math.PI / 2, target: -1, age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0 });
      for (const s of g.ships) s.hp = 99;
    }, list);
    const loadW = (id) => wp.evaluate((id) => { const g = window.__v3.game(); g.levels[id] = g.levels[id] ?? 1; g.weapon = { id, level: g.levels[id], t: 15, t0: g.t }; }, id);
    const st = () => wp.evaluate(() => { const g = window.__v3.game(); return { press: g.press?.mode ?? null, ammo: g.ammo, fire: g.taps.fire, alive: g.threats.filter((t) => !t.dead).map((t) => t.hp) }; });
    const c = (x, y) => w2c(wp, x, y);

    await place([['heavy', 8, 800, 520], ['heavy', 8, 800, 300]]);
    await loadW('lance');
    let p = await c(800, 300);
    await wp.mouse.move(p.x, p.y);
    await wp.mouse.down();
    await wp.waitForTimeout(900);
    const charging = await st();
    await wp.mouse.up();
    await wp.waitForTimeout(60);
    let after = await st();
    check(charging.press === 'charge' && after.alive.every((hp) => hp <= 5), `Charge Lance: a hold charges, letting go pierces the line (${JSON.stringify(after.alive)})`);

    // Two thumbs: while one charges, a tap with the other is a plain shot and
    // the charge carries on.
    await place([['heavy', 8, 800, 300], ['drone', 1, 400, 250]]);
    p = await c(800, 300);
    await wp.mouse.move(p.x, p.y);
    await wp.mouse.down();
    await wp.waitForTimeout(250);
    const d = await c(400, 250);
    await wp.touchscreen.tap(d.x, d.y);
    const two = await wp.evaluate(() => { const g = window.__v3.game(); return { press: g.press?.mode, shots: g.interceptors.length }; });
    await wp.mouse.up();
    check(two.press === 'charge' && two.shots >= 1, `Charge Lance: a second finger taps a plain shot while the first keeps charging (${JSON.stringify(two)})`);

    await place([['drone', 1, 600, 300], ['drone', 1, 700, 300], ['drone', 1, 800, 300], ['drone', 1, 1100, 500]]);
    await loadW('cutter');
    p = await c(560, 300);
    await wp.mouse.move(p.x, p.y);
    await wp.mouse.down();
    for (let k = 1; k <= 10; k++) {
      const q = await c(560 + k * 30, 300);
      await wp.mouse.move(q.x, q.y);
    }
    await wp.mouse.up();
    after = await st();
    check(after.alive.length === 1 && after.ammo === (await wp.evaluate(() => window.__v3.game().stats.rack)) - 1, `Laser Cutter: one swipe cuts the three drones under it for one round (${after.alive.length} left)`);

    await place([['heavy', 8, 700, 300], ['guided', 2, 900, 300]]);
    await loadW('grapnel');
    p = await c(700, 300);
    await wp.mouse.move(p.x, p.y);
    await wp.mouse.down();
    for (let k = 1; k <= 12; k++) {
      const q = await c(700 + k * 20, 300);
      await wp.mouse.move(q.x, q.y);
      await wp.waitForTimeout(25);
    }
    const hooked = await st();
    await wp.mouse.up();
    await wp.waitForTimeout(600);
    after = await st();
    check(hooked.press === 'hook' && after.alive.length === 1 && after.alive[0] < 8, `Grapnel: hold a heavy, swing it into the guided missile, let go and it bursts (${JSON.stringify(after.alive)})`);

    await place([['drone', 1, 400, 300], ['heavy', 8, 900, 300], ['strafer', 3, 1200, 200], ['rig', 10, 600, 160]]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.weapon = null; g.pickups.push({ id: 99991, kind: 'nuke', x: 640, y: 480, age: 0 }); });
    p = await c(640, 480);
    await wp.mouse.click(p.x, p.y);
    after = await st();
    check(after.alive.length === 1 && after.alive[0] === 7, `the Nuke clears the sky; the rig takes 3 hits (${JSON.stringify(after.alive)})`);

    // ---- Phase 2: the passives. Each loads from its pickup by a real tap,
    // then acts on its own while the gun stays plain.
    const pickup = async (id, level = 1) => {
      await wp.evaluate(([id, level]) => { const g = window.__v3.game(); g.weapon = null; g.levels[id] = level; if (!g.slots.includes(id)) g.slots.push(id); }, [id, level]);
      await dropWeapon(wp, id, 640, 560);
      const q = await c(640, 560);
      await wp.mouse.click(q.x, q.y);
    };
    await place([['drone', 1, 600, 250], ['drone', 1, 1000, 250]]);
    await pickup('droneScreen');
    await wp.waitForTimeout(1600);
    after = await st();
    const screen = await wp.evaluate(() => window.__v3.game().weapon?.id);
    check(screen === 'droneScreen' && after.alive.length < 2, `Drone Screen: drones launch from the deck and ram what's coming (${after.alive.length} of 2 left)`);

    await place([['drone', 1, 760, 330], ['drone', 1, 800, 300], ['drone', 1, 840, 330]]);
    await pickup('gunships');
    let missiles = 0;
    // They fly in, turn, ease into the hover, then fire.
    for (let k = 0; k < 45; k++) {
      await wp.waitForTimeout(100);
      missiles = Math.max(missiles, await wp.evaluate(() => window.__v3.game().hellfires.length));
    }
    after = await st();
    const helis = await wp.evaluate(() => window.__v3.game().helis.length);
    check(helis === 2 && missiles > 0 && after.alive.length === 0, `Gunship Pair: two helicopters arrive and fire Hellfires at the pack (${helis} helis, ${missiles} missiles in the air at once, ${after.alive.length} left)`);

    await place([]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.queue = [0.5, 1, 1.5, 2, 2.5].map((dt) => ({ at: g.waveT + 3.6 + dt, kind: 'drone', base: 0 })).concat([{ at: 1e9, kind: 'drone', base: 0 }]); });
    await pickup('bomberWing');
    // (Test Lab round 5: the silo goes quiet when the bomber is over it, ~2 s
    // after it is called, then its launches due are cancelled.)
    await wp.waitForTimeout(5500);
    const silent = await wp.evaluate(() => { const g = window.__v3.game(); return { quiet: (g.quietUntil[0] ?? 0) > g.t, launched: g.threats.length }; });
    check(silent.quiet && silent.launched === 0, `Bomber Wing: a pass silences the busy silo, its launches cancelled (${JSON.stringify(silent)})`);

    await place([['drone', 1, 500, 250], ['heavy', 8, 900, 250]]);
    await pickup('orbital');
    await wp.waitForTimeout(1300);
    const lock = await wp.evaluate(() => { const g = window.__v3.game(); const th = g.threats.find((t) => t.kind === 'heavy'); return { locked: g.orbital?.id === th?.id }; });
    await wp.waitForTimeout(1000);
    after = await st();
    check(lock.locked && after.alive.some((hp) => hp <= 5), `Orbital Strike: the laser dots lock the heavy, then the beam hits it for 3 (${JSON.stringify(after.alive)})`);

    // ---- Phase 3: boosts. A boost pickup never replaces the loaded weapon.
    await place([['heavy', 30, 800, 260]]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.railgun = 1; g.weapon = { id: 'railgun', level: 1, t: 15, t0: g.t }; g.levels.fullSteam = 1; if (!g.slots.includes('fullSteam')) g.slots.push('fullSteam'); });
    await dropWeapon(wp, 'fullSteam', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    const tw = await wp.evaluate(() => { const g = window.__v3.game(); return { boost: g.boost?.id, weapon: g.weapon?.id }; });
    check(tw.boost === 'fullSteam' && tw.weapon === 'railgun', `a boost runs beside the loaded weapon: Full Steam with the Railgun (${JSON.stringify(tw)})`);

    // Wild Card (Test Lab round 5): a weapon now, it replaces the Railgun.
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.wildCard = 1; if (!g.slots.includes('wildCard')) g.slots.push('wildCard'); });
    await dropWeapon(wp, 'wildCard', 640, 560);
    await wp.mouse.click(p.x, p.y);
    const wc = await wp.evaluate(() => { const g = window.__v3.game(); return { boost: g.boost?.id, weapon: g.weapon?.id }; });
    check(wc.weapon === 'wildCard' && wc.boost === 'fullSteam', `Wild Card is a weapon: it takes over the gun from the Railgun, the boost runs on (${JSON.stringify(wc)})`);
    // Wild Card level 2 (Test Lab round 8): its pickup brings a random
    // passive, named in the left rail with its seconds.
    await wp.evaluate(() => { window.__v3.game().levels.wildCard = 2; });
    await dropWeapon(wp, 'wildCard', 640, 560);
    await wp.mouse.click(p.x, p.y);
    await wp.waitForTimeout(200);
    const wild2 = await wp.evaluate(() => { const g = window.__v3.game(); return { weapon: g.weapon?.id, passive: g.wildPassive?.id ?? null, level: g.wildPassive?.level, chip: document.querySelector('.v2-timers')?.textContent ?? '' }; });
    check(wild2.weapon === 'wildCard' && ['frigate', 'aegis', 'droneScreen', 'gunships', 'bomberWing', 'orbital'].includes(wild2.passive) && wild2.level === 1 && /\d/.test(wild2.chip), `Wild Card level 2: the pickup brings a random passive (level 1), shown in the rail (${JSON.stringify(wild2)})`);

    // Focus (Test Lab round 8): a button on the left edge, held with the
    // left thumb, slows time; every touch on the water is a shot.
    await wp.evaluate(() => { const g = window.__v3.game(); g.wildPassive = null; g.helis = []; g.escorts = []; g.wings = []; g.sorties = []; g.orbital = null; });
    await place([['drone', 9, 600, 200], ['drone', 9, 900, 200]]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.focus = 1; if (!g.slots.includes('focus')) g.slots.push('focus'); });
    await dropWeapon(wp, 'focus', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    // Pointer events with their own ids, as two thumbs send.
    const finger = (type, id, x, y) => wp.evaluate(([type, id, x, y]) => {
      const cv = document.querySelector('canvas');
      cv.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: id === 11 }));
    }, [type, id, x, y]);
    const thumb = (type, id) => wp.evaluate(([type, id]) => {
      const b = document.querySelector('[data-focus-btn]');
      const r = b.getBoundingClientRect();
      b.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true, pointerType: 'touch' }));
    }, [type, id]);
    const fstate = () => wp.evaluate(() => { const g = window.__v3.game(); const b = document.querySelector('[data-focus-btn]'); return { focusing: g.focusing, finger: g.finger, bank: g.boost?.bank, shots: g.shots, on: b.classList.contains('on'), held: b.classList.contains('held'), text: b.textContent }; });
    // It shows from the next frame.
    await wp.waitForSelector('[data-focus-btn].on', { timeout: 2000 }).catch(() => {});
    const fbox = await wp.evaluate(() => {
      const b = document.querySelector('[data-focus-btn]').getBoundingClientRect();
      const cv = document.querySelector('canvas').getBoundingClientRect();
      const tl = window.__v3.toClient(0, 0);
      const br = window.__v3.toClient(1600, 900);
      return { w: b.width, h: b.height, left: b.left, right: b.right, top: b.top, bottom: b.bottom, docked: !!document.querySelector('.v3-dock [data-focus-btn]'), mapLeft: tl.x, mapBottom: br.y, cvBottom: cv.bottom, mid: (cv.left + cv.right) / 2 };
    });
    const f0 = await fstate();
    // Round 16, full width: no left rail; the button is in the dock, over
    // the battlefield's lower-left corner.
    check(f0.on && fbox.docked && fbox.w >= 72 && fbox.h >= 72 && fbox.left >= fbox.mapLeft && fbox.right < fbox.mid && fbox.bottom <= fbox.mapBottom && fbox.bottom <= fbox.cvBottom && /10\.0s/.test(f0.text), `Focus: its button shows in the dock, over the battlefield's lower-left corner, thumb-sized, with the slow motion banked (${JSON.stringify({ ...fbox, text: f0.text })})`);
    // A tap on the water: a shot, and no slow-down (whatever finger it is).
    const qa = await c(900, 200);
    await finger('pointerdown', 11, qa.x, qa.y);
    await finger('pointerup', 11, qa.x, qa.y);
    await wp.waitForTimeout(400);
    const quick = await fstate();
    check(!quick.focusing && quick.shots === f0.shots + 1 && quick.bank === 10, `Focus: a tap on the water is a shot and never slows time (${JSON.stringify(quick)})`);
    // Round 11: the dial is the slow motion left, not the boost's clock:
    // with the boost running down and the button not held, it stays full.
    const dial = () => wp.evaluate(() => { const b = document.querySelector('[data-focus-btn]'); return { bank: b.style.getPropertyValue('--bank'), left: b.style.getPropertyValue('--left'), bg: getComputedStyle(b).backgroundImage, t: window.__v3.game().boost?.t }; });
    await wp.waitForTimeout(600);
    const dialIdle = await dial();
    check(dialIdle.bank === '1.000' && dialIdle.left === '' && !/conic/.test(dialIdle.bg) && dialIdle.t < 15, `Focus: its dial shows only the slow motion left: full while not held, though the boost runs down (${JSON.stringify(dialIdle)})`);
    // Hold the button: time slows and nothing fires; a tap elsewhere shoots.
    await thumb('pointerdown', 21);
    await wp.waitForTimeout(400);
    const slow = await fstate();
    const aim = await c(600, 200);
    await finger('pointerdown', 12, aim.x, aim.y);
    await finger('pointerup', 12, aim.x, aim.y);
    const tapped = await fstate();
    await thumb('pointerup', 21);
    await wp.waitForTimeout(100);
    const fast = await fstate();
    const dialHeld = await dial();
    check(Number(dialHeld.bank) < 1 && Number(dialHeld.bank) > 0.9, `Focus: held, the dial drains with the slow motion (${JSON.stringify(dialHeld)})`);
    check(slow.focusing && slow.held && slow.bank < 10 && slow.shots === quick.shots && tapped.shots === quick.shots + 1 && tapped.focusing && !fast.focusing && !fast.held, `Focus: holding the button slows time and fires nothing, a tap elsewhere fires; letting go resumes at once (${JSON.stringify({ slow, tapped: tapped.shots, fast: fast.focusing })})`);
    // The round 7 quirk: held, then paused (where iOS may never send the
    // lift), then resumed: no slow motion with nothing touching.
    await thumb('pointerdown', 22);
    await wp.waitForTimeout(150);
    await wp.keyboard.press('Space');
    await wp.waitForTimeout(150);
    await wp.keyboard.press('Space');
    await wp.waitForTimeout(300);
    const paused = await fstate();
    // ... and a lift lost in a crowd of touches: a touchend that leaves no
    // touch on the button lets it go.
    await thumb('pointerdown', 23);
    await wp.waitForTimeout(150);
    const before = await fstate();
    await wp.evaluate(() => window.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [], bubbles: true })));
    await wp.waitForTimeout(150);
    const lost = await fstate();
    check(!paused.focusing && !paused.finger && !paused.held && before.focusing && !lost.focusing && !lost.held, `Focus: a pause or a lost lift never leaves slow motion running (${JSON.stringify({ paused: paused.focusing, before: before.focusing, lost: lost.focusing })})`);
    // The boost ends: the button goes.
    await wp.evaluate(() => { window.__v3.game().boost.t = 0.05; });
    await wp.waitForTimeout(300);
    const gone = await fstate();
    check(!gone.on && !gone.focusing, `Focus: when the boost ends its button goes (${JSON.stringify(gone)})`);

    // Dual Wield: the Railgun loaded, the boost, then Scattergun joins it.
    await place([['heavy', 30, 800, 260]]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.railgun = 1; g.levels.scatter = 1; g.levels.dualWield = 1; g.weapon = { id: 'railgun', level: 1, t: 15, t0: g.t }; });
    await dropWeapon(wp, 'dualWield', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    await dropWeapon(wp, 'scatter', 640, 560);
    await wp.mouse.click(p.x, p.y);
    const ammo0 = await wp.evaluate(() => window.__v3.game().ammo);
    p = await c(800, 260);
    await wp.mouse.click(p.x, p.y);
    const dual = await wp.evaluate(() => { const g = window.__v3.game(); return { a: g.weapon?.id, b: g.weapon2?.id, ammo: g.ammo, beam: g.fx.some((f) => f.kind === 'beam'), frag: g.fx.some((f) => f.kind === 'frag') }; });
    check(dual.a === 'railgun' && dual.b === 'scatter' && dual.beam && dual.frag && dual.ammo === ammo0 - 1, `Dual Wield: Scattergun joins the Railgun; one tap fires both for one round (${JSON.stringify(dual)})`);

    // ... and both weapons end with the boost (lock-in round).
    await wp.evaluate(() => { const g = window.__v3.game(); g.boost.t = 0.05; });
    await wp.waitForTimeout(300);
    const dualEnd = await wp.evaluate(() => { const g = window.__v3.game(); return { boost: g.boost?.id ?? null, a: g.weapon?.id ?? null, b: g.weapon2?.id ?? null }; });
    check(!dualEnd.boost && !dualEnd.a && !dualEnd.b, `Dual Wield: when it ends, both weapons end with it (${JSON.stringify(dualEnd)})`);

    // Supply Run: a cargo plane crosses and drops its crates in a row, each on a parachute.
    await place([]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.supplyRun = 1; if (!g.slots.includes('supplyRun')) g.slots.push('supplyRun'); });
    await dropWeapon(wp, 'supplyRun', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    let plane = 0;
    let chutes = 0;
    for (let k = 0; k < 30; k++) {
      await wp.waitForTimeout(100);
      const s = await wp.evaluate(() => { const g = window.__v3.game(); return { planes: g.planes.length, chutes: g.pickups.filter((x) => x.chute).length }; });
      plane = Math.max(plane, s.planes);
      chutes = Math.max(chutes, s.chutes);
    }
    check(plane === 1 && chutes >= 2, `Supply Run: a cargo plane crosses and drops its crates on parachutes (${plane} plane, up to ${chutes} crates in the air)`);
    // No magnet (Test Lab round 5): the crates stay where they came down.
    // (Once they are down off their parachutes.)
    await wp.waitForFunction(() => window.__v3.game().pickups.every((x) => !x.chute), null, { timeout: 5000 }).catch(() => {});
    const crates = await wp.evaluate(() => window.__v3.game().pickups.map((x) => [Math.round(x.x), Math.round(x.y)]).join(' '));
    await wp.waitForTimeout(800);
    const still = await wp.evaluate(() => window.__v3.game().pickups.map((x) => [Math.round(x.x), Math.round(x.y)]).join(' '));
    check(crates.length > 0 && crates === still, `Supply Run: its crates stay on the water for you to tap, nothing flies to the carrier (${crates} → ${still})`);

    const replayed = await wp.evaluate(() => { const r = window.__v3.replay(window.__v3.log()); const g = window.__v3.game(); return { same: r.steps === g.steps, kinds: [...new Set(window.__v3.log().commands.map((c) => c[1]))] }; });
    check(replayed.kinds.includes('d') && replayed.kinds.includes('v') && replayed.kinds.includes('r') && replayed.kinds.includes('h'), `the play log records presses, moves, lifts and the Focus finger (${replayed.kinds.join('')})`);
    await wp.close();
  }

  // ---- The lock-in: each chapter brings new weapons into the campaign ----
  {
    const lp = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true });
    await lp.goto(`${BASE_URL}/v3.html?seed=5`, { waitUntil: 'networkidle' });
    await lp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 12, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: 2, open: [], mapsV: 2 }));
    });
    await lp.reload({ waitUntil: 'networkidle' });
    await lp.click('[data-chapter="1"]');
    await lp.click('[data-map]:not(.locked)');
    await lp.waitForSelector('[data-start]');
    const ch1 = await lp.evaluate(() => document.querySelector('[data-new-weapons]')?.dataset.newWeapons ?? null);
    await lp.click('[data-back]');
    await lp.waitForSelector('[data-chapter]');
    await lp.click('[data-chapter="3"]');
    await lp.click('[data-map]:not(.locked)');
    await lp.waitForSelector('[data-start]');
    const ch3 = await lp.evaluate(() => document.querySelector('[data-new-weapons]')?.dataset.newWeapons ?? null);
    check(ch1 === null && ch3 === 'grapnel bomberWing orbital dualWield focus', `the briefing names the weapons a chapter brings (Home Waters: none; Dark Water: ${ch3})`);
    await lp.click('[data-start]');
    await lp.waitForSelector('.playing');
    await lp.evaluate(() => { const g = window.__v3.game(); g.queue = []; g.threats = []; g.raiderQueue = []; g.raiders = []; });
    // (The wave's rating screen first: skipped.)
    await lp.waitForSelector('.v2-card, [data-rate-skip]', { timeout: 15000 });
    if (await lp.$('[data-rate-skip]')) await lp.click('[data-rate-skip]');
    await lp.waitForSelector('.v2-card', { timeout: 15000 });
    const offer = await lp.evaluate(() => [...document.querySelectorAll('.v2-card')].map((c) => ({ id: c.dataset.upgrade, debut: c.dataset.debut ?? null, tag: c.querySelector('.v3-card-debut')?.textContent ?? null })));
    const debut = offer.filter((o) => o.debut);
    check(debut.length >= 1 && debut.every((o) => ['grapnel', 'bomberWing', 'orbital', 'dualWield', 'focus'].includes(o.id) && /^New on Dark Water$/.test(o.tag)), `the first draft in Dark Water deals one of its new weapons, marked on the card (${JSON.stringify(offer)})`);
    await lp.close();
  }

  // ---- The four new Armory upgrades; Lifeboats and Quartermaster as reworked (log 44):
  // ---- the extra-life pip and card, the golden bomb, the re-roll, the free level-up ----
  {
    const qp = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2, hasTouch: true });
    const errs = [];
    qp.on('pageerror', (e) => errs.push(e.message));
    await qp.goto(`${BASE_URL}/v3.html?seed=5`, { waitUntil: 'networkidle' });
    await qp.evaluate(() => {
      localStorage.clear();
      // A save from before the rework, holding both cards at level 5: they
      // load like any card, the levels meaning the new effects.
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 1, best: {}, cards: 3, armory: { warhead: 1, lifeboats: 5, quartermaster: 5 }, equipped: { gun: 'warhead', hull: 'lifeboats', supply: 'quartermaster' }, cleared: [], armoryV: 3, scrap: 0, scrapEarned: 0, open: [], mapsV: 2 }));
    });
    await qp.reload({ waitUntil: 'networkidle' });
    await qp.locator('.v3-armory-btn').tap();
    await qp.waitForSelector('[data-screen="armory"]');
    await qp.locator('[data-bay="hull"]').tap();
    const hull = await qp.evaluate(() => [...document.querySelectorAll('.v3-armory-card')].map((c) => c.dataset.armory).join());
    await qp.locator('[data-bay="supply"]').tap();
    const supply = await qp.evaluate(() => [...document.querySelectorAll('.v3-armory-card')].map((c) => c.dataset.armory).join());
    const fit = await qp.evaluate(() => [...document.querySelectorAll('.v3-armory-card')].every((c) => { const b = c.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 0.5; }));
    check(hull === 'plating,pointdef,repair,boilers,lifeboats' && supply === 'magazine,longload,drops,stockpile,quartermaster,salvage' && fit, `the Hull bay has five cards and Supply six, in one row on a phone (${hull} | ${supply})`);
    await qp.screenshot({ path: `${SHOT_DIR}/02c-armory-supply-new.png` });
    await qp.click('[data-screen="armory"] [data-back]');
    await qp.waitForSelector('[data-screen="menu"]');
    await qp.click('[data-map="strait"]');
    await qp.waitForSelector('[data-start]');
    await qp.click('[data-start]');
    await qp.waitForSelector('.playing');
    const st = await qp.evaluate(() => { const g = window.__v3.game(); return { rerolls: g.rerolls, cards: g.stats.draftCards, lives: g.extraLives, bombs: g.bombsLeft, free: g.freeLevelsLeft, mend: g.stats.mendShips }; });
    check(st.rerolls === 3 && st.cards === 4 && st.lives === 1 && st.bombs === 1 && st.free === 1 && st.mend === 1, `the run has Quartermaster 5 (3 re-rolls, 4 cards, a golden bomb, a free level-up) and Lifeboats 5 (a life to start, hulls mended to full) (${JSON.stringify(st)})`);
    // Lifeboats: the extra life is a seventh pip, lifeboat orange.
    await qp.waitForSelector('.v2-hud-lost[data-limit="7"]');
    check((await qp.locator('.v2-hud-lost i').count()) === 7 && (await qp.locator('.v2-hud-lost i.life').count()) === 1, 'the HUD shows seven pips, the extra life in orange');
    // The golden bomb: in the dock (round 16: no left rail), gold, on the
    // screen, clear of the other controls.
    const bombBox = await qp.evaluate(() => {
      const b = document.querySelector('.v3-gold-bomb');
      if (!b || b.hidden) return null;
      const r = b.getBoundingClientRect();
      const others = [...document.querySelectorAll('.v2-rail button, .v2-rail .v2-hud, .v2-rail input, .v3-dock [data-focus-btn], .v2-timer')].filter((o) => o !== b && o.offsetParent).map((o) => o.getBoundingClientRect());
      const clash = others.some((o) => o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top);
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, clash, gold: getComputedStyle(b).backgroundImage.includes('gradient') };
    });
    check(!!bombBox && bombBox.l >= 0 && bombBox.t >= 0 && bombBox.r <= 874 && bombBox.b <= 402 && !bombBox.clash && bombBox.gold, `the golden bomb sits in the dock, on screen and clear of the other controls (${JSON.stringify(bombBox)})`);
    await qp.waitForFunction(() => window.__v3.game().threats.some((t) => !t.dead), null, { timeout: 20000 });
    await qp.screenshot({ path: `${SHOT_DIR}/10a-golden-bomb.png` });
    await qp.locator('.v3-gold-bomb').tap();
    await qp.waitForTimeout(300);
    const boom = await qp.evaluate(() => { const g = window.__v3.game(); const l = window.__v3.log(); return { left: g.bombsLeft, n: l.commands.filter((c) => c[1] === 'n').length, hidden: document.querySelector('.v3-gold-bomb').hidden }; });
    check(boom.left === 0 && boom.n === 1 && boom.hidden, `a tap sets the golden bomb off, logged ('n'), and it is gone (${JSON.stringify(boom)})`);
    // Into the draft after wave 3 (set by hand), holding one weapon: the
    // Lifeboat card is dealt, the Re-roll and the Free level-up are there.
    await qp.evaluate(() => { const g = window.__v3.game(); g.wave = 3; g.levels = { flak: 1 }; g.slots = ['flak']; g.queue = []; g.threats = []; g.raiderQueue = []; g.raiders = []; });
    await qp.waitForSelector('.v2-card, [data-rate-skip]', { timeout: 15000 });
    if (await qp.$('[data-rate-skip]')) await qp.click('[data-rate-skip]');
    await qp.waitForSelector('.v2-card', { timeout: 15000 });
    await qp.waitForTimeout(700);
    const hand = () => qp.evaluate(() => [...document.querySelectorAll('.v2-card-row .v2-card')].map((c) => c.dataset.upgrade).filter((id) => id !== 'resupply' && id !== 'lifeboat'));
    const before = await hand();
    const btn = qp.locator('.v2-draft [data-reroll]');
    check(before.length === 4 && (await btn.getAttribute('data-reroll')) === '3' && /3 left/.test(await btn.textContent()), `the draft deals four weapons and offers a Re-roll with 3 left (${before.join()})`);
    check((await qp.locator('.v2-card[data-upgrade="lifeboat"]').count()) === 1 && /\+1 LIFE/.test(await qp.locator('.v2-card[data-upgrade="lifeboat"]').textContent()), 'after wave 3 the draft deals the Lifeboat card (+1 life)');
    const draftFit = await qp.evaluate(() => [...document.querySelectorAll('.v2-draft button')].every((c) => { const b = c.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5; }) && document.documentElement.scrollWidth <= innerWidth);
    check(draftFit, 'five cards, the Re-roll and the Free level-up fit an iPhone held sideways');
    await qp.screenshot({ path: `${SHOT_DIR}/10b-draft-reroll.png` });
    // The free level-up: its button, then the held weapon; the pick stays.
    await qp.locator('.v2-draft .v3-free-level').tap();
    await qp.locator('.v2-draft [data-free="flak"]').tap();
    await qp.waitForTimeout(300);
    const freed = await qp.evaluate(() => { const g = window.__v3.game(); const l = window.__v3.log(); return { flak: g.levels.flak, phase: g.phase, left: g.freeLevelsLeft, l: l.commands.filter((c) => c[1] === 'l').length, btn: document.querySelector('.v2-draft .v3-free-level')?.disabled }; });
    check(freed.flak === 2 && freed.phase === 'draft' && freed.left === 0 && freed.l === 1 && freed.btn === true, `the free level-up gives Flak a level, logged ('l'), the draft still open, the button spent (${JSON.stringify(freed)})`);
    await btn.tap();
    await qp.waitForTimeout(700);
    const after = await hand();
    const log = await qp.evaluate(() => { const l = window.__v3.log(); return { x: l.commands.filter((c) => c[1] === 'x').length, v: l.v, left: window.__v3.game().rerolls }; });
    check(after.length === 4 && after.join() !== before.join() && log.x === 1 && log.left === 2 && (await qp.locator('.v2-draft [data-reroll]').getAttribute('data-reroll')) === '2' && (await qp.locator('.v2-card[data-upgrade="lifeboat"]').count()) === 1, `a re-roll deals a new hand (the Lifeboat card still in it), logged, 2 left (${after.join()}; ${JSON.stringify(log)})`);
    // The Lifeboat card taken: +1 life, an eighth pip, no weapon.
    await qp.locator('.v2-card[data-upgrade="lifeboat"]').tap();
    await qp.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 5000 });
    const took = await qp.evaluate(() => ({ lives: window.__v3.game().extraLives, levels: window.__v3.game().levels }));
    await qp.waitForSelector('.v2-hud-lost[data-limit="8"]');
    check(took.lives === 2 && JSON.stringify(took.levels) === '{"flak":2}', `the Lifeboat card is an extra life in place of a weapon (${JSON.stringify(took)})`);
    check(!errs.length, `no page errors (${errs.join(' | ')})`);
    await qp.close();
  }

  // ---- The enemy build: new enemies by chapter, Free Play's Enemies line ----
  {
    const ep = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 1, hasTouch: true });
    const errs = [];
    ep.on('pageerror', (e) => errs.push(e.message));
    await ep.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await ep.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 20, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: 2, open: [], mapsV: 2 }));
    });
    await ep.reload({ waitUntil: 'networkidle' });
    await ep.click('[data-chapter="1"]');
    await ep.click('[data-map]:not(.locked)');
    await ep.waitForSelector('[data-start]');
    const foes = await ep.evaluate(() => ({ list: document.querySelector('[data-new-enemies]')?.dataset.newEnemies ?? null, first: document.querySelectorAll('.v3-foe-chip.first').length }));
    check(foes.list === 'sprinter hydra rocketTruck' && foes.first === 1, `the briefing names the enemies a chapter brings, the map's first marked (${foes.list}, ${foes.first} first)`);
    // Free Play: the Enemies line, then every new enemy brought in, drawn, no errors.
    await ep.evaluate(() => localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: 'strait', wave: 5, weapons: [{ id: 'flak', level: 1 }], armory: { gun: null, hull: null, supply: null }, frequentDrops: false, enemies: 'all' })));
    await ep.goto(`${BASE_URL}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await ep.click('[data-free-play]');
    await ep.waitForSelector('[data-screen="freeplay"]');
    const line = await ep.evaluate(() => { const s = document.querySelector('[data-fp="enemies"]'); return s ? { value: s.value, n: s.options.length } : null; });
    check(line && line.value === 'all' && line.n === 19, `Free Play has an Enemies line: as the campaign, all, none, or any one of 16 (round 11: no decoys) (${JSON.stringify(line)})`);
    await ep.click('[data-free-start]');
    await ep.waitForSelector('.playing');
    const kinds = ['sprinter', 'hydra', 'rocketTruck', 'attackHeli', 'torpedoSub', 'armored', 'scavenger', 'stealthJet', 'stealthBomber', 'diveBomber', 'siege', 'spotter', 'tender', 'guard', 'lure', 'cloud'];
    const seen = new Set();
    for (const k of kinds) {
      await ep.evaluate((kind) => { const g = window.__v3.game(); g.queue = [{ at: 1e9, kind: 'drone', base: 0 }]; g.raiderQueue = []; window.__v3.foe(kind); }, k);
      for (let i = 0; i < 30 && !seen.has(k); i++) {
        await ep.waitForTimeout(100);
        if (await ep.evaluate((kind) => { const g = window.__v3.game(); return g.threats.some((t) => t.kind === kind) || g.foe.marks.length > 0; }, k)) seen.add(k);
      }
    }
    check(seen.size === kinds.length && errs.length === 0, `all ${kinds.length} new enemies come into play in the browser and draw without errors (${seen.size}/${kinds.length}${errs.length ? `; ${errs[0]}` : ''})`);
    await ep.close();
  }

  // ---- The Test Lab: the hub, a test with its bar, the verdict, the log ----
  {
    const tp = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 1, hasTouch: true });
    const errs = [];
    tp.on('pageerror', (e) => errs.push(e.message));
    await tp.goto(`${BASE_URL}/v3.html?seed=8`, { waitUntil: 'networkidle' });
    await tp.evaluate(() => localStorage.clear());
    await tp.reload({ waitUntil: 'networkidle' });
    await tp.click('[data-lab]');
    await tp.waitForSelector('[data-screen="lab"]');
    const hub = await tp.evaluate(() => ({ rows: document.querySelectorAll('[data-card]').length, maps: document.querySelectorAll('[data-section="map"] [data-card]').length, old: document.querySelectorAll('[data-section="event"], [data-section="enemy"], [data-section="weapon"], [data-section="combo"], .v3-lab-sec, [data-lab-next], [data-lab-five]').length, ready: document.querySelectorAll('[data-ready]').length }));
    // The Tools round (docs/design/v3-playtest-fixes.md): the hub shows only
    // the new tests, Ready to test and the 26 map cards by chapter. The old
    // event, enemy, weapon and combo cards are gone from it; their ?lab=
    // links still open them.
    check(hub.rows === 26 && hub.maps === 26 && hub.old === 0 && hub.ready > 0, `the Test Lab hub shows Ready to test and the map cards only, no old testing (${JSON.stringify(hub)})`);
    await tp.goto(`${BASE_URL}/v3.html?lab=diveBomber&seed=8`, { waitUntil: 'networkidle' });
    await tp.waitForSelector('.playing.lab-on');
    const run = await tp.evaluate(() => { const g = window.__v3.game(); return { card: g.lab?.setup.card, wave: g.wave, endless: g.endless, bar: !!document.querySelector('.v3-lab-bar, [data-lab-done]'), map: g.map.id }; });
    check(run.card === 'diveBomber' && run.wave === 5 && run.endless && !run.bar, `a test starts at wave 5 on the lab's water, with nothing of it over the field (${JSON.stringify(run)})`);
    // Its commands are on the pause menu, under its name and count.
    await labMenu(tp);
    const menu = await tp.evaluate(() => ({ paused: window.__v3.game().phase === 'wave' && document.querySelector('.v2-pause').textContent === '▶', head: document.querySelector('.v3-lab-pause-name')?.textContent, count: document.querySelector('.v3-lab-pause-head .v3-lab-count')?.textContent, acts: [...document.querySelectorAll('.v2-pause-panel [data-lab-bring], .v2-pause-panel [data-lab-note], .v2-pause-panel [data-lab-setup], .v2-pause-panel [data-lab-done]')].map((b) => b.textContent) }));
    check(menu.paused && menu.head === 'DIVE BOMBER' && /1\/\d+$/.test(menu.count ?? '') && menu.acts.join() === 'Bring one,📝 Note,Setup,Done', `the pause menu heads with the test and has its commands (${JSON.stringify(menu)})`);
    const steps0 = await tp.evaluate(() => window.__v3.game().steps);
    await tp.waitForTimeout(300);
    check(await tp.evaluate((s) => window.__v3.game().steps === s, steps0), 'the game stays paused while the menu is up');
    await tp.click('[data-lab-bring]');
    await tp.waitForTimeout(400);
    const brought = await tp.evaluate(() => ({ cmds: window.__v3.log().commands.filter((c) => c[1] === 'b').length, marks: window.__v3.game().foe.marks.length }));
    check(brought.cmds === 1 && brought.marks > 0, `Bring one brings the card's enemy now, as a recorded input (${JSON.stringify(brought)})`);
    // Setup: its sheet over the paused game; Back to the test is the menu again.
    await labMenu(tp);
    await tp.click('[data-lab-setup]');
    await tp.waitForSelector('[data-screen="lab-setup"]');
    const st0 = await tp.evaluate(() => window.__v3.game().steps);
    await tp.waitForTimeout(300);
    check(await tp.evaluate((s) => window.__v3.game().steps === s, st0), 'the game stays paused under the setup sheet');
    await tp.click('[data-screen="lab-setup"] button:text("Back to the test")');
    await tp.waitForSelector('.v2-pause-panel [data-lab-setup]');
    // Note: its sheet, and Cancel back to the menu, still paused.
    await tp.click('[data-lab-note]');
    await tp.waitForSelector('[data-screen="note"]');
    await tp.click('[data-screen="note"] .v2-btn:not(.v3-note-save)');
    await tp.waitForSelector('.v2-pause-panel [data-lab-note]');
    check(await tp.evaluate((s) => window.__v3.game().steps === s && document.querySelector('.v2-pause').textContent === '▶', st0), 'Back to the test (Setup) and Cancel (Note) go back to the pause menu, the game still paused');
    await tp.click('[data-lab-done]');
    await tp.waitForSelector('[data-screen="lab-verdict"]');
    await tp.click('[data-lab-verdict="keep"]');
    await tp.fill('#lab-note', 'reads fine');
    await tp.click('[data-lab-list]');
    await tp.waitForSelector('[data-screen="lab"]');
    const saved = await tp.evaluate(() => {
      const p = JSON.parse(localStorage.getItem('straitwatch.v3.lab'));
      const logs = JSON.parse(localStorage.getItem('straitwatch.v3.playlogs') || '[]');
      const log = logs.find((l) => l.lab?.card === 'diveBomber');
      const e = p.results.diveBomber?.at(-1);
      return { verdict: e?.verdict, note: e?.note, round: e?.round, rev: e?.rev, logVerdict: log?.labResult?.verdict, logRound: log?.labResult?.round, v: log?.v, old: !!document.querySelector('[data-card="diveBomber"]') };
    });
    check(saved.verdict === 'keep' && saved.note === 'reads fine' && saved.round === 13 && saved.rev === 5 && saved.logVerdict === 'keep' && saved.logRound === 13 && saved.v === 74 && !saved.old, `the verdict is kept on the device, with its round and the card's version, and rides in the test's log; back on the hub, which lists no old card (${JSON.stringify(saved)})`);
    // An event card starts straight into its event on its own map, its card
    // shown; Run it again (in place of Bring one) starts it over.
    await tp.goto(`${BASE_URL}/v3.html?lab=ev-drone-storm`, { waitUntil: 'networkidle' });
    await tp.waitForSelector('.playing.lab-on');
    await tp.waitForSelector('.v3-event-card.show[data-event-card="drone-storm"]', { timeout: 3000 });
    const ev = await tp.evaluate(() => {
      const g = window.__v3.game();
      const card = document.querySelector('.v3-event-card');
      return { event: g.event?.id, wave: g.wave, map: g.map.id, name: card?.querySelector('.v3-event-name')?.textContent, rules: [...(card?.querySelectorAll('.v3-event-rules i') ?? [])].map((i) => i.textContent), hud: document.querySelector('.v2-hud')?.textContent };
    });
    await tp.waitForTimeout(1500);
    await labMenu(tp);
    Object.assign(ev, await tp.evaluate(() => ({ rerun: document.querySelector('[data-lab-rerun]')?.textContent, bring: !!document.querySelector('[data-lab-bring]:not([data-lab-rerun])') })));
    check(ev.event === 'drone-storm' && ev.wave === 11 && ev.map === 'kesh' && ev.name === 'Drone Storm' && ev.rules.join() === 'No ammo drops' && ev.rerun === 'Run it again' && !ev.bring && /WAVE\s*11/.test(ev.hud ?? ''), `a lab event card starts straight into its event, its card shown with its rule (${JSON.stringify(ev)})`);
    await tp.click('[data-lab-rerun]');
    await tp.waitForTimeout(300);
    const again = await tp.evaluate(() => { const g = window.__v3.game(); return { cmds: window.__v3.log().commands.filter((c) => c[1] === 'b').length, t: g.event?.t, reruns: g.eventLog.filter((e) => e.outcome === 'rerun').length, card: document.querySelector('.v3-event-card.show')?.dataset.eventCard }; });
    check(again.cmds === 1 && again.reruns === 1 && again.t < 1 && again.card === 'drone-storm', `Run it again starts the event over, as a recorded input (${JSON.stringify(again)})`);
    // A link from the review page opens a test straight away.
    await tp.goto(`${BASE_URL}/v3.html?lab=w-cadence`, { waitUntil: 'networkidle' });
    await tp.waitForSelector('.playing.lab-on');
    const linked = await tp.evaluate(() => ({ card: window.__v3.game().lab?.setup.card, slots: window.__v3.game().slots }));
    check(linked.card === 'w-cadence' && linked.slots[0] === 'cadence' && errs.length === 0, `?lab=<card> opens that test, holding its weapon (${JSON.stringify(linked)}${errs.length ? `; ${errs[0]}` : ''})`);
    // Rounds and versions: a card changed since its verdict (the Rocket
    // Truck, round 1) is still kept on the device (tests/v3/lab.test.ts has
    // its status); the hub no longer lists it, and still names the round.
    await tp.goto(`${BASE_URL}/v3.html?seed=8`, { waitUntil: 'networkidle' });
    await tp.evaluate(() => {
      const stats = { came: 4, killed: 3, early: 2, harm: 1, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
      localStorage.setItem('straitwatch.v3.lab', JSON.stringify({ results: { rocketTruck: { verdict: 'keep', tags: ['Fun'], note: 'best one so far', waves: 2, ended: 'done', stats, at: '2026-11-08T01:00:00Z' } }, length: 'full', mix: 'normal', queue: [], session: { day: '2026-11-08', ids: [] } }));
    });
    await tp.reload({ waitUntil: 'networkidle' });
    await tp.click('[data-lab]');
    await tp.waitForSelector('[data-screen="lab"]');
    const changed = await tp.evaluate(() => ({ row: !!document.querySelector('[data-card="rocketTruck"]'), round: document.querySelector('[data-screen="lab"] .v3-eyebrow')?.textContent, kept: !!JSON.parse(localStorage.getItem('straitwatch.v3.lab')).results.rocketTruck }));
    check(!changed.row && changed.kept && /Test round 13/.test(changed.round ?? ''), `an old card's verdict stays on the device, off the hub, under the round's name (${JSON.stringify(changed)})`);
    await tp.close();
  }

  // ---- Typing a note on a phone (Test Lab round 5) ----
  // The player: "I still can't see the text box all that great when writing
  // feedback, both horizontal and vertical"; and seven round-4 cards were
  // saved with a note and no verdict. The phone's keyboard is stood in for
  // by a visualViewport cut to what it leaves (874×402 sideways: 150 px;
  // 402×874 upright: 480 px), with iOS's pan of the page under it
  // (offsetTop) too. While typing, the box is big, bright and at the top of
  // what is left, with Keep / Tune / Cut and the Save buttons beside or under
  // it; a verdict picked before typing is kept; Save with none asks for one.
  {
    const FAKE_VV = () => {
      const t = new EventTarget();
      const st = { kb: null };
      const fake = {
        get width() { return window.innerWidth; },
        get height() { return st.kb ? st.kb.h : window.innerHeight; },
        get offsetTop() { return st.kb ? st.kb.top : 0; },
        get offsetLeft() { return 0; },
        get pageTop() { return this.offsetTop; },
        get pageLeft() { return 0; },
        scale: 1,
        addEventListener: (...a) => t.addEventListener(...a),
        removeEventListener: (...a) => t.removeEventListener(...a),
        dispatchEvent: (e) => t.dispatchEvent(e),
      };
      Object.defineProperty(window, 'visualViewport', { get: () => fake, configurable: true });
      window.__kb = (o) => {
        st.kb = o;
        t.dispatchEvent(new Event('resize'));
        t.dispatchEvent(new Event('scroll'));
      };
    };
    const box = (p, sel) => p.evaluate((sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height), w: Math.round(r.width), shown: getComputedStyle(e).display !== 'none' && r.height > 0 };
    }, sel);
    const cases = [
      { name: 'landscape', w: 874, h: 402, kb: 150, top: 0, pick: true },
      { name: 'portrait', w: 402, h: 874, kb: 480, top: 0, pick: false },
      { name: 'landscape, page panned', w: 874, h: 402, kb: 150, top: 120, pick: false },
      { name: 'portrait, page panned', w: 402, h: 874, kb: 480, top: 200, pick: true },
    ];
    for (const c of cases) {
      const kc = await browser.newContext({ viewport: { width: c.w, height: c.h }, hasTouch: true, isMobile: true });
      await kc.addInitScript(FAKE_VV);
      const kp = await kc.newPage();
      const errs = [];
      kp.on('pageerror', (e) => errs.push(e.message));
      // The phone's own keyboard only comes up when the in-game one is off
      // (the store build, a mouse, ?keys=off); with it on, the box takes
      // the in-game keyboard (checked below). Both at once never happens.
      await kp.goto(`${BASE_URL}/v3.html?lab=cloud&seed=8&keys=off`, { waitUntil: 'networkidle' });
      await kp.evaluate(() => localStorage.removeItem('straitwatch.v3.lab'));
      await kp.reload({ waitUntil: 'networkidle' });
      await kp.waitForSelector('.lab-on');
      await kp.waitForTimeout(600);
      await labMenu(kp);
      await kp.evaluate(() => document.querySelector('[data-lab-done]').click());
      await kp.waitForSelector('[data-screen="lab-verdict"]');
      // Sideways: Keep picked first, then the note typed.
      if (c.pick) await kp.locator('[data-lab-verdict="keep"]').tap();
      await kp.locator('#lab-note').tap();
      await kp.evaluate((o) => window.__kb(o), { h: c.kb, top: c.top });
      await kp.keyboard.type('the fire reads well now');
      await kp.waitForTimeout(250);
      const vis = { top: c.top, bottom: c.top + c.kb };
      const lay = {
        typing: await kp.evaluate(() => document.querySelector('.v2-root').classList.contains('typing')),
        font: await kp.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#lab-note')).fontSize)),
        note: await box(kp, '#lab-note'),
        row: await box(kp, '.v3-lab-v'),
        keepOn: await kp.evaluate(() => document.querySelector('[data-lab-verdict="keep"]').classList.contains('on')),
        save: await box(kp, '[data-lab-list]'),
        next: await box(kp, '[data-lab-save-next]'),
        tags: await box(kp, '.v3-lab-tags'),
        title: await box(kp, '.v3-lab-verdict h2'),
      };
      const inside = (r) => r && r.shown && r.top >= vis.top - 1 && r.bottom <= vis.bottom + 1 && r.left >= 0 && r.right <= c.w;
      const big = c.w > c.h ? lay.note.h >= 120 && lay.note.w >= c.w * 0.6 : lay.note.h >= 300 && lay.note.w >= c.w - 20;
      check(
        lay.typing && lay.font >= 16 && inside(lay.note) && lay.note.top <= vis.top + 8 && big && inside(lay.row) && inside(lay.save) && inside(lay.next) && !lay.tags.shown && !lay.title.shown && lay.keepOn === c.pick,
        `typing a verdict note, ${c.name}: the box big (${lay.note?.w}×${lay.note?.h}, ${lay.font} px) at the top of what the keyboard leaves, Keep / Tune / Cut and Save beside or under it, the rest folded away (${JSON.stringify(lay)})`,
      );
      if (!c.pick) {
        // Save with no verdict: it asks, and saves nothing.
        await kp.locator('[data-lab-list]').tap();
        await kp.waitForTimeout(400);
        const asked = await kp.evaluate(() => ({ screen: document.querySelector('.v2-overlay').dataset.screen, need: !document.querySelector('[data-lab-need]').hidden, saved: JSON.parse(localStorage.getItem('straitwatch.v3.lab') || '{"results":{}}').results.cloud ?? null, note: document.querySelector('#lab-note').value }));
        check(asked.screen === 'lab-verdict' && asked.need && asked.saved === null && asked.note === 'the fire reads well now', `${c.name}: Save with no verdict asks for one and saves nothing; the note stays (${JSON.stringify(asked)})`);
        await kp.locator('[data-lab-verdict="keep"]').tap();
      }
      await kp.locator('[data-lab-list]').tap();
      await kp.waitForSelector('[data-screen="lab"]');
      const saved = await kp.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.lab')).results.cloud?.at(-1));
      check(saved?.verdict === 'keep' && saved?.note === 'the fire reads well now' && errs.length === 0, `${c.name}: the verdict ${c.pick ? 'picked before typing is kept through it' : 'picked when asked'} and saved with the note (${JSON.stringify({ verdict: saved?.verdict, note: saved?.note })}${errs.length ? `; ${errs[0]}` : ''})`);
      await kc.close();
    }
    // The in-game keyboard (#232, ui/keys.ts) on a touch phone, upright and
    // sideways: the verdict note and the pause menu's note keep the box and
    // every button above the keyboard's top edge, and Save takes a tap.
    for (const [name, w, h] of [['landscape', 874, 402], ['portrait', 402, 874]]) {
      const kc = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
      const kp = await kc.newPage();
      const errs = [];
      kp.on('pageerror', (e) => errs.push(e.message));
      await kp.goto(`${BASE_URL}/v3.html?lab=cloud&seed=8`, { waitUntil: 'networkidle' });
      await kp.evaluate(() => localStorage.removeItem('straitwatch.v3.lab'));
      await kp.reload({ waitUntil: 'networkidle' });
      await kp.waitForSelector('.lab-on');
      await kp.waitForTimeout(600);
      const above = (sels) => kp.evaluate((sels) => {
        const pk = document.querySelector('.pk.pk-visible')?.getBoundingClientRect();
        const out = { pk: pk ? Math.round(pk.top) : null };
        for (const s of sels) {
          const r = document.querySelector(s)?.getBoundingClientRect();
          out[s] = r && r.height > 0 ? [Math.round(r.top), Math.round(r.bottom)] : null;
        }
        out.ok = !!pk && sels.every((s) => out[s] && out[s][0] >= 0 && out[s][1] <= pk.top + 1);
        return out;
      }, sels);
      // The pause menu's note.
      await labMenu(kp);
      await kp.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-note]').click());
      await kp.waitForSelector('[data-screen="note"]');
      await kp.locator('[data-screen="note"] textarea').tap();
      await kp.waitForTimeout(300);
      const note = await above(['[data-screen="note"] textarea', '[data-screen="note"] .v3-note-save', '[data-screen="note"] .v2-btn:not(.v3-note-save)']);
      check(note.ok, `in-game keyboard, ${name}: the pause menu's note box and its Save and Cancel sit above the keyboard (${JSON.stringify(note)})`);
      await kp.locator('[data-screen="note"] .v2-btn:not(.v3-note-save)').tap();
      await kp.waitForSelector('.v2-pause-panel [data-lab-done]');
      // The verdict note.
      await kp.evaluate(() => document.querySelector('[data-lab-done]').click());
      await kp.waitForSelector('[data-screen="lab-verdict"]');
      await kp.locator('#lab-note').tap();
      await kp.keyboard.type('reads well');
      await kp.waitForTimeout(300);
      const v = await above(['#lab-note', '[data-lab-verdict="keep"]', '[data-lab-verdict="cut"]', '[data-lab-list]', '[data-lab-save-next]']);
      check(v.ok, `in-game keyboard, ${name}: the verdict note, Keep / Tune / Cut and the Save buttons sit above the keyboard (${JSON.stringify(v)})`);
      await kp.locator('[data-lab-verdict="keep"]').tap();
      await kp.locator('[data-lab-list]').tap();
      await kp.waitForSelector('[data-screen="lab"]');
      const saved = await kp.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.lab')).results.cloud?.at(-1));
      check(saved?.verdict === 'keep' && saved?.note === 'reads well' && errs.length === 0, `in-game keyboard, ${name}: Save · back to the list takes the tap and saves the note (${JSON.stringify({ verdict: saved?.verdict, note: saved?.note })}${errs.length ? `; ${errs[0]}` : ''})`);
      await kc.close();
    }
  }

  // ---- Playtest logs reach Claude (playtest-fixes round) ----
  // The player: "I beat that island map after wave 9 and it didn't save, and
  // then I play the next map briefly and that doesn't save either." On an
  // iPhone a send can fail (between networks) and leaving the app fires no
  // pagehide. The won run's sends fail twice; the next run's save carries it,
  // and leaving that run mid-wave seals it as a quit.
  {
    const HOST = 'https://straitwatch-e2e.vercel.app';
    const lc = await browser.newContext({ viewport: { width: 874, height: 402 }, hasTouch: true, isMobile: true });
    const posts = [];
    let wonFails = 0;
    await lc.route(`${HOST}/**`, async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname === '/api/playlog') {
        if (req.method() === 'POST') {
          const j = JSON.parse(req.postData() ?? '{}');
          const fail = j.end === 'won' && ++wonFails <= 2;
          posts.push({ map: j.map, end: j.end ?? null, fail });
          if (fail) return route.fulfill({ status: 503, body: '{"error":"storage unavailable"}' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
      }
      const r = await fetch(`${BASE_URL}${url.pathname}${url.search}`);
      return route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) });
    });
    const lp = await lc.newPage();
    // Wave 11: the Strait's special event (its ten waves come before it;
    // round 7: three runs, waves 11 to 13, the convoy restored first).
    await lp.goto(`${HOST}/v3.html?wave=11`);
    await lp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 2, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: 2, open: [], mapsV: 2 }));
    });
    await lp.reload();
    await lp.locator('[data-map="strait"]').tap();
    const brief = await lp.locator('[data-brief-event="rush"]').textContent();
    check(/Boss rounds:\s*Afterburner Rush, waves 11–13/.test(brief ?? ''), `the briefing names the map's boss rounds and their waves (${brief})`);
    await lp.locator('[data-start]').tap();
    await lp.waitForSelector('.playing');
    await lp.waitForTimeout(400);
    const hud11 = await lp.evaluate(() => ({ hud: document.querySelector('.v2-hud')?.textContent, event: window.__v3.game().event?.id, run: window.__v3.game().event?.run }));
    check(/BOSS\s*1\/3/.test(hud11.hud ?? '') && hud11.event === 'rush' && hud11.run === 1, `round 11: the counter reads BOSS 1/3 on the Afterburner Rush (${JSON.stringify(hud11)})`);
    // Round 12 (the player: "just say like 1/3 ... the text wraps"): the
    // count sits on one line.
    const countLines = await lp.evaluate(() => {
      const span = document.querySelector('.v3-hud-wave');
      const text = [...(span?.childNodes ?? [])].find((n) => n.nodeType === 3);
      if (!text) return -1;
      const r = document.createRange();
      r.selectNodeContents(text);
      return new Set([...r.getClientRects()].map((q) => Math.round(q.top))).size;
    });
    check(countLines === 1, `the boss count "1/3" sits on one line (${countLines} lines)`);
    // Log v30 (the player: "have it say 'boss round', then 'live reset',
    // then what it is ... then 'round one', so each text is like a new card
    // pop up"): the intro is a sequence of cards through the calm, each
    // popping in, and no launch before the last.
    const cards = [];
    for (let i = 0; i < 120 && cards.length < 4; i++) {
      const c = await lp.evaluate(() => {
        const card = document.querySelector('.v3-event-card.show.boss-intro');
        const g = window.__v3.game();
        return card ? { key: card.dataset.bossKey, n: card.dataset.bossCard, eyebrow: card.querySelector('.v3-event-eyebrow')?.textContent ?? '', name: card.querySelector('.v3-event-name')?.textContent ?? '', sub: card.querySelector('.v3-event-boss')?.textContent ?? '', pop: card.classList.contains('pop'), launched: g.threats.length, t: Math.round(g.waveT * 10) / 10 } : null;
      });
      if (c && c.key !== cards[cards.length - 1]?.key) {
        cards.push(c);
        await lp.waitForTimeout(450);
        await lp.screenshot({ path: `${SHOT_DIR}/15-boss-card-${cards.length}.png` });
      }
      await lp.waitForTimeout(100);
    }
    const seq = cards.map((c) => `${c.n} ${c.key}: ${c.eyebrow ? `${c.eyebrow} / ` : ''}${c.name}${c.sub ? ` / ${c.sub}` : ''} @${c.t}s`).join(' | ');
    check(cards.map((c) => c.key).join() === 'boss,restore,name,round', `round 11 (log v30): four cards pop up in turn, boss round, the convoy, the boss, the round (${seq})`);
    check(/^Boss round$/i.test(cards[0]?.name ?? '') && /convoy restored/i.test(cards[1]?.name ?? '') && /\d ships? can still be lost/i.test(cards[1]?.sub ?? '') && cards[2]?.name === 'Afterburner Rush' && /^Boss 1\/3$/.test(cards[3]?.name ?? '') && /Survive the next 3 rounds/.test(cards[3]?.sub ?? ''), `the cards read BOSS ROUND, Convoy restored (the ships that can still be lost), the boss's name, Boss 1/3 (${seq})`);
    check(cards.every((c) => c.pop && c.launched === 0), `each card pops in, and nothing flies while they read (${seq})`);
    // Rounds 2 and 3: one short card each, Boss 2/3 and Boss 3/3 (round 12).
    const later = new Set();
    for (let i = 0; i < 400; i++) {
      const ph = await lp.evaluate(() => {
        const g = window.__v3.game();
        // Each round runs to its card's end before it is emptied.
        if (!document.querySelector('.v3-event-card.show.boss-intro')) {
          g.threats = []; g.queue = []; g.raiderQueue = []; g.raids = []; if (g.event) g.event.plan = [];
        }
        const c = document.querySelector('.v3-event-card.show.boss-intro');
        return { phase: g.phase, card: c ? `${c.querySelector('.v3-event-eyebrow')?.textContent ?? ''} / ${c.querySelector('.v3-event-name')?.textContent}` : '' };
      });
      if (ph.card) later.add(ph.card);
      if (ph.phase !== 'wave' && ph.phase !== 'draft') break;
      await lp.waitForTimeout(100);
    }
    check(later.has('Afterburner Rush / Boss 2/3') && later.has('Afterburner Rush / Boss 3/3'), `rounds 2 and 3 open on a short card each (${[...later].join(' | ')})`);
    await lp.waitForSelector('[data-screen="result"]');
    const resEv = await lp.evaluate(() => { const e = document.querySelector('[data-result-event]'); return `${e?.dataset.resultEvent} | ${e?.dataset.resultEnding}`; });
    check(resEv === 'rush:clean rush:clean rush:clean | clean', `the result screen lists the three runs and the ending as a whole (${resEv})`);
    await lp.waitForTimeout(1200);
    await lp.locator('[data-screen="result"] .v2-btn:has-text("Next")').tap();
    await lp.locator('[data-start]').tap();
    await lp.waitForSelector('.playing');
    await lp.waitForTimeout(1500);
    await lp.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await lp.waitForTimeout(2500);
    const wonFailed = posts.filter((p) => p.map === 'strait' && p.end === 'won' && p.fail).length;
    const wonArrived = posts.some((p) => p.map === 'strait' && p.end === 'won' && !p.fail);
    const quit = posts.some((p) => p.map === 'kesh' && p.end === 'quit');
    check(wonFailed === 2 && wonArrived, `a won run whose sends failed twice still arrives with the next save (${JSON.stringify(posts)})`);
    check(quit, 'leaving the app mid-wave (no pagehide) seals the run as a quit');
    await lc.close();
  }

  // ---- Round 12: the Test Lab's Retry wave N and Skip to boss ----
  // The player: "when I fail like this in the test lab have an option to
  // reset that wave so I can try again or I can also skip forward to the
  // boss wave". On the pause menu and the end screen of a test; each starts
  // a new log marked `retry`.
  {
    const rp = await browser.newPage({ viewport: { width: 874, height: 402 }, hasTouch: true });
    const errs = [];
    rp.on('pageerror', (e) => errs.push(e.message));
    await rp.goto(`${BASE_URL}/v3.html?lab=map-island&seed=11`, { waitUntil: 'networkidle' });
    await rp.evaluate(() => localStorage.removeItem('straitwatch.v3.lab'));
    await rp.reload({ waitUntil: 'networkidle' });
    await rp.waitForSelector('.lab-on');
    await rp.waitForTimeout(800);
    await labMenu(rp);
    const pauseJumps = await rp.evaluate(() => ({ retry: document.querySelector('.v2-pause-panel [data-lab-retry]')?.textContent, skip: !!document.querySelector('.v2-pause-panel [data-lab-skip]') }));
    check(pauseJumps.retry === 'Retry wave 1' && pauseJumps.skip, `a full map test's pause menu has Retry wave 1 and Skip to boss (${JSON.stringify(pauseJumps)})`);
    const first = await rp.evaluate(() => window.__v3.log().id);
    await rp.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-skip]').click());
    await rp.waitForFunction(() => window.__v3.game()?.wave === 11 && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    const skipped = await rp.evaluate(() => { const g = window.__v3.game(); const l = window.__v3.log(); return { wave: g.wave, event: g.event?.run, runs: g.event?.runs, retry: l.retry, first: l.firstWave, lab: !!l.lab?.loadout, on: document.querySelector('.v2-root').classList.contains('lab-on'), hud: document.querySelector('.v3-hud-wave')?.dataset.waveCount }; });
    check(skipped.wave === 11 && skipped.event === 1 && skipped.runs === 3 && skipped.retry?.skip === true && skipped.retry?.of === first && skipped.first === 11 && skipped.lab && skipped.on && skipped.hud === 'BOSS 1/3', `Skip to boss: a new log from boss round 1, marked as a skip of the run before, still in the Test Lab (${JSON.stringify(skipped)})`);
    await rp.waitForTimeout(1500);
    await labMenu(rp);
    const second = await rp.evaluate(() => window.__v3.log().id);
    const retryLabel = await rp.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-retry]')?.textContent);
    check(retryLabel === 'Retry the boss rounds' && !(await rp.$('.v2-pause-panel [data-lab-skip]')), `in the boss rounds: Retry the boss rounds, no Skip (${retryLabel})`);
    // Done, then Retry from the end screen.
    await rp.evaluate(() => document.querySelector('.v2-pause-panel [data-lab-done]').click());
    await rp.waitForSelector('[data-screen="lab-verdict"] [data-lab-jumps] [data-lab-retry]');
    await rp.evaluate(() => document.querySelector('[data-lab-jumps] [data-lab-retry]').click());
    await rp.waitForFunction(() => window.__v3.game()?.phase === 'wave' && !document.querySelector('.v2-overlay.open'), null, { timeout: 10000 });
    const retried = await rp.evaluate(() => { const g = window.__v3.game(); const l = window.__v3.log(); return { wave: g.wave, waveT: g.waveT, retry: l.retry, levels: g.levels }; });
    check(retried.wave === 11 && retried.waveT < 2 && retried.retry?.of === second && retried.retry?.wave === 11 && !retried.retry?.skip, `Retry from the end screen: boss round 1 again from its start, a new log marked as a retry of the run before (${JSON.stringify(retried)})`);
    check(errs.length === 0, `no page errors in the Test Lab jumps (${errs.join('; ')})`);
    await rp.close();
  }
} finally {
  await browser.close();
}
