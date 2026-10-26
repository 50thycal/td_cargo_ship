# Straitwatch V2: round 6, the upgrade audit

The player cleared Gauntlet losing 1 ship, with Twin Launch L3, Escort Frigate L2 and Supercharged Pickups L2. The log replays exactly. Their verdict: Twin Launch is "super overpowered — you can just tap anywhere and you'll hit any of the threats". They asked for:

- an audit of every upgrade and power-up, where the test of "too strong" is that you can just smash the screen and still take care of everything;
- a look at the Strike Package, which "doesn't seem to really do anything", with an animation that looked odd.

## The test: a smasher

`npm run v2:audit` (new) plays a **smasher** next to the careful "average" bot. Both draft the same cards; only the tapping differs. The smasher:

- taps every 0.2 s at a random live threat, with up to 70 px of aim error;
- grabs pickups;
- never prioritises.

A card or power-up is too strong if it lets the smasher win, because then strategy stops mattering. A good card also gives careful play a clearly bigger lift than it gives the smasher.

Audit modes:

| Mode | What it tests |
|---|---|
| `cards` | Each card at max level, held alone from wave 1 |
| `pickups` | Every drop forced to one kind |
| `plan=a,b,c` | Normal drafting, wanting those cards first |
| `loadouts` | Normal drafting with a random card preference |

## What it found

**Each card on its own, at max level** (clears out of 30, at flow step 2 of 4; both players clear 0 with no cards):

| Card | Smasher | Careful |
|---|---|---|
| Twin Launch | **30** | 30 |
| Quick Reload | **22** | 24 |
| Escort Frigate | 8 | 21 |
| every other card | 0–1 | 0–5 |

**Power-ups:** none carried a game. Every single-kind drop table gave the smasher 0/30.

**Why Twin Launch was so strong.**
- Each free extra interceptor flew at the tapped threat or, if that was covered, at any threat within 300 px.
- Interceptors whose target died re-aimed at anything within 450 px; at level 2 the spare ones peeled off to uncovered threats.
- In the player's game every firing tap launched 2.7 interceptors for one round of ammo, and the rack was empty only 15 times in 399 shots. Their previous game without Twin had 123.

**Why Quick Reload L3 was so strong:** reloads 55% faster on an 11-round rack. Together with Twin, these two removed the game's real constraint, which is ammo.

**Combinations.** The frigate turned out to multiply the others. It was a second rack reloading in parallel, so the smasher won:
- 30/30 with Quick Reload + Frigate;
- 25/30 with Twin + Frigate;
- 27/30 with the player's own build.

## Changes

| Card | Before | Now |
|---|---|---|
| **Twin Launch** | Free extras spread to neighbours within 300 px; orphans re-aimed from 450 px; L2 spares peeled off to uncovered threats | Extras only fire at the tapped threat, and only if it can take them: one extra for a 2-hit guided missile or aircraft, up to two for a heavy, none for a drone. L2 re-aims an orphaned interceptor at a threat within 150 px. Peel-off removed. |
| **Quick Reload** | 25 / 40 / 55% faster; rack +1 / +3 / +5 | 20 / 30 / 40% faster; rack +1 / +2 / +3 |
| **Escort Frigate** | Its own 3- or 5-round rack | L1 launches from the frigate's position using the carrier's rack: an advantage of position, not extra ammo. L2 adds its own 2-round rack, which reloads at half speed. |
| **Strike Package** | Instantly dealt 2 damage to the 4 threats closest to landing; the visual was two dots on dashed lines for 0.6 s | Two friendly jets (pale blue, blue roundels, contrails, a blue band showing the line they sweep) fly low across the screen in about 2 s. One flies the most urgent threat's line, the other a surfaced sub's or raised truck's line (else the next threat's). Everything inside a jet's band takes 2 damage as it passes; a launcher under it shows **KNOCKED OUT** and dives or retreats. The banner now says what it does. |

## After the changes

**Single cards at max level** (clears out of 30):

| Card | Smasher | Careful |
|---|---|---|
| Twin Launch | 1 | 13 |
| Quick Reload | 7 | 19 |
| Escort Frigate | 0 | 9 |
| Armored Hulls | 0 | 2 |
| every other card | 0 | 0–4 |

**Drafted build paths** (clears out of 30):

| Build path | Smasher | Careful |
|---|---|---|
| The player's: Twin → Frigate → Supercharged | 9 (was 27 held from wave 1) | 23 |
| Reload → Frigate → Twin | 11 | 25 |
| Frigate → Reload → Chain | 12 | 23 |
| Twin → Reload → Blast | 10 | 20 |
| Reload → Blast → Chain | 6 | 12 |

**Normal drafting, random preference** (60 games each):

| Flow step | Smasher | Careful |
|---|---|---|
| 2 | 12/60 | 29/60 |
| 4 | 19/60 | 29/60 |

Strategy is now worth 10–17 clears in 60.

**Overall difficulty** (bot matrix, max flow, 20 seeds per map, clears out of 100):

| | Sharp | Average | Spammer |
|---|---|---|---|
| Usual card list | 71 | 70 | 13 |
| Random cards | 62 | 56 | 7 |

Round 5 was about 78 / 78 / 24 and 72 / 72 / 16, so careful play is a little harder and mashing much harder.

I also tried 10% fewer threats per wave to win back the careful-play loss. It helped the smasher more than the careful bot (the gap fell to 6–8 clears in 60), so it was not kept.

**Strike Package, filmed at phone size:**
- One jet flew the surfaced sub's line ("KNOCKED OUT"; it dived and its remaining missiles were lost).
- The other flew the drone line and destroyed all 6 drones as it passed.
- Both were off the far edge about 2 s after the tap.

## Checks

- **Tests:** 812/812.
  - Twin: extras only at the tapped threat (none for a drone, 1 for a guided missile, 2 for a heavy), and L2 re-aim within 150 px.
  - Frigate: L1 shares the carrier's rack and is dry when the carrier is; L2's 2-round rack is spent first and reloads slower.
  - Strike: the jets need to reach a threat before it dies, a threat off their lines survives, and a firing sub is knocked out.
- **Browser (e2e):** `e2e:v2`, `e2e:v2:log` and the V1 smoke test pass.
- **Log version:** `LOG_VERSION` is 6.
