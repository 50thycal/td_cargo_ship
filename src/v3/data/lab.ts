// The Test Lab (docs/design/v3-test-lab.md): a playtest hub. Each card is
// one thing to test: a new enemy, a weapon, a combo of two things that
// should meet, or a map. New weapons and maps join it later as more cards.
// The player's marks (tools/v3/test-lab/marks-2026-11-08.json): everything on
// the list (all 29 weapons too), wave 5 to start, a fast even pace, normal
// upgrades between waves, a Quick or Full length.

import { ABILITIES, ABILITY_ORDER, type AbilityId } from './abilities';
import { FOES, type FoeId } from './foes';
import { MAPS, MAP_ORDER, type MapId } from './maps';
import { ENDING, EVENTS, EVENT_ORDER, EVENT_WAVE, bonusDef, eventMap, type EventId } from './events';
import { PAIRS, pairCardId, pairFoes, type LabPair } from './pairs';
import { COMMANDS, mapConvoy, type ConvoyPolicy } from './convoy';
import { ENCOUNTER_MAPS } from './encounters';

export type LabKind = 'event' | 'enemy' | 'weapon' | 'combo' | 'map';

export interface LabCard {
  id: string;
  kind: LabKind;
  name: string;
  /** What to look for: the bar shows it while you play. */
  look: string;
  /** The new enemies it features (a third of the new-enemy mix, one in the
   *  first seconds of every wave). */
  foes: FoeId[];
  /** The weapon it features (held from the start, dropped often). */
  weapon?: AbilityId;
  /** The three weapons a test starts with. */
  kit: AbilityId[];
  /** The water it's played on: the lab's (The Strait, plain), or a map
   *  card's own. */
  map: MapId;
  /** A combo: how its set comes in together (LabPair). */
  pair?: LabPair;
  /** An event card: the special event (every wave of the test is it), and
   *  the wave it starts at (its weapons' levels come from the kit). */
  event?: EventId;
  wave?: number;
}

/** A combo's pairing: data/pairs.ts (the enemy pairs, round 8). */
export type { LabPair, PairFollow, PairMember } from './pairs';

/** Sets: sets in a wave are at least `gap` s apart (a pair can ask for
 *  more); a follower waits at most `station` s for its lead to get to its
 *  station. (Round 8: no combo holds a weapon now, so no weapon drop.) */
export const LAB_SET = { gap: 12, station: 14 } as const;

/** The lab's own water: open, plain, no map system to get in the way. */
export const LAB_MAP: MapId = 'strait';

/** How long a test runs (waves): Quick, or Full (about ten minutes with the
 *  drafts). Done ends either early. */
export const LAB_LENGTH = { quick: 2, full: 8 } as const;
export type LabLength = keyof typeof LAB_LENGTH;

/** An event card's length: runs of the event (a draft between). Full is
 *  as many runs as the campaign's ending (round 7: the same three). */
export const LAB_EVENT_RUNS: Record<LabLength, number> = { quick: 1, full: ENDING.runs };

/** An event card's kit is at this level (a player meets the event with ten
 *  waves of drafts behind them). */
export const LAB_EVENT_LEVEL = 2;

/** The mix setting: the wave's size. */
export const LAB_MIX = { light: 0.75, normal: 1, heavy: 1.35 } as const;
export type LabMix = keyof typeof LAB_MIX;

/** A test starts at a good pace (the player: "level five is probably
 *  fine"), and lab waves don't ramp: each wave's table is wave 5's or the
 *  one you start at, whichever is later. */
export const LAB_START_WAVE = 5;

/** Lab waves rotate through scenarios so the card meets different company:
 *  multipliers on the wave's drones and missiles, and aircraft added. */
export const LAB_SCENARIOS = [
  { id: 'mixed', name: 'Mixed', drones: 1, missiles: 1, planes: 0 },
  { id: 'swarm', name: 'Swarms', drones: 1.5, missiles: 0.6, planes: 0 },
  { id: 'missiles', name: 'Missiles', drones: 0.6, missiles: 1.5, planes: 0 },
  { id: 'air', name: 'Air raid', drones: 0.8, missiles: 0.8, planes: 2 },
] as const;

/** A new enemy's share of the wave's new enemies when it's under test. */
export const LAB_SHARE = 1 / 3;

// ---- The cards ------------------------------------------------------------

