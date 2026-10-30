# V3 playtest round 2 — weapons drop as pickups

The player's notes after a few games:

> "Instead of the filling of the activation and hitting the buttons, just make
> them drops like the other drop pickups, but you only get them as an option if
> you unlock them and then you can upgrade them like before too. Then when you
> pick them up, they last for a default of 15 seconds and they consume the ammo
> like normal. … the issue I ran into was just too much managing with the
> activations hitting the buttons. It will be much better if it just replaces
> or enhances the normal main gun for that time."

## What changed

- **No charging, no buttons, no gestures.** The eight abilities are now
  weapons. Drafting one (the "unlock") puts it in the drop pool; drafting it
  again levels it up, to an evolution at level 3, as before. Three slots,
  swaps when full, Resupply: unchanged.
- **Weapons drop like the power-ups.** A kill that drops no power-up can drop
  a weapon you hold (at the power-up's own drop chance); after 15 s without
  one, the next kill does. One on the water at a time, floating 7 s.
- **A pickup loads the main gun for 15 s.** Every tap fires the weapon and
  spends a round like any shot (a dry rack is a dry click; Overdrive makes it
  free). The same weapon again restarts its clock; another one takes over.
- **Each weapon was reworked to fire from a plain tap** (the old swipes,
  holds and armed targets are gone):

| Was (button) | Now (loaded in the gun) |
|---|---|
| EMP Pulse: one press, drones on screen | EMP Rounds: each shell bursts as an EMP where it lands |
| Air Strike: swipe a line | each tap sends a jet down that row |
| Railgun: 2–3 beam taps | every tap is a beam, for 15 s |
| Tesla Arc: 6–9 s of arcing hits | 15 s of arcing hits; evolved, a free twin shot |
| Decoy Barrage: one press, every guided missile | Decoy Flares: each shell's flare pulls the homing missiles near it |
| Smoke Wall: drag a wall | Smoke Shells: each burst leaves a cloud; missiles flying through lose lock |
| Hellfire Salvo: hold and release | each tap is a burst of rockets |
| Sub Hunter: arm, then tap a launcher | a tap on a sub or truck destroys it; on a threat, a plain shot |

- **The screen**: the three buttons became a passive loadout (what can drop,
  which one is loaded, its seconds draining). A weapon pickup is a hexagon in
  its colour with its icon and name; a loaded weapon rings the carrier and is
  timed in the left rail; shells trail the weapon's colour.
- **Logs** are version 8 (no ability commands; a weapon is a pickup tap and
  ordinary taps).

### Reading of the brief

- "Only if you unlock them … upgrade them like before" is read as the draft:
  a weapon drops only once you have drafted it, and drafting it again levels
  it. (An Armory-style permanent unlock would be a separate change; see Next.)
- "Replaces or enhances the main gun": shells (EMP, flares, smoke) and Tesla
  are the main gun's interceptor plus an effect; Railgun, Air Strike and
  Salvo replace the interceptor; Sub Hunter adds a target. Every one fires
  from the tap the player was making anyway.

## Success criteria

1. Nothing to press besides the battlefield: no ability buttons, no arming.
2. Weapons appear as pickups, only those drafted, and load the gun for 15 s.
3. Weapon shots spend ammo exactly like plain shots.
4. Upgrades and evolutions still matter, and the card text matches the game.
5. The curve stays near round 1's: weapons carry a run that the bare gun
   can't, about as much as the abilities did.
6. Build, unit tests and browser tests pass; the screens read clearly on a
   phone.

## How it was checked, and what it found

**Balance passes** (the bot sweep; `tools/v3/sweep.ts` now reports the share
of wave time a weapon is loaded):

| Pass | Finding | Change |
|---|---|---|
| 1 | Average bot, maps 1 and 3: 17% clears (abilities: ~90%), weapon loaded 40% of the time | Stronger shots across the board; drops more often |
| 2 | Still 25%. Loss causes showed weapon drops had taken the power-ups' place: 18 power-ups a run instead of ~53, so far fewer repairs and Overdrives | Weapons got **their own roll**, on top of the power-ups |
| 3 | 54% on maps 1 and 3, all maps 43% (abilities: 41%); loaded 68%; Railgun 71% vs Decoy 38% | Railgun back down, weak ones up, drops slightly rarer (loaded ~60%) |
| 4 | Tier 20–40% (abilities: 29–50%); Air Strike, Smoke and Decoy weakest | Air Strike faster and wider, Smoke clouds bigger and longer jams |
| 5 | A full sweep: the average bot cleared 32–40% across the maps (round 1: 56%). Two 10-seed sweeps of nearly the same build differed by up to 30 points a cell, so 10 seeds is too noisy to tune one weapon by | Weapons drop a little more often (share 0.8 → 1, pity 18 → 15 s); judged on 20 seeds: 47% |

**Final measurement** (12 seeds a cell, fresh Armory; sharp / average / casual):

| Map | Round 1 (buttons) | Round 2 (drops) |
|---|---|---|
| The Strait | 90 / 90 / 0 % | 92 / 75 / 17 % |
| The Gauntlet | 50 / 20 / 0 % | 25 / 25 / 8 % |
| The Island | 90 / 90 / 0 % | 83 / 50 / 8 % |
| Harbor Mouth | 10 / 30 / 0 % | 25 / 25 / 8 % |
| The Archipelago | 40 / 50 / 0 % | 25 / 25 / 0 % |

A weapon is loaded 58–71% of wave time. With no weapons the average bot
clears 0%. Whole game from an empty Armory, investing in Wide Warhead:
sharp 1.2 h (8 runs), average 2.4 h (17 runs), casual 7.1 h and on map 3 at
the 60-run cap (round 1, one gun: sharp 1.1–1.6 h, average 0.8–1.4 h, casual
stuck on map 2–3).

**Unit tests** (`tests/v3/`, 40): drops only for drafted weapons, one at a
time, beside the power-ups; the 15 s clock, refresh and takeover; a
swapped-out weapon's pickup loads nothing; pickup life; every weapon spends a
round, clicks dry on an empty rack, is free under Overdrive; each weapon's
effect and evolution; a shell outliving its clock still bursts; the field
cleared between waves; replay of a watched run; card text against `AB`.

**Browser** (`npm run e2e:v3`, 38 checks, run twice on the final build): the
loadout shows three held weapons and no buttons; tapping a Railgun pickup
loads it for 15 s, lights its chip, times it in the rail and shows the
notice; a tap fires a beam and spends one round; Air Strike, Salvo, EMP,
Smoke and Decoy each load from their pickup and fire from a tap on open
water; the log is v8 with taps only; the draft asks for a weapon and its
cards say "Drops as a pickup · 15 s"; the loadout fits at 844×390; the
notice tray on all five maps at two phone sizes. Screenshots were checked
by eye (pickup, Railgun loaded, Air Strike run, draft, phone).

## Limitations

- These are **bot** measurements. The bots grab pickups and tap threats; they
  can't say whether 15 s feels long or short, or whether a weapon reads well
  in a busy wave. That needs the next real playtest.
- For the average bot the curve is **harder than round 1** on the Island and
  the Archipelago, and the whole game takes it longer (2.4 h vs 0.8–1.4 h);
  the casual bot does a little better. Each cell is ±15 points at 12 seeds.
  The knobs are `WEAPON.share`/`pity` (how often weapons drop) and `AB` (how
  hard they hit). Real play decides which way to move them.
- The gun has a weapon loaded about **two thirds** of each wave. If that makes
  weapons feel ordinary rather than a treat, drop them less often and make
  each one hit harder.
- **Decoy Flares** stays the weakest (it only answers homing missiles), as
  Decoy Barrage was.
- **The casual wall** from round 1 is still there (one Armory upgrade per run
  can't lift a slow, inaccurate player).
- Version-7 V3 logs (with ability commands) don't replay under version 8.

## Next

- Permanent weapon **unlocks** (Armory or map clears), if "unlock" should
  mean more than drafting.
- A longer clock as a weapon levels (15 s is the default).
- Fit the watch-mode personas' pickup habits to real logs.
