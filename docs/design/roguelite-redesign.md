# Roguelite Redesign

## Status

Implementation-ready living design document for the roguelite progression redesign. Numerical balance remains intentionally deferred until the new game flow is playable.

## Design Workflow

- One design initiative uses one dedicated design branch.
- That branch has one living draft pull request.
- Related design decisions are added to the same branch and PR over time.
- Separate design initiatives should use separate branches and draft PRs.
- Implementation work should reference the finalized design PR rather than relying on scattered chat history.
- Implementation must begin from the current game code, including the individual-escort architecture merged in PR #28.

## Vision

Transform the game from a linear research-and-economy campaign into a sequence of independent regional roguelite runs where the player acquires technology by recovering enemy wreckage during combat.

The primary in-run progression should come from capturing enemy technology, making difficult tactical choices, and building a fleet that can survive the region. Permanent progression should provide bounded strategic options rather than unlimited raw power.

## Core Regional Loop

1. Select an unlocked region.
2. Equip a limited Commander Ability loadout.
3. Prepare the convoy and escort fleet.
4. Escort the convoy through transit.
5. Destroy enemy threats.
6. Recover enemy wreckage and rescue friendly crews when tactically possible.
7. Resolve deliveries, losses, quota progress, and confidence.
8. Review the After-Action Report.
9. Select one technology from a mandatory reward draft.
10. Purchase and install unlocked equipment.
11. Begin the next round.
12. Continue until the region is completed or the run is lost.

## Progression Architecture

The game has two separately persisted state layers and three distinct progression layers.

### Commander Profile

The Commander Profile persists across every attempt and region.

It contains:

- Commander Experience.
- Unlocked Commander Abilities.
- Equipped Commander Ability loadout.
- Permanently unlocked regions.
- Long-term statistics, records, achievements, and cosmetics if added later.

### Regional Run

The active Regional Run is temporary.

It contains:

- Current region and round.
- Cash and operational resources.
- Fleet composition and damage.
- Individually equipped escorts.
- Class-equipped cargo ships.
- Purchased equipment.
- Technologies and Fleet Doctrines acquired during the run.
- Enemy adaptation state.
- Confidence.
- Quota progress.
- Wreckage and crew-rescue results.
- Run history and telemetry.

Losing or completing a region clears the Regional Run without clearing the Commander Profile.

### Three Progression Layers

#### Permanent Campaign Progression

- Region unlocks.
- Commander Experience.
- Commander Abilities.
- Long-term records and achievements.

#### Pre-Run Loadout

- Selected Commander Abilities.
- Limited ability slots.
- Limited Commander Ability point budget.
- Region selection.

#### Temporary Region-Run Progression

- Fleet composition.
- Cash.
- Technologies.
- Installed equipment.
- Fleet Doctrines.
- Consumables and repairs.
- Confidence and quota state.
- Round progress.

Keeping these layers separate is a core architectural requirement.

## Region Runs and Reset Rules

Each region is an independent roguelite campaign.

A typical region structure is:

1. Begin the region at round 1 with a region-defined starting state.
2. Build the fleet during the run through cash, recovered technology, equipment purchases, and doctrines.
3. Continue until the region completion watermark is reached or the run is lost.
4. Completing the region permanently unlocks the next region and awards Commander Experience.
5. Losing restarts the same region at round 1.

If a player reaches round 10 of Region 8 and loses, the next attempt begins at Region 8, round 1. The player does not return to Region 7 or Region 1.

### What Resets

The following are temporary to the active regional run and are lost when it ends through defeat or completion:

- Cash.
- Current fleet composition.
- Fleet damage and repairs.
- Purchased and installed equipment.
- Ammunition and consumables.
- Technologies unlocked during the region.
- Fleet Doctrines selected during the region.
- Enemy adaptation and procurement state.
- Confidence and quota progress.
- Current round progress.

