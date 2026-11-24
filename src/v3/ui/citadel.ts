// The Citadel of Vey: its shield dome, the three generators that feed it, the
// keep itself, its ruin and its rebuilding. Draws only; reads the game and
// mutates nothing.
//
// Log v67 (the player: "a better looking [Citadel] and more unique
// animations"; destroyed once, back for the boss):
//  - the dome is a hex lattice with a light sweeping across it, a pulse that
//    opens out from the keep every few seconds, ripples where a shot is turned
//    away, and a flicker that grows as the generators fall; when the last one
//    does, it shatters;
//  - each generator charges up (its ring fills, sparks, its tether to the keep
//    reaches out) and then feeds the keep with pulses along a lightning tether;
//  - the keep is a star fort on its rock with a turning radar, ports on its
//    bastions and an iris over its silo that opens for a salvo: the core eye
//    flares and the lit warning's rings close in on it first;
//  - when it falls it goes in a chain of explosions and a shock ring, and it
//    stays a smoking ruin through the waves (it is destroyed once);
//  - for the boss it is rebuilt: a blueprint star, the walls rising from the
//    foundation under welding sparks, then the dome closing over it.

import { CITADEL } from '../data/config';
import { shieldUp, type Game, type Threat } from '../sim/game';
import { laneLength } from '../sim/lanes';

const RIM = '#d94a3a';
const CYAN = '#7fe8ff';
const GOLD = '#ffd166';
/** Seconds the Citadel takes to rise from its foundation (the boss), and a
 *  generator to charge. */
const RISE = 3.2;
const CHARGE = 2.4;
const R_OUT = 74;
const R_IN = 46;

const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));

/** The Citadel rebuilt for the boss: how far its walls have risen (1 once up,
 *  and always 1 for a keep that has stood since the run began). */
function built(g: Game, th: Threat): number {
  const since = g.t - g.cit.domeUpAt;
  if (th.age < RISE && since >= 0 && since < RISE + 0.8) return smooth(clamp01(th.age / RISE));
  return 1;
}

/** A generator charging up (0..1; 1 once it feeds the dome). */
function charge(g: Game, th: Threat): number {
  const since = g.t - g.cit.domeUpAt;
  if (since < 0 || since > CHARGE + 1.5) return 1;
  const delay = ((th.base ?? 0) % 3) * 0.35;
  return smooth(clamp01((th.age - delay) / CHARGE));
}

function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, r: number, a: number): void {
  ctx.fillStyle = `rgba(58,52,52,${a * (1 - k)})`;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.5 + k), 0, Math.PI * 2);
  ctx.fill();
}

