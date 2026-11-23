// Concept pictures for the enemy round: each idea drawn over a real frame of
// the game at phone size (667×375), so the player sees it where it would
// live. The frame is a real Free Play wave on The Strait, paused; the idea is
// drawn on top in world units through the game's own world→screen mapping.
// Usage (with `npx vite preview --port 4173` running on a fresh build):
//   node tools/v3/enemy-ideas/concepts.mjs [id ...]
// Writes docs/design/img/enemy-ideas/concept-<id>.jpg.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = new URL('../../../docs/design/img/enemy-ideas/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Each concept: a function run in the page. It gets `d` (drawing helpers in
// world units) and `s` (the frozen scene: ships, carrier, shore line y).
// Kept as source strings so they run inside the browser.
// The convoy is laid out by hand for every picture: two rows of five ships
// along The Strait's lane (top row s.ships[0..4] at y 421, x 300…1180;
// bottom row s.low). `s.focus(x, y, w)` crops the picture to a 16:9 box of
// the sea (world units), so it reads at phone width.
const CONCEPTS = {
  // ---- The player's ideas (recommended picks).
  'p-rocket-truck': `
    s.focus(560, 60, 860);
    const x = 1060, y = s.shore - 22;
    d.truck(x, y, -0.7, true);
    d.ring(x, y, 46, '#ff5c5c', true);
    for (const sh of [s.ships[3], s.ships[4]]) d.streak(x, y - 14, sh.x, sh.y, '#ffb347', true);
    d.label(x - 30, y + 70, 'SHOOT THE TRUCK', '#ff5c5c');
    d.note(620, 500, 'launcher up: its rockets can’t be intercepted');`,
  'p-attack-heli': `
    s.focus(420, 160, 820);
    const hx = 860, hy = 300;
    d.heli(hx, hy, Math.PI * 0.55, '#991b1b', 1.4);
    d.dashed(560, 250, hx - 40, hy - 10, '#fca5a5'); d.dot(560, 250, '#fca5a5');
    d.note(430, 285, 'moves to its next spot');
    for (const [k, t] of [s.ships[2], s.ships[3], s.ships[4]].entries()) d.spawn('guided', hx - 40 + k * 40, hy + 55, { heading: Math.atan2(t.y - hy, t.x - hx) });
    d.label(hx + 30, 210, 'HOVERS · FIRES VOLLEYS', '#fca5a5');`,
  'p-sprint-drones': `
    s.focus(560, 170, 800);
    const t = s.ships[3];
    const pts = [[1120, 270], [1010, 240], [1240, 230], [900, 260]];
    for (const [x, y] of pts) d.spawn('drone', x, y, { heading: Math.atan2(t.y - y, t.x - x) });
    d.flare(pts[0][0], pts[0][1], Math.atan2(t.y - pts[0][1], t.x - pts[0][0]));
    d.streak(pts[0][0], pts[0][1], t.x + 10, t.y - 10, '#fde68a', true);
    d.label(1180, 205, 'BOOSTER LIT: SPRINT', '#fbbf24');
    d.note(600, 600, 'one hit each: shoot them before they light up');`,
  'p-jammer': `
    s.focus(330, 140, 900);
    const x = 900, y = 290;
    d.static(x, y, 150);
    d.drone(x, y, Math.PI / 2, '#a78bfa', 1.5);
    for (const [mx, my] of [[820, 240], [990, 320], [860, 360]]) d.spawn('guided', mx, my, { heading: Math.PI / 2 });
    d.missile(480, 250, Math.PI / 2, '#ff8a3d', 1.3); d.zone(520, 421, 36);
    d.note(360, 200, 'outside: the reticle shows');
    d.note(760, 480, 'inside: no reticles, no lines');
    d.label(x, 160, 'JAMMER DRONE', '#a78bfa');`,
  'p-decoy': `
    s.focus(560, 140, 800);
    const g = [[760, 260], [880, 300], [1000, 250], [1120, 290]];
    for (const [i, [x, y]] of g.entries()) { d.drone(x, y, Math.PI / 2, '#e5e7eb', 1.4); d.blink(x, y, i % 2 ? '#60a5fa' : '#ef4444'); }
    d.label(940, 180, '2 REAL · 2 DECOYS', '#fbbf24');
    d.note(620, 590, 'up close: red light = real, blue = decoy');`,
  'p-spotter': `
    s.focus(330, 150, 900);
    const sh = s.ships[2];
    const px = 520, py = 250;
    d.orbit(sh.x, sh.y, 300, 130, '#93c5fd');
    d.plane(px, py, 0.25, '#93c5fd', 1.3);
    d.beam(px, py, sh.x, sh.y, '#ef4444');
    d.ring(sh.x, sh.y, 36, '#ef4444', true);
    d.label(sh.x + 40, 600, 'MARKED: NEXT ATTACKS COME HERE', '#ef4444');
    d.label(px, py - 55, 'SPOTTER', '#93c5fd');`,
  'p-torpedo-sub': `
    s.focus(560, 300, 860);
    const sx = 1260, sy = 640;
    d.sub(sx, sy, 1.4);
    const cx = 950, cy = 470;
    d.wake(sx - 40, sy - 10, cx, cy);
    d.cross(cx, cy, '#ef4444');
    d.note(640, 360, 'it aims where the ships will be');
    d.label(sx - 60, 560, 'SURFACED: YOUR GUN CAN HIT IT', '#fbbf24');`,
  'p-siege-battery': `
    s.focus(330, 60, 900);
    const gx = 620, gy = s.shore - 16;
    d.gun(gx, gy);
    d.ring(gx, gy, 42, '#fbbf24', true);
    for (const sh of [s.ships[2], s.ships[3], s.low[2]]) d.zone(sh.x, sh.y, 60);
    d.label(gx + 230, gy + 10, 'SIEGE GUN: SHOOT IT', '#fbbf24');
    d.note(360, 590, 'its shells can’t be stopped: change formation');`,
  'p-loiter': `
    s.focus(700, 150, 900);
    const cx = 1350, cy = 300;
    d.orbit(cx, cy + 55, 95, 50, '#e5e7eb');
    for (let k = 0; k < 5; k++) { const a = k * 1.256; d.drone(cx + Math.cos(a) * 95, cy + Math.sin(a) * 50, a + Math.PI / 2, '#e5e7eb', 1.3); }
    d.arrow(s.ships[4].x + 60, s.ships[4].y, cx - 110, s.ships[4].y, '#94a3b8');
    d.note(1060, 470, 'the convoy sails into them');
    d.label(cx - 60, 205, 'CIRCLING: THEY DIVE WHEN SHIPS PASS', '#fca5a5');
    d.note(760, 640, 'now, or save the ammo for the raid?');`,
  'p-repair-tender': `
    s.focus(560, 160, 860);
    const tx = 1220, ty = 300;
    d.boat(tx, ty, Math.PI, '#94a3b8', 1.6);
    d.cross(tx, ty - 50, '#4ade80', true);
    d.spawn('heavy', 940, 300, { heading: Math.PI * 0.62, hp: 5 });
    d.beam(tx - 30, ty, 960, 300, '#4ade80');
    d.label(tx, 220, 'REPAIR TENDER', '#4ade80');
    d.note(620, 640, 'it heals in pulses: kill it between them');`,
  'p-emp-drone': `
    s.focus(400, 260, 800);
    const c = s.carrier;
    const x = c.x + 200, y = c.y - 290;
    d.drone(x, y, Math.atan2(c.y - y, c.x - x), '#38bdf8', 1.7);
    d.ring(c.x, c.y, 200, '#38bdf8', true);
    d.note(c.x + 200, c.y - 40, 'pulse range');
    d.label(x + 10, y - 60, 'EMP: SLOWS YOUR RELOAD', '#38bdf8');`,
  // ---- New ideas (kept).
  tug: `
    s.focus(560, 100, 820);
    const sh = s.ships[3];
    const lane = { x: sh.x, y: sh.y };
    sh.x += 20; sh.y -= 130;
    d.dashed(lane.x, lane.y, sh.x, sh.y, '#94a3b8');
    d.note(lane.x + 30, lane.y + 40, 'its place in the lane');
    const bx = sh.x + 60, by = sh.y - 60;
    d.cable(bx, by, sh.x + 10, sh.y - 6);
    d.boat(bx, by, -1.2, '#ef4444', 1.1);
    d.arrow(bx + 20, by - 30, bx + 60, s.shore + 20, '#ef4444');
    d.label(bx + 220, by - 20, 'TOWED TO SHORE = LOST', '#ef4444');
    d.note(bx + 100, by + 40, '3 hits sink the tug');`,
  radar: `
    s.focus(640, 60, 960);
    const rx = 1300, ry = s.shore - 24;
    d.dish(rx, ry, Math.atan2(s.carrier.y - ry, s.carrier.x - rx));
    d.meter(rx + 55, ry - 55, 0.75);
    d.arc(rx - 30, ry, s.carrier.x + 50, s.carrier.y - 10, '#fbbf24');
    d.label(rx - 160, ry + 40, 'EVERY 12 TAPS: A SHELL AT YOU', '#fbbf24');
    d.note(s.carrier.x + 90, s.carrier.y - 70, '2 hits to stop it');`,
  picket: `
    s.focus(330, 120, 960);
    const px = 780, py = 300;
    const c = s.carrier;
    d.shadow(c.x, c.y, px, py, 100);
    d.boat(px, py, 0, '#94a3b8', 1.5);
    d.ring(px, py, 100, '#f87171', false);
    d.shot(c.x, c.y, px - 30, py + 95, true); d.puff(px - 30, py + 95);
    d.shot(c.x, c.y, px + 380, py - 20, false);
    d.spawn('guided', 760, 175, { heading: Math.PI / 2 });
    d.label(px + 320, py + 80, 'SHOTS THROUGH ITS RING DIE', '#f87171');
    d.note(380, 200, 'in its shadow: harder to hit');`,
  hydra: `
    s.focus(330, 140, 860);
    const a = s.ships[1], b = s.ships[2];
    const mx = 640, my = 280;
    d.puff(mx, my);
    for (const t of [a, b]) { const h = Math.atan2(t.y - my, t.x - mx); d.missile(mx + Math.cos(h) * 40, my + Math.sin(h) * 40, h, '#ff8a3d', 0.9); d.streak(mx, my, t.x, t.y, '#ff8a3d', false); }
    d.label(mx + 160, 210, 'KILLED CLOSE → TWO DARTS', '#ff8a3d');
    d.note(380, 600, 'kill it far out, or catch both pieces');`,
  scavenger: `
    s.focus(400, 120, 820);
    const px = 700, py = 330;
    d.pickupReal('repair', px, py);
    const dx = px + 180, dy = py - 110;
    d.drone(dx, dy, Math.atan2(py - dy, px - dx), '#fbbf24', 1.6);
    d.claw(dx, dy);
    d.dashed(dx, dy, px, py, '#fbbf24');
    d.arrow(dx + 30, dy - 20, dx + 140, s.shore - 20, '#fbbf24');
    d.label(dx + 60, py + 10, 'STEALS PICKUPS', '#fbbf24');
    d.note(440, 590, 'shoot it: it drops what it took');`,
  barge: `
    s.focus(100, 40, 960);
    const bx = 470, by = s.shore + 48;
    d.boat(bx, by, 0, '#94a3b8', 2.4);
    d.crates(bx, by);
    for (const b of s.bases.slice(0, 2)) d.tag(b.x, b.y - 30, '+1');
    d.label(560, 330, 'SUPPLY BARGE: EVERY RAID +1 A SITE', '#fbbf24');
    d.note(150, 540, 'no threat itself: sink it for smaller raids');`,
  acoustic: `
    s.focus(640, 280, 860);
    const ref = s.ships[4];
    for (const [k, x] of [1270, 1360, 1450].entries()) { const y = 421 + k * 48; d.spawn('mine', x, y, {}); d.ring(x, y, 46, '#7dd3fc', false); }
    d.label(1240, 330, 'HEARS FAST SHIPS', '#7dd3fc');
    d.note(660, 700, 'Column or Full Steam sets them off; Box slips past');
    void ref;`,
  lure: `
    s.focus(560, 200, 960);
    const bx = 1300, by = 330;
    d.buoy(bx, by);
    d.ring(bx, by, 34, '#fbbf24', true);
    d.dashed(s.ships[3].x, s.ships[3].y, bx, by, '#7dd3fc');
    d.dashed(s.low[4].x, s.low[4].y, bx, by, '#7dd3fc');
    d.dashed(s.carrier.x + 40, s.carrier.y - 20, bx, by, '#7dd3fc');
    d.label(bx - 60, 260, 'YOUR HELPERS AIM HERE', '#fbbf24');
    d.note(600, 700, 'your own taps aren’t fooled: two sink it');`,
  bodyguard: `
    s.focus(480, 130, 820);
    const hx = 880, hy = 280;
    d.spawn('heavy', hx, hy, { heading: Math.PI * 0.55 });
    for (let k = 0; k < 3; k++) { const a = k * 2.09 + 0.4; d.drone(hx + Math.cos(a) * 62, hy + Math.sin(a) * 62, a + Math.PI / 2, '#e5e7eb', 1.2); }
    d.ring(hx, hy, 62, '#e5e7eb', false);
    d.shot(s.carrier.x, s.carrier.y, hx + Math.cos(2.49) * 62, hy + Math.sin(2.49) * 62, true);
    d.label(hx + 90, 180, 'GUARDS TAKE YOUR SHOTS', '#e5e7eb');
    d.note(940, 400, 'one blast clears them;');
    d.note(940, 430, 'a beam goes straight through');`,
  cloud: `
    s.focus(400, 150, 860);
    d.fuel(760, 330, 190, 100);
    d.drone(1080, 250, 0, '#d9f99d', 1.5);
    d.dashed(560, 270, 1060, 250, '#d9f99d');
    for (const [x, y] of [[700, 300], [820, 320], [760, 380]]) d.drone(x, y, Math.PI / 2, '#e5e7eb', 1.3);
    d.label(800, 200, 'A BURST INSIDE SETS IT ALL OFF', '#d9f99d');
    d.note(430, 600, 'threats and ships alike: pick the moment');`,
};

