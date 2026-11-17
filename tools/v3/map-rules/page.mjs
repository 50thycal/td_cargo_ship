// The map rebuild hub (the player's main way to follow the work) and its
// design doc, from rules.mjs, plan.mjs and evidence.json. Usage:
//   node tools/v3/map-rules/page.mjs <out.html>   the hub page
//   node tools/v3/map-rules/page.mjs --doc        docs/design/v3-map-wave-rules.md
// Publish to the same artifact (plan.mjs PAGE) with capabilities {db, tts}.
//
// Tabs: Needs you (only open items), Status, The plan (final rules),
// Archive (everything already answered, and the evidence).
// Store: reviews/{id} {verdict, note, at}; answers/{id} {choice, note, at}.
// Item ids never repeat across rounds (round 1: rule ids and mr-*; round 2:
// r2-*), so earlier answers stay readable.
import { readFileSync, writeFileSync } from 'node:fs';
import { SECTIONS, RULES, QUESTIONS } from './rules.mjs';
import { PAGE, REVISIONS, NOTES, SETTLED, STATUS, NEEDS, ANSWERED } from './plan.mjs';

const EV = JSON.parse(readFileSync(new URL('./evidence.json', import.meta.url), 'utf8'));
const R1 = JSON.parse(readFileSync(new URL('./review-2026-11-17.json', import.meta.url), 'utf8'));
const CSS = readFileSync(new URL('./style.css', import.meta.url), 'utf8');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const T = EV.totals;
const NAMES = { 'map-strait': 'The Strait', 'map-gauntlet': 'The Gauntlet', 'map-harbor': 'Harbor Mouth', 'map-strait-v2': 'Strait v2' };
const STATE = { done: 'Done', now: 'Now', next: 'Next', later: 'Later' };

// The final rules: round 1 text with the player's revisions applied.
const FINAL = RULES.map((r) => {
  const rev = REVISIONS[r.id];
  const mark = R1.reviews[r.id] ?? {};
  return { ...r, ...(rev ?? {}), changed: !!rev, playerNote: (mark.note ?? '').trim(), extra: NOTES[r.id] ?? '' };
});
const ROUND_ELSE = 'r2-else';

// ---- The design doc
if (process.argv[2] === '--doc') {
  const L = [];
  L.push('# V3 map and wave rules (final, round 1 decided 2026-11-17)', '');
  L.push('The rules every map and wave plan follows in the map rebuild. Generated from `tools/v3/map-rules/` (`rules.mjs` + `plan.mjs`; do not edit by hand: `node tools/v3/map-rules/page.mjs --doc`).', '');
  L.push(`- **Hub page (the player's main channel):** ${PAGE}. Collections: \`reviews/{id}\` (verdict, note) and \`answers/{id}\` (choice, note). Round 1 marks are saved in \`tools/v3/map-rules/review-2026-11-17.json\`.`);
  L.push('- **Keeping it current:** any session that changes the plan or finishes a step updates `STATUS` (and `NEEDS` for a new decision) in `plan.mjs`, regenerates the page and republishes it to the same URL. Only new items go in `NEEDS`; answered ones are never asked again.', '');
  L.push('## Settled in round 1', '', ...SETTLED.map((s) => `- ${s}`), '');
  for (const s of SECTIONS) {
    L.push(`## ${s.name}`, '');
    for (const r of FINAL.filter((x) => x.sec === s.id)) {
      L.push(`### ${r.title} \`${r.id}\`${r.changed ? ' (changed from the player\'s note)' : ''}`, '', r.rule, '', `- **Check:** ${r.check}`, `- **Why:** ${r.why}`);
      if (r.playerNote) L.push(`- **The player's note:** “${r.playerNote}”`);
      if (r.extra && !r.playerNote) L.push(`- **Note:** ${r.extra}`);
      L.push('');
    }
  }
  L.push('## Status', '', STATUS.headline, '', ...STATUS.phases.map((p) => `- **${STATE[p.state]}: ${p.name}.** ${p.detail}`), '');
  writeFileSync(new URL('../../../docs/design/v3-map-wave-rules.md', import.meta.url), L.join('\n'));
  console.log('Wrote docs/design/v3-map-wave-rules.md');
  process.exit(0);
}

const out = process.argv[2];
if (!out) throw new Error('usage: page.mjs <out.html> | --doc');

