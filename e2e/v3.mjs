// V3 browser smoke test. Expects `vite preview` (or dev) at BASE_URL.
// Drives: menu → Armory (buy a level with seeded salvage) → gun picker →
// map 1 → weapon pickups through real input (tap the pickup, then tap to
// fire it: Railgun, Air Strike, Flak, Cryo, Gravity Well, Seekers, Aegis) →
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
  // A save with salvage to spend.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.progress', JSON.stringify({ unlocked: 1, best: {}, salvage: 500, earned: 500, armory: {}, cleared: [] }));
  });
  await page.reload({ waitUntil: 'networkidle' });

  // ---- Menu and Armory ----
  await page.waitForSelector('[data-screen="menu"]');
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  check((await page.locator('.v3-armory-strip').textContent()).includes('500 salvage'), 'menu shows the salvage banked');
  await page.click('.v3-armory-strip');
  await page.waitForSelector('[data-screen="armory"]');
  await page.click('[data-buy="warhead"]');
  await page.screenshot({ path: `${SHOT_DIR}/02-armory.png` });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('straitwatch.v3.progress')));
  check(saved.armory.warhead === 1 && saved.salvage === 420, `bought Wide Warhead 1 (salvage ${saved.salvage})`);
  await page.click('[data-screen="armory"] .v2-btn.primary:has-text("Back")');
  await page.waitForSelector('[data-screen="menu"]');

  // ---- A run: with an upgrade owned, the map asks which ONE it takes ----
  await page.click('[data-map="strait"]');
  await page.waitForSelector('[data-screen="loadout"]');
  check((await page.locator('.v3-gun.on').getAttribute('data-gun')) === 'warhead', 'the gun picker has the bought upgrade equipped');
  check(await page.locator('.v3-gun[data-gun="reload"]').isDisabled(), 'an upgrade not bought cannot be picked');
  await page.screenshot({ path: `${SHOT_DIR}/02b-gun-picker.png` });
  await page.click('[data-start]');
  await page.waitForSelector('.playing');
  const blast = await page.evaluate(() => window.__v3.game().stats.blast);
  check(Math.abs(blast - 22 * 1.4) < 1e-6, `the run's gun has the Armory's warhead (blast ${blast})`);
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
  check((await page.locator('.v2-alert').allTextContents()).some((t) => t.includes('RAILGUN')), 'a notice says what was loaded and how to fire it');
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
    cryo: { open: true, ok: () => window.__v3.game().interceptors.some((i) => i.weapon?.id === 'cryo') },
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
        g.threats.push({ id: 80000 + g.nextId++, kind: 'heavy', x: 900, y: 300, vx: 0, vy: 0, hp: 99, speed: 0, heading: 0, target: -1, age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0, frozenT: 99 });
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
  check(logged.v === 9 && logged.acts === 0 && logged.game === 'v3' && logged.armory.warhead === 1, `log v${logged.v}: taps only, the armory recorded`);

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
  check((await page.locator('.v3-card-how').first().textContent()).startsWith('Drops as a pickup · 15 s'), 'each card says it drops as a pickup for 15 s');
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
