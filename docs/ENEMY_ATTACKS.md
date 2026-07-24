# Straitwatch — Enemy Attack System (Branches · Nodes · Tactics)

This is the **enemy's** side of the tech overhaul. It is the source of truth for
what the enemy can field, how each capability escalates, and how the enemy's
"aim" gets smarter over the campaign. It deliberately stops **before** the
player-counter design — counters are worked out in a later pass, once every
attack type here is locked. Where a counter constraint is already decided
(e.g. "interceptors cannot hit torpedoes") it is noted as a **counter rule** so
the later pass inherits it.

For how the enemy *pays* for all of this round to round — the budget, the
spend-or-scrap rule, and the adaptive buying that creates the arms race — see
[`SEESAW.md`](./SEESAW.md). This document is the catalogue; that one is the
economy and the north star.

---

## The model: Branch → Node → Tactic (+ shared Targeting)

Three axes describe everything the enemy does:

- **Branch** — a *category* of attack (Missiles, Mines, Torpedoes, …). A branch
  is a distinct threat with its own counter-verb. Researching *into* a branch is
  how the enemy opens a new front the player must answer with something new.
- **Node** — a *variant* inside a branch (unguided → guided → sea-skimming …).
  Nodes escalate the branch qualitatively: a harder version of the same threat,
  usually defeating the counter that worked on the previous node.
- **Tactic** — *how much and how* a branch is used this round (one shot → volley
  → coordinated volleys; one lane → every lane). Tactics escalate the branch
  quantitatively and are what the enemy dials up when a branch is *working*.

A fourth axis cuts **across** branches:

- **Targeting Doctrine** — *which ship* the enemy aims at. This is a single
  shared ladder (below). Each branch, as it matures, **unlocks the next rung**,
  so fielding more attack types visibly makes the enemy's aim smarter over time —
  not just louder.

Node = new *problem*. Tactic = *more* of a problem. Targeting = *smarter* about
where the problem lands.

---

## Shared Targeting Doctrine (the enemy's growing "aim")

Unguided weapons are **aimed before launch** (they commit to a ship and fly a
straight line at where it will be); guided weapons **re-aim in flight**. Either
way, *which ship gets picked* is decided by the enemy's current Targeting
Doctrine. This is one ladder shared by every aimed weapon in the game
(unguided/guided missiles, ranging artillery, homing torpedoes, boats picking a
prey) so "the enemy learned to hunt cripples" is **one rule**, not one per
branch.

Crucially, **each rung is unlocked by a different branch reaching a milestone**,
so every new attack type the enemy fields also teaches it a new way to choose
targets. The unlock source is thematic (the branch that would *naturally* see
that criterion grants it):

