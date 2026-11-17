# V3 map and wave rules (review round 1, 2026-11-17)

The rules every map and wave plan must meet before the other 17 maps are rebuilt. Generated from `tools/v3/map-rules/rules.mjs` (do not edit by hand: `node tools/v3/map-rules/page.mjs --doc`).

- **Review page:** https://claude.ai/artifact/LeZK1fL9QFusN5qQNAoAmb. Marks are stored as `reviews/{ruleId}` (`verdict`: approve | change | cut, `note`) and `answers/{questionId}` (`choice`: option index, `note`).
- **Evidence:** `tools/v3/map-rules/evidence.json`, from your 8 map scorecards in rounds 11–12. Ships lost: 3 in waves 1–5, 29 in waves 6–10, 10 in boss rounds. Readability 5 on 8/8; pacing “right” on 8/8; wave 1 weakest on 6/8.

## What a map is

Everything a map must define beyond its shape: its problem, its sources, its mechanic, its enemy, its boss and how hard it is.

### One problem, in one sentence `m-dilemma`

Every map poses one tactical problem that comes from its shape or its mechanic, and the map card states it in one sentence (“ships are most exposed in the neck, just before delivery”). Open water with nothing to decide is not a map.

- **Why:** Your fun scores split by map, not by kit. The same kit (Overdrive, Scattergun, Supply Run) scored 5 on Harbor Mouth and 3 on the Strait. The two maps with a shape problem (two shores, a funnel) scored 5; the open Strait scored 3 on all three of its cards.
- **Check:** The map card has the sentence. You can say it back after one run.
- **Today:** Gauntlet: two shores, carrier in the middle. Harbor Mouth: the neck. The Strait: none (open water, one shore).

### Every launch site has a job `m-sources`

Each silo, road, sub spot and air line is placed for a reason and the card says what it is: the far silo gives long warning, the near one is fast, the pop-up road hits the neck. At least two attack angles, or a near/far timing contrast, on every map. No site idle the whole map; no site doing everything.

- **Why:** Difficulty that comes from where and when threats arrive reads as fair; difficulty from raw count reads as noise. The lab plan’s rule 5.
- **Check:** Map card lists each site with its warning time and its job. The map-lab heatmap shows every site firing in at least 3 waves.
- **Today:** Not written down for any map yet.

### A danger stretch and a safe stretch `m-stretches`

Every lane has a stretch where ships are most exposed and one where they are fairly safe, and the player can see which from the map itself (narrowing water, a headland, a gun’s reach).

- **Why:** This is what Harbor Mouth’s neck gives you, and it is why that map plays as a decision instead of a shooting gallery.
- **Check:** The map-lab damage heatmap shows a hot stretch and a cold one. Losses in the safe stretch stay under a quarter of the total.
- **Today:** Harbor: yes (the neck). Gauntlet: partly (the middle). Strait: no.

### At most one map mechanic, used all map long `m-mechanic`

A map has at most one mechanic of its own (a radar, a gate, a switch, mines, rigs, the tide). It shows up by wave 2–3, matters in at least three waves, and the boss rounds use it.

- **Why:** Saltgate showed a mechanic can break a map if nothing tests it at every setting; one mechanic per map keeps each one testable.
- **Check:** The 10-wave plan names the waves that use the mechanic. The flow and overlap tests cover it.
- **Today:** Chapter 1 mostly has none by design: Kesh’s hook is a shape, Marrow has its radar. Mechanics start in chapter 2.

### The map brings one new enemy, met alone first `m-enemy`

Each map debuts at most one enemy or munition. It first appears alone (or with drones only) in waves 2–4, then mixes in. Never a foe from a later chapter.

- **Why:** Your tip notes asked for new types to be introduced once and clearly; the roster rule already forbids early debuts of later foes.
- **Check:** The encounter test fails a plan that uses a later-chapter foe (it exists for round 12’s guests). The plan shows the debut wave.
- **Today:** Strait: none of its own. Gauntlet: Rocket Convoy trucks in the boss. Harbor: none in waves 1–10.

### Carrier and frigates placed for the problem `m-carrier`

The carrier sits so every stretch is in gun reach, but the danger stretch is not the closest. Frigate stations keep clear water beside the convoy (round 13) and cover the danger stretch.

- **Why:** Frigates were sitting inside the convoy on 19 maps; round 13 fixed the stations, and the Delta lost frigate value because its river has no room.
- **Check:** The frigate overlap test (all maps). Frigate kills per threat within a few points of the average.
- **Today:** Fixed in PR #155 except the Delta’s frigate value (67% vs 84% average).

### The convoy sails itself; commands only where the map needs one `m-convoy`

