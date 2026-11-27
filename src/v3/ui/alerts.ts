// Call-outs: every notice the game makes (a new wave, a new threat, a raid on
// its way, the last ship, a note saved) is a small card in a stack in the
// bottom-right corner of the battlefield, newest at the bottom. At most two
// show at once; the rest wait their turn. Every card goes away on its own
// (MAX_TTL at the most) and a tap sends it away at once. The Call-outs
// setting (All / Essential / Off) decides which kinds show at all.
//
// History: round 14 put the notices in one row along each map's strip of
// bottom shore; the call-outs round (docs/design/v3-callouts.md) moved them
// to the corner, made them smaller and gave them the setting, after the
// player: "it's kind of annoying after you play the game for a while. It's
// better for new players ... you can turn them off".

import { kv } from '../platform/store';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type AlertTone = 'info' | 'raid' | 'danger';

/** A box in screen pixels. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Air kept between a card and a launcher (px). */
export const DODGE_MARGIN = 10;
/** The steps the stack rises in looking for a clear place (px). */
export const DODGE_STEP = 8;

/** Do two boxes overlap (`pad` px of air counted as overlap)? */
export function boxesHit(a: Box, b: Box, pad = 0): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
}

/** Where the stack stands: in the corner (`left` 0, `rise` 0), raised above
 *  it, or over in the other corner (`left` 1). */
export interface Stand {
  left: 0 | 1;
  rise: number;
}

/** What standing in the other corner costs, in px of rise. */
export const LEFT_COST = 120;

/** How many (card, launcher) pairs overlap with the stack at `st`. */
export function standHits(cards: Box[], avoid: Box[], st: Stand, across: number): number {
  let n = 0;
  const dx = st.left ? -across : 0;
  for (const c of cards) {
    const moved = { x0: c.x0 + dx, x1: c.x1 + dx, y0: c.y0 - st.rise, y1: c.y1 - st.rise };
    for (const a of avoid) if (boxesHit(moved, a, DODGE_MARGIN)) n++;
  }
  return n;
}

/** Where the stack stands so that no card is over a launcher (log v75; the
 *  player: "make sure they do not go in a place that is on top of enemy
 *  launchers so it isn't hidden"). `cards` are the boxes the cards would
 *  fill in the corner, `avoid` the launchers (and the carrier), `cur` where
 *  the stack stands now, `max` the most it may rise and `across` how far
 *  the other corner is to the left. A stack that is clear where it stands
 *  stays (it does not hop about); one covering a launcher goes to the
 *  cheapest place that is clear (a step up costs its px, the other corner
 *  LEFT_COST), and if there is none, to the place that covers the fewest. */
export function stackStand(cards: Box[], avoid: Box[], cur: Stand, max: number, across: number): Stand {
  const hits = (st: Stand): number => standHits(cards, avoid, st, across);
  const now: Stand = { left: cur.left, rise: Math.min(cur.rise, max) };
  if (!cards.length || !avoid.length || hits(now) === 0) return now;
  let best = now;
  let fewest = hits(now);
  let cost = Infinity;
  for (const left of [0, 1] as const) {
    for (let rise = 0; rise <= max; rise += DODGE_STEP) {
      const st: Stand = { left, rise };
      const n = hits(st);
      const c = rise + left * LEFT_COST;
      if (n < fewest || (n === fewest && n === 0 && c < cost)) {
        fewest = n;
        best = st;
        cost = c;
      }
    }
  }
  return best;
}

/** What a card is for: decides who sees it (the setting) and for how long.
 *  - alarm: one more loss ends the run (last ship, carrier critical). Always.
 *  - warn: something to react to now (a raid, a dreadnought, a supertanker).
 *  - info: what is happening (a wave starts, a test starts, a radar hit).
 *  - hint: teaching (a threat seen the first time, a tip, a map's idea).
 *  - ack: an answer to something the player just did (a note saved, a
 *    weapon loaded, control taken). */
export type CalloutKind = 'alarm' | 'warn' | 'info' | 'hint' | 'ack';

/** The Call-outs setting. */
export type CalloutLevel = 'all' | 'essential' | 'off';
export const CALLOUT_LEVELS: readonly CalloutLevel[] = ['all', 'essential', 'off'];
const LEVEL_KEY = 'straitwatch.v3.callouts';

/** A new save shows everything (a new player needs the teaching). */
export function loadCalloutLevel(): CalloutLevel {
  try {
    const v = kv.getItem(LEVEL_KEY);
    return v === 'essential' || v === 'off' ? v : 'all';
  } catch {
    return 'all';
  }
}

