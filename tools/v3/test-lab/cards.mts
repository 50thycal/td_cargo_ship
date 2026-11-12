// Prints the Test Lab's cards (src/v3/data/lab.ts) as JSON, for the review
// page's Results tab: the page and the game list the same cards, with each
// card's current version and what changed in it, by round.
import { LAB_CARDS, LAB_RETIRED, LAB_ROUND, LAB_ROUNDS, LAB_SECTIONS, cardChangeList, cardRev } from '../../../src/v3/data/lab';
console.log(JSON.stringify({
  sections: LAB_SECTIONS,
  rounds: LAB_ROUNDS,
  round: LAB_ROUND,
  cards: LAB_CARDS.map(({ id, kind, name, look }) => ({ id, kind, name, look, rev: cardRev(id), changes: cardChangeList(id) })),
  // Cards cut from the lab: their verdicts stay readable (round 8).
  retired: LAB_RETIRED.map(({ id, kind, name, look, cut, why }) => ({ id, kind, name, look, cut, why })),
}));
