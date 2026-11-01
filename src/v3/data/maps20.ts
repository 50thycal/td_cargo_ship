// The fifteen maps the 20-map plan added (docs/design/v3-maps-plan.md),
// approved by the player's review. Laid out in the plan's diagrams
// (docs/design/v3-maps-plan/NN-id.svg); the unique system each one brings is
// named in its comment. MAP_ORDER (maps.ts) sets where each sits.

import { after, arc, bypass, closeBottom, closeTop, curve, islet, lens, offset, rev, rough, shore, smooth } from './geo';
import type { BaseDef, MapDef, MapId } from './mapTypes';


// ---------------------------------------------------------------------------
// 2. The Kesh Hook — the Hormuz-like bend.
// Ships come in low on the left and hook north round Cape Marrow, leaving off
// the top edge. The carrier sits inside the turn; the enemy holds only the
// OUTER bank (south and east), so threats come from one side, as on map 1.
const KC = { x: 700, y: 200 }; // centre of the turn
const KR = 520; // the lane's radius through the turn
const keshPath = [{ x: -40, y: KC.y + KR }, { x: KC.x, y: KC.y + KR }, ...arc(KC.x, KC.y, KR, 90, 0, 18).slice(1), { x: KC.x + KR, y: -40 }];
const KESH_BASES: BaseDef[] = [
  { x: 1150, y: 805, kinds: ['drone', 'ballistic'] },
  { x: 1510, y: 560, kinds: ['drone', 'guided', 'supersonic'] },
  { x: 1500, y: 190, kinds: ['ballistic', 'heavy'] },
];
const kesh: MapDef = {
  id: 'kesh',
  name: 'The Kesh Hook',
  blurb: 'The strait hooks north round Cape Marrow. Your carrier holds the inside of the turn; the enemy holds the outer bank.',
  land: [
    { side: 'friendly', points: [{ x: 0, y: 0 }, { x: 1010, y: 0 }, ...rough(arc(KC.x, KC.y, 290, -8, 100, 14), 6, 1.2), { x: 380, y: 505 }, { x: 0, y: 512 }] },
    { side: 'enemy', points: [{ x: 1600, y: 0 }, { x: 1352, y: 0 }, ...rough(arc(KC.x, KC.y, 652, 0, 90, 20), 7, 0.4), { x: 380, y: 858 }, { x: 0, y: 862 }, { x: 0, y: 900 }, { x: 1600, y: 900 }] },
  ],
  bases: KESH_BASES,
  carrier: { x: 915, y: 480 },
  frigate: { x: 610, y: 568 },
  channels: [{ y: 720, halfWidth: 95, path: keshPath }],
  threatScale: 0.8,
  extras: [{ kind: 'supersonic', from: 6, count: 1, growth: 0.3 }],
  callout: { x: 380, y: 300 },
  alerts: { x0: 40, x1: 760, y: 470 },
  roads: {
    runners: [[{ x: -60, y: 884 }, { x: 700, y: 884 }, ...arc(KC.x, KC.y, 712, 90, 0, 16).slice(1), { x: 1412, y: -60 }]],
    popups: [
      { from: { x: 1640, y: 400 }, to: { x: 1352, y: 420 } },
      { from: { x: 940, y: 940 }, to: { x: 940, y: 836 } },
    ],
  },
  subSpots: [{ x: 1075, y: 300 }, { x: 190, y: 572 }],
  bomberLines: [570],
  vectors: { trucks: 2, subs: 3, strafers: 5, bombers: 7 },
  escortStations: [{ x: 480, y: 640 }, { x: 1010, y: 590 }, { x: 300, y: 800 }],
  marks: [{ x: 1040, y: 655, text: 'THE TURN' }],
};

// ---------------------------------------------------------------------------
// 3. Lee of Marrow — an allied radar tower on a friendly island.
// The Strait's layout plus a friendly island between the enemy shore and the
// lane, with a radar tower on it. While the tower stands its sweep covers the
// lane: threats inside it are tracked (a lock box) and your interceptors fly
// half as fast again at them. The enemy aims some launches at the tower (4
// hits); once it falls it is gone for the rest of the run (player's review).
const MARROW_BASES: BaseDef[] = [
  { x: 260, y: 105, kinds: ['drone', 'guided'] },
  { x: 800, y: 95, kinds: ['drone', 'ballistic', 'heavy'] },
  { x: 1340, y: 105, kinds: ['guided', 'supersonic', 'ballistic'] },
];
const marrow: MapDef = {
  id: 'marrow',
  name: 'Lee of Marrow',
  blurb: 'A radar tower on a friendly island sweeps the lane, speeding your shots at anything it tracks. The enemy wants it gone; once lost, it stays lost.',
  land: [
    { side: 'enemy', points: shore('top', 150, 14, 0.9) },
    { side: 'friendly', hill: true, points: lens(520, 1080, 325, 78) },
    { side: 'friendly', points: shore('bottom', 800, 12, 2.1) },
  ],
  bases: MARROW_BASES,
  carrier: { x: 800, y: 742 },
  frigate: { x: 570, y: 742 },
  channels: [{ y: 575, halfWidth: 115 }],
  threatScale: 0.95,
  extras: [
    { kind: 'supersonic', from: 6, count: 1, growth: 0.3 },
    { kind: 'heavy', from: 9, count: 1, growth: 0 },
  ],
  callout: { x: 800, y: 850 },
  alerts: { x0: 170, x1: 1430, y: 888 },
  roads: {
    runners: [bypass([{ x: -60, y: 122 }, { x: 800, y: 126 }, { x: 1660, y: 122 }], MARROW_BASES, -1)],
    popups: [
      { from: { x: 540, y: -40 }, to: { x: 540, y: 130 } },
      { from: { x: 1070, y: -40 }, to: { x: 1070, y: 132 } },
    ],
  },
  subSpots: [{ x: 180, y: 330 }, { x: 1420, y: 330 }, { x: 300, y: 742 }, { x: 1320, y: 742 }],
  bomberLines: [258, 742],
  vectors: { trucks: 2, subs: 3, strafers: 5, bombers: 7 },
  posts: [{ kind: 'radar', x: 800, y: 318, hp: 4, reach: 400 }],
};

