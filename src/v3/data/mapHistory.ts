// EVERY MAP'S ITERATION HISTORY, for the Test Lab's map notes (the player,
// 2026-11-23: "In the notes for the test lab, have the latest change in
// there too, why the map was changed or the thing you are testing,
// basically the iteration history").
//
// Gathered from the map cards (docs/design/v3-p4-*.md, v3-ch*-*.md), the hub
// log (tools/v3/map-rules/plan.mjs: STATUS.log and the play items' "Look
// for") and docs/design/v3-playtest-fixes.md. A map change adds an entry at
// the top of its map's `history`, with the log version it ships in (a test
// checks every map has one, newest first, none past LOG_VERSION).
//
// `look` is what to watch for on the next play; each entry says what
// changed (`what`, a few plain sentences; `title`, a few words) and why
// (`why`, one line, the player's words where there are some).

import type { MapId } from './maps';

export interface MapIteration {
  /** The day it merged (YYYY-MM-DD). */
  date: string;
  /** The play log version it shipped in. */
  log: number;
  title: string;
  what: string;
  why: string;
}

export interface MapNotes {
  /** What to test or look for now. */
  look: string;
  /** Newest first. */
  history: MapIteration[];
}

/** Busier early waves (log v47): on every map rebuilt before it. */
const BUSY: MapIteration = {
  date: '2026-11-21',
  log: 47,
  title: 'Busier early waves',
  what: 'Waves 1–6 get a few extra filler drones from the far silos (2–5 a wave, mostly waves 1–3). They drop nothing, so pickups come as before.',
  why: 'Your chapter 2 notes: “more drones and easy things to kill… keep it busy.”',
};

/** Round 12, your chapter 2 notes (log v41), as it touched each map. */
const ROUND12 = (what: string): MapIteration => ({
  date: '2026-11-20',
  log: 41,
  title: 'Your chapter 2 notes fixed',
  what,
  why: 'Your chapter 2 runs (all Keep): subs over land, clusters splitting at the launcher, overlapping helicopters.',
});

