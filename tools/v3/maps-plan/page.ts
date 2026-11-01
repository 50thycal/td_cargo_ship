// Builds the review page (an HTML artifact) and the plan doc (markdown) from
// the layouts and content.ts. The page saves each map's verdict and each
// answer to the artifact's database so the next session can read them.

import { BRAINSTORM, CHAPTERS, QUESTIONS, SLOTS, type Engine, type Slot } from './content';
import type { Kind, ProposedMap } from './proposed';
import { KIND } from './svg';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const ENGINE_LABEL: Record<Engine, string> = {
  none: 'Built',
  data: 'Data only',
  small: 'Small',
  medium: 'Medium',
  large: 'New system',
};

/** What fires on a map, read off its layout. */
export function sources(m: ProposedMap) {
  const silos = m.bases.filter((b) => !b.rig && !b.generator && !b.core);
  const kinds = new Set<Kind>();
  for (const b of m.bases) for (const k of b.kinds) kinds.add(k);
  for (const e of m.extras) kinds.add(e.kind);
  const v = m.vectors;
  const wave = (n: number) => (n >= 99 ? 'never' : `wave ${n}`);
  const lines = [
    `${silos.length} silo${silos.length === 1 ? '' : 's'}` + (m.bases.some((b) => b.rig) ? `, ${m.bases.filter((b) => b.rig).length} rigs` : '') + (m.bases.some((b) => b.generator) ? `, ${m.bases.filter((b) => b.generator).length} shield generators, the Citadel` : ''),
    `trucks from ${wave(v.trucks)} (${m.roads.runners.length} coast road${m.roads.runners.length === 1 ? '' : 's'}, ${m.roads.popups.length} pop-up${m.roads.popups.length === 1 ? '' : 's'})`,
    m.subSpots.length ? `subs from ${wave(v.subs)} (${m.subSpots.length} spots)` : 'no subs',
    `strafers from wave ${v.strafers}, bombers from wave ${v.bombers} (${m.bomberLines.length + (m.airLines?.length ?? 0)} line${m.bomberLines.length + (m.airLines?.length ?? 0) === 1 ? '' : 's'})`,
  ];
  if (v.boats) lines.push(`fast boats from wave ${v.boats}`);
  const extras = m.extras.map((e) => `${KIND[e.kind].name.toLowerCase()} from wave ${e.from}`).join(', ');
  return { lines, extras, kinds: [...kinds] };
}

