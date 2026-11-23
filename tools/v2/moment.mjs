// See a flagged moment (round 9): replay a playtest log to each 🚩 flag in
// it and screenshot the battlefield there, plus one and two seconds before,
// at iPhone landscape size. "Seconds" are the player's: watching at 10×,
// the thing they flagged happened ~10 game-seconds before the tap, so the
// look-back scales with the speed the log says was on.
//
//   npm run build && node tools/v2/moment.mjs log.json [--out=dir] [--step=N] [--base=URL]
//
// Uses the built game (a running `vite preview`, or starts one on :4174).

import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const file = args.find((a) => a.endsWith('.json'));
if (!file) {
  console.log('usage: node tools/v2/moment.mjs log.json [--out=dir] [--step=N] [--base=URL]');
  process.exit(1);
}
const log = JSON.parse(readFileSync(file, 'utf8'));
const out = opt('out') ?? `moments/${log.id}`;
mkdirSync(out, { recursive: true });

const flags = opt('step')
  ? [{ step: Number(opt('step')), kind: 'step' }]
  : log.commands.filter((c) => c[1] === 'g').map((c) => ({ step: c[0], kind: c[2] }));
/** The speed slider's value at a step (from the log's 's' commands). */
const speedAt = (step) => log.commands.filter((c) => c[1] === 's' && c[0] <= step).at(-1)?.[2] ?? 1;
if (!flags.length) {
  console.log(`${log.id}: no flags in this log (use --step=N for any moment)`);
  process.exit(0);
}

let base = opt('base') ?? 'http://localhost:4173';
let server = null;
if (!(await fetch(`${base}/v2.html`).then((r) => r.ok).catch(() => false))) {
  base = 'http://localhost:4174';
  server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await fetch(`${base}/v2.html`).then((r) => r.ok).catch(() => false)); i++) await new Promise((r) => setTimeout(r, 200));
}

const chrome = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 874, height: 402 }, deviceScaleFactor: 2 });
  await page.goto(`${base}/v2.html`, { waitUntil: 'networkidle' });
  for (const [k, f] of flags.entries()) {
    const speed = speedAt(f.step);
    for (const back of [2, 1, 0]) {
      const step = Math.max(0, f.step - Math.round(back * 60 * speed));
      const at = await page.evaluate(([l, s]) => window.__v2.showMoment(l, s), [log, step]);
      await page.waitForTimeout(120);
      const name = `${out}/flag${k + 1}-${f.kind}-${back ? `minus${back}s` : 'at'}.png`;
      await page.screenshot({ path: name });
      if (!back) console.log(`flag ${k + 1} (${f.kind}) at step ${f.step}, ${speed}×: wave ${at.wave}, ${at.waveT.toFixed(1)} s in → ${name}`);
    }
  }
} finally {
  await browser.close();
  server?.kill();
}