const enemy = (id: FoeId, look: string, kit: AbilityId[]): LabCard => ({ id, kind: 'enemy', name: FOES[id].name, look, foes: [id], kit, map: LAB_MAP });

/** Enemies in the order to test them: the open questions first. */
const ENEMIES: LabCard[] = [
  enemy('diveBomber', 'It flies in from off the screen now, a hair slower: does the window feel fair?', ['railgun', 'aegis', 'fullSteam']),
  enemy('siege', 'It rises out of a hatch and hides between salvos: can you catch it while it is up?', ['railgun', 'lance', 'fullSteam']),
  enemy('rocketTruck', 'Salvos of five red rockets: does red read as "can\'t stop it, hit the truck"?', ['railgun', 'lance', 'bomberWing']),
  enemy('cloud', 'New fire on the water, and only the fire hurts: does it read, and do you kill the missile far out?', ['flak', 'railgun', 'lance']),
  enemy('lure', 'It rises out of the water: do your helpers all turn on it inside its yellow ring?', ['droneScreen', 'gunships', 'cutter']),
  enemy('decoy', 'The decoys now fade in and out the whole way in: can you tell them apart at a glance?', ['flak', 'cutter', 'tesla']),
  enemy('armored', 'Can you see the bank (the yellow ring) and time your shots?', ['thermo', 'well', 'boomerang']),
  enemy('torpedoSub', 'Its torpedoes now go one by one, each at a ship: can you read the lines in time? Sub, torpedoes or move?', ['airstrike', 'bomberWing', 'fullSteam']),
  enemy('spotter', 'It comes and goes now, hits kept, and calls shells in from off the map: do you see them coming?', ['railgun', 'aegis', 'shield']),
  enemy('sprinter', 'Do you see the flare in time?', ['flak', 'cutter', 'scatter']),
  enemy('hydra', 'A little slower again, before the split and after: about right now?', ['flak', 'thermo', 'tesla']),
  enemy('scavenger', 'It no longer steals: it hovers over your pickups and locks those in its red ring. Can you see which are locked?', ['seeker', 'cutter', 'supplyRun']),
  enemy('attackHeli', 'Its missiles now fly straight in: six hits or its missiles, a real choice?', ['lance', 'railgun', 'gunships']),
  enemy('stealthJet', 'With no warning, is the short run-in enough?', ['cutter', 'scatter', 'shield']),
  enemy('stealthBomber', 'Does the B-2 read? Six hits too many?', ['railgun', 'seeker', 'aegis']),
  enemy('tender', 'It sails in and keeps clear of other boats: do you see the green beam and change targets?', ['lance', 'railgun', 'orbital']),
  enemy('bodyguard', 'Do you notice the guards taking your shots?', ['flak', 'tesla', 'railgun']),
];

/** Weapons changed since they were last played: first (Test Lab round 8:
 *  the player's round-7 weapon notes; then round 5's, from round 4). */
const REWORKED: Partial<Record<AbilityId, string>> = {
  focus: 'Now a button on the left edge: hold it with your left thumb to slow time, tap anywhere else to shoot. Is the meter clear?',
  wildCard: 'From level 2 each pickup also brings one random passive (frigates, gunships, drones...) for 8 s. Fun?',
  grapnel: 'A thrown threat now bursts on the first threat it hits; a tough one keeps its health and flies on. Right?',
  overdrive: 'Level 2 now lasts 18 s (was a refill you never saw). Worth the level?',
  frigate: 'A new drop while they sail off: they keep going and a fresh pair sails in. Smoother?',
  droneScreen: 'Out of targets, the drones fly home and land on the deck. Better?',
  aegis: 'Renamed Point Defense: does the name fit?',
  well: 'Missiles, drones and small boats are pulled in; aircraft and other big ones only slowed until MAX. Consistent now?',
  cutter: 'Keep your finger down and it keeps cutting, a round per stretch: does it feel right?',
  gunships: 'Now Apache-style, nose on the target when they fire, and a new drop calls a leaving pair back: right?',
  supplyRun: 'No magnet: tap the crates you want; they can hold your weapons, boosts and (Airdrop) a Nuke. Better?',
  bomberWing: 'Hits aircraft and subs too, and you see the bomber cross before the bomb lands: does it read?',
  shield: 'New levels: a round back per block at level 2; 18 s and Reflect at MAX. Worth a slot?',
};

