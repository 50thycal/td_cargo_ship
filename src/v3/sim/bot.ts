// A headless player for tests and the balance sweep. It plays through the
// same `tap()` a finger does — no privileged access — with a human-ish
// reaction delay and a cap on how fast it can tap. Weapons need nothing
// extra: it grabs their pickups like any other and keeps tapping threats
// (with the Railgun loaded, the toughest threat first).

import { ABILITY_ORDER, canTake, type AbilityId, type CardId } from '../data/abilities';
import type { ArmoryLevels } from '../data/armory';
import type { MapId } from '../data/maps';
import { newFoeState } from './foes';
import type { FoeSetting } from '../data/foes';
import { makeRng, type RNG } from '../../sim/rng';
import { AB } from '../data/abilities';
import {
  focusHold,
  beatClock,
  canFire,
  continueEndless,
  press,
  pressMove,
  release,
  createGame,
  pickUpgrade,
  step,
  tap,
  timeToImpact,
  quieterBranch,
  worthShooting,
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
  /** Weapon preference, first = most wanted. */
  prefer?: AbilityId[];
  /** Never picks up a weapon (the "main gun only" baseline). */
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
  /** A gesture in progress (Charge Lance, Grapnel): let go at `until`,
   *  dragging toward (tx, ty) meanwhile. */
  held: { until: number; tx: number; ty: number; id?: number } | null = null;
  private lastTap = -Infinity;
  private lastSwitch = 0;
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
      // favourite new weapon.
      const prefer = this.skill.prefer ?? ABILITY_ORDER;
      const pick = g.offer
        .filter((id) => canTake(g.levels, id))
        .sort((a, b) => held(g, b) - held(g, a) || rank(prefer, a) - rank(prefer, b))[0];
      pickUpgrade(g, pick);
      return;
    }
    const gap = this.skill.tapGap;
    const missRate = this.skill.missRate ?? 0;
    // Focus (a boost): hold one finger down while a rush is about to land,
    // lift it when it has passed; the other finger keeps tapping.
    if (g.phase === 'wave') {
      const rush = g.boost?.id === 'focus' && g.boost.bank > 0 && g.threats.filter((t) => !t.dead && timeToImpact(g, t) < 3).length >= 2;
      if (rush !== g.finger) focusHold(g, rush);
    }
    // Taps are paced on real time: under Focus a person gets more taps into
    // the slowed seconds, and so does the bot.
    if (g.phase !== 'wave' || g.realT - this.lastTap < gap) return;
    for (const th of g.threats) if (!this.seenAt.has(th.id)) this.seenAt.set(th.id, g.t);
    const seen = (th: Threat) => g.t - (this.seenAt.get(th.id) ?? g.t) >= this.skill.reaction;

    // Pickups first when they're cheap to grab (the baseline leaves weapons).
    const pickup = g.pickups.find((p) => !(this.skill.noAbilities && p.kind === 'weapon'));
    if (pickup && pickup.age > this.skill.reaction) {
      tap(g, pickup.x, pickup.y, 4);
      this.lastTap = g.realT;
      return;
    }
    // The Delta: throw the switch toward a quieter branch now and then.
    const fork = g.map.fork;
    if (fork && g.t - this.lastSwitch > 10) {
      this.lastSwitch = g.t;
      const want = quieterBranch(g);
      if (want !== null) {
        while (g.forkLane % fork.lanes.length !== want) tap(g, fork.x, fork.y, 6);
        this.lastTap = g.realT;
        return;
      }
    }
    // A gesture in progress: keep the finger down (and moving) until it's done.
    if (g.press && this.held) {
      const p = g.press;
      if (p.mode === 'hook') {
        const d = Math.hypot(this.held.tx - p.x, this.held.ty - p.y);
        const k = Math.min(1, 40 / Math.max(1, d));
        pressMove(g, p.x + (this.held.tx - p.x) * k, p.y + (this.held.ty - p.y) * k);
      }
      // Charging the Lance: the finger follows its target as it flies.
      const aim = this.held.id !== undefined ? g.threats.find((t) => t.id === this.held!.id && !t.dead) : undefined;
      if (p.mode === 'charge' && aim) pressMove(g, aim.x, aim.y);
      if (g.t >= this.held.until) {
        release(g, p.x, p.y, 6);
        this.held = null;
        this.lastTap = g.realT;
        return;
      }
      // Two thumbs: while one charges the Lance, the other keeps tapping.
      if (g.weapon?.id !== 'lance') return;
    }
    if (!g.press) this.held = null;
    if (!this.skill.spam && !canFire(g)) return;
    // Most urgent first: the threat closest to whatever it is aimed at. With
    // the Railgun loaded, the toughest threat first (a beam is wasted on a drone).
    const rail = g.weapon?.id === 'railgun';
    let best: Threat | null = null;
    let bestScore = Infinity;
    for (const th of worthShooting(g, g.threats)) {
      if (th.dead || !seen(th) || th.held || th.id === this.held?.id) continue;
      const inFlight = g.interceptors.filter((i) => i.target === th.id).length;
      if (!this.skill.spam && !rail && inFlight >= th.hp) continue;
      // A missile after the supertanker comes first: it is worth three ships.
      const vip = g.ships.some((s) => s.vip && s.id === th.target) ? 1.5 : 0;
      const urgency = timeToImpact(g, th) - vip - (rail ? th.hp * 10 : 0);
      if (urgency < bestScore) {
        bestScore = urgency;
        best = th;
      }
    }
    if (best) {
      // A miss lands well clear of the target: nothing fires, the moment is lost.
      const miss = this.rng.chance(missRate);
      const used = !miss && !g.press ? this.useGesture(g, best) : false;
      // 'wait' (Cadence Gun, holding for the beat): no tap made, so no tap gap.
      if (used === 'wait') return;
      if (used) {
        this.lastTap = g.realT;
        return;
      }
      tap(g, best.x + (miss ? 120 : 0), best.y + (miss ? 120 : 0), 6);
      this.lastTap = g.realT;
    }
  }
}

