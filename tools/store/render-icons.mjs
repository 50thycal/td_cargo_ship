// Render the app icon and launch image from assets-src/*.svg with Chromium,
// then flatten to RGB (the App Store rejects an icon with alpha).
//   node tools/store/render-icons.mjs
// Writes assets-src/app-icon-1024.png and the iOS asset catalog images.
import { chromium } from 'playwright-core';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const exe = ['/opt/pw-browsers/chromium', process.env.CHROMIUM_PATH].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
async function render(svg, size, out) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:#070d12">${readFileSync(svg, 'utf8')}</body></html>`);
  await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await render('assets-src/app-icon.svg', 1024, 'assets-src/app-icon-1024.png');
await render('assets-src/splash.svg', 2732, 'assets-src/splash-2732.png');
await browser.close();
// Flatten (drop alpha) and place.
execFileSync('python3', ['-I', 'tools/store/flatten.py'], { stdio: 'inherit' });
