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
// Revision 2 (the player's approval on the map-rebuild hub, 2026-11-17):
// rate relative to the other maps, not from memory. The sheet shows the
// player's last scores (this map's and the other maps'), the run's waves as
// a strip with what happened in each, and one comparison row, "Compared
// with <the map you rated last>: worse / about the same / better" (`vs`,
// with that card's id in `vsCard`). Fewer rows: Pacing and Readability went
// (always "Right" and 5), and Variety and Map feel with them. Those four
// stay defined here, marked `retired: 2`, so a revision 1 score still
// validates, reads (`scoreLine`) and averages under revision 1; they are
// never asked again. The score rides in `labResult.score` as before and
// never touches replay, so the log version is unchanged.
//
// Revision 3 (the fun measures, docs/design/v3-fun-metrics.md): one more
// row, "Best moment": one tap on the wave strip, where in the chip saying
// when in the wave (its left edge the wave's start, its right edge its
// end). It saves the wave (`moment`) and, when the strip knows the wave's
// length, the seconds into it (`momentT`). It is the ground truth the
// saves and the tension curve are checked against: do they find the
// moments the player liked? It asks nothing new of the other rows, but a
// row added is a revision (below), so revision 3 scores average apart.
//
// Revision 4 (docs/design/v3-rate-and-review.md; the player's notes of
// 2026-11-19): the scorecard joins the normal game's "Rate & review this
// run" screen. One row more, Intensity (1 calm, 5 frantic, the normal
// game's third axis: `intensity`, `since: 4`), and Best moment goes
// (`retired: 4`): "it is still hard to recall what happened so not a great
// stat". In its place the player can rate each wave on the weapon draft
// straight after it (the log's `waveRatings`); the score keeps them as
// `waves` (one entry a rated wave), and the end screen suggests Best and
// Weakest wave from them (`bestSuggested`, `weakestSuggested`: what was
// suggested, so the tools can tell a pick from an accepted suggestion).
//
// Effort (round 11; the player: "add in a rating for me to rate how hard I
// tried, so we know if it was a fluke or if it truly is hard"): one row
// more, 1 casual / not really trying to 5 full focus, all-out (`effort`).
// It asks something new and changes no other row's question, so it joins
// revision 4 (`since: 4`) instead of starting revision 5: the page keeps
// averaging this round's scores with the earlier revision 4 ones, and a
// revision 4 score without it reads as Effort left blank. The bot fit
// reads it (sim/feedback.ts runEffort) to weigh low-effort runs less.
//
// Change a category's meaning or drop one: bump SCORECARD_REV, so the page
// never averages answers to two different questions together. A row added
// may start a revision too (revision 3 did), unless, like Effort, the old
// rows keep their meaning.

import { EVENT_WAVE } from './events';

/** The scorecard's revision: in every saved score (`score.rev`). */
export const SCORECARD_REV = 4;

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

export type ScoreId = 'fun' | 'difficulty' | 'intensity' | 'effort' | 'pacing' | 'variety' | 'readability' | 'mapFeel' | 'boss' | 'vs' | 'again' | 'best' | 'weakest' | 'moment';

export interface ScoreCategory {
  id: ScoreId;
  /** The row's name, short: it sits beside its chips on a phone. */
  label: string;
  /** What the row asks, in the player's words. */
  help: string;
  scale: ScoreScale;
  /** Shown only on a run that reached the boss rounds (wave 11+). */
  boss?: boolean;
  /** The scorecard revision that stopped asking it. Kept so an older
   *  score still validates, reads and averages under its own revision. */
  retired?: number;
  /** The scorecard revision that first asked it. */
  since?: number;
  /** Asked only when another map card has been rated to compare with. */
  compare?: boolean;
  /** A 1-5 row's ends in words ("a chore", "a blast"), as the normal
   *  game's rating rows show them. */
  low?: string;
  high?: string;
}

const STARS: ScoreScale = { kind: 'stars' };

/** Every category ever asked, in the sheet's order (the retired ones where
 *  they stood, so a revision 1 score reads as it did). */
