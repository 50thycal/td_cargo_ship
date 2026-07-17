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

export const MODULES: Record<ModuleId, ModuleDef> = {
  pointDefense: {
    id: 'pointDefense',
    name: 'Point-Defense Turret',
    desc: 'A last-ditch close-in turret that automatically engages one nearby missile per transit. Draws from your shared stock of point-defense rounds (bought in prep) — no rounds, no defense.',
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
    desc: 'Reveals standard mines around this ship so the convoy can steer clear of them.',
    costPerShip: 95,
  },
  fireSuppression: {
    id: 'fireSuppression',
    name: 'Fire-Suppression System',
    desc: 'Missile hits can no longer set this ship ablaze.',
    costPerShip: 55,
  },
};

// Formation is chosen once in the prep screen and holds for the whole transit.
// It sets how much lateral room ships keep (lateralSpread + separation bonus),
// their pace, and how far a blast/minefield spreads.
export const FORMATIONS: Record<FormationId, FormationDef> = {
  tight: {
    id: 'tight',
    name: 'Tight',
    desc: 'A concentrated column: overlapping fire makes your interceptors more accurate (+8%) and extends point-defense and escort reach (×1.3). The price — a direct hit or a mine chains blast damage into the ships packed alongside.',
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
    desc: 'Battery interceptors fly 50% faster and escort interceptors 10% faster; every interceptor hits 10% more often.',
    cost: 40,
  },
  intercept2: {
    id: 'intercept2',
    branch: 'interception',
    name: 'Dual-Launch Cells',
    desc: 'Escort launchers reload twice as fast, and battery interceptors gain another 20% speed.',
    cost: 70,
    requires: 'intercept1',
  },
  mines1: {
    id: 'mines1',
    branch: 'mineWarfare',
    name: 'Minesweeping Drones',
    desc: 'Fields autonomous drones, launched from your escorts, that fly out and detonate charted (revealed) mines before ships reach them. Each sortie expends a drone munition bought in Preparation.',
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
    desc: 'ECM aircraft jam guided seekers far more effectively (guided hit chance 8% inside the jamming orbit).',
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
