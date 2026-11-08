// The Test Lab's screens (docs/design/v3-test-lab.md): the hub with its
// checklist, the bar in play, the setup sheet, the verdict sheet and the
// session report. DOM only; app.ts runs the tests. What the player has
// tested is kept on this device (and every test's verdict also goes into its
// game log, which reaches Claude).

import { ABILITIES, ABILITY_MAX, ABILITY_ORDER, type AbilityId } from '../data/abilities';
import { LAB_CARDS, LAB_LENGTH, LAB_SECTIONS, LAB_START_WAVE, labCard, type LabCard, type LabLength, type LabMix } from '../data/lab';
import { evidenceLines, type LabStats } from '../sim/lab';
import type { LabResult, PlayLog } from '../sim/playlog';
import { kv } from '../platform/store';

/** The review page for the Test Lab: its Results tab shows what was marked
 *  here (Claude copies it over from the game logs). */
export const LAB_PAGE_URL = 'https://claude.ai/artifact/SzK5Boc4CrB9wrtMbd7249';

export type LabVerdict = 'keep' | 'tune' | 'cut';

export const LAB_TAGS = ["Can't see the tell", 'Too hard', 'Too easy', 'Unfair', 'Confusing', 'Fun', 'Bug'];

/** What a test starts with (the setup sheet changes it). */
export interface LabRunSetup {
  wave: number;
  weapons: { id: AbilityId; level: number }[];
  length: LabLength;
  mix: LabMix;
}

export interface LabProgress {
  results: Record<string, LabResult & { at: string }>;
  length: LabLength;
  mix: LabMix;
  /** "Play 5": the cards still queued. */
  queue: string[];
  /** Tested in this session (today, on this device). */
  session: { day: string; ids: string[] };
}

const KEY = 'straitwatch.v3.lab';
const LOGS_KEY = 'straitwatch.v3.lab.logs';
/** Tests whose logs stay on the device to rewatch (without thumbnails). */
const KEEP_LOGS = 6;

const today = () => new Date().toISOString().slice(0, 10);

export function loadLabProgress(): LabProgress {
  const base: LabProgress = { results: {}, length: 'full', mix: 'normal', queue: [], session: { day: today(), ids: [] } };
  try {
    const raw = JSON.parse(kv.getItem(KEY) ?? 'null') as Partial<LabProgress> | null;
    if (!raw) return base;
    const p: LabProgress = {
      results: raw.results ?? {},
      length: raw.length === 'quick' ? 'quick' : 'full',
      mix: raw.mix === 'light' || raw.mix === 'heavy' ? raw.mix : 'normal',
      queue: (raw.queue ?? []).filter((id) => !!labCard(id)),
      session: raw.session && raw.session.day === today() ? raw.session : base.session,
    };
    return p;
  } catch {
    return base;
  }
}

export function saveLabProgress(p: LabProgress): void {
  try {
    kv.setItem(KEY, JSON.stringify(p));
  } catch {
    // not remembered
  }
}

/** Keep a test's log on the device for the report's rewatch (thumbnails
 *  dropped: they're in the uploaded copy). */
export function keepLabLog(cardId: string, log: PlayLog): void {
  try {
    const all = labLogs().filter((l) => l.id !== log.id);
    const slim: PlayLog = { ...log, notes: log.notes?.map((n) => ({ ...n, thumb: undefined })) };
    all.unshift({ ...slim, lab: log.lab ?? { card: cardId, length: 'full', mix: 'normal' } });
    kv.setItem(LOGS_KEY, JSON.stringify(all.slice(0, KEEP_LOGS)));
  } catch {
    // too big for the device's storage: the uploaded copy has it
  }
}

export function labLogs(): PlayLog[] {
  try {
    return JSON.parse(kv.getItem(LOGS_KEY) ?? '[]') as PlayLog[];
  } catch {
    return [];
  }
}

/** The next cards to test: the checklist's order, skipping what's marked. */
export function nextCards(p: LabProgress, n: number, after?: string): LabCard[] {
  const open = LAB_CARDS.filter((c) => !p.results[c.id] && c.id !== after);
  return open.slice(0, n);
}

export function defaultSetup(card: LabCard, p: LabProgress, last?: LabRunSetup): LabRunSetup {
  return {
    wave: last?.wave ?? LAB_START_WAVE,
    weapons: card.kit.map((id) => ({ id, level: 1 })),
    length: p.length,
    mix: p.mix,
  };
}

// ---- DOM helpers -----------------------------------------------------------

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

const VERDICT_LABEL: Record<LabVerdict, string> = { keep: 'Keep', tune: 'Tune', cut: 'Cut' };

