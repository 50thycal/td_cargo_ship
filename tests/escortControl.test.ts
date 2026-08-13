// Escort command layer: the order model and the map camera.
//
// These are the two pieces the escort-control overhaul rests on, and both are
// deliberately testable without a browser — the order model is pure sim data,
// and the camera is pure arithmetic. What the canvas draws on top of them is
// not asserted here; what IS asserted is that the player's intent resolves to
// the right order and that the view transform stays honest under zoom and pan.

import { describe, expect, it } from 'vitest';
import { createRoundTransit, newRegionalRun, planCurrentRound } from '../src/sim/campaign';
import { stepTransit } from '../src/sim/transit';
import {
  ACTIVITY_LABELS,
  escortStatus,
  resolveEscortOrder,
  survivorsUnderEscort,
  wreckageUnderEscort,
} from '../src/sim/escortOrders';
import { Camera } from '../src/ui/camera';
import { FIRST_REGION } from '../src/data/regions';
import { SIM, SURVIVORS, WORLD, WRECKAGE } from '../src/data/tuning';
import type { CampaignState, SurvivorArea, TransitState, WreckageField } from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

function quietRun(escorts = 2): { c: CampaignState; state: TransitState; rng: ReturnType<typeof createRoundTransit>['rng'] } {
  const c = newRegionalRun('escort-control', FIRST_REGION);
  while (c.escortUnits.length < escorts) {
    c.escortUnits.push({
      id: c.nextEscortId++,
      name: `Picket ${c.escortUnits.length + 1}`,
      modules: [],
      damage: 0,
    });
  }
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  state.spawnQueue = [];
  state.threats = [];
  return { c, state, rng };
}

let id = 700_000;
function addWreckage(state: TransitState, x: number, y: number): WreckageField {
  const f: WreckageField = {
    id: id++,
    x,
    y,
    branch: 'missiles',
    threatKind: 'missile',
    required: WRECKAGE.recoverSeconds,
    progress: 0,
    expiresAt: state.time + WRECKAGE.lifetimeSeconds,
    recovered: false,
    expired: false,
  };
  state.wreckage.push(f);
  return f;
}

function addSurvivors(state: TransitState, x: number, y: number): SurvivorArea {
  const a: SurvivorArea = {
    id: id++,
    x,
    y,
    shipName: 'Meridian',
    required: SURVIVORS.rescueSeconds,
    progress: 0,
    expiresAt: state.time + SURVIVORS.lifetimeSeconds,
    rescued: false,
    lost: false,
  };
  state.survivors.push(a);
  return a;
}

// ---------------------------------------------------------------------------
// Order resolution — what a tap MEANS
// ---------------------------------------------------------------------------

describe('escort order resolution', () => {
  it('open water is a move-and-hold order', () => {
    const { state } = quietRun();
    const order = resolveEscortOrder(state, 1500, WORLD.lanes[2] + 200, 30);
    expect(order.kind).toBe('move');
    expect(order.hold).toBe(true);
    expect(order.x).toBe(1500);
  });

  it('tapping a wreckage field orders recovery AT the field', () => {
    const { state } = quietRun();
    const field = addWreckage(state, 900, WORLD.lanes[1]);
    // Tapped slightly off-centre — the order still snaps to the field itself,
    // because the escort has to sit inside the area, not near the pixel.
    const order = resolveEscortOrder(state, field.x + 40, field.y + 30, 30);
    expect(order.kind).toBe('recover');
    expect(order.x).toBe(field.x);
    expect(order.y).toBe(field.y);
    expect(order.hold).toBe(true);
  });

  it('tapping survivors orders a rescue, named for the ship that went down', () => {
    const { state } = quietRun();
    const area = addSurvivors(state, 700, WORLD.lanes[0]);
    const order = resolveEscortOrder(state, area.x + 20, area.y, 30);
    expect(order.kind).toBe('rescue');
    expect(order.hold).toBe(true);
    expect(order.message).toContain('Meridian');
  });

  it('tapping the convoy returns the escort to duty, without holding', () => {
    const { state, rng } = quietRun();
    // Let ships enter the world so there is a convoy to tap.
    for (let i = 0; i < Math.ceil(12 / SIM.dt); i++) stepTransit(state, [], rng);
    const ship = state.ships.find((s) => s.spawned && s.alive)!;
    const order = resolveEscortOrder(state, ship.x, ship.y, 30);
    expect(order.kind).toBe('rejoin');
    expect(order.hold).toBe(false); // rejoining means falling back in, not parking
  });

  it('prefers the nearest interactive thing when several are in reach', () => {
    const { state } = quietRun();
    addWreckage(state, 900, WORLD.lanes[1]);
    const near = addSurvivors(state, 930, WORLD.lanes[1]);
    const order = resolveEscortOrder(state, near.x + 5, near.y, 20);
    expect(order.kind).toBe('rescue');
  });

  it('ignores fields that are already finished', () => {
    const { state } = quietRun();
    const field = addWreckage(state, 900, WORLD.lanes[1]);
    field.recovered = true;
    const order = resolveEscortOrder(state, field.x, field.y, 30);
    expect(order.kind).toBe('move'); // nothing left to work here
  });
});

