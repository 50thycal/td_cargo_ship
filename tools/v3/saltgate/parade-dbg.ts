// Saltgate Canal's Gatecrashers (log v62): the parade as it plays with
// nothing shot (every hull kept afloat), round by round: trucks, launches,
// the beats that played, and the launches a beat by pattern (how full the
// patterns read). For tuning the patterns' cadence:
//   npx vite-node tools/v3/saltgate/parade-dbg.ts -- [--seeds=8] [--parade=@file|<json>] [--truck=<json>]
import { readFileSync } from 'node:fs';
import { createGame, applyEncounters, step } from '../../../src/v3/sim/game';
import { ENCOUNTER_REV, SALTGATE_BOSS_ROUNDS, SALTGATE_TRUCK, paradeBeats, type ParadeRound } from '../../../src/v3/data/encounters';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const readJson = (v: string) => (v.startsWith('@') ? readFileSync(v.slice(1), 'utf8') : v);
if (opt('truck')) Object.assign(SALTGATE_TRUCK, JSON.parse(readJson(opt('truck')!)));
if (opt('parade')) (JSON.parse(readJson(opt('parade')!)) as Partial<ParadeRound>[]).forEach((p, k) => p && Object.assign(SALTGATE_BOSS_ROUNDS[k].parade!, p));
const seeds = Number(opt('seeds') ?? 8);
const DT = 1 / 60;
for (const wave of [11, 12, 13]) {
  const R = SALTGATE_BOSS_ROUNDS[wave - 11].parade!;
  const beats = paradeBeats(R);
  let trucks = 0;
  let shots = 0;
  let played = 0;
  let secs = 0;
  const by = new Map<string, number[]>();
  for (let seed = 200; seed < 200 + seeds; seed++) {
    const g = createGame('saltgate', seed, wave);
    applyEncounters(g, { rev: ENCOUNTER_REV, version: 'v1' });
    g.tempo = { ...g.tempo, lossLimit: 999 };
    let P = g.event?.parade;
    for (let i = 0; i < 80 / DT && g.phase === 'wave' && g.wave === wave; i++) {
      for (const s of g.ships) s.hp = 99;
      g.carrierHp = 1e6;
      step(g, DT);
      if (g.wave === wave && g.event?.parade) P = g.event.parade;
    }
    secs += g.eventLog.find((e) => e.wave === wave)?.seconds ?? 0;
    if (!P) continue;
    trucks += P.spawns.length;
    shots += P.shots.length;
    beats.forEach((b, i) => {
      const n = P!.shots.filter((s) => s.beat === i).length;
      if (n) played++;
      by.set(b.pattern, [...(by.get(b.pattern) ?? []), n]);
    });
  }
  const m = (v: number) => (v / seeds).toFixed(1);
  console.log(`round ${wave - 10}: trucks ${m(trucks)}, launches ${m(shots)}, beats played ${m(played)} of ${beats.length}, secs ${m(secs)}; a beat: ` + [...by].map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(', '));
}
