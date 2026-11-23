// Build src/v3/ui/noteModel.json: what the player writes, as counts.
//
//   npx vite-node tools/keys/note-model.ts -- notes.json [--dictionary path/to/words-en.txt]
//
// notes.json is an array of strings or { text } objects: the playtest notes
// (pause-menu notes, wave-rating notes, Test Lab verdict notes) pulled from
// the playtest log store (api/playlog.ts). The raw notes are not kept in the
// repo; only counts of words and short phrases that came up at least twice.

import { readFileSync, writeFileSync } from 'node:fs';
import { EXTRA_WORDS, fixText } from '../../src/v3/ui/noteWords';
import { gameWords } from '../../src/v3/ui/noteVocab';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dictIdx = args.indexOf('--dictionary');
const dictPath = dictIdx >= 0 ? args[dictIdx + 1] : 'vendor/palate-keys/data/words-en.txt';
const input = args.find((a, i) => !a.startsWith('--') && i !== (dictIdx >= 0 ? dictIdx + 1 : -1));
if (!input) throw new Error('usage: note-model.ts notes.json');

const raw = JSON.parse(readFileSync(input, 'utf8')) as (string | { text: string })[];
const texts = [...new Set(raw.map((r) => (typeof r === 'string' ? r : r.text).trim()).filter(Boolean))];
const dict = new Set(readFileSync(dictPath, 'utf8').split('\n').map((w) => w.trim()));
const allowed = new Set<string>([...dict, ...EXTRA_WORDS, ...gameWords()]);
const MIN = 2;

const words = new Map<string, number>();
const bi = new Map<string, Map<string, number>>();
const tri = new Map<string, Map<string, number>>();
const starters = new Map<string, number>();
const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const nest = (m: Map<string, Map<string, number>>, a: string, b: string) => {
  if (!m.has(a)) m.set(a, new Map());
  bump(m.get(a)!, b);
};

for (const text of texts) {
  const fixed = fixText(text).replace(/[‘’]/g, "'");
  // Sentences: a phrase never runs across a full stop.
  for (const sentence of fixed.split(/[.!?\n]+/)) {
    const toks = (sentence.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter((w) => allowed.has(w) || /'/.test(w));
    if (toks.length === 0) continue;
    bump(starters, toks[0]);
    toks.forEach((w, i) => {
      bump(words, w);
      if (i >= 1) nest(bi, toks[i - 1], w);
      if (i >= 2) nest(tri, `${toks[i - 2]} ${toks[i - 1]}`, w);
    });
  }
}

const keep = (m: Map<string, Map<string, number>>) =>
  Object.fromEntries(
    [...m]
      .map(([k, nx]) => [k, Object.fromEntries([...nx].filter(([, n]) => n >= MIN).sort((a, b) => b[1] - a[1]).slice(0, 8))] as const)
      .filter(([, nx]) => Object.keys(nx).length)
      .sort((a, b) => a[0].localeCompare(b[0])),
  );

const cap = (w: string) => (w === 'i' ? 'I' : w[0].toUpperCase() + w.slice(1));
const model = {
  notes: texts.length,
  words: Object.fromEntries([...words].filter(([, n]) => n >= MIN).sort((a, b) => b[1] - a[1])),
  starters: [...starters].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => cap(w)),
  bigrams: keep(bi),
  trigrams: keep(tri),
};
writeFileSync('src/v3/ui/noteModel.json', JSON.stringify(model) + '\n');
console.log(`${texts.length} notes → ${Object.keys(model.words).length} words, ${Object.keys(model.bigrams).length} bigram heads, ${Object.keys(model.trigrams).length} trigram heads; starters: ${model.starters.join(', ')}`);
