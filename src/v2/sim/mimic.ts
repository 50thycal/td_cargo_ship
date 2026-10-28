// The watch-mode bot (round 9): plays like the player, not like a machine.
// Fitted to the player's own logs with tools/v2/style.ts (numbers in
// docs/design/v2-watch-mode.md): taps come in bursts of ~3 a fifth of a
// second apart, land ~35 px off, keep coming while the rack is empty, and
// go to the most urgent threat only about half the time; the rest go to
// whatever is near the finger. Ship flow goes up early, the formation changes
// once, and cards stack: take a card, then level it up.
//
// It acts through `BotIO`, the same calls the player's touches make, so a
// watched run records an ordinary log that replays exactly. Its dice are
// its own (seeded from the game seed), so a seed always plays out the same.

import { MAX_SLOTS, UPGRADES, UPGRADE_ORDER, canTake, loadout, type UpgradeId } from '../data/upgrades';
import type { FormationId } from '../data/formations';
import type { MapId } from '../data/maps';
import { makeRng, type RNG } from '../../sim/rng';
import { canFire, createGame, step, timeToImpact, type Game, type TapResult, type Tempo, type Threat } from './game';
import { Recorder, SIM_DT, type PlayLog } from './playlog';

export interface Persona {
  id: string;
  /** Seconds from a threat appearing to the bot noticing it (log-normal). */
  react: { median: number; sigma: number };
  /** Taps per burst: weights for 1, 2, 3, … taps. */
  burst: number[];
  /** Seconds between taps inside a burst (uniform). */
  burstGap: [number, number];
  /** Seconds between bursts (log-normal). */
  pause: { median: number; sigma: number };
  /** Aim error: a 2-D normal of `near` px most of the time, `far` px for `farShare`. */
  aim: { near: number; far: number; farShare: number; lag: number };
  /** Share of bursts aimed at the most urgent threat (the rest: nearest the finger). */
  urgent: number;
  /** A threat this many seconds from impact gets the next burst whatever
   *  else is going on: the red reticle / lock line a person can't ignore. */
  panic: number;
  /** Chance a burst stops when its target goes down (the rest keep tapping
   *  where it was, as a thumb on the move does). */
  stopOnKill: number;
  /** Chance it notices the rack is empty (before a burst, or when a tap in
   *  one comes up dry) and waits for the reload instead of tapping on. */
  waitDry: number;
  /** Chance a noticed pickup gets a tap when the finger is free. */
  pickup: number;
  /** Flow step it turns the ships up to early in wave 1, with the odds of each. */
  flow: { step: number; weight: number }[];
  /** One formation change, in waves `from`–`to`. */
  formation: { from: number; to: number; options: { id: FormationId; weight: number }[] };
  /** New cards it likes, best first (it stacks whatever it already holds). */
  taste: UpgradeId[];
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
  taste: ['blast', 'twin', 'rhythm', 'frigate', 'smoke', 'proxfuse', 'chain', 'speed', 'reload'],
};

/** What the bot can do: exactly what a player's touches can. */
export interface BotIO {
  tap(x: number, y: number, radius: number): TapResult;
  pick(id: UpgradeId, replace?: UpgradeId): void;
  flow(step: number): void;
  formation(id: FormationId): void;
}

/** A finger on an iPhone in landscape reaches 44 CSS px, ~108 world units. */
export const BOT_TAP_RADIUS = 108;

export class Mimic {
  private rng: RNG;
  private noticeAt = new Map<number, number>();
  private finger = { x: 800, y: 450 };
  private target: number | null = null;
  private tapsLeft = 0;
  private nextTap = 0;
  private flowPlan: { at: number; steps: number[] } | null = null;
  private formationPlan: { wave: number; at: number; id: FormationId } | null = null;
  private start: number | null = null;

  constructor(
    readonly persona: Persona,
    seed: number,
  ) {
    this.rng = makeRng(seed ^ 0x0b07);
    const p = persona;
    const flow = weighted(this.rng, p.flow).step;
    this.flowPlan = { at: this.rng.range(2, 12), steps: Array.from({ length: flow - 1 }, (_, k) => k + 2) };
    const wave = p.formation.from + this.rng.int(p.formation.to - p.formation.from + 1);
    this.formationPlan = { wave, at: this.rng.range(3, 10), id: weighted(this.rng, p.formation.options).id };
  }

