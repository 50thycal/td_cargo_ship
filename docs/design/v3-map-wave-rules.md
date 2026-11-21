# V3 map and wave rules (final, round 1 decided 2026-11-17)

The rules every map and wave plan follows in the map rebuild. Generated from `tools/v3/map-rules/` (`rules.mjs` + `plan.mjs`; do not edit by hand: `node tools/v3/map-rules/page.mjs --doc`).

- **Hub page (the player's main channel):** https://claude.ai/artifact/LeZK1fL9QFusN5qQNAoAmb. Collections: `reviews/{id}` (verdict, note) and `answers/{id}` (choice, note). Round 1 marks are saved in `tools/v3/map-rules/review-2026-11-17.json`.
- **Keeping it current:** any session that changes the plan or finishes a step updates `STATUS` (and `NEEDS` for a new decision) in `plan.mjs`, regenerates the page and republishes it to the same URL. Only new items go in `NEEDS`; answered ones are never asked again.

## Settled in round 1

- The Strait stays as it is: map 1 may be a 3. (Its waves still follow the wave rules.)
- Early waves: one real close call per wave from wave 3; a good player loses 0–1 ships by wave 5.
- Encounter style: the original (v1) on every map; set pieces (v2) and enemy pairs (v3) are dropped.
- Boss rounds: about one ship a round for a good player.
- Overpowered combos wait until after the rollout; you’ll note the ones that feel too strong as you play.
- Testing: one playtest per map, in batches, after the automatic checks and bots.
- Order: the three reference maps first, then Kesh and Marrow, then chapter by chapter.
- Convoy commands only where a map’s mechanic needs one (like Hold on Sowers’ Reach).
- Your note: lots of bot testing and heat maps first, with sessions reading the results and recommending the best wave designs; you play once that is done, to save your time.

## What a map is

### One problem, in one sentence `m-dilemma`

Every map poses one tactical problem that comes from its shape or its mechanic, and the map card states it in one sentence (“ships are most exposed in the neck, just before delivery”). Open water with nothing to decide is not a map.

- **Check:** The map card has the sentence. You can say it back after one run.
- **Why:** Your fun scores split by map, not by kit. The same kit (Overdrive, Scattergun, Supply Run) scored 5 on Harbor Mouth and 3 on the Strait. The two maps with a shape problem (two shores, a funnel) scored 5; the open Strait scored 3 on all three of its cards.

### Every launch site has a job `m-sources`

Each silo, road, sub spot and air line is placed for a reason and the card says what it is: the far silo gives long warning, the near one is fast, the pop-up road hits the neck. At least two attack angles, or a near/far timing contrast, on every map. No site idle the whole map; no site doing everything.

- **Check:** Map card lists each site with its warning time and its job. The map-lab heatmap shows every site firing in at least 3 waves.
- **Why:** Difficulty that comes from where and when threats arrive reads as fair; difficulty from raw count reads as noise. The lab plan’s rule 5.

### A danger stretch and a safe stretch `m-stretches`

Every lane has a stretch where ships are most exposed and one where they are fairly safe, and the player can see which from the map itself (narrowing water, a headland, a gun’s reach).

- **Check:** The map-lab damage heatmap shows a hot stretch and a cold one. Losses in the safe stretch stay under a quarter of the total.
- **Why:** This is what Harbor Mouth’s neck gives you, and it is why that map plays as a decision instead of a shooting gallery.

### At most one map mechanic, used all map long `m-mechanic`

A map has at most one mechanic of its own (a radar, a gate, a switch, mines, rigs, the tide). It shows up by wave 2–3, matters in at least three waves, and the boss rounds use it.

- **Check:** The 10-wave plan names the waves that use the mechanic. The flow and overlap tests cover it.
- **Why:** Saltgate showed a mechanic can break a map if nothing tests it at every setting; one mechanic per map keeps each one testable.

### Every new enemy gets its own debut `m-enemy` (changed from the player's note)

Not every map needs a new enemy of its own: there may not be enough enemy types for 20 maps. But every enemy, the first time it appears in the campaign, gets a debut: alone (or with drones only) for a wave before it mixes in. Never a foe from a later chapter.

- **Check:** The campaign plan lists each enemy’s debut map and wave. The encounter test still fails a later-chapter foe.
- **Why:** Your tip notes asked for new types to be introduced once and clearly; the roster rule already forbids early debuts of later foes.
- **The player's note:** “It sure if we have enough enemy types for each map. So doesn’t have to be a hard rule but each new enemy should have its own”debut””

### New weapons and enemies say which chapter brought them `m-debut-tag`

A weapon card the chapter adds to the draft carries the chapter’s tag (“NEW · Dark Water”), and a chapter’s new enemies are announced the same way. Every rebuilt map keeps it.

- **Check:** The draft e2e sees the tag on a chapter’s new weapon; the rebuild checks don’t remove it.
- **Why:** Your note on Battery (campaign, 2026-11-19): you like the “Dark Water” note on the weapons that appear in that chapter and want it kept when the maps are rebuilt.

### Carrier and frigates placed for the problem `m-carrier`

The carrier sits so every stretch is in gun reach, but the danger stretch is not the closest. Frigate stations keep clear water beside the convoy (round 13) and cover the danger stretch.

- **Check:** The frigate overlap test (all maps). Frigate kills per threat within a few points of the average.
- **Why:** Frigates were sitting inside the convoy on 19 maps; round 13 fixed the stations, and the Delta lost frigate value because its river has no room.

### The convoy sails itself; commands only where the map needs one `m-convoy`

Ships sail on their own. Formations and flow stay as they are. A map gets a command (like Hold on Sowers’ Reach) only if its mechanic needs one. No generic commands.

- **Check:** The map card says which command, if any, and why.
- **Why:** You said the commands were “kinda useless… more of a button mash”; Rush and Disperse were cut in round 11.

### The convoy is a design lever, set per map `m-shape-convoy` (changed from the player's note)

How ships come (a single line, a wide spread, a large volume, spacing that follows the water) is set per map to change how it plays. It is a lever for map design, not a fixed rule.

- **Check:** The map card says how the convoy comes and why.
- **Why:** Your Harbor Mouth note: “the ships should start wider apart… and get closer together at the harbor neck”. Built for Harbor in round 11.
- **The player's note:** “I would say that’s a very based on the map just depends on the layout of the map so we can play around this mechanic. It doesn’t need to be a hard rule even make it so like there’s like a single line or a large volume of the ships coming in to change how the map plays so basically this is a lever that we can play with when it comes to map design since formations and rate to now set”

### Difficulty set by chapter `m-difficulty`

Chapter 1 maps are won on the first or second try by a player who plays well, losing 2–6 ships. Chapter 2: about 2 tries; chapter 3: 2–3; chapter 4: 3–4.

- **Check:** Your scorecard says “difficulty right”. Bots: “you” bot win rate in the chapter’s band.
- **Why:** This is the approved maps plan. Your reference-map runs land in that band: won runs lost 2–9 ships.

### Each map’s problem has counters among your weapons `m-kits` (changed from the player's note)

A map’s threats favour certain weapons: very large swarms reward area weapons, many heavy hitters reward high damage, fast sprinters reward aimed shots. The map card names the counter weapons it is built around. Picking a counter should feel like solving the map; no single kit should win it without losing a ship.

- **Check:** Bots run the map with its counter kit and with an off-counter kit: the counter kit does clearly better, and neither is trivial.
- **Why:** Overdrive + Scattergun + Supply Run won both runs it was used in with no boss losses; you called it “really op”.
- **The player's note:** “I would say ideally with the kits and the enemy weapons and the player weapons each Bab might have a particular combo the player weapons that counter the enemy weapons. Well, I’m kind of goes back to each map should have a problem that used to be solved and that can be solved by the specific player weapons. You’re choosing to pick to counter the enemy weapons here so thinking kind of like you know if the map has like very large swarms than an area.  you know if the map has like very large swarms than a area attack by the player would work well there or if it has a lot of heavy hitters and then you need something that obviously does a lot of damage.”

### Everything readable on a phone `m-reads`

Every launch site, gate, structure and road is visible at 844×390 and not under the HUD or the side rails. Anything that can sink a ship is warned at least 2.5 s before it fires.

- **Check:** A phone screenshot of each map with every site marked. The raid warning is 2.5 s today.
- **Why:** Readability scored 5 on all 8 scorecards: keep it that way. The Test Lab banner was covering launchers until round 13.

## How waves are built

### The ten-wave arc `w-arc`

Waves 1–2 teach the map. Waves 3–4 first stakes. Waves 5–6 combine two things. Waves 7–9 escalate. Wave 10 is the climax. Then three boss rounds.

- **Check:** The 10-wave plan labels each wave with its role.
- **Why:** The lab plan’s template. Your pacing score was “right” on all 8 scorecards, so the length and rhythm stay.
- **The player's note:** “Keep In mind that this might get “boring” for players. But let’s move forward with this decision and we can modify down the road if needed”

### A ship is at risk by wave 3 `w-early`

From wave 3, every wave has at least one moment that sinks a ship if the player ignores it. A good player still loses about 0–1 ships in waves 1–5; the point is that it could happen.

- **Check:** New bot metric: “close calls” per wave (a threat within 2 s of a hull before it is shot down). At least one from wave 3. Your scorecard’s weakest wave is not 1–3.
- **Why:** Across your 8 map scorecards you lost 3 ships in waves 1–5, 29 in waves 6–10 and 10 in boss rounds. 6 of 8 runs lost nothing before wave 6.

### Wave 1 shows the map `w-first`

Wave 1’s first launch comes from the map’s signature place (its near silo, its second shore, its neck) and shows its problem in miniature. Still easy: no ship lost by a player who shoots.

- **Check:** Your weakest wave is not wave 1. Bots: 0 ships lost on wave 1.
- **Why:** Wave 1 was your weakest wave on 6 of 8 scorecards. After round 12’s openers it moved off wave 1 on Harbor (to 10) and the Gauntlet (to 2), but not on the Strait.

### Each wave has one named encounter `w-encounter`

Every wave has one encounter the player remembers: a decision, not just more enemies. The rest of the wave is background pressure. From wave 7, up to two encounters may overlap.

- **Check:** The 10-wave plan names an encounter per wave and the decision it asks for. The pause screen shows the script.
- **Why:** This is the round 12 v1 design that you kept. Set pieces (v2: four big moments, quiet waves between) felt “bit easy” and you cut it.

### No repeats back to back `w-variety`

No two waves in a row use the same encounter. Each enemy type the map features shows up in at least two waves.

- **Check:** Plan check (automatic). Your variety score ≥ 4.
- **Why:** Variety scored 3–4 across the scorecards; it is the lowest score after fun.

### No cliffs: a wave may hurt but not end the run `w-cliff`

No wave more than doubles the previous wave’s losses, and no single wave ends the run for every kit.

- **Check:** Bots: the largest one-wave step in losses per kit (round 12’s cliff measure).
- **Why:** Harbor Mouth’s wave 8 ended a run in round 11; the Gauntlet’s wave 8 jump is in its shared waves.

### A breath before the climax `w-calm`

A short calm (5–8 s) before wave 10’s climax and before the first boss round, so the big moment reads as big.

- **Check:** Plan check: the gap before wave 10’s main raid and before boss round 1.
- **Why:** Contrast makes the peaks feel like peaks; the lab plan asks for deliberate calm.

### The shared wave table stays the backbone `w-budget`

Every map uses the same ten-wave table. A map shifts it by at most ±15% (its threat scale and encounters). Encounters replace part of the wave’s budget; they never add on top.

- **Check:** Bots: each wave’s launches within ±15% of the table × the map’s scale.
- **Why:** Round 12 showed added launches got swallowed (a sub fills its salvo whatever it is given), and budgets kept the versions fair.

### Boss rounds cost about a ship a round `w-boss`

The three boss rounds use the map’s own enemy and shape, get harder each round, last 15–30 s each, and cost a good player about one ship a round.

- **Check:** Your scorecard: boss score ≥ 4 and at least one ship lost across the three rounds. Bots alone are not enough (next rule).
- **Why:** The Gauntlet’s Rocket Convoy cost you 6 and then 4 ships: scored 5 both times. The Strait’s Rush and Harbor’s Breakout cost 0 in all six rounds you played, even after round 12 made them harder (they scored 3–4).

### Bots set the floor; your scorecard sets the target `w-bots`

Bots check the things they measure well (no stalls, no cliffs, no overlaps, budgets, kits). Difficulty targets for boss rounds and early stakes are set by your scorecards until the bots are refit to your play.

- **Check:** Refit the bots from your newest logs (task 56) before trusting them on difficulty.
- **Why:** Round 12’s “you” bot was predicted to lose 12–18 ships across the boss rounds on these maps; you lost 0 on the Strait and Harbor and 4 on the Gauntlet.

## Waves use the map

### Every encounter has internal notes on where and at what `g-named` (changed from the player's note)

Each encounter carries internal design notes (not shown to the player): which sites fire, which stretch they aim at, and how it uses the map. What the player sees stays short and plain (“Drone swarm”).

- **Check:** The encounter data has the notes; the test fails an encounter without them. The player-facing call-out names the threat, not the site.
- **Why:** The v1 encounters you kept are the ones tied to the map; the generic ones blend together.
- **The player's note:** “So I think this just needs to be an internal notes those notes saying “near silo target middle lane” will be confusing to player. Something like “drone swarm” is better. So include internal notes what this encounter does and what it targets and how it uses the map”

### Time the big raid to the danger stretch `g-timing`

Each wave’s biggest raid lands while ships are crossing the map’s danger stretch.

- **Check:** Map-lab: the share of a wave’s damage that lands in the danger stretch.
- **Why:** Harbor Mouth’s funnel works because its worst comes last; the lab plan’s “exposure timing”.

### Make the player choose a direction `g-split`

From wave 5, at least one encounter per wave pulls the player two ways: two shores, front and rear of the convoy, the carrier and a ship.

- **Check:** Map-lab: threats from two sides alive at once in each wave from 5.
- **Why:** The Gauntlet’s two shores make you choose; it went from fun 3 to 5 once its boss had teeth.

### Warning time is the difficulty knob `g-warning`

Early waves fire from far sites (long warning). Later waves use near sites, pop-up roads and subs (short warning). Waves get harder through where fire comes from before they get harder through count.

- **Check:** Map-lab: the average warning time per wave falls from wave 1 to wave 10.
- **Why:** The lab plan’s rule: difficulty from launch geometry and timing, not just numbers.

### The mechanic is in the waves `g-mechanic`

The map’s mechanic (radar, gate, switch, mines, rigs) is the target or the stake in at least three waves and in the boss rounds, not just scenery.

- **Check:** The plan marks those waves.
- **Why:** Same as the one-mechanic rule: a mechanic only matters if the waves make you care about it.

### Keep the safe stretch mostly safe `g-safe`

Most fire goes at the danger stretch. Only the climax and the boss rounds may hit the safe stretch hard, so the map stays readable.

- **Check:** Map-lab: losses in the safe stretch under a quarter, outside wave 10 and the boss.
- **Why:** If every stretch is hit equally, the danger stretch stops meaning anything.

## How a map passes

### A one-page map card before building `q-card`

Every map gets a card before it is rebuilt: the problem in one sentence, the mechanic, each site and its job, the danger and safe stretches, the debut enemy, the ten waves (role, encounter, sites, target stretch), the boss plan, and the risks on a phone.

- **Check:** You see the cards on a review page before the build.
- **Why:** The lab plan’s rollout step; it is what lets you review 17 maps without playing each one first.
- **The player's note:** “Run preliminary bot test if needed to get an idea of the flow of the map”

### Automatic checks every map must pass `q-bots`

Convoy never stalls at any flow (built). Frigates never overlap ships (built). No wave cliffs. Close calls from wave 3. Wave budgets within ±15%. All three kits survive. No later-chapter foes.

- **Check:** Run in CI for every map.
- **Why:** Saltgate’s jam and the frigate overlaps were both found by you, not by a test; these make sure the next ones are found first.

### Bots and heat maps decide; your playtest is the vibe check `q-player` (changed from the player's note)

Rebuilt maps are tuned with bot testing and the map-lab heat maps first; sessions read those results and recommend the wave designs. You play once that testing is done. Your scorecard is a vibe check, not a pass/fail threshold, and the scorecard itself gets an overhaul so it is easier to rate well.

- **Check:** Each map ships with a bot report (heat map, losses by wave, kits) and then your playtest. A poor vibe check sends it back for another bot loop.
- **Why:** Your scorecards are the only measure that has tracked fun so far: Gauntlet 3 → 5 and Harbor 4 → 5 after their fixes.
- **The player's note:** “We shouldn’t give soooo much weight to the score cards. These are kinda filled out on a whim and not all that detailed. Treat the score cards as a vibe check vs law. Maybe we can overhaul the score card system too. Like showing our previous rankings or other map rankings so I can make more informed decisions and anything else you think that will give me a better way to actually rate these waves”

### Roll out a chapter at a time, bots first `q-batches` (changed from the player's note)

Fix the three reference maps to the rules first. Then rebuild the other maps one chapter at a time. In each batch, the bots and heat maps do the testing and tuning; you play the batch once the bots are happy.

- **Check:** A batch is ready for you when every map passes the automatic checks and has a bot report.
- **Why:** Each chapter adds its own mechanics; a batch is small enough to play in a few sittings (with save and continue).

## Status

Building from your answers: the Lifeboats and Quartermaster rework, Saltgate’s missile-truck parade, and the Battery (chapter 3). Then busier early waves. Nothing needs you right now.

- **Done: Map and wave rules.** 31 rules: 26 approved; 6 rewritten from your notes and answers (marked in “The plan”). Round 1 questions all answered.
- **Done: Bots that play like you.** Refit from your 18 runs, each replayed by the bot with your own setup and Armory upgrades. Boss rounds: 1.37 ships a round before, 1.03 now (you: 0.52). Waves 1–5: 1.19 before, 0.69 now (you: 0.50). The fix: you grab pickups faster as the stakes rise (0.4–0.8 s in boss rounds); the bot only looked between bursts. It also plays at 1× with your Armory now. Still off: the Strait’s and Harbor’s boss rounds read harder to the bot than to you (about 1.3 a round where you lose 0), so their targets are set on the bot’s scale.
- **Done: The new scorecard.** Live in the Test Lab (#161). Before you rate, it shows your last scores for this map and the others; your run’s waves in a strip with the moments the game marked, to pick best and weakest; one “compared with the map you rated last” question; and only Fun, Difficulty, Play again and a note.
- **Done: Automatic checks and bot reports.** Built (#162). Each map now gets a bot report: losses per wave, cliffs, close calls, wave budgets, the danger and safe stretches, warning time, kits and a heat map. Encounters carry internal notes. Tests catch later-chapter foes and repeated encounters. First readings on the three reference maps: every map has a cliff (the Gauntlet’s wave 8 jumps from 0.75 to 3 ships for the bot); Harbor’s waves 4–7 send a third fewer attacks than they should; the Strait and the Gauntlet have no clearly safe stretch; every encounter repeats 3–4 waves in a row.
- **Done: The three reference maps to the rules.** Rebuilt (#163), played by you (all Keep, fun 4–5) and fixed from your runs (#165): Harbor’s boss round 3 sends one sub salvo, not two; a supersonic missile sits untouchable on the launcher for 0.4 s (was 1.1 s), then lifts off slowly and can be shot, landing when it did; the lock-on warning still runs the full 1.1 s.
- **Done: Measuring the fun moments.** Built (#167). Saves: at each kill, nuke and pickup the game is copied and played on without it (and 0.5 s late); if a ship would have sunk, it was a save, with its stakes (the run, the last ship) and how close. Tension: a danger reading every 0.1 s from how close threats are to hitting, giving each wave a curve (flat, one peak, sawtooth, rising, pinned). On your three runs the tensest wave was the wave you scored best, all three times. Your Strait wave 10 shows as two clutch saves with the run at stake: the ammo drop, then the last-second drone kill. The scorecard now asks you to tap your best moment on the wave strip.
- **Now: Chapter 1: Kesh and Marrow.** Rebuilt (#169), played twice by you, changed after each (#174 v29, #178 v30). Your v29 replays were flat for 6–9 waves, then a cliff. v30 moves a little fire from waves 9–10 into waves 2–7 (within 15% a wave). Bot on your setup, ships lost in waves 6–10: Kesh .04, 1.00, .50, .43, .74 → .21, .21, .08, .25, .88; Marrow .08, .50, .61, .83, 1.43 → .25, .25, .42, .67, .78. Kesh’s wave 3 tension 0.41 → 0.94. Boss intro: BOSS ROUND → Convoy restored (6 ships can still be lost) → the boss’s name → Round 1 of 3, with a card for rounds 2 and 3. The verdict sheet starts blank; earlier verdicts show as history. Still flagged by the checks (moved, not worse): a cliff on Marrow’s wave 7 in tough runs, and a stretch with no safe breather on both maps.
- **Done: Your rating screen in the Test Lab.** Merged (#173). The Test Lab end screen is the normal game’s “Rate & review this run”: Fun, Difficulty, the new Intensity, Boss rounds, Compared with the last map, Play again; then the run’s timeline with Watch it and notes, where you pick the best and weakest wave; then the Test Lab verdict. Best moment is gone. At each weapon pick an optional “Rate wave N” row (difficulty, fun, intensity 1–5 and a note) saves as you tap; your fun ratings then suggest the best and weakest wave. The three boss rounds play back to back, so only waves 1–10 get the row.
- **Done: Bot test of every weapon combination.** Done (#176): about 11,000 bot runs, re-run in full on play log v29 (docs/design/v3-combo-sweep.md). No kit makes a map trivial: the one lead (Shrapnel + Scattergun + Flak on Marrow, perfect on 4 seeds) lost 5.6 ships a run on 16. The first good weapon does most of the work (plain gun 18.6 ships lost over 13 waves, one good weapon 8.4–9.4, the best three 7.6). Best sets: Air Strike + Point Defense + Supply Run, Air Strike + Flak + Point Defense, Point Defense + Railgun + Supply Run. Supply Run is the best partner. Your Overdrive + Scattergun + Supply Run kit is still weak for the bot (11.7 lost, 28% won) though you won twice with it: the bot plays boosts and pickups badly, so it gets checked on one of your logs before any change. Armory: Armor Plating (13 ships saved) and Damage Control (9) matter most, Stockpile and Quick Reload least; the Armory matters about twice as much as the loadout. On v29 Marrow is now the easiest map for the bot (83% won drafting for itself) and Kesh the hardest (8%): your replay decides whether either moves. Seven proposals are in the doc; nothing is retuned without you.
- **Now: Chapter 2: The Narrows.** All five rebuilt: The Island, The Behemoth Run, The Needle of Bosk (#193), The Archipelago (#197), Saltgate Canal (#199). Waiting on your play. The Island and The Behemoth Run are rebuilt (#180, play log v31), with map cards (docs/design/v3-ch2-island.md, v3-ch2-behemoth.md), one encounter a wave and rising boss rounds (the Island: Gunship Wall; the Behemoth: Wolf Pack). As they were, both maps were flat for six waves and then a cliff; waves 6–10 now send most of their shells as drones. Bot with your Armory: the Island won 92% → 50%, ships lost in waves 1–5 0.25 → 0.88, boss rounds 1.3 / 1.7 / 1.6; the Behemoth won 58% → 42%, waves 1–5 0.29 → 0.71, boss rounds 0.5 / 2.2 / 2.5. Counter kits, all draftable in chapter 2: the Island, Gravity Well + Drone Screen + Gunship Pair (matches the bot’s own picks); the Behemoth, Shield + Frigate Escort + Air Strike (8.9 lost against 12.3). New enemies show “NEW · The Narrows” on their first banner. Still flagged: on the Island the south lane’s way in takes 28% of the damage (line 25%), left as it is. Next: the Needle of Bosk, the Archipelago and Saltgate Canal, after your play.
- **Now: Chapter 3: Dark Water.** The Battery rebuilt (#210, log v45), waiting on your play. Next: The Sowers, The Rigs, The Lantern and The Dreadnought, one at a time. Chapter 4 after.
