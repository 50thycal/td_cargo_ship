// AUTHORED ENCOUNTERS for the three reference maps (docs/design/
// v3-map-convoy-lab-plan.md, §7, slice 5; what was measured:
// docs/design/v3-map-lab-slices2-5.md).
//
// LAB ONLY, and optional. A campaign run has no encounter layer and plays
// the shared wave table exactly as before. With the layer on, a wave still
// comes from the shared table (data/waves.ts) and the raid planner; an
// encounter is a few launches placed by hand on top, at a set moment, from
// set launchers, with a warning before them. What an encounter sends it
// first takes out of the wave's own budget (`replaces`), so a wave with an
// encounter is no bigger than one without.
//
// An encounter is a decision, not a list of extra enemies: each one says
// what the player is asked to choose, what answers it, and what would show
// it worked. Only enemies the map already has at that wave may appear
// (tests/v3/encounters.test.ts checks every beat against the map).

import type { ThreatKind } from './config';
import type { MapId } from './maps';

/** Bump when any encounter's beats change: runs under different encounters
 *  are never compared as one. */
export const ENCOUNTER_REV = 1;

export interface EncounterSetup {
  rev: number;
  /** Only these encounters (by id), to look at one on its own. An empty
   *  list is the layer with nothing in it: the shared wave on the same
   *  dice, to compare an encounter's wave against. */
  only?: string[];
}

/** Where a beat's launches come from: a base of the map (its index), a
 *  submarine at one of the map's surfacing spots, or an aircraft from one
 *  edge (+1: the left, flying right). */
export type BeatFrom = { base: number } | { sub: number } | { air: 1 | -1 };

/** Who a beat is aimed at, decided as each launch leaves: any ship (the
 *  sim's own pick), the ship furthest along, or the ship nearest the
 *  narrows (Harbor Mouth's funnel). */
export type BeatAim = 'any' | 'lead' | 'narrows';

export interface Beat {
  /** When, as a share of the wave's length (0 its first launch window, 1
   *  its last), plus seconds after that moment. */
  at: number;
  plus?: number;
  kind: ThreatKind;
  count: number;
  /** Seconds between its launches (a swarm: 0.35). */
  gap?: number;
  from: BeatFrom;
  aim?: BeatAim;
}

export type ArcRole = 'teach' | 'combine' | 'escalate' | 'climax';

export interface Encounter {
  id: string;
  map: MapId;
  /** The waves it plays in. */
  waves: number[];
  role: ArcRole;
  name: string;
  /** What the player sees, in a line. */
  premise: string;
  /** The decision it asks for, what answers it, and what would show it
   *  worked (for the designer; never shown in the game). */
  decision: string;
  counters: string;
  succeeds: string;
  beats: Beat[];
  /** Taken out of the wave's own launches, so the wave is no bigger. */
  replaces: { drones?: number; ballistic?: number; guided?: number };
}

const base = (i: number): BeatFrom => ({ base: i });
const sub = (i: number): BeatFrom => ({ sub: i });

