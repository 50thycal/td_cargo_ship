// Map pictures for the menu and the briefing (menus round). Each is the
// real map drawn by the game's own renderer: land, lanes, bases, the
// carrier and the convoy a few seconds under way, with no threats. Being
// the game's own frame, a picture can never disagree with the map it
// names. Drawn once per map and size, off the main thread's busy moments,
// and kept for the session.

import { VIEW } from '../data/config';
import type { MapId } from '../data/maps';
import { createGame, step, type Game } from '../sim/game';
import { drawFrame } from './render';

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

/** A quiet game of this map: the convoy sails, nothing attacks. */
export function quietGame(id: MapId, seed = 7): Game {
  const g = createGame(id, seed, 1);
  // One launch far in the future keeps the wave running (an empty queue
  // would end it at once); nothing else is ever fired.
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.raids = [];
  return g;
}

/** Clear anything the map's own features put in the air or on the water. */
export function calm(g: Game): void {
  g.threats = [];
  g.pickups = [];
  g.fx = [];
  g.events = [];
}

function render(id: MapId, w: number): string {
  const g = quietGame(id);
  for (let i = 0; i < 60 * 14; i++) {
    step(g, 1 / 60);
    if (i % 60 === 0) calm(g);
  }
  calm(g);
  const h = Math.round((w * VIEW.height) / VIEW.width);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.setTransform(w / VIEW.width, 0, 0, h / VIEW.height, 0, 0);
  drawFrame(ctx, g, [], 0);
  return c.toDataURL('image/jpeg', 0.82);
}

/** The picture now if it is drawn, else null. */
export function thumbNow(id: MapId, w = 384): string | null {
  return cache.get(`${id}:${w}`) ?? null;
}

/** The picture, drawn on an idle moment if it isn't yet. */
export function mapThumb(id: MapId, w = 384): Promise<string> {
  const key = `${id}:${w}`;
  const done = cache.get(key);
  if (done) return Promise.resolve(done);
  let p = pending.get(key);
  if (!p) {
    p = new Promise<string>((resolve) => {
      const go = () => {
        let url = '';
        try {
          url = render(id, w);
        } catch {
          // A picture is decoration: the card still works without one.
        }
        cache.set(key, url);
        pending.delete(key);
        resolve(url);
      };
      const idle = (window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
      if (idle) idle(go, { timeout: 120 });
      else setTimeout(go, 0);
    });
    pending.set(key, p);
  }
  return p;
}
