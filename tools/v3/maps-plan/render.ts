// Renders the V3 maps plan: one SVG per map (docs/design/v3-maps-plan/),
// the plan doc (docs/design/v3-maps-plan.md) and the review page.
//   npx vite-node tools/v3/maps-plan/render.ts -- [page-out.html]

import { mkdirSync, writeFileSync } from 'node:fs';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { SLOTS } from './content';
import { PROPOSED, type ProposedMap } from './proposed';
import { fromMapDef, renderMap } from './svg';
import { buildDoc, buildPage } from './page';

const DIR = 'docs/design/v3-maps-plan';
mkdirSync(DIR, { recursive: true });

export function layoutOf(id: string): ProposedMap {
  return (MAPS as Record<string, unknown>)[id] ? fromMapDef(MAPS[id as MapId]) : PROPOSED[id];
}

const svgs: Record<string, string> = {};
for (const s of SLOTS) {
  const m = layoutOf(s.id);
  if (!m) throw new Error(`no layout for ${s.id}`);
  svgs[s.id] = renderMap(m);
  writeFileSync(`${DIR}/${String(s.slot).padStart(2, '0')}-${s.id}.svg`, svgs[s.id]);
}
writeFileSync('docs/design/v3-maps-plan.md', buildDoc(layoutOf));
const out = process.argv.slice(2).find((a) => a.endsWith('.html'));
if (out) writeFileSync(out, buildPage(svgs, layoutOf));
console.log(`wrote ${SLOTS.length} SVGs to ${DIR}${out ? ` and ${out}` : ''}`);