// ---------------------------------------------------------------------------
// 7. The Behemoth Run — escort the supertanker.
// One supertanker a wave in its own slow deep-water lane. It soaks six hits,
// and losing it counts as three ships; heavies and guided missiles prefer it.
// Bringing it home pays a repair and a weapon drop.
const BEHEMOTH_BASES: BaseDef[] = [
  { x: 280, y: 95, kinds: ['drone', 'ballistic'] },
  { x: 760, y: 88, kinds: ['guided', 'heavy'] },
  { x: 1260, y: 95, kinds: ['drone', 'supersonic', 'heavy'] },
  { x: 1430, y: 810, kinds: ['ballistic', 'guided'] },
];
const behemoth: MapDef = {
  id: 'behemoth',
  name: 'The Behemoth Run',
  blurb: 'Once a wave a supertanker crawls through the deep lane. Six hits to sink, worth three ships. Guard it, and the convoy, at once.',
  land: [
    { side: 'enemy', points: shore('top', 140, 13, 2.6) },
    { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 800, 1150, 785, 1.1), { x: 1150, y: 900 }] },
    { side: 'enemy', points: [{ x: 1150, y: 900 }, ...curve(1150, 785, 1600, 700, 2.0), { x: 1600, y: 900 }] },
  ],
  bases: BEHEMOTH_BASES,
  carrier: { x: 700, y: 725 },
  frigate: { x: 470, y: 728 },
  channels: [
    { y: 362, halfWidth: 66, speed: 0.6, share: 0, vip: true, label: 'TANKER LANE' },
    { y: 565, halfWidth: 98 },
  ],
  threatScale: 1.15,
  extras: [
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'heavy', from: 5, count: 1, growth: 0.15 },
    { kind: 'mothership', from: 8, count: 1, growth: 0.15 },
  ],
  callout: { x: 380, y: 852 },
  alerts: { x0: 30, x1: 1090, y: 890 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 110 }, { x: 800, y: 112 }, { x: 1660, y: 110 }], BEHEMOTH_BASES.slice(0, 3), -1),
      bypass([{ x: 1660, y: 762 }, { x: 1400, y: 812 }, { x: 1180, y: 860 }], BEHEMOTH_BASES.slice(3), 1),
    ],
    popups: [
      { from: { x: 520, y: -40 }, to: { x: 520, y: 124 } },
      { from: { x: 1020, y: -40 }, to: { x: 1020, y: 120 } },
    ],
  },
  subSpots: [{ x: 160, y: 228 }, { x: 1450, y: 228 }, { x: 300, y: 735 }, { x: 960, y: 735 }],
  bomberLines: [228, 738],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
};

// ---------------------------------------------------------------------------
// 8. The Needle of Bosk — wide water, then single file.
// Open sea on the left funnels between two enemy headlands to a gap one hull
// wide. Ships close up into a column and queue (slowing) at the mouth: bunched
// targets for clusters and ballistics. Column formation doesn't have to merge.
const NEEDLE_HW: [number, number][] = [[-40, 190], [480, 190], [1000, 32], [1240, 32], [1420, 120], [1640, 140]];
const NEEDLE_BASES: BaseDef[] = [
  { x: 300, y: 92, kinds: ['drone', 'guided'] },
  { x: 700, y: 100, kinds: ['ballistic', 'supersonic'] },
  { x: 1120, y: 290, kinds: ['cluster', 'ballistic'] },
  { x: 1130, y: 650, kinds: ['drone', 'cluster', 'heavy'] },
  { x: 1490, y: 88, kinds: ['guided', 'supersonic'] },
];
const needle: MapDef = {
  id: 'needle',
  name: 'The Needle of Bosk',
  blurb: 'Open water narrows to a gap one ship wide. The convoy bunches and slows at the mouth: one cluster can catch them all.',
  land: [
    { side: 'enemy', points: closeTop(smooth([{ x: 0, y: 150 }, { x: 300, y: 140 }, { x: 600, y: 165 }, { x: 850, y: 255 }, { x: 985, y: 392 }, { x: 1120, y: 404 }, { x: 1245, y: 395 }, { x: 1335, y: 300 }, { x: 1450, y: 190 }, { x: 1600, y: 170 }], 8)) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 0, y: 790 }, { x: 300, y: 800 }, { x: 600, y: 785 }, { x: 820, y: 745 }, { x: 905, y: 700 }], 6)) },
    { side: 'enemy', points: closeBottom(smooth([{ x: 905, y: 700 }, { x: 985, y: 508 }, { x: 1120, y: 496 }, { x: 1245, y: 505 }, { x: 1335, y: 600 }, { x: 1385, y: 700 }], 6)) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 1385, y: 700 }, { x: 1450, y: 645 }, { x: 1600, y: 625 }], 6)) },
  ],
  bases: NEEDLE_BASES,
  carrier: { x: 760, y: 680 },
  frigate: { x: 520, y: 718 },
  channels: [{ y: 450, halfWidth: 190, widths: NEEDLE_HW }],
  threatScale: 0.95,
  extras: [
    { kind: 'cluster', from: 3, count: 1, growth: 0.3 },
    { kind: 'heavy', from: 6, count: 1, growth: 0.2 },
    { kind: 'mothership', from: 8, count: 1, growth: 0.15 },
  ],
  callout: { x: 300, y: 852 },
  alerts: { x0: 30, x1: 860, y: 890 },
  roads: {
    runners: [bypass([{ x: -60, y: 105 }, { x: 600, y: 118 }, { x: 850, y: 195 }, { x: 1000, y: 330 }, { x: 1240, y: 330 }, { x: 1350, y: 225 }, { x: 1660, y: 120 }], NEEDLE_BASES.filter((b) => b.y < 400), -1)],
    popups: [{ from: { x: 1190, y: 940 }, to: { x: 1190, y: 545 } }],
  },
  subSpots: [{ x: 200, y: 208 }, { x: 1500, y: 252 }, { x: 300, y: 718 }],
  bomberLines: [210, 735],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  marks: [{ x: 1120, y: 398, text: 'SINGLE FILE' }],
};