export const MAP_HISTORY: Record<MapId, MapNotes> = {
  strait: {
    look: 'Does the quiet first third read as a warm-up, not dead time? Is each Afterburner Rush round bigger than the last, and is wave 10 the top of a climb?',
    history: [
      {
        date: '2026-11-17',
        log: 26,
        title: 'Rebuilt to the wave rules; the Rush rises',
        what: 'The map itself is unchanged (open water, one enemy shore). Its waves were rebuilt as nine encounters with a quiet first third, and the Afterburner Rush boss now rises each round: 7, 9, then 10 sprint swarms, each with a Hydra behind it.',
        why: 'Your round 1 call: keep the Strait’s design, but make its waves follow the rules; the boss was the same every round.',
      },
    ],
  },
  kesh: {
    look: 'Does it climb now, with real pressure by wave 3 and wave 10 as the top? Your last run broke in boss round 3 (5 ships): is that a spike or a fair finale?',
    history: [
      BUSY,
      {
        date: '2026-11-19',
        log: 30,
        title: 'A climb, not a cliff',
        what: 'Fire moved from waves 9–10 to waves 2–6. From wave 3 shells hit the ship in the turn (your Point Defense ate the drones), and wave 10 is lighter.',
        why: 'Your v29 replay: nothing happened for nine waves, then everything landed on wave 10 (fun dropped from 4 to 3).',
      },
      {
        date: '2026-11-19',
        log: 29,
        title: 'A harder Drone Storm; smooth frigates',
        what: 'The Drone Storm boss sends shells and guided missiles with its swarms, more each round. Frigates round the hook smoothly.',
        why: 'Your note: the boss was “way too easy” (lost 0, 0, 1); frigates jittered on the turn.',
      },
      {
        date: '2026-11-18',
        log: 28,
        title: 'Rebuilt to the map and wave rules',
        what: 'One encounter a wave, aimed at the ship in the hook’s turn under the south silo, and a Drone Storm boss that rises each round.',
        why: 'It was far too easy: the bot won 96% with your Armory.',
      },
    ],
  },
  marrow: {
    look: 'Does the radar tower last into the late waves now? Are losses spread over waves 4–8, with no cliff at the end?',
    history: [
      BUSY,
      {
        date: '2026-11-20',
        log: 32,
        title: 'A sturdier radar tower',
        what: 'The tower takes 3 missile or shell hits, not 2 (a heavy still takes it at once). Waves 7–10 send 10% more fire to make up for it.',
        why: 'Round 8: on your v29 replay the tower fell on wave 4; you wanted it to last.',
      },
      {
        date: '2026-11-19',
        log: 30,
        title: 'A climb, not a cliff',
        what: 'Fire moved from waves 9–10 to waves 2–6, so the map climbs instead of saving everything for the end.',
        why: 'Your v29 replay: nothing lost for most of the map, then 1, 1, 2, 2 and out on wave 10.',
      },
      {
        date: '2026-11-19',
        log: 29,
        title: 'The radar slows the enemy',
        what: 'Every enemy inside the radar’s sweep slows down, instead of your shots flying faster there.',
        why: 'Your idea: a slow-down field makes the tower a place you defend and use, not a stat you don’t notice.',
      },
      {
        date: '2026-11-18',
        log: 28,
        title: 'Rebuilt to the map and wave rules',
        what: 'One encounter a wave, the radar tower on the island as the enemy’s target, and a Hydra Bloom boss that rises each round.',
        why: 'It was far too easy: the bot won 96% with your Armory.',
      },
    ],
  },
  gauntlet: {
    look: 'Whichever shore you turn to, the other fires at the ships coming in: does it still feel that way? Does the Rocket Convoy build up round by round?',
    history: [
      {
        date: '2026-11-17',
        log: 26,
        title: 'Rebuilt to the wave rules; the Rocket Convoy builds',
        what: 'Wave 8’s jump is gone and the danger is on the way in. The Rocket Convoy boss builds up over its rounds: 3 trucks a column and one swarm, then 3 and two, then 4 and two smaller swarms.',
        why: 'The checks found a cliff at wave 8, and the boss sent the same every round.',
      },
    ],
  },
  harbor: {
    look: 'Is the Breakout’s round 2 now the tense one, with round 3 no longer a wall? Can you shoot a supersonic as soon as it leaves the truck?',
    history: [
      {
        date: '2026-11-18',
        log: 27,
        title: 'A lighter boss round 3; supersonics shootable sooner',
        what: 'The Breakout’s third round sends one sub salvo into the neck, not two. A supersonic can be shot 0.4 s after launch, not 1.1 s (it still lands when it did).',
        why: 'Your playtest: the boss cost 2, 0, 4 and round 3 ended the run; “the invincibility of the super sonic missile is just a tad too long”.',
      },
      {
        date: '2026-11-17',
        log: 25,
        title: 'Rebuilt to the wave rules',
        what: 'Waves 4–7 send their full attack again, a 5 s calm comes before wave 10, and the Breakout adds sub salvos into the neck where the convoy bunches.',
        why: 'The checks found waves 4–7 a third light: the neck’s encounter replaced more than it sent.',
      },
    ],
  },
  island: {
    look: 'Attack helicopters off the island from wave 6, as in the boss: does the map feel like its own? Your last run lost in boss round 2.',
    history: [
      BUSY,
      ROUND12('Torpedo subs surface only on clear water with a torpedo line to a lane. Your Gunship Pair’s helicopters fly 270 px apart.'),
      {
        date: '2026-11-20',
        log: 36,
        title: 'Your playtest notes',
        what: 'Attack helicopters fire whenever they are on screen (5 HP). The torpedo sub stays under water and can’t be hit; it fires 2 slower, clearer torpedoes.',
        why: 'Your playtest: the helicopter “should just start hitting targets”; the sub “should not be able to be attacked, only their torpedoes”.',
      },
      {
        date: '2026-11-20',
        log: 34,
        title: 'Its own threat: attack helicopters',
        what: 'From wave 6 the wave’s new enemies are attack helicopters off the island, as in the Gunship Wall boss.',
        why: 'The Island and the Behemoth Run shared a best kit: each map needed its own question.',
      },
      {
        date: '2026-11-20',
        log: 32,
        title: 'Debut waves for the Narrows enemies',
        what: 'Waves 3–5 are the Torpedo Sub’s, Armored Drone’s and Scavenger Drone’s debut waves, each with drones only around it, under a “NEW · The Narrows” banner.',
        why: 'Your round 1 rule: every new enemy gets a debut before it mixes in.',
      },
      {
        date: '2026-11-19',
        log: 31,
        title: 'Rebuilt to the map and wave rules',
        what: 'The enemy island beside both lanes is the problem: its two silos fire with almost no warning, and a third of the ships take the fast north lane under the far shore. The Gunship Wall boss rises each round.',
        why: 'Chapter 2 starts: each map gets its own problem and a climbing boss.',
      },
    ],
  },
  behemoth: {
    look: 'Jets and heavies go for the tanker from wave 4; the boss is a jet strike the Shield can’t stop. Do the early waves still hit you harder than they should?',
    history: [
      BUSY,
      ROUND12('Cluster missiles can’t split for their first 1.3 s, so one fired next to the ships can be shot. The Shield bubble fits the supertanker.'),
      {
        date: '2026-11-20',
        log: 36,
        title: 'No torpedo sub before wave 6',
        what: 'No Torpedo Sub before wave 6, and torpedoes are slower (40) and clearer.',
        why: 'Your run: 3 of your 5 early losses were one hit on the tanker, which counts 3.',
      },
      {
        date: '2026-11-20',
        log: 34,
        title: 'A strike on the tanker',
        what: 'From wave 4 jets and heavies go for the supertanker. The boss is a jet-led strike on the tanker in place of most of the Wolf Pack’s subs.',
        why: 'Your answer: a boss the Shield doesn’t stop, since the Island and the Behemoth shared a best kit.',
      },
      {
        date: '2026-11-19',
        log: 31,
        title: 'Rebuilt to the map and wave rules',
        what: 'A slow supertanker sails under the enemy shore and most aimed fire goes for it. Sunk, it counts 3 ships; home, every ship is repaired and a weapon drops.',
        why: 'Chapter 2 starts: each map gets its own problem and a climbing boss.',
      },
    ],
  },
  needle: {
    look: 'The convoy queues single file at the mouth; walls of armored drones from wave 4. Is the Shield Wall boss fair? Your last run reached the boss.',
    history: [
      BUSY,
      ROUND12('The east torpedo sub spot moved so a sub surfaces on clear water with a line to the lane.'),
      {
        date: '2026-11-20',
        log: 35,
        title: 'Rebuilt to the map and wave rules',
        what: 'One encounter a wave at the convoy queued at the mouth, small walls of armored drones from wave 4, and the Shield Wall boss rising each round.',
        why: 'Chapter 2: the first map inside the 50–70% band for the bot with your Armory, with its own best kit.',
      },
    ],
  },
  archipelago: {
    look: 'Fire from the islets, the gaps and behind; drone motherships from wave 4. Your last run was lost on wave 7 to a “bad setup”: does a better kit fix it?',
    history: [
      BUSY,
      {
        date: '2026-11-20',
        log: 37,
        title: 'Rebuilt to the map and wave rules',
        what: 'A chain of enemy islets lines the lane; fire comes from the islets, the gaps, the far shore and behind, and the west end is the danger stretch. Drone motherships with Scavenger escorts from wave 4. The Supply Raid boss comes from every side.',
        why: 'Chapter 2: every map gets its own problem and its own best kit.',
      },
    ],
  },
  saltgate: {
    look: 'Skip to boss: the parade is ordinary Missile Trucks now, and nothing can shoot a truck, only its missiles. Is it easier, and is it clear what to shoot?',
    history: [
      {
        date: '2026-11-26',
        log: 71,
        title: 'The boss: the normal truck, and easier',
        what: 'The parade’s trucks are the ordinary Missile Truck now (the one the waves use), not the custom 4-hit truck: nothing hits them, so the counter is shooting each missile in the air. Same column, same patterns. Easier: round 1 ripples of 5, a lighter round 3. Bot, your usual Armory, 96 seeds: boss rounds lose 0.5 / 1.0 / 1.4 ships (0.9 / 1.4 / 2.0 before).',
        why: 'Your note after playing it: “a bit too hard … use the normal truck that you cannot attack and not these custom vehicles”.',
      },
      {
        date: '2026-11-23',
        log: 62,
        title: 'The boss: a real Missile Truck parade',
        what: 'The Gatecrashers’ Missile Trucks drive the road behind the silos left to right, a truck every 1–3 s, and never stop: they raise and fire their missiles on the move, in patterns that build each round (ripples, then synchronized pairs, then the rolling barrage down the whole column). A truck takes 4 hits, and the parade drives on past its wrecks.',
        why: 'Your play of the v46 boss: “this boss is really bad”; you pictured “a row of trucks going in a parade from the left to the right”, firing without stopping.',
      },
      BUSY,
      {
        date: '2026-11-21',
        log: 46,
        title: 'The boss: a missile truck parade',
        what: 'The Gatecrashers are a parade of Missile Trucks: each raises one big ballistic missile and lobs it at a ship held at a lock gate. Round 1: a column of 8; round 2: 9 on both banks; round 3: 10 at both locks, up to 7 missiles in the air.',
        why: 'Your review: “I thought this would be the ballistic missile trucks… a parade of them shooting off the ballistic missiles.”',
      },
      {
        date: '2026-11-20',
        log: 42,
        title: 'The Gatecrashers: trucks at the locks',
        what: 'The boss became columns of Rocket Trucks along both banks firing at the ships held in the locks. No torpedo subs on Saltgate; Rocket Trucks at the locks are its signature from wave 4, and the early waves have more going on.',
        why: 'Your chapter 2 run lost in boss round 2; you asked for a mass truck assault on the ships bunched at the locks.',
      },
      {
        date: '2026-11-20',
        log: 38,
        title: 'Rebuilt to the map and wave rules',
        what: 'Two locks hold each ship still under an enemy silo; nine of ten waves aim “at the lock”. A strike on the locks from wave 4 and a Run the Canal boss.',
        why: 'Chapter 2’s last map: fire from close range at ships that can’t move.',
      },
      {
        date: '2026-11-16',
        log: 24,
        title: 'The locks no longer jam',
        what: 'A lock admits only what its chamber holds and shuts on time; frigates berth beside the canal instead of opening a gate.',
        why: 'The locks jammed at higher flow and frigates held the gates open.',
      },
    ],
  },
  battery: {
    look: 'The Blackout boss is always dark now (no star shell at 6 s). Can you still read the jets and the shore guns in the dark on your phone?',
    history: [
      {
        date: '2026-11-24',
        log: 67,
        title: 'Blackout is always dark',
        what: 'The Blackout boss no longer drops a star shell: it is night for the whole round, lit only by your lamp, launch flashes and blasts. Same jets, same shells and heavies at the guns. Bot, your usual Armory, 96 seeds: wins 60% (58% before), boss rounds 0.53 / 0.67 / 0.90 (0.68 / 0.77 / 1.18).',
        why: 'Your note: "Change the boss mode to not include that light power up. It should always be dark."',
      },
      BUSY,
      {
        date: '2026-11-21',
        log: 45,
        title: 'Rebuilt to the map and wave rules',
        what: 'Two allied shore guns cover the east of the lane; enemy shells and heavies go for them first, and a gun knocked out leaves the east open for 12 s. Wave 3’s shell cliff is gone. The Blackout boss rises (dark jets 7 / 8 / 9). Chapter 3’s five new enemies debut on waves 2–6.',
        why: 'Your three Battery runs: lost mostly to shells, 4 ships in wave 3 alone.',
      },
    ],
  },
  sowers: {
    look: 'A bomber now sows its mines 60-130 px ahead of a ship, then fires at the ships it stopped. Watch the stops under that fire: is the automatic pause still fair, and the bomber worth shooting first?',
    history: [
      {
        date: '2026-11-24',
        log: 70,
        title: 'Back in its band: closer mines, bombers that shoot',
        what: 'Still no Hold button; a ship still stops by itself for a mine you can see. A stealth bomber sows its mines closer and quicker, 60-130 px ahead of a ship, takes a seventh hit, and drops its three missiles on the ships its mines stopped. The chutes’ strings come tighter.',
        why: 'With the pause automatic the bot won 85% (plating Armory 93%), above the 50-70% band, since a stopped ship never hit a mine. The fire moves to what you can shoot and to timing, not bigger waves.',
      },
      {
        date: '2026-11-24',
        log: 68,
        title: 'The Hold is automatic; mines show 1.5× earlier',
        what: 'The big Hold button is gone from this map. A ship whose course would put it on a mine pauses by itself, about a third of the spotting distance short of it (1.25 s), and sails on when the mine is shot or has drifted past; a gold pause mark shows over it. Mines surface 3.75 s before a ship reaches them, from 2.5 s. Boss rounds get a little more fire.',
        why: 'Your note: “just make [the vault command] automatic… make mines spottable 1.5 from what it is now… the ship in the path will pause until that mine is shot down.” Mines had caused 3 of your 6 losses.',
      },
      {
        date: '2026-11-22',
        log: 55,
        title: 'Hidden mines and the big Hold button',
        what: 'Every mine drifts hidden and surfaces with a splash about 2.5 s before a ship would reach it. A big Hold button at the foot of the left rail pulses gold and reads NOW! when holding would save a ship. Waves 2, 4 and 5 drop fewer mines.',
        why: 'Your v49 run (won, fun 4, “great boss”): mines should surface near a ship, with a glowing Hold button.',
      },
      {
        date: '2026-11-21',
        log: 48,
        title: 'Rebuilt to the map and wave rules',
        what: 'Mines drift down across the lane from three chutes; one sinks a ship, so each is shoot-it or Hold-and-wait. Stealth Bombers sow mines ahead of the ships from wave 4. The Carpet Run boss: vees of bombers, 2, then 3, then 3 faster.',
        why: 'Chapter 3: a map whose question is when to stop the convoy.',
      },
    ],
  },
  rigs: {
    look: 'Each rig shows its shots left (32 standing); watch the new tug tow. Do the rigs feel sturdy but fair, and are waves 1–3 busy enough?',
    history: [
      {
        date: '2026-11-22',
        log: 55,
        title: 'Rigs count shots; a better tow',
        what: 'Rigs count shots, not damage (32 standing, 10 on tow, 20 docked; a power-up shot counts 1, the Nuke 3), with a counter on each. A proper tug tows relief rigs in. More easy drones in waves 1–3.',
        why: 'Your v49 run (won, fun 5): power-ups melted the rigs; the tow-in was “hilarious” but needed better animation; more action early.',
      },
      {
        date: '2026-11-22',
        log: 49,
        title: 'Rebuilt to the map and wave rules',
        what: 'Four enemy rigs stand right over the lane and fire point-blank; one brought down stays down, its fire moving to the far shore. Relief rigs towed in from wave 4. The Rig Barrage boss: downed rigs rise again and fire together.',
        why: 'Chapter 3: a map where you choose what to bring down.',
      },
    ],
  },
  lantern: {
    look: 'Always dark now: does the lighthouse (a tower, a soft beam, a turning lamp) read on your phone? Does a threat the beam finds ping? Do the shells from the dark bank behind you still feel fair without a star shell?',
    history: [
      {
        date: '2026-11-24',
        log: 67,
        title: 'Always dark; the lighthouse, beam and lamp redone',
        what: 'No Star Shell drops any more: the strait stays dark all wave. The lighthouse is a real tower with a lamp that turns, its beam a soft cone with a bright core, glints on the water and a pale footprint where it lands, easing as it turns at each end; your lamp is a warm pool with a ring that opens out to show where its light ends; a threat the beam finds pings once; a threat in the dark is a glow with a tail along its heading. Bot, your usual Armory, 96 seeds: wins 57% (52% before), waves 1-5 0.74 ships.',
        why: 'Your note: "There should not be a light drop it should always be dark" and "improve the animation and look of the spot light".',
      },
      {
        date: '2026-11-22',
        log: 52,
        title: 'Rebuilt to the map and wave rules',
        what: 'It’s night: a threat is only a glow until the lighthouse beam, your lamp or a star shell lights it. The enemy bank behind the ships as they deliver is never swept and has the shortest flights. Siege batteries rise by the dark bank from wave 4. Boss, Bombardment: siege guns along the far shore, plus guns in the dark.',
        why: 'Chapter 3: watch the beam, or watch your back?',
      },
    ],
  },
  dreadnought: {
    look: 'Do the three gun turrets read as targets, and is shooting them out (4 hits each) worth the ammo against the shells they fire? Does the silo opening before a missile or drone launch read? Does the battleship look and move like a real one now?',
    history: [
      {
        date: '2026-11-24',
        log: 67,
        title: 'The battleship fires from gun turrets you can shoot out',
        what: 'The Dreadnought is redrawn as a real battleship: flared bow, bow wave and wake, conning tower with a turning radar, funnels smoking, three gun turrets that train on your ships, fire with a flash and a puff of smoke and slide back on recoil. Its artillery shells now come only from those turrets, one at a time, and each turret takes 4 hits to shoot out (it burns and fires no more). Missiles and drones launch from a silo aft whose hatches open before every launch. Under the encounter layer; the campaign battleship is drawn the same but fires as before. Bot, your usual Armory, 192 seeds: wins 61% (68% before), waves 1-5 0.55 ships, boss rounds 0.79 / 1.59 / 1.19.',
        why: 'Your notes: "The ship is lame. Have it actually use the targets where the shot artillery and you can take out the targets. You can still have it launch missiles and drones too, just make the missile look like it has a silo for that" and "improve that dreadnought ship and improve the look and animation".',
      },
      {
        date: '2026-11-22',
        log: 51,
        title: 'Rebuilt to the map and wave rules',
        what: 'A battleship steams down the deep channel on waves 3, 6, 9 and 10 firing broadsides with a short flight; 50 hits silence it. Spotter planes lay its guns from wave 4. Boss, the Dreadnought: it stops broadside-on while spotters walk barrages; sink it and the barrage stops.',
        why: 'Chapter 3’s finale: sink it or ride it out?',
      },
    ],
  },
  coves: {
    look: 'Do the boats come out of the caves cleanly (a ring of foam, the hull rising, then out through the mouth) and stay on the water? Do the gunboat and rocket boat stand off the cargo ships and shell from afar, never on top of one? Does the Fire Fleet last long enough (about 26 s a round) and keep you busy with sorties, gunboats, a rocket boat and missiles?',
    history: [
      {
        date: '2026-11-27',
        log: 72,
        title: 'Boats come out of the caves and keep off the ships',
        what: 'Every boat surfaces at the inner end of its cove (foam rings, the hull rising out of the water) and sails out of the mouth before it turns for a ship; none is launched from a truck any more, and none goes over land. The gunboat shells from 150 px off its ship (was 66) and the rocket boat fires from 440 px (was 330); neither sits on a hull, only the speedboat rams. The Fire Fleet is longer, about 26 s a round (was 18-22 s): two sorties 12 s apart, packs of boats, gunboats and missiles spread over the round, a rocket boat in round 3.',
        why: 'Your notes: “boats come outta a cave and clean up the entry animation ... boats slightly go over land ... should not be launched from a truck ... they overlap on the cargo ship ... increase the range of the enemy ship with guns and rockets ... the boss was much too easy, need increase intensity as well as make them longer.”',
      },
      {
        date: '2026-11-24',
        log: 69,
        title: 'Three kinds of attack boat',
        what: 'The boats are redrawn with a proper wake (a foam trail, a bow wave, a long V and a churn at the stern), bank into turns and plane up out of the cove. Speedboat: rushes a ship and goes up in a ball of fire. Gunboat (from wave 3): locks one cargo ship, sails beside it and shells it every 2.4 s until it sinks, then locks the next; 3 hits. Rocket boat (from wave 6, and in the Fire Fleet’s last round): slow, 6 hits, keeps well back and fires salvos of red rockets that cannot be stopped, three salvos, then leaves. Fire ships stay and so does the Fire Fleet; its packs now carry a gunboat and a rocket boat.',
        why: 'The player (wave 2 and 10 notes): “improve the animation and look of the attack boats ... a better wake and move more realistically ... different kinds, more defined: a speed boat that rushes and explodes with fire, one with a small cannon that locks onto a cargo ship and sails with it until it sinks it, and one that shoots rockets like the rocket trucks with a lot more health, more range and slower.”',
      },
      {
        date: '2026-11-22',
        log: 56,
        title: 'Rebuilt to the map and wave rules',
        what: 'Four coves hide fast boats two seconds from the lane. From wave 4 some are fire ships (3 hits) that leave a fireball where sunk. Boss, Fire Fleet: fire ships from every cove at once (4, 6, then 8). Chapter 4’s new enemies debut here.',
        why: 'Chapter 4 begins: stop it at the cove mouth, or on the lane?',
      },
    ],
  },
  delta: {
    look: 'Is the long river worth it: do the ships feel exposed all the way, with something to watch on every leg? Do the Rocket Trucks on the banks read from the lane? Is the island, point-blank on two legs, the danger and the south leg the rest? Does the Long Gauntlet read as fire running down the river?',
    history: [
      {
        date: '2026-11-24',
        log: 69,
        title: 'One long river, no switch',
        what: 'The fork and its switch are gone. The river is one channel about 2.9 times the usual length (the legs at y 170, 470 and 770) that winds back on itself twice between marsh islands: the ships come in on the north leg heading east, turn at the east bend, sail the middle leg west past the carrier’s bay, turn at the west bend and sail the south leg east to the delivery. Eight silos along it (the coast, the island, the islets, the marsh; the drone silos in the middle, so a drone has a long flight to the ships at the river’s ends). From wave 4 the new enemies are Rocket Trucks on the banks, a truck over every leg. Boss, the Long Gauntlet: the whole shore fires down the river silo by silo, each lit 2.5 s before, at the ships nearest it.',
        why: 'The player (v65 run, quit wave 4): “I don’t see the point of the switching lanes. Drop that map design and let’s make a map that is just really long for the ships to traverse ... triple the distance of the normal length. Do some iterations to find the best design.”',
      },
      {
        date: '2026-11-22',
        log: 57,
        title: 'Rebuilt to the map and wave rules',
        what: 'The river forks three ways and the enemy aims at the branch your switch is set to. From wave 4 Incendiary Missiles burn at that branch’s mouth. Boss, Burning Delta: burning oil closes branches, warned 2.5 s ahead with a ring and FIRE.',
        why: 'Chapter 4: which branch do you send them down, when south is no longer the free answer?',
      },
    ],
  },
  crossing: {
    look: 'Do you have time to tap the spotter beacons down (4 taps each)? Is wave 10, the crossing, a proper climax? If the latest Armory feels like a wall, say so.',
    history: [
      {
        date: '2026-11-22',
        log: 58,
        title: 'Rebuilt to the map and wave rules',
        what: 'Two convoys pass each other, outbound north and inbound south. From wave 4 Lure Beacons rise between the lanes where the next two ships pass; each takes 4 hits and calls three shells on the nearest ship. Boss, Beacon Line: lines of spotters firing volleys off both shores.',
        why: 'Chapter 4: which lane do you cover, and when they pass, which ship?',
      },
    ],
  },
  tide: {
    look: 'Does the whole sea pull back and come in slowly enough, with the carrier left on dry sand? Are ships caught on the flats stuck till high tide, and does “THE TIDE TURNS” (8 s ahead) warn you in time?',
    history: [
      {
        date: '2026-11-24',
        log: 68,
        title: 'The whole sea moves; ships on the flats are stranded',
        what: 'At low water the whole sea pulls back from both shores to the deep channel’s bed and floods back in, over 8 s out and 9 s in (from 4 s and 3 s); the carrier’s berth dries too. A ship on the flats lane when the water drops runs aground and stays stuck until the tide is back; nothing moves it to the deep channel. Low water lasts 12–28 s a wave (9–20 s before), and the campaign’s clock is 55 s high, 30 s low. The gauge warns 8 s ahead.',
        why: 'Your notes: “the whole water should pull back… ships left in the low tide are just stuck until the next high tide… tide times should last longer… slower.”',
      },
      {
        date: '2026-11-22',
        log: 61,
        title: 'Rebuilt; the tide moves and ships leave the flats',
        what: 'The tide falls over 4 s and rises over 3 s, sand growing in behind a line of surf; every ship on the flats crosses to the deep channel as it starts to fall, and the gauge warns “THE TIDE TURNS” 5 s ahead. At low water the shore strikes the crowded channel. Boss, Low Water.',
        why: 'Your note: the tide didn’t animate well and ships didn’t leave the low-tide area.',
      },
    ],
  },
  citadel: {
    look: 'Is the Citadel destroyed once (about 70 shots over the waves, the shield rising each wave until it falls) and a ruin after? Does THE CITADEL RETURNS read at the boss, and is the Last Stand a finale (grand salvo lock-on, final collapse)? Does the dome still matter before it falls?',
    history: [
      {
        date: '2026-11-24',
        log: 67,
        title: 'Destroyed once, back for the boss; new dome, generators, keep',
        what: 'The Citadel is destroyed once: the shield still rises each wave until it falls, the Citadel keeps what it has been dealt from wave to wave (70 shots in all), and once down it and its generators stay down, a smoking ruin, its fire off the far silos, until the boss rebuilds it. Two of a wave\'s launches a wave (one before) come off it under the dome from wave 4, so the dome matters while it stands. New look: a hex-lattice dome with a sweeping band, a pulse every few seconds, ripples where a shot is turned away, flicker as generators fall and a shatter when the last goes; each generator charges up and feeds the keep along a lightning tether; the keep is a star fort with turning radar, bastion ports and an iris over its silo that opens for a salvo; it falls in a chain of explosions. For the boss the Citadel is rebuilt (blueprint, walls rising under welding sparks, the dome closing, "THE CITADEL RETURNS"); each grand salvo is announced by rings closing on the keep and a line to the lead ship, and the last Citadel of the game falls longest. Bot, your usual Armory, 192 seeds: wins 60% (51% before), waves 1-5 0.98 ships, boss rounds 0.42 / 1.05 / 2.38; the Citadel falls in wave 4 for 38% of runs, wave 5 for 71%, wave 6 for 88% (dome fire is 8% / 13% of what shows in waves 4 / 5, 3% over waves 4-10, 45% in the boss).',
        why: 'Your note: "It was down in wave 4, it should really only be destroyed once, but it will come back for the boss wave. It should also be better looking and have more unique animations." (Boss rated 3.)',
      },
      {
        date: '2026-11-22',
        log: 60,
        title: 'Rebuilt to the map and wave rules',
        what: 'Three generators (3 shots each) drop the Citadel’s shield, then 14 more shots silence it for the wave; the shield rises again every wave. From wave 4 what it fires can’t be shot inside its dome while the shield stands. Boss, The Last Stand: grand salvos at the lead ship in the narrows.',
        why: 'The game’s finale: spend the shots on the Citadel, or shoot what’s coming?',
      },
    ],
  },
};
