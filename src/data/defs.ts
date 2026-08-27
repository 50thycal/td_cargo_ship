// Static definitions: ship classes, modules (cargo / escort / shore-base),
// formations. All content additions (new ships, modules) happen here.
// The research catalogue lives in counters.ts (Category → Branch → Nodes →
// Tactics); the tier→number tables live in statTiers.ts.

import type {
  BaseModuleDef,
  BaseModuleId,
  EscortModuleDef,
  EscortModuleId,
  FormationDef,
  FormationId,
  ModuleDef,
  ModuleId,
  ShipClassDef,
  ShipClassId,
} from '../sim/types';

/** Hull replacement is priced against what a hull EARNS, and that relationship
 *  is the economy's whole safety net.
 *
 *  A hull's delivery pays `value × ECONOMY.cashPerValue`; replacing it costs
 *  `replaceCost`. Set the two equal and the fleet breaks even at a 50% loss
 *  rate — lose half a convoy and you can still rebuild it — which is what
 *  stops a bad round from starting an unrecoverable spiral of fewer hulls
 *  delivering less and buying fewer hulls still.
 *
 *  This replaced a loss-underwriting rebate that achieved the same 50% figure
 *  by paying cash back for sinkings. That worked, but only the designer could
 *  see it working: the round's cash moved for reasons the player could not
 *  read. Pricing the hull instead puts the same protection somewhere they can
 *  check for themselves — the ship costs about what it brings home. */
export const SHIP_CLASSES: Record<ShipClassId, ShipClassDef> = {
  cargo: {
    id: 'cargo',
    name: 'Container Ship',
    hp: 100,
    speed: 26,
    value: 10,
    slots: 2,
    radius: 11,
    length: 34,
    // Earns 40 a run; costs 40 to replace.
    replaceCost: 40,
  },
  tanker: {
    id: 'tanker',
    name: 'Oil Tanker',
    hp: 140,
    speed: 22,
    value: 25,
    slots: 2,
    radius: 14,
    length: 44,
    // Earns 100 a run. Priced slightly above break-even: she is the richest
    // hull afloat and the one that takes neighbours with her when she goes.
    replaceCost: 110,
    explodes: { damage: 50, radius: 90 },
  },
  freighter: {
    id: 'freighter',
    name: 'Fast Freighter',
    hp: 70,
    speed: 34,
    value: 8,
    slots: 1,
    // Earns 32 a run. Cheapest hull in the book, and the first to sink.
    replaceCost: 34,
    radius: 9,
    length: 26,
  },
};

/** Cargo-ship modules. The limited class slots are the point: the player can
 *  never equip every counter at once. Purchases are gated on each branch's
 *  base research node (see counters.MODULE_RESEARCH_REQUIREMENT). */
export const MODULES: Record<ModuleId, ModuleDef> = {
  selfDefense: {
    id: 'selfDefense',
    name: 'Self-Defense Interceptor',
    desc: 'Automatic last-ditch tracer shot at close-in missiles. Uses shared self-defense rounds.',
    costPerShip: 110,
  },
  missileWarning: {
    id: 'missileWarning',
    name: 'Missile-Warning Receiver',
    desc: 'Marks missiles homing on this ship and assists its defenders. Detection only.',
    costPerShip: 45,
  },
  reinforcedHull: {
    id: 'reinforcedHull',
    name: 'Reinforced Hull',
    desc: 'Bonus hull points. Survivability, not a counter.',
    costPerShip: 75,
  },
  mineSonar: {
    id: 'mineSonar',
    name: 'Mine-Detection Sonar',
    desc: 'Reveals nearby mines so the convoy steers clear. Clearing needs drones.',
    costPerShip: 95,
  },
  fireSuppression: {
    id: 'fireSuppression',
    name: 'Fire-Suppression System',
    desc: 'Extinguishes the fires missile hits start on this ship.',
    costPerShip: 55,
  },
  hydrophone: {
    id: 'hydrophone',
    name: 'Hydrophone',
    desc: 'Hears torpedoes and shows their bearing. Depth charges do the killing.',
    costPerShip: 85,
  },
  thermalImaging: {
    id: 'thermalImaging',
    name: 'Thermal/Radar Imaging',
    desc: 'Sees threat tracks through enemy smoke — gives your defenses their eyes back.',
    costPerShip: 90,
  },
  flak: {
    id: 'flak',
    name: 'Anti-Air Flak Mount',
    desc: 'Auto-engages recon planes (and, with fuses, drones). Cannot engage missiles.',
    costPerShip: 100,
  },
  antiBoarding: {
    id: 'antiBoarding',
    name: 'Anti-Boarding Countermeasures',
    desc: 'Slows — and can reject — boarding attempts on this ship.',
    costPerShip: 60,
  },
  compartmentalization: {
    id: 'compartmentalization',
    name: 'Compartmentalization',
    desc: 'Reduces the damage this ship takes after a hit lands.',
    costPerShip: 70,
  },
};

