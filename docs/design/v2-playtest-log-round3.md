# Straitwatch V2: playtest round 3

Feedback came from the player's own runs on an iPhone 16 Pro: map 1 (Strait) and map 2 (Gauntlet) were each cleared on the first try, with 2 and 3 ships lost. The requests were:

- a glow on the carrier while Overdrive is active;
- a way to swap out an upgrade mid-game;
- an image for each upgrade;
- tougher heavy missiles;
- formations that involve real strategy;
- three changes chosen from the logs themselves.

The aim throughout is fun: a lot going on, challenging but beatable.

Both real runs were pulled from the Vercel Blob log store and replayed. Each replay **MATCHES** the phone's score, losses and step count, so every number below comes from the player's actual games.

## What success looks like (from the player's side)

| # | Goal | How it's checked |
|---|------|------------------|
| S1 | You can tell at a glance when Overdrive is on: the carrier glows while it is active and stops when it ends. | Screenshot with Overdrive on and off |
| S2 | When all three slots are full, a new card can still be taken by choosing which owned card it replaces. The UI makes this obvious, and it works mid-game. | Browser e2e; unit test; replay of a log with a swap |
| S3 | Every upgrade card has its own simple icon, readable at phone size. | Screenshot of drafts at iPhone size |
| S4 | Heavy missiles take visibly more work to bring down. | Analyzer: hits needed per heavy; screenshot of HP pips |
| S5 | Formation is a real decision: each has a visible trade-off, and none is best everywhere. | Bot sweep per formation across threat mixes |
| S6 | The screen stays busy. In late waves the average number of threats on screen is about 3 or more, and the screen is empty less than ~20% of the time. | `npm run v2:analyze` on bot runs, compared with the player's logs |
| S7 | Challenging but achievable. A strong player loses ships on map 1 and the carrier is actually pressed, yet the map can still be cleared. | Sweep clear rates per skill; carrier damage per run |
| S8 | You stay the defender. Your taps outnumber the automatic CIWS's shots in every wave. | Analyzer: shots vs CIWS shots |
| S9 | Nothing breaks: replays stay exact, the phone layout holds, and frame rate holds on the busier screens. | Tests, e2e (including iPhone), frame-time check |

## Cycle 1: baseline, and whether the bots play like the player

**Focus:** before changing anything, measure the real runs, and check that the bots used for tuning resemble the player.

A new tool, `tools/v2/analyze.ts` (`npm run v2:analyze`), re-runs a log step by step and records:

- threats on screen (average and peak);
- the share of wave time with nothing on screen ("quiet");
- the share of time with no round loaded ("dry");
- the player's shots versus CIWS shots;
- threats aimed at the carrier and damage it took;
- how long each heavy missile lived and how many hits it took.

Bot mode runs the same meter over bot games.

**Findings, from the player's two runs:**

1. **The screen is empty for a third to half of every wave.**
   - Map 1: 1.0–1.9 threats on screen on average; empty 33–52% of the time.
   - Map 2: 0.9–1.5 threats on screen; empty 34–60% of the time.
   - The peak is 4–11 threats for a moment, then nothing. This is the "pretty easy" feeling: long gaps with nothing to do.
2. **The carrier is never in danger.**
   - It ended both runs at 12/12.
   - No threat aimed at it until wave 6, and even then only 1–6 per wave.
   - Losing by carrier is one of the two loss conditions, but it never comes into play.
3. **At level 3, the CIWS plays the game for you.** On map 2 (CIWS taken three times):
   - wave 8: 5 player shots against **47** CIWS shots;
   - waves 9–10: 24 player shots against 31 CIWS, and 35 against 43.
   - The player's job turns into watching.
4. **Heavy missiles fall too easily.** Map 2, 7 heavies:
   - Those that were engaged died in 2.2–6.2 s after exactly 4 hits.
   - The 2 that got through were never engaged at all (0 hits). They were missed, not out-tanked.