| Tier | Doctrine | What it does | Unlocked by |
| --- | --- | --- | --- |
| T0 | **Unaimed spread** | Launches scatter across lanes; no ship preference. The round-1 probe. | default |
| T1 | **Aim-and-fire** | Each shot commits to a specific ship's lead position before launch. Baseline "aimed." | Missiles → Unguided node |
| T2 | **Nearest-to-shore** | Prefer ships in the lane closest to the hostile shore (first exposed hull). | Artillery (short-range guns only reach the near lane) |
| T3 | **Finish the wounded** | Prefer the lowest-current-health ship — pick off cripples before they deliver. | Missiles → Guided node (re-aims onto stragglers) |
| T4 | **High-value priority** | Prefer tankers / highest-cargo hulls — maximize economic and confidence damage. | Attack Boats → Boarding node (boats hunt the prize) |
| T5 | **Isolation priority** | Prefer ships outside player defensive coverage (no nearby escort/PD). | Drones → Recon (reveals who's uncovered) |
| T6 | **Deny-the-delivery** | Prefer ships nearest the exit — rob the player of a near-certain delivery. | Smoke / late doctrine (concealment enables end-run ambush) |

**Design intent.** The player should *feel* the aim tighten independently of the
volume. Two rounds with identical missile counts can feel completely different if
one is T1 (spread across healthy ships, most survive) and the other is T3
(every shot converging on the three ships already on fire). Targeting is where
the enemy's "cleverness" lives; volume is where its "pressure" lives.

**Fairness.** A newly unlocked targeting tier gets **one round of reduced
weight** before full strength (like first-appearance caps on nodes), so the
player gets a discovery beat ("they're going after our tankers now") rather than
an unannounced spike.

---

## Branches

Each branch below lists: its **identity** (why it's a distinct threat), its
**nodes** (escalating variants), its **tactic ladder** (volume/frequency
escalation), the **targeting tier it grants**, and any **counter rule** already
decided. Costs are placeholders for the economy pass; relative cost ordering is
what matters here.

---

### Branch: Missiles

**Identity.** The bread-and-butter air threat. Comes out of the sky, is
**tapped down** by interceptors and point-defense. This is the branch the whole
interceptor economy is built around and the one the player already understands.

**Nodes**
1. **Unguided missile** — ballistic shot aimed at a ship's lead position before
   launch; flies straight and does not correct. Cheapest node.
2. **Guided missile** — homes on its target and can re-aim mid-flight; prefers
   stragglers/crippled ships. Defeats "just dodge / move the escort" and forces
   ECM.
3. **Sea-skimming missile** — fast, low-altitude approach; **short interceptor
   reaction window** (appears late / closer, less time to tap). Defeats slow or
   long-range interception; rewards point-defense and early warning.
4. **Swarm / MIRV missile** — one launch that **splits into multiple warheads**
   near the convoy. Defeats one-tap-one-kill interception; punishes thin ammo.

**Tactic ladder** (volume & coordination)
- Single missile
- Small volley (2–5 per volley)
- **Coordinated volleys** — multiple volleys launched simultaneously from
  different sites to split the player's attention/launchers.

**Grants targeting:** T1 Aim-and-fire (Unguided), T3 Finish-the-wounded (Guided).

**Counter rule:** interceptors and point-defense **do** work here (this is their
home branch). Escalation nodes are specifically designed to erode that.

---

### Branch: Mines

**Identity.** Static/pre-placed area denial. **Placed before the round starts**,
invisible until detected, defeated by *sensing + clearing* rather than shooting.
The counter-verb is detection, not interception.

**Nodes**
1. **Standard mine** — proximity trigger; visible to sonar/scan; placed
   pre-round.
2. **Low-signature mine** — defeats standard sonar; needs upgraded detection.
   Placed pre-round.
3. **Drifting mine** — slowly repositions during the round, so a lane the player
   charted as "clear" can go dangerous again. Placed pre-round but does not stay
   put. Defeats "scan once and forget."

**Tactic ladder** (coverage & spread)
- Mines in one lane
- Mines across two lanes
- Mines in every lane
- **Dispersed** — spread out within lanes instead of clustered, so a single scan
  pulse can't chart a whole field.

**Grants targeting:** none directly (mines don't "aim"), but drifting mines
interact with the near-lane doctrine — they tend to drift *toward* the busiest
lane.

**Counter rule:** interceptors do nothing to mines. Detection + sweeping only.

---

### Branch: Torpedoes

**Identity.** The **underwater** branch. Launched from the shoreline, runs under
the surface, and is **immune to interceptors, ECM, and point-defense** — every
air-defense investment the player has made is useless here. That is the entire
point of the branch: it forces investment in a *new* sensor/counter that is
useless against everything else. Torpedoes leave a **wake trail** the player can
read on the water (except the low-signature node).

**Nodes**
1. **Straight-running torpedo** — launched from shore with a visible wake; runs
   straight, no targeting. Random lines across the strait the player must notice
   and route around.
2. **Homing torpedo** — same, but corrects toward ships (uses the shared
   targeting doctrine). Wake still visible.
3. **Low-signature torpedo** — homing, but **leaves no wake**, so the player
   can't read it off the water; requires an active sensor to see it coming.

**Tactic ladder** (volume)
- One single torpedo per round
- Several single torpedoes per round
- One volley of torpedoes
- Several volleys of torpedoes

**Grants targeting:** consumes T3 (homing node re-aims onto the wounded, sharing
the missile doctrine).

**Counter rule (locked):** **interceptors CANNOT counter torpedoes.** The
counter is a separate anti-submarine capability (depth charges / noisemaker
decoys / active sonar) to be designed in the counter pass. Do not let the
interceptor economy leak into this branch.

---

### Branch: Attack Boats

**Identity.** Fast **surface** craft that close with the convoy and engage a
single ship until it sinks, then move to the next. Unlike missiles (a committed
projectile) a boat is a **persistent, sinkable unit** with HP that stays on the
field — the player can kill the shooter, but it takes sustained fire. Requires
its **own anti-boat weapon** (a distinct interceptor/gun that is *not* the
anti-missile interceptor).

**Nodes**
1. **Small-arms boat** — closes to short range, locks onto one ship and pours in
   small-arms fire, staying on that target until it sinks (~30 s of sustained
   engagement), then re-targets. Sunk by ~3 anti-boat rounds.
2. **Rocket boat** — same behavior, fires unguided rockets instead; sinks a ship
   in ~20 s. More dangerous per boat.
3. **Boarding boat** — does not sink its target: it **captures** it. After ~15 s
   of successful boarding the ship leaves its course, steers to the hostile
   shore, and is flagged **captured** — counted as a loss and a **heavy
   confidence hit** (worse than a normal sinking). Defeats "tank the damage and
   push through."

**Tactic ladder** (count & waves — boat verbiage)
- Single boat per round
- Several boats per round
- One **wave** of boats
- Several waves of boats

**Grants targeting:** T4 High-value priority (Boarding boats hunt the prize).

**Counter rule (locked):** boats need a **dedicated anti-boat weapon**, separate
from the anti-missile interceptor. That weapon will itself need a counter/limit
so the branch stays a real decision. To be designed in the counter pass.

---

### Branch: Artillery

**Identity.** **Direct-fire shore guns.** Unlike missiles there is **no arc to
tap out of the sky** — a shell is not an interceptable projectile in the same
way; artillery is *suppressed* (counter-battery), not intercepted. Short range,
so it only threatens the lane nearest the hostile shore — which makes lane
choice and the near-shore targeting doctrine matter.

**Nodes**
1. **Coastal gun** — direct-fire, unguided, **short range (near lane only)**,
   fast rate of fire, low damage per shell (~8 hits to sink a ship).
2. **Ranging artillery** — heavier rounds: more damage and more range, slower
   rate of fire (~5 hits to sink). "Walks" onto ships that hold position, so
   stationing/loitering near the near lane is punished.
3. **Rolling barrage** — high-volume salvo of coastal-gun-level shells: a volley
   of ~12 rounds aimed at a single lane, sweeping across it over time.

**Tactic ladder** (rate & volume)
- Intermittent fire
- Increased rate of fire
- Several barrages per round

**Grants targeting:** T2 Nearest-to-shore (the gun's range *is* the doctrine).

**Counter rule:** interception does not apply cleanly (no interceptable
projectile). Suppression / counter-battery / staying out of the near lane are the
expected answers — designed later.

---

### Branch: Smoke / Concealment

**Identity.** Not damage — **denial of the player's eyes.** Smoke doesn't stop
the player from locking onto a threat; it stops them from *seeing* it until it
emerges. This branch multiplies every other branch by shrinking the reaction
window, and it introduces the **softer** interaction model (a faint/imprecise
marker persists, but the precise tap-target is hidden until the threat exits the
cloud).

**Nodes**
1. **Screening smoke** — laid near the hostile shore, over launch sites. Missiles
   fired through it are still lockable but **invisible until they clear the
   smoke** (only a faint bearing marker), stealing reaction time at launch.
2. **Blinding smoke** — laid **over the convoy itself**. Same rule — threats
   inside the cloud show only a faint marker until they exit — but positioned to
   blind the player over their own ships, and it degrades targeting-assist
   (missile-warning cues) inside the cloud.

**Tactic ladder** (frequency)
- Once per round
- Twice per round

**Grants targeting:** T6 Deny-the-delivery (concealment enables the end-run
ambush on ships near the exit).

**Counter rule / UI note (locked):** start with the **soft** model — a faint,
imprecise marker remains so the player can react to "something's coming from over
there," but the precise sprite/tap-target is hidden in-cloud. Do not fully hide
the threat (too punishing for a tap-to-target game). Better sensors (thermal /
radar) are the expected see-through counter, designed later.

---

### Branch: Electronic Attack / Drones

**Identity.** The **support / disruption** branch. A grab-bag of capabilities
that don't (mostly) sink ships directly but degrade the *player's systems*. Kept
as one branch for now because it reads as "the enemy's support wing." It mixes
**shootable objects** (recon plane, disabling drone) with an **un-shootable
ability** (sensor jamming) — the one place in the whole design where a capability
has *no* counter, only work-arounds. That exception is deliberate and limited to
a single node.

**Nodes**
1. **Recon plane** — flies across the map (like the player's mine-scanner plane
   but slightly slower). While alive it **drops the player's interceptor accuracy
   for 60 s**. The player *can* shoot it down, but must react fast to catch it
   before it crosses. Shootable object.
2. **Ship-disabling drone** — single-use; flies to a specific ship and
   **disables it for ~30 s**. The ship sits dead in the water with a visible
   recovery timer, a static target for everything else. Shootable en route.
3. **Sensor jamming** — an **ability, not an object.** Disables the player's
   ability to reveal any mines for 30 s. **Cannot be shot down.** Played **once
   per round, at the round's start**, with an **unmissable on-screen indicator**
   while active. Costs the enemy real budget (see counter rule).

**Tactic ladder** (how many disruption effects, how often)
- One effect type, once per round
- One effect type, twice per round
- Two effect types, once per round each

**Grants targeting:** T5 Isolation priority (recon reveals uncovered ships).

**Counter rule (locked):**
- Recon plane & disabling drone → shootable (fast reaction). Normal object HP.
- **Sensor jamming → NOT shootable.** It must **cost the enemy real budget** so
  it is never a free opening move every round, and it must show an unmissable
  active indicator. This is the single "no counter, only work around it" node —
  do not add more.

---

## Summary matrix

| Branch | Nodes (escalation →) | Tactic ladder (→) | Grants targeting | Counter family (later) |
| --- | --- | --- | --- | --- |
| **Missiles** | Unguided → Guided → Sea-skimming → Swarm/MIRV | 1 → volley → coordinated volleys | T1, T3 | Interceptors, PD, ECM |
| **Mines** | Standard → Low-sig → Drifting | 1 lane → 2 lanes → all lanes → dispersed | — | Detection + sweeping |
| **Torpedoes** | Straight → Homing → Low-sig (no wake) | 1 → several → volley → several volleys | (uses T3) | **Anti-sub (NOT interceptors)** |
| **Attack Boats** | Small-arms → Rocket → Boarding (capture) | 1 boat → several → wave → several waves | T4 | **Dedicated anti-boat weapon** |
| **Artillery** | Coastal gun → Ranging → Rolling barrage | intermittent → faster → several barrages | T2 | Suppression / counter-battery |
| **Smoke** | Screening → Blinding | once → twice per round | T6 | See-through sensors |
| **EA / Drones** | Recon plane → Disabling drone → Sensor jamming | 1 type×1 → 1 type×2 → 2 types×1 | T5 | Shoot down (except jamming = none) |

---

## Escalation principles (how nodes and tactics unlock)

These govern how the catalogue above turns into an actual round-to-round ramp.
The economics that *drive* the choices live in [`SEESAW.md`](./SEESAW.md); these
are the guardrails.

1. **A branch opens before it deepens.** The enemy fields a branch's node 1 and
   escalates its *tactic* (more volume) before it unlocks node 2. Volume first,
   nastier-variant second — so the player meets "more missiles" before "guided
   missiles."
2. **Nodes are gated; tactics are bought.** Which *node* is available is a
   campaign-progression / research-threshold gate (with scripted floors for the
   designed early beats). How *much* of it is used each round is an economy
   decision driven by what's working.
3. **First appearances are capped and warned.** Every new node and every new
   targeting tier debuts small and (usually) after an intel warning, so each is a
   discovery beat, not an ambush.
4. **Targeting sophistication tracks arsenal breadth.** The more branches the
   enemy has opened, the higher up the targeting ladder it has climbed — so a
   late-campaign enemy with five branches is also aiming with T4–T5 doctrine,
   compounding the pressure.
5. **One un-counterable node, ever.** Sensor jamming is the sole exception to
   "everything has a counter." No other node may be designed as fully
   un-answerable.

---

## Open items for the counter pass (deliberately unresolved here)

- **Torpedo counter** — depth charges vs. noisemaker decoys vs. active sonar; and
  what re-arms/limits it. Interceptors are explicitly out.
- **Anti-boat weapon** — a distinct gun/interceptor for boats, plus its own
  limit/counter so the branch stays a live decision.
- **Artillery counter** — suppression / counter-battery model, since there is no
  interceptable projectile.
- **Smoke counter** — the see-through sensor, and exactly how faint the in-cloud
  marker is.
- **Confidence weighting of a captured ship** vs. a sunk ship (boarding boat) —
  needs a number in the economy pass.
