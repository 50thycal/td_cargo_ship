# Straitwatch — Player Counter System (Category · Branch · Nodes · Tactics)

This is the **player's** side of the tech overhaul: the companion to
[`ENEMY_ATTACKS.md`](./ENEMY_ATTACKS.md) (the locked catalogue of what the
enemy fields) and [`SEESAW.md`](./SEESAW.md) (why and how much it fields it).
Every enemy threat in that catalogue gets an identifiable player answer here —
and, just as deliberately, **no player system quietly answers more than its own
threat domain.**

Implementation lives in:

| Layer | File |
| --- | --- |
| Tier → number tables (the ONLY numeric conversion site) | `src/data/statTiers.ts` |
| The counter catalogue (branches, nodes, tactics, compatibility, migration) | `src/data/counters.ts` |
| Central target validation + counter behavior in the sim | `src/sim/transit.ts` |
| Research/procurement rules | `src/sim/campaign.ts` |
| Boundary tests for everything below | `tests/counters.test.ts` |

---

## The model: Category → Branch → Nodes → Tactics

- **Category** groups related systems for organization (Missile Defense, Mine
  Warfare, …). Purely presentational.
- **Branch** is one specific counter family installed or purchased for one
  platform (escort interceptors, cargo hydrophone, shore counter-battery …). A
  branch declares **which enemy branch it counters**, its **role** (detect /
  attack / mitigate / disrupt), its **valid targets**, its **equipment** and
  its **ammunition**.
- **Node** improves the *physical capability*: speed, accuracy, reload, range,
  magazine, detection capability, or a new target variant it can handle. Nodes
  set **qualitative stat tiers**, never ad-hoc percentages.
- **Tactic** changes how the player *operates or understands* the system:
  manual targeting, automatic engagement, focus fire, target highlighting,
  predictive overlays, prioritization, coordinated fire. A tactic is normally
  **not** a disguised accuracy/damage/range/reload upgrade — those are nodes.
  Passive branches (reinforced hull, fire suppression, compartmentalization)
  have **no tactic track** on purpose.

### Hard rules (enforced in the deterministic sim, not the UI)

The compatibility matrix lives in `counters.ts → WEAPON_TARGETS/canEngage` and
`transit.ts` validates every command and every automation loop against it:

- Missile interceptors **cannot** attack torpedoes, mines, attack boats,
  artillery positions, smoke, or sensor jamming.
- Depth charges only attack **torpedoes** (an area blast at a tapped point —
  it does not even trigger mines).
- Deck guns only attack **attack boats**.
- Counter-battery only attacks/suppresses **artillery positions** (its threat
  target table is empty — it fires at installations, never at anything mobile
  or in flight).
- Mine-clearing drones only clear mines that have **first been detected**.
- Flak only attacks **enemy aircraft** (recon planes; ship-disabling drones
  require the proximity-fuse node). Never missiles.
- **Sensor jamming remains unshootable.** It is not a threat kind and appears
  in no target table. Hardened/backup systems mitigate it; nothing destroys it.
- Passive survivability reduces consequences but never replaces a threat's
  active counter.

---

## Global stat-tier system

Five named tiers — **Low, Medium, High, Extra, Max** — and one invariant:

> Two systems using the same tier within the same stat domain receive the same
> numerical value.

Domains are separate where systems are physically different ("High" cargo-ship
defensive radius ≠ "High" shore-battery range) and shared where the design
demands parity (every interceptor branch draws accuracy from one table).
Values are anchored to the pre-tier game so the established feel survives:
base interceptors fast but slow-loading, escorts nimble with quick reloads and
short reach, cargo self-defense extremely short-ranged and magazine-limited.

### Final tier → number mapping (`src/data/statTiers.ts` is authoritative)