5. **Drafts go dead late.**
   - Resupply, the filler card offered when no other card in a draft can be taken, was picked once on map 1 and twice on map 2 (waves 8 and 9). By then all three slots were full and nothing new could be taken.
   - This is the slot lock-in the player described.
6. **Formations barely matter.** The player switched twice on map 1 (spread, then box) and once on map 2 (box), then never again. Formations only change lanes. Ship throughput is identical by design, and nothing about the threats rewards one choice over another.

**Bot fidelity.** Same map, max flow, 8 seeds:

- **Map 1, "sharp" bot:** 0.0 ships lost; empty 41–63% of the time; dry 0–6%.
- **Map 1, "spammer" bot:** 2.1 ships lost; empty 28–39%; dry 17–48%.
- **The player:** 2 ships lost; empty 33–52%; dry 2–19%.
- **Map 2, "sharp" bot:** a similar picture; it never lets the CIWS take over, because its picks differ.

The player sits between "sharp" and "spammer": losses like spammer, ammo discipline closer to sharp. So the tuning target is "sharp" losing a few ships per run and "spammer" often losing, with the player's own logs as the final check.

**The three changes chosen from the logs:**

- **(A)** Fill the empty screen time with more threats on screen at once (findings 1 and 4).
- **(B)** Make the carrier a real target (finding 2).
- **(C)** Keep the CIWS a last-ditch helper instead of the main gun (finding 3).

Findings 5 and 6 are the player's own slot and formation asks, handled in cycles 4 and 5.

## Cycle 2: the three changes chosen from the logs

**Focus:** (A) a busier screen, (B) carrier pressure, (C) a CIWS that helps without taking over.

**Changes:**

- **Raids** (`RAID` in config.ts; `startWave`):
  - Instead of every launch spread evenly across the wave, launches bunch into raids every 5 s, each landing within 4.5 s, drawn from several bases.
  - 30% of drone swarms still trickle in between raids.
  - Wave counts are now about 1.25× the drones and 1.15× the missiles of round 2. Waves 1–2 stay close to the old numbers.
- **Carrier strikes** (`CARRIER_STRIKE`):
  - Guided missiles go for the carrier 40% of the time from wave 3 (was 30%, from wave 6).
  - Ballistics: 25% from wave 4. Heavies: 40%. Supersonics: 30%.
- **Last-ditch CIWS:**
  - Range 190/240/290 (was 260/340/420); cooldown 1.1/0.9/0.7 s (was 0.8/0.6/0.45).
  - It now takes threats aimed at the carrier first.
  - The card text says so.

**Tuning runs.** Map 1, max flow, `npm run v2:analyze`; 12 seeds, except where 16 is noted.

| Rules | sharp | average | spammer | casual |
|---|---|---|---|---|
| Round 2 (before) | 12/12 cleared, 0.0 sunk | 12/12, 0.0 | 10/12, 2.0 | 10/12, 3.0 |
| Raids only | 8/8, 0.4 | – | 4/8, 4.5 | – |
| Raids + 1.5× counts | 9/12, 2.8 | 9/12, 2.6 | 1/12, 5.5 | 1/12, 5.7 |
| Raids + 1.25× counts, 3.5 s window (16 seeds) | 15/16, 1.0 | 16/16, 0.8 | 4/16, 4.8 | 5/16, 5.1 |
| **Final:** 1.25×, 4.5 s window, raids every 5 s | 12/12, 0.9 | 10/12, 1.6 | 6/12, 4.3 | – |

- 1.5× was too much: the spammer cleared 1/12 and started losing ships from wave 3.
- The spammer bot matched the player's outcome in round 2 (2.0 vs 2 ships lost). The final rules put it at 4.3 lost and a 50% clear rate.
- The player keeps more rounds loaded than the spammer, so their expected result is somewhere between the average and spammer rows. That means losing ships on map 1 but clearing it. This is an estimate until the next real log arrives.

**Results against the goals:**

