// The map rebuild's living plan: what the player decided (from the round 1
// marks, review-2026-11-17.json), how the rules changed because of it, where
// the build stands, and what needs the player now.
//
// The hub page (page.mjs) is the player's main way to follow the work: they
// don't read chat. Any session that changes the plan or finishes a step
// updates STATUS (and NEEDS when a decision is needed), regenerates the page
// and republishes it to the same URL. Rules:
//   - NEEDS holds only things that need the player now. Never repeat a
//     question they have answered; once answered, an item moves to the
//     archive (the page does it live; the next session moves it here).
//   - New questions get new ids (r2-..., r3-...). Never reuse an id.

export const PAGE = 'https://claude.ai/artifact/LeZK1fL9QFusN5qQNAoAmb';

// ---- Round 1 decisions folded into the rules (the player's notes quoted).
// A revision replaces the rule's title/text/check; `note` is the player's.
export const REVISIONS = {
  'g-named': {
    title: 'Every encounter has internal notes on where and at what',
    rule: 'Each encounter carries internal design notes (not shown to the player): which sites fire, which stretch they aim at, and how it uses the map. What the player sees stays short and plain (“Drone swarm”).',
    check: 'The encounter data has the notes; the test fails an encounter without them. The player-facing call-out names the threat, not the site.',
  },
  'm-enemy': {
    title: 'Every new enemy gets its own debut',
    rule: 'Not every map needs a new enemy of its own: there may not be enough enemy types for 20 maps. But every enemy, the first time it appears in the campaign, gets a debut: alone (or with drones only) for a wave before it mixes in. Never a foe from a later chapter.',
    check: 'The campaign plan lists each enemy’s debut map and wave. The encounter test still fails a later-chapter foe.',
  },
  'm-kits': {
    title: 'Each map’s problem has counters among your weapons',
    rule: 'A map’s threats favour certain weapons: very large swarms reward area weapons, many heavy hitters reward high damage, fast sprinters reward aimed shots. The map card names the counter weapons it is built around. Picking a counter should feel like solving the map; no single kit should win it without losing a ship.',
    check: 'Bots run the map with its counter kit and with an off-counter kit: the counter kit does clearly better, and neither is trivial.',
  },
  'm-shape-convoy': {
    title: 'The convoy is a design lever, set per map',
    rule: 'How ships come (a single line, a wide spread, a large volume, spacing that follows the water) is set per map to change how it plays. It is a lever for map design, not a fixed rule.',
    check: 'The map card says how the convoy comes and why.',
  },
  'q-player': {
    title: 'Bots and heat maps decide; your playtest is the vibe check',
    rule: 'Rebuilt maps are tuned with bot testing and the map-lab heat maps first; sessions read those results and recommend the wave designs. You play once that testing is done. Your scorecard is a vibe check, not a pass/fail threshold, and the scorecard itself gets an overhaul so it is easier to rate well.',
    check: 'Each map ships with a bot report (heat map, losses by wave, kits) and then your playtest. A poor vibe check sends it back for another bot loop.',
  },
  'q-batches': {
    title: 'Roll out a chapter at a time, bots first',
    rule: 'Fix the three reference maps to the rules first. Then rebuild the other maps one chapter at a time. In each batch, the bots and heat maps do the testing and tuning; you play the batch once the bots are happy.',
    check: 'A batch is ready for you when every map passes the automatic checks and has a bot report.',
  },
};

// Approved rules the player added a note to: kept with the rule.
export const NOTES = {
  'q-card': 'Run a preliminary bot test if needed, to get an idea of the map’s flow before writing the card.',
  'w-arc': 'Keep in mind this might get “boring” for players. Move forward with it and modify later if needed.',
};

// What round 1's questions settled (the archive shows the full question).
export const SETTLED = [
  'The Strait stays as it is: map 1 may be a 3. (Its waves still follow the wave rules.)',
  'Early waves: one real close call per wave from wave 3; a good player loses 0–1 ships by wave 5.',
  'Encounter style: the original (v1) on every map; set pieces (v2) and enemy pairs (v3) are dropped.',
  'Boss rounds: about one ship a round for a good player.',
  'Overpowered combos wait until after the rollout; you’ll note the ones that feel too strong as you play.',
  'Testing: one playtest per map, in batches, after the automatic checks and bots.',
  'Order: the three reference maps first, then Kesh and Marrow, then chapter by chapter.',
  'Convoy commands only where a map’s mechanic needs one (like Hold on Sowers’ Reach).',
  'Your note: lots of bot testing and heat maps first, with sessions reading the results and recommending the best wave designs; you play once that is done, to save your time.',
];

