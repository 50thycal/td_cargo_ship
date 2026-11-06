// The lock-in round (round 4) for the review page (page3.mjs): every weapon
// the plan built as a prototype, the changes made to their specs during the
// builds (for the player to confirm), and the questions before they enter the
// campaign. The weapons' own text and proposed unlock chapters are read from
// the game's data (src/v3/data), and the strength numbers from
// lockin-results.json (tools/v3/weapon-ideas/lockin-sweep.mjs writes it), so
// nothing on the page is retyped.

export const LOCKIN_DATE = '2026-11-06';

/** Which build each prototype came in (docs/design/v3-weapons-build-N.md). */
export const BUILT_IN = {
  lance: 1, cutter: 1, grapnel: 1, chainshot: 1, firecontrol: 1, cadence: 1,
  droneScreen: 2, gunships: 2, bomberWing: 2, orbital: 2,
  fireAtWill: 3, supplyRun: 3, overclock: 3, dualWield: 3, hotStreak: 3, wildCard: 3, focus: 3,
  overdrive: 3, timeWarp: 3, shield: 3, fullSteam: 3,
  tidal: 4, storm: 4, ammoShip: 4,
};

/** The player's own ideas (round 2: "your idea"). */
export const YOURS = ['lance', 'droneScreen', 'gunships', 'bomberWing', 'fireAtWill', 'supplyRun'];

/** The player's maybes (phase 4): kept only if they play well. */
export const MAYBES = {
  tidal: 'I think mechanically it will not work well with the game.',
  storm: 'Might not work well with the game.',
  ammoShip: 'Play around with this.',
};

/** Boosts measured beside a weapon, since alone they have nothing to act on. */
export const PAIRED = {
  overclock: { row: 'flak+overclock', vs: 'flak+railgun', label: 'Flak + Overclock', vsLabel: 'Flak + Railgun' },
  dualWield: { row: 'flak+railgun+dualWield', vs: 'flak+railgun+scatter', label: 'Flak + Railgun + Dual Wield', vsLabel: 'Flak + Railgun + Scattergun' },
};

/** What to try on the phone: the part a bot can't judge. */
export const WATCH = {
  lance: 'Does the half and full charge read on the ring, and is 0.7 s the right hold?',
  cutter: 'Strongest weapon in the game at MAX. Too strong, or the fun one?',
  grapnel: 'Does swinging a heavy into a pack feel worth the hold?',
  chainshot: 'Is picking a second threat in reach natural mid-raid?',
  firecontrol: 'Its value is reading a raid and marking, which the bot doesn’t do.',
  cadence: 'Can you hold the beat with the closing ring while a raid comes in?',
  droneScreen: 'Do the drones read as yours against enemy drones?',
  gunships: 'Close to the strongest; is it too hands-off?',
  bomberWing: 'A shore weapon: does a silenced silo feel like a win?',
  orbital: 'Do the laser dots give you time to see what it locked?',
  fireAtWill: 'The bot never holds, so full-auto is untested by it. Does holding feel good?',
  supplyRun: 'Do drops flying in read clearly, and does Airdrop matter with weapons held?',
  overclock: 'Is the stopped clock (OC on the chip) clear?',
  dualWield: 'Does the next kill dropping a weapon read as the boost doing it?',
  hotStreak: 'The bot barely gains; a sharp player should. Does the streak feel earned?',
  wildCard: 'Fun surprise, or random noise?',
  focus: 'The bot barely gains; it is about your hands. Does slow motion under a finger work on the phone?',
  overdrive: 'The strongest boost, and the old relief when the rack runs dry.',
  timeWarp: 'Does the grey, trailing, low-pitched world read as slowed time?',
  shield: 'Does the shatter on a strafing run read clearly?',
  fullSteam: 'Weak by the bot; does running for it feel useful?',
  tidal: 'Weak by the bot; boats and mines are rare on most maps.',
  storm: 'Weak by the bot; you can’t steer it.',
  ammoShip: 'Does protecting it change how you play?',
};

/** Changes made to a spec during the builds, each from a measurement or a
 *  phone check. The player confirms or changes each (collection `checks`). */
