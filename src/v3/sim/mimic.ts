// The watch-mode bot (round 9): plays like the player, not like a machine.
// Fitted to the player's own logs with tools/v2/style.ts (numbers in
// docs/design/v2-watch-mode.md): taps come in bursts of ~3 a fifth of a
// second apart, land ~35 px off, keep coming while the rack is empty, and
// go to the most urgent threat only about half the time; the rest go to
// whatever is near the finger. Ship flow goes up early, the formation changes
// once, and cards stack: take a card, then level it up. V3: weapon pickups
// are grabbed like any pickup; a loaded weapon fires from the same taps.
//
// It acts through `BotIO`, the same calls the player's touches make, so a
// watched run records an ordinary log that replays exactly. Its dice are
// its own (seeded from the game seed), so a seed always plays out the same.

import { ABILITIES, ABILITY_ORDER, MAX_SLOTS, canTake, loadout, type AbilityId, type CardId } from '../data/abilities';
import type { ArmoryLevels } from '../data/armory';
import type { FormationId } from '../data/formations';
import type { MapId } from '../data/maps';
import { makeRng, type RNG } from '../../sim/rng';
import type { ThreatKind } from '../data/config';
import { canFire, createGame, step, timeToImpact, type Game, type TapResult, type Tempo, type Threat } from './game';
import { Recorder, SIM_DT, type GhostResult, type PlayLog } from './playlog';

export interface Persona {
  id: string;
  /** Name and one line for the Settings picker. */
  label?: string;
  blurb?: string;
  /** The game speed this player plays at: the bot's own clock is real time,
   *  so at 1.25× every reaction and pause takes 1.25× the game seconds. */
  speed?: number;
  /** Seconds from a threat appearing to the bot noticing it (log-normal). */
  react: { median: number; sigma: number };
  /** Reaction multiplier by threat kind (a ballistic launch flash is hard
   *  to miss; a supersonic dart is easy to). Absent = 1. */
  reactBy?: Partial<Record<ThreatKind, number>>;
  /** No reaction is faster than this (s). */
  reactFloor?: number;
  /** Taps per burst: weights for 1, 2, 3, … taps. */
  burst: number[];
  /** Seconds between taps inside a burst (uniform). */
  burstGap: [number, number];
  /** Seconds between bursts (log-normal). */
  pause: { median: number; sigma: number };
  /** Aim error: a 2-D normal of `near` px most of the time, `far` px for
   *  `farShare`; `lag` s behind where the threat is (negative = leading).
   *  With `jitter`, that error is the thumb's offset for a whole burst and
   *  each tap wobbles `jitter` px around it. */
  aim: { near: number; far: number; farShare: number; lag: number; jitter?: number };
  /** Aim spread multiplier by threat kind (a ballistic's arc is hard to
   *  pin). Absent = 1. */
  aimBy?: Partial<Record<ThreatKind, number>>;
  /** Share of bursts aimed at the most urgent threat (the rest: nearest the finger). */
  urgent: number;
  /** Chance it sees an interceptor already on its way to a threat and
   *  picks another one instead. */
  coverSense?: number;
  /** A threat noticed during a pause cuts the pause short, after this many
   *  seconds (a person rests between bursts only while nothing new shows). */
  interrupt?: number;
  /** With a threat it has seen still up, a rest between bursts lasts at
   *  most this long (s): long rests are for an empty sky. */
  restCap?: number;
  /** A threat this many seconds from impact gets the next burst (with
   *  odds `panicShare`, default always): the red reticle / lock line. */
  panic: number;
  panicShare?: number;
  /** After a tap that fired, chance the next tap in the burst goes to
   *  another threat near the finger (a person sees the interceptor away). */
  hop?: number;
  /** How far (px) a hop reaches from the finger. */
  hopReach?: number;
  /** Chance a burst stops when its target goes down (the rest keep tapping
   *  where it was, as a thumb on the move does). */
  stopOnKill: number;
  /** Chance it notices the rack is empty before a burst and waits for the
   *  reload instead of tapping on. */
  waitDry: number;
  /** Chance a dry tap inside a burst ends it (default `waitDry`). */
  dryStop?: number;
  /** Share of bursts played with both thumbs on two threats, one each side. */
  twoThumb?: number;
  /** Wave-to-wave mood: each wave's pauses and reactions are scaled by a
   *  log-normal factor with this sigma (some waves rushed, some relaxed). */
  mood?: number;
  /** Looking away: episodes per minute of play, and their length (s);
   *  `grow`: the rate rises by this share per 5 minutes played. */
  lapse?: { perMin: number; median: number; sigma: number; grow?: number };
  /** Rushing: on this `share` of waves it turns the game speed up by
   *  `speed`× to get through it, and its rests and reactions shrink to
   *  `tempo`× in real time (frantic, not just faster). */
  rush?: { share: number; speed: number; tempo?: number };
  /** Pauses and reactions grow by this share per 5 minutes of play. */
  fatigue?: number;
  /** Chance a noticed pickup gets a tap when the finger is free. */
  pickup: number;
  /** Flow step it turns the ships up to early in wave 1, with the odds of each. */
  flow: { step: number; weight: number }[];
  /** One formation change, in waves `from`–`to` (none when `to` < `from`). */
  formation: { from: number; to: number; options: { id: FormationId; weight: number }[] };
  /** New weapons it likes, best first (it stacks whatever it already holds). */
  taste: AbilityId[];
  /** 'stack' (default) levels what it holds; 'random' takes any card. */
  cards?: 'stack' | 'random';
}

