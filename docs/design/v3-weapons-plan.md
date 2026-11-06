# V3 weapons plan (after the round 2 review)

**Built so far:**
- **Build 1 (phases 0–1):** [v3-weapons-build-1.md](v3-weapons-build-1.md): systems and the six actives.
- **Build 2 (phase 2):** [v3-weapons-build-2.md](v3-weapons-build-2.md): the four passives.
- **Build 3 (phase 3):** [v3-weapons-build-3.md](v3-weapons-build-3.md): the eleven boosts, and Free Play on the plan's drops.
- **Build 4 (phase 4):** [v3-weapons-build-4.md](v3-weapons-build-4.md): the three experiments (Tidal Cannon, Storm Front, Ammunition Ship).

Each covers how to try it, the measured strength, and the tuning made during the build.

**Status:** locked on 2026-11-06. The player answered the open questions and checked every boost's levels (round 3, below), then said "start building". Phases 0–4 are built. The balance sweep is done and the lock-in round is on the review page (round 4, below), waiting for the player's marks.

**Sources:**
- [v3-weapon-ideas-2.md](v3-weapon-ideas-2.md): the ideas, the prototypes and the data.
- The player's marks on the review page (https://claude.ai/artifact/WdDGCXvCnQUzRL655GCmBQ), read on 2026-11-05 and copied to `tools/v3/weapon-ideas/review-2026-11-05.json`. Round 3 (the Plan tab) was read on 2026-11-06 and copied to `review-2026-11-06.json`.

## What the player decided

### The picks

| | Go further | Maybe (try later) | Dropped |
|---|---|---|---|
| **Active** | Charge Lance, Laser Cutter, Grapnel, Chain Shot, Fire Control, Cadence Gun | Tidal Cannon ("I think mechanically it will not work well with the game") | Turncoat Rounds, Wire-Guided Missile, Limpet Charges |
| **Passive** | Drone Screen, Gunship Pair, Bomber Wing, Orbital Strike | Storm Front ("might not work well with the game"), Ammunition Ship ("play around with this"), Hunter-Killer Sub (parked: "need more enemy types for this to be useful") | Evasive Helm, Salvage Tug, Jammer Ship |
| **Boost** | Fire at Will, Supply Run, Overclock, Dual Wield, Hot Streak, Wild Card, Focus | | Scavenger Rounds, Wingman, Shore Bombardment |

17 go further, 4 maybes, 9 dropped. No cut idea was brought back.

**Launchers:** of the three ideas that hit launchers, only Bomber Wing stays.

### The answers

| Question | Answer |
|---|---|
| Holding while a hold weapon is loaded | Holding charges or drags instead of repeating the shot, and the weapon chip says so ("HOLD: charge"). |
| Drone Screen's origin | Always the carrier deck. |
| Boost levels | "They can be longer… But each level should change something just like it does for the normal passive and active weapons." |
| Boost slots | Boosts share the 3 slots: "players should have a boost-only build if they want". |
| Next step | Playable prototypes on a link the player can open on the phone. |

**On the power-ups** (general note):
> "We need to rework the existing boosts too, like the time warp and the hyper overdrive. Those can now be in boost category. Only ones that should remain as default in the game is the ammo drop, a heal and then a clear screen new boost that just kills everything currently on the screen, call it a nuke or something like that."

### Notes on single ideas, folded into the specs below

- **Cadence Gun:**
  - "make it a full aura on the screen and not just the aircraft carrier so it is easier to see";
  - the beat should be "a single beat beat beat with a few ms between";
  - it "should have a lead up to it, so the player can anticipate when the beat will hit."
- **Orbital Strike:** "it should be like the laser dots too, triangulating on my spot and then the big beam hits."

## The rules, as locked

**Three categories:**

| Category | When you pick it up | Your gun | Lasts |
|---|---|---|---|
| **Active** | Replaces the loaded weapon. | Fires the weapon. | 15 s |
| **Passive** | Replaces the loaded weapon. | Stays plain; the passive works on its own. | 15 s |
| **Boost** | Never replaces the loaded weapon. A second boost replaces the first. | Whatever is loaded, changed by the boost. | 15 s, like a weapon. The player said boosts "can be longer". |

