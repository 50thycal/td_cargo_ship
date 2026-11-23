# Straitwatch V2: playtest round 5

Two full games on round 4, played on an iPhone:

| Game | Result | What sank ships |
|---|---|---|
| Strait | Lost on wave 10. 6 ships sunk; carrier finished on 5 HP. | Ballistic 3, guided 1, strafer 1, bomber 1 |
| Gauntlet | Lost on wave 7. 8 ships sunk. | 4 of the 8 sank within 0.6 s in wave 7 |

Both logs replay exactly (`npm run v2:replay`).

The player said it "plays better now". Their notes:

1. Too many ships at once; slowing the flow lets you hold an area, which gives formations and speed a use.
2. On Gauntlet the banners sat mid-screen; they should be at the bottom.
3. Repair feels a little overpowered.
4. Sometimes the game didn't fill the iPhone: a black strip at the bottom.
5. The escort ship was jumpy; it should stay put once it arrives.
6. Rebalance anything the games show.

## What the logs show

A step-by-step replay probe measured the following.

**Ships on screen.** Both games went to max flow within 22 s.
- Strait averaged 16.5 ships on screen; Gauntlet averaged 22.8. Both peaked at 27.
- On Strait the player dropped the flow at wave 7 and held about 11 ships for the rest of the game.
- The player's own read is right: max flow trades control for the ×3 score multiplier. That is the intended choice, so the flow was not changed.

**Worst moments: sub salvos on a packed Box.**
- Gauntlet wave 7: 4 ships sank within 0.6 s, with 26 on screen in Box.
- Strait wave 3: 3 ships sank in under a second, with 22 on screen in Box.
- Cause: a ballistic dealt its full 2 damage to every hull in its blast. In Box the armour cuts the targeted ship's hit to 1, but neighbours still took 2 each, and Box's splash reaches 1.8× further.

**Repair.**
- 15 collected across the two games, healing 22 HP.
- It was 23% of all drops, and it often lifted a ship from 1 HP back to full.

**Frigate** (Gauntlet, level 2).
- It moved on 45% of all steps, reversed direction 125 times, and was on station only 34% of the game.
- Level 2 steered toward the average position of the threats, and that point jumps around as threats spawn and die.

**Screen size.**
- Both Strait sessions recorded an 874×340 window; the Gauntlet game recorded 874×402 on the same phone.
- So the Strait games started with Safari's toolbar showing. The game root is a fixed box, and iOS can leave it at 340 px after the toolbar hides. The layout code read the root's own height, so even the per-frame check saw the stale 340.

## Changes

| Issue | Change |
|---|---|
| Gauntlet banners mid-screen | Callout moved to the bottom edge, between the two south-shore bases (910, 865), like every other map. Screenshot checked: the wave banner and a raid warning sit on the shore without covering a base. |
| Repair a little strong | Drop weight 30 → 20, so a third fewer repairs. Carrier repair 3 → 2. A ship repair still heals 2. |
| Jumpy frigate | No more roaming. It eases to a stop at its station and holds there. Level 2 is now "rack 5, reloads as fast as the carrier". |
| Black strip on iPhone | The layout now reads `innerHeight` / `visualViewport` and pins the root to that size, so it can't lag behind the visible area. |
| Packed-formation wipes | Ballistic splash onto neighbours now deals 1 damage (`BALLISTIC.spill`); the ship it lands on still takes 2. |

`LOG_VERSION` is now 5.

## Checks

- **Tests:** 810/810 pass.
  - New frigate tests: it never moves once on station, even with threats on both sides; it approaches without overshoot; level 2 reloads at the carrier's rate.
  - The splash test checks full damage on the target and 1 on a neighbour.
- **Browser (e2e):** `e2e:v2` gained a check that loads at 874×340, grows to 874×402 with every resize listener disabled, and confirms the battlefield fills 402 px. It passes, as do `e2e:v2:log` and the V1 smoke test.
  - Limit: Chromium can't reproduce iOS Safari's stale fixed box, so this guards the fix but doesn't recreate the original fault.
- **Formation lab** (defended by the average bot, against a barrage):

  | Formation | Sinks per raid | HP lost |
  |---|---|---|
  | Box | 0.08 (was 0.42) | 3.4 |
  | Spread | — | 1.2 |
  | Column | — | 5.5 |

  Spread still halves barrages. Box's weak spot is now mainly strafing runs (10.8 HP lost).
- **Balance matrix** (max flow, 10 seeds per map, clears out of 50 for sharp / average / spammer):

  | Card picks | Round 3 | Round 4 | Round 5 |
  |---|---|---|---|
  | Usual list | 40 / 37 / 11 | 38 / 35 / 11 | 39 / 39 / 12 |
  | Random | 42 / 38 / 20 | 34 / 33 / 6 | 36 / 36 / 8 |

  Slightly easier, closer to round 3.
