# The four new Armory upgrades, measured (2026-11-20, LOG_VERSION 40)

The player on the Armory review page: "Do life boat, salvage crew, boiler and quarter master". Built on branch `claude/v3-armory-new`; numbers in `src/v3/data/armory.ts`.

## How it was measured

`tools/v3/armory-ideas/new-upgrades.ts` plays plain Armory loadouts on the real game code, as `check.ts` measured the others: the "you" bot, the five chapter 1 maps, 12 seeds each (900–911, 60 runs a config), every wave played (no loss limit; the normal limit is read off the run, as the combo sweep does), paired with level 0 on the same seeds. `new-sum.mjs` folds the runs (`new-runs.jsonl`) into `new-results.json`.

- **Alone:** the card at level 5 against no Armory. This is the yardstick of the other upgrades' "ships saved a run": 5–8 (Armor Plating 13.6), `check-results.json`.
- **On the player's Armory:** the card at level 5 on top of `PLAYER_ARMORY` (Quick Reload 5, Damage Control 4, Stockpile 5) against that Armory alone. The sim does not enforce one card a bay, so this is the card's own lift on a real build.
- **Kit:** the map's counter kit, forced (check.ts's mode). A forced draft replaces the hand, so Quartermaster can do nothing here. **Self:** the bot drafts for itself (and re-rolls).
- Tries (a number set after the run is made, in `new-upgrades.ts`'s `TRIES`): `boilers30`, `boilers50` (convoy speed 130%, 150%), `qm6`, `qm10` (6, 10 re-rolls), `qm5cards` (five cards; played with 3 re-rolls and the bot's first re-roll rule, which re-rolled even when no hand could help).
- "Won" is the share of runs won under the normal loss limit (6 ships in waves 1–10, 6 more in the boss rounds), with Lifeboats' half losses counted.

## Results

Ships saved a run (all 13 waves), ± one standard error (paired):

| Upgrade (level 5) | Alone, kit | Alone, self | Player's Armory, kit | Player's Armory, self |
| --- | --- | --- | --- | --- |
| Boilers (120% speed, Full Steam ×2) | 2.5 ± 1.1 | 1.5 ± 1.0 | −0.6 ± 0.7 | −0.6 ± 0.6 |
| Quartermaster (4 re-rolls, 4 cards) | 0 (no draft) | 2.5 ± 0.9 | 0 (no draft) | 0.9 ± 0.7 |
| Lifeboats (every wave) | 0 ships; 3.6 off the loss tally | 0 ships; 3.4 off the tally | 0 ships; 2.5 off the tally | 0 ships; 2.2 off the tally |
| Salvage Crews (+50% Scrap) | 0 | 0 | 0 | 0 |

Won under the normal loss limit (no card → with the card):

| Upgrade | Alone, kit | Alone, self | Player's Armory, kit | Player's Armory, self |
| --- | --- | --- | --- | --- |
| Boilers | 5% → 3% | 3% → 2% | 45% → 42% | 52% → 42% |
| Quartermaster | — | 3% → 2% | — | 52% → 57% |
| Lifeboats | 5% → 5% | 3% → 7% | **45% → 62%** | **52% → 62%** |

Scrap a run (no first clear, no repeat cards):

| | Alone, kit | Player's Armory, kit | Player's Armory, self |
| --- | --- | --- | --- |
| No Salvage Crews | 331 | 528 | 548 |
| Salvage Crews 5 | 496 (+165) | 792 (+264) | 822 (+274) |

Per map, alone (kit / self): Boilers strait 0.3 / 1.3, gauntlet 2.0 / −0.7, harbor 6.8 / 4.3, kesh 5.3 / 3.2, marrow −2.1 / −0.2. Quartermaster (self) strait 1.8, gauntlet 2.1, harbor 3.8, kesh 5.2, marrow −0.3.

### Boilers: weak, and its own number can't lift it

At 20% it saves 2.5 ships alone with the counter kit and 1.5 drafting for itself, and nothing on the player's Armory. Tried faster:

| Convoy speed at level 5 | Alone, kit | Alone, self | Player's Armory, kit | Player's Armory, self |
| --- | --- | --- | --- | --- |
| 120% (built) | 2.5 ± 1.1 | 1.5 ± 1.0 | −0.6 ± 0.7 | −0.6 ± 0.6 |
| 130% | 4.3 ± 0.8 | 2.9 ± 0.9 | −0.5 ± 0.6 | 0.3 ± 0.7 |
| 150% | 4.7 ± 1.1 | 3.2 ± 0.9 | | |

Speed runs out quickly (130% and 150% save about the same) and saves nothing on a real build: an attack is aimed at a ship and lands whatever the ship's speed; a shorter crossing only helps on the open-water maps (Harbor Mouth and the Kesh Hook, 4–8 saved). So the doc's 4% a level is kept: 6% would buy 1–2 ships alone, nothing on the player's build, and changes every map's timing more. **Boilers needs a second job to reach the 5–8 band** (as Long Loads got the rack refill): the player's call.

Map clocks: the speed is a factor in `shipSpeed()` only. Saltgate's locks (fill `wait`, entry and exit times), the radar windows, spawn gaps and wave lengths run on the sim clock, not the ships' speed (a unit test checks each lock fills for exactly its `wait` with Boilers 5).

### Quartermaster: below the band for the bot

2.5 ± 0.9 ships saved alone (the bot drafting for itself), 0.9 on the player's Armory, +5 points of wins there. The bot's rule (re-roll a hand with no weapon it holds to level and none of its four favourites for a free slot, while a new hand could still bring one) spends 1.8 re-rolls a run; 4, 6 or 10 re-rolls on hand save exactly the same, and a fifth card saved no more (1.9 ± 0.9, with the bot's first rule). So the count is not the lever for the bot; a player who drafts for the map's threats may get more from it than the bot does. Not tuned further.

What was changed: the brainstorm's "1 re-roll at level 1, up to 3 at level 5" left one level with nothing new (1, 2, 2, 3, 3: as Deep Magazine's level 3 once was). Since re-rolls past two change nothing measurable, the re-rolls go **1, 2, 3, 4, 4** and level 5 adds the **fourth card**: every level brings something.

### Lifeboats: no ship saved, but runs won

Lifeboats keeps no ship afloat (the ship still sinks: score, wave records and the "ships sunk" count are unchanged); it takes half a ship off the loss tally for the first ship sunk in a wave. At level 5 that is 3.6 ships off the tally a run alone (7.2 boats used) and 2.5 on the player's Armory (5 boats), and it lifts the player's build from 45% to 62% of runs won (kit) and 52% to 62% (self): more than any other single number here. A weak run (no Armory) still loses: the limit is reached in a few waves.

### Salvage Crews: Scrap only

Saves no ship by design. +50% of a run's own Scrap at level 5 (waves, boss rounds, the clear, a first clear; a repeat card's 100 is not multiplied): 528 → 792 a run on the player's Armory with the counter kit. A level from 4 to 5 (800 Scrap) takes about one such run instead of one and a half. It takes the Supply slot, so it costs Stockpile's 6 ships while it rides.
