// Saltgate Canal: a boss round (or a wave) played with nobody shooting and
// the ships kept afloat: when each truck sets out, parks, marks and fires.
//   npx vite-node tools/v3/saltgate/probe.ts -- [--wave=11] [--seed=208]
import { applyEncounters, createGame, step } from '../../../src/v3/sim/game';
import { truckMark } from '../../../src/v3/sim/foes';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const wave = Number(opt('wave') ?? 11);
const g = createGame('saltgate', Number(opt('seed') ?? 208), wave);
applyEncounters(g, { rev: 4, version: 'v1' });
g.tempo = { ...g.tempo, lossLimit: 999 };
g.carrierHp = 1e6;
const last = new Map<number, string>();
for (let i = 0; i < 70 * 60 && g.phase === 'wave' && g.wave === wave; i++) {
  for (const s of g.ships) s.hp = 99;
  step(g, 1 / 60);
  for (const t of g.threats.filter((o) => o.kind === 'rocketTruck')) {
    const m = truckMark(g, t);
    const st = `${t.dead ? 'dead' : `state ${t.foe?.state} n ${t.foe?.n}`}${m ? ` mark ${m.id}@${m.x.toFixed(0)}` : ''}`;
    if (last.get(t.id) !== st) console.log(`${g.waveT.toFixed(1)} truck ${t.id} (${t.x.toFixed(0)},${t.y.toFixed(0)}) ${st}`);
    last.set(t.id, st);
  }
}
console.log('event', g.event?.id, g.event?.run, 'phase', g.phase, 'wave', g.wave, 'ships', g.ships.map((s) => s.x.toFixed(0)).join(' '));
