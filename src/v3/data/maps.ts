// The maps. Each one is a single screen: land to draw, enemy launch bases,
// where the carrier is anchored, and the channel(s) the convoy sails. Ships
// ride fixed lanes inside a channel; there is no navigation.
//
// The original five live here; the fifteen added by the 20-map plan
// (docs/design/v3-maps-plan.md) are in maps20.ts. MAP_ORDER is the order
// they unlock in: four chapters of five.

import { bypass, curve, islet, lens, shore } from './geo';
import type { BaseDef, MapDef, MapId } from './mapTypes';
import { NEW_MAPS } from './maps20';

export * from './mapTypes';

const STRAIT_BASES: BaseDef[] = [
  { x: 260, y: 112, kinds: ['drone', 'supersonic'] },
  { x: 800, y: 100, kinds: ['drone', 'ballistic', 'heavy'] },
  { x: 1340, y: 112, kinds: ['drone', 'guided', 'ballistic', 'supersonic'] },
];
const GAUNTLET_BASES: BaseDef[] = [
  { x: 300, y: 100, kinds: ['drone'] },
  { x: 1100, y: 95, kinds: ['drone', 'ballistic', 'supersonic'] },
  { x: 520, y: 815, kinds: ['drone', 'guided'] },
  { x: 1300, y: 815, kinds: ['ballistic', 'guided', 'heavy'] },
];
const ISLAND_BASES: BaseDef[] = [
  { x: 540, y: 362, kinds: ['drone', 'guided', 'cluster'] },
  { x: 1060, y: 362, kinds: ['drone', 'ballistic'] },
  { x: 300, y: 70, kinds: ['ballistic', 'supersonic', 'heavy'] },
  { x: 800, y: 62, kinds: ['drone', 'ballistic'] },
  { x: 1300, y: 70, kinds: ['guided', 'supersonic', 'cluster'] },
];
const ARCHIPELAGO_BASES: BaseDef[] = [
  { x: 330, y: 330, kinds: ['drone', 'mothership', 'cluster'] },
  { x: 800, y: 315, kinds: ['drone', 'guided', 'heavy'] },
  { x: 1270, y: 330, kinds: ['drone', 'guided', 'supersonic'] },
  { x: 560, y: 75, kinds: ['ballistic', 'heavy', 'mothership'] },
  { x: 1050, y: 75, kinds: ['ballistic', 'supersonic', 'cluster'] },
];
const HARBOR_BASES: BaseDef[] = [
  { x: 300, y: 80, kinds: ['drone', 'ballistic', 'mothership'] },
  { x: 1180, y: 170, kinds: ['drone', 'supersonic', 'cluster'] },
  { x: 1450, y: 210, kinds: ['ballistic', 'guided', 'heavy'] },
  { x: 1300, y: 790, kinds: ['drone', 'guided', 'supersonic'] },
  { x: 1500, y: 740, kinds: ['ballistic', 'heavy', 'cluster'] },
];

