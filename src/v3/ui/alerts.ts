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
    if (this.shown.length >= this.max && urgent) {
      // Make room: the oldest ordinary card goes, once it has been read.
      const victim = this.shown.find((c) => c.tone === 'info');
      if (victim) {
        if (victim.age >= MIN_READ || o.now) this.retire(victim);
        else victim.left = Math.min(victim.left, MIN_READ - victim.age);
      }
    }
    const p = { title, sub, opts: o, n };
    if (this.shown.length < this.max) this.show(p);
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
    while (this.waiting.length && this.shown.length < this.max) {
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