**How a run holds them:**
- **Slots:** one draft and one pool. Actives, passives and boosts all take the same 3 slots. A run can be all boosts, all actives, or any mix.
- **Levels:** every weapon, boosts included, has 3 levels.
  - Level 2 makes it stronger.
  - MAX changes what it does.

  That is round 1's rule for weapons, now applied to boosts.

**Holding:**
- With Charge Lance or Grapnel loaded, a hold charges or drags.
- With any other weapon, a hold repeats the shot, as today.
- The weapon chip in the rail says "HOLD: charge" or "HOLD: drag".

**Default drops** (from any kill, no draft needed): only three.
- **Ammo:** fills the rack.
- **Repair:** heals.
- **Nuke:** new.
  - Tap it and everything in the air and on the water is destroyed: every drone, missile, aircraft, boat and mine on screen.
  - **Proposal:** structures (rigs, generators, the Citadel) and the Dreadnought take 3 hits instead of dying.
  - It is the rarest drop: a weight of about 3, against 40 for ammo. Not before wave 3, and at most one on the water at a time.

**The other power-ups become boosts:**
- Overdrive and Time Warp become boosts, as the player said.
- Shield and Full Steam are not in the player's list of default drops, so they leave the default drops too. Whether they become boosts or are cut is open question 2.
- **Star Shell** is not a general power-up: it exists only on The Black Strait, where it lights the dark sea. **Proposal:** keep it as that map's drop.

**Drone Screen** launches from the carrier deck on every map.

## The specs that changed

The ideas doc holds the full spec of each pick: how it plays, what it is strong and weak against, and its levels. Only the changes are here.

### Cadence Gun (rewritten from the player's note)

**The beat:**
- One steady beat every 0.6 s, the same every time: "beat, beat, beat".
- It is a single drum hit with no off-beats, so it is easy to count.

**The lead-up:**
- Before each beat, a ring closes in from the screen edges. It reaches the edge of the play area exactly on the beat, like the approach circles in a rhythm game.
- The aura glows brightest at the hit and fades between beats. The player sees the beat coming instead of reacting to it.

**The aura:**
- On the beat, the whole play area's border pulses (a frame of light round the map), not only the carrier.
- A shot fired within 0.12 s of the beat lights the aura gold.

**Accessibility:**
- With Reduced Motion on, the closing ring becomes a thin progress bar along the top edge.
- The sound cue always plays, with a haptic tap on the beat on the phone.

**Levels:**

| Level | What changes |
|---|---|
| 1 | On the beat: 3 hits and pierce. |
| 2 | A wider window (0.18 s). |
| MAX: War Drum | Four beats hit in a row, and the fifth fires a free broadside. |

### Orbital Strike (rewritten from the player's note)

**The telegraph:**
1. Three red laser dots appear at the edges of the play area.
2. They slide in and converge on the target over 0.8 s, making a triangle that shrinks to a point.
3. Then the beam comes down.

**Target and timing:**
- It locks onto the toughest threat on screen when the dots appear. They follow that threat as it moves, so the beam doesn't miss.
- The 0.8 s lead means the prototype's 2.5 s cycle becomes 0.8 s of locking plus a 1.7 s gap.

**Levels:**

| Level | What changes |
|---|---|
| 1 | 3 hits every 2.5 s. |
| 2 | Every 1.8 s. |
| MAX: Sky Spear | The beam stays 1 s and sweeps to the next biggest threat. |

### Drone Screen

- **Origin:** the carrier deck on every map. The drones lift off the carrier and fan out toward the threats closest to hitting a hull.
- **Rate:** one every 1.2 s at level 1. That rate won 69% of runs in the prototype, against 38% without.

### Boosts: a level 2 and a MAX for each

Each boost needs levels that change something. These are proposals for the player to confirm; every boost lasts 15 s at every level.