const FIRST_FIVE: Record<'strait' | 'gauntlet' | 'island' | 'archipelago' | 'harbor', MapDef> = {
  strait: {
    id: 'strait',
    name: 'The Strait',
    blurb: 'Enemy on the north shore. Long warning times. Learn the threats.',
    land: [
      { side: 'enemy', points: shore('top', 160, 16, 0.4) },
      { side: 'friendly', points: shore('bottom', 790, 12, 1.7) },
    ],
    bases: STRAIT_BASES,
    carrier: { x: 800, y: 705 },
    frigate: { x: 580, y: 700 },
    channels: [{ y: 470, halfWidth: 150 }],
    threatScale: 1.15,
    // Round 3: careful play lost ~0.5 ships here; a late taste of supersonics
    // and one heavy in the finale tests reaction, not just ammo.
    extras: [
      { kind: 'supersonic', from: 6, count: 1, growth: 0.34 },
      { kind: 'heavy', from: 10, count: 1, growth: 0 },
    ],
    callout: { x: 800, y: 845 },
    alerts: { x0: 170, x1: 1430, y: 888 },
    roads: {
      runners: [bypass([{ x: -60, y: 124 }, { x: 400, y: 120 }, { x: 800, y: 130 }, { x: 1200, y: 122 }, { x: 1660, y: 124 }], STRAIT_BASES, -1)],
      popups: [
        { from: { x: 540, y: -40 }, to: { x: 540, y: 128 } },
        { from: { x: 1070, y: -40 }, to: { x: 1070, y: 130 } },
        { from: { x: 1520, y: -40 }, to: { x: 1520, y: 124 } },
      ],
    },
    subSpots: [{ x: 420, y: 250 }, { x: 1180, y: 245 }, { x: 1520, y: 250 }, { x: 260, y: 690 }, { x: 1350, y: 700 }, { x: 1100, y: 705 }],
    bomberLines: [240, 672],
    vectors: { trucks: 2, subs: 3, strafers: 5, bombers: 7 },
  },
  gauntlet: {
    id: 'gauntlet',
    name: 'The Gauntlet',
    blurb: 'Enemy on both shores. Your carrier holds the middle; ships pass either side.',
    land: [
      { side: 'enemy', points: shore('top', 150, 14, 2.2) },
      { side: 'enemy', points: shore('bottom', 760, 14, 0.9) },
      { side: 'friendly', points: islet(120, 450, 42) },
    ],
    bases: GAUNTLET_BASES,
    carrier: { x: 800, y: 450 },
    frigate: { x: 1040, y: 455 },
    channels: [
      { y: 295, halfWidth: 90 },
      { y: 605, halfWidth: 90 },
    ],
    threatScale: 1.2,
    extras: [
      { kind: 'heavy', from: 5, count: 1, growth: 0.17 },
      { kind: 'supersonic', from: 7, count: 1, growth: 0.34 },
    ],
    // Bottom of the screen like every other map (round 5: mid-channel sat on
    // the action), between the two south-shore bases.
    callout: { x: 910, y: 865 },
    // Only room for one card between the two south-shore silos.
    alerts: { x0: 566, x1: 1254, y: 890, max: 1 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 118 }, { x: 800, y: 112 }, { x: 1660, y: 118 }], GAUNTLET_BASES.slice(0, 2), -1),
        bypass([{ x: 1660, y: 800 }, { x: 800, y: 805 }, { x: -60, y: 800 }], GAUNTLET_BASES.slice(2), 1),
      ],
      popups: [
        { from: { x: 700, y: -40 }, to: { x: 700, y: 122 } },
        { from: { x: 1450, y: -40 }, to: { x: 1450, y: 120 } },
        { from: { x: 200, y: 940 }, to: { x: 200, y: 788 } },
        { from: { x: 900, y: 940 }, to: { x: 900, y: 790 } },
      ],
    },
    subSpots: [{ x: 330, y: 450 }, { x: 1300, y: 450 }, { x: 1480, y: 450 }],
    bomberLines: [450],
    vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  },
  island: {
    id: 'island',
    name: 'The Island',
    blurb: 'The enemy holds the island AND the far shore. Island fire gives you almost no warning.',
    land: [
      { side: 'enemy', points: shore('top', 110, 12, 1.1) },
      { side: 'enemy', points: lens(330, 1270, 360, 95), hill: true },
      { side: 'friendly', points: shore('bottom', 805, 10, 2.9) },
    ],
    bases: ISLAND_BASES,
    carrier: { x: 800, y: 760 },
    frigate: { x: 560, y: 760 },
    // Round 7: a second lane north of the island (the player: ships only ever
    // took the south). It runs between the far shore and the island, far from
    // the carrier, so it is the risky route: it carries one group in three,
    // and they make a fast run for it.
    channels: [
      { y: 600, halfWidth: 100, share: 2 },
      { y: 190, halfWidth: 66, speed: 1.5 },
    ],
    // Round 13: the player never cleared it (0 of 7 runs), nor did the you-bot
    // (2-3 of 30): a little less fire, and its extra threats come two waves
    // later, so the mid-game (waves 5-8, where it was lost) eases. The you-bot
    // now clears ~30%, the try-hard bot ~60% (docs/design/v2-island-round13.md).
    threatScale: 0.95,
    extras: [
      { kind: 'supersonic', from: 6, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 7, count: 1, growth: 0.2 },
      { kind: 'cluster', from: 8, count: 1, growth: 0.34 },
    ],
    callout: { x: 800, y: 855 },
    // The carrier sits close to the shore here, with the frigate and two
    // sub spots beside it: one wide (so short) card at a time, low down.
    alerts: { x0: 170, x1: 1430, y: 896, max: 1 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 82 }, { x: 800, y: 78 }, { x: 1660, y: 82 }], ISLAND_BASES.slice(2), -1),
        // Round 13: the island road runs along its south flank, from a tunnel
        // in the west of the hill to one in the east, clear of both bases.
        [
          { x: 492, y: 388 },
          { x: 570, y: 412 },
          { x: 800, y: 426 },
          { x: 1030, y: 412 },
          { x: 1108, y: 388 },
        ],
      ],
      popups: [
        { from: { x: 560, y: -40 }, to: { x: 560, y: 90 } },
        { from: { x: 1060, y: -40 }, to: { x: 1060, y: 90 } },
        // Out of caves in the hillside, across the road, down to the shore.
        { from: { x: 700, y: 376 }, to: { x: 700, y: 444 } },
        { from: { x: 930, y: 376 }, to: { x: 930, y: 446 } },
      ],
    },
    subSpots: [{ x: 180, y: 380 }, { x: 1430, y: 380 }, { x: 300, y: 748 }, { x: 1300, y: 748 }],
    bomberLines: [480, 745],
    vectors: { trucks: 1, subs: 3, strafers: 4, bombers: 5 },
  },
  archipelago: {
    id: 'archipelago',
    name: 'The Archipelago',
    blurb: 'Enemy islets with gaps between them, and drone motherships. The west end is a long reach from the carrier.',
    land: [
      { side: 'enemy', points: shore('top', 120, 12, 0.7) },
      { side: 'enemy', points: islet(330, 330, 62) },
      { side: 'enemy', points: islet(800, 315, 70) },
      { side: 'enemy', points: islet(1270, 330, 58) },
      { side: 'friendly', points: shore('bottom', 805, 12, 2.2) },
    ],
    bases: ARCHIPELAGO_BASES,
    carrier: { x: 950, y: 730 },
    frigate: { x: 1190, y: 735 },
    channels: [{ y: 575, halfWidth: 100 }],
    threatScale: 1.05,
    extras: [
      { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
      { kind: 'heavy', from: 6, count: 1, growth: 0.17 },
      { kind: 'cluster', from: 7, count: 1, growth: 0.25 },
      { kind: 'supersonic', from: 8, count: 1, growth: 0.25 },
    ],
    callout: { x: 700, y: 855 },
    alerts: { x0: 170, x1: 1430, y: 890 },
    roads: {
      runners: [bypass([{ x: -60, y: 92 }, { x: 800, y: 88 }, { x: 1660, y: 92 }], ARCHIPELAGO_BASES.slice(3), -1)],
      popups: [
        // Round 13: out of a cave beside each islet's silo (they used to
        // start on the silo itself), down to the water.
        { from: { x: 374, y: 346 }, to: { x: 376, y: 386 } },
        { from: { x: 846, y: 332 }, to: { x: 848, y: 378 } },
        { from: { x: 1312, y: 346 }, to: { x: 1314, y: 382 } },
        { from: { x: 300, y: -40 }, to: { x: 300, y: 100 } },
        { from: { x: 1500, y: -40 }, to: { x: 1500, y: 100 } },
      ],
    },
    subSpots: [{ x: 565, y: 335 }, { x: 1035, y: 335 }, { x: 120, y: 335 }, { x: 1500, y: 335 }, { x: 500, y: 742 }, { x: 1490, y: 742 }],
    bomberLines: [205, 745],
    vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 4 },
  },
  harbor: {
    id: 'harbor',
    name: 'Harbor Mouth',
    blurb: 'The channel funnels into the harbour under enemy headlands. The worst of it comes right before delivery.',
    land: [
      { side: 'enemy', points: [{ x: 0, y: 0 }, ...curve(0, 140, 1600, 300, 0.4), { x: 1600, y: 0 }] },
      { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 800, 1050, 770, 1.6), { x: 1050, y: 900 }] },
      { side: 'enemy', points: [{ x: 1050, y: 900 }, ...curve(1050, 770, 1600, 640, 2.4), { x: 1600, y: 900 }] },
    ],
    bases: HARBOR_BASES,
    carrier: { x: 900, y: 690 },
    frigate: { x: 660, y: 690 },
    channels: [{ y: 470, halfWidth: 150, narrow: { fromX: 700, halfWidth: 66 } }],
    threatScale: 1.0,
    extras: [
      { kind: 'supersonic', from: 4, count: 1, growth: 0.2 },
      { kind: 'heavy', from: 5, count: 1, growth: 0.15 },
      { kind: 'cluster', from: 6, count: 1, growth: 0.2 },
      { kind: 'mothership', from: 7, count: 1, growth: 0.15 },
    ],
    callout: { x: 380, y: 855 },
    alerts: { x0: 30, x1: 1030, y: 890 },
    roads: {
      runners: [
        bypass([{ x: -60, y: 100 }, { x: 400, y: 140 }, { x: 800, y: 180 }, { x: 1200, y: 222 }, { x: 1660, y: 262 }], HARBOR_BASES.slice(0, 3), -1),
        bypass([{ x: 1660, y: 690 }, { x: 1350, y: 762 }, { x: 1090, y: 822 }], HARBOR_BASES.slice(3), 1),
      ],
      popups: [
        { from: { x: 600, y: -40 }, to: { x: 600, y: 165 } },
        { from: { x: 1000, y: -40 }, to: { x: 1000, y: 214 } },
        { from: { x: 1250, y: 940 }, to: { x: 1250, y: 765 } },
      ],
    },
    subSpots: [{ x: 250, y: 250 }, { x: 1450, y: 345 }, { x: 300, y: 705 }],
    bomberLines: [255, 715],
    vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 4 },
  },
};

export const MAPS: Record<MapId, MapDef> = { ...FIRST_FIVE, ...NEW_MAPS };

/** The unlock order (the player's review of the plan: the Gauntlet at 4, the
 *  Island at 6, so the two island maps aren't back to back). */
export const MAP_ORDER: MapId[] = [
  'strait', 'kesh', 'marrow', 'gauntlet', 'harbor',
  'island', 'behemoth', 'needle', 'archipelago', 'saltgate',
  'battery', 'sowers', 'rigs', 'lantern', 'dreadnought',
  'coves', 'delta', 'crossing', 'tide', 'citadel',
];

/** The order before the 20-map plan (old saves count unlocks in it). */
export const OLD_ORDER: MapId[] = ['strait', 'gauntlet', 'island', 'harbor', 'archipelago'];

export const CHAPTERS = [
  { n: 1, name: 'Home Waters' },
  { n: 2, name: 'The Narrows' },
  { n: 3, name: 'Dark Water' },
  { n: 4, name: 'Open War' },
] as const;

/** A map's chapter (1–4): five maps a chapter, in MAP_ORDER. */
export function chapterOf(id: MapId): number {
  return Math.floor(MAP_ORDER.indexOf(id) / 5) + 1;
}
