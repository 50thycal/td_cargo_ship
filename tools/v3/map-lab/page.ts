// Builds the Map & Convoy Lab review page (round 1: slices 0 and 1).
//   npx vite-node tools/v3/map-lab/page.ts -- <out.html>
// Everything on it comes from review.mjs (the findings and questions), the
// stored baseline (tests/v3/fixtures/map-lab/manifest.json), the results
// files in tools/v3/map-lab/results/ (made by `v3:map-lab -- audit|bench
// --json=...`, the browser check and the cross-build check) and the
// baseline's own telemetry (preview.ts). Publish the file it writes as an
// Artifact with `capabilities: { db: {} }`.
//
// The store: `reviews/{id}` = { verdict: 'ok' | 'change' | null, note, at },
// `answers/{id}` = { choice, note, at }. Ids all start "ml1-" (round 1).

import { readFileSync, writeFileSync } from 'node:fs';
import { BASELINE, type BaselineResult } from '../../../src/v3/sim/mapLab';
import { TEL_SAMPLING, TEL_SCHEMA } from '../../../src/v3/sim/telemetry';
import { LOG_VERSION, type PlayLog } from '../../../src/v3/sim/playlog';
import { GRID, LAYERS, PLATFORMS, RAMPS, SCOPES, THIN, buildPreview, gridTop, renderPreview, type MapPreview, type Scope, type ScopeData } from './preview';
// @ts-expect-error a plain data module, shared with the notes
import { FINDINGS, GAPS, GROUPS, MAP_ITEMS, QUESTIONS, ROUND } from './review.mjs';

const R = 'tools/v3/map-lab/results';
const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8'));
const manifest = json<{ results: BaselineResult[] }>('tests/v3/fixtures/map-lab/manifest.json');
const audit = json<{ seeds: number; maps: number; runs: number; bad: number; hits: number; noSrc: number; events: number; byThreat: Record<string, number> }>(`${R}/audit.json`);
const bench = json<{
  runs: { id: string; steps: number; offMs: number; onMs: number; events: number; samples: number; bytes: number; gz: number; seconds: number }[];
  addPct: number; bytesPerSecond: number; gzPerSecond: number; samplingHz: number;
  sampling: { run: string; hz: number; cells: number; shipSeconds: number; worst: number; mean: number; misplaced: number }[];
}>(`${R}/bench.json`);
const cost = json<Record<string, { usPerStep: number; steps: number; events: number }>>(`${R}/browser-cost.json`);
const browser = json<{ touches: number; seconds: number; taps: number; launches: number; samples: number; events: number; bytes: number; digestLive: string; digestBrowserReplay: string; digestNodeReplay: string; viewport: string }>(`${R}/browser-run.json`);
const cross = json<{ runs: number; identical: boolean; base: string; compared: string }>(`${R}/crossbuild.json`);
const build = json<{ before: { kb: number; gz: number }; after: { kb: number; gz: number }; tests: { before: number; after: number; files: number } }>(`${R}/build.json`);

