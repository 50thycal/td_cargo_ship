---
name: playtest-fidelity
description: |
  Compare a hand-played Straitwatch game log against the headless bot sweep and improve the simulation harness so it plays the game the human actually plays. Use whenever the user shares a playtest log and asks how their gameplay compares to the bots, the sim, or the balancing simulation; asks "does the sweep match how I play", "why does the simulation disagree with my playthrough", "is the playtest harness realistic", "are the bots playing this right", "update the sim to match my playtest"; or after a game change that adds a mechanic, region, ability or command the personas may not know about. This is the HARNESS-side companion to `seesaw-eval`: seesaw-eval judges whether the GAME is balanced, this judges whether the MEASUREMENT is trustworthy. Run this first when a hand-played session and a sweep disagree.
---

# Playtest Fidelity

`seesaw-eval` asks *is the game balanced?* This skill asks the question that has
to come first:

> **Is the sweep measuring the same game the playtester is sitting in front of?**

A balance number produced by bots that never salvage, never move an escort and
never meet a boarding party is a confident answer about a game nobody plays.
Every conclusion the sweep reaches is conditional on the bots exercising the
same systems the human does — and that condition decays silently every time a
mechanic is added to the game and not to the personas.

This skill measures that decay and closes it.

## Why this works at all

Both halves of playtesting emit the **same artifact**: a `TelemetryExport`
(`src/sim/telemetry.ts`). The in-game *Download game log* button and
`npm run playtest` produce byte-identical shapes. So a hand-played session and a
bot campaign are directly comparable with no new instrumentation — which is what
makes this a repeatable loop rather than a one-off investigation.

## Read first

- [`docs/PLAYTESTING.md`](../../../docs/PLAYTESTING.md) — what the sweep is and
  what it already admits it cannot measure.
- [`docs/SEESAW.md`](../../../docs/SEESAW.md) — the north star the sweep scores
  against, and the tuning discipline (economy levers before mechanics levers).
- `tools/playtest/personas.ts` — the bots. Almost every fidelity fix lands here.
- `tools/playtest/fidelity.ts` — the probe panel this skill drives.

---

## Procedure

### 1. Characterise the human log

Read the log's header before anything else and note:

| Field | Why it matters |
| --- | --- |
| `regionId` | Sets the enemy roster, starting state and completion round |
| `commanderAbilities` | Modify accuracy, recovery rate, prices, start cash |
| `rounds.length` | The sweep must be capped to the **same** number |
| `runOutcome` / `defeatCause` | A won, lost and abandoned run are read differently |
| `formatVersion` | An older log may be missing probe fields — expect `no data` |

### 2. Run a matched sweep

Match the round cap to the human log. An uncapped sweep compares a 9-round
hand-played run against 15-round bot campaigns, and every per-round rate drifts
for reasons that have nothing to do with fidelity.

```bash
npm run playtest -- --rounds <N> --seeds 6 --out playtest-out
```

Six seeds × eleven personas is enough to read a fidelity gap (they are large;
balance effects are the small ones). Use more seeds only if a probe lands near
its tolerance band.

### 3. Run the differ

```bash
npm run fidelity -- --human <log.json> --sweep playtest-out --json fidelity.json
```

It prints a run-setup diff, four groups of probes (engagement / tempo / economy
/ outcome) with `MATCH` `DRIFT` `DIVERGENT` `UNEXERCISED`, and a ranked gap list.
Banding is on the **log ratio**, so "half as much" and "twice as much" are the
same distance.

### 4. Triage every gap into one of four buckets

This is the judgement step, and the whole value of the skill is here. **Not
every gap should be closed**, and closing the wrong one makes the harness less
honest, not more.

**A — Setup mismatch.** The two sides are not in the same region, with the same
commander loadout, the same starting state or the same completion round. *Always
close.* No judgement required and nothing downstream is comparable until it is.
Fix in the runner's campaign construction (`newRegionalRun`, not `newCampaign`).

