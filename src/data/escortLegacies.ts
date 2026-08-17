// Escort Legacies — the permanent progression layer for the FLOTILLA.
//
// The sibling of Commander Abilities (commanderAbilities.ts), and deliberately
// built the same way: unlocked with Commander XP, equipped into a bounded
// pre-run loadout, folded centrally into the effects. What makes them a
// different thing is where they LIVE.
//
// A commander ability belongs to the commander, so it is simply on for the
// whole run. A legacy belongs to a SHIP. Each one is carried by a particular
// escort — assigned when that escort is commissioned — and when she goes down
// the legacy goes down with her for the rest of the region. Buying a
// replacement hull does not buy the legacy back; that veteran crew and their
// standing are gone until the next run.
//
// This is what escort losses cost now. They used to destroy the ship's fitted
// MODULES, which was a far worse trade than it looked: modules arrive through
// the draft, so an unlucky mine could delete a branch the player had spent
// three rounds building toward, with no decision anywhere in it. A legacy is a
// thing the player chose before the run, knows the value of, and can weigh
// against the risk of sending that escort into the gunline.
//
// Every value here is PROVISIONAL.

import type { CombatEffects } from '../sim/types';

export interface EscortLegacyMods {
  /** Added to escort interceptor accuracy (fraction). */
  escortAccuracy?: number;
  /** Multiplies escort interceptor reload time (below 1 = faster). */
  escortReload?: number;
  /** Multiplies damage escorts take from MINES specifically. */
  escortMineDamage?: number;
  /** Multiplies damage escorts take from everything. */
  escortDamage?: number;
  /** Multiplies escort transit speed. */
  escortSpeed?: number;
  /** Multiplies wreckage recovery and crew rescue rates. */
  recoveryRate?: number;
  /** Escort-module units granted free at the start of a regional run. */
  freeModulePicks?: number;
  /** Multiplies the price of commissioning an escort. */
  escortCost?: number;
}

export interface EscortLegacyDef {
  id: string;
  name: string;
  desc: string;
  /** Loadout points this legacy consumes. */
  points: number;
  /** Commander XP to unlock (0 = held from the first commission). */
  xpCost: number;
  mods: EscortLegacyMods;
}

export const ESCORT_LEGACIES: Record<string, EscortLegacyDef> = {
  gunneryDrill: {
    id: 'gunneryDrill',
    name: 'Gunnery Drill',
    desc: 'A crew that has done this before. Every escort launcher in the flotilla gains +7% accuracy while this ship swims.',
    points: 8,
    xpCost: 0,
    mods: { escortAccuracy: 0.07 },
  },
  minePlating: {
    id: 'minePlating',
    name: 'Mine Plating',
    desc: 'Belt armour and shock mounting below the waterline: escorts take 45% less damage from mines.',
    points: 8,
    xpCost: 0,
    mods: { escortMineDamage: 0.55 },
  },
  damageControl: {
    id: 'damageControl',
    name: 'Damage-Control Party',
    desc: 'Standing repair teams closed up at action stations: escorts take 20% less damage from everything.',
    points: 10,
    xpCost: 30,
    mods: { escortDamage: 0.8 },
  },
  rapidRearm: {
    id: 'rapidRearm',
    name: 'Rapid Rearm',
    desc: 'Drilled magazine crews: escort launchers reload 20% faster.',
    points: 8,
    xpCost: 30,
    mods: { escortReload: 0.8 },
  },
  requisitionOrder: {
    id: 'requisitionOrder',
    name: 'Requisition Order',
    desc: 'A favour owed at the naval yard: a deck gun already in the locker at the start of every region, waiting to be fitted.',
    points: 10,
    xpCost: 40,
    mods: { freeModulePicks: 1 },
  },
  veteranHelm: {
    id: 'veteranHelm',
    name: 'Veteran Helm',
    desc: 'Hands that know the ship: escorts make 18% more speed answering an order.',
    points: 6,
    xpCost: 40,
    mods: { escortSpeed: 1.18 },
  },
  rescueRig: {
    id: 'rescueRig',
    name: 'Rescue Rig',
    desc: 'Scrambling nets, davits and a working deck: wreckage and crews in the water are worked 30% faster.',
    points: 8,
    xpCost: 50,
    mods: { recoveryRate: 1.3 },
  },
  standingContract: {
    id: 'standingContract',
    name: 'Standing Contract',
    desc: 'A yard that keeps a hull on the slip for you: commissioning an escort costs 25% less.',
    points: 6,
    xpCost: 60,
    mods: { escortCost: 0.75 },
  },
};