const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const table = (head: string[], rows: (string | number)[][], cls = '') =>
  `<div class="scroll"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i && typeof c === 'number' ? ' class="num"' : ''}>${typeof c === 'number' ? n(c) : c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const facts = (list: [string, string][]) => `<dl class="facts">${list.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;

const baseSteps = manifest.results.reduce((a, r) => a + r.steps, 0);
const frame = 1_000_000 / 60;

// ---- The evidence under each finding ---------------------------------------

const EVIDENCE: Record<string, () => string> = {
  equal: () =>
    facts([
      ['Baseline runs compared step by step', `${manifest.results.length} runs, ${n(baseSteps)} steps, 0 differences`],
      ['Audit runs, on all ' + audit.maps + ' maps', `${audit.runs} runs, ${audit.bad} with a difference`],
      ['Test Lab cards played both ways by a bot', 'every event card, every enemy and enemy-pair card, a map card on each kind of water, and every weapon in hand'],
    ]),
  crossbuild: () =>
    facts([
      ['Against the build before this change', `${cross.runs} bot runs (the twelve baseline recipes and ten more maps): ${cross.identical ? 'identical' : 'DIFFERENT'} ${esc(cross.compared)}`],
      ['Unit tests', `${build.tests.before} before, ${build.tests.after} now (${build.tests.files} files), all passing`],
    ]),
  reconcile: () =>
    facts([
      ['Hull hits in the audit', `${n(audit.hits)} hits, ${audit.noSrc} with no attacker named`],
      ['Events checked', `${n(audit.events)} across ${audit.runs} runs`],
      ['Self-check lines ("audit")', '0 in every run'],
      ['Baseline', `${n(manifest.results.reduce((a, r) => a + r.hits, 0))} hits removing ${n(manifest.results.reduce((a, r) => a + r.hpShip + r.hpCarrier, 0))} hull points; ${n(manifest.results.reduce((a, r) => a + r.pickups.spawned, 0))} pickups, each one taken, expired or cleared`],
    ]),
  browser: () =>
    facts([
      ['The run', `${browser.touches} touches in ${browser.seconds} s on a ${esc(browser.viewport)} touch screen: ${browser.taps} taps, ${browser.launches} launches, ${browser.samples} position samples`],
      ['Recorded live', `<code>${esc(browser.digestLive)}</code>`],
      ['Log replayed in the browser', `<code>${esc(browser.digestBrowserReplay)}</code>`],
      ['Log replayed under Node', `<code>${esc(browser.digestNodeReplay)}</code>`],
    ]),
  baseline: () =>
    table(
      ['Run', 'Bot', 'Armory', 'Ended', 'Wave', 'Delivered', 'Lost', 'Hull points', 'What it covers'],
      manifest.results.map((r) => {
        const b = BASELINE.find((o) => o.id === r.id)!;
        return [esc(r.id), b.persona, Object.keys(b.armory).length ? 'Wide Warhead 3' : 'base gun', esc(r.end ?? ''), r.wave, r.delivered, r.lost, r.hpShip + r.hpCarrier, esc(b.covers)];
      }),
    ),
  audit: () =>
    `<p class="muted">Hull hits in the audit by what dealt them (${n(audit.hits)} in all):</p><p class="chips">${Object.entries(audit.byThreat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span>${esc(k)} <b>${n(v)}</b></span>`).join('')}</p>`,
  gaps: () => table(['What', 'Before', 'Now'], (GAPS as string[][]).map((g) => g.map(esc))),
  phases: () => {
    const r = manifest.results.find((o) => o.id === 'strait-bonus')!;
    return `<p class="muted">The stretches of the baseline run that starts The Strait at wave 6 holding two passives:</p><p class="chips">${r.phases.map((p) => `<span>${esc(p)}</span>`).join('')}</p>`;
  },
  storage: () =>
    facts([
      ['Play log', `version ${LOG_VERSION}, unchanged; telemetry schema ${TEL_SCHEMA}`],
      ['Size of one run\'s telemetry', `${n(bench.bytesPerSecond / 1024, 1)} KiB of JSON per second of play (${n(bench.gzPerSecond / 1024, 2)} KiB zipped); the longest baseline run is ${n(Math.max(...bench.runs.map((r) => r.bytes)) / 1024)} KiB (${n(Math.max(...bench.runs.map((r) => r.gz)) / 1024)} KiB zipped)`],
      ['Sent anywhere', 'No. The log is what uploads, as before'],
    ]),
  sampling: () =>
    table(
      ['Run', 'Samples a second', 'Squares', 'Worst square', 'Average square'],
      bench.sampling.map((s) => [esc(s.run), s.hz === bench.samplingHz ? `<b>${s.hz}</b> (chosen)` : String(s.hz), s.cells, pct(s.worst), pct(s.mean, 2)]),
    ),
  cost: () =>
    facts([
      ['Time a step, full speed', `${cost['1x-off'].usPerStep} µs off, ${cost['1x-on'].usPerStep} µs on: ${pct((cost['1x-on'].usPerStep - cost['1x-off'].usPerStep) / frame, 2)} of a 60 fps frame`],
      ['Time a step, processor slowed 4x', `${cost['4x-off'].usPerStep} µs off, ${cost['4x-on'].usPerStep} µs on: ${pct((cost['4x-on'].usPerStep - cost['4x-off'].usPerStep) / frame, 2)} of a frame`],
      ['Headless replay', `${n(bench.addPct)}% slower with telemetry on`],
      ['The game\'s download', `${n(build.before.kb, 1)} kB before, ${n(build.after.kb, 1)} kB now (${n(build.before.gz, 1)} to ${n(build.after.gz, 1)} kB zipped)`],
      ['Sample rate', `${60 / TEL_SAMPLING.ship} a second for ships, ${60 / TEL_SAMPLING.threat} for threats`],
    ]),
};

const KIND: Record<string, string> = { measured: 'Measured', decision: 'Decision', found: 'Found' };

function verdicts(id: string, ok = 'Looks right', change = 'Change'): string {
  return `<div class="row"><div class="segs" role="group" aria-label="Your verdict"><button type="button" class="seg" data-verdict="ok" aria-pressed="false">${ok}</button><button type="button" class="seg" data-verdict="change" aria-pressed="false">${change}</button></div><span class="saved" aria-live="polite"></span></div>
