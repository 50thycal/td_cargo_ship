# Handoff: Straitwatch to the App Store, through app_farm (no Mac)

For the next AI session, with both repos attached:
- `50thycal/td_cargo_ship`: the game;
- `50thycal/app_farm`: the pipeline from idea to App Store.

Written 2026-11-03 at the end of a long session that built V3 (maps, sound, menus).

---

## 1. The decision (approved by the owner)

Ship Straitwatch on iOS as a **Capacitor app**: the existing Vite/TypeScript canvas game, bundled offline in a native shell.

- **Build and upload:** on a **GitHub Actions macOS runner**, signed with an App Store Connect API key.
- **Store work:** listing, legal pages, preflight and App Store Connect run through **app_farm**, extended for a "web game" kind of app.
- **No Mac.** The owner should never need their Mac.

The owner answered "Alright let's do recommendation" to this route:

| Route | Status |
|---|---|
| **A. Capacitor + GitHub macOS runner + app_farm** | **chosen** |
| B. Expo app hosting the game in `react-native-webview` | rejected: the same review risk as A, plus clumsy local loading of ES modules and 196 audio files |
| C. Native rewrite (React Native + Skia) | rejected for now: weeks of work, and the new menus are thrown away. Keep it as the fallback if Apple rejects A. |

**Guideline 4.2 (minimum functionality).** The current text says: "include features, content, and UI that elevate it beyond a repackaged website… lasting entertainment value". Nothing bans web technology.

Straitwatch is a complete offline game (20 maps, progression), so the risk was judged low, provided the store build:
- loads nothing remote;
- shows no browser chrome or external links;
- uses native storage, haptics and orientation;
- ideally adds Game Center.

Guideline 4.7 (HTML5 mini-games *not embedded in the binary*) does not apply: our game is in the binary. The worst case is a rejection and a resubmit, not a ban.

**app_farm's rule 4** ("Never wrap a web view as the app") must get a **documented exception** for self-contained offline games. The owner approved this route knowing that. Make the exception in its own explained commit (app_farm rule 1: never quietly weaken a gate).

---

## 2. The game repo: `td_cargo_ship`

- **Default branch for PRs:** `claude/mobile-game-predator-prey-tu1t5k`, the trunk. Branch off it, and open PRs against it.
- **Stack:** Vite + TypeScript, canvas 2D, a deterministic sim.
- **The shipping game is V3, at `v3.html`.**
  - `vite.config.ts` builds three pages: `index.html` (the old classic game), `v2.html` and `v3.html`.
  - `base: './'` is already set; `__BUILD__` is a build stamp.
- **Layout:**

  | Path | What it is |
  |---|---|
  | `src/v3/sim/` | pure, DOM-free game logic |
  | `src/v3/data/` | maps (20), armory, abilities, config |
  | `src/v3/ui/app.ts` | the whole DOM UI and frame loop, about 2,800 lines |
  | `src/v3/ui/style.css` | about 3,900 lines |
  | `src/v3/ui/render.ts`, `features.ts`, `vectors.ts` | canvas drawing |
  | `src/v3/ui/thumbs.ts` | map pictures for the menu |
  | `src/v3/ui/chrome.ts` | line icons and the radar mark SVG (`MARK_SVG`), the source for the app icon |
  | `src/v3/audio/` | Web Audio engine and manifest |
  | `public/v3/audio/` | 4.3 MB, 196 files, all **CC0**. See `public/v3/audio/CREDITS.json`. |
  | `src/v3/platform/save.ts` | progress (sync read/write over localStorage) |
  | `src/v3/platform/playlogStore.ts` | playtest logs: stored locally, POSTed to `/api/playlog` (`api/playlog.ts`, Vercel Blob) |

- **The `dist/` build** is about 5.8 MB.
- **Everything localStorage holds.** This is the full list to move behind one storage seam, kept in memory with native write-through:

  | Key | Where |
  |---|---|
  | `straitwatch.v3.progress` | `platform/save.ts`. **Must survive.** |
  | `straitwatch-v3-audio` | `audio/engine.ts`. Note the dash style. |
  | `straitwatch.v3.tips` | `ui/app.ts` |
  | `straitwatch.v3.freeplay` | `ui/app.ts` |
  | `straitwatch.v3.notes` | `ui/notes.ts`, playtest notes on/off |
  | `straitwatch.v3.dev`, `straitwatch.v3.dev.settings` | `ui/dev.ts` |
  | `straitwatch.v3.playlogs`, `straitwatch.v3.playlogs.sent` | `platform/playlogStore.ts` |

