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

/** The averages of some runs' scores, per category: stars, the mean (1-5);
 *  a choice, the mean of its options' values and the option nearest it
 *  ("Bit hard"), with each option's count; a wave, the one picked most.
 *  Each with `n`, the runs that answered it. Only scores on this
 *  scorecard revision count. */
export function scoreAverages(runs, sc) {
  const scored = runs.filter((r) => r.score && (r.score.rev ?? 1) === sc.rev);
  const out = {};
  for (const c of sc.categories) {
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
 *  the ships lost (a run without numbers is left out of those). */
export function runNumbers(runs) {
  const withAuto = runs.filter((r) => r.auto);
  const pct = withAuto.filter((r) => typeof r.auto.deliveredPct === 'number');
  return {
    runs: runs.length,
    won: runs.filter((r) => r.end === 'won').length,
    deliveredPct: pct.length ? pct.reduce((a, r) => a + r.auto.deliveredPct, 0) / pct.length : null,
    lost: withAuto.length ? withAuto.reduce((a, r) => a + r.auto.lost, 0) / withAuto.length : null,
  };
}

/** A map card's runs, ready for the page: only those on the newest card
 *  version among them (a run on an older build is another experiment), by
 *  encounter version (variant, 'v1' when a run has none), each group with
 *  its run numbers, scored-run count and averages. `older`: runs left out
 *  for being on an older card version. */
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
