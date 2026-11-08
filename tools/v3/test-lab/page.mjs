// Builds the Test Lab review page: the design, piece by piece (Approve /
// Change / Cut), the checklist it would hold (keep or drop each card), and
// the open questions, with mockups of the three main screens. Marks save to
// the artifact's store:
//   reviews/{pieceId}: verdict (approve | change | cut), note
//   cards/{cardId}:    verdict (keep | drop), note
//   answers/{questionId}: choice (option index), note
// Usage: node tools/v3/test-lab/page.mjs <out.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ROUND_DATE, ASK, TODAY, PIECES, SECTIONS, CARDS, QUESTIONS } from './lab.mjs';

const root = new URL('../../../', import.meta.url);
// The game's own card list (src/v3/data/lab.ts), and where the game lives:
// a card's "Test in game" link opens that test.
const LAB = JSON.parse(execSync('npx tsx tools/v3/test-lab/cards.mts', { cwd: root.pathname }).toString());
const LAB_ROUND_NOW = LAB.rounds.find((r) => r.n === LAB.round);
const LAB_ROUND_TITLE = `Test round ${LAB.round}${LAB_ROUND_NOW ? ` · ${LAB_ROUND_NOW.name}` : ''}`;
const GAME_URL = process.env.GAME_URL ?? 'https://td-cargo-ship.vercel.app/v3.html';
const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Text with "\n- " lists becomes a paragraph and a list.
const rich = (s) => {
  const [lead, ...items] = String(s).split('\n- ');
  return `<p>${esc(lead)}</p>${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
};
const shot = (name) => {
  const p = new URL(`docs/design/img/enemy-build/${name}.jpg`, root);
  return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : '';
};

// ---- Mockups: drawn in HTML at a phone's landscape shape (not the game's
// code; what the screens would hold).
const MOCKS = {
  list: `<div class="phone" role="img" aria-label="Mockup of the Test Lab screen: a checklist with progress and a Next up button">
    <div class="ph-head"><b>TEST LAB</b><span>9 of 34 tested</span><span class="ph-bar"><i style="width:26%"></i></span></div>
    <div class="ph-body">
      <div class="ph-col">
        <div class="ph-sec">NEW ENEMIES · 7 of 21</div>
        <div class="ph-row done"><s>Dive Bomber</s><em class="k">KEEP</em></div>
        <div class="ph-row done"><s>Siege Battery</s><em class="t">TUNE</em></div>
        <div class="ph-row now"><b>Rocket Truck</b><small>Is the slow raise enough time?</small></div>
        <div class="ph-row"><b>Volatile Cloud</b></div>
        <div class="ph-row"><b>Lure Beacon</b></div>
      </div>
      <div class="ph-side">
        <div class="ph-go">▶ NEXT UP<br><small>Rocket Truck</small></div>
        <div class="ph-btn">Play 5</div>
        <div class="ph-btn">Session report</div>
        <div class="ph-btn">Feedback page ↗</div>
      </div>
    </div>
  </div>`,
  bar: `<div class="phone shot" role="img" aria-label="Mockup of the lab bar over a real frame of the game: testing the Dive Bomber" style="background-image:url('${shot('diveBomber-dive')}')">
    <div class="ph-lab"><span><b>TESTING · DIVE BOMBER</b><small>Watch for: the red circle, then the plane</small></span><span class="ph-count">came 3 · shot 2 · hit you 1</span>
      <span class="ph-acts"><i>⚡ Bring one</i><i>✎ Note</i><i>⚙ Setup</i><i class="done">✓ Done</i></span></div>
  </div>`,
  verdict: `<div class="phone" role="img" aria-label="Mockup of the verdict sheet after a test">
    <div class="ph-head"><b>DIVE BOMBER · HOW WAS IT?</b><span>2 waves · 3 min</span></div>
    <div class="ph-body">
      <div class="ph-col">
        <div class="ph-v"><i class="k">Keep</i><i class="t on">Tune</i><i class="c">Cut</i></div>
        <div class="ph-tags"><i class="on">Can't see the tell</i><i>Too hard</i><i>Unfair</i><i>Fun</i><i>Bug</i></div>
        <div class="ph-note">The plane shows up over the HUD on the right…</div>
      </div>
      <div class="ph-side">
        <div class="ph-num"><b>2 of 3</b><small>shot in the window</small></div>
        <div class="ph-num"><b>1.1 s</b><small>to your first shot</small></div>
        <div class="ph-go">NEXT ▶<br><small>Siege Battery</small></div>
      </div>
    </div>
  </div>`,
};

function verdicts(id, coll, opts, label) {
  return `<div class="verdicts" role="group" aria-label="${esc(label)}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div>
  <label class="note"><span>Notes</span><textarea id="n-${coll}-${id}" rows="1"></textarea></label><div class="saved" aria-live="polite"></div>`;
}
const pieceCard = (p, n) => `<article class="item" id="piece-${p.id}" data-coll="reviews" data-id="${p.id}" aria-labelledby="pt-${p.id}">
  <div class="head"><span class="num">${n}</span><h3 id="pt-${p.id}">${esc(p.name)}</h3></div>
  ${p.mock ? MOCKS[p.mock] : ''}
  <div class="what"><span class="lab">What you'd see</span>${rich(p.see)}</div>
  <dl class="facts"><div><dt>Why</dt><dd>${esc(p.why)}</dd></div><div><dt>How</dt><dd>${esc(p.how)}</dd></div></dl>
  ${verdicts(p.id, 'reviews', [['approve', 'Approve'], ['change', 'Change'], ['cut', 'Cut']], `Your call on ${p.name}`)}
</article>`;
const cardRow = (c) => `<li class="card" data-coll="cards" data-id="${c.id}"><div class="ct"><b>${esc(c.name)}</b><span>${esc(c.look)}</span></div>
  ${verdicts(c.id, 'cards', [['keep', 'On the list'], ['drop', 'Drop']], `Keep ${c.name} on the list?`)}</li>`;
const question = (q) => `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o)}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;

