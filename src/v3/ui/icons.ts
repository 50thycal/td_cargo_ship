// One small line icon per weapon (and Resupply), 32×32, drawn in the
// weapon's own colour so each one is recognisable at a glance on a phone —
// on its draft card, its loadout chip and its pickup on the water.

import type { CardId } from '../data/abilities';

export const ICON_COLOR: Record<CardId, string> = {
  flak: '#fb923c',
  seeker: '#a3e635',
  aegis: '#5eead4',
  shrapnel: '#facc15',
  frigate: '#cbd5e1',
  thermo: '#fb7185',
  scatter: '#f0abfc',
  boomerang: '#67e8f9',
  well: '#c084fc',
  airstrike: '#60a5fa',
  railgun: '#f472b6',
  tesla: '#a5b4fc',
  // The weapons plan, phase 1.
  lance: '#fff3b0',
  cutter: '#ff4fa3',
  grapnel: '#34d399',
  cadence: '#f59e0b',
  // Phase 2 passives.
  droneScreen: '#7dd3fc',
  gunships: '#a3a380',
  bomberWing: '#9ca3af',
  orbital: '#ff6b6b',
  // Phase 3 boosts.
  supplyRun: '#86efac',
  dualWield: '#e879f9',
  wildCard: '#c4b5fd',
  focus: '#93c5fd',
  overdrive: '#fde047',
  shield: '#67e8f9',
  fullSteam: '#e2e8f0',
  resupply: '#8be38b',
}

