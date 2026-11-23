// What each of the Citadel' waves 1-10 plans (its launches by kind, and the
// fire ships among its fast boats), on the map card's production setup
// (encounters v1, rev 4), against the shared wave (`only: []`).
//   npx vite-node tools/v3/citadel/waves.ts -- [--seeds=1,2,3] [--map=citadel]
import { ENCOUNTER_REV, type EncounterSetup } from '../../../src/v3/data/encounters';
import type { MapId } from '../../../src/v3/data/maps';
import { applyEncounters, createGame } from '../../../src/v3/sim/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'citadel') as MapId;
const seeds = (opt('seeds') ?? '1,2,3').split(',').map(Number);
const count = (setup: EncounterSetup | null, w: number, seed: number) => {
  const g = createGame(map, seed, w);
  if (setup) applyEncounters(g, setup);
  const out: Record<string, number> = {};
  for (const l of g.queue) if (l.at < 1e8) out[l.fire ? 'FIRESHIP' : l.kind] = (out[l.fire ? 'FIRESHIP' : l.kind] ?? 0) + 1;
  for (const r of g.raiderQueue) for (const u of r.units) out[`${r.kind}:${u.kind}`] = (out[`${r.kind}:${u.kind}`] ?? 0) + u.size;
  return out;
};
const fmt = (o: Record<string, number>) => Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(', ');
for (let w = 1; w <= 10; w++)
  for (const seed of seeds) {
    console.log(`w${w} s${seed} on:     ${fmt(count({ rev: ENCOUNTER_REV, version: 'v1' }, w, seed))}`);
    console.log(`w${w} s${seed} shared: ${fmt(count({ rev: ENCOUNTER_REV, version: 'v1', only: [] }, w, seed))}`);
  }
