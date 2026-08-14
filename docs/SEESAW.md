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

### Dead content is silent, so go looking for it

Completing the catalogue meant asking a question nobody had asked: *which nodes
has the enemy actually bought?* Across a 947-round sweep, **11 of 18 implemented
nodes had never been fielded once.** Not underused — never bought, in any
campaign, at any budget. Nothing in any report said so, because every signal the
harness watches is computed from what *did* happen.

Three separate causes, all worth knowing:

1. **A fraction that rounds to zero.** Escalation spends a *share* of a branch's
   allowance on its newest node. When that share cannot cover one whole unit it
   buys nothing and the remainder falls through to volume — and since that
   depends on the node's price, not on the round, the branch could never
   escalate however long the campaign ran. Artillery saw ~44 budget in the round
   its second gun unlocked at 285.
2. **Reaching for the top rung.** Escalation aimed at the *newest* available
   node, so the moment a branch's third rung gated in, its second became
   unreachable forever — the money always went past it.
3. **Per-round ROI punishes lumpy branches.** A branch buying 3,000 five-credit
   missiles has a smooth ROI; one buying a single 180-credit gun has a violent
   one, and a single bad round reads as failure. Artillery had the *best*
   cost-per-result of all seven branches while being defunded for variance. ROI
   is now measured against a branch's whole record rather than its last round.

The fixes had to be kept apart from the counter signal, which is the subtle
part. A rule that guarantees a branch can reach its next rung will, if applied
every round, also hand it that rung regardless of what the player is doing —
and then the countered and ignored arms of the escalation tests buy identical
ladders. The reachability rule therefore buys a **debut only**, and **only after
the rung has gone begging for several rounds**; leaning into the newest variant
round after round stays the exclusive business of being hard-countered.

### Breadth has to be paid for — but not with money

Switching the two support branches from priced-but-dead to genuinely funded made
every other branch poorer: seven claimants on a budget sized for five. It showed
up as mines no longer being able to afford a low-signature variant in *either*
arm of its counter test — the player's counter had stopped changing what the
enemy built.

The obvious lever was the budget curve, and it was the wrong one. Raising it far
enough to restore the signal took round-cap completions from **34 campaigns in
72 to 15 in 80** and left every build except the two economic ones unviable.
What worked was making the *counter* the thing that escalates — a hard-countered
branch reaches for its newest variant whenever it can afford one — plus a much
smaller budget bump for the genuine cost of two extra claimants. Same signal,
about a third of the difficulty.

**When a signal weakens after adding content, check whether it needs more
resources or just a sharper rule. Resources are the expensive answer and they
move everything else with them.**

### The restoring force was aimed at the wrong variable

The Balance signal sat at 1–6% for four slices running. Both ends were broken,
and neither for the reason the design assumed.

**Losing side.** Everything aimed at a struggling player acted on something
other than what was killing them: `dampStruggling` trims the *enemy's* budget,
`intelPerLoss` pays research currency. Neither helps an operator who cannot
afford to sail — and cash was the thing collapsing. Income is purely
delivery-proportional with no floor, while a cargo hull earns 40 on delivery
and costs 80 to replace, so the fleet breaks even at a **33% loss rate** and
shrinks irreversibly above it. Every collapse traced ran the same three rounds:
~700 cash and 20 hulls, then ~250 and 7, then dead. Confidence had the same
shape — a bad round, the loss cap and a missed quota all describe one disaster
and all land together, for −35 against a starting 60.

**Winning side.** The flat bonuses fired constantly (strong delivery in 71% of
rounds) and moved nothing: 56% of all rounds finished above 90% delivered.
Survival and being-in-band were *anticorrelated* — you dominated or you
collapsed, which is the bimodality stated exactly.

The fixes are deliberately symmetric: underwriting that scales with how badly
the player is losing, and enemy pressure that scales with how long they have
been winning. **Both release the moment the fight is even again**, which is what
makes them restoring forces rather than a difficulty slider.

### Convoy size was secretly the best defensive stat

