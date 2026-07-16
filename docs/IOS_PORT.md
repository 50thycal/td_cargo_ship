# iOS / App Store Port Path

> **For the full, grounded delivery plan** (phases, division of labor between
> Claude Code and the Mac/Apple steps, code-level gotchas, and open
> decisions), see [APP_STORE_DELIVERY.md](APP_STORE_DELIVERY.md). This file is
> the short version.

The MVP is a web build specifically so it can be wrapped with
[Capacitor](https://capacitorjs.com), which produces a real Xcode project for
App Store submission. Many shipped App Store games use this exact path.

## Why this works here

- The UI is already **landscape, touch-first**: pointer events (tap = click),
  ≥44px targets, no hover/right-click/keyboard requirements, safe-area
  insets already respected (`viewport-fit=cover` + `env(safe-area-inset-*)`).
- `vite.config.ts` uses `base: './'`, so the bundle works from the `file://`
  context Capacitor serves.
- Saves go through `src/platform/save.ts` — a single seam to swap
  localStorage for Capacitor Preferences (recommended, since WKWebView
  localStorage can be evicted).

## Steps (run on a Mac with Xcode installed)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init Straitwatch com.yourdomain.straitwatch --web-dir=dist
npm run build
npx cap add ios
npx cap open ios      # opens the generated Xcode project
```

Then in Xcode: set signing team, lock orientation to landscape, build to a
device or simulator. After each web change: `npm run build && npx cap sync`.

## Recommended hardening before submission

1. **Storage:** swap localStorage for `@capacitor/preferences` in
   `src/platform/save.ts` (the interface already matches).
2. **Orientation:** lock to landscape in the Xcode project settings
   (`UISupportedInterfaceOrientations`).
3. **Status bar / notch:** already handled via safe-area CSS; verify on a
   device with a Dynamic Island.
4. **Audio/haptics:** add via Capacitor plugins when sound is introduced.
5. **Performance:** the canvas renderer draws a few hundred primitives per
   frame — far below WKWebView limits. If later art passes push it, move the
   render layer to WebGL (PixiJS) without touching `src/sim`.

## Alternative if a fully native feel is ever required

`src/sim` + `src/data` are pure TypeScript with zero DOM dependencies and a
seeded RNG — they define the complete game behaviorally. A Swift/SpriteKit
front end could be written against the same state/command shapes, using the
TypeScript sim as the executable spec. That is a rewrite of the UI layer only.
