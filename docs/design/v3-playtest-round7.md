# V3 playtest round 7 — Battle Group's line, "MAX", and the Armory overhaul

The player's playtest on The Strait ("all working well") asked for three
things:

1. "On the max level for the frigate the third new ship will run over the
   other; it should just be a line, no need to overlap."
2. "For the power-ups let's not call the last level evolved, call it max, as
   that makes more sense to me."
3. "Let's also overhaul that armory too, it needs some more to it."

## 1. Battle Group sails in line

The frigates sail in from the left to stations at the lane's edges, ships 0
and 2 on the same edge. The third took the station *between* the other two,
so it sailed straight through the first one's spot. A test reproduced it on
the old code (the hulls came within 6 px).

Now, with three, the first in takes the far station and the third the near
one, and ships on one edge start 260 apart (a hull and its wake are ~210).
They sail in, hold and leave in line astern. The test plays Battle Group on
all five maps from pickup to leaving and requires 210+ px between ships on
the same edge; it fails on the old code. Seen in the browser at phone size:
two frigates on the top edge ~500 px apart, the third below.

## 2. "MAX", not "evolved"

The level-3 label is now **MAX** everywhere the player sees it: the loadout
chip ("MAX" instead of "EVO"), the draft badge for the card that takes a
weapon to level 3 (instead of "EVOLVES"), the held-weapon chips under the
cards ("Flak Curtain MAX"), and the line under a full hand ("All three at
max"). The weapon still takes its new name at MAX (Flak → Flak Curtain).
The browser suite checks the chips read MAX.

## 3. The Armory: three bays

Before: five upgrades for the main gun, one equipped per run. Now three
**bays**, each with its own upgrades. **A run takes one upgrade from each
bay**: round 1's rule ("they don't get all of them") holds per bay.

| Bay | Opens for | Upgrades |
|---|---|---|
| **Gun** | open | Quick Reload, Wide Warhead, Fast Motors, Deep Magazine, Proximity Fuse (as before) |
| **Hull** | 250 salvage | **Armor Plating**: 8% a level of hits on a ship or the carrier glance off. **Point Defense**: the carrier fires a free interceptor at the nearest threat in reach. **Damage Control**: every damaged hull, ships and carrier, gets a point back every 10 s (4 s at level 5). |
| **Supply** | 600 salvage | **Long Loads**: a weapon pickup stays in the gun 4 s longer a level. **Supply Lines**: weapons drop more often, on a shorter pity clock. **Stockpile**: power-ups drop more often and the timed ones last longer. |

The screens:

- **The Armory** has a tab per bay showing what it has equipped, or its
  price while shut. A shut bay lists what it holds and opens for salvage.
  On a phone, a bay of three keeps each upgrade's one-line description.
- **Choose your loadout** (when a map starts) has a row per open bay: the
  upgrades bought, and "none".
- **The menu strip** shows the loadout.

Old saves keep their equipped gun upgrade.

### Tuning: every upgrade must do something (the Cryo rule)

Each upgrade was measured alone: average bot, fresh Armory, weapons drafted
in a random order per seed, 60 runs across the five maps, ±12 points. The
base gun clears 57% this way.

| Finding | Fix | After |
|---|---|---|
| Armor Plating as **+2 carrier hull a level** changed *nothing*: identical runs to no upgrade, because runs are lost to sunk ships, not to the carrier | Ships got +1 hit too | 57% → 82% at level 2, then identical to level 5: one hit is too coarse to level |
| Armor Plating as whole hits couldn't scale | A share of hits glance off (8% a level), on ships and the carrier, on its own seeded random stream | 57% / 70% / **85%** at levels 1 / 3 / 5 |
| Damage Control patching the worst hull one point every 10–24 s: 50–55%, no better than nothing | Every damaged hull gets a point, every 10 s → 4 s | 62% / **75%** |
| Point Defense: 93% at level 5 (Wide Warhead: 67%) | Slower and shorter: every 3.5 s, reach 280 → every 2 s, reach 360 | 63% / **82%** |
| Supply Lines: 95% at level 5 | 1.08× → 1.4× drops, pity 26 → 20 s | **83%** |
| Long Loads at +2 s a level: 48% / 68% | +4 s a level (35 s at level 5) | 60% / **67%** |
| **Head Start** (draft a weapon before wave 1; level 3 starts it at MAX): 57% at its top level, the same as nothing. By the late waves that decide a run, every held weapon is maxed anyway | **Replaced by Stockpile** (power-ups drop more often and last longer) | 62% / **73%** |

Stacked: level 2 in all three bays clears 85%; everything at level 5,
98–100%.

**The whole game** (all five maps cleared in order from an empty Armory,
buying the cheapest next step of Wide Warhead + Point Defense + Supply
Lines; one chain of runs per skill):

| Player | Gun only (as before) | Three bays |
|---|---|---|
| Sharp bot | 1.0 h, 6 runs (round 6) | 1.4 h, 9 runs |
| Average bot | 1.0 h, 6 runs (round 6) | 1.3 h, 8 runs |
| Casual bot | 7.9 h, the 60-run cap, stuck on map 3 (re-measured on this build) | **3.2 h, 22 runs, all five maps** |

A fresh Armory plays as before (the full sweep's clear table matches round
6's within its noise). What changed is how far salvage carries a player who
keeps losing, which is the Armory's job. The sharp and average lines are
one chain each, so they are within noise of round 6's.

## Checks

- `npm test`: 893 pass (V3: 57). New tests:
  - Battle Group's no-overlap test on every map;
  - bays, opening, buying, one upgrade a bay, and old-save migration;
  - each Hull and Supply upgrade's effect;
  - a run with all three bays replaying exactly.
- `npm run e2e:v3`: 48 checks. The new ones:
  - buys a gun level;
  - opens the Hull bay and buys Point Defense, checking one upgrade is
    equipped per bay;
  - checks the Supply bay is out of reach;
  - the loadout picker;
  - the run's Point Defense;
  - the MAX chips;
  - log version 11.
- Browser, at 1280×720, 844×390 and 667×375, with a poor save (an old
  gun-only one) and a rich one:
  - every Armory tab, the shut bay, the loadout picker, the menu: no
    scrolling, nothing clipped or off screen, no page errors;
  - the frigates' line;
  - MAX on chips, badge and slots;
  - Point Defense shots, "+1" patches and glancing hits in a live wave.

Fixed along the way:

- With all five maps unlocked, the menu was 6 px too tall for a 667×375
  phone. This predated the overhaul and is fixed.
- Head Start's level-2 cards said LV 1/3. Moot now that Head Start has been
  replaced.

## Limitations

- The tuning is the bot's. A human loses the carrier more often than the
  bot does, so Armor Plating and Damage Control may be worth more to a
  person than the table says.
- Point Defense's shots look like the gun's own (a launch from the carrier);
  "+1" and the glance ring are small on a phone.
- The upgrades were measured one at a time and in two stacks, not in every
  combination.
