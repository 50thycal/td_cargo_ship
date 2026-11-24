// The map and wave rules round (2026-11-17): the rules every map and every
// wave plan must meet before the other 17 maps are rebuilt. The player asked:
// "let's go over all the rules first and decide what all go into the map
// design beyond just the geometry of the map itself and also set rules for
// the wave design and how those wave designs use the map geometry".
//
// One data module; the review page (page.mjs) and the design doc
// (docs/design/v3-map-wave-rules.md) are both generated from it. Numbers come
// from evidence.json (the player's map scorecards, rounds 11 and 12).
//
// Ids are stable: the page stores marks under reviews/{id} and answers/{id}.

export const ROUND = { n: 1, date: '2026-11-17', title: 'Map and wave rules' };

export const SECTIONS = [
  {
    id: 'map',
    name: 'What a map is',
    blurb: 'Everything a map must define beyond its shape: its problem, its sources, its mechanic, its enemy, its boss and how hard it is.',
  },
  {
    id: 'wave',
    name: 'How waves are built',
    blurb: 'The ten-wave arc, how early it bites, what each wave holds and how the boss rounds end it.',
  },
  {
    id: 'geo',
    name: 'Waves use the map',
    blurb: 'How each wave uses the map’s shape: where the fire comes from, when it lands, and what it is aimed at.',
  },
  {
    id: 'gate',
    name: 'How a map passes',
    blurb: 'The checks a rebuilt map must pass before it ships: the map card, the bot checks and your scorecard.',
  },
];