export function saveCalloutLevel(level: CalloutLevel): void {
  try {
    kv.setItem(LEVEL_KEY, level);
  } catch {
    // not remembered
  }
}

/** A card's kind, from its options: by default an alarm for danger, a
 *  warning for a raid, information otherwise. */
export function calloutKind(o: AlertOpts): CalloutKind {
  return o.kind ?? (o.tone === 'danger' ? 'alarm' : o.tone === 'raid' ? 'warn' : 'info');
}

/** How a card of this kind shows at this level: in full, as one short line,
 *  or not at all. Essential keeps what must be answered now and shrinks the
 *  answers to the player's own taps to a line; Off keeps only the alarm. */
export function calloutLook(kind: CalloutKind, level: CalloutLevel): 'full' | 'tiny' | null {
  if (kind === 'alarm' || level === 'all') return 'full';
  if (level === 'off') return null;
  return kind === 'warn' ? 'full' : kind === 'ack' ? 'tiny' : null;
}

/** Seconds on screen (real time; watching fast shortens them by the square
 *  root of the speed). A live warning goes when its moment passes, and no
 *  card stays longer than MAX_TTL however it is asked. */
export const TTL: Record<CalloutKind | 'tiny', number> = { alarm: 4, warn: 4, info: 3.2, hint: 4, ack: 2.4, tiny: 1.6 };
export const MAX_TTL = 4;

/** Feather icons (MIT), drawn in the card's own colour. */
const ICONS = {
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  wave: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  note: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  play: '<path d="M5 3l14 9-14 9V3z"/>',
  target: '<circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/>',
} as const;
export type CalloutIcon = keyof typeof ICONS;

export interface AlertOpts {
  /** One card per key: a repeat refreshes the card instead of adding one. */
  key?: string;
  tone?: AlertTone;
  /** Defaults from the tone: danger → alarm, raid → warn, else info. */
  kind?: CalloutKind;
  /** Defaults from the kind. */
  icon?: CalloutIcon;
  /** Raid colour, as "r,g,b". */
  color?: string;
  /** Seconds on screen (real time), up to MAX_TTL. Defaults by kind. */
  ttl?: number;
  /** Shown no longer than this says so (a raid warning, while it lasts). */
  alive?: () => boolean;
  /** Feedback on something the player just did (took over, flagged): shown
   *  at once, making room like an alarm does. */
  now?: boolean;
}

interface Pending {
  title: string;
  sub: string;
  opts: AlertOpts;
  /** The same raid's count in a row (×n on the card). */
  n: number;
}

interface Card {
  key: string;
  el: HTMLElement;
  tone: AlertTone;
  title: string;
  n: number;
  left: number;
  /** Seconds it has been up. */
  age: number;
  alive?: () => boolean;
}

/** Cards in the stack at once. */
const MAX_SHOWN = 2;
/** The tallest a card stands (px: a first-sight hint on a small phone) and
 *  the gap between two, for the check that a stack of two stays off the
 *  carrier (place()). */
const CARD_H = 110;
const GAP = 4;
/** A card being read is not snatched away by a raid before this (s). */
const MIN_READ = 1;
/** The same raid again within this many seconds is a repeat: its card says
 *  ×N and leaves out the tip, read a moment ago. */
const REPEAT_S = 8;

const DEFAULT_ICON: Record<CalloutKind, CalloutIcon> = { alarm: 'alert', warn: 'alert', info: 'info', hint: 'eye', ack: 'check' };

export class Alerts {
  readonly el = el('div', 'v2-alerts');
  /** The Call-outs setting. */
  level: CalloutLevel = loadCalloutLevel();
  /** The game's speed (read times shrink when watching fast). */
  speed = 1;
  private shown: Card[] = [];
  private waiting: Pending[] = [];
  /** Live warnings whose card has gone (timed out or tapped): not again
   *  while they last, though the game asks every frame. */
  private gone = new Set<string>();
  /** Each raid call-out's last time up (clock) and how many in a row. */
  private repeats = new Map<string, { n: number; last: number }>();
  private clock = 0;
  private seq = 0;
  private max = MAX_SHOWN;

