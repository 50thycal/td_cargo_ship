// V3 browser smoke test. Expects `vite preview` (or dev) at BASE_URL.
// Drives: menu → Armory (buy a level with seeded salvage) → map 1 → each
// kind of ability activation through real input (button, swipe a line,
// press-and-hold, takeover taps, tap a target) → defends to the draft →
// picks an ability → phone-size layout. Fails on any page error.
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

/** Hold these abilities (level 1, fully charged) in slots 0–2. */
async function equip(page, ids, level = 1) {
  await page.evaluate(
    ([ids, level]) => {
      const g = window.__v3.game();
      g.levels = Object.fromEntries(ids.map((id) => [id, level]));
      g.slots = [...ids];
      g.charge = Object.fromEntries(ids.map((id) => [id, 999]));
      g.gunMode = null;
    },
    [ids, level],
  );
  await page.waitForTimeout(80);
}

const uses = (page, id) => page.evaluate((id) => window.__v3.game().uses[id] ?? 0, id);
/** The button for an ability (buttons follow the order abilities were taken in). */
const slotOf = (page, id) => page.locator(`.v3-ability[data-ability="${id}"]`);
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

  // Button: EMP Pulse.
  await equip(page, ['emp', 'airstrike', 'salvo']);
  await page.screenshot({ path: `${SHOT_DIR}/03-abilities-ready.png` });
  check((await page.locator('.v3-ability.ready').count()) === 3, 'three ready ability buttons');
  await slotOf(page, 'emp').click();
  check((await uses(page, 'emp')) === 1, 'EMP Pulse fires from its button');

  // Line: Air Strike — arm, then swipe across the screen.
  await slotOf(page, 'airstrike').click();
  check(await slotOf(page, 'airstrike').evaluate((b) => b.classList.contains('armed')), 'Air Strike arms');
  const a = await w2c(page, 200, 300);
  const b = await w2c(page, 1300, 360);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
  await page.screenshot({ path: `${SHOT_DIR}/04-swipe-aim.png` });
  await page.mouse.move(b.x, b.y, { steps: 4 });
  await page.mouse.up();
  check((await uses(page, 'airstrike')) === 1, 'Air Strike flies the swiped line');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOT_DIR}/05-airstrike.png` });

  // Hold: Hellfire Salvo — press, hold, release.
  await slotOf(page, 'salvo').click();
  const h = await w2c(page, 800, 300);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOT_DIR}/06-hold-aim.png` });
  await page.mouse.up();
  check((await uses(page, 'salvo')) === 1, 'Hellfire Salvo fires on release');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOT_DIR}/07-salvo.png` });

  // Takeover: Railgun — the next taps fire beams, no ammo needed.
  await equip(page, ['railgun', 'smoke', 'hunter']);
  await slotOf(page, 'railgun').click();
  check((await page.evaluate(() => window.__v3.game().gunMode?.id)) === 'railgun', 'Railgun takes over the gun');
  const r = await w2c(page, 900, 200);
  await page.mouse.click(r.x, r.y);
  await page.waitForTimeout(60);
  await page.screenshot({ path: `${SHOT_DIR}/08-railgun.png` });
  await page.mouse.click(r.x, r.y);
  check((await page.evaluate(() => window.__v3.game().gunMode)) === null, 'Railgun hands the gun back after its shots');

  // Line again: Smoke Wall along a lane.
  const lane = await page.evaluate(() => window.__v3.game().map.channels[0].y);
  await slotOf(page, 'smoke').click();
  const s1 = await w2c(page, 300, lane);
  const s2 = await w2c(page, 900, lane);
  await page.mouse.move(s1.x, s1.y);
  await page.mouse.down();
  await page.mouse.move(s2.x, s2.y, { steps: 6 });
  await page.mouse.up();
  check((await page.evaluate(() => window.__v3.game().fields.filter((f) => f.kind === 'smoke').length)) === 1, 'Smoke Wall lays smoke along the drag');
  await page.screenshot({ path: `${SHOT_DIR}/09-smoke.png` });

  // Target: Sub Hunter with nothing there stays armed; the cancel works.
  await slotOf(page, 'hunter').click();
  const empty = await w2c(page, 800, 450);
  await page.mouse.click(empty.x, empty.y);
  check((await uses(page, 'hunter')) === 0 && (await slotOf(page, 'hunter').evaluate((b) => b.classList.contains('armed'))), 'Sub Hunter on empty water stays armed');
  await slotOf(page, 'hunter').click();
  check(!(await slotOf(page, 'hunter').evaluate((b) => b.classList.contains('armed'))), 'pressing an armed button disarms it');

  // The log carries those activations (EMP, Air Strike, Salvo, Railgun,
  // Smoke — not the Sub Hunter that found nothing) and the Armory.
  const replay = await page.evaluate(() => {
    const log = window.__v3.log();
    return { acts: log.commands.filter((c) => c[1] === 'a').length, game: log.game, armory: log.armory };
  });
  check(replay.acts === 5 && replay.game === 'v3' && replay.armory.warhead === 1, `log records ${replay.acts} activations and the armory`);

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
  check(offer >= 3, `draft deals ${offer} ability cards`);
  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction(() => window.__v3.game()?.phase === 'wave', null, { timeout: 5000 });
  const held = await page.evaluate(() => Object.keys(window.__v3.game().levels).length);
  check(held === 1, 'the picked ability is held');
  check((await page.locator('.v3-ability:not(.empty)').count()) === 1, 'its button appears');
  // Playtest round 1: a new ability starts empty (it used to start half full)
  // and only an ability that is ready glows.
  check((await page.locator('.v3-ability.charging .v3-ability-tag').first().textContent()) === '0%', 'a new ability starts empty (0%)');
  check((await page.locator('.v3-ability.empty').evaluateAll((bs) => bs.every((b) => getComputedStyle(b).animationName === 'none'))), 'empty slots never animate');

  // ---- Phone landscape ----
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  await equip(page, ['emp', 'railgun', 'decoy'], 3);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOT_DIR}/11-phone.png` });
  const rail = await page.locator('.v2-rail-right').boundingBox();
  const last = await page.locator('.v3-ability').nth(2).boundingBox();
  check(last.y + last.height <= rail.y + rail.height + 1 && last.y + last.height <= 390, `ability buttons fit on a phone (bottom ${Math.round(last.y + last.height)} of 390)`);

  // ---- V2 round 14's notification tray, on every map ----
  // A busy late wave played by the watch bot (which also fires abilities, so
  // ability notices compete for the tray). Cards never overlap each other or
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
