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
   lanes at constant speed; a formation is just which lane each hull takes.
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
| Attack drone (Shahed-style) | Slow, weaving, swarms of 4–12, 1 dmg | Ammo drain | Wide Warhead, Chain Detonation, Bigger Rack, CIWS | Wave 1 |
| Ballistic missile | Fast arc at where a ship *will be*; red impact circle; 2 dmg splash | Short reaction window | Faster Interceptors, Early-Warning Radar | Wave 2 |
| Guided missile | Homes, re-targets, 2 HP, 2 dmg; some go for the carrier from wave 6 | Must be hit early or twice | Twin Launch, Auto-Retarget | Wave 4 |
| Supersonic missile | ~1 s on the rail with a red lock line, then very fast; 2 dmg | Seconds of warning, then none | Faster Interceptors, Hold to Fire on the line | Gauntlet, Island, maps 4–5 |
| Heavy cruise missile | Slow, 4 HP, 6 dmg + 1 splash | Easy to leave too late | Twin Launch, Hold to Fire | Gauntlet, Island, maps 4–5 |
| Cluster missile | Splits into 4 bomblets near its target | Must die before the split | Faster Interceptors; Wide Warhead / Chain for bomblets | Island, maps 4–5 |
| Drone mothership | Drifts at the carrier dropping mini-drones, 5 HP | Kill the source | Twin Launch, CIWS | Maps 4–5 |

Each map adds its own threat types on top of the shared wave table
(`extras` in `maps.ts`); bomblets and mini-drones are blamed on their parent
on the loss screen.

Threat speed rises each wave (×1.0 → ×1.5 by wave 10, capped ×1.8 in endless).

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
  to their new lanes).
- **Right rail — game speed.** 0.5× / 1× / 2× / 3× plus pause (Space also
  pauses). Time scale only; score is unaffected.
- **Center — tap to intercept.** A tap reaches 44 CSS px. It fires at the
  nearest threat that still needs an interceptor (so repeated taps spread
  across a swarm), or collects a pickup if one is closer. The carrier's rack
  (shown above the deck) refills over time.

Pickups (drop from kills, fade after 5 s): ammo (rack full), repair (most
damaged ship, else the carrier), overdrive (5 s of free instant fire), EMP
(rare: destroys every drone on screen).

## Upgrade cards

A loadout holds **three different cards**. Each draft deals three (favouring
cards you hold); once three are held, new cards show as SLOTS FULL, and if
nothing dealt can be taken, **Resupply** (repair and refill, no slot) appears.

Faster Interceptors, Bigger Rack, Quick Reload, Wide Warhead, Chain
Detonation, Twin Launch, Auto-Retarget, Carrier CIWS, Early-Warning Radar,
Shore Battery (a second launch point), Hold to Fire. All levels and numbers:
`src/v2/data/upgrades.ts`.

## Where to tune

| What | File |
|---|---|
| Every constant (speeds, HP, damage, rack, flow steps, loss limit) | `src/v2/data/config.ts` |
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
- `npm run v2:sweep -- 16` — a bot plays every map at three skill levels
  (sharp / average / casual reaction times, with phone-measured miss rates)
  and prints clear rates. Baseline after the playtest cycles: sharp and
  average clear everything; casual clears ~81% of Strait, ~63% of Gauntlet,
  ~38% of Island.
- `npm run e2e:v2` (with `npm run preview -- --port 4173` running) — real
  clicks/touches in Chromium: menu, wave 1, draft, formation popup, flow
  slider, phone landscape. Screenshots land in `e2e/shots/v2/`.
- `v2.html?wave=7` starts any map at wave 7 (with the 6 cards a player would
  have drafted by then) for playtesting late waves;
  `?seed=N` replays one exact seed.

The playtest cycles, what each found and what changed are in
[v2-playtest-log.md](v2-playtest-log.md).

## Next candidates (not built)

- Sound and haptics (big for feel on a phone).
- A threat-warning edge marker for launches from off-screen-side bases.
- Daily seed / leaderboard for the endless mode.
- Flip V2 to be the default page once it plays better than V1.