The deepest one. The enemy fired a budget-determined volume of ordnance
regardless of how many hulls sailed, so **growing the convoy simply diluted
incoming fire**: 6 hulls took 4.13 missiles each, 40 took 0.85, and delivery
went 63% → 91% purely from being bigger.

Hull count was therefore the best *defensive* stat in the game — while also
being the *scoring* stat. Buying hulls beat buying defense on both axes at
once, which is why the greed build outscored every build that actually fights,
and why the specialists could not climb: they sail small convoys into undiluted
fire. Defense share and value-per-round were near-perfectly inversely
correlated across nine builds.

Enemy ordnance now scales with the convoy value actually sailing, against a
**fixed** reference. Measuring against the campaign's own first convoy is
self-cancelling — a build that starts big and stays big reads as 1.0 forever,
which is exactly the build the scaling exists to price. Tried that way first;
it moved missiles-per-hull by 0.02.

### A persona that had been lying to every sweep

Ablating one counter at a time out of the `balanced` build produced two arms
with *byte-identical* scores. That only happens if those counters were never
bought — and they never were. Research runs one project at a time and a
campaign completes about thirteen, so `balanced`'s depth-ordered list never
reached its tail: it had **never researched deck guns or counter-battery in any
campaign**. A missile/mine specialist had been wearing a generalist's name, and
every sweep using it was quietly measuring narrow coverage.

Two lessons, and the second is the sharper one:

1. Order a bot's research by breadth when it is meant to represent breadth.
2. **An ablation that changes nothing is evidence about your harness, not about
   the thing you ablated.** Identical numbers are a bug report.

And a third, learned immediately after: the first corrected ablation run said
every counter was worth *negative* value. On matched seeds at 16 seeds instead
of 10, that inverted for two of them. Ten seeds is not enough to rank builds
that finish within 10% of each other.

### Counters measured: what each one is actually worth

`npm run ablate` removes one counter branch from a broad build and plays both
arms on matched seeds. Measured against `balanced` at 16 seeds:

*The ECM row is a historical measurement. That branch has been replaced by the
A-10 Warthog, which attacks mines and attack boats rather than missiles — its
own ablation figure is not in this table yet.

| counter | vs | worth | survival without it |
| --- | --- | --- | --- |
| escort interceptors | missiles | **+38.6%** | 88% → 19% |
| base interceptors | missiles | **+36.9%** | 88% → 6% |
| scan pulse | mines | +11.4% | 88% → 63% |
| ECM* | missiles | +7.8% | 88% → 63% |
| mine sonar | mines | +2.0% | 88% → 75% |
| MCM drones | mines | +1.9% | 88% → 69% |
| reinforced hull | — | −2.1% | 88% → 88% |
| deck gun | attack boats | −2.4% | 88% → **94%** |
| hydrophone | torpedoes | −2.4% | 88% → **94%** |
| counter-battery | artillery | −5.1% | 88% → 88% |

Score and survival agree, which is what makes the ranking trustworthy — score
alone would be suspect, because the score function barely rewards staying alive
(40 a round against ~470 of delivered value, so a build that dies at round 13
having shipped a lot outscores one that survives 15 shipping less).

Six more — self-defense, missile warning, depth charges, thermal imaging, flak,
compartmentalization — are **researched and then never bought**, so they cannot
be measured this way at all.

### The counters are not mispriced. Spending is.

The obvious reading of that table is a pricing problem, and it is wrong. Cargo
modules bill at 16–20× their per-ship cost at realistic fleet sizes, so
Self-Defense costs 19–28 hulls; halving every cargo module's price to see what
happened made **both** broad builds worse — `balanced` fell from 88% survival to
69%, and the equip-first build from 38% to 6%. Losses fell in both arms, so the
equipment was working. The builds still did worse.

What punishes them is the quota. Its target is sized from the player's **own
recent pace**, and it only adapts downward *after* a miss has already cost 18
confidence. So any purchase that trades convoy size for convoy quality misses a
quota set by the larger convoy it used to sail:

