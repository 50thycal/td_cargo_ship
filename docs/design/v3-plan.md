# Straitwatch V3 — abilities and the Armory

V3 takes V2's game (cargo ships, the carrier, drones and missiles you tap to
intercept, 5 maps × 10 waves, formations, flow) and changes **only the
upgrades**, after the player's brief (inspired by Survivor.io):

- The **main gun stays as it is** inside a run: no upgrades for it in the
  draft. It gets better **before** a run, in the **Armory**, with salvage
  earned from every run, the way gear sets your weapon in Survivor.io.
- The in-run draft deals **abilities**: new attacks that each answer a
  scenario. Three held at once, three levels each, level 3 **evolves** them.
- **Nothing fires on its own.** Each ability charges from something, then the
  player sets it off from its button at the bottom right, the way it says.
- All of V2's passive cards are gone. **EMP and Strike Package are no longer
  pickups**; they came back as the EMP Pulse and Air Strike abilities. The
  other pickups are unchanged.

V3 lives at `/v3.html` (`npm run dev:v3`), its code in `src/v3/` (a fork of
`src/v2/`), with its own save, logs (`game: 'v3'`, ids `v3-…`) and tools.
V2 is untouched at `/v2.html`.

## Kept in step with V2

V3 is V2 plus the upgrade change, so V2's later rounds are ported one to
one. V2 rounds 13–14 (merged into `src/v3` with a three-way merge from the
fork point):

- **Round 13**: a cleared wave clears the field and refills the rack (in
  V3 that also ends smoke walls, burning lines and running abilities; the
  ability charge carries over) behind a WAVE N CLEARED stamp; launchers hit
  from the air are destroyed, not chased off (Carpet Strike and Sub Hunter
  in V3); dirt roads routed round the bases, tunnels and caves, the Island
  as a hill, silo bases; the Island eased (threat ×0.95, extras two waves
  later). `LOG_VERSION` 7.
- **Round 14**: one notification tray on each map's bottom shore (at most
  two cards, queued, raids and alarms cut in); power-up timers moved to the
  foot of the left rail. In V3, ability timers (Railgun, Tesla Arc, Ion
  Storm, Ghost Fleet) live in that rail too, and ability feedback (armed,
  charging, fired) is an at-once card, as round 14 treats feedback on the
  player's own action.

`tests/v3` and `e2e/v3.mjs` carry the same checks (fresh start, strike
kills, roads clear of bases, the Island schedule, the tray on all five maps
at two phone sizes) plus one that V3's maps are V2's, byte for byte.

## Survivor.io, and what V3 takes from it

Research summary (fan wikis and guides; some contradict each other):

| Survivor.io | V3 |
|---|---|
| 6 weapon + 6 passive slots, 5★ each; a maxed weapon + its paired passive **evolves** | 3 ability slots, 3 levels; level 3 **evolves** (no passives) |
| Pick 1 of 3 at every level-up; chests give extra picks | Pick 1 of 3 after every wave (Resupply when nothing fits) |
| Every attack is automatic; you only move | You don't move, so attacks are **active**: charged, then aimed |
| 15-minute chapters, bosses at 5/10/15 min; ~350 chapters + challenge modes | 10 waves ≈ 8–10 min a map; 5 maps + endless |
| Gear (merged, upgraded with gold) sets your starting weapon and stats | The **Armory**: 5 main-gun upgrades bought with salvage |
| 50+ hours come from the meta (gear, chapters, events), not the in-run skills | The Armory is V3's first meta layer (see "How long the game is") |

## Abilities

Two knobs per ability (`src/v3/data/abilities.ts`):

- **Charge** — what fills it: time, drone kills, main-gun hits, an accuracy
  streak (a tap on empty water or a dry rack resets it), enemy missile
  launches, hits on your convoy, pickups collected, launchers spotted.
  Nothing charges from shots fired or reloads: both reward mashing, which
  V2's round 6 audit made sure never wins.
- **Activation** — how it goes off: a **button**; a **line** you swipe or drag;
  a **takeover** of the main gun (for some shots or seconds, then it goes
  back); a **hold** you press and release on a spot; a **target** you tap.

