// How the player brought each rig down in a played log: when it fell, how
// long it stood, and what hit it, counted two ways: the hits of damage it
// took (as the log was played, v49) and the shots that would count under
// round 15's rule (SHOT_RIGS: one a shot, an area weapon once a rig a
// step, a flak cloud or burning row once a rig). The round 15 read of
// "you can see I have obliterated the oil rigs quick, especially with the
// power ups". Replays the log with telemetry.
//   npx vite-node tools/v3/rigs/killtimes.ts -- <log.json>
// (Run it on the build the log was played on, e.g. the base before round
// 15 for a v49 log: on a later build the replay drifts once a rig falls.)
import { readFileSync } from 'node:fs';
import { replay } from '../../../src/v3/sim/playlog';

const file = process.argv.slice(2).filter((a) => a !== '--')[0];
const log = JSON.parse(readFileSync(file, 'utf8'));
const g = replay(log, { telemetry: true });
type Ev = { k: string; s: number; t: number; id: number; kind: string; dmg?: number; by?: string; kill?: 1; w?: string };
const evs = ((g.tel as unknown as { events: Ev[] }).events ?? []).filter((e) => e.kind === 'rig');
const AREA = new Set(['blast', 'shrapnel', 'scatter', 'thermo', 'grapnel', 'orbital', 'gunship', 'droneScreen', 'reflect', 'well', 'airstrike']);
const per = new Map<number, { born: number; dmg: number; shots: number; by: Map<string, number>; steps: Set<string>; field: number }>();
for (const e of evs) {
  if (e.k === 'thr+') per.set(e.id, { born: e.t, dmg: 0, shots: 0, by: new Map(), steps: new Set(), field: -99 });
  if (e.k !== 'hurt') continue;
  const r = per.get(e.id) ?? { born: 0, dmg: 0, shots: 0, by: new Map(), steps: new Set(), field: -99 };
  per.set(e.id, r);
  r.dmg += e.dmg ?? 0;
  const by = e.by ?? 'other';
  r.by.set(by, (r.by.get(by) ?? 0) + (e.dmg ?? 0));
  // Under the rule: a flak cloud or burn row ticking on one rig counts once
  // (a run of ticks under 1.2 s apart is one cloud); an area weapon once a
  // step; a nuke 3; anything else one (a third for a seeker).
  if (by === 'flak' || by === 'burn') {
    if (e.t - r.field > 1.2) r.shots += 1;
    r.field = e.t;
  } else if (AREA.has(by)) {
    const key = `${e.s}:${by}`;
    if (!r.steps.has(key)) r.shots += 1;
    r.steps.add(key);
  } else if (by === 'nuke') r.shots += 3;
  else r.shots += Math.min(1, e.dmg ?? 1);
  if (e.kill) {
    const top = [...r.by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round(v)}`).join(', ');
    console.log(`t=${e.t.toFixed(0)}s rig ${e.id}: down after ${(e.t - r.born).toFixed(1)} s, ${Math.round(r.dmg)} hits of damage, ${r.shots.toFixed(1)} shots by round 15's count (${top})`);
  }
}
console.log('end', g.phase, 'wave', g.wave);
