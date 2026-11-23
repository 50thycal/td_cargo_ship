// Checks the enemy round's data (enemies.mjs): every enemy sits in the
// taxonomy, the player's 18 are all there, about twenty new ideas were
// thinned to ten, every kept idea is complete, and "different" holds up:
// no kept new idea shares its answer AND pressure with any enemy in the game
// today, any of the player's 18, or another kept idea.
// Usage: node tools/v3/enemy-ideas/check.mjs
import { ANSWERS, PRESSURES, SHAPES, CATEGORIES, TODAY, PLAYER, NEW, ARSENAL, QUESTIONS } from './enemies.mjs';

const problems = [];
const subOf = new Map(CATEGORIES.map((c) => [c.id, c.subs.map((s) => s.id)]));
const all = [...TODAY.map((e) => ({ ...e, src: 'today' })), ...PLAYER.map((e) => ({ ...e, src: 'player' })), ...NEW.map((e) => ({ ...e, src: 'new' }))];

for (const e of all) {
  if (!subOf.has(e.cat)) problems.push(`${e.name}: unknown category ${e.cat}`);
  else if (!subOf.get(e.cat).includes(e.sub)) problems.push(`${e.name}: ${e.sub} is not a subcategory of ${e.cat}`);
  if (!ANSWERS[e.answer]) problems.push(`${e.name}: unknown answer ${e.answer}`);
  if (!PRESSURES[e.pressure]) problems.push(`${e.name}: unknown pressure ${e.pressure}`);
  if (!SHAPES[e.shape]) problems.push(`${e.name}: unknown shape ${e.shape}`);
}
// Ids unique across the round.
const ids = new Set();
for (const e of all) {
  if (ids.has(e.id)) problems.push(`duplicate id ${e.id}`);
  ids.add(e.id);
}
// The player's 18, numbered 1–18, with their own words and my read.
const ns = PLAYER.map((p) => p.n).sort((a, b) => a - b);
if (ns.join() !== Array.from({ length: 18 }, (_, i) => i + 1).join()) problems.push(`player ideas numbered ${ns.join()}`);
for (const p of PLAYER) {
  if (!p.said || !/The decision:/.test(p.said)) problems.push(`${p.name}: the player's text is missing`);
  if (!['pick', 'maybe', 'merge', 'skip'].includes(p.rec) || !p.why) problems.push(`${p.name}: needs a recommendation and why`);
  if (!p.tell || !p.closest || !p.cost) problems.push(`${p.name}: needs tell, closest and cost`);
}
// New ideas: ~20 considered, 10 kept, every cut explained.
const kept = NEW.filter((i) => i.status === 'keep');
const cut = NEW.filter((i) => i.status === 'cut');
if (kept.length !== 10) problems.push(`${kept.length} new ideas kept, want 10`);
if (kept.length + cut.length < 20) problems.push(`only ${kept.length + cut.length} new ideas considered, want 20+`);
for (const c of cut) if (!c.why) problems.push(`${c.name}: cut without a reason`);
for (const i of [...kept, ...PLAYER]) for (const id of i.counters ?? []) if (!ARSENAL[id]) problems.push(`${i.name}: counter ${id} is not in the arsenal`);
for (const i of kept) {
  for (const k of ['pitch', 'how', 'decision', 'tell', 'novel', 'cost', 'costWhy']) if (!i[k]) problems.push(`${i.name}: missing ${k}`);
  if ((i.counters ?? []).length < 2) problems.push(`${i.name}: name at least two counters`);
}
// Names: no kept idea reuses a name from today or the player's list.
const taken = new Set([...TODAY, ...PLAYER].map((e) => e.name.toLowerCase()));
for (const i of kept) if (taken.has(i.name.toLowerCase())) problems.push(`${i.name}: name already used`);
// Distinctness: answer + pressure.
const pair = (e) => `${e.answer}|${e.pressure}`;
const others = [...TODAY, ...PLAYER];
for (const i of kept) {
  const clash = [...others, ...kept.filter((o) => o !== i)].filter((o) => pair(o) === pair(i));
  if (clash.length) problems.push(`${i.name} (${pair(i)}) shares answer+pressure with ${clash.map((o) => o.name).join(', ')}`);
}
// Report: the spread of answers and pressures, today vs with the new ideas.
const count = (list, k) => [...new Set(list.map((e) => e[k]))];
console.log(`Today: ${TODAY.length} enemies, ${count(TODAY, 'answer').length} answers (${count(TODAY, 'answer').join(', ')}), ${count(TODAY, 'pressure').length} pressures (${count(TODAY, 'pressure').join(', ')})`);
console.log(`Player's 18: ${count(PLAYER, 'answer').length} answers, ${count(PLAYER, 'pressure').length} pressures; recommended: ${['pick', 'merge', 'maybe', 'skip'].map((r) => `${PLAYER.filter((p) => p.rec === r).length} ${r}`).join(', ')}`);
console.log(`New: ${kept.length} kept of ${kept.length + cut.length}; answers ${count(kept, 'answer').join(', ')}; pressures ${count(kept, 'pressure').join(', ')}`);
const newA = count(kept, 'answer').filter((a) => !count(others, 'answer').includes(a));
const newP = count(kept, 'pressure').filter((p) => !count(others, 'pressure').includes(p));
console.log(`Answers only the new ideas use: ${newA.join(', ') || 'none'}; pressures only they use: ${newP.join(', ') || 'none'}`);
for (const c of CATEGORIES) {
  const line = c.subs.map((s) => `${s.name} ${all.filter((e) => e.cat === c.id && e.sub === s.id && (e.src !== 'new' || e.status === 'keep')).length}`).join(', ');
  console.log(`${c.name}: ${line}`);
  for (const s of c.subs) if (!all.some((e) => e.cat === c.id && e.sub === s.id)) problems.push(`${c.name} · ${s.name} is empty`);
}
const qids = QUESTIONS.map((q) => q.id);
if (new Set(qids).size !== qids.length || qids.some((id) => !id.startsWith('en-'))) problems.push('question ids must be unique and start en-');
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nNo problems.');
process.exitCode = problems.length ? 1 : 0;