export const ENCOUNTERS: Encounter[] = [
  // ---- The Strait: where threats come from, and how to answer one ---------
  {
    id: 'strait-ranging-shots',
    map: 'strait',
    waves: [2, 3, 4],
    role: 'teach',
    name: 'Ranging shots',
    premise: 'The middle base lights up alone and lobs two shells, one after the other.',
    decision: 'Read one warning from one place: where will it land, and which ship is under it?',
    counters: 'Tap each shell in flight; under the Tactical policy, a Rush as they launch carries the ships out from under both.',
    succeeds: 'Hull lost to these shells is lower than to the same two ballistics in the shared wave; first shot at them comes sooner.',
    beats: [{ at: 0.3, kind: 'ballistic', count: 2, gap: 1.6, from: base(1), aim: 'lead' }],
    replaces: { ballistic: 2 },
  },
  {
    id: 'strait-screen',
    map: 'strait',
    waves: [5, 6, 7],
    role: 'combine',
    name: 'The screen',
    premise: 'A drone swarm from the east base, and a guided missile behind it from the same pad.',
    decision: 'Shoot the swarm in front, or reach through it for the missile that does the damage?',
    counters: 'One tap on the missile early; a blast weapon on the swarm.',
    succeeds: 'The missile is shot at before half the swarm is down in most runs; hull lost to guided in these waves does not rise.',
    beats: [
      { at: 0.45, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.4, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
    ],
    replaces: { drones: 6, guided: 1 },
  },
  {
    id: 'strait-rolling-push',
    map: 'strait',
    waves: [8, 9, 10],
    role: 'escalate',
    name: 'Rolling push',
    premise: 'The three bases fire in turn, west to east, two seconds apart: drones, then shells, then a guided pair.',
    decision: 'Three different answers in six seconds, each with its own warning: take them in order or get ahead of the last?',
    counters: 'Follow the lit base; shells can be outrun or shot; the guided pair needs the taps.',
    succeeds: 'Launches overlap on screen more than in the shared wave, with no more of them: harder by timing, not by count.',
    beats: [
      { at: 0.55, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
      { at: 0.55, plus: 2, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.55, plus: 4, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'any' },
    ],
    replaces: { drones: 5, ballistic: 2, guided: 2 },
  },
  // ---- The Gauntlet: two shores, one pair of thumbs ----------------------
  {
    id: 'gauntlet-north-then-south',
    map: 'gauntlet',
    waves: [2, 3, 4],
    role: 'teach',
    name: 'North, then south',
    premise: 'A swarm from the north shore; four seconds later, one from the south.',
    decision: 'Finish the first shore before the second opens, or leave some to turn round in time?',
    counters: 'Clear north fast; the south swarm has its own warning.',
    succeeds: 'Taps cross the carrier line once, not back and forth; damage by shore is even.',
    beats: [
      { at: 0.3, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.3, plus: 4, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 8 },
  },
  {
    id: 'gauntlet-overlap',
    map: 'gauntlet',
    waves: [5, 6, 7],
    role: 'combine',
    name: 'Overlap',
    premise: 'Shells from the north-east base while a swarm is still coming off the south-west one.',
    decision: 'Two shores at once and two kinds of answer: which lane do you save first?',
    counters: 'Shells first (they are committed and few); a Disperse makes the shells cost less while the swarm is shot.',
    succeeds: 'Both shores have threats in the air together for three seconds or more; the far lane is not abandoned.',
    beats: [
      { at: 0.45, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.2, kind: 'ballistic', count: 2, gap: 0.9, from: base(1), aim: 'lead' },
    ],
    replaces: { drones: 6, ballistic: 2 },
  },
  {
    id: 'gauntlet-crossfire',
    map: 'gauntlet',
    waves: [8, 9, 10],
    role: 'climax',
    name: 'Crossfire',
    premise: 'Both shores open together, and a strafing run comes down the channel between them.',
    decision: 'Everything is warned of at once: what can wait two seconds, and what cannot?',
    counters: 'The strafer has the shortest fuse on a dense lane; the shores\' swarms are slow.',
    succeeds: 'The most threats on screen at once is higher than in the shared wave with no more launched; a person can say afterwards what hit them.',
    beats: [
      { at: 0.55, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.55, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
      { at: 0.55, plus: 1.2, kind: 'guided', count: 1, from: base(3), aim: 'lead' },
      { at: 0.55, plus: 2.5, kind: 'strafer', count: 1, from: { air: 1 } },
    ],
    replaces: { drones: 14, guided: 1 },
  },
  // ---- Harbor Mouth: when to be in the funnel ------------------------------
  {
    id: 'harbor-open-water',
    map: 'harbor',
    waves: [1, 2, 3],
    role: 'teach',
    name: 'Open water',
    premise: 'The west base fires at the ships still in the wide water; the narrows are quiet.',
    decision: 'Learn the two halves of the map: the wide water forgives, the narrows will not.',
    counters: 'Ordinary interception; nothing is aimed into the funnel yet.',
    succeeds: 'No sinking in the narrows in waves 1 to 3; hull lost sits in the first third of the board.',
    beats: [{ at: 0.35, kind: 'drone', count: 5, gap: 0.35, from: base(0) }],
    replaces: { drones: 5 },
  },
  {
    id: 'harbor-funnel-salvo',
    map: 'harbor',
    waves: [4, 5, 6, 7],
    role: 'combine',
    name: 'Funnel salvo',
    premise: 'A submarine surfaces off the narrows and fires a salvo into the mouth of the funnel.',
    decision: 'The periscope shows before the salvo: send the next ships in under it, or hold them out?',
    counters: 'Shoot the shells; under the Tactical policy, Hold at the periscope keeps the next group out of the mouth until it has landed.',
    succeeds: 'With Hold used at the periscope, hull lost in the middle third falls and deliveries do not.',
    beats: [{ at: 0.45, kind: 'ballistic', count: 4, gap: 0.75, from: sub(1), aim: 'narrows' }],
    replaces: { ballistic: 4 },
  },
  {
    id: 'harbor-last-mile',
    map: 'harbor',
    waves: [8, 9, 10],
    role: 'climax',
    name: 'The last mile',
    premise: 'The east bases fire down the funnel at the ships about to deliver, as a swarm comes in from the south.',
    decision: 'The ships nearest home are the ones aimed at: defend the last mile or the ones behind?',
    counters: 'The guided pair first; the swarm is slower than it looks from this side.',
    succeeds: 'Sinkings in the last third do not rise against the shared wave, with the same number launched.',
    beats: [
      { at: 0.55, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
      { at: 0.55, plus: 1.5, kind: 'drone', count: 5, gap: 0.35, from: base(3) },
      { at: 0.55, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(4), aim: 'narrows' },
    ],
    replaces: { drones: 5, ballistic: 2, guided: 2 },
  },
];

/** A map's encounters for a wave (none on a map with no authored layer, or
 *  a wave past the tenth: the ending is the map's own event). */
export function encountersFor(map: MapId, wave: number): Encounter[] {
  return ENCOUNTERS.filter((e) => e.map === map && e.waves.includes(wave));
}

/** The ten-wave arc of a reference map: what each wave is for, and the
 *  encounter (if any) that carries it. Waves 1-3 teach, 4-6 combine, 7-9
 *  escalate, 10 is the climax; then the map's own event, untouched. */
export function arc(map: MapId): { wave: number; role: ArcRole; encounters: Encounter[] }[] {
  return Array.from({ length: 10 }, (_, k) => {
    const wave = k + 1;
    return { wave, role: wave <= 3 ? 'teach' : wave <= 6 ? 'combine' : wave <= 9 ? 'escalate' : 'climax', encounters: encountersFor(map, wave) };
  });
}

export const ENCOUNTER_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor'];
