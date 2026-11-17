// The map and wave rules review page, and its design doc, from rules.mjs and
// evidence.json. Usage:
//   node tools/v3/map-rules/page.mjs <out.html>        the review page
//   node tools/v3/map-rules/page.mjs --doc             docs/design/v3-map-wave-rules.md
//
// Store (claude.ai artifact db): reviews/{ruleId} {verdict: approve|change|cut,
// note, at}; answers/{questionId} {choice, note, at}. Ids come from rules.mjs.
import { readFileSync, writeFileSync } from 'node:fs';
import { ROUND, SECTIONS, RULES, QUESTIONS } from './rules.mjs';

const EV = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DOC_LINK = process.env.PAGE_LINK ?? '';

const NAMES = { 'map-strait': 'The Strait', 'map-gauntlet': 'The Gauntlet', 'map-harbor': 'Harbor Mouth', 'map-strait-v2': 'Strait v2' };
const T = EV.totals;
const lostSum = T.lost.w1to5 + T.lost.w6to10 + T.lost.boss;

// ---- Evidence pieces (shared by the page and the doc)
function lossBars() {
  const rows = [['Waves 1–5', T.lost.w1to5], ['Waves 6–10', T.lost.w6to10], ['Boss rounds', T.lost.boss]];
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="bars" role="img" aria-label="Ships lost by part of the map, all ${T.scorecards} scorecards">${rows
    .map(([k, v]) => `<div class="bar"><span class="bl">${k}</span><span class="bt"><span class="bf" style="width:${Math.max(2, (v / max) * 100)}%"></span></span><b>${v}</b></div>`)
    .join('')}</div><p class="cap">Ships lost across your ${T.scorecards} map scorecards (rounds 11–12). ${T.noLossW1to5} of ${T.scorecards} runs lost nothing in waves 1–5.</p>`;
}
function scoreTable() {
  const head = '<tr><th>Map</th><th>Rnd</th><th>Fun</th><th>Boss</th><th>Boss ships lost</th><th>Lost 1–5 / 6–10</th><th>Weakest wave</th><th>Kit</th></tr>';
  const rows = EV.runs
    .map((r) => {
      const boss = r.bossRounds.length ? r.bossRounds.map((b) => b.lost).join(' + ') : '–';
      return `<tr><td>${esc(NAMES[r.card] ?? r.card)}</td><td>${r.round}</td><td class="n">${r.score.fun ?? '–'}</td><td class="n">${r.score.boss ?? '–'}</td><td class="n">${boss}</td><td class="n">${r.lost.w1to5} / ${r.lost.w6to10}</td><td class="n">${r.score.weakest ?? '–'}</td><td class="kit">${esc(r.kit.join(', '))}</td></tr>`;
    })
    .join('');
  return `<div class="tw"><table>${head}${rows}</table></div>`;
}
function evFor(key) {
  if (key === 'lost') return lossBars();
  if (key === 'weakest') return `<p class="cap">Wave 1 was your weakest wave on <b>${T.weakestWave1} of ${T.scorecards}</b> scorecards.</p>`;
  if (key === 'boss') {
    const rows = EV.runs.filter((r) => r.bossRounds.length).map((r) => `<li>${esc(NAMES[r.card] ?? r.card)} (round ${r.round}): lost ${r.bossRounds.map((b) => b.lost).join(' + ')} → boss score <b>${r.score.boss ?? '–'}</b></li>`);
    return `<ul class="cap">${rows.join('')}</ul>`;
  }
  if (key === 'bots') {
    const b = EV.bots.youBotBossLost;
    const you = (card) => EV.runs.filter((r) => r.card === card && r.round === 12 && r.bossRounds.length).map((r) => r.bossRounds.reduce((s, x) => s + x.lost, 0))[0];
    return `<ul class="cap">${Object.entries(b).map(([c, v]) => `<li>${esc(NAMES[c])}: bot ${v} · you ${you(c) ?? '–'}</li>`).join('')}</ul>`;
  }
  return '';
}

// ---- The doc
if (process.argv[2] === '--doc') {
  const L = [];
  L.push(`# V3 map and wave rules (review round ${ROUND.n}, ${ROUND.date})`, '');
  L.push('The rules every map and wave plan must meet before the other 17 maps are rebuilt. Generated from `tools/v3/map-rules/rules.mjs` (do not edit by hand: `node tools/v3/map-rules/page.mjs --doc`).', '');
  L.push(`- **Review page:** ${DOC_LINK || '(link added on publish)'}. Marks are stored as \`reviews/{ruleId}\` (\`verdict\`: approve | change | cut, \`note\`) and \`answers/{questionId}\` (\`choice\`: option index, \`note\`).`);
  L.push(`- **Evidence:** \`tools/v3/map-rules/evidence.json\`, from your ${T.scorecards} map scorecards in rounds 11–12. Ships lost: ${T.lost.w1to5} in waves 1–5, ${T.lost.w6to10} in waves 6–10, ${T.lost.boss} in boss rounds. Readability 5 on ${T.readability5}/${T.scorecards}; pacing “right” on ${T.pacingRight}/${T.scorecards}; wave 1 weakest on ${T.weakestWave1}/${T.scorecards}.`, '');
  for (const s of SECTIONS) {
    L.push(`## ${s.name}`, '', s.blurb, '');
    for (const r of RULES.filter((x) => x.sec === s.id)) {
      L.push(`### ${r.title} \`${r.id}\``, '', r.rule, '', `- **Why:** ${r.why}`, `- **Check:** ${r.check}`, `- **Today:** ${r.now}`, '');
    }
  }
  L.push('## Open questions', '');
  for (const q of QUESTIONS) {
    L.push(`**${q.text}** \`${q.id}\``, '');
    q.options.forEach((o, i) => L.push(`${i + 1}. ${o}`));
    L.push('');
  }
  writeFileSync(new URL('../../../docs/design/v3-map-wave-rules.md', import.meta.url), L.join('\n'));
  console.log('Wrote docs/design/v3-map-wave-rules.md');
  process.exit(0);
}

