// The Test Lab's screens (docs/design/v3-test-lab.md): the hub with its
// checklist, the bar in play, the setup sheet, the verdict sheet and the
// session report. DOM only; app.ts runs the tests. What the player has
// tested is kept on this device (and every test's verdict also goes into its
// game log, which reaches Claude).

import { COMMANDS, CONVOY_REV, POLICY_ORDER, mapConvoy, type ConvoyPolicy, type ConvoySetup } from '../data/convoy';
import { ENCOUNTER_REV, hasEncounters, isVersion, type EncounterSetup, type EncounterVersion } from '../data/encounters';
import { ABILITIES, ABILITY_MAX, ABILITY_ORDER, type AbilityId } from '../data/abilities';
import { LAB_CARDS, LAB_EVENT_LEVEL, LAB_EVENT_RUNS, LAB_LENGTH, LAB_ROUND, LAB_SECTIONS, LAB_START_WAVE, MAP_CARD_PLAYS, cardChanges, cardRev, cardVersion, labCard, labRound, mapProduction, productionText, type LabCard, type LabLength, type LabMix } from '../data/lab';
import { campaignWaves } from '../data/events';
import { evidenceLines, labCountText, type LabPlays, type LabSetup, type LabStats } from '../sim/lab';
import type { LabResult, PlayLog } from '../sim/playlog';
import { kv } from '../platform/store';
import { MAP_VARIANT_DEFAULT, SCORECARD_REV, answerText, cleanScorecard, scoreCategory, scoreRows, suggestWaves, waveChips, waveLabel, waveScoreText, type ScoreCategory, type Scorecard, type WaveScore } from '../data/scorecard';
import type { MomentKind, Rating } from '../sim/feedback';
import { ratingRows } from './notes';

/** The review page for the Test Lab: it shows what was marked here (Claude
 *  copies it over from the game logs), and what is left to test. */
export const LAB_PAGE_URL = 'https://claude.ai/artifact/SzK5Boc4CrB9wrtMbd7249';

export type LabVerdict = 'keep' | 'tune' | 'cut';

export const LAB_TAGS = ["Can't see the tell", 'Too hard', 'Too easy', 'Unfair', 'Confusing', 'Fun', 'Bug'];

/** What a test starts with (the setup sheet changes it). */
export interface LabRunSetup {
  wave: number;
  weapons: { id: AbilityId; level: number }[];
  length: LabLength;
  mix: LabMix;
  /** The Map & Convoy Lab: the convoy policy to play it under (absent:
   *  today's controls). */
  convoy?: ConvoyPolicy;
  /** The map's authored encounters on (slice 5), or its shared waves. */
  encounters?: boolean;
  /** A map card (Test Lab round 10): the full map (the default), or the
   *  old short lab run, a "Quick slice" (the wave, weapons, mix and length
   *  above are a slice's; a full run has none of them). */
  plays?: LabPlays;
  /** A map card (round 11): the map's encounter version to play (absent:
   *  MAP_VARIANT_DEFAULT, 'v1'). Round 12: the card's own (its `variant`:
   *  each version has a card). */
  variant?: EncounterVersion;
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
  // A map card (Test Lab round 10) opens as the production candidate: the
  // full map, under its production convoy and encounters. Its quick slice
  // (on the setup sheet) starts from the lab's own start wave.
  if (card.kind === 'map') return { ...productionSetup(card), length: p.length, mix: p.mix };
  return {
    // An event card starts at its event's wave, its kit levelled up.
    wave: card.wave ?? last?.wave ?? LAB_START_WAVE,
    weapons: card.kit.map((id) => ({ id, level: card.kind === 'event' ? LAB_EVENT_LEVEL : 1 })),
    length: p.length,
    mix: p.mix,
  };
}

/** A map card's production setup (round 10): the full map, the map's
 *  production convoy policy and encounters (data/lab.ts, mapProduction);
 *  a quick slice's wave and kit are the lab's own, ready if picked. */
export function productionSetup(card: LabCard, base?: Pick<LabRunSetup, 'length' | 'mix'>): LabRunSetup {
  const prod = mapProduction(card.map);
  return {
    plays: 'full',
    convoy: prod.convoy,
    encounters: prod.encounters,
    variant: cardVersion(card),
    wave: LAB_START_WAVE,
    weapons: card.kit.map((id) => ({ id, level: 1 })),
    length: base?.length ?? 'full',
    mix: base?.mix ?? 'normal',
  };
}

/** Is this a map card's production setup: the full map, under its
 *  production convoy policy and encounters? */
export function isProduction(card: LabCard, s: LabRunSetup): boolean {
  if (card.kind !== 'map') return false;
  const prod = mapProduction(card.map);
  return s.plays !== 'slice' && (s.convoy ?? 'current') === prod.convoy && !!s.encounters === prod.encounters && (s.variant ?? MAP_VARIANT_DEFAULT) === cardVersion(card);
}

/** What a test is started with, from its setup: the lab card's setup for
 *  the log, the convoy policy and the encounters, and for a map card's full
 *  run (round 10) no Free Play setup at all (it starts at wave 1 with the
 *  player's Armory, as the campaign does). `link`: the page's link, when
 *  it named this card (`?lab=map-strait&convoy=current&enc=0&plays=slice`
 *  change the setup for a comparison; `callouts=1` or `0` turns the
 *  encounters' call-outs on or off whatever the version says (round 12);
 *  the plain link is the production setup). The setup returned is the one
 *  played (the sheet starts from it). */
