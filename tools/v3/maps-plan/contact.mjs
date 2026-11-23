// Tile PNG screenshots into one contact sheet: node contact.mjs out.png a.png b.png ...
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [out, ...files] = process.argv.slice(2);
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;width:1600px">${files.map((f) => `<div style="color:#fff;font:14px sans-serif">${f.split('/').pop()}<img style="width:100%;display:block" src="data:image/png;base64,${readFileSync(f).toString('base64')}"></div>`).join('')}</body>`;
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
const p = await b.newPage({ viewport: { width: 1612, height: 900 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
