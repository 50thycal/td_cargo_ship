// The notification tray (round 14): every call-out the game makes (a new
// wave, a new threat, a raid on its way, the last ship) is a card in one row
// along the map's own strip of bottom shore, clear of the carrier, the bases
// and the lanes. At most two show at once, side by side; the rest wait their
// turn instead of overwriting the one being read. A raid warning or a
// last-ship alarm cuts the queue.
//
// Before this, the banner was a single slot (a second notice replaced the
// first at once) and the raid warning was drawn on the canvas just above it,
// which on some maps put it under the carrier.

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export type AlertTone = 'info' | 'raid' | 'danger';

export interface AlertOpts {
  /** One card per key: a repeat refreshes the card instead of adding one. */
  key?: string;
  tone?: AlertTone;
  /** Raid colour, as "r,g,b". */
  color?: string;
  /** Seconds on screen (real time); ignored while `alive` holds. */
  ttl?: number;
  /** Shown for as long as this says so (a raid warning, while it lasts). */
  alive?: () => boolean;
  /** Feedback on something the player just did (took over, flagged): shown
   *  at once, making room like an alarm does. */
  now?: boolean;
}

interface Card {
  key: string;
  el: HTMLElement;
  tone: AlertTone;
  left: number;
  /** Seconds it has been up. */
  age: number;
  alive?: () => boolean;
  leaving: boolean;
}

/** Cards side by side in the tray (a map with a short strip of shore says 1). */
const MAX_SHOWN = 2;
/** The tallest a card stands (px; two lines of text under the title), the
 *  gap it keeps from the carrier, and the width two cards need abreast. */
const CARD_H = 66;
const GAP = 8;
const TWO_CARDS = 330;
/** A card being read is not snatched away by a raid before this (s). */
const MIN_READ = 1;

export class Alerts {
  readonly el = el('div', 'v2-alerts');
  private shown: Card[] = [];
  private waiting: { title: string; sub: string; opts: AlertOpts }[] = [];
  private seq = 0;
  private max = MAX_SHOWN;

  /** Show a notice now if there is room, else queue it. Raids and alarms
   *  make room by retiring the oldest ordinary card. */
  notify(title: string, sub: string, opts: AlertOpts = {}): void {
    const key = opts.key ?? `n${this.seq++}`;
    const same = this.shown.find((c) => c.key === key && !c.leaving);
    if (same) {
      this.fill(same.el, title, sub, opts);
      same.left = opts.ttl ?? same.left;
      same.alive = opts.alive;
      return;
    }
    // Waiting already: the newer message takes its place in the queue (round
    // 4: a weapon loaded behind a raid warning showed the PREVIOUS weapon's
    // notice once the raid passed).
    const queued = this.waiting.find((w) => w.opts.key === key);
    if (queued) {
      queued.title = title;
      queued.sub = sub;
      queued.opts = { ...opts, key };
      return;
    }
    const urgent = opts.tone === 'raid' || opts.tone === 'danger' || !!opts.now;
    const live = this.shown.filter((c) => !c.leaving);
    if (live.length >= this.max && urgent) {
      // Make room: the oldest ordinary card goes, once it has been read.
      const victim = live.find((c) => c.tone === 'info');
      if (victim) {
        if (victim.age >= MIN_READ || opts.now) this.retire(victim);
        else victim.left = Math.min(victim.left, MIN_READ - victim.age);
      }
    }
    if (this.shown.filter((c) => !c.leaving).length < this.max) this.show(title, sub, opts, key);
    else if (urgent) this.waiting.unshift({ title, sub, opts: { ...opts, key } });
    else this.waiting.push({ title, sub, opts: { ...opts, key } });
  }

  /** Per frame, with real seconds elapsed. */
  update(real: number): void {
    for (const c of this.shown) {
      if (c.leaving) continue;
      c.age += real;
      if (c.alive ? !c.alive() : (c.left -= real) <= 0) this.retire(c);
    }
    // An alarm waiting behind ordinary cards hurries them along.
    const head = this.waiting[0]?.opts;
    if (head && (head.now || (head.tone !== undefined && head.tone !== 'info')))
      for (const c of this.shown) if (!c.leaving && c.tone === 'info') c.left = Math.min(c.left, Math.max(0, MIN_READ - c.age));
    while (this.waiting.length && this.shown.filter((c) => !c.leaving).length < this.max) {
      const w = this.waiting.shift()!;
      // A raid whose moment has passed while it waited is old news.
      if (w.opts.alive && !w.opts.alive()) continue;
      this.show(w.title, w.sub, w.opts, w.opts.key!);
    }
  }

  /** Everything off, at once (a new run, the end of a run). */
  clear(): void {
    this.waiting = [];
    for (const c of this.shown) c.el.remove();
    this.shown = [];
  }

  /** How many cards are up (tests). */
  get count(): number {
    return this.shown.filter((c) => !c.leaving).length;
  }

  /** Lay the tray over the map's strip of shore: `span` in world units,
   *  `scale` and `off` the canvas transform. */
  place(
    span: { x0: number; x1: number; y: number; max?: number },
    scale: number,
    offX: number,
    offY: number,
    avoid?: { x0: number; y0: number; x1: number; y1: number },
  ): void {
    let left = offX + span.x0 * scale;
    let right = offX + span.x1 * scale;
    const bottom = offY + span.y * scale;
    let max = span.max ?? MAX_SHOWN;
    // Map visual-check round: the cards are a fixed size on screen, so on a
    // small phone they stand taller over the map and could reach the carrier
    // (Tidewater Flats, Lee of Marrow at 667×375). Where the carrier sits in
    // the tray's band, the tray keeps to the wider side of it.
    if (avoid) {
      const a0 = offX + avoid.x0 * scale;
      const a1 = offX + avoid.x1 * scale;
      const top = bottom - Math.max(CARD_H, this.el.offsetHeight);
      const ay0 = offY + avoid.y0 * scale;
      const ay1 = offY + avoid.y1 * scale;
      if (a1 > left && a0 < right && ay1 > top && ay0 < bottom) {
        const wLeft = a0 - GAP - left;
        const wRight = right - (a1 + GAP);
        if (wLeft >= wRight) right = a0 - GAP;
        else left = a1 + GAP;
        // Too narrow for two cards abreast: one at a time.
        if (right - left < TWO_CARDS) max = 1;
      }
    }
    this.max = max;
    this.el.classList.toggle('single', this.max === 1);
    const s = this.el.style;
    s.left = `${left}px`;
    s.width = `${Math.max(0, right - left)}px`;
    s.top = `${bottom}px`;
  }

  private show(title: string, sub: string, opts: AlertOpts, key: string): void {
    const card = el('div', `v2-alert ${opts.tone ?? 'info'}`);
    this.fill(card, title, sub, opts);
    this.el.append(card);
    this.shown.push({ key, el: card, tone: opts.tone ?? 'info', left: opts.ttl ?? 2.6, age: 0, alive: opts.alive, leaving: false });
    requestAnimationFrame(() => card.classList.add('show'));
  }

  private fill(card: HTMLElement, title: string, sub: string, opts: AlertOpts): void {
    if (opts.color) card.style.setProperty('--alert', `rgb(${opts.color})`);
    card.replaceChildren(el('strong', '', title), ...(sub ? [el('span', '', sub)] : []));
  }

  /** Off at once: a card left fading in the row would squeeze the others
   *  (a third card's worth of width) and push them up over the field. */
  private retire(c: Card): void {
    if (c.leaving) return;
    c.leaving = true;
    c.el.remove();
    this.shown = this.shown.filter((o) => o !== c);
  }
}
