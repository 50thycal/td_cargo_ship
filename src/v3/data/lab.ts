// The Test Lab (docs/design/v3-test-lab.md): a playtest hub. Each card is
// one thing to test: a new enemy, a weapon, a combo of two things that
// should meet, or a map. New weapons and maps join it later as more cards.
// The player's marks (tools/v3/test-lab/marks-2026-11-08.json): everything on
// the list (all 29 weapons too), wave 5 to start, a fast even pace, normal
// upgrades between waves, a Quick or Full length.

import { ABILITIES, ABILITY_ORDER, type AbilityId } from './abilities';
import { FOES, type FoeId } from './foes';
import { MAPS, MAP_ORDER, type MapId } from './maps';

export type LabKind = 'enemy' | 'weapon' | 'combo' | 'map';

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
}

/** The lab's own water: open, plain, no map system to get in the way. */
export const LAB_MAP: MapId = 'strait';

/** How long a test runs (waves): Quick, or Full (about ten minutes with the
 *  drafts). Done ends either early. */
export const LAB_LENGTH = { quick: 2, full: 8 } as const;
export type LabLength = keyof typeof LAB_LENGTH;

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
  enemy('diveBomber', 'Now an A-10, and quicker: does it read, and is the window still fair?', ['railgun', 'aegis', 'fullSteam']),
  enemy('siege', 'It rises out of a hatch and hides between salvos: can you catch it while it is up?', ['railgun', 'lance', 'fullSteam']),
  enemy('rocketTruck', 'Salvos of five red rockets: does red read as "can\'t stop it, hit the truck"?', ['railgun', 'lance', 'bomberWing']),
  enemy('cloud', 'It leads its ship now and comes in on the bow: do you kill it far out, before its fireball lands on the lane?', ['flak', 'railgun', 'lance']),
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

/** Weapons changed in the lock-in build and not played since: first. */
const REWORKED: Partial<Record<AbilityId, string>> = {
  dualWield: 'Both hands now end with the boost: does it feel right?',
  cadence: 'The 0.9 s beat: can you keep it under pressure?',
  focus: 'Hold one finger to slow time, tap with the other: comfortable?',
  gunships: 'The Hellfires now fly straight to their targets: do they read, are they useful?',
  supplyRun: 'The cargo plane and chutes: clear what you got?',
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

const combo = (id: string, name: string, look: string, foes: FoeId[], kit: AbilityId[], weapon?: AbilityId): LabCard => ({ id: `combo-${id}`, kind: 'combo', name, look, foes, kit, map: LAB_MAP, ...(weapon ? { weapon } : {}) });
const COMBOS: LabCard[] = [
  combo('spotter-siege', 'Spotter + Siege Battery', 'A painted ship and shells: which do you break first?', ['spotter', 'siege'], ['railgun', 'aegis', 'fullSteam']),
  combo('tender-bodyguard', 'Repair Tender + Bodyguard Ring', 'A heavy that\'s guarded and mended: too much?', ['tender', 'bodyguard'], ['flak', 'tesla', 'railgun']),
  combo('lure-screen', 'Lure Beacon + Drone Screen', 'Your drones chasing the buoy: annoying, or a good puzzle?', ['lure'], ['droneScreen', 'cutter', 'flak'], 'droneScreen'),
  combo('cloud-flak', 'Incendiary Missile + Flak', 'Flak catching the firebomb far out, or too close to the convoy.', ['cloud'], ['flak', 'thermo', 'railgun'], 'flak'),
  combo('decoy-sprint', 'Decoys + Sprint Drones', 'What do you shoot first?', ['decoy', 'sprinter'], ['flak', 'cutter', 'scatter']),
  combo('siege-truck', 'Siege Battery + Rocket Truck', 'Shells and rockets you can\'t stop: which launcher first?', ['siege', 'rocketTruck'], ['railgun', 'lance', 'bomberWing']),
  combo('guard-seeker', 'Bodyguard Ring + Seeker Pod', 'Do the guards soak up your seekers?', ['bodyguard'], ['seeker', 'airstrike', 'flak'], 'seeker'),
  combo('hydra-tesla', 'Hydra + Sprint Drones, Tesla', 'Area answers to split targets.', ['hydra', 'sprinter'], ['tesla', 'flak', 'thermo'], 'tesla'),
];

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

export const LAB_CARDS: LabCard[] = [...ENEMIES, ...WEAPONS, ...COMBOS, ...MAP_CARDS];

export const LAB_SECTIONS: { kind: LabKind; name: string; blurb: string }[] = [
  { kind: 'enemy', name: 'New enemies', blurb: 'The open questions first.' },
  { kind: 'weapon', name: 'Weapons', blurb: 'The five reworked ones first, then every other.' },
  { kind: 'combo', name: 'Combos', blurb: 'Two things that should meet.' },
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
  ],
  cloud: [
    { round: 2, what: 'Now the Incendiary Missile: a fireball burns where it bursts' },
    { round: 3, what: 'Leads its ship and comes in on the bow' },
  ],
  lure: [{ round: 2, what: 'Rises out of the water; wide ring; every helper fires at it' }],
  tender: [{ round: 2, what: 'Sails in from the edge and keeps clear of other boats' }],
  scavenger: [{ round: 2, what: 'Circles over the water; a quadcopter with a claw' }],
  decoy: [
    { round: 2, what: 'The tell comes later; decoys fly like real drones' },
    { round: 3, what: 'The swarm spreads out; easier to tell apart' },
  ],
  armored: [{ round: 2, what: 'New shield that flares on a blocked hit' }],
  spotter: [{ round: 2, what: 'Spots from further away' }],
  stealthJet: [{ round: 2, what: '17% faster' }],
  attackHeli: [{ round: 2, what: 'Its missiles fly straight in' }],
  'w-gunships': [{ round: 2, what: 'Hellfires fly straight to their targets' }],
  'w-cutter': [{ round: 2, what: 'A red laser sight from the gun to your finger' }],
  'combo-siege-truck': [{ round: 2, what: 'New pairing' }],
  'combo-guard-seeker': [{ round: 2, what: 'New pairing' }],
  'combo-hydra-tesla': [{ round: 2, what: 'New pairing' }],
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
