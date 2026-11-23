# V3 playtest round 3 — five new weapons for the 15 s swap

The player's ask:

> "Let's make new drops. Come up with 5 new ones and drop the bottom 5. Make
> new weapon drop designs around the new pick up mechanic and the fact that it
> replaces the main gun."

## Which five went

Re-measured on the merged round-2 build before cutting (average bot, the
weapon as its first pick, 80 runs each across all five maps; round 2's own
tier was 40 runs at an older drop rate, so a few places had moved):

| Air Strike | Tesla Arc | Railgun | EMP Rounds | Hellfire Salvo | Smoke Shells | Decoy Flares | Sub Hunter |
|---|---|---|---|---|---|---|---|
| 51% | 39% | 38% | 33% | 33% | 29% | 26% | 23% |

Cut: **EMP Rounds, Hellfire Salvo, Smoke Shells, Decoy Flares, Sub Hunter**.
Kept unchanged: **Air Strike, Tesla Arc, Railgun**.

## The five new ones

Each is designed for a gun that is swapped in for 15 s by a pickup: it
changes what a plain tap does and nothing else, so the only thing to do is
still to tap. Each answers something the main gun is bad at.

| Weapon → evolved | Answers | A tap while it is loaded |
|---|---|---|
| **Flak Cannon → Flak Curtain** | Swarms | The shell bursts into a flak cloud (1.5 s; evolved 4 s) that hits everything flying through it. Fire it into a swarm's path and let the drones fly in. |
| **Seeker Pod → Swarm Pod** | Raids | One round launches 3–5 seekers at the threats nearest your finger. A tap into a crowd spreads itself; evolved, a seeker whose target died finds another. |
| **Cryo Rounds → Absolute Zero** | Heavies | The burst freezes everything in it mid-air and bites for 2 (1, doubled on ice); frozen threats take double from everything. Evolved, any hit shatters a frozen threat, so the burst itself clears what it touches. |
| **Gravity Well → Singularity** | Spread raids | The shell opens a vortex that drags drones, missiles and jets in (ballistics fly on), then implodes on what it gathered. |
| **Aegis Dome → Bastion** | Ballistics | Every shot also raises a shield dome over the ship (or the carrier) its target is after; a tap on the water by a ship just domes it. The dome takes 3–6 hits for the hull, then pops; evolved, each hit it takes bursts back out at threats nearby. The one weapon that protects instead of shooting. |

On screen: flak clouds are dark puffs sparking as they hit; a gravity well
is a violet spiral tightening to its core, then a snapping ring; seekers are
small lime darts; a domed hull sits in a teal bubble with one pip per hit it
can still take; a frozen threat is cased in ice (cracked when it will
shatter). Each has its own icon,
colour and card art. Bots need nothing new: every weapon fires from the taps
they already make.

## Balance

**Pass 1: much too strong.** The first versions, at round 2's drop rate:
the average bot drafting in a random order (as the sweep does) cleared
**96%** across the five maps (round 2: ~47%). Measured each weapon **alone**
(every other weapon stripped from the build), which the old tier never did:

| | Flak | Seeker | Laser | Cryo | Well | Air Strike | Railgun | Tesla | old EMP | old Salvo | old Smoke | old Decoy | old Hunter |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| alone, round-2 drop rate | 90% | 95% | 98% | 5% | 80% | 100% | 100% | 63% | 33% | 85% | 3% | 0% | 35% |

So Air Strike and Railgun were always strong; round 2's tier read them low
because weak partners diluted their drops. Two of the cut weapons did almost
nothing on their own (Decoy 0%, Smoke 3%).

**Pass 2: Cryo.** Freezing only delays: 5%, then 8% with double damage on
ice. The burst now also bites (1, doubled): 83% alone.

**Pass 3: drops.** With every weapon worth having, they can be rarer:
`WEAPON.share` 1 → 0.4 and `pity` 15 → 30 s. Random-order drafts: **50%**.
A weapon is now loaded ~45% of a wave (was ~65%), more of a treat.

**Pass 4: spread.** Alone at the new rate: Air Strike 78, Laser 70, Seeker 55,
Railgun 50, Cryo 30, Flak 28, Well 28, Tesla 28. Flak (bigger, faster ticks)
and Gravity Well (wider, stronger implosion) were buffed to 40% and 38%. The
kept three were left as they were.

