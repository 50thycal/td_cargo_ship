# V3 playtest round 7 — Battle Group in line, "MAX", Armory cards, Free Play

The player's playtest on The Strait ("all working well") asked for:

1. "On the max level for the frigate the third new ship will run over the
   other; it should just be a line, no need to overlap."
2. "For the power-ups let's not call the last level evolved, call it max, as
   that makes more sense to me."
3. "Let's also overhaul that armory too, it needs some more to it." Then,
   finishing the thought: "each item should have its own card with the
   information on it about what it does. It should look like a weapon power
   up… they can upgrade them just like how they are, but they need to get
   that card at the end of the game. They don't get to pick which ones…
   to get the next reload, you need to win another reload from a random
   drop. I think that's kind of how the Survivor.io one works."
4. "A free play mode where I could test out all the new weapons on any
   level and any level of upgrade… on a challenging level, good enough to
   test everything out: think level 8 or 7 on the Strait."

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

## 3. The Armory: three bays of cards

Before: five upgrades for the main gun, bought with salvage, one equipped
per run. Now three **bays**, each with its own upgrades, and **a run takes
one upgrade from each bay**: round 1's rule ("they don't get all of them")
holds per bay.

| Bay | Upgrades |
|---|---|
| **Gun** | Quick Reload, Wide Warhead, Fast Motors, Deep Magazine, Proximity Fuse (as before) |
| **Hull** | **Armor Plating**: 8% a level of hits on a ship or the carrier glance off. **Point Defense**: the carrier fires a free interceptor at the nearest threat in reach. **Damage Control**: every damaged hull, ships and carrier, gets a point back every 10 s (4 s at level 5). |
| **Supply** | **Long Loads**: a weapon pickup stays in the gun 4 s longer a level. **Supply Lines**: weapons drop more often, on a shorter pity clock. **Stockpile**: power-ups drop more often and the timed ones last longer. |

**Every upgrade is a card, won, not bought** (the rest of the player's
thought):

- **What a run wins:**
  - 1 card for a run that cleared at least 3 waves (a run quit at once wins
    nothing);
  - +1 for clearing the map;
  - +1 more the first time it is cleared.

  Each card is drawn at random from the upgrades not yet maxed. A card held
  already adds a level ("to get the next reload, you need to win another
  reload"). Salvage, the old currency, is gone. The first build of the bays
  opened them for salvage; with cards, all three are open from the start.
- **The cards** are drawn like the weapon draft cards, in the bay's colour:
  - the bay;
  - a badge (EQUIPPED, EQUIP, NOT FOUND, or NEW / LV n when won);
  - art made for each upgrade;
  - its name and level pips;
  - what it does;
  - its number now and at the next level.
- **The result screen** deals in the cards a run won. Two of one card show
  NEW, then LV 2.
- **The Armory** shows a bay at a time as a row of cards: tap one you hold
  to equip it; ones not found yet are greyed. Its tabs show each bay's cards
  found and the one equipped.
- **Choose your loadout** comes up when a map starts: a row per bay with
  cards held.
- **The menu strip** shows the cards found and the loadout.
- **Old saves** keep the levels they bought and their equipped gun.

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

**The whole game** (all five maps cleared in order from an empty Armory;
one chain of runs per skill):

| Player | Gun only, salvage (as before) | Three bays, salvage (first build) | Three bays, cards won at random (final) |
|---|---|---|---|
| Sharp bot | 1.0 h, 6 runs (round 6) | 1.4 h, 9 runs | 1.3 h, 8 runs, 18 cards |
| Average bot | 1.0 h, 6 runs (round 6) | 1.3 h, 8 runs | 1.0 h, 6 runs, 16 cards |
| Casual bot | 7.9 h, the 60-run cap, stuck on map 3 | 3.2 h, 22 runs | **2.4 h, 16 runs, 26 cards, all five maps** |

The cards run takes the highest-level card of each bay into each run. A
fresh Armory plays as before (the full sweep's clear table matches round
6's within its noise). What changed is how far the Armory carries a player
who keeps losing, which is its job. The sharp and average lines are one
chain each, so they are within noise of round 6's.

## 4. Free Play

**Free Play**, on the menu, sets up a test run:

- any map and any start wave (default: wave 7 on The Strait);
- three weapons, each at LV 1, LV 2 or MAX;
- one Armory card from each bay, at any level;
- optionally, frequent weapon drops: one at least every 8 s, at twice the
  chance, so a weapon can be tried over and over.

The setup is kept for next time.

**Nothing in it counts**: no records, unlocks or Armory cards. The HUD says
FREE PLAY, and the result offers "Play it again" or "Change setup". Drafts
between waves work as usual. Its play log records the setup, and a test
replays a watched free-play run exactly.

## Checks

- `npm test`: all pass (V3: 58). New tests:
  - Battle Group's no-overlap test on every map;
  - the cards a run wins and how they draw and stack;
  - the result recorded with its cards;
  - one card a bay, and old-save migration;
  - each Hull and Supply upgrade's effect;
  - a run with all three bays replaying exactly;
  - Free Play's setup, and a watched free-play run replaying exactly.
- `npm run e2e:v3`: 55 checks. The new ones:
  - the Armory's cards (greyed until won, each saying what it does);
  - equipping a gun and a hull card, with nothing to buy;
  - the loadout picker;
  - the run's Point Defense;
  - the MAX chips;
  - a lost run that cleared 3 waves winning one card, shown as a card;
  - Free Play (wave 7, Battle Group, Armor Plating 5, frequent drops, the
    HUD tag; it wins nothing and offers "Play it again"; its setup fits a
    phone);
  - log version 11.
- Browser, at 1280×720, 844×390 and 667×375:
  - the menu, every Armory bay's cards, the loadout picker, the result
    with three cards won, and the Free Play setup: no scrolling, nothing
    clipped or off screen, no page errors. Fixed in the pass: three won
    cards overflowed a phone, so their description waits for the Armory;
    three equipped cards wrapped the menu's strip, so the loadout is cut to
    one line; a narrow card wrapped "LV 2/5";
  - the frigates' line;
  - MAX on chips, badge and slots;
  - Point Defense shots, "+1" patches and glancing hits in a live wave.

Fixed along the way:

- With all five maps unlocked, the menu was 6 px too tall for a 667×375
  phone. This predated the overhaul and is fixed.
- Head Start's level-2 cards said LV 1/3. Moot now that Head Start has been
  replaced.
- Two salvage-era pieces were removed with the currency: the bay prices and
  the Upgrade buttons.

## Limitations

- The tuning is the bot's. A human loses the carrier more often than the
  bot does, so Armor Plating and Damage Control may be worth more to a
  person than the table says.
- Point Defense's shots look like the gun's own (a launch from the carrier);
  "+1" and the glance ring are small on a phone.
- The upgrades were measured one at a time and in two stacks, not in every
  combination.
- Random cards can be streaky: a player can win the same Hull card three
  times in a row while wanting another. Nothing evens it out yet (Survivor.io
  has duplicates merge into something else; a pity rule is a candidate).
