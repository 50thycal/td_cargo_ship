// CONVOY POLICIES AND TACTICAL COMMANDS: the Map & Convoy Lab's experiment
// (docs/design/v3-map-convoy-lab-plan.md, §6, slices 3 and 4; what was
// measured: docs/design/v3-map-lab-slices2-5.md).
//
// LAB ONLY. A campaign run has no convoy setup and plays exactly as before:
// five flow steps and four formations. A lab run can ask for one of four
// policies, so the same map, seed and Armory can be played each way:
//   auto       A: the map's own schedule and formation, no convoy input
//   formation  B: the map's schedule, the four formations
//   current    C: today's controls (flow and formation)
//   tactical   D: the map's schedule and formation, plus the map's command
//              (round 11: Hold, on maps where something crosses the lane)
// and for one of two obligations:
//   fixed      every policy sails ships on the same schedule (the map's
//              flow), so they are compared on equal ships released
//   natural    each policy under its own rules (C's flow is free)
//
// Every number here is a prototype to be measured, not a promise.

import type { FormationId } from './formations';
import type { MapId } from './maps';

export type ConvoyPolicy = 'auto' | 'formation' | 'current' | 'tactical';
export type Obligation = 'fixed' | 'natural';
/** The convoy's commands. Round 11 cut Rush and Disperse (the player: "cut
 *  them all but Hold"); Hold is the one left. */
export type CommandId = 'hold';

/** The rules' revision: bump when a command's numbers or meaning change, so
 *  runs under different rules are never compared as one. */
export const CONVOY_REV = 3;
// Rev 2 (round 9): Hold stops every ship short of the map's hold line, on
// the water where it can be seen. Rev 1 kept only the groups that came due
// while it was on off the map, which at the map's flow was usually none or
// one, for under a second: it changed nothing a player could see
// (docs/design/v3-round9-fixes.md).
// Rev 3 (round 11, docs/design/v3-round11-map-notes.md):
// - Rush and Disperse are gone. The player: "cut them all but Hold". Their
//   logs showed why: 15 presses in about 24 minutes, 13 with nothing in the
//   air a change of speed or spacing could dodge. Only ballistic shells can
//   miss a ship that changes speed (everything else homes in), and shells
//   were about 13-18% of the hull damage taken.
// - Hold stops every ship afloat, wherever it is; there is no hold line. The
//   player: "all the ships should just pause instead of having a line".
// - Hold is offered only where something crosses the lane that a player
//   would wait out: Sowers' Reach, whose mines drift across it ("that way
//   the players can pause when the mines are passing"). The Strait, The
//   Gauntlet and Harbor Mouth have no command: under D their convoy sails
//   the map's own schedule and formation, with no input.

export const POLICY_NAME: Record<ConvoyPolicy, string> = {
  auto: 'A · Automatic',
  formation: 'B · Formations only',
  current: 'C · Current controls',
  tactical: 'D · Tactical commands',
};
export const POLICY_ORDER: ConvoyPolicy[] = ['auto', 'formation', 'current', 'tactical'];

export interface ConvoySetup {
  policy: ConvoyPolicy;
  obligation: Obligation;
  /** The rules it was played under (CONVOY_REV when it was made). */
  rev: number;
  /** A lab override of the map's schedule (a flow step), to compare
   *  policies at another rate of sailing. */
  flow?: number;
  /** Lab overrides of the commands' numbers (a sweep). */
  tune?: Partial<{ holdMax: number }>;
}

/** The command's numbers. (Rush and Disperse, cut in round 11, were
 *  `rush: { time: 6, speed: 1.5, coast: 10, coastSpeed: 0.7, cooldown: 24 }`
 *  and `disperse: { time: 6, speed: 0.85, widen: 2.4, limit: 0.85,
 *  cooldown: 20 }`.)
 *  - Hold (rev 3): every ship afloat (not the supertanker) eases to a stop
 *    within `ease` s and waits where it is, for up to `max` s or until it
 *    is released; the schedule's next ships wait at the entry. It needs a
 *    ship afloat, and can't be given again until `cooldown` s after the
 *    release. (Rev 2 stopped only the ships short of a hold line drawn on
 *    the map.) */
export const CONVOY = {
  hold: { max: 6, ease: 0.4, cooldown: 12 },
} as const;

export interface CommandDef {
  id: CommandId;
  name: string;
  /** The label while it runs (Hold's button then reads Release). */
  active: string;
  /** One line a player can read on the button's hint. */
  says: string;
  cost: string;
}

export const COMMANDS: Record<CommandId, CommandDef> = {
  hold: { id: 'hold', name: 'Hold', active: 'Holding', says: `Every ship stops where it is (up to ${CONVOY.hold.max} s).`, cost: 'Tap again to release. Held ships sit still, and deliver later.' },
};

export interface MapConvoy {
  /** The map's own schedule (a flow step) and formation, under A, B and D. */
  flow: number;
  formation: FormationId;
  /** The map's commands under D (round 11: Hold, or none). */
  commands: CommandId[];
  /** The one decision the map asks for. */
  dilemma: string;
}

const OPEN: MapConvoy = { flow: 2, formation: 'pairs', commands: [], dilemma: '' };

/** The three reference maps (the plan: start here, not on all twenty), and
 *  the maps with a command. A map not listed sails its default schedule
 *  with no command. The Delta's fork stays what it is (a tap on its buoy):
 *  the route is its command. Round 11: Rush and Disperse are gone, so the
 *  reference maps have no command (their schedule and formation stay);
 *  Hold moved from Harbor Mouth to Sowers' Reach, where mines drift across
 *  the lane. */
export const MAP_CONVOY: Partial<Record<MapId, MapConvoy>> = {
  strait: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  gauntlet: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  harbor: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // Chapter 1, rebuilt to the rules after the reference maps (docs/design/
  // v3-ch1-kesh.md, v3-ch1-marrow.md): the map's own convoy, as the
  // reference maps', no command (neither the hook nor the radar needs one).
  kesh: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  marrow: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // Chapter 2 (docs/design/v3-ch2-island.md, v3-ch2-behemoth.md): the same,
  // no command. The Island's two lanes and the Behemoth's supertanker lane
  // shape the convoy on their own.
  island: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  behemoth: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // The Needle of Bosk (docs/design/v3-ch2-needle.md): the same, no
  // command. The lane closes to one hull wide, so the pairs fall into single
  // file and queue at the mouth on their own: the shape is the problem.
  needle: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // The Archipelago (docs/design/v3-ch2-archipelago.md): the same, no
  // command. One lane under a chain of islets: the ships come in at the
  // far west end, a long reach from the carrier, and sail east past every
  // islet and every gap between them.
  archipelago: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // Saltgate Canal (docs/design/v3-ch2-saltgate.md): the same, no command.
  // The locks hold the ships themselves: each chamber takes what it holds,
  // shuts, fills and lets them out, and the ships behind wait at its gate.
  saltgate: { flow: 2, formation: 'pairs', commands: [], dilemma: '' },
  // The campaign's own schedule and formation (DEFAULT_FLOW, step 1, and
  // Pairs), so the ships sail as a campaign run's do when the controls are
  // left alone: only Hold is added.
  sowers: { flow: 1, formation: 'pairs', commands: ['hold'], dilemma: 'Stop the convoy while mines drift across the lane, against delivering later and sitting still under the rest of the wave.' },
};

export function mapConvoy(map: MapId): MapConvoy {
  return MAP_CONVOY[map] ?? OPEN;
}
