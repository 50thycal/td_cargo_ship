// Saltgate Canal's Gatecrashers, round by round, as the report's bot plays
// the map card (log v42, docs/design/v3-ch2-saltgate.md): trucks sent, shot
// before their first salvo (or gone without firing), salvos and clusters
// fired, ships lost and the round's seconds. Also the trucks
// of waves 1-10 (`--waves`).
//   npx vite-node tools/v3/saltgate/boss.ts -- [--seeds=24] [--from=900]
//       [--armory=player|latest|none] [--waves]
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
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

type Row = { runs: number; trucks: number; early: number; salvos: number; clusters: number; lost: number; secs: number };
const rows = new Map<number, Row>();
const row = (w: number) => rows.get(w) ?? (rows.set(w, { runs: 0, trucks: 0, early: 0, salvos: 0, clusters: 0, lost: 0, secs: 0 }), rows.get(w)!);

for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('saltgate', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('saltgate', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  const seen = new Map<number, { wave: number; full: number; fired: number }>();
  const clusters = new Set<number>();
  let wave = -1;
  let lost0 = 0;
  let t0 = 0;
  while (!run.done) {
    if (g.wave !== wave && g.phase === 'wave') {
      if (wave >= 0 && (wave >= 11 || waves)) {
        const r = row(wave);
        r.lost += shipsSunk(g) - lost0;
        r.secs += g.t - t0;
      }
      wave = g.wave;
      lost0 = shipsSunk(g);
      t0 = g.t;
      if (wave >= 11 || waves) row(wave).runs += 1;
    }
    run.advance(1);
    if (g.wave < 11 && !waves) continue;
    for (const th of g.threats) {
      if (th.kind !== 'rocketTruck' || seen.has(th.id)) continue;
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
    for (const th of g.threats) if (th.kind === 'cluster' && !clusters.has(th.id) && seen.has(th.from ?? -1)) {
      clusters.add(th.id);
      row(g.wave).clusters += 1;
    }
  }
  if (wave >= 0 && (wave >= 11 || waves)) {
    const r = row(wave);
    r.lost += shipsSunk(g) - lost0;
    r.secs += g.t - t0;
  }
  for (const s of seen.values()) if (s.fired === 0) row(s.wave).early += 1;
}
console.log(`saltgate armory=${a}, ${n} seeds from ${from}`);
console.log('wave runs trucks shot-early salvos clusters lost secs (means a run)');
for (const [w, r] of [...rows].sort((x, y) => x[0] - y[0])) {
  const m = (v: number) => (v / Math.max(1, r.runs)).toFixed(2);
  console.log(`${w < 11 ? `w${w}` : `B${w - 10}`} ${r.runs} ${m(r.trucks)} ${m(r.early)} ${m(r.salvos)} ${m(r.clusters)} ${m(r.lost)} ${m(r.secs)}`);
}
