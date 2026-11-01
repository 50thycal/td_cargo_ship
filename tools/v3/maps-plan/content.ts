// The words of the V3 maps plan: the order of all 20 maps, each map's caption
// and engine cost, the brainstorm and the open questions. render.ts turns this
// (with the layouts) into the review page, the SVGs and the plan doc.

export type Engine = 'none' | 'data' | 'small' | 'medium' | 'large';

export interface Slot {
  slot: number;
  chapter: number;
  id: string;
  existing: boolean;
  name: string;
  pitch: string;
  /** The ONE new idea this map brings. */
  unique: string;
  /** Threats or mechanics this map is first to bring. */
  introduces: string;
  /** Earlier ideas it reuses, as support (never the headline). */
  reuses?: string;
  tries: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  engine: Engine;
  engineNote: string;
  /** Suggested threatScale for the slot (today's value in brackets for existing maps). */
  scale: string;
  free?: boolean;
}

export const CHAPTERS = [
  { n: 1, name: 'Home Waters', tries: '1–2 tries a map', idea: 'Learn the threats. Geography helps you more than it hurts. Maps 1–2 are the free trial.' },
  { n: 2, name: 'The Narrows', tries: '~2 tries a map', idea: 'The water squeezes the convoy: shared lanes, a VIP, single file, islets, locks.' },
  { n: 3, name: 'Dark Water', tries: '2–3 tries a map', idea: 'Hazards that are not missiles: mines, rigs to knock out, night, a battleship.' },
  { n: 4, name: 'Open War', tries: '3–4 tries a map', idea: 'Everything at once: boats, forks, two-way traffic, tides, and the Citadel.' },
];

