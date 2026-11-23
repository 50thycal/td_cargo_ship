// The Test Lab page's map scorecards (Test Lab round 11; the categories are
// src/v3/data/scorecard.ts): a map card's latest scores as chips, and its
// averages per category, by encounter version. The page (page.mjs) inlines
// these functions into its script, as it does split.mjs, so each must stay
// self-contained: no imports, and no outer names but each other's.
//
// `sc` is the scorecard as cards.mts prints it: { rev, bossFrom, categories:
// [{ id, label, help, scale: { kind: 'stars' | 'choice' | 'wave', options?:
// [{ id, label, value }] }, boss? }] }. A run is a `results/{cardId}`
// document's `runs` entry (src/v3/sim/labDocs.ts ScoredRun): { at, log,
// round, rev, variant, end, verdict, score?, auto? }.
//
// Scorecard revision 2 (2026-11-17) retired four rows (`retired: 2` on
// their category) and added the comparison (`vs`). A score is averaged only
// with scores of its own revision, so a revision 1 answer and a revision 2
// answer are never averaged together; the older ones are counted apart.
// Revision 3 added "Best moment" (`since: 3`; its wave reads like Best
// wave's, and `momentT`, the seconds into it, is for the fun measures).
// Revision 4 (docs/design/v3-rate-and-review.md) retired it (`retired: 4`)
// and added Intensity (`since: 4`, stars), and a score can carry `waves`:
// the waves the player rated on the draft ([{ n, difficulty?, fun?,
// intensity?, note? }]), with `bestSuggested` / `weakestSuggested`, the
// Best and Weakest wave the end screen suggested from them. Older scores
// read and average under their own revision as before.
// Round 11 added Effort (`since: 4`, stars) to revision 4: it changes no
// other row's question, so revision 4 scores still average together.

/** A wave's name: "7", or "B2" for the second boss round. */
export function waveName(n, bossFrom) {
  return n >= bossFrom ? 'B' + (n - bossFrom + 1) : String(n);
}

/** One answer in words: "4", "Bit hard", "B2". */
export function answerWords(cat, v, bossFrom) {
  if (cat.scale.kind === 'choice') {
    const o = (cat.scale.options || []).find((x) => x.id === v);
    return o ? o.label : String(v);
  }
  if (cat.scale.kind === 'wave') return typeof v === 'number' ? waveName(v, bossFrom) : String(v);
  return String(v);
}

/** A score's answers as chips, in the scorecard's order: [{ id, label,
 *  text }] (a row left alone has no chip). */
export function scoreChips(score, sc) {
  if (!score || typeof score !== 'object') return [];
  const out = [];
  for (const c of sc.categories) {
    const v = score[c.id];
    if (v === undefined || v === null) continue;
    out.push({ id: c.id, label: c.label.replace(/\?$/, ''), text: answerWords(c, v, sc.bossFrom) });
  }
  return out;
}

/** A score's waves rated on the draft as chips, in wave order: [{ id:
 *  'w<n>', label: '7', text: 'F4 D2 I5', note? }] (none: []). */
export function waveRatingChips(score, bossFrom) {
  if (!score || !Array.isArray(score.waves)) return [];
  return score.waves
    .filter((w) => w && typeof w.n === 'number')
    .slice()
    .sort((a, b) => a.n - b.n)
    .map((w) => {
      const text = [w.fun != null ? 'F' + w.fun : '', w.difficulty != null ? 'D' + w.difficulty : '', w.intensity != null ? 'I' + w.intensity : ''].filter(Boolean).join(' ');
      return { id: 'w' + w.n, label: waveName(w.n, bossFrom), text: text || 'note', ...(w.note ? { note: w.note } : {}) };
    });
}

/** The waves rated on the draft, averaged over some runs, wave by wave:
 *  { [n]: { n: runs that rated it, fun?, difficulty?, intensity? (means) } }.
 *  Any revision that carries `waves` (4 on). */
export function waveRatingAverages(runs) {
  const acc = {};
  for (const r of runs || []) {
    const waves = r && r.score && Array.isArray(r.score.waves) ? r.score.waves : [];
    for (const w of waves) {
      if (!w || typeof w.n !== 'number') continue;
      const a = (acc[w.n] = acc[w.n] || { n: 0, sum: {}, cnt: {} });
      a.n++;
      for (const k of ['fun', 'difficulty', 'intensity']) {
        if (typeof w[k] !== 'number') continue;
        a.sum[k] = (a.sum[k] || 0) + w[k];
        a.cnt[k] = (a.cnt[k] || 0) + 1;
      }
    }
  }
  const out = {};
  for (const n of Object.keys(acc)) {
    const a = acc[n];
    const o = { n: a.n };
    for (const k of Object.keys(a.sum)) o[k] = a.sum[k] / a.cnt[k];
    out[n] = o;
  }
  return out;
}

/** How the end screen's suggestions fared (revision 4): of the runs where
 *  Best (or Weakest) wave was suggested from the wave ratings, how many
 *  kept it. { best: { suggested, kept }, weakest: { suggested, kept } }. */
export function suggestionsKept(runs) {
  const out = { best: { suggested: 0, kept: 0 }, weakest: { suggested: 0, kept: 0 } };
  for (const r of runs || []) {
    const s = r && r.score;
    if (!s) continue;
    for (const k of ['best', 'weakest']) {
      const sug = s[k + 'Suggested'];
      if (typeof sug !== 'number') continue;
      out[k].suggested++;
      if (s[k] === sug) out[k].kept++;
    }
  }
  return out;
}

