# Straitwatch — Game Design (MVP)

## Premise

The player operates an international convoy-protection network escorting
civilian cargo ships through a contested strait ("the Narrows" — deliberately
fictionalized). The enemy on the hostile shore wants to sink the ships. Both
sides evolve: the enemy develops new weapons in response to the player's
defenses; the player researches counters. The core promise:

> You start more capable than the attacker, but every successful defense
> teaches the enemy how to challenge you.

## The round loop

```
Transit → After-Action Report → Intelligence & Research → Procurement → Transit …
```

### 1. Transit (real time, ~75–95s)

~20+ ships cross the map left-to-right. They are not a rigid military
formation — each ship streams into the corridor individually, staggered a
few seconds apart across three lanes, at its own pace with a touch of
personal variance, so the convoy reads as commercial traffic rather than a
fleet block. A following-distance rule keeps every ship at least ~two hull
lengths of clear water from the one ahead of it in its lane, automatically, so
ships never overlap or stack. Ships move along a heading and turn toward their
lane, so lane changes and passes are realistic constant-speed arcs, never a
sideways drift. A **faster ship overtakes a slower one** by sliding into clear
water beside it; when a lane is too crowded to pass, ships queue and the lane
**jams up** — the cost of overloading one lane. The player operates the convoy
**as a system**, not ship-by-ship:

| Action | Input | Cost/limit |
| --- | --- | --- |
| Launch interceptor at a missile | tap the missile | ammo pool + launcher reload |
| Select ships for lane control | tap a ship (tap more to add) | — |
| Move selected ships one lane | ▲/▼ Lane buttons | reassigns just the selected ships |
| ECM burst (scrambles guided seekers) | HUD button | 2 charges/round, must own suite |
| Scan pulse (charts mines ahead) | HUD button | 2 charges/round, must own array |
| Switch formation (Tight/Wide/Sprint) | HUD buttons | 4s of reduced cohesion |
| Pause / 2× speed | HUD buttons | free |

Lane assignment is **per-ship**: tapping a ship selects it (blue ring), and the
Lane buttons reassign only the selected ships — spreading load across lanes to
avoid jams is a live tactical decision. Ship modules (point defense, sonar,
etc.) operate automatically — active gameplay lives in the convoy-wide layer,
so 20+ ships stay manageable on a phone.

**Air defense** comes from two launcher types, both bought (and stackable):
- **Shore batteries** on the friendly shore — unlimited range, slow reload. The
  player's baseline defense (one to start).
- **Escorts** that steam with the pack — limited range, fast reload. Purchased,
  not free.

Both draw from a shared interceptor ammo pool; a tap prefers a ready in-range
escort and falls back to a ready battery.

Emergent drama: damaged ships slow down, fall behind their own expected pace
(or get blocked behind another slowed ship in their lane), and become
preferred targets for guided missiles. Tankers explode and damage neighbors —
formation choice (lateral spread and following-distance buffer, not a slot
grid) decides how badly.

### 2. After-Action Report

Deliveries, losses with **forensic cause narratives**, interception stats,
resources earned. This is where enemy evolution becomes visible:

- **Discovery cards** announce a new enemy capability the first time it is
  encountered ("Analysis indicates a composite mine casing our sonar cannot
  register"). They diagnose the problem and list several viable responses —
  never a single prescribed counter.
- **Intelligence forecasts** warn (with a confidence percentage) about
  capabilities the enemy is close to fielding, giving the player one or two
  rounds to prepare.

### 3. Intelligence & Research

One project at a time, paid in intel. Research completes **after the next
transit** — you must survive one more round without it. Branches: sensors,
interception, mine warfare, resilience, electronic warfare, logistics.

Intel is earned mostly from *contact with the enemy*: losses (+6 each),
interceptions (+1), first encounters with new tech (+12). A struggling player
earns more intel than a flawless one — the built-in anti-snowball.

### 4. Procurement

Cash (earned per cargo value delivered) buys:

- **Ship modules** per class (point defense, missile warning, reinforced hull,
  mine sonar, fire suppression) — limited slots per class.
- **Convoy-wide assets**: escorts (more interceptor launchers), ECM suite,
  scanning array, interceptor ammo.
- **Fleet**: replacement hulls, repairs (unrepaired damage carries into the
  next transit), convoy composition (which ships sail, up to capacity).

## The adaptive enemy

The enemy has hidden tech tracks: **saturation** (missile volume/volleys),
**guidance** (homing missiles), **mines**, **low-signature mines**. Each round
it earns tech points — more when the player performs well — and allocates them
by rules that respond to observed player behavior:

| Player behavior | Enemy response |
| --- | --- |
| High interception rate | invest in guidance + volume |
| Tight formations | invest in mines |
| High mine-detection rate | invest in low-signature mines |
| Rich convoys | attack harder (bonus points) |

Missile volume is **not capped** by a fixed per-round count. The enemy fires at
a rate (missiles/minute) that climbs with round and its saturation doctrine,
across a window sized to the convoy — so a larger convoy (which takes longer to
cross) draws sustained fire, and as long as ships are in the strait more
missiles keep coming. Launches still cluster into volleys.

**Fairness rules:** a new capability's first appearance is capped small (≤3
guided missiles, ≤4 mines, ≤3 low-sig mines); scripted floors guarantee the
designed early beats (guided by round 2, mines by round 3) regardless of play
style; warnings usually precede debuts; the first minefield is always laid in
the main shipping channel so the discovery beat lands.

## Designed opening

The ramp is deliberately steep early — round 1 is the only truly gentle round.

- **R1:** A light unguided probe (~6 missiles) against a single shore battery.
  Teaches tapping; nearly everything survives.
- **R2:** A real fight — missile volume roughly triples, guided missiles debut
  (warned at R1). First serious spending decisions; capacity can grow.
- **R3:** Mines debut in the main channel (first field small) → forensic AAR
  card → the mine-detection / formation arms race begins.
- **R4+:** Volume keeps climbing, guided share rises, mixed missile+mine
  rounds. Winnable with a balanced build (more batteries/escorts, ammo, mine
  research, wider formation); low-sig mines appear only if the player counters
  standard mines.

## Winning, losing, scaling

- **Score:** cargo value + rounds survived + interceptions.
- **Convoy capacity** (20 → 45 by +5): grows after two consecutive rounds with
  ≥85% delivery. Bigger convoys earn more and attract more attention. The
  player chooses how many ships to actually send.
- **Confidence** (0–100): rises with strong deliveries, falls with losses and
  missed quotas. Zero = campaign over.
- **Quota:** cargo points per 3-round window; the requirement ramps gently
  over time but does *not* scale with capacity (growth is opportunity, not
  obligation). One disastrous round can be recovered within the window.

## Game log (playtest telemetry)

Every round appends a rich record (deliveries, per-ship losses with cause,
missiles fired vs intercepted split by base/escort/point-defense, mines, ammo,
economy deltas, enemy tech tracks, research) to the campaign. A **Download game
log** button on the after-action and game-over screens exports the whole
session as JSON, so a playtester can hand the file back and every decision point
is visible. `buildTelemetryExport` (pure) assembles it; the UI turns it into a
file.

## Out of scope for the MVP (planned expansion)

Attack boats, drones, torpedoes, electronic attack on the player's sensors,
decoy launchers, task-group templates, multiple maps/weather, meta-progression
between campaigns, art/audio, monetization. The threat system, module system,
and research tree are data-driven specifically so these can be added without
touching the sim architecture.
