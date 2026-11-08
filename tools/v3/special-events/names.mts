// Prints the names the special-event page and plan need, as JSON: each map's
// name (src/v3/data/maps.ts), each enemy's name and threat kind
// (src/v3/data/foes.ts), and the chapter names. The page and the doc read
// them from the game, so they can't drift from it.
import { MAPS, CHAPTERS, MAP_ORDER } from '../../../src/v3/data/maps';
import { FOES } from '../../../src/v3/data/foes';

console.log(JSON.stringify({
  maps: Object.fromEntries(MAP_ORDER.map((id) => [id, MAPS[id].name])),
  foes: Object.fromEntries(Object.values(FOES).map((f) => [f.id, { name: f.name, kind: f.kind }])),
  chapters: Object.fromEntries(CHAPTERS.map((c) => [c.n, c.name])),
}));
