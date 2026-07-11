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

### 1. Transit (real time, a few minutes at 1×; 2×/3× available)

~20+ ships cross the map left-to-right. **One ship enters from the left every
~5 seconds**, round-robin across three lanes, so the strait stays an
uncluttered, readable stream of commercial traffic rather than a wall of hulls.

Ships navigate with a **steering-behavior model**: each integrates a smoothed
vector — head east and hold its lane (goal), keep clear water from neighbors
(separation), and turn or slow to avoid whatever is ahead (collision
avoidance) — through acceleration- and turn-rate-limited motion. The result is
that ships **ease around and wait for one another like real vessels**: a faster
ship commits to a clear side and overtakes a slower one; a ship with no room to
pass slows to match and queues; hulls never overlap or stack. Course changes
are smooth arcs, never sideways drift.

The player operates the convoy's **defenses**, not the cargo ships' steering:

| Action | Input | Cost/limit |
| --- | --- | --- |
| Launch interceptor at a missile | tap the missile | ammo pool + launcher reload |
| Command an escort (move) | tap the escort, then **tap** a destination | escort steams there, then resumes forward |
| Command an escort (station) | tap the escort, then **hold ~2s** on a spot | escort steams there and **holds position** |
| ECM burst (scrambles guided seekers) | HUD button | 2 charges/round, must own suite |
| Scan pulse (charts mines ahead) | HUD button | 2 charges/round, must own array |
| Pause / speed (1×/2×/3×) | HUD buttons | free |

The **only** vessel the player steers is the escort: tap it to select (blue
ring), then either **tap** the map to send it there (on arrival it resumes
cruising forward with the convoy) or **hold ~2 seconds** on a spot to order it to
**station** there and hold position (a green marker). Either order deselects the
escort once given. Cargo ships steer themselves. **Formation is chosen in the
prep screen and fixed for the transit** (it sets how much lateral room ships keep
and how far blasts/mines spread) — there is no formation or lane control
mid-transit. Ship modules (point defense, sonar, etc.) operate automatically, so
20+ ships stay manageable on a phone.

**Air defense** comes from two launcher types, both bought (and stackable):
- **Shore batteries** on the friendly shore — unlimited range, slow reload. The
  player's baseline defense (one to start).
- **Escorts** — limited range, fast reload, and directly steerable. Purchased,
  not free.

Both draw from a shared interceptor ammo pool; a tap prefers a ready in-range
escort and falls back to a ready battery.

**Both launcher types are attackable.** The enemy occasionally singles out an
escort or streaks a missile across to a shore battery, and escorts also steam
into mines. A hit knocks the launcher **offline for a few seconds** (a red
wind-down ring) — it cannot fire during the outage. Escorts additionally take
hull damage and can be **destroyed**, permanently removing that launcher from
the fleet; shore batteries are hardened installations that are disabled but not
destroyed. Stationing an escort forward is therefore a real risk/reward call:
more coverage where you place it, but it is exposed to fire and mines there.

Emergent drama: damaged ships slow down, fall behind their own expected pace
(or get blocked behind a slower ship ahead of them), and become preferred
targets for guided missiles. Tankers explode and damage neighbors — formation
choice (how much clear water ships keep) decides how badly.

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

Missile volume is a controlled **total count** that climbs with the round and
the enemy's saturation doctrine (capped for fairness). Crucially, that count is
**spread across the whole transit window** — from an opening delay until the last
ship is expected to have crossed — rather than clustered up front. So the enemy
keeps firing while ships are still in the strait and there is **no long silent
gap near the end of a round**. Launches still cluster into volleys, and a larger
convoy (which takes longer to cross) stretches the same doctrine over a longer
window.

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
