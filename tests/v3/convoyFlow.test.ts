// The convoy keeps moving on every map at every flow step (the player's
// Saltgate note: "The gates for the canal did not work"; at a flow above the
// default the first lock deadlocked and every ship froze for the rest of the
// run). docs/design/v3-saltgate-locks.md.
//
// No player input: every map in MAPS at every FLOW_STEPS step, from wave 1,
// ships and carrier unsinkable so nothing ends the run, drafts auto-picked
// (the first card). A stall is a stretch of more than STALL s with ships on
// the water and none delivered. The start of the run is excluded: the first
// ships need up to FIRST s to cross (Saltgate's two locks: ~70 s).

import { describe, expect, it } from 'vitest';
import { FLOW_STEPS } from '../../src/v3/data/config';
import { MAPS, type MapId } from '../../src/v3/data/maps';
import { createGame, pickUpgrade, setFlow, step } from '../../src/v3/sim/game';
import { laneLength } from '../../src/v3/sim/lanes';

const DT = 1 / 60;
/** Seconds of wave sim per map and flow step. */
const RUN = 150;
const STALL = 60;
const FIRST = 120;
/** The first delivery's limit on a map: FIRST, and a lane longer than the
 *  usual 1,700 px (the Delta's long river, log v69) the time its extra length takes
 *  at the convoy's own speed. */
const firstFor = (map: MapId): number => FIRST + Math.max(0, Math.max(...MAPS[map].channels.map(laneLength)) - 1700) / 40;

interface FlowRun {
  delivered: number;
  /** Seconds to the first delivery (null: none). */
  first: number | null;
  /** The longest stretch after it with ships on the water and no delivery. */
  worst: number;
}

function flowRun(map: MapId, flow: number): FlowRun {
  const g = createGame(map, 1, 1);
  g.tempo = { ...g.tempo, lossLimit: 1e9 };
  setFlow(g, flow);
  let t = 0;
  let last = 0;
  let delivered = 0;
  let first: number | null = null;
  let worst = 0;
  for (let i = 0; i < RUN / DT; i++) {
    if (g.phase === 'draft') pickUpgrade(g, g.offer[0]);
    if (g.phase !== 'wave') break;
    for (const s of g.ships) s.hp = 999;
    g.carrierHp = 999;
    step(g, DT);
    t += DT;
    if (g.delivered > delivered) {
      first ??= t;
      delivered = g.delivered;
      last = t;
    } else if (!g.ships.length) last = t;
    if (first !== null) worst = Math.max(worst, t - last);
  }
  // Still nothing in by the end: the whole run is the stretch.
  if (first === null && t > firstFor(map)) worst = t;
  return { delivered, first, worst };
}

describe('the convoy never stalls (every map, every flow step, no input)', () => {
  for (const map of Object.keys(MAPS) as MapId[]) {
    it(map, () => {
      const runs = FLOW_STEPS.map((_, flow) => flowRun(map, flow));
      const bad = runs
        .map((r, flow) => ({ flow, ...r }))
        .filter((r) => r.first === null || r.first > firstFor(map) || r.worst > STALL)
        .map((r) => `flow ${r.flow}: first delivery ${r.first === null ? 'never' : `${r.first.toFixed(0)} s`}, longest stall ${r.worst.toFixed(0)} s, ${r.delivered} delivered`);
      expect(bad).toEqual([]);
      // Every flow step delivers ships, and a faster flow never fewer.
      for (let f = 1; f < runs.length; f++) expect(runs[f].delivered, `${map} flow ${f}`).toBeGreaterThanOrEqual(runs[f - 1].delivered);
    });
  }
});