export function labRunPlan(card: LabCard, setup: LabRunSetup, link?: URLSearchParams | null): { setup: LabRunSetup; full: boolean; lab: LabSetup; convoy: ConvoySetup | null; encounters: EncounterSetup | null } {
  const s = structuredClone(setup);
  if (link) {
    const asked = link.get('convoy');
    if (asked && (POLICY_ORDER as string[]).includes(asked)) s.convoy = asked as ConvoyPolicy;
    if (link.get('enc') === '1') s.encounters = true;
    else if (link.get('enc') === '0') s.encounters = false;
    if (card.kind === 'map' && (link.get('plays') === 'slice' || link.get('plays') === 'full')) s.plays = link.get('plays') as LabPlays;
  }
  const map = card.kind === 'map';
  if (map && !s.plays) s.plays = 'full';
  const full = map && s.plays === 'full';
  const convoy: ConvoySetup | null = s.convoy && s.convoy !== 'current' ? { policy: s.convoy, obligation: 'natural', rev: CONVOY_REV } : null;
  // The map's encounter version (round 12): the card's, unless the setup
  // says otherwise.
  const version: EncounterVersion = isVersion(s.variant) ? s.variant : cardVersion(card);
  const callouts = link?.get('callouts');
  const encounters: EncounterSetup | null =
    s.encounters && !card.event && hasEncounters(card.map)
      ? { rev: ENCOUNTER_REV, version, ...(callouts === '1' || callouts === '0' ? { callouts: callouts === '1' } : {}) }
      : null;
  const rev = cardRev(card.id);
  // A map card says which encounter version of the map it played (round 11).
  const variant = map ? { variant: version } : {};
  const lab: LabSetup = full
    ? { card: card.id, rev, round: LAB_ROUND, plays: 'full', config: { convoy: s.convoy ?? 'current', encounters: encounters?.rev ?? 0, production: isProduction(card, s) }, ...variant }
    : { card: card.id, length: s.length, mix: s.mix, rev, round: LAB_ROUND, ...(map ? { plays: 'slice' as const } : {}), ...variant };
  return { setup: s, full, lab, convoy, encounters };
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
  /** The Map & Convoy Lab's viewer (ui/mapLab.ts). */
  analytics: () => void;
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
      // A map card (round 10) says what it plays, and how it is set up.
      if (c.kind === 'map') {
        const plays = el('small', 'v3-lab-plays', `${MAP_CARD_PLAYS} · ${productionText(c.map, cardVersion(c))}`);
        plays.dataset.labPlays = '1';
        text.append(plays);
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
  const analytics = button('Map Analytics', 'v2-btn v3-lab-analytics', h.analytics);
  analytics.dataset.maplabOpen = '1';
  const page = el('a', 'v2-btn v3-lab-page', 'Feedback page ↗');
  page.href = LAB_PAGE_URL;
  page.target = '_blank';
  page.rel = 'noopener';
  side.append(round, bar, go, five, len, report, analytics, page, el('p', 'v3-hint', 'Tests start at wave 5 (an event at its own wave: 11, or a bonus event after wave 6) with three weapons that suit the card. A map card plays the whole map from wave 1, as the campaign does, set up ready to test. Setup in play changes them. Nothing here counts toward records.'));
  body.append(list, side);
  return body;
}

// ---- The test on the pause menu ---------------------------------------------

// Pause-menu round (the player, on an iPhone in landscape: "We need to change
// the done and notes at the bottom banner to be in the bottom pause menu cuz
// that banner at the bottom covers up launchers"): the slim bar along the
// bottom of the field (rounds 8/9) is gone. The card's name and where the
// test is head the pause menu, and its commands are the menu's buttons; Done
// is on the draft between waves too (app.ts).

export interface LabPauseHandlers {
  bring: () => void;
  note: () => void;
  setup: () => void;
  done: () => void;
}

/** The pause menu's commands for a card: Bring one (Drop it, Run it again)
 *  only where the card has something of its own to bring; never on a map
 *  card (round 10: it plays the map as it is). */
export type LabAction = 'bring' | 'note' | 'setup' | 'done';
export function labActions(card: LabCard): LabAction[] {
  // An event card always has Run it again (round 11: the Drone Storm is
  // built on plain drones, no new enemy).
  const canBring = card.kind !== 'map' && (!!card.event || card.foes.length > 0 || !!card.weapon);
  return [...(canBring ? (['bring'] as const) : []), 'note', 'setup', 'done'];
}

/** The pause menu's header in a test: the card's name, where the test is
 *  (as the bar said it: "full map · wave 1/13") and what to look for. */
export function labPauseHead(card: LabCard, s: LabStats, waves: number, length: number, at: { plays?: LabPlays; wave?: number }): HTMLElement {
  const head = el('div', 'v3-lab-pause-head');
  head.dataset.labHead = card.id;
  const name = el('b', 'v3-lab-pause-name', card.name.toUpperCase());
  const count = el('span', 'v3-lab-count', labCountText(card, s, waves, length, at));
  const top = el('p', 'v3-lab-pause-top');
  top.append(el('span', 'v3-lab-pause-eyebrow', 'Paused · Test Lab'), name, count);
  head.append(top, el('p', 'v3-lab-pause-look', card.look));
  return head;
}

/** The pause menu's test commands, in the bar's order. Done turns gold once
 *  the test has run long enough to judge (two waves). */
export function labPauseActions(card: LabCard, h: LabPauseHandlers, waves: number, length: number): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (labActions(card).includes('bring')) {
    // An event card: the same command starts the event over.
    const b = button(card.event ? 'Run it again' : card.foes.length ? 'Bring one' : 'Drop it', 'v2-btn v3-lab-act', h.bring);
    b.dataset.labBring = '1';
    if (card.event) b.dataset.labRerun = '1';
    out.push(b);
  }
  const note = button('📝 Note', 'v2-btn v3-lab-act', h.note);
  note.dataset.labNote = '1';
  const setup = button('Setup', 'v2-btn v3-lab-act', h.setup);
  setup.dataset.labSetup = '1';
  out.push(note, setup, labDoneButton(h.done, waves, length));
  return out;
}