// ---- The page
const out = process.argv[2];
if (!out) throw new Error('usage: page.mjs <out.html> | --doc');

const ruleCard = (r) => `
<article class="rule" data-coll="reviews" data-id="${r.id}" id="r-${r.id}">
  <div class="ht"><h3>${esc(r.title)}</h3><button type="button" class="say" data-say="${r.id}" aria-label="Listen from ${esc(r.title)}" hidden>🔊</button></div>
  <p class="text">${esc(r.rule)}</p>
  ${r.ev ? `<div class="ev">${evFor(r.ev)}</div>` : ''}
  <details><summary>Why, how it’s checked, and where the maps stand</summary>
    <dl><dt>Why</dt><dd>${esc(r.why)}</dd><dt>Checked by</dt><dd>${esc(r.check)}</dd><dt>Today</dt><dd>${esc(r.now)}</dd></dl>
  </details>
  <div class="vb" role="group" aria-label="Your verdict on ${esc(r.title)}">
    <button type="button" data-v="approve">Approve</button><button type="button" data-v="change">Change</button><button type="button" data-v="cut">Cut</button>
  </div>
  <label class="nl">Notes <textarea rows="2" placeholder="What would you change?"></textarea></label>
  <p class="saved" aria-live="polite"></p>
</article>`;

const qCard = (q) => `
<fieldset class="q" data-q="${q.id}" id="q-${q.id}">
  <legend><span>${esc(q.text)}</span> <button type="button" class="say" data-say="${q.id}" aria-label="Listen from this question" hidden>🔊</button></legend>
  ${q.options.map((o, i) => `<label class="opt"><input type="radio" name="${q.id}" value="${i}"> <span>${esc(o)}</span></label>`).join('')}
  <label class="nl">Notes <textarea id="qn-${q.id}" rows="2"></textarea></label>
  <p class="saved" aria-live="polite"></p>
</fieldset>`;

// The listen player's script: one item per section intro, rule and
// question, read in the order the page shows them. Symbols are spelled out
// so a voice reads them naturally.
const say = (t) => String(t)
  .replace(/≥\s*/g, 'at least ').replace(/≤\s*/g, 'at most ').replace(/±/g, 'plus or minus ')
  .replace(/→/g, 'to').replace(/(\d)×(\d)/g, '$1 by $2').replace(/(\d)×/g, '$1 times').replace(/×/g, 'times')
  .replace(/–/g, ' to ').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const SCRIPT = [];
