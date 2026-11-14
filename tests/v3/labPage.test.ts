// The Test Lab review page's live split (tools/v3/test-lab/split.mjs): which
// cards are to test (never tested, or changed since their latest verdict),
// which are done, and which earlier changes haven't been tested yet. The page
// inlines these functions, so this is the logic it runs on the store's
// results/{cardId} documents.

import { describe, expect, it } from 'vitest';
import { LAB_CARDS, LAB_CHANGES, LAB_ROUND, cardChangeList, cardRev } from '../../src/v3/data/lab';
import { cardStatus, groupBySection, isAnswered, splitCards, untestedEarlier, type SplitResult } from '../../tools/v3/test-lab/split.mjs';

// The cards as the page gets them (tools/v3/test-lab/cards.mts).
const CARDS = LAB_CARDS.map(({ id, kind, name }) => ({ id, kind, name, rev: cardRev(id), changes: cardChangeList(id), own: LAB_CHANGES[id] ?? [] }));
const changedNow = CARDS.filter((c) => c.changes.some((l) => l.round === LAB_ROUND));
const SECTIONS = [...new Set(CARDS.map((c) => c.kind))].map((kind) => ({ kind, name: kind, blurb: '' }));

describe('Test Lab page: to test and done', () => {
  it('a card is new without a result, done at its version, retest before it', () => {
    const card = CARDS.find((c) => c.rev > 1)!;
    expect(cardStatus(card, undefined)).toBe('new');
    expect(cardStatus(card, { rev: card.rev })).toBe('done');
    expect(cardStatus(card, { rev: card.rev - 1 })).toBe('retest');
    // A result from before versions is version 1.
    expect(cardStatus(card, {})).toBe('retest');
    expect(cardStatus(CARDS.find((c) => c.rev === 1)!, {})).toBe('done');
  });

  it('with no results every card is to test, the round\'s changed cards first', () => {
    const { toTest, done } = splitCards(CARDS, {}, LAB_ROUND);
    expect(done).toHaveLength(0);
    expect(toTest).toHaveLength(CARDS.length);
    expect(changedNow.length).toBeGreaterThan(0);
    expect(toTest.slice(0, changedNow.length).every((e) => e.now)).toBe(true);
    expect(toTest.slice(changedNow.length).some((e) => e.now)).toBe(false);
    // Grouped by section, the round's own section leads.
    expect(groupBySection(toTest, SECTIONS)[0].section.kind).toBe(changedNow[0].kind);
  });

  it('a verdict on the current version moves a card to done; an older one keeps it to test', () => {
    const [a, b] = changedNow;
    const older = CARDS.find((c) => c.rev > 1 && c.rev < LAB_ROUND)!;
    const results: Record<string, SplitResult> = {
      [a.id]: { rev: a.rev, round: LAB_ROUND, verdict: 'keep' },
      [b.id]: { rev: b.rev - 1, round: b.rev - 1, verdict: 'tune' },
      [older.id]: { rev: older.rev, round: older.rev, verdict: 'keep' },
    };
    const { toTest, done } = splitCards(CARDS, results, LAB_ROUND);
    expect(done.map((e) => e.card.id).sort()).toEqual([a.id, older.id].sort());
    expect(toTest).toHaveLength(CARDS.length - 2);
    const bt = toTest.find((e) => e.card.id === b.id)!;
    expect(bt.status).toBe('retest');
    expect(bt.since.every((l) => l.round > b.rev - 1)).toBe(true);
    expect(bt.since.map((l) => l.round)).toContain(LAB_ROUND);
  });

  it('earlier changes not tested since: only lines after the verdict, never this round\'s', () => {
    const card = CARDS.find((c) => c.own.filter((l) => l.round < LAB_ROUND).length >= 2)!;
    const lines = card.own.filter((l) => l.round < LAB_ROUND).map((l) => l.round).sort((x, y) => x - y);
    const first = lines[0];
    const tested = { [card.id]: { rev: first, round: first, verdict: 'keep' } };
    const row = untestedEarlier(CARDS, tested, LAB_ROUND).find((e) => e.card.id === card.id)!;
    expect(row.lines.every((l) => l.round > first && l.round < LAB_ROUND)).toBe(true);
    expect(row.lines.map((l) => l.round)).toEqual(lines.filter((n) => n > first).reverse());
    // Tested at its version: nothing earlier left on it.
    const all = untestedEarlier(CARDS, { [card.id]: { rev: card.rev } }, LAB_ROUND);
    expect(all.find((e) => e.card.id === card.id)).toBeUndefined();
  });

  it('a question is answered by a choice or a note', () => {
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered({ choice: null, note: ' ' })).toBe(false);
    expect(isAnswered({ choice: 0 })).toBe(true);
    expect(isAnswered({ note: 'More waves' })).toBe(true);
  });
});
