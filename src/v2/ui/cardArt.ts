// Upgrade card illustrations (round 10). The player's reference was a card
// whose picture fills most of it: one bold, unmistakable image per card, in
// a frame that never changes. These are small scenes in the battlefield's own
// language — ships, interceptors, red threats, the sea — each built around
// the one thing the card does, in the card's own colour.
//
// Pure strings (no DOM), so tools can render them too. 120×76 viewBox.

import type { UpgradeId } from '../data/upgrades';
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

/** A pickup: a rounded tile with a symbol. */
const pickup = (x: number, y: number, c: string, sym: string, s = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-7" y="-7" width="14" height="14" rx="3.5" fill="#0b1a24" stroke="${c}" stroke-width="1.8"/>${sym}</g>`;

// ---- The scenes ------------------------------------------------------------

type Scene = (c: string) => string;

const SCENES: Record<UpgradeId, Scene> = {
  // An interceptor tearing across the frame, speed lines streaming behind,
  // about to catch a ballistic coming down.
  speed: (c) =>
    sea(64) +
    [14, 22, 30, 38].map((y, k) => `<path d="M${6 + k * 4} ${y + 10} H${46 + k * 6}" stroke="${c}" stroke-width="${2.2 - k * 0.3}" stroke-linecap="round" opacity="${0.9 - k * 0.15}"/>`).join('') +
    interceptor(72, 30, -14, 1.7, c) +
    threat(103, 12, 125, 1.1) +
    `<circle cx="103" cy="12" r="9" fill="none" stroke="${RED}" stroke-width="1" stroke-dasharray="2 2"/>`,

  // A rack of rounds sliding home inside a reload arrow.
  reload: (c) =>
    `<path d="M88 38 A28 28 0 1 1 79 17" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M76 8 L82 18 L71 20 Z" fill="${c}"/>` +
    [0, 1, 2, 3, 4].map((k) => `<g transform="translate(${44 + k * 8} ${k === 4 ? 30 : 38})"><rect x="-2.6" y="-11" width="5.2" height="20" rx="2.4" fill="${k === 4 ? c : INK}"/><path d="M-2.6 -7 H2.6" stroke="#0b1a24" stroke-width="1"/></g>`).join('') +
    `<path d="M76 20 V26" stroke="${c}" stroke-width="1.5" stroke-dasharray="1.5 1.5"/>`,

  // One huge shockwave ring swallowing a swarm.
  blast: (c) =>
    sea(66) +
    `<circle cx="60" cy="36" r="30" fill="${c}" opacity="0.14"/><circle cx="60" cy="36" r="30" fill="none" stroke="${c}" stroke-width="2.4"/>` +
    `<circle cx="60" cy="36" r="20" fill="none" stroke="${c}" stroke-width="1.4" opacity="0.7"/>` +
    burst(60, 36, 13, c) +
    drone(36, 22, 0.9) + drone(84, 24, 0.9) + drone(40, 50, 0.9) + drone(82, 50, 0.9) + drone(60, 8, 0.8) +
    interceptor(30, 66, -50, 0.8),

  // Kills detonating one after another, joined by sparks.
  chain: (c) =>
    `<path d="M24 46 L36 40 L34 46 L48 36" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<path d="M60 36 L72 28 L70 34 L84 24" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    burst(22, 50, 11, c) + burst(56, 38, 13, c) + burst(94, 22, 15, c) +
    drone(108, 44, 0.8) + `<path d="M98 32 L104 40" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>`,

  // Two interceptors leaving the rails together, converging on a heavy.
  twin: (c) =>
    sea(66) +
    `<g transform="translate(34 62)"><path d="M-30 0 H30 L24 8 H-26 Z" fill="${HULL}"/><path d="M-26 0 L-20 -4 H22 L26 0 Z" fill="#5d7482"/>` +
    `<path d="M-14 -2 H14" stroke="#0b1a24" stroke-width="0.8" stroke-dasharray="3 2"/><rect x="10" y="-11" width="7" height="7" rx="1" fill="${HULL}"/></g>` +
    burst(36, 56, 5, FLAME, '#fff3c4') +
    `<path d="M32 58 Q60 40 84 22" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 2" opacity="0.8"/>` +
    `<path d="M42 58 Q68 46 86 26" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 2" opacity="0.8"/>` +
    interceptor(62, 38, -38, 1.15, c) + interceptor(72, 40, -46, 1.15, c) +
    threat(96, 16, 160, 1.6) +
    `<g fill="${RED}"><rect x="88" y="6" width="3" height="2"/><rect x="92" y="6" width="3" height="2"/><rect x="96" y="6" width="3" height="2"/><rect x="100" y="6" width="3" height="2" fill="#5a6b74"/></g>`,

  // A radar sweep picking up a raid before it launches.
  radar: (c) =>
    `<circle cx="38" cy="58" r="44" fill="none" stroke="${c}" stroke-width="1" opacity="0.35"/>` +
    `<circle cx="38" cy="58" r="30" fill="none" stroke="${c}" stroke-width="1" opacity="0.45"/>` +
    `<circle cx="38" cy="58" r="16" fill="none" stroke="${c}" stroke-width="1" opacity="0.6"/>` +
    `<path d="M38 58 L80 22 A44 44 0 0 1 82 58 Z" fill="${c}" opacity="0.28"/><path d="M38 58 L80 22" stroke="${c}" stroke-width="2"/>` +
    `<circle cx="38" cy="58" r="3" fill="${c}"/>` +
    `<circle cx="70" cy="38" r="3" fill="${RED}"/><circle cx="76" cy="46" r="2.4" fill="${RED}" opacity="0.8"/><circle cx="64" cy="30" r="2" fill="${RED}" opacity="0.6"/>` +
    `<path d="M94 14 L104 30 H84 Z" fill="none" stroke="${FLAME}" stroke-width="2" stroke-linejoin="round"/><path d="M94 20 V25 M94 27.5 V28" stroke="${FLAME}" stroke-width="2" stroke-linecap="round"/>`,

  // The escort frigate on the water, an interceptor leaving its deck.
  frigate: (c) =>
    sea(58) +
    `<g transform="translate(58 56)"><path d="M-40 0 H40 L32 9 H-34 Z" fill="${c}"/><path d="M-24 0 V-7 H-4 V-14 H6 V-7 H14 V0 Z" fill="${c}" opacity="0.85"/>` +
    `<path d="M-1 -14 V-24 M-6 -20 H4" stroke="${c}" stroke-width="1.6"/><rect x="18" y="-4" width="10" height="4" fill="#1b2b35"/></g>` +
    `<path d="M80 50 Q92 34 98 14" fill="none" stroke="#c7ced6" stroke-width="2.4" opacity="0.4"/>` +
    interceptor(99, 12, -72, 1.1) + ship(18, 66, 0.55),

  // A fingertip held down, interceptors streaming out of it.
  hold: (c) =>
    `<circle cx="38" cy="48" r="9" fill="${c}" opacity="0.5"/><circle cx="38" cy="48" r="16" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.6"/>` +
    `<circle cx="38" cy="48" r="24" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.35"/>` +
    `<path d="M29 76 V53 Q29 43 37 43 Q45 43 45 53 V76" fill="#f2c9a8" stroke="#b9876a" stroke-width="1.2"/>` +
    `<path d="M32.5 53 Q32.5 46.5 37 46.5 Q41.5 46.5 41.5 53 Q41.5 55.5 37 55.5 Q32.5 55.5 32.5 53 Z" fill="#fbe3d3" stroke="#d8a487" stroke-width="0.9"/>` +
    `<path d="M30 64 Q37 66 44 64 M30 70 Q37 72 44 70" stroke="#d8a487" stroke-width="0.9" fill="none"/>` +
    interceptor(66, 34, -24, 0.9) + interceptor(82, 24, -24, 0.9) + interceptor(98, 14, -24, 0.9) +
    `<text x="104" y="40" font-size="11" font-weight="800" fill="${c}" font-family="system-ui">×3</text>`,

  // A crane hook hauling a glowing crate out of the sea.
  salvage: (c) =>
    sea(60) +
    `<path d="M8 4 H74 M20 4 V0 M62 4 V0" stroke="${HULL}" stroke-width="3"/><path d="M58 4 V28" stroke="${INK}" stroke-width="1.4"/>` +
    `<path d="M58 28 Q52 28 52 33 Q52 37 57 37" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M47 38 L58 36 L69 38" stroke="${INK}" stroke-width="1" fill="none"/>` +
    `<rect x="44" y="38" width="28" height="20" rx="2.5" fill="${c}"/><path d="M44 44 H72 M44 52 H72" stroke="#0b1a24" stroke-width="1.2" opacity="0.6"/>` +
    `<path d="M50 62 Q58 58 66 62" stroke="#7fe9ff" stroke-width="1" fill="none" opacity="0.7"/>` +
    pickup(92, 26, '#5ee08a', `<path d="M-4 0 H4 M0 -4 V4" stroke="#5ee08a" stroke-width="2"/>`, 1.1) +
    pickup(104, 46, '#7fe9ff', `<path d="M-3 -4 V4 M3 -4 V4" stroke="#7fe9ff" stroke-width="2"/>`, 0.9),

  // A pickup crackling with power, bolts flying off it.
  supercharge: (c) =>
    `<circle cx="60" cy="36" r="24" fill="${c}" opacity="0.18"/>` +
    pickup(60, 36, c, `<path d="M1.5 -5 L-3 1 H0.5 L-1.5 5.5 L3.5 -1 H0 Z" fill="${c}"/>`, 2.3) +
    `<path d="M26 14 L32 22 L28 24 L36 32" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M94 12 L88 22 L93 23 L84 32" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M92 60 L86 52 L90 50 L82 44" fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round"/>` +
    `<g transform="translate(18 50)"><rect x="0" y="0" width="16" height="9" rx="1.5" fill="none" stroke="${INK}" stroke-width="1.4"/><rect x="16" y="3" width="2" height="3" fill="${INK}"/>` +
    `<rect x="2" y="2" width="3" height="5" fill="${c}"/><rect x="6.5" y="2" width="3" height="5" fill="${c}"/><rect x="11" y="2" width="3" height="5" fill="${c}"/></g>`,

  // A magnet pulling drops across the water to the carrier.
  magnet: (c) =>
    sea(62) +
    `<g transform="translate(30 32) rotate(90)"><path d="M-12 -14 V2 A12 12 0 0 0 12 2 V-14" fill="none" stroke="${c}" stroke-width="8"/>` +
    `<path d="M-12 -14 V-8 M12 -14 V-8" stroke="${INK}" stroke-width="8"/></g>` +
    [62, 80, 98].map((x, k) => `<path d="M${x - 10} ${30 + k * 2} H${x - 18}" stroke="${c}" stroke-width="1.4" stroke-dasharray="2 2" opacity="0.8"/>`).join('') +
    pickup(62, 30, '#5ee08a', `<path d="M-4 0 H4 M0 -4 V4" stroke="#5ee08a" stroke-width="2"/>`, 0.9) +
    pickup(80, 34, '#fde047', `<path d="M1 -4 L-2 1 H1 L-1 4" stroke="#fde047" stroke-width="1.6" fill="none"/>`, 0.9) +
    pickup(98, 28, '#7fe9ff', `<path d="M-3 -4 V4 M3 -4 V4" stroke="#7fe9ff" stroke-width="2"/>`, 0.9),

  // A hull plated in armour, a missile shattering on it.
  armor: (c) =>
    sea(58) +
    `<g transform="translate(52 52)"><path d="M-34 0 H34 L27 9 H-28 Z" fill="${HULL}"/>` +
    `<path d="M-36 -2 H36 L29 11 H-30 Z" fill="none" stroke="${c}" stroke-width="2.6"/>` +
    [-24, -12, 0, 12, 24].map((x) => `<circle cx="${x}" cy="4.5" r="1.3" fill="${c}"/>`).join('') +
    `<rect x="-22" y="-8" width="30" height="8" rx="1" fill="#1b2b35"/><rect x="-20" y="-6.5" width="5" height="5" fill="#e05a4a"/><rect x="-14" y="-6.5" width="5" height="5" fill="#f5c542"/><rect x="-8" y="-6.5" width="5" height="5" fill="#5ee08a"/></g>` +
    `<path d="M50 6 L64 2 L78 6 V20 C78 30 70 36 64 38 C58 36 50 30 50 20 Z" fill="${c}" opacity="0.9"/>` +
    `<path d="M57 19 L62 25 L72 13" fill="none" stroke="#0b1a24" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
    threat(98, 26, 168, 1) + `<path d="M84 26 L88 22 M84 30 L89 32 M86 28 H91" stroke="${FLAME}" stroke-width="1.4" stroke-linecap="round"/>`,

  // A ship laying smoke; a homing missile loses it and veers off.
  smoke: (c) =>
    sea(60) +
    ship(80, 56, 1.15) +
    `<g fill="${c}"><circle cx="56" cy="48" r="9" opacity="0.85"/><circle cx="42" cy="44" r="11" opacity="0.75"/><circle cx="26" cy="47" r="10" opacity="0.6"/><circle cx="12" cy="44" r="8" opacity="0.45"/><circle cx="48" cy="36" r="7" opacity="0.7"/></g>` +
    `<path d="M108 10 Q84 18 66 26 Q54 30 46 18" fill="none" stroke="${RED}" stroke-width="1.2" stroke-dasharray="3 2.5" opacity="0.8"/>` +
    threat(46, 16, -140, 0.95) +
    `<text x="30" y="16" font-size="13" font-weight="800" fill="${RED}" font-family="system-ui">?</text>`,

  // Flares arcing off; the missile chases the brightest one.
  flares: (c) =>
    sea(62) + ship(30, 58, 1.1) +
    `<path d="M36 52 Q50 26 72 20" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.6"/><path d="M34 52 Q44 34 58 34" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.5"/>` +
    `<circle cx="72" cy="20" r="6" fill="${c}" opacity="0.35"/><circle cx="72" cy="20" r="3.2" fill="#fff3c4"/>` +
    `<circle cx="58" cy="34" r="4.5" fill="${c}" opacity="0.35"/><circle cx="58" cy="34" r="2.2" fill="#fff3c4"/>` +
    `<path d="M110 52 Q100 30 82 22" fill="none" stroke="${RED}" stroke-width="1.2" stroke-dasharray="3 2.5"/>` +
    threat(84, 21, 195, 1),

  // An interceptor's line ripped open by flak, a jet caught in it.
  flak: (c) =>
    sea(66) +
    `<path d="M10 66 L104 10" stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.7"/>` +
    interceptor(98, 14, -31, 1) +
    [[30, 54, 7], [50, 42, 8], [70, 30, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.55"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="#d6dde3" opacity="0.8"/>`).join('') +
    `<g transform="translate(52 20) rotate(14) scale(1.15)"><path d="M-16 -1.6 H9 Q15 -1 16 0 Q15 1 9 1.6 H-16 Z" fill="${RED}"/>` +
    `<path d="M-2 -1.6 L-9 -11 H-5 L5 -1.6 Z M-2 1.6 L-9 11 H-5 L5 1.6 Z" fill="${RED}"/><path d="M-14 -1.6 L-18 -7 H-15 L-11 -1.6 Z" fill="${RED}"/>` +
    `<path d="M6 -1.2 Q10 -1 12 0" stroke="#2a0a08" stroke-width="1.2" fill="none"/></g>` +
    burst(52, 25, 6, FLAME),

  // A heartbeat line; every fourth beat spits out a fresh round.
  rhythm: (c) =>
    `<path d="M4 44 H22 L28 30 L34 56 L40 44 H54 L60 30 L66 56 L72 44 H78" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>` +
    [25, 37, 57, 69].map((x, k) => `<g transform="translate(${x} ${k % 2 ? 62 : 22})">${drone(0, 0, 0.6)}<path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="${INK}" stroke-width="1.3"/></g>`).join('') +
    `<path d="M80 44 H90" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="102" cy="44" r="12" fill="${c}" opacity="0.25"/>` +
    `<rect x="99" y="31" width="6" height="22" rx="3" fill="${INK}"/><path d="M99 36 H105" stroke="#0b1a24" stroke-width="1.2"/>` +
    `<text x="92" y="20" font-size="10" font-weight="800" fill="${c}" font-family="system-ui">+1</text>`,

  // An interceptor bursting just short of a fast missile, the fuse ring around it.
  proxfuse: (c) =>
    `<circle cx="72" cy="30" r="22" fill="none" stroke="${c}" stroke-width="1.6" stroke-dasharray="4 3"/>` +
    `<circle cx="72" cy="30" r="13" fill="${c}" opacity="0.18"/>` +
    threat(80, 24, 150, 1.3) +
    interceptor(56, 42, -36, 1.15) +
    burst(66, 34, 8, c) +
    [0, 1, 2, 3].map((k) => {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      return `<path d="M${(72 + Math.cos(a) * 25).toFixed(1)} ${(30 + Math.sin(a) * 25).toFixed(1)} L${(72 + Math.cos(a) * 30).toFixed(1)} ${(30 + Math.sin(a) * 30).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
    }).join(''),

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
export function cardArtSvg(id: UpgradeId): string {
  const c = ICON_COLOR[id];
  return (
    `<svg viewBox="0 0 120 76" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="v2-card-art-svg" preserveAspectRatio="xMidYMid meet">` +
    glow(id, c) +
    SCENES[id](c) +
    `</svg>`
  );
}

export const CARD_ART_IDS = Object.keys(SCENES) as UpgradeId[];
