// Truck-on-truck overlap (log v76; docs/design/v3-playtest-fixes.md, "Trucks
// that overlap"). The player, from a Watch run on The Coves: "Trucks should
// not overlap each other as well, the rocket truck and ballistic missile
// truck were just on top of each other. We should audit all maps too ...
// one way to solve that is to just have the other truck come in from a
// different way."
//
// Pure: no DOM. Two things use it:
// - the sim (`truckClear`, `pickClearRoad`): a truck about to set out or to
//   move checks the footprints of the trucks already on the road;
// - the audit (tools/v3/overlap-audit/audit.ts) and tests/v3/overlap.test.ts:
//   `groundBodies` + `overlapDepth` read a running game for what is drawn on
//   top of what.
//
// A truck's footprint is the body drawn (ui/vectors.ts drawTruck: 51 x 26
// px, scale 1.3; ui/foes.ts drawRocketTruck: the same body at 1.25),
// an oriented rectangle, so two side by side or nose to tail are tested as
// they look.

import type { Point } from '../data/mapTypes';
import { VIEW } from '../data/config';
import type { Game } from './game';

/** The body's half length and half beam at scale 1, and its centre's
 *  offset along the heading (the drawn rect spans x -25..26). */
export const TRUCK_BODY = { half: 25.5, beam: 13, shift: 0.5 } as const;
/** Drawn scale: a raider truck (ui/vectors.ts TRUCK_SCALE), a Rocket Truck. */
export const RAIDER_SCALE = 1.3;
export const ROCKET_SCALE = 1.25;
/** Air between two bodies the sim keeps (px), and how deep two bodies may
 *  sink into each other before the audit counts an overlap (px). */
export const TRUCK_GAP = 6;
export const OVERLAP_DEPTH = 4;

/** A ground body on screen: an oriented rectangle (a truck) or, with
 *  `round`, an ellipse-ish pad of that radius (a fixed launcher). */
export interface Body {
  id: number;
  /** 'popup' | 'runner' | 'parade' | 'rocketTruck' | 'base' | 'siege'. */
  kind: string;
  x: number;
  y: number;
  heading: number;
  hl: number;
  hw: number;
  fixed?: boolean;
}

/** A truck's body at a pose (its centre is a little ahead of the point it
 *  is driven by). */
export function truckBody(id: number, kind: string, x: number, y: number, heading: number, scale: number, grow = 0): Body {
  const c = TRUCK_BODY.shift * scale;
  return { id, kind, x: x + Math.cos(heading) * c, y: y + Math.sin(heading) * c, heading, hl: TRUCK_BODY.half * scale + grow, hw: TRUCK_BODY.beam * scale + grow };
}

/** How far two oriented rectangles sink into each other (px, the smallest
 *  push that would separate them), 0 when they do not touch. */
export function overlapDepth(a: Body, b: Body): number {
  const ax = [Math.cos(a.heading), Math.sin(a.heading)];
  const ay = [-ax[1], ax[0]];
  const bx = [Math.cos(b.heading), Math.sin(b.heading)];
  const by = [-bx[1], bx[0]];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let depth = Infinity;
  for (const [ux, uy] of [ax, ay, bx, by] as [number, number][]) {
    const ra = a.hl * Math.abs(ux * ax[0] + uy * ax[1]) + a.hw * Math.abs(ux * ay[0] + uy * ay[1]);
    const rb = b.hl * Math.abs(ux * bx[0] + uy * bx[1]) + b.hw * Math.abs(ux * by[0] + uy * by[1]);
    const gap = Math.abs(dx * ux + dy * uy);
    const pen = ra + rb - gap;
    if (pen <= 0) return 0;
    if (pen < depth) depth = pen;
  }
  return depth;
}

/** Is a body on the screen (a truck in a tunnel mouth or off the edge is
 *  not drawn, and cannot be on top of anything)? */
export function onScreen(b: { x: number; y: number }, pad = 8): boolean {
  return b.x > -pad && b.x < VIEW.width + pad && b.y > -pad && b.y < VIEW.height + pad;
}

/** Does a truck at this pose keep clear of every body in `others`? */
export function truckClear(self: Body, others: readonly Body[], gap = TRUCK_GAP): boolean {
  const probe = { ...self, hl: self.hl + gap / 2, hw: self.hw + gap / 2 };
  for (const o of others) {
    if (o.id === self.id || o.fixed) continue;
    if (overlapDepth(probe, { ...o, hl: o.hl + gap / 2, hw: o.hw + gap / 2 }) > 0) return false;
  }
  return true;
}

/** Shortest distance between two polylines, sampled every `step` px (the
 *  trucks' roads: how near two of them run). */
export function roadsDistance(a: readonly Point[], b: readonly Point[], step = 12): number {
  const sample = (p: readonly Point[]): Point[] => {
    const out: Point[] = [p[0]];
    for (let k = 1; k < p.length; k++) {
      const len = Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y);
      const n = Math.max(1, Math.ceil(len / step));
      for (let j = 1; j <= n; j++) out.push({ x: p[k - 1].x + ((p[k].x - p[k - 1].x) * j) / n, y: p[k - 1].y + ((p[k].y - p[k - 1].y) * j) / n });
    }
    return out;
  };
  const sa = sample(a);
  const sb = sample(b);
  let best = Infinity;
  for (const p of sa) for (const q of sb) best = Math.min(best, Math.hypot(p.x - q.x, p.y - q.y));
  return best;
}

