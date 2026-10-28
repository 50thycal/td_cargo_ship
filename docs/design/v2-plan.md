# Straitwatch V2 — bare-bones redesign

V1 grew into ~34k lines of interlocking systems (cash, intel, confidence,
quota, an adaptive enemy economy, escort steering, a counter catalogue, the
Region Workshop). Every tuning change rippled through all of them. V2 strips
the game back to its fun core: **cargo ships, a carrier, and the enemy's
drones and missiles. You tap threats to intercept them.**

V1 is untouched and still the default page (`/`). V2 lives beside it at
`/v2.html` (`npm run dev:v2`), with its own code under `src/v2/` (~2.6k lines),
and shares only the seeded RNG (`src/sim/rng.ts`).

## The three simplifications

1. **One screen, ships on rails.** No camera, no pan/zoom, no steering. The
   whole fight is a fixed 1600×900 field scaled to the screen. Ships ride fixed
   lanes; the formation sets the lanes, the convoy's speed, and how it takes
   damage (see Formations below).
2. **No economy at all.** No cash, intel, confidence or quota. Upgrades are a
   free pick-1-of-3 card after every wave; pickups are instant effects, not
   currency. Score = ships delivered × the flow multiplier they sailed under.
   You lose at **6 ships sunk** (`RULES.shipLossLimit`) or when the **carrier
   sinks**.
3. **A written difficulty curve, not an adaptive enemy.** One table
   (`src/v2/data/waves.ts`) says what each wave launches and how fast. Every run
   on a map escalates identically; only launch timing/targets vary by seed.

Design rule on top: every threat has one weakness, and every card answers a
threat (shown on the card as "vs …").

## Threats

| Threat | Behaviour | Weakness | Answered by | Debuts |
|---|---|---|---|---|
| Attack drone (Shahed-style) | Slow, weaving, swarms of 4–12, 1 dmg | Ammo drain | Wide Warhead, Chain Detonation, Flak Burst, holding fire | Wave 1 |
| Ballistic missile | Fast arc at where a ship *will be*; red impact circle; 2 dmg to the ship it lands on, 1 to neighbours in the blast | Short reaction window | Faster Interceptors, Proximity Fuse, Early-Warning Radar | Wave 2 |
| Guided missile | Homes, re-targets, 2 HP, 2 dmg; 40% go for the carrier from wave 3 | Must be hit early or twice | Twin Launch, Smoke Screen, Decoy Flares | Wave 3 |
| Supersonic missile | ~1 s on the rail with a red lock line, then very fast; 2 dmg | Seconds of warning, then none | Faster Interceptors, Proximity Fuse, Decoy Flares L2 | Strait (wave 6+), Gauntlet, Island, maps 4–5 |
| Heavy cruise missile | Slow, 8 HP, 4 dmg + 1 splash; 40% go for the carrier | Easy to leave too late | Twin Launch, Proximity Fuse L2, Rapid Hold | Strait (finale), Gauntlet, Island, maps 4–5 |
| Cluster missile | Splits into 4 bomblets near its target | Must die before the split | Faster Interceptors; Wide Warhead / Chain for bomblets | Island, maps 4–5 |
| Drone mothership | Drifts at the carrier dropping mini-drones, 5 HP | Kill the source | Twin Launch, Escort Frigate | Maps 4–5 |
| Strike jet (round 4) | Flies in from a screen edge along the densest band of hulls; guns hit every hull within 60 px, 1 dmg per pass; 3 HP | Tight formations | Split up (Pairs/Spread) on the orange band; Flak Burst; Smoke Screen L2 | Strait 5, Gauntlet 4, Island 4, Archipelago 3, Harbor 3 |
| Missile bomber (round 4) | Flies a line over open water and drops light (1 HP) guided missiles after a 400 px run-in; 3 HP | Shoot it before it drops | Flak Burst, Twin Launch | Strait 7, Gauntlet 6, Island 5, Archipelago 4, Harbor 4 |

Each map adds its own threat types on top of the shared wave table
(`extras` in `maps.ts`); bomblets and mini-drones are blamed on their parent
on the loss screen.

**Attack vectors** (playtest round 4: "get away from tapping the base"). By
the middle waves about half of all launches come from somewhere other than
the fixed bases:

- **Submarines** surface at open-water spots clear of the lanes (2 s of
  periscope, wake and a red ring first), fire a salvo of 4 ballistics 0.75 s
  apart or a drone swarm, and dive. They are launchers, not targets.
- **Missile trucks** on enemy roads: **pop-ups** drive in (from off screen or
  an island bunker), raise the launcher, fire and reverse out; **runners**
  drive the whole shore road and stop to fire along the way.
