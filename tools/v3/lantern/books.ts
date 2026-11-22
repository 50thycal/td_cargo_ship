// Each Lantern encounter by the books (tests/v3/encounters.test.ts: what it
// sends from bases and subs against what it takes out of the wave, unless
// it takes every shell of the wave's table), against the wave's table at
// the map's threat scale.
//   npx vite-node tools/v3/lantern/books.ts -- [--map=lantern]
import { ENCOUNTERS } from '../../../src/v3/data/encounters';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { waveSpec } from '../../../src/v3/data/waves';

const args = process.argv.slice(2).filter((a) => a !== '--');
const map = (args.find((a) => a.startsWith('--map='))?.slice(6) ?? 'lantern') as MapId;
for (let w = 1; w <= 10; w++) {
  const s = waveSpec(w, MAPS[map].threatScale);
  for (const e of ENCOUNTERS.filter((x) => x.map === map && x.waves.includes(w))) {
    const sent = e.beats.filter((b) => !b.filler).reduce((a, b) => a + ('air' in b.from ? Math.min(5, s.swarm - 1) * b.count : b.count), 0);
    const asked = (e.replaces.drones ?? 0) + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0);
    const allShells = s.ballistic > 0 && (e.replaces.ballistic ?? 0) >= s.ballistic;
    const ok = allShells || sent <= asked;
    console.log(`w${w} table: drones ${s.drones} ballistic ${s.ballistic} guided ${s.guided} | ${e.id}: sends ${sent}, takes ${asked}${allShells ? ' (every shell)' : ''} ${ok ? 'ok' : 'OVER'}`);
  }
}
