// Builds the review page for round 2's weapon ideas (an HTML artifact, like
// the maps review): every kept idea with Go further / Maybe / Drop and a note,
// the cut ideas with "Bring back", and the open decisions. Marks save to the
// artifact's database (collections `reviews/{ideaId}`: verdict, note;
// `answers/{questionId}`: choice, note) so the next session can read them.
// Usage: node tools/v3/weapon-ideas/page2.mjs <out.html>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { IDEAS, CATEGORY_RULES } from './arsenal2.mjs';

const here = new URL('.', import.meta.url);
const root = new URL('../../../', import.meta.url);
const R = JSON.parse(readFileSync(new URL('proto-results.json', here), 'utf8'));
const base = R.runs.none;
const out = process.argv[2];
if (!out) throw new Error('usage: node page2.mjs <out.html>');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const token = (t) =>
  t.replace(/\{\{(\w+)\.(a|s|da|ds)\}\}/g, (_, k, f) => {
    const r = R.runs[k];
    const d = (n, b) => `${n - b >= 0 ? '+' : '−'}${Math.abs(Math.round(n - b))}`;
    return f === 'a' ? `${r.average.clear}%` : f === 's' ? `${r.spammer.clear}%` : f === 'da' ? d(r.average.clear, base.average.clear) : d(r.spammer.clear, base.spammer.clear);
  });
const img = (id) => {
  const p = new URL(`docs/design/img/weapon-ideas-2/concept-${id}.jpg`, root);
  return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : null;
};

const CAT = {
  active: { label: 'Active', blurb: 'Takes over the gun for 15 s' },
  passive: { label: 'Passive', blurb: 'Your gun stays; it works on its own' },
  boost: { label: 'Boost', blurb: 'Never replaces the loaded weapon' },
};
const VERB = {
  tap: 'Tap', 'hold-release': 'Hold & release', swipe: 'Swipe', 'hold-steer': 'Hold & steer', 'catch-drag': 'Catch & drag',
  'mark-fire': 'Mark, then fire', 'two-tap': 'Two taps', timing: 'On the beat', auto: 'Automatic', 'finger-down': 'Finger down',
};
const TARGET = {
  threats: 'Threats', launchers: 'Launchers', sea: 'The sea', 'own-ships': 'Your ships', 'loss-rule': 'The loss rule', 'enemy-aim': "The enemy's aim",
  weather: 'Weather', drops: 'Drops', ammo: 'Ammo', 'loaded-weapon': 'The loaded weapon', time: 'Time',
};
const NOT_RUN = {
  wireguide: 'Needs a person steering.', grapnel: 'Needs a person dragging.', firecontrol: 'Its value is reading a raid; the bot doesn’t.',
  limpet: 'Needs threats to carry a charge in the sim.', tidal: 'Surface threats are rare on most maps.', cadence: 'Rhythm is a feel question.',
  chainshot: 'Needs a person picking pairs.', jammer: 'Needs homing to accept a lost lock.', storm: 'Needs a wind model.',
  ammoShip: 'Needs the enemy to prefer a ship.', dualWield: 'Needs two loaded weapons in the sim.', wildCard: 'Balance follows the weapons’ own.',
  focus: 'Slow motion helps a person, not a bot.',
};

function bars(proto) {
  const r = R.runs[proto];
  if (!r) return '';
  const row = (who, v, b) =>
    `<div class="bar"><span class="who">${who}</span><span class="track" role="img" aria-label="${who}: ${v}% of runs won, against ${b}% without it"><span class="fill" style="width:${v}%"></span><span class="base" style="left:${b}%"></span></span><span class="num">${v}%<small>${v - b >= 0 ? '+' : '−'}${Math.abs(v - b)}</small></span></div>`;
  return `<div class="bars">${row('Accurate', r.average.clear, base.average.clear)}${row('Tap-happy', r.spammer.clear, base.spammer.clear)}</div>`;
}