| Domain | Low | Medium | High | Extra | Max | Anchor |
| --- | --- | --- | --- | --- | --- | --- |
| interceptorSpeed (u/s) | 70 | **92** | **150** | **225** | **255** | escort 92 / battery 150 / legacy research 225–255 |
| gunProjectileSpeed (u/s) | 140 | 200 | **260** | 330 | 400 | old PD tracer 260 |
| weaponAccuracy (hit prob.) | 0.55 | 0.70 | **0.82** | 0.90 | 0.96 | old interceptor 0.82 |
| reloadSeconds (speed-named: higher tier = faster) | **4.0** | **3.2** | **1.6** | 1.0 | 0.6 | battery 4.0 / escort 3.2 / dual-launch 1.6 |
| autoFireCooldownSeconds (**magnitude-named: Max = longest/worst**) | 2.5 | 4.5 | 7 | 9.5 | 12 | design doc: automation debuts at Max, improves toward Medium |
| visualProjectileSize (px) | 2 | **3** | **5** | 6.5 | 8 | escort 3 / battery 5 |
| mineDetectionRange (u) | **240** | 340 | **430** | 520 | 620 | old sonar 240 / legacy suite ≈432 |
| warningRange (u) | 260 | 420 | 700 | 1000 | 1400 | new |
| cargoModuleRange (u) | **95** | 140 | 190 | 240 | 300 | old PD radius 95 |
| underwaterDetectionRange (u) | 200 | 300 | 420 | 540 | 660 | new |
| imagingRange (u) | 220 | 330 | 470 | 600 | 720 | new |
| droneSpeed (u/s) | 70 | **95** | 140 | 180 | 220 | old drone 95 |
| droneLaunchRange (u) | **240** | 340 | 450 | 560 | 680 | old launch range 240 |
| depthChargeThrowRange (u) | 260 | 370 | 480 | 590 | 700 | new |
| blastRadius (u) | 45 | 70 | 105 | 140 | 175 | new |
| deckGunRange (u) | 300 | 420 | 560 | 700 | 840 | new |
| deckGunDamage (hp/round) | 8 | 12 | 18 | 24 | 30 | new (vs ~36 hp small-arms boat ⇒ ~3 medium rounds) |
| fireIntervalSeconds (rate-named: higher tier = faster) | 2.4 | 1.8 | 1.2 | 0.7 | 0.45 | new |
| suppressionSeconds | 6 | 10 | 16 | 22 | 30 | new |
| detectionAssist (+hit prob.) | **0.10** | 0.14 | 0.18 | 0.22 | 0.26 | old missile-warning +10% |
| hullReinforcement (+hp) | **50** | 80 | 115 | 150 | 190 | old module +50 |
| damageReduction (fraction) | 0.15 | **0.25** | 0.35 | 0.45 | 0.55 | old fleet-wide research 25% |
| trackPersistenceSeconds | 6 | 10 | 16 | 24 | 32 | new |
| jammingRecovery (fraction of blackout removed) | 0.25 | 0.40 | 0.55 | 0.70 | 0.85 | new |
| boardingSlow (timer multiplier) | 1.35 | 1.7 | 2.1 | 2.6 | 3.2 | new |

Related fixed physical numbers (not tiers): escort defensive range 780 u
(`COMBAT.interceptor.range`), guided-missile evasion penalty −0.16 accuracy
(`COMBAT.guided.accuracyPenalty` — an **enemy node property**, not a weapon
stat), depth-charge flight speed 150 u/s.

**Do not** treat "High" in one domain as related to "High" in another unless
they intentionally share the domain (the tests pin this: same tier + same
domain ⇒ same number across branches).

---

## Categories and branches

Notation: ⚑ = branch counters an enemy branch that is **designed but not yet
fielded by the enemy sim**. The player-side data, research, equipment, sim
validation and behavior are implemented and tested against injected threats;
they go live the moment the enemy pass lands. In code this is derived from the
enemy catalogue (`awaitingEnemyCapability`) rather than kept by hand, so the
research screen stops disclaiming a capability the moment that branch ships.

### Category: Missile Defense

#### Branch: Escort Missile Interceptors — escorts, built-in, attacks Missiles
Base node (granted): Medium speed/accuracy/reload/visual size, limited to the
escort's 780 u defensive envelope, one hit kills one missile.
**Nodes:** Precision Guidance (acc High) → Rapid-Reload Cells (reload High);
Advanced Seeker (acc Extra, needs Precision Guidance); High-Velocity Motor
(speed High, parallel).
**Tactics:** Manual Engagement (always available — tap a missile, nearest
ready escort in range fires) → Local Automatic Engagement (small auto radius
280 u, separate auto cooldown High tier, toggleable) → Expanded Automatic
Engagement (radius 460 u, **no** separate auto cooldown — launcher reload and
ammo still limit — and never double-fires at a missile already covered by a
kill shot).

