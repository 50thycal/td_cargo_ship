// Overlap audit, the notification half (log v73, docs/design/v3-playtest-fixes.md,
// "Trucks that overlap"): on every map the watch bot plays a busy wave (wave 6,
// the "you" bot, as e2e/v3.mjs's call-out check does) in a phone-sized browser,
// and every 120 ms the call-out cards on screen (.v2-alert, the corner stack)
// are laid over the enemy's launchers as the player sees them: every shore
// pad / rig / cove / chute (a 34 px disc, the pad drawn at 28 x 23 and a
// little air), every ground truck (its drawn body) and every siege gun. A
// sample counts as "hidden" when a card covers any part of one.
//
//   npm run build && npx vite preview --port 4173 &
//   node tools/v3/overlap-audit/cards.mjs [--maps=coves,harbor] [--size=874x402] [--samples=70] [--json=out.json] [--shots=dir] [--off]
//   (env BASE_URL, default http://localhost:4173)

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:4173';
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const ORDER = ['strait', 'kesh', 'marrow', 'gauntlet', 'harbor', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'sowers', 'rigs', 'lantern', 'dreadnought', 'coves', 'delta', 'crossing', 'tide', 'citadel'];
const maps = opt('maps', ORDER.join(',')).split(',');
const [W, H] = opt('size', '874x402').split('x').map(Number);
const SAMPLES = Number(opt('samples', 70));
const shots = opt('shots', '');
/** --off: the corner stack as it was before log v73 (it does not rise off launchers). */
const OFF = args.includes('--off');
if (shots) mkdirSync(shots, { recursive: true });

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
const rows = [];
for (const map of maps) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page.on('pageerror', (e) => console.log(`page error: ${e.message}`));
  await page.goto(`${BASE_URL}/v3.html?seed=31`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('straitwatch.v3.dev', '1');
    localStorage.setItem('straitwatch.v3.dev.settings', JSON.stringify({ preset: 'full', wave: 6, watch: true, watchSpeed: 3, bot: 'you', armory: 'yours' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator(`[data-chapter="${Math.floor(ORDER.indexOf(map) / 5) + 1}"]`).tap();
  await page.locator(`[data-map="${map}"]`).tap();
  await page.waitForSelector('.playing');
  if (OFF) await page.evaluate(() => window.__v3.dodge(false));
  const row = { map, samples: 0, withCards: 0, hidden: 0, kinds: {}, where: {} };
  let shot = false;
  let risen = false;
  for (let k = 0; k < SAMPLES; k++) {
    const r = await page.evaluate(() => {
      const g = window.__v3.game();
      const cards = [...document.querySelectorAll('.v2-alert:not(.leaving)')].map((e) => e.getBoundingClientRect());
      const box = (x, y, hx, hy) => {
        const a = window.__v3.toClient(x - hx, y - hy);
        const b = window.__v3.toClient(x + hx, y + hy);
        return { left: a.x, top: a.y, right: b.x, bottom: b.y };
      };
      const launchers = [];
      g.map.bases.forEach((b, i) => {
        if (b.generator) return;
        launchers.push({ kind: b.rig ? 'rig' : b.cove ? 'cove' : b.chute ? 'chute' : b.core ? 'citadel' : 'silo', ...box(b.x, b.y, b.rig || b.core ? 40 : 32, b.rig || b.core ? 40 : 27) });
      });
      for (const r of g.raiders) if (r.kind !== 'sub') launchers.push({ kind: 'truck', ...box(r.x, r.y, 36, 22) });
      for (const t of g.threats) {
        if (t.dead) continue;
        if (t.kind === 'rocketTruck') launchers.push({ kind: 'truck', ...box(t.x, t.y, 36, 22) });
        else if (t.kind === 'siege') launchers.push({ kind: 'siege', ...box(t.x, t.y, 30, 25) });
      }
      const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
      const hits = [];
      for (const c of cards) for (const l of launchers) if (hit(c, l)) hits.push(l.kind);
      const st = document.querySelector('.v2-alerts').getBoundingClientRect();
      return { phase: g.phase, n: cards.length, hits, slot: `${document.querySelector('.v2-alerts').dataset.side === 'left' ? 'L' : ''}${document.querySelector('.v2-alerts').dataset.rise ?? '0'}`, stack: { left: st.left, top: st.top, right: st.right, bottom: st.bottom } };
    });
    if (r.phase !== 'wave') break;
    row.samples++;
    if (r.n) row.withCards++;
    if (r.hits.length) {
      row.hidden++;
      for (const h of new Set(r.hits)) row.kinds[h] = (row.kinds[h] ?? 0) + 1;
      if (shots && !shot) {
        shot = true;
        await page.screenshot({ path: `${shots}/${map}-hidden.png` });
      }
    }
    if (shots && !risen && Number(r.slot.replace('L', '')) > 60 && r.n) {
      risen = true;
      await page.screenshot({ path: `${shots}/${map}-risen.png` });
    }
    row.where[r.slot] = (row.where[r.slot] ?? 0) + 1;
    await page.waitForTimeout(120);
  }
  rows.push(row);
  console.log(`${map.padEnd(12)} samples ${String(row.samples).padStart(3)}  with cards ${String(row.withCards).padStart(3)}  card over a launcher ${String(row.hidden).padStart(3)}  ${JSON.stringify(row.kinds)}  slots ${JSON.stringify(row.where)}`);
  await page.close();
}
await browser.close();
const out = opt('json', '');
if (out) writeFileSync(out, `${JSON.stringify({ size: `${W}x${H}`, rows }, null, 1)}\n`);