- **Playtest tooling that must NOT be in the App Store build.** It stays in the Vercel/TestFlight playtest build.
  - Playtest notes are **on by default** (`NOTES_DEFAULT = true` in `ui/notes.ts`). That means a Note button in the menu and in-game, ★ RATE after volleys, and "📝 Review" on the result screen.
  - Every run's log uploads to `/api/playlog`, and the result screen offers "Download log". This is data collection: it would change the App Privacy label.
  - **Developer mode** is a switch in Settings, with watch mode, presets and the sound board. "Play V2" is already developer-only.
- **Already done and verified:**
  - landscape-only UI;
  - a portrait "turn your phone" prompt on every screen;
  - safe-area handling;
  - touch targets of 44 px or more;
  - reduced motion respected;
  - audio unlock on the first tap;
  - audio suspended when the page is hidden;
  - progress saved on `visibilitychange`, but **the game does not auto-pause when backgrounded** (add that).
- **Tests:**

  | Command | What it covers |
  |---|---|
  | `npm test` | vitest, 967 tests (CI runs `build` + `test` on every push) |
  | `node e2e/v3.mjs` | 137 Playwright checks; needs `npx vite preview --port 4173` |
  | `node e2e/v3-audio.mjs` | the audio checks |

  Chromium is at `/opt/pw-browsers/chromium`. Load Playwright with `createRequire('<repo>/package.json')('playwright-core')`.
- **Docs worth reading:**
  - `docs/APP_STORE_DELIVERY.md`: the earlier Capacitor plan and its gotchas. The bundle ID must not start a segment with a digit, so not `com.50thycal…`.
  - `docs/design/v3-menus-polish.md`: the latest UI round.
  - `docs/design/v3-plan.md`.

## 3. The pipeline repo: `app_farm`

- **Default branch:** `main`. Read its `AGENTS.md`, `CLAUDE.md`, `docs/RUNBOOK.md`, `docs/HUMAN_STEPS.md` and `docs/SETUP.md` first.
- **The `farm` CLI** (`npm run farm -- …`, in `farm/cli.ts`) tracks state per app in `apps/<slug>/pipeline.json` and gates every stage: `intake → spec → scaffold → build → playtest → listing → assets → legal → preflight → [native-qa] → release → store → submit`.
- **It assumes an Expo/React Native app** in `apps/<slug>/app`:
  - `farm/stages/scaffold.ts` renders an Expo project;
  - `.github/workflows/farm-ios-release.yml` builds it with **EAS**, which cannot build Capacitor;
  - `farm-native-qa.yml` runs on `macos-15` with Maestro.
- **Reusable as-is or nearly:**
  - `farm-asc.yml` / `farm/asc/*`: the App Store Connect API (bundle-id, listing, price, attach, submit). Submit needs `confirm=SUBMIT` and the owner's explicit "submit".
  - `farm-legal-site.yml` / `farm/stages/legal.ts`: privacy, terms and support pages.
  - `farm/stages/listing.ts`: metadata limits and risky-wording checks.
  - `farm/stages/preflight.ts`: about 60 checks.
  - The `apple/` checklists.
- **What doesn't fit Straitwatch:**
  1. **Portrait only.** `farm/lib/apple.ts` `DEVICES['iphone-6.9']` hard-codes `out: [1320, 2868]`, `viewport: [440, 956]` and `preview: [886, 1920]`. Straitwatch needs **2868×1320** screenshots (`accepted` also allows 2796×1290 and 2736×1260) and a **1920×886** preview. The spec schema already has `orientation: 'portrait'|'landscape'|'default'` (`farm/schemas/index.ts:74`); assets and preflight must honour it.
  2. **Expo only:** scaffold, build gate, playtest (a journeys DSL over the Expo web export) and release.
  3. **The web-view rule.** `farm/stages/preflight.ts:92` warns on `react-native-webview`, and `AGENTS.md` rule 4 forbids web-view wrappers. See the exception in §1.
- **Status of the sample app:** `apps/sprout` passed every cloud stage. `native-qa`, `release`, `store` and `submit` have never run. `farm.config.json` owner fields are **empty** and `bundleIdPrefix` is the placeholder `com.appfarm`. Assume no GitHub secrets exist yet.
- **Cloud sessions** may be blocked from `expo.dev`, `api.appstoreconnect.apple.com` and `api.vercel.com`. Do release and App Store Connect work through GitHub Actions: GitHub MCP `actions_run_trigger`, and workflows must be on the default branch.

