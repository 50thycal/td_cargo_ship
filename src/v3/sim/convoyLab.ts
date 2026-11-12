// THE CONVOY EXPERIMENT (docs/design/v3-map-convoy-lab-plan.md, §6.1 and
// §8): the same map, seed, bot and Armory played under each convoy policy,
// and what came of it, with every number beside what it is out of.
//
// Two kinds of trial, never mixed in one table:
//   fixed    every policy sails ships on the map's schedule, and no run ends
//            on ships lost, so each plays the same waves with the same ships
//            asked of it. What differs is the policy alone.
//   natural  each policy under its own rules and the game's own loss limit
//            (today's controls keep their flow slider and its score).
//
// Pure: no DOM, no files (tools/v3/map-lab/run.ts prints and saves).

import { CONVOY_REV, type ConvoyPolicy, type ConvoySetup, type Obligation } from '../data/convoy';
import type { ArmoryLevels } from '../data/armory';
import { RULES } from '../data/config';
import type { MapId } from '../data/maps';
import type { PilotSkill } from './convoyPilot';
import type { EncounterSetup } from '../data/encounters';
import { ALL, summarize, type RunData } from './mapAnalytics';
import { PERSONAS, playMimic } from './mimic';
import type { PlayLog } from './playlog';
import { reconcile } from './telemetry';
import { replay } from './playlog';

export interface TrialSpec {
  map: MapId;
  seed: number;
  policy: ConvoyPolicy;
  obligation: Obligation;
  pilot: PilotSkill;
  persona: string;
  armory: ArmoryLevels;
  /** A flow step in place of the map's schedule. */
  flow?: number;
  /** No shooting: the geometry and the commands alone. */
  undefended?: boolean;
  firstWave?: number;
  tune?: ConvoySetup['tune'];
  /** Authored encounters on (slice 5), or the shared waves alone. */
  encounters?: EncounterSetup;
}

export interface Trial {
  spec: TrialSpec;
  /** How it ended, the wave it reached, and seconds of play. */
  end: 'won' | 'lost' | 'quit';
  wave: number;
  seconds: number;
  /** Ships: groups the schedule called for, ships that sailed, were
   *  delivered, sunk, still afloat at the end, and groups still held. */
  scheduled: number;
  sailed: number;
  delivered: number;
  sunk: number;
  afloat: number;
  owed: number;
  hpShip: number;
  hpCarrier: number;
  carrierLeft: number;
  shipMinutes: number;
  /** Ship hull lost per ship-minute afloat (null: too little traffic). */
  risk: number | null;
  score: number;
  kills: number;
  shots: number;
  dry: number;
  /** Commands accepted, by command, and refused. */
  commands: Record<string, number>;
  refused: number;
  /** The longest a held group waited (s). */
  waited: number;
  /** Telemetry that did not add up to the game (none in a healthy build). */
  problems: string[];
  log: PlayLog;
}

export function specName(s: TrialSpec): string {
  return `${s.map}/${s.policy}${s.policy === 'tactical' ? `:${s.pilot}` : ''}/${s.obligation}${s.flow !== undefined ? `/flow${s.flow}` : ''}${s.undefended ? '/undefended' : ''}${s.encounters ? `/enc${s.encounters.rev}` : ''}/${s.persona}`;
}

