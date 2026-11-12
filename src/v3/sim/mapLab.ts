// THE MAP & CONVOY LAB'S BASELINE AND CHECKS (docs/design/
// v3-map-convoy-lab-plan.md, slices 0 and 1; what they found is in
// docs/design/v3-map-lab-slice0-1.md).
//
// - The baseline: twelve fixed runs on the three reference maps (The
//   Strait, The Gauntlet, Harbor Mouth): whole campaigns, the map's event
//   on its own, and the Siren Field bonus wave. Each is a recipe (map, seed,
//   bot, Armory, first wave) and, kept in tests/v3/fixtures/map-lab/, the
//   play log it made and what that log replays to.
// - The checks every slice's gate asks for: a game plays the same with
//   telemetry on and off (step by step), a log replays to the run that made
//   it, and the telemetry adds up to the game.
//
// Pure: no DOM, no files (tools/v3/map-lab/run.ts reads and writes them).

import type { ArmoryLevels } from '../data/armory';
import type { MapId } from '../data/maps';
import { step, type Game } from './game';
import { PERSONAS, playMimic } from './mimic';
import { LOG_VERSION, Playback, SIM_DT, logTelemetry, replay, type PlayLog } from './playlog';
import { contentHash, hashText, mapHash, pickupsOpen, reconcile, sidecarDigest, type TelemetrySidecar } from './telemetry';
import { MAPS } from '../data/maps';

/** The three maps the lab works on first. */
export const REFERENCE_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor'];

export interface BaselineRecipe {
  id: string;
  map: MapId;
  seed: number;
  /** The bot at the controls (sim/mimic.ts): `you` is the persona fitted to
   *  the player's own logs, `tryhard` a sharper day. */
  persona: 'you' | 'tryhard';
  armory: ArmoryLevels;
  firstWave: number;
  /** What the run is there to cover. */
  covers: string;
}

const KIT: ArmoryLevels = { warhead: 3 };

/** The fixed runs. The seeds were picked so that between them every map
 *  has normal waves, its own event (all three runs where the bot lives)
 *  and the bonus wave. A run that starts at wave 6 or 11 is handed the
 *  weapons the skip-ahead drafts, as `?wave=N` does. */
export const BASELINE: BaselineRecipe[] = [
  { id: 'strait-campaign-tryhard', map: 'strait', seed: 101, persona: 'tryhard', armory: KIT, firstWave: 1, covers: 'waves 1-10, then Afterburner Rush runs 1-3 (a won map)' },
  { id: 'strait-campaign-you', map: 'strait', seed: 102, persona: 'you', armory: {}, firstWave: 1, covers: 'waves 1-10 and the event with the base gun, six ships lost before the restore' },
  { id: 'strait-event', map: 'strait', seed: 201, persona: 'tryhard', armory: KIT, firstWave: 11, covers: 'Afterburner Rush on its own, runs 1-3' },
  { id: 'strait-bonus', map: 'strait', seed: 8, persona: 'tryhard', armory: KIT, firstWave: 6, covers: 'Siren Field after wave 6 (two passives held), then waves 7-13' },
  { id: 'gauntlet-campaign-tryhard', map: 'gauntlet', seed: 103, persona: 'tryhard', armory: KIT, firstWave: 1, covers: 'waves 1-10, then Rocket Convoy run 1 and a loss in run 2' },
  { id: 'gauntlet-campaign-you', map: 'gauntlet', seed: 102, persona: 'you', armory: {}, firstWave: 1, covers: 'waves 1-10 with the base gun (lost on wave 10)' },
  { id: 'gauntlet-event', map: 'gauntlet', seed: 202, persona: 'tryhard', armory: KIT, firstWave: 11, covers: 'Rocket Convoy on its own (lost in run 2)' },
  { id: 'gauntlet-bonus', map: 'gauntlet', seed: 20, persona: 'tryhard', armory: KIT, firstWave: 6, covers: 'Siren Field after wave 6, then waves 7-13 (a won map)' },
  { id: 'harbor-campaign-tryhard', map: 'harbor', seed: 103, persona: 'tryhard', armory: KIT, firstWave: 1, covers: 'waves 1-10 (lost on wave 10)' },
  { id: 'harbor-campaign-you', map: 'harbor', seed: 103, persona: 'you', armory: {}, firstWave: 1, covers: 'waves 1-8 with the base gun (lost on wave 8)' },
  { id: 'harbor-event', map: 'harbor', seed: 201, persona: 'tryhard', armory: KIT, firstWave: 11, covers: 'The Breakout on its own, runs 1-3' },
  { id: 'harbor-bonus', map: 'harbor', seed: 20, persona: 'tryhard', armory: KIT, firstWave: 6, covers: 'Siren Field after wave 6, then waves 7-10 (lost on wave 10)' },
];