  /** The card it would take from the offer on screen. */
  choose(g: Game): { id: UpgradeId; replace?: UpgradeId } {
    const takeable = g.offer.filter((id) => canTake(g.levels, id));
    // Stack: level up the card it holds highest.
    const held = takeable.filter((id) => id !== 'resupply' && (g.levels[id] ?? 0) > 0);
    if (held.length) return { id: held.sort((a, b) => (g.levels[b] ?? 0) - (g.levels[a] ?? 0))[0] };
    const fresh = takeable.filter((id) => id !== 'resupply');
    if (fresh.length && loadout(g.levels).length < MAX_SLOTS) {
      const rank = (id: UpgradeId) => {
        const k = this.persona.taste.indexOf(id);
        return k < 0 ? 50 + (UPGRADE_ORDER as readonly string[]).indexOf(id) : k;
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
    this.rails(g, io);
    for (const th of g.threats) if (!this.noticeAt.has(th.id)) this.noticeAt.set(th.id, t + this.logNormal(this.persona.react));
    if (t < this.nextTap) return;
    const seen = g.threats.filter((th) => !th.dead && (this.noticeAt.get(th.id) ?? Infinity) <= t);

    if (this.tapsLeft > 0) {
      let th = seen.find((s) => s.id === this.target) ?? null;
      // Target gone mid-burst: often stop, else carry on at whatever is
      // under the finger.
      if (!th) {
        th = nearest(seen, this.finger, 150);
        if (!th && this.rng.chance(this.persona.stopOnKill)) {
          this.tapsLeft = 0;
          this.nextTap = t + this.logNormal(this.persona.pause);
          return;
        }
      }
      const r = this.tapAt(g, io, th);
      this.tapsLeft--;
      if (r === 'dry' && this.rng.chance(this.persona.waitDry)) this.tapsLeft = 0;
      this.nextTap = t + (this.tapsLeft > 0 ? this.rng.range(...this.persona.burstGap) : this.logNormal(this.persona.pause));
      return;
    }

    const pickup = g.pickups.find((pk) => pk.age > this.persona.react.median);
    if (pickup && this.rng.chance(this.persona.pickup * SIM_DT * 6)) {
      this.finger = { x: pickup.x, y: pickup.y };
      io.tap(pickup.x + this.rng.range(-12, 12), pickup.y + this.rng.range(-12, 12), BOT_TAP_RADIUS);
      this.nextTap = t + this.logNormal(this.persona.pause) * 0.5;
      return;
    }
    if (!seen.length) return;
    if (!canFire(g) && this.rng.chance(this.persona.waitDry)) {
      this.nextTap = t + 0.3;
      return;
    }
    const urgent = seen.reduce((a, b) => (timeToImpact(g, b) < timeToImpact(g, a) ? b : a));
    // Otherwise whatever catches the eye: any threat on screen, the ones
    // near the finger likelier.
    const pick = timeToImpact(g, urgent) < this.persona.panic || this.rng.chance(this.persona.urgent) ? urgent : this.glance(seen);
    this.target = pick.id;
    this.tapsLeft = 1 + weightedIndex(this.rng, this.persona.burst);
    this.nextTap = t;
    this.act(g, io, drafts);
  }

  private tapAt(g: Game, io: BotIO, th: Threat | null): TapResult {
    const a = this.persona.aim;
    const spread = this.rng.chance(a.farShare) ? a.far : a.near;
    const [ex, ey] = gauss2(this.rng, spread);
    // The finger lands where the threat was a moment ago.
    const x = th ? th.x - th.vx * a.lag : this.finger.x;
    const y = th ? th.y - th.vy * a.lag : this.finger.y;
    this.finger = { x, y };
    return io.tap(clamp(x + ex, 0, 1600), clamp(y + ey, 0, 900), BOT_TAP_RADIUS);
  }

  /** Ships up early in wave 1; one formation change a few waves in. */
  private rails(g: Game, io: BotIO): void {
    // Timed from the start of the run (game time), not the wave: a dev short
    // wave can be over before a per-wave timer comes due.
    this.start ??= g.t;
    const fp = this.flowPlan;
    if (fp && g.t - this.start >= fp.at) {
      const next = fp.steps.find((s) => s > g.flow);
      if (next === undefined) this.flowPlan = null;
      else {
        io.flow(next);
        fp.at = g.t - this.start + 0.1;
      }
    }
    const mp = this.formationPlan;
    if (mp && g.wave >= mp.wave && g.waveT >= mp.at) {
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

/** A whole bot game, recorded: the ghost check, and the fitting tools. */
export function playMimic(
  map: MapId,
  seed: number,
  opts: { persona?: Persona; firstWave?: number; tempo?: Tempo; build?: string } = {},
): { game: Game; log: PlayLog } {
  const g = createGame(map, seed, opts.firstWave ?? 1, opts.tempo);
  const rec = new Recorder(g, {
    build: opts.build ?? 'sim',
    startedAt: new Date(0).toISOString(),
    firstWave: opts.firstWave ?? 1,
    ...(opts.tempo ? { tempo: opts.tempo } : {}),
    dev: { preset: 'sim', watch: true },
    device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'mimic' },
  });
  const bot = new Mimic(opts.persona ?? YOU_V1, seed);
  const io: BotIO = {
    tap: (x, y, r) => rec.tap(x, y, r),
    pick: (id, rep) => rec.pick(id, rep),
    flow: (v) => rec.flow(v),
    formation: (id) => rec.formation(id),
  };
  for (let i = 0; i < 60 * 60 * 40 && g.phase !== 'lost' && g.phase !== 'won'; i++) {
    bot.act(g, io);
    step(g, SIM_DT);
  }
  return { game: g, log: rec.finish(g.phase === 'won' ? 'won' : g.phase === 'lost' ? 'lost' : 'quit') };
}

export const PERSONAS: Record<string, Persona> = { [YOU_V1.id]: YOU_V1 };
// Card ids the taste list may name must exist.
for (const id of YOU_V1.taste) if (!(id in UPGRADES)) throw new Error(`persona taste names unknown card ${id}`);
