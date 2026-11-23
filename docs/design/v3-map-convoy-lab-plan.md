# V3 Map & Convoy Lab — design and implementation handoff

**Status:** Approved direction; **planning document only**. No implementation is authorized by this documentation commit.
**Date:** 2026-11-11
**Project:** Straitwatch / Cargo Ship, V3 (`/v3.html`)
**Owner's intent:** The V3 player and enemy weapons, enemy combinations and special events are in a good place after playtesting. Improve the maps and wave encounters using real spatial evidence. Test whether convoy flow and formation controls should be simplified into map-specific tactical commands. **Do not reopen general weapon balance during the lab phase except to fix a proven blocker.**

> **Coding-session starting point:** Read this document, `docs/design/v3-test-lab.md`, `docs/design/v3-maps-plan.md`, `docs/design/v3-maps-build.md`, `docs/design/v3-events-round7.md`, and the V3 files listed in §2. Implement in the phases and decision gates below, beginning with telemetry and a viewer, not with changes to all 20 maps. The present task is a plan only; a future session may be asked to implement it.

## 1. Product goal and design principles

Create a **V3 Map & Convoy Lab**: a repeatable, deterministic map/encounter testing workflow that shows *where, when and why* damage happens, measures the value of convoy commands, and turns those findings into better maps and authored wave encounters.

A memorable map should present a distinct **tactical dilemma** that the player can read and influence:

- **Weapons** = the player's means of response.
- **Enemy combinations** = competing demands and priority decisions.
- **Geography** = attack angles, time-to-impact, exposure and protected/vulnerable stretches.
- **Wave/event sequence** = teaching, combining, escalating and climactic testing.
- **Convoy commands** = an occasional, meaningful choice supporting the core interceptor-combat loop, **not a second real-time micromanagement game**.

Non-negotiable design rules:

1. Keep interception, weapon pickups and target prioritization the primary action.
2. The convoy moves by itself by default. The player intervenes with a readable, consequential command.
3. Every map has one defining idea; commands and encounters should reinforce it rather than add novelty for novelty's sake.
4. A tactical choice needs a telegraphed tradeoff and observable consequence. Do not confuse surprise punishment with difficulty.
5. Difficulty should increasingly come from threat coordination, launch geometry, timing and competing priorities—not merely enemy count or `threatScale`.
6. Maintain the existing V3 campaign's 20-map chapter order, Armory, enemy catalog, Test Lab, ten normal waves, bonus-event handling, and map-specific event ending unless a later **explicit decision gate** authorizes change.
7. Never treat a successful bot sweep as proof the human-facing encounter is fair. Verify on a landscape phone, especially darkness, stealth, reaction windows and small touch targets.
8. All observations must be replayable and attributable to a concrete content version, configuration and seed. Never silently compare different builds as if they were equivalent.
9. Preserve V1 and V2; keep this work confined to V3 and shared systems only when safe and intentionally reviewed.

### Definition of success

- A designer can select a V3 map/run/test case and see **launch, damage, pickups, player inputs/kills and convoy exposure** as distinct overlays on the real map.
- Any suspicious hotspot can be filtered by wave, event phase, time window, enemy kind, weapon, formation/command and run, and opened in deterministic playback.
- The lab can run an identical scenario across control modes, seeds and reference maps without accidental differences in progression/loadout.
- We can show whether convoy commands create *genuine* strategic agency, and make a reasoned choice among automatic, formations-only, current controls and simplified tactical commands.
- The Strait, Gauntlet and Harbor Mouth each demonstrate different decisions, not the same waves on different artwork.
- A later session has objective evidence and reusable tools to tune the remaining 17 maps; this phase does not prematurely rebuild them.

## 2. Verified current V3 foundations (as of this plan)

Use the source of truth in the current branch; names and details may evolve before implementation.

