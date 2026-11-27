// Debug: print the ground bodies at each overlap of one run's wave.
//   npx vite-node tools/v3/overlap-audit/dbg.ts -- <map> <seed> <wave>
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { MapId } from '../../../src/v3/data/maps';
import { playReportRun } from '../../../src/v3/sim/mapReportPlay';
import { groundBodies, overlaps } from '../../../src/v3/sim/overlap';

const args = process.argv.slice(2).filter((a) => a !== '--');
const [map, seed, wave] = [args[0] as MapId, Number(args[1]), Number(args[2])];
let n = 0;
let last = 0;
playReportRun(map, seed, {
  armory: PLAYER_ARMORY,
  onStep: (g) => {
    if (g.wave !== wave) return;
    const o = overlaps(groundBodies(g));
    if (!o.length || g.t - last < 0.5 || n > 12) return;
    last = g.t;
    n++;
    console.log(`t=${g.t.toFixed(1)} waveT=${g.waveT.toFixed(1)}`);
    for (const b of groundBodies(g)) {
      const th = g.threats.find((t) => t.id === b.id);
      const r = g.raiders.find((t) => t.id === b.id);
      console.log('   ', b.kind, b.id, Math.round(b.x), Math.round(b.y), 'h', b.heading.toFixed(2), th?.foe ? `st${th.foe.state} along${Math.round(th.foe.along ?? 0)} stop${th.foe.stop} stall${th.foe.stall} wait${th.foe.wait}` : r ? `${r.state} dist${Math.round(r.dist)}/${Math.round(r.length)} lat${r.lat} held${r.held}` : '');
    }
  },
});
