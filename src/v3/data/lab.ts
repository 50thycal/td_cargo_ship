// The Test Lab (docs/design/v3-test-lab.md): a playtest hub. Each card is
// one thing to test: a new enemy, a weapon, a combo of two things that
// should meet, or a map. New weapons and maps join it later as more cards.
// The player's marks (tools/v3/test-lab/marks-2026-11-08.json): everything on
// the list (all 29 weapons too), wave 5 to start, a fast even pace, normal
// upgrades between waves, a Quick or Full length.

import { ABILITIES, ABILITY_ORDER, type AbilityId } from './abilities';
import { FOES, type FoeId } from './foes';
import { MAPS, MAP_ORDER, type MapId } from './maps';
import { EVENTS, EVENT_ORDER, EVENT_WAVE, eventMap, type EventId } from './events';

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

/** A combo's pairing (Test Lab round 4, the player on Spotter + Siege
 *  Battery: "the recon drone and then the siege cannon never really appeared
 *  at the same time"). Every featured appearance of a combo is its whole set,
 *  launched together and timed so the set is on the board at once. */
export interface LabPair {
  /** Leads the set: launched at the set's time. */
  lead: FoeId;
  /** The others. Each comes `after` s after the lead launches, or (`on:
   *  'station'`) after the lead gets to its station: the Spotter on its
   *  circle, the Repair Ship on station, the Rocket Truck at the end of
   *  its road. A lead shot down first, or one that hasn't got there in
   *  LAB_SET.station s, lets them come at once. `on: 'arrive'`: a faster one
   *  after a slow lead, launched once the lead is due within its own flight
   *  time plus `after` s (the lead's sprint and its own curve make up the
   *  rest), so they arrive together. `base: 'same'`: out of the lead's base. */
  follow: { foe: FoeId; after: number; on?: 'launch' | 'station' | 'arrive'; base?: 'same' }[];
  /** The lead comes out of the launch base furthest from the convoy (the
   *  longest look at a fast pair). */
  far?: boolean;
  /** The rule in words (the docs, and the review page). */
  rule: string;
}

/** Sets: the card's weapon drops by the carrier `weaponLead` s before each
 *  set comes in (a combo with a weapon is played holding it); sets in a wave
 *  are at least `gap` s apart; a follower waits at most `station` s for its
 *  lead to get to its station. */
export const LAB_SET = { weaponLead: 1.5, gap: 12, station: 14 } as const;

/** The lab's own water: open, plain, no map system to get in the way. */
export const LAB_MAP: MapId = 'strait';

/** How long a test runs (waves): Quick, or Full (about ten minutes with the
 *  drafts). Done ends either early. */
export const LAB_LENGTH = { quick: 2, full: 8 } as const;
export type LabLength = keyof typeof LAB_LENGTH;

/** An event card's length: runs of the event (a draft between). */
export const LAB_EVENT_RUNS: Record<LabLength, number> = { quick: 1, full: 3 };

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
  enemy('decoy', 'The swarm spreads out: can you pick out each drone, and the decoys up close? Is waiting worth it?', ['flak', 'cutter', 'tesla']),
  enemy('armored', 'Can you see the bank (the yellow ring) and time your shots?', ['thermo', 'well', 'boomerang']),
  enemy('torpedoSub', 'Is the dashed line readable? Sub, torpedo or move?', ['airstrike', 'bomberWing', 'fullSteam']),
  enemy('spotter', 'Do you notice the painted ship before the strike comes?', ['railgun', 'aegis', 'shield']),
  enemy('sprinter', 'Do you see the flare in time?', ['flak', 'cutter', 'scatter']),
  enemy('hydra', 'Does killing it early feel worth it?', ['flak', 'thermo', 'tesla']),
  enemy('scavenger', 'It circles over the water waiting for a pickup: does it read apart from the other drones?', ['seeker', 'cutter', 'supplyRun']),
  enemy('attackHeli', 'Its missiles now fly straight in: six hits or its missiles, a real choice?', ['lance', 'railgun', 'gunships']),
  enemy('stealthJet', 'With no warning, is the short run-in enough?', ['cutter', 'scatter', 'shield']),
  enemy('stealthBomber', 'Does the B-2 read? Six hits too many?', ['railgun', 'seeker', 'aegis']),
  enemy('tender', 'It sails in and keeps clear of other boats: do you see the green beam and change targets?', ['lance', 'railgun', 'orbital']),
  enemy('bodyguard', 'Do you notice the guards taking your shots?', ['flak', 'tesla', 'railgun']),
];

/** Weapons changed since they were last played: first (Test Lab round 5:
 *  the player's round-4 weapon notes). */
