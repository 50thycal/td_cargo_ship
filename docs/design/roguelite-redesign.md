# Roguelite Redesign

## Status

Living design document for the roguelite progression redesign. This document will be updated as design decisions are made.

## Design Workflow

- One design initiative uses one dedicated design branch.
- That branch has one living draft pull request.
- Related design decisions are added to the same branch and PR over time.
- Separate design initiatives should use separate branches and draft PRs.
- Implementation work should reference the finalized design PR rather than relying on scattered chat history.

## Vision

Transform the game from a linear research-and-economy progression into a roguelite where the player earns technology by recovering enemy wreckage during combat.

The primary progression should come from capturing enemy technology, not simply earning money.

## Core Gameplay Loop

1. Defend the convoy.
2. Enemy weapons and attack objects are destroyed.
3. Some destroyed threats leave recoverable wreckage.
4. Escorts can leave formation to recover the wreckage.
5. Recovery contributes toward post-mission technology rewards.
6. The mission ends.
7. The player chooses one technology from several offered.
8. The fleet is retrofitted and resupplied.
9. The next mission begins.

## Intel Recovery

- Destroyed enemy missiles, mines, torpedoes, and similar attack objects have a chance to leave recoverable wreckage.
- Wreckage appears as a small search area in the ocean.
- An escort must remain inside the area for approximately 2–3 seconds.
- A visible circular progress indicator should show recovery progress.
- Leaving the area before completion cancels the recovery attempt.
- Successful recovery increases the mission's technology reward value.
- Recovered wreckage should be reflected in a visible HUD counter.
- The recovery area disappears after collection.

### Design Goal

Recovery should create a tactical tradeoff between convoy protection and technological progression.

The player may need to decide whether to keep an escort in formation or expose it by sending it toward uncertain waters to recover wreckage.

## Technology Rewards

Technology rewards replace the current research tree as the primary progression interface.

After each mission:

- The player is presented with two or three upgrade choices.
- Better recovery performance can result in additional choices.
- Better recovery performance can improve reward quality and rarity.
- Rewards should come from the current tech-tree nodes, tactics, and other progression items where appropriate.

Reward generation should be weighted by:

- Current fleet composition.
- Enemy threats encountered during recent missions.
- Technologies the player lacks.
- Existing upgrade branches and prior choices.

Example: If torpedoes have appeared repeatedly and the player has no counter, the reward system should increase the probability of offering an entry-level torpedo detection or interception option.

The system should assist a struggling player without fully removing randomness or making every counter guaranteed.

## Upgrade Categories

### Fleet Doctrines

Fleet-wide improvements that activate immediately after selection.

Examples:

- Faster reloads.
- Improved crew efficiency.
- Better radar processing.
- Faster repairs.
- Passive fleet bonuses.

These do not require a separate cash purchase after being unlocked.

### Equipment Technologies

Technologies that unlock hardware the player may purchase and install.

Examples:

- Sonar.
- CIWS.
- MCM drones.
- Torpedo decoys.
- Missile and gun upgrades.

Unlocking the technology makes it available to the fleet but does not automatically install it.

## Fleet and Escort Philosophy

Technology belongs to the fleet rather than to the escort that recovered it.

Once unlocked, equipment may be installed on any eligible escort or cargo ship through the loadout and preparation systems.

Each escort still develops an individual identity because:

- Installed equipment is purchased separately.
- Equipment loadouts differ by ship.
- The player may invest heavily in specific escorts.
- Losing a highly developed escort should carry meaningful risk.

This creates a reason not to use the most valuable escort for every dangerous recovery attempt.

## Role of Cash

Cash remains the operational logistics currency.

Cash is used for:

- Installing unlocked equipment.
- Purchasing munitions.
- Repairing damaged ships.
- Replacing or purchasing escorts.
- Replacing or purchasing cargo ships.
- Other fleet preparation costs to be balanced later.

This creates a clear split:

- Intel and wreckage unlock knowledge.
- Cash purchases and sustains hardware.

## Campaign Structure

The current preferred direction is approximately ten operational regions or theaters.

Each region gradually introduces new strategic challenges, such as:

- Mines.
- Fast attack boats.
- Cruise missiles.
- Submarines.
- Torpedoes.
- Combined attacks.

The regions act primarily as pacing and teaching structures rather than as isolated balance environments.

A player must reach a defined completion watermark, currently envisioned as approximately round 20, to complete the active region and permanently unlock the next region.

The final region unlocks the full threat roster. From that point onward, the player may continue through escalating tiers using increasingly difficult combinations, with the goal of surviving as long as possible.

The exact number of regions, completion threshold, and final-region tier structure remain open for later refinement.

## Region Design Philosophy

Regions should not rebalance individual units or equipment.

An attack boat, mine, missile, escort weapon, or other game object should retain the same core balance values regardless of region.

Regions instead modify:

- Which enemy types are available.
- Encounter composition.
- Threat budget.
- Frequency and combination of threats.
- Environmental conditions, if added later.

This avoids maintaining separate equipment and enemy balance tables for every region.

Each region should emphasize a newly introduced primary challenge while continuing to use previously introduced systems. For example, a later region may introduce attack boats while retaining mines and missile threats from earlier regions.

## Threat Budget

Difficulty should increase primarily through a threat-budget system.

