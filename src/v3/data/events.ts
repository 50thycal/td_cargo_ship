// Special event attacks (docs/design/v3-special-events.md, built in
// docs/design/v3-special-events-build.md). Every campaign map that has one
// gets an 11th wave after its ten normal waves: a scripted attack built on
// the enemy that debuts on that map. Clearing it wins the map.
//
// The player's rule for the words in the game: an event's card names it and
// states any rule in force ("No ammo drops", "Night"), and never says how
// to beat it. Nothing in this file (or anywhere in the game) does.

import { RULES } from './config';
import type { FoeId } from './foes';
import type { MapId } from './maps';

export type EventId =
  // Chapter 1: Home Waters
  | 'rush' | 'decoy-storm' | 'hydra-bloom' | 'rocket-convoy'
  // Chapter 2: The Narrows
  | 'gunship-wall' | 'wolf-pack' | 'shield-wall' | 'supply-raid'
  // Chapter 3: Dark Water
  | 'blackout' | 'carpet-run' | 'dive-circus' | 'bombardment' | 'fire-mission'
  // Chapter 4: Open War
  | 'repair-yard' | 'escort-run' | 'siren-field' | 'firestorm';

/** A rule an event switches on for its length (named on its card). */
export type EventRule = 'noAmmo' | 'hydraThree' | 'pickupRain' | 'night' | 'starShell' | 'lureAll';

/** What the card says for each rule: the rule, never the answer to it. */
export const RULE_TEXT: Record<EventRule, string> = {
  noAmmo: 'No ammo drops',
  hydraThree: 'Hydras split into three, not two',
  pickupRain: 'Pickups rain down',
  night: 'Night',
  starShell: 'A star shell is on the way',
  lureAll: 'Helpers chase the beacons',
};

export interface EventDef {
  id: EventId;
  name: string;
  /** The enemy it is built on (the debut enemy of its map). */
  foe: FoeId;
  rules: EventRule[];
  /** The Test Lab's question for the player (one question; never the
   *  counter). */
  look: string;
}

export const EVENTS: Record<EventId, EventDef> = {
  rush: { id: 'rush', name: 'Afterburner Rush', foe: 'sprinter', rules: [], look: 'Six sprint swarms and a dashed line on the water: does the line read before it matters?' },
  'decoy-storm': { id: 'decoy-storm', name: 'Decoy Storm', foe: 'decoy', rules: ['noAmmo'], look: 'Ten swarms and no ammo drops: did you run dry, and was that on you?' },
  'hydra-bloom': { id: 'hydra-bloom', name: 'Hydra Bloom', foe: 'hydra', rules: ['hydraThree'], look: 'Six Hydras and a dashed line: did you work out what the line means?' },
  'rocket-convoy': { id: 'rocket-convoy', name: 'Rocket Convoy', foe: 'rocketTruck', rules: [], look: 'Four trucks in a column on the shore road: does the order they fire in read?' },
  'gunship-wall': { id: 'gunship-wall', name: 'Gunship Wall', foe: 'attackHeli', rules: [], look: 'Four helicopters firing in turn: does the wall feel like a set piece or a slog?' },
  'wolf-pack': { id: 'wolf-pack', name: 'Wolf Pack', foe: 'torpedoSub', rules: [], look: 'Five periscopes at once: can you read the torpedo lines?' },
  'shield-wall': { id: 'shield-wall', name: 'Shield Wall', foe: 'armored', rules: [], look: 'A block of armored drones with a horn and a flash: did you notice what the signal does?' },
  'supply-raid': { id: 'supply-raid', name: 'Supply Raid', foe: 'scavenger', rules: ['pickupRain'], look: 'Pickups raining and thieves after them: fun scramble or busywork?' },
  blackout: { id: 'blackout', name: 'Blackout', foe: 'stealthJet', rules: ['night', 'starShell'], look: 'The lights go out: can you still see enough on your phone?' },
  'carpet-run': { id: 'carpet-run', name: 'Carpet Run', foe: 'stealthBomber', rules: [], look: 'Three bombers abreast across the lane: big enough to feel like an event?' },
  'dive-circus': { id: 'dive-circus', name: 'Dive Circus', foe: 'diveBomber', rules: [], look: 'Eight dives on a beat: does it find a rhythm?' },
  bombardment: { id: 'bombardment', name: 'Bombardment', foe: 'siege', rules: [], look: 'Three hatches taking turns: fair, or too much at night?' },
  'fire-mission': { id: 'fire-mission', name: 'Fire Mission', foe: 'spotter', rules: [], look: 'A spotter with an escort calling strike after strike: does it feel like one fight?' },
  'repair-yard': { id: 'repair-yard', name: 'Repair Yard', foe: 'tender', rules: [], look: 'A mothership with three tenders: did the green beams catch your eye?' },
  'escort-run': { id: 'escort-run', name: 'Escort Run', foe: 'bodyguard', rules: [], look: 'One missile in three rings of guards: does it speeding up feel fair?' },
  'siren-field': { id: 'siren-field', name: 'Siren Field', foe: 'lure', rules: ['lureAll'], look: 'Five beacons and every helper pulled away: did you feel alone?' },
  firestorm: { id: 'firestorm', name: 'Firestorm', foe: 'cloud', rules: [], look: 'Firebombs from every side: do the fires on the water read as lasting?' },
};

