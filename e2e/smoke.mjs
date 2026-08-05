// Browser smoke test: builds nothing itself — expects `vite preview` (or dev)
// to be reachable at PORT. Drives a full roguelite round: menu → region select
// → commander loadout → prep → transit (with interceptor taps) → after-action
// report → technology draft → next prep.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/smoke.mjs
// Env:    BASE_URL (default http://localhost:4173)
//         SHOT_DIR (default e2e/shots) — screenshots per phase

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const SHOT_DIR = process.env.SHOT_DIR ?? 'e2e/shots';
mkdirSync(SHOT_DIR, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers'].filter(Boolean);
  for (const root of roots) {
    const direct = `${root}/chromium`;
    if (existsSync(direct) && !readdirSync(root).includes('chromium/')) {
      try {
        // `chromium` may be a launcher binary/symlink installed by the env.
        if (!readdirSync(direct, { withFileTypes: true }).length) return direct;
      } catch {
        return direct; // not a directory → treat as executable
      }
    }
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidate = `${root}/${entry}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined; // let playwright-core try its own registry
}

const executablePath = findChromium();
const browser = await chromium.launch({
  executablePath,
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message);
    process.exitCode = 1;
  });

  console.log(`loading ${BASE_URL} ...`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // --- Menu ---------------------------------------------------------------
  await page.waitForSelector('[data-screen="menu"]', { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT_DIR}/01-menu.png` });
  await page.evaluate(() => localStorage.clear());
  await page.getByRole('button', { name: 'Begin Regional Run' }).click();

  // --- Region select ---------------------------------------------------------
  await page.waitForSelector('[data-screen="regionSelect"]', { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT_DIR}/01b-region-select.png` });
  // Region 2 must be visibly locked on a fresh profile.
  const lockedCount = await page.locator('.card.locked').count();
  if (lockedCount < 1) throw new Error('expected the second region to be locked on a fresh profile');
  await page.getByRole('button', { name: /Deploy to Home Strait/ }).click();

  // --- Commander loadout -------------------------------------------------------
  await page.waitForSelector('[data-screen="loadout"]', { timeout: 10_000 });
  // Equip a zero-cost standing ability, then launch the run.
  await page.getByRole('button', { name: 'Equip' }).first().click();
  await page.screenshot({ path: `${SHOT_DIR}/01c-loadout.png` });
  await page.getByRole('button', { name: /Start Run/ }).click();

  // --- Prep ----------------------------------------------------------------
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
  await page.waitForTimeout(900); // let the entry stagger finish before shooting
  await page.screenshot({ path: `${SHOT_DIR}/02-prep.png` });
  await page.getByRole('button', { name: 'Begin Transit' }).click();

  // --- Transit ---------------------------------------------------------------
  await page.waitForSelector('#hud-bottom', { timeout: 10_000 });
  // Let the round develop, then screenshot mid-action.
  await page.waitForTimeout(16_000);
  await page.screenshot({ path: `${SHOT_DIR}/03-transit.png` });

  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();

  // Speed the round up (1× → 2× → 3×) and tap around the upper half of the map
  // to attempt interceptions (missiles come from the top shore).
  await page.getByRole('button', { name: '1×' }).click();
  await page.getByRole('button', { name: '2×' }).click();
  const deadline = Date.now() + 180_000;
  let aarSeen = false;
  while (Date.now() < deadline) {
    if (await page.locator('[data-screen="aar"]').count()) {
      aarSeen = true;
      break;
    }
    if (box) {
      const x = box.x + box.width * (0.2 + Math.random() * 0.6);
      const y = box.y + box.height * (0.1 + Math.random() * 0.4);
      await page.mouse.click(x, y).catch(() => {});
    }
    await page.waitForTimeout(600);
  }
  if (!aarSeen) throw new Error('after-action report never appeared');

  // --- AAR ----------------------------------------------------------------------
  // The report reveals as a click-through sequence: tap the debrief until the
  // footer (Continue button) appears, then let count-up animations settle.
  const seqDeadline = Date.now() + 30_000;
  while (Date.now() < seqDeadline) {
    const contVisible = await page
      .getByRole('button', { name: /Continue to Technology Draft|Continue to Preparation|Final Report/ })
      .isVisible()
      .catch(() => false);
    if (contVisible) break;
    await page
      .locator('[data-screen="aar"] .screen-body')
      .click({ position: { x: 30, y: 30 } })
      .catch(() => {});
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1100);
  await page.screenshot({ path: `${SHOT_DIR}/04-aar.png` });
  const delivered = await page.locator('.stat .value').first().textContent();
  console.log('AAR delivered stat:', delivered);

  // Download the game log and validate the JSON payload.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    page.getByRole('button', { name: 'Download game log' }).click(),
  ]);
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream) raw += chunk;
  const log = JSON.parse(raw);
  if (log.game !== 'straitwatch' || !Array.isArray(log.rounds) || log.rounds.length < 1) {
    throw new Error('game log JSON missing expected fields');
  }
  console.log(`game log OK: ${log.rounds.length} round(s), filename ${download.suggestedFilename()}`);

  await page.getByRole('button', { name: /Continue to Technology Draft/ }).click();

  // --- Technology draft -------------------------------------------------------------
  await page.waitForSelector('[data-screen="draft"]', { timeout: 10_000 });
  await page.waitForTimeout(900); // entry stagger
  // The mandatory draft offers 2-3 option cards, each with a Draft button.
  const optionCount = await page.locator('.draft-option').count();
  if (optionCount < 2 || optionCount > 3) {
    throw new Error(`expected 2-3 draft options, saw ${optionCount}`);
  }
  // There is no skip: the footer carries no Continue button while options wait.
  const continueOnDraft = await page
    .getByRole('button', { name: 'Continue to Preparation' })
    .count();
  if (continueOnDraft > 0) throw new Error('draft offered a way past without picking');
  await page.screenshot({ path: `${SHOT_DIR}/05-draft.png` });
  await page.locator('.draft-option button').first().click();
  console.log(`technology draft OK: ${optionCount} options, pick advanced the run`);

  // --- Round 2 prep -------------------------------------------------------------------
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
  await page.waitForTimeout(900); // entry stagger
  // Platform loadout panels: the escort flotilla and shore-base slots must be
  // visible. (The escort panel became "Escort flotilla" with the individual-
  // escort model in PR #28.)
  for (const label of [/Escort flotilla/, /Shore-base loadout/]) {
    if (!(await page.getByText(label).count())) throw new Error(`prep panel missing: ${label}`);
  }
  // Technology-gated procurement: the shop shows what the fleet can actually
  // field. Reinforced Hull's base node is granted at the start of a run, so it
  // is on sale from round one; Hydrophone's is not, so its card is absent
  // entirely until the draft produces it — a locked item is not displayed at
  // all, rather than shown with its requirement as a label.
  const hullCards = await page.locator('.module-card', { hasText: 'Reinforced Hull' }).count();
  if (!hullCards) throw new Error('Reinforced Hull should be purchasable from round one');
  const hydroCards = await page.locator('.module-card', { hasText: 'Hydrophone' }).count();
  if (hydroCards) {
    throw new Error('Hydrophone is not researched yet, so its card should not be rendered');
  }
  console.log('prep loadout panels OK (escort/base slots + unresearched kit hidden)');
  await page.screenshot({ path: `${SHOT_DIR}/06-prep-round2.png` });

  // Reload → save restores prep phase.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]', { timeout: 10_000 });
  const continueEnabled = await page.getByRole('button', { name: 'Continue' }).isEnabled();
  if (!continueEnabled) throw new Error('saved campaign not offered on menu');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
  console.log('save/continue OK');

  console.log('SMOKE TEST PASSED');
} finally {
  await browser.close();
}
