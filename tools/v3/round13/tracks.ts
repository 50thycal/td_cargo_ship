// Each lane's frigate tracks: where the track has no room beside the
// convoy (stretches along the lane, with screen x, y at their ends).
// Usage: npx vite-node tools/v3/round13/tracks.ts [-- maps=kesh,needle]
declare const process: { argv: string[] };
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import { laneAt, laneLength } from '../../../src/v3/sim/lanes';
import { createGame, escortTrack } from '../../../src/v3/sim/game';

const arg = (k: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const maps = (arg('maps')?.split(',') ?? MAP_ORDER) as MapId[];
for (const map of maps) {
  const g = createGame(map, 1, 1);
  g.map.channels.forEach((ch, lane) => {
    for (const side of [-1, 1]) {
      const t = escortTrack(g, lane, side);
      const L = laneLength(ch);
      const runs: string[] = [];
      let start = -1;
      for (let i = 0; i <= t.ok.length; i++) {
        const bad = i < t.ok.length && !t.ok[i];
        if (bad && start < 0) start = i;
        if (!bad && start >= 0) {
          const a = t.d0 + start * 10;
          const b = t.d0 + (i - 1) * 10;
          if (b >= -300 && a <= L + 300) {
            const pa = laneAt(ch, a, t.lat[start]);
            const pb = laneAt(ch, b, t.lat[i - 1]);
            runs.push(`d ${a}..${b} (${pa.x.toFixed(0)},${pa.y.toFixed(0)})-(${pb.x.toFixed(0)},${pb.y.toFixed(0)})`);
          }
          start = -1;
        }
      }
      console.log(`${map} lane ${lane} side ${side} (L ${L.toFixed(0)}): ${runs.length ? runs.join('; ') : 'clear'}`);
    }
  });
}
