// The Test Lab's screens (docs/design/v3-test-lab.md): the hub with its
// checklist, the bar in play, the setup sheet, the verdict sheet and the
// session report. DOM only; app.ts runs the tests. What the player has
// tested is kept on this device (and every test's verdict also goes into its
// game log, which reaches Claude).

import { ABILITIES, ABILITY_MAX, ABILITY_ORDER, type AbilityId } from '../data/abilities';
import { LAB_CARDS, LAB_EVENT_LEVEL, LAB_EVENT_RUNS, LAB_LENGTH, LAB_ROUND, LAB_SECTIONS, LAB_START_WAVE, cardChanges, cardRev, labCard, labRound, type LabCard, type LabLength, type LabMix } from '../data/lab';
import { evidenceLines, labCountText, type LabStats } from '../sim/lab';
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

/** One test's verdict as kept on the device: the result, when, the card's
 *  version and the test round it was played in, and the build. */
export interface LabEntry extends LabResult {
  at: string;
  rev: number;
  round: number;
  build?: string;
}

export interface LabProgress {
  /** Every verdict for each card, oldest first (a new one is appended). */
  results: Record<string, LabEntry[]>;
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

/** A card keeps this many verdicts on the device (the logs keep them all). */
const KEEP_ENTRIES = 20;

const today = () => new Date().toISOString().slice(0, 10);

/** Saved results, from any version of the store: before rounds a card held
 *  one result object (round 1, version 1); now it holds a list. */
function migrateResults(raw: unknown): Record<string, LabEntry[]> {
  const out: Record<string, LabEntry[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const list = (Array.isArray(v) ? v : v && typeof v === 'object' ? [v] : []) as Partial<LabEntry>[];
    out[id] = list
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({ ...(e as LabEntry), rev: typeof e.rev === 'number' ? e.rev : 1, round: typeof e.round === 'number' ? e.round : 1 }));
  }
  return out;
}

/** The saved progress (parsed JSON), made current. */
export function parseLabProgress(raw: unknown): LabProgress {
  const base: LabProgress = { results: {}, length: 'full', mix: 'normal', queue: [], session: { day: today(), ids: [] } };
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Record<keyof LabProgress, unknown>> & { session?: { day?: string; ids?: string[] } };
  return {
    results: migrateResults(r.results),
    length: r.length === 'quick' ? 'quick' : 'full',
    mix: r.mix === 'light' || r.mix === 'heavy' ? r.mix : 'normal',
    queue: (Array.isArray(r.queue) ? (r.queue as string[]) : []).filter((id) => !!labCard(id)),
    session: r.session && r.session.day === today() && Array.isArray(r.session.ids) ? { day: r.session.day, ids: r.session.ids } : base.session,
  };
}

export function loadLabProgress(): LabProgress {
  try {
    return parseLabProgress(JSON.parse(kv.getItem(KEY) ?? 'null'));
  } catch {
    return parseLabProgress(null);
  }
}

// ---- Versions: what counts as tested ----------------------------------------

/** The newest verdict given at the card's current version (none: the card
 *  is untested, or changed since). */
export function currentEntry(p: LabProgress, id: string): LabEntry | undefined {
  const rev = cardRev(id);
  const list = p.results[id] ?? [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].rev >= rev) return list[i];
  return undefined;
}

/** Verdicts given on older versions of the card, newest first. */
export function olderEntries(p: LabProgress, id: string): LabEntry[] {
  const rev = cardRev(id);
  return (p.results[id] ?? []).filter((e) => e.rev < rev).reverse();
}

/** Tested at its current version, changed since its last test, or never
 *  tested. */
export type LabStatus = 'tested' | 'changed' | 'untested';

export function labStatus(p: LabProgress, id: string): LabStatus {
  if (currentEntry(p, id)) return 'tested';
  return (p.results[id] ?? []).length ? 'changed' : 'untested';
}

/** What changed in a card since the player last tested it (none if it is
 *  current or never tested). */
export function changedSince(p: LabProgress, id: string): string[] {
  const last = olderEntries(p, id)[0];
  return !currentEntry(p, id) && last ? cardChanges(id, last.round) : [];
}