function stars(n: number): string {
  return Array.from({ length: 5 }, (_, i) => `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
}

function chipRow(kinds: Kind[]): string {
  return kinds.map((k) => `<span class="kchip" style="--k:${KIND[k].c}" title="${KIND[k].name}">${KIND[k].l}</span>`).join('');
}

function card(s: Slot, svg: string, m: ProposedMap): string {
  const src = sources(m);
  const ch = CHAPTERS[s.chapter - 1];
  return `<article class="map" id="map-${s.id}" data-id="${s.id}">
  <header class="map-head">
    <div class="slotno" aria-label="Slot ${s.slot}">${String(s.slot).padStart(2, '0')}</div>
    <div class="map-title">
      <div class="eyebrow">Chapter ${s.chapter} · ${esc(ch.name)}${s.free ? ' · <b class="free">Free trial</b>' : ''}</div>
      <h3>${esc(s.name)}</h3>
      <div class="tags"><span class="tag ${s.existing ? 'built' : 'new'}">${s.existing ? 'Existing' : 'New'}</span><span class="tag eng eng-${s.engine}">${ENGINE_LABEL[s.engine]}</span><span class="tag">${s.tries} ${s.tries === '1' ? 'try' : 'tries'}</span><span class="diff" title="Difficulty ${s.difficulty} of 5">${stars(s.difficulty)}</span></div>
    </div>
  </header>
  <button class="figure" type="button" data-zoom="${s.id}" aria-label="Enlarge ${esc(s.name)}">${svg}</button>
  <p class="pitch">${esc(s.pitch)}</p>
  <dl class="facts">
    <div><dt>The one new idea</dt><dd>${esc(s.unique)}</dd></div>
    <div><dt>First to bring</dt><dd>${esc(s.introduces)}</dd></div>
    ${s.reuses ? `<div><dt>Reuses</dt><dd>${esc(s.reuses)}</dd></div>` : ''}
    <div><dt>Enemy sources</dt><dd>${src.lines.map(esc).join('; ')}${src.extras ? `. Extra on this map: ${esc(src.extras)}` : ''}. <span class="krow">${chipRow(src.kinds)}</span></dd></div>
    <div><dt>Engine work</dt><dd>${esc(s.engineNote)}</dd></div>
    <div><dt>Threat scale</dt><dd class="mono">${esc(s.scale)}</dd></div>
  </dl>
  <div class="review" role="group" aria-label="Your verdict on ${esc(s.name)}">
    <div class="seg">
      <button type="button" data-verdict="approve" id="v-${s.id}-approve">Approve</button>
      <button type="button" data-verdict="change" id="v-${s.id}-change">Change</button>
      <button type="button" data-verdict="cut" id="v-${s.id}-cut">Cut</button>
    </div>
    <label class="note"><span>Notes for this map</span><textarea id="n-${s.id}" rows="2" placeholder="What to change, move or rename"></textarea></label>
    <div class="saved" aria-live="polite"></div>
  </div>
</article>`;
}

function table(): string {
  const rows = SLOTS.map((s) => `<tr><td class="mono">${s.slot}</td><td>${s.chapter}</td><td><a href="#map-${s.id}">${esc(s.name)}</a>${s.free ? ' <b class="free">free</b>' : ''}${s.existing ? '' : ' <span class="tag new sm">new</span>'}</td><td>${esc(s.unique)}</td><td>${esc(s.introduces)}</td><td><span class="diff">${stars(s.difficulty)}</span></td><td class="mono">${s.tries}</td><td><span class="tag eng eng-${s.engine}">${ENGINE_LABEL[s.engine]}</span></td></tr>`).join('');
  return `<div class="tablewrap"><table><thead><tr><th>#</th><th>Ch</th><th>Map</th><th>Unique idea</th><th>New threat or mechanic</th><th>Difficulty</th><th>Tries</th><th>Engine work</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

const SHARED_SYSTEMS = [
  ['Path lanes', 'Lanes as polylines; ships, formations and funnels follow the heading.', 'kesh, delta', 'Medium–large, once'],
  ['Queue and merge', 'Ships close into one file and wait their turn.', 'needle, saltgate', 'Medium, once'],
  ['Lock gates', 'Gates, a fill timer with a light and countdown; built on the queue.', 'saltgate', 'Medium'],
  ['Damageable launchers', 'Hit points, health bar, destroyed state for bases.', 'rigs, dreadnought, citadel', 'Small–medium, once'],
  ['Moving boss', 'A launcher on a path with turrets and a boss bar.', 'dreadnought', 'Medium'],
  ['Shield and core', 'Generators that gate damage to a core.', 'citadel', 'Small, on top of the above'],
  ['Ship types', 'Size, hit points, loss weight, targeting weight.', 'behemoth', 'Small'],
  ['Lane direction', 'Spawn and delivery side per lane.', 'crossing', 'Small–medium'],
  ['Timed lanes', 'A lane that opens and closes on a clock.', 'tide', 'Small–medium'],
  ['Allied radar', 'A friendly structure the enemy targets; its sweep tracks threats over the lane.', 'marrow', 'Small–medium'],
  ['Allied turret', 'Friendly auto-gun that a hit knocks out.', 'battery', 'Small–medium'],
  ['Surface threats', 'Mines (drift) and fast boats (ram).', 'sowers, coves', 'Medium + small'],
  ['Night', 'Darkness, light cones, Star Shell pickup.', 'lantern', 'Medium'],
  ['Route switch', 'A tappable buoy that sets the next branch.', 'delta', 'Small, after path lanes'],
];

const CRITIQUE = [
  ['Variety', 'Every map\'s headline idea is different. Fog was cut (kept night). The radar (map 3) and the battery (map 11) are both allied structures, but one sees and one shoots, eight maps apart. The Delta and the Island both have lane choices; the Delta is the one where you choose.'],
  ['Readability', 'Enemy land is rust with a red-orange edge, friendly land is green with a mint edge, in every diagram and in the game. Each silo shows what it fires as letter chips, so colour is never the only cue.'],
  ['Fairness', 'Every new threat has a warning and an answer: mines are slow and blink (any shot), fast boats leave a wake (2 hits), the Dreadnought telegraphs its broadsides, the night keeps a faint glow and landing circles, locks show a countdown.'],
  ['The curve', 'Each new idea arrives alone. Later maps reuse earlier ones only as support: the Citadel reuses the funnel and rigs, the Delta reuses the bend\'s path lanes, Tidewater reuses the Island\'s risky and safe lanes.'],
  ['Order changes', 'On review: the Gauntlet moves to slot 4 and the Island to 6, so the two island maps (Lee of Marrow and the Island) are not back to back. Harbor Mouth eases to fit slot 5.'],
];

export function buildPage(svgs: Record<string, string>, layoutOf: (id: string) => ProposedMap): string {
  const idSvg = (id: string) => svgs[id].replace('<g clip-path="url(#frame)">', `<g id="m-${id}" clip-path="url(#frame)">`);
  const overview = CHAPTERS.map((c) => {
    const slots = SLOTS.filter((s) => s.chapter === c.n);
    return `<section class="chapter"><div class="ch-head"><h3><span class="mono">Ch ${c.n}</span> ${esc(c.name)}</h3><p>${esc(c.idea)} <span class="muted">${esc(c.tries)}.</span></p></div>
      <ol class="thumbs" start="${slots[0].slot}">${slots.map((s) => `<li><a href="#map-${s.id}" class="thumb"><svg viewBox="0 0 1600 900" aria-hidden="true"><use href="#m-${s.id}"/></svg><span class="tn"><b class="mono">${s.slot}</b> ${esc(s.name)}</span><span class="tstate" data-state="${s.id}"></span></a></li>`).join('')}</ol></section>`;
  }).join('');

  const legendItems = [
    ['<span class="sw sw-enemy"></span>', 'Enemy land'],
    ['<span class="sw sw-friendly"></span>', 'Friendly land'],
    ['<span class="sw sw-lane"></span>', 'Shipping lane, chevrons show the way ships sail'],
    ['<svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="20" fill="#3a1712" stroke="#ff7d62" stroke-width="5"/><circle cx="30" cy="30" r="8" fill="#ff5a3d"/></svg>', 'Enemy silo; chips show what it fires'],
    ['<svg viewBox="0 0 60 60"><rect x="8" y="12" width="44" height="36" rx="5" fill="#3a1d17" stroke="#ff7d62" stroke-width="4"/><circle cx="30" cy="30" r="9" fill="#ff5a3d"/></svg>', 'Oil rig (has hit points)'],
    ['<svg viewBox="0 0 60 60"><line x1="4" y1="40" x2="56" y2="20" stroke="#d8b878" stroke-width="6" stroke-dasharray="10 6"/></svg>', 'Truck road; an arrow is a pop-up truck route'],
    ['<svg viewBox="0 0 60 60"><ellipse cx="30" cy="36" rx="22" ry="10" fill="#231a44" stroke="#c9b6ff" stroke-width="4"/><rect x="27" y="16" width="6" height="14" fill="#c9b6ff"/></svg>', 'Submarine spot'],
    ['<svg viewBox="0 0 60 60"><line x1="0" y1="30" x2="60" y2="30" stroke="#cfd6df" stroke-width="3" stroke-dasharray="3 8"/><polygon points="44,30 26,25 22,14 17,14 19,25 12,26 9,20 6,20 8,30 6,40 9,40 12,34 19,35 17,46 22,46 26,35" fill="#e6ecf5"/></svg>', 'Aircraft line (from either edge)'],
    ['<svg viewBox="0 0 80 40"><polygon points="4,8 56,8 76,20 56,32 4,32" fill="#47c1ff" stroke="#e8f7ff" stroke-width="3"/></svg>', 'Your carrier (the gun)'],
    ['<svg viewBox="0 0 60 40"><polygon points="6,12 38,12 52,20 38,28 6,28" fill="#9ddcff" stroke="#0d3446" stroke-width="3" stroke-dasharray="5 3"/></svg>', 'Frigate Escort station'],
    ['<span class="sw sw-tray"></span>', 'Notice tray (for the builder)'],
  ];
  const kindLegend = (Object.keys(KIND) as Kind[]).map((k) => `<li><span class="kchip" style="--k:${KIND[k].c}">${KIND[k].l}</span>${KIND[k].name}${k === 'mine' || k === 'fastboat' ? ' <span class="tag new sm">new</span>' : ''}</li>`).join('');
  const legend = `<div class="legend"><ul class="lg">${legendItems.map(([i, t]) => `<li><span class="li">${i}</span>${t}</li>`).join('')}</ul><ul class="lk">${kindLegend}</ul></div>`;

  const brainstorm = BRAINSTORM.map((g) => `<div class="bgroup"><h4>${esc(g.group)} <span class="muted mono">${g.ideas.length}</span></h4><ul class="ideas">${g.ideas.map((i) => `<li class="${i.pick ? 'picked' : 'cut'}"><div class="iname">${i.pick ? `<a href="#map-${i.pick}">${esc(i.name)}</a>` : esc(i.name)}<span class="tag ${i.pick ? 'new' : 'off'} sm">${i.pick ? 'picked' : 'cut'}</span></div><div class="iline">${esc(i.line)} <span class="muted">Stresses ${esc(i.stresses)}. Decision: ${esc(i.decision)}.</span>${i.why ? `<div class="why">${esc(i.why)}</div>` : ''}</div></li>`).join('')}</ul></div>`).join('');

  const questions = QUESTIONS.map((q) => `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.q)}</legend><div class="opts">${q.options.map((o, i) => `<label class="opt"><input type="radio" name="q-${q.id}" id="q-${q.id}-${i}" value="${i}"><span>${esc(o)}${i === q.rec ? ' <em>recommended</em>' : ''}</span></label>`).join('')}</div><p class="muted">${esc(q.why)}</p><label class="note"><span>Anything else</span><textarea id="qn-${q.id}" rows="1"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`).join('');

  const engineRows = SHARED_SYSTEMS.map(([a, b, c, d]) => `<tr><td><b>${a}</b></td><td>${b}</td><td>${c.split(', ').map((id) => `<a href="#map-${id}">${esc(SLOTS.find((s) => s.id === id)!.name)}</a>`).join(', ')}</td><td>${d}</td></tr>`).join('');

  const counts = SLOTS.reduce((acc, s) => ((acc[s.engine] = (acc[s.engine] ?? 0) + 1), acc), {} as Record<string, number>);

  return `<title>Straitwatch Map Atlas</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: a long admiralty-chart ledger: overview strip of chapters, then one map per card, then the table, the brainstorm and the questions. */
:root {
  --bg: #eef2f4; --surface: #ffffff; --ink: #14212b; --muted: #5a6b78; --line: #cfd9df;
  --accent: #b7791f; --accent-ink: #ffffff; --enemy: #b4553f; --friendly: #2f7a4a; --chart: #0d3446;
  --ok: #2f7a4a; --warn: #b7791f; --bad: #b4553f; --chip-ink: #1b0d0a;
  --display: 'Barlow Condensed', 'Arial Narrow', system-ui, sans-serif;
  --body: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0a161d; --surface: #10212b; --ink: #e6eef3; --muted: #93a6b3; --line: #22394a;
  --accent: #ffd166; --accent-ink: #1b1200; --enemy: #ff8a70; --friendly: #8fe0a2; --chart: #0d3446;
  --ok: #8fe0a2; --warn: #ffd166; --bad: #ff8a70; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0a161d; --surface: #10212b; --ink: #e6eef3; --muted: #93a6b3; --line: #22394a;
  --accent: #ffd166; --accent-ink: #1b1200; --enemy: #ff8a70; --friendly: #8fe0a2; --chart: #0d3446;
  --ok: #8fe0a2; --warn: #ffd166; --bad: #ff8a70; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 15px/1.55 var(--body); }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 28px 96px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 44px; }
h1, h2, h3, h4 { font-family: var(--display); font-weight: 700; letter-spacing: .01em; text-wrap: balance; margin: 0; line-height: 1.05; }
h1 { font-size: clamp(38px, 7vw, 64px); }
h2 { font-size: clamp(28px, 4.5vw, 38px); }
h3 { font-size: 26px; }
h4 { font-size: 20px; }
p { margin: 0; max-width: 68ch; }
a { color: inherit; text-decoration-color: var(--accent); text-underline-offset: 3px; }
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); }
.eyebrow { font: 600 12px/1.2 var(--body); letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.free { color: var(--accent); font-weight: 600; }
section { display: grid; gap: 18px; }
.intro { display: grid; gap: 14px; }
.intro .lede { font-size: 17px; }
.stats { display: flex; flex-wrap: wrap; gap: 8px 22px; font-family: var(--display); font-size: 20px; }
.stats b { font-size: 30px; font-weight: 800; margin-right: 6px; }
.progress { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.bar { flex: 1 1 200px; height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; display: flex; }
.bar i { display: block; height: 100%; }
.bar .a { background: var(--ok); } .bar .c { background: var(--warn); } .bar .x { background: var(--bad); }
.dbnote { font-size: 13px; color: var(--muted); }
/* Chapters overview */
.chapter { display: grid; gap: 10px; }
.ch-head { display: grid; gap: 4px; }
.ch-head h3 span { color: var(--accent); margin-right: 6px; font-size: 18px; }
.thumbs { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
.thumb { display: grid; gap: 4px; text-decoration: none; position: relative; }
.thumb svg { width: 100%; aspect-ratio: 16/9; display: block; border-radius: 6px; outline: 1px solid var(--line); }
.thumb:hover svg, .thumb:focus-visible svg { outline: 2px solid var(--accent); }
.tn { font-size: 13px; line-height: 1.25; }
.tn b { color: var(--accent); margin-right: 3px; }
.tstate { position: absolute; top: 6px; right: 6px; font: 700 11px/1 var(--body); padding: 3px 6px; border-radius: 4px; }
.tstate[data-v="approve"] { background: var(--ok); color: var(--surface); } .tstate[data-v="change"] { background: var(--warn); color: var(--accent-ink); } .tstate[data-v="cut"] { background: var(--bad); color: var(--surface); }
@media (max-width: 720px) { .thumbs { grid-template-columns: repeat(5, 46%); overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 6px; } .thumbs li { scroll-snap-align: start; } }
/* Legend */
.legend { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 18px; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px; }
.legend ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.lg { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
.lg li, .lk li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.li { width: 38px; height: 24px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
.li svg { width: 100%; height: 100%; }
.sw { width: 36px; height: 20px; border-radius: 4px; display: block; }
.sw-enemy { background: #5a2f26; outline: 3px solid #ff7d62; outline-offset: -3px; }
.sw-friendly { background: #2b5236; outline: 3px solid #8fe0a2; outline-offset: -3px; }
.sw-lane { background: #3a5f72; border-top: 2px dotted #bfe6ff; border-bottom: 2px dotted #bfe6ff; }
.sw-tray { border: 2px dashed var(--muted); }
.kchip { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 22px; padding: 0 4px; border-radius: 5px; background: var(--k); color: var(--chip-ink); font: 800 13px/1 var(--display); border: 1.5px solid var(--chip-ink); }
.krow { display: inline-flex; flex-wrap: wrap; gap: 4px; vertical-align: middle; }
@media (max-width: 720px) { .legend { grid-template-columns: 1fr; } }
/* Map cards */
.maps { display: grid; gap: 34px; }
.chdiv { display: grid; gap: 4px; border-top: 2px solid var(--ink); padding-top: 12px; }
.map { display: grid; gap: 14px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; scroll-margin-top: 16px; }
.map-head { display: flex; gap: 16px; align-items: flex-start; }
.slotno { font: 800 54px/0.85 var(--display); color: var(--accent); min-width: 66px; }
.map-title { display: grid; gap: 6px; min-width: 0; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.tag { font: 600 12px/1 var(--body); padding: 5px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
.tag.sm { padding: 2px 6px; font-size: 11px; }
.tag.new { color: var(--accent); border-color: var(--accent); }
.tag.built { color: var(--ink); }
.tag.off { color: var(--muted); }
.eng-none, .eng-data { color: var(--ok); border-color: var(--ok); }
.eng-small { color: var(--ink); border-color: var(--ink); }
.eng-medium { color: var(--warn); border-color: var(--warn); }
.eng-large { color: var(--bad); border-color: var(--bad); }
.diff { display: inline-flex; gap: 3px; }
.pip { width: 9px; height: 9px; border-radius: 2px; background: var(--line); display: inline-block; }
.pip.on { background: var(--accent); }
.figure { all: unset; cursor: zoom-in; display: block; border-radius: 8px; overflow: hidden; background: var(--chart); }
.figure:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.figure svg { display: block; width: 100%; height: auto; }
.pitch { font-size: 17px; font-weight: 500; }
.facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 22px; }
.facts div { min-width: 0; }
.facts dt { font: 600 12px/1.3 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 2px 0 0; }
@media (max-width: 720px) { .facts { grid-template-columns: 1fr; } .slotno { font-size: 42px; min-width: 48px; } .map { padding: 14px; } }
.review { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px 16px; align-items: end; border-top: 1px dashed var(--line); padding-top: 14px; }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.seg button { font: 600 14px/1 var(--body); padding: 11px 14px; background: transparent; color: var(--ink); border: 0; border-right: 1px solid var(--line); cursor: pointer; }
.seg button:last-child { border-right: 0; }
.seg button:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.seg button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.seg button[aria-pressed="true"][data-verdict="approve"] { background: var(--ok); color: var(--surface); }
.seg button[aria-pressed="true"][data-verdict="change"] { background: var(--warn); color: var(--accent-ink); }
.seg button[aria-pressed="true"][data-verdict="cut"] { background: var(--bad); color: var(--surface); }
.note { display: grid; gap: 4px; font-size: 12px; color: var(--muted); min-width: 0; }
textarea { font: 14px/1.4 var(--body); color: var(--ink); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; resize: vertical; width: 100%; }
textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 0; }
.saved { grid-column: 1 / -1; font-size: 12px; color: var(--muted); min-height: 1em; }
@media (max-width: 720px) { .review { grid-template-columns: 1fr; } }
/* Table */
.tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); }
table { border-collapse: collapse; width: 100%; min-width: 860px; font-size: 14px; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { font: 600 12px/1.2 var(--body); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); position: sticky; top: 0; background: var(--surface); }
tbody tr:last-child td { border-bottom: 0; }
/* Brainstorm */
.bgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.bgroup { display: grid; gap: 8px; align-content: start; }
.ideas { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.ideas li { display: grid; gap: 2px; padding: 8px 10px; border-left: 3px solid var(--line); }
.ideas li.picked { border-left-color: var(--accent); }
.iname { font-weight: 600; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.iline { font-size: 14px; }
.why { font-size: 13px; color: var(--muted); font-style: italic; }
@media (max-width: 720px) { .bgrid { grid-template-columns: 1fr; } }
/* Questions */
.qs { display: grid; gap: 14px; }
.q { border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; margin: 0; display: grid; gap: 10px; background: var(--surface); min-width: 0; }
.q legend { font: 700 20px/1.2 var(--display); padding: 0 4px; }
.opts { display: flex; flex-wrap: wrap; gap: 8px; }
.opt { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; cursor: pointer; }
.opt:has(input:checked) { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
.opt input { accent-color: var(--accent); }
.opt em { font-style: normal; font-size: 12px; color: var(--accent); margin-left: 4px; }
.crit { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.crit div { border-top: 2px solid var(--accent); padding-top: 8px; display: grid; gap: 4px; }
.crit b { font-family: var(--display); font-size: 20px; }
/* Key button + zoom */
.keybtn { position: fixed; right: calc(16px + env(safe-area-inset-right, 0px)); bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 20; font: 700 15px/1 var(--display); letter-spacing: .06em; padding: 12px 16px; border-radius: 999px; border: 0; background: var(--accent); color: var(--accent-ink); cursor: pointer; box-shadow: 0 6px 20px rgb(0 0 0 / .25); }
.keybtn:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
dialog { border: 0; padding: 0; background: transparent; max-width: 100vw; max-height: 100vh; }
dialog::backdrop { background: rgb(4 12 18 / .86); }
dialog.zoom { width: 100vw; height: 100vh; }
.zoombox { width: 100%; height: 100%; display: grid; place-items: center; padding: 12px; }
.zoombox svg { width: min(100%, calc((100vh - 24px) * 16 / 9)); height: auto; display: block; border-radius: 8px; }
.close { position: fixed; top: calc(12px + env(safe-area-inset-top, 0px)); right: calc(12px + env(safe-area-inset-right, 0px)); font: 700 15px/1 var(--display); padding: 10px 14px; border-radius: 999px; border: 0; background: var(--accent); color: var(--accent-ink); cursor: pointer; }
dialog.key { background: var(--surface); color: var(--ink); border-radius: 12px; padding: 16px; width: min(720px, calc(100vw - 32px)); max-height: 80vh; overflow: auto; }
dialog.key .legend { border: 0; padding: 0; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
</style>

<button class="keybtn" type="button" id="keybtn">Key</button>
<dialog class="key" id="keydlg"><h3 style="margin-bottom:12px">Key</h3>${legend}<p style="margin-top:12px"><button class="seg" style="padding:10px 14px;background:transparent;color:inherit;cursor:pointer" id="keyclose" type="button">Close</button></p></dialog>
<dialog class="zoom" id="zoomdlg"><button class="close" type="button" id="zoomclose">Close</button><div class="zoombox" id="zoombox"></div></dialog>

<main class="wrap">
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · map plan for review · nothing is built yet</div>
    <h1>Twenty maps in four chapters</h1>
    <p class="lede">Every map, the five that exist and fifteen new ones, laid out at the game's 16:9 world size. Each one brings one new idea. Mark each map Approve, Change or Cut, leave notes, and answer the questions at the end. Your marks save to this page, and the next session reads them before building anything.</p>
    <div class="stats"><span><b>5</b>existing</span><span><b>15</b>new</span><span><b>${(counts.none ?? 0) + (counts.data ?? 0)}</b>built or data only</span><span><b>${counts.small ?? 0}</b>small</span><span><b>${counts.medium ?? 0}</b>medium</span><span><b>${counts.large ?? 0}</b>new systems</span></div>
    <div class="progress"><div class="bar" aria-hidden="true"><i class="a" id="pa"></i><i class="c" id="pc"></i><i class="x" id="px"></i></div><span id="ptext" class="mono">0 of 20 reviewed</span></div>
    <p class="dbnote" id="dbnote">Connecting to the review store…</p>
  </header>

  <section aria-labelledby="h-order"><h2 id="h-order">The order</h2>${overview}</section>

  <section aria-labelledby="h-key"><h2 id="h-key">How to read a layout</h2>${legend}<p class="muted">Ships enter at one edge and deliver off the other (the chevrons point the way). Tap a diagram to see it full screen. The thin dashed box near a shore is where the game's notice tray sits.</p></section>

  <section class="maps" aria-labelledby="h-maps"><h2 id="h-maps">All twenty layouts</h2>
  ${CHAPTERS.map((c) => `<div class="chdiv"><div class="eyebrow">Chapter ${c.n} · ${esc(c.tries)}</div><h3>${esc(c.name)}</h3><p class="muted">${esc(c.idea)}</p></div>${SLOTS.filter((s) => s.chapter === c.n).map((s) => card(s, idSvg(s.id), layoutOf(s.id))).join('\n')}`).join('\n')}
  </section>

  <section aria-labelledby="h-table"><h2 id="h-table">All twenty at a glance</h2>${table()}</section>

  <section aria-labelledby="h-eng"><h2 id="h-eng">Engine work, as shared systems</h2><p>Most new maps share systems, so the real cost is lower than twenty separate jobs. Building order that follows the slots: path lanes first (map 2), then masking, ship types, the queue and locks, the turret, mines, damageable launchers, night, the boss, boats, the switch, lane direction, timed lanes, and the shield.</p>
    <div class="tablewrap"><table><thead><tr><th>System</th><th>What it is</th><th>Maps</th><th>Size</th></tr></thead><tbody>${engineRows}</tbody></table></div></section>

  <section aria-labelledby="h-crit"><h2 id="h-crit">Checks before showing you</h2><div class="crit">${CRITIQUE.map(([a, b]) => `<div><b>${a}</b><p>${esc(b)}</p></div>`).join('')}</div></section>

  <section aria-labelledby="h-brain"><h2 id="h-brain">The brainstorm: ${BRAINSTORM.reduce((n, g) => n + g.ideas.length, 0)} ideas, 15 picked</h2><div class="bgrid">${brainstorm}</div></section>

  <section aria-labelledby="h-q"><h2 id="h-q">Questions for you</h2><div class="qs">${questions}</div></section>
</main>

<script>
(() => {
  const SLOTS = ${JSON.stringify(SLOTS.map((s) => s.id))};
  const state = { reviews: {}, answers: {} };
  let db = null;
  const LS = 'straitwatch-map-atlas';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

  function paintMap(id) {
    const r = state.reviews[id] || {};
    const card = document.getElementById('map-' + id);
    if (!card) return;
    card.querySelectorAll('[data-verdict]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.verdict === r.verdict)));
    const ta = document.getElementById('n-' + id);
    if (ta && document.activeElement !== ta && typeof r.note === 'string') ta.value = r.note;
    const t = document.querySelector('[data-state="' + id + '"]');
    if (t) { t.dataset.v = r.verdict || ''; t.textContent = r.verdict ? ({ approve: 'OK', change: 'CHANGE', cut: 'CUT' })[r.verdict] : ''; }
  }
  function paintQ(id) {
    const a = state.answers[id] || {};
    document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = String(a.choice) === i.value; });
    const ta = document.getElementById('qn-' + id);
    if (ta && document.activeElement !== ta && typeof a.note === 'string') ta.value = a.note;
  }
  function paintProgress() {
    const v = SLOTS.map((id) => (state.reviews[id] || {}).verdict).filter(Boolean);
    const n = (k) => v.filter((x) => x === k).length;
    document.getElementById('pa').style.width = (n('approve') / 20 * 100) + '%';
    document.getElementById('pc').style.width = (n('change') / 20 * 100) + '%';
    document.getElementById('px').style.width = (n('cut') / 20 * 100) + '%';
    document.getElementById('ptext').textContent = v.length + ' of 20 reviewed · ' + n('approve') + ' approved, ' + n('change') + ' to change, ' + n('cut') + ' cut';
  }
  function paintAll() { SLOTS.forEach(paintMap); Object.keys(state.answers).forEach(paintQ); document.querySelectorAll('.q').forEach((f) => paintQ(f.dataset.q)); paintProgress(); }

  const flash = (el, msg) => { if (el) el.textContent = msg; };
  const busy = {};
  async function save(coll, id, body, statusEl) {
    state[coll][id] = Object.assign({}, state[coll][id], body);
    paintAll();
    if (!db) { const all = lsGet(); all[coll] = all[coll] || {}; all[coll][id] = state[coll][id]; lsSet(all); flash(statusEl, 'Saved in this browser only.'); return; }
    if (busy[coll + id]) { busy[coll + id].again = true; return; }
    busy[coll + id] = { again: false };
    try {
      do { busy[coll + id].again = false; await db.collection(coll).doc(id).set(Object.assign({}, state[coll][id], { at: new Date().toISOString() })); } while (busy[coll + id].again);
      flash(statusEl, 'Saved.');
    } catch (e) {
      flash(statusEl, e && (e.code === 'not_granted' || e.code === 'permission_denied') ? 'You can read this page but not save to it.' : 'Couldn\\'t save. Check your connection and try again.');
    } finally { delete busy[coll + id]; }
  }

  document.querySelectorAll('.map').forEach((card) => {
    const id = card.dataset.id;
    const st = card.querySelector('.saved');
    card.querySelectorAll('[data-verdict]').forEach((b) => b.addEventListener('click', () => {
      const cur = (state.reviews[id] || {}).verdict;
      save('reviews', id, { verdict: cur === b.dataset.verdict ? null : b.dataset.verdict, note: document.getElementById('n-' + id).value }, st);
    }));
    let t;
    const ta = document.getElementById('n-' + id);
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('reviews', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.reviews[id] || {}).note !== ta.value) save('reviews', id, { note: ta.value }, st); });
  });
  document.querySelectorAll('.q').forEach((f) => {
    const id = f.dataset.q, st = f.querySelector('.saved');
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => save('answers', id, { choice: Number(i.value), note: document.getElementById('qn-' + id).value }, st)));
    let t;
    const ta = document.getElementById('qn-' + id);
    ta.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
  });

  // Zoom and key.
  const zd = document.getElementById('zoomdlg'), zb = document.getElementById('zoombox');
  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    zb.innerHTML = '<svg viewBox="0 0 1600 900" role="img"><use href="#m-' + b.dataset.zoom + '"/></svg>';
    try { zd.showModal(); } catch { zd.setAttribute('open', ''); }
  }));
  document.getElementById('zoomclose').addEventListener('click', () => zd.close());
  zd.addEventListener('click', (e) => { if (e.target === zd || e.target === zb) zd.close(); });
  const kd = document.getElementById('keydlg');
  document.getElementById('keybtn').addEventListener('click', () => { try { kd.showModal(); } catch { kd.setAttribute('open', ''); } });
  document.getElementById('keyclose').addEventListener('click', () => kd.close());

  // Local copy first, then the shared store.
  const local = lsGet();
  Object.assign(state.reviews, local.reviews || {});
  Object.assign(state.answers, local.answers || {});
  paintAll();
  const note = document.getElementById('dbnote');
  const use = window.claude && window.claude.use;
  if (!use) { note.textContent = 'Open this page on claude.ai, signed in, to save your review for the next session. Marks made here stay in this browser.'; return; }
  const timer = setTimeout(() => { note.textContent = 'The review store isn\\'t answering yet. Marks you make are kept in this browser until it does.'; }, 10000);
  use('db').then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn\\'t available in this view. Marks stay in this browser.'; return; }
    db = d;
    note.textContent = 'Your marks save to this page for the next session to read.';
    for (const coll of ['reviews', 'answers']) {
      db.collection(coll).onSnapshot((snap) => {
        if (!snap.metadata.fromCache) clearTimeout(timer);
        snap.docs.forEach((doc) => { const v = doc.data(); if (v) state[coll][doc.id] = v; });
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the review store. Reload to try again.'; });
    }
  });
})();
</script>`;
}

export function buildDoc(layoutOf: (id: string) => ProposedMap): string {
  const L: string[] = [];
  L.push('# V3 maps plan: 20 maps in four chapters (for approval)');
  L.push('');
  L.push('Status: **proposal, nothing built.** Follows [v3-maps-handoff.md](v3-maps-handoff.md). The player approves or changes each layout first; a later session builds the approved set.');
  L.push('');
  L.push('- **Review page:** https://claude.ai/artifact/YVdLYc3i8u3D4ZLdLAxXgE (the same diagrams, with Approve / Change / Cut and notes per map, and the open questions). Its saved marks are what the build session reads first.');
  L.push('- Diagrams: `docs/design/v3-maps-plan/NN-id.svg`, one per slot. The existing five are drawn straight from `MAPS` in `src/v3/data/maps.ts`; the new fifteen from `tools/v3/maps-plan/proposed.ts`, written in the shape of `MapDef` so an approved layout becomes code mechanically. Regenerate with `npx vite-node tools/v3/maps-plan/render.ts -- page.html`.');
  L.push('- In-game screenshots of the existing five (wave 6, watch bot): `docs/design/v3-maps-plan/shot-*.png`.');
  L.push('- Names are made up, inspired by real places, to keep a game about shooting down missiles clear of real, contested straits on the App Store.');
  L.push('');
  L.push('## The order');
  L.push('');
  for (const c of CHAPTERS) {
    L.push(`**Chapter ${c.n}: ${c.name}** (${c.tries}). ${c.idea}`);
    L.push('');
    L.push(SLOTS.filter((s) => s.chapter === c.n).map((s) => `${s.slot}. ${s.name}${s.existing ? ' (existing)' : ''}${s.free ? ' (free)' : ''}`).join(' · '));
    L.push('');
  }
  L.push('## All twenty at a glance');
  L.push('');
  L.push('| # | Ch | Map | Unique idea | New threat or mechanic | Difficulty | Tries | Engine work |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const s of SLOTS) L.push(`| ${s.slot} | ${s.chapter} | ${s.name}${s.existing ? '' : ' (new)'}${s.free ? ' (free)' : ''} | ${s.unique} | ${s.introduces} | ${'●'.repeat(s.difficulty)}${'○'.repeat(5 - s.difficulty)} | ${s.tries} | ${ENGINE_LABEL[s.engine]} |`);
  L.push('');
  L.push('Engine work: **Built** = exists; **Data only** = numbers in `maps.ts`; **Small** = a contained addition; **Medium** = a new mechanic; **New system** = a new subsystem (path lanes, locks, the moving boss).');
  L.push('');
  L.push('### Shared systems');
  L.push('');
  L.push('| System | What it is | Maps | Size |');
  L.push('|---|---|---|---|');
  for (const [a, b, c, d] of SHARED_SYSTEMS) L.push(`| ${a} | ${b} | ${c} | ${d} |`);
  L.push('');
  L.push('## Key to the diagrams');
  L.push('');
  L.push('Rust land with a red-orange edge is **enemy**; green land with a mint edge is **friendly**. The pale band is a shipping lane; chevrons show the way ships sail. Red rings are silos, with letter chips for what each fires: ' + (Object.keys(KIND) as Kind[]).map((k) => `**${KIND[k].l}** ${KIND[k].name.toLowerCase()}`).join(', ') + '. Square platforms are oil rigs (hit points shown). Dashed tan lines are truck roads (an arrow is a pop-up route); purple ellipses are sub spots; dotted lines with planes are aircraft lines. The blue ship is the carrier, the small dashed one the Frigate Escort station; the faint dashed box is the notice tray.');
  L.push('');
  L.push('## The layouts');
  for (const c of CHAPTERS) {
    L.push('');
    L.push(`### Chapter ${c.n}: ${c.name}`);
    for (const s of SLOTS.filter((x) => x.chapter === c.n)) {
      const m = layoutOf(s.id);
      const src = sources(m);
      L.push('');
      L.push(`#### ${s.slot}. ${s.name}${s.existing ? ' (existing)' : ''}${s.free ? ' (free trial)' : ''}`);
      L.push('');
      L.push(`![${s.name}](v3-maps-plan/${String(s.slot).padStart(2, '0')}-${s.id}.svg)`);
      L.push('');
      L.push(`${s.pitch}`);
      L.push('');
      L.push(`- **The one new idea:** ${s.unique}.`);
      L.push(`- **First to bring:** ${s.introduces}.`);
      if (s.reuses) L.push(`- **Reuses:** ${s.reuses}.`);
      L.push(`- **Enemy sources:** ${src.lines.join('; ')}.${src.extras ? ` Extra on this map: ${src.extras}.` : ''}`);
      L.push(`- **Expected tries:** ${s.tries}. **Difficulty:** ${s.difficulty}/5. **Threat scale:** ${s.scale}.`);
      L.push(`- **Engine work (${ENGINE_LABEL[s.engine]}):** ${s.engineNote}`);
      if (s.existing) L.push(`- In game: ![${s.name} in game](v3-maps-plan/shot-${s.id}.png)`);
    }
  }
  L.push('');
  L.push('## Checks before showing the player');
  L.push('');
  for (const [a, b] of CRITIQUE) L.push(`- **${a}.** ${b}`);
  L.push('');
  L.push(`## The brainstorm (${BRAINSTORM.reduce((n, g) => n + g.ideas.length, 0)} ideas, 15 picked)`);
  for (const g of BRAINSTORM) {
    L.push('');
    L.push(`**${g.group}**`);
    L.push('');
    for (const i of g.ideas) L.push(`- ${i.pick ? '✅' : '✖'} **${i.name}**: ${i.line} Stresses ${i.stresses}. Decision: ${i.decision}.${i.pick ? ` → ${SLOTS.find((s) => s.id === i.pick)!.name}.` : ` Cut: ${i.why}`}`);
  }
  L.push('');
  L.push('## Open questions');
  L.push('');
  for (const q of QUESTIONS) L.push(`- **${q.q}** ${q.options.map((o, i) => (i === q.rec ? `**${o}** (recommended)` : o)).join(' / ')}. ${q.why}`);
  L.push('');
  L.push('## For the build session');
  L.push('');
  L.push('- Read the review page\'s saved marks first (collections `reviews/{mapId}`: `verdict` approve | change | cut, `note`; `answers/{questionId}`: `choice` (option index), `note`).');
  L.push('- `MapId`, `MAPS` and `MAP_ORDER` grow to 20; the save keeps cleared maps by id, so moving the Gauntlet from slot 2 to 6 needs an unlock migration (a player who cleared it keeps it).');
  L.push('- Straight lanes in `proposed.ts` (from x = -40 to 1640) are today\'s `Channel` (a funnel\'s `[x, hw]` stops become `narrow`). Curved, reversed and forked lanes wait for path lanes.');
  L.push('- Each map also needs bot and sweep coverage (`npm run v3:sweep`) and an e2e tray check, as the five have.');
  L.push('');
  return L.join('\n');
}