Ships sail on their own. Formations and flow stay as they are. A map gets a command (like Hold on Sowers’ Reach) only if its mechanic needs one. No generic commands.

- **Why:** You said the commands were “kinda useless… more of a button mash”; Rush and Disperse were cut in round 11.
- **Check:** The map card says which command, if any, and why.
- **Today:** Only Sowers’ Reach has Hold.

### Ship spacing follows the water `m-shape-convoy`

Ships spread out where the water is wide and close up where it narrows, so the convoy itself shows the map’s shape.

- **Why:** Your Harbor Mouth note: “the ships should start wider apart… and get closer together at the harbor neck”. Built for Harbor in round 11.
- **Check:** A screenshot of each map at waves 1 and 8 shows the spacing.
- **Today:** Harbor only.

### Difficulty set by chapter `m-difficulty`

Chapter 1 maps are won on the first or second try by a player who plays well, losing 2–6 ships. Chapter 2: about 2 tries; chapter 3: 2–3; chapter 4: 3–4.

- **Why:** This is the approved maps plan. Your reference-map runs land in that band: won runs lost 2–9 ships.
- **Check:** Your scorecard says “difficulty right”. Bots: “you” bot win rate in the chapter’s band.
- **Today:** All three reference maps scored “right” in round 12 (Strait v2 “bit easy”).

### No kit makes a map trivial `m-kits`

A map must hold up against three kits: aimed (Railgun, Overdrive), self-firing (Drone Screen, Seeker, Airstrike) and area (Flak, Thermobaric, Scattergun). None of them should win it without losing a ship.

- **Why:** Overdrive + Scattergun + Supply Run won both runs it was used in with no boss losses; you called it “really op”.
- **Check:** Bots run all three kit tastes (the round 12 --kits option). The combo itself is a weapons question (see questions).
- **Today:** Not checked per map yet.

### Everything readable on a phone `m-reads`

Every launch site, gate, structure and road is visible at 844×390 and not under the HUD or the side rails. Anything that can sink a ship is warned at least 2.5 s before it fires.

- **Why:** Readability scored 5 on all 8 scorecards: keep it that way. The Test Lab banner was covering launchers until round 13.
- **Check:** A phone screenshot of each map with every site marked. The raid warning is 2.5 s today.
- **Today:** Holds on the reference maps.

## How waves are built

The ten-wave arc, how early it bites, what each wave holds and how the boss rounds end it.

### The ten-wave arc `w-arc`

Waves 1–2 teach the map. Waves 3–4 first stakes. Waves 5–6 combine two things. Waves 7–9 escalate. Wave 10 is the climax. Then three boss rounds.

- **Why:** The lab plan’s template. Your pacing score was “right” on all 8 scorecards, so the length and rhythm stay.
- **Check:** The 10-wave plan labels each wave with its role.
- **Today:** The arc exists, but the first half is too safe (next rule).

### A ship is at risk by wave 3 `w-early`

From wave 3, every wave has at least one moment that sinks a ship if the player ignores it. A good player still loses about 0–1 ships in waves 1–5; the point is that it could happen.

- **Why:** Across your 8 map scorecards you lost 3 ships in waves 1–5, 29 in waves 6–10 and 10 in boss rounds. 6 of 8 runs lost nothing before wave 6.
- **Check:** New bot metric: “close calls” per wave (a threat within 2 s of a hull before it is shot down). At least one from wave 3. Your scorecard’s weakest wave is not 1–3.
- **Today:** All three maps: no stakes before wave 5–6.

### Wave 1 shows the map `w-first`

Wave 1’s first launch comes from the map’s signature place (its near silo, its second shore, its neck) and shows its problem in miniature. Still easy: no ship lost by a player who shoots.

- **Why:** Wave 1 was your weakest wave on 6 of 8 scorecards. After round 12’s openers it moved off wave 1 on Harbor (to 10) and the Gauntlet (to 2), but not on the Strait.
- **Check:** Your weakest wave is not wave 1. Bots: 0 ships lost on wave 1.
- **Today:** Openers on all three since round 12; works on 2 of 3.

### Each wave has one named encounter `w-encounter`

Every wave has one encounter the player remembers: a decision, not just more enemies. The rest of the wave is background pressure. From wave 7, up to two encounters may overlap.

- **Why:** This is the round 12 v1 design that you kept. Set pieces (v2: four big moments, quiet waves between) felt “bit easy” and you cut it.
- **Check:** The 10-wave plan names an encounter per wave and the decision it asks for. The pause screen shows the script.
- **Today:** v1 encounters exist on the three reference maps.

### No repeats back to back `w-variety`

No two waves in a row use the same encounter. Each enemy type the map features shows up in at least two waves.