/** Done: ends the test and opens the verdict sheet (on the pause menu, and
 *  on the draft between a full run's waves). */
export function labDoneButton(done: () => void, waves: number, length: number): HTMLButtonElement {
  const b = button('Done', `v2-btn v3-lab-act done${waves >= Math.min(2, length) ? ' ready' : ''}`, done);
  b.dataset.labDone = '1';
  return b;
}

// ---- Setup ----------------------------------------------------------------

export function labSetupSheet(card: LabCard, setup: LabRunSetup, apply: (s: LabRunSetup) => void, cancel: () => void): HTMLElement {
  const s = structuredClone(setup);
  const map = card.kind === 'map';
  if (map && !s.plays) s.plays = 'full';
  const sheet = el('div', 'v3-lab-sheet');
  sheet.append(el('h2', '', `Setup · ${card.name}`));
  const row = (label: string, ...controls: HTMLElement[]) => {
    const r = el('div', 'v3-lab-line');
    r.append(el('span', 'v3-fp-label', label), ...controls);
    return r;
  };
  const seg = <T extends string>(value: T, options: [T, string][], set: (v: T) => void, key?: string) => {
    const g = el('div', 'v3-lab-len');
    const btns = options.map(([v, t]) => {
      const b = button(t, `v3-lab-seg small${v === value ? ' on' : ''}`, () => {
        set(v);
        btns.forEach((o, k) => o.classList.toggle('on', options[k][0] === v));
        refresh();
      });
      if (key) b.dataset[key] = v;
      return b;
    });
    g.append(...btns);
    return g;
  };
  // A map card (Test Lab round 10): the production setup, marked, with a
  // way back to it in one tap; the full map, or a quick slice.
  const prod = el('div', 'v3-lab-prod');
  prod.dataset.labProduction = '0';
  const prodHead = el('b', '');
  const prodWhat = el('small', '');
  const reset = button('Reset to production setup', 'v2-btn v3-lab-reset', () => {
    sheet.replaceWith(labSetupSheet(card, productionSetup(card, s), apply, cancel));
  });
  reset.dataset.labReset = '1';
  if (map) {
    const txt = el('span', 'v3-lab-prod-text');
    txt.append(prodHead, prodWhat);
    prod.append(txt, reset);
    sheet.append(prod);
    sheet.append(row('Run', seg<LabPlays>(s.plays ?? 'full', [['full', `Full map · ${campaignWaves(card.map)} waves`], ['slice', 'Quick slice']], (v) => (s.plays = v), 'labPlays')));
  }
  // The lab test's own setup: every card but a map card's full run.
  const slice = el('div', 'v3-lab-slice');
  const waveOut = el('b', 'v3-lab-wave', String(s.wave));
  const step = (d: number) => {
    s.wave = Math.max(1, Math.min(15, s.wave + d));
    waveOut.textContent = String(s.wave);
  };
  const minus = button('−', 'v3-lab-step', () => step(-1));
  minus.setAttribute('aria-label', 'Earlier wave');
  const plus = button('+', 'v3-lab-step', () => step(1));
  plus.setAttribute('aria-label', 'Later wave');
  slice.append(row('Wave', minus, waveOut, plus));
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
    slice.append(row(`Weapon ${i + 1}`, pick, lv));
  }
  slice.append(row('Mix', seg(s.mix, [['light', 'Light'], ['normal', 'Normal'], ['heavy', 'Heavy']], (v) => (s.mix = v))));
  const runs = card.event ? LAB_EVENT_RUNS : LAB_LENGTH;
  const unit = (n: number) => (card.event ? `${n} run${n === 1 ? '' : 's'}` : `${n} waves`);
  slice.append(row('Length', seg(s.length, [['quick', `Quick · ${unit(runs.quick)}`], ['full', `Full · ${unit(runs.full)}`]], (v) => (s.length = v))));
  sheet.append(slice);
  // The Map & Convoy Lab: who steers the convoy in this test.
  const cmds = mapConvoy(card.map).commands.map((id) => COMMANDS[id].name).join(' and ');
  sheet.append(
    row(
      'Convoy',
      seg<ConvoyPolicy>(
        s.convoy ?? 'current',
        [['current', "Today's"], ['auto', 'Automatic'], ['formation', 'Formations'], ['tactical', cmds ? `Commands: ${cmds}` : 'Commands (none here)']],
        (v) => (s.convoy = v),
        'labConvoy',
      ),
    ),
  );
  // The map's authored encounters in place of part of its shared waves
  // (the three reference maps, waves 1-10; an event card plays its event
  // either way).
  if (!card.event && hasEncounters(card.map))
    sheet.append(row('Waves', seg<'shared' | 'authored'>(s.encounters ? 'authored' : 'shared', [['shared', 'Shared'], ['authored', 'Authored encounters']], (v) => (s.encounters = v === 'authored'), 'labEncounters')));
  function refresh(): void {
    slice.hidden = map && s.plays !== 'slice';
    if (!map) return;
    const on = isProduction(card, s);
    prod.dataset.labProduction = on ? '1' : '0';
    prod.classList.toggle('on', on);
    prodHead.textContent = on ? 'Production setup' : 'Changed from the production setup';
    prodWhat.textContent = on
      ? `${MAP_CARD_PLAYS} · ${productionText(card.map, cardVersion(card))}`
      : `Production: ${MAP_CARD_PLAYS.toLowerCase()} · ${productionText(card.map, cardVersion(card))}`;
    reset.disabled = on;
  }
  refresh();
  const acts = el('div', 'v3-lab-sheet-acts');
  const go = button('Restart with this', 'v2-btn primary', () => apply(s));
  go.dataset.labApply = '1';
  acts.append(button('Back to the test', 'v2-btn', cancel), go);
  sheet.append(acts);
  return sheet;
}

