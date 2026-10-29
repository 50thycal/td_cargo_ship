// A headless player for tests and the balance sweep. It plays through the
// same `tap()` a finger does — no privileged access — with a human-ish
// reaction delay and a cap on how fast it can tap.

import { ABILITY_ORDER, canTake, type AbilityId, type CardId } from '../data/abilities';
import type { ArmoryLevels } from '../data/armory';
import type { MapId } from '../data/maps';
import { makeRng, type RNG } from '../../sim/rng';
import { chooseAbility } from './abilityBot';
import {
  activate,
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
  /** Ability preference, first = most wanted. */
  prefer?: AbilityId[];
  /** Never sets off an ability (the "main gun only" baseline). */
  noAbilities?: boolean;
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
      // Level what it holds first (evolutions are the payoff), then its
      // favourite new ability.
      const prefer = this.skill.prefer ?? ABILITY_ORDER;
      const pick = g.offer
        .filter((id) => canTake(g.levels, id))
        .sort((a, b) => held(g, b) - held(g, a) || rank(prefer, a) - rank(prefer, b))[0];
      pickUpgrade(g, pick);
      return;
    }
    const gap = this.skill.tapGap;
    const missRate = this.skill.missRate ?? 0;
    if (g.phase !== 'wave' || g.t - this.lastTap < gap) return;
    for (const th of g.threats) if (!this.seenAt.has(th.id)) this.seenAt.set(th.id, g.t);
    const seen = (th: Threat) => g.t - (this.seenAt.get(th.id) ?? g.t) >= this.skill.reaction;

    // An ability, when one is ready and worth it: it costs a tap's moment.
    if (!this.skill.noAbilities) {
      const use = chooseAbility(g, seen);
      if (use && activate(g, use.id, use.aim)) {
        this.lastTap = g.t;
        return;
      }
    }

    // Pickups first when they're cheap to grab.
    const pickup = g.pickups[0];
    if (pickup && pickup.age > this.skill.reaction) {
      tap(g, pickup.x, pickup.y, 4);
      this.lastTap = g.t;
      return;
    }
    if (!this.skill.spam && !canFire(g)) return;
    // Most urgent first: the threat closest to whatever it is aimed at. With
    // the Railgun loaded, the toughest threat first (a beam is wasted on a drone).
    const rail = g.gunMode?.id === 'railgun';
    let best: Threat | null = null;
    let bestScore = Infinity;
    for (const th of g.threats) {
      if (th.dead || !seen(th)) continue;
      const inFlight = g.interceptors.filter((i) => i.target === th.id).length;
      if (!this.skill.spam && !rail && inFlight >= th.hp) continue;
      const urgency = timeToImpact(g, th) - (rail ? th.hp * 10 : 0);
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

function rank(prefer: AbilityId[], id: CardId): number {
  const i = prefer.indexOf(id as AbilityId);
  return i < 0 ? 99 : i;
}

function held(g: Game, id: CardId): number {
  return id === 'resupply' ? -1 : (g.levels[id] ?? 0) > 0 ? 1 : 0;
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
  /** Waves cleared (what salvage pays for). */
  wavesCleared: number;
  uses: Partial<Record<AbilityId, number>>;
  levels: Partial<Record<AbilityId, number>>;
}

/** Play one full game. `endlessTo` keeps going past the clear for a score run. */
export function runBot(
  map: MapId,
  seed: number,
  skill: BotSkill,
  opts: { flow?: number; endlessTo?: number; dt?: number; firstWave?: number; tempo?: Tempo; armory?: ArmoryLevels } = {},
): BotRun {
  const g = createGame(map, seed, opts.firstWave, opts.tempo, opts.armory);
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
    wavesCleared: g.history.filter((h) => h.outcome === 'cleared').length,
    uses: { ...g.uses },
    levels: { ...g.levels },
  };
}
