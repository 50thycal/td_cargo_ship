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
~10 seconds**, round-robin across three lanes, so the strait stays an
uncluttered, readable stream of commercial traffic rather than a wall of hulls.
Tight and Sprint pace their entries differently (waves and volleys) but at the
same doubled spacing — the convoy is meant to arrive at a speed a player can
actually read, one hull at a time.

Because the convoy's arrival span sets how long a round lasts, two other
numbers are derived from it rather than fixed: the **enemy's fire window**
(so a round's ordnance is spread across the convoy that is sailing, not across
empty water), and the **round's time limit** (so a hull is only ever written
off for failing to get across, never for entering last).

Ships navigate with a **steering-behavior model**: each integrates a smoothed
vector — head east and hold its lane (goal), keep clear water from neighbors
(separation), and turn or slow to avoid whatever is ahead (collision
avoidance) — through acceleration- and turn-rate-limited motion. The result is
that ships **ease around and wait for one another like real vessels**: a faster
ship commits to a clear side and overtakes a slower one; a ship with no room to
pass slows to match and queues; hulls never overlap or stack. Course changes
are smooth arcs, never sideways drift.

Two hazards get a **throttle** response rather than a rudder one, because at
sea that is what taking way off is for:

- **A charted mine on the bow** — the ship steers around it *and* slows, which
  tightens the turn it can make and buys time to make it.
- **An escort crossing the track** — the escort is under the player's orders
  and is the stand-on vessel, so the merchant slows, down to a dead stop if the
  escort is close aboard, and picks up again once the water is clear. Slowing
  does not propagate down the column the way swerving does. An escort travelling
  *with* the convoy gets no such courtesy (it never clears anyone's bow, so
  waiting for it would mean waiting forever) and is handled by the ordinary
  overtake-or-queue logic; and no merchant will hold for crossing traffic
  indefinitely — after 8 seconds it stops waiting and steers around.

**Escorts steer too.** They run the same shape of model — goal, forward
avoidance, separation, through a turn-rate limit — rather than the straight line
to their destination they used to run. Giving way only works when the merchant
can move: a hull stopped dead in the water (jammed by a drone, queued behind a
slower ship, boarded) cannot get out of anyone's way, so the escort goes around
it instead. If it makes no ground toward its destination for several seconds —
a packed column with no gap in it — it stops going around and parts the line,
because an order has to be carried out.

Two rules make that read as seamanship rather than as a solver twitching:

- **Pass astern.** An escort goes round the *stern* of any merchant making way,
  never across her bow. Crossing ahead of a moving ship is a losing race — she
  keeps coming, so the escort keeps having to bear away and gets herded off its
  track. Cross behind her and she removes herself from the problem. A hull
  stopped in the water has no stern to pass, so that case falls back to plain
  geometry, and two ships on the same course are an overtaking situation rather
  than a crossing one.
- **Commit, then hold.** The escort avoids ONE hull at a time — the nearest in
  its corridor — rather than summing everyone's advice into a course that
  clears nobody. It decides which side once and holds that choice until the
  hull is well clear, and the steering *vector* is filtered before it reaches
  the rudder. The forces are recomputed every tick against a world that is
  itself moving, so the raw vector flickers even when nothing has changed;
  feeding that straight to the helm is what made escorts visibly shake near
  the convoy (measured: 74 rudder reversals across one crossing manoeuvre,
  now 4).

The player operates the convoy's **defenses**, not the cargo ships' steering:

| Action | Input | Cost/limit |
| --- | --- | --- |
| Launch interceptor at a missile | tap the missile (tap again for a second interceptor) | ammo pool + launcher reload |
| Command an escort (move) | tap the escort, then **single-tap** a destination | escort steams there, then resumes forward |
| Command an escort (station) | tap the escort, then **double-tap** a spot | escort steams there and **holds position** |
| Draw an escort a ROUTE | select the escort, then **drag from the ship itself** | she steams the drawn curve leg by leg — how you take her around a minefield |
| A-10 gun runs (kills mines + boats in a radius) | tap A-10, then **drag the run-in line** | 1 charge per sortie; sorties STACK, several jets at once |
| Scan pulse (charts mines ahead) | tap SCAN, then **tap where** to place it | 2 charges/round, must own array |
| Pause / speed (1×/2×/3×) | HUD buttons | free |

The camera has no keys at all. Pinch zooms, drag pans, and the one job a
gesture could not do — finding a ship that has steamed off the edge of the view
— is done by the camera itself: selecting an escort who is off screen brings
her into it, and selecting one already visible does nothing. The widest zoom is
bounded so the world's own edge is never in frame; past that bound the drawn
coastlines run out and the strait appears to pinch shut on geography that does
not exist.

The **only** vessel the player steers is the escort: tap it to select (blue
ring), then either **single-tap** the map to send it there (on arrival it resumes
cruising forward with the convoy) or **double-tap** a spot to order it to
**station** there and hold position (a green marker). Either order deselects the
escort once given.