| Boost | Level 1 | Level 2 | MAX |
|---|---|---|---|
| **Fire at Will** | Hold for full-auto (every 0.2 s); the rack holds 4 more. | Every 0.15 s, 6 more, reloads twice as fast. | **Lead Rain:** every 4th held shot bursts into flak. |
| **Supply Run** | Drops ×2, and they fly to the carrier. | Drops ×3. | **Airdrop:** every 6 s a crate lands holding one of your weapons. |
| **Overclock** | The loaded weapon plays one level higher; its timer stops. | The next weapon picked up is overclocked too. | **Overload:** the loaded weapon jumps straight to MAX. |
| **Dual Wield** | The next weapon picked up joins the loaded one; every tap fires both. | Both timers run at half speed. | **Arsenal:** a third weapon joins. |
| **Hot Streak** | 5 hits in a row: double damage. 10: triple. | The streak survives one miss. | **On Fire:** at 10, shots pierce and the streak doesn't decay. |
| **Wild Card** | Each plain shot is a random weapon's level 1 shot. | Level 2 shots. | **Jackpot:** every shot is a random weapon's MAX shot. |
| **Focus** | Up to 6 s at half speed, spent while a finger is down. | 9 s, at a third of the speed. | **Deadeye:** shots fired in slow motion hit for double. |
| **Overdrive** (was a power-up) | Rounds cost nothing. | And the rack keeps refilling, so it is full when the boost ends. | **Hyper Overdrive:** every shot fires twice. |
| **Time Warp** (was a power-up) | Threats move at 40% speed. | 25%. | **Stasis:** a threat hit while slowed is frozen for 1 s. |
| **Shield** (was a power-up; if kept, see question 2) | Ships and carrier take no damage. | And the shield blocks strafing runs. | **Reflect:** a blocked missile bounces back and bursts. |
| **Full Steam** (was a power-up; if kept, see question 2) | Convoy 1.6× speed. | 2× speed. | **Ramming Speed:** ships at full steam ram drones and boats out of the water. |

## How the prototypes get to the player's phone

The player chose playable prototypes on a link. The way to do that without disturbing the campaign:
- **Branch preview:** every build goes to a branch whose Vercel preview link opens on the phone.
- **Free Play has them:** Free Play already lets you pick any 3 weapons and their levels, start on any map and wave, and turn on frequent drops. The new weapons appear there, marked "Prototype".
- **The campaign is unchanged:** its draft doesn't deal prototypes until the player locks them.
- **Notes:** the note button in a run already saves notes into the play log. That is how feedback on each prototype comes back.

## Build phases

Each phase is one PR with a preview link. Each one gets:
- tests: unit tests for the sim, and the browser suite;
- concept-faithful visuals, checked at 667×375;
- a bot measurement of how strong it is.

The player plays it before the next phase starts.

| Phase | What | Why this order |
|---|---|---|
| **0. Systems** | The category on each weapon. Boost rules: never replaces the loaded weapon, shares the slots, one at a time. The boost chip and timer. Hold routing and the "HOLD: …" chip label. The default drops reduced to ammo, repair and the new Nuke. Overdrive and Time Warp become boosts. A "Prototype" shelf in Free Play. | Everything else needs these. |
| **1. Actives** | Charge Lance, Laser Cutter, Grapnel, Chain Shot, Fire Control, Cadence Gun. | The player's next step named the hold and gesture actives first; feel is the open question there. |
| **2. Passives** | Drone Screen, Gunship Pair, Bomber Wing, Orbital Strike. | Reuse systems the game has: frigates, allies, the air strike jet, silos being knocked out. |
| **3. Boosts** | Fire at Will, Supply Run, Overclock, Dual Wield, Hot Streak, Wild Card, Focus, plus the converted Overdrive and Time Warp (and Shield, Full Steam if kept). | Boosts change other weapons, so they come once there are weapons to change. |
| **4. Experiments** | Tidal Cannon, Storm Front, Ammunition Ship. | The player's maybes: tried after the picks, kept only if they play well. |
| **Parked** | Hunter-Killer Sub. | Waits for more sea enemies, as the player said. |

**After the phases:**
- a balance sweep;
- the draft pool question (below);
- then the picks enter the campaign.

## What this does to the game's size

| | Today | After the plan |
|---|---|---|
| Actives | 10 | 16 |
| Passives | 2 | 6 |
| Boosts | 0 | 9 (11 if Shield and Full Steam are kept) |
| In the draft pool | 12 | 31–33, plus up to 3 experiments |
| Default drops | 7 kinds | 3 (ammo, repair, Nuke) |

**Two effects to plan for:**
- **A big pool thins the draft.**
  - Round 1 measured how often a given weapon you don't hold is offered in one draft: 11.2% with 12 weapons, 5.3% with 22.
  - With 31 it falls to roughly 4%, an estimate from the same trend: about a third as often as today.
  - A player could finish the game without seeing half of them. See open question 3.
