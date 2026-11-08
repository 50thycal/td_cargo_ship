// Builds the review page for the special-event round: the idea in the
// player's words, the system piece by piece (Approve / Change / Cut), every
// event by chapter (Go further / Maybe / Drop), and the open questions. Marks
// save to the artifact's store:
//   pieces/{pieceId}:     verdict (approve | change | cut), note
//   reviews/{eventId}:    verdict (go | maybe | drop), note
//   answers/{questionId}: choice (option index), note
//   answers/se-else:      note (the "Anything else?" box)
// Pictures: docs/design/img/special-events/<eventId>.jpg (shots.mjs).
// Usage: node tools/v3/special-events/page.mjs <out.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ROUND_DATE, ASK, TODAY, PIECES, EVENTS, QUESTIONS } from './events.mjs';

const root = new URL('../../../', import.meta.url);
// Map, enemy and chapter names from the game's own data.
const NAMES = JSON.parse(execSync('npx tsx tools/v3/special-events/names.mts', { cwd: root.pathname }).toString());
const GAME_URL = process.env.GAME_URL ?? 'https://td-cargo-ship.vercel.app/v3.html';
const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// `code` spans in the data become <code>.
const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
const img = (id) => {
  const p = new URL(`docs/design/img/special-events/${id}.jpg`, root);
  return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : null;
};
const SIZE = { S: 'Small build', M: 'Medium build', L: 'Large build' };
const CHAPTER_IDS = [1, 2, 3, 4, 0];
const chapterName = (n) => (n ? `Chapter ${n}: ${NAMES.chapters[n]}` : 'Original threats');
const CHAPTER_BLURB = {
  1: 'Each map\'s event is built on the enemy that debuts there. Harbor Mouth repeats a debut, so it gets the chapter finale.',
  2: 'Saltgate Canal repeats a debut, so it gets the chapter finale.',
  3: 'Five maps, five new enemies: every map has its own debut, so there is no finale here.',
  4: 'Citadel of Vey repeats a debut, so it gets the finale: the end of the campaign.',
  0: 'Built on the game\'s first threats, with no debut enemy: for Free Play, endless, and later maps.',
};
const mapName = (e) => (e.map ? NAMES.maps[e.map] : null);
const foeName = (e) => (e.foe ? NAMES.foes[e.foe].name : null);

function pieceCard(p, n) {
  return `<article class="item" id="piece-${p.id}" data-coll="pieces" data-id="${p.id}" aria-labelledby="pt-${p.id}">
  <div class="head"><span class="num">${n}</span><h3 id="pt-${p.id}">${esc(p.name)}</h3></div>
  <div class="what"><span class="lab">What you'd see</span><p>${md(p.see)}</p></div>
  <dl class="facts"><div><dt>Why</dt><dd>${md(p.why)}</dd></div><div><dt>How</dt><dd>${md(p.how)}</dd></div></dl>
  <div class="verdicts" role="group" aria-label="Your call on ${esc(p.name)}">
    <button type="button" data-v="approve" aria-pressed="false">Approve</button>
    <button type="button" data-v="change" aria-pressed="false">Change</button>
    <button type="button" data-v="cut" aria-pressed="false">Cut</button>
  </div>
  <label class="note"><span>Notes</span><textarea id="n-pieces-${p.id}" rows="1" placeholder="What would you change?"></textarea></label><div class="saved" aria-live="polite"></div>
</article>`;
}