const REWORKED: Partial<Record<AbilityId, string>> = {
  aegis: 'Renamed Point Defense: does the name fit?',
  well: 'Missiles, drones and small boats are pulled in; aircraft and other big ones only slowed until MAX. Consistent now?',
  cutter: 'Keep your finger down and it keeps cutting, a round per stretch: does it feel right?',
  grapnel: 'Hooks anything on screen from level 1; level 2 swings faster and smacks harder. Playable now?',
  droneScreen: 'The drones wait on deck until something is on screen: better?',
  focus: 'A quick tap is just a shot; press and hold to slow time. Comfortable?',
  gunships: 'Now Apache-style, nose on the target when they fire, and a new drop calls a leaving pair back: right?',
  frigate: 'A new drop while they sail off turns them round: do they come back cleanly?',
  supplyRun: 'No magnet: tap the crates you want; they can hold your weapons, boosts and (Airdrop) a Nuke. Better?',
  bomberWing: 'Hits aircraft and subs too, and you see the bomber cross before the bomb lands: does it read?',
  overdrive: 'Set it to MAX in Setup: every shot fires twice, two shells, two beams, side by side. Clear?',
  wildCard: 'Now a weapon: it takes over the gun like any other. Right?',
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

const combo = (id: string, name: string, look: string, foes: FoeId[], kit: AbilityId[], pair: LabPair, weapon?: AbilityId): LabCard => ({ id: `combo-${id}`, kind: 'combo', name, look, foes, kit, map: LAB_MAP, pair, ...(weapon ? { weapon } : {}) });
const alone = (lead: FoeId, rule: string): LabPair => ({ lead, follow: [], rule });
/** The combos (Test Lab round 4: each one's set comes in together). */
const COMBOS: LabCard[] = [
  // The Spotter gets to its circle and paints a ship; the gun rises while it
  // paints, so its first shells land with the strike it calls.
  combo('spotter-siege', 'Spotter + Siege Battery', 'A painted ship and shells: which do you break first?', ['spotter', 'siege'], ['railgun', 'aegis', 'fullSteam'], {
    lead: 'spotter',
    follow: [{ foe: 'siege', after: 3.5, on: 'station' }],
    rule: 'The Spotter leads. The siege gun\'s hatch opens 3.5 s after the Spotter reaches its circle, so the gun is up while it paints and the first shells land with the strike it calls.',
  }),
  // The Repair Ship sails to its station; a guarded heavy comes out as it gets
  // there, so it has that heavy to mend while the guards take your shots.
  combo('tender-bodyguard', 'Repair Ship + Bodyguard Ring', 'A heavy that\'s guarded and mended: too much?', ['tender', 'bodyguard'], ['flak', 'tesla', 'railgun'], {
    lead: 'tender',
    follow: [{ foe: 'bodyguard', after: 0, on: 'station' }],
    rule: 'The Repair Ship leads. The Bodyguard Ring (a fresh heavy and its guards) launches as the Repair Ship reaches its station, so it has a guarded heavy to mend.',
  }),
  combo('lure-screen', 'Lure Beacon + Drone Screen', 'Your drones chasing the buoy: annoying, or a good puzzle?', ['lure'], ['droneScreen', 'cutter', 'flak'], alone('lure', 'Drone Screen drops by the carrier 1.5 s before each Lure Beacon rises.'), 'droneScreen'),
  combo('cloud-flak', 'Incendiary Missile + Flak', 'Flak catching the firebomb far out, or too close to the convoy.', ['cloud'], ['flak', 'thermo', 'railgun'], alone('cloud', 'Flak drops by the carrier 1.5 s before each Incendiary Missile launches.'), 'flak'),
  // One raid: the decoy swarm and the sprinters out of the same base, the
  // one furthest off (the sprinters' dash cuts their flight short).
  combo('decoy-sprint', 'Decoys + Sprint Drones', 'What do you shoot first?', ['decoy', 'sprinter'], ['flak', 'cutter', 'scatter'], {
    lead: 'decoy',
    follow: [{ foe: 'sprinter', after: 0.5, base: 'same' }],
    far: true,
    rule: 'One raid, out of the launch base furthest from the convoy: the Decoy swarm leads and the Sprint Drones follow 0.5 s later out of the same base.',
  }),
  // The truck drives to its spot; the gun's hatch opens as it gets there, so
  // the gun is up as the launcher finishes rising and both fire together.
  combo('siege-truck', 'Siege Battery + Rocket Truck', 'Shells and rockets you can\'t stop: which launcher first?', ['siege', 'rocketTruck'], ['railgun', 'lance', 'bomberWing'], {
    lead: 'rocketTruck',
    follow: [{ foe: 'siege', after: 0, on: 'station' }],
    rule: 'The Rocket Truck leads. The siege gun\'s hatch opens as the truck stops to raise its launcher, so the shells and the rockets come in the same window.',
  }),
  combo('guard-seeker', 'Bodyguard Ring + Seeker Pod', 'Do the guards soak up your seekers?', ['bodyguard'], ['seeker', 'airstrike', 'flak'], alone('bodyguard', 'Seeker Pod drops by the carrier 1.5 s before each Bodyguard Ring launches.'), 'seeker'),
  // The hydra is twice as fast as the sprinters: out of the same base once
  // they are part way, it catches them up and they arrive together.
  combo('hydra-tesla', 'Hydra + Sprint Drones, Tesla', 'Area answers to split targets.', ['hydra', 'sprinter'], ['tesla', 'flak', 'thermo'], {
    lead: 'sprinter',
    follow: [{ foe: 'hydra', after: 1.5, on: 'arrive', base: 'same' }],
    far: true,
    rule: 'The Sprint Drones lead, out of the launch base furthest from the convoy. The Hydra follows out of the same base once they are part way, timed to catch them up, so they arrive together. Tesla drops by the carrier 1.5 s before each set.',
  }, 'tesla'),
];

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
  'siren-field': ['droneScreen', 'gunships', 'flak'],
  firestorm: ['flak', 'railgun', 'bomberWing'],
};

