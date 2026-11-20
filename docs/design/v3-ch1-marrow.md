# Lee of Marrow: map card (map rebuild, chapter 1)

**Date:** 2026-11-18. Lee of Marrow (`marrow`, chapter 1, the 3rd map) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the three reference maps (`docs/design/v3-p4-*.md`) and with the Kesh Hook (`docs/design/v3-ch1-kesh.md`). Encounter rev 4; play log v28.

Code:
- `src/v3/data/encounters.ts`: `MARROW_R4` (ten encounters) and `MAP_BOSS.marrow`;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.marrow`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.marrow`;
- `src/v3/sim/game.ts`: the new aims `post` (the radar tower) and `mid`;
- `src/v3/sim/events.ts`: Hydra Bloom reads its rounds from `MAP_BOSS`, and opens a round with missiles at the tower.

Bot reports: `tools/v3/map-report/results/marrow.md` and `marrow-player.md`, with heat maps.

## The problem

> The radar on the island makes your shots fly half again as fast over the middle of the lane, right where the middle silo fires down on the ships; the enemy goes for the tower, and once it falls it is gone for the run.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| Middle silo (base 2) | North shore, above the island (800, 95) | drones, shells, heavies | The signature: straight down on the ships under the radar, the shortest warning onto the danger stretch. Wave 1's first look, the first shell at the tower (w2), and the middle in every wave after. |
| West silo (base 1) | North-west shore (260, 105) | drones, guided | Fires across to the middle (`mid`), so the way in stays the coldest stretch: w2, w3, w5–7, w9–10. |
| East silo (base 3) | North-east shore (1340, 105) | guided, supersonic, shells | The tower's enemy: the missiles at the radar (w5, w10, and each boss round), and the lead ship in the climax. |
| Radar tower (allied post) | On the island (800, 318), reach 400 | – | The mechanic: its sweep covers x 494–1106 of the lane, the middle third. 4 hit points; lost is lost. |
| Sub spots | NW (180, 330), NE (1420, 330), SW (300, 742), SE (1320, 742) | sub salvos | A sub on your side of the lane (SW, w4); subs at both ends of the island, one at the tower (w8). |
| Coast road, pop-ups, two air lines | North shore; the edges | trucks, strafers, bombers | The shared waves' own; the jet over the island (w7). |

Warning time falls from 8.4 s on wave 1 to 3.7 s on wave 10 (−0.57 s a wave).

## The stretches

- **Danger: the middle**, under the island and its radar. It takes 50–53% of the hull damage in waves 1–9.
- **Safe: the early third**, the way in from the west: 22% without the Armory and 23% with it. Both pass.

The radar is what makes the danger stretch defensible, and the enemy wants it gone. The tower being lost is the stake: from then on, shots over the middle fly at the normal speed.

## The convoy

The map's own convoy, no command: pairs in one wide lane, at the reference maps' schedule (`MAP_CONVOY.marrow`). The mechanic needs no command, because the tower is defended by shooting, not by sailing. The map card now opens on policy D with the encounters on.

## The counters

- **Counter kit:** Point Defense, Seeker Pod, Drone Screen. The tower wants your taps as much as the ships do. Weapons that fire themselves keep shooting at the stretch under the island while your hand goes to the tower, and inside the sweep their shots are quick too.
- **Off-counter kit:** Scattergun, Railgun, Overdrive. Every shot needs the hand the tower also wants.

Chosen from six kits on 24 seeds with the player's Armory, during tuning (won, ships lost in waves 1–10):
- Point Defense, Seeker, Drone Screen: 75%, 3.75 (the best);
- aimed and self-firing kits: 71%, 4.0;
- Scattergun-Railgun-Overdrive, the Strait's area kit and blast: 62%, 3.8–4.3.

Area weapons were the first guess and did worst. On the final report the two kits come out almost even (table below).

## The debut

None. The Hydra is Marrow's lead foe (`DEBUT_SLOTS[1]`, and its event is Hydra Bloom), but it debuts on the Strait on wave 3, as do Sprint Drones and Rocket Trucks (`debuts()`). Marrow brings nothing new to fight, and nothing from a later chapter. Its "first to bring" in the maps plan is enemy fire aimed at your radar, which wave 2 shows on its own: one shell, at the tower.

## The mechanic: the radar tower

