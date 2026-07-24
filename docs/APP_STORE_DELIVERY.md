# App Store Delivery Playbook (Capacitor → Xcode → TestFlight → App Store)

> **Status: PLANNING / LOGGED FOR LATER.** Nothing in here is installed yet.
> This is the reference we follow when the game is ready to ship. The core
> loop and content are still being built — do this *after* the game is worth
> shipping, not before.

This expands the short note in [IOS_PORT.md](IOS_PORT.md) with a concrete,
grounded plan and — importantly — an honest map of **what Claude Code can do
for you vs. what only you can do** (because it requires a Mac and your Apple
account).

---

## TL;DR

The chosen path is **Capacitor**: keep the existing Vite/TypeScript game,
build it to `dist/`, and let Capacitor wrap that bundle in a real Xcode
project for TestFlight / App Store. This is correct for this repo and does
**not** require a rewrite. Alternatives (Expo/EAS, a Swift/SpriteKit rewrite,
a generic PWA wrapper) are *not* the right first move.

```
game code (TS/HTML/CSS/canvas)
   │  npm run build
   ▼
dist/  (static web bundle)
   │  Capacitor  (npx cap sync ios)
   ▼
ios/   (real Xcode project)
   │  Xcode on a Mac  (archive + sign)
   ▼
TestFlight ──► App Store
```

## What Capacitor is (one paragraph)

Capacitor is a native wrapper/runtime. It creates an `ios/` folder that is a
real Xcode project, copies our built web bundle into it on every `cap sync`,
and exposes native phone features (storage, haptics, splash screen, status
bar, orientation) to our web code through plugins. It is **not** a game
engine and does **not** rewrite the game — it packages it into the format
Apple accepts. Mental model: Capacitor is the shipping container; the game is
the cargo; Xcode/App Store is the port authority.

---

## Why this repo is already well-positioned

Verified against the current codebase (2026-07):

| Requirement | Status | Where |
| --- | --- | --- |
| Relative asset paths for `file://` | ✅ done | `vite.config.ts` → `base: './'` |
| Mobile viewport + safe-area | ✅ done | `index.html` (`viewport-fit=cover`, `apple-mobile-web-app-capable`) |
| Landscape, touch-first, ≥44px targets, no keyboard/hover deps | ✅ done | `src/ui/` |
| Single storage seam to swap for native | ✅ done | `src/platform/save.ts` |
| Pure, DOM-free sim (portable, testable) | ✅ done | `src/sim/`, `src/data/` |
| Build/test/e2e scripts | ✅ done | `package.json` (`build`, `test`, `e2e`) |

So the first mobile version **wraps** the web build — no engine rewrite.

---

## ⚠️ The reality check (read this before assuming "minimal involvement")

Claude Code runs in a **Linux** cloud container. It can do all the
**JavaScript/web** side of this port. It **cannot**:

- Run `npx cap add ios` to completion in a way that builds (the generated
  Xcode project only *builds* on macOS).
- Run Xcode, archive, sign, or upload to TestFlight.
- Log into your Apple Developer account or create the App Store listing.

Those steps need **your Mac** with Xcode + an **Apple Developer Program**
membership (**$99/year**). This is Apple's wall, not a Capacitor limitation.
So the "minimal involvement" assumption holds for the code, and breaks at the
Apple account / Xcode boundary. Plan for a few hours of hands-on Mac time for
the first release; it gets faster after that.

### Division of labor

| Claude Code can do (in this repo) | Only you can do (needs Mac + Apple) |
| --- | --- |
| Install Capacitor npm packages | Install Xcode |
| Write `capacitor.config.ts` | Sign in to Apple Developer, pick Team |
| Add `ios:*` scripts to `package.json` | Run/test on a real iPhone |
| Refactor `save.ts` → Preferences (see gotcha) | Approve certs / provisioning profiles |
| Lock landscape in web + config | Create the App Store Connect app record |
| Add splash/icon config + placeholder assets | Upload screenshots, description, privacy |
| Run `npm run build`, `test`, `e2e` | Submit for review |
| Commit everything | Tap "Submit" |

---

## Phased plan

### Phase 0 — Prereqs (you, one-time)
- [ ] A Mac with a recent **Xcode** installed.
- [ ] **Apple Developer Program** membership ($99/yr).
- [ ] Decide final **app name** and **bundle ID** (see open questions).