**Pass 5: the player's look.** Two notes after reading the roster:

- *"The air strike is prbs too OP? It would use two ammo for one jet."* Air
  Strike now costs 2 rounds a jet (too few in the rack: a dry click;
  Overdrive: free). Alone it went from 78% to 35–55%.
- *"The laser and the rail gun are too similar since it is just the same
  instant attack."* The Point-Defense Laser was cut for the **Aegis Dome**,
  the one weapon that protects instead of shooting. First version: a tap on
  a threat raised a dome *instead of* shooting it, so for 15 s nothing died:
  0% alone, worse than no weapon. Now every shot still fires and also domes
  the hull its target is after (18%), and the domes last longer and take
  more hits (43%).
- Drops back up a little to hold the curve: share 0.45, pity 28 s (0.4 / 30
  gave 40%, 0.5 / 25 gave 65%: the curve is steep around here).

**Each weapon alone, final build** (40 runs across all maps, ±10 points):

| Seeker Pod | Railgun | Air Strike | Flak Cannon | Gravity Well | Aegis Dome | Cryo Rounds | Tesla Arc |
|---|---|---|---|---|---|---|---|
| 70% | 58% | 55% | 45% | 45% | 43% | 30% | 23% |

**Final sweep** (12 seeds a cell, fresh Armory; sharp / average / casual):

| Map | Round 1 (buttons) | Round 2 (drops) | Round 3 |
|---|---|---|---|
| The Strait | 90 / 90 / 0 % | 92 / 75 / 17 % | 92 / 75 / 17 % |
| The Gauntlet | 50 / 20 / 0 % | 25 / 25 / 8 % | 67 / 33 / 17 % |
| The Island | 90 / 90 / 0 % | 83 / 50 / 8 % | 67 / 75 / 8 % |
| Harbor Mouth | 10 / 30 / 0 % | 25 / 25 / 8 % | 58 / 42 / 0 % |
| The Archipelago | 40 / 50 / 0 % | 25 / 25 / 0 % | 58 / 17 / 8 % |

The average bot clears 48% across the maps (round 1 56%, round 2 ~40%). A
weapon is loaded 41–50% of a wave. Whole game from an empty Armory: sharp
0.8 h (5 runs), average 2.0 h (13 runs), casual 7.7 h and on map 3 at the
60-run cap.

The sweep's per-seed draft order rarely put the Railgun first in these 12
seeds, so its pickup counts in the sweep are low; alone it clears 58%.

## Checks

- `npm test` (877): the V3 suite (41) covers each new weapon: Flak's cloud
  hits what is inside and not outside; seekers go to the nearest threats, one
  round each, nothing fires with no threat near, Swarm Pod retargets; an
  Aegis shot also domes its target's hull, the dome takes its hits for the
  hull and pops, open water by a hull domes it, far from any does nothing,
  Bastion bursts back; Cryo freezes in place, bites for 2 on ice, a thaw lets
  it move, Absolute Zero shatters on any hit; the Gravity Well drags a drone
  and a missile in and kills them. Every weapon spends its rounds (Air Strike
  two a jet), clicks dry with too few and is free under Overdrive. Card text
  checked against `AB`.
- `npm run e2e:v3` (39 checks, run twice on the final build): Flak, Cryo
  and the Gravity Well load from their pickups and fire on open water;
  Seekers and the Aegis Dome load and fire on a threat (the dome goes up on
  the hull it was after); Railgun and Air Strike as before; log v9; draft, loadout,
  phone, the notice tray on every map.
- A browser probe drew all five at once (flak cloud, vortex pulling drones
  in and imploding, seekers, a heavy cased in ice, domes over a ship and the
  carrier); screenshots checked by eye, no page errors.

## Limitations

- Bot measurements: they can't say whether a vortex or a freeze *feels*
  good, or whether the seekers read clearly in a busy wave.
- Absolute Zero's burst shatters everything it touches (heavies included).
  It is the evolution, so it should be strong; if it dominates real play,
  make the burst bite without shattering.
- Nothing hunts launchers now except Carpet Strike (Sub Hunter was cut).
- The casual wall is still there.
- Version-8 V3 logs don't replay under version 9 (a different roster).
