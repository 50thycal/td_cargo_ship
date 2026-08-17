// Escort hull varieties — six of them, so a flotilla has faces.
//
// Escorts have been individual ships for a while now: their own names, their
// own fits, their own accumulated damage, their own legacies. They have not
// LOOKED like individuals — every one drew the same grey wedge on the map and
// no picture at all in the prep screen, so the roster read as a list and the
// map read as three identical markers.
//
// This is deliberately COSMETIC. A hull class changes nothing about what a ship
// can do: no stat, no slot, no price. Making them differ mechanically would
// turn "which hull did I get" into a roll of the dice on a purchase the player
// cannot re-roll, and the escort already carries enough that a bad draw would
// sting. What it changes is recognition — which is worth having on its own.
//
// Each entry owns BOTH views: the side profile the prep screen draws and the
// plan-view outline the map draws. They live together so the two can never
// drift into describing different ships.

/** Plan-view outline, in the local frame the renderer already uses: bow at
 *  +x, beam either side of y = 0, roughly 24 long by 10 wide. */
export interface HullPlan {
  /** Outline points, bow first, port side then starboard (closed by the view). */
  points: readonly (readonly [number, number])[];
  /** Superstructure block: [x, y, width, height] in the same frame. */
  house: readonly [number, number, number, number];
}

export interface EscortHullDef {
  id: string;
  /** Shown in the prep roster under the ship's name. */
  name: string;
  /** Side profile for the prep screen (inner SVG markup, 0 0 64 28 viewBox). */
  profile: string;
  plan: HullPlan;
}

export const ESCORT_HULLS: readonly EscortHullDef[] = [
  {
    id: 'cutter',
    name: 'Cutter',
    // Low and plain: a long forecastle and one squat house amidships.
    profile:
      '<path d="M4 17h56l-7.5 7H10z"/>' +
      '<path d="M21 17v-6.5h14.5L40 17z" opacity=".85"/>' +
      '<rect x="28.6" y="3.5" width="1.4" height="7" opacity=".9"/>' +
      '<rect x="25.5" y="5.6" width="7.6" height="1.2" opacity=".9"/>' +
      '<rect x="46" y="13.2" width="7.5" height="3" rx=".8" opacity=".8"/>',
    plan: {
      points: [[12, 0], [4, -5], [-12, -5], [-12, 5], [4, 5]],
      house: [-5, -2.5, 6, 5],
    },
  },
  {
    id: 'sloop',
    name: 'Sloop',
    // Fine bow, raked mast well forward, a boat deck aft.
    profile:
      '<path d="M3 17h57l-9 7H9z"/>' +
      '<path d="M18 17v-5.5h12l3 5.5z" opacity=".85"/>' +
      '<rect x="23" y="2.2" width="1.3" height="9.3" opacity=".9"/>' +
      '<path d="M38 17v-3.5h13v3.5z" opacity=".7"/>' +
      '<rect x="53" y="14" width="5" height="2.4" rx=".8" opacity=".8"/>',
    plan: {
      points: [[13, 0], [3, -4], [-11, -4.5], [-12, 4.5], [3, 4]],
      house: [-6, -2.2, 7, 4.4],
    },
  },
  {
    id: 'corvette',
    name: 'Corvette',
    // Blocky and modern: a tall bridge forward and a flat quarterdeck.
    profile:
      '<path d="M5 17h55l-6.5 7H11z"/>' +
      '<path d="M19 17V9h16v8z" opacity=".85"/>' +
      '<rect x="26" y="4" width="1.5" height="5.2" opacity=".9"/>' +
      '<rect x="37" y="13" width="10" height="4" rx=".6" opacity=".7"/>' +
      '<rect x="12" y="14.4" width="5" height="2.6" rx=".6" opacity=".8"/>',
    plan: {
      points: [[11, 0], [6, -5.5], [-12, -5.5], [-12, 5.5], [6, 5.5]],
      house: [-4, -3, 8, 6],
    },
  },
  {
    id: 'frigate',
    name: 'Frigate',
    // The big one: long hull, two houses, a lattice mast between them.
    profile:
      '<path d="M2 17h60l-8 7H8z"/>' +
      '<path d="M16 17v-6h13v6z" opacity=".85"/>' +
      '<path d="M36 17v-4.5h12V17z" opacity=".72"/>' +
      '<rect x="31.5" y="3" width="1.4" height="8.6" opacity=".9"/>' +
      '<rect x="29" y="6.2" width="6.4" height="1.1" opacity=".9"/>' +
      '<rect x="9" y="14.2" width="5.4" height="2.8" rx=".6" opacity=".8"/>',
    plan: {
      points: [[14, 0], [5, -5], [-13, -5], [-13, 5], [5, 5]],
      house: [-7, -2.8, 9, 5.6],
    },
  },
  {
    id: 'patrolBoat',
    name: 'Patrol Boat',
    // Small and fast: short hull, everything crowded forward, open stern.
    profile:
      '<path d="M9 17h46l-6 7H14z"/>' +
      '<path d="M17 17v-6h11l2 6z" opacity=".85"/>' +
      '<rect x="21" y="5" width="1.2" height="6.2" opacity=".9"/>' +
      '<rect x="41" y="14.6" width="9" height="2.4" rx=".7" opacity=".7"/>',
    plan: {
      points: [[10, 0], [4, -4], [-9, -4], [-9, 4], [4, 4]],
      house: [-4, -2.2, 5.5, 4.4],
    },
  },
  {
    id: 'monitor',
    name: 'Monitor',
    // Wide and slab-sided, sitting low with a heavy turret forward.
    profile:
      '<path d="M6 16.5h52l-4 7.5H10z"/>' +
      '<path d="M14 16.5v-4h11v4z" opacity=".8"/>' +
      '<path d="M30 16.5V8h13v8.5z" opacity=".85"/>' +
      '<rect x="35.5" y="3.4" width="1.4" height="4.8" opacity=".9"/>' +
      '<rect x="47" y="13.4" width="8" height="3.1" rx=".5" opacity=".7"/>',
    plan: {
      points: [[10, 0], [5, -6], [-11, -6], [-11, 6], [5, 6]],
      house: [-3, -3.4, 7, 6.8],
    },
  },
];

/** The hull a given escort shows.
 *
 *  Derived from the unit id rather than stored, so it is stable for the life of
 *  the ship, identical on replay, and costs nothing in the save. Ids are never
 *  recycled (see buyEscort), so two ships in one run can share a hull only once
 *  the flotilla has been through six of them. */
export function escortHull(unitId: number): EscortHullDef {
  const n = ESCORT_HULLS.length;
  // `unitId` starts at 1 and only climbs; the modulo walks the list in order so
  // an opening flotilla is three visibly different ships rather than three
  // draws from a hat that might all match.
  return ESCORT_HULLS[((unitId - 1) % n + n) % n];
}
