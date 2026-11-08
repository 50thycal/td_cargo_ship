# V3 enemies: Test Lab round 1 (2026-11-08)

What the player's Test Lab verdicts and notes (`tools/v3/test-lab/playtest-2026-11-08.json`) changed, besides the four cut enemies (listed in `v3-enemy-build.md`). Screenshots: `docs/design/img/enemy-lab-round1/`.

What the player's Test Lab verdicts (`tools/v3/test-lab/playtest-2026-11-08.json`) changed. Screenshots: `docs/design/img/enemy-lab-round1/`.

### Decoy Drones (tune)

*"Make the decoy drones a little less obvious, especially when they first launch... a little delay."*

- **The tell comes late.** A decoy strobes only within **160 px** of its ship (was 300) **and** not before **3.5 s** after launch (new, `FOE.decoy.revealAfter`). Measured on every map: they used to show from launch (as early as 0.02 s out) and for 4 to 6 s of a 7 to 10 s flight; now never before 3.5 s, and for about the last 2 to 3 s. A decoy that reaches its ship sooner than 3.5 s fizzles without a strobe.
- **Nothing else gives them away.** Decoys now fly exactly as the attack drones beside them (the same weave and nose swing; before, they flew dead straight while the real ones weaved), at the same speed, the same size and colour, the same launch and kill sounds, and now the same small kill burst (theirs was the bigger one). Helpers and bots still leave a decoy alone only once it has strobed.
- Shots: `decoy-1-launch*.jpg` (six alike), `decoy-2-reveal.jpg` (one strobing near its ship, the rest still alike).

### Armored Drone (keep)

*"The animation just needs to be a little better for the shield."* Drawing only.

- The shield is a curved steel plate across exactly the arc the sim protects (70° either side of the nose), in four segments (one per plate hit; a spent one is a dim gap, the middle holds longest), with a cyan field fanning out in front and a humming energy rim.
- A blocked hit flares it: the rim brightens and widens, a white flash on the plate, sparks thrown off.
- It turns with the drone, so as it banks the shield visibly swings off the carrier; while it banks, the open flank and tail glow yellow (with the tail ring as before).
- Shots: `armored-1-shield.jpg`, `armored-2-deflect.jpg`, `armored-3-bank*.jpg`.

### Spotter Plane (tune)

*"Spot from a little further, not by much."*

