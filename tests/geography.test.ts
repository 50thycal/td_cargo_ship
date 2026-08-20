// The map is data now. These tests cover the two things that can go wrong with
// that: the default map must be EXACTLY the map it replaced (or every balance
// number in the game has quietly moved), and a curved map must satisfy the
// invariants the sim assumes but never checks at run time.

import { describe, expect, it } from 'vitest';
import {
  GEOGRAPHIES,
  SQUEEZE,
  STRAIT,
  geography,
  lanesAcross,
  makeGeography,
  validateGeography,
  flat,
  type GeographyDef,
} from '../src/data/geography';
import { COMBAT, WORLD } from '../src/data/tuning';

const strait = geography('strait');
const squeeze = geography('squeeze');

describe('the strait reproduces the map it replaced', () => {
  // If any of these drift, every distance the game is balanced around drifts
  // with them — missile flight times, artillery reach, escort transit times.
  // "Close enough" is not a passing grade: these are `toBe`, not `toBeCloseTo`.

  it('puts the lanes exactly where WORLD.lanes did, at every x', () => {
    for (let x = -200; x <= WORLD.width + 200; x += 137) {
      for (let i = 0; i < WORLD.lanes.length; i++) {
        expect(strait.laneY(i, x)).toBe(WORLD.lanes[i]);
      }
    }
  });

  it('has the same lane count', () => {
    expect(strait.laneCount).toBe(WORLD.lanes.length);
  });

  it('puts the water edges exactly where waterTop/waterBottom did', () => {
    const top = WORLD.hostileShoreY + WORLD.shoreWave + COMBAT.shoreClearance;
    const bottom = WORLD.friendlyShoreY - WORLD.shoreWave - COMBAT.shoreClearance;
    for (let x = 0; x <= WORLD.width; x += 250) {
      expect(strait.waterTop(x)).toBe(top);
      expect(strait.waterBottom(x)).toBe(bottom);
    }
  });

  it("puts the A-10's water band exactly where the old constants did", () => {
    // These were COMBAT.warthog.waterYMin / waterYMax — 1185 and 2190.
    for (let x = 0; x <= WORLD.width; x += 250) {
      expect(strait.airWaterTop(x)).toBe(1185);
      expect(strait.airWaterBottom(x)).toBe(2190);
    }
  });

  it('puts the launch sites exactly where WORLD.launchSites did', () => {
    expect(strait.launchSites).toEqual([
      { x: 700, y: 985 },
      { x: 1800, y: 955 },
      { x: 2900, y: 985 },
    ]);
  });

  it('puts the launch LINE on the y every spawn has always used', () => {
    for (let x = 0; x <= WORLD.width; x += 250) expect(strait.launchY(x)).toBe(985);
  });

  it('puts the shore-battery line exactly where WORLD.baseLine did', () => {
    for (let x = 0; x <= WORLD.width; x += 250) expect(strait.baseY(x)).toBe(WORLD.baseLine);
  });

  it('is what an ordinary region gets when it names no geography', () => {
    // Both shipped regions are fought on the strait, and neither says so.
    expect(geography('strait')).toBe(strait);
    expect(geography('a-region-with-a-typo-in-it')).toBe(strait);
  });
});