export const YOU_V1: Persona = {
  id: 'you-v1',
  react: { median: 0.6, sigma: 0.6 },
  burst: [0.2, 0.3, 0.22, 0.12, 0.08, 0.08],
  burstGap: [0.14, 0.2],
  pause: { median: 0.5, sigma: 0.6 },
  aim: { near: 24, far: 45, farShare: 0.15, lag: 0.12 },
  urgent: 0.15,
  panic: 0.9,
  stopOnKill: 0.6,
  waitDry: 0.6,
  pickup: 1.5,
  flow: [
    { step: 4, weight: 2 },
    { step: 3, weight: 1 },
  ],
  formation: {
    from: 2,
    to: 5,
    options: [
      { id: 'spread', weight: 2 },
      { id: 'box', weight: 1 },
    ],
  },
  taste: ['airstrike', 'railgun', 'flak', 'frigate', 'shrapnel', 'aegis', 'tesla', 'seeker', 'thermo', 'scatter', 'boomerang', 'well'],
};

/** You, round 12: fitted knob by knob to the player's four v6 runs with
 *  tools/v2/taxonomy.ts (docs/design/v2-bot-taxonomy.md). Over v1 it adds
 *  the game speed they play at (and the waves they rush), faster eyes for
 *  ballistic launches, passing over threats already covered, resting only
 *  while the sky is clear, the odd two-thumb burst, a mood that changes
 *  wave to wave, and looking away. */
export const YOU: Persona = {
  id: 'you',
  label: 'You',
  blurb: 'Fitted to your own logs: your rhythm, aim and habits, noise included. Plays at 1.1× and, like you, rushes about one wave in five: faster game, quicker taps.',
  speed: 1.1,
  rush: { share: 0.2, speed: 1.4, tempo: 0.6 },
  react: { median: 0.5, sigma: 0.4 },
  reactFloor: 0.25,
  reactBy: { ballistic: 0.7, guided: 1.4, supersonic: 2, bomber: 2 },
  burst: [0.22, 0.17, 0.14, 0.11, 0.09, 0.07, 0.06, 0.05, 0.04, 0.03],
  burstGap: [0.14, 0.2],
  pause: { median: 1.2, sigma: 0.8 },
  aim: { near: 24, far: 75, farShare: 0.18, lag: -0.03 },
  aimBy: { ballistic: 1.5 },
  urgent: 0.1,
  panic: 1,
  panicShare: 0.55,
  hop: 0.15,
  hopReach: 90,
  coverSense: 0.3,
  interrupt: 0.5,
  restCap: 1.2,
  stopOnKill: 0.25,
  waitDry: 0.5,
  dryStop: 0.05,
  twoThumb: 0.08,
  mood: 0.25,
  lapse: { perMin: 0.18, median: 5, sigma: 0.4 },
  fatigue: 0.05,
  pickup: 2.3,
  flow: [{ step: 4, weight: 1 }],
  formation: {
    from: 1,
    to: 4,
    options: [
      { id: 'box', weight: 2 },
      { id: 'spread', weight: 1 },
    ],
  },
  taste: ['flak', 'airstrike', 'thermo', 'railgun', 'aegis', 'shrapnel', 'seeker', 'frigate', 'tesla', 'scatter', 'boomerang', 'well'],
};

