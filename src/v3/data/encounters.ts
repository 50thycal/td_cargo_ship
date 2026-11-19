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
// (tests/v3/encounters.test.ts checks every beat against the map), except
// in a version that says it brings enemy pairs in (`guests`, below).
//
// VERSIONS (Test Lab round 12, docs/design/v3-round12-encounter-versions.md).
// Each reference map has three encounter versions, each built round one
// idea, so playing them side by side teaches us something for the maps'
// quality checklist:
// - v1, the original nine (slice 5), unchanged;
// - v2 "Set pieces": four big, named moments a map, each announced by a
//   call-out as it starts, with quiet waves between (the wave budget moves
//   from the quiet waves to the set pieces, `scale`);
// - v3 "Enemy pairs": an encounter in most waves, each built from one of
//   the enemy pairs (data/pairs.ts), taught, then combined, then escalated.
// A run's version is in its EncounterSetup (and so in its play log).

import type { ThreatKind } from './config';
import type { FoeId } from './foes';
import type { MapId } from './maps';

/** Bump when any encounter's beats change: runs under different encounters
 *  are never compared as one. Rev 2 (round 12): the versions; v1's beats
 *  are rev 1's, unchanged, so a rev 1 log replays as it did. Rev 3 (round
 *  12's fixes, from the round 11 scorecards): every version opens with an
 *  encounter on wave 1 (OPENERS), and The Strait's waves 5-10 send about
 *  10% more fire in every version (MAP_FIRE). Both are rev 3's only: a log
 *  of rev 1 or 2 plays as it did. Rev 4 (map rebuild phase 4, the reference
 *  maps brought to the map and wave rules: docs/design/v3-map-wave-rules.md):
 *  encounters may be replaced (`until`), and the reference maps' v1 plans
 *  are reworked; a rev 3 log plays as it did. Harbor Mouth's rev 4
 *  (docs/design/v3-p4-harbor.md): ten encounters, one a wave (HARBOR_R4),
 *  a calm before wave 10's climax (`calm`) and its boss rounds tuned at the
 *  neck (MAP_BOSS), all of it lab only. */
export const ENCOUNTER_REV = 4;

/** A reference map's encounter version. */
export type EncounterVersion = 'v1' | 'v2' | 'v3';
export const ENCOUNTER_VERSIONS: EncounterVersion[] = ['v1', 'v2', 'v3'];

/** The version a run with nothing said plays (every log before round 12). */
export const VERSION_DEFAULT: EncounterVersion = 'v1';

export interface EncounterSetup {
  rev: number;
  /** Only these encounters (by id), to look at one on its own. An empty
   *  list is the layer with nothing in it: the shared wave on the same
   *  dice, to compare an encounter's wave against. */
  only?: string[];
  /** The map's encounter version (absent: v1, as every log before round
   *  12). */
  version?: EncounterVersion;
  /** The call-out as each encounter starts: on or off whatever the
   *  version says (absent: the version's own `callouts`). */
  callouts?: boolean;
}

/** Is this a version id? */
export function isVersion(v: unknown): v is EncounterVersion {
  return typeof v === 'string' && (ENCOUNTER_VERSIONS as string[]).includes(v);
}

/** A run's version: what its setup says, else v1. */
export function setupVersion(s: Pick<EncounterSetup, 'version'> | null | undefined): EncounterVersion {
  return isVersion(s?.version) ? s.version : VERSION_DEFAULT;
}

/** Where a beat's launches come from: a base of the map (its index), a
 *  submarine at one of the map's surfacing spots, or an aircraft from one
 *  edge (+1: the left, flying right). */
export type BeatFrom = { base: number } | { sub: number } | { air: 1 | -1 };

/** Who a beat is aimed at, decided as each launch leaves: any ship (the
 *  sim's own pick), the ship furthest along, the ship nearest the narrows
 *  (Harbor Mouth's funnel), or (rev 4, map rebuild phase 4) the ship least
 *  far along, the one on the way in (The Gauntlet's danger stretch). Rev 4,
 *  chapter 1's Kesh and Marrow (docs/design/v3-ch1-kesh.md, v3-ch1-marrow.md):
 *  'near', the ship nearest the launcher as it fires (the Kesh Hook's south
 *  silo over the apex of the turn: the shortest flight on the map); 'mid',
 *  the ship nearest halfway along its lane (the Hook's apex, the stretch
 *  under Marrow's radar), from wherever it is fired; 'post',
 *  the map's allied structure while it stands (Lee of Marrow's radar tower),
 *  and once it is gone the ship nearest where it stood. */
export type BeatAim = 'any' | 'lead' | 'narrows' | 'rear' | 'near' | 'mid' | 'post';

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

/** An enemy pair placed by an encounter (v3): one set of the pair (data/
 *  pairs.ts), or `count` sets `every` s apart, its members launched on the
 *  pair's own cues (the Test Lab's combo cards launch them the same way). */
export interface PairBeat {
  /** When its lead launches, as a Beat's `at` and `plus`. */
  at: number;
  plus?: number;
  /** The pair's id (data/pairs.ts). */
  pair: string;
  /** The base its lead comes out of, when the lead comes from a base: lit
   *  as a raid's warning before it fires. Absent: the pair's own rule. */
  base?: number;
  count?: number;
  every?: number;
}

export type ArcRole = 'teach' | 'combine' | 'escalate' | 'climax';

/** An encounter's internal notes, one sentence each, naming launch sites as
 *  the map draws them ("the east silo on the north shore"). */
export interface EncounterNotes {
  /** Which launch sites fire: silos, sub spots, edges, roads. */
  sites: string;
  /** Which ship or stretch it aims at. */
  target: string;
  /** How it uses the map's shape or mechanic. */
  usesMap: string;
}

export interface Encounter {
  id: string;
  map: MapId;
  version: EncounterVersion;
  /** The waves it plays in. */
  waves: number[];
  role: ArcRole;
  name: string;
  /** What the player sees, in a line. */
  premise: string;
  /** The call-out's second line as it starts (its first is the name):
   *  short, "Both shores at once". */
  callout: string;
  /** The decision it asks for, what answers it, and what would show it
   *  worked (for the designer; never shown in the game). */
  decision: string;
  counters: string;
  succeeds: string;
  /** Internal design notes (rule g-named, docs/design/v3-map-data-checks.md):
   *  where it fires from, what it aims at and how it uses the map. For the
   *  designer and the checks only; never shown in the game, and it changes
   *  nothing a run plays (the call-out stays the player's line). */
  notes: EncounterNotes;
  beats: Beat[];
  /** Enemy pairs it places (v3). */
  pairs?: PairBeat[];
  /** Taken out of the wave's own launches, so the wave is no bigger. */
  replaces: { drones?: number; ballistic?: number; guided?: number };
  /** The encounter revision it came in (absent: 1, or 2 for v2 and v3,
   *  their first). A run plays only the encounters of its own rev or
   *  before, so an older log replays as it did. */
  rev?: number;
  /** The last encounter revision it plays in (absent: every one since its
   *  own). Phase 4 replaces encounters under rev 4: the old one keeps
   *  `until: 3`, so a rev 3 log replays as it did. */
  until?: number;
  /** Wave 1's opener (rev 3): a light first look at the version's first
   *  encounter, so the map's opening shows what the map is. Not a set piece
   *  (v2's four stay its peaks); it may preview what the map has by wave
   *  2 (a shell, a periscope), and nothing later. */
  opener?: boolean;
  /** A breath before it (rev 4, rule w-calm: "a short calm before wave
   *  10's climax"): the wave's own raids and trickling drones that would
   *  fly in the `calm` s before its first beat come before that instead
   *  (calmBefore), so the climax starts out of a quiet sky. */
  calm?: number;
}

const base = (i: number): BeatFrom => ({ base: i });
const sub = (i: number): BeatFrom => ({ sub: i });

