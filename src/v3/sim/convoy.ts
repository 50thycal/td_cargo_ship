// CONVOY POLICIES AND TACTICAL COMMANDS in the sim (data/convoy.ts has the
// policies, the commands' numbers and which map has which). LAB ONLY: a
// game with no convoy setup (`g.convoy === null`, every campaign run) plays
// exactly as before, and nothing here runs.
//
// game.ts calls in at: the flow and formation commands (may the player?),
// the convoy's speed and the formation's traits (Rush, Disperse), the
// spawner (Hold), each step (the clocks), the wave's end (a Hold is
// released), and `convoyCommand` (a recorded input, 'k'). Pure and
// deterministic like the rest of the sim: no RNG at all.

import { CONVOY, CONVOY_REV, mapConvoy, type CommandId, type ConvoySetup, type MapConvoy } from '../data/convoy';
import { FLOW_STEPS } from '../data/config';
import { FORMATIONS, type FormationDef } from '../data/formations';
import type { Game } from './game';

export interface ConvoyState {
  setup: ConvoySetup;
  def: MapConvoy;
  /** Rush: seconds left at speed, then seconds left coasting. */
  rushT: number;
  coastT: number;
  disperseT: number;
  /** Hold: on, seconds so far, and groups waiting off the entry. */
  holding: boolean;
  holdT: number;
  owed: number;
  /** Seconds until each command can be given again. */
  cool: Record<CommandId, number>;
  /** The ledger: groups the schedule called for, groups that sailed,
   *  groups held at some point, and the longest any waited (s). */
  scheduled: number;
  released: number;
  held: number;
  waited: number;
  /** Commands given, by command, and refused. */
  used: Record<CommandId, number>;
  refused: number;
}

export type CommandWhy = 'policy' | 'fixed' | 'cooldown' | 'busy' | 'none' | 'same';
export interface CommandResult {
  ok: boolean;
  why?: CommandWhy;
}

const tune = (g: Game) => g.convoy?.setup.tune ?? {};
const rushSpeed = (g: Game) => tune(g).rushSpeed ?? CONVOY.rush.speed;
const rushTime = (g: Game) => tune(g).rushTime ?? CONVOY.rush.time;
const holdMax = (g: Game) => tune(g).holdMax ?? CONVOY.hold.max;
/** The coast pays back what the rush gained: the same distance in the end. */
const coastTime = (g: Game) => ((rushSpeed(g) - 1) * rushTime(g)) / (1 - CONVOY.rush.coastSpeed);

/** Puts a game under a policy (after it is created, before its first
 *  step). The map's schedule and formation take over where the policy says. */
export function applyConvoy(g: Game, setup: ConvoySetup): void {
  const def = mapConvoy(g.map.id);
  const flow = Math.max(0, Math.min(FLOW_STEPS.length - 1, setup.flow ?? def.flow));
  g.convoy = {
    setup: { ...setup, rev: setup.rev ?? CONVOY_REV },
    def: { ...def, flow },
    rushT: 0,
    coastT: 0,
    disperseT: 0,
    holding: false,
    holdT: 0,
    owed: 0,
    cool: { rush: 0, disperse: 0, hold: 0 },
    scheduled: 0,
    released: 0,
    held: 0,
    waited: 0,
    used: { rush: 0, disperse: 0, hold: 0 },
    refused: 0,
  };
  // The map's schedule, unless this is today's controls played naturally.
  if (flowLocked(g)) g.flow = flow;
  if (formationLocked(g)) g.formation = def.formation;
}

/** Is the flow the map's (not the player's)? Under every policy but
 *  today's controls; and under those too when the schedule is fixed. */
export function flowLocked(g: Game): CommandWhy | null {
  const c = g.convoy;
  if (!c) return null;
  if (c.setup.policy !== 'current') return 'policy';
  return c.setup.obligation === 'fixed' ? 'fixed' : null;
}

/** Is the formation the map's? Under Automatic and Tactical. */
export function formationLocked(g: Game): CommandWhy | null {
  const p = g.convoy?.setup.policy;
  return p === 'auto' || p === 'tactical' ? 'policy' : null;
}

/** The commands this run may give (the map's, under Tactical). */
export function convoyCommands(g: Game): CommandId[] {
  return g.convoy?.setup.policy === 'tactical' ? g.convoy.def.commands : [];
}

/** How a command stands now, for its button: can it be given, is it
 *  running, and the seconds left on either clock. */
export function commandState(g: Game, id: CommandId): { ready: boolean; active: boolean; left: number; cool: number } {
  const c = g.convoy;
  if (!c || !convoyCommands(g).includes(id)) return { ready: false, active: false, left: 0, cool: 0 };
  const active = id === 'rush' ? c.rushT > 0 : id === 'disperse' ? c.disperseT > 0 : c.holding;
  const left = id === 'rush' ? c.rushT : id === 'disperse' ? c.disperseT : c.holding ? Math.max(0, holdMax(g) - c.holdT) : 0;
  const busy = id !== 'hold' && (id === 'rush' ? c.disperseT > 0 : c.rushT > 0);
  // A Hold that is on is always ready: the tap releases it.
  const ready = id === 'hold' && c.holding ? true : !active && !busy && c.cool[id] <= 0 && (id === 'hold' || g.ships.some((s) => !s.vip));
  return { ready, active, left, cool: Math.max(0, c.cool[id]) };
}

/** A convoy command (a recorded input). Hold toggles: given while holding,
 *  it releases. Refused, it changes nothing and says why. */