export const SCORECARD: ScoreCategory[] = [
  { id: 'fun', label: 'Fun', help: 'How much fun was this run?', scale: STARS, low: 'a chore', high: 'a blast' },
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
  // Revision 4: the normal game's third axis.
  { id: 'intensity', label: 'Intensity', help: 'How frantic was it?', scale: STARS, since: 4, low: 'calm', high: 'frantic' },
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
    retired: 2,
  },
  { id: 'variety', label: 'Variety', help: 'The waves felt different from each other', scale: STARS, retired: 2 },
  { id: 'readability', label: 'Readability', help: 'I could tell what was coming and what hit me', scale: STARS, retired: 2 },
  { id: 'mapFeel', label: 'Map feel', help: 'The layout mattered to how I played', scale: STARS, retired: 2 },
  { id: 'boss', label: 'Boss rounds', help: 'How were waves 11 to 13?', scale: STARS, boss: true, low: 'dull', high: 'great' },
  {
    id: 'vs',
    // The sheet names the map: "Compared with The Gauntlet".
    label: 'Vs last map',
    help: 'Compared with the map you rated last, this one was',
    scale: {
      kind: 'choice',
      options: [
        { id: 'worse', label: 'Worse', value: -1 },
        { id: 'same', label: 'About the same', value: 0 },
        { id: 'better', label: 'Better', value: 1 },
      ],
    },
    compare: true,
  },
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
  // Round 11: how hard the player tried (asked from revision 4 on; see the
  // header).
  { id: 'effort', label: 'Effort', help: 'How hard did you try?', scale: STARS, since: 4, low: 'casual / not really trying', high: 'full focus, all-out' },
  { id: 'best', label: 'Best wave', help: 'The wave you liked most', scale: { kind: 'wave' } },
  { id: 'weakest', label: 'Weakest wave', help: 'The wave you liked least', scale: { kind: 'wave' } },
  // Revision 3: one tap, the wave and where in it (`momentT`). Retired by
  // revision 4: the per-wave ratings took its place.
  { id: 'moment', label: 'Best moment', help: 'Tap your best moment: left of a wave is its start, right its end', scale: { kind: 'wave' }, since: 3, retired: 4 },
];

/** A saved scorecard: its revision and the rows answered (a row left
 *  alone is absent). Stars are 1-5, a choice is its option id, a wave is
 *  its number (11-13 are the boss rounds). Pacing, Variety, Readability
 *  and Map feel are revision 1 only. */
export interface Scorecard {
  rev: number;
  fun?: number;
  difficulty?: string;
  pacing?: string;
  variety?: number;
  readability?: number;
  mapFeel?: number;
  boss?: number;
  /** Revision 2: compared with the map card rated last (`vsCard`, its
   *  id): 'worse', 'same' or 'better'. */
  vs?: string;
  vsCard?: string;
  again?: string;
  best?: number;
  weakest?: number;
  /** Revision 3: the best moment's wave, and its seconds into the wave
   *  (game seconds, when the strip knew the wave's length). */
  moment?: number;
  momentT?: number;
  /** Revision 4: 1 calm to 5 frantic. */
  intensity?: number;
  /** Revision 4 (round 11): how hard the player tried, 1 casual / not
   *  really trying to 5 full focus, all-out. */
  effort?: number;
  /** Revision 4: the waves rated on the draft (the log's `waveRatings`),
   *  in wave order. */
  waves?: WaveScore[];
  /** Revision 4: the Best and Weakest wave the screen suggested from
   *  `waves` (absent: none suggested). `best` and `weakest` are what was
   *  saved: the suggestion kept, or the player's own pick. */
  bestSuggested?: number;
  weakestSuggested?: number;
}

/** One wave's rating on the draft, in a score: the wave, the 1-5 axes
 *  given and the note, if any. */
export interface WaveScore {
  n: number;
  difficulty?: number;
  fun?: number;
  intensity?: number;
  note?: string;
}

const AXES = ['difficulty', 'fun', 'intensity'] as const;

/** Per-wave ratings (the log's `waveRatings`, or a score's `waves`) as a
 *  score's `waves`: valid ones only, one a wave (the last given), in wave
 *  order, waves past the run dropped. */
export function waveScores(raw: unknown, played?: number): WaveScore[] {
  if (!Array.isArray(raw)) return [];
  const by = new Map<number, WaveScore>();
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const n = typeof o.n === 'number' ? o.n : o.wave;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || (played !== undefined && n > played)) continue;
    const src = (o.rating && typeof o.rating === 'object' ? o.rating : o) as Record<string, unknown>;
    const w: WaveScore = { n };
    for (const k of AXES) {
      const v = src[k];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) w[k] = v;
    }
    if (typeof o.note === 'string' && o.note.trim()) w.note = o.note.trim().slice(0, 280);
    if (Object.keys(w).length > 1) by.set(n, w);
  }
  return [...by.values()].sort((a, b) => a.n - b.n);
}

/** Best and Weakest wave suggested by the per-wave ratings: the most fun
 *  wave (a tie: the more intense, then the later) and the least (a tie:
 *  the less intense, then the earlier). Needs two waves rated for fun
 *  that differ; else nothing is suggested. */