const html = `<title>Test Lab Design</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: the same chart-room family as the weapon and enemy reviews, with
   the friendly side's teal as its signal (this round is about your tools).
   Design pieces as numbered cards (the order is the flow of a session),
   phone-shaped mockups inside them. */
:root {
  --sea: #e9eef1; --paper: #f8fafb; --ink: #14202a; --muted: #536370; --rule: #cfd9e0;
  --signal: #0b7c78; --enemy: #b4321f; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c; --chip: #dde6ec;
  --game: #0b2433; --game-ink: #e4ecf1; --game-dim: #8fa3b2; --game-gold: #f5c542;
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #4fd1c5; --enemy: #ff7a63; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1c2c39; color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #4fd1c5; --enemy: #ff7a63; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1c2c39; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 24px; }
main > * { min-width: 0; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
h2 { font-size: 26px; text-transform: uppercase; }
h3 { font-size: 21px; line-height: 1.15; }
p { margin: 0; }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 72ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
blockquote { margin: 0; padding: 8px 12px; border-left: 3px solid var(--signal); color: var(--muted); font-style: italic; }
.today { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: grid; gap: 6px; }
.tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.tabs button { flex: none; font: 600 14px var(--body); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 12px var(--mono); color: var(--muted); }
.pane { display: grid; gap: 16px; scroll-margin-top: 110px; }
.pane > p { max-width: 72ch; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 14px; }
.item { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; scroll-margin-top: 110px; }
.item[data-v="approve"] { border-color: var(--go); }
.item[data-v="cut"] { opacity: .7; }
.head { display: flex; gap: 10px; align-items: baseline; }
.num { font: 600 13px var(--mono); color: var(--signal); }
.lab { display: block; font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.what ul { margin: 6px 0 0; padding-left: 20px; }
.facts { margin: 0; display: grid; gap: 6px; }
.facts div { display: grid; grid-template-columns: 52px 1fr; gap: 8px; }
.facts dt { font: 600 11px/1.9 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 0; }
.verdicts { display: flex; gap: 6px; flex-wrap: wrap; }
.verdicts button { font: 600 14px var(--body); padding: 7px 14px; border-radius: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.verdicts button[aria-pressed="true"][data-v="approve"], .verdicts button[aria-pressed="true"][data-v="keep"] { background: var(--go); border-color: var(--go); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="change"] { background: var(--maybe); border-color: var(--maybe); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="cut"], .verdicts button[aria-pressed="true"][data-v="drop"] { background: var(--drop); border-color: var(--drop); color: var(--paper); }
.verdicts button:focus-visible, .tabs button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.note { display: grid; gap: 2px; }
.note span { font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
textarea { width: 100%; font: 14px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 9px; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1em; }
.sec { display: grid; gap: 8px; }
.sec > p { color: var(--muted); }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 10px; }
.card { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 10px 12px; display: grid; gap: 8px; min-width: 0; }
.card[data-v="drop"] { opacity: .6; }
.ct { display: grid; gap: 2px; }
.ct span { color: var(--muted); font-size: 14px; }
.card .verdicts button { padding: 5px 11px; font-size: 13px; }
.q { border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); padding: 12px 14px; display: grid; gap: 8px; margin: 0; scroll-margin-top: 110px; }
.q legend { font: 600 16px var(--body); padding: 0 4px; }
.opt { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); }
.qs { display: grid; gap: 12px; max-width: 760px; }
/* Mockups: the game's own dark palette in either theme (it's a picture of
   the game), at a landscape phone's shape. */
.phone { aspect-ratio: 16 / 9; max-width: 100%; width: 100%; border-radius: 14px; border: 6px solid #1b2731; background: var(--game); color: var(--game-ink); font: 11px/1.25 var(--body); position: relative; overflow: hidden; display: flex; flex-direction: column; }
.phone.shot { background-size: cover; background-position: center; }
.ph-head { display: flex; gap: 10px; align-items: center; padding: 7px 10px; border-bottom: 1px solid rgba(255,255,255,.12); }
.ph-head b { font: 700 14px var(--display); letter-spacing: .04em; }
.ph-head span { color: var(--game-dim); font-family: var(--mono); font-size: 10px; }
.ph-bar { flex: 1; height: 5px; background: rgba(255,255,255,.12); border-radius: 3px; overflow: hidden; }
.ph-bar i { display: block; height: 100%; background: var(--game-gold); }
.ph-body { flex: 1; display: grid; grid-template-columns: 1.6fr 1fr; gap: 8px; padding: 8px 10px; min-height: 0; }
.ph-col, .ph-side { display: grid; align-content: start; gap: 5px; min-width: 0; }
.ph-sec { font: 600 9px var(--mono); letter-spacing: .1em; color: var(--game-dim); }
.ph-row { display: flex; gap: 6px; align-items: baseline; padding: 4px 7px; border-radius: 6px; background: rgba(255,255,255,.05); flex-wrap: wrap; }
.ph-row small { color: var(--game-dim); width: 100%; }
.ph-row.now { outline: 1.5px solid var(--game-gold); }
.ph-row.done s { color: var(--game-dim); }
.ph-row em { margin-left: auto; font: 600 9px var(--mono); font-style: normal; padding: 1px 5px; border-radius: 4px; }
.k { background: #1f7a3d; } .t { background: #8a6200; } .c { background: #a33a2c; }
.ph-go { background: var(--game-gold); color: #10161b; font: 800 14px var(--display); border-radius: 8px; padding: 8px; text-align: center; }
.ph-go small { font: 500 10px var(--body); }
.ph-btn { border: 1px solid rgba(255,255,255,.2); border-radius: 7px; padding: 5px 7px; text-align: center; }
.ph-lab { margin: 6px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; background: rgba(7,13,18,.86); border: 1px solid rgba(245,197,66,.5); border-radius: 9px; padding: 5px 8px; }
.ph-lab b { display: block; font: 700 12px var(--display); letter-spacing: .04em; color: var(--game-gold); }
.ph-lab small { color: var(--game-dim); }
.ph-count { font: 500 10px var(--mono); }
.ph-acts { display: flex; gap: 4px; margin-left: auto; flex-wrap: wrap; }
.ph-acts i { font-style: normal; border: 1px solid rgba(255,255,255,.25); border-radius: 6px; padding: 2px 6px; }
.ph-acts i.done { background: var(--game-gold); color: #10161b; border-color: var(--game-gold); }
.ph-v, .ph-tags { display: flex; gap: 5px; flex-wrap: wrap; }
.ph-v i, .ph-tags i { font-style: normal; padding: 3px 9px; border-radius: 6px; border: 1px solid rgba(255,255,255,.2); }
.ph-v i.on { outline: 2px solid var(--game-ink); }
.ph-tags i.on { background: rgba(245,197,66,.25); border-color: var(--game-gold); }
.ph-note { border: 1px solid rgba(255,255,255,.2); border-radius: 6px; padding: 5px 7px; color: var(--game-dim); }
.ph-num { background: rgba(255,255,255,.06); border-radius: 7px; padding: 4px 7px; }
.ph-num b { font: 700 15px var(--display); display: block; }
.ph-num small { color: var(--game-dim); }
@media (max-width: 520px) { .phone { font-size: 9px; } .phone:not(.shot) { aspect-ratio: auto; } .ph-body { grid-template-columns: 1fr 1fr; } .facts div { grid-template-columns: 1fr; gap: 0; } }
@media (prefers-reduced-motion: no-preference) { .item, .card { transition: border-color .2s, opacity .2s; } }
.card.result { grid-template-columns: 1fr; align-content: start; }
.card.result .look { font-size: 13px; }
.res { display: grid; gap: 2px; font-size: 14px; }
.res .rv { font-weight: 600; color: var(--muted); }
.card.result[data-v="keep"] .rv { color: var(--go); }
.card.result[data-v="tune"] .rv { color: var(--maybe); }
.card.result[data-v="cut"] .rv { color: var(--drop); }
.res .rs { font: 500 12px var(--mono); color: var(--muted); }
.card.result[data-v="keep"] { border-color: var(--go); }
.card.result[data-v="tune"] { border-color: var(--maybe); }
.card.result[data-v="cut"] { border-color: var(--drop); }
a.play { justify-self: start; font: 600 13px var(--body); color: var(--signal); text-decoration: none; border: 1px solid var(--signal); border-radius: 999px; padding: 4px 12px; }
a.play:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.hidden { display: none !important; }
.rhead { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.rround { font: 600 11px var(--mono); letter-spacing: .03em; background: var(--chip); color: var(--ink); border-radius: 999px; padding: 2px 8px; }
.rround:empty, .rstale:empty, .rch:empty { display: none; }
.res .rch { font-size: 13px; color: var(--muted); }
.res .rstale { font-size: 13px; font-weight: 600; color: var(--maybe); }
.card.result[data-stale="1"] { border-style: dashed; border-color: var(--maybe); }
.card.result[data-stale="1"] .rv, .card.result[data-stale="1"] .rn { opacity: .65; }
.rhist { font-size: 13px; color: var(--muted); }
.rhist summary { cursor: pointer; }
.rhist ul { margin: 4px 0 0; padding-left: 18px; }
.round-now { font-weight: 600; }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · Test Lab · ${ROUND_DATE}</div>
    <h1>Test Lab Design</h1>
    <p>A playtest hub for testing new things fast: open it, it says what's left, you play a fast, normal-feeling wave with that thing in it, you give a verdict in three taps, and every test is recorded. <b>Built</b> from your marks (the hub, Quick or Full length, everything on the list). <b>Results</b> shows what you've tested; the Design tabs keep the round as you marked it.</p>
    <blockquote>“${esc(ASK)}”</blockquote>
    <div><span class="lab">What makes testing slow today</span><ul class="today">${TODAY.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Sections">
    <div class="tabs" role="group" aria-label="Section">
      <button type="button" data-tab="results" aria-pressed="true">Results</button>
      <button type="button" data-tab="design" aria-pressed="false">Design</button>
      <button type="button" data-tab="list" aria-pressed="false">Checklist</button>
      <button type="button" data-tab="questions" aria-pressed="false">Questions</button>
    </div>
    <div class="tally" id="tally"></div>
  </nav>

  <section class="pane" id="pane-results" aria-labelledby="h-results">
    <h2 id="h-results">Results</h2>
    <p>The Test Lab is built: it's on the game's main menu. What you mark in the game shows here once Claude copies it over from your game logs (at the start of each session). Each card's link opens that test in the game.</p>
    <p class="round-now">${esc(LAB_ROUND_TITLE)}</p>
    <p>Each result says which test round it is from. When a build changes a card, it gets a new version: a result from before that says “changed since: retest”, and its earlier rounds fold underneath.</p>
    <p class="tally" id="results-tally"></p>
    ${LAB.sections.map((s) => `<section class="sec" aria-labelledby="rs-${s.kind}"><h3 id="rs-${s.kind}">${esc(s.name)}</h3><p>${esc(s.blurb)}</p>
      <ul class="cards">${LAB.cards.filter((c) => c.kind === s.kind).map((c) => `<li class="card result" data-result="${c.id}"><div class="ct"><b>${esc(c.name)}</b><span class="look">${esc(c.look)}</span></div>
        <div class="res"><span class="rhead"><span class="rround" data-rround></span><span class="rv" data-rv>Not tested yet</span></span><span class="rch" data-rch></span><span class="rn" data-rn></span><span class="rs" data-rs></span><span class="rstale" data-rstale></span><details class="rhist hidden" data-rhist><summary></summary><ul></ul></details></div>
        <a class="play" href="${GAME_URL}?lab=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Test in game ↗</a></li>`).join('\n')}</ul></section>`).join('\n')}
  </section>

  <section class="pane hidden" id="pane-design" aria-labelledby="h-design">
    <h2 id="h-design">The design, in the order you'd meet it</h2>
    <p>${PIECES.length} pieces, each built on something the game already has: the note form, the game log and its upload, the replay of a moment, Free Play's setup. Approve, Change (say what in the note) or Cut each one.</p>
    <div class="grid">${PIECES.map((p, k) => pieceCard(p, String(k + 1).padStart(2, '0'))).join('\n')}</div>
  </section>

  <section class="pane hidden" id="pane-list" aria-labelledby="h-list">
    <h2 id="h-list">The checklist</h2>
    <p>What the Test Lab would hold, in the order Next up plays it. Each card's line is what the bar shows while you play it. Drop any card that isn't worth your time.</p>
    ${SECTIONS.map((s) => `<section class="sec" aria-labelledby="sec-${s.id}"><h3 id="sec-${s.id}">${esc(s.name)}</h3><p>${esc(s.blurb)}</p>
      <ul class="cards">${CARDS.filter((c) => c.section === s.id).map(cardRow).join('\n')}</ul></section>`).join('\n')}
  </section>

  <section class="pane hidden" id="pane-questions" aria-labelledby="h-questions">
    <h2 id="h-questions">Questions</h2>
    <p>The recommended option is first in each.</p>
    <div class="qs">${QUESTIONS.map(question).join('\n')}
      <fieldset class="q" data-q="tl-notes"><legend>Anything else the Test Lab should do?</legend><label class="note"><span>Notes</span><textarea id="qn-tl-notes" rows="3"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
    </div>
  </section>
</main>

<script>
(() => {
  const PIECES = ${JSON.stringify(PIECES.map((p) => p.id))};
  const CARDS = ${JSON.stringify(CARDS.map((c) => c.id))};
  const QIDS = ${JSON.stringify(QUESTIONS.map((q) => q.id))};
  // Each card's current version and its changes by round (src/v3/data/lab.ts).
  const LABC = ${JSON.stringify(Object.fromEntries(LAB.cards.map((c) => [c.id, { rev: c.rev, changes: c.changes }])))};
  const state = { reviews: {}, cards: {}, answers: {}, results: {} };
  const COLLS = ['reviews', 'cards', 'answers', 'results'];
  const LS = 'straitwatch-test-lab-1';
  let db = null;
  let tab = 'results';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  const flash = (el, msg) => { if (el) el.textContent = msg; };

  function paintItem(el) {
    const r = state[el.dataset.coll][el.dataset.id] || {};
    el.dataset.v = r.verdict || '';
    el.querySelectorAll('button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === r.verdict)));
    const ta = el.querySelector('textarea');
    if (ta && document.activeElement !== ta && typeof r.note === 'string') ta.value = r.note;
  }
  function paintQ(id) {
    const a = state.answers[id] || {};
    document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = String(a.choice) === i.value; });
    const ta = document.getElementById('qn-' + id);
    if (ta && document.activeElement !== ta && typeof a.note === 'string') ta.value = a.note;
  }
  function paintTally() {
    const p = PIECES.filter((id) => (state.reviews[id] || {}).verdict).length;
    const c = CARDS.filter((id) => (state.cards[id] || {}).verdict === 'drop').length;
    const q = QIDS.filter((id) => state.answers[id] && state.answers[id].choice != null).length;
    document.getElementById('tally').textContent = p + ' of ' + PIECES.length + ' pieces marked · ' + (CARDS.length - c) + ' of ' + CARDS.length + ' cards on the list · ' + q + ' of ' + QIDS.length + ' answered';
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    for (const p of ['results', 'design', 'list', 'questions']) document.getElementById('pane-' + p).classList.toggle('hidden', p !== tab);
  }
  // Results: written by Claude from the game logs (read only here).
  const VLABEL = { keep: 'Keep', tune: 'Tune', cut: 'Cut' };
  // A result from before test rounds is round 1, version 1.
  function paintResults() {
    let n = 0;
    let stale = 0;
    document.querySelectorAll('[data-result]').forEach((el) => {
      const r = state.results[el.dataset.result];
      const c = LABC[el.dataset.result] || { rev: 1, changes: [] };
      const round = r ? r.round || 1 : 0;
      const old = !!r && (r.rev || 1) < c.rev;
      el.dataset.v = r && r.verdict ? r.verdict : '';
      el.dataset.stale = old ? '1' : '';
      if (r && !old) n++;
      if (old) stale++;
      el.querySelector('[data-rround]').textContent = r ? 'Round ' + round : '';
      el.querySelector('[data-rv]').textContent = r ? (r.verdict ? VLABEL[r.verdict] : 'Tested') + (r.tags && r.tags.length ? ' · ' + r.tags.join(', ') : '') : 'Not tested yet';
      const changed = r ? (Array.isArray(r.changes) ? r.changes : c.changes.filter((x) => x.round === round).map((x) => x.what)) : [];
      el.querySelector('[data-rch]').textContent = changed.length ? 'Changed for round ' + round + ': ' + changed.join(' · ') : '';
      el.querySelector('[data-rn]').textContent = r && r.note ? '“' + r.note + '”' : '';
      el.querySelector('[data-rs]').textContent = r && r.evidence ? r.evidence : '';
      const since = old ? c.changes.filter((x) => x.round > round).map((x) => x.what) : [];
      el.querySelector('[data-rstale]').textContent = old ? 'Changed since: retest' + (since.length ? ' (' + since.join(' · ') + ')' : '') : '';
      const hist = r && Array.isArray(r.history) ? r.history : [];
      const det = el.querySelector('[data-rhist]');
      det.classList.toggle('hidden', !hist.length);
      det.querySelector('summary').textContent = 'Earlier rounds (' + hist.length + ')';
      const ul = det.querySelector('ul');
      ul.replaceChildren(...hist.map((h) => { const li = document.createElement('li'); li.textContent = ['Round ' + (h.round || 1), h.verdict ? VLABEL[h.verdict] : 'Tested', h.note ? '“' + h.note + '”' : ''].filter(Boolean).join(' · '); return li; }));
    });
    document.getElementById('results-tally').textContent = n + ' of ' + document.querySelectorAll('[data-result]').length + ' tested at their current version' + (stale ? ' · ' + stale + ' changed since: retest' : '');
  }
  function paintAll() {
    paintResults();
    document.querySelectorAll('[data-coll]').forEach(paintItem);
    document.querySelectorAll('.q').forEach((f) => paintQ(f.dataset.q));
    paintTally();
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
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; try { sessionStorage.setItem(LS + '-tab2', tab); } catch {} paintTab(); }));
  try { tab = sessionStorage.getItem(LS + '-tab2') || 'results'; } catch {}

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
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: ${PIECES.length} pieces, ${CARDS.length} cards, ${QUESTIONS.length} questions)`);
