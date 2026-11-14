// Builds the Test Lab review page. It opens on the current test round (the
// latest in LAB_ROUNDS, src/v3/data/lab.ts) and shows only what is new:
//   - the round's header, and its design doc in a line;
//   - what's new in the game: the round's change lines, and earlier ones on
//     cards not tested since;
//   - the cards to test: never tested, or changed since their latest
//     verdict (worked out live from the store, as results arrive after the
//     page is published; the split is split.mjs);
//   - the open questions (OPEN_QUESTIONS in lab.mjs with no saved answer);
//   - a tally.
// Everything else is in one Archive, closed: the cards done (their verdict
// is on the current version), answered questions, the original design
// round with its marks, and the cut cards. A new round in LAB_ROUNDS and
// LAB_CHANGES needs no edit here: rebuild and republish.
// The store (ids and shapes kept from the design round):
//   results/{cardId}:     written by Claude from the game logs (labDocs.ts); read only here
//   answers/{questionId}: choice (option index), note; the open questions write these
//   reviews/{pieceId}:    verdict (approve | change | cut), note; the design round, read only now
//   cards/{cardId}:       verdict (keep | drop), note; the design round's checklist, read only now
// Usage: node tools/v3/test-lab/page.mjs <out.html>
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { ROUND_DATE, ASK, TODAY, PIECES, SECTIONS, CARDS, QUESTIONS, OPEN_QUESTIONS, ROUND_DOCS } from './lab.mjs';
import { cardStatus, changesSince, splitCards, groupBySection, untestedEarlier, isAnswered } from './split.mjs';

const root = new URL('../../../', import.meta.url);
// The game's own card list (src/v3/data/lab.ts), and where the game lives:
// a card's "Test in game" link opens that test.
const LAB = JSON.parse(execSync('npx tsx tools/v3/test-lab/cards.mts', { cwd: root.pathname }).toString());
const ROUND = LAB.rounds.find((r) => r.n === LAB.round) ?? { n: LAB.round, date: '', name: '' };
const ROUND_TITLE = `Test round ${ROUND.n}${ROUND.name ? ` · ${ROUND.name}` : ''}`;
const GAME_URL = process.env.GAME_URL ?? 'https://td-cargo-ship.vercel.app/v3.html';
const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');

// Question ids are store ids: an open question must not reuse one.
const NOTES_Q = { id: 'tl-notes', q: 'Anything else the Test Lab should do?', options: [] };
const OLD_QS = [...QUESTIONS, NOTES_Q];
{
  const seen = new Set(OLD_QS.map((q) => q.id));
  for (const q of OPEN_QUESTIONS) {
    if (seen.has(q.id)) throw new Error(`OPEN_QUESTIONS: the id ${q.id} is already used; give the question a new one`);
    seen.add(q.id);
  }
}

