// Builds the review page for the map rebuild round: the Scope questions,
// one card per map (its diagram, today in a few lines with the measured win
// rates, your notes on it, and the rebuild proposal: a ten-wave script, its
// event, its debut, its target), the map-wide Systems, every note found, and
// your marks. Data: plan.mjs (the round), facts.mts (the game today),
// measured-2026-11-12.json (the bots). Marks save to the artifact's store:
//   reviews/{mapId}       verdict (approve | change | cut), note
//   systems/{systemId}    verdict (approve | change | cut), note
//   answers/{questionId}  choice (option index), note
//   answers/else          note (the "Anything else?" box)
// Usage: node tools/v3/maps-rebuild/page.mjs <out.html>
import { writeFileSync } from 'node:fs';
import { loadAll, origThreats, layoutLine, todayFoes, eventLine, mapNotes, pairNames, CORNER_WORD } from './lib.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');
const D = loadAll();
const { facts, measured, PLAN, SYSTEMS, QUESTIONS, NOTES, ROUND, SEARCHED, pairs } = D;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const foeName = (f) => facts.foes[f].name;
const WHO = { player: 'You', design: 'Design note', brief: 'Brief' };

// ---- Pieces ---------------------------------------------------------------
function bars(id, tries) {
  const r = measured.maps[id];
  const rows = [
    ['Average bot · campaign Armory', r.campaign.average, true],
    ['Your persona · campaign Armory', r.campaign.you, true],
    ['Sharp bot · no Armory', r.empty.sharp, false],
    ['Average bot · no Armory', r.empty.average, false],
  ];
  const target = Math.round(100 / tries);
  return `<div class="bars" role="group" aria-label="Measured win rates, ${measured.seeds} seeds each">
    ${rows.map(([label, v, main]) => `<div class="bar${main ? '' : ' dim'}"><span class="bl">${esc(label)}</span>
      <span class="track" aria-hidden="true"><i class="thru" style="width:${v.through10}%"></i><i class="won" style="width:${v.won}%"></i><b class="tgt" style="left:${Math.min(100, target)}%"></b></span>
      <span class="bv">won <b>${v.won}%</b> · ten waves ${v.through10}%</span></div>`).join('')}
    <p class="legend"><i class="sw won"></i>won the map <i class="sw thru"></i>got through the ten waves <i class="sw tgt"></i>target: ${target}% (${tries} tries). ${measured.seeds} seeds; campaign Armory is level ${r.armoryLevel} of 5 here.</p>
  </div>`;
}

function noteList(list) {
  if (!list.length) return '<p class="none">No notes from you on this map yet.</p>';
  return `<ul class="notes">${list.map((n) => `<li class="nt ${n.who}"><span class="who">${WHO[n.who]}</span><q>${esc(n.quote)}</q><small>${md(n.source)}</small></li>`).join('')}</ul>`;
}

