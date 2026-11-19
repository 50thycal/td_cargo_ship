// The combo sweep's numbers (docs/design/v3-combo-sweep.md): a config's runs
// summed up, and the synergy math. Pure: the unit test checks it on toy
// cases.

import { BOSS_FROM, WAVES, normalOf, type ComboRun } from './play';

export interface Summary {
  /** Runs. */
  n: number;
  /** Under the normal loss limit: share won, mean end wave (14 = won). */
  won: number;
  endWave: number;
  /** Won without losing a ship. */
  flawless: number;
  /** Every wave played (tough): ships lost in waves 1-10, a boss round
   *  (the mean of the three), and in all 13. */
  lost10: number;
  boss: number;
  lostAll: number;
  /** Normal loss limit: ships lost a boss round, over the rounds reached. */
  bossNormal: number | null;
  bossReached: number;
  /** Tension (when read), over the waves the normal run reached: mean
   *  peak, share of time hot, share of waves with a sawtooth shape. */
  tension?: { peak: number; hot: number; calm: number; sawtooth: number; flat: number };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

export function summarize(runs: ComboRun[]): Summary {
  const normals = runs.map((r) => normalOf(r.lost));
  const bossN: number[] = [];
  for (const nr of normals) for (let w = BOSS_FROM; w <= Math.min(WAVES, nr.endWave); w++) bossN.push(nr.lost[w - 1]);
  const s: Summary = {
    n: runs.length,
    won: mean(normals.map((x) => (x.won ? 1 : 0))),
    endWave: mean(normals.map((x) => x.endWave)),
    flawless: mean(runs.map((r) => (sum(r.lost) === 0 ? 1 : 0))),
    lost10: mean(runs.map((r) => sum(r.lost.slice(0, BOSS_FROM - 1)))),
    boss: mean(runs.map((r) => sum(r.lost.slice(BOSS_FROM - 1)) / (WAVES - BOSS_FROM + 1))),
    lostAll: mean(runs.map((r) => sum(r.lost))),
    bossNormal: bossN.length ? mean(bossN) : null,
    bossReached: bossN.length / Math.max(1, runs.length),
  };
  const waves: { peak: number; hot: number; calm: number; shape: string }[] = [];
  runs.forEach((r, k) => {
    if (!r.tension) return;
    const end = Math.min(WAVES, normals[k].endWave);
    for (let w = 1; w <= end; w++) {
      const t = r.tension[w - 1];
      if (t) waves.push(t);
    }
  });
  if (waves.length)
    s.tension = {
      peak: mean(waves.map((w) => w.peak)),
      hot: mean(waves.map((w) => w.hot)),
      calm: mean(waves.map((w) => w.calm)),
      sawtooth: mean(waves.map((w) => (w.shape === 'sawtooth' || w.shape === 'rising' ? 1 : 0))),
      flat: mean(waves.map((w) => (w.shape === 'flat' ? 1 : 0))),
    };
  return s;
}

/** Means of several maps' summaries (each map weighs the same). */
export function overall(per: Summary[]): Summary {
  const m = (f: (s: Summary) => number | null | undefined) => mean(per.map(f).filter((v): v is number => typeof v === 'number' && Number.isFinite(v)));
  const out: Summary = {
    n: per.reduce((a, s) => a + s.n, 0),
    won: m((s) => s.won),
    endWave: m((s) => s.endWave),
    flawless: m((s) => s.flawless),
    lost10: m((s) => s.lost10),
    boss: m((s) => s.boss),
    lostAll: m((s) => s.lostAll),
    bossNormal: m((s) => s.bossNormal),
    bossReached: m((s) => s.bossReached),
  };
  if (per.every((s) => s.tension))
    out.tension = {
      peak: m((s) => s.tension!.peak),
      hot: m((s) => s.tension!.hot),
      calm: m((s) => s.tension!.calm),
      sawtooth: m((s) => s.tension!.sawtooth),
      flat: m((s) => s.tension!.flat),
    };
  return out;
}

// ---------------------------------------------------------------------------
// Synergy
//
// What a set of weapons is predicted to do from its parts, against what it
// did. Measured on ships lost over all 13 waves (every wave played), where
// lower is better. Each weapon on its own cuts the plain gun's losses by a
// share; the prediction for a set is the plain gun's losses cut by each
// share in turn (independent effects multiply):
//
//   predicted(A+B) = plain × (A / plain) × (B / plain)
//
// Synergy = predicted − actual: ships a run the set saves beyond what its
// parts predict (positive: better together; negative: they get in each
// other's way). A multiplicative model, not an additive one, because losses
// can't go below zero: two weapons that each halve the losses predict a
// quarter, where adding the cuts would predict zero.

/** Predicted losses of a set from the plain gun's and each part's. */
export function predictLosses(plain: number, parts: number[]): number {
  if (!(plain > 0)) return Math.min(...parts, plain);
  return parts.reduce((p, x) => p * (x / plain), plain);
}

/** Ships a run saved beyond the prediction (positive = better together). */
export function synergy(plain: number, parts: number[], actual: number): number {
  return predictLosses(plain, parts) - actual;
}

/** A triple from its pairs (inclusion-exclusion on the log scale): what the
 *  three pairs predict for the triple, so the synergy left is the third
 *  weapon's own (beyond the pairs'). predicted = AB × AC × BC × plain / (A × B × C). */
export function predictFromPairs(plain: number, singles: [number, number, number], pairs: [number, number, number]): number {
  const [a, b, c] = singles;
  if (!(plain > 0) || !(a > 0) || !(b > 0) || !(c > 0)) return NaN;
  return (pairs[0] * pairs[1] * pairs[2] * plain) / (a * b * c);
}

/** Win-rate prediction on the same idea, on the chance of losing: each part
 *  cuts the plain gun's chance of losing by a share. */
export function predictWin(plainWin: number, partWins: number[]): number {
  const plainLose = 1 - plainWin;
  if (!(plainLose > 0)) return 1;
  return Math.max(0, Math.min(1, 1 - partWins.reduce((p, w) => p * ((1 - w) / plainLose), plainLose)));
}
