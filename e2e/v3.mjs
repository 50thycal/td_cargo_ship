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
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 1, best: {}, cards: 4, armory: { warhead: 1, magazine: 2, pointdef: 1 }, equipped: { gun: 'magazine', hull: null, supply: null }, cleared: [] }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // ---- Menu and Armory ----
  await page.waitForSelector('[data-screen="menu"]');
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  check((await page.locator('.v3-armory-strip').textContent()).includes('4 cards found'), 'menu shows the Armory cards found');
  await page.click('.v3-armory-strip');
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
  await page.click('[data-screen="armory"] .v2-btn.primary:has-text("Back")');
  await page.waitForSelector('[data-screen="menu"]');

  // ---- A run: with an upgrade owned, the map asks which ONE it takes ----
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
  check((await page.locator('.v2-timer').first().textContent()).includes('RAILGUN'), 'the left rail times it like a power-up');
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
    aegis: { open: false, ok: () => !!window.__v3.game().carrierDome },
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
  check(logged.v === 11 && logged.acts === 0 && logged.game === 'v3' && logged.armory.warhead === 1 && logged.armory.pointdef === 1, `log v${logged.v}: taps only, the armory recorded`);

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

  // ---- V2 round 14's notification tray, on every map ----
  // A busy late wave played by the watch bot (which also grabs weapons, so
  // weapon notices compete for the tray). Cards never overlap each other or
  // the carrier, never leave the screen, and never exceed the map's limit.
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
    const tp = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    tp.on('pageerror', (err) => fail(`page error: ${err.message}`));
    await tp.goto(`${BASE_URL}/v3.html?seed=31`, { waitUntil: 'networkidle' });
    await tp.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('straitwatch.v3.dev', '1');
      localStorage.setItem('straitwatch.v3.dev.settings', JSON.stringify({ preset: 'full', wave: 6, watch: true, watchSpeed: 3, bot: 'you', armory: 'yours' }));
    });
    await tp.reload({ waitUntil: 'networkidle' });
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
} finally {
  await browser.close();
}