<label class="note"><span>Notes</span><textarea id="n-${id}" rows="2" placeholder="Anything to change or check"></textarea></label>`;
}

const findings = (GROUPS as { id: string; name: string; blurb: string }[])
  .map((g) => {
    const items = (FINDINGS as { id: string; group: string; kind: string; title: string; says: string; evidence: string[] }[]).filter((f) => f.group === g.id);
    return `<div class="group"><div class="ghead"><h3>${esc(g.name)}</h3><p class="muted">${esc(g.blurb)}</p></div>${items
      .map(
        (f) => `<article class="item" data-id="${f.id}" id="${f.id}">
<header><span class="kind" data-kind="${f.kind}">${KIND[f.kind]}</span><h4>${esc(f.title)}</h4></header>
<p>${esc(f.says)}</p>
${f.evidence.map((e) => `<div class="ev">${EVIDENCE[e]()}</div>`).join('')}
${verdicts(f.id)}
</article>`,
      )
      .join('')}</div>`;
  })
  .join('');

// ---- The first maps ---------------------------------------------------------

// `--logs=a.json,b.json`: a report of those play logs alone (the maps and their numbers, nothing to mark).
const logArg = process.argv.slice(2).find((a) => a.startsWith('--logs='));
const reportLogs: PlayLog[] | undefined = logArg
  ? logArg.slice(7).split(',').flatMap((path) => {
      const raw = json<PlayLog | PlayLog[] | { logs: PlayLog[] }>(path);
      return (Array.isArray(raw) ? raw : 'logs' in raw ? raw.logs : [raw]).filter((l) => l.game === 'v3' && l.v === LOG_VERSION && !l.notesOnly && l.commands?.length);
    })
  : undefined;
const previews = buildPreview(reportLogs);
const per = (hp: number, min: number) => (min > 0.5 ? n(hp / min, 2) : 'too little');
/** A threat's kind as the sim names it, for the start of a sentence. */
const cap = (s: string) => `The ${s.replace(/([A-Z])/g, ' $1').toLowerCase()}`;

/** What stands out, in words, from the numbers (never retyped). */
function takeaways(p: MapPreview): string[] {
  const d = p.scopes.waves;
  const hp = d.hpShip + d.hpCarrier;
  const out: string[] = [];
  const [k1, k2] = d.byKind;
  if (k1) out.push(`${esc(cap(k1[0]))} did the most damage in the normal waves: ${n(k1[1])} of ${n(hp)} hull points (${pct(k1[1] / hp, 0)})${k2 ? `, then ${esc(k2[0])} with ${n(k2[1])}` : ''}.`);
  const eff = PLATFORMS.map((pl) => ({ pl, ...d.byPlatform[pl.id] })).filter((o) => o.launches > 0).sort((a, b) => b.hp / b.launches - a.hp / a.launches);
  if (eff.length > 1) out.push(`A launch from ${eff[0].pl.name.toLowerCase()} removed ${n(eff[0].hp / eff[0].launches, 2)} hull points on average; from ${eff[eff.length - 1].pl.name.toLowerCase()}, ${n(eff[eff.length - 1].hp / eff[eff.length - 1].launches, 2)}.`);
  const t = d.thirds;
  out.push(`Hull points lost per ship-minute, by third of the board from where ships enter: ${t.map((o) => per(o.hp, o.shipMinutes)).join(', ')}. Sinkings: ${t.map((o) => o.sunk).join(', ')}.`);
  const e = p.scopes.events;
  if (e.shipMinutes > 1) out.push(`In the map's event and the bonus wave: ${per(e.hpShip, e.shipMinutes)} hull points per ship-minute, against ${per(d.hpShip, d.shipMinutes)} in the normal waves.`);
  return out;
}

function statsTable(p: MapPreview): string {
  const row = (name: string, f: (d: ScopeData) => string | number) => [name, ...SCOPES.map((s) => f(p.scopes[s.id]))];
  return table(
    ['', ...SCOPES.map((s) => s.name)],
    [
      row('Minutes of play', (d) => n(d.seconds / 60, 1)),
      row('Ship-minutes afloat', (d) => n(d.shipMinutes)),
      row('Launches', (d) => d.launches),
      row('Hull hits', (d) => d.hits),
      row('Ship hull points removed', (d) => d.hpShip),
      row('Carrier hull points removed', (d) => d.hpCarrier),
      row('Hull points per ship-minute', (d) => per(d.hpShip, d.shipMinutes)),
      row('Ships sailed', (d) => d.sailed),
      row('Ships delivered', (d) => d.delivered),
      row('Ships sunk', (d) => d.sunk),
      ...PLATFORMS.map((pl) => row(`${pl.name}: launches, hull points`, (d) => `${n(d.byPlatform[pl.id].launches)}, ${n(d.byPlatform[pl.id].hp)}`)),
      row('Damage by attacker', (d) => d.byKind.slice(0, 5).map(([k, v]) => `${esc(k)} ${n(v)}`).join(', ') || 'none'),
      row('Pickups dropped', (d) => d.pickups.dropped),
      row('Pickups taken', (d) => `${n(d.pickups.taken)} (${d.pickups.dropped ? pct(d.pickups.taken / d.pickups.dropped, 0) : '0%'})`),
      row('Pickups expired, or cleared with the wave', (d) => `${n(d.pickups.expired)}, ${n(d.pickups.cleared)}`),
      row('Taps: fire, dry, pickup, empty', (d) => `${n(d.taps.fire)}, ${n(d.taps.dry)}, ${n(d.taps.pickup)}, ${n(d.taps.empty)}`),
    ],
    'stats',
  );
}

