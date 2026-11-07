// Builds the review page for the enemy round (an HTML artifact with a
// database, like the weapon rounds): the taxonomy with every enemy placed in
// it, the player's 18 ideas with my read, the ten new ideas, the cut ones
// (Bring back), and the open questions. Marks save to the artifact's store:
// `reviews/{ideaId}`: verdict (go | maybe | drop | revive), note;
// `answers/{questionId}`: choice (option index), note.
// Usage: node tools/v3/enemy-ideas/page.mjs <out.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ROUND_DATE, ANSWERS, PRESSURES, SHAPES, CATEGORIES, TODAY, PLAYER, NEW, ARSENAL, QUESTIONS } from './enemies.mjs';

const root = new URL('../../../', import.meta.url);
const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const para = (s) => esc(s).split('\n\n').map((p) => `<p>${p}</p>`).join('');
const img = (id) => {
  const p = new URL(`docs/design/img/enemy-ideas/concept-${id}.jpg`, root);
  return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : null;
};
const catName = (c) => CATEGORIES.find((x) => x.id === c).name;
const subName = (c, s) => CATEGORIES.find((x) => x.id === c).subs.find((x) => x.id === s).name;
const where = (e) => `${catName(e.cat)} · ${subName(e.cat, e.sub)}`;
const REC = { pick: 'My read: pick', merge: 'My read: merge', maybe: 'My read: maybe', skip: 'My read: skip' };
const COST = { small: 'Small build', medium: 'Medium build', large: 'Large build' };
const counters = (ids) => ids.map((id) => esc(ARSENAL[id])).join(', ');

const kept = NEW.filter((i) => i.status === 'keep');
const cut = NEW.filter((i) => i.status === 'cut');
const MARKABLE = [...PLAYER.map((p) => p.id), ...kept.map((i) => i.id)];

function figure(id, name) {
  const pic = img(id);
  return pic ? `<figure><img src="${pic}" alt="Concept: ${esc(name)}, drawn over a real wave on The Strait" loading="lazy" width="536" height="300"><figcaption>Concept over a real wave, phone size</figcaption></figure>` : '';
}

function verdicts(id, name) {
  return `<div class="review" role="group" aria-label="Your call on ${esc(name)}">
    <div class="seg">
      <button type="button" data-v="go" aria-pressed="false">Go further</button>
      <button type="button" data-v="maybe" aria-pressed="false">Maybe</button>
      <button type="button" data-v="drop" aria-pressed="false">Drop</button>
    </div>
    <label class="note"><span>Notes</span><textarea id="n-${id}" rows="2" placeholder="Changes, numbers, what you'd want to try"></textarea></label>
    <div class="saved" aria-live="polite"></div>
  </div>`;
}

function playerCard(p) {
  return `<article class="idea" id="idea-${p.id}" data-coll="reviews" data-id="${p.id}" data-group="player" data-rec="${p.rec}">
  <header>
    <div class="no">#${p.n}</div>
    <div class="ttl">
      <h3>${esc(p.name)}</h3>
      <div class="chips">${p.yours ? '<span class="chip yours">Your idea</span>' : '<span class="chip">Your list</span>'}<span class="chip">${esc(where(p))}</span><span class="chip rec rec-${p.rec}">${REC[p.rec]}</span></div>
    </div>
  </header>
  ${figure(p.id, p.name)}
  <details class="more said"><summary>What you wrote</summary>${para(p.said)}</details>
  <p class="read"><b>${REC[p.rec]}.</b> ${esc(p.why)}</p>
  <dl class="facts">
    <div><dt>The tell</dt><dd>${esc(p.tell)}</dd></div>
    <div><dt>Closest today</dt><dd>${esc(p.closest)}</dd></div>
    <div><dt>Your answers to it</dt><dd>${counters(p.counters)}</dd></div>
    <div><dt>${COST[p.cost]}</dt><dd>${esc(p.costWhy)}</dd></div>
  </dl>
  ${verdicts(p.id, p.name)}
</article>`;
}

