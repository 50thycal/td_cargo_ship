// A headless player for tests and the balance sweep. It plays through the
// same `tap()` a finger does — no privileged access — with a human-ish
// reaction delay and a cap on how fast it can tap.

import { UPGRADE_ORDER, canTake, type UpgradeId } from '../data/upgrades';
import type { MapId } from '../data/maps';
import { makeRng, type RNG } from '../../sim/rng';
import {
  canFire,
  continueEndless,
  createGame,
  pickUpgrade,
  step,
  tap,
  timeToImpact,
  type Game,
  type Threat,
  type Tempo,
} from './game';

export interface BotSkill {
  /** Seconds a threat must be on screen before the bot reacts to it. */
  reaction: number;
  /** Minimum seconds between taps. */
  tapGap: number;
  /** Share of taps that miss (finger off target). Measured on a phone in
   *  playtest cycle 1: ~8% with careful aim, ~20% when sloppy. */
  missRate?: number;
  /** Card preference, first = most wanted. */
  prefer?: UpgradeId[];
  /** Taps like an excited person: without waiting for a loaded round and
   *  without checking whether a threat is already covered. */
  spam?: boolean;
}

export const SKILLS: Record<string, BotSkill> = {
  sharp: { reaction: 0.35, tapGap: 0.18 },
  average: { reaction: 0.6, tapGap: 0.3, missRate: 0.08 },
  casual: { reaction: 1.0, tapGap: 0.5, missRate: 0.2 },
  spammer: { reaction: 0.8, tapGap: 0.2, missRate: 0.2, spam: true },
};

export class Bot {
  private seenAt = new Map<number, number>();
  private lastTap = -Infinity;
  private rng: RNG;

  constructor(
    private skill: BotSkill,
    seed = 1,
  ) {
    this.rng = makeRng(seed ^ 0x5eed);
  }

  act(g: Game): void {
    if (g.phase === 'draft') {
      const prefer = this.skill.prefer ?? UPGRADE_ORDER;
      const pick = g.offer
        .filter((id) => canTake(g.levels, id))
        .sort((a, b) => rank(prefer, a) - rank(prefer, b))[0];
      pickUpgrade(g, pick);
      return;
    }
    // With the Rapid Hold card a finger can rest on a swarm: repeats come as
    // fast as the card allows and aim drifts less than with separate taps.
    // (The free slow hold is no faster than these bots already tap.)
    const hold = (g.levels.hold ?? 0) > 0 ? g.stats.holdRepeat : 0;
    const gap = hold > 0 ? Math.min(this.skill.tapGap, hold) : this.skill.tapGap;
    const missRate = (this.skill.missRate ?? 0) * (hold > 0 ? 0.5 : 1);
    if (g.phase !== 'wave' || g.t - this.lastTap < gap) return;
    for (const th of g.threats) if (!this.seenAt.has(th.id)) this.seenAt.set(th.id, g.t);

    // Pickups first when they're cheap to grab.
    const pickup = g.pickups[0];
    if (pickup && pickup.age > this.skill.reaction) {
      tap(g, pickup.x, pickup.y, 4);
      this.lastTap = g.t;
      return;
    }
    if (!this.skill.spam && !canFire(g)) return;
    // Most urgent first: the threat closest to whatever it is aimed at.
    let best: Threat | null = null;
    let bestScore = Infinity;
    for (const th of g.threats) {
      if (th.dead || g.t - (this.seenAt.get(th.id) ?? g.t) < this.skill.reaction) continue;
      const inFlight = g.interceptors.filter((i) => i.target === th.id).length;
      if (!this.skill.spam && inFlight >= th.hp) continue;
      const urgency = timeToImpact(g, th);
      if (urgency < bestScore) {
        bestScore = urgency;
        best = th;
      }
    }
    if (best) {
      // A miss lands well clear of the target: nothing fires, the moment is lost.
      const miss = this.rng.chance(missRate);
      tap(g, best.x + (miss ? 120 : 0), best.y + (miss ? 120 : 0), 6);
      this.lastTap = g.t;
    }
  }
}

function rank(prefer: UpgradeId[], id: UpgradeId): number {
  const i = prefer.indexOf(id);
  return i < 0 ? 99 : i;
}

export interface BotRun {
  map: MapId;
  seed: number;
  won: boolean;
  wave: number;
  score: number;
  lost: number;
  delivered: number;
  carrierHp: number;
  seconds: number;
}

/** Play one full game. `endlessTo` keeps going past the clear for a score run. */
export function runBot(
  map: MapId,
  seed: number,
  skill: BotSkill,
  opts: { flow?: number; endlessTo?: number; dt?: number; firstWave?: number; tempo?: Tempo } = {},
): BotRun {
  const g = createGame(map, seed, opts.firstWave, opts.tempo);
  if (opts.flow !== undefined) g.flow = opts.flow;
  const bot = new Bot(skill, seed);
  const dt = opts.dt ?? 1 / 30;
  for (let i = 0; i < 60 * 60 * 30; i++) {
    bot.act(g);
    if (g.phase === 'won') {
      if (opts.endlessTo && g.wave < opts.endlessTo) continueEndless(g);
      else break;
    }
    if (g.phase === 'lost') break;
    if (opts.endlessTo && g.endless && g.wave > opts.endlessTo) break;
    step(g, dt);
  }
  return {
    map,
    seed,
    won: g.cleared,
    wave: g.wave,
    score: g.score,
    lost: g.lost,
    delivered: g.delivered,
    carrierHp: g.carrierHp,
    seconds: Math.round(g.t),
  };
}
