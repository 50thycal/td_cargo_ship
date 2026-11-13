// The map rebuild round (docs/design/v3-maps-rebuild.md): the data the review
// page (page.mjs) and the plan doc (plan-doc.mjs) are both generated from.
//
// - NOTES: every note that touches the maps, quoted as found, with where.
// - QUESTIONS: the Scope questions (recommended option first).
// - PLAN: one rebuild proposal per map: its identity, its debut, a ten-wave
//   script (new enemies, pairs from src/v3/data/pairs.ts, a feature moment),
//   its event, its target tries, any layout change and why.
// - SYSTEMS: the map-wide changes the notes call for.
// - checkPlan(): the campaign-wide rules the proposals must keep (every
//   enemy debuts once, pairs only from their chapter and after their members,
//   difficulty rising, ...). The page and the doc refuse to build if one
//   breaks.
//
// What the game is today (layouts, the wave table, the raid planner's
// picks, debuts, events, call-out corners) comes from facts.mts, and the
// measured win rates from measured-2026-11-12.json (measure.mts): nothing
// about today is typed here.
//
// Store (the review page's artifact database):
//   reviews/{mapId}       verdict (approve | change | cut), note
//   systems/{systemId}    verdict (approve | change | cut), note
//   answers/{questionId}  choice (option index), note
//   answers/else          note (the "Anything else?" box)

export const ROUND = {
  id: 'maps-rebuild',
  date: '2026-11-12',
  ask: 'Next I think we need to rebuild all the maps.',
  measured: 'measured-2026-11-12.json',
};