// Each rule: what it says, why (the evidence), how it is checked, and where
// the three reference maps stand today. `ev` keys point into evidence.json.
export const RULES = [
  // ---------------------------------------------------------------- the map
  {
    id: 'm-dilemma',
    sec: 'map',
    title: 'One problem, in one sentence',
    rule: 'Every map poses one tactical problem that comes from its shape or its mechanic, and the map card states it in one sentence (“ships are most exposed in the neck, just before delivery”). Open water with nothing to decide is not a map.',
    why: 'Your fun scores split by map, not by kit. The same kit (Overdrive, Scattergun, Supply Run) scored 5 on Harbor Mouth and 3 on the Strait. The two maps with a shape problem (two shores, a funnel) scored 5; the open Strait scored 3 on all three of its cards.',
    check: 'The map card has the sentence. You can say it back after one run.',
    now: 'Gauntlet: two shores, carrier in the middle. Harbor Mouth: the neck. The Strait: none (open water, one shore).',
  },
  {
    id: 'm-sources',
    sec: 'map',
    title: 'Every launch site has a job',
    rule: 'Each silo, road, sub spot and air line is placed for a reason and the card says what it is: the far silo gives long warning, the near one is fast, the pop-up road hits the neck. At least two attack angles, or a near/far timing contrast, on every map. No site idle the whole map; no site doing everything.',
    why: 'Difficulty that comes from where and when threats arrive reads as fair; difficulty from raw count reads as noise. The lab plan’s rule 5.',
    check: 'Map card lists each site with its warning time and its job. The map-lab heatmap shows every site firing in at least 3 waves.',
    now: 'Not written down for any map yet.',
  },
  {
    id: 'm-stretches',
    sec: 'map',
    title: 'A danger stretch and a safe stretch',
    rule: 'Every lane has a stretch where ships are most exposed and one where they are fairly safe, and the player can see which from the map itself (narrowing water, a headland, a gun’s reach).',
    why: 'This is what Harbor Mouth’s neck gives you, and it is why that map plays as a decision instead of a shooting gallery.',
    check: 'The map-lab damage heatmap shows a hot stretch and a cold one. Losses in the safe stretch stay under a quarter of the total.',
    now: 'Harbor: yes (the neck). Gauntlet: partly (the middle). Strait: no.',
  },
  {
    id: 'm-mechanic',
    sec: 'map',
    title: 'At most one map mechanic, used all map long',
    rule: 'A map has at most one mechanic of its own (a radar, a gate, a switch, mines, rigs, the tide). It shows up by wave 2–3, matters in at least three waves, and the boss rounds use it.',
    why: 'Saltgate showed a mechanic can break a map if nothing tests it at every setting; one mechanic per map keeps each one testable.',
    check: 'The 10-wave plan names the waves that use the mechanic. The flow and overlap tests cover it.',
    now: 'Chapter 1 mostly has none by design: Kesh’s hook is a shape, Marrow has its radar. Mechanics start in chapter 2.',
  },
  {
    id: 'm-enemy',
    sec: 'map',
    title: 'The map brings one new enemy, met alone first',
    rule: 'Each map debuts at most one enemy or munition. It first appears alone (or with drones only) in waves 2–4, then mixes in. Never a foe from a later chapter.',
    why: 'Your tip notes asked for new types to be introduced once and clearly; the roster rule already forbids early debuts of later foes.',
    check: 'The encounter test fails a plan that uses a later-chapter foe (it exists for round 12’s guests). The plan shows the debut wave.',
    now: 'Strait: none of its own. Gauntlet: Rocket Convoy trucks in the boss. Harbor: none in waves 1–10.',
  },
  {
    id: 'm-debut-tag',
    sec: 'map',
    title: 'New weapons and enemies say which chapter brought them',
    rule: 'A weapon card the chapter adds to the draft carries the chapter’s tag (“NEW · Dark Water”), and a chapter’s new enemies are announced the same way. Every rebuilt map keeps it.',
    why: 'Your note on Battery (campaign, 2026-11-19): you like the “Dark Water” note on the weapons that appear in that chapter and want it kept when the maps are rebuilt.',
    check: 'The draft e2e sees the tag on a chapter’s new weapon; the rebuild checks don’t remove it.',
    now: 'Built for weapons in the campaign (draft cards say NEW · <chapter>).',
  },
  {
    id: 'm-carrier',
    sec: 'map',
    title: 'Carrier and frigates placed for the problem',
    rule: 'The carrier sits so every stretch is in gun reach, but the danger stretch is not the closest. Frigate stations keep clear water beside the convoy (round 13) and cover the danger stretch.',
    why: 'Frigates were sitting inside the convoy on 19 maps; round 13 fixed the stations, and the Delta lost frigate value because its river has no room.',
    check: 'The frigate overlap test (all maps). Frigate kills per threat within a few points of the average.',
    now: 'Fixed in PR #155. The Delta was rebuilt as one long river in log v69 (about 2.9 times the usual lane): in its first build 24 of the 36 ships sunk were 500–900 px from the carrier (an interceptor flies 520 px/s, so a drone off a silo 130 px from a far ship cannot be stopped), so reach is the rule on a long map: its drone silos are the two islets either side of the carrier’s bay, the far silos fire shells and missiles only, and its frigate stations come from the river’s first 2,600 px. Its frigate value is not measured on the new river.',
  },
  {
    id: 'm-convoy',
    sec: 'map',
    title: 'The convoy sails itself; commands only where the map needs one',
    rule: 'Ships sail on their own. Formations and flow stay as they are. A map gets a command (like Hold on Sowers’ Reach) only if its mechanic needs one. No generic commands.',
    why: 'You said the commands were “kinda useless… more of a button mash”; Rush and Disperse were cut in round 11.',
    check: 'The map card says which command, if any, and why.',
    now: 'Only Sowers’ Reach has Hold.',
  },
  {
    id: 'm-shape-convoy',
    sec: 'map',
    title: 'Ship spacing follows the water',
    rule: 'Ships spread out where the water is wide and close up where it narrows, so the convoy itself shows the map’s shape.',
    why: 'Your Harbor Mouth note: “the ships should start wider apart… and get closer together at the harbor neck”. Built for Harbor in round 11.',
    check: 'A screenshot of each map at waves 1 and 8 shows the spacing.',
    now: 'Harbor only.',
  },
  {
    id: 'm-difficulty',
    sec: 'map',
    title: 'Difficulty set by chapter',
    rule: 'Chapter 1 maps are won on the first or second try by a player who plays well, losing 2–6 ships. Chapter 2: about 2 tries; chapter 3: 2–3; chapter 4: 3–4.',
    why: 'This is the approved maps plan. Your reference-map runs land in that band: won runs lost 2–9 ships.',
    check: 'Your scorecard says “difficulty right”. Bots: “you” bot win rate in the chapter’s band.',
    now: 'All three reference maps scored “right” in round 12 (Strait v2 “bit easy”).',
  },
  {
    id: 'm-kits',
    sec: 'map',
    title: 'No kit makes a map trivial',
    rule: 'A map must hold up against three kits: aimed (Railgun, Overdrive), self-firing (Drone Screen, Seeker, Airstrike) and area (Flak, Thermobaric, Scattergun). None of them should win it without losing a ship.',
    why: 'Overdrive + Scattergun + Supply Run won both runs it was used in with no boss losses; you called it “really op”.',
    check: 'Bots run all three kit tastes (the round 12 --kits option). The combo itself is a weapons question (see questions).',
    now: 'Not checked per map yet.',
  },
  {
    id: 'm-reads',
    sec: 'map',
    title: 'Everything readable on a phone',
    rule: 'Every launch site, gate, structure and road is visible at 844×390 and not under the HUD or the side rails. Anything that can sink a ship is warned at least 2.5 s before it fires.',
    why: 'Readability scored 5 on all 8 scorecards: keep it that way. The Test Lab banner was covering launchers until round 13.',
    check: 'A phone screenshot of each map with every site marked. The raid warning is 2.5 s today.',
    now: 'Holds on the reference maps.',
  },

  // --------------------------------------------------------------- the waves
  {
    id: 'w-arc',
    sec: 'wave',
    title: 'The ten-wave arc',
    rule: 'Waves 1–2 teach the map. Waves 3–4 first stakes. Waves 5–6 combine two things. Waves 7–9 escalate. Wave 10 is the climax. Then three boss rounds.',
    why: 'The lab plan’s template. Your pacing score was “right” on all 8 scorecards, so the length and rhythm stay.',
    check: 'The 10-wave plan labels each wave with its role.',
    now: 'The arc exists, but the first half is too safe (next rule).',
  },
  {
    id: 'w-early',
    sec: 'wave',
    title: 'A ship is at risk by wave 3',
    rule: 'From wave 3, every wave has at least one moment that sinks a ship if the player ignores it. A good player still loses about 0–1 ships in waves 1–5; the point is that it could happen.',
    why: 'Across your 8 map scorecards you lost 3 ships in waves 1–5, 29 in waves 6–10 and 10 in boss rounds. 6 of 8 runs lost nothing before wave 6.',
    check: 'New bot metric: “close calls” per wave (a threat within 2 s of a hull before it is shot down). At least one from wave 3. Your scorecard’s weakest wave is not 1–3.',
    now: 'All three maps: no stakes before wave 5–6.',
    ev: 'lost',
  },
  {
    id: 'w-first',
    sec: 'wave',
    title: 'Wave 1 shows the map',
    rule: 'Wave 1’s first launch comes from the map’s signature place (its near silo, its second shore, its neck) and shows its problem in miniature. Still easy: no ship lost by a player who shoots.',
    why: 'Wave 1 was your weakest wave on 6 of 8 scorecards. After round 12’s openers it moved off wave 1 on Harbor (to 10) and the Gauntlet (to 2), but not on the Strait.',
    check: 'Your weakest wave is not wave 1. Bots: 0 ships lost on wave 1.',
    now: 'Openers on all three since round 12; works on 2 of 3.',
    ev: 'weakest',
  },
  {
    id: 'w-encounter',
    sec: 'wave',
    title: 'Each wave has one named encounter',
    rule: 'Every wave has one encounter the player remembers: a decision, not just more enemies. The rest of the wave is background pressure. From wave 7, up to two encounters may overlap.',
    why: 'This is the round 12 v1 design that you kept. Set pieces (v2: four big moments, quiet waves between) felt “bit easy” and you cut it.',
    check: 'The 10-wave plan names an encounter per wave and the decision it asks for. The pause screen shows the script.',
    now: 'v1 encounters exist on the three reference maps.',
  },
  {
    id: 'w-variety',
    sec: 'wave',
    title: 'No repeats back to back',
    rule: 'No two waves in a row use the same encounter. Each enemy type the map features shows up in at least two waves.',
    why: 'Variety scored 3–4 across the scorecards; it is the lowest score after fun.',
    check: 'Plan check (automatic). Your variety score ≥ 4.',
    now: 'Variety 4 on all three v1 cards in round 12.',
  },
  {
    id: 'w-cliff',
    sec: 'wave',
    title: 'No cliffs: a wave may hurt but not end the run',
    rule: 'No wave more than doubles the previous wave’s losses, and no single wave ends the run for every kit.',
    why: 'Harbor Mouth’s wave 8 ended a run in round 11; the Gauntlet’s wave 8 jump is in its shared waves.',
    check: 'Bots: the largest one-wave step in losses per kit (round 12’s cliff measure).',
    now: 'Harbor fixed in round 12; the Gauntlet’s wave 8 still jumps for bots.',
  },
  {
    id: 'w-calm',
    sec: 'wave',
    title: 'A breath before the climax',
    rule: 'A short calm (5–8 s) before wave 10’s climax and before the first boss round, so the big moment reads as big.',
    why: 'Contrast makes the peaks feel like peaks; the lab plan asks for deliberate calm.',
    check: 'Plan check: the gap before wave 10’s main raid and before boss round 1.',
    now: 'Boss rounds already start after the convoy is restored.',
  },
  {
    id: 'w-budget',
    sec: 'wave',
    title: 'The shared wave table stays the backbone',
    rule: 'Every map uses the same ten-wave table. A map shifts it by at most ±15% (its threat scale and encounters). Encounters replace part of the wave’s budget; they never add on top.',
    why: 'Round 12 showed added launches got swallowed (a sub fills its salvo whatever it is given), and budgets kept the versions fair.',
    check: 'Bots: each wave’s launches within ±15% of the table × the map’s scale.',
    now: 'True for all maps today.',
  },
  {
    id: 'w-boss',
    sec: 'wave',
    title: 'Boss rounds cost about a ship a round',
    rule: 'The three boss rounds use the map’s own enemy and shape, get harder each round, last 15–30 s each, and cost a good player about one ship a round.',
    why: 'The Gauntlet’s Rocket Convoy cost you 6 and then 4 ships: scored 5 both times. The Strait’s Rush and Harbor’s Breakout cost 0 in all six rounds you played, even after round 12 made them harder (they scored 3–4).',
    check: 'Your scorecard: boss score ≥ 4 and at least one ship lost across the three rounds. Bots alone are not enough (next rule).',
    now: 'Gauntlet yes. Strait and Harbor no.',
    ev: 'boss',
  },
  {
    id: 'w-bots',
    sec: 'wave',
    title: 'Bots set the floor; your scorecard sets the target',
    rule: 'Bots check the things they measure well (no stalls, no cliffs, no overlaps, budgets, kits). Difficulty targets for boss rounds and early stakes are set by your scorecards until the bots are refit to your play.',
    why: 'Round 12’s “you” bot was predicted to lose 12–18 ships across the boss rounds on these maps; you lost 0 on the Strait and Harbor and 4 on the Gauntlet.',
    check: 'Refit the bots from your newest logs (task 56) before trusting them on difficulty.',
    now: 'Bots over-predict boss losses badly.',
    ev: 'bots',
  },

  // -------------------------------------------------- waves using the map
  {
    id: 'g-named',
    sec: 'geo',
    title: 'Every encounter names where and at what',
    rule: 'Each encounter says which sites fire and which stretch they aim at (“the near silo, at the ships in the neck”). An encounter that could happen on any map is not finished.',
    why: 'The v1 encounters you kept are the ones tied to the map; the generic ones blend together.',
    check: 'The encounter data names sites and a target stretch; the test fails one without them.',
    now: 'Round 12 encounters name sites; target stretches are not formal yet.',
  },
  {
    id: 'g-timing',
    sec: 'geo',
    title: 'Time the big raid to the danger stretch',
    rule: 'Each wave’s biggest raid lands while ships are crossing the map’s danger stretch.',
    why: 'Harbor Mouth’s funnel works because its worst comes last; the lab plan’s “exposure timing”.',
    check: 'Map-lab: the share of a wave’s damage that lands in the danger stretch.',
    now: 'Harbor partly; others not timed to the convoy.',
  },
  {
    id: 'g-split',
    sec: 'geo',
    title: 'Make the player choose a direction',
    rule: 'From wave 5, at least one encounter per wave pulls the player two ways: two shores, front and rear of the convoy, the carrier and a ship.',
    why: 'The Gauntlet’s two shores make you choose; it went from fun 3 to 5 once its boss had teeth.',
    check: 'Map-lab: threats from two sides alive at once in each wave from 5.',
    now: 'Gauntlet yes; Strait and Harbor rarely.',
  },
  {
    id: 'g-warning',
    sec: 'geo',
    title: 'Warning time is the difficulty knob',
    rule: 'Early waves fire from far sites (long warning). Later waves use near sites, pop-up roads and subs (short warning). Waves get harder through where fire comes from before they get harder through count.',
    why: 'The lab plan’s rule: difficulty from launch geometry and timing, not just numbers.',
    check: 'Map-lab: the average warning time per wave falls from wave 1 to wave 10.',
    now: 'Not measured yet.',
  },
  {
    id: 'g-mechanic',
    sec: 'geo',
    title: 'The mechanic is in the waves',
    rule: 'The map’s mechanic (radar, gate, switch, mines, rigs) is the target or the stake in at least three waves and in the boss rounds, not just scenery.',
    why: 'Same as the one-mechanic rule: a mechanic only matters if the waves make you care about it.',
    check: 'The plan marks those waves.',
    now: 'Applies from chapter 2 (and Marrow).',
  },
  {
    id: 'g-safe',
    sec: 'geo',
    title: 'Keep the safe stretch mostly safe',
    rule: 'Most fire goes at the danger stretch. Only the climax and the boss rounds may hit the safe stretch hard, so the map stays readable.',
    why: 'If every stretch is hit equally, the danger stretch stops meaning anything.',
    check: 'Map-lab: losses in the safe stretch under a quarter, outside wave 10 and the boss.',
    now: 'Not measured yet.',
  },

  // ------------------------------------------------------------ the gate
  {
    id: 'q-card',
    sec: 'gate',
    title: 'A one-page map card before building',
    rule: 'Every map gets a card before it is rebuilt: the problem in one sentence, the mechanic, each site and its job, the danger and safe stretches, the debut enemy, the ten waves (role, encounter, sites, target stretch), the boss plan, and the risks on a phone.',
    why: 'The lab plan’s rollout step; it is what lets you review 17 maps without playing each one first.',
    check: 'You see the cards on a review page before the build.',
    now: 'None written yet.',
  },
  {
    id: 'q-bots',
    sec: 'gate',
    title: 'Automatic checks every map must pass',
    rule: 'Convoy never stalls at any flow (built). Frigates never overlap ships (built). No wave cliffs. Close calls from wave 3. Wave budgets within ±15%. All three kits survive. No later-chapter foes.',
    why: 'Saltgate’s jam and the frigate overlaps were both found by you, not by a test; these make sure the next ones are found first.',
    check: 'Run in CI for every map.',
    now: 'Flow and overlap tests exist; the rest are new.',
  },
  {
    id: 'q-player',
    sec: 'gate',
    title: 'Your scorecard decides',
    rule: 'One scorecard per map. It passes with fun ≥ 4, difficulty “right”, boss ≥ 4 with at least one ship lost, and the weakest wave not 1–3. Fun 3 or less sends the map back.',
    why: 'Your scorecards are the only measure that has tracked fun so far: Gauntlet 3 → 5 and Harbor 4 → 5 after their fixes.',
    check: 'The Test Lab page shows each map’s latest scorecard against these marks.',
    now: 'Gauntlet and Harbor pass; the Strait does not (fun 3, weakest wave 1).',
  },
  {
    id: 'q-batches',
    sec: 'gate',
    title: 'Roll out a chapter at a time',
    rule: 'Fix the three reference maps to the rules first. Then rebuild the rest of the maps one chapter at a time, 4–5 maps per batch, each batch played and scored before the next starts.',
    why: 'Each chapter adds its own mechanics; a batch is small enough to play in a few sittings (with save and continue).',
    check: 'A batch ships when all its maps pass.',
    now: '—',
  },
];

