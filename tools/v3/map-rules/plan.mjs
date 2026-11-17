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
  headline: 'The rules are set. The build has started in a new session: first the bots learn to play like you, then the reference maps are tuned with bots and heat maps.',
  phases: [
    { id: 'rules', name: 'Map and wave rules', state: 'done', detail: '31 rules: 26 approved; 6 rewritten from your notes and answers (marked in “The plan”). Round 1 questions all answered.' },
    { id: 'bots', name: 'Bots that play like you', state: 'now', detail: 'Refit the bots from your logs, so their losses (early waves, boss rounds) match yours. Today they predict 12–18 boss-round losses where you lose 0–4.' },
    { id: 'checks', name: 'Automatic checks and bot reports', state: 'next', detail: 'No wave cliffs, close calls from wave 3, wave budgets, counter vs off-counter kits, no later-chapter foes; a heat-map report per map that a session can read and act on.' },
    { id: 'reference', name: 'The three reference maps to the rules', state: 'later', detail: 'The Strait, The Gauntlet, Harbor Mouth: early stakes, wave 1, boss rounds at about a ship a round, counters, internal encounter notes. Tuned in the bot loop, then you play them.' },
    { id: 'ch1', name: 'Chapter 1: Kesh and Marrow', state: 'later', detail: 'Map cards, build, bot loop, then your playtest.' },
    { id: 'ch2', name: 'Chapters 2–4', state: 'later', detail: 'A chapter at a time, the same way.' },
  ],
  prs: [
    { n: 155, title: 'Frigates never run over the convoy; munitions on launchers; the Nuke', state: 'merged' },
    { n: 156, title: 'Continue a run you left', state: 'merged' },
    { n: 157, title: 'Map and wave rules page', state: 'merged' },
    { n: 158, title: 'Resume test fix', state: 'merged' },
  ],
  log: [
    { date: '2026-11-17', what: 'Your round 1 marks folded in: the rules now say what you asked (see “The plan”, marked “Changed from your note”).' },
    { date: '2026-11-17', what: 'Pull requests now merge on their own once CI passes.' },
    { date: '2026-11-17', what: 'This page is now the hub: what needs you, where the build stands, the plan, and an archive.' },
  ],
};

// ---- What needs the player now. Only new things; new ids each round.
export const NEEDS = [
  {
    id: 'r2-scorecard',
    kind: 'item',
    title: 'A better scorecard (your note: “treat the score cards as a vibe check… maybe overhaul the score card system”)',
    text: 'Proposed scorecard: (1) before you rate, it shows your last scores for this map and the latest scores of the other maps, so you rate relative to them; (2) the waves of your run in a strip, with the moments the game marked, so you tap the best and weakest wave from what happened, not memory; (3) one comparison: “compared with <the map you rated last>, this one was worse / about the same / better”; (4) fewer sliders: Fun, Difficulty and Play again stay, plus a note; Readability and Pacing go (always 5 and “right”).',
  },
];
