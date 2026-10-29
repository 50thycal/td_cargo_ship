// Ability card illustrations (V3, in round 10's card style). The player's reference was a card
// whose picture fills most of it: one bold, unmistakable image per card, in
// a frame that never changes. These are small scenes in the battlefield's own
// language — ships, interceptors, red threats, the sea — each built around
// the one thing the card does, in the card's own colour.
//
// Pure strings (no DOM), so tools can render them too. 120×76 viewBox.

import type { CardId } from '../data/abilities';
import { ICON_COLOR } from './icons';

const INK = '#f4f1e8';
const HULL = '#8fa6b4';
const RED = '#ff4d3d';
const SEA = '#0f2c3c';
const SEA_LINE = '#2b5a70';
const FLAME = '#ffb44f';

// ---- Shared pieces ---------------------------------------------------------

/** The sea along the bottom, with a wave line. */
const sea = (y = 60): string =>
  `<path d="M0 ${y} Q15 ${y - 2.5} 30 ${y} T60 ${y} T90 ${y} T120 ${y} V76 H0 Z" fill="${SEA}"/>` +
  `<path d="M0 ${y} Q15 ${y - 2.5} 30 ${y} T60 ${y} T90 ${y} T120 ${y}" fill="none" stroke="${SEA_LINE}" stroke-width="1.2"/>`;

/** A container ship (the convoy), bow to the right. */
const ship = (x: number, y: number, s = 1, hull = HULL): string =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M-15 0 H15 L11 5 H-12 Z" fill="${hull}"/>` +
  `<rect x="-11" y="-4.5" width="15" height="4.5" rx="0.8" fill="#1b2b35"/>` +
  `<rect x="-10" y="-3.8" width="3" height="3" fill="#e05a4a"/><rect x="-6.5" y="-3.8" width="3" height="3" fill="#f5c542"/>` +
  `<rect x="-3" y="-3.8" width="3" height="3" fill="#5ee08a"/><rect x="0.5" y="-3.8" width="3" height="3" fill="#7fe9ff"/>` +
  `<rect x="6" y="-6" width="4" height="6" rx="0.6" fill="${hull}"/></g>`;

/** An interceptor (ours), nose along +x before rotation. */
const interceptor = (x: number, y: number, deg: number, s = 1, body = INK): string =>
  `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})">` +
  `<path d="M-13 0 Q-21 0 -25 -1.6 Q-21 1.6 -13 0" fill="${FLAME}" opacity="0.9"/>` +
  `<path d="M-11 -1.8 H6 L10 0 L6 1.8 H-11 Z" fill="${body}"/>` +
  `<path d="M-11 -1.8 L-14 -4.2 L-9 -1.8 M-11 1.8 L-14 4.2 L-9 1.8" fill="${body}" stroke="${body}" stroke-width="0.8"/></g>`;

/** A hostile missile (red), nose along +x before rotation. */
const threat = (x: number, y: number, deg: number, s = 1): string =>
  `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})">` +
  `<path d="M-12 0 Q-19 0 -22 -1.4 Q-19 1.4 -12 0" fill="#ff8a5c" opacity="0.8"/>` +
  `<path d="M-10 -2 H5 L10 0 L5 2 H-10 Z" fill="${RED}"/>` +
  `<path d="M-10 -2 L-13 -4.5 L-8 -2 M-10 2 L-13 4.5 L-8 2" fill="${RED}" stroke="${RED}" stroke-width="0.8"/></g>`;

/** A hostile drone: red diamond with rotor bar. */
const drone = (x: number, y: number, s = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${s})">` +
  `<path d="M-7 -1 H7" stroke="${RED}" stroke-width="1.4" stroke-linecap="round"/>` +
  `<path d="M0 -4.5 L4.5 0 L0 4.5 L-4.5 0 Z" fill="${RED}"/><circle cx="0" cy="0" r="1.3" fill="#2a0a08"/></g>`;

/** A starburst explosion. */
const burst = (x: number, y: number, r: number, c: string, core = INK): string => {
  const pts: string[] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    const rr = k % 2 ? r * 0.45 : r;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${(r * 0.32).toFixed(1)}" fill="${core}"/>`;
};

/** A soft glow behind the scene, in the card's colour. */
const glow = (id: string, c: string, cx = 60, cy = 34, r = 52): string =>
  `<defs><radialGradient id="g-${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">` +
  `<stop offset="0" stop-color="${c}" stop-opacity="0.42"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="120" height="76" fill="url(#g-${id})"/>`;

