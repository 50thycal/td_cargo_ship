// Region Workshop browser smoke test. Expects `vite preview` (or dev) at
// BASE_URL. Drives: Settings → Developer mode → Region Workshop → library →
// new region from Home Strait → timeline edits (add a delayed capability, a
// scripted beat, a removal) → save → export JSON → mobile round list →
// playtest launch (prep screen of an isolated run). Screenshots per phase.
//
// Usage:  npm run build && npm run preview -- --port 4173 &  node e2e/workshop.mjs
// Env:    BASE_URL (default http://localhost:4173)
//         SHOT_DIR (default e2e/shots)

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
    if (existsSync(direct)) {
      try {
        if (!readdirSync(direct, { withFileTypes: true }).length) return direct;
      } catch {
        return direct;
      }
    }
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      const candidate = `${root}/${entry}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
let failed = false;
const check = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    failed = true;
  } else console.log('ok:', msg);
};

try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (err) => {
    console.error('PAGE ERROR:', err.message);
    failed = true;
  });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-screen="menu"]');
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Settings → Developer mode ON → Region Workshop
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.waitForSelector('[data-screen="settings"]');
  const toggles = page.locator('.dev-toggle');
  if ((await toggles.first().textContent())?.trim() === 'OFF') await toggles.first().click();
  await page.waitForSelector('text=Region Workshop');
  await page.screenshot({ path: `${SHOT_DIR}/ws-00-settings.png` });
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForSelector('[data-screen="workshop"]');
  await page.waitForTimeout(700);
  check((await page.locator('.ws-library tbody tr').count()) >= 2, 'library lists packaged templates');
  check((await page.locator('.ws-library').textContent()).includes('Missile Coast'), 'Missile Coast in library');
  check((await page.locator('.ws-library').textContent()).includes('Home Strait'), 'Home Strait in library');
  await page.screenshot({ path: `${SHOT_DIR}/ws-01-library.png` });

  // Open a packaged template read-only
  await page.locator('.ws-library tbody tr').first().getByRole('button', { name: 'Open' }).click();
  await page.waitForSelector('[data-screen="workshop-editor"]');
  await page.waitForTimeout(700); // entry animation
  check((await page.locator('.screen-header h1').textContent()).includes('read-only'), 'packaged template opens read-only');
  check((await page.locator('.ws-matrix .ws-cell.intro').count()) >= 2, 'template timeline shows resolved gates (unguided R1, guided R2)');
  await page.screenshot({ path: `${SHOT_DIR}/ws-02-template-readonly.png`, fullPage: true });
  await page.getByRole('button', { name: 'Library' }).click();

  // New region from Home Strait
  await page.getByRole('button', { name: 'New Region' }).click();
  await page.locator('.ws-dialog input.ws-input').fill('Lab Channel');
  await page.locator('.ws-dialog select').selectOption('homeStrait');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.waitForSelector('[data-screen="workshop-editor"]');
  await page.waitForTimeout(700);

  // Environment → Island Channel. The preview has to draw the rock, because a
  // designer picking a map they cannot see is picking blind.
  const envSelect = page.locator('.ws-panel select').nth(1);
  await envSelect.selectOption('islandChannel');
  await page.waitForTimeout(200);
  check((await page.locator('.ws-panel').nth(1).textContent()).includes('splits the strait'), 'island environment described');
  check((await page.locator('.ws-map polygon').count()) >= 3, 'island preview draws the landmass');
  await page.locator('.ws-map-wrap').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOT_DIR}/ws-07-island-preview.png` });

  // Add torpedoes (straight) at round 6 via round header → arsenal browser.
  await page.locator('.ws-round-btn', { hasText: /^R6$/ }).click();
  await page.locator('.ws-arsenal-row', { hasText: 'Straight-running torpedo' }).getByRole('button').click();
  await page.waitForTimeout(100);
  check((await page.locator('td[data-key="torpedoes:straight"][data-round="6"] .ws-cell.intro').count()) === 1, 'torpedo introduced R6');
  check((await page.locator('td[data-key="torpedoes:straight"][data-round="8"] .ws-cell.active').count()) === 1, 'torpedo cumulative R8');

  // Try to add a guided missile at round 1 → gated cell; inspector offers "Add from round 2".
  await page.locator('td[data-key="missiles:guided"][data-round="1"] .ws-cell').click();
  check((await page.locator('.ws-inspector').textContent()).includes('cannot appear before round 2'), 'gate explained in inspector');

  // Scripted salvo beat on guided missiles at round 4.
  await page.locator('td[data-key="missiles:guided"][data-round="4"] .ws-cell').click();
  await page.getByRole('button', { name: 'Add scripted beat here' }).click();
  await page.waitForTimeout(100);
  check((await page.locator('.ws-inspector').textContent()).includes('Scripted beat'), 'beat inspector open');
  await page.locator('.ws-inspector input[type=number]').first().fill('6');
  await page.locator('.ws-inspector input[type=number]').first().dispatchEvent('change');
  await page.waitForTimeout(100);
  check((await page.locator('td[data-key="missiles:guided"][data-round="4"] .ws-cell.beat').count()) === 1, 'beat marker on the cell');

  // Remove standard mines after round 6.
  await page.locator('td[data-key="mines:standard"][data-round="6"] .ws-cell').click();
  await page.getByRole('button', { name: /Remove after round 6/ }).click();
  await page.waitForTimeout(100);
  check((await page.locator('td[data-key="mines:standard"][data-round="6"] .ws-cell.removed').count()) === 1, 'removal stop marker');
  check((await page.locator('td[data-key="mines:standard"][data-round="7"] .ws-cell.none').count()) === 1, 'band ends after removal');

  // Intel warning on round 5 (for the torpedo debut on 6).
  await page.locator('.ws-round-btn', { hasText: /^R5$/ }).click();
  await page.locator('.ws-inspector textarea').fill('Hydrophone chatter: shore torpedo tubes are being manned.');
  await page.locator('.ws-inspector textarea').dispatchEvent('change');
  await page.waitForTimeout(100);

  await page.locator('.ws-matrix-wrap').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOT_DIR}/ws-03-timeline-desktop.png` });

  // Save + export
  await page.getByRole('button', { name: /^Save$/ }).click();
  await page.waitForTimeout(100);
  check((await page.locator('.ws-notice').textContent()).includes('Saved'), 'draft saved');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const path = await download.path();
  const json = JSON.parse(await (await import('node:fs/promises')).readFile(path, 'utf8'));
  check(json.schemaVersion === 1 && json.id && Array.isArray(json.milestones), 'exported JSON is a v1 preset');
  check(json.environmentPresetId === 'islandChannel' && json.shapeType === 'islandChannel', 'exported JSON carries the island environment');
  check(json.milestones.some((m) => m.beats?.length), 'exported JSON carries the beat');
  await (await import('node:fs/promises')).writeFile(`${SHOT_DIR}/ws-export.json`, JSON.stringify(json, null, 2));

  // Reload → draft persists, still playable, listed in the library.
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForSelector('[data-screen="workshop"]');
  const draftRow = page.locator('.ws-library tbody tr', { hasText: 'Lab Channel' });
  check((await draftRow.count()) === 1, 'draft listed after reload');
  check((await draftRow.textContent()).includes('Valid'), 'draft valid after reload');

  // Mobile: round list
  await page.setViewportSize({ width: 390, height: 844 });
  await draftRow.getByRole('button', { name: 'Open' }).click();
  await page.waitForSelector('[data-screen="workshop-editor"]');
  await page.getByRole('button', { name: 'Round list' }).click();
  await page.waitForSelector('.ws-roundlist');
  await page.waitForTimeout(700);
  check((await page.locator('.ws-round-card').count()) === json.completionRound, 'mobile round list has one card per round');
  await page.screenshot({ path: `${SHOT_DIR}/ws-04-mobile-rounds.png`, fullPage: true });
  await page.locator('.ws-round-card').nth(5).locator('.ws-chip', { hasText: 'torpedo' }).click();
  check((await page.locator('.ws-inspector').textContent()).includes('Straight-running torpedo'), 'mobile chip opens inspector');

  // Playtest launch from the editor → an isolated run's prep screen.
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByRole('button', { name: /Playtest/ }).last().click();
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
  const stored = await page.evaluate(() => ({
    campaign: localStorage.getItem('straitwatch.run.v1'),
    workshop: localStorage.getItem('straitwatch.workshopRun.v1'),
  }));
  check(stored.campaign === null, 'campaign save slot untouched by playtest');
  check(!!stored.workshop && JSON.parse(stored.workshop).run.regionId === json.id, 'playtest saved in its own slot');
  await page.screenshot({ path: `${SHOT_DIR}/ws-05-playtest-prep.png` });

  // Begin the transit briefly to prove the custom region plays on its geography.
  await page.getByRole('button', { name: /Begin Transit/i }).click();
  await page.waitForSelector('canvas', { timeout: 10_000 });
  // Long enough for the convoy to be well into the strait and the lanes to
  // have visibly split around the rock.
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${SHOT_DIR}/ws-06-playtest-transit.png` });
} finally {
  await browser.close();
}
if (failed) {
  console.error('workshop smoke: FAILED');
  process.exit(1);
}
console.log('workshop smoke: OK');