function fire(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, size: number, seed: number): void {
  const f = 0.65 + 0.35 * Math.sin(t * 10 + seed * 3.1);
  ctx.fillStyle = `rgba(255,120,40,${0.6 * f})`;
  ctx.beginPath();
  ctx.arc(x, y, size * f + size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,225,130,${0.75 * f})`;
  ctx.beginPath();
  ctx.arc(x, y - size * 0.15, size * 0.45 * f, 0, Math.PI * 2);
  ctx.fill();
}

/** A jagged bolt from (ax, ay) to (bx, by). */
function bolt(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, t: number, amp: number, seed: number): void {
  const n = 12;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const off = Math.sin(t * 19 + i * 1.9 + seed) * amp * Math.sin(Math.PI * u);
    ctx.lineTo(ax + dx * u + px * off, ay + dy * u + py * off);
  }
  ctx.lineTo(bx, by);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Under the convoy: the dome, the tethers, the ruin

export function drawCitadelUnder(ctx: CanvasRenderingContext2D, g: Game): void {
  const m = g.map;
  const s = m.shield;
  if (!s) return;
  const t = g.t;
  const keep = g.threats.find((th) => th.kind === 'citadel' && !th.dead);
  const gens = g.threats.filter((th) => th.kind === 'generator' && !th.dead);
  const up = shieldUp(g);

  // The ruin of a Citadel that has fallen.
  m.bases.forEach((b, i) => {
    if (b.core && g.baseDown[i] && !keep) drawRuin(ctx, g, b.x, b.y);
  });

  // Tethers: each generator feeds the keep along a bolt, a pulse running
  // down it now and then. While it charges the tether reaches out.
  if (keep) {
    for (const gen of gens) {
      const c = charge(g, gen);
      const reach = c * built(g, keep);
      if (reach <= 0.02) continue;
      const tx = gen.x + (keep.x - gen.x) * reach;
      const ty = gen.y + (keep.y - gen.y) * reach;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(127,232,255,0.16)';
      ctx.lineWidth = 9;
      bolt(ctx, gen.x, gen.y, tx, ty, t, 7, gen.id);
      ctx.strokeStyle = `rgba(190,246,255,${0.5 + 0.2 * Math.sin(t * 8 + gen.id)})`;
      ctx.lineWidth = 2.2;
      bolt(ctx, gen.x, gen.y, tx, ty, t, 7, gen.id);
      // A pulse of energy running to the keep.
      const u = ((t * 0.55 + (gen.id % 7) * 0.31) % 1) * reach;
      const px = gen.x + (keep.x - gen.x) * u;
      const py = gen.y + (keep.y - gen.y) * u;
      const glow = ctx.createRadialGradient(px, py, 1, px, py, 15);
      glow.addColorStop(0, 'rgba(230,252,255,0.95)');
      glow.addColorStop(1, 'rgba(127,232,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(px, py, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // The dome, closing over a rebuilt keep, standing, or shattering.
  const rising = clamp01((t - g.cit.domeUpAt - (keep && built(g, keep) < 1 ? RISE * 0.7 : 0.4)) / 1.4);
  const collapse = t - g.cit.domeDownAt;
  if (up && rising > 0) drawDome(ctx, g, s.x, s.y, s.r, gens.length, rising);
  else if (!up && collapse >= 0 && collapse < 1.6) drawDomeShatter(ctx, s.x, s.y, s.r, collapse / 1.6);

  // GRAND SALVO's warning: the lit keep's aim, drawn out to the lead ship.
  const lit = g.fx.find((f) => f.kind === 'text' && f.text === 'GRAND SALVO');
  if (lit && keep) drawSalvoLock(ctx, g, keep, 1 - lit.age / lit.life);
}

function drawDome(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, r: number, gens: number, rise: number): void {
  const t = g.t;
  const k = Math.max(1, Math.min(3, gens)) / 3;
  // Fewer generators, a weaker dome: it flickers more as they fall.
  const flick = k >= 1 ? 1 : 0.7 + 0.3 * Math.sin(t * (14 + 6 * (1 - k)) + Math.sin(t * 3) * 3);
  const R = r * smooth(rise);
  // A turned-away shot lights the dome.
  let hit = 0;
  for (const f of g.fx) if (f.kind === 'block' && Math.hypot(f.x - x, f.y - y) < r + 20) hit = Math.max(hit, 1 - f.age / f.life);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.clip();
  const body = ctx.createRadialGradient(x, y, R * 0.2, x, y, R);
  body.addColorStop(0, `rgba(127,232,255,${0.02 * flick})`);
  body.addColorStop(0.8, `rgba(127,232,255,${(0.06 + 0.04 * k) * flick + 0.1 * hit})`);
  body.addColorStop(1, `rgba(170,244,255,${(0.2 + 0.1 * k) * flick + 0.25 * hit})`);
  ctx.fillStyle = body;
  ctx.fillRect(x - R, y - R, R * 2, R * 2);
  // The lattice: hexagons, a bright band sweeping across them.
  const size = 24;
  const sweep = ((t * 0.28) % 1.6) - 0.3;
  ctx.lineWidth = 1.4;
  for (let row = -9; row <= 9; row++) {
    for (let col = -9; col <= 9; col++) {
      const cx = x + col * size * 1.5;
      const cy = y + row * size * 1.732 + (col % 2 ? size * 0.866 : 0);
      const d = Math.hypot(cx - x, cy - y);
      if (d > R + size) continue;
      const band = Math.max(0, 1 - Math.abs((cx - (x - r) + (cy - y) * 0.4) / (2 * r) - sweep) * 6);
      const a = (0.07 + 0.5 * band + 0.25 * hit * Math.max(0, 1 - d / r)) * flick;
      if (a < 0.03) continue;
      ctx.strokeStyle = `rgba(150,238,255,${a})`;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const hx = cx + Math.cos(ang) * size * 0.58;
        const hy = cy + Math.sin(ang) * size * 0.58;
        if (i) ctx.lineTo(hx, hy);
        else ctx.moveTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  // A pulse opening out from the keep every 3.4 s.
  const pk = (t % 3.4) / 3.4;
  ctx.strokeStyle = `rgba(190,246,255,${0.4 * (1 - pk) * flick})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, R * pk, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // The rim: a bright edge with three arcs of energy turning round it.
  ctx.strokeStyle = `rgba(150,238,255,${(0.45 + 0.2 * Math.sin(t * 3)) * flick + 0.3 * hit})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(235,252,255,${0.75 * flick})`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a0 = t * 0.9 + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(x, y, R, a0, a0 + 0.5);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

/** The last generator falls: the dome breaks into arcs that fly outward. */
function drawDomeShatter(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, u: number): void {
  ctx.save();
  if (u < 0.2) {
    ctx.fillStyle = `rgba(190,246,255,${0.3 * (1 - u / 0.2)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a0 = (i * Math.PI * 2) / 14 + Math.sin(i * 7.3) * 0.1;
    const push = u * (14 + (i % 4) * 8);
    ctx.strokeStyle = `rgba(190,246,255,${0.9 * (1 - u)})`;
    ctx.lineWidth = 5 * (1 - u) + 1;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a0 + 0.15) * push, y + Math.sin(a0 + 0.15) * push, r + push * 0.4, a0, a0 + 0.3 + (i % 3) * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

/** The lit warning of a grand salvo: rings close on the keep, and a line runs
 *  out to the ship it is aimed at (the lead ship), ringed and counting down. */
function drawSalvoLock(ctx: CanvasRenderingContext2D, g: Game, keep: Threat, left: number): void {
  const t = g.t;
  const lead = g.ships.filter((s) => !s.vip).reduce<(typeof g.ships)[number] | null>((a, s) => (!a || s.d / laneLength(g.map.channels[s.channel]) > a.d / laneLength(g.map.channels[a.channel]) ? s : a), null);
  ctx.save();
  // Rings closing on the keep.
  for (let i = 0; i < 3; i++) {
    const u = (left * 1.7 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,150,90,${0.7 * (1 - u)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(keep.x, keep.y, 30 + u * 120, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (lead) {
    ctx.strokeStyle = `rgba(255,120,80,${0.5 + 0.3 * Math.sin(t * 16)})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -t * 60;
    ctx.beginPath();
    ctx.moveTo(keep.x, keep.y);
    ctx.lineTo(lead.x, lead.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // A ring on the ship that closes as the salvo nears.
    const rr = 26 + 30 * left;
    ctx.strokeStyle = 'rgba(255,120,80,0.95)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(lead.x, lead.y, rr, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + t * 2;
      ctx.beginPath();
      ctx.moveTo(lead.x + Math.cos(a) * (rr - 6), lead.y + Math.sin(a) * (rr - 6));
      ctx.lineTo(lead.x + Math.cos(a) * (rr + 8), lead.y + Math.sin(a) * (rr + 8));
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// The ruin, and its fall

function drawRuin(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number): void {
  const t = g.t;
  const fall = t - g.cit.fellAt;
  ctx.save();
  // A scorched foundation and the broken star: most of its walls gone.
  ctx.fillStyle = 'rgba(16,12,10,0.82)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 92, 70, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2d27';
  ctx.strokeStyle = 'rgba(217,74,58,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    // A stump of a bastion: a few jagged blocks round the star's points.
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const bx = x + Math.cos(a) * 56;
    const by = y + Math.sin(a) * 56;
    ctx.beginPath();
    ctx.moveTo(bx - 14, by + 6);
    ctx.lineTo(bx - 9, by - 8 - (i % 3) * 3);
    ctx.lineTo(bx - 1, by - 3);
    ctx.lineTo(bx + 6, by - 11);
    ctx.lineTo(bx + 14, by + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // What is left of the keep: a ring of fallen wall round a crater.
  ctx.fillStyle = '#251a16';
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const glow = ctx.createRadialGradient(x, y, 2, x, y, 26);
  glow.addColorStop(0, `rgba(255,140,50,${0.55 + 0.2 * Math.sin(t * 6)})`);
  glow.addColorStop(1, 'rgba(255,60,20,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  // Fires in the rubble, smoke going up on the wind.
  for (const [dx, dy, s, seed] of [[-34, 12, 10, 1], [30, -16, 12, 2], [8, 34, 9, 3], [-14, -36, 9, 4], [50, 20, 7, 5], [-52, -10, 7, 6]] as const) fire(ctx, x + dx, y + dy, t, s, seed);
  for (let k = 0; k < 8; k++) {
    const u = (k / 8 + t * 0.1) % 1;
    smoke(ctx, x - 10 + u * 90 + Math.sin(k * 2.3) * 14, y - 10 - u * 150, u, 18 + u * 14, 0.6);
  }
  // The fall: a chain of blasts across the fort, a shock ring, dust.
  // The last Citadel of the boss round (the game's finale) goes longer.
  const finale = (g.event?.run ?? 0) >= 3 && !!g.event;
  const span = finale ? 6 : 3.6;
  if (fall >= 0 && fall < span) {
    for (let i = 0; i < (finale ? 22 : 11); i++) {
      const start = i * (finale ? 0.24 : 0.26);
      const u = (fall - start) / 0.8;
      if (u < 0 || u > 1) continue;
      const a = i * 2.4;
      const d = 14 + (i % 4) * 17;
      const bx = x + Math.cos(a) * d;
      const by = y + Math.sin(a) * d * 0.85;
      const rr = 28 + 70 * u;
      const flash = ctx.createRadialGradient(bx, by, 2, bx, by, rr);
      flash.addColorStop(0, `rgba(255,252,230,${1 - u})`);
      flash.addColorStop(0.4, `rgba(255,170,70,${0.9 * (1 - u)})`);
      flash.addColorStop(1, 'rgba(255,80,30,0)');
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(bx, by, rr, 0, Math.PI * 2);
      ctx.fill();
      // Debris thrown out of each blast.
      ctx.fillStyle = `rgba(60,44,38,${1 - u})`;
      for (let k = 0; k < 4; k++) {
        const da = a + k * 1.6 + i;
        ctx.fillRect(bx + Math.cos(da) * u * 80 - 3, by + Math.sin(da) * u * 80 - 3 - 30 * u * (1 - u), 6, 6);
      }
    }
    const sk = clamp01(fall / 1.6);
    ctx.strokeStyle = `rgba(255,220,170,${0.8 * (1 - sk)})`;
    ctx.lineWidth = 8 * (1 - sk) + 1;
    ctx.beginPath();
    ctx.arc(x, y, 30 + sk * 300, 0, Math.PI * 2);
    ctx.stroke();
    if (fall < 0.3 || (finale && fall > 3.2 && fall < 3.7)) {
      const fk = fall < 0.3 ? 1 - fall / 0.3 : 1 - Math.abs(fall - 3.45) / 0.25;
      ctx.fillStyle = `rgba(255,255,255,${(finale ? 0.9 : 0.7) * fk})`;
      ctx.beginPath();
      ctx.arc(x, y, finale ? 190 : 120, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(70,60,56,${0.55 * (1 - fall / span)})`;
    ctx.beginPath();
    ctx.arc(x, y - fall * 8, 60 + fall * 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// A generator

export function drawGenerator(ctx: CanvasRenderingContext2D, g: Game, th: Threat, pill: (x: number, y: number) => void, bar: (x: number, y: number, w: number, frac: number, col: string) => void, shots: boolean): void {
  const t = g.t;
  const c = charge(g, th);
  const pulse = 0.5 + 0.5 * Math.sin(t * 4 + th.id);
  const { x, y } = th;
  ctx.save();
  // A platform, its pylons, a field glow.
  const halo = ctx.createRadialGradient(x, y, 8, x, y, 54);
  halo.addColorStop(0, `rgba(127,232,255,${0.28 * c})`);
  halo.addColorStop(1, 'rgba(127,232,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f3440';
  ctx.strokeStyle = `rgba(127,232,255,${0.45 + 0.4 * pulse * c})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + Math.PI / 6;
    const px = x + Math.cos(a) * 31;
    const py = y + Math.sin(a) * 31;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Three pylons that turn round the coil.
  const spin = t * (0.8 + 2.4 * (1 - c)) + th.id;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    const px = x + Math.cos(a) * 20;
    const py = y + Math.sin(a) * 20;
    ctx.fillStyle = '#35566a';
    ctx.strokeStyle = 'rgba(190,246,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The coil: the charging ring fills as it powers up, then holds.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = c < 1 ? GOLD : CYAN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c);
  ctx.stroke();
  const core = ctx.createRadialGradient(x, y, 1, x, y, 11);
  core.addColorStop(0, `rgba(255,255,255,${0.5 + 0.5 * c})`);
  core.addColorStop(1, `rgba(127,232,255,${0.3 + 0.5 * c})`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, 9 + 1.5 * pulse * c, 0, Math.PI * 2);
  ctx.fill();
  // Charging: sparks crackle off it.
  if (c < 1) {
    ctx.strokeStyle = `rgba(255,236,160,${0.9 * (1 - c)})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = t * 9 + i * 1.7;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
      ctx.lineTo(x + Math.cos(a + 0.2) * (24 + 10 * Math.sin(t * 30 + i)), y + Math.sin(a + 0.2) * (24 + 10 * Math.sin(t * 30 + i)));
      ctx.stroke();
    }
  }
  // Hurt: it arcs and smokes.
  const frac = th.hp / (th.maxHp ?? CITADEL.generator);
  if (frac < 0.7) {
    ctx.strokeStyle = 'rgba(190,246,255,0.8)';
    ctx.lineWidth = 2;
    const a = t * 13;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
    ctx.stroke();
    for (let k = 0; k < 2; k++) smoke(ctx, x + 10 + k * 6, y - 20 - ((t * 0.7 + k / 2) % 1) * 30, (t * 0.7 + k / 2) % 1, 7, 0.45);
  }
  ctx.restore();
  if (shots) pill(x, y - 52);
  else bar(x, y - 50, 60, th.hp / (th.maxHp ?? 10), CYAN);
}

// ---------------------------------------------------------------------------
// The keep

export function drawKeep(ctx: CanvasRenderingContext2D, g: Game, th: Threat, pill: (x: number, y: number) => void, bar: (x: number, y: number, w: number, frac: number, col: string) => void, text: (s: string, x: number, y: number, col: string, size: number) => void, shots: boolean): void {
  const t = g.t;
  const { x, y } = th;
  const shield = shieldUp(g);
  const b = built(g, th);
  const since = th.shotT === undefined ? 99 : t - th.shotT;
  const lit = g.fx.find((f) => f.kind === 'text' && f.text === 'GRAND SALVO');
  const charging = lit ? 1 - lit.age / lit.life : 0;
  const frac = th.hp / (th.maxHp ?? CITADEL.citadel);
  let hit = 0;
  for (const f of g.fx) if (f.kind === 'block' && Math.hypot(f.x - x, f.y - y) < 90) hit = Math.max(hit, 1 - f.age / f.life);
  ctx.save();
  ctx.translate(x, y);
  // The rock it stands on, and its shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(4, 10, 96, 76, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b3029';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const a = (i * Math.PI * 2) / 18;
    const r = 86 + (i % 3) * 4 + Math.sin(i * 2.7) * 3;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.9);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (b < 1) {
    // Rebuilding: the blueprint of the star, then the walls up out of it.
    ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.3 * Math.sin(t * 9)})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    star(ctx, R_OUT + 4, R_IN + 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // The reveal climbs from the foundation up.
    const front = 90 - b * 180;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-100, front, 200, 200);
    ctx.clip();
    keepBody(ctx, g, th, frac, shield, hit, 0, 0);
    ctx.restore();
    // Welding sparks at the front, a crane's gantry swinging over.
    ctx.fillStyle = 'rgba(255,240,170,0.95)';
    for (let i = 0; i < 9; i++) {
      const sx = Math.sin(t * 11 + i * 2.1) * 70;
      const sy = front + Math.sin(t * 23 + i) * 6;
      ctx.beginPath();
      ctx.arc(sx, sy, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-80, front);
    ctx.lineTo(80, front);
    ctx.stroke();
  } else {
    keepBody(ctx, g, th, frac, shield, hit, since, charging);
  }
  ctx.restore();
  if (b < 1) return;
  if (shots && !shield) pill(x, y - 100);
  else bar(x, y - 96, 120, frac, shield ? 'rgba(255,138,122,0.4)' : '#ff8a7a');
  text(shield ? 'SHIELDED · destroy the generators' : 'SHIELD DOWN', x, y - (shots && !shield ? 134 : 104), shield ? CYAN : GOLD, 18);
}

function star(ctx: CanvasRenderingContext2D, ro: number, ri: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? ri : ro;
    if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
}

/** The fort itself, centred on (0, 0): walls, bastions, the keep, its radar,
 *  the silo's iris and the eye. `since` is seconds since it last launched,
 *  `charging` how far its grand salvo's warning has run (0..1). */
function keepBody(ctx: CanvasRenderingContext2D, g: Game, th: Threat, frac: number, shield: boolean, hit: number, since: number, charging: number): void {
  const t = g.t;
  // The star's walls.
  const walls = ctx.createRadialGradient(0, -10, 8, 0, 0, R_OUT);
  walls.addColorStop(0, '#7b6154');
  walls.addColorStop(1, '#403029');
  ctx.fillStyle = walls;
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 4;
  star(ctx, R_OUT, R_IN);
  ctx.fill();
  ctx.stroke();
  // A lit top edge on each bastion, so the star reads raised.
  ctx.strokeStyle = 'rgba(255,214,190,0.28)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const a1 = a - 0.32;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a1) * R_IN, Math.sin(a1) * R_IN - 1);
    ctx.lineTo(Math.cos(a) * (R_OUT - 3), Math.sin(a) * (R_OUT - 3) - 1);
    ctx.stroke();
  }
  // Cannon ports on the bastions' tips: they flare when the keep fires.
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    const px = Math.cos(a) * (R_OUT - 14);
    const py = Math.sin(a) * (R_OUT - 14);
    ctx.fillStyle = '#231915';
    ctx.strokeStyle = 'rgba(217,74,58,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const flare = since < 0.5 ? 1 - since / 0.5 : 0;
    const warm = 0.25 + 0.5 * charging;
    const gl = Math.max(flare, warm * (0.6 + 0.4 * Math.sin(t * 14 + i)));
    if (gl > 0.05) {
      const pg = ctx.createRadialGradient(px, py, 1, px, py, 18);
      pg.addColorStop(0, `rgba(255,220,140,${gl})`);
      pg.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(px, py, 18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The curtain wall with its battlements.
  ctx.fillStyle = '#4e3b33';
  ctx.strokeStyle = 'rgba(217,74,58,0.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d221d';
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 36, Math.sin(a) * 36, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // The keep: an octagon, its roof, and the silo's iris at the heart.
  const keep = ctx.createLinearGradient(-26, -26, 26, 26);
  keep.addColorStop(0, '#94705f');
  keep.addColorStop(1, '#4a362e');
  ctx.fillStyle = keep;
  ctx.strokeStyle = '#d94a3a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const px = Math.cos(a) * 27;
    const py = Math.sin(a) * 27;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The iris: five petals that part for a launch (and a little for the lit
  // warning), a glow under them.
  const open = since < 1.3 ? Math.sin(Math.min(1, since / 0.35) * Math.PI * 0.5) * (since < 0.7 ? 1 : 1 - (since - 0.7) / 0.6) : 0;
  const iris = Math.max(open, charging * 0.5);
  const eye = 0.7 + 0.3 * Math.sin(t * 5);
  const hot = ctx.createRadialGradient(0, 0, 2, 0, 0, 22);
  hot.addColorStop(0, `rgba(255,${200 - 80 * iris},90,${0.9 * Math.max(eye * 0.8, iris)})`);
  hot.addColorStop(0.5, `rgba(255,70,40,${0.5 + 0.4 * iris})`);
  hot.addColorStop(1, 'rgba(255,40,20,0)');
  ctx.fillStyle = '#1d1411';
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  if (since < 0.7) {
    // The missiles' plume rising out of the open silo.
    ctx.fillStyle = `rgba(255,236,190,${0.8 * (1 - since / 0.7)})`;
    ctx.beginPath();
    ctx.arc(0, -since * 30, 8 * (1 - since / 1.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6d5247';
  ctx.strokeStyle = 'rgba(255,200,170,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 + t * 0.12 * 0 - Math.PI / 2 + iris * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (2 + iris * 12), Math.sin(a) * (2 + iris * 12));
    ctx.arc(0, 0, 17, a - 0.62, a + 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The eye over it all: it brightens as the grand salvo's lit, and contracts
  // to a point of white when it fires.
  const er = 6 + 3 * eye + 4 * charging - (since < 0.15 ? 4 : 0);
  ctx.fillStyle = `rgba(255,${120 + 100 * charging},${80 + 60 * charging},1)`;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(2, er * (1 - 0.35 * iris)), 0, Math.PI * 2);
  ctx.fill();
  // Particles drawn in to the keep as the salvo charges.
  if (charging > 0) {
    ctx.fillStyle = 'rgba(255,200,130,0.9)';
    for (let i = 0; i < 12; i++) {
      const u = (t * 1.8 + i / 12) % 1;
      const a = i * 0.9 + t * 0.5;
      const r = 80 * (1 - u);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 2.2 * (1 - u) + 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A turning radar on the roof.
  ctx.save();
  ctx.translate(-14, -14);
  ctx.rotate(t * 1.7);
  ctx.strokeStyle = '#d6c4b8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(8, 0);
  ctx.stroke();
  ctx.restore();
  // The shield over it: a cyan sheen while the dome stands, a flash on a hit.
  if (shield || hit > 0) {
    ctx.fillStyle = `rgba(127,232,255,${(shield ? 0.1 + 0.06 * Math.sin(t * 3) : 0) + 0.35 * hit})`;
    star(ctx, R_OUT + 2, R_IN + 2);
    ctx.fill();
  }
  // Damage: cracks glow, fires start, smoke goes up.
  if (frac < 0.66) {
    ctx.strokeStyle = `rgba(255,150,60,${0.5 + 0.3 * Math.sin(t * 7)})`;
    ctx.lineWidth = 2;
    const cracks: [number, number, number, number][] = [[-30, -20, -12, -6], [20, -34, 30, -12], [10, 24, 34, 40]];
    for (const [ax, ay, bx2, by2] of cracks.slice(0, frac < 0.33 ? 3 : 2)) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo((ax + bx2) / 2 + 4, (ay + by2) / 2 - 3);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
    }
    fire(ctx, 28, -30, t, 5, 1);
    if (frac < 0.33) fire(ctx, -34, 22, t, 6, 2);
    for (let k = 0; k < 3; k++) {
      const u = (k / 3 + t * 0.2) % 1;
      smoke(ctx, 30 + u * 40, -34 - u * 80, u, 12, frac < 0.33 ? 0.6 : 0.4);
    }
  }
}