| Existing component | Location / behavior | Implication for the lab |
| --- | --- | --- |
| V3 game simulation | `src/v3/sim/game.ts` | Instrument actual sim events; do not infer hit attribution from graphics. |
| Seeded input record/replay | `src/v3/sim/playlog.ts`, `LOG_VERSION = 19` at review | Existing `Recorder` / `Playback`, `SIM_DT = 1/60` and compact input commands. Reuse; extend compatibly. |
| Existing convoy inputs | Playlog `'f'` (flow), `'m'` (formation); `setFlow` / `setFormation` | New commands must have deterministic input representation and replay tests. |
| Four formations | `src/v3/data/formations.ts` | Column ×1.3 speed / splash chain; Pairs balanced; Spread ×0.85 with splash reduction; Box ×0.8 with direct-hit armor and splash exposure. |
| Five flow settings | `src/v3/data/config.ts`, `FLOW_STEPS` | 8, 5.5, 4, 2.8, 1.9 s intervals; associated scoring multipliers 1, 1.4, 1.8, 2.4, 3. Default index 1. |
| World coordinates | `VIEW = 1600 × 900` in V3 config | Store spatial metrics in **world units**, never screen/CSS coordinates. |
| Map geometry and lanes | `src/v3/data/mapTypes.ts`, `maps.ts`, `maps20.ts`, `src/v3/sim/lanes.ts` | Preserve path-based, narrow, reversing, gated, forked, tidal, VIP and island routes. |
| Wave baseline | `src/v3/data/waves.ts` | Ten shared escalating waves, per-map `threatScale` and extras; preserve baseline during phase-1 instrumentation. |
| Special and bonus events | `src/v3/data/events.ts`, `src/v3/sim/events.ts` | All maps have a signature event; current experiment is three ending runs (waves 11–13), with convoy/carrier restored before the first. Siren Field can appear as a bonus after wave 6. **Treat event phases separately from ordinary waves** in telemetry. |
| Test Lab | `docs/design/v3-test-lab.md`, `src/v3/data/lab.ts`, `src/v3/sim/lab.ts`, `src/v3/ui/lab.ts`, `tools/v3/test-lab/` | Existing enemy/weapon/combo/map cards, Quick/Full modes, notes, verdicts, card versions. Extend this hub; do not create a second competing playtest app. |
| Player-mimicking bot | `src/v3/sim/mimic.ts` and map tuning tools | Useful for repeatability; model limitations must be disclosed (bots can see in darkness and react better than humans). |
| Map balance tools | `tools/v3/maps-plan/`, `v3:sweep` | Extend comparative analysis instead of replacing the campaign calibration tool. |
| Log storage | `src/v3/platform/playlogStore.ts` and existing log upload path | Attach telemetry to the existing run identity. Respect existing storage/access rules and size limits. |
| UI | `src/v3/ui/app.ts`, `render.ts`, `features.ts` | Landscape phone is the design target. Developer analytics should be inspectable on desktop without cluttering normal play. |

**Important scope note:** New V3 enemies and combo/special-event playtests were recently developed. Use the **actual** V3 catalog and Test Lab setup for availability gates, rather than hard-coding the older V2 threat list into authored encounters.

## 3. Workstreams and architecture

There are three linked workstreams, built in this order:

**A. Evidence:** Event instrumentation → versioned spatial telemetry → map heatmaps and replay.
**B. Convoy design:** Controlled mode experiments → tactical command prototypes → choice of final control scheme.
**C. Content:** Three reference maps → map-specific encounters and ten-wave arcs → documented expansion criteria for other maps.

Keep **authored scenario data**, **runtime simulation**, **observation/telemetry** and **UI visualization** separate:

- The simulator owns game truth and remains deterministic.
- The recorder captures inputs necessary to reproduce a run; a derived telemetry stream captures what actually occurred.
- Analytics aggregate many runs without feeding information back into the live sim.
- The viewer renders from map geometry + event samples; it must not reinterpret game rules.
- A scenario preset pins enemy composition and delivery, convoy mode, map revision, weapon/Armory setup and seed, so comparisons are reproducible.
- Observability should be additive and disabled/cheap when not requested; it must never consume the combat RNG streams or alter timing, targeting or results.

### Proposed file placement (illustrative, not a mandatory API)

Prefer V3-specific modules such as `src/v3/sim/telemetry.ts`, `src/v3/data/encounters.ts`, `src/v3/data/convoyCommands.ts`, `src/v3/ui/mapLab.ts`, `tools/v3/map-lab/`, and `tests/v3/mapLab.test.ts`; adapt to the repo's actual conventions. Do not add dependencies or duplicate the existing Test Lab unnecessarily.

## 4. Event telemetry specification

### 4.1 Shared context for every run

Record a **header** once, then a timestamped event stream:

- `runId` / `playlogId`; unique run and run segment IDs.
- `game: v3`, `logVersion`, `telemetrySchemaVersion`, build/commit or content hash, authored encounter revision.
- Map ID and **map geometry revision/hash**; coordinate frame `1600×900`.
- Seed and RNG/replay identity, persona or human, speed/tempo, input method and relevant mobile viewport orientation (without personal identifiers).
- Mode: campaign, free play, Test Lab, map-lab experiment, watch bot, or replay.
- Armory slots/levels, in-run weapons and card levels at each phase, relevant hull and supply settings, scenario preset ID, initial wave and any lab-specific overrides.
- Convoy control policy and command rules revision.
- Normal wave versus `bonusEvent` versus `mapEvent`; for the ending distinguish runs 1/2/3 (do not label everything wave 11).
- Actual available/eligible cargo ships, VIP presence, release targets, scoring rules and loss limits. A result is uninterpretable without these denominators.

### 4.2 Events to capture

Capture **causal point-in-time events** at the simulation truth source. Every event must include `tSim`, step, wave/phase, world `x,y` when applicable, entity/source/target IDs and reason. Keep launch origin separate from impact location.