#### Branch: Shore-Base Missile Interceptors — shore bases, built-in, attacks Missiles
Base node (granted): High speed/accuracy/visual size, Low reload, engages
missiles **anywhere on the map**.
**Nodes:** Extended-Burn Motor (speed Extra) → Maximum-Velocity Interceptor
(speed Max); Advanced Tracking (acc Extra, parallel); Improved Launch Cycle
(reload Medium, parallel).
**Tactics:** Manual (always) → Strategic Automatic Engagement (map-wide auto,
**Max** auto cooldown, toggleable) → Responsive Automatic Engagement (auto
cooldown **Medium**, prioritizes shortest time-to-impact, skips covered
threats).

#### Branch: Cargo-Ship Self-Defense Interceptor — cargo module, attacks Missiles
The evolved point-defense turret; the projectile stays a fast tracer, not a
missile. Automatic by default; one shot per equipped ship per round; each shot
draws a purchased self-defense round.
**Nodes:** Base (acc Medium, tracer speed High in the gun domain, range Low in
the short cargo-module domain) → Extended Envelope (range Medium) → Long-Range
Close-In Defense (range High); Improved Fire Control (acc High) → Precision
Terminal Tracking (acc Extra); Dual-Shot Magazine (two shots/round).
**Tactics:** Base Automatic Fire (granted, no separate effect) → Threat
Designator (marks the intended missile at ~2× firing range — warning only) →
Engagement Predictor (projected engagement line + loaded/empty/reloading
status; informational) → Coordinated Fire Control (reserves targets, never
doubles up when a likely kill is inbound, prioritizes missiles hunting the own
hull then lowest time-to-impact; requires Threat Designator).

#### Branch: Missile-Warning Receiver — cargo module, detects Missiles
Detection only; it does not shoot.
**Nodes:** Base (marks missiles hunting the equipped ship at Medium warning
range; Low interceptor-accuracy assist defending it) → Long-Range Warning
(range High); Precision Track Solution (assist High); Sea-Skimmer Warning
(earlier detection of the sea-skimming node — restores part of the stolen
reaction window; interface ready ⚑); Networked Warning (shares the track —
half assist for defenders of nearby unequipped ships).
**Tactics:** Target Vector (line from missile to its target) → Impact Urgency
(marker pulse speeds up as impact nears — readable, not a number) → Defense
Priority Tag (target-selection priority only; never accuracy).

### Category: Mine Warfare