function script(id) {
  const m = D.mapById[id];
  const p = PLAN[id];
  const rows = p.waves.map((w, k) => {
    const wave = k + 1;
    const debut = p.debut && wave === p.debutWave;
    const foes = w.foes.length ? w.foes.map((f) => `<span class="foe${debut ? ' deb' : ''}">${esc(foeName(f))}</span>`).join(' ') : '<span class="nil">—</span>';
    const pr = pairNames(w.pair, pairs);
    return `<tr${debut ? ' class="debut"' : ''}><th scope="row" data-l="Wave">${wave}</th><td data-l="Original threats" class="orig">${esc(origThreats(m.waves[k]))}</td><td data-l="New enemies">${foes}</td><td data-l="Pair">${pr.length ? pr.map((n) => `<span class="pair">${esc(n)}</span>`).join(' then ') : '<span class="nil">—</span>'}</td><td data-l="Moment">${w.moment ? esc(w.moment) : '<span class="nil">—</span>'}</td></tr>`;
  }).join('');
  return `<div class="tablewrap"><table class="script"><caption>The ten waves. Original threats: today’s wave table at this map’s scale (its extras and attack vectors too), before the new enemies and pairs take their share, as the planner does today.</caption>
    <thead><tr><th scope="col">Wave</th><th scope="col">Original threats</th><th scope="col">New enemies</th><th scope="col">Pair</th><th scope="col">Moment</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function verdicts(coll, id, label) {
  return `<div class="verdicts" role="group" aria-label="${esc(label)}">
    <button type="button" data-v="approve" aria-pressed="false">Approve</button>
    <button type="button" data-v="change" aria-pressed="false">Change</button>
    <button type="button" data-v="cut" aria-pressed="false">Cut</button>
    <button type="button" class="back" data-back>Bring back</button>
  </div>
  <label class="note"><span>Notes</span><textarea id="n-${coll}-${id}" rows="2" placeholder="What would you change?"></textarea></label><div class="saved" aria-live="polite"></div>`;
}

function mapCard(m) {
  const p = PLAN[m.id];
  const svg = m.svg.replace(/id="([\w-]+)"/g, `id="$1-${m.id}"`).replace(/url\(#([\w-]+)\)/g, `url(#$1-${m.id})`);
  const layout = [...p.layout];
  const chips = [
    `<span class="chip">Map ${m.slot}</span>`,
    p.debut ? `<span class="chip foe">Debut: ${esc(foeName(p.debut))}, wave ${p.debutWave}</span>` : '<span class="chip foe">Finale: no debut, the chapter’s pairs</span>',
    `<span class="chip">Target ${p.tries} ${p.tries === 1 ? 'try' : 'tries'}</span>`,
  ].join('');
  const used = [...new Set(p.waves.flatMap((w) => [w.pair].flat().filter(Boolean)))].map((id) => pairs[id].name);
  return `<article class="map" id="map-${m.id}" data-coll="reviews" data-id="${m.id}" aria-labelledby="mt-${m.id}">
  <header class="mhead"><h3 id="mt-${m.id}">${esc(m.name)}</h3><div class="chips">${chips}</div></header>
  <p class="ident">${esc(p.identity)}</p>
  <figure class="dia">${svg}<figcaption>Today’s layout, from the game’s map data. Dashed box: where the call-outs stack (${esc(CORNER_WORD[p.callouts ?? 'br'])})${p.hatches ? '; gold: the proposed siege hatches' : ''}.</figcaption></figure>
  <section class="blk"><h4>Today</h4>
    <ul class="today"><li>${esc(layoutLine(m))}</li><li>${esc(todayFoes(m, facts))}</li><li>${esc(eventLine(m, facts))}</li>${m.callout.covers.length ? `<li>The call-out corner covers ${esc(m.callout.covers.join(' and '))}.</li>` : ''}</ul>
    ${bars(m.id, p.tries)}
    <p class="trend"><b>Reading:</b> ${esc(p.trend)}</p>
  </section>
  <section class="blk"><h4>Notes on this map</h4>${noteList(mapNotes(m.id, NOTES, PLAN))}</section>
  <section class="blk prop"><h4>The rebuild</h4>
    <dl class="facts">
      <div><dt>Debut</dt><dd>${p.debut ? `${esc(foeName(p.debut))}, alone on wave ${p.debutWave}. Only enemies met on earlier maps join it.` : 'None: a chapter finale. It brings the chapter’s enemies and its pairs.'}</dd></div>
      <div><dt>Pairs</dt><dd>${used.length ? esc(used.join(', ')) : 'None: the first map.'}</dd></div>
      <div><dt>Event</dt><dd>${esc(p.event.text)}</dd></div>
      <div><dt>Layout</dt><dd>${layout.length ? `<ul>${layout.map((l) => `<li>${esc(l.what)} <span class="why">Why: ${esc(l.why)}</span></li>`).join('')}</ul>` : 'No change.'}</dd></div>
    </dl>
    ${script(m.id)}
  </section>
  ${verdicts('reviews', m.id, `Your call on ${m.name}`)}
</article>`;
}

function systemCard(s, n) {
  const notes = s.notes.map((id) => NOTES.find((x) => x.id === id));
  return `<article class="item" id="sys-${s.id}" data-coll="systems" data-id="${s.id}" aria-labelledby="st-${s.id}">
  <div class="mhead"><h3 id="st-${s.id}"><span class="num">${n}</span> ${esc(s.name)}</h3></div>
  <div><span class="lab">What you’d see</span><p>${md(s.see)}</p></div>
  <div><span class="lab">Why</span><p>${md(s.why)}</p></div>
  <details class="more"><summary>How it plugs into the game</summary><ul>${s.how.map((h) => `<li>${md(h)}</li>`).join('')}</ul></details>
  ${noteList(notes)}
  ${verdicts('systems', s.id, `Your call on ${s.name}`)}
</article>`;
}

function question(q, n) {
  const ev = D.evidence(q.id, facts, measured);
  return `<fieldset class="q" data-q="${q.id}"><legend><span class="num">${n}</span> ${esc(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o.replace(/ \(recommended\)$/, ''))}${/ \(recommended\)$/.test(o) ? ' <em class="rec">(recommended)</em>' : ''}</span></label>`).join('')}
  <p class="why">${esc(q.why)}</p>
  ${ev.length ? `<details class="more"><summary>The evidence</summary><ul>${ev.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
}

const chapterPane = (c) => {
  const ms = facts.maps.filter((m) => m.chapter === c.n);
  const cpairs = facts.pairs.filter((p) => p.chapter === c.n);
  return `<section class="pane hidden" id="pane-ch${c.n}" aria-labelledby="h-ch${c.n}">
    <div class="cathead"><h2 id="h-ch${c.n}">Chapter ${c.n} · ${esc(c.name)}</h2>
      <p>New enemies: ${esc(c.foes.map(foeName).join(', '))}. ${c.weapons.length ? `New weapons in the draft: ${esc(c.weapons.map((w) => w.name).join(', '))}.` : 'Every chapter 1 weapon is in the draft from the start.'} Pairs from this chapter: ${esc(cpairs.map((p) => p.name).join(', '))}.</p>
      <nav class="jump" aria-label="Maps in chapter ${c.n}">${ms.map((m) => `<a href="#map-${m.id}"><b>${m.slot}</b> ${esc(m.name)}<i data-state="${m.id}"></i></a>`).join('')}</nav></div>
    <div class="maps">${ms.map(mapCard).join('\n')}</div>
  </section>`;
};

const allNotes = NOTES.map((n) => ({ ...n, where: n.maps === 'all' ? 'Every map' : n.maps.map((id) => D.mapById[id].name).join(', ') }));

// ---- The page ---------------------------------------------------------------
const html = `<title>Map Rebuild</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: the chart-room family of the weapon, enemy, event and Test Lab
   reviews, with a chart blue as its signal (this round is about the water).
   A sticky strip of tabs and a tally; one map to a card, its diagram on top;
   the wave script a table that stacks on a phone. */
:root {
  --sea: #e8eef2; --paper: #f8fafb; --ink: #13202a; --muted: #52636f; --rule: #cdd8e0;
  --signal: #1d5f99; --enemy: #b4321f; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c; --chip: #dce6ee;
  --won: #1d5f99; --thru: #a9c3da; --tgt: #b4321f; --debut: #fff3d6;
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0a141b; --paper: #111d27; --ink: #e3ebf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #7fb8ff; --enemy: #ff7a63; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1b2b39;
  --won: #7fb8ff; --thru: #2e4a63; --tgt: #ff7a63; --debut: #2c2614; color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0a141b; --paper: #111d27; --ink: #e3ebf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #7fb8ff; --enemy: #ff7a63; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1b2b39;
  --won: #7fb8ff; --thru: #2e4a63; --tgt: #ff7a63; --debut: #2c2614; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 24px; }
main > * { min-width: 0; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
h2 { font-size: 26px; text-transform: uppercase; }
h3 { font-size: 23px; line-height: 1.15; }
h4 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
p { margin: 0; }
code { font: 500 12.5px var(--mono); background: var(--chip); border-radius: 4px; padding: 0 4px; overflow-wrap: anywhere; }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 72ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
blockquote { margin: 0; padding: 8px 12px; border-left: 3px solid var(--signal); color: var(--muted); font-style: italic; }
.intro ul { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: grid; gap: 6px; }
.tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.tabs button { flex: none; font: 600 14px var(--body); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 12px var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.pane { display: grid; gap: 16px; scroll-margin-top: 110px; }
.pane > p, .cathead p { max-width: 72ch; color: var(--muted); }
.cathead { display: grid; gap: 8px; }
.jump { display: flex; flex-wrap: wrap; gap: 6px; }
.jump a { font-size: 13px; color: var(--ink); text-decoration: none; border: 1px solid var(--rule); background: var(--paper); border-radius: 999px; padding: 3px 10px; display: inline-flex; gap: 6px; align-items: center; }
.jump a b { font: 600 12px var(--mono); color: var(--signal); }
.jump i { width: 8px; height: 8px; border-radius: 50%; background: var(--rule); }
.jump i[data-v="approve"] { background: var(--go); } .jump i[data-v="change"] { background: var(--maybe); } .jump i[data-v="cut"] { background: var(--drop); }
.maps { display: grid; gap: 18px; }
.map, .item { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 12px; min-width: 0; scroll-margin-top: 110px; }
.map[data-v="approve"], .item[data-v="approve"] { border-color: var(--go); }
.map[data-v="change"], .item[data-v="change"] { border-color: var(--maybe); }
.map[data-v="cut"] .blk, .item[data-v="cut"] > div, .map[data-v="cut"] .dia { opacity: .55; }
.mhead { display: grid; gap: 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font: 600 12px var(--body); background: var(--chip); border-radius: 999px; padding: 2px 9px; }
.chip.foe { color: var(--enemy); }
.ident { font-size: 16px; font-weight: 500; }
.dia { margin: 0; display: grid; gap: 4px; }
.dia svg { display: block; width: 100%; max-width: 100%; height: auto; border-radius: 8px; }
.dia figcaption, caption, .legend, .none { font-size: 12.5px; color: var(--muted); text-align: left; }
.blk { display: grid; gap: 8px; min-width: 0; }
.today { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.trend { font-size: 14px; }
.bars { display: grid; gap: 5px; }
.bar { display: grid; grid-template-columns: minmax(0, 15em) minmax(60px, 1fr) auto; gap: 8px; align-items: center; font-size: 13px; }
.bar.dim { color: var(--muted); }
.bl { min-width: 0; }
.track { position: relative; height: 10px; background: var(--sea); border: 1px solid var(--rule); border-radius: 5px; }
.track i { position: absolute; inset: 0 auto 0 0; border-radius: 5px; }
.track .thru { background: var(--thru); }
.track .won { background: var(--won); }
.bar.dim .won { opacity: .6; }
.track .tgt { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--tgt); }
.bv { font: 500 12px var(--mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
.legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin: 0 4px 0 8px; vertical-align: -1px; }
.legend .sw:first-child { margin-left: 0; }
.legend .sw.won { background: var(--won); } .legend .sw.thru { background: var(--thru); } .legend .sw.tgt { background: var(--tgt); width: 3px; }
.notes { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.nt { display: grid; gap: 2px; padding-left: 10px; border-left: 3px solid var(--signal); }
.nt.design, .nt.brief { border-left-color: var(--rule); }
.nt .who { font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.nt q { font-style: italic; }
.nt small { color: var(--muted); font-size: 12.5px; }
.facts { margin: 0; display: grid; gap: 6px; }
.facts div { display: grid; grid-template-columns: 64px 1fr; gap: 8px; }
.facts dt { font: 600 11px/1.9 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 0; min-width: 0; }
.facts ul { margin: 0; padding-left: 18px; }
.why { color: var(--muted); }
.tablewrap { overflow-x: auto; }
table.script { width: 100%; border-collapse: collapse; font-size: 13.5px; }
table.script caption { padding-bottom: 6px; }
table.script th, table.script td { text-align: left; vertical-align: top; padding: 6px 8px; border-top: 1px solid var(--rule); }
table.script thead th { font: 600 11px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); border-top: 0; }
table.script tbody th { font: 600 14px var(--mono); color: var(--signal); }
table.script tr.debut td, table.script tr.debut th { background: var(--debut); }
td.orig { color: var(--muted); font-size: 12.5px; min-width: 11em; }
.foe { font-weight: 600; } .foe.deb { color: var(--enemy); }
.pair { font-weight: 600; color: var(--signal); }
.nil { color: var(--muted); }
@media (max-width: 640px) {
  table.script thead { display: none; }
  table.script, table.script tbody, table.script tr, table.script th, table.script td { display: block; width: 100%; }
  table.script caption { display: block; }
  table.script tr { border-top: 1px solid var(--rule); padding: 6px 0; }
  table.script th, table.script td { border: 0; padding: 2px 0; }
  table.script td::before { content: attr(data-l) ": "; font: 600 10.5px var(--mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  table.script tbody th::before { content: "Wave "; }
  td.orig { min-width: 0; }
  .bar { grid-template-columns: 1fr auto; } .bar .track { grid-column: 1 / -1; grid-row: 2; }
  .facts div { grid-template-columns: 1fr; gap: 0; }
}
.verdicts { display: flex; gap: 6px; flex-wrap: wrap; }
.verdicts button { font: 600 14px var(--body); padding: 7px 14px; border-radius: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.verdicts button[aria-pressed="true"][data-v="approve"] { background: var(--go); border-color: var(--go); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="change"] { background: var(--maybe); border-color: var(--maybe); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="cut"] { background: var(--drop); border-color: var(--drop); color: var(--paper); }
.verdicts .back { display: none; border-style: dashed; }
[data-v="cut"] > .verdicts .back { display: inline-block; }
button:focus-visible, textarea:focus-visible, input:focus-visible, a:focus-visible, summary:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.note { display: grid; gap: 2px; }
.note span, .lab { font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.lab { display: block; margin-bottom: 2px; }
textarea { width: 100%; font: 16px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 9px; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1em; }
.num { font: 600 13px var(--mono); color: var(--signal); }
.q { border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); padding: 12px 14px; display: grid; gap: 8px; margin: 0; min-width: 0; scroll-margin-top: 110px; }
.q legend { font: 600 16px var(--body); padding: 0 4px; }
.opt { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); flex: none; }
.rec { font-style: normal; font-weight: 600; color: var(--go); }
.qs { display: grid; gap: 12px; max-width: 820px; }
.more summary { cursor: pointer; font-weight: 600; font-size: 14px; color: var(--signal); }
.more ul { margin: 6px 0 0; padding-left: 20px; display: grid; gap: 4px; font-size: 14px; }
.sysgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 14px; }
.allnotes { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; max-width: 820px; }
.allnotes .where { font: 600 12px var(--body); color: var(--signal); }
.marks { display: grid; gap: 6px; }
.mk { display: grid; grid-template-columns: 6.5em 1fr; gap: 8px; font-size: 14px; padding: 6px 0; border-top: 1px solid var(--rule); }
.mk b[data-v="approve"] { color: var(--go); } .mk b[data-v="change"] { color: var(--maybe); } .mk b[data-v="cut"] { color: var(--drop); }
.mk span { min-width: 0; overflow-wrap: anywhere; }
.hidden { display: none !important; }
@media (prefers-reduced-motion: no-preference) { .map, .item { transition: border-color .2s; } }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · Map rebuild · ${esc(ROUND.date)}</div>
    <h1>Map Rebuild</h1>
    <blockquote>“${esc(ROUND.ask)}”</blockquote>
    <p>The twenty maps were laid out in the maps plan, before the ${Object.keys(facts.foes).length} new enemies, the ${facts.pairs.length} enemy pairs, the events and the new weapons. This round decides how each map is rebuilt around them. <b>Scope</b> asks what the rebuild covers. Each <b>chapter</b> tab has its five maps: today in a few lines with the bots’ win rates, your notes on the map, and a proposal with its ten waves. <b>Systems</b> are the map-wide changes your notes call for. Mark each Approve, Change or Cut, and say why in its notes.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Sections">
    <div class="tabs" role="group" aria-label="Section">
      <button type="button" data-tab="scope" aria-pressed="true">Scope</button>
      ${facts.chapters.map((c) => `<button type="button" data-tab="ch${c.n}" aria-pressed="false">Ch ${c.n} · ${esc(c.name)}</button>`).join('')}
      <button type="button" data-tab="systems" aria-pressed="false">Systems</button>
      <button type="button" data-tab="notes" aria-pressed="false">All notes</button>
      <button type="button" data-tab="marks" aria-pressed="false">My marks</button>
    </div>
    <div class="tally" id="tally"></div>
  </nav>

  <section class="pane" id="pane-scope" aria-labelledby="h-scope">
    <h2 id="h-scope">Scope</h2>
    <p>${QUESTIONS.length} questions that shape every map below. The recommended option is first in each, and the map proposals follow it; a different answer changes them. Each has the evidence folded under it.</p>
    <div class="qs">${QUESTIONS.map((q, k) => question(q, k + 1)).join('\n')}</div>
  </section>

  ${facts.chapters.map(chapterPane).join('\n')}

  <section class="pane hidden" id="pane-systems" aria-labelledby="h-systems">
    <h2 id="h-systems">Systems</h2>
    <p>Changes that reach every map, or several. The map proposals assume them; a Cut here changes those maps.</p>
    <div class="sysgrid">${SYSTEMS.map((s, k) => systemCard(s, String(k + 1).padStart(2, '0'))).join('\n')}</div>
  </section>

  <section class="pane hidden" id="pane-notes" aria-labelledby="h-notes">
    <h2 id="h-notes">Every note that touches the maps</h2>
    <p>Quoted as found (your notes were dictated, so their words are kept as the logs have them), with where each came from. “Design note” is a line from an earlier design doc; “Brief” is this round’s brief, where your own words weren’t found. Searched: ${esc(SEARCHED.join('; '))}.</p>
    <ul class="allnotes">${allNotes.map((n) => `<li class="nt ${n.who}"><span class="who">${WHO[n.who]}</span><span class="where">${esc(n.where)}</span><q>${esc(n.quote)}</q><small>${md(n.source)}</small></li>`).join('')}</ul>
  </section>

  <section class="pane hidden" id="pane-marks" aria-labelledby="h-marks">
    <h2 id="h-marks">My marks</h2>
    <p id="marks-sum"></p>
    <div class="marks" id="marks"></div>
    <fieldset class="q" data-q="else"><legend>Anything else?</legend><label class="note"><span>Notes</span><textarea id="qn-else" rows="4" placeholder="Anything about the maps this page didn’t ask"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
  </section>
</main>

<script>
(() => {
  const MAPS = ${JSON.stringify(facts.maps.map((m) => [m.id, m.name]))};
  const SYS = ${JSON.stringify(SYSTEMS.map((s) => [s.id, s.name]))};
  const QS = ${JSON.stringify(QUESTIONS.map((q) => [q.id, q.q, q.options]))};
  const TABS = ['scope', ${facts.chapters.map((c) => `'ch${c.n}'`).join(', ')}, 'systems', 'notes', 'marks'];
  const state = { reviews: {}, systems: {}, answers: {} };
  const COLLS = ['reviews', 'systems', 'answers'];
  const LS = 'straitwatch-maps-rebuild-1';
  const VL = { approve: 'Approve', change: 'Change', cut: 'Cut' };
  let db = null;
  let tab = 'scope';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  const flash = (el, msg) => { if (el) el.textContent = msg; };

  function paintItem(el) {
    const r = state[el.dataset.coll][el.dataset.id] || {};
    el.dataset.v = r.verdict || '';
    el.querySelectorAll('button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === r.verdict)));
    const ta = el.querySelector('textarea');
    if (ta && document.activeElement !== ta && typeof r.note === 'string') ta.value = r.note;
    document.querySelectorAll('[data-state="' + el.dataset.id + '"]').forEach((d) => { d.dataset.v = r.verdict || ''; });
  }
  function paintQ(id) {
    const a = state.answers[id] || {};
    document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = String(a.choice) === i.value; });
    const ta = document.getElementById('qn-' + id);
    if (ta && document.activeElement !== ta && typeof a.note === 'string') ta.value = a.note;
  }
  function paintTally() {
    const m = MAPS.filter(([id]) => (state.reviews[id] || {}).verdict).length;
    const s = SYS.filter(([id]) => (state.systems[id] || {}).verdict).length;
    const q = QS.filter(([id]) => state.answers[id] && state.answers[id].choice != null).length;
    document.getElementById('tally').textContent = m + ' of ' + MAPS.length + ' maps marked · ' + s + ' of ' + SYS.length + ' systems · ' + q + ' of ' + QS.length + ' questions answered';
  }
  function row(kind, name, verdict, note) {
    const d = document.createElement('div');
    d.className = 'mk';
    const b = document.createElement('b');
    b.dataset.v = verdict || '';
    b.textContent = verdict ? (VL[verdict] || verdict) : 'Note only';
    const s = document.createElement('span');
    s.textContent = kind + ' · ' + name + (note ? ': “' + note + '”' : '');
    d.append(b, s);
    return d;
  }
  function paintMarks() {
    const box = document.getElementById('marks');
    const rows = [];
    for (const [id, name] of MAPS) { const r = state.reviews[id]; if (r && (r.verdict || r.note)) rows.push(row('Map', name, r.verdict, r.note)); }
    for (const [id, name] of SYS) { const r = state.systems[id]; if (r && (r.verdict || r.note)) rows.push(row('System', name, r.verdict, r.note)); }
    for (const [id, q, opts] of QS) {
      const a = state.answers[id];
      if (!a || (a.choice == null && !a.note)) continue;
      const d = row('Question', q, null, a.note);
      d.querySelector('b').textContent = a.choice != null ? 'Option ' + (Number(a.choice) + 1) : 'Note only';
      if (a.choice != null) d.querySelector('span').textContent += ' → ' + (opts[a.choice] || '');
      rows.push(d);
    }
    box.replaceChildren(...rows);
    document.getElementById('marks-sum').textContent = rows.length ? 'What you’ve marked so far, in page order.' : 'Nothing marked yet. Your verdicts, answers and notes collect here as you go.';
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    for (const p of TABS) document.getElementById('pane-' + p).classList.toggle('hidden', p !== tab);
  }
  function paintAll() {
    document.querySelectorAll('[data-coll]').forEach(paintItem);
    document.querySelectorAll('.q').forEach((f) => paintQ(f.dataset.q));
    paintTally();
    paintMarks();
    paintTab();
  }
  const busy = {};
  async function save(coll, id, body, statusEl) {
    state[coll][id] = Object.assign({}, state[coll][id], body);
    paintAll();
    if (!db) { const all = lsGet(); all[coll] = all[coll] || {}; all[coll][id] = Object.assign({}, state[coll][id], { pending: true }); lsSet(all); flash(statusEl, 'Saved in this browser only.'); return; }
    if (busy[coll + id]) { busy[coll + id].again = true; return; }
    busy[coll + id] = { again: false };
    try {
      do { busy[coll + id].again = false; await db.collection(coll).doc(id).set(Object.assign({}, state[coll][id], { at: new Date().toISOString() })); } while (busy[coll + id].again);
      flash(statusEl, 'Saved.');
    } catch (e) {
      flash(statusEl, e && (e.code === 'not_granted' || e.code === 'permission_denied') ? 'You can read this page but not save to it.' : 'Couldn’t save. Check your connection and try again.');
    } finally { delete busy[coll + id]; }
  }
  document.querySelectorAll('[data-coll]').forEach((el) => {
    const id = el.dataset.id, coll = el.dataset.coll;
    const st = el.querySelector('.saved');
    const ta = el.querySelector('textarea');
    el.querySelectorAll('button[data-v]').forEach((b) => b.addEventListener('click', () => {
      const cur = (state[coll][id] || {}).verdict;
      save(coll, id, { verdict: cur === b.dataset.v ? null : b.dataset.v, note: ta.value }, st);
    }));
    const back = el.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => save(coll, id, { verdict: null, note: ta.value }, st));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save(coll, id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state[coll][id] || {}).note !== ta.value && ta.value !== '') save(coll, id, { note: ta.value }, st); });
  });
  document.querySelectorAll('.q').forEach((f) => {
    const id = f.dataset.q, st = f.querySelector('.saved');
    const ta = document.getElementById('qn-' + id);
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => save('answers', id, { choice: Number(i.value), note: ta.value }, st)));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.answers[id] || {}).note !== ta.value && ta.value !== '') save('answers', id, { note: ta.value }, st); });
  });
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    try { sessionStorage.setItem(LS + '-tab', tab); } catch {}
    paintTab();
    const pane = document.getElementById('pane-' + tab);
    if (pane.getBoundingClientRect().top < 0) pane.scrollIntoView({ block: 'start' });
  }));
  // A map link from a chapter's strip, or from elsewhere: open its tab.
  document.querySelectorAll('.jump a').forEach((a) => a.addEventListener('click', (e) => {
    const el = document.querySelector(a.getAttribute('href'));
    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
  }));
  try { const t = sessionStorage.getItem(LS + '-tab'); if (TABS.includes(t)) tab = t; } catch {}

  const local = lsGet();
  for (const c of COLLS) Object.assign(state[c], local[c] || {});
  paintAll();
  const note = document.getElementById('store');
  const use = window.claude && window.claude.use;
  if (!use) { note.textContent = 'Open this page on claude.ai, signed in, to save your marks for the next session. Marks made here stay in this browser.'; return; }
  const timer = setTimeout(() => { note.textContent = 'The review store isn’t answering yet. Marks you make are kept in this browser until it does.'; }, 10000);
  use('db').then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Marks stay in this browser.'; return; }
    db = d;
    note.textContent = 'Your marks save to this page for the next session to read.';
    const left = lsGet();
    for (const coll of COLLS) for (const [id, val] of Object.entries(left[coll] || {})) {
      if (!val || !val.pending) continue;
      const body = Object.assign({}, val, { at: new Date().toISOString() });
      delete body.pending;
      db.collection(coll).doc(id).set(body).then(() => { const now = lsGet(); if (now[coll]) { delete now[coll][id]; lsSet(now); } }).catch(() => {});
    }
    for (const coll of COLLS) {
      db.collection(coll).onSnapshot((snap) => {
        clearTimeout(timer);
        snap.docs.forEach((doc) => { const val = doc.data(); if (val) state[coll][doc.id] = val; });
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the review store. Reload to try again.'; });
    }
  });
})();
</script>
`;
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: ${facts.maps.length} maps, ${SYSTEMS.length} systems, ${QUESTIONS.length} questions, ${NOTES.length} notes)`);