- **Fewer default drops changes pacing.** Overdrive was 22% of power-up drops, and it is the main relief when the rack runs dry. With it moved to a boost, ammo starvation (already in the pacing notes) needs watching. This belongs in the pacing pass.

## Round 3: the answers (2026-11-06)

**The questions:**

| Question | Answer |
|---|---|
| The Nuke against rigs, generators, the Citadel and the Dreadnought | 3 hits, not a kill. |
| The Nuke's rarity | About right: weight 3, not before wave 3, one on the water at a time. |
| Shield and Full Steam | Both become boosts. |
| The draft pool | New weapons unlock a few per chapter; Free Play has all of them. "I might cut some or add more in the future, so keep it moddable." |
| First playable link | Phase 0 (systems) plus Phase 1 (the six actives). |

**The player's summary:**

> "We now have three different categories that we can draft from: passive, active and boost. … Active takes over the gun; passive allows you to keep shooting your gun, and there is a thing that comes in and supports you; boost is a new drop … and then … the defaults that are free that don't have levels, and then you can add more, and then three slots total."

**Moddable** means one registry file lists every weapon with its category, the chapter it unlocks in, and whether it is live or a prototype. Adding, cutting or moving a weapon is one line there; the draft, Free Play and the cards all read from it.

**Boost levels, with the player's changes:**
- **Accepted as proposed:** Fire at Will, Supply Run, Focus, Overdrive, Full Steam.
- **Changed by the player's notes** (where a note was open to more than one reading, the reading used is marked):

| Boost | Player's note | Change |
|---|---|---|
| **Dual Wield** | "I don't think you will be able to have more than two weapons, so how about we just increase drop rate of weapons when active." | MAX is no longer a third weapon. **MAX:** while it lasts, weapon drops come twice as often. |
| **Hot Streak** | "Ehhh remove the one." | **Reading:** the level 2 "streak survives one miss" is removed. **New level 2:** double at 4 hits, triple at 8. MAX is unchanged. |
| **Overclock** | "What happens when a player already has max? Should have some small buff, maybe it drops more frequently?" | When the loaded weapon is already at MAX, Overclock instead makes that weapon drop more often for its duration. |
| **Shield** | "Make sure there is an animation showing the shields breaking when the strafing run hits, so it is clear." | Level 2 blocks a strafing run, and the shield visibly cracks and shatters at the hit. |
| **Time Warp** | "Yes for one and two, but time should look like it is slowing down." | **Every level:** the sea and the threats desaturate and trail, and the sound drops in pitch. **Reading:** the "Stasis" MAX is not wanted. **New MAX, Freeze Frame:** the first 2 s are near-stopped (10% speed), then 25%. |
| **Wild Card** | "Level 1 they have active only at level 1, and level two you get one passive, and level three is actives at level max." | **Level 1:** a random active's level 1 shot. **Level 2:** a random active or passive, at level 2. **MAX:** a random active's MAX shot. |

**What is built first:**
- **Phase 0, systems:**
  - the weapon registry, with category, unlock chapter and live or prototype;
  - the Nuke as a default drop;
  - hold routing, with the "HOLD: …" chip;
  - the Prototype shelf in Free Play.
- **Phase 1, the six actives:** Charge Lance, Laser Cutter, Grapnel, Chain Shot, Fire Control and Cadence Gun.

**What waits:**
- **Overdrive, Time Warp, Shield and Full Steam** leave the default drops in Phase 3, when they return as boosts. Until then the campaign keeps them, so it doesn't lose them with nothing in their place.

## Open questions for the player (answered in round 3, above)

1. **The Nuke:** does it also hit structures and the Dreadnought? The proposal is 3 hits, not a kill. And is a weight of about 3 (roughly one every three waves) the right rarity?
2. **Shield and Full Steam:** become boosts (with the levels above), or be cut?
3. **The draft pool with 31+ weapons:**
   - (a) new weapons unlock over the campaign, a few per chapter, and Free Play has all of them (recommended);
   - (b) before each run you pick about 12 for that run's pool;
   - (c) everything in one big pool.
