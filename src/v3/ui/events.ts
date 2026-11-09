// Special events on the battlefield (sim/events.ts): the line on the water
// (Afterburner Rush's boost line, Hydra Bloom's halfway line) and the Shield
// Wall's signal. Drawn plainly, with no words: the player works out what
// they mean (the player's rule: no telling how to beat an event).

import { VIEW } from '../data/config';
import type { Game } from '../sim/game';

/** Under the threats: the event's dashed line across the water. */
export function drawEventUnder(ctx: CanvasRenderingContext2D, g: Game): void {
  const ev = g.event;
  if (!ev?.line) return;
  const y = ev.line.y;
  const hot = ev.id === 'rush';
  ctx.save();
  // A soft band, then the dashes marching along it.
  ctx.fillStyle = hot ? 'rgba(255,140,60,0.07)' : 'rgba(245,197,66,0.06)';
  ctx.fillRect(0, y - 10, VIEW.width, 20);
  ctx.setLineDash([22, 14]);
  ctx.lineDashOffset = -g.t * 26;
  ctx.lineWidth = 3;
  ctx.strokeStyle = hot ? 'rgba(255,150,70,0.75)' : 'rgba(245,197,66,0.7)';
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(VIEW.width, y);
  ctx.stroke();
  ctx.restore();
}

/** Over the threats: the Shield Wall's signal, a flash across the block. */
export function drawEventOver(ctx: CanvasRenderingContext2D, g: Game): void {
  const ev = g.event;
  if (!ev || ev.id !== 'shield-wall') return;
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
