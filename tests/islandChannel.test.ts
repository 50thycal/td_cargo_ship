// THE ISLAND CHANNEL — land inside the water.
//
// Two coastline profiles can say where the water ENDS; they cannot say
// anything about land with water on both sides of it. So this covers the two
// ways terrain can be wrong, and they fail in opposite directions:
//
//   • the island is not REAL — the renderer draws a rock the sim does not
//     navigate against, and hulls sail through it;
//   • the island is not CONTAINED — terrain leaks into the maps that do not
//     have any, and every distance the game is balanced around moves.
//
// The load-bearing test is `nothing afloat ever ends a tick on the rock`: it
// runs whole transits with ships, escorts, boats, torpedoes and mines on the
// island map and checks every surface unit on every tick.

import { describe, expect, it } from 'vitest';
import {
  GEOGRAPHIES,
  ISLAND_CHANNEL,
  islandHalfHeight,
  geography,
  lanesAroundIsland,
  makeGeography,
  validateGeography,
  flat,
  type GeographyDef,
} from '../src/data/geography';
import { COMBAT, SIM, WORLD } from '../src/data/tuning';
import {
  registerCustomRegion,
  unregisterCustomRegion,
  REGIONS,
  type RegionDef,
} from '../src/data/regions';
import {
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
} from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import {
  blankRegion,
  compileRegion,
  environmentPreset,
  toRegionDef,
  validateRegionAuthoring,
} from '../src/data/regionAuthoring';
import type { CampaignState, RoundPlan, SpawnEvent, TransitState } from '../src/sim/types';

const island = geography('islandChannel');
const strait = geography('strait');
const rock = ISLAND_CHANNEL.islands![0];

/** Amidships — where the rock is at its widest and the split is real. */
const MID_X = 2000;

/** Is this point on the ROCK (rather than on either shore)?
 *
 *  Needed because `crossesLand` and `isLand` answer about all land, and every
 *  enemy launch site stands on the hostile shore by construction — so a run
 *  measured from one is trivially "over land" at its first step. What the
 *  island claims to do is stop things CROSSING IT, and that is what this
 *  isolates. */
function onRock(x: number, y: number): boolean {
  const h = islandHalfHeight(rock, x);
  return h > 0 && Math.abs(y - rock.centerY) <= h + rock.wave;
}

