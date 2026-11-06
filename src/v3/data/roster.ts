// THE ROSTER (the weapons plan, docs/design/v3-weapons-plan.md): one line per
// weapon saying what kind it is, from which chapter the campaign's draft can
// deal it, and whether it is live or a prototype. The player: "I might cut
// some or add more in the future, so keep it moddable." Adding, cutting or
// moving a weapon is one line here (plus its text in abilities.ts and its
// code in sim/game.ts); the draft, Free Play and the cards read this.

import { ABILITY_ORDER, type AbilityId } from './abilities';

/** Active: takes over the gun. Passive: the gun stays plain while it works
 *  on its own. Boost: never replaces the loaded weapon (phase 3). */
export type WeaponCategory = 'active' | 'passive' | 'boost';

/** Live: in the campaign's draft from its chapter on. Prototype: Free Play
 *  only (marked so) until the player locks it in. */
export type RosterStatus = 'live' | 'prototype';

/** What a press does while the weapon is loaded (the chip says so). None:
 *  holding repeats the shot, as for every weapon before the plan. */
export type Gesture = 'charge' | 'swipe' | 'drag';

export interface RosterEntry {
  cat: WeaponCategory;
  /** The campaign chapter (1–4) from which the draft can deal it. */
  unlock: number;
  status: RosterStatus;
  gesture?: Gesture;
}

export const ROSTER: Record<AbilityId, RosterEntry> = {
  airstrike: { cat: 'active', unlock: 1, status: 'live' },
  shrapnel: { cat: 'active', unlock: 1, status: 'live' },
  frigate: { cat: 'passive', unlock: 1, status: 'live' },
  thermo: { cat: 'active', unlock: 1, status: 'live' },
  scatter: { cat: 'active', unlock: 1, status: 'live' },
  boomerang: { cat: 'active', unlock: 1, status: 'live' },
  flak: { cat: 'active', unlock: 1, status: 'live' },
  seeker: { cat: 'active', unlock: 1, status: 'live' },
  aegis: { cat: 'passive', unlock: 1, status: 'live' },
  well: { cat: 'active', unlock: 1, status: 'live' },
  railgun: { cat: 'active', unlock: 1, status: 'live' },
  tesla: { cat: 'active', unlock: 1, status: 'live' },
  // Phase 1 (prototypes). Proposed unlocks, a few per chapter.
  cutter: { cat: 'active', unlock: 1, status: 'prototype', gesture: 'swipe' },
  lance: { cat: 'active', unlock: 2, status: 'prototype', gesture: 'charge' },
  chainshot: { cat: 'active', unlock: 2, status: 'prototype' },
  firecontrol: { cat: 'active', unlock: 3, status: 'prototype' },
  grapnel: { cat: 'active', unlock: 3, status: 'prototype', gesture: 'drag' },
  cadence: { cat: 'active', unlock: 4, status: 'prototype' },
  // Phase 2: the passives (proposed unlocks).
  droneScreen: { cat: 'passive', unlock: 1, status: 'prototype' },
  gunships: { cat: 'passive', unlock: 2, status: 'prototype' },
  bomberWing: { cat: 'passive', unlock: 3, status: 'prototype' },
  orbital: { cat: 'passive', unlock: 4, status: 'prototype' },
  // Phase 3: the boosts (proposed unlocks). The last four were power-ups;
  // while they are prototypes the campaign keeps their power-up drops.
  fireAtWill: { cat: 'boost', unlock: 1, status: 'prototype' },
  supplyRun: { cat: 'boost', unlock: 1, status: 'prototype' },
  overclock: { cat: 'boost', unlock: 2, status: 'prototype' },
  hotStreak: { cat: 'boost', unlock: 2, status: 'prototype' },
  dualWield: { cat: 'boost', unlock: 3, status: 'prototype' },
  focus: { cat: 'boost', unlock: 3, status: 'prototype' },
  wildCard: { cat: 'boost', unlock: 4, status: 'prototype' },
  overdrive: { cat: 'boost', unlock: 1, status: 'prototype' },
  timeWarp: { cat: 'boost', unlock: 1, status: 'prototype' },
  shield: { cat: 'boost', unlock: 2, status: 'prototype' },
  fullSteam: { cat: 'boost', unlock: 2, status: 'prototype' },
  // Phase 4: the experiments (the player's maybes: kept only if they play well).
  tidal: { cat: 'active', unlock: 3, status: 'prototype' },
  storm: { cat: 'passive', unlock: 4, status: 'prototype' },
  ammoShip: { cat: 'passive', unlock: 2, status: 'prototype' },
};

/** Is this a boost (never replaces the loaded weapon)? */
export function isBoost(id: AbilityId | undefined | null): boolean {
  return !!id && ROSTER[id].cat === 'boost';
}

/** The weapons the campaign's draft can deal on a map of this chapter. */
export function draftPool(chapter: number): AbilityId[] {
  return ABILITY_ORDER.filter((id) => ROSTER[id].status === 'live' && ROSTER[id].unlock <= chapter);
}

/** Free Play can pick any weapon, prototypes included. */
export function freePlayPool(): AbilityId[] {
  return [...ABILITY_ORDER];
}

export function isPrototype(id: AbilityId): boolean {
  return ROSTER[id].status === 'prototype';
}

/** What holding does with this weapon loaded (undefined: repeats the shot). */
export function gestureOf(id: AbilityId | undefined | null): Gesture | undefined {
  return id ? ROSTER[id].gesture : undefined;
}

/** The chip's hint for a gesture weapon. */
export const GESTURE_HINT: Record<Gesture, string> = {
  charge: 'HOLD: CHARGE',
  swipe: 'SWIPE: CUT',
  drag: 'HOLD: DRAG',
};