| Family | Minimum event fields | Why |
| --- | --- | --- |
| Enemy spawn/launch | enemy kind, unique enemy ID, original launcher/raider ID, origin coordinate and class (silo/truck/sub/air/structure/event), intended target, encounter/raid ID, warning time | Launch density and launch-to-damage tracing. |
| Warning/telegraph | warning type, location/coverage, first visible time, associated threat IDs | Actual human reaction window and fairness. |
| Threat movement/keyframes | ID, sampled coordinate, velocity/phase, target changes; split/child links | Trajectory/coverage maps without full-frame logs. |
| Player input and fire | input coordinate, tap/press/gesture, command, weapon loaded, ammo before/after, selected target, miss/no-op reason | Input burden, missed taps, targeting and command timing. |
| Threat hurt/kill | ID/kind, damage amount, source weapon/helper, kill coordinate, precursor shots, parent-child attribution | Interception and weapon-effectiveness maps. |
| Cargo or structure hit | victim kind/ID, impact coordinate, attacking entity ID, actual HP removed, splash/secondary damage, killed/sunk flag, hull position at impact | **Actual damage** density, not merely number of projectiles arriving. Avoid double-counting splash. |
| Pickup lifecycle | pickup ID/type/weapon, drop source and spawn coordinate/time, collected coordinate/time and by what input, expiration, inventory/cap consequences | Drops versus reachable/collected/wasted pickups. |
| Cargo lifecycle | release scheduled/actual, entering map, lane/path choice, position keyframes, formation/posture changes, queue/lock/staging state, delivery, sinking, cumulative exposed time | Risk per ship-minute and bottleneck analysis. |
| Convoy command | requested, accepted/rejected, reason, affected ships, start/end, cooldown or resource change, resulting queue/backlog state | Command utility and control misuse. |
| Encounter and environment | raid/beat start/end, wave/event phase, gates, tide, fork, radar/battery/rig state, night/visibility state | Map mechanics and causal context. |

**Attribution rules:** One enemy has one stable ID from spawn through death; children reference parents. Each hit records actual post-mitigation HP loss and source, not nominal warhead damage. Affected ships on splash get separate victim events connected to one shared impact ID. Non-damaging decoys and misses remain countable. Record pickups even if never collected. The telemetry schema must have migration/version handling; older playlogs without telemetry remain replayable.

### 4.3 Sampling, storage and correctness

- Emit all discrete events. Sample ship positions at a tunable low frequency (candidate 4–5 Hz while active; less during empty periods), threats at a lower rate or on meaningful transitions; do **not** write 60 FPS positions for everything. Measure actual CPU/storage cost on iPhone-class hardware before choosing final rates.
- Preserve entry/exit times, position interpolants and event exact times so exposure estimates remain credible at sampling boundaries.
- Store spatial coordinates in world units with map/lane IDs, not CSS pixels. Screen coordinates are for optional UI diagnostics only.
- Write an optional **sidecar telemetry artifact keyed to the playlog**, so current compact input logs and their version/migration path are not broken for basic replay. If command inputs change, evolve the playlog version deliberately and test old fixture playback.
- Keep a bounded local ring buffer and a size budget. Decide actual compression/binary encoding only after profiling; JSON/NDJSON is acceptable for a small first slice. Never block play or introduce randomness during write/upload.
- Reuse private test-log storage controls. Instrument Test Lab/dev runs first; decide separately whether shipping builds collect aggregated/opt-in analytics. Do not upload personal content, notes or unnecessary device identifiers with the telemetry.
- Assert **observational equivalence**: same seed and inputs with telemetry on/off produce identical frame-state hashes, final losses, score, drops, card choices and replay results.

## 5. Map analytics viewer and heatmaps

Build on the V3 Test Lab as a **Map Analytics** tab or linked panel. Do not add a huge HUD overlay to normal play.

### 5.1 Required heatmap layers

1. **Launch origins** — number of spawned attacks, grouped by enemy kind/platform/encounter. Distinguish where the platform surfaced from where the projectile was launched.
2. **Actual damage impacts** — HP actually removed from cargo, carrier, VIP and allied structures; toggle raw hits / HP damage / sinks. Keep attacker origin traceable.
3. **Pickup spawn / collected / expired** — three separate views; collection rate and time-to-collect. Do not conflate valuable drops with accessible rewards.
4. **Player targeting and interceptions** — tap and shot locations; kills and missed attempts; optional weapon/helper filter.
5. **Cargo traffic and exposure** — ship-seconds by cell, trajectories, bottlenecks, queue time, sinking locations and delivered passages.
6. **Commands and map mechanics** — annotated Hold/Rush/Disperse/Route changes, locks/forks/tides/post outages and the state at impact.

Optional later: warning visibility, shots by weapon, threats active over time, launcher effectiveness, terrain occlusion and trajectory ribbons. Treat these as separate layers/filters, not one noisy color overlay.

### 5.2 Filters and drill-down

Support: one run or multi-run aggregate; map; wave 1–10; bonus event; map event run 1/2/3; enemy kind; launcher; weapon; ship type; lane/route; convoy policy; formation/command; seed; time window; normal play versus Test Lab; player persona; Armory/loadout; content revision.

Useful default interactions:

