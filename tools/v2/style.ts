// How a run was played, tap by tap: rhythm, aim, reaction, targeting. The
// same meter reads a human log and a watch-mode / bot log, so "does the
// bot play like me?" compares like with like (round 9).
//
//   npm run v2:style -- log.json [more.json …]     (pooled over the logs)
//   npm run v2:style -- --who=you|bot log.json …   (only one player's stretches)
//
// Human time is real seconds (game seconds ÷ the speed slider); the bot's is
// game seconds, since it plays as a person at 1× would, whatever the watch speed.

import { readFileSync } from 'node:fs';
import { continueEndless, createGame, pickUpgrade, setFlow, setFormation, step, tap, timeToImpact } from '../../src/v2/sim/game';
import { SIM_DT, type PlayLog } from '../../src/v2/sim/playlog';

export interface Style {
  taps: number;
  results: Record<string, number>;
  gap: number[];
  burst: number[];
  pause: number[];
  react: number[];
  /** Reaction by threat kind, and how many of each kind got no tap at all. */
  reactBy: Record<string, number[]>;
  untapped: Record<string, number>;
  aim: number[];
  inRange: number;
  urgent: number;
  rated: number;
  idle: number;
  flow: number;
  formation: number;
}

export const emptyStyle = (): Style => ({ taps: 0, results: {}, gap: [], burst: [], pause: [], react: [], reactBy: {}, untapped: {}, aim: [], inRange: 0, urgent: 0, rated: 0, idle: 0, flow: 0, formation: 0 });

/** Burst = taps under BURST_GAP apart. */
const BURST_GAP = 0.3;

export function styleOf(log: PlayLog, who: 'you' | 'bot' | 'all' = 'all', into = emptyStyle()): Style {
  const g = createGame(log.map, log.seed, log.firstWave, log.tempo);
  let control: 'you' | 'bot' = log.dev?.watch ? 'bot' : 'you';
  let speed = 1;
  let clock = 0;
  let lastTap = -1;
  let run = 0;
  const born = new Map<number, number>();
  const kinds = new Map<number, string>();
  const bornMine = new Set<number>();
  const reacted = new Set<number>();
  const cmds = log.commands;
  const last = log.summary?.steps ?? Infinity;
  const mine = () => who === 'all' || who === control;
  let i = 0;
  for (let guard = 0; guard < 5_000_000; guard++) {
    for (const th of g.threats)
      if (!born.has(th.id)) {
        born.set(th.id, clock);
        kinds.set(th.id, th.kind);
        if (mine()) bornMine.add(th.id);
      }
    while (i < cmds.length && cmds[i][0] <= g.steps) {
      const c = cmds[i++];
      switch (c[1]) {
        case 't': {
          if (mine()) {
            const s = into;
            s.taps++;
            if (lastTap >= 0) {
              const gap = clock - lastTap;
              s.gap.push(gap);
              if (gap < BURST_GAP) run++;
              else {
                s.burst.push(run + 1);
                s.pause.push(gap);
                run = 0;
              }
            }
            lastTap = clock;
            const live = g.threats.filter((t) => !t.dead);
            if (live.length) {
              const d = live.map((t) => Math.hypot(t.x - c[2], t.y - c[3]));
              const k = d.indexOf(Math.min(...d));
              s.aim.push(d[k]);
              if (d[k] <= c[4]) {
                s.inRange++;
                if (!reacted.has(live[k].id)) {
                  reacted.add(live[k].id);
                  const rt = clock - (born.get(live[k].id) ?? clock);
                  s.react.push(rt);
                  (s.reactBy[live[k].kind] ??= []).push(rt);
                }
              }
              const urgent = live.reduce((a, b) => (timeToImpact(g, b) < timeToImpact(g, a) ? b : a));
              s.rated++;
              if (urgent === live[k]) s.urgent++;
            } else s.idle++;
            const r = tap(g, c[2], c[3], c[4]);
            s.results[r] = (s.results[r] ?? 0) + 1;
          } else tap(g, c[2], c[3], c[4]);
          break;
        }
        case 'f':
          if (mine()) into.flow++;
          setFlow(g, c[2]);
          break;
        case 'm':
          if (mine()) into.formation++;
          setFormation(g, c[2]);
          break;
        case 'u':
          pickUpgrade(g, c[2], c[3]);
          break;
        case 'e':
          continueEndless(g);
          break;
        case 's':
          speed = c[2];
          break;
        case 'c':
          control = c[2];
          lastTap = -1;
          run = 0;
          break;
      }
    }
    if (g.steps >= last && i >= cmds.length) break;
    if (g.phase === 'lost') break;
    if (g.phase !== 'wave') {
      if (i >= cmds.length || cmds[i][0] > g.steps) break;
      continue;
    }
    clock += control === 'bot' ? SIM_DT : SIM_DT / speed;
    step(g, SIM_DT);
  }
  for (const id of bornMine) if (!reacted.has(id)) into.untapped[kinds.get(id)!] = (into.untapped[kinds.get(id)!] ?? 0) + 1;
  return into;
}