- **S8 (you stay the defender): met.**
  - Map 2 with a bot that takes CIWS first (Retarget/Twin/CIWS, the player's own build): at most 10 CIWS shots in any wave against 54 player shots.
  - Before: 47 CIWS shots against the player's 5.
- **S7 (challenging):** the carrier now takes damage in late waves (spammer: 0–2 hits per wave from wave 6). Ships are lost on map 1 by every skill.
- **S6 (busy screen): partly met.**
  - Spammer: 2.2–3.3 threats on screen on average (was 1.5–2.5); empty 26–39% of the time (was 28–39%).
  - Average bot: 1.2–2.8 on screen; still empty 31–53%. A careful player kills a raid within seconds, so the screen clears between raids.
  - Spacing raids closer (every 7 s → 5 s) barely moved this. The empty share is set by kill speed, not arrival pattern.
  - More threats per wave would push difficulty past "achievable". This is left as a known trade-off: busier screens come mainly from the tougher threats (heavies, cycle 3) rather than more drones.

**Visual check:** a built game, wave 9 on map 1, screenshot taken during live play with clicks.

- The raid reads clearly: a swarm from one base, reticles on its targets.
- **Bug found:** repeated taps while out of ammo stack "RELOADING" labels on top of each other into an unreadable pile. **Fixed:** only one label is shown at a time.

**Tests added:**

- Raids are at least 1.8× denser than an even spread.
- Carrier-aimed missiles appear from wave 3, not wave 2 (apart from the existing no-ship-in-reach fallback).
- The CIWS ignores threats out of range and takes a carrier attacker before a nearer ship attacker.
- The mothership test now counts mini-drones spawned rather than alive. The raid change reorders the threat RNG, and one mini-drone reached a nearby ship before the second spawned.

## Cycle 3: heavy missiles, the Overdrive glow, upgrade icons

**Focus:** the player's three direct visual and feel requests.

**Changes:**

- **Heavy missiles: 8 HP (was 4).**
  - Drawn slightly larger (64×17).
  - The HP display is now a fixed-width bar with one segment per hit, with lost hits shown faint. Eight separate pips would have been 124 px wide.
  - The debut hint now reads "eight hits. Pour fire on it early."
- **Overdrive** pulses a cyan halo around the carrier. Its outline and deck tint go cyan, and a ring around the ship drains as the 5 s run out.
- **Upgrade icons** (`src/v2/ui/icons.ts`): one 32×32 line icon per card, each in its own colour. They appear:
  - beside the card name;
  - as a colour bar along the card's top edge;
  - at 16 px in the slot chips.
  - Locked cards dim their icon.
- **Not changed:** the supersonic's warning line before it fires. The player singled it out as working well.

**Checks:**

- **Screenshots** of the built game at desktop size and iPhone landscape size (874×402):
  - Overdrive on: halo, cyan hull and timer ring, unmistakable at phone size. Overdrive off: no trace of it.
  - Heavy: the 8-segment bar sits compactly above the missile; 3 lost hits show as faint segments.
  - Draft at phone size: every card and slot chip shows its icon; the three cards fit one row with no clipping; the locked card's icon is dimmed.
- **Heavy balance,** map 2, max flow, 10 seeds:

  | Bot | Heavies shot down | Avg life when shot down | Hits taken by those that got through |
  |---|---|---|---|
  | average | 77% | 5.1 s | 3.3 |
  | spammer | 57% | 5.1 s | 3.2 |

  - The player's run under the old 4 HP: every engaged heavy died in 2.2–6.2 s after exactly 4 hits.
  - Heavies are now a real ammo sink, and some get through even when engaged.
- **Map 2 clear rates:** sharp 8/10 (1.8 sunk), average 9/10 (2.7 sunk), spammer 3/10 (3.8 sunk, carrier left at 6.4/12).
  - Heavies aimed at the carrier (40%, 6 damage each) bring the carrier into play. The spammer's carrier loss is noted for the balance cycle.
- The heavy unit test now reads the HP from config and checks it is 8 (7 hits leave it alive). 47/47 V2 tests pass.

## Cycle 4: swapping cards when the slots are full

**Focus:** the player's lock-in complaint ("you're just locked in at whatever you pick").

**Design:**

- With three cards held, a new card in a draft is marked **SWAP IN** (was SLOTS FULL).
- Tapping it enters swap mode:
  - the three held cards turn into pulsing buttons, each with a ✕;
  - a gold prompt explains the swap and offers Cancel;
  - the other cards step back.
- Tapping a held card completes the swap: it leaves with all its levels, and the new card starts at level 1.
- Leveling up a held card works as before.
- Resupply is still offered whenever nothing can be taken without a swap, so keeping your build is always an option. Its card now reads "Keeps your cards".

**Code:**

- `canSwapIn(levels, id)`.
- `pickUpgrade(g, id, replace?)`: refuses a `replace` that isn't held. When the swapped-out card was Bigger Rack or Shore Battery, it trims the loaded rounds to the smaller rack.
- Logs record a swap as `[step, 'u', card, replaced]`. Old logs, with no 4th field, still replay unchanged. `replay` and the analyzer pass the replaced card through.

**Checks:**

- **Unit tests:** a swap removes the replaced card and its levels; a `replace` that isn't held is refused; dropping a level-2 rack trims ammo to the base rack. A full bot run with a swap replays exactly: same steps, score, losses and loadout.
- **Browser, iPhone 16 Pro size with touch** (new section in `e2e/v2.mjs`):
  - a full-loadout draft offers a swappable card;
  - tapping it shows exactly 3 replaceable chips, and Cancel leaves swap mode;
  - tapping the card again, then CIWS, gives `{twin: 2, speed: 1, blast: 1}`, and the next wave starts.
- **Problems the screenshot exposed, both fixed and re-shot:**
  1. The stepped-back cards used opacity, so the ship-flow slider showed through them. They are now solid with dimmed ink, the same fix as locked cards in round 2.
  2. The chosen card's gold ring was clipped at the panel edge. It now has 3 px of room.

## Cycle 5: formations as a real decision

**Focus:** "I don't see a whole lot of strategy" in the formations.

**Why they didn't matter:**

- Lanes sit 96–270 px apart and ships in a lane 66 px apart. Ballistic splash (50 px) and heavy splash (55 px) almost never reached a second ship, whatever the formation.
- Every formation moved the same ships per minute at the same speed.
- So choosing one changed the picture, not the outcome.

**First design: every formation gets a trade-off.**

- Column: fast, but splash chains to the ship behind.
- Pairs: balanced.
- Spread: splash only ever hits one ship, but slow.
- Box: −1 damage armour, but splash reaches far.

Tested with the average bot holding one formation for a whole game, 20 seeds per cell:

- **Box dominated map 1:** 0.5 ships lost against 1.1–1.2 for the rest. The armour halved guided and direct ballistic hits, and its splash weakness barely cost anything.
- **Box nerfed:** speed ×0.8, splash ×1.8, and splash spilling onto neighbours ignores the armour. It then sat within noise of the others: 0.8 on map 1 against 1.1–1.2; on the Island, 3.3 against 2.8–3.6.
- **Whole-game check:** a bot that switched formation to suit what was on screen did *not* beat fixed Pairs (Harbor: 4.0 against 3.4 ships lost).
  - The cause: every raid mixed all threat types at once, so there was never one right formation to switch to.
  - Each switch also reshuffles the convoy's lanes.

**Second design: themed raids with a warning.**

- **Themed raids:** each raid is now one family of threat:
  - **swarm:** drones and motherships;
  - **barrage:** ballistics, heavies and clusters;
  - **volley:** guided missiles and supersonics.
- **The warning:** 2.5 s before a raid, the bases about to fire get pulsing rings in the raid's colour. A callout names it and its counter: "⚠ BARRAGE INBOUND · splash · Spread halves it". This is in the spirit of the supersonic's lock-on line, which the player liked.
- **Spread** was rebuilt as the anti-splash formation: splash weapons do half damage (rounded up, minimum 1) and hit one ship only.
- **The picker** shows each formation's strength (green) and weakness (red) as tags.

**The formation lab** (`npm run v2:formation-lab`) is a full convoy hit by one raid of a single type, 16 seeds per cell. Ships sunk:

| Raid | Column | Pairs | Spread | Box |
|---|---|---|---|---|
| No defence, barrage (before the Spread rework) | 2.00 | 0.44 | 1.06 | 3.44 |
| No defence, barrage (after) | 2.00 | 0.44 | **0.13** | 3.44 |
| No defence, volley | 0.81 | 0.69 | 1.00 | **0.13** |
| Defended by the average bot, barrage | 1.06 | 0.25 | **0.06** | 1.13 |
| Defended, volley | 1.88 | 2.00 | 2.50 | **0.25** |
| Defended, swarm | **0.94** | 1.50 | 1.56 | 1.13 |

- Each raid type now has a clear best formation, and the wrong pick is costly: Box in a barrage loses 1.13 against 0.06 for Spread; Spread in a volley loses 2.50 against 0.25 for Box.
- Pairs is the safe middle.
- Column's speed only pays when someone is shooting, which is why it wins the defended swarm but not the undefended one.

**Whole-game check with themed raids.** The average bot answers each warning (barrage → Spread, volley → Box, swarm → Column) and is compared with fixed Pairs, 20 seeds:

| Map | Answering warnings | Fixed Pairs |
|---|---|---|
| Strait | 0.3 sunk | 0.4 |
| Gauntlet | 2.4 sunk, 13/20 cleared | 2.6 sunk, 16/20 |
| Island | 2.0 | 1.9 |
| Harbor | 2.9 sunk, 15/20 | 3.4 sunk, 12/20 |
| Archipelago | 3.2 sunk, 13/20 | 3.3 sunk, 11/20 |

- Answering helps on most maps; Gauntlet clears go the other way, inside the noise.
- The gain over a whole game is smaller than in the lab, because ship losses also come from attention and ammo.
- Themed raids also made whole games easier (map 1 Pairs: 1.2 → 0.4 ships lost). Grouping by family takes away the mixed pressure. **This goes to cycle 6.**

**Visual check,** iPhone landscape:

- **Problems found:**
  1. The top-centre callout covered an enemy base on the Island map.
  2. The formation picker, with full descriptions, filled almost the whole screen height.
- **Fixes:**
  1. The callout now sits at each map's callout point, which is clear of bases and lanes, and lifts above the wave banner when both show.
  2. On short screens the picker shows only the name and the strength/weakness tags.
- Re-shot: the base is visible, the callout reads clearly on the bottom shore, and the picker is compact.

**Tests:**

- Box takes 1 from a guided hit where Pairs takes 2.
- A heavy that sinks a Pairs ship does 3 damage to a Spread ship instead of 6.
- A ballistic hits all three ships of a Box and one ship of a Spread.
- Speeds are ordered Column > Pairs > Spread > Box.
- Every raid's non-drone launches belong to one family, and the warning is up before the first raid.
- 53/53 V2 tests pass.

## Cycle 6: balance across all five maps, frame rate, regressions

**Focus:** themed raids eased the game (cycle 5), and map 1 had to stay a challenge for a player who has never lost. Then: nothing regresses.

**Map 1 for careful play.** Re-baselining showed the sharp and average bots losing only 0.3 and 0.5 ships on map 1.

| Strait, max flow, 20 seeds | sharp | average | spammer |
|---|---|---|---|
| Themed raids, no extras | 0.3 sunk, 16/16* | 0.5 sunk, 16/16* | 4.9 sunk, 7/16* |
| + supersonics wave 6+, heavies wave 8+ | 1.4 sunk, 19/20 | 1.1 sunk, 18/20 | 5.2 sunk, **2/20** |
| **Final:** supersonics wave 6+, one heavy in wave 10 | 0.6 sunk, 19/20 | 0.8 sunk, 20/20 | 4.5 sunk, 8/20 |

\* 16 seeds.

- Heavies from wave 8 crushed the spammer, the bot whose outcome matched the player's in round 2. An 8-HP heavy drains the ammo of anyone who taps freely.
- Keeping supersonics, which test reaction time and which the player liked, and holding the heavy back for the finale gives every skill losses without making the map a wall.

**Final matrix,** max flow, 16 seeds; clears and average ships sunk:

| Map | sharp | average | spammer |
|---|---|---|---|
| 1 Strait | 15/16, 0.7 | 16/16, 0.9 | 5/16, 4.9 |
| 2 Gauntlet | 14/16, 1.8 | 13/16, 2.6 | 7/16, 4.2 |
| 3 Island | 11/16, 2.0 | 12/16, 1.6 | 4/16, 5.1 |
| 4 Harbor | 11/16, 2.8 | 9/16, 3.1 | 1/16, 5.4 |
| 5 Archipelago | 12/16, 2.0 | 8/16, 3.5 | 2/16, 4.3 |

- Average-bot clears fall map by map from 16/16 to 8/16. Every skill now loses ships, and the carrier ends around 7–11/12, where round 2 left it untouched.
- The spammer's map 1 vs map 2 inversion (5 vs 7) is within 16-seed noise; it was 8/20 on map 1 at 20 seeds.
- These bots never change formation. A player answering raid warnings does a little better (cycle 5).

**Frame rate,** Chromium at 874×402, DPR 2, Archipelago endless wave 14:

- Busy scene (17 threats, 16 ships), unthrottled: p95 16.8 ms, 0% slow frames.
- Under 4× CPU throttle, two runs: 3% and 1% slow frames (over 20 ms). The adaptive resolution steps down as designed.
- This is in line with rounds 1–2 (1–3%). The first sample caught only 4 threats, so the check was re-run waiting for at least 10 on screen with a slower defender.

**Regressions:**

- `npm test`: 778 passed.
  - One failure on the first run was this cycle's own change: the Strait-extras test still said map 1 fields only drones, ballistics and guided missiles.
  - It now checks supersonics from wave 6 and exactly one heavy in wave 10.
- `npm run e2e:v2` passes, including the iPhone 16 Pro checks and the new swap flow. `npm run e2e:v2:log` (wave-end, background and final saves) passes. The V1 smoke test passes.
- **Log version bumped to 3.**
  - The rules changed, so a round-2 log can no longer reproduce its game on this build.
  - `v2:replay` and `v2:analyze` now say so instead of printing a misleading DIFFERS.
  - Both of the player's round-2 logs were analysed in cycle 1, before any change.

## Round 3 summary

| Goal | Status |
|---|---|
| S1 Overdrive is obvious | **Met.** Cyan halo, hull and draining timer ring, checked on and off at phone size |
| S2 Swap cards when slots are full | **Met.** Tap the card, then the card it replaces; Cancel; Resupply keeps the build. Logged and replayable. e2e by touch at iPhone size |
| S3 Upgrade icons | **Met.** One icon and colour per card, on cards and slot chips |
| S4 Tougher heavies | **Met.** 8 HP: 23–43% get through even when engaged (was 0 of the engaged ones) |
| S5 Formations are a decision | **Met in the lab:** each raid type has a clear best formation, and the wrong pick costs ships. **Partly met in whole games:** answering warnings helps on most maps, by a modest margin |
| S6 Busy screen | **Partly met.** Spammer-like play sees 2–3+ threats on screen; a careful player still clears raids fast enough that the screen is empty ~30–50% of the time |
| S7 Challenging but achievable | **Met by the bots.** Every skill loses ships on map 1; the carrier is pressed. The player's next log will tell |
| S8 You stay the defender | **Met.** CIWS ≤10 shots per wave against the player's 54 (was 47 against 5) |
| S9 Nothing breaks | **Met.** 778 tests, e2e (desktop, iPhone, swap, logging), V1 smoke, 60 fps |

**Limits:**

- All balance after the changes comes from bots. The player's two logs set the baseline but can't replay under the new rules.
- "Busy" depends on kill speed: a sharp player still empties the screen between raids.
- Map 1 for spammy play (5–8 clears out of 16–20) may be on the hard side. The next real log decides.