- **Timeline scrubber** with a selectable time window (e.g. the ten seconds around a large barrage).
- Tap a hotspot to show counts, exposure denominator and a shortlist of contributing events/run IDs, then open replay just before the event.
- Compare **before vs. after** at the same map/seed/configuration, with differences and sample counts. Side-by-side or diff overlay is acceptable; don't stack unreadable layers.
- Overlay real map land/lane/bases and show the location of the carrier. Respect curved, opposing and forked routes.
- Allow one primary layer plus optional trajectories/commands, not all layers on by default.
- Developer desktop is the primary analysis view; landscape phone must have a legible summary/drill-down and must not require hover or tiny hit targets.

### 5.3 Normalization and truthful interpretation

A bright heatmap is not automatically a bad area. Show both **raw** and **normalized** values.

- **Damage density:** sum of actual HP lost by world cell.
- **Exposure-normalized risk:** HP lost / cargo ship-minutes physically present in that cell; mask or flag cells with too little exposure instead of reporting extreme ratios.
- **Launcher efficiency:** damage attributed to launches from location / eligible launches (and by enemy type), avoiding unearned credit for splash children.
- **Pickup collection:** collected pickups / pickups spawned in selected cell and window; count pickups expiring unused.
- **Command utilization:** accepted commands / opportunities, canceled/rejected commands, time active, and the timing relative to warnings and impacts.
- **Traffic:** ship-seconds spent in the lane/region and number of ships entering, not just stationary points.

Use a configurable common world grid (suggested first pass **32 × 18 cells = 50 × 50 world units**, with optionally smoothed rendering). Ensure cell clipping over land and edge normalization; normalize color scales consistently when comparing two runs. Annotate sample count and confidence/variation. A time filter must correctly split occupancy samples at window boundaries. Compare equal denominators: normal wave versus event, flow/formation mode, eligible releases and Armory strength.

### 5.4 Designer questions the viewer must answer

- Where do effective damaging attacks *originate*, not just where do missiles explode?
- Which ships are lost in the Harbor funnel, and how much time do they spend there?
- Is a pickup dropped too far from the player's likely tapping area or during an impossible reaction window?
- Did a command help because of reduced damage **at equal exposure/throughput**, or only because it kept ships off the map?
- Does the same scripted enemy combo create a different tactical problem in the Strait vs. Gauntlet vs. Harbor?
- Are a few enemy spawn points responsible for most losses?
- Which warning-to-impact windows are too short for a human but trivial for a bot?
- Do late waves get more demanding through overlaps and placement, or only more entities?

## 6. Convoy control redesign hypotheses

**Do not choose the permanent system before testing.** Current design hypothesis: **automatic movement + occasional map-specific tactical commands** will be stronger than five flow steps plus four formations on every map. Preserve full controls as a test mode until evaluated.

### 6.1 Four experimental policies

| Policy | Release schedule | Player control | Purpose |
| --- | --- | --- | --- |
| A: Automatic baseline | Map-authored, fixed | No formation/flow command (existing required route logic handled deterministically) | Measures level without convoy management. |
| B: Formation-only | Same map-authored schedule | Existing four formations where geometry permits | Isolates value of formation choice. |
| C: Current V3 controls | Current five flow steps and four formations | Full controls | Status quo reference; don't artificially equalize away what it does in the second, naturalistic trial. |
| D: Tactical command prototype | Map-authored default | One primary map command and at most one contextual secondary command | Tests low-frequency, high-consequence intervention. |

For the **first controlled comparison**, give policies identical eligible ship count, scheduled release opportunities, enemy content, seeds, Armory, starting weapons/cards and objective. Where Hold delays a ship, track it as pending and include delivery/backlog in the outcome; don't simply remove it from the risk pool. For a **second real-economy comparison**, run each policy under its natural scoring, spawn timing and pacing rules. Report both; do not use scores from mismatched reward formulas as primary balance evidence.

Run both **defended** (bot/human) and **undefended / scripted-defense** controls where useful to isolate geometry. Counterfactual replay (remove one command, keep all possible player inputs) is supportive evidence only: altered ship positions change targeting, RNG branch consumption and later opportunities. It is not a perfect causal claim.

### 6.2 A command design contract

Every candidate command must define, in map data or a stable command catalog:

- **Name/intent:** the single decision the player understands (e.g. Rush, Disperse, Hold, Release, Route).
- **Availability:** eligible maps, lanes, ship types and phase; auto/default behavior otherwise.
- **Affected entities:** active ships, future launches, one staging queue or one route. The player must never wonder which ships are affected.
- **Activation:** one deliberate tap with obvious accepted/rejected feedback; no aim conflict with missiles or pickups.
- **Duration/termination:** finite or explicitly toggled, visible on the HUD.
- **Cost/tradeoff:** a real and communicated downside; no permanently optimal spammable command.
- **Cooldown/limits:** timing, max queue, maximum hold time and forced/automatic release behavior.
- **Geometry safety:** no land crossing, ship overlap, teleport, invalid lock/tide/fork or lost VIP.
- **Enemy interaction:** targeting/aim leads/reaction windows stay correct after ship trajectory changes.
- **Telemetry:** command intent, success, affected IDs, state transitions and reason for rejected action.
- **Replay:** deterministic command input plus log-version migration as necessary.
- **Touch UX:** landscape-safe target at least approximately 44 CSS px, legible countdown and clear neutral state.
- **Testing:** positive, negative and abuse cases across map geometry and event phases.

