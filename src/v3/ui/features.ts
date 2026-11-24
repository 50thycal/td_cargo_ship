// Drawing for the 20-map plan's new things (docs/design/v3-maps-plan.md):
// enemy structures (rigs, shield generators, the Citadel, the Dreadnought),
// allied posts (the radar and the shore batteries), mines and fast boats,
// lock gates, the Delta's switch buoy, the tide, night and words on the map.
// Like render.ts it reads the game and mutates nothing.

import { THREATS, VIEW } from '../data/config';
import { FOE } from '../data/foes';
import { FORK_RADIUS, tideGauge, lockCountdown, reticleVisible, shieldUp, shotRigs, tracked, type Game, type Threat } from '../sim/game';
import { laneSamples } from '../sim/lanes';
import { flatsBand, seaEdges } from '../sim/tide';

const RED = '#ff5a3d';
const RIM = '#d94a3a';
const MINT = '#8fe0a2';
const GOLD = '#ffd166';
const CYAN = '#7fe8ff';

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 6);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, size = 20): void {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(7,13,18,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

// ---------------------------------------------------------------------------
// Under the convoy: tide flats, lock chambers, coves, chutes, wrecks. No
// static words on the water (player: the Kesh Hook needn't say "THE TURN").

export function drawMapUnder(ctx: CanvasRenderingContext2D, g: Game): void {
  const m = g.map;
  if (m.tide) drawTide(ctx, g);
  m.locks?.forEach((lock, i) => drawLock(ctx, g, i, lock.x0, lock.x1));
  m.bases.forEach((b, i) => {
    if (b.cove) drawCove(ctx, b.x, b.y);
    else if (b.chute) drawChute(ctx, b.x, b.y);
    else if ((b.rig || b.core) && g.baseDown[i]) drawWreck(ctx, b.x, b.y, b.core ? 1.6 : 1, g.t);
    else if (b.generator && g.baseDown[i]) drawWreck(ctx, b.x, b.y, 0.8, g.t);
  });
  if (m.shield && shieldUp(g)) {
    const pulse = 0.5 + 0.5 * Math.sin(g.t * 3);
    ctx.fillStyle = `rgba(127,232,255,${0.06 + 0.05 * pulse})`;
    ctx.strokeStyle = `rgba(127,232,255,${0.5 + 0.35 * pulse})`;
    ctx.lineWidth = 4;
    ctx.setLineDash([16, 10]);
    ctx.beginPath();
    ctx.arc(m.shield.x, m.shield.y, m.shield.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (m.fork) drawFork(ctx, g);
}

/** Tidewater Flats' sea (log v66; drawn over the water, under the shores
 *  and the lanes): the whole sea pulls back from both shores towards the
 *  deep channel's bed as the tide falls, and floods back in as it rises
 *  (sim/tide.ts seaEdges). What it leaves is wet sand, drying as it goes
 *  from the water's edge, ribbed by the ebb, with a line of foam that
 *  swashes a little on the sea's own slow beat. The carrier's berth dries
 *  with the rest. */
export function drawTideSea(ctx: CanvasRenderingContext2D, g: Game): void {
  const deep = g.map.channels.find((c) => !c.tide && !c.vip);
  if (!deep || !g.map.tide) return;
  const H = VIEW.height;
  const W = VIEW.width;
  const { level } = tideGauge(g);
  if (level >= 0.999) return;
  const { top, bottom } = seaEdges(deep, level, H);
  // The swash breathes in and out a little, slowly, and fades as the
  // tide reaches either end (it is the water's own motion, not the tide).
  const swash = 7 * Math.sin(g.t * 0.9) * Math.sin(Math.PI * Math.min(1, Math.max(0, level)));
  const wet = 70;
  // One dry stretch of seabed from `y0` (its far edge) to `y1` (the water's
  // edge); `dir` is 1 when the water is below it, -1 when above.
  const bed = (y0: number, y1: number, dir: 1 | -1) => {
    const lo = Math.min(y0, y1);
    const hi = Math.max(y0, y1);
    if (hi - lo < 0.5) return;
    const grad = ctx.createLinearGradient(0, y1, 0, y1 - dir * wet);
    // The wet strip by the water, then the dry sand beyond it.
    grad.addColorStop(0, 'rgb(112,102,82)');
    grad.addColorStop(0.55, 'rgb(158,143,105)');
    grad.addColorStop(1, 'rgb(190,171,126)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, lo, W, hi - lo);
    ctx.clip();
    ctx.fillStyle = 'rgb(190,171,126)';
    ctx.fillRect(0, lo, W, hi - lo);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y1 - wet, W, wet * 2);
    // Ribs the ebb left: long soft ripples along the shore.
    ctx.strokeStyle = 'rgba(96,78,48,0.22)';
    ctx.lineWidth = 2;
    for (let y = Math.floor(lo / 30) * 30 + 15; y < hi; y += 30) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 40) {
        const yy = y + 3 * Math.sin(x / 70 + y / 9);
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  };
  bed(0, top + swash, -1);
  bed(H, bottom + swash, 1);
  // The shallows beyond the edge and the foam on it.
  for (const [edge, dir] of [[top + swash, 1], [bottom + swash, -1]] as const) {
    if (edge < -10 || edge > H + 10) continue;
    const sh = ctx.createLinearGradient(0, edge, 0, edge + dir * 34);
    sh.addColorStop(0, 'rgba(176,232,226,0.5)');
    sh.addColorStop(1, 'rgba(176,232,226,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(0, Math.min(edge, edge + dir * 34), W, 34);
    ctx.strokeStyle = 'rgba(240,248,250,0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = edge + 3.5 * Math.sin(x / 55 + g.t * 1.3 + (dir > 0 ? 0 : 2));
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(240,248,250,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 20) {
      const y = edge + dir * 12 + 3 * Math.sin(x / 40 - g.t * 1.1);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** A hull aground on the flats (log v66): a bank of wet sand about it, so
 *  it reads as stuck until the tide is back. `k` is how afloat it is. */
export function drawAground(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, seed: number): void {
  if (k > 0.98) return;
  const a = 1 - k;
  ctx.save();
  ctx.translate(x, y + 6);
  ctx.fillStyle = `rgba(120,106,80,${0.75 * a})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 56, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(176,158,116,${0.7 * a})`;
  ctx.beginPath();
  ctx.ellipse(-4, -2, 44, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(238,246,250,${0.55 * a})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, 56 + 2 * Math.sin(seed), 17, 0, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawTide(ctx: CanvasRenderingContext2D, g: Game): void {
  const lane = g.map.channels.find((c) => c.tide);
  if (!lane) return;
  // The sea itself is drawn under the shores (drawTideSea); this is the
  // gauge between the lanes. Under the encounter layer the tide keeps each
  // wave's clock: one ebb a wave.
  const tide = tideGauge(g);
  const { phase, left, frac } = tide;
  const { top } = flatsBand(lane);
  // The gauge between the lanes, mid-map and large enough to read on a
  // phone held sideways (log v61: at the right edge, at 18 px, it was
  // clipped and about 8 px tall on an iPhone). Gold while the tide is about
  // to turn and while it goes out.
  const gx = 800;
  const gy = top - 16;
  const secs = Number.isFinite(left) ? ` · ${Math.ceil(left)} s` : '';
  const warn = (phase === 'high' && left <= 8) || phase === 'falling';
  const col = warn ? GOLD : phase === 'high' ? CYAN : '#ead7a4';
  bar(ctx, gx, gy, 260, frac, col);
  const text = phase === 'falling' ? `TIDE GOING OUT${secs}` : phase === 'low' ? `LOW TIDE · ships aground${secs}` : phase === 'rising' ? `TIDE COMING IN${secs}` : warn ? `THE TIDE TURNS${secs}` : `HIGH TIDE${secs}`;
  label(ctx, text, gx, gy - 10, col, warn ? 36 : 28);
}

function drawLock(ctx: CanvasRenderingContext2D, g: Game, i: number, x0: number, x1: number): void {
  const st = g.lockState[i];
  const ch = g.map.channels[0];
  const hw = 66;
  const y = ch.y;
  const filling = st.phase === 'fill';
  // The chamber's water rises while it fills.
  const k = filling ? st.t / (g.map.locks![i].wait || 1) : st.phase === 'out' ? 1 : 0;
  ctx.fillStyle = `rgba(127,200,255,${0.06 + 0.12 * k})`;
  ctx.fillRect(x0, y - hw - 10, x1 - x0, hw * 2 + 20);
  ctx.strokeStyle = 'rgba(255,209,102,0.55)';
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.strokeRect(x0, y - hw - 10, x1 - x0, hw * 2 + 20);
  ctx.setLineDash([]);
  const gate = (x: number, open: boolean) => {
    ctx.fillStyle = open ? 'rgba(255,209,102,0.25)' : GOLD;
    ctx.fillRect(x - 6, y - hw - 16, 12, open ? 22 : hw * 2 + 32);
    if (open) ctx.fillRect(x - 6, y + hw - 6, 12, 22);
    ctx.fillStyle = open ? '#4ade80' : '#ff5a5a';
    ctx.beginPath();
    ctx.arc(x, y - hw - 30, 9, 0, Math.PI * 2);
    ctx.fill();
  };
  gate(x0, st.phase === 'in');
  gate(x1, st.phase === 'out');
  const secs = Math.ceil(lockCountdown(g, i));
  const word = st.phase === 'in' ? `ENTER · ${secs}` : st.phase === 'fill' ? `FILLING · ${secs}` : `LEAVE`;
  label(ctx, word, (x0 + x1) / 2, y + hw + 40, filling ? GOLD : '#dfeef7', 20);
  if (filling) bar(ctx, (x0 + x1) / 2, y + hw + 48, x1 - x0 - 30, st.t / (g.map.locks![i].wait || 1), GOLD);
}

function drawFork(ctx: CanvasRenderingContext2D, g: Game): void {
  const f = g.map.fork!;
  const lane = g.map.channels[f.lanes[g.forkLane % f.lanes.length]];
  // An arrow down the branch the next ships will take.
  const pts = laneSamples(lane, 40).filter((s) => s.p.x > f.x + 20 && s.p.x < f.x + 300);
  if (pts.length > 1) {
    ctx.strokeStyle = 'rgba(255,209,102,0.85)';
    ctx.lineWidth = 6;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    pts.forEach((s, k) => (k ? ctx.lineTo(s.p.x, s.p.y) : ctx.moveTo(s.p.x, s.p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    const a = pts[pts.length - 1].p;
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(a.x + a.tx * 18, a.y + a.ty * 18);
    ctx.lineTo(a.x - a.ty * 11, a.y + a.tx * 11);
    ctx.lineTo(a.x + a.ty * 11, a.y - a.tx * 11);
    ctx.fill();
  }
  const bob = Math.sin(g.t * 2.4) * 3;
  ctx.fillStyle = GOLD;
  ctx.strokeStyle = '#3b2a00';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(f.x, f.y + bob, FORK_RADIUS - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, ['N', 'M', 'S'][g.forkLane] ?? '?', f.x, f.y + bob + 8, '#3b2a00', 24);
  label(ctx, 'TAP TO SWITCH', f.x, f.y + 52, GOLD, 16);
}

function drawCove(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#0d2b38';
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,61,0.6)';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawChute(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#4a3a30';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 22, y - 22);
  ctx.lineTo(x + 22, y - 22);
  ctx.lineTo(x + 14, y + 6);
  ctx.lineTo(x - 14, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawMineShape(ctx, x, y - 10, 0.7, 0);
}

function drawWreck(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, t: number): void {
  ctx.fillStyle = 'rgba(20,16,14,0.85)';
  ctx.beginPath();
  ctx.ellipse(x, y, 34 * k, 26 * k, 0.3, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const p = (t * 0.5 + i / 3) % 1;
    ctx.fillStyle = `rgba(90,90,90,${0.35 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(x - 8 + i * 8, y - 10 - p * 50 * k, (6 + p * 14) * k, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Allied posts: the radar tower and its sweep, the shore batteries

export function drawPosts(ctx: CanvasRenderingContext2D, g: Game): void {
  g.map.posts?.forEach((p, i) => {
    const st = g.posts[i];
    const up = !st.lost && st.downT <= 0;
    if (p.kind === 'radar') {
      if (up) {
        // The slowing field (log v29): an icy wash over the covered circle,
        // its edge, and a ring pulsing out from the tower every two
        // seconds, so the zone that slows the enemy reads at a glance.
        ctx.fillStyle = 'rgba(120,200,255,0.06)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.reach, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(140,215,255,0.45)';
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.reach, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        const pulse = (g.t / 2) % 1;
        ctx.strokeStyle = `rgba(140,215,255,${0.35 * (1 - pulse)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 30 + (p.reach - 30) * pulse, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 10; k++) {
          const a = st.aim - k * 0.06;
          ctx.fillStyle = `rgba(143,224,162,${0.22 * (1 - k / 10)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.arc(p.x, p.y, p.reach, a - 0.06, a);
          ctx.closePath();
          ctx.fill();
        }
      }
      // The tower: a mast and a dish.
      ctx.fillStyle = up ? '#15391f' : '#2a2421';
      ctx.strokeStyle = up ? MINT : '#6b5a50';
      ctx.lineWidth = 3;
      ctx.fillRect(p.x - 8, p.y - 40, 16, 40);
      ctx.strokeRect(p.x - 8, p.y - 40, 16, 40);
      if (up) {
        ctx.save();
        ctx.translate(p.x, p.y - 44);
        ctx.rotate(Math.sin(st.aim) * 0.6);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(-26, -6);
        ctx.quadraticCurveTo(0, 14, 26, -6);
        ctx.stroke();
        ctx.restore();
        bar(ctx, p.x, p.y + 12, 60, st.hp / p.hp, MINT);
      } else {
        drawWreck(ctx, p.x, p.y - 18, 0.7, g.t);
        label(ctx, 'RADAR LOST', p.x, p.y + 30, '#ff8a7a', 18);
      }
      return;
    }
    // A battery: a squat turret, its reach faintly ringed.
    ctx.strokeStyle = up ? 'rgba(143,224,162,0.18)' : 'rgba(255,138,122,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.reach, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = up ? '#15391f' : '#2a2421';
    ctx.strokeStyle = up ? MINT : '#6b5a50';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(st.aim) * 34, p.y + Math.sin(st.aim) * 34);
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (up) bar(ctx, p.x, p.y + 28, 44, st.hp / p.hp, MINT);
    else {
      drawWreck(ctx, p.x, p.y, 0.6, g.t);
      label(ctx, `BACK IN ${Math.ceil(st.downT)}`, p.x, p.y + 44, '#ff8a7a', 16);
    }
  });
}

/** Each threat the radar is slowing (log v29): an icy halo and a frosted
 *  trail of ghosts behind it, the lock box's corners kept in the same ice. */
export function drawTracked(ctx: CanvasRenderingContext2D, g: Game): void {
  if (!g.map.posts?.some((p) => p.kind === 'radar')) return;
  for (const th of g.threats) {
    if (th.dead || !tracked(g, th)) continue;
    // The trail: three fading ghosts back along its path.
    const v = Math.hypot(th.vx, th.vy);
    if (v > 1) {
      const ux = th.vx / v;
      const uy = th.vy / v;
      for (let k = 1; k <= 3; k++) {
        ctx.fillStyle = `rgba(150,220,255,${0.32 - k * 0.08})`;
        ctx.beginPath();
        ctx.arc(th.x - ux * k * 13, th.y - uy * k * 13, 9 - k * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = 'rgba(150,220,255,0.22)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(170,230,255,0.95)';
    ctx.lineWidth = 2;
    const r = 22;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(th.x + sx * r, th.y + sy * (r - 8));
      ctx.lineTo(th.x + sx * r, th.y + sy * r);
      ctx.lineTo(th.x + sx * (r - 8), th.y + sy * r);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Threats the plan adds

/** Draws the new kinds; false for a kind render.ts draws itself. */
export function drawNewThreat(ctx: CanvasRenderingContext2D, g: Game, th: Threat): boolean {
  switch (th.kind) {
    case 'mine': {
      // Log v55: a mine that has just surfaced bobs up out of the water,
      // ringed for a moment so the eye finds it in the ship's path.
      const up = th.surfacedT === undefined ? 1 : Math.min(1, (g.t - th.surfacedT) / 0.25);
      if (th.surfacedT !== undefined && g.t - th.surfacedT < 1.2) {
        const a = 1 - (g.t - th.surfacedT) / 1.2;
        ctx.strokeStyle = `rgba(255,90,90,${0.9 * a})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(th.x, th.y, 22 + 26 * (1 - a), 0, Math.PI * 2);
        ctx.stroke();
      }
      drawMineShape(ctx, th.x, th.y, 0.55 + 0.45 * up, g.t + th.phase);
      return true;
    }
    case 'fastboat':
      drawBoat(ctx, th);
      return true;
    case 'rig':
      drawRig(ctx, g, th, g.t);
      return true;
    case 'generator':
      drawGenerator(ctx, g, th, g.t);
      return true;
    case 'citadel':
      drawCitadel(ctx, g, th);
      return true;
    case 'dreadnought':
      drawDreadnought(ctx, th, g.t);
      return true;
    default:
      return false;
  }
}

function drawMineShape(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, t: number): void {
  ctx.strokeStyle = '#ffd6d6';
  ctx.lineWidth = 3 * k;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 11 * k, y + Math.sin(a) * 11 * k);
    ctx.lineTo(x + Math.cos(a) * 18 * k, y + Math.sin(a) * 18 * k);
    ctx.stroke();
  }
  ctx.fillStyle = '#2b1414';
  ctx.beginPath();
  ctx.arc(x, y, 12 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A blinking light: it is armed.
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff5a5a' : '#5a1b1b';
  ctx.beginPath();
  ctx.arc(x, y, 4 * k, 0, Math.PI * 2);
  ctx.fill();
}

function drawBoat(ctx: CanvasRenderingContext2D, th: Threat): void {
  const h = Math.atan2(th.vy, th.vx) || th.heading;
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(h);
  // The white wake: the warning.
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(-64, -18);
  ctx.lineTo(-64, 18);
  ctx.lineTo(-14, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a3f46';
  ctx.strokeStyle = '#ff8a7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -8);
  ctx.lineTo(10, -8);
  ctx.lineTo(22, 0);
  ctx.lineTo(10, 8);
  ctx.lineTo(-16, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9d2db';
  ctx.fillRect(-8, -4, 8, 8);
  // Log v53 (The Coves): a fire ship burns, its deck in flames and a ring
  // of fire round it the size of the fireball it leaves where it goes
  // down, so it reads as "sink it far out" on a phone.
  if (th.fire) {
    const t = th.age * 9;
    ctx.fillStyle = '#ff7a1a';
    for (let k = 0; k < 3; k++) {
      const fx = -10 + k * 9;
      const h = 14 + 5 * Math.sin(t + k * 2.1);
      ctx.beginPath();
      ctx.moveTo(fx - 5, 0);
      ctx.quadraticCurveTo(fx - 3, -h * 0.6, fx - 6, -h);
      ctx.quadraticCurveTo(fx + 4, -h * 0.5, fx + 5, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffd34a';
    ctx.beginPath();
    ctx.arc(-2, -2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (th.fire) {
    ctx.strokeStyle = 'rgba(255,122,26,0.55)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(th.x, th.y, FOE.cloud.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const full = th.maxHp ?? THREATS.fastboat.hp;
  if (th.hp < full) bar(ctx, th.x, th.y - 26, 30, th.hp / full, th.fire ? '#ff9a3a' : '#ff8a7a');
}

/** A tug for a relief rig's tow (round 15): a squat red hull with a white
 *  wheelhouse and a funnel, heading `dir` (+1: to the right), its bow wave
 *  and the churn of its screw drawn under it. */
function drawTug(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, t: number, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  const bob = Math.sin(t * 5.3 + x * 0.05) * 1.6;
  // The churn astern: foam boiling up and spreading behind the screw.
  for (let k = 0; k < 6; k++) {
    const age = (t * 1.6 + k / 6) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - age)})`;
    ctx.beginPath();
    ctx.ellipse(x - dir * (34 + age * 46), y + bob + Math.sin(k * 2.1 + t * 7) * 5 * age, 5 + age * 9, 3 + age * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The bow wave: a white V off the stem.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + dir * 40, y + bob);
  ctx.quadraticCurveTo(x + dir * 24, y + bob - 20, x - dir * 4, y + bob - 28);
  ctx.moveTo(x + dir * 40, y + bob);
  ctx.quadraticCurveTo(x + dir * 24, y + bob + 20, x - dir * 4, y + bob + 28);
  ctx.stroke();
  ctx.translate(x, y + bob);
  // A little over life size, so it reads at a phone's scale.
  ctx.scale(dir * 1.3, 1.3);
  // Hull: a round-bowed tug, fendered.
  ctx.fillStyle = '#b83a2c';
  ctx.strokeStyle = '#1d1d22';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-24, -11);
  ctx.lineTo(14, -11);
  ctx.quadraticCurveTo(32, -10, 32, 0);
  ctx.quadraticCurveTo(32, 10, 14, 11);
  ctx.lineTo(-24, 11);
  ctx.quadraticCurveTo(-28, 0, -24, -11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, -11);
  ctx.lineTo(14, -11);
  ctx.quadraticCurveTo(32, -10, 32, 0);
  ctx.stroke();
  // Wheelhouse and funnel.
  ctx.fillStyle = '#f2efe8';
  ctx.strokeStyle = '#1d1d22';
  ctx.lineWidth = 1.5;
  ctx.fillRect(-4, -7, 16, 14);
  ctx.strokeRect(-4, -7, 16, 14);
  ctx.fillStyle = '#7fd0ff';
  ctx.fillRect(8, -5, 3, 10);
  ctx.fillStyle = '#222';
  ctx.fillRect(-14, -5, 7, 10);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(-14, -5, 7, 3);
  // The tow hook astern.
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(-22, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Smoke from the funnel, drifting astern.
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let k = 0; k < 4; k++) {
    const age = (t * 0.9 + k / 4) % 1;
    ctx.fillStyle = `rgba(60,60,66,${0.45 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(x - dir * (10 + age * 40), y + bob - 6 - age * 18, 4 + age * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Seconds a relief rig takes to settle on its station after docking (the
 *  splash, the dip and the last of the rocking), and for its tug to cast
 *  off and steam away. */
const DOCK_SETTLE = 1.6;
const TUG_LEAVE = 2.6;

/** A rig's legs, deck, derrick and flare stack at (0, 0), drawn in place. */
function rigBody(ctx: CanvasRenderingContext2D, x: number, t: number): void {
  ctx.strokeStyle = '#6b5a50';
  ctx.lineWidth = 5;
  for (const dx of [-26, 26]) {
    ctx.beginPath();
    ctx.moveTo(dx, 8);
    ctx.lineTo(dx * 1.15, 34);
    ctx.stroke();
  }
  ctx.fillStyle = '#4a3a33';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.fillRect(-36, -10, 72, 22);
  ctx.strokeRect(-36, -10, 72, 22);
  ctx.strokeStyle = '#9a8678';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.lineTo(-4, -46);
  ctx.lineTo(6, -10);
  ctx.moveTo(-11, -24);
  ctx.lineTo(3, -24);
  ctx.stroke();
  const flick = 0.6 + 0.4 * Math.sin(t * 13 + x);
  ctx.fillStyle = `rgba(255,150,40,${flick})`;
  ctx.beginPath();
  ctx.arc(26, -26, 6 + 3 * flick, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(18, 1, 6, 0, Math.PI * 2);
  ctx.fill();
}

/** How much a rig still takes, over it (round 15): on a map whose rigs
 *  count shots (SHOT_RIGS), the shots left as a number in a pill, with a
 *  pip a shot for a small count, or a bar; elsewhere the plain bar. */
function rigCount(ctx: CanvasRenderingContext2D, g: Game, th: Threat, x: number, y: number): void {
  const full = th.maxHp ?? (THREATS.rig.hp || 1);
  if (!shotRigs(g)) {
    bar(ctx, x, y, 70, th.hp / full, '#ff8a7a');
    return;
  }
  const left = Math.max(0, Math.ceil(th.hp - 1e-6));
  const text = String(left);
  ctx.font = '900 26px system-ui, sans-serif';
  const tw = ctx.measureText(text).width;
  const w = Math.max(84, tw + 52);
  ctx.fillStyle = 'rgba(7,13,18,0.86)';
  ctx.strokeStyle = '#ff8a7a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 26, w, 40, 10);
  ctx.fill();
  ctx.stroke();
  // A crosshair: what the number counts is shots.
  const cx = x - w / 2 + 17;
  const cy = y - 6;
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx - 4, cy);
  ctx.moveTo(cx + 4, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy - 4);
  ctx.moveTo(cx, cy + 4);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(text, x + 12, y - 5);
  ctx.textBaseline = 'alphabetic';
  // Pips for a count a glance can take in; a bar for a big one.
  const pipsY = y + 20;
  if (full <= 14) {
    const n = Math.round(full);
    const gap = 3;
    const pw = Math.min(10, (w - gap * (n - 1)) / n);
    const total = n * pw + (n - 1) * gap;
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = k < left ? '#ff8a7a' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - total / 2 + k * (pw + gap), pipsY, pw, 7);
    }
  } else bar(ctx, x, pipsY, w - 8, th.hp / full, '#ff8a7a');
}

function drawRig(ctx: CanvasRenderingContext2D, g: Game, th: Threat, t: number): void {
  const { x, y } = th;
  let rock = 0;
  let dip = 0;
  // Log v49 (The Rig Field): a relief rig on its tow. Round 15 ("the
  // bringing in of the oil rig was hilarious, keep that and improve that
  // animation a lot"): a tug out ahead on a sagging tow line, its bow wave
  // and churn; the rig rolling a little on its legs, pushing a bow wave
  // and leaving a wake; the tug easing off to one side and the line going
  // slack as the rig reaches its station.
  if (th.tow !== undefined) {
    const dir = th.vx < 0 ? -1 : 1;
    const b = g.map.bases[th.tow];
    const togo = b ? Math.abs(b.x - x) : 999;
    const ease = Math.max(0, Math.min(1, 1 - togo / 110));
    rock = Math.sin(t * 2.3 + x * 0.02) * 0.05 + Math.sin(t * 3.7) * 0.015;
    // The rig's own wake: two white arms trailing back from its legs, and
    // foam where its legs push the water.
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - dir * 30, y + 30);
    ctx.quadraticCurveTo(x - dir * 90, y + 22, x - dir * 150, y + 6);
    ctx.moveTo(x - dir * 30, y + 40);
    ctx.quadraticCurveTo(x - dir * 90, y + 48, x - dir * 150, y + 62);
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const age = (t * 1.2 + k / 5) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - age)})`;
      ctx.beginPath();
      ctx.ellipse(x - dir * (34 + age * 100), y + 35 + Math.sin(k * 1.7) * 8 * age, 6 + age * 10, 3 + age * 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const dx of [-30, 30]) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x + dx + dir * 4, y + 36, 9 + Math.sin(t * 6 + dx) * 2, dir > 0 ? -1.2 : Math.PI - 1.2, dir > 0 ? 1.2 : Math.PI + 1.2);
      ctx.stroke();
    }
    // The tug: out ahead, easing off to the near side as the rig comes in.
    const tx = x + dir * (118 - 20 * ease);
    const ty = y + 22 - 34 * ease;
    // The tow line from the rig's deck to the tug's hook, sagging into
    // the water as it slackens at the end.
    const ax = x + dir * 36;
    const ay = y + 6;
    const hx = tx - dir * 29;
    const hy = ty;
    const sag = 6 + 22 * ease + Math.sin(t * 3.1) * 2;
    ctx.strokeStyle = 'rgba(20,20,24,0.55)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ax, ay + 2);
    ctx.quadraticCurveTo((ax + hx) / 2, (ay + hy) / 2 + sag + 2, hx, hy + 2);
    ctx.stroke();
    ctx.strokeStyle = '#f0e2c8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + hx) / 2, (ay + hy) / 2 + sag, hx, hy);
    ctx.stroke();
    drawTug(ctx, tx, ty, dir, t);
  } else if (th.dockT !== undefined && g.t - th.dockT < TUG_LEAVE) {
    // Round 15: docked. A splash ring spreads round its legs, it dips and
    // settles with a last rock, and its tug casts off and steams away.
    const a = g.t - th.dockT;
    const dir = th.towDir ?? 1;
    if (a < DOCK_SETTLE) {
      const k = a / DOCK_SETTLE;
      dip = Math.sin(k * Math.PI) * 9 * (1 - k * 0.5);
      rock = Math.sin(a * 9) * 0.07 * (1 - k);
      for (let r = 0; r < 2; r++) {
        const kk = Math.min(1, k * 1.4 - r * 0.25);
        if (kk <= 0) continue;
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - kk)})`;
        ctx.lineWidth = 4 - r;
        ctx.beginPath();
        ctx.ellipse(x, y + 36, 40 + 70 * kk, 12 + 20 * kk, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Spray thrown up off the legs.
      for (let i = 0; i < 8; i++) {
        const ang = -Math.PI / 2 + (i - 3.5) * 0.32;
        const d = 12 + 60 * k;
        ctx.fillStyle = `rgba(220,240,255,${0.75 * (1 - k)})`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * d * 1.2, y + 34 + Math.sin(ang) * d * 0.9 + 40 * k * k, 4 * (1 - k) + 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const lx = x + dir * (98 + 140 * (a / TUG_LEAVE) ** 1.4);
    const ly = y - 12 - 24 * (a / TUG_LEAVE);
    drawTug(ctx, lx, ly, dir, t, Math.max(0, 1 - Math.max(0, a - TUG_LEAVE + 0.8) / 0.8));
  }
  // The legs' feet in the water.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  for (const dx of [-30, 30]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y + 36, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y + dip);
  ctx.rotate(rock);
  rigBody(ctx, x, t);
  ctx.restore();
  rigCount(ctx, g, th, x, y - 66);
}

function drawGenerator(ctx: CanvasRenderingContext2D, g: Game, th: Threat, t: number): void {
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  ctx.fillStyle = '#203a46';
  ctx.strokeStyle = `rgba(127,232,255,${0.6 + 0.4 * pulse})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = th.x + Math.cos(a) * 30;
    const py = th.y + Math.sin(a) * 30;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  label(ctx, '⚡', th.x, th.y + 9, CYAN, 26);
  // Log v60 (The Citadel, counting shots): the shots left in a pill.
  if (shotRigs(g)) rigCount(ctx, g, th, th.x, th.y - 52);
  else bar(ctx, th.x, th.y - 50, 60, th.hp / THREATS.generator.hp, CYAN);
}

function drawCitadel(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const { x, y } = th;
  const shield = shieldUp(g);
  // A star fort: walls, bastions and a keep with its battery.
  ctx.fillStyle = '#4a3a33';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 ? 46 : 74;
    if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2d221d';
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  if (shotRigs(g) && !shield) rigCount(ctx, g, th, x, y - 100);
  else bar(ctx, x, y - 96, 120, th.hp / (th.maxHp ?? THREATS.citadel.hp), shield ? 'rgba(255,138,122,0.4)' : '#ff8a7a');
  label(ctx, shield ? 'SHIELDED · destroy the generators' : 'SHIELD DOWN', x, y - (shotRigs(g) && !shield ? 134 : 104), shield ? CYAN : GOLD, 18);
}

function drawDreadnought(ctx: CanvasRenderingContext2D, th: Threat, t: number): void {
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.rotate(th.heading);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.moveTo(-120, -20);
  ctx.lineTo(-210, -40);
  ctx.lineTo(-210, 40);
  ctx.lineTo(-120, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#4a2e28';
  ctx.strokeStyle = '#ff7d62';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-124, -26);
  ctx.lineTo(96, -26);
  ctx.lineTo(136, 0);
  ctx.lineTo(96, 26);
  ctx.lineTo(-124, 26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4a40';
  ctx.fillRect(-30, -14, 44, 28);
  for (const dx of [-80, -10, 60]) {
    ctx.fillStyle = '#2d1c18';
    ctx.beginPath();
    ctx.arc(dx, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff7d62';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(dx, 0);
    ctx.lineTo(dx + 6, 30 + Math.sin(t * 2 + dx) * 2);
    ctx.stroke();
  }
  ctx.restore();
  bar(ctx, th.x, th.y - 52, 160, th.hp / (th.maxHp ?? THREATS.dreadnought.hp), '#ff8a7a');
  label(ctx, 'DREADNOUGHT', th.x, th.y - 60, '#ffb2a3', 18);
}

// ---------------------------------------------------------------------------
// Night

/** The Black Strait: darkness over the sea, cut by the lighthouse beam, the
 *  carrier's lamp, launch flashes and a Star Shell's light. Threats outside
 *  the light are redrawn on top as a faint glow (still tappable), and a
 *  ballistic's landing circle always shows: every threat keeps a warning. */
let dark: HTMLCanvasElement | null = null;

export function drawNight(ctx: CanvasRenderingContext2D, g: Game, drawReticle: (th: Threat) => void, drawMarks?: () => void): void {
  const n = g.map.night;
  // Blackout (a special event): night for its length, with no lighthouse.
  if (!n && !nightEvent(g)) return;
  const flare = g.flareT > 0 ? Math.min(1, g.flareT / 1) : 0;
  const alpha = 0.78 * (1 - flare);
  if (alpha <= 0.02) return;
  if (!dark) dark = document.createElement('canvas');
  if (dark.width !== 1600) {
    dark.width = 1600;
    dark.height = 900;
  }
  const d = dark.getContext('2d')!;
  d.globalCompositeOperation = 'source-over';
  d.clearRect(0, 0, 1600, 900);
  d.fillStyle = `rgba(2,8,16,${alpha})`;
  d.fillRect(0, 0, 1600, 900);
  d.globalCompositeOperation = 'destination-out';
  const hole = (x: number, y: number, r: number, k = 1) => {
    const grad = d.createRadialGradient(x, y, r * 0.2, x, y, r);
    grad.addColorStop(0, `rgba(0,0,0,${k})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = grad;
    d.beginPath();
    d.arc(x, y, r, 0, Math.PI * 2);
    d.fill();
  };
  // The lighthouse beam.
  const beam = n ? beamAngle(g) : 0;
  const w = n ? (n.width * Math.PI) / 180 : 0;
  if (n) {
    const grad = d.createRadialGradient(n.light.x, n.light.y, 10, n.light.x, n.light.y, n.reach);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    d.fillStyle = grad;
    d.beginPath();
    d.moveTo(n.light.x, n.light.y);
    d.arc(n.light.x, n.light.y, n.reach, beam - w / 2, beam + w / 2);
    d.closePath();
    d.fill();
    hole(n.light.x, n.light.y, 70);
  }
  hole(g.map.carrier.x, g.map.carrier.y, 230);
  for (const f of g.fx) if (f.kind === 'launch' || f.kind === 'boom' || f.kind === 'burst') hole(f.x, f.y, 90 + f.r * 2, 1 - f.age / f.life);
  for (const s of g.ships) hole(s.x, s.y, 46, 0.5);
  ctx.drawImage(dark, 0, 0);
  // The beam itself, a pale cone.
  if (n) {
    ctx.fillStyle = 'rgba(255,243,196,0.07)';
    ctx.beginPath();
    ctx.moveTo(n.light.x, n.light.y);
    ctx.arc(n.light.x, n.light.y, n.reach, beam - w / 2, beam + w / 2);
    ctx.closePath();
    ctx.fill();
  }
  // Threats in the dark: a faint glow where their engine is.
  for (const th of g.threats) {
    if (th.dead || lit(g, th.x, th.y)) continue;
    ctx.fillStyle = 'rgba(255,170,90,0.45)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,170,90,0.12)';
    ctx.beginPath();
    ctx.arc(th.x, th.y, 14, 0, Math.PI * 2);
    ctx.fill();
    if (th.kind === 'ballistic' && reticleVisible(g, th)) drawReticle(th);
  }
  // Log v52: a siege battery's and a dive bomber's circles on top of the
  // dark too (their shells and bombs can't be shot down: the circle is the
  // whole warning).
  drawMarks?.();
}

/** A special event's night (Blackout). */
export function nightEvent(g: Game): boolean {
  return !!g.event?.rules.includes('night');
}

/** Where the lighthouse beam points now (radians). */
export function beamAngle(g: Game): number {
  const n = g.map.night!;
  const k = (g.t % n.period) / n.period;
  // Sweeps one way and back.
  const u = k < 0.5 ? k * 2 : 2 - k * 2;
  return ((n.a0 + (n.a1 - n.a0) * u) * Math.PI) / 180;
}

/** Is (x, y) in light right now? */
export function lit(g: Game, x: number, y: number): boolean {
  const n = g.map.night;
  if ((!n && !nightEvent(g)) || g.flareT > 0) return true;
  const c = g.map.carrier;
  if (Math.hypot(x - c.x, y - c.y) < 200) return true;
  if (!n) return false;
  const a = Math.atan2(y - n.light.y, x - n.light.x);
  let diff = a - beamAngle(g);
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) < ((n.width / 2) * Math.PI) / 180 && Math.hypot(x - n.light.x, y - n.light.y) < n.reach;
}

