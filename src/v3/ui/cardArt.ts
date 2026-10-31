// Weapon card illustrations (V3, in round 10's card style). The player's reference was a card
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

const SCENES: Record<CardId, Scene> = {
  // A ragged flak cloud hanging in the air, drones bursting as they fly in.
  flak: (c) =>
    sea(66) + ship(60, 62, 0.75) +
    [[52, 30, 14], [66, 26, 12], [60, 38, 11], [74, 36, 9], [46, 40, 8]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.32"/>`).join('') +
    [[48, 24], [70, 22], [58, 34], [76, 40], [42, 38], [64, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${INK}"/>`).join('') +
    burst(56, 30, 7, c) + burst(72, 38, 6, FLAME) + drone(30, 28, 1) + drone(96, 22, 1) + drone(88, 36, 0.9),

  // One launch splitting into seekers that curve off to separate threats.
  seeker: (c) =>
    sea(68) +
    `<rect x="44" y="60" width="32" height="6" rx="3" fill="${HULL}"/>` +
    [[18, 14], [60, 8], [102, 16]].map(([x, y], k) => {
      const mx = k === 1 ? 60 : 60 + (x - 60) * 0.3;
      return `<path d="M60 60 Q${mx} 34 ${x} ${y + 8}" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 2"/>` + interceptor(x, y + 8, k === 0 ? -120 : k === 1 ? -90 : -60, 0.7, c) + threat(x, y - 2, k === 0 ? 30 : k === 1 ? 90 : 150, 0.8);
    }).join(''),

  // A shield dome over a ship, missiles bursting harmlessly on its skin.
  aegis: (c) =>
    sea(64) +
    `<path d="M24 60 A36 32 0 0 1 96 60" fill="${c}" opacity="0.16"/>` +
    `<path d="M24 60 A36 32 0 0 1 96 60" fill="none" stroke="${c}" stroke-width="2.4"/>` +
    `<path d="M34 60 A26 23 0 0 1 86 60" fill="none" stroke="${c}" stroke-width="1" opacity="0.5" stroke-dasharray="3 3"/>` +
    ship(60, 60, 0.9) +
    burst(40, 36, 7, c) + burst(80, 32, 6, c) +
    threat(18, 18, 40, 0.9) + threat(104, 14, 140, 0.9) +
    `<path d="M24 22 L36 33 M98 18 L84 29" stroke="${RED}" stroke-width="1" stroke-dasharray="2 2" opacity="0.6"/>`,

  // A vortex dragging missiles and drones into its eye.
  well: (c) =>
    sea(68) +
    `<path d="M60 36 m-3 0 a3 3 0 1 1 6 0 a8 8 0 1 1 -16 0 a14 14 0 1 1 28 0 a20 20 0 1 1 -40 0 a26 26 0 1 1 52 0" fill="none" stroke="${c}" stroke-width="1.8" opacity="0.85"/>` +
    `<circle cx="60" cy="36" r="5" fill="${INK}"/>` +
    threat(20, 18, 30, 0.8) + threat(102, 54, 200, 0.8) + drone(98, 14, 0.9) + drone(22, 56, 0.9) +
    `<path d="M28 22 Q44 28 52 34 M94 50 Q78 44 68 38 M92 18 Q78 26 66 32 M28 52 Q42 44 54 38" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 2" opacity="0.7"/>`,

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

  // A shell bursting into fragments that streak out at drones all round.
  shrapnel: (c) =>
    sea(66) + ship(60, 62, 0.7) +
    Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2 + 0.2;
      return `<path d="M60 32 L${(60 + Math.cos(a) * 34).toFixed(1)} ${(32 + Math.sin(a) * 26).toFixed(1)}" stroke="${c}" stroke-width="1.6" stroke-linecap="round" opacity="0.85"/>`;
    }).join('') +
    burst(60, 32, 8, c) + drone(24, 20, 0.9) + drone(98, 24, 0.9) + drone(86, 50, 0.8) + drone(30, 46, 0.8) +
    burst(24, 20, 4, FLAME) + burst(98, 24, 4, FLAME),

  // Two warships on station, guns firing up at incoming threats.
  frigate: (c) =>
    sea(60) +
    [[34, 58], [86, 56]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M-18 0 H18 L13 5 H-14 Z" fill="${c}"/><rect x="-8" y="-6" width="11" height="6" rx="1" fill="${c}"/><rect x="-3" y="-11" width="2" height="5" fill="${c}"/></g>`).join('') +
    `<path d="M38 50 L52 22 M90 48 L76 18" stroke="${INK}" stroke-width="1" stroke-dasharray="2 2"/>` +
    threat(54, 18, -60, 0.8) + threat(74, 14, -120, 0.8) + burst(54, 18, 5, FLAME),

  // One huge blast swallowing a whole pack.
  thermo: (c) =>
    sea(66) + ship(26, 62, 0.6) + ship(96, 62, 0.6) +
    `<circle cx="60" cy="32" r="28" fill="${c}" opacity="0.22"/><circle cx="60" cy="32" r="28" fill="none" stroke="${c}" stroke-width="2.2"/>` +
    `<circle cx="60" cy="32" r="16" fill="${FLAME}" opacity="0.5"/>` + burst(60, 32, 11, FLAME) +
    drone(44, 22, 0.8) + drone(78, 26, 0.8) + drone(52, 46, 0.8) + drone(72, 44, 0.8),

  // A short cone of pellets from the carrier's gun into close threats.
  scatter: (c) =>
    sea(66) +
    `<rect x="10" y="58" width="34" height="6" rx="3" fill="${HULL}"/>` +
    `<path d="M30 57 L84 18 L98 42 Z" fill="${c}" opacity="0.16"/>` +
    [[84, 18], [90, 26], [95, 34], [98, 42], [78, 22]].map(([x, y]) => `<path d="M30 57 L${x} ${y}" stroke="${c}" stroke-width="1.3" stroke-dasharray="3 3"/><circle cx="${x}" cy="${y}" r="1.8" fill="${c}"/>`).join('') +
    drone(86, 24, 0.9) + burst(86, 24, 5, FLAME) + threat(96, 38, 200, 0.8),

  // A spinning blade on its way out and back past a line of drones.
  boomerang: (c) =>
    sea(66) +
    `<rect x="8" y="58" width="34" height="6" rx="3" fill="${HULL}"/>` +
    `<path d="M26 56 Q60 2 100 22 Q70 36 26 56" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3"/>` +
    `<g transform="translate(96 22) rotate(-30)"><path d="M-9 6 Q-8 -8 8 -9 Q-2 -3 -3 9 Z" fill="${c}"/></g>` +
    drone(50, 26, 0.9) + drone(66, 20, 0.9) + drone(80, 18, 0.9) + burst(50, 26, 4, FLAME) + burst(66, 20, 4, FLAME),

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
