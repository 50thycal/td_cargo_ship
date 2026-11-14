// CONVOY POLICIES AND TACTICAL COMMANDS in the sim (data/convoy.ts has the
// policies, the command's numbers and which map has it). LAB ONLY: a game
// with no convoy setup (`g.convoy === null`, every campaign run) plays
// exactly as before, and nothing here runs. Round 11 (rev 3) cut Rush and
// Disperse; Hold is the one command left.
//
// game.ts calls in at: the flow and formation commands (may the player?),
// each hull's pace (Hold: every ship eases to a stop), the spawner (the ledger),
// each step (the clocks), the wave's end (a Hold is released), and
// `convoyCommand` (a recorded input, 'k'). Pure and deterministic like the
// rest of the sim: no RNG at all.

import { CONVOY, CONVOY_REV, mapConvoy, type CommandId, type ConvoySetup, type MapConvoy } from '../data/convoy';
import { FLOW_STEPS } from '../data/config';
import { FORMATIONS, type FormationDef } from '../data/formations';
import type { Game, Ship } from './game';

export interface ConvoyState {
  setup: ConvoySetup;
  def: MapConvoy;
  /** Hold: on, seconds so far, and the hulls stopped now. */
  holding: boolean;
  holdT: number;
  owed: number;
  /** Seconds until each command can be given again. */
  cool: Record<CommandId, number>;
  /** The ledger: groups the schedule called for, groups that sailed,
   *  hulls held (counted at each release), and the longest a
   *  Hold lasted (s). */
  scheduled: number;
  released: number;
  held: number;
  waited: number;
  /** Commands given, by command, and refused. */
  used: Record<CommandId, number>;
  refused: number;
}

export type CommandWhy = 'policy' | 'fixed' | 'cooldown' | 'none' | 'same';

/** A refusal in words a player reads on the screen (round 9: the button
 *  shaking alone was not enough). */
export function refusalText(g: Game, id: CommandId, why: CommandWhy | undefined): string {
  const c = g.convoy;
  switch (why) {
    case 'cooldown':
      return `Ready again in ${Math.max(1, Math.ceil(c?.cool[id] ?? 0))} s`;
    case 'none':
      return 'No ships afloat';
    case 'policy':
    case 'fixed':
      return 'Not a command on this map';
    default:
      return 'Not now';
  }
}
export interface CommandResult {
  ok: boolean;
  why?: CommandWhy;
}

const tune = (g: Game) => g.convoy?.setup.tune ?? {};
const holdMax = (g: Game) => tune(g).holdMax ?? CONVOY.hold.max;

/** Does a Hold stop this hull? Rev 3 (round 11): every ship afloat but the
 *  supertanker, wherever it is. (Rev 2 stopped only the ships short of a
 *  hold line drawn across the lane.) */
function heldShip(s: Ship): boolean {
  return !s.vip;
}

/** A held hull's pace (its speed's share): easing from full to still over
 *  `CONVOY.hold.ease` s of the Hold, so every ship can be seen to stop at
 *  once, and still until the release. A ship that comes in during a Hold
 *  waits at the entry. 1 for every other hull. */
export function holdPace(g: Game, s: Ship): number {
  const c = g.convoy;
  if (!c || !c.holding || !heldShip(s)) return 1;
  return Math.max(0, 1 - c.holdT / CONVOY.hold.ease);
}

/** The hulls a Hold stops (or would stop, given now). */
export function holdable(g: Game): Ship[] {
  return convoyCommands(g).includes('hold') ? g.ships.filter(heldShip) : [];
}

/** Puts a game under a policy (after it is created, before its first
 *  step). The map's schedule and formation take over where the policy says. */
