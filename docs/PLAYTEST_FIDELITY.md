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
| 2026-08-16 | `straitwatchlog_r8` (pirateNarrows, **bare** commander, lost on quota R8) | 8 | before: **10/21 match, 6 drift, 3 open**<br>after: **12/21 match, 5 drift, 3 open** | B ×1 (whole draft now spent) + 2 dead probes replaced | C ×1, D ×3 |

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

## Kept current — 2026-08-16: two new systems, wired before they shipped

The smoke lesson above cost a whole sweep to learn, so this batch wired the
harness at the same time as the game rather than afterwards:

- **Escort Legacies** — every persona now carries a legacy loadout
  (`Persona.legacies`), validated at startup by `legacyLoadoutError` exactly as
  the Commander loadout is. A sweep in which nobody equips a legacy cannot
  measure a change to one. The twelve loadouts are spread so each of the eight
  legacies is carried by at least two personas — `veteranHelm` 8, `gunneryDrill`
  5, `minePlating` and `standingContract` 4, `rescueRig` and `requisitionOrder`
  3, `damageControl` and `rapidRearm` 2. Two personas is the resolution floor:
  read nothing into a 1–3% move on either of the last pair.
- **Scoped repairs** — `{kind:'repair'}` grew `scope` and `partial`, and three
  personas (`turtle`, `gunboat`, `economist`) were given real repair doctrines
  rather than the one-button default, so the split is exercised in both
  directions.

Fixed while wiring the second one: the repair intent tested `repairCost(c) > 0`
to decide whether there was work to do. With the **Forward Repair Yard** —
which patches warships for nothing — a bot that owned the yard would never take
the free repair it had paid for, because the price of that work is zero. The
test is now on DAMAGE, not price. A cost of zero means "free", not "nothing to
do", and any is-there-work check written against a price will get that wrong
the moment something in the game becomes free.

## Kept current — 2026-08-17: the A-10 gate, and a range nobody rescaled

- **Sorties stack now**, so the persona's Warthog intent no longer waits for
  the flight already up (`t.time >= t.warthogActiveUntil` is gone with the
  field). Only its own 20-second re-call spacing remains, standing in for a
  human not spending every charge in the opening half-minute.
- **Escort automatic engagement was measured, not assumed.** The player
  reported it "does not seem to be working"; the sweep could not have told
  anyone either way, because `autoShots` is one counter shared by escorts and
  shore batteries. Isolating it needed a throwaway probe that silenced the
  batteries and varied the radius alone — see PLAYER_COUNTERS for the numbers.

**The lesson worth keeping:** a counter shared between two platforms cannot
answer "is THIS platform's automation working". The telemetry had 235 automatic
shots a round and looked healthy; nearly all of them were the batteries'. Split
a counter, or be ready to write a probe every time somebody asks.

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


---

## 2026-08-16 — the recovery loop's reward was going in the bin

Read against a hand-played 8-round `pirateNarrows` run that lost on quota.

### B — The harness took one draft pick per round; the draft grants up to three

`generateDraft` awards `DRAFT.basePicks` plus one more per
`DRAFT.unitsPerExtraPick` wreckage recovered, capped at `DRAFT.maxPicks` —
**recovery buys PICKS first and cards second**. The persona's `research()` took
exactly one option and returned, so the runner closed the round with
`pendingDraft` still holding unspent picks, and `resolveTransit` overwrote it
with a fresh draft the next round.

The bots were doing the salvage work — 53.7% of wreckage recovered against the
human's 61.5% — and then discarding what it bought.

| | Before | After | Human |
| --- | --- | --- | --- |
| Draft picks taken per round | 0.98 | 1.20 | 1.38 |
| Technologies completed per round | 0.90 | 1.10 | 1.25 |

`research()` now spends the whole draft and returns every pick. Pinned by
`tests/personas.test.ts` → *the whole draft gets spent*, which asserts the run
actually earned a multi-pick draft first — the same test against the old
one-pick behaviour would otherwise have passed happily.

### Two probes had gone dead and had to be replaced

