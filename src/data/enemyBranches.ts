// The enemy attack catalogue — the data behind docs/ENEMY_ATTACKS.md.
//
// Branch → Node → Tactic, plus the shared Targeting Doctrine ladder. This file
// is the enemy's side of the arms race and the price list its procurement
// economy (src/sim/evolution.ts) buys from. docs/SEESAW.md is the economy that
// spends against these prices; docs/ENEMY_ATTACKS.md is the locked design.
//
// Two flags matter for honesty about what the game can actually do today:
//
//   • `implemented` — whether the simulation can genuinely FIELD this branch.
//     The allocator refuses to spend on anything it cannot field, so budget is
//     never silently burned on a threat that would never appear. Missiles,
//     mines and torpedoes are live; the rest are catalogued (costs, gates,
//     targeting grants)
//     and switch on by flipping this flag once their spawn/behaviour lands.
//
//   • `nodes[].implemented` — same idea one level down: a branch can be live
//     while its later variants are not (e.g. missiles field unguided/guided
//     today, but sea-skimming and MIRV are designed and not yet built).

export type EnemyBranchKey =
  | 'missiles'
  | 'mines'
  | 'torpedoes'
  | 'attackBoats'
  | 'artillery'
  | 'smoke'
  | 'electronic';

/** Targeting Doctrine tiers — one shared ladder across every aimed weapon.
 *  Each rung is granted by a different branch reaching a milestone, so a
 *  broader arsenal literally makes the enemy aim smarter (ENEMY_ATTACKS.md). */
export type TargetingTier = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TargetingDoctrineDef {
  tier: TargetingTier;
  name: string;
  desc: string;
  /** Branch whose node unlocks this rung (null = available from the start). */
  grantedBy: EnemyBranchKey | null;
}

export const TARGETING_DOCTRINE: readonly TargetingDoctrineDef[] = [
  {
    tier: 0,
    name: 'Unaimed spread',
    desc: 'Launches scatter across lanes with no ship preference — the round-1 probe.',
    grantedBy: null,
  },
  {
    tier: 1,
    name: 'Aim-and-fire',
    desc: 'Each shot commits to a specific ship’s lead position before launch.',
    grantedBy: 'missiles',
  },
  {
    tier: 2,
    name: 'Nearest-to-shore',
    desc: 'Prefers ships in the lane closest to the hostile shore.',
    grantedBy: 'artillery',
  },
  {
    tier: 3,
    name: 'Finish the wounded',
    desc: 'Prefers the lowest-health ship — picks off cripples before they deliver.',
    grantedBy: 'missiles',
  },
  {
    tier: 4,
    name: 'High-value priority',
    desc: 'Prefers tankers and the highest-cargo hulls.',
    grantedBy: 'attackBoats',
  },
  {
    tier: 5,
    name: 'Isolation priority',
    desc: 'Prefers ships outside the player’s defensive coverage.',
    grantedBy: 'electronic',
  },
  {
    tier: 6,
    name: 'Deny-the-delivery',
    desc: 'Prefers ships nearest the exit — robs the player of a near-certain delivery.',
    grantedBy: 'smoke',
  },
] as const;

export interface EnemyNodeDef {
  id: string;
  name: string;
  /** Budget cost per unit fielded.
   *
   *  PRICE BY REALIZED LETHALITY, not by nominal unit. A unit that reliably
   *  kills a hull AND cannot be shot down is worth several that can be
   *  intercepted — price them the same and the ROI allocator will (correctly)
   *  buy nothing but the efficient one, and the seesaw locks. Mines and
   *  torpedoes sit well above missiles for exactly this reason: a playtest
   *  sweep measured mine ROI at 17x missile ROI when they were priced alike. */
  cost: number;
  /** Campaign round before which this node cannot be fielded at all — the
   *  progression gate from ENEMY_ATTACKS.md ("nodes are gated, tactics are
   *  bought"). */
  gateRound: number;
  /** Cap on units the FIRST time this node appears, so a debut is a discovery
   *  beat rather than an ambush. */
  firstAppearanceCap: number;
  /** Targeting rung this node grants when first fielded. */
  grantsTargeting?: TargetingTier;
  /** False while the sim cannot yet spawn this variant. */
  implemented: boolean;
  /** Intel-warning text shown the round before the debut (when known). */
  warning?: string;
  /** Discovery-card key, matching the player-facing TechKey where one exists. */
  techKey?: string;
}