#### Branch: Mine-Detection Sonar — cargo module, detects Mines
**Nodes:** Base (standard mines, Low range) → Improved Range (Medium) →
Long-Range (High); Composite-Signature Analysis (low-signature mines; needs
Improved Range); Drift Tracking (keeps a drifting mine's chart current ⚑).
**Tactics:** Passive Detection (granted) → Danger Envelope (shows trigger
areas) → Drift Vector (drift direction ⚑); Shared Sonar Picture (every hull
contributes a 120 u contact feed — a found mine stays found).

#### Branch: Escort Mine-Countermeasure Drones — escort module, attacks Mines
Detection and clearing stay separate: **a drone can never be launched at an
unrevealed mine** (sim-enforced). Each sortie consumes a purchased munition.
**Nodes:** Base (tap a revealed mine; launch range Low, drone speed Medium,
reload Low, one drone = one mine) → Extended Control Link (range Medium);
Fast-Response Drone (speed High); Improved Sortie Cycle (reload Medium);
Moving-Target Guidance (tracks a drifting mine after launch ⚑); Dual-Sortie
Rack (two ready launches per cycle).
**Tactics:** Manual Mine Selection (granted) → Risk Designator (flags mines on
convoy routes) → Local Automatic Clearance (auto launch in a 300 u zone, Max
auto cooldown, toggleable); Coordinated Mine Clearance (never two drones on
one mine; drifting/route-crossing mines first — requires Risk Designator).

#### Branch: Scan Pulse — convoy ability, detects Mines
**Nodes:** Base (granted; reveals standard mines along the swept lane; 2
charges/round) → Composite Scan Processing (low-signature reveal: 35% chance
untrained, 75% with this node, 100% when Composite-Signature Analysis is also
researched — sensor research informs it); Persistent Mine Track (contacts stay
charted through drift ⚑).
**Tactic paths (parallel, independent):** Additional Charge (2→3) · Expanded
Coverage (reveal radius 130→185, band scales) · Longer Track Persistence.
Static mines stay charted permanently once revealed (their position cannot go
stale); persistence governs moving contacts when drifting mines land.

### Category: Torpedo Warfare (enemy branch LIVE)

#### Branch: Hydrophone — cargo module, detects Torpedoes
**Nodes:** Base (standard + homing torpedo noise, Medium range, approximate
bearing) → Improved Localization → Low-Signature Processing (wakeless
torpedoes) / Precision Track (bearing → depth-charge-grade track); Long-Range
Hydrophone (range High, parallel).
**Tactics:** Bearing Cone (granted) → Projected Torpedo Path; Shared
Underwater Picture (clarity, explicitly no hidden accuracy bonus).

#### Branch: Escort Depth-Charge Launcher — escort module, attacks Torpedoes
A lobbed **area** weapon: the player taps a point in the water, never the
torpedo sprite; the nearest ready escort lobs a charge; the blast destroys
torpedoes inside it — and nothing else. Completely separate from missile
interceptors.
**Nodes:** Base (throw range Low, blast Medium, reload Low, one launch per
escort per round) → Extended Throw (range Medium); Expanded Pattern (blast
High); Improved Reload (Medium); Dual-Charge Rack (two launches/round);
Pattern Salvo (a short line of 3 charges — needs Expanded Pattern **and**
Dual-Charge Rack; deliberately never a map-wide torpedo deleter).
**Tactics:** Manual Area Placement (granted) · Nearest-Ready Launcher
(granted, built into fire control) → Lead Solution (predicted detonation
point; no blast/damage change) → Local Automatic Drop (auto drop when a
**detected** torpedo enters a 220 u emergency radius; separate High-tier auto
cooldown; toggleable) → Coordinated ASW (no overlapping patterns unless focus
is ordered).

#### Branch: Active Sonar Ping — convoy ability, detects Torpedoes
Placed ping revealing torpedoes in its area (standard + homing at base;
Low-Signature Return Processing for wakeless; Precision Track Persistence for
lingering tracks). **Tactic paths (parallel):** +1 charge · larger radius ·
longer track duration. Same placed interaction as Scan Pulse, but strictly the
underwater domain.

### Category: Anti-Surface Warfare (enemy branch LIVE)

#### Branch: Escort Deck Gun / Autocannon — escort module, attacks Attack Boats
Boats are persistent HP targets; the gun commits to a selected boat until it
sinks, leaves range, the escort is disabled, or the player re-tasks it.
**Nodes:** Base (range/acc/damage Medium, rate High) → Stabilized Mount (acc
High); Heavy Autocannon (damage High); Long-Range Fire Control (range High);
Rapid Feed (rate Extra); Armor-Piercing Ammunition (full damage vs rocket and
boarding variants, which otherwise take half — never a one-shot kill).
**Tactics:** Manual Target Designation (granted) → Automatic Nearest-Boat
Engagement (toggleable, manually overridable) · Focus Fire (one boat, many
guns) → Distributed Fire (no overkill: guns spread unless focus ordered) →
Layered Fire (near escorts take boats closing with the convoy, far escorts
take approachers — allocation only).

#### Branch: Anti-Boarding Countermeasures — cargo module, mitigates Boarding
Counters ONLY the boarding-capture mechanic — no help vs anything else.
**Nodes:** Base Security Detail (slows takeover, Low tier) → Reinforced Access
(High tier) → Citadel Lockdown (pauses progress); Counter-Boarding Team
(reverses progress under sustained deck-gun fire); Emergency Rejection (once
per round, cancels an almost-complete capture — buys time, kills nothing).
**Tactics:** Boarding Alarm (granted) · Automatic Threat Priority (attached
boarding boats top the deck-gun queue) · Escort Response Cue (informational).

### Category: Counter-Artillery (enemy branch LIVE)

#### Branch: Shore Counter-Battery System — base module, attacks Artillery positions
Fires at the **gun position** (an installation), never at shells in flight.
Deliberately not attached to the escort deck-gun branch.
**Nodes:** Base (tap an identified position; acc Medium, reload Low, a
successful strike suppresses for a Medium duration) → Extended-Range Fire
Control (can engage the Ranging node) → Barrage Disruption (a strike can
shorten a Rolling Barrage); Rapid Counter-Fire (reload High); Sustained
Suppression (duration High) → Coordinated Battery Strike (3 focused successful
strikes destroy the position for the round).
**Tactics:** Manual Position Selection (granted) → Automatic Return Fire (Max
auto cooldown) → Responsive Counter-Fire (Medium) · Focus Suppression ·
Priority Doctrine (rate-of-fire / barrage-prep / most-valuable-lane priority).

### Category: Smoke & Concealment

#### Branch: Thermal/Radar Imaging — cargo module, detects through Smoke
Sees threats through enemy smoke; removes and destroys nothing.
**Nodes:** Base (precise tracks inside Screening Smoke, Medium range) →
Long-Range Imaging (High); Blinding-Smoke Resistance (tracks inside
convoy-covering smoke); Track Persistence (brief post-contact track);
Networked Sensor Fusion.
**Tactics:** Precise In-Smoke Silhouette (granted) · Launch-Origin Trace ·
Protected Target Vector.

#### Branch: Player Smoke Screen — convoy ability, disrupts enemy Targeting
Directly undermines the shared Targeting Doctrine (finish-the-wounded,
high-value, isolation, deny-the-delivery): attacks against ships inside the
cloud use a one-tier-less-sophisticated preference — implemented as a 50%
reduction of the enemy's targeting-skill weighting inside the cloud (100% when
Dense). Track-Breaking Smoke adds a 4 s re-acquisition grace after a ship
exits (guided missiles are not permanently broken). Never a plain accuracy
debuff, never invulnerability.
**Tactic paths (parallel):** +1 charge · larger radius · longer duration.

