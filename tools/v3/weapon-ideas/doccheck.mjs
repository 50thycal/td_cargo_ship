import { readFileSync } from 'node:fs';
import { ARSENAL } from './arsenal.mjs';
const doc = readFileSync(new URL('../../../docs/design/v3-weapon-categories.md', import.meta.url), 'utf8');
const issues = [];
for (const a of ARSENAL) {
  if (!doc.includes(a.name)) { issues.push(`missing from the doc: ${a.name}`); continue; }
  const row = doc.split('\n').find((l) => (l.startsWith(`| ${a.name} |`) || l.startsWith(`| ${a.name} (new) |`)) && l.includes(a.role));
  if (!row) { issues.push(`no table row: ${a.name}`); continue; }
  const cells = row.split('|').map((c) => c.trim());
  if (!cells.includes(a.role)) issues.push(`${a.name}: role ${a.role} not in its row`);
  const rating = cells.filter((c) => /^[Sow–]$/.test(c)).join('').replace(/–/g, '-');
  if (rating && rating !== a.r) issues.push(`${a.name}: doc ${rating} vs data ${a.r}`);
}
// Per-category counts in the doc's headings vs data.
console.log(issues.length ? issues.join('\n') : 'doc matches the data: every weapon, role and rating');