// ---------------------------------------------------------------------------
// 10. Saltgate Canal — two lock gates.
// A canal cut across the land: West Sea, Lock A, the Bitter Lake (where the
// carrier anchors), Lock B, East Sea. In a lock the gates close and ships sit
// in the chamber while it fills (a gate light and a countdown say how long),
// then the far gate opens; ships behind queue. Enemy silos overlook each lock.
const SALT_BASES: BaseDef[] = [
  { x: 220, y: 150, kinds: ['drone', 'ballistic'] },
  { x: 580, y: 240, kinds: ['guided', 'cluster'] },
  { x: 900, y: 150, kinds: ['heavy', 'supersonic'] },
  { x: 1220, y: 240, kinds: ['drone', 'cluster'] },
  { x: 1460, y: 150, kinds: ['ballistic', 'guided'] },
];
const saltgate: MapDef = {
  id: 'saltgate',
  name: 'Saltgate Canal',
  blurb: 'Two locks. Ships wait in each chamber while it fills: sitting ducks under the silos. Time your rack to the gates.',
  land: [
    { side: 'enemy', points: [{ x: 0, y: 0 }, { x: 0, y: 270 }, { x: 200, y: 262 }, { x: 420, y: 276 }, { x: 438, y: 372 }, { x: 722, y: 372 }, ...smooth([{ x: 740, y: 330 }, { x: 900, y: 298 }, { x: 1060, y: 330 }], 6), { x: 1078, y: 372 }, { x: 1362, y: 372 }, { x: 1380, y: 276 }, { x: 1600, y: 268 }, { x: 1600, y: 0 }] },
    { side: 'friendly', points: [{ x: 0, y: 900 }, { x: 0, y: 702 }, { x: 200, y: 712 }, { x: 420, y: 700 }, { x: 438, y: 508 }, { x: 722, y: 508 }, ...smooth([{ x: 740, y: 700 }, { x: 900, y: 745 }, { x: 1060, y: 700 }], 6), { x: 1078, y: 508 }, { x: 1362, y: 508 }, { x: 1380, y: 702 }, { x: 1600, y: 708 }, { x: 1600, y: 900 }] },
  ],
  bases: SALT_BASES,
  carrier: { x: 880, y: 662 },
  frigate: { x: 1010, y: 622 },
  channels: [{ y: 440, halfWidth: 150, widths: [[-40, 150], [380, 150], [440, 66], [722, 66], [780, 108], [1020, 108], [1078, 66], [1362, 66], [1420, 150], [1640, 150]] }],
  threatScale: 0.9,
  extras: [
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'heavy', from: 5, count: 1, growth: 0.2 },
    { kind: 'mothership', from: 8, count: 1, growth: 0.15 },
  ],
  callout: { x: 900, y: 830 },
  alerts: { x0: 170, x1: 1430, y: 888 },
  roads: {
    runners: [bypass([{ x: -60, y: 198 }, { x: 800, y: 200 }, { x: 1660, y: 198 }], SALT_BASES, -1)],
    popups: [
      { from: { x: 690, y: -40 }, to: { x: 690, y: 345 } },
      { from: { x: 1330, y: -40 }, to: { x: 1330, y: 345 } },
    ],
  },
  subSpots: [{ x: 200, y: 610 }, { x: 1480, y: 610 }],
  bomberLines: [610],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  locks: [
    { x0: 500, x1: 660, wait: 6 },
    { x0: 1140, x1: 1300, wait: 6 },
  ],
  marks: [{ x: 880, y: 604, text: 'BITTER LAKE' }],
};