export interface EnemyTacticDef {
  id: string;
  name: string;
  /** Multiplier on how much of the branch is bought once this rung is active —
   *  the "quantitative" escalation axis. */
  volumeMult: number;
  /** Rounds of sustained investment in the branch before this rung unlocks. */
  unlockAfterRounds: number;
}

export interface EnemyBranchDef {
  key: EnemyBranchKey;
  name: string;
  /** Why this is a distinct threat (one line, for the log and the UI). */
  identity: string;
  /** False while the sim cannot field the branch at all. */
  implemented: boolean;
  /** Round before which the enemy will not open this branch. */
  openRound: number;
  /** One-off budget cost to open the branch (a real barrier to breadth, so the
   *  enemy commits rather than dabbling in everything at once). */
  openCost: number;
  /** Hard ceiling on units fielded in one round. Budget alone is not enough of
   *  a limit for cheap units — 10 mines is a minefield, 40 is a wall. */
  maxUnitsPerRound: number;
  nodes: EnemyNodeDef[];
  tactics: EnemyTacticDef[];
}

/** Standard three-rung tactic ladder. Branches differ in flavour, not shape:
 *  sustained investment buys more volume of whatever the branch fields. */
function tacticLadder(names: [string, string, string]): EnemyTacticDef[] {
  return [
    { id: 't0', name: names[0], volumeMult: 1, unlockAfterRounds: 0 },
    { id: 't1', name: names[1], volumeMult: 1.45, unlockAfterRounds: 2 },
    { id: 't2', name: names[2], volumeMult: 1.95, unlockAfterRounds: 5 },
  ];
}

