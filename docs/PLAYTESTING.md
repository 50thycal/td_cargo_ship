# Straitwatch — Automated Playtesting

Playtesting splits into two jobs, and only one of them can be automated well.

| | What it answers | How |
| --- | --- | --- |
| **Statistical** | Is the *balance and economy* working across many builds and seeds? | `npm run playtest` — this document |
| **Qualitative** | Does it *feel* good? Is the UI readable? | A human (or a browser session) playing it |

The headless runner exists for the first. It cannot tell you whether a screen is
confusing or a fight is fun — it has no eyes and no taste. Do not use it to
answer UX questions.

## Running it

```bash
npm run playtest                              # all personas × 8 seeds × 15 rounds
npm run playtest -- --seeds 24                # tighter averages
npm run playtest -- --rounds 25               # longer campaigns
npm run playtest -- --personas turtle,economist
npm run playtest -- --no-logs                 # summary only, no per-campaign JSON
```

A full default sweep is 56 campaigns and takes about 90 seconds — fast enough to
run after any tuning change.

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
  4+ straight rounds? (Read this alongside the measured `ROI response rate`: the
  loss-mix view is content-limited while only two branches exist, whereas the
  allocator metric is not.)
- **Balance** — does delivery oscillate in the ~60–90% band and confidence
  wobble, rather than pinning high or collapsing?
- **Scarcity** — is the player pressured every round but not overwhelmed?

Each campaign also gets an **end reason**, which is deliberately kept separate
from the verdict:

- `round-cap` — reached the end intact (the only outcome that counts as survival)
- `confidence-collapse` — the consortium withdrew support
- `fleet-wiped` — attrition took every hull and the player could not replace them

A run that traded blows for ten rounds and *then* went under is a hard campaign,
not a jammed seesaw — the verdict logic reflects that, and only calls a loss
"stuck-cold" when delivery was genuinely failing near the end.

## Known limits (read before trusting a number)

- **The enemy economy IS instrumented** (budget, per-branch spend, ROI, scrap),
  so the report scores the allocator from measured data: `ROI response rate`
  (share of below-average-ROI branches whose funding was cut the next round),
  `top-spend pivots`, and `budget scrapped`. Older logs without those fields
  fall back to inference, and the report says which applies.
- **Only two enemy branches exist.** Missiles and mines are implemented;
  torpedoes, boats, artillery, smoke and electronic attack are designed but not
  fielded. The oscillation signal is therefore **content-limited** — the enemy
  cannot rotate through branches it cannot field, and a low oscillation score
  today is not by itself evidence of a broken allocator.
- **Bots are heuristics.** They do not learn, do not read the AAR, and will not
  find the clever line a human would. Treat persona scores as a comparison
  *between builds under a fixed policy*, not as a skill ceiling.
