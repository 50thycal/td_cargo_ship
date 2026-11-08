// The Test Lab's bridge to the review pages: from game logs (the playlog
// store's ?all=1 export, saved to a file), each card's latest verdict as a
// document for the Test Lab page's `results/{cardId}` and, for enemy cards,
// the enemy page's `builds/{id}`. Writes one JSON file per document, for
// ArtifactData batch writes (file_path).
// Usage: npx tsx tools/v3/test-lab/results.mts <logs.json> <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { labCard } from '../../../src/v3/data/lab';
import { evidenceLines } from '../../../src/v3/sim/lab';
import type { PlayLog } from '../../../src/v3/sim/playlog';

const [src, out] = process.argv.slice(2);
if (!src || !out) throw new Error('usage: results.mts <logs.json> <out-dir>');
const raw = JSON.parse(readFileSync(src, 'utf8'));
const logs: PlayLog[] = Array.isArray(raw) ? raw : (raw.logs ?? []);
const latest = new Map<string, PlayLog>();
for (const l of logs) {
  if (!l.lab || !l.labResult) continue;
  const prev = latest.get(l.lab.card);
  if (!prev || (l.endedAt ?? l.startedAt) > (prev.endedAt ?? prev.startedAt)) latest.set(l.lab.card, l);
}
mkdirSync(`${out}/results`, { recursive: true });
mkdirSync(`${out}/builds`, { recursive: true });
const rows: string[] = [];
for (const [id, l] of latest) {
  const card = labCard(id);
  const r = l.labResult!;
  if (!card) continue;
  const doc = {
    verdict: r.verdict,
    tags: r.tags,
    note: r.note,
    evidence: evidenceLines(card, r.stats, r.waves).join(' · '),
    ended: r.ended,
    log: l.id,
    at: l.endedAt ?? l.startedAt,
  };
  writeFileSync(`${out}/results/${id}.json`, JSON.stringify(doc, null, 1));
  // An enemy card's verdict also goes on the enemy page's Build tab.
  if (card.kind === 'enemy' && r.verdict) writeFileSync(`${out}/builds/${id}.json`, JSON.stringify({ verdict: r.verdict, note: [r.note, r.tags.join(', ')].filter(Boolean).join(' · '), at: doc.at }, null, 1));
  rows.push(`${id}: ${r.verdict ?? 'tested'}${r.note ? ` "${r.note}"` : ''}`);
}
console.log(`${rows.length} cards with a verdict:\n${rows.join('\n')}`);
