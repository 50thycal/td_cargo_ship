# Straitwatch — The Seesaw (North Star)

This is the **north star** for the whole game's balance. Every economy number,
every enemy allocation rule, and every judgement we make against a playtest game
log is measured against the single dynamic described here. When a log looks
"off," the question is always: *is the seesaw working?*

It is the companion to [`ENEMY_ATTACKS.md`](./ENEMY_ATTACKS.md) (the catalogue of
what the enemy can field) — this document is **why** and **how much** the enemy
fields it, and what a healthy fight looks like.

---

## The core promise

> The player and the enemy are on opposite ends of a seesaw. Whoever is winning
> tips their end down — and that very success arms the other side to tip it back.
> A healthy game **oscillates around the balance point.** It never sticks.

Concretely:

- The player finds a build that shuts down the enemy's current attack.
- The enemy, seeing that attack stop working, **stops paying for it** and buys a
  *different* attack the player hasn't countered yet.
- The player feels a new threat break through, and **re-invests** to counter it —
  often at the expense of the counter they just relied on.
- Now the enemy's *original* attack is under-countered again, so it becomes
  attractive to buy once more.

The fun is in **never being safe on both ends at once.** Money and research are
finite, so countering everything is impossible; the player is always trading one
exposure for another, and the enemy is always probing for the exposure.

---

## The enemy economy (the mechanism that makes the seesaw real)

Today the enemy allocates abstract "tech points" to hidden tracks. The north-star
model replaces that with a concrete **procurement economy that mirrors the
player's**, so the seesaw is legible, tunable, and visible in the log.

### 1. A budget, per round, that grows

- The enemy receives a **budget** at the start of each round (call it *war
  funds*). It is spent, like the player's cash, on attacks from the catalogue.
- The budget **grows every round** on a defined curve, so absolute pressure
  always trends upward — the player must keep improving just to hold station.
- The budget is the **primary difficulty dial.** Its growth rate is how we tune
  "how hard the game gets over time," independent of *what* the enemy buys.

### 2. Spend-or-scrap

- The enemy must **commit its entire budget at the start of the round** on
  specific attacks (N missiles of type X, a minefield of Y, Z boats, …), exactly
  like the player's prep-phase procurement.
- Everything bought **must be expended during the round.** Anything not used is
  **scrapped** (wasted) — the enemy cannot bank funds for a future super-round.
- This keeps every round a *complete* expression of the enemy's current doctrine
  and prevents hoarding spikes. It also means over-buying a countered attack is a
  real waste for the enemy — which is exactly what should push it to pivot.

### 3. Adaptive allocation (the seesaw's engine)

The enemy chooses **what** to buy based on **what worked last round**, measured
in **return on investment per branch**: *damage/captures/confidence-loss inflicted
per unit of budget spent on that branch.*

- **Reinforce success.** A branch with high ROI last round (it sank ships cheaply)
  gets a **larger** share of this round's budget. If mines sank 10 ships, buy more
  mines.
- **Abandon failure.** A branch with low ROI (the player countered it — few or no
  kills for the spend) gets its share **cut** and redirected to a branch the
  player is *not* countering. If the player stops losing ships to mines, the mine
  budget flows to missiles or boats.
- **Probe the unknown.** A small, capped **exploration** slice always goes to a
  branch the enemy hasn't leaned on recently, so it keeps discovering the player's
  current blind spot rather than converging forever on one line.
- **Escalate within a working branch.** Sustained ROI in a branch unlocks the next
  *node* (guided → sea-skimming) and dials up its *tactic* (bigger volleys), so a
  branch the player ignores doesn't just repeat — it *deepens.*

This is the entire arms race in one loop: **ROI up → buy more + escalate; ROI
down → pivot.** The player's counters are what drive ROI down; the enemy's pivots
are what create the next threat.

### 4. Anti-snowball (keep it oscillating, not runaway)

The seesaw must return to center from **both** sides:

- **When the player is dominating** (high delivery, high intercept, low losses),
  the enemy's budget growth gets a **bonus** — success arms the enemy faster.
  This already exists in spirit (`bonusStrongDelivery`, `bonusHighIntercept`,
  `bonusRichConvoy`) and carries into the budget model.
- **When the player is struggling** (heavy losses, missed quota, low confidence),
  the player earns **more intel** (losses/first-contacts are the main intel
  source) and the enemy's budget growth is **damped**, giving the player room to
  recover and re-counter.

The result is a **restoring force** at both ends. Neither a flawless player nor a
crushed player stays that way — both get pulled back toward a fair fight.

---

## What a healthy seesaw looks like in the log (the metrics)

These are the **north-star signals.** When we read a game log, we are checking
for these. Exact thresholds are starting points to tune, not laws.

### Oscillation, not lock

