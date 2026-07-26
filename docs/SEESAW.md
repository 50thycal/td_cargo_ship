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

## What the log records (implemented)

Both halves of the seesaw are now instrumented, so evaluation is **measured
rather than inferred**. Each round's `RoundTelemetry` carries:

- `enemy.budget` — war funds granted (after anti-snowball modifiers), plus
  `committed` and `scrapped`.
- `enemy.branches[].spend` / `.share` — how the budget was allocated across
  Missiles / Mines / Torpedoes / Boats / Artillery / Smoke / EA.
- `enemy.branches[].roi` / `.result` / `.kills` — what each branch earned for
  what it cost, so ROI = result ÷ spend is directly readable.
- `enemy.branches[].scrap` — budget that could not be converted into units.
- `enemy.branches[].units` — units fielded per node, plus `nodeDebuts`,
  `openBranches`, `roundsInvested`, and the current `targetingTier`/`targetingName`.
- `lossesByEnemyBranch` in the export — every loss cause mapped onto its branch,
  with `collateral` (secondary blast) and `attrition` (lost at sea) as explicit
  non-branch outcomes.

The campaign-level export adds `enemyEconomy` (spend/kills/ROI per branch,
per-round share history, final targeting rung). `npm run playtest` scores the
allocator directly from these fields — see [`PLAYTESTING.md`](./PLAYTESTING.md).

**Implementation:** the economy lives in `src/sim/evolution.ts`; prices, gates
and targeting grants are data in `src/data/enemyBranches.ts`; the dials are
`ENEMY_ECONOMY` in `src/data/tuning.ts`.

### A pricing rule learned the hard way

Attacks must be **priced by realized lethality, not by nominal unit.** The first
build priced a mine (115 damage, a guaranteed kill on a cargo hull, and
un-interceptable) at 11 against a missile (34 damage, routinely shot down) at 8.
A playtest sweep measured the result: mine ROI **17×** missile ROI, so the
allocator — correctly — bought almost nothing but mines, and the seesaw locked.
Repricing mines to 28 restored rotation (top-spend pivots went 0.26 → 1.48 per
campaign). When adding a branch, price it against what it actually achieves.

### A clamping rule learned the hard way

**Apply the counter-response bonus after the ordinary ceiling, not before it.**
The node-ladder escalation share was computed as
`min(max, base + perRound × tenure + counteredBonus)`. That reads correctly and
is wrong: any branch the enemy had invested in for ~6 rounds already exceeded
`max` from tenure alone, so the countered bonus was clamped away entirely and
the player's counter produced **no answer at all**. The bug survived because the
test that claimed to check it compared two runs with *different seeds* — the
exploration jitter moved the shares more than the signal did, and the assertion
passed on noise for as long as it existed. Both halves are now fixed: the bonus
is added on top of the tenure clamp with its own higher ceiling, and the
escalation tests hold the seed constant across both arms and vary only the
counter signal.

Two rules follow. When a mechanism is "the enemy answering the player", check
that its input can still move the output at the *end* of a campaign, not just at
the start. And when a test compares two behaviours, change one thing between the
arms — a seeded run is a sample, not a measurement.

### A scoring rule learned the hard way

**"Spent nothing" is not the same as "never tried."** ROI fell back to the
neutral prior for any branch that spent nothing in a round. That reads as a
sensible way to keep an untried branch worth probing, and it is — but a branch
that had been thoroughly beaten *also* spends nothing the moment its allowance
drops below the price of one unit. It then came back scored as promising as
something never attempted, so the allocator refunded it, it failed again, and
the cycle repeated. A branch earning zero for ten straight rounds was still
holding a 1.0 ROI and the largest share of the budget. Falling back to the prior
only for branches that have never been opened fixed it, and the branch the
player had beaten dropped from a 0.46 share to 0.10.

The general form: any "no data" default must be reachable only by genuine
absence of data. If a failure state can also produce it, the default becomes a
laundering mechanism for that failure.

### What a fourth branch taught us about prices

Adding attack boats did not just add a threat, it added a second **efficient**
outlet for the same budget. Measured across a sweep, mines cost the enemy ~68
budget per kill and boats ~65 — well matched to each other, and both about 15×
cheaper per kill than missiles (~960) or torpedoes (~1500). While mines were the
only cheap option, the per-round unit ceiling capped how much of the budget could
find its way there. A second cheap option removed that cap in practice, total
lethality rose, and every playtest build collapsed by round 11.

So: **a new branch priced to match the current best is a difficulty increase,
not a lateral move.** Boats are now priced deliberately above mines, and opening
that front costs the enemy efficiency rather than handing it a better mine.

### Pricing a branch takes two sweeps, not one

Artillery made the loop explicit. Shipped at 96/150/210 it measured **66 budget
per kill against 137-225 for every other branch** and collapsed all but 6 of 72
campaigns. Corrected to parity at 290/450/620 the allocator stopped buying guns
entirely — the branch vanished from the loss mix and oscillation fell straight
back from 51% to 25%. It sits at 180/285/400, between the two, and both ends of
that bracket had to be measured to find it.

So the rule is not "price it right first time", which is not achievable. It is:
**ship a price, measure cost-per-kill, and expect to bracket it.** A branch
priced too low breaks difficulty; a branch priced too high is worse, because it
is silently absent and the report still looks reasonable. The second failure is
the one to watch for, since nothing screams.

### The scoring bug underneath all of it

That wider spread turned out not to be a pricing problem at all.

**Kill credit went entirely to whatever landed the final blow.** A mine does 115
damage to a 100hp hull, so it almost always finishes; a 34-damage missile almost
never does. Missiles measured at ~1200 budget per kill against a mine's ~70 — and
they had not failed. A third of them were getting through and they dealt 50k
damage across a sweep. Something else was simply credited with every hull they
had softened. The allocator read that as "missiles do not work", defunded them,
and the entire catalogue collapsed onto two one-shot branches.

Kills are now **split across branches in proportion to the damage each did** to
that hull, so a kill is still exactly one kill but nobody is credited with work
they did not do. Fractional kills fall out of this and that is fine. The effect
on the measurement was immediate, before a single price moved:

| | before | after attribution fix |
| --- | --- | --- |
| missile kills (sweep) | 81 | 217 |
| torpedo kills (sweep) | 41 | 147 |
| cost-per-kill spread | 18x | 6.9x |

Repricing every branch against the corrected numbers closed the rest, to a
**1.54x** spread with the enemy's spend genuinely distributed (missiles 39%,
mines 26%, boats 18%, torpedoes 17%) instead of concentrated in whatever
happened to land last.

The lesson generalises past this game: **before tuning a number, check that the
metric driving it measures what it claims to.** Two rounds of price changes were
spent compensating for a scoring artifact, and neither would have worked, because
the branch being "fixed" was never the one that was broken.

---

## How this is used

- **When designing/tuning:** this document is the target. Propose economy numbers,
  then predict how they move the signals above.
- **When reading a playtest log:** run the **`seesaw-eval`** skill, which scores a
  game log against the signals in this document and flags which failure mode (if
  any) is present, with a recommended lever. It exists so the evaluation is
  **consistent** every time — same rubric, same north star.
