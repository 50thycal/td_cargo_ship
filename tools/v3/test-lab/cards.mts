// Prints the Test Lab's cards (src/v3/data/lab.ts) as JSON, for the review
// page (page.mjs): the page and the game list the same cards, with each
// card's current version and what changed in it, by round (`changes`, a
// combo's inherited lines too; `own`, only its own lines).
import { LAB_CARDS, LAB_CHANGES, LAB_RETIRED, LAB_ROUND, LAB_ROUNDS, LAB_SECTIONS, MAP_CARD_PLAYS, cardChangeList, cardRev, productionText } from '../../../src/v3/data/lab';
console.log(JSON.stringify({
  sections: LAB_SECTIONS,
  rounds: LAB_ROUNDS,
  round: LAB_ROUND,
  // A map card (round 10) also says what it plays and how it opens.
  cards: LAB_CARDS.map(({ id, kind, name, look, map }) => ({ id, kind, name, look, ...(kind === 'map' ? { plays: `${MAP_CARD_PLAYS} · ${productionText(map)}` } : {}), rev: cardRev(id), changes: cardChangeList(id), own: LAB_CHANGES[id] ?? [] })),
  // Cards cut from the lab: their verdicts stay readable (round 8).
  retired: LAB_RETIRED.map(({ id, kind, name, look, cut, why }) => ({ id, kind, name, look, cut, why })),
}));