Each enemy or hazard receives a threat cost. The mission generator spends the available budget using only the threats permitted in the current region.

Difficulty can increase by:

- Increasing the available threat budget.
- Introducing additional enemy types.
- Combining threats in new ways.
- Changing timing, spacing, or attack patterns.

Difficulty should generally not increase by repeatedly inflating enemy health or damage.

## Region Runs and Reset Rules

Each region is an independent roguelite campaign.

A typical region structure is:

1. Begin the region at round 1 with a region-specific starting state.
2. Build the fleet during the run through cash, recovered technology, equipment purchases, and doctrines.
3. Continue until the region completion watermark is reached or the run is lost.
4. Completing the region permanently unlocks the next region.
5. Losing restarts the same region at round 1.

If a player reaches round 10 of Region 8 and loses, the next attempt begins at Region 8, round 1. The player does not return to Region 7 or Region 1.

### What Resets

The following are temporary to the active region run and are lost when the run ends, whether through defeat or region completion:

- Cash.
- Current fleet composition.
- Purchased and installed equipment.
- Ammunition and other consumables.
- Repairs and temporary operational investments.
- Technologies unlocked during the region.
- Intel or wreckage progression collected during the region.
- Current round progress within the region.

Technology and equipment unlocked in one region do not carry into the next region. The player must build a new technology path during every regional run.

This reset is intentional. Familiarity and player knowledge carry forward, but the in-run build does not.

### What Persists

The following persist across defeats and regional transitions:

- Permanently unlocked regions.
- Commander Experience.
- Unlocked Commander Abilities.
- Statistics, achievements, and cosmetic progression if added later.

Commander progression is currently the only gameplay-affecting progression intended to persist across all regions.

## Commander Progression

### Commander Experience

Commander Experience is the permanent progression resource earned through play and region completion.

Potential sources include:

- Completing a region.
- Reaching significant round milestones.
- Completing difficult objectives.
- Performance-based awards to be defined later.

The exact earning rate remains open for balancing. One possible starting model is awarding a fixed amount, such as five Commander Experience points, for completing a region.

### Commander Abilities

Commander Experience unlocks Commander Abilities. These are optional, swappable abilities selected before beginning a regional run.

Commander Abilities should provide bounded strategic advantages rather than endlessly accumulating permanent raw power.

Examples:

- Fleet accuracy increased by 5%.
- Repairs cost 10% less.
- Enemy wreckage has a slightly higher drop chance.
- Escorts recover wreckage faster.
- The fleet begins with additional operational cash.
- Ammunition purchases are slightly cheaper.

The player equips only a limited loadout of Commander Abilities for a run.

Current working model:

- Approximately three ability slots.
- Approximately 25 total loadout points.
- Each ability has a point cost based on strength.
- The player may freely swap unlocked abilities between regional attempts.
- The number of slots or available loadout points may scale through progression, but should remain capped.

Example:

- Veteran Gunnery: costs 8 points and grants +5% fleet accuracy.
- Efficient Logistics: costs 6 points and reduces repair costs.
- Salvage Specialist: costs 7 points and improves wreckage recovery.

The player cannot equip every unlocked benefit at once. The system should encourage deliberate pre-run builds rather than passive, permanent stat accumulation.

### Design Goal

Commander progression should:

- Make losses feel productive without eliminating the importance of a fresh run.
- Give experienced players more strategic starting options.
- Allow different pre-run playstyles.
- Preserve the tension and balance of early regional rounds.
- Avoid turning playtime alone into unlimited fleet power.

## Progression Layers

The game now has three distinct progression layers:

### Permanent Campaign Progression

- Region unlocks.
- Commander Experience.
- Commander Abilities.

### Pre-Run Loadout

- Selected Commander Abilities.
- Limited ability slots and point budget.
- Region-specific starting fleet and resources.

### Temporary Region-Run Progression

- Fleet composition.
- Cash.
- Technology choices.
- Installed equipment.
- Fleet doctrines.
- Intel and wreckage recovery.
- Round progress.

Keeping these layers separate is a core architectural goal.

## Guiding Principle

> Balance the building blocks, not the campaign.

Campaign difficulty should emerge from encounter composition and escalating combinations rather than region-specific versions of every enemy and piece of equipment.

## Balance Notes

- Intel drop rates will require tuning so players receive meaningful choices without rapidly reaching rare upgrades.
- The relationship between recovered wreckage, number of choices, and reward rarity remains to be defined.
- Equipment prices, doctrine strength, munitions costs, repairs, and fleet replacement costs will be balanced later.
- Adaptive reward weighting should help players find counters without eliminating the consequences of earlier choices.
- Each region requires a defined starting fleet and resource package appropriate for its threat roster.
- Commander Ability bonuses must remain bounded so they create build variety without trivializing early rounds.
- The exact Commander Experience economy, ability costs, slot count, and point cap require future balancing.

## Open Design Questions

### Next Topic: Regional Starting State

When beginning a region for the first time or restarting after defeat:

- What fleet does the player begin with?
- Does every region use the same basic starter fleet?
- Are later-region starter fleets tailored to the threats introduced there?
- How much starting cash and ammunition is provided?
- Are any baseline technologies automatically available before the first mission?

This is the next design topic to resolve.