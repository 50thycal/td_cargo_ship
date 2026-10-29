// One small line icon per ability (and Resupply), 32×32, drawn in the
// ability's own colour so each one is recognisable at a glance on a phone —
// on its draft card, its loadout chip and its button.

import type { CardId } from '../data/abilities';

export const ICON_COLOR: Record<CardId, string> = {
  emp: '#c084fc',
  airstrike: '#60a5fa',
  railgun: '#f472b6',
  tesla: '#a5b4fc',
  decoy: '#fb923c',
  smoke: '#c7ced6',
  salvo: '#ffb44f',
  hunter: '#5eead4',
  resupply: '#8be38b',
};

const PATHS: Record<CardId, string> = {
  // A pulse ring around a lightning bolt.
  emp: '<circle cx="16" cy="16" r="12" stroke-dasharray="4 3"/><path d="M18 7 L11 17 H16 L14 25 L21 14 H16 Z"/>',
  // A jet seen from above, its strike line ahead.
  airstrike: '<path d="M16 4 L18 12 L27 17 L18 17 L19 24 L16 22 L13 24 L14 17 L5 17 L14 12 Z"/><path d="M16 26 V30" stroke-dasharray="1.5 2"/>',
  // A beam leaving a barrel, piercing two targets.
  railgun: '<path d="M4 26 L28 6"/><path d="M3 21 L9 27" /><circle cx="15" cy="16.8" r="2.6"/><circle cx="22" cy="11" r="2.6"/>',
  // A coil throwing a forked spark.
  tesla: '<path d="M10 28 V14 M7 18 H13 M7 22 H13 M7 26 H13"/><path d="M10 14 L14 9 L12 8 L18 3 M14 9 L20 10 L19 12 L26 13"/>',
  // A missile's path bent off toward a burning decoy.
  decoy: '<circle cx="23" cy="9" r="3"/><path d="M23 2 V4 M23 14 V16 M16 9 H18 M28 9 H30"/><path d="M4 27 Q8 17 18 12" stroke-dasharray="2.5 3"/>',
  // A wall of smoke clouds along a line.
  smoke: '<circle cx="8" cy="18" r="4.5"/><circle cx="15" cy="14" r="5.5"/><circle cx="23" cy="17" r="5"/><path d="M3 26 H29" stroke-dasharray="3 2.5"/>',
  // Rockets raining on a target ring.
  salvo: '<circle cx="16" cy="22" r="7"/><path d="M8 4 L13 14 M16 3 V14 M24 4 L19 14"/>',
  // A periscope under a crosshair.
  hunter: '<circle cx="16" cy="16" r="10"/><path d="M16 2 V8 M16 24 V30 M2 16 H8 M24 16 H30"/><path d="M14 20 V13 H19"/>',
  // A repair cross in a crate.
  resupply: '<rect x="6" y="9" width="20" height="16" rx="2"/><path d="M16 12 V22 M11 17 H21"/>',
};

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