function newCard(i, n) {
  return `<article class="idea" id="idea-${i.id}" data-coll="reviews" data-id="${i.id}" data-group="new">
  <header>
    <div class="no">N${n}</div>
    <div class="ttl">
      <h3>${esc(i.name)}</h3>
      <div class="chips"><span class="chip">${esc(where(i))}</span><span class="chip ax">Answer: ${esc(ANSWERS[i.answer])}</span><span class="chip ax">Takes: ${esc(PRESSURES[i.pressure])}</span></div>
    </div>
  </header>
  <p class="pitch">${esc(i.pitch)}</p>
  ${figure(i.id, i.name)}
  <p class="decision"><b>The decision:</b> ${esc(i.decision)}</p>
  <details class="more"><summary>How it plays</summary>
    <p>${esc(i.how)}</p>
    <p class="new"><b>What’s new.</b> ${esc(i.novel)}</p>
  </details>
  <dl class="facts">
    <div><dt>The tell</dt><dd>${esc(i.tell)}</dd></div>
    <div><dt>Your answers to it</dt><dd>${counters(i.counters)}</dd></div>
    <div><dt>${COST[i.cost]}</dt><dd>${esc(i.costWhy)}</dd></div>
  </dl>
  ${verdicts(i.id, i.name)}
</article>`;
}

function cutRow(i) {
  return `<li class="cut" id="idea-${i.id}" data-coll="reviews" data-id="${i.id}">
  <div class="cutline"><b>${esc(i.name)}</b> <span class="chip">${esc(where(i))}</span><p>${esc(i.pitch)}</p><p class="why"><b>Cut:</b> ${esc(i.why)}</p></div>
  <div class="review compact"><div class="seg"><button type="button" data-v="revive" aria-pressed="false">Bring back</button></div>
  <label class="note"><span>Notes</span><textarea id="n-${i.id}" rows="1" placeholder="Why bring it back?"></textarea></label><div class="saved" aria-live="polite"></div></div>
</li>`;
}

function question(q) {
  return `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o)}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
}

// The taxonomy: each subcategory lists today's enemies, the player's ideas
// and the new ones, so the player sees where everything sits.
function member(e, src) {
  const tag = src === 'today' ? 'today' : src === 'player' ? `#${e.n}` : 'new';
  const href = src === 'today' ? '' : ` href="#idea-${e.id}" data-jump="${src}"`;
  const el = src === 'today' ? 'span' : 'a';
  return `<${el} class="m m-${src}"${href}><span class="mt">${esc(tag)}</span>${esc(e.name)}</${el}>`;
}
const taxonomy = CATEGORIES.map((c) => `<section class="tx" aria-labelledby="tx-${c.id}">
  <h3 id="tx-${c.id}">${esc(c.name)}</h3>
  <p class="rule">${esc(c.rule)}</p>
  <div class="subs">${c.subs.map((s) => {
    const list = [
      ...TODAY.filter((e) => e.cat === c.id && e.sub === s.id).map((e) => member(e, 'today')),
      ...PLAYER.filter((e) => e.cat === c.id && e.sub === s.id).map((e) => member(e, 'player')),
      ...kept.filter((e) => e.cat === c.id && e.sub === s.id).map((e) => member(e, 'new')),
    ];
    return `<div class="sub"><h4>${esc(s.name)} <span class="cnt">${list.length}</span></h4><p class="pn">${esc(s.rule)}</p><div class="ms">${list.join('')}</div></div>`;
  }).join('')}</div>
</section>`).join('\n');

const others = [...TODAY, ...PLAYER];
const onlyNew = (k, dict) => [...new Set(kept.map((i) => i[k]))].filter((a) => !others.some((o) => o[k] === a)).map((a) => dict[a]);
const picks = PLAYER.filter((p) => p.rec === 'pick');

