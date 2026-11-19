## What the sweep says (read 2026-11-19, game version 29)

You asked: "Are we running bot tests on all possible combination of the weapon load outs?? ... we should do that same with the armory too." This is that sweep: every weapon on its own, every pair, the best pairs with every third weapon, the best and worst triples again on more seeds, and the Armory builds. The "you" bot played about 11,000 runs on the Strait, the Gauntlet, Harbor Mouth, Kesh and Marrow. It was first run on game version 28, then run again in full on version 29 (Marrow's slowing radar, Kesh's harder Drone Storm, the calm before every boss). Everything below is version 29.

**The short version**
- **No kit makes a map trivial.**
  - The triples stage flagged one: Shrapnel Shell + Scattergun + Flak Cannon on Marrow (4 seeds: won all, no ship lost in half). On 16 seeds (`tools/v3/combo-sweep/check-one.ts`) it lost 5.6 ships a run, won 81%, and lost no ship in only 2 of 16.
  - The closest Armory build is Wide Warhead + Armor Plating + Supply Lines on Marrow, "nearly" trivial: it won every run but lost 1.5 ships a run.
- **Marrow is now the easiest map and Kesh the hardest.**
  - Bot drafting for itself, over 13 waves: Marrow 6.3 lost and 83% won; Kesh 12.1 lost and 8% won (version 28: Kesh 7.0, Marrow about 8).
  - Marrow's best set (Frigate Escort + Thermobaric Shell + Point Defense) won 12 of 12, losing 3.8.
  - That is the radar slowdown and the Drone Storm working as built. It is also why your replay matters: the bot reads Marrow about twice as hard as you did and the Kesh boss harder than you play it.
- **The first weapon matters most. The second and third add little.**
  - The plain gun loses 18.6 ships a run over all 13 waves.
  - Any one good weapon roughly halves that, to 8.4–9.4.
  - The best confirmed triple loses 7.6.
  - The weapons share one gun, so a second weapon splits the gun's time and the drops instead of adding to them.
- **The Armory matters more than the loadout.**
  - With no Armory, the counter kits lose 24.5 ships a run. With your Armory (Quick Reload 5 + Damage Control 4 + Stockpile 5) they lose 12.7. With the best full build (Wide Warhead + Armor Plating + Stockpile) they lose 6.0.
- **Best loadouts (12 seeds a map):**
  1. Air Strike + Point Defense + Supply Run (7.6)
  2. Air Strike + Flak Cannon + Point Defense (7.8)
  3. Point Defense + Railgun + Supply Run (8.2)
  4. Air Strike + Flak Cannon + Gravity Well (8.2)
  5. Point Defense + Gravity Well + Supply Run (8.4)

  They win 42–62%. The bot drafting for itself loses 10.2 and wins 37%. Air Strike and Point Defense are each in 3 of the top 5.
- **Worst loadouts:**
  - Shrapnel + Scattergun + Overdrive (12.2)
  - Scattergun + Supply Run + Overdrive (11.7)
  - Shrapnel + Scattergun + Boomerang (11.4)
  - Shrapnel + Seeker + Drone Screen (11.3)
- **Synergy.** Every pair falls short of what its weapons predict, so "synergy" here means compared with the other pairs.
  - **Supply Run is the best partner by far.** The ten best-fitting pairs are all something + Supply Run (Frigate Escort, Boomerang, Point Defense and Seeker Pod gain most). It is weak alone (it fires nothing), but it feeds whatever else you hold.
  - **The worst partners** are Boomerang + Seeker Pod, Air Strike + Seeker Pod, Scattergun + Boomerang, and Air Strike + Scattergun.

**Overdrive + Scattergun + Supply Run.** The bot still does not find this kit strong: 19th of the 20 confirmed triples, 11.7 ships a run, 28% won, worst on the Strait (15.4).

That is the opposite of what you found: it won both runs you played with it, with no boss losses. Overdrive and Supply Run are both boosts, and the bot's weak spot is how it plays boosts and pickups (docs/design/v3-bot-refit.md: you load a Scattergun in the first second of a boss round, and the bot reaches the Supply Run late). So the likely reading is that **you get far more out of this kit than the bot does**, not that the kit is weak. Before anyone tunes it, replay one of your Overdrive + Scattergun + Supply Run logs next to the bot (the `playtest-fidelity` check). The sweep cannot settle it.