const weaponCard = (id: AbilityId): LabCard => {
  const others = (['flak', 'railgun', 'scatter', 'seeker'] as AbilityId[]).filter((o) => o !== id).slice(0, 2);
  return {
    id: `w-${id}`,
    kind: 'weapon',
    name: ABILITIES[id].name,
    look: REWORKED[id] ?? 'Worth a slot? Is it clear what it did?',
    foes: [],
    weapon: id,
    kit: [id, ...others],
    map: LAB_MAP,
  };
};
const WEAPONS: LabCard[] = [
  ...(Object.keys(REWORKED) as AbilityId[]).map(weaponCard),
  ...ABILITY_ORDER.filter((id) => !(id in REWORKED)).map(weaponCard),
];

/** The combos (round 8, the player: "the pairs should be enemy pairs, not
 *  player and enemy attack pairs"): one card per enemy pair (data/pairs.ts),
 *  its set coming in together on the pair's rule. */
const COMBOS: LabCard[] = PAIRS.map((p) => ({ id: pairCardId(p.id), kind: 'combo', name: p.name, look: p.look, foes: pairFoes(p), kit: p.kit, map: LAB_MAP, pair: p.pair }));

/** Cards cut from the lab (the player's round 7 notes on the combos:
 *  "Looking for enemy and enemy attack pairs"), kept so their old verdicts
 *  still have a card to sit on in the review page's Results (sim/labDocs.ts,
 *  tools/v3/test-lab/page.mjs). Not in LAB_CARDS: the hub doesn't list them
 *  and a saved queue drops them. */
export interface RetiredCard extends LabCard {
  /** The round it was cut in, and why. */
  cut: number;
  why: string;
}
const WHY_PAIRS = 'A player weapon with an enemy: the combos are enemy pairs now';
const retired = (id: string, name: string, look: string, foes: FoeId[], weapon: AbilityId): RetiredCard => ({ id, kind: 'combo', name, look, foes, weapon, kit: [], map: LAB_MAP, cut: 8, why: WHY_PAIRS });
export const LAB_RETIRED: RetiredCard[] = [
  retired('combo-lure-screen', 'Lure Beacon + Drone Screen', 'Your drones chasing the buoy: annoying, or a good puzzle?', ['lure'], 'droneScreen'),
  retired('combo-cloud-flak', 'Incendiary Missile + Flak', 'Flak catching the firebomb far out, or too close to the convoy.', ['cloud'], 'flak'),
  retired('combo-guard-seeker', 'Bodyguard Ring + Seeker Pod', 'Do the guards soak up your seekers?', ['bodyguard'], 'seeker'),
  retired('combo-hydra-tesla', 'Hydra + Sprint Drones, Tesla', 'Area answers to split targets.', ['hydra', 'sprinter'], 'tesla'),
];

export function retiredCard(id: string): RetiredCard | undefined {
  return LAB_RETIRED.find((c) => c.id === id);
}

/** Special events (docs/design/v3-special-events-build.md): each on its own
 *  map, straight into it, with a kit from that map's chapter. The look line
 *  asks one question and never says how to beat it (the player's rule). */
const EVENT_KITS: Record<EventId, AbilityId[]> = {
  rush: ['flak', 'railgun', 'cutter'],
  'decoy-storm': ['scatter', 'seeker', 'aegis'],
  'hydra-bloom': ['railgun', 'flak', 'aegis'],
  'rocket-convoy': ['railgun', 'airstrike', 'aegis'],
  'gunship-wall': ['lance', 'flak', 'gunships'],
  'wolf-pack': ['airstrike', 'railgun', 'fullSteam'],
  'shield-wall': ['thermo', 'lance', 'gunships'],
  'supply-raid': ['seeker', 'flak', 'shield'],
  blackout: ['scatter', 'orbital', 'shield'],
  'carpet-run': ['railgun', 'bomberWing', 'aegis'],
  'dive-circus': ['railgun', 'focus', 'aegis'],
  bombardment: ['lance', 'bomberWing', 'fullSteam'],
  'fire-mission': ['railgun', 'orbital', 'tesla'],
  'repair-yard': ['lance', 'cadence', 'orbital'],
  'escort-run': ['tesla', 'flak', 'railgun'],
  firestorm: ['flak', 'railgun', 'bomberWing'],
  // Round 7: the three chapter finales. Round 8: Beacon Strike, Dunmar
  // Crossing's event in place of Undertow (a kit with no helpers: it must not need them).
  breakout: ['flak', 'railgun', 'seeker'],
  'run-the-canal': ['lance', 'airstrike', 'flak'],
  'beacon-strike': ['railgun', 'flak', 'cutter'],
  'siege-of-vey': ['lance', 'tesla', 'flak'],
  // The bonus event: two passives in the kit, as the campaign asks of it
  // before it comes.
  'siren-field': ['droneScreen', 'gunships', 'flak'],
};