export interface Bot {
  useGesture(g: Game, best: Threat): boolean | 'wait';
}

/** The weapons plan's phase 1 weapons, played the obvious way: charge the
 *  Lance on anything tough, swipe the Cutter through the most urgent threat
 *  and whatever lines up with it, swing the Grapnel's ball into the nearest
 *  pack, chain two threats in reach, mark for Fire Control, keep the beat.
 *  True when it did something other than a plain tap. */
Bot.prototype.useGesture = function (this: Bot, g: Game, best: Threat): boolean | 'wait' {
  const w = g.weapon;
  if (!w) return false;
  const live = worthShooting(g, g.threats).filter((t) => !t.dead && !t.held);
  const self = this;
  switch (w.id) {
    case 'lance': {
      // Charge at the toughest thing in the sky (the other thumb keeps
      // tapping the urgent ones, see act).
      // Or along a line from the gun through three or more (a lance pierces).
      const c = g.map.carrier;
      const minRoom = AB.lance.half / AB.lance.rate[w.level - 1] + 0.3;
      const onLine = (t: Threat) => {
        const d = Math.hypot(t.x - c.x, t.y - c.y) || 1;
        const ux = (t.x - c.x) / d;
        const uy = (t.y - c.y) / d;
        return live.filter((o) => (o.x - c.x) * ux + (o.y - c.y) * uy > 0 && Math.abs((o.x - c.x) * uy - (o.y - c.y) * ux) <= AB.lance.width).length;
      };
      const tough =
        live.filter((t) => t.hp >= 3 && timeToImpact(g, t) > minRoom).sort((a, b) => b.hp - a.hp)[0] ??
        live.filter((t) => timeToImpact(g, t) > minRoom && onLine(t) >= 3).sort((a, b) => onLine(b) - onLine(a))[0] ??
        // A short hold triples a shot: worth it on anything with time to spare.
        (timeToImpact(g, best) > minRoom ? best : undefined);
      if (!tough) return false;
      best = tough;
      // One thumb charges while the other keeps tapping (see act): full if
      // the target can wait and little else is coming, else half.
      const others = live.filter((t) => t !== best && timeToImpact(g, t) < 2.5).length;
      const room = timeToImpact(g, best) - 0.3;
      const want = room > AB.lance.full / AB.lance.rate[w.level - 1] && others <= 2 ? AB.lance.full : AB.lance.half;
      if (room < AB.lance.half / AB.lance.rate[w.level - 1]) return false;
      press(g, best.x, best.y, 6);
      if (!g.press) return false;
      self.held = { until: g.t + want / AB.lance.rate[w.level - 1] + 0.02, tx: best.x, ty: best.y, id: best.id };
      return true;
    }
    case 'cutter': {
      // The 320 px stretch through the urgent threat that cuts the most.
      const L = AB.cutter.length[w.level - 1] * 0.95;
      let from = { x: best.x - L / 2, y: best.y };
      let to = { x: best.x + L / 2, y: best.y };
      let most = 0;
      for (const o of live) {
        if (o === best) continue;
        const d = Math.hypot(o.x - best.x, o.y - best.y);
        if (d < 1 || d > L) continue;
        const ux = (o.x - best.x) / d;
        const uy = (o.y - best.y) / d;
        const n = live.filter((t) => {
          const along = (t.x - best.x) * ux + (t.y - best.y) * uy;
          return along >= -L / 2 && along <= L / 2 && Math.abs((t.x - best.x) * uy - (t.y - best.y) * ux) <= AB.cutter.width;
        }).length;
        if (n > most) {
          most = n;
          from = { x: best.x - (ux * L) / 2, y: best.y - (uy * L) / 2 };
          to = { x: best.x + (ux * L) / 2, y: best.y + (uy * L) / 2 };
        }
      }
      press(g, from.x, from.y, 6);
      for (let k = 1; k <= 8; k++) pressMove(g, from.x + ((to.x - from.x) * k) / 8, from.y + ((to.y - from.y) * k) / 8);
      release(g, to.x, to.y, 6);
      return true;
    }
    case 'grapnel': {
      // Hook the urgent one and swing it at the nearest other threat.
      const other = live.filter((t) => t !== best).sort((a, b) => Math.hypot(a.x - best.x, a.y - best.y) - Math.hypot(b.x - best.x, b.y - best.y))[0];
      press(g, best.x, best.y, 6);
      if (g.press?.mode !== 'hook') {
        // Nothing hooked (dry, or a structure): the press is a plain tap.
        if (g.press) release(g, best.x, best.y, 6);
        return true;
      }
      self.held = { until: g.t + 0.7, tx: other ? other.x : best.x, ty: other ? other.y : best.y - 200 };
      return true;
    }
    case 'cadence': {
      // Wait for the beat unless the threat can't wait.
      const b = beatClock(g, w);
      if (b.off <= AB.cadence.window[w.level - 1] * 0.8 || timeToImpact(g, best) < 0.7) return false;
      return 'wait';
    }
  }
  return false;
};

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
  /** Weapon pickups taken, by weapon. */
  uses: Partial<Record<AbilityId, number>>;
  levels: Partial<Record<AbilityId, number>>;
  /** Share of wave time the gun had a weapon loaded. */
  loaded: number;
}

/** Play one full game. `endlessTo` keeps going past the clear for a score run. */
export function runBot(
  map: MapId,
  seed: number,
  skill: BotSkill,
  opts: { flow?: number; endlessTo?: number; dt?: number; firstWave?: number; tempo?: Tempo; armory?: ArmoryLevels; foes?: FoeSetting } = {},
): BotRun {
  const g = createGame(map, seed, opts.firstWave, opts.tempo, opts.armory);
  // The enemy build: which new enemies come (a sweep can leave them out to
  // compare; wave 1 never has any, so nothing is planned yet).
  if (opts.foes && opts.foes !== 'campaign') g.foe = newFoeState(map, opts.foes);
  if (opts.flow !== undefined) g.flow = opts.flow;
  const bot = new Bot(skill, seed);
  const dt = opts.dt ?? 1 / 30;
  let waveSteps = 0;
  let loadedSteps = 0;
  for (let i = 0; i < 60 * 60 * 30; i++) {
    bot.act(g);
    if (g.phase === 'wave') {
      waveSteps++;
      if (g.weapon) loadedSteps++;
    }
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
    loaded: waveSteps ? loadedSteps / waveSteps : 0,
  };
}