- **Why:** Variety scored 3–4 across the scorecards; it is the lowest score after fun.
- **Check:** Plan check (automatic). Your variety score ≥ 4.
- **Today:** Variety 4 on all three v1 cards in round 12.

### No cliffs: a wave may hurt but not end the run `w-cliff`

No wave more than doubles the previous wave’s losses, and no single wave ends the run for every kit.

- **Why:** Harbor Mouth’s wave 8 ended a run in round 11; the Gauntlet’s wave 8 jump is in its shared waves.
- **Check:** Bots: the largest one-wave step in losses per kit (round 12’s cliff measure).
- **Today:** Harbor fixed in round 12; the Gauntlet’s wave 8 still jumps for bots.

### A breath before the climax `w-calm`

A short calm (5–8 s) before wave 10’s climax and before the first boss round, so the big moment reads as big.

- **Why:** Contrast makes the peaks feel like peaks; the lab plan asks for deliberate calm.
- **Check:** Plan check: the gap before wave 10’s main raid and before boss round 1.
- **Today:** Boss rounds already start after the convoy is restored.

### The shared wave table stays the backbone `w-budget`

Every map uses the same ten-wave table. A map shifts it by at most ±15% (its threat scale and encounters). Encounters replace part of the wave’s budget; they never add on top.

- **Why:** Round 12 showed added launches got swallowed (a sub fills its salvo whatever it is given), and budgets kept the versions fair.
- **Check:** Bots: each wave’s launches within ±15% of the table × the map’s scale.
- **Today:** True for all maps today.

### Boss rounds cost about a ship a round `w-boss`

The three boss rounds use the map’s own enemy and shape, get harder each round, last 15–30 s each, and cost a good player about one ship a round.

- **Why:** The Gauntlet’s Rocket Convoy cost you 6 and then 4 ships: scored 5 both times. The Strait’s Rush and Harbor’s Breakout cost 0 in all six rounds you played, even after round 12 made them harder (they scored 3–4).
- **Check:** Your scorecard: boss score ≥ 4 and at least one ship lost across the three rounds. Bots alone are not enough (next rule).
- **Today:** Gauntlet yes. Strait and Harbor no.

### Bots set the floor; your scorecard sets the target `w-bots`

Bots check the things they measure well (no stalls, no cliffs, no overlaps, budgets, kits). Difficulty targets for boss rounds and early stakes are set by your scorecards until the bots are refit to your play.

- **Why:** Round 12’s “you” bot was predicted to lose 12–18 ships across the boss rounds on these maps; you lost 0 on the Strait and Harbor and 4 on the Gauntlet.
- **Check:** Refit the bots from your newest logs (task 56) before trusting them on difficulty.
- **Today:** Bots over-predict boss losses badly.

## Waves use the map

How each wave uses the map’s shape: where the fire comes from, when it lands, and what it is aimed at.

### Every encounter names where and at what `g-named`

Each encounter says which sites fire and which stretch they aim at (“the near silo, at the ships in the neck”). An encounter that could happen on any map is not finished.

- **Why:** The v1 encounters you kept are the ones tied to the map; the generic ones blend together.
- **Check:** The encounter data names sites and a target stretch; the test fails one without them.
- **Today:** Round 12 encounters name sites; target stretches are not formal yet.

### Time the big raid to the danger stretch `g-timing`

Each wave’s biggest raid lands while ships are crossing the map’s danger stretch.

- **Why:** Harbor Mouth’s funnel works because its worst comes last; the lab plan’s “exposure timing”.
- **Check:** Map-lab: the share of a wave’s damage that lands in the danger stretch.
- **Today:** Harbor partly; others not timed to the convoy.

### Make the player choose a direction `g-split`

From wave 5, at least one encounter per wave pulls the player two ways: two shores, front and rear of the convoy, the carrier and a ship.

- **Why:** The Gauntlet’s two shores make you choose; it went from fun 3 to 5 once its boss had teeth.
- **Check:** Map-lab: threats from two sides alive at once in each wave from 5.
- **Today:** Gauntlet yes; Strait and Harbor rarely.

### Warning time is the difficulty knob `g-warning`

Early waves fire from far sites (long warning). Later waves use near sites, pop-up roads and subs (short warning). Waves get harder through where fire comes from before they get harder through count.

- **Why:** The lab plan’s rule: difficulty from launch geometry and timing, not just numbers.
- **Check:** Map-lab: the average warning time per wave falls from wave 1 to wave 10.
- **Today:** Not measured yet.

### The mechanic is in the waves `g-mechanic`

The map’s mechanic (radar, gate, switch, mines, rigs) is the target or the stake in at least three waves and in the boss rounds, not just scenery.