// ---- The verdict ------------------------------------------------------------
// Since scorecard revision 4 (docs/design/v3-rate-and-review.md) a test's
// end screen is the normal game's "Rate & review this run" screen with a
// Test Lab section: the rating rows on top (a map card's full run: its
// scorecard, with the last scores for context), then the run on a
// timeline (its marked moments, Watch it, a note on a moment, each wave's
// rating from the draft, and a map run's Best and Weakest wave picked
// under it), then the Test Lab's verdict, tags and note.

export interface VerdictHandlers {
  save: (r: Pick<LabResult, 'verdict' | 'tags' | 'note' | 'score'>, then: 'next' | 'again' | 'list') => void;
}

/** What the verdict sheet holds so far (the verdict, the tags, the note):
 *  app.ts keeps it for the test, so the sheet drawn again (a wave's end
 *  coming in under it, a moment picked on the timeline, a replay watched)
 *  starts where the player left it. */
export interface VerdictDraft {
  verdict: LabVerdict | null;
  tags: string[];
  note: string;
  /** A map card's full run (round 11): the scorecard's answers so far (row
   *  id to answer), and whether the player skipped it. Never filled in
   *  from an earlier run: each run's score is its own. */
  score?: Partial<Record<ScoreCategory['id'], number | string>>;
  skipScore?: boolean;
  /** Revision 4: the Best and Weakest wave suggested from the per-wave
   *  ratings, and whether they were put in the score once already (a wave
   *  the player cleared is not put back). */
  suggested?: { best?: number; weakest?: number };
  prefilled?: boolean;
  /** Any other card: the normal game's three 1–5 rows (the log's
   *  `rating`). */
  rating?: Rating;
}

/** A fresh sheet: filled in from the card's verdict at this version, if
 *  it has one. */
export function newVerdictDraft(p: LabProgress, cardId: string): VerdictDraft {
  const prior = currentEntry(p, cardId);
  return { verdict: prior?.verdict ?? null, tags: [...(prior?.tags ?? [])], note: prior?.note ?? '' };
}

/** Revision 4: suggest Best and Weakest wave from the per-wave ratings,
 *  once, into rows the player hasn't answered. */
export function prefillWaves(d: VerdictDraft, waves: readonly WaveScore[]): void {
  if (d.prefilled) return;
  const s = suggestWaves(waves);
  if (s.best === undefined && s.weakest === undefined) return;
  d.prefilled = true;
  d.suggested = s;
  const answers = (d.score ??= {});
  if (s.best !== undefined && answers.best === undefined) answers.best = s.best;
  if (s.weakest !== undefined && answers.weakest === undefined) answers.weakest = s.weakest;
}

/** What Save keeps from the sheet: nothing without a verdict (the sheet
 *  asks for one instead). A map card's full run (`played`: the waves it
 *  played) adds its scorecard, unless it was skipped or left blank, and
 *  with it the card its comparison row named (`vsCard`), the waves rated
 *  on the draft (`waves`) and what the sheet suggested from them. */
export function verdictResult(d: VerdictDraft, played?: number, vsCard?: string, waves?: readonly WaveScore[]): Pick<LabResult, 'verdict' | 'tags' | 'note' | 'score'> | null {
  if (!d.verdict) return null;
  // Revision 2: the comparison row keeps the card it compared with.
  const raw = {
    ...d.score,
    ...(vsCard ? { vsCard } : {}),
    ...(waves?.length ? { waves } : {}),
    ...(d.suggested?.best !== undefined ? { bestSuggested: d.suggested.best } : {}),
    ...(d.suggested?.weakest !== undefined ? { weakestSuggested: d.suggested.weakest } : {}),
    rev: SCORECARD_REV,
  };
  const score = played !== undefined && !d.skipScore ? cleanScorecard(raw, played) : undefined;
  return { verdict: d.verdict, tags: [...d.tags], note: d.note.trim(), ...(score ? { score } : {}) };
}