/** What the bot can do: exactly what a player's touches can. */
export interface BotIO {
  tap(x: number, y: number, radius: number): TapResult;
  pick(id: CardId, replace?: AbilityId): void;
  flow(step: number): void;
  formation(id: FormationId): void;
  /** The game speed it plays at from now (UI and analysis only). */
  pace?(speed: number): void;
}

/** A finger on an iPhone in landscape reaches 44 CSS px, ~108 world units. */
export const BOT_TAP_RADIUS = 108;

export class Mimic {
  private rng: RNG;
  private noticeAt = new Map<number, number>();
  private finger = { x: 800, y: 450 };
  /** The other thumb, for two-thumb bursts. */
  private finger2 = { x: 800, y: 450 };
  private target: number | null = null;
  private second: number | null = null;
  private thumb = 0;
  private tapsLeft = 0;
  private nextTap = 0;
  private flowPlan: { at: number; steps: number[] } | null = null;
  private formationPlan: { wave: number; at: number; id: FormationId } | null = null;
  private start: number | null = null;
  /** Mood: this wave's tempo factor. */
  private moodWave = 0;
  private moodK = 1;
  private lapseUntil = -Infinity;
  private pausedAt = -Infinity;
  /** Each thumb's aim error for the burst in hand. */
  private offset: ([number, number] | null)[] = [null, null];
  private nextLapse: number | null = null;

  /** `dice` > 0 rolls a different (but repeatable) game of the same seed:
   *  the fitting tools want several bot games per player run. */
  constructor(
    readonly persona: Persona,
    seed: number,
    dice = 0,
  ) {
    this.rng = makeRng(dice ? ((seed ^ 0x0b07) + Math.imul(dice, 0x9e3779b1)) >>> 0 : seed ^ 0x0b07);
    const p = persona;
    this.pace = p.speed ?? 1;
    const flow = weighted(this.rng, p.flow).step;
    this.flowPlan = { at: this.rng.range(2, 12), steps: Array.from({ length: flow - 1 }, (_, k) => k + 2) };
    const wave = p.formation.from + this.rng.int(Math.max(0, p.formation.to - p.formation.from) + 1);
    const at = this.rng.range(3, 10);
    const id = weighted(this.rng, p.formation.options).id;
    this.formationPlan = p.formation.to >= p.formation.from ? { wave, at, id } : null;
  }

  /** The card it would take from the offer on screen. */
  choose(g: Game): { id: CardId; replace?: AbilityId } {
    const takeable = g.offer.filter((id) => canTake(g.levels, id));
    if (this.persona.cards === 'random') {
      // Draws from the game's own state so the pick never moves the bot's dice
      // (the app picks on its own clock).
      const k = (g.wave * 7 + g.seed) % Math.max(1, takeable.length);
      return { id: takeable[k] ?? g.offer[0] };
    }
    // Stack: level up the card it holds highest.
    const held = takeable.filter((id): id is AbilityId => id !== 'resupply' && (g.levels[id] ?? 0) > 0);
    if (held.length) return { id: held.sort((a, b) => (g.levels[b] ?? 0) - (g.levels[a] ?? 0))[0] };
    const fresh = takeable.filter((id) => id !== 'resupply');
    if (fresh.length && loadout(g.levels).length < MAX_SLOTS) {
      const rank = (id: CardId) => {
        const k = this.persona.taste.indexOf(id as AbilityId);
        return k < 0 ? 50 + (ABILITY_ORDER as readonly string[]).indexOf(id) : k;
      };
      return { id: fresh.sort((a, b) => rank(a) - rank(b))[0] };
    }
    if (g.offer.includes('resupply')) return { id: 'resupply' };
    // Nothing to stack and no Resupply: the first card it can take at all.
    return { id: takeable[0] ?? g.offer[0] };
  }

