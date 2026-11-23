// The Test Lab's bridge to the review pages: from game logs (the playlog
// store's ?all=1 export, saved to a file), each card's latest verdict, by
// test round, as a document for the Test Lab page's `results/{cardId}` and,
// for enemy cards, the enemy page's `builds/{id}` (the grouping is
// src/v3/sim/labDocs.ts). Writes one JSON file per document, for
// ArtifactData batch writes (file_path).
// Usage: npx tsx tools/v3/test-lab/results.mts <logs.json> <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cardRev } from '../../../src/v3/data/lab';
import { labResultDocs } from '../../../src/v3/sim/labDocs';
import type { PlayLog } from '../../../src/v3/sim/playlog';
import { scoreLine } from '../../../src/v3/data/scorecard';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: results.mts <logs.json> <out-dir>');
const raw = JSON.parse(readFileSync(src, 'utf8'));
const logs: PlayLog[] = Array.isArray(raw) ? raw : (raw.logs ?? []);
const { results, builds } = labResultDocs(logs);
mkdirSync(`${out}/results`, { recursive: true });
mkdirSync(`${out}/builds`, { recursive: true });
const rows: string[] = [];
for (const [id, doc] of Object.entries(results)) {
  writeFileSync(`${out}/results/${id}.json`, JSON.stringify(doc, null, 1));
  const stale = doc.rev < cardRev(id) ? ' (changed since: retest)' : '';
  // A map card's line says how it was played (round 10: the full map or a quick slice).
  // A map card's full run (round 11): its version, numbers and scorecard.
  const auto = doc.auto ? `${doc.auto.deliveredPct ?? '-'}% delivered, ${doc.auto.lost} lost, first loss ${doc.auto.firstLoss ?? 'none'}` : '';
  const map = doc.variant ? ` {${[doc.variant, auto, scoreLine(doc.score)].filter(Boolean).join(' · ')}}${doc.runs && doc.runs.length > 1 ? ` [${doc.runs.length} full runs]` : ''}` : '';
  // A Watch run (log v65): the bot played it, all or part.
  const played = doc.played ? ` <${doc.played === 'sim' ? 'Watch: sim' : 'Watch: mixed'}>` : '';
  rows.push(`${id}: round ${doc.round} ${doc.verdict ?? 'tested'}${played}${doc.setup ? ` [${doc.setup}]` : ''}${map}${doc.note ? ` "${doc.note}"` : ''}${doc.history.length ? ` [+${doc.history.length} earlier]` : ''}${stale}`);
}
for (const [id, doc] of Object.entries(builds)) writeFileSync(`${out}/builds/${id}.json`, JSON.stringify(doc, null, 1));
console.log(`${rows.length} cards with a verdict:\n${rows.join('\n')}`);
