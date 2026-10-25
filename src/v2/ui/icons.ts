// One small line icon per upgrade card (round 3: "add images for all the
// upgrades… minimal, but things that stand out"). 32×32, drawn in the card's
// own colour so each card is recognisable at a glance on a phone.

import type { UpgradeId } from '../data/upgrades';

export const ICON_COLOR: Record<UpgradeId, string> = {
  speed: '#7fe9ff',
  reload: '#5ee08a',
  blast: '#ff8a5c',
  chain: '#ffb44f',
  twin: '#9ad1ff',
  radar: '#62f0c8',
  frigate: '#d9b38c',
  hold: '#ff9ce8',
  resupply: '#8be38b',
};

const PATHS: Record<UpgradeId, string> = {
  // An interceptor streaking up-right with speed lines.
  speed: '<path d="M12 20 L22 10 M22 10 L22 16 M22 10 L16 10"/><path d="M5 17 H10 M7 22 H12 M9 27 H14"/>',
  // A round turning in a reload arrow.
  reload: '<path d="M25 16 A9 9 0 1 1 22 9"/><path d="M22 4 V9 H27"/><path d="M16 12 V20"/>',
  // A starburst.
  blast: '<circle cx="16" cy="16" r="5"/><path d="M16 4 V8 M16 24 V28 M4 16 H8 M24 16 H28 M7.5 7.5 L10.3 10.3 M21.7 21.7 L24.5 24.5 M7.5 24.5 L10.3 21.7 M21.7 10.3 L24.5 7.5"/>',
  // Two bursts linked by a spark.
  chain: '<circle cx="9" cy="20" r="4.5"/><circle cx="23" cy="12" r="4.5"/><path d="M13 17 L16 18 L15 14 L19 15"/>',
  // Two interceptors side by side.
  twin: '<path d="M11 27 V11 L13 6 L15 11 V27 M17 27 V11 L19 6 L21 11 V27"/><path d="M9 27 H23"/>',
  // A radar sweep.
  radar: '<path d="M6 26 A20 20 0 0 1 26 6"/><path d="M11 26 A15 15 0 0 1 26 11"/><path d="M16 26 A10 10 0 0 1 26 16"/><path d="M6 26 L22 10"/><circle cx="6" cy="26" r="1.5"/>',
  // A frigate under way, an interceptor leaving its deck.
  frigate: '<path d="M3 21 H27 L24 26 H7 Z"/><path d="M10 21 V17 H17 V21 M13 17 V14"/><path d="M20 19 L26 8"/><path d="M4 29 Q8 27 12 29 T20 29"/>',
  // A finger pressing, with ripples.
  hold: '<circle cx="16" cy="12" r="3"/><circle cx="16" cy="12" r="7" opacity="0.6"/><path d="M13 15 V25 Q13 28 16 28 H19 Q22 28 22 25 V19"/>',
  // A repair cross in a crate.
  resupply: '<rect x="6" y="9" width="20" height="16" rx="2"/><path d="M16 12 V22 M11 17 H21"/>',
};

export function upgradeIcon(id: UpgradeId, size = 32): SVGSVGElement {
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