/** Display / selection order for the loadout screen. */
export const ESCORT_LEGACY_ORDER: string[] = [
  'gunneryDrill',
  'minePlating',
  'damageControl',
  'rapidRearm',
  'requisitionOrder',
  'veteranHelm',
  'rescueRig',
  'standingContract',
];

/** Aggregate a set of ACTIVE legacies into one resolved modifier set.
 *  Multipliers compose multiplicatively, bonuses additively; unknown ids are
 *  ignored so a save carrying a retired legacy keeps working. */
export function foldEscortLegacies(ids: readonly string[]): Required<EscortLegacyMods> {
  const folded: Required<EscortLegacyMods> = {
    escortAccuracy: 0,
    escortReload: 1,
    escortMineDamage: 1,
    escortDamage: 1,
    escortSpeed: 1,
    recoveryRate: 1,
    freeModulePicks: 0,
    escortCost: 1,
  };
  for (const id of ids) {
    const mods = ESCORT_LEGACIES[id]?.mods;
    if (!mods) continue;
    folded.escortAccuracy += mods.escortAccuracy ?? 0;
    folded.escortReload *= mods.escortReload ?? 1;
    folded.escortMineDamage *= mods.escortMineDamage ?? 1;
    folded.escortDamage *= mods.escortDamage ?? 1;
    folded.escortSpeed *= mods.escortSpeed ?? 1;
    folded.recoveryRate *= mods.recoveryRate ?? 1;
    folded.freeModulePicks += mods.freeModulePicks ?? 0;
    folded.escortCost *= mods.escortCost ?? 1;
  }
  return folded;
}

/** THE central combat-effect application point for escort legacies.
 *
 *  Runs alongside applyCommanderCombatEffects, at the same place in the flow:
 *  base → technology/tactics → equipment → commander & legacies → final. Takes
 *  the ACTIVE ids — the ones whose escort is still afloat — so a legacy stops
 *  applying the moment its ship is lost, without any other code having to know
 *  that legacies exist. Mutates and returns `effects`. */
export function applyEscortLegacyEffects(
  effects: CombatEffects,
  activeIds: readonly string[],
): CombatEffects {
  const mods = foldEscortLegacies(activeIds);
  effects.escort.accuracy += mods.escortAccuracy;
  effects.escort.reload *= mods.escortReload;
  effects.escortDamageMult *= mods.escortDamage;
  effects.escortMineDamageMult *= mods.escortMineDamage;
  effects.escortSpeedMult *= mods.escortSpeed;
  effects.recovery.wreckageRateMult *= mods.recoveryRate;
  effects.recovery.rescueRateMult *= mods.recoveryRate;
  return effects;
}

/** The legacies actually in force: the ones carried by escorts still afloat.
 *  A legacy whose ship has gone down is simply absent from the list — that
 *  absence IS the "lose the ship, lose the ability" rule, and it is why no
 *  other system needs a concept of a lapsed legacy. Unknown ids are dropped so
 *  a save carrying a retired legacy still loads. */
export function activeLegacyIds(units: readonly { legacy?: string }[]): string[] {
  return units
    .map((u) => u.legacy)
    .filter((id): id is string => typeof id === 'string' && ESCORT_LEGACIES[id] !== undefined);
}

/** Total loadout points a set of legacies consumes. */
export function legacyPointsUsed(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (ESCORT_LEGACIES[id]?.points ?? 0), 0);
}
