// WHO GIVES THE CONVOY COMMANDS in a bot run (the Map & Convoy Lab's
// experiments, slices 3 and 4). The shooting bot (sim/mimic.ts) taps
// threats; this gives the convoy's command (round 11: Hold, the one left
// after Rush and Disperse were cut), at one of four skills, so a
// command's worth can be told from the skill of using it:
//   never   no command at all (the policy's floor)
//   sharp   each command when its moment comes (below)
//   random  as often as `sharp` could, at moments picked by chance
//   spam    every command the instant it is ready (the abuse case)
// A bot reads the whole board, as the shooting bot does: it never misses a
// tell, so `sharp` is a ceiling on what a person could get from a command.

import { makeRng, type RNG } from '../../sim/rng';
import { RAID } from '../data/config';
import type { CommandId } from '../data/convoy';
import { commandState, convoyCommands, type CommandResult } from './convoy';
import type { Game } from './game';

export type PilotSkill = 'never' | 'sharp' | 'random' | 'spam';
export const PILOT_SKILLS: PilotSkill[] = ['never', 'sharp', 'random', 'spam'];

/** Seconds a committed attack must still be in the air for a Rush to carry
 *  its ship out from under it (50 units at +20 a second), and the longest
 *  worth counting. */
const DODGE = { min: 2.6, max: 6 };

/** Attacks already aimed at where a ship will be, that a Rush now would
 *  leave behind: ballistics in flight and shell or dive circles counting
 *  down, with long enough still to go. */
export function committed(g: Game): number {
  let n = 0;
  for (const th of g.threats) {
    if (th.dead || th.kind !== 'ballistic' || th.target < 0) continue;
    const left = th.dur - th.age;
    if (left >= DODGE.min && left <= DODGE.max) n++;
  }
  for (const m of g.foe.marks) {
    if (m.kind !== 'shell' && m.kind !== 'dive') continue;
    const left = m.dur - m.t;
    if (left >= DODGE.min && left <= DODGE.max) n++;
  }
  return n;
}

/** Blasts about to land that can no longer be outrun. */
export function incomingSplash(g: Game): number {
  let n = 0;
  for (const th of g.threats) {
    if (th.dead || th.target < 0) continue;
    if (th.kind === 'ballistic' && th.dur - th.age < DODGE.min && th.dur - th.age > 0.3) n++;
    else if ((th.kind === 'heavy' || th.kind === 'cluster') && Math.hypot(th.x - g.map.carrier.x, th.y - g.map.carrier.y) < 520) n++;
  }
  return n;
}

/** Mines adrift in the lane close ahead of a ship (Sowers' Reach): the
 *  moment a player would hold the convoy and let them pass. */
export function minesCrossing(g: Game): number {
  let n = 0;
  for (const th of g.threats) {
    if (th.dead || th.kind !== 'mine') continue;
    if (g.ships.some((s) => !s.vip && th.x - s.x > 0 && th.x - s.x < 150 && Math.abs(th.y - s.y) < 70)) n++;
  }
  return n;
}

/** A raid of blasts or aircraft is warned of, or has just begun. */
export function raidOpening(g: Game): boolean {
  return g.raids.some((r) => (r.theme === 'barrage' || r.theme === 'strike') && r.at - g.waveT <= RAID.warn && g.waveT - r.at <= 2.5);
}

export class ConvoyPilot {
  private rng: RNG;
  /** `random`: when each command will next be given (game seconds). */
  private due: Partial<Record<CommandId, number>> = {};

  constructor(
    readonly skill: PilotSkill,
    seed: number,
  ) {
    this.rng = makeRng(seed ^ 0xc0420);
  }

  act(g: Game, give: (id: CommandId) => CommandResult): void {
    if (this.skill === 'never' || g.phase !== 'wave' || !g.convoy) return;
    for (const id of convoyCommands(g)) {
      const st = commandState(g, id);
      if (!st.ready) continue;
      if (id === 'hold' && st.active) {
        // Release once the raid's opening and the mines have passed (or let it run out).
        if (this.skill === 'sharp' ? !raidOpening(g) && !minesCrossing(g) && g.convoy.holdT > 1.5 : this.skill === 'random' ? this.rng.chance(1 / 240) : false) give(id);
        continue;
      }
      if (this.skill === 'spam') give(id);
      else if (this.skill === 'random') {
        const at = (this.due[id] ??= g.t + this.rng.range(0, 14));
        if (g.t >= at) {
          give(id);
          this.due[id] = undefined;
        }
      } else if (raidOpening(g) || minesCrossing(g) > 0) give(id);
    }
  }
}
