# V3: fixes from the 2026-11-20 playtest

Seven notes from your 2026-11-20 playtest (Island v31, Marrow, Behemoth and Kesh v32), and your four logs added to the bot fit. Built on round 9 (log v34) and the Needle of Bosk (log v35), so the game is now **log v36**.

- **Before** = the base with round 9 merged (log v34).
- **After** = this branch: log v35 for the measuring, before the Needle merged; now log v36.
- **The Needle:** checked again after it merged (below).
- Bot numbers come from the "you" bot with your Armory, 12 seeds a row, unless the row says otherwise. A gap under about 1 ship a run is noise.

Screenshots: `docs/design/img/playtest-fixes/` (`before-*` and `after-*`).

## The Tide moves as a whole and strands ships; Sowers' Hold is automatic; first-load sizing (log v68)

> Tide: "the whole water should pull back ... the ships left in the low tide are just stuck until the next high tide", "tide times should last longer", "it should be slower". Sowers: "just make [the vault command] automatic ... make mines spottable about a distance 1.5 from what it is now ... right before the ships collided with the mine, about 1/3 the spotting distance, the ship in the path will pause until that mine is shot down". Bug: "I still have to rotate my screen when it initially loads as it is not sized right."

- **The Tide's sea** (`sim/tide.ts` `seaEdges`, `ui/features.ts` `drawTideSea`): at low water the whole sea draws back from both shores into the deep channel's bed (the channel and 34 px beside it stay wet); everything else, the flats lane and the carrier's berth included, is wet sand drying away from a moving line of foam. It comes back the same way. The old strip of sand growing in from the bottom of the flats, and the strip of water left behind the carrier, are gone.
- **Slower and longer:** the tide falls over 8 s and rises over 9 s (4 and 3 before); low water lasts 12 to 28 s a wave (9 to 20); the campaign's clock is 55 s high, 30 s low (25 and 20). The gauge turns gold 8 s ahead (5 before) and says "LOW TIDE · ships aground".
- **Stranding:** nothing crosses to the deep channel any more. A ship on the flats lane when the water drops under 0.55 slows, is stopped below 0.3, and stays aground (a bank of wet sand about it) until the tide is back over 0.55. New ships still take the flats only at high water. Low Water, the boss, keeps its intent: the round's tide out early and the shore firing at the crowd; the crowd now includes the hulls stuck on the flats.
- **Sowers' Hold** (`sim/game.ts` `minePace`): the big button is gone from the map (`MapConvoy.commands: []`, `autoHold: true`; `CONVOY_REV` 4). A ship whose course would put it on a mine in sight within a third of the spotting time (1.25 s) stops by itself, a gold pause mark over it, until the mine is shot or has drifted past its course; the ships behind queue. Mines surface 3.75 s ahead (2.5 s before). The campaign (no lab convoy layer) is unchanged. The command itself stays in the engine for the lab: `?hold=1` (or `tune: { hold: true }` in a convoy setup) puts the button back on a map with none, and the tests and e2e use that.
- **First-load sizing** (`ui/app.ts` `viewport`, `settle`, `recheck`): see the report in the PR. The layout reads a third witness of the screen's size (a fixed box the browser sizes itself), re-measures on the first touches, scrolls and focus, keeps measuring for 6 s after a launch (1.5 s before), and puts the page back to zoom 1 if iOS left it zoomed. e2e `v3-ios-viewport.mjs` checks 4 and 5 (stale window and visual viewport readings of the upright phone; opened upright then turned) fail on the old code.
- **Numbers** (the bot, 192 seeds; band 50 to 70%): see the PR description for before and after. boss rounds get a little more fire.
- `LOG_VERSION` 66, `LOG_REPLAYS` `[66]`; the map-lab baseline was written again; pins moved with `pins.py 65 66`.

## Watch mode in the Test Lab: watch the bot, take over any time (log v65)

> "with the test we set up, like for one of the maps for example, I should be able to run a simulator on that too so I can do my testing faster. So basically it would allow me to watch it be played and I can jump in at any time and make comments and play too. The game log should note that too, so it knows when it was a full playtest or had sim."