**Initial tuning values are experiments, not promises.** A prototype could try Rush for ~6 s at ~1.25× with a comparable vulnerability/cooldown cost, and Hold for at most ~6 s, but do not hard-code these as final until recorded outcomes support them.

### 6.3 Map-family command proposals

| Map family / examples | Default movement | Primary command | Possible secondary / special rule | Tactical dilemma |
| --- | --- | --- | --- | --- |
| Open water: Strait, Gauntlet | Fixed pairs or safe map-authored formation | **Rush** temporarily accelerate exposed ships | **Disperse** temporarily open spacing where the channel has room | Fewer seconds under fire vs. clustered/splash exposure. |
| Chokes: Harbor Mouth, Needle, Island approaches | Map-managed pace and legal formation/merge | **Hold / Release next convoy group** in a valid off-lane staging zone | An emergency Rush only where path/gates safely allow | Wait for a barrage to pass vs. miss delivery timing/build a queue. |
| Locks/canals: Saltgate | Existing lock/queue scheduling | **Release/Commit next group** when a chamber allows it | No instant gate override; obey lock physics and safe queue limits | Choose when to expose ships to a known stop. |
| Forks: Sharra Delta | Default route set by map | **Choose next route** | Readable threat/exposure preview if feasible | Short route/fast transit vs. enemy launch geometry. |
| Tide/two-way: Tidewater, Dunmar | Existing tide/traffic rules | **Commit group / lane** if meaningfully available | No forced movement through closed tide or opposing ships | Risk a vulnerable crossing vs. delaying the release. |
| VIP: Behemoth | Tanker on its defined lane | **Escort posture** or protected-group Rush (hypothesis) | Don't force tanker into impossible speed/position | Protect high-value slow target without ignoring ordinary hulls. |
| Boss/night/event maps | Current map physics | Prefer **no extra command** unless clear proven benefit | Existing boss, night or event mechanic can be the primary decision | Avoid stacking mechanics merely to fill a command slot. |

These are **candidate commands** to test, not an instruction to implement all of them. The final command catalog can be smaller. A map should have **zero** new commands when its environment and combat already create enough decisions. Existing mandatory route/fork interactions must keep working during experiments.

### 6.4 Anti-exploit rules for holding and slowing ships

- **Hold affects future ships at a physically valid staging point**, not by freezing exposed hulls mid-ocean. Existing ships continue and remain targetable.
- A max delay, queue capacity, pending-throughput obligation or other visible constraint prevents waiting out all threats. If a ship's release is deferred, it is *not* counted as delivered.
- Track scheduled, released, afloat, sunk, delivered and overdue hulls separately. Ensure the win condition cannot be achieved by keeping ships off-screen.
- Map events and the three-run ending must have defined release/reset behavior; no accidental free delay carryover that bypasses special-event pressure.
- Pending ships, time to clear, delivery quota and scoring must be reported as well as HP damage. **Low damage by starvation is not a successful strategy.**
- Rush and Disperse must have costs tied to real combat behavior/geometry; an unconditional permanent speed advantage or permanent splash immunity is not a choice.
- Ship AI, ballistics leading a moving target, supersonics, torpedoes, aircraft, VIPs, allied batteries, fork switch, lock queues, tidal lanes and two-way traffic must remain valid under any new command.
- Existing weapon drops and pickups should not be silently decreased/increased by a convoy policy; normalize experimental metrics per available threats/kills as well as per elapsed time.

## 7. Authoring encounters and redesigning maps

### 7.1 A two-layer wave authoring model

Keep the existing shared V3 `WAVE_TABLE` as a **baseline** during the initial lab. Add a **versioned, optional authored encounter layer** that defines *timing, composition, synchronized launch points and tactical intent*. The simulator resolves authored beats plus the existing background pressure without double-counting budgets.

Each encounter concept should specify:

- ID, revision, intended map(s), normal wave or event phase, and short player-facing premise.
- Permitted enemy kinds and chapter/wave introduction gates; **never silently introduce a late-chapter foe into an early map**.
- Launcher/platform and valid spawn zone; positions are validated against land/lane/route geometry.
- Counts/grouping/spacing/timestamps or relative triggers (such as a ship reaching the harbor funnel), plus warning/telegraph requirements.
- Target policy, overlap windows, duration, cooldown or contingency, and what is replaced from normal wave pressure.
- Expected player decision, likely counters, weapon pickup implications and criteria that show the encounter succeeded.
- Seeded randomness bounds and a deterministic replay/config hash.

An encounter is a **decision puzzle**, not simply a list of extra enemies. A dangerous synchronized attack must be readable, give a plausible response, and create an observable alternative to blindly firing at everything.

