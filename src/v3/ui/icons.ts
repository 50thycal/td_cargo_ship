// One small line icon per weapon (and Resupply), 32×32, drawn in the
// weapon's own colour so each one is recognisable at a glance on a phone —
// on its draft card, its loadout chip and its pickup on the water.

import type { CardId } from '../data/abilities';

export const ICON_COLOR: Record<CardId, string> = {
  flak: '#fb923c',
  seeker: '#a3e635',
  aegis: '#5eead4',
  cryo: '#7dd3fc',
  well: '#c084fc',
  airstrike: '#60a5fa',
  railgun: '#f472b6',
  tesla: '#a5b4fc',
  resupply: '#8be38b',
}

const PATHS: Record<CardId, string> = {
  // A flak burst: a ring of shrapnel around a ragged cloud.
  flak: '<circle cx="16" cy="16" r="6"/><path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L10 10 M25 7 L22 10 M7 25 L10 22 M25 25 L22 22"/>',
  // Three seekers fanning out from one launch point.
  seeker: '<path d="M5 27 L13 11 M5 27 L18 17 M5 27 L24 24"/><circle cx="14" cy="9" r="2.4"/><circle cx="20" cy="16" r="2.4"/><circle cx="26" cy="24" r="2.4"/>',
  // A dome over a hull, a missile glancing off it.
  aegis: '<path d="M4 25 A12 12 0 0 1 28 25 Z"/><path d="M9 25 H23"/><path d="M22 4 L18 10 M18 10 L24 12"/>',
  // A snowflake.
  cryo: '<path d="M16 3 V29 M4.7 9.5 L27.3 22.5 M4.7 22.5 L27.3 9.5 M12.5 5.5 L16 9 L19.5 5.5 M12.5 26.5 L16 23 L19.5 26.5"/>',
  // A spiral pulling inward.
  well: '<path d="M16 16 m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -10 0 a8 8 0 1 1 16 0 a11 11 0 1 1 -22 0"/>',
  // A jet seen from above, its strike line ahead.
  airstrike: '<path d="M16 4 L18 12 L27 17 L18 17 L19 24 L16 22 L13 24 L14 17 L5 17 L14 12 Z"/><path d="M16 26 V30" stroke-dasharray="1.5 2"/>',
  // A beam leaving a barrel, piercing two targets.
  railgun: '<path d="M4 26 L28 6"/><path d="M3 21 L9 27" /><circle cx="15" cy="16.8" r="2.6"/><circle cx="22" cy="11" r="2.6"/>',
  // A coil throwing a forked spark.
  tesla: '<path d="M10 28 V14 M7 18 H13 M7 22 H13 M7 26 H13"/><path d="M10 14 L14 9 L12 8 L18 3 M14 9 L20 10 L19 12 L26 13"/>',
  // A repair cross in a crate.
  resupply: '<rect x="6" y="9" width="20" height="16" rx="2"/><path d="M16 12 V22 M11 17 H21"/>',
}

export function upgradeIcon(id: CardId, size = 32): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 32 32');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', ICON_COLOR[id]);
  svg.setAttribute('stroke-width', '2.2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('v2-icon');
  svg.innerHTML = PATHS[id];
  return svg;
}

/** The same icon as an image for the canvas (weapon pickups), cached per
 *  weapon; null until it has loaded. */
const images = new Map<CardId, HTMLImageElement>();
export function iconImage(id: CardId): HTMLImageElement | null {
  let img = images.get(id);
  if (!img) {
    img = new Image();
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="64" height="64" fill="none" stroke="${ICON_COLOR[id]}" ` +
      `stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${PATHS[id]}</svg>`;
    img.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    images.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
