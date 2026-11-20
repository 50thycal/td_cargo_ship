// Measures for the 2026-11-20 playtest fixes (docs/design/v3-playtest-fixes.md),
// on the combo sweep's runs (tools/v3/combo-sweep/play.ts: a map's Test Lab
// card on its production setup, the "you" bot, the player's Armory, every
// wave played, seeds 900..):
//
//   npx vite-node tools/v3/playtest-fixes/measure.ts -- --what=shield [--seeds=12] [--maps=island,behemoth] [--hits=4,5,6]
//       the Shield alone (levelled to MAX): per activation, the hits it
//       stopped, how long it was up and whether it broke; ships lost a run.
//       --hits plays other hit counts (999,999,999: a shield that never
//       breaks, as before log v34).
//   npx vite-node tools/v3/playtest-fixes/measure.ts -- --what=foes [--seeds=12] [--maps=...]
//       the bot drafting for itself: attack helicopters (seconds from coming
//       in to their first volley, volleys fired, share shot down), torpedo
//       subs (torpedoes fired a sub), scavengers (share shot down, seconds
//       alive), and ships lost a run (tough: every wave played).

import { PLAYER_ARMORY } from '../bot-fit/measure';
import { playCombo } from '../combo-sweep/play';
import { AB } from '../../../src/v3/data/abilities';
import { THREATS } from '../../../src/v3/data/config';
import type { MapId } from '../../../src/v3/data/maps';
import type { Boost, Game, Threat } from '../../../src/v3/sim/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const what = opt('what') ?? 'shield';
const seeds = Number(opt('seeds') ?? 12);
const maps = (opt('maps') ?? 'island,behemoth').split(',') as MapId[];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r2 = (x: number) => Math.round(x * 100) / 100;
const hitsOpt = opt('hits');
if (hitsOpt) (AB.shield as unknown as { hits: number[] }).hits = hitsOpt.split(',').map(Number);

for (const map of maps) {
  if (what === 'shield') {
    const acts: { start: number; blocked: number; secs: number; broke: boolean }[] = [];
    const lost: number[] = [];
    for (let k = 0; k < seeds; k++) {
      let cur: Boost | null = null;
      let row: (typeof acts)[number] | null = null;
      const close = (g: Game) => {
        if (!row || !cur) return;
        row.blocked = row.start - (cur.hits ?? row.start);
        row.broke = (cur.hits ?? 1) <= 0;
        row.secs = cur.age;
        acts.push(row);
        row = null;
        cur = null;
        void g;
      };
      const run = playCombo({ map, seed: 900 + k, loadout: ['shield'], armory: PLAYER_ARMORY }, (g: Game) => {
        const b = g.boost?.id === 'shield' ? g.boost : null;
        if (b !== cur) {
          close(g);
          if (b) {
            cur = b;
            row = { start: b.hits ?? 0, blocked: 0, secs: 0, broke: false };
          }
        }
      });
      lost.push(run.lost.reduce((a, b) => a + b, 0));
    }
    const hist = new Map<number, number>();
    for (const a of acts) hist.set(a.blocked, (hist.get(a.blocked) ?? 0) + 1);
    const sorted = acts.map((a) => a.blocked).sort((a, b) => a - b);
    console.log(`${map}: Shield (hits ${AB.shield.hits.join('/')}), ${acts.length} activations over ${seeds} runs; hits stopped: mean ${r2(mean(sorted))}, median ${sorted[sorted.length >> 1]}, 75th % ${sorted[Math.floor(sorted.length * 0.75)]}; broke ${acts.filter((a) => a.broke).length}; up ${r2(mean(acts.map((a) => a.secs)))} s; ships lost a run (every wave) ${r2(mean(lost))}`);
    console.log(`  hits stopped per activation: ${[...hist.entries()].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${n}:${c}`).join(' ')}`);
  } else {
    const heli: { firstAfter: number; volleys: number; killed: boolean }[] = [];
    const subs: { fired: number }[] = [];
    const scav: { killed: boolean; alive: number }[] = [];
    const lost: number[] = [];
    let subHit = 0;
    for (let k = 0; k < seeds; k++) {
      const seen = new Map<number, { th: Threat; born: number; first: number }>();
      const run = playCombo({ map, seed: 900 + k, armory: PLAYER_ARMORY }, (g: Game) => {
        for (const th of g.threats) {
          if (th.kind !== 'attackHeli' && th.kind !== 'torpedoSub' && th.kind !== 'scavenger') continue;
          if (!seen.has(th.id)) seen.set(th.id, { th, born: g.t, first: -1 });
          const s = seen.get(th.id)!;
          if (th.kind === 'attackHeli' && s.first < 0 && (th.foe?.n ?? 0) > 0) s.first = g.t;
          if (th.kind === 'torpedoSub' && th.hp < (th.maxHp ?? THREATS.torpedoSub.hp)) subHit += 1;
        }
        for (const [id, s] of seen) {
          if (!s.th.dead) continue;
          seen.delete(id);
          const f = s.th.foe;
          const killed = s.th.hp <= 0;
          if (s.th.kind === 'attackHeli') heli.push({ firstAfter: s.first < 0 ? NaN : s.first - s.born, volleys: f?.n ?? 0, killed });
          else if (s.th.kind === 'torpedoSub') subs.push({ fired: f?.n ?? 0 });
          else scav.push({ killed, alive: g.t - s.born });
        }
      });
      lost.push(run.lost.reduce((a, b) => a + b, 0));
    }
    const fin = (xs: number[]) => xs.filter((x) => Number.isFinite(x));
    console.log(`${map} (${seeds} runs, the bot drafting for itself; ships lost a run, every wave played: ${r2(mean(lost))})`);
    console.log(`  attack helicopters: ${heli.length}; first volley ${r2(mean(fin(heli.map((h) => h.firstAfter))))} s after coming in (${heli.filter((h) => !Number.isFinite(h.firstAfter)).length} never fired); volleys ${r2(mean(heli.map((h) => h.volleys)))} each; shot down ${r2(mean(heli.map((h) => (h.killed ? 1 : 0))))}`);
    console.log(`  torpedo subs: ${subs.length}; torpedoes ${r2(mean(subs.map((s) => s.fired)))} a sub; steps with a sub hurt ${subHit}`);
    console.log(`  scavengers: ${scav.length}; shot down ${r2(mean(scav.map((s) => (s.killed ? 1 : 0))))}; alive ${r2(mean(scav.map((s) => s.alive)))} s`);
  }
}