### Category: Electronic Attack & Drones

#### Branch: Anti-Air Flak System — cargo module, attacks Recon Planes / Drones
Separate equipment and research from the self-defense interceptor — one module
never solves both missiles and aircraft. Shares only visual language.
**Nodes:** Base (auto-engages Recon Planes in a Low radius; acc Medium, reload
Low, one shot/round) → Improved Tracking (acc High); Proximity-Fuse Ammunition
(**enables** ship-disabling drones as targets); Expanded Arc (range Medium);
Rapid Cycling (reload High); Dual-Shot Magazine.
**Tactics:** Automatic Local Engagement (granted, base behavior) → Early
Air-Contact Designator (~2× range) · Threat Priority (recon / drone / lowest
time-to-objective) · Fire-Control Deconfliction (no piling onto a dying
aircraft).

#### Branch: Hardened & Backup Systems — convoy ability, mitigates Sensor Jamming
Jamming stays unshootable and cannot be prevented; this reduces its effect.
**Nodes:** Base Emergency Reboot (shortens the remaining blackout by the Low
recovery fraction; 1 charge/round) → Protected Detection Channel (pre-round
pick of ONE sensor family that stays alive through jamming: mine detection,
torpedo detection, missile warning, or smoke imaging); Rapid Systems Recovery
(High recovery); Dual-Channel Hardening (two families); Redundant Command
Network (readiness/target indicators never fully vanish; detection still
degraded).
**Tactics:** Jamming Status Display (granted — unmissable indicator +
countdown) · Pre-Round Channel Selection (granted with the node) · Emergency
Reboot Charge (granted) → Second Reboot Charge.

#### Branch: ECM Suite — convoy ability, disrupts guided Missiles
**The answer to guided seekers, and only that.** A jamming aircraft orbits a
placed point; guided seekers inside are scrambled (terminal hit chance 20%,
8% with Barrage Jamming) and a missile that lingers 3.2 s cooks off. It does
not affect mines, torpedoes, boats, artillery, smoke or jamming; unguided
missiles are degraded only by the loiter-kill, never invalidated; guided
sea-skimmers will still be affected but their short window stays meaningful
(the loiter requirement is the limiter).
**Nodes:** Base (granted, 2 charges) → Barrage Jamming (legacy `ew1`).
**Tactic paths (parallel):** +1 charge · larger orbit · longer station time.

### Category: Hull & Damage Control (sibling branches — deliberately not one chain)

- **Reinforced Hull** — cargo module; nodes Base(+50)/Medium(80)/High(115)/
  Extra(150) hp from the shared hull-strength domain. No tactics. Generic
  survivability; replaces no active counter.
- **Fire Suppression** — cargo module; nodes: Base (granted; fires burn half
  as long) → Automatic Suppression (near-instant extinguish) → Redundant Fire
  Zones (no immediate re-ignition) → Maximum Damage Control (missile-fire DoT
  prevented entirely). No tactics beyond clear fire-status UI.
