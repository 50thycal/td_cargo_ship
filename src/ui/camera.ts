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
  /** While set, the camera re-centres on this point every frame (Center
   *  Convoy). Any manual pan or pinch clears it — the player's hands always
   *  win over automation. */
  private following: { x: number; y: number } | null = null;

  constructor(
    private readonly world: CameraBounds,
    private readonly viewport: CameraViewport,
  ) {
    this.zoom = this.openingZoom();
    this.targetZoom = this.zoom;
    this.x = world.width / 2;
    this.y = world.height / 2;
    this.targetX = this.x;
    this.targetY = this.y;
  }

  /** The zoom at which the whole world would be visible. Kept as the reference
   *  for detailScale below — it is the "one world, one screen" baseline that
   *  every hard-coded pixel size is expressed against — but it is NO LONGER the
   *  minimum the player can reach. */
  fitZoom(): number {
    return Math.min(this.viewport.width / this.world.width, this.viewport.height / this.world.height);
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
    return this.fitZoom() * Camera.OPENING_ZOOM_OVER_FIT;
  }

  /** The widest the camera goes: the whole world. */
  minZoom(): number {
    return this.fitZoom();
  }

  maxZoom(): number {
    return this.fitZoom() * 8;
  }

  /** True when the camera is showing everything — used by the HUD to label the
   *  zoom control honestly rather than guessing. */
  isFitted(): boolean {
    return this.zoom <= this.minZoom() + 1e-4;
  }

  /** How much bigger than the fitted view the camera currently is: 1 when the
   *  whole world is on screen, up to maxZoom/fitZoom when fully zoomed in.
   *
   *  A renderer that draws the world at `fitZoom` and then applies this as a
   *  canvas transform gets magnification for free — sprites, line weights and
   *  every hard-coded pixel size scale together, which is what zooming in is
   *  supposed to mean. Drawing straight at `zoom` instead gives you a camera
   *  that moves the world around under a fixed-size stencil. */
  detailScale(): number {
    return this.zoom / this.fitZoom();
  }

  /** World → canvas position at FIT scale (pan applied, magnification not).
   *  Feed these to a context already carrying the detailScale() transform. */
  fitScreenX(wx: number): number {
    return (wx - this.x) * this.fitZoom() + this.viewport.width / 2;
  }

  fitScreenY(wy: number): number {
    return (wy - this.y) * this.fitZoom() + this.viewport.height / 2;
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
    this.following = null;
    this.clampTarget();
  }

  /** Drag the map by a screen-space delta. */
  panByScreen(dx: number, dy: number): void {
    this.targetX -= dx / this.targetZoom;
    this.targetY -= dy / this.targetZoom;
    this.following = null;
    this.clampTarget();
  }

  /** Ease toward a world point once. */
  centreOn(wx: number, wy: number): void {
    this.targetX = wx;
    this.targetY = wy;
    this.clampTarget();
  }

  /** Keep a world point centred every frame until the player intervenes. */
  follow(wx: number, wy: number): void {
    this.following = { x: wx, y: wy };
    this.centreOn(wx, wy);
  }

  isFollowing(): boolean {
    return this.following !== null;
  }

  /** Update the followed point (the convoy moves); no-op when not following. */
  updateFollowTarget(wx: number, wy: number): void {
    if (!this.following) return;
    this.following = { x: wx, y: wy };
    this.centreOn(wx, wy);
  }

  /** Snap all the way back out to the widest view the player is allowed. */
  resetToFit(): void {
    this.targetZoom = this.minZoom();
    this.targetX = this.world.width / 2;
    this.targetY = this.world.height / 2;
    this.following = null;
    this.clampTarget();
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

  /** Keep the view inside the world. When an axis is fully visible the camera
   *  is pinned to its centre, so a fitted view can never be dragged askew. */
  private clampTarget(): void {
    const halfW = this.viewport.width / (2 * this.targetZoom);
    const halfH = this.viewport.height / (2 * this.targetZoom);
    if (halfW * 2 >= this.world.width) this.targetX = this.world.width / 2;
    else this.targetX = clamp(this.targetX, halfW, this.world.width - halfW);
    if (halfH * 2 >= this.world.height) this.targetY = this.world.height / 2;
    else this.targetY = clamp(this.targetY, halfH, this.world.height - halfH);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