  /** One sim step's worth of decisions. Drafts are picked at once; the app
   *  shows the pick first and calls `io.pick` itself (see `choose`). */
  act(g: Game, io: BotIO, drafts = true): void {
    if (g.phase === 'draft') {
      if (drafts) {
        const c = this.choose(g);
        io.pick(c.id, c.replace);
      }
      return;
    }
    if (g.phase !== 'wave') return;
    const t = g.t;
    const p = this.persona;
    this.rails(g, io);
    this.tempo(g, io);
    for (const th of g.threats)
      if (!this.noticeAt.has(th.id)) {
        let r = this.logNormal(p.react) * (p.reactBy?.[th.kind] ?? 1);
        if (p.reactFloor) r = Math.max(p.reactFloor, r);
        // Seen only once it looks back, and a little slower then.
        const from = t < this.lapseUntil ? this.lapseUntil : t;
        this.noticeAt.set(th.id, from + this.scale(r));
      }
    if (t < this.lapseUntil) return;
    if (this.nextLapse !== null && t >= this.nextLapse && p.lapse) {
      this.lapseUntil = t + this.scale(this.logNormal(p.lapse), false);
      const played = this.start === null ? 0 : (t - this.start) / 300;
      const rate = p.lapse.perMin * (1 + (p.lapse.grow ?? 0) * played);
      this.nextLapse = this.lapseUntil + this.scale((-Math.log(Math.max(1e-6, this.rng.next())) * 60) / rate, false);
      this.tapsLeft = 0;
      return;
    }
    if (t < this.nextTap) {
      // Resting between bursts, until something new shows up.
      if (this.tapsLeft > 0 || p.interrupt === undefined) return;
      let fresh = false;
      let up = false;
      for (const th of g.threats) {
        const n = this.noticeAt.get(th.id) ?? Infinity;
        if (!th.dead && n > this.pausedAt && n + this.scale(p.interrupt, false) <= t) fresh = true;
        if (!th.dead && n <= t) up = true;
      }
      const rested = p.restCap !== undefined && up && t - this.pausedAt >= this.scale(p.restCap);
      if (!fresh && !rested) return;
    }
    const seen = g.threats.filter((th) => !th.dead && (this.noticeAt.get(th.id) ?? Infinity) <= t);

    if (this.tapsLeft > 0) {
      const two = this.second !== null;
      const want = two && this.thumb === 1 ? this.second : this.target;
      let th = seen.find((s) => s.id === want) ?? null;
      const finger = two && this.thumb === 1 ? this.finger2 : this.finger;
      // Target gone mid-burst: often stop, else carry on at whatever is
      // under the finger.
      if (!th) {
        th = nearest(seen, finger, 150);
        if (!th && this.rng.chance(p.stopOnKill)) {
          this.tapsLeft = 0;
          this.second = null;
          this.pausedAt = t;
          this.nextTap = t + this.scale(this.logNormal(p.pause));
          return;
        }
      }
      // Its interceptor is already away: on to an open threat close by, or
      // done with this burst.
      if (th && p.coverSense && covered(g, th) && this.rng.chance(p.coverSense)) {
        const next = nearest(
          seen.filter((s) => s.id !== th!.id && !covered(g, s)),
          finger,
          p.hopReach ?? 220,
        );
        if (!next) {
          this.tapsLeft = 0;
          this.second = null;
          this.pausedAt = t;
          this.nextTap = t + this.scale(this.logNormal(p.pause));
          return;
        }
        th = next;
        if (two && this.thumb === 1) this.second = next.id;
        else this.target = next.id;
      }
      const r = this.tapAt(g, io, th, two && this.thumb === 1);
      this.tapsLeft--;
      // A fired interceptor is on its way: often move on to the next one.
      if (r === 'fire' && th && p.hop && this.rng.chance(p.hop)) {
        const next = nearest(
          seen.filter((s) => s.id !== th!.id && !(p.coverSense && covered(g, s))),
          finger,
          p.hopReach ?? 220,
        );
        if (next) {
          if (two && this.thumb === 1) this.second = next.id;
          else this.target = next.id;
        }
      }
      if (r === 'dry' && this.rng.chance(p.dryStop ?? p.waitDry)) this.tapsLeft = 0;
      if (two) this.thumb ^= 1;
      if (this.tapsLeft <= 0) {
        this.second = null;
        this.pausedAt = t;
      }
      this.nextTap = t + (this.tapsLeft > 0 ? this.scale(this.rng.range(...p.burstGap) * (two ? 0.5 : 1), false) : this.scale(this.logNormal(p.pause)));
      return;
    }

    const pickup = g.pickups.find((pk) => pk.age > p.react.median * (p.speed ?? 1));
    if (pickup && this.rng.chance(p.pickup * SIM_DT * 6)) {
      this.finger = { x: pickup.x, y: pickup.y };
      io.tap(pickup.x + this.rng.range(-12, 12), pickup.y + this.rng.range(-12, 12), BOT_TAP_RADIUS);
      this.nextTap = t + this.scale(this.logNormal(p.pause) * 0.5);
      return;
    }
    if (!seen.length) return;
    if (!canFire(g) && this.rng.chance(p.waitDry)) {
      this.nextTap = t + this.scale(0.3, false);
      return;
    }
    // A threat with an interceptor already on its way is often passed over.
    let pool = seen;
    if (p.coverSense) {
      const open = seen.filter((s) => !covered(g, s));
      if (open.length && open.length < seen.length && this.rng.chance(p.coverSense)) pool = open;
    }
    const urgent = pool.reduce((a, b) => (timeToImpact(g, b) < timeToImpact(g, a) ? b : a));
    // Otherwise whatever catches the eye: any threat on screen, the ones
    // near the finger likelier.
    const panic = timeToImpact(g, urgent) < p.panic && (p.panicShare === undefined || this.rng.chance(p.panicShare));
    const pick = panic || this.rng.chance(p.urgent) ? urgent : this.glance(pool);
    this.target = pick.id;
    this.tapsLeft = 1 + weightedIndex(this.rng, p.burst);
    this.second = null;
    this.thumb = 0;
    this.offset = [null, null];
    // Both thumbs: a second threat on the other side of the screen.
    if (p.twoThumb && this.rng.chance(p.twoThumb)) {
      const other = seen.filter((s) => s.id !== pick.id && pick.x < 800 !== s.x < 800);
      if (other.length) {
        const o = nearest(other, this.finger2, Infinity)!;
        this.second = o.id;
        this.tapsLeft *= 2;
      }
    }
    this.nextTap = t;
    this.act(g, io, drafts);
  }