function card(i, n) {
  const pic = img(i.id);
  const levels = i.levels
    ? `<ol class="levels"><li><b>1</b>${esc(i.levels[0])}</li><li><b>2</b>${esc(i.levels[1])}</li><li><b>MAX</b>${esc(i.levels[2])}</li></ol>`
    : '';
  const proto = i.proto
    ? `<div class="proto"><div class="lbl">Prototype · runs won <span class="key">bar = with it · tick = without</span></div>${bars(i.proto)}${i.protoNote ? `<p class="pn">${esc(i.protoNote)}.</p>` : ''}${i.tune ? `<p class="pn">${esc(token(i.tune))}</p>` : ''}</div>`
    : `<div class="proto none"><div class="lbl">Not prototyped</div><p class="pn">${esc(NOT_RUN[i.id] ?? '')}</p></div>`;
  return `<article class="idea" id="idea-${i.id}" data-id="${i.id}" data-cat="${i.cat}">
  <header>
    <div class="no">${i.cat[0].toUpperCase()}${n}</div>
    <div class="ttl">
      <h3>${esc(i.name)}${i.max ? ` <span class="max">→ ${esc(i.max)}</span>` : ''}</h3>
      <div class="chips">${i.from === 'player' ? '<span class="chip yours">Your idea</span>' : ''}<span class="chip">${esc(VERB[i.verb])}</span><span class="chip">${esc(TARGET[i.target])}</span>${i.echo ? `<span class="chip warn" title="Close to ${esc(i.echo)}">Close to an old one</span>` : ''}</div>
    </div>
  </header>
  <p class="pitch">${esc(i.pitch)}</p>
  ${pic ? `<figure><img src="${pic}" alt="Concept: ${esc(i.name)} drawn over a real wave on Island" loading="lazy" width="640" height="361"><figcaption>Concept over a real wave, phone size</figcaption></figure>` : ''}
  <details class="more">
    <summary>How it plays</summary>
    <p>${esc(i.how)}</p>
    ${levels}
    <p class="new"><b>What’s new.</b> ${esc(token(i.novel))}</p>
    ${i.echo ? `<p class="new"><b>Close to:</b> ${esc(i.echo)}.</p>` : ''}
  </details>
  <dl class="sw"><div><dt>▲ Strong</dt><dd>${esc(i.strong)}</dd></div><div><dt>▼ Weak</dt><dd>${esc(i.weak)}</dd></div></dl>
  ${proto}
  <div class="review" role="group" aria-label="Your call on ${esc(i.name)}">
    <div class="seg">
      <button type="button" data-v="go" aria-pressed="false">Go further</button>
      <button type="button" data-v="maybe" aria-pressed="false">Maybe</button>
      <button type="button" data-v="drop" aria-pressed="false">Drop</button>
    </div>
    <label class="note"><span>Notes</span><textarea id="n-${i.id}" rows="2" placeholder="Changes, numbers, what you'd want to try"></textarea></label>
    <div class="saved" aria-live="polite"></div>
  </div>
</article>`;
}

function cutRow(i) {
  return `<li class="cut" id="idea-${i.id}" data-id="${i.id}" data-cat="${i.cat}">
  <div class="cutline"><b>${esc(i.name)}</b> <span class="chip">${CAT[i.cat].label}</span><p>${esc(token(i.why))}</p></div>
  <div class="review compact"><div class="seg"><button type="button" data-v="revive" aria-pressed="false">Bring back</button></div>
  <label class="note"><span>Notes</span><textarea id="n-${i.id}" rows="1" placeholder="Why bring it back?"></textarea></label><div class="saved" aria-live="polite"></div></div>
</li>`;
}

