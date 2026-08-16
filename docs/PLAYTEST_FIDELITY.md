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

# 3. …and against the single persona that models that player's build
npm run fidelity -- --human straitwatchlog.json --sweep playtest-out --persona automation
```

Step 3 is not optional polish. **Engagement and tempo probes measure *style*,
and the bot side is a deliberate spread of styles** — comparing one human
against the average of twelve builds asks a question with no answer. Read style
probes per-persona and economy/outcome probes against the whole sweep, where
seed variance averages out.

Banding is on the **log ratio**, so "half as much" and "twice as much" are the
same distance — a linear band around 1.0 cannot report "the bots do this 100×
less" as anything worse than a shrug.

The procedure for acting on it — including which gaps *should not* be closed —
is the **`playtest-fidelity`** skill.

## The four buckets

Every gap triages into exactly one, and only two of them are harness work.

| Bucket | Meaning | Action |
| --- | --- | --- |
| **A — Setup mismatch** | Different region, commander loadout, starting state or completion round | Always close. Nothing downstream is comparable until it is. |
| **B — Missing capability** | The bot cannot issue the command at all (`TransitCommand` case with no persona branch) | Close in `personas.ts`. Biggest and quietest measurement errors live here. |
| **C — Deliberate idealization** | The bot *can* do it and does it better than any human (perfect dedup, tick-rate reaction) | Optional. If accepted, set `accepted` on the probe with a **RECORDED BIAS** line — the report then lists it separately instead of parking it atop the work list forever. |
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
| 2026-08-07 | `straitwatchlog_r9` (pirateNarrows, steadyHands+salvageTeams) | 9 | **SETUP MISMATCH (5)** — 6/20 probes match | — (baseline) | — |
| 2026-08-07 | same log, after the harness fixes below | 9 | **6/20 match, 9 drift, 4 open** (whole sweep)<br>**11/20 match, 5 drift, 2 open** (vs `automation`) | A ×4, B ×5 | C ×1, D ×2 |

---

## Closed in the 2026-08-07 harness pass

### A — Run setup (`run.ts`, `ablate.ts`)

The sweep ran `newCampaign()`, which is `newRegionalRun(seed, 'openSeas', [])`.
`openSeas` is the **dev proving ground** — excluded from `REGION_ORDER`, so no
player can ever select it.

Now: `--region`, defaulting to `pirateNarrows`; per-persona Commander loadouts
validated against `COMMANDER.abilitySlots`/`loadoutPoints` at startup (rejected,
never silently clamped); and the round cap defaults to the region's own
completion watermark instead of an arbitrary 15.

That also required teaching the analyzer that `campaignOver` no longer means
defeat — clearing a region sets it too, and the old three-way mapping scored
every **win** as a `confidence-collapse`.

| | Before | After |
| --- | --- | --- |
| Region | `openSeas` (7 branches, 0 escorts, endless) | `pirateNarrows` (3 branches, 1 escort, completes R10) |
| Loss mix | missiles 57% / mines 28% / boats 8% | boats 56% / missiles 25% / mines 15% |
| Boarding attempts | **0** in 524 rounds | 60 in 583 rounds |

The human's mix was boats 52% / mines 48% / missiles 5%. The seven-branch roster
was splitting the same budget so many ways that the attack-boat nodes were never
reached.

### B — Missing capabilities (`personas.ts`)

`decideCommands` implemented `intercept`, `sweepMine`, `depthCharge` and
`ability`. The `TransitCommand` union also carries `moveEscort`, `engageBoat` and
`counterBattery`, which no persona had ever issued.

- **`moveEscort` — the recovery loop was dead.** Personas now detach escorts to
  work wreckage and crews, keeping `screenReserve` hulls on the convoy and only
  taking a job they can *finish* before the field sinks (`reachableInTime`) —
  so salvage costs escort time instead of being free value.
- **`engageBoat` / `counterBattery`** are now issued by hand, not just through
  their automation tactics. Deck-gun kills went 0 → 38 across the sweep.
- **`intercept: 'sparing'`** defers to the automation until a threat is inside
  ~7s of impact, so auto-fire technology is worth something to a bot.
- **`adaptFormation`** re-picks the formation each prep phase from the last
  round's loss mix, using the formation table's own trade-offs.
- **`automation` persona** added, modelled on the hand-played build.

| | Before | After (sweep) | After (`automation`) | Human |
| --- | --- | --- | --- | --- |
| Wreckage recovered | 5/2062 (**0.2%**) | 1249/2388 (52.3%) | 69.4% | 81.5% |
| Survivors rescued | 3/1589 (**0.2%**) | 996/2225 (44.8%) | 53.8% | 80.0% |
| Drafts with 3 options | 1/508 (**0.2%**) | 277/572 (48.4%) | 58.3% | 75.0% |
| Manual shot share | 83.1% | 70.3% | 38.7% | 31.6% |
| Warthog sorties/round | 0.18 | 0.24 | 0.67 | 0.67 |
| Formation changes/campaign | **0** | 1.47 | 4.00 | 3.00 |

---

## Kept current — 2026-08-14 batch (`personas.ts`)

Two game changes in the same batch would have silently outdated the harness,
so the personas learned them immediately rather than waiting for a fidelity
diff to flag the decay:

- **Deck-gun shells became a purchase.** Every persona that fits escort
  modules now carries a `gunAmmo` intent (self-gating on actually owning a
  gun), so the sweep never measures an armed flotilla that cannot shoot.
- **Engage-boat is a pursuit order now.** `engageBoats` policies issue the
  order out to 2.5× gun range — mirroring the player's new chase-to-engage —
  instead of only when a boat happened to wander into reach.

## Closed — 2026-08-16: the smoke branch was never measured

Found while checking whether reworking defensive smoke had moved the balance:
the sweep reported the change as *exactly nil*, which for a mechanic whose
covered area grew about eightfold is not a result, it is a broken instrument.

Measured: across 72 campaigns the bots spent **$0** on smoke canisters and laid
**14** charges in total, all of them from ordnance draft cards. No persona had a
`{kind:'ability', id:'smoke'}` buy intent at all, so the only smoke in the whole
sweep was smoke somebody was given. Every previous conclusion about this
branch's worth was drawn from a sample of essentially zero.

Two fixes, both in `personas.ts`:

- Personas that already stock a consumable now stock smoke too (8 intents).
- Consumable purchases are gated on the persona's transit policy actually
  USING that ability, the same way drone and self-defense munitions are gated
  on owning the launcher — so no bot stockpiles ordnance it will never fire.

After: 307 charges laid across 41 campaigns, $21,980 spent — and the branch
turns out to be a real economic choice rather than a free win. It carried
`mine-warfare` from 17% to 83% completion and cost `balanced` and
`technologist` outright, because the money to buy it comes out of hulls.
Sweep-wide the north star's Balance signal rose 43% → 51%.

**The general lesson, and the one worth re-reading:** a sweep that reports *no
change* from a large mechanical change is reporting on the harness, not on the
game. Check that the bots exercise a branch before believing any number about
it — including a number that says nothing happened.

## Open and accepted (as of the second row)

### Still open (worth closing)

1. **Boarding attempts 0.10/round vs 0.67.** Better than zero, but the human's
   figure comes from one catastrophic round (six captures) and is a weak
   baseline. Re-measure against a log that meets boarding more than once before
   tuning anything on it.
2. **Enemy budget in the final round, 679 vs 1196.** The anti-snowball response
   is *working on both sides*: the human delivered 92.7% and their enemy armed
   faster; the bots deliver 84.2% and lose 3.9 hulls a round, so theirs stays
   poorer. This is a skill gap showing up in the economy, not a harness bug —
   but it means the sweep never stresses the top of the anti-snowball curve.
   Closing it needs a stronger persona, not a code change.
3. **Recovery rate still ~0.6–0.85× the human's.** The escort-job heuristic
   takes one job at a time and never re-prioritises. Diminishing returns.

### Accepted — bucket C (bias recorded)

- **The bots waste no interceptors.** Human duplicate-shot rate **17.7%** (51 of
  288 shots); bots **0.0%**, because `decideCommands` filters on
  `claimedByInterceptor`. Modelling human misfires means building a bot that
  plays badly on purpose, with the amount of badness a free parameter fitted to
  one log — that measures noise. **RECORDED BIAS: the sweep's ammunition economy
  is roughly a fifth cheaper than a real player's.** Never conclude "ammunition
  is affordable" from a sweep alone. The probe carries this text so the report
  reprints it every run.
- **`duplicateShotsAvoided` is uninterpretable in sweep logs** (471,899 across
  66 campaigns — a bot re-offers an intercept every tick and each rejection
  increments it). Do not compare that field across the two sides.

### Accepted — bucket D (game, not harness)

- **Smoke was researched, bought and never used.** The player took
  `smokeScreen.base` in the round-6 draft, spent $160 on it in round 7, then
  laid **zero clouds** in nine rounds. A bought ability that is never used once
  is a discoverability problem, and the fix belongs in the game.
- **Convoy capacity 40 vs ~30, launched 28/round vs 23.7.** The human grew the
  convoy harder than any persona does. `SEESAW.md` already records convoy size
  as the strongest defensive stat in the game, so this is a strategy the bots
  under-weight rather than a capability they lack.

---

## A balance finding this pass exposed (NOT tuned here)

With the harness fixed, **attack boats now cause 56% of all branch-attributable
losses** across the sweep (1450 of 2503), and the oscillation signal's pass rate
fell from 58% to 28%. That is the seesaw locking on one branch — precisely the
`SEESAW.md` failure mode "same loss-cause #1 for 4+ rounds".

It is not a regression. The old number was measured in a region that split the
enemy's budget seven ways and never let boats reach their expensive nodes; this
is the first honest reading of `pirateNarrows`.

**Deliberately not fixed in the same change as the harness**, per the one-change
rule above — a balance fix landing here would make the next sweep's movement
unattributable. It needs its own change, its own before/after, and a re-read
through `seesaw-eval`.
