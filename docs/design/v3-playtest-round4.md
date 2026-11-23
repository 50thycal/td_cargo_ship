# V3 playtest round 4 — UI and visuals of the weapon drops

The player's ask: "do some play testing for the ui and visual graphics for
the new weapons and whatnot … make sure they are all good", in at least
five build–test–review–improve cycles.

## What success looks like (from the player's side)

1. **Pickups**: a weapon pickup is instantly a *weapon*, not a power-up; you
   can tell which one (icon, name, colour) and when it is about to go, on a
   phone as well as on a desktop.
2. **Loaded state**: once tapped, it is obvious what is loaded, how long is
   left and how to fire it; the loadout chip, the left-rail timer, the
   carrier ring and the notice agree, in the weapon's colour.
3. **Effects**: every weapon's shot is visible and readable at levels 1–3;
   you can see why things died; the evolution looks different; what you see
   matches the card.
4. **Draft cards**: the art, names and text of all eight read and fit on
   desktop and phones.
5. **Busy waves**: effects don't hide threats or ships, don't pile up into
   clutter, fade cleanly, and don't drop frames.
6. **Real input**: touch on a phone picks up and fires every weapon; edge
   cases behave; no console errors.

All cycles ran against the built game in Chromium (Playwright): real clicks,
real touch events in cycle 5, screenshots read by eye, DOM and game state
read by the probes.

## Cycle 1 — pickups and the loaded state

All eight weapons at 1280×720 and 844×390: each pickup dropped next to an
Overdrive power-up and cropped; tapped; chip, tag, rail timer and notice
read; full screenshots compared. Then a pickup in its last second and a
weapon running out.

Verified: every pickup is a coloured hexagon with its icon and name, clearly
not a power-up; chip, "15s" tag, rail timer, carrier ring and notice agree
for all eight at both sizes; the pickup blinks before it goes; the ring and
tag count the last seconds down.

| # | Finding | Fix |
|---|---|---|
| 1.1 | On a phone the pickup's name was ~7 px: unreadable | 22 px, heavier, with a darker outline (~10 px on a phone) |
| 1.2 | Air Strike's notice said "2 rounds" twice | Said once |
| 1.3 | Aegis Dome's notice ran to three lines on a phone | Shorter card lines ("5 s, 3 hits") |
| 1.4 | When a weapon ran out nothing said so: easy to keep tapping as if loaded | "RAILGUN DONE" (its name) over the gun |

## Cycle 2 — every weapon in action, level 1 and evolved

A scene per weapon (a swarm, a raid, heavies, a strafer, a line for the
beam, a domed ship), fired with a real click, five frames over ~1.5 s, at
level 1 and level 3.

Verified against the cards: Flak's cloud lasts ~1.5 s, Flak Curtain's 4 s;
Cryo cases the heavies in ice and kills the drone and guided missile with
its bite, Absolute Zero shatters both heavies; Air Strike's jet comes in
from the nearer edge and a strafer survives one 2-damage pass; Tesla's arcs
show and Storm Coil clears the pack; the Aegis dome shows 3 pips, takes two
missiles (3 → 1) with the hull untouched, Bastion's hit bursts back and
kills the drone beside it.

| # | Finding | Fix |
|---|---|---|
| 2.1 | Seekers were 3.5 px dots: you couldn't follow them to their targets | A bigger lime dart with a halo and a long trail |
| 2.2 | (Investigated: the Gravity Well implodes on time at every level.) Everything it caught stacked on one exact point, so you couldn't see how much it had | Caught threats circle the core in a tight ring, inside the implosion's reach |

## Cycle 3 — draft cards

All eight cards (and Resupply) in NEW, LEVEL UP and EVOLVES states at
1280×720, 844×390 and 667×375; overflow measured.

**No defects found**: no card text clipped, no scrolling at any size, the
badges and pips right, every new card's art legible in its colour, the
loadout chips under the cards right. (The "WAVE 1 SKIPPED" heading in the
screenshots came from the probe forcing a draft, not from the game.)

## Cycle 4 — busy waves and frame time

The watch bot played wave 8 (Gauntlet, phone size) with each weapon held at
level 3 and kept loaded, ~22 s each, against no weapon; then the busiest
moment of wave 10 on Harbor Mouth was captured per weapon.

Verified: 60 fps throughout for every weapon (median and 95th percentile
16.7 ms; one 117 ms frame with Aegis Dome was a screenshot stall: re-timed
in cycle 5 without screenshots, worst frame 33 ms); no page errors; domes,
the vortex, frost, seekers and beams don't hide threats.

| # | Finding | Fix |
|---|---|---|
| 4.1 | Carpet Strike's burning row was the loudest thing on screen: full-strength beads across the whole map, over the threats | A dim band of heat with small flames along it |

## Cycle 5 — real touch on a phone, edge cases

Chrome DevTools touch events at 844×390.

Verified: every weapon picked up and fired by touch (Air Strike spends 2
rounds, the others 1); pickups at all four extreme drop positions take a
touch; touching a pickup while another weapon is loaded collects it without
firing; a held finger keeps calling jets at 2 rounds until the rack clicks
dry; Seekers held on open water fire nothing and spend nothing.

| # | Finding | Fix |
|---|---|---|
| 5.1 | A weapon dropped at the edge of the screen had its name cut off ("R STRIKE", "GRAVITY" and "SEEKERS" cut at the bottom) | Weapon pickups land further in than power-ups; a test drops one at each corner and checks (and fails on the old margin) |

## Cycle 6 — the real flow, nothing injected

The watch bot played from wave 1 on its own at 3× (phone size): it drafted
the Railgun, levelled it to Mass Driver, added Flak and Aegis Dome; weapons
dropped from kills, the "WEAPON DROP" hint showed once, loaded notices and
"… DONE" showed, the chips matched at every step; no page errors (lost on
wave 8).

| # | Finding | Fix |
|---|---|---|
| 6.1 | An evolved weapon's notice began lower-case ("wide slugs, four times…") | Superseded by 6.2 (the notice no longer carries that line) |
| 6.2 | The final browser suite failed once: on the Island's one-card tray, the Gravity Well notice (the longest) wrapped to two lines and its top crossed the carrier by 3 px; reproduced 5 of 5 times | The weapon notice is the name, the seconds and how to fire it, one line; the effect line stays on the card. 0 overlaps in 5 + 3 reruns; all 16 notices (8 weapons × 2 levels) measured at 36–37 px, below the carrier |
| 6.3 | On that tray, a weapon notice waiting behind a raid card was not replaced by a newer one: loading Gravity Well after Aegis showed "BASTION" | A newer notice with the same key now takes the waiting one's place; rechecked: GRAVITY WELL shown |

## Final checks

- `npm test`: all pass (V3: 42, including the new edge-drop test).
- `npm run e2e:v3`: 39 checks, three runs in a row on the final build (the
  notice check now also requires the how-to-fire text).
- The Island tray reproduction: 0 overlapping samples.

## Limitations

- Frame times were measured in headless desktop Chromium, not on a phone.
- These are scripted and bot checks; they can't judge whether an effect
  *feels* good (the vortex's swirl, the size of the domes).
- A weapon notice waiting behind a live raid card (Island's one-card tray)
  was fixed by reading the code path and seen once in a run; it was not timed
  in a controlled scene. The chip and the rail timer show the loaded weapon
  either way.
