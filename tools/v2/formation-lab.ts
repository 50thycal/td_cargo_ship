// Formation lab: does each formation answer the raid it is meant to? A full
// convoy takes one oversized raid of a single theme, either undefended or
// defended by the average bot; we count ships sunk per formation over seeds.
//   npm run v2:formation-lab -- [seeds=12]

import { FORMATION_ORDER, type FormationId } from '../../src/v2/data/formations';
import type { ThreatKind } from '../../src/v2/data/config';
import { Bot, SKILLS } from '../../src/v2/sim/bot';
import { createGame, setFlow, setFormation, step } from '../../src/v2/sim/game';
import { SIM_DT } from '../../src/v2/sim/playlog';

const seeds = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);

const RAIDS: Record<string, ThreatKind[]> = {
  barrage: Array(7).fill('ballistic'),
  volley: Array(6).fill('guided'),
  swarm: Array(14).fill('drone'),
};
const DEFENDED: Record<string, ThreatKind[]> = {
  barrage: Array(12).fill('ballistic'),
  volley: Array(12).fill('guided'),
  swarm: Array(36).fill('drone'),
};

function trial(formation: FormationId, raid: ThreatKind[], seed: number, defend: boolean): { sunk: number; hp: number } {
  const bot = defend ? new Bot(SKILLS.average, seed) : null;
  const g = createGame('strait', seed);
  setFlow(g, 4);
  setFormation(g, formation);
  // Park the wave: nothing launches until the convoy fills the channel.
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  for (let i = 0; i < 60 * 22; i++) step(g, SIM_DT);
  const bases = g.map.bases.map((b, k) => k);
  g.queue = raid
    .map((kind, k) => ({ at: g.waveT + 0.3 + k * 0.4, kind, base: bases[(k + seed) % bases.length] }))
    .concat([{ at: 1e9, kind: 'drone', base: 0 }]);
  const hp0 = g.ships.reduce((s, o) => s + o.hp, 0);
  const lost0 = g.lost;
  for (let i = 0; i < 60 * 25; i++) {
    bot?.act(g);
    step(g, SIM_DT);
  }
  const sunk = g.lost - lost0;
  // Damage = hit points gone from ships still afloat + 3 per ship sunk (roughly).
  const hpNow = g.ships.reduce((s, o) => s + o.hp, 0);
  return { sunk, hp: Math.max(0, hp0 - hpNow) };
}

for (const defend of [false, true]) {
  console.log(`\nFormation lab — ${seeds} seeds, convoy at max flow, ${defend ? 'defended by the average bot (bigger raids)' : 'no defence'}`);
  console.log(`raid      ${FORMATION_ORDER.map((f) => f.padStart(16)).join('')}`);
  for (const [name, raid] of Object.entries(defend ? DEFENDED : RAIDS)) {
    const cells = FORMATION_ORDER.map((f) => {
      let sunk = 0;
      for (let s = 0; s < seeds; s++) sunk += trial(f, raid, 100 + s, defend).sunk;
      return `${(sunk / seeds).toFixed(2)} sunk`.padStart(16);
    });
    console.log(`${name.padEnd(9)} ${cells.join('')}`);
  }
}
