// Copy the palate-keys package into vendor/palate-keys.
//
// palate-keys (the touch keyboard) is developed in the Palate repo, under
// packages/palate-keys, and shared by every app and game. Run this to pull
// the current version in; commit the result. vendor/palate-keys/.source says
// which Palate commit it came from.
//
//   node tools/sync-keys.mjs                 # ../Palatte, or a fresh clone of 50thycal/Palatte
//   node tools/sync-keys.mjs ../Palatte      # a local checkout
//   node tools/sync-keys.mjs --ref some-branch
//   node tools/sync-keys.mjs --check         # exit 1 if vendor/ differs from the source

import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dest = join(root, 'vendor', 'palate-keys');
const args = process.argv.slice(2);
const check = args.includes('--check');
const refIdx = args.indexOf('--ref');
const ref = refIdx >= 0 ? args[refIdx + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith('--') && i !== refIdx + 1);

let repo = positional[0] ? resolve(positional[0]) : resolve(root, '..', 'Palatte');
let clone = null;
if (!existsSync(join(repo, 'packages', 'palate-keys'))) {
  clone = mkdtempSync(join(tmpdir(), 'palate-'));
  const url = process.env.PALATE_REPO ?? 'https://github.com/50thycal/Palatte.git';
  console.log(`No local checkout; cloning ${url}`);
  execFileSync('git', ['clone', '--quiet', '--depth', '1', ...(ref ? ['--branch', ref] : []), url, clone], { stdio: 'inherit' });
  repo = clone;
} else if (ref) {
  console.log(`(--ref ignored for a local checkout: ${repo} as it is now)`);
}

const src = join(repo, 'packages', 'palate-keys');
const sha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const version = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8')).version;
const KEEP = ['src', 'css', 'data', 'package.json', 'README.md', 'build-dictionary.py'];

function files(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, base));
    else out.push(p.slice(base.length + 1));
  }
  return out;
}

if (check) {
  let drift = 0;
  for (const k of KEEP) {
    const a = join(src, k);
    const list = statSync(a).isDirectory() ? files(a).map((f) => join(k, f)) : [k];
    for (const f of list) {
      const b = join(dest, f);
      if (!existsSync(b) || !readFileSync(b).equals(readFileSync(join(src, f)))) {
        console.log(`differs: ${f}`);
        drift++;
      }
    }
  }
  if (clone) rmSync(clone, { recursive: true, force: true });
  console.log(drift ? `${drift} file(s) differ from palate-keys ${version} (${sha.slice(0, 8)})` : `vendor/palate-keys matches ${version} (${sha.slice(0, 8)})`);
  process.exit(drift ? 1 : 0);
}

rmSync(dest, { recursive: true, force: true });
for (const k of KEEP) cpSync(join(src, k), join(dest, k), { recursive: true });
writeFileSync(join(dest, '.source'), JSON.stringify({ repo: '50thycal/Palatte', path: 'packages/palate-keys', commit: sha, version }, null, 2) + '\n');
if (clone) rmSync(clone, { recursive: true, force: true });
console.log(`vendor/palate-keys <- palate-keys ${version} (${sha.slice(0, 8)})`);