/** Each layer's key, for each scope (the grid layers' scales differ). */
function legends(p: MapPreview): string {
  const swatch = (pl: (typeof PLATFORMS)[number]) => {
    const s = pl.shape === 'circle' ? '<circle cx="9" cy="9" r="7"/>' : pl.shape === 'square' ? '<rect x="2.5" y="2.5" width="13" height="13" rx="2"/>' : '<polygon points="9,1.5 16.5,15.5 1.5,15.5"/>';
    return `<span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true" fill="${pl.color}">${s}</svg>${esc(pl.name)}</span>`;
  };
  const ramp = (kind: 'exposure' | 'risk', scope: Scope, unit: string) => {
    const top = gridTop(kind, p.scopes[scope]);
    return `<span class="ramp" aria-hidden="true">${RAMPS[kind].map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="mono">0 to ${n(top, top >= 10 ? 0 : 2)} ${unit}</span>`;
  };
  return SCOPES.flatMap((s) =>
    LAYERS.map((l) => {
      let key = '';
      if (l.id === 'launches' || l.id === 'sources') key = PLATFORMS.map(swatch).join('');
      else if (l.id === 'damage') key = '<span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="#ee8a5f"/></svg>hull points removed</span><span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="7" fill="#ee8a5f"/><path d="M5,5 L13,13 M13,5 L5,13" stroke="#0f161d" stroke-width="2.4"/></svg>a ship sank here</span>';
      else if (l.id === 'exposure') key = ramp('exposure', s.id, 'ship-seconds in a square');
      else if (l.id === 'risk') key = `${ramp('risk', s.id, 'hull points per ship-minute')}<span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" fill="none" stroke="currentColor" stroke-dasharray="3 2"/></svg>under ${THIN} ship-seconds: no rate</span>`;
      else key = '<span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="6.5" fill="#9ec5f4"/></svg>taken</span><span class="key"><svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><circle cx="9" cy="9" r="6" fill="none" stroke="#9ec5f4" stroke-width="2.4"/></svg>expired or cleared</span>';
      return `<div class="legend" data-layer="${l.id}" data-scope="${s.id}"${s.id === 'waves' && l.id === 'sources' ? '' : ' hidden'}><p>${esc(l.says)}</p><div class="keys">${key}</div></div>`;
    }),
  ).join('');
}

const maps = previews
  .map((p) => {
    const item = (reportLogs ? undefined : (MAP_ITEMS as { id: string; map: string; ask: string }[]).find((m) => m.map === p.map)) ?? { id: `report-${p.map}`, map: p.map, ask: '' };
    return `<article class="item map" data-id="${item.id}" id="${item.id}" data-map="${p.map}">
<header><span class="kind" data-kind="measured">${p.runs.length} ${reportLogs ? 'runs' : 'bot runs'}</span><h3>${esc(p.name)}</h3></header>
<ul class="take">${takeaways(p).map((t) => `<li>${t}</li>`).join('')}</ul>
<div class="controls">
  <div class="segs" role="group" aria-label="Which waves">${SCOPES.map((s, i) => `<button type="button" class="seg" data-pick-scope="${s.id}" aria-pressed="${i === 0}">${esc(s.name)}</button>`).join('')}</div>
  <div class="segs multi" role="group" aria-label="Which layer">${LAYERS.map((l) => `<button type="button" class="seg" data-pick-layer="${l.id}" aria-pressed="${l.id === 'sources'}">${esc(l.name)}</button>`).join('')}</div>
</div>
<figure class="board"><div class="pan">${renderPreview(p)}</div><figcaption class="muted">The game's own map (1600 x 900 world units, ${GRID.cell}-unit squares). Hover or focus a mark for its numbers; every number is also in the table below. Tap the map to enlarge it.</figcaption></figure>
${legends(p)}
<details><summary>The numbers behind this map</summary>${statsTable(p)}<p class="muted">From: ${p.runs.map((r) => esc(r.id)).join(', ')}.</p></details>
${reportLogs ? `<ul class="take muted">${p.runs.map((r) => `<li>${esc(r.id)}: ${esc(r.covers)}</li>`).join('')}</ul>` : `<p class="ask">${esc(item.ask)}</p>\n${verdicts(item.id, 'Reads right', 'Something is off')}`}
</article>`;
  })
  .join('');

const questions = (QUESTIONS as { id: string; text: string; why: string; options: string[] }[])
  .map(
    (q) => `<fieldset class="q" data-q="${q.id}" id="${q.id}"><legend>${esc(q.text)}</legend><p class="muted">${esc(q.why)}</p>
${q.options.map((o, i) => `<label class="opt"><input type="radio" name="q-${q.id}" id="q-${q.id}-${i}" value="${i}"><span>${esc(o)}</span></label>`).join('')}
<label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><span class="saved" aria-live="polite"></span></fieldset>`,
  )
  .join('');