  /** Real seconds → this player's game seconds: their game speed, and (for
   *  reactions and pauses) the wave's mood and how long they've played. */
  private scale(sec: number, moody = true): number {
    const p = this.persona;
    let k = this.pace;
    if (moody) {
      k *= this.moodK;
      if (p.fatigue && this.start !== null) k *= 1 + (p.fatigue * (this.lastT - this.start)) / 300;
    }
    return sec * k;
  }

  private lastT = 0;
  /** The game speed it plays at right now: its persona's, × a rush. */
  pace: number;
  private paced: number | null = null;
  /** Per-wave mood, rush and the first look-away, rolled as the wave starts. */
  private tempo(g: Game, io: BotIO): void {
    const p = this.persona;
    this.lastT = g.t;
    if ((p.mood || p.rush) && g.wave !== this.moodWave) {
      this.moodWave = g.wave;
      if (p.mood) this.moodK = Math.exp(p.mood * gauss(this.rng));
      if (p.rush) {
        const rushing = this.rng.chance(p.rush.share);
        this.pace = (p.speed ?? 1) * (rushing ? p.rush.speed : 1);
        if (rushing) this.moodK *= p.rush.tempo ?? 1;
      }
    }
    if (this.pace !== this.paced) {
      this.paced = this.pace;
      if (this.pace !== 1 || p.rush) io.pace?.(this.pace);
    }
    if (p.lapse && this.nextLapse === null) this.nextLapse = g.t + this.scale((-Math.log(Math.max(1e-6, this.rng.next())) * 60) / p.lapse.perMin, false);
  }

