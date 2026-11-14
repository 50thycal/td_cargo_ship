// Special events on the battlefield (sim/events.ts): Beacon Strike's marks
// and the Shield Wall's signal. Drawn plainly, with no words: the player
// works out what they mean (the player's rule: no telling how to beat an
// event). The lines on the water are gone: Hydra Bloom's in round 8,
// Afterburner Rush's in round 11.

import { EV } from '../data/events';
import { beaconMark } from '../sim/events';
import type { Game } from '../sim/game';

/** Under the threats: Beacon Strike's marks (each beacon to the ship it
 *  has marked). */
export function drawEventUnder(ctx: CanvasRenderingContext2D, g: Game): void {
  if (g.event?.id === 'beacon-strike') drawBeaconMarks(ctx, g);
}

/** Beacon Strike (round 8): while a beacon charges its call, a dashed
 *  yellow line runs from it to the ship it has marked, the dashes marching
 *  toward the ship, and a bracket closes in on that ship as the call comes
 *  (it goes red in the last half second). */
function drawBeaconMarks(ctx: CanvasRenderingContext2D, g: Game): void {
  const E = EV['beacon-strike'];
  ctx.save();
  for (const t of g.threats) {
    const s = beaconMark(g, t);
    const f = t.foe;
    if (!s || !f || f.call === undefined) continue;
    const k = Math.max(0, Math.min(1, 1 - (f.call - f.t) / E.charge));
    const hot = f.call - f.t < 0.5;
    const col = hot ? '255,90,60' : '253,224,71';
    ctx.strokeStyle = `rgba(${col},${0.45 + 0.4 * k})`;
    ctx.lineWidth = 2 + k;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -g.t * 40;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // The bracket: four corners closing in on the ship.
    const r = 44 - 16 * k;
    ctx.strokeStyle = `rgba(${col},0.95)`;
    ctx.lineWidth = 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ctx.beginPath();
      ctx.moveTo(s.x + sx * r, s.y + sy * (r - 10));
      ctx.lineTo(s.x + sx * r, s.y + sy * r);
      ctx.lineTo(s.x + sx * (r - 10), s.y + sy * r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Over the threats: an armored block's signal (the Shield Wall's, Run the
 *  Canal's), a flash across the block. */
export function drawEventOver(ctx: CanvasRenderingContext2D, g: Game): void {
  const ev = g.event;
  if (!ev || !ev.block.length) return;
  const age = ev.t - ev.signalT;
  if (age < 0 || age > 0.7) return;
  const block = g.threats.filter((t) => !t.dead && ev.block.includes(t.id));
  if (!block.length) return;
  const k = age / 0.7;
  ctx.save();
  for (const t of block) {
    ctx.strokeStyle = `rgba(255,236,170,${0.9 * (1 - k)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 16 + k * 22, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}
