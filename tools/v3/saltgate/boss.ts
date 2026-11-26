// Saltgate Canal's Gatecrashers, round by round, as the report's bot plays
// the map card (docs/design/v3-ch2-saltgate.md). Log v62, the parade (v71:
// ordinary trucks no shot hits): trucks sent, missiles fired and shot down in
// the air, the most in the air at once, ships lost, the round's seconds, and
// the ammo: shots fired, seconds with an empty rack, and the rack's lowest.
// Also the trucks of waves 1-10 (`--waves`).
//   npx vite-node tools/v3/saltgate/boss.ts -- [--seeds=24] [--from=900]
//       [--armory=player|latest|none] [--waves] [--parade=<json>] [--truck=<json>]
// `--parade=<json>`: a list (one a round) of ParadeRound fields merged over
// each round's own for this read; `--truck=<json>`: SALTGATE_TRUCK fields.
import { readFileSync } from 'node:fs';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { SALTGATE_BOSS_ROUNDS, SALTGATE_TRUCK, VERSION_DEFAULT, type ParadeRound } from '../../../src/v3/data/encounters';
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
const readJson = (v: string) => (v.startsWith('@') ? readFileSync(v.slice(1), 'utf8') : v);
const tryParade = opt('parade') && readJson(opt('parade')!);
const tryTruck = opt('truck') && readJson(opt('truck')!);
if (tryTruck) Object.assign(SALTGATE_TRUCK, JSON.parse(tryTruck));
if (tryParade) (JSON.parse(tryParade) as Partial<ParadeRound>[]).forEach((p, k) => p && Object.assign(SALTGATE_BOSS_ROUNDS[k].parade!, p));

type Row = { runs: number; trucks: number; early: number; killed: number; salvos: number; lost: number; secs: number; shot: number; peak: number; shots: number; dry: number; low: number };
const rows = new Map<number, Row>();
const row = (w: number) => rows.get(w) ?? (rows.set(w, { runs: 0, trucks: 0, early: 0, killed: 0, salvos: 0, lost: 0, secs: 0, shot: 0, peak: 0, shots: 0, dry: 0, low: 0 }), rows.get(w)!);

let wins = 0;
const DT = 1 / 60;
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('saltgate', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('saltgate', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  const seen = new Map<number, { wave: number; full: number; fired: number; gone: boolean; killed: boolean }>();
  // A Missile Truck's missiles in the air (id -> last age, flight), and the
  // most at once this wave.
  const lobs = new Map<number, { wave: number; age: number; dur: number }>();
  let peak = 0;
  let wave = -1;
  let lost0 = 0;
  let t0 = 0;
  let shots0 = 0;
  let dry = 0;
  let low = 99;
  const close = () => {
    if (wave >= 0 && (wave >= 11 || waves)) {
      const r = row(wave);
      r.lost += shipsSunk(g) - lost0;
      r.secs += g.t - t0;
      r.peak += peak;
      r.shots += g.shots - shots0;
      r.dry += dry;
      r.low += low;
    }
  };
  while (!run.done) {
    if (g.wave !== wave && g.phase === 'wave') {
      close();
      peak = 0;
      wave = g.wave;
      lost0 = shipsSunk(g);
      t0 = g.t;
      shots0 = g.shots;
      dry = 0;
      low = 99;
      if (wave >= 11 || waves) row(wave).runs += 1;
    }
    run.advance(1);
    if (g.wave < 11 && !waves) continue;
    if (g.phase === 'wave') {
      if (g.ammo < 1) dry += DT;
      low = Math.min(low, Math.floor(g.ammo));
    }
    // Log v71: the parade's trucks are raiders no shot can hit; count the
    // trucks sent and the missiles they fire (a missile gone before its
    // flight was up was shot down).
    for (const r of g.raiders) {
      if (r.kind !== 'parade' || seen.has(r.id)) continue;
      seen.set(r.id, { wave: g.wave, full: r.left ?? 0, fired: 0, gone: false, killed: false });
      row(g.wave).trucks += 1;
    }
    for (const [id, s] of seen) {
      const r = g.raiders.find((o) => o.id === id);
      if (!r) continue;
      const fired = s.full - (r.left ?? 0);
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
  }
  close();
  for (const s of seen.values()) {
    if (s.killed && s.fired === 0) row(s.wave).early += 1;
    if (s.killed) row(s.wave).killed += 1;
  }
  if (g.phase === 'won') wins += 1;
}
console.log(`saltgate armory=${a}, ${n} seeds from ${from}: won ${Math.round((wins / n) * 100)}%`);
console.log('wave runs trucks killed killed-before-firing missiles missiles-shot peak-in-air lost secs shots dry-s rack-low (means a run)');
for (const [w, r] of [...rows].sort((x, y) => x[0] - y[0])) {
  const m = (v: number) => (v / Math.max(1, r.runs)).toFixed(2);
  console.log(`${w < 11 ? `w${w}` : `B${w - 10}`} ${r.runs} ${m(r.trucks)} ${m(r.killed)} ${m(r.early)} ${m(r.salvos)} ${m(r.shot)} ${m(r.peak)} ${m(r.lost)} ${m(r.secs)} ${m(r.shots)} ${m(r.dry)} ${m(r.low)}`);
}
