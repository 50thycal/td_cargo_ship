// Pictures of each special event in progress, from the game itself: the
// event's Test Lab card (its own map, straight in), run on to a moment where
// the event is under way, at a landscape phone's size (874×402).
// Usage (with `npx vite preview --port <port>` running on a fresh build):
//   BASE_URL=http://localhost:<port> node tools/v3/special-events/build-shots.mjs [eventId ...]
// Writes docs/design/img/events/<eventId>.jpg (and card.jpg: an event's card).
import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4185';
const OUT = new URL('../../../docs/design/img/events/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Seconds into each event (after its breather) to take the picture.
const AT = {
  rush: 4.5, 'decoy-storm': 5, 'hydra-bloom': 3.5, 'rocket-convoy': 10, 'gunship-wall': 9, 'wolf-pack': 3.2,
  'shield-wall': 5, 'supply-raid': 4, blackout: 5, 'carpet-run': 4, 'dive-circus': 6.5, bombardment: 6,
  'fire-mission': 10, 'repair-yard': 9, 'escort-run': 6, 'siren-field': 5, firestorm: 9,
};
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(AT);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
try {
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 1, hasTouch: true });
    // Call-outs off: the picture is the event, not the first-sight cards.
    await page.goto(`${BASE}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('straitwatch.v3.callouts', 'off'));
    await page.goto(`${BASE}/v3.html?lab=ev-${id}&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.playing.lab-on');
    // Let the event's card come and go, then run on to the moment.
    await page.waitForTimeout(3600);
    await page.evaluate((at) => {
      const g = window.__v3.game();
      // The convoy can't be lost before the picture.
      g.tempo = { ...g.tempo, lossLimit: 99 };
      g.carrierHp = Math.max(g.carrierHp, 99);
      const ev = g.event;
      const left = ev ? ev.t0 + 3 + at - g.waveT : 0;
      const limit = 6;
      window.__v3.advance(Math.max(0, left));
      // Back to the real limits for the HUD.
      g.tempo = { ...g.tempo, lossLimit: Math.max(limit, g.lost + 1) };
      g.carrierHp = Math.min(g.carrierHp, g.stats.carrierHp);
    }, AT[id]);
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__v3.freeze(true));
    await page.waitForTimeout(150);
    const file = `${OUT}${id}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 72 });
    console.log(`${id}: ${Math.round(statSync(file).size / 1024)} KB`);
    await page.close();
  }
  // The event's card as it begins (Decoy Storm: its rule on it).
  if (!process.argv.slice(2).length) {
    const page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 1, hasTouch: true });
    await page.goto(`${BASE}/v3.html?seed=7`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.setItem('straitwatch.v3.callouts', 'off'));
    await page.goto(`${BASE}/v3.html?lab=ev-decoy-storm&seed=7`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.v3-event-card.show');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}card.jpg`, type: 'jpeg', quality: 72 });
    console.log('card: done');
    await page.close();
  }
} finally {
  await browser.close();
}