// ---------------------------------------------------------------------------
// 11. Battery Point — an allied shore battery fights with you.
// Two friendly gun turrets on a headland fire on their own at anything within
// reach. The enemy aims heavies and ballistics at them; a hit turret is out
// for ~12 s (smoking) and comes back. Guard the guns and they guard the lane.
const BATTERY_BASES: BaseDef[] = [
  { x: 260, y: 100, kinds: ['drone', 'guided', 'ballistic'] },
  { x: 700, y: 95, kinds: ['drone', 'heavy', 'cluster'] },
  { x: 1100, y: 95, kinds: ['ballistic', 'supersonic', 'guided'] },
  { x: 1450, y: 100, kinds: ['drone', 'heavy', 'mothership'] },
];
const battery: MapDef = {
  id: 'battery',
  name: 'Battery Point',
  blurb: 'Two allied shore guns on the headland fire on their own. The enemy wants them silenced first. Keep them firing.',
  land: [
    { side: 'enemy', points: shore('top', 150, 14, 1.3) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 0, y: 800 }, { x: 400, y: 790 }, { x: 880, y: 782 }, { x: 990, y: 700 }, { x: 1060, y: 618 }, { x: 1200, y: 608 }, { x: 1275, y: 690 }, { x: 1360, y: 782 }, { x: 1600, y: 792 }], 8)) },
  ],
  bases: BATTERY_BASES,
  carrier: { x: 520, y: 702 },
  frigate: { x: 290, y: 706 },
  channels: [{ y: 430, halfWidth: 120 }],
  threatScale: 1.8,
  extras: [
    { kind: 'supersonic', from: 4, count: 1, growth: 0.25 },
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
    { kind: 'heavy', from: 3, count: 1, growth: 0.25 },
  ],
  callout: { x: 300, y: 850 },
  alerts: { x0: 30, x1: 960, y: 890 },
  roads: {
    runners: [bypass([{ x: -60, y: 122 }, { x: 800, y: 124 }, { x: 1660, y: 122 }], BATTERY_BASES, -1)],
    popups: [
      { from: { x: 480, y: -40 }, to: { x: 480, y: 128 } },
      { from: { x: 900, y: -40 }, to: { x: 900, y: 128 } },
      { from: { x: 1290, y: -40 }, to: { x: 1290, y: 128 } },
    ],
  },
  subSpots: [{ x: 180, y: 240 }, { x: 1440, y: 240 }, { x: 800, y: 690 }, { x: 1450, y: 690 }],
  bomberLines: [238, 680],
  vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 5 },
  posts: [
    { kind: 'battery', x: 1085, y: 652, hp: 3, reach: 330 },
    { kind: 'battery', x: 1210, y: 646, hp: 3, reach: 330 },
  ],
};

// ---------------------------------------------------------------------------
// 12. Sowers' Reach — mines adrift.
// Mine chutes on the enemy shore drop mines that drift slowly across the lane
// on the current. A ship that touches one takes 3 damage; one interceptor
// clears a mine. Every round spent on a mine is one not spent on a missile.
const SOWERS_BASES: BaseDef[] = [
  { x: 220, y: 100, kinds: ['drone', 'ballistic'] },
  { x: 650, y: 95, kinds: ['guided', 'supersonic'] },
  { x: 1100, y: 95, kinds: ['drone', 'heavy'] },
  { x: 1480, y: 100, kinds: ['cluster', 'ballistic'] },
  { x: 1450, y: 805, kinds: ['guided', 'cluster'] },
  // Mine chutes: mines slide off the shore and drift south-east on the current.
  { x: 430, y: 170, kinds: ['mine'], chute: true },
  { x: 880, y: 172, kinds: ['mine'], chute: true },
  { x: 1270, y: 170, kinds: ['mine'], chute: true },
];
const sowers: MapDef = {
  id: 'sowers',
  name: "Sowers' Reach",
  blurb: 'Mines drift across the lane on the current. Shoot them before a ship sails into one, without starving the sky of rounds.',
  land: [
    { side: 'enemy', points: shore('top', 150, 13, 0.2) },
    { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 800, 1200, 790, 2.2), { x: 1200, y: 900 }] },
    { side: 'enemy', points: closeBottom(smooth([{ x: 1200, y: 790 }, { x: 1350, y: 722 }, { x: 1600, y: 692 }], 6)) },
  ],
  bases: SOWERS_BASES,
  carrier: { x: 760, y: 718 },
  frigate: { x: 540, y: 720 },
  channels: [{ y: 480, halfWidth: 125 }],
  threatScale: 1.45,
  extras: [
    { kind: 'mine', from: 1, count: 2, growth: 0.5 },
    { kind: 'cluster', from: 5, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 7, count: 1, growth: 0.17 },
  ],
  callout: { x: 400, y: 852 },
  alerts: { x0: 30, x1: 1180, y: 890 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 122 }, { x: 800, y: 124 }, { x: 1660, y: 122 }], SOWERS_BASES.slice(0, 4), -1),
      bypass([{ x: 1660, y: 752 }, { x: 1400, y: 800 }, { x: 1230, y: 852 }], SOWERS_BASES.slice(4), 1),
    ],
    popups: [
      { from: { x: 440, y: -40 }, to: { x: 440, y: 128 } },
      { from: { x: 1300, y: -40 }, to: { x: 1300, y: 128 } },
    ],
  },
  subSpots: [{ x: 160, y: 262 }, { x: 1500, y: 262 }, { x: 300, y: 722 }],
  bomberLines: [258, 715],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  current: { x: 7, y: 26 },
};

// ---------------------------------------------------------------------------
// 13. The Rig Field — knock out launchers for good.
// Four enemy oil rigs stand in the sea, each a launcher with hit points.
// A destroyed rig stays down for the rest of the run, so weapon time spent on
// rigs early buys quieter waves later. Two far silos on the shore can't be hit.
const RIGS_BASES: BaseDef[] = [
  { x: 300, y: 298, kinds: ['drone', 'guided'], rig: { hp: 40 } },
  { x: 690, y: 270, kinds: ['cluster', 'ballistic'], rig: { hp: 40 } },
  { x: 1080, y: 298, kinds: ['supersonic', 'guided'], rig: { hp: 40 } },
  { x: 1440, y: 270, kinds: ['drone', 'mothership'], rig: { hp: 40 } },
  { x: 500, y: 68, kinds: ['ballistic', 'heavy'] },
  { x: 1250, y: 68, kinds: ['heavy', 'ballistic'] },
];
const rigs: MapDef = {
  id: 'rigs',
  name: 'The Rig Field',
  blurb: 'Enemy oil rigs launch from the open sea. Each one you bring down stays down. Spend weapons on rigs now, or on missiles?',
  land: [
    { side: 'enemy', points: shore('top', 105, 10, 0.5) },
    { side: 'friendly', points: shore('bottom', 800, 12, 2.6) },
  ],
  bases: RIGS_BASES,
  carrier: { x: 900, y: 742 },
  frigate: { x: 660, y: 742 },
  channels: [{ y: 570, halfWidth: 110 }],
  threatScale: 1.7,
  extras: [
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 5, count: 1, growth: 0.17 },
    { kind: 'supersonic', from: 6, count: 1, growth: 0.25 },
  ],
  callout: { x: 400, y: 852 },
  alerts: { x0: 170, x1: 1430, y: 888 },
  roads: {
    runners: [bypass([{ x: -60, y: 82 }, { x: 800, y: 84 }, { x: 1660, y: 82 }], RIGS_BASES.slice(4), -1)],
    popups: [{ from: { x: 880, y: -40 }, to: { x: 880, y: 88 } }],
  },
  subSpots: [{ x: 500, y: 405 }, { x: 1260, y: 405 }, { x: 250, y: 742 }, { x: 1400, y: 742 }],
  bomberLines: [188, 742],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 5 },
};