const EVENT_CARDS: LabCard[] = EVENT_ORDER.map((id) => ({
  id: `ev-${id}`,
  kind: 'event',
  name: EVENTS[id].name,
  look: EVENTS[id].look,
  // A chapter finale features all its chapter's new enemies.
  foes: [EVENTS[id].foe, ...(EVENTS[id].also ?? [])],
  kit: EVENT_KITS[id],
  map: eventMap(id),
  event: id,
  // A bonus event starts as it would in the campaign: after its wave.
  wave: bonusDef(id)?.after ?? EVENT_WAVE,
}));

// ---- Map cards: the full production map (Test Lab round 10) ----------------
// The player: "I want this map playtest to be the full finished 10 waves ...
// Should be what the final product will be." A map card plays the map as
// the campaign does (wave 1 to 10, its drafts, then its event ending), set
// up as the production candidate: on the three reference maps the convoy
// commands and the authored encounters are on. The old short lab run is
// still on the setup sheet, as a "Quick slice" (docs/design/
// v3-map-cards-production.md).

/** What a map card is set up with unless the player changes it: the
 *  production candidate. The three reference maps: policy D (their
 *  commands) and their authored encounters. The rest: today's convoy
 *  controls (no commands or encounters exist for them yet). */
export interface MapProduction {
  convoy: ConvoyPolicy;
  encounters: boolean;
}

export function mapProduction(map: MapId): MapProduction {
  const ref = (ENCOUNTER_MAPS as string[]).includes(map) && mapConvoy(map).commands.length > 0;
  return ref ? { convoy: 'tactical', encounters: true } : { convoy: 'current', encounters: false };
}

/** The production setup in words: "Commands: Rush and Disperse · authored
 *  encounters", or "today's convoy controls". */
export function productionText(map: MapId): string {
  const p = mapProduction(map);
  if (p.convoy !== 'tactical') return "Today's convoy controls (no commands or encounters for this map yet)";
  const cmds = mapConvoy(map).commands.map((c) => COMMANDS[c].name).join(' and ');
  return `Commands: ${cmds}${p.encounters ? ' · authored encounters' : ''}`;
}

/** What a map card plays, as its hub card and the review page say it. */
export const MAP_CARD_PLAYS = 'Full map: waves 1–10 and its event ending';

/** Maps: a map card plays that map in full, as the campaign does. */
const MAP_CARDS: LabCard[] = MAP_ORDER.map((id) => ({
  id: `map-${id}`,
  kind: 'map',
  name: MAPS[id].name,
  look: MAPS[id].blurb,
  foes: [],
  kit: ['flak', 'railgun', 'cutter'],
  map: id,
}));

export const LAB_CARDS: LabCard[] = [...EVENT_CARDS, ...ENEMIES, ...WEAPONS, ...COMBOS, ...MAP_CARDS];

export const LAB_SECTIONS: { kind: LabKind; name: string; blurb: string }[] = [
  { kind: 'event', name: 'Events', blurb: 'Each special event on its own map, straight in. Run it again starts it over.' },
  { kind: 'enemy', name: 'New enemies', blurb: 'The open questions first.' },
  { kind: 'weapon', name: 'Weapons', blurb: 'The reworked ones first, then every other.' },
  { kind: 'combo', name: 'Combos', blurb: 'Enemy pairs: two enemies that make each other more dangerous, coming in together.' },
  { kind: 'map', name: 'Maps', blurb: 'Each map in full, as the campaign plays it: waves 1–10 and its event ending, set up as the production candidate.' },
];

export function labCard(id: string): LabCard | undefined {
  return LAB_CARDS.find((c) => c.id === id);
}