  private tapAt(g: Game, io: BotIO, th: Threat | null, other = false): TapResult {
    const a = this.persona.aim;
    const k = (th && this.persona.aimBy?.[th.kind]) || 1;
    let ex: number;
    let ey: number;
    if (a.jitter === undefined) {
      [ex, ey] = gauss2(this.rng, (this.rng.chance(a.farShare) ? a.far : a.near) * k);
    } else {
      // A thumb's error holds for the whole burst; each tap only wobbles.
      const o = (this.offset[other ? 1 : 0] ??= gauss2(this.rng, this.rng.chance(a.farShare) ? a.far : a.near));
      const [jx, jy] = gauss2(this.rng, a.jitter);
      ex = (o[0] + jx) * k;
      ey = (o[1] + jy) * k;
    }
    const finger = other ? this.finger2 : this.finger;
    // The finger lands where the threat was a moment ago.
    const x = th ? th.x - th.vx * a.lag : finger.x;
    const y = th ? th.y - th.vy * a.lag : finger.y;
    if (other) this.finger2 = { x, y };
    else this.finger = { x, y };
    return io.tap(clamp(x + ex, 0, 1600), clamp(y + ey, 0, 900), BOT_TAP_RADIUS);
  }

  /** Ships up early in wave 1; one formation change a few waves in. */
  private rails(g: Game, io: BotIO): void {
    // Timed from the start of the run (game time), not the wave: a dev short
    // wave can be over before a per-wave timer comes due.
    this.start ??= g.t;
    const fp = this.flowPlan;
    const k = this.persona.speed ?? 1;
    if (fp && g.t - this.start >= fp.at * k) {
      const next = fp.steps.find((s) => s > g.flow);
      if (next === undefined) this.flowPlan = null;
      else {
        io.flow(next);
        fp.at = (g.t - this.start) / k + 0.1;
      }
    }
    const mp = this.formationPlan;
    if (mp && g.wave >= mp.wave && g.waveT >= mp.at * k) {
      if (g.formation !== mp.id) io.formation(mp.id);
      this.formationPlan = null;
    }
  }

  private glance(seen: Threat[]): Threat {
    const w = seen.map((th) => 1 / (1 + Math.hypot(th.x - this.finger.x, th.y - this.finger.y) / 300));
    return seen[weightedIndex(this.rng, w)];
  }

  private logNormal(d: { median: number; sigma: number }): number {
    return d.median * Math.exp(d.sigma * gauss(this.rng));
  }
}

/** Interceptors already on their way to `th` cover it. */
function covered(g: Game, th: Threat): boolean {
  let n = 0;
  for (const i of g.interceptors) if (i.target === th.id) n++;
  return n >= th.hp;
}

function nearest(list: Threat[], p: { x: number; y: number }, within: number): Threat | null {
  let best: Threat | null = null;
  let bd = within;
  for (const th of list) {
    const d = Math.hypot(th.x - p.x, th.y - p.y);
    if (d < bd) {
      bd = d;
      best = th;
    }
  }
  return best;
}