export const SLOTS: Slot[] = [
  // ---- Chapter 1: Home Waters ----
  { slot: 1, chapter: 1, id: 'strait', existing: true, free: true, name: 'The Strait',
    pitch: 'Enemy on the north shore only, long warnings. Learn every threat.',
    unique: 'One enemy shore, one wide lane', introduces: 'drones, ballistic, guided, supersonic, heavy; trucks, subs, aircraft',
    tries: '1', difficulty: 1, engine: 'none', engineNote: 'Built.', scale: '1.15 (1.15)' },
  { slot: 2, chapter: 1, id: 'kesh', existing: false, free: true, name: 'The Kesh Hook',
    pitch: 'The strait hooks north round a friendly cape; you hold the inside of the turn.',
    unique: 'A curved lane: ships hook 90° and leave off the top edge', introduces: 'nothing new to fight; the turn changes every lead angle',
    tries: '1', difficulty: 1, engine: 'large', engineNote: 'Path lanes: a lane is a polyline, ships and formations follow its heading, funnels measured along it, ballistic lead follows the path. Also the base for the Delta. Medium–large.', scale: '1.1' },
  { slot: 3, chapter: 1, id: 'marrow', existing: false, name: 'Lee of Marrow',
    pitch: 'A friendly island shields the middle of the lane; the gaps either side are the fight.',
    unique: 'Terrain masking: low flyers must route round friendly high ground', introduces: '—',
    tries: '1–2', difficulty: 2, engine: 'small', engineNote: 'Drones, guided, supersonic and heavies steer round friendly land (or a base can\'t lock a target masked by it). Ballistics arc over. Small.', scale: '1.1' },
  { slot: 4, chapter: 1, id: 'island', existing: true, name: 'The Island',
    pitch: 'The enemy holds the island and the far shore. A risky fast north lane, a safe south lane.',
    unique: 'An enemy island in mid-strait, two lanes', introduces: 'cluster missiles; caves and tunnels',
    tries: '1–2', difficulty: 2, engine: 'none', engineNote: 'Built.', scale: '0.95 (0.95)' },
  { slot: 5, chapter: 1, id: 'harbor', existing: true, name: 'Harbor Mouth',
    pitch: 'The channel funnels into the harbour under enemy headlands. The worst comes last.',
    unique: 'A funnel: the hardest stretch is right before delivery', introduces: 'motherships',
    tries: '2', difficulty: 2, engine: 'data', engineNote: 'Built. Ease to fit slot 5 (bots clear it least of the five).', scale: '0.9 (1.0)' },
  // ---- Chapter 2: The Narrows ----
  { slot: 6, chapter: 2, id: 'gauntlet', existing: true, name: 'The Gauntlet',
    pitch: 'Enemy on both shores. Your carrier holds the middle; ships pass either side.',
    unique: 'Both shores hostile, carrier mid-channel', introduces: '—',
    tries: '2', difficulty: 3, engine: 'data', engineNote: 'Built. Moves from slot 2 to 6 (unlock order changes; the save keeps cleared maps by id).', scale: '1.2 (1.2)' },
  { slot: 7, chapter: 2, id: 'behemoth', existing: false, name: 'The Behemoth Run',
    pitch: 'Once a wave a supertanker crawls through the deep lane. Six hits, worth three ships.',
    unique: 'A VIP ship to protect alongside the convoy', introduces: 'supertanker (6 hp, counts as 3 losses, heavies prefer it)',
    tries: '2', difficulty: 3, engine: 'small', engineNote: 'A ship type: size, hit points, loss weight, its own lane and speed, threat targeting weight; a reward on delivery. Small.', scale: '1.15' },
  { slot: 8, chapter: 2, id: 'needle', existing: false, name: 'The Needle of Bosk',
    pitch: 'Open water narrows to a gap one ship wide. The convoy bunches at the mouth.',
    unique: 'Single file: ships merge into a column and queue before the gap', introduces: '—',
    reuses: 'the funnel (map 5)',
    tries: '2', difficulty: 3, engine: 'medium', engineNote: 'Lanes below LANE_FLOOR: ships merge to one file and queue (slow) before the gap, keep spacing, re-form after. Column formation skips the merge. Medium.', scale: '1.1' },
  { slot: 9, chapter: 2, id: 'archipelago', existing: true, name: 'The Archipelago',
    pitch: 'Enemy islets with gaps between them, and motherships. The west end is a long reach.',
    unique: 'A chain of enemy islets; the long reach west', introduces: '—',
    tries: '2', difficulty: 3, engine: 'data', engineNote: 'Built. Slightly harder for slot 9.', scale: '1.1 (1.05)' },
  { slot: 10, chapter: 2, id: 'saltgate', existing: false, name: 'Saltgate Canal',
    pitch: 'Two locks. Ships wait in each chamber while it fills: sitting ducks under the silos.',
    unique: 'Lock gates: stop, wait, go, on a visible timer', introduces: '—',
    tries: '2–3', difficulty: 3, engine: 'large', engineNote: 'Locks: gates close, ships stop in the chamber, a fill timer with a gate light and countdown, the far gate opens, ships behind queue (reuses the single-file queue). Medium–large.', scale: '1.0' },
  // ---- Chapter 3: Dark Water ----
  { slot: 11, chapter: 3, id: 'battery', existing: false, name: 'Battery Point',
    pitch: 'Two allied shore guns fire on their own. The enemy wants them silenced first.',
    unique: 'Allied turrets that help, and draw fire', introduces: 'enemy fire aimed at your shore guns',
    tries: '2', difficulty: 3, engine: 'small', engineNote: 'A friendly auto-turret (reach, rate, targets nearest) that a hit knocks out for ~12 s; heavies and ballistics may target it. Small–medium.', scale: '1.2' },
  { slot: 12, chapter: 3, id: 'sowers', existing: false, name: "Sowers' Reach",
    pitch: 'Mines drift across the lane on the current. Clear them without starving the sky.',
    unique: 'Drifting mines to clear', introduces: 'mines (drift with the current, 3 damage to a ship, one hit clears)',
    tries: '2–3', difficulty: 4, engine: 'medium', engineNote: 'A new threat that drifts, never targets, collides with ships and is tappable; mine chutes as base kinds; bombers may lay a line late on. Medium.', scale: '1.15' },
  { slot: 13, chapter: 3, id: 'rigs', existing: false, name: 'The Rig Field',
    pitch: 'Enemy oil rigs launch from the open sea. A rig you bring down stays down.',
    unique: 'Destructible launchers: permanent relief for weapon time spent', introduces: 'rigs with hit points',
    tries: '2–3', difficulty: 4, engine: 'small', engineNote: 'Bases get hit points, a health bar and a destroyed state that lasts the run; which weapons damage them (Railgun, Air Strike, Thermobaric, plain shots for 1). Small–medium. Reused by the Citadel.', scale: '1.2' },
  { slot: 14, chapter: 3, id: 'lantern', existing: false, name: 'The Black Strait',
    pitch: 'Night. Threats are a faint glow until the lighthouse beam sweeps over them.',
    unique: 'Night: you see by the beam, launch flashes and Star Shells', introduces: 'Star Shell pickup (lights an area 5 s)',
    tries: '3', difficulty: 4, engine: 'medium', engineNote: 'A darkness layer, a sweeping light cone, the carrier\'s lamp, threats drawn dim outside light (still tappable, landing circles still shown), a Star Shell pickup. Medium.', scale: '1.15' },
  { slot: 15, chapter: 3, id: 'dreadnought', existing: false, name: 'Dreadnought Pass',
    pitch: 'Every third wave a battleship steams through, firing broadsides. Sixty hits to sink.',
    unique: 'A moving boss with a health bar', introduces: 'the Dreadnought',
    reuses: 'base hit points (map 13)',
    tries: '3', difficulty: 4, engine: 'large', engineNote: 'A moving launcher on a path with hit points, turrets that fire barrages, a boss bar and a sinking moment; waves 3/6/9/10. Medium–large.', scale: '1.15' },
  // ---- Chapter 4: Open War ----
  { slot: 16, chapter: 4, id: 'coves', existing: false, name: "Smugglers' Coves",
    pitch: 'Fast attack boats burst out of hidden coves to ram the convoy.',
    unique: 'The first threat that comes over the water', introduces: 'fast attack boats (white wake warning, 2 hits)',
    tries: '3', difficulty: 4, engine: 'small', engineNote: 'A surface threat: drives from a cove to a ship on the water (reuses truck and sub movement), rams. Small–medium.', scale: '1.25' },
  { slot: 17, chapter: 4, id: 'delta', existing: false, name: 'The Sharra Delta',
    pitch: 'The river forks three ways. Tap the buoy to pick the branch the next ships take.',
    unique: 'You route the convoy: a one-tap switch at the fork', introduces: 'no subs (too shallow)',
    reuses: 'path lanes (map 2)',
    tries: '3', difficulty: 5, engine: 'medium', engineNote: 'Forked path lanes, a tappable switch that sets the next spawn group\'s branch, the bot learns to use it. Medium (after path lanes).', scale: '1.25' },
  { slot: 18, chapter: 4, id: 'crossing', existing: false, name: 'Dunmar Crossing',
    pitch: 'Two convoys at once: outbound east in the north lane, inbound west in the south.',
    unique: 'Two-way traffic: both edges are a front', introduces: '—',
    reuses: 'carrier mid-channel (map 6)',
    tries: '3–4', difficulty: 5, engine: 'small', engineNote: 'Per-lane spawn and delivery sides (right-to-left ships, formations mirrored). Small–medium.', scale: '1.25' },
  { slot: 19, chapter: 4, id: 'tide', existing: false, name: 'Tidewater Flats',
    pitch: 'The safe lane over the flats floats only at high tide. At low tide, everyone runs the guns.',
    unique: 'A lane that opens and closes on the tide', introduces: 'tide gauge',
    reuses: 'risky vs safe lanes (map 4)',
    tries: '3–4', difficulty: 5, engine: 'small', engineNote: 'A lane gated by a timer (ships pick an open lane at spawn; ships already on the flats finish), a gauge, flats drawn wet or dry. Small–medium.', scale: '1.3' },
  { slot: 20, chapter: 4, id: 'citadel', existing: false, name: 'Citadel of Vey',
    pitch: 'A fortress guards the harbour narrows behind a shield fed by three generators.',
    unique: 'The fortress: break the shield, then silence the core', introduces: 'shield and generators',
    reuses: 'the funnel (5), destructible launchers (13), boss bar (15)',
    tries: '4', difficulty: 5, engine: 'medium', engineNote: 'A shield that blocks hits on the core until its generators fall; the core\'s batteries silenced at 0 hp. Medium, mostly reusing rigs and the Dreadnought.', scale: '1.35' },
];