// ---- Rounds and versions ---------------------------------------------------
// A test round is one pass of playtesting on one build. When a build changes
// something under test, the cards it touched get a new version (the round
// they changed in), and their old verdicts stop counting as current: the hub
// asks for them again. To start a round: add it to LAB_ROUNDS, and a line for
// each changed card to LAB_CHANGES under that round's number.

export interface LabRound {
  n: number;
  date: string;
  name: string;
  /** The build stamp its builds start from: a log that predates rounds is
   *  placed in a round by the build it was played on. */
  since?: string;
}

export const LAB_ROUNDS: LabRound[] = [
  { n: 1, date: '2026-11-08', name: 'First look at the new enemies' },
  { n: 2, date: '2026-11-08', name: 'After the enemy fixes', since: '2026-11-08T09:40' },
  { n: 3, date: '2026-11-08', name: 'Round 2 notes', since: '2026-11-08T23:05' },
  { n: 4, date: '2026-11-09', name: 'Combos meet; Dual Wield and Cadence', since: '2026-11-09T03:00' },
  { n: 5, date: '2026-11-09', name: 'Special events and new notes', since: '2026-11-09T18:00' },
  { n: 6, date: '2026-11-10', name: 'Special events, second pass', since: '2026-11-10T04:00' },
  { n: 7, date: '2026-11-10', name: 'Enemy tweaks; more events', since: '2026-11-10T06:00' },
  { n: 8, date: '2026-11-10', name: 'Enemy pairs; weapon and enemy notes', since: '2026-11-10T19:00' },
  { n: 9, date: '2026-11-12', name: 'Hold fix; decoys flash; wider scavenger lock', since: '2026-11-13T00:00' },
  { n: 10, date: '2026-11-13', name: 'Map cards are the full production map', since: '2026-11-13T06:00' },
];

/** The round being tested now (the latest). */
export const LAB_ROUND = LAB_ROUNDS[LAB_ROUNDS.length - 1].n;

export function labRound(n: number): LabRound | undefined {
  return LAB_ROUNDS.find((r) => r.n === n);
}

/** What changed in each card, by round: one short plain line each, for the
 *  player. A combo also takes on its enemies' and weapon's changes. */