- `FOE.spotter.off` (how far past the lane's edge its circle sits) **150 → 185 px** (+23%), and its circle 110 → 100 px so the stand-off fits on screen. Its nearest pass to the lane's edge goes from 40 to 85 px; its closest pass to the painted ship +25% on the lab's water (The Strait 158 → 200 px); its average distance +4% (332 → 344 px over every map, 12 seeds): on most maps the lane is about 320 px from the top, so the screen edge caps it.
- It has its own spot now (the helicopter's spot it shared ignored its circle): the whole circle stays at least 35 px (`FOE.spotter.edge`) inside the screen on every map (before, it flew off the top or bottom on seven of the twenty), and it prefers the lane's far side from the carrier and a spot that keeps its stand-off from every lane. Checked at 874×402 and 667×375 (`spotter-paint-*.jpg`).

### Hydra Missile (keep)

*"Make sure damages are correct: whole it does double, split each does one."*

- They were right: a Hydra that lands whole does **2** to its hull, and each dart **1** (two darts at two different ships). New tests check both (a Formation's armour still takes 1 off a hit, down to 1, as for every threat). No change.

### Stealth Strafer (keep)

*"Make this one a little faster."*

- Speed **270 → 315 px/s** (+17%), the whole flight (run-in and pass). Its run-in grows with it, **300 → 350 px**, so the time to shoot it before its guns open stays about 1.1 s. Its share of the wave speed-up stays 0.3.

### Laser Cutter: a red sight line (player's note, Saltgate)

*"A sniper-like red laser beam tracking your movement... just visual, to make it look like it's coming from the ship."*

- With the Cutter loaded, while your finger is down (before and during the swipe) a thin, glowing red line runs from the carrier's gun to your finger, a red dot at each end. Visual only: the cut is unchanged. Shots: `cutter-1-aim.jpg`, `cutter-2-swipe.jpg`.


### Volatile Cloud (tune): a biohazard missile

The player: "have it look like a biohazard missile that's coming in slow and then it explodes [and] releases that cloud and then that lingers [and] does damage to that area ... whenever you blow it up, [it'll] do that ... the key is just [to] get rid of it out there early."

- **Now:** a slow, chunky yellow-green missile with hazard bands and the trefoil, launched from a base at a ship (it comes up in the raid warning like any missile). Shot down, or when it reaches its ship, it bursts: toxic gas hangs on that spot. A hull inside the gas takes a hit 0.7 s in, then one every 2 s while it stays. A fresh ship sailing through the middle takes one or two hits; the ships behind it sail into the same gas. The missile reaching its ship also hits it once.
- **The play:** kill it far out, so its gas lands on open water.
- **Gone:** the drifting cloud and "any explosion inside it sets it off".
- **Numbers:** 2 hits, speed 48 (the guided missile's 150), turn 0.9 rad/s. Gas radius 75, lingers 7 s, 1 damage a tick. The Nuke burns it up with no gas.
- **Bots and helpers** rank it by how long it can still be shot with its gas clear of the convoy (two radii off the nearest hull), at half weight, so they shoot it early; it is always worth a shot.
- **Test Lab evidence:** gas damage counts against the card (`labHarm`, by `cloud`); a missile shot down with no hull within two radii counts as stopped before harm.
- Screenshots: `cloud-missile.jpg`, `cloud-missile-close.jpg`, `cloud-gas-far-out.jpg`, `cloud-gas-on-lane.jpg`.

### Lure Beacon (tune): surfaces, a wide ring, takes every helper's fire

The player: "should [it] come out of [the] water? It needs to have a w[id]er radius of effect and ... forces all the passive attacks to take priority [on] attacking that."

- **Surfaces:** it rises out of the water over 1.4 s (ripples, water streaming off, its light dark); it lures nothing until it's up. The buoy is drawn half again bigger.
- **The ring:** radius 300, drawn on the water (dashed yellow edge, faint fill, a pulse sweeping out), with a yellow tether to each helper drone it has drawn.
- **Takes focus:** every auto-targeting helper goes for it first when it's within the helper's reach, or within its ring of the helper, or when what the helper was about to fire at is inside its ring: the Frigate Escort, Aegis Launchers, Point Defense, the shore batteries, the Gunship Pair (it had no lure check at all), and the Wild Card's gunship missile. The Drone Screen and Orbital Strike go for it anywhere on screen, and a drone already on its way to something turns for it. The Bomber Wing spends its next pass on it. Their shots still do nothing to it; two taps sink it.
- Unit test: `tests/v3/foes.test.ts`, "a Lure Beacon rises out of the water first, then every helper goes for it over a real threat" (Drone Screen, Gunships, Frigates, Orbital Strike, Bomber Wing).
- Screenshots: `lure-rising.jpg`, `lure-up-ring.jpg`, `lure-drones-turn.jpg`.

### Repair Tender (keep): sails in, keeps clear

The player: "Needs to sail in like a normal ship and it should be checked for collisions with other submarine[s] and ships."

- **Station:** a water spot clear (150 px) of every other boat: convoy ships, frigates, raider subs up or still to come, periscopes, and the enemy's own boats (torpedo subs, fast boats, the Dreadnought, a Lure, another tender's station). Spots near the screen's side edges come last.
- **Sails in:** from off the nearer side edge on the shortest straight run to its station that crosses no land (a new even-odd `onLand` check against the map's landmasses); if no run is clear it rises at its station as before. It eases onto station at speed 55, with a bow wave and a wake, bow along its course.
- **Keeps clear while it moves:** pushed off any boat within 90 px, and slowed when one is right ahead (ships have right of way); it never steps onto land. It mends as it sails.
- Unit test: "a Repair Tender sails in from off the screen over open water to a station clear of the other boats", on the Strait, the Island, the Archipelago and the Harbor.
- Screenshots: `tender-sailing-in.jpg`, `tender-on-station.jpg`.

### Scavenger Drone (keep): lurks, and looks its own

The player: "Weird how it just sits on the shore; it should circle and lurk and look different than the other drones."

- **Lurks:** with no pickup to go for, it circles (radius 85, about 76 px/s) over open water 170 px off the convoy's middle, the circle drifting with the convoy, a faint amber ring marking it; it gives up after 16 s. A pickup appearing sends it straight for it, as before.
- **Looks:** an amber quadcopter (an X frame, four spinning rotors, a dark sensor eye) with a three-pronged claw that opens as it nears its prize, instead of the winged drone shape everything else uses. The line to its pickup and the pickup's ring are amber.
- Unit test: "a Scavenger with nothing to grab circles over the water off the convoy, not parked on the shore".
- Screenshots: `scavenger-lurking.jpg`, `scavenger-close.jpg`, `scavenger-grab.jpg`.

### Homing missiles no longer circle (Gunship Pair's Hellfires, the Attack Helicopter's missiles)

*"Sometimes it'll circle the entire thing ... there's something bugging with the math."*

- **Why they circled:** both turned at a capped rate and left the rail along the helicopter's nose. A Hellfire flies 1150 px/s and turned at 2.5 rad/s at launch (a turning circle 460 px across, tightening only as it flew); the helicopter's missile turned at 3 rad/s. A target close by and off to the side or behind (always possible: a Gunship picks anything within 380 px, whatever way it faces) sits inside the missile's turning circle, and a turn-limited pursuer can never reach a point inside its own circle: it orbits until it times out. The Hellfire then burst on the target anyway after 1.4 s, so it looked like a loop and a hit.
- **The fix:** both leave the rail pointed at their target (the Hellfire within 0.35 rad of it, so a pair still splays a little; it also aims where the target will be), and both turn at least 3 × speed / distance (`homingTurn` in `sim/game.ts`). That keeps the turning circle under a third of the distance left, so the target is never inside it and the nose always comes round. Far out, each keeps its own turn rate.
- **Tests:** `tests/v3/homing.test.ts`: from every heading at 30 to 400 px, still and moving targets, both missiles arrive within a bounded time and turn less than a circle; a real Hellfire from six offsets and five nose headings flies within 25% of the straight line and bursts on arrival, not on timing out.

### Rocket Truck: salvos of five small rockets

*"Make it launch like five rockets at a time ... a lot less damage."*

- Each firing is now a ripple of five small red rockets, 0.1 s apart, at one ship, landing in a cluster round it (18 px spread). The salvo does what one rocket did before: the first of its rockets to land on a hull takes 1, the rest only splash (hull damage is whole points, so the hit is split visually, not in fractions). Five salvos a truck, as there were five rockets; the gap and the raise are unchanged.
- Bots (harm, sharp / casual): before 5 / 29, after 8 / 28: the same threat.

### Red means it can't be intercepted

*"Make the projectiles a color, then we can tell the player: red projectiles you just cannot intercept. Do the same with the shore battery."*

- Everything no interceptor can stop is drawn red from nose to tail, with a red glow: the Rocket Truck's rockets, the Siege Battery's shells in flight, the Dive Bomber's bomb (red under its belly until it lets go). Missiles you can shoot keep their pale body and red tip. Torpedoes and the helicopter's missiles can be shot (one hit), so they are not red.
- The first red shot of a run brings one small card, without a sound: **RED SHOTS CAN'T BE STOPPED**, *Hit the launcher instead.*
- A tap on a red shot with nothing shootable under the finger says **CAN'T INTERCEPT** there, small, like **RELOADING** (the player asked for this one; it did not exist before).
- The briefing's "New enemies" box says *Red shots can't be stopped: hit the launcher* when its chapter has one of them (`RED_FOES`), and the three foes' blurbs and first-sight cards say red.

### Siege Battery: up out of a hatch, and back down

*"Raised up from low ground and then it could go back, but it just has a vulnerable spot once it's up."*

- It lives in a hatch on the enemy shore: a closed hatch first (1 s), then the doors slide open and the gun rises (1.5 s, a target from the start, its ring filling), marks its two circles, and stays up until its shells have left the gun (+0.3 s). Then it sinks back and the doors shut: for 2.4 s it is off the board (no taps, no blasts, no helpers, no bots: it is not in the threat list at all), drawn as a shut hatch with a faint ring and its hits so far, faint. Then up again, the same gun with its hits and salvos kept. After the third salvo it goes down for good (not a kill).
- A salvo every 6.5 s (was 6). It was the deadliest enemy in the playtest (7 came, 32 hull hits, 5 sunk), and hiding made it harder for the bots (casual: sunk 19 → 41 at 6 hits), so it now takes **5 hits, not 6**. Bots (harm, sharp / casual): before 36 / 212, after 32 / 166.

### Dive Bomber: seen from above, in from the top

*"Instead of coming top down ... come from the top of the screen and then drop in. The perspective should match the rest of the game."*

- It is drawn like every other aircraft now: a gull-winged plane from above with its shadow on the water. When its window opens it comes in near the top of the screen (up to 420 px short of its circle, at a slight slant), flies straight at the circle and pitches into its dive (it shortens front to back, its shadow closes in under it, it grows a touch as it gets low), lets go of its red bomb 36 px short of the circle (the bomb falls on into it), then pulls up, its shadow drawing away, and banks off to the nearer edge.
- Flying in from that far, the sharp bot let three times the bombs through in the old 1.8 s window, so the window is **2.2 s** and the circle shows **1.8 s** before the plane (was 2.2): the bomb still lands 4.7 s after the circle appears. Bots (harm, sharp / casual): before 6 / 97, after 4 / 94.

### The Nuke hits everything on the screen

*"It should blow up everything on the screen, even the trucks, submarines, any of the vehicles."*

- What it missed: the launch trucks and submarines (raiders, which are not targets otherwise), anything just past the screen's edge, and the warnings. Now it knocks out every raider on screen, kills every threat on or partly on the screen (40 px past the edge), brings up and kills a siege gun hidden in its hatch, sinks a sub still at periscope depth, takes the Lure Beacon however the Nuke was picked up, and clears every circle and red shot on the water.
- The one exception stays, as documented before: structures (rigs, generators, the Citadel) and the Dreadnought boss take 3 hits instead of dying. Test: `tests/v3/nuke.test.ts`.
