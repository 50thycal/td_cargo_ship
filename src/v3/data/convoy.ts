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
//   tactical   D: the map's schedule and formation, plus the map's one or
//              two commands
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
export type CommandId = 'rush' | 'disperse' | 'hold';

/** The rules' revision: bump when a command's numbers or meaning change, so
 *  runs under different rules are never compared as one. */
export const CONVOY_REV = 1;

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
  tune?: Partial<{ rushSpeed: number; rushTime: number; holdMax: number }>;
}

/** The commands' numbers.
 *  - Rush: every ship afloat sails `speed`x for `time` s, then `coastSpeed`x
 *    for `coast` s (the same distance in the end: it moves the convoy now
 *    and pays for it after), then it can't be given again until `cooldown`
 *    s after it began. What it is for: attacks that commit to where a ship
 *    will be (ballistics, shells, bombs, rockets, torpedoes) land behind a
 *    convoy that sped up after they were aimed.
 *  - Disperse: for `time` s the hulls open out across the lane: a blast
 *    reaches only the hull it lands on and splash weapons do half damage,
 *    as in the Spread formation, but the convoy sails `speed`x.
 *  - Hold: the next groups wait off the map's entry for up to `max` s (or
 *    until `groups` of them are waiting), then sail one behind another as
 *    fast as the entry clears. Ships already afloat are not touched. It
 *    can't be given again until `cooldown` s after the release. */
export const CONVOY = {
  rush: { time: 6, speed: 1.5, coast: 10, coastSpeed: 0.7, cooldown: 24 },
  disperse: { time: 6, speed: 0.85, widen: 2.4, limit: 0.85, cooldown: 20 },
  hold: { max: 6, groups: 2, cooldown: 12 },
} as const;

export interface CommandDef {
  id: CommandId;
  name: string;
  /** The label while it runs (Hold becomes Release). */
  active: string;
  /** One line a player can read on the button's hint. */
  says: string;
  cost: string;
}

export const COMMANDS: Record<CommandId, CommandDef> = {
  rush: { id: 'rush', name: 'Rush', active: 'Rushing', says: `Ships afloat sail faster for ${CONVOY.rush.time} s.`, cost: `Then slower for ${CONVOY.rush.coast} s.` },
  disperse: { id: 'disperse', name: 'Disperse', active: 'Dispersed', says: `Ships open out for ${CONVOY.disperse.time} s: a blast hits one hull only.`, cost: 'The convoy slows while it is spread.' },
  hold: { id: 'hold', name: 'Hold', active: 'Release', says: `The next ships wait off the map (up to ${CONVOY.hold.max} s).`, cost: 'They then sail bunched together.' },
};

export interface MapConvoy {
  /** The map's own schedule (a flow step) and formation, under A, B and D. */
  flow: number;
  formation: FormationId;
  /** The map's commands under D: the primary one, then at most one more. */
  commands: CommandId[];
  /** The one decision the map asks for. */
  dilemma: string;
}

const OPEN: MapConvoy = { flow: 2, formation: 'pairs', commands: [], dilemma: '' };

/** The three reference maps (the plan: start here, not on all twenty). A
 *  map not listed sails its default schedule with no command. The Delta's
 *  fork stays what it is (a tap on its buoy): the route is its command. */
export const MAP_CONVOY: Partial<Record<MapId, MapConvoy>> = {
  strait: { flow: 2, formation: 'pairs', commands: ['rush', 'disperse'], dilemma: 'Fewer seconds under a volley that has already been aimed, against a slow stretch after.' },
  gauntlet: { flow: 2, formation: 'pairs', commands: ['rush', 'disperse'], dilemma: 'Two shores: run the crossfire or open out and take longer through it.' },
  harbor: { flow: 2, formation: 'pairs', commands: ['hold'], dilemma: 'Keep the next ships out of the funnel while a barrage lands, against sending them in bunched.' },
};

export function mapConvoy(map: MapId): MapConvoy {
  return MAP_CONVOY[map] ?? OPEN;
}