function chip(r: LabResult | undefined): HTMLElement {
  if (!r || !r.verdict) return el('span', `v3-lab-chip${r ? ' seen' : ''}`, r ? 'TESTED' : 'TO TEST');
  return el('span', `v3-lab-chip ${r.verdict}`, VERDICT_LABEL[r.verdict].toUpperCase());
}

// ---- The hub ---------------------------------------------------------------

export interface HubHandlers {
  start: (id: string) => void;
  playFive: () => void;
  setLength: (l: LabLength) => void;
  report: () => void;
}

export function labHub(p: LabProgress, h: HubHandlers): HTMLElement {
  const body = el('div', 'v3-lab-hub');
  const done = LAB_CARDS.filter((c) => p.results[c.id]).length;
  const list = el('div', 'v3-lab-list');
  for (const s of LAB_SECTIONS) {
    const cards = LAB_CARDS.filter((c) => c.kind === s.kind);
    const sec = el('details', 'v3-lab-sec');
    sec.open = s.kind === 'enemy' || s.kind === 'combo';
    sec.dataset.section = s.kind;
    const marked = cards.filter((c) => p.results[c.id]).length;
    const sum = el('summary');
    sum.append(el('b', '', s.name), el('span', '', `${marked} of ${cards.length}`), el('i', '', s.blurb));
    sec.append(sum);
    for (const c of cards) {
      const r = p.results[c.id];
      const row = button('', `v3-lab-row${r ? ' done' : ''}`, () => h.start(c.id));
      row.dataset.card = c.id;
      const text = el('span', 'v3-lab-row-text');
      text.append(el('b', '', c.name), el('small', '', r?.note ? `“${r.note}”` : c.look));
      row.append(text, chip(r));
      sec.append(row);
    }
    list.append(sec);
  }
  const side = el('div', 'v3-lab-side');
  const bar = el('div', 'v3-lab-progress');
  bar.append(el('span', '', `${done} of ${LAB_CARDS.length} tested`));
  const track = el('span', 'v3-lab-track');
  const fill = el('i');
  fill.style.width = `${Math.round((100 * done) / LAB_CARDS.length)}%`;
  track.append(fill);
  bar.append(track);
  const next = nextCards(p, 1)[0];
  const go = button('', 'v2-btn primary v3-lab-next', () => next && h.start(next.id));
  go.dataset.labNext = '1';
  go.innerHTML = '';
  go.append(el('span', '', next ? 'Next up' : 'All tested'), el('small', '', next ? next.name : 'Pick any card to test again'));
  if (!next) go.disabled = true;
  const five = button(p.queue.length ? `Play 5 (${p.queue.length} left)` : 'Play 5', 'v2-btn v3-lab-five', h.playFive);
  five.dataset.labFive = '1';
  const len = el('div', 'v3-lab-len');
  len.setAttribute('role', 'group');
  len.setAttribute('aria-label', 'Test length');
  for (const l of ['quick', 'full'] as LabLength[]) {
    const b = button('', `v3-lab-seg${p.length === l ? ' on' : ''}`, () => h.setLength(l));
    b.dataset.labLength = l;
    b.setAttribute('aria-pressed', String(p.length === l));
    b.append(el('b', '', l === 'quick' ? 'Quick' : 'Full'), el('small', '', l === 'quick' ? `${LAB_LENGTH.quick} waves` : `${LAB_LENGTH.full} waves, ~10 min`));
    len.append(b);
  }
  const report = button(`Session report${p.session.ids.length ? ` (${p.session.ids.length})` : ''}`, 'v2-btn v3-lab-report-btn', h.report);
  report.dataset.labReport = '1';
  const page = el('a', 'v2-btn v3-lab-page', 'Feedback page ↗');
  page.href = LAB_PAGE_URL;
  page.target = '_blank';
  page.rel = 'noopener';
  side.append(bar, go, five, len, report, page, el('p', 'v3-hint', 'Tests start at wave 5 with three weapons that suit the card. Setup in play changes them. Nothing here counts toward records.'));
  body.append(list, side);
  return body;
}

// ---- The bar in play --------------------------------------------------------

export interface BarHandlers {
  bring: () => void;
  note: () => void;
  setup: () => void;
  done: () => void;
}