function eventCard(e) {
  const pic = img(e.id);
  const where = mapName(e);
  const chips = [
    e.player ? '<span class="chip yours">Your idea</span>' : '',
    `<span class="chip">${where ? esc(where) : 'Free Play · endless'}</span>`,
    e.foe ? `<span class="chip foe">Debut: ${esc(foeName(e))}</span>` : e.map ? '<span class="chip foe">The chapter\'s new enemies</span>' : '',
    `<span class="chip size" title="${SIZE[e.size]}">Size ${e.size}</span>`,
  ].join('');
  return `<article class="idea" id="event-${e.id}" data-coll="reviews" data-id="${e.id}" aria-labelledby="et-${e.id}">
  <header class="ttl">
    <h3 id="et-${e.id}">${esc(e.name)}</h3>
    <div class="chips">${chips}</div>
  </header>
  <p class="pitch">${esc(e.pitch)}</p>
  ${e.rule ? `<p class="rule-chip"><b>Rule while it runs:</b> ${esc(e.rule)}</p>` : ''}
  ${pic ? `<figure><img src="${pic}" alt="Concept: ${esc(e.name)}, drawn over a real frame of ${esc(where)}" loading="lazy" width="667" height="375"><figcaption>Concept over a real frame of ${esc(where)} (its wave 5)${e.foe ? `, with ${esc(foeName(e))} in it` : ''}</figcaption></figure>` : ''}
  <dl class="facts">
    <div><dt>Strong</dt><dd>${esc(e.strong)}</dd></div>
    <div><dt>Weak</dt><dd>${esc(e.weak)}</dd></div>
  </dl>
  <details class="more"><summary>How it plays</summary><p>${esc(e.how)}</p></details>
  <details class="more"><summary>How you beat it</summary><p>${esc(e.counter)}</p></details>
  ${e.map ? `<a class="playlink" href="${GAME_URL}?lab=${encodeURIComponent(`map-${e.map}`)}" target="_blank" rel="noopener">Play ${esc(where)} in the Test Lab ↗</a>` : ''}
  <div class="review" role="group" aria-label="Your call on ${esc(e.name)}">
    <div class="seg">
      <button type="button" data-v="go" aria-pressed="false">Go further</button>
      <button type="button" data-v="maybe" aria-pressed="false">Maybe</button>
      <button type="button" data-v="drop" aria-pressed="false">Drop</button>
    </div>
    <label class="note"><span>Notes</span><textarea id="n-reviews-${e.id}" rows="2" placeholder="Changes, numbers, what you'd want to try"></textarea></label>
    <div class="saved" aria-live="polite"></div>
  </div>
</article>`;
}

