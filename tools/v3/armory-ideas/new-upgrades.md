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

## Lifeboats and Quartermaster reworked (2026-11-21, LOG_VERSION 44)

The player's answers on the hub. Lifeboats: "alternate the repair and extra life options between levels". Quartermaster: one re-roll, two re-rolls, a golden bomb ("a use whenever bomb … a golden one that stays there so they can use it when they want"), three re-rolls, then four cards and a free level-up. Branch `claude/v3-armory-rework`; numbers in `src/v3/data/armory.ts`. The half-loss rule above is gone.

| Level | Lifeboats | Quartermaster |
| --- | --- | --- |
| 1 | between waves the carrier mends 66% of its missing hull | 1 re-roll a run |
| 2 | the carrier and every ship afloat mend 66% | 2 re-rolls |
| 3 | level 2, and a Lifeboat card (+1 life) in the draft after every 3rd wave | 2 re-rolls and a golden bomb (the Nuke, tapped any time, once a run) |
| 4 | every hull mended to full between waves; the card stays | 3 re-rolls, the bomb |
| 5 | level 4, and the run starts with +1 life (proposal: the player didn't say) | 3 re-rolls, the bomb, 4 cards a draft, one free weapon level-up a run |

### How it was measured

`new-upgrades.ts` as above (the "you" bot, the five chapter 1 maps, seeds 900–911, 60 runs a config, paired with level 0), self-drafting only (a forced kit replaces the hand: no re-roll, no Lifeboat card, no free level-up), in two modes:

- **self** (tough, every wave played; carrier can't sink): ships saved a run. "Won" here is read off the losses, with the run's extra lives added to the limit.
- **normal** (new): the real rules, the loss limit and a carrier that sinks. Lifeboats' carrier mend and its lives, and the bots' use of the golden bomb (kept for a pressed or late run), only count here. Read its won share; its "ships lost" stop where the run ends.

Runs: `rework-runs.jsonl`; summary: `rework-results.json` (`new-sum.mjs` now also folds `lives`, `bombs`, `bombWave`, `free`, and `wonGain` ± se, paired against no card).

### Results (level 5 against level 0)

| | Ships saved, alone | Ships saved, player's Armory | Won, alone (normal rules) | Won, player's Armory (normal rules) |
| --- | --- | --- | --- | --- |
| Lifeboats 5 | 2.0 ± 0.4 | 0.0 (Damage Control 4 already mends) | 3% → 15% (+12 ± 4) | **50% → 67% (+17 ± 5)** |
| Quartermaster 5 | 4.7 ± 1.1 | 2.1 ± 0.7 | 3% → 3% | **50% → 67% (+17 ± 8)** |

- **Lifeboats** saves few ships (a mended ship still sinks to a later hit), but wins runs: an extra life is a ship the run can lose. The bot holds 1.4 extra lives a run under the real rules (the start's one, and a Lifeboat card in 4 runs of 10: it takes the card when 3 or fewer lives are left). Old version (half loss) on the player's Armory: 52% → 62%. The other upgrades' 5–8 ships saved is not its measure; by won runs it is with the best.
- **Quartermaster** almost doubles its old lift (2.5 → 4.7 alone; 0.9 → 2.1 on the player's build). Every run sets the golden bomb off (average wave 9: the bots keep it for a boss round, a pressed run or wave 8 on) and spends the free level-up; re-rolls spent 1.8 of 3. Alone it lifts ships, not wins (the bare gun still loses by wave 10); on the player's build +17 points of wins.
- Per map, ships saved alone (Lifeboats / Quartermaster): strait 2.3 / 4.9, gauntlet 1.7 / 4.9, harbor 2.1 / 7.7, kesh 0.9 / 4.2, marrow 3.2 / 1.8.
