// Concept pictures for the special-event round: for each event with a map, a
// real frame of that map (a Test Lab map card: the map's own wave 5), with
// the event's debut enemy brought in, and a few strokes on top showing the
// idea. The frame is the whole map (1600×900 world units) at 667×375, the
// size of a landscape phone; the strokes are drawn in world units through the
// game's own world→screen mapping, as in tools/v3/enemy-ideas/concepts.mjs.
// Usage (with `npx vite preview --port 4185` running on a fresh build):
//   node tools/v3/special-events/shots.mjs [eventId ...]
// Writes docs/design/img/special-events/<eventId>.jpg.
import { createRequire } from 'node:module';
import { mkdirSync, statSync } from 'node:fs';
import { EVENTS } from './events.mjs';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const BASE = process.env.BASE_URL ?? 'http://localhost:4185';
const OUT = new URL('../../../docs/design/img/special-events/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// The threat kind the game's test hook takes for each debut enemy
// (FOES[foe].kind in src/v3/data/foes.ts).
const KIND = {
  sprinter: 'sprinter', decoy: 'decoy', hydra: 'hydra', rocketTruck: 'rocketTruck',
  attackHeli: 'attackHeli', torpedoSub: 'torpedoSub', armored: 'armored', scavenger: 'scavenger',
  stealthJet: 'stealthJet', stealthBomber: 'stealthBomber', diveBomber: 'diveBomber', siege: 'siege', spotter: 'spotter',
  tender: 'tender', bodyguard: 'guard', lure: 'lure', cloud: 'cloud',
};
// The finales have no debut enemy: bring in two of the chapter's instead, so
// the frame isn't empty.
const FINALE_FOES = { 'finale-1': ['decoy', 'hydra'], 'finale-2': ['torpedoSub', 'attackHeli'], 'finale-4': ['tender', 'cloud'] };
// The base to launch from, where base 1 launches nothing (Citadel of Vey).
const LAUNCH_BASE = { citadel: 4 };

// Each concept: run in the page with `d` (drawing helpers in world units)
// and `m` (the map: channels, bases, carrier, roads, subSpots).
const CONCEPTS = {
  rush: `
    d.line(60, 262, 1540, 262, '#fbbf24', 2.5, [10, 7]);
    d.note(1180, 248, 'BOOST LINE');
    for (const [bx, by, lx, tx] of [[260, 130, 330, 420], [800, 120, 760, 690], [1340, 130, 1260, 1150]]) {
      d.line(bx, by, lx, 262, '#f1f5f9', 1.5, [2, 6]);
      d.arrow(lx, 262, tx, 410, '#f87171');
    }
    d.note(70, 230, 'slow: shoot them here');
    d.note(860, 360, 'past the line: all sprint');`,
  'decoy-storm': `
    const pts = d.scatter(42, 1010, 140, 1480, 820, 7);
    for (const [x, y] of pts) d.dot(x, y, '#e5e7eb', 2.4);
    for (const k of [3, 11, 19, 27, 36]) d.ring(pts[k][0], pts[k][1], 26, '#f87171', true);
    d.note(700, 170, '10 swarms, most of them decoys');
    d.note(700, 205, 'circled: the real ones');
    d.note(380, 600, 'no ammo drops');`,
  'hydra-bloom': `
    d.ellipse(800, 590, 650, 300, '#fbbf24');
    d.note(1080, 282, 'HALFWAY RING');
    for (const [bx, by, a] of [[260, 120, 0.45], [260, 120, 0.9], [800, 115, 1.35], [800, 115, 1.8], [1340, 120, 2.25], [1340, 120, 2.7]]) d.arrow(bx, by, bx + Math.cos(a) * 170, by + Math.sin(a) * 170, '#f87171');
    const sx = 560, sy = 430;
    d.cross(sx, sy, '#fbbf24');
    for (const a of [1.0, 1.55, 2.1]) d.arrow(sx, sy, sx + Math.cos(a) * 110, sy + Math.sin(a) * 110, '#f87171');
    d.note(70, 240, 'outside: dies whole');
    d.note(600, 420, 'inside: splits into three');`,
  'rocket-convoy': `
    const xs = [940, 800, 660, 520];
    xs.forEach((x, k) => { d.truck(x, 113); d.num(x, 172, k + 1); });
    xs.forEach((x, k) => d.arc(x, 125, 1180 - k * 190, 330, '#f87171'));
    d.arrow(470, 215, 1000, 215, '#fbbf24');
    d.note(1030, 420, 'nose to tail: launchers rise in turn');
    d.note(1030, 455, 'kill the front one: the rest stall');`,
  'finale-1': `
    d.phases([[280, 300, '1 · DECOY STORM'], [800, 300, '2 · HYDRA FAN'], [1320, 300, '3 · TRUCK PAIR']]);
    for (const [x, y] of d.scatter(14, 180, 340, 400, 420, 3)) d.dot(x, y, '#e5e7eb', 2.4);
    for (const a of [1.2, 1.57, 1.94]) d.arrow(800, 340, 800 + Math.cos(a) * 120, 340 + Math.sin(a) * 120, '#f87171');
    d.truck(1250, 765); d.truck(1380, 820);
    d.note(150, 470, 'no ammo drops in phase 1');`,
  'gunship-wall': `
    const xs = [430, 640, 960, 1170];
    xs.forEach((x, k) => { d.heli(x, 475); d.num(x, 425, k + 1); d.line(x, 495, x - 40, 590, '#f87171', 1.8, [5, 4]); });
    d.arrow(430, 520, 1170, 520, '#fbbf24');
    d.note(1240, 470, 'they fire in turn');
    d.note(1240, 505, 'down one: a gap');`,
  'wolf-pack': `
    const subs = [[160, 228], [700, 220], [1450, 228], [300, 735], [960, 735]];
    const aims = [[900, 640], [1250, 640], [600, 640], [880, 300], [1350, 310]];
    subs.forEach(([x, y], k) => { d.line(x, y, aims[k][0], aims[k][1], '#f87171', 2, [8, 6]); d.periscope(x, y); });
    d.note(500, 880, 'five lines at once: slip the convoy between them');`,
  'shield-wall': `
    const x0 = 330, y0 = 250;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) d.drone(x0 + c * 55, y0 + r * 45, Math.PI / 2, '#e5e7eb', 1);
    d.line(x0 - 25, y0 + 125, x0 + 190, y0 + 125, '#cbd5e1', 5);
    d.note(560, 385, 'plates to the front');
    d.curve(560, 250, 700, 330, '#fbbf24');
    d.note(560, 520, 'HORN: the whole block banks,');
    d.note(560, 555, 'sides open for a second');`,
  'supply-raid': `
    const picks = [[180, 450], [430, 455], [690, 450], [1010, 455], [1230, 455], [1470, 460], [560, 720], [1260, 720]];
    for (const [x, y] of picks) d.pickup(x, y);
    for (const [fx, fy, k] of [[0, 210, 0], [0, 640, 6], [1600, 210, 5], [1600, 640, 7], [720, 220, 2], [1100, 220, 3]]) d.arrow(fx, fy, picks[k][0] + (fx < picks[k][0] ? -30 : 30), picks[k][1] - 20, '#f87171');
    d.note(60, 815, 'scavengers race you for every pickup');`,
  'finale-2': `
    d.phases([[300, 330, '1 · WOLF PACK'], [800, 330, '2 · GUNSHIPS'], [1300, 330, '3 · ARMORED BLOCK']]);
    d.periscope(200, 610); d.line(200, 610, 520, 430, '#f87171', 2, [8, 6]);
    d.heli(760, 230); d.heli(880, 230);
    for (let c = 0; c < 4; c++) d.drone(1220 + c * 40, 240, Math.PI / 2, '#e5e7eb', 0.9);
    d.note(80, 700, 'through the canal under all of them');`,
  blackout: `
    d.dark(0.62);
    for (const [x1, y1, x2, y2] of [[80, 300, 330, 400], [1540, 260, 1250, 380], [700, 120, 820, 330], [1500, 640, 1200, 520]]) d.flash(x1, y1, x2, y2);
    d.glow(1000, 600, 70);
    d.note(1080, 650, 'star shell: lights it all');
    d.note(80, 230, 'only the flash shows');`,
  'carpet-run': `
    const lines = [[720, 372], [620, 480], [720, 588]];
    for (const [x, y] of lines) { d.plane(x, y, Math.PI, '#94a3b8'); d.line(x - 60, y, 250, y, '#f87171', 2.2, [10, 7]); }
    d.note(860, 640, 'three wide: bombs cover the lane');
    d.note(860, 675, 'edge to edge. Down one: a gap');`,
  'dive-circus': `
    const pts = [[200, 545], [370, 600], [540, 545], [710, 600], [880, 545], [1050, 600], [1220, 545], [1390, 600]];
    pts.forEach(([x, y], k) => { d.ring(x, y, 38, '#f87171', k === 0); d.num(x, y + 66, k + 1); });
    d.plane(200, 400, Math.PI / 2, '#94a3b8');
    d.arrow(200, 440, 200, 500, '#fbbf24');
    d.note(560, 720, 'one circle, one plane, a beat apart');`,
  bombardment: `
    const hs = [[420, 165], [880, 170], [1300, 165]];
    const tg = [[500, 430], [980, 470], [1240, 420]];
    hs.forEach(([x, y], k) => { d.hatch(x, y); d.num(x, y - 55, k + 1); d.line(x, y + 20, tg[k][0], tg[k][1], '#f87171', 1.5, [3, 5]); d.ring(tg[k][0], tg[k][1], 40, '#f87171', false); });
    d.note(40, 625, 'one gun rises, fires, drops; then the next');
    d.note(40, 660, 'each kill closes its hatch for good');`,
  'fire-mission': `
    d.ellipse(900, 310, 300, 95, '#fbbf24');
    d.plane(1200, 310, Math.PI / 2, '#fbbf24');
    d.plane(1150, 245, Math.PI / 2, '#94a3b8', 0.7); d.plane(1150, 375, Math.PI / 2, '#94a3b8', 0.7);
    [[520, 560], [800, 580], [1080, 555]].forEach(([x, y], k) => { d.line(1200, 310, x, y, '#f87171', 1.2, [3, 5]); d.crosshair(x, y); d.num(x, y + 65, k + 1); });
    d.note(560, 175, 'SPOTTER: paints a ship, calls a strike');
    d.note(560, 210, 'down it: every strike called off');`,
  'repair-yard': `
    d.mother(880, 300);
    for (const [x, y] of [[700, 230], [1060, 230], [880, 420]]) { d.line(x, y, 880, 300, '#4ade80', 2, [4, 4]); d.tender(x, y); d.plus(x, y - 40); }
    d.arrow(560, 300, 700, 300, '#fbbf24');
    d.note(90, 610, 'tenders first, then the mothership');`,
  'escort-run': `
    const mx = 470, my = 250;
    for (const r of [45, 80, 115]) { d.ring(mx, my, r, '#e5e7eb', false); for (let k = 0; k < 6; k++) { const a = k * 1.047 + r / 40; d.dot(mx + Math.cos(a) * r, my + Math.sin(a) * r, '#e5e7eb', 2.6); } }
    d.heavy(mx, my, 0.45);
    d.arrow(mx + 130, my + 60, 940, 500, '#f87171');
    d.note(560, 640, 'every ring stripped: it speeds up');`,
  'siren-field': `
    const bs = [[260, 455], [1340, 455], [560, 740], [1050, 740], [800, 190]];
    for (const [x, y] of bs) { d.ring(x, y, 80, '#fbbf24', false); d.buoy(x, y); }
    for (const [x, y] of bs) d.line(800, 455, x + (x < 800 ? 60 : x > 800 ? -60 : 0), y + (y < 455 ? 60 : y > 455 ? -60 : 0), '#7dd3fc', 1.6, [4, 5]);
    d.arrow(1560, 140, 1150, 300, '#f87171'); d.arrow(1560, 220, 1180, 360, '#f87171');
    d.note(60, 860, 'helpers chase the beacons; tap one to sink it');`,
  firestorm: `
    for (let k = 0; k < 6; k++) { const a = k * 1.047 + 0.3; const x = 800 + Math.cos(a) * 700, y = 430 + Math.sin(a) * 400; d.arrow(x, y, 800 + Math.cos(a) * 470, 430 + Math.sin(a) * 260, '#fb923c'); }
    for (const [x, y] of [[560, 570], [1020, 285], [1180, 580]]) d.fire(x, y, 50);
    d.note(80, 440, 'kill them far out;');
    d.note(80, 475, 'where one bursts, the water burns');`,
  'finale-4': `
    d.phases([[1250, 470, '1 · REPAIR YARD'], [800, 470, '2 · ESCORT RUN'], [350, 470, '3 · FIRESTORM']]);
    for (const [x, y] of [[1130, 230], [1370, 230]]) { d.line(x, y, 1250, 300, '#4ade80', 2, [4, 4]); d.plus(x, y - 30); }
    d.ring(820, 340, 60, '#e5e7eb', false); d.heavy(820, 340, 0.6);
    d.fire(350, 600, 50); d.fire(520, 640, 35);
    d.note(80, 860, 'on the Citadel itself, under its own guns');`,
};

const HELPERS = String.raw`
  const T = (x, y) => window.__v3.toClient(x, y);
  const k = window.__v3.toClient(1, 0).x - window.__v3.toClient(0, 0).x;
  const ctx = window.__ov.getContext('2d');
  const W = (n) => n * k;
  function at(x, y, rot, f) { const p = T(x, y); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(rot || 0); f(); ctx.restore(); }
  const B = (() => { const a = T(0, 0), b = T(1600, 900); return { x0: a.x + 3, y0: a.y + 3, x1: b.x - 3, y1: b.y - 3 }; })();
  const d = {
    title(text) {
      ctx.save(); ctx.font = '800 11px system-ui, sans-serif';
      const w = ctx.measureText(text).width + 14, h = 18;
      ctx.fillStyle = 'rgba(5,10,16,0.86)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(B.x0 + 3, B.y0 + 3, w, h, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fbbf24'; ctx.textBaseline = 'middle'; ctx.fillText(text, B.x0 + 10, B.y0 + 3 + h / 2 + 1); ctx.restore();
    },
    note(x, y, text) {
      const p = T(x, y); ctx.save(); ctx.font = '700 9.5px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.fillStyle = '#f8fafc';
      const lx = Math.min(Math.max(p.x, B.x0), B.x1 - ctx.measureText(text).width);
      const ly = Math.min(Math.max(p.y, B.y0 + 30), B.y1 - 4);
      ctx.strokeText(text, lx, ly); ctx.fillText(text, lx, ly); ctx.restore();
    },
    num(x, y, n) { const p = T(x, y); ctx.save(); ctx.fillStyle = 'rgba(5,10,16,0.86)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fbbf24'; ctx.font = '800 8.5px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), p.x, p.y + 0.5); ctx.restore(); },
    line(x1, y1, x2, y2, col, w, dash) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = w + 2; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke(); ctx.restore(); },
    arrow(x1, y1, x2, y2, col) { const a = Math.atan2(y2 - y1, x2 - x1); d.line(x1, y1, x2 - Math.cos(a) * 14, y2 - Math.sin(a) * 14, col, 2.2); at(x2, y2, a, () => { ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-W(26), -W(13)); ctx.lineTo(-W(26), W(13)); ctx.closePath(); ctx.fill(); ctx.stroke(); }); },
    ring(x, y, r, col, solid) { const p = T(x, y); ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3.5; ctx.setLineDash(solid ? [] : [5, 4]); ctx.beginPath(); ctx.arc(p.x, p.y, W(r), 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.stroke(); ctx.restore(); },
    ellipse(x, y, rx, ry, col) { const p = T(x, y); ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 4; ctx.setLineDash([9, 6]); ctx.beginPath(); ctx.ellipse(p.x, p.y, W(rx), W(ry), 0, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke(); ctx.restore(); },
    dot(x, y, col, r) { const p = T(x, y); ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r || 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); },
    scatter(n, x0, y0, x1, y1, seed) { let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280; return Array.from({ length: n }, () => [x0 + r() * (x1 - x0), y0 + r() * (y1 - y0)]); },
    cross(x, y, col) { const p = T(x, y); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; const r = 5; ctx.beginPath(); ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r); ctx.moveTo(p.x + r, p.y - r); ctx.lineTo(p.x - r, p.y + r); ctx.stroke(); ctx.restore(); },
    crosshair(x, y) { d.ring(x, y, 34, '#f87171', true); const p = T(x, y); ctx.save(); ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x - W(50), p.y); ctx.lineTo(p.x - W(18), p.y); ctx.moveTo(p.x + W(18), p.y); ctx.lineTo(p.x + W(50), p.y); ctx.moveTo(p.x, p.y - W(50)); ctx.lineTo(p.x, p.y - W(18)); ctx.moveTo(p.x, p.y + W(18)); ctx.lineTo(p.x, p.y + W(50)); ctx.stroke(); ctx.restore(); },
    arc(x1, y1, x2, y2, col) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo((a.x + b.x) / 2, Math.min(a.y, b.y) - W(40), b.x, b.y); ctx.stroke(); ctx.restore(); d.dot(x2, y2, col, 2.5); },
    curve(x1, y1, x2, y2, col) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, a.y, b.x, b.y); ctx.stroke(); ctx.restore(); at(x2, y2, Math.PI / 2, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(W(8), 0); ctx.lineTo(-W(16), -W(12)); ctx.lineTo(-W(16), W(12)); ctx.closePath(); ctx.fill(); }); },
    phases(list) {
      list.forEach(([x, y, text], i) => {
        const p = T(x, y); ctx.save(); ctx.font = '800 9.5px system-ui, sans-serif';
        const w = ctx.measureText(text).width + 12, h = 16;
        ctx.fillStyle = 'rgba(5,10,16,0.86)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, p.x, p.y + 1); ctx.restore();
        if (i < list.length - 1) { const [nx] = list[i + 1]; const gap = (nx - x) / 2; d.arrow(x + gap * 0.62, y, nx - gap * 0.62, y, '#fbbf24'); }
      });
    },
    truck(x, y) { at(x, y, 0, () => { ctx.fillStyle = '#57534e'; ctx.strokeStyle = '#f87171'; ctx.lineWidth = 1.2; ctx.fillRect(-W(30), -W(11), W(60), W(22)); ctx.strokeRect(-W(30), -W(11), W(60), W(22)); ctx.fillStyle = '#a8a29e'; ctx.save(); ctx.rotate(-0.6); ctx.fillRect(-W(4), -W(6), W(36), W(12)); ctx.restore(); }); },
    heli(x, y) { at(x, y, Math.PI / 2, () => { ctx.fillStyle = '#7f1d1d'; ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(0, 0, W(26), W(13), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillRect(-W(50), -W(3), W(30), W(6)); ctx.strokeStyle = 'rgba(240,240,240,0.7)'; ctx.beginPath(); ctx.arc(0, 0, W(40), 0, Math.PI * 2); ctx.stroke(); }); },
    plane(x, y, a, col, z) { at(x, y, a, () => { ctx.scale(z || 1, z || 1); ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(W(34), 0); ctx.lineTo(-W(28), -W(6)); ctx.lineTo(-W(28), W(6)); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(-W(6), -W(34), W(12), W(68)); }); },
    drone(x, y, a, col, s) { at(x, y, a, () => { const z = W(16) * (s || 1); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(z, 0); ctx.lineTo(-z * 0.8, -z * 0.9); ctx.lineTo(-z * 0.4, 0); ctx.lineTo(-z * 0.8, z * 0.9); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); }); },
    periscope(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#f87171'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, W(16), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, W(30), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); },
    pickup(x, y) { const p = T(x, y); ctx.save(); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(10,30,20,0.9)'; ctx.beginPath(); ctx.arc(p.x, p.y, W(24), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#4ade80'; ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', p.x, p.y + 0.5); ctx.restore(); },
    hatch(x, y) { at(x, y, 0, () => { ctx.fillStyle = '#292524'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.6; ctx.fillRect(-W(26), -W(18), W(52), W(36)); ctx.strokeRect(-W(26), -W(18), W(52), W(36)); ctx.beginPath(); ctx.moveTo(-W(26), -W(18)); ctx.lineTo(W(26), W(18)); ctx.moveTo(W(26), -W(18)); ctx.lineTo(-W(26), W(18)); ctx.stroke(); }); },
    mother(x, y) { at(x, y, 0, () => { ctx.fillStyle = 'rgba(127,29,29,0.9)'; ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, W(90), W(34), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fca5a5'; ctx.fillRect(-W(30), -W(6), W(60), W(12)); }); },
    tender(x, y) { at(x, y, 0, () => { ctx.fillStyle = '#334155'; ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(W(30), 0); ctx.lineTo(W(10), -W(12)); ctx.lineTo(-W(30), -W(12)); ctx.lineTo(-W(30), W(12)); ctx.lineTo(W(10), W(12)); ctx.closePath(); ctx.fill(); ctx.stroke(); }); },
    plus(x, y) { const p = T(x, y); ctx.save(); ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p.x - 4, p.y); ctx.lineTo(p.x + 4, p.y); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x, p.y + 4); ctx.stroke(); ctx.restore(); },
    heavy(x, y, a) { at(x, y, a, () => { ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.fillRect(-W(34), -W(8), W(62), W(16)); ctx.strokeRect(-W(34), -W(8), W(62), W(16)); ctx.fillStyle = '#ef4444'; ctx.fillRect(W(22), -W(8), W(8), W(16)); }); },
    buoy(x, y) { const p = T(x, y); ctx.save(); ctx.fillStyle = '#ef4444'; ctx.fillRect(p.x - W(8), p.y - W(22), W(16), W(26)); ctx.fillStyle = '#fef08a'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(p.x, p.y - W(28), W(8), 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    fire(x, y, r) { const p = T(x, y); ctx.save(); const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, W(r)); g.addColorStop(0, 'rgba(254,240,138,0.95)'); g.addColorStop(0.45, 'rgba(249,115,22,0.8)'); g.addColorStop(1, 'rgba(220,38,38,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, W(r), 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
    dark(alpha) { const a = T(0, 0), b = T(1600, 900); ctx.save(); ctx.fillStyle = 'rgba(2,6,18,' + alpha + ')'; ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); ctx.restore(); },
    flash(x1, y1, x2, y2) { const a = T(x1, y1), b = T(x2, y2); ctx.save(); const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, 'rgba(253,230,138,0)'); g.addColorStop(1, 'rgba(253,230,138,1)'); ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore(); d.plane(x2, y2, Math.atan2(y2 - y1, x2 - x1), '#475569', 0.8); },
    glow(x, y, r) { const p = T(x, y); ctx.save(); const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, W(r) * 2.4); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,250,210,0.55)'); g.addColorStop(1, 'rgba(255,250,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, W(r) * 2.4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },
  };
`;

const ids = process.argv.slice(2).length ? process.argv.slice(2) : EVENTS.filter((e) => e.map).map((e) => e.id);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
// The whole map is 523×294 CSS px in a 667×375 viewport: this scale makes
// the cropped picture 667×375.
const page = await browser.newPage({ viewport: { width: 667, height: 375 }, deviceScaleFactor: 667 / 523, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
for (const id of ids) {
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev || !ev.map || !CONCEPTS[id]) { console.log(`${id}: no map or no concept, skipped`); continue; }
  await page.goto(`${BASE}/v3.html?seed=5&lab=map-${ev.map}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6000);
  await page.addStyleTag({ content: '.v2-overlay, #overlay, .v2-alerts { display: none !important; }' });
  const foes = ev.foe ? [ev.foe, ev.foe] : FINALE_FOES[id] ?? [];
  for (const f of foes) {
    await page.evaluate(([kind, base]) => window.__v3.foe(kind, base), [KIND[f], LAUNCH_BASE[ev.map] ?? 1]);
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(1500);
  await page.evaluate(([helpers, body, title]) => {
    window.__v3.freeze(true);
    const g = window.__v3.game();
    g.steps += 1;
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
    // eslint-disable-next-line no-new-func
    new Function('m', helpers + body + '\nd.title(' + JSON.stringify(title) + ');')(g.map);
  }, [HELPERS, CONCEPTS[id], `SPECIAL EVENT · ${ev.name.replace(/^Chapter finale: /, 'FINALE: ').toUpperCase()}`]);
  await page.waitForTimeout(150);
  const clip = await page.evaluate(() => {
    const a = window.__v3.toClient(0, 0);
    const b = window.__v3.toClient(1600, 900);
    return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
  });
  const file = `${OUT}${id}.jpg`;
  await page.screenshot({ path: file, type: 'jpeg', quality: 75, clip });
  console.log(`${id}.jpg ${Math.round(statSync(file).size / 1024)} KB`);
}
if (errors.length) console.log('page errors:', errors);
await browser.close();
