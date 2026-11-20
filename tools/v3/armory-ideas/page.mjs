// Builds the review page for the Armory overhaul brainstorm (round ar1), an
// HTML artifact made from tools/v3/armory-ideas/ideas.mjs (started from
// tools/v3/weapon-ideas/page2.mjs, the review-page skill's template):
//   - Questions: the short-term lift (Looks right / Change per upgrade) and
//     the open questions (radio options, recommended first, notes, and
//     "Anything else?");
//   - Upgrades: every existing upgrade, Keep / Change / Cut;
//   - System: the bays, the Scrap design, the three other ways (Go further /
//     Maybe / Drop);
//   - New cards: candidates (Go further / Maybe / Drop);
//   - My picks.
// Marks save to the artifact's database: `reviews/{itemId}` {verdict, note},
// `answers/{questionId}` {choice, note}; every id starts `ar1-`.
// Usage: node tools/v3/armory-ideas/page.mjs <out.html>
import { writeFileSync } from 'node:fs';
import {
  DATE, PAGE_TITLE, PLAYER_ASK, PLAYER_LIFT, TODAY, ROUND7_QUOTE, UPGRADES, BAYS, BAYS_NOW, BAY_OPTIONS, SCRAP, SCRAP_PER_LEVEL_TOTAL, SCRAP_WIN, PACING,
  ALTERNATIVES, NEW_COUNT, NEW_UPGRADES, LIFT_NOTE, LIFT_ITEMS, LIFT_BUILDS, LIFT_WATCH, QUESTIONS, ELSE_ID, LIFT, SWEEP_SEEDS, sweepSaved, lift, fill, allIds,
} from './ideas.mjs';

const out = process.argv[2];
if (!out) throw new Error('usage: node page.mjs <out.html>');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const t = (s) => esc(fill(s));
const REC = { keep: 'Keep', change: 'Change', merge: 'Merge', cut: 'Cut' };
const SCALE = 16; // ships saved: bar scale
const middle = [...UPGRADES.map((u) => sweepSaved(u.id))].sort((a, b) => a - b)[Math.floor(UPGRADES.length / 2)];

function bar(who, v, tick, label) {
  const w = Math.max(0, Math.min(100, (100 * v) / SCALE));
  const k = (100 * tick) / SCALE;
  return `<div class="bar"><span class="who">${esc(who)}</span><span class="track" role="img" aria-label="${esc(label)}"><span class="fill" style="width:${w}%"></span><span class="base" style="left:${k}%"></span></span><span class="num">${v < 0 ? '−' + Math.abs(v) : v}</span></div>`;
}

function seg(kind) {
  const sets = {
    up: [['keep', 'Keep'], ['change', 'Change'], ['cut', 'Cut']],
    idea: [['go', 'Go further'], ['maybe', 'Maybe'], ['drop', 'Drop']],
    spec: [['ok', 'Looks right'], ['change', 'Change']],
  };
  return `<div class="seg">${sets[kind].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="false">${l}</button>`).join('')}</div>`;
}
function review(id, name, kind, ph) {
  return `<div class="review" role="group" aria-label="Your call on ${esc(name)}">${seg(kind)}
    <label class="note"><span>Notes</span><textarea id="n-${id}" rows="2" placeholder="${esc(ph)}"></textarea></label>
    <div class="saved" aria-live="polite"></div></div>`;
}

function upCard(u) {
  const id = `ar1-up-${u.id}`;
  const lv = u.levels.map((l, k) => `<li><b>${k === 4 ? 'L5' : 'L' + (k + 1)}</b>${esc(l)}</li>`).join('');
  return `<article class="idea" id="${id}" data-coll="reviews" data-id="${id}" data-kind="up" data-sec="up">
  <header><div class="no" style="--bay:${BAYS[u.bay].color}">${BAYS[u.bay].name}</div>
    <div class="ttl"><h3>${esc(u.name)}</h3><div class="chips"><span class="chip rec rec-${u.rec}">Recommended: ${REC[u.rec]}</span></div></div></header>
  <p class="pitch">${t(u.does)}</p>
  <div class="proto"><div class="lbl">Ships saved a run, alone at level 5 <span class="key">tick = the Armory’s middle (${middle})</span></div>
    ${bar('Counter kit', sweepSaved(u.id), middle, `${u.name} with the counter kit saves ${sweepSaved(u.id)} ships a run`)}
    ${bar('Own draft', sweepSaved(u.id, 'self'), middle, `${u.name} with the bot drafting for itself saves ${sweepSaved(u.id, 'self')} ships a run`)}
  </div>
  <details class="more"><summary>Levels</summary><ol class="levels">${lv}</ol></details>
  <dl class="sw"><div><dt>▲ Strong</dt><dd>${t(u.strong)}</dd></div><div><dt>▼ Weak</dt><dd>${t(u.weak)}</dd></div></dl>
  <p class="recwhy"><b>${REC[u.rec]}.</b> ${t(u.recWhy)}</p>
  ${review(id, u.name, 'up', 'Keep it, change it how, or cut it')}