/** Optional specialist slots on a single escort. Missile interceptors are BUILT
 *  IN to every escort and never occupy one of these — the slots are what force
 *  a choice of role, so no one escort carries every weapon.
 *
 *  Each escort is fitted independently (see CampaignState.escortUnits): a
 *  three-escort flotilla can run a gun boat, a submarine hunter and a
 *  minesweeper, or three gun boats when the boats are what is hurting. */
export const ESCORT_MODULE_SLOTS = 2;

/** Slots after the refit-bay unlock. The third slot exists in the architecture
 *  from the start and is simply locked, so an escort's role can deepen later in
 *  a campaign without the loadout model changing shape. */
export const ESCORT_MODULE_SLOTS_UNLOCKED = 3;

/** Longest an escort's player-set name may be. Long enough for a real ship
 *  name, short enough to render in a list row and a transit label. */
export const ESCORT_NAME_MAX = 22;

/** Names handed to escorts as they are commissioned, in order. Past the end of
 *  the list they fall back to a numbered hull, so the player always gets
 *  something meaningful to rename rather than "Escort 4". */
/** Names for commissioned escorts.
 *
 *  Deliberately LONG, and drawn in a per-run shuffled order (see
 *  nextEscortName): a six-name list handed out in list order meant every run
 *  in the game's history opened with Vanguard and Sentinel, so the flotilla
 *  had no identity of its own — the ships were furniture with the same labels
 *  every time. A name is also never reissued inside a run, so a replacement
 *  hull can never sail under the name of one that went down; that reuse made
 *  the after-action report read as though a sunk escort had come back, and it
 *  quietly hid the loss of whatever equipment went down with her.
 *
 *  Themed as watch-and-guard words a small maritime security outfit would
 *  actually paint on a transom. */
export const ESCORT_DEFAULT_NAMES: readonly string[] = [
  'Vanguard', 'Sentinel', 'Seawatch', 'Bulwark', 'Lookout', 'Steadfast',
  'Warden', 'Picket', 'Rampart', 'Beacon', 'Aegis', 'Resolute',
  'Fairwind', 'Nightwatch', 'Sabre', 'Kingfisher', 'Tempest', 'Marlin',
  'Ironside', 'Redoubt', 'Harrier', 'Cutlass', 'Petrel', 'Stalwart',
  'Longshore', 'Tideguard', 'Osprey', 'Valiant', 'Bastion', 'Corsair',
  'Northstar', 'Barracuda', 'Trident', 'Watchman', 'Endeavour', 'Shrike',
];

export const ESCORT_MODULES: Record<EscortModuleId, EscortModuleDef> = {
  deckGun: {
    id: 'deckGun',
    name: 'Deck Gun / Autocannon',
    desc: 'Sustained fire against attack boats — commits until the boat sinks or escapes.',
    cost: 260,
  },
  mcmDroneLauncher: {
    id: 'mcmDroneLauncher',
    name: 'Mine-Countermeasure Drone Launcher',
    desc: 'Sends drones at charted mines (tap one in transit). Each sortie costs a munition.',
    cost: 200,
  },
  depthCharges: {
    id: 'depthCharges',
    name: 'Depth-Charge Launcher',
    desc: 'Lobbed blast that destroys torpedoes in an area. Nothing airborne.',
    cost: 240,
  },
  mineSonar: {
    id: 'mineSonar',
    name: 'Hull-Mounted Mine Sonar',
    desc: 'Hears mines and shares every contact convoy-wide. Send her ahead to chart the water.',
    cost: 190,
  },
};

// ---------------------------------------------------------------------------
// Ordnance packages
// ---------------------------------------------------------------------------

/** One-off crates of consumables the draft can hand over.
 *
 *  Consumables are BOUGHT, every round, with cash — that stays true and is the
 *  point: an ability that refilled itself for free is a question about timing
 *  and never about cost. These are not a replacement for that. They exist so a
 *  draft that has nothing else useful left to offer — every module capped,
 *  every relevant upgrade taken — still offers something real instead of a card
 *  the player resents. Deliberately the weakest category.
 *
 *  Each pack declares what it tops up. `needs` keeps a pack off the table until
 *  the run can actually use it: drone munitions are worthless without a
 *  launcher, self-defense rounds without the module. */
export interface OrdnancePackDef {
  id: string;
  name: string;
  desc: string;
  /** Stock fields this pack adds to, by amount. */
  grant: Partial<Record<'ammo' | 'droneAmmo' | 'pdAmmo' | 'warthogStock' | 'scanStock', number>>;
  /** Capability the run must already hold for the pack to be worth offering. */
  needs?: 'mcmDroneLauncher' | 'selfDefenseModule';
}

