## What the sweep says (read 2026-11-19, game version 28)

You asked: "Are we running bot tests on all possible combination of the weapon load outs?? ... we should do that same with the armory too." This is that sweep: every weapon on its own, every pair, the best pairs with every third weapon, the best and worst triples again on more seeds, and the Armory builds. The "you" bot played about 11,000 runs on the Strait, the Gauntlet, Harbor Mouth, Kesh and Marrow.

**The short version**
- **No kit makes a map trivial.** No weapon set, and no Armory build with it, won a map without losing a ship in most runs. The closest was Kesh with Wide Warhead + Point Defense + Long Loads and the counter kit. On 4 seeds it looked trivial. On 16 seeds it lost 3.1 ships a run, won 94% and was flawless only 1 time in 8.
- **The first weapon matters most. The second and third add little.**
  - The plain gun loses about 17 ships a run over all 13 waves.
  - Any one good weapon roughly halves that, to 8–9.
  - The best pair loses about 6.5 (on 6 seeds a map). The best triple loses 7.6 (confirmed on 12 seeds).
  - The weapons share one gun, so a second weapon splits the gun's time and the drops instead of adding to them.
- **The Armory matters more than the loadout.**
  - With no Armory, the counter kits lose 24 ships a run. With your Armory they lose 10. With the best full build (Wide Warhead + Armor Plating + Long Loads) they lose 5.
  - The best weapon set saves about 10 ships over the plain gun. The best Armory build saves about 19 over no Armory.
- **Best loadouts (12 seeds a map):**
  1. Air Strike + Point Defense + Supply Run
  2. Air Strike + Gravity Well + Supply Run
  3. Flak Cannon + Point Defense + Supply Run
  4. Air Strike + Gravity Well + Drone Screen
  5. Scattergun + Point Defense + Railgun

  Each loses about 7.6–8.1 ships a run and wins 48–63%. The bot drafting for itself loses 9.1 and wins 45%. Supply Run is in 9 of the top 15 triples, Air Strike in 8 and Point Defense in 6.
- **Worst loadouts:**
  - Flak + Tesla + Overdrive
  - Flak + Seeker + Overdrive
  - Scattergun + Supply Run + Overdrive
  - Boomerang + Flak + Overdrive
  - Boomerang + Flak + Point Defense

  Each loses 9.7–11.3 ships. **Overdrive is in four of the five worst.**
- **Synergy.** Almost no set beats what its weapons predict, so "synergy" here means compared with the other sets.
  - **Supply Run is the best partner by far.** It is weak alone (a boost: it fires nothing), but it feeds whatever else you hold. Point Defense + Supply Run and Tesla Arc + Supply Run gain most.
  - **The worst partners** are Seeker Pod + Drone Screen, Flak Cannon + Gravity Well, Railgun + Overdrive, and Gravity Well + Railgun. Each of these pairs does worse than its better weapon alone.
  - **Overdrive and Drone Screen are the weakest partners overall.**

**Overdrive + Scattergun + Supply Run.** The bot does not find this kit strong. Played on 12 seeds a map, it was 18th of the 20 confirmed triples, and in the triples stage it was last of 116.
- It lost 10.9 ships a run and won 32%.
- The bot drafting for itself lost 9.1 and won 45%.
- It was worst on the Strait (15 ships a run) and on Harbor Mouth.

That is the opposite of what you found: it won both runs you played with it, with no boss losses. Overdrive and Supply Run are both boosts, and the bot's weak spot is how it plays boosts and pickups (docs/design/v3-bot-refit.md: you load a Scattergun in the first second of a boss round, and the bot reaches the Supply Run late). So the likely reading is that **you get far more out of this kit than the bot does**, not that the kit is weak. Before anyone tunes it, replay one of your Overdrive + Scattergun + Supply Run logs next to the bot (the `playtest-fidelity` check). The sweep cannot settle it.

**The counter kits (rule `m-kits`).** The rule asks that a map's counter kit does clearly better than other kits. It does not on Harbor Mouth or Kesh.
- Their counter kit (Overdrive + Railgun + Focus) lost 17.0 and 10.3 ships a run.
- The bot drafting for itself lost 12.0 and 7.0 there.
- Focus is a chapter 3 weapon, so the chapter 1 draft never deals it on these maps.

On the Strait, the Gauntlet and Marrow, the counter kit is about level with the bot's own draft.

**The Armory, upgrade by upgrade (each alone at level 5).**
- **Most valuable:** Armor Plating saves about 12–13 ships a run with either kit. Then Damage Control (11–12), Point Defense (6–9), and Proximity Fuse and Wide Warhead (5–8).
- **Least valuable:** Stockpile (about 2), Quick Reload (3–4), Long Loads and Supply Lines (−1 to 4; Supply Lines does worse than nothing when the bot drafts for itself). Your usual build is Quick Reload 5 + Damage Control 4 + Stockpile 5. It uses two of the three weakest upgrades. With the counter kit it loses 10 ships a run, where Wide Warhead + Armor Plating + Long Loads loses 5.

### Proposals for you (nothing here is applied)
1. **Overdrive.** It is the weakest weapon to pair with anything, and it is in four of the five worst triples. First check whether the bot plays it as you do (above). If the bot is right, give Overdrive a stronger level 1 or a longer run.
2. **Seeker Pod and Tesla Arc** are the weakest shooting weapons on their own: about 10–11 ships a run alone, against 8–9 for the best. A small buff to either would widen the good choices.
3. **Harbor Mouth and Kesh need a new counter kit** (rule `m-kits`): one the chapter 1 draft can deal (no Focus) and that beats the bot's own draft. Candidates from the sweep:
   - Harbor Mouth: Point Defense + Railgun + Supply Run, the best there.
   - Kesh: Flak Cannon + Point Defense + Supply Run, which won 92% there.
4. **The Supply bay is weak and Armor Plating is strong.**
   - Stockpile, Supply Lines and Long Loads are the three cheapest saves in the Armory, so a Supply card feels like a wasted win.
   - Either lift them (for example Supply Lines' drop chance), or bring Armor Plating down a little: on its own it is worth more than most whole weapons.
5. **Point Defense, Air Strike and Gravity Well** are in most of the best triples, but none of them runs away with it: the best and worst single weapons are only about 3 ships a run apart. Nothing here needs a nerf.
6. **The Laser Cutter could not be tested.** It is a swipe, and the bot only taps, so with it loaded the bot is worse than with the plain gun. The bot needs a swipe before the sweep can judge the Cutter.

### How far to trust it
- The bot is not you. It fits your play well on ordinary waves but is weaker with boosts and fast pickups. That matters most for Overdrive, Supply Run and the boss rounds.
- A forced loadout is the best case: every draft deals the next card of the kit. A real draft is luckier for some kits than others.
- Seeds are few in the middle stages: 6 a map for pairs and 4 for triples. A pair or triple a ship or so apart is a tie. The confirm stage, at 12 seeds, is the one to quote.
- The fun measure here is tension only (rises and calms each second). It barely tells the loadouts apart. "Saves", the measure that forks a run, cannot be read on a forced-draft run: its log does not replay.
- The chapter 1 changes coming in game version 29 will move the Kesh and Marrow numbers. Re-run with `npm run v3:combo-sweep -- --stage=all` once they land.

### What was cut to fit the time
The machine was shared with other sessions, which made it about twice as slow, so the sweep was cut. It took about 65 minutes in all:

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