export function printKinds(label: string, s: Style): void {
  const ks = [...new Set([...Object.keys(s.reactBy), ...Object.keys(s.untapped)])].sort();
  console.log(
    `${label.padEnd(10)} ` +
      ks.map((k) => `${k} ${q(s.reactBy[k] ?? [], 0.5).toFixed(2)}s (${s.reactBy[k]?.length ?? 0} tapped/${s.untapped[k] ?? 0} not)`).join(' · '),
  );
}

export function q(a: number[], p: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** The headline numbers S1 compares. */
export function summarize(s: Style): Record<string, number> {
  const share = (k: string) => (s.results[k] ?? 0) / Math.max(1, s.taps);
  return {
    taps: s.taps,
    gapMed: q(s.gap, 0.5),
    burstMed: q(s.burst, 0.5),
    burstP90: q(s.burst, 0.9),
    pauseMed: q(s.pause, 0.5),
    pauseP90: q(s.pause, 0.9),
    reactMed: q(s.react, 0.5),
    reactP10: q(s.react, 0.1),
    reactP90: q(s.react, 0.9),
    aimMed: q(s.aim, 0.5),
    aimP90: q(s.aim, 0.9),
    inRange: s.inRange / Math.max(1, s.aim.length),
    urgent: s.urgent / Math.max(1, s.rated),
    fire: share('fire'),
    dry: share('dry'),
    pickup: share('pickup'),
    empty: share('empty'),
  };
}

export function printStyle(label: string, s: Style): void {
  const m = summarize(s);
  const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
  console.log(
    `${label.padEnd(10)} taps ${String(m.taps).padStart(5)} | gap ${f(m.gapMed)} burst ${f(m.burstMed, 0)}/${f(m.burstP90, 0)} pause ${f(m.pauseMed)}/${f(m.pauseP90)} | react ${f(m.reactP10)}/${f(m.reactMed)}/${f(m.reactP90)} | aim ${f(m.aimMed, 0)}/${f(m.aimP90, 0)} in ${f(m.inRange * 100, 0)}% | urgent ${f(m.urgent * 100, 0)}% | fire ${f(m.fire * 100, 0)} dry ${f(m.dry * 100, 0)} pick ${f(m.pickup * 100, 0)} empty ${f(m.empty * 100, 0)}`,
  );
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('style.ts')) {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const who = (args.find((a) => a.startsWith('--who='))?.split('=')[1] ?? 'all') as 'you' | 'bot' | 'all';
  const s = emptyStyle();
  for (const f of args.filter((a) => a.endsWith('.json'))) styleOf(JSON.parse(readFileSync(f, 'utf8')), who, s);
  printStyle(who, s);
}