/** One run under a spec: played by the bot, replayed with telemetry. */
export function runTrial(spec: TrialSpec): Trial {
  const convoy: ConvoySetup = { policy: spec.policy, obligation: spec.obligation, rev: CONVOY_REV, ...(spec.flow !== undefined ? { flow: spec.flow } : {}), ...(spec.tune ? { tune: spec.tune } : {}) };
  const { log } = playMimic(spec.map, spec.seed, {
    persona: PERSONAS[spec.persona],
    armory: spec.armory,
    firstWave: spec.firstWave ?? 1,
    convoy,
    pilot: spec.policy === 'tactical' ? spec.pilot : 'never',
    undefended: spec.undefended,
    // Equal obligations: no run ends on ships lost.
    ...(spec.obligation === 'fixed' ? { tempo: { waveLen: 1, stride: 1, lossLimit: 999 } } : {}),
    ...(spec.encounters ? { encounters: spec.encounters } : {}),
    build: 'convoy-lab',
  });
  const g = replay(log, { telemetry: true });
  const sc = g.tel!.sidecar(g);
  const run: RunData = { id: log.id, label: specName(spec), sidecar: sc };
  const s = summarize([run], ALL);
  const commands: Record<string, number> = {};
  let refused = 0;
  for (const e of sc.events) {
    if (e.k !== 'cmd') continue;
    if (e.ok) commands[e.what] = (commands[e.what] ?? 0) + 1;
    else if (e.why !== 'same') refused += 1;
  }
  const c = g.convoy!;
  return {
    spec,
    end: log.end ?? 'quit',
    wave: g.wave,
    seconds: Math.round(g.t),
    scheduled: c.scheduled,
    sailed: s.sailed,
    delivered: s.delivered,
    sunk: s.sunk,
    afloat: g.ships.length,
    owed: c.owed,
    hpShip: s.hpShip,
    hpCarrier: s.hpCarrier,
    carrierLeft: g.carrierHp,
    shipMinutes: s.shipMinutes,
    risk: s.risk,
    score: g.score,
    kills: s.kills,
    shots: s.taps.fire,
    dry: s.taps.dry,
    commands,
    refused,
    waited: Math.round(c.waited * 10) / 10,
    problems: reconcile(sc, g),
    log,
  };
}

export interface Cohort {
  name: string;
  n: number;
  /** Each number as mean, least and most over the seeds. */
  m: Record<string, { mean: number; min: number; max: number }>;
  /** Runs that reached the last wave, and that ended with the carrier sunk. */
  finished: number;
  trials: Trial[];
}

const NUMS: [string, (t: Trial) => number][] = [
  ['wave', (t) => t.wave],
  ['seconds', (t) => t.seconds],
  ['scheduled', (t) => t.scheduled],
  ['sailed', (t) => t.sailed],
  ['delivered', (t) => t.delivered],
  ['sunk', (t) => t.sunk],
  ['hpShip', (t) => t.hpShip],
  ['hpCarrier', (t) => t.hpCarrier],
  ['shipMinutes', (t) => t.shipMinutes],
  ['risk', (t) => t.risk ?? 0],
  ['deliveredShare', (t) => (t.sailed ? t.delivered / t.sailed : 0)],
  ['score', (t) => t.score],
  ['shots', (t) => t.shots],
  ['commands', (t) => Object.entries(t.commands).filter(([k]) => k !== 'release').reduce((a, [, v]) => a + v, 0)],
  ['refused', (t) => t.refused],
  ['owed', (t) => t.owed],
];

export function cohort(name: string, trials: Trial[]): Cohort {
  const m: Cohort['m'] = {};
  for (const [k, f] of NUMS) {
    const v = trials.map(f);
    m[k] = { mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), min: Math.min(...v), max: Math.max(...v) };
  }
  return { name, n: trials.length, m, finished: trials.filter((t) => t.wave >= RULES.wavesToClear).length, trials };
}

/** One cohort against another on the same seeds: the mean of the
 *  seed-by-seed differences, and on how many seeds `b` was the lower. */
export function paired(a: Cohort, b: Cohort, f: (t: Trial) => number): { mean: number; lower: number; n: number } {
  let sum = 0;
  let lower = 0;
  let n = 0;
  for (const ta of a.trials) {
    const tb = b.trials.find((o) => o.spec.seed === ta.spec.seed);
    if (!tb) continue;
    const d = f(tb) - f(ta);
    sum += d;
    if (d < 0) lower += 1;
    n += 1;
  }
  return { mean: n ? sum / n : 0, lower, n };
}
