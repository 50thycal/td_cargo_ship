---
name: seesaw-eval
description: |
  Evaluate a Straitwatch playtest game log against the player-vs-enemy "seesaw" north star. Use this whenever the user shares a game-log JSON (the "Download game log" export), asks whether the balance/economy is working, wants to know if the enemy is adapting, asks "is the seesaw working", "how does this playthrough look", "review this log", "is the game balanced", "why did the player lose / stomp", or wants tuning recommendations for the enemy economy or player economy. Also trigger when judging whether loss-causes are shifting round to round, whether the enemy is pivoting after the player counters an attack, or when deciding what economy/enemy numbers to adjust after a playtest.
---

# Seesaw Evaluation

Consistent, repeatable evaluation of a Straitwatch game log against the north
star in [`docs/SEESAW.md`](../../../docs/SEESAW.md). Always use the same rubric so
that two logs are judged the same way and tuning decisions are comparable across
playtests.

**Read [`docs/SEESAW.md`](../../../docs/SEESAW.md) first** (and
[`docs/ENEMY_ATTACKS.md`](../../../docs/ENEMY_ATTACKS.md) for branch/cause names).
That doc is the authority; this skill is the procedure for scoring against it.

## The one question

> Is the seesaw oscillating around the balance point, or is it stuck?

Everything below is in service of answering that and, if stuck, naming the
failure mode and the lever.

## Input

The log is a `TelemetryExport` JSON (see `src/sim/telemetry.ts`). Key fields:

- `rounds[]` — per-round `RoundTelemetry`: `deliveredPct`, `valueSent/Delivered`,
  `losses[]` (each with `cause` + `classId`), `missilesSpawned/Intercepted`,
  `base/escortIntercepts`, `pdKills`, `mines*`, `escortsLost/basesLost`,
  `confidenceBefore/After`, `cashEarned/intelEarned`, `enemyTracks`,
  `researchCompleted/activeResearch`, `newDiscoveries`.
- `totals`, `lossesByCause`, `lossesByClass`, `enemyTracks` (final).
- `confidence`, `cash`, `intel`, `bases`, `escorts`, `completedResearch`.

**Instrumentation gap:** the enemy *economy* (per-round budget, per-branch spend,
ROI, scrap) may not be logged yet — see the end of `SEESAW.md`. If those fields
are absent, **infer** the enemy's doctrine from `lossesByCause` per round and
`enemyTracks` deltas, and say explicitly in the report that the read is inferred,
not measured. Flag missing instrumentation as its own finding.

## Procedure

### 1. Build the per-round table
For each round compute: delivered %, top loss-cause and its share, total losses,
intercept rate (`missilesIntercepted / missilesSpawned`), mine-detect proxy
(`minesRevealed / minesTotal`), confidence delta, cash & intel earned vs spent,
and the `enemyTracks` delta from the prior round. Map each `cause` onto its
**branch** (Missiles / Mines / Torpedoes / Boats / Artillery / Smoke / EA).

### 2. Score the three north-star signals
From `SEESAW.md`:

- **Oscillation, not lock**
  - Does the **#1 loss-cause branch change** every few rounds? (Same #1 for 4+
    rounds = stuck.)
  - Does enemy emphasis (spend if logged, else `enemyTracks`/loss-mix) **shift
    within 1–2 rounds after** the player invests in a counter?
  - Is **every opened branch** sometimes top and sometimes cut? (Always-#1 =
    under-countered; never-used = over-countered/overpriced.)
- **Balance around center**
  - Does **delivery oscillate in a band** (~60–90%) rather than pinning at ~100%
    or collapsing to ~0%?
  - Does **confidence wobble** within the survivable range vs. trending
    monotonically to 0 or 100?
  - Does the **player spend** most rounds, or is cash/intel piling up unspent?
- **Meaningful scarcity**
  - Is there **at least one un-countered branch** each round (where losses come
    from)? Or is the player hard-countering everything at once?
  - Is **enemy scrap** low-but-nonzero (if logged)?

### 3. Diagnose against the failure-mode table
Match what you found to the failure-mode table in `SEESAW.md` and name the
**single most likely cause** and its **usual lever**. Prefer economy/allocation
levers (budgets, prices, ROI weights, growth curves) over mechanics changes —
call out a mechanics change only when numbers can't reach the target.

### 4. Cross-check the economy
- **Player side:** is income (cashPerValue, intel from losses/discovery) letting
  the player fund a counter within ~1–2 rounds of meeting a new threat? Too slow
  → seesaw can't restore from the player's end.
- **Enemy side:** is difficulty (budget growth / `enemyTracks` climb) trending up
  without runaway? Compare early vs late rounds.
- **Anti-snowball:** confirm the restoring force works **both** ways — a
  dominating player should see the enemy arm faster; a struggling player should
  earn more intel and face damped growth.

## Output format (always the same)

1. **Verdict** — one line: is the seesaw working? (Oscillating / Stuck-hot /
   Stuck-cold / Not-adapting / Insufficient-instrumentation.)
2. **Per-round table** — round · delivered% · top loss-branch (share) · losses ·
   intercept% · confidence Δ · net cash/intel.
3. **Signal scorecard** — the three signals (Oscillation / Balance / Scarcity),
   each ✅ / ⚠️ / ❌ with the one-line evidence.
4. **Diagnosis** — the failure mode (or "healthy"), with the specific rounds that
   show it.
5. **Recommended levers** — ranked, each as: which number in `tuning.ts` (or the
   enemy economy, once it exists), current → proposed, and the predicted effect on
   a signal. Economy levers before mechanics levers.
6. **Instrumentation notes** — what the log couldn't tell you and what field to
   add so the next log can.

## Guardrails

- **Don't confuse a hard round with a broken game.** One bad round inside an
  otherwise oscillating campaign is the seesaw *working*. Judge the trend across
  rounds, not a single dip.
- **A stable delivery % is not automatically healthy** — check *why*. ~80% every
  round with a shifting loss-cause mix is a great fight; ~80% every round from the
  same single cause is a stuck seesaw that happens to sit near center.
- **Name the lever, don't just describe the problem.** The point of the eval is a
  concrete tuning change with a predicted effect, tied to a specific constant.
- **Say when you're inferring.** If enemy-economy fields are missing, every claim
  about "why the enemy did X" is inference from loss-mix — label it as such.
