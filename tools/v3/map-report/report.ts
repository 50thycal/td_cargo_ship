// A map's bot report (map rebuild phase 3, docs/design/v3-map-report.md): the
// measured checks of the map and wave rules and the numbers a session reads
// to design the map's waves.
//
//   npx vite-node tools/v3/map-report/report.ts -- --map=strait [--seeds=24]
//       [--kits=aimed,self | --kits=name:id+id+id,... | --kits=plan] [--armory=player|latest|plating]
//       [--persona=you] [--no-heat] [--out=tools/v3/map-report/results]
//       [--no-fun] [--fun-dice=3] [--fun-placebo]
//
// Plays the map's Test Lab card on its production setup (as versions.ts),
// by the "you" bot with no Armory upgrades (the baseline; --armory=player:
// the player's own, PLAYER_ARMORY), on seeds 900.., in four passes:
//   normal    the loss limit as in play: end wave, losses per wave over the
//             runs that reached it, the boss rounds; and the heat map's logs
//   tough     no loss limit, the carrier can't sink, so every seed plays
//             every wave: the per-wave curve, cliffs, close calls, budgets,
//             stretches, warning time
//   baseline  tough, with the card's encounters off: the budget's yardstick
//   kits      normal and tough again with the bot's taste set to each kit
// Writes results/<map>.json (every number), results/<map>.md (the report)
// and results/<map>-heat.html (the map-lab heat map of the normal runs).
// The fun measures (saves and tension, src/v3/sim/funMetrics.ts,
// docs/design/v3-fun-metrics.md) are read on the normal runs' logs.

import { mkdirSync, writeFileSync } from 'node:fs';
import { ABILITIES, type AbilityId } from '../../../src/v3/data/abilities';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { mapPlan } from '../../../src/v3/data/mapPlans';
import { REPORT_WAVES, STRETCH_NAMES, kitSummary, lookAt, mapReport, type KitSummary, type MapReport, type RunDigest } from '../../../src/v3/sim/mapReport';
import { playReportRun, type ReportPlayOpts } from '../../../src/v3/sim/mapReportPlay';
import { FUN, SAVE_NAMES, SHAPE_NAMES, funDigest, funOfLog, waveName, type FunDigest, type SaveKind } from '../../../src/v3/sim/funMetrics';
import type { PlayLog } from '../../../src/v3/sim/playlog';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');

/** The boss target on the bot's scale (docs/design/v3-bot-refit.md: on the
 *  Strait's and Harbor's boss rounds the bot reads harder than the player,
 *  so "about one a round" for the player is about two on the bot). */
const BOSS_TARGET: Partial<Record<MapId, number>> = { strait: 2, harbor: 2 };
/** A map's plan sets its own boss target on the bot's scale. */
const bossTarget = (map: MapId) => mapPlan(map)?.boss.botTarget ?? BOSS_TARGET[map] ?? 1;

async function kitList(spec: string | undefined, map?: MapId): Promise<{ kit: string; weapons: AbilityId[] }[]> {
  if (!spec) return [];
  // --kits=plan: the map's counter kit against its off-counter kit
  // (src/v3/data/mapPlans.ts).
  if (spec === 'plan') {
    const p = map ? mapPlan(map) : undefined;
    if (!p) throw new Error(`--kits=plan: no plan for ${map} in src/v3/data/mapPlans.ts`);
    return [
      { kit: 'counter', weapons: p.counters },
      { kit: 'off-counter', weapons: p.offCounter },
    ];
  }
  // versions.ts runs its own main unless told it is imported.
  process.env.V3_VERSIONS_IMPORT = '1';
  const { KITS } = await import('../map-lab/versions');
  return spec.split(',').map((part) => {
    const [name, list] = part.split(':');
    const weapons = (list ? list.split('+') : KITS[name]) as AbilityId[] | undefined;
    if (!weapons) throw new Error(`unknown kit ${name} (known: ${Object.keys(KITS).join(', ')}, or name:id+id+id)`);
    for (const id of weapons) if (!(id in ABILITIES)) throw new Error(`kit ${name}: unknown weapon ${id}`);
    return { kit: name, weapons };
  });
}