/** Play a recipe: the bot's game and the log of it. The log's id and date
 *  are fixed, so the same recipe makes the same bytes. */
export function playRecipe(r: BaselineRecipe): { game: Game; log: PlayLog } {
  const { game, log } = playMimic(r.map, r.seed, { persona: PERSONAS[r.persona], armory: r.armory, firstWave: r.firstWave, build: 'baseline' });
  const fixed: PlayLog = { ...log, id: `v3-baseline-${r.id}`, endedAt: new Date(0).toISOString(), dev: { preset: 'baseline', watch: true, bot: r.persona } };
  return { game, log: fixed };
}

/** What a baseline run replays to: enough to tell two builds apart. */
export interface BaselineResult {
  id: string;
  logVersion: number;
  mapHash: string;
  contentHash: string;
  /** The log itself (its commands), the game it replays to, and the
   *  telemetry of that replay, each as a hash. */
  logHash: string;
  stateHash: string;
  telemetryHash: string;
  end: PlayLog['end'];
  wave: number;
  steps: number;
  seconds: number;
  score: number;
  delivered: number;
  lost: number;
  carrierHp: number;
  shots: number;
  commands: number;
  /** The run's stretches: "6", "6+siren-field=clean", "11:rush#1=clean". */
  phases: string[];
  events: number;
  samples: number;
  hits: number;
  hpShip: number;
  hpCarrier: number;
  pickups: { spawned: number; collected: number; expired: number; cleared: number; open: number };
}

/** A run's stretches as short words (for the manifest and the report). */
export function phaseWords(sc: TelemetrySidecar): string[] {
  return sc.phases.map((p) => {
    const what = p.kind === 'wave' ? `${p.wave}` : p.kind === 'bonusEvent' ? `${p.wave}+${p.event}` : `${p.wave}:${p.event}#${p.run}`;
    return `${what}${p.grade ? `=${p.grade}` : ''}${p.end === 'lost' ? ' (lost)' : ''}`;
  });
}

/** The whole of a game that the sim reads, as text: everything but its
 *  seeded RNG streams (closed over: `rngPrint` covers those), its telemetry
 *  and the map (fixed data). */
export function stateText(g: Game): string {
  return JSON.stringify(g, (key, v) => {
    if (key === 'tel' || key === 'rng' || key === 'map') return undefined;
    if (v instanceof Set) return [...v];
    return v;
  });
}

export function stateHash(g: Game): string {
  return hashText(stateText(g));
}

/** The next number from each of a game's RNG streams. It moves them on, so
 *  only when a game is done with: two games whose streams were drawn from
 *  the same number of times print the same. */
export function rngPrint(g: Game): string {
  return (Object.keys(g.rng) as (keyof Game['rng'])[]).map((k) => `${k}:${g.rng[k].next()}`).join(' ');
}

/** A cheap number that moves when anything on the board does: compared
 *  every step, with the full state every `every` steps. */
function boardSum(g: Game): number {
  let n = g.steps + g.score * 3 + g.lost * 7 + g.delivered * 11 + g.carrierHp * 13 + g.ammo * 17 + g.shots * 19 + g.nextId * 23 + g.wave * 29 + g.threats.length * 31 + g.ships.length * 37 + g.pickups.length * 41 + g.interceptors.length * 43 + g.t;
  for (const s of g.ships) n += s.x + s.y * 1.3 + s.hp * 5 + s.id;
  for (const t of g.threats) n += t.x * 1.7 + t.y * 1.9 + t.hp * 3 + t.id;
  for (const p of g.pickups) n += p.x + p.y + p.age + p.id;
  return n;
}

export interface LockstepResult {
  /** Steps played and compared. */
  steps: number;
  /** Full-state comparisons made (every `every` steps and at the end). */
  fullChecks: number;
  /** The first step the two games differed at, or -1. */
  divergedAt: number;
  /** Did both draw the same number of times from every RNG stream? */
  rngSame: boolean;
  stateHash: string;
  sidecar: TelemetrySidecar;
  /** The game played with telemetry on. */
  game: Game;
}

/** Observational equivalence: plays a log twice side by side, one game
 *  with telemetry and one without, and compares them every step. */
