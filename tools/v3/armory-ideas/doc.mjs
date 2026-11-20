// Writes docs/design/v3-armory-overhaul.md from ideas.mjs (the same data
// as the review page, so the two can't drift).
// Usage: node tools/v3/armory-ideas/doc.mjs
import { writeFileSync } from 'node:fs';
import {
  DATE, PLAYER_ASK, PLAYER_LIFT, TODAY, UPGRADES, BAYS, BAYS_NOW, BAY_OPTIONS, SCRAP, SCRAP_PER_LEVEL_TOTAL, SCRAP_WIN, PACING,
  ALTERNATIVES, NEW_COUNT, NEW_UPGRADES, LIFT_NOTE, LIFT_ITEMS, LIFT_BUILDS, LIFT_WATCH, QUESTIONS, ELSE_ID, LIFT, SWEEP_SEEDS, SWEEP_NONE, sweepSaved, lift, fill, allIds,
} from './ideas.mjs';

const f = fill;
const REC = { keep: 'Keep', change: 'Change', merge: 'Merge', cut: 'Cut' };
const L = [];
const p = (...x) => L.push(...x);

p(`# V3 Armory overhaul (brainstorm, round ar1)`, '');
p(`> Made by \`node tools/v3/armory-ideas/doc.mjs\` from \`tools/v3/armory-ideas/ideas.mjs\`, ${DATE}. The review page is made from the same data by \`tools/v3/armory-ideas/page.mjs\`. Nothing here is applied to the game yet.`, '');
p(`The player asked (${DATE}):`, '', `> ${PLAYER_ASK}`, '');
p(`and picked, as a quick fix:`, '', `> ${PLAYER_LIFT}`, '');

p('## The short version', '');
p(
  '- **Keep all 11 upgrades.** None is useless once lifted. Long Loads gets a new job (its own number can’t lift it); Deep Magazine’s dead level 3 gets a round; the Armory’s Point Defense is renamed (it clashes with the weapon).',
  `- **The lift, now:** Quick Reload −40% at level 5 (${lift('reload5').saved} → ${lift('reloadA').saved} ships saved), Stockpile 3.25× drops and 2.5× time (${lift('stockpile5').saved} → ${lift('stockpileB').saved}), Long Loads refills the rack on a pickup (${lift('longload5').saved} → ${lift('longloadR').saved}). Armor Plating unchanged (${lift('plating5').saved}).`,
  `- **Unlocks: Scrap, survivor.io style.** Cards are still found at random after a run; levels are bought with Scrap earned in every run, by your choice. The three cards you equip reach level 5 in about ${PACING[0].scrapThree}–${PACING[1].scrapThree} runs instead of ${PACING[0].todayThree}–${PACING[1].todayThree} (strong/average player).`,
  '- **Bays:** keep three; Deep Magazine moves to Supply, renamed Stores (4 / 3 / 4).',
  '- **Three other ways:** A. Refit Points (a budget instead of bays), B. Commendations (a perk for a feat on each map; recommended next), C. Branching Levels (a fork at levels 3 and 5).',
  `- **New upgrades: ${NEW_COUNT.rec}** (Quartermaster, Siege Shells, Boilers), after the lift and the system choice.`,
  '',
);

p('## How the Armory works today', '');
for (const x of TODAY) p(`- ${f(x)}`);
p('');

p('## Every upgrade', '');
p(`Ships saved a run (all 13 waves) by each upgrade alone at level 5, against no Armory: the combo sweep’s Armory stage (\`tools/v3/combo-sweep/results/armory.json\`, ${SWEEP_SEEDS} seeds on each of the five chapter 1 maps), with the map’s counter kit and with the bot drafting for itself. No Armory loses ${SWEEP_NONE.counter} (counter kit) and ${SWEEP_NONE.self} (own draft) ships a run.`, '');
p('| Upgrade | Bay | Level 1 → 5 | Saved, counter kit | Saved, own draft | Call |', '| --- | --- | --- | --- | --- | --- |');
for (const u of UPGRADES) p(`| ${u.name} | ${BAYS[u.bay].name} | ${u.levels[0]} → ${u.levels[4]} | ${sweepSaved(u.id)} | ${sweepSaved(u.id, 'self')} | **${REC[u.rec]}** |`);
p('');
for (const u of UPGRADES) {
  p(`### ${u.name} (${BAYS[u.bay].name}): ${REC[u.rec]}`, '');
  p(`${f(u.does)}`, '', `- Strong: ${f(u.strong)}`, `- Weak: ${f(u.weak)}`, `- **${REC[u.rec]}.** ${f(u.recWhy)}`, '');
}

p('## Categories (the bays)', '');
for (const x of BAYS_NOW) p(`- ${f(x)}`);
p('', 'Options:', '');
for (const o of BAY_OPTIONS) p(`- **${o.name}${o.rec ? ' (recommended)' : ''}.** ${f(o.what)} ${f(o.why)}`);
p('');