export function labBar(card: LabCard, h: BarHandlers): { el: HTMLElement; update: (s: LabStats, waves: number, length: number) => void } {
  const bar = el('div', 'v3-lab-bar');
  const head = el('div', 'v3-lab-bar-head');
  head.append(el('b', '', card.name.toUpperCase()));
  head.title = card.look;
  const count = el('span', 'v3-lab-count');
  const acts = el('div', 'v3-lab-acts');
  const canBring = card.foes.length > 0 || !!card.weapon;
  if (canBring) {
    const b = button(card.foes.length ? 'Bring one' : 'Drop it', 'v3-lab-act', h.bring);
    b.dataset.labBring = '1';
    acts.append(b);
  }
  const note = button('Note', 'v3-lab-act', h.note);
  note.dataset.labNote = '1';
  const setup = button('Setup', 'v3-lab-act', h.setup);
  setup.dataset.labSetup = '1';
  const done = button('Done', 'v3-lab-act done', h.done);
  done.dataset.labDone = '1';
  acts.append(note, setup, done);
  bar.append(head, count, acts);
  let key = '';
  return {
    el: bar,
    update: (s, waves, length) => {
      const parts = card.foes.length
        ? [`came ${s.came}`, `killed ${s.killed}`, `hit you ${s.harm}`]
        : card.weapon
          ? [`kills ${s.weaponKills}`]
          : [];
      parts.push(`${Math.min(waves + 1, length)}/${length}`);
      const k = parts.join(' · ');
      if (k === key) return;
      key = k;
      count.textContent = k;
      done.classList.toggle('ready', waves >= Math.min(2, length));
    },
  };
}

// ---- Setup ----------------------------------------------------------------

export function labSetupSheet(card: LabCard, setup: LabRunSetup, apply: (s: LabRunSetup) => void, cancel: () => void): HTMLElement {
  const s = structuredClone(setup);
  const sheet = el('div', 'v3-lab-sheet');
  sheet.append(el('h2', '', `Setup · ${card.name}`));
  const row = (label: string, ...controls: HTMLElement[]) => {
    const r = el('div', 'v3-lab-line');
    r.append(el('span', 'v3-fp-label', label), ...controls);
    return r;
  };
  const waveOut = el('b', 'v3-lab-wave', String(s.wave));
  const step = (d: number) => {
    s.wave = Math.max(1, Math.min(15, s.wave + d));
    waveOut.textContent = String(s.wave);
  };
  const minus = button('−', 'v3-lab-step', () => step(-1));
  minus.setAttribute('aria-label', 'Earlier wave');
  const plus = button('+', 'v3-lab-step', () => step(1));
  plus.setAttribute('aria-label', 'Later wave');
  sheet.append(row('Wave', minus, waveOut, plus));
  for (let i = 0; i < 3; i++) {
    const w = s.weapons[i];
    const pick = document.createElement('select');
    pick.className = 'v3-select';
    pick.dataset.labWeapon = String(i);
    for (const [v, t] of [['', '—'], ...ABILITY_ORDER.map((a): [string, string] => [a, ABILITIES[a].name])]) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = t;
      pick.append(o);
    }
    pick.value = w?.id ?? '';
    const lv = document.createElement('select');
    lv.className = 'v3-select';
    for (let k = 1; k <= ABILITY_MAX; k++) {
      const o = document.createElement('option');
      o.value = String(k);
      o.textContent = k === ABILITY_MAX ? 'MAX' : `LV ${k}`;
      lv.append(o);
    }
    lv.value = String(w?.level ?? 1);
    const sync = () => {
      const rest = s.weapons.filter((_, k) => k !== i);
      s.weapons = pick.value ? [...rest.slice(0, i), { id: pick.value as AbilityId, level: Number(lv.value) }, ...rest.slice(i)] : rest;
    };
    pick.addEventListener('change', sync);
    lv.addEventListener('change', sync);
    sheet.append(row(`Weapon ${i + 1}`, pick, lv));
  }
  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void) => {
    const g = el('div', 'v3-lab-len');
    const btns = options.map(([v, t]) => {
      const b = button(t, `v3-lab-seg small${v === value ? ' on' : ''}`, () => {
        set(v);
        btns.forEach((o, k) => o.classList.toggle('on', options[k][0] === v));
      });
      return b;
    });
    g.append(...btns);
    return g;
  };
  sheet.append(row('Mix', seg(s.mix, [['light', 'Light'], ['normal', 'Normal'], ['heavy', 'Heavy']], (v) => (s.mix = v))));
  sheet.append(row('Length', seg(s.length, [['quick', `Quick · ${LAB_LENGTH.quick} waves`], ['full', `Full · ${LAB_LENGTH.full} waves`]], (v) => (s.length = v))));
  const acts = el('div', 'v3-lab-sheet-acts');
  const go = button('Restart with this', 'v2-btn primary', () => apply(s));
  go.dataset.labApply = '1';
  acts.append(button('Back to the test', 'v2-btn', cancel), go);
  sheet.append(acts);
  return sheet;
}

// ---- The verdict ------------------------------------------------------------

export interface VerdictHandlers {
  save: (r: Pick<LabResult, 'verdict' | 'tags' | 'note'>, then: 'next' | 'again' | 'list') => void;
}