- **Loss-cause mix shifts round to round.** The single largest cause of ship
  losses should **change** every few rounds (mines → missiles → boats → …), not
  be the same branch for the whole campaign. A stable #1 cause for 4+ rounds
  means the seesaw is stuck.
- **Enemy allocation follows the player's counters with a lag.** After the player
  invests in a counter, that branch's share of enemy budget should **fall within
  1–2 rounds**, and a different branch's share should **rise.** If enemy spend
  never moves, the adaptive allocator is dead.
- **No branch is permanently dominant or permanently dead.** Every opened branch
  should have *some* round where it's the enemy's top earner and *some* round
  where it's cut. A branch that's always #1 is under-countered; a branch that's
  never used is over-countered or overpriced.

### Balance around center

- **Delivery rate hovers, it doesn't flatline.** A campaign that's healthy sees
  delivery oscillate roughly in a band (e.g. ~60–90%), dipping when a new threat
  breaks through and recovering when the player answers it. Pinned at ~100% =
  enemy too weak; pinned near 0% = enemy runaway / player out of economy.
- **Confidence wobbles within the survivable range** rather than trending
  monotonically to 0 or 100. Monotonic-up = no pressure; monotonic-down =
  unrecoverable.
- **The player spends every round.** If player cash/intel is piling up unspent,
  either there's nothing worth buying (tree too shallow) or the player has already
  solved the enemy (enemy not adapting).

### Meaningful scarcity

- **The player is never fully covered.** In a healthy log, for every round there
  is at least one branch the player is *not* hard-countering (that's where losses
  come from). If the player is hard-countering everything at once, either the
  economy is too generous or the enemy has too few branches in play.
- **Enemy waste (scrap) is low but non-zero.** Some scrap is fine (it's the cost
  of the enemy mis-reading the player). Consistently high scrap means the enemy is
  buying attacks that can't be delivered/expended — a bug or a bad price.

---

## Failure modes to watch for (and the usual lever)

| Symptom in the log | Likely cause | Usual lever |
| --- | --- | --- |
| Same loss-cause #1 for 4+ rounds | Adaptive allocator not pivoting, or that counter is too expensive for the player to afford | Strengthen pivot response; or cheapen the counter |
| Delivery pinned ~100% for many rounds | Enemy budget too low / not escalating | Raise budget growth curve |
| Delivery collapses and never recovers | Enemy budget runaway, or player intel/cash can't fund a counter in time | Damp budget growth when player struggles; raise struggling-player intel |
| Enemy spend never changes composition | ROI signal not wired, or exploration slice too small | Fix ROI attribution; widen exploration slice |
| Player hoards unspent cash/intel | Tree too shallow (nothing to buy) or enemy already solved | Add competing nodes; verify enemy is adapting |
| One branch never appears | Overpriced for the enemy, or gated too late | Reprice / re-gate the branch |
| Player hard-counters everything at once | Economy too generous / too few enemy branches active | Tighten player economy or open more branches |
| High enemy scrap every round | Enemy buying attacks it can't expend in the transit window | Fix expend logic / branch price |

**The one rule when tuning:** change the **economy and the enemy allocation
numbers first** (budgets, prices, ROI weights, growth curves). Only change an
*attack's mechanics* when the numbers can't reach the target — because mechanics
changes ripple through the whole catalogue, and the seesaw is fundamentally an
economics problem.

---

## What the log must record for this to be measurable

The current telemetry (`RoundTelemetry`) captures the **player** side well
(losses by cause, intercepts, ammo, economy deltas) but **not the enemy's
economy** — so today the seesaw is only half-visible. To evaluate against this
north star, each round's telemetry needs to also record:

- **Enemy budget** this round (and the growth applied).
- **Per-branch spend** — how the budget was allocated across Missiles / Mines /
  Torpedoes / Boats / Artillery / Smoke / EA.
- **Per-branch ROI** — damage / kills / captures / confidence-loss attributed to
  each branch, and the spend it came from (so ROI = result ÷ spend is computable).
- **Per-branch scrap** — budget bought but not expended.
- **Active nodes and tactic tiers** per branch, and the **current targeting tier.**
- **Losses by branch** (extend the existing `lossesByCause` so causes map cleanly
  onto branches).

Until that instrumentation exists, seesaw evaluation is partly inferred from the
player-side loss-cause mix. Adding it is the prerequisite for the enemy-economy
overhaul to be tunable rather than guessed.

---

## How this is used

- **When designing/tuning:** this document is the target. Propose economy numbers,
  then predict how they move the signals above.
- **When reading a playtest log:** run the **`seesaw-eval`** skill, which scores a
  game log against the signals in this document and flags which failure mode (if
  any) is present, with a recommended lever. It exists so the evaluation is
  **consistent** every time — same rubric, same north star.
