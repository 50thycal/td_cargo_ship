// What an escort is DOING, derived from transit state.
//
// The escort flotilla is the player's primary tactical instrument, and the
// commonest confusion with it is not "how do I move this ship" but "why is
// that one sitting there". This module answers that question in one place, as
// pure data, so the HUD, the map labels and any future automation all read the
// same truth rather than each re-deriving it from positions and flags.
//
// Deliberately in the sim layer and DOM-free: an escort's activity is a fact
// about the simulation, not a rendering concern. Future behaviours (formation
// stations, patrol routes, standing orders) should extend EscortActivity and
// the derivation below rather than adding parallel state in the view.

import { SURVIVORS, WRECKAGE } from '../data/tuning';
import type { Escort, TransitState } from './types';

export type EscortActivity =
  | 'escorting'
  | 'recovering'
  | 'rescuing'
  | 'engaging'
  | 'moving'
  | 'holding'
  | 'lost';

export interface EscortStatus {
  activity: EscortActivity;
  /** Short label for the HUD ("Recovering Wreckage"). */
  label: string;
  /** 0-1 when the activity has meaningful progress (recovery/rescue), else null. */
  progress: number | null;
  /** Where it is headed, when it is under orders. */
  destination: { x: number; y: number } | null;
  /** True when the escort will stay put on arrival rather than rejoining. */
  holding: boolean;
}

export const ACTIVITY_LABELS: Record<EscortActivity, string> = {
  escorting: 'Escorting Convoy',
  recovering: 'Recovering Wreckage',
  rescuing: 'Rescuing Survivors',
  engaging: 'Engaging Enemy',
  moving: 'Moving',
  holding: 'Holding Position',
  lost: 'Lost',
};

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** The wreckage field this escort is currently working, if any. */
export function wreckageUnderEscort(t: TransitState, escort: Escort) {
  return t.wreckage.find(
    (f) => !f.recovered && !f.expired && dist(escort.x, escort.y, f.x, f.y) <= WRECKAGE.radius,
  );
}

/** The survivor area this escort is currently working, if any. */
export function survivorsUnderEscort(t: TransitState, escort: Escort) {
  return t.survivors.find(
    (a) => !a.rescued && !a.lost && dist(escort.x, escort.y, a.x, a.y) <= SURVIVORS.radius,
  );
}

/** What this escort is doing right now.
 *
 *  Order of precedence is the order the player cares about: the recovery jobs
 *  are what they diverted the ship FOR, so those outrank a gun engagement it
 *  is also incidentally in; combat outranks the mere fact of being under way;
 *  and "escorting" is the resting state rather than a special case. */
export function escortStatus(t: TransitState, escort: Escort): EscortStatus {
  const destination = escort.moveTarget
    ? { x: escort.moveTarget.x, y: escort.moveTarget.y }
    : null;
  const holding = escort.moveTarget?.hold ?? escort.stationed;

  if (!escort.alive) {
    return { activity: 'lost', label: ACTIVITY_LABELS.lost, progress: null, destination: null, holding: false };
  }

  const field = wreckageUnderEscort(t, escort);
  if (field) {
    return {
      activity: 'recovering',
      label: ACTIVITY_LABELS.recovering,
      progress: Math.min(1, field.progress / field.required),
      destination,
      holding,
    };
  }

  const area = survivorsUnderEscort(t, escort);
  if (area) {
    return {
      activity: 'rescuing',
      label: ACTIVITY_LABELS.rescuing,
      progress: Math.min(1, area.progress / area.required),
      destination,
      holding,
    };
  }

  // Committed to a boat with its deck gun, or shooting at something close in.
  const gunning =
    escort.gunTargetId !== null &&
    t.threats.some((th) => th.id === escort.gunTargetId && th.alive);
  if (gunning) {
    return { activity: 'engaging', label: ACTIVITY_LABELS.engaging, progress: null, destination, holding };
  }
  // A pursuit still closing the distance: same activity, but say so — and the
  // destination is the BOAT, so the order line on the map points at the thing
  // the escort is actually chasing.
  const pursued =
    escort.pursueBoatId !== null
      ? t.threats.find((th) => th.id === escort.pursueBoatId && th.alive)
      : undefined;
  if (pursued) {
    return {
      activity: 'engaging',
      label: 'Closing to Engage',
      progress: null,
      destination: { x: pursued.x, y: pursued.y },
      holding: false,
    };
  }

  if (escort.moveTarget) {
    return { activity: 'moving', label: ACTIVITY_LABELS.moving, progress: null, destination, holding };
  }
  if (escort.stationed) {
    return { activity: 'holding', label: ACTIVITY_LABELS.holding, progress: null, destination: null, holding: true };
  }
  return { activity: 'escorting', label: ACTIVITY_LABELS.escorting, progress: null, destination: null, holding: false };
}

// ---------------------------------------------------------------------------
// Order intent
// ---------------------------------------------------------------------------

/** What a tap on the map MEANS for the selected escort. Resolving intent
 *  separately from issuing the command keeps the input layer thin and makes
 *  the rules testable without a browser — and gives future order types
 *  (patrol, screen, intercept-at) one place to be added. */
export type EscortOrderKind = 'move' | 'recover' | 'rescue' | 'rejoin';

export interface EscortOrder {
  kind: EscortOrderKind;
  x: number;
  y: number;
  /** Stay on station at the destination (recovery jobs and explicit moves) or
   *  fall back in with the convoy on arrival (rejoin). */
  hold: boolean;
  /** Player-facing confirmation of what was ordered. */
  message: string;
}

/** Resolve a tapped world point into an escort order.
 *
 *  Context-sensitive by design: the player should be able to tap the THING
 *  they want worked — a wreckage field, a crew in the water, the convoy — and
 *  have the escort do the obvious thing, rather than having to know that all
 *  three are really "move here and hold". `tapRadius` is supplied in world
 *  units by the caller so tolerance stays constant on screen at any zoom. */
export function resolveEscortOrder(
  t: TransitState,
  wx: number,
  wy: number,
  tapRadius: number,
): EscortOrder {
  // Wreckage and survivors are tapped by their WORKING AREA, not their icon —
  // the area is the thing the escort has to sit inside, so that is the target
  // the player is really pointing at.
  let best: { kind: EscortOrderKind; x: number; y: number; message: string; d: number } | null = null;
  const consider = (kind: EscortOrderKind, x: number, y: number, message: string, radius: number): void => {
    const d = dist(wx, wy, x, y);
    if (d > radius) return;
    if (!best || d < best.d) best = { kind, x, y, message, d };
  };

  for (const f of t.wreckage) {
    if (f.recovered || f.expired) continue;
    consider('recover', f.x, f.y, 'Recovering wreckage', WRECKAGE.radius + tapRadius);
  }
  for (const a of t.survivors) {
    if (a.rescued || a.lost) continue;
    consider('rescue', a.x, a.y, `Rescuing ${a.shipName}'s crew`, SURVIVORS.radius + tapRadius);
  }
  // Tapping the convoy itself puts the escort back on screening duty.
  for (const ship of t.ships) {
    if (!ship.alive || ship.delivered || !ship.spawned) continue;
    consider('rejoin', ship.x, ship.y, 'Returning to escort duty', tapRadius);
  }

  if (best) {
    const b = best as { kind: EscortOrderKind; x: number; y: number; message: string; d: number };
    return { kind: b.kind, x: b.x, y: b.y, hold: b.kind !== 'rejoin', message: b.message };
  }
  return { kind: 'move', x: wx, y: wy, hold: true, message: 'Moving to station' };
}