// The round's design doc: ROUND_DOCS, else the doc that says "Test Lab
// round N is", with its title as the line.
const repo = (() => {
  if (process.env.DOC_BASE) return process.env.DOC_BASE.replace(/\/$/, '');
  let url = '';
  try { url = execSync('git remote get-url origin', { cwd: root.pathname }).toString().trim(); } catch {}
  const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
  return `https://github.com/${m ? m[1] : '50thycal/td_cargo_ship'}/blob/HEAD`;
})();
function roundDoc(n) {
  if (ROUND_DOCS[n]) return ROUND_DOCS[n];
  const dir = new URL('docs/design/', root);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const text = readFileSync(new URL(f, dir), 'utf8');
    if (!text.includes(`Test Lab round ${n} is`)) continue;
    const title = (text.match(/^# (.+)$/m) ?? [])[1] ?? f;
    return { doc: `docs/design/${f}`, summary: title.replace(/^V3 (Test Lab )?round \d+:\s*/i, '').replace(/^./, (c) => c.toUpperCase()) };
  }
  return null;
}
const DOC = roundDoc(ROUND.n);

// Data for the page's script: no "</script>" can end it early.
const js = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Text with "\n- " lists becomes a paragraph and a list.
const rich = (s) => {
  const [lead, ...items] = String(s).split('\n- ');
  return `<p>${esc(lead)}</p>${items.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}`;
};

// What's new this round: each card's own lines for the round, cards with the
// same line together (round 10: seventeen maps share one).
const NEWS = (() => {
  const by = new Map();
  for (const c of LAB.cards) for (const l of c.own) if (l.round === ROUND.n) by.set(l.what, [...(by.get(l.what) ?? []), c.name]);
  return [...by].map(([what, names]) => ({ what, names }));
})();
// Up to three names in bold; more as a count, with the names below it.
const newsHead = (names) => (names.length > 3 ? `<b>${names.length} cards</b><span class="names">${esc(names.join(', '))}</span>` : `<b>${esc(names.join(', '))}</b>`);

// ---- Open questions: answered here, read back from answers/{id}.
const qWhy = (q) => (q.why ? `<p class="why">${esc(q.why)}</p>` : '');
const openQuestion = (q) => `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.text)}</legend>
  <span class="lab">Round ${q.round}</span>${qWhy(q)}
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o)}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
// The Archive's read-only copy of a question: its saved choice and note.
const answeredRow = (id, text, label) => `<li class="card aq" data-aq="${id}"><div class="ct"><span class="lab">${esc(label)}</span><b>${esc(text)}</b></div>
  <div class="res"><span class="rv" data-ans>No answer saved</span><span class="rn" data-anote></span></div></li>`;

// ---- The design round, read only: each piece and checklist card with its mark.
const markRow = (coll, id) => `<div class="res" data-mark="${coll}" data-id="${id}"><span class="rv" data-mv>Not marked</span><span class="rn" data-mn></span></div>`;
const pieceRow = (p, n) => `<article class="item" aria-labelledby="pt-${p.id}">
  <div class="head"><span class="num">${n}</span><h3 id="pt-${p.id}">${esc(p.name)}</h3></div>
  <div class="what"><span class="lab">What you'd see</span>${rich(p.see)}</div>
  <dl class="facts"><div><dt>Why</dt><dd>${esc(p.why)}</dd></div><div><dt>How</dt><dd>${esc(p.how)}</dd></div></dl>
  ${markRow('reviews', p.id)}
</article>`;
const listRow = (c) => `<li class="card"><div class="ct"><b>${esc(c.name)}</b><span>${esc(c.look)}</span></div>${markRow('cards', c.id)}</li>`;

const html = `<title>Straitwatch Test Lab</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: the same chart-room family as the weapon and enemy reviews, with
   the friendly side's teal as its signal (the lab is about your tools).
   One "This round" view on top, then one Archive, closed. */
:root {
  --sea: #e9eef1; --paper: #f8fafb; --ink: #14202a; --muted: #536370; --rule: #cfd9e0;
  --signal: #0b7c78; --enemy: #b4321f; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c; --chip: #dde6ec;
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
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; margin: 0; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 24px; }
main > * { min-width: 0; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
h2 { font-size: 26px; text-transform: uppercase; }
h3 { font-size: 21px; line-height: 1.15; }
h4 { font-size: 19px; line-height: 1.15; }
p { margin: 0; }
a { color: var(--signal); }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 72ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
blockquote { margin: 0; padding: 8px 12px; border-left: 3px solid var(--signal); color: var(--muted); font-style: italic; }
.today { margin: 0; padding-left: 20px; display: grid; gap: 4px; }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: space-between; }
.bar-sticky .tally { font-size: 12px; color: var(--ink); }
.jump { flex: none; font: 600 13px var(--body); padding: 5px 12px; border-radius: 999px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; }
.tally { font: 500 12px var(--mono); color: var(--muted); }
.pane { display: grid; gap: 22px; scroll-margin-top: 70px; }
.pane > p, .block > p { max-width: 72ch; color: var(--muted); }
.block { display: grid; gap: 12px; scroll-margin-top: 70px; }
.roundhead { background: var(--paper); border: 1px solid var(--rule); border-left: 4px solid var(--signal); border-radius: 10px; padding: 14px; display: grid; gap: 8px; }
.roundhead h2 { font-size: clamp(24px, 5vw, 30px); line-height: 1.05; }
.docline { max-width: 72ch; }
.docline a { font-weight: 600; white-space: nowrap; }
.news { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; max-width: 860px; }
.news li { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 10px 12px; display: grid; gap: 2px; }
.news li b { font-weight: 600; }
.news li span { color: var(--ink); }
.news li span.when { font: 500 12px var(--mono); color: var(--muted); }
.news li span.names { color: var(--muted); font-size: 14px; }
.earlier { max-width: 860px; }
.earlier > summary { cursor: pointer; font-weight: 600; color: var(--muted); }
.earlier[open] > summary { margin-bottom: 8px; }
/* Earlier changes: one panel, a row per card. */
.news.compact { gap: 0; background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; }
.news.compact li { background: none; border: 0; border-radius: 0; padding: 8px 12px; font-size: 14px; }
.news.compact li + li { border-top: 1px solid var(--rule); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr)); gap: 14px; }
.item { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.head { display: flex; gap: 10px; align-items: baseline; }
.num { font: 600 13px var(--mono); color: var(--signal); }
.lab { display: block; font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
.what ul { margin: 6px 0 0; padding-left: 20px; }
.facts { margin: 0; display: grid; gap: 6px; }
.facts div { display: grid; grid-template-columns: 52px 1fr; gap: 8px; }
.facts dt { font: 600 11px/1.9 var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 0; }
textarea:focus-visible, input:focus-visible, .jump:focus-visible, summary:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.note { display: grid; gap: 2px; }
.note span { font: 600 11px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
textarea { width: 100%; font: 14px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 8px; padding: 7px 9px; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1em; }
.sec { display: grid; gap: 8px; }
.sec > p { color: var(--muted); }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 10px; }
.card { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 10px 12px; display: grid; gap: 8px; min-width: 0; align-content: start; }
.ct { display: grid; gap: 2px; }
.ct span { color: var(--muted); font-size: 14px; }
.q { border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); padding: 12px 14px; display: grid; gap: 8px; margin: 0; min-width: 0; }
.q legend { font: 600 16px var(--body); padding: 0 4px; }
.q .why { color: var(--muted); font-size: 14px; }
.opt { display: flex; gap: 8px; align-items: flex-start; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); }
.qs { display: grid; gap: 12px; max-width: 760px; }
.empty { color: var(--muted); }
/* To test: what changed, and the link. */
.card.todo { border-left: 4px solid var(--maybe); }
.card.todo[data-now="1"] { border-left-color: var(--signal); }
.card.todo[data-status="new"]:not([data-now="1"]) { border-left-color: var(--rule); }
.chip { font: 600 11px var(--mono); letter-spacing: .03em; border-radius: 999px; padding: 2px 8px; background: var(--chip); color: var(--ink); white-space: nowrap; }
.chip.now { background: var(--signal); color: var(--paper); }
.chip.retest { background: var(--maybe); color: var(--paper); }
.ct .tline { color: var(--ink); }
.ct .tlast { font: 500 12px var(--mono); }
.ct .chip { font-size: 11px; }
/* Results (Done, Cut cards): as copied from the game logs. */
.card.result .look { font-size: 13px; }
.res { display: grid; gap: 2px; font-size: 14px; }
.res .rv { font-weight: 600; color: var(--muted); }
.card[data-v="keep"] .rv, .card[data-v="approve"] .rv, [data-mark][data-v="approve"] .rv, [data-mark][data-v="keep"] .rv { color: var(--go); }
.card[data-v="tune"] .rv, [data-mark][data-v="change"] .rv { color: var(--maybe); }
.card[data-v="cut"] .rv, [data-mark][data-v="cut"] .rv, [data-mark][data-v="drop"] .rv { color: var(--drop); }
.res .rs { font: 500 12px var(--mono); color: var(--muted); }
.card.result[data-v="keep"] { border-color: var(--go); }
.card.result[data-v="tune"] { border-color: var(--maybe); }
.card.result[data-v="cut"] { border-color: var(--drop); }
a.play { justify-self: start; font: 600 13px var(--body); color: var(--signal); text-decoration: none; border: 1px solid var(--signal); border-radius: 999px; padding: 4px 12px; }
a.play:focus-visible, .docline a:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.hidden { display: none !important; }
.rhead { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.rround { font: 600 11px var(--mono); letter-spacing: .03em; background: var(--chip); color: var(--ink); border-radius: 999px; padding: 2px 8px; }
.rround:empty, .rch:empty, .rn:empty, .rs:empty { display: none; }
.res .rch { font-size: 13px; color: var(--muted); }
.rhist { font-size: 13px; color: var(--muted); }
.rhist summary { cursor: pointer; }
.rhist ul { margin: 4px 0 0; padding-left: 18px; }
/* The Archive: one fold, closed. */
.archive { border-top: 2px solid var(--rule); padding-top: 14px; scroll-margin-top: 70px; }
.archive > summary { cursor: pointer; list-style: none; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.archive > summary::-webkit-details-marker { display: none; }
.archive > summary h2::before { content: "▸ "; color: var(--signal); }
.archive[open] > summary h2::before { content: "▾ "; }
.archive-body { display: grid; gap: 28px; padding-top: 18px; }
.archive-body > section { display: grid; gap: 12px; }
.archive-body > section > h3 { font-size: 24px; text-transform: uppercase; }
.archive-body > section > p { max-width: 72ch; color: var(--muted); }
@media (max-width: 520px) { .facts div { grid-template-columns: 1fr; gap: 0; } }
@media (prefers-reduced-motion: no-preference) { .card { transition: border-color .2s; } }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · Test Lab</div>
    <h1>Test Lab</h1>
    <p>Only what's new: this round's changes to the game, the cards to test, and any open questions. Everything already tested at its current version, every answered question and the original design round are in the <b>Archive</b> at the bottom.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Tally">
    <span class="tally" id="tally" aria-live="polite"></span>
    <button type="button" class="jump" id="to-archive">Archive ↓</button>
  </nav>

  <section class="pane" id="this-round" aria-labelledby="h-round">
    <div class="roundhead">
      <div class="eyebrow">This round${ROUND.date ? ` · ${esc(ROUND.date)}` : ''}</div>
      <h2 id="h-round">${esc(ROUND_TITLE)}</h2>
      ${DOC ? `<p class="docline">${esc(DOC.summary)} <a href="${esc(`${repo}/${DOC.doc}`)}" target="_blank" rel="noopener">The design note ↗</a></p>` : ''}
    </div>

    <section class="block" aria-labelledby="h-news">
      <h3 id="h-news">What's new in the game</h3>
      ${NEWS.length ? `<ul class="news">${NEWS.map((n) => `<li>${newsHead(n.names)}<span>${esc(n.what)}</span></li>`).join('\n')}</ul>` : `<p class="empty">No card changed in round ${ROUND.n}.</p>`}
      <details class="earlier hidden" id="earlier"><summary id="earlier-sum"></summary><ul class="news compact" id="earlier-list"></ul></details>
    </section>

    <section class="block" aria-labelledby="h-totest">
      <h3 id="h-totest">To test</h3>
      <p>Cards never tested, and cards changed since your latest verdict on them. This round's changes first. Each link opens that test in the game; your verdict shows here once Claude copies it over from your game logs (at the start of each session).</p>
      <p class="tally" id="totest-tally"></p>
      <div class="block" id="totest-list"></div>
    </section>

    <section class="block" aria-labelledby="h-open">
      <h3 id="h-open">Open questions</h3>
      <div class="qs" id="open-qs">${OPEN_QUESTIONS.map(openQuestion).join('\n')}</div>
      <p class="empty" id="no-open">No open questions</p>
    </section>
  </section>

  <details class="archive" id="archive">
    <summary><h2>Archive</h2><span class="tally" id="archive-tally"></span></summary>
    <div class="archive-body">
      <section aria-labelledby="h-done">
        <h3 id="h-done">Done</h3>
        <p>Cards whose latest verdict is on their current version. If a later build changes one, it moves back to To test. Earlier rounds fold under each.</p>
        <div class="block" id="done-list"></div>
      </section>

      <section aria-labelledby="h-answered">
        <h3 id="h-answered">Answered questions</h3>
        <p>Your saved choice and note on each, read only.</p>
        <ul class="cards" id="answered-list">${OPEN_QUESTIONS.map((q) => answeredRow(q.id, q.text, `Round ${q.round}`)).join('\n')}
          ${OLD_QS.map((q) => answeredRow(q.id, q.q, `Design round · ${ROUND_DATE}`)).join('\n')}</ul>
      </section>

      <section aria-labelledby="h-design">
        <h3 id="h-design">The original design round</h3>
        <p>The Test Lab as it was designed on ${esc(ROUND_DATE)}, with your marks. It was built from them; read only now.</p>
        <blockquote>“${esc(ASK)}”</blockquote>
        <div><span class="lab">What made testing slow then</span><ul class="today">${TODAY.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <h4>The pieces</h4>
        <div class="grid">${PIECES.map((p, k) => pieceRow(p, String(k + 1).padStart(2, '0'))).join('\n')}</div>
        <h4>The first checklist</h4>
        ${SECTIONS.map((s) => `<section class="sec" aria-labelledby="sec-${s.id}"><h4 id="sec-${s.id}">${esc(s.name)}</h4><p>${esc(s.blurb)}</p>
          <ul class="cards">${CARDS.filter((c) => c.section === s.id).map(listRow).join('\n')}</ul></section>`).join('\n')}
      </section>

      ${(LAB.retired ?? []).length ? `<section aria-labelledby="h-cut"><h3 id="h-cut">Cut cards</h3><p>Cards taken out of the lab. Their verdicts stay here; they aren't tested again.</p>
        <ul class="cards" id="cut-list"></ul></section>` : ''}
    </div>
  </details>
</main>

<script>
(() => {
  // The live split (tools/v3/test-lab/split.mjs).
  ${[cardStatus, changesSince, splitCards, groupBySection, untestedEarlier, isAnswered].map((f) => f.toString()).join('\n  ')}
  const ROUND = ${ROUND.n};
  const GAME = ${js(GAME_URL)};
  const SECTIONS = ${js(LAB.sections)};
  const CARDS = ${js(LAB.cards.map(({ id, kind, name, look, plays, rev, changes, own }) => ({ id, kind, name, look, plays, rev, changes, own })))};
  const RETIRED = ${js((LAB.retired ?? []).map(({ id, kind, name, look, cut, why }) => ({ id, kind, name, look, cut, why })))};
  const OPEN_QS = ${js(OPEN_QUESTIONS.map((q) => q.id))};
  const QOPTS = ${js(Object.fromEntries([...OPEN_QUESTIONS.map((q) => [q.id, q.options]), ...OLD_QS.map((q) => [q.id, q.options])]))};
  const MARKS = { reviews: { approve: 'Approved', change: 'Change', cut: 'Cut' }, cards: { keep: 'On the list', drop: 'Dropped' } };
  const VLABEL = { keep: 'Keep', tune: 'Tune', cut: 'Cut' };
  const state = { reviews: {}, cards: {}, answers: {}, results: {} };
  const COLLS = ['reviews', 'cards', 'answers', 'results'];
  const LS = 'straitwatch-test-lab-1';
  const touched = new Set();
  let db = null;
  // Until the store's results come in, To test would list every card.
  let ready = false;
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  const flash = (el, msg) => { if (el) el.textContent = msg; };
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // A card's link into the game.
  const playLink = (id) => { const a = h('a', 'play', 'Test in game ↗'); a.href = GAME + '?lab=' + encodeURIComponent(id); a.target = '_blank'; a.rel = 'noopener'; return a; };

  // ---- A result card (Done, Cut cards): verdict, note, setup, earlier rounds.
  const resEls = {};
  function resultEl(card, cut) {
    if (resEls[card.id]) return resEls[card.id];
    const li = h('li', 'card result');
    const ct = h('div', 'ct');
    ct.append(h('b', '', card.name), h('span', 'look', card.look));
    if (card.plays) ct.append(h('span', 'look', card.plays));
    const res = h('div', 'res');
    const head = h('span', 'rhead');
    head.append(h('span', 'rround'), h('span', 'rv'));
    res.append(head);
    if (cut) res.append(h('span', 'rch', 'Cut in round ' + card.cut + ': ' + card.why));
    const det = h('details', 'rhist hidden');
    det.append(h('summary'), h('ul'));
    res.append(h('span', 'rch rchg'), h('span', 'rn'), h('span', 'rs'), det);
    li.append(ct, res);
    if (!cut) li.append(playLink(card.id));
    return (resEls[card.id] = li);
  }
  function paintResult(li, card, r) {
    const round = r ? r.round || 1 : 0;
    li.dataset.v = r && r.verdict ? r.verdict : '';
    li.querySelector('.rround').textContent = r ? 'Round ' + round : '';
    li.querySelector('.rv').textContent = r ? (r.verdict ? VLABEL[r.verdict] : 'Tested') + (r.tags && r.tags.length ? ' · ' + r.tags.join(', ') : '') : 'Not tested';
    const changed = r ? (Array.isArray(r.changes) ? r.changes : (card.changes || []).filter((x) => x.round === round).map((x) => x.what)) : [];
    li.querySelector('.rchg').textContent = changed.length ? 'Changed for round ' + round + ': ' + changed.join(' · ') : '';
    li.querySelector('.rn').textContent = r && r.note ? '“' + r.note + '”' : '';
    // A map card (round 10): how the run was set up, before its evidence.
    li.querySelector('.rs').textContent = r ? [r.setup, r.evidence].filter(Boolean).join(' · ') : '';
    const hist = r && Array.isArray(r.history) ? r.history : [];
    const det = li.querySelector('.rhist');
    det.classList.toggle('hidden', !hist.length);
    det.querySelector('summary').textContent = 'Earlier rounds (' + hist.length + ')';
    det.querySelector('ul').replaceChildren(...hist.map((x) => h('li', '', ['Round ' + (x.round || 1), x.plays === 'full' ? 'Full map' : x.plays === 'slice' ? 'Quick slice' : '', x.verdict ? VLABEL[x.verdict] : 'Tested', x.note ? '“' + x.note + '”' : ''].filter(Boolean).join(' · '))));
  }

  // ---- A card to test: why it's here, its newest change, and the link.
  const todoEls = {};
  function todoEl(e) {
    let li = todoEls[e.card.id];
    if (!li) {
      li = h('li', 'card todo');
      const ct = h('div', 'ct');
      const head = h('span', 'rhead');
      head.append(h('b', '', e.card.name), h('span', 'chip'));
      ct.append(head, h('span', 'tline'), h('span', 'tlast'));
      li.append(ct, playLink(e.card.id));
      todoEls[e.card.id] = li;
    }
    li.dataset.status = e.status;
    li.dataset.now = e.now ? '1' : '';
    const chip = li.querySelector('.chip');
    chip.className = 'chip ' + (e.now ? 'now' : e.status);
    chip.textContent = e.now ? 'Changed this round' : e.status === 'retest' ? 'Changed since your test' : 'Never tested';
    // The newest change; in a round with several, the card's own line (a
    // combo lists its own lines before its enemies').
    const newest = e.since.length ? e.since[e.since.length - 1].round : 0;
    const last = e.since.find((c) => c.round === newest);
    li.querySelector('.tline').textContent = last ? 'Round ' + last.round + ': ' + last.what + (e.since.length > 1 ? ' (and ' + plural(e.since.length - 1, 'earlier change', 'earlier changes') + ')' : '') : e.card.look;
    const r = e.result;
    li.querySelector('.tlast').textContent = r ? 'Your last test: round ' + (r.round || 1) + (r.verdict ? ', ' + VLABEL[r.verdict] : '') : '';
    return li;
  }

  // Sections, kept so a card list keeps its element (and open folds).
  const secEls = {};
  function sectionEl(key, s) {
    if (secEls[key]) return secEls[key];
    const sec = h('section', 'sec');
    sec.append(h('h4', '', s.name), h('p', '', s.blurb), h('ul', 'cards'));
    return (secEls[key] = sec);
  }
  function fill(box, groups, prefix, item) {
    box.replaceChildren(...groups.map((g) => {
      const sec = sectionEl(prefix + g.section.kind, g.section);
      sec.querySelector('ul').replaceChildren(...g.entries.map(item));
      return sec;
    }));
  }

  function paintCards() {
    const { toTest, done } = splitCards(CARDS, state.results, ROUND);
    const box = document.getElementById('totest-list');
    if (!ready) { box.replaceChildren(h('p', 'empty', 'Reading your results…')); }
    else if (!toTest.length) { box.replaceChildren(h('p', 'empty', 'Nothing to test: every card has a verdict on its current version.')); }
    else fill(box, groupBySection(toTest, SECTIONS), 'tt-', todoEl);
    fill(document.getElementById('done-list'), groupBySection(done, SECTIONS), 'dn-', (e) => { const li = resultEl(e.card, false); paintResult(li, e.card, e.result); return li; });
    if (!done.length) document.getElementById('done-list').replaceChildren(h('p', 'empty', ready ? 'No card has a verdict on its current version yet.' : 'Reading your results…'));
    const cut = document.getElementById('cut-list');
    if (cut) cut.replaceChildren(...RETIRED.map((c) => { const li = resultEl(c, true); paintResult(li, c, state.results[c.id]); return li; }));
    // Earlier changes the player hasn't tested yet.
    const early = ready ? untestedEarlier(CARDS, state.results, ROUND) : [];
    const n = early.reduce((m, e) => m + e.lines.length, 0);
    document.getElementById('earlier').classList.toggle('hidden', !early.length);
    document.getElementById('earlier-sum').textContent = 'From earlier rounds, not tested since: ' + plural(n, 'change', 'changes') + ' on ' + plural(early.length, 'card', 'cards');
    document.getElementById('earlier-list').replaceChildren(...early.map((e) => { const li = h('li'); li.append(h('b', '', e.card.name), ...e.lines.map((l) => { const s = h('span'); s.append(h('span', 'when', 'Round ' + l.round + ' · '), document.createTextNode(l.what)); return s; })); return li; }));
    const now = toTest.filter((e) => e.now).length;
    const re = toTest.filter((e) => !e.now && e.status === 'retest').length;
    const nw = toTest.filter((e) => !e.now && e.status === 'new').length;
    document.getElementById('totest-tally').textContent = ready ? [now ? now + ' changed this round' : '', re ? re + ' changed since your test' : '', nw ? nw + ' never tested' : ''].filter(Boolean).join(' · ') : '';
    return { toTest: toTest.length, done: done.length };
  }

  // ---- Questions: open ones take answers; answered ones are read only in the Archive.
  function paintQuestions() {
    // Shown: unanswered, or answered on this visit (it stays until a reload).
    let shown = 0;
    let open = 0;
    let answered = 0;
    for (const id of OPEN_QS) {
      const a = state.answers[id];
      const show = !isAnswered(a) || touched.has(id);
      const f = document.querySelector('.q[data-q="' + id + '"]');
      f.classList.toggle('hidden', !show);
      if (show) shown++;
      if (!isAnswered(a)) open++;
      if (!touched.has(id)) {
        document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = !!a && String(a.choice) === i.value; });
        const ta = document.getElementById('qn-' + id);
        if (ta && document.activeElement !== ta && a && typeof a.note === 'string') ta.value = a.note;
      }
    }
    document.querySelectorAll('[data-aq]').forEach((row) => {
      const id = row.dataset.aq;
      const a = state.answers[id];
      const isOpen = OPEN_QS.includes(id) && (!isAnswered(a) || touched.has(id));
      row.classList.toggle('hidden', isOpen);
      if (isOpen) return;
      if (isAnswered(a)) answered++;
      const opts = QOPTS[id] || [];
      row.querySelector('[data-ans]').textContent = a && a.choice != null ? 'Your answer: ' + (opts[a.choice] != null ? opts[a.choice] : 'option ' + (a.choice + 1)) : isAnswered(a) ? 'Your note' : 'No answer saved';
      row.querySelector('[data-anote]').textContent = a && a.note ? '“' + a.note + '”' : '';
    });
    document.getElementById('no-open').classList.toggle('hidden', shown > 0);
    return { open, answered };
  }

  // ---- The design round's marks, read only.
  function paintMarks() {
    document.querySelectorAll('[data-mark]').forEach((el) => {
      const r = state[el.dataset.mark][el.dataset.id] || {};
      el.dataset.v = r.verdict || '';
      el.querySelector('[data-mv]').textContent = r.verdict ? MARKS[el.dataset.mark][r.verdict] || r.verdict : 'Not marked';
      el.querySelector('[data-mn]').textContent = r.note ? '“' + r.note + '”' : '';
    });
  }

  function paintAll() {
    const c = paintCards();
    const q = paintQuestions();
    paintMarks();
    document.getElementById('tally').textContent = (ready ? plural(c.toTest, 'card', 'cards') + ' to test' : 'Reading your results…') + ' · ' + plural(q.open, 'open question', 'open questions');
    document.getElementById('archive-tally').textContent = [ready ? c.done + ' done' : '', plural(q.answered, 'answered question', 'answered questions'), 'the design round', RETIRED.length ? RETIRED.length + ' cut' : ''].filter(Boolean).join(' · ');
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
      flash(statusEl, 'Saved. It moves to the Archive the next time you open this page.');
    } catch (e) {
      flash(statusEl, e && (e.code === 'not_granted' || e.code === 'permission_denied') ? 'You can read this page but not save to it.' : 'Couldn’t save. Check your connection and try again.');
    } finally { delete busy[coll + id]; }
  }
  document.querySelectorAll('.q[data-q]').forEach((f) => {
    const id = f.dataset.q, st = f.querySelector('.saved');
    const ta = document.getElementById('qn-' + id);
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => { touched.add(id); save('answers', id, { choice: Number(i.value), note: ta.value }, st); }));
    let t;
    ta.addEventListener('input', () => { touched.add(id); clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.answers[id] || {}).note !== ta.value && ta.value !== '') save('answers', id, { note: ta.value }, st); });
  });
  const archive = document.getElementById('archive');
  document.getElementById('to-archive').addEventListener('click', () => { archive.open = true; archive.scrollIntoView({ block: 'start' }); });

  const local = lsGet();
  for (const c of COLLS) Object.assign(state[c], local[c] || {});
  const note = document.getElementById('store');
  const use = window.claude && window.claude.use;
  if (!use) { ready = true; paintAll(); note.textContent = 'Open this page on claude.ai, signed in, to see your results and save your answers. Answers made here stay in this browser.'; return; }
  paintAll();
  const giveUp = () => { if (!ready) { ready = true; paintAll(); } };
  const timer = setTimeout(() => { note.textContent = 'The review store isn’t answering yet. Answers you give are kept in this browser until it does.'; giveUp(); }, 10000);
  use('db').then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Answers stay in this browser.'; giveUp(); return; }
    db = d;
    note.textContent = 'Your results come from your game logs; answers you give here save to this page for the next session to read.';
    // Marks left in this browser before the store answered (any collection,
    // from this page or its earlier layout) are pushed once, then cleared.
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
        if (coll === 'results') ready = true;
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the review store. Reload to try again.'; giveUp(); });
    }
  }, () => { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Answers stay in this browser.'; giveUp(); });
})();
</script>
`;
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: round ${ROUND.n}, ${NEWS.length} change lines this round, ${LAB.cards.length} cards, ${OPEN_QUESTIONS.length} open questions${DOC ? `, doc ${DOC.doc}` : ''})`);
