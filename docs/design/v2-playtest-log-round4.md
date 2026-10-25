# Straitwatch V2: playtest round 4

The player's first round-3 game (map 1) was "a lot better… a lot more challenging", and the last wave was pleasantly chaotic. The replay matches the phone exactly: 74,800 points, 4 ships lost, carrier 8/12.

What the player asked for:

- **New attack vectors**, so the fight isn't just tapping the same three enemy bases:
  - **Submarines** that surface and fire 4 ballistic missiles back to back, or launch Shahed drones.
  - **Aircraft** from the screen edges, flying either a strafing run (deadly to a tight block of ships) or a pass that drops guided missiles.
  - **Trucks**: some drive straight up to the shore, fire and reverse out; others drive the whole shore and fire as they go.
- **Shore Battery becomes a ship** that sails in near the carrier, because some maps have no friendly shore to put it on.
- **CIWS removed.** No turret-style defences.
- **Card changes:**
  - **Bigger Rack** folds into Quick Reload.
  - **Auto-Retarget** folds into Twin Launch.
  - **Radar** is reworked.
  - **Hold to Fire**: a slow hold becomes free for everyone, and the card speeds it up.
- **Ten new cards:**
  - Escort Frigate.
  - Salvage Crews: **+25%** pickup drops, not +50%.
  - Supercharged Pickups, Pickup Magnet, Armored Hulls.
  - Smoke Screen, Decoy Flares, Flak Burst, Combat Rhythm, Proximity Fuse.
- **New pickups:** Time Warp, Shield, Strike Package, Full Steam. **The existing four stay as they are.**
- Formation raid warnings were seen but ignored "because they didn't really matter".

## What success looks like (from the player's side)

| # | Goal | How it's checked |
|---|---|---|
| S1 | Threats come from many places, not just three fixed bases. By the mid waves, at most about half of all launches come from a fixed base. | Launch-origin counts from bot runs; threat-position spread |
| S2 | Each new attack vector reads clearly and moves convincingly: you see it coming, see it fire, and see it leave. | Frame strips at phone size for the submarine, both aircraft and both trucks |
| S3 | A strafing run punishes a tight block. Box and Column take clearly more damage than Pairs or Spread, so formation matters again. | Formation lab with strafing runs |
| S4 | The Escort Frigate sails in and fires on every map, including the two with no friendly shore. | Screenshots on all 5 maps; unit test |
| S5 | The card roster matches what was agreed: CIWS gone, the merges done, all ten new cards working as described, each with its own icon. | Unit tests per card; draft screenshots |
| S6 | The four new pickups work and look distinct; the old four are unchanged. | Unit tests; screenshots |
| S7 | Still challenging but achievable, about where round 3 sits. | Balance matrix across maps and skills |
| S8 | Nothing breaks: replays stay exact with the new entities, the phone layout holds, and frame rate holds. | Tests, e2e including iPhone, replay check, frame-time check |

## Cycle 1: baseline

**Focus:** measure where threats come from and how the player plays against them, before changing anything.

**The player's round-3 game** (map 1, `npm run v2:analyze` and a replay probe):

- **Where taps landed:** 62% of 736 taps were within 200 px of a fixed enemy base, and 29% within 120 px.
- **How fast threats died:** a median of **2.1 s after launch**. 48% of kills happened within 200 px of a base.
  - The player is shooting threats as they leave the launcher, exactly as they described.
- **Where threats came from:** 100% of launches came from the map's 3 fixed bases. There was no other source.
- **Formation:** Box was set at 0:49 and never changed, even through 30+ raid warnings.
- **Pickups:** 58 dropped and 48 collected: 21 ammo, 14 repair, 12 Overdrive, 1 EMP.
- **Cards across all three logged games:** Bigger Rack offered 4 times and never taken; Radar offered 2 times and never taken; Hold to Fire taken twice and swapped out once.

## Cycle 2: the new attack vectors in the simulation

**Focus:** submarines, aircraft and trucks as real game mechanics. Visuals come in cycle 3.

**What was built** (`game.ts`; `SUB` / `PLANE` / `TRUCK` in config.ts; `roads`, `subSpots`, `vectors` per map):

- **Submarines** surface at open-water spots clear of the shipping lanes.
  - Sequence: 2 s of periscope and wake, then they break the surface, fire, and dive.
  - Payload: a salvo of **4 ballistics back to back** (topped up to 4 if the raid has fewer), or a drone swarm.
  - They are launchers, not targets.
