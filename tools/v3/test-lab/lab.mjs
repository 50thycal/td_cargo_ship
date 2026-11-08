// The Test Lab design round: a playtest mode built for testing new things
// fast. The review page (page.mjs) and the plan doc (plan.mjs) are both
// generated from this file, so they can't drift.

export const ROUND_DATE = '2026-11-08';

export const ASK =
  'It\'d be great if we could set up a new mode that basically allows me to playtest all these new features that we have added here, and it goes through the like recording process, and I can make notes as we go … you could have like a new screen that shows like, okay, what are you testing? And then you could have like a checklist showing like what\'s left to test … say I\'m trying out the sprint drones, I don\'t want it to be only just the sprint drones, I want it to be like a mix with like, make it feel like a normal map too … making it easy to like change … what round we\'re on or what weapons we have … so it lines up with the HTML page that we write, so you can easily go between the game and that, write an extra feedback, you can look at the logs.';

/** What makes playtesting slow today (the problems the design answers). */
export const TODAY = [
  'Free Play needs five settings before every test (map, wave, three weapons, enemies), and changing any of them means quitting to the menu.',
  'Nothing in the game says what is left to test, or what to look for.',
  '"Only: Sprint Drones" makes waves of nothing but that enemy, which doesn\'t feel like the real game.',
  'Waiting for the enemy under test to show up wastes minutes.',
  'Feedback is split: notes in the game log, verdicts on the review page, and the two never meet.',
];

/**
 * The pieces of the design. Each is marked Approve / Change / Cut.
 * `see` is what the player sees; `why` the problem it answers; `how` how it
 * is built (on what the game already has).
 */
export const PIECES = [
  {
    id: 'lab-screen',
    name: 'The Test Lab screen',
    see: 'A Test Lab button on the main menu opens one screen: a checklist of everything to test, grouped (new enemies by chapter, reworked weapons, combos). Each line shows its status (to test, Keep, Tune, Cut, skipped), one line on what to look for, and your last note. A progress bar ("9 of 34 tested") and one big button: Next up.',
    why: 'You never have to work out what\'s left or set anything up: open the Lab, tap Next up.',
    how: 'A new overlay screen, like Free Play\'s. Its list comes from the game\'s own roster (every enemy and weapon id), in an order set by how unsure we are about each.',
    mock: 'list',
  },
  {
    id: 'next-up',
    name: 'Next up, and play my next five',
    see: 'Next up starts the most important untested card. "Play 5" queues five cards and runs them back to back: each test ends with the verdict sheet, and the next one starts from there, no menus in between.',
    why: 'The fastest way through the list when you have twenty minutes.',
    how: 'The queue is the checklist order, skipping what you\'ve marked.',
  },
  {
    id: 'mix',
    name: 'A normal-feeling wave, with your card in it',
    see: 'A test plays like a real map: the usual drones and missiles, the other new enemies mixed in as the campaign mixes them, and the one under test showing up about a third of the time. The first one comes within ten seconds, so you never wait for it.',
    why: 'You asked for it not to be only the sprint drones: they should feel like they will in a real map.',
    how: 'The same wave planner as the campaign, with the card\'s enemy weighted up and one forced into the first raid. The map is chosen to suit the card from three: The Strait (open water), The Island (two lanes), the Black Strait (night, for the stealth aircraft). No unlocks needed.',
  },
  {
    id: 'bar',
    name: 'The lab bar, in play',
    see: 'A slim bar at the top while you play: what you\'re testing and its tell ("Watch for: the red circle"), a live count ("came 3 · killed 2 · hit you 1"), and four buttons: Bring one now, Note, Setup, Done.',
    why: 'Everything a test needs is one tap away, without pausing into menus.',
    how: 'Over the game\'s top edge, where the wave banner sits now. Bring one now launches the card\'s enemy (the same hook the browser checks already use). Note opens the existing note form (tags, text, a picture of the moment).',
    mock: 'bar',
  },
  {
    id: 'setup',
    name: 'Change the wave or weapons without leaving',
    see: 'Setup opens a sheet over the paused game: wave (− 5 +), your three weapons and their levels, the mix (Light, Normal, Heavy), speed. Apply restarts the wave right there.',
    why: 'Changing what round you\'re on or what you hold takes seconds, not a trip to the menu.',
    how: 'The run is rebuilt at the new wave with the new kit (as Free Play starts one), keeping the same test card and its log.',
  },
  {
    id: 'verdict',
    name: 'The verdict sheet',
    see: 'Tap Done (the bar suggests it after two waves): Keep, Tune or Cut; quick tags (Can\'t see the tell, Too hard, Too easy, Unfair, Confusing, Fun, Bug); a note box (the phone\'s microphone key dictates into it); the numbers from the test. Then Next: <the next card>, Test again, or Back to the list.',
    why: 'Feedback right when it\'s fresh, in three taps.',
    how: 'The same verdicts as the review page\'s Build tab, so they mean the same thing in both places.',
    mock: 'verdict',
  },
  {
    id: 'evidence',
    name: 'The numbers, counted for you',
    see: 'For the card under test, the game counts:\n- how many came, and how many you stopped before they did harm;\n- what they cost you (hull hits, ships sunk);\n- how long from showing up to your first shot at one;\n- for enemies with a window, how often you made it: Dive Bombers shot before the drop, Rocket Trucks killed while raising, Torpedo Subs hit while up.',
    why: 'Your feel plus the numbers tells me whether to change the tell, the timing or the toughness.',
    how: 'Counted in the sim from what it already tracks (kills, sunk-by, damage by kind), per test.',
  },
  {
    id: 'record',
    name: 'Every test is recorded',
    see: 'Nothing to turn on: every lab run is a full game log with the card, your verdict, tags, notes and pictures, and the numbers. It uploads on its own, like your runs do now.',
    why: 'I can read every test you ran, replay any of them exactly, and see the moment each note was about.',
    how: 'The existing play log with a lab section added; the existing upload.',
  },
  {
    id: 'bridge',
    name: 'One list in the game and on the page',
    see: 'The game and this page use the same list. Every card on the page gets a "Test in game" link that opens the game straight into that test. The Lab screen has a "Feedback page" button. After you test, I copy your in-game verdicts and notes onto the page at the start of my next session, so the page shows the same Keep, Tune and Cut, with your note and a picture of the moment.',
    why: 'You can work from either end, and nothing is entered twice.',
    how: 'A link like …/v3.html?lab=diveBomber starts that test. The game can\'t write to this page itself (its store lives inside claude.ai), so I do the copy from your logs; anything you write on the page stays as you wrote it.',
  },
  {
    id: 'report',
    name: 'Session report, and rewatch a moment',
    see: 'From the Lab screen: what you tested today, each verdict and note with its picture, and how many are left. Tap a note to see that moment of the game again, frozen. "Send now" uploads any log still waiting.',
    why: 'A two-minute look back before you stop, and proof your notes reached me.',
    how: 'The game can already show a log frozen at a step (it\'s how the browser checks look at moments).',
  },
  {
    id: 'combos',
    name: 'Combo cards',
    see: 'Cards that pair two things so you test how they work together: two enemies, or an enemy with a weapon of yours. Eight to start (listed on the Checklist tab).',
    why: 'Most surprises come from enemies meeting each other or your kit, not from one alone.',
    how: 'A combo card features both: both are weighted up and forced into the first raid, with the named weapon loaded.',
  },
];