const ITEM_IDS = [...(FINDINGS as { id: string }[]).map((f) => f.id), ...(MAP_ITEMS as { id: string }[]).map((m) => m.id)];
const Q_IDS = [...(QUESTIONS as { id: string }[]).map((q) => q.id), 'ml1-else'];

const css = `
/* Layout: one column of marked items under a sticky bar of three sections. */
:root {
  --bg: #f4f6f8; --surface: #ffffff; --ink: #14212b; --muted: #55677a; --line: #d5dde4;
  --accent: #9a6400; --accent-ink: #ffffff; --ok: #2f7a4a; --warn: #9a6400; --info: #2a6f97; --board: #0f161d;
  --display: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;
  --body: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0a161d; --surface: #10212b; --ink: #e6eef3; --muted: #93a6b3; --line: #22394a;
  --accent: #ffd166; --accent-ink: #1b1200; --ok: #8fe0a2; --warn: #ffd166; --info: #7cc4ea; --board: #0f161d; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0a161d; --surface: #10212b; --ink: #e6eef3; --muted: #93a6b3; --line: #22394a;
  --accent: #ffd166; --accent-ink: #1b1200; --ok: #8fe0a2; --warn: #ffd166; --info: #7cc4ea; --board: #0f161d; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 15px/1.55 var(--body); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--bg); }
.wrap { max-width: 980px; margin: 0 auto; padding-block: 28px 96px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 36px; }
h1, h2, h3, h4 { font-family: var(--display); font-weight: 700; letter-spacing: .01em; text-wrap: balance; margin: 0; line-height: 1.08; }
h1 { font-size: clamp(36px, 7vw, 58px); }
h2 { font-size: clamp(27px, 4.5vw, 36px); }
h3 { font-size: 25px; }
h4 { font-size: 21px; }
p { margin: 0; max-width: 68ch; }
code, .mono { font-family: var(--mono); font-variant-numeric: tabular-nums; font-size: .92em; }
.muted { color: var(--muted); }
.eyebrow { font: 600 12px/1.2 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
section { display: grid; gap: 18px; min-width: 0; }
.intro { display: grid; gap: 12px; }
.lede { font-size: 17px; }
.dbnote { font-size: 13px; color: var(--muted); }
.bar { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--bg); border-bottom: 1px solid var(--line); padding-block: 8px; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.bar a { font: 600 15px/1 var(--display); letter-spacing: .04em; text-transform: uppercase; text-decoration: none; padding: 8px 2px; color: var(--ink); border-bottom: 2px solid transparent; }
.bar a:hover, .bar a:focus-visible { border-bottom-color: var(--accent); }
.bar .tally { margin-left: auto; font-size: 13px; color: var(--muted); }
.group { display: grid; gap: 14px; min-width: 0; }
.ghead { display: grid; gap: 2px; }
.item { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 16px; display: grid; gap: 12px; min-width: 0; scroll-margin-top: 70px; }
.item > header { display: grid; gap: 6px; justify-items: start; }
.kind { font: 600 11px/1 var(--body); letter-spacing: .1em; text-transform: uppercase; padding: 4px 7px; border-radius: 4px; border: 1px solid currentColor; }
.kind[data-kind="measured"] { color: var(--ok); } .kind[data-kind="decision"] { color: var(--info); } .kind[data-kind="found"] { color: var(--warn); }
.ev { min-width: 0; display: grid; gap: 8px; }
.facts { margin: 0; display: grid; gap: 6px; }
.facts > div { display: grid; grid-template-columns: minmax(0, 15rem) minmax(0, 1fr); gap: 4px 14px; padding-top: 6px; border-top: 1px solid var(--line); }
.facts dt { color: var(--muted); } .facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
@media (max-width: 560px) { .facts > div { grid-template-columns: minmax(0, 1fr); } }
.scroll { overflow-x: auto; max-width: 100%; }
table { border-collapse: collapse; font-size: 13.5px; width: 100%; }
th, td { text-align: left; padding: 6px 10px 6px 0; border-top: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; white-space: nowrap; }
td.num { font-variant-numeric: tabular-nums; }
table.stats td:first-child { color: var(--muted); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; max-width: none; }
.chips span { border: 1px solid var(--line); border-radius: 999px; padding: 2px 9px; font-size: 13px; }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.segs { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; max-width: 100%; }
.segs.multi { flex-wrap: wrap; }
.segs.multi .seg { border-bottom: 1px solid var(--line); margin-bottom: -1px; }
.seg { font: 600 14px/1 var(--body); padding: 11px 13px; background: transparent; color: var(--ink); border: 0; border-right: 1px solid var(--line); cursor: pointer; min-height: 44px; }
.seg:last-child { border-right: 0; }
.seg[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); }
.seg[data-verdict="ok"][aria-pressed="true"] { background: var(--ok); color: var(--surface); }
.seg:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible, .mk:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.saved { font-size: 13px; color: var(--muted); }
.note { display: grid; gap: 4px; }
.note span { font-size: 12px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; }
textarea { font: inherit; color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; width: 100%; resize: vertical; }
.take { margin: 0; padding-left: 18px; display: grid; gap: 4px; max-width: 72ch; }
.controls { display: grid; gap: 8px; justify-items: start; }
.board { margin: 0; display: grid; gap: 6px; min-width: 0; }
.pan { overflow-x: auto; border-radius: 6px; background: var(--board); outline: 1px solid var(--line); }
.pan svg { display: block; width: 100%; height: auto; aspect-ratio: 16 / 9; }
.pan.big svg { width: 220%; max-width: none; }
.pan .mk { cursor: pointer; }
.pan .mk:hover > :first-child, .pan .mk:focus > :first-child { stroke: #f0efec; stroke-width: 5; }
.legend { display: grid; gap: 6px; }
.keys { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; font-size: 13.5px; }
.key { display: inline-flex; align-items: center; gap: 6px; }
.ramp { display: inline-flex; border-radius: 3px; overflow: hidden; outline: 1px solid var(--line); }
.ramp i { width: 18px; height: 12px; display: block; }
.tip { position: fixed; z-index: 20; pointer-events: none; background: var(--surface); color: var(--ink); border: 1px solid var(--line); border-radius: 6px; padding: 6px 9px; font-size: 13px; max-width: min(320px, 80vw); box-shadow: 0 6px 18px rgba(0, 0, 0, .25); }
details > summary { cursor: pointer; font-weight: 600; padding: 6px 0; }
.ask { font-weight: 600; }
.q { border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; margin: 0; display: grid; gap: 8px; background: var(--surface); min-width: 0; scroll-margin-top: 70px; }
.q legend { font: 700 20px/1.15 var(--display); padding: 0 6px; }
.opt { display: flex; gap: 10px; align-items: flex-start; padding: 8px 0; min-height: 44px; cursor: pointer; }
.opt input { margin-top: 4px; width: 18px; height: 18px; flex: none; accent-color: var(--accent); }
.how { font-size: 14px; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
`;

