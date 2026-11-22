import { MAP_SIGNATURE } from '../../../src/v3/data/encounters';
import { foesUpTo } from '../../../src/v3/data/foes';
import { chapterOf } from '../../../src/v3/data/maps';
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';
import { applyEncounters, createGame, step } from '../../../src/v3/sim/game';
import { crossingPair } from '../../../src/v3/sim/foes';

console.log(MAP_SIGNATURE.crossing, foesUpTo(chapterOf('crossing')));
const g = createGame('crossing', 5, 4);
applyEncounters(g, { rev: 4, version: 'v1' });
g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
g.raiderQueue = [];
for (let i = 0; i < 40 * 60; i++) step(g, 1 / 60);
console.log(g.ships.map((s) => [s.channel, Math.round(s.x)]), crossingPair(g));
const on = playMimic('crossing', 219, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11, encounters: { rev: 4, version: 'v1' } });
console.log(on.game.eventLog.map((e) => [e.run, e.outcome, e.sent, e.t]), on.game.lost, on.game.phase);
