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

A player may need to reach a milestone, such as approximately round 20 or another defined operation threshold, to unlock the next region or tier.

The final region unlocks the full threat roster. From that point onward, the run continues in an endless mode where increasingly difficult combinations are generated and the goal is to survive as long as possible.

The exact number of regions, unlock threshold, and presentation remain open for later refinement.

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

## Threat Budget

Difficulty should increase primarily through a threat-budget system.

Each enemy or hazard receives a threat cost. The mission generator spends the available budget using only the threats permitted in the current region.

Difficulty can increase by:

- Increasing the available threat budget.
- Introducing additional enemy types.
- Combining threats in new ways.
- Changing timing, spacing, or attack patterns.

Difficulty should generally not increase by repeatedly inflating enemy health or damage.

## Guiding Principle

> Balance the building blocks, not the campaign.

Campaign difficulty should emerge from encounter composition and escalating combinations rather than region-specific versions of every enemy and piece of equipment.

## Balance Notes

- Intel drop rates will require tuning so players receive meaningful choices without rapidly reaching rare upgrades.
- The relationship between recovered wreckage, number of choices, and reward rarity remains to be defined.
- Equipment prices, doctrine strength, munitions costs, repairs, and fleet replacement costs will be balanced later.
- Adaptive reward weighting should help players find counters without eliminating the consequences of earlier choices.

## Open Design Questions

### Next Topic: Run Persistence

When a player loses a run:

- What is lost?
- What is retained?
- Do region unlocks persist?
- Do technology unlocks persist?
- Do ships, cash, doctrines, statistics, cosmetics, or starting options persist?
- What permanent progression exists between runs?

This is the next design topic to resolve.