**The counter kits (rule `m-kits`).** The rule asks that a map's counter kit does clearly better than other kits. It still fails on Harbor Mouth and Kesh.
- Their counter kit (Overdrive + Railgun + Focus) lost 17.3 and 16.8 ships a run.
- The bot drafting for itself lost 13.0 and 12.1 there.
- Focus is a chapter 3 weapon, so the chapter 1 draft never deals it on these maps.

On Marrow the counter kit is level with the bot's own draft (6.3 each).

**The Armory, upgrade by upgrade (each alone at level 5, with the counter kit).**
- **Most valuable:** Armor Plating saves 13.3 ships a run. Then Damage Control (8.8), and Proximity Fuse and the Point Defense upgrade (7.1 each).
- **Least valuable:** Stockpile (2.3), Quick Reload (2.8) and Long Loads (3.9).
- Your usual build uses two of the three weakest. With the counter kit it loses 12.7 ships a run; Wide Warhead + Armor Plating + Stockpile loses 6.0.

### Proposals for you (nothing here is applied)
1. **Overdrive.** Alone it ties Seeker Pod at 11.7 ships a run, ahead of only Supply Run and the Laser Cutter, and is in two of the four worst triples. First check whether the bot plays it as you do (above). If the bot is right, give Overdrive a stronger level 1 or a longer run.
2. **Seeker Pod and Tesla Arc** are the weakest shooting weapons on their own: about 11–12 ships a run alone, against 8.4–9.4 for the best. A small buff to either would widen the good choices.
3. **Harbor Mouth and Kesh need a new counter kit** (rule `m-kits`): one the chapter 1 draft can deal (no Focus) and that beats the bot's own draft. Candidates from the sweep:
   - Harbor Mouth: Point Defense + Railgun + Supply Run, the best there.
   - Kesh: Air Strike + Flak Cannon + Point Defense, the best there on version 29 (7.3 lost, won 58%, where the bot's own draft wins 8%).
4. **The Supply bay is weak and Armor Plating is strong.**
   - Stockpile and Long Loads are two of the three cheapest saves in the Armory, so a Supply card often feels like a wasted win.
   - Either lift them (for example Stockpile's size), or bring Armor Plating down a little: on its own it is worth more than most whole weapons.
5. **Point Defense, Air Strike and Gravity Well** are in most of the best triples, but none of them runs away with it: the best and worst single weapons are only about 3 ships a run apart. Nothing here needs a nerf.
6. **The Laser Cutter could not be tested.** It is a swipe, and the bot only taps, so with it loaded the bot is worse than with the plain gun. The bot needs a swipe before the sweep can judge the Cutter.
7. **Marrow and Kesh after version 29.** Marrow now plays easy for the bot (83% won drafting for itself, above the chapter's 50–75% aim) and Kesh hard (8%). Wait for your replay before touching either: the bot read your Marrow twice as hard as you played it, and boss rounds harder too.

### How far to trust it
- The bot is not you. It fits your play well on ordinary waves but is weaker with boosts and fast pickups. That matters most for Overdrive, Supply Run and the boss rounds.
- A forced loadout is the best case: every draft deals the next card of the kit. A real draft is luckier for some kits than others.
- Seeds are few in the middle stages: 6 a map for pairs and 4 for triples. A pair or triple a ship or so apart is a tie. The confirm stage, at 12 seeds, is the one to quote.
- The fun measure here is tension only (rises and calms each second). It barely tells the loadouts apart. "Saves", the measure that forks a run, cannot be read on a forced-draft run: its log does not replay.
- Re-run with `npm run v3:combo-sweep -- --stage=all` after any game change. The version 29 re-run took 29 minutes on a quieter machine.

### What was cut to fit the time
The first run (version 28) shared the machine with other sessions, which made it about twice as slow, so the sweep was cut. It took about 65 minutes in all; the version 29 re-run used the same cuts:

| Stage | Time | Planned seeds a map | Ran |
|---|---|---|---|
| Singles | 15 min | 12 | 12 |
| Pairs | 17 min | 8 | 6 |
| Triples | 18 min | 15 best pairs, 6 seeds | 10 best pairs, 4 seeds |
| Confirm | 7 min | 24 | 12 |
| Armory | 8 min | 6 | 4 |

The table further down shows the triples at 15 minutes: the stage was restarted from its cache partway through, and the table counts only the second part.

Also left out:
- The Laser Cutter, from the pairs and triples (the bot can't swipe).
- The Armory pairs that share a bay: a run can't equip two upgrades from one bay.
- The Armory pairs and full builds with the bot drafting for itself: these were played with the counter kit only.
- The off-counter kits.
- The "saves" fun measure (see above).