// ---- Spoken script (the Listen player). Symbols spelled out.
const say = (t) => String(t)
  .replace(/≥\s*/g, 'at least ').replace(/≤\s*/g, 'at most ').replace(/±/g, 'plus or minus ')
  .replace(/→/g, 'to').replace(/(\d)×(\d)/g, '$1 by $2').replace(/(\d)×/g, '$1 times').replace(/×/g, 'times')
  .replace(/–/g, ' to ').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const SCRIPT = [];
NEEDS.forEach((n, i) => SCRIPT.push({ id: n.id, tab: 'needs', el: 'n-' + n.id, label: 'Needs you ' + (i + 1), open: true, text: say(`Needs you, ${i + 1} of ${NEEDS.length}. ${n.title}. ${n.text}${n.options ? ' ' + n.options.map((o, k) => `Option ${k + 1}: ${o}.`).join(' ') : ''}`) }));
SCRIPT.push({ id: 'st-head', tab: 'status', el: 'st-head', label: 'Status', text: say(`Status, updated ${STATUS.updated}. ${STATUS.headline}`) });
STATUS.phases.forEach((p) => SCRIPT.push({ id: 'ph-' + p.id, tab: 'status', el: 'ph-' + p.id, label: p.name, text: say(`${STATE[p.state]}: ${p.name}. ${p.detail}`) }));
SCRIPT.push({ id: 'st-log', tab: 'status', el: 'st-log', label: 'Recent changes', text: say('Recent changes. ' + STATUS.log.map((l) => l.what).join(' ')) });
SCRIPT.push({ id: 'pl-settled', tab: 'plan', el: 'pl-settled', label: 'Settled', text: say('Settled in round 1. ' + SETTLED.join(' ')) });
for (const s of SECTIONS) {
  const list = FINAL.filter((r) => r.sec === s.id);
  list.forEach((r, i) => SCRIPT.push({ id: 'p-' + r.id, tab: 'plan', el: 'p-' + r.id, label: r.title, text: say(`${s.name}, rule ${i + 1} of ${list.length}: ${r.title}. ${r.rule}${r.changed ? ' This one was changed from your note.' : ''}`) }));
}

// ---- Pieces
const needCard = (n) => n.kind === 'question' ? `
<fieldset class="q need" data-q="${n.id}" id="n-${n.id}">
  <legend><span>${esc(n.title)}</span> <button type="button" class="say" data-say="${n.id}" aria-label="Listen from here" hidden>🔊</button></legend>
  <p class="text">${esc(n.text)}</p>
  ${n.options.map((o, i) => `<label class="opt"><input type="radio" name="${n.id}" value="${i}"> <span>${esc(o)}</span></label>`).join('')}
  <label class="nl">Notes <textarea id="qn-${n.id}" rows="2"></textarea></label>
  <p class="saved" aria-live="polite"></p>
</fieldset>` : `
<article class="rule need" data-coll="reviews" data-id="${n.id}" id="n-${n.id}">
  <div class="ht"><h3>${esc(n.title)}</h3><button type="button" class="say" data-say="${n.id}" aria-label="Listen from here" hidden>🔊</button></div>
  <p class="text">${esc(n.text)}</p>
  <div class="vb" role="group" aria-label="Your verdict"><button type="button" data-v="approve">Approve</button><button type="button" data-v="change">Change</button><button type="button" data-v="cut">Cut</button></div>
  <label class="nl">Notes <textarea rows="2" placeholder="What would you change?"></textarea></label>
  <p class="saved" aria-live="polite"></p>
</article>`;

const planRule = (r) => `
<article class="rule" id="p-${r.id}">
  <div class="ht"><h3>${r.changed ? '<span class="chip changed">Changed from your note</span>' : ''}${esc(r.title)}</h3><button type="button" class="say" data-say="p-${r.id}" aria-label="Listen from here" hidden>🔊</button></div>
  <p class="text">${esc(r.rule)}</p>
  ${r.playerNote ? `<p class="quote">Your note: “${esc(r.playerNote)}”</p>` : ''}
  ${r.extra && !r.playerNote ? `<p class="quote">${esc(r.extra)}</p>` : ''}
  <details><summary>How it’s checked, and why</summary><dl><dt>Checked by</dt><dd>${esc(r.check)}</dd><dt>Why</dt><dd>${esc(r.why)}</dd></dl></details>
</article>`;

const archiveQ = (q) => {
  const a = R1.answers[q.id] ?? {};
  const pick = typeof a.choice === 'number' ? q.options[a.choice] : null;
  return `<div class="panel"><h3>${esc(q.text)}</h3><p>${pick ? `You chose: <b>${esc(pick)}</b>` : '<span class="empty">Not answered</span>'}</p>${a.note ? `<p class="quote">“${esc(a.note)}”</p>` : ''}</div>`;
};
const marks = Object.values(R1.reviews).reduce((m, v) => ((m[v.verdict ?? 'none'] = (m[v.verdict ?? 'none'] ?? 0) + 1), m), {});