export const ENEMY_BRANCHES: Record<EnemyBranchKey, EnemyBranchDef> = {
  missiles: {
    key: 'missiles',
    name: 'Missiles',
    identity: 'The bread-and-butter air threat — tapped down by interceptors and close-in defense.',
    implemented: true,
    openRound: 1,
    openCost: 0, // always open; it is the round-1 probe
    maxUnitsPerRound: 46,
    nodes: [
      {
        id: 'unguided',
        name: 'Unguided missile',
        cost: 8,
        gateRound: 1,
        firstAppearanceCap: 99,
        grantsTargeting: 1,
        implemented: true,
        techKey: 'missile',
      },
      {
        id: 'guided',
        name: 'Guided missile',
        cost: 15,
        gateRound: 2,
        firstAppearanceCap: 3,
        grantsTargeting: 3,
        implemented: true,
        techKey: 'guidedMissile',
        warning:
          'Signals intercepts suggest the enemy is testing terminal-guidance seekers for its anti-ship missiles.',
      },
      {
        id: 'seaSkimming',
        name: 'Sea-skimming missile',
        cost: 22,
        gateRound: 6,
        firstAppearanceCap: 3,
        implemented: false,
        warning:
          'Radar returns suggest the enemy is rehearsing low-altitude attack profiles that would arrive with far less warning.',
      },
      {
        id: 'swarm',
        name: 'Swarm / MIRV missile',
        cost: 30,
        gateRound: 9,
        firstAppearanceCap: 2,
        implemented: false,
        warning:
          'Analysts believe the enemy is developing a missile bus that splits into several warheads near the convoy.',
      },
    ],
    tactics: tacticLadder(['Single missile', 'Small volley', 'Coordinated volleys']),
  },

  mines: {
    key: 'mines',
    name: 'Mines',
    identity: 'Pre-placed area denial, defeated by sensing and clearing rather than shooting.',
    implemented: true,
    openRound: 3,
    openCost: 40,
    maxUnitsPerRound: 10,
    nodes: [
      {
        id: 'standard',
        name: 'Standard mine',
        cost: 28,
        gateRound: 3,
        firstAppearanceCap: 4,
        implemented: true,
        techKey: 'mine',
        warning:
          'Coastal traffic reports unusual enemy small-boat activity consistent with minelaying rehearsals.',
      },
      {
        id: 'lowSig',
        name: 'Low-signature mine',
        cost: 44,
        gateRound: 5,
        firstAppearanceCap: 3,
        implemented: true,
        techKey: 'lowSigMine',
        warning:
          'Analysts believe the enemy is developing composite mine casings designed to defeat standard sonar.',
      },
      {
        id: 'drifting',
        name: 'Drifting mine',
        cost: 58,
        gateRound: 8,
        firstAppearanceCap: 3,
        implemented: false,
        warning:
          'Hydrographic reports suggest the enemy is fielding mines that reposition with the current.',
      },
    ],
    tactics: tacticLadder(['One lane', 'Two lanes', 'Every lane, dispersed']),
  },

  torpedoes: {
    key: 'torpedoes',
    name: 'Torpedoes',
    identity: 'The underwater branch — immune to every air-defense investment the player has made.',
    implemented: true,
    openRound: 5,
    openCost: 40,
    maxUnitsPerRound: 8,
    nodes: [
      {
        id: 'straight',
        name: 'Straight-running torpedo',
        cost: 34,
        gateRound: 5,
        firstAppearanceCap: 2,
        implemented: true,
        techKey: 'torpedo',
        warning: 'Hydrophone intercepts suggest the enemy is preparing shore-launched torpedo runs.',
      },
      {
        id: 'homing',
        name: 'Homing torpedo',
        cost: 48,
        gateRound: 7,
        firstAppearanceCap: 2,
        implemented: true,
        techKey: 'homingTorpedo',
        warning:
          'Acoustic analysis indicates the enemy is fitting its torpedoes with terminal homing.',
      },
      {
        id: 'lowSigTorpedo',
        name: 'Low-signature torpedo',
        cost: 62,
        gateRound: 10,
        firstAppearanceCap: 2,
        implemented: true,
        techKey: 'lowSigTorpedo',
        warning:
          'Analysts warn of a wakeless torpedo design that would leave nothing to read on the water.',
      },
    ],
    tactics: tacticLadder(['Single torpedo', 'Several torpedoes', 'Torpedo volleys']),
  },

  attackBoats: {
    key: 'attackBoats',
    name: 'Attack Boats',
    identity: 'Persistent, sinkable surface craft that engage one ship at a time until it is gone.',
    implemented: false,
    openRound: 4,
    openCost: 45,
    maxUnitsPerRound: 6,
    nodes: [
      {
        id: 'smallArms',
        name: 'Small-arms boat',
        cost: 30,
        gateRound: 4,
        firstAppearanceCap: 2,
        implemented: false,
        warning: 'Fast craft are massing in the coastal inlets — expect close-in surface attacks.',
      },
      {
        id: 'rocket',
        name: 'Rocket boat',
        cost: 42,
        gateRound: 7,
        firstAppearanceCap: 2,
        implemented: false,
      },
      {
        id: 'boarding',
        name: 'Boarding boat',
        cost: 55,
        gateRound: 9,
        firstAppearanceCap: 1,
        grantsTargeting: 4,
        implemented: false,
      },
    ],
    tactics: tacticLadder(['Single boat', 'Several boats', 'Waves of boats']),
  },

  artillery: {
    key: 'artillery',
    name: 'Artillery',
    identity: 'Direct-fire shore guns — suppressed, never intercepted, and only reach the near lane.',
    implemented: false,
    openRound: 6,
    openCost: 35,
    maxUnitsPerRound: 4,
    nodes: [
      {
        id: 'coastalGun',
        name: 'Coastal gun',
        cost: 20,
        gateRound: 6,
        firstAppearanceCap: 1,
        grantsTargeting: 2,
        implemented: false,
        warning: 'Emplacement work is visible on the headland — shore batteries are being prepared.',
      },
      {
        id: 'ranging',
        name: 'Ranging artillery',
        cost: 32,
        gateRound: 8,
        firstAppearanceCap: 1,
        implemented: false,
      },
      {
        id: 'rollingBarrage',
        name: 'Rolling barrage',
        cost: 45,
        gateRound: 11,
        firstAppearanceCap: 1,
        implemented: false,
      },
    ],
    tactics: tacticLadder(['Intermittent fire', 'Increased rate of fire', 'Several barrages']),
  },

  smoke: {
    key: 'smoke',
    name: 'Smoke / Concealment',
    identity: 'Denial of the player’s eyes — multiplies every other branch by shrinking reaction time.',
    implemented: false,
    openRound: 7,
    openCost: 30,
    maxUnitsPerRound: 2,
    nodes: [
      {
        id: 'screening',
        name: 'Screening smoke',
        cost: 18,
        gateRound: 7,
        firstAppearanceCap: 1,
        implemented: false,
        warning: 'The enemy has been laying smoke over its launch sites during drills.',
      },
      {
        id: 'blinding',
        name: 'Blinding smoke',
        cost: 28,
        gateRound: 10,
        firstAppearanceCap: 1,
        grantsTargeting: 6,
        implemented: false,
      },
    ],
    tactics: tacticLadder(['Once per round', 'Twice per round', 'Sustained screening']),
  },

  electronic: {
    key: 'electronic',
    name: 'Electronic Attack / Drones',
    identity: 'The support wing — degrades the player’s systems rather than sinking ships directly.',
    implemented: false,
    openRound: 8,
    openCost: 40,
    maxUnitsPerRound: 3,
    nodes: [
      {
        id: 'reconPlane',
        name: 'Recon plane',
        cost: 25,
        gateRound: 8,
        firstAppearanceCap: 1,
        grantsTargeting: 5,
        implemented: false,
        warning: 'Unidentified aircraft have been probing the strait’s approaches.',
      },
      {
        id: 'disablingDrone',
        name: 'Ship-disabling drone',
        cost: 35,
        gateRound: 10,
        firstAppearanceCap: 1,
        implemented: false,
      },
      {
        id: 'sensorJamming',
        name: 'Sensor jamming',
        cost: 40,
        gateRound: 12,
        firstAppearanceCap: 1,
        implemented: false,
      },
    ],
    tactics: tacticLadder(['One effect per round', 'Two effects per round', 'Layered disruption']),
  },
};

export const ENEMY_BRANCH_ORDER: readonly EnemyBranchKey[] = [
  'missiles',
  'mines',
  'torpedoes',
  'attackBoats',
  'artillery',
  'smoke',
  'electronic',
];

/** Branches the simulation can actually field right now. The allocator only
 *  ever spends here — budget is never burned on a threat that would not
 *  appear, which would silently make the enemy weaker than its budget says. */
export function implementedBranches(): EnemyBranchKey[] {
  return ENEMY_BRANCH_ORDER.filter((k) => ENEMY_BRANCHES[k].implemented);
}

/** Nodes of a branch the sim can field, cheapest first. */
export function implementedNodes(key: EnemyBranchKey): EnemyNodeDef[] {
  return ENEMY_BRANCHES[key].nodes.filter((n) => n.implemented);
}

/** The highest tactic rung unlocked after N rounds of sustained investment. */
export function tacticForRounds(key: EnemyBranchKey, roundsInvested: number): EnemyTacticDef {
  const ladder = ENEMY_BRANCHES[key].tactics;
  let best = ladder[0];
  for (const rung of ladder) {
    if (roundsInvested >= rung.unlockAfterRounds) best = rung;
  }
  return best;
}
