// Playtest feedback screens (see sim/feedback.ts for what is recorded):
// the note form (tags and text), the 1–5 rating rows, a volley's one-line
// summary, the run's timeline of marked moments, and the setting that turns
// it all on. DOM only; app.ts wires them to the run.

import { RATING_AXES, NOTE_TAGS, type Moment, type NoteTag, type PlayNote, type Rating, type Volley } from '../sim/feedback';
import { THREATS, type ThreatKind } from '../data/config';
import type { PlayLog } from '../sim/playlog';
import { RAID_LOOK } from './render';
import { kv } from '../platform/store';

/** Pre-release builds ship with playtest notes on; flip this before a store
 *  build (the setting still lets a tester turn them on). */
export const NOTES_DEFAULT = true;
const NOTES_KEY = 'straitwatch.v3.notes';
/** Thumbnails a log keeps (each about 10–20 KB). */
export const MAX_THUMBS = 12;
const THUMB_W = 320;

export function notesEnabled(): boolean {
  try {
    const v = kv.getItem(NOTES_KEY);
    return v === null ? NOTES_DEFAULT : v === '1';
  } catch {
    return NOTES_DEFAULT;
  }
}

export function setNotesEnabled(on: boolean): void {
  try {
    kv.setItem(NOTES_KEY, on ? '1' : '0');
  } catch {
    // not remembered
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** A small JPEG of the battlefield: the canvas cropped to the map. */
export function captureThumb(canvas: HTMLCanvasElement, crop: { x: number; y: number; w: number; h: number }): string | undefined {
  try {
    if (crop.w < 10 || crop.h < 10) return undefined;
    const c = document.createElement('canvas');
    c.width = THUMB_W;
    c.height = Math.round((THUMB_W * crop.h) / crop.w);
    c.getContext('2d')!.drawImage(canvas, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.6);
  } catch {
    return undefined;
  }
}

/** Tag chips (any number on) and a text box. The phone keyboard's mic key
 *  dictates into it. */
export function noteForm(opts: { tags?: NoteTag[]; text?: string; placeholder?: string } = {}): {
  el: HTMLElement;
  value(): { tags: NoteTag[]; text: string };
  empty(): boolean;
} {
  const on = new Set<NoteTag>(opts.tags ?? []);
  const wrap = el('div', 'v3-note-form');
  const chips = el('div', 'v3-note-tags');
  for (const t of NOTE_TAGS) {
    const b = button(t.label, `v3-note-tag${on.has(t.id) ? ' on' : ''}`, () => {
      if (on.has(t.id)) on.delete(t.id);
      else on.add(t.id);
      b.classList.toggle('on', on.has(t.id));
      b.setAttribute('aria-pressed', String(on.has(t.id)));
    });
    b.dataset.tag = t.id;
    b.setAttribute('aria-pressed', String(on.has(t.id)));
    chips.append(b);
  }
  const text = el('textarea', 'v3-note-text');
  text.rows = 2;
  text.maxLength = 1000;
  text.placeholder = opts.placeholder ?? 'What happened? (the 🎤 key on the keyboard dictates)';
  text.value = opts.text ?? '';
  // Keys typed here are the note's, not the game's (Space pauses).
  text.addEventListener('keydown', (e) => e.stopPropagation());
  wrap.append(chips, text);
  return {
    el: wrap,
    value: () => ({ tags: NOTE_TAGS.map((t) => t.id).filter((id) => on.has(id)), text: text.value.trim() }),
    empty: () => on.size === 0 && !text.value.trim(),
  };
}

/** Three rows of 1–5: difficulty, fun, intensity. Tap a number again to
 *  clear it. */
export function ratingRows(initial: Rating = {}): { el: HTMLElement; value(): Rating; any(): boolean } {
  const r: Rating = { ...initial };
  const wrap = el('div', 'v3-rating');
  for (const axis of RATING_AXES) {
    const row = el('div', 'v3-rating-row');
    row.dataset.axis = axis.id;
    const nums = el('div', 'v3-rating-nums');
    const sync = () => {
      for (const b of nums.querySelectorAll<HTMLElement>('button')) b.classList.toggle('on', Number(b.dataset.n) === r[axis.id]);
    };
    for (let n = 1; n <= 5; n++) {
      const b = button(String(n), 'v3-rating-n', () => {
        r[axis.id] = r[axis.id] === n ? undefined : n;
        sync();
      });
      b.dataset.n = String(n);
      nums.append(b);
    }
    sync();
    const head = el('div', 'v3-rating-head');
    head.append(el('strong', '', axis.label), el('span', '', `1 ${axis.low} · 5 ${axis.high}`));
    row.append(head, nums);
    wrap.append(row);
  }
  const clean = (): Rating => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== undefined)) as Rating;
  return { el: wrap, value: clean, any: () => Object.keys(clean()).length > 0 };
}

const kindLabel = (k: ThreatKind, n: number) => `${n} ${THREATS[k].label.toLowerCase()}${n > 1 && !/s$/.test(THREATS[k].label) ? 's' : ''}`;

