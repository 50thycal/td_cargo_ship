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
import { escortTag } from '../src/ui/transitView';
import { ESCORT_DEFAULT_NAMES } from '../src/data/defs';
import { ESCORT_HULLS, escortHull } from '../src/data/escortHulls';
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
  it('opens on a slice of the strait, and pulls out only as far as it may', () => {
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
    // …and pulling all the way out stops at COVER, not at fit. Fit is the view
    // that contains the world's own edge, which is the one thing the map may
    // never show; the widest allowed view is the largest one still entirely
    // inside the water and land that has been drawn.
    for (let i = 0; i < 30; i++) cam.zoomBy(0.5, 640, 360);
    settle(cam);
    expect(cam.zoom).toBeCloseTo(cam.minZoom(), 6);
    expect(cam.minZoom()).toBeGreaterThan(cam.fitZoom());
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

  it('never shows anything outside the world, even at the widest zoom', () => {
    // THE bound this camera exists to hold. The coastlines are only drawn
    // across the world's own width, so a view containing the boundary shows
    // both land masses running into it and closing on each other — the strait
    // appearing to pinch shut on a piece of geography that does not exist.
    const cam = newCamera();
    for (let i = 0; i < 30; i++) cam.zoomBy(0.5, 640, 360); // pull all the way out
    settle(cam);
    for (const px of [0, VIEWPORT.width]) {
      expect(cam.screenToWorldX(px)).toBeGreaterThanOrEqual(-0.001);
      expect(cam.screenToWorldX(px)).toBeLessThanOrEqual(WORLD.width + 0.001);
    }
    for (const py of [0, VIEWPORT.height]) {
      expect(cam.screenToWorldY(py)).toBeGreaterThanOrEqual(-0.001);
      expect(cam.screenToWorldY(py)).toBeLessThanOrEqual(WORLD.height + 0.001);
    }
    // And it still cannot be dragged out of the world from there.
    for (let i = 0; i < 60; i++) cam.panByScreen(-500, -500);
    settle(cam);
    expect(cam.screenToWorldX(VIEWPORT.width)).toBeLessThanOrEqual(WORLD.width + 0.001);
    expect(cam.screenToWorldY(VIEWPORT.height)).toBeLessThanOrEqual(WORLD.height + 0.001);
  });

  it('opens no wider than it is allowed to go', () => {
    const cam = newCamera();
    expect(cam.openingZoom()).toBeGreaterThanOrEqual(cam.minZoom() - 1e-9);
  });

  it('reveals a point only when it is off screen', () => {
    // The whole of the automatic camera: bring a selected escort into view if
    // she is not in it, and otherwise leave the frame the player set alone.
    const cam = newCamera();
    cam.zoomBy(3, 640, 360);
    settle(cam);
    const centreX = cam.x;
    const centreY = cam.y;

    // Already in the middle of the view: no movement at all.
    expect(cam.revealIfOffScreen(centreX, centreY, 40)).toBe(false);
    settle(cam);
    expect(cam.x).toBeCloseTo(centreX, 6);
    expect(cam.y).toBeCloseTo(centreY, 6);

    // Well outside it: the camera goes and gets it.
    const farX = Math.min(WORLD.width - 1, centreX + VIEWPORT.width / cam.zoom);
    expect(cam.revealIfOffScreen(farX, centreY, 40)).toBe(true);
    settle(cam);
    expect(cam.isOnScreen(farX, centreY, 40)).toBe(true);
  });

  it('counts a point hidden under the HUD margin as off screen', () => {
    // "Just inside the edge" is not really visible — the HUD bar and the escort
    // roster sit over the stage, so a hull beneath one still has to be hunted.
    const cam = newCamera();
    cam.zoomBy(3, 640, 360);
    settle(cam);
    const nearEdge = cam.screenToWorldX(VIEWPORT.width - 20);
    expect(cam.isOnScreen(nearEdge, cam.y, 0)).toBe(true);
    expect(cam.isOnScreen(nearEdge, cam.y, 90)).toBe(false);
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

// ---------------------------------------------------------------------------
// Escorts navigate around each other
// ---------------------------------------------------------------------------

describe('escort-vs-escort navigation', () => {
  it('an escort steers around a stationed sister instead of driving through her', () => {
    const { state, rng } = quietRun(2);
    const [mover, blocker] = state.escorts;
    // The blocker holds station dead on the mover's ordered track.
    blocker.x = 1400;
    blocker.y = WORLD.lanes[1];
    blocker.moveTarget = null;
    blocker.stationed = true;
    mover.x = 1000;
    mover.y = WORLD.lanes[1];
    mover.heading = 0;
    mover.stationed = false;
    mover.moveTarget = { x: 1800, y: WORLD.lanes[1], hold: true };

    let minSep = Infinity;
    for (let i = 0; i < Math.ceil(60 / SIM.dt) && mover.moveTarget; i++) {
      stepTransit(state, [], rng);
      minSep = Math.min(minSep, Math.hypot(mover.x - blocker.x, mover.y - blocker.y));
    }
    // The order was carried out...
    expect(mover.moveTarget).toBeNull();
    expect(Math.hypot(mover.x - 1800, mover.y - WORLD.lanes[1])).toBeLessThan(60);
    // ...and the pass kept real clear water. The last-resort overlap push
    // alone would only guarantee ~28 units; steering keeps meaningfully more.
    expect(minSep).toBeGreaterThan(50);
    expect(Number.isFinite(mover.x)).toBe(true);
    expect(Number.isFinite(mover.y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The round holds for crews in the water
// ---------------------------------------------------------------------------

describe('round end vs pending rescues', () => {
  const deliverEveryone = (state: TransitState): void => {
    for (const ship of state.ships) {
      ship.spawned = true;
      ship.delivered = true;
    }
  };

  it('crews in the water hold the round open until rescued', () => {
    const { state, rng } = quietRun(1);
    deliverEveryone(state);
    const escort = state.escorts[0];
    const area = addSurvivors(state, 900, WORLD.lanes[1]);
    // One tick with a pending rescue: the convoy is home, the round is not over.
    stepTransit(state, [], rng);
    expect(state.over).toBe(false);
    // Escort works the area; the moment the crew is aboard the round closes.
    escort.x = area.x;
    escort.y = area.y;
    escort.moveTarget = null;
    escort.stationed = true;
    let guard = 0;
    while (!state.over && guard++ < Math.ceil(SURVIVORS.rescueSeconds * 3 / SIM.dt)) {
      stepTransit(state, [], rng);
    }
    expect(area.rescued).toBe(true);
    expect(state.over).toBe(true);
    expect(state.stats.survivorsRescued).toBe(1);
  });

  it('an unreachable crew bounds the wait by its own lifetime', () => {
    const { state, rng } = quietRun(1);
    deliverEveryone(state);
    // Far from any escort, and nobody is sent: the area expires on its clock
    // and the round then ends with the loss recorded.
    const area = addSurvivors(state, 3400, WORLD.lanes[0]);
    state.escorts[0].stationed = true; // hold clear so no accidental rescue
    let guard = 0;
    while (!state.over && guard++ < Math.ceil((SURVIVORS.lifetimeSeconds + 10) / SIM.dt)) {
      stepTransit(state, [], rng);
    }
    expect(state.over).toBe(true);
    expect(area.lost).toBe(true);
    expect(state.stats.survivorsLost).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Sprite reference: ships keep a constant world size as the map grows
// ---------------------------------------------------------------------------

describe('camera sprite reference', () => {
  it('anchors the drawing baseline to the reference world, not the actual one', () => {
    const reference = { width: 4000, height: 2250 };
    const cam = new Camera(WORLD_BOUNDS, VIEWPORT, reference);
    // Height-limited viewport: base scale comes from the fixed reference, so
    // deepening the world (3375 high here) does not shrink it.
    expect(cam.baseZoom()).toBeCloseTo(VIEWPORT.height / reference.height, 6);
    expect(cam.baseZoom()).toBeGreaterThan(cam.fitZoom());
    // The compose identity must still hold: base-space position times the
    // detail transform lands exactly where worldToScreen says.
    settle(cam);
    const k = cam.detailScale();
    for (const [wx, wy] of [
      [0, 0],
      [900, 400],
      [2000, 3000],
    ]) {
      const fx = cam.fitScreenX(wx);
      const fy = cam.fitScreenY(wy);
      expect((fx - VIEWPORT.width / 2) * k + VIEWPORT.width / 2).toBeCloseTo(cam.worldToScreenX(wx), 4);
      expect((fy - VIEWPORT.height / 2) * k + VIEWPORT.height / 2).toBeCloseTo(cam.worldToScreenY(wy), 4);
    }
  });
});

// ---------------------------------------------------------------------------
// The roster's short codes
// ---------------------------------------------------------------------------

describe('escort roster codes', () => {
  it('gives every name in the pool a distinct code', () => {
    // The roster shows codes, not names — so two ships wearing the same code
    // would be two rows the player cannot tell apart.
    const codes = ESCORT_DEFAULT_NAMES.map(escortTag);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{3}$/);
  });

  it('uses initials for a name the player typed in words', () => {
    expect(escortTag('Iron Duke')).toBe('ID');
    expect(escortTag('  Queen  of the   South ')).toBe('QOTS');
    expect(escortTag('Vanguard')).toBe('VAN');
  });

  it('never renders an empty label', () => {
    expect(escortTag('   ').length).toBeGreaterThan(0);
    expect(escortTag('Ab')).toBe('AB');
  });
});

// ---------------------------------------------------------------------------
// Drawn routes — a path is a queue of ordinary move orders
// ---------------------------------------------------------------------------

describe('escort routes', () => {
  /** Run the sim until the predicate holds or the guard trips. */
  function until(
    state: TransitState,
    rng: ReturnType<typeof createRoundTransit>['rng'],
    done: () => boolean,
    seconds = 240,
  ): boolean {
    const steps = Math.ceil(seconds / SIM.dt);
    for (let i = 0; i < steps; i++) {
      if (done()) return true;
      stepTransit(state, [], rng);
    }
    return done();
  }

  it('takes the first point as the destination and queues the rest', () => {
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const pts = [
      { x: e.x + 300, y: e.y - 200 },
      { x: e.x + 600, y: e.y - 200 },
      { x: e.x + 900, y: e.y + 100 },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: false }], rng);
    expect(e.moveTarget).not.toBeNull();
    expect(e.moveTarget!.x).toBeCloseTo(pts[0].x, 0);
    expect(e.waypoints).toHaveLength(2);
  });

  it('steams the legs in order, popping one at a time', () => {
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    for (const esc of state.escorts) esc.stationed = true;
    const pts = [
      { x: e.x + 250, y: e.y - 150 },
      { x: e.x + 500, y: e.y - 150 },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: false }], rng);
    expect(e.waypoints).toHaveLength(1);
    // First leg reached: the queue shortens and the second becomes the target.
    expect(until(state, rng, () => e.waypoints.length === 0)).toBe(true);
    expect(e.moveTarget?.x).toBeCloseTo(pts[1].x, 0);
    // Second leg reached: the route is finished and she is under way again.
    expect(until(state, rng, () => e.moveTarget === null)).toBe(true);
  });

  it('a route can go somewhere a straight line would not', () => {
    // The point of drawing one: the ship follows the CURVE, so she can be sent
    // around something rather than through it. Asserted as "she visits a
    // waypoint that is well off the straight line to the destination".
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    for (const esc of state.escorts) esc.stationed = true;
    const startY = e.y;
    const detourY = startY - 260;
    const pts = [
      { x: e.x + 300, y: detourY },
      { x: e.x + 600, y: startY },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: false }], rng);
    let peak = startY;
    const steps = Math.ceil(240 / SIM.dt);
    for (let i = 0; i < steps && (e.moveTarget || e.waypoints.length); i++) {
      peak = Math.min(peak, e.y);
      stepTransit(state, [], rng);
    }
    // She really did go up and around, not straight across.
    expect(peak).toBeLessThan(startY - 120);
  });

  it('only the LAST leg carries the hold', () => {
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const pts = [
      { x: e.x + 250, y: e.y },
      { x: e.x + 500, y: e.y },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: true }], rng);
    // The flag rides every leg and is only ACTED ON at the end.
    expect(until(state, rng, () => e.waypoints.length === 0)).toBe(true);
    expect(e.moveTarget!.hold).toBe(true);
    expect(until(state, rng, () => e.moveTarget === null)).toBe(true);
    expect(e.stationed).toBe(true); // the end of the route stations her
  });

  it('a fresh single order abandons the route rather than queueing behind it', () => {
    // An order is an order. Anything else means a tap does nothing visible
    // until the ship has finished a route the player has already changed their
    // mind about.
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const pts = [
      { x: e.x + 300, y: e.y - 200 },
      { x: e.x + 600, y: e.y - 200 },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: false }], rng);
    expect(e.waypoints.length).toBeGreaterThan(0);
    // Somewhere well inside the world, captured up front — the escort is
    // moving, so reading e.x inside the assertion would compare against a
    // position she has already left.
    const redirect = { x: e.x + 800, y: e.y + 150 };
    stepTransit(
      state,
      [{ type: 'moveEscort', escortId: e.id, x: redirect.x, y: redirect.y, hold: true }],
      rng,
    );
    expect(e.waypoints).toHaveLength(0);
    expect(e.moveTarget!.x).toBeCloseTo(redirect.x, 0);
  });

  it('thins points too close together to be steamed to', () => {
    // A finger emits a point per frame. Points inside the arrival radius would
    // all count as reached at once and the route would collapse into its
    // endpoint.
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const dense = Array.from({ length: 40 }, (_, i) => ({ x: e.x + 200 + i * 2, y: e.y }));
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: dense, hold: false }], rng);
    expect(e.waypoints.length).toBeLessThan(dense.length / 2);
  });

  it('says it is on a route, and how many legs are left', () => {
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const pts = [
      { x: e.x + 300, y: e.y },
      { x: e.x + 600, y: e.y },
      { x: e.x + 900, y: e.y },
    ];
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: pts, hold: false }], rng);
    expect(escortStatus(state, e).label).toContain('3 legs');
    // A plain move order is still just "Moving" — the route wording only shows
    // up when there IS a route.
    stepTransit(state, [{ type: 'moveEscort', escortId: e.id, x: e.x + 400, y: e.y, hold: false }], rng);
    expect(escortStatus(state, e).label).toBe(ACTIVITY_LABELS.moving);
  });

  it('ignores an empty route', () => {
    const { state, rng } = quietRun(1);
    const e = state.escorts[0];
    const before = e.moveTarget;
    stepTransit(state, [{ type: 'pathEscort', escortId: e.id, points: [], hold: false }], rng);
    expect(e.moveTarget).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Hull varieties — cosmetic, but they have to be consistent
// ---------------------------------------------------------------------------

describe('escort hull classes', () => {
  it('offers six, each with both views and a distinct name', () => {
    expect(ESCORT_HULLS).toHaveLength(6);
    const names = new Set(ESCORT_HULLS.map((hd) => hd.name));
    expect(names.size).toBe(6);
    for (const hd of ESCORT_HULLS) {
      expect(hd.profile.length).toBeGreaterThan(0);
      expect(hd.plan.points.length).toBeGreaterThanOrEqual(4);
      expect(hd.plan.house).toHaveLength(4);
    }
  });

  it('gives the opening flotilla visibly different ships', () => {
    // Walking the list in order rather than hashing means the first few hulls
    // a player is ever given cannot come out identical.
    const first = [1, 2, 3].map((id) => escortHull(id).id);
    expect(new Set(first).size).toBe(3);
  });

  it('is stable for the life of a ship, and identical on replay', () => {
    expect(escortHull(4).id).toBe(escortHull(4).id);
    const a = quietRun(2);
    const b = quietRun(2);
    expect(a.state.escorts.map((e) => escortHull(e.unitId).id)).toEqual(
      b.state.escorts.map((e) => escortHull(e.unitId).id),
    );
  });

  it('handles ids past the end of the list without falling off it', () => {
    for (const id of [7, 12, 30, 1000]) {
      expect(ESCORT_HULLS).toContain(escortHull(id));
    }
  });

  it('changes nothing mechanical — the hull is a face, not a stat', () => {
    // Guarded because the temptation to hang a stat off it later is obvious,
    // and doing so would make a purchase the player cannot re-roll into a
    // lottery on top of everything else an escort already carries.
    for (const hd of ESCORT_HULLS) {
      expect(Object.keys(hd).sort()).toEqual(['id', 'name', 'plan', 'profile']);
    }
  });
});