/** The averages of some runs' scores, per category: stars, the mean (1-5);
 *  a choice, the mean of its options' values and the option nearest it
 *  ("Bit hard"), with each option's count; a wave, the one picked most.
 *  Each with `n`, the runs that answered it. Only scores on one scorecard
 *  revision count: `rev`, the current one unless given; a category that
 *  revision no longer asks is left out. */
export function scoreAverages(runs, sc, rev) {
  const at = rev === undefined ? sc.rev : rev;
  const scored = runs.filter((r) => r.score && (r.score.rev ?? 1) === at);
  const out = {};
  for (const c of sc.categories) {
    if ((c.retired !== undefined && at >= c.retired) || (c.since !== undefined && at < c.since)) continue;
    const vals = scored.map((r) => r.score[c.id]).filter((v) => v !== undefined && v !== null);
    if (!vals.length) continue;
    if (c.scale.kind === 'stars') {
      out[c.id] = { n: vals.length, mean: vals.reduce((a, b) => a + b, 0) / vals.length };
    } else if (c.scale.kind === 'choice') {
      const opts = c.scale.options || [];
      const counts = {};
      let sum = 0;
      let n = 0;
      for (const v of vals) {
        const o = opts.find((x) => x.id === v);
        if (!o) continue;
        counts[o.id] = (counts[o.id] || 0) + 1;
        sum += o.value;
        n++;
      }
      if (!n) continue;
      const mean = sum / n;
      // The option nearest the mean; halfway between two, the one nearer
      // the middle (a mean of -0.5 on Pacing reads "Right", not "Too slow").
      const gap = (o) => Math.abs(o.value - mean) + Math.abs(o.value) * 1e-6;
      const near = opts.reduce((best, o) => (gap(o) < gap(best) ? o : best), opts[0]);
      out[c.id] = { n, mean, near: near.label, counts };
    } else {
      const counts = {};
      for (const v of vals) counts[v] = (counts[v] || 0) + 1;
      let top = null;
      for (const k of Object.keys(counts)) if (top === null || counts[k] > counts[top] || (counts[k] === counts[top] && Number(k) < Number(top))) top = k;
      out[c.id] = { n: vals.length, top: Number(top), topCount: counts[top], counts };
    }
  }
  return out;
}

/** Some runs' numbers on average: how many, won, the share delivered and
 *  the ships lost (a run without numbers is left out of those). Only runs
 *  played by hand count: a Test Lab Watch run (log v65, `played` 'sim' or
 *  'mixed') is the bot's play, counted apart as `bot`. */
export function runNumbers(runs) {
  const hand = runs.filter((r) => !r.played || r.played === 'full playtest');
  const withAuto = hand.filter((r) => r.auto);
  const pct = withAuto.filter((r) => typeof r.auto.deliveredPct === 'number');
  const out = {
    runs: hand.length,
    won: hand.filter((r) => r.end === 'won').length,
    deliveredPct: pct.length ? pct.reduce((a, r) => a + r.auto.deliveredPct, 0) / pct.length : null,
    lost: withAuto.length ? withAuto.reduce((a, r) => a + r.auto.lost, 0) / withAuto.length : null,
  };
  if (hand.length < runs.length) out.bot = runs.length - hand.length;
  return out;
}

/** A map card's runs, ready for the page: only those on the newest card
 *  version among them (a run on an older build is another experiment), by
 *  encounter version (variant, 'v1' when a run has none), each group with
 *  its run numbers, scored-run count and averages, and `oldScored`: its
 *  runs scored on another scorecard revision (not averaged). `older`: runs
 *  left out for being on an older card version. */
export function scoreGroups(runs, sc) {
  const list = Array.isArray(runs) ? runs : [];
  const rev = list.reduce((m, r) => Math.max(m, r.rev || 1), 0);
  const now = list.filter((r) => (r.rev || 1) === rev);
  const ids = [...new Set(now.map((r) => r.variant || 'v1'))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const groups = ids.map((variant) => {
    const mine = now.filter((r) => (r.variant || 'v1') === variant);
    return {
      variant,
      numbers: runNumbers(mine),
      scored: mine.filter((r) => r.score && (r.score.rev ?? 1) === sc.rev).length,
      oldScored: mine.filter((r) => r.score && (r.score.rev ?? 1) !== sc.rev).length,
      averages: scoreAverages(mine, sc),
    };
  });
  return { rev, groups, older: list.length - now.length };
}

/** An average in words: "3.7", "Bit hard (+0.7)", "Yes 2 · Maybe 1", or
 *  the wave picked most, "7 (2 of 3)" when the runs differ. */
export function averageWords(cat, a, bossFrom) {
  if (!a) return '';
  if (cat.scale.kind === 'stars') return a.mean.toFixed(1);
  if (cat.scale.kind === 'wave') return waveName(a.top, bossFrom) + (a.topCount < a.n ? ' (' + a.topCount + ' of ' + a.n + ')' : '');
  const opts = cat.scale.options || [];
  // A yes/maybe/no row (no too-little side): its counts say more than a mean.
  if (opts.every((o) => o.value >= 0)) {
    return opts.filter((o) => a.counts[o.id]).map((o) => o.label + ' ' + a.counts[o.id]).join(' · ');
  }
  const sign = a.mean > 0 ? '+' : a.mean < 0 ? '−' : '±';
  return a.near + ' (' + sign + Math.abs(a.mean).toFixed(1) + ')';
}