</article>`;
}

function liftCard(l) {
  const b = lift(l.before), a = lift(l.after);
  const tried = l.tried.map(([k, what]) => `<li><span>${esc(what)}</span><b>${lift(k).saved}</b></li>`).join('');
  const lv = l.now.map((n, k) => `<tr><th>L${k + 1}</th><td>${esc(n)}</td><td>${esc(l.next[k])}</td></tr>`).join('');
  return `<article class="idea lift" id="${l.id}" data-coll="reviews" data-id="${l.id}" data-kind="spec" data-sec="q">
  <header><div class="ttl"><h3>${esc(l.name)}</h3><div class="chips"><span class="chip warn">Not applied yet</span></div></div></header>
  <p class="pitch">${t(l.rule)}</p>
  <div class="proto"><div class="lbl">Ships saved a run at level 5 <span class="key">band = the middle, 5–7</span></div>
    ${bar('Now', b.saved, 0, `${l.name} now saves ${b.saved} ships a run`).replace('<span class="base"', '<span class="band"></span><span class="base" hidden')}
    ${bar('Lifted', a.saved, 0, `${l.name} lifted saves ${a.saved} ships a run`).replace('<span class="base"', '<span class="band"></span><span class="base" hidden')}
    <p class="pn">± ${a.se} ships (one standard error).</p>
  </div>
  <div class="tblwrap"><table class="lv"><thead><tr><th></th><th>Now</th><th>Lifted</th></tr></thead><tbody>${lv}</tbody></table></div>
  <details class="more"><summary>What was tried</summary><ul class="tried">${tried}</ul><p>${t(l.why)}</p></details>
  ${review(l.id, l.name + ' lift', 'spec', 'Other numbers?')}
</article>`;
}

function ideaCard(a, extra) {
  return `<article class="idea" id="${a.id}" data-coll="reviews" data-id="${a.id}" data-kind="idea" data-sec="${extra.sec}">
  <header>${extra.badge ? `<div class="no">${esc(extra.badge)}</div>` : ''}<div class="ttl"><h3>${esc(a.name)}</h3><div class="chips">${extra.chips.map((c) => `<span class="chip${c[1] ? ' ' + c[1] : ''}">${esc(c[0])}</span>`).join('')}</div></div></header>
  <p class="pitch">${t(a.pitch)}</p>
  ${extra.body}
  ${review(a.id, a.name, 'idea', 'What you’d change, or why not')}
