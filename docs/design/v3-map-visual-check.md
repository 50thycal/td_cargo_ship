# V3 map visual check: what follows a map's water

## What prompted it

The player's two new runs were both on the Kesh Hook (map 2): two wins, no
ships lost. They rated the run difficulty 2, fun 3, intensity 1. Both notes
they left, made with the new pause-and-note button, were visual:

- wave 1, 8 s in: "We should have the enemy jets follow the curve here and
  actually make a banking turn around the bend";
- wave 6, 56 s in: "The frigate do not follow the actual water path and just
  overlaps on the land and aircraft."

The ask: "Run the check in all maps making sure frigates are working and
anything else that depends on the maps like the truck path, airplane paths
and what not… this is really a UI and visual check." The work had to go
through at least five build–test–review–improve cycles.

## What success looks like (the player's view)

1. **Frigates sail the water on every map**, at every level:
   - in from where the convoy comes in;
   - along the lane, round its bends;
   - to stations at the lane's edge, then off again;
   - never over land, never on the carrier, never on each other.
2. **Enemy jets follow a curved lane round its bend and bank into the
   turn.** Their warnings show the route they will fly, and they still hit
   the ships on it. Straight maps are unchanged.
3. **Everything else that depends on the map's shape keeps to its side of
   the coast:**
   - truck roads on enemy land and clear of the silos;
   - pop-up trucks stopping at the shore;
   - submarines on open water off the lanes;
   - coves and mine chutes at the water;
   - the Dreadnought on water.
4. **Readable on the player's phone** (874×402) and on the smallest
   landscape phone (667×375): no notice covers the carrier.
5. **Nothing regresses:**
   - tests and browser checks pass;
   - balance moves only where the old behaviour was a bug.

## Cycle 1: frigates follow the lane

**Baseline.** A new audit, `tools/v3/route-audit.ts`, sails Frigate Escort
on all 20 maps at levels 1–3, in, on station and out. It checks each hull as
a box against the land, the carrier and the other frigates.

It found **61 problems on 14 maps**, and screenshots confirmed them:

- on the Kesh Hook the frigates left due east across the land at the bend;
- on Saltgate they drove through the lock walls and onto the banks;
- on Lee of Marrow the third frigate's station was on the carrier.

The cause: frigates sailed a straight line from x = -120 to a station, and
due east to leave, whatever the lane did.

**Fix.** A frigate now sails its lane like the convoy does: a distance
along it, and an offset across.

- **Stations are chosen on screen**, in a stretch at least 70 wide (beside
  the convoy), 200 clear of the carrier, and 280 apart along each edge (180
  where the water is short).
- **The whole hull stays inside the lane**, measured over its length and the
  stretch it is about to sail into, so it moves in before a narrows.
- **Past the carrier** a frigate takes midstream.
- **The hull turns with the lane**, at most 2.6 rad/s.

**Re-test found, and fixed:**

| Problem | Fix |
|---|---|
| Saltgate's frigates sailed through closed lock gates. | Cycle 5 settles this: priority passage. |
| Leaving through the Needle's single-file narrows, two frigates converged on each other. | Line astern: a frigate keeps 190 behind the one ahead on its line, and in a single-file stretch waits regardless of side. |
| With two frigates, the one going furthest arrived last. | The first one in takes the furthest station. |
| An instant 180° flip, then a pivot that swept the bank and the other hulls. | Replaced; see cycle 5. |

**Result:** 0 problems on 20 maps × 3 levels. Contact sheets of all 20 maps
(in, on station, out) checked by eye.

## Cycle 2: jets follow the bend

**Baseline (screenshots, Kesh).**

- The strafing warning band ran straight across the bend and onto enemy
  land.
- The jets flew it straight, over the land.
- The bomber's line crossed the bend.