- **Strike jets** fly in from either screen edge.
  - They line up on the densest band of hulls and strafe: every hull within 60 px of the line takes 1 damage, once per pass.
  - Tracers and water spouts walk ahead of the jet.
  - They take 3 hits to shoot down. A jet that flies off the far edge is gone: no kill, no pickup.
- **Bombers** fly just outside a channel and drop guided missiles on the convoy.
- **Trucks** run on per-map roads:
  - **pop-ups** drive from off screen (or from an island bunker) to the shore, raise the launcher, fire 2, and reverse back out;
  - **runners** drive the whole shore road, stopping to fire up to 4 times.
- Trucks and subs take over launches the wave already has. Each map brings the vectors in from its own wave, with counts growing over the map.
- Every launch records where it came from (base / truck / sub / air).
- A wave isn't cleared until every launcher has finished.

**Finding 1: too hard.** The first full runs (average bot, 6 seeds, maps 2–5) cleared 0–3 maps out of 6. Turning one vector off at a time on map 1 and the Island showed the cause:

- **Bombers** sank about +2.8 ships a game. Their missiles started right on top of the ships.
- **Strike jets** sank about +1.3.
- Subs added about +0.3 and trucks about +0.

**Fixes:**

1. Bombers fly 170 px beyond the channel edge, drop one missile every 1.2 s, and their air-launched missiles are light (1 hit).
2. Aircraft now *replace* part of the wave instead of adding to it: a jet stands in for a drone swarm, a bomber's two missiles come out of the guided count.
3. **The real bug:** ships enter at the left edge, so a plane entering from the left had targets under it the moment it appeared. Now a bomber drops nothing until it is 400 px onto the screen (about 2.3 s to shoot it down) and a jet doesn't open fire until 250 px.

After the fixes, each map with no vectors vs all vectors (average bot, 10 seeds):

| Map | No vectors | All vectors |
|---|---|---|
| Strait | 10/10, 1.3 sunk | 9/10, 2.2 sunk |
| Island | 7/10, 3.4 sunk | 6/10, 3.5 sunk |
| Harbor | 4/10, 3.9 sunk | 5/10, 4.7 sunk |

**Finding 2: launch origins (S1).** Share of launches from fixed bases, average bot, max flow, 6 seeds:

- First pass: wave 7 at 48–61%.
- With more trucks (up to 5 a wave, carrying 2–4 each) and subs every 2 waves:

| Map | Wave 5 | Wave 7 | Wave 9 |
|---|---|---|---|
| Strait | 61% | 48% | 54% |
| Gauntlet | 66% | 53% | 51% |
| Island | 57% | 49% | 62% |
| Harbor | 51% | 48% | 36% |
| Archipelago | 48% | 36% | 45% |

- By the middle waves about half come from somewhere else: the water, moving trucks, or the sky.

**Finding 3: strafing vs formation (S3).** The formation lab gained an air-strike row. Its "HP lost" metric was broken: totalling convoy HP before and after ignored ships arriving and leaving. It now tracks each hull and is fixed.

Ship damage taken from 2–3 strafing passes:

| | Column | Pairs | Spread | Box |
|---|---|---|---|---|
| Undefended | 25 HP | 13 | 7 | **27** |
| Defended by the average bot | 7.8 | 4.4 | 2.1 | **12.0** |

- A tight block takes 2–4× the damage of a split convoy, so formation finally matters against something the player sees coming (the edge arrow).
- One jet does 1 damage per hull per pass, so it sinks little on its own. It softens the whole block for everything else.

**Tests:**

- The submarine sequence, with 4 ballistics from its spot and then it's removed.
- A pop-up drives, fires from the shore point and reverses away; a runner fires from 3 different stops.
- A jet hits every in-band hull exactly once, misses a hull in the other lane, and flies off without a kill.
- A bomber drops nothing during its run-in, and its drops are 1-hit.
- A wave waits for its launchers.
- A Harbor wave-8 run with every vector replays exactly, launch origins included.
- More than 35% of wave-7 launches are non-base.
- Two older tests updated: a cleared wave also needs an empty launcher queue, and extras may ride on trucks.
- 59/59 V2 tests pass.

## Cycle 3: how the new attack vectors look and move

**Focus:** S2. Each vector was dropped into the real built game (`v2.html`, iPhone landscape 874×402 at 2× DPR) at a known place mid-wave and screenshotted every 250–300 ms. The frames were laid out as contact sheets, one per vector, with the sim state under each frame: sub with ballistics, sub with drones, coastal pop-up, island-bunker pop-up, shore runner, strike jet, bomber. Every sheet was reviewed by eye. The table lists what was wrong in the first pass and what changed.