  /** Show a notice now if there is room, else queue it. Raids and alarms
   *  make room by retiring the oldest ordinary card. */
  notify(title: string, sub: string, opts: AlertOpts = {}): void {
    const kind = calloutKind(opts);
    const look = calloutLook(kind, this.level);
    if (!look) return;
    const key = opts.key ?? `n${this.seq++}`;
    if (opts.alive && this.gone.has(key)) return;
    const o: AlertOpts = { ...opts, key, kind, ttl: Math.min(MAX_TTL, opts.ttl ?? TTL[look === 'tiny' ? 'tiny' : kind]) };
    if (look === 'tiny') sub = '';
    const same = this.shown.find((c) => c.key === key);
    if (same) {
      this.fill(same.el, title, same.n > 1 ? '' : sub, o, same.n);
      if (!o.alive) same.left = this.ttl(o);
      same.alive = o.alive;
      return;
    }
    // Waiting already: the newer message takes its place in the queue (round
    // 4: a weapon loaded behind a raid warning showed the PREVIOUS weapon's
    // notice once the raid passed).
    const queued = this.waiting.find((w) => w.opts.key === key);
    if (queued) {
      Object.assign(queued, { title, sub: queued.n > 1 ? '' : sub, opts: o });
      return;
    }
    // The same raid as a moment ago: one card counting them (×2), without
    // the tip read a moment ago.
    let n = 1;
    if (o.tone === 'raid') {
      const r = this.repeats.get(title);
      n = r && this.clock - r.last < REPEAT_S ? r.n + 1 : 1;
      this.repeats.set(title, { n, last: this.clock });
      if (n > 1) sub = '';
      const twin = n > 1 && this.shown.find((c) => c.tone === 'raid' && c.title === title);
      if (twin) {
        if (twin.alive?.()) this.gone.add(twin.key);
        Object.assign(twin, { key, n, alive: o.alive, left: this.ttl(o) });
        this.fill(twin.el, title, sub, o, n);
        return;
      }
    }
    const urgent = o.tone === 'raid' || o.tone === 'danger' || !!o.now;
    if (this.shown.length >= this.limit && urgent) {
      // Make room: the oldest ordinary card goes, once it has been read.
      const victim = this.shown.find((c) => c.tone === 'info');
      if (victim) {
        if (victim.age >= MIN_READ || o.now) this.retire(victim);
        else victim.left = Math.min(victim.left, MIN_READ - victim.age);
      }
    }
    const p = { title, sub, opts: o, n };
    if (this.shown.length < this.limit) this.show(p);
    else if (urgent) this.waiting.unshift(p);
    else this.waiting.push(p);
  }

  /** Per frame, with real seconds elapsed. */
  update(real: number): void {
    this.clock += real;
    for (const c of [...this.shown]) {
      c.age += real;
      c.left -= real;
      const live = c.alive?.();
      if (live && c.tone === 'raid') this.repeats.set(c.title, { n: c.n, last: this.clock });
      if (live === false || c.left <= 0) this.retire(c);
    }
    // An alarm waiting behind ordinary cards hurries them along.
    const head = this.waiting[0]?.opts;
    if (head && (head.now || (head.tone !== undefined && head.tone !== 'info')))
      for (const c of this.shown) if (c.tone === 'info') c.left = Math.min(c.left, Math.max(0, MIN_READ - c.age));
    while (this.waiting.length && this.shown.length < this.limit) {
      const w = this.waiting.shift()!;
      // A raid whose moment has passed while it waited is old news.
      if (w.opts.alive && !w.opts.alive()) continue;
      this.show(w);
    }
  }

  /** Everything off, at once (a new run, the end of a run). */
  clear(): void {
    this.waiting = [];
    this.gone.clear();
    this.repeats.clear();
    this.el.replaceChildren();
    this.shown = [];
  }

  /** How many cards are up (tests). */
  get count(): number {
    return this.shown.length;
  }

  /** The stack sits in the corner by CSS (style.css, .v2-alerts); here only
   *  its size: one card at a time where two could reach the carrier (a
   *  screen box). Only The Delta, whose carrier sits mid-field on the right,
   *  needs it; every other carrier ends left of the stack. */
  place(carrier?: { x0: number; y0: number; x1: number; y1: number }): void {
    const r = this.el.getBoundingClientRect();
    const top = r.bottom - (CARD_H * MAX_SHOWN + GAP);
    const hits = !!carrier && carrier.x1 > r.left && carrier.x0 < r.right && carrier.y1 > top && carrier.y0 < r.bottom;
    this.max = hits ? 1 : MAX_SHOWN;
  }

  /** Where the stack stands now, and how long the corner has been clear (it
   *  goes back to the corner once that has been clear for a second). */
  private stand: Stand = { left: 0, rise: 0 };
  private cornerClear = 0;
  private movedAt = -9;

