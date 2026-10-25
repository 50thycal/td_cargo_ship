// V2 playtest logs on the Vercel build: the game, served from dist/ at its
// real https://td-cargo-ship.vercel.app address, must POST each finished log
// to /api/playlog, keep it when the endpoint is down, and resend it on the
// next launch. The endpoint itself is faked here (tests/v2/playlogApi.test.ts
// covers the real handler).
//
// Usage:  npm run build && node e2e/v2-vercel-log.mjs

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ORIGIN = 'https://td-cargo-ship.vercel.app';
const DIST = 'dist';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

const fail = (msg) => {
  console.error('FAIL:', msg);
  process.exitCode = 1;
};

const browser = await chromium.launch({
  executablePath: existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

let apiUp = false;
const posts = [];
await context.route(`${ORIGIN}/**`, async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/playlog') {
    const log = JSON.parse(route.request().postData() ?? '{}');
    posts.push({ id: log.id, up: apiUp, end: log.end, commands: log.commands?.length, log });
    return route.fulfill({ status: apiUp ? 200 : 503, contentType: 'application/json', body: JSON.stringify(apiUp ? { ok: true } : { error: 'storage unavailable' }) });
  }
  const file = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
  return route.fulfill({ status: 200, contentType: TYPES[extname(file)] ?? 'application/octet-stream', body: readFileSync(file) });
});

/** Tap every live threat that has no interceptor on it yet, via real clicks. */
async function defend(page) {
  const targets = await page.evaluate(() => {
    const g = window.__v2.game();
    if (!g || g.phase !== 'wave') return [];
    return g.threats
      .filter((t) => !g.interceptors.some((i) => i.target === t.id))
      .slice(0, 3)
      .map((t) => window.__v2.toClient(t.x, t.y));
  });
  for (const p of targets) await page.mouse.click(p.x, p.y);
}

/** Start map 1, tap a few times, then force the loss through the test hook. */
async function playAndLose(page) {
  await page.waitForSelector('[data-screen="menu"]');
  await page.click('[data-map="strait"]');
  await page.waitForSelector('.playing');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) await page.mouse.click(640, 300 + i * 40);
  await page.evaluate(() => {
    window.__v2.game().lost = 99;
  });
  await page.waitForSelector('[data-screen="result"]');
  await page.waitForFunction(() => !document.querySelector('.v2-log-status')?.textContent?.startsWith('Saving'));
  return page.locator('.v2-log-status').innerText();
}

try {
  const page = await context.newPage();
  page.on('pageerror', (err) => fail(`page error: ${err.message}`));
  await page.goto(`${ORIGIN}/v2.html`);
  await page.evaluate(() => localStorage.clear());

  // 1. Endpoint down (no Blob store yet): the log is kept, the player told.
  await page.reload();
  const down = await playAndLose(page);
  console.log('endpoint down →', JSON.stringify(down));
  if (!down.includes('next time')) fail(`expected "will be sent next time", got ${down}`);
  if (!(await page.locator('.v2-log-status button', { hasText: 'Download log' }).count())) fail('no Download log fallback');
  const firstId = posts[0]?.id;
  if (!firstId || posts[0].up) fail('the game never tried to POST the log');
  if (!posts[0].commands) fail('POSTed log carried no inputs');

  // 2. Endpoint up: next launch resends the kept log by itself.
  apiUp = true;
  await page.reload();
  await page.waitForSelector('[data-screen="menu"]');
  await page.waitForTimeout(1000);
  const resent = posts.filter((p) => p.id === firstId && p.up);
  console.log('after relaunch, resends of kept log:', resent.length);
  if (resent.length !== 1) fail(`kept log resent ${resent.length} times`);

  // 3. A new run with the endpoint up reports success on the result screen.
  const up = await playAndLose(page);
  console.log('endpoint up →', JSON.stringify(up));
  if (!up.includes('sent to Claude')) fail(`expected "sent to Claude", got ${up}`);
  await page.screenshot({ path: 'e2e/shots/v2/vercel-log-sent.png' });

  // 4. Nothing already delivered is sent again on the next launch.
  const before = posts.length;
  await page.reload();
  await page.waitForSelector('[data-screen="menu"]');
  await page.waitForTimeout(1000);
  if (posts.length !== before) fail(`relaunch re-sent ${posts.length - before} delivered logs`);

  // 5. Mid-run saves: one when a wave ends (the draft opens), one when the
  //    game goes to the background, then the sealed log at the end — all the
  //    same run id, the server overwriting as it goes.
  await page.click('[data-map="strait"]');
  await page.waitForSelector('.playing');
  const track = page.locator('.v2-rail-right .v2-track');
  const tb = await track.boundingBox();
  await page.mouse.click(tb.x + tb.width / 2, tb.y + 2); // 3× speed
  const runStart = posts.length;
  for (let i = 0; i < 500; i++) {
    if ((await page.evaluate(() => window.__v2.game()?.phase)) !== 'wave') break;
    await defend(page);
    await page.waitForTimeout(60);
  }
  await page.waitForSelector('[data-screen="draft"]');
  await page.waitForTimeout(500);
  const waveSave = posts.slice(runStart).find((p) => p.log.summary?.wave === 1);
  console.log('wave-end save:', waveSave ? JSON.stringify({ id: waveSave.id, end: waveSave.end, steps: waveSave.log.summary.steps, commands: waveSave.commands }) : 'none');
  if (!waveSave) fail('no save when wave 1 ended');
  else if (waveSave.end !== undefined) fail(`wave-end save is sealed as ${waveSave.end}`);
  if (waveSave) {
    mkdirSync('e2e/shots/v2', { recursive: true });
    writeFileSync('e2e/shots/v2/wave-end-save.json', JSON.stringify(waveSave.log));
  }

  const beforeHide = posts.length;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  const hideSave = posts.slice(beforeHide).find((p) => p.id === waveSave?.id);
  console.log('background save:', hideSave ? 'yes' : 'none');
  if (!hideSave) fail('no save when the game went to the background');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  await page.locator('.v2-card:not([disabled])').first().click();
  await page.waitForFunction(() => window.__v2.game()?.phase === 'wave');
  await page.evaluate(() => {
    window.__v2.game().lost = 99;
  });
  await page.waitForSelector('[data-screen="result"]');
  await page.waitForTimeout(500);
  const final = posts.slice(runStart).filter((p) => p.id === waveSave?.id);
  console.log('saves for this run:', JSON.stringify(final.map((p) => p.end ?? 'mid-run')));
  if (final.at(-1)?.end !== 'lost') fail('the run was never sealed as lost');

  console.log('posts:', JSON.stringify(posts.map(({ log, ...p }) => p)));
} catch (e) {
  fail(e instanceof Error ? e.stack : String(e));
} finally {
  await browser.close();
}
console.log(process.exitCode ? 'V2 Vercel log test FAILED' : 'V2 Vercel log test passed');
