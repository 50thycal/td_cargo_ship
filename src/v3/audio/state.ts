// What should be sounding *continuously*, read from the game each frame: the
// loops (a burning row, a spinning blade, a gravity well, a supersonic
// arming, the carrier in danger) and which music bed. Pure and read-only, so
// the offline renderer and the tests use the very same rules the game does.

import { SUPERSONIC, VIEW } from '../data/config';
import type { Game } from '../sim/game';
import type { LoopCue, MusicCue } from './cues';

export interface LoopState {
  id: LoopCue;
  /** Where it pans (world x), and how loud (0..1, scaled by the manifest). */
  x: number;
  level: number;
}

/** The carrier is in danger (the same rule as the red edge in app.ts). */
export function carrierCritical(g: Game): boolean {
  return g.phase === 'wave' && g.carrierHp > 0 && g.carrierHp <= Math.ceil(g.stats.carrierHp * 0.25);
}

export function activeLoops(g: Game): LoopState[] {
  if (g.phase !== 'wave') return [];
  const out: LoopState[] = [];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const burns = g.fields.filter((f) => f.kind === 'burn');
  if (burns.length) out.push({ id: 'burn.loop', x: mean(burns.map((f) => (f.x1 + f.x2) / 2)), level: Math.min(1, 0.5 + burns.length * 0.08) });
  if (g.blades.length) out.push({ id: 'blade.spin', x: mean(g.blades.map((b) => b.x)), level: Math.min(1, 0.7 + 0.3 * (g.blades.length - 1)) });
  const wells = g.fields.filter((f) => f.kind === 'well');
  if (wells.length) out.push({ id: 'well.pull', x: mean(wells.map((f) => f.x1)), level: 1 });
  const arming = g.threats.filter((t) => !t.dead && t.kind === 'supersonic' && t.age < SUPERSONIC.arming);
  if (arming.length) out.push({ id: 'supersonic.lock', x: mean(arming.map((t) => t.x)), level: 1 });
  // Aircraft: their engines, panned with them, swelling in from the edge
  // they enter by and fading out past the far one.
  for (const kind of ['strafer', 'bomber'] as const) {
    const planes = g.threats.filter((t) => !t.dead && t.kind === kind);
    if (!planes.length) continue;
    const near = Math.max(...planes.map((t) => Math.min(t.x + 60, VIEW.width + 60 - t.x)));
    out.push({ id: kind === 'strafer' ? 'strafer.pass' : 'bomber.pass', x: mean(planes.map((t) => t.x)), level: Math.max(0.15, Math.min(1, near / 360)) });
  }
  if (carrierCritical(g)) out.push({ id: 'carrier.critical', x: g.map.carrier.x, level: 1 });
  return out;
}

/** Threats on screen at which the battle music turns intense. */
export const INTENSE_THREATS = 14;
/** The wave from which battle music is intense throughout. */
export const INTENSE_WAVE = 6;

/** The music bed for a running game (menus pick theirs in the UI). Intense
 *  from wave 6, or earlier while the screen is crowded. */
export function battleMusic(g: Game): MusicCue {
  const live = g.threats.filter((t) => !t.dead).length;
  return g.wave >= INTENSE_WAVE || live >= INTENSE_THREATS ? 'battle.intense' : 'battle.music';
}