export const CHECKS = [
  { id: 'c-lance', weapon: 'lance', build: 1, was: 'Half charge 0.6 s, full 1.2 s.', now: 'Half 0.35 s, full 0.7 s; level 2 also makes the half bolt pierce.', why: 'A charge only for heavies hardly mattered (13% at MAX); now 36% (build 1).' },
  { id: 'c-chainshot', weapon: 'chainshot', build: 1, was: 'A round a chain; MAX adds a third link.', now: 'The chain is free (the first tap’s shot costs the round); MAX links hit for 4.', why: 'At a round a chain it fell below the plain gun.' },
  { id: 'c-firecontrol', weapon: 'firecontrol', build: 1, was: 'The salvo fires 0.8 s after the last mark, a round a mark.', now: '0.4 s after the last mark, never more than 1 s after the first, at once when full; a round for every two marks.', why: 'Marking a steady stream kept pushing the salvo back.' },
  { id: 'c-drones', weapon: 'droneScreen', build: 2, was: 'Hornet Nest: every 0.9 s, rams burst.', now: 'Every 0.7 s, rams burst.', why: 'At level 2’s rate the burst added little.' },
  { id: 'c-orbital', weapon: 'orbital', build: 2, was: '3 hits to the biggest; MAX: the beam stays 1 s and sweeps on.', now: '3 hits, 1 to what is around it; skips rigs and generators while anything else is up; MAX: every 1.2 s, lingers 0.5 s onto the next.', why: 'One target every 2.5 s rarely mattered.' },
  { id: 'c-bomber', weapon: 'bomberWing', build: 2, was: 'Each pass silences a silo; MAX two silos.', now: 'Trucks first, then the busiest silo, then a tunnel; MAX two targets a pass, a surfaced sub too.', why: 'A truck on screen is the closest launcher.' },
  { id: 'c-freeplay', weapon: null, build: 3, was: 'Free Play dropped every power-up.', now: 'Free Play drops follow the plan: ammo, repair, the Nuke. The campaign keeps the four power-ups until their boosts go live.', why: 'So Free Play plays the rules you would lock in.' },
  { id: 'c-dual-call', weapon: 'dualWield', build: 3, was: 'The next weapon picked up joins the loaded one.', now: 'And while a hand is free, the next kill drops a weapon (never a boost).', why: 'A second weapon almost never came inside 15 s: two hands loaded 0% of the time.' },
  { id: 'c-dual-hands', weapon: 'dualWield', build: 3, was: '(not specified after the boost ends)', now: 'Both hands keep the rest of their time; a new pickup takes the first hand, or refreshes the hand holding it.', why: 'Your round 2 note: “both stay loaded together for the rest of their time”.' },
  { id: 'c-overclock', weapon: 'overclock', build: 3, was: 'On a MAX weapon, it drops more often instead.', now: 'Its clock still stops, and it drops more often. Nothing loaded: the next kill drops a weapon.', why: 'With the drops alone, Flak at MAX was loaded 23% of the time against 43% without it.' },
  { id: 'c-hot', weapon: 'hotStreak', build: 3, was: 'Double or triple damage.', now: 'Damage and a burst 1.8× / 2.6× wider; a loaded weapon’s own aimed shot counts as a hit.', why: 'Most threats die to one hit, so damage alone did nothing; a Railgun never built a streak.' },
  { id: 'c-leadrain', weapon: 'fireAtWill', build: 3, was: 'Every 4th held shot bursts into flak.', now: 'Every 4th shot, held or tapped.', why: 'The game can’t tell a held shot from fast taps in the play log.' },
  { id: 'c-shield', weapon: 'shield', build: 3, was: 'Level 2 blocks strafing runs.', now: 'It blocks one whole strafing run, shatters, and the boost ends.', why: 'Your note: “an animation showing the shields breaking when the strafing run hits”.' },
  { id: 'c-wild', weapon: 'wildCard', build: 3, was: 'A random weapon a tap.', now: 'From the ten a single tap can fire (no gestures, Chain Shot, Fire Control, Frigates or Aegis); a passive’s tap is its one shot.', why: 'The others need a hold, a swipe, two taps or 15 s.' },
  { id: 'c-tidal', weapon: 'tidal', build: 4, was: 'A shot on open water raises the wave.', now: 'A tap on open water or on what the wave takes (a boat, a mine, a low drone) raises it there.', why: 'On a phone a tap reaches ~135 px of sea: there was never open water beside a boat.' },
  { id: 'c-storm', weapon: 'storm', build: 4, was: 'Drifts across with the wind.', now: 'Rolls in from the upwind side, between the enemy shore and the convoy; every other missile crossing it is blown off.', why: 'Placed by the convoy, cells sat off the edge or over land.' },
  { id: 'c-ammo', weapon: 'ammoShip', build: 4, was: 'Sails in the middle of the convoy.', now: 'Sails in at the entry and stays until port or sunk; a pickup while it floats repairs it.', why: 'A ship can’t turn round mid-lane.' },
];

