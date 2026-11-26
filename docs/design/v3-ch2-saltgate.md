# Saltgate Canal: map card (map rebuild, chapter 2)

**Date:** 2026-11-20. Saltgate Canal (`saltgate`, chapter 2 "The Narrows", the 10th map and the chapter's last) brought to the map and wave rules (`docs/design/v3-map-wave-rules.md`), after the Island, the Behemoth Run, the Needle of Bosk and the Archipelago (`docs/design/v3-ch2-island.md`, `v3-ch2-behemoth.md`, `v3-ch2-needle.md`, `v3-ch2-archipelago.md`). Encounter rev 4; play log v38, reworked at log v42 after the player's play (below: "Log v42: the trucks"), its boss again at **log v46** after the player's review (below: "Log v46: the missile parade"), and again at **log v62** after the player played it (below: "Log v62: the Missile Truck parade"; 2026-11-23).

## Log v71: the parade with the normal truck, and easier (2026-11-26)

The player, after playing the v62 parade: *"I played it and it is a bit too hard. I think we should also use the normal truck that you cannot attack and not these custom vehicles you made."*

**The trucks.** The game's ordinary Missile Truck is a *raider* (`Raider`, `sim/game.ts`; drawn by `ui/vectors.ts` `drawTruck`): a launch platform that is not a target. No shot, blast or helper hits it, only the Air Strike family (and the Nuke) knock one out. The v46-v62 parade used a custom enemy of its own (`missileTruck`: a threat with 4 hits and its own long olive drawing). Log v71 drops that enemy and plays the parade with the ordinary truck: a new raider kind `parade` (`updateParadeTruck`, `sim/foes.ts`) that drives the road without stopping, raises its missile as it goes (the red ring and the dashed mark line to its ship, drawn on the ordinary truck's body) and lobs an ordinary ballistic missile. Its launches, the patterns and the road are exactly v62's. A parade truck can't be bombed either (it is not `raiderUp`), so the one counter is the missile in the air.

**What the player shoots.** The missiles: the red landing circle shows where each is going, and the ships held at the locks can't move. With nothing to kill, the round is a pure shoot-the-missiles round; the ring and the dashed line still say which ship a truck is about to fire at and when, so the player can aim at the missile as it rises. If that reads as too little to do, the open question is whether a truck should take a hit or two (it was the player's "cannot attack" that asked for none).

**Tuning (the bot, usual Armory, 96 seeds from 900, `tools/v3/saltgate/boss.ts`).** With the trucks unkillable the bot's rounds (0.7 / 0.6 / 1.6 on the same data) are eased where they were hardest and made denser where they were light: round 1 ripples of 5, 0.4 s apart (was 6, 0.3 s); round 2 a denser parade (gap 1-1.65 s, 4 missiles a truck); round 3 one stray (was 3). Boss rounds lose 0.46 / 1.04 / 1.38 ships (0.9 / 1.4 / 2.0 at v62), the rounds near 26-32 s, and the card's bot win rate is 80% (58% at v62): the asked-for losses are lighter than v62's by a third, and the waves 1-10 lose about 1.6 ships between them.

## Log v62: the Missile Truck parade (the player's play of the v46 boss)

