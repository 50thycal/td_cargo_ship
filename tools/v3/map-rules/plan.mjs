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
  updated: '2026-11-19',
  headline: 'Built from your notes: your rating screen is now the Test Lab’s end screen, with a quick rating at each weapon pick (merged). Marrow’s radar now slows enemies, Kesh’s boss is much harder, every boss opens with an 8-second calm and a banner, and the frigate jitter is fixed (merged, play log v29: ready to play). The bot test of every weapon combination is done and being re-run on the new build. Three things in Needs you, including replaying Kesh and Marrow.',
  phases: [
    { id: 'rules', name: 'Map and wave rules', state: 'done', detail: '31 rules: 26 approved; 6 rewritten from your notes and answers (marked in “The plan”). Round 1 questions all answered.' },
    { id: 'bots', name: 'Bots that play like you', state: 'done', detail: 'Refit from your 18 runs, each replayed by the bot with your own setup and Armory upgrades. Boss rounds: 1.37 ships a round before, 1.03 now (you: 0.52). Waves 1–5: 1.19 before, 0.69 now (you: 0.50). The fix: you grab pickups faster as the stakes rise (0.4–0.8 s in boss rounds); the bot only looked between bursts. It also plays at 1× with your Armory now. Still off: the Strait’s and Harbor’s boss rounds read harder to the bot than to you (about 1.3 a round where you lose 0), so their targets are set on the bot’s scale.' },
    { id: 'scorecard', name: 'The new scorecard', state: 'done', detail: 'Live in the Test Lab (#161). Before you rate, it shows your last scores for this map and the others; your run’s waves in a strip with the moments the game marked, to pick best and weakest; one “compared with the map you rated last” question; and only Fun, Difficulty, Play again and a note.' },
    { id: 'checks', name: 'Automatic checks and bot reports', state: 'done', detail: 'Built (#162). Each map now gets a bot report: losses per wave, cliffs, close calls, wave budgets, the danger and safe stretches, warning time, kits and a heat map. Encounters carry internal notes. Tests catch later-chapter foes and repeated encounters. First readings on the three reference maps: every map has a cliff (the Gauntlet’s wave 8 jumps from 0.75 to 3 ships for the bot); Harbor’s waves 4–7 send a third fewer attacks than they should; the Strait and the Gauntlet have no clearly safe stretch; every encounter repeats 3–4 waves in a row.' },
    { id: 'reference', name: 'The three reference maps to the rules', state: 'done', detail: 'Rebuilt (#163), played by you (all Keep, fun 4–5) and fixed from your runs (#165): Harbor’s boss round 3 sends one sub salvo, not two; a supersonic missile sits untouchable on the launcher for 0.4 s (was 1.1 s), then lifts off slowly and can be shot, landing when it did; the lock-on warning still runs the full 1.1 s.' },
    { id: 'fun', name: 'Measuring the fun moments', state: 'done', detail: 'Built (#167). Saves: at each kill, nuke and pickup the game is copied and played on without it (and 0.5 s late); if a ship would have sunk, it was a save, with its stakes (the run, the last ship) and how close. Tension: a danger reading every 0.1 s from how close threats are to hitting, giving each wave a curve (flat, one peak, sawtooth, rising, pinned). On your three runs the tensest wave was the wave you scored best, all three times. Your Strait wave 10 shows as two clutch saves with the run at stake: the ammo drop, then the last-second drone kill. The scorecard now asks you to tap your best moment on the wave strip.' },
    { id: 'ch1', name: 'Chapter 1: Kesh and Marrow', state: 'now', detail: 'Rebuilt (#169), played by you, changed from your runs (merged #174, play log v29). Marrow: inside the tower’s sweep every enemy and munition moves 35% slower (an icy wash and a pulse ring show it); the bot now loses 3.1 ships in waves 1–10 (was 4.0) and the tower is worth guarding. Kesh: the Drone Storm adds shells and guided missiles to its swarms, more each round; the bot now loses about 1.2, 2.3, 2.7 a round (was 0.6, 1.3, 1.3), and the bot reads boss rounds harder than you play them, so expect about 1 a round. Every map: boss round 1 now starts after 8 seconds with no launches and the banner “Survive the next 3 rounds. Convoy restored: 6 ships can still be lost.” Frigates no longer jitter on Kesh’s hook (heading flips 27–71 a minute → 1–3). The nuke never touched your weapons: on your log it killed the wave’s last threat, the wave ended on that step, and a wave’s end sends loaded weapons home (see Needs you). Next: your replay of both.' },
    { id: 'rate', name: 'Your rating screen in the Test Lab', state: 'done', detail: 'Merged (#173). The Test Lab end screen is the normal game’s “Rate & review this run”: Fun, Difficulty, the new Intensity, Boss rounds, Compared with the last map, Play again; then the run’s timeline with Watch it and notes, where you pick the best and weakest wave; then the Test Lab verdict. Best moment is gone. At each weapon pick an optional “Rate wave N” row (difficulty, fun, intensity 1–5 and a note) saves as you tap; your fun ratings then suggest the best and weakest wave. The three boss rounds play back to back, so only waves 1–10 get the row.' },
    { id: 'combos', name: 'Bot test of every weapon combination', state: 'now', detail: 'First pass done (about 11,000 bot runs, on play log v28); now re-running on v29. What it found: no kit makes a map trivial, with or without Armory upgrades. The first good weapon does most of the work (plain gun 17 ships lost over 13 waves, one good weapon 8–9, the best three 7.6). Best sets: Air Strike + Point Defense + Supply Run, Air Strike + Gravity Well + Supply Run, Flak + Point Defense + Supply Run. Supply Run is the best partner; Overdrive and Drone Screen the weakest. Your Overdrive + Scattergun + Supply Run kit comes out weak for the bot, but you won twice with it: the bot plays boosts and pickups badly, so that kit gets checked on one of your own logs before anything changes. Armory: Armor Plating and Damage Control matter most, Stockpile and Quick Reload least, and the Armory matters about twice as much as the loadout. Harbor’s and Kesh’s counter kit (Overdrive + Railgun + Focus) does worse than the bot’s own draft and needs replacing. Proposals come to you after the v29 re-run; nothing is retuned without you.' },
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
    { n: 164, title: 'Hub: your playtest and answers', state: 'merged' },
    { n: 166, title: 'Hub update', state: 'merged' },
    { n: 167, title: 'Fun measures: saves and the tension curve; Best moment on the scorecard', state: 'merged' },
    { n: 168, title: 'Hub update', state: 'merged' },
    { n: 169, title: 'Chapter 1: Kesh and Lee of Marrow rebuilt (play log v28)', state: 'merged' },
    { n: 170, title: 'Hub update', state: 'merged' },
    { n: 171, title: 'Encounter test follows the current encounters', state: 'merged' },
    { n: 172, title: 'Hub: your Kesh, Marrow and Battery notes', state: 'merged' },
    { n: 173, title: 'Rate & review in the Test Lab; rate each wave at the weapon pick', state: 'merged' },
    { n: 174, title: 'After the chapter 1 playtest: radar slows, harder Drone Storm, boss intro, smooth frigates (play log v29)', state: 'merged' },
    { n: 165, title: 'After your playtest: Harbor round 3, the supersonic, the iOS check (play log v27)', state: 'merged' },
  ],
  log: [
    { date: '2026-11-19', what: 'Merged #173, your rating screen in the Test Lab with a rating at each weapon pick. Merged #174, the chapter 1 changes (play log v29): Kesh and Marrow are ready to replay. Measured on your runs: the bot on your exact setup matches your Kesh waves 1–10 (3.0 against your 3) but reads Marrow about twice as hard as you (4.25 against 2). Your “clutch nuke” on Battery (wave 3, rack empty, a guided missile 0.6 s from a ship) is a real save; the detector missed it at first because the bot playing on grabbed the same nuke, and now catches it. Your Best moment taps were on the right wave both times but not the right second, which is why the per-wave rating replaces it.' },
    { date: '2026-11-19', what: 'Your campaign run on Battery (chapter 3, Dark Water; lost on wave 7, rated difficulty 5, fun 5, intensity 4). What I take from it: (1) the “NEW · Dark Water” tag on new weapons is now a rule for every rebuilt map; (2) “clutch nuke” and “those last two waves were really fun” are exactly the moments the saves and tension measures are for, and the run is being measured to check they find them; (3) yes, a bot test of every weapon and Armory combination makes sense, and it has started; (4) agreed, the normal game’s rating screen is better than the Test Lab scorecard: they are being merged, with a quick rating at each weapon pick so you don’t have to remember. Battery itself isn’t rebuilt yet (chapter 3), so its difficulty is noted for then.' },
    { date: '2026-11-19', what: 'Your Kesh and Marrow runs (both won, 4 ships lost, Keep, fun 4). What I think: Kesh’s waves landed where they should (0 lost until wave 8, then 1, 1, 2), but its boss cost you 0, 0, 1: the bot again reads boss rounds harder than you play them (it predicted 0.6, 1.3, 1.3), so Kesh’s boss is being raised until the bot reads it about 1.5–2.5 a round. Marrow’s difficulty was right; your radar idea is better than the current one: a slow-down field makes the tower a place you defend and use, not a stat bonus you don’t notice. The boss build-up is a good call for every map, not only Marrow. Agreed on Best moment: it asks you to remember a second; a rating at each weapon pick asks while it is fresh. Bugs: the frigate jitter on Kesh’s hook is being fixed; whether the nuke really clears your passive weapons is being checked on your own log (the nuke is written to hit enemies only, so it may be something that only looks like it).' },
    { date: '2026-11-18', what: 'Merged #169: Kesh and Lee of Marrow rebuilt to the rules, each with a map card (docs/design/v3-ch1-kesh.md, v3-ch1-marrow.md), one encounter a wave and rising boss rounds. They were far too easy (the bot won 96%); now 75% and 67% with your Armory. Play log is now v28. No new enemies debut here: every chapter 1 enemy already debuts on the Strait.' },
    { date: '2026-11-18', what: 'Merged #167, the fun measures. What they say about the three reference maps (bot with your Armory): waves 1–3 are flat on every map; waves 4–10 mostly one peak each, building to the top peak on wave 9 or 10; real saves are rare, about 0.1–0.5 a wave in waves 6–10 and up to 0.7 in a boss round (the Strait’s round 2). Your own runs had about 0.3 a wave and 0.7 a boss round, about the same as the bot. After #165, Harbor’s round 3 went from pinned to one peak and its round 2 is now the tense one. Next for the maps: a first bump of tension by wave 3, and more sawtooth waves (several peaks with breathers).' },
    { date: '2026-11-18', what: 'Merged #165. Harbor: with your Armory the bot now loses about 1.2, 2.3, 1.5 ships in boss rounds 1–3 (was 1.3, 1.8, 2.4) and wins a quarter of its runs (was a sixth); round 3 is now lighter than round 2, as you chose. The supersonic is easier to shoot down. The bot still matches you on waves 1–10 with your 3 new runs added (waves 1–5: 0.63 against your 0.48; waves 6–10: 3.8 against 3.4) and still reads boss rounds about twice as hard as you overall: the Strait much harder (1.7 against 0.2), the Gauntlet the same (1.0 against 1.25), Harbor harder (1.6 against 0.7). The iOS check now runs only when iOS files change, after merges and by hand. Play log is now v27.' },
    { date: '2026-11-18', what: 'Your answers filed: Harbor’s boss round 3 gets one sub salvo fewer, rounds 1–2 stay; the iOS check runs only on pull requests that touch iOS files, after merges and by hand. You picked two fun measures from the brainstorm (saves and the tension curve); both are being built tonight, and Kesh and Marrow start after the fixes land.' },
    { date: '2026-11-18', what: 'Your playtest against the bots (each run replayed by the bot on your seed, Armory and picks, 12 times). The Strait: you lost on wave 10 (3 ships there; you looked away on wave 5); the bot loses about 0.5 by wave 5 and 3.7 in waves 6–10 against your 1 and 5. The Gauntlet: you won with 5 lost, the boss cost you 0, 0, 1; the bot reads it 3× harder (1 a round) and wins 1 in 12. Harbor Mouth: the boss cost you 2, 0, 4 and ended the run; the bot predicted 1.9 a round, the same, so the old rule that the bot reads Harbor twice as hard no longer holds and its boss target was set too high.' },
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
    id: 'r6-replay-ch1',
    kind: 'item',
    title: 'Replay Kesh and Lee of Marrow on the new build (play log v29)',
    text: 'Ready now (#174 merged). What changed: Marrow’s radar slows every enemy and munition in its sweep by 35%, so it is worth guarding; Kesh’s Drone Storm now adds shells and guided missiles each round (the bot loses about 1.2, 2.3, 2.7 a round; it reads bosses harder than you, so expect about 1 a round); every boss opens with an 8-second calm and a banner; the frigates on Kesh’s hook are smooth. Try the “Rate wave N” row at each weapon pick. Mark Approve if both feel right, Change with a note if not.',
  },
  {
    id: 'r6-boss-reset',
    kind: 'question',
    text: 'Correction to last round: the game already restores your convoy before boss round 1 (campaign and full map-card runs), so ships lost in waves 1–10 don’t count in the boss. The new banner now says so: “Survive the next 3 rounds. Convoy restored: 6 ships can still be lost.” Keep that, or change it?',
    title: 'At the boss: keep restoring the convoy, or carry your losses in?',
    options: [
      'Keep the restore, as now: every boss is a clean “survive 3 rounds” test (recommended: it matches your note and makes the banner a moment)',
      'Carry the losses in: waves 1–10 still count in the boss; the banner says how many ships you have left',
      'Half way: repair 2 lost ships before the boss',
    ],
  },
  {
    id: 'r6-wave-end-weapons',
    kind: 'question',
    text: 'What cleared your frigates on Kesh wave 8 was not the nuke: it killed the wave’s last threat, the wave ended on that step, and at every wave’s end a loaded weapon (your Frigate, level 3) goes home. Should loaded weapons carry over into the next wave?',
    title: 'Should a weapon you loaded stay through the end of a wave?',
    options: [
      'No change: a wave’s end clears loaded weapons (recommended: each wave starts from your choice of what to load)',
      'Carry over: what you loaded stays into the next wave until it runs out',
      'Only when the wave ends early (by a nuke or a last kill), so you don’t lose a weapon you just loaded',
    ],
  },
];