/** The original nine (slice 5), version 1. Their beats are rev 1's. */
const V1: Omit<Encounter, 'version' | 'callout'>[] = [
  // ---- The Strait: where threats come from, and how to answer one ---------
  {
    id: 'strait-ranging-shots',
    map: 'strait',
    // Replaced in rev 4 (phase 4: docs/design/v3-p4-strait.md).
    until: 3,
    waves: [2, 3, 4],
    role: 'teach',
    name: 'Ranging shots',
    premise: 'The middle base lights up alone and lobs two shells, one after the other.',
    decision: 'Read one warning from one place: where will it land, and which ship is under it?',
    counters: 'Tap each shell in flight, the first as soon as it climbs.',
    succeeds: 'Hull lost to these shells is lower than to the same two ballistics in the shared wave; first shot at them comes sooner.',
    notes: {
      sites: 'The middle silo on the north shore, on its own.',
      target: 'The lead ship, furthest east along the lane.',
      usesMap: 'One silo straight across the water from the carrier teaches the north shore\'s long warning: each shell crosses the whole open water, so there is time to read where it lands.',
    },
    beats: [{ at: 0.3, kind: 'ballistic', count: 2, gap: 1.6, from: base(1), aim: 'lead' }],
    replaces: { ballistic: 2 },
  },
  {
    id: 'strait-screen',
    map: 'strait',
    // Replaced in rev 4 (phase 4: docs/design/v3-p4-strait.md).
    until: 3,
    waves: [5, 6, 7],
    role: 'combine',
    name: 'The screen',
    premise: 'A drone swarm from the east base, and a guided missile behind it from the same pad.',
    decision: 'Shoot the swarm in front, or reach through it for the missile that does the damage?',
    counters: 'One tap on the missile early; a blast weapon on the swarm.',
    succeeds: 'The missile is shot at before half the swarm is down in most runs; hull lost to guided in these waves does not rise.',
    notes: {
      sites: 'The east silo on the north shore, for both the swarm and the missile behind it.',
      target: 'The swarm at any ship, the missile at the lead ship near the delivery end.',
      usesMap: 'The east silo is the one nearest the ships about to deliver, so the swarm screens the missile with the shortest flight on the map.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.4, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
    ],
    replaces: { drones: 6, guided: 1 },
  },
  {
    id: 'strait-rolling-push',
    map: 'strait',
    // Replaced in rev 4 (phase 4: docs/design/v3-p4-strait.md).
    until: 3,
    waves: [8, 9, 10],
    role: 'escalate',
    name: 'Rolling push',
    premise: 'The three bases fire in turn, west to east, two seconds apart: drones, then shells, then a guided pair.',
    decision: 'Three different answers in six seconds, each with its own warning: take them in order or get ahead of the last?',
    counters: 'Follow the lit base; the shells need a tap each; the guided pair needs the taps.',
    succeeds: 'Launches overlap on screen more than in the shared wave, with no more of them: harder by timing, not by count.',
    notes: {
      sites: 'All three north-shore silos in turn, west, middle, then east, two seconds apart.',
      target: 'The swarm and the guided pair at any ship, the shells at the lead ship.',
      usesMap: 'The three silos in a row along one shore make the fire sweep along the lane with the convoy: harder by timing, not by count.',
    },
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
    // Replaced in rev 4 (map rebuild phase 4: docs/design/v3-p4-gauntlet.md).
    until: 3,
    waves: [2, 3, 4],
    role: 'teach',
    name: 'North, then south',
    premise: 'A swarm from the north shore; four seconds later, one from the south.',
    decision: 'Finish the first shore before the second opens, or leave some to turn round in time?',
    counters: 'Clear north fast; the south swarm has its own warning.',
    succeeds: 'Taps cross the carrier line once, not back and forth; damage by shore is even.',
    notes: {
      sites: 'The north-west silo, then the south-west silo four seconds later.',
      target: 'Any ship on either lane, as the convoy enters the west end of the channel.',
      usesMap: 'The two shores with the carrier between them: the second swarm comes from the other side once the first has pulled the player north.',
    },
    beats: [
      { at: 0.3, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.3, plus: 4, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 8 },
  },
  {
    id: 'gauntlet-overlap',
    map: 'gauntlet',
    // Replaced in rev 4 (map rebuild phase 4: docs/design/v3-p4-gauntlet.md).
    until: 3,
    waves: [5, 6, 7],
    role: 'combine',
    name: 'Overlap',
    premise: 'Shells from the north-east base while a swarm is still coming off the south-west one.',
    decision: 'Two shores at once and two kinds of answer: which lane do you save first?',
    counters: 'Shells first (they are committed and few), then the swarm.',
    succeeds: 'Both shores have threats in the air together for three seconds or more; the far lane is not abandoned.',
    notes: {
      sites: 'The south-west silo\'s swarm, then shells from the north-east silo.',
      target: 'The swarm at any ship, the shells at the lead ship further east.',
      usesMap: 'Opposite shores and opposite ends of the channel, so the two threats never sit in one sweep of the thumb.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.2, kind: 'ballistic', count: 2, gap: 0.9, from: base(1), aim: 'lead' },
    ],
    replaces: { drones: 6, ballistic: 2 },
  },
  {
    id: 'gauntlet-crossfire',
    map: 'gauntlet',
    // Replaced in rev 4 (map rebuild phase 4: docs/design/v3-p4-gauntlet.md).
    until: 3,
    waves: [8, 9, 10],
    role: 'climax',
    name: 'Crossfire',
    premise: 'Both shores open together, and a strafing run comes down the channel between them.',
    decision: 'Everything is warned of at once: what can wait two seconds, and what cannot?',
    counters: 'The strafer has the shortest fuse on a dense lane; the shores\' swarms are slow.',
    succeeds: 'The most threats on screen at once is higher than in the shared wave with no more launched; a person can say afterwards what hit them.',
    notes: {
      sites: 'The north-west and south-west silos together, then the south-east silo\'s missile and a strafer in from the west edge.',
      target: 'The swarms at any ship, the missile at the lead ship, the strafer down the channel.',
      usesMap: 'Every side of the channel at once: both shores, the far east end, and the air down the middle where the carrier sits.',
    },
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
    notes: {
      sites: 'The north-west silo, the one furthest from the harbour.',
      target: 'Any ship while the convoy is still in the wide open water in the west.',
      usesMap: 'The open water is the safe stretch: a swarm with a long run in teaches the map before the neck matters.',
    },
    beats: [{ at: 0.35, kind: 'drone', count: 5, gap: 0.35, from: base(0) }],
    replaces: { drones: 5 },
    until: 3,
  },
  {
    id: 'harbor-funnel-salvo',
    map: 'harbor',
    waves: [4, 5, 6, 7],
    role: 'combine',
    name: 'Funnel salvo',
    premise: 'A submarine surfaces off the narrows and fires a salvo into the mouth of the funnel.',
    decision: 'The periscope shows before the salvo: shoot the sub, or save the taps for its four shells?',
    counters: 'Shoot the shells as they climb; the periscope is the warning, and a weapon loaded early covers the mouth.',
    succeeds: 'Hull lost in the middle third falls as the periscope is learnt (waves 4 to 7 against each other), and deliveries do not.',
    notes: {
      sites: 'A submarine at the sub spot off the mouth of the narrows, north of the neck.',
      target: 'The ship nearest the narrows, as it enters the funnel.',
      usesMap: 'Puts the sub\'s short warning right on the danger stretch, where the lane closes and the ships cannot spread out.',
    },
    beats: [{ at: 0.45, kind: 'ballistic', count: 4, gap: 0.75, from: sub(1), aim: 'narrows' }],
    replaces: { ballistic: 4 },
    until: 3,
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
    notes: {
      sites: 'The north-east headland silo, the south headland silo, then the south-east silo at the mouth.',
      target: 'The lead ship about to deliver for the missiles, any ship for the swarm, the ship nearest the narrows for the shells.',
      usesMap: 'The silos round the harbour mouth fire into the last mile of the funnel, the map\'s danger stretch, from both sides of the neck.',
    },
    beats: [
      { at: 0.55, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
      { at: 0.55, plus: 1.5, kind: 'drone', count: 5, gap: 0.35, from: base(3) },
      { at: 0.55, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(4), aim: 'narrows' },
    ],
    replaces: { drones: 5, ballistic: 2, guided: 2 },
    until: 3,
  },
];

/** Version 1's call-out lines (only shown when a run turns call-outs on). */
const V1_CALLOUT: Record<string, string> = {
  'strait-ranging-shots': 'Two shells, one after the other',
  'strait-screen': 'A missile behind the swarm',
  'strait-rolling-push': 'West to east, two seconds apart',
  'gauntlet-north-then-south': 'North shore, then south',
  'gauntlet-overlap': 'Shells and a swarm, two shores',
  'gauntlet-crossfire': 'Both shores and a strafer',
  'harbor-open-water': 'Drones on the open water',
  'harbor-funnel-salvo': 'A sub fires into the funnel',
  'harbor-last-mile': 'Everything on the last mile',
};

// ---- The Strait, rev 4 (map rebuild phase 4: docs/design/v3-p4-strait.md) --
// The Strait keeps its design (open water, one enemy shore: the player's
// call, round 1) and its v1 waves follow the wave rules: one encounter a
// wave, never the same one twice in a row; teach (1-2), first stakes (3-4),
// combine (5-6), escalate (7-9), climax (10). The map's problem: every
// threat comes off one shore, and the further east the ships sail, the
// nearer the launchers and the shorter the warning. So the encounters aim
// at the ship furthest along (the middle and last thirds of the lane, the
// danger stretch) and leave the west third, where everything has the whole
// open water to cross, the safe one. Their launchers move east, then onto
// the water, as the waves go on (the warning falls).
// - From wave 3 each takes all of its wave's own shells and sends its own,
//   aimed at the lead ship. The planner's submarines then carry drones: a
//   sub with a shell in its raid fills a salvo of four from a random spot,
//   the west ones too, and those salvos made the west third hot (26% of the
//   hull lost, rev 3; the safe stretch must stay under 25%).
// - What each sends against what it replaces sets its wave's weight (the
//   bots' curve had cliffs on waves 6 and 8): launches stay within a tenth
//   of the wave with no encounter, wave 10 a tenth under.
// - Wave 10's climax comes after the wave's own fire is spent (`at: 1`),
//   so a calm of about 6-10 s falls before it.
// Wave 1 keeps rev 3's opener (strait-ranging-opener). Rev 3's three
// (ranging shots, the screen, the rolling push) end at rev 3 (`until`).
const STRAIT_R4: Omit<Encounter, 'version'>[] = [
  {
    id: 'strait-far-silo',
    map: 'strait',
    rev: 4,
    waves: [2],
    role: 'teach',
    name: 'The long crossing',
    callout: 'Drones crossing the whole strait',
    premise: 'A swarm from the far west silo flies the length of the strait at the ship furthest along; a shell from the middle silo follows it.',
    decision: 'The longest warning on the map: meet the swarm out over the water, or wait until it is over the ships?',
    counters: 'Tap the swarm early, anywhere along its long flight; the shell after it needs one tap.',
    succeeds: 'The swarm is shot at before it reaches the lane in most runs; no ship lost on wave 2.',
    notes: {
      sites: 'The west silo on the north shore for the swarm, then the middle silo for one shell.',
      target: 'The lead ship, far to the east, so the swarm crosses the board on the diagonal and lands in the middle or last third.',
      usesMap: 'The silo furthest from where it aims shows the map\'s long warning: the same shore that fires every shot, and how much water there is to cross.',
    },
    beats: [
      { at: 0.3, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'lead' },
      { at: 0.3, plus: 2.5, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' },
    ],
    replaces: { drones: 4, ballistic: 1 },
  },
  {
    id: 'strait-silo-to-silo',
    map: 'strait',
    rev: 4,
    waves: [3],
    role: 'teach',
    name: 'Silo to silo',
    callout: 'Shells, each one closer',
    premise: 'The middle silo lobs a shell at the lead ship, then the east silo lobs three more: each one closer, each with less warning.',
    decision: 'The first stakes: the second and third shells come from nearer the ships. Shoot each as it climbs, or let the far one go and stand ready?',
    counters: 'A tap on each shell as it climbs; the east silo\'s three need the quicker hand.',
    succeeds: 'Each shell is shot at before it lands in most runs; a ship hit means the east silo was late, not unseen.',
    notes: {
      sites: 'The middle silo on the north shore, then the east silo three times.',
      target: 'The lead ship among those a shell can reach (west of x 1280), in the middle third of the lane.',
      usesMap: 'Middle then east along the one shore: the warning shortens as the launcher moves towards the delivery end, the map\'s problem in three shells.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' },
      { at: 0.4, plus: 2.2, kind: 'ballistic', count: 3, gap: 0.9, from: base(2), aim: 'lead' },
    ],
    replaces: { ballistic: 3 },
  },
  {
    id: 'strait-periscope',
    map: 'strait',
    rev: 4,
    waves: [4],
    role: 'teach',
    name: 'Periscope ahead',
    callout: 'A sub surfaces ahead of the ships',
    premise: 'A periscope shows in the open water north-east, ahead of the convoy; the sub surfaces and fires four shells at the lead ship while the east silo sends a swarm at it.',
    decision: 'Fire from the water as well as from the shore: watch the periscope, or the silo?',
    counters: 'Tap the shells as the sub fires them (they climb fast from close); the swarm is slow and has its own warning.',
    succeeds: 'The salvo is shot at in most runs; hull lost is in the last third, not the first.',
    notes: {
      sites: 'The sub spot in the north-east water (1180, 245), then the east silo on the north shore.',
      target: 'The lead ship, in the last third of the lane, for the salvo and the swarm.',
      usesMap: 'The first launcher off the shore: from the open water just north of the lane the shells have half a silo\'s flight, the warning the late stretch gets from here on.',
    },
    beats: [
      { at: 0.45, kind: 'ballistic', count: 4, from: sub(1), aim: 'lead' },
      { at: 0.45, plus: 1.5, kind: 'drone', count: 6, gap: 0.35, from: base(2), aim: 'lead' },
    ],
    replaces: { ballistic: 4, drones: 4 },
  },
  {
    id: 'strait-swarm-screen',
    map: 'strait',
    rev: 4,
    waves: [5],
    role: 'combine',
    name: 'Swarm screen',
    callout: 'A missile behind a swarm',
    premise: 'A swarm out of the east silo with a guided missile behind it from the same silo, the missile at the lead ship; a shell from the middle silo after it. A smaller swarm off the middle silo opens the wave.',
    decision: 'Shoot the swarm in front, or reach through it for the missile that does the damage?',
    counters: 'One tap on the missile early; a blast weapon on the swarm.',
    succeeds: 'The missile is shot at before half the swarm is down in most runs; a good player loses no more than a ship over waves 1 to 5.',
    notes: {
      sites: 'The east silo on the north shore for the swarm and the missile, the middle silo for the shell and the opening swarm.',
      target: 'The missile and the shell at the lead ship, in the last third; the swarms at any ship, from the east, so the west ships get the longest warning.',
      usesMap: 'The east silo is nearest the ships about to deliver: the swarm screens the missile on the shortest flight from the shore.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 8, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.4, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
      { at: 0.45, plus: 3, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' },
      { at: 0.2, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
    ],
    replaces: { drones: 6, guided: 1, ballistic: 4 },
  },
  {
    id: 'strait-both-ways',
    map: 'strait',
    rev: 4,
    waves: [6],
    role: 'combine',
    name: 'Both ways',
    callout: 'Drones from the north, a sub south',
    premise: 'A swarm from the west silo crosses towards the lead ship while a sub surfaces south of the lane, on the carrier\'s side, and fires three shells at it. Before it, a sub to the north-east; after it, a guided pair from the east silo.',
    decision: 'Two directions at once: north for the swarm, or south for the sub\'s shells?',
    counters: 'The shells first: they are few and close. The swarm has the whole strait to cross.',
    succeeds: 'Both are in the air together for three seconds or more, and the lead ship lives in most runs.',
    notes: {
      sites: 'The sub spot in the north-east water (1180, 245) first; then the west silo on the north shore with the sub spot south-east of the lane (1350, 700), on the friendly side; then the east silo.',
      target: 'The lead ship, in the last third of the lane, from both sides.',
      usesMap: 'The one shore is the north; the sub breaks that rule from behind the ships, so the player has to look both ways for the first time.',
    },
    beats: [
      { at: 0.5, kind: 'drone', count: 7, gap: 0.35, from: base(0), aim: 'lead' },
      { at: 0.5, plus: 1, kind: 'ballistic', count: 3, from: sub(4), aim: 'lead' },
      { at: 0.25, kind: 'ballistic', count: 3, from: sub(1), aim: 'lead' },
      { at: 0.75, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
    ],
    // Wave 6 was a cliff (the supersonic's first wave): it gives up more
    // than it sends.
    replaces: { drones: 7, ballistic: 5, guided: 2 },
  },
  {
    id: 'strait-down-the-lane',
    map: 'strait',
    rev: 4,
    waves: [7],
    role: 'escalate',
    name: 'Down the lane',
    callout: 'A strafer and two missiles',
    premise: 'A strafer comes in from the east edge up the convoy\'s lane while the east silo fires a guided pair at the lead ship, the middle silo a swarm and a shell; swarms from the east and middle silos before and after.',
    decision: 'The strafer has the shortest fuse; the missiles have further to fly. Which first?',
    counters: 'The strafer as it lines up; then a tap each on the missiles.',
    succeeds: 'The strafer is shot down before its run ends in most runs; the missiles are shot at.',
    notes: {
      sites: 'A strafer in from the east edge, the east silo on the north shore for two guided missiles and a swarm, the middle silo for a swarm, a shell and a last swarm.',
      target: 'The strafer up the lane from the delivery end, the missiles and the shell at the lead ship, the swarms at any ship.',
      usesMap: 'The open water gives the strafer a clear run the length of the lane; coming from the east, it meets the lead ships first, where the east silo\'s missiles land.',
    },
    beats: [
      { at: 0.4, kind: 'strafer', count: 1, from: { air: -1 } },
      { at: 0.4, plus: 1.5, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
      { at: 0.4, plus: 2, kind: 'drone', count: 5, gap: 0.35, from: base(1) },
      { at: 0.4, plus: 3.5, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' },
      { at: 0.15, kind: 'drone', count: 5, gap: 0.35, from: base(2) },
      { at: 0.75, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
    ],
    replaces: { drones: 7, guided: 2, ballistic: 5 },
  },
  {
    id: 'strait-sweep-east',
    map: 'strait',
    rev: 4,
    waves: [8],
    role: 'escalate',
    name: 'Sweep east',
    callout: 'West to east, two seconds apart',
    premise: 'The three silos fire in turn, west to east, two seconds apart: drones, then shells, then a guided missile, all at the ship furthest along. Earlier, a sub off the east end fires three shells at it.',
    decision: 'Three answers in four seconds, each with its own warning: take them in order or get ahead of the last?',
    counters: 'Follow the lit silo; the shells need a tap each; the missile needs the last.',
    succeeds: 'Launches overlap on screen more than in the shared wave, with fewer of them: harder by timing, not by count.',
    notes: {
      sites: 'All three north-shore silos in turn, west, middle, then east, two seconds apart; before them the sub spot in the far east water (1520, 250); swarms from the east and middle silos to open and close the wave.',
      target: 'The sweep and the sub at the lead ship, in the middle and last thirds; the opening and closing swarms at any ship.',
      usesMap: 'The three silos in a row along one shore make the fire sweep along the lane with the convoy, its warning shorter at each step.',
    },
    beats: [
      { at: 0.55, kind: 'drone', count: 5, gap: 0.35, from: base(0), aim: 'lead' },
      { at: 0.55, plus: 2, kind: 'ballistic', count: 3, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.55, plus: 4, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
      { at: 0.25, kind: 'ballistic', count: 3, from: sub(2), aim: 'lead' },
      { at: 0.1, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
      { at: 0.8, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
    ],
    // Wave 8 was the second cliff: it gives up more than it sends.
    replaces: { drones: 9, ballistic: 6, guided: 2 },
  },
  {
    id: 'strait-ambush',
    map: 'strait',
    rev: 4,
    waves: [9],
    role: 'escalate',
    name: 'Ambush ahead',
    callout: 'Two subs ahead of the ships',
    premise: 'Two periscopes in the north-east water, ahead of the convoy; the subs fire four and three shells at the lead ship as a swarm comes off the middle silo and a guided pair off the east one.',
    decision: 'Two salvos from the water and a swarm from the shore: which sub is first, and is the swarm a feint?',
    counters: 'The salvos as they climb, nearest sub first; the swarm with a blast weapon.',
    succeeds: 'Both salvos are shot at; the lead ship lives in most runs for the player.',
    notes: {
      sites: 'The sub spots in the north-east water (1180, 245) and the far east (1520, 250), then the middle silo and the east silo on the north shore (an east swarm opens the wave).',
      target: 'The salvos and the guided pair at the lead ship, in the middle and last thirds; the swarms at any ship.',
      usesMap: 'Two subs just north of the delivery end give the shortest warning on the map before the climax.',
    },
    beats: [
      { at: 0.5, kind: 'ballistic', count: 4, from: sub(1), aim: 'lead' },
      { at: 0.5, plus: 1.5, kind: 'ballistic', count: 3, from: sub(2), aim: 'lead' },
      { at: 0.5, plus: 2.5, kind: 'drone', count: 6, gap: 0.35, from: base(1) },
      { at: 0.2, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.5, plus: 4, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
    ],
    replaces: { ballistic: 6, drones: 8, guided: 2 },
  },
  {
    id: 'strait-final-approach',
    map: 'strait',
    rev: 4,
    waves: [10],
    role: 'climax',
    name: 'Final approach',
    callout: 'Everything at the leading ships',
    premise: 'After the wave\'s own fire is spent and a few quiet seconds, all three silos and a sub off the east end open together on the ships nearest delivery.',
    decision: 'Everything is warned of at once: what can wait two seconds, and what cannot?',
    counters: 'The sub\'s shells and the guided pair have the shortest fuses; the swarms are slow.',
    succeeds: 'The most threats on screen at once is the map\'s highest; a person can say afterwards what hit them.',
    notes: {
      sites: 'The west and middle silos\' swarms, the east silo\'s guided pair, the sub spot in the far east water (1520, 250) and the middle silo\'s shells; an east swarm early in the wave.',
      target: 'The west swarm, the guided pair and the sub\'s shells at the lead ship; the rest at any ship.',
      usesMap: 'The whole shore and the water off the delivery end at once, on the stretch with the shortest warning: the map\'s problem at its largest.',
    },
    beats: [
      { at: 1, plus: 2.5, kind: 'drone', count: 5, gap: 0.35, from: base(0), aim: 'lead' },
      { at: 1, plus: 3.3, kind: 'drone', count: 5, gap: 0.35, from: base(1) },
      { at: 1, plus: 4, kind: 'guided', count: 2, gap: 0.8, from: base(2), aim: 'lead' },
      { at: 1, plus: 4.5, kind: 'ballistic', count: 2, from: sub(2), aim: 'lead' },
      { at: 1, plus: 5, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) },
      { at: 0.2, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
    ],
    // The climax gives up more than it sends: it was the hardest wave by
    // far for every kit. It starts after the wave's own fire (`at: 1`): a
    // calm before it.
    replaces: { drones: 14, guided: 2, ballistic: 8 },
  },
];

// ---- Version 2: Set pieces ---------------------------------------------------
// Four big, readable moments a map, each named by a call-out as its warning
// starts (the bases light, the periscopes show, the arrows point), on waves
// whose budget is raised; the waves between are quieter. Each set piece is
// built on the map's own shape: The Strait's three bases in a row, The
// Gauntlet's two shores, Harbor Mouth's narrows and its submarines.

const V2: Omit<Encounter, 'version'>[] = [
  // ---- The Strait: the three-base sweep ----
  {
    id: 'strait-v2-sweep',
    map: 'strait',
    waves: [3],
    role: 'teach',
    name: 'The sweep',
    callout: 'West to east, one after another',
    premise: 'The three bases light and fire in turn from west to east, under two seconds apart: drones, shells, then drones again.',
    decision: 'Three warnings in a row, one order to fire in: follow it, or get ahead of the east base?',
    counters: 'Clear the west swarm, tap the shells as they climb, then turn east.',
    succeeds: 'Hull lost in the sweep falls when it is met again (wave 8 is its echo); the player can say the order afterwards.',
    notes: {
      sites: 'The three north-shore silos in turn, west, middle, then east.',
      target: 'The swarms at any ship, the shells at the lead ship.',
      usesMap: 'The three silos in a row along the north shore make an order the player can learn and say back.',
    },
    beats: [
      { at: 0.3, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.3, plus: 1.6, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.3, plus: 3.4, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 8, ballistic: 2 },
  },
  {
    id: 'strait-v2-both-sides',
    map: 'strait',
    waves: [5],
    role: 'combine',
    name: 'Both sides',
    callout: 'Subs north and south of the convoy',
    premise: 'Two periscopes at once, one off the north shore and one behind the convoy on the south side; each fires a salvo at the lead ship.',
    decision: 'The threat comes from behind you for the first time: which salvo first?',
    counters: 'Tap the shells as they climb; the south salvo is closer to the ships and lands sooner.',
    succeeds: 'Both salvos are shot at; the player looks south once the periscope shows.',
    notes: {
      sites: 'Two submarines: the north-east sub spot off the north shore and the south-east spot on the friendly side, behind the convoy.',
      target: 'The lead ship, from both sides of the lane.',
      usesMap: 'The south sub spot is the one place fire can come from behind the lane, turning a one-shore map into two.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'lead' },
      { at: 0.4, plus: 0.6, kind: 'ballistic', count: 3, gap: 0.75, from: sub(4), aim: 'lead' },
    ],
    replaces: { ballistic: 6 },
  },
  {
    id: 'strait-v2-air-raid',
    map: 'strait',
    waves: [8],
    role: 'escalate',
    name: 'Air raid',
    callout: 'A bomber over the north water',
    premise: 'A bomber flies in from the west along the north water and the middle base sends a swarm under it.',
    decision: 'The bomber\'s missiles or the swarm under it: what can wait?',
    counters: 'The bomber\'s missiles as they drop; the swarm is slower.',
    succeeds: 'The arrow is read: the bomber\'s missiles are shot at before they land.',
    notes: {
      sites: 'A bomber in from the west edge along the north water, then the middle silo on the north shore.',
      target: 'The bomber\'s missiles at the ships under its line, the swarm at any ship.',
      usesMap: 'The bomber flies the open water between the north shore and the lane, so its arrow and the silo warn from the same side.',
    },
    beats: [
      { at: 0.45, kind: 'bomber', count: 1, from: { air: 1 } },
      { at: 0.45, plus: 1.5, kind: 'drone', count: 5, gap: 0.35, from: base(1) },
    ],
    replaces: { drones: 8, guided: 2 },
  },
  {
    id: 'strait-v2-long-sweep',
    map: 'strait',
    waves: [10],
    role: 'climax',
    name: 'The long sweep',
    callout: 'East to west this time',
    premise: 'The sweep again, the other way and quicker: a guided missile from the east base, shells from the middle, then a swarm from the west.',
    decision: 'You know the sweep: now it comes the other way, a second apart.',
    counters: 'The missile first; then the shells as they climb.',
    succeeds: 'Hull lost here is no worse than wave 9\'s by more than a ship; the player calls it fair.',
    notes: {
      sites: 'The three north-shore silos in reverse, east, middle, then west, under a second and a half apart.',
      target: 'The missile at the lead ship, the shells and the swarm at any ship.',
      usesMap: 'The sweep\'s row of silos run the other way, so the east silo\'s short flight comes first.',
    },
    beats: [
      { at: 0.4, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
      { at: 0.4, plus: 1.4, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) },
      { at: 0.4, plus: 2.8, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
    ],
    replaces: { drones: 6, ballistic: 2, guided: 1 },
  },
  // ---- The Gauntlet: a true two-shore pincer ----
  {
    id: 'gauntlet-v2-pincer',
    map: 'gauntlet',
    waves: [3],
    role: 'teach',
    name: 'Pincer',
    callout: 'Both shores at once',
    premise: 'A swarm from the north shore and one from the south at the same second, then shells from the north-east base.',
    decision: 'Both shores light together: which side do you clear first, and how do you get back?',
    counters: 'Take the nearer swarm, then the shells as they climb, then the far swarm.',
    succeeds: 'Damage by shore is even; the far lane is not abandoned.',
    notes: {
      sites: 'The north-west and south-west silos in the same second, then shells from the north-east silo.',
      target: 'The swarms at any ship on either lane, the shells at the lead ship.',
      usesMap: 'The two shores face each other across the carrier, so both swarms close on the convoy from opposite sides.',
    },
    beats: [
      { at: 0.35, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
      { at: 0.35, kind: 'drone', count: 5, gap: 0.35, from: base(2) },
      { at: 0.35, plus: 1.6, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
    ],
    replaces: { drones: 10, ballistic: 2 },
  },
  {
    id: 'gauntlet-v2-scissors',
    map: 'gauntlet',
    waves: [5],
    role: 'combine',
    name: 'Scissors',
    callout: 'Shells north, a missile south',
    premise: 'The north-east base and the south-east base fire in the same second, shells from one side and a guided missile at the lead ship from the other; a swarm follows from the south.',
    decision: 'Two answers from two shores at once: which one do you leave?',
    counters: 'The missile (it homes); then the shells as they climb.',
    succeeds: 'The lead ship survives in most runs; both shores are shot at.',
    notes: {
      sites: 'The north-east and south-east silos in the same second, then a swarm from the south-west silo.',
      target: 'The shells and the swarm at any ship, the missile at the lead ship.',
      usesMap: 'The two east silos face each other at the end of the channel, so the scissors close on the ships nearest delivery.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) },
      { at: 0.4, kind: 'guided', count: 1, from: base(3), aim: 'lead' },
      { at: 0.4, plus: 2.2, kind: 'drone', count: 5, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 5, ballistic: 2, guided: 1 },
  },
  {
    id: 'gauntlet-v2-channel-run',
    map: 'gauntlet',
    waves: [8],
    role: 'escalate',
    name: 'Channel run',
    callout: 'A strafer down the channel',
    premise: 'A strafer comes down the channel from the west, and both shores send a swarm behind it.',
    decision: 'An arrow from the west, and both shores firing: what has the shortest fuse?',
    counters: 'The strafer first; the swarms are slower than they look.',
    succeeds: 'The strafer is shot at before its run; ships lost to strafers fall against wave 8 of v1.',
    notes: {
      sites: 'A strafer in from the west edge, then the north-west and south-west silos together.',
      target: 'The strafer along the channel at the ships, the swarms at any ship.',
      usesMap: 'The channel between the shores is the strafer\'s runway, and the two west silos fill both flanks behind it.',
    },
    beats: [
      { at: 0.45, kind: 'strafer', count: 1, from: { air: 1 } },
      { at: 0.45, plus: 3, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.45, plus: 3, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 13 },
  },
  {
    id: 'gauntlet-v2-full-pincer',
    map: 'gauntlet',
    waves: [10],
    role: 'climax',
    name: 'Full pincer',
    callout: 'Everything at once, both shores',
    premise: 'All four bases light within a second: swarms from the west of each shore, then shells from the north-east and guided missiles from the south-east.',
    decision: 'Everything warned of at once from both shores: what can wait two seconds?',
    counters: 'Missiles and shells first (they are few and committed), then the swarms.',
    succeeds: 'The most threats on screen is the run\'s peak, and the player can say what hit them.',
    notes: {
      sites: 'All four silos: north-west and south-west swarms, then the north-east shells and the south-east missiles.',
      target: 'The swarms at any ship, the shells and the missiles at the lead ship.',
      usesMap: 'Every silo on both shores lights within a second, so the climax is the whole channel at once.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
      { at: 0.4, kind: 'drone', count: 5, gap: 0.35, from: base(2) },
      { at: 0.4, plus: 1.2, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.4, plus: 1.2, kind: 'guided', count: 2, gap: 0.9, from: base(3), aim: 'lead' },
    ],
    replaces: { drones: 10, ballistic: 2, guided: 2 },
  },
  // ---- Harbor Mouth: the submarine ambush at the narrows ----
  {
    id: 'harbor-v2-ambush',
    map: 'harbor',
    waves: [2],
    role: 'teach',
    name: 'Ambush',
    callout: 'A sub at the narrows',
    premise: 'A periscope off the mouth of the narrows; the sub fires a salvo into the funnel, and the north headland sends a swarm down after it.',
    decision: 'The periscope shows first: get ready over the funnel before the salvo.',
    counters: 'Tap the shells as they climb; the swarm after them is slow.',
    succeeds: 'The player looks at the periscope when it shows (taps near the funnel before the first shell lands).',
    notes: {
      sites: 'A submarine at the sub spot off the mouth of the narrows, then the north headland silo.',
      target: 'The ship nearest the narrows, for both the salvo and the swarm.',
      usesMap: 'The periscope rises right over the funnel, the danger stretch, and the headland silo sits above the same water.',
    },
    beats: [
      { at: 0.35, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'narrows' },
      { at: 0.35, plus: 2.5, kind: 'drone', count: 4, gap: 0.35, from: base(1), aim: 'narrows' },
    ],
    replaces: { ballistic: 3, drones: 4 },
  },
  {
    id: 'harbor-v2-headlands',
    map: 'harbor',
    waves: [4],
    role: 'combine',
    name: 'Headlands',
    callout: 'Both headlands on the neck',
    premise: 'The north and south headlands fire guided missiles at the ship in the neck at the same second, then a swarm from the south shore.',
    decision: 'Two missiles at one ship from two sides, then a swarm: where do your taps go?',
    counters: 'The missiles first (they home); the swarm is slow from the south.',
    succeeds: 'The ship in the neck survives in most runs.',
    notes: {
      sites: 'The north-east headland silo and the south headland silo together, then a swarm from the south headland.',
      target: 'The ship nearest the narrows, from both sides of the neck; the swarm at any ship.',
      usesMap: 'The two headlands face each other across the neck, so the funnel is hit from the north and the south at once.',
    },
    beats: [
      { at: 0.4, kind: 'guided', count: 1, from: base(2), aim: 'narrows' },
      { at: 0.4, kind: 'guided', count: 1, from: base(3), aim: 'narrows' },
      { at: 0.4, plus: 2.2, kind: 'drone', count: 4, gap: 0.35, from: base(3) },
    ],
    replaces: { guided: 2, drones: 4 },
  },
  {
    id: 'harbor-v2-wolf-pack',
    map: 'harbor',
    waves: [7],
    role: 'escalate',
    name: 'Wolf pack',
    callout: 'Two subs: the mouth, and behind you',
    premise: 'A sub surfaces off the narrows and another in the open water behind the convoy; both fire salvos, the second a few seconds after the first.',
    decision: 'The first salvo pulls you to the funnel; the second is behind you: do you turn in time?',
    counters: 'Both periscopes show before their salvos; look back west after the first.',
    succeeds: 'Both salvos are shot at; ships lost in the open water stay low.',
    notes: {
      sites: 'Two submarines: the sub spot off the mouth of the narrows, then the open-water spot to the south-west, behind the convoy.',
      target: 'The ship nearest the narrows first, then any ship in the open water.',
      usesMap: 'Pulls the player east to the funnel and then back west to the open water, the safe stretch, which for once is not safe.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'narrows' },
      { at: 0.4, plus: 3, kind: 'ballistic', count: 2, gap: 0.75, from: sub(2), aim: 'any' },
    ],
    replaces: { ballistic: 5 },
  },
  {
    id: 'harbor-v2-harbor-gate',
    map: 'harbor',
    waves: [10],
    role: 'climax',
    name: 'Harbor gate',
    callout: 'Everything at the neck',
    premise: 'A sub at the mouth, the north-east base\'s guided pair at the lead ship, and a swarm from the south: everything on the last ships home.',
    decision: 'The last mile, with every warning on screen: what can wait?',
    counters: 'The guided pair, then the shells; the swarm is slow from the south.',
    succeeds: 'Ships lost here are no more than wave 9\'s plus one; the player calls it hard but fair.',
    notes: {
      sites: 'A submarine off the mouth of the narrows, the north-east headland silo, then the south headland silo.',
      target: 'The ship nearest the narrows and the lead ship about to deliver; the swarm at any ship.',
      usesMap: 'Everything the harbour mouth has (the sub, the headland, the south shore) on the last ships home in the neck.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'narrows' },
      { at: 0.4, plus: 1.2, kind: 'guided', count: 2, gap: 0.9, from: base(2), aim: 'lead' },
      { at: 0.4, plus: 2.8, kind: 'drone', count: 5, gap: 0.35, from: base(3) },
    ],
    replaces: { ballistic: 3, guided: 2, drones: 5 },
  },
];

// ---- Version 3: Enemy pairs --------------------------------------------------
// The player (Test Lab round 8): enemy pairs are "good synergy combos to add
// to the maps". Each map takes three pairs that suit its water. Each pair is
// taught on its own (one set, in a lighter wave), then combined with the
// map's own fire, then two pairs overlap. The pairs from chapters 2 and 3
// are guests on these chapter 1 maps (`guests`): this version tries them
// here on purpose.

const pairsOf = (...ps: (string | [string, number?, number?])[]): PairBeat[] => ps.map((p, k) => (typeof p === 'string' ? { at: 0.3 + k * 0.3, pair: p } : { at: p[1] ?? 0.3, pair: p[0], ...(p[2] !== undefined ? { base: p[2] } : {}) }));

const V3: Omit<Encounter, 'version'>[] = [
  // ---- The Strait: Hydra + Drone Swarm, Scavenger + Drone Swarm, Attack Helicopter + Torpedo Sub ----
  {
    id: 'strait-v3-hydra-teach',
    map: 'strait',
    waves: [2],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'A drone swarm from the far base with a Hydra launched to catch it up, so they arrive together.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is killed before it splits in most runs by wave 3.',
    notes: {
      sites: 'The west silo on the north shore: the swarm, then the Hydra out of the same silo.',
      target: 'Any ship; the Hydra is timed to arrive with the swarm.',
      usesMap: 'The west silo gives a long look at the pair across the open water before it closes on the lane.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.35, 0]),
    replaces: { drones: 10 },
  },
  {
    id: 'strait-v3-hydra-combine',
    map: 'strait',
    waves: [3],
    role: 'combine',
    name: 'Hydra and shells',
    callout: 'Hydra swarm, and shells behind it',
    premise: 'The Hydra swarm again, and two shells from the middle base as it closes.',
    decision: 'The Hydra or the shells: both want the same taps.',
    counters: 'The Hydra out in the swarm, then the shells as they climb.',
    succeeds: 'Hull lost to darts falls from wave 2.',
    notes: {
      sites: 'The east silo on the north shore for the Hydra and its swarm, then shells from the middle silo.',
      target: 'Any ship, for the pair and the shells.',
      usesMap: 'The east silo is near the delivery end, so the Hydra closes sooner than on wave 2 while the middle silo adds shells.',
    },
    beats: [{ at: 0.35, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) }],
    pairs: pairsOf(['hydra-swarm', 0.35, 2]),
    replaces: { drones: 10, ballistic: 2 },
  },
  {
    id: 'strait-v3-scavenger-teach',
    map: 'strait',
    waves: [4],
    role: 'teach',
    name: 'The Scavenger',
    callout: 'Something waits over your drops',
    premise: 'A Scavenger circles over the water where your pickups fall; a swarm comes in while it circles.',
    decision: 'Shoot the Scavenger to free your pickups, or the swarm first?',
    counters: 'The swarm, then the Scavenger before the next drop.',
    succeeds: 'Pickups locked by it are freed in most runs.',
    notes: {
      sites: 'A Scavenger in from the top edge, then a swarm from a north-shore silo.',
      target: 'The Scavenger circles over the water where pickups fall; the swarm goes at any ship.',
      usesMap: 'Uses the open water between the shore and the lane, where drops land, rather than a stretch of the lane.',
    },
    beats: [],
    pairs: pairsOf(['scavenger-swarm', 0.3]),
    replaces: { drones: 11 },
  },
  {
    id: 'strait-v3-scavenger-combine',
    map: 'strait',
    waves: [5],
    role: 'combine',
    name: 'Scavenger and shells',
    callout: 'The Scavenger, and shells behind',
    premise: 'The Scavenger and its swarm, and two shells from the middle base while your drops are locked.',
    decision: 'Ammo runs down on the swarm and the shells while the Scavenger holds your drops.',
    counters: 'Keep a tap for the Scavenger; the shells as they climb.',
    succeeds: 'No run runs dry here more than wave 4 did.',
    notes: {
      sites: 'A Scavenger in from the top edge with its swarm from a north-shore silo, then shells from the middle silo.',
      target: 'The pickups on the water, and any ship for the swarm and the shells.',
      usesMap: 'The middle silo\'s shells come while the drops on the open water are locked, so ammo runs down over the long warnings.',
    },
    beats: [{ at: 0.25, plus: 4, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) }],
    pairs: pairsOf(['scavenger-swarm', 0.25]),
    replaces: { drones: 11, ballistic: 2 },
  },
  {
    id: 'strait-v3-heli-teach',
    map: 'strait',
    waves: [6],
    role: 'teach',
    name: 'Helicopter and sub',
    callout: 'A helicopter, and a periscope under it',
    premise: 'An Attack Helicopter comes to hover by the lane; a Torpedo Sub surfaces under its hover a second after it gets there.',
    decision: 'The helicopter keeps your gun busy; the sub is up only a short time: which first?',
    counters: 'The sub while it is up; the helicopter after.',
    succeeds: 'The sub is shot at while it is up in most runs.',
    notes: {
      sites: 'An Attack Helicopter in from the edge to hover by the lane, and a Torpedo Sub surfacing on the water under it.',
      target: 'The ships on the lane, by the helicopter\'s missile pairs and the sub\'s torpedoes.',
      usesMap: 'Brings fire off the water beside the lane instead of the far north shore, cutting the Strait\'s long warning.',
    },
    beats: [],
    pairs: pairsOf(['heli-sub', 0.3]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'strait-v3-heli-combine',
    map: 'strait',
    waves: [7],
    role: 'combine',
    name: 'Helicopter, sub and a swarm',
    callout: 'Helicopter and sub, a swarm behind',
    premise: 'The helicopter and its sub again, while the west base sends a swarm.',
    decision: 'The pair and a swarm: what can wait?',
    counters: 'The sub, then the swarm, then the helicopter.',
    succeeds: 'Ships lost here are no more than wave 6\'s plus one.',
    notes: {
      sites: 'The helicopter and its sub by the lane, then a swarm from the west silo on the north shore.',
      target: 'The ships on the lane; the swarm at any ship.',
      usesMap: 'The west silo\'s swarm comes from the far shore while the pair is close, so the player splits between near and far.',
    },
    beats: [
      { at: 0.3, plus: 5, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
    ],
    pairs: pairsOf(['heli-sub', 0.3]),
    replaces: { drones: 14, guided: 1, ballistic: 1 },
  },
  {
    id: 'strait-v3-escalate-1',
    map: 'strait',
    waves: [8],
    role: 'escalate',
    name: 'Two swarms with company',
    callout: 'Scavenger, then a Hydra swarm',
    premise: 'The Scavenger pair and the Hydra pair overlap: two swarms, a Hydra in one of them, and your drops locked.',
    decision: 'Two pairs at once: which half of each do you break?',
    counters: 'The Hydra early, the Scavenger before your next drop.',
    succeeds: 'The two pairs are on screen together for several seconds, and ships lost stay level with wave 7.',
    notes: {
      sites: 'A Scavenger from the top edge with its swarm, then the Hydra swarm from the east silo.',
      target: 'The pickups on the water, and any ship for the swarms and the Hydra.',
      usesMap: 'The east silo\'s Hydra closes on the delivery end while the drops on the open water are held.',
    },
    beats: [],
    pairs: pairsOf(['scavenger-swarm', 0.3], ['hydra-swarm', 0.45, 2]),
    replaces: { drones: 14, ballistic: 4, guided: 4 },
  },
  {
    id: 'strait-v3-escalate-2',
    map: 'strait',
    waves: [9],
    role: 'escalate',
    name: 'Air, water and a Hydra',
    callout: 'Helicopter and sub, then a Hydra swarm',
    premise: 'The helicopter and its sub, and a Hydra swarm from the west while the sub is up.',
    decision: 'Three different answers in a few seconds.',
    counters: 'The sub while it is up, the Hydra out in its swarm, then the helicopter.',
    succeeds: 'Ships lost stay within one of wave 8.',
    notes: {
      sites: 'The helicopter and its sub by the lane, then the Hydra swarm from the west silo.',
      target: 'The ships on the lane; the Hydra swarm at any ship.',
      usesMap: 'Near fire from the water beside the lane and far fire from the west of the north shore at once.',
    },
    beats: [],
    pairs: pairsOf(['heli-sub', 0.3], ['hydra-swarm', 0.5, 0]),
    replaces: { drones: 21, guided: 1, ballistic: 1 },
  },
  {
    id: 'strait-v3-climax',
    map: 'strait',
    waves: [10],
    role: 'climax',
    name: 'Finale: Hydra and helicopter',
    callout: 'A Hydra swarm, then helicopter and sub',
    premise: 'Two of the pairs you met, one after the other: a Hydra swarm from the west, then the helicopter and its sub.',
    decision: 'What you learned, in order: keep up.',
    counters: 'Each pair\'s own answer, one at a time.',
    succeeds: 'Ships lost are no more than wave 9\'s plus one.',
    notes: {
      sites: 'The Hydra swarm from the west silo, then the helicopter and its sub by the lane.',
      target: 'Any ship for the Hydra swarm, then the ships on the lane.',
      usesMap: 'The far shore first, then the water beside the lane: the map\'s two distances, in order.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.2, 0], ['heli-sub', 0.55]),
    replaces: { drones: 21, guided: 1, ballistic: 1 },
  },
  // ---- The Gauntlet: Hydra + Drone Swarm, Armored Drones + Hydra, Siege Battery + Rocket Truck ----
  {
    id: 'gauntlet-v3-hydra-teach',
    map: 'gauntlet',
    waves: [2],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'A swarm off the north shore with a Hydra launched to catch it up.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is killed before it splits in most runs by wave 3.',
    notes: {
      sites: 'The north-west silo: the swarm, then the Hydra out of the same silo.',
      target: 'Any ship on either lane; the Hydra is timed to arrive with the swarm.',
      usesMap: 'Fires off the north shore only, so the first pair comes from one side of the carrier.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.35, 0]),
    replaces: { drones: 10 },
  },
  {
    id: 'gauntlet-v3-hydra-combine',
    map: 'gauntlet',
    waves: [3],
    role: 'combine',
    name: 'Hydra across the channel',
    callout: 'Hydra swarm south, shells north',
    premise: 'The Hydra swarm from the south shore, and shells from the north shore as it closes.',
    decision: 'Two shores and two answers: Hydra or shells?',
    counters: 'The Hydra out in the swarm, then the shells as they climb.',
    succeeds: 'Damage by shore is even.',
    notes: {
      sites: 'The Hydra swarm from the south-west silo, then shells from the north-east silo.',
      target: 'Any ship on either lane.',
      usesMap: 'Opposite shores again: the Hydra from the south, the shells from the north.',
    },
    beats: [{ at: 0.35, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(1) }],
    pairs: pairsOf(['hydra-swarm', 0.35, 2]),
    replaces: { drones: 10, ballistic: 2 },
  },
  {
    id: 'gauntlet-v3-armored-teach',
    map: 'gauntlet',
    waves: [4],
    role: 'teach',
    name: 'Plates and a Hydra',
    callout: 'Armored drones, a Hydra behind',
    premise: 'Two Armored Drones from the north shore, and a Hydra launched to arrive with them.',
    decision: 'The plates make you wait for their bank; the Hydra makes you shoot early.',
    counters: 'Shoot the Hydra early; wait for the drones to bank, or blast them.',
    succeeds: 'The Hydra is killed before it splits in most runs.',
    notes: {
      sites: 'The north-east silo: two Armored Drones, then the Hydra out of the same silo.',
      target: 'Any ship on either lane; the Hydra is timed to arrive with the drones.',
      usesMap: 'One silo on one shore, so the player can stand over that side while learning the plates.',
    },
    beats: [],
    pairs: pairsOf(['armored-hydra', 0.35, 1]),
    replaces: { drones: 15 },
  },
  {
    id: 'gauntlet-v3-armored-combine',
    map: 'gauntlet',
    waves: [5],
    role: 'combine',
    name: 'Plates over the channel',
    callout: 'Armored drones and a Hydra, south',
    premise: 'The armored pair from the south shore this time, with the wave\'s own fire from the north.',
    decision: 'Wait for the bank in the south, or turn to the north shore?',
    counters: 'The Hydra first, then the drones as they bank.',
    succeeds: 'The far lane is not abandoned.',
    notes: {
      sites: 'The south-west silo for the armored pair, with the wave\'s own fire from the north shore.',
      target: 'Any ship on either lane.',
      usesMap: 'Puts the pair on the south shore while the wave\'s own fire keeps the north busy.',
    },
    beats: [],
    pairs: pairsOf(['armored-hydra', 0.35, 2]),
    replaces: { drones: 15 },
  },
  {
    id: 'gauntlet-v3-siege-teach',
    map: 'gauntlet',
    waves: [6],
    role: 'teach',
    name: 'Truck, then gun',
    callout: 'Rockets, then shells',
    premise: 'A Rocket Truck comes down a shore road and fires; as it fires its last salvo a Siege Battery rises from its hatch.',
    decision: 'Two launchers you can\'t outshoot: which do you break first?',
    counters: 'The truck before it fires; the gun while it is up.',
    succeeds: 'The truck is killed before its third salvo in most runs.',
    notes: {
      sites: 'A Rocket Truck down one of the shore roads, then a Siege Battery out of a hatch on the shore.',
      target: 'The ships on the lanes: the truck\'s rockets, then the gun\'s shells on circles.',
      usesMap: 'Uses the shore roads along both banks: launchers that move along the shore instead of fixed silos.',
    },
    beats: [],
    pairs: pairsOf(['siege-truck', 0.2]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'gauntlet-v3-siege-combine',
    map: 'gauntlet',
    waves: [7],
    role: 'combine',
    name: 'Launchers and a swarm',
    callout: 'Truck and gun, a swarm from the south',
    premise: 'The truck and its gun again, and a swarm from the south shore while they take turns.',
    decision: 'The launchers or the swarm?',
    counters: 'The truck early, the swarm, then the gun while it is up.',
    succeeds: 'Ships lost stay within one of wave 6.',
    notes: {
      sites: 'The truck and the gun on the shore, then a swarm from the south-west silo.',
      target: 'The ships on the lanes; the swarm at any ship.',
      usesMap: 'The south-west swarm comes while the launchers take turns, so the player turns between a road and a silo.',
    },
    beats: [
      { at: 0.2, plus: 8, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    pairs: pairsOf(['siege-truck', 0.2]),
    replaces: { drones: 14, guided: 1, ballistic: 1 },
  },
  {
    id: 'gauntlet-v3-escalate-1',
    map: 'gauntlet',
    waves: [8],
    role: 'escalate',
    name: 'Hydras on both shores',
    callout: 'Two Hydra pairs, two shores',
    premise: 'The Hydra swarm from the south and the armored pair from the north, a few seconds apart.',
    decision: 'Two Hydras from two shores: which do you take first?',
    counters: 'Both Hydras early; the drones as they bank.',
    succeeds: 'Hull lost to darts stays level with wave 5.',
    notes: {
      sites: 'The Hydra swarm from the south-west silo, then the armored pair from the north-east silo.',
      target: 'Any ship on either lane.',
      usesMap: 'Two Hydras from opposite shores and opposite ends of the channel.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.3, 2], ['armored-hydra', 0.45, 1]),
    replaces: { drones: 26 },
  },
  {
    id: 'gauntlet-v3-escalate-2',
    map: 'gauntlet',
    waves: [9],
    role: 'escalate',
    name: 'Launchers and a Hydra',
    callout: 'Truck and gun, and a Hydra swarm',
    premise: 'The truck and its gun take turns, and a Hydra swarm comes off the north shore between them.',
    decision: 'The launchers keep firing while the Hydra closes.',
    counters: 'The truck early, the Hydra out in its swarm, the gun while it is up.',
    succeeds: 'Ships lost stay within one of wave 8.',
    notes: {
      sites: 'The truck and the gun on the shore, then the Hydra swarm from the north-west silo.',
      target: 'The ships on the lanes; the Hydra swarm at any ship.',
      usesMap: 'A road launcher and a north-shore silo keep both kinds of launch site busy at once.',
    },
    beats: [],
    pairs: pairsOf(['siege-truck', 0.2], ['hydra-swarm', 0.5, 0]),
    replaces: { drones: 21, guided: 1, ballistic: 1 },
  },
  {
    id: 'gauntlet-v3-climax',
    map: 'gauntlet',
    waves: [10],
    role: 'climax',
    name: 'Finale: launchers and plates',
    callout: 'Armored pair, then truck and gun',
    premise: 'Two of the pairs you met, one after the other: the armored pair off the north shore, then the truck and its gun.',
    decision: 'What you learned, in order: keep up.',
    counters: 'Each pair\'s own answer, one at a time.',
    succeeds: 'Ships lost are no more than wave 9\'s plus one.',
    notes: {
      sites: 'The armored pair from the north-east silo, then the truck and the gun on the shore.',
      target: 'Any ship, then the lanes under the gun\'s circles.',
      usesMap: 'A north-shore silo first, then the shore road and its hatch: the map\'s two kinds of launch site, in order.',
    },
    beats: [],
    pairs: pairsOf(['armored-hydra', 0.2, 1], ['siege-truck', 0.45]),
    replaces: { drones: 25, guided: 1, ballistic: 1 },
  },
  // ---- Harbor Mouth: Hydra + Drone Swarm, Attack Helicopter + Torpedo Sub, Spotter + Siege Battery ----
  {
    id: 'harbor-v3-hydra-teach',
    map: 'harbor',
    waves: [2],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'A swarm from the west base with a Hydra launched to catch it up, over the open water.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is killed before it splits in most runs by wave 3.',
    notes: {
      sites: 'The north-west silo: the swarm, then the Hydra out of the same silo.',
      target: 'Any ship in the open water.',
      usesMap: 'The far west silo gives the pair the open water to cross, the safe stretch to learn it in.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.35, 0]),
    replaces: { drones: 10, ballistic: 1 },
  },
  {
    id: 'harbor-v3-hydra-combine',
    map: 'harbor',
    waves: [3],
    role: 'combine',
    name: 'Hydra off the headland',
    callout: 'A Hydra swarm off the headland',
    premise: 'The Hydra swarm from the north headland, down onto the ships at the neck, with the wave\'s own fire.',
    decision: 'In the narrows the darts have nowhere to miss: kill it early.',
    counters: 'The Hydra out in the swarm, before it is over the neck.',
    succeeds: 'Hull lost in the narrows to darts stays low.',
    notes: {
      sites: 'The north headland silo: the swarm, then the Hydra out of the same silo.',
      target: 'The ships at the neck.',
      usesMap: 'The headland sits above the neck, so the Hydra\'s darts split where the lane is narrowest.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.35, 1]),
    replaces: { drones: 10, ballistic: 2 },
  },
  {
    id: 'harbor-v3-heli-teach',
    map: 'harbor',
    waves: [4],
    role: 'teach',
    name: 'Helicopter and sub',
    callout: 'A helicopter, and a periscope under it',
    premise: 'An Attack Helicopter hovers by the lane; a Torpedo Sub surfaces on the water under it.',
    decision: 'The helicopter keeps your gun busy; the sub is up only a short time: which first?',
    counters: 'The sub while it is up; the helicopter after.',
    succeeds: 'The sub is shot at while it is up in most runs.',
    notes: {
      sites: 'An Attack Helicopter in from the edge to hover by the lane, and a Torpedo Sub surfacing on the water under it.',
      target: 'The ships on the lane, by the helicopter\'s missile pairs and the sub\'s torpedoes.',
      usesMap: 'Puts fire on the water beside the lane, closer than any silo, before the convoy reaches the funnel.',
    },
    beats: [],
    pairs: pairsOf(['heli-sub', 0.3]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'harbor-v3-heli-combine',
    map: 'harbor',
    waves: [5],
    role: 'combine',
    name: 'Helicopter over the neck',
    callout: 'Helicopter and sub at the neck',
    premise: 'The helicopter and its sub again, now with the wave\'s own fire and the neck closer.',
    decision: 'The pair and the wave at once: what can wait?',
    counters: 'The sub while it is up, then the helicopter.',
    succeeds: 'Ships lost stay within one of wave 4.',
    notes: {
      sites: 'The helicopter and its sub by the lane, with the wave\'s own fire from the silos.',
      target: 'The ships on the lane as they near the neck.',
      usesMap: 'The same pair later in the run, when the convoy is closer to the funnel and has less room.',
    },
    beats: [],
    pairs: pairsOf(['heli-sub', 0.3]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'harbor-v3-spotter-teach',
    map: 'harbor',
    waves: [6],
    role: 'teach',
    name: 'Painted ship',
    callout: 'A Spotter, and a gun rising',
    premise: 'A Spotter flies in and paints a ship; a Siege Battery rises while it paints, so its shells land with the strike it calls.',
    decision: 'The painted ship or the gun: which do you break first?',
    counters: 'The Spotter before it calls, or the gun while it is up.',
    succeeds: 'The Spotter is shot down before its first strike in most runs.',
    notes: {
      sites: 'A Spotter Plane in from the edge, and a Siege Battery out of a hatch on the shore.',
      target: 'The ship the Spotter paints, with the gun\'s shells on circles on the lane.',
      usesMap: 'Strikes called in from off the map, so no silo on the harbour shore warns of them.',
    },
    beats: [],
    pairs: pairsOf(['spotter-siege', 0.25]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'harbor-v3-spotter-combine',
    map: 'harbor',
    waves: [7],
    role: 'combine',
    name: 'Painted at the neck',
    callout: 'Spotter and gun over the neck',
    premise: 'The Spotter and its gun again, with the wave\'s own fire, as the ships reach the neck.',
    decision: 'The wave or the Spotter?',
    counters: 'The Spotter before it calls, then the gun while it is up.',
    succeeds: 'Ships lost stay within one of wave 6.',
    notes: {
      sites: 'The Spotter from the edge and the siege gun from its shore hatch, with the wave\'s own fire.',
      target: 'The painted ship, as the convoy reaches the neck.',
      usesMap: 'Timed for the neck, where a painted ship has nowhere to go.',
    },
    beats: [],
    pairs: pairsOf(['spotter-siege', 0.25]),
    replaces: { drones: 10, guided: 1, ballistic: 1 },
  },
  {
    id: 'harbor-v3-escalate-1',
    map: 'harbor',
    waves: [8],
    role: 'escalate',
    name: 'Two Hydras',
    callout: 'Hydra swarms off both headlands',
    premise: 'A Hydra swarm from the west base, and a second off the north headland as the first closes.',
    decision: 'Two Hydras, one in the open water and one over the neck: which first?',
    counters: 'Each Hydra out in its swarm, the nearer the neck first.',
    succeeds: 'Ships lost stay within one of wave 7.',
    notes: {
      sites: 'Hydra swarms from the north-west silo, then from the north headland silo.',
      target: 'Any ship in the open water, then the ships at the neck.',
      usesMap: 'One Hydra over the open water and one over the narrows: both of the map\'s stretches.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.2, 0], ['hydra-swarm', 0.5, 1]),
    replaces: { drones: 18, ballistic: 2, guided: 2 },
  },
  {
    id: 'harbor-v3-escalate-2',
    map: 'harbor',
    waves: [9],
    role: 'escalate',
    name: 'Hydra and the sub',
    callout: 'Helicopter and sub, then a Hydra swarm',
    premise: 'The helicopter and its sub, and a Hydra swarm from the west once the sub is up.',
    decision: 'Two pairs at the mouth: which half of each do you break?',
    counters: 'The sub while it is up, the Hydra out in its swarm, then the helicopter.',
    succeeds: 'Ships lost stay within one of wave 8: no cliff.',
    notes: {
      sites: 'The helicopter and its sub by the lane, then the Hydra swarm from the north-west silo.',
      target: 'The ships on the lane; the Hydra swarm at any ship.',
      usesMap: 'Close fire on the water beside the lane and a far pair from the west end at once.',
    },
    beats: [],
    pairs: pairsOf(['heli-sub', 0.2], ['hydra-swarm', 0.65, 0]),
    replaces: { drones: 15, ballistic: 4, guided: 4 },
  },
  {
    id: 'harbor-v3-climax',
    map: 'harbor',
    waves: [10],
    role: 'climax',
    name: 'Finale: Hydra and Spotter',
    callout: 'A Hydra swarm, then Spotter and gun',
    premise: 'Two of the pairs you met, one after the other: a Hydra swarm from the west, then the Spotter and its gun.',
    decision: 'What you learned, in order: keep up.',
    counters: 'Each pair\'s own answer, one at a time.',
    succeeds: 'Ships lost are no more than wave 9\'s plus one.',
    notes: {
      sites: 'The Hydra swarm from the north-west silo, then the Spotter from the edge and a siege gun from its shore hatch.',
      target: 'Any ship for the Hydra swarm, then the painted ship.',
      usesMap: 'Starts at the far west with a long look and ends with called-in shells that give none.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.2, 0], ['spotter-siege', 0.5]),
    replaces: { drones: 21, guided: 1, ballistic: 1 },
  },
];

// ---- Wave 1's openers (rev 3) -----------------------------------------------
// The player's round 11 scorecards put wave 1 last on every map: ten or so
// plain drones for 25 s, most often with no encounter. So every version's
// wave 1 now carries its first encounter, or a light opener drawn from it:
// the map says what it is from the first wave, and the wave stays easy (no
// ship lost for the bots that play like the player). An opener may preview
// what the map has by wave 2 (the Strait's first shell, Harbor Mouth's first
// periscope), never anything later. Harbor Mouth's v1 already opens with
// its first encounter (Open water, waves 1-3), so it needs none.

const OPENERS: Omit<Encounter, 'rev' | 'opener'>[] = [
  // ---- v1: the first encounter, lighter ----
  {
    id: 'strait-ranging-opener',
    map: 'strait',
    version: 'v1',
    waves: [1],
    role: 'teach',
    name: 'Ranging shots',
    callout: 'One shell: watch where it lands',
    premise: 'The middle base lights up alone and lobs a single shell at the ship furthest along: the first look at where the threats come from.',
    decision: 'One warning, one place: where will it land?',
    counters: 'Tap the shell as it climbs.',
    succeeds: 'The shell is shot at in most runs; nothing is sunk on wave 1.',
    notes: {
      sites: 'The middle silo on the north shore, on its own.',
      target: 'The lead ship.',
      usesMap: 'One shell across the open water from the silo facing the carrier: the map\'s long warning, shown on wave 1.',
    },
    beats: [{ at: 0.4, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' }],
    replaces: { ballistic: 1 },
  },
  {
    id: 'gauntlet-north-south-opener',
    map: 'gauntlet',
    version: 'v1',
    waves: [1],
    role: 'teach',
    name: 'North, then south',
    callout: 'North shore, then south',
    premise: 'Two drones from the north shore; four seconds later, two from the south.',
    decision: 'Two shores from the first wave: clear one before the other opens.',
    counters: 'Clear north; the south swarm has its own warning.',
    succeeds: 'Taps cross the carrier line once; nothing is sunk on wave 1.',
    notes: {
      sites: 'The north-west silo, then the south-west silo four seconds later.',
      target: 'Any ship on either lane, as the convoy enters the channel.',
      usesMap: 'Shows the two shores on wave 1: a small swarm from each side of the carrier.',
    },
    beats: [
      { at: 0.2, kind: 'drone', count: 2, gap: 0.35, from: base(0) },
      { at: 0.2, plus: 4, kind: 'drone', count: 2, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 4 },
  },
  // ---- v2: a small call-out opener, each the first set piece's setup ----
  {
    id: 'strait-v2-first-light',
    map: 'strait',
    version: 'v2',
    waves: [1],
    role: 'teach',
    name: 'First light',
    callout: 'Drones, a shell, drones: west to east',
    premise: 'A small sweep: a few drones from the west base, a shell from the middle, a few drones from the east, in turn.',
    decision: 'The order the map fires in, slowly: west, middle, east.',
    counters: 'Follow the lit base.',
    succeeds: 'The player meets The sweep on wave 3 knowing the order; nothing is sunk on wave 1.',
    notes: {
      sites: 'The three north-shore silos in turn, west, middle, then east.',
      target: 'Any ship for the drones, the lead ship for the shell.',
      usesMap: 'The row of three silos fired slowly, in the order wave 3\'s sweep will use.',
    },
    beats: [
      { at: 0.35, kind: 'drone', count: 3, gap: 0.35, from: base(0) },
      { at: 0.35, plus: 2, kind: 'ballistic', count: 1, from: base(1), aim: 'lead' },
      { at: 0.35, plus: 4, kind: 'drone', count: 3, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 6, ballistic: 1 },
  },
  {
    id: 'gauntlet-v2-first-look',
    map: 'gauntlet',
    version: 'v2',
    waves: [1],
    role: 'teach',
    name: 'Two shores',
    callout: 'A swarm off each shore',
    premise: 'A small swarm off the north shore and one off the south at the same second: the pincer, in miniature.',
    decision: 'Both shores light together: which first?',
    counters: 'The nearer swarm, then turn.',
    succeeds: 'Both swarms are shot at; nothing is sunk on wave 1.',
    notes: {
      sites: 'The north-west and south-west silos in the same second.',
      target: 'Any ship on either lane.',
      usesMap: 'Both shores at once, in miniature: the pincer of wave 3.',
    },
    beats: [
      { at: 0.2, kind: 'drone', count: 3, gap: 0.35, from: base(0) },
      { at: 0.2, kind: 'drone', count: 3, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 6 },
  },
  {
    id: 'harbor-v2-first-periscope',
    map: 'harbor',
    version: 'v2',
    waves: [1],
    role: 'teach',
    name: 'First periscope',
    callout: 'A periscope off the narrows',
    premise: 'A periscope rises off the mouth of the narrows and the sub lobs one shell into the funnel, long before the ships get there.',
    decision: 'Learn the periscope: it shows before the shells.',
    counters: 'Tap the shell as it climbs.',
    succeeds: 'The player looks at the periscope when it shows; nothing is sunk on wave 1.',
    notes: {
      sites: 'A submarine at the sub spot off the mouth of the narrows.',
      target: 'The ship nearest the narrows.',
      usesMap: 'Shows the periscope over the funnel, the danger stretch, long before the ships reach it.',
    },
    beats: [{ at: 0.4, kind: 'ballistic', count: 1, from: sub(1), aim: 'narrows' }],
    replaces: { ballistic: 1 },
  },
  // ---- v3: the first pair, taught once on the opening wave, early and from
// the far base (out of the nearer bases it sank a ship in one run in ten) ----
  {
    id: 'strait-v3-hydra-opener',
    map: 'strait',
    version: 'v3',
    waves: [1],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'The first pair from the first wave, early: a swarm out of the base furthest from the convoy with a Hydra launched to catch it up.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is shot at before it splits in most runs; nothing is sunk on wave 1.',
    notes: {
      sites: 'The north-shore silo furthest from the convoy (the pair\'s own rule): the swarm, then the Hydra out of it.',
      target: 'Any ship; the Hydra is timed to arrive with the swarm.',
      usesMap: 'The far silo gives the longest look at the pair across the Strait\'s open water.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.25]),
    replaces: { drones: 9 },
  },
  {
    id: 'gauntlet-v3-hydra-opener',
    map: 'gauntlet',
    version: 'v3',
    waves: [1],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'The first pair from the first wave, early: a swarm out of the base furthest from the convoy with a Hydra launched to catch it up.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is shot at before it splits in most runs; nothing is sunk on wave 1.',
    notes: {
      sites: 'The silo furthest from the convoy, on either shore (the pair\'s own rule): the swarm, then the Hydra out of it.',
      target: 'Any ship on either lane; the Hydra is timed to arrive with the swarm.',
      usesMap: 'The far silo gives the most warning a narrow channel between two shores allows.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.25]),
    replaces: { drones: 9 },
  },
  {
    id: 'harbor-v3-hydra-opener',
    map: 'harbor',
    version: 'v3',
    waves: [1],
    role: 'teach',
    name: 'Hydra in the swarm',
    callout: 'A Hydra inside a swarm',
    premise: 'The first pair from the first wave, early: a swarm out of the base furthest from the convoy with a Hydra launched to catch it up.',
    decision: 'Kill the Hydra early, out in the swarm, or let it close and split?',
    counters: 'A shot at the Hydra before the swarm reaches the ships.',
    succeeds: 'The Hydra is shot at before it splits in most runs; nothing is sunk on wave 1.',
    notes: {
      sites: 'The silo furthest from the convoy (the pair\'s own rule): the swarm, then the Hydra out of it.',
      target: 'Any ship, while the convoy is in the open water.',
      usesMap: 'The far silo makes the pair cross open water before it reaches the ships, well before the neck.',
    },
    beats: [],
    pairs: pairsOf(['hydra-swarm', 0.25]),
    replaces: { drones: 9 },
  },
];

// ---- Rev 4: The Gauntlet's v1 plan, rebuilt to the map and wave rules ----
// (map rebuild phase 4; the map card: docs/design/v3-p4-gauntlet.md). One
// encounter a wave, none twice in a row, on the arc: teach (1-2), first
// stakes (3-4), combine (5-6), escalate (7-9), climax (10). Wave 1 keeps
// its rev 3 opener. They replace slice 5's three (`until: 3`).
//   The map's problem: two shores, one carrier between them. Its danger
// stretch is the way in (the west third, between the two west silos, before
// the carrier's guns are close); its safe stretch is the way out (the east
// third, behind the carrier and the frigate). So waves 3-9 aim some of
// their fire at the ship furthest back (`aim: 'rear'`, new in rev 4: the
// ship on the way in) and the rest at any ship, never at the lead (an aim
// at the lead ship lands in the east third: slice 5's shells and missile at
// the lead made the south lane's way out its hottest stretch); only the
// climax aims at the ships about to deliver.
//   Budget: wave 8 was the cliff (two strafers of its own, and slice 5's
// crossfire added a third): its encounter sends no aircraft and gives back
// a little more than it sends; wave 7, the step before, carries the
// strafer instead.
const P4: Omit<Encounter, 'version' | 'rev'>[] = [
  {
    id: 'gauntlet-p4-shell-each-shore',
    map: 'gauntlet',
    waves: [2],
    role: 'teach',
    name: 'A shell from each shore',
    callout: 'One shell north, one south',
    premise: 'A shell from the north shore, three seconds later one from the south, then a small swarm off the north-west.',
    decision: 'The first shells: read where each lands, and turn round for the second.',
    counters: 'A tap on each shell as it climbs; the swarm after has time to spare.',
    succeeds: 'Both shells are shot at in most runs; nothing is sunk on wave 2.',
    notes: {
      sites: 'The north-east silo\'s shell, the south-east silo\'s shell three seconds later, then four drones from the north-west silo.',
      target: 'Any ship (a shell lands on ships not yet past the east third).',
      usesMap: 'Both shores\' shell silos, one after the other, with the carrier between them: the two shores and the shell\'s long arc, taught once each.',
    },
    beats: [
      { at: 0.3, kind: 'ballistic', count: 1, from: base(1) },
      { at: 0.3, plus: 3, kind: 'ballistic', count: 1, from: base(3) },
      { at: 0.3, plus: 5.5, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
    ],
    replaces: { ballistic: 2, drones: 4 },
  },
  {
    id: 'gauntlet-p4-way-in',
    map: 'gauntlet',
    waves: [3],
    role: 'teach',
    name: 'The way in',
    callout: 'Swarms off both shores at once',
    premise: 'Both west shores launch a swarm a second apart, at the ships just coming in.',
    decision: 'Two swarms, one each side of the ships coming in: which shore first, and is there time for the other?',
    counters: 'The nearer swarm, then turn: the second is a second behind.',
    succeeds: 'A close call on a ship in most runs; a good player loses under half a ship.',
    notes: {
      sites: 'The north-west silo, then the south-west silo a second later.',
      target: 'The ship furthest back, on the way in, for the north swarm; any ship for the south one (from that silo the shortest flights land on the way in too).',
      usesMap: 'The two silos facing each other across the way in make the first real pincer on the danger stretch, before the carrier\'s guns are close.',
    },
    beats: [
      { at: 0.35, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'rear' },
      { at: 0.35, plus: 1, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
    ],
    replaces: { drones: 8 },
  },
  {
    id: 'gauntlet-p4-periscope',
    map: 'gauntlet',
    waves: [4],
    role: 'teach',
    name: 'Periscope in the channel',
    callout: 'A sub between the two lines',
    premise: 'A periscope rises in the open water between the two lines of ships, west of the carrier, and the sub fires three shells as a swarm comes off the south-west.',
    decision: 'The threat is between your ships, not on a shore: which line is it shooting at?',
    counters: 'Tap each shell as it climbs (the periscope gives two seconds), then the swarm.',
    succeeds: 'A close call in most runs; ships lost on wave 4 stay under a fifth of one a run for a good player.',
    notes: {
      sites: 'A submarine at the west sub spot, in the channel between the two lanes, then four drones from the south-west silo.',
      target: 'The ship furthest back, on the way in, for the shells and the swarm.',
      usesMap: 'The water between the lanes is the one place neither shore covers: the sub there has the shortest warning on the map so far, right beside the way in.',
    },
    beats: [
      { at: 0.45, kind: 'ballistic', count: 3, gap: 0.8, from: sub(0), aim: 'rear' },
      { at: 0.45, plus: 1, kind: 'drone', count: 4, gap: 0.35, from: base(2), aim: 'rear' },
    ],
    replaces: { ballistic: 2, drones: 5 },
  },
  {
    id: 'gauntlet-p4-overlap',
    map: 'gauntlet',
    waves: [5],
    role: 'combine',
    name: 'Overlap',
    callout: 'Shells and a swarm, two shores',
    premise: 'Shells from the north-east while a swarm is still coming off the south-west, and a guided missile behind the swarm.',
    decision: 'Two shores at once and two kinds of answer: which line do you save first?',
    counters: 'Shells first (they are committed and few), then the missile, then the swarm.',
    succeeds: 'Both shores have threats in the air together for three seconds or more; the far line is not abandoned.',
    notes: {
      sites: 'The south-west silo\'s swarm, two shells from the north-east silo, then a guided missile from the south-west silo.',
      target: 'Any ship for the swarm and the shells; the ship furthest back, on the way in, for the missile.',
      usesMap: 'Opposite shores and opposite ends of the channel, so the two threats never sit in one sweep of the thumb.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 6, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 1.2, kind: 'ballistic', count: 2, gap: 0.9, from: base(1) },
      { at: 0.45, plus: 2.4, kind: 'guided', count: 1, from: base(2), aim: 'rear' },
    ],
    replaces: { drones: 6, ballistic: 2, guided: 1 },
  },
  {
    id: 'gauntlet-p4-crossing',
    map: 'gauntlet',
    waves: [6],
    role: 'combine',
    name: 'The crossing',
    callout: 'Drones north, missiles south',
    premise: 'A swarm off the north-west, two guided missiles off the south-west a second later, and a periscope between them.',
    decision: 'North swarm, south missiles, a sub in the middle: three directions at the way in. What goes first?',
    counters: 'The missiles (two taps), then the shells as they climb; the swarm is slowest.',
    succeeds: 'Both shores and the sub are shot at in most runs; the missiles are not the ones that land.',
    notes: {
      sites: 'The north-west silo\'s swarm, two guided missiles from the south-west silo, then a submarine at the west sub spot.',
      target: 'The ship furthest back, on the way in, for the swarm and the first missile; any ship for the second missile and the shells.',
      usesMap: 'All three of the west end\'s launchers at once, across and between the two lanes, on the danger stretch.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 5, gap: 0.35, from: base(0), aim: 'rear' },
      { at: 0.4, plus: 1, kind: 'guided', count: 1, from: base(2), aim: 'rear' },
      { at: 0.4, plus: 1.9, kind: 'guided', count: 1, from: base(2) },
      { at: 0.4, plus: 2.5, kind: 'ballistic', count: 2, gap: 0.8, from: sub(0) },
    ],
    replaces: { drones: 5, guided: 2, ballistic: 3 },
  },
  {
    id: 'gauntlet-p4-strafing-run',
    map: 'gauntlet',
    waves: [7],
    role: 'escalate',
    name: 'Strafing run',
    callout: 'A jet down the middle',
    premise: 'A swarm off the north-west and two guided missiles off the south-west, and a strafing jet comes in from the west down the channel between the lines; shells from the north-east follow.',
    decision: 'The jet has the shortest fuse but the missiles are already in the air: jet first, or the missiles?',
    counters: 'The jet as soon as it turns in (an aimed shot), the missiles next, then the shells; the swarm last.',
    succeeds: 'The jet is shot at in most runs; wave 7 costs more than wave 6, so wave 8 is no cliff.',
    notes: {
      sites: 'The north-west silo\'s swarm and two guided missiles from the south-west silo together, a strafer in from the west edge, then two shells from the north-east silo.',
      target: 'The ship furthest back, on the way in, for the first missile; any ship for the rest (the strafer picks its run as it comes in).',
      usesMap: 'The air down the middle of the channel, past the carrier, with both west shores closing on the way in.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.45, kind: 'guided', count: 1, from: base(2), aim: 'rear' },
      { at: 0.45, plus: 0.9, kind: 'guided', count: 1, from: base(2) },
      { at: 0.45, plus: 1.5, kind: 'strafer', count: 1, from: { air: 1 } },
      { at: 0.45, plus: 3, kind: 'ballistic', count: 2, gap: 0.9, from: base(1) },
    ],
    replaces: { drones: 9, ballistic: 2, guided: 2 },
  },
  {
    id: 'gauntlet-p4-long-way-round',
    map: 'gauntlet',
    waves: [8],
    role: 'escalate',
    name: 'The long way round',
    callout: 'Swarms from opposite corners',
    premise: 'A swarm off the north-east and one off the south-west, from opposite corners of the channel, then a guided missile at the ships coming in.',
    decision: 'Two slow swarms from opposite corners and a missile, on top of a wave with two jets in it: which can wait?',
    counters: 'An area weapon on the nearest swarm; the north-east one flies the length of the channel, so there is time to meet it.',
    succeeds: 'Both swarms are met before the ships; wave 8 loses no more than twice wave 7.',
    notes: {
      sites: 'The north-east and south-west silos\' swarms together, then a guided missile from the south-west silo.',
      target: 'Any ship for the swarms; the ship furthest back, on the way in, for the missile.',
      usesMap: 'Opposite corners of the channel, the north-east swarm crossing the whole map and the south-west one meeting the ships coming in with a missile behind it; wave 8 already brings a second strafer, so this encounter is slow threats in place of four of the wave\'s shells.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
      { at: 0.45, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
      { at: 0.45, plus: 2.5, kind: 'guided', count: 1, from: base(2), aim: 'rear' },
    ],
    replaces: { ballistic: 4, drones: 8, guided: 1 },
  },
  {
    id: 'gauntlet-p4-crossfire',
    map: 'gauntlet',
    waves: [9],
    role: 'escalate',
    name: 'Crossfire',
    callout: 'Both shores, and a sub between',
    premise: 'Both west shores open together, two guided missiles follow off the south shore, and a periscope between the lines lets out a swarm of its own.',
    decision: 'Everything is warned of at once, from the north, the south and between your ships: what can wait two seconds, and what cannot?',
    counters: 'The missiles first (aimed shots); an area weapon where the swarms meet; the sub\'s swarm is the nearest.',
    succeeds: 'The most threats on screen at once is higher than in the shared wave with no more launched; a person can say afterwards what hit them.',
    notes: {
      sites: 'The north-west and south-west silos\' swarms together, two guided missiles from the south-west silo, then a submarine at the west sub spot launching drones.',
      target: 'Any ship for the shores\' swarms and the missiles; the ship furthest back, on the way in, for the sub\'s swarm.',
      usesMap: 'North shore, south shore and the water between the lanes, all on the way in; it takes three of the wave\'s shells (which land anywhere) for drones, so the way out stays the safe stretch, and wave 9 already has two strafers of its own, so no jet here.',
    },
    beats: [
      { at: 0.55, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
      { at: 0.55, kind: 'drone', count: 5, gap: 0.35, from: base(2) },
      { at: 0.55, plus: 1.2, kind: 'guided', count: 2, gap: 0.9, from: base(2) },
      { at: 0.55, plus: 2.5, kind: 'drone', count: 3, gap: 0.35, from: sub(0), aim: 'rear' },
    ],
    replaces: { drones: 13, guided: 2, ballistic: 3 },
  },
  {
    id: 'gauntlet-p4-run-the-gauntlet',
    map: 'gauntlet',
    waves: [10],
    role: 'climax',
    name: 'Run the gauntlet',
    callout: 'Everything, both shores',
    premise: 'Late in the wave: all four shores fire and a periscope rises east of the carrier, the shells and missiles all at the ships about to deliver.',
    decision: 'The ships nearly home are the ones aimed at, from every side: which of them can you still save?',
    counters: 'Missiles and shells on the lead ships first; the swarms come last.',
    succeeds: 'Wave 10 is the hardest of the ten without ending the run for every kit.',
    notes: {
      sites: 'The north-west and south-west silos\' swarms, shells from the north-east silo, guided missiles from the south-east silo, and a submarine at the east-middle sub spot.',
      target: 'The lead ship (about to deliver) for the shells and missiles, any ship for the swarms.',
      usesMap: 'The climax is the one wave allowed to hit the safe stretch: the way out, behind the carrier, from both east silos and the sub beside the frigate.',
    },
    beats: [
      { at: 0.7, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.7, kind: 'drone', count: 4, gap: 0.35, from: base(2) },
      { at: 0.7, plus: 1, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.7, plus: 1.5, kind: 'guided', count: 2, gap: 0.9, from: base(3), aim: 'lead' },
      { at: 0.7, plus: 2.5, kind: 'ballistic', count: 2, gap: 0.8, from: sub(1), aim: 'lead' },
    ],
    replaces: { drones: 18, ballistic: 4, guided: 2 },
  },
];

// ---- Rev 4: Harbor Mouth's v1, rebuilt to the map and wave rules ---------
// (map rebuild phase 4, docs/design/v3-p4-harbor.md). One encounter a wave,
// none twice in a row, each built on the neck: the lane closes from x 700
// and the ships bunch up just before delivery. Everything an encounter sends
// comes out of the wave's drones (and its guided missiles where it has
// some), never its shells: a submarine fills its salvo to four whatever it
// is given, so taking shells out emptied the wave's own subs (rev 3's
// Funnel salvo cut waves 4-7 to two thirds). Rev 3's three keep playing in
// a rev 3 log (`until: 3`).

const HARBOR_R4: Omit<Encounter, 'version' | 'rev'>[] = [
  {
    id: 'harbor-first-look',
    map: 'harbor',
    waves: [1],
    role: 'teach',
    name: 'Over the neck',
    callout: 'Two drones over the harbour neck',
    premise: 'Two drones drop off the north headland straight at the ship nearest the narrows: wave 1 shows where the map bites.',
    decision: 'The neck is where every ship has to pass: look there first.',
    counters: 'Any tap on the pair before it reaches the narrows.',
    succeeds: 'The pair is shot at before it reaches a hull in most runs; nothing is sunk on wave 1.',
    notes: {
      sites: 'The north-east headland silo, the one over the neck.',
      target: 'The ship nearest the mouth of the narrows (the lead ship until one gets there).',
      usesMap: 'Shows the neck on wave 1: the headland silo looks down on the narrows, where the lane closes and the ships bunch up.',
    },
    beats: [{ at: 0.45, kind: 'drone', count: 2, gap: 0.35, from: base(1), aim: 'narrows' }],
    replaces: { drones: 2 },
  },
  {
    id: 'harbor-wide-water',
    map: 'harbor',
    waves: [2],
    role: 'teach',
    name: 'Open water',
    callout: 'A swarm on the open water',
    premise: 'The far west base sends a swarm across the wide water, where the ships sail spread out.',
    decision: 'Learn the two halves of the map: the wide water forgives, the neck will not.',
    counters: 'Ordinary interception: the swarm has a long run in.',
    succeeds: 'Hull lost on the open water stays small; the swarm is cleared before the ships reach the neck.',
    notes: {
      sites: 'The north-west silo, the one furthest from the harbour.',
      target: 'Any ship, while the convoy is still in the wide water in the west.',
      usesMap: 'The open water is the safe stretch: a long warning and ships far apart, the contrast to wave 1\'s neck.',
    },
    beats: [{ at: 0.3, kind: 'drone', count: 4, gap: 0.35, from: base(0) }],
    replaces: { drones: 4 },
  },
  {
    id: 'harbor-periscope',
    map: 'harbor',
    waves: [3],
    role: 'teach',
    name: 'First periscope',
    callout: 'A periscope off the narrows',
    premise: 'A periscope rises off the mouth of the narrows and the sub lobs three shells into the funnel; two drones follow off the north headland.',
    decision: 'The periscope shows before the shells: is a weapon ready over the neck when they fall?',
    counters: 'Tap each shell as it climbs; the periscope is the warning. The two drones are slow.',
    succeeds: 'The shells are shot at in most runs; a ship hit in the neck is the first real stake of the map.',
    notes: {
      sites: 'A submarine at the sub spot off the mouth of the narrows, north-east of the neck, then the north-east headland silo.',
      target: 'The ship nearest the narrows, as it enters the funnel, for the shells and the drones.',
      usesMap: 'The sub\'s short warning lands on the danger stretch, where the lane closes and the ships cannot spread out: the map\'s first real stake.',
    },
    beats: [
      { at: 0.45, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'narrows' },
      { at: 0.45, plus: 1, kind: 'drone', count: 2, gap: 0.35, from: base(1), aim: 'narrows' },
    ],
    replaces: { drones: 5 },
  },
  {
    id: 'harbor-south-headland',
    map: 'harbor',
    waves: [4],
    role: 'teach',
    name: 'South headland',
    callout: 'Missiles and drones from the south',
    premise: 'The south headland opens up: a few drones at the ship in the narrows, two guided missiles at the lead ship, and a shell from the harbour mouth.',
    decision: 'Fire now comes from the friendly side of the neck too: the missiles or the shell first?',
    counters: 'The missiles first (a tap each), the shell as it climbs; the drones are slow and few.',
    succeeds: 'The missiles are shot at before they reach the lead ship in most runs; a good player loses at most one ship by wave 5.',
    notes: {
      sites: 'The south headland silo on the south shore at the neck, then the south-east silo at the harbour mouth.',
      target: 'The ship nearest the narrows for the drones and the shell, the lead ship for the missiles.',
      usesMap: 'The second headland: the neck can be hit from both shores, and the south one is the closest of all to the ships.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 3, gap: 0.35, from: base(3), aim: 'narrows' },
      { at: 0.4, plus: 1.5, kind: 'guided', count: 2, gap: 0.9, from: base(3), aim: 'lead' },
      { at: 0.4, plus: 3, kind: 'ballistic', count: 1, from: base(4), aim: 'narrows' },
    ],
    replaces: { drones: 5, guided: 1 },
  },
  {
    id: 'harbor-funnel-tail',
    map: 'harbor',
    waves: [5],
    role: 'combine',
    name: 'Funnel and tail',
    callout: 'Shells in the neck, drones behind',
    premise: 'A sub fires three shells into the funnel as a swarm comes in from the west at the ships still in the wide water.',
    decision: 'The front of the convoy is in the neck and the back is in the open: which end do you cover?',
    counters: 'Taps for the shells as they climb; an area weapon left on the open water for the swarm.',
    succeeds: 'Both are shot at; the ships in the open water are not left to the swarm.',
    notes: {
      sites: 'A submarine off the mouth of the narrows, and the north-west silo.',
      target: 'The ship nearest the narrows for the shells, any ship (the back of the convoy) for the swarm.',
      usesMap: 'Front and back of the convoy at once: the neck at one end, the open water at the other.',
    },
    beats: [
      { at: 0.45, kind: 'ballistic', count: 3, gap: 0.75, from: sub(1), aim: 'narrows' },
      { at: 0.45, plus: 0.5, kind: 'drone', count: 5, gap: 0.35, from: base(0) },
    ],
    replaces: { drones: 9 },
  },
  {
    id: 'harbor-both-headlands',
    map: 'harbor',
    waves: [6],
    role: 'combine',
    name: 'Both headlands',
    callout: 'Swarms from both shores at once',
    premise: 'Both headlands fire at once: a swarm from the north and one from the south, both at the ship in the narrows; then a missile from the south at the lead ship.',
    decision: 'Two swarms closing on one ship from opposite sides, and a missile behind them: split your fire or clear one first?',
    counters: 'The swarms meet over the neck, where one shot can take several; save a tap for the missile.',
    succeeds: 'Both swarms are shot at in most runs; the missile is shot at before it lands; hull lost sits in the neck, not the open water.',
    notes: {
      sites: 'The north-east headland silo and the south headland silo together, then the south headland silo again for the missile.',
      target: 'The ship nearest the narrows for the swarms, the lead ship for the missile.',
      usesMap: 'The two headlands face each other across the neck: the swarms meet where the ships bunch, from the north and the south at once.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 3, gap: 0.35, from: base(1), aim: 'narrows' },
      { at: 0.4, kind: 'drone', count: 3, gap: 0.35, from: base(3), aim: 'narrows' },
      { at: 0.4, plus: 3, kind: 'guided', count: 1, from: base(3), aim: 'lead' },
    ],
    replaces: { drones: 8 },
  },
  {
    id: 'harbor-front-and-back',
    map: 'harbor',
    waves: [7],
    role: 'escalate',
    name: 'Front and back',
    callout: 'Drones ahead and behind',
    premise: 'Two drones drop off the north headland at the ship about to deliver, as a swarm comes in from the west at the ships still in the open water.',
    decision: 'The front of the convoy is nearly home and the back is in the wide water: which end gets your taps?',
    counters: 'The pair at the front first (short flight); the swarm behind has a long run in.',
    succeeds: 'Both ends are shot at; the back of the convoy is not left to the swarm. Wave 7 steps up without doubling wave 6.',
    notes: {
      sites: 'The north-east headland silo for the pair, the north-west silo for the swarm.',
      target: 'The lead ship for the pair, any ship (the back of the convoy) for the swarm.',
      usesMap: 'The two ends of the convoy, the last mile and the open water, at once, and light on purpose: the shared wave 7 is the step up (the mothership, a second strafer), so this encounter adds a choice, not weight.',
    },
    beats: [
      { at: 0.5, kind: 'drone', count: 2, gap: 0.35, from: base(1), aim: 'lead' },
      { at: 0.5, plus: 0.5, kind: 'drone', count: 3, gap: 0.35, from: base(0) },
    ],
    replaces: { drones: 5, guided: 1 },
  },
  {
    id: 'harbor-wolf-pack',
    map: 'harbor',
    waves: [8],
    role: 'escalate',
    name: 'Wolf pack',
    callout: 'Two periscopes, two salvos',
    premise: 'Two subs surface a few seconds apart, each with two shells: one in the open water to the west, one off the narrows.',
    decision: 'Two periscopes, two salvos: which one lands on a ship first?',
    counters: 'The first salvo, then turn: the second periscope gives its own warning.',
    succeeds: 'Both salvos are shot at; wave 8 hurts without ending the run.',
    notes: {
      sites: 'A submarine at the north-west sub spot, then one off the mouth of the narrows.',
      target: 'Any ship for the first salvo, the ship nearest the narrows for the second.',
      usesMap: 'The open water and the neck, one after the other, a few seconds apart, sending fewer than it takes out of the wave (about nine tenths of the shared wave) because wave 8 is the shared table\'s big step.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 2, gap: 0.75, from: sub(0) },
      { at: 0.4, plus: 4, kind: 'ballistic', count: 2, gap: 0.75, from: sub(1), aim: 'narrows' },
    ],
    replaces: { drones: 7 },
  },
  {
    id: 'harbor-crossfire',
    map: 'harbor',
    waves: [9],
    role: 'escalate',
    name: 'Crossfire at the neck',
    callout: 'Fire from both sides of the neck',
    premise: 'A swarm from the north headland, a guided missile from the south and shells from the harbour mouth, all at the neck.',
    decision: 'Three answers in four seconds, from three sides: what can wait?',
    counters: 'The missile first, the shells as they climb, the swarm last.',
    succeeds: 'All three are shot at; hull lost sits in the neck.',
    notes: {
      sites: 'The north-east headland silo, the south headland silo, then the south-east silo at the mouth.',
      target: 'The ship nearest the narrows for the swarm and the shells, the lead ship for the missile.',
      usesMap: 'Three silos round the neck fire into it from both shores.',
    },
    beats: [
      { at: 0.5, kind: 'drone', count: 4, gap: 0.35, from: base(1), aim: 'narrows' },
      { at: 0.5, plus: 1.5, kind: 'guided', count: 1, from: base(3), aim: 'lead' },
      { at: 0.5, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(4), aim: 'narrows' },
    ],
    replaces: { drones: 8 },
  },
  {
    id: 'harbor-final-mile',
    map: 'harbor',
    waves: [10],
    role: 'climax',
    name: 'The last mile',
    callout: 'Everything on the last mile',
    premise: 'A breath of five seconds with nothing in the air, then everything round the harbour mouth fires down the funnel at the ships about to deliver.',
    decision: 'The ships nearest home are the ones aimed at: defend the last mile or the ones behind?',
    counters: 'The missile first; the shells as they climb; the swarm is slower than it looks from this side.',
    succeeds: 'The calm is noticed (nothing launches for 5 s before it); sinkings in the last third do not rise against the shared wave, with the same number launched.',
    notes: {
      sites: 'The far north-east silo, the south headland silo, then the south-east silo at the mouth.',
      target: 'The lead ship for the missile, any ship for the swarm, the ship nearest the narrows for the shells.',
      usesMap: 'Three silos round the harbour mouth at once, into the last mile of the funnel, after a short calm (`calm`: the wave\'s own raids in the 5 s before it come earlier).',
    },
    beats: [
      { at: 0.55, kind: 'guided', count: 1, from: base(2), aim: 'lead' },
      { at: 0.55, plus: 1.5, kind: 'drone', count: 4, gap: 0.35, from: base(3) },
      { at: 0.55, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(4), aim: 'narrows' },
    ],
    replaces: { drones: 8, guided: 2 },
    calm: 5,
  },
];

// ---- Rev 4: chapter 1's Kesh Hook, rebuilt to the map and wave rules ------
// (map rebuild, chapter 1; the map card: docs/design/v3-ch1-kesh.md). The
// lane runs east along the south bank, then hooks north round Cape Marrow
// hard against the enemy's outer bank. Its problem is the apex of the turn
// (the middle third of the lane): the convoy bunches as it turns and passes
// closest to the south silo, with the least warning; the way out north (the
// last third) is under the carrier's guns, inside the turn. So the
// encounters fire at the apex from the south silo, aimed at the ship
// nearest it (`aim: 'near'`, new in rev 4 here: from that silo, the ship in
// the turn), and keep the way out quiet until the climax. Kesh has no
// mechanic of its own: the hook is a shape (rule m-mechanic). What an
// encounter sends comes out of the wave's drones and guided missiles, never
// its shells (Harbor Mouth's lesson: a sub fills its salvo whatever it is
// given).
const KESH_R4: Omit<Encounter, 'version' | 'rev'>[] = [
  {
    id: 'kesh-first-turn',
    map: 'kesh',
    waves: [1],
    role: 'teach',
    name: 'Into the turn',
    callout: 'Drones at the turn',
    premise: 'The south silo sends a few drones at the first ship rounding the hook.',
    decision: 'The first look at the apex: the silo sits right over the turn, so its drones arrive quickly.',
    counters: 'Tap the drones as they leave the bank; they have the shortest flight on the map.',
    succeeds: 'Nothing is sunk on wave 1; the drones are shot down over the turn.',
    notes: {
      sites: 'The south silo on the outer bank, over the apex of the turn.',
      target: 'The ship nearest the silo: the one rounding the apex (the middle third).',
      usesMap: 'Shows the map\'s problem on wave 1: the hook runs the ships past the south silo, closer than anything on the Strait.',
    },
    beats: [{ at: 0.3, kind: 'drone', count: 3, gap: 0.35, from: base(0), aim: 'near' }],
    replaces: { drones: 3 },
  },
  {
    id: 'kesh-long-reach',
    map: 'kesh',
    waves: [2],
    role: 'teach',
    name: 'Across the hook',
    callout: 'A swarm across the water',
    premise: 'The east silo sends a swarm right across the hook at the ships still coming in; a shell from the south silo follows at the turn.',
    decision: 'The longest warning and the shortest on one map: meet the swarm over the water, and be ready for the shell at the turn.',
    counters: 'Tap the swarm anywhere on its long flight; the shell needs one tap as it climbs.',
    succeeds: 'The swarm is cleared before it reaches the lane in most runs; no ship lost on wave 2.',
    notes: {
      sites: 'The east silo on the outer bank for the swarm, then the south silo for a shell.',
      target: 'The swarm at the ship furthest back (on the straight, coming in), the shell at the ship nearest the south silo, in the turn.',
      usesMap: 'The east silo is the furthest from the way in, so its swarm crosses the whole hook: the near and far timing contrast of the map, side by side.',
    },
    beats: [
      { at: 0.3, kind: 'drone', count: 5, gap: 0.35, from: base(1), aim: 'rear' },
      { at: 0.3, plus: 3, kind: 'ballistic', count: 1, from: base(0), aim: 'near' },
    ],
    replaces: { drones: 6 },
  },
  {
    id: 'kesh-apex-shells',
    map: 'kesh',
    waves: [3],
    role: 'teach',
    name: 'Shells at the apex',
    callout: 'Shells at the turn',
    premise: 'The south silo lobs two shells at the ships in the turn, then sends a swarm after them.',
    decision: 'The first stakes: the shells land quickly and the swarm is right behind. Shells first, or the swarm?',
    counters: 'A tap on each shell as it climbs, then the swarm before it reaches the turn.',
    succeeds: 'A close call on a ship in the turn in most runs; a good player loses under half a ship.',
    notes: {
      sites: 'The south silo on the outer bank, for the shells and the swarm.',
      target: 'The shells at the ship nearest the silo, rounding the apex (the middle third); the swarm at any ship.',
      usesMap: 'Everything from the silo over the turn: the shortest warning on the map, on the stretch where the ships bunch.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 2, gap: 1, from: base(0), aim: 'near' },
      { at: 0.4, plus: 2, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
    ],
    replaces: { drones: 6 },
  },
  {
    id: 'kesh-hook-periscope',
    map: 'kesh',
    waves: [4],
    role: 'teach',
    name: 'Periscope in the hook',
    callout: 'A sub inside the turn',
    premise: 'A periscope rises in the water inside the hook and the sub fires three shells; the south silo sends a swarm at the turn at the same time.',
    decision: 'Two launchers, two sides of the ships in the turn: the sub behind them, the silo ahead.',
    counters: 'The shells first, as they climb (they are committed); the swarm has the length of the bank to cross.',
    succeeds: 'The salvo is shot at in most runs; hull lost lands in the turn, not on the way out.',
    notes: {
      sites: 'A submarine at the sub spot inside the hook (1075, 300), then the south silo.',
      target: 'The shells at the ship halfway along the lane (the apex), the swarm at the ship nearest the south silo.',
      usesMap: 'The only water inside the turn: a launcher on the carrier\'s side of the lane, so the ships in the turn are fired on from both banks.',
    },
    beats: [
      { at: 0.45, kind: 'ballistic', count: 3, gap: 0.75, from: sub(0), aim: 'mid' },
      { at: 0.45, plus: 0.5, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'near' },
    ],
    replaces: { drones: 7 },
  },
  {
    id: 'kesh-two-banks',
    map: 'kesh',
    waves: [5],
    role: 'combine',
    name: 'Front and back',
    callout: 'The turn and the way in',
    premise: 'A swarm from the south silo at the turn, and two guided missiles from the east silo at the ships still on the straight.',
    decision: 'The ships in the turn or the ships coming in: the two threats fly to opposite ends of the convoy.',
    counters: 'The swarm is close and quick; the missiles have a long way to fly, so take them second.',
    succeeds: 'Both are shot at in most runs; a lost ship is in the turn, not on the straight.',
    notes: {
      sites: 'The south silo for the swarm, the east silo for the two guided missiles.',
      target: 'The swarm at the ship nearest the south silo (the turn), the missiles at the ship furthest back (the straight).',
      usesMap: 'The hook puts the way in and the apex far apart under one shore: one decision, two directions.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 5, gap: 0.35, from: base(0), aim: 'near' },
      { at: 0.45, plus: 1, kind: 'guided', count: 2, gap: 0.9, from: base(1), aim: 'rear' },
      { at: 0.45, plus: 2.5, kind: 'ballistic', count: 1, from: base(0), aim: 'near' },
    ],
    replaces: { drones: 6, guided: 2 },
  },
  {
    id: 'kesh-bunch',
    map: 'kesh',
    waves: [6],
    role: 'combine',
    name: 'Bunched in the turn',
    callout: 'Shells and drones at the turn',
    premise: 'A swarm at the turn, then two shells from the south silo into the bunch, and a periscope rises inside the hook for two more.',
    decision: 'The turn is fired on from the outer bank and from inside the hook: which launcher first?',
    counters: 'A blast in the turn takes the swarm; the shells need a tap each; the periscope warns of the sub\'s.',
    succeeds: 'The shells in the turn are shot at in most runs; no wave-6 cliff.',
    notes: {
      sites: 'The south silo for the swarm and two shells, a submarine at the sub spot inside the hook (1075, 300) for two.',
      target: 'The silo\'s fire at the ship nearest it (the turn), the sub\'s at the ship halfway along the lane (the apex).',
      usesMap: 'The convoy bunches as it turns: fire into the bunch from both banks of the turn.',
    },
    beats: [
      { at: 0.35, kind: 'drone', count: 5, gap: 0.35, from: base(0), aim: 'near' },
      { at: 0.35, plus: 2.5, kind: 'ballistic', count: 2, gap: 0.8, from: base(0), aim: 'near' },
      { at: 0.65, kind: 'ballistic', count: 2, gap: 0.75, from: sub(0), aim: 'mid' },
    ],
    replaces: { drones: 9, guided: 2 },
  },
  {
    id: 'kesh-strafe-the-turn',
    map: 'kesh',
    waves: [7],
    role: 'escalate',
    name: 'Strafing the hook',
    callout: 'A jet round the hook',
    premise: 'A strafer comes in from the west along the lane, and as it reaches the turn the south silo sends a swarm; two guided missiles from the east follow at the turn.',
    decision: 'The jet has the shortest fuse; the swarm is the most damage. One of them gets a ship if you wait.',
    counters: 'The jet first, before its guns reach the convoy; then the swarm at the turn; the missiles last.',
    succeeds: 'The jet is shot down before it passes the turn in most runs.',
    notes: {
      sites: 'A strafer from the west edge, the south silo\'s swarm, the east silo\'s two guided missiles.',
      target: 'The jet down the lane, the swarm at any ship, the missiles at the ship halfway along the lane (the apex).',
      usesMap: 'The jet follows the lane round the hook into the turn, where the swarm meets it: the apex from the air and the bank at once.',
    },
    beats: [
      { at: 0.4, kind: 'strafer', count: 1, from: { air: 1 } },
      { at: 0.4, plus: 2, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.4, plus: 3.5, kind: 'guided', count: 2, gap: 0.9, from: base(1), aim: 'mid' },
    ],
    replaces: { drones: 9, guided: 2 },
  },
  {
    id: 'kesh-outer-bank',
    map: 'kesh',
    waves: [8],
    role: 'escalate',
    name: 'The whole outer bank',
    callout: 'Swarms and shells, south to north',
    premise: 'The three silos on the outer bank fire in turn, south to north: a swarm, a second swarm across the hook, then shells, the last two at the ships in the turn.',
    decision: 'Three answers in turn along the bank: follow the lit silo, or get ahead of the last one?',
    counters: 'The south swarm first (it is closest), the east swarm has time; the shells need the taps.',
    succeeds: 'Launches overlap more than in the shared wave with no more of them: harder by timing, not by count.',
    notes: {
      sites: 'The south silo, then the east silo, then the north-east silo, a second or two apart.',
      target: 'The south swarm at any ship, the east swarm and the north-east shells at the ship halfway along the lane (the apex).',
      usesMap: 'The outer bank wraps round the hook: fire that sweeps along it follows the convoy through the turn.',
    },
    beats: [
      { at: 0.45, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.45, plus: 1.5, kind: 'drone', count: 4, gap: 0.35, from: base(1), aim: 'mid' },
      { at: 0.45, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(2), aim: 'mid' },
    ],
    replaces: { drones: 11 },
  },
  {
    id: 'kesh-crossfire',
    map: 'kesh',
    waves: [9],
    role: 'escalate',
    name: 'Crossfire in the turn',
    callout: 'Shells and missiles at the turn',
    premise: 'The south silo opens on the turn with a swarm and three shells, and two guided missiles from the east silo come in on the same ships.',
    decision: 'The ships in the turn are fired on from the south and the east at once. What can wait two seconds?',
    counters: 'Shells as they climb; a blast in the turn for the swarm; the missiles have the longest flight.',
    succeeds: 'Most of the fire is shot at before it lands; a lost ship is in the turn.',
    notes: {
      sites: 'The south silo (a swarm and three shells), the east silo (two guided).',
      target: 'The south silo\'s fire at the ship nearest it (the turn), the missiles at the ship halfway along the lane (the apex).',
      usesMap: 'Two silos of the outer bank at right angles to each other, both on the apex: the turn has no quiet side.',
    },
    beats: [
      { at: 0.5, kind: 'drone', count: 6, gap: 0.35, from: base(0), aim: 'near' },
      { at: 0.5, plus: 1.5, kind: 'ballistic', count: 3, gap: 0.8, from: base(0), aim: 'near' },
      { at: 0.5, plus: 3, kind: 'guided', count: 2, gap: 0.9, from: base(1), aim: 'mid' },
    ],
    replaces: { drones: 9, guided: 2 },
  },
  {
    id: 'kesh-round-the-hook',
    map: 'kesh',
    waves: [10],
    role: 'climax',
    name: 'Round the hook',
    callout: 'Everything on the bank',
    premise: 'After a short calm, the whole outer bank fires on the ships in the turn and the ones leaving north.',
    decision: 'Everything at once, from the south, the east and the north-east: save the turn, or the ships about to deliver?',
    counters: 'The swarms in the turn with a blast; the missiles and shells at the lead ship with aimed taps.',
    succeeds: 'A close call on the last ship out in most runs; the climax is the hardest wave.',
    notes: {
      sites: 'The south silo (a swarm and shells), the east silo (a swarm and two guided), the north-east silo (two shells), after a calm.',
      target: 'The swarms at any ship, the south silo\'s shells at the ship nearest it (the turn); the east missiles and the north-east shells at the lead ship, on the way out.',
      usesMap: 'The climax may hit the safe stretch: the way out north, under the carrier, gets the east and north-east silos for the first time.',
    },
    beats: [
      { at: 0.6, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.6, plus: 1, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
      { at: 0.6, plus: 2, kind: 'guided', count: 2, gap: 0.8, from: base(1), aim: 'lead' },
      { at: 0.6, plus: 3, kind: 'ballistic', count: 2, gap: 0.8, from: base(0), aim: 'near' },
      { at: 0.6, plus: 4, kind: 'ballistic', count: 2, gap: 0.8, from: base(2), aim: 'lead' },
    ],
    replaces: { drones: 12, guided: 2 },
    calm: 5,
  },
];

// ---- Rev 4: chapter 1's Lee of Marrow, rebuilt to the map and wave rules ---
// (map rebuild, chapter 1; the map card: docs/design/v3-ch1-marrow.md). The
// Strait's layout with a friendly island between the enemy shore and the
// lane, and the map's one mechanic on it: a radar tower whose sweep covers
// the middle third of the lane, where the enemy flies about a third slower
// (log v29; your shots flew half as fast again there before).
// The middle silo fires straight down on that same stretch, so the middle
// is the danger stretch and the radar is what makes it defensible; the west
// third (the way in) is the coldest. The enemy goes for the tower: the
// encounters of waves 2, 5, 8 and 10 aim at it (`aim: 'post'`, new in
// rev 4 here; once it is gone, at the ship nearest where it stood), and so
// do the boss rounds (MAP_BOSS). Lost is lost (the player's review), so
// every missile you spend on it is one not spent on a ship, and every one
// you let through costs the middle its speed for the rest of the run.
const MARROW_R4: Omit<Encounter, 'version' | 'rev'>[] = [
  {
    id: 'marrow-under-the-sweep',
    map: 'marrow',
    waves: [1],
    role: 'teach',
    name: 'Under the sweep',
    callout: 'Drones under the radar',
    premise: 'The middle silo sends a few drones straight down at the ship below the radar tower.',
    decision: 'The first look at the radar: inside its sweep every drone and missile is slowed.',
    counters: 'Tap the drones as they cross the island: the radar does the rest.',
    succeeds: 'Nothing is sunk on wave 1; the drones die inside the sweep.',
    notes: {
      sites: 'The middle silo on the north shore, straight above the island.',
      target: 'The ship nearest the silo: the one in the middle third, under the radar\'s sweep.',
      usesMap: 'Shows the mechanic and the danger stretch on wave 1: the silo over the island fires down into the radar\'s sweep.',
    },
    beats: [{ at: 0.3, kind: 'drone', count: 3, gap: 0.35, from: base(1), aim: 'near' }],
    replaces: { drones: 3 },
  },
  {
    id: 'marrow-shell-at-tower',
    map: 'marrow',
    waves: [2],
    role: 'teach',
    name: 'A shell for the tower',
    callout: 'A shell at the radar',
    premise: 'The middle silo lobs a shell at the radar tower; a swarm from the west silo follows at the ships.',
    decision: 'The enemy wants the tower: the shell is not aimed at a ship. Is the radar worth a tap?',
    counters: 'One tap on the shell as it climbs; then the swarm, which has a long way to come.',
    succeeds: 'The shell is shot at in most runs; the tower is still up after wave 2.',
    notes: {
      sites: 'The middle silo for the shell, the west silo for the swarm.',
      target: 'The shell at the radar tower; the swarm at the ship halfway along the lane, under the radar.',
      usesMap: 'The mechanic\'s stake on wave 2: the enemy fires at the tower, and the player sees that it can be hit.',
    },
    beats: [
      { at: 0.3, kind: 'ballistic', count: 1, from: base(1), aim: 'post' },
      { at: 0.3, plus: 2.5, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'mid' },
    ],
    replaces: { drones: 5 },
  },
  {
    id: 'marrow-under-the-island',
    map: 'marrow',
    waves: [3],
    role: 'teach',
    name: 'Under the island',
    callout: 'A swarm and a missile',
    premise: 'The middle silo sends a swarm at the ship below the island, and a guided missile from the west silo follows at the same stretch.',
    decision: 'The first stakes: the swarm is quick, the missile comes from the side. Is there time for both?',
    counters: 'The swarm first, inside the sweep where it is slowed; then the missile, which has the longer flight.',
    succeeds: 'A close call on a ship in most runs; a good player loses under half a ship.',
    notes: {
      sites: 'The middle silo for the swarm, the west silo for the missile.',
      target: 'The swarm at the ship nearest the middle silo, the missile at the ship halfway along the lane: both in the middle third.',
      usesMap: 'Two silos on the danger stretch under the radar, where every threat is slowed.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 5, gap: 0.35, from: base(1), aim: 'near' },
      { at: 0.4, plus: 1, kind: 'guided', count: 1, from: base(0), aim: 'mid' },
    ],
    replaces: { drones: 5, guided: 1 },
  },
  {
    id: 'marrow-shells-below',
    map: 'marrow',
    waves: [4],
    role: 'teach',
    name: 'Shells below the island',
    callout: 'Shells under the radar',
    premise: 'The middle silo lobs shells at the ships under the island, and a periscope rises on your own side of the lane behind the convoy.',
    decision: 'Shells from the north and a sub from the south: the middle is hit from both sides.',
    counters: 'A tap on each shell as it climbs; the sub\'s shells come from close, so watch the periscope.',
    succeeds: 'The shells are shot at in most runs; a lost ship is in the middle.',
    notes: {
      sites: 'The middle silo for two shells, a submarine at the south-west sub spot (300, 742) for three.',
      target: 'The silo\'s shells at the ship nearest it (the middle third), the sub\'s at any ship.',
      usesMap: 'The radar\'s stretch from both sides: the north shore over the island, and a sub in the water between the lane and the carrier.',
    },
    beats: [
      { at: 0.4, kind: 'ballistic', count: 2, gap: 1, from: base(1), aim: 'near' },
      { at: 0.4, plus: 2, kind: 'ballistic', count: 3, gap: 0.75, from: sub(2) },
      { at: 0.2, kind: 'drone', count: 4, gap: 0.35, from: base(1), aim: 'near' },
    ],
    replaces: { drones: 9 },
  },
  {
    id: 'marrow-tower-or-ship',
    map: 'marrow',
    waves: [5],
    role: 'combine',
    name: 'Tower or ship',
    callout: 'A missile at the radar',
    premise: 'A guided missile from the east silo at the radar tower, and at the same moment swarms from the middle and west silos at the ships below it.',
    decision: 'Save the tower or the ships: all three come at once.',
    counters: 'The middle swarm inside the sweep is slowed and easy to pick off; the missile at the tower is one tap away from losing the radar for good.',
    succeeds: 'The tower is still up after wave 5 in some runs, not all: the choice is real.',
    notes: {
      sites: 'The east silo (one guided), the middle silo (a swarm), the west silo (a swarm).',
      target: 'The missile at the radar tower, the middle swarm at the ship nearest that silo, the west swarm at the ship halfway along: all on the middle third.',
      usesMap: 'The mechanic as a choice: a missile at the tower while the ships it guards are under fire from two silos.',
    },
    beats: [
      { at: 0.45, kind: 'guided', count: 1, from: base(2), aim: 'post' },
      { at: 0.45, plus: 0.5, kind: 'drone', count: 6, gap: 0.35, from: base(1), aim: 'near' },
      { at: 0.45, plus: 1.5, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'mid' },
    ],
    replaces: { drones: 10, guided: 1 },
  },
  {
    id: 'marrow-both-shores',
    map: 'marrow',
    waves: [6],
    role: 'combine',
    name: 'West and middle',
    callout: 'Two swarms, two missiles',
    premise: 'A swarm from the west silo across to the ships below the island, shells and a swarm from the middle silo at the same ships, and two guided missiles from the east.',
    decision: 'Fire from three silos converging on one stretch: which comes first?',
    counters: 'The shells first, as they climb; a blast for the swarms as they meet over the middle; the missiles have the longest flight.',
    succeeds: 'Both swarms are shot at before they arrive in most runs.',
    notes: {
      sites: 'The west silo (a swarm), the middle silo (two shells and a swarm), the east silo (two guided).',
      target: 'The west swarm at the ship halfway along, the middle silo\'s fire at the ship nearest it (both the middle third); the missiles at any ship.',
      usesMap: 'The whole shore converging on the radar\'s stretch from two angles.',
    },
    beats: [
      { at: 0.4, kind: 'drone', count: 4, gap: 0.35, from: base(0), aim: 'mid' },
      { at: 0.4, plus: 1, kind: 'ballistic', count: 2, gap: 0.9, from: base(1), aim: 'near' },
      { at: 0.4, plus: 2.5, kind: 'drone', count: 3, gap: 0.35, from: base(1), aim: 'near' },
      { at: 0.4, plus: 3.5, kind: 'guided', count: 2, gap: 0.9, from: base(2) },
    ],
    replaces: { drones: 9, guided: 2 },
  },
  {
    id: 'marrow-down-the-lane',
    map: 'marrow',
    waves: [7],
    role: 'escalate',
    name: 'Down the lane',
    callout: 'A jet over the island',
    premise: 'A strafer runs down the lane from the east as the middle silo opens on the ships below the island, and two guided missiles from the west follow.',
    decision: 'The jet, the swarm or the missiles: the jet has the shortest fuse.',
    counters: 'The jet first; the swarm inside the sweep is slowed and easy to pick off; the missiles last.',
    succeeds: 'The jet is shot down before its guns reach the middle in most runs.',
    notes: {
      sites: 'A strafer from the east edge, the middle silo (a swarm), the west silo (two guided).',
      target: 'The jet down the lane, the swarm at the ship nearest the middle silo, the missiles at the ship halfway along the lane.',
      usesMap: 'The jet crosses the radar\'s sweep like everything else: a test of whether the tower still stands.',
    },
    beats: [
      { at: 0.4, kind: 'strafer', count: 1, from: { air: -1 } },
      { at: 0.4, plus: 1.5, kind: 'drone', count: 5, gap: 0.35, from: base(1), aim: 'near' },
      { at: 0.4, plus: 3, kind: 'guided', count: 2, gap: 0.9, from: base(0), aim: 'mid' },
    ],
    replaces: { drones: 10, guided: 2 },
  },
  {
    id: 'marrow-wolf-pack',
    map: 'marrow',
    waves: [8],
    role: 'escalate',
    name: 'Subs off the island',
    callout: 'Two subs, the radar and the ships',
    premise: 'A sub off the west end shells the convoy; a sub off the east end shells the radar tower; between them the middle silo sends a swarm.',
    decision: 'Two periscopes, opposite ends: one wants a ship, the other the tower.',
    counters: 'Each salvo as it climbs; the swarm inside the sweep is slowed while the tower stands.',
    succeeds: 'The salvo at the tower is shot at in most runs where it still stands.',
    notes: {
      sites: 'Submarines at the north-west (180, 330) and north-east (1420, 330) sub spots, the middle silo for a swarm.',
      target: 'The west sub and the swarm at any ship, the east sub at the radar tower.',
      usesMap: 'The water between the shore and the lane, at both ends of the island: the tower is in reach of a sub.',
    },
    beats: [
      { at: 0.3, kind: 'ballistic', count: 3, gap: 0.75, from: sub(0) },
      { at: 0.3, plus: 4, kind: 'ballistic', count: 2, gap: 0.75, from: sub(1), aim: 'post' },
      { at: 0.55, kind: 'drone', count: 5, gap: 0.35, from: base(1) },
    ],
    replaces: { drones: 10 },
  },
  {
    id: 'marrow-crossfire',
    map: 'marrow',
    waves: [9],
    role: 'escalate',
    name: 'Crossfire at the island',
    callout: 'Everything on the middle',
    premise: 'The west and middle silos send a swarm each, and the middle silo follows with two shells at the ships under the island.',
    decision: 'Two swarms anywhere on the lane, then shells into the middle: thin the swarms, or keep a hand free for the shells?',
    counters: 'A blast for the swarms; the shells as they climb.',
    succeeds: 'Most of it is shot down inside the sweep while the tower stands.',
    notes: {
      sites: 'The west silo (a swarm), the middle silo (a swarm and two shells).',
      target: 'The swarms at any ship, the shells at the ship nearest the middle silo (the middle third).',
      usesMap: 'Wave 9 brings the map\'s heavy missile and the shared table\'s big step, so the encounter is the lighter half of it: the shells still fall on the radar\'s stretch.',
    },
    beats: [
      { at: 0.5, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 0.5, plus: 1, kind: 'drone', count: 4, gap: 0.35, from: base(1) },
      { at: 0.5, plus: 2.5, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'near' },
    ],
    replaces: { drones: 10, guided: 2 },
  },
  {
    id: 'marrow-last-stand',
    map: 'marrow',
    waves: [10],
    role: 'climax',
    name: 'The tower\'s last stand',
    callout: 'Everything, and the radar',
    premise: 'Once the wave\'s own fire is spent, a short calm, then missiles at the radar tower, swarms from the west and middle silos, shells into the middle and missiles at the lead ship.',
    decision: 'The tower, the middle and the ships about to deliver all at once.',
    counters: 'The tower\'s missiles first if it still stands; then the swarms inside the sweep; then the lead ship.',
    succeeds: 'A close call on the lead ship in most runs; the climax is the hardest wave.',
    notes: {
      sites: 'The east silo (two guided at the tower, then two at the lead ship), the west and middle silos (swarms), the middle silo (shells), after the wave\'s own fire.',
      target: 'The radar tower, any ship for the swarms, the ship nearest the middle silo for the shells, and the lead ship on the way out.',
      usesMap: 'The mechanic and the danger stretch together, and the climax may reach the safe stretch: the way out east gets the missiles.',
    },
    beats: [
      { at: 1, plus: 2, kind: 'guided', count: 2, gap: 0.8, from: base(2), aim: 'post' },
      { at: 1, plus: 3, kind: 'drone', count: 5, gap: 0.35, from: base(1) },
      { at: 1, plus: 3.5, kind: 'drone', count: 4, gap: 0.35, from: base(0) },
      { at: 1, plus: 5, kind: 'ballistic', count: 2, gap: 0.8, from: base(1), aim: 'near' },
      { at: 1, plus: 6, kind: 'guided', count: 2, gap: 0.8, from: base(2), aim: 'lead' },
    ],
    // After the wave's own fire is spent (`at: 1`, as the Strait's climax),
    // so a calm falls before it without moving the wave's own raids.
    replaces: { drones: 11, guided: 4 },
  },
];

export const ENCOUNTERS: Encounter[] = [
  ...V1.map((e) => ({ ...e, version: 'v1' as const, callout: V1_CALLOUT[e.id] ?? e.name })),
  ...STRAIT_R4.map((e) => ({ ...e, version: 'v1' as const })),
  ...P4.map((e) => ({ ...e, version: 'v1' as const, rev: 4 })),
  ...V2.map((e) => ({ ...e, version: 'v2' as const })),
  ...V3.map((e) => ({ ...e, version: 'v3' as const })),
  ...OPENERS.map((e) => ({ ...e, rev: 3, opener: true })),
  ...HARBOR_R4.map((e) => ({ ...e, version: 'v1' as const, rev: 4 })),
  ...KESH_R4.map((e) => ({ ...e, version: 'v1' as const, rev: 4 })),
  ...MARROW_R4.map((e) => ({ ...e, version: 'v1' as const, rev: 4 })),
];

/** The rev an encounter came in. */
export function encounterRev(e: Encounter): number {
  return e.rev ?? (e.version === 'v1' ? 1 : 2);
}

/** When an encounter's first beat launches, in seconds of the wave (as
 *  the game plans it: a wave's lead-in, then a raid's warning, then the
 *  beat's moment). */
export function firstBeatAt(e: Encounter, lead: number, warn: number, duration: number): number {
  return Math.min(...e.beats.map((b) => lead + warn + b.at * duration + (b.plus ?? 0)));
}

/** The quiet before an authored climax (rev 4, `calm`): each raid whose
 *  launches (`span` s from its start) would fall in the `calm` s before
 *  `at` starts early enough to be over by then. Returns the new starts. */
export function calmBefore(starts: number[], at: number, calm: number, span: number, earliest: number): number[] {
  return starts.map((s) => (s < at && s + span > at - calm ? Math.max(earliest, at - calm - span) : s));
}

/** Does it play under encounter rev `rev`: from its own rev to its `until`? */
export function playsAt(e: Encounter, rev: number = ENCOUNTER_REV): boolean {
  return encounterRev(e) <= rev && (e.until === undefined || rev <= e.until);
}

// ---- The versions, per map ---------------------------------------------------

/** The three reference maps: an authored layer in three versions (round
 *  12: v1, v2 Set pieces, v3 Enemy pairs). */
export type EncounterMap = 'strait' | 'gauntlet' | 'harbor';
export const ENCOUNTER_MAPS: MapId[] = ['strait', 'gauntlet', 'harbor'];
/** The maps rebuilt to the map and wave rules after them, a chapter at a
 *  time, with the original (v1) only (round 1: set pieces and enemy pairs
 *  were dropped). Chapter 1: the Kesh Hook and Lee of Marrow (encounters
 *  rev 4: docs/design/v3-ch1-kesh.md, v3-ch1-marrow.md). */
export type RebuiltMap = 'kesh' | 'marrow';
export const REBUILT_MAPS: MapId[] = ['kesh', 'marrow'];
/** Every map with an authored encounter layer. */
export const LAYER_MAPS: MapId[] = [...ENCOUNTER_MAPS, ...REBUILT_MAPS];

/** Does this map have authored encounters (a map card turns them on in its
 *  production setup)? */
export function hasEncounters(map: MapId): boolean {
  return LAYER_MAPS.includes(map);
}

export interface VersionDef {
  /** Its name and its idea in a line, for the player. */
  name: string;
  idea: string;
  /** A call-out as each encounter starts (data/encounters' `callout`). */
  callouts: boolean;
  /** Each wave's share of the shared wave's own drones and missiles (waves
   *  1 to 10; 1 is the wave as it is). The set pieces move budget from the
   *  quiet waves to theirs: the ten add up to no more than ten. */
  scale?: number[];
  /** Enemies it brings that the map's chapter doesn't (v3's pairs). */
  guests?: FoeId[];
}

const QUIET = 0.85;
const PEAK = 1.15;
/** Set pieces on waves 3, 5, 8 and 10. Harbor Mouth's on 2, 4, 7 and 10:
 *  its shared wave 5 is already a step up (strafers, bombers and a heavy
 *  arrive by then), and waves 8 and 9, its cliff in v1, are quiet. */
const SET_PIECES = [0.9, QUIET, PEAK, QUIET, PEAK, QUIET, QUIET, PEAK, QUIET, 1.0];
/** The Gauntlet: its shared waves 5 and 8 are already steps up (wave 8 is
 *  a cliff in every version), so those set pieces come on less budget. */
const SET_PIECES_GAUNTLET = [0.9, 0.85, 1.15, 0.95, 1.0, 0.85, 0.85, 0.85, 0.85, 1.0];
/** Round 12's fixes (the player, round 11: Harbor Mouth's wave 8 sank four
 *  ships with aimed weapons and one with weapons that fire themselves, "a
 *  test of your build, not an unfair wall"): wave 8 is the shared wave
 *  again (1.0, was 0.9). The rule now: a wave may hurt, but must not end
 *  the run for every kit (measured with both kits, docs/design/
 *  v3-round12-encounter-versions.md). */
const SET_PIECES_HARBOR = [0.9, 1.05, 0.95, 1.1, 0.95, 0.95, 1.0, 1.0, 0.9, 1.0];

/** v3: a wave with an enemy pair gives up a little more of its own fire
 *  than the pair's launches (a pair is worth more than its count). */
const PAIRS = [1, 0.95, 0.9, 1.0, 0.8, 0.85, 0.85, 1.0, 0.75, 0.7];
/** Harbor Mouth's pairs come with less of its own fire: the narrows give
 *  the guests' shots nowhere to miss. Round 12's fixes: wave 8 (its two
 *  Hydras) keeps all of its own fire again (1.0, was 0.75), and its pairs
 *  take drones out of it rather than missiles, so it stays the test of
 *  your build it is in v1 (the rule above). */
const PAIRS_HARBOR = [1, 0.9, 0.85, 0.8, 0.65, 0.7, 0.65, 1.0, 0.65, 0.75];
/** The Gauntlet's siege gun (wave 6) is the heaviest guest: its wave gives
 *  up more. */
const PAIRS_GAUNTLET = [1, 0.95, 0.8, 0.8, 0.75, 0.75, 0.85, 0.65, 0.85, 0.8];

export const MAP_VERSIONS: Record<EncounterMap, Record<EncounterVersion, VersionDef>> = {
  strait: {
    v1: { name: 'Original', idea: 'The first encounters: one small scripted moment in most waves, on top of the shared waves.', callouts: false },
    v2: { name: 'Set pieces', idea: 'Four big named moments built on the three bases in a row (the sweep), announced as they start, with quiet waves between.', callouts: true, scale: SET_PIECES },
    v3: { name: 'Enemy pairs', idea: 'An enemy pair in most waves: Hydra + swarm, Scavenger + swarm, helicopter + sub, each taught, then combined, then overlapped.', callouts: false, scale: PAIRS, guests: ['scavenger', 'attackHeli', 'torpedoSub'] },
  },
  gauntlet: {
    v1: { name: 'Original', idea: 'The first encounters: one small scripted moment in most waves, on top of the shared waves.', callouts: false },
    v2: { name: 'Set pieces', idea: 'Four big named moments built on the two shores (a true pincer), announced as they start, with quiet waves between.', callouts: true, scale: SET_PIECES_GAUNTLET },
    v3: { name: 'Enemy pairs', idea: 'An enemy pair in most waves: Hydra + swarm, armored drones + Hydra, truck + siege gun, each taught, then combined, then overlapped.', callouts: false, scale: PAIRS_GAUNTLET, guests: ['armored', 'siege'] },
  },
  harbor: {
    v1: { name: 'Original', idea: 'The first encounters: one small scripted moment in most waves, on top of the shared waves.', callouts: false },
    v2: { name: 'Set pieces', idea: 'Four big named moments built on the narrows (a sub ambush at the mouth), announced as they start, with quiet waves between.', callouts: true, scale: SET_PIECES_HARBOR },
    v3: { name: 'Enemy pairs', idea: 'An enemy pair in most waves: Hydra + swarm, helicopter + sub, Spotter + siege gun, each taught, then combined, then overlapped.', callouts: false, scale: PAIRS_HARBOR, guests: ['attackHeli', 'torpedoSub', 'spotter', 'siege'] },
  },
};

/** A rebuilt map's one version: the original (v1). */
const REBUILT_VERSIONS: Record<RebuiltMap, Partial<Record<EncounterVersion, VersionDef>>> = {
  kesh: { v1: { name: 'Original', idea: 'One encounter a wave, built on the apex of the hook.', callouts: false } },
  marrow: { v1: { name: 'Original', idea: 'One encounter a wave, built on the radar tower and the stretch it guards.', callouts: false } },
};

/** A map's version (none for a map with no authored layer, or a version a
 *  rebuilt map does not have). */
export function versionDef(map: MapId, v: EncounterVersion): VersionDef | undefined {
  return (MAP_VERSIONS as Partial<Record<MapId, Record<EncounterVersion, VersionDef>>>)[map]?.[v] ?? (REBUILT_VERSIONS as Partial<Record<MapId, Partial<Record<EncounterVersion, VersionDef>>>>)[map]?.[v];
}

/** "v2 Set pieces". */
export function versionLabel(map: MapId, v: EncounterVersion): string {
  const d = versionDef(map, v);
  return d ? `${v} ${d.name}` : v;
}

/** Are the call-outs on for this run? */
export function calloutsOn(map: MapId, s: EncounterSetup): boolean {
  return s.callouts ?? versionDef(map, setupVersion(s))?.callouts ?? false;
}

/** A wave's share of its own drones and missiles under a version (1: the
 *  shared wave's). */
export function waveScale(map: MapId, v: EncounterVersion, wave: number): number {
  return versionDef(map, v)?.scale?.[wave - 1] ?? 1;
}

/** A map's fire, the same in every version (rev 3, round 12's fixes): from
 *  wave `from` to `to`, `more` more of the wave's own drones and missiles
 *  on top of the version's budget. The player found The Strait "a bit easy"
 *  (won with one ship lost, round 11): waves 5-10 send about 10% more. The
 *  encounter layer is lab only, so the campaign's Strait is unchanged. */
export const MAP_FIRE: Partial<Record<EncounterMap | RebuiltMap, { from: number; to: number; more: number }>> = {
  strait: { from: 5, to: 10, more: 0.1 },
};

/** How much more fire a map's wave sends in every version (0: none; never
 *  under a rev before 3). */
export function waveFire(map: MapId, wave: number, rev: number = ENCOUNTER_REV): number {
  const f = (MAP_FIRE as Partial<Record<MapId, { from: number; to: number; more: number }>>)[map];
  return f && rev >= 3 && wave >= f.from && wave <= f.to ? f.more : 0;
}

/** A map's boss rounds under the encounter layer (rev 4, map rebuild phase
 *  4: rule w-boss, "harder each round, about a ship a round for a good
 *  player"). The map's own event plays as it is, plus, in each run (1 to
 *  3): submarine salvos into the neck (`salvos`: seconds into the run as
 *  the salvo starts, and its shells, each at the ship nearest the narrows,
 *  from the sub spot `spot`, its periscope up first as any sub's), and
 *  the Hydra fan at `fan` Hydras (the event's own count otherwise). Lab
 *  only, as every encounter: a campaign run and a log before rev 4 play the
 *  event as it was. */
export interface BossTune {
  spot?: number;
  salvos?: [at: number, shells: number][][];
  fan?: number[];
  /** Chapter 1's Kesh and Marrow (docs/design/v3-ch1-kesh.md,
   *  v3-ch1-marrow.md): each run's numbers for the map's own event, in place
   *  of the event's (EV in data/events.ts). The Drone Storm: `swarms` of
   *  `size`, the second half `second` s after the first. Hydra Bloom: `fans`
   *  fans of Hydras, `swarms` drone swarms of `size`, and `tower` guided
   *  missiles at the radar tower as the round opens (while it stands; once
   *  it is gone, at the ship nearest where it stood). */
  rounds?: BossRound[];
}

export interface BossRound {
  swarms?: number;
  size?: number;
  second?: number;
  fans?: number;
  tower?: number;
  /** The Drone Storm (log v29, the Kesh playtest: "the boss was way too
   *  easy"): shells lobbed at the ship nearest the launcher (`shells`, out
   *  of the shell bases in turn, `shellAt` s into the round, `shellGap`
   *  apart), and guided missiles at the ship halfway along its lane
   *  (`guided`, out of the guided bases in turn, from `guidedAt`,
   *  `guidedGap` apart). */
  shells?: number;
  shellAt?: number;
  shellGap?: number;
  guided?: number;
  guidedAt?: number;
  guidedGap?: number;
}

/** The Kesh Hook's Drone Storm rounds (log v29); before: 33 / 36 / 36
 *  drones (2.75, 3, 3 a swarm, the second half 6, 6, 5.5 s after the
 *  first) and nothing else. */
export const KESH_BOSS_ROUNDS: BossRound[] = [
  { swarms: 12, size: 3, second: 6, shells: 3, shellAt: 3, shellGap: 4 },
  { swarms: 12, size: 3, second: 6, shells: 2, shellAt: 3, shellGap: 5, guided: 1, guidedAt: 7 },
  { swarms: 14, size: 3, second: 5.5, shells: 3, shellAt: 3, shellGap: 4, guided: 3, guidedAt: 5, guidedGap: 3 },
];

export const MAP_BOSS: Partial<Record<EncounterMap | RebuiltMap, BossTune>> = {
  // The Breakout at the neck (docs/design/v3-p4-harbor.md): the player lost
  // no ship in six of its rounds; the boss rounds come to the funnel, one
  // salvo more in round 2. Round 3 had two salvos of 3 and ended the
  // player's playtest (log v26: 2, 0 and 4 ships lost); the player chose
  // one salvo fewer there (log v27, review 2026-11-18), the fan of 4 kept.
  harbor: {
    spot: 1,
    salvos: [
      [[5, 3]],
      [[4, 3], [13, 2]],
      [[4, 3]],
    ],
    fan: [3, 3, 4],
  },
  // The Kesh Hook's Drone Storm (docs/design/v3-ch1-kesh.md): drone swarms
  // off the outer bank and no ammo drops, more and bigger each round. Log
  // v29 (the playtest: 0 / 0 / 1 ships lost, "the boss was way too easy"):
  // shells at the apex and guided missiles join the drones, more each round,
  // so round 3 is harder by what it sends, not only by its timing.
  kesh: {
    rounds: KESH_BOSS_ROUNDS,
  },
  // Lee of Marrow's Hydra Bloom (docs/design/v3-ch1-marrow.md): each round
  // opens with guided missiles at the radar tower, then the fans of Hydras.
  marrow: {
    rounds: [
      { tower: 1, fans: 2, swarms: 0, size: 5 },
      { tower: 1, fans: 2, swarms: 1, size: 5 },
      { tower: 2, fans: 2, swarms: 1, size: 5 },
    ],
  },
};

/** A map's boss tuning for a run's encounter rev (none before rev 4, or
 *  with no encounter layer). */
export function bossTune(map: MapId, rev: number | undefined): BossTune | undefined {
  return rev !== undefined && rev >= 4 ? (MAP_BOSS as Partial<Record<MapId, BossTune>>)[map] : undefined;
}

/** A map's encounters for a wave in a version (none on a map with no
 *  authored layer, or a wave past the tenth: the ending is the map's own
 *  event), as of encounter rev `rev` (a log's own: an older log plays the
 *  encounters it had). */
export function encountersFor(map: MapId, wave: number, version: EncounterVersion = VERSION_DEFAULT, rev: number = ENCOUNTER_REV): Encounter[] {
  return ENCOUNTERS.filter((e) => e.map === map && e.version === version && e.waves.includes(wave) && playsAt(e, rev));
}

/** The ten-wave arc of a reference map: what each wave is for, and the
 *  encounter (if any) that carries it. Waves 1-3 teach, 4-6 combine, 7-9
 *  escalate, 10 is the climax; then the map's own event, untouched. */
export function arc(map: MapId, version: EncounterVersion = VERSION_DEFAULT): { wave: number; role: ArcRole; encounters: Encounter[] }[] {
  return Array.from({ length: 10 }, (_, k) => {
    const wave = k + 1;
    return { wave, role: wave <= 3 ? 'teach' : wave <= 6 ? 'combine' : wave <= 9 ? 'escalate' : 'climax', encounters: encountersFor(map, wave, version) };
  });
}

// ---- The script in words (round 11: the pause screen's developer view) ----
// The player: "I would like to see what the encounters are tho like as a
// developer like tell me what the script is essentially doesn't need to be
// during the game but maybe when u pause".

const BEAT_NAME: Partial<Record<ThreatKind, [string, string]>> = {
  drone: ['drone', 'drones'],
  ballistic: ['ballistic shell', 'ballistic shells'],
  guided: ['guided missile', 'guided missiles'],
  strafer: ['strafer', 'strafers'],
  bomber: ['bomber', 'bombers'],
  supersonic: ['supersonic missile', 'supersonic missiles'],
};

const AIM_TEXT: Record<BeatAim, string> = {
  any: 'at any ship',
  lead: 'aimed at the lead ship',
  narrows: 'aimed at the ship nearest the narrows',
  rear: 'aimed at the ship furthest back, on the way in',
  near: 'aimed at the ship nearest it',
  mid: 'aimed at the ship halfway along the lane',
  post: 'aimed at the radar tower (once it is gone, the ship nearest where it stood)',
};

const whenText = (at: number, plus?: number) => `at ${Math.round(at * 100)}% of the wave${plus ? ` (+${plus} s)` : ''}`;

/** One beat as a line: "at 45% of the wave (+1.4 s): 1 guided missile from
 *  base 3, aimed at the lead ship". Bases are counted from 1, as a person
 *  reads them. */
export function beatText(b: Beat): string {
  const names = BEAT_NAME[b.kind] ?? [b.kind, b.kind];
  const what = `${b.count} ${b.count === 1 ? names[0] : names[1]}`;
  const from = 'base' in b.from ? `from base ${b.from.base + 1}` : 'sub' in b.from ? `from a sub at spot ${b.from.sub + 1}` : `from the ${b.from.air > 0 ? 'left' : 'right'} edge`;
  const gap = b.count > 1 ? `, ${b.gap ?? (b.kind === 'drone' ? 0.35 : 1.5)} s apart` : '';
  return `${whenText(b.at, b.plus)}: ${what} ${from}${gap}, ${AIM_TEXT[b.aim ?? 'any']}`;
}

/** An enemy pair as a line: "at 30% of the wave: enemy pair Hydra + Drone
 *  Swarm, its lead from base 1". The pair's name comes from data/pairs.ts
 *  (passed in, so this file needs no enemy data). */
export function pairBeatText(p: PairBeat, name: string): string {
  const sets = (p.count ?? 1) > 1 ? ` (${p.count} sets, ${p.every ?? 12} s apart)` : '';
  return `${whenText(p.at, p.plus)}: enemy pair ${name}${p.base !== undefined ? `, its lead from base ${p.base + 1}` : ''}${sets}`;
}

/** The map's arc in one line: its waves grouped by the encounter that
 *  carries them ("1–3 Open water"), then the boss rounds. */
export function arcGroups(map: MapId, bossFrom: number, bossTo: number, bossName: string | null, version: EncounterVersion = VERSION_DEFAULT): { from: number; to: number; name: string }[] {
  const out: { from: number; to: number; name: string }[] = [];
  for (const a of arc(map, version)) {
    const name = a.encounters.map((e) => e.name).join(' + ') || (version === 'v2' ? 'quiet wave' : 'shared wave');
    const last = out[out.length - 1];
    if (last && last.name === name && last.to === a.wave - 1) last.to = a.wave;
    else out.push({ from: a.wave, to: a.wave, name });
  }
  if (bossName && bossTo >= bossFrom) out.push({ from: bossFrom, to: bossTo, name: `Boss rounds: ${bossName}` });
  return out;
}