  /** Log v75: keep every card off the enemy's launchers. `avoid` are the
   *  launchers' boxes (screen px), `top` the highest the stack may go and
   *  `left` the field's left edge. Per frame, with real seconds elapsed. */
  dodge(avoid: Box[], top: number, left: number, real: number): void {
    const r = this.el.getBoundingClientRect();
    // Where the stack is drawn right now (it slides to a new stand), so the
    // cards can be put back in the corner whatever moment this is read.
    const m = new DOMMatrix(getComputedStyle(this.el).transform);
    const dx = -m.m41;
    const rise = -m.m42;
    const kids = [...this.el.children].filter((e) => !e.classList.contains('leaving')) as HTMLElement[];
    // The cards as they would stand in the corner; with none up, the stack's
    // own corner stands in for the next one.
    const cards: Box[] = kids.map((e) => {
      const b = e.getBoundingClientRect();
      return { x0: b.left + dx, x1: b.right + dx, y0: b.top + rise, y1: b.bottom + rise };
    });
    if (!cards.length) cards.push({ x0: r.left + dx, x1: r.right + dx, y0: r.bottom + rise - 56, y1: r.bottom + rise });
    const max = Math.max(0, Math.min(...cards.map((c) => c.y0)) - top);
    // The other corner: the stack's left edge on the field's.
    this.across = Math.max(0, r.left + dx - left - 8);
    this.clock2 += real;
    let next = stackStand(cards, avoid, this.stand, max, this.across);
    // Nowhere to stand clear of every launcher with the cards up: one card at
    // a time (the smallest phone, a map with launchers all round).
    this.crowded = standHits(cards, avoid, next, this.across) > 0 && cards.length > 1;
    if (next.left === this.stand.left && next.rise === this.stand.rise && (next.rise > 0 || next.left)) {
      const home = stackStand(cards, avoid, { left: 0, rise: 0 }, max, this.across);
      this.cornerClear = home.rise === 0 && home.left === 0 ? this.cornerClear + real : 0;
      if (this.cornerClear > 1) next = home;
    } else this.cornerClear = 0;
    if ((next.left !== this.stand.left || next.rise !== this.stand.rise) && this.clock2 - this.movedAt > 0.25) {
      this.stand = next;
      this.movedAt = this.clock2;
      const x = next.left ? -this.across : 0;
      this.el.style.transform = next.rise || next.left ? `translate(${x}px, ${-next.rise}px)` : '';
      this.el.dataset.rise = String(Math.round(next.rise));
      this.el.dataset.side = next.left ? 'left' : 'right';
    }
  }

  private across = 0;
  /** No clear place for the whole stack: show one card at a time. */
  private crowded = false;
  private clock2 = 0;

  private get limit(): number {
    return this.crowded ? 1 : this.max;
  }

  private ttl(o: AlertOpts): number {
    return (o.ttl ?? TTL.info) / (o.kind === 'alarm' ? 1 : Math.sqrt(Math.max(1, this.speed)));
  }

  private show(p: Pending): void {
    const { title, sub, opts: o, n } = p;
    const e = el('div');
    this.fill(e, title, sub, o, n);
    const card: Card = { key: o.key!, el: e, tone: o.tone ?? 'info', title, n, left: this.ttl(o), age: 0, alive: o.alive };
    // A tap sends it away (and never reaches the water as a shot: the card
    // is over the canvas, which takes its own pointer events).
    e.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.retire(card);
    });
    this.el.append(e);
    this.shown.push(card);
    requestAnimationFrame(() => e.classList.add('show'));
  }

  private fill(card: HTMLElement, title: string, sub: string, o: AlertOpts, n: number): void {
    const kind = o.kind ?? 'info';
    const tiny = calloutLook(kind, this.level) === 'tiny' ? ' tiny' : '';
    card.className = `v2-alert ${o.tone ?? 'info'} ${kind}${tiny}${sub ? '' : ' one'}${card.classList.contains('show') ? ' show' : ''}`;
    card.dataset.kind = kind;
    if (o.color) card.style.setProperty('--alert', `rgb(${o.color})`);
    const icon = el('i', 'v2-alert-icon');
    icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[o.icon ?? DEFAULT_ICON[kind]]}</svg>`;
    const head = el('strong');
    head.append(el('span', '', title), ...(n > 1 ? [el('b', 'v2-alert-n', `×${n}`)] : []));
    const text = el('div', 'v2-alert-text');
    text.append(head, ...(sub ? [el('span', 'v2-alert-sub', sub)] : []));
    card.replaceChildren(icon, text);
  }

  /** Slides out to the right and fades; the cards above close the gap. */
  private retire(c: Card): void {
    if (!this.shown.includes(c)) return;
    if (c.alive?.()) this.gone.add(c.key);
    this.shown = this.shown.filter((o) => o !== c);
    const e = c.el;
    e.style.marginTop = `${-(e.offsetHeight + GAP)}px`;
    e.classList.remove('show');
    e.classList.add('leaving');
    setTimeout(() => e.remove(), 260);
  }
}