Technology and equipment acquired in one region do not carry into the next. The player must build a new technology path during every regional run.

This reset is intentional. Player familiarity and strategic knowledge carry forward, but the in-run build does not.

### What Persists

- Permanently unlocked regions.
- Commander Experience.
- Unlocked Commander Abilities.
- Long-term statistics, records, achievements, and cosmetics if added later.

Commander progression is the only gameplay-affecting progression intended to persist across all regions.

## Regional Victory and Defeat

Each region has a defined completion round or watermark. Reaching that watermark completes the region.

A regional run can fail through either of two systems:

1. Confidence reaches zero.
2. The player fails the required shipping quota.

### Confidence

Confidence represents whether civilian crews, operators, and shipping organizations remain willing to continue the operation.

- Ship losses reduce confidence.
- Improved survival in later rounds can restore confidence.
- Unrescued crews create an additional confidence penalty.
- Crew rescue reduces or prevents that additional penalty.
- Exact confidence gains, losses, floors, and recovery rules are balancing parameters.

Confidence is the regional health bar. It allows one poor round to be recoverable while sustained failure ends the attempt.

### Shipping Quota

The quota remains necessary to prevent a low-risk exploit where the player sends only one or two ships every round.

- The player must deliver a required amount of cargo during a defined quota window.
- Missing the quota ends the regional run or applies the final loss condition defined during implementation.
- The quota must remain tied to available fleet capacity strongly enough to prevent trivializing encounters with extremely small convoys.
- The exact quota formula, window length, rollover behavior, and presentation will be tuned after the new loop is playable.

Confidence measures whether the operation remains politically and socially viable. The quota ensures the player is actually conducting a meaningful shipping operation.

## Crew Rescue

Lost civilian ships may leave survivors in the water.

A survivor area:

- Appears near the lost ship.
- Requires one or more escorts to remain inside the area.
- Recovers faster when multiple escorts participate.
- Resets completely if all escorts leave before completion.
- Disappears after successful rescue.
- Creates an additional confidence penalty if the crew is not rescued.

Crew rescue creates a tactical choice between:

- Defending the active convoy.
- Recovering enemy technology.
- Rescuing friendly crews.

The exact survivor chance, rescue duration, availability window, multi-escort scaling, and confidence effect are balancing parameters.

## Wreckage Recovery

Destroyed physical enemy threats have a random chance to create recoverable wreckage.

Potential sources include:

- Missiles.
- Mines.
- Torpedoes.
- Attack boats.
- Drones and aircraft.
- Other physical enemy weapons or platforms added later.

A wreckage field:

- Appears near the destroyed threat.
- Records the threat family that produced it.
- Requires one or more escorts to remain inside its recovery area.
- Recovers faster when multiple escorts participate.
- Resets completely if all escorts leave before completion.
- Shows visible recovery progress.
- Disappears after successful recovery.
- Contributes to the post-round technology draft.

The player should not be able to briefly touch a wreckage field, leave, and preserve progress. Recovery requires committing escort time and accepting exposure.

### Design Goal

Recovery should create a direct tactical tradeoff between convoy protection and technological progression.

The most valuable or specialized escort may also be the riskiest ship to divert, especially because escorts now have individual identities and loadouts.

### Deferred Wreckage Balance

The following should be measured through playtesting:

- Drop chance by threat type.
- Recovery duration.
- Multi-escort recovery scaling.
- Whether larger or more advanced threats produce higher recovery value.
- Wreckage lifetime before expiration.
- Commander Ability modifiers.

## Technology Reward Draft

The existing paid research phase is removed and replaced by a mandatory post-round reward draft.

After every successfully completed round:

- The player receives a technology draft.
- The player must select one reward.
- Rewards cannot be skipped.
- Rewards cannot be banked.
- The selected reward activates immediately for the active regional run.
- Existing prerequisites remain enforced.
- The next eligible node in a branch the player already owns can appear.
- Higher nodes cannot appear before their required lower nodes.