const lossBars = () => {
  const rows = [['Waves 1–5', T.lost.w1to5], ['Waves 6–10', T.lost.w6to10], ['Boss rounds', T.lost.boss]];
  const max = Math.max(...rows.map((r) => r[1]));
  return `<div class="bars">${rows.map(([k, v]) => `<div class="bar"><span class="bl">${k}</span><span class="bt"><span class="bf" style="width:${Math.max(2, (v / max) * 100)}%"></span></span><b>${v}</b></div>`).join('')}</div><p class="cap">Ships lost across your ${T.scorecards} map scorecards (rounds 11–12).</p>`;
};

const html = `<title>Map Rebuild</title>
<style>
${CSS}
</style>
<main>
<h1>Map Rebuild</h1>
<p class="lead">Everything about the map rebuild lives here: what needs you, where the build stands, the plan, and what you’ve already decided. Updated ${esc(STATUS.updated)}.</p>
<p class="tops"><button type="button" class="jump listen" id="listen" hidden>🔊 Listen to this tab</button></p>
<p class="cap" id="listen-note" hidden></p>
<p id="store">Connecting…</p>
<nav aria-label="Sections">
  <button type="button" data-tab="needs">Needs you<span class="badge" id="needs-count"></span></button>
  <button type="button" data-tab="status">Status</button>
  <button type="button" data-tab="plan">The plan</button>
  <button type="button" data-tab="archive">Archive</button>
</nav>

<section class="sec" data-sec="needs"><h2 id="h-needs">Needs you</h2>
<p class="blurb">Only new things that need your call. Once you’ve answered one, it moves to the Archive.</p>
${NEEDS.map(needCard).join('')}
<p class="empty" id="needs-empty" hidden>Nothing needs you right now. The build is running; this page updates as it goes.</p>
<fieldset class="q" data-q="${ROUND_ELSE}" id="q-${ROUND_ELSE}"><legend>Anything else? Notes for the build, at any time.</legend><label class="nl">Notes <textarea id="qn-${ROUND_ELSE}" rows="3"></textarea></label><p class="saved" aria-live="polite"></p></fieldset>
</section>

<section class="sec" data-sec="status"><h2>Status</h2>
<div class="panel" id="st-head"><p><b>${esc(STATUS.headline)}</b></p><p class="cap">Updated ${esc(STATUS.updated)}</p></div>
<div class="panel">${STATUS.phases.map((p) => `<div class="phase" id="ph-${p.id}"><span class="chip ${p.state}">${STATE[p.state]}</span><div><b>${esc(p.name)}</b><span class="cap">${esc(p.detail)}</span></div></div>`).join('')}</div>
<div class="panel prs"><h3>Pull requests</h3><ul class="plain">${STATUS.prs.map((p) => `<li><a href="https://github.com/50thycal/td_cargo_ship/pull/${p.n}">#${p.n}</a> ${esc(p.title)} · <b>${esc(p.state)}</b></li>`).join('')}</ul><p class="cap">Pull requests merge on their own once CI passes.</p></div>
<div class="panel" id="st-log"><h3>Recent changes</h3><ul class="plain">${STATUS.log.map((l) => `<li><span class="cap">${esc(l.date)}</span> ${esc(l.what)}</li>`).join('')}</ul></div>
</section>

