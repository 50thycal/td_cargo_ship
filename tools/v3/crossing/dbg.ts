import { SPOTTER } from '../../../src/v3/data/encounters';
import { PERSONAS, playMimic } from '../../../src/v3/sim/mimic';
import { applyEncounters, createGame, step } from '../../../src/v3/sim/game';
import { crossingPair } from '../../../src/v3/sim/foes';

const DT = 1 / 60;
const g = createGame('crossing', 5, 4);
applyEncounters(g, { rev: 4, version: 'v1' });
g.tempo = { ...g.tempo, lossLimit: 999 };
g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
g.raiderQueue = [];
for (let i = 0; i < 40 / DT; i++) step(g, DT);
console.log('pair', !!crossingPair(g), g.ships.length, g.phase);
g.queue.push({ at: g.waveT, kind: 'lure', base: -1, beacon: SPOTTER });
step(g, DT);
console.log('lures', g.threats.filter((t) => t.kind === 'lure').map((t) => [t.dead, t.hp, Math.round(t.x), Math.round(t.y)]), g.queue.length);
for (const seed of [219, 220, 221]) for (const persona of ['you', 'tryhard'] as const) {
  const on = playMimic('crossing', seed, { persona: PERSONAS[persona], armory: { reload: 5, repair: 4, stockpile: 5, plating: 5 }, firstWave: 11, encounters: { rev: 4, version: 'v1' } });
  console.log(seed, persona, on.game.eventLog.map((e) => [e.run, e.outcome]), on.game.lost);
}