- **Why:** Same as the one-mechanic rule: a mechanic only matters if the waves make you care about it.
- **Check:** The plan marks those waves.
- **Today:** Applies from chapter 2 (and Marrow).

### Keep the safe stretch mostly safe `g-safe`

Most fire goes at the danger stretch. Only the climax and the boss rounds may hit the safe stretch hard, so the map stays readable.

- **Why:** If every stretch is hit equally, the danger stretch stops meaning anything.
- **Check:** Map-lab: losses in the safe stretch under a quarter, outside wave 10 and the boss.
- **Today:** Not measured yet.

## How a map passes

The checks a rebuilt map must pass before it ships: the map card, the bot checks and your scorecard.

### A one-page map card before building `q-card`

Every map gets a card before it is rebuilt: the problem in one sentence, the mechanic, each site and its job, the danger and safe stretches, the debut enemy, the ten waves (role, encounter, sites, target stretch), the boss plan, and the risks on a phone.

- **Why:** The lab plan’s rollout step; it is what lets you review 17 maps without playing each one first.
- **Check:** You see the cards on a review page before the build.
- **Today:** None written yet.

### Automatic checks every map must pass `q-bots`

Convoy never stalls at any flow (built). Frigates never overlap ships (built). No wave cliffs. Close calls from wave 3. Wave budgets within ±15%. All three kits survive. No later-chapter foes.

- **Why:** Saltgate’s jam and the frigate overlaps were both found by you, not by a test; these make sure the next ones are found first.
- **Check:** Run in CI for every map.
- **Today:** Flow and overlap tests exist; the rest are new.

### Your scorecard decides `q-player`

One scorecard per map. It passes with fun ≥ 4, difficulty “right”, boss ≥ 4 with at least one ship lost, and the weakest wave not 1–3. Fun 3 or less sends the map back.

- **Why:** Your scorecards are the only measure that has tracked fun so far: Gauntlet 3 → 5 and Harbor 4 → 5 after their fixes.
- **Check:** The Test Lab page shows each map’s latest scorecard against these marks.
- **Today:** Gauntlet and Harbor pass; the Strait does not (fun 3, weakest wave 1).

### Roll out a chapter at a time `q-batches`

Fix the three reference maps to the rules first. Then rebuild the rest of the maps one chapter at a time, 4–5 maps per batch, each batch played and scored before the next starts.

- **Why:** Each chapter adds its own mechanics; a batch is small enough to play in a few sittings (with save and continue).
- **Check:** A batch ships when all its maps pass.
- **Today:** —

## Open questions

**The Strait has no problem of its own (open water, one shore) and scores 3 every time. What should it be?** `mr-strait`

1. Give it a simple shape problem that still teaches: e.g. a sandbar that pinches the lane, or a friendly headland that shelters half the run (recommended)
2. Keep it plain as the tutorial map, but make it shorter and faster so it doesn’t drag
3. Keep it as it is: map 1 is allowed to be a 3

**How much should waves 1–5 bite?** `mr-early`

1. One real close call per wave from wave 3, but a good player still loses 0–1 ships by wave 5 (recommended)
2. Real losses from wave 3: about 1–2 ships lost by wave 5
3. Leave the first half calm; the action is in waves 6–13

**Which encounter style do the other 17 maps use?** `mr-style`

1. The original (v1): one map-tied encounter per wave; drop set pieces (v2) and don’t test enemy pairs (v3) further (recommended)
2. v1, but test v3 (enemy pairs) on one reference map before deciding
3. v1 plus one big set piece at wave 10 on every map

**How much should the three boss rounds cost a good player?** `mr-boss`

1. About one ship a round, three across the boss rounds (recommended)
2. About two a round: the boss should be the hardest part by far
3. Zero or one in total: the boss is about spectacle, not losses

**Overdrive + Scattergun + Supply Run won two maps with no boss losses (“really op”). When do we deal with it?** `mr-kit`

1. Before tuning maps: otherwise every map looks easy with it (recommended)
2. After the rollout: tune maps first, weapons later
3. Leave it: a strong combo is a reward

**How should each rebuilt map be tested?** `mr-test`

1. One scorecard per map, in batches of 4–5, with the automatic checks first (recommended)
2. Two runs per map with different kits
3. Bots only, and you spot-check a few maps

**In what order do we rebuild?** `mr-order`

1. Fix the three reference maps to the rules, then chapter 1’s other two (Kesh, Marrow), then chapter by chapter (recommended)
2. Go straight to the next chapter and come back to the reference maps later
3. All 17 at once

**Convoy commands on the other maps?** `mr-commands`

1. Only where the map’s mechanic needs one, like Hold on Sowers’ Reach (recommended)
2. None anywhere: the convoy always sails itself
3. Bring back one simple command on every map