/** The ground launchers as they are drawn right now (`drawn`: on screen
 *  only; the sim asks for every one, off the screen too): the trucks
 *  (a raider that is a truck and not yet or no longer on the road is left
 *  out; so is a Rocket Truck's wreck) and, with `fixed`, the shore pads
 *  and siege guns (ellipses 28 x 23, drawn as a rectangle of that size). */
export function groundBodies(g: Game, fixed = false, drawn = true): Body[] {
  const out: Body[] = [];
  for (const r of g.raiders) {
    if (r.kind === 'sub' || (drawn && !onScreen(r))) continue;
    // Off its road: not yet out of the tunnel, or backed into it.
    if (drawn && r.dist < 8) continue;
    out.push(truckBody(r.id, r.kind, r.x, r.y, r.heading, RAIDER_SCALE));
  }
  for (const t of g.threats) {
    if (t.dead) continue;
    if (t.kind === 'rocketTruck') {
      if (drawn && !onScreen(t)) continue;
      // Backing off the shore it is drawn heading away; the body is the same.
      out.push(truckBody(t.id, 'rocketTruck', t.x, t.y, t.heading, ROCKET_SCALE));
    } else if (fixed && t.kind === 'siege') out.push({ id: t.id, kind: 'siege', x: t.x, y: t.y, heading: 0, hl: 28, hw: 23, fixed: true });
  }
  if (fixed)
    g.map.bases.forEach((b, i) => {
      if (b.rig || b.generator || b.core || b.cove || b.chute || !b.kinds.length) return;
      out.push({ id: -1 - i, kind: 'base', x: b.x, y: b.y, heading: 0, hl: 28, hw: 23, fixed: true });
    });
  return out;
}

/** The pairs of `bodies` that overlap by `depth` px or more, as [a, b, depth]
 *  (fixed bodies are tested against trucks only). */
export function overlaps(bodies: readonly Body[], depth = OVERLAP_DEPTH): [Body, Body, number][] {
  const out: [Body, Body, number][] = [];
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      if (a.fixed && b.fixed) continue;
      const d = overlapDepth(a, b);
      if (d >= depth) out.push([a, b, d]);
    }
  return out;
}

/** One stretch of two bodies drawn on top of each other. */
export interface OverlapEvent {
  wave: number;
  a: string;
  b: string;
  x: number;
  y: number;
  /** Seconds they stayed so, and the deepest they sank in (px). */
  secs: number;
  depth: number;
  /** One of the two is a fixed launcher (a pad, a siege gun). */
  fixed: boolean;
}

/** Watches a run step by step (call `observe` after every sim step, then
 *  `finish`): every stretch of two ground bodies overlapping by OVERLAP_DEPTH
 *  px or more, with its length. The audit (tools/v3/overlap-audit) and the
 *  tests read `events`; `sustained` are those longer than `SUSTAINED` s ("a
 *  short moment" is two trucks passing). */
export class OverlapWatch {
  readonly events: OverlapEvent[] = [];
  /** Seconds with two or more trucks on screen, and the trucks seen. */
  crowded = 0;
  readonly seen = new Set<number>();
  private open = new Map<string, OverlapEvent & { steps: number }>();

  constructor(private readonly dt: number) {}

  observe(g: Game): void {
    const bodies = groundBodies(g, true);
    let trucks = 0;
    for (const b of bodies)
      if (!b.fixed) {
        trucks++;
        this.seen.add(b.id);
      }
    if (trucks >= 2) this.crowded += this.dt;
    const now = new Set<string>();
    for (const [a, b, depth] of overlaps(bodies)) {
      const key = `${a.id}:${b.id}`;
      now.add(key);
      const e = this.open.get(key);
      if (e) {
        e.steps += 1;
        e.depth = Math.max(e.depth, depth);
      } else this.open.set(key, { wave: g.wave, a: a.kind, b: b.kind, x: Math.round(a.x), y: Math.round(a.y), secs: 0, depth, fixed: !!(a.fixed || b.fixed), steps: 1 });
    }
    for (const [k, e] of [...this.open]) if (!now.has(k)) this.close(k, e);
  }

  finish(): void {
    for (const [k, e] of [...this.open]) this.close(k, e);
  }

  private close(k: string, e: OverlapEvent & { steps: number }): void {
    this.open.delete(k);
    const { steps, ...ev } = e;
    ev.secs = Math.round(steps * this.dt * 100) / 100;
    this.events.push(ev);
  }

  /** Truck-on-truck stretches longer than SUSTAINED s. */
  get sustained(): OverlapEvent[] {
    return this.events.filter((e) => !e.fixed && e.secs > SUSTAINED);
  }
}

/** How long two trucks may stay overlapped before it is more than a moment (s). */
export const SUSTAINED = 0.5;