// ---------------------------------------------------------------------------
// 14. The Black Strait — night, and a lighthouse beam.
// Night: threats show only as a faint engine glow until they are lit by the
// lighthouse's sweeping beam, the carrier's own lamp, or a launch flash, so
// warnings are shorter. A new pickup, the Star Shell, lights an area for 5 s.
const LANTERN_BASES: BaseDef[] = [
  { x: 250, y: 95, kinds: ['drone', 'guided'] },
  { x: 650, y: 90, kinds: ['ballistic', 'supersonic'] },
  { x: 1050, y: 95, kinds: ['cluster', 'heavy'] },
  { x: 1420, y: 95, kinds: ['drone', 'supersonic'] },
  { x: 1150, y: 835, kinds: ['guided', 'ballistic'] },
  { x: 1460, y: 825, kinds: ['drone', 'cluster'] },
];
const lantern: MapDef = {
  id: 'lantern',
  name: 'The Black Strait',
  blurb: 'Night. Threats are a faint glow until the lighthouse beam sweeps over them. Watch the light, and fire Star Shells into the dark.',
  land: [
    { side: 'enemy', points: shore('top', 140, 13, 1.9) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 0, y: 790 }, { x: 300, y: 800 }, { x: 500, y: 772 }, { x: 610, y: 712 }, { x: 680, y: 694 }, { x: 760, y: 750 }, { x: 900, y: 792 }], 8)) },
    { side: 'enemy', points: closeBottom(smooth([{ x: 900, y: 792 }, { x: 1100, y: 765 }, { x: 1350, y: 745 }, { x: 1600, y: 752 }], 6)) },
  ],
  bases: LANTERN_BASES,
  carrier: { x: 905, y: 668 },
  frigate: { x: 380, y: 700 },
  channels: [{ y: 440, halfWidth: 120 }],
  threatScale: 1.45,
  extras: [
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
  ],
  callout: { x: 300, y: 855 },
  alerts: { x0: 30, x1: 880, y: 890 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 115 }, { x: 800, y: 118 }, { x: 1660, y: 115 }], LANTERN_BASES.slice(0, 4), -1),
      bypass([{ x: 1660, y: 800 }, { x: 1300, y: 805 }, { x: 930, y: 845 }], LANTERN_BASES.slice(4), 1),
    ],
    popups: [
      { from: { x: 450, y: -40 }, to: { x: 450, y: 120 } },
      { from: { x: 1250, y: -40 }, to: { x: 1250, y: 120 } },
    ],
  },
  subSpots: [{ x: 180, y: 240 }, { x: 1460, y: 240 }, { x: 1260, y: 650 }],
  bomberLines: [238],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
  night: { light: { x: 652, y: 702 }, a0: -170, a1: -10, period: 8, width: 16, reach: 1000 },
};

// ---------------------------------------------------------------------------
// 15. Dreadnought Pass — a battleship crosses the map (chapter boss).
// On waves 3, 6 and 9 (and the finale) an enemy battleship steams right to
// left down the deep channel, firing broadside barrages at the convoy. It has
// a health bar (50 hits); sink it and it's gone until its next pass.
const DREAD_BASES: BaseDef[] = [
  { x: 350, y: 70, kinds: ['drone', 'ballistic'] },
  { x: 1250, y: 70, kinds: ['guided', 'supersonic'] },
];
const dreadnought: MapDef = {
  id: 'dreadnought',
  name: 'Dreadnought Pass',
  blurb: 'Every third wave a battleship steams through the deep channel, firing broadsides. Fifty hits to sink it. The convoy still needs you.',
  land: [
    { side: 'enemy', points: shore('top', 110, 10, 1.4) },
    { side: 'friendly', points: shore('bottom', 800, 12, 0.6) },
  ],
  bases: DREAD_BASES,
  carrier: { x: 800, y: 738 },
  frigate: { x: 560, y: 738 },
  channels: [{ y: 565, halfWidth: 110 }],
  threatScale: 0.85,
  extras: [
    { kind: 'heavy', from: 6, count: 1, growth: 0.15 },
    { kind: 'cluster', from: 5, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 7, count: 1, growth: 0.17 },
  ],
  callout: { x: 300, y: 852 },
  alerts: { x0: 170, x1: 1430, y: 888 },
  roads: {
    runners: [bypass([{ x: -60, y: 82 }, { x: 800, y: 84 }, { x: 1660, y: 82 }], DREAD_BASES, -1)],
    popups: [
      { from: { x: 800, y: -40 }, to: { x: 800, y: 88 } },
      { from: { x: 1500, y: -40 }, to: { x: 1500, y: 88 } },
    ],
  },
  subSpots: [{ x: 300, y: 410 }, { x: 1300, y: 410 }, { x: 200, y: 742 }, { x: 1400, y: 742 }],
  bomberLines: [172, 742],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 5 },
  boss: { path: [{ x: 1720, y: 290 }, { x: -120, y: 290 }], hp: 50, waves: [3, 6, 9, 10] },
};

