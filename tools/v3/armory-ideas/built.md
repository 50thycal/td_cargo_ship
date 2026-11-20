## What was built (2026-11-20, LOG_VERSION 33)

From the player's marks on the review page (round ar1). Branch `claude/v3-armory-build`.

![The Armory: Gun bay, a card ready to level](img/armory/phone-gun-ready.png)

### The lift, as measured

| Upgrade | Level 1 → 5 before | Level 1 → 5 now |
| --- | --- | --- |
| Quick Reload | 6% faster a level, −30% (0.95 s a round) | 8% faster a level, −40% (0.81 s a round) |
| Stockpile | 115% → 175% drops, 110% → 150% time | 145% → 325% drops, 130% → 250% time |
| Long Loads | 19 → 35 s a weapon | 19 → 35 s a weapon, and every weapon or boost pickup refills 2, 3, 4, 5 rounds, the whole rack at level 5 |
| Deep Magazine | 7, 8, 8, 9, 10 rounds | 7, 8, 9, 10, 11 rounds (level 3 counts now) |
| Armor Plating | unchanged | unchanged |

No level of any upgrade got worse (a test checks each level against the old numbers). In code: `RELOAD`, `POWER_SHARE`, `POWER_TIME`, `MAGAZINE`, `RACK_REFILL` in `src/v3/data/armory.ts`; the refill is read in `collect()` in `src/v3/sim/game.ts` (a weapon pickup, which is also how a boost starts).

### Scrap

- **Earning:** 40 a wave cleared (waves 1–10), 50 a boss round survived, 150 for clearing the map, 250 for a first clear, 100 for a card found that you already hold. A lost run keeps all of it. A cleared map played on into endless banks its waves once.
- **Cards:** still found at random at the end of a run (1, +1 for a clear, +1 for a first clear; from all 11 upgrades). A new card joins at level 1; a duplicate pays 100 Scrap, never a level.
- **Levels 2–5:** bought in the Armory: 150 / 300 / 500 / 800 Scrap.
- **In the run:** a SCRAP read-out in the HUD under the score (nothing to tap). **At the end:** "+N scrap" beside the score, and a line by line ledger (waves, boss rounds, map cleared, first clear, repeat cards, banked).
- **The Armory screen:** the bank in the head ("420 scrap · 14 cards found"). Tap a card you hold: the bar under the row shows its level and next level, **Equip** (or Take off), and **Level up · LV n** with its cost; greyed with "need N more" when short, "Max level" at 5. Each held card also shows its next cost (amber when you can pay). The menu's Armory count glows amber when a level can be bought.
- **Saves:** Armory save version 3. A version 2 save (round 7's cards) keeps every level and card count, Scrap starts at 0. A Deep Magazine equipped in the Gun bay moves to Supply if Supply is free (Supply's own card wins otherwise), and an emptied Gun bay takes the best gun card held. Saves older than version 2 are cleared as before. Broken Scrap values read as 0.
- **Free Play, the Test Lab, replays and developer runs** earn no Scrap and show no counter.