function question(q) {
  return `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o.replace(/ \(recommended\)$/, ''))}${/ \(recommended\)$/.test(o) ? ' <em class="rec">(recommended)</em>' : ''}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
}

const eventsPane = CHAPTER_IDS.map((ch) => {
  const list = EVENTS.filter((e) => e.chapter === ch);
  return `<section class="chap" aria-labelledby="ch-${ch}">
  <div class="cathead"><h3 id="ch-${ch}">${esc(chapterName(ch))} <span class="count" data-count="ch-${ch}"></span></h3><p>${esc(CHAPTER_BLURB[ch])}</p></div>
  <div class="grid">${list.map(eventCard).join('\n')}</div>
</section>`;
}).join('\n');

const mine = EVENTS.find((e) => e.player);

const html = `<title>Special Event Attacks</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: the chart-room family of the weapon, enemy and Test Lab reviews,
   with the event card's gold as its signal (this round is about set pieces).
   A sticky strip of tabs and a tally; cards in a grid that drops to one
   column on a phone. */
:root {
  --sea: #e9eef1; --paper: #f8fafb; --ink: #14202a; --muted: #536370; --rule: #cfd9e0;
  --signal: #9a6a00; --enemy: #b4321f; --friend: #0b7c78; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c; --chip: #dde6ec;
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #f5c542; --enemy: #ff7a63; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1c2c39; color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #f5c542; --enemy: #ff7a63; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a; --chip: #1c2c39; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 24px; }
main > * { min-width: 0; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
h2 { font-size: 26px; text-transform: uppercase; }
p { margin: 0; }
code { font: 13px var(--mono); }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 72ch; }
.intro p { color: var(--muted); }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: grid; gap: 6px; }
.tabs { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tabs button { flex: none; font: 600 14px var(--body); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 12px/1.4 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.tally b { color: var(--go); font-weight: 600; }
.pane { display: grid; gap: 16px; }
.pane > p, .cathead p { max-width: 72ch; color: var(--muted); }
.cathead { display: grid; gap: 4px; }
.cathead h3 { font-size: 24px; text-transform: uppercase; color: var(--signal); display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.count { font: 500 13px var(--mono); color: var(--muted); text-transform: none; }
.chap { display: grid; gap: 12px; }
blockquote { margin: 0; padding: 10px 14px; border-left: 3px solid var(--signal); background: var(--paper); border-radius: 0 8px 8px 0; font-style: italic; }
blockquote footer { margin-top: 6px; font: 600 12px var(--mono); font-style: normal; color: var(--muted); }
.today { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.lab { display: block; font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
.item, .idea, .q { scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 100px); }
.item, .idea { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.item[data-v="approve"], .idea[data-v="go"] { border-color: var(--go); box-shadow: inset 4px 0 0 var(--go); }
.item[data-v="change"], .idea[data-v="maybe"] { border-color: var(--maybe); }
.item[data-v="cut"], .idea[data-v="drop"] { opacity: .62; }
.head { display: flex; gap: 10px; align-items: baseline; }
.num { font: 600 13px var(--mono); color: var(--signal); }
.item h3 { font-size: 21px; line-height: 1.15; }
.ttl { display: grid; gap: 6px; min-width: 0; }
.ttl h3 { font-size: 23px; line-height: 1.1; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 600 11px/1.1 var(--body); letter-spacing: 0.04em; text-transform: uppercase; background: var(--chip); color: var(--muted); padding: 4px 7px; border-radius: 4px; }
.chip.yours { background: var(--signal); color: var(--paper); }
.chip.foe { color: var(--enemy); }
.chip.size { font-family: var(--mono); }
.pitch { font-size: 16px; font-weight: 500; }
.rule-chip { align-self: flex-start; font-size: 14px; padding: 5px 9px; border-radius: 6px; border: 1px dashed var(--signal); color: var(--ink); }
.rule-chip b { color: var(--signal); }
figure { margin: 0; display: grid; gap: 4px; }
figure img { width: 100%; height: auto; border-radius: 6px; display: block; border: 1px solid var(--rule); background: #0e1a24; }
figcaption { font-size: 12px; color: var(--muted); }
.facts { margin: 0; display: grid; gap: 6px; }
.facts div { display: grid; grid-template-columns: 5.5em 1fr; gap: 8px; min-width: 0; }
.facts dt { font: 600 11px/1.9 var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 0; font-size: 14px; min-width: 0; }
.item .facts div { grid-template-columns: 3.6em 1fr; }
.more summary { cursor: pointer; font-weight: 600; color: var(--friend); }
.more p { margin: 6px 0 0; font-size: 14px; }
a.playlink { align-self: flex-start; font: 600 13px var(--body); color: var(--friend); text-decoration: none; border: 1px solid var(--friend); border-radius: 999px; padding: 4px 12px; }
.review { display: grid; gap: 8px; margin-top: auto; padding-top: 4px; }
.verdicts, .seg { display: flex; gap: 6px; flex-wrap: wrap; }
.verdicts button, .seg button { font: 600 14px var(--body); padding: 7px 14px; border-radius: 8px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.verdicts button[aria-pressed="true"][data-v="approve"], .seg button[aria-pressed="true"][data-v="go"] { background: var(--go); border-color: var(--go); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="change"], .seg button[aria-pressed="true"][data-v="maybe"] { background: var(--maybe); border-color: var(--maybe); color: var(--paper); }
.verdicts button[aria-pressed="true"][data-v="cut"], .seg button[aria-pressed="true"][data-v="drop"] { background: var(--drop); border-color: var(--drop); color: var(--paper); }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.note { display: grid; gap: 2px; }
.note span { font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
textarea { width: 100%; font: 14px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 9px; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1.2em; }
.qs { display: grid; gap: 12px; max-width: 760px; }
.q { border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); padding: 12px 14px; display: grid; gap: 8px; margin: 0; min-width: 0; }
.q legend { font: 600 16px var(--body); padding: 0; float: left; width: 100%; margin-bottom: 4px; }
.opt { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); flex: none; }
.rec { font-style: normal; font-weight: 600; color: var(--go); }
.hidden { display: none !important; }
@media (max-width: 600px) {
  .tabs button { padding: 7px 11px; font-size: 13px; }
  .facts div, .item .facts div { grid-template-columns: 1fr; gap: 0; }
}
@media (prefers-reduced-motion: no-preference) { .item, .idea { transition: border-color .2s, opacity .2s; } }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · special events · ${ROUND_DATE}</div>
    <h1>Special Event Attacks</h1>
    <p>Your idea, worked into a system: every map keeps its normal waves and gets one scripted <b>special event</b>, built on the enemy that debuts there. <b>The idea</b> splits the system into ${PIECES.length} pieces: Approve, Change or Cut each. <b>Events</b> has ${EVENTS.length} of them by chapter (yours, the ${esc(mine.name)}, among them), each drawn over a real frame of its map: mark each Go further, Maybe or Drop. <b>Questions</b> has ${QUESTIONS.length} decisions before a build, the recommended option first.</p>
    <p>Everything saves as you go, for the next session to read. You should see “Saved.” under the first thing you mark.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Sections">
    <div class="tabs" role="group" aria-label="Section">
      <button type="button" data-tab="idea" aria-pressed="true">The idea</button>
      <button type="button" data-tab="events" aria-pressed="false">Events</button>
      <button type="button" data-tab="questions" aria-pressed="false">Questions</button>
      <button type="button" data-tab="go" aria-pressed="false">My picks</button>
    </div>
    <div class="tally" id="tally"></div>
  </nav>

  <section class="pane" id="pane-idea" aria-labelledby="h-idea">
    <h2 id="h-idea">The idea</h2>
    <blockquote>“${esc(ASK)}”<footer>Your words, ${ROUND_DATE}</footer></blockquote>
    <div><span class="lab">What the game does today</span><ul class="today">${TODAY.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
    <p>The system, piece by piece. Approve, Change (say what in the note) or Cut each one.</p>
    <div class="grid">${PIECES.map((p, k) => pieceCard(p, String(k + 1).padStart(2, '0'))).join('\n')}</div>
  </section>

  <section class="pane hidden" id="pane-events" aria-labelledby="h-events">
    <h2 id="h-events">Events <span class="count" data-count="events"></span></h2>
    <p>One for each map, on the enemy that debuts there; a finale on the three maps that repeat a debut; and a few for the original threats. The size is my guess at the build: S, M or L.</p>
    ${eventsPane}
  </section>

  <section class="pane hidden" id="pane-questions" aria-labelledby="h-questions">
    <h2 id="h-questions">Questions <span class="count" id="q-count"></span></h2>
    <p>The recommended option is first in each.</p>
    <div class="qs">${QUESTIONS.map(question).join('\n')}
      <fieldset class="q" data-q="se-else"><legend>Anything else?</legend><label class="note"><span>Notes</span><textarea id="qn-se-else" rows="3" placeholder="Events you'd add, rules, anything this page missed"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
    </div>
  </section>

  <section class="pane hidden" id="pane-go" aria-labelledby="h-go">
    <h2 id="h-go">My picks</h2>
    <p id="go-empty">Events you mark Go further collect here.</p>
    <div class="grid" id="go-grid"></div>
  </section>
</main>

<script>
(() => {
  const PIECES = ${JSON.stringify(PIECES.map((p) => p.id))};
  const EVENTS = ${JSON.stringify(EVENTS.map((e) => e.id))};
  const CHAPTER = ${JSON.stringify(Object.fromEntries(EVENTS.map((e) => [e.id, e.chapter])))};
  const QIDS = ${JSON.stringify(QUESTIONS.map((q) => q.id))};
  const TABS = ['idea', 'events', 'questions', 'go'];
  const state = { pieces: {}, reviews: {}, answers: {} };
  const COLLS = ['pieces', 'reviews', 'answers'];
  const LS = 'straitwatch-special-events-1';
  let db = null;
  let tab = 'idea';
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
  const v = (id) => (state.reviews[id] || {}).verdict;
  function paintTally() {
    const p = PIECES.filter((id) => (state.pieces[id] || {}).verdict).length;
    const n = (k) => EVENTS.filter((id) => v(id) === k).length;
    const marked = EVENTS.filter((id) => v(id)).length;
    const q = QIDS.filter((id) => state.answers[id] && state.answers[id].choice != null).length;
    document.getElementById('tally').innerHTML = p + '/' + PIECES.length + ' pieces · ' + marked + '/' + EVENTS.length + ' events marked (<b>' + n('go') + ' go further</b> · ' + n('maybe') + ' maybe · ' + n('drop') + ' drop) · ' + q + '/' + QIDS.length + ' answered';
    for (const ch of [1, 2, 3, 4, 0]) {
      const list = EVENTS.filter((id) => CHAPTER[id] === ch);
      const el = document.querySelector('[data-count="ch-' + ch + '"]');
      if (el) el.textContent = list.filter((id) => v(id)).length + ' / ' + list.length + ' marked';
    }
    document.querySelector('[data-count="events"]').textContent = marked + ' / ' + EVENTS.length + ' marked';
    document.getElementById('q-count').textContent = q + ' / ' + QIDS.length + ' answered';
  }
  // My picks: the cards themselves move there (one card per event, so its
  // buttons and notes stay the same element), and back when unpicked.
  const home = {};
  document.querySelectorAll('.idea').forEach((el) => { home[el.dataset.id] = el.parentElement; });
  function paintPicks() {
    const grid = document.getElementById('go-grid');
    const ids = EVENTS.filter((id) => v(id) === 'go');
    document.getElementById('go-empty').classList.toggle('hidden', ids.length > 0);
    document.querySelectorAll('.idea').forEach((el) => {
      const want = tab === 'go' && ids.includes(el.dataset.id) ? grid : home[el.dataset.id];
      if (el.parentElement !== want) want.append(el);
    });
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    for (const p of TABS) document.getElementById('pane-' + p).classList.toggle('hidden', p !== tab);
    paintPicks();
  }
  function paintAll() {
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
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; try { sessionStorage.setItem(LS + '-tab', tab); } catch {} paintTab(); window.scrollTo({ top: Math.min(window.scrollY, document.getElementById('pane-' + tab).offsetTop - 120) }); }));
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
const pics = EVENTS.filter((e) => img(e.id)).length;
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: ${PIECES.length} pieces, ${EVENTS.length} events, ${pics} pictures, ${QUESTIONS.length} questions)`);