export const LAB_CHANGES: Record<string, { round: number; what: string }[]> = {
  rocketTruck: [{ round: 2, what: "Fires salvos of five red rockets; red shots can't be stopped" }],
  siege: [{ round: 2, what: 'Rises out of a hatch and hides between salvos; five hits' }],
  diveBomber: [
    { round: 2, what: 'Redrawn from above: flies in from the top and dives at its circle' },
    { round: 3, what: 'Quicker, and now an A-10 Warthog' },
    { round: 5, what: 'Flies in from off the screen; its run a little slower (2.0 s)' },
  ],
  cloud: [
    { round: 2, what: 'Now the Incendiary Missile: a fireball burns where it bursts' },
    { round: 3, what: 'Leads its ship and comes in on the bow' },
    { round: 5, what: 'New fire on the water; the burst does no damage, only the fire; a little faster' },
  ],
  lure: [{ round: 2, what: 'Rises out of the water; wide ring; every helper fires at it' }],
  tender: [
    { round: 2, what: 'Sails in from the edge and keeps clear of other boats' },
    { round: 5, what: 'Now called the Repair Ship' },
  ],
  scavenger: [
    { round: 2, what: 'Circles over the water; a quadcopter with a claw' },
    { round: 8, what: 'Reworked: it no longer steals; pickups inside its ring are locked until you shoot it down' },
    { round: 9, what: 'Its ring is twice as wide (240 px): it locks every pickup within it' },
  ],
  decoy: [
    { round: 2, what: 'The tell comes later; decoys fly like real drones' },
    { round: 3, what: 'The swarm spreads out; easier to tell apart' },
    { round: 7, what: 'No strobe: the decoys are a shade cooler (grey, not cream) all the way in' },
    { round: 8, what: 'The tint is about twice as strong: the decoys are a pale blue' },
    { round: 9, what: 'The decoys fade in and out the whole way in, from launch' },
  ],
  // Round 7 (docs/design/v3-enemies-round7.md): the player's enemy notes
  // from the round 6 event playtest. The combos with these enemies take
  // the lines on (cardChangeList).
  hydra: [
    { round: 7, what: '25% slower before it splits; its darts as fast as before' },
    { round: 8, what: 'A little slower again: 11% before it splits, its darts 12%' },
  ],
  torpedoSub: [
    { round: 7, what: 'Fires a fan of three to five torpedoes; about one sub in four puts a fast one (amber) in it' },
    { round: 8, what: 'Its torpedoes go one by one, each aimed at a ship; never across land' },
  ],
  armored: [{ round: 2, what: 'New shield that flares on a blocked hit' }],
  spotter: [
    { round: 2, what: 'Spots from further away' },
    { round: 8, what: 'Flies turns like the Fire Mission\'s: paints, calls, leaves and comes back with its hits kept; artillery shells from off the map' },
  ],
  stealthJet: [{ round: 2, what: '17% faster' }],
  attackHeli: [{ round: 2, what: 'Its missiles fly straight in' }],
  'w-gunships': [
    { round: 2, what: 'Hellfires fly straight to their targets' },
    { round: 5, what: 'Apache-style helicopters that face their target to fire; a new drop calls a leaving pair back' },
  ],
  'w-cutter': [
    { round: 2, what: 'A red laser sight from the gun to your finger' },
    { round: 5, what: 'Keeps cutting while your finger is down, a round per stretch' },
  ],
  // Round 5 (docs/design/v3-lab-round5-weapons.md): the player's round-4
  // weapon notes. (Overclock and Time Warp were cut: their cards are gone.)
  'w-aegis': [{ round: 5, what: 'Renamed Point Defense' }],
  'w-well': [{ round: 5, what: 'Pulls missiles, drones and small boats; only slows big ones until MAX' }],
  'w-grapnel': [
    { round: 5, what: 'Reaches the whole screen from level 1; level 2 swings faster and smacks for 3' },
    { round: 8, what: 'A thrown threat bursts on the first threat it hits; a tough one keeps its health and flies on' },
  ],
  'w-droneScreen': [
    { round: 5, what: 'Drones wait on deck until a threat is on screen' },
    { round: 8, what: 'Drones with nothing left to ram fly home and land on the deck' },
  ],
  'w-focus': [
    { round: 5, what: 'A quick tap is a shot; slow motion only after a 0.3 s hold' },
    { round: 8, what: 'A button on the left edge: hold it to slow time; every tap elsewhere is a shot' },
  ],
  'w-frigate': [
    { round: 5, what: 'A new drop turns leaving frigates round instead of replacing them' },
    { round: 8, what: 'A new drop while frigates sail off: they keep going and a fresh set sails in' },
  ],
  'w-supplyRun': [{ round: 5, what: 'No magnet; crates can hold your weapons and boosts, and Airdrop now and then a Nuke' }],
  'w-bomberWing': [{ round: 5, what: 'Bombs aircraft and subs too; on screen before its bomb lands, as it passes over' }],
  'w-overdrive': [
    { round: 5, what: 'MAX: every shot visibly fires twice (two shells, two beams)' },
    { round: 8, what: 'Level 2 lasts 18 s (was a rack refill at the end)' },
  ],
  'w-wildCard': [
    { round: 5, what: 'Now a weapon that takes over the gun, not a boost' },
    { round: 8, what: 'From level 2 each pickup also brings one random passive for 8 s; taps fire actives only' },
  ],
  'w-shield': [{ round: 5, what: 'New levels: no strafe block; a round back per block, then 18 s and Reflect' }],
  // Round 8 (docs/design/v3-lab-round8-weapons.md): the player's round-7
  // weapon notes. (Every weapon's level text was rewritten to say what it
  // does directly; a text-only change asks for no retest.)
  // Round 4 (docs/design/v3-lab-round4.md): the player's notes on Spotter +
  // Siege Battery, Dual Wield and Cadence.
  'w-dualWield': [{ round: 4, what: 'A second Dual Wield restarts both hands; another boost no longer empties them' }],
  'w-cadence': [{ round: 4, what: 'War Drum (MAX): on the beat it blows up trucks, siege guns, helicopters, subs and repair ships' }],
  'combo-spotter-siege': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-tender-bodyguard': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-decoy-sprint': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-siege-truck': [
    { round: 2, what: 'New pairing' },
    { round: 4, what: 'Its enemies now arrive together' },
    { round: 8, what: 'They take turns: the gun rises as the truck fires its last salvos, so the shells land after the rockets' },
  ],
  // Round 8 (docs/design/v3-enemy-pairs.md): the new enemy pairs.
  'combo-decoy-cluster': [{ round: 8, what: 'New pair: two cluster missiles arrive with the decoy swarm' }],
  'combo-hydra-swarm': [{ round: 8, what: 'New pair: a Hydra flies in a drone swarm' }],
  'combo-scavenger-swarm': [{ round: 8, what: 'New pair: a drone swarm comes while the Scavenger circles' }],
  'combo-heli-sub': [{ round: 8, what: 'New pair: a Torpedo Sub surfaces under the helicopter\'s hover' }],
  'combo-armored-hydra': [{ round: 8, what: 'New pair: a Hydra arrives with two armored drones' }],
  'combo-spotter-dive': [{ round: 8, what: 'New pair: dive bombers put their circles on the painted ship' }],
  'combo-tender-truck': [{ round: 8, what: 'New pair: the Repair Ship moors off the truck\'s road and mends it' }],
  'combo-lure-stealth': [{ round: 8, what: 'New pair: stealth strafers come in while the beacon draws your helpers' }],
  'combo-guard-spotter': [{ round: 8, what: 'New pair: a ring of guards flies in round the Spotter' }],
  // Round 5 (docs/design/v3-special-events-build.md): the special events;
  // round 6 (docs/design/v3-events-round6.md): the player's notes on them.
  'ev-rush': [{ round: 5, what: 'New event: six sprint swarms and a dashed line on the water' }],
  'ev-decoy-storm': [
    { round: 5, what: 'New event: ten swarms, mostly decoys, and no ammo drops' },
    { round: 7, what: 'No strobe: the decoys are a shade cooler (grey, not cream)' },
    { round: 8, what: 'The decoys are a pale blue, about twice the difference' },
    { round: 9, what: 'The decoys fade in and out the whole way in, from launch; twelve swarms (ten), the second half 2 s sooner' },
  ],
  'ev-hydra-bloom': [
    { round: 5, what: 'New event: two fans of Hydras and a dashed line on the water' },
    { round: 7, what: 'The Hydras are 25% slower before they split' },
    { round: 8, what: 'No line: every Hydra splits into three wherever it is killed; Hydras and darts a little slower' },
  ],
  'ev-rocket-convoy': [
    { round: 5, what: 'New event: four armoured trucks in a column down the shore road' },
    { round: 6, what: 'Two columns of four trucks, one down each shore road, firing closer together' },
  ],
  'ev-gunship-wall': [{ round: 5, what: 'New event: four helicopters in a line, firing in turn (four hits each)' }],
  'ev-wolf-pack': [
    { round: 5, what: 'New event: five periscopes at once, then three more' },
    { round: 6, what: 'Each sub fires two or three torpedoes; one or two fast ones (an amber line)' },
  ],
  'ev-shield-wall': [
    { round: 5, what: 'New event: a block of twelve armored drones that banks at a signal' },
    { round: 6, what: 'Its rows come from three launch points and form up into the block' },
  ],
  'ev-supply-raid': [
    { round: 5, what: 'New event: two cargo runs of pickups, six scavengers and drone swarms' },
    { round: 6, what: 'No Nuke in the cargo; twelve scavengers, from every side' },
    { round: 8, what: 'The new Scavengers: six, each locking the pickups in its ring until shot down' },
    { round: 9, what: 'The scavengers\' rings are twice as wide (240 px)' },
  ],
  'ev-blackout': [{ round: 5, what: 'New event: night, eight stealth strafers and a star shell' }],
  'ev-carpet-run': [{ round: 5, what: 'New event: two vees of three stealth bombers (three hits each)' }],
  'ev-dive-circus': [
    { round: 5, what: 'New event: eight dive bombers on a beat' },
    { round: 6, what: 'Pairs of guided missiles between the dives' },
  ],
  'ev-bombardment': [
    { round: 5, what: 'New event: three siege hatches taking turns (two salvos each)' },
    { round: 6, what: 'Supply drones that drop pickups when shot down; the guns take turns further apart' },
  ],
  'ev-fire-mission': [
    { round: 5, what: 'New event: a spotter with three escorts calling five strikes' },
    { round: 6, what: 'New: three spotters take turns from three sides, each calling shells that walk down the lane' },
    { round: 8, what: 'The shells are artillery from off the map: each comes in from the edge' },
  ],
  'ev-repair-yard': [
    { round: 5, what: 'New event: a tough mothership mended by three tenders' },
    { round: 6, what: 'The repair ships sail in from different sides to meet on the mothership\'s course; none stuck' },
  ],
  'ev-escort-run': [{ round: 5, what: 'New event: one heavy in three rings of guards' }],
  'ev-siren-field': [
    { round: 5, what: 'New event: five lure beacons and six swarms' },
    { round: 7, what: 'Now a bonus event: a bonus wave after wave 6 on any map, when you hold two passives' },
  ],
  // Round 7 (docs/design/v3-events-round7.md): every map has its own event.
  'ev-breakout': [
    { round: 7, what: 'New event (Harbor Mouth): decoys, sprinters, Hydras, then trucks' },
    { round: 8, what: 'Its decoys are a pale blue; its Hydras a little slower' },
    { round: 9, what: 'Its decoys fade in and out the whole way in' },
  ],
  // Round 9 (docs/design/v3-round9-fixes.md): under the Commands policy,
  // Hold now stops every ship short of the hold line, on the water.
  // Round 10 (docs/design/v3-map-cards-production.md): every map card is
  // the full production map (MAP_ROUND10, below).
  'map-harbor': [{ round: 9, what: 'Commands policy: Hold stops every ship short of the hold line where it is; the line and the held ships are marked' }],
  'ev-run-the-canal': [
    { round: 7, what: 'New event (Saltgate Canal): subs, gunships over the banks, thieves, then an armored block' },
    { round: 8, what: 'Cut down: two subs (no torpedo crosses land), one gunship, then a block of six; no scavengers' },
  ],
  'ev-beacon-strike': [{ round: 8, what: 'New event (Dunmar Crossing), in place of Undertow: beacons by the lanes call missiles on the ship nearest them' }],
  'ev-siege-of-vey': [{ round: 7, what: 'New event (Citadel of Vey): repair ships, a guarded heavy and beacons, then firebombs' }],
  'ev-firestorm': [{ round: 5, what: 'New event: firebombs from every side; their fires burn longer' }],
};

