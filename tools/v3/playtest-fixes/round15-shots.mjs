// Round 15 screenshots at the phone's size, one pixel a point.
//   BASE_URL=http://localhost:4xxx node tools/v3/playtest-fixes/round15-shots.mjs
// (writes sowers-hold-glow.png, rigs-tow.png and rigs-shots.png to OUT_DIR)
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readdirSync } from "node:fs";

const BASE_URL = process.env.BASE_URL;
const OUT = process.env.OUT_DIR ?? "e2e/shots/round15";
mkdirSync(OUT, { recursive: true });
function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (existsSync(`${root}/chromium`)) return `${root}/chromium`;
  for (const entry of readdirSync(root)) {
    if (!entry.startsWith('chromium-')) continue;
    for (const dir of ['chrome-linux64', 'chrome-linux']) if (existsSync(`${root}/${entry}/${dir}/chrome`)) return `${root}/${entry}/${dir}/chrome`;
  }
}
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const PHONE = { viewport: { width: 874, height: 402 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true };
const open = async (page, q) => {
  await page.goto(`${BASE_URL}/v3.html?${q}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.playing.lab-on');
};
const errs = [];
// Between waves: past the wave's rating and the draft.
const onward = async (p) => {
  await p.evaluate(() => {
    const btn = [...document.querySelectorAll('.v2-overlay button')].find((b) => /^(Skip|Next)$/.test(b.textContent.trim()));
    if (btn) return btn.click();
    const cards = [...document.querySelectorAll('.v2-overlay .v2-card:not([disabled])')];
    (cards.find((c) => /LEVEL UP/.test(c.textContent)) ?? cards[0])?.click();
    // A swap: the held weapon it replaces.
    document.querySelector('.v2-overlay .v2-slot')?.click();
  });
  await p.waitForTimeout(200);
};
const out = {};
try {
  // ---- Sowers: a surfaced mine in a ship's path, the Hold button glowing ----
  {
    const p = await browser.newPage(PHONE);
    p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`${BASE_URL}/v3.html`);
    await p.evaluate(() => localStorage.clear());
    await open(p, 'lab=map-sowers&plays=slice&seed=7');
    let st = null;
    for (let k = 0; k < 1500; k++) {
      await p.evaluate(() => {
        const g = window.__v3.game();
        for (const s of g.ships) s.hp = Math.max(s.hp, 3);
        window.__v3.advance(0.05);
      });
      await p.waitForTimeout(16);
      st = await p.evaluate(() => {
        const g = window.__v3.game();
        const mines = g.threats.filter((t) => t.kind === 'mine' && !t.dead);
        return { wave: g.wave, phase: g.phase, hidden: mines.filter((t) => t.hidden).length, up: mines.filter((t) => !t.hidden).length, glow: !!document.querySelector('.v3-command.advised'), raid: !!document.querySelector('.v3-alert') };
      });
      if (st.phase !== 'wave') await onward(p);
      if (st.glow && st.up > 0) break;
    }
    await p.waitForTimeout(120);
    out.sowers = st;
    await p.screenshot({ path: `${OUT}/sowers-hold-glow.png` });
    const rail = await p.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return b.width ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : null; };
      return { cmd: r('.v3-command'), note: r('.v3-note-btn'), rail: r('.v2-rail-left'), label: document.querySelector('.v3-command')?.textContent };
    });
    out.rail = rail;
    await p.close();
  }
  // ---- Rigs: a relief rig on its tow, mid-approach ----
  {
    const p = await browser.newPage(PHONE);
    p.on('pageerror', (e) => errs.push(e.message));
    await open(p, 'lab=map-rigs&plays=slice&seed=7');
    let st = null;
    for (let k = 0; k < 3000; k++) {
      await p.evaluate(() => {
        const g = window.__v3.game();
        for (const s of g.ships) s.hp = Math.max(s.hp, 3);
        g.carrierHp = Math.max(g.carrierHp, 5);
        window.__v3.advance(0.1);
      });
      await p.waitForTimeout(10);
      st = await p.evaluate(() => {
        const g = window.__v3.game();
        const tow = g.threats.find((t) => t.kind === 'rig' && t.tow !== undefined && !t.dead);
        const b = tow ? g.map.bases[tow.tow] : null;
        return { wave: g.wave, phase: g.phase, tow: tow ? { x: Math.round(tow.x), to: b.x } : null };
      });
      if (st.phase !== 'wave') await onward(p);
      // Mid-approach: on the water, still well short of its station.
      if (st.tow && st.tow.x > 110 && st.tow.x < 1490 && Math.abs(st.tow.x - st.tow.to) > 120) break;
    }
    await p.waitForTimeout(150);
    out.tow = st;
    await p.screenshot({ path: `${OUT}/rigs-tow.png` });
    // The shot counter: a standing rig part-way down (a few shots taken).
    const rig = await p.evaluate(() => {
      const g = window.__v3.game();
      const rigs = g.threats.filter((t) => t.kind === 'rig' && t.tow === undefined && !t.dead);
      if (rigs[0]) rigs[0].hp = Math.max(1, Math.round((rigs[0].maxHp ?? 50) * 0.62));
      return rigs.map((t) => ({ hp: t.hp, max: t.maxHp, x: Math.round(t.x), y: Math.round(t.y), base: t.base }));
    });
    out.rigs = rig;
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${OUT}/rigs-shots.png` });
    await p.close();
  }
} finally {
  console.log(JSON.stringify(out, null, 1));
  console.log('errors:', errs.join(' | ') || 'none');
  await browser.close();
}
