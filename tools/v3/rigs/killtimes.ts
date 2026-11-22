// When each rig falls in a played log, and how many of the player's shots
// it took (the Round 15 read: "you can see I have obliterated the oil rigs
// quick"). Replays the log with this build; a log of another version may
// drift from what was played.
//   npx vite-node tools/v3/rigs/killtimes.ts -- <log.json>
import { readFileSync } from 'node:fs';
import { setupGame, applyCommand, SIM_DT } from '../../../src/v3/sim/playlog';
import { step, type Game } from '../../../src/v3/sim/game';

const file = process.argv.slice(2).filter((a) => a !== '--')[0];
const log = JSON.parse(readFileSync(file, 'utf8'));
const g: Game = setupGame(log);
const cmds = log.commands;
let i = 0;
const seen = new Map<number, { born: number; wave: number; hp0: number; hits: number; tow: boolean }>();
for (let guard = 0; guard < 5_000_000; guard++) {
  while (i < cmds.length && cmds[i][0] <= g.steps) applyCommand(g, cmds[i++]);
  if (g.phase === 'lost' || g.phase === 'won') break;
  if (g.phase !== 'wave') {
    if (i >= cmds.length) break;
    if (cmds[i][0] > g.steps) break;
    continue;
  }
  const before = new Map(g.threats.filter((t) => t.kind === 'rig' && !t.dead).map((t) => [t.id, t.hp]));
  step(g, SIM_DT);
  const now = new Map(g.threats.filter((t) => t.kind === 'rig').map((t) => [t.id, t]));
  for (const [id, b] of before) {
    const t = now.get(id);
    if (t && !t.dead) continue;
    const s = seen.get(id) ?? { born: 0, wave: 0, hp0: 0, hits: 0, tow: false };
    console.log(`wave ${g.wave} t=${g.waveT.toFixed(1)}s: rig ${id}${s.tow ? ' (tow)' : ''} down, ${s.hp0} hp, ${s.hits + 1} damage steps, stood ${(g.t - s.born).toFixed(1)} s (from ${b.toFixed(1)} hp left)`);
  }
  for (const t of g.threats) {
    if (t.kind !== 'rig') continue;
    if (!seen.has(t.id)) seen.set(t.id, { born: g.t, wave: g.wave, hp0: t.hp, hits: 0, tow: t.tow !== undefined });
    const s = seen.get(t.id)!;
    const b = before.get(t.id);
    if (b !== undefined && t.hp < b) s.hits++;
  }
}
console.log('end', g.phase, 'wave', g.wave, 'lost', g.lost ?? '');