export function convoyCommand(g: Game, id: CommandId): CommandResult {
  const c = g.convoy;
  if (g.phase !== 'wave') return { ok: false, why: 'none' };
  const res = decide(g, id);
  if (g.tel) {
    const releasing = id === 'hold' && !!c?.holding && res.ok;
    // A Rush or a Disperse: the ships it took hold of. A Hold or its release: the groups waiting.
    g.tel.command(g, releasing ? 'release' : id, releasing ? 'player' : id, id === 'hold' ? (c?.owed ?? 0) : 'idle', res.ok, res.why, res.ok && id !== 'hold' ? g.ships.filter((s) => !s.vip).map((s) => s.id) : undefined);
  }
  if (!c) return res;
  if (!res.ok) {
    c.refused += 1;
    return res;
  }
  c.used[id] += 1;
  if (id === 'rush') {
    c.rushT = rushTime(g);
    c.coastT = coastTime(g);
    c.cool.rush = CONVOY.rush.cooldown;
  } else if (id === 'disperse') {
    c.disperseT = CONVOY.disperse.time;
    c.cool.disperse = CONVOY.disperse.cooldown;
  } else if (c.holding) release(g);
  else {
    c.holding = true;
    c.holdT = 0;
  }
  return res;
}

function decide(g: Game, id: CommandId): CommandResult {
  const c = g.convoy;
  if (!c || !convoyCommands(g).includes(id)) return { ok: false, why: 'policy' };
  if (id === 'hold' && c.holding) return { ok: true };
  if (c.cool[id] > 0) return { ok: false, why: 'cooldown' };
  // Rush and Disperse are one posture at a time.
  if ((id === 'rush' && c.disperseT > 0) || (id === 'disperse' && c.rushT > 0)) return { ok: false, why: 'busy' };
  if (id !== 'hold' && !g.ships.some((s) => !s.vip)) return { ok: false, why: 'none' };
  return { ok: true };
}

/** The Hold ends: the waiting groups sail (the spawner sends them one
 *  behind another as the entry clears), and the cooldown starts. */
function release(g: Game, why: 'max' | 'queue' | 'wave' | null = null): void {
  const c = g.convoy!;
  if (!c.holding) return;
  c.holding = false;
  c.waited = Math.max(c.waited, c.holdT);
  c.holdT = 0;
  c.cool.hold = CONVOY.hold.cooldown;
  // The player's own release was told of with the command; a forced one here.
  if (why && g.tel) g.tel.command(g, 'release', why, c.owed, true);
}

/** Each step: the commands' clocks. */
export function updateConvoy(g: Game, dt: number): void {
  const c = g.convoy;
  if (!c) return;
  for (const id of ['rush', 'disperse', 'hold'] as CommandId[]) if (c.cool[id] > 0) c.cool[id] = Math.max(0, c.cool[id] - dt);
  if (c.rushT > 0) c.rushT = Math.max(0, c.rushT - dt);
  else if (c.coastT > 0) c.coastT = Math.max(0, c.coastT - dt);
  if (c.disperseT > 0) c.disperseT = Math.max(0, c.disperseT - dt);
  if (c.holding) {
    c.holdT += dt;
    // No waiting a barrage out for good: the Hold ends by itself.
    if (c.holdT >= holdMax(g)) release(g, 'max');
  }
}

/** The convoy's speed under a Rush (and the coast after) or a Disperse. */
export function convoySpeed(g: Game): number {
  const c = g.convoy;
  if (!c) return 1;
  if (c.rushT > 0) return rushSpeed(g);
  if (c.coastT > 0) return CONVOY.rush.coastSpeed;
  if (c.disperseT > 0) return CONVOY.disperse.speed;
  return 1;
}

const dispersed = new Map<FormationDef, FormationDef>();

/** The formation in force: the run's own, or (dispersed) the same hulls
 *  opened out across the lane, where a blast reaches one hull only and
 *  splash weapons do half damage. */
export function formationNow(g: Game): FormationDef {
  const f = FORMATIONS[g.formation];
  if (!g.convoy || g.convoy.disperseT <= 0) return f;
  let d = dispersed.get(f);
  if (!d) {
    const D = CONVOY.disperse;
    // (A single file has nowhere to open out to: it keeps its line and takes the blast's cut alone.)
    d = { ...f, offsets: f.offsets.map((o) => Math.max(-D.limit, Math.min(D.limit, o * D.widen))), splash: 0, blastCut: 0.5, armor: 0 };
    dispersed.set(f, d);
  }
  return d;
}

/** The spawner asks: a group is due; may it sail now? While a Hold is on
 *  it waits off the entry (and is owed). False: it was deferred. */
export function groupDue(g: Game): boolean {
  const c = g.convoy;
  if (!c) return true;
  c.scheduled += 1;
  if (!c.holding) return true;
  c.owed += 1;
  c.held += 1;
  // The staging water is full: the Hold ends, and they all sail.
  if (c.owed >= CONVOY.hold.groups) release(g, 'queue');
  return false;
}

/** The spawner asks: is a held group waiting to sail (no Hold on)? */
export function groupOwed(g: Game): boolean {
  const c = g.convoy;
  return !!c && !c.holding && c.owed > 0;
}

export function groupSailed(g: Game, owed: boolean): void {
  const c = g.convoy;
  if (!c) return;
  c.released += 1;
  if (owed) c.owed -= 1;
}

/** The wave is over (or the ending's restore is here): a Hold never
 *  carries its ships past it. */
export function convoyWaveEnd(g: Game): void {
  if (g.convoy?.holding) release(g, 'wave');
}
