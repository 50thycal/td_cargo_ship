# Straitwatch — Playtest Fidelity

[`PLAYTESTING.md`](./PLAYTESTING.md) asks *is the balance working?*
This document tracks the question that has to come first:

> **Is the sweep measuring the same game the playtester is sitting in front of?**

Every balance conclusion `npm run playtest` reaches is conditional on the bots
exercising the same systems a human does. That condition decays silently every
time a mechanic is added to the game and not to the personas — so it has to be
measured, not assumed.

## Running it

```bash
# 1. Sweep, capped to the SAME round count as the human log
npm run playtest -- --rounds 9 --seeds 6 --out playtest-out

# 2. Diff the hand-played log against it
npm run fidelity -- --human straitwatchlog.json --sweep playtest-out
```

The report gives a run-setup diff, four probe groups (engagement / tempo /
economy / outcome) and a ranked gap list. Banding is on the **log ratio**, so
"half as much" and "twice as much" are the same distance — a linear band around
1.0 cannot report "the bots do this 100× less" as anything worse than a shrug.

The procedure for acting on it — including which gaps *should not* be closed —
is the **`playtest-fidelity`** skill.

## The four buckets

Every gap triages into exactly one, and only two of them are harness work.

| Bucket | Meaning | Action |
| --- | --- | --- |
| **A — Setup mismatch** | Different region, commander loadout, starting state or completion round | Always close. Nothing downstream is comparable until it is. |
| **B — Missing capability** | The bot cannot issue the command at all (`TransitCommand` case with no persona branch) | Close in `personas.ts`. Biggest and quietest measurement errors live here. |
| **C — Deliberate idealization** | The bot *can* do it and does it better than any human (perfect dedup, tick-rate reaction) | Optional. If accepted, **write down the direction of the bias** so later readers know which way the number leans. |
| **D — Human-side finding** | The human does *less* than the bots — bought a thing and never used it | **Not a harness bug.** A discoverability/UX finding for the game. Never "fix" it by making bots play worse. |

## The one-change rule

**Never close a fidelity gap and tune a balance number in the same change.** A
fidelity fix moves the bots; a balance fix moves the game. Do both at once and
the next sweep's movement cannot be attributed to either. Close gaps, re-baseline,
*then* tune — and re-read the `seesaw-eval` conclusions that rested on the old bots.

---

## Ledger

One row per fidelity iteration. A grade that **falls** between playtests means
the game grew a mechanic the harness has not learned yet — the normal way this
decays, and what the ledger exists to make visible.

| Date | Human log | Rounds | Grade | Gaps closed | Accepted (C/D) |
| --- | --- | --- | --- | --- | --- |
| 2026-08-07 | `straitwatchlog_r9` (pirateNarrows, steadyHands+salvageTeams) | 9 | **SETUP MISMATCH (5)** — 6/20 probes match | — (baseline) | see below |

---

## Open gaps (as of the 2026-08-07 baseline)

Measured against 60 bot campaigns (11 personas × 6 seeds, 9-round cap, AFK
control excluded) versus one 9-round hand-played run.

### A — Setup mismatch (5 of 5 setup rows differ)

The sweep runs `newCampaign()`, which is `newRegionalRun(seed, 'openSeas', [])`.
`openSeas` is the **dev proving ground** — explicitly excluded from
`REGION_ORDER`, so no player can ever select it.

| | Human | Bots |
| --- | --- | --- |
| Region | `pirateNarrows` | `openSeas` |
| Enemy branches | missiles + mines + attackBoats | all seven |
| Escorts at start | 1 | 0 |
| Completion round | 10 | none (endless) |
| Commander abilities | steadyHands, salvageTeams | none |

Consequences that showed up directly in the probes:

- **The seven-branch roster dilutes every branch below its debut threshold.**
  Across 524 bot rounds there were **zero boarding attempts**; the human met six
  captures in a single round. The same enemy budget split seven ways never
  reaches the attack-boat nodes that a three-branch region reaches by round 4.
- **The loss mix inverts.** Bots: missiles 57% / mines 28% / boats 8%. Human:
  boats 52% / mines 48% / missiles 5%.
- **No completion watermark** means `--rounds N` is an arbitrary stopping point
  rather than a win condition, so the sweep never plays an endgame.

### B — Missing capability

`decideCommands` in `personas.ts` implements `intercept`, `sweepMine`,
`depthCharge` and `ability`. The `TransitCommand` union also carries
`moveEscort`, `engageBoat`, `counterBattery`, `reboot` and `toggleAuto` — none
of which any persona has ever issued.

- **`moveEscort` — the recovery loop is dead in the sweep.** 2062 wreckage
  fields spawned, **5 recovered (0.2%)**, 2057 expired; 1709 survivor areas,
  **3 rescued**. The human recovered 44/54 (81%) and rescued 12/15 (80%). The
  ~0.9 escort-seconds/round the bots do log is incidental proximity, not a
  decision.
- **Which breaks the draft economy downstream.** Recovered wreckage is what
  widens the draft from two options to three (`DRAFT.thirdChoicePerUnit`) and
  what skews it toward deeper nodes past `DRAFT.qualityThreshold`. Across 556
  bot drafts, **one** offered three options. The human got three options in 6 of
  8 drafts. *The sweep has been measuring a different technology tree than the
  one a player climbs.*
- **`engageBoat` / `counterBattery`** are never issued manually, so those
  branches are measured only through their auto-fire tactics — which is part of
  why `SEESAW.md` records the deck gun and counter-battery sitting near zero
  value. That measurement is a floor, not a valuation.
- **Formation never changes.** Each persona has one fixed formation for the
  whole campaign; the human switched three times in nine rounds.

### C — Deliberate idealization (accepted, with the bias recorded)

- **The bots waste no interceptors.** Human duplicate-shot rate **17.7%** of all
  shots (51 of 288); bots **0.0%**, because `decideCommands` filters on
  `claimedByInterceptor` before firing. *Bias: the sweep's ammunition economy is
  ~18% cheaper than a real player's.* Accepting this is defensible; forgetting
  it while pricing ammunition is not.
- **`duplicateShotsAvoided` is uninterpretable in sweep logs.** It read 471,899
  across 66 campaigns (~850/round) because a bot re-offers an intercept every
  tick and each rejection increments the counter. Do not compare this field
  across the two sides.

### D — Human-side findings (game, not harness)

- **Smoke was researched, bought and never used.** The player took
  `smokeScreen.base` in the round-6 draft and spent $160 on it in round 7, then
  laid **zero clouds** in nine rounds. The bots laid 0.26/round. A bought
  ability that never gets used once is a discoverability problem, not a persona
  bug — and the fix belongs in the game.
- **Manual/auto split is inverted.** Human 32% manual / 68% auto (they drafted
  `escortInterceptor.localAuto` and `baseInterceptor.strategicAuto` early and
  leaned on them); bots 83% manual. A hand-firing bot under-values every
  auto-fire node in the tree.

### Outcome probes that agree *by accident*

Mean delivery (92.7% vs 86.7%), hulls lost per round (2.33 vs 3.03) and final
confidence (79 vs 83) all land inside tolerance. **This is not validation.** With
the engagement probes in the state above, the two sides reach similar outcomes
through different play: the human runs a 40-hull convoy against a 1196-budget
enemy that has climbed to boarding; the bots run a 31-hull convoy against a
667-budget enemy that never gets there. Read agreement on an outcome probe as
meaningful only once the engagement probes under it match.
