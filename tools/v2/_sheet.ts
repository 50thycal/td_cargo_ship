import { writeFileSync } from 'node:fs';
import { CARD_ART_IDS, cardArtSvg } from '../../src/v2/ui/cardArt';
import { UPGRADES, RESUPPLY } from '../../src/v2/data/upgrades';
const out = process.argv[2];
const tile = (id: string) => `<figure><div class="art">${cardArtSvg(id as never)}</div><figcaption>${(UPGRADES as never as Record<string, { name: string }>)[id]?.name ?? RESUPPLY.name}</figcaption></figure>`;
const html = (grey: boolean) => `<!doctype html><meta charset=utf8><style>body{margin:0;background:#070d12;font:12px system-ui;color:#9fb3bd;padding:12px}main{display:grid;grid-template-columns:repeat(6,190px);gap:10px}figure{margin:0}.art{background:linear-gradient(#0f1a22,#0a141b);border:1px solid #26414f;border-radius:6px;width:190px;height:120px;display:flex}.art svg{width:100%;height:100%}${grey ? 'body{filter:grayscale(1)}' : ''}</style><main>${CARD_ART_IDS.map(tile).join('')}</main>`;
writeFileSync(`${out}/sheet.html`, html(false));
writeFileSync(`${out}/sheet-grey.html`, html(true));