const QUESTIONS = [
  { id: 'launchers', q: 'Three ideas hit the enemy launchers: Turncoat Rounds (active), Bomber Wing (passive) and Shore Bombardment (boost). How many?', options: ['Keep all three', 'Keep one or two (say which in the note)', 'None of them'] },
  { id: 'hold', q: 'While Charge Lance, Wire-Guided Missile or Grapnel is loaded, holding charges, steers or drags instead of repeating the shot. OK?', options: ['Yes, the weapon chip says “HOLD: charge”', 'No: keep hold = repeat fire, find another gesture'] },
  { id: 'droneOrigin', q: 'Where does the Drone Screen come from? (On Kesh and Gauntlet the bottom edge is enemy shore.)', options: ['Your side of the map, the carrier deck where the bottom is enemy (recommended)', 'Always the carrier deck'] },
  { id: 'boostLength', q: 'Boosts are drafted and dropped like weapons and never replace the loaded one. How do levels work?', options: ['Levels make it last longer: 8, 11, then 15 s', 'Fixed length; levels make it stronger', 'Something else (note)'] },
  { id: 'slots', q: 'How does a run hold boosts?', options: ['3 weapon slots (active or passive) plus 1 boost slot (recommended)', 'Boosts share the 3 slots'] },
  { id: 'next', q: 'What next for the picks?', options: ['Playable prototypes of the hold and gesture actives on a link I can open on my phone', 'Build my picks straight into the game', 'Another brainstorm round first'] },
];