// ---- The scenes ------------------------------------------------------------

type Scene = (c: string) => string;

/** A friendly jet from above, nose along +x. */
const jet = (x: number, y: number, deg: number, s = 1, c = '#bfdbfe'): string =>
  `<g transform="translate(${x} ${y}) rotate(${deg}) scale(${s})">` +
  `<path d="M10 0 L2 -2 L-4 -10 L-7 -10 L-4 -2 L-9 -2 L-11 -5 L-13 -5 L-12 0 L-13 5 L-11 5 L-9 2 L-4 2 L-7 10 L-4 10 L2 2 Z" fill="${c}"/>` +
  `<circle cx="-4" cy="-6" r="1.4" fill="#2563eb"/><circle cx="-4" cy="6" r="1.4" fill="#2563eb"/></g>`;

/** A submarine surfaced, periscope up. */
const sub = (x: number, y: number, s = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-16 0 Q-16 -5 -10 -5 H12 Q17 -5 17 0 Q17 3 12 3 H-10 Q-16 3 -16 0 Z" fill="#3b4a54"/>` +
  `<rect x="-3" y="-10" width="7" height="6" rx="1.5" fill="#3b4a54"/><path d="M1 -10 V-15 H4" stroke="#3b4a54" stroke-width="1.4" fill="none"/></g>`;

const SCENES: Record<CardId, Scene> = {
  // A violet pulse ring sweeping out from the carrier, a swarm frying in it.
  emp: (c) =>
    sea(66) +
    `<rect x="40" y="58" width="40" height="6" rx="3" fill="${HULL}"/>` +
    `<circle cx="60" cy="58" r="44" fill="none" stroke="${c}" stroke-width="3" opacity="0.9"/>` +
    `<circle cx="60" cy="58" r="30" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.6"/>` +
    [[24, 24], [40, 14], [78, 12], [98, 26], [60, 22]].map(([x, y]) => drone(x, y, 1) + `<path d="M${x - 5} ${y - 6} L${x - 2} ${y - 2} L${x - 5} ${y + 1} L${x - 1} ${y + 5}" stroke="${c}" stroke-width="1.2" fill="none"/>`).join(''),

  // Jets screaming along a dashed strike line, threats bursting under them.
  airstrike: (c) =>
    sea(64) +
    `<path d="M4 36 H116" stroke="${c}" stroke-width="1.6" stroke-dasharray="6 4"/>` +
    `<rect x="0" y="26" width="120" height="20" fill="${c}" opacity="0.12"/>` +
    jet(30, 36, 0, 1.3) + jet(8, 22, 0, 0.9) +
    burst(66, 36, 8, FLAME) + burst(92, 34, 7, FLAME) + threat(108, 38, 180, 0.9) +
    ship(60, 60, 0.7),

  // A white-hot beam from the carrier piercing a line of threats to a heavy.
  railgun: (c) =>
    sea(66) +
    `<rect x="6" y="58" width="34" height="6" rx="3" fill="${HULL}"/>` +
    `<path d="M22 58 L116 10" stroke="${c}" stroke-width="8" stroke-linecap="round" opacity="0.5"/>` +
    `<path d="M22 58 L116 10" stroke="#fff5fa" stroke-width="2.5" stroke-linecap="round"/>` +
    burst(52, 43, 6, c) + burst(76, 30, 7, c) +
    `<g transform="translate(100 18) rotate(150)"><rect x="-10" y="-4" width="20" height="8" rx="4" fill="${RED}"/></g>` + burst(100, 18, 9, FLAME),

  // A tap's burst throwing forked bolts to three drones around it.
  tesla: (c) =>
    burst(56, 38, 8, c) +
    [[22, 18], [96, 20], [86, 60], [26, 58]].map(([x, y], k) => {
      const mx = (56 + x) / 2 + (k % 2 ? 6 : -6);
      const my = (38 + y) / 2 + (k % 2 ? -5 : 5);
      return `<path d="M56 38 L${mx} ${my} L${(mx + x) / 2 + 4} ${(my + y) / 2 - 3} L${x} ${y}" stroke="${c}" stroke-width="2" fill="none" stroke-linejoin="round"/>` + drone(x, y, 1);
    }).join(''),

  // Missiles peeling off toward burning decoys high over the convoy.
  decoy: (c) =>
    sea(66) + ship(60, 62, 0.8) +
    `<path d="M10 20 Q40 26 52 46" fill="none" stroke="${RED}" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/>` +
    `<path d="M110 22 Q84 30 70 46" fill="none" stroke="${RED}" stroke-width="1" stroke-dasharray="3 2" opacity="0.5"/>` +
    threat(34, 22, -40, 0.9) + threat(88, 22, 220, 0.9) +
    `<circle cx="24" cy="10" r="5" fill="${c}"/><circle cx="24" cy="10" r="9" fill="${c}" opacity="0.3"/>` +
    `<circle cx="98" cy="10" r="5" fill="${c}"/><circle cx="98" cy="10" r="9" fill="${c}" opacity="0.3"/>` +
    `<path d="M60 56 Q42 30 24 12 M60 56 Q80 30 98 12" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.7"/>`,

  // A wall of smoke laid along the lane, missiles flying blind past it.
  smoke: (c) =>
    sea(66) + ship(36, 56, 0.8) + ship(78, 56, 0.8) +
    [12, 26, 40, 54, 68, 82, 96, 110].map((x, k) => `<circle cx="${x}" cy="${46 + (k % 2) * 4}" r="${10 + (k % 3) * 2}" fill="${c}" opacity="0.62"/>`).join('') +
    threat(40, 14, 10, 1) + `<path d="M18 12 Q30 13 40 14" stroke="${RED}" stroke-width="1" stroke-dasharray="2 2" fill="none"/>` +
    `<text x="58" y="20" font-size="10" font-weight="800" fill="${INK}" font-family="system-ui">?</text>`,

  // Rockets raining into a target ring around a swarm.
  salvo: (c) =>
    sea(68) +
    `<circle cx="70" cy="46" r="20" fill="${c}" opacity="0.14"/><circle cx="70" cy="46" r="20" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="4 3"/>` +
    [[22, 6, 50], [36, 4, 58], [50, 6, 64], [64, 2, 72]].map(([x, y, d]) => `<path d="M${x - 10} ${y - 4} L${x} ${y}" stroke="${FLAME}" stroke-width="2" opacity="0.7"/>` + interceptor(x, y, d, 0.7, c)).join('') +
    burst(62, 44, 6, FLAME) + burst(78, 50, 5, FLAME) + drone(70, 36, 0.9) + drone(84, 42, 0.9),

  // A crosshair over a surfaced sub, a torpedo running in.
  hunter: (c) =>
    sea(40) + sub(70, 50, 1.3) +
    `<circle cx="70" cy="46" r="20" fill="none" stroke="${c}" stroke-width="2"/>` +
    `<path d="M70 20 V30 M70 62 V72 M44 46 H54 M86 46 H96" stroke="${c}" stroke-width="2"/>` +
    `<path d="M12 60 L40 54" stroke="${INK}" stroke-width="1.2" stroke-dasharray="3 2"/><rect x="38" y="52" width="9" height="3" rx="1.5" fill="${INK}"/>`,

  // A supply crate with a repair cross, wrench across it, the convoy mended.
  resupply: (c) =>
    sea(64) + ship(24, 60, 0.75) + ship(98, 60, 0.75) +
    `<text x="20" y="44" font-size="11" font-weight="800" fill="${c}" font-family="system-ui">+</text><text x="94" y="44" font-size="11" font-weight="800" fill="${c}" font-family="system-ui">+</text>` +
    `<rect x="40" y="18" width="40" height="32" rx="4" fill="#1b3a22" stroke="${c}" stroke-width="2"/>` +
    `<path d="M40 28 H80" stroke="${c}" stroke-width="1.2" opacity="0.6"/>` +
    `<path d="M60 31 V47 M52 39 H68" stroke="${c}" stroke-width="4" stroke-linecap="round"/>` +
    `<g transform="translate(78 16) rotate(40)"><rect x="-2" y="0" width="4" height="16" rx="1.5" fill="${INK}"/><path d="M-5 0 A5 5 0 1 1 5 0 L2 -3 H-2 Z" fill="${INK}"/></g>`,
};

/** The card's illustration as an SVG string. */
export function cardArtSvg(id: CardId): string {
  const c = ICON_COLOR[id];
  return (
    `<svg viewBox="0 0 120 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="v2-card-art-svg" preserveAspectRatio="xMidYMid meet">` +
    glow(id, c) +
    SCENES[id](c) +
    `</svg>`
  );
}

export const CARD_ART_IDS = Object.keys(SCENES) as CardId[];