// ---- The scorecard (data/scorecard.ts) ------------------------------------------
// The player's approval on the map-rebuild hub (2026-11-17): rate relative
// to the other maps, from what happened, not from memory. So the scorecard
// opens with the player's last scores, its wave rows show what happened in
// each wave (and, revision 4, how the player rated it on the draft), and
// one row compares this map with the map rated last.

/** One wave of the run on the scorecard's strip: the ships lost in it and
 *  the moments the game marked in it (sim/feedback.ts, `Watch`). */
export interface WaveStripEntry {
  n: number;
  lost: number;
  marks: MomentKind[];
  /** Game seconds the wave took (absent when not known). */
  sec?: number;
}

/** The strip's marks, in this order: a glyph and what it means. A sunk
 *  ship shows as the wave's "−n" (its mark only when no count is known). */
export const STRIP_MARKS: Record<MomentKind, { glyph: string; word: string }> = {
  debut: { glyph: '★', word: 'new threat' },
  burst: { glyph: '‼', word: 'ships lost in a burst' },
  carrier: { glyph: '◆', word: 'carrier hit' },
  dry: { glyph: '∅', word: 'out of ammo' },
  sunk: { glyph: '▼', word: 'ship sunk' },
};
const MARK_ORDER = Object.keys(STRIP_MARKS) as MomentKind[];

/** The strip for a run of `played` waves, from the game's wave records
 *  (`g.history`: its `lost` is the run's tally at the wave's end, so a
 *  wave's own is the difference from the wave before), the tally now (the
 *  wave still in play, `waveNow`, has no record yet) and the moments the
 *  run marked. */
export function waveStrip(history: readonly { wave: number; lost: number; t?: number }[], lostNow: number, waveNow: number, moments: readonly { wave: number; kind: MomentKind }[], played: number, tNow?: number): WaveStripEntry[] {
  return waveChips(played).map(({ n }) => {
    const rec = history.filter((h) => h.wave === n).at(-1);
    const end = rec ? rec.lost : n === waveNow ? lostNow : undefined;
    const before = history.filter((h) => h.wave < n).reduce((m, h) => Math.max(m, h.lost), 0);
    const kinds = new Set(moments.filter((m) => m.wave === n).map((m) => m.kind));
    // The wave's length: the game clock at its end (a record's `t`, or now
    // for the wave in play) less the clock at the end of the one before (the
    // clock stands still between waves).
    const t1 = rec?.t ?? (n === waveNow ? tNow : undefined);
    const t0 = history.filter((h) => h.wave < n && h.t !== undefined).reduce((m, h) => Math.max(m, h.t!), 0);
    const sec = t1 !== undefined && t1 > t0 ? Math.round((t1 - t0) * 10) / 10 : undefined;
    return { n, lost: end === undefined ? 0 : Math.max(0, end - before), marks: MARK_ORDER.filter((k) => kinds.has(k)), ...(sec !== undefined ? { sec } : {}) };
  });
}

/** A card's entries that carry a score, newest first (by `at`). */
function scoredEntries(p: LabProgress, id: string): LabEntry[] {
  return (p.results[id] ?? []).filter((e) => e.score && typeof e.at === 'string').sort((a, b) => b.at.localeCompare(a.at));
}

/** The map card to compare this run with: the other map card the player
 *  scored most recently (none: no comparison row). */
export function vsTarget(p: LabProgress, cardId: string): string | undefined {
  let best: { id: string; at: string } | undefined;
  for (const id of Object.keys(p.results)) {
    if (id === cardId || labCard(id)?.kind !== 'map') continue;
    const e = scoredEntries(p, id)[0];
    if (e && (!best || e.at > best.at)) best = { id, at: e.at };
  }
  return best?.id;
}

/** "today", "yesterday", "3 days ago", "2 weeks ago" (by local days). */
export function agoText(at: string, now = Date.now()): string {
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return '';
  const localDay = (ms: number) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);
  const days = localDay(now) - localDay(t);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return `${Math.floor(days / 7)} weeks ago`;
}

/** A score in a few words, any revision: "Fun 5 · Right · Again yes". */
export function shortScore(s: Scorecard): string {
  const word = (id: string) => {
    const c = scoreCategory(id);
    const v = (s as unknown as Record<string, number | string | undefined>)[id];
    return c && v !== undefined ? answerText(c, v) : undefined;
  };
  const diff = word('difficulty');
  const again = word('again');
  const parts = [s.fun !== undefined ? `Fun ${s.fun}` : '', diff ?? '', again ? `Again ${again.toLowerCase()}` : ''].filter(Boolean);
  if (!parts.length) {
    if (s.best !== undefined) parts.push(`Best ${waveLabel(s.best)}`);
    if (s.weakest !== undefined) parts.push(`Weakest ${waveLabel(s.weakest)}`);
  }
  return parts.join(' · ');
}

/** "Your last scores": this map card's latest score, then the latest of
 *  each other map card, newest first, four lines at most. */
