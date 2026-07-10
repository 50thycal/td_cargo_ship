// Browser smoke test: builds nothing itself — expects `vite preview` (or dev)
// to be reachable at PORT. Drives a full round: menu → prep → transit (with
// interceptor taps) → after-action report → research → next prep.
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
  await page.getByRole('button', { name: 'New Campaign' }).click();

  // --- Prep ----------------------------------------------------------------
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT_DIR}/02-prep.png` });
  await page.getByRole('button', { name: 'Begin Transit' }).click();

  // --- Transit ---------------------------------------------------------------
  await page.waitForSelector('#hud-bottom', { timeout: 10_000 });
  // Let the round develop, then screenshot mid-action.
  await page.waitForTimeout(16_000);
  await page.screenshot({ path: `${SHOT_DIR}/03-transit.png` });

  // Tap around the upper half of the map repeatedly to attempt interceptions
  // (missiles come from the top shore). Also exercises the 2x speed button.
  await page.getByRole('button', { name: '1×' }).click();
  const canvas = page.locator('#game-canvas');
  const box = await canvas.boundingBox();
  const deadline = Date.now() + 150_000;
  let aarSeen = false;
  while (Date.now() < deadline) {
    if (await page.locator('[data-screen="aar"]').count()) {
      aarSeen = true;
      break;
    }
    if (box) {
      const x = box.x + box.width * (0.2 + Math.random() * 0.6);
      const y = box.y + box.height * (0.15 + Math.random() * 0.5);
      await page.mouse.click(x, y).catch(() => {});
    }
    await page.waitForTimeout(700);
  }
  if (!aarSeen) throw new Error('after-action report never appeared');

  // --- AAR ----------------------------------------------------------------------
  await page.screenshot({ path: `${SHOT_DIR}/04-aar.png` });
  const delivered = await page.locator('.stat .value').first().textContent();
  console.log('AAR delivered stat:', delivered);
  await page.getByRole('button', { name: /Continue to Intelligence/ }).click();

  // --- Research --------------------------------------------------------------------
  await page.waitForSelector('[data-screen="research"]', { timeout: 10_000 });
  await page.screenshot({ path: `${SHOT_DIR}/05-research.png` });
  await page.getByRole('button', { name: 'Continue to Preparation' }).click();

  // --- Round 2 prep -------------------------------------------------------------------
  await page.waitForSelector('[data-screen="prep"]', { timeout: 10_000 });
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