export function applyConvoy(g: Game, setup: ConvoySetup): void {
  const def = mapConvoy(g.map.id);
  const flow = Math.max(0, Math.min(FLOW_STEPS.length - 1, setup.flow ?? def.flow));
  g.convoy = {
    setup: { ...setup, rev: setup.rev ?? CONVOY_REV },
    def: { ...def, flow },
    holding: false,
    holdT: 0,
    owed: 0,
    cool: { hold: 0 },
    scheduled: 0,
    released: 0,
    held: 0,
    waited: 0,
    used: { hold: 0 },
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
  const active = c.holding;
  const left = c.holding ? Math.max(0, holdMax(g) - c.holdT) : 0;
  // A Hold that is on is always ready: the tap releases it.
  const ready = c.holding ? true : c.cool[id] <= 0 && holdable(g).length > 0;
  return { ready, active, left, cool: Math.max(0, c.cool[id]) };
}

/** A convoy command (a recorded input). Hold toggles: given while holding,
 *  it releases. Refused, it changes nothing and says why. */
export function convoyCommand(g: Game, id: CommandId): CommandResult {
  const c = g.convoy;
  if (g.phase !== 'wave') return { ok: false, why: 'none' };
  const res = decide(g, id);
  if (g.tel) {
    const releasing = !!c?.holding && res.ok;
    // A Hold: the ships it stops. Its release: how many waited.
    const took = !res.ok || releasing ? undefined : holdable(g).map((s) => s.id);
    g.tel.command(g, releasing ? 'release' : id, releasing ? 'player' : id, c?.owed ?? 0, res.ok, res.why, took);
  }
  if (!c) return res;
  if (!res.ok) {
    c.refused += 1;
    return res;
  }
  c.used[id] += 1;
  if (c.holding) release(g);
  else {
    c.holding = true;
    c.holdT = 0;
  }
  return res;
}

function decide(g: Game, id: CommandId): CommandResult {
  const c = g.convoy;
  if (!c || !convoyCommands(g).includes(id)) return { ok: false, why: 'policy' };
  if (c.holding) return { ok: true };
  if (c.cool[id] > 0) return { ok: false, why: 'cooldown' };
  // A Hold with no ship afloat would change nothing: refused, and the
  // screen says so (round 9: a Hold that was accepted and changed nothing
  // read as "the command did not work at all").
  if (!holdable(g).length) return { ok: false, why: 'none' };
  return { ok: true };
}

/** The Hold ends: the held hulls sail on, and the cooldown starts. */
function release(g: Game, why: 'max' | 'wave' | null = null): void {
  const c = g.convoy!;
  if (!c.holding) return;
  c.holding = false;
  c.waited = Math.max(c.waited, c.holdT);
  c.holdT = 0;
  c.cool.hold = CONVOY.hold.cooldown;
  c.held += c.owed;
  // The player's own release was told of with the command; a forced one here.
  if (why && g.tel) g.tel.command(g, 'release', why, c.owed, true);
  c.owed = 0;
}

/** Each step: the commands' clocks. */
export function updateConvoy(g: Game, dt: number): void {
  const c = g.convoy;
  if (!c) return;
  if (c.cool.hold > 0) c.cool.hold = Math.max(0, c.cool.hold - dt);
  if (c.holding) {
    c.holdT += dt;
    c.owed = holdable(g).length;
    // No waiting a barrage out for good: the Hold ends by itself.
    if (c.holdT >= holdMax(g)) release(g, 'max');
  }
}

/** The formation in force: the run's own. (Until round 11 a Disperse
 *  opened it out here.) */
export function formationNow(g: Game): FormationDef {
  return FORMATIONS[g.formation];
}

/** The spawner: a group sailed on schedule (the ledger). Under a Hold it
 *  still comes in, and waits at the entry. */
export function groupSailed(g: Game): void {
  const c = g.convoy;
  if (!c) return;
  c.scheduled += 1;
  c.released += 1;
}

/** The wave is over (or the ending's restore is here): a Hold never
 *  carries its ships past it. */
export function convoyWaveEnd(g: Game): void {
  if (g.convoy?.holding) release(g, 'wave');
}