// ---------------------------------------------------------------------------
// 16. Smugglers' Coves — fast attack boats.
// Coves in the enemy coast hide fast attack boats that dart out and ram the
// convoy. A boat leaves a white wake (the warning), takes two hits, and is the
// first threat that comes over the water.
const COVES_BASES: BaseDef[] = [
  { x: 180, y: 100, kinds: ['drone', 'ballistic'] },
  { x: 640, y: 100, kinds: ['guided', 'supersonic'] },
  { x: 1150, y: 100, kinds: ['heavy', 'cluster'] },
  { x: 1480, y: 810, kinds: ['guided', 'ballistic', 'mothership'] },
  // The coves: fast boats come out of them.
  { x: 381, y: 150, kinds: ['fastboat'], cove: true },
  { x: 911, y: 150, kinds: ['fastboat'], cove: true },
  { x: 1401, y: 150, kinds: ['fastboat'], cove: true },
  { x: 1238, y: 820, kinds: ['fastboat'], cove: true },
];
const covesNorth = smooth([
  { x: 0, y: 165 }, { x: 200, y: 172 }, { x: 330, y: 170 }, { x: 352, y: 98 }, { x: 410, y: 86 }, { x: 432, y: 170 },
  { x: 700, y: 176 }, { x: 860, y: 168 }, { x: 882, y: 98 }, { x: 940, y: 88 }, { x: 962, y: 170 },
  { x: 1200, y: 172 }, { x: 1350, y: 168 }, { x: 1372, y: 98 }, { x: 1430, y: 86 }, { x: 1452, y: 170 }, { x: 1600, y: 165 },
], 5);
const coves: MapDef = {
  id: 'coves',
  name: "Smugglers' Coves",
  blurb: 'Fast attack boats burst out of hidden coves to ram the convoy. Watch for the white wake; two hits each.',
  land: [
    { side: 'enemy', points: closeTop(covesNorth) },
    { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 790, 1000, 792, 0.9), { x: 1000, y: 900 }] },
    { side: 'enemy', points: closeBottom(smooth([{ x: 1000, y: 792 }, { x: 1170, y: 772 }, { x: 1205, y: 858 }, { x: 1272, y: 860 }, { x: 1305, y: 752 }, { x: 1600, y: 702 }], 5)) },
  ],
  bases: COVES_BASES,
  carrier: { x: 700, y: 722 },
  frigate: { x: 460, y: 722 },
  channels: [{ y: 470, halfWidth: 120 }],
  threatScale: 1.25,
  extras: [
    { kind: 'fastboat', from: 1, count: 2, growth: 0.6 },
    { kind: 'cluster', from: 4, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 6, count: 1, growth: 0.17 },
  ],
  callout: { x: 300, y: 852 },
  alerts: { x0: 30, x1: 960, y: 890 },
  roads: {
    runners: [bypass([{ x: -60, y: 128 }, { x: 320, y: 128 }, { x: 440, y: 60 }, { x: 800, y: 132 }, { x: 960, y: 60 }, { x: 1300, y: 132 }, { x: 1440, y: 60 }, { x: 1660, y: 128 }], COVES_BASES.slice(0, 3), -1)],
    popups: [{ from: { x: 1550, y: 940 }, to: { x: 1550, y: 730 } }],
  },
  subSpots: [{ x: 150, y: 262 }, { x: 1520, y: 262 }, { x: 180, y: 705 }],
  bomberLines: [262, 705],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 6 },
};

// ---------------------------------------------------------------------------
// 17. The Sharra Delta — the river forks three ways; you pick.
// Ships come up a broad estuary and the river splits round two marsh islands.
// North branch: shortest, under the enemy bank. Middle: a broad channel where
// the carrier anchors beside the lane (review: the carrier sits in real water,
// not a pond). South: long and winding past friendly marsh. A buoy at the fork
// switches which branch the next ships take (one tap). Too shallow for subs.
const DN = smooth([{ x: 600, y: 400 }, { x: 760, y: 292 }, { x: 960, y: 172 }, { x: 1250, y: 132 }, { x: 1640, y: 130 }], 8);
const DM = smooth([{ x: 600, y: 400 }, { x: 1000, y: 398 }, { x: 1640, y: 400 }], 8);
const DS = smooth([{ x: 600, y: 400 }, { x: 770, y: 525 }, { x: 1000, y: 712 }, { x: 1260, y: 778 }, { x: 1640, y: 788 }], 8);
const RIVER = [{ x: -40, y: 400 }, { x: 600, y: 400 }];
const DHW = 58;
const BANK = DHW + 14;
const MID_BELOW = 175; // the broad middle channel's water below the lane
const DELTA_BASES: BaseDef[] = [
  { x: 220, y: 150, kinds: ['drone', 'ballistic'] },
  { x: 560, y: 175, kinds: ['guided', 'supersonic'] },
  { x: 860, y: 82, kinds: ['heavy', 'ballistic'] },
  { x: 1060, y: 285, kinds: ['cluster', 'drone'] },
  { x: 1430, y: 272, kinds: ['guided', 'heavy', 'mothership'] },
];
const delta: MapDef = {
  id: 'delta',
  name: 'The Sharra Delta',
  blurb: 'The river splits three ways round the marshes. Tap the buoy at the fork to send ships north (short, hot), middle (past your carrier), or south (long, safe).',
  land: [
    { side: 'enemy', points: [{ x: 0, y: 0 }, { x: 0, y: 262 }, { x: 520, y: 262 }, ...after(offset(DN, -BANK), 720), { x: 1600, y: 0 }] },
    { side: 'enemy', hill: true, points: [...after(offset(DN, BANK), 880), ...rev(after(offset(DM, -BANK), 880))] },
    { side: 'friendly', points: [...after(offset(DM, MID_BELOW), 1020), ...rev(after(offset(DS, -BANK), 1020))] },
    { side: 'friendly', points: [{ x: 0, y: 900 }, { x: 0, y: 792 }, { x: 560, y: 792 }, ...after(offset(DS, BANK), 920), { x: 1600, y: 900 }] },
  ],
  bases: DELTA_BASES,
  carrier: { x: 1000, y: 522 },
  frigate: { x: 1250, y: 528 },
  channels: [
    { y: 160, halfWidth: DHW, path: [...RIVER, ...DN.slice(1)] },
    { y: 400, halfWidth: DHW, path: [...RIVER, ...DM.slice(1)] },
    { y: 760, halfWidth: DHW, path: [...RIVER, ...DS.slice(1)] },
  ],
  threatScale: 1.5,
  extras: [
    { kind: 'cluster', from: 3, count: 1, growth: 0.25 },
    { kind: 'mothership', from: 5, count: 1, growth: 0.2 },
    { kind: 'supersonic', from: 5, count: 1, growth: 0.25 },
  ],
  callout: { x: 280, y: 845 },
  alerts: { x0: 20, x1: 560, y: 890, max: 1 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 200 }, { x: 450, y: 205 }, { x: 800, y: 150 }, { x: 1100, y: 72 }, { x: 1660, y: 46 }], DELTA_BASES.slice(0, 3), -1),
      smooth([{ x: 900, y: 300 }, { x: 1200, y: 276 }, { x: 1660, y: 266 }], 6),
    ],
    popups: [{ from: { x: 1250, y: 250 }, to: { x: 1250, y: 318 } }],
  },
  subSpots: [],
  bomberLines: [600],
  vectors: { trucks: 1, subs: 99, strafers: 3, bombers: 5 },
  fork: { x: 560, y: 480, lanes: [0, 1, 2], start: 1 },
  escortStations: [{ x: 1250, y: 470 }, { x: 300, y: 300 }, { x: 520, y: 470 }],
};