// Round 10: every map card is the full production map. The three reference
// maps open with their commands and authored encounters on; the rest with
// today's convoy controls.
for (const id of MAP_ORDER) {
  const ref = mapProduction(id).convoy === 'tactical';
  const what = ref
    ? `Now the full map: waves 1–10 and its event ending, from wave 1 with the campaign's loadout and drafts, set up ready to test (${productionText(id)})`
    : "Now the full map: waves 1–10 and its event ending, from wave 1 with the campaign's loadout and drafts, with today's convoy controls";
  LAB_CHANGES[`map-${id}`] = [...(LAB_CHANGES[`map-${id}`] ?? []), { round: 10, what }];
}

/** The cards a card takes changes from: itself, and for a combo its
 *  enemies' and weapon's cards. */
function changeSources(cardId: string): string[] {
  const card = labCard(cardId);
  if (!card || card.kind !== 'combo') return [cardId];
  return [cardId, ...card.foes, ...(card.weapon ? [`w-${card.weapon}`] : [])];
}

/** Every change line a card has, oldest round first; a combo's inherited
 *  ones say which card they're from. */
export function cardChangeList(cardId: string): { round: number; what: string }[] {
  const out: { round: number; what: string }[] = [];
  for (const src of changeSources(cardId)) {
    const name = src === cardId ? '' : `${labCard(src)?.name ?? src}: `;
    for (const c of LAB_CHANGES[src] ?? []) out.push({ round: c.round, what: name + c.what });
  }
  return out.sort((a, b) => a.round - b.round);
}

/** A card's current version: the latest round it (or, for a combo, one of
 *  its enemies or its weapon) changed in; 1 if it never has. */
export function cardRev(cardId: string): number {
  return cardChangeList(cardId).reduce((m, c) => Math.max(m, c.round), 1);
}

/** What changed in a card after a round (all of it without one). */
export function cardChanges(cardId: string, sinceRound?: number): string[] {
  return cardChangeList(cardId)
    .filter((c) => sinceRound === undefined || c.round > sinceRound)
    .map((c) => c.what);
}
