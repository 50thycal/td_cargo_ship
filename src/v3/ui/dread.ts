// The Dreadnought (Dreadnought Pass's battleship) and its gun turrets.
// Draws only; reads the game and mutates nothing.
//
// Log v67 (the player: "the ship is lame ... improve the look and animation"):
// a real battleship's silhouette from above (a long hull with a flared bow
// and a squared stern, a bow wave and a wake, a conning tower with a turning
// radar and two funnels smoking aft, two turrets forward and one aft on
// their barbettes, a silo aft with hatches that open before a launch), and
// guns that train on the convoy, fire with a muzzle flash and a smoke puff
// and slide back on recoil. A turret shot out leaves a burning wreck on its
// ring. The local frame is the hull's: the bow is +x, the beam y.

import { THREATS, TURRET } from '../data/config';
import { shotRigs, type Game, type Threat } from '../sim/game';

const RIM = '#ff7d62';
const HALF = TURRET.len / 2;
const BEAM = TURRET.beam / 2;

function lab(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, col: string, size: number): void {
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(7,13,18,0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = col;
  ctx.fillText(text, x, y);
}

function hbar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, frac: number, col: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - w / 2 - 2, y - 2, w + 4, 10);
  ctx.fillStyle = col;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, frac)), 6);
}

/** A puff of smoke that drifts and grows. */
function smoke(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, r: number, a: number): void {
  ctx.fillStyle = `rgba(60,56,56,${a * (1 - k)})`;
  ctx.beginPath();
  ctx.arc(x, y, r * (0.5 + k), 0, Math.PI * 2);
  ctx.fill();
}

/** How far the silo's hatches are open (0 shut .. 1 open): they open over the
 *  `TURRET.hatch` s before a launch and close again after it. */
export function hatchOpen(g: Game, th: Threat): number {
  const left = th.fireT ?? 99;
  if (left > 0 && left < TURRET.hatch) return 1 - left / TURRET.hatch;
  const since = th.shotT === undefined ? 99 : g.t - th.shotT;
  if (since < 0.5) return 1;
  if (since < 1.1) return 1 - (since - 0.5) / 0.6;
  return 0;
}

/** The hull's outline in its own frame (bow +x), as the live ship and the
 *  sinking wreck (ui/sinking.ts) both draw it. */
export function hullPath(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(-HALF, -BEAM * 0.78);
  ctx.lineTo(-HALF + 16, -BEAM);
  ctx.lineTo(HALF - 96, -BEAM);
  ctx.quadraticCurveTo(HALF - 36, -BEAM, HALF, 0);
  ctx.quadraticCurveTo(HALF - 36, BEAM, HALF - 96, BEAM);
  ctx.lineTo(-HALF + 16, BEAM);
  ctx.lineTo(-HALF, BEAM * 0.78);
  ctx.closePath();
}

