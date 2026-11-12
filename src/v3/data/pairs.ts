// Enemy pairs (docs/design/v3-enemy-pairs.md): two enemies that make each
// other more dangerous, or cover each other's weakness, and the rule that
// brings them in together. The player (Test Lab round 8): "the pairs should
// be enemy pairs, not player and enemy attack pairs. Basically looking for
// good synergy combos to add to the maps."
//
// One list, read by the Test Lab (a Combos card per pair, data/lab.ts) and,
// later, by the map scripts: a wave can place a pair by its id and launch it
// with the same rule (updateLabSets in sim/game.ts shows how).

import type { AbilityId } from './abilities';
import type { ThreatKind } from './config';
import { FOES, type FoeId } from './foes';

/** The original threats a pair can bring (out of a launch base, as a wave's
 *  raid does): how many one set brings, `every` s apart out of one base. */
export const OLD_THREATS = {
  drone: { name: 'Drone Swarm', size: 6, every: 0.35 },
  cluster: { name: 'Cluster Missiles', size: 2, every: 0.6 },
} as const;
export type OldThreat = keyof typeof OLD_THREATS;

/** A pair's member: one of the new enemies (one unit of it, as a wave
 *  plans it), or an original threat (OLD_THREATS: a swarm, a volley). */
export type PairMember = FoeId | OldThreat;

export function isOldThreat(m: PairMember): m is OldThreat {
  return m in OLD_THREATS;
}

/** The threat kind a member is launched and seen as. */
export function memberKind(m: PairMember): ThreatKind {
  return isOldThreat(m) ? m : FOES[m].kind;
}

export function memberName(m: PairMember): string {
  return isOldThreat(m) ? OLD_THREATS[m].name : FOES[m].name;
}

/** The chapter a member is first in (the original threats: from the first). */
export function memberChapter(m: PairMember): number {
  return isOldThreat(m) ? 1 : FOES[m].chapter;
}

/** One of a pair's others: when it comes after the lead. */
export interface PairFollow {
  foe: PairMember;
  /** Seconds after the cue. */
  after: number;
  /** The cue: the lead's launch (the default); the lead getting to its
   *  station (`station`: the Spotter on its circle, the Repair Ship on
   *  station, the Rocket Truck at the end of its road, the Attack
   *  Helicopter at its hover, the Lure Beacon risen); or (`arrive`) a faster
   *  one after a slow lead, launched once the lead is due within its own
   *  flight time plus `after` s, so they arrive together. A lead shot down
   *  first, or one that hasn't got to its station in LAB_SET.station s, lets
   *  the others come at once. */
  on?: 'launch' | 'station' | 'arrive';
  /** Out of the lead's launch base. */
  base?: 'same';
  /** Placed by the lead: a Torpedo Sub surfaces under an Attack
   *  Helicopter's hover; a Rocket Truck takes the road whose end its Repair
   *  Ship is moored off; a Bodyguard Ring forms round the lead (no heavy of
   *  its own). */
  near?: true;
}

/** How a pair's set comes in together (Test Lab round 4: "the recon drone
 *  and then the siege cannon never really appeared at the same time"). */
export interface LabPair {
  /** Leads the set: launched at the set's time. */
  lead: PairMember;
  follow: PairFollow[];
  /** The lead comes out of the launch base furthest from the convoy (the
   *  longest look at a fast pair). */
  far?: boolean;
  /** Sets of this pair in one wave are at least this far apart (s): a long
   *  pair's next set waits until the last one is done. Default
   *  LAB_SET.gap. */
  gap?: number;
  /** The rule in words (the docs, and the review page). */
  rule: string;
}

export interface EnemyPair {
  /** The id a map script places it by (its Test Lab card is `combo-<id>`). */
  id: string;
  name: string;
  /** Every member, the lead first (a member twice: two of it). */
  members: PairMember[];
  /** The first chapter it can come in: every member is out by then. */
  chapter: 1 | 2 | 3 | 4;
  /** The synergy: what each one does for the other, in one line. */
  synergy: string;
  /** The Test Lab card's question (never how to beat it). */
  look: string;
  /** The Test Lab card's kit: a loadout from its chapter, nothing tied to
   *  the pair. */
  kit: AbilityId[];
  pair: LabPair;
}

const P = (p: Omit<EnemyPair, 'members'>): EnemyPair => ({ ...p, members: [p.pair.lead, ...p.pair.follow.map((f) => f.foe)] });

