// Inline SVG icon set. Everything is drawn in code — no external image assets —
// so the game ships as a single self-contained bundle. Icons inherit
// `currentColor`, letting CSS (or an inline style) drive their palette: class
// tints, state colors, accent glows.

import { h } from './dom';
import type { FormationId, ShipClassId } from '../sim/types';

/** Wrap an svg body in the standard 24×24 stroke frame. Elements inside may
 *  override fill/stroke for filled details. */
function stroked(body: string, viewBox = '0 0 24 24'): string {
  return (
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.7" ` +
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
    '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5" opacity=".55"/>' +
      '<path d="M12 12 18.2 5.4"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
  ),
  sonar: stroked(
    '<circle cx="12" cy="16.5" r="2.6"/><path d="M12 13.9v-1.7M9.8 14.7l-1.2-1.2M14.2 14.7l1.2-1.2"/>' +
      '<path d="M5.2 8.2a9.6 9.6 0 0 1 13.6 0" opacity=".55"/>' +
      '<path d="M7.9 10.9a5.8 5.8 0 0 1 8.2 0" opacity=".8"/>',
  ),
  eye: stroked(
    '<path d="M2.5 12S6 5.6 12 5.6 21.5 12 21.5 12 18 18.4 12 18.4 2.5 12 2.5 12z"/>' +
      '<circle cx="12" cy="12" r="2.7"/>',
  ),
  alert: stroked(
    '<path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4.2"/>' +
      '<circle cx="12" cy="16.6" r=".7" fill="currentColor" stroke="none"/>',
  ),
  // --- weapons / defense -------------------------------------------------------
  missile: stroked(
    '<path d="M14 4.2c2.9.3 5.5 2.9 5.8 5.8l-9.3 9.3-6-6z"/>' +
      '<circle cx="14.6" cy="9.4" r="1.5"/>' +
      '<path d="M6.2 18.2 3.8 20.6M9.4 20.2l-1.6 1.6M4.2 15 2.6 16.6" opacity=".6"/>',
  ),
  turret: stroked(
    '<path d="M4 18.5h16"/><path d="M6.2 18.5v-1a6 6 0 0 1 8.6-5.4"/>' +
      '<path d="M13.6 10.9 19 5.5"/>' +
      '<circle cx="20.4" cy="4.2" r=".7" fill="currentColor" stroke="none"/>' +
      '<circle cx="21.6" cy="6.4" r=".6" fill="currentColor" stroke="none" opacity=".6"/>',
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
  planeEcm: stroked(
    `<path d="${PLANE_PATH}" fill="currentColor" stroke="none"/>` +
      '<path d="M3.4 8.6a6.4 6.4 0 0 0 0 6.8M20.6 8.6a6.4 6.4 0 0 1 0 6.8" opacity=".6"/>',
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
  speed: stroked('<path d="M4.5 6 10.5 12l-6 6"/><path d="M12 6l6 6-6 6" opacity=".7"/>'),
} as const;

export type IconName = keyof typeof ICONS;

/** Build a span carrying one of the icons above. Size/color come from CSS. */
export function icon(name: IconName, className = ''): HTMLElement {
  return h('span', { className: className ? `icon ${className}` : 'icon', html: ICONS[name] });
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