/** "Barrage ×3 · wave 8": the volley's name. */
export function volleyName(v: Volley): string {
  const name = RAID_LOOK[v.theme].name;
  return `${name[0]}${name.slice(1).toLowerCase()}${v.raids > 1 ? ` ×${v.raids}` : ''}`;
}

/** What it brought and what it did, in a line. */
export function volleySummary(v: Volley): string {
  const brought = (Object.entries(v.threats) as [ThreatKind, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, n]) => kindLabel(k, n))
    .join(', ');
  const did = [v.sunk ? `${v.sunk} ship${v.sunk > 1 ? 's' : ''} sunk` : 'no ships lost', ...(v.carrierHits ? [`carrier hit ${v.carrierHits}×`] : [])].join(', ');
  return `${brought || 'nothing reached the field'} · ${did}`;
}

export const MOMENT_LOOK: Record<Moment['kind'], { icon: string; label: string; color: string }> = {
  sunk: { icon: '✕', label: 'Ship sunk', color: '#ff5d5d' },
  burst: { icon: '‼', label: 'Burst of losses', color: '#ff2e63' },
  carrier: { icon: '◆', label: 'Carrier hit', color: '#ff9f43' },
  dry: { icon: '∅', label: 'Out of ammo', color: '#7fb3ff' },
  debut: { icon: '★', label: 'New threat', color: '#c792ff' },
};

/** One stop on the review's timeline: a marked moment or a note. */
export interface Stop {
  step: number;
  wave: number;
  waveT: number;
  kind: Moment['kind'] | 'note';
  text: string;
  moment?: number;
  note?: PlayNote;
}

/** The run's stops in order: every marked moment and every note. */
export function runStops(log: PlayLog): Stop[] {
  const stops: Stop[] = (log.moments ?? []).map((m, i) => ({ step: m.step, wave: m.wave, waveT: m.waveT, kind: m.kind, text: m.text, moment: i }));
  for (const n of log.notes ?? []) {
    if (n.where === 'menu') continue;
    const said = [...n.tags.map((t) => NOTE_TAGS.find((x) => x.id === t)?.label ?? t), ...(n.text ? [`“${n.text}”`] : [])].join(' · ');
    stops.push({ step: n.step, wave: n.ctx?.wave ?? 0, waveT: n.ctx?.waveT ?? 0, kind: 'note', text: `Your note: ${said || '(empty)'}`, note: n });
  }
  return stops.sort((a, b) => a.step - b.step);
}

/** The timeline strip: waves as bands, volleys as a coloured line under
 *  them (a dot where rated), each stop a tick. Tap the strip to pick the
 *  nearest stop. */
export function timeline(log: PlayLog, stops: Stop[], selected: number, pick: (i: number) => void): HTMLElement {
  const end = Math.max(1, log.summary?.steps ?? stops[stops.length - 1]?.step ?? 1);
  const pct = (step: number) => `${Math.max(0, Math.min(100, (step / end) * 100)).toFixed(2)}%`;
  const strip = el('div', 'v3-timeline');
  const bands = el('div', 'v3-tl-bands');
  const waves = log.summary?.waves ?? [];
  let prev = 0;
  waves.forEach((w, i) => {
    const to = Math.round(w.t * 60);
    const band = el('span', `v3-tl-wave${i % 2 ? ' alt' : ''}`, String(w.wave));
    band.style.left = pct(prev);
    band.style.width = pct(Math.max(0, Math.min(end, to) - prev));
    bands.append(band);
    prev = to;
  });
  const volleys = el('div', 'v3-tl-volleys');
  for (const v of log.volleys ?? []) {
    const seg = el('span', `v3-tl-volley${v.rating ? ' rated' : ''}`);
    seg.style.left = pct(v.from);
    seg.style.width = pct((v.to ?? end) - v.from);
    seg.style.setProperty('--theme', `rgb(${RAID_LOOK[v.theme].color})`);
    volleys.append(seg);
  }
  const ticks = el('div', 'v3-tl-ticks');
  stops.forEach((s, i) => {
    const t = el('span', `v3-tl-tick${i === selected ? ' on' : ''}${s.kind === 'note' ? ' note' : ''}`);
    t.style.left = pct(s.step);
    t.style.setProperty('--tick', s.kind === 'note' ? 'var(--gold)' : MOMENT_LOOK[s.kind].color);
    ticks.append(t);
  });
  strip.append(bands, volleys, ticks);
  strip.addEventListener('click', (e) => {
    if (!stops.length) return;
    const r = strip.getBoundingClientRect();
    const at = ((e.clientX - r.left) / Math.max(1, r.width)) * end;
    let best = 0;
    stops.forEach((s, i) => {
      if (Math.abs(s.step - at) < Math.abs(stops[best].step - at)) best = i;
    });
    pick(best);
  });
  return strip;
}

/** The waves' share of a log: a stop's "wave 8, 31 s". */
export function stopWhen(s: { wave: number; waveT: number }): string {
  return `Wave ${s.wave}, ${Math.round(s.waveT)} s`;
}

export { el as noteEl, button as noteButton };
