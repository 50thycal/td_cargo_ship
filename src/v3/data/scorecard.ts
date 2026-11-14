// The map scorecard (Test Lab round 11, docs/design/v3-test-lab.md
// "Scorecard"; docs/design/v3-round11-map-notes.md, part C). The player:
// "improve the rating and feedback system at the end of the game. It should
// have categories to rank ... to determine if this production map is good",
// and next "make a few different versions of the same maps with different
// encounters and see which ones do the best". So after a map card's full run
// the verdict sheet asks the same short set of questions every time, one
// tap per row, every row optional; the answers go in the run's log
// (`labResult.score`) and the review page averages them per map and per
// encounter version (`variant`).
//
// Change a category's meaning, add one or drop one: bump SCORECARD_REV, so
// the page never averages answers to two different questions together.

import { EVENT_WAVE } from './events';

/** The scorecard's revision: in every saved score (`score.rev`). */
export const SCORECARD_REV = 1;

/** A map card's encounter version when nothing says otherwise. Next
 *  round's A/B/C versions of one map get their own ids (v2, v3 ...). */
export const MAP_VARIANT_DEFAULT = 'v1';

/** One answer on a choice row. `value` is what the page averages: the
 *  middle of a too-little / too-much scale is 0. */
export interface ScoreOption {
  id: string;
  label: string;
  value: number;
}

export type ScoreScale =
  /** 1 (worst) to 5 (best). */
  | { kind: 'stars' }
  /** One of a few labelled answers, in order. */
  | { kind: 'choice'; options: ScoreOption[] }
  /** One wave of the run (1 to the last wave played; the boss rounds are
   *  B1 to B3). */
  | { kind: 'wave' };

export type ScoreId = 'fun' | 'difficulty' | 'pacing' | 'variety' | 'readability' | 'mapFeel' | 'boss' | 'best' | 'weakest' | 'again';

export interface ScoreCategory {
  id: ScoreId;
  /** The row's name, short: it sits beside its chips on a phone. */
  label: string;
  /** What the row asks, in the player's words. */
  help: string;
  scale: ScoreScale;
  /** Shown only on a run that reached the boss rounds (wave 11+). */
  boss?: boolean;
}

const STARS: ScoreScale = { kind: 'stars' };

export const SCORECARD: ScoreCategory[] = [
  { id: 'fun', label: 'Fun', help: 'How much fun was this run?', scale: STARS },
  {
    id: 'difficulty',
    label: 'Difficulty',
    help: 'How hard was it?',
    scale: {
      kind: 'choice',
      options: [
        { id: 'too-easy', label: 'Too easy', value: -2 },
        { id: 'bit-easy', label: 'Bit easy', value: -1 },
        { id: 'right', label: 'Right', value: 0 },
        { id: 'bit-hard', label: 'Bit hard', value: 1 },
        { id: 'too-hard', label: 'Too hard', value: 2 },
      ],
    },
  },
  {
    id: 'pacing',
    label: 'Pacing',
    help: 'How fast did the run move?',
    scale: {
      kind: 'choice',
      options: [
        { id: 'too-slow', label: 'Too slow', value: -1 },
        { id: 'right', label: 'Right', value: 0 },
        { id: 'too-fast', label: 'Too fast', value: 1 },
      ],
    },
  },
  { id: 'variety', label: 'Variety', help: 'The waves felt different from each other', scale: STARS },
  { id: 'readability', label: 'Readability', help: 'I could tell what was coming and what hit me', scale: STARS },
  { id: 'mapFeel', label: 'Map feel', help: 'The layout mattered to how I played', scale: STARS },
  { id: 'boss', label: 'Boss rounds', help: 'How were waves 11 to 13?', scale: STARS, boss: true },
  { id: 'best', label: 'Best wave', help: 'The wave you liked most', scale: { kind: 'wave' } },
  { id: 'weakest', label: 'Weakest wave', help: 'The wave you liked least', scale: { kind: 'wave' } },
  {
    id: 'again',
    label: 'Play again?',
    help: 'Would you play this map again?',
    scale: {
      kind: 'choice',
      options: [
        { id: 'yes', label: 'Yes', value: 1 },
        { id: 'maybe', label: 'Maybe', value: 0.5 },
        { id: 'no', label: 'No', value: 0 },
      ],
    },
  },
];

/** A saved scorecard: its revision and the rows answered (a row left
 *  alone is absent). Stars are 1-5, a choice is its option id, a wave is
 *  its number (11-13 are the boss rounds). */
export interface Scorecard {
  rev: number;
  fun?: number;
  difficulty?: string;
  pacing?: string;
  variety?: number;
  readability?: number;
  mapFeel?: number;
  boss?: number;
  best?: number;
  weakest?: number;
  again?: string;
}

export function scoreCategory(id: string): ScoreCategory | undefined {
  return SCORECARD.find((c) => c.id === id);
}

/** Did a run of this many waves reach the boss rounds? */
export function reachedBoss(played: number): boolean {
  return played >= EVENT_WAVE;
}

/** The rows a run asks: the boss row only once the boss rounds were
 *  reached. */
export function scoreRows(played: number): ScoreCategory[] {
  return SCORECARD.filter((c) => !c.boss || reachedBoss(played));
}

/** A wave's chip: "7", or "B2" for the second boss round. */
export function waveLabel(n: number): string {
  return n >= EVENT_WAVE ? `B${n - EVENT_WAVE + 1}` : String(n);
}

/** The wave chips for a run that played `played` waves (1 to N). */
export function waveChips(played: number): { n: number; label: string }[] {
  return Array.from({ length: Math.max(0, played) }, (_, i) => ({ n: i + 1, label: waveLabel(i + 1) }));
}

/** An answer in words: "4", "Bit hard", "B2". */
export function answerText(c: ScoreCategory, v: number | string): string {
  if (c.scale.kind === 'choice') return c.scale.options.find((o) => o.id === v)?.label ?? String(v);
  if (c.scale.kind === 'wave') return typeof v === 'number' ? waveLabel(v) : String(v);
  return String(v);
}

/** Is `v` a valid answer on this row (for a run of `played` waves, when
 *  known)? */
export function validAnswer(c: ScoreCategory, v: unknown, played?: number): boolean {
  if (c.scale.kind === 'choice') return typeof v === 'string' && c.scale.options.some((o) => o.id === v);
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return false;
  if (c.scale.kind === 'stars') return v <= 5;
  return played === undefined || v <= played;
}

/** A scorecard from anything (a draft on the sheet, a log, the store):
 *  only valid answers are kept, the boss row only on a run that reached
 *  the boss rounds. Nothing answered: undefined (no score is saved). */
export function cleanScorecard(raw: unknown, played?: number): Scorecard | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: Scorecard = { rev: typeof r.rev === 'number' ? r.rev : SCORECARD_REV };
  let any = false;
  const rows = played === undefined ? SCORECARD : scoreRows(played);
  for (const c of rows) {
    const v = r[c.id];
    if (!validAnswer(c, v, played)) continue;
    (out as unknown as Record<string, unknown>)[c.id] = v;
    any = true;
  }
  return any ? out : undefined;
}

/** A score's answers in a line: "Fun 4 · Difficulty Bit hard · Best 7". */
export function scoreLine(s: Scorecard | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  for (const c of SCORECARD) {
    const v = (s as unknown as Record<string, unknown>)[c.id];
    if (v === undefined) continue;
    parts.push(`${c.label.replace(/\?$/, '')} ${answerText(c, v as number | string)}`);
  }
  return parts.join(' · ');
}