/** Every pack is a MIXED package — several munitions, never one.
 *
 *  They used to be single top-ups ("24 interceptor rounds", "two canisters"),
 *  and a hand-played ten-round log declined every ordnance card it was ever
 *  offered: against a technology upgrade or a piece of equipment, one line of
 *  ammunition is not a decision, it is a consolation. A package that resupplies
 *  a WAY OF FIGHTING — the air plan, the minesweeping plan, the magazines —
 *  can at least be weighed against the alternatives.
 *
 *  Only droneAmmo and pdAmmo need a `needs` gate; the other stocks are
 *  usable from round one (the convoy's own assets are in hand from the start),
 *  so any pack may carry them without risking dead value. */
export const ORDNANCE_PACKS: Record<string, OrdnancePackDef> = {
  magazines: {
    id: 'magazines',
    name: 'Magazine Resupply',
    desc: 'A pallet of 20 interceptor rounds.',
    grant: { ammo: 20 },
  },
  airSupport: {
    id: 'airSupport',
    name: 'Air Support Package',
    desc: 'Two A-10 sorties fuelled on the apron, and two survey pulses to find them work.',
    grant: { warthogStock: 2, scanStock: 2 },
  },
  survey: {
    id: 'survey',
    name: 'Survey Package',
    desc: 'Three scan pulses in stowage, with ten interceptor rounds to answer what they find.',
    grant: { scanStock: 3, ammo: 10 },
  },
  counterMine: {
    id: 'counterMine',
    name: 'Counter-Mine Package',
    desc: 'Six drone munitions, two survey pulses to chart the field, and six interceptor rounds.',
    grant: { droneAmmo: 6, scanStock: 2, ammo: 6 },
    needs: 'mcmDroneLauncher',
  },
  closeIn: {
    id: 'closeIn',
    name: 'Close-In Package',
    desc: 'Nine self-defense rounds for the cargo mounts, and twelve interceptor rounds behind them.',
    grant: { pdAmmo: 9, ammo: 12 },
    needs: 'selfDefenseModule',
  },
};

/** Shore-base loadout slots. Base missile interceptors are built in. */
export const BASE_MODULE_SLOTS = 1;

export const BASE_MODULES: Record<BaseModuleId, BaseModuleDef> = {
  counterBattery: {
    id: 'counterBattery',
    name: 'Counter-Battery System',
    desc: 'Suppresses — and with focus, destroys — identified artillery positions.',
    cost: 300,
  },
};

// Formation is chosen once in the prep screen and holds for the whole transit.
// It sets how much lateral room ships keep (lateralSpread + separation bonus),
// their pace, and how far a blast/minefield spreads.
export const FORMATIONS: Record<FormationId, FormationDef> = {
  tight: {
    id: 'tight',
    name: 'Tight',
    desc: 'Overlapping fire: accurate and long-reached — but hits chain into neighbors.',
    speedMult: 0.95,
    lateralSpread: 18,
    gapBonus: 0,
    collateralMult: 1.15,
    interceptAccuracy: 0.08,
    defenseRangeMult: 1.3,
    chainSplashRadius: 55,
  },
  wide: {
    id: 'wide',
    name: 'Wide',
    desc: 'Sea room: hits stay isolated — but defenses stretch thin.',
    speedMult: 1.0,
    lateralSpread: 42,
    gapBonus: 34,
    collateralMult: 0.35,
    interceptAccuracy: -0.07,
    defenseRangeMult: 0.78,
    chainSplashRadius: 0,
  },
  sprint: {
    id: 'sprint',
    name: 'Sprint',
    desc: 'Fastest through the strait; middling coverage, a little chaining.',
    speedMult: 1.22,
    lateralSpread: 12,
    gapBonus: 0,
    collateralMult: 0.65,
    interceptAccuracy: -0.03,
    defenseRangeMult: 0.9,
    chainSplashRadius: 24,
  },
};

/** Flavor names for cargo ships, used in after-action narratives. */
export const SHIP_NAMES: readonly string[] = [
  'MV Blue Horizon', 'MV Meridian', 'MV Cape Verity', 'MV Iron Gull', 'MV Santa Rosa',
  'MV Pacific Dawn', 'MV Kestrel', 'MV Golden Bay', 'MV Anthea', 'MV Coral Runner',
  'MV Northwind', 'MV Halcyon', 'MV Sable Star', 'MV Trident Bay', 'MV Evening Tide',
  'MV Argent Wave', 'MV Bright Passage', 'MV Cormorant', 'MV Delta Queen', 'MV Emerald Coast',
  'MV Far Rider', 'MV Grey Pilgrim', 'MV Harbor Light', 'MV Ivory Gate', 'MV Jade Current',
  'MV Long Reach', 'MV Midnight Sun', 'MV New Meridian', 'MV Open Water', 'MV Pelican',
  'MV Quiet Fortune', 'MV Red Anchor', 'MV Silver Strand', 'MV Tall Cloud', 'MV Umber Sky',
  'MV Vigilant', 'MV White Caravel', 'MV Wandering Star', 'MV Zephyr', 'MV Last Ledger',
  'MV Morning Watch', 'MV Salt Meadow', 'MV True North', 'MV Windward', 'MV Yellow Sea',
];