- **Start it:** every map card has **Watch** beside Play: a gold Watch button under Play on each Ready to test card, and an eye key (👁) beside each map's tile in the chapter grid. Watch plays the same card, setup, Test Lab Armory and seeds as Play, so the same run is judged; only the hands differ.
- **Who plays:** the **"you" bot** (`YOU` in `src/v3/sim/mimic.ts`), the persona fitted to your own logs with `tools/v3/bot-fit` (docs/design/v3-bot-refit.md): your tap rhythm, aim, pickups and boosts, noise included. It was already in `src/`, so nothing moved. It plays through the same calls a finger does, so its inputs are ordinary log commands. How close it is: its hands, aim and pickups are within a few points of yours; on a map it reads waves 1-5 about 1.3x your losses, waves 6-10 about a third of a ship high, and the boss rounds about 2x as hard (the recorded biases in the refit doc). It plays at 1x and, like you, now and then rushes a wave a little faster.
- **Watch it:** it starts at 1x; the speed button steps 1x, 2x, 3x, 4x, 6x, 10x; pause works as ever. The HUD says WATCH · BOT. While the bot plays, a tap on the field does nothing (no shot, no take-over), and its draft picks show before it takes them.
- **Take over:** the gold **Take over** button on the right rail (also on the pause menu, and on the draft while the bot picks) gives you the controls from that tick, back at 1x. Threat taps, holds, weapons, Focus, the golden bomb and the draft are all yours. **Let bot play** (same button) hands back, at the speed you were watching at. As often as you like.
- **Notes:** pause and write one as ever (the pause menu's Note, with the in-game keyboard). In a Watch run each note says who was playing (`by: 'bot' | 'player'`), the `wave`, and its tick (`step`).
- **The log** (v65): `control: { mode: 'watch', bot: 'you', segments: [{ fromTick, toTick, by }], botTicks, playerTicks, playerShare, switches, label }`, the label `'sim'` (the bot played it all), `'mixed'` or `'full playtest'`. The switches are the `'c'` commands, UI only, so the log replays exactly. The verdict saved with it carries `labResult.played`. `playKind(log)` reads any log's label (a dev watch log or a sweep's log is `'sim'`, an ordinary run `'full playtest'`).
- **The scorecard** says it under the title: "Mixed run · you played 42%, the bot 58% · 2 hand-overs", or "Watch run · the bot played all of it (sim)", with a Download log link.
- **The readers leave the bot out:** the bot fit (`tools/v3/bot-fit/fit.ts` `playerRun`) takes only hand-played runs whole; `measure()` for "you" reads only the ticks you played (tap rhythm, play time, reactions); `measureFun` keeps only your saves; `boosts.ts` skips Watch runs; the Test Lab page's run numbers (`scores.mjs` `runNumbers`) average hand-played runs only and count the rest as `bot`; `results.mts` marks a Watch verdict; `/api/playlog?all=1&played=hand` returns only hand-played logs.
- **Not kept to continue:** a Watch run is not saved to Continue later (the bot's own state is not in the log), as the dev watch mode before it. Retry wave and Skip to boss stay in Watch, with the bot at the controls.
- Nothing in the sim changed: a v64 log plays the same game. The version marks logs that can carry the new fields; the map-lab baseline was written again at v65.

## Test Lab Tools: one Armory setting, a real Tools sheet, no old testing (UI only, no log change)

> "you didn't need to add a button for all of them. You can make it a setting in the tools. Also overhaul the tools option there too: it just takes you to the bottom of the page there, and you can remove all that old testing down there. We should only have new tests show up in the new spot on top."

- **The hub** is now only the new tests: **Ready to test** on top (each card: its line, **Notes** and **Play**) and **All maps** by chapter (the 26 map cards, an "i" for each map's notes). The "⚓ Armory" line under each chapter and on each Ready card is gone.
- **Tools** (the key top right) opens a sheet over the hub in place; the hub does not scroll. ✕, a tap outside or Escape closes it. Its entries:
  - **Setup:** **Armory** (the Test Lab Armory editor as it was: chapter tabs, the ranges, Auto; Back returns to Tools) and **Call-outs** (All / Essential / Off: the game's own setting, the same as in Settings).
  - **Logs:** **Session report** (today's verdicts, notes, rewatch), **Send logs now**, **Download last log** (the newest test as a file).
  - **More:** **Map Analytics** and the **Feedback page**.
- **A map's notes** show the Armory the run will use in one read-only line ("Armory · Ch 2 Lv 2–4 · Quick Reload 2 · ..."); it is changed in Tools.
- **Removed from the hub (the old testing):** the event, enemy, weapon and combo card lists (75 cards), the round tally ("N to retest · N untested", "N of 101 tested"), **Next up**, **Play 5**, the Quick/Full length switch (the setup sheet in a run still has Length) and the hint about wave 5 starts. Their cards still exist and their links still open them (`v3.html?lab=diveBomber`, `?lab=ev-drone-storm`, `?lab=w-cadence`; the e2e scripts and tools use them). Their verdicts stay on the device and in the logs. **Save · next** after a test now stays among cards of the same kind, so a map test never leads to an old card.
- **Typing above the in-game keyboard:** the box being typed in (the verdict note, the pause menu's note) is now fitted to the visible screen above the keyboard's top edge, not to the screen's height less the keyboard's, so a panned or shrunk view can never put the box or its Save buttons under the keyboard. `e2e/v3.mjs` checks both notes upright and sideways with the in-game keyboard, and runs its phone-keyboard cases with `?keys=off` (the phone's keyboard only comes up when the in-game one is off).
- No sim or log change: the log stays where it was.
- Checks: `e2e/v3-lab-tools.mjs` (new), and `v3.mjs` and `v3-map-cards.mjs` updated for the hub without the old cards and Next up.

## Round 16: the left rail's leftovers are gone (UI only, log stays v61)

Your answer to round 15's two rail questions: *"Drop the slider and all that old stuff the new version is going on like the new hauls button the canal map"*. The big convoy button is now the only convoy control, in every game type.

- **Campaign and Free Play:** no ship-flow slider (SHIPS, "more ships, more points") and no formation button or picker. A run sails the campaign's own schedule (flow step 1, ×1.4 points a ship) in Pairs, as it always did when the controls were left alone. The first-map tips for the slider and formations (waves 2 and 3) are gone, and so is the formation advice on raid cards ("SWARM INBOUND · drones") and in the "what sank you" lines.
- **Test Lab:** no "CONVOY sails itself" note. A map with a command (Sowers' Reach: Hold) shows the big button at the foot of the rail; every other map shows nothing there, and the power-up timers sit at the foot instead. The setup sheet's Convoy row (Today's / Automatic / Formations / Commands) is gone too: its choices differed only by the slider and formation button. A comparison link's `?convoy=` still picks a policy for the bots and tools.
- **The sim is unchanged.** The flow and formation inputs (`'f'`, `'m'`) still replay, so old logs, saved campaign and Free Play progress and "Continue a run" load and play exactly as before (a run saved at a higher flow carries on at it). No new log version.
- **Full width** (*"make sure you use up that blank space we have on the left"*): the left rail's strip is gone in every game type; the battlefield runs from the screen's left edge (clear of an iPhone's island where the room allows) to the right rail, and Hold, the golden bomb, the power-up timers and Focus's button sit in a see-through dock over its lower-left corner, inside the safe area (view only: the world, the logs and saved runs are unchanged).
- **The bots are unchanged.** They give the flow and formation inputs through the sim, not the rail, so they keep working. In the Test Lab (every rebuilt map's numbers, the map-lab baseline) the Tactical policy refuses those inputs, so the bots already play the map's own convoy as you do. In a campaign or Free Play sweep the "you" bot and the personas still turn the flow up (steps 3-4) and switch to Spread or Box once, which you can no longer do. Stopping that changes the campaign bot runs that eight tests and the map-lab baseline pin (tried: 8 failures), so it is left for a bot-fidelity pass of its own (`playtest-fidelity`), with a log bump if it is taken.

## Round 15: your notes on Sowers' Reach and the Rig Field (log v55)

Your two chapter 3 logs of 2026-11-22 (v49): Sowers' Reach (won, fun 4, boss 5) and the Rig Field (won, fun 5, boss 3, waves 1-3 rated 1, 2 and 1). Both are in `tools/v3/bot-fit/logs/` (`v3-20261122034709-18316.json`, `v3-20261122040236-18317.json`). Lab only, under the encounter layer, as every rebuild: the campaign plays as before.

### 1. Sowers: the mines surface near a ship; a big Hold button

> "Have the mines surface once the ships are close to them and then the player has the option to hit a larger [Hold] button on the bottom left of the screen ... that button should glow when it is advantageous to use it, like when a ship is about to hit a mine." / "Mines don't need a warning system like the silos, they should just spawn."

- **Hidden mines** (`HIDDEN_MINES`, `hiddenMinesOn` in `data/encounters.ts`; `sim/game.ts`): every mine on the Sowers, the chutes' and the sown ones, the boss rounds' too, drifts out of sight. Nothing draws it, nothing can shoot it, and the bots do not see it (`released` is false for a hidden mine, so `worthShooting`, the helpers and the bots' notice clock all skip it). It **surfaces** when a ship's course (sailing on, or stopped where it is) would bring it onto the mine within `MINE.surface` = **2.5 s** (about 100-120 px), with a splash and a red ring as it bobs up. Deterministic: checked every third step from the step count.
- **No warning at the chutes:** a chute's mines light no ring and call no "SWARM INBOUND" (a raid of hidden mines alone is `quiet`); a sowing bomber's mine goes in with a small splash under the bomber, then is gone from sight.
- A hidden mine that drifts past the lane sinks unseen (it would only have held the wave open).
- **The big Hold button:** the map's command is one large button at the foot of the left rail (68 x 90 at 874 x 402; the power-up timers move up over it). It **pulses gold and reads "NOW!"** when Hold would help (`commandAdvised`): a surfaced mine a ship will sail onto within 2.6 s, or a shell in the air at water a ship has still to reach. It works for any convoy command a map has (today only Hold exists; the advice for another command would go in `commandAdvised`).
- **The bots:** the sharp convoy pilot (`--pilot=sharp`) now presses Hold exactly when the button glows. The tuning reads below use it: with the mines hidden, Hold is how a player answers a mine that surfaces in front of a ship, and the bot without it is no longer a fair stand-in (see the numbers).
- **The boss (the Carpet Run)** keeps its vees, their sowing and their rounds: the bombers still sow carpets ahead of the convoy, the mines now go in with a splash and come up in front of the ships.
- To keep waves 1-5 near their band: wave 2's curtain is three mines, not four; wave 3's two, not three; wave 4's west chute one, not two; wave 5's two, not three; wave 6's west chute two, not three.

### 2. The left rail: no command buttons, no note button

> "We should also remove the command and notes buttons on the left in every game type, test lab and production; the new buttons on the bottom left will replace command options for maps that have it."

- The rail's NOTE / RATE button is gone in every game type. Notes and volley ratings are on the pause menu ("Add a note" and "Rate last volley" outside the Test Lab; the Test Lab's pause menu has its Note), as your logs show you already used them.
- The command buttons in the middle of the rail are gone; a map with a command has the one big button at the foot of the rail (above). The golden bomb stays in the rail, centred.
- Campaign and Free Play keep the ship-flow slider and the formation button (those are today's convoy controls, not commands). If you meant those too, say so.

### 3. Rigs: they count shots, not damage

> "It has to basically consume X amount of your ammo to be destroyed, that way power-ups can't do a huge amount of hit points with one ammo."

- **Shots, not damage** (`SHOT_RIGS`, `shotRigs`, `rigShot` in `sim/game.ts`): a rig loses one for each shot that hits it, whatever the shot's damage: a Railgun round, a warhead, Deadeye, a powered-up shot all count 1. A seeker's three mini-missiles count a third each. An area weapon (a blast, Shrapnel's fragments, Scattergun's pellets, Thermobaric, an Orbital strike, a gunship's rounds) counts once a rig a step. A flak cloud or an Air Strike's burning row counts **once per rig for its whole life**: that was the big one, see below. The Nuke and the golden bomb count 3 (`PICKUPS.nukeStructure`, as before: "3 hits, not a kill").
- **The numbers:** a rig standing from the start takes **32 shots** (`RIG_SHOTS.rig`; it was 40 hits of damage), a relief rig on its tow **10** (was 8), docked **20**, a risen rig in the Rig Barrage **8**.
- **Your log** (`tools/v3/rigs/killtimes.ts`, replayed on the v49 build): you had all four rigs down 65 s into the run. Two of them took 8 and 11 shots by the new count: the Flak cloud did 30-33 of their 40 hits. Under the new rule those two take 32 shots each, three to four times what they took; a rig you brought down with the plain gun alone (40 shots) now takes 32. Overall the rigs last much longer against power-ups, which is what your note asked for. 32 rather than 40 because at 40 the bot (which shoots rigs mostly with the plain gun) won 42-45% and lost about a ship in waves 1-5.
- **The count on the rig:** a dark pill over each rig with a crosshair and the shots left, big enough to read on the phone, with a bar under it (pips, one a shot, for a count of 14 or under: a relief rig, a risen one).

### 4. Rigs: the tow-in

> "The bringing in of the oil rig was hilarious, keep that and improve that animation a lot."

The same tow, drawn again (`ui/features.ts`, `drawTug`, `drawRig`): a red tug with a wheelhouse, a funnel trailing smoke, a white bow wave and the churn of its screw; a tow line from the rig's deck to the tug's hook that sags in a curve; the rig rolling a little on its legs, pushing a bow wave and leaving a wake. As it nears its station the tug eases off to one side and the line goes slack. Docking: a splash ring spreads round its legs, spray goes up, the rig dips and settles with a last rock, and the tug casts off and steams away (`dockT`, `towDir` on the rig, drawing only). It reads at phone size: the tug is drawn a little over life size.

### 5. Rigs: busier early waves

> Waves 1-3 rated 1, 2 and 1.

More easy drone strings off the two drone rigs: wave 1 four drones in two strings (was one string of two), wave 2 three strings (was two), wave 3 one (it had none). Wave 1 still loses no ship for any bot (an earlier or western string did, so it stays late and off the east rig). Waves 3-5 send a little less of their own to make room (a smaller swarm on each), and the Rig Barrage's first round fires two volleys, not three.

**A bug found on the way:** since v49 a relief rig the wave planner drew could be handed to a truck or a pop-up launcher, which then fired the rig at a ship like a missile (seen at (800, 84) over the far shore; your log's "New threat: rig" on wave 5 was probably one). A structure is never a truck's load now.

### Bot numbers (192 seeds, 900-1091, normal runs; tough runs for the cliff check)

"Before" is the map cards' own reads (v48 Sowers, v49 Rigs: mines in sight, rigs by damage, the bot never holding). "After" is this build; on the Sowers the bot holds when the button glows (`--pilot=sharp`). `python3 tools/v3/sowers/read.py` and `tools/v3/rigs/read.py --seeds=192 --armory=...`.

| Map, Armory | Won before → after | Waves 1-5 lost before → after | Boss r1 / r2 / r3 after |
| --- | --- | --- | --- |
| Sowers, usual | 59% → **53%** | 0.72 → **0.94** | 0.97 / 1.23 / 1.71 |
| Sowers, latest | 56% → 48% | 0.90 → 0.98 | 0.74 / 0.89 / 1.29 |
| Sowers, plating | 83% → 82% | 0.47 → 0.58 | 0.58 / 0.62 / 0.90 |
| Sowers, usual, the bot never holds | 59% → 16% | 0.72 → 1.67 | 1.38 / 1.13 / 1.76 |
| Rigs, usual | 64% → **53%** | 0.82 → **0.80** | 0.77 / 1.07 / 2.02 |
| Rigs, latest | 40% → 21% | 1.33 → 1.67 | 0.86 / 1.45 / 1.64 |
| Rigs, plating | 89% → 85% | 0.57 → 0.60 | 0.26 / 0.49 / 1.01 |

(The Sowers' latest, plating and never-holds rows were read one trim earlier: wave 6 one mine more; on the usual Armory that trim moved waves 1-10 by 0.02.)

Tough runs, the usual Armory (the cliff check):
- Sowers: .02 .20 .21 .36 .25 .53 .55 .80 .83 1.38, boss .96 1.27 1.75. One step a little over double: wave 5 to 6 (0.25 to 0.53, 2.1x).
- Rigs: .01 .07 .24 .24 .38 .73 .67 .72 1.06 1.27, boss .81 1.11 2.16. No step doubles (the largest 1.92x, wave 6).

Along the way (96 seeds, usual Armory): mines surfacing at 1.8 s, the bot not holding, won 6%; 2.2 s with Hold 48%; 2.4 s 64%. Rigs at 50 shots (tows 10, docked 25, risen 10) won 34%; at 40, 42-45%; at 32, 52%.

### Checks

- `tsc`; `vitest --exclude '.claude/**'` (81 files, 1899 tests, all pass); a new `tests/v3/round15.test.ts` (hidden mines: on for the Sowers under the layer only, a mine starts hidden and out of reach, surfaces before it reaches a hull, no chute lights a warning, the campaign's stay in sight, the Hold advice; rigs: on for the Rigs only, RIG_SHOTS, a shot is one whatever its damage, a seeker a third, an area weapon once a step, the Nuke three, a flak cloud once).
- Changed tests: `encounters.test.ts` (a Sowers mine is not warned of; the rig tests bring a rig down with the Nuke or shot by shot; the Rig Barrage test plays seed 220, where the tryhard bot reaches all three rounds now; the Rigs' filler on waves 1-6), `scorecard.test.ts` (v55), the version pins (`pins.py 52 55`).
- `npm run v3:map-lab -- baseline`: only the version and content hash changed; written with `--write`; replays exactly with telemetry on and off.
- `vite build`, `vite preview` on a free port, and the e2e scripts `v3.mjs` (notes and the volley rating now from the pause menu; no note button in the rail), `v3-map-cards.mjs`, `v3-encounters.mjs`, `v3-map-lab.mjs`, `v3-convoy.mjs` (the Hold button, now the big one, still the one command), `v3-ios-viewport.mjs`: all pass. Overwritten screenshots in `docs/design/img` restored.
- Screenshots (874 x 402, one pixel a point; `tools/v3/playtest-fixes/round15-shots.mjs`): the glowing Hold button with a surfaced mine (Sowers, wave 5), a tow mid-approach and the rigs' shot counters (Rigs, wave 5).

### For you to decide

- **Hold is now the Sowers' answer.** With the mines hidden until 2.5 s out, the bot that never holds wins 16%; holding when the button glows, 53%. Is 2.5 s a fair moment for you on the phone? If it feels too tight, `MINE.surface` 3 is one number; if too easy, 2.
- **Rigs at 32 shots, not 40:** against the Flak and Orbital you used they now last three to four times as long; against the plain gun a little less than before. 40 cost the bot ten points of win rate. Say if they should be sturdier still.
- **The Wide Warhead set on the Rigs** falls to 21% (a warhead no longer counts extra against a rig, as asked).
- **Waves 1-5 on the Sowers: 0.94** for the usual Armory, a little over the 0.8 asked, and one tough step at 2.1x (wave 5 to 6). Each mine is far more dangerous hidden; trimming more mines would take the map's mechanic out of its early waves.
- **The left rail:** in the campaign and Free Play the ship-flow slider and the formation button stay (they are not commands). Remove them too?
- **The "CONVOY sails itself" label** stays at the foot of the rail on a lab map with no command. Keep or drop?

## Busier early waves (log v47)

Your chapter 2 playtests (2026-11-20) rated waves 1–6 fun 1–2 and intensity 1 on every map, with wave 1 the weakest every time. Your answer: *"just add in more drones and easy things to kill so it doesn't increase the difficulty but keep it busy. Doesn't need to be super significant. less is more here."*

**What changed.** Every rebuilt map's encounters in its early waves send a short string or two of **filler drones** on top of the wave (`BUSY` in `src/v3/data/encounters.ts`, a beat marked `filler`). They are plain attack drones:
- they come one at a time, 0.9 s apart, aimed at any ship;
- they come from a far silo, the back shore rather than one over a lane, so each has a long flight and is one easy tap;
- one shot down drops nothing, so the run's pickups and weapons come as they would without it.

The encounters themselves are unchanged: their beats, what they take out of the wave, and their call-outs. Most of the filler is in waves 1–3. The Battery, whose waves 3–4 already rated 3–4 and whose wave 1 is already the busiest of any map, gets wave 2 only. Test Lab only: the campaign plays as before.

| Map | Filler drones (wave: drones) | Total |
| --- | --- | --- |
| The Strait | 1: 3 + 2 · 2: 3 + 2 · 3: 3 | 13 |
| Kesh Hook | 1: 3 + 2 · 2: 3 + 2 · 3: 3 · 5: 2 · 6: 2 (east silo only) | 17 |
| Lee of Marrow | 1: 3 + 2 · 2: 3 + 2 · 3: 3 · 4: 2 | 15 |
| The Gauntlet | 1: 3 + 2 · 2: 3 + 2 · 3: 3 · 4–6: 2 each | 19 |
| Harbor Mouth | 1: 3 + 2 · 3: 3 · 4–6: 2 each | 14 |
| The Island | 1: 2 · 3: 2 (north shore only) | 4 |
| The Behemoth Run | 1: 3 · 2: 3 · 3: 3 | 9 |
| The Needle of Bosk | 1: 3 + 2 · 2: 3 + 2 · 3: 3 · 4: 2 · 6: 2 (north-west silo only) | 17 |
| The Archipelago | 1: 3 · 2: 3 · 3: 3 (east islet) | 9 |
| Saltgate Canal | 1: 3 · 2: 2 (after the truck) · 3: 3 · 4: 2 · 6: 2 | 12 |
| Battery Point | 2: 3 (early in the wave) | 3 |

The plan started as the same pattern on every map (two strings on waves 1–2, one on 3, two drones on 4–6). It was cut back wherever the bots lost more or won less with it:
- **The Island:** the only drone silo off its islands sits right over the north lane.
- **The Archipelago:** every drone silo is an islet among the lanes.
- **The Behemoth and the Strait** (waves 4–6), **Marrow 5, the Needle 5 and Saltgate 5.**

It was also left off wherever a wave's budget had no room: Kesh 4, Marrow 6, Harbor 2, and the second string on Saltgate 1.

**Measuring busyness.** The bot report has a new **Action per wave** table (`src/v3/sim/mapReport.ts`, `actionOf`; `tools/v3/map-report/quick.ts` prints it too). It has two rows:
- **on the board:** the threats on the board at a moment (threat-seconds over seconds of play, structures left out);
- **kills a minute:** threats shot down a minute.

**The wave budget.** A filler drone counts as a quarter of a launch (`FILLER_WEIGHT`): four easy drones weigh one launch. Every wave stays within ±15% of the same wave with the encounters off. The highest filled waves are Harbor 1 and Saltgate 1 (×1.13).

### Before and after (the "you" bot, your Armory, 384 seeds a map, normal runs)

These are 384 seeds a map, not 24. On 24 or even 96 seeds, the waves 1–5 losses moved by ±0.15 and the win rate by ±10 points with nothing changed but the dice. On, the filler plays; off, it is taken out of the same build.

| Map | On the board, waves 1–6 (before → after) | Kills a minute, waves 1–6 (before → after) | Lost waves 1–5 | Won |
| --- | --- | --- | --- | --- |
| The Strait | 0.9 0.9 0.8 1.6 1.2 1.0 → **1.2** 0.9 **1.0** 1.6 1.2 1.0 | 26 32 24 31 32 23 → **32** 31 **29** 30 32 23 | 0.33 → 0.37 | 48% → 48% |
| Kesh Hook | 0.9 0.7 0.9 0.7 0.8 0.6 → **1.1 0.9 1.0** 0.7 **0.9 0.7** | 32 27 28 26 28 24 → **37 33 31** 26 **30 26** | 0.33 → 0.26 | 47% → 43% |
| Lee of Marrow | 1.0 0.9 1.1 1.3 1.0 1.3 → **1.4 1.1 1.4 1.4** 1.0 1.3 | 32 29 34 38 28 34 → **40 36 39 40** 28 34 | 0.25 → 0.25 | 89% → 89% |
| The Gauntlet | 0.9 0.8 1.1 0.8 0.9 0.9 → **1.0 0.9 1.2 0.9** 0.9 **1.0** | 31 26 30 21 24 25 → **34 28 34 23 26 27** | 0.64 → 0.63 | 45% → 48% |
| Harbor Mouth | 0.8 0.9 0.6 0.7 1.1 1.0 → **1.0** 0.9 **0.8 0.8 1.1 1.1** | 24 31 17 20 27 25 → **30** 31 **21 23 29 27** | 0.86 → 0.90 | 29% → 25% |
| The Island | 1.0 1.0 1.3 0.9 1.1 1.1 → **1.1** 0.9 **1.4** 1.0 1.1 1.1 | 32 30 39 32 36 29 → **35** 30 **41** 32 36 30 | 0.67 → 0.75 | 45% → 43% |
| The Behemoth Run | 1.4 1.4 1.2 1.2 1.4 1.4 → **1.7 1.6 1.4** 1.2 1.4 1.4 | 36 38 36 34 34 34 → **42 41 40** 34 34 34 | 0.48 → 0.53 | 59% → 55% |
| The Needle of Bosk | 0.9 0.9 1.0 1.1 1.1 1.2 → **1.3 1.2 1.2 1.2** 1.1 **1.3** | 32 26 31 31 31 28 → **40 33 36 34** 31 **31** | 0.57 → 0.61 | 52% → 55% |
| The Archipelago | 1.2 0.9 1.2 1.5 1.4 1.9 → **1.4 1.0 1.3** 1.5 1.5 1.9 | 35 34 34 41 39 42 → **39 36 39** 41 38 42 | 0.63 → 0.65 | 53% → 56% |
| Saltgate Canal | 0.9 0.9 1.1 1.2 1.2 1.0 → **1.1** 0.9 **1.3 1.4** 1.2 **1.1** | 27 26 33 31 31 26 → **33** 27 **38 34** 31 **28** | 0.25 → 0.32 | 60% → 56% |
| Battery Point | 2.2 1.9 2.1 2.2 2.0 2.4 → 2.2 **2.2** 2.1 2.1 2.0 2.4 | 51 53 54 55 52 54 → 51 **57** 55 56 52 54 | 0.81 → 0.73 | 57% → 55% |

Bold marks a wave with filler. Wave 1, the weakest everywhere, gains the most. Most maps get about a fifth to two fifths more on the board and in kills a minute. The Island and the Gauntlet get about a tenth, since their filler is the lightest. The Battery's wave 1 is unchanged, and its wave 2 gains about a sixth.

Waves 1–5 losses move by at most +0.08. The Island is the most, and it stays inside the 0.4–0.8 target. Harbor Mouth and Battery Point were already a little over 0.8 before this, and they stay there. Win rates move by 4 points or less, which is about the noise on 384 seeds (±2.5 points a side).

What did not work:
- **Filler from a silo over a lane** cost up to 0.3 of a ship (the Island's wave 4, the Archipelago's waves 4–5).
- **A late string on the Island's wave 2** moved its losses from wave 5 to wave 4 on every block of seeds. Likely cause: the wave ran on longer, so the convoy was somewhere else when wave 4's encounter fired. Not proven.
- **Filler on the Battery's wave 1**, early or mid-wave, lost wave-1 ships for the no-Armory bots (0.02 → 0.17–0.20 a run for "you"). Late in the wave, its wave 7 rose. Its wave 1 is already the busiest of any map, so it is left as it was.

**The checks** (bot report, tough runs):
- **No-cliff, close-call, warning, wave-1 and budget checks:** they pass on 96 seeds as before on the Gauntlet and Saltgate, and on 192 seeds on Harbor Mouth.
- **The Island:** its wave 7 cliff flags with the filler and without (0.44 → 0.94 before), so it predates this work.
- **Battery Point:** its wave 7 cliff now reads just over the 2× line on 192 seeds (wave 6 0.36 → wave 7 0.79; before 0.48 → 0.74). That comes from a lower wave 6, on waves the filler doesn't touch, so it is likely dice.
- **24-seed reports:** they flip these flags both ways with nothing changed.

### The flaky e2e check (Skip to boss)

`e2e/v3.mjs`'s Test Lab check sometimes read the HUD as "WAVE 1 of 10" right after **Skip to boss**. The cause was in the app, not the test.

`play()` swaps in the new game and `begin()` closes the overlay synchronously, inside the tap. But the HUD was only drawn on the next animation frame. Until that frame, the counter still showed the run before. The check waits for "game on wave 11, overlay closed", which is true at once, then reads the HUD.

Alone, a frame usually fell between the tap and the check. In the full suite, frames come later, so it didn't. `begin()` now draws the HUD as the run starts, so the counter is right the moment the overlay closes.

## Round 12: your chapter 2 notes (log v41)

Your five chapter 2 Test Lab runs of 2026-11-20 (log v40: Saltgate, the Archipelago, the Needle, the Behemoth Run, the Island). Nine notes, all built. Your note on the Shield shielding every ship is left as it is: you took it back ("it works good how it is").

| # | Your note | What changed |
| --- | --- | --- |
| 1 | "just say like 1/3 ... the text wraps" | A boss round reads **Boss 1/3**: the HUD counter ("BOSS 1/3"), the boss intro's round card and the round's outcome card. Sentences (the Test Lab, the encounter notes) still say "boss round 1 of 3". |
| 2 | Cluster missiles "immediately break into the cluster munitions" | A cluster missile now **climbs for 1.3 s** before it can split (`CLUSTER.armAfter`), off the rail at 45% of its pace up to full. One launched next to its ships is a missile in the air for 1.3 s; it splits as soon as it is armed and in range. A far launch splits where it did. |
| 3 | Drone Screen's "(none while nothing is on screen)" | Gone from the card. |
| 4 | "NEW · The Narrows" | Reads **New on The Narrows** (New on Dark Water, New on Open War): the draft cards' band and the new enemies' first-sight notices. |
| 5 | Subs "overlap on the land" and "the land is blocking it" | Audited (below). A torpedo sub now surfaces only at a **good site**: its whole shadow clear of land with 12 px to spare, and a torpedo line over open water to at least 3 of 9 points down a lane. The Needle's east spot moved. |
| 6 | "The shield for the behemoth ship ... only covers a small [part]" | Each Shield bubble fits its hull and turns with the ship: the supertanker's is twice as long (82 × 28 px against 46 × 22). |
| 7 | "the level three helicopters ... overlap each other" | That is your **Gunship Pair at level 3** (your Behemoth run had it at 3). Each helicopter's hover was pushed in from the screen's edge on its own, so with the convoy coming in at the edge two or three hovered on one spot. The row of hovers now slides in whole, 270 px apart. (The enemy attack helicopters were checked too: none came within 230 px of another, so they are as they were.) |
| 8 | "I can't see the text when I'm typing" (the wave rating's note, iPhone home-screen app) | The wave rating's note box is now typed like the other notes: the screen fits itself to what the keyboard leaves, the box and Next at its top, scrolled into view. Its text is drawn light on the dark box on iOS too (`-webkit-text-fill-color`). |
| 9 | "an option to reset that wave ... or skip forward to the boss wave" | The Test Lab's pause menu and end screen have **Retry wave N** and **Skip to boss** (below). |

### Retry wave N and Skip to boss (Test Lab only)

- **Retry wave N:** the wave in play, or the one just lost, from its start, as it was: the same weapons, ships, score and Scrap. The run is replayed to the wave's start, as dev mode's retry does. In the boss rounds it says **Retry the boss rounds** (they follow on with no draft between, so the retry goes back to boss round 1).
- **Skip to boss:** on a map card's full run before wave 11. A new run from boss round 1, holding the weapons you hold now, at their levels.
- **The logs stay honest:** either one seals the run you were on (lost, or left) and keeps it with the card's tests. The new run has a new log marked `retry` (the run it came from, the wave, and `skip` for a skip). The bot fit leaves a retried or skipped log out. A skip's log carries its loadout in its lab setup, so it replays exactly.
- Not in the campaign or Free Play.

### The torpedo sub audit

`npx vite-node tools/v3/sub-audit/audit.ts -- --all` checks every map's sub spots, and the Behemoth Run's Wolf Pack water, as the game now does. `--play=N` also plays N seeds of each chapter 2 map (the "you" bot, your Armory, every wave) and checks every sub that surfaced. `tests/v3/round12.test.ts` holds the same line for every map.

| Map | Where | What was wrong | Now |
| --- | --- | --- | --- |
| The Island | its 4 spots | nothing: all clear, each with a line to 9/9 | as it was |
| The Behemoth Run | its 4 spots | nothing | as it was |
| The Behemoth Run | Wolf Pack water (1400, 738) | land under the sub's shadow | the packs take the good water first |
| The Needle of Bosk | east spot (1500, 252) | a torpedo line to 2/9 of the lane (the land blocks it) | moved to (1460, 292): 3/9, clear |
| Saltgate Canal | east spot (1480, 610) | a line to 2/9 of the canal | a sub passes it over (the west spot sees 3/9) |
| Saltgate Canal | the boss rounds' subs at (400, 610) | land under the shadow, and a line to 2/9 | **left for the Saltgate rework**: 12 of 78 subs in 4 bot runs, all in the boss rounds |

- Every other map's spots pass (chapters 1, 3 and 4 too; the Sharra Delta has none).
- Saltgate's data and its boss's sub placement are being reworked in parallel, so this round changes neither. The regular waves' subs there now pass over the east spot, through the shared code. The test lists that one spot as known.

### The bot on chapter 2 (your Armory, 24 seeds, every wave played under the normal loss limit)

`npx vite-node tools/v3/map-report/quick.ts -- --map=<map> --seeds=24`. Before = log v40 (#202); after = log v41.

| Map | Won, before | Won, after | Lost waves 1–5, before | after | Lost waves 1–10, before | after |
| --- | --- | --- | --- | --- | --- | --- |
| The Island | 38% | 42% | 0.46 | 0.46 | 4.25 | 4.38 |
| The Behemoth Run | 50% | 58% | 0.54 | 0.42 | 4.21 | 3.79 |
| The Needle of Bosk | 58% | 58% | 0.67 | 0.42 | 3.33 | 3.17 |
| The Archipelago | 46% | 42% | 0.46 | 0.46 | 4.33 | 4.25 |
| Saltgate Canal | 58% | 46% | 0.50 | 0.71 | 3.25 | 3.67 |

- Waves 1–5 barely moved (under a quarter of a ship either way); at 24 seeds a gap of 10% won is noise.
- **Saltgate Canal is the one that moved:** checked again on 48 more seeds (`--seeds=48 --from=924`): won 52% → 42%, waves 1–5 0.50 → 0.65, waves 1–10 3.54 → 4.21. With the cluster climb turned off (subs only) it reads 48%, so about half is the subs (they now always come up at the west spot, which sees the canal) and half the clusters (Saltgate's own clusters, off the lock silos at the ships in the locks, now fly a little closer before they split). It is still mid-pack for chapter 2. Saltgate is being reworked in parallel, so it is left for that rework to tune.

### Checks

- `npx tsc --noEmit`: clean. `npx vitest run --exclude '.claude/**'`: all pass. New: `tests/v3/round12.test.ts` (the cluster's climb, the sub audit on every map, the Gunship row, the Shield's fit, Retry and Skip both replaying exactly). The boss-round tests for the Archipelago and Saltgate moved to seeds where the bot still sees all three rounds (225 and 219).
- The map-lab baseline is rewritten at v41 and replays exactly.
- **e2e** on `vite preview`: `v3.mjs` (249 checks; new: the boss count on one line, the wave note above the keyboard, Retry and Skip), `v3-audio`, `v3-map-cards`, `v3-map-lab`, `v3-convoy`, `v3-resume` and `v3-encounters` pass. `v3-resume` had one check failing on the base already (it looked for "wave 3" after the counter became "Wave 3 of 10"): now case-blind.
- Screenshots e2e overwrote are restored, except `img/rate-review/lab-end-top.png`, which now shows "BOSS 3/3".

## 1. The NEW tag sits on top of the card

> "the label should be on top of the card and not overlapped on the middle of card"

- **What changed:** "NEW · The Narrows" is now a band across the card's top edge, in the card's colour. It was a pill over the middle of the art. The card makes room for the band.
- **Checked at 667×375 and 844×390:** the band starts at the card's top edge and ends above the art, and the cards fit with room to spare. The rating row is gone from the draft (fix 4), so the draft has more room than before.
- **Screenshots:** `before-draft-tag-667x375.jpg`, `after-draft-tag-667x375.jpg` and the same at 844x390.

## 2. Shield breaks after a number of hits

> "Shield is too OP the shield should break after x amount of hits not damage but actual hits"

**What changed**
- The Shield boost now breaks after a set number of hits:
  - **level 1:** 1 hit;
  - **level 2:** 2 hits;
  - **MAX:** 3 hits.
- Each missile, drone, shell, boat or torpedo it stops counts as one hit, whatever its damage.
- A single blast that reaches several hulls in the same step counts as one hit.
- The hit that breaks the shield is still blocked. You see "SHIELD BROKEN" and a burst.
- It still runs out at 15 s (18 s at MAX), whichever comes first.
- Level 2 still refunds a round per block, and MAX still reflects.
- The Shield *power-up* (the timed pickup) is unchanged.
- **On screen:** a row of pips over the carrier shows the hits left, and the last pip turns red. The bubbles crack as the shield wears down. See `after-shield.jpg`, taken at MAX with one hit taken.

**Why 1/2/3:** the combo sweep's singles (`npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth --persona=you`) give each weapon's ships lost per run, with every wave played. Rank is out of 20.

| Shield, levelled to MAX | The Island | The Behemoth Run |
| --- | --- | --- |
| v33 (the base this round started from) | #4, 8.00 | **#1**, 8.75 |
| v34 (round 9 merged), never breaks | #3, 7.25 | #3, 7.08 |
| **v35, 3 hits at MAX** | **#11**, 9.75 | **#9**, 11.33 |

- On a shield that never breaks (the old one), a pickup stops about 2.5 hits on average. The long tail of 8 to 27 hits is where the old Shield got its strength.
- With 5 hits at MAX it stayed #3 on both maps.
- With 2 it fell to #15 on the Island.
- 3 puts it mid-pack on both.
- Files: `tools/v3/combo-sweep/results/v35-ch2-playtest-fixes/singles.json` (after) and `v34-ch2-before-playtest-fixes/` (before). The tables are in `tools/v3/playtest-fixes/results/singles-v3{4,5}.txt`.

**Round 11: 2 / 3 / 4 (log v39).** The player chose the softer setting on the hub ("Softer: 2 / 3 / 4"): the Shield now breaks after **2 hits at level 1, 3 at level 2, 4 at MAX**. The same singles, all five chapter 2 maps, 12 seeds (`npm run v3:combo-sweep -- --stage=singles --maps=island,behemoth,needle,archipelago,saltgate --out=tools/v3/combo-sweep/results/v39-ch2-shield`). Shield alone, levelled to MAX, ships lost per run with every wave played, rank of 20:

| Shield alone | The Island | The Behemoth Run | The Needle | The Archipelago | Saltgate Canal |
| --- | --- | --- | --- | --- | --- |
| before: 1 / 2 / 3 (v37; Saltgate v38) | #17, 11.00 | #13, 10.67 | #6, 7.50 | #17, 28.42 | #12, 8.67 |
| **after: 2 / 3 / 4 (v39)** | **#11**, 8.92 | **#11**, 10.00 | **#15**, 8.92 | **#17**, 27.00 | **#11**, 8.33 |

- Every other weapon's runs are the same games as before (only the Shield changed), so the ranks move by the Shield alone.
- It gains on the Island and a little on the Behemoth Run and Saltgate, and stays near the bottom on the Archipelago. It doesn't return to the top 3.
- The Needle's drop (7.5 to 8.9 ships) is against the change's direction and inside the noise: 12 seeds, standard errors about 0.5–1, and the Needle's singles were already the noisiest (`docs/design/v3-combo-diversity.md`).

## 3. The attack helicopter fires as soon as it can

> "it doesn't need to go to a specific spot it should just start hitting targets"

**What changed**
- The helicopter fires a missile pair whenever it is on screen: on the way in, while settling and on the move. Before, it fired only once it hovered at its spot.
- It still flies to a spot beside the lane, moves on after two volleys there, and leaves after six.
- A Gunship Wall's helicopters still hold fire until the wall opens.
- The bot's sense of when a helicopter will fire follows the new clock, so it doesn't rush the Wall's helicopters before they may fire.

**Keeping the threat the same**
- Firing on sight gave it far more shots.
- So now it waits **3 s** on screen before its first volley, and has **5 HP** (was 6).

| The Island, the bot drafting for itself | Before | After |
| --- | --- | --- |
| volleys per helicopter | 0.57 | 0.63 |
| seconds from coming in to its first volley | 6.6 | 4.7 |
| missiles per run, waves 1–10 / boss rounds | 10.1 / 14.3 | 14.0 / 11.7 |
| ships sunk by helicopters per run | 2.33 | 1.25 |
| ships lost per run, every wave | 11.2 | 10.4 |

The plain gun: 0.75 volleys per helicopter before, 0.97 after; ships sunk by helicopters 3.67 before, 2.33 after.

**Island bot report** (24 seeds, no Armory: `tools/v3/playtest-fixes/results/report-island-v3{4,5}.md`)

| | Before | After |
| --- | --- | --- |
| tough, lost in waves 1–10 | 11.5 | 13.5 |
| normal, mean end wave | 9.0 | 8.3 |
| boss rounds B1–B3, tough | 2.04 / 4.83 / 3.42 | 1.54 / 4.67 / 4.04 |

Most of the Island's rise comes from the sub (fix 7): wave 3 is its debut, 0.13 lost before and 0.83 after. Wave 10 also rises.

## 4. The wave rating has its own screen

> "move this mid round review to be its own page as I miss it at the bottom of the draft page"

**What changed**
- The optional "Rate wave N" rating (difficulty, fun, intensity 1–5, and a note) is now its own screen. It shows between the wave's end and the weapon draft.
- It has bigger buttons, one row per axis, and **Skip** and **Next**.
- Each tap is saved to the log as you go. Skip and Next both go on to the draft.
- It shows where the row showed before, under the same rule:
  - playtest notes on (pre-release builds);
  - you at the controls, not a replay;
  - every draft after waves 1–10 (boss rounds have no draft).
- That rule covers the campaign and Free Play as well as the Test Lab map cards: the old row showed there too.
- A Test Lab run keeps **Done** on this screen, as on the draft.

**Tests:** `e2e/v3.mjs` and `e2e/v3-map-cards.mjs` now rate on the new screen. The other e2e scripts get past it.

**Screenshots:** `before-rate-wave.jpg` (the row cut off at the draft's foot) and `after-rate-wave.jpg`.

## 5. "Wave 3 of 10" on every map

> "It should say wave one of ten for all maps not n of thirteen"

**What changed**
- One helper (`waveCount` in `src/v3/data/events.ts`) now writes every counter:
  - **"Wave 3 of 10"** for waves 1–10;
  - **"Boss · Round 1 of 3"** for the boss rounds;
  - "Wave 14" in endless; a Test Lab event card keeps "Wave 11".
- Where it shows:
  - **HUD:** `WAVE 3 of 10` / `BOSS Round 1 of 3`;
  - **Test Lab pause bar:** "full map · wave 3 of 10" and "full map · boss round 1 of 3";
  - **Pause after a restore:** "Run restored · Wave 3 of 10";
  - **Continue card and saved line:** "Wave 3 of 10", or "boss round 2";
  - **Restoring… screen:** the counter is the wave being replayed, "Wave 5 of 10"; it used to read "Wave 1 of 11";
  - **Results:** "Convoy lost on boss round 2" and "Lost on wave 7";
  - **Won stamp:** "Every wave and boss round survived" (was "Wave 13 survived");
  - **Test Lab verdict:** "Full map: 10 of 10 waves and 2 of 3 boss rounds cleared" (was "12 of 13 waves").

## 6. The Scavenger drone takes 3 hits

> "the weapon drop stealing drone should have more health"

**What changed:** 3 HP (was 1), with HP pips over it.

| The Island, the bot drafting for itself | Before | After |
| --- | --- | --- |
| Scavengers shot down | 83% | 92% |
| seconds alive | 2.1 | 2.4 |

- Over all its runs the bot still downs about 9 in 10 Scavengers. Each one now costs it three taps and lives about 0.3 s longer, so its lock holds a little longer.
- On the Behemoth Run (36 per 12 runs): 97% shot down before, 83% after; 2.5 s alive before, 2.6 s after.

## 7. The torpedo sub stays under water, out of reach

> "should not be able to be attacked only their torpedoes can ... just stay under water with the periscope showing and a rough shadow of the sub"

**What changed**
- The Torpedo Sub can't be hit or targeted:
  - taps, splash, chains, beams, helpers, Bomber Wing and the War Drum all pass over it;
  - the bot never picks it, because it leaves the "worth shooting" list.
- The Nuke doesn't sink it either. The Nuke also leaves a sub's periscope warning in place, because the sub is under water.
- Its torpedoes are shot down as before.
- It is drawn as a dark hull shadow with a periscope (red glint) and a wake. It fades in, then fades out as it dives away. See `before-sub.jpg` and `after-sub.jpg`.

**Nothing waits on killing it**
- A sub always dives on its own after its last torpedo (`after` s), and the wave ends once it has gone.
- Unit tests check that the sub can't be damaged, fires, then dives.
- The map-lab baseline (Wolf Pack runs included) plays every run to its end.

**Keeping the threat close**
- Before, the bot sank most subs before they fired: 0.36 torpedoes per sub on the Behemoth Run.
- Now every sub fires, so each fires **2** torpedoes (was 3–5), and the Wolf Pack's subs fire **1–2** each (was 2–3).

| Ships sunk by torpedoes per run, the bot drafting for itself | Before | After |
| --- | --- | --- |
| The Island (12 subs a run) | 0 | 0.5 |
| The Behemoth Run, all waves | 1.58 | 2.25 |
| The Behemoth Run, waves 1–10 | 0.25 | 1.58 |

**Behemoth bot report** (24 seeds, no Armory)

| | Before | After |
| --- | --- | --- |
| tough, lost in waves 1–10 | 11.9 | 12.6 |
| normal, mean end wave | 9.1 | 8.9 |
| boss rounds B1–B3, tough | 2.54 / 3.42 / 4.50 | 3.08 / 3.33 / 6.21 |

## Follow-up: the sub's torpedoes, brought back down

After fix 7, The Behemoth Run became too punishing early:
- Torpedo sinks in waves 1–10 went from 0.25 to 1.58 a run.
- The plain gun went from 18.9 to 23.1 ships lost.
- Your Behemoth run lost its first ship to a sub on wave 2.

The sub stays out of reach, as you asked. Three changes bring its threat back, still at log v36:
1. **Slower torpedoes:** they move at 40 px/s (was 75), so there is more time to shoot each one. A fast one is still 2.2× that.
2. **A clearer torpedo:** each torpedo now has a white bow wave off its nose and a pulsing red ring.
3. **No early subs on the Behemoth Run:** no Torpedo Sub before wave 6. One the planner draws earlier stays the drone swarm it would have replaced, so the wave sends the same amount. This applies in the campaign and the lab alike (`SUB_FROM` in `src/v3/data/foes.ts`).

All numbers are with your Armory, the bot drafting for itself, 24 seeds. "Won" means under the normal loss limit. Torpedo sinks are for waves 1–10.

| | Before this follow-up | After | Target |
| --- | --- | --- | --- |
| Behemoth, lost in waves 1–5 | 0.83 | **0.54** | 0.4–0.8 |
| Behemoth, torpedo sinks | 1.50 | **0.33** | about 0.5 or less |
| Behemoth, won | 54% | **50%** | 50–70% |
| Island, lost on wave 3 (the sub's debut) | 0.71 | **0.17** | about 0.3 or less |
| Island, torpedo sinks | 0.63 | 0.08 | |

- The other speeds tried are in `tools/v3/playtest-fixes/results/torpedo-followup.txt`.
  - At 45–55 px/s, torpedo sinks stayed at 0.7–1.1 on the Behemoth Run.
  - At 45 px/s without the wave-6 rule, the Behemoth's waves 1–5 stayed at 0.88.
- The Behemoth's win rate of 50% sits at the bottom of the target range. What holds it down is mostly wave 10's heavies and shells, not torpedoes.
- With 24 seeds, a win rate moves by about ±10%.
- **Wave budgets** still pass (±15%): the furthest wave is the Island's wave 5 at ×0.87 and the Behemoth's wave 7 at ×0.90.
- **Bot reports** (24 seeds, no Armory):

  | | Lost in waves 1–5 (normal) | Mean end wave |
  | --- | --- | --- |
  | Island | 0.83 | 8.3 |
  | Behemoth | 0.79 | 9.0 |

- The map-lab baseline is rewritten (still v36).

## The Needle of Bosk, after it merged

The Needle has armored-drone walls and a Shield Wall boss. It has no helicopters or subs, so only the Shield and the Scavenger apply.

| | The Needle v35 (before) | v36 (after) |
| --- | --- | --- |
| Shield alone at MAX | **#1**, 5.25 | **#5**, 7.50 |
| the bot drafting for itself, lost per run | 8.0 | 8.7 |
| Scavengers shot down / seconds alive | 100% / 2.1 | 100% / 2.7 |

- The Shield also drops to the pack on the Needle. #2 to #8 sit within 7.2–7.7, so it is a tie.
- Files: `tools/v3/playtest-fixes/results/singles-needle-v3{5,6}.txt` and `foes-self-needle-v3{5,6}.txt`.

## Overall, the bot on chapter 2 (ships lost per run, every wave played)

| | Before | After |
| --- | --- | --- |
| Island, the bot drafting for itself | 11.2 | 10.4 |
| Island, plain gun | 15.3 | 12.7 |
| Behemoth, the bot drafting for itself | 10.3 | 8.8 |
| Behemoth, plain gun | 18.9 | 23.1 |

- With a full draft the two maps got a little easier: the Shield and the helicopter got weaker.
- With the plain gun the Behemoth Run got harder: nothing can stop its subs firing now.
- Under the normal loss limit (the bot reports), both maps end about a wave earlier on the Island and a little earlier on the Behemoth Run. That is mostly waves 3 and 8–10.

## Your four runs against the bot's mirror

- **Added to the bot fit:** your four logs, added to `tools/v3/bot-fit/player.json` with `fit.ts --logs`: Island v31; Marrow, Behemoth and Kesh v32.
- **No exact replays:** none of them replays exactly on this build, or on round 9's, because only v36 replays here.
- **The mirrors:** `curve.ts` replays each one as a "mirror": the "you" bot plays your setup, Armory and picks on your seed, 16 times, on three builds. The table shows the v35 build. The v33 and v34 builds are in `tools/v3/bot-fit/results/playtest-2026-11-20-curve-v3{3,4,5}.txt`.

Ships lost each wave, your run against the mirror's mean (v35):

| Map | Who | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | B1 | B2 | B3 | End |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Island | you | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 2 | 1 | 1 | 3 | won |
| | mirror | 0 | .06 | .31 | .13 | 0 | .13 | .81 | .88 | .60 | 1.85 | 1.09 | 1.82 | 1.11 | won 56% |
| Marrow | you | 0 | 0 | 0 | 1 | 1 | 0 | 1 | 3 | | | | | | lost w8 |
| | mirror | 0 | 0 | 0 | .06 | .31 | .06 | .38 | .19 | .44 | .13 | 0 | 0 | .27 | won 94% |
| Behemoth | you | 0 | 1 | 0 | 1 | 3 | 1 | | | | | | | | lost w6 |
| | mirror | 0 | .06 | 0 | .06 | 1.69 | 0 | .19 | .67 | 1.29 | 1.64 | 4.00 | 3.67 | 1.00 | won 0% |
| Kesh | you | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 3 | 0 | 1 | 5 | lost B3 |
| | mirror | 0 | 0 | 0 | 0 | .06 | .06 | .06 | .31 | .25 | 1.13 | .94 | .69 | 1.25 | won 81% |

- **Island:** you matched the mirror in waves 1–10 (4 lost; the mirror lost 4.4) and won.
- **Marrow:** you lost 6 by wave 8. The mirror loses 1.0 in the same waves and almost always wins. Your wave 8 (3 lost) is far above the mirror's 0.19.
- **Behemoth:**
  - Wave 5 is the hard wave for both of you: 3 lost for you, 1.7 for the mirror.
  - You lost by wave 6. The mirror reaches wave 10 about 7 times in 10 and never wins.
- **Kesh:** you held waves 1–9 better than the mirror's mean, then lost 3 at wave 10 and 5 at the last boss round. The mirror loses 1.25 there.
- **Marrow and Kesh in particular:** the bot reads these two maps as much easier than you found them.

## Checks

- `npx tsc --noEmit`: clean.
- `npx vitest run --exclude '.claude/**'`: all pass. New in `tests/v3/playtestFixes.test.ts`: Shield hits, the helicopter, the sub, the Scavenger and the counter. Older tests now follow the new sub, helicopter, Scavenger and counter.
- The map-lab baseline is rewritten at v36 and replays exactly.
- **e2e:**
  - `e2e/v3.mjs`, `v3-map-cards.mjs` and `v3-encounters.mjs` were run on `vite preview`.
  - Two earlier runs of `e2e/v3.mjs` failed one check each: "coves 667×375" and then "sowers 667×375", "a notice is outside the bottom-right corner". The base passes it. The base passes it.
  - First fix: the longer helicopter, sub and Scavenger tips made the first-sight notices taller, so all three are now no longer than before.
  - It still failed on The Coves: the new timing put the Strike Jet's and the Spotter's first-sight notices up together, and two 6-line notices rose above the bottom two thirds.
  - Second fix: on the smallest phones (height 380 px or less), a notice's text is clamped to 4 lines.
  - Now `e2e/v3.mjs` passes all 233 checks, and `v3-map-cards.mjs` and `v3-encounters.mjs` pass.
  - The screenshots e2e overwrote in `docs/design/img` were restored.
- **Tools:**
  - `tools/v3/playtest-fixes/measure.ts`: Shield hits per pickup, plus helicopter, sub and Scavenger numbers.
  - `tools/v3/playtest-fixes/shots.mjs`: the screenshots.
  - `tools/v3/playtest-fixes/pins.py`: moves the log-version pins.

## Questions for you

1. **Answered (round 11): 2 / 3 / 4.** ~~**Shield at 1/2/3 hits:** is a level-1 Shield that breaks on its first hit too fragile? *Recommended: keep 1/2/3.* It is mid-pack now, and 2/3/4 would put it back near the top.~~ Built in log v39; see the table above.
2. **The sub now always fires:** that makes the Behemoth Run's early waves and the Island's wave 3 a little harder, even at 2 torpedoes a sub. *Recommended: keep 2 torpedoes and watch your next Behemoth run.* If it feels harsh, slower torpedoes are the next lever.
3. **The rating screen:** it shows after every wave 1–10 in the campaign and Free Play too, not just map cards. *Recommended: keep it everywhere playtest notes are on.*

---

## Earlier: fixes from the 11-02 and 11-03 playtest logs

Logs reviewed: 8 runs on the player's iPhone (874×402), 11-02 and 11-03. The
player asked for every bug fixed, "especially quit log. I actually beat that
island map after wave 9 and it didn't save and then I play the next map
briefly and that doesn't save either."

## 1. A won run that never arrived, and a run left with no ending

**What the logs showed.**
- **Island (11-03 21:46).** The last upload is the wave 9 snapshot (21:52:44). The win around 21:53 never arrived.
- **Behemoth (started 21:54:00).** It arrived, but several logs that day stopped at a wave clear with no `end`.

**Reproduced in the browser.** The test build serves the game from a `*.vercel.app` host, so uploads run, and `/api/playlog` is intercepted.
- **The win itself.** On the unchanged build, a won Island run uploads fine; tapping Next even sends it a second time.
- **When both sends fail** (a phone between networks), on the unchanged build:
  - the win never arrives: failed logs were only resent at the next app launch;
  - the next run, left mid-wave, arrives as a snapshot with no ending. iOS fires `visibilitychange: hidden` when an app is swiped away, rarely `pagehide`, and only `pagehide` sealed a quit.

That is exactly what the player saw.

**Fixed:**
- **Every successful send** now also resends any log that didn't get through. So does coming back to the app.
- **Leaving the app mid-run** (`hidden`) saves the run sealed as `end: 'quit'`, `left: true`. If the player comes back and plays on, the next save of that id replaces it.

**Verified:**
- **The fixed build.** Same test, with both win sends failing: the win arrives 0.4 s after the next run's save, and that run arrives as `quit`.
- **In the browser suite.** `e2e/v3.mjs` now checks both.

## 2. The bomber's turn ("Plane turned for the bomber was not smooth")

A bomber flies beside a bending lane, 70 px off its edge. Its position was
stepped along the lane's centre at a fixed rate, but an offset path round a
bend is longer or shorter than the lane, and it doubles back on the inside of
a sharp corner. Measured over 6 seeds per map:

| Map | Plane | Before | After |
|---|---|---|---|
| Kesh Hook | bomber | 193–1,042 px/s, turning up to 7.05 rad/s | 193 px/s, ≤0.77 rad/s, within 9 px of its route |
| Sharra Delta | bomber | jumps of 4,765 px/s, up to 13.7 rad/s | 193 px/s, ≤0.59 rad/s, within 20 px |
| Sharra Delta | strafer | up to 6.56 rad/s | ≤1.24 rad/s |

**Fixed:**
- **Flight path.** An aircraft flies a flight path (`flightAt` in `sim/lanes.ts`): the offset path with the doubled-back stretch dropped and its corners rounded. It is cached per lane and offset, and kept in the lane's own distance, so the warning line and the strafer's gun line read the same path.
- **Speed and turning.** The plane flies at its own speed toward a point 120 px ahead on that path, turning at most 2.4 rad/s (`PLANE.look`, `PLANE.turnRate`).

**Verified:** a new test in `tests/v3/routes.test.ts` covers every map. Planes keep their speed (±5%), turn ≤2.4 rad/s and stay within 40 px of their route.

## 3. The radar tower ("Not really sure what that radar tower is even doing")

It was explained in a wave 1 notice on Lee of Marrow, up for 2.6 s among
"WAVE 1", the controls tip and the first threat's notice. The player asked on
wave 5.

**Fixed:** it is explained the first time the tower locks on to a threat, when its lock boxes show what it does, and for 6 s. The text: "Threats in its sweep get a lock box: your shots at them fly faster. Missiles will go for it." Once per device, as other first-time explanations are.

**Verified:** in the browser on Lee of Marrow, it showed 7.1 s into wave 2, when the tower first locked on.

## 4. Sinkings filed under the wrong volley

**What the logs showed.** A run lost to strafers filed its last two sinkings under an empty missile volley.

**Cause.** The loss that ends a run closes every open volley on the same frame, before the loss is filed.

**Fixed:** a sinking goes to the volley open at the start of that frame that sent its killer. A child counts with its parent: a bomblet with its cluster, a mini-drone with its mothership, a missile with its bomber.

**Verified:** 40 lossy runs on 10 maps. Volleys with losses but no threats went from 48 to 0. The volleys still empty are raids announced on the frame the run was lost, which genuinely sent nothing. A new test checks this.

## 5. Checked and not a bug: no taps after a note (Kesh, 11-02)

The log has no taps from wave 7 to the end. The last tap was at 30.8 s into
wave 7, 8 s before the note (39.2 s), so tapping had stopped before the note.

In the browser, a note from the pause menu, then Resume, at 2× speed: 3 of 3
taps fired.

## Log v69: the sim bot did not hold the Lance or swipe the Laser (Battery, v65 sim run)

**What the player said (the Watch run, "sim", lost on Battery wave 5 with a Charge Lance at level 3 and a Laser Cutter at level 1):** wave 3, "the bot does not use the lance properly, it needs to hold down to charge a bigger hit"; the review, "the bot does not use the laser weapon, it needs that".

**Cause.** The headless sweep bot (`sim/bot.ts`) already played the Lance and the Cutter, but the "you" persona the sim and Watch mode use (`sim/mimic.ts`) only ever tapped: a loaded Lance was a plain shot, a loaded Cutter a tap. Its `BotIO` had no press, move or release.

**Fixed.** `BotIO` gets `press` / `move` / `release` (the Recorder's, so the log carries them as `d` / `v` / `r` and replays exactly); a persona with `gestures` (the "you" persona and what it spreads to: 0.9; Novice 0) plays a held gesture weapon as a person does. The Lance: pressed on the toughest threat in the sky (else the line that holds three or more, else the urgent one) with time enough to charge, the finger following it, let go a beat after the charge it wanted shows (the full lance when the target can wait and little else is coming, the half when not; level 2-3 charge 1.33 times as fast), while the other thumb keeps tapping at the rest. The Cutter: a swipe through the urgent threat along the line that crosses the most others, aimed a little off as the thumb is. The older fits (`you-v1`, `you-p2`, `you-r12`) have no `gestures` and tap as they did. `BOT_REV` 4.

**Verified.** Battery card, the kit of the lost run held from the start (Charge Lance 3, Laser Cutter 1), the latest Armory, 48 seeds, the same seeds: taps only **0 of 48 won** (lost waves 4-9, 6.0 ships a run), with gestures **15 of 48 won** (mean wave 11.1; 105 presses and 403 shots a run against 167 shots). `tools/v3/bot-lance/kit.ts`; `tests/v3/botGestures.test.ts`.

## Log v74: the Dreadnought counts shots and sinks; the Test Lab's Done (2026-11-27)

**What the player said.** The Dreadnought (Watch run, won, boss 4, "bit-easy"): "The Dreadnought was a bit too easy, I think we should make it the same as the Oil rigs, where it needs x amount of ammo to take it out. Turrets are a bit too easy to kill as well. Also can you make an animation of the ship sinking so it is more satisfying for the player." The Test Lab: "The test lab to make me check 'done' when I finish the run or when I am in the pause menu. When I abandon the map it shows it as complete in the test lab."

**Dreadnought.** Hull and turrets count shots as the Rig Field's rigs (`SHOT_RIGS`); turrets 5 shots (4), firing slower; boss rounds re-tuned to climb. Bot, usual Armory, 96 seeds from 900: wins 59% (72% on this build before), boss rounds 0.95 / 1.13 / 2.21. A sunk battleship leaves a 3.4 s wreck (`ui/sinking.ts`): list, fire and smoke, breaks in two, slips under with a splash, foam and bubbles. Details and the sweep: `v3-ch3-dreadnought.md`.

**Test Lab bug.** Cause: Ready to test ticked a card "Played" for any run that ended, `quit` included (`readyPlayed`), and remembered the tick for good. Now a card is `new`, `played` (a run ended, none checked Done: "Played, not done", gold flag) or `done` (Done checked, or a verdict saved; `readyState`). The check is stored in the Test Lab's progress (`LabProgress.done`, by card, with the log version) and on the run's log (`labDone`), beside the verdicts; the All maps grid counts a done card as tested. A "Done testing this map" key (44 px) is on the pause menu of a Test Lab run and on the run's end screen (verdict sheet); it checks the map and goes back to the list, with no verdict needed. A played card also has a check key to mark it done from the list. Tests: `tests/v3/readyToTest.test.ts` (a quit log is played, not done; the Done mark and a verdict make it done; the mark survives save and load).

**Not done.** The existing pause-menu "Done" (opens the rating sheet) is unchanged, so the pause menu has both "Done" (rate) and "Done testing this map" (check off).
## Log v76: trucks that overlap, and call-outs over launchers (The Coves, Watch run)

**What the player said:**

> "Trucks should not overlap each other as well, the rocket truck and ballistic missile truck were just on top of each other. We should audit all maps too to make sure those overlaps do not happen. When that does happen I say one way to solve that is to just have the other truck come in from a different way."
>
> "Also with the notification make sure they do not go in a place that is on top of enemy launchers so it isn't hidden."

(The enemy boats on the cargo ships is the Coves boats build, log 72: not touched here.)

**The audit.** `tools/v3/overlap-audit/audit.ts` plays every map (its Test Lab card on the production setup, the "you" bot, the player's Armory, seeds 900-907, as the bot report does) and every sim step compares the drawn bodies of every ground launcher: pop-up, runner, parade and Rocket Trucks as the oriented 51 x 26 rectangles they are drawn as (scale 1.3, Rocket Truck 1.25), and, in a second column, trucks against fixed launchers (shore pads 28 x 23, siege guns). An overlap counts from 4 px of sinking in, and "sustained" is more than 0.5 s. `tools/v3/overlap-audit/cards.mjs` does the notification half in a browser (874 x 402 @2x, wave 6 watched at 3x, 70 samples a map): the call-out cards laid over every shore pad, rig, cove, truck and siege gun.

What it found before the fix:

- Two trucks on the same road, or a runner and a pop-up at a crossing, sinking into each other: kesh, marrow, harbor, battery, crossing, tide, needle, strait, saltgate and more.
- The Rocket Convoy (Gauntlet, the Breakout on Harbor Mouth): the column stands on one road, and each truck, finished, reverses *through* the ones behind it (24 sustained overlaps on the Gauntlet's 8 runs, up to 10 s each).
- A runner that caught up with the runner ahead, which stops to fire, drove into it and stayed there.
- Call-outs: the corner stack sat over a silo, rig or cove in 12 of 20 maps (the callouts doc had listed six "that has a base" there), in 50-95% of the samples.

**Fix, in the sim (`sim/trucks.ts`, `sim/overlap.ts`).** Seeded and with no new dice:

1. A truck is not put on a road whose start is taken (`startClear`). A wave's pop-up tries the map's other roads first, in the road list's order ("come in from a different way"), and a truck with no free road waits at the start, off screen, 0.25 s at a time.
2. A truck that drives (`driveStep`, a pop-up, a runner or a Rocket Truck, driving in or reversing out) never moves into another truck's body (6 px of air). It tries its road's centre, the lane it is in, then a lane one truck-width to either side that is land and on screen, in that order, and slides across at 90 px/s; with no clear lane it waits, at most 10 s (then it goes on rather than stall a wave). A truck already sunk into a younger one (it came on behind) is not held by it. So the Convoy's finished truck backs out in the lane beside the column, and a runner stops behind a runner at its stop.
3. Parade trucks are not moved (they never stop and are a column by design) but are obstacles to the rest.

`LANES.on = false` plays the game as before (the audit's `--off`, and the test).

**Fix, in the screen (`ui/alerts.ts`, `Alerts.dodge`).** Every frame the call-out cards are tested against the launchers' boxes (shore pads, rigs and coves, ground trucks, siege guns, surfaced subs, the carrier). A stack over one rises in 8 px steps to the nearest place that is clear, or goes to the field's other corner (costing as much as a 120 px rise) if the whole right edge is taken; a stack clear where it stands stays, and goes back down to the corner once that has been clear for a second; where no place is clear for two cards (the smallest phone, a Delta) it shows one at a time. The aircraft warnings' "STRAFING RUN" / "BOMBER" labels step aside from launchers the same way (`labelSpot`). Screenshots (874 x 402 @2x), the stack in the bottom-right corner before and after: `img/overlap/coves-before.png` and `coves-after.png` (a silo hidden behind AIR STRIKE INBOUND, then in the clear), `harbor-before.png` and `harbor-after.png` (two silos under WAVE 6 and BARRAGE INBOUND, then clear).

**Result: the audit, 8 runs a map** (seeds 900-907; "on a shore pad" is a truck's body 10 px or more into a pad for more than 0.5 s, not changed: see below):

| Map | Trucks seen (8 runs) | Truck-on-truck overlaps before: count, seconds, deepest px, runs hit | After | Truck on a shore pad (after) | Cards over a launcher before | After |
| --- | --- | --- | --- | --- | --- | --- |
| strait | 122 | 3, 5.4 s, 47 px, 3/8 | 0 | 0 | 0/70 | 0/70 |
| kesh | 236 | 16, 31.3 s, 53 px, 6/8 | 0 | 74 | 45/70 | 4/70 |
| marrow | 238 | 12, 21.6 s, 36 px, 7/8 | 0 | 0 | 0/70 | 0/70 |
| gauntlet | 202 | 24, 66.7 s, 34 px, 3/8 | 0 | 0 | 55/70 | 1/70 |
| harbor | 301 | 27, 45.1 s, 49 px, 7/8 | 0 | 3 | 66/70 | 1/70 |
| island | 115 | 0, 0.0 s, 0 px, 0/8 | 0 | 0 | 0/70 | 0/70 |
| behemoth | 173 | 0, 0.0 s, 0 px, 0/8 | 0 | 0 | 64/70 | 0/70 |
| needle | 68 | 4, 3.3 s, 34 px, 4/8 | 0 | 18 | 33/70 | 4/70 |
| archipelago | 145 | 0, 0.0 s, 0 px, 0/8 | 0 | 0 | 0/70 | 1/70 |
| saltgate | 409 | 4, 3.5 s, 40 px, 3/8 | 0 | 1 | 0/70 | 0/70 |
| battery | 223 | 7, 4.9 s, 45 px, 4/8 | 0 | 3 | 0/70 | 0/70 |
| sowers | 157 | 1, 1.0 s, 34 px, 1/8 | 0 | 0 | 61/70 | 0/70 |
| rigs | 116 | 2, 1.7 s, 45 px, 2/8 | 0 | 0 | 0/70 | 0/70 |
| lantern | 180 | 0, 0.0 s, 0 px, 0/8 | 0 | 2 | 63/70 | 0/70 |
| dreadnought | 95 | 0, 0.0 s, 0 px, 0/8 | 0 | 0 | 0/70 | 0/70 |
| coves | 110 | 0, 0.0 s, 0 px, 0/8 | 0 | 0 | 62/70 | 0/70 |
| delta | 312 | 3, 11.2 s, 43 px, 3/8 | 0 | 39 | 67/70 | 2/70 |
| crossing | 189 | 6, 26.2 s, 50 px, 3/8 | 0 | 1 | 35/70 | 0/70 |
| tide | 128 | 3, 9.9 s, 44 px, 3/8 | 0 | 0 | 0/70 | 0/70 |
| citadel | 197 | 2, 3.8 s, 34 px, 2/8 | 0 | 0 | 0/70 | 0/70 |

**Win rates**, the "you" bot, the usual Armory (the player's), 96 seeds from 900, every map, before (log v71) and after:

| Map | Win before | Win after | Change (pts) | Ships lost a run, before to after |
| --- | --- | --- | --- | --- |
| strait | 44.8% | 45.8% | +1.0 | 7.04 -> 6.93 |
| gauntlet | 43.8% | 41.7% | -2.1 | 5.77 -> 5.67 |
| island | 52.1% | 51.0% | -1.0 | 6.54 -> 6.60 |
| archipelago | 51.0% | 47.9% | -3.1 | 6.11 -> 6.21 |
| harbor | 31.2% | 24.0% | -7.3 | 6.50 -> 6.59 |
| kesh | 40.6% | 37.5% | -3.1 | 7.10 -> 7.06 |
| marrow | 90.6% | 91.7% | +1.0 | 4.24 -> 4.26 |
| behemoth | 65.6% | 60.4% | -5.2 | 5.24 -> 5.66 |
| needle | 64.6% | 61.5% | -3.1 | 6.40 -> 6.32 |
| saltgate | 80.2% | 78.1% | -2.1 | 4.79 -> 4.59 |
| battery | 68.8% | 66.7% | -2.1 | 5.46 -> 5.66 |
| sowers | 57.3% | 57.3% | +0.0 | 6.55 -> 6.56 |
| rigs | 62.5% | 58.3% | -4.2 | 6.41 -> 6.54 |
| lantern | 69.8% | 75.0% | +5.2 | 5.56 -> 5.58 |
| dreadnought | 71.9% | 69.8% | -2.1 | 5.80 -> 5.94 |
| coves | 61.5% | 65.6% | +4.2 | 6.53 -> 6.47 |
| delta | 53.1% | 52.1% | -1.0 | 7.26 -> 7.50 |
| crossing | 55.2% | 57.3% | +2.1 | 6.36 -> 6.33 |
| tide | 63.5% | 63.5% | +0.0 | 5.51 -> 5.47 |
| citadel | 68.8% | 69.8% | +1.0 | 6.44 -> 6.36 |

96 seeds move a rate by about 5 points either way: the same build's seeds 900-995 and 1000-1095 differ by up to 10 on one map. So the eight maps that moved most were played again over 192 seeds each (900-1095):

| Map | Before, 192 seeds | After, 192 seeds | Change |
| --- | --- | --- | --- |
| harbor | 27.6% | 24.5% | -3.1 |
| behemoth | 65.6% | 62.0% | -3.6 |
| rigs | 62.5% | 61.5% | -1.0 |
| archipelago | 52.1% | 51.0% | -1.0 |
| kesh | 41.7% | 39.6% | -2.1 |
| coves | 63.5% | 63.0% | -0.5 |
| lantern | 64.6% | 64.1% | -0.5 |
| strait | 43.2% | 43.2% | +0.0 |

The ships lost a run, which is steadier, moved 0.4 at the most (behemoth 5.24 to 5.66). The maps outside 50-70% (strait, gauntlet, kesh, harbor, marrow, saltgate) were outside it before: not changed here.

**Not done.** (1) Trucks over fixed pads: the Sharra Delta's two islet pop-up roads start at the silo (the truck comes out of it) and its Rocket Trucks stand on it, and runners graze the pads' corners on a few maps (10 px or so): left as drawn. Three siege-gun spots on Battery Point and Lantern Light sit on a runner road. (2) The Coves bot runs show no truck pile-up in 8 seeds (the player's was a hand-held Watch run); the rule is general, and Coves is in the test. (3) The call-out stack still shares the screen with the ships: it is clear of launchers and the carrier, not of the lanes. In 4 to 5% of samples on kesh, needle and delta a card is over a launcher for a few frames while it moves off one that has just come under it.

**Numbering and merge.** Built as log 73; log 74 (the Dreadnought) merged first, so it shipped as 75 and, once the Coves (75) merged too, ships as 76. The tables above are this build against the base at 71; after the merge the Dreadnought card's bot win rate is 57% (96 seeds from 900; its own note says 59%).

**Tests.** `tests/v3/overlap.test.ts`: the body geometry; the card placement; every map's bot run (and the seeds that piled up most) with no sustained truck-on-truck overlap; with `LANES.on` off five maps' runs do pile up (it fails without the fix). `e2e/v3.mjs`'s call-out check follows the stack to where it rises and adds "no card over a launcher in more than 10% of samples". `tests/v3/fixtures/map-lab` rewritten with `--write`: every baseline run differs now (the log version, and trucks that wait or take another lane change the whole run from there), and each replays to itself exactly with telemetry on and off.