function gauss(rng: RNG): number {
  const u = Math.max(1e-9, rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

function gauss2(rng: RNG, sigma: number): [number, number] {
  return [gauss(rng) * sigma, gauss(rng) * sigma];
}

function weightedIndex(rng: RNG, weights: number[]): number {
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < weights.length; k++) if ((r -= weights[k]) < 0) return k;
  return weights.length - 1;
}

function weighted<T extends { weight: number }>(rng: RNG, items: T[]): T {
  return items[weightedIndex(rng, items.map((i) => i.weight))];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A bot game played a slice at a time, recorded: the ghost check runs one
 *  in the browser between frames, the fitting tools in one go. */
export class BotRun {
  readonly game: Game;
  readonly rec: Recorder;
  private bot: Mimic;
  private io: BotIO;
  private guard = 0;

  constructor(
    map: MapId,
    seed: number,
    opts: { persona?: Persona; firstWave?: number; tempo?: Tempo; build?: string; dice?: number; armory?: ArmoryLevels } = {},
  ) {
    const g = (this.game = createGame(map, seed, opts.firstWave ?? 1, opts.tempo, opts.armory));
    const rec = (this.rec = new Recorder(g, {
      build: opts.build ?? 'sim',
      startedAt: new Date(0).toISOString(),
      firstWave: opts.firstWave ?? 1,
      ...(opts.tempo ? { tempo: opts.tempo } : {}),
      dev: { preset: 'sim', watch: true },
      device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'mimic' },
    }));
    this.bot = new Mimic(opts.persona ?? YOU, seed, opts.dice);
    this.io = {
      tap: (x, y, r) => rec.tap(x, y, r),
      pick: (id, rep) => rec.pick(id, rep),
      flow: (v) => rec.flow(v),
      formation: (id) => rec.formation(id),
      pace: (v) => rec.pace(v),
    };
  }

  get done(): boolean {
    return this.game.phase === 'lost' || this.game.phase === 'won' || this.guard >= 60 * 60 * 40;
  }

  /** Play up to `steps` sim steps; true once the game is over. */
  advance(steps: number): boolean {
    for (let n = 0; n < steps && !this.done; n++, this.guard++) {
      this.bot.act(this.game, this.io);
      step(this.game, SIM_DT);
    }
    return this.done;
  }

  finish(): PlayLog {
    const g = this.game;
    return this.rec.finish(g.phase === 'won' ? 'won' : g.phase === 'lost' ? 'lost' : 'quit');
  }

  /** What the ghost check shows and stores. */
  result(): GhostResult {
    const g = this.game;
    return { bot: this.bot.persona.id, wave: g.wave, lost: g.lost, score: g.score, cleared: g.cleared, lostByWave: lostByWave(g) };
  }
}

/** Ships sunk by the end of each wave played: index = wave − 1 (−1 for a
 *  wave not played, as the dev stride skips some). */
export function lostByWave(g: Game): number[] {
  const out: number[] = [];
  for (const h of g.history) {
    while (out.length < h.wave - 1) out.push(-1);
    out[h.wave - 1] = h.lost;
  }
  return out;
}

/** A whole bot game, recorded: the fitting tools and tests. */
export function playMimic(
  map: MapId,
  seed: number,
  opts: { persona?: Persona; firstWave?: number; tempo?: Tempo; build?: string; dice?: number; armory?: ArmoryLevels } = {},
): { game: Game; log: PlayLog } {
  const run = new BotRun(map, seed, opts);
  run.advance(Infinity);
  return { game: run.game, log: run.finish() };
}

// The personalities (round 12): you on a different day. Each is the fitted
// "you" with a few knobs moved, so they share your hands and habits and
// differ where that kind of player differs. tools/v2/taxonomy.ts checks that
// each one is recognisably itself (docs/design/v2-bot-taxonomy.md).
const scaleR = (k: number, sigma = YOU.react.sigma) => ({ median: YOU.react.median * k, sigma });
const scaleP = (k: number, sigma = YOU.pause.sigma) => ({ median: YOU.pause.median * k, sigma });

export const TRYHARD: Persona = {
  ...YOU,
  id: 'tryhard',
  label: 'Try-hard',
  blurb: 'Locked in at 1×: quick eyes, both thumbs, goes for whatever lands first, never wastes a shot, never looks away.',
  speed: 1,
  react: scaleR(0.75, 0.3),
  reactBy: { ...YOU.reactBy, supersonic: 1 },
  aim: { ...YOU.aim, near: 18, far: 45, farShare: 0.08 },
  urgent: 0.35,
  panic: 1.2,
  panicShare: 1,
  hop: 0.6,
  coverSense: 0.85,
  waitDry: 0.85,
  dryStop: 0.6,
  twoThumb: 0.15,
  mood: 0.08,
  lapse: undefined,
  fatigue: 0,
  pickup: 3,
  rush: undefined,
};

export const CASUAL: Persona = {
  ...YOU,
  id: 'casual',
  label: 'Casual',
  blurb: 'Relaxed at 1×: slower to react, short bursts with long rests, loose aim, rarely chases what lands first.',
  speed: 1,
  react: scaleR(1.35),
  burst: [0.45, 0.3, 0.15, 0.07, 0.03],
  pause: scaleP(1.6),
  aim: { ...YOU.aim, near: 28, far: 85, farShare: 0.22 },
  urgent: 0.05,
  panicShare: 0.35,
  coverSense: 0.25,
  twoThumb: 0,
  mood: 0.3,
  lapse: { perMin: 0.3, median: 4, sigma: 0.4 },
  pickup: 1.2,
  flow: [{ step: 3, weight: 1 }],
  rush: undefined,
};

export const DISTRACTED: Persona = {
  ...YOU,
  id: 'distracted',
  label: 'Distracted',
  blurb: 'You, half watching: looks away for several seconds about twice a minute and comes back a beat slow.',
  react: scaleR(1.45),
  mood: 0.45,
  lapse: { perMin: 2, median: 8, sigma: 0.45 },
};

export const RUSHER: Persona = {
  ...YOU,
  id: 'rusher',
  label: 'Rusher',
  blurb: 'Speed slider at 2× to get it over with: long fast bursts, sloppy aim, taps straight through an empty rack.',
  speed: 2,
  burst: [0.1, 0.15, 0.18, 0.17, 0.14, 0.11, 0.08, 0.07],
  burstGap: [0.11, 0.15],
  pause: scaleP(0.6),
  aim: { ...YOU.aim, near: 30, far: 90, farShare: 0.25 },
  coverSense: 0.1,
  waitDry: 0.1,
  dryStop: 0.05,
  lapse: undefined,
  rush: undefined,
};

export const MASHER: Persona = {
  ...YOU,
  id: 'masher',
  label: 'Masher',
  blurb: 'Taps everything, all the time: no aiming to speak of, no looking at the rack, the same threat five times over.',
  burst: [0.03, 0.05, 0.1, 0.15, 0.17, 0.17, 0.14, 0.1, 0.09],
  burstGap: [0.09, 0.13],
  pause: scaleP(0.45, 0.5),
  aim: { ...YOU.aim, near: 36, far: 100, farShare: 0.3 },
  urgent: 0.05,
  hop: 0.1,
  coverSense: 0,
  waitDry: 0,
  dryStop: 0,
  stopOnKill: 0.1,
};

export const SNIPER: Persona = {
  ...YOU,
  id: 'sniper',
  label: 'Sniper',
  blurb: 'Takes its time: one careful tap at a time, dead on target, waits for the reload, never doubles up on a covered threat.',
  speed: 1,
  burst: [0.75, 0.2, 0.05],
  react: scaleR(1.2),
  pause: scaleP(1.1),
  aim: { ...YOU.aim, near: 13, far: 28, farShare: 0.05, lag: 0 },
  aimBy: {},
  urgent: 0.4,
  panicShare: 1,
  hop: 0.7,
  coverSense: 0.95,
  waitDry: 0.95,
  dryStop: 0.95,
  twoThumb: 0,
  rush: undefined,
};

export const NOVICE: Persona = {
  ...YOU,
  id: 'novice',
  label: 'Novice',
  blurb: 'First time playing: slow to spot threats, aims behind them, misses pickups, takes any card, leaves the ships alone.',
  speed: 1,
  react: scaleR(1.7, 0.6),
  reactBy: {},
  aim: { near: 34, far: 110, farShare: 0.3, lag: 0.15 },
  aimBy: { ballistic: 1.5 },
  urgent: 0,
  panic: 0.6,
  panicShare: 0.3,
  hop: 0.1,
  coverSense: 0,
  twoThumb: 0,
  pickup: 0.5,
  flow: [
    { step: 1, weight: 1 },
    { step: 2, weight: 1 },
  ],
  formation: { from: 1, to: 0, options: [{ id: 'box', weight: 1 }] },
  cards: 'random',
  rush: undefined,
};

export const TIRED: Persona = {
  ...YOU,
  id: 'tired',
  label: 'Tired',
  blurb: 'You at the end of a long day: starts fine, then reactions and rests stretch out and the look-aways come more often as the run goes on.',
  fatigue: 1.5,
  pause: scaleP(1.15),
  lapse: { perMin: 0.25, median: 3.5, sigma: 0.35, grow: 2 },
};

/** Settings order: you first, then by how hard they play. */
export const PERSONA_ORDER = ['you', 'tryhard', 'sniper', 'casual', 'tired', 'distracted', 'rusher', 'masher', 'novice'] as const;

export const PERSONAS: Record<string, Persona> = Object.fromEntries(
  [YOU, TRYHARD, CASUAL, DISTRACTED, RUSHER, MASHER, SNIPER, NOVICE, TIRED, YOU_V1].map((p) => [p.id, p]),
);
// Weapon ids the taste list may name must exist.
for (const p of Object.values(PERSONAS)) for (const id of p.taste) if (!(id in ABILITIES)) throw new Error(`persona ${p.id} names unknown ability ${id}`);