4. **Boost levels** in the table above: OK as proposed, or change any?
5. **Order:** start with Phase 0 plus Phase 1 (systems and the six actives) as the first playable link?

## Round 4: the lock-in (2026-11-06)

Every phase is built. Before any prototype enters the campaign, the player marks the **lock-in round** on the same review page as rounds 2–3, on its new **Lock-in** tab: https://claude.ai/artifact/WdDGCXvCnQUzRL655GCmBQ

**What it asks:**
- **Keep / Change / Cut** each of the 24 prototypes, and the chapter each unlocks in.
- **6 questions:** default drops, the draft pool, Laser Cutter, the hands-on weapons, sounds, next step.
- **A Looks right / Change check** on each of the 17 spec changes made during the builds.

**Where the marks live:**

| Collection | Fields | Holds |
|---|---|---|
| `lockin/{weaponId}` | `verdict` (keep / change / cut), `chapter` (1–4), `note` | A weapon’s fate |
| `checks/{checkId}` | `verdict` (ok / change), `note` | A spec change (ids in `tools/v3/weapon-ideas/lockin.mjs`) |
| `answers/{lk-…}` | `choice`, `note` | Round 4’s questions (round 2–3 ids unchanged) |

**The page is generated** by `npx tsx tools/v3/weapon-ideas/page3.mjs <out.html>` from `lockin.mjs`, the game’s own weapon text and proposed chapters, and `lockin-results.json`.

### The player's playtest (2026-11-06)

The player played every prototype except Fire at Will and Overclock in Free Play: 10 runs on Kesh from wave 7.
- **Results:** 6 won, 3 lost, 1 quit.
- **Notes:** 6, quoted on the page and kept in `tools/v3/weapon-ideas/playtest-2026-11-06.json` with each run's setup, draft picks, levels and taps on an empty rack.

The page (version 4) shows, on every card:
- how the weapon went in those runs;
- the notes about it;
- a suggested verdict (`READ` in `lockin.mjs`).

It also adds:
- 4 questions the notes raise (`answers/{pt-…}`): Fire Control and Chain Shot, Dual Wield, Cadence Gun, Focus;
- 4 checks of what the notes ask to be built (`checks/{n-…}`): the helicopters' missiles and movement, Supply Run's cargo plane, running dry.

### The balance sweep behind it

All rows were measured again under one set of rules: the "average" bot on every map from wave 1, 100 runs a row, at a fixed level, Resupply at every draft, the plan’s drops. Builds 1 and 2 had measured with the four old power-ups still dropping, so their numbers here are lower than in their build docs.

| Held | Level 1 | MAX |
|---|---|---|
| *Nothing held* (Free Play drops) | 5% | 5% |
| *Nothing held* (the campaign’s drops) | 8% | 8% |
| Flak (today’s) | 29% | 41% |
| Railgun (today’s) | 15% | 40% |
| Air Strike (today’s) | 8% | 47% |
| Scattergun (today’s) | 17% | 45% |
| Frigates (today’s) | 39% | 52% |
| Aegis (today’s) | 19% | 51% |
| **Charge Lance** | 15% | 30% |
| **Laser Cutter** | 26% | 56% |
| **Grapnel** | 21% | 47% |
| **Chain Shot** | 19% | 22% |
| **Fire Control** | 16% | 19% |
| **Cadence Gun** | 19% | 28% |
| **Drone Screen** | 24% | 36% |
| **Gunship Pair** | 31% | 54% |
| **Bomber Wing** | 22% | 26% |
| **Orbital Strike** | 17% | 34% |
| **Fire at Will** | 21% | 47% |
| **Supply Run** | 13% | 19% |
| **Hot Streak** | 9% | 10% |
| **Wild Card** | 20% | 47% |
| **Focus** | 8% | 6% |
| **Overdrive** | 31% | 52% |
| **Time Warp** | 15% | 29% |
| **Shield** | 21% | 22% |
| **Full Steam** | 7% | 12% |
| **Tidal Cannon** | 8% | 17% |
| **Storm Front** | 10% | 22% |
| **Ammunition Ship** | 27% | 42% |
| **Flak + Overclock (vs Flak + Railgun: 14% / 41%)** | 32% | 47% |
| **Flak + Railgun + Dual Wield (vs + Scattergun: 21% / 42%)** | 22% | 44% |
