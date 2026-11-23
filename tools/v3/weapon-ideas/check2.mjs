// Checks the round 2 ideas (arsenal2.mjs): ten kept per category, nothing
// from round 1 or older cuts, every active has a strong and a weak side, and
// "different" holds up: no two kept ideas share verb + target + shape, and
// each one differs from today's tap-a-threat weapons on at least one axis.
// Usage: node tools/v3/weapon-ideas/check2.mjs
import { IDEAS, TODAY, ROUND1, CUT_BEFORE, VERBS, TARGETS } from './arsenal2.mjs';

const problems = [];
const kept = IDEAS.filter((i) => i.status === 'keep');
const cats = ['active', 'passive', 'boost'];

for (const c of cats) {
  const k = kept.filter((i) => i.cat === c);
  if (k.length !== 10) problems.push(`${c}: ${k.length} kept, want 10`);
  const cut = IDEAS.filter((i) => i.cat === c && i.status === 'cut');
  console.log(`${c}: ${k.length} kept, ${cut.length} cut (${k.length + cut.length} considered)`);
}
for (const i of IDEAS) {
  if (!VERBS.includes(i.verb)) problems.push(`${i.name}: unknown verb ${i.verb}`);
  if (!TARGETS.includes(i.target)) problems.push(`${i.name}: unknown target ${i.target}`);
  if (i.status === 'cut' && !i.why) problems.push(`${i.name}: cut without a reason`);
}
for (const i of kept) {
  if ([...ROUND1, ...CUT_BEFORE].includes(i.name)) problems.push(`${i.name}: reuses a round 1 or cut name`);
  if (!i.pitch || !i.how || !i.novel) problems.push(`${i.name}: missing pitch/how/novel`);
  if (i.cat === 'active' && (!i.strong || !i.weak)) problems.push(`${i.name}: an active needs a strong and a weak side`);
  if (i.cat === 'active' && !/normal (shot|hit)|plain tap|a tap fires|lone tap|quick tap/i.test(i.how + i.weak)) problems.push(`${i.name}: an active must say what a plain tap still does (never helpless)`);
  if (i.cat === 'passive' && !i.weak) problems.push(`${i.name}: a passive should name its blind spot`);
  if (i.cat !== 'boost' && (!i.levels || i.levels.length !== 3)) problems.push(`${i.name}: needs 3 levels`);
}
// Distinctness: verb + target + shape.
const sig = new Map();
for (const i of kept) {
  const s = `${i.cat}|${i.verb}|${i.target}|${i.shape}`;
  if (sig.has(s)) problems.push(`${i.name} and ${sig.get(s)} share ${s}`);
  sig.set(s, i.name);
}
// Distance from today's weapons: axes that differ from tap / threats / instant.
const today = TODAY.map((t) => `${t.verb}|${t.target}`);
const dist = (i) => (i.verb !== 'tap' && i.verb !== 'auto' ? 1 : 0) + (i.target !== 'threats' ? 1 : 0) + (i.shape !== 'instant' ? 1 : 0);
console.log('\nDistance from today\'s weapons (new verb + new target + non-instant shape), lowest first:');
for (const c of cats) {
  const k = kept.filter((i) => i.cat === c).sort((a, b) => dist(a) - dist(b));
  console.log(`  ${c}: ` + k.map((i) => `${i.name} ${dist(i)}`).join(', '));
  const zero = k.filter((i) => dist(i) === 0);
  for (const z of zero) problems.push(`${z.name}: same verb, target and shape as today's weapons`);
}
const verbs = new Set(kept.filter((i) => i.cat === 'active').map((i) => i.verb));
const targetsP = new Set(kept.filter((i) => i.cat === 'passive').map((i) => i.target));
const targetsB = new Set(kept.filter((i) => i.cat === 'boost').map((i) => i.target));
console.log(`\nActive verbs: ${verbs.size} (${[...verbs].join(', ')}); today: 1 (tap)`);
console.log(`Passive targets: ${targetsP.size} (${[...targetsP].join(', ')}); today: 1 (threats)`);
console.log(`Boost targets: ${targetsB.size} (${[...targetsB].join(', ')})`);
if (verbs.size < 6) problems.push(`only ${verbs.size} verbs among actives`);
if (targetsP.size < 5) problems.push(`only ${targetsP.size} targets among passives`);
const measured = kept.filter((i) => i.proto);
console.log(`\nPrototyped in real waves: ${measured.length} of ${kept.length} kept (${measured.map((i) => i.name).join(', ')})`);
const echoes = kept.filter((i) => i.echo);
console.log(`Flagged echoes: ${echoes.map((i) => `${i.name} ≈ ${i.echo}`).join('; ') || 'none'}`);
console.log(problems.length ? `\nPROBLEMS (${problems.length}):\n- ${problems.join('\n- ')}` : '\nNo problems.');
process.exit(problems.length ? 1 : 0);