**Fix.** On a curved lane (the Kesh Hook, the Sharra Delta's three forks):

- **Flight path:** a strafing jet flies the lane's centre line. A bomber
  flies 70 off its edge.
- **Banking:** the airframe banks into the turn. Its wings foreshorten and
  the low wing shades.
- **Contrails** curve behind it.
- **The warning** draws the band round the lane, with chevrons where it
  comes on screen pointing its way.
- **Hits are measured along the lane on its own lane**, so the guns still
  rake ships after the bend. Bots read the time to impact along the route.

Straight maps fly exactly as before.

**Re-test found, and fixed:** Kesh's bomber took the outer side of the
turn, half off the bottom of the screen and over the enemy road. A bomber
now flies whichever side keeps more of its route on screen (the inside of
the turn).

**Checks:**

- a test strafes ships on both reaches of the Kesh turn;
- the warning time counts along the bend;
- a straight-map jet flies straight;
- zoomed frames show the bank.

## Cycle 3: trucks, subs, bombers, coves

**Audit** (`auditMap`), on every map:

- runner roads on enemy land and 30+ clear of silos;
- pop-up trucks stopping at the shore;
- sub spots on water, off the lanes, clear of the carrier;
- bomber lines mostly over water and off the lanes;
- coves and chutes at the water;
- the Dreadnought's track on water;
- silos on enemy land, posts on friendly land, the carrier on water.

It found 12 problems. Zoomed screenshots confirmed:

| Map | Problem | Fix |
|---|---|---|
| The Archipelago | The pop-up trucks drove out of the islet and stopped in the sea: the caves sat 20 px from the shore and a truck is 51 long. | The caves move up each islet, and the truck stops with its bumper at the shore. |
| Citadel of Vey | The same. | The truck stops at the shore. |
| The Sharra Delta | The ridge road ran over both silos and began in the river. | It now runs along the island's north edge. |
| The Sharra Delta | The north road ran on the waterline east of x = 950. | It runs 20+ px inland. |
| Smugglers' Coves | The road cut across the top of a cove's inlet. | It climbs over each cove, 30+ clear of the water. |

Also found: the audit's own point-in-polygon test used the even-odd rule
where the canvas fills land with non-zero. It now matches the canvas.

**Accepted:** bomber lines on the Needle and Saltgate cross 39–47% land. An
aircraft can fly over land, and it still reads there.

## Cycle 4: the maps on the phone

- **Live waves on all 20 maps at 874×402:** each map's features read. (A
  "paused" frame on Dreadnought Pass was the script tapping the boss before
  it was on screen, landing on the pause button.)
- **At 667×375, the notice tray covered the carrier on Tidewater Flats.**
  Running the browser suite's tray check on all 20 maps at that size found
  **13 of 20** did. The suite only checked 874×402 and 844×390, where the
  fixed-size cards stand shorter over the map.
- **Fix:** the tray keeps clear of the carrier (its deck and the rack above
  it) at any size. It takes the wider side and shows one card at a time if
  narrow.
- **Re-check:**
  - 20/20 maps pass at both 667×375 and 874×402;
  - screenshots of Tidewater, Marrow and the Behemoth Run;
  - `e2e:v3` now checks every map at 667×375 too.

## Cycle 5: regression and balance

**Bot comparison** (average bot, the same seeds, before and after this
round):

| Map | 64 seeds before | After |
|---|---|---|
| Saltgate Canal | 23% | 11% |
| Dunmar Crossing | 11% | 8% |
| The Needle of Bosk | 19% | 16% |
| The Sharra Delta | 5% | 3% |

Only Saltgate's drop was beyond noise, so its runs were split by frigate
use:

| Saltgate runs | Before | After cycle 1 |
|---|---|---|
| With frigates | 38% | 12% |
| Without frigates | 13% | 13% |

The old frigates had been strong there by driving through the lock walls.
Kept out of the locks, they were worth nothing.

| Tried | Result |
|---|---|
| Frigates hold the two outer basins, the east one coming in against the shipping. | 13% |
| **Priority passage:** a lock gate swings open for a frigate under way (the convoy still waits its turn). Frigates take station in the Bitter Lake again. | **27% with frigates** |

The re-test frames found two more problems, both fixed:

- a gate opened only once the bow was already at it; it now opens a hull's
  length ahead;
- a frigate on station short of lock B held that gate open; only a frigate
  under way opens one now.

**Final comparison** (64 seeds a map, the same seeds before and after):

| Map | Before | After | Ships lost a run |
|---|---|---|---|
| The Kesh Hook | 98% | 100% | 1.02 → 1.25 (jets now strafe both reaches) |
| The Sharra Delta | 5% | 3% | 5.88 → 6.00 |
| Saltgate Canal | 23% | 19% | 5.23 → 5.42 |
| The Needle of Bosk | 19% | 16% | 5.31 → 5.38 |
| Dunmar Crossing | 11% | 8% | 5.72 → 5.72 |
| Lee of Marrow | 97% | 97% | 1.22 → 1.16 |
| The Gauntlet | 81% | 80% | 2.48 → 2.47 |
| The Strait | 95% | 97% | 1.36 → 1.23 |

Every change is within the run-to-run noise at 64 seeds (about ±7 points).

## Checks

- **`npm test`:** all pass. New:
  - `tests/v3/routes.test.ts`:
    - the frigate audit, 20 maps × 3 levels;
    - only the two curved maps bend;
    - a Kesh strafer turns, banks and hits ships on both reaches;
    - its time to impact counts along the bend;
    - a straight map's jet flies straight;
    - every map's truck, sub, cove and track audit clean.
  - Two older frigate tests now measure along the lane. The V2-parity map
    test leaves out the roads V3 fixed.
- **`npm run e2e:v3`:** the tray on every map at 667×375 as well.
- **The log version is 13:** frigates and aircraft move differently, so a
  v12 log no longer replays exactly.

## Limitations

- Bomber lines on two straight maps still cross land (accepted, above).
- On Saltgate the frigates are weaker than before (27% with them, against
  38% when they drove through the lock walls), but worth taking again.
- Banking is drawn, not simulated: the jets fly the lane exactly, and the
  bank angle comes from how fast they turn.