| Vector | Problem on the first sheet | Fix | Re-capture |
|---|---|---|---|
| Submarine | The generic red launch disc covered the hull at every launch. Nothing showed the sub was coming. | Launches now have a flash for each source: a sea spray for subs, a small muzzle flash for trucks, the big disc only for bases. The 2 s warning is a red dashed ring that shrinks onto the spot, plus a periscope with a blinking tip and a V-wake. Hatches light one by one as it fires; it dives in a burst of bubbles. | The sequence reads in order: ring and periscope, then surface and spray, then 4 hatches firing one after another, then the dive. |
| Truck (all) | The launcher raising was invisible from above: a rectangle rotating in place. | Flat on the bed while driving. Raised, it stands upright in a 3/4 view with a long shadow; a blinking beacon and a pulsing red ring show it is about to fire. Reverse lights show when it backs out. | The raise, fire and lower steps are each visible on their own frame. |
| Truck (size) | About 20 pt long on a phone, small next to the base hexes and lost against the dark ground. | 1.3× larger, with a pale halo outline. | Clear at full-field scale (sheet above, `anim2/popup`). |
| Island bunker | The truck appeared out of nowhere in the middle of the island. | A bunker door is drawn at the spawn point and the truck fades in as it leaves it. | It reads as leaving a bunker, driving to the shore and reversing back in. |
| Strike jet | Small, grey on dark blue. The strafing band was grey and looked like a lane marker. | 1.35× larger, light airframe with a white edge, red roundels, contrails and a shadow offset onto the water. The band is now orange with dashed edges, an entry chevron and "✈ STRAFING RUN". Tracers and water spouts walk ahead of the nose. | Band, then run-in, then guns walking through the row; HP pips show above the jet. |
| Bomber | The drop line crossed enemy land on map 1. | Each map has its own bomber lines over water, and a magenta dashed line with "✈ BOMBER". | The bomber flies the line and releases light missiles one at a time after its run-in. |

**Not changed:** a runner on Strait's top road is still the smallest moving thing on screen. The halo makes it findable, and when it stops to fire, its red ring is as big as a base's.

## Cycle 4: the agreed roster changes

**Focus:** S4 and the first half of S5: the cards removed or merged, and the Shore Battery turned into a ship.

| Change | What it does now |
|---|---|
| **Carrier CIWS: removed** | Gone from the cards, the sim (`updateCiws`), the icons, the tests and the analyzer. Nothing fires by itself any more. |
| **Bigger Rack → Quick Reload** | L1 reloads 25% faster. L2: 40% faster and 7 rounds. L3: 55% faster and 9 rounds. The extra rounds are loaded the moment the card is taken. |
| **Auto-Retarget → Twin Launch** (max 3) | L1 adds a free 2nd interceptor. L2: an interceptor whose target dies flies on to an uncovered threat. L3 adds 2 free extras, and spares peel off to uncovered threats. |
| **Radar, reworked** | L1: raids, submarines and aircraft are flagged 1.5 s sooner. The raid banner and the aircraft band show earlier, and a new green **SONAR** ping marks where a sub will come up. Ballistic impact points still show at launch. L2: jamming, threats fly 12% slower. |
| **Hold to fire: free for everyone** | A held finger repeats every 0.6 s. The first repeat waits at least 0.35 s, so a normal tap never fires twice. The card, now **Rapid Hold**, speeds it to 0.45 s, then 0.33 s. The wave-1 banner and the menu say "hold to keep firing". |
| **Shore Battery → Escort Frigate** | When the card is taken, a frigate sails in from the screen edge on its station's side and holds station beside the carrier. It fires from its own 4-round rack once it is on screen; taps fire from whichever launcher is nearer. L2: 7 rounds, and it steams toward the middle of the threats, never closer to the carrier than 60 px past its bow or stern. If the card is swapped out, the frigate leaves. |

**Frigate visual check (S4).** The frigate was dropped into the built game on all 5 maps and screenshotted while sailing in and while on station. Problems found:

