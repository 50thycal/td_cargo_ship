// The weapon-category brainstorm as data, so it can be checked by script.
// Ratings per threat profile: S strong, o ok, w weak, - none (only passive and
// support categories may have "-").

export const PROFILES = ['swarm', 'fast', 'heavy', 'air', 'surface'];
export const PROFILE_KINDS = {
  swarm: 'drone, mini-drone, bomblet, mothership',
  fast: 'supersonic, ballistic, guided',
  heavy: 'heavy cruise missile, mothership, dreadnought, rigs',
  air: 'strafer, bomber',
  surface: 'fast boat, mine, sub, missile truck',
};

export const ROLES = {
  'AREA DENIAL': 'Covers an area: a blast, a cloud or a cone',
  PRECISION: 'One target or one line, hard',
  CHAIN: 'Jumps from target to target',
  HOMING: 'Finds its own targets',
  CONTROL: 'Moves, slows or holds threats',
  STRIKE: 'A big hit along a path or on a spot',
  ESCORT: 'Allied units that fight on their own',
  PROTECTION: 'Shields and repairs',
  TEMPO: 'More shots, faster reloads, longer timers',
  INTEL: 'Reveals or marks threats so other shots do more',
  EVASION: 'Moves the convoy out of harm',
};

export const CATEGORIES = {
  active: {
    name: 'Active', color: '#ff7a45',
    rule: 'Takes over the gun for 15 s: every tap fires it. Picking up another weapon replaces it.',
    slot: 'the weapon slot', blindSpots: false,
  },
  passive: {
    name: 'Passive', color: '#4ade80',
    rule: 'Fights on its own for 15 s; your tap stays the plain gun. Picking up another weapon replaces it.',
    slot: 'the weapon slot', blindSpots: true,
  },
  boost: {
    name: 'Boost', color: '#facc15',
    rule: 'Amplifies everything you have (gun, loaded weapon, escorts) for 10 s. Never replaces the loaded weapon; a second boost replaces the first.',
    slot: 'its own boost slot', blindSpots: true,
  },
  powerup: {
    name: 'Power-up', color: '#38bdf8',
    rule: 'A power-up you draft: it drops more often and gets stronger with each level. Instant or short; never touches the loaded weapon.',
    slot: 'none (instant)', blindSpots: true,
  },
  deploy: {
    name: 'Deployable', color: '#a78bfa',
    rule: 'The pickup arms one placement: your next tap on open water places it (a tap on a threat still fires the gun). It stays 20 s. Never replaces the loaded weapon.',
    slot: 'one placed at a time', blindSpots: true,
  },
  orders: {
    name: 'Convoy Order', color: '#f472b6',
    rule: 'Held as an order: your next tap on one of your ships gives it to that ship and its group. Never replaces the loaded weapon.',
    slot: 'one held order', blindSpots: true,
  },
  counter: {
    name: 'Countermeasure', color: '#94a3b8',
    rule: 'Stored as charges (up to 3) with no timer; each fires itself the moment its trigger happens. Never replaces the loaded weapon.',
    slot: 'charges, not a slot', blindSpots: true,
  },
};

