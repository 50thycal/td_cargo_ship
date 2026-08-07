# Straitwatch — Automated Playtesting

Playtesting splits into two jobs, and only one of them can be automated well.

| | What it answers | How |
| --- | --- | --- |
| **Statistical** | Is the *balance and economy* working across many builds and seeds? | `npm run playtest` — this document |
| **Qualitative** | Does it *feel* good? Is the UI readable? | A human (or a browser session) playing it |

The headless runner exists for the first. It cannot tell you whether a screen is
confusing or a fight is fun — it has no eyes and no taste. Do not use it to
answer UX questions.

There is a third question underneath both, and it is the one that decays
silently: **is the sweep measuring the same game the playtester is playing?**
Every number below is conditional on the bots exercising the same systems a
human does, and that stops being true the moment a mechanic is added to the game
and not to the personas. `npm run fidelity` measures that gap against a
hand-played log — see [`PLAYTEST_FIDELITY.md`](./PLAYTEST_FIDELITY.md). Check it
before trusting a sweep number that a human session disagrees with.

## Running it

```bash
npm run playtest                              # all personas × 8 seeds, pirateNarrows
npm run playtest -- --seeds 24                # tighter averages
npm run playtest -- --rounds 9                # match a hand-played log's length
npm run playtest -- --region homeStrait       # the opening ladder region
npm run playtest -- --region openSeas --rounds 15   # dev proving ground, all 7 branches
npm run playtest -- --personas turtle,economist
npm run playtest -- --no-logs                 # summary only, no per-campaign JSON
```

A full default sweep is 72 campaigns and takes about three minutes — fast enough
to run after any tuning change. The region is printed at the top of the report,
because reading a sweep without knowing which one it played is how the harness
drifted away from the shipping game unnoticed in the first place.

## What it produces

- `playtest-out/<persona>-<seed>.json` — one **`TelemetryExport`** per campaign,
  identical in shape to the in-game *Download game log* export. Hand any single
  one to the **`seesaw-eval`** skill for a full hand-quality read of that run.
- `playtest-out/summary.json` — the machine-readable aggregate.
- A console report: per-persona table, north-star signal pass rates, how
  campaigns ended, losses by enemy branch, and plain-language findings.

## The personas

Each persona is a complete playing style — transit tactics, procurement list,
research order and formation. They exist to sweep the **strategy space**: the
point is not that any one bot plays optimally, but that between them they
exercise the builds a real player might try.

| Persona | Thesis being tested |
| --- | --- |
| `balanced` | A generalist spreading investment across launchers, sensors and hull |
| `turtle` | Survivability-first — does passive mitigation beat active defense? |
| `interceptor-rush` | All-in missile defense — what does ignoring mines cost? |
| `sensor-net` | Detection-first — is information worth buying before shooters? |
| `mine-warfare` | Mine specialist — is the mine counter-chain worth its price? |
| `economist` | Greed test — buy hulls and capacity, skimp on defense. Should be punished. |
| `automation` | Drafts auto-fire first and leans on it — hand-fires only what the automation would miss. Modelled on a hand-played log. |
| `afk` | Control case. Buys nothing, fires nothing. The floor every real build must beat. |

Every persona drives the **real** campaign and transit APIs (`buyModule`,
`startResearch`, `stepTransit`, …). A bot can only do what a player could —
research gates, slot limits, ammunition and range checks all apply — so a sweep
is a test of the actual game, not of a parallel model of it.

## How results are scored

Campaigns are scored against the three north-star signals in
[`SEESAW.md`](./SEESAW.md), using the same rubric the `seesaw-eval` skill applies
by hand, so an automated sweep and a hand-read log agree:

- **Oscillation** — does the #1 loss-cause branch rotate, or is one branch #1 for
  4+ straight rounds? (Read this alongside the measured `ROI response rate`.
  The loss-mix view only ever sees branches that *sink things*, so the two
  support branches are invisible to it however hard the enemy leans on them;
  the allocator metric sees all seven.)
- **Balance** — does delivery oscillate in the ~60–90% band and confidence
  wobble, rather than pinning high or collapsing?
- **Scarcity** — is the player pressured every round but not overwhelmed?

Each campaign also gets an **end reason**, which is deliberately kept separate
from the verdict:

- `region-complete` — cleared the region's completion watermark. **A win**, and
  the outcome a real run is played for
- `round-cap` — reached `--rounds` intact, which only means the sweep stopped asking
- `confidence-collapse` — the consortium withdrew support
- `fleet-wiped` — attrition took every hull and the player could not replace them
- `quota-failed` — the delivery quota went unmet

