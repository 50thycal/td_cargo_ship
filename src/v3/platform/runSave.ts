// The run in progress (docs/design/v3-resume-run.md). The player: "Do we
// have a way to save when you leave mid game, so I can come back and finish
// it?" One slot: the run's log so far (every input, stamped with its step),
// the step it was saved at, a fingerprint of the game there, the build and
// log version, and what the screens need to put it back (campaign, Free Play
// or a Test Lab card, and its setup). Continuing replays the log to that
// step (sim/resume.ts) and checks the fingerprint.
//
// One small versioned record in the game's storage (platform/store.ts), like
// platform/seen.ts. Storage can be missing or throw (private mode): then
// nothing is saved, `loadRun` is null, and the menu has no Continue.

import { replaysHere, type PlayLog, type Recorder, type WaveMark } from '../sim/playlog';
import { runPrint, type RunPrint } from '../sim/resume';
import { kv } from './store';

/** Where the record lives. */
export const RUN_KEY = 'straitwatch.v3.run';
/** The record's version. 1: `RunSave` below. */
export const RUN_SAVE_VERSION = 1;

/** What kind of run it is, for the screens (the log has the rest). */
export type RunKind = 'campaign' | 'free' | 'lab';

export interface RunSave<UI = unknown> {
  v: number;
  savedAt: string;
  /** The build it was saved on, and its log version (the log's own `v`). */
  build: string;
  logVersion: number;
  /** The run's log so far: no `end` (a background's sealed copy went to the
   *  log store; this one goes on). */
  log: PlayLog;
  /** The step it was saved at and the inputs up to it. */
  step: number;
  commands: number;
  phase: 'wave' | 'draft';
  /** The game at `step`, to check the replay against. */
  print: RunPrint;
  /** Where the wave in play began (the dev wave retry). */
  mark: WaveMark;
  kind: RunKind;
  /** The screens' own setup: Free Play's form, a lab card and its setup. */
  ui: UI;
  /** For the Continue button: what it is, and how far it got. */
  title: string;
  wave: number;
  score: number;
}

/** The record for a recorder's run as it stands: null unless it is mid-wave
 *  or in a draft (a run that has ended has nothing to continue). */
export function makeRunSave<UI>(rec: Recorder, o: { kind: RunKind; ui: UI; title: string; build: string; savedAt?: string }): RunSave<UI> | null {
  const g = rec.game;
  if (g.phase !== 'wave' && g.phase !== 'draft') return null;
  const log = rec.snapshot();
  return {
    v: RUN_SAVE_VERSION,
    savedAt: o.savedAt ?? new Date().toISOString(),
    build: o.build,
    logVersion: log.v,
    log,
    step: g.steps,
    commands: log.commands.length,
    phase: g.phase,
    print: runPrint(g),
    mark: { ...rec.mark },
    kind: o.kind,
    ui: o.ui,
    title: o.title,
    wave: g.wave,
    score: g.score,
  };
}

/** Can this build continue it? Its log version must replay here exactly,
 *  and the record must be one this build reads. (The fingerprint is checked
 *  after the replay: a build that kept the version but changed the game.) */
export function canContinue(r: RunSave): boolean {
  return r.v === RUN_SAVE_VERSION && replaysHere(r.logVersion) && replaysHere(r.log.v);
}

function valid(r: unknown): r is RunSave {
  const x = r as Partial<RunSave> | null;
  return (
    !!x &&
    typeof x === 'object' &&
    typeof x.v === 'number' &&
    typeof x.step === 'number' &&
    typeof x.commands === 'number' &&
    typeof x.logVersion === 'number' &&
    (x.kind === 'campaign' || x.kind === 'free' || x.kind === 'lab') &&
    !!x.log &&
    typeof x.log.id === 'string' &&
    Array.isArray(x.log.commands) &&
    !!x.print &&
    typeof x.print.hash === 'string'
  );
}

/** The saved run, or null (none, unreadable, or no storage). A record from
 *  an older build is still returned: the menu says it can't be continued
 *  and offers its map again. */
export function loadRun<UI = unknown>(): RunSave<UI> | null {
  try {
    const raw = kv.getItem(RUN_KEY);
    if (raw === null) return null;
    const r = JSON.parse(raw) as unknown;
    return valid(r) ? (r as RunSave<UI>) : null;
  } catch {
    return null;
  }
}

/** Keep this run (over any other). False when storage is missing or full:
 *  the run then can't be continued, and nothing else breaks. */
export function saveRun(r: RunSave): boolean {
  try {
    kv.setItem(RUN_KEY, JSON.stringify(r));
    return true;
  } catch {
    return false;
  }
}

/** Forget the saved run: the run ended, was abandoned, or a new one began.
 *  With `id`, only if the saved run is that one. */
export function clearRun(id?: string): void {
  try {
    if (id !== undefined) {
      const r = loadRun();
      if (r && r.log.id !== id) return;
    }
    kv.removeItem(RUN_KEY);
  } catch {
    // nothing stored to clear
  }
}

/** Does this device keep anything? (No storage: no Save and quit either.) */
export function canSaveRuns(): boolean {
  try {
    kv.getItem(RUN_KEY);
    return true;
  } catch {
    return false;
  }
}

/** "3 min ago", "2 h ago", "yesterday", "4 days ago". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (!Number.isFinite(s)) return '';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
