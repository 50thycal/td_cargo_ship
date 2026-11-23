// Headless playtest runner.
//
// Plays whole campaigns with scripted bot personas — no browser, no rendering,
// no real time — and scores the results against the seesaw north star. This is
// the statistical half of playtesting: it answers "is the balance/economy
// working across many builds and seeds", which a single hand-played session
// cannot. It cannot answer "does this feel good" — that still needs a human.
//
// Usage:
//   npm run playtest                       # defaults: all personas × 8 seeds
//   npm run playtest -- --seeds 24         # more seeds = tighter averages
//   npm run playtest -- --rounds 20        # let campaigns run longer
//   npm run playtest -- --personas turtle,economist
//   npm run playtest -- --out playtest-out # where logs are written
//   npm run playtest -- --preset region.json  # a Region Workshop export
//
// Every campaign is written out as a TelemetryExport JSON — byte-identical in
// shape to the in-game "Download game log" export — so any single run can be
// handed straight to the `seesaw-eval` skill for a full hand-quality read.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTelemetryExport } from '../../src/sim/telemetry';
import {
  REGIONS,
  REGION_ORDER,
  regionDef,
  registerCustomRegion,
  type RegionDef,
} from '../../src/data/regions';
import {
  commanderLoadoutError,
  legacyLoadoutError,
  personaByName,
  PERSONAS,
  type Persona,
} from '../../src/sim/playtest/personas';
import { summarize, type CampaignAnalysis } from '../../src/sim/playtest/analyze';
import { maxRoundsFor, sweepCampaigns } from '../../src/sim/playtest/sweep';
import {
  compileRegion,
  migrateRegionAuthoring,
  toRegionDef,
  validateRegionAuthoring,
} from '../../src/data/regionAuthoring';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Options {
  seeds: number;
  /** Max rounds. 0 = derive from the region's own completion watermark, which
   *  is what a real run plays to. */
  rounds: number;
  personas: Persona[];
  region: string;
  /** A Region Workshop JSON export to sweep instead of a packaged region. */
  preset: string | null;
  outDir: string;
  writeLogs: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    seeds: 8,
    rounds: 0,
    personas: PERSONAS,
    // The fullest SHIPPING region, not the dev proving ground.
    //
    // This default used to be `openSeas`, via `newCampaign`. That region is
    // excluded from REGION_ORDER — no player can ever select it — and it fields
    // all seven enemy branches, starts with no escort and has no completion
    // watermark. Measured consequence: the same enemy budget split seven ways
    // never reached the attack-boat nodes, so across 524 bot rounds there were
    // ZERO boarding attempts, while a hand-played pirateNarrows run lost six
    // hulls to boarding in a single round. The sweep was balancing a game
    // nobody plays. Pass `--region openSeas` to get the old proving ground back
    // deliberately.
    region: 'pirateNarrows',
    preset: null,
    outDir: 'playtest-out',
    writeLogs: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = (): string => argv[++i] ?? '';
    switch (arg) {
      case '--seeds':
        opts.seeds = Math.max(1, parseInt(next(), 10) || opts.seeds);
        break;
      case '--rounds':
        opts.rounds = Math.max(1, parseInt(next(), 10) || opts.rounds);
        break;
      case '--region': {
        const id = next();
        if (!REGIONS[id]) {
          console.error(
            `Unknown region "${id}". Available: ${Object.keys(REGIONS).join(', ')}` +
              ` (shipping ladder: ${REGION_ORDER.join(' → ')})`,
          );
          process.exit(1);
        }
        opts.region = id;
        break;
      }
      case '--preset':
        opts.preset = next() || null;
        break;
      case '--out':
        opts.outDir = next() || opts.outDir;
        break;
      case '--no-logs':
        opts.writeLogs = false;
        break;
      case '--personas': {
        const names = next()
          .split(',')
          .map((n) => n.trim())
          .filter(Boolean);
        const picked: Persona[] = [];
        for (const name of names) {
          const p = personaByName(name);
          if (!p) {
            console.error(
              `Unknown persona "${name}". Available: ${PERSONAS.map((x) => x.name).join(', ')}`,
            );
            process.exit(1);
          }
          picked.push(p);
        }
        if (picked.length > 0) opts.personas = picked;
        break;
      }
      case '--help':
      case '-h':
        console.log(
          [
            'Straitwatch headless playtest runner',
            '',
            '  --seeds N       campaigns per persona (default 8)',
            '  --rounds N      max rounds per campaign (default: the region watermark)',
            '  --region ID     region to fight in (default pirateNarrows)',
            '  --preset FILE   sweep a Region Workshop JSON export instead',
            '  --personas a,b  subset of personas to run',
            '  --out DIR       output directory (default playtest-out)',
            '  --no-logs       skip per-campaign JSON, summary only',
            '',
            `Personas: ${PERSONAS.map((p) => p.name).join(', ')}`,
            `Regions:  ${Object.keys(REGIONS).join(', ')} (ladder: ${REGION_ORDER.join(' → ')})`,
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        break;
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length);
}
function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

const MARK = { pass: '[+]', warn: '[~]', fail: '[!]' } as const;

function printReport(
  summary: ReturnType<typeof summarize>,
  outDir: string,
  wroteLogs: boolean,
  region: RegionDef,
): void {
  const line = '─'.repeat(78);
  console.log(`\n${line}`);
  console.log(`STRAITWATCH PLAYTEST SWEEP — ${summary.campaigns} campaigns`);
  console.log(line);
  // The region is stated up front because it decides the enemy roster, the
  // starting state and whether the run has a win condition at all — reading a
  // sweep without knowing which one it played is how the harness drifted away
  // from the shipping game unnoticed.
  console.log(
    `  Region: ${region.name} (${region.id}) — branches ${region.enemyBranches.join(', ')};` +
      ` completion round ${region.completionRound >= 999 ? 'none' : region.completionRound}`,
  );

  // --- Per-persona ---------------------------------------------------------
  console.log('  WON = region cleared; WENT = cleared or reached the round cap; CASH = mean at the end');
  console.log(
    `\n${pad('PERSONA', 17)}${padLeft('RUNS', 5)}${padLeft('WON', 5)}${padLeft('WENT', 6)}${padLeft('ROUNDS', 7)}${padLeft('DELIV%', 7)}${padLeft('LOSSES', 7)}${padLeft('SCORE', 7)}${padLeft('CASH', 7)}${padLeft('HOARD', 6)}`,
  );
  console.log('─'.repeat(78));
  for (const p of summary.personas) {
    console.log(
      pad(p.persona, 17) +
        padLeft(`${p.campaigns}`, 5) +
        padLeft(`${Math.round(p.winRate * 100)}%`, 5) +
        padLeft(`${Math.round(p.survivalRate * 100)}%`, 6) +
        padLeft(`${p.meanRoundsSurvived}`, 7) +
        padLeft(`${p.meanDeliveredPct}`, 7) +
        padLeft(`${p.meanLosses}`, 7) +
        padLeft(`${p.meanScore}`, 7) +
        padLeft(`${p.finalCash.mean}`, 7) +
        padLeft(`${Math.round(p.hoardRate * 100)}%`, 6),
    );
  }
  const o = summary.overall;
  console.log(
    `\n  OVERALL: won ${Math.round(o.winRate * 100)}% · came through ${Math.round(o.survivalRate * 100)}% · ` +
      `${o.meanRoundsSurvived} rounds · ${o.meanDeliveredPct}% delivered · ${o.meanLosses} hulls lost · ` +
      `cash at end ${o.finalCash.mean} (${o.finalCash.min}–${o.finalCash.max})`,
  );

  // --- Signals -------------------------------------------------------------
  const rates = summary.overall.signalPassRates;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  console.log('\nNORTH-STAR SIGNALS (share of campaigns passing)');
  console.log('─'.repeat(78));
  console.log(`  Oscillation  ${pct(rates.oscillation)}   loss-cause mix shifts round to round`);
  console.log(`  Balance      ${pct(rates.balance)}   delivery oscillates in band, confidence wobbles`);
  console.log(`  Scarcity     ${pct(rates.scarcity)}   player is pressured but not overwhelmed`);

  console.log('\nHOW CAMPAIGNS ENDED');
  console.log('─'.repeat(78));
  const allEnds: Record<string, number> = {};
  for (const p of summary.personas) {
    for (const [reason, n] of Object.entries(p.endReasons)) {
      allEnds[reason] = (allEnds[reason] ?? 0) + n;
    }
  }
  for (const [reason, count] of Object.entries(allEnds).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(reason, 20)} ${count} campaign(s)`);
  }

  console.log('\nVERDICTS');
  console.log('─'.repeat(78));
  for (const [verdict, count] of Object.entries(summary.overall.verdicts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${pad(verdict, 20)} ${count} campaign(s)`);
  }

  // --- Enemy economy (measured) --------------------------------------------
  const en = summary.enemy;
  if (en.campaignsInstrumented > 0) {
    console.log('\nENEMY ECONOMY (measured, not inferred)');
    console.log('─'.repeat(78));
    console.log(
      `  ROI response rate     ${pct(en.roiResponseRate)}   below-average-ROI branches cut the next round`,
    );
    console.log(`  Top-spend pivots      ${en.meanPivotsPerCampaign} per campaign`);
    console.log(`  Budget scrapped       ${pct(en.meanScrapRate)}   (SEESAW wants low but non-zero)`);
    console.log(`  Final targeting rung  T${en.meanFinalTargetingTier} average`);
    const tops = Object.entries(en.topSpendBranches)
      .sort((a, b) => b[1] - a[1])
      .map(([b, n]) => `${b} (${n})`)
      .join(', ');
    console.log(`  Ever top spend        ${tops || 'none'}`);
  }

  // --- Loss attribution ----------------------------------------------------
  console.log('\nLOSSES BY ENEMY BRANCH (whole sweep)');
  console.log('─'.repeat(78));
  const totalLosses = Object.values(summary.overall.lossesByBranch).reduce((a, b) => a + b, 0);
  for (const [branch, count] of Object.entries(summary.overall.lossesByBranch).sort(
    (a, b) => b[1] - a[1],
  )) {
    const share = totalLosses > 0 ? Math.round((count / totalLosses) * 100) : 0;
    console.log(`  ${pad(branch, 20)} ${padLeft(`${count}`, 6)}  ${padLeft(`${share}%`, 5)}`);
  }

  // --- Findings ------------------------------------------------------------
  if (summary.findings.length > 0) {
    console.log('\nFINDINGS');
    console.log('─'.repeat(78));
    summary.findings.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  console.log('\nWHAT THIS SWEEP COULD NOT MEASURE');
  console.log('─'.repeat(78));
  summary.instrumentationNotes.forEach((n) => console.log(`  • ${n}`));

  console.log(`\nWrote ${wroteLogs ? 'per-campaign logs + ' : ''}summary to ./${outDir}/`);
  if (wroteLogs) {
    console.log('Hand any single <persona>-<seed>.json to the `seesaw-eval` skill for a deep read.');
  }
  console.log(`${line}\n`);
  void MARK;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
mkdirSync(opts.outDir, { recursive: true });

// A persona whose Commander loadout breaks the slot/point budget is a bug in
// the persona, and clamping it silently would make the build quietly different
// from what it claims to be. Fail before playing 66 campaigns with it.
const badLoadouts = opts.personas
  .flatMap((p) => [
    { name: p.name, error: commanderLoadoutError(p) },
    { name: p.name, error: legacyLoadoutError(p) },
  ])
  .filter((r) => r.error !== null);
if (badLoadouts.length > 0) {
  for (const { name, error } of badLoadouts) console.error(`Persona "${name}": ${error}`);
  process.exit(1);
}

// A Region Workshop export is compiled and registered exactly as the workshop
// does it, so a sweep here measures the same region the in-game panel would.
if (opts.preset) {
  const migrated = migrateRegionAuthoring(JSON.parse(readFileSync(opts.preset, 'utf8')));
  if (!migrated.ok || !migrated.def) {
    console.error(`Preset rejected: ${migrated.error}`);
    process.exit(1);
  }
  const v = validateRegionAuthoring(migrated.def, undefined, undefined, { packagedIds: REGION_ORDER });
  if (!v.ok) {
    for (const e of v.errors) console.error(`  ${e.message}`);
    console.error(`Preset "${migrated.def.id}" has ${v.errors.length} error(s) and is not playable.`);
    process.exit(1);
  }
  if (REGIONS[migrated.def.id]) {
    console.error(`Preset id "${migrated.def.id}" is a packaged region; export it under another id.`);
    process.exit(1);
  }
  registerCustomRegion(toRegionDef(compileRegion(migrated.def)));
  opts.region = migrated.def.id;
}

const region = regionDef(opts.region);
// Default the cap to the region's own completion watermark: a real run of
// pirateNarrows ENDS at round 10, and playing past it measures rounds no
// player ever sees. The proving ground's watermark is 999, so it still needs an
// explicit --rounds.
const maxRounds = maxRoundsFor(region, opts.rounds);

const analyses: CampaignAnalysis[] = [];
const started = Date.now();

for (const p of sweepCampaigns({
  regionId: opts.region,
  seeds: opts.seeds,
  personas: opts.personas,
  rounds: maxRounds,
})) {
  const { campaign, analysis } = p.last;
  analyses.push(analysis);
  if (opts.writeLogs) {
    const log = buildTelemetryExport(campaign, new Date().toISOString());
    writeFileSync(
      join(opts.outDir, `${analysis.persona}-${analysis.seed.replace(/^playtest-/, '')}.json`),
      JSON.stringify(log, null, 2),
      'utf8',
    );
  }
  const pctDone = Math.round((p.done / p.total) * 100);
  process.stdout.write(
    `\r  playing… ${p.done}/${p.total} (${pctDone}%)  last: ${analysis.persona} ${analysis.seed} → ` +
      `${analysis.roundsPlayed} rounds, ${analysis.meanDeliveredPct}% delivered      `,
  );
}
process.stdout.write('\r' + ' '.repeat(100) + '\r');

const summary = summarize(analyses, new Date().toISOString(), region);
writeFileSync(join(opts.outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
printReport(summary, opts.outDir, opts.writeLogs, region);
console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