Both were reporting `MATCH` over the bug above.

- **`draftWidth` was saturated.** It measured "share of drafts offering 3+
  options", which was meaningful when `DRAFT.baseChoices` was 2. The game raised
  the floor to 3, so both sides pinned at 100% while the human was offered
  **4.91** options a draft against the bots' **4.09**. Now it measures options
  per draft. *A probe whose threshold sits below the game's own floor measures
  nothing — prefer a magnitude over a threshold.*
- **Nothing counted picks at all**, which is why an abandoned pick was invisible.
  Added `draftPicksPerRound`.

---

## Open and accepted (2026-08-16)

### Still open

1. ~~**Manual shot share 89.8% vs 26.1%**~~ — **fixed at the source, in the
   game, not the harness.** This was correctly diagnosed as a draft-pool
   question, not a persona defect: when an interceptor auto-fire node WAS
   offered, `automation` took it 6/6 times, but auto nodes were offered at only
   0.17 per bot draft against a hand-played 0.55. Root cause: `weighCandidate`
   priced `kind: 'automation'` tactics through the same coverage-gap multiplier
   as accuracy/reload upgrades, so a branch getting GOOD at its job (which is
   exactly when hands-off engagement is worth having) also got its automation
   nodes priced down with everything else. Added `DRAFT.automationTacticMult`
   (1.75×, applied flat, outside the coverage-gap system) in `src/sim/draft.ts`
   — pinned by the `AUTOMATION:` test in `tests/roguelite.test.ts`. Measured on
   the `automation` persona specifically (this is a style probe — read it
   per-persona, not on the whole sweep, same rule as #2 below): manual share
   82.1% → **64.6%**, auto nodes/campaign 1.00 → **1.17**, zero-auto-shot
   campaigns 3/6 → **2/6**. Still short of the human's 26.1% — six seeds is a
   small sample and this is a genuine balance dial, not a bug fix, so further
   tuning belongs in its own change with its own before/after, not folded into
   this one.
2. **Warthog sorties 0.23/round vs 0.88** on the whole sweep — but **0.72
   (MATCH)** against `automation` alone. This is the aggregate-vs-persona
   artefact the `--persona` flag exists for; read it there.
3. **Escort-seconds on recovery, 25 vs 44 per round.** The one-job-at-a-time
   escort heuristic again. Diminishing returns.

### Accepted — bucket C

- **Duplicate shots** unchanged and still accepted, bias recorded on the probe.
- **`duplicateShotsAvoided` now appears in HUMAN logs too** (103,200 in this
  one). It counts per-tick re-offer rejections, not player decisions. It was
  already uninterpretable across the two sides; it is now uninterpretable within
  either. Do not use this field.

### Accepted — bucket D (game, not harness), one now fixed

- ~~**Smoke was researched, upgraded and never used — again.**~~ **Root-caused
  and fixed.** The player took `smokeScreen.expandedCoverage`, spent $140, and
  laid zero clouds in eight rounds — the *second consecutive log* with that
  exact shape. Checked both possible causes directly (a real dev-mode session
  via Playwright, not guesswork): the sim-side placement path and the button's
  visibility logic were both correct — `charges.smoke.available` derives
  straight from `smokeStock` and the button is never hidden once smoke is
  unlocked and stocked. The actual cause: ALL placeable abilities (warthog,
  scan, smoke, depth charges) live behind a collapsed "ACTIONS" drawer, closed
  by default, and the drawer's only "you have something in here" signal was its
  `title` attribute — a hover tooltip, which never fires on the touchscreen this
  game ships to. A player who never taps ACTIONS has no way to learn it holds
  anything, however much they've paid for. Fixed with a small amber dot on the
  ACTIONS key (`.has-charges`, `src/ui/style.css` + `src/ui/transitView.ts`),
  reusing the existing `pipPulse` "worth a look" language, lit whenever a
  placeable ability has spendable charges and hidden the instant the drawer is
  open (a reminder to open it, not a status light to keep watching).
  Verified end-to-end: armed SMOKE from the drawer, tapped the map, watched the
  charge count decrement and the sim accept the command.
- **Self-defense was drafted, equipped and never fed.** `selfDefense.base`
  researched, `module:cargo:selfDefense` drafted and fitted to the cargo
  class — and **zero** self-defense ammunition bought, so `pdKills` is 0. Same
  shape as the smoke finding: a counter acquired and left inert.
- **The player finished with 0 escorts; the bots keep 1.71.** Five escorts lost,
  four of them to mines. A strategy/luck difference, not a missing capability.
- **The player ran a bare Commander profile** (no abilities) while every persona
  commissions a loadout. Flagged as a setup mismatch, and correctly so — the
  bots get accuracy, salvage-rate and price bonuses this run did not have.

---

## 2026-08-29 — the ammunition ceiling the personas could not express

Triggered by a hand-played Missile Coast log whose author reported the missile
volume as *good* ("the missile pressure appears to be in a good place") and the
counterplay as unaffordable. The sweep did not agree, and this section is why.

### B — Missing capability: an ammunition intent that responds to the threat

Every persona named a **fixed** interceptor ceiling — `{ kind: 'ammo', upTo: N }`
with N between 18 and 70 — and topped back up to it forever. The enemy's volume
on that region climbs past 90 missiles a round; the bots simply declined to
answer it, and their ammunition spend sat at a flat ~20% of income all run.
The hand-played log shows the opposite behaviour: the player bought 65-75
rounds a round against 65-92 missiles, reading the after-action report and
stocking for what they had just been shown.

That gap is not a difference of style, it is the harness being unable to
express the decision under test. **An economy that cannot afford the answer and
a bot that never tries to buy it produce identical telemetry.** The sweep was
reporting "ammunition is 20% of income" for a price that could not be paid.

Added `perThreat` to the ammo intent (`tools/playtest/personas.ts`): the target
magazine becomes `max(upTo, lastRound.missilesSpawned × perThreat)`, so the
standing floor is a floor and the ceiling tracks the raid. Set per persona
according to how much the build cares about the air — 1.4 for
`interceptor-rush`, 1.0 for `balanced`/`turtle`/`technologist`, 0.7 for the
builds that are looking at the water, 0.5 for `economist` (the greed control).
It sits LAST in each buy list, so doctrine still gets first call on the money
and persona identity is unchanged.

Measured on Missile Coast, 66 campaigns, at the then-current price: interceptors
fired per campaign 184 → **260**, ammunition spend 20% → **29%** of income, and
campaigns reaching the region's final round 13 → **20**. The bots had been
under-buying, and closing that was worth six campaigns before a single balance
number moved.

### The balance defect it exposed (fixed in `tuning.ts`, not here)

With the harness able to buy, the arithmetic became legible. Against a
fully-researched defender, one interceptor per incoming missile across rounds
4-8 cost **139% of what those rounds earned**. See `ECONOMY.ammoCost` for the
bracket and the fix; the guard now lives in
`tests/interceptorEconomy.test.ts` so it cannot silently return.

### A methodology note worth keeping

The first draft of that guard played a campaign until it died and averaged the
ratio over the whole run — and **passed against the exact numbers it was
written to reject.** A bot with no purse dies at round 3, never reaches the
rounds where the enemy's budget curve has arrived, and an economy that is
catastrophic at round 8 reads as healthy averaged over three easy ones. Any
fixture measuring a LATE-game quantity has to be underwritten to survive to the
late game first. The bias direction is the same one this file records for the
sweep itself: a harness that cannot reach the failure cannot see it.

### Accepted — bucket C (bias unchanged, and load-bearing)

The recorded **"bots waste no interceptors"** bias did real work this pass and
should not be retired. Human duplicate-shot rate is 17.7%; bots' is 0.0%, so
the sweep understates the ammunition bill by about a fifth. Applied to the
bracket, that correction is what ruled out the arm one step cheaper than the
defect and selected the shipped price. This is the case the standing
instruction — *never conclude "ammunition is affordable" from a sweep alone* —
was written for.