// ---- Where the build stands. Sessions update this.
export const STATUS = {
  updated: '2026-11-17',
  headline: 'The Strait, the Gauntlet and Harbor Mouth are rebuilt to the rules and pass every bot check. Your turn: play the three map cards in the Test Lab.',
  phases: [
    { id: 'rules', name: 'Map and wave rules', state: 'done', detail: '31 rules: 26 approved; 6 rewritten from your notes and answers (marked in “The plan”). Round 1 questions all answered.' },
    { id: 'bots', name: 'Bots that play like you', state: 'done', detail: 'Refit from your 18 runs, each replayed by the bot with your own setup and Armory upgrades. Boss rounds: 1.37 ships a round before, 1.03 now (you: 0.52). Waves 1–5: 1.19 before, 0.69 now (you: 0.50). The fix: you grab pickups faster as the stakes rise (0.4–0.8 s in boss rounds); the bot only looked between bursts. It also plays at 1× with your Armory now. Still off: the Strait’s and Harbor’s boss rounds read harder to the bot than to you (about 1.3 a round where you lose 0), so their targets are set on the bot’s scale.' },
    { id: 'scorecard', name: 'The new scorecard', state: 'done', detail: 'Live in the Test Lab (#161). Before you rate, it shows your last scores for this map and the others; your run’s waves in a strip with the moments the game marked, to pick best and weakest; one “compared with the map you rated last” question; and only Fun, Difficulty, Play again and a note.' },
    { id: 'checks', name: 'Automatic checks and bot reports', state: 'done', detail: 'Built (#162). Each map now gets a bot report: losses per wave, cliffs, close calls, wave budgets, the danger and safe stretches, warning time, kits and a heat map. Encounters carry internal notes. Tests catch later-chapter foes and repeated encounters. First readings on the three reference maps: every map has a cliff (the Gauntlet’s wave 8 jumps from 0.75 to 3 ships for the bot); Harbor’s waves 4–7 send a third fewer attacks than they should; the Strait and the Gauntlet have no clearly safe stretch; every encounter repeats 3–4 waves in a row.' },
    { id: 'reference', name: 'The three reference maps to the rules', state: 'now', detail: 'Rebuilt with the bots and live (#163, merged); every bot check passes on all three. Each map now has one encounter a wave with none repeated, real stakes from wave 3, no loss cliffs, a clear danger and safe stretch, counter weapons named, and boss rounds that rise. The Strait’s Rush and Harbor’s Breakout now cost ships; the Gauntlet’s Rocket Convoy is a little softer. Waiting on your playtest (see Needs you).' },
    { id: 'ch1', name: 'Chapter 1: Kesh and Marrow', state: 'later', detail: 'Map cards, build, bot loop, then your playtest.' },
    { id: 'ch2', name: 'Chapters 2–4', state: 'later', detail: 'A chapter at a time, the same way.' },
  ],
  prs: [
    { n: 155, title: 'Frigates never run over the convoy; munitions on launchers; the Nuke', state: 'merged' },
    { n: 156, title: 'Continue a run you left', state: 'merged' },
    { n: 157, title: 'Map and wave rules page', state: 'merged' },
    { n: 158, title: 'Resume test fix', state: 'merged' },
    { n: 159, title: 'This hub page', state: 'merged' },
    { n: 160, title: 'Bots that play like you (the refit)', state: 'merged' },
    { n: 161, title: 'The new scorecard', state: 'merged' },
    { n: 162, title: 'Automatic checks and a bot report for each map', state: 'merged' },
    { n: 163, title: 'The three reference maps to the rules', state: 'merged' },
  ],
  log: [
    { date: '2026-11-17', what: 'Phase 4 done by the bots. The Strait: its Afterburner Rush now sends 7, 9, then 10 swarms (6 before), and its quiet first third really is quiet. The Gauntlet: wave 8’s jump is gone, the danger is on the way in, and the Rocket Convoy builds up round by round, a little softer. Harbor Mouth: waves 4–7 send their full attack again, a 5-second calm before wave 10, and the Breakout adds sub salvos into the neck. Counter weapons per map: the Strait Flak, Shrapnel, Drone Screen; the Gauntlet Shrapnel, Thermobaric, Flak; Harbor Overdrive, Railgun, Focus.' },
    { date: '2026-11-17', what: 'Checks and bot reports built. What they found on the three reference maps: a cliff on every map (a wave where losses more than double); Harbor Mouth’s waves 4–7 are a third light on attacks (its funnel encounter replaces more than it sends); the Strait and Gauntlet lack a clearly safe stretch; each encounter runs 3–4 waves in a row (the rules want no repeats back to back). Also: each chapter’s first map brings all its new enemies in waves 2–6, mixed in, so no enemy gets a debut wave of its own yet; the Hydra and Rocket Truck first appear on the Strait. These are the to-do list for the reference-map tuning that starts now.' },
    { date: '2026-11-17', what: 'Merged: the bot refit (#160) and the new scorecard (#161). The next map card you finish shows the new scorecard. The iOS check on #160 never got a Mac to run on; #161 carries the same code and passed it.' },
    { date: '2026-11-17', what: 'You approved the new scorecard. It is being built now, alongside the automatic checks; it moved to the Archive.' },
    { date: '2026-11-17', what: 'Your question answered. To calibrate, the bot now replays each of your runs with your exact setup: the same map (cards and campaign), seed, Armory upgrades and draft picks. On that basis it loses 0.69 ships in waves 1–5 (you 0.50), 3.6 in waves 6–10 (you 3.3) and 1.0 a boss round (you 0.5). Map testing keeps a baseline bot with no upgrades.' },
    { date: '2026-11-17', what: 'Bots refit to your play. The measuring tools read your logs and the bots the same way. The fit table and what is still off are in docs/design/v3-bot-refit.md.' },
    { date: '2026-11-17', what: 'The build session started on “Bots that play like you”: your play logs (218 runs) are downloaded for the refit.' },
    { date: '2026-11-17', what: 'Your round 1 marks folded in: the rules now say what you asked (see “The plan”, marked “Changed from your note”).' },
    { date: '2026-11-17', what: 'Pull requests now merge on their own once CI passes.' },
    { date: '2026-11-17', what: 'This page is now the hub: what needs you, where the build stands, the plan, and an archive.' },
  ],
};