- **Aircraft** (see the table) come in from either edge after an arrow and a
  band or line shows where they will fly.

Trucks and subs carry launches the wave already had, and aircraft replace
part of a wave's budget, so the vectors move where threats come from more than
how many there are. `map.vectors` sets the wave each one starts on each map.

Threat speed rises each wave (×1.0 → ×1.5 by wave 10, capped ×1.8 in endless).

**Raids** (playtest round 3). A wave's launches bunch into raids every ~5 s
(`RAID` in `config.ts`), with 30% of drone swarms trickling in between. Each
raid is one family — a **swarm** (drones, motherships), a **barrage**
(ballistics, heavies, clusters) or a **volley** (guided, supersonics) — and is
announced 2.5 s ahead: its bases pulse in the raid's colour and a callout
names it and its counter. Ballistics, heavies and supersonics also go for the
carrier (`CARRIER_STRIKE`), so losing the carrier is a real risk.

## Maps (clear 10 waves to unlock the next; endless after)

Maps 4 and 5 (added in playtest round 2): **Harbor Mouth** — the channel
funnels into a harbour under enemy headlands, so pressure peaks right before
delivery; **The Archipelago** — enemy islets with gaps, motherships, a long
reach to the west end.


1. **The Strait** — enemy on the north shore, carrier near your shore.
2. **The Gauntlet** — enemy on both shores; the carrier holds mid-channel and
   ships pass either side of it.
3. **The Island** — you hold the south shore, the enemy holds the island *and*
   the far shore. Island bases give almost no warning; far-shore fire arcs over.

## Screen layout

- **Left rail — ship flow.** A 5-step slider from one ship every 8 s to one
  every 1.9 s, with a ×1 → ×3 score multiplier. Above it, the **formation
  button** opens Column / Pairs / Spread / Box, changeable mid-wave (ships glide
  to their new lanes); each option shows its strength and weakness.
- **Right rail — game speed.** 1× / 1.25× / 1.5× / 2× plus pause (Space also
  pauses). Time scale only; score is unaffected. 2× is the max (round 8); dev
  mode adds 3× and 4×.
- **Center — tap to intercept.** A tap reaches 44 CSS px. It fires at the
  nearest threat that still needs an interceptor (so repeated taps spread
  across a swarm), or collects a pickup if one is closer. The carrier's rack
  (shown above the deck) refills over time.

Holding a finger down keeps firing at whatever is under it (every 0.6 s, free
for everyone since round 4; Rapid Hold speeds it up).

Pickups (drop from kills, fade after 5 s): ammo (rack full), repair (most
damaged ship +2, else the carrier +2; rarer since round 5), overdrive (5 s of free instant fire — the
carrier glows cyan with a draining ring while it lasts), EMP (rare: destroys
every drone on screen). Round 4 adds **Time Warp** (threats at 40% speed for
4 s), **Shield** (no ship or carrier damage for 5 s), **Strike Package** (jets
sweep two lines of the screen, hitting everything they fly over and
knocking out any sub or truck under them) and **Full Steam** (convoy 60% faster for 5 s). Timed pickups show a
countdown chip; each new kind gets a banner the first time it drops.

## Formations

Each answers one raid type and pays for it elsewhere (`formations.ts`):

| Formation | Strength | Weakness | Answers |
|---|---|---|---|
| Column | ×1.3 speed: through soonest | splash reaches 1.5× (chains to the ship behind) | swarms |
| Pairs | balanced | — | anything, nothing best |
| Spread | splash weapons do half damage, hit one ship only | ×0.85 speed | barrages |
| Box | direct hits do 1 less damage | ×0.8 speed; splash reaches 1.8× and ignores the armour | volleys |

`npm run v2:formation-lab` measures this: a convoy takes one raid of each type
per formation, undefended and defended by a bot.

## Upgrade cards

