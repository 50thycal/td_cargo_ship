// Contact sheet of every upgrade card's illustration (round 10): one page in
// colour, one in greyscale, tiles at about phone size. Open them in a
// browser (or screenshot them) to check every card reads at a glance and
// none relies on colour alone.
//
//   npm run v2:cards -- [out-dir]      (default: card-sheet/)

import { mkdirSync, writeFileSync } from 'node:fs';
import { RESUPPLY, UPGRADES, type UpgradeId } from '../../src/v2/data/upgrades';
import { CARD_ART_IDS, cardArtSvg } from '../../src/v2/ui/cardArt';

const out = process.argv.slice(2).find((a) => a !== '--') ?? 'card-sheet';
mkdirSync(out, { recursive: true });
const name = (id: UpgradeId) => (id === 'resupply' ? RESUPPLY.name : UPGRADES[id].name);
const tile = (id: UpgradeId) => `<figure><div class="art">${cardArtSvg(id)}</div><figcaption>${name(id)}</figcaption></figure>`;
const page = (grey: boolean) =>
  `<!doctype html><meta charset=utf8><style>body{margin:0;background:#070d12;font:12px system-ui;color:#9fb3bd;padding:12px}` +
  `main{display:grid;grid-template-columns:repeat(6,190px);gap:10px}figure{margin:0}` +
  `.art{background:linear-gradient(#0f1a22,#0a141b);border:1px solid #26414f;border-radius:6px;width:190px;height:120px;display:flex}.art svg{width:100%;height:100%}` +
  `${grey ? 'body{filter:grayscale(1)}' : ''}</style><main>${CARD_ART_IDS.map(tile).join('')}</main>`;
writeFileSync(`${out}/sheet.html`, page(false));
writeFileSync(`${out}/sheet-grey.html`, page(true));
console.log(`wrote ${out}/sheet.html and ${out}/sheet-grey.html (${CARD_ART_IDS.length} cards)`);