Used in four waves and every boss round (rule `g-mechanic`: at least three), with a new aim, `post`. A launch aimed with `post` goes at the map's allied structure while it stands; once the tower is gone, it goes at the ship nearest where it stood (the middle). On top of that, the game's own 22% of missiles at the tower (`POST.targetShare`) is unchanged.

| Wave | At the tower |
| --- | --- |
| 2 | one shell from the middle silo (the first look) |
| 5 | one guided missile from the east, while two swarms hit the middle (tower or ship) |
| 8 | a sub off the east end of the island, 2 shells |
| 10 | two guided missiles from the east, opening the climax |
| boss | 1, 1, then 2 guided missiles opening rounds 1–3 |

The bot loses the tower in every run with the player's Armory: by wave 5 in 9 of 24 runs, by wave 6 in 16, the last on wave 9. Before the rebuild it fell on waves 5–8. So in most runs the boss's tower missiles go at the ship nearest the island. See "What is not satisfied".

## The ten waves (v1, encounter rev 4)

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | Under the sweep (`marrow-under-the-sweep`) | middle silo, 3 drones | the ship under the radar |
| 2 | teach | A shell for the tower (`marrow-shell-at-tower`) | middle silo, 1 shell; west silo, 4 drones | **the tower**; the middle |
| 3 | first stakes | Under the island (`marrow-under-the-island`) | middle silo, 5 drones; west silo, 1 guided | the middle |
| 4 | first stakes | Shells below the island (`marrow-shells-below`) | middle silo, 4 drones and 2 shells; a sub on your side (SW), 3 shells | the middle, from both sides |
| 5 | combine | Tower or ship (`marrow-tower-or-ship`) | east silo, 1 guided; middle silo, 6 drones; west silo, 4 drones | **the tower** / the middle |
| 6 | combine | West and middle (`marrow-both-shores`) | west silo, 4 drones; middle silo, 2 shells and 3 drones; east silo, 2 guided | the middle from two angles |
| 7 | escalate | Down the lane (`marrow-down-the-lane`) | a jet from the east; middle silo, 5 drones; west silo, 2 guided | the lane; the middle |
| 8 | escalate | Subs off the island (`marrow-wolf-pack`) | NW sub, 3 shells; NE sub, 2 shells; middle silo, 5 drones | any ship / **the tower** |
| 9 | escalate | Crossfire at the island (`marrow-crossfire`) | west and middle silos, 4 drones each; middle silo, 2 shells | any ship; the middle |
| 10 | climax | The tower's last stand (`marrow-last-stand`), after the wave's own fire (`at: 1`) | east silo, 2 guided at the tower, then 2 at the lead ship; 5 + 4 drones; 2 shells | **the tower**, the middle, the lead ship |

- **Wave 9 is the lighter half of its wave.** The map's heavy cruise missile arrives on wave 9, with the shared table's biggest step. Before the rebuild, wave 9 was already a cliff without the Armory (0.79 → 2.58).
- **The climax comes after the wave's own fire is spent**, as the Strait's does, so a calm falls before it. Harbor's `calm` (which moves the wave's own raids earlier) bunched wave 10 into a cliff here.
- Wave 1 loses no ship (both reports and the round 12 test).

## The boss plan: Hydra Bloom at the tower

Hydra Bloom is Marrow's own event: two fans of Hydras, one from each silo at once, each splitting into three darts, and a drone swarm. With the player's Armory the bot lost 0.04 / 0.13 / 0.13 a round.

Under encounter rev 4 (`MAP_BOSS.marrow.rounds`, lab only), each round opens with guided missiles at the radar tower, out of the guided silos in turn:

| Round | At the tower | Fans (Hydras) | Drone swarms |
| --- | --- | --- | --- |
| before (every round) | 0 | 2 (6) | 1 of 5 |
| 1 | 1 | 2 (6) | none |
| 2 | 1 | 2 (6) | 1 of 5 |
| 3 | 2 | 2 (6) | 1 of 5 |

Target: about a ship a round on the bot's scale (`botTarget: 1`; no player runs on Marrow yet, and the bot reads boss rounds about twice as hard overall, so the player should lose about half a ship a round). Each round lasts 15–30 s (test).

## Bot results, before and after (24 seeds, 900–923)

