// The encounter test's books for a map's waves (tests/v3/encounters.test.ts,
// "an encounter takes out of the wave what it sends"): what each encounter
// sends against what it takes out, and the wave as planned over eight seeds
// against the shared wave (at most 2 launches more). Tuning only.
//   npx vite-node tools/v3/dreadnought/books.ts -- [--map=dreadnought]
import { FILLER_WEIGHT, encountersFor } from '../../../src/v3/data/encounters';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { waveSpec } from '../../../src/v3/data/waves';
import { applyEncounters, createGame, type Game } from '../../../src/v3/sim/game';

const map = (process.argv.find((a) => a.startsWith('--map='))?.slice(6) ?? 'dreadnought') as MapId;
const planned = (g: Game) => g.queue.filter((l) => l.at < 1e8).reduce((a, l) => a + (l.filler ? FILLER_WEIGHT : 1), 0) + g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
for (let w = 1; w <= 10; w++) {
  const spec = waveSpec(w, MAPS[map].threatScale);
  for (const e of encountersFor(map, w, 'v1')) {
    const sent = e.beats.filter((b) => !b.filler).reduce((a, b) => a + ('air' in b.from ? Math.min(5, spec.swarm - 1) * b.count : b.count), 0);
    const asked = (e.replaces.drones ?? 0) + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0);
    const allShells = spec.ballistic > 0 && (e.replaces.ballistic ?? 0) >= spec.ballistic;
    const shared = mean(seeds.map((s) => { const g = createGame(map, s, w); applyEncounters(g, { rev: 4, version: 'v1', only: [] }); return planned(g); }));
    const got = mean(seeds.map((s) => { const g = createGame(map, s, w); applyEncounters(g, { rev: 4, version: 'v1' }); return planned(g); }));
    console.log(`w${w} ${e.id}: sends ${sent}, takes ${asked}${allShells ? ' (all shells)' : ''} of ${spec.drones + spec.ballistic + spec.guided} (d${spec.drones} b${spec.ballistic} g${spec.guided}); planned ${got.toFixed(1)} vs shared ${shared.toFixed(1)}${got > shared + 2 ? '  OVER' : ''}${!allShells && sent > asked ? '  BOOKS' : ''}`);
  }
}
