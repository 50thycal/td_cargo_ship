// Commander Abilities — the permanent progression layer's equippable options.
//
// Abilities are unlocked with Commander XP (earned across runs, kept in the
// CommanderProfile) and equipped into a limited pre-run loadout: at most
// COMMANDER.abilitySlots abilities totalling at most COMMANDER.loadoutPoints
// points. They provide BOUNDED strategic advantages — the design forbids
// unbounded permanent power growth, and the slot/point caps are what enforce
// that structurally.
//
// Effects are applied CENTRALLY, after technology and equipment effects are
// derived (applyCommanderCombatEffects below, called from the sim's single
// effects-derivation point) and in the campaign economy helpers — never
// scattered through simulation code. Every value is PROVISIONAL.

import type { CombatEffects } from '../sim/types';

export interface CommanderEffectMods {
  /** Added to escort AND shore-battery interceptor accuracy (fraction). */
  interceptAccuracy?: number;
  /** Multiplies wreckage recovery rate. */
  wreckageRate?: number;
  /** Multiplies survivor rescue rate. */
  rescueRate?: number;
  /** Extra cash at run start. */
  startCash?: number;
  /** Multiplies fleet repair cost. */
  repairCost?: number;
  /** Multiplies interceptor ammunition price. */
  ammoCost?: number;
}

export interface CommanderAbilityDef {
  id: string;
  name: string;
  desc: string;
  /** Loadout points this ability consumes. */
  points: number;
  /** Commander XP to unlock (0 = held from the first commission). */
  xpCost: number;
  mods: CommanderEffectMods;
}

export const COMMANDER_ABILITIES: Record<string, CommanderAbilityDef> = {
  salvageTeams: {
    id: 'salvageTeams',
    name: 'Salvage Teams',
    desc: 'Dedicated recovery crews aboard every escort: wreckage fields are worked 35% faster.',
    points: 8,
    xpCost: 0,
    mods: { wreckageRate: 1.35 },
  },
  rescueDoctrine: {
    id: 'rescueDoctrine',
    name: 'Rescue Doctrine',
    desc: 'Drilled crew-recovery procedures: survivors are brought aboard 40% faster.',
    points: 6,
    xpCost: 0,
    mods: { rescueRate: 1.4 },
  },
  warChest: {
    id: 'warChest',
    name: 'War Chest',
    desc: 'Pre-arranged consortium credit: begin every regional run with an extra $150.',
    points: 10,
    xpCost: 40,
    mods: { startCash: 150 },
  },
  shipwright: {
    id: 'shipwright',
    name: 'Shipwright Contacts',
    desc: 'Friendly yards bill at cost: fleet repairs are 30% cheaper.',
    points: 8,
    xpCost: 40,
    mods: { repairCost: 0.7 },
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Quartermaster Corps',
    desc: 'Bulk munitions contracts: interceptor ammunition costs 20% less.',
    points: 6,
    xpCost: 30,
    mods: { ammoCost: 0.8 },
  },
  steadyHands: {
    id: 'steadyHands',
    name: 'Steady Hands',
    desc: 'Veteran fire-control teams: every interceptor launcher gains +5% accuracy.',
    points: 12,
    xpCost: 60,
    mods: { interceptAccuracy: 0.05 },
  },
};

/** Display / selection order for the loadout screen. */
export const COMMANDER_ABILITY_ORDER: string[] = [
  'salvageTeams',
  'rescueDoctrine',
  'warChest',
  'shipwright',
  'quartermaster',
  'steadyHands',
];

/** Aggregate the equipped abilities' modifiers into one resolved set.
 *  Multipliers compose multiplicatively, bonuses additively; unknown ids are
 *  ignored (a save carrying a retired ability id keeps working). */
export function foldCommanderMods(ids: readonly string[]): Required<CommanderEffectMods> {
  const folded: Required<CommanderEffectMods> = {
    interceptAccuracy: 0,
    wreckageRate: 1,
    rescueRate: 1,
    startCash: 0,
    repairCost: 1,
    ammoCost: 1,
  };
  for (const id of ids) {
    const mods = COMMANDER_ABILITIES[id]?.mods;
    if (!mods) continue;
    folded.interceptAccuracy += mods.interceptAccuracy ?? 0;
    folded.wreckageRate *= mods.wreckageRate ?? 1;
    folded.rescueRate *= mods.rescueRate ?? 1;
    folded.startCash += mods.startCash ?? 0;
    folded.repairCost *= mods.repairCost ?? 1;
    folded.ammoCost *= mods.ammoCost ?? 1;
  }
  return folded;
}

/** THE central combat-effect application point for Commander Abilities.
 *
 *  Runs after deriveCounterEffects has already resolved base platform values,
 *  technology tiers and equipment gating — the effect flow the design locks
 *  in: base → technology/tactics → equipment → commander → final numbers.
 *  Mutates and returns `effects` (a per-transit object, never shared). */
export function applyCommanderCombatEffects(
  effects: CombatEffects,
  ids: readonly string[],
): CombatEffects {
  const mods = foldCommanderMods(ids);
  effects.escort.accuracy += mods.interceptAccuracy;
  effects.base.accuracy += mods.interceptAccuracy;
  effects.recovery.wreckageRateMult *= mods.wreckageRate;
  effects.recovery.rescueRateMult *= mods.rescueRate;
  return effects;
}

/** Total loadout points a set of abilities consumes. */
export function loadoutPointsUsed(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + (COMMANDER_ABILITIES[id]?.points ?? 0), 0);
}