export function labVerdictSheet(card: LabCard, s: LabStats, waves: number, ended: LabResult['ended'], prior: LabResult | undefined, next: LabCard | undefined, h: VerdictHandlers): HTMLElement {
  const sheet = el('div', 'v3-lab-sheet v3-lab-verdict');
  const title = ended === 'lost' ? `${card.name} · the convoy was lost` : `${card.name} · how was it?`;
  sheet.append(el('h2', '', title));
  const cols = el('div', 'v3-lab-cols');
  const left = el('div', 'v3-lab-col');
  let verdict: LabVerdict | null = prior?.verdict ?? null;
  const tags = new Set<string>(prior?.tags ?? []);
  const vrow = el('div', 'v3-lab-v');
  const vbtns = (['keep', 'tune', 'cut'] as LabVerdict[]).map((v) => {
    const b = button(VERDICT_LABEL[v], `v3-lab-vbtn ${v}${verdict === v ? ' on' : ''}`, () => {
      verdict = verdict === v ? null : v;
      vbtns.forEach((o, k) => o.classList.toggle('on', ['keep', 'tune', 'cut'][k] === verdict));
    });
    b.dataset.labVerdict = v;
    return b;
  });
  vrow.append(...vbtns);
  const trow = el('div', 'v3-lab-tags');
  for (const t of LAB_TAGS) {
    const b = button(t, `v3-lab-tag${tags.has(t) ? ' on' : ''}`, () => {
      if (tags.has(t)) tags.delete(t);
      else tags.add(t);
      b.classList.toggle('on', tags.has(t));
    });
    trow.append(b);
  }
  const note = el('textarea', 'v3-lab-note');
  note.id = 'lab-note';
  note.rows = 3;
  note.placeholder = 'What did you notice? (the microphone key on the keyboard dictates)';
  note.value = prior?.note ?? '';
  left.append(vrow, trow, note);
  const right = el('div', 'v3-lab-col v3-lab-evidence');
  right.append(el('span', 'v3-eyebrow', 'Counted this test'));
  for (const line of evidenceLines(card, s, waves)) right.append(el('p', '', line));
  cols.append(left, right);
  const acts = el('div', 'v3-lab-sheet-acts');
  const result = () => ({ verdict, tags: [...tags], note: note.value.trim() });
  const again = button('Save · test again', 'v2-btn', () => h.save(result(), 'again'));
  const list = button('Save · back to the list', 'v2-btn', () => h.save(result(), 'list'));
  list.dataset.labList = '1';
  acts.append(again, list);
  if (next) {
    const n = button('', 'v2-btn primary', () => h.save(result(), 'next'));
    n.dataset.labSaveNext = '1';
    n.append(el('span', '', 'Save · next'), el('small', '', next.name));
    acts.append(n);
  }
  sheet.append(cols, acts);
  return sheet;
}

// ---- The session report -------------------------------------------------------

export function labReport(p: LabProgress, rewatch: (log: PlayLog, step: number) => void, send: (out: HTMLElement) => void): HTMLElement {
  const box = el('div', 'v3-lab-report');
  const logs = labLogs();
  if (!p.session.ids.length) box.append(el('p', 'v3-hint', 'Nothing tested yet today. Tests you finish show here, with your notes.'));
  for (const id of p.session.ids) {
    const card = labCard(id);
    const r = p.results[id];
    if (!card || !r) continue;
    const item = el('div', 'v3-lab-ritem');
    const head = el('div', 'v3-lab-rhead');
    head.append(el('b', '', card.name), chip(r));
    item.append(head);
    if (r.tags.length) item.append(el('p', 'v3-lab-rtags', r.tags.join(' · ')));
    if (r.note) item.append(el('p', 'v3-lab-rnote', `“${r.note}”`));
    item.append(el('p', 'v3-lab-rstats', evidenceLines(card, r.stats, r.waves).join(' · ')));
    const log = logs.find((l) => l.lab?.card === id);
    for (const n of log?.notes ?? []) {
      const b = button(`Rewatch: ${n.text ? `“${n.text.slice(0, 48)}”` : 'your note'}`, 'v2-btn v3-lab-rewatch', () => rewatch(log!, n.step));
      item.append(b);
    }
    box.append(item);
  }
  const out = el('p', 'v3-hint');
  const send1 = button('Send logs now', 'v2-btn', () => send(out));
  send1.dataset.labSend = '1';
  const page = el('a', 'v2-btn v3-lab-page', 'Feedback page ↗');
  page.href = LAB_PAGE_URL;
  page.target = '_blank';
  page.rel = 'noopener';
  const acts = el('div', 'v3-lab-sheet-acts');
  acts.append(send1, page);
  box.append(acts, out);
  return box;
}