function pass(map: MapId, seeds: number[], o: ReportPlayOpts, logs?: PlayLog[]): RunDigest[] {
  return seeds.map((seed) => {
    const r = playReportRun(map, seed, { ...o, keepLog: !!logs });
    if (logs && r.log) logs.push(r.log);
    return r.digest;
  });
}

/** The fun measures on the normal runs' logs (and the placebo: the noise
 *  floor). */
function funPass(logs: PlayLog[], dice: number, placebo: boolean): { digests: FunDigest[]; dice: number; placebo?: FunDigest[] } {
  const digests = logs.map((l) => funDigest(funOfLog(l, { dice })));
  const bad = digests.filter((d) => !d.exact).length;
  if (bad) console.warn(`  fun: ${bad} of ${logs.length} logs did not replay exactly`);
  return { digests, dice, ...(placebo ? { placebo: logs.map((l) => funDigest(funOfLog(l, { dice, mode: 'placebo' }))) } : {}) };
}

const f = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));
const pct = (v: number) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : '–');
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const head = (cells: string[]) => `${row(cells)}\n${row(cells.map(() => '---'))}`;
const waveCols = (n: number, from = 1) => Array.from({ length: n }, (_, k) => `${k + from}`);

export function markdown(r: MapReport, meta: { persona: string; armory: string; date: string; command: string; heat: string | null }): string {
  const t = r.tough;
  const L: string[] = [];
  L.push(`# Bot report: ${r.name} (\`${r.map}\`)`);
  L.push('');
  L.push(`- Seeds: ${r.seeds.length} (${r.seeds[0]}–${r.seeds[r.seeds.length - 1]}); persona "${meta.persona}"; Armory: ${meta.armory}; threat scale ${r.threatScale}; built ${meta.date}.`);
  L.push(`- Setup: the map's Test Lab card, production setup (full map, its convoy policy, encounters v1 on).`);
  L.push(`- **normal** = the loss limit as in play (${r.normal.n} runs); **tough** = no loss limit and a carrier that can't sink, so every seed plays every wave (${t.n} runs). Each number says which.`);
  L.push(`- Made by \`${meta.command}\`.${meta.heat ? ` Heat map: \`${meta.heat}\`.` : ''}`);
  L.push('');
  L.push('## Checks');
  L.push('');
  L.push(head(['Rule', 'Check', 'Value', 'Target', 'Runs', 'Result']));
  for (const c of r.checks) L.push(row([`\`${c.rule}\``, c.name, c.value, c.target, c.from, c.verdict === 'FLAG' ? '**FLAG**' : c.verdict]));
  L.push('');
  L.push('## What to look at');
  L.push('');
  for (const line of lookAt(r)) L.push(`- ${line}`);
  L.push('');
  L.push('## Ships lost per wave');
  L.push('');
  L.push(`Normal: won ${pct(r.normal.won)}, mean end wave ${f(r.normal.endWave, 1)} (14 = won), ${f(r.normal.lost10, 1)} lost in waves 1–10, ${f(r.normal.lost15)} in waves 1–5${r.normal.lostBonus ? `, ${f(r.normal.lostBonus)} in bonus waves` : ''}. Tough: ${f(t.lost10, 1)} lost in waves 1–10.`);
  L.push('');
  L.push(head(['', ...waveCols(10), 'B1', 'B2', 'B3']));
  L.push(row(['tough, every run', ...t.lost.map((v) => f(v))]));
  L.push(row(['normal, runs that reached it', ...r.normal.lost.reachedMean.map((v) => f(v))]));
  L.push(row(['normal, mean over all runs', ...r.normal.lost.mean.map((v) => f(v))]));
  L.push(row(['normal, runs that reached it (n)', ...r.normal.lost.reached.map((v) => `${v}`)]));
  L.push('');
  L.push(`Biggest one-wave step up (tough, waves 2–10): wave ${t.cliff.step.wave}, +${f(t.cliff.step.up)}.`);
  L.push('');
  L.push('## Close calls per wave (tough)');
  L.push('');
  L.push('A threat aimed at a ship that came within 1.0 s of impact (the sim\'s time to impact, read every step) and was then destroyed.');
  L.push('');
  L.push(head(['', ...waveCols(10), 'B1', 'B2', 'B3']));
  L.push(row(['mean a run', ...t.close.map((v) => f(v, 1))]));
  L.push(row(['runs with ≥ 1', ...t.closeAny.map(pct)]));
  L.push('');
  L.push('## Wave budget (tough)');
  L.push('');
  L.push('Launches a wave: what a launcher sent (bases, trucks, subs, the air), not what split off another threat. The check compares the card with the same card\'s encounters off; the shared table × threat scale is shown for scale (aircraft, subs, trucks and the map\'s extras make the real count differ from it).');
  L.push('');
  L.push(head(['', ...waveCols(10)]));
  L.push(row(['launches (card)', ...t.launches.slice(0, 10).map((v) => f(v, 1))]));
  if (t.baseline) L.push(row(['launches (encounters off)', ...t.baseline.map((v) => f(v, 1))]));
  if (t.vsBaseline) L.push(row(['**ratio to encounters off**', ...t.vsBaseline.map((v) => (Math.abs(v - 1) > 0.15 ? `**${f(v)}**` : f(v)))]));
  L.push(row(['table × scale', ...t.table.map((v) => `${v}`)]));
  L.push(row(['ratio to table × scale', ...t.vsTable.map((v) => f(v))]));
  L.push('');
  L.push('## Losses by stretch (tough)');
  L.push('');
  L.push('Each lane cut in three by distance along it. Share of ship hull damage / of sinkings; waves 1–9 (outside wave 10 and the boss rounds), and all waves.');
  L.push('');
  L.push(head(['Lane', 'Waves', ...STRETCH_NAMES.map((s) => `${s} hull / sunk`), 'Hull pts a run', 'Hot', 'Cold']));
  for (const [which, rows] of [['1–9', t.stretchCore], ['1–13', t.stretchAll]] as const)
    for (const s of rows)
      L.push(row([s.lane < 0 ? 'all' : `${s.lane + 1}`, which, ...s.hpShare.map((v, k) => `${pct(v)} / ${pct(s.sunkShare[k])}`), f(s.hp, 1), `${STRETCH_NAMES[s.hot]}`, `${STRETCH_NAMES[s.cold]}${s.thin ? ' (thin)' : ''}`]));
  L.push('');
  L.push('## Warning time per wave (tough)');
  L.push('');
  L.push('Mean seconds to impact of each launch as it appeared (threats aimed at a hull, under 30 s).');
  L.push('');
  L.push(head(['', ...waveCols(10), 'B1', 'B2', 'B3']));
  L.push(row(['seconds', ...t.warning.map((v) => f(v, 1))]));
  L.push(row(['launches read', ...t.warningN.map((v) => `${v}`)]));
  L.push('');
  L.push(`Slope over waves 1–10: ${f(t.warningSlope)} s a wave.`);
  L.push('');
  L.push('## Boss rounds');
  L.push('');
  L.push(head(['', 'Round 1', 'Round 2', 'Round 3']));
  L.push(row(['normal, runs that reached it', ...r.boss.reachedMean.map((v) => f(v))]));
  L.push(row(['runs that reached it', ...r.boss.reached.map((v) => `${v}`)]));
  L.push(row(['tough, every run', ...r.boss.tough.map((v) => f(v))]));
  L.push('');
  if (r.fun) {
    const fu = r.fun;
    L.push('## Fun: saves and tension (provisional)');
    L.push('');
    L.push(`Read on the normal runs' logs, over the runs that reached each wave (docs/design/v3-fun-metrics.md). **Saves**: at each tap that finished a threat under ${FUN.scanTti} s from impact, each nuke, and each pickup grabbed with a threat under ${FUN.scanPickupTti} s away, the game is forked and played on by the "you" bot with and without it (${fu.dice} roll${fu.dice > 1 ? 's' : ''} of its dice); a save is a fork without it that loses at least one more ship to the threats in play. Big: it kept the run going, the last ship afloat, or came at the loss limit. Clutch: 0.5 s later would also have lost the ship. **Tension**: the danger on the board each second (each threat's damage over its target's hull × e^(−time to impact / ${FUN.tau} s)); hot ≥ ${FUN.hot}, calm < ${FUN.calm}.`);
    L.push('');
    const W = fu.waves;
    const cols = W.map((w) => waveName(w.wave));
    L.push(head(['', ...cols]));
    L.push(row(['runs', ...W.map((w) => `${w.n}`)]));
    L.push(row(['**saves a run**', ...W.map((w) => (w.n ? `**${f(w.saves, 1)}**` : '–'))]));
    L.push(row(['ships saved a run', ...W.map((w) => f(w.saved, 1))]));
    L.push(row(['big (stakes)', ...W.map((w) => f(w.big, 2))]));
    L.push(row(['clutch', ...W.map((w) => f(w.clutch, 2))]));
    L.push(row(['runs with no save', ...W.map((w) => pct(w.none))]));
    for (const k of Object.keys(SAVE_NAMES) as SaveKind[]) if (W.some((w) => w.kinds[k])) L.push(row([`  ${SAVE_NAMES[k]}`, ...W.map((w) => f(w.kinds[k] ?? 0, 2))]));
    if (fu.placebo) L.push(row(['noise floor (placebo)', ...fu.placebo.map((v) => f(v, 2))]));
    L.push(row(['tension peak', ...W.map((w) => f(w.peak, 2))]));
    L.push(row(['peaks', ...W.map((w) => f(w.peaks, 1))]));
    L.push(row(['release after a peak (s)', ...W.map((w) => f(w.releaseS, 1))]));
    L.push(row(['hot share', ...W.map((w) => pct(w.hotShare))]));
    L.push(row(['calm share', ...W.map((w) => pct(w.calmShare))]));
    L.push(row(['shape (most runs)', ...W.map((w) => (w.n ? `${SHAPE_NAMES[w.shape]} ${pct(w.shapes[w.shape] ?? 0)}` : '–'))]));
    L.push(row(['taps follow tension (r)', ...W.map((w) => f(w.tapR, 2))]));
    L.push('');
    L.push(`${fu.verdict.value}. ${fu.n} runs, ${(fu.ms / 1000).toFixed(0)} s of forks and replays.`);
    L.push('');
  }
  if (r.kits.length) {
    L.push('## Kits');
    L.push('');
    L.push('The bot\'s taste set to the kit (it takes these first when a draft offers them).');
    L.push('');
    L.push(head(['Kit', 'Weapons', 'Won', 'End wave', 'Lost 1–10 (normal)', 'Lost 1–10 (tough)', 'Boss r1 / r2 / r3 (reached)', 'Curve 1–10 (tough)']));
    for (const k of r.kits)
      L.push(row([k.kit, k.weapons.join(', '), pct(k.won), f(k.endWave, 1), f(k.lost10, 1), f(k.lost10Tough, 1), k.boss.map((v, i) => `${f(v)} (${k.bossReached[i]})`).join(' / '), k.curveTough.map((v) => f(v, 1)).join(' ')]));
    L.push('');
  }
  L.push('Read with docs/design/v3-map-report.md (what each number means and the bots\' known biases).');
  return `${L.join('\n')}\n`;
}