const html = `<title>Enemy Ideas Shortlist</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: a chart-room briefing, the same family as the weapon reviews but
   with the enemy's red as its signal. A sticky strip of tabs and a tally;
   cards in a two-column grid that drops to one on a phone. */
:root {
  --sea: #e9eef1; --paper: #f8fafb; --ink: #14202a; --muted: #536370; --rule: #cfd9e0;
  --signal: #b4321f; --friend: #0b7c78; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c;
  --chip: #dde6ec; --today: #5b6b78; --new: #6d3fb5;
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #ff7a63; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1c2c39; --today: #9fb0bd; --new: #c4a6ff; color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0b141b; --paper: #121e28; --ink: #e4ecf1; --muted: #93a5b3; --rule: #24384a;
  --signal: #ff7a63; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1c2c39; --today: #9fb0bd; --new: #c4a6ff; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 26px; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 72ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
.intro p { margin: 0; color: var(--muted); }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.tabs { display: flex; gap: 4px; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
.tabs::-webkit-scrollbar { display: none; }
.tabs button { flex: none; }
.tabs button, .seg button { font: 600 13px/1 var(--body); border: 1px solid var(--rule); background: var(--paper); color: var(--ink); padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 13px/1.3 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.tally b { color: var(--go); }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.pane { display: grid; gap: 14px; }
.cathead { display: grid; gap: 4px; }
.cathead h2 { font-size: 28px; text-transform: uppercase; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
.count { font: 500 14px var(--mono); color: var(--go); }
.cathead p { margin: 0; color: var(--muted); max-width: 75ch; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
.idea, .q, .tx { scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 96px); }
.idea { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.idea[data-v="go"] { border-color: var(--go); box-shadow: inset 4px 0 0 var(--go); }
.idea[data-v="maybe"] { border-color: var(--maybe); }
.idea[data-v="drop"] { opacity: 0.62; }
.idea header { display: flex; gap: 12px; align-items: flex-start; }
.no { font: 700 13px/1 var(--mono); color: var(--signal); border: 1.5px solid var(--signal); border-radius: 5px; padding: 5px 6px; min-width: 38px; text-align: center; }
.ttl { display: grid; gap: 6px; min-width: 0; }
.ttl h3 { font-size: 22px; line-height: 1.1; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 600 11px/1.1 var(--body); letter-spacing: 0.04em; text-transform: uppercase; background: var(--chip); color: var(--muted); padding: 4px 7px; border-radius: 4px; }
.chip.yours { background: var(--signal); color: var(--paper); }
.chip.ax { text-transform: none; letter-spacing: 0; color: var(--new); }
.rec-pick { color: var(--go); }
.rec-merge { color: var(--friend); }
.rec-maybe { color: var(--maybe); }
.pitch { margin: 0; font-size: 16px; font-weight: 500; }
.decision, .read { margin: 0; }
.read b { color: var(--ink); }
figure { margin: 0; display: grid; gap: 4px; }
figure img { width: 100%; height: auto; border-radius: 6px; display: block; border: 1px solid var(--rule); background: #0e1a24; }
figcaption { font-size: 12px; color: var(--muted); }
.more summary { cursor: pointer; font-weight: 600; color: var(--friend); }
.more p { margin: 8px 0 0; }
.said { border-left: 3px solid var(--signal); padding-left: 10px; }
.said p { color: var(--muted); font-style: italic; }
.new { color: var(--muted); }
.new b { color: var(--ink); }
.facts { margin: 0; display: grid; gap: 6px; }
.facts div { display: grid; grid-template-columns: 9.5em 1fr; gap: 8px; min-width: 0; }
.facts dt { font: 600 12px/1.5 var(--mono); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.facts dd { margin: 0; font-size: 14px; min-width: 0; }
.pn { margin: 0; font-size: 13px; color: var(--muted); }
.review { display: grid; gap: 8px; margin-top: auto; padding-top: 6px; }
.seg { display: flex; flex-wrap: wrap; gap: 6px; }
.seg button[data-v="go"][aria-pressed="true"] { background: var(--go); border-color: var(--go); color: var(--paper); }
.seg button[data-v="maybe"][aria-pressed="true"] { background: var(--maybe); border-color: var(--maybe); color: var(--paper); }
.seg button[data-v="drop"][aria-pressed="true"] { background: var(--drop); border-color: var(--drop); color: var(--paper); }
.seg button[data-v="revive"][aria-pressed="true"] { background: var(--friend); border-color: var(--friend); color: var(--paper); }
.note { display: grid; gap: 4px; }
.note span { font-size: 12px; color: var(--muted); }
textarea { font: 14px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 6px; padding: 8px; width: 100%; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1.2em; }
.cuts ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.cut { background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; padding: 10px 12px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); gap: 12px; }
.cut[data-v="revive"] { border-color: var(--friend); }
.cutline p { margin: 4px 0 0; font-size: 14px; color: var(--muted); }
.cutline .why b { color: var(--ink); }
.qs { display: grid; gap: 12px; }
.q { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; margin: 0; }
.q legend { font-weight: 600; padding: 0; float: left; width: 100%; margin-bottom: 6px; }
.opt { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); }
.sub2 { font-size: 21px; text-transform: uppercase; margin-top: 8px; border-top: 1px solid var(--rule); padding-top: 14px; }
.tx { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: grid; gap: 8px; }
.tx h3 { font-size: 24px; text-transform: uppercase; color: var(--signal); }
.tx .rule { margin: 0; max-width: 75ch; }
.subs { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 10px; }
.sub { border-top: 1px dashed var(--rule); padding-top: 8px; display: grid; gap: 6px; align-content: start; }
.sub h4 { font-size: 18px; text-transform: uppercase; }
.cnt { font: 500 12px var(--mono); color: var(--muted); }
.ms { display: flex; flex-wrap: wrap; gap: 5px; }
.m { display: inline-flex; gap: 5px; align-items: baseline; font-size: 13px; padding: 3px 7px; border-radius: 4px; background: var(--chip); color: var(--ink); text-decoration: none; }
.mt { font: 600 10px var(--mono); text-transform: uppercase; }
.m-today .mt { color: var(--today); }
.m-player .mt { color: var(--signal); }
.m-new .mt { color: var(--new); }
.m-player, .m-new { border: 1px solid var(--rule); }
.legend { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 13px; color: var(--muted); }
.axes { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
.hidden { display: none !important; }
@media (max-width: 600px) {
  .bar-sticky { gap: 6px; padding-block: 8px; }
  .tabs button { padding: 7px 10px; font-size: 12.5px; }
  .tally { font-size: 12px; }
  .cut { grid-template-columns: 1fr; }
  .facts div { grid-template-columns: 1fr; gap: 0; }
}
@media (prefers-reduced-motion: no-preference) { .idea { transition: border-color .2s, opacity .2s; } }
code { font: 13px var(--mono); }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · enemy round 1 · ${ROUND_DATE}</div>
    <h1>Enemy Ideas Shortlist</h1>
    <p>The same process as the weapons, for the enemy. <b>Overview</b> sorts every enemy, today’s ${TODAY.length} and every idea here, into three categories by what it does in a fight, each with its subcategories. <b>Your 18</b> has your ideas with my read on each (I’d pick ${picks.length}). <b>New 10</b> has the ten I kept from ${kept.length + cut.length}, each built to make you decide something no enemy asks today; the ${cut.length} I cut are listed with why. <b>Questions</b> has ${QUESTIONS.length} decisions before a build.</p>
    <p>Mark each idea Go further, Maybe or Drop, and add notes. Every picture is the idea drawn over a real wave, at phone size. Everything saves as you go, for the next session to read.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Sections">
    <div class="tabs" role="group" aria-label="Section">
      <button type="button" data-tab="overview" aria-pressed="true">Overview</button>
      <button type="button" data-tab="player" aria-pressed="false">Your 18</button>
      <button type="button" data-tab="new" aria-pressed="false">New 10</button>
      <button type="button" data-tab="questions" aria-pressed="false">Questions</button>
      <button type="button" data-tab="go" aria-pressed="false">My picks</button>
    </div>
    <div class="tally" id="tally">0 of ${MARKABLE.length} marked</div>
  </nav>

  <section class="pane" id="pane-overview" aria-labelledby="h-overview">
    <div class="cathead"><h2 id="h-overview">Three categories</h2>
    <p>Split by role, like your weapons’ Active, Passive and Boost: the category says what kind of answer an enemy needs. Tap an idea to jump to its card.</p></div>
    <div class="legend"><span><b class="mt" style="color:var(--today)">TODAY</b> in the game now</span><span><b class="mt" style="color:var(--signal)">#N</b> your idea</span><span><b class="mt" style="color:var(--new)">NEW</b> one of my ten</span></div>
    ${taxonomy}
    <h3 class="sub2">How “different” was checked</h3>
    <p class="pn">Every enemy is tagged with what you do about it and what it takes from you. Today all ${TODAY.length} enemies ask one of three things (shoot it, kill its source, wait for the moment) and take one of three (your ships, safe water, how long enemies last). No new idea shares both tags with anything in the game or your list, and an independent review read them cold before this page was made.</p>
    <ul class="axes">
      <li><b>Answers only the new ideas use:</b> ${onlyNew('answer', ANSWERS).map(esc).join('; ')}.</li>
      <li><b>Pressures only they use:</b> ${onlyNew('pressure', PRESSURES).map(esc).join('; ')}.</li>
    </ul>
  </section>

  <section class="pane hidden" id="pane-player" aria-labelledby="h-player">
    <div class="cathead"><h2 id="h-player">Your 18 <span class="count" data-count="player"></span></h2>
    <p>Your words are under “What you wrote”. My read says which I’d build first and why, checked against how the game works today.</p></div>
    <div class="grid">${PLAYER.map(playerCard).join('\n')}</div>
  </section>

  <section class="pane hidden" id="pane-new" aria-labelledby="h-new">
    <div class="cathead"><h2 id="h-new">New 10 <span class="count" data-count="new"></span></h2>
    <p>Kept from ${kept.length + cut.length}. Each asks a question no enemy asks today, and each says what of yours answers it.</p></div>
    <div class="grid">${kept.map((i, k) => newCard(i, k + 1)).join('\n')}</div>
    <section class="cuts" id="sec-cuts" aria-labelledby="h-cuts">
      <h3 class="sub2" id="h-cuts">Cut (${cut.length})</h3>
      <p class="pn">Each was cut for the reason given. Bring one back if you disagree.</p>
      <ul>${cut.map(cutRow).join('\n')}</ul>
    </section>
  </section>

  <section class="pane hidden" id="pane-questions" aria-labelledby="h-questions">
    <div class="cathead"><h2 id="h-questions">Questions <span class="count" id="q-count"></span></h2>
    <p>The recommended option is first in each.</p></div>
    <div class="qs">${QUESTIONS.map(question).join('\n')}
      <fieldset class="q" data-q="en-notes"><legend>Anything else about the enemy round?</legend><label class="note"><span>Notes</span><textarea id="qn-en-notes" rows="3"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
    </div>
  </section>

  <section class="pane hidden" id="pane-go" aria-labelledby="h-go">
    <div class="cathead"><h2 id="h-go">My picks</h2><p id="go-empty">Ideas you mark Go further collect here.</p></div>
    <div class="grid" id="go-grid"></div>
  </section>
</main>

<script>
(() => {
  const MARKABLE = ${JSON.stringify(MARKABLE)};
  const GROUP = ${JSON.stringify(Object.fromEntries([...PLAYER.map((p) => [p.id, 'player']), ...kept.map((i) => [i.id, 'new'])]))};
  const QIDS = ${JSON.stringify(QUESTIONS.map((q) => q.id))};
  const state = { reviews: {}, answers: {} };
  const COLLS = ['reviews', 'answers'];
  let db = null;
  const LS = 'straitwatch-enemy-ideas-1';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  let tab = 'overview';

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
    const n = (k) => MARKABLE.filter((id) => v(id) === k).length;
    const marked = MARKABLE.filter((id) => v(id)).length;
    const qa = QIDS.filter((id) => state.answers[id] && state.answers[id].choice !== undefined && state.answers[id].choice !== null).length;
    document.getElementById('tally').innerHTML = marked + ' of ' + MARKABLE.length + ' marked · <b>' + n('go') + ' go further</b> · ' + n('maybe') + ' maybe · ' + n('drop') + ' drop · ' + qa + '/' + QIDS.length + ' answered';
    for (const g of ['player', 'new']) {
      const list = MARKABLE.filter((id) => GROUP[id] === g);
      const el = document.querySelector('[data-count="' + g + '"]');
      if (el) el.textContent = list.filter((id) => v(id)).length + ' / ' + list.length + ' marked';
    }
    document.getElementById('q-count').textContent = qa + ' / ' + QIDS.length + ' answered';
  }
  // My picks: the cards themselves move there (one card per idea, so its
  // buttons and notes stay the same element), and back when unpicked.
  const home = {};
  document.querySelectorAll('.idea').forEach((el) => { home[el.dataset.id] = el.parentElement; });
  function paintPicks() {
    const grid = document.getElementById('go-grid');
    const ids = MARKABLE.filter((id) => v(id) === 'go');
    document.getElementById('go-empty').classList.toggle('hidden', ids.length > 0);
    document.querySelectorAll('.idea').forEach((el) => {
      const want = tab === 'go' && ids.includes(el.dataset.id) ? grid : home[el.dataset.id];
      if (el.parentElement !== want) want.append(el);
    });
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    for (const p of ['overview', 'player', 'new', 'questions', 'go']) document.getElementById('pane-' + p).classList.toggle('hidden', p !== tab);
    paintPicks();
  }
  function paintAll() {
    document.querySelectorAll('[data-coll]').forEach(paintItem);
    document.querySelectorAll('.q').forEach((f) => paintQ(f.dataset.q));
    paintTally();
    paintTab();
  }

  const flash = (el, msg) => { if (el) el.textContent = msg; };
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
  const setTab = (t) => { tab = t; try { sessionStorage.setItem(LS + '-tab', tab); } catch {} paintTab(); };
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  // Overview links jump to the idea's card on its own tab.
  document.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    setTab(a.dataset.jump);
    const card = document.querySelector(a.getAttribute('href'));
    if (card) card.scrollIntoView({ block: 'start' });
  }));
  try { tab = sessionStorage.getItem(LS + '-tab') || 'overview'; } catch {}

  // Local copy first, then the shared store.
  const local = lsGet();
  Object.assign(state.reviews, local.reviews || {});
  Object.assign(state.answers, local.answers || {});
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
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: ${PLAYER.length} of the player's ideas, ${kept.length} new, ${cut.length} cut, ${QUESTIONS.length} questions, ${TODAY.length} enemies today)`);