// Every weapon: category, role, ratings [swarm, fast, heavy, air, surface],
// reuses (existing sim parts), status: existing | new, and echo (anything in
// the game or cut before that it resembles).
export const ARSENAL = [
  // ---- Active: the ten that exist (measured, see the effectiveness table) ----
  { name: 'Flak Cannon', cat: 'active', role: 'AREA DENIAL', r: 'SwoSw', status: 'existing', line: 'Clouds that shred whatever flies through' },
  { name: 'Thermobaric Shell', cat: 'active', role: 'AREA DENIAL', r: 'SwSow', status: 'existing', line: 'One huge blast for a packed group' },
  { name: 'Scattergun', cat: 'active', role: 'AREA DENIAL', r: 'SSwow', status: 'existing', line: 'A cone of pellets at anything close' },
  { name: 'Shrapnel Shell', cat: 'active', role: 'AREA DENIAL', r: 'SoSow', status: 'existing', line: 'Fragments out in every direction' },
  { name: 'Railgun', cat: 'active', role: 'PRECISION', r: 'oSSoo', status: 'existing', line: 'A beam through everything in line' },
  { name: 'Boomerang', cat: 'active', role: 'PRECISION', r: 'oSoSo', status: 'existing', line: 'A blade out and back along a line' },
  { name: 'Tesla Arc', cat: 'active', role: 'CHAIN', r: 'Swwww', status: 'existing', line: 'Each hit arcs to the threats nearby' },
  { name: 'Seeker Pod', cat: 'active', role: 'HOMING', r: 'Sooow', status: 'existing', line: 'Small seekers at the threats near your tap' },
  { name: 'Gravity Well', cat: 'active', role: 'CONTROL', r: 'Soowo', status: 'existing', line: 'Drags a raid together, then implodes' },
  { name: 'Air Strike', cat: 'active', role: 'STRIKE', r: 'SSSSS', status: 'existing', line: 'A jet down the row you tap' },
  // ---- Active: six new ones, for the roles and threats the ten leave thin ----
  { name: 'Net Launcher', cat: 'active', role: 'CONTROL', r: 'SowSw', status: 'new', reuses: ['field (well/flak)', 'threat speed scale (time warp)'], line: 'Shells burst into nets that snag and slow', why: 'Strafers sank 4 ships in a second (Island 11-03): a net slows a jet into the guns.' },
  { name: 'Designator Rounds', cat: 'active', role: 'INTEL', r: 'wwSoo', status: 'new', reuses: ['radar tracking (Marrow)', 'damage multiplier'], line: 'A hit marks the target: everything does double to it', why: 'Heavies took 8–10 taps with most weapons; this makes every other weapon a heavy-killer.' },
  { name: 'Gatling Burst', cat: 'active', role: 'TEMPO', r: 'oSwow', status: 'new', reuses: ['plain interceptor', 'hold-to-fire repeat'], line: 'Each tap fires a 3-round burst at the nearest threats', why: 'Fast missiles need a quick hand; a burst forgives a near miss.' },
  { name: 'Harpoon Gun', cat: 'active', role: 'PRECISION', r: 'wwSoS', status: 'new', reuses: ['railgun beam (single target)', 'raider kill (subs, trucks)'], line: 'A heavy harpoon: one hit kills a boat, truck or sub', why: 'No weapon is built for surface threats (boats, subs, trucks) today.' },
  { name: 'Mortar Barrage', cat: 'active', role: 'STRIKE', r: 'SwSwS', status: 'new', reuses: ['thermo blast', 'delayed impact (ballistic arc)'], line: 'Three shells land on the spot you tap, a beat later', why: 'A slow strike that rewards leading a slow pack or a parked truck.' },
  { name: 'Sidewinder Rounds', cat: 'active', role: 'HOMING', r: 'wooSw', status: 'new', reuses: ['seeker homing', 'aircraft targeting'], line: 'Every shot locks on to the nearest aircraft first', why: 'Strafers decide runs: an anti-air gun that still shoots everything else.' },

  // ---- Passive: two exist, four new (blind spots allowed) ----
  { name: 'Aegis Launchers', cat: 'passive', role: 'PROTECTION', r: 'oSo--', status: 'existing', line: 'Each ship fires at missiles and drones about to hit it', change: 'Player: stop shooting jets (missiles and drones only).' },
  { name: 'Frigate Escort', cat: 'passive', role: 'ESCORT', r: 'SoooS', status: 'existing', line: 'Frigates sail in and fire on their own' },
  { name: 'Combat Air Patrol', cat: 'passive', role: 'ESCORT', r: '---S-', status: 'new', reuses: ['plane routes (strafer)', 'escort targeting'], line: 'Two fighters fly cover and hunt enemy aircraft', why: 'An answer to strafers that leaves the gun free.' },
  { name: 'Barrage Balloons', cat: 'passive', role: 'AREA DENIAL', r: 'S--S-', status: 'new', reuses: ['field (static)', 'plane route collision'], line: 'Balloons along the lanes snag drones and low jets', why: 'Swarms and strafing runs come in low along the lanes.' },
  { name: 'Hunter Drones', cat: 'passive', role: 'HOMING', r: 'So-w-', status: 'new', reuses: ['seeker homing', 'escort fire'], line: 'Two drones circle the convoy and ram the first threats that come close', why: 'Slow but sure against swarms; fast missiles outrun them.' },
  { name: 'Gunboat Screen', cat: 'passive', role: 'ESCORT', r: 'o---S', status: 'new', reuses: ['escort stations', 'raider targeting'], line: 'Fast gunboats hunt boats, mines and surfacing subs', why: 'Surface threats (Coves, Sowers) have no specialist.' },

  // ---- Boost (the player's idea): amplifies everything, never replaces ----
  { name: 'Speed Loader', cat: 'boost', role: 'TEMPO', r: 'Soooo', status: 'new', reuses: ['reload rate (Armory)'], line: 'Rounds reload twice as fast', why: 'The rack ran dry in wave 10 on two runs.' },
  { name: 'Hot Rounds', cat: 'boost', role: 'PRECISION', r: 'ooSoo', status: 'new', reuses: ['damage on hit'], line: 'Every shot from everything hits for one more', why: 'Heavies and bosses; also lifts escorts and Aegis.' },
  { name: 'Velocity Shells', cat: 'boost', role: 'PRECISION', r: 'oSoSo', status: 'new', reuses: ['interceptor speed (Armory motor)'], line: 'Every shot flies twice as fast', why: 'Supersonic and ballistic missiles outrun slow shots.' },
  { name: 'Big Bore', cat: 'boost', role: 'AREA DENIAL', r: 'Soooo', status: 'new', reuses: ['blast radius (Armory warhead)'], line: 'Every blast, cloud, beam and net is 40% bigger', why: 'Makes area weapons, and the plain gun, forgive a rough tap.' },
  { name: 'Double Tap', cat: 'boost', role: 'CHAIN', r: 'Sooow', status: 'new', reuses: ['second shot (Storm Coil)'], line: 'Every tap also fires at the next-nearest threat', why: 'Big raids; pairs with any active weapon.' },
  { name: 'Battle Stations', cat: 'boost', role: 'ESCORT', r: 'Soooo', status: 'new', reuses: ['escort fire rate', 'point defense rate'], line: 'Frigates, Aegis, buoys and turrets fire twice as fast', why: 'A boost for builds that lean on escorts, not the gun.' },

  // ---- Power-up (the player's idea): drafted, upgradable, instant ----
  { name: 'Shield', cat: 'powerup', role: 'PROTECTION', r: 'SSSSS', status: 'existing-pickup', reuses: ['shield'], line: 'Level 1: 5 s · level 3: 8 s, and it reflects a hit', why: 'Exists as a random drop; drafting it makes it yours.' },
  { name: 'Time Warp', cat: 'powerup', role: 'CONTROL', r: 'SSoSo', status: 'existing-pickup', reuses: ['timewarp'], line: 'Level 1: threats at 40% for 4 s · level 3: 25% for 6 s', why: 'Exists as a random drop.' },
  { name: 'Repair Crew', cat: 'powerup', role: 'PROTECTION', r: '-----', status: 'existing-pickup', reuses: ['repair'], line: 'Level 1: +2 hull · level 3: the whole convoy and carrier', why: 'Exists as a random drop.' },
  { name: 'Full Steam', cat: 'powerup', role: 'EVASION', r: 'ooooo', status: 'existing-pickup', reuses: ['steam'], line: 'Level 1: 1.6× speed for 5 s · level 3: 2× for 8 s', why: 'Exists as a random drop.' },
  { name: 'Overdrive', cat: 'powerup', role: 'TEMPO', r: 'ooooo', status: 'existing-pickup', reuses: ['overdrive'], line: 'Level 1: free shots for 5 s · level 3: 10 s', why: 'Exists as a random drop.' },
  { name: 'Recon Flare', cat: 'powerup', role: 'INTEL', r: 'ooooo', status: 'new', reuses: ['starshell light', 'raid warning'], line: 'Lights the sea and shows where the next two raids come from', why: 'Star Shell, made useful on every map.' },

  // ---- Deployable (new category): placed by a tap, stays 20 s ----
  { name: 'Sea Mines', cat: 'deploy', role: 'AREA DENIAL', r: '----S', status: 'new', reuses: ['mine (Sowers)', 'field'], line: 'A small minefield: boats and surfacing subs that cross it sink', why: 'Surface threats.' },
  { name: 'Boom Barrier', cat: 'deploy', role: 'CONTROL', r: '---oS', status: 'new', reuses: ['lock gate (Saltgate)', 'collision'], line: 'A floating boom across the water: boats and mines stop at it', why: 'Holds the Coves\' boats and the Sowers\' mines off the lane.' },
  { name: 'Flak Buoy', cat: 'deploy', role: 'HOMING', r: 'S--o-', status: 'new', reuses: ['point defense (Armory)', 'flak cloud'], line: 'A buoy that fires flak at drones passing near it', why: 'Covers a gap in the lane while you shoot elsewhere.' },
  { name: 'Radar Buoy', cat: 'deploy', role: 'INTEL', r: 'oSoo-', status: 'new', reuses: ['radar tracking (Marrow post)'], line: 'Threats near the buoy are tracked: your shots at them fly faster', why: 'Lee of Marrow\'s radar, where you want it.' },
  { name: 'Artillery Beacon', cat: 'deploy', role: 'STRIKE', r: 'Sw-wS', status: 'new', reuses: ['thermo blast', 'timed impacts'], line: 'Shells land round the beacon every 2 s', why: 'Denies a raid\'s approach or a road\'s end.' },
  { name: 'SAM Buoy', cat: 'deploy', role: 'HOMING', r: '---S-', status: 'new', reuses: ['seeker homing', 'aircraft targeting'], line: 'A buoy that fires missiles at aircraft passing near it', why: 'Park it under a strafing line.' },

  // ---- Convoy Order (new category): a tap on your own ship ----
  { name: 'Evasive Turn', cat: 'orders', role: 'EVASION', r: '-ooS-', status: 'new', reuses: ['ship lat offset', 'formation'], line: 'The group swerves hard for 2 s: strafing lines and impacts miss', why: 'Strafing runs sank 4 ships at once.' },
  { name: 'Flank Speed', cat: 'orders', role: 'EVASION', r: 'oo-o-', status: 'new', reuses: ['steam (per group)'], line: 'The group sprints ahead for 4 s', why: 'Full Steam, aimed at one group.' },
  { name: 'All Stop', cat: 'orders', role: 'CONTROL', r: '-o-o-', status: 'new', reuses: ['lock hold (Saltgate)'], line: 'The group holds still for 3 s and lets a raid pass ahead', why: 'Ballistic missiles aim where a ship will be.' },
  { name: 'Fire Support', cat: 'orders', role: 'STRIKE', r: 'Sw-oo', status: 'new', reuses: ['air strike jet'], line: 'The ship calls a free air strike down its own row', why: 'Clears what is about to hit that group.' },
  { name: 'Deck Guns', cat: 'orders', role: 'ESCORT', r: 'Sw-o-', status: 'new', reuses: ['escort fire (frigate)'], line: 'The ship\'s crew fires at drones near it for 6 s', why: 'Turns a cargo ship into a little escort.' },
  { name: 'Draw Fire', cat: 'orders', role: 'PROTECTION', r: 'oo---', status: 'new', reuses: ['retarget threats', 'armor (plating)'], line: 'Missiles go for this ship for 4 s, and it shrugs off half', why: 'Spares the tanker or a crowded group.' },

  // ---- Countermeasure (new category): stored charges, fire themselves ----
  { name: 'Chaff', cat: 'counter', role: 'EVASION', r: '-S---', status: 'new', reuses: ['retarget (guided)'], line: 'A guided missile about to hit a ship loses its lock', echo: 'Decoy Flares (cut in round 3 as a 15 s gun mode); as a one-off automatic charge it works differently', why: 'Guided missiles were 1 of 6 sinkings on Marrow.' },
  { name: 'Last-Ditch Gun', cat: 'counter', role: 'HOMING', r: 'oS---', status: 'new', reuses: ['point defense shot'], line: 'Shoots down a missile a moment before it hits', echo: 'the Armory\'s Point Defense (fires every 3 s); this fires only at the last moment, once per charge', why: 'The save-the-ship moment, without a tap.' },
  { name: 'Strafe Guard', cat: 'counter', role: 'PROTECTION', r: '---S-', status: 'new', reuses: ['shield (per group)', 'strafer warning'], line: 'When a strafing run lines up, those ships get a 2 s shield', why: 'Strafers sank all 6 ships in the 11-03 13:42 Island run.' },
  { name: 'Hull Patch', cat: 'counter', role: 'PROTECTION', r: '-----', status: 'new', reuses: ['repair'], line: 'A ship about to sink is patched to 2 hull', why: 'A second chance for one ship.' },
  { name: 'Counter-Battery', cat: 'counter', role: 'STRIKE', r: '-o--o', status: 'new', reuses: ['raid bases', 'base knock-out (battery)'], line: 'A base that fires is shelled and goes quiet for 8 s', why: 'Hits the source, not the missile.' },
  { name: 'Reserve Belt', cat: 'counter', role: 'TEMPO', r: 'ooooo', status: 'new', reuses: ['ammo refill'], line: 'When the rack runs dry, it refills at once', why: 'Wave 10 on Marrow: 29 taps on an empty rack.' },
];

// Things a new idea must not repeat (or must say it echoes): ideas cut
// before, the Armory's cards, and the random power-ups.
export const CUT = ['EMP Rounds', 'Hellfire Salvo', 'Smoke Shells', 'Decoy Flares', 'Sub Hunter', 'Cryo Rounds', 'Point-Defense Laser'];
export const ARMORY = ['Quick Reload', 'Wide Warhead', 'Fast Motors', 'Deep Magazine', 'Proximity Fuse', 'Armor Plating', 'Point Defense', 'Damage Control', 'Long Loads', 'Supply Lines', 'Stockpile'];
export const POWERUPS = ['Ammo', 'Repair', 'Overdrive', 'Time Warp', 'Shield', 'Full Steam', 'Star Shell'];