for (const s of SECTIONS) {
  SCRIPT.push({ id: 'sec-' + s.id, sec: s.id, kind: 'sec', el: 'h-' + s.id, label: s.name, text: say(`${s.name}. ${s.blurb}`) });
  const list = RULES.filter((r) => r.sec === s.id);
  list.forEach((r, i) => SCRIPT.push({ id: r.id, sec: s.id, kind: 'rule', el: 'r-' + r.id, label: r.title, text: say(`Rule ${i + 1} of ${list.length}: ${r.title}. ${r.rule} Why: ${r.why} Where the maps stand today: ${r.now}`) }));
}
QUESTIONS.forEach((q, i) => SCRIPT.push({ id: q.id, sec: 'qs', kind: 'q', el: 'q-' + q.id, label: 'Question ' + (i + 1), text: say(`Question ${i + 1} of ${QUESTIONS.length}. ${q.text} ${q.options.map((o, k) => `Option ${k + 1}: ${o.replace(/ \(recommended\)$/, ', which I recommend')}.`).join(' ')}`) }));
SCRIPT.push({ id: 'ev', sec: 'ev', kind: 'ev', el: 'h-ev', label: 'Evidence', text: say(`The evidence. Across your ${T.scorecards} map scorecards you lost ${T.lost.w1to5} ships in waves 1 to 5, ${T.lost.w6to10} in waves 6 to 10, and ${T.lost.boss} in the boss rounds. ${T.noLossW1to5} of ${T.scorecards} runs lost nothing before wave 6. Wave 1 was your weakest wave on ${T.weakestWave1} of ${T.scorecards}. Readability scored 5 on all ${T.readability5}, and pacing was right on all ${T.pacingRight}.`) });

const ELSE = { id: 'mr-else', text: 'Anything else? A rule that’s missing, or something about the maps you want settled before the rebuild.' };