const PATHS: Record<CardId, string> = {
  // A flak burst: a ring of shrapnel around a ragged cloud.
  flak: '<circle cx="16" cy="16" r="6"/><path d="M16 3 V7 M16 25 V29 M3 16 H7 M25 16 H29 M7 7 L10 10 M25 7 L22 10 M7 25 L10 22 M25 25 L22 22"/>',
  // Three seekers fanning out from one launch point.
  seeker: '<path d="M5 27 L13 11 M5 27 L18 17 M5 27 L24 24"/><circle cx="14" cy="9" r="2.4"/><circle cx="20" cy="16" r="2.4"/><circle cx="26" cy="24" r="2.4"/>',
  // A dome over a hull, a missile glancing off it.
  aegis: '<path d="M4 24 H28 L25 28 H7 Z"/><path d="M11 21 V10 M21 21 V10"/><path d="M8.5 12 L11 6 L13.5 12 M18.5 12 L21 6 L23.5 12"/>',
  // A burst throwing fragments out in every direction.
  shrapnel: '<circle cx="16" cy="16" r="3.5"/><path d="M16 3 V8 M16 24 V29 M3 16 H8 M24 16 H29 M7 7 L10.5 10.5 M25 7 L21.5 10.5 M7 25 L10.5 21.5 M25 25 L21.5 21.5"/><circle cx="16" cy="2.5" r="0.6"/><circle cx="29.5" cy="16" r="0.6"/>',
  // A frigate's hull with a turret and mast.
  frigate: '<path d="M3 21 H29 L25 26 H7 Z"/><path d="M10 21 V16 H19 V21 M19 18 H25 M14 16 V10 M12 12 H16"/>',
  // One big blast ring with a hot core.
  thermo: '<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="6.5"/><circle cx="16" cy="16" r="2"/>',
  // A cone of pellets from a muzzle.
  scatter: '<path d="M4 26 L9 21"/><path d="M9 21 L26 6 M9 21 L28 14 M9 21 L18 4"/><circle cx="26" cy="6" r="1.3"/><circle cx="28" cy="14" r="1.3"/><circle cx="18" cy="4" r="1.3"/>',
  // A curved blade.
  boomerang: '<path d="M6 24 Q8 8 24 6 Q14 12 12 26 Z"/>',
  // A spiral pulling inward.
  well: '<path d="M16 16 m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -10 0 a8 8 0 1 1 16 0 a11 11 0 1 1 -22 0"/>',
  // A jet seen from above, its strike line ahead.
  airstrike: '<path d="M16 4 L18 12 L27 17 L18 17 L19 24 L16 22 L13 24 L14 17 L5 17 L14 12 Z"/><path d="M16 26 V30" stroke-dasharray="1.5 2"/>',
  // A beam leaving a barrel, piercing two targets.
  railgun: '<path d="M4 26 L28 6"/><path d="M3 21 L9 27" /><circle cx="15" cy="16.8" r="2.6"/><circle cx="22" cy="11" r="2.6"/>',
  // A coil throwing a forked spark.
  tesla: '<path d="M10 28 V14 M7 18 H13 M7 22 H13 M7 26 H13"/><path d="M10 14 L14 9 L12 8 L18 3 M14 9 L20 10 L19 12 L26 13"/>',
  // A charge ring at the gun, the lance leaving it.
  lance: '<circle cx="8" cy="24" r="4.5"/><path d="M11.5 20.5 L28 4"/><path d="M23 4 H28 V9"/>',
  // A slash across the sky, sparks where it cut.
  cutter: '<path d="M3 25 Q16 21 29 6"/><path d="M10 17 L8 13 M18 13 L17 9 M24 14 L27 12"/>',
  // A cable from the gun to a hook.
  grapnel: '<path d="M3 29 L15 17"/><path d="M15 17 V7 M15 17 Q22 17 22 10 M15 17 Q8 17 8 10"/>',
  // The beat: a pulse line.
  cadence: '<path d="M2 17 H9 L12 8 L16 25 L20 11 L23 17 H30"/>',
  // Three small drones rising from a deck.
  droneScreen: '<path d="M4 28 H28"/><path d="M8 20 l3 -3 l3 3 M15 13 l3 -3 l3 3 M22 20 l3 -3 l3 3"/><path d="M11 23 V27 M18 16 V27 M25 23 V27" stroke-dasharray="1.5 2"/>',
  // A helicopter seen from above: rotor disc and tail.
  gunships: '<circle cx="13" cy="14" r="9"/><path d="M13 14 L28 26"/><path d="M5 6 L21 22 M21 6 L5 22"/><path d="M25 22 L29 26"/>',
  // A bomber's silhouette over a silo.
  bomberWing: '<path d="M16 3 V20 M4 11 L16 9 L28 11 M11 20 H21"/><circle cx="16" cy="27" r="3"/><path d="M12 24 L20 30 M20 24 L12 30"/>',
  // Three laser dots closing on a target.
  orbital: '<circle cx="16" cy="18" r="3"/><circle cx="5" cy="27" r="1.6"/><circle cx="27" cy="27" r="1.6"/><circle cx="16" cy="4" r="1.6"/><path d="M6.5 25.5 L14 19.5 M25.5 25.5 L18 19.5 M16 5.5 V15" stroke-dasharray="2 2"/>',
  supplyRun: '<rect x="10" y="17" width="12" height="10" rx="1"/><path d="M10 17 L6 8 Q16 1 26 8 L22 17 M16 17 V3"/>',
  dualWield: '<path d="M4 27 L22 9 M28 27 L10 9"/><path d="M20 5 L26 11 M12 5 L6 11"/>',
  wildCard: '<rect x="6" y="5" width="15" height="21" rx="2" transform="rotate(-10 13 15)"/><rect x="12" y="7" width="15" height="21" rx="2" transform="rotate(10 19 17)"/><path d="M19 13 L20.5 17 L24 17.5 L21 19.5 L22 23 L19 21 L16 23 L17 19.5 L14 17.5 L17.5 17 Z"/>',
  focus: '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="4"/><path d="M16 2 V7 M16 25 V30 M2 16 H7 M25 16 H30"/>',
  overdrive: '<path d="M18 3 L7 18 H15 L13 29 L25 13 H17 Z"/>',
  shield: '<path d="M16 3 L27 7 V15 C27 22 22 27 16 29 C10 27 5 22 5 15 V7 Z"/><path d="M11 16 L15 20 L21 12"/>',
  fullSteam: '<path d="M3 22 H26 L29 18 H23 V14 H11 V18 H3 Z"/><path d="M13 14 V9 M18 14 V7 M13 9 q-3 -3 0 -6 M18 7 q3 -3 0 -5"/>',
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
