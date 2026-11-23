# V3 enemies: Test Lab round 2 notes (2026-11-08)

The player kept all 17 enemies in round 2 (`tools/v3/test-lab/playtest-2026-11-08-round2.json` and `-round2b.json`). Three notes asked for changes; this build makes them, as Test Lab **round 3** ("Round 2 notes" in `LAB_ROUNDS`), so those three cards ask to be tested again. Round 1 is in [v3-enemy-lab-round1.md](v3-enemy-lab-round1.md). Screenshots: `docs/design/img/enemy-lab-round2/`.

### Dive Bomber: quicker, and an A-10 Warthog

The notes, dictated, verbatim: *"Much better now the plane comes in with an animation that makes a lot more sense. I think you make it a little quicker and then Olsen said to make a prop plane make it more make it look like a 10 warthog."* and *"Make it faster and an a ten worthhog"* (an A-10 Warthog).

- **Quicker:** its run from coming on screen to letting go of the bomb is **1.8 s** (was 2.2), so it flies the same run 22% faster (about 190 → 233 px/s), and it pulls away faster (up to 640 px/s, was 520; banks at 2 rad/s, was 1.6). The circle shows **2.2 s** before the plane (was 1.8), so the bomb still lands 4.7 s after the circle appears (`FOE.diveBomber`: `window`, `mark`, `exit`, `bank`).
- **An A-10 from above:** long, straight wings with turned-down tips; a slim fuselage with the gun's muzzle at the nose and the canopy well forward; two engine pods high on the rear fuselage (dark intakes, hot exhausts); a straight tailplane with a fin at each end; two-tone grey camo. Its red bomb shows either side of the belly until it lets go. The shadow on the water (now the whole outline in one fill), the dive cues (shortening front to back, the shadow closing in, speed streaks) and the bank on the pull-up are as before.
- **Fair?** The bots (`tools/v3/test-lab/measure.mts`, hull harm, sharp / casual): before 4 / 76, after 16 / 90 (10 seeds); over 30 seeds 8 / 245 → 32 / 258. The casual player is hurt about 5 to 20% more. The sharp bot lets more bombs through, but from very few (it stops 139 of 166 before the drop, was 152). The time of the run sets this, not its length: starting the plane closer to its circle did no better.
- Shots: `dive-bomber-1-in.jpg`, `dive-bomber-2-dive.jpg`, `dive-bomber-3-away.jpg`, `dive-bomber-a10-close.jpg`, `dive-bomber-a10-diving-close.jpg`.

### Incendiary Missile: leads its ship, in on the bow

*"Make it aim and lead the ship instead of coming through on the back"*

- **Why it came in from behind:** it flew at where its ship would be at most 4 s ahead and, within 120 px, straight at the ship. At 48 px/s against a ship's 40, that is a stern chase: over every map, 4 seeds and every launch site, 120 of 344 missiles hit the back half of the ship, and 93 trailed more than 15 px behind it in their last 150 px.
- **Now it leads:** each step it works out where it meets its ship (`intercept` in `sim/foes.ts`): the time to go from the ship's speed along its lane, solved in a straight line, then refined three times on the lane itself (so a bend counts), looking at most 20 s ahead. While it is far it aims 60 px off the ship's bow, which brings it in on the bow or the flank; the offset shrinks to nothing as it closes. It leaves the rail already pointed at that point.
- **It picks a ship it can meet:** a ship already past the launch site (the site more than about 12° behind its beam) could only be chased up its wake, so the missile goes for the best placed ship instead, if there is one.
- **Measured** (same set): 0 of 344 hit the back half (was 120); 8 trailed more than 15 px, by at most 29 px, all when the only ship on the water was already past the site (was 93, by up to 150 px). Its average flight is 11.5 s (was 14.0). The bots still shoot it far out: harm 0 / 0 (10 seeds), 0 / 1 (30 seeds).
- Unit test: "an Incendiary Missile leads its ship: it lands ahead of where the ship was, on the bow, never trailing it", from every Strait launch site over four seeds. The old steering fails it.
- Shots: `cloud-1-launch.jpg`, `cloud-2-leading.jpg`, `cloud-3-on-the-bow.jpg`, `cloud-4-on-the-bow-left-base.jpg`.

### Decoy Drones: spread out

*"Maybe make it it either easier to see th e or spread the out more and they are just more ne large clump"* (verbatim; read: easier to see them, or spread them out more: they are just one large clump).

- **Wider launch:** the six leave the site in a staggered line 40 px apart (was 12), every other one 26 px back.
- **A looser swarm:** each member keeps its own place across the swarm's front (56 px from the next, `slot`), and closes up only over its last 240 px to its ship (`swarmAim`). Any two closer than 44 px ease apart (`swarmPart`). Real drones and decoys in the swarm fly the same code, so nothing but the late strobe tells them apart.
- **The tell is as in round 1:** no strobe before 3.5 s, and only within 160 px of the ship.
- Unit test: "a Decoy Drones swarm spreads out", where no two drones come within 20 px and the swarm is over 200 px wide. The round 1 test (decoys fly exactly like the drones beside them) now compares a decoy and a real drone of the same swarm, in the same place.
- Bots: harm 0 / 0 before and after.
- Shots: `decoy-1-launch.jpg`, `decoy-2-spread.jpg`, `decoy-3-reveal.jpg`.

### Test Lab

- `LAB_ROUNDS` round 3, "Round 2 notes", `since: '2026-11-08T23:05'` (logs of this build carry their round anyway; `since` only places a log without one).
- `LAB_CHANGES` round 3: Dive Bomber "Quicker, and now an A-10 Warthog"; Incendiary Missile "Leads its ship and comes in on the bow"; Decoy Drones "The swarm spreads out; easier to tell apart". Their combos (Incendiary Missile + Flak, Decoys + Sprint Drones) take the new version too. The three cards' "what to look for" lines are updated.
- The review page needs a rebuild (`node tools/v3/test-lab/page.mjs <out.html>`) and a republish to know the new versions.