const EVENT_CARDS: LabCard[] = EVENT_ORDER.map((id) => ({
  id: `ev-${id}`,
  kind: 'event',
  name: EVENTS[id].name,
  look: EVENTS[id].look,
  foes: [EVENTS[id].foe],
  kit: EVENT_KITS[id],
  map: eventMap(id),
  event: id,
  wave: EVENT_WAVE,
}));

/** Maps: a map card plays that map's own waves, with its chapter's enemies. */
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
  { kind: 'combo', name: 'Combos', blurb: 'Two things that should meet: they come in together.' },
  { kind: 'map', name: 'Maps', blurb: 'A map\'s own waves, with its chapter\'s enemies.' },
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
  scavenger: [{ round: 2, what: 'Circles over the water; a quadcopter with a claw' }],
  decoy: [
    { round: 2, what: 'The tell comes later; decoys fly like real drones' },
    { round: 3, what: 'The swarm spreads out; easier to tell apart' },
  ],
  armored: [{ round: 2, what: 'New shield that flares on a blocked hit' }],
  spotter: [{ round: 2, what: 'Spots from further away' }],
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
  'w-grapnel': [{ round: 5, what: 'Reaches the whole screen from level 1; level 2 swings faster and smacks for 3' }],
  'w-droneScreen': [{ round: 5, what: 'Drones wait on deck until a threat is on screen' }],
  'w-focus': [{ round: 5, what: 'A quick tap is a shot; slow motion only after a 0.3 s hold' }],
  'w-frigate': [{ round: 5, what: 'A new drop turns leaving frigates round instead of replacing them' }],
  'w-supplyRun': [{ round: 5, what: 'No magnet; crates can hold your weapons and boosts, and Airdrop now and then a Nuke' }],
  'w-bomberWing': [{ round: 5, what: 'Bombs aircraft and subs too; on screen before its bomb lands, as it passes over' }],
  'w-overdrive': [{ round: 5, what: 'MAX: every shot visibly fires twice (two shells, two beams)' }],
  'w-wildCard': [{ round: 5, what: 'Now a weapon that takes over the gun, not a boost' }],
  'w-shield': [{ round: 5, what: 'New levels: no strafe block; a round back per block, then 18 s and Reflect' }],
  // Round 4 (docs/design/v3-lab-round4.md): the player's notes on Spotter +
  // Siege Battery, Dual Wield and Cadence.
  'w-dualWield': [{ round: 4, what: 'A second Dual Wield restarts both hands; another boost no longer empties them' }],
  'w-cadence': [{ round: 4, what: 'War Drum (MAX): on the beat it blows up trucks, siege guns, helicopters, subs and repair ships' }],
  'combo-spotter-siege': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-tender-bodyguard': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-lure-screen': [{ round: 4, what: 'Drone Screen now drops by the carrier just before each Lure Beacon' }],
  'combo-cloud-flak': [{ round: 4, what: 'Flak now drops by the carrier just before each Incendiary Missile' }],
  'combo-decoy-sprint': [{ round: 4, what: 'Its enemies now arrive together' }],
  'combo-siege-truck': [
    { round: 2, what: 'New pairing' },
    { round: 4, what: 'Its enemies now arrive together' },
  ],
  'combo-guard-seeker': [
    { round: 2, what: 'New pairing' },
    { round: 4, what: 'Seeker Pod now drops by the carrier just before each Bodyguard Ring' },
  ],
  'combo-hydra-tesla': [
    { round: 2, what: 'New pairing' },
    { round: 4, what: 'Its enemies now arrive together; Tesla drops by the carrier just before' },
  ],
  // Round 5 (docs/design/v3-special-events-build.md): the special events;
  // round 6 (docs/design/v3-events-round6.md): the player's notes on them.
  'ev-rush': [{ round: 5, what: 'New event: six sprint swarms and a dashed line on the water' }],
  'ev-decoy-storm': [{ round: 5, what: 'New event: ten swarms, mostly decoys, and no ammo drops' }],
  'ev-hydra-bloom': [{ round: 5, what: 'New event: two fans of Hydras and a dashed line on the water' }],
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
  ],
  'ev-repair-yard': [
    { round: 5, what: 'New event: a tough mothership mended by three tenders' },
    { round: 6, what: 'The repair ships sail in from different sides to meet on the mothership\'s course; none stuck' },
  ],
  'ev-escort-run': [{ round: 5, what: 'New event: one heavy in three rings of guards' }],
  'ev-siren-field': [{ round: 5, what: 'New event: five lure beacons and six swarms' }],
  'ev-firestorm': [{ round: 5, what: 'New event: firebombs from every side; their fires burn longer' }],
};

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