const HELPERS = String.raw`
  const T = (x, y) => window.__v3.toClient(x, y);
  const k = window.__v3.toClient(1, 0).x - window.__v3.toClient(0, 0).x; // px per world unit
  const ctx = window.__ov.getContext('2d');
  const W = (n) => n * k;
  function withAt(x, y, rot, f) { const p = T(x, y); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot || 0); f(); ctx.restore(); }
  // The crop box in screen px: labels and notes are kept inside it.
  const box = () => { const f = window.__focus; const a = T(f.x, f.y); const b = T(f.x + f.w, f.y + (f.w * 9) / 16); return { x0: a.x + 3, y0: a.y + 3, x1: b.x - 3, y1: b.y - 3 }; };
  const d = {
    label(x, y, text, col) {
      const p = T(x, y); ctx.save(); ctx.font = '800 ' + Math.max(10, W(26)) + 'px system-ui, sans-serif';
      const w = ctx.measureText(text).width + 12; const h = Math.max(15, W(36));
      const B = box();
      const lx = Math.min(Math.max(p.x - w / 2, B.x0), B.x1 - w);
      const ly = Math.min(Math.max(p.y, B.y0 + h / 2), B.y1 - h / 2);
      ctx.fillStyle = 'rgba(5,10,16,0.82)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(lx, ly - h / 2, w, h, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = col; ctx.textBaseline = 'middle'; ctx.fillText(text, lx + 6, ly + 1); ctx.restore();
    },
    note(x, y, text) {
      const p = T(x, y); ctx.save(); ctx.font = '600 ' + Math.max(9, W(22)) + 'px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.fillStyle = '#f1f5f9';
      const B = box();
      const lx = Math.min(Math.max(p.x, B.x0), B.x1 - ctx.measureText(text).width);
      const ly = Math.min(Math.max(p.y, B.y0 + 10), B.y1 - 4);
      ctx.strokeText(text, lx, ly); ctx.fillText(text, lx, ly); ctx.restore();
    },
    ring(x, y, r, col, pulse) { const p = T(x, y); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = pulse ? 2.5 : 1.5; ctx.setLineDash(pulse ? [] : [5, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, W(r), 0, Math.PI * 2); ctx.stroke(); if (pulse) { ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, W(r) + 5, 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); },
    zone(x, y, r) { const p = T(x, y); ctx.save(); ctx.fillStyle = 'rgba(251,191,36,0.18)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, W(r), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(p.x - W(12), p.y); ctx.lineTo(p.x + W(12), p.y); ctx.moveTo(p.x, p.y - W(12)); ctx.lineTo(p.x, p.y + W(12)); ctx.stroke(); ctx.restore(); },
    dot(x, y, col) { const p = T(x, y); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); },
    line(x1, y1, x2, y2, col, w, dash) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); },
    dashed(x1, y1, x2, y2, col) { d.line(x1, y1, x2, y2, col, 1.5, [5, 4]); },
    beam(x1, y1, x2, y2, col) { d.line(x1, y1, x2, y2, col + '55', 6); d.line(x1, y1, x2, y2, col, 1.5); },
    cable(x1, y1, x2, y2) { d.line(x1, y1, x2, y2, '#e5e7eb', 2, [3, 2]); },
    streak(x1, y1, x2, y2, col, solid) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, col); g.addColorStop(1, col + '00'); ctx.strokeStyle = g; ctx.lineWidth = solid ? 3 : 2; ctx.setLineDash(solid ? [] : [6, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); },
    arrow(x1, y1, x2, y2, col) { d.line(x1, y1, x2, y2, col, 2.5); const a = Math.atan2(y2 - y1, x2 - x1); withAt(x2, y2, a, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-W(18), -W(9)); ctx.lineTo(-W(18), W(9)); ctx.closePath(); ctx.fill(); }); },
    shot(x1, y1, x2, y2, dies) { d.line(x1, y1, x2, y2, dies ? '#fca5a5' : '#7dd3fc', 1.5, [2, 5]); d.dot(x2, y2, dies ? '#fca5a5' : '#7dd3fc'); },
    puff(x, y) { const p = T(x, y); ctx.save(); for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillStyle = 'rgba(226,232,240,0.7)'; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * W(10), p.y + Math.sin(a) * W(10), W(9), 0, Math.PI * 2); ctx.fill(); } ctx.restore(); },
    cross(x, y, col, plus) { const p = T(x, y); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); const r = W(12); if (plus) { ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); } else { ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.moveTo(p.x + r, p.y - r); ctx.lineTo(p.x - r, p.y + r); } ctx.stroke(); ctx.restore(); },
    drone(x, y, a, col, s) { withAt(x, y, a, () => { const z = W(14) * (s || 1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(z, 0); ctx.lineTo(-z * 0.8, -z * 0.9); ctx.lineTo(-z * 0.4, 0); ctx.lineTo(-z * 0.8, z * 0.9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }); },
    flare(x, y, a) { withAt(x, y, a, () => { ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.moveTo(-W(8), -W(4)); ctx.lineTo(-W(30), 0); ctx.lineTo(-W(8), W(4)); ctx.fill(); }); },
    blink(x, y, col) { const p = T(x, y); ctx.save(); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y - W(16), 3, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    missile(x, y, a, col, s) { withAt(x, y, a, () => { const z = (s || 1); ctx.fillStyle = '#e5e7eb'; ctx.fillRect(-W(14) * z, -W(3) * z, W(26) * z, W(6) * z); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-W(14) * z, -W(3) * z); ctx.lineTo(-W(24) * z, 0); ctx.lineTo(-W(14) * z, W(3) * z); ctx.fill(); }); },
    heavy(x, y, a) { withAt(x, y, a, () => { ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-W(26), -W(6), W(48), W(12)); ctx.fillStyle = '#ef4444'; ctx.fillRect(W(18), -W(6), W(6), W(12)); }); },
    hpbar(x, y, from, to) { const p = T(x, y); const w = W(70); ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - w / 2, p.y, w, 5); ctx.fillStyle = '#ef4444'; ctx.fillRect(p.x - w / 2, p.y, w * from, 5); ctx.fillStyle = '#4ade80'; ctx.fillRect(p.x - w / 2 + w * from, p.y, w * (to - from), 5); ctx.restore(); },
    boat(x, y, a, col, s) { withAt(x, y, a, () => { const z = W(30) * (s || 1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(z, 0); ctx.lineTo(z * 0.4, -z * 0.35); ctx.lineTo(-z, -z * 0.3); ctx.lineTo(-z, z * 0.3); ctx.lineTo(z * 0.4, z * 0.35); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#1f2937'; ctx.fillRect(-z * 0.4, -z * 0.15, z * 0.5, z * 0.3); }); },
    crates(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#b45309'; for (let i = 0; i < 3; i++) ctx.fillRect(p.x - W(30) + i * W(18), p.y - W(8), W(14), W(14)); ctx.restore(); },
    tag(x, y, text) { d.label(x, y, text, '#fbbf24'); },
    truck(x, y, a, up) { withAt(x, y, 0, () => { ctx.fillStyle = '#57534e'; ctx.fillRect(-W(30), -W(10), W(60), W(20)); ctx.fillStyle = '#292524'; ctx.fillRect(W(18), -W(10), W(14), W(20)); if (up) { ctx.save(); ctx.rotate(a); ctx.fillStyle = '#a8a29e'; ctx.fillRect(-W(4), -W(9), W(44), W(18)); ctx.restore(); } }); },
    gun(x, y) { withAt(x, y, 0, () => { ctx.fillStyle = '#44403c'; ctx.beginPath(); ctx.arc(0, 0, W(22), Math.PI, 0); ctx.fill(); ctx.fillStyle = '#a8a29e'; ctx.save(); ctx.rotate(0.6); ctx.fillRect(0, -W(5), W(46), W(10)); ctx.restore(); }); },
    dish(x, y, a) { withAt(x, y, 0, () => { ctx.fillStyle = '#44403c'; ctx.fillRect(-W(16), -W(6), W(32), W(14)); ctx.save(); ctx.rotate(a); ctx.strokeStyle = '#e7e5e4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-W(10), 0, W(22), -1, 1); ctx.stroke(); ctx.restore(); }); },
    meter(x, y, f) { const p = T(x, y); ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(p.x, p.y, 8, W(60)); ctx.fillStyle = '#fbbf24'; ctx.fillRect(p.x + 1, p.y + W(60) * (1 - f), 6, W(60) * f); ctx.restore(); },
    sub(x, y, z) { withAt(x, y, Math.PI, () => { ctx.scale(z || 1, z || 1); ctx.fillStyle = '#64748b'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, W(42), W(10), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(-W(6), -W(16), W(14), W(10)); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.ellipse(0, 0, W(54), W(18), 0, 0, Math.PI * 2); ctx.stroke(); }); },
    wake(x1, y1, x2, y2) { d.line(x1, y1, x2, y2, 'rgba(255,255,255,0.55)', 4, [10, 6]); d.line(x1, y1, x2, y2, '#ef4444', 1, []); },
    heli(x, y, a, col, z) { z = z || 1; withAt(x, y, a, () => { ctx.scale(z, z); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, W(22), W(11), 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-W(44), -W(3), W(30), W(6)); ctx.fillStyle = '#c9e3ff'; ctx.beginPath(); ctx.ellipse(W(10), 0, W(7), W(6), 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(240,240,240,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, W(36), 0, Math.PI * 2); ctx.stroke(); }); },
    plane(x, y, a, col, z) { withAt(x, y, a, () => { ctx.scale(z || 1, z || 1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W(30), 0); ctx.lineTo(-W(26), -W(5)); ctx.lineTo(-W(26), W(5)); ctx.closePath(); ctx.fill(); ctx.fillRect(-W(6), -W(30), W(10), W(60)); }); },
    orbit(x, y, rx, ry, col) { const p = T(x, y); ctx.save(); ctx.strokeStyle = col; ctx.setLineDash([3, 6]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.x, p.y - W(60), W(rx), W(ry), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); },
    static(x, y, r) { const p = T(x, y); ctx.save(); ctx.fillStyle = 'rgba(167,139,250,0.14)'; ctx.beginPath(); ctx.arc(p.x, p.y, W(r), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(167,139,250,0.6)'; for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = W(r) * ((i * 37) % 100) / 100; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr); ctx.lineTo(p.x + Math.cos(a) * rr + 4, p.y + Math.sin(a) * rr); ctx.stroke(); } ctx.restore(); },
    charge(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#1f2937'; ctx.fillRect(p.x - 5, p.y - 4, 10, 8); ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    pickup(x, y) { const p = T(x, y); ctx.save(); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(10,30,20,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, W(22), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4ade80'; ctx.font = '800 ' + W(22) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', p.x, p.y + 1); ctx.restore(); },
    mine(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(p.x, p.y, W(10), 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#94a3b8'; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.beginPath(); ctx.moveTo(p.x + Math.cos(a) * W(10), p.y + Math.sin(a) * W(10)); ctx.lineTo(p.x + Math.cos(a) * W(15), p.y + Math.sin(a) * W(15)); ctx.stroke(); } ctx.restore(); },
    spawn(kind, x, y, o) {
      const g = window.__v3.game();
      const th = { id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp: (o && o.hp) || 2, speed: 0, heading: (o && o.heading) || Math.PI / 2, target: -1, age: 1, phase: 0, dead: false, sx: x, sy: y, ix: x, iy: y + 200, dur: 4, apex: 0, spawnT: 0 };
      g.threats.push(th);
      return th;
    },
    pickupReal(kind, x, y) { const g = window.__v3.game(); g.pickups.push({ id: g.nextId++, kind, x, y, age: 0.5 }); },
    arc(x1, y1, x2, y2, col) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - W(160), b.x, b.y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = col; ctx.beginPath(); ctx.arc((a.x + b.x) / 2, Math.min(a.y, b.y) - W(80), W(9), 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    shadow(cx, cy, px, py, r) { const c = T(cx, cy), p = T(px, py); const a = Math.atan2(p.y - c.y, p.x - c.x); const dd = Math.hypot(p.x - c.x, p.y - c.y); const half = Math.asin(Math.min(1, W(r) / dd)); ctx.save(); ctx.fillStyle = 'rgba(248,113,113,0.12)'; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, dd * 3, a - half, a + half); ctx.closePath(); ctx.fill(); ctx.restore(); },
    claw(x, y) { const p = T(x, y); ctx.save(); ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x - W(8), p.y + W(12)); ctx.lineTo(p.x - W(4), p.y + W(20)); ctx.moveTo(p.x + W(8), p.y + W(12)); ctx.lineTo(p.x + W(4), p.y + W(20)); ctx.stroke(); ctx.restore(); },
    fuel(x, y, rx, ry) { const p = T(x, y); ctx.save(); const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, W(rx)); g.addColorStop(0, 'rgba(217,249,157,0.38)'); g.addColorStop(1, 'rgba(217,249,157,0.04)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, W(rx), W(ry), 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(217,249,157,0.6)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.restore(); },
    buoy(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#ef4444'; ctx.fillRect(p.x - W(7), p.y - W(20), W(14), W(24)); ctx.fillStyle = '#fef08a'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(p.x, p.y - W(24), W(6), 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
  };
`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${BASE}/v3.html?seed=3`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('straitwatch.v3.freeplay', JSON.stringify({ map: 'strait', wave: 4, weapons: [{ id: 'flak', level: 1 }], armory: { gun: null, hull: null, supply: null }, frequentDrops: false }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.click('[data-free-play]');
await page.waitForSelector('[data-screen="freeplay"]');
await page.click('[data-free-start]');
await page.waitForSelector('.playing');
// Let the convoy sail in, with nothing in the sky, then freeze the frame.
// The busiest flow, so several ships are spread along the lane.
await page.evaluate(() => { const g = window.__v3.game(); g.queue = [{ at: 1e9, kind: 'drone', base: 0 }]; g.raiderQueue = []; g.raiders = []; g.flow = 4; });
for (let i = 0; i < 120; i++) {
  await page.waitForTimeout(250);
  const xs = await page.evaluate(() => window.__v3.game().ships.map((s) => s.x).filter((x) => x > 250 && x < 1450));
  if (xs.length >= 4 && Math.max(...xs) > 1050) break;
}
await page.evaluate(() => {
  const g = window.__v3.game();
  g.threats = []; g.pickups = []; g.raiders = [];
  // Two tidy rows of five along the lane; any other ship sails off-screen.
  g.ships.forEach((o, i) => {
    if (i < 10) { o.x = 300 + (i % 5) * 220; o.y = i < 5 ? 421 : 517; o.heading = 0; }
    else { o.x = -600; }
  });
  g.steps += 1;
});
await page.waitForTimeout(150);
await page.click('.v2-pause');
await page.waitForTimeout(200);
await page.addStyleTag({ content: '.v2-overlay, #overlay, .v2-panel, .v2-alerts { display: none !important; }' });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CONCEPTS);
for (const id of ids) {
  await page.evaluate(([helpers, body]) => {
    const g = window.__v3.game();
    const cv = document.querySelector('canvas');
    const r = cv.getBoundingClientRect();
    let ov = window.__ov;
    if (!ov) {
      ov = document.createElement('canvas');
      ov.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99999';
      document.body.append(ov);
      window.__ov = ov;
    }
    ov.width = innerWidth * devicePixelRatio;
    ov.height = innerHeight * devicePixelRatio;
    const ctx = ov.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    void r;
    window.__saved = window.__saved ?? JSON.stringify({ ships: g.ships.map((o) => ({ x: o.x, y: o.y })), nextId: g.nextId });
    const ships = g.ships.slice(0, 5);
    const low = g.ships.slice(5, 10);
    window.__focus = { x: 0, y: 0, w: 1600 };
    const s = { ships, low, carrier: g.map.carrier, shore: 175, bases: (g.map.bases ?? []).map((b) => ({ x: b.x, y: b.y })), focus: (x, y, w) => { window.__focus = { x, y, w }; } };
    // eslint-disable-next-line no-new-func
    new Function('s', helpers + body)(s);
    // A paused frame is drawn once per step count: nudge it so the game
    // redraws with the sprites placed above.
    g.steps += 1;
  }, [HELPERS, CONCEPTS[id]]);
  await page.waitForTimeout(120);
  const clip = await page.evaluate(() => {
    const f = window.__focus;
    const a = window.__v3.toClient(f.x, f.y);
    const b = window.__v3.toClient(f.x + f.w, f.y + (f.w * 9) / 16);
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  });
  await page.screenshot({ path: `${OUT}concept-${id}.jpg`, type: 'jpeg', quality: 82, clip });
  // Put the frame back as it was for the next one.
  await page.evaluate(() => {
    const g = window.__v3.game();
    const saved = JSON.parse(window.__saved);
    g.ships.forEach((o, i) => Object.assign(o, saved.ships[i]));
    g.threats = [];
    g.pickups = [];
    g.steps += 1;
  });
  await page.waitForTimeout(80);
  console.log(`concept-${id}.jpg`);
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