export function drawDreadnought(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const t = g.t;
  const face = Math.cos(th.heading) >= 0 ? 1 : -1;
  const hp = th.hp / (th.maxHp ?? THREATS.dreadnought.hp);
  // Which turrets still stand (the campaign's battleship has none of its own
  // and shows its guns, idle).
  const turrets = g.threats.filter((o) => o.kind === 'turret' && o.from === th.id && !o.dead);
  const armed = !!th.dread;
  const down = (slot: number) => armed && !turrets.some((o) => o.slot === slot);
  ctx.save();
  ctx.translate(th.x, th.y);
  ctx.scale(face, 1);
  ctx.rotate(face > 0 ? th.heading : Math.PI - th.heading);

  // ---- The wake and the bow wave ----
  ctx.save();
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    for (let j = 0; j < 7; j++) {
      const u = (j + ((t * 0.7) % 1)) / 7;
      const x = -HALF + 6 - u * 250;
      const y = side * (BEAM * 0.7 + u * 46);
      ctx.fillStyle = `rgba(220,240,250,${0.34 * (1 - u)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 20 * (1 - u * 0.4), 3.6, side * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const churn = ctx.createLinearGradient(-HALF, 0, -HALF - 220, 0);
  churn.addColorStop(0, 'rgba(235,248,255,0.36)');
  churn.addColorStop(1, 'rgba(235,248,255,0)');
  ctx.fillStyle = churn;
  ctx.beginPath();
  ctx.moveTo(-HALF + 4, -BEAM * 0.55);
  ctx.lineTo(-HALF - 220, -BEAM * 0.9);
  ctx.lineTo(-HALF - 220, BEAM * 0.9);
  ctx.lineTo(-HALF + 4, BEAM * 0.55);
  ctx.closePath();
  ctx.fill();
  // The bow wave, two white arcs pushed aside.
  ctx.strokeStyle = 'rgba(240,250,255,0.55)';
  ctx.lineWidth = 3;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(HALF + 6, 0);
    ctx.quadraticCurveTo(HALF - 22, side * (BEAM + 8 + Math.sin(t * 3 + side) * 1.5), HALF - 70, side * (BEAM + 6));
    ctx.stroke();
  }
  ctx.restore();

  // ---- The hull ----
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 6, HALF + 6, BEAM + 6, 0, 0, Math.PI * 2);
  ctx.fill();
  const hull = () => hullPath(ctx);
  const steel = ctx.createLinearGradient(0, -BEAM, 0, BEAM);
  steel.addColorStop(0, '#4a3531');
  steel.addColorStop(0.5, '#68514b');
  steel.addColorStop(1, '#3e2b28');
  ctx.fillStyle = steel;
  hull();
  ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 4;
  ctx.stroke();
  // The deck: an inset, lighter, with plating lines.
  ctx.save();
  ctx.scale(0.93, 0.8);
  hull();
  ctx.fillStyle = '#7d6a64';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,26,23,0.35)';
  ctx.lineWidth = 1.5;
  for (let x = -HALF + 30; x < HALF - 40; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, -BEAM * 0.72);
    ctx.lineTo(x, BEAM * 0.72);
    ctx.stroke();
  }
  // The pennant stripe down the middle of the forecastle.
  ctx.fillStyle = 'rgba(255,125,98,0.4)';
  ctx.fillRect(HALF - 120, -1.5, 100, 3);

  // ---- Turret rings (a wreck on those shot out) ----
  TURRET.slots.forEach((x, i) => {
    ctx.fillStyle = '#2f2320';
    ctx.strokeStyle = 'rgba(255,125,98,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (down(i)) {
      // The wreck: a twisted ring, a fire in it, smoke drifting aft.
      ctx.fillStyle = '#1a1210';
      ctx.beginPath();
      ctx.arc(x, 0, 15, 0, Math.PI * 2);
      ctx.fill();
      const f = 0.6 + 0.4 * Math.sin(t * 11 + i * 2);
      ctx.fillStyle = `rgba(255,140,50,${0.7 * f})`;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t * 7 + i) * 2, 0, 8 * f + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,220,120,${0.7 * f})`;
      ctx.beginPath();
      ctx.arc(x, 0, 4 * f, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const u = (k / 3 + t * 0.35) % 1;
        smoke(ctx, x - u * 50, Math.sin(u * 5 + i) * 6, u, 8, 0.45);
      }
    }
  });

  // ---- Secondary guns, along the deck edges ----
  ctx.fillStyle = '#35261f';
  for (const x of [28, -24, -96]) {
    for (const y of [-BEAM * 0.62, BEAM * 0.62]) {
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---- The silo aft: a bank of cells under two hatch lids ----
  const open = hatchOpen(g, th);
  const sx = TURRET.silo;
  ctx.fillStyle = '#241a17';
  ctx.strokeStyle = 'rgba(255,200,90,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(sx - 24, -19, 48, 38, 4);
  ctx.fill();
  ctx.stroke();
  if (open > 0) {
    // The cells light as the lids part; a missile's nose rises out of the
    // middle one for the launch.
    const glow = ctx.createRadialGradient(sx, 0, 2, sx, 0, 34);
    glow.addColorStop(0, `rgba(255,190,80,${0.95 * open})`);
    glow.addColorStop(1, `rgba(255,90,40,${0.2 * open})`);
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 22, -17, 44, 34);
    ctx.fillStyle = `rgba(40,20,14,${0.7 * open})`;
    for (const cy of [-9, 9]) for (const cx of [-12, 0, 12]) ctx.fillRect(sx + cx - 4, cy - 4, 8, 8);
    const since = th.shotT === undefined ? 99 : t - th.shotT;
    if (since >= 0 && since < 0.7) {
      const rise = since / 0.7;
      ctx.fillStyle = `rgba(250,246,236,${1 - rise * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(sx + 4 + rise * 24, 0);
      ctx.lineTo(sx - 6 + rise * 24, -4);
      ctx.lineTo(sx - 6 + rise * 24, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,170,${0.9 * (1 - rise)})`;
      ctx.beginPath();
      ctx.arc(sx - 8 + rise * 24, 0, 8 * (1 - rise * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The hatch lids slide apart across the beam.
  ctx.fillStyle = '#5a4640';
  ctx.strokeStyle = 'rgba(255,200,90,0.9)';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const y0 = side < 0 ? -19 - open * 15 : open * 15;
    ctx.beginPath();
    ctx.rect(sx - 24, y0, 48, 19);
    ctx.fill();
    ctx.stroke();
  }
  // Hazard marks on the lids.
  ctx.strokeStyle = 'rgba(255,200,90,0.5)';
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    for (const side of [-1, 1]) {
      const y0 = side < 0 ? -19 - open * 15 : open * 15;
      ctx.beginPath();
      ctx.moveTo(sx - 20 + k * 11, y0 + 3);
      ctx.lineTo(sx - 14 + k * 11, y0 + 16);
      ctx.stroke();
    }
  }
  // A warning lamp blinks as the lids start to part.
  if (open > 0 && open < 1) {
    ctx.fillStyle = `rgba(255,90,60,${0.5 + 0.5 * Math.sin(t * 24)})`;
    ctx.beginPath();
    ctx.arc(sx + 30, -22, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- The conning tower, radar and funnels ----
  const bx = -8;
  ctx.fillStyle = '#58443f';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bx - 26, -15, 52, 30, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#74605a';
  ctx.beginPath();
  ctx.roundRect(bx - 12, -10, 28, 20, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,200,120,0.7)';
  ctx.fillRect(bx + 10, -6, 5, 12);
  // Two funnels aft of it, smoking.
  for (const fy of [-9, 9]) {
    ctx.fillStyle = '#2a1e1b';
    ctx.strokeStyle = 'rgba(255,125,98,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bx - 38, fy, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const u = (k / 4 + t * 0.28 + (fy > 0 ? 0.13 : 0)) % 1;
      smoke(ctx, bx - 40 - u * 80, fy * (1 + u * 0.7) + Math.sin(u * 6 + k) * 3, u, 7, 0.5);
    }
  }
  // The radar dish turns on the mast.
  ctx.save();
  ctx.translate(bx + 2, 0);
  ctx.rotate(t * 2.4);
  ctx.strokeStyle = '#d8c9c0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(13, 0);
  ctx.stroke();
  ctx.fillStyle = '#d8c9c0';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ---- A hull that is hurt burns ----
  if (hp < 0.66) {
    for (const [x, y, ph] of [[HALF - 40, 12, 0], [-HALF + 44, -14, 2]] as const) {
      const f = 0.6 + 0.4 * Math.sin(t * 9 + ph);
      ctx.fillStyle = `rgba(255,150,60,${0.55 * f})`;
      ctx.beginPath();
      ctx.arc(x, y, 6 * f + 3, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 3; k++) {
        const u = (k / 3 + t * 0.4 + ph) % 1;
        smoke(ctx, x - u * 40, y + Math.sin(u * 4 + ph) * 5, u, 7, hp < 0.33 ? 0.6 : 0.4);
      }
    }
  }
  ctx.restore();
  hbar(ctx, th.x, th.y - 62, 170, hp, '#ff8a7a');
  // Log v74: it counts shots (as the Rig Field's rigs): the number left.
  const left = Math.max(0, Math.ceil(th.hp - 1e-6));
  lab(ctx, shotRigs(g) ? `DREADNOUGHT · ${left}` : 'DREADNOUGHT', th.x, th.y - 70, '#ffb2a3', 18);

  // The campaign's battleship has no turrets of its own: its three guns sit
  // idle on their rings, pointing ahead.
  if (!armed) {
    for (let i = 0; i < TURRET.slots.length; i++) {
      gun(ctx, g, th.x + Math.cos(th.heading) * TURRET.slots[i], th.y + Math.sin(th.heading) * TURRET.slots[i], th.heading, TURRET.hp, TURRET.hp, undefined, 99, i);
    }
  }
}

/** One gun house on its ring at (x, y), its barrels pointing at `rot`. A
 *  shot sets `shotT`: the barrels slide back and a flash and a puff leave the
 *  muzzles; in the last second before a shot the muzzles glow. */
function gun(ctx: CanvasRenderingContext2D, g: Game, x: number, y: number, rot: number, hp: number, max: number, shotT: number | undefined, fireIn: number, seed: number): void {
  const t = g.t;
  const since = shotT === undefined ? 99 : t - shotT;
  const recoil = since < 0.9 ? 15 * Math.exp(-since * 7) * (since > 0 ? 1 : 0) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // The barrels, sliding back on the recoil.
  ctx.fillStyle = '#2b201d';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 2;
  for (const by of [-6.5, 6.5]) {
    ctx.beginPath();
    ctx.rect(8 - recoil, by - 3, 40, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2c28';
    ctx.fillRect(44 - recoil, by - 4, 6, 8);
    ctx.fillStyle = '#2b201d';
  }
  // The gun house: a rounded, bevelled shield.
  ctx.fillStyle = '#6a4f48';
  ctx.strokeStyle = RIM;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -15);
  ctx.lineTo(8, -17);
  ctx.lineTo(18, -9);
  ctx.lineTo(18, 9);
  ctx.lineTo(8, 17);
  ctx.lineTo(-18, 15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#86675e';
  ctx.beginPath();
  ctx.moveTo(-12, -9);
  ctx.lineTo(6, -10);
  ctx.lineTo(11, -4);
  ctx.lineTo(11, 4);
  ctx.lineTo(6, 10);
  ctx.lineTo(-12, 9);
  ctx.closePath();
  ctx.fill();
  // Muzzles charge before a shot.
  if (fireIn < 1 && fireIn > 0) {
    const c = 1 - fireIn;
    const p = 0.5 + 0.5 * Math.sin(t * (14 + c * 20) + seed);
    ctx.fillStyle = `rgba(255,${150 + 80 * c},70,${(0.3 + 0.6 * c) * (0.5 + 0.5 * p)})`;
    for (const by of [-6.5, 6.5]) {
      ctx.beginPath();
      ctx.arc(50 - recoil, by, 3 + 4 * c, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The flash and the puff.
  if (since >= 0 && since < 0.22) {
    const k = since / 0.22;
    const fl = ctx.createRadialGradient(54, 0, 2, 54, 0, 46 * (1 - k * 0.3));
    fl.addColorStop(0, `rgba(255,250,220,${1 - k})`);
    fl.addColorStop(0.35, `rgba(255,190,80,${0.8 * (1 - k)})`);
    fl.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.arc(54, 0, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,230,${0.9 * (1 - k)})`;
    ctx.beginPath();
    ctx.moveTo(52, -3);
    ctx.lineTo(104 - k * 30, 0);
    ctx.lineTo(52, 3);
    ctx.closePath();
    ctx.fill();
  }
  if (since >= 0.05 && since < 1.1) {
    const k = (since - 0.05) / 1.05;
    smoke(ctx, 56 + k * 40, -3 * k, k, 9, 0.55);
    smoke(ctx, 52 + k * 30, 5 * k, k, 7, 0.4);
  }
  ctx.restore();
  // The hit points: a pip each, or (log v74: a turret takes more than a
  // handful of shots) a bar with the number left.
  if (max <= 6) {
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = i < hp ? '#ff8a7a' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - max * 4.5 + i * 9, y - 34, 7, 5);
    }
  } else {
    hbar(ctx, x, y - 36, 44, hp / max, '#ff8a7a');
    lab(ctx, String(Math.max(0, Math.ceil(hp - 1e-6))), x, y - 42, '#ffd0c6', 13);
  }
  // Hurt: smoke.
  if (hp <= max / 2) {
    for (let k = 0; k < 3; k++) {
      const u = (k / 3 + t * 0.5) % 1;
      smoke(ctx, x + 6 + u * 12, y - 8 - u * 26, u, 7, 0.5);
    }
  }
}

/** A gun turret on the Dreadnought's deck: a target. */
export function drawTurret(ctx: CanvasRenderingContext2D, g: Game, th: Threat): void {
  const rot = th.rot ?? th.heading;
  // Brackets round it say "shoot me", pulsing a little; they close in as the
  // gun is about to fire.
  const left = th.fireT ?? 99;
  const near = left < 1.2 ? 1 - left / 1.2 : 0;
  const r = 34 - near * 5 + Math.sin(g.t * 5) * 1.2;
  ctx.strokeStyle = `rgba(255,209,102,${0.55 + 0.4 * near})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const cx = th.x + Math.cos(a) * r;
    const cy = th.y + Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(cx - Math.sign(Math.cos(a)) * 9, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - Math.sign(Math.sin(a)) * 9);
    ctx.stroke();
  }
  gun(ctx, g, th.x, th.y, rot, th.hp, th.maxHp ?? THREATS.turret.hp, th.shotT, left, th.slot ?? 0);
}
