// Round 13: is the Frigate Escort as effective as before the give-way rules?
// (docs/design/v3-round13-escorts-munitions-nuke.md, "Frigate effectiveness".)
// Every map from wave 1 with its real waves, ships and carrier unsinkable, no
// taps, drafts auto-picked. The Frigate Escort is picked up 4 s into each wave
// and again 20 s after each pickup (it lasts 15 s), at level 1 and level 3,
// in Pairs and in Spread, 2 seeds, 150 s each.
//
// Per map: frigate shots and kills (a frigate's shot that reached its target
// and killed it), threats spawned, and coverage: the share of each frigate's
// 15 s it spent in reach to fire (on screen and not leaving).
//
// Usage: npx vite-node tools/v3/round13/frigate-effect.ts [-- maps=strait,needle secs=150]
declare const process: { argv: string[] };
import { MAP_ORDER, type MapId } from '../../../src/v3/data/maps';
import type { FormationId } from '../../../src/v3/data/formations';
import { createGame, pickUpgrade, setFormation, step, tap, type Game } from '../../../src/v3/sim/game';

const DT = 1 / 60;
const arg = (k: string) => process.argv.find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
const maps = (arg('maps')?.split(',') ?? MAP_ORDER) as MapId[];
const secs = Number(arg('secs') ?? 150);
const VIEW_W = 1600;
const VIEW_H = 900;

interface Tally {
  shots: number;
  kills: number;
  spawned: number;
  firing: number;
  loaded: number;
}

function run(map: MapId, level: number, form: FormationId, seed: number): Tally {
  const g: Game = createGame(map, seed, 1);
  g.tempo = { ...g.tempo, lossLimit: 1e9 };
  setFormation(g, form);
  g.levels = { ...g.levels, frigate: level };
  const t: Tally = { shots: 0, kills: 0, spawned: 0, firing: 0, loaded: 0 };
  let next = 4;
  const seen = new Set<number>();
  const shots = new Map<number, number>();
  for (let i = 0; i < secs / DT; i++) {
    if (g.phase === 'draft') {
      pickUpgrade(g, g.offer[0]);
      next = g.t + 4;
    }
    if (g.phase !== 'wave') break;
    if (g.t >= next) {
      g.slots = ['frigate'];
      g.pickups.push({ id: 900000 + i, kind: 'weapon', weapon: 'frigate', x: 800, y: 450, age: 0 });
      tap(g, 800, 450, 60);
      next = g.t + 20;
    }
    for (const s of g.ships) s.hp = 999;
    g.carrierHp = 999;
    const before = new Map(g.threats.map((th) => [th.id, th.dead] as const));
    step(g, DT);
    for (const th of g.threats) if (!seen.has(th.id)) seen.add(th.id);
    for (const it of g.interceptors) if (it.by === 'frigate' && !shots.has(it.id)) {
      shots.set(it.id, it.target ?? -1);
      t.shots++;
    }
    // A frigate shot gone this step whose target died this step.
    const live = new Set(g.interceptors.map((it) => it.id));
    for (const [id, target] of shots) {
      if (live.has(id)) continue;
      shots.delete(id);
      const th = g.threats.find((o) => o.id === target);
      if (before.get(target) === false && (!th || th.dead)) t.kills++;
    }
    const held = g.weapon?.id === 'frigate' || g.weapon2?.id === 'frigate';
    if (held) {
      const want = level >= 3 ? 3 : 2;
      t.loaded += DT * want;
      for (const e of g.escorts) if (!e.leaving && e.x >= 20 && e.x <= VIEW_W - 20 && e.y >= 20 && e.y <= VIEW_H - 20) t.firing += DT;
    }
  }
  t.spawned = seen.size;
  return t;
}

console.log('| Map | Frigate shots | Frigate kills | Threats spawned | Kills / threats | Coverage (in reach to fire) |');
console.log('|---|---|---|---|---|---|');
const all: Tally = { shots: 0, kills: 0, spawned: 0, firing: 0, loaded: 0 };
for (const map of maps) {
  const sum: Tally = { shots: 0, kills: 0, spawned: 0, firing: 0, loaded: 0 };
  for (const level of [1, 3])
    for (const form of ['pairs', 'spread'] as FormationId[])
      for (const seed of [1, 2]) {
        const r = run(map, level, form, seed);
        for (const k of Object.keys(sum) as (keyof Tally)[]) {
          sum[k] += r[k];
          all[k] += r[k];
        }
      }
  console.log(`| ${map} | ${sum.shots} | ${sum.kills} | ${sum.spawned} | ${((100 * sum.kills) / Math.max(1, sum.spawned)).toFixed(1)}% | ${((100 * sum.firing) / Math.max(1e-9, sum.loaded)).toFixed(1)}% |`);
}
console.log(`| **All** | ${all.shots} | ${all.kills} | ${all.spawned} | ${((100 * all.kills) / Math.max(1, all.spawned)).toFixed(1)}% | ${((100 * all.firing) / Math.max(1e-9, all.loaded)).toFixed(1)}% |`);
