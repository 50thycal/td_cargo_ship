# Straitwatch

An adaptive convoy-defense roguelite: shepherd civilian convoys through
contested regions against an enemy that **evolves in response to how you
defend**. Predator and prey in an arms race — every convoy that gets through
teaches the enemy something, and every weapon of theirs you destroy is
wreckage your escorts can recover and turn into technology.

This is the desktop-testable MVP. It is built to be ported to iPhone/App Store
later (see [docs/IOS_PORT.md](docs/IOS_PORT.md)).

## Play it

```bash
npm install
npm run dev        # open the printed URL in a browser
```

The game is designed for a landscape phone screen but plays fine in any
desktop browser window. Mouse clicks = screen taps; there are no
hover/right-click/keyboard requirements.

**How to play:** pick an unlocked region and a Commander Ability loadout, then
run convoys. Protect them during transit (tap incoming missiles to launch
interceptors, order escorts around the map, call in A-10 gun runs and scan
passes) — and when
you destroy an enemy weapon, hold an escort inside the wreckage it leaves to
recover it; do the same for the crews of lost ships before the water takes
them. After each round, read the after-action report and take exactly one
technology from the mandatory draft — one option on every table answers
whatever is actually getting through to your convoy, and a pick that unlocks
hardware arrives with one free unit of it fitted — then spend cash on
modules/escorts/repairs and sail again. Keep confidence
above zero and the shipping quota met: either failure ends the regional run at
round 1 of the same region. Survive to the region's completion round to secure
it, unlock the next one, and earn Commander XP — the only thing that outlives
a run. The full redesign is specified in
[docs/design/roguelite-redesign.md](docs/design/roguelite-redesign.md).

## Test it

```bash
npm test           # headless simulation tests (full campaigns, no browser)
npm run build      # type-check + production bundle
npm run preview -- --port 4173 &
npm run e2e        # Playwright browser smoke test (screenshots in e2e/shots/)
```

## Architecture

```
src/
  sim/        Pure deterministic simulation. No DOM, no timers, no
              Math.random — all randomness flows through a seeded RNG so any
              campaign replays identically from its seed.
    rng.ts        seedable RNG (mulberry32)
    types.ts      every shared type (plain data, engine-portable)
    transit.ts    real-time convoy transit: ships, missiles, mines,
                  interceptors, point defense, formations, abilities,
                  wreckage recovery and crew rescue
    evolution.ts  the adaptive enemy: procurement economy, region-gated
                  branches, scripted early beats, fairness caps, warnings
    campaign.ts   the regional run: economy, quota, confidence, convoy
                  scaling, procurement actions, victory/defeat
    draft.ts      the mandatory post-round technology draft
    commander.ts  the permanent Commander Profile (XP, abilities, regions)
    aar.ts        after-action narrative cards
  data/       All balance numbers and content definitions. Nothing is
              hard-coded in sim logic.
  ui/         Canvas renderer + DOM screens. Consumes sim state, emits
              TransitCommands. Landscape, touch-first.
  platform/   Save system (localStorage now, native storage after port).
              Two separate saves: the permanent Commander Profile and the
              temporary active Regional Run — clearing one never touches
              the other.
tests/        Headless campaign tests with scripted bot players.
e2e/          Browser smoke test (Playwright).
```

The split matters for the port: `sim/` + `data/` have zero browser
dependencies and run in Node as-is. The UI layer is the only thing a future
platform change touches.

## Design

The full game design (core loop, enemy evolution rules, economy, scaling,
losing condition) is in [docs/DESIGN.md](docs/DESIGN.md).