/** Round 4's questions. New ids: earlier rounds' answers stay readable. */
export const LOCK_QUESTIONS = [
  {
    id: 'lk-drops',
    q: 'When the boosts go live, the campaign’s default drops become ammo, repair and the Nuke (Overdrive, Time Warp, Shield and Full Steam drop only as boosts you drafted). Measured, holding nothing then wins {{none}} of runs instead of {{campaign}}, and in your playtest you tapped an empty rack {{dry}} times in 10 runs. Go ahead?',
    options: ['Yes, and check running dry in the pacing pass (recommended)', 'Yes, and raise the ammo drop now to make up for Overdrive', 'Keep Overdrive as a default drop as well'],
  },
  {
    id: 'lk-pool',
    q: 'How do the kept weapons enter the campaign’s draft? Each card shows a proposed chapter; you can change it there.',
    options: ['A few per chapter, as marked on the cards (recommended)', 'All from chapter 1', 'Boosts from chapter 2, the rest as marked'],
  },
  {
    id: 'lk-cutter',
    q: 'Laser Cutter at MAX (Searing Edge) wins {{cutter}} of runs, the most of any weapon, just ahead of Gunship Pair ({{gunships}}) and Frigates ({{frigate}}). Trim it?',
    options: ['Leave it until you have played it (recommended)', 'Trim it toward the other strong ones', 'Leave it: one standout weapon is fine'],
  },
  {
    id: 'lk-hands',
    q: 'Some weapons are about your hands, and the bot barely gains from them: Focus, Hot Streak, Cadence Gun, Fire at Will’s full-auto. Whose judgement decides?',
    options: ['My playtest; keep them as they are unless they feel weak (recommended)', 'Buff them up to the middle of the table now'],
  },
  {
    id: 'lk-sounds',
    q: 'The {{sounds}} new sounds borrow existing files, re-pitched. When do they get their own?',
    options: ['Before the weapons go live in the campaign (recommended)', 'After they go live', 'They are fine as they are'],
  },
  {
    id: 'lk-next',
    q: 'Once you have marked everything, what next?',
    options: ['Lock in the keeps, rework the changes, then the pacing pass (recommended)', 'Another playtest build of the changes first', 'Something else (note)'],
  },
];

// ---- Round 4, part 2: the player's Free Play playtest (2026-11-06) ----
// Ten runs and six notes, kept in playtest-2026-11-06.json. What follows is
// built from them: a read of each weapon, the questions the notes raise, and
// the changes they ask for.

export const PLAYTEST_DATE = '2026-11-06';

/** My read of each prototype after the playtest: a suggested verdict and the
 *  one reason. The player's own mark always wins; this is a starting point. */