---

## 4. The work

Two workstreams. Do W1 first; W2 can start in parallel on the farm side. Verify everything in a real browser or on a real CI run, and report only what you actually ran.

### W1: in `td_cargo_ship`

1. **Store flavour.** Add a build-time flag (for example `VITE_FLAVOR=store|playtest`, defaulting to `playtest` so the Vercel build stays as it is). In the store flavour:
   - the app's single page is V3 (an `index.html` that is V3, or a store-only Vite config with a single input);
   - no playtest notes, ★ RATE, Review timeline, log upload, "Download log" or Developer mode;
   - Settings gains **version** (from `package.json` or a new app version), **Credits** (CC0 sounds; Feather icons are MIT, see `ui/chrome.ts`), a **Privacy policy** link (URL from the farm's legal site) and **Reset progress** (with a confirm);
   - **auto-pause** when the app is hidden (`visibilitychange` / Capacitor `App` `pause`);
   - no external links, and no `fetch` to any remote host. Only bundled assets.
2. **Capacitor.**
   - Add `@capacitor/core` and `@capacitor/cli`, plus `@capacitor/ios`, `@capacitor/preferences`, `@capacitor/haptics`, `@capacitor/splash-screen`, `@capacitor/status-bar` and `@capacitor/app`. **Check the current Capacitor major and its docs** before choosing versions, and whether `ios/` uses Swift Package Manager or CocoaPods.
   - Add `capacitor.config.ts` with `webDir: 'dist'` (the store build output).
   - Generate `ios/` if it can be generated on Linux (with SPM it should); otherwise generate it in the CI job.
   - Landscape-only `UISupportedInterfaceOrientations` (iPhone; decide iPad: `supportsTablet` false is the farm default).
   - Set `ITSAppUsesNonExemptEncryption = false`.
   - Add a `PrivacyInfo.xcprivacy` declaring the required-reason APIs used. UserDefaults via Preferences is the likely one.
3. **Storage seam.**
   - Create one module, e.g. `src/v3/platform/store.ts`, that loads every key in the table above from Preferences into memory once at boot, before `new App()`.
   - Reads stay synchronous against memory; writes go to memory and to Preferences asynchronously. Web keeps localStorage.
   - Move every `localStorage` call in `src/v3` behind it.
   - **Migration:** on the first native launch, copy any existing localStorage values across.
   - Add tests.
4. **Haptics.** Light on a kill, medium on a ship lost or carrier hit, success on winning a card or clearing a map. Throttle them (busy waves fire many kills a second), add a Settings switch, and do nothing on the web.
5. **Icon and launch screen.**
   - A 1024×1024 PNG with **no alpha**, built from the radar mark (`MARK_SVG`) on the game's dark navy.
   - A dark launch screen.
   - Look at them at small sizes.
6. **Game Center** (if the owner says yes): one leaderboard per map (best score) and a few achievements. Use a maintained Capacitor plugin; check what exists now.
7. **Monetization** (if not free): a StoreKit plugin, a Restore button, and pricing copy. Wait for the owner's decision; see §6.
8. **Verify:** `npm test`, both e2e suites, a store-flavour browser run at 874×402, 844×390 and 667×375, and a check that the store bundle contains no `/api/playlog` and no developer UI (grep `dist`).

### W2: in `app_farm`

1. **A "web game" app kind** (for example `spec.json app.kind: 'web-game'`, plus `source: { type: 'repo', value: '50thycal/td_cargo_ship', ref, buildCmd, webDir }`). Its scaffold, build and playtest stages:
   - check out and build the game repo;
   - for **playtest**, run the game's own suites (`npm test`, `e2e/v3.mjs`) and capture screens.
2. **Landscape.**
   - Add a landscape device spec (2868×1320 screenshots; a 1920×886 preview, 15–30 s, ≤30 fps, H.264 with an AAC track) in `farm/lib/apple.ts`.
   - Make assets, preflight and the ASC upload honour `orientation`.
   - Capture **from the real game** with Playwright, using demo saves: progress, cards held, mid-wave action with weapons.
   - Look at every PNG (farm rule 2).
3. **Preflight.**
   - Add the web-view exception for `web-game`, with replacement checks:
     - store flavour on;
     - no remote URLs or `fetch` in the bundle;
     - no `/api/playlog`;
     - Preferences, Haptics and orientation lock present;
     - the icon has no alpha.
   - Document it in `AGENTS.md`, `apple/REVIEW_GUIDELINES_CHECKLIST.md` (4.2 row) and the runbook.
4. **Release workflow:** a new `farm-capacitor-release.yml` on `macos-15`.
   - Check out both repos, run `npm ci`, build the store flavour, run `npx cap sync ios`.
   - Archive with `xcodebuild archive` using automatic signing via the API key: `-allowProvisioningUpdates -authenticationKeyPath/-authenticationKeyID/-authenticationKeyIssuerID`. **Verify these flags against the runner's Xcode.**
   - Export the `.ipa` and upload to TestFlight (fastlane `upload_to_testflight` with the API key, or `xcrun altool`; check what is current).
   - Bump the build number automatically (for example from the run number).
   - Record the build with `farm mark-build`.
   - It reuses the existing secrets (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`, `APPLE_TEAM_ID`). No `EXPO_TOKEN` is needed.
5. **Optional native QA:** boot the simulator on `macos-15`, install the simulator build, launch it, take landscape screenshots (`simctl io screenshot`), and record a preview (`simctl io recordVideo`).
6. **Add the app.**
   - Create `apps/straitwatch` with `idea.md`, `brief.json` and `spec.json`: `orientation: 'landscape'`, category Games (Strategy / Action), the monetization decision, `needsBackend: false`, `needsAccounts: false`, age rating answers (cartoon military violence).
   - Then `store/listing.json`, `store/icon.svg`, the `site/` legal pages, and `store/app_privacy.json`: **Data Not Collected** if W1 removed log upload and nothing else collects.
   - Run every gate to green.

---

## 5. The owner's steps, from any browser (no Mac)

From app_farm's `docs/HUMAN_STEPS.md`:

1. Apple Developer Program ($99/yr), plus Agreements, Tax and Banking in App Store Connect.
2. App Store Connect API key (App Manager), then GitHub secrets on **app_farm**: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`, `APPLE_TEAM_ID`. Prompt the owner for these with exact click paths; never ask them to paste secrets into chat.
3. Fill in `farm.config.json`: owner legal and display name, a public support email, country, and `bundleIdPrefix`. These go on public pages.
4. Create the App Store Connect app record on the web (2 min), after `farm-asc action=bundle-id`. Then `farm set straitwatch ascAppId <id>`.
5. The App Privacy label on the web (2 min), matching `store/app_privacy.json`.
6. Install the TestFlight build on their iPhone and play it.
7. Say **"submit"**. Only then trigger `farm-asc action=submit confirm=SUBMIT`.

## 6. Open decisions (ask once, with a recommended default)

| Decision | Recommended default |
|---|---|
| Monetization | Paid up front, or free with one unlock IAP (chapters 2–4). No ads. |
| App name | "Straitwatch". Check it's free in App Store Connect. |
| Bundle ID | `com.<owner-domain-or-handle>.straitwatch`, with no digit-led segment. Permanent once the record exists. |
| Game Center | **Yes**: per-map leaderboards plus a few achievements. Also a strong "native app" signal for 4.2. |
| iPad | No for v1 (`supportsTablet: false`). |
| TestFlight beta flavour | Keep the playtest tools (notes, logs) on in TestFlight builds; store flavour for review. |

## 7. Rules for this work

- **Never weaken a gate to pass it.** The web-view exception is the one sanctioned change, made in its own commit.
- **Never submit for review, spend money or create accounts** without the owner's explicit OK in that session.
- **No secrets in either repo.**
- **The owner's preferences:**
  - technical and very proactive;
  - test against goals in repeated build–test–review–improve cycles, with real browser or CI checks, not just builds;
  - record what each cycle found;
  - never claim tests you didn't run;
  - finish with what improved, what was verified, and what's left.
- **Look at your output:** screenshots, icon and preview video, as a picky App Store reviewer would.

## 8. Suggested first message for the next session

> Read `td_cargo_ship/docs/APP_STORE_HANDOFF.md` and app_farm's `AGENTS.md`. Ask me the open decisions in §6 (one round, with your defaults). Then start W1 (the store flavour, Capacitor and the storage seam) in td_cargo_ship and W2 (web-game kind, landscape assets, preflight exception, Capacitor release workflow) in app_farm. Work in cycles with real browser/CI verification, open PRs in both repos, and tell me exactly which of §5 I need to do and when.