// ---------------------------------------------------------------------------
// The notes. `who`: 'player' (the player's own words, as dictated: typos
// kept), 'design' (a line from an earlier design doc), 'brief' (this round's
// brief, where the player's own words weren't found in the repo). `maps`:
// the maps it is about ('all' for every map). `sys`: the Systems item it
// feeds.
export const NOTES = [
  {
    id: 'siege-hatch', who: 'player', maps: ['lantern', 'dreadnought', 'citadel'], sys: 'hatches',
    quote: 'This one is good now too just note for maps. I actually have this the silo or whatever that it comes out it will be permanent and it doesn’t need to replace the other launcher ones.',
    source: 'Test Lab round 2, Siege Battery card, 2026-11-08 (tools/v3/test-lab/playtest-2026-11-08-round2.json)',
  },
  {
    id: 'saltgate-pace', who: 'player', maps: ['saltgate'], sys: 'saltgate',
    quote: 'The Stargate Matt is working a lot better now, but we definitely should add in or force the players to have their ships come in at a certain pace here. I think it’s probably time to start looking at not allowing the players to change the pace cause I really changes the flow of the maps or at least like setting a limit specific war map same with formations maybe we could change that up to',
    source: 'Note paused on Saltgate Canal, wave 8, 2026-11-08 (play log v3-20261108031002-15964; also tools/v3/test-lab/playtest-2026-11-08.json). “Stargate Matt” is the dictation of “Saltgate map”.',
  },
  {
    id: 'canal-event', who: 'player', maps: ['saltgate'],
    quote: 'Really bad the subs shoot torpedoes from water to land so that needs to be fixed and way too difficult way too much going on',
    source: 'Test Lab notes of 2026-11-10, Run the Canal card (docs/design/v3-enemies-round8.md). Round 8 cut the event to three phases and aimed the subs; not retested since.',
  },
  {
    id: 'debut-load', who: 'brief', maps: ['strait', 'island', 'battery', 'coves'],
    quote: 'Chapter maps with fewer debut enemies: the first map of a chapter starts with 6 or more new things.',
    source: 'This round’s brief. The player’s own words weren’t in the repo’s docs, lab files or scratchpad logs. The count holds today (see each chapter’s first map).',
  },
  {
    id: 'sparingly', who: 'player', maps: ['tide', 'citadel'],
    quote: 'Pretty OP combo, make sure to use this one sparingly but it works well. Also, can we not call it repair tender and just like repair ship?',
    source: 'Test Lab round 5, Repair Ship + Bodyguard Ring combo card (docs/design/v3-lab-round5-enemies.md, which adds: “at most once in a map’s run, late, and not on a map that already leans on heavies”).',
  },
  {
    id: 'callout-corner', who: 'design', maps: ['harbor', 'behemoth', 'sowers', 'lantern', 'coves', 'citadel'], sys: 'callouts',
    quote: 'The stack does sit over the bottom-right shore, which on some maps (Harbor Mouth, Behemoth, Sowers, Lantern, Coves, Citadel) has a base: the cards are translucent, short-lived and go at a tap. … Ideas not built: Per-map nudge for the few maps with a base in the bottom-right corner (lift the stack above it, or fade a card while its base fires).',
    source: 'docs/design/v3-callouts.md (the call-outs round). The player’s ask there: “move the notifications to the bottom right hand corner”.',
  },
  {
    id: 'long-road', who: 'design', maps: ['gauntlet'],
    quote: 'Weak: Only works on maps with a long shore road (The Gauntlet has one).',
    source: 'Rocket Convoy’s design card, docs/design/v3-special-events.md. (The player’s own note on Rocket Convoy, 2026-11-10: “Too easy”.)',
  },
  {
    id: 'showcase', who: 'player', maps: 'all',
    quote: 'it should showcase a new enemy attack if it has not been showcased yet. And the special event should not replace the round, so basically there is 11 waves now instead of 10',
    source: 'Special events review, the “Map scripts” piece (docs/design/v3-special-events-build.md).',
  },
  {
    id: 'second-event', who: 'player', maps: 'all',
    quote: 'some [enemies] could have more than one special event, so we’ll need to come up with a few more so each map has its own.',
    source: 'Test Lab notes, events round 7 (docs/design/v3-events-round7.md). Earlier: “you will need to mix it around tho … one or more weapons might need a second special too on a different map” (docs/design/v3-special-events-build.md).',
  },
  {
    id: 'three-runs', who: 'player', maps: 'all',
    quote: 'I do like how the special event is three waves total that you have to beat. Let’s experiment with it at the end: players get their lives reset right before it starts, so if they go out with just one left, it’s [not] gonna be hard for them to beat that.',
    source: 'docs/design/v3-events-round7.md (the three-run ending with the convoy restored first).',
  },
  {
    id: 'three-runs-like', who: 'player', maps: ['lantern'],
    quote: 'Not for all of these special events / I like the three waves actually after doing it more / Then also no nukes for these special events events',
    source: 'Note paused on The Black Strait, wave 13 (the Bombardment’s last run), 2026-11-09 (play log v3-20261109234402-81718; tools/v3/test-lab/playtest-2026-11-10.json).',
  },
  {
    id: 'pairs-for-maps', who: 'player', maps: 'all',
    quote: 'Main issue is the pairs should be enemy pairs, not player and enemy attack pairs. Basically looking for good synergy combos to add to the maps.',
    source: 'Test Lab round 8 (docs/design/v3-enemy-pairs.md).',
  },
  {
    id: 'unique', who: 'player', maps: 'all',
    quote: 'Make a total of 20 maps to play. They should all have their ‘unique’ items on each map, like how Island has the center island.',
    source: 'The first maps ask (docs/design/v3-maps-handoff.md).',
  },
  {
    id: 'spotter-siege', who: 'player', maps: ['dreadnought', 'citadel'],
    quote: 'I didn’t seem to work quite right the recon drone and then the siege cannon never really appeared at the same time so I think we need to work on the timing or test that out because I’m sure not all the pairs will have similar timings like that',
    source: 'Test Lab, Spotter + Siege combo card, 2026-11-09 (tools/v3/test-lab/playtest-2026-11-09.json). Fixed by the pair rules in round 4 and round 8 (src/v3/data/pairs.ts).',
  },
  // ---- Notes on a map's own layout (the maps plan and the visual check) ----
  {
    id: 'kesh-visual', who: 'player', maps: ['kesh'],
    quote: 'We should have the enemy jets follow the curve here and actually make a banking turn around the bend · The frigate do not follow the actual water path and just overlaps on the land and aircraft.',
    source: 'Two notes paused on The Kesh Hook (docs/design/v3-map-visual-check.md). Fixed in that round.',
  },
  {
    id: 'marrow-radar', who: 'player', maps: ['marrow'],
    quote: 'make it like a radar tower on the island and the enemy can attack that too. If it is lost it is lost and it should look like a sweep or something in that lane for the protection of the friend ships.',
    source: 'The maps plan review (docs/design/v3-maps-build.md). Built.',
  },
  {
    id: 'delta-paths', who: 'player', maps: ['delta'],
    quote: 'the paths look a little off and the aircraft carrier shouldn’t just be sitting in a pond.',
    source: 'The maps plan review (docs/design/v3-maps-build.md). Built.',
  },
  // ---- Notes on each map's event (Test Lab, events rounds 5 to 8) ----
  { id: 'ev-rush', who: 'player', maps: ['strait'], quote: 'That was hard! I will try again', source: 'Test Lab, Afterburner Rush card, 2026-11-10 (tools/v3/test-lab/playtest-2026-11-10.json).' },
  { id: 'ev-decoy-storm', who: 'player', maps: ['kesh'], quote: 'This one was a lot of fun. I would definitely make the drones more I guess visible for which ones are the decoys make them like a different color slightly than the other one so it’s easier to point out.', source: 'Test Lab, Decoy Storm card, 2026-11-10. The tint was built in rounds 7 and 8.' },
  { id: 'ev-hydra-bloom', who: 'player', maps: ['marrow'], quote: 'Hydras should split even before the line is crossed there you can remove that line', source: 'Test Lab notes of 2026-11-10, Hydra Bloom card (docs/design/v3-enemies-round8.md). Built in round 8, which also eased the event.' },
  { id: 'ev-rocket-convoy', who: 'player', maps: ['gauntlet'], quote: 'Too easy', source: 'Test Lab, Rocket Convoy card, 2026-11-10 (round 5). Round 6 made it two columns, one down each shore road.' },
  { id: 'ev-gunship-wall', who: 'player', maps: ['island'], quote: 'That was good you really do need a good power up or weapon drop to deal with it tho which is fine just observe to make but why also three rounds not following that I thought it would be one and done', source: 'Test Lab, Gunship Wall card, 2026-11-10.' },
  { id: 'ev-wolf-pack', who: 'player', maps: ['behemoth'], quote: 'Make sure they shoot multiple torpedoes each in different directions and then maybe you can give them one or two fast torpedoes too just total not for each', source: 'Test Lab, Wolf Pack card, 2026-11-10. Built in round 6.' },
  { id: 'ev-shield-wall', who: 'player', maps: ['needle'], quote: 'You can spread them out a bit they all come from the same launcher', source: 'Test Lab, Shield Wall card, 2026-11-10. Built in round 6.' },
  { id: 'ev-supply-raid', who: 'player', maps: ['archipelago'], quote: 'Yeah, this one’s more fun than anything. Just make it so there’s no nukes that get dropped during the special event cause I just kind of run up rivers of it and then add more drones that take them and have them come from all side.', source: 'Test Lab, Supply Raid card, 2026-11-10. Built in rounds 6 and 8.' },
  { id: 'ev-blackout', who: 'player', maps: ['battery'], quote: 'Hard but doable', source: 'Test Lab, Blackout card, 2026-11-10.' },
  { id: 'ev-dive-circus', who: 'player', maps: ['rigs'], quote: 'Fun but could have more than planes', source: 'Test Lab, Dive Circus card, 2026-11-10. Round 6 added guided missiles between the dives.' },
  { id: 'ev-bombardment', who: 'player', maps: ['lantern'], quote: 'Add in some drones to allow some drips that. I think we needed so I can have more of a chance', source: 'Test Lab, Bombardment card, 2026-11-10. Round 6 added supply drones.' },
  { id: 'ev-fire-mission', who: 'player', maps: ['dreadnought'], quote: 'This was a good improvement. I also think this is how the recon planes should behave in general as well. They Scott it out and lock on and then leave and come back with the same health and repeated until you kill it.', source: 'Test Lab notes of 2026-11-10, Fire Mission card (docs/design/v3-enemies-round8.md). Before that (round 5): “Wayyyyto easy let’s rework this completely”.' },
  { id: 'ev-repair-yard', who: 'player', maps: ['coves'], quote: 'Worked good but it had a ship stuck that didn’t travel at all I think it would be better to have the repair ships come from multiple directions on convert on the same spot', source: 'Test Lab, Repair Yard card, 2026-11-10. Built in round 6.' },
  { id: 'ev-escort-run', who: 'player', maps: ['delta'], quote: 'Was hard but I think it is a good balance', source: 'Test Lab, Escort Run card, 2026-11-10.' },
  { id: 'ev-undertow', who: 'player', maps: ['crossing'], quote: 'Not sure what this was even trying to line up and synergy lol', source: 'Test Lab notes of 2026-11-10, Undertow card (docs/design/v3-enemies-round8.md). Cut; Beacon Strike took its place.' },
  { id: 'ev-siren-field', who: 'player', maps: ['crossing'], quote: 'This one’s really good and we should save it and only play on the player has a lot of passive pick up … this one should be able to work on any map put that in its own category', source: 'Test Lab, Siren Field card, 2026-11-10. Now a bonus event after wave 6 on any map; its lab map is Dunmar Crossing.' },
  { id: 'ev-firestorm', who: 'player', maps: ['tide'], quote: 'Really fun idea might be hard to master. I think kind of keep it as it is, but we’ll test it out more. Probably need to be tuned down / I beat it the second time. It was fine. I’ll keep it as it is.', source: 'Test Lab, Firestorm card, 2026-11-10.' },
  { id: 'ev-siege-of-vey', who: 'player', maps: ['citadel'], quote: 'Hard but fun will need to tweak later', source: 'Test Lab notes of 2026-11-10, Siege of Vey card (docs/design/v3-enemies-round8.md).' },
];

/** Where the notes were looked for (the doc lists it). */
export const SEARCHED = [
  'docs/design/*.md (every V3 doc; player quotes and design notes on maps, chapters, debuts, call-outs, events)',
  'tools/v3/test-lab/playtest-*.json (six lab sessions: every verdict note and paused note)',
  'the session’s play logs (156 game logs, 8 paused notes, on the Strait, Saltgate Canal and the Black Strait; the two about maps are above, the rest are about weapons and enemy art)',
  'tools/v3/enemy-ideas/review-2026-11-07.json and the maps plan review (docs/design/v3-maps-build.md)',
];