// ---------------------------------------------------------------------------
// 18. Dunmar Crossing — two-way traffic.
// Outbound ships sail east in the north lane while inbound ships sail west in
// the south lane, both ends home ports. The carrier holds the middle. Two
// entries and two exits mean danger at both edges at once.
const CROSS_BASES: BaseDef[] = [
  { x: 280, y: 95, kinds: ['drone', 'ballistic', 'guided'] },
  { x: 800, y: 90, kinds: ['heavy', 'supersonic', 'cluster'] },
  { x: 1320, y: 95, kinds: ['drone', 'guided', 'mothership'] },
  { x: 560, y: 838, kinds: ['ballistic', 'guided'] },
  { x: 1040, y: 838, kinds: ['drone', 'cluster', 'heavy'] },
];
const crossing: MapDef = {
  id: 'crossing',
  name: 'Dunmar Crossing',
  blurb: 'Two convoys at once: outbound sails east in the north lane, inbound sails west in the south. Both edges are a front.',
  land: [
    { side: 'enemy', points: shore('top', 140, 13, 0.3) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 0, y: 770 }, { x: 200, y: 780 }, { x: 310, y: 800 }, { x: 345, y: 900 }], 4)) },
    { side: 'enemy', points: closeBottom(smooth([{ x: 345, y: 900 }, { x: 370, y: 790 }, { x: 800, y: 766 }, { x: 1230, y: 790 }, { x: 1255, y: 900 }], 6)) },
    { side: 'friendly', points: closeBottom(smooth([{ x: 1255, y: 900 }, { x: 1290, y: 800 }, { x: 1400, y: 780 }, { x: 1600, y: 770 }], 4)) },
  ],
  bases: CROSS_BASES,
  carrier: { x: 800, y: 455 },
  frigate: { x: 560, y: 455 },
  channels: [
    { y: 318, halfWidth: 86, label: 'OUTBOUND →' },
    { y: 592, halfWidth: 86, path: [{ x: 1640, y: 592 }, { x: -40, y: 592 }], label: '← INBOUND' },
  ],
  threatScale: 1.65,
  extras: [
    { kind: 'cluster', from: 3, count: 1, growth: 0.25 },
    { kind: 'supersonic', from: 4, count: 1, growth: 0.3 },
    { kind: 'mothership', from: 6, count: 1, growth: 0.2 },
  ],
  callout: { x: 150, y: 845 },
  alerts: { x0: 1290, x1: 1590, y: 890, max: 1 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 115 }, { x: 800, y: 118 }, { x: 1660, y: 115 }], CROSS_BASES.slice(0, 3), -1),
      bypass([{ x: 1250, y: 820 }, { x: 800, y: 808 }, { x: 350, y: 820 }], CROSS_BASES.slice(3), 1),
    ],
    popups: [
      { from: { x: 540, y: -40 }, to: { x: 540, y: 122 } },
      { from: { x: 1060, y: -40 }, to: { x: 1060, y: 120 } },
      { from: { x: 800, y: 940 }, to: { x: 800, y: 795 } },
    ],
  },
  subSpots: [{ x: 200, y: 455 }, { x: 1420, y: 455 }],
  bomberLines: [455],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 5 },
};