1. **On Archipelago it sailed straight through the carrier.** It always entered from the left, and that station is to the right of the carrier; Gauntlet had the same problem. It now enters from the edge on its station's side. A new test steps both maps frame by frame and checks the frigate never comes within the carrier's length.
2. **On Gauntlet the left-side approach ran under the "NEW" callout banner.** The right-side entry fixes that too.
3. **Sub spots sat inside the frigate's patrol:** Gauntlet (1180,450), Archipelago (1400,742), Harbor (470,712), and Strait's (610,700) next to the planned station. They were moved or removed. A test now checks every sub spot against the frigate's real level-2 patrol box on every map.
4. A point-in-polygon check confirmed every station and sub spot (with a 40 px margin) is in open water.

After the fixes, the re-captured frames show the frigate entering from the right with its wake behind it, and settling clear of the carrier.

**Tests:** 67/67 V2 tests pass. The CIWS, Bigger Rack and Battery tests were replaced with 9 new ones: the merged cards, the free hold, radar lead time, and the frigate's arrival, firing, entry side, stations, roaming and swap-out.

## Cycle 5: ten new cards and four new pickups

**Focus:** S5 and S6. Every card from the agreed list works as described, has its own icon, and is shown in the real draft UI. The four new pickups are distinct, and the old four behave exactly as before.

**The roster is now 17 cards** (max 3 held). The Escort Frigate came in Cycle 4; the other nine:

| Card | Level 1 | Level 2 |
|---|---|---|
| Salvage Crews | **+25%** pickup drops (as asked, not +50%) | Pickups last 8 s instead of 5 |
| Supercharged Pickups | Timed pickups last 50% longer; Repair heals 1 more | Every pickup also reloads 2 rounds |
| Pickup Magnet | Grab pickups from twice as far | Pickups fly to the carrier by themselves |
| Armored Hulls | Ships take 4 hits (applied to hulls already at sea) | 5 hits, carrier +4 HP |
| Smoke Screen | A ship that is hit lays smoke; guided missiles lose their lock on it and fly on blind (10 s recharge) | 6 s recharge; smoke also hides ships from strafing guns |
| Decoy Flares | A guided missile about to hit a ship swerves after a flare and bursts on it (8 s recharge) | 4 s, and fools supersonics too |
| Flak Burst | Interceptors clip every threat they pass within 28 px | 45 px |
| Combat Rhythm | Every 4th kill reloads a round instantly | Every 3rd, and the frigate too |
| Proximity Fuse | Interceptors burst within 34 px of their target, so fast missiles stop slipping past | A fused hit does double damage |

**New pickups** (old four unchanged: same numbers, checked by a test):
- **Time Warp** (teal hourglass): threats move at 40% speed for 4 s. The screen gets a teal edge and tint.
- **Shield** (white): ships and the carrier take no damage for 5 s, shown as bubbles. A blocked hit flashes a ring.
- **Strike Package** (red jet): friendly jets hit the 4 threats closest to landing for 2 damage each. They also knock out every launcher that is up: a sub dives, a pop-up backs off, a runner drives off without firing again.
- **Full Steam** (orange chevrons): the convoy runs 60% faster for 5 s.
- Each timed pickup shows a countdown chip in the top-left; Overdrive got one too. The first time each new kind drops, a banner says what it does.

**End-to-end check in the build** (iPhone landscape): three drafts were dealt the nine new cards, and the middle card was tapped each time. Supercharged Pickups, Smoke Screen and Combat Rhythm each landed in the game's loadout, with no page errors. Every pickup was laid out on screen, and each new one was tapped and filmed. Smoke, flares and flak were taken through the draft UI and filmed in action.

**Problems found on the sheets, and fixed:**
1. **Decoy Flares were invisible.** A few 5 px sparks sat on the hull and the missile just vanished. Now the ship pops a ring, a glowing flare arcs out to one side trailing smoke, and "FLARE" shows. The missile is seen to swerve after the flare and burst on it. In the sim the missile now flies to the flare instead of disappearing; the test was updated.
2. **Full Steam was too faint to notice.** It now draws a churned white wake fanning out astern, faster streaks and a bow wave.
3. **Strike Package read as laser lines.** It now shows a white delta jet on a dashed contrail diving across each target, with an X where it hits.

Smoke (the hit ship's cloud, then the guided missile flying straight past instead of turning in) and Flak (one interceptor clearing a column of 5 drones on its way to a 3-HP target, which survives) read correctly as built.

**Tests:** 82/82 V2 tests pass, 15 of them new. Bugs found while writing them, all in the tests:
- One test gave every "seed" the same seed, which showed up as an exact 2.0 ratio.
- One ran too short for interceptors to arrive.