export interface Idea {
  name: string;
  line: string;
  stresses: string;
  decision: string;
  pick?: string; // map id when shortlisted
  why?: string; // why not, when cut
}

export const BRAINSTORM: { group: string; ideas: Idea[] }[] = [
  { group: 'Geography', ideas: [
    { name: 'The bend (Hormuz-like)', line: 'The lane hooks 90° round a cape; carrier inside the turn.', stresses: 'lead angles on ballistics and guided', decision: 'Guard the apex where ships turn and bunch', pick: 'kesh' },
    { name: 'Single-file narrows', line: 'Wide water funnels to a one-hull gap.', stresses: 'clusters, ballistic splash on a bunched queue', decision: 'Formation (Column) and ship flow before the gap', pick: 'needle' },
    { name: 'Canal with lock gates', line: 'Ships stop in chambers while they fill.', stresses: 'everything, against stationary ships', decision: 'Time your rack to the gate cycle', pick: 'saltgate' },
    { name: 'River delta, forking', line: 'Three branches round marsh islands; you switch the fork.', stresses: 'shore fire at short range', decision: 'Which branch the next ships take', pick: 'delta' },
    { name: 'Fjord with cliffs', line: 'High walls hide launch sites until a missile crests the cliff.', stresses: 'reaction time', decision: 'Memorise launch points', why: 'Its idea (short warning) is the Island\'s and the Black Strait\'s; the night map does it with more to look at.' },
    { name: 'Open sea, enemy fleet', line: 'No shores; warships on the horizon launch everything.', stresses: 'all-round threat', decision: 'Which ship to hit', why: 'Folded into the Dreadnought: one boss reads better than a fleet on a phone.' },
    { name: 'Archipelago maze', line: 'Lanes weave between many islets.', stresses: 'short-warning fire from all sides', decision: 'Where to sit your attention', why: 'The Archipelago and the Delta already cover it.' },
    { name: 'Reef or pack ice', line: 'The lane narrows a little every wave.', stresses: 'bunching over time', decision: 'When to lower ship flow', why: 'Single file does the narrowing better; ice is a theme we can reskin later.' },
    { name: 'Wreck Alley', line: 'Every ship sunk leaves a wreck that narrows the lane.', stresses: 'snowballing losses', decision: 'Losses cost space, not just lives', why: 'Punishes a losing player twice; keep for Hard mode.' },
    { name: 'Two-strait junction', line: 'Two straits meet in a T; convoys merge at the junction.', stresses: 'merge point fire', decision: 'Protect the merge', why: 'Needs two lane systems at once; Dunmar gives two-way traffic for less.' },
  ] },
  { group: 'Dynamics', ideas: [
    { name: 'Tides', line: 'The safe lane floats only at high tide.', stresses: 'shore fire on the deep channel at ebb', decision: 'Ship flow in time with the tide', pick: 'tide' },
    { name: 'Swing bridge on a timer', line: 'A bridge closes the lane; ships wait for it to swing.', stresses: 'queued ships', decision: 'Same as locks', why: 'The locks do the stop-and-wait idea, with more drama.' },
    { name: 'Lane closure mid-wave', line: 'A blockship sinks in a lane and ships reroute.', stresses: 'sudden rerouting', decision: 'Cover the new route', why: 'Feels random rather than readable; the delta switch gives control instead.' },
    { name: 'Battleship crossing', line: 'A moving boss steams through every third wave.', stresses: 'heavy barrages; weapon time on a big target', decision: 'Sink it, or ride it out', pick: 'dreadnought' },
    { name: 'Fortress boss', line: 'A shielded citadel guarded by generators.', stresses: 'everything', decision: 'Generators first, or the convoy', pick: 'citadel' },
    { name: 'Night and a searchlight', line: 'Threats show faintly until the beam crosses them.', stresses: 'warning time', decision: 'Watch the beam; spend Star Shells', pick: 'lantern' },
    { name: 'Storm', line: 'Ships slow down; aircraft are grounded while it blows.', stresses: 'exposure time', decision: 'Flow down in the storm', why: 'Slower ships just make a map longer; a fine skin for a Hard-mode variant.' },
    { name: 'Fog banks', line: 'Drifting banks hide what is inside them.', stresses: 'warning time in places', decision: 'Cover the fog edges', why: 'Same headline as night; one visibility map is enough for 20.' },
    { name: 'Mines', line: 'Mines drift across the lane on the current.', stresses: 'ammo split between mines and missiles', decision: 'Rounds now on mines, or on the sky', pick: 'sowers' },
    { name: 'Fast attack boats', line: 'Boats burst out of coves to ram.', stresses: 'a surface threat', decision: 'Boats or missiles first', pick: 'coves' },
    { name: 'Airfield on the shore', line: 'Jets taxi and take off from a visible runway.', stresses: 'aircraft', decision: 'Hit them on the runway', why: 'Overlaps the rigs (knock out the source); aircraft already come on every map.' },
    { name: 'Jammer tower', line: 'Inside its zone your interceptors wobble until it falls.', stresses: 'accuracy', decision: 'Destroy the jammer', why: 'Making the main gun worse feels unfair in a tap game.' },
    { name: 'Volcano or ash fall', line: 'Ash clouds drift and block shots.', stresses: 'aim', decision: 'Shoot round clouds', why: 'Blocking the player\'s own shots reads as a bug.' },
  ] },
  { group: 'Friendly side', ideas: [
    { name: 'Friendly island shelter', line: 'Low flyers have to go round it.', stresses: 'the gaps either side', decision: 'Watch the gaps, not the middle', pick: 'marrow' },
    { name: 'Allied shore battery', line: 'Two turrets fire on their own; the enemy targets them.', stresses: 'heavies aimed at your guns', decision: 'Save the guns or the ships', pick: 'battery' },
    { name: 'Allied radar', line: 'Longer warnings while the radar stands.', stresses: 'strikes on the radar', decision: 'Defend your eyes', why: 'A second protect-the-structure map next to the battery; the battery is more visible.' },
    { name: 'Second friendly port mid-map', line: 'Half the convoy delivers early.', stresses: 'little', decision: 'Few', why: 'No real decision for the player.' },
    { name: 'Carrier on the far shore', line: 'The gun sits next to the enemy.', stresses: 'carrier strikes', decision: 'Self-defence first', why: 'Flips the readable layout for little gain.' },
    { name: 'Supertanker (VIP)', line: 'One huge slow ship a wave, worth three.', stresses: 'heavies and guided aimed at it', decision: 'Priorities: tanker or convoy', pick: 'behemoth' },
    { name: 'Rigs you can destroy', line: 'Offshore launchers with hit points stay down.', stresses: 'weapon time', decision: 'Invest now for quiet later', pick: 'rigs' },
  ] },
  { group: 'Direction', ideas: [
    { name: 'Two-way traffic', line: 'Outbound east, inbound west, at once.', stresses: 'both edges', decision: 'Split attention left and right', pick: 'crossing' },
    { name: 'Right to left', line: 'The whole convoy sails west.', stresses: 'nothing new', decision: 'None', why: 'A mirror, not an idea; the Crossing uses it.' },
    { name: 'Convoy turnaround', line: 'Ships sail in, deliver at a mid-map port, sail back out.', stresses: 'double exposure', decision: 'Few', why: 'Doubles exposure without a new decision.' },
  ] },
];