**B — Missing capability.** The bot cannot issue the command at all — check
`decideCommands` in `personas.ts` against the `TransitCommand` union in
`src/sim/types.ts`. A command type with no case in the persona is a system the
sweep has never once exercised. *Close.* This is the bucket that produces the
biggest, quietest measurement errors.

**C — Deliberate idealization.** The bot *can* do it and does it better than a
human ever would: perfect target deduplication, tick-rate reaction, no
misclicks. Closing these is optional and often wrong — a bot that plays like a
tired human measures noise. *Decide, then write down the direction of the bias*
in `docs/PLAYTESTING.md` so every later reader knows which way the number leans.
The existing note about smoke being under-measured against bots is the model to
follow.

**D — Human-side finding.** The human does *less* than the bots — bought an
ability and never used it, ignored a mechanic, never changed a setting. This is
**not a harness bug**. It is a discoverability or UX finding, and it belongs
back in the game (or in a design note), never in the personas. Resist the pull
to "fix" it by making the bots play worse.

### 5. Propose fixes, ranked, one lever each

Order by measured severity, not by ease. For each, name:

- the **bucket** (A/B/C/D),
- the **file and function** it lands in,
- the **probe it should move** and in which direction,
- what it will do to **existing baselines** (most fidelity fixes invalidate the
  previous sweep's absolute numbers — say so).

### 6. Close the loop and re-measure

After each fix, re-run steps 2–3 and confirm the intended probe moved and the
others did not. Then record the run in the fidelity ledger (below).

---

## The one-change rule

**Never close a fidelity gap and tune a balance number in the same change.**

A fidelity fix moves the bots; a balance fix moves the game. Do both at once and
the next sweep's movement cannot be attributed to either. Close fidelity gaps
first, re-baseline, *then* tune — and re-read the affected `seesaw-eval`
conclusions, because a harness fix can invalidate a balance decision that was
made against the old bots.

---

## Fidelity ledger

Append one row to `docs/PLAYTEST_FIDELITY.md` per iteration so drift is visible
across playtests rather than rediscovered each time:

```
| date | human log | rounds | grade | gaps closed | gaps accepted (bucket C/D) |
```

The grade line from the report (`N/M probes match`, or `SETUP MISMATCH (n)`) is
the tracked number. A grade that falls between playtests means the game grew a
mechanic the harness has not learned yet — which is the normal, expected way
this decays, and exactly what the ledger is for.

---

## Adding a probe

When the game gains a mechanic, add a probe for it in the same change. A probe
is one entry in `PROBES` in `tools/playtest/fidelity.ts`:

- `value(logs)` aggregates over one side's logs — return `null` when the side
  has **no data** for it (an older log missing the field), which is different
  from a measured zero and must not be reported as one.
- `tolerance` is the relative band for `MATCH`. Be generous (0.3–0.5) on
  behavioural rates and tight (0.1–0.2) on economy and outcome numbers.
- `why` states **what a divergence invalidates** — this string is what makes the
  gap list actionable rather than a wall of ratios. Write it as a consequence,
  not a description.

Prefer probes over prose: a claim about the harness that isn't in the panel
stops being checked the moment this conversation ends.

---

## Guardrails

- **A DIVERGENT probe invalidates the balance conclusions that depend on it.**
  Say which ones. "Mine ROI looks high" is not a finding when the bots recover
  0.2% of wreckage and therefore never climb the mine-counter branch.
- **Setup mismatches outrank everything.** If the sides are in different
  regions, report the probe table as *not yet comparable* rather than reading
  numbers off it.
- **An outcome probe that MATCHes over broken engagement probes is a
  coincidence, not a validation.** Two sides can land on the same delivery %
  through completely different play. Report it as agreement-by-accident.
- **Close gaps in the harness, not in the game.** The temptation when a bot
  can't cope with a mechanic is to soften the mechanic. That tunes the game to
  the bots.
- **One log is one data point.** A single hand-played run has seed variance a
  60-campaign sweep does not. Treat a lone log's outcome probes as indicative
  and its engagement probes (does the human touch this system at all?) as
  reliable — those are behavioural, not stochastic.