export const EVENT_ORDER = Object.keys(EVENTS) as EventId[];

/** Which map runs which event. Data, so the table can be remixed later (the
 *  player: "you will need to mix it around"); today each map gets the event
 *  built on its own debut enemy. Harbor Mouth, Saltgate Canal and Citadel of
 *  Vey repeat an earlier map's debut and are waiting for their chapter
 *  finales: no event yet, so they stay at ten waves. */
export const EVENT_MAPS: Partial<Record<MapId, EventId>> = {
  strait: 'rush',
  kesh: 'decoy-storm',
  marrow: 'hydra-bloom',
  gauntlet: 'rocket-convoy',
  island: 'gunship-wall',
  behemoth: 'wolf-pack',
  needle: 'shield-wall',
  archipelago: 'supply-raid',
  battery: 'blackout',
  sowers: 'carpet-run',
  rigs: 'dive-circus',
  lantern: 'bombardment',
  dreadnought: 'fire-mission',
  coves: 'repair-yard',
  delta: 'escort-run',
  crossing: 'siren-field',
  tide: 'firestorm',
};

/** The map an event plays on (its home). */
export function eventMap(id: EventId): MapId {
  return (Object.keys(EVENT_MAPS) as MapId[]).find((m) => EVENT_MAPS[m] === id)!;
}

/** The wave a map's special event is: the one after its normal waves. */
export const EVENT_WAVE = RULES.wavesToClear + 1;

/** A campaign map's waves: its ten, and its event if it has one. */
export function campaignWaves(map: MapId): number {
  return RULES.wavesToClear + (EVENT_MAPS[map] ? 1 : 0);
}

/** How an event went. Clean: no ship lost and the carrier untouched. Held:
 *  one ship lost or the carrier hit, and the convoy still sailing. Broken:
 *  the map lost during it, or two or more ships lost. */
export type EventOutcome = 'clean' | 'held' | 'broken';

export const OUTCOME_NAME: Record<EventOutcome, string> = { clean: 'Clean', held: 'Held', broken: 'Broken' };

export function gradeEvent(shipsLost: number, carrierHit: boolean, mapLost: boolean): EventOutcome {
  if (mapLost || shipsLost >= 2) return 'broken';
  if (shipsLost === 1 || carrierHit) return 'held';
  return 'clean';
}

/** The system's numbers: the breather between the card and the first
 *  launch (s, as a normal wave's lead-in), the most an event may run before
 *  anything left flies off (s), and the score for holding it (a weapon drop
 *  would be no use: the event ends the map). */
export const EVENT = {
  breather: RULES.waveLeadIn,
  /** Seconds more when no ship is on the water yet (a Test Lab card's first
   *  run): the convoy sails in first. */
  convoyWait: 9,
  cap: 48,
  bonus: { clean: 3000, held: 1500, broken: 0 } as Record<EventOutcome, number>,
};