The player played the v46 Gatecrashers in the Test Lab, died in boss rounds 2-3 (6 of 7 ships to the trucks' missiles) and ran out of ammo: *"Alright this boss is really bad. What I was thinking was a row of trucks going in a "parade" from the left to the right across the road. It would be a truck every 1 to 3 seconds randomly and it would just randomly fire out a missile without stopping, it would just keep going, and all the trucks going [would] do that and it can have them fire off in an elaborate pattern. So redo this"*.

**What it is now.** The Gatecrashers (the event's id is still `run-the-canal`; lab only, under the encounter layer) are a parade of Missile Trucks along the map's road behind the silos (its existing runner, `roads.runners[0]`, x -60 to 1660 at y 100-200, already drawn, with tunnel mouths at both ends; no new road was needed). The trucks drive west to east at 2.3 × a truck's speed (161 px/s, about 12 s across) and **never stop**: not to fire, and not for a wreck ahead (v46's stall is gone). A truck sets out every 1-3 s at a seeded interval (each round has its own range inside 1-3 s). Each truck carries 3 missiles (4 in round 3) and fires them **on the move**, when the round's patterns call it. The warning is the existing one: the red ring fills round the truck as it raises the missile (2.2 s), and the dashed red mark line runs to its ship, with a ring on that ship. Then the missile goes: an ordinary ballistic, lobbed at least 3 s with its red landing circle, at a ship held at a lock (the one fewest trucks have marked). A truck takes 4 hits, and one shot off the road fires nothing more.

**The patterns** (`ParadeRound.cycle`, `paradeBeats`; `sim/parade.ts` `layBeat`). Every few seconds a beat is laid on the trucks on screen at that moment, front (east) to back:
- **ripple:** a run of trucks side by side, one after another down the column, 0.3 s apart;
- **pairs:** side-by-side pairs, each pair at once, the next pair 0.5-0.6 s on;
- **sync:** trucks spread down the column, all at once;
- **sweep:** the rolling barrage, every truck on the road front to back, 0.25 s apart.
- `from: 'back'` runs a pattern back to front.
- `aim: 'alternate'` sends its launches at the west lock and the east lock in turn.
- A few **strays** (lone launches at seeded moments) fall between the beats.

A beat uses only trucks that are free, so a truck shot before its beat leaves a gap in the pattern and the rest go on.

| Round | Identity | Trucks (a truck every) | Missiles each | Beats | Seen with nothing shot (6 seeds) |
| --- | --- | --- | --- | --- | --- |
| 1 | Ripples, front to back, then back to front | 1.05-2.1 s, about 8 | 3 | a ripple of up to 6 every 3 s; 3 strays | 19 launches, a ripple 2.4 trucks |
| 2 | Synchronized pairs and ripples, the two locks in turn | 1-1.9 s, about 9 | 3 | pairs (8) and ripple (6) in turn, every 3 s, alternate locks; 3 strays | 20 launches, a pair beat 2.6, a ripple 2.4 |
| 3 | The dense parade: volleys at once, ripples, pairs, and the grand rolling barrage, which also closes the round | 1-1.3 s, about 11 | 4 | sync 5, ripple 6 (alternate), pairs 8, sweep, every 2.8 s; finale sweep; 3 strays | 25 launches, a ripple 3.9, pairs 4.3, sweep 2.9 (up to 6+) |

Each round lasts about 27 s with nothing shot (B1 to B3: 22-24 s on the bot, the rule's 15-30 s). The parade is seeded by the run's seed, the wave, the round and the step it began on (`paradeRng`), so it replays exactly, and a Test Lab rerun plays a new parade.

**How it was tuned (the bot, the player's Armory).** The bot shoots trucks well: at 3 hits it shot nearly every truck off the road before it fired twice (won 83-96%, the rounds 0.0-0.3 / 0.1-1.1 / 0.8-1.2). At 4 hits with the trucks a little denser it lands near the asked shape. The warning was tried at 1.8, 2.0, 2.2 and 2.4 s. At 2.0-2.2 the bot won 42-50%. At 2.4 it wins inside the band, and the warning stays close to v46's (2.6 + 0.5 s).

Code (log v62):
- `src/v3/data/encounters.ts`: `ParadeRound`, `ParadeBeat`, `paradeBeats`, `BossRound.parade` (replacing `trucks`/`TruckRun`), `SALTGATE_BOSS_ROUNDS`, `SALTGATE_TRUCK` (`hp`, `drive`, `lift`);
- `src/v3/sim/parade.ts` (new): `paradeSpawns`, `paradeCalls`, `layBeat`, `paradeSpacing`;
- `src/v3/sim/events.ts`: `paradeRoad`, `paradeOf`, `paradeTruck`, `paradeBeat`, `EventRun.parade` (the road, spawns, calls and every launch laid, with its beat); the v46 `bankRoad`, `gateTruck` and `columnGap` are gone, and so is the Missile Truck's stall in `eventFoeDown`;
- `src/v3/sim/foes.ts`: `updateMissileTruck` (drives on, raises on the move, fires at `fires[0].at`), `erectorUp`, `lockShip` and `markShip` with a lock, `truckMark`, `foeEta` (until its next launch), `FoeData.fires` and `lift`;
- `src/v3/data/foes.ts`: `FOE.missileTruck` (`raise` 2, `flight`, `apex`, `lower`; no `hold`, `reload` or `leave`) and its blurb;
- `src/v3/ui/foes.ts`: the ring fills over the truck's own `lift`;
- `src/v3/ui/app.ts`: the first-sight text ("A parade of them drives the road, raising ballistic missiles on the move ... four hits");
- `src/v3/data/lab.ts`: Ready to test, Saltgate at v62;
- `tools/v3/saltgate/boss.ts`: now also shots, seconds dry and the rack's lowest; `--parade=<json|@file>` and `--truck`;
- `tools/v3/saltgate/parade-dbg.ts` (the parade with nothing shot: launches and launches a beat by pattern);
- `tools/v3/saltgate/parade-shots.mjs` (the phone shots).

### Bot results, log v62 (quick.ts, the player's Armory on 96 seeds 900-995; the others on 48)

| | v46 (columns) | v62 (parade) |
| --- | --- | --- |
| **The player's Armory: won** | 57% | **58%** (63 / 67 / 54 / 50% on the four 24s) |
| Boss r1 / r2 / r3 (reached) | 0.86 / 1.66 / 1.94 | **0.89 / 1.35 / 1.96** |
| **The latest Armory: won** | 67% | 52% |
| Boss r1 / r2 / r3 | 0.56 / 0.74 / 1.90 | 0.46 / 1.69 / 1.76 |
| **No Armory: won** | 10% | 4% |
| Boss r1 / r2 / r3 | 1.70 / 2.20 / 1.00 (8-10 runs) | 0.70 / 2.20 / 4.17 (6-10 runs) |

The ammo (`boss.ts`, 48 seeds, the player's Armory; means a round):

| | v46 | v62 |
| --- | --- | --- |
| Shots | 28.6 / 33.7 / 32.8 | 33.9 / 37.1 / 38.0 |
| Seconds with an empty rack | 1.9 / 2.4 / 2.4 | **1.1 / 1.4 / 1.9** |
| Trucks; shot off the road; shot before they fired | 8 / 9 / 10; 7.8 / 7.8 / 7.1; 2.6 / 2.1 / 2.0 | 8.1 / 8.8 / 10.9; 7.5 / 7.4 / 8.2; 4.1 / 3.5 / 3.3 |
| Missiles fired; shot down; most in the air at once | 5.2 / 6.7 / 7.6; 3.0 / 3.0 / 3.2; 4.5 / 6.3 / 7.2 | 5.9 / 8.9 / 11.4; 3.9 / 4.4 / 6.0; 2.3 / 3.4 / 4.9 |

- **The rack runs dry less (1.1-1.9 s a round, from 1.9-2.4):** the trucks come one by one, a kill of 4 hits at a time. v46's columns arrived together and raised together.
- **Waves 1-10 are unchanged** (the per-wave losses match v46 to the run).
- **The boss rises** 0.9 → 1.35 → 2.0 and wins 58%. It is under the asked 1.5 / 2 / 2.5, as v42 and v46 were. The three rounds share a loss limit of 6, so 1.5 + 2 + 2.5 = 6 would lose about half the runs. At 2.0-2.2 s warnings (1.0-1.1 / 1.6-2.0 / 2.1-2.2) the bot won 42-50%.

### Not satisfied, or uncertain (log v62)

- **Under the asked 1.5 / 2 / 2.5:** 0.9 / 1.35 / 2.0, traded for a 58% win, as at v42 and v46. Recommended: play it first. The player lost more than the bot on v46 (6 of 7 in rounds 2-3, where the bot lost 1.7 and 1.9), so the bot's numbers likely flatter a person.
- **The 30 s round limits the parade.** A truck takes about 12 s to cross, so the trucks set out for only 12 s of each round: about 8, 9 and 11 trucks, 5-9 on the road at once. A longer parade means longer rounds than the rule allows.
- **Patterns thin out under fire.** Each truck needs 3.2 s between its launches, and many are shot early. On the bot a ripple rolls 2-4 trucks, not 6, and the full barrage shows mostly when trucks are left alive.
- **The rack still runs dry** for 1-2 s a round on the bot (it was 2-2.5). A truck still takes 4 hits. At 3 hits the boss was too easy (the bot won 83-96%).
- **The latest Armory wins 52%** (was 67%): Wide Warhead's blast no longer takes several trucks at once, because the parade is spread out.
- **No campaign change:** the campaign plays Run the Canal. The parade sits on `MAP_BOSS` under the encounter layer (rev 4), so it does not share the campaign's code path.

## Log v46: the missile parade (the player's review of the Gatecrashers)

*(Superseded at log v62, above: the columns no longer park; the parade drives on.)*

The player's verdict on the v42 boss was **Change**: *"i thought this would be the ballistic missile trucks? we already have a rocket truck convoy. make it the missile trucks so it is different. Should be a parade of them shooting off the ballistic missiles."* (Their first idea: *"a shit ton of trucks for one of the boss ones like they all drive in and they can shoot missiles and it could be pretty intense if all the ships are clustered together"*.)

No enemy fired ballistic missiles from a vehicle before: they came from silos and bases (and a sub's salvo, the Dreadnought's broadside). So the boss has a new enemy of its own, and the Rocket Trucks are gone from it. The name stays "the Gatecrashers": the parade still crashes the gates.

**The Missile Truck** (`missileTruck`, boss only; `FOES.missileTruck`, `BOSS_FOES`, `FOE.missileTruck`, `THREATS.missileTruck`):
- **Looks:** a long olive eight-wheeler (four axles) with a sand cab, and one long white missile with a red nose and dark fins lying on its erector, unlike the Rocket Truck's short brown body and red tube box. As the erector raises, the missile tips up toward the camera: it draws shorter and its shadow falls longer behind the truck, until it stands upright as a red dot over the bed, flashing white. After the launch flash the empty rail comes down and the truck drives off. Its hit pips sit over it as on the other trucks (`drawMissileTruck` in `src/v3/ui/foes.ts`).
- **The warning** reuses the Rocket Truck's: the red ring filling round the truck while it raises (2.6 s), and the dashed red mark line from the truck to the ship it will fire at, with a ring on that ship. Then it holds the missile upright 0.5 s and fires.
- **The missile** is an ordinary ballistic missile (`ballistic`: 1 hit to shoot down, 2 damage to its ship and 1 to the hulls round it), lobbed high: in the air at least 3.0 s and climbing at least 150 px over its line (lower only when the top of the screen would cut its arc). The red landing circle shows as on any ballistic. It is aimed where its ship will be when it lands, reading the locks' gates: a ship held at a shut gate is aimed where it waits (`lobBallistic`, `aimBallistic`'s `lob`). A silo's shells still aim as before.
- **Its ship:** a ship held at the lock nearest it, spread over the column: each truck takes the held ship (within 360 px) fewest other Missile Trucks have marked, so a column's volley lands on several ships in a full chamber.
- **Hits 4, speed 70 px/s** (the Rocket Truck's 75); in a boss column it drives in at 2.2 × that. It can be shot all the way: on the road, while it raises, and while it holds. A wreck stalls the trucks behind it on its road for 2 s, which breaks up the volley. One missile each (`missiles`; a truck with more raises again after 3.2 s). Done, it drives off at its own speed.
- **First sight:** "New on The Narrows: Missile truck", with "It stops and raises one long ballistic missile at a ship. Kill the truck while the red ring fills (four hits), or shoot the missile in the air." A boss-only enemy debuts on its boss's map (`BOSS_FOE_MAP`, `mapDebutsFoe`), so the Test Lab card always shows the card on its first sight, as a map's own new enemy does.
- **Boss only:** no wave planner draws it (`FOE_ORDER` and `FOES_BUILT` leave it out), Free Play doesn't offer it, and it has no enemy card in the Test Lab. The map's waves are as at v42 (Rocket Trucks in the signature).

**The parade:** each column drives in nose to tail (`TruckRun` with `missiles` and no `gap`: the trucks set out 85 px apart at the column's own pace), so it parks together along the bank and up its road, raises together and fires as one volley. See "The boss" below.

Code (log v46): `src/v3/data/config.ts` (the kind); `src/v3/data/foes.ts` (`FOES.missileTruck`, `BOSS_FOES`, `BOSS_FOE_MAP`, `FOE.missileTruck`); `src/v3/data/mapRules.ts` (`mapDebutsFoe`); `src/v3/sim/foes.ts` (`updateMissileTruck`, `erectorUp`, `markShip`, `truckMark`, `foeEta`, `foeHarmed`); `src/v3/sim/game.ts` (`lobBallistic`); `src/v3/sim/events.ts` (`gateTruck`, `columnGap`, `eventFoeDown`); `src/v3/data/encounters.ts` (`SALTGATE_BOSS_ROUNDS`, `SALTGATE_TRUCK`, `TruckRun.missiles`); `src/v3/ui/foes.ts`, `src/v3/ui/app.ts` (the first-sight card, "LAUNCHER DOWN"); `tools/v3/saltgate/boss.ts` (missiles fired and shot down, the most in the air at once; `--rounds` and `--truck` to try columns).

## Log v42: the trucks (the player's answer)

The player played the v38 card (log `tools/v3/bot-fit/logs/v3-20261120142741-31828.json`): fun 5, difficulty right, effort 4, lost in boss round 2; waves 1–6 rated difficulty 1–2, fun 1–2, intensity 1. Their answer: *"switch the signature for the canal one we can make it the boss the trucks ... like they all drive in and they can shoot missiles, and it could be pretty intense if all the ships are clustered together ... and then we can make the [sub] on a different map that's more open."*

What changed (lab only, under the encounter layer, as every rebuild; the campaign still plays Run the Canal and the old planner):
- **A new boss, the Gatecrashers** (on the map's event, `run-the-canal`, its id kept; `MAP_BOSS.saltgate.name`): columns of Rocket Trucks drive down to the banks by the locks and fire at the ships held there. Three rising rounds (below, "The boss").
- **No Torpedo Sub on the map**, waves or boss (`MAP_FOE_SWAP`: a sub the planner draws comes as a Rocket Truck, as heavy, so the wave sends the same). The Island and the Behemoth Run keep theirs.
- **The signature is "the trucks come to the locks"** (`MAP_SIGNATURE.saltgate`: `foe: 'rocketTruck'`, half the new enemies from wave 4, their salvos at the ships held at a lock, `trucks: 'lock'`), with the wave's clusters at the locks as before (`clusters: 'lock'`).
- **Waves 1–5 a little busier**: a second swarm at the locks on wave 1, the first truck on wave 2, a second guided missile (at the east lock) on wave 3, a truck at the east lock on wave 5, and a little of waves 6–10's fire moved to waves 1–5 (`SALTGATE_CLIMB`, within ±15% a wave, ten in all).
- **A lock-aimed truck marks its ship**: from the moment it starts raising its launcher (2.4 s, the red ring filling round it) and between salvos, a dashed red line runs from the truck to the ship its next salvo is for (`truckMark`, drawn in `ui/foes.ts`). The raise and the mark are the warning; the rockets themselves can't be shot.

Code (log v42):
- `src/v3/data/encounters.ts`: `SALTGATE_BOSS_ROUNDS` (`trucks`: `TruckRun`), `SALTGATE_TRUCK`, `BossTune.name` and `truck`, `MAP_SIGNATURE.saltgate` (`trucks`), `MAP_FOE_SWAP` and `swapFoe`, a beat `from: { road }` with `salvos` and `drive`, `SALTGATE_CLIMB`, waves 1, 2, 3 and 5 of `SALTGATE_R4`;
- `src/v3/data/events.ts`: `eventName` (the boss's name under the layer) and `bossIntroCards`' `name`; `src/v3/ui/app.ts` reads it on the intro cards, the event card and outcome, the result screen and the pause screen's script;
- `src/v3/sim/events.ts`: Run the Canal plays the Gatecrashers when its round has `trucks` (`bankRoad`, `gateTruck`; a wreck stalls the trucks behind it, `eventFoeDown`);
- `src/v3/sim/foes.ts`: a Rocket Truck's `aim`, `mark`, `full` and `clusters` (`lockShip`, `markShip`, `truckMark`); a road truck from an encounter (`Launch.road`, `salvos`, `drive`);
- `src/v3/sim/game.ts`: the planner's swap and the signature's truck aim; `aimBeat` exported (a truck's cluster);
- `tools/v3/saltgate/`: `boss.ts` (the boss round by round: trucks, shot before firing, salvos, clusters, losses), `probe.ts`, `drawn.ts`, `budget.ts`, `compare.py` (the diversity check against the other four maps);
- `tools/v3/combo-sweep/mixwaves.ts`: Saltgate's signature is the Rocket Truck with the clusters and their bomblets.

The rest of this card is the v38 build with the v42 changes folded in; where v38 numbers are kept for comparison they say so.

## The v38 build

Code:
- `src/v3/data/encounters.ts`: `SALTGATE_R4` (ten encounters), a new aim `'lock'`, `SALTGATE_BOSS_ROUNDS` and `MAP_BOSS.saltgate`, `MAP_SIGNATURE.saltgate` (its new `clusters`), `REBUILT_MAPS` (via `CHAPTER_TWO_MAPS`), in the chapter 2 block; a boss round's `subs`;
- `src/v3/data/mapPlans.ts`: `MAP_PLANS.saltgate`;
- `src/v3/data/convoy.ts`: `MAP_CONVOY.saltgate` (the map's own convoy at the campaign's own schedule, no command);
- `src/v3/sim/game.ts`: `aimBeat` reads `'lock'` (`atLock`: a ship in a lock's chamber or queued within 120 px of its entry gate); the signature's `clusters` aim the wave's own cluster missiles, off a silo (the wave planner) or a truck (`updateRaider`);
- `src/v3/sim/events.ts`: Run the Canal reads its rounds from `MAP_BOSS` (`canalRound`: subs, helicopters and their hits, the block, the swarms) and adds a round's own launches (`fire`, as the other chapter 2 bosses do); with no boss tuning it plays as it did;
- `src/v3/data/lab.ts`: "Ready to test" lists Saltgate Canal at v38;
- `tools/v3/combo-sweep/mix.ts`, `mixwaves.ts`: Saltgate among the maps, its signature the torpedo subs with their torpedoes and the clusters with their bomblets.

Bot reports: `tools/v3/map-report/results/saltgate.md` (no Armory), `saltgate-player.md` (the player's usual Armory, with fun measures and the heat map) and `saltgate-latest.md` (the player's latest Armory: Wide Warhead 5, Point Defense 4, Supply Lines 3); log v42; the v38 build: `saltgate-v38*.md`; the map before the rebuild: `saltgate-before*.md`. Tuning reads: the bot as `tools/v3/map-report/quick.ts` plays it, on 48 seeds at a time (900–947 and 948–995).

## The problem

> Two locks stop the convoy: every ship waits still in a chamber while it fills, right under the silos over the locks, so the enemy fires at ships that cannot move, with banks close on both sides and little warning.

Saltgate is the chapter's one map with a mechanic (rule `m-mechanic`): the locks. The canal runs west to east from the West Sea through lock A (the chamber from x 500 to 660), across the Bitter Lake where the carrier anchors (880, 662), through lock B (1140 to 1300) and out into the East Sea. A lock takes what its chamber holds, shuts its entry gate, fills for 6 s and opens its exit; the ships behind wait at the shut gate (`docs/design/v3-saltgate-locks.md`; a full cycle is about 19 s). A ship spends most of its crossing still: in a chamber, or queued at a gate. The silos over each lock stand 200 px from the chamber, on the enemy bank, and your own bank closes in 70 px south of the lane along both locks.

How it differs from the other chapter 2 maps:
- **The Island:** a fortified island beside two lanes; the ships keep moving past it. Here the ships stop, at two set places, on a timer you can read from the gate lights.
- **The Behemoth Run:** one slow ship to escort. Here every ship is slow at the same two places, and none matters more than another.
- **The Needle of Bosk:** a queue at one mouth, nose to tail, because the water narrows. Here the ships stop because a gate is shut, twice, and the danger is the time they sit there (and the silos built over it), not the shape of the water.
- **The Archipelago:** fire from many islets and directions at a lane that keeps moving. Here the fire is mostly from two places, the silos over the locks, at ships that cannot move, with the shortest warning in the chapter.

The mechanic is in the waves (rule `g-mechanic`): nine encounters of ten aim something at a ship held at a lock (`'lock'`; wave 7's jet flies down the canal's line of held ships instead), and so do the signature's clusters and every boss round's added fire.

## Sites and their jobs

Bases and spots are counted from 1, as the pause screen counts them.

| Site | Where | Fires | Its job in the waves |
| --- | --- | --- | --- |
| West shore (base 1) | Enemy shore (220, 150) | drones, shells | The long reach over the West Sea: the first drones at the west lock (w1), the shell into the chamber (w2), swarms at the ships coming in (w3–10). |
| West lock silo (base 2) | Over lock A (580, 240) | guided, clusters | Point-blank at the west lock: the guided missile (w3, w5, w9), the cluster over the chamber (w4, w7, w8, w10, every boss round). |
| Lake silo (base 3) | North of the Bitter Lake (900, 150) | heavies, supersonic | The shared waves' own (the encounters take the heavy out of waves 5, 6, 8, 9 and 10). |
| East lock silo (base 4) | Over lock B (1220, 240) | drones, clusters | Swarms all map (w2–10), the cluster over the east chamber (w8, w10). |
| East shore (base 5) | Enemy shore (1460, 150) | shells, guided | The guided missile at the east lock in boss rounds 1 and 2; the shared waves' own. |
| West Sea (spot 1) | (200, 610) | sub salvos | Shells at the ships coming in (w9); the shared waves' sub salvos. No Torpedo Sub since log v42. |
| East Sea (spot 2) | (1480, 610) | sub salvos | Shells into lock B (w6); the shared waves' own. |
| Pop-up roads (road 1, road 2) | Down to the enemy's bank by each lock's exit (690 and 1330, to y 345) | Rocket Trucks | Log v42: the signature's trucks (from wave 4, at the lock nearest them), the first truck (w2, road 1), the truck at the east lock (w5, road 2); the Gatecrashers' enemy-bank columns turn along the bank over the chamber. |
| Your own bank | Up from the bottom of the screen at the same x, along the bank 29 px south of each lock | Rocket Trucks (boss only) | The Gatecrashers' columns on your bank (rounds 2 and 3). |
| Coast road, air line | The enemy shore; y 610 | launch trucks (shared), strafers, bombers | The shared waves' own; the jet down the canal from the west (w7); a launch truck's clusters go for the locks too (the signature). |

Warning time falls from 8.3 s on wave 1 to 5.0 s on wave 10 (−0.28 s a wave, rule `g-warning`), and 4.8–5.0 s in the boss rounds. Wave 1's drones come the long way, over the West Sea from the west shore; from wave 3 the lock silos fire from 200 px, and the shortest warning on the map is a guided missile off the west lock's silo into the chamber below it. Before the rebuild the warning fell further, 9.0 to 3.8 s, because the shared waves' shells and heavies came at the queues from the far silos and the subs.

## The stretches

The bot report cuts the lane into thirds along it: the early third is the West Sea and the queue at lock A's entry gate (the ships wait at x 456, short of the chamber); the middle is lock A's chamber and the Bitter Lake; the late third is lock B and the East Sea.

- **Danger: the middle**, lock A's chamber and the lake: 45% of the hull damage in waves 1–9 (the player's Armory; 41% with the latest Armory, 45% with none). The guided missiles and clusters off the west lock's silo land there, on the ships waiting in the chamber, and the swarms aimed halfway along cross it.
- **Safe: the West Sea**, the early third: 23% of the hull damage (passes, under the 25% line; 24% with the latest Armory; 26% with none, over it). The encounters' swarms from the west shore go at any ship, not the ships coming in, and only wave 9's periscope aims there. It is safe by damage, not by sinkings: 40% of the ships sunk in waves 1–9 sink there (59% over every wave), because the signature's torpedo subs in the West Sea sink the ships queueing for lock A outright.
- `MAP_PLANS.saltgate.stretches` says danger middle, safe early (the map as it was: hot early 55%, cold late 20%: the shared waves' fire found the queue at lock A first).
- The danger stretch is the carrier's own third (the carrier anchors in the lake at x 880; lock A's chamber is 220–380 px west of it, rule `m-carrier` asks for the danger stretch not to be the closest). The reach is short; the warning is what is missing: the silo over the lock is 200 px from the chamber.

## The convoy

The map's own convoy, no command (rule `m-convoy`): pairs at the campaign's own schedule (`MAP_CONVOY.saltgate`: flow 1, pairs, as Sowers' Reach; the other chapter 2 maps sail flow 2). The locks do the shaping (rule `m-shape-convoy`): each chamber takes what it holds, shuts and fills, so the ships sail in short bursts and wait, bunched and still, at each gate. At flow 2 more ships stood queued at the gates at once: on the same early build of the encounters the bot lost about as many ships in waves 1–10 (5.0 against 4.9) but far more in the boss rounds (2.0 / 1.9 / 2.3 against 0.8 / 1.0 / 2.3 a round) and won 6% of 48 runs against 31%: the canal sets the pace, so the schedule is the campaign's. No command: the gates hold the ships already. The map card now opens on policy D with the encounters on (it opened on today's convoy controls and no encounters).

## The signature: the trucks come to the locks (log v42)

The player's round 9 (r9-map-signature): each map gets a threat of its own in waves 4–10, tied to its identity and its boss. Saltgate's boss is now the Gatecrashers, so its signature is the boss's own enemy early (`MAP_SIGNATURE.saltgate`, from wave 4):

- **Rocket Trucks** for half the wave's new enemies (rounded up: one on waves 4–9, two on wave 10; and any Torpedo Sub the planner draws on waves 2–10 comes as a truck too, `MAP_FOE_SWAP`), the wave planner's rule (each stands in for a drone swarm and a missile, rule `w-budget`). Each drives down a pop-up road to the enemy's bank by a lock's exit (690 or 1330), raises its launcher (2.4 s, the red ring) and fires its salvos at the ship held at the lock nearest it, marking each ship first. It takes 4 hits and can be shot all the way in: the play is to kill it on the road.
- **The wave's own cluster missiles** go for the ship held at the lock nearest their launcher (aim `'lock'`), off a silo or a launch truck, as at v38.

How much of waves 4–10 it is (`tools/v3/combo-sweep/mixwaves.ts`, 4 seeds, the "you" bot drafting for itself, tough; trucks, clusters and their bomblets), log v42:

| | Waves 4–10 | Waves 6–10 | Boss rounds |
| --- | --- | --- | --- |
| Share of the threats that show | 14% | 15% | 71% |
| Share of the hits it takes to clear them | **20%** | 19% | 89% |

A fifth by hits, a little under the v38 signature's 23% (its subs counted 3 hit points each though nothing could hit them) and under the asked "about a quarter": a truck is one threat of 4 hits, where a sub was a periscope and two torpedoes. The trucks alone are 5% of what shows.

### Log v38–v41: a strike on the locks

Torpedo Subs for half the wave's new enemies (rounded up), in the West or East Sea, out of reach, firing two slow torpedoes one by one at the queue for lock A and the ships leaving lock B, plus the clusters at the locks: 24% of the threats that show in waves 4–10, 23% by hits. The player asked for the subs on a more open map (the Island and the Behemoth Run have them).

## The counters

- **Counter kit: Point Defense, Gunship Pair, Supply Run.** The fire comes point-blank off the lock silos and from the seas at ships that cannot move: each ship's own Point Defense needs no warning and no reach; the Gunship Pair's rockets go for the thickest bunch of ships, a full chamber; Supply Run keeps the rack full through the long waits at the gates.
- **Off-counter kit: Seeker Pod, Shield, Full Steam.** The Seeker's long flight is too late for a silo 200 px from its target; the Shield breaks after its 1–3 hits, and a cluster over a full chamber spends them at once; Full Steam hurries the ships only between the gates (they spend most of the crossing waiting at them).
- Every weapon is in chapter 2's draft.

How they compare (the player's Armory):

| | Ships lost, all 13 waves | Won |
| --- | --- | --- |
| Counter kit, forced (combo sweep's `check-one.ts`, 16 seeds) | **6.6** ±0.6 | 75% |
| Off-counter kit, forced (16 seeds) | 10.3 ±1.0 | 38% |
| The bot drafting for itself (combo sweep singles, 12 seeds) | see "Loadouts" | |
| Counter kit as the bot's taste (bot report, 24 seeds) | 3.2 in waves 1–10 (3.3 tough) | 63% |
| Off-counter kit as taste (bot report) | 3.7 in waves 1–10 (4.3 tough) | 58% |
| With the latest Armory, as taste: counter / off-counter | 4.5 / 5.3 in waves 1–10 | 25% / 4% |

Forced, the counter kit loses 3.7 ships fewer and wins twice as often. As the bot's taste the gap is smaller (63% against 58%; a ship fewer on the tough runs). Two kits tried first: Point Defense + Railgun + Scattergun against Thermobaric Shell + Tesla Arc + Full Steam read 7.7 against 8.6 forced but won 56% against 63%, so they were not used. Full Steam is in the map's best kit below (with Air Strike and the Gunship Pair): it is weak alone (9.1) and the off-counter kit as a whole is clearly worse, but it is not useless here.

## Loadouts on this map (combo sweep singles, log v42)

Each weapon alone, forced at every draft (12 seeds, the player's Armory, game version 42; `npm run v3:combo-sweep -- --stage=singles --maps=saltgate --out=tools/v3/combo-sweep/results/v42-ch2`). Ships lost over all 13 waves:

- **Strong:** **Thermobaric Shell 4.8**, Gravity Well 5.0, Frigate Escort 5.1, Point Defense 5.7, Air Strike and Seeker Pod 5.9.
- **Middling:** Boomerang 6.1, Scattergun 6.3, Flak 6.6, Drone Screen 6.8, Supply Run alone 7.0, Gunship Pair and Shield 7.2, Tesla 7.3, Full Steam and Shrapnel 7.5.
- **Weak:** Overdrive 8.0, Railgun 8.4, the Charge Lance (the bot charges it poorly) and the Laser Cutter (the bot can't swipe).
- The trucks moved the order: the area weapons that catch a column on the road (Thermobaric, the Gravity Well) and the ones that need no aim (the Frigate Escort) lead; Point Defense, the best alone at v38 (5.8), is fourth. 12 seeds is a standard error of about a ship: the top six are close.
- v38 for comparison: Point Defense 5.8, Scattergun 6.0, Air Strike 6.3, Frigate Escort 6.8, Drone Screen 6.9.

## Diversity: are Saltgate's best kits its own? (log v42)

The player's rule for this rebuild: Saltgate's best kits and its best weapon alone must differ from the other four chapter 2 maps', and Air Strike, already the best single on three of them, should not become a fourth's. Saltgate was swept again at version 42 the same way as at 38: singles on 12 seeds, every pair on 6, its 6 best pairs with every third weapon on 6, its 10 best kits on 16 (`tools/v3/combo-sweep/diversity.ts`, results in `tools/v3/combo-sweep/results/v42-ch2/`; `python3 tools/v3/saltgate/compare.py` for the comparison; docs/design/v3-combo-diversity.md, "Saltgate Canal"). The other four maps are read from their version 37 sweep (`results/v37-ch2/`), as at v38; they were not swept again at v41 (the cluster climb and the sub sites changed them a little).

| Map | #1 | #2 | #3 | #4 | #5 |
| --- | --- | --- | --- | --- | --- |
| The Island (v37) | **Air Strike + Thermobaric Shell + Point Defense** 6.6 | Air Strike + Point Defense + Gunship Pair 7.8 | Flak Cannon + Drone Screen + Gunship Pair 8.4 | Air Strike + Point Defense + Drone Screen 8.4 | Railgun + Tesla Arc + Overdrive 8.6 |
| The Behemoth Run (v37) | **Air Strike + Drone Screen + Supply Run** 4.0 | Air Strike + Drone Screen + Full Steam 4.7 | Frigate Escort + Gravity Well + Shield 5.2 | Air Strike + Gravity Well + Drone Screen 5.6 | Thermobaric Shell + Flak Cannon + Full Steam 5.9 |
| The Needle of Bosk (v37) | **Scattergun + Railgun + Supply Run** 5.3 | Shrapnel Shell + Gravity Well + Gunship Pair 6.2 | Shrapnel Shell + Railgun + Supply Run 6.9 | Shrapnel Shell + Flak Cannon + Gunship Pair 7.3 | Gravity Well + Railgun + Supply Run 7.3 |
| The Archipelago (v37) | **Air Strike + Shrapnel Shell + Gravity Well** 3.2 | Air Strike + Frigate Escort + Gunship Pair 3.6 | Air Strike + Shrapnel Shell + Overdrive 3.8 | Air Strike + Overdrive + Full Steam 3.8 | Air Strike + Frigate Escort + Seeker Pod 3.9 |
| **Saltgate Canal (v42)** | **Air Strike + Boomerang + Tesla Arc** 5.1 ±0.7, won 88% | Air Strike + Gunship Pair + Supply Run 5.2 | Shrapnel Shell + Thermobaric Shell + Railgun 5.4 | Air Strike + Boomerang + Railgun 5.8 | Air Strike + Scattergun + Railgun 5.9 |

| Measure | v42 | v38 |
| --- | --- | --- |
| Jaccard of the top-5 kits, Saltgate against the Island / the Behemoth Run / the Needle / the Archipelago | **0 / 0 / 0 / 0** | 0.11 / 0 / 0 / 0 |
| The same, Saltgate against itself (two halves of its seeds) | 0.25 | 0.67 |
| #1 kit | its own (no other map's top 5 has it) | its own |
| Best weapon alone | **Thermobaric Shell** 4.8 (Gravity Well 5.0, Frigate Escort 5.1; Air Strike 5.9, fifth) | Point Defense 5.8 |
| Rank correlation of the weapons alone, Saltgate against the Island / the Behemoth Run / the Needle / the Archipelago | 0.43 / 0.58 / 0.49 / 0.57 | 0.70 / 0.84 / 0.35 / 0.60 |

- **Saltgate's five best kits are all its own** (none in another map's top 5; at v38 one was the Island's #1), and its best weapon alone is not Air Strike (Thermobaric Shell; Air Strike fifth).
- **Air Strike is still in four of its five best kits**, as on the Archipelago and the Behemoth Run.
- **The weapons alone rank less like the other maps' than at v38** (the Behemoth Run 0.84 → 0.58, the Island 0.70 → 0.43): the trucks reward area weapons on the road, not only the point-blank answer to the silos.
- **The halves agree less** (0.25, was 0.67): the top kits are within a standard error of each other, so the order among them is noise; that they are Saltgate's own is not (no other map's top 5 is among Saltgate's ten best).

## The debut

None of its own. Saltgate's slot is the Torpedo Sub (`mapDebut`): the planner draws one on wave 3 here, which comes as a Rocket Truck since log v42 (`MAP_FOE_SWAP`), but every chapter 2 enemy already comes in on the Island, one a wave from wave 2 with a light debut wave each (see the Island's card), so no wave debut is due here (the Needle's and the Archipelago's cards say the same). Log v46: the boss brings one, the **Missile Truck**, a boss-only chapter 2 enemy announced "New on The Narrows: Missile truck" at its first sight (see "Log v46"). Nothing from a later chapter: the encounters send only drones, shells, guided missiles, clusters, a strafer and (log v42) Rocket Trucks, a chapter 1 enemy, from wave 2 (`tests/v3/encounters.test.ts`).

## The ten waves (v1, encounter rev 4)

One encounter a wave, none repeated. Every shell the shared wave would send from wave 2 on comes out of the wave (a sub fills a salvo of 4 whatever it is given, and shells land where they are aimed on a ship that cannot move), so its submarines carry drones instead; the encounters put back a shell or two where the map wants them. From wave 5 they also take out the wave's heavy (4 damage: it sinks a cargo ship) and some of its clusters, and send drones in their place. The wave keeps its launches (×0.91–1.04 of the shared wave, planned on 8 seeds; rule `w-budget`). No call-out names a site.

| Wave | Role | Encounter (`id`) | What it sends | Target |
| --- | --- | --- | --- | --- |
| 1 | teach | At the first lock (`saltgate-first-lock`) | west shore, 3 drones; then east lock silo, 4 drones (log v42) | the ship held at the lock nearest each silo |
| 2 | teach | Shells into the chamber (`saltgate-chamber`), call-out "A truck at the lock" | west shore, 1 shell; **a Rocket Truck down road 1** (2 salvos, in at 1.8 ×; log v42); east lock silo, 4 drones | the west lock (shell and truck); any ship; in place of the wave's 2 shells and a swarm |
| 3 | teach | Both locks (`saltgate-both-locks`) | west lock silo, 1 guided; east lock silo 4 and west shore 4 drones; **east shore, 1 guided** (log v42) | the ship in the west lock, point-blank; the east lock; any ship; in place of the shells and the guided missile (the planner's truck comes with the wave, log v42) |
| 4 | combine | A cluster over the chamber (`saltgate-cluster`) | west lock silo, 1 cluster; west shore 4 and east lock silo 4 drones | the west lock; any ship; in place of the shells and the cluster (the signature's first truck comes with the wave) |
| 5 | combine | Two gates (`saltgate-two-gates`) | west lock silo, 1 guided; **a Rocket Truck down road 2** (3 salvos, in at 1.8 ×; log v42); east lock silo 5 and west shore 5 + 5 drones | the west lock; the east lock (the truck); any ship; in place of the shells, guided missiles, the heavy, a cluster and a swarm |
| 6 | combine | A periscope off the gate (`saltgate-periscope`) | East Sea sub, 3 shells; west shore 5 + 3 and east lock silo 5 drones | the east lock; any ship; in place of the shells, guided missiles and the heavy |
| 7 | escalate | Down the canal (`saltgate-strafe`) | a jet from the west; east lock silo 5 + 5 and west shore 5 drones | the canal, every held ship in a line; any ship; in place of the shells, a cluster and a jet |
| 8 | escalate | Both chambers (`saltgate-both-chambers`) | a cluster off each lock silo, 6 s apart; west shore 5 + 4 + 3 and east lock silo 4 drones | both locks; halfway along; any ship; in place of the shells, both clusters, the heavy and a jet |
| 9 | escalate | Gate by gate (`saltgate-gate-by-gate`) | west lock silo, 1 guided; West Sea sub, 3 shells; east lock silo 4 + 5 + 5 and west shore 5 drones | the west lock; the ships coming in; halfway along; in place of the shells, guided missiles, a cluster and the heavy |
| 10 | climax | Through both locks (`saltgate-climax`), the clusters after the wave's own fire (`at: 1`) | a cluster off each lock silo, 4 s apart; five swarms of 4 all wave | both locks; halfway along; any ship; in place of the shells, most guided missiles, the heavy, the clusters, a supersonic and a jet |

Wave 1 loses no ship (all three reports). Log v42: the wave's own budget moves a little from waves 6–10 to waves 1–5 (`SALTGATE_CLIMB`: ×1.08, 1.1, 1.1, 1.06, 1.04, then 0.88, 0.9, 0.94, 0.88, 0.96; ten in all), and a truck an encounter sends stands in for a swarm of the wave's own (it takes 4 hits and fires 2–3 salvos).

## The boss: the Gatecrashers, a missile parade (log v46; superseded at v62, see "Log v62" at the top)

The map's event under the encounter layer is a parade of Missile Trucks (`SALTGATE_BOSS_ROUNDS`, `SALTGATE_TRUCK`; the event's id stays `run-the-canal`, its name on every card is "Gatecrashers"; the campaign and a rev 3 log play Run the Canal as it was). Columns set out on the enemy's bank (`north`) down the pop-up road by a lock's exit, then west along the bank 29 px from the lock's water; on your own bank (`south`) up from the bottom of the screen and along the bank the same way. Nose to tail, 85 px apart: the first parks just short of the entry gate, the rest behind it along the bank and up the road, all at once, so the column raises its missiles together (2.6 s, the rings and the mark lines) and fires one volley, each missile at a held ship of its own. A drone swarm of 5 comes 11 s in. No Rocket Truck, no cluster.

| Round | Columns | Missile Trucks | Missiles | Most in the air at once (bot) |
| --- | --- | --- | --- | --- |
| 1: a short column | the west lock, enemy bank | 8 | 8 | 4.3 |
| 2: both banks | the west lock: 5 on the enemy bank, then 4 on your bank from 1.5 s | 9 | 9 | 6.4 |
| 3: the big parade | west lock enemy bank 3 (0 s), east lock enemy bank 2 (0.8 s), west lock your bank 3 (1.6 s), east lock your bank 2 (2.4 s) | 10 | 10 | 7.4 |

- **The volleys:** each column fires as one; in round 3 the four columns' volleys come within about 2.5 s of each other, so with every truck up 10 missiles are in the air together (7.4 on average on the bot, which kills some on the road). The bot shoots 2.1–3.0 trucks a round before they fire and 2.5–3.1 missiles in the air (`tools/v3/saltgate/boss.ts`, 48 seeds, the player's Armory).
- **Ships lost a round** (the player's Armory, runs that reached it): **0.70 / 1.52 / 2.03** on 96 seeds (`quick.ts`, 900–995); 0.50 / 1.91 / 1.95 on the record's 24 (0.58 / 1.83 / 2.04 tough). v42's Rocket Trucks: 0.99 / 1.61 / 1.81 (96 seeds).
- **Under the asked 1.5 / 2 / 2.5 (most in round 1), on purpose,** as at v42: the three rounds share one loss limit, and the win rate asked is 50–70%. The tries: 6 / 9 / 12 trucks of 5 hits read 1.38 / 2.41 / 2.56 and won 21%; 7 / 9 / 11 at 58 px won 49%; this build wins 60% on 96 seeds. Round 1 is the one that falls short: the bot kills 3 of its 8 trucks on the road and 3 of the 5 missiles in the air.
- **85 px apart, not 58:** at 58 px a column was close enough for the latest Armory's Wide Warhead to blast several trucks at once (it killed 6.4 of 7 before they fired; the bot lost 0 / 0.05 / 0.37 a round and won 79%). At 85: 0.37 / 0.89 / 2.06, won 63%.
- **Each round lasts 15–30 s** (the bot: 23, 20 and 19 s; the test: seed 204, the tryhard bot with no weapon).
- The intro cards are the shared ones: "Boss round", "Convoy restored", "The boss: Gatecrashers", "Boss 1/3".
- Tuning reads: `npx vite-node tools/v3/saltgate/boss.ts -- --seeds=48 [--armory=latest] [--rounds=<json>] [--truck=<json>]`.

### Log v42–v45: columns of Rocket Trucks

Columns of Rocket Trucks down to the banks by the locks, 58 px apart: round 1 eight on the enemy bank by the west lock (2 salvos each), round 2 four and four from both banks, round 3 a charge of 13 at both locks, the last truck of each enemy-bank column firing a cluster missile over the chamber. Each salvo a ripple of five red rockets (not shootable) at the ship held at the lock nearest it. On the bot: 0.64 / 1.82 / 2.00 (24 seeds), 0.99 / 1.61 / 1.81 (96). The player's review: "we already have a rocket truck convoy. make it the missile trucks".

### Log v38–v41: Run the Canal, rising

Torpedo Subs as the round opens (3 a round), an attack helicopter over the far bank by a lock (1, 1, then 2), a block of armored drones (4, 6, 6), drone swarms of 5 (2, 3, 3), clusters off the lock silos (1, 1, 2) and a guided missile from the east shore (rounds 1 and 2). On the bot at v38: 0.95 / 1.54 / 1.78 (96 seeds); the subs were most of its teeth.

## Bot results, log v46 (the missile parade; v62's are under "Log v62" at the top)

Waves 1–10 play the same game as at v42 (every change is the boss's), so only the boss and the win rate move. Reports: `tools/v3/map-report/results/saltgate-player.md`, `saltgate-latest.md`, `saltgate.md` (24 seeds, 900–923); v42's are kept as `saltgate-v42*.md`. The quick reads are `quick.ts` on 96 seeds (900–995) for the player's Armory, 48 (900–947) for the others.

| | v42 (Rocket Trucks) | v46 (Missile Trucks) |
| --- | --- | --- |
| **The player's Armory: won** | 67% (24 seeds); 62% (96) | 46% (24 seeds); **60%** (96: 52% and 69% on the halves) |
| Boss r1 / r2 / r3 (normal, reached), 96 seeds | 0.99 / 1.61 / 1.81 | **0.70 / 1.52 / 2.03** |
| Boss r1 / r2 / r3, the record's 24 seeds (tough) | 0.64 / 1.82 / 2.00 (0.71 / 1.83 / 2.42) | 0.50 / 1.91 / 1.95 (0.58 / 1.83 / 2.04) |
| **The latest Armory: won** | 75% (24); 79% (48, at v46 with the trucks 58 px apart) | 63% (24 and 48) |
| Boss r1 / r2 / r3 (normal, reached) | 0.37 / 1.32 / 0.74 (24) | 0.32 / 1.05 / 2.00 (24); 0.37 / 0.89 / 2.06 (48) |
| **No Armory: won** | 8% (24) | 13% (24); 17% (48) |
| Boss r1 / r2 / r3 (tough) | 2.13 / 2.33 / 3.08 | 1.25 / 2.38 / 2.25 |
| Checks | as at v42 | as at v42 (waves 1–10 unchanged): with the player's Armory `w-budget` FLAG on its line (w10 ×0.85), the fun check's saves FLAG; the rest PASS |

- **The win rate is inside 50–70% on 96 seeds** (60%), at the bottom of it on the record's 24 (46%: 24 seeds is ±10%).
- **The boss rises** 0.7 → 1.5 → 2.0 with the player's Armory, and now with the latest one too (it was 0.37 / 1.32 / 0.74).
- **The latest Armory's boss is no longer the easiest:** Wide Warhead still thins a column, but it can't take it in a few blasts.
- **No Armory** wins a little more (13–17% against 8%): fewer, slower threats than v42's 13-truck charge with its clusters.

## Bot results, log v42 (24 seeds, 900–923)

"v38" is the map card as built at log v38 (`tools/v3/map-report/results/saltgate-v38*.md`). At log v41 (the chapter 2 notes batch: clusters climb 1.3 s before they split, torpedo subs only at good sites) the v38 Saltgate read harder: the bot with the player's Armory won 42% (was 52–58%), waves 1–5 0.65. "v42" is this build, on top of v41. Commands: `npx vite-node tools/v3/map-report/report.ts -- --map=saltgate --seeds=24 --kits=plan [--armory=player | --armory=latest] [--no-fun]`.

### The player's Armory (Quick Reload 5, Damage Control 4, Stockpile 5)

| | v38 | v42 |
| --- | --- | --- |
| Won (normal) | 58% (v41: 42%) | **67%** (96 seeds: 62%, 63% and 60% on the halves) |
| Mean end wave | 13.0 | 13.3 |
| Ships lost in waves 1–10 (normal) | 3.3 | 1.6 |
| Ships lost in waves 1–5 (normal) | 0.50 (v41: 0.65) | **0.29** (96 seeds: 0.23) |
| Boss r1 / r2 / r3 (normal, reached) | 0.85 / 1.50 / 1.56 | **0.64 / 1.82 / 2.00** (96 seeds: 0.99 / 1.61 / 1.81) |
| Boss r1 / r2 / r3 (tough) | 0.96 / 1.46 / 2.04 | 0.71 / 1.83 / 2.42 |
| Tough curve 1–10 | 0 0 .17 .21 .13 .50 .33 .54 .63 1.08 | 0 .04 .04 .08 .13 .25 .17 .42 .38 .21 |
| `w-cliff` | PASS | PASS (biggest step w8 +0.25) |
| `w-early` close calls from w3 | PASS | PASS (fewest w3 1.29, 88% of runs) |
| `w-budget` | PASS | **FLAG**, on the line: w10 ×0.85 (the band is ×0.85–1.15) |
| `m-stretches` | PASS: hot middle 45%, cold early 23% | PASS: hot middle 43%, cold early 22% |
| `g-warning` | PASS: 8.3 → 5.0 s | PASS: 8.1 → 5.2 s |
| `w-first` | PASS | PASS |
| Kits (lost 1–10; end wave) | counter 3.2, off-counter 3.7 | counter 1.9 (13.7), off-counter 2.5 (13.1) |

### The player's latest Armory (Wide Warhead 5, Point Defense 4, Supply Lines 3)

| | v38 | v42 |
| --- | --- | --- |
| Won (normal) | 25% | **75%** |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.3 / 1.13 | 3.3 / 0.63 |
| Boss r1 / r2 / r3 (normal, reached) | 1.00 / 2.00 / 1.80 (10 runs) | 0.37 / 1.32 / 0.74 (19 runs) |
| Boss r1 / r2 / r3 (tough) | 0.96 / 2.79 / 3.50 | 0.46 / 1.29 / 1.17 |
| Tough curve 1–10 | 0 0 .08 .38 .67 .67 .67 2.13 1.58 1.54 (7.7) | 0 .08 0 .25 .29 .21 .33 .83 .83 1.04 (3.9) |
| Checks | `w-cliff` FLAG (w8) | `w-cliff` FLAG (w8 0.33 → 0.83), `w-early` FLAG (w5 0.83 close calls a run), `w-budget` FLAG (w6 ×0.84); the rest PASS |

### Baseline (no Armory)

| | v38 | v42 |
| --- | --- | --- |
| Won (normal) | 0% | 8% |
| Ships lost in waves 1–10 / 1–5 (normal) | 5.9 / 1.38 | 5.5 / 1.38 |
| Boss r1 / r2 / r3 (tough) | 1.42 / 5.13 / 5.75 | 2.13 / 2.33 / 3.08 |
| Tough curve 1–10 | 0 0 .08 .50 .79 .96 1.79 1.92 2.63 3.21 (11.9) | 0 .17 .17 .46 .58 1.00 1.08 1.50 2.42 2.63 (10.0) |
| Checks | `m-stretches` FLAG | `w-early` FLAG (w5 0.83), `w-budget` FLAG (w2 ×0.85, w6 ×0.83); `w-cliff` and `m-stretches` PASS |

### Chapter 2 difficulty (rule `m-difficulty`)

With the player's Armory the bot wins 67% on the record's 24 seeds and 62% on 96, inside the 50–70% asked (it was 42% at v41 with the subs). The boss rises (0.64 / 1.82 / 2.00 on 24 seeds, 0.99 / 1.61 / 1.81 on 96) but sits under the asked 1.5 / 2 / 2.5 in rounds 1 and 3: see the boss section. Waves 1–5 lose 0.23–0.29, under the 0.4–0.8 asked: the early trucks are visible action, but the bot shoots them on the road before they fire (in the tuning reads the bot killed every wave truck of waves 2–5 before its first salvo).

## Fun measures (provisional, `src/v3/sim/funMetrics.ts`)

From `saltgate-player.md` (log v42):
- **Tension:** its peak is 0.13, 0.32, 0.34, 0.44, 0.45 on waves 1–5 (v38: 0.19, 0.36, 0.39, 0.53, 0.51), 0.55–0.75 on waves 6–10, flat in nearly every run before wave 6. Boss rounds 0.51 / 0.63 / 1.77, one peak in 82% of round 3's runs: the charge is where the map gets tense.
- **Close calls** from wave 2: 1.3 or more a run on every wave 3–10 (wave 3 the lowest, 1.29, 88% of runs).
- **Saves:** 0–0.3 a run (the fun check flags it, as on every chapter 2 map).
- The bot's tension does not see the early trucks: it reads threats near impact, and the bot kills a truck on the road, seconds before it could fire. Whether the trucks lift waves 1–5 for the player is a play question.

## What is not satisfied, or uncertain

Log v46 (the missile parade):
- **The boss is under the asked 1.5 / 2 / 2.5 in round 1** (0.7 / 1.5 / 2.0 on 96 seeds), traded for the win rate (60%), as at v42: at about 1.3 / 2.6 / 2.5 the bot won 21%. The bot kills a short column on the road; whether a person does is a play question.
- **The record report's 24 seeds read 46% won** (under 50%), the 96-seed read 60%. 24 seeds is about ±10%.
- **A column longer than the bank parks up its road:** with the trucks 85 px apart, three park along the chamber and the rest up the road, the eighth of round 1 near the top of the screen. They lob from there (their arcs a little lower, to stay on screen).
- **The boss-only enemy has no Test Lab enemy card** and isn't in Free Play's Enemies list (it needs the canal's locks and banks to mean anything).
- **The signature in waves 4–10 is still the Rocket Truck** (unchanged: the review was of the boss). `mixwaves.ts`'s boss column above counts the v42 boss.
- **A Missile Truck's ballistic reads the lock gates** (a ship held at a shut gate is aimed where it waits); a silo's ballistic still aims as if the ship sails on, as before (unchanged, so waves 1–10 play as they did).

Log v42:
- **The boss is under the asked 1.5 / 2 / 2.5 in rounds 1 and 3** (0.64 / 1.82 / 2.00 on the record's 24 seeds, 0.99 / 1.61 / 1.81 on 96). The three rounds share one loss limit: at 1.51 / 2.12 / 2.49 the bot won 19% (asked 50–70%). Round 2 sends as many trucks as round 1, split over both banks (it reads harder on the bot), not more.
- **Waves 1–5 lose 0.23–0.29 for the bot**, under the asked 0.4–0.8 (v38: 0.50; v41: 0.65): the subs' torpedoes were the early losses, and the bot shoots the early trucks before they fire. The action added (a swarm, three trucks, a missile) is visible; it does not sink ships for the bot. A harder early truck (faster, or firing sooner) is the lever if you want more.
- **`w-budget` is on its line:** wave 10 sends ×0.85 of the no-encounter wave with the player's Armory (the band is ×0.85–1.15), wave 6 ×0.83–0.84 with the latest Armory and none. The climb takes 4–12% off waves 6–10 and the encounters take a little more; a truck stands in for a swarm, so the count of launches falls while the threat does not.
- **The signature is a fifth of waves 4–10 by hits** (20%), a little under "about a quarter" (v38: 23%).
- **The latest Armory's cliff at wave 8** (0.33 → 0.83, tough) stays, as at v38; it now wins 75% (25% at v38).
- **Diversity was read against the other maps' v37 sweep**, not re-swept at v41.
- **Lab only:** the campaign's Saltgate still plays Run the Canal and the planner's subs (as every rebuild: the encounter layer is lab only). Making the Gatecrashers the campaign's boss would change the campaign's game (a new event or a changed one).
- **The safe stretch** (the West Sea, early third) takes 22% of the hull damage (under the 25% line), the danger stretch is the middle (lock A's chamber and the lake, 43%), as at v38; the danger stretch is the carrier's own third against rule `m-carrier`'s letter.
- **The convoy sails the campaign's schedule (flow 1)**, as at v38.
- **Wave 7 aims nothing at a lock**, as at v38.
- **Waves 6 and 9 keep their periscopes** (a sub lobbing shells from the West or East Sea): they are launch subs, not Torpedo Subs, and stay; say if you want them out too.

## The play log (v62)

`LOG_VERSION` 62, `LOG_REPLAYS` `[62]` (`src/v3/sim/playlog.ts`), after 61 (the Tide).
- The change is lab only, under the encounter layer. The campaign plays Run the Canal as it did. A Saltgate card log before v62 no longer replays to the same game.
- The map-lab baseline (the Strait, the Gauntlet and Harbor) was rewritten with `--write`. Only its version changed, and it replays exactly with telemetry on and off.
- The pins moved with `pins.py 61 62`, and `scorecard.test.ts` pins 62.
- Merged with the rail cleanup (#229, still log 61) before the e2e run.
- Ready to test lists Saltgate at v62.

## The play log (v46)

`LOG_VERSION` 46, `LOG_REPLAYS` `[46]` (`src/v3/sim/playlog.ts`); after 44 (the Armory rework, #209) and 45 (the Battery rebuild, #210), both merged into this branch first; the bot numbers above were read on the merged build too (the same to the run). The change is lab only, under the encounter layer, but it adds a threat kind (`missileTruck`), so every log's counts carry it: the map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and state hashes (the same runs, the same numbers), was rewritten with `--write`, and replays exactly with telemetry on and off. The version pins moved to 46 (`tools/v3/playtest-fixes/pins.py`). "Ready to test" lists Saltgate Canal at v46 ("Boss: a parade of missile trucks. Kill them as they raise, or shoot the missiles. Intense?").

Log v42:

`LOG_VERSION` 42, `LOG_REPLAYS` `[42]` (`src/v3/sim/playlog.ts`); 41 is the chapter 2 notes batch (#204), merged into this branch first. The change is lab only, under the encounter layer: the campaign plays as it did, and a v41 Saltgate card log no longer replays to the same game. The map-lab baseline (the Strait, the Gauntlet and Harbor) changed only its version and was rewritten with `--write`; it replays exactly with telemetry on and off. The version pins in the tests and e2e scripts moved to 42 (`tools/v3/playtest-fixes/pins.py`). The Test Lab's "Ready to test" lists Saltgate Canal at v42 ("Trucks come to the locks: shoot them on the road. Boss: a truck assault. Intense?"). The other four chapter 2 maps play the same game at v42 as at v41 (every change is keyed to Saltgate's data).

(Log v38: the rebuild itself, `LOG_REPLAYS` `[38]`; a v37 Saltgate card log played today's convoy controls with no encounters.)

## Questions for the player

- **The missile parade is rising but under 1.5 / 2 / 2.5 on the bot (0.7 / 1.5 / 2.0, log v46), so the bot wins 60%. Raise it and accept fewer wins?** At about 1.4 / 2.4 / 2.6 the bot won 21% (v42's trucks: 1.5 / 2.1 / 2.5 won 19%). Recommended: play it first; the bot read chapter 1's bosses 1.4–2.5× as hard as you did.
- **Waves 1–5 lose few ships for the bot (0.2–0.3); the trucks are there to be shot on the road. Busier enough, or should an early truck be faster and harder to stop?** Recommended: judge from your play; the bot shoots trucks better than a person on a phone.
- **The periscopes on waves 6 and 9 (shells from a sub in the sea): keep, or take out with the torpedo subs?** Recommended: keep; they are the seas' only fire and are not the torpedo subs you named.
- **Make the Gatecrashers (the missile parade) the campaign's boss on Saltgate too?** Recommended: yes once you have played it on the card; it changes the campaign (and its logs).
- **The Missile Truck is boss only. Should it also come in waves (on Saltgate's signature, or later maps)?** Recommended: keep it the boss's own for now, so the parade is the first time you see it.
- **Saltgate's convoy sails the campaign's schedule (flow 1), the other chapter 2 maps' flow 2. Keep it?** Recommended: keep.

## Tests

Log v62 (`tests/v3/encounters.test.ts`, "Saltgate Canal's boss rounds (log v62 ...)"):
- **A parade every round:** Missile Trucks only (no Rocket Truck, sub, gunship, block, cluster or swarm). Each round is 15-30 s (seed 204, the tryhard bot). Every round's gap is inside 1-3 s and denser round on round. The patterns are as above: round 1 ripples, round 2 pairs and ripples at alternate locks, round 3 sync and sweep, closing on the sweep.
- **The parade, deterministic (new),** seed 208, waves 11-13, nothing shot, every hull kept afloat:
  - the same seed plays the same spawns, launches and lobs;
  - a truck enters every 1-3 s (inside the round's own gap), along a road from off the west edge to off the east edge;
  - no truck ever stops or slows (its distance along the road grows every step at its full speed);
  - every missile is launched from a truck that moved that step, on screen;
  - every launch laid fires;
  - at least 70% of the round's beats play, with every pattern of the round;
  - a ripple or sweep rolls one launch at a time, `step` apart, a ripple 2+ trucks on average; a sync fires at one instant; pairs two at a time; round 3 has a volley of 3+ and a barrage of 4+; alternate beats aim at both locks;
  - more missiles each round.
- **Shot on the road and while it raises:** the parade drives on past a wreck. A truck marks a ship mostly held at a lock and lobs a ballistic (at least 3 s, mostly 150 px high) that can be shot down.

The v46 entries below are kept for history.

- `tests/v3/encounters.test.ts`:
  - the ten listed, rev 4, v1 only; the budget, legality (a Rocket Truck down a pop-up road from wave 2, a chapter 1 enemy), warning (a road truck comes, tagged) and replay checks cover the map;
  - the `'lock'` aim: each launch goes for a ship held at the lock nearest its launcher; every wave but wave 7 aims at a lock;
  - the Gatecrashers (log v46): a rev 3 log and the campaign play Run the Canal; under the layer its name is "Gatecrashers" (the intro card says so); each round sends its Missile Trucks (no Rocket Truck, cluster, sub, gunship or block) and its swarm; every column nose to tail with missiles; more trucks each round, round 2 both banks, round 3 both locks and both banks; 15–30 s a round (seed 204);
  - a Missile Truck can be shot on the way in (a wreck stalls the one behind it) and while it raises, marks a ship mostly held at a lock, and lobs a ballistic missile (at least 3 s in the air, most at least 150 px high) that can be shot down;
  - the Missile Truck is a boss-only chapter 2 enemy: not in `FOE_ORDER` or `FOES_BUILT`, "New on The Narrows", Saltgate its debut map;
  - the signature: from wave 4 at least half the wave's new enemies are Rocket Trucks aimed at the locks, its clusters too; no Torpedo Sub on any wave 1–10 (`swapFoe`: lab only, waves 1–10, Saltgate only); within the wave budget; the campaign's and the shared wave's trucks and clusters keep no aim.
- `tests/v3/round12fixes.test.ts`: wave 1 opens with the map's own encounter (Saltgate's has a second swarm).
- `tests/v3/scorecard.test.ts`: the log is v46 and only 46 replays.
- `tests/v3/mapRules.test.ts`, `mapCards.test.ts`, `round11.test.ts`, `convoy.test.ts`, `saltgateLocks.test.ts`, `readyToTest.test.ts`: unchanged rules, still passing.
- `e2e/v3-encounters.mjs`: Saltgate's card opens with its encounters, and its pause-screen script names the Gatecrashers and sends no torpedo sub; Skip to boss: Missile Trucks on the banks lobbing ballistic missiles, no Rocket Truck (screenshot `saltgate-missile-parade.png`).

## What to look for when you play

Watch the roads down to the locks. From wave 2 a rocket truck drives down the road by the west lock and stops on the bank beside the chamber: a red ring fills round it as it raises its launcher, and a dashed red line points at the ship it is about to hit. Shoot it on the road and it never fires. From wave 4 trucks come every wave, to whichever lock is nearer their road, with cluster missiles over the chambers. The ships still sit in the locks while they fill (the gate light and the countdown say how long). The boss is the Gatecrashers, a parade of missile trucks (new: long olive launchers, each with one white missile): round 1 a column of eight down to the west lock; round 2 a parade on both banks of it, yours too; round 3 the big parade at both locks from both banks. Each column parks nose to tail, raises its missiles together (the red rings fill, dashed red lines point at the ships in the chamber) and lobs them all at once; the red circles show where they land. Kill trucks on the road or while they raise (a wreck holds up the ones behind it), or shoot the missiles in the air. The question to answer: did the trucks make the early waves feel like something was happening, and was the missile parade intense in a good way, with time to thin a column before its volley?

(This section names no weapon to try: the counter kit above is a design note for the bots, never shown in the game or on the hub.)