/** Checklist sections. */
export const SECTIONS = [
  { id: 'enemies', name: 'New enemies (21)', blurb: 'In the order I\'d test them: the ones with an open question first.' },
  { id: 'weapons', name: 'Reworked weapons (5)', blurb: 'Changed in the lock-in build and not played since.' },
  { id: 'combos', name: 'Combos (8)', blurb: 'Two things that should meet.' },
];

/** The checklist, in the order Next up plays it. `look` is the one line
 *  on what to look for (the bar shows it too). */
export const CARDS = [
  // Enemies with an open question first.
  { id: 'diveBomber', section: 'enemies', name: 'Dive Bomber', look: 'The circle, then the plane: can you shoot it in its 1.8 s?' },
  { id: 'siege', section: 'enemies', name: 'Siege Battery', look: 'Are the orange circles enough warning to silence the gun or move?' },
  { id: 'rocketTruck', section: 'enemies', name: 'Rocket Truck', look: 'Is the slow raise (the red ring) enough time to kill the truck?' },
  { id: 'cloud', section: 'enemies', name: 'Volatile Cloud', look: 'The biohazard missile: do you kill it far out, before its gas lands on the lane?' },
  { id: 'lure', section: 'enemies', name: 'Lure Beacon', look: 'It rises out of the water: do your helpers all turn on it inside its yellow ring?' },
  { id: 'decoy', section: 'enemies', name: 'Decoy Drones', look: 'Can you tell the decoys up close? Is waiting worth it?' },
  { id: 'armored', section: 'enemies', name: 'Armored Drone', look: 'Can you see the bank (the yellow ring) and time your shots?' },
  { id: 'torpedoSub', section: 'enemies', name: 'Torpedo Sub', look: 'Is the dashed line readable? Sub, torpedo or move?' },
  { id: 'spotter', section: 'enemies', name: 'Spotter', look: 'Do you notice the painted ship before the strike comes?' },
  { id: 'sprinter', section: 'enemies', name: 'Sprint Drones', look: 'Do you see the flare in time?' },
  { id: 'hydra', section: 'enemies', name: 'Hydra Missile', look: 'Does killing it early feel worth it?' },
  { id: 'loiter', section: 'enemies', name: 'Loitering Drones', look: 'Now or later: do you clear them while they wait?' },
  { id: 'crossWing', section: 'enemies', name: 'Crossing Wing', look: 'Can you catch them at the X?' },
  { id: 'scavenger', section: 'enemies', name: 'Scavenger', look: 'It circles over the water waiting for a pickup: does it read apart from the other drones?' },
  { id: 'attackHeli', section: 'enemies', name: 'Attack Helicopter', look: 'Six hits or its missiles: is it a real choice?' },
  { id: 'stealthJet', section: 'enemies', name: 'Stealth Strafer', look: 'With no warning, is the short run-in enough?' },
  { id: 'stealthBomber', section: 'enemies', name: 'Stealth Bomber', look: 'Does the B-2 read? Six hits too many?' },
  { id: 'tender', section: 'enemies', name: 'Repair Tender', look: 'It sails in and keeps clear of other boats: do you see the green beam and change targets?' },
  { id: 'bodyguard', section: 'enemies', name: 'Bodyguard Ring', look: 'Do you notice the guards taking your shots?' },
  { id: 'picket', section: 'enemies', name: 'Flak Picket', look: 'Do you notice your shots dying in the ring?' },
  { id: 'barge', section: 'enemies', name: 'Supply Barge', look: 'Do the +1s make it a priority?' },
  // Weapons changed in the lock-in build.
  { id: 'dualWield', section: 'weapons', name: 'Dual Wield', look: 'Both hands now end with the boost: does it feel right?' },
  { id: 'cadence', section: 'weapons', name: 'Cadence Gun', look: 'The 0.9 s beat: can you keep it under pressure?' },
  { id: 'focus', section: 'weapons', name: 'Focus', look: 'Hold one finger to slow time, tap with the other: comfortable?' },
  { id: 'gunships', section: 'weapons', name: 'Gunship Pair', look: 'The new flight and Hellfires: do they read, are they useful?' },
  { id: 'supplyRun', section: 'weapons', name: 'Supply Run', look: 'The cargo plane and chutes: clear what you got?' },
  // Combos.
  { id: 'combo-spotter-siege', section: 'combos', name: 'Spotter + Siege Battery', look: 'A painted ship and shells: which do you break first?' },
  { id: 'combo-tender-bodyguard', section: 'combos', name: 'Repair Tender + Bodyguard Ring', look: 'A heavy that\'s guarded and mended: too much?' },
  { id: 'combo-lure-screen', section: 'combos', name: 'Lure Beacon + Drone Screen', look: 'Your drones chasing the buoy: annoying, or a good puzzle?' },
  { id: 'combo-cloud-flak', section: 'combos', name: 'Volatile Cloud + Flak loaded', look: 'Flak catching the biohazard missile far out, or too close to the convoy.' },
  { id: 'combo-decoy-sprint', section: 'combos', name: 'Decoys + Sprint Drones', look: 'What do you shoot first?' },
  { id: 'combo-barge-truck', section: 'combos', name: 'Supply Barge + Rocket Truck', look: 'Bigger raids and rockets you can\'t stop.' },
  { id: 'combo-picket-seeker', section: 'combos', name: 'Flak Picket + Seeker Pod', look: 'Does the picket shut down your seekers?' },
  { id: 'combo-hydra-tesla', section: 'combos', name: 'Hydra + Crossing Wing, Tesla loaded', look: 'Area answers to split targets.' },
];