export function lastScores(p: LabProgress, cardId: string, now = Date.now()): { id: string; name: string; mine: boolean; text: string; ago: string }[] {
  const line = (id: string, e: LabEntry, mine: boolean) => ({ id, name: labCard(id)?.name ?? id, mine, text: shortScore(e.score!), ago: agoText(e.at, now) });
  const mine = scoredEntries(p, cardId)[0];
  const others = Object.keys(p.results)
    .filter((id) => id !== cardId && labCard(id)?.kind === 'map')
    .map((id) => ({ id, e: scoredEntries(p, id)[0] }))
    .filter((o): o is { id: string; e: LabEntry } => !!o.e)
    .sort((a, b) => b.e.at.localeCompare(a.e.at));
  return [...(mine ? [line(cardId, mine, true)] : []), ...others.map((o) => line(o.id, o.e, false))].slice(0, 4);
}

/** What the scorecard shows beside its rows: the progress on the device
 *  (for the last scores), the card scored, the run's wave strip, the card
 *  to compare with, and the waves rated on the draft. */
export interface ScorecardContext {
  p?: LabProgress;
  cardId?: string;
  strip?: WaveStripEntry[];
  vsCard?: string;
  waves?: readonly WaveScore[];
}

/** One row of chips: a scorecard row's answers (`data-score-row`, each
 *  chip `data-score` and `data-value`), a tap to answer, again to clear. */