export const READ = {
  lance: { v: 'change', why: 'Passed over for Orbital Strike when offered and the bot has it near the bottom (30% at MAX). Worth one focused run before cutting.' },
  cutter: { v: 'keep', why: 'Used in both runs it was in; the strongest weapon by the bot.' },
  grapnel: { v: 'keep', why: 'You: “the grapple one was probably the most fun so let’s explore that.” Picked three times, to MAX.' },
  chainshot: { v: 'cut', why: 'You called this run’s weapons mostly bad (see the question on your note); the bot has it second weakest (22% at MAX).' },
  firecontrol: { v: 'cut', why: 'Same note; the weakest active at MAX by the bot (19%).' },
  cadence: { v: 'change', why: 'You: slower, “tap tap tap in the same intervals”: it burned the rack too fast.' },
  droneScreen: { v: 'keep', why: 'Picked twice to MAX over Storm Front; that run was won.' },
  gunships: { v: 'change', why: 'Strong (54% at MAX) and picked; your notes ask for Hellfire-style missiles and natural helicopter movement.' },
  bomberWing: { v: 'cut', why: 'Passed over for Gunship Pair, used once, stayed at level 1; the bot has it low (26% at MAX).' },
  orbital: { v: 'keep', why: 'First pick in both runs it was in, taken to MAX.' },
  fireAtWill: { v: null, why: 'Not played yet. The bot has it among the strongest boosts (47% at MAX).' },
  supplyRun: { v: 'change', why: 'You: a big cargo plane should fly in and drop the crates in a row.' },
  overclock: { v: null, why: 'Not played yet. Beside Flak it beat a Railgun in the same slot.' },
  dualWield: { v: 'change', why: 'You: “Dual weld is great”, but the weapons should last as long as the boost.' },
  hotStreak: { v: 'cut', why: 'Picked once in a lost run; the weakest boost but Focus by the bot (10% at MAX).' },
  wildCard: { v: 'keep', why: 'Picked and used six times in a won run.' },
  focus: { v: 'change', why: 'You: one finger down holds the slowdown while the other taps.' },
  overdrive: { v: 'keep', why: 'Taken to MAX in a won run; the strongest boost by the bot.' },
  timeWarp: { v: 'keep', why: 'Your first pick in its run, which was won.' },
  shield: { v: 'change', why: 'Never picked when offered and flat by the bot (21% → 22%): MAX needs more.' },
  fullSteam: { v: 'keep', why: 'Picked and used in a won run, though the bot rates it low (12% at MAX).' },
  tidal: { v: 'keep', why: 'Your first pick in its run, used five times, and that run was won.' },
  storm: { v: 'cut', why: 'Passed over every time it was offered and stayed at level 1; the bot rates it low.' },
  ammoShip: { v: 'keep', why: 'Picked and used in a won run; strong by the bot (42% at MAX).' },
};

/** Questions the notes raise (new ids: `pt-…`). */
export const NOTE_QUESTIONS = [
  {
    id: 'pt-fc-cs',
    q: 'After the Fire Control, Chain Shot and Grapnel run you wrote: “most of the weapons on this one were bad. The grapple one was probably the most fun so let’s explore that but the other two are definitely in”. Did you mean the other two are out?',
    options: ['Out: cut Fire Control and Chain Shot (keep Grapnel)', 'In: keep all three', 'Keep one of them (say which)'],
  },
  {
    id: 'pt-dual',
    q: 'Dual Wield (“great”): you want the weapons to last as long as the boost. Which?',
    options: ['Both weapons’ clocks stop while Dual Wield runs; they run out after it ends (recommended)', 'Both weapons end exactly when the boost ends', 'Something else (note)'],
  },
  {
    id: 'pt-cadence',
    q: 'Cadence Gun: “a little slower … tap tap tap in the same intervals” (it burned the rack too fast). The beat is every 0.6 s, a round a beat shot. Which?',
    options: ['A beat every 0.9 s (recommended)', 'A beat every 1.2 s', 'Keep 0.6 s, but beat shots cost no round'],
  },
  {
    id: 'pt-focus',
    q: 'Focus: “one finger down and then tap with the other one”. Today the finger that starts the slowdown also fires, and keeps firing while held. Which?',
    options: ['The holding finger only slows time (no shots); the other finger taps (recommended)', 'The holding finger also fires one shot where it lands, then only slows'],
  },
];

/** What the notes ask to be built, each for a Looks right / Change check
 *  (collection `checks`, ids `n-…`). */
export const NOTE_CHECKS = [
  { id: 'n-heli-missiles', weapon: 'gunships', said: 'make their projectiles look like hellfire missiles … a missile with like a you know a streak', now: 'Each rocket pod becomes a visible missile with a smoke streak flying from the helicopter to the burst, in place of the instant tracer line.' },
  { id: 'n-heli-move', weapon: 'gunships', said: 'should rotate and then lean into it like a helicopter', now: 'Helicopters turn toward where they are going before moving, tilt into the move, and ease in and out of their hover, with no snapping.' },
  { id: 'n-supply-plane', weapon: 'supplyRun', said: 'a big cargo plane to come in and drop it in a row', now: 'A cargo plane crosses the screen and drops the crates in a row along its path, each under a parachute; they then fly to the carrier as now.' },
  { id: 'n-dry', weapon: null, said: '(the logs) taps on an empty rack in every run', now: 'The pacing pass looks at running dry first: the Free Play runs had {{dry}} taps on an empty rack, most with Overdrive gone from the default drops.' },
];