// ---- What needs the player now. Only new things; new ids each round.
export const NEEDS = [
  {
    id: 'r3-play-reference',
    kind: 'item',
    title: 'Play the three rebuilt maps: The Strait, The Gauntlet, Harbor Mouth',
    text: 'In the Test Lab, play each map card in full (the cards “The Strait”, “The Gauntlet” and “Harbor Mouth”) and fill in the new scorecard at the end. Your usual Armory is fine. What to look for: does each wave from 3 have a moment that could cost a ship; does any wave suddenly jump in difficulty; do the boss rounds now cost about a ship a round; do the named counter weapons feel like the answer (the Strait: Flak, Shrapnel, Drone Screen; the Gauntlet: Shrapnel, Thermobaric, Flak; Harbor: Overdrive, Railgun, Focus). Mark Approve when you have played all three, or Change with what felt off. The bots read the Strait’s and Harbor’s boss rounds as about twice as hard as you find them, so your scores decide those.',
  },
];

// ---- Answered after round 1 (out of NEEDS; the marks are in
// review-2026-11-17-r2.json). The archive shows each with the player's call.
export const ANSWERED = [
  {
    id: 'r2-scorecard',
    kind: 'item',
    verdict: 'approve',
    note: '',
    at: '2026-11-17',
    title: 'A better scorecard (your note: “treat the score cards as a vibe check… maybe overhaul the score card system”)',
    text: 'Proposed scorecard: (1) before you rate, it shows your last scores for this map and the latest scores of the other maps, so you rate relative to them; (2) the waves of your run in a strip, with the moments the game marked, so you tap the best and weakest wave from what happened, not memory; (3) one comparison: “compared with <the map you rated last>, this one was worse / about the same / better”; (4) fewer sliders: Fun, Difficulty and Play again stay, plus a note; Readability and Pacing go (always 5 and “right”).',
  },
];