export interface Question {
  id: string;
  q: string;
  options: string[];
  /** Index into options. */
  rec: number;
  why: string;
}

export const QUESTIONS: Question[] = [
  { id: 'free', q: 'Which two maps are the free trial?', options: ['The Strait + The Kesh Hook', 'The Strait + Lee of Marrow', 'The Strait + The Island'], rec: 0,
    why: 'The Hook is the store screenshot and plays easy, but it needs path lanes built first. Lee of Marrow is cheap to build; the Island already exists but is harder.' },
  { id: 'lock', q: 'How long should a ship wait in a Saltgate lock?', options: ['4 s', '6 s', '8 s'], rec: 1,
    why: '6 s is one raid cycle (raids come every 5 s): long enough to feel exposed, short enough not to bore. A gate light and countdown show the time left.' },
  { id: 'boss', q: 'Should every chapter end on a boss?', options: ['Set-piece enders (as laid out)', 'A boss with a health bar every chapter', 'No bosses, just harder maps'], rec: 0,
    why: 'Laid out: Harbor Mouth, Saltgate, Dreadnought and the Citadel close the chapters. Only the last two are true bosses; a boss on map 5 would land before the player knows the threats.' },
  { id: 'delta', q: 'Should the Delta\'s fork be yours to switch?', options: ['Yes: one tap on the buoy', 'No: ships pick at random'], rec: 0,
    why: 'Without the switch it is the Island with three lanes. One tap on a big buoy is a single decision, not button management.' },
  { id: 'night', q: 'How dark is the Black Strait?', options: ['Threats glow faintly outside the light', 'Fully hidden outside the light'], rec: 0,
    why: 'A faint glow keeps every threat answerable (warning and an answer); fully hidden would break the fairness rule.' },
  { id: 'rigs', q: 'Does a destroyed rig stay down?', options: ['For the rest of the run', 'Rebuilt after 2 waves'], rec: 0,
    why: 'Permanent is the decision: invest now for quiet later. A rebuild makes it a chore.' },
  { id: 'tanker', q: 'Losing the supertanker counts as how many ships?', options: ['2', '3', 'Lose the map'], rec: 1,
    why: 'Three of the six allowed losses makes it matter without one hit ending the run.' },
  { id: 'column', q: 'At the Needle, should Column formation skip the queue?', options: ['Yes', 'No'], rec: 0,
    why: 'It makes the formation picker matter on one map, which it rarely does today.' },
  { id: 'names', q: 'Are the made-up names OK?', options: ['Yes', 'Change some (note them per map)'], rec: 0,
    why: 'All fictional, inspired by real places (Kesh ~ Qeshm, Saltgate ~ Suez, Bosk ~ Bosporus, Dunmar ~ Dardanelles), to stay clear of App Store trouble.' },
];