A **drawn route** is the third option and the only one that is a drag: with the
escort selected, dragging *from the ship* traces a path she then steams leg by
leg, which is how she is taken around a charted minefield rather than through
it. Anchoring the gesture to the hull is what keeps it unambiguous — dragging
anywhere else still pans the map. Under the hood a route is nothing more than a
queue of ordinary move orders, so it inherits every bit of steering the escort
already had (traffic avoidance, the blocked-and-parting rule), and a fresh
single tap abandons it: an order is an order.

Cargo ships steer themselves. **Formation is chosen in the prep screen and fixed
for the transit** (it sets how much lateral room ships keep and how far
blasts/mines spread) — there is no formation or lane control mid-transit. Ship
modules (point defense, sonar, etc.) operate automatically, so 20+ ships stay
manageable on a phone.

The A-10 and Scan are **placed** abilities: tapping the HUD button arms it (it
highlights), and the next tap on the map sends it there — a Warthog station
that scrambles guided seekers inside it, or a scan pulse that charts mines around
the chosen point. Placement lets the player commit a charge exactly where the
threat is, not at a fixed spot.

**Air defense** comes from two launcher types, both bought (and stackable):
- **Shore batteries** on the friendly shore — unlimited range, slow reload. The
  player's baseline defense (one to start).
- **Escorts** — limited range, fast reload, and directly steerable. Purchased,
  not free.

Both draw from a shared interceptor ammo pool. A tap fires from the **nearest
ready launcher** — escort or battery — measured by true distance to the missile;
tapping the same missile again sends a second interceptor from the next-nearest
launcher (so a hard target can be double- or triple-shot). Ships fitted with
**point defense** also fire automatically: a visible tracer streaks at the
nearest missile rather than deleting it silently.

**Both launcher types are attackable, and both can be destroyed.** The enemy
occasionally singles out an escort or streaks a missile across to a shore
battery, and escorts also steam into mines. A hit knocks the launcher **offline
for several seconds** (a red wind-down ring) — it cannot fire during the outage —
and does hull damage. Escorts are lightly built and are **destroyed** outright
once their hull is gone (permanently lost from the fleet); shore batteries are
hardened and take many strikes, but enough of them will **destroy** a battery
too. Unrepaired escort and battery damage carries into the next round and is
repaired in procurement, exactly like cargo hulls. Stationing an escort forward
is therefore a real risk/reward call: more coverage where you place it, but it is
exposed to fire and mines there.

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
transit** — you must survive one more round without it. The original linear
six-branch tree has been superseded by the **player counter catalogue**
(Category → Branch → Nodes → Tactics) — see
[`PLAYER_COUNTERS.md`](./PLAYER_COUNTERS.md) for the full system, its stat
tiers, and the enemy-to-counter coverage matrix.

The **mine-warfare** project ("Minesweeping Drones") fields autonomous drones:
once a mine is charted (by a scan pulse or ship sonar), a drone launches from the
nearest escort or shore battery, flies out to it, and detonates it safely before
ships reach it — turning mine detection into active clearance.

Intel is earned mostly from *contact with the enemy*: losses (+6 each),
interceptions (+1), first encounters with new tech (+12). A struggling player
earns more intel than a flawless one — the built-in anti-snowball.

### 4. Procurement

Cash (earned per cargo value delivered) buys:

- **Ship modules** per class (point defense, missile warning, reinforced hull,
  mine sonar, fire suppression) — limited slots per class.
- **Convoy-wide assets**: escorts (more interceptor launchers), the A-10,
  scanning array, interceptor ammo.
- **Fleet**: replacement hulls, convoy composition (which ships sail, up to
  capacity).
- **Repairs**, bought a scope at a time — cargo hulls (Convoy), escorts and
  shore batteries (Defense), or everything in one order. Each single-scope
  order also offers *repair what you can*, which spends the cash on hand
  worst-hurt-hull-first. There is deliberately no partial order for
  "everything": spending the whole wallet across the whole fleet is not a
  decision. Unrepaired damage carries into the next transit.

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
- **Confidence** (0–100): rises with strong deliveries, falls with losses,
  escorts sunk, crews abandoned and missed quotas. Zero = campaign over.
  It has **two time constants**, and both are visible:
  - the *round* term — one rate-based delivery curve with break-even inside the
    healthy band, plus the crew, escort and capture penalties. Crews brought
    home and a met shipping window are CREDITS, and on a losing round they
    together cancel at most 70% of the damage: they mitigate, never profit;
  - the *ceiling* — derived from the run's whole record. Every hull that did
    not arrive and every crew left in the water permanently lowers the highest
    number the consortium will give you. **A full bar means an operation that
    has lost neither.** It floors at 40, so a bad record is never an
    unrecoverable one, and it is shown on the resource bar (`82/91`) and on the
    debrief, because an invisible cap reads as a bug.
- **Draft rerolls:** rescuing 3 crews in one round earns a reroll of the
  technology table, bankable up to 3. Crews only enter the water when hulls go
  down, so it pays out exactly on the rounds that went badly — and it pays for
  the boat work, not the sinking.
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
