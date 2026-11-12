// The Map & Convoy Lab review, round 1: slices 0 and 1 (the baseline, the
// audit and the telemetry). The page (tools/v3/map-lab/page.ts) and the
// slice's notes (docs/design/v3-map-lab-slice0-1.md) are both written from
// this file and from the results files beside it, so they can't drift.
//
// Store ids are stable: `reviews/{finding id}` (verdict 'ok' | 'change',
// note) and `answers/{question id}` (choice, note). A later round adds new
// ids and never reuses these.

export const ROUND = { n: 1, date: '2026-11-12', name: 'Slices 0 and 1: the baseline and the telemetry' };

/** What was checked or built, each with its evidence. `kind` says how sure
 *  it is: measured here, a decision made (and why), or something found in
 *  the game as it stood. */
export const FINDINGS = [
  {
    id: 'ml1-equal',
    group: 'gate',
    kind: 'measured',
    title: 'The game plays the same with telemetry on and off',
    says: 'Every baseline run and every audit run was played twice side by side, one with telemetry and one without, and compared after every step. The inputs, the final state and the number of random draws were also compared with the build before this change.',
    evidence: ['equal', 'crossbuild'],
  },
  {
    id: 'ml1-adds-up',
    group: 'gate',
    kind: 'measured',
    title: 'What it records adds up to the game',
    says: 'Hull points removed, sinkings, deliveries, kills, launches, pickups and taps in the telemetry match the game\'s own counters in every run. The telemetry also checks itself every step: any hull point, ship, pickup or threat that changes with no event would show as an "audit" line. There were none.',
    evidence: ['reconcile'],
  },
  {
    id: 'ml1-replay',
    group: 'gate',
    kind: 'measured',
    title: 'A play log replays to the same telemetry the live run made',
    says: 'A Test Lab run on Harbor Mouth was played by touch in a phone-sized browser. The telemetry recorded live, the telemetry from replaying its log in the browser, and the telemetry from replaying it under Node are identical. So telemetry never has to be uploaded: any play log on this log version can be turned into it later.',
    evidence: ['browser'],
  },
  {
    id: 'ml1-baseline',
    group: 'baseline',
    kind: 'decision',
    title: 'The baseline: twelve stored runs on the three reference maps',
    says: 'Four per map: a whole campaign by the sharper bot with Wide Warhead 3, one by the bot fitted to your own play with the base gun, the map\'s event on its own (starting at wave 11), and a start at wave 6 with two passives so the Siren Field bonus wave comes. Each is a stored play log plus what it replays to. A test fails if any of them stops replaying exactly, which is how a later change to the sim shows itself.',
    evidence: ['baseline'],
  },
  {
    id: 'ml1-names',
    group: 'telemetry',
    kind: 'measured',
    title: 'Every hit names what did it, and where that was launched from',
    says: 'Before this, a hit knew only the kind of threat ("ballistic"). Now each hit carries the attacker\'s own id, and each launch carries its launcher: the base, the truck or submarine, the bomber that dropped it, the missile it split from. A blast that reaches three hulls is three events sharing one impact number, each with the hull points really removed.',
    evidence: ['audit', 'gaps'],
  },
  {
    id: 'ml1-phases',
    group: 'telemetry',
    kind: 'measured',
    title: 'Normal waves, the bonus wave and the map\'s event are kept apart',
    says: 'Every event belongs to a stretch of the run: a normal wave, the bonus wave (Siren Field keeps the number of the wave it follows, so the game\'s own wave records can\'t tell them apart), or the map\'s event run 1, 2 or 3. Each event stretch carries the grade the game gave it.',
    evidence: ['phases'],
  },
  {
    id: 'ml1-sidecar',
    group: 'telemetry',
    kind: 'decision',
    title: 'Telemetry is a sidecar made by replay; the play log is unchanged',
    says: 'The log stays version 20 with nothing added, so older logs and every existing tool work as before. Telemetry is recorded live only in Test Lab runs, dev mode, or with ?tel=1, and stays on the device. It is never recorded in ordinary campaign play and is compiled to do nothing in the App Store build.',
    evidence: ['storage'],
  },
  {
    id: 'ml1-sampling',
    group: 'telemetry',
    kind: 'measured',
    title: 'Ship positions: 4 times a second, to a tenth of a unit',
    says: 'The plan suggested 4 to 5 times a second. Measured against every step\'s true positions, 4 Hz gets each 50 x 50 square\'s ship-seconds right to within 0.6% on the reference maps and 2.5% on a bending lane. Whole-unit rounding was tried first and was wrong by up to a third on Harbor Mouth, where a lane runs along a grid line.',
    evidence: ['sampling'],
  },
  {
    id: 'ml1-cost',
    group: 'telemetry',
    kind: 'measured',
    title: 'What recording costs',
    says: 'Measured in Chromium at a phone\'s screen size, with the processor slowed four times as a stand-in for a phone. It has not been measured on a real iPhone.',
    evidence: ['cost'],
  },
  {
    id: 'ml1-carrier',
    group: 'found',
    kind: 'found',
    title: 'Found: the game\'s carrier damage tally counts the warhead, not the hull removed',
    says: 'When a hit takes the carrier\'s last points, the game\'s own "carrier damage by threat" adds the warhead\'s full damage. In 3 of 60 audit runs that tally read 14 for a carrier with 12 hull points. Nothing in play depends on it. The telemetry records both numbers, so nothing was changed.',
    evidence: [],
  },
  {
    id: 'ml1-resupply',
    group: 'found',
    kind: 'found',
    title: 'Found: a Resupply card lowers a supertanker\'s hull from 8 to 3',
    says: 'Resupply sets every ship afloat to a cargo ship\'s full hull (3). A supertanker (The Behemoth Run) has 8, so taking Resupply while one is afloat and undamaged makes it weaker. It only happens on that map, between waves. Not changed here: this round is not allowed to touch balance.',
    evidence: [],
  },
  {
    id: 'ml1-limits',
    group: 'found',
    kind: 'found',
    title: 'What this round does not record yet',
    says: 'Left for later slices, on purpose: a threat\'s change of target mid-flight (positions are sampled twice a second instead); each helper shot as its own event (their hits are recorded, with the helper named); how long a warning was on screen before a person could see it at night; speed and pause presses. Convoy commands are recorded as they are today (flow, formation, the Delta\'s switch); no new command exists yet.',
    evidence: [],
  },
];