// ---------------------------------------------------------------------------
// Status — why is that escort sitting there
// ---------------------------------------------------------------------------

describe('escort status', () => {
  it('reports escorting by default, and moving once ordered', () => {
    const { state } = quietRun();
    const escort = state.escorts[0];
    expect(escortStatus(state, escort).activity).toBe('escorting');
    escort.moveTarget = { x: 1200, y: WORLD.lanes[2], hold: true };
    const st = escortStatus(state, escort);
    expect(st.activity).toBe('moving');
    expect(st.destination).toEqual({ x: 1200, y: WORLD.lanes[2] });
    expect(st.holding).toBe(true);
  });

  it('reports holding once stationed with no further orders', () => {
    const { state } = quietRun();
    const escort = state.escorts[0];
    escort.stationed = true;
    expect(escortStatus(state, escort).activity).toBe('holding');
  });

  it('reports recovery, with progress, while working a wreckage field', () => {
    const { state, rng } = quietRun();
    const escort = state.escorts[0];
    const field = addWreckage(state, escort.x, escort.y);
    escort.stationed = true;
    expect(wreckageUnderEscort(state, escort)).toBe(field);
    for (let i = 0; i < Math.ceil(2 / SIM.dt); i++) stepTransit(state, [], rng);
    const st = escortStatus(state, escort);
    expect(st.activity).toBe('recovering');
    expect(st.label).toBe(ACTIVITY_LABELS.recovering);
    expect(st.progress).toBeGreaterThan(0);
    expect(st.progress).toBeLessThan(1);
  });

  it('reports rescue while working a survivor area', () => {
    const { state, rng } = quietRun();
    const escort = state.escorts[0];
    const area = addSurvivors(state, escort.x, escort.y);
    escort.stationed = true;
    expect(survivorsUnderEscort(state, escort)).toBe(area);
    for (let i = 0; i < Math.ceil(2 / SIM.dt); i++) stepTransit(state, [], rng);
    expect(escortStatus(state, escort).activity).toBe('rescuing');
  });

  it('recovery work outranks a gun engagement — it is what the ship was sent for', () => {
    const { state } = quietRun();
    const escort = state.escorts[0];
    addWreckage(state, escort.x, escort.y);
    state.threats.push({
      id: 990_001,
      kind: 'attackBoat',
      x: escort.x + 60,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
      hp: 30,
      maxHp: 30,
      boatVariant: 'smallArms',
    });
    escort.gunTargetId = 990_001;
    expect(escortStatus(state, escort).activity).toBe('recovering');
  });

  it('reports engaging when the deck gun is committed to a live boat', () => {
    const { state } = quietRun();
    const escort = state.escorts[0];
    state.threats.push({
      id: 990_002,
      kind: 'attackBoat',
      x: escort.x + 60,
      y: escort.y,
      vx: 0,
      vy: 0,
      speed: 0,
      alive: true,
      revealed: true,
      lowSig: false,
      claimedByInterceptor: false,
      hp: 30,
      maxHp: 30,
      boatVariant: 'smallArms',
    });
    escort.gunTargetId = 990_002;
    expect(escortStatus(state, escort).activity).toBe('engaging');
  });

  it('a lost escort reports lost, and never anything else', () => {
    const { state } = quietRun();
    const escort = state.escorts[0];
    escort.alive = false;
    escort.moveTarget = { x: 100, y: 100, hold: true };
    expect(escortStatus(state, escort).activity).toBe('lost');
  });

  it('every activity has a player-facing label', () => {
    for (const [activity, label] of Object.entries(ACTIVITY_LABELS)) {
      expect(label.length, activity).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1280, height: 720 };
const WORLD_BOUNDS = { width: WORLD.width, height: WORLD.height };
const newCamera = (): Camera => new Camera(WORLD_BOUNDS, VIEWPORT);
/** Run the camera to rest so target/actual converge before asserting. */
const settle = (cam: Camera): void => {
  for (let i = 0; i < 400; i++) cam.update(1 / 60);
};

describe('map camera', () => {
  it('opens on a slice of the strait, but can still be pulled out to all of it', () => {
    // Opening fitted would draw a map this size into a phone screen, which is
    // just everything at half size. It opens closer in, at roughly the apparent
    // scale the old smaller world had — and the rest of the strait is a zoom or
    // a pan away rather than unreachable.
    const cam = newCamera();
    settle(cam);
    expect(cam.zoom).toBeCloseTo(cam.openingZoom(), 6);
    expect(cam.openingZoom()).toBeGreaterThan(cam.fitZoom());
    const visibleW = cam.screenToWorldX(VIEWPORT.width) - cam.screenToWorldX(0);
    expect(visibleW).toBeLessThan(WORLD.width);
    // …and pulling all the way out really does show the whole world.
    for (let i = 0; i < 30; i++) cam.zoomBy(0.5, 640, 360);
    settle(cam);
    expect(cam.zoom).toBeCloseTo(cam.fitZoom(), 6);
    expect(cam.isFitted()).toBe(true);
  });

  it('round-trips world → screen → world at any zoom', () => {
    const cam = newCamera();
    for (const factor of [1, 1.8, 3.4]) {
      cam.zoomBy(factor, VIEWPORT.width / 2, VIEWPORT.height / 2);
      settle(cam);
      for (const [wx, wy] of [[120, 200], [1000, 500], [1880, 880]]) {
        expect(cam.screenToWorldX(cam.worldToScreenX(wx))).toBeCloseTo(wx, 6);
        expect(cam.screenToWorldY(cam.worldToScreenY(wy))).toBeCloseTo(wy, 6);
      }
    }
  });

  it('zooms about the cursor, keeping that world point under it', () => {
    const cam = newCamera();
    const anchorX = 900;
    const anchorY = 300;
    const worldBefore = { x: cam.screenToWorldX(anchorX), y: cam.screenToWorldY(anchorY) };
    cam.zoomBy(2.2, anchorX, anchorY);
    settle(cam);
    expect(cam.screenToWorldX(anchorX)).toBeCloseTo(worldBefore.x, 1);
    expect(cam.screenToWorldY(anchorY)).toBeCloseTo(worldBefore.y, 1);
  });

  it('never zooms out past its floor, nor in past the max', () => {
    const cam = newCamera();
    for (let i = 0; i < 20; i++) cam.zoomBy(0.5, 640, 360);
    settle(cam);
    expect(cam.zoom).toBeCloseTo(cam.minZoom(), 6);
    for (let i = 0; i < 40; i++) cam.zoomBy(2, 640, 360);
    settle(cam);
    expect(cam.zoom).toBeCloseTo(cam.maxZoom(), 6);
  });

  it('cannot be panned off the edge of the world', () => {
    const cam = newCamera();
    cam.zoomBy(3, 640, 360);
    settle(cam);
    for (let i = 0; i < 60; i++) cam.panByScreen(400, 400);
    settle(cam);
    // The visible window still lies inside the world on both axes.
    expect(cam.screenToWorldX(0)).toBeGreaterThanOrEqual(-0.001);
    expect(cam.screenToWorldY(0)).toBeGreaterThanOrEqual(-0.001);
    for (let i = 0; i < 120; i++) cam.panByScreen(-400, -400);
    settle(cam);
    expect(cam.screenToWorldX(VIEWPORT.width)).toBeLessThanOrEqual(WORLD.width + 0.001);
    expect(cam.screenToWorldY(VIEWPORT.height)).toBeLessThanOrEqual(WORLD.height + 0.001);
  });

  it('can be panned at the widest zoom, because the world is bigger than it', () => {
    const cam = newCamera();
    settle(cam);
    const x0 = cam.x;
    cam.panByScreen(-500, 0);
    settle(cam);
    // Horizontally there is world to spare, so the view moves…
    expect(cam.x).toBeGreaterThan(x0);
    // …and still cannot be dragged off the edge of it.
    expect(cam.screenToWorldX(VIEWPORT.width)).toBeLessThanOrEqual(WORLD.width + 0.001);
  });

  it('eases toward its target rather than snapping', () => {
    const cam = newCamera();
    cam.zoomBy(3, 640, 360);
    settle(cam);
    const startX = cam.x;
    cam.centreOn(WORLD.width - 200, cam.y);
    cam.update(1 / 60); // one frame only
    expect(cam.x).toBeGreaterThan(startX); // it moved…
    expect(cam.x).toBeLessThan(WORLD.width - 200); // …but did not arrive
    settle(cam);
    expect(cam.x).toBeCloseTo(Math.min(WORLD.width - 200, cam.x), 6);
  });

  it('follows the convoy until the player takes the wheel', () => {
    const cam = newCamera();
    cam.zoomBy(3, 640, 360);
    // Follow points taken from the middle of the world rather than fixed
    // coordinates: near an edge the pan clamp legitimately refuses to centre,
    // and this test is about FOLLOWING, not about clamping.
    const midY = WORLD.height / 2;
    const a = WORLD.width * 0.4;
    const b = WORLD.width * 0.6;
    cam.follow(a, midY);
    settle(cam);
    expect(cam.isFollowing()).toBe(true);
    expect(cam.x).toBeCloseTo(a, 0);
    cam.updateFollowTarget(b, midY);
    settle(cam);
    expect(cam.x).toBeCloseTo(b, 0);
    // A manual pan releases it — the player's hands always win.
    cam.panByScreen(30, 0);
    expect(cam.isFollowing()).toBe(false);
  });

  it('resetToFit returns to the whole-world view', () => {
    const cam = newCamera();
    cam.zoomBy(3.5, 200, 200);
    cam.follow(1500, 800);
    settle(cam);
    expect(cam.isFitted()).toBe(false);
    cam.resetToFit();
    settle(cam);
    expect(cam.isFitted()).toBe(true);
    expect(cam.isFollowing()).toBe(false);
  });

  it('keeps tap tolerance constant on screen as zoom changes', () => {
    const cam = newCamera();
    const atFit = cam.worldPerPixel();
    cam.zoomBy(2, 640, 360);
    settle(cam);
    // Zoomed in 2×, a screen pixel covers half as much water — so a fixed
    // pixel tap radius picks a tighter world radius, which is the point.
    expect(cam.worldPerPixel()).toBeCloseTo(atFit / 2, 4);
  });

  it('magnifies at the opening zoom, so ships keep their old apparent size', () => {
    // detailScale is what the renderer multiplies every sprite by, measured
    // against the whole-world baseline. The camera opens above that baseline,
    // which is exactly what keeps ships the size they have always been now the
    // strait around them is bigger.
    const cam = newCamera();
    settle(cam);
    expect(cam.detailScale()).toBeCloseTo(cam.openingZoom() / cam.fitZoom(), 6);
    expect(cam.detailScale()).toBeGreaterThan(1);
  });

  it('magnification tracks zoom, so sprites grow with the world', () => {
    const cam = newCamera();
    settle(cam);
    const base = cam.detailScale();
    cam.zoomBy(2, 640, 360);
    settle(cam);
    expect(cam.detailScale()).toBeCloseTo(base * 2, 4);
    cam.zoomBy(2, 640, 360);
    settle(cam);
    expect(cam.detailScale()).toBeCloseTo(base * 4, 4);
  });

  it('fit-space position times magnification IS the true screen position', () => {
    // The renderer draws the world at fit scale under a detailScale transform.
    // That only lands in the right place if the two compose back to exactly
    // what worldToScreen would have given — this is that identity.
    const cam = newCamera();
    cam.zoomBy(2.5, 300, 500);
    settle(cam);
    const k = cam.detailScale();
    for (const [wx, wy] of [
      [0, 0],
      [900, 400],
      [2000, 1000],
      [1234, 87],
    ]) {
      const fx = cam.fitScreenX(wx);
      const fy = cam.fitScreenY(wy);
      // The canvas transform: scale about the viewport centre.
      expect((fx - 1280 / 2) * k + 1280 / 2).toBeCloseTo(cam.worldToScreenX(wx), 4);
      expect((fy - 720 / 2) * k + 720 / 2).toBeCloseTo(cam.worldToScreenY(wy), 4);
    }
  });
});