const script = `
(() => {
  const ITEMS = ${JSON.stringify(ITEM_IDS)};
  const QS = ${JSON.stringify(Q_IDS)};
  const state = { reviews: {}, answers: {} };
  let db = null;
  const LS = "straitwatch-map-lab-r1";
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

  function paintItem(id) {
    const r = state.reviews[id] || {};
    const card = document.getElementById(id);
    if (!card) return;
    card.querySelectorAll("[data-verdict]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.verdict === r.verdict)));
    const ta = document.getElementById("n-" + id);
    if (ta && document.activeElement !== ta && typeof r.note === "string") ta.value = r.note;
  }
  function paintQ(id) {
    const a = state.answers[id] || {};
    document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = String(a.choice) === i.value; });
    const ta = document.getElementById("qn-" + id);
    if (ta && document.activeElement !== ta && typeof a.note === "string") ta.value = a.note;
  }
  function paintTally() {
    const v = ITEMS.map((id) => (state.reviews[id] || {}).verdict).filter(Boolean);
    const ch = v.filter((x) => x === "change").length;
    const ans = QS.filter((id) => { const a = state.answers[id] || {}; return a.choice !== undefined && a.choice !== null || (id === "ml1-else" && a.note); }).length;
    document.getElementById("tally").textContent = v.length + " of " + ITEMS.length + " marked" + (ch ? " (" + ch + " to change)" : "") + " · " + ans + " of " + (QS.length - 1) + " questions answered";
  }
  function paintAll() { ITEMS.forEach(paintItem); QS.forEach(paintQ); paintTally(); }

  const flash = (el, msg) => { if (el) el.textContent = msg; };
  const busy = {};
  async function save(coll, id, body, statusEl) {
    state[coll][id] = Object.assign({}, state[coll][id], body);
    paintAll();
    const all = lsGet(); all[coll] = all[coll] || {}; all[coll][id] = Object.assign({}, state[coll][id], { pending: !db }); lsSet(all);
    if (!db) { flash(statusEl, "Saved in this browser only."); return; }
    if (busy[coll + id]) { busy[coll + id].again = true; return; }
    busy[coll + id] = { again: false };
    try {
      do {
        busy[coll + id].again = false;
        const doc = Object.assign({}, state[coll][id], { at: new Date().toISOString() });
        delete doc.pending;
        await db.collection(coll).doc(id).set(doc);
      } while (busy[coll + id].again);
      const kept = lsGet(); if (kept[coll] && kept[coll][id]) { kept[coll][id].pending = false; lsSet(kept); }
      flash(statusEl, "Saved.");
    } catch (e) {
      flash(statusEl, e && (e.code === "not_granted" || e.code === "permission_denied") ? "You can read this page but not save to it." : "Couldn't save. Check your connection and try again.");
    } finally { delete busy[coll + id]; }
  }

  document.querySelectorAll(".item").forEach((card) => {
    const id = card.dataset.id;
    const st = card.querySelector(".saved");
    const ta = document.getElementById("n-" + id);
    if (!ta) return;
    card.querySelectorAll("[data-verdict]").forEach((b) => b.addEventListener("click", () => {
      const cur = (state.reviews[id] || {}).verdict;
      save("reviews", id, { verdict: cur === b.dataset.verdict ? null : b.dataset.verdict, note: ta.value }, st);
    }));
    let t;
    ta.addEventListener("input", () => { clearTimeout(t); flash(st, "Typing…"); t = setTimeout(() => save("reviews", id, { note: ta.value }, st), 900); });
    ta.addEventListener("blur", () => { clearTimeout(t); if ((state.reviews[id] || {}).note !== ta.value && (ta.value || (state.reviews[id] || {}).note)) save("reviews", id, { note: ta.value }, st); });
  });
  document.querySelectorAll(".q").forEach((f) => {
    const id = f.dataset.q, st = f.querySelector(".saved");
    const ta = document.getElementById("qn-" + id);
    f.querySelectorAll("input[type=radio]").forEach((i) => i.addEventListener("change", () => save("answers", id, { choice: Number(i.value), note: ta.value }, st)));
    let t;
    ta.addEventListener("input", () => { clearTimeout(t); flash(st, "Typing…"); t = setTimeout(() => save("answers", id, { note: ta.value }, st), 900); });
    ta.addEventListener("blur", () => { clearTimeout(t); if ((state.answers[id] || {}).note !== ta.value && (ta.value || (state.answers[id] || {}).note)) save("answers", id, { note: ta.value }, st); });
  });

  // The maps: one layer and one scope at a time; a tooltip on each mark.
  const tipEl = document.createElement("div");
  tipEl.className = "tip"; tipEl.hidden = true; tipEl.setAttribute("role", "status");
  document.body.appendChild(tipEl);
  const showTip = (mk, x, y) => {
    const t = mk.querySelector("title");
    if (!t) return;
    tipEl.textContent = t.textContent;
    tipEl.hidden = false;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + "px";
    tipEl.style.top = Math.max(8, y - h - 12 < 8 ? y + 16 : y - h - 12) + "px";
  };
  document.querySelectorAll(".map").forEach((card) => {
    const pick = { layer: "sources", scope: "waves" };
    try { const kept = JSON.parse(localStorage.getItem(LS + "-view") || "{}"); if (kept.layer) pick.layer = kept.layer; if (kept.scope) pick.scope = kept.scope; } catch {}
    const paint = () => {
      // (An SVG group has no \`hidden\` property: the attribute is what the page's CSS reads.)
      card.querySelectorAll("[data-layer]").forEach((el) => { el.toggleAttribute("hidden", !(el.dataset.layer === pick.layer && el.dataset.scope === pick.scope)); });
      card.querySelectorAll("[data-pick-layer]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pickLayer === pick.layer)));
      card.querySelectorAll("[data-pick-scope]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.pickScope === pick.scope)));
    };
    card.querySelectorAll("[data-pick-layer]").forEach((b) => b.addEventListener("click", () => { pick.layer = b.dataset.pickLayer; paint(); try { localStorage.setItem(LS + "-view", JSON.stringify(pick)); } catch {} }));
    card.querySelectorAll("[data-pick-scope]").forEach((b) => b.addEventListener("click", () => { pick.scope = b.dataset.pickScope; paint(); try { localStorage.setItem(LS + "-view", JSON.stringify(pick)); } catch {} }));
    paint();
    const pan = card.querySelector(".pan");
    pan.addEventListener("pointermove", (e) => { const mk = e.target.closest && e.target.closest(".mk"); if (mk) showTip(mk, e.clientX, e.clientY); else tipEl.hidden = true; });
    pan.addEventListener("pointerleave", () => { tipEl.hidden = true; });
    pan.addEventListener("focusin", (e) => { const mk = e.target.closest && e.target.closest(".mk"); if (mk) { const r = mk.getBoundingClientRect(); showTip(mk, r.left + r.width / 2, r.top); } });
    pan.addEventListener("focusout", () => { tipEl.hidden = true; });
    pan.addEventListener("click", (e) => {
      const mk = e.target.closest && e.target.closest(".mk");
      if (mk) { showTip(mk, e.clientX, e.clientY); return; }
      pan.classList.toggle("big");
    });
  });

  // This browser's copy first, then the shared store.
  const local = lsGet();
  Object.assign(state.reviews, local.reviews || {});
  Object.assign(state.answers, local.answers || {});
  paintAll();
  const note = document.getElementById("dbnote");
  const use = window.claude && window.claude.use;
  if (!use) { note.textContent = "Open this page on claude.ai, signed in, to save your marks for the next session. Marks made here stay in this browser."; return; }
  const timer = setTimeout(() => { note.textContent = "The review store isn't answering yet. Marks you make are kept in this browser until it does."; }, 10000);
  use("db").then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = "Saving isn't available in this view. Marks stay in this browser."; return; }
    db = d;
    note.textContent = "Your marks save to this page for the next session to read.";
    let first = 2;
    for (const coll of ["reviews", "answers"]) {
      db.collection(coll).onSnapshot((snap) => {
        clearTimeout(timer);
        snap.docs.forEach((doc) => { const v = doc.data(); if (v) state[coll][doc.id] = v; });
        // Marks made before the store answered go up once, and never over a newer answer.
        if (first > 0) {
          first -= 1;
          const kept = lsGet()[coll] || {};
          const there = new Set(snap.docs.map((doc) => doc.id));
          Object.keys(kept).forEach((id) => { if (kept[id].pending && !there.has(id)) save(coll, id, kept[id], null); });
        }
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = "Lost the connection to the review store. Reload to try again."; });
    }
  }, () => { clearTimeout(timer); note.textContent = "Saving isn't available in this view. Marks stay in this browser."; });
})();
`;