// ---------------------------------------------------------------------------
// 19. Tidewater Flats — the tide opens and closes the safe lane.
// The deep channel runs under the enemy shore and is always open. The flats
// lane, out by your carrier, floats only at high tide (a tide gauge counts
// it down). At low tide every ship has to take the deep channel: push the
// ship-flow slider up at high tide and ease it off before the ebb.
const TIDE_BASES: BaseDef[] = [
  { x: 250, y: 80, kinds: ['drone', 'guided', 'ballistic'] },
  { x: 650, y: 75, kinds: ['heavy', 'cluster'] },
  { x: 1000, y: 80, kinds: ['supersonic', 'guided'] },
  { x: 1400, y: 80, kinds: ['drone', 'mothership', 'ballistic'] },
];
const tide: MapDef = {
  id: 'tide',
  name: 'Tidewater Flats',
  blurb: 'The safe lane over the flats floats only at high tide. At low tide every ship runs the deep channel under the guns.',
  land: [
    { side: 'enemy', points: shore('top', 120, 11, 2.4) },
    { side: 'friendly', points: shore('bottom', 802, 11, 1.2) },
  ],
  bases: TIDE_BASES,
  carrier: { x: 800, y: 748 },
  frigate: { x: 560, y: 748 },
  channels: [
    { y: 282, halfWidth: 86 },
    { y: 575, halfWidth: 86, tide: true },
  ],
  threatScale: 1.4,
  extras: [
    { kind: 'cluster', from: 3, count: 1, growth: 0.25 },
    { kind: 'supersonic', from: 4, count: 1, growth: 0.3 },
    { kind: 'mothership', from: 6, count: 1, growth: 0.2 },
  ],
  callout: { x: 300, y: 852 },
  alerts: { x0: 170, x1: 1430, y: 888 },
  roads: {
    runners: [bypass([{ x: -60, y: 98 }, { x: 800, y: 100 }, { x: 1660, y: 98 }], TIDE_BASES, -1)],
    popups: [
      { from: { x: 450, y: -40 }, to: { x: 450, y: 104 } },
      { from: { x: 1200, y: -40 }, to: { x: 1200, y: 104 } },
    ],
  },
  subSpots: [{ x: 150, y: 392 }, { x: 1500, y: 392 }],
  bomberLines: [392, 742],
  vectors: { trucks: 2, subs: 3, strafers: 4, bombers: 5 },
  tide: { high: 25, low: 20 },
};

// ---------------------------------------------------------------------------
// 20. Citadel of Vey — the fortress (finale).
// A fortress island guards the harbour narrows at the east end, behind a
// shield fed by three generators placed round the map. Bring the generators
// down (they have hit points) and the shield drops; then the Citadel's own
// batteries can be silenced. It reuses the funnel (map 5) and destructible
// launchers (map 13), so the only new thing is the shield-and-core fight.
const CITADEL_BASES: BaseDef[] = [
  { x: 1250, y: 300, kinds: ['ballistic', 'heavy', 'supersonic', 'guided', 'cluster', 'mothership'], core: { hp: 40 } },
  { x: 450, y: 300, kinds: [], generator: { hp: 10 } },
  { x: 850, y: 82, kinds: [], generator: { hp: 10 } },
  { x: 1460, y: 812, kinds: [], generator: { hp: 10 } },
  { x: 250, y: 72, kinds: ['drone', 'ballistic'] },
  { x: 1500, y: 78, kinds: ['supersonic', 'guided'] },
];
const citadel: MapDef = {
  id: 'citadel',
  name: 'Citadel of Vey',
  blurb: 'The fortress guards the harbour narrows behind a shield. Destroy its three generators, then silence the Citadel itself.',
  land: [
    { side: 'enemy', points: shore('top', 120, 11, 1.0) },
    { side: 'enemy', points: islet(450, 300, 52) },
    { side: 'enemy', hill: true, points: islet(1250, 300, 122) },
    { side: 'friendly', points: [{ x: 0, y: 900 }, ...curve(0, 800, 1100, 792, 1.9), { x: 1100, y: 900 }] },
    { side: 'enemy', points: closeBottom(smooth([{ x: 1100, y: 792 }, { x: 1160, y: 780 }, { x: 1350, y: 742 }, { x: 1600, y: 722 }], 6)) },
  ],
  bases: CITADEL_BASES,
  carrier: { x: 720, y: 752 },
  frigate: { x: 480, y: 752 },
  channels: [{ y: 565, halfWidth: 125, widths: [[-40, 125], [900, 125], [1640, 66]] }],
  threatScale: 1.25,
  extras: [
    { kind: 'cluster', from: 3, count: 1, growth: 0.3 },
    { kind: 'supersonic', from: 3, count: 1, growth: 0.3 },
    { kind: 'mothership', from: 5, count: 1, growth: 0.2 },
    { kind: 'heavy', from: 4, count: 1, growth: 0.25 },
  ],
  callout: { x: 300, y: 852 },
  alerts: { x0: 30, x1: 1060, y: 890 },
  roads: {
    runners: [
      bypass([{ x: -60, y: 96 }, { x: 800, y: 98 }, { x: 1660, y: 96 }], CITADEL_BASES.filter((b) => b.y < 120), -1),
      bypass([{ x: 1660, y: 770 }, { x: 1400, y: 812 }, { x: 1150, y: 850 }], CITADEL_BASES.slice(3, 4), 1),
    ],
    popups: [
      { from: { x: 1180, y: 330 }, to: { x: 1180, y: 412 } },
      { from: { x: 1320, y: 330 }, to: { x: 1320, y: 412 } },
    ],
  },
  subSpots: [{ x: 200, y: 330 }, { x: 700, y: 330 }, { x: 300, y: 752 }],
  bomberLines: [200, 752],
  vectors: { trucks: 1, subs: 2, strafers: 3, bombers: 4 },
  shield: { x: 1250, y: 300, r: 175 },
};

export const NEW_MAPS: Record<Exclude<MapId, 'strait' | 'gauntlet' | 'island' | 'archipelago' | 'harbor'>, MapDef> = {
  kesh, marrow, behemoth, needle, saltgate, battery, sowers, rigs, lantern, dreadnought, coves, delta, crossing, tide, citadel,
};