p('## Unlocks and currency: Scrap', '');
p(`${f(SCRAP.pitch)}`, '', `${f(SCRAP.survivor)}`, '', '**The loop**', '');
SCRAP.loop.forEach((x, k) => p(`${k + 1}. ${f(x)}`));
p('', '| Scrap earned | |', '| --- | --- |');
for (const [k, v] of SCRAP.earn) p(`| ${k} | ${v} |`);
p('', `A cleared map pays ${SCRAP_WIN} Scrap (+250 the first time).`, '');
p('| Scrap to level a card | |', '| --- | --- |');
SCRAP.cost.slice(1).forEach((c, k) => p(`| Level ${k + 1} → ${k + 2} | ${c} |`));
p('', `${SCRAP_PER_LEVEL_TOTAL} Scrap takes one card from level 1 to 5; all 11 take ${SCRAP_PER_LEVEL_TOTAL * UPGRADES.length}.`, '');
p('**Pacing** (a model, not a playtest: 2000 simulated careers a player type with today’s card drops; a lost run ends near wave 8, 6 and 4; first clears are the first five wins):', '');
p('| Player | Wins | Runs until the 3 you equip are at L5: today → Scrap | Runs until all 55 levels: today → Scrap |', '| --- | --- | --- | --- |');
for (const r of PACING) p(`| ${r.name} | ${Math.round(r.win * 100)}% | ${r.todayThree} → ${r.scrapThree} | ${r.todayAll} → ${r.scrapAll} |`);
p('', f(SCRAP.pacing), '', '**What it replaces**', '');
for (const x of SCRAP.replaces) p(`- ${f(x)}`);
p('', `**Against round 7.** ${f(SCRAP.conflict)}`, '', `**Your save.** ${f(SCRAP.save)}`, '');

p('## Three other ways to change the Armory', '');
for (const a of ALTERNATIVES) {
  p(`### ${a.name}: ${a.tag}`, '', `${f(a.pitch)}`, '', `- How it plays: ${f(a.how)}`, `- Strong: ${f(a.strong)}`, `- Weak: ${f(a.weak)}`, `- Cost to build (${a.size}): ${f(a.cost)}`, '');
}

p('## New upgrades', '', `**Recommended: ${NEW_COUNT.rec}.** ${f(NEW_COUNT.why)}`, '');
p('| Candidate | Bay | Gap it fills | What it does | Risk | |', '| --- | --- | --- | --- | --- | --- |');
for (const n of NEW_UPGRADES) p(`| ${n.name} | ${BAYS[n.bay].name} | ${f(n.gap)} | ${f(n.pitch)} | ${f(n.risk)} | ${n.rec ? '**recommended**' : 'spare'} |`);
p('');

p('## The short-term lift (not yet applied)', '');
p(f(LIFT_NOTE), '');
p(`Measured with \`tools/v3/armory-ideas/lift.ts\` (configs in \`candidates.mjs\`; runs in \`lift-runs.jsonl\`, summed by \`summarize.mjs\` into \`lift-results.json\`). A candidate replaces the run’s Armory numbers after the run is made, so no game code changed; the rack refill is played by the harness (a pickup is counted, then the rack is filled).`, '');
p('| Config | Ships lost a run | Saved | ± |', '| --- | --- | --- | --- |');
for (const [k, c] of Object.entries(LIFT.configs)) p(`| \`${k}\` | ${c.lost} | ${c.saved} | ${c.se} |`);
p('');
for (const l of LIFT_ITEMS) {
  p(`### ${l.name}: ${lift(l.before).saved} → ${lift(l.after).saved} ships saved`, '', f(l.rule), '', '| Level | Now | Lifted |', '| --- | --- | --- |');
  l.now.forEach((n, k) => p(`| ${k + 1} | ${n} | ${l.next[k]} |`));
  p('', f(l.why), '');
}
p('**Whole builds** (ships lost a run, all 13 waves):', '', '| Build | Before | After |', '| --- | --- | --- |');
for (const b of LIFT_BUILDS) p(`| ${b.name} | ${lift(b.before).lost} | ${lift(b.after).lost} |`);
p('', f(LIFT_WATCH), '');
p('In `src/v3/data/armory.ts` the lift would be: `RELOAD = [1, 0.92, 0.84, 0.76, 0.68, 0.6]`; `POWER_SHARE = [1, 1.45, 1.9, 2.35, 2.8, 3.25]`, `POWER_TIME = [1, 1.3, 1.6, 1.9, 2.2, 2.5]`; Long Loads keeps `LOAD_TIME` and adds a rack refill on every weapon or boost pickup of `[0, 2, 3, 4, 5, rack]` rounds (a new stat, read in `collect()` and `startBoost()` in `src/v3/sim/game.ts`). The card blurbs change with them.', '');

p('## Open questions', '');
for (const q of QUESTIONS) {
  p(`- **${q.id}:** ${f(q.q)}`);
  q.options.forEach((o, k) => p(`  ${k + 1}. ${f(o)}`));
}
p(`- **${ELSE_ID}:** Anything else?`, '');

p('## The review page', '');
const ids = allIds();
p(
  'A published artifact with a database (capability `db`), made by `node tools/v3/armory-ideas/page.mjs <out.html>`. Link: https://claude.ai/artifact/KHGEfp7znMRD6oSX9xbn5N (store: `reviews/{itemId}` {verdict, note}, `answers/{questionId}` {choice, note}; ids `ar1-`).',
  '',
  '| Collection | Fields | Ids |',
  '| --- | --- | --- |',
  `| \`reviews/{itemId}\` | \`verdict\`, \`note\`, \`at\` | upgrades \`ar1-up-<id>\` (keep / change / cut); lifts \`ar1-lift-*\` (ok / change); ideas \`ar1-alt-*\`, \`ar1-new-*\` (go / maybe / drop) |`,
  `| \`answers/{questionId}\` | \`choice\` (option index), \`note\`, \`at\` | ${ids.answers.map((x) => `\`${x}\``).join(', ')} |`,
  '',
  'When the player has marked it: `ArtifactData` `list` both collections, save them as `tools/v3/armory-ideas/review-<date>.json`, and count from that file.',
  '',
);
writeFileSync(new URL('../../../docs/design/v3-armory-overhaul.md', import.meta.url), L.join('\n'));
console.log('Wrote docs/design/v3-armory-overhaul.md');
