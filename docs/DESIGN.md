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
lengths from the one ahead of it in its lane, automatically, so ships never
overlap or stack regardless of how the formation, damage, or mine-dodging
moves them around. The player operates the convoy **as a system**, not
ship-by-ship:

| Action | Input | Cost/limit |
| --- | --- | --- |
| Launch interceptor at a missile | tap the missile | ammo pool + per-escort reload |
| ECM burst (scrambles guided seekers) | HUD button | 2 charges/round, must own suite |
| Scan pulse (charts mines ahead) | HUD button | 2 charges/round, must own array |
| Switch formation (Tight/Wide/Sprint) | HUD buttons | 4s of reduced cohesion |
| Change lane (north/center/south) | HUD buttons | lateral speed limit |
| Pause / 2× speed | HUD buttons | free |

Ship modules (point defense, sonar, etc.) operate automatically — active
gameplay lives in the convoy-wide layer, so 20+ ships stay manageable on a
phone.

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

**Fairness rules:** a new capability's first appearance is capped small (≤2
guided missiles, ≤4 mines, ≤3 low-sig mines); scripted floors guarantee the
designed early beats (guided by round 3, mines by round 5) regardless of play
style; warnings usually precede debuts; the first minefield is always laid in
the main shipping channel so the discovery beat lands.

## Designed opening

- **R1:** 4 slow unguided missiles, 12 free interceptors. Teaches tapping.
  Nearly everything survives.
- **R2:** More missiles, first spending decisions, capacity can grow.
- **R3:** Guided missiles debut (warned at R2). First research decision bites.
- **R4–5:** First minefield — likely one unexpected loss → forensic AAR card
  → mine-detection arms race begins.
- **Later:** volleys, mixed threats, low-sig mines if (and only if) the player
  countered standard mines.

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

## Out of scope for the MVP (planned expansion)

Attack boats, drones, torpedoes, electronic attack on the player's sensors,
decoy launchers, task-group templates, multiple maps/weather, meta-progression
between campaigns, art/audio, monetization. The threat system, module system,
and research tree are data-driven specifically so these can be added without
touching the sim architecture.