![A lost run's Scrap](img/armory/phone-result.png)

### Bays and names

- **Gun** (4): Quick Reload, Wide Warhead, Fast Motors, Proximity Fuse. **Hull** (3): Armor Plating, Deck Guns, Damage Control. **Supply** (4): Deep Magazine, Long Loads, Supply Lines, Stockpile.
- The bay keeps its name, **Supply** (the player turned down "Stores"); its line now reads "Rounds, weapon drops and power-ups".
- The Armory's Point Defense is shown as **Deck Guns**; its id stays `pointdef` (saves, logs, bot presets). The weapon Point Defense keeps its name.

![The Supply bay](img/armory/phone-supply.png) ![The Hull bay, a level short of Scrap](img/armory/phone-hull-short.png) ![The HUD's Scrap](img/armory/phone-hud.png)

Screenshots: `node e2e/v3-armory-shots.mjs` (844×390, 667×375 and 1280×720; `SHOT_DIR` defaults to `docs/design/img/armory`).

### Measured on the real game code

`tools/v3/armory-ideas/check.ts` plays plain Armory loadouts as the game reads them (no overrides), summed by `check-sum.mjs` into `check-results.json`. Same play as the lift: the "you" bot, the map's counter kit, every wave played, the five chapter 1 maps, 12 seeds, paired with No Armory.

**The lift matches the harness exactly.** The game changed between the lift's measurement and this build (Deck Guns 5 saved 8.2 then, 6.7 now; No Armory 25.1 then, 24.8 now), so `lift.ts` was played again on the same game just before the build (`lift-rerun-results.json`) and compared run for run:

| Config | Lift harness, same game (ships lost / saved) | Real code (ships lost / saved) | `lift-results.json` (saved) |
| --- | --- | --- | --- |
| Quick Reload 5 | 19.4 / 5.3 | 19.4 / 5.3 ± 1.0 | 6.7 |
| Stockpile 5 | 18.6 / 6.2 | 18.6 / 6.2 ± 1.1 | 5.8 |
| Long Loads 5 | 19.2 / 5.6 | 19.2 / 5.6 ± 1.0 | 5.2 |
| Your usual build (QR 5, DC 4, SP 5) | 10.0 | 10.0 (was 11.0 before the lift) | 10.3 |
| Best build (WW 5, AP 5, SP 5) | 5.6 | 5.6 (was 6.9) | 5.8 |

All within one standard error of `lift-results.json`. Quick Reload's 5.3 is the furthest (6.7 then); it is the game's drift, not the build (the harness gives the same 5.3 today).

**New Deep Magazine 5 (11 rounds):** 6.1 ± 1.1 ships saved alone. With Quick Reload 5 (they can now ride together): 8.2 saved at 11 rounds, 8.4 at 10: the 11th round changes nothing. The masher bot gains more from the pair (13.1 saved) than "you" (8.2), and with it loses 15.4 ships a run against "you"'s 16.6: within noise, but the gap is the sign round 6 watched for.

**Marrow with the best build:** 1.7 ships lost a run (12 seeds, before round 8) and 1.8 after round 8's Marrow changes (24 seeds, won 100%): still just under the "nearly trivial" line of 2, as the brainstorm warned.

**Supply Lines, again on more seeds** (48 seeds a map, 240 runs a config; not changed): 3.7 ± 0.5 ships saved with the counter kit, 3.1 ± 0.5 with the bot drafting for itself. The combo sweep's 4.9 and 0.8 (4 seeds) were noise: it is a steady ~3–4 on every map (2.9–4.1), now the weakest card in the Armory (the lifted three save 5.3–6.2).

**Bot win rates with the player's Armory** (`tools/v3/map-report/quick.ts --armory=player`, 60 seeds, after round 8; `quick-before-after.txt`):

| Map | Before | After |
| --- | --- | --- |
| Kesh | 27% | 40% |
| Marrow | 85% | 93% |
| Island | 38% | 35% |
| Behemoth | 30% | 38% |

The player's latest Armory (Wide Warhead 5, Deck Guns 4, Supply Lines 3) plays exactly as before: none of its numbers changed. The bot presets (`PLAYER_ARMORY`, `LATEST_ARMORY` in `tools/v3/bot-fit/measure.ts`, map-report `--armory`) keep their ids and levels, so they still mean the player's levels, now with the lifted numbers.

### Tools on Scrap

`tools/v3/sweep.ts` and `tools/v3/maps-plan/campaign.ts` model a career with Scrap: cards found with `findCards`, Scrap from `scrapFor`, spent with `spendScrap` on the loadout first. `lift.ts` measured the pre-build numbers and is kept as the record; re-check with `check.ts`.

### Checks

`npx tsc --noEmit`; `npx vitest run --exclude '.claude/**'` (new tests in `tests/v3/v3.test.ts`: the lift values and no level worse, Deep Magazine's rounds, Deck Guns, the rack refill in play, finding cards, Scrap earning, spending and costs, the version 2 save migration); `npm run v3:map-lab -- baseline` (rewritten for 33, replays exactly); `e2e/v3.mjs` (the save migration, the Armory with Scrap: levels a card, checks the cost and the greyed next level, equips, Deck Guns, the HUD's Scrap, a lost run's Scrap on the result screen).