export function suggestWaves(waves: readonly WaveScore[]): { best?: number; weakest?: number } {
  const rated = waves.filter((w) => w.fun !== undefined);
  if (rated.length < 2) return {};
  const key = (w: WaveScore) => [w.fun!, w.intensity ?? 3, w.n];
  const cmp = (a: WaveScore, b: WaveScore) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
    return 0;
  };
  const sorted = [...rated].sort(cmp);
  const lo = sorted[0];
  const hi = sorted[sorted.length - 1];
  if (lo.fun === hi.fun) return {};
  return { best: hi.n, weakest: lo.n };
}

/** A wave's rating in a few characters: "F4 D2 I5" (the axes given). */
export function waveScoreText(w: WaveScore): string {
  return [w.fun !== undefined ? `F${w.fun}` : '', w.difficulty !== undefined ? `D${w.difficulty}` : '', w.intensity !== undefined ? `I${w.intensity}` : ''].filter(Boolean).join(' ');
}

export function scoreCategory(id: string): ScoreCategory | undefined {
  return SCORECARD.find((c) => c.id === id);
}

/** Did a run of this many waves reach the boss rounds? */
export function reachedBoss(played: number): boolean {
  return played >= EVENT_WAVE;
}

/** Was the category asked on a score of this revision? */
export function askedAt(c: ScoreCategory, rev: number): boolean {
  return (c.retired === undefined || rev < c.retired) && (c.since === undefined || rev >= c.since);
}

/** The rows a run asks now: no retired row, the boss row only once the
 *  boss rounds were reached, and the comparison only with another map
 *  card to compare with (`opts.vsCard`). */
export function scoreRows(played: number, opts: { vsCard?: string } = {}): ScoreCategory[] {
  return SCORECARD.filter((c) => askedAt(c, SCORECARD_REV) && (!c.boss || reachedBoss(played)) && (!c.compare || !!opts.vsCard));
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
 *  only valid answers are kept, on any category its revision asked (a
 *  revision 1 score keeps Pacing and the other rows revision 2 retired),
 *  the boss row only on a run that reached the boss rounds, and `vsCard`
 *  only beside a valid `vs`. Nothing answered: undefined (no score is
 *  saved). */
export function cleanScorecard(raw: unknown, played?: number): Scorecard | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const out: Scorecard = { rev: typeof r.rev === 'number' ? r.rev : SCORECARD_REV };
  let any = false;
  for (const c of SCORECARD) {
    if (!askedAt(c, out.rev)) continue;
    if (c.boss && played !== undefined && !reachedBoss(played)) continue;
    const v = r[c.id];
    if (!validAnswer(c, v, played)) continue;
    (out as unknown as Record<string, unknown>)[c.id] = v;
    any = true;
    if (c.id === 'vs' && typeof r.vsCard === 'string' && r.vsCard) out.vsCard = r.vsCard;
    if (c.id === 'moment' && typeof r.momentT === 'number' && Number.isFinite(r.momentT) && r.momentT >= 0) out.momentT = Math.round(r.momentT * 10) / 10;
  }
  // Revision 4: the per-wave ratings, and what the screen suggested.
  if (out.rev >= 4) {
    const waves = waveScores(r.waves, played);
    if (waves.length) {
      out.waves = waves;
      any = true;
    }
    const best = scoreCategory('best')!;
    for (const k of ['bestSuggested', 'weakestSuggested'] as const) if (validAnswer(best, r[k], played)) out[k] = r[k] as number;
  }
  return any ? out : undefined;
}

/** A score's answers in a line: "Fun 4 · Difficulty Bit hard · Best 7";
 *  the comparison names its card: "Vs map-gauntlet Better". */
export function scoreLine(s: Scorecard | undefined): string {
  if (!s) return '';
  const parts: string[] = [];
  for (const c of SCORECARD) {
    const v = (s as unknown as Record<string, unknown>)[c.id];
    if (v === undefined) continue;
    const label = c.id === 'vs' && s.vsCard ? `Vs ${s.vsCard}` : c.label.replace(/\?$/, '');
    parts.push(`${label} ${answerText(c, v as number | string)}${c.id === 'moment' && s.momentT !== undefined ? ` at ${Math.round(s.momentT)} s` : ''}`);
  }
  if (s.waves?.length) parts.push(`Waves ${s.waves.map((w) => `${waveLabel(w.n)}:${waveScoreText(w) || 'note'}`).join(' ')}`);
  return parts.join(' · ');
}