<section class="sec" data-sec="plan"><h2>The plan</h2>
<p class="blurb">The rules every map and its waves follow, with your round 1 decisions folded in.</p>
<div class="panel" id="pl-settled"><h3>Settled in round 1</h3><ul class="plain">${SETTLED.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>
${SECTIONS.map((s) => `<h2 id="h-${s.id}">${esc(s.name)}</h2><p class="blurb">${esc(s.blurb)}</p>${FINAL.filter((r) => r.sec === s.id).map(planRule).join('')}`).join('')}
</section>

<section class="sec" data-sec="archive"><h2>Archive</h2>
<p class="blurb">What you’ve already answered. Nothing here is asked again.</p>
<div id="answered-now"></div>
${ANSWERED.length ? `<h3>Answered since round 1</h3>${ANSWERED.map((n) => `<div class="panel"><h3>${esc(n.title)}</h3><p>Your call: <b>${esc({ approve: 'Approved', change: 'Change', cut: 'Cut' }[n.verdict] ?? n.verdict)}</b> <span class="cap">${esc(n.at)}</span></p>${n.note ? `<p class="quote">“${esc(n.note)}”</p>` : ''}</div>`).join('')}` : ''}
<h3>Round 1 rules (${RULES.length})</h3>
<p class="cap">Approved ${marks.approve ?? 0} · Changed ${marks.change ?? 0} · Cut ${marks.cut ?? 0}${marks.none ? ' · left unmarked ' + marks.none : ''}. The changes are in “The plan”.</p>
<h3>Round 1 questions</h3>
${QUESTIONS.map(archiveQ).join('')}
${R1.answers['mr-else']?.note ? `<div class="panel"><h3>Your “anything else” (round 1)</h3><p class="quote">“${esc(R1.answers['mr-else'].note)}”</p></div>` : ''}
<h3>The evidence behind the rules</h3>
<div class="panel">${lossBars()}<p class="cap">Wave 1 was your weakest wave on ${T.weakestWave1} of ${T.scorecards}; readability 5 on ${T.readability5} of ${T.scorecards}.</p></div>
</section>
</main>
<div id="player" hidden role="region" aria-label="Listening">
  <div class="pl-now" id="pl-now" aria-live="polite"></div>
  <div class="pl-ctl">
    <button type="button" id="pl-prev">Back</button>
    <button type="button" id="pl-play">Pause</button>
    <button type="button" id="pl-next">Next</button>
    <button type="button" id="pl-stop">Stop</button>
    <button type="button" id="pl-rate">1×</button>
  </div>
</div>
<script>
(() => {
  const NEEDS = ${JSON.stringify(NEEDS.map((n) => ({ id: n.id, kind: n.kind, title: n.title, options: n.options ?? null })))};
  const SCRIPT = ${JSON.stringify(SCRIPT)};
  const COLLS = ['reviews', 'answers'];
  const LS = 'straitwatch-map-hub';
  const state = { reviews: {}, answers: {} };
  let db = null, tab = 'needs';
  const $ = (id) => document.getElementById(id);
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  const VERB = { approve: 'Approved', change: 'Change', cut: 'Cut' };
  const decided = (n) => n.kind === 'question' ? typeof (state.answers[n.id] || {}).choice === 'number' : !!(state.reviews[n.id] || {}).verdict;

  function paintNeeds() {
    let open = 0;
    const done = [];
    for (const n of NEEDS) {
      const el = $('n-' + n.id);
      // An item answered on an earlier visit leaves Needs; one answered just
      // now stays in place until the page is opened again, so a mis-tap can
      // be changed.
      const gone = decided(n) && !el.dataset.touched;
      el.hidden = gone;
      if (!decided(n)) open++;
      if (decided(n)) done.push(n);
    }
    $('needs-empty').hidden = open > 0;
    $('needs-count').textContent = open ? String(open) : '';
    $('needs-count').hidden = !open;
    $('answered-now').innerHTML = done.length ? '<h3>Answered this round</h3>' + done.map((n) => {
      const s = n.kind === 'question' ? state.answers[n.id] : state.reviews[n.id];
      const what = n.kind === 'question' ? (n.options || [])[s.choice] : VERB[s.verdict];
      return '<div class="panel"><b>' + esc(n.title) + '</b><p>Your call: <b>' + esc(what || '') + '</b></p>' + (s.note ? '<p class="quote">“' + esc(s.note) + '”</p>' : '') + '</div>';
    }).join('') : '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
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
    const ta = $('qn-' + id);
    if (ta && document.activeElement !== ta && typeof s.note === 'string') ta.value = s.note;
  }
  function paintAll() {
    document.querySelectorAll('[data-coll]').forEach(paintItem);
    document.querySelectorAll('.q').forEach((f) => paintQ(f.dataset.q));
    paintNeeds();
  }
  function paintTab() {
    document.querySelectorAll('nav [data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    document.querySelectorAll('section.sec').forEach((s) => s.classList.toggle('hidden', s.dataset.sec !== tab));
  }
  const flash = (el, msg) => { if (el) el.textContent = msg; };
  const busy = {};
  async function save(coll, id, body, statusEl) {
    state[coll][id] = Object.assign({}, state[coll][id], body);
    const holder = $('n-' + id); if (holder) holder.dataset.touched = '1';
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
    const id = f.dataset.q, st = f.querySelector('.saved'), ta = $('qn-' + id);
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => save('answers', id, { choice: Number(i.value), note: ta.value }, st)));
    let t;
    ta.addEventListener('input', () => { clearTimeout(t); flash(st, 'Typing…'); t = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(t); if ((state.answers[id] || {}).note !== ta.value && ta.value !== '') save('answers', id, { note: ta.value }, st); });
  });

  // ---- Listen: a Claude voice where the page may use one, else the
  // browser's own voice (iPhone Safari and the Claude app have no Claude voice).
  const RATES = [1, 1.25, 1.5, 0.85];
  let rateI = 0; try { rateI = Number(localStorage.getItem(LS + '-rate')) || 0; } catch {}
  let tts = null, engine = null, queue = [], at = -1, playing = false, paused = false, gen = 0;
  const web = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
  function itemsForTab() {
    return SCRIPT.filter((x) => x.tab === tab && !(x.open && NEEDS.some((n) => n.id === x.id && decided(n))));
  }
  function mark(i) {
    document.querySelectorAll('.reading').forEach((e) => e.classList.remove('reading'));
    at = i;
    const it = queue[i];
    if (!it) return;
    const el = $(it.el);
    if (el) { el.classList.add('reading'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
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
    const u = new SpeechSynthesisUtterance(queue[i].text);
    u.rate = RATES[rateI]; u.lang = 'en-US';
    u.onend = () => { if (g === gen && !paused) setTimeout(() => webFrom(i + 1, g), 250); };
    u.onerror = (e) => { if (g === gen && e.error !== 'interrupted' && e.error !== 'canceled') finish(); };
    speechSynthesis.speak(u);
  }
  function start(i) {
    if (!queue.length) { $('listen-note').textContent = 'Nothing to read on this tab.'; $('listen-note').hidden = false; return; }
    i = Math.max(0, Math.min(queue.length - 1, i));
    gen++; const g = gen;
    playing = true; paused = false; ui();
    if (engine === 'claude') {
      mark(i);
      tts.speak(queue.slice(i).map((it) => ({ text: it.text.slice(0, 1990), id: it.id })), { rate: RATES[rateI], language: 'en' })
        .then(() => { if (g === gen) finish(); })
        .catch((e) => {
          if (g !== gen) return;
          const msg = e && e.code === 'not_granted' ? 'Reading aloud is turned off for this page (its Permissions menu).' : e && e.code === 'no_gesture' ? 'Tap Listen again to start.' : e && e.code === 'rate_limited' ? 'Reading aloud is busy right now. Try again in a bit.' : '';
          if (msg) { $('listen-note').textContent = msg; $('listen-note').hidden = false; }
          finish();
        });
    } else { speechSynthesis.cancel(); webFrom(i, g); }
  }
  function listenFrom(id) {
    queue = itemsForTab();
    let i = id ? queue.findIndex((x) => x.id === id) : 0;
    start(Math.max(0, i));
  }
  function stopAll() { gen++; if (engine === 'claude') tts.stop().catch(() => {}); else if (web) speechSynthesis.cancel(); finish(); }
  function togglePause() {
    if (!playing) return;
    if (engine === 'claude') { if (paused) tts.resume().catch(() => {}); else tts.pause().catch(() => {}); paused = !paused; ui(); return; }
    if (paused) { paused = false; start(at); } else { paused = true; gen++; speechSynthesis.cancel(); ui(); }
  }
  function enable(kind) { engine = kind; $('listen').hidden = false; document.querySelectorAll('.say').forEach((b) => { b.hidden = false; }); }
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

  document.querySelectorAll('nav [data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    if (playing) stopAll();
    try { sessionStorage.setItem(LS + '-tab', tab); } catch {}
    paintTab();
    window.scrollTo({ top: 0 });
  }));
  try { tab = sessionStorage.getItem(LS + '-tab') || 'needs'; } catch {}
  const local = lsGet();
  Object.assign(state.reviews, local.reviews || {});
  Object.assign(state.answers, local.answers || {});
  paintAll(); paintTab();
  const note = $('store');
  if (!(window.claude && window.claude.use)) { note.textContent = 'Open this page on claude.ai, signed in, to save your answers. Answers made here stay in this browser.'; return; }
  const timer = setTimeout(() => { note.textContent = 'The store isn’t answering yet. Answers you give are kept in this browser until it does.'; }, 10000);
  window.claude.use('db').then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Answers stay in this browser.'; return; }
    db = d;
    note.textContent = 'Your answers save here for the build sessions to read.';
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
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the store. Reload to try again.'; });
    }
  });
})();
</script>
`;
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB: ${NEEDS.length} need you, ${FINAL.filter((r) => r.changed).length} rules changed, status ${STATUS.updated})`);