**Pacing template** (a guideline, not a rigid formula): waves **1–3 Teach**, **4–6 Combine**, **7–9 Escalate**, **10 Climax**, followed by the map's **existing special-event finale** (currently ending runs 11–13). Bonus events such as Siren Field remain explicitly separate. Include deliberate relative calm when it improves contrast; screen occupancy and simultaneous obligations matter more than raw threat count.

### 7.2 Three reference maps first

**1. The Strait — baseline/legibility**

- Thesis: teach where threats come from, how to intercept, and how a simple Rush or Disperse tradeoff works, without forcing constant command use.
- Distinctive encounter: clear single-shore warning → drones sheltering a missile → a later multi-threat push with enough reaction time.
- Measure: perceived control burden, warning-to-first-action, missed taps, damage vs. exposure, command usage. A new player should learn the baseline without reading a rulebook.
- Guardrail: don't require knowing a special convoy command to clear the first map.

**2. The Gauntlet — split attention**

- Thesis: two hostile shores and mid-channel carrier create competing priority targets.
- Distinctive encounter: staggered north/south launches → overlapping raids that pull aim across the screen → coordinated crossfire climax.
- Test same enemy counts in different synchronized geometries and compare whether the map genuinely changes behavior.
- Measure: threat concurrency, cross-screen travel/aim effort, damage by shore origin, time to first action, command use, delivered hulls.
- Guardrail: enemy combinations should not overwhelm touch input without adequate warnings.

**3. Harbor Mouth — exposure timing**

- Thesis: the narrowing channel makes the final stretch disproportionately vulnerable; player decisions concern when to commit ships and which threats to intercept.
- Distinctive encounter: early safe passage → warned threat as ships approach funnel → late barrage timed to vulnerable crossing → final attack just before delivery.
- Prototype Hold/Release in a real legal staging zone. Verify that withholding ships does not evade required combat/throughput or permanently deadlock the funnel.
- Measure: damage per ship-minute in the funnel vs. upstream, backlog, delivery time, attempts, hold timing, losses avoided/created, pickup accessibility.
- Guardrail: map 5's current `threatScale` is low because the geometry/heavies already make it difficult; do not blindly scale counts upward.

### 7.3 Expand to 20 maps only after gate

For each later map, create a **one-page design card**: (1) one-sentence tactical dilemma, (2) defining environment mechanic, (3) default convoy behavior, (4) zero to two proposed commands, (5) 2–3 signature encounter patterns, (6) wave 1–10 teaching/escalation, (7) map event and bonus-event compatibility, (8) telemetry expectations, (9) human readability risks, (10) bot/human acceptance. Do not add a control solely because a map family has one on another map.

## 8. Comparative test plan and decision rules

### 8.1 Controlled experiments

1. **Freeze a baseline:** same V3 content commit, map geometry hash, Armory/loadout, card/draft progression, enemy scenario, seed, and shipping obligation.
2. Run A–D (automatic, formation-only, current, tactical command) on **all three** reference maps.
3. First compare with fixed eligible releases and equal nominal threat payloads; then compare natural scoring/flow policies separately.
4. Run multiple seeds at several skill levels (sharp/average/casual/player-mimic) and different chapter-appropriate Armory states. Suggested initial smoke: ~10–20 seeds × modes × maps; increase until observed differences are stable enough to inform decisions.
5. Test real human play, including at least several blind mobile runs per prototype with the same briefing; collect subjective frustration/clarity, not just bot results.
6. Test normal waves 1–10 **and** map event runs 11–13; test bonus-event activation and on/off criteria separately.
7. Compare per-map and aggregated outcomes, report confidence/ranges and avoid claims from tiny samples or mismatched builds.

Primary outcomes: **ships delivered, actual HP lost, sinking rate, overdue/backlogged ships, player workload and ability to explain outcomes**. Secondary outcomes: score, ammo, kills, use of weapons/pickups, time per run, win rate, map-event grades and player preference.

### 8.2 Control value: useful but not overclaiming

For a command taken in a real run, perform a *controlled alternate replay* from the same pre-command state that omits/replaces that command. Replay the same subsequent inputs where possible and classify divergence (new targets, missed future pickups, changed RNG usage, changed enemy contact). Report results as **counterfactual estimates**, never as exact causal truth. Repeated randomized A–D comparisons and human observations remain the stronger evidence.

Suggested diagnostic categories:

- **Helpful:** the command improves survival or throughput under comparable obligations.
- **Neutral:** accepted, but no observable decision effect.
- **Harmful:** makes position/exposure or backlog worse.
- **Unusable/unreadable:** players miss the command, can't tell who it affects, or use it too late.
- **Exploit:** improves apparent survival by hiding/deferring required ships or bypassing event pressure.

### 8.3 Decision gate for the eventual shipping controls

Default recommendation **D** only if testing supports all of:

- Less friction and combat interruption than C, and no hidden unbounded advantage over A.
- A clear positive skill-dependent outcome in at least two different map families.
- Players can predict the consequence from the command label/telegraph and recognize when it helped.
- It is fair under cargo throughput, score, wave completion and three-run events.
- It is readable and easy to use in actual landscape phone testing.

