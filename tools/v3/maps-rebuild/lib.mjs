// Shared by page.mjs and plan-doc.mjs: loads the round's data (plan.mjs),
// what the game is today (facts.mts, run through vite-node) and the measured
// results file, checks the plan's rules, and words the facts the same way
// for the page and the doc.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import * as PLANMOD from './plan.mjs';

export const root = new URL('../../../', import.meta.url).pathname;

export function loadAll() {
  const facts = JSON.parse(execSync('npx vite-node tools/v3/maps-rebuild/facts.mts', { cwd: root, maxBuffer: 64 << 20 }).toString());
  const measured = JSON.parse(readFileSync(new URL(`./${PLANMOD.ROUND.measured}`, import.meta.url)));
  const pairs = Object.fromEntries(facts.pairs.map((p) => [p.id, p]));
  PLANMOD.checkPlan(facts, pairs);
  const mapById = Object.fromEntries(facts.maps.map((m) => [m.id, m]));
  return { ...PLANMOD, facts, measured, pairs, mapById };
}

const KIND_WORD = { supersonic: 'supersonic', heavy: 'heavy', cluster: 'cluster', mothership: 'mothership', mine: 'mines', fastboat: 'fast boats' };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The original threats a wave brings today (the table at the map's scale,
 *  its extras and its attack vectors), in short words. */
export function origThreats(wv) {
  const out = [`${wv.drones} drones`];
  if (wv.ballistic) out.push(`${wv.ballistic} ballistic`);
  if (wv.guided) out.push(`${wv.guided} guided`);
  for (const x of wv.extras) out.push(`${x.n} ${KIND_WORD[x.kind] ?? x.kind}`);
  const v = [];
  if (wv.strafers) v.push(plural(wv.strafers, 'jet'));
  if (wv.bombers) v.push(plural(wv.bombers, 'bomber'));
  if (wv.subs) v.push(plural(wv.subs, 'sub'));
  if (wv.trucks) v.push(plural(wv.trucks, 'truck'));
  if (wv.boss) v.push('the Dreadnought');
  return out.join(', ') + (v.length ? `; ${v.join(', ')}` : '');
}

export const FEATURE_WORD = {
  radar: 'radar tower', battery: 'allied shore guns', vip: 'VIP supertanker', 'single-file': 'single file', locks: 'two locks',
  mines: 'drifting mines', rigs: 'oil rigs', night: 'night', dreadnought: 'the Dreadnought', 'fast-boats': 'fast boats from coves',
  fork: 'a three-way fork', 'two-way': 'two-way traffic', tide: 'the tide', citadel: 'the Citadel and its shield', islets: 'islets', bend: 'a 90° bend',
};

export const CORNER_WORD = { br: 'bottom-right', bl: 'bottom-left', tr: 'top-right', fade: 'bottom-right, fading over a lit base' };

/** Today's layout, in one line. */
export function layoutLine(m) {
  const f = m.features.map((k) => FEATURE_WORD[k] ?? k);
  const sp = [];
  if (m.special.rigs) sp.push(plural(m.special.rigs, 'rig'));
  if (m.special.coves) sp.push(plural(m.special.coves, 'cove'));
  if (m.special.chutes) sp.push(plural(m.special.chutes, 'mine chute'));
  if (m.special.generators) sp.push(plural(m.special.generators, 'shield generator'));
  return `${plural(m.lanes, 'lane')}, ${plural(m.bases, 'launch base')}${sp.length ? ` (${sp.join(', ')})` : ''}, ${plural(m.roads.runners, 'shore road')} and ${plural(m.roads.popups, 'pop-up road')}, ${plural(m.subSpots, 'sub spot')}${f.length ? `; ${f.join(', ')}` : ''}. Threat scale ${m.threatScale}.`;
}

/** Today's waves of new enemies, in one line. */
export function todayFoes(m, facts) {
  const name = (f) => facts.foes[f].name;
  const ch = m.newToday.filter((f) => facts.foes[f].chapter === m.chapter);
  const older = m.newToday.filter((f) => facts.foes[f].chapter < m.chapter);
  const counts = m.waves.map((w) => w.foes);
  return `The raid planner leads with ${name(m.debutToday)} on wave 2 and sends ${counts.slice(1, 5)[0]} new enemy a wave on waves 2–5, ${counts[5]} on 6–9 and ${counts[9]} on wave 10. Seen over three seeds: ${ch.length} of this chapter’s (${ch.map(name).join(', ')})${older.length ? ` and ${older.length} older (${older.map(name).join(', ')})` : ''}. No pairs.`;
}

export function eventLine(m, facts) {
  const e = facts.events[m.event];
  const foes = [e.foe, ...e.also].map((f) => facts.foes[f].name).join(', ');
  return `${e.name}: the map’s ending, ${facts.ending.runs} runs with the convoy restored first; built on ${foes}${e.rules.length ? `; rule: ${e.rules.join(', ')}` : ''}.`;
}

/** Notes for a map: its own, then its event's. */
export function mapNotes(id, NOTES, PLAN) {
  const p = PLAN[id];
  const ids = [...new Set([...p.notes, ...p.event.notes, ...NOTES.filter((n) => Array.isArray(n.maps) && n.maps.includes(id)).map((n) => n.id)])];
  return ids.map((n) => NOTES.find((x) => x.id === n));
}

/** The layout changes a map's proposal makes, the call-outs included. */
export function pairNames(pair, pairs) {
  return [pair].flat().filter(Boolean).map((id) => pairs[id].name);
}
