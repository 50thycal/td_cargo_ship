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