/** Each event's numbers (seconds from the end of the breather). */
export const EV = {
  /** `swarms` sprint swarms, one every `every` s, cruising at `cruise` of
   *  their speed; the line sits `line` of the way from the launch bases to
   *  the lane's near edge. */
  rush: { swarms: 6, every: 1.5, cruise: 0.5, line: 0.75 },
  /** `swarms` decoy swarms of `size`, `fakes` of each fake, half at the
   *  start and half `second` s later. */
  'decoy-storm': { swarms: 10, size: 6, fakes: 4, second: 9, gap: 0.45 },
  /** `fans` fans of Hydras, `gap` s apart, one from each base, at `slow` of
   *  their speed; one killed past the line `line` of the way to the lane
   *  splits into `darts`. `swarms` drone swarms of `size` between. */
  'hydra-bloom': { fans: 2, gap: 8, slow: 0.85, line: 0.5, darts: 3, swarms: 2, size: 5 },
  /** `trucks` trucks down the shore road `gap` s apart at `drive` × their
   *  speed; the lead stops `stop` of the road along, the rest `spacing` px
   *  behind it; each raises `stagger` s after the one ahead, fires `salvos`;
   *  a truck killed stalls the ones behind it for `stall` s; `hp` hits each
   *  (armoured for the run); `swarms` drone swarms of `size` for company. */
  'rocket-convoy': { trucks: 4, gap: 0.6, drive: 2, stop: 0.55, spacing: 80, stagger: 2.6, salvos: 3, stall: 2, back: 2.5, hp: 8, swarms: 3, size: 5 },
  /** `helis` helicopters on station in a line `off` px off the lane, fire
   *  from `hold` s, each `turn` s after the one to its left; `hp` hits and
   *  `volleys` volleys each (the design's "six hits each is a lot");
   *  `swarms` drone swarms of `size` for company. */
  'gunship-wall': { helis: 4, hp: 4, volleys: 4, turn: 0.75, hold: 6.5, off: 95, swarms: 3, size: 5 },
  /** Packs of periscopes (`packs`: how many in each), `gap` s apart; each
   *  pack's subs fire `stagger` s after each other. */
  'wolf-pack': { packs: [5, 3], gap: 11, stagger: 0.9 },
  /** `drones` armored drones in a block `cols` wide, `dx` by `dy` px apart;
   *  the block banks together at each of `banks` (share of the way in). */
  'shield-wall': { drones: 12, cols: 4, dx: 44, dy: 40, banks: [0.3, 0.62] },
  /** Cargo runs (`drops` pickups each, at `dropAt` s), scavengers (`scav`
   *  at `scavAt` s) and `swarms` drone swarms of `size` every `every` s. */
  'supply-raid': { drops: [8, 6], dropAt: [0, 12], scav: [3, 3], scavAt: [2, 13], swarms: 5, size: 6, every: 3.5 },
  /** `strafers` stealth strafers, one every `every` s from alternate sides;
   *  a star shell drops at `shellAt` s. */
  blackout: { strafers: 8, every: 2.4, shellAt: 6 },
  /** `passes` vees of three stealth bombers, `gap` s apart, across `spread`
   *  of the lane's half-width; `hp` hits each (the design's "six hits
   *  each, three at once"). */
  'carpet-run': { passes: 2, gap: 11, spread: 0.75, hp: 3, behind: 60 },
  /** `planes` dive bombers, one every `beat` s. */
  'dive-circus': { planes: 8, beat: 2.3 },
  /** `guns` siege hatches, the first rising `stagger` s after the one
   *  before; `salvos` each (the design: shorter than a normal one). */
  bombardment: { guns: 3, stagger: 2.2, salvos: 2 },
  /** One Spotter (`hp` hits) calling `strikes` strikes, `guards` escorts
   *  round it (`orbit` px), and `swarms` drone swarms of `size`. */
  'fire-mission': { strikes: 5, guards: 3, orbit: 38, hp: 6, swarms: 3, size: 5 },
  /** A mothership (`hp`, at `speed` of its own) with `tenders` mending
   *  `mend` every `every` s; `swarms` drone swarms of `size`. */
  'repair-yard': { hp: 16, speed: 0.75, tenders: 3, mend: 2, every: 2.4, swarms: 2, size: 5 },
  /** A heavy (`hp`) in rings of guards (`rings` of them at `radii`), at
   *  `slow` of its speed and `per` more for each ring stripped; `swarms`. */
  'escort-run': { hp: 10, rings: [3, 4, 5], radii: [34, 56, 78], slow: 0.45, per: 0.25, swarms: 2, size: 5 },
  /** `lures` beacons at once, and `swarms` drone swarms of `size`, one every
   *  `every` s from `from` s. */
  'siren-field': { lures: 5, swarms: 6, size: 5, every: 2.5, from: 2 },
  /** `first` firebombs at once from every side, `second` more `gap` s later,
   *  at `slow` of their speed; fireballs burn `linger` s. */
  firestorm: { first: 6, second: 3, gap: 9, slow: 0.85, linger: 13 },
} as const;