The current player-counter catalogue should remain the source of technology progression. The combat effects, target compatibility, branches, nodes, tactics, and prerequisite relationships should be reused rather than rebuilt.

The acquisition method changes; the underlying counter architecture remains valuable.

### Wreckage Influence

Recovered wreckage affects both draft breadth and quality.

- A successful round always grants a draft even if no wreckage was recovered.
- Lower recovery generally produces two choices.
- Stronger recovery increasingly favors three choices.
- Recovery beyond the choice-count threshold increasingly improves rarity, quality, or tier potential.
- Wreckage from particular threat families may weight the draft toward relevant counter branches.

Example: Recovering technology from torpedoes should increase the chance of seeing eligible hydrophone, sonar, or depth-charge progression without guaranteeing a specific counter.

Exact thresholds, probability curves, and rarity rules are balancing parameters.

### Retired Research Systems

The following existing systems are removed from the primary progression loop:

- Spendable research intel.
- Paid research projects.
- One active research project at a time.
- Research completion delays.
- Surviving an additional round before a selected reward activates.

Cash remains spendable. Technology rewards are selected rather than purchased with intel.

## Upgrade Categories

### Fleet Doctrines

Fleet Doctrines are temporary fleet-wide improvements.

They:

- Activate immediately when selected.
- Apply fleet-wide.
- Require no separate cash purchase.
- Last only for the active regional run.

Examples:

- Faster reloads.
- Improved crew efficiency.
- Better radar processing.
- Faster repairs.
- Improved rescue operations.
- Passive fleet bonuses.

### Equipment Technologies

Equipment Technologies unlock hardware that may be purchased and installed.

Examples:

- Sonar.
- CIWS and self-defense systems.
- MCM drones.
- Depth charges.
- Deck guns.
- Torpedo counters.
- Missile and sensor upgrades.

Unlocking the technology makes it available to the fleet but does not automatically install it.

### Catalogue Structure

Fleet Doctrines and Equipment Technologies may share one reward interface even if they are stored in separate internal catalogues.

The final internal representation should favor clean prerequisite handling, reward weighting, effect derivation, and future content authoring.

## Fleet Equipment Model

Technology belongs to the fleet rather than to the escort that recovered it. Equipment purchases remain platform-specific.

### Individual Escorts

Escorts are individual units with:

- Stable identity during the regional run.
- Player-editable name.
- Individual damage state.
- Individual module loadout.
- Individual equipment receipts.
- Individual combat telemetry.
- Loss by specific hull identity.

Technology unlocks remain fleet-wide, but equipment is purchased and fitted separately for each escort.

For example, unlocking depth charges makes the system available, but each escort carrying depth charges must be fitted separately.

The individual-escort architecture implemented in PR #28 should be retained as the foundation for this model.

### Cargo Ships

Cargo-ship equipment remains class-based rather than individually managed.

A module installed for a cargo class applies to that class. This keeps merchant-fleet management readable while preserving specialization and identity among the smaller escort flotilla.

### Design Goal

The player should care which escort is performing a dangerous recovery or rescue operation because escorts differ in value, role, condition, and equipment.

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

- Wreckage and reward drafts unlock knowledge.
- Cash purchases and sustains hardware.

## Campaign and Region Structure

The preferred direction is approximately ten operational regions or theaters.

Each region introduces or emphasizes new strategic challenges while continuing to use previously introduced systems.

Potential progression includes:

- Missiles and basic interception.
- Mines and mine warfare.
- Fast attack boats and boarding.
- Torpedoes and underwater detection.
- Artillery and shore threats.
- Smoke, electronic warfare, aircraft, and drones.
- Combined multi-domain attacks.

A region should not feel like a disconnected mini-game. New threats join the existing vocabulary and create more complex combinations.

The final region unlocks the full threat roster. After its completion watermark, the run may continue through escalating endless tiers with the goal of surviving as long as possible.

