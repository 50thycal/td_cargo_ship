// Prints the Test Lab's cards (src/v3/data/lab.ts) as JSON, for the review
// page (page.mjs): the page and the game list the same cards, with each
// card's current version and what changed in it, by round (`changes`, a
// combo's inherited lines too; `own`, only its own lines).
import { SCORECARD, SCORECARD_REV } from '../../../src/v3/data/scorecard';
import { EVENT_WAVE } from '../../../src/v3/data/events';
import { LAB_CARDS, LAB_CHANGES, LAB_RETIRED, LAB_ROUND, LAB_ROUNDS, LAB_SECTIONS, MAP_CARD_PLAYS, cardChangeList, cardRev, cardVersion, productionText } from '../../../src/v3/data/lab';
console.log(JSON.stringify({
  sections: LAB_SECTIONS,
  rounds: LAB_ROUNDS,
  round: LAB_ROUND,
  // A map card (round 10) also says what it plays and how it opens, and
  // (round 12) which encounter version it is.
  cards: LAB_CARDS.map((c) => ({ id: c.id, kind: c.kind, name: c.name, look: c.look, ...(c.kind === 'map' ? { plays: `${MAP_CARD_PLAYS} · ${productionText(c.map, cardVersion(c))}`, map: c.map, variant: cardVersion(c) } : {}), rev: cardRev(c.id), changes: cardChangeList(c.id), own: LAB_CHANGES[c.id] ?? [] })),
  // Cards cut from the lab: their verdicts stay readable (round 8).
  retired: LAB_RETIRED.map(({ id, kind, name, look, cut, why }) => ({ id, kind, name, look, cut, why })),
  // The map scorecard (round 11): its categories, and the first boss round.
  scorecard: { rev: SCORECARD_REV, bossFrom: EVENT_WAVE, categories: SCORECARD },
}));
