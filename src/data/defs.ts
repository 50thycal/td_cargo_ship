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
    replaceCost: 80,
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
    replaceCost: 160,
    explodes: { damage: 50, radius: 90 },
  },
  freighter: {
    id: 'freighter',
    name: 'Fast Freighter',
    hp: 70,
    speed: 34,
    value: 8,
    slots: 1,
    replaceCost: 70,
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
    desc: 'Last-ditch automatic close-in defense: one tracer shot per equipped ship per round at a missile entering its short envelope. Draws from the shared stock of self-defense rounds bought in prep — no rounds, no defense.',
    costPerShip: 110,
  },
  missileWarning: {
    id: 'missileWarning',
    name: 'Missile-Warning Receiver',
    desc: 'Detects and marks missiles homing on this ship and assists the interceptors defending it. Detection only — it does not shoot.',
    costPerShip: 45,
  },
  reinforcedHull: {
    id: 'reinforcedHull',
    name: 'Reinforced Hull',
    desc: 'Bonus max hull points (rises with Reinforced Hull research). Generic survivability — never a substitute for the threat’s active counter.',
    costPerShip: 75,
  },
  mineSonar: {
    id: 'mineSonar',
    name: 'Mine-Detection Sonar',
    desc: 'Reveals mines around this ship so the convoy can steer clear. Detection only — clearing needs escort minesweeper drones.',
    costPerShip: 95,
  },
  fireSuppression: {
    id: 'fireSuppression',
    name: 'Fire-Suppression System',
    desc: 'Counters the fire (damage-over-time) that missile hits start on this ship. Research upgrades extinguish faster, up to full immunity.',
    costPerShip: 55,
  },
  hydrophone: {
    id: 'hydrophone',
    name: 'Hydrophone',
    desc: 'Listens for torpedoes in the underwater domain and shows their bearing. Detection only — destroying them is the depth-charge launcher’s job.',
    costPerShip: 85,
  },
  thermalImaging: {
    id: 'thermalImaging',
    name: 'Thermal/Radar Imaging',
    desc: 'Sees precise threat tracks through enemy screening smoke. It removes nothing and destroys nothing — it gives your defenses their eyes back.',
    costPerShip: 90,
  },
  flak: {
    id: 'flak',
    name: 'Anti-Air Flak Mount',
    desc: 'Automatically engages enemy recon planes (and, with proximity fuses, ship-disabling drones) entering its arc. Separate equipment from the missile self-defense interceptor — it cannot engage missiles.',
    costPerShip: 100,
  },
  antiBoarding: {
    id: 'antiBoarding',
    name: 'Anti-Boarding Countermeasures',
    desc: 'Slows and can reject the Boarding Boat capture mechanic on this ship. No effect on missiles, mines, torpedoes, artillery or ordinary hull damage.',
    costPerShip: 60,
  },
  compartmentalization: {
    id: 'compartmentalization',
    name: 'Compartmentalization',
    desc: 'Reduces the damage this ship takes after a hit lands (reduction tier from research). Never interferes with detection or interception.',
    costPerShip: 70,
  },
};

/** Escort loadout slots. Missile interceptors are built into every escort;
 *  these optional systems compete for the loadout's limited slots — no escort
 *  carries every weapon. */
export const ESCORT_MODULE_SLOTS = 2;

export const ESCORT_MODULES: Record<EscortModuleId, EscortModuleDef> = {
  deckGun: {
    id: 'deckGun',
    name: 'Deck Gun / Autocannon',
    desc: 'Sustained-fire gun for attack boats — persistent HP targets the missile interceptor cannot touch. Commits to a selected boat until it sinks or leaves range.',
    cost: 260,
  },
  mcmDroneLauncher: {
    id: 'mcmDroneLauncher',
    name: 'Mine-Countermeasure Drone Launcher',
    desc: 'Launches minesweeper drones at REVEALED mines (tap a charted mine). Each sortie expends a purchased drone munition. Detection stays separate — no drone flies at an uncharted mine.',
    cost: 200,
  },
  depthCharges: {
    id: 'depthCharges',
    name: 'Depth-Charge Launcher',
    desc: 'Lobbed area weapon against torpedoes: tap a point in the water and the blast destroys torpedoes inside it. Completely separate from missile interceptors — it cannot engage anything airborne.',
    cost: 240,
  },
};

/** Shore-base loadout slots. Base missile interceptors are built in. */
export const BASE_MODULE_SLOTS = 1;

export const BASE_MODULES: Record<BaseModuleId, BaseModuleDef> = {
  counterBattery: {
    id: 'counterBattery',
    name: 'Counter-Battery System',
    desc: 'Fires at identified hostile ARTILLERY POSITIONS to suppress (and with focus, destroy) them. It never engages shells in flight, ships, or any mobile unit.',
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
    desc: 'A concentrated column: overlapping fire makes your interceptors more accurate (+8%) and extends self-defense and escort reach (×1.3). The price — a direct hit or a mine chains blast damage into the ships packed alongside.',
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
    desc: 'Generous sea room: a hit or a mine almost never claims more than the one ship, and there is no blast chaining. But dispersed hulls stretch your defenses — interceptors are less accurate (−7%) and cover less water (×0.78).',
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
    desc: 'A fast, narrow column that clears the strait quickest. Coverage sits between Tight and Wide (−3% accuracy, ×0.9 reach) and a direct hit chains a little into the line.',
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
