# V3 playtest round 6 — Cryo out, five new weapons

The player's feedback:

- **Air Strike**: "very fun. Easy to understand and very op in a good way."
  Left as it is.
- **Cryo**: "sucks: the freeze really doesn't matter… the main shot usually
  just kills it anyways. Remove it." Removed.
- **New**: a shrapnel shell that bursts on impact into fragments flying out
  in every direction, instant (separate from Flak's cloud, which hangs);
  frigates, two ships that sail in, fire on their own for the 15 s and
  leave; a huge-radius burst; a shotgun short blast; and "other ideas too,
  avoiding things like Cryo where the effect didn't matter".

At least five build–test–review–improve cycles were asked for.

## The five new weapons

| Weapon → evolved | Answers | A tap while loaded |
|---|---|---|
| **Shrapnel Shell → Fragstorm** | Swarms | A shell that bursts at once into 10 / 14 / 18 fragments in every direction; each hits the first threat on its line; evolved, they tear through everything on it. |
| **Frigate Escort → Battle Group** | Everything | Picking it up sails two frigates in to the lane's edges; they fire on their own (free, no rounds) until the 15 s run out, then sail off. Faster at L2; a third frigate at L3. The gun fires as usual. |
| **Thermobaric Shell → Daisy Cutter** | Packs | A huge blast: 1 damage to everything within 150, then 2 within 190, then 3 within 240. |
| **Scattergun → Dragon's Breath** | Rushers | A cone of 8 / 11 / 15 pellets from the gun toward the tap; evolved, the pellets pierce. |
| **Boomerang → Twin Blades** (our idea) | Lines | A spinning blade flies out to the tapped threat, homing on it, and back to the carrier, cutting each threat once on each pass. Evolved, two blades. |

Why the Boomerang avoids Cryo's problem: Cryo's extra (the freeze) only
mattered for threats that survived the shot, and few did. Every effect here
**is** the damage: more targets hit per round (fragments, pellets, blast,
the blade's two passes) or shots the player doesn't fire (frigates).

## What success looks like (from the player's side)

1. Every new weapon is clearly worth picking up on its own: no Cryo-style
   duds.
2. Each looks and behaves as asked: the shrapnel is an instant spray of
   particles, the frigates arrive and leave after 15 s, the burst is visibly
   huge, the shotgun is a short cone.
3. They stay readable in a busy wave, without dropping frames.
4. Pickups, loadout chips, notices and draft cards work and fit for all
   twelve weapons, on a phone too.
5. The difficulty stays on the curve: the average bot, drafting in a random
   order, clears about half its runs.
6. Real touch works; no errors; the unit tests and the browser suite pass.

Every cycle ran the built game in Chromium (Playwright) unless it says
otherwise: real clicks or Chrome DevTools touch events, screenshots read by
eye, game state read by the probes.

## Cycle 1 — does each weapon do what it says (desktop)

Scenes per weapon (a swarm ring for Shrapnel, a pack for Thermobaric, a
line for the Boomerang, threats near the gun for the Scattergun, a wave for
the frigates), fired with a real click; five frames over ~1.5 s at L1 and
L3; the frigates followed from pickup to leaving.

Verified: the fragments fly out at once and L3 clears the ring; the
thermobaric ring reaches its radius; the frigates arrive, fire and sail off
when the clock runs out; each shot spends one round (the frigates spend
none).

| # | Finding | Fix |
|---|---|---|
| 1.1 | (Unit test, before the browser) A scattergun blast at 300 px landed one pellet: the cone was too wide | Spread 0.5 → 0.32 rad, pellets 16 → 18 wide |
| 1.2 | Scattergun pellets were faint lines | Brighter, 4 px, and a muzzle flash at the gun |
| 1.3 | Twin Blades splayed both blades off the tapped line, missing it | One blade on the line, the second splayed |
| 1.4 | The frigates looked like convoy ships | Bigger dark hulls with a steel outline, wakes and a turning turret, kept to the lane's edges |

## Cycle 2 — is each one worth it (bot measurements)

Each weapon **alone** (drafted first, every other weapon stripped), average
bot, 40 runs across the five maps; then random-draft runs.

| # | Finding | Fix |
|---|---|---|
| 2.1 | Boomerang cleared **0%**: a Cryo-style dud (the blade flew to the tap point and threats had moved off) | The blade homes on the tapped threat and is wider (28 / 36 → 34 / 44) → **38%** |
| 2.2 | Scattergun cleared 13%: too short | Range 520 / 620 / 680 → 650 / 760 / 860, pellets 7 / 10 / 14 → 8 / 11 / 15 → **50%** |

Air Strike was deliberately not changed: the player loves it, and its low
bot number (20%) reflects the bot, which taps threats rather than rows.

## Cycle 3 — visuals at phone size (844×390)

The cycle-1 scenes again at phone size, cropped at native resolution.

Verified: the thermobaric ring, the scatter cone, the frigates and their
notice ("FRIGATE ESCORT · 15s — Keep shooting: the frigates fire on their
own.") all read on a phone.

| # | Finding | Fix |
|---|---|---|
| 3.1 | The Boomerang's blade read as a small cyan dot (22 px arms ≈ 11 px on a phone) | Longer, outlined arms (34 / 40) and a bright hub: reads as a spinning blade |
| 3.2 | Shrapnel fragments were hair-thin (2.5 px ≈ 1.3 px on a phone) | 4 px |

## Cycle 4 — pickups, chips, notices and draft cards, all twelve

All 12 weapons × L1 and L3 × 1280×720, 844×390 and 667×375: a pickup dropped
beside a power-up and cropped, tapped, then the chip, the rail timer and the
notice read from the page. Then the new cards in NEW / LEVEL UP / EVOLVES
states at the three sizes, with overflow measured.

Verified: 72 of 72 loads matched (game, chip, rail timer, notice); every
pickup label is legible, evolved names included ("BATTLE GRP", "TWIN
BLADES"); no card text clipped vertically, nothing scrolls; the new card art
reads in its colour.

| # | Finding | Fix |
|---|---|---|
| 4.1 | On phones (50 px chips) eight names (49–56 px) ran into the chip's ring: four new (BOOMERANG, FRAGSTORM, BATTLE GRP, TWIN BLADES) and four older (SWARM POD, SINGULARITY, MASS DRIVER, STORM COIL) | Names of 9+ letters set tighter: all 24 now 35–45 px |
| 4.2 | On a 667 px phone, next to a LEVEL UP / EVOLVES badge, five threat tags were cut ("VS EVERY…", "VS CLOSE…"; also Aircraft, Ballistics, Spread raids, since round 3 — round 4 measured only vertical clipping) | Tighter tag and badge type under 760 px; "Close range" → **Rushers**, "Spread raids" → **Wide raids**: 0 of 13 cut |

## Cycle 5 — busy waves, frame time, real touch, the natural flow

- **Stress**: Harbor Mouth wave 10 with the watch bot, each new weapon at
  L3 kept loaded and a 14-drone swarm added every 3 s (up to 30 threats, 56
  effects, 10 blades, 3 frigates), 20 s timed without screenshots: **p99
  16.8 ms (60 fps) for every weapon**, worst frame 33 ms; no page errors.
  The busiest frames were read by eye: fragments, blades and frigates don't
  hide threats.
- **Touch** (844×390, DevTools touch events): every one of the 12 weapons
  picked up and fired by touch (Air Strike spends 2 rounds, the rest 1); a
  held finger keeps firing each new weapon; touching another weapon's
  pickup while the frigates are out sends them home (they sail off the
  right edge).
- **Natural flow**: the watch bot from wave 1 at 3×, nothing injected, two
  runs (The Strait seed 52: drafted Scattergun → Dragon's Breath, then Flak
  and Railgun; The Gauntlet seed 7: Tesla → Storm Coil, then Thermobaric).
  Drafts, first "WEAPON DROP" hint, loaded notices, "… DONE" and chips all
  right; no page errors.

| # | Finding | Fix |
|---|---|---|
| 5.1 | The frigates held fire until on station: the far one spent ~4.6 s of its 15 sailing in silent | They fire as soon as they are on screen; a test checks it (and fails on the old code). Frigates alone still clear 75%; random drafts 50% |

## Balance on the final build

Each weapon alone (average bot, 40 runs, ±10 points):

| Frigates | Seekers | Scattergun | Shrapnel | Gravity Well | Railgun | Boomerang | Thermobaric | Flak | Aegis | Air Strike | Tesla |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 75% | 65% | 50% | 45% | 43% | 40% | 38% | 35% | 35% | 28% | 20% | 20% |

No weapon alone: 0%. Every weapon carries runs on its own; none is a dud.

Random draft order, average bot, **32 seeds a map**: Strait 63%, Gauntlet
59%, Island 72%, Harbor 22%, Archipelago 28% — **mean 49%** (round 3: 48%).

Full sweep (12 seeds a cell, fresh Armory; sharp / average / casual):

| Map | Round 3 | Round 6 |
|---|---|---|
| The Strait | 92 / 75 / 17 % | 92 / 100 / 0 % |
| The Gauntlet | 67 / 33 / 17 % | 58 / 50 / 0 % |
| The Island | 67 / 75 / 8 % | 83 / 83 / 8 % |
| Harbor Mouth | 58 / 42 / 0 % | 42 / 17 / 0 % |
| The Archipelago | 58 / 17 / 8 % | 33 / 50 / 17 % |

At 12 seeds a cell the sweep swings ±14 points (its average-bot mean, 60%,
against 49% on 32 seeds). A weapon is loaded 43–50% of a wave. Whole game
from an empty Armory: sharp and average 1.0 h (6 runs), casual 7.9 h and on
map 3 at the 60-run cap.

## Final checks

- `npm test`: 883 pass (V3: 47, with tests for each new weapon and the
  frigates firing on the way in).
- `npm run e2e:v3`: 43 checks, three runs in a row (each of the 12 weapons
  loaded from its pickup and fired; the log at version 10).
- Play logs move to version 10 (the draft deals a new roster).

## Limitations

- Frame times were measured in headless desktop Chromium at phone size, not
  on a phone.
- Bots can't judge feel: whether the fragments, the blade's spin or the
  frigates are *fun* is for the next hand playtest.
- The bot undersells Air Strike (20% alone), so the tier puts it low; its
  numbers were left alone because the player rates it the best weapon.
- Harbor Mouth stays the hardest map for the average bot (22% on 32 seeds).