const html = `<title>Map and Wave Rules</title>
<style>
:root{--bg:#f6f4ef;--card:#fff;--ink:#1d2430;--mute:#5c6573;--line:#d9d4c8;--acc:#0e6b8a;--acc-ink:#fff;--ok:#2f7d4f;--chg:#a86b00;--cut:#b23a3a;--bar:#0e6b8a;--chip:#eef3f6}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0f141b;--card:#18202a;--ink:#e8edf2;--mute:#9aa6b5;--line:#2a3542;--acc:#5cc3e6;--acc-ink:#0b1520;--ok:#6fcf97;--chg:#f2b84b;--cut:#ef7d7d;--bar:#5cc3e6;--chip:#1f2a36}}
:root[data-theme="dark"]{--bg:#0f141b;--card:#18202a;--ink:#e8edf2;--mute:#9aa6b5;--line:#2a3542;--acc:#5cc3e6;--acc-ink:#0b1520;--ok:#6fcf97;--chg:#f2b84b;--cut:#ef7d7d;--bar:#5cc3e6;--chip:#1f2a36}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:860px;margin:0 auto;padding:16px 16px 64px}
h1{font-size:1.5rem;margin:.2em 0}
h2{font-size:1.2rem;margin:1.6em 0 .2em}
h3{font-size:1.05rem;margin:0 0 .3em}
.lead,.blurb,.cap{color:var(--mute)}
.cap{font-size:.9rem;margin:.3em 0}
#store,#tally{font-size:.9rem;color:var(--mute);margin:.2em 0}
#tally b{color:var(--ink)}
nav{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0;border-bottom:1px solid var(--line);display:flex;gap:6px;overflow-x:auto}
nav button{flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:6px 12px;font:inherit;font-size:.9rem;min-height:36px;cursor:pointer}
nav button[aria-pressed="true"]{background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
.rule,.q,.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:12px 0}
.rule[data-v="approve"]{border-left:4px solid var(--ok)}.rule[data-v="change"]{border-left:4px solid var(--chg)}.rule[data-v="cut"]{border-left:4px solid var(--cut);opacity:.85}
.text{margin:.2em 0 .5em}
details summary{cursor:pointer;color:var(--acc);font-size:.92rem}
dl{margin:.5em 0;display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;font-size:.92rem}
dt{color:var(--mute)}dd{margin:0}
.vb{display:flex;gap:8px;margin:10px 0 6px;flex-wrap:wrap}
.vb button{flex:1 1 0;min-width:84px;min-height:44px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit;font-weight:600;cursor:pointer}
.vb button[aria-pressed="true"][data-v="approve"]{background:var(--ok);border-color:var(--ok);color:var(--acc-ink)}
.vb button[aria-pressed="true"][data-v="change"]{background:var(--chg);border-color:var(--chg);color:var(--acc-ink)}
.vb button[aria-pressed="true"][data-v="cut"]{background:var(--cut);border-color:var(--cut);color:var(--acc-ink)}
.nl{display:block;font-size:.85rem;color:var(--mute)}
textarea{display:block;width:100%;margin-top:4px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink);font:inherit;font-size:16px;padding:8px;resize:vertical}
.saved{font-size:.8rem;color:var(--mute);min-height:1.2em;margin:4px 0 0}
fieldset.q{min-width:0}
legend{font-weight:600;padding:0;margin-bottom:6px}
.opt{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line);cursor:pointer}
.opt input{margin-top:4px;width:20px;height:20px;flex:0 0 auto}
.bars{margin:6px 0}
.bar{display:grid;grid-template-columns:7.5em 1fr 2.2em;gap:8px;align-items:center;margin:4px 0;font-size:.9rem}
.bt{height:12px;background:var(--chip);border-radius:6px;overflow:hidden}
.bf{display:block;height:100%;background:var(--bar)}
.bar b{text-align:right}
.tw{overflow-x:auto}
table{border-collapse:collapse;font-size:.85rem;width:100%}
th,td{border-bottom:1px solid var(--line);padding:6px;text-align:left;white-space:nowrap}
td.n{text-align:center}td.kit{white-space:normal;min-width:10em;color:var(--mute)}
.hidden{display:none}
.tops{display:flex;gap:8px;flex-wrap:wrap}
.listen{background:var(--card);color:var(--ink);border:1px solid var(--line)}
.ht{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.say{flex:0 0 auto;align-self:flex-start;width:44px;height:40px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);font-size:1.05rem;cursor:pointer}
legend{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;width:100%}
.reading{outline:3px solid var(--acc);outline-offset:2px}
#player{position:fixed;left:0;right:0;bottom:0;z-index:5;background:var(--card);border-top:1px solid var(--line);padding:8px 16px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -4px 16px rgba(0,0,0,.18)}
.pl-now{font-size:.85rem;color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:860px;margin:0 auto 6px}
.pl-ctl{display:flex;gap:8px;justify-content:center;max-width:860px;margin:0 auto}
.pl-ctl button{flex:1 1 0;min-height:48px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;padding:0 4px}
#pl-play{background:var(--acc);color:var(--acc-ink);border-color:var(--acc)}
body.playing main{padding-bottom:140px}
.jump{border:0;background:var(--acc);color:var(--acc-ink);border-radius:10px;padding:10px 16px;min-height:44px;font:inherit;font-weight:600;cursor:pointer}
</style>
<main>
<h1>Map and Wave Rules</h1>
<p class="lead">The rules every map and its waves must follow before we rebuild the other 17 maps: what a map needs beyond its shape, how waves are built, and how waves use the map. Mark each rule <b>Approve</b>, <b>Change</b> or <b>Cut</b>, add notes, then answer the questions at the end.</p>
<p class="tops"><button type="button" class="jump" data-tab="qs">Answer the ${QUESTIONS.length} questions →</button> <button type="button" class="jump listen" id="listen" hidden>🔊 Listen to this tab</button></p>
<p class="cap" id="listen-note" hidden></p>
<p id="store">Connecting to the review store…</p>
<p id="tally"></p>
<nav aria-label="Sections">
  <button type="button" data-tab="qs">Questions</button>
  <button type="button" data-tab="all">All rules</button>
  ${SECTIONS.map((s) => `<button type="button" data-tab="${s.id}">${esc(s.name)}</button>`).join('')}
  <button type="button" data-tab="ev">Evidence</button>
</nav>
${SECTIONS.map((s) => `<section class="sec" data-sec="${s.id}"><h2 id="h-${s.id}">${esc(s.name)}</h2><p class="blurb">${esc(s.blurb)}</p>${RULES.filter((r) => r.sec === s.id).map(ruleCard).join('')}</section>`).join('')}
<section class="sec" data-sec="qs"><h2>Questions</h2><p class="blurb">The first option is my recommendation.</p>${QUESTIONS.map(qCard).join('')}
<fieldset class="q" data-q="${ELSE.id}" id="q-${ELSE.id}"><legend>${esc(ELSE.text)}</legend><label class="nl">Notes <textarea id="qn-${ELSE.id}" rows="4"></textarea></label><p class="saved" aria-live="polite"></p></fieldset>
</section>
<section class="sec" data-sec="ev"><h2 id="h-ev">Evidence</h2><p class="blurb">Your map scorecards so far (rounds 11–12, The Strait, The Gauntlet, Harbor Mouth). Every rule above cites these.</p>
<div class="panel"><h3>Where ships are lost</h3>${lossBars()}</div>
<div class="panel"><h3>Every scorecard</h3>${scoreTable()}<p class="cap">Readability 5 on ${T.readability5} of ${T.scorecards}; pacing “right” on ${T.pacingRight} of ${T.scorecards}; wave 1 your weakest on ${T.weakestWave1} of ${T.scorecards}. “Weakest wave” 10+ means a late wave; 11–13 are boss rounds.</p></div>
<div class="panel"><h3>Bots vs you in the boss rounds (round 12)</h3>${evFor('bots')}<p class="cap">Ships lost across the three boss rounds. The bots badly over-predict what you lose.</p></div>
</section>
</main>
<div id="player" hidden role="region" aria-label="Listening">
  <div class="pl-now" id="pl-now" aria-live="polite"></div>
  <div class="pl-ctl">
    <button type="button" id="pl-prev">Back</button>
    <button type="button" id="pl-play">Pause</button>
    <button type="button" id="pl-next">Next</button>
    <button type="button" id="pl-stop">Stop</button>
    <button type="button" id="pl-rate" aria-label="Speed">1×</button>
  </div>
</div>
<script>
(() => {
  const RULE_IDS = ${JSON.stringify(RULES.map((r) => r.id))};
  const Q_IDS = ${JSON.stringify(QUESTIONS.map((q) => q.id))};
  const SEC_OF = ${JSON.stringify(Object.fromEntries(RULES.map((r) => [r.id, r.sec])))};
  const COLLS = ['reviews', 'answers'];
  const LS = 'straitwatch-map-rules-r${ROUND.n}';
  const state = { reviews: {}, answers: {} };
  let db = null, tab = 'all';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };

  function paintItem(el) {
    const s = state.reviews[el.dataset.id] || {};
    el.dataset.v = s.verdict || '';
    el.querySelectorAll('button[data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === s.verdict)));
    const ta = el.querySelector('textarea');
    if (document.activeElement !== ta && typeof s.note === 'string') ta.value = s.note;
  }
  function paintQ(id) {
    const s = state.answers[id] || {};
    document.querySelectorAll('input[name="' + id + '"]').forEach((i) => { i.checked = Number(i.value) === s.choice; });
    const ta = document.getElementById('qn-' + id);
    if (ta && document.activeElement !== ta && typeof s.note === 'string') ta.value = s.note;
  }
  function paintTally() {
    const v = (id) => (state.reviews[id] || {}).verdict;
    const n = (k) => RULE_IDS.filter((id) => v(id) === k).length;
    const marked = RULE_IDS.filter(v).length;
    const qa = Q_IDS.filter((id) => typeof (state.answers[id] || {}).choice === 'number').length;
    document.getElementById('tally').innerHTML = marked + ' of ' + RULE_IDS.length + ' rules marked · <b>' + n('approve') + ' approve</b> · ' + n('change') + ' change · ' + n('cut') + ' cut · ' + qa + ' of ' + Q_IDS.length + ' questions answered';
  }
  function paintTab() {
    document.querySelectorAll('nav [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    document.querySelectorAll('section.sec').forEach((s) => {
      const k = s.dataset.sec;
      const show = tab === 'all' ? k !== 'ev' : k === tab;
      s.classList.toggle('hidden', !show);
    });
  }
  function paintAll() {
    document.querySelectorAll('[data-coll]').forEach(paintItem);
    Q_IDS.concat(['mr-else']).forEach(paintQ);
    paintTally();
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
      do { busy[coll + id].again = false; const b = Object.assign({}, state[coll][id], { at: new Date().toISOString() }); delete b.pending; await db.collection(coll).doc(id).set(b); } while (busy[coll + id].again);
      flash(statusEl, 'Saved.');
    } catch (e) {
      flash(statusEl, e && (e.code === 'not_granted' || e.code === 'permission_denied') ? 'You can read this page but not save to it.' : 'Couldn’t save. Check your connection and try again.');
    } finally { delete busy[coll + id]; }
  }
  document.querySelectorAll('[data-coll]').forEach((el) => {
    const id = el.dataset.id, coll = el.dataset.coll;
    const st = el.querySelector('.saved'), ta = el.querySelector('textarea');
    el.querySelectorAll('button[data-v]').forEach((b) => b.addEventListener('click', () => {
      const cur = (state[coll][id] || {}).verdict;
      save(coll, id, { verdict: cur === b.dataset.v ? null : b.dataset.v, note: ta.value }, st);
    }));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save(coll, id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state[coll][id] || {}).note !== ta.value && ta.value !== '') save(coll, id, { note: ta.value }, st); });
  });
  document.querySelectorAll('.q').forEach((f) => {
    const id = f.dataset.q, st = f.querySelector('.saved'), ta = document.getElementById('qn-' + id);
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => save('answers', id, { choice: Number(i.value), note: ta.value }, st)));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.answers[id] || {}).note !== ta.value && ta.value !== '') save('answers', id, { note: ta.value }, st); });
  });
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    if (typeof playing !== 'undefined' && playing) stopAll();
    try { sessionStorage.setItem(LS + '-tab', tab); } catch {}
    paintTab();
    window.scrollTo({ top: 0 });
  }));
  try { tab = sessionStorage.getItem(LS + '-tab') || 'all'; } catch {}
  const local = lsGet();
  Object.assign(state.reviews, local.reviews || {});
  Object.assign(state.answers, local.answers || {});
  paintAll(); paintTab();
  // ---- Listen: a Claude voice where the page may use one, else the
  // browser's own voice (iPhone Safari and the Claude app have no Claude
  // voice). Reads the open tab, from the top or from a card's speaker.
  const SCRIPT = ${JSON.stringify(SCRIPT)};
  const VERB = { approve: 'approved', change: 'marked change', cut: 'cut' };
  const RATES = [1, 1.25, 1.5, 0.85];
  let rateI = 0; try { rateI = Number(localStorage.getItem(LS + '-rate')) || 0; } catch {}
  let tts = null, engine = null, queue = [], at = -1, playing = false, paused = false, gen = 0;
  const $ = (id) => document.getElementById(id);
  const web = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  function itemsForTab() {
    if (tab === 'qs') return SCRIPT.filter((x) => x.sec === 'qs');
    if (tab === 'ev') return SCRIPT.filter((x) => x.sec === 'ev');
    if (tab === 'all') return SCRIPT.filter((x) => x.sec !== 'qs' && x.sec !== 'ev');
    return SCRIPT.filter((x) => x.sec === tab);
  }
  function spoken(it) {
    let t = it.text;
    if (it.kind === 'rule') { const v = (state.reviews[it.id] || {}).verdict; t += v ? ' You ' + VERB[v] + ' this one.' : ' Not marked yet.'; }
    if (it.kind === 'q') { const c = (state.answers[it.id] || {}).choice; if (typeof c === 'number') t += ' You picked option ' + (c + 1) + '.'; }
    return t.slice(0, 1990);
  }
  function mark(i) {
    document.querySelectorAll('.reading').forEach((e) => e.classList.remove('reading'));
    at = i;
    const it = queue[i];
    if (!it) return;
    const el = $(it.el);
    if (el) { (el.closest('.rule,.q') || el).classList.add('reading'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    $('pl-now').textContent = (i + 1) + ' of ' + queue.length + ' · ' + it.label;
  }
  function ui() {
    document.body.classList.toggle('playing', playing);
    $('player').hidden = !playing;
    $('pl-play').textContent = paused ? 'Play' : 'Pause';
    $('pl-rate').textContent = RATES[rateI] + '×';
  }
  function finish() { playing = false; paused = false; gen++; document.querySelectorAll('.reading').forEach((e) => e.classList.remove('reading')); ui(); }
  function webFrom(i, g) {
    if (g !== gen) return;
    if (i >= queue.length) { finish(); return; }
    mark(i);
    const u = new SpeechSynthesisUtterance(spoken(queue[i]));
    u.rate = RATES[rateI]; u.lang = 'en-US';
    u.onend = () => { if (g === gen && !paused) setTimeout(() => webFrom(i + 1, g), 250); };
    u.onerror = (e) => { if (g === gen && e.error !== 'interrupted' && e.error !== 'canceled') finish(); };
    speechSynthesis.speak(u);
  }
  function start(i) {
    if (!queue.length) return;
    i = Math.max(0, Math.min(queue.length - 1, i));
    gen++; const g = gen;
    playing = true; paused = false; ui();
    if (engine === 'claude') {
      mark(i);
      tts.speak(queue.slice(i).map((it) => ({ text: spoken(it), id: it.id })), { rate: RATES[rateI], language: 'en' })
        .then(() => { if (g === gen) finish(); })
        .catch((e) => {
          if (g !== gen) return;
          if (e && e.code === 'not_granted') { $('listen-note').textContent = 'Reading aloud is turned off for this page (its Permissions menu).'; $('listen-note').hidden = false; }
          else if (e && e.code === 'no_gesture') { $('listen-note').textContent = 'Tap Listen again to start.'; $('listen-note').hidden = false; }
          else if (e && e.code === 'rate_limited') { $('listen-note').textContent = 'Reading aloud is busy right now. Try again in a bit.'; $('listen-note').hidden = false; }
          finish();
        });
    } else {
      speechSynthesis.cancel();
      webFrom(i, g);
    }
  }
  function listenFrom(id) {
    queue = itemsForTab();
    let i = id ? queue.findIndex((x) => x.id === id) : 0;
    if (i < 0) { queue = SCRIPT.filter((x) => x.sec === (SCRIPT.find((y) => y.id === id) || {}).sec); i = Math.max(0, queue.findIndex((x) => x.id === id)); }
    start(i);
  }
  function stopAll() { gen++; if (engine === 'claude') tts.stop().catch(() => {}); else if (web) speechSynthesis.cancel(); finish(); }
  function togglePause() {
    if (!playing) return;
    if (engine === 'claude') {
      if (paused) tts.resume().catch(() => {}); else tts.pause().catch(() => {});
      paused = !paused; ui(); return;
    }
    // The browser's own pause is unreliable on iPhone: stop, and resume from
    // the start of the same item.
    if (paused) { paused = false; start(at); } else { paused = true; gen++; speechSynthesis.cancel(); ui(); }
  }
  function enable(kind) {
    engine = kind;
    $('listen').hidden = false;
    document.querySelectorAll('.say').forEach((b) => { b.hidden = false; });
  }
  $('listen').addEventListener('click', () => listenFrom(null));
  document.querySelectorAll('.say').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); listenFrom(b.dataset.say); }));
  $('pl-play').addEventListener('click', togglePause);
  $('pl-stop').addEventListener('click', stopAll);
  $('pl-next').addEventListener('click', () => { if (at + 1 < queue.length) start(at + 1); });
  $('pl-prev').addEventListener('click', () => start(at - 1));
  $('pl-rate').addEventListener('click', () => {
    rateI = (rateI + 1) % RATES.length;
    try { localStorage.setItem(LS + '-rate', String(rateI)); } catch {}
    ui();
    if (engine === 'claude' && tts.setRate) tts.setRate(RATES[rateI]).catch(() => {});
    else if (playing && !paused) start(at);
  });
  if (web) enable('web');
  if (window.claude && window.claude.use) {
    window.claude.use('tts').then((t) => {
      if (!t) return;
      tts = t; enable('claude');
      if (t.setRate) t.setRate(RATES[rateI]).catch(() => {});
      t.onState((e) => { if (e.state === 'idle' && playing && e.reason && e.reason !== 'replaced') finish(); });
      t.onLine((e) => { if (!playing) return; const i = queue.findIndex((x) => x.id === e.id); if (i >= 0) mark(i); });
    }).catch(() => {});
  }
  ui();

  const note = document.getElementById('store');
  const use = window.claude && window.claude.use;
  if (!use) { note.textContent = 'Open this page on claude.ai, signed in, to save your marks for the next session. Marks made here stay in this browser.'; return; }
  const timer = setTimeout(() => { note.textContent = 'The review store isn’t answering yet. Marks you make are kept in this browser until it does.'; }, 10000);
  window.claude.use('db').then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Marks stay in this browser.'; return; }
    db = d;
    note.textContent = 'Your marks save to this page for the next session to read.';
    const left = lsGet();
    for (const coll of COLLS) for (const [id, v] of Object.entries(left[coll] || {})) {
      if (!v || !v.pending) continue;
      const body = Object.assign({}, v, { at: new Date().toISOString() });
      delete body.pending;
      db.collection(coll).doc(id).set(body).then(() => { const now = lsGet(); if (now[coll]) { delete now[coll][id]; lsSet(now); } }).catch(() => {});
    }
    for (const coll of COLLS) {
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
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB, ${RULES.length} rules in ${SECTIONS.length} sections, ${QUESTIONS.length} questions)`);