// Open questions: the first option is the recommendation.
export const QUESTIONS = [
  {
    id: 'mr-strait',
    text: 'The Strait has no problem of its own (open water, one shore) and scores 3 every time. What should it be?',
    options: [
      'Give it a simple shape problem that still teaches: e.g. a sandbar that pinches the lane, or a friendly headland that shelters half the run (recommended)',
      'Keep it plain as the tutorial map, but make it shorter and faster so it doesn’t drag',
      'Keep it as it is: map 1 is allowed to be a 3',
    ],
  },
  {
    id: 'mr-early',
    text: 'How much should waves 1–5 bite?',
    options: [
      'One real close call per wave from wave 3, but a good player still loses 0–1 ships by wave 5 (recommended)',
      'Real losses from wave 3: about 1–2 ships lost by wave 5',
      'Leave the first half calm; the action is in waves 6–13',
    ],
  },
  {
    id: 'mr-style',
    text: 'Which encounter style do the other 17 maps use?',
    options: [
      'The original (v1): one map-tied encounter per wave; drop set pieces (v2) and don’t test enemy pairs (v3) further (recommended)',
      'v1, but test v3 (enemy pairs) on one reference map before deciding',
      'v1 plus one big set piece at wave 10 on every map',
    ],
  },
  {
    id: 'mr-boss',
    text: 'How much should the three boss rounds cost a good player?',
    options: [
      'About one ship a round, three across the boss rounds (recommended)',
      'About two a round: the boss should be the hardest part by far',
      'Zero or one in total: the boss is about spectacle, not losses',
    ],
  },
  {
    id: 'mr-kit',
    text: 'Overdrive + Scattergun + Supply Run won two maps with no boss losses (“really op”). When do we deal with it?',
    options: [
      'Before tuning maps: otherwise every map looks easy with it (recommended)',
      'After the rollout: tune maps first, weapons later',
      'Leave it: a strong combo is a reward',
    ],
  },
  {
    id: 'mr-test',
    text: 'How should each rebuilt map be tested?',
    options: [
      'One scorecard per map, in batches of 4–5, with the automatic checks first (recommended)',
      'Two runs per map with different kits',
      'Bots only, and you spot-check a few maps',
    ],
  },
  {
    id: 'mr-order',
    text: 'In what order do we rebuild?',
    options: [
      'Fix the three reference maps to the rules, then chapter 1’s other two (Kesh, Marrow), then chapter by chapter (recommended)',
      'Go straight to the next chapter and come back to the reference maps later',
      'All 17 at once',
    ],
  },
  {
    id: 'mr-commands',
    text: 'Convoy commands on the other maps?',
    options: [
      'Only where the map’s mechanic needs one, like Hold on Sowers’ Reach (recommended)',
      'None anywhere: the convoy always sails itself',
      'Bring back one simple command on every map',
    ],
  },
];
