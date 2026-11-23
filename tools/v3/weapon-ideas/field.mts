// Field data for weapon ideas: npx tsx tools/v3/weapon-ideas/field.mts <seeds> <average|spammer|casual>
// Field data for weapon-idea screening: real waves, bot-played, all maps.
import { createGame, step, type Game } from '../../../src/v3/sim/game';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { MAP_ORDER } from '../../../src/v3/data/maps';
import { ABILITY_ORDER } from '../../../src/v3/data/abilities';
import { makeRng } from '../../../src/sim/rng';
const SEEDS = Number(process.argv[2] ?? 3);
const skillName = process.argv[3] ?? 'average';
const DT = 1 / 30;
const CHILD = new Set(['bomblet', 'minidrone']);
const STRUCT = new Set(['rig', 'generator', 'citadel', 'dreadnought']);
type Acc = Record<string, number>;
const add = (a: Acc, k: string, v = 1) => (a[k] = (a[k] ?? 0) + v);
const tot: any = { origins: {}, sunk: {}, life: {}, lifeN: {}, snaps: 0, live: 0, tapHits: 0, swipe: 0, swipe2: 0, near: 0, dry: 0, waveSteps: 0, pickups: 0, waves: 0, spawnPeak: 0, spawns: 0, waveSec: 0, raiderSec: 0, raiders: 0, corridor: 0, corridorN: 0, maxLive: 0 };
const perMap: Record<string, any> = {};
function bestSwipe(pts: { x: number; y: number }[], L: number, W: number): number {
  // Segments through every pair (and every single point, horizontal) clipped to length L.
  let best = pts.length ? 1 : 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = pts[i], b = pts[j];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len > L || len < 1) continue;
    const ux = dx / len, uy = dy / len;
    // centre the segment on the pair's midpoint, length L
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    let n = 0;
    for (const p of pts) {
      const t = (p.x - mx) * ux + (p.y - my) * uy;
      if (Math.abs(t) > L / 2) continue;
      const d = Math.abs((p.x - mx) * uy - (p.y - my) * ux);
      if (d <= W) n++;
    }
    if (n > best) best = n;
  }
  return best;
}
for (const map of MAP_ORDER) {
  const pm: any = (perMap[map] = { origins: {}, sunk: {}, raiders: 0, raiderSec: 0, waves: 0, trucks: 0, subs: 0, launches: 0 });
  for (let s = 0; s < SEEDS; s++) {
    const seed = 2000 + s;
    const g: Game = createGame(map, seed);
    g.flow = 2;
    const prefer = makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);
    const bot = new Bot({ ...SKILLS[skillName], prefer }, seed);
    const firstSeen = new Map<number, { t: number; x: number; y: number; kind: string }>();
    const seenRaider = new Set<number>();
    const seenPickup = new Set<number>();
    let spawnWin: number[] = [];
    let snapT = 0;
    for (let i = 0; i < 60 * 60 * 30; i++) {
      bot.act(g);
      if (g.phase === 'won' || g.phase === 'lost') break;
      const before = new Set(g.threats.map((t) => t.id));
      step(g, DT);
      if (g.phase !== 'wave') continue;
      tot.waveSteps++;
      if (g.ammo <= 0 && !g.weapon) tot.dry++;
      for (const p of g.pickups) if (!seenPickup.has(p.id)) { seenPickup.add(p.id); if (p.kind !== 'weapon') tot.pickups++; }
      for (const r of g.raiders) { if (!seenRaider.has(r.id)) { seenRaider.add(r.id); pm.raiders++; if (r.kind === 'sub') pm.subs++; else pm.trucks++; } pm.raiderSec += DT; }
      for (const th of g.threats) {
        if (!firstSeen.has(th.id)) {
          firstSeen.set(th.id, { t: g.t, x: th.x, y: th.y, kind: th.kind });
          if (!CHILD.has(th.kind) && !STRUCT.has(th.kind)) { spawnWin.push(g.t); tot.spawns++; }
        }
      }
      const ids = new Set(g.threats.filter((t) => !t.dead).map((t) => t.id));
      for (const [id, f] of firstSeen) if (!ids.has(id)) {
        add(tot.life, f.kind, g.t - f.t); add(tot.lifeN, f.kind); firstSeen.delete(id);
      }
      spawnWin = spawnWin.filter((t) => g.t - t < 5);
      tot.spawnPeak = Math.max(tot.spawnPeak, spawnWin.length);
      tot.waveSec += DT;
      snapT += DT;
      if (snapT >= 0.5) {
        snapT = 0;
        const air = g.threats.filter((t) => !t.dead && !STRUCT.has(t.kind) && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900);
        tot.snaps++;
        tot.live += air.length;
        tot.maxLive = Math.max(tot.maxLive, air.length);
        if (air.length) {
          // a tap's blast (22 px) at the best threat
          let bt = 0;
          for (const a of air) { const n = air.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) <= 36).length; if (n > bt) bt = n; }
          tot.tapHits += bt;
          tot.swipe += bestSwipe(air, 320, 30);
          tot.swipe2 += bestSwipe(air, 600, 30);
          if (air.length >= 6) { tot.busy=(tot.busy??0)+1; tot.bTap=(tot.bTap??0)+bt; tot.bSw=(tot.bSw??0)+bestSwipe(air,320,30); tot.bSw2=(tot.bSw2??0)+bestSwipe(air,600,30); tot.bLive=(tot.bLive??0)+air.length; }
          const c = g.map.carrier;
          tot.near += air.filter((t) => g.ships.some((sh) => Math.hypot(sh.x - t.x, sh.y - t.y) < 220) || Math.hypot(c.x - t.x, c.y - t.y) < 220).length;
          // corridor: threats between a guided/drone and where it came from
          for (const a of air) {
            if (a.kind !== 'guided' && a.kind !== 'drone' && a.kind !== 'heavy') continue;
            const f = firstSeen.get(a.id); if (!f) continue;
            const dx = f.x - a.x, dy = f.y - a.y, len = Math.hypot(dx, dy); if (len < 50) continue;
            let n = 0;
            for (const b of air) { if (b === a) continue; const t = ((b.x - a.x) * dx + (b.y - a.y) * dy) / len; if (t < 0 || t > len) continue; if (Math.abs(((b.x - a.x) * dy - (b.y - a.y) * dx) / len) < 40) n++; }
            tot.corridor += n; tot.corridorN++;
          }
        }
      }
    }
    for (const [k, v] of Object.entries(g.origins)) { add(tot.origins, k, v); add(pm.origins, k, v); }
    for (const [k, v] of Object.entries(g.sunkBy)) if (v) { add(tot.sunk, k, v); add(pm.sunk, k, v); }
    pm.waves += g.wave; tot.waves += g.wave;
  }
}
const pct = (o: Acc) => { const s = Object.values(o).reduce((a, b) => a + b, 0); return Object.entries(o).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / s)}%`).join(', '); };
console.log(`skill ${skillName}, ${SEEDS} seeds × ${MAP_ORDER.length} maps, ${tot.waves} waves`);
console.log('origins:', pct(tot.origins));
console.log('sinks by:', pct(tot.sunk));
console.log('threat life on screen (s):', Object.keys(tot.life).map((k) => `${k} ${(tot.life[k] / tot.lifeN[k]).toFixed(1)}`).join(', '));
console.log(`live threats per snapshot: avg ${(tot.live / tot.snaps).toFixed(1)}, max ${tot.maxLive}; within 220 px of a hull ${(tot.near / tot.snaps).toFixed(1)}`);
console.log(`best single tap blast (36 px) hits ${(tot.tapHits / tot.snaps).toFixed(2)}; best 320 px swipe ${(tot.swipe / tot.snaps).toFixed(2)}; best 600 px swipe ${(tot.swipe2 / tot.snaps).toFixed(2)}`);
console.log(`busy snapshots (6+ live, ${Math.round(100*tot.busy/tot.snaps)}% of wave time): live ${(tot.bLive/tot.busy).toFixed(1)}, tap blast ${(tot.bTap/tot.busy).toFixed(2)}, 320 swipe ${(tot.bSw/tot.busy).toFixed(2)}, 600 swipe ${(tot.bSw2/tot.busy).toFixed(2)}`);
console.log(`threats in a 40 px corridor behind a guided/drone/heavy (toward where it came from): ${(tot.corridor / tot.corridorN).toFixed(2)}`);
console.log(`spawns/s avg ${(tot.spawns / tot.waveSec).toFixed(2)}, peak in 5 s ${tot.spawnPeak}`);
console.log(`dry (rack empty, nothing loaded) share of wave time: ${Math.round((100 * tot.dry) / tot.waveSteps)}%`);
console.log(`power-up pickups per wave: ${(tot.pickups / tot.waves).toFixed(2)}`);
console.log('\nmap         launches: base/truck/sub/air   raiders/run  raider-s/wave  sinks by');
for (const [m, p] of Object.entries(perMap)) {
  const o = p.origins, s = (o.base ?? 0) + (o.truck ?? 0) + (o.sub ?? 0) + (o.air ?? 0);
  const f = (k: string) => `${Math.round((100 * (o[k] ?? 0)) / Math.max(1, s))}`.padStart(3);
  console.log(`${m.padEnd(12)} ${f('base')}/${f('truck')}/${f('sub')}/${f('air')}%            ${(p.raiders / SEEDS).toFixed(1).padStart(5)}      ${(p.raiderSec / Math.max(1, p.waves)).toFixed(1).padStart(5)}    ${pct(p.sunk)}`);
}
