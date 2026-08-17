// Map camera: zoom, pan, and smoothing for the transit view.
//
// Deliberately a standalone module with no knowledge of the game. It owns one
// job — the mapping between world coordinates and canvas pixels, and how that
// mapping is allowed to change — so the view can stay about drawing and input
// can stay about intent. Future map features (minimap, cinematic focus on a
// loss, follow-the-selected-escort) plug in here rather than into the renderer.
//
// Model: the camera holds a world-space CENTRE and a zoom in canvas-pixels per
// world unit. Every change is written to a TARGET and eased toward each frame,
// so nothing the player does snaps — including the ordinary case of the world
// scrolling under a stationary convoy.

export interface CameraBounds {
  width: number;
  height: number;
}

export interface CameraViewport {
  width: number;
  height: number;
}

/** How fast the camera converges on its target (per second, exponential). */
const SMOOTHING = 9;
/** Below this it is not worth easing — snap and stop doing float work. */
const EPSILON = 0.01;

export class Camera {
  /** Current (rendered) centre and zoom. */
  x: number;
  y: number;
  zoom: number;
  /** Where the camera is heading. Input writes here, never to the above. */
  private targetX: number;
  private targetY: number;
  private targetZoom: number;

  constructor(
    private readonly world: CameraBounds,
    private readonly viewport: CameraViewport,
    /** The world size the renderer's hard-coded pixel sizes were authored
     *  against. Defaults to the world itself (the old behaviour); passing a
     *  FIXED reference instead pins sprites to a constant WORLD size, so
     *  growing the map does not silently grow every ship drawn on it. */
    private readonly spriteReference: CameraBounds = world,
  ) {
    this.zoom = this.openingZoom();
    this.targetZoom = this.zoom;
    this.x = world.width / 2;
    this.y = world.height / 2;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  /** The zoom at which the whole world would be visible — the floor of the
   *  zoom range. NOT the baseline sprites are drawn against; see baseZoom. */
  fitZoom(): number {
    return Math.min(this.viewport.width / this.world.width, this.viewport.height / this.world.height);
  }

  /** The scale the world layer is DRAWN at before magnification — the baseline
   *  every hard-coded pixel size in the renderer is expressed against.
   *
   *  Anchored to the sprite REFERENCE world rather than the actual world.
   *  When this was fitZoom itself, a hard-coded "10 px" hull was 10/fitZoom
   *  world units, so any growth in the world grew every sprite with it —
   *  deepening the shores made the ships a half bigger while their lane
   *  spacing stayed put, and the convoy read as giants in a paddling pool.
   *  Against a fixed reference, a sprite is a fixed number of WORLD units and
   *  the map can grow without touching how big a ship is. */
  baseZoom(): number {
    return Math.min(
      this.viewport.width / this.spriteReference.width,
      this.viewport.height / this.spriteReference.height,
    );
  }

  /** Where the camera STARTS, as a multiple of fitZoom.
   *
   *  Not a floor — the player can still pull all the way out to see the whole
   *  strait, and should be able to. This is about what the round OPENS on.
   *  Fitting the whole world in at the start would draw a map twice the size
   *  into the same screen, which is just everything at half size; at 2 the
   *  opening view has roughly the apparent scale the old 2000-wide world did,
   *  so ships are the size they have always been and the extra water is extra
   *  water rather than a shrunken picture. Panning room comes from the same
   *  place: there is more strait than the opening view shows. */
  private static readonly OPENING_ZOOM_OVER_FIT = 2;

  openingZoom(): number {
    // Never below the bound — on a tall viewport the cover zoom is the wider
    // of the two, and an opening view outside the allowed range would snap on
    // the first frame.
    return Math.max(this.fitZoom() * Camera.OPENING_ZOOM_OVER_FIT, this.minZoom());
  }

  /** The widest the camera goes: the zoom at which the viewport is exactly
   *  COVERED by the world.
   *
   *  This used to be fitZoom — the whole world in the window — and that is the
   *  one view the map cannot survive being seen at. The coastlines are drawn
   *  only across x = 0..WORLD.width; pull out past cover and the viewport
   *  contains the world's rectangular edge, where both land masses run into the
   *  boundary and close on each other. It reads as the strait pinching shut, a
   *  piece of geography that does not exist.
   *
   *  MAX of the two ratios, not MIN: min fits the world inside the viewport
   *  (edges visible on the slack axis), max fits the viewport inside the world
   *  (no edge ever visible on either). Only the BOUND moves — baseZoom, and
   *  therefore how big anything is drawn, is anchored to WORLD.spriteReference
   *  and is untouched by this. */
  minZoom(): number {
    return Math.max(
      this.viewport.width / this.world.width,
      this.viewport.height / this.world.height,
    );
  }

  maxZoom(): number {
    return this.fitZoom() * 8;
  }

  /** True when the camera is showing everything — used by the HUD to label the
   *  zoom control honestly rather than guessing. */
  isFitted(): boolean {
    return this.zoom <= this.minZoom() + 1e-4;
  }

  /** The magnification the world layer's canvas transform applies on top of
   *  baseZoom — together they compose to the true `zoom`, so positions land
   *  exactly where worldToScreen would put them.
   *
   *  A renderer that draws the world at `baseZoom` and then applies this as a
   *  canvas transform gets magnification for free — sprites, line weights and
   *  every hard-coded pixel size scale together, which is what zooming in is
   *  supposed to mean. Drawing straight at `zoom` instead gives you a camera
   *  that moves the world around under a fixed-size stencil. */
  detailScale(): number {
    return this.zoom / this.baseZoom();
  }

  /** World → canvas position at BASE scale (pan applied, magnification not).
   *  Feed these to a context already carrying the detailScale() transform. */
  fitScreenX(wx: number): number {
    return (wx - this.x) * this.baseZoom() + this.viewport.width / 2;
  }

  fitScreenY(wy: number): number {
    return (wy - this.y) * this.baseZoom() + this.viewport.height / 2;
  }

  // -------------------------------------------------------------------------
  // Transforms
  // -------------------------------------------------------------------------

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.zoom + this.viewport.width / 2;
  }

  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.zoom + this.viewport.height / 2;
  }

  screenToWorldX(sx: number): number {
    return (sx - this.viewport.width / 2) / this.zoom + this.x;
  }

  screenToWorldY(sy: number): number {
    return (sy - this.viewport.height / 2) / this.zoom + this.y;
  }

  /** World units per canvas pixel — what a hit radius in px is worth out there.
   *  Keeps tap tolerances constant on screen at every zoom level. */
  worldPerPixel(): number {
    return 1 / this.zoom;
  }

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  /** Zoom by a multiplicative factor, keeping the world point currently under
   *  (anchorX, anchorY) in canvas space pinned there. This is what makes wheel
   *  and pinch zoom feel like the map is being handled rather than resized. */
  zoomBy(factor: number, anchorX: number, anchorY: number): void {
    const before = this.targetZoom;
    const next = clamp(before * factor, this.minZoom(), this.maxZoom());
    if (next === before) return;
    // Solve for the centre that keeps the anchor's world point stationary.
    const worldAnchorX = (anchorX - this.viewport.width / 2) / before + this.targetX;
    const worldAnchorY = (anchorY - this.viewport.height / 2) / before + this.targetY;
    this.targetZoom = next;
    this.targetX = worldAnchorX - (anchorX - this.viewport.width / 2) / next;
    this.targetY = worldAnchorY - (anchorY - this.viewport.height / 2) / next;
    this.clampTarget();
  }

  /** Drag the map by a screen-space delta. */
  panByScreen(dx: number, dy: number): void {
    this.targetX -= dx / this.targetZoom;
    this.targetY -= dy / this.targetZoom;
    this.clampTarget();
  }

  /** Ease toward a world point once. */
  centreOn(wx: number, wy: number): void {
    this.targetX = wx;
    this.targetY = wy;
    this.clampTarget();
  }

  /** Is this world point inside the CURRENT view, with a margin in canvas px?
   *
   *  The margin exists because "just inside the edge" is not really on screen:
   *  a ship half under the HUD is one the player still has to go looking for. */
  isOnScreen(wx: number, wy: number, marginPx = 0): boolean {
    const sx = this.worldToScreenX(wx);
    const sy = this.worldToScreenY(wy);
    return (
      sx >= marginPx &&
      sx <= this.viewport.width - marginPx &&
      sy >= marginPx &&
      sy <= this.viewport.height - marginPx
    );
  }

  /** Bring a world point into view, but ONLY if it is not already there.
   *
   *  This is the whole of the game's automatic camera. Centring on something
   *  the player can already see is the camera moving for no reason — it steals
   *  the frame they had chosen and reads as a jolt. Returns true if it moved. */
  revealIfOffScreen(wx: number, wy: number, marginPx = 0): boolean {
    if (this.isOnScreen(wx, wy, marginPx)) return false;
    this.centreOn(wx, wy);
    return true;
  }

  // -------------------------------------------------------------------------
  // Frame update
  // -------------------------------------------------------------------------

  update(dtReal: number): void {
    // Frame-rate independent exponential ease. At 60fps this converges in a
    // few frames; at 20fps it converges in the same wall-clock time.
    const t = 1 - Math.exp(-SMOOTHING * dtReal);
    this.zoom += (this.targetZoom - this.zoom) * t;
    this.x += (this.targetX - this.x) * t;
    this.y += (this.targetY - this.y) * t;
    if (Math.abs(this.targetZoom - this.zoom) < EPSILON * 0.01) this.zoom = this.targetZoom;
    if (Math.abs(this.targetX - this.x) < EPSILON) this.x = this.targetX;
    if (Math.abs(this.targetY - this.y) < EPSILON) this.y = this.targetY;
  }

  /** Keep the viewport inside the world, on both axes, always.
   *
   *  minZoom guarantees the viewport is no larger than the world, so the clamp
   *  range is real and there is no "this axis is fully visible" case to handle
   *  any more — that case WAS the bug: it pinned the camera to the world centre
   *  and showed the boundary either side. The guard below only covers a
   *  degenerate viewport (zero-size canvas during layout). */
  private clampTarget(): void {
    const halfW = this.viewport.width / (2 * this.targetZoom);
    const halfH = this.viewport.height / (2 * this.targetZoom);
    this.targetX =
      halfW * 2 >= this.world.width
        ? this.world.width / 2
        : clamp(this.targetX, halfW, this.world.width - halfW);
    this.targetY =
      halfH * 2 >= this.world.height
        ? this.world.height / 2
        : clamp(this.targetY, halfH, this.world.height - halfH);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