</article>`;
}

function question(q) {
  return `<fieldset class="q" data-q="${q.id}"><legend>${t(q.q)}</legend>
  ${q.options.map((o, k) => `<label class="opt"><input type="radio" name="q-${q.id}" value="${k}" id="q-${q.id}-${k}"><span>${t(o)}</span></label>`).join('')}
  <label class="note"><span>Notes</span><textarea id="qn-${q.id}" rows="2"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>`;
}

const ids = allIds();
const UP_IDS = UPGRADES.map((u) => `ar1-up-${u.id}`);
const IDEA_IDS = [...ALTERNATIVES.map((a) => a.id), ...NEW_UPGRADES.map((n) => n.id)];
const LIFT_IDS = LIFT_ITEMS.map((l) => l.id);
const QIDS = QUESTIONS.map((q) => q.id);

const buildRows = LIFT_BUILDS.map((b) => `<tr><th>${esc(b.name)}</th><td>${lift(b.before).lost}</td><td>${lift(b.after).lost}</td><td>${lift(b.before).won}% → ${lift(b.after).won}%</td></tr>`).join('');
const qSection = `<section class="sec" id="sec-q" data-sec="q" aria-labelledby="h-q">
  <div class="cathead"><h2 id="h-q">Decide <span class="count" id="q-count"></span></h2>
  <p>First the quick fix you picked, measured. Then the questions that steer the overhaul.</p></div>
  <h3 class="sub">The lift (your pick)</h3>
  <blockquote class="quote">“${esc(PLAYER_LIFT)}”</blockquote>
  <p class="pn">${t(LIFT_NOTE)}</p>
  <div class="grid">${LIFT_ITEMS.map(liftCard).join('\n')}</div>
  <div class="tblwrap"><table class="data"><caption>Whole builds: ships lost a run (all 13 waves), before → after</caption><thead><tr><th>Build</th><th>Before</th><th>After</th><th>Won</th></tr></thead><tbody>${buildRows}</tbody></table></div>
  <p class="pn warnline">${t(LIFT_WATCH)}</p>
  <h3 class="sub">Questions</h3>
  <div class="qs">${QUESTIONS.map(question).join('\n')}
    <fieldset class="q" data-q="${ELSE_ID}"><legend>Anything else?</legend><label class="note"><span>Notes</span><textarea id="qn-${ELSE_ID}" rows="3"></textarea></label><div class="saved" aria-live="polite"></div></fieldset>
  </div>
</section>`;

const upSection = `<section class="sec" id="sec-up" data-sec="up" aria-labelledby="h-up">
  <div class="cathead"><h2 id="h-up">The 11 upgrades <span class="count" id="up-count"></span></h2>
  <p>Each alone at level 5, ships saved a run against no Armory (combo sweep, ${SWEEP_SEEDS} seeds on each of five maps): with the map’s counter kit, and with the bot drafting for itself. Higher is better; a whole weapon saves about 7–10.</p></div>
  <div class="grid">${UPGRADES.map(upCard).join('\n')}</div>
</section>`;

const earnRows = SCRAP.earn.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('');
const costRows = SCRAP.cost.slice(1).map((c, k) => `<tr><th>Level ${k + 1} → ${k + 2}</th><td>${c}</td></tr>`).join('');
const paceRows = PACING.map((p) => `<tr><th>${esc(p.name)} <small>(wins ${Math.round(p.win * 100)}%)</small></th><td>${p.todayThree} → <b>${p.scrapThree}</b></td><td>${p.todayAll} → <b>${p.scrapAll}</b></td></tr>`).join('');
const sysSection = `<section class="sec" id="sec-sys" data-sec="sys" aria-labelledby="h-sys">
  <div class="cathead"><h2 id="h-sys">The system</h2><p>How the Armory works today, the bays, your Scrap idea worked out, and three other ways to change it.</p></div>
  <h3 class="sub">Today</h3>
  <ul class="plain">${TODAY.map((x) => `<li>${t(x)}</li>`).join('')}</ul>
  <h3 class="sub">Categories (the bays)</h3>
  <ul class="plain">${BAYS_NOW.map((x) => `<li>${t(x)}</li>`).join('')}</ul>
  <div class="grid">${BAY_OPTIONS.map((o) => `<article class="spec${o.rec ? ' recd' : ''}"><h3>${esc(o.name)}${o.rec ? ' <span class="chip rec rec-keep">Recommended</span>' : ''}</h3><p>${t(o.what)}</p><p class="pn">${t(o.why)}</p></article>`).join('')}</div>
  <p class="pn">Answer in the Decide tab (“The bays”).</p>
  <h3 class="sub">Unlocks: Scrap, the Survivor.io way</h3>
  <blockquote class="quote">“…how they are unlocked such as exp collected in game (I think how survivor io did this is exp and you use that to upgrade the ones you find at the end of game).”</blockquote>
  <article class="spec wide">
    <p class="pitch">${t(SCRAP.pitch)}</p>
    <p class="pn">${t(SCRAP.survivor)}</p>
    <h4>The loop</h4><ol class="loop">${SCRAP.loop.map((x) => `<li>${t(x)}</li>`).join('')}</ol>
    <div class="two">
      <div class="tblwrap"><table class="data"><caption>Scrap earned</caption><tbody>${earnRows}</tbody></table><p class="pn">A cleared map pays ${SCRAP_WIN} (+${SCRAP.earn.find((e) => e[0].startsWith('First'))[1]} the first time).</p></div>
      <div class="tblwrap"><table class="data"><caption>Scrap to level a card</caption><tbody>${costRows}</tbody></table><p class="pn">${SCRAP_PER_LEVEL_TOTAL} Scrap from level 1 to 5, about ${Math.round(SCRAP_PER_LEVEL_TOTAL / SCRAP_WIN)} cleared maps.</p></div>
    </div>
    <h4>Pacing: runs until…</h4>
    <div class="tblwrap"><table class="data"><thead><tr><th>Player</th><th>the 3 you equip are at L5 (today → Scrap)</th><th>all 55 levels (today → Scrap)</th></tr></thead><tbody>${paceRows}</tbody></table></div>
    <p class="pn">A model, not a playtest: 2000 simulated careers a player type, with today’s card drops; a lost run ends around wave 8, 6 and 4. ${t(SCRAP.pacing)}</p>
    <h4>What it replaces</h4><ul class="plain">${SCRAP.replaces.map((x) => `<li>${t(x)}</li>`).join('')}</ul>
    <p class="warnline"><b>Against round 7.</b> ${t(SCRAP.conflict)}</p>
    <p class="pn"><b>Your save.</b> ${t(SCRAP.save)}</p>
  </article>
  <h3 class="sub">Three other ways to change the Armory</h3>
  <div class="grid">${ALTERNATIVES.map((a) =>
    ideaCard(a, {
      sec: 'sys', badge: a.name.slice(0, 1), chips: [[a.tag], [`Build: ${a.size}`]],
      body: `<details class="more"><summary>How it plays</summary><p>${t(a.how)}</p></details>
  <dl class="sw"><div><dt>▲ Strong</dt><dd>${t(a.strong)}</dd></div><div><dt>▼ Weak</dt><dd>${t(a.weak)}</dd></div></dl>
  <p class="pn"><b>Cost to build.</b> ${t(a.cost)}</p>`,
    }),
  ).join('\n')}</div>