// ---- Answered after round 1 (out of NEEDS; the marks are in
// review-2026-11-17-r2.json). The archive shows each with the player's call.
export const ANSWERED = [
  {
    id: 'r5-play-ch1',
    kind: 'item',
    verdict: 'approve',
    note: 'Played both (2026-11-18), both Keep, fun 4. “These maps were good overall.” Kesh: a bit easy, the boss far too easy (lost 0, 0, 1). Marrow: difficulty right, better than Kesh; turn the radar into a slow-down field; a bigger build-up before the boss. Frigates jitter on Kesh’s turn; the nuke shouldn’t clear your passive weapons.',
    at: '2026-11-18',
    title: 'Play the two rebuilt chapter 1 maps: Kesh and Lee of Marrow',
    text: '',
  },
  {
    id: 'r5-fun-target',
    kind: 'question',
    verdict: 'Answered',
    note: 'About 0.3–0.5 saves a wave in waves 6–10, about 1 a boss round, and a first tension bump by wave 3.',
    at: '2026-11-18',
    title: 'How many real saves should a wave aim for?',
    text: '',
  },
  {
    id: 'r5-marrow-tower',
    kind: 'question',
    verdict: 'Answered',
    note: 'Keep the tower, but buff it your way: “the radar tower seems kinda useless to keep… slow down enemies” in its radius instead of speeding up your shots.',
    at: '2026-11-18',
    title: 'Marrow’s radar tower falls early for the bot. What should we do?',
    text: '',
  },
  {
    id: 'r4-harbor-boss',
    kind: 'question',
    verdict: 'Answered',
    note: 'Soften round 3 a little (one sub salvo fewer), keep rounds 1–2.',
    at: '2026-11-18',
    title: 'Harbor Mouth’s boss rounds cost you 2, 0, then 4 ships and ended the run on round 3. What should they do?',
    text: '',
  },
  {
    id: 'r4-ios-check',
    kind: 'question',
    verdict: 'Answered',
    note: 'Only on pull requests that touch iOS files; also after every merge to the main branch, and by hand before a release.',
    at: '2026-11-18',
    title: 'When should the iOS build check run?',
    text: '',
  },
  {
    id: 'r3-play-reference',
    kind: 'item',
    verdict: 'approve',
    note: 'Played all three (2026-11-17/18), each Keep, Fun. The Strait fun 4, the Gauntlet fun 5 (boss 5), Harbor Mouth fun 5 (boss 5); each “better” than the map before. Notes: a supersonic stays untouchable a little too long after it leaves the truck; and track the close calls where a nuke, an ammo drop or killing a heavy saves the last ship, and reproduce them with the bots.',
    at: '2026-11-18',
    title: 'Play the three rebuilt maps: The Strait, The Gauntlet, Harbor Mouth',
    text: '',
  },
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