- **Compartmentalization** — cargo module; nodes Low/Medium/High incoming-
  damage reduction (shared damageReduction domain), applied **after** a hit
  lands, never touching detection or interception. No tactics.

### Category: Logistics & Support

- **Logistics** — Expanded Berthing (legacy `logistics1`, intact: +5 capacity,
  half-price repairs).

---

## Platform & loadout structure

- **Cargo ships** keep class-wide module templates competing for the class's
  limited slots (2/2/1). Modules: self-defense interceptor, missile warning,
  mine sonar, hydrophone, thermal/radar imaging, flak, reinforced hull, fire
  suppression, compartmentalization, anti-boarding. **The limited slots are
  the point: no hull equips every counter.**
- **Escorts** carry built-in missile interceptors plus an **escort loadout
  template** with **2 slots** competing between: deck gun, MCM drone launcher,
  depth-charge launcher. No escort carries every weapon.
- **Shore bases** carry built-in missile interceptors plus a **1-slot base
  loadout**: counter-battery system (future strategic sensors join here).
- **Convoy-wide assets** (purchased, charges refresh each round): ECM, Scan
  Pulse, Active Sonar Ping, Defensive Smoke Screen, Hardened/Backup Systems.
  Each keeps three **independent** upgrade paths — more charges vs larger
  coverage vs longer duration/persistence — never one forced chain.

## Research vs procurement

- **Intel/research** unlocks and upgrades branches, nodes and tactics; a
  completed upgrade applies to **all currently equipped instances**.
- **Cash/procurement** buys the physical things: modules, escorts, batteries,
  ability assets, ammunition.
- **Buying equipment before its base node is researched is not permitted**
  (`MODULE_RESEARCH_REQUIREMENT` and friends; enforced in `campaign.ts`, with
  the reason shown on the card). Built-in systems (escort/base interceptors,
  scan, ECM, reinforced hull, fire suppression) begin with their base node
  granted, so the rule holds trivially for them.
- Researching a deck gun does not equip any escort; researching sonar occupies
  no cargo slot.

## Ammunition & per-round limits

| System | Limit |
| --- | --- |
| Escort/base interceptors | shared purchased interceptor pool |
| Cargo self-defense | purchased self-defense rounds + per-ship per-round magazine (1, Dual-Shot 2) |
| MCM drones | purchased drone munitions + launcher sortie cycle |
| Depth charges | per-escort per-round magazine (1, Dual-Rack 2) |
| Deck gun | none (sustained fire is its identity) |
| Flak | per-ship per-round magazine (1, Dual-Shot 2) |
| Abilities | charges per round (2, +1 via the charge path) |

---

## Counter-coverage matrix

| Enemy threat | Detection / information | Active counter | Mitigation |
| --- | --- | --- | --- |
| Unguided missiles | Missile warning | Base, escort, or cargo self-defense interceptor | Hull systems |
| Guided missiles | Missile warning | Interceptors and ECM | Hull systems |
| Sea-skimming missiles ⚑ | Sea-Skimmer Warning node | High/Extra-speed interceptors / close-in self-defense | Hull systems |
| Swarm / MIRV missiles ⚑ | Warning + target display | Multiple interceptors / Dual-Shot magazines / automation | Hull systems |
| Standard mines | Mine sonar or Scan Pulse | MCM drones (after detection) | Compartmentalization |
| Low-signature mines | Composite-Signature Analysis / Composite Scan | MCM drones | Compartmentalization |
| Drifting mines ⚑ | Drift Tracking | Moving-Target Guidance drones | Formation + hull systems |
| Standard torpedoes | Wake (enemy pass) or Hydrophone | Depth charges | Hull systems |
| Homing torpedoes | Hydrophone | Depth charges | Hull systems |
| Low-signature torpedoes | Low-Signature Processing or Active Sonar Return Processing | Depth charges | Hull systems |
| Small-arms boats | Visual contact | Escort deck guns | Hull systems |
| Rocket boats | Visual contact | Deck guns (+Armor-Piercing) | Hull + fire suppression |
| Boarding boats | Boarding alarm | Deck guns (+AP, +focus fire) | Anti-boarding countermeasures |
| Coastal artillery | Firing position (installation) | Counter-battery | Formation + hull systems |
| Ranging artillery | Fire-control detection | Extended-Range counter-battery | Formation + hull systems |
| Rolling barrage | Barrage warning | Barrage Disruption strikes | Formation + hull systems |
| Screening smoke | Thermal/radar imaging | *No destructive counter* | Sensor improvement |
| Blinding smoke | Blinding-Smoke Resistance | *No destructive counter* | Sensor networking |
| Recon plane | Air-contact cue | Flak | Hardened systems |
| Disabling drone | Air-contact cue | Flak + Proximity-Fuse | Redundancy |
| Sensor jamming | Jamming indicator | **No shootable counter (by design)** | Hardened/backup systems |
| Advanced targeting doctrine | Warning + target indicators | Defensive Smoke Screen | Formation/loadout choices |