</section>`;

const newSection = `<section class="sec" id="sec-new" data-sec="new" aria-labelledby="h-new">
  <div class="cathead"><h2 id="h-new">New upgrades <span class="count" id="new-count"></span></h2>
  <p><b>Recommended: ${NEW_COUNT.rec}.</b> ${t(NEW_COUNT.why)}</p></div>
  <div class="grid">${NEW_UPGRADES.map((n) =>
    ideaCard(n, {
      sec: 'new', badge: BAYS[n.bay].name, chips: n.rec ? [['Recommended', 'rec rec-keep']] : [['Spare idea']],
      body: `<dl class="sw"><div><dt>▲ The gap</dt><dd>${t(n.gap)}</dd></div><div><dt>▼ Risk</dt><dd>${t(n.risk)}</dd></div></dl>`,
    }),
  ).join('\n')}</div>
</section>`;

const html = `<title>${esc(PAGE_TITLE)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* A chart-room briefing, as the weapon review: a sticky strip of tabs and a
   tally; cards in a grid that drops to one column on a phone. */
:root {
  --sea: #e8eef2; --paper: #f7fafb; --ink: #12202b; --muted: #536472; --rule: #cfdae1;
  --signal: #b25a00; --friend: #0b7c78; --go: #1f7a3d; --maybe: #8a6200; --drop: #a33a2c;
  --chip: #dde7ed; --fill: #0b7c78; --track: #dbe4ea; --mark: #12202b; --band: rgba(31,122,61,.18);
  --display: "Saira Condensed", "Arial Narrow", system-ui, sans-serif;
  --body: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --sea: #0b141c; --paper: #111e29; --ink: #e3ecf1; --muted: #93a6b4; --rule: #23384a;
  --signal: #ffb347; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1b2c3a; --fill: #4fd1c5; --track: #1e3142; --mark: #e3ecf1; --band: rgba(95,211,138,.22); color-scheme: dark } }
:root[data-theme="dark"] {
  --sea: #0b141c; --paper: #111e29; --ink: #e3ecf1; --muted: #93a6b4; --rule: #23384a;
  --signal: #ffb347; --friend: #4fd1c5; --go: #5fd38a; --maybe: #f0c35a; --drop: #ff8a7a;
  --chip: #1b2c3a; --fill: #4fd1c5; --track: #1e3142; --mark: #e3ecf1; --band: rgba(95,211,138,.22); color-scheme: dark }
* { box-sizing: border-box; }
body { background: var(--sea); color: var(--ink); font: 15px/1.5 var(--body); margin: 0; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 0 48px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--sea); }
main { max-width: 1120px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; min-width: 0; }
h1, h2, h3, h4 { font-family: var(--display); text-wrap: balance; margin: 0; letter-spacing: 0.01em; }
h1 { font-size: clamp(30px, 6vw, 44px); line-height: 1; text-transform: uppercase; }
h4 { font-size: 17px; text-transform: uppercase; margin-top: 6px; }
.intro { display: grid; gap: 10px; padding-top: 24px; max-width: 70ch; }
.eyebrow { font: 600 12px/1 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--signal); }
.intro p { margin: 0; color: var(--muted); }
.store { font-size: 13px; color: var(--muted); }
.bar-sticky { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--sea); padding-block: 10px; border-bottom: 1px solid var(--rule); display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tabs button { flex: none; }
.tabs button, .seg button { font: 600 13px/1 var(--body); border: 1px solid var(--rule); background: var(--paper); color: var(--ink); padding: 9px 10px; border-radius: 6px; cursor: pointer; min-height: 36px; }
.tabs button[aria-pressed="true"] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.tally { font: 500 13px/1.3 var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }
.tally b { color: var(--go); }
button:focus-visible, textarea:focus-visible, input:focus-visible, summary:focus-visible { outline: 2px solid var(--signal); outline-offset: 2px; }
.sec { display: grid; gap: 14px; min-width: 0; }
.cathead { display: grid; gap: 4px; }
.cathead h2 { font-size: 28px; text-transform: uppercase; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.count { font: 500 14px var(--mono); color: var(--go); }
.cathead p { margin: 0; color: var(--muted); max-width: 75ch; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 440px), 1fr)); gap: 14px; }
.idea, .spec { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.spec.recd { border-color: var(--go); }
.spec p { margin: 0; }
.spec.wide { gap: 12px; }
.idea[data-v="go"], .idea[data-v="keep"], .idea[data-v="ok"] { border-color: var(--go); box-shadow: inset 4px 0 0 var(--go); }
.idea[data-v="maybe"], .idea[data-v="change"] { border-color: var(--maybe); box-shadow: inset 4px 0 0 var(--maybe); }
.idea[data-v="drop"], .idea[data-v="cut"] { opacity: 0.62; }
.idea header { display: flex; gap: 12px; align-items: flex-start; }
.no { font: 700 12px/1 var(--mono); color: var(--signal); border: 1.5px solid var(--bay, var(--signal)); border-radius: 5px; padding: 5px 6px; min-width: 38px; text-align: center; text-transform: uppercase; }
.ttl { display: grid; gap: 6px; min-width: 0; }
.ttl h3 { font-size: 22px; line-height: 1.1; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font: 600 11px/1 var(--body); letter-spacing: 0.04em; text-transform: uppercase; background: var(--chip); color: var(--muted); padding: 4px 7px; border-radius: 4px; }
.chip.warn { color: var(--maybe); }
.chip.rec-keep { color: var(--go); }
.chip.rec-change { color: var(--maybe); }
.chip.rec-cut { color: var(--drop); }
.pitch { margin: 0; font-size: 16px; font-weight: 500; }
.more summary { cursor: pointer; font-weight: 600; color: var(--friend); min-height: 28px; }
.more p { margin: 8px 0 0; }
.levels { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 4px; }
.levels li { display: grid; grid-template-columns: 34px 1fr; gap: 8px; }
.levels b { font: 600 12px/1.6 var(--mono); color: var(--signal); }
.sw { margin: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.sw div { min-width: 0; }
.sw dt { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.sw div:first-child dt { color: var(--go); }
.sw div:last-child dt { color: var(--drop); }
.sw dd { margin: 2px 0 0; font-size: 14px; }
.recwhy { margin: 0; font-size: 14px; border-left: 3px solid var(--signal); padding-left: 8px; }
.proto { border-top: 1px dashed var(--rule); padding-top: 8px; display: grid; gap: 6px; }
.proto .lbl { font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; }
.key { text-transform: none; letter-spacing: 0; font-weight: 500; }
.bar { display: grid; grid-template-columns: 84px minmax(0, 1fr) 44px; gap: 8px; align-items: center; font-size: 13px; }
.who { color: var(--muted); }
.track { position: relative; height: 10px; background: var(--track); border-radius: 3px; }
.fill { position: absolute; inset: 0 auto 0 0; background: var(--fill); border-radius: 3px; }
.base { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--mark); }
.band { position: absolute; top: -3px; bottom: -3px; left: ${(100 * 5) / SCALE}%; width: ${(100 * 2) / SCALE}%; border: 1.5px solid var(--go); border-radius: 2px; background: var(--band); z-index: 1; }
.num { font: 500 13px var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
.pn { margin: 0; font-size: 13px; color: var(--muted); }
.warnline { margin: 0; font-size: 14px; color: var(--ink); border-left: 3px solid var(--maybe); padding-left: 8px; }
.review { display: grid; gap: 8px; margin-top: auto; padding-top: 6px; }
.seg { display: flex; flex-wrap: wrap; gap: 6px; }
.seg button[data-v="go"][aria-pressed="true"], .seg button[data-v="keep"][aria-pressed="true"], .seg button[data-v="ok"][aria-pressed="true"] { background: var(--go); border-color: var(--go); color: var(--paper); }
.seg button[data-v="maybe"][aria-pressed="true"], .seg button[data-v="change"][aria-pressed="true"] { background: var(--maybe); border-color: var(--maybe); color: var(--paper); }
.seg button[data-v="drop"][aria-pressed="true"], .seg button[data-v="cut"][aria-pressed="true"] { background: var(--drop); border-color: var(--drop); color: var(--paper); }
.note { display: grid; gap: 4px; }
.note span { font-size: 12px; color: var(--muted); }
textarea { font: 16px/1.4 var(--body); color: var(--ink); background: var(--sea); border: 1px solid var(--rule); border-radius: 6px; padding: 8px; width: 100%; resize: vertical; }
.saved { font-size: 12px; color: var(--muted); min-height: 1.2em; }
.qs { display: grid; gap: 12px; }
.q { background: var(--paper); border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; display: grid; gap: 6px; margin: 0; min-width: 0; }
.q legend { font-weight: 600; padding: 0; float: left; width: 100%; margin-bottom: 6px; }
.opt { display: flex; gap: 8px; align-items: flex-start; padding: 5px 0; cursor: pointer; }
.opt input { margin-top: 4px; accent-color: var(--signal); flex: none; }
.hidden-sec { display: none !important; }
.sub { font-size: 21px; text-transform: uppercase; margin-top: 10px; border-top: 1px solid var(--rule); padding-top: 14px; }
.quote { margin: 0; padding-left: 10px; border-left: 3px solid var(--signal); color: var(--muted); font-style: italic; max-width: 75ch; }
.plain { margin: 0; padding-left: 18px; display: grid; gap: 4px; max-width: 80ch; }
.loop { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 14px; }
.tblwrap { max-width: 100%; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
caption { text-align: left; font: 600 12px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); padding-bottom: 6px; }
tbody th { font-weight: 500; }
th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--rule); vertical-align: top; }
td { font-family: var(--mono); font-variant-numeric: tabular-nums; }
thead th { font-size: 12px; color: var(--muted); font-weight: 600; }
table.lv td { font-family: var(--body); font-size: 13px; }
table.lv th { font: 600 12px var(--mono); color: var(--signal); width: 34px; }
.tried { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 2px; }
.tried li { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; border-bottom: 1px dotted var(--rule); }
.tried b { font: 500 13px var(--mono); }
code { font: 13px var(--mono); }
@media (max-width: 600px) {
  .sw { grid-template-columns: 1fr; }
  .bar { grid-template-columns: 74px minmax(0, 1fr) 40px; }
  th, td { padding: 5px 6px; }
}
@media (prefers-reduced-motion: no-preference) { .idea { transition: border-color .2s, opacity .2s; } }
</style>

<main>
  <header class="intro">
    <div class="eyebrow">Straitwatch V3 · the Armory · ${DATE}</div>
    <h1>Armory Overhaul</h1>
    <p>The full brainstorm you asked for. <b>Decide</b> has the quick lift you picked, measured, and the questions. <b>Upgrades</b> has all 11 with what each is worth and a Keep / Change / Cut. <b>System</b> works out your Scrap idea, the bays and three other ways to change the Armory. <b>New cards</b> has the candidates. Everything saves as you go, for the next session to read.</p>
    <details class="more"><summary>What you asked</summary><blockquote class="quote">“${esc(PLAYER_ASK)}”</blockquote></details>
    <p><b>The short version.</b> Keep all 11 (none is useless; Long Loads gets a new job). Lift the three weak ones now. Change how levels are earned to Scrap, survivor.io style: cards still found at random, levels bought by your choice. Move Deep Magazine to Supply. Then add Commendations (map perks), and three new cards.</p>
    <p class="store" id="store">Connecting to the review store…</p>
  </header>

  <nav class="bar-sticky" aria-label="Sections">
    <div class="tabs" role="group" aria-label="Section">
      <button type="button" data-tab="q" aria-pressed="true">Decide</button>
      <button type="button" data-tab="up" aria-pressed="false">Upgrades</button>
      <button type="button" data-tab="sys" aria-pressed="false">System</button>
      <button type="button" data-tab="new" aria-pressed="false">New</button>
      <button type="button" data-tab="all" aria-pressed="false">All</button>
      <button type="button" data-tab="go" aria-pressed="false">My picks</button>
    </div>
    <div class="tally" id="tally"></div>
  </nav>

${qSection}

${upSection}

${sysSection}

${newSection}

  <p class="pn" id="empty-picks" hidden>Nothing marked Go further or Keep yet.</p>
</main>

<script>
(() => {
  const UP = ${JSON.stringify(UP_IDS)};
  const IDEAS = ${JSON.stringify(IDEA_IDS)};
  const LIFTS = ${JSON.stringify(LIFT_IDS)};
  const QS = ${JSON.stringify(QIDS)};
  const state = { reviews: {}, answers: {} };
  const COLLS = ['reviews', 'answers'];
  let db = null;
  const LS = 'straitwatch-armory-ar1';
  const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}'); } catch { return {}; } };
  const lsSet = (v) => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
  let tab = 'q';

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
    const upM = UP.filter(v).length, ideaM = IDEAS.filter(v).length;
    const picks = IDEAS.filter((id) => v(id) === 'go').length;
    const qa = QS.filter((id) => state.answers[id] && state.answers[id].choice != null).length;
    const lf = LIFTS.filter(v).length;
    document.getElementById('tally').innerHTML = upM + '/' + UP.length + ' upgrades · ' + ideaM + '/' + IDEAS.length + ' ideas (<b>' + picks + ' go</b>) · ' + qa + '/' + QS.length + ' answered';
    document.getElementById('q-count').textContent = lf + '/' + LIFTS.length + ' lifts checked · ' + qa + '/' + QS.length + ' answered';
    const n = (k) => UP.filter((id) => v(id) === k).length;
    document.getElementById('up-count').textContent = n('keep') + ' keep · ' + n('change') + ' change · ' + n('cut') + ' cut';
    const NEW = IDEAS.filter((id) => id.startsWith('ar1-new-'));
    document.getElementById('new-count').textContent = NEW.filter((id) => v(id) === 'go').length + ' / ' + NEW.length + ' picked';
  }
  function paintTab() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
    const picks = tab === 'go';
    document.querySelectorAll('section.sec').forEach((s) => s.classList.toggle('hidden-sec', !(tab === 'all' || picks || s.dataset.sec === tab)));
    // My picks: only the cards marked Go further or Keep (and their sections).
    let shown = 0;
    document.querySelectorAll('section.sec > *:not(.grid)').forEach((el) => el.classList.toggle('hidden-sec', picks && !el.classList.contains('cathead')));
    document.querySelectorAll('section.sec .grid > *').forEach((el) => {
      const on = !picks || el.dataset.v === 'go' || el.dataset.v === 'keep';
      el.classList.toggle('hidden-sec', !on);
      if (picks && on) shown++;
    });
    if (picks) document.querySelectorAll('section.sec').forEach((s) => s.classList.toggle('hidden-sec', !s.querySelector('.grid > [data-v="go"], .grid > [data-v="keep"]')));
    document.getElementById('empty-picks').hidden = !(picks && !shown);
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
      do { busy[coll + id].again = false; const doc = Object.assign({}, state[coll][id], { at: new Date().toISOString() }); delete doc.pending; await db.collection(coll).doc(id).set(doc); } while (busy[coll + id].again);
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
    let tm;
    ta.addEventListener('input', () => { clearTimeout(tm); flash(st, 'Typing…'); tm = setTimeout(() => save(coll, id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(tm); if ((state[coll][id] || {}).note !== ta.value && ta.value !== '') save(coll, id, { note: ta.value }, st); });
  });
  document.querySelectorAll('.q').forEach((f) => {
    const id = f.dataset.q, st = f.querySelector('.saved');
    const ta = document.getElementById('qn-' + id);
    f.querySelectorAll('input[type=radio]').forEach((i) => i.addEventListener('change', () => save('answers', id, { choice: Number(i.value), note: ta.value }, st)));
    let tm;
    ta.addEventListener('input', () => { clearTimeout(tm); flash(st, 'Typing…'); tm = setTimeout(() => save('answers', id, { note: ta.value }, st), 900); });
    ta.addEventListener('blur', () => { clearTimeout(tm); if ((state.answers[id] || {}).note !== ta.value && ta.value !== '') save('answers', id, { note: ta.value }, st); });
  });
  document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    try { localStorage.setItem(LS + '-tab', tab); } catch {}
    paintTab();
  }));
  try { tab = localStorage.getItem(LS + '-tab') || 'q'; } catch {}

  // Local copy first, then the shared store.
  const local = lsGet();
  for (const coll of COLLS) Object.assign(state[coll], local[coll] || {});
  paintAll();
  const note = document.getElementById('store');
  const timer = setTimeout(() => { note.textContent = 'The review store isn’t answering yet. Marks you make are kept in this browser until it does.'; }, 10000);
  const waitClaude = () => new Promise((res) => { let n = 0; const t = () => { if (window.claude && window.claude.use) return res(window.claude); if (++n > 100) return res(null); setTimeout(t, 100); }; t(); });
  waitClaude().then((c) => c ? c.use('db') : null).then((d) => {
    if (!d) { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Marks stay in this browser.'; return; }
    db = d;
    note.textContent = 'Your marks save to this page for the next session to read.';
    // Anything marked here before the store answered goes up now; a newer
    // copy in the store is never overwritten by it.
    const left = lsGet();
    for (const coll of COLLS) {
      db.collection(coll).onSnapshot((snap) => {
        clearTimeout(timer);
        snap.docs.forEach((doc) => {
          const val = doc.data();
          const mine = (left[coll] || {})[doc.id];
          if (mine && mine.pending) return;
          if (val) state[coll][doc.id] = val;
        });
        paintAll();
      }, () => { clearTimeout(timer); note.textContent = 'Lost the connection to the review store. Reload to try again.'; });
      for (const [id, val] of Object.entries(left[coll] || {})) {
        if (!val || !val.pending) continue;
        const body = Object.assign({}, val, { at: new Date().toISOString() });
        delete body.pending;
        db.collection(coll).doc(id).set(body).then(() => { const now = lsGet(); if (now[coll]) { delete now[coll][id]; lsSet(now); } delete left[coll][id]; }).catch(() => {});
      }
    }
  }).catch(() => { clearTimeout(timer); note.textContent = 'Saving isn’t available in this view. Marks stay in this browser.'; });
})();
</script>
`;
// Every id the page writes must be one ideas.mjs lists, and start ar1-.
for (const id of [...ids.reviews, ...ids.answers]) {
  if (!id.startsWith('ar1-')) throw new Error(`id ${id} lacks ar1-`);
  if (!html.includes(`"${id}"`) && !html.includes(`-${id}"`)) throw new Error(`id ${id} not on the page`);
}
if (/\{\{/.test(html)) throw new Error('an unfilled {{token}} is left on the page');
writeFileSync(out, html);
console.log(`Wrote ${out} (${Math.round(html.length / 1024)} KB): ${UP_IDS.length} upgrades, ${LIFT_IDS.length} lifts, ${IDEA_IDS.length} ideas, ${QIDS.length} questions + ${ELSE_ID}; lift seeds ${LIFT.seeds} a map`);
