# Straitwatch V2: round 13, the Island and a fresh start each wave

The player's asks:
1. A "Wave cleared" stamp, like the loss stamp.
2. Every wave starts fresh.
3. Tunnels and a hill on the Island, with trucks driving out of caves and back in.
4. Roads that never cross a base.
5. Strike jets that blow up trucks and subs.
6. Bases that look like missile silos, opening when they fire, without the next-weapon symbols.
7. Find out why the Island is so hard and make it easier: a sweep of every bot personality, and the try-hard bot's win compared with the player's runs.

## What the logs and the sweeps said

**The data.**
- 8 new logs, all format v6, all replaying exactly:
  - 3 of the player's Island runs: lost on waves 8, 9 and 7;
  - Gauntlet: lost once, cleared once;
  - Strait: cleared;
  - 2 try-hard watch runs on the Island.
- The second try-hard run (74362) is a mid-run save that stops at wave 8 with no ships lost; its end never uploaded.

**Every personality, 10 games on the Island (round-12 rules).**
- Try-hard cleared 5/10. Masher cleared 1/10.
- Everyone else cleared 0/10, "you" included, with bot-you reaching waves 6–9. That matches the player's 0 clears in 7 tries.

**Try-hard vs the player: luck, cards or skill?** The bot was played on the player's own seeds, five games each, and on the try-hard's two seeds. Across the seven seeds:

| Factor | Finding |
|---|---|
| **Skill: the biggest** | Try-hard won 15/35 with its own cards. Bot-you won 3/35. Swapping one group of try-hard's knobs for the player's: their targeting dropped it to 1/10, their eyes and their noise (look-aways, mood) to 2/10 each. Speed, aim, thumbs and rhythm barely mattered. |
| **Luck: big** | The try-hard's winning seed (74362) is an easy one: try-hard 5/5, and even bot-you 2/5. On the player's Oct 26–27 seeds try-hard managed 0/5 and 2/5. |
| **Cards: one pattern** | The player's Reload ×3-first builds (with Salvage, Speed, Magnet) took try-hard from 5/10 to 0/10 on those seeds. Their Twin/Magnet build didn't hurt. Stacking any single card first was roughly even (4–6/10), except Radar (1/10). What hurt was the whole build: utility cards in place of damage cards. |

**Where bot-you loses on the Island** (30 games).
- 10–12 of its losses end with the **carrier sunk**. The carrier takes ~12 hits a game, mostly ballistics, against a hull of 12.
- Ships sink early, in waves 5–8.
- **The fast north lane is the safe one.** It loses 1.5% of its ships; the south lane, under the island's silos, loses 2.8%.
- For comparison, bot-you clears Gauntlet as rarely (3/30, carrier sunk in 17 of 27 losses) and Strait 11/30.

**Your lane-speed question.** Ships in the north lane really are faster, by design since round 7. It's the risky route between the enemy shore and the island, so it carries one group in three, and those ships sail 1.5× faster to get through. The numbers show it works: that lane is now the safer of the two.

## The easing, measured

Tested on 30 games of bot-you and 20 of try-hard and casual, then confirmed on fresh seeds (5000+).

| Island change | You | Try-hard | Casual |
|---|---|---|---|
| none (round-13 rules) | 3/30 · 2/30 | 10/20 · 8/20 | 0/20 · 0/20 |
| more ships to the safe north lane | 1/30 | 10/20 | 0/20 |
| threat ×1.0 | 3/30 | 10/20 | 1/20 |
| extras two waves later | 6/30 | 13/20 | 0/20 |
| threat ×1.0 + extras later | 4/30 (fresh) | 13/20 | 0/20 |
| **threat ×0.95 + extras later (chosen)** | **11/30 · 9/30** | **13/20 · 12/20** | **2/20 · 2/20** |

The pairs are seeds 1000+ and fresh seeds 5000+.

**Chosen.**
- Island `threatScale` 1.1 → 0.95.
- Extras two waves later: supersonics from wave 6, heavies from wave 7, clusters from wave 8.

**Result.** Bot-you goes from about 7% to about 30%, and try-hard from about 45% to about 60%. The Island is now easier for bot-you than the Gauntlet (about 10%), and level with the Strait (about 37%).

## What changed

- **Fresh start.** When a wave is cleared, everything still in flight goes: interceptors, pickups on the water, smoke, strike jets, and running power-ups (Overdrive, Time Warp, Shield, Full Steam). Both racks are refilled. Explosions already on screen play out.
- **"WAVE N CLEARED".** A gold stamp, the same slam as the loss stamp, with the bonus under it. The beat before the cards is 1.4 s (was 0.6 s). A won map gets "MAP CLEARED".
- **Strike jets destroy subs and trucks.** Before, they only knocked them off. Now there's an explosion (a sub goes down in a spout), the launcher and its remaining rounds are gone, and a "TRUCK DESTROYED" / "SUB DESTROYED" punch plays.
- **Roads.**
  - Every truck route is drawn as a dirt road.
  - On every map, the coast roads curve inland behind each silo (`bypass` in `data/maps.ts`). Before, all five maps had a road crossing a base.
  - The Island road runs along the south flank of the hill, between two tunnels.
  - Pop-ups come out of caves: in the island's hillside, and beside each Archipelago silo instead of on it.
- **Tunnels.** Every on-screen road end is a tunnel mouth in a mound, drawn over the trucks. A truck fades up out of the dark as it comes out and fades away as it drives back in.
- **Hill.** The Island is drawn with contour rings rising to a ridge.
- **Silos.**
  - Each base is a concrete silo with a red rim, and its hatch slides open over the 0.7 s before a launch, then closes.
  - The next-weapon symbols are gone.
  - The raid warning rings stay.
- **Log format v7.** v6 logs no longer replay on this build, as with every rule change.

## Checks

- **Unit tests: 836/836.** New tests cover:
  - the field clearing between waves;
  - a strike destroying a truck;
  - no road within 36 px of a base on any map.

  The Island schedule test moved to wave 6. The dev short-wave density bound went from 1.3 to 1.5: a short wave keeps one of every threat type, so on the Island, whose extras start late, it runs a little busier than a full wave.
- **`npm run build`.**
- **Browser suites:** `e2e/v2.mjs` and `e2e/v2-watch.mjs` both pass.
- **Screenshots** (iPhone landscape) of all five maps' roads, tunnels and silos, a truck coming out of an island tunnel, a cave pop-up, and the stamp. The stamp check also confirmed that a pickup, Overdrive and an empty rack before the clear became a clean field and a full rack.
- **Other maps barely moved** (bot-you / try-hard, 10 games): Strait 4/10 and 8/10, Gauntlet 0/10 and 6/10, Harbor 0/10 and 4/10, Archipelago 1/10 and 3/10.