| build | hulls sailed / capacity | quota missed |
| --- | --- | --- |
| economist (pure hulls) | 29.4 / 30.4 | 28% |
| balanced | 24.6 / 31.6 | 39% |
| technologist (equip first) | 19.7 / 31.5 | **60%** |

Not the floor, which never binds — the adaptation lag. **Quality-over-quantity
is structurally punished no matter what the equipment costs**, and no price
change can reach that, which is why the price change made things worse instead
of better: it only got the builds to buy more of the thing that was shrinking
them.

The lesson is the one this document keeps relearning from a new angle: *check
that the metric driving a fix is the one that is actually broken.* Two of the
last three findings here have been a mechanism wearing a pricing problem's
clothes.

### A failure bar must stay inside the achievable band

The quota's difficulty ratchet only ever climbs, and its ceiling was 1.6 —
which, at a 0.7 delivery fraction, demands **112% of the convoy value that
sailed**. Even the ~1.3 reachable mid-campaign asked for more than the healthy
band's own ceiling. The trap stayed hidden while campaigns banked victory at
the completion watermark; the moment region completion started waiting for the
open quota window (so a run must clear one final, fully-ratcheted window), a
sweep showed six of twelve personas **quota-failing at 80–84% delivered** —
killed by the bookkeeping while fighting inside the band the game calls
healthy. The ceiling now sits at 1.15 (demand tops out ~80.5% of sailed
value): a bar a sloppy run misses and a defended run clears.

The rule: any run-ending target expressed as a fraction of the player's
achievable output must have its ceiling checked against the healthy band —
a ratchet with no such check will eventually demand more than the game's own
definition of a great round, and it will look like difficulty until someone
reads the arithmetic.

### A counter cannot be worth more than the threat it answers

With the quota fixed, the four negative counters were **unchanged** — deck gun
−2.3%, counter-battery −5.0%. Their problem was never the player's economy at
all: artillery was 7% of all losses and attack boats 8%. A counter bought for
7% of your damage cannot pay however cheap it is, and buying down its price
just makes a bad deal marginally less bad.

So the fix went on the ENEMY side: artillery damage and boat DPS each up ~30%,
which moved boats to 11% of losses and artillery to 9%, and moved every
mitigation counter with them (reinforced hull and the hydrophone improved too,
without either being touched — a more lethal enemy makes protection worth more
across the board).

Two things that only showed up by measuring:

- **The unit ceiling was not the constraint.** Raising `maxUnitsPerRound` for
  both branches produced *byte-identical* results across 176 campaigns. The cap
  never binds: artillery's allowance is ~44–256 and one gun costs 180, so it can
  rarely afford even one. Budget share was the limit all along.
- **Fair pricing and counter-viability pull against each other.** At the raised
  lethality and old prices, artillery was the best buy in the catalogue (5.7
  cost-per-result against a 7–9 pack) and counter-battery reached −1.1%.
  Repricing it to a fair 7.9 pushed counter-battery back to −3.7%. A cheaper
  artillery *also* turned out to help the greed build — it sprints the far
  lanes, which artillery cannot reach, so budget shifted into artillery is
  budget aimed where that build is not: its survival went 38% → 63%.

Fair pricing won, because "greed is punished" is a property worth more than a
situational counter reaching break-even. Counter-battery and the deck gun sit
near zero rather than clearly positive, and that is the honest landing.

**Know the harness's resolution.** Deck gun measured −2.4%, −2.3%, +0.3%,
−1.7%, −2.6% across five runs of the same 16 seeds as other things moved around
it. Counter-battery moved decisively (−5.0% → −1.3% → −3.7%) and the deck gun
never left the noise. Effects of 1–3% are not separable at this seed count;
tuning against them is fitting noise, and stopping is the discipline.

---

## How this is used

- **When designing/tuning:** this document is the target. Propose economy numbers,
  then predict how they move the signals above.
- **When reading a playtest log:** run the **`seesaw-eval`** skill, which scores a
  game log against the signals in this document and flags which failure mode (if
  any) is present, with a recommended lever. It exists so the evaluation is
  **consistent** every time — same rubric, same north star.