Otherwise choose **A** for maps where a command doesn't help or selectively **B** if formation selection is genuinely valued. C stays as legacy/dev control while the decision is tested; do not preserve it merely from sunk-cost bias.

## 9. User experience / developer workflow

**Test Lab hub → Map Analytics / Convoy Experiments:**

1. Select **map** and scenario: existing map card, combo card, special event or new authored encounter.
2. Select **run configuration**: seed, normal wave/event phase, Armory/weapons, skill/persona, convoy policy, release obligation.
3. Launch **Quick** test or full run using existing Test Lab conventions; allow immediate retry on same seed with a changed policy or encounter revision.
4. **Results** show performance and a layered map: Launches · Damage · Pickups · Interceptions · Convoy traffic · Commands.
5. Scrub to a hotspot, tap to open its source events, replay **before/after** in the existing player.
6. **Compare A/B** with summary table and spatial diff. Save result against scenario version; retain notes and verdicts from the Test Lab's current versioning model.
7. Return to authored encounter/mapping data; repeat. Export a portable analysis summary plus run references for the coding/design session.

Visualization acceptance:

- At landscape phone widths tested by the current E2E suite, no combat area is hidden by analytics during actual play. Lab controls are dev/test-only, responsive and usable by touch.
- Accessibility: labels and numeric legends, not color alone; accessible contrast; explicit zero/no data states; clear normalization units; legends shared when side-by-side.
- Event positioning matches on-map entities; base/spawn/damage markers must land on valid coordinates, including curved/opposite-direction lanes.
- Performance and storage stay within a measured budget; tools should gracefully handle empty waves and large runs.
- No hidden data dependencies on a Claude artifact review page. Existing page/feedback integration can link out, but the repository/Test Lab must remain the source of truth.

## 10. Implementation slices and acceptance gates (for later coding sessions)

### Slice 0 — Baseline and audit (docs + measurement only)

- Confirm the current V3 log version, live Test Lab card/round versions, current ending mode, command handlers, wave scheduler and existing telemetry fields before changing interfaces.
- Capture a baseline fixture for Strait, Gauntlet and Harbor: fixed seeds; normal waves, a map event and one bonus event if eligible.
- Document current event attribution gaps and baseline performance on desktop and iPhone-size viewport.
- **Gate:** existing V3 tests/build/replay pass; recorded baseline configurations are reproducible. No combat changes.

### Slice 1 — Observability

- Add minimal versioned telemetry header and discrete event capture for launches, damage, pickups, targeting/kills, ship lifecycle and current flow/formation inputs.
- Establish stable entity/impact/parent IDs, coordinate validity and source attribution.
- Add bounded sampling only where required for exposure and movement; verify actual memory/performance.
- Record an optional playlog-linked sidecar and preserve older logs.
- **Gate:** telemetry enabled/disabled has identical deterministic gameplay/replay results. Attributed damage reconciles to hull/carrier HP deltas and sinks; pickup lifecycle counts reconcile to spawns/collections/expirations.

### Slice 2 — Map heatmaps and replay

- Implement the six layers, filters, temporal scrub, normalizations, drill-down to source event and before/after comparison.
- Integrate into existing Test Lab/developer workflow and tie measurements to lab card/version.
- **Gate:** visual checks on all three reference maps and a curved/forked test map; markers match real replay positions. The viewer can explain a known scripted loss from launcher through impact. Aggregation, zero denominators, low-exposure cells and event phase windows have tests.

### Slice 3 — Convoy mode test harness

- Implement A/B/C/D **as experimental policies**, with compatible seeds, shipping obligations, progression, Armory and scoring controls; no campaign rollout.
- Add deterministic command logging and analytics, initially reusing current formation controls where appropriate.
- **Gate:** repeated trials on the same seed are identical, no commands violate lane/terrain/lock/fork/queue constraints, and every comparison labels its denominators.

### Slice 4 — Tactical command prototypes and UX

- Prototype Rush/Disperse for open water, Hold/Release for a staging choke, and existing Route behavior for Delta (as a compatibility test). Start with Strait/Gauntlet/Harbor; do **not** roll out across 20 maps.
- Add explicit costs/limits, acceptance feedback, cooldown/expiry and input priority rules.
- **Gate:** no infinite waiting, invulnerable convoy starvation, score farming, queue deadlock, carrier/vip collision, or map/event exploit. Human phone playtests show commands do not repeatedly steal combat taps.

### Slice 5 — Reference map encounters

- Add 2–3 versioned signature encounters each to Strait/Gauntlet/Harbor using existing enemy catalog and clear warning contracts.
- Build a coherent ten-wave arc for each without overwriting the existing signature event or Siren Field bonus.
- Re-run heatmaps + A–D tests on the tuned versions, with multiple Armory stages; revise map-specific threats, not general weapon balance.
- **Gate:** each reference map presents a distinct decision with evidence: basic recognition, cross-screen prioritization, and vulnerable funnel timing. No worse human readability than baseline.

### Slice 6 — Rollout playbook (decision gate, not automatic implementation)