Audit results of this matrix (the "review the completed design" pass):

- **Threats with no counter:** only sensor jamming (deliberate — the single
  no-counter node) and smoke (deliberately mitigate-only).
- **Counters that solve too many branches:** none — the compatibility tests
  pin each weapon to its domain. ECM is scoped to guided seekers; smoke is
  scoped to targeting doctrine, not damage.
- **Redundant systems:** interceptor branches overlap on missiles by design
  (three layers with different range/reload identities). Nothing else doubles.
- **Missing detection requirements:** none — every clearing/attack path that
  needs a sensor (drones, depth-charge automation) requires a revealed
  contact in the sim.

---

## Save migration (v2 → v3, `src/platform/save.ts`)

Deterministic and value-preserving; runs before the generic deep backfill:

| Legacy | Becomes |
| --- | --- |
| `pointDefense` module (and its paid price) | `selfDefense` module (base node granted) |
| `missileWarning` / `mineSonar` modules | same modules, base node granted |
| `fireSuppression` module (was full immunity) | module + Automatic Suppression node (near-instant extinguish) |
| `sensors1` | `missileWarning.base` + Target Vector |
| `sensors2` | `mineSonar.base` + Improved Range + Shared Picture (the old fleet-wide 120 u detection) |
| `sensors3` | Long-Range + Composite-Signature Analysis + Composite Scan |
| `intercept1` | Escort Precision Guidance + Base Extended-Burn |
| `intercept2` | Escort Rapid-Reload + Base Maximum-Velocity |
| `mines1` | `mcmDrones.base` + the escort drone launcher fitted free (it was implicit) |
| `resilience1` | Compartmentalization Low + Medium (the legacy 25%), module auto-fitted where a class slot is free |
| `resilience2` | Fire Suppression Automatic + Redundant Zones |
| `ew1` | ECM Barrage Jamming |
| `logistics1` | `logistics.expandedBerthing` (intact) |
| in-flight legacy project | its mapped nodes granted outright (already paid) |

New-format saves round-trip byte-identical. `tests/counters.test.ts` pins all
of this.

## Telemetry

`RoundTelemetry.counters` records per round: equipment by platform, active
nodes vs tactics, spend by counter branch, munitions bought/expended by
counter type, shots and kills per weapon family (base/escort interceptors,
self-defense, drones, depth charges, deck guns, counter-battery, flak),
detection events per sensor family, automatic vs manual engagements, duplicate
shots and duplicate-shots-avoided, damage prevented per mitigation branch,
boarding attempts/interruptions/captures, jamming seconds and mitigated
seconds, and ability charges available/used. The export
(`buildTelemetryExport`, format v2) adds campaign-wide counter totals and
`lossesByEnemyBranch` — every loss cause maps onto an enemy branch, with
`collateral` (secondary blasts) and `attrition` (lost at sea) as explicit
non-branch outcomes.

## Unresolved balance values (flagged for the tuning pass)

- Deck-gun damage tiers and boat HP (small-arms ≈36 hp assumed: 3 Medium
  rounds) await the enemy boat implementation.
- Flak one-hit-kill vs aircraft HP — the recon plane's "normal object HP" is
  an enemy-pass number.
- Self-defense accuracy rose from the legacy 0.5 to the shared Medium tier
  0.70 (magazine limits compensate; watch in playtests).
- Escort interceptor accuracy at Medium 0.70 vs the legacy flat 0.82 — escorts
  now genuinely need Precision Guidance to match batteries (migrated saves get
  it via `intercept1`).
- Suppression durations, depth-charge throw/blast, hydrophone ranges, smoke
  radius/duration, jamming-recovery fractions: first-pass numbers, no enemy
  pressure to tune against yet.