// ---------------------------------------------------------------------------
// The Scope questions. Ids are new for this round (`mr-`); options with the
// recommended one first.
export const QUESTIONS = [
  {
    id: 'mr-scope',
    q: 'What does “rebuild all the maps” cover?',
    options: [
      'Every map’s waves and pacing, rewritten as a wave script per map; layouts change only where a note asks for it (siege hatches, call-out corners, the Saltgate limits) (recommended)',
      'Waves and pacing only, on all 20 maps; no layout changes at all',
      'Waves and layouts: redraw the maps too, not just their waves',
      'Only the maps that measure off their target; leave the rest as they are',
    ],
    why: 'The layouts were approved in the maps plan and the visual check; what changed since is everything that fills them: 17 new enemies, 13 pairs, the events and the weapons. Today’s waves come from one shared planner that knows none of the pairs.',
  },
  {
    id: 'mr-curve',
    q: 'How hard should each chapter be, in tries a map for a typical player?',
    options: [
      'A sawtooth: each chapter starts a little easier than the last finale and climbs. Chapter 1: 1 → 1.8 tries; Chapter 2: 1.5 → 2.5; Chapter 3: 2 → 3; Chapter 4: 2.5 → 3.8 (the finales hardest) (recommended)',
      'The maps plan’s steps: 1.1 tries on maps 1–2, 1.6 on 3–5, 2.1 on 6–10, 2.7 on 11–15, 3.4 on 16–20',
      'Flatter: 1–2 tries on every map, 3 on the four finales',
      'Steeper: 1 try in chapter 1, up to 5 tries by the Citadel',
    ],
    why: 'Each chapter brings new weapons and new enemies at once, so its first map needs room to learn them. Measured today (below), several maps sit out of order inside their chapter.',
  },
  {
    id: 'mr-debut',
    q: 'How should new enemies come in?',
    options: [
      'One debut a map, shown alone on wave 2 (wave 3 on the Strait); after that only enemies you’ve already met join it. The three finales (Harbor Mouth, Saltgate Canal, Citadel of Vey) debut no enemy; they bring the chapter’s pairs (recommended)',
      'Two debuts on each chapter’s first two maps, none after',
      'As today: every enemy of the chapter on every map of it, each map leading with a different one',
    ],
    why: 'Today the raid planner sends all of the chapter’s new enemies on every map of it, each map leading with a different one (below).',
  },
  {
    id: 'mr-pairs',
    q: 'How many enemy pairs should a map use, and from which wave?',
    options: [
      'None on the Strait; one or two different pairs a map after that, from wave 6; three on a chapter finale, from wave 4; never two pairs at the same time; each Repair Ship pair once or twice in the whole campaign, late (recommended)',
      'One a map, wave 8 or later',
      'More: a pair on most waves from wave 4',
    ],
    why: 'A pair is two enemies that cover each other, launched by its own rule (src/v3/data/pairs.ts). The lab measured how hard each is (below).',
  },
  {
    id: 'mr-ending',
    q: 'Does the three-run ending stay?',
    options: [
      'Yes, on every map, with the convoy restored first; but on a map whose bots get through the ten waves and then lose it (the Lee of Marrow, the Gauntlet), the runs ramp up: the first lighter, the third full (recommended)',
      'Yes, exactly as it is on every map',
      'Three runs on the four finales only; one run elsewhere',
      'Back to one run everywhere',
    ],
    why: 'You like the three runs. Measured (below), most maps lose little between getting through the ten waves and winning; two lose most of their wins in the ending.',
  },
  {
    id: 'mr-waves',
    q: 'How many waves before the ending?',
    options: [
      'Ten on every map, as today (recommended)',
      'Eight on each chapter’s first map, ten elsewhere',
      'Twelve on the four finales',
    ],
    why: 'A map is 10 waves and the three-run ending: about 11 minutes. Fewer waves on a chapter’s first map would shorten the learning; more on a finale would make it a slog before its big ending.',
  },
  {
    id: 'mr-endless',
    q: 'What do Free Play and endless take from the rebuild?',
    options: [
      'Free Play keeps the raid planner and its Enemies line. Endless, after the ending, keeps the map’s identity: the enemies its script used and its pairs, a pair every other wave, growing as now (recommended)',
      'Endless replays the map’s ten-wave script, a step harder each time round',
      'Neither changes: both keep today’s planner',
    ],
    why: 'The scripts end at wave 10. Past it, endless needs something to plan from; Free Play is your sandbox and its Enemies line (campaign, none, all, one) still works.',
  },
];

// ---------------------------------------------------------------------------
// Pair weights, from the lab's measurement (docs/design/v3-enemy-pairs.md,
// `tools/v3/test-lab/pairs.mts -- 20`): ships sunk a Quick test, average bot.
export const PAIR_SUNK = {
  'decoy-sprint': 0.3, 'decoy-cluster': 1.6, 'hydra-swarm': 0.7,
  'scavenger-swarm': 0.1, 'heli-sub': 0.2, 'armored-hydra': 1.8,
  'spotter-siege': 0.7, 'siege-truck': 0.6, 'spotter-dive': 0.3,
  'tender-bodyguard': 3.0, 'tender-truck': 2.7, 'lure-stealth': 0.6, 'guard-spotter': 0.4,
};

/** The pairs heavy enough to keep for late waves (`mr-pairs`). */
export const HEAVY_PAIRS = ['tender-bodyguard', 'tender-truck'];

// ---------------------------------------------------------------------------
// The proposals. A wave: [new enemies, pair (id, or two ids one after the
// other), the feature moment]. Enemy ids are src/v3/data/foes.ts's; a pair
// id is src/v3/data/pairs.ts's. `tries`: the target (mr-curve's
// recommendation). `trend`: what the measured rate says to do to reach it.
const w = (foes = [], pair = null, moment = '') => ({ foes, pair, moment });

