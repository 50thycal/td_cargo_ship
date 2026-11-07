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

  // ---- Menu and Armory ----
  await page.waitForSelector('[data-screen="menu"]');
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  check((await page.locator('.v3-armory-btn').getAttribute('data-cards')) === '4' && (await page.locator('.v3-armory-btn .v3-count').textContent()) === '4', 'menu shows the Armory cards found');
  await page.click('.v3-armory-btn');
  await page.waitForSelector('[data-screen="armory"]');
  // Round 7: every upgrade is a card; the ones not won yet are greyed out.
  check((await page.locator('.v3-armory-card').count()) === 5, 'the Gun bay shows its five cards');
  check(await page.locator('.v3-armory-card[data-armory="reload"]').isDisabled(), 'a card not won yet cannot be equipped');
  check((await page.locator('.v3-armory-card[data-armory="warhead"] .v2-card-text').textContent()).length > 10, 'a card says what it does');
  await page.click('.v3-armory-card[data-armory="warhead"]');
  await page.click('[data-bay="hull"]');
  await page.click('.v3-armory-card[data-armory="pointdef"]');
  await page.screenshot({ path: `${SHOT_DIR}/02-armory.png` });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
  check(saved.equipped.gun === 'warhead' && saved.equipped.hull === 'pointdef' && saved.armory.warhead === 1, `equipped one card from each bay (${JSON.stringify(saved.equipped)})`);
  check(!('salvage' in saved) && !(await page.locator('[data-buy]').count()), 'nothing is bought: no salvage, no Upgrade buttons');
  await page.click('[data-bay="supply"]');
  check((await page.locator('.v3-armory-card:disabled').count()) === 3, 'the Supply bay: three cards, none won yet');
  await page.click('[data-screen="armory"] [data-back]');
  await page.waitForSelector('[data-screen="menu"]');

  // ---- A run: the map's briefing asks which ONE upgrade each bay gives ----
  await page.click('[data-map="strait"]');
  await page.waitForSelector('[data-screen="loadout"]');
  check((await page.locator('[data-bay="gun"] .v3-gun.on').getAttribute('data-gun')) === 'warhead' && (await page.locator('[data-bay="hull"] .v3-gun.on').getAttribute('data-gun')) === 'pointdef', 'the loadout picker has one upgrade from each open bay');
  check(!(await page.locator('.v3-gun[data-gun="reload"]').count()) && !(await page.locator('.v3-bay-row[data-bay="supply"]').count()), 'only cards won can be picked');
  await page.screenshot({ path: `${SHOT_DIR}/02b-gun-picker.png` });
  await page.click('[data-start]');
  await page.waitForSelector('.playing');
  const blast = await page.evaluate(() => window.__v3.game().stats.blast);
  check(Math.abs(blast - 22 * 1.4) < 1e-6, `the run's gun has the Armory's warhead (blast ${blast})`);
  check((await page.evaluate(() => window.__v3.game().stats.pdGap)) > 0, 'the run has the Hull bay\'s Point Defense');
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
  check(logged.v === 14 && logged.acts === 0 && logged.game === 'v3' && logged.armory.warhead === 1 && logged.armory.pointdef === 1, `log v${logged.v}: taps only, the armory recorded`);

  // ---- Defend to the draft ----
  await equip(page, []);
  for (let i = 0; i < 900; i++) {
    const phase = await page.evaluate(() => window.__v3.game()?.phase);
    if (phase !== 'wave') break;
    await defend(page);
    await page.waitForTimeout(40);
  }
  await page.waitForSelector('[data-screen="draft"]', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOT_DIR}/10-draft.png` });
  const offer = await page.locator('.v2-card').count();
  check(offer >= 3, `draft deals ${offer} weapon cards`);
  check((await page.locator('.v2-draft h2').textContent()) === 'Choose your weapon', 'the draft asks for a weapon');
  check(!(await page.locator('.v2-draft').textContent()).includes('15 s in the gun') && !/EVOLVES:/.test(await page.locator('.v2-card-row').textContent()), 'cards carry only their own text (no repeated drop rule, no "EVOLVES:")');
  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 5000 });
  const held = await page.evaluate(() => Object.keys(window.__v3.game().levels).length);
  check(held === 1, 'the picked weapon is held');
  check((await page.locator('.v3-weapon.held').count()) === 1, 'its loadout chip appears, not loaded');
  check((await page.locator('.v3-weapon').evaluateAll((bs) => bs.every((b) => getComputedStyle(b).animationName === 'none'))), 'nothing in the loadout animates');

  // ---- Playtest notes: pause and say something; rate a volley ----
  check((await page.locator('.v3-note-btn').textContent()).includes('NOTE') || (await page.locator('.v3-note-btn.rate').count()) === 1, 'the rail has the note button');
  await page.locator('.v2-pause').click();
  await page.locator('.v3-pause-note').click();
  const steps0 = await page.evaluate(() => window.__v3.game().steps);
  await page.locator('.v3-note-tag[data-tag="hard"]').click();
  await page.locator('.v3-note-text').fill('Heavy from the north with no warning');
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
  // Defend until a volley ends and the button turns to RATE.
  let rate = false;
  for (let i = 0; i < 600 && !rate; i++) {
    await defend(page);
    await page.waitForTimeout(40);
    rate = (await page.locator('.v3-note-btn.rate').count()) === 1;
    if ((await page.evaluate(() => window.__v3.game()?.phase)) !== 'wave') break;
  }
  check(rate, 'after a volley the note button offers to rate it');
  if (rate) {
    await page.locator('.v3-note-btn').click();
    await page.locator('[data-axis="difficulty"] [data-n="4"]').click();
    await page.locator('[data-axis="fun"] [data-n="5"]').click();
    await page.locator('[data-axis="intensity"] [data-n="2"]').click();
    await page.screenshot({ path: `${SHOT_DIR}/14-rate.png` });
    await page.locator('.v3-note-save').click();
    const rated = await page.evaluate(() => (window.__v3.log().volleys ?? []).filter((v) => v.rating));
    check(rated.length === 1 && rated[0].rating.difficulty === 4 && rated[0].rating.fun === 5 && rated[0].rating.intensity === 2, 'the rating lands on its volley');
    check((await page.evaluate(() => document.querySelector('.v2-overlay')?.classList.contains('open'))) === false, 'rating from the rail resumes the game');
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
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')).cards);
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
  check(after.cards === before + 1 && (await page.locator('.v3-won-cards .v3-armory-card').count()) === 1, `a lost run that cleared 3 waves wins one Armory card, shown as a card (${before} → ${after.cards})`);

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

  // ---- V2 round 14's notification tray, on every map ----
  // A busy late wave played by the watch bot (which also grabs weapons, so
  // weapon notices compete for the tray). Cards never overlap each other or
  // the carrier, never leave the screen, and never exceed the map's limit.
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
        const cards = [...document.querySelectorAll('.v2-alert')].map((e) => e.getBoundingClientRect());
        const c = g.map.carrier;
        const a = window.__v3.toClient(c.x - 80, c.y - 26);
        const b = window.__v3.toClient(c.x + 80, c.y + 26);
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
      const bad = [
        r.n > r.max && `${r.n} notices up (limit ${r.max})`,
        r.overlap && 'notices overlap each other',
        r.onCarrier && 'a notice covers the carrier',
        r.off && 'a notice runs off the screen',
      ].filter(Boolean);
      for (const b of bad) fail(`${map} ${w}×${h}: ${b}`);
      if (bad.length) break;
      await tp.waitForTimeout(120);
    }
    if (most === 0) fail(`${map}: no notices seen in a busy wave`);
    if (samples < 20) fail(`${map}: only ${samples} samples before the wave ended`);
    console.log(`ok: tray on ${map} ${w}×${h}: ${samples} samples, up to ${most} cards at once, no overlaps`);
    if (map === 'island' && w === 874) await tp.screenshot({ path: `${SHOT_DIR}/12-island-tray.png` });
    await tp.close();
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
    check(fpList.all === 29 && fpList.protos === 0, `Free Play offers all 29 weapons, none a prototype after the lock-in (${JSON.stringify(fpList)})`);
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
    await wp.waitForTimeout(2600);
    after = await st();
    const helis = await wp.evaluate(() => window.__v3.game().helis.length);
    check(helis === 2 && after.alive.length === 0, `Gunship Pair: two helicopters arrive and rocket the pack (${helis} helis, ${after.alive.length} left)`);

    await place([]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.queue = [0.5, 1, 1.5, 2, 2.5].map((dt) => ({ at: g.waveT + 1.6 + dt, kind: 'drone', base: 0 })).concat([{ at: 1e9, kind: 'drone', base: 0 }]); });
    await pickup('bomberWing');
    await wp.waitForTimeout(2200);
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
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.railgun = 1; g.weapon = { id: 'railgun', level: 1, t: 15, t0: g.t }; g.levels.timeWarp = 1; if (!g.slots.includes('timeWarp')) g.slots.push('timeWarp'); });
    await dropWeapon(wp, 'timeWarp', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    const tw = await wp.evaluate(() => { const g = window.__v3.game(); return { boost: g.boost?.id, weapon: g.weapon?.id }; });
    check(tw.boost === 'timeWarp' && tw.weapon === 'railgun', `a boost runs beside the loaded weapon: Time Warp with the Railgun (${JSON.stringify(tw)})`);

    // Focus: a finger down slows time; lifting it stops.
    await place([['drone', 1, 600, 200]]);
    await wp.evaluate(() => { const g = window.__v3.game(); g.levels.focus = 1; if (!g.slots.includes('focus')) g.slots.push('focus'); });
    await dropWeapon(wp, 'focus', 640, 560);
    p = await c(640, 560);
    await wp.mouse.click(p.x, p.y);
    p = await c(1200, 400);
    await wp.mouse.move(p.x, p.y);
    await wp.mouse.down();
    await wp.waitForTimeout(400);
    const slow = await wp.evaluate(() => { const g = window.__v3.game(); return { focusing: g.focusing, bank: g.boost?.bank }; });
    await wp.mouse.up();
    await wp.waitForTimeout(100);
    const fast = await wp.evaluate(() => window.__v3.game().focusing);
    check(slow.focusing && slow.bank < 6 && !fast, `Focus: a finger down slows time and spends the bank; lifting it stops (${JSON.stringify(slow)}, after: ${fast})`);

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

    const replayed = await wp.evaluate(() => { const r = window.__v3.replay(window.__v3.log()); const g = window.__v3.game(); return { same: r.steps === g.steps, kinds: [...new Set(window.__v3.log().commands.map((c) => c[1]))] }; });
    check(replayed.kinds.includes('d') && replayed.kinds.includes('v') && replayed.kinds.includes('r'), `the play log records presses, moves and lifts (${replayed.kinds.join('')})`);
    await wp.close();
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
    await lp.goto(`${HOST}/v3.html?wave=10`);
    await lp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 2, best: {}, cards: 0, armory: {}, equipped: { gun: null, hull: null, supply: null }, cleared: [], armoryV: 2, open: [], mapsV: 2 }));
    });
    await lp.reload();
    await lp.locator('[data-map="strait"]').tap();
    await lp.locator('[data-start]').tap();
    await lp.waitForSelector('.playing');
    for (let i = 0; i < 400; i++) {
      const ph = await lp.evaluate(() => { const g = window.__v3.game(); g.threats = []; g.queue = []; g.raiderQueue = []; g.raids = []; return g.phase; });
      if (ph !== 'wave') break;
      await lp.waitForTimeout(100);
    }
    await lp.waitForSelector('[data-screen="result"]');
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
} finally {
  await browser.close();
}
