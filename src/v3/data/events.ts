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
  'rocket-convoy': { id: 'rocket-convoy', name: 'Rocket Convoy', foe: 'rocketTruck', rules: [], look: 'Two columns of trucks, one on each shore: can you keep track of both?' },
  'gunship-wall': { id: 'gunship-wall', name: 'Gunship Wall', foe: 'attackHeli', rules: [], look: 'Four helicopters firing in turn: does the wall feel like a set piece or a slog?' },
  'wolf-pack': { id: 'wolf-pack', name: 'Wolf Pack', foe: 'torpedoSub', rules: [], look: 'Every sub fires a spread, and one or two torpedoes are fast: can you read the lines?' },
  'shield-wall': { id: 'shield-wall', name: 'Shield Wall', foe: 'armored', rules: [], look: 'Armored drones from three bases joining into one block: does it read as one wall?' },
  'supply-raid': { id: 'supply-raid', name: 'Supply Raid', foe: 'scavenger', rules: ['pickupRain'], look: 'Pickups raining and thieves from every side: fun scramble or busywork?' },
  blackout: { id: 'blackout', name: 'Blackout', foe: 'stealthJet', rules: ['night', 'starShell'], look: 'The lights go out: can you still see enough on your phone?' },
  'carpet-run': { id: 'carpet-run', name: 'Carpet Run', foe: 'stealthBomber', rules: [], look: 'Three bombers abreast across the lane: big enough to feel like an event?' },
  'dive-circus': { id: 'dive-circus', name: 'Dive Circus', foe: 'diveBomber', rules: [], look: 'Dives on the beat and missiles between them: does it still find a rhythm?' },
  bombardment: { id: 'bombardment', name: 'Bombardment', foe: 'siege', rules: [], look: 'Three hatches taking turns, and drones in between: fair now, at night?' },
  'fire-mission': { id: 'fire-mission', name: 'Fire Mission', foe: 'spotter', rules: [], look: 'Three spotters taking turns and shells walking down the lane: hard in a good way?' },
  'repair-yard': { id: 'repair-yard', name: 'Repair Yard', foe: 'tender', rules: [], look: 'Three repair ships from three sides meeting the mothership: did the meeting catch your eye?' },
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
  /** `columns` columns (one down each shore road the map has, the second
   *  `second` s after the first) of `trucks` trucks, `gap` s apart at
   *  `drive` × their speed; the lead stops `stop` of the road along, the
   *  rest `spacing` px behind it; each raises `stagger` s after the one
   *  ahead, fires `salvos`; a truck killed stalls the ones behind it for
   *  `stall` s; `hp` hits each (armoured for the run); `swarms` drone swarms
   *  of `size` for company. Round 6 ("Too easy"): two columns of four, one
   *  down each shore road, not one of four; they drive faster (2 → 2.8 ×)
   *  and raise closer together (2.6 s → 1.4 s; the second column half a
   *  turn after the first), so the salvos of both columns overlap. Each
   *  truck takes 5 hits (8) and fires 2 salvos (3): more trucks, less of
   *  each. */
  'rocket-convoy': { columns: 2, trucks: 4, second: 1.5, gap: 0.6, drive: 2.8, stop: 0.55, spacing: 80, stagger: 1.4, salvos: 2, stall: 2, back: 2.5, hp: 5, swarms: 3, size: 5 },
  /** `helis` helicopters on station in a line `off` px off the lane, fire
   *  from `hold` s, each `turn` s after the one to its left; `hp` hits and
   *  `volleys` volleys each (the design's "six hits each is a lot");
   *  `swarms` drone swarms of `size` for company. */
  'gunship-wall': { helis: 4, hp: 4, volleys: 4, turn: 0.75, hold: 6.5, off: 95, swarms: 3, size: 5 },
  /** Packs of periscopes (`packs`: how many in each), `gap` s apart; each
   *  pack's subs fire `stagger` s after each other. Round 6: each sub fires
   *  a spread of `spread` torpedoes (two or three) on headings at least
   *  `fan` rad apart, and `fast` of the event's torpedoes in all run at
   *  `fastSpeed` × a torpedo's speed. With a spread to fire, a sub fires
   *  `aim` s later than a lone one, and the packs are four and three (five
   *  and three). */
  'wolf-pack': { packs: [4, 3], gap: 11, stagger: 1.1, spread: [2, 3], fan: 0.42, fast: 2, fastSpeed: 2.2, aim: 0.6 },
  /** `drones` armored drones in a block `cols` wide, `dx` by `dy` px apart;
   *  the block banks together at each of `banks` (share of the way in).
   *  Round 6 ("they all come from the same launcher"): each row of the block
   *  comes from its own launch point along the shore (`spread` px apart),
   *  and the rows form up at a muster point `muster` of the way to their
   *  ship (flying there at `form` × their speed, the nearer rows setting
   *  out later so all arrive together); the block sets off once it is
   *  formed (or `wait` s after the breather at most). */
  'shield-wall': { drones: 12, cols: 4, dx: 44, dy: 40, banks: [0.3, 0.62], spread: 320, muster: 0.25, form: 1.25, wait: 7 },
  /** Cargo runs (`drops` pickups each, at `dropAt` s), scavengers (`scav`
   *  at `scavAt` s, `apart` s between them, each from the next side of the
   *  screen in turn) and `swarms` drone swarms of `size` every `every` s.
   *  Round 6: no Nuke in the cargo, and six scavengers a run (three before)
   *  from all four sides. */
  'supply-raid': { drops: [8, 6], dropAt: [0, 12], scav: [6, 6], scavAt: [1.5, 12.5], apart: 0.5, swarms: 5, size: 6, every: 3.5 },
  /** `strafers` stealth strafers, one every `every` s from alternate sides;
   *  a star shell drops at `shellAt` s. */
  blackout: { strafers: 8, every: 2.4, shellAt: 6 },
  /** `passes` vees of three stealth bombers, `gap` s apart, across `spread`
   *  of the lane's half-width; `hp` hits each (the design's "six hits
   *  each, three at once"). */
  'carpet-run': { passes: 2, gap: 11, spread: 0.75, hp: 3, behind: 60 },
  /** `planes` dive bombers, one every `beat` s. Round 6 ("could have more
   *  than planes"): on every other off-beat a pair of guided missiles from
   *  two bases, `pairs` pairs in all. */
  'dive-circus': { planes: 8, beat: 2.3, pairs: 3 },
  /** `guns` siege hatches, the first rising `stagger` s after the one
   *  before; `salvos` each (the design: shorter than a normal one). Round 6
   *  ("add in some drones … so I can have more of a chance"): `swarms`
   *  supply swarms of `size` drones, from `from` s, `every` s apart; every
   *  one of them shot down drops a pickup, in turn from `cargo` (a weapon:
   *  one you hold); they fly at the carrier, not the ships. The guns take
   *  turns further apart (2.2 s → 3 s). */
  bombardment: { guns: 3, stagger: 3, salvos: 2, swarms: 4, size: 4, from: 0.5, every: 3.5, cargo: ['repair', 'ammo', 'weapon', 'repair'] as const },
  /** Round 6, a new Fire Mission ("let's rework this completely"):
   *  `spotters` Spotters (`hp` hits each, kept between turns) take turns,
   *  `turns` each, one every `every` s, each from its own side of the
   *  screen (left, right, then the far side). A spotter flies in at `fly` ×
   *  its speed to a spot `off` px off the lane, paints a ship from the moment
   *  it is on the screen, calls a walking barrage `call` s after that and
   *  climbs back out the way it came. The
   *  barrage: `shells` shells down the painted ship's course, the first
   *  `mark` s after the call and each `beat` s after the one before, `walk`
   *  px further along than the ship will be, `dmg` each. A spotter shot
   *  down before it calls takes its barrage and its turns to come with it;
   *  a barrage once called comes. `swarms` drone swarms of `size`. */
  'fire-mission': { spotters: 3, turns: 2, hp: 5, every: 4.4, fly: 1.4, off: 150, call: 3, shells: 5, mark: 2.4, beat: 0.4, walk: 46, dmg: 1, swarms: 3, size: 5 },
  /** A mothership (`hp`, at `speed` of its own) with `tenders` mending
   *  `mend` every `every` s; `swarms` drone swarms of `size`. Round 6 ("have
   *  the repair ships come from multiple directions and converge on the same
   *  spot"): the repair ships sail in from different sides of the screen
   *  (as far round from each other as the water allows, up to 1.6 ×
   *  `apart` rad, seen from the spot) to one meeting spot on
   *  open water on the mothership's course, about `meet` of the way along
   *  it, and stand in a ring `ring` px round it, sailing at `sail` × a repair
   *  ship's speed so the far ones get there in time. */
  'repair-yard': { hp: 16, speed: 0.75, tenders: 3, mend: 2, every: 2.4, swarms: 2, size: 5, meet: 0.5, ring: 56, apart: 1.1, sail: 1.6 },
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