function crossesRock(ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 6));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    if (onRock(ax + (bx - ax) * f, ay + (by - ay) * f)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The shape itself
// ---------------------------------------------------------------------------

describe('the island channel geography', () => {
  it('satisfies every invariant the sim assumes', () => {
    expect(validateGeography(ISLAND_CHANNEL)).toEqual([]);
  });

  it('is registered, and leaves every other geography untouched', () => {
    expect(GEOGRAPHIES.islandChannel).toBe(ISLAND_CHANNEL);
    for (const id of Object.keys(GEOGRAPHIES)) {
      expect(validateGeography(GEOGRAPHIES[id])).toEqual([]);
    }
  });

  it('splits the water into two channels amidships and one off the tips', () => {
    expect(island.channels(MID_X)).toHaveLength(2);
    expect(island.channels(0)).toHaveLength(1);
    expect(island.channels(WORLD.width)).toHaveLength(1);
    const [north, south] = island.channels(MID_X);
    // Both passages have to be worth sailing: a channel narrower than the
    // lane margin either side is a wall with a gap drawn in it.
    expect(north.bottom - north.top).toBeGreaterThan(180);
    expect(south.bottom - south.top).toBeGreaterThan(180);
    expect(north.bottom).toBeLessThan(south.top); // the rock is between them
  });

  it('tapers to nothing at both tips, so the channels rejoin', () => {
    expect(islandHalfHeight(rock, rock.fromX)).toBe(0);
    expect(islandHalfHeight(rock, rock.toX)).toBe(0);
    expect(islandHalfHeight(rock, rock.fromX - 1)).toBe(0);
    expect(islandHalfHeight(rock, MID_X)).toBeCloseTo(rock.halfHeight, 5);
  });

  it('knows the rock is land and the channels either side are not', () => {
    expect(island.isLand(MID_X, rock.centerY)).toBe(true);
    expect(island.inWater(MID_X, rock.centerY)).toBe(false);
    const [north, south] = island.channels(MID_X);
    for (const y of [north.top + 10, north.bottom - 10, south.top + 10, south.bottom - 10]) {
      expect(island.isLand(MID_X, y)).toBe(false);
      expect(island.inWater(MID_X, y)).toBe(true);
    }
    // Off the ends of the island the same y is open water.
    expect(island.isLand(200, rock.centerY)).toBe(false);
  });

  it('holds a hull in the channel it is already in rather than flicking it across', () => {
    const [north, south] = island.channels(MID_X);
    // Nudged into the rock from the north: comes back out to the north.
    const fromNorth = island.clampWater(MID_X, rock.centerY - rock.halfHeight);
    expect(fromNorth).toBeLessThanOrEqual(north.bottom);
    expect(fromNorth).toBeGreaterThanOrEqual(north.top);
    // ...and from the south, to the south.
    const fromSouth = island.clampWater(MID_X, rock.centerY + rock.halfHeight);
    expect(fromSouth).toBeGreaterThanOrEqual(south.top);
    expect(fromSouth).toBeLessThanOrEqual(south.bottom);
    // A hull already in clear water is not moved at all.
    const settled = north.top + 40;
    expect(island.clampWater(MID_X, settled)).toBe(settled);
  });

  it('shelters the southern channel from shore-launched straight runs', () => {
    // The property that makes the rock a tactical object rather than an
    // obstacle: a torpedo runs UNDER the water and cannot pass it.
    const site = island.launchSites[1]; // the middle site, abreast of the rock
    expect(crossesRock(site.x, site.y, MID_X, island.laneY(1, MID_X))).toBe(true);

    // Measured across every site and the whole stretch the rock can shelter:
    // the southern lanes are largely covered, the northern one not at all.
    // The shelter is bought, not free — that trade is the region.
    const cover = (lane: number): number => {
      let blocked = 0;
      let total = 0;
      for (const s of island.launchSites) {
        for (let x = rock.fromX; x <= rock.toX; x += 25) {
          total++;
          if (crossesRock(s.x, s.y, x, island.laneY(lane, x))) blocked++;
        }
      }
      return blocked / total;
    };
    expect(cover(0)).toBe(0);
    expect(cover(1)).toBeGreaterThan(0.8);
    expect(cover(2)).toBeGreaterThan(0.8);
  });

  it('routes every lane clear of the land and never lets one change channel', () => {
    const seen = new Map<number, number>();
    for (let x = 0; x <= WORLD.width; x += 25) {
      const channels = island.channels(x);
      for (let lane = 0; lane < island.laneCount; lane++) {
        const y = island.laneY(lane, x);
        expect(island.isLand(x, y)).toBe(false);
        expect(island.inWater(x, y)).toBe(true);
        if (channels.length < 2) continue;
        const idx = channels.findIndex((c) => y >= c.top && y <= c.bottom);
        expect(idx).toBeGreaterThanOrEqual(0);
        const prior = seen.get(lane);
        if (prior === undefined) seen.set(lane, idx);
        else expect(idx).toBe(prior);
      }
    }
    // Lane 0 north, lanes 1 and 2 south — the split the region is named for.
    expect(seen.get(0)).toBe(0);
    expect(seen.get(1)).toBe(1);
    expect(seen.get(2)).toBe(1);
  });

  it('keeps every lane bend inside what a hull can actually steer', () => {
    // Same limit the headlands note cites: the steering goal saturates at 0.9
    // lateral per 1 forward, so a lane steeper than that outruns its convoy.
    for (let lane = 0; lane < island.laneCount; lane++) {
      for (let x = 0; x < WORLD.width; x += 10) {
        const slope = Math.abs(island.laneY(lane, x + 10) - island.laneY(lane, x)) / 10;
        expect(slope).toBeLessThan(0.9);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Containment: the maps WITHOUT terrain must not have moved
// ---------------------------------------------------------------------------

describe('terrain does not leak into the maps that have none', () => {
  it('leaves the strait answering exactly as it did', () => {
    for (let x = 0; x <= WORLD.width; x += 137) {
      expect(strait.islands).toEqual([]);
      expect(strait.channels(x)).toEqual([{ top: strait.waterTop(x), bottom: strait.waterBottom(x) }]);
      // clampWater is the old two-argument clamp wherever there is no island.
      for (const y of [0, 1500, 1900, WORLD.height]) {
        const old = Math.max(strait.waterTop(x), Math.min(strait.waterBottom(x), y));
        expect(strait.clampWater(x, y)).toBe(old);
      }
    }
  });

  it('agrees with the old band test about what is over water', () => {
    for (const id of ['strait', 'squeeze', 'headlands']) {
      const geo = geography(id);
      for (let x = 0; x <= WORLD.width; x += 311) {
        for (let y = 1000; y < 2400; y += 47) {
          expect(geo.inWater(x, y)).toBe(y >= geo.waterTop(x) && y <= geo.waterBottom(x));
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The lane builder
// ---------------------------------------------------------------------------

describe('lanesAroundIsland', () => {
  const shoreN = flat(WORLD.hostileShoreY);
  const shoreS = flat(WORLD.friendlyShoreY);

  it('refuses a north lane below a south one — that is two crossed lanes', () => {
    expect(() =>
      lanesAroundIsland(shoreN, shoreS, WORLD.shoreWave, WORLD.lanes, [rock], ['south', 'north', 'south']),
    ).toThrow(/north lane must precede/);
  });

  it('refuses a side list that does not match the lanes', () => {
    expect(() =>
      lanesAroundIsland(shoreN, shoreS, WORLD.shoreWave, WORLD.lanes, [rock], ['north']),
    ).toThrow(/one side per lane/);
  });

  it('leaves lanes exactly on their authored line where no island reaches', () => {
    const lanes = lanesAroundIsland(
      shoreN, shoreS, WORLD.shoreWave, WORLD.lanes, [rock], ['north', 'south', 'south'],
      { edgeMargin: 100, minSeparation: 130 },
    );
    const def: GeographyDef = { ...ISLAND_CHANNEL, id: 'probe', lanes };
    const geo = makeGeography(def);
    // Well west of the western tip the map is the strait, lane for lane.
    for (let i = 0; i < WORLD.lanes.length; i++) {
      expect(geo.laneY(i, 0)).toBeCloseTo(WORLD.lanes[i], 6);
    }
  });

  it('routes two lanes north and one south when the rock sits southerly', () => {
    // The side list is the authoring decision, not a property of the shape:
    // a rock nearer the friendly shore leaves room for two lanes above it and
    // one below, and the builder should produce that map just as happily.
    const southerly = { ...rock, id: 'southerly', centerY: 1800, halfHeight: 100 };
    const lanes = lanesAroundIsland(
      shoreN, shoreS, WORLD.shoreWave, WORLD.lanes, [southerly], ['north', 'north', 'south'],
      { edgeMargin: 100, minSeparation: 130 },
    );
    const def: GeographyDef = { ...ISLAND_CHANNEL, id: 'southerly', islands: [southerly], lanes };
    expect(validateGeography(def)).toEqual([]);
    const geo = makeGeography(def);
    const channels = geo.channels(MID_X);
    expect(channels).toHaveLength(2);
    const channelOf = (lane: number): number =>
      channels.findIndex((c) => geo.laneY(lane, MID_X) >= c.top && geo.laneY(lane, MID_X) <= c.bottom);
    expect([channelOf(0), channelOf(1), channelOf(2)]).toEqual([0, 0, 1]);
  });

  it('reports an island that has eaten one of its channels', () => {
    // A rock so tall there is no room north of it: the failure an author needs
    // told about, rather than a map that quietly clamps its convoy onto land.
    const huge = { ...rock, id: 'huge', centerY: 1450, halfHeight: 220 };
    const def: GeographyDef = {
      ...ISLAND_CHANNEL,
      id: 'huge',
      islands: [huge],
      lanes: lanesAroundIsland(
        flat(WORLD.hostileShoreY), flat(WORLD.friendlyShoreY), WORLD.shoreWave,
        WORLD.lanes, [huge], ['north', 'south', 'south'],
      ),
    };
    const problems = validateGeography(def);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => /hostile shore|on land/.test(p.message))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The simulation: nothing afloat is ever on the rock
// ---------------------------------------------------------------------------

const ISLAND_REGION_ID = 'islandTest';

function islandRegion(): RegionDef {
  const def = blankRegion(ISLAND_REGION_ID, REGIONS.homeStrait.start);
  def.environmentPresetId = 'islandChannel';
  def.shapeType = 'islandChannel';
  def.completionRound = 8;
  def.milestones = [
    { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
    { round: 3, add: [{ branch: 'mines', nodeId: 'standard' }] },
    { round: 5, add: [{ branch: 'torpedoes', nodeId: 'straight' }] },
    { round: 5, add: [{ branch: 'attackBoats', nodeId: 'smallArms' }] },
  ];
  // Two adds on round 5 would be two milestones on one round; merge them.
  def.milestones = [
    { round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] },
    { round: 3, add: [{ branch: 'mines', nodeId: 'standard' }] },
    {
      round: 5,
      add: [
        { branch: 'torpedoes', nodeId: 'straight' },
        { branch: 'attackBoats', nodeId: 'smallArms' },
      ],
    },
  ];
  expect(validateRegionAuthoring(def).errors).toEqual([]);
  return toRegionDef(compileRegion(def));
}

/** A transit on the island map carrying whatever this test wants on the water. */
function islandTransit(
  plan: Partial<RoundPlan>,
  mutate?: (c: CampaignState) => void,
): { c: CampaignState; state: TransitState; rng: ReturnType<typeof createRoundTransit>['rng'] } {
  unregisterCustomRegion(ISLAND_REGION_ID);
  registerCustomRegion(islandRegion());
  const c = newRegionalRun('island-seed', ISLAND_REGION_ID);
  c.round = 6;
  mutate?.(c);
  const full: RoundPlan = {
    ...planCurrentRound(c),
    spawns: [],
    mines: [],
    installations: [],
    smoke: [],
    electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
    debuts: [],
    ...plan,
  };
  const { state, rng } = createRoundTransit(c, full);
  return { c, state, rng };
}

/** Every SURFACE unit afloat right now — the things the acceptance criterion
 *  is about. Two deliberate exclusions:
 *
 *   • aircraft, which fly over land and are supposed to;
 *   • torpedoes, which are shore-launched weapons rather than units. Every
 *     emplacement is inland, so a torpedo's first seconds are over its own
 *     beach on every map in the game and always have been. What a torpedo owes
 *     the island is that it cannot CROSS it, which is checked on its own. */
function surfaceUnits(t: TransitState): { x: number; y: number; what: string }[] {
  const out: { x: number; y: number; what: string }[] = [];
  for (const s of t.ships) if (s.spawned && s.alive && !s.delivered) out.push({ x: s.x, y: s.y, what: `ship ${s.name}` });
  for (const e of t.escorts) if (e.alive) out.push({ x: e.x, y: e.y, what: `escort ${e.id}` });
  for (const th of t.threats) {
    if (th.alive && th.kind === 'attackBoat') out.push({ x: th.x, y: th.y, what: `boat ${th.id}` });
  }
  return out;
}

describe('nothing afloat ever ends a tick on the rock', () => {
  it('holds for a full transit with ships, escorts, boats, torpedoes and mines', () => {
    const spawns: SpawnEvent[] = [];
    // Boats and torpedoes from the site standing directly in front of the
    // rock — the launch that has to get round it to reach anything.
    for (let i = 0; i < 4; i++) {
      spawns.push({ time: 6 + i * 5, kind: 'attackBoat', siteX: 2000, boatVariant: 'smallArms' });
      spawns.push({ time: 8 + i * 6, kind: 'torpedo', siteX: 2000 });
      spawns.push({ time: 10 + i * 4, kind: 'missile', siteX: 2000 });
    }
    const { state, rng } = islandTransit({
      spawns,
      // Mines laid across both channels, jittered the way the planner does.
      mines: [
        { x: 1900, y: island.laneY(0, 1900), lowSig: false },
        { x: 2100, y: island.laneY(1, 2100), lowSig: false },
        { x: 2000, y: rock.centerY, lowSig: false },
      ],
    });

    let guard = 0;
    let ticks = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
      stepTransit(state, [], rng);
      ticks++;
      for (const u of surfaceUnits(state)) {
        if (island.isLand(u.x, u.y)) {
          throw new Error(
            `${u.what} is on land at (${Math.round(u.x)}, ${Math.round(u.y)}) after ${ticks} ticks`,
          );
        }
      }
      // And nothing in the water passes THROUGH the rock either.
      for (const th of state.threats) {
        if (th.alive && th.kind === 'torpedo' && onRock(th.x, th.y)) {
          throw new Error(`torpedo ${th.id} is inside the rock after ${ticks} ticks`);
        }
        if (th.alive && th.kind === 'mine' && island.isLand(th.x, th.y)) {
          throw new Error(`mine ${th.id} is on land after ${ticks} ticks`);
        }
      }
    }
    // The round has to have actually happened for the check to mean anything.
    expect(ticks).toBeGreaterThan(100);
    expect(state.stats.boatsLaunched).toBeGreaterThan(0);
    expect(state.stats.torpedoesLaunched).toBeGreaterThan(0);
  });

  it('never leaves a mine, a wreck or a crew on land', () => {
    const spawns: SpawnEvent[] = [];
    for (let i = 0; i < 12; i++) {
      spawns.push({ time: 5 + i * 2, kind: 'missile', siteX: 2000 });
    }
    // A minefield authored straight onto the rock — what a jittered lay, a
    // scripted beat or a careless test can all produce. Placement must fix it.
    const { state, rng } = islandTransit({
      spawns,
      mines: [
        { x: MID_X, y: rock.centerY, lowSig: false },
        { x: MID_X - 200, y: rock.centerY - 40, lowSig: false },
        { x: MID_X + 200, y: rock.centerY + 40, lowSig: true },
      ],
    });
    expect(state.threats.filter((th) => th.kind === 'mine')).toHaveLength(3);
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
      stepTransit(state, [], rng);
      for (const th of state.threats) {
        if (th.kind === 'mine') expect(island.isLand(th.x, th.y)).toBe(false);
      }
      for (const w of state.wreckage) expect(island.isLand(w.x, w.y)).toBe(false);
      for (const s of state.survivors) expect(island.isLand(s.x, s.y)).toBe(false);
    }
  });

  it('runs a torpedo aground on the rock instead of through it', () => {
    // ONE hull, held in the SOUTHERN channel, and torpedoes fired at her from
    // the site standing directly north of the rock. A single ship is what
    // makes the claim exact: with a convoy strung out along the strait some
    // runs go past the island's tips and reach their target quite legitimately,
    // which is the shelter being partial rather than the rule failing. Sailing
    // lane 1, she is abreast of the rock from about t=70 to t=110 (x 1740 to
    // 2716, y around 1930), so every run in that window has the island in it.
    const spawns: SpawnEvent[] = [];
    for (let i = 0; i < 10; i++) spawns.push({ time: 70 + i * 4, kind: 'torpedo', siteX: 2000 });
    const { state, rng } = islandTransit({ spawns }, (c) => {
      c.composition = { cargo: 1, tanker: 0, freighter: 0 };
    });
    for (const ship of state.ships) ship.laneIndex = 1;

    /** Where each torpedo was last seen, so a weapon that vanishes can be
     *  asked where it died. */
    const lastSeen = new Map<number, { x: number; y: number }>();
    const died: { x: number; y: number }[] = [];
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
      stepTransit(state, [], rng);
      const alive = new Set<number>();
      for (const th of state.threats) {
        if (th.kind !== 'torpedo') continue;
        if (th.alive) {
          alive.add(th.id);
          lastSeen.set(th.id, { x: th.x, y: th.y });
          expect(onRock(th.x, th.y)).toBe(false);
        }
      }
      for (const [id, pos] of lastSeen) {
        if (!alive.has(id)) {
          died.push(pos);
          lastSeen.delete(id);
        }
      }
    }

    expect(state.stats.torpedoesLaunched).toBeGreaterThan(0);
    // At least one run ended AT the rock: inside its span, and within a tick's
    // travel of the land it just struck.
    const step = COMBAT.torpedo.speed * SIM.dt;
    const aground = died.filter((p) => {
      if (p.x < rock.fromX || p.x > rock.toX) return false;
      const h = islandHalfHeight(rock, p.x);
      return Math.abs(p.y - rock.centerY) <= h + rock.wave + step * 2;
    });
    expect(aground.length).toBeGreaterThan(0);
    // ...and none of them got through to a hull behind it.
    expect(state.stats.torpedoesHit).toBe(0);
  });

  it('sends a boat around the rock rather than grinding along it', () => {
    const { state, rng } = islandTransit(
      { spawns: [{ time: 1, kind: 'attackBoat', siteX: 2000, boatVariant: 'smallArms' }] },
      (c) => {
        c.composition = { cargo: 1, tanker: 0, freighter: 0 };
      },
    );
    for (const ship of state.ships) ship.laneIndex = 1;
    let guard = 0;
    let closest = Infinity;
    while (!state.over && guard++ < Math.ceil(SIM.maxTransitTime / SIM.dt)) {
      stepTransit(state, [], rng);
      const boat = state.threats.find((th) => th.kind === 'attackBoat' && th.alive);
      const ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered);
      if (boat && ship) {
        closest = Math.min(closest, Math.hypot(boat.x - ship.x, boat.y - ship.y));
        expect(island.isLand(boat.x, boat.y)).toBe(false);
      }
    }
    // Getting round the island is the point: a boat that merely stopped at the
    // rock would never come near the hull it was sent for.
    expect(closest).toBeLessThan(COMBAT.attackBoat.engageRange.smallArms * 1.5);
  });
});

// ---------------------------------------------------------------------------
// The workshop offers it
// ---------------------------------------------------------------------------

describe('the Region Workshop exposes the island', () => {
  it('offers Island Channel as a validated environment preset', () => {
    const preset = environmentPreset('islandChannel');
    expect(preset).toBeDefined();
    expect(preset!.shapeType).toBe('islandChannel');
    expect(preset!.geographyId).toBe('islandChannel');
    expect(GEOGRAPHIES[preset!.geographyId]).toBeDefined();
  });

  it('compiles an authored region onto the island geography', () => {
    const def = blankRegion('islandDraft', REGIONS.homeStrait.start);
    def.environmentPresetId = 'islandChannel';
    def.shapeType = 'islandChannel';
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    expect(validateRegionAuthoring(def).errors).toEqual([]);
    expect(toRegionDef(compileRegion(def)).geography).toBe('islandChannel');
  });

  it('rejects a shape type that does not match the environment', () => {
    const def = blankRegion('mismatch', REGIONS.homeStrait.start);
    def.environmentPresetId = 'islandChannel';
    def.shapeType = 'openWater';
    def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
    expect(validateRegionAuthoring(def).errors.map((e) => e.code)).toContain('shapeType');
  });
});
