// Screenshots of every V3 map in play (dev mode, watch bot), for checking
// the 20-map build by eye. Needs `npx vite preview --port 4173` running.
//   node tools/v3/maps-plan/shots.mjs <out-dir> [wave] [map,map,...]
import { chromium } from 'playwright-core';

const [out, wave, only] = [process.argv[2], Number(process.argv[3] ?? 6), process.argv[4]];
const ORDER = ['strait', 'kesh', 'marrow', 'gauntlet', 'harbor', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'sowers', 'rigs', 'lantern', 'dreadnought', 'coves', 'delta', 'crossing', 'tide', 'citadel'];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
for (const [i, map] of ORDER.entries()) {
  if (only && !only.split(',').includes(map)) continue;
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:4173/v3.html?seed=31', { waitUntil: 'networkidle' });
  await p.evaluate((w) => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.dev', '1');
    localStorage.setItem('straitwatch.v3.dev.settings', JSON.stringify({ preset: 'full', wave: w, watch: true, watchSpeed: 2, bot: 'you', armory: 'yours' }));
  }, wave);
  await p.reload({ waitUntil: 'networkidle' });
  await p.locator(`[data-chapter="${Math.floor(i / 5) + 1}"]`).click();
  await p.locator(`[data-map="${map}"]`).click();
  await p.waitForSelector('.playing', { timeout: 15000 });
  await p.waitForTimeout(7000);
  await p.screenshot({ path: `${out}/g-${String(i + 1).padStart(2, '0')}-${map}.png` });
  console.log('ok', map, errs.join(' | '));
  await p.close();
}
await browser.close();