- Write one-page cards for each remaining map and prioritization by player risk / mechanics reuse.
- Approve a convoy policy per map (auto, formation-only or tactical); implement only well-supported commands.
- Maintain per-map diff logs, benchmark fixtures, and 20-map campaign progression checks.
- **Gate:** full campaign remains coherent and playable across Armory levels and event endings, with no unexplained replay, unlock, or score regressions.

### Testing methods required at *each* slice

- Unit tests for telemetry aggregation and command invariants.
- Deterministic headless replay/sweep tests including old fixtures and V3 event phases.
- Browser E2E with real pointer/touch interactions and screenshots at landscape phone sizes.
- Visual review of overlays, pickup locations, lanes, warnings and command status.
- Multi-seed simulation to catch stochastic outliers.
- At least one real human map playtest and written notes before deciding final controls; bots are not a substitute.
- Maintain a brief **build–test–inspect–correct–retest log** per slice. A passing CI build alone is not acceptance.

## 11. Risks and explicit mitigations

| Risk | Mitigation |
| --- | --- |
| Telemetry changes simulation behavior | Read-only hooks, no RNG calls, equivalence hashes with on/off. |
| Heatmaps are misleading | Raw + normalized views, common color scale, exposure masks, sample count, event-phase isolation. |
| Data is too large or slows mobile gameplay | Sidecar, bounded event capture, adaptive low-frequency samples, benchmark budgets. |
| Current controls make bot/human comparison invalid | Two experiments: controlled equal shipping obligation and naturalistic scoring; clearly separate. |
| Hold avoids danger by never launching ships | Required backlog/quota/time checks, forced expiry and no delivery credit for unreleased ships. |
| New commands conflict with aiming/tapping pickups | Dedicated accessible HUD control, pointer priority tests, explicit feedback, phone E2E. |
| Tactical commands become compulsory or always optimal | Teach before requiring, finite duration and real downside, test command-off baseline. |
| Map/encounter changes ruin V3 special events | Versioned authored overlay, keep bonus-event and three-run ending rules, event-specific regression fixtures. |
| Bots overestimate skill | Human trials and reaction-latency assumptions; darkness/stealth are separate test cases. |
| Armory masks difficulty | Test with progression-appropriate Armory states, not one maxed loadout. |
| Cross-map timing breaks curved/lock/tide traffic | Drive commands from path/lane model; validate staging and legal route timing. |
| Extensive redesign before evidence | Three reference maps only, gate decisions before the other 17. |

## 12. Explicit non-goals

- Do **not** implement this plan in this documentation-only commit.
- Do not redesign the 29+ weapon catalog or rework balanced enemy/special-event behaviors as part of telemetry.
- Do not rebuild all twenty maps at once.
- Do not delete existing full convoy control until comparative testing and owner approval.
- Do not replace the current Test Lab, replay, notes, card-versioning or private-log system with a parallel product.
- Do not add an adaptive enemy economy, pan/zoom battlefield or a full freehand map editor.
- Do not turn campaign-wide tracking on by default or collect personally identifying player information.
- Do not equate fewer losses with better design if fewer ships were released/delivered.
- Do not alter normal campaign scoring/unlock progression merely to make the lab's modes easier to compare.

## 13. Open decisions, provisional defaults and future owner review

These are **not blockers** for Slice 1 and should be resolved from experiments rather than guessed at design time:

1. **Final convoy scheme:** starting hypothesis is D, with some auto-only maps; keep A/B/C as controls until review.
2. **Actual command numbers:** durations/cooldowns/queue capacities require playtests. Prototype values are provisional.
3. **Score model:** evaluate whether flow-rate risk multipliers survive if normal shipping is fixed; separate from instrumentation.
4. **Encounter authoring UI:** start with reproducible data presets/test cards, not a complex drag-and-drop map editor.
5. **Shipping release obligation:** define a fair map/wave-aware quota and how each special-event run resets it before final rollout.
6. **Production analytics:** first use local dev/Test Lab data; any external collection is a separate consent/privacy/storage decision.
7. **Heatmap resolution and sampling rates:** profile the real game and adjust; the 32×18 grid and ~4–5 Hz ship sampling are starting experiments only.

## 14. Exact handoff for the next coding session

1. Read this plan and verify it against the latest V3 default branch and the existing Test Lab, events, log and map implementations.
2. **Start with Slice 0, then Slice 1.** Do not implement convoy command changes or alter map difficulty in the telemetry PR.
3. Provide a scoped task breakdown with files touched, compatibility issues and baseline fixture IDs.
4. Keep changes incremental; ship one working/validated slice at a time with a before/after replay comparison, screenshots and test logs.
5. After telemetry and viewer are credible, request or apply the next owner-approved slice to test control modes on three reference maps.
6. Preserve the distinction between **observed result**, **hypothesis**, **proposed implementation** and **accepted design decision** in the review notes.

**The product question that this phase must answer:** Is the player's best experience to directly micromanage cargo flow and formation, to have no convoy controls, or to issue a few meaningful tactical commands tailored to the map? **Instrument first, test the alternatives, then choose.**
