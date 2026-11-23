// The Test Lab page's live split: which cards are still to test, which are
// done, and which changes in the game haven't been tested yet. The page
// (page.mjs) inlines these functions into its script, because results reach
// its store after it is published, so each function must stay
// self-contained: no imports, and no outer names but each other's.
//
// A card here is { id, kind, rev, changes, own }: `rev` its current version
// (src/v3/data/lab.ts cardRev), `changes` every change line it has, a
// combo's inherited ones too (cardChangeList), and `own` only its own lines
// (LAB_CHANGES[id]), each { round, what }. A result is a `results/{cardId}`
// document (src/v3/sim/labDocs.ts); one without `rev` is version 1.

/** A card against its latest saved result: 'new' (never tested), 'retest'
 *  (its latest verdict is on an older version) or 'done'. */
export function cardStatus(card, result) {
  if (!result) return 'new';
  return (result.rev || 1) < card.rev ? 'retest' : 'done';
}

/** The lines among `lines` that came after the card's latest verdict (all
 *  of them for a card never tested), oldest first. */
export function changesSince(result, lines) {
  const from = result ? result.rev || 1 : 0;
  return lines.filter((c) => c.round > from).sort((a, b) => a.round - b.round);
}

/** The cards still to test, and the ones done (their latest verdict is on
 *  the current version). To test: the cards that changed in `round` first,
 *  then the newest change, then the lab's own order. Done: the lab's order. */
export function splitCards(cards, results, round) {
  const toTest = [];
  const done = [];
  cards.forEach((card, i) => {
    const result = results[card.id];
    const status = cardStatus(card, result);
    if (status === 'done') {
      done.push({ card, result, status });
      return;
    }
    const since = changesSince(result, card.changes);
    const latest = since.reduce((m, c) => Math.max(m, c.round), 0);
    toTest.push({ card, result, status, since, now: latest === round, latest, i });
  });
  toTest.sort((a, b) => Number(b.now) - Number(a.now) || b.latest - a.latest || a.i - b.i);
  return { toTest: toTest.map(({ card, result, status, since, now }) => ({ card, result, status, since, now })), done };
}

/** Entries grouped by their card's section, the sections in the order
 *  their first entry comes (so the round's own section leads To test). */
export function groupBySection(entries, sections) {
  const out = [];
  for (const e of entries) {
    let g = out.find((x) => x.section.kind === e.card.kind);
    if (!g) {
      g = { section: sections.find((s) => s.kind === e.card.kind) || { kind: e.card.kind, name: e.card.kind, blurb: '' }, entries: [] };
      out.push(g);
    }
    g.entries.push(e);
  }
  return out;
}

/** Earlier rounds' changes not yet tested: each card's own lines from
 *  before `round` that came after its latest verdict, newest first; the
 *  cards with the newest change first. */
export function untestedEarlier(cards, results, round) {
  const out = [];
  for (const card of cards) {
    const lines = changesSince(results[card.id], card.own).filter((c) => c.round < round);
    if (lines.length) out.push({ card, lines: lines.reverse(), latest: lines[0].round });
  }
  return out.sort((a, b) => b.latest - a.latest);
}

/** A question has a saved answer: a choice, or a note. */
export function isAnswered(a) {
  return !!a && (a.choice != null || (typeof a.note === 'string' && a.note.trim() !== ''));
}
