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
  // The weapons plan's picks, locked in by the player on 2026-11-07 (the
  // review page's lock-in round: tools/v3/weapon-ideas/lockin-marks-2026-11-07.json).
  // Each joins the campaign's draft in the chapter the player marked, so
  // every new chapter brings new weapons.
  // Chapter 1, Home Waters.
  cutter: { cat: 'active', unlock: 1, status: 'live', gesture: 'swipe' },
  droneScreen: { cat: 'passive', unlock: 1, status: 'live' },
  supplyRun: { cat: 'boost', unlock: 1, status: 'live' },
  overdrive: { cat: 'boost', unlock: 1, status: 'live' },
  timeWarp: { cat: 'boost', unlock: 1, status: 'live' },
  // Chapter 2, The Narrows.
  lance: { cat: 'active', unlock: 2, status: 'live', gesture: 'charge' },
  gunships: { cat: 'passive', unlock: 2, status: 'live' },
  overclock: { cat: 'boost', unlock: 2, status: 'live' },
  shield: { cat: 'boost', unlock: 2, status: 'live' },
  fullSteam: { cat: 'boost', unlock: 2, status: 'live' },
  // Chapter 3, Dark Water.
  grapnel: { cat: 'active', unlock: 3, status: 'live', gesture: 'drag' },
  bomberWing: { cat: 'passive', unlock: 3, status: 'live' },
  orbital: { cat: 'passive', unlock: 3, status: 'live' },
  dualWield: { cat: 'boost', unlock: 3, status: 'live' },
  focus: { cat: 'boost', unlock: 3, status: 'live' },
  // Chapter 4, Open War.
  cadence: { cat: 'active', unlock: 4, status: 'live' },
  wildCard: { cat: 'boost', unlock: 4, status: 'live' },
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