| Ability → evolved | Answers | Charges from | Goes off by | L1 → L2 → **L3 evolution** |
|---|---|---|---|---|
| EMP Pulse → **Ion Storm** | Swarms | 9 / 8 / 7 drone kills | Button | 8 drones nearest to hitting → every drone, missiles jammed 1.5 s → **4 s storm: new drones die, threats at half speed** |
| Air Strike → **Carpet Strike** | Aircraft | 36 / 32 / 28 s | Swipe a line | 1 jet along the line, 2 dmg → 2 jets, 3 dmg → **3 jets, the line burns 4 s, launchers under it knocked out** |
| Railgun → **Mass Driver** | Heavies | 18 / 16 / 16 main-gun hits | Takeover: next taps | 2 piercing beams, 2 dmg → 3 beams, 4 dmg → **2 wide slugs, 8 dmg: one-shot heavies** |
| Tesla Arc → **Storm Coil** | Crowds | 8 / 8 / 7 hits in a row | Takeover: seconds | 6 s, each hit arcs to 2 → 8 s, 3 arcs → **9 s, every arc arcs again** |
| Decoy Barrage → **Ghost Fleet** | Guided | 6 / 5 / 4 enemy missile launches | Button | guided and cluster missiles chase decoys → supersonics and bomblets too → **decoys hang 6 s, pulling in every new launch** |
| Smoke Wall → **Fog Bank** | Strafing | 3 / 3 / 2 hits on the convoy | Drag along a lane | smoke 10 s: missiles lose ships in it → 13 s, strafing guns blind → **15 s; ballistics landing in it miss, drones go blind** |
| Hellfire Salvo → **Saturation** | Raids | 4 / 3 / 3 pickups | Press, hold, release | 6 rockets (2 dmg) on the spot → hold for up to 10 → **14 rockets (3 dmg), each hunting a threat near the spot** |
| Sub Hunter → **Hunter-Killer** | Launchers | 5 / 4 / 3 subs or trucks seen | Tap a launcher | destroys it before it fires → its missiles in the air too → **one press sinks every launcher on screen** |

Rules:

- A new ability arrives **empty** and its button fills from nothing (round 1:
  starting half full read as a random state). A run skipped ahead to a later
  wave (dev) hands its abilities over full, as they would have charged.
- Each ability keeps its **button slot**: a new one takes the next free slot,
  a swap takes the replaced one's (round 1: ordered by roster, buttons moved
  under the thumb when a new ability arrived).
  Charge carries across waves and survives levelling up.
