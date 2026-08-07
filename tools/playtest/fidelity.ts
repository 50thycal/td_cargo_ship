// Playtest FIDELITY harness (CLI) — does the bot sweep play the game the human
// plays?
//
// `npm run playtest` answers "is the balance working". It cannot answer the
// question that has to come first: **is the sweep measuring the same game the
// playtester is sitting in front of?** A balance number produced by bots that
// never salvage, never move an escort and never meet a boarding party is a
// confident answer about a game nobody plays.
//
// This is the thin I/O shell. The probe panel and every comparison rule live in
// `fidelityProbes.ts`, which is pure and unit-tested — the same split `run.ts`
// and `analyze.ts` already use.
//
// Usage:
//   npm run fidelity -- --human log.json                    # against playtest-out
//   npm run fidelity -- --human log.json --sweep out --json report.json
//   npm run fidelity -- --human a.json --human b.json --sweep out
//
// Run a MATCHED sweep first — the round cap has to equal the human log's round
// count, or every per-round rate drifts for reasons that are not fidelity:
//   npm run playtest -- --rounds <N> --seeds 6 --out playtest-out
//
// Reading the output:
//   MATCH        the bots do this about as much as the human does
//   DRIFT        same order of magnitude, worth watching
//   DIVERGENT    a real behavioural gap — the sweep is measuring something else
//   UNEXERCISED  one side does it and the other essentially never does
//
// The discipline this enforces: a DIVERGENT probe invalidates every balance
// conclusion that depends on it, and must be closed in the HARNESS (personas,
// run setup) before the number underneath it is trusted or tuned against.

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildReport, printReport, type Log } from './fidelityProbes';

function loadLog(path: string): Log {
  return JSON.parse(readFileSync(path, 'utf8')) as Log;
}

/** Every per-campaign log in a sweep output directory (summary.json is the
 *  aggregate, not a campaign, so it is skipped). The AFK control is dropped by
 *  default: it exists to mark the floor, it is not a playstyle, and averaging
 *  it into the bot side drags every engagement probe toward "does nothing". */
function loadSweep(dir: string, includeAfk: boolean): { logs: Log[]; droppedAfk: number } {
  const all = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'summary.json');
  const kept = includeAfk ? all : all.filter((f) => !f.startsWith('afk-'));
  return { logs: kept.map((f) => loadLog(join(dir, f))), droppedAfk: all.length - kept.length };
}

interface Options {
  humanPaths: string[];
  sweepDir: string;
  jsonOut: string | null;
  /** Drop the AFK control from the bot side: it is a floor marker, not a
   *  playstyle, and averaging it in drags every probe toward "does nothing". */
  includeAfk: boolean;
}

function parseArgs(argv: string[]): Options {
  const o: Options = {
    humanPaths: [],
    sweepDir: 'playtest-out',
    jsonOut: null,
    includeAfk: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const next = (): string => argv[++i] ?? '';
    switch (argv[i]) {
      case '--human':
        o.humanPaths.push(next());
        break;
      case '--sweep':
        o.sweepDir = next() || o.sweepDir;
        break;
      case '--json':
        o.jsonOut = next() || null;
        break;
      case '--include-afk':
        o.includeAfk = true;
        break;
      case '--help':
      case '-h':
        console.log(
          [
            'Straitwatch playtest fidelity check',
            '',
            '  --human PATH     hand-played game log (repeatable)',
            '  --sweep DIR      playtest output directory (default playtest-out)',
            '  --json PATH      also write the machine-readable report',
            '  --include-afk    keep the AFK control in the bot aggregate',
            '',
            'Run `npm run playtest -- --out DIR` first, matching --rounds to the',
            'number of rounds the human log actually played.',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        // A bare path is treated as a human log, so the common case is short.
        if (!argv[i].startsWith('--') && argv[i].endsWith('.json')) o.humanPaths.push(argv[i]);
        break;
    }
  }
  return o;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.humanPaths.length === 0) {
  console.error('No human log given. Usage: npm run fidelity -- --human <log.json> [--sweep DIR]');
  process.exit(1);
}
for (const p of opts.humanPaths) {
  if (!existsSync(p)) {
    console.error(`Human log not found: ${p}`);
    process.exit(1);
  }
}
if (!existsSync(opts.sweepDir) || !statSync(opts.sweepDir).isDirectory()) {
  console.error(
    `Sweep directory not found: ${opts.sweepDir}\n` +
      `Run it first, matching the human log's round count:\n` +
      `  npm run playtest -- --rounds <N> --out ${opts.sweepDir}`,
  );
  process.exit(1);
}

const humanLogs = opts.humanPaths.map(loadLog);
const { logs: botLogs, droppedAfk } = loadSweep(opts.sweepDir, opts.includeAfk);
if (botLogs.length === 0) {
  console.error(`No campaign logs in ${opts.sweepDir}`);
  process.exit(1);
}

const report = buildReport(humanLogs, botLogs, new Date().toISOString());
printReport(report);
if (droppedAfk > 0) {
  console.log(`  (excluded ${droppedAfk} AFK control campaign(s) from the bot side; --include-afk to keep)\n`);
}
if (opts.jsonOut) {
  writeFileSync(opts.jsonOut, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Wrote ${opts.jsonOut}\n`);
}