/** Keep a new verdict: appended, so it becomes the current one and the old
 *  ones stay as history. */
export function addLabEntry(p: LabProgress, id: string, e: LabEntry): void {
  p.results[id] = [...(p.results[id] ?? []), e].slice(-KEEP_ENTRIES);
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

/** The next cards to test: the ones changed since they were tested first
 *  (the most useful to try again), then the untested, each in the
 *  checklist's order. */
export function nextCards(p: LabProgress, n: number, after?: string): LabCard[] {
  const open = LAB_CARDS.filter((c) => c.id !== after);
  const changed = open.filter((c) => labStatus(p, c.id) === 'changed');
  const untested = open.filter((c) => labStatus(p, c.id) === 'untested');
  return [...changed, ...untested].slice(0, n);
}

export function defaultSetup(card: LabCard, p: LabProgress, last?: LabRunSetup): LabRunSetup {
  return {
    // An event card starts at its event's wave, its kit levelled up.
    wave: card.wave ?? last?.wave ?? LAB_START_WAVE,
    weapons: card.kit.map((id) => ({ id, level: card.kind === 'event' ? LAB_EVENT_LEVEL : 1 })),
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

/** An old verdict in one line: "Round 1 · Keep · “note”". */
function oldLine(e: LabEntry): string {
  return [`Round ${e.round}`, e.verdict ? VERDICT_LABEL[e.verdict] : 'Tested', e.note ? `“${e.note}”` : ''].filter(Boolean).join(' · ');
}

/** The round being tested, as the hub and the report name it. */
export function roundTitle(): string {
  const r = labRound(LAB_ROUND);
  return `Test round ${LAB_ROUND}${r ? ` · ${r.name}` : ''}`;
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
  const status = new Map(LAB_CARDS.map((c) => [c.id, labStatus(p, c.id)]));
  const count = (cards: LabCard[], s: LabStatus) => cards.filter((c) => status.get(c.id) === s).length;
  const done = count(LAB_CARDS, 'tested');
  const list = el('div', 'v3-lab-list');
  for (const s of LAB_SECTIONS) {
    const cards = LAB_CARDS.filter((c) => c.kind === s.kind);
    const sec = el('details', 'v3-lab-sec');
    sec.open = s.kind === 'event' || s.kind === 'enemy' || s.kind === 'combo';
    sec.dataset.section = s.kind;
    const retest = count(cards, 'changed');
    const sum = el('summary');
    sum.append(el('b', '', s.name), el('span', '', `${count(cards, 'tested')} of ${cards.length}${retest ? ` · ${retest} to retest` : ''}`), el('i', '', s.blurb));
    sec.append(sum);
    for (const c of cards) {
      const st = status.get(c.id)!;
      const r = currentEntry(p, c.id);
      const row = button('', `v3-lab-row${st === 'tested' ? ' done' : st === 'changed' ? ' changed' : ''}`, () => h.start(c.id));
      row.dataset.card = c.id;
      row.dataset.status = st;
      const text = el('span', 'v3-lab-row-text');
      text.append(el('b', '', c.name));
      if (st === 'changed') {
        // Changed since the last test: what changed, and the old verdict,
        // dimmed (it was about a different version).
        const what = changedSince(p, c.id);
        text.append(el('small', 'v3-lab-what', what.length ? `New: ${what.join(' · ')}` : 'Changed since your last test'));
        const old = el('small', 'v3-lab-old', oldLine(olderEntries(p, c.id)[0]));
        text.append(old);
        row.append(text, el('span', 'v3-lab-chip changed', 'CHANGED · TEST AGAIN'));
      } else {
        text.append(el('small', '', r?.note ? `“${r.note}”` : c.look));
        row.append(text, chip(r));
      }
      sec.append(row);
    }
    list.append(sec);
  }
  const side = el('div', 'v3-lab-side');
  const round = el('div', 'v3-lab-round');
  round.dataset.labRound = String(LAB_ROUND);
  const retest = count(LAB_CARDS, 'changed');
  round.append(el('b', '', `${retest} to retest`), el('span', '', `${count(LAB_CARDS, 'untested')} untested`));
  round.classList.toggle('none', !retest);
  const bar = el('div', 'v3-lab-progress');
  bar.append(el('span', '', `${done} of ${LAB_CARDS.length} tested this round`));
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
  if (next && labStatus(p, next.id) === 'changed') go.append(el('small', 'v3-lab-next-why', 'changed · test again'));
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
  side.append(round, bar, go, five, len, report, page, el('p', 'v3-hint', 'Tests start at wave 5 (an event at its own wave: 11, or a bonus event after wave 6) with three weapons that suit the card. Setup in play changes them. Nothing here counts toward records.'));
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
    // An event card: the same command starts the event over.
    const b = button(card.event ? 'Run it again' : card.foes.length ? 'Bring one' : 'Drop it', 'v3-lab-act', h.bring);
    b.dataset.labBring = '1';
    if (card.event) b.dataset.labRerun = '1';
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
      const k = labCountText(card, s, waves, length);
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
  const runs = card.event ? LAB_EVENT_RUNS : LAB_LENGTH;
  const unit = (n: number) => (card.event ? `${n} run${n === 1 ? '' : 's'}` : `${n} waves`);
  sheet.append(row('Length', seg(s.length, [['quick', `Quick · ${unit(runs.quick)}`], ['full', `Full · ${unit(runs.full)}`]], (v) => (s.length = v))));
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

/** What the verdict sheet holds so far (the verdict, the tags, the note):
 *  app.ts keeps it for the test, so the sheet drawn again (a wave's end
 *  coming in under it) starts where the player left it. */
export interface VerdictDraft {
  verdict: LabVerdict | null;
  tags: string[];
  note: string;
}

/** A fresh sheet: filled in from the card's verdict at this version, if
 *  it has one. */
export function newVerdictDraft(p: LabProgress, cardId: string): VerdictDraft {
  const prior = currentEntry(p, cardId);
  return { verdict: prior?.verdict ?? null, tags: [...(prior?.tags ?? [])], note: prior?.note ?? '' };
}

/** What Save keeps from the sheet: nothing without a verdict (the sheet
 *  asks for one instead). */
export function verdictResult(d: VerdictDraft): Pick<LabResult, 'verdict' | 'tags' | 'note'> | null {
  return d.verdict ? { verdict: d.verdict, tags: [...d.tags], note: d.note.trim() } : null;
}

/** Round 4's logs: seven cards saved with a note and no verdict. While the
 *  player typed, the Keep / Tune / Cut row was folded away with the rest of
 *  the sheet, and Save (all that was left) saved a null verdict. The row now
 *  stays while typing, and Save with no verdict asks for one. */
export function labVerdictSheet(card: LabCard, s: LabStats, waves: number, ended: LabResult['ended'], p: LabProgress, next: LabCard | undefined, h: VerdictHandlers, draft?: VerdictDraft): HTMLElement {
  const sheet = el('div', 'v3-lab-sheet v3-lab-verdict');
  const title = ended === 'lost' ? `${card.name} · the convoy was lost` : `${card.name} · how was it?`;
  sheet.append(el('h2', '', title));
  const older = olderEntries(p, card.id);
  const what = changedSince(p, card.id);
  if (what.length) {
    const ch = el('div', 'v3-lab-changes');
    ch.append(el('span', 'v3-eyebrow', `Changed since your round ${older[0].round} test`));
    for (const w of what) ch.append(el('p', '', w));
    sheet.append(ch);
  }
  const cols = el('div', 'v3-lab-cols');
  const left = el('div', 'v3-lab-col');
  const d = draft ?? newVerdictDraft(p, card.id);
  const tags = new Set<string>(d.tags);
  // The verdict row, and the ask for one: they stay in sight while the
  // keyboard is up (app.ts, enterTyping).
  const vwrap = el('div', 'v3-lab-vwrap');
  vwrap.dataset.typingKeep = '1';
  const vrow = el('div', 'v3-lab-v');
  vrow.setAttribute('role', 'group');
  vrow.setAttribute('aria-label', 'Verdict');
  const need = el('p', 'v3-lab-need', 'Pick Keep, Tune or Cut, then save.');
  need.dataset.labNeed = '1';
  need.hidden = true;
  const vbtns = (['keep', 'tune', 'cut'] as LabVerdict[]).map((v) => {
    const b = button(VERDICT_LABEL[v], `v3-lab-vbtn ${v}${d.verdict === v ? ' on' : ''}`, () => {
      d.verdict = d.verdict === v ? null : v;
      vbtns.forEach((o, k) => {
        o.classList.toggle('on', ['keep', 'tune', 'cut'][k] === d.verdict);
        o.setAttribute('aria-pressed', String(['keep', 'tune', 'cut'][k] === d.verdict));
      });
      if (d.verdict) {
        need.hidden = true;
        vrow.classList.remove('need');
      }
    });
    b.dataset.labVerdict = v;
    b.setAttribute('aria-pressed', String(d.verdict === v));
    // A tap here while typing leaves the text box its focus (and the
    // keyboard up).
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  });
  vrow.append(...vbtns);
  vwrap.append(vrow, need);
  const trow = el('div', 'v3-lab-tags');
  for (const t of LAB_TAGS) {
    const b = button(t, `v3-lab-tag${tags.has(t) ? ' on' : ''}`, () => {
      if (tags.has(t)) tags.delete(t);
      else tags.add(t);
      d.tags = LAB_TAGS.filter((o) => tags.has(o));
      b.classList.toggle('on', tags.has(t));
    });
    trow.append(b);
  }
  const note = el('textarea', 'v3-lab-note');
  note.id = 'lab-note';
  note.rows = 3;
  note.placeholder = 'What did you notice? (the microphone key on the keyboard dictates)';
  note.value = d.note;
  note.addEventListener('input', () => (d.note = note.value));
  // Keys typed here are the note's, not the game's.
  note.addEventListener('keydown', (e) => e.stopPropagation());
  left.append(vwrap, trow, note);
  const right = el('div', 'v3-lab-col v3-lab-evidence');
  right.append(el('span', 'v3-eyebrow', 'Counted this test'));
  for (const line of evidenceLines(card, s, waves)) right.append(el('p', '', line));
  if (older.length) {
    // Earlier versions' verdicts, read only.
    const hist = el('div', 'v3-lab-history');
    hist.dataset.labHistory = '1';
    hist.append(el('span', 'v3-eyebrow', 'Your earlier verdicts'));
    for (const e of older.slice(0, 2)) {
      const line = el('p', '', oldLine(e));
      line.title = oldLine(e);
      hist.append(line);
    }
    right.append(hist);
  }
  cols.append(left, right);
  const acts = el('div', 'v3-lab-sheet-acts');
  // No verdict yet: ask for one rather than save a blank (the note and the
  // tags stay as they are).
  const save = (then: 'next' | 'again' | 'list') => {
    d.note = note.value;
    const r = verdictResult(d);
    if (!r) {
      // The keyboard goes, so the whole sheet (the row, and why) is back.
      note.blur();
      need.hidden = false;
      vrow.classList.remove('need');
      void vrow.offsetWidth;
      vrow.classList.add('need');
      return;
    }
    h.save(r, then);
  };
  const again = button('Save · test again', 'v2-btn', () => save('again'));
  again.dataset.labAgain = '1';
  const list = button('Save · back to the list', 'v2-btn', () => save('list'));
  list.dataset.labList = '1';
  acts.append(again, list);
  if (next) {
    const n = button('', 'v2-btn primary', () => save('next'));
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
  box.append(el('p', 'v3-lab-rtitle', roundTitle()));
  if (!p.session.ids.length) box.append(el('p', 'v3-hint', 'Nothing tested yet today. Tests you finish show here, with your notes.'));
  for (const id of p.session.ids) {
    const card = labCard(id);
    const r = (p.results[id] ?? []).at(-1);
    if (!card || !r) continue;
    const item = el('div', 'v3-lab-ritem');
    const head = el('div', 'v3-lab-rhead');
    const name = el('span', 'v3-lab-rname');
    name.append(el('b', '', card.name), el('span', 'v3-lab-rround', `Round ${r.round}`));
    head.append(name, chip(r));
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