describe('profile sampling', () => {
  it('returns a one-point profile untouched, with no arithmetic', () => {
    const geo = makeGeography({ ...STRAIT, hostileShore: flat(1234.5678) });
    for (const x of [-1e6, 0, 1999, WORLD.width, 1e6]) {
      expect(geo.hostileShoreY(x)).toBe(1234.5678);
    }
  });

  it('returns a FLAT SEGMENT untouched too — the guarantee the strait rests on', () => {
    const geo = makeGeography({
      ...STRAIT,
      hostileShore: [
        { x: 0, y: 1125 },
        { x: 4000, y: 1125 },
      ],
    });
    for (let x = 0; x <= WORLD.width; x += 73) expect(geo.hostileShoreY(x)).toBe(1125);
  });

  it('passes exactly through its control points', () => {
    const geo = makeGeography({
      ...STRAIT,
      hostileShore: [
        { x: 0, y: 1000 },
        { x: 2000, y: 1500 },
        { x: 4000, y: 1100 },
      ],
    });
    expect(geo.hostileShoreY(0)).toBe(1000);
    expect(geo.hostileShoreY(2000)).toBe(1500);
    expect(geo.hostileShoreY(4000)).toBe(1100);
  });

  it('holds the end values beyond both ends of the profile', () => {
    const geo = makeGeography({
      ...STRAIT,
      hostileShore: [
        { x: 1000, y: 1000 },
        { x: 3000, y: 1400 },
      ],
    });
    expect(geo.hostileShoreY(-500)).toBe(1000);
    expect(geo.hostileShoreY(0)).toBe(1000);
    expect(geo.hostileShoreY(4000)).toBe(1400);
  });

  it('eases rather than cornering — the slope is zero at each control point', () => {
    // Smoothstep, not linear. A lane with a corner in it makes a helmsman flick
    // the wheel crossing it; a coast with one is drawn as a row of facets.
    const geo = makeGeography({
      ...STRAIT,
      hostileShore: [
        { x: 0, y: 1000 },
        { x: 2000, y: 1400 },
      ],
    });
    const slope = (x: number): number => geo.hostileShoreY(x + 1) - geo.hostileShoreY(x);
    expect(Math.abs(slope(1))).toBeLessThan(Math.abs(slope(1000)) / 10);
    expect(Math.abs(slope(1998))).toBeLessThan(Math.abs(slope(1000)) / 10);
    // Monotone in between, and halfway across at the halfway point.
    expect(geo.hostileShoreY(1000)).toBeCloseTo(1200, 6);
    let prev = -Infinity;
    for (let x = 0; x <= 2000; x += 25) {
      const y = geo.hostileShoreY(x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('the invariants a map has to satisfy', () => {
  it('every shipped geography passes', () => {
    for (const [id, def] of Object.entries(GEOGRAPHIES)) {
      expect({ id, problems: validateGeography(def) }).toEqual({ id, problems: [] });
    }
  });

  it('catches lanes that cross', () => {
    // Weaving is allowed; crossing is not. Lane order IS "distance from the
    // hostile shore" to the barrage picker and the artillery reach test.
    const crossed: GeographyDef = {
      ...STRAIT,
      lanes: [
        [
          { x: 0, y: 1405 },
          { x: 4000, y: 1965 },
        ],
        [
          { x: 0, y: 1965 },
          { x: 4000, y: 1405 },
        ],
      ],
    };
    const problems = validateGeography(crossed);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.message.includes('crossed'))).toBe(true);
  });

  it('catches a lane that wanders out of the water', () => {
    const aground: GeographyDef = { ...STRAIT, lanes: [flat(1405), flat(1685), flat(2400)] };
    const problems = validateGeography(aground);
    expect(problems.some((p) => p.message.includes('outside the water'))).toBe(true);
  });

  it('catches water too narrow to sail a convoy down', () => {
    const pinched: GeographyDef = {
      ...STRAIT,
      hostileShore: flat(2000),
      lanes: [flat(2150)],
    };
    expect(validateGeography(pinched).some((p) => p.message.includes('wide'))).toBe(true);
  });
});

describe('lanesAcross', () => {
  it('keeps lanes inside the water where the water narrows', () => {
    const hostile = [
      { x: 0, y: 1125 },
      { x: 2000, y: 1725 },
      { x: 4000, y: 1125 },
    ];
    const friendly = flat(2250);
    const def: GeographyDef = {
      ...STRAIT,
      hostileShore: hostile,
      friendlyShore: friendly,
      lanes: lanesAcross(hostile, friendly, WORLD.shoreWave, [0.25, 0.5, 0.75]),
    };
    expect(validateGeography(def)).toEqual([]);
  });

  it('produces lanes in the order the fractions were given', () => {
    const geo = makeGeography(SQUEEZE);
    for (let x = 0; x <= WORLD.width; x += 200) {
      expect(geo.laneY(0, x)).toBeLessThan(geo.laneY(1, x));
      expect(geo.laneY(1, x)).toBeLessThan(geo.laneY(2, x));
    }
  });
});

describe('nearestLane on a map whose lanes move', () => {
  it('answers by WHERE along the map you ask, not by y alone', () => {
    // The same y is a different lane at different x once the lanes bend. This
    // is why the tap-to-lane resolution had to grow an x argument: a scan plane
    // sent "down the middle lane" has to be sent down the middle lane.
    const peakNear = squeeze.laneY(0, 2000);
    expect(squeeze.nearestLane(2000, peakNear)).toBe(0);
    // That same height, out west where the near lane is still up on the coast,
    // is the CENTRE lane.
    expect(squeeze.nearestLane(200, peakNear)).toBe(1);
  });

  it('still answers by y alone on a straight map', () => {
    for (let i = 0; i < strait.laneCount; i++) {
      expect(strait.nearestLane(0, WORLD.lanes[i])).toBe(i);
      expect(strait.nearestLane(3900, WORLD.lanes[i])).toBe(i);
    }
  });
});

describe('the squeeze does what geography is supposed to do', () => {
  // The whole argument for this module: a region can be hard in a new way with
  // no weapon touched. These numbers are the argument, so they are asserted.

  it('carries the enemy launch line 400 units closer at the bulge', () => {
    expect(squeeze.launchY(0)).toBe(strait.launchY(0));
    expect(squeeze.launchY(2000)).toBeCloseTo(strait.launchY(2000) + 400, 6);
  });

  it('is exactly the strait outside the bulge', () => {
    // A pressed map gives ground only where the land actually reaches it, so
    // the approach and the run-out have to be the map the player already knows.
    for (const x of [0, 300, 800, 3400, 4000]) {
      for (let i = 0; i < strait.laneCount; i++) expect(squeeze.laneY(i, x)).toBe(WORLD.lanes[i]);
      expect(squeeze.launchY(x)).toBe(strait.launchY(x));
    }
  });

  it('cuts the warning time on both threatened lanes', () => {
    const warning = (geo: typeof strait, lane: number, x: number): number =>
      (geo.laneY(lane, x) - geo.launchY(x)) / COMBAT.missile.speed;
    // The strait's own figures: 7.0 s on the near lane, 11.7 s on the centre.
    expect(warning(strait, 0, 2000)).toBeCloseTo(7, 1);
    expect(warning(strait, 1, 2000)).toBeCloseTo(11.7, 1);
    // In the alley: five on the near lane, and the centre lane dragged down
    // with it because the near lane has nowhere to go but into it.
    expect(warning(squeeze, 0, 2000)).toBeCloseTo(5.5, 1);
    expect(warning(squeeze, 1, 2000)).toBeCloseTo(7, 1);
  });

  it('widens what a shore gun can reach, without touching its range', () => {
    const lanesCovered = (geo: typeof strait, x: number, reach: number): number => {
      let n = 0;
      for (let i = 0; i < geo.laneCount; i++) {
        if (Math.abs(geo.laneY(i, x) - geo.launchY(x)) <= reach) n++;
      }
      return n;
    };
    const coastal = COMBAT.artillery.range.coastalGun;
    const ranging = COMBAT.artillery.range.ranging;
    // The comment in evolution.ts: "a coastal gun reaches the near lane and
    // nothing else". True on the strait, and true on the squeeze's approaches.
    expect(lanesCovered(strait, 2000, coastal)).toBe(1);
    expect(lanesCovered(squeeze, 300, coastal)).toBe(1);
    // In the alley it covers two, and the ranging gun covers the whole strait.
    expect(lanesCovered(squeeze, 2000, coastal)).toBe(2);
    expect(lanesCovered(strait, 2000, ranging)).toBe(2);
    expect(lanesCovered(squeeze, 2000, ranging)).toBe(3);
  });

  it('narrows the water without pinching it shut', () => {
    const width = (x: number): number => squeeze.waterBottom(x) - squeeze.waterTop(x);
    expect(width(0)).toBe(strait.waterBottom(0) - strait.waterTop(0));
    expect(width(2000)).toBeCloseTo(width(0) - 400, 6);
    expect(width(2000)).toBeGreaterThan(500);
  });

  it('crowds the near lane into the centre one rather than crossing it', () => {
    const gapAt = (x: number): number => squeeze.laneY(1, x) - squeeze.laneY(0, x);
    expect(gapAt(300)).toBe(WORLD.lanes[1] - WORLD.lanes[0]);
    expect(gapAt(2000)).toBeLessThan(gapAt(300) * 0.5);
    expect(gapAt(2000)).toBeGreaterThan(0);
  });
});