function question(q) {
  return `<fieldset class="q" data-q="${q.id}"><legend>${esc(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${esc(o)}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
}

const kept = IDEAS.filter((i) => i.status === 'keep');
const cut = IDEAS.filter((i) => i.status === 'cut');
const ids = kept.map((i) => i.id);
const sections = Object.keys(CAT)
  .map((c) => {
    const list = kept.filter((i) => i.cat === c);
    return `<section class="cat" id="sec-${c}" data-cat="${c}" aria-labelledby="h-${c}">
  <div class="cathead"><h2 id="h-${c}">${CAT[c].label} <span class="count" data-count="${c}">0 / ${list.length}</span></h2><p>${esc(CATEGORY_RULES[c])}</p></div>
  <div class="grid">${list.map((i, k) => card(i, k + 1)).join('\n')}</div>
</section>`;
  })
  .join('\n');

const html = `<title>Weapon Ideas Shortlist</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Layout: a chart-room briefing. A sticky strip of category tabs and a
   tally; cards in a two-column grid that drops to one on a phone. */
:root {
  --sea: #e8eef2; --paper: #f7fafb; --ink: #12202b; --muted: #536472; --rule: #cfdae1;
  --signal: #b25a00; --friend: #0b7c78; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c;
  --chip: #dde7ed; --fill: #0b7c78; --track: #dbe4ea; --mark: #12202b;
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0b141c; --paper: #111e29; --ink: #e3ecf1; --muted: #93a6b4; --rule: #23384a;
  --signal: #ffb347; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1b2c3a; --fill: #4fd1c5; --track: #1e3142; --mark: #e3ecf1; color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0b141c; --paper: #111e29; --ink: #e3ecf1; --muted: #93a6b4; --rule: #23384a;
  --signal: #ffb347; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1b2c3a; --fill: #4fd1c5; --track: #1e3142; --mark: #e3ecf1; color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 28px; }
h1, h2, h3 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 70ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
.intro p { margin: 0; color: var(--muted); }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tabs button, .seg button { font: 600 13px/1 var(--body); border: 1px solid var(--rule); background: var(--paper); color: var(--ink); padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 13px/1.3 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.tally b { color: var(--go); }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.cat { display: grid; gap: 14px; }
.cathead { display: grid; gap: 4px; }
.cathead h2 { font-size: 28px; text-transform: uppercase; display: flex; gap: 10px; align-items: baseline; }
.count { font: 500 14px var(--mono); color: var(--go); }
.cathead p { margin: 0; color: var(--muted); max-width: 75ch; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
.idea { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.idea[data-v="go"] { border-color: var(--go); box-shadow: inset 4px 0 0 var(--go); }
.idea[data-v="maybe"] { border-color: var(--maybe); }
.idea[data-v="drop"] { opacity: 0.62; }
.idea header { display: flex; gap: 12px; align-items: flex-start; }
.no { font: 700 13px/1 var(--mono); color: var(--signal); border: 1.5px solid var(--signal); border-radius: 5px; padding: 5px 6px; min-width: 38px; text-align: center; }
.ttl { display: grid; gap: 6px; min-width: 0; }
.ttl h3 { font-size: 22px; line-height: 1.1; }
.max { color: var(--muted); font-weight: 600; font-size: 17px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 600 11px/1 var(--body); letter-spacing: 0.04em; text-transform: uppercase; background: var(--chip); color: var(--muted); padding: 4px 7px; border-radius: 4px; }
.chip.yours { background: var(--signal); color: var(--paper); }
.chip.warn { color: var(--maybe); }
.pitch { margin: 0; font-size: 16px; font-weight: 500; }
figure { margin: 0; display: grid; gap: 4px; }
figure img { width: 100%; height: auto; border-radius: 6px; display: block; border: 1px solid var(--rule); }
figcaption { font-size: 12px; color: var(--muted); }
.more summary { cursor: pointer; font-weight: 600; color: var(--friend); }
.more p { margin: 8px 0 0; }
.levels { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 4px; }
.levels li { display: grid; grid-template-columns: 40px 1fr; gap: 8px; }
.levels b { font: 600 12px/1.6 var(--mono); color: var(--signal); }
.new { color: var(--muted); }
.new b { color: var(--ink); }
.sw { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sw div { min-width: 0; }
.sw dt { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.sw div:first-child dt { color: var(--go); }
.sw div:last-child dt { color: var(--drop); }
.sw dd { margin: 2px 0 0; font-size: 14px; }
.proto { border-top: 1px dashed var(--rule); padding-top: 8px; display: grid; gap: 6px; }
.proto .lbl { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; }
.key { text-transform: none; letter-spacing: 0; font-weight: 500; }
.bars { display: grid; gap: 5px; }
.bar { display: grid; grid-template-columns: 74px 1fr 78px; gap: 8px; align-items: center; font-size: 13px; }
.who { color: var(--muted); }
.track { position: relative; height: 10px; background: var(--track); border-radius: 3px; }
.fill { position: absolute; inset: 0 auto 0 0; background: var(--fill); border-radius: 3px; }
.base { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--mark); }
.num { font: 500 13px var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
.num small { color: var(--go); margin-left: 6px; }
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
.qs { display: grid; gap: 12px; }
.q { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; margin: 0; }
.q legend { font-weight: 600; padding: 0; float: left; width: 100%; margin-bottom: 6px; }
.opt { display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); }
section > h2 { font-size: 28px; text-transform: uppercase; }
.hidden-cat { display: none; }
@media (max-width: 600px) {
  .cut { grid-template-columns: 1fr; }
  .sw { grid-template-columns: 1fr; }
  .bar { grid-template-columns: 66px 1fr 70px; }
}
@media (prefers-reduced-motion: no-preference) { .idea { transition: border-color .2s, opacity .2s; } }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · weapon ideas, round 2</div>
    <h1>Weapon Ideas Shortlist</h1>
    <p>Thirty ideas, ten per category. Mark the ones to take further, add notes, and answer the six questions at the end. Every mark saves as you make it, for the next session to read and build from.</p>
    <p>The bars show prototype runs won on all 20 maps: an accurate player and a tap-happy one, with the tick at the no-idea baseline (${base.average.clear}% and ${base.spammer.clear}%). They measure the size of an effect, not balance.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Filter">
    <div class="tabs" role="group" aria-label="Category">
      <button type="button" data-tab="all" aria-pressed="true">All 30</button>
      <button type="button" data-tab="active" aria-pressed="false">Active</button>
      <button type="button" data-tab="passive" aria-pressed="false">Passive</button>
      <button type="button" data-tab="boost" aria-pressed="false">Boost</button>
      <button type="button" data-tab="go" aria-pressed="false">My picks</button>
    </div>
    <div class="tally" id="tally">0 of 30 marked</div>
  </nav>

${sections}

  <section class="cuts" id="sec-cuts" aria-labelledby="h-cuts">
    <h2 id="h-cuts">Cut (${cut.length})</h2>
    <p class="pn">Each was cut for a reason given here. Bring one back if you disagree.</p>
    <ul>${cut.map(cutRow).join('\n')}</ul>
  </section>

  <section id="sec-qs" aria-labelledby="h-qs">
    <h2 id="h-qs">Six questions</h2>
    <div class="qs">${QUESTIONS.map(question).join('\n')}
    <fieldset class="q" data-q="general"><legend>Anything else?</legend><label class="note"><span>Notes</span><textarea id="qn-general" rows="3" placeholder="Anything about the round as a whole"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
    </div>
  </section>
</main>

<script>
(() => {
  const KEPT = ${JSON.stringify(ids)};
  const CATS = ${JSON.stringify(Object.fromEntries(kept.map((i) => [i.id, i.cat])))};
  const state = { reviews: {}, answers: {} };
  let db = null;
  const LS = 'straitwatch-weapon-ideas-2';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  let tab = 'all';

  function paintIdea(id) {
    const r = state.reviews[id] || {};
    const el = document.getElementById('idea-' + id);
    if (!el) return;
    el.dataset.v = r.verdict || '';
    el.querySelectorAll('[data-v]').forEach((b) => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.v === r.verdict)); });
    const ta = document.getElementById('n-' + id);
    if (ta && document.activeElement !== ta && typeof r.note === 'string') ta.value = r.note;
  }
  function paintQ(id) {
    const a = state.answers[id] || {};
    document.querySelectorAll('input[name="q-' + id + '"]').forEach((i) => { i.checked = String(a.choice) === i.value; });
    const ta = document.getElementById('qn-' + id);
    if (ta && document.activeElement !== ta && typeof a.note === 'string') ta.value = a.note;
  }
  function paintTally() {
    const v = (id) => (state.reviews[id] || {}).verdict;
    const n = (k) => KEPT.filter((id) => v(id) === k).length;
    const marked = KEPT.filter((id) => v(id)).length;
    document.getElementById('tally').innerHTML = marked + ' of 30 marked · <b>' + n('go') + ' go further</b> · ' + n('maybe') + ' maybe · ' + n('drop') + ' drop';
    for (const c of ['active', 'passive', 'boost']) {
      const el = document.querySelector('[data-count="' + c + '"]');
      const list = KEPT.filter((id) => CATS[id] === c);
      if (el) el.textContent = list.filter((id) => v(id) === 'go').length + ' / ' + list.length + ' picked';
    }
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    document.querySelectorAll('section.cat').forEach((s) => s.classList.toggle('hidden-cat', !(tab === 'all' || tab === 'go' || s.dataset.cat === tab)));
    document.querySelectorAll('.idea').forEach((el) => el.classList.toggle('hidden-cat', tab === 'go' && el.dataset.v !== 'go'));
    const extra = tab === 'all';
    document.getElementById('sec-cuts').classList.toggle('hidden-cat', !extra);
  }
  function paintAll() {
    document.querySelectorAll('[data-id]').forEach((el) => paintIdea(el.dataset.id));
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

  document.querySelectorAll('[data-id]').forEach((el) => {
    const id = el.dataset.id;
    const st = el.querySelector('.saved');
    const ta = document.getElementById('n-' + id);
    el.querySelectorAll('button[data-v]').forEach((b) => b.addEventListener('click', () => {
      const cur = (state.reviews[id] || {}).verdict;
      save('reviews', id, { verdict: cur === b.dataset.v ? null : b.dataset.v, note: ta.value }, st);
    }));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('reviews', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.reviews[id] || {}).note !== ta.value && ta.value !== '') save('reviews', id, { note: ta.value }, st); });
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
  }));
  try { tab = sessionStorage.getItem(LS + '-tab') || 'all'; } catch {}

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
    // Anything marked here before the store answered goes up now.
    const left = lsGet();
    for (const coll of ['reviews', 'answers']) for (const [id, v] of Object.entries(left[coll] || {})) {
      if (!v || !v.pending) continue;
      const body = Object.assign({}, v, { at: new Date().toISOString() });
      delete body.pending;
      db.collection(coll).doc(id).set(body).then(() => { const now = lsGet(); if (now[coll]) { delete now[coll][id]; lsSet(now); } }).catch(() => {});
    }
    for (const coll of ['reviews', 'answers']) {
      db.collection(coll).onSnapshot((snap) => {
        clearTimeout(timer);
        snap.docs.forEach((doc) => { const v = doc.data(); if (v) state[coll][doc.id] = v; });
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the review store. Reload to try again.'; });
    }
  });
})();
</script>
`;
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB, ${kept.length} ideas, ${cut.length} cut, ${QUESTIONS.length} questions)`);