/** The map lab's layers the heat map keeps. */
const HEAT_LAYERS: string[] = ['damage', 'sources', 'launches', 'risk'];

async function heatMap(logs: PlayLog[], out: string, title: string): Promise<boolean> {
  try {
    const { buildPreview, renderPreview, LAYERS, SCOPES } = await import('../map-lab/preview');
    const [p] = buildPreview(logs);
    if (!p) return false;
    // The damage layer of the ten waves shows first; the buttons switch.
    // Pickups and exposure are left out (most of the page's weight, and
    // nothing a wave design reads).
    const keep = LAYERS.filter((l) => HEAT_LAYERS.includes(l.id));
    const parts = renderPreview(p).split(/(<g class="lay" data-layer="\w+" data-scope="\w+"(?: hidden)?>)/);
    let svg = parts[0];
    for (let i = 1; i < parts.length; i += 2) {
      const [, l, s] = /data-layer="(\w+)" data-scope="(\w+)"/.exec(parts[i])!;
      const body = parts[i + 1];
      // A group's own closing tag is the last one before the next group.
      if (HEAT_LAYERS.includes(l)) svg += `<g class="lay" data-layer="${l}" data-scope="${s}"${l === 'damage' && s === 'waves' ? '' : ' hidden'}>${body}`;
      else svg += body.slice(body.lastIndexOf('</g>') + 4);
    }
    const btn = (kind: string, id: string, name: string, on: boolean) => `<button data-${kind}="${id}"${on ? ' aria-pressed="true"' : ''}>${name}</button>`;
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>:root{color-scheme:dark}body{margin:0;padding:16px;background:#0f161d;color:#f0efec;font:15px system-ui,sans-serif}h1{font-size:20px;margin:0 0 8px}p{margin:4px 0 10px;color:#c3c2b7}
.bar{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}button{background:#1c2733;color:#f0efec;border:1px solid #3a4756;border-radius:6px;padding:6px 10px;font:inherit}button[aria-pressed=true]{background:#3987e5;border-color:#3987e5}
svg{width:100%;height:auto;display:block;border-radius:8px}</style></head><body>
<h1>${title}</h1><p>${logs.length} bot runs (normal loss limit), telemetry replayed through the map lab's preview (tools/v3/map-lab/preview.ts). Damage: where hulls were when hit, sized by hull points; a cross marks a sinking.</p>
<div class="bar">${keep.map((l) => btn('layer', l.id, l.name, l.id === 'damage')).join('')}</div>
<div class="bar">${SCOPES.map((s) => btn('scope', s.id, s.name, s.id === 'waves')).join('')}</div>
${svg}
<script>let L='damage',S='waves';const show=()=>{document.querySelectorAll('g.lay').forEach(g=>g.hidden=!(g.dataset.layer===L&&g.dataset.scope===S));document.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layer===L||b.dataset.scope===S)))};
document.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.layer)L=b.dataset.layer;if(b.dataset.scope)S=b.dataset.scope;show()});</script></body></html>
`;
    writeFileSync(out, html);
    return true;
  } catch (e) {
    console.warn(`heat map skipped: ${(e as Error).message}`);
    return false;
  }
}

/** Numbers to 3 places, NaN as null: the JSON stays small and diffable. */
const tidy = (_k: string, v: unknown) => (typeof v === 'number' ? (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null) : v);

async function main(): Promise<void> {
  const map = opt('map') as MapId | undefined;
  if (!map || !MAPS[map]) throw new Error(`--map=<id> is required (one of ${Object.keys(MAPS).join(', ')})`);
  const seeds = Array.from({ length: Number(opt('seeds') ?? 24) }, (_, k) => 900 + k);
  const persona = opt('persona') ?? 'you';
  // --armory=latest: the player's newest Armory (LATEST_ARMORY), written as
  // <map>-latest beside the others.
  const armoryOpt = opt('armory');
  const latestArmory = armoryOpt === 'latest';
  const playerArmory = armoryOpt === 'player';
  // --armory=plating: the player's other Armory on the Battery (PLATING_ARMORY).
  const platingArmory = armoryOpt === 'plating';
  const armory = latestArmory ? LATEST_ARMORY : playerArmory ? PLAYER_ARMORY : platingArmory ? PLATING_ARMORY : {};
  const outDir = opt('out') ?? 'tools/v3/map-report/results';
  const kits = await kitList(opt('kits'), map);
  const heat = !args.includes('--no-heat');
  const fun = !args.includes('--no-fun');
  const funDice = Number(opt('fun-dice') ?? 3);
  const t0 = Date.now();
  const base: ReportPlayOpts = { persona, armory };
  const logs: PlayLog[] = [];
  console.log(`${MAPS[map].name}: ${seeds.length} seeds, persona ${persona}, Armory ${latestArmory ? 'latest' : playerArmory ? 'player' : platingArmory ? 'plating' : 'none'}`);
  const normal = pass(map, seeds, base, heat || fun ? logs : undefined);
  console.log(`  normal   ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const funIn = fun ? funPass(logs, funDice, args.includes('--fun-placebo')) : undefined;
  if (fun) console.log(`  fun      ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const tough = pass(map, seeds, { ...base, tough: true });
  console.log(`  tough    ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const baseline = pass(map, seeds, { ...base, tough: true, noEncounters: true });
  console.log(`  baseline ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  const kitRows: KitSummary[] = kits.map((k) => {
    const s = kitSummary(k.kit, k.weapons, pass(map, seeds, { ...base, taste: k.weapons }), pass(map, seeds, { ...base, taste: k.weapons, tough: true }));
    console.log(`  kit ${k.kit} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    return s;
  });
  const report = mapReport({ map: MAPS[map], seeds, normal, tough, baseline, kits: kitRows, bossTarget: bossTarget(map), ...(funIn ? { fun: funIn } : {}) });
  mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const command = `npx vite-node tools/v3/map-report/report.ts -- ${args.join(' ')}`;
  // --armory=player writes beside the baseline's files, not over them.
  const name = `${map}${playerArmory ? '-player' : latestArmory ? '-latest' : platingArmory ? '-plating' : ''}${persona !== 'you' ? `-${persona}` : ''}`;
  const heatPath = `${outDir}/${name}-heat.html`;
  const heatOk = heat && (await heatMap(logs, heatPath, `${MAPS[map].name}: bot heat map`));
  if (report.fun) {
    const W = report.fun.waves;
    console.log(`\nFun (provisional), ${report.fun.n} normal runs, dice ${report.fun.dice}:`);
    console.log(`  wave        ${W.map((w) => waveName(w.wave).padStart(6)).join('')}`);
    console.log(`  saves a run ${W.map((w) => f(w.saves, 1).padStart(6)).join('')}`);
    console.log(`  big         ${W.map((w) => f(w.big, 2).padStart(6)).join('')}`);
    console.log(`  peak        ${W.map((w) => f(w.peak, 2).padStart(6)).join('')}`);
    console.log(`  hot         ${W.map((w) => pct(w.hotShare).padStart(6)).join('')}`);
    console.log(`  shape       ${W.map((w) => (w.n ? SHAPE_NAMES[w.shape].split(' ').map((x) => x[0]).join('') : '-').padStart(6)).join('')}`);
    if (report.fun.placebo) console.log(`  placebo     ${report.fun.placebo.map((v) => f(v, 2).padStart(6)).join('')}`);
  }
  const meta = { persona, armory: playerArmory ? `the player's (${JSON.stringify(PLAYER_ARMORY)})` : latestArmory ? `the player's latest (${JSON.stringify(LATEST_ARMORY)})` : platingArmory ? `the player's plating set (${JSON.stringify(PLATING_ARMORY)})` : 'none (baseline)', date, command, heat: heatOk ? heatPath : null };
  writeFileSync(`${outDir}/${name}.json`, `${JSON.stringify({ about: 'Bot report (docs/design/v3-map-report.md). Made by tools/v3/map-report/report.ts.', ...meta, waves: REPORT_WAVES, report }, tidy, 1)}\n`);
  writeFileSync(`${outDir}/${name}.md`, markdown(report, meta));
  console.log(`\n${row(['Rule', 'Check', 'Value', 'Target', 'Result'])}`);
  for (const c of report.checks) console.log(row([c.rule, c.name, c.value, c.target, c.verdict]));
  console.log(`\nwrote ${outDir}/${name}.json, ${outDir}/${name}.md${heatOk ? `, ${heatPath}` : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