export const GROUPS = [
  { id: 'gate', name: 'The gate', blurb: 'What slices 0 and 1 had to prove before anything else is built on them.' },
  { id: 'baseline', name: 'The baseline', blurb: 'The fixed runs every later comparison starts from.' },
  { id: 'telemetry', name: 'The telemetry', blurb: 'What is recorded, where it lives and what it costs.' },
  { id: 'found', name: 'Found on the way', blurb: 'Things the audit turned up in the game as it stands. None was changed.' },
];

/** The first maps: one item each, so each can be marked. */
export const MAP_ITEMS = [
  { id: 'ml1-map-strait', map: 'strait', ask: 'Does this match what you see when you play The Strait?' },
  { id: 'ml1-map-gauntlet', map: 'gauntlet', ask: 'Does this match what you see when you play The Gauntlet?' },
  { id: 'ml1-map-harbor', map: 'harbor', ask: 'Does this match what you see when you play Harbor Mouth?' },
];

export const QUESTIONS = [
  {
    id: 'ml1-next',
    text: 'What should the next session build?',
    why: 'The plan\'s next step is slice 2: the heatmap viewer, with filters by wave, enemy and time, a scrubber, and a tap on a hotspot that opens the replay just before it. The maps on this page are a fixed first look, with none of that.',
    options: ['Slice 2 as planned: the viewer (recommended)', 'First record more (say what in the note)', 'Stop here for now'],
  },
  {
    id: 'ml1-where',
    text: 'Where should the heatmap viewer live?',
    why: 'The plan says to extend the Test Lab, with the desktop as the main place to study and the phone getting a summary.',
    options: [
      'A Map Analytics screen in the Test Lab, reading the runs kept on the device, plus a report page made from any log file (recommended)',
      'Only the screen in the Test Lab',
      'Only a report page outside the game',
    ],
  },
  {
    id: 'ml1-human',
    text: 'Will you play the three reference maps once each with telemetry on?',
    why: 'Every map on this page comes from bots, which see in the dark and react faster than a person. The Test Lab\'s map cards for The Strait, The Gauntlet and Harbor Mouth now record telemetry by themselves, and your logs upload as usual, so one run of each gives the viewer a person to compare the bots with.',
    options: ['Yes: I will play those three map cards (recommended)', 'Use my existing logs from round 8 instead', 'Bots only for now'],
  },
  {
    id: 'ml1-armory',
    text: 'Which Armory should the bots have in the baseline?',
    why: 'Now: the bot fitted to you plays with the base gun, and the sharper bot with Wide Warhead 3. The plan asks for Armory states that match where a player really is on each map.',
    options: ['Keep these two (recommended for now)', 'Add what I really had on each map (say what in the note)', 'One middle Armory for all three maps'],
  },
  {
    id: 'ml1-resupply',
    text: 'The Resupply card that lowers a supertanker\'s hull: fix it?',
    why: 'It is a one-line change (Resupply never lowers a hull), but it is a change to the sim, so the baseline would be written again and the log version looked at.',
    options: ['Fix it in its own small change (recommended)', 'Leave it'],
  },
  {
    id: 'ml1-live',
    text: 'When should telemetry be recorded live?',
    why: 'Now: Test Lab runs, dev mode and ?tel=1. Any uploaded log can be turned into telemetry afterwards, so recording live only saves the replay.',
    options: ['Keep it to the Test Lab and dev mode (recommended)', 'Also every run on a test build', 'Never live: always by replay'],
  },
];

/** The attribution gaps the audit found, and what slice 1 did about each. */
export const GAPS = [
  ['A hit on a ship, the carrier or a post', 'Knew only the kind of threat', 'The attacker\'s id, the impact point, the hull points really removed'],
  ['A truck\'s rocket, a dive bomber\'s bomb', 'No link to the truck or the plane', 'Carries the id of what fired it'],
  ['An Incendiary Missile\'s fire, a Fire Mission shell', 'No link to the missile or the spotter', 'Carries the id of what it came from'],
  ['A bomber\'s missile, a helicopter\'s rocket, a torpedo', 'Blamed on a kind ("bomber")', 'Names the very bomber, helicopter or submarine'],
  ['A bomblet, a mini-drone, a Hydra\'s dart', 'Blamed on a kind', 'Names the threat it split from'],
  ['A pickup', 'Only a count of those taken', 'Dropped, then taken, expired or cleared with the wave, each with its place'],
  ['A cargo ship', 'Only totals delivered and lost', 'Each ship from sailing to delivery or sinking, with its lane and positions'],
  ['A tap', 'Only counts (fire, pickup, dry, empty)', 'Where, what it went for, what was loaded, the rack before and after'],
  ['Flow and formation', 'In the play log, with no result', 'What was asked, what stood before, whether it changed anything'],
  ['The bonus wave', 'No wave record of its own', 'Its own stretch, with its grade'],
];