- Only one takeover at a time (the gun can't be a railgun and a coil at once).
- An aimed ability that would do nothing (a swipe too short, a tap with no
  launcher near) **stays armed and spends nothing**; pressing its button again
  disarms it. Keys 1–3 press the buttons on a desktop; Escape disarms.
- The draft favours abilities you hold (50% per draw vs V2's 37%): three
  slots × three levels is nine picks, about one map's worth of drafts.

## Screen

- **Right rail**: the HUD, pause, and a one-button **speed** control (it was
  a full-height slider) at the top; the **three ability buttons** at the
  bottom, under the right thumb. Each is a ring that fills as it charges,
  glows when ready, turns gold when armed for its gesture, and shows its
  level (EVO once evolved).
- **Armed**: a banner says how to fire it; the next touch on the battlefield
  is the ability's (a dashed line with an arrow while you swipe, a filling
  ring while you hold, a reticle for a target), not a shot.
- Timers for takeovers and storms show as chips beside the pickup timers.
- Draft cards show what the ability answers, its art, its level pips, what
  this level does, what charges it and how to set it off; the card that
  evolves an ability is badged **EVOLVES**.

## The Armory

`src/v3/data/armory.ts`. Five upgrades, five levels each, only the main gun.
Levels are bought for good, but **a run takes ONE upgrade**: the equipped one
(playtest round 1: "the player should only be allowed to select one… they
don't get all of them"). The first upgrade bought is equipped; after that the
**Choose your gun** screen comes up whenever a map is started (from the menu,
Next or Try again), with the last choice ready, and the Armory has an Equip
button on each owned row. The menu strip shows the gun equipped.

| Upgrade | Per level | At level 5 | Alone at L5 (average bot) |
|---|---|---|---|
| Quick Reload | a round loads 6% faster | 0.95 s a round (−30%) | 80% clears |
| Wide Warhead | blast +40% | 3× blast | 68% |
| Fast Motors | interceptors +20% faster | 2× speed | 67% |
| Deep Magazine | +1 round (levels 1, 2, 4, 5) | 10 rounds | 83% |
| Proximity Fuse | bursts closer to a fast target | 34 px fuse, hits for 2 | 82% |

The base gun clears 43% for the same bot. Round 1 strengthened Wide Warhead
(+20% a level changed nothing on its own: 43%) and Fast Motors (+12% a level:
53%) once a run took one upgrade instead of all five.

Each stops short of the line V2's round 6 audit found (an 11-round rack
reloading 55% faster let mashing win). Levels cost 80 / 160 / 280 / 450 /
700 salvage (1,670 to max one upgrade). A run pays 1 salvage per ship
delivered, 6 per wave cleared, 40 for clearing the map and 80 more the first
time: about 100–180 a run. Lost runs pay too.

Dev mode adds a **Gun** chip on the menu: the equipped upgrade, the base gun,
or the equipped upgrade at level 5; dev runs never earn or spend salvage.

## Measurements

Bots (`npm run v3:sweep`), ship flow on step 3 of 5. Minutes are game time
at 1× plus ~8 s a draft and ~15 s a run for menus. These are bot numbers: a
person aims abilities worse and taps less precisely, so treat them as the
shape of the curve, not the final word — the next step is real playtests.

**How long a run is.** One map, start to clear: **~10 minutes**. A lost
run lasts 6–9. Each run pays **100–180 salvage**.

**Clear rate by Armory level** (sharp / average / casual bot; measured
after porting V2 rounds 13–14, which eased the Island):

| Map | Armory 0 (fresh) | Armory 2 (~6 runs in) | Armory 5 (maxed) |
|---|---|---|---|
| The Strait | 90 / 90 / 0 % | 100 / 100 / 38 % | 100 / 100 / 100 % |
| The Gauntlet | 50 / 20 / 0 % | 75 / 88 / 13 % | 100 / 100 / 63 % |
| The Island | 90 / 90 / 0 % | 100 / 100 / 0 % | 100 / 100 / 75 % |
| Harbor Mouth | 10 / 30 / 0 % | 88 / 75 / 0 % | 100 / 100 / 63 % |
| The Archipelago | 40 / 50 / 0 % | 75 / 75 / 0 % | 100 / 100 / 50 % |

The main gun alone (no abilities, fresh Armory) clears **0–13%**, the same
as V2 with no cards: the base gun really is unchanged, and the abilities
carry a run from the first wave while the Armory carries the progression
between runs.

**The whole game** (all five maps cleared in order, from an empty Armory,
spending salvage after every run). Measured before round 1's one-gun rule;
with one gun (investing in Deep Magazine / Wide Warhead): sharp bot 1.1 /
1.6 h, average 0.8 / 1.4 h, casual 7+ h and still stuck on map 2–3 after 60
runs (see v3-playtest-round1.md). Before:

| Player | Time | Runs | Notes |
|---|---|---|---|
| Sharp / average bot | **~1 h** | 5–6 | Armory ~2/5 by the end |
| Casual bot | **8 h+** | 60 (cap) | Armory nearly maxed; Archipelago still not cleared |
| Average bot, main gun only | 3.4 h | 25 | the Armory alone can carry a player |

For comparison, V2 took a decent player **~70 minutes** to clear all five
maps once. The Armory doesn't make the game longer for a strong player; it
makes the game finishable for a weaker one, and gives every run (won or
lost) a purpose. To make the whole game longer, the knobs are salvage per
run and Armory costs (`SALVAGE`, `ARMORY_COSTS`) and how hard the later maps
are without Armory levels.

**Ability tier** (average bot, fresh Armory, the ability as its first pick,
80 runs each across all maps; a random first pick clears 41%, ±5.5 points):

| Railgun | Air Strike | Smoke Wall | Sub Hunter | EMP Pulse | Tesla Arc | Hellfire Salvo | Decoy Barrage |
|---|---|---|---|---|---|---|---|
| 50% | 48% | 35% | 35% | 34% | 34% | 34% | 29% |

Tuning so far: Railgun came in at 70% (Mass Driver's three screen-wide
8-damage slugs) and was cut to two slugs and a slower charge; Sub Hunter at
57% (it charged from every launcher) now needs 5/4/3; Smoke Wall, Decoy
Barrage, Hellfire Salvo and Tesla Arc were buffed, and the bot's rules for
Decoy and Smoke fixed to fire when one missile is about to hit (as a person
would), not only for two at once.

## Where to tune

| What | File |
|---|---|
| Abilities: charge needs, effect numbers (`AB`), level text | `src/v3/data/abilities.ts` |
| Armory: per-level effects, costs, salvage per run | `src/v3/data/armory.ts` |
| How bots use abilities (sweep and watch mode) | `src/v3/sim/abilityBot.ts` |
| Everything else (threats, waves, maps, formations) | as in V2, under `src/v3/data/` |

## Testing

- `npm test` includes `tests/v3/` (the Armory and save, the draft, every
  charge source, every ability's levels, replay with activations, the curve).
- `npm run v3:sweep -- [seeds] [--armory=N] [--no-abilities] [--focus=id]`
  prints clear rates, minutes a run, salvage a run, ability uses, and the
  whole game from an empty Armory.
- `npm run e2e:v3` (with `npm run preview -- --port 4173` running): buys an
  Armory level, fires each kind of activation through real clicks, drags and
  holds, drafts, and checks the phone layout. Screenshots in `e2e/shots/v3/`.

## Next candidates (not built)

- **Fusion**: two evolved abilities fuse into one, freeing a slot (Survivor.io
  has a few two-weapon evolutions). It gives endless mode something to draft
  for after the build is complete.
- **A boss-chest draft** after wave 5 that levels two abilities at once.
- **Ability unlocks**: start with four abilities, unlock the rest by clearing
  maps; pick one ability to start each run with (Survivor.io's starting weapon).
- Fit the watch-mode personas' ability timing to real V3 logs (the
  `playtest-fidelity` skill) once there are some.