The exact number of regions, completion thresholds, and endless-tier presentation remain balance and content decisions.

## Region Definitions

Each region should be represented by a data-driven Region Definition.

A Region Definition controls:

- Region identity and presentation.
- Completion round or watermark.
- Enemy branches allowed in the region.
- Enemy branches initially available.
- Threats that may debut later.
- Player counter branches eligible for reward drafts.
- Threat-budget progression.
- Encounter rules and scripted teaching beats.
- Optional environmental modifiers.
- Region-specific starting state, to be tuned later.

Example:

```text
Region 1 permits:
- Missiles
- Mines

Region 2 permits:
- Missiles
- Mines
- Attack boats
```

Regions should not create separately balanced versions of the same enemy or equipment.

An attack boat, mine, missile, escort weapon, or other game object should retain the same core balance values regardless of region.

Regions instead modify availability, combinations, pacing, timing, and environment.

## Adaptive Enemy Integration

The existing adaptive enemy and enemy procurement economy remain part of the redesign.

The region limits which enemy branches are available. Within that allowed set, the enemy continues to allocate its resources based on which attacks are succeeding against the player.

The relationship is:

- The region determines what the enemy can use.
- The adaptive enemy determines what it chooses to emphasize.

Enemy adaptation resets at the beginning of every regional run.

This preserves the existing arms-race identity while giving the campaign a controlled teaching and pacing structure.

## Threat Budget

Difficulty should increase primarily through a threat-budget system operating alongside the adaptive enemy.

Each enemy branch or unit has a cost. The region supplies the available threat space and budget curve. The enemy procurement system determines how the budget is allocated within that space.

Difficulty can increase by:

- Increasing the available threat budget.
- Introducing additional enemy branches.
- Combining threats in new ways.
- Changing timing, spacing, attack patterns, and objectives.
- Adding environmental complications.

Difficulty should generally not increase by repeatedly inflating enemy health or damage.

## Region-Aware Technology Availability

Technology rewards should avoid offering counters that have no meaningful use in the active region.

- Threat-specific counters become eligible when their corresponding enemy families are part of the region.
- General survivability, logistics, and Fleet Doctrine rewards may remain broadly available.
- Later regions include counter families introduced in earlier regions.
- Technology still begins from its entry nodes during every new regional run.
- Prerequisites remain enforced within the active run.

This keeps early reward pools understandable and prevents unusable rewards from consuming draft slots.

## Commander Progression

### Commander Experience

Commander Experience is the permanent progression resource earned through play and region advancement.

Potential sources include:

- Completing a region.
- Reaching significant round milestones.
- Completing difficult objectives.
- Performance-based awards defined later.

Commander Experience persists through defeat and regional transitions.

The exact earning rate remains a balance decision.

### Commander Abilities

Commander Experience unlocks Commander Abilities. These are optional, swappable abilities selected before beginning a regional run.

Commander Abilities should provide bounded strategic advantages rather than endlessly accumulating permanent raw power.

Potential examples:

- Small fleet accuracy increase.
- Reduced repair costs.
- Improved wreckage recovery.
- Improved crew-rescue speed or confidence preservation.
- Additional starting logistics.
- Slightly cheaper ammunition.
- Improved detection or operational flexibility.

The player equips only a limited loadout.

Current working model:

- Approximately two or three ability slots initially.
- Approximately 25 total loadout points.
- Each ability has a point cost based on strength.
- The player may freely swap unlocked abilities between regional attempts.
- Slot count or point capacity may increase through progression, but both remain capped.

The player cannot equip every unlocked benefit at once. The system should encourage deliberate pre-run builds rather than passive permanent stat accumulation.

### Effect Integration

Commander Ability effects should be applied centrally after normal technology and equipment effects are derived.

Preferred effect flow:

```text
Base platform values
→ Technology and tactic effects
→ Installed equipment effects
→ Commander Ability modifiers
→ Final combat and economy values
```