The first two both count as coming through. Note that `campaignOver` is set by a
**win** as well as a defeat, so anything reading that flag directly has to check
`runOutcome` — conflating them scored every successful run as a collapse.

A run that traded blows for ten rounds and *then* went under is a hard campaign,
not a jammed seesaw — the verdict logic reflects that, and only calls a loss
"stuck-cold" when delivery was genuinely failing near the end.

## Known limits (read before trusting a number)

- **The enemy economy IS instrumented** (budget, per-branch spend, ROI, scrap),
  so the report scores the allocator from measured data: `ROI response rate`
  (share of below-average-ROI branches whose funding was cut the next round),
  `top-spend pivots`, and `budget scrapped`. Older logs without those fields
  fall back to inference, and the report says which applies.
- **All seven enemy branches exist, but a region fields only some of them.**
  Missiles, mines, torpedoes, attack boats, artillery, smoke and electronic
  attack are all implemented. `pirateNarrows` permits three of them by design,
  so the oscillation signal there is **roster-limited, not content-limited** —
  the enemy cannot rotate through branches the region withholds, and reading
  that as a broken allocator would be wrong. The report derives the distinction
  from the region and the catalogue rather than hardcoding either, and names the
  counters a given region leaves unexercised.
- **The harness systematically under-measures the support branches.** Smoke and
  electronic attack shrink the player's *reaction window*, and a scripted bot
  has no reaction window to shrink — it re-evaluates every tick and simply
  fires a moment later. Screening smoke measures as nearly free against a bot
  while being one of the more disorienting things a human faces. Their sweep
  ROI is therefore a **floor**, not a valuation; price them from it only in the
  direction of "is this branch dead", never "is this branch strong". This is
  the clearest case in the game of a number the headless harness cannot be
  asked for — it needs a hand-played session.
- **A persona per branch.** `asw` (hydrophone + depth charges + sonar pings) is
  the underwater specialist, `gunboat` (deck guns + anti-boarding) the
  anti-surface one and `shore-battery` (counter-battery) the anti-artillery
  one, mirroring `mine-warfare` and `interceptor-rush`. A specialist collapsing is not automatically a bug: it is
  evidence about which branch is carrying the damage. Against seven enemy
  branches a mono-build covers a seventh of the threat space, so **expect them
  to fail** — the question a specialist answers is "does this counter work in
  its own domain", not "is this a viable way to play".
- **A persona's research list is a wish, not a plan.** Research runs one project
  at a time and a campaign completes roughly thirteen, so anything past that in
  the list never happens. Order by breadth if the persona is meant to represent
  breadth: `balanced` was ordered by depth and consequently never researched
  deck guns or counter-battery in any campaign, which made every sweep that
  used it a measurement of narrow coverage wearing a generalist's label. If you
  add to a list, check what actually completes.
- **Bots are heuristics.** They do not learn, do not read the AAR, and will not
  find the clever line a human would. Treat persona scores as a comparison
  *between builds under a fixed policy*, not as a skill ceiling.
- **The sweep plays a region, and which one changes everything.** It defaults to
  `pirateNarrows` — three branches, one free escort, completion at round 10 —
  because that is a region a player can actually select. `--region openSeas` is
  the dev proving ground (all seven branches, no starting escort, endless); use
  it for whole-arsenal coverage, never for a balance read. The wider roster
  splits the same budget more ways, so branches debut later and weaker than a
  player meets them: the sweep measured **zero boarding attempts in 524 rounds**
  of `openSeas` against 60 in 583 rounds of `pirateNarrows`.
- **Round cap defaults to the region's completion watermark.** Playing past it
  measures rounds no player ever reaches. Pass `--rounds N` to match a
  hand-played log instead.
- **`region-complete` is a WIN, not a stop.** A cleared region sets
  `campaignOver` exactly as a defeat does; the analyzer distinguishes them, and
  anything reading that flag directly must too.
- **The bots waste no interceptors.** `decideCommands` filters on
  `claimedByInterceptor`, so duplicate shots are 0% against a measured 17.7% for
  a human. The sweep's ammunition economy is roughly a fifth cheaper than a real
  player's — price ammunition with that in mind. This one is *accepted*, not
  fixed: modelling human misfires means a bot that plays badly on purpose.
- **The bots still under-grow the convoy** (capacity ~30 against a hand-played
  40) and recover less than a human does (52% of wreckage against 81%).

Every bullet here is a **measured** fidelity probe, tracked with its triage
bucket and current value in [`PLAYTEST_FIDELITY.md`](./PLAYTEST_FIDELITY.md).
