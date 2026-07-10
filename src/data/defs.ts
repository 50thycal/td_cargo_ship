// Static definitions: ship classes, modules, formations, research tree.
// All content additions (new ships, modules, research) happen here.

import type {
  FormationDef,
  FormationId,
  ModuleDef,
  ModuleId,
  ResearchDef,
  ResearchId,
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
  },
};

export const MODULES: Record<ModuleId, ModuleDef> = {
  pointDefense: {
    id: 'pointDefense',
    name: 'Point-Defense Turret',
    desc: 'Automatically engages missiles that come close. In tight formation its arc also covers neighbors.',
    costPerShip: 110,
  },
  missileWarning: {
    id: 'missileWarning',
    name: 'Missile-Warning Receiver',
    desc: 'Marks missiles homing on this ship and improves interceptor accuracy defending it (+10%).',
    costPerShip: 45,
  },
  reinforcedHull: {
    id: 'reinforcedHull',
    name: 'Reinforced Hull',
    desc: '+50 max hull points.',
    costPerShip: 75,
  },
  mineSonar: {
    id: 'mineSonar',
    name: 'Mine-Detection Sonar',
    desc: 'Reveals standard mines ahead of this ship so the convoy can steer around them.',
    costPerShip: 95,
  },
  fireSuppression: {
    id: 'fireSuppression',
    name: 'Fire-Suppression System',
    desc: 'Missile hits can no longer set this ship ablaze.',
    costPerShip: 55,
  },
};

export const FORMATIONS: Record<FormationId, FormationDef> = {
  tight: {
    id: 'tight',
    name: 'Tight',
    desc: 'Dense box. Point-defense arcs overlap, but blasts and tanker explosions hit neighbors, and mines are harder to dodge.',
    speedMult: 0.95,
    spacingX: 46,
    spacingY: 40,
    rows: 4,
    collateralMult: 1.0,
    mineAvoidChance: 0.8,
  },
  wide: {
    id: 'wide',
    name: 'Wide',
    desc: 'Dispersed screen. Splash damage and mines rarely claim more than one ship, but defenses cover less of the convoy.',
    speedMult: 1.0,
    spacingX: 85,
    spacingY: 72,
    rows: 4,
    collateralMult: 0.35,
    mineAvoidChance: 0.95,
  },
  sprint: {
    id: 'sprint',
    name: 'Sprint Column',
    desc: 'Twin fast columns. The convoy moves quickest, but the long line stretches escort coverage thin.',
    speedMult: 1.22,
    spacingX: 42,
    spacingY: 56,
    rows: 2,
    collateralMult: 0.6,
    mineAvoidChance: 0.88,
  },
};

export const RESEARCH: Record<ResearchId, ResearchDef> = {
  sensors1: {
    id: 'sensors1',
    branch: 'sensors',
    name: 'Early-Warning Network',
    desc: 'Threat tracks appear with target-vector lines and interceptors gain +5% accuracy.',
    cost: 40,
  },
  sensors2: {
    id: 'sensors2',
    branch: 'sensors',
    name: 'Advanced Sonar Suite',
    desc: 'Every ship gains basic mine detection; sonar-equipped ships detect at nearly double range.',
    cost: 65,
    requires: 'sensors1',
  },
  sensors3: {
    id: 'sensors3',
    branch: 'sensors',
    name: 'Composite-Signature Analysis',
    desc: 'Detection systems can identify low-signature mines.',
    cost: 90,
    requires: 'sensors2',
  },
  intercept1: {
    id: 'intercept1',
    branch: 'interception',
    name: 'Improved Interceptors',
    desc: 'Interceptors fly 30% faster and hit 10% more often.',
    cost: 40,
  },
  intercept2: {
    id: 'intercept2',
    branch: 'interception',
    name: 'Dual-Launch Cells',
    desc: 'Escort launchers reload twice as fast.',
    cost: 70,
    requires: 'intercept1',
  },
  mines1: {
    id: 'mines1',
    branch: 'mineWarfare',
    name: 'Minesweeping Drones',
    desc: 'The scan pulse also neutralizes revealed mines near the convoy.',
    cost: 55,
  },
  resilience1: {
    id: 'resilience1',
    branch: 'resilience',
    name: 'Compartmentalization',
    desc: 'All ships take 25% less damage.',
    cost: 50,
  },
  resilience2: {
    id: 'resilience2',
    branch: 'resilience',
    name: 'Damage-Control Teams',
    desc: 'Fires are extinguished almost immediately on every ship.',
    cost: 60,
    requires: 'resilience1',
  },
  ew1: {
    id: 'ew1',
    branch: 'electronicWarfare',
    name: 'Barrage Jamming',
    desc: 'ECM bursts scramble guided seekers far more effectively (guided hit chance 8% while active).',
    cost: 55,
  },
  logistics1: {
    id: 'logistics1',
    branch: 'logistics',
    name: 'Expanded Berthing',
    desc: 'Convoy capacity +5 immediately and hull repairs cost half as much.',
    cost: 70,
  },
};

export const RESEARCH_BRANCH_NAMES: Record<string, string> = {
  sensors: 'Sensors & Intelligence',
  interception: 'Missile Interception',
  mineWarfare: 'Mine Warfare',
  resilience: 'Ship Resilience',
  electronicWarfare: 'Electronic Warfare',
  logistics: 'Logistics',
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
