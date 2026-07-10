# Straitwatch

An adaptive convoy-defense game: shepherd civilian convoys through a contested
strait against an enemy that **evolves in response to how you defend**.
Predator and prey in an arms race — every convoy that gets through teaches the
enemy something, and every attack they invent teaches you.

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

**How to play:** protect the convoy during transit (tap incoming missiles to
launch interceptors, switch formations, change lanes, fire ECM/scan pulses),
read the after-action report, choose a research project (takes one full round
to complete), spend cash on modules/escorts/repairs, and launch the next
convoy. Deliver enough cargo to keep consortium confidence above zero. Strong
performance grows your convoy capacity — and draws a smarter enemy.

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
                  interceptors, point defense, formations, abilities
    evolution.ts  the adaptive enemy: hidden tech tracks, behavior-driven
                  allocation, scripted early beats, fairness caps, warnings
    campaign.ts   meta-game: economy, research, quota, confidence,
                  convoy scaling, procurement actions
    aar.ts        after-action narrative cards
  data/       All balance numbers and content definitions. Nothing is
              hard-coded in sim logic.
  ui/         Canvas renderer + DOM screens. Consumes sim state, emits
              TransitCommands. Landscape, touch-first.
  platform/   Save system (localStorage now, native storage after port).
tests/        Headless campaign tests with scripted bot players.
e2e/          Browser smoke test (Playwright).
```

The split matters for the port: `sim/` + `data/` have zero browser
dependencies and run in Node as-is. The UI layer is the only thing a future
platform change touches.

## Design

The full game design (core loop, enemy evolution rules, economy, scaling,
losing condition) is in [docs/DESIGN.md](docs/DESIGN.md).