"Before": the map card as it was (today's convoy controls, no encounters). Commands: `npm run v3:map-report -- --map=marrow --seeds=24 --kits=plan [--armory=player]`.

### The player's Armory

| | Before | After |
| --- | --- | --- |
| Won (normal) | 96% | **67%** |
| Mean end wave | 13.8 | 12.8 |
| Ships lost in waves 1–10 (normal) | 1.0 | 4.0 |
| Ships lost in waves 1–5 (normal) | 0.00 | 0.42 |
| Ships lost in a won run, all 13 waves | – | 5.4 (2–9) |
| Boss r1 / r2 / r3 (normal, reached) | 0.04 / 0.13 / 0.13 | 0.61 / 0.56 / 1.44 |
| Boss r1 / r2 / r3 (tough) | 0.04 / 0.13 / 0.13 | 0.63 / 0.63 / 1.46 |
| Tough curve 1–10 | 0 0 0 0 0 0 .08 .25 .25 .50 | 0 0 .25 .17 0 .38 .50 .50 1.08 1.58 |
| `w-cliff` | PASS | **FLAG**: w9 0.50 → 1.08 (by 0.08) |
| `w-early` close calls from w3 | PASS | PASS (fewest w3 2.33) |
| `w-budget` | PASS | PASS (furthest w5 ×1.12) |
| `m-stretches` | **FLAG**: cold late 29% | PASS: hot middle 50%, cold early 23% |
| `g-warning` | PASS: 8.5 → 4.0 s | PASS: 8.4 → 3.7 s |
| `w-first` | PASS | PASS |
| Kits (won; end wave; lost 1–10 normal / tough) | – | counter 67%, 12.9, 3.6 / 4.0; off-counter 58%, 12.5, 3.4 / 3.9 |

### Baseline (no Armory)

| | Before | After |
| --- | --- | --- |
| Won (normal) | 29% | 0% |
| Ships lost in waves 1–10 (normal) | 3.7 | 5.5 |
| Ships lost in waves 1–5 (normal) | 0.04 | 1.00 |
| Boss r1 / r2 / r3 (tough) | 0.54 / 1.83 / 2.29 | 2.00 / 2.92 / 3.67 |
| Tough curve 1–10 | 0 0 0 .04 0 .38 .71 .79 2.58 2.42 | 0 0 .04 .38 .63 .92 1.25 1.54 2.46 2.88 |
| `w-cliff` | **FLAG**: w9 0.79 → 2.58 | PASS (biggest step w9 +0.92) |
| `w-budget`, `m-stretches` (cold early 22%), `g-warning`, `w-first`, `w-early` | PASS (stretches: cold late 24%) | PASS |
| Kits (lost 1–10 tough) | – | counter 9.6, off-counter 9.3 |

**Chapter 1 difficulty.**
- With the player's Armory the bot wins 67%, and a won run loses 5.4 ships over the whole map (2–9; waves 1–10 alone, 4.0).
- That is a little harder than the Kesh Hook (75%), as the maps plan orders them: Kesh 1 try, Marrow 1–2.
- Every check passes without the Armory. With it, one flag is left: wave 9, by 0.08 of a ship.

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `marrow-player.md`:
- **Tension rises from wave 1:** its peak is 0.05, 0.33, 0.65 on waves 1–3, so the reference maps' flat start is not repeated here.
- **Saves:** 0.1–0.3 a wave on waves 6–10, at the low end of the provisional 0.3–0.5.
- **Boss rounds:** saves come at 0.1 / 0.2 / 0.9 a round. Round 3's 0.9 is near the "about 1 a round" target: the second tower missile and the split darts make the close calls.

## The play log (v28)

Shared with the Kesh Hook (`docs/design/v3-ch1-kesh.md`, "The play log"):
- `LOG_VERSION` 28, and `LOG_REPLAYS` `[28]`;
- lab only, under the encounter layer;
- the map-lab baseline changed only its version, and was rewritten.

## Tests

- `tests/v3/encounters.test.ts`:
  - the ten listed;
  - a shot `post` goes at the tower while it stands, and at the ship nearest where it stood once it is gone;
  - the tower is the target on waves 2, 5, 8 and 10;
  - Hydra Bloom's rounds: 1, 1, 2 missiles, the fans and swarms as listed; a rev 3 log and the campaign are unchanged; 15–30 s a round;
  - the budget, legality, warning and replay checks cover Marrow.
- Also extended to Marrow: `mapRules.test.ts`, `round12fixes.test.ts`, `mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts` and `e2e/v3-map-cards.mjs` (`?lab=map-marrow`).

## What is not satisfied, or uncertain

- **The tower falls early for the bot:** by wave 6 in two runs out of three. So the boss's tower missiles mostly hit the ship nearest the island, and the mechanic matters most in waves 2–8.
  - The player may defend it better than the bot: the bot weighs a missile at the tower like one at a ship, by its time to impact.
  - If the player wants the tower to matter in the boss rounds, two options:
    - more hit points (4 → 6);
    - the tower rebuilt with the convoy before the boss. This goes against "lost is lost".
- **Wave 9 with the Armory:** one flag by 0.08 of a ship. The heavy cruise missile arrives on that wave.
- **Kits:** the two come out even on this report. The counter kit wins more (67% against 58%); the off-counter loses slightly fewer ships in waves 1–10. Rule `m-kits` asks for clearly better. The bot's kit is only its draft taste, and the six kits tried were within 0.5 of a ship of each other.
- **Boss round 2** reads a little under round 1 on the bot (0.56 against 0.61 on normal runs; 0.63 and 0.63 tough). Round 3 rises (1.44).
- **No player data on Marrow.** The bot's bias for Marrow's boss rounds is unknown. The target assumes the overall 2× bias.

## After the playtest (log v29, 2026-11-19)

The player played the Marrow map card (log v28, `v3-20261118180044-83324`; review `tools/v3/map-rules/review-2026-11-19.json`): won, 4 ships lost, fun 4, difficulty "right", boss 3, "keep", better than Kesh. Measured on the v28 build: `tools/v3/bot-fit/results/ch1-playtest-2026-11-19.json`.

### The player against the bot

| | Waves 1–9 | 10 | Waves 1–10 | B1 / B2 / B3 |
| --- | --- | --- | --- | --- |
| The player | 0 | 2 | 2 | 1 / 0 / 1 |
| The bot on the player's seed, Armory and picks (12 dice) | 2.9 | 1.36 | 4.25 | 0.29 / 1.00 / 1.71 |
| The map card's prediction (24 seeds) | | | 4.0 | 0.61 / 0.56 / 1.44 |

The bot reads waves 1–10 about twice as hard as the player played them (4.25 against 2), and the boss rounds about 1.4× (1.0 a round against 0.67).

**Fun measures on the player's run:** two saves, both clutch **cover choices** on a guided missile (B1 at 7.2 s, 0.70 s from impact, 1 ship; B3 at 7.2 s, 0.64 s, 0.67): the boss rounds' opening missiles at the tower, the moment the round asks for. Tension is flat on waves 1–5 (peaks 0.04–0.56), rises on waves 6, 8 and 10 (sawtooth rising on 6 and 10), and B3 is pinned (hot 38%, peak 1.85, the run's top). **Best moment** (wave 10, 44 s) is 2 s before wave 10's top (1.12 at 46 s): a match within the second the strip can resolve, though the run's highest peak is B3, not wave 10.

### The radar tower: it slows the enemy

The player's decision, in their own note at step 784: "Have the radar slow enemy down that are in the radius instead of speeding up my munitions I think that makes more sense"; and on the hub: "kinda useless to keep. Let's buff it a bit based on my recommendation to slow down enemy's".

- **The sim** (`src/v3/sim/game.ts`, `updateThreat`): while the tower stands, every enemy unit and munition inside its 400 px sweep moves at `POST.radarSlow` of its pace (**0.65: 35% slower**), its clock too (a shell's arc, a missile's boost, a drone's weave, an aircraft's run). Launchers (trucks, subs) are not slowed. The time to impact (the bots, the warnings, the tension curve) reads the slowed pace. The shot speed-up (`POST.radarBoost`) is gone.
- **On screen** (`src/v3/ui/features.ts`): the sweep is an icy wash with a ring pulsing out from the tower every 2 s; each slowed threat wears an icy halo, its lock box and a frosted trail of three ghosts. The first-time hint reads "Drones and missiles in its sweep are slowed (the icy ring)". The map blurb and the encounters' text say the same.
- **Other maps:** the radar is Marrow's alone (Battery Point's posts are batteries, unchanged).
- **The amount:** tried at 0.60, 0.65 and 0.70 (player Armory, 24 seeds, `--no-fun`): waves 1–10 lost 2.8 / 3.1 / 3.2; the tower fell by wave 6 in 8 / 9 / 14 runs (median wave 7 / 8 / 6). 0.70 lets it fall as early as before; 0.60 makes the map easier still. 0.65 is the middle.
- **Its hit points stay 4.** 5 or 6 read the same (a missile or shell takes 2, so 5 and 6 both take three hits): the tower then fell by wave 6 in only 4 runs, but the map got easier again (won 96%, 2.4 lost in waves 1–10). Since 0.65 alone keeps it up past wave 6 in most runs, it was left at 4.

Bot, the player's Armory, 24 seeds, `--kits=plan` (v29 includes the boss intro):

| | v28 | v29 |
| --- | --- | --- |
| Tower fell by wave 5 / by wave 6 / standing into the boss rounds (of 24) | 9 / 16 / 0 | **6 / 9 / 2** (median wave 8; one run kept it to the end) |
| Won (normal) | 67% | 79% |
| Ships lost in waves 1–10 / 1–5 | 4.0 / 0.42 | **3.1 / 0.04** |
| Boss r1 / r2 / r3 (normal, reached) | 0.61 / 0.56 / 1.44 | 0.52 / 0.76 / 1.71 |
| `w-cliff` | FLAG: w9 by 0.08 | FLAG: w8 0.21 → 0.63 |
| `m-stretches` | PASS: cold early 23% | **FLAG: cold early 27%** |

Without the Armory: won 0% → 8%, waves 1–10 5.5 → 5.0, the tower fell by wave 6 in 14 runs (median wave 6); cliffs on waves 6, 7 and 9 (it passed before), and the early stretch 26% (22%). Warning time on wave 1 now reads 11.4 s (8.4), as slowed threats read longer to impact.

**What it does to the map:** the tower is worth defending now (standing past wave 6 in about two runs in three), and Marrow got easier, mostly in waves 1–7, where the tower still stands: the middle stretch, which the tower covers, got safer, so the early third's share rose past the 25% line. The player found Marrow "right" at 2 ships lost in waves 1–10 where the bot read 4.25; now the bot reads 3.1 on the card's seeds. **A question for the player** (hub): keep Marrow a little easier as the price of a tower that matters, or add a little fire to waves 6–10 to win it back.

**The boss** moved little (0.61 / 0.56 / 1.44 → 0.52 / 0.76 / 1.71) and was left alone, as asked.

### The boss intro: a longer calm and one banner (every map)

The player's note: "with the boss wave have more of a pause before it begins and say live or ships reset and then like survive for these next three waves make it feel more dramatic".

- **The calm** (`EVENT.bossCalm`, 5 s, `src/v3/data/events.ts`; `firstBossRound` in `src/v3/sim/events.ts`): the first round of every map's three-run ending starts its script 5 s later, so the breather and the calm are 8 s with no launch. Rounds 2 and 3, bonus events and the Test Lab's event cards start as before. The round's own 15–30 s is counted from its first launch and is unchanged.
- **The banner** (`src/v3/ui/app.ts`, the `special` case of `drainEvents`): "BOSS: DRONE STORM" (the boss's name), "Survive the next 3 rounds. Convoy restored: 6 ships can still be lost." The event card holds through the breather and the calm. The separate "CONVOY RESTORED" banner is folded into it on that step.
- **Ship losses are not reset by this change, but they already were.** Round 7's experiment (`ENDING.threeRuns`, `restoreConvoy` in `sim/events.ts`, called from `startWave`) restores the convoy and the carrier before boss round 1 in the campaign and on a map card's full run: the ships lost before it stop counting against the six. On the player's Kesh run the replay shows it (3 lost by wave 10, `lossBase` 3 at wave 11). So the banner says "Convoy restored". Turning the restore off is that one flag; the banner then reads the losses left as they are ("2 ships can still be lost").

On the reference maps the calm is the only change, and waves 1–10 read exactly as before. Their `-player` reports were re-run (24 seeds, `--kits=plan --fun-placebo`); boss rounds, normal runs that reached them, v28 → v29:

| Map | v28 | v29 | Won |
| --- | --- | --- | --- |
| The Strait | 1.07 / 1.86 / 2.00 | 1.07 / 1.21 / 2.00 | 29% → 33% |
| The Gauntlet | 0.67 / 0.67 / 1.33 | 0.67 / 0.67 / 1.25 | 50% → 46% |
| Harbor Mouth | 1.00 / 2.75 / 1.14 | 0.63 / 2.63 / 1.25 | 25% → 17% |

The moves are within a run or two of the 8–14 that reach the boss (the convoy sails 5 s further in before round 1 starts), so the boss rounds play as before apart from the calm.

### Tests

- `tests/v3/maps20.test.ts`: a guided missile inside the sweep covers `POST.radarSlow` of the ground one outside does; the amount is 30–40%.
- `tests/v3/bossIntro.test.ts`: on every map with a boss, round 1 waits `EVENT.bossCalm` more and nothing flies until the breather and the calm are over; only run 1 of a several-run ending counts.
- `tests/v3/encounters.test.ts`: the Drone Storm's shells and missiles and its rise; every boss round still 15–30 s.
- `tests/v3/frigateJitter.test.ts`, `tests/v3/nuke.test.ts`: the two Kesh notes (`docs/design/v3-ch1-kesh.md`).
- `src/v3/sim/mapReport.ts`: a "Radar tower standing" INFO row (`g-mechanic`) in the bot report.
- `e2e/v3.mjs`: the boss banner names the boss, the rounds and the ships left.

Reports: `tools/v3/map-report/results/marrow.md` and `marrow-player.md`.

## After the v29 replay (log v30, 2026-11-19)

The player replayed Marrow on log v29 (`v3-20261119132436-3976`; review `tools/v3/map-rules/review-2026-11-19-r6.json`): **lost on wave 10**, ships lost 0 on waves 1–6, then 1, 1, 2, 2. Fun 3 (was 4), "a bit easy"; waves 1–4 rated about 1 / 1 / 1 (difficulty, fun, intensity), waves 6–7 2 / 2 / 1–2. Their note: "pretty easy till the last like two waves". On the replay **the radar tower fell on wave 4**, so waves 5–10 had no slow at all: the cliff at the end is partly the tower's.

### What changed

Lab only (the encounter layer, rev 4 reworked in place):
- **The shared waves' fire moves from the end to the start** (`MARROW_CLIMB`, v1's `scale` in `src/v3/data/encounters.ts`): waves 1–10 × 1, 1, 1.06, 1.04, 1, 1.05, 1, 1, 1, 0.85.
- **Early pressure that is not slowed.** Inside the radar's sweep every threat is a third slower, so fire at the middle reads calm while the tower stands. The early waves add shells from the east silo at the ship nearest it, just past the island (`aim: 'near'`), timed with the middle's fire:
  - **w3, the first real threat:** the middle swarm and the west missile, plus two east shells (new);
  - w4: the south-west sub's salvo and three east shells together (the middle's two shells are gone), and a smaller swarm;
  - w5: the guided missile at the tower, the middle swarm, and two east shells (the west swarm is gone);
  - w6: three east shells at the ship halfway along (they were the middle silo's two);
  - w7: the two guided missiles come from the east silo (were the west's); w8: the west sub's salvo aims at the middle.
- **The end is the top of the climb:** wave 9's two shells and wave 10's shells and lead-ship missiles become drones (wave 10 keeps its two missiles at the tower), and wave 10 sends 15% less of its own fire.

### Before and after (the bot replaying the player's setup)

`tools/v3/bot-fit/curve.ts` (see `docs/design/v3-ch1-kesh.md`): 24 dice on the player's seed ("mirror"), and the player's setup on seeds 900–923 ("seeds"); Armory warhead 5 / Point Defense 4 / drops 3, the player's picks (Thermobaric, Railgun, Drone Screen).

Ships lost per wave:

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 1–5 | 1–10 | Won |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The player (v29) | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 2 | 2 | 0 | 6 | lost w10 |
| Mirror, v29 | 0 | 0 | 0 | 0 | 0 | .08 | **.50** | .61 | .83 | **1.43** | 0 | 3.33 | 92% |
| Mirror, v30 | 0 | 0 | 0 | 0 | .25 | .25 | .25 | .42 | .67 | .78 | 0.25 | 2.58 | 96% |
| Seeds, v29 | 0 | 0 | 0 | 0 | 0 | .17 | .21 | .46 | **1.17** | 1.39 | 0 | 3.29 | 75% |
| Seeds, v30 | 0 | 0 | .04 | 0 | .42 | .54 | .46 | .78 | .82 | .75 | 0.46 | 3.58 | 67% |

Tension peak a wave (shape: f flat, 1 one peak, s sawtooth):

| | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | First hot wave |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| The player (v29) | .11 f | .03 f | .21 f | .41 f | .28 f | .55 f | .73 f | 1.28 s | .66 f | 1.03 s | 8 |
| Mirror, v29 | .07 f | .18 f | .67 f | .61 f | .56 f | .72 f | .82 f | 1.10 s | 1.16 1 | 1.30 1 | 5.2 |
| Mirror, v30 | .07 f | .18 f | **.94 1** | 1.14 1 | .87 1 | 1.00 1 | .75 f | 1.07 1 | .93 s | .92 s | 3.4 |
| Seeds, v29 | .05 f | .17 f | .50 f | .52 f | .53 f | .81 1 | .79 1 | .98 s | 1.23 1 | 1.21 1 | 5.6 |
| Seeds, v30 | .05 f | .17 f | .72 f | 1.14 1 | .83 f | 1.06 1 | .85 f | 1.19 1 | .98 1 | .98 1 | 3.8 |

The tower fell (median) on wave 7 in both v29 (12 dice) and v30 mirrors; on the player's run, wave 4.

The bot report (`npm run v3:map-report -- --map=marrow --seeds=24 --kits=plan --armory=player`):

| | v29 | v30 |
| --- | --- | --- |
| Ships lost per wave 1–10 (normal, reached) | 0 0 .04 0 0 .29 .21 .63 .71 1.30 | 0 0 0 .04 .21 .13 .67 .71 .38 .52 |
| Waves 1–5 / 1–10 | 0.04 / 3.1 | 0.25 / 2.6 |
| Won (normal) | 79% | 83% |
| Tension peak 1–10 | .05 .27 .50 .56 .65 .73 .73 .98 .98 1.23 | .05 .27 .61 **1.11** .91 .97 1.01 .99 .92 .85 |
| `w-cliff` | FLAG: w8 0.21 → 0.63 | FLAG: w7 0.13 → 0.67 (tough runs) |
| `m-stretches` | FLAG: cold early 27% | FLAG: cold early 26% (hot middle 42%) |
| `w-budget`, `w-early`, `g-warning`, `w-first` | PASS | PASS (furthest w6 ×1.13) |
| Radar tower fell, median | w8 | w7 |
| Boss r1 / r2 / r3 (normal, reached) | 0.52 / 0.76 / 1.71 | 0.33 / 0.95 / 1.76 |

Without the Armory (`marrow.md`): won 8% → 8%, waves 1–10 5.0 → 5.7, `w-cliff` FLAG on w6, w7 and w9 → FLAG on w5 and w7, `m-stretches` 26% → 25% (FLAG).

### What it does, and what it doesn't

- **Waves 1–5 now ask something:** the first bump on wave 3 (mirror 0.94, one peak), wave 4 hot on every reading, and 0.25–0.46 ships lost in waves 1–5 (asked for 0.3–0.6; was 0).
- **The end is no longer a cliff on the player's setup:** waves 6–10 read 0.25, 0.25, 0.42, 0.67, 0.78 on the player's seed (0.08 → 0.50 and 0.83 → 1.43 before), and 0.54, 0.46, 0.78, 0.82, 0.75 on the other seeds. No wave doubles the one before. Totals stay about where they were (2.58 / 3.58 against 3.33 / 3.29).
- **The bot report still flags one cliff**, in its tough runs with its own picks: wave 7 at 0.67 after wave 6's 0.13 (it moved from wave 8; a second try, wave 7's missiles back from the west, moved it to wave 10). It reads a sinking either side of the line from run to run.
- **The early stretch** still takes 26% (rule: under 25%): the east shells land past the island, not on the way in, but the shared waves' trucks and strafers keep the way in warm.
- **The tower:** it still falls around wave 7 for the bot. The player lost it on wave 4. The waves after it get harder by the tower's loss on top of the table's rise, so the player's 7–10 are likely to stay the hardest stretch.

## After round 8 (log v32, 2026-11-20)

The player's decision (round 8): **the radar tower gets more hit points (about 6, from 4)** so it usually lasts into the late waves. On their v29 replay it fell on wave 4; the bot lost it around wave 7. The slow field (`POST.radarSlow` 0.65, #174) stays.

### What changed

- **The tower takes 6** (`MAPS.marrow.posts[0].hp`, `src/v3/data/maps20.ts`; campaign and lab). A guided missile or a shell takes 2, so it falls to the third hit, not the second; a heavy still takes it at once. The "RADAR HIT" notice counts hits as the player does ("2 more hits and it is lost"; it used to print the points left).
- **Waves 7–10 send 10% more of their own fire** (`MAP_FIRE.marrow`, lab only, as the Strait's waves 5–10 do), to win back what the sturdier tower gives away. Not wave 6: it already sends 1.13 times its shared wave, and +10% put it at 1.25, past rule `w-budget`'s ±15% (tried first). The encounters are unchanged. (Tried and dropped: one more missile, shell or drone pair in the encounters of waves 7–9; within the noise, and the books rule `sends ≤ takes out` needs a drone given up for each.)

### Before and after

The bot report, the player's Armory (`npm run v3:map-report -- --map=marrow --seeds=24 --kits=plan --armory=player`):

| | v31 | 6 hit points only | v32 (6 + waves 7–10 fire) |
| --- | --- | --- | --- |
| Won (normal) | 83% | 83% | **83%** |
| Ships lost in waves 1–10 / 1–5 | 2.6 / 0.25 | 2.3 / 0.29 | 2.3 / 0.29 |
| Lost per wave 6–10 (normal, reached) | .13 .67 .71 .38 .52 | | .17 .25 .50 .65 .45 |
| Tower fell: by w5 / by w6 / by w10 / in the boss rounds / stood (of 24) | 4 / 7 / 22 / 2 / 0 | 1 / 3 / 21 / 1 / 2 | 1 / 3 / 21 / 2 / 1 |
| Tower fell, median | w7 | w8 | **w8** |
| Boss r1 / r2 / r3 (normal, reached) | 0.33 / 0.95 / 1.76 | | 0.57 / 0.57 / 1.38 |
| `w-cliff` | FLAG: w7 0.13 → 0.67 | FLAG: w9 | **PASS** |
| `w-budget` | PASS (w6 ×1.13) | PASS | PASS (w8 ×1.15) |
| `m-stretches` | FLAG: cold early 26% | | FLAG: cold early 29% |

The player's own setup (`tools/v3/bot-fit/curve.ts --ids=v3-20261119132436-3976 --dice=24 --seeds=24`: the latest Armory, warhead 5 / Point Defense 4 / drops 3, and the player's picks):

| | Won | Lost 1–5 | Lost 6–10 | Lost per wave 6–10 | Tower fell, median |
| --- | --- | --- | --- | --- | --- |
| Mirror (the player's seed), v31 | 96% | 0.25 | 2.33 | .25 .25 .42 .67 .78 | w7 |
| Mirror, 6 hit points only | 96% | 0.21 | 1.92 | .04 .25 .25 .79 .58 | w8 |
| Mirror, v32 (fire from wave 6, tried) | 92% | 0.21 | 2.13 | .13 .29 .13 .63 .96 | w8 |
| Seeds 900–923, v31 | 67% | 0.46 | 3.13 | .54 .46 .78 .82 .75 | w7 |
| Seeds, 6 hit points only | 96% | 0.29 | 2.25 | .46 .17 .42 .70 .57 | w8 |
| Seeds, v32 (fire from wave 6, tried) | 83% | 0.29 | 2.33 | .63 .29 .26 .78 .48 | w8 |

48 seeds, the latest Armory (`quick.ts`): won 81% / 2.67 lost in waves 1–10 on v31, 90% / 2.13 with 6 hit points alone, 92% / 2.27 with the extra fire from wave 6. Without the Armory (`marrow.md`): won 4% (8%), 4.3 lost in waves 1–10, tower median w8 (w6).

### What it does, and what it doesn't

- **The tower lasts a wave longer, not to the end:** it now falls by wave 6 in 3 runs of 24 (7), and the median moves from wave 7 to wave 8. In most runs it still falls in waves 7–10, so the boss's tower missiles mostly go at the ship nearest the island. 6 is three hits; the next step that matters is 8 (four hits).
- **The map is about as hard as it was** on the record report (83% won, 2.3 lost in waves 1–10). On the player's own setup it is easier than v31 (seeds: 67% → 83%; 6–10: 3.1 → 2.3), as the player's "a bit easy" note on waves 1–6 is untouched. The bot numbers move ±10% from run to run of 24–48 seeds.
- **The early stretch** still takes 29% (rule: under 25%), a little more than before, as the middle under a standing tower takes less.
