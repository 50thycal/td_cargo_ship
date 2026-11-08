// Prints the Test Lab's cards (src/v3/data/lab.ts) as JSON, for the review
// page's Results tab: the page and the game list the same cards.
import { LAB_CARDS, LAB_SECTIONS } from '../../../src/v3/data/lab';
console.log(JSON.stringify({ sections: LAB_SECTIONS, cards: LAB_CARDS.map(({ id, kind, name, look }) => ({ id, kind, name, look })) }));
