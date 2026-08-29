// Inline SVG icon set. Everything is drawn in code — no external image assets —
// so the game ships as a single self-contained bundle. Icons inherit
// `currentColor`, letting CSS (or an inline style) drive their palette.
//
// Design language (the "console glyph" set): every icon sits on the same
// 24×24 grid, drawn with the same 1.8px round-capped stroke, with filled
// details reserved for small emphasis dots. Stats that used to be described
// with words (accuracy, range, reload …) each get ONE canonical glyph used
// everywhere that stat appears, so the player learns the symbol once.

import { h } from './dom';
import type { StatTier } from '../data/statTiers';
import { TIER_ORDER } from '../data/statTiers';
import { escortHull } from '../data/escortHulls';
import type { FormationId, ModuleId, ShipClassId } from '../sim/types';
import type { CounterBranchId } from '../data/counters';

/** Wrap an svg body in the standard 24×24 stroke frame. Elements inside may
 *  override fill/stroke for filled details. */
function stroked(body: string, viewBox = '0 0 24 24'): string {
  return (
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}

/** Wrap an svg body in a filled frame (silhouettes, diagrams). */
function filled(body: string, viewBox: string): string {
  return `<svg viewBox="${viewBox}" fill="currentColor" stroke="none" aria-hidden="true">${body}</svg>`;
}

/** Classic top-down aircraft glyph, nose up. Reused (rotated) by plane icons. */
const PLANE_PATH =
  'M12 2.2 12.9 3.4 12.9 9.2 21 13.1 21 15 12.9 13 12.9 17.6 15.3 19.6 15.3 21.2 ' +
  '12 20.2 8.7 21.2 8.7 19.6 11.1 17.6 11.1 13 3 15 3 13.1 11.1 9.2 11.1 3.4 Z';

export const ICONS = {
  // --- sensors / detection ---------------------------------------------------
  radar: stroked(
    '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6" opacity=".5"/>' +
      '<path d="M12 12 18 5.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/>' +
      '<circle cx="16.2" cy="14.8" r="1" fill="currentColor" stroke="none" opacity=".8"/>',
  ),
  sonar: stroked(
    '<circle cx="12" cy="17" r="2.4"/>' +
      '<path d="M7.6 12.4a6.2 6.2 0 0 1 8.8 0" opacity=".85"/>' +
      '<path d="M4.8 9.4a10.2 10.2 0 0 1 14.4 0" opacity=".5"/>',
  ),
  eye: stroked(
    '<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z"/>' +
      '<circle cx="12" cy="12" r="2.7"/>',
  ),
  alert: stroked(
    '<path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4.2"/>' +
      '<circle cx="12" cy="16.6" r=".8" fill="currentColor" stroke="none"/>',
  ),
  // --- stat glyphs — one canonical symbol per stat, used everywhere ---------
  /** Accuracy: a crosshair. */
  accuracy: stroked(
    '<circle cx="12" cy="12" r="6.2"/>' +
      '<path d="M12 2.9v3.2M12 17.9v3.2M2.9 12h3.2M17.9 12h3.2"/>' +
      '<circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  ),
  /** Range / reach: an emitter dot casting widening arcs. */
  range: stroked(
    '<circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M9.4 8.6a5.2 5.2 0 0 1 0 6.8"/>' +
      '<path d="M12.9 5.7a9.4 9.4 0 0 1 0 12.6" opacity=".7"/>' +
      '<path d="M16.4 2.9a13.6 13.6 0 0 1 0 18.2" opacity=".4"/>',
  ),
  /** Reload / cycling: circular arrows. */
  reload: stroked(
    '<path d="M5 12a7 7 0 0 1 11.9-5"/><path d="M17.3 3.7v3.5h-3.5"/>' +
      '<path d="M19 12a7 7 0 0 1-11.9 5"/><path d="M6.7 20.3v-3.5h3.5"/>',
  ),
  /** Speed: a gauge with the needle buried. */
  speed: stroked(
    '<path d="M4.4 16.6a8.6 8.6 0 1 1 15.2 0"/>' +
      '<path d="M12 16.2l4-5.6"/>' +
      '<circle cx="12" cy="16.2" r="1.3" fill="currentColor" stroke="none"/>',
  ),
  /** Cooldown / timing: a clock. */
  clock: stroked('<circle cx="12" cy="12" r="8.2"/><path d="M12 7v5l3.4 2"/>'),
  /** Damage / blast: a starburst. */
  burst: stroked(
    '<circle cx="12" cy="12" r="2.5"/>' +
      '<path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4"/>' +
      '<path d="M6 6l2.2 2.2M15.8 15.8 18 18M18 6l-2.2 2.2M8.2 15.8 6 18" opacity=".6"/>',
  ),
  /** Projectile size / footprint: a dot inside corner brackets. */
  size: stroked(
    '<circle cx="12" cy="12" r="3.2"/>' +
      '<path d="M4 8.4V6a2 2 0 0 1 2-2h2.4M15.6 4H18a2 2 0 0 1 2 2v2.4M20 15.6V18a2 2 0 0 1-2 2h-2.4M8.4 20H6a2 2 0 0 1-2-2v-2.4"/>',
  ),
  /** Bonus / assist: additive plus. */
  plus: stroked('<circle cx="12" cy="12" r="8.2"/><path d="M12 8.4v7.2M8.4 12h7.2"/>'),
  // --- weapons / defense -------------------------------------------------------
  missile: stroked(
    '<path d="M14 4.2c2.9.3 5.5 2.9 5.8 5.8l-9.3 9.3-6-6z"/>' +
      '<circle cx="14.6" cy="9.4" r="1.5"/>' +
      '<path d="M6.2 18.2 3.8 20.6M9.4 20.2l-1.6 1.6M4.2 15 2.6 16.6" opacity=".6"/>',
  ),
  /** Shore battery: a launcher raised off the ground line. */
  battery: stroked(
    '<path d="M3.5 20h17"/><path d="M6.5 20v-2.8h7V20"/>' +
      '<path d="M8.2 16 15.4 8.8"/>' +
      '<path d="M14.6 5.6c1.7.2 3 1.5 3.2 3.2l-2.4 2.4-3.2-3.2z"/>',
  ),
  turret: stroked(
    '<path d="M4 18.5h16"/><path d="M6.2 18.5v-1a6 6 0 0 1 8.6-5.4"/>' +
      '<path d="M13.6 10.9 19 5.5"/>' +
      '<circle cx="20.4" cy="4.2" r=".8" fill="currentColor" stroke="none"/>',
  ),
  /** Ammunition: three rounds standing in a rack. */
  ammo: stroked(
    '<path d="M7 20v-9.6c0-1.6.5-2.6 1.4-3.6.9 1 1.4 2 1.4 3.6V20z"/>' +
      '<path d="M14.2 20v-9.6c0-1.6.5-2.6 1.4-3.6.9 1 1.4 2 1.4 3.6V20z"/>' +
      '<path d="M4.2 20h15.6" opacity=".6"/>',
  ),
  chevrons: stroked('<path d="M5 12.5 12 5.5l7 7"/><path d="M5 19 12 12l7 7"/>'),
  shield: stroked('<path d="M12 3l7.2 2.9v5.3c0 4.5-3 7.6-7.2 9.3-4.2-1.7-7.2-4.8-7.2-9.3V5.9z"/>'),
  flame: stroked(
    '<path d="M12 3.6c2.6 3.1 5.1 5.6 5.1 9a5.1 5.1 0 0 1-10.2 0c0-3.4 2.5-5.9 5.1-9z"/>' +
      '<path d="M12 11.2c1.1 1.3 2.1 2.3 2.1 3.7a2.1 2.1 0 0 1-4.2 0c0-1.4 1-2.4 2.1-3.7z" opacity=".6"/>',
  ),
  mine: stroked(
    '<circle cx="12" cy="12" r="5.4"/>' +
      '<path d="M12 3.6v2.4M12 18v2.4M3.6 12h2.4M18 12h2.4M6.2 6.2l1.7 1.7M17.8 6.2l-1.7 1.7M6.2 17.8l1.7-1.7M17.8 17.8l-1.7-1.7"/>' +
      '<circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  ),
  drone: stroked(
    '<circle cx="5.8" cy="5.8" r="2.3"/><circle cx="18.2" cy="5.8" r="2.3"/>' +
      '<circle cx="5.8" cy="18.2" r="2.3"/><circle cx="18.2" cy="18.2" r="2.3"/>' +
      '<rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1"/>' +
      '<path d="M7.5 7.5l2.1 2.1M16.5 7.5l-2.1 2.1M7.5 16.5l2.1-2.1M16.5 16.5l-2.1-2.1"/>',
  ),
  jam: stroked('<path d="M13.2 2.5 5 13.4h5.6L9 21.5l8.2-10.9h-5.6z"/>'),
  // --- aircraft ----------------------------------------------------------------
  planeScan: stroked(
    `<path d="${PLANE_PATH}" fill="currentColor" stroke="none" transform="rotate(90 12 12)"/>` +
      '<path d="M19.5 6.5l2.6-1.4M20.5 12h3M19.5 17.5l2.6 1.4" opacity=".6"/>',
    '0 0 26 24',
  ),
  // The Warthog: the airframe with a burst of gunfire coming off its nose.
  planeGun: stroked(
    `<path d="${PLANE_PATH}" fill="currentColor" stroke="none"/>` +
      '<path d="M12 1.4v3.1M8.6 3.1l1.5 2.7M15.4 3.1l-1.5 2.7" opacity=".75"/>',
  ),
  // --- economy / meta ------------------------------------------------------------
  coin: stroked(
    '<circle cx="12" cy="12" r="8.2"/>' +
      '<path d="M14.6 9.4c-.6-1.1-4.9-1.3-4.9.7 0 2.3 5.1 1.3 5.1 3.7 0 2-4.4 1.8-5-.6"/>' +
      '<path d="M12 6.8v1.4M12 15.8v1.4"/>',
  ),
  intel: stroked(
    '<path d="M12 3l7.2 9L12 21l-7.2-9z"/><path d="M12 3v18M4.8 12h14.4" opacity=".35"/>',
  ),
  star: stroked(
    '<path d="M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.9z"/>',
  ),
  wrench: stroked(
    '<path d="M15 6.3a4.6 4.6 0 0 0-6.3 5.6L4 16.6 7.4 20l4.7-4.7a4.6 4.6 0 0 0 5.6-6.3L14.6 12l-2.6-2.6z"/>',
  ),
  anchor: stroked(
    '<circle cx="12" cy="5" r="1.9"/><path d="M12 6.9V20"/><path d="M8.4 9.8h7.2"/>' +
      '<path d="M4.8 13a7.2 7.2 0 0 0 14.4 0"/><path d="M4.8 13l-1.7 1M19.2 13l1.7 1"/>',
  ),
  flask: stroked(
    '<path d="M9.4 3h5.2M10.4 3v5.2l-5 8.7a2 2 0 0 0 1.8 3.1h9.6a2 2 0 0 0 1.8-3.1l-5-8.7V3"/>' +
      '<path d="M8.2 14.6h7.6" opacity=".7"/>',
  ),
  lock: stroked(
    '<rect x="6" y="10.8" width="12" height="9" rx="2"/><path d="M8.6 10.8V8a3.4 3.4 0 0 1 6.8 0v2.8"/>',
  ),
  check: stroked('<path d="M5 12.6 10 17.6 19 7.2"/>'),
  slots: stroked(
    '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/>' +
      '<rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2" opacity=".4"/>',
  ),
  // --- missile defense: three systems, three silhouettes ---------------------
  //
  // These three all shoot missiles down and they are NOT interchangeable, so
  // the glyphs are built to be told apart at a glance and at 16px. The tell is
  // WHERE THE LAUNCHER IS, because that is the actual mechanical difference:
  //   shore   — fixed cell on the ground, fires straight up, reaches the whole
  //             map (the wide arc)
  //   escort  — launcher on a hull, on the water, fires on a slant, reaches
  //             as far as the ship it rides on (the short arc)
  //   point   — no launcher at all, just a bubble of tracer over one ship,
  //             killing something already on top of it
  // The base interceptor and the cargo self-defense interceptor used to SHARE
  // the generic turret glyph, which made the two ends of missile defense —
  // map-wide backbone and last-ditch terminal shot — indistinguishable in the
  // draft, the tech tree and the module cards.

  /** Shore-base interceptor: a vertical launch cell, planted, reaching wide. */
  interceptorShore: stroked(
    '<path d="M3 20.6h18"/>' +
      '<path d="M7 20.6v-4.2h4.6v4.2"/>' +
      '<path d="M9.3 16.4V7.4"/>' +
      '<path d="M7.5 9.6 9.3 5.4l1.8 4.2"/>' +
      '<path d="M14.4 20.2a8.6 8.6 0 0 0 5.8-8.8" opacity=".5"/>',
  ),
  /** Escort interceptor: the same missile, launched off a hull under way. */
  interceptorEscort: stroked(
    '<path d="M2.6 20.8q2.3-1.7 4.6 0t4.6 0 4.6 0 4.6 0" opacity=".45"/>' +
      '<path d="M4.8 18.6h9.4l-1.5 2.2H6.3z"/>' +
      '<path d="M8.6 18.6v-2.4h2.6"/>' +
      '<path d="M12.2 14.8 17.6 9.4"/>' +
      '<path d="M15.2 8.4l3.4-1-1 3.4"/>' +
      '<path d="M16.4 17.6a6.6 6.6 0 0 0-2.6-5" opacity=".5"/>',
  ),
  /** Cargo self-defense: a bubble of tracer over one hull, and the kill. */
  interceptorPoint: stroked(
    '<circle cx="12" cy="19" r="1.6" fill="currentColor" stroke="none"/>' +
      '<path d="M5.2 18.4a7.4 7.4 0 0 1 13.6 0" opacity=".65"/>' +
      '<path d="M12 16.6v-4M8.4 17.4 6.2 13.8M15.6 17.4l2.2-3.6"/>' +
      '<path d="M12 7.4 13.6 9.6 12 11.8 10.4 9.6z" fill="currentColor" stroke="none"/>',
  ),
  /** Missile-warning receiver: a dish taking an inbound track. It never
   *  shoots, so there is deliberately no launcher anywhere in the glyph. */
  warningReceiver: stroked(
    '<path d="M4 20.6h7"/>' +
      '<path d="M7.5 20.6v-5.2"/>' +
      '<path d="M4.4 15.4a3.4 3.4 0 0 1 6.2 0z"/>' +
      '<path d="M20.4 4.4 12.8 12"/>' +
      '<path d="M20.6 8.6V4.2h-4.4"/>' +
      '<circle cx="14.6" cy="17.6" r="1.1" fill="currentColor" stroke="none" opacity=".8"/>',
  ),
  // --- underwater: detection and clearing stay visibly separate --------------
  /** Mine-detection sonar: a search beam finding a moored mine. Detection
   *  only — the mine is still there when the glyph is done. */
  mineSonarBeam: stroked(
    '<path d="M4 4.6h16" opacity=".55"/>' +
      '<path d="M9.6 5.4 6.4 14.2M14.4 5.4l3.2 8.8" opacity=".6"/>' +
      '<path d="M8.4 9.6h7.2" opacity=".3"/>' +
      '<circle cx="12" cy="17.6" r="2.5"/>' +
      '<path d="M12 12.8v2.3M12 20.1v1.4M8.1 17.6H6.7M17.3 17.6h1.4"/>',
  ),
  /** Mine-countermeasure drone: a submersible, not the quadcopter. */
  subDrone: stroked(
    '<path d="M2.8 4.4h18.4" opacity=".45"/>' +
      '<path d="M8.2 12.6h6.4a3.4 3.4 0 0 1 0 6.8H8.2z"/>' +
      '<path d="M8.2 12.6 5.4 10.4v11.2l2.8-2.2z"/>' +
      '<circle cx="15.2" cy="16" r="1.2" fill="currentColor" stroke="none"/>' +
      '<path d="M11.4 12.6V5.4" opacity=".45"/>',
  ),
  /** Hydrophone: a capsule on a cable, listening. Passive — the arcs arrive
   *  from one side rather than radiating from it. */
  hydrophone: stroked(
    '<path d="M2.8 3.8h18.4" opacity=".45"/>' +
      '<path d="M7 3.8v8.4"/>' +
      '<rect x="5.2" y="12.2" width="3.6" height="6.2" rx="1.8"/>' +
      '<path d="M12.4 12a5.4 5.4 0 0 1 0 6.6" opacity=".85"/>' +
      '<path d="M16 9.6a9.6 9.6 0 0 1 0 11.4" opacity=".45"/>',
  ),
  /** Depth charge: a drum on its way down, and what happens under it. */
  depthCharge: stroked(
    '<path d="M2.8 3.8h18.4" opacity=".45"/>' +
      '<rect x="9.2" y="5.6" width="5.6" height="6.4" rx="1"/>' +
      '<path d="M9.2 7.8h5.6M9.2 9.8h5.6" opacity=".5"/>' +
      '<circle cx="12" cy="18.4" r="2.4"/>' +
      '<path d="M12 13.6v1.6M7.6 15.6l1.4 1.4M16.4 15.6 15 17M6.4 18.4h1.6M17.6 18.4H16"/>',
  ),
  /** Active sonar: a hull transducer pinging DOWN. The mirror of the passive
   *  hydrophone above, and of the generic `sonar` glyph, which throws its arcs
   *  upward from a seabed contact. */
  activeSonar: stroked(
    '<path d="M3 4.4h18" opacity=".45"/>' +
      '<rect x="11" y="4.4" width="2" height="2.8" rx=".4" fill="currentColor" stroke="none"/>' +
      '<path d="M7.4 8.6a5.6 5.6 0 0 0 9.2 0"/>' +
      '<path d="M4.8 11.4a8.8 8.8 0 0 0 14.4 0" opacity=".55"/>' +
      '<circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>',
  ),
  // --- guns -----------------------------------------------------------------
  /** Deck gun: a mount firing flat, at something on the water. */
  deckGun: stroked(
    '<path d="M3.4 20.4h17.2"/>' +
      '<path d="M5.6 20.4v-2.8a3.2 3.2 0 0 1 6.4 0v2.8"/>' +
      '<path d="M11.4 16.2 18.2 11"/>' +
      '<path d="M18.6 8.6l.8-2.6M20.4 10.4l2.2-1M19.6 12.8l2.4.4" opacity=".7"/>',
  ),
  /** Flak: barrels up, and shells going off in the air. Nothing on this glyph
   *  points at the water, which is the whole difference from the deck gun. */
  flak: stroked(
    '<path d="M4.6 20.6h8.4"/>' +
      '<path d="M6.4 20.6v-2.8h4.8v2.8"/>' +
      '<path d="M7.8 17.8V12M10.6 17.8V12"/>' +
      '<circle cx="9.2" cy="7.4" r="1.5"/>' +
      '<path d="M9.2 3.2v1.6M6.2 4.4l1.1 1.2M12.2 4.4l-1.1 1.2M5 7.4h1.6M11.8 7.4h1.6"/>' +
      '<circle cx="17.8" cy="12.6" r="1" opacity=".6"/>' +
      '<path d="M17.8 9.4v1.2M15.4 12.6h1.2M20.2 12.6H19M17.8 15.8v-1.2" opacity=".6"/>',
  ),
  /** Counter-battery: their arc comes in faint, ours goes back. It fires at
   *  the gun, never at the shell, so both arcs land on the same ground line. */
  counterBattery: stroked(
    '<path d="M2.6 20.4h18.8" opacity=".5"/>' +
      '<path d="M19.8 17.6C17.4 9.4 9.8 8.4 4.6 12.4" opacity=".5"/>' +
      '<path d="M6.8 12.8 4.2 12l.6 2.8" opacity=".5"/>' +
      '<path d="M4.2 17.6C6.6 9.4 14.2 8.4 19.4 12.4"/>' +
      '<path d="M17.2 12.8 19.8 12l-.6 2.8"/>',
  ),
  // --- passive / survivability ----------------------------------------------
  /** Thermal imaging: a heat signature. Sees, never shoots. */
  thermal: stroked(
    '<path d="M3.6 19.8h16.8"/>' +
      '<path d="M7.8 19.8a4.2 4.2 0 0 1 8.4 0z" fill="currentColor" stroke="none" opacity=".85"/>' +
      '<path d="M8.6 14.2c0-1.5 1.7-1.5 1.7-3.1s-1.7-1.5-1.7-3.1"/>' +
      '<path d="M12 14.2c0-1.5 1.7-1.5 1.7-3.1s-1.7-1.5-1.7-3.1"/>' +
      '<path d="M15.4 14.2c0-1.5 1.7-1.5 1.7-3.1s-1.7-1.5-1.7-3.1" opacity=".6"/>',
  ),
  /** Anti-boarding: a grapnel that does not get a purchase. */
  antiBoarding: stroked(
    '<path d="M3.4 19.8h17.2"/>' +
      '<path d="M11 16.6V8.4"/>' +
      '<path d="M11 12.8a3 3 0 0 1-3 3"/><path d="M11 12.8a3 3 0 0 0 3 3"/>' +
      '<path d="M11 8.4 6.6 4.8" opacity=".55"/>' +
      '<path d="M16.4 4.4 20.8 8.8M20.8 4.4l-4.4 4.4"/>',
  ),
  /** Hardened electronics: the sensor keeps working while the jamming glances
   *  off it. The only counter in the game with nothing to shoot at. */
  hardened: stroked(
    '<path d="M8.8 20.6h6.4"/>' +
      '<path d="M12 20.6v-6.4"/>' +
      '<circle cx="12" cy="12.4" r="1.5" fill="currentColor" stroke="none"/>' +
      '<path d="M4.8 14.8a7.4 7.4 0 0 1 14.4 0"/>' +
      '<path d="M6.6 3.2 4.2 7.8h2.8l-.8 3.4" opacity=".7"/>' +
      '<path d="M17.4 3.2 19.8 7.8H17l.8 3.4" opacity=".7"/>',
  ),
  /** Reinforced hull: plating, doubled. A hull section, not a shield — the
   *  shield glyph is the generic damage-reduction stat and stays that. */
  reinforcedHull: stroked(
    '<rect x="4.4" y="5.6" width="15.2" height="12.8" rx="2"/>' +
      '<path d="M4.4 12h15.2" opacity=".5"/>' +
      '<circle cx="7.6" cy="8.8" r=".9" fill="currentColor" stroke="none"/>' +
      '<circle cx="16.4" cy="8.8" r=".9" fill="currentColor" stroke="none"/>' +
      '<circle cx="7.6" cy="15.2" r=".9" fill="currentColor" stroke="none"/>' +
      '<circle cx="16.4" cy="15.2" r=".9" fill="currentColor" stroke="none"/>' +
      '<path d="M12 21.4v-2" opacity=".55"/>',
  ),
  /** Fire suppression: the hose, and what it is aimed at. */
  fireSuppression: stroked(
    '<path d="M14.4 5.8c2.1 2.5 4 4.6 4 7.3a4 4 0 0 1-8 0c0-2.7 1.9-4.8 4-7.3z" opacity=".85"/>' +
      '<path d="M2.4 19.4h3.8"/>' +
      '<path d="M6.4 19.4 11 16.6M6.4 19.4l4.8 1.4M6.4 19.4l3.6-4.2"/>',
  ),
  /** Compartmentalization: bulkheads, and the one flooded space they hold. */
  compartments: stroked(
    '<path d="M2.8 7.6h11.4a5.4 5.4 0 0 1 0 8.8H2.8z"/>' +
      '<path d="M7 7.6v8.8M11.2 7.6v8.8" opacity=".7"/>' +
      '<path d="M2.8 7.6H7v8.8H2.8z" fill="currentColor" stroke="none" opacity=".4"/>' +
      '<path d="M4.4 20.4h13.2" opacity=".4"/>',
  ),
  /** Logistics: the quayside, where berths and repairs come from. */
  logistics: stroked(
    '<path d="M3.4 20.6h17.2"/>' +
      '<path d="M6.4 20.6V5.2h11"/>' +
      '<path d="M6.4 8.6 11.2 5.2" opacity=".5"/>' +
      '<path d="M15.4 5.2v4.4"/>' +
      '<path d="M12.6 9.6h5.6v4.6h-5.6z"/>',
  ),
  /** An escort hull, for the procurement card that hires one. (The roster
   *  draws real per-hull silhouettes — see escortHullFigure.) */
  escortShip: stroked(
    '<path d="M2.6 15.2h18.8l-2.8 4.8H5.4z"/>' +
      '<path d="M8.2 15.2v-3.4h5.4l1.9 3.4z"/>' +
      '<path d="M10.8 11.8V7.2M8.6 9h4.4"/>',
  ),
  /** Cargo crate — used specifically for quota-points contribution, distinct
   *  from the coin (cash) icon even though both derive from a ship's value. */
  crate: stroked(
    '<path d="M4 8.2 12 4l8 4.2v8.6L12 21 4 16.8z"/>' +
      '<path d="M4 8.2 12 12.4l8-4.2M12 12.4V21" opacity=".7"/>',
  ),
} as const;

export type IconName = keyof typeof ICONS;

/** THE icon for each counter branch — the single source of truth for what a
 *  system looks like. Every surface that shows a branch, its research nodes or
 *  its equipment reads this map (draft cards, the tech tree, module cards,
 *  tooltips, the shore/escort loadouts), so an item cannot end up wearing one
 *  glyph on one screen and another somewhere else.
 *
 *  EVERY ENTRY IS UNIQUE, and that is a rule rather than a coincidence. Five of
 *  these branches used to share the generic `turret` glyph and two more shared
 *  `sonar`, which put the shore-base interceptor and the cargo self-defense
 *  interceptor — the map-wide backbone of missile defense and its last-ditch
 *  terminal shot — behind the same symbol everywhere they appeared. Two systems
 *  the player must choose between cannot look identical on the card they choose
 *  from. The generic glyphs are still in the set; they are for stats, headings
 *  and categories, never for a mechanically distinct system. */
export const BRANCH_ICONS: Record<CounterBranchId, IconName> = {
  escortInterceptor: 'interceptorEscort',
  baseInterceptor: 'interceptorShore',
  selfDefense: 'interceptorPoint',
  missileWarning: 'warningReceiver',
  mineSonar: 'mineSonarBeam',
  mcmDrones: 'subDrone',
  scanPulse: 'planeScan',
  hydrophone: 'hydrophone',
  depthCharges: 'depthCharge',
  activeSonar: 'activeSonar',
  deckGun: 'deckGun',
  antiBoarding: 'antiBoarding',
  counterBattery: 'counterBattery',
  thermalImaging: 'thermal',
  flak: 'flak',
  hardened: 'hardened',
  warthog: 'planeGun',
  reinforcedHull: 'reinforcedHull',
  fireSuppression: 'fireSuppression',
  compartmentalization: 'compartments',
  logistics: 'logistics',
};

/** A cargo module wears its BRANCH's glyph, because it IS that branch's
 *  equipment — the self-defense module on a container ship and the
 *  self-defense research node in the tech tree are one system seen from two
 *  screens. Derived rather than restated so the two can never drift apart, and
 *  so a new module cannot be added with a stale duplicate icon. */
export const MODULE_BRANCH: Record<ModuleId, CounterBranchId> = {
  selfDefense: 'selfDefense',
  missileWarning: 'missileWarning',
  reinforcedHull: 'reinforcedHull',
  mineSonar: 'mineSonar',
  fireSuppression: 'fireSuppression',
  hydrophone: 'hydrophone',
  thermalImaging: 'thermalImaging',
  flak: 'flak',
  antiBoarding: 'antiBoarding',
  compartmentalization: 'compartmentalization',
};

export const MODULE_ICONS: Record<ModuleId, IconName> = Object.fromEntries(
  Object.entries(MODULE_BRANCH).map(([id, branch]) => [id, BRANCH_ICONS[branch]]),
) as Record<ModuleId, IconName>;

/** Build a span carrying one of the icons above. Size/color come from CSS. */
export function icon(name: IconName, className = ''): HTMLElement {
  return h('span', { className: className ? `icon ${className}` : 'icon', html: ICONS[name] });
}

// ---------------------------------------------------------------------------
// Stat tiers as LED meters
// ---------------------------------------------------------------------------
//
// Tier words ("High", "Max") never reach the player any more: every tier is
// shown as a 5-segment LED bar, the way an 80s console would show signal
// strength. STAT_META names each stat key used by the counter catalogue and
// pairs it with its canonical glyph; `invert` marks the one magnitude-named
// domain (auto-fire cooldown) where a LOWER tier is better, so its meter
// still reads "more lit = better".

export interface StatMeta {
  label: string;
  icon: IconName;
  invert?: boolean;
}

export const STAT_META: Record<string, StatMeta> = {
  accuracy: { label: 'Accuracy', icon: 'accuracy' },
  speed: { label: 'Speed', icon: 'speed' },
  reload: { label: 'Reload', icon: 'reload' },
  range: { label: 'Range', icon: 'range' },
  size: { label: 'Round size', icon: 'size' },
  assist: { label: 'Assist', icon: 'plus' },
  bonus: { label: 'Bonus', icon: 'plus' },
  radius: { label: 'Radius', icon: 'range' },
  blastRadius: { label: 'Blast', icon: 'burst' },
  damage: { label: 'Damage', icon: 'burst' },
  rate: { label: 'Fire rate', icon: 'reload' },
  launchRange: { label: 'Launch range', icon: 'range' },
  throwRange: { label: 'Throw range', icon: 'range' },
  droneSpeed: { label: 'Drone speed', icon: 'speed' },
  suppression: { label: 'Suppression', icon: 'clock' },
  recovery: { label: 'Recovery', icon: 'reload' },
  reduction: { label: 'Damage cut', icon: 'shield' },
  slow: { label: 'Board slow', icon: 'clock' },
  autoCooldown: { label: 'Auto rate', icon: 'clock', invert: true },
};

export function statMeta(stat: string): StatMeta {
  return STAT_META[stat] ?? { label: stat, icon: 'plus' };
}

/** A 5-segment LED bar lit up to the given tier. `invert` flips the scale for
 *  magnitude-named domains where a lower tier is the better one. */
export function tierMeter(tier: StatTier, invert = false): HTMLElement {
  const idx = TIER_ORDER.indexOf(tier);
  const lit = invert ? TIER_ORDER.length - 1 - idx : idx;
  const cells: HTMLElement[] = [];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    cells.push(h('span', { className: i <= lit ? 'meter-cell on' : 'meter-cell' }));
  }
  const label = `${lit + 1} of ${TIER_ORDER.length}`;
  return h('span', { className: 'meter', attrs: { role: 'img', 'aria-label': label } }, cells);
}

/** Where a tier sits on the meter, accounting for magnitude-named domains
 *  (see STAT_TIERS) where a LOWER tier is the better one. */
function litIndex(tier: StatTier, invert: boolean): number {
  const idx = TIER_ORDER.indexOf(tier);
  return invert ? TIER_ORDER.length - 1 - idx : idx;
}

/** A tier meter showing a CHANGE rather than a level: the rungs already held
 *  are lit, and the rungs this upgrade would add are marked as a gain, so the
 *  player can see the size of the step and not just the destination. */
export function tierMeterDelta(
  from: StatTier | undefined,
  to: StatTier,
  invert = false,
): HTMLElement {
  const litTo = litIndex(to, invert);
  const litFrom = from === undefined ? -1 : litIndex(from, invert);
  const cells: HTMLElement[] = [];
  for (let i = 0; i < TIER_ORDER.length; i++) {
    let cls = 'meter-cell';
    if (i <= Math.min(litFrom, litTo)) cls = 'meter-cell on';
    else if (i <= litTo) cls = 'meter-cell gain';
    else if (i <= litFrom) cls = 'meter-cell loss';
    cells.push(h('span', { className: cls }));
  }
  const label =
    from === undefined
      ? `new, ${litTo + 1} of ${TIER_ORDER.length}`
      : `${litFrom + 1} to ${litTo + 1} of ${TIER_ORDER.length}`;
  return h('span', { className: 'meter', attrs: { role: 'img', 'aria-label': label } }, cells);
}

/** A stat row for the draft: what the stat is now, and what taking this option
 *  would make it. `from` is undefined when the branch does not have the stat
 *  yet — this option introduces it.
 *
 *  The METER carries the whole message. There is deliberately no "High to
 *  Extra" caption: naming the rungs asks the player to learn a five-word scale
 *  and then translate it back into the picture that is already in front of
 *  them, and the lit-versus-gained segments say the same thing without the
 *  vocabulary. The tier names remain the internal representation; they are
 *  simply not something the game says out loud. */
export function statUpgradeRow(
  stat: string,
  from: StatTier | undefined,
  to: StatTier,
): HTMLElement {
  const meta = statMeta(stat);
  return h('span', { className: 'stat-meter' }, [
    icon(meta.icon),
    h('span', { className: 'stat-meter-label', text: meta.label }),
    tierMeterDelta(from, to, meta.invert),
  ]);
}

/** A labelled stat row: glyph, name, LED meter. The standard way any tiered
 *  stat is presented anywhere in the UI. */
export function statTierRow(stat: string, tier: StatTier): HTMLElement {
  const meta = statMeta(stat);
  return h('span', { className: 'stat-meter' }, [
    icon(meta.icon),
    h('span', { className: 'stat-meter-label', text: meta.label }),
    tierMeter(tier, meta.invert),
  ]);
}

// ---------------------------------------------------------------------------
// Ship silhouettes (side profile, sailing right) & formation diagrams
// ---------------------------------------------------------------------------

/** Class tint used everywhere a ship silhouette appears (matches the transit
 *  canvas palette). */
export const SHIP_TINTS: Record<ShipClassId, string> = {
  cargo: '#6fb1e0',
  tanker: '#f0a35e',
  freighter: '#8de08a',
};

const SHIP_SVGS: Record<ShipClassId | 'escort', string> = {
  cargo: filled(
    '<path d="M3 17h58l-5.5 8H9z"/>' +
      '<rect x="12" y="9.5" width="27" height="6.5" rx=".5" opacity=".7"/>' +
      '<rect x="16" y="5.5" width="15" height="3.6" rx=".5" opacity=".5"/>' +
      '<rect x="45" y="6" width="8" height="10" rx=".5" opacity=".92"/>' +
      '<rect x="47" y="3.4" width="1.6" height="2.6" opacity=".92"/>',
    '0 0 64 28',
  ),
  tanker: filled(
    '<path d="M2 16h60l-6.5 9H8.5z"/>' +
      '<rect x="9" y="12" width="41" height="4" rx="2" opacity=".65"/>' +
      '<circle cx="19" cy="11.5" r="3" opacity=".5"/><circle cx="31" cy="11.5" r="3" opacity=".5"/>' +
      '<rect x="51" y="5" width="7.5" height="11" rx=".5" opacity=".92"/>',
    '0 0 64 28',
  ),
  freighter: filled(
    '<path d="M8 17h48l-5 7H12.5z"/>' +
      '<rect x="17" y="10.5" width="19" height="5.8" rx=".5" opacity=".65"/>' +
      '<rect x="40" y="7" width="6.5" height="9.5" rx=".5" opacity=".92"/>' +
      '<rect x="42" y="4.4" width="1.4" height="2.6" opacity=".92"/>',
    '0 0 64 28',
  ),
  escort: filled(
    '<path d="M4 17h56l-7.5 7H10z"/>' +
      '<path d="M21 17v-6.5h14.5L40 17z" opacity=".85"/>' +
      '<rect x="28.6" y="3.5" width="1.4" height="7" opacity=".9"/>' +
      '<rect x="25.5" y="5.6" width="7.6" height="1.2" opacity=".9"/>' +
      '<rect x="46" y="13.2" width="7.5" height="3" rx=".8" opacity=".8"/>',
    '0 0 64 28',
  ),
};

/** Ship silhouette element (side profile). Tint via CSS color / inline style. */
export function shipFigure(classId: ShipClassId | 'escort', className = ''): HTMLElement {
  return h('span', {
    className: className ? `ship-svg ${className}` : 'ship-svg',
    html: SHIP_SVGS[classId],
  });
}

/** Side profile of a specific escort HULL — the six varieties differ, so the
 *  roster shows which ship is which rather than six copies of one drawing.
 *  Same viewBox and tinting as shipFigure, so the two sit together. */
export function escortHullFigure(unitId: number, className = ''): HTMLElement {
  return h('span', {
    className: className ? `ship-svg ${className}` : 'ship-svg',
    html: filled(escortHull(unitId).profile, '0 0 64 28'),
  });
}

const FORMATION_SVGS: Record<FormationId, string> = {
  tight: filled(
    '<g class="fdots">' +
      '<circle cx="24" cy="11" r="3"/><circle cx="24" cy="20" r="3"/><circle cx="24" cy="29" r="3"/>' +
      '<circle cx="40" cy="11" r="3"/><circle cx="40" cy="20" r="3"/><circle cx="40" cy="29" r="3"/>' +
      '</g>' +
      '<path d="M4 20h56" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity=".25" fill="none"/>',
    '0 0 64 40',
  ),
  wide: filled(
    '<g class="fdots">' +
      '<circle cx="14" cy="7" r="3"/><circle cx="28" cy="20" r="3"/><circle cx="14" cy="33" r="3"/>' +
      '<circle cx="46" cy="7" r="3"/><circle cx="58" cy="20" r="3"/><circle cx="46" cy="33" r="3"/>' +
      '</g>' +
      '<path d="M4 20h56" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity=".25" fill="none"/>',
    '0 0 64 40',
  ),
  sprint: filled(
    '<g class="fdots">' +
      '<circle cx="10" cy="20" r="3"/><circle cx="24" cy="20" r="3"/>' +
      '<circle cx="38" cy="20" r="3"/><circle cx="52" cy="20" r="3"/>' +
      '</g>' +
      '<path d="M4 12h56M4 28h56" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity=".25" fill="none"/>',
    '0 0 64 40',
  ),
};

/** Little formation diagram (dots drifting on the lane guides). */
export function formationFigure(id: FormationId): HTMLElement {
  return h('span', { className: 'formation-svg', html: FORMATION_SVGS[id] });
}
