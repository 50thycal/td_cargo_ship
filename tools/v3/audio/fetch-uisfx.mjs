// Fetch the uisfx sound library (CC0 audio, npm package uisfx) into
// assets-src/audio/uisfx/, pinned to one version so a rebuild gets the same
// files. The UI cues in src/v3/audio/manifest.ts (UISFX_SOURCE) come from it.
//   node tools/v3/audio/fetch-uisfx.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

export const UISFX_VERSION = '0.4.0';
const out = 'assets-src/audio/uisfx';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const url = `https://registry.npmjs.org/uisfx/-/uisfx-${UISFX_VERSION}.tgz`;
execFileSync('sh', ['-c', `curl -sSfL "${url}" | tar xz -C "${out}" --strip-components=1 package/sounds package/LICENSE-AUDIO package/README.md`], { stdio: 'inherit' });
console.log(`uisfx ${UISFX_VERSION} → ${out}`);