### Phase 1 — Capacitor scaffold (Claude Code can do the JS parts)
- [ ] `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/preferences`
- [ ] Create `capacitor.config.ts` (name, bundle ID, `webDir: 'dist'`).
- [ ] Add scripts to `package.json`:
  ```json
  {
    "ios:build": "npm run build && npx cap sync ios",
    "ios:open":  "npx cap open ios",
    "ios:run":   "npm run ios:build && npx cap run ios"
  }
  ```
  (`cap init` / `cap add ios` are one-time setup, better run once than baked
  into a recurring script.)
- [ ] `npm run build` then `npx cap add ios` — **run on the Mac** so the
  generated Xcode project is usable.

### Phase 2 — Make it feel native (mostly Claude Code)
- [ ] **Storage → Preferences.** ⚠️ See the gotcha below — this is a real
      refactor, not a drop-in.
- [ ] Lock **landscape** (web CSS/orientation + Xcode
      `UISupportedInterfaceOrientations`).
- [ ] **Splash screen** + **app icon** (placeholders first, real art later).
- [ ] **Haptics** on hits/upgrades once we're happy with feel (`@capacitor/haptics`).
- [ ] Hide any browser-y affordances; verify safe-area on a Dynamic Island device.
- [ ] Confirm offline play after install (it's a self-contained bundle — should be free).

### Phase 3 — First TestFlight build (you, on the Mac)
- [ ] Open in Xcode, set Team + bundle ID, archive, upload to TestFlight.
- [ ] Install via TestFlight on your own iPhone, play a full campaign.
- [ ] **Do this manually once before automating anything.**

### Phase 4 — App Store submission (you)
- [ ] App Store Connect record, screenshots, description, privacy nutrition
      label, age rating, review notes.
- [ ] Submit for review.

### Phase 5 — Automation (optional, only after a manual release works)
- Keep current web CI as-is (`build` + `test` + `e2e`).
- Then pick one: **GitHub Actions + Fastlane** (full control, signing is the
  friction) · **Ionic Appflow** (easy mode, paid) · **Capgo** (GitHub-driven,
  less Fastlane upkeep). Decide once the game is worth shipping repeatedly.

---

## Gotchas found by reading the actual code

1. **Preferences is async; `save.ts` is sync.**
   `src/platform/save.ts` exposes synchronous `saveCampaign` / `loadCampaign`
   over a sync `KeyValueStore`. `@capacitor/preferences` is **Promise-based**
   (`await Preferences.get(...)`). You cannot just swap the backend behind the
   current interface. Cleanest fix: on app boot, **hydrate once** from
   Preferences into an in-memory cache, keep reads synchronous against the
   cache, and **write-through** asynchronously (fire-and-forget). That keeps
   the game loop synchronous and callers unchanged. Web keeps using
   `localStorage`; only the native build uses Preferences.

2. **Bundle ID: avoid a digit-led segment.**
   `com.50thycal.straitwatch` starts a segment with `50` — some reverse-DNS /
   Apple tooling dislikes digit-leading segments. Prefer e.g.
   `com.cal50.straitwatch` or `com.thycal.straitwatch`. Pick it **once** — the
   bundle ID is painful to change after the App Store record exists.

3. **Thin-wrapper rejection risk.** Apple rejects "website in a box" apps.
   This is a real playable game, so we're fine, but before submission ensure:
   offline play, native splash/icon, locked landscape, native saves, no
   browser chrome, comfortable touch targets on real iPhone sizes.

---

## Open questions for the future (decisions only you can make)

- **App name** — keep "Straitwatch", or something else for the store?
- **Bundle ID** — confirm the reverse-DNS ID (see gotcha #2). This is
  effectively permanent once live.
- **Apple Developer account** — do you have one, or budget the $99/yr?
- **Mac access** — is there a Mac available for the Xcode/signing steps? (No
  Mac = no iOS build; a rented cloud-Mac / Appflow / Capgo is the workaround.)

---

## The repeatable playbook (for future games)

Once Straitwatch ships, every future Vite/canvas game follows the same shape:

```
npm ci
npm run build
npx cap sync ios
npx cap open ios     # then archive in Xcode
# later, once automated:
npm run build && npx cap sync ios && fastlane beta
```

Keep the same repo conventions this game already has (pure `sim/`+`data/`,
web-only `ui/`, single `platform/` storage seam, relative Vite base) and the
port stays this easy.