export const PLAN = {
  // ---- Chapter 1: Home Waters ----
  strait: {
    identity: 'Learn the threats: one enemy shore, one wide lane, long warnings.',
    debut: 'sprinter', debutWave: 3, tries: 1.0,
    trend: 'Hold. The bots win it; the persona fitted to your play loses it more often, as pessimistic about map 1 as the maps build found it.',
    waves: [
      w([], null, 'Drones and ballistic missiles only: the long warnings teach the raid call-outs.'),
      w(),
      w(['sprinter'], null, 'Debut: one Sprint Drone swarm on its own, with its first-sight card.'),
      w(['sprinter']),
      w(['sprinter']),
      w(['sprinter', 'sprinter'], null, 'Supersonic missiles join (the map’s extra, as today).'),
      w(['sprinter']),
      w(['sprinter', 'sprinter']),
      w(['sprinter', 'sprinter']),
      w(['sprinter', 'sprinter', 'sprinter'], null, 'The first heavy cruise missile (the map’s extra, as today).'),
    ],
    event: { id: 'rush', keep: false, text: 'Keep Afterburner Rush, ramped for map 1: 4 sprint swarms in run 1, 5 in run 2, 6 in run 3 (6 in each today).', notes: ['ev-rush'] },
    layout: [],
    notes: ['debut-load'],
  },
  kesh: {
    identity: 'The hook: ships turn north round the cape, and every threat comes off the outer bank.',
    debut: 'decoy', debutWave: 2, tries: 1.1,
    trend: 'Hold. About on target.',
    waves: [
      w([], null, 'Ships hook north round Cape Marrow; threats only from the outer bank.'),
      w(['decoy'], null, 'Debut: one Decoy swarm on its own, off the bank the ships turn toward.'),
      w(['decoy']),
      w(['sprinter']),
      w(['decoy']),
      w(['decoy', 'sprinter'], null, 'Supersonic missiles join (the map’s extra, as today).'),
      w(['decoy', 'decoy']),
      w(['decoy'], 'decoy-sprint', 'The campaign’s first pair.'),
      w(['decoy', 'sprinter']),
      w(['decoy', 'decoy'], 'decoy-sprint', 'The pair launched as the ships are in the turn.'),
    ],
    event: { id: 'decoy-storm', keep: true, text: 'Keep Decoy Storm.', notes: ['ev-decoy-storm'] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'A launch base sits under the bottom-right corner, where the call-outs stack.' }],
    callouts: 'bl',
    notes: ['kesh-visual'],
  },
  marrow: {
    identity: 'The radar tower: keep it standing and your shots fly faster at whatever it tracks.',
    debut: 'hydra', debutWave: 2, tries: 1.3,
    trend: 'Ease the ending. The bots get through the ten waves on nearly every seed, then lose the map in Hydra Bloom.',
    waves: [
      w([], null, 'The radar tower sweeps the lane: shots fly faster at what it tracks.'),
      w(['hydra'], null, 'Debut: one Hydra, alone, inside the sweep.'),
      w(['hydra']),
      w(['sprinter'], null, 'A ballistic raid at the tower: the first test of “lost is lost” (cued to the radar).'),
      w(['hydra', 'decoy']),
      w(['hydra'], null, 'Supersonic missiles join (the map’s extra, as today).'),
      w(['hydra'], 'hydra-swarm', 'First Hydra + Drone Swarm, inside the sweep.'),
      w(['hydra', 'sprinter']),
      w(['hydra'], 'decoy-sprint', 'Heavy cruise missiles join (the map’s extra, as today).'),
      w(['hydra', 'decoy'], 'hydra-swarm'),
    ],
    event: { id: 'hydra-bloom', keep: false, text: 'Keep Hydra Bloom, ramped: one fan of Hydras in run 1, two in runs 2 and 3 (two in each today).', notes: ['ev-hydra-bloom'] },
    layout: [],
    notes: ['marrow-radar'],
  },
  gauntlet: {
    identity: 'Both shores: the carrier holds the middle, and trucks come down both roads.',
    debut: 'rocketTruck', debutWave: 2, tries: 1.5,
    trend: 'Ease the ending. With a campaign Armory the average bot gets through the ten waves, then Rocket Convoy takes the map.',
    waves: [
      w([], null, 'Enemy on both shores; ships pass either side of the carrier.'),
      w(['rocketTruck'], null, 'Debut: one Rocket Truck down a north-shore road, nothing else in its raid.'),
      w(['rocketTruck']),
      w(['decoy']),
      w(['rocketTruck'], null, 'Heavy cruise missiles join (the map’s extra, as today).'),
      w(['rocketTruck'], 'hydra-swarm'),
      w(['rocketTruck', 'rocketTruck'], null, 'Two trucks at once, one on each shore. Supersonic missiles join (extra).'),
      w(['hydra'], 'decoy-sprint'),
      w(['rocketTruck', 'decoy']),
      w(['rocketTruck', 'rocketTruck'], 'hydra-swarm', 'A truck on each shore and the pair between them.'),
    ],
    event: { id: 'rocket-convoy', keep: false, text: 'Keep Rocket Convoy here (the map with a long road on each shore), ramped: one column in run 1, two in runs 2 and 3. Your “Too easy” was before round 6 doubled it; retest.', notes: ['ev-rocket-convoy', 'long-road'] },
    layout: [{ what: 'Call-outs fade while the base under them is lit.', why: 'A base sits under the bottom-right corner, and every other corner has one too.' }],
    callouts: 'fade',
    notes: [],
  },
  harbor: {
    identity: 'Chapter finale: the funnel, where the worst comes right before delivery, and the chapter’s three pairs.',
    debut: null, debutWave: null, tries: 1.8,
    trend: 'Hold, and check the funnel. With a campaign Armory it is about right; with no Armory the bots stop in the waves, not the ending.',
    waves: [
      w([], null, 'The funnel: the hardest water is right before delivery.'),
      w(['sprinter']),
      w(['decoy']),
      w(['hydra'], 'decoy-sprint', 'Supersonic missiles join (the map’s extra, as today).'),
      w(['rocketTruck'], null, 'Heavy cruise missiles join (extra, as today).'),
      w(['rocketTruck'], 'hydra-swarm', 'Cluster missiles join (extra): the campaign’s first.'),
      w(['sprinter', 'decoy'], null, 'Motherships join (extra, as today).'),
      w(['rocketTruck'], 'decoy-cluster', 'First Decoys + Cluster Missiles: the finale’s new pair.'),
      w(['hydra', 'decoy'], 'hydra-swarm'),
      w(['rocketTruck'], ['decoy-cluster', 'decoy-sprint'], 'Two pairs, one after the other; the second as the convoy reaches the harbour mouth.'),
    ],
    event: { id: 'breakout', keep: true, text: 'Keep The Breakout (the chapter’s four enemies in one go).', notes: [] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'Two launch bases sit under the bottom-right corner.' }],
    callouts: 'bl',
    notes: ['callout-corner'],
  },
  // ---- Chapter 2: The Narrows ----
  island: {
    identity: 'The enemy holds the island: a fast, risky north lane and a safe south one.',
    debut: 'attackHeli', debutWave: 2, tries: 1.5,
    trend: 'Hold. A gentle start to the chapter, as the curve wants.',
    waves: [
      w([], null, 'The enemy holds the island and the far shore.'),
      w(['attackHeli'], null, 'Debut: one Attack Helicopter, alone, hovering by the south lane.'),
      w(['attackHeli']),
      w(['sprinter']),
      w(['attackHeli', 'decoy']),
      w(['attackHeli'], 'decoy-sprint', 'Supersonic missiles join (the map’s extra, as today).'),
      w(['attackHeli', 'rocketTruck'], null, 'Heavy cruise missiles join (extra).'),
      w(['attackHeli', 'hydra'], null, 'Cluster missiles join (extra).'),
      w(['attackHeli'], 'hydra-swarm'),
      w(['attackHeli', 'attackHeli', 'decoy'], null, 'Two helicopters, one over each lane.'),
    ],
    event: { id: 'gunship-wall', keep: true, text: 'Keep Gunship Wall.', notes: ['ev-gunship-wall'] },
    layout: [],
    notes: ['debut-load'],
  },
  behemoth: {
    identity: 'The supertanker: once a wave it crawls through the deep lane, worth three ships.',
    debut: 'torpedoSub', debutWave: 2, tries: 1.7,
    trend: 'Ease a little. It measures harder than the Archipelago two maps later.',
    waves: [
      w([], null, 'One supertanker a wave in the deep lane: six hits, worth three ships.'),
      w(['torpedoSub'], null, 'Debut: one Torpedo Sub, surfacing off the deep lane as the tanker passes (cued to it).'),
      w(['torpedoSub']),
      w(['attackHeli'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['torpedoSub', 'decoy'], null, 'Heavies join (extra); they and guided missiles prefer the tanker.'),
      w(['torpedoSub', 'sprinter']),
      w(['torpedoSub'], 'heli-sub', 'First Attack Helicopter + Torpedo Sub, over the tanker’s lane.'),
      w(['torpedoSub', 'attackHeli'], null, 'Motherships join (extra).'),
      w(['torpedoSub'], 'hydra-swarm'),
      w(['torpedoSub', 'rocketTruck'], 'heli-sub', 'The pair waits for the tanker.'),
    ],
    event: { id: 'wolf-pack', keep: true, text: 'Keep Wolf Pack.', notes: ['ev-wolf-pack'] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'A launch base sits under the bottom-right corner.' }],
    callouts: 'bl',
    notes: ['callout-corner'],
  },
  needle: {
    identity: 'Single file: open water narrows to a gap one hull wide, and the convoy queues at the mouth.',
    debut: 'armored', debutWave: 2, tries: 2.0,
    trend: 'Ease. It measures harder than the Archipelago after it.',
    waves: [
      w([], null, 'Open water funnels to a gap one hull wide.'),
      w(['armored'], null, 'Debut: Armored Drones on their own.'),
      w(['armored'], null, 'Cluster missiles join (the map’s extra, from wave 3 as today).'),
      w(['torpedoSub']),
      w(['armored', 'armored'], null, 'A cluster raid timed to the queue at the mouth.'),
      w(['armored'], 'heli-sub', 'Heavies join (extra).'),
      w(['armored', 'attackHeli']),
      w(['armored'], 'armored-hydra', 'First Armored Drones + Hydra, at the queue. Motherships join (extra).'),
      w(['armored', 'torpedoSub']),
      w(['armored', 'armored'], 'decoy-cluster', 'Clusters at the bunched column.'),
    ],
    event: { id: 'shield-wall', keep: true, text: 'Keep Shield Wall.', notes: ['ev-shield-wall'] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'A launch base sits under the bottom-right corner.' }],
    callouts: 'bl',
    notes: [],
  },
  archipelago: {
    identity: 'Enemy islets with gaps between them; the west end is a long reach from the carrier.',
    debut: 'scavenger', debutWave: 2, tries: 2.2,
    trend: 'Raise a little. It measures easier than the Needle before it.',
    waves: [
      w([], null, 'Islets and gaps: threats come through between them.'),
      w(['scavenger'], null, 'Debut: one Scavenger Drone over the first pickup on the water (cued to it).'),
      w(['scavenger', 'armored']),
      w(['attackHeli']),
      w(['scavenger', 'torpedoSub']),
      w(['scavenger'], 'scavenger-swarm', 'First Scavenger + Drone Swarm. Motherships and heavies join (extras).'),
      w(['armored', 'hydra'], null, 'Cluster missiles join (extra).'),
      w(['scavenger'], 'armored-hydra', 'Supersonic missiles join (extra).'),
      w(['scavenger', 'attackHeli', 'torpedoSub']),
      w(['scavenger', 'armored'], 'heli-sub'),
    ],
    event: { id: 'supply-raid', keep: true, text: 'Keep Supply Raid.', notes: ['ev-supply-raid'] },
    layout: [],
    notes: [],
  },
  saltgate: {
    identity: 'Chapter finale: two locks where ships wait in the chamber under the silos, and the chapter’s pairs one lock at a time.',
    debut: null, debutWave: null, tries: 2.5,
    trend: 'Ease, and hold the pace. With a campaign Armory it measures among the hardest maps in the game for the average bot; the pace and formation limits (Systems) change how it plays.',
    waves: [
      w([], null, 'Two locks: ships wait in each chamber while it fills, under the silos.'),
      w(['torpedoSub'], null, 'A sub up as the first ships sit in Lock A (cued to the lock).'),
      w(['armored']),
      w(['attackHeli'], 'heli-sub', 'Cluster missiles join (the map’s extra, as today).'),
      w(['scavenger', 'armored'], null, 'Heavies join (extra).'),
      w(['torpedoSub'], 'scavenger-swarm'),
      w(['attackHeli', 'armored']),
      w(['scavenger', 'torpedoSub'], null, 'Motherships join (extra).'),
      w(['attackHeli'], 'armored-hydra', 'The pair timed to Lock B’s wait.'),
      w(['torpedoSub', 'scavenger'], ['heli-sub', 'armored-hydra'], 'One pair at each lock, the second after the first is done.'),
    ],
    event: { id: 'run-the-canal', keep: true, text: 'Keep Run the Canal as round 8 cut it (three phases, one after another; subs aimed, never across land), and retest it.', notes: ['canal-event'] },
    layout: [{ what: 'Ship flow held at ×1.4 and formations limited to Column and Pairs (see Systems).', why: 'Your note on Saltgate: the pace “really changes the flow of the maps”; and Box and Spread barely fit the chambers.' }],
    notes: ['saltgate-pace'],
  },
  // ---- Chapter 3: Dark Water ----
  battery: {
    identity: 'Two allied shore guns fire on their own; the enemy wants them silenced first.',
    debut: 'stealthJet', debutWave: 2, tries: 2.0,
    trend: 'Ease. A chapter’s first map, yet for your persona it measures no easier than the Saltgate finale before it.',
    waves: [
      w([], null, 'Your two shore guns fire on their own at anything in reach.'),
      w(['stealthJet'], null, 'Debut: one Stealth Strafer, no warning, along the lane.'),
      w(['stealthJet'], null, 'Heavies join (the map’s extra, from wave 3): they go for the guns.'),
      w(['attackHeli'], null, 'Supersonic and cluster missiles join (extras).'),
      w(['stealthJet', 'scavenger']),
      w(['stealthJet'], 'heli-sub', 'Motherships join (extra).'),
      w(['stealthJet', 'torpedoSub'], null, 'A strafer run as a gun is knocked out (cued to the battery).'),
      w(['stealthJet', 'armored']),
      w(['stealthJet'], 'armored-hydra'),
      w(['stealthJet', 'stealthJet', 'rocketTruck']),
    ],
    event: { id: 'blackout', keep: true, text: 'Keep Blackout.', notes: ['ev-blackout'] },
    layout: [],
    notes: ['debut-load'],
  },
  sowers: {
    identity: 'Mines adrift: every round spent on a mine is one not spent on a missile.',
    debut: 'stealthBomber', debutWave: 2, tries: 2.2,
    trend: 'Hold.',
    waves: [
      w([], null, 'Mines drift across the lane on the current.'),
      w(['stealthBomber'], null, 'Debut: one Stealth Bomber, no warning.'),
      w(['stealthBomber']),
      w(['stealthJet']),
      w(['stealthBomber', 'armored'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['stealthBomber'], 'decoy-cluster', 'Decoys among the mines: rounds spent on both.'),
      w(['stealthBomber', 'stealthJet'], null, 'Motherships join (extra).'),
      w(['stealthBomber'], 'scavenger-swarm', 'Scavengers over the pickups between the mines.'),
      w(['stealthBomber', 'attackHeli']),
      w(['stealthBomber', 'stealthJet'], 'heli-sub'),
    ],
    event: { id: 'carpet-run', keep: true, text: 'Keep Carpet Run.', notes: [] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'A launch base sits under the bottom-right corner.' }],
    callouts: 'bl',
    notes: ['callout-corner'],
  },
  rigs: {
    identity: 'Oil rigs launch from the open sea; each one you bring down stays down.',
    debut: 'diveBomber', debutWave: 2, tries: 2.4,
    trend: 'Hold.',
    waves: [
      w([], null, 'Four rigs launch from the sea: spend weapons on rigs now, or on missiles?'),
      w(['diveBomber'], null, 'Debut: one Dive Bomber: the circle, then the plane.'),
      w(['diveBomber', 'stealthJet']),
      w(['stealthBomber'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['diveBomber'], null, 'Motherships join (extra).'),
      w(['diveBomber'], 'hydra-swarm', 'Supersonic missiles join (extra).'),
      w(['diveBomber', 'stealthBomber']),
      w(['diveBomber'], 'armored-hydra'),
      w(['diveBomber', 'stealthJet', 'torpedoSub']),
      w(['diveBomber', 'diveBomber'], 'heli-sub'),
    ],
    event: { id: 'dive-circus', keep: true, text: 'Keep Dive Circus.', notes: ['ev-dive-circus'] },
    layout: [],
    notes: [],
  },
  lantern: {
    identity: 'Night: threats are a faint glow until the lighthouse beam sweeps over them.',
    debut: 'siege', debutWave: 3, tries: 2.6,
    trend: 'Hold. The bots see in the dark, so it plays harder than it measures.',
    waves: [
      w([], null, 'Night: a lighthouse beam sweeps the lane.'),
      w(['stealthJet'], null, 'Three siege hatches stand on the north shore from the start (permanent: see Systems).'),
      w(['siege'], null, 'Debut: one Siege Battery rises from a hatch, alone.'),
      w(['siege', 'diveBomber'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['siege', 'stealthBomber']),
      w(['siege'], 'hydra-swarm', 'Motherships join (extra).'),
      w(['siege'], 'siege-truck', 'First Siege Battery + Rocket Truck.'),
      w(['siege', 'stealthJet']),
      w(['siege', 'diveBomber'], 'armored-hydra'),
      w(['siege', 'siege'], 'siege-truck', 'Two hatches taking turns, and the truck.'),
    ],
    event: { id: 'bombardment', keep: true, text: 'Keep Bombardment, its three guns rising from the map’s own hatches.', notes: ['ev-bombardment', 'three-runs-like'] },
    layout: [
      { what: 'Three permanent siege hatches on the north shore.', why: 'Your Siege Battery note: the hatch it comes out of should be permanent, and not take a launcher’s place.' },
      { what: 'Call-outs move to the bottom-left corner.', why: 'Two launch bases sit under the bottom-right corner.' },
    ],
    callouts: 'bl',
    hatches: [{ x: 520, y: 52 }, { x: 860, y: 52 }, { x: 1180, y: 48 }],
    notes: ['siege-hatch', 'callout-corner'],
  },
  dreadnought: {
    identity: 'Chapter finale: a battleship steams through on waves 3, 6, 9 and 10, and the Spotter calls the guns.',
    debut: 'spotter', debutWave: 2, tries: 3.0,
    trend: 'Hold. Hard, as a finale should be.',
    waves: [
      w([], null, 'Two shores and one deep channel: the battleship’s.'),
      w(['spotter'], null, 'Debut: one Spotter Plane paints a ship and calls shells from off the map.'),
      w(['spotter'], null, 'The Dreadnought’s first pass (waves 3, 6, 9 and 10, as today).'),
      w(['diveBomber']),
      w(['stealthBomber'], 'siege-truck', 'Cluster missiles join (the map’s extra, as today).'),
      w(['spotter'], null, 'Second pass; the Spotter paints for its broadside (cued to the battleship). Heavies join (extra).'),
      w(['spotter'], 'spotter-dive', 'First Spotter + Dive Bombers. Motherships join (extra).'),
      w(['siege', 'stealthJet']),
      w(['spotter'], 'spotter-siege', 'Third pass, with Spotter + Siege Battery.'),
      w(['spotter', 'stealthBomber'], 'spotter-dive', 'Last pass.'),
    ],
    event: { id: 'fire-mission', keep: true, text: 'Keep Fire Mission.', notes: ['ev-fire-mission'] },
    layout: [{ what: 'Two permanent siege hatches on the north shore.', why: 'The siege guns of its pairs rise from fixed hatches (your Siege Battery note).' }],
    hatches: [{ x: 600, y: 40 }, { x: 1020, y: 40 }],
    notes: ['siege-hatch', 'spotter-siege'],
  },
  // ---- Chapter 4: Open War ----
  coves: {
    identity: 'Fast attack boats burst out of hidden coves to ram the convoy.',
    debut: 'tender', debutWave: 2, tries: 2.5,
    trend: 'Hold, or raise a little: it measures easier than the maps after it, as a chapter’s first map should, but by more than the curve wants.',
    waves: [
      w([], null, 'Fast boats out of the coves; watch for the white wake.'),
      w(['tender'], null, 'Debut: one Repair Ship sails in and mends the boats near it.'),
      w(['tender', 'stealthJet']),
      w(['diveBomber'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['tender', 'attackHeli']),
      w(['tender'], 'spotter-dive', 'Motherships join (extra).'),
      w(['tender', 'diveBomber']),
      w(['tender', 'torpedoSub']),
      w(['tender'], 'tender-truck', 'Repair Ship + Rocket Truck, late and once on this map.'),
      w(['tender', 'stealthBomber', 'spotter']),
    ],
    event: { id: 'repair-yard', keep: true, text: 'Keep Repair Yard.', notes: ['ev-repair-yard'] },
    layout: [{ what: 'Call-outs move to the bottom-left corner.', why: 'A launch base and a cove sit under the bottom-right corner.' }],
    callouts: 'bl',
    notes: ['debut-load', 'callout-corner'],
  },
  delta: {
    identity: 'The river forks three ways round the marshes, and you send the ships.',
    debut: 'bodyguard', debutWave: 2, tries: 2.8,
    trend: 'Hold.',
    waves: [
      w([], null, 'The fork: tap the buoy to send ships north, middle or south.'),
      w(['bodyguard'], null, 'Debut: one Bodyguard Ring round a heavy.'),
      w(['bodyguard', 'tender'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['stealthJet']),
      w(['bodyguard', 'diveBomber'], null, 'Motherships and supersonic missiles join (extras).'),
      w(['bodyguard'], 'spotter-dive'),
      w(['bodyguard'], 'guard-spotter', 'First Bodyguard Ring + Spotter.'),
      w(['bodyguard', 'tender', 'torpedoSub']),
      w(['bodyguard'], 'heli-sub', 'The pair over the short north branch: send the ships south?'),
      w(['bodyguard', 'bodyguard'], 'guard-spotter'),
    ],
    event: { id: 'escort-run', keep: true, text: 'Keep Escort Run.', notes: ['ev-escort-run'] },
    layout: [],
    notes: ['delta-paths'],
  },
  crossing: {
    identity: 'Two-way traffic: eastbound and westbound convoys pass each other.',
    debut: 'lure', debutWave: 2, tries: 3.0,
    trend: 'Hold.',
    waves: [
      w([], null, 'Two lanes, two directions.'),
      w(['lure'], null, 'Debut: one Lure Beacon rises between the lanes.'),
      w(['lure', 'bodyguard'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['tender'], null, 'Supersonic missiles join (extra).'),
      w(['lure', 'diveBomber']),
      w(['lure'], 'lure-stealth', 'First Lure Beacon + Stealth Strafers. Motherships join (extra).'),
      w(['lure', 'bodyguard']),
      w(['lure'], 'spotter-dive'),
      w(['lure', 'tender', 'stealthBomber']),
      w(['lure', 'lure'], 'guard-spotter'),
    ],
    event: { id: 'beacon-strike', keep: true, text: 'Keep Beacon Strike (new in round 8, in Undertow’s place). Siren Field stays the bonus wave after wave 6, on any map.', notes: ['ev-undertow', 'ev-siren-field'] },
    layout: [],
    notes: [],
  },
  tide: {
    identity: 'The tide: the safe flats lane floats only at high water; at low tide every ship runs the deep channel.',
    debut: 'cloud', debutWave: 2, tries: 3.3,
    trend: 'Ease. With a campaign Armory it measures the hardest map of chapter 4 for the average bot, harder than the Citadel after it.',
    waves: [
      w([], null, 'High tide opens the flats lane; low tide closes it.'),
      w(['cloud'], null, 'Debut: one Incendiary Missile at low tide, at the deep channel (cued to the ebb).'),
      w(['cloud', 'lure'], null, 'Cluster missiles join (the map’s extra, as today).'),
      w(['bodyguard'], null, 'Supersonic missiles join (extra).'),
      w(['cloud', 'tender']),
      w(['cloud'], 'lure-stealth', 'Motherships join (extra).'),
      w(['cloud', 'cloud'], null, 'Firebombs at the ebb, as the convoy crowds into the deep channel.'),
      w(['cloud'], 'armored-hydra'),
      w(['cloud'], 'tender-bodyguard', 'The campaign’s one Repair Ship + Bodyguard Ring in a normal wave (“use sparingly”).'),
      w(['cloud', 'cloud', 'lure']),
    ],
    event: { id: 'firestorm', keep: true, text: 'Keep Firestorm.', notes: ['ev-firestorm'] },
    layout: [],
    notes: ['sparingly'],
  },
  citadel: {
    identity: 'The campaign finale: the fortress behind its shield, and the hardest pairs.',
    debut: null, debutWave: null, tries: 3.8,
    trend: 'Raise a little. It measures easier than Tidewater Flats before it, and the finale should be the hardest.',
    waves: [
      w([], null, 'Bring down the three shield generators, then silence the Citadel.'),
      w(['tender'], null, 'A Repair Ship by the Citadel.'),
      w(['bodyguard', 'lure'], null, 'Supersonic and cluster missiles join (the map’s extras, as today).'),
      w(['cloud'], 'guard-spotter', 'Heavies join (extra).'),
      w(['tender', 'lure'], null, 'Motherships join (extra).'),
      w(['cloud', 'bodyguard'], 'lure-stealth'),
      w(['lure', 'tender']),
      w(['cloud'], 'spotter-siege', 'The siege gun rises from the Citadel’s own hatches.'),
      w(['bodyguard', 'cloud', 'lure']),
      w(['tender', 'cloud'], ['tender-truck', 'spotter-dive'], 'The last wave: two pairs, one after the other.'),
    ],
    event: { id: 'siege-of-vey', keep: true, text: 'Keep Siege of Vey.', notes: ['ev-siege-of-vey'] },
    layout: [
      { what: 'Two permanent siege hatches on the north shore.', why: 'The siege gun of its Spotter pair rises from fixed hatches (your Siege Battery note).' },
      { what: 'Call-outs move to the bottom-left corner.', why: 'A shield generator sits under the bottom-right corner.' },
    ],
    callouts: 'bl',
    hatches: [{ x: 560, y: 45 }, { x: 1110, y: 45 }],
    notes: ['sparingly', 'callout-corner', 'siege-hatch'],
  },
};

// ---------------------------------------------------------------------------
// Map-wide changes the notes call for (each Approve / Change / Cut).
export const SYSTEMS = [
  {
    id: 'script',
    name: 'A wave script for every map',
    see: 'Each map plays its own ten waves: which new enemies come on which wave, which pair, and any moment tied to the map (a raid as ships sit in a lock, a sub as the tanker passes). The original threats still come from the wave table, as today.',
    why: 'Today one planner picks the new enemies for every map from the chapter’s list, so every map of a chapter looks alike and none of the 13 pairs ever comes in a campaign wave. Your pairs note asks for “good synergy combos to add to the maps”.',
    how: [
      'Data: `MapDef.script?: WaveScript[]`, one entry a wave: `{ foes?: FoeId[]; pairs?: { id: string; at?: number; cue?: Cue }[]; moment?: Cue }`. The per-map tables on this page become this data one for one.',
      'The planner: in `startWave` (sim/game.ts), `labFoes(...) ?? planFoes(...)` becomes `labFoes(...) ?? scriptFoes(g) ?? planFoes(...)`. A scripted enemy takes its units out of the wave table exactly as a planned one does (a drone swarm, and a missile for a heavy one).',
      'Pairs: lift `updateLabSets` into a shared `launchPairSets(g, pair, sets)`, called by the Test Lab and the campaign. A pair’s set takes a drone swarm out of the table (and a missile for each heavy member), and launches at its `at` (or with its raid) with the same cues and fallbacks as in the lab.',
      'Cues: a short list the moment column uses: `lock` (ships waiting in a lock), `tanker`, `boss` (the Dreadnought on its pass), `ebb` (low tide), `post` (the radar or a battery), `pickup`. A cue moves a raid or a pair to that moment, within the wave.',
      'Past the script (endless, Free Play): the planner, as today (Scope question 7).',
      'A test reads every script and fails if an enemy debuts twice, a pair comes before its members, or a Repair Ship pair comes more often than the plan says.',
    ],
    notes: ['pairs-for-maps', 'showcase'],
  },
  {
    id: 'debut',
    name: 'A debut wave that shows one new enemy',
    see: 'On a map’s debut wave its new enemy comes first and alone: its raid has nothing else in it, its first-sight card shows, and the next raid waits until it is dealt with or 8 s have passed. From then on it mixes with the rest.',
    why: 'Each map should “showcase a new enemy attack if it has not been showcased yet”; and the first map of a chapter brings six or more new things today (all of the chapter’s new enemies and its new weapons).',
    how: [
      '`WaveScript.debut?: FoeId`: the planner holds the wave’s other raids back until the debut enemy is down or 8 s have passed.',
      'Only enemies already met in the campaign (an earlier map, or this map’s debut) may appear in a script; the test above checks it.',
    ],
    notes: ['debut-load', 'showcase'],
  },
  {
    id: 'hatches',
    name: 'Permanent siege hatches',
    see: 'On a map that brings the Siege Battery (the Black Strait, Dreadnought Pass and the Citadel), two or three hatches are drawn on the enemy shore from the start, closed. A siege gun always rises from one of them. They are extra: no launch base gives up its place, or any of its missiles, for one.',
    why: 'Your Siege Battery note: “the silo or whatever that it comes out it will be permanent and it doesn’t need to replace the other launcher ones.” Today a hatch appears beside a random base when the gun is due, and goes when it is done.',
    how: [
      '`MapDef.hatches?: Point[]` (the diagrams on this page show where). `siegeSpot` picks a free hatch; with none on the map it falls back to today’s spot beside a base.',
      'The hatches are drawn with the map (closed, a dim light), not only while a gun is due.',
      'The Siege Battery comes on top of the wave instead of in place of one of its missiles (it leaves `HEAVY_FOES`’ trade, so no silo goes quiet for it). The Bombardment’s three guns use the same hatches.',
    ],
    notes: ['siege-hatch'],
  },
  {
    id: 'saltgate',
    name: 'Saltgate Canal: pace and formation held',
    see: 'On Saltgate Canal the ship-flow slider is held at ×1.4 (the default) and only Column and Pairs can be picked; the slider and the formation button show a small lock. Any map can use the same limits later (the Needle is the next candidate).',
    why: 'Your note on Saltgate: “force the players to have their ships come in at a certain pace here … or at least like setting a limit specific [per] map same with formations”. The flow slider sets how many ships queue at each lock; which formations to allow in the narrow chambers is a design call, and the proposal keeps the two that run in file.',
    how: [
      '`MapDef.limits?: { flow?: [min, max]; formations?: FormationId[] }`; Saltgate: `{ flow: [1, 1], formations: [\'column\', \'pairs\'] }`.',
      'The flow slider and the formation button read it (the slider’s other steps dimmed, the formations not allowed hidden); the bots and the play log follow the same limits.',
    ],
    notes: ['saltgate-pace'],
  },
  {
    id: 'callouts',
    name: 'Call-outs placed per map',
    see: 'The call-out stack stays bottom-right on most maps. On the eight where a launch base, a cove or a generator sits under that corner, it moves to the bottom-left; on the Gauntlet, where every corner has a base, a card goes faint while the base under it is lit.',
    why: 'The call-outs round left it as an idea: the stack covers a base on several maps (“Harbor Mouth, Behemoth, Sowers, Lantern, Coves, Citadel”). Checked against the map data with a box the stack’s size in each corner, the Kesh Hook, the Gauntlet and the Needle have one under it too.',
    how: [
      '`MapDef.callouts?: \'bl\' | \'fade\'` (bottom-right when absent), read by `place()` in ui/alerts.ts. Each map’s card on this page names its corner, and the diagram draws it.',
      'Bottom-left moves the stack’s anchor to the left rail’s edge; fade drops a card to 25% while a base under it has its raid light on.',
    ],
    notes: ['callout-corner'],
  },
];

// ---------------------------------------------------------------------------
// The campaign-wide rules (checkPlan). `facts` is facts.mts's JSON.
export function checkPlan(facts, pairsById) {
  const errs = [];
  const order = facts.maps.map((m) => m.id);
  const seen = new Map(); // foe -> [mapIndex, wave]
  const debuts = new Map();
  let lastTries = 0;
  const repair = {};
  for (const [i, id] of order.entries()) {
    const p = PLAN[id];
    if (!p) { errs.push(`${id}: no proposal`); continue; }
    if (p.waves.length !== facts.wavesToClear) errs.push(`${id}: ${p.waves.length} waves, not ${facts.wavesToClear}`);
    const ch = facts.maps[i].chapter;
    if (p.debut) {
      if (debuts.has(p.debut)) errs.push(`${id}: ${p.debut} already debuted on ${debuts.get(p.debut)}`);
      debuts.set(p.debut, id);
      if (facts.foes[p.debut].chapter !== ch) errs.push(`${id}: debut ${p.debut} is a chapter ${facts.foes[p.debut].chapter} enemy`);
    }
    const known = (f, wave) => seen.has(f) || (f === p.debut && wave >= p.debutWave);
    p.waves.forEach((wv, k) => {
      const wave = k + 1;
      for (const f of wv.foes) {
        if (!facts.foes[f]) errs.push(`${id} w${wave}: unknown enemy ${f}`);
        else if (!known(f, wave)) errs.push(`${id} w${wave}: ${f} before its debut`);
      }
      if (p.debut && wave === p.debutWave && !(wv.foes.length === 1 && wv.foes[0] === p.debut)) errs.push(`${id}: the debut wave should bring ${p.debut} alone`);
      for (const pid of [wv.pair].flat().filter(Boolean)) {
        const pr = pairsById[pid];
        if (!pr) { errs.push(`${id} w${wave}: unknown pair ${pid}`); continue; }
        if (pr.chapter > ch) errs.push(`${id} w${wave}: pair ${pid} is chapter ${pr.chapter}`);
        for (const f of pr.foes) if (!known(f, wave)) errs.push(`${id} w${wave}: pair ${pid} before ${f} is met`);
        const finale = i % 5 === 4;
        if (wave < (finale ? 4 : 6)) errs.push(`${id} w${wave}: pair ${pid} too early`);
        if (HEAVY_PAIRS.includes(pid)) {
          repair[pid] = (repair[pid] ?? 0) + 1;
          if (wave < 9) errs.push(`${id} w${wave}: ${pid} before wave 9`);
        }
      }
    });
    if (p.debut) seen.set(p.debut, [i, p.debutWave]);
    for (const wv of p.waves) for (const f of wv.foes) if (!seen.has(f)) seen.set(f, [i, 0]);
    // Difficulty: rises inside a chapter, and each finale tops the last.
    const first = i % 5 === 0;
    if (!first && p.tries <= lastTries) errs.push(`${id}: target ${p.tries} tries doesn't rise from ${lastTries}`);
    lastTries = p.tries;
    if (!PLAN[id].event || PLAN[id].event.id !== facts.maps[i].event) errs.push(`${id}: event ${PLAN[id].event?.id} isn't the map's (${facts.maps[i].event})`);
    for (const n of [...p.notes, ...p.event.notes]) if (!NOTES.some((x) => x.id === n)) errs.push(`${id}: unknown note ${n}`);
  }
  for (const f of Object.keys(facts.foes)) if (!debuts.has(f)) errs.push(`${f} never debuts`);
  if ((repair['tender-bodyguard'] ?? 0) > 1) errs.push('Repair Ship + Bodyguard Ring more than once');
  if ((repair['tender-truck'] ?? 0) > 2) errs.push('Repair Ship + Rocket Truck more than twice');
  const finales = [4, 9, 14, 19].map((k) => PLAN[order[k]].tries);
  if (finales.some((t, k) => k && t <= finales[k - 1])) errs.push('finales do not rise');
  if (errs.length) throw new Error(`The plan breaks its own rules:\n- ${errs.join('\n- ')}`);
  return true;
}

// ---------------------------------------------------------------------------
// The evidence under each Scope question, worked out from the facts
// (facts.mts) and the results file, so no number on the page is typed.
/** A map's headline measure: the average bot with a campaign Armory. */
export const headline = (measured, id) => measured.maps[id].campaign.average;

export function evidence(qid, facts, measured) {
  const name = (id) => facts.maps.find((m) => m.id === id).name;
  const byCh = (n) => facts.maps.filter((m) => m.chapter === n);
  switch (qid) {
    case 'mr-scope': {
      const ch = facts.chapters;
      return [
        `Since the maps were built: ${Object.keys(facts.foes).length} new enemies (${ch.map((c) => c.foes.length).join(', ')} by chapter), ${facts.pairs.length} enemy pairs, an event on every map (the ending is ${facts.ending.runs} runs), ${facts.bonus.length} bonus event, and ${ch.reduce((n, c) => n + c.weapons.length, 0)} weapons added by chapters 2 to 4.`,
        `Every map has a shore road crossing the screen (${Math.min(...facts.maps.map((m) => m.roads.longest))} to ${Math.max(...facts.maps.map((m) => m.roads.longest))} px of it on screen); ${facts.maps.filter((m) => m.roads.runners > 1).length} maps have two.`,
      ];
    }
    case 'mr-curve': {
      const out = [];
      for (const c of facts.chapters) {
        const ms = byCh(c.n);
        out.push(`Chapter ${c.n}, average bot with a campaign Armory, maps won: ${ms.map((m) => `${headline(measured, m.id).won}%`).join(' → ')}. Your persona: ${ms.map((m) => `${measured.maps[m.id].campaign.you.won}%`).join(' → ')}.`);
      }
      out.push(`Proposed targets, tries a map: ${facts.chapters.map((c) => byCh(c.n).map((m) => PLAN[m.id].tries).join(' · ')).join(' | ')}.`);
      return out;
    }
    case 'mr-debut':
      return facts.chapters.map((c) => {
        const first = byCh(c.n)[0];
        const mine = first.newToday.filter((f) => facts.foes[f].chapter === c.n);
        return `${first.name}, chapter ${c.n}’s first map, today: ${mine.length} new enemies (${mine.map((f) => facts.foes[f].name).join(', ')})${c.weapons.length ? ` and ${c.weapons.length} new weapons in the draft (${c.weapons.map((w) => w.name).join(', ')})` : ''}, plus its map idea.`;
      });
    case 'mr-pairs':
      return facts.pairs.map((p) => `${p.name} (chapter ${p.chapter}): ${PAIR_SUNK[p.id]} ships sunk a lab test.`);
    case 'mr-ending': {
      const rows = facts.maps.map((m) => ({ m, h: headline(measured, m.id) })).map(({ m, h }) => ({ m, h, drop: h.through10 - h.won }));
      const worst = rows.filter((r) => r.drop >= 25).sort((a, b) => b.drop - a.drop);
      return [
        `Average bot with a campaign Armory, through the ten waves → won the map: ${rows.map(({ m, h }) => `${m.name} ${h.through10}→${h.won}%`).join(', ')}.`,
        worst.length ? `Biggest drops in the ending: ${worst.map(({ m, drop }) => `${m.name} (−${drop} points, ${facts.events[m.event].name})`).join('; ')}.` : 'No map drops 25 points or more in the ending.',
      ];
    }
    case 'mr-waves':
      return [`A map today: ${facts.wavesToClear} waves, then the ${facts.ending.runs}-run ending.`];
    case 'mr-endless':
      return [];
    default:
      return [];
  }
}
