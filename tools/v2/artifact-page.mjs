// Turn the Vite build of V2 into a Claude artifact page: a content-only HTML
// file (the artifact viewer supplies doctype/head/body) plus the built JS/CSS.
//   npm run build && node tools/v2/artifact-page.mjs <outDir>
// Prints the file list to publish alongside the page.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('usage: node tools/v2/artifact-page.mjs <outDir>');
const html = readFileSync('dist/v2.html', 'utf8');
const script = html.match(/<script type="module" crossorigin src="\.\/([^"]+)"/)?.[1];
const styles = [...html.matchAll(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)"/g)].map((m) => m[1]);
const preloads = [...html.matchAll(/<link rel="modulepreload" crossorigin href="\.\/([^"]+)"/g)].map((m) => m[1]);
if (!script) throw new Error('no module script in dist/v2.html');

const page = `<title>Straitwatch V2</title>
<style>:root{color-scheme:dark;background:#070d12}body{background:#070d12;color:#f4f1e8}</style>
${styles.map((s) => `<link rel="stylesheet" href="${s}">`).join('\n')}
<div id="app"></div>
<script type="module" src="${script}"></script>
`;
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'straitwatch-v2.html'), page);
const files = [script, ...styles, ...preloads];
for (const f of files) {
  mkdirSync(dirname(join(out, f)), { recursive: true });
  copyFileSync(join('dist', f), join(out, f));
}
console.log(JSON.stringify({ page: join(out, 'straitwatch-v2.html'), files }));