Commander modifiers should not be scattered across unrelated simulation code.

### Design Goal

Commander progression should:

- Make losses feel productive without eliminating fresh-run tension.
- Give experienced players more strategic options.
- Support different pre-run playstyles.
- Preserve the importance of early regional decisions.
- Avoid turning playtime alone into unlimited fleet power.

## Menu and Run-Start Flow

The eventual player flow should be:

```text
Main Menu
→ Region Select
→ Commander Ability Loadout
→ Start Regional Run
→ Preparation
→ Transit
```

The menu redesign is secondary to the first playable vertical slice, but the save and routing architecture must support this flow.

The final endless region should eventually display persistent records such as highest round, highest tier, or best score.

## Save Architecture

The existing single campaign save should be separated into:

- A permanent Commander Profile save.
- A temporary active Regional Run save.

Clearing or replacing the active run must never erase permanent progress.

Save migration should preserve existing compatibility principles where practical, but this redesign may require an explicit migration boundary because the campaign model changes substantially.

## Telemetry and Playtesting

The deterministic simulation and existing telemetry are major assets and should be preserved.

The new telemetry should make it possible to evaluate:

- Wreckage generated, recovered, and abandoned.
- Escort time spent recovering wreckage.
- Survivors generated, rescued, and lost.
- Confidence impact by cause.
- Quota progress and failure causes.
- Reward choices offered and selected.
- Draft rarity and prerequisite progression.
- Commander Ability loadouts and effects.
- Regional completion and failure rates.
- Individual escort performance and losses.

The existing headless playtest harness should be adapted after the first vertical slice works. It should not be used to tune the old campaign model as a substitute for testing the new loop.

## First Implementation Milestone

Build one complete regional vertical slice containing:

- Separate Commander Profile and Regional Run saves.
- Region selection.
- Commander Ability loadout.
- One Region Definition.
- Wreckage drops and escort recovery.
- Survivor rescue.
- Confidence and quota failure conditions.
- Mandatory post-round technology drafts.
- Existing counter catalogue reused as reward content.
- Cash-based equipment procurement.
- Individual escort fitting.
- Regional defeat and reset.
- Region completion and Commander Profile persistence.

The first slice does not need ten balanced regions. Its purpose is to prove the full loop and expose the balancing questions through play.

## Explicitly Deferred Balance Work

The following should not block implementation:

- Starting fleet by region.
- Starting cash, ammunition, and consumables.
- Region length and completion round.
- Equipment prices.
- Quota targets, window length, and consequences.
- Confidence gains, losses, and recovery.
- Wreckage drop rates and recovery duration.
- Crew-rescue timing and confidence impact.
- Reward rarity probabilities and thresholds.
- Fleet Doctrine strength.
- Commander Ability values, costs, slots, and experience awards.
- Enemy threat-budget curves.
- Final endless-tier scaling.

These values should be tuned using the playable vertical slice and the deterministic test harness.

## Guiding Principles

> Balance the building blocks, not the campaign.

Campaign difficulty should emerge from encounter composition, adaptive allocation, escalating combinations, and player decisions rather than region-specific versions of every enemy and piece of equipment.

> Familiarity persists; the build does not.

The player carries strategic knowledge and Commander options forward, but rebuilds the fleet and technology path during every regional run.

> Escorts create the tactical decisions.

Convoy defense, enemy-technology recovery, and friendly-crew rescue should compete for the same limited escort attention.

## Remaining Non-Blocking Design Items

The following can be refined during implementation without reopening the core architecture:

- Final terminology for recovered enemy technology.
- Whether Fleet Doctrines live inside the counter catalogue or a parallel catalogue.
- Exact survivor-generation rules.
- Exact relationship between the quota and confidence when a quota is missed.
- Final region count and thematic ordering.

None of these prevent beginning the first implementation milestone.