const html = `<title>Map & Convoy Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>${css}</style>
<main class="wrap">
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · Map &amp; Convoy Lab · round ${ROUND.n} · ${ROUND.date}</div>
    <h1>The baseline and the telemetry</h1>
    <p class="lede">Slices 0 and 1 of the plan are built: twelve fixed runs to compare against, and a record of where and why damage happens. Nothing about combat, the convoy controls or the maps was changed. Mark each result, look at the first maps, and answer the questions. The next session reads your marks before it builds the heatmap viewer.</p>
    <p class="dbnote" id="dbnote">Connecting to the review store…</p>
  </header>
  <nav class="bar" aria-label="Sections"><a href="#results">Results</a><a href="#maps">First maps</a><a href="#questions">Questions</a><span class="tally mono" id="tally">0 of ${ITEM_IDS.length} marked</span></nav>
  <section id="results" aria-labelledby="h-results"><h2 id="h-results">Results</h2>${findings}</section>
  <section id="maps" aria-labelledby="h-maps"><h2 id="h-maps">First maps</h2>
    <p>The baseline's own telemetry, drawn on each map. These are bots (four runs a map), so they show that the record is right, not yet how a person plays: a bot sees in the dark and reacts faster. They are a fixed first look, not the viewer. Pick the waves and one layer at a time.</p>
    ${maps}
  </section>
  <section id="questions" aria-labelledby="h-questions"><h2 id="h-questions">Questions</h2>
    ${questions}
    <fieldset class="q" data-q="ml1-else" id="ml1-else"><legend>Anything else?</legend><label class="note"><span>Notes</span><textarea id="qn-ml1-else" rows="3"></textarea></label><span class="saved" aria-live="polite"></span></fieldset>
  </section>
  <section class="how" aria-labelledby="h-how"><h2 id="h-how">How to check any of this</h2>
    <p><code>npm run v3:map-lab -- baseline</code> replays the twelve stored runs and says what differs. <code>-- telemetry log.json</code> turns any play log into its telemetry. <code>-- audit</code> plays bots on all twenty maps and checks every run both ways. <code>-- bench</code> measures the cost and the sampling. <code>node e2e/v3-map-lab.mjs</code> is the phone-sized browser check. The notes are in <code>docs/design/v3-map-lab-slice0-1.md</code>.</p>
  </section>
</main>
<script>${script}</script>
`;

const out = process.argv.slice(2).find((a) => a.endsWith('.html'));
if (!out) throw new Error('usage: page.ts -- <out.html> [--logs=a.json,b.json]');
if (reportLogs) {
  // A file to open in a browser: the maps alone, with their own page frame.
  const report = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Map telemetry report</title><style>body{margin:0}[hidden]{display:none!important}${css}</style></head><body><main class="wrap"><header class="intro"><div class="eyebrow">Straitwatch V3 · Map &amp; Convoy Lab · report</div><h1>Map telemetry</h1><p class="lede">${reportLogs.length} play log${reportLogs.length === 1 ? '' : 's'}, replayed to telemetry on this build (log version ${LOG_VERSION}). Pick the waves and one layer at a time.</p><p class="dbnote" id="dbnote" hidden></p><span id="tally" hidden></span></header><section id="maps">${maps}</section></main><script>${script}</script></body></html>`;
  writeFileSync(out, report);
  console.log(`wrote ${out} (${(report.length / 1024).toFixed(0)} KiB): ${reportLogs.length} logs on ${previews.length} map(s)`);
  process.exit(0);
}
writeFileSync(out, html);
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} KiB): ${ITEM_IDS.length} items, ${Q_IDS.length} questions`);
