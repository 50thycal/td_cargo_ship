// Which maps have enemy shore along the bottom edge: npx tsx tools/v3/weapon-ideas/bottom.mts
import { MAPS, MAP_ORDER } from '../../../src/v3/data/maps';
const inside = (p: { x: number; y: number }, poly: { x: number; y: number }[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
for (const id of MAP_ORDER) {
  const m = MAPS[id];
  let enemy = 0, friendly = 0, sea = 0;
  for (let x = 20; x < 1600; x += 40) { const p = { x, y: 885 }; const l = m.land.find((L) => inside(p, L.points)); if (!l) sea++; else if (l.side === 'enemy') enemy++; else friendly++; }
  const n = enemy + friendly + sea;
  console.log(`${id.padEnd(12)} carrier y ${m.carrier.y}  bottom edge: sea ${Math.round((100 * sea) / n)}%, friendly ${Math.round((100 * friendly) / n)}%, ENEMY ${Math.round((100 * enemy) / n)}%`);
}