function chipRow(c: ScoreCategory, label: string, hint: string, opts: { v: number | string; label: string; w?: WaveStripEntry; rated?: WaveScore }[], answers: NonNullable<VerdictDraft['score']>, after: () => void): HTMLElement {
  const row = el('div', `v3-score-row ${c.scale.kind}`);
  row.dataset.scoreRow = c.id;
  const lab = el('div', 'v3-score-lab');
  lab.append(el('b', '', label), el('small', '', hint));
  const chips = el('div', `v3-score-chips ${c.scale.kind}`);
  chips.setAttribute('role', 'group');
  chips.setAttribute('aria-label', label);
  const btns = opts.map((o) => {
    const b = button(o.w || o.rated ? '' : o.label, c.scale.kind === 'stars' ? 'v3-score-chip v3-rating-n' : 'v3-score-chip', () => {
      if (answers[c.id] === o.v) delete answers[c.id];
      else answers[c.id] = o.v;
      mark();
      after();
    });
    if (o.w || o.rated) {
      // The wave, then what happened in it: "−2" ships lost and a mark for
      // each kind of moment the game marked in it; and how the player
      // rated it on the draft ("♥4": the fun; ★ is the strip's new-threat mark).
      const w = o.w;
      const marks = w ? w.marks.filter((k) => k !== 'sunk' || !w.lost) : [];
      const info = el('span', `v3-wave-info${w?.lost ? ' lost' : ''}`);
      if (w?.lost) info.append(el('em', '', `−${w.lost}`));
      if (marks.length) info.append(document.createTextNode(marks.map((k) => STRIP_MARKS[k].glyph).join('')));
      b.append(el('span', 'v3-wave-n', o.label), info);
      if (o.rated) {
        const r = el('span', 'v3-wave-rated', o.rated.fun !== undefined ? `♥${o.rated.fun}` : '✎');
        b.append(r);
        b.dataset.waveRating = waveScoreText(o.rated);
      }
      if (w) {
        b.dataset.lost = String(w.lost);
        b.dataset.marks = w.marks.join(' ');
      }
      const what = [...(w ? [w.lost ? `${w.lost} ship${w.lost === 1 ? '' : 's'} lost` : 'no ship lost', ...marks.map((k) => STRIP_MARKS[k].word)] : []), ...(o.rated ? [`you rated it ${waveScoreText(o.rated) || 'with a note'}`] : [])];
      b.setAttribute('aria-label', `Wave ${o.label}: ${what.join(', ')}`);
      b.title = `Wave ${o.label}: ${what.join(', ')}${o.rated?.note ? ` · “${o.rated.note}”` : ''}`;
    }
    b.dataset.score = c.id;
    b.dataset.value = String(o.v);
    // A tap here while typing leaves the text box its focus.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    return b;
  });
  const mark = () => btns.forEach((b, k) => {
    const on = answers[c.id] === opts[k].v;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  mark();
  chips.append(...btns);
  row.append(lab, chips);
  return row;
}

/** The scorecard (round 11; revision 4, data/scorecard.ts), as the rating
 *  rows of the review screen: the player's last scores on top, then one
 *  row per question (Fun, Difficulty, Intensity, the boss rounds, the
 *  comparison, Play again), a tap on a chip to answer (again to clear),
 *  every row optional, and Skip to fold it away (with `alsoHide`: the
 *  Best and Weakest rows under the timeline). */
export function scorecardEl(played: number, d: VerdictDraft, ctx: ScorecardContext = {}, alsoHide: HTMLElement[] = []): HTMLElement {
  const answers = (d.score ??= {});
  const box = el('section', 'v3-score');
  box.dataset.labScore = '1';
  box.setAttribute('aria-label', 'Scorecard');
  const head = el('div', 'v3-score-head');
  const title = el('span', 'v3-eyebrow');
  const skip = button('', 'v3-score-skip', () => {
    d.skipScore = !d.skipScore;
    paint();
  });
  skip.dataset.scoreSkip = '1';
  head.append(title, skip);
  const rows = el('div', 'v3-score-rows');
  // Your last scores: rate relative to them.
  const last = ctx.p && ctx.cardId ? lastScores(ctx.p, ctx.cardId) : [];
  if (last.length) {
    const panel = el('div', 'v3-score-last');
    panel.dataset.scoreLast = '1';
    const list = el('ul', '');
    for (const l of last) {
      const li = el('li', l.mine ? 'mine' : '');
      li.dataset.scoreLastCard = l.id;
      li.append(el('b', '', l.mine ? 'Last time' : l.name));
      if (l.text) li.append(document.createTextNode(` · ${l.text}`));
      if (l.ago) li.append(el('i', '', ` · ${l.ago}`));
      li.title = li.textContent ?? '';
      list.append(li);
    }
    panel.append(el('span', 'v3-score-last-h', 'Your last scores'), list);
    rows.append(panel);
  }
  const vsName = ctx.vsCard ? (labCard(ctx.vsCard)?.name ?? ctx.vsCard) : '';
  for (const c of scoreRows(played, { vsCard: ctx.vsCard })) {
    if (c.scale.kind === 'wave') continue;
    const label = c.id === 'vs' ? `Compared with ${vsName}` : c.label;
    // A 1-5 row says its ends, as the normal game's rows do.
    const hint = c.id === 'vs' ? 'this one was…' : c.scale.kind === 'stars' && c.low ? `1 ${c.low} · 5 ${c.high}` : c.help;
    const opts = c.scale.kind === 'choice' ? c.scale.options.map((o) => ({ v: o.id, label: o.label })) : [1, 2, 3, 4, 5].map((n) => ({ v: n, label: String(n) }));
    rows.append(chipRow(c, label, hint, opts, answers, () => {}));
  }
  const paint = () => {
    rows.hidden = !!d.skipScore;
    for (const e of alsoHide) e.hidden = !!d.skipScore;
    box.classList.toggle('skipped', !!d.skipScore);
    title.textContent = d.skipScore ? 'Scorecard skipped' : 'Scorecard · every row optional';
    skip.textContent = d.skipScore ? 'Show it' : 'Skip';
  };
  paint();
  box.append(head, rows);
  return box;
}

/** Best and Weakest wave (a map card's full run), picked under the run's
 *  timeline: each wave's chip says what happened in it and how the player
 *  rated it on the draft. With two or more waves rated for fun, the most
 *  and least fun are suggested (put in once; a tap changes them). A pick
 *  marks its wave's band on the timeline (▲ best, ▼ weakest). */
export function waveRowsEl(played: number, d: VerdictDraft, ctx: ScorecardContext = {}): HTMLElement {
  const answers = (d.score ??= {});
  const box = el('div', 'v3-score-waves');
  box.dataset.scoreWaves = '1';
  const strip = ctx.strip && ctx.strip.length >= played ? ctx.strip : undefined;
  const rated = new Map((ctx.waves ?? []).map((w) => [w.n, w]));
  const sync = () => {
    // The timeline's bands show the picks.
    const tl = box.closest('.v3-lab-verdict') ?? box.parentElement;
    for (const band of tl?.querySelectorAll<HTMLElement>('.v3-tl-wave[data-wave]') ?? []) {
      const n = Number(band.dataset.wave);
      band.querySelector('.v3-tl-pick')?.remove();
      const best = answers.best === n;
      const weak = answers.weakest === n;
      band.classList.toggle('best', best);
      band.classList.toggle('weakest', weak && !best);
      if (best || weak) band.append(el('i', 'v3-tl-pick', best ? '▲' : '▼'));
    }
    for (const id of ['best', 'weakest'] as const) {
      const note = box.querySelector<HTMLElement>(`[data-score-suggest="${id}"]`);
      if (note) note.hidden = d.suggested?.[id] === undefined || answers[id] !== d.suggested[id];
    }
  };
  for (const c of scoreRows(played)) {
    if (c.scale.kind !== 'wave') continue;
    const opts = waveChips(played).map((w) => ({ v: w.n, label: w.label, w: strip?.[w.n - 1], rated: rated.get(w.n) }));
    const row = chipRow(c, c.label, c.help, opts, answers, sync);
    row.classList.add('strip');
    const sug = d.suggested?.[c.id as 'best' | 'weakest'];
    if (sug !== undefined) {
      const note = el('small', 'v3-score-suggest', `Suggested from your wave ratings (♥${rated.get(sug)?.fun ?? '?'}): tap to change`);
      note.dataset.scoreSuggest = c.id;
      row.querySelector('.v3-score-lab')?.append(note);
    }
    box.append(row);
  }
  if (strip) {
    // What the chips' marks mean (only those shown).
    const shown = new Set(strip.flatMap((w) => w.marks.filter((k) => k !== 'sunk' || !w.lost)));
    const key = [strip.some((w) => w.lost) ? '−n ships lost' : '', ...MARK_ORDER.filter((k) => shown.has(k)).map((k) => `${STRIP_MARKS[k].glyph} ${STRIP_MARKS[k].word}`), rated.size ? '♥n your fun rating on the draft' : ''].filter(Boolean);
    if (key.length) {
      const legend = el('p', 'v3-score-legend', key.join(' · '));
      legend.dataset.scoreLegend = '1';
      box.append(legend);
    }
  }
  // Once in the page (the bands exist then).
  queueMicrotask(sync);
  return box;
}

/** The run on the review screen (app.ts builds its parts: the timeline,
 *  its legend, the selected moment with Watch it and Note on this), and
 *  the waves the player rated on the draft. */
export interface VerdictReview {
  run: HTMLElement[];
  waves?: readonly WaveScore[];
}

/** The verdict sheet: the normal game's "Rate & review this run" with a
 *  Test Lab section (scorecard revision 4). Round 4's logs: seven cards
 *  saved with a note and no verdict. While the player typed, the Keep /
 *  Tune / Cut row was folded away with the rest of the sheet, and Save
 *  (all that was left) saved a null verdict. The row now stays while
 *  typing, and Save with no verdict asks for one. A map card's full run
 *  passes its waves' `strip`: what happened in each, for Best and Weakest
 *  wave. */
export function labVerdictSheet(card: LabCard, s: LabStats, waves: number, ended: LabResult['ended'], p: LabProgress, next: LabCard | undefined, h: VerdictHandlers, draft?: VerdictDraft, plays?: LabPlays, played?: number, strip?: WaveStripEntry[], review?: VerdictReview): HTMLElement {
  const sheet = el('div', 'v3-lab-sheet v3-lab-verdict v3-review-merged');
  const how = ended === 'lost' ? 'the convoy was lost' : plays === 'full' && ended === 'length' ? 'map cleared' : ended === 'length' ? 'test run to its length' : `stopped with Done · ${waves} wave${waves === 1 ? '' : 's'} cleared`;
  const head = el('div', 'v3-review-title');
  head.append(el('h2', '', 'Rate & review this run'), el('p', 'v2-sub', `${card.name} · ${how}`));
  sheet.append(head);
  const older = olderEntries(p, card.id);
  const what = changedSince(p, card.id);
  if (what.length) {
    const ch = el('div', 'v3-lab-changes');
    ch.append(el('span', 'v3-eyebrow', `Changed since your round ${older[0].round} test`));
    for (const w of what) ch.append(el('p', '', w));
    sheet.append(ch);
  }
  const d = draft ?? newVerdictDraft(p, card.id);
  const rated = review?.waves ?? [];
  // A map card's full run (round 11): the scorecard, as the rating rows.
  const scored = card.kind === 'map' && plays === 'full' && played !== undefined ? played : undefined;
  // Its comparison row: the other map card scored most recently.
  const vsCard = scored !== undefined ? vsTarget(p, card.id) : undefined;
  const ctx: ScorecardContext = { p, cardId: card.id, strip, vsCard, waves: rated };
  if (scored !== undefined) prefillWaves(d, rated);
  const waveRows = scored !== undefined ? waveRowsEl(scored, d, ctx) : null;
  if (scored !== undefined) sheet.append(scorecardEl(scored, d, ctx, waveRows ? [waveRows] : []));
  else {
    // Any other card: the normal game's three rows (the log's rating).
    const rate = el('section', 'v3-score v3-lab-rating');
    rate.dataset.labRating = '1';
    const rows = ratingRows(d.rating ?? {});
    // The rows keep their own state; the draft follows each tap.
    rows.el.addEventListener('click', () => (d.rating = rows.value()));
    const eyebrow = el('div', 'v3-score-head');
    eyebrow.append(el('span', 'v3-eyebrow', 'Rate this run · optional'));
    rate.append(eyebrow, rows.el);
    sheet.append(rate);
  }
  // The run: its timeline, the selected moment, and Best and Weakest wave.
  if (review?.run.length || waveRows) {
    const run = el('section', 'v3-review-run');
    run.dataset.reviewRun = '1';
    run.append(el('span', 'v3-eyebrow', rated.length ? `The run · ${rated.length} wave${rated.length === 1 ? '' : 's'} rated on the draft` : 'The run'), ...(review?.run ?? []), ...(waveRows ? [waveRows] : []));
    sheet.append(run);
  }
  // The Test Lab's own section: the verdict, the tags, the note.
  const labSec = el('section', 'v3-lab-section');
  labSec.dataset.labSection = '1';
  labSec.append(el('span', 'v3-eyebrow v3-lab-section-h', 'Test Lab · your verdict'));
  const cols = el('div', 'v3-lab-cols');
  const left = el('div', 'v3-lab-col');
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
  note.placeholder = 'A note on the run: what did you notice? (the microphone key on the keyboard dictates)';
  note.value = d.note;
  note.addEventListener('input', () => (d.note = note.value));
  // Keys typed here are the note's, not the game's.
  note.addEventListener('keydown', (e) => e.stopPropagation());
  left.append(vwrap, trow, note);
  const right = el('div', 'v3-lab-col v3-lab-evidence');
  right.append(el('span', 'v3-eyebrow', 'Counted this test'));
  for (const line of evidenceLines(card, s, waves, plays)) right.append(el('p', '', line));
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
  labSec.append(cols);
  const acts = el('div', 'v3-lab-sheet-acts');
  // No verdict yet: ask for one rather than save a blank (the note and the
  // tags stay as they are).
  const save = (then: 'next' | 'again' | 'list') => {
    d.note = note.value;
    const r = verdictResult(d, scored, vsCard, rated);
    if (!r) {
      // The keyboard goes, so the whole sheet (the row, and why) is back.
      note.blur();
      need.hidden = false;
      vrow.classList.remove('need');
      void vrow.offsetWidth;
      vrow.classList.add('need');
      // Under the scorecard and the run the row can be scrolled out of sight.
      vwrap.scrollIntoView?.({ block: 'nearest' });
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
  sheet.append(labSec, acts);
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
    item.append(el('p', 'v3-lab-rstats', evidenceLines(card, r.stats, r.waves, r.plays).join(' · ')));
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