export function lockstep(log: PlayLog, every = 300): LockstepResult {
  const a = new Playback(log, 0, { telemetry: true });
  const b = new Playback(log, 0);
  let divergedAt = -1;
  let fullChecks = 0;
  let steps = 0;
  for (let n = 0; n < 10_000_000; n++) {
    const ra = a.advance();
    const rb = b.advance();
    steps = a.game.steps;
    if (ra !== rb || boardSum(a.game) !== boardSum(b.game)) {
      divergedAt = a.game.steps;
      break;
    }
    if (a.game.steps % every === 0 || !ra) {
      fullChecks += 1;
      if (stateText(a.game) !== stateText(b.game)) {
        divergedAt = a.game.steps;
        break;
      }
    }
    if (!ra) break;
  }
  const sidecar = a.game.tel!.sidecar(a.game);
  const hash = stateHash(a.game);
  const rngSame = rngPrint(a.game) === rngPrint(b.game);
  return { steps, fullChecks, divergedAt, rngSame, stateHash: hash, sidecar, game: a.game };
}

/** The same check for a game no log drives: two games made the same way,
 *  each played by its own copy of the same bot (sim/bot.ts: it also holds,
 *  swipes and flings the gesture weapons), one with telemetry. `act` plays
 *  one game's inputs for a step. */
export function lockstepLive(
  make: () => Game,
  player: () => (g: Game) => void,
  o: { steps: number; every?: number; until?: (g: Game) => boolean } = { steps: 60 * 60 },
): LockstepResult {
  const a = make();
  const b = make();
  logTelemetry(a, { id: 'lockstep', build: 'test', v: LOG_VERSION, firstWave: a.wave, ...(a.lab ? { lab: a.lab.setup } : {}), device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'bot' } }, a.lab ? 'lab' : 'sim', 'bot');
  const pa = player();
  const pb = player();
  const every = o.every ?? 300;
  let divergedAt = -1;
  let fullChecks = 0;
  for (let n = 0; n < o.steps; n++) {
    pa(a);
    pb(b);
    if (a.phase !== 'wave' || b.phase !== 'wave' || o.until?.(a)) break;
    step(a, SIM_DT);
    step(b, SIM_DT);
    if (boardSum(a) !== boardSum(b)) {
      divergedAt = a.steps;
      break;
    }
    if (a.steps % every === 0) {
      fullChecks += 1;
      if (stateText(a) !== stateText(b)) {
        divergedAt = a.steps;
        break;
      }
    }
  }
  fullChecks += 1;
  if (divergedAt < 0 && stateText(a) !== stateText(b)) divergedAt = a.steps;
  const sidecar = a.tel!.sidecar(a);
  const hash = stateHash(a);
  const rngSame = rngPrint(a) === rngPrint(b);
  return { steps: a.steps, fullChecks, divergedAt, rngSame, stateHash: hash, sidecar, game: a };
}

/** A log's inputs as a hash (what replay reads of it). */
export function logHash(log: PlayLog): string {
  return hashText(JSON.stringify([log.v, log.map, log.seed, log.firstWave, log.tempo ?? null, log.armory, log.freePlay ?? null, log.lab ?? null, log.commands]));
}

/** Replay a log with telemetry and say what it came to. */
export function baselineResult(id: string, log: PlayLog): { result: BaselineResult; game: Game; sidecar: TelemetrySidecar; problems: string[] } {
  const game = replay(log, { telemetry: true });
  const sidecar = game.tel!.sidecar(game);
  const problems = reconcile(sidecar, game);
  const p = sidecar.totals.pickups;
  const result: BaselineResult = {
    id,
    logVersion: LOG_VERSION,
    mapHash: mapHash(MAPS[log.map]),
    contentHash: contentHash(),
    logHash: logHash(log),
    stateHash: stateHash(game),
    telemetryHash: sidecarDigest(sidecar),
    end: log.end,
    wave: game.wave,
    steps: game.steps,
    seconds: Math.round(game.t * 10) / 10,
    score: game.score,
    delivered: game.delivered,
    lost: game.lost,
    carrierHp: game.carrierHp,
    shots: game.shots,
    commands: log.commands.length,
    phases: phaseWords(sidecar),
    events: sidecar.events.length,
    samples: sidecar.samples.length,
    hits: sidecar.totals.hits,
    hpShip: sidecar.totals.hpShip,
    hpCarrier: sidecar.totals.hpCarrier,
    pickups: { spawned: p.spawned, collected: p.collected, expired: p.expired, cleared: p.cleared, open: pickupsOpen(sidecar) },
  };
  return { result, game, sidecar, problems };
}

/** What differs between a stored baseline result and a fresh one, in words
 *  (none: this build replays the baseline exactly). */
export function baselineDiff(was: BaselineResult, now: BaselineResult): string[] {
  const out: string[] = [];
  for (const k of Object.keys(now) as (keyof BaselineResult)[]) {
    const a = JSON.stringify(was[k]);
    const b = JSON.stringify(now[k]);
    if (a !== b) out.push(`${k}: was ${a}, now ${b}`);
  }
  return out;
}