export const QUESTIONS = [
  {
    id: 'tl-where',
    q: 'Where do you want to give feedback?',
    options: [
      'In the game; Claude copies it onto the review page (recommended)',
      'Quick verdicts in the game, longer notes on the page',
      'On the page only; the game just records',
    ],
  },
  {
    id: 'tl-length',
    q: 'How long is one test?',
    options: [
      'Until you tap Done; after two waves the bar suggests it (recommended)',
      'A fixed 90 seconds, then the verdict sheet',
      'One full wave',
    ],
  },
  {
    id: 'tl-share',
    q: 'How much of the new-enemy mix is the one you\'re testing?',
    options: [
      'About a third, with one in the first ten seconds (recommended)',
      'About half',
      'One per raid, the rest as normal',
    ],
  },
  {
    id: 'tl-scope',
    q: 'What goes on the checklist first?',
    options: [
      '21 enemies, 5 reworked weapons and 8 combos (recommended)',
      'The 21 enemies only',
      'Everything: all 29 weapons too',
    ],
  },
  {
    id: 'tl-start',
    q: 'What does a test start with?',
    options: [
      'Wave 5, with three weapons that suit the card (recommended)',
      'The wave and weapons you used last',
      'Wave 1 and the bare gun',
    ],
  },
  {
    id: 'tl-access',
    q: 'Who sees the Test Lab?',
    options: [
      'On the menu in test builds, hidden in the App Store build (recommended)',
      'Only with developer mode on',
    ],
  },
];
