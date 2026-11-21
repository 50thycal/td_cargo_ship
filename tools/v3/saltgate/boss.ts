// Saltgate Canal's Gatecrashers, round by round, as the report's bot plays
// the map card (docs/design/v3-ch2-saltgate.md): trucks sent (Rocket
// Trucks and, log v46, Missile Trucks), shot before their first salvo or
// missile (or gone without firing), salvos (a Missile Truck's missiles)
// and clusters fired, missiles shot down in the air, the most missiles in
// the air at once, ships lost and the round's seconds. Also the trucks of
// waves 1-10 (`--waves`).
//   npx vite-node tools/v3/saltgate/boss.ts -- [--seeds=24] [--from=900]
//       [--armory=player|latest|none] [--waves] [--rounds=<json>] [--truck=<json>]
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { SALTGATE_BOSS_ROUNDS, SALTGATE_TRUCK, VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { shipsSunk } from '../../../src/v3/sim/game';
import { LATEST_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 24);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const waves = args.includes('--waves');
// Tuning (log v46): `--rounds=<json>` puts these columns (BossRound
// `trucks`, one list a round) in place of the boss's own for this read.
const tryRounds = opt('rounds');
const tryTruck = opt('truck');
if (tryTruck) Object.assign(SALTGATE_TRUCK, JSON.parse(tryTruck));
if (tryRounds) (JSON.parse(tryRounds) as (typeof SALTGATE_BOSS_ROUNDS)[number]['trucks'][]).forEach((t, k) => (SALTGATE_BOSS_ROUNDS[k].trucks = t));

type Row = { runs: number; trucks: number; early: number; salvos: number; clusters: number; lost: number; secs: number; shot: number; peak: number };
const rows = new Map<number, Row>();
const row = (w: number) => rows.get(w) ?? (rows.set(w, { runs: 0, trucks: 0, early: 0, salvos: 0, clusters: 0, lost: 0, secs: 0, shot: 0, peak: 0 }), rows.get(w)!);

let wins = 0;
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('saltgate', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('saltgate', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  const seen = new Map<number, { wave: number; full: number; fired: number }>();
  const clusters = new Set<number>();
  // A Missile Truck's missiles in the air (id -> last age, flight), and the
  // most at once this wave.
  const lobs = new Map<number, { wave: number; age: number; dur: number }>();
  let peak = 0;
  let wave = -1;
  let lost0 = 0;
  let t0 = 0;
  while (!run.done) {
    if (g.wave !== wave && g.phase === 'wave') {
      if (wave >= 0 && (wave >= 11 || waves)) {
        const r = row(wave);
        r.lost += shipsSunk(g) - lost0;
        r.secs += g.t - t0;
        r.peak += peak;
      }
      peak = 0;
      wave = g.wave;
      lost0 = shipsSunk(g);
      t0 = g.t;
      if (wave >= 11 || waves) row(wave).runs += 1;
    }
    run.advance(1);
    if (g.wave < 11 && !waves) continue;
    for (const th of g.threats) {
      if ((th.kind !== 'rocketTruck' && th.kind !== 'missileTruck') || seen.has(th.id)) continue;
      seen.set(th.id, { wave: g.wave, full: th.foe?.n ?? 0, fired: 0 });
      row(g.wave).trucks += 1;
    }
    for (const [id, s] of seen) {
      const th = g.threats.find((o) => o.id === id);
      if (!th || !th.foe) continue;
      const fired = s.full - th.foe.n;
      if (fired > s.fired) {
        row(s.wave).salvos += fired - s.fired;
        s.fired = fired;
      }
    }
    for (const th of g.threats) if (th.kind === 'ballistic' && !th.dead && seen.has(th.from ?? -1)) lobs.set(th.id, { wave: lobs.get(th.id)?.wave ?? g.wave, age: th.age, dur: th.dur });
    for (const [id, l] of lobs) {
      if (g.threats.some((o) => o.id === id && !o.dead)) continue;
      // Gone before its flight was up: shot down.
      if (l.age < l.dur - 0.05) row(l.wave).shot += 1;
      lobs.delete(id);
    }
    peak = Math.max(peak, g.threats.filter((o) => o.kind === 'ballistic' && !o.dead && seen.has(o.from ?? -1)).length);
    for (const th of g.threats) if (th.kind === 'cluster' && !clusters.has(th.id) && seen.has(th.from ?? -1)) {
      clusters.add(th.id);
      row(g.wave).clusters += 1;
    }
  }
  if (wave >= 0 && (wave >= 11 || waves)) {
    const r = row(wave);
    r.lost += shipsSunk(g) - lost0;
    r.secs += g.t - t0;
    r.peak += peak;
  }
  for (const s of seen.values()) if (s.fired === 0) row(s.wave).early += 1;
  if (g.phase === 'won') wins += 1;
}
console.log(`saltgate armory=${a}, ${n} seeds from ${from}: won ${Math.round((wins / n) * 100)}%`);
console.log('wave runs trucks shot-early salvos/missiles clusters missiles-shot peak-in-air lost secs (means a run)');
for (const [w, r] of [...rows].sort((x, y) => x[0] - y[0])) {
  const m = (v: number) => (v / Math.max(1, r.runs)).toFixed(2);
  console.log(`${w < 11 ? `w${w}` : `B${w - 10}`} ${r.runs} ${m(r.trucks)} ${m(r.early)} ${m(r.salvos)} ${m(r.clusters)} ${m(r.shot)} ${m(r.peak)} ${m(r.lost)} ${m(r.secs)}`);
}