/** The pairs, by chapter. */
export const PAIRS: EnemyPair[] = [
  // ---- Chapter 1: Home Waters ----
  P({
    id: 'decoy-sprint',
    name: 'Decoys + Sprint Drones',
    chapter: 1,
    synergy: 'Half the swarm is fake and the sprinters fly in among it: every shot spent on a decoy is one not spent on a drone that is about to sprint.',
    look: 'What do you shoot first?',
    kit: ['flak', 'cutter', 'scatter'],
    pair: {
      lead: 'decoy',
      follow: [{ foe: 'sprinter', after: 0.5, base: 'same' }],
      far: true,
      rule: 'One raid, out of the launch base furthest from the convoy: the Decoy swarm leads and the Sprint Drones follow 0.5 s later out of the same base.',
    },
  }),
  P({
    id: 'decoy-cluster',
    name: 'Decoys + Cluster Missiles',
    chapter: 1,
    synergy: 'The decoy swarm draws your shots in the very seconds the cluster missiles have to die, before they split over the convoy.',
    look: 'A swarm and two missiles at once: where do your shots go?',
    kit: ['flak', 'railgun', 'seeker'],
    pair: {
      lead: 'decoy',
      follow: [{ foe: 'cluster', after: 1, on: 'arrive', base: 'same' }],
      far: true,
      rule: 'The Decoy swarm leads, out of the launch base furthest from the convoy. Two Cluster Missiles follow out of the same base, launched so they reach the convoy with the swarm.',
    },
  }),
  P({
    id: 'hydra-swarm',
    name: 'Hydra + Drone Swarm',
    chapter: 1,
    synergy: 'The Hydra flies inside a drone swarm: whatever clears the drones as they close on the ships kills the Hydra there too, and splits it into darts at the convoy.',
    look: 'A Hydra in the swarm: when do you take it?',
    kit: ['flak', 'railgun', 'cutter'],
    pair: {
      lead: 'drone',
      follow: [{ foe: 'hydra', after: 1, on: 'arrive', base: 'same' }],
      far: true,
      rule: 'A swarm of six drones leads, out of the launch base furthest from the convoy. The Hydra follows out of the same base, launched so it catches the swarm up and they arrive together.',
    },
  }),
  // ---- Chapter 2: The Narrows ----
  P({
    id: 'scavenger-swarm',
    name: 'Scavenger + Drone Swarm',
    chapter: 2,
    synergy: 'The Scavenger waits over the water where your pickups fall; the swarm makes you spend ammo, and the Scavenger keeps you from the pickups that would refill it.',
    look: 'A swarm, and something waiting for your drops: what do you do first?',
    kit: ['flak', 'lance', 'cutter'],
    pair: {
      lead: 'scavenger',
      follow: [{ foe: 'drone', after: 2.5 }],
      rule: 'The Scavenger leads, in from the top to circle over the water. A swarm of six drones launches 2.5 s later, so it comes in while the Scavenger is circling.',
    },
  }),
  P({
    id: 'heli-sub',
    name: 'Attack Helicopter + Torpedo Sub',
    chapter: 2,
    synergy: 'The helicopter hovers over the sub\'s water and keeps your gun busy with its missile pairs; the sub surfaces under it, and its short time up goes by while you deal with the helicopter.',
    look: 'A helicopter overhead and a periscope under it: which first?',
    kit: ['lance', 'railgun', 'fullSteam'],
    pair: {
      lead: 'attackHeli',
      follow: [{ foe: 'torpedoSub', after: 1, on: 'station', near: true }],
      rule: 'The Attack Helicopter leads. The Torpedo Sub\'s periscope comes up 1 s after the helicopter reaches its hover, on the water under it (the nearest water, if it hovers over land).',
    },
  }),
  P({
    id: 'armored-hydra',
    name: 'Armored Drones + Hydra',
    chapter: 2,
    synergy: 'The armored drones make you wait for their bank; the Hydra makes you shoot early, before it splits. Together there is no good time to wait.',
    look: 'Plates and a Hydra together: what do you wait for?',
    kit: ['thermo', 'railgun', 'lance'],
    pair: {
      lead: 'armored',
      follow: [
        { foe: 'armored', after: 0.6, base: 'same' },
        { foe: 'hydra', after: 1, on: 'arrive', base: 'same' },
      ],
      far: true,
      rule: 'Two Armored Drones lead, 0.6 s apart, out of the launch base furthest from the convoy. The Hydra follows out of the same base, launched so it catches them up and they arrive together.',
    },
  }),
  // ---- Chapter 3: Dark Water ----
  P({
    id: 'spotter-siege',
    name: 'Spotter + Siege Battery',
    chapter: 3,
    synergy: 'The Spotter paints a ship and the siege gun rises while it paints, so the first shells land with the strike the Spotter calls.',
    look: 'A painted ship and shells: which do you break first?',
    kit: ['railgun', 'aegis', 'fullSteam'],
    pair: {
      lead: 'spotter',
      follow: [{ foe: 'siege', after: 3.5, on: 'station' }],
      rule: 'The Spotter leads. The siege gun\'s hatch opens 3.5 s after the Spotter reaches its circle, so the gun is up while it paints and the first shells land with the strike it calls.',
    },
  }),
  P({
    id: 'siege-truck',
    name: 'Siege Battery + Rocket Truck',
    chapter: 3,
    synergy: 'Two launchers you can\'t outshoot, one after the other: the gun comes up while the truck is still firing, so there is no quiet moment to break either.',
    look: 'Rockets, then shells: which launcher first?',
    kit: ['railgun', 'lance', 'bomberWing'],
    pair: {
      lead: 'rocketTruck',
      follow: [{ foe: 'siege', after: 6.5, on: 'station' }],
      gap: 28,
      rule: 'The Rocket Truck leads. The siege gun\'s hatch opens 6.5 s after the truck stops, as it fires its last salvo: the shells start landing about 1.5 to 2 s after the last rockets, so the two take turns. A wave\'s sets are at least 28 s apart.',
    },
  }),
  P({
    id: 'spotter-dive',
    name: 'Spotter + Dive Bombers',
    chapter: 3,
    synergy: 'The Spotter paints a ship and the dive bombers put their circles on it: with the strike it calls, three hits come at the one ship.',
    look: 'One ship painted, two circles on it: what do you break?',
    kit: ['railgun', 'aegis', 'fullSteam'],
    pair: {
      lead: 'spotter',
      follow: [
        { foe: 'diveBomber', after: 2.5, on: 'station' },
        { foe: 'diveBomber', after: 4, on: 'station' },
      ],
      rule: 'The Spotter leads. Two Dive Bombers follow, their circles 2.5 s and 4 s after the Spotter reaches its circle (it paints from 2 s), so the second circle shows as the first plane comes in: a dive bomber\'s circle goes on the painted ship.',
    },
  }),
  // ---- Chapter 4: Open War ----
  P({
    id: 'tender-bodyguard',
    name: 'Repair Ship + Bodyguard Ring',
    chapter: 4,
    synergy: 'The guards take your shots for the heavy while the Repair Ship mends what gets through.',
    look: 'A heavy that\'s guarded and mended: too much?',
    kit: ['flak', 'tesla', 'railgun'],
    pair: {
      lead: 'tender',
      follow: [{ foe: 'bodyguard', after: 0, on: 'station' }],
      rule: 'The Repair Ship leads. The Bodyguard Ring (a fresh heavy and its guards) launches as the Repair Ship reaches its station, so it has a guarded heavy to mend.',
    },
  }),
  P({
    id: 'tender-truck',
    name: 'Repair Ship + Rocket Truck',
    chapter: 4,
    synergy: 'The Repair Ship moors off the end of the truck\'s road and mends the truck between salvos: a truck you only half break comes back.',
    look: 'A truck that keeps getting mended: which do you go for?',
    kit: ['railgun', 'lance', 'bomberWing'],
    pair: {
      lead: 'tender',
      follow: [{ foe: 'rocketTruck', after: 0, on: 'station', near: true }],
      rule: 'The Repair Ship leads, to a station on the water off the end of a shore road. The Rocket Truck comes down that road as the Repair Ship reaches its station, so it fires within the ship\'s reach.',
    },
  }),
  P({
    id: 'lure-stealth',
    name: 'Lure Beacon + Stealth Strafers',
    chapter: 4,
    synergy: 'The beacon pulls your helpers\' fire onto itself, and the strafers, with no warning, come in while your helpers are busy on it.',
    look: 'Your helpers on the beacon and strafers with no warning: where do you look?',
    kit: ['railgun', 'gunships', 'aegis'],
    pair: {
      lead: 'lure',
      follow: [
        { foe: 'stealthJet', after: 0.5, on: 'station' },
        { foe: 'stealthJet', after: 3, on: 'station' },
      ],
      rule: 'The Lure Beacon leads. Two Stealth Strafers follow, 0.5 s and 3 s after it has risen, so they come in while it is drawing your helpers.',
    },
  }),
  P({
    id: 'guard-spotter',
    name: 'Bodyguard Ring + Spotter',
    chapter: 4,
    synergy: 'The guards take the shots meant for the Spotter, so it stays up to paint its ship and call its strike.',
    look: 'A Spotter in a ring of guards: how long does it paint?',
    kit: ['flak', 'railgun', 'tesla'],
    pair: {
      lead: 'spotter',
      follow: [{ foe: 'bodyguard', after: 0, near: true }],
      rule: 'The Spotter leads, with a ring of three guards round it from the moment it flies in (the ring brings no heavy of its own).',
    },
  }),
];

/** The pair a map script asks for by id. */
export function enemyPair(id: string): EnemyPair | undefined {
  return PAIRS.find((p) => p.id === id);
}

/** A pair's Test Lab card. */
export function pairCardId(id: string): string {
  return `combo-${id}`;
}

/** The first chapter every one of these members is out in. */
export function pairChapter(members: PairMember[]): number {
  return Math.max(1, ...members.map(memberChapter));
}

/** The new enemies in a pair (the Test Lab's mix, and its card's tally),
 *  each once. */
export function pairFoes(p: EnemyPair): FoeId[] {
  return [...new Set(p.members.filter((m): m is FoeId => !isOldThreat(m)))];
}