A loadout holds **three different cards**. Each draft deals three (favouring
cards you hold); once three are held, a new card can be **swapped in** for one
you hold (tap it, then the card it replaces — that card's levels are lost),
and if nothing dealt can be taken without a swap, **Resupply** (repair and
refill, no slot) appears so keeping your build is always an option. Every
card has its own icon and colour (`src/v2/ui/icons.ts`). Every draft includes
at least one firepower card (`FIREPOWER`), so a hand is never all support.

17 cards since round 4 (no turret defences — the CIWS is gone):

- **Firepower:** Faster Interceptors, Quick Reload (Bigger Rack folded in),
  Wide Warhead, Chain Detonation, Twin Launch (Auto-Retarget folded in),
  Escort Frigate (a ship that sails in beside the carrier and holds station;
  taps launch from whichever is nearer, from the carrier's rack until level 2
  gives it a small one of its own; replaces the Shore Battery), Flak Burst, Proximity Fuse, Combat Rhythm,
  Rapid Hold.
- **Support:** Early-Warning Radar (raids, subs and aircraft flagged 1.5 s
  sooner, impact points, jamming), Salvage Crews (+25% drops), Supercharged
  Pickups, Pickup Magnet, Armored Hulls, Smoke Screen, Decoy Flares.

Round 6 audit: `npm run v2:audit` checks that no card or power-up lets
"mashing the screen" win (see `docs/design/v2-playtest-log-round6.md`).
All levels and numbers: `src/v2/data/upgrades.ts`; what each does on screen:
`docs/design/v2-playtest-log-round4.md`.

## Where to tune

| What | File |
|---|---|
| Every constant (speeds, HP, damage, rack, flow steps, loss limit, raids, carrier strikes) | `src/v2/data/config.ts` |
| The difficulty curve | `src/v2/data/waves.ts` |
| Maps (land, bases, carrier, channels, per-map threat scale) | `src/v2/data/maps.ts` |
| Cards | `src/v2/data/upgrades.ts` |
| Formations | `src/v2/data/formations.ts` |

## Playtest logs

Every run is recorded as its seed plus every input (`src/v2/sim/playlog.ts`)
and replays exactly. The last ten stay on the device. When the game is played
as the Claude artifact, each log is also written to the artifact's `playtests`
database, where Claude reads it directly. On the Vercel build each log is
POSTed to `/api/playlog` (`api/playlog.ts`), which keeps it in the project's
private Vercel Blob store; reads (`GET /api/playlog`, `?id=…`, `?all=1`) only
answer on per-deployment URLs, which Vercel Authentication protects. A log that
doesn't get through (no store connected yet, offline) stays on the device and
is resent on the next launch. `npm run e2e:v2:log` checks that flow in a
browser. `npm run v2:replay -- log.json` re-runs a
log, confirms it lands on the same score and losses, and prints a per-wave
breakdown. `node tools/v2/artifact-page.mjs <dir>` turns a build into the
artifact page.

## Testing

- `npm test` — includes `tests/v2/` (rules, taps, splash, re-targeting,
  formations, flow scoring, draft, clear/endless).
- `npm run v2:sweep -- 16` — a bot plays every map at each skill level and
  prints clear rates. `npm run v2:analyze -- --bot=average --map=strait
  --flow=4` adds per-wave detail (threats on screen, empty-screen share, shots
  fired, carrier pressure, heavy kills), and the same meter reads a
  real playtest log (`npm run v2:analyze -- log.json`). Round 3 baseline, max
  flow, 16 seeds — clears for sharp / average / spammer: Strait 15/16/5,
  Gauntlet 14/13/7, Island 11/12/4, Harbor 11/9/1, Archipelago 12/8/2
  (`docs/design/v2-playtest-log-round3.md`). Round 4, max flow, 10 seeds per
  map, the bots' usual card list — clears out of 50 for sharp / average /
  spammer: 38 / 35 / 11 (round 3: 40 / 37 / 11); with random card choices
  34 / 33 / 6 (`docs/design/v2-playtest-log-round4.md`).
- `npm run e2e:v2` (with `npm run preview -- --port 4173` running) — real
  clicks/touches in Chromium: menu, wave 1, draft, formation popup, flow
  slider, phone landscape. Screenshots land in `e2e/shots/v2/`.
- `v2.html?wave=7` starts any map at wave 7 (with the 6 cards a player would
  have drafted by then) for playtesting late waves;
  `?seed=N` replays one exact seed.
- **Dev playtest mode** (round 8): `v2.html?dev=1` turns it on for the device
  (`?dev=0` or the menu link turns it off). It opens every map, adds 3×/4×
  speed, a start-wave picker, a "Retry wave N" button on the loss screen (same
  cards, ships and score; a new log that carries the old one's inputs), and
  four run lengths, each half the last: Full (~8 min of waves), ½ (waves 0.4×
  as long with launches cut to match, loss limit 3), ¼ (also only waves 2, 4,
  6, 8, 10, drafting a card per wave skipped, loss limit 2), ⅛ (the ¼ run at
  2×). Dev runs never touch records or unlocks, and their logs carry `tempo`
  and `dev`, so they replay exactly and stay out of balance numbers.
  [v2-playtest-log-round8.md](v2-playtest-log-round8.md) has the measurements.

The playtest cycles, what each found and what changed are in
[v2-playtest-log.md](v2-playtest-log.md).

## Next candidates (not built)

- Sound and haptics (big for feel on a phone).
- A threat-warning edge marker for launches from off-screen-side bases.
- Daily seed / leaderboard for the endless mode.
- Flip V2 to be the default page once it plays better than V1.
