// Weapon ideas, round 2 (brainstorm data; nothing here is in the game).
//
// The player, on round 1's 42 ideas: "Nothing stood out as different." The
// three categories kept: Active, Passive, Boost. Round 2 asks for ideas with a
// different FEATURE, the way the player's own do:
// - a drone stream from the bottom of the map;
// - helicopters that do area damage;
// - a bomber that kills ground vehicles and disables silos and tunnels;
// - hold to fire faster with a bigger magazine;
// - more power-up drops for a while;
// - an energy weapon you tap, or hold for a harder hit.
//
// Every idea is tagged on three axes, so "different" can be checked rather
// than claimed (check2.mjs):
// - verb: what your finger does;
// - target: what the idea acts on;
// - shape: how its effect plays out in time.
// `proto` names the prototype in proto.mts that measured it, if any.

/** What your finger does. 'tap' is today's verb; 'auto' means nothing to do. */
export const VERBS = ['tap', 'hold-release', 'swipe', 'hold-steer', 'catch-drag', 'mark-fire', 'two-tap', 'timing', 'auto', 'finger-down'];

/** What an idea acts on. Today's twelve weapons all act on 'threats'. */
export const TARGETS = ['threats', 'launchers', 'sea', 'own-ships', 'loss-rule', 'enemy-aim', 'weather', 'drops', 'ammo', 'loaded-weapon', 'time'];

export const CATEGORY_RULES = {
  active: 'Takes over the main gun for 15 s; picking up another weapon (active or passive) replaces it. Good against some threats, poor against others, but every tap still hits.',
  passive: 'Your plain gun stays in your hands; it works on its own for 15 s. Blind spots are fine. Like an active, it is replaced by the next weapon you pick up.',
  boost: 'Drafted and dropped like a weapon, but picking it up never replaces the loaded weapon: it changes how everything you fire works for a while. Levels make it last longer (8, 11, then 15 s). A second boost replaces the first.',
};

/** Today's twelve, with the verb and target they use (all tap, all threats). */
export const TODAY = [
  ['flak', 'active'], ['thermo', 'active'], ['scatter', 'active'], ['shrapnel', 'active'], ['railgun', 'active'],
  ['boomerang', 'active'], ['tesla', 'active'], ['seeker', 'active'], ['well', 'active'], ['airstrike', 'active'],
  ['aegis', 'passive'], ['frigate', 'passive'],
].map(([id, cat]) => ({ id, cat, verb: cat === 'passive' ? 'auto' : 'tap', target: 'threats' }));

/** Round 1's ideas the player found too samey, and older cuts: no echo of these. */
export const ROUND1 = ['Net Launcher', 'Designator Rounds', 'Gatling Burst', 'Harpoon Gun', 'Mortar Barrage', 'Sidewinder Rounds', 'Combat Air Patrol', 'Barrage Balloons', 'Hunter Drones', 'Gunboat Screen', 'Speed Loader', 'Hot Rounds', 'Velocity Shells', 'Big Bore', 'Double Tap', 'Battle Stations'];
export const CUT_BEFORE = ['EMP Rounds', 'Hellfire Salvo', 'Smoke Shells', 'Decoy Flares', 'Sub Hunter', 'Cryo Rounds', 'Point-Defense Laser'];

export const IDEAS = [
  // ---------------------------------------------------------------- ACTIVE
  {
    id: 'lance', cat: 'active', status: 'keep', from: 'player', name: 'Charge Lance', max: 'Sunspear',
    verb: 'hold-release', target: 'threats', shape: 'charge', proto: 'lance', protoNote: 'the bot held on anything with 3+ hit points and tapped the rest; shots hit instantly',
    pitch: 'Tap for a quick bolt; hold to charge, let go to fire.',
    how: 'A tap fires a 1-hit bolt. Holding fills a ring on the carrier: let go at half (0.6 s) for a 3-hit bolt, full (1.2 s) for a 6-hit lance that pierces everything in line. One round a shot, whatever the charge.',
    strong: 'Heavies, motherships, bombers, rigs and the Citadel', weak: 'Swarms and fast missiles (no time to charge)',
    levels: ['Half 3, full 6', 'Charges a third faster', 'Sunspear: a full lance leaves a burning line for 2 s'],
    novel: 'Hold-and-release: the first weapon where how long you press matters. One round buys up to six hits, so it is the ammo answer to armour.',
  },
  {
    id: 'cutter', cat: 'active', status: 'keep', from: 'new', name: 'Laser Cutter', max: 'Searing Edge',
    verb: 'swipe', target: 'threats', shape: 'instant', proto: 'slice', protoNote: 'the bot swiped through the most urgent threat at its usual tap rate',
    pitch: 'Swipe across the sky: everything under your finger is cut.',
    how: 'Drag a finger across threats: everything within 30 px of the path (up to 320 px long) takes a hit, instantly. One round a swipe. A plain tap fires a normal shot.',
    strong: 'Swarms, lines and supersonic missiles (instant)', weak: 'Heavies and motherships (one hit a swipe)',
    levels: ['320 px, 1 hit', '420 px', 'Searing Edge: the cut stays lit for 1 s and burns what flies into it'],
    novel: 'A new verb, the swipe. In a busy moment the best swipe cuts 4.4 threats, against 2.1 for the best tap blast (field data).',
  },
  {
    id: 'turncoat', cat: 'active', status: 'keep', from: 'new', name: 'Turncoat Rounds', max: 'Mutiny',
    verb: 'tap', target: 'launchers', shape: 'instant', proto: 'hijack', protoNote: 'only the hits along the way home were modelled, not the silo going quiet at the end',
    pitch: 'Hack it: a hit drone or missile turns round and flies home.',
    how: 'A hit on a drone or a light missile (2 hp or less) takes it over: it turns and flies back the way it came, hitting what is in its path for 2 and its own silo, truck or sub at the end (silenced for 5 s). Heavies, aircraft and structures are too big to hack: they take a normal hit.',
    strong: 'Drones, guided and ballistic volleys, and the launchers behind them', weak: 'Heavies, aircraft, structures (normal hits only)',
    levels: ['Hacks 2 hp or less', 'A hacked missile flies home twice as fast', 'Mutiny: a hacked missile that reaches its silo silences it for the rest of the wave'],
    novel: 'Turns the enemy\'s own shot into yours, and the only active that reaches the launchers. On average 1.2 other threats are in the corridor behind a missile (field data).',
  },
  {
    id: 'wireguide', cat: 'active', status: 'keep', from: 'new', name: 'Wire-Guided Missile', max: 'Twin Wire',
    verb: 'hold-steer', target: 'threats', shape: 'sustained', proto: null,
    pitch: 'Fly the missile yourself: it follows your finger until you let go.',
    how: 'Press and hold: a missile launches and follows your finger while it stays down (fast, 700 px/s). Let go and it bursts: 3 hits, 90 px. One missile in the air at a time; a quick tap is a normal shot.',
    strong: 'Heavies, bombers, rigs and anything far away or behind land', weak: 'Many threats at once (one missile at a time)',
    levels: ['3 hits, 90 px', '4 hits, 110 px', 'Twin Wire: a second missile follows a second finger'],
    novel: 'Piloting: the first shot you steer after it leaves the gun. It can curve round an island to a rig or a bomber on its line.',
  },
  {
    id: 'grapnel', cat: 'active', status: 'keep', from: 'new', name: 'Grapnel', max: 'Wrecking Ball',
    verb: 'catch-drag', target: 'threats', shape: 'sustained', proto: null,
    pitch: 'Harpoon a threat, then swing it into the others.',
    how: 'Tap a threat: a cable from the carrier hooks it. While your finger is down it swings where you drag; anything it smacks takes 2 hits. Let go and it is flung, bursting where it lands. A heavy missile is the best ball. Tap with nothing to hook: a normal shot.',
    strong: 'Packs, and heavies (use the heavy as the ball)', weak: 'Lone fast missiles (a second and a half a swing)',
    levels: ['Swings for 2', 'The cable reaches twice as far', 'Wrecking Ball: the flung threat explodes for 3 in a 120 px blast'],
    novel: 'Physics: the threat itself becomes the weapon, and you aim it with a drag.',
  },
  {
    id: 'firecontrol', cat: 'active', status: 'keep', from: 'new', name: 'Fire Control', max: 'Full Broadside',
    verb: 'mark-fire', target: 'threats', shape: 'delayed', proto: null,
    pitch: 'Mark your targets, then the whole salvo launches at once.',
    how: 'Taps mark targets (a red diamond each, up to 6) without firing. 0.8 s after your last mark the gun launches a round at each, at double speed, and every round that kills also bursts (40 px). A mark on a threat less than a second from impact fires at once, as a normal shot, so nothing gets through on the wait. The rounds come from the rack as normal.',
    strong: 'Volleys and pairs of aircraft (all hit at the same moment)', weak: 'A lone fast missile (it only gets a normal shot)',
    levels: ['Up to 6 marks', 'Up to 8 marks, 0.5 s wait', 'Full Broadside: marked threats take 2 hits each'],
    novel: 'Plan, then fire: a tap that queues instead of shooting. It rewards reading the raid.',
  },
  {
    id: 'limpet', cat: 'active', status: 'keep', from: 'new', name: 'Limpet Charges', max: 'Daisy Chain',
    verb: 'tap', target: 'threats', shape: 'delayed', proto: null,
    pitch: 'Stick a bomb on it and let it fly into its friends.',
    how: 'A shot is a normal hit, and it leaves a charge stuck to the threat that goes off 1.2 s later: 2 hits to it and everything within 90 px. It rides along with the threat, so a mothership carries it into its own drones and a bomber over the missiles it drops.',
    strong: 'Motherships, bombers, formations and swarms that fly together', weak: 'Fast missiles (they hit before the fuse: just the normal hit)',
    levels: ['1.2 s fuse, 90 px', '0.9 s fuse, 110 px', 'Daisy Chain: anything the blast kills carries a fresh charge'],
    novel: 'The enemy carries your bomb. Where it goes off depends on where the threat flies, not where you tapped.',
  },
  {
    id: 'tidal', cat: 'active', status: 'keep', from: 'new', name: 'Tidal Cannon', max: 'Tsunami',
    verb: 'tap', target: 'sea', shape: 'sustained', proto: null,
    pitch: 'Shoot the sea: a wave rolls out and swamps what is on it.',
    how: 'A shot on open water raises a wave that rolls 300 px outward: fast boats, mines and surfaced subs it reaches are swamped, and low drones are knocked into the sea. Missiles fly over it (a shot at one is a normal hit). A wave that reaches your ships pushes them forward.',
    strong: 'Fast boats, mines, surfaced subs, drones', weak: 'Missiles and aircraft (normal hits only)',
    levels: ['300 px wave', '420 px, and it pushes threats back as it goes', 'Tsunami: the wave rolls the full width of the lane'],
    novel: 'Acts on the sea, not on a threat; the same wave helps your convoy.',
  },
  {
    id: 'cadence', cat: 'active', status: 'keep', from: 'new', name: 'Cadence Gun', max: 'War Drum',
    verb: 'timing', target: 'threats', shape: 'instant', proto: null,
    pitch: 'Fire on the beat for a triple-strength shot.',
    how: 'A ring pulses on the carrier every 0.6 s, with a drum on the sound. A shot fired on the pulse (within 0.12 s) hits for 3 and pierces; off the beat it is a normal shot.',
    strong: 'Heavies and lines, for a player who keeps the beat', weak: 'Swarms (the beat is too slow for many targets)',
    levels: ['3 on the beat', 'A wider beat window (0.18 s)', 'War Drum: four beats in a row and the fifth fires a free broadside'],
    novel: 'Rhythm: the first weapon that rewards when you tap, not only where.',
  },
  {
    id: 'chainshot', cat: 'active', status: 'keep', from: 'new', name: 'Chain Shot', max: 'Bolas Storm',
    verb: 'two-tap', target: 'threats', shape: 'instant', proto: null,
    pitch: 'Tap two threats: a chain links them and drags them together.',
    how: 'Tap one threat, then another within 300 px: a chained pair of shots flies between them and wraps them, and they are dragged into each other for 2 hits each and anything caught on the chain. A lone tap is a normal shot.',
    strong: 'Pairs: aircraft, guided volleys, a heavy with an escort', weak: 'Lone threats (it needs two)',
    levels: ['2 hits each', '400 px reach, 3 hits', 'Bolas Storm: a third tap adds a third link'],
    novel: 'A two-tap combo. Chain shot is real naval history: two cannonballs chained to cut a ship\'s rigging.',
  },
  // cut actives
  { id: 'fuse', cat: 'active', status: 'cut', name: 'Command Fuse', verb: 'two-tap', target: 'threats', shape: 'delayed', why: 'A shell you burst with a second tap is Flak or Thermobaric with extra steps.' },
  { id: 'ricochetA', cat: 'active', status: 'cut', name: 'Ricochet Gun', verb: 'tap', target: 'threats', shape: 'instant', why: 'Bouncing to the next threat is Tesla Arc.' },
  { id: 'decoy', cat: 'active', status: 'cut', name: 'Decoy Launcher', verb: 'tap', target: 'enemy-aim', shape: 'sustained', why: 'Decoy Flares were cut in round 3.' },
  { id: 'concussion', cat: 'active', status: 'cut', name: 'Concussion Cannon', verb: 'tap', target: 'threats', shape: 'instant', why: 'Pushing threats away is the Gravity Well run backwards.' },
  { id: 'rotary', cat: 'active', status: 'cut', name: 'Rotary Cannon', verb: 'finger-down', target: 'threats', shape: 'sustained', why: 'Hold to spray is the same verb as the player\'s Fire at Will boost; the boost gets it.' },
  { id: 'mirror', cat: 'active', status: 'cut', name: 'Mirror Shield', verb: 'tap', target: 'own-ships', shape: 'sustained', why: 'Bouncing a missile home is folded into Turncoat Rounds, which does it from a shot.' },
  { id: 'stasis', cat: 'active', status: 'cut', name: 'Stasis Field', verb: 'hold-release', target: 'time', shape: 'charge', why: 'A slow field is Cryo Rounds ("the freeze really doesn\'t matter").' },
  { id: 'portal', cat: 'active', status: 'cut', name: 'Portal Gun', verb: 'two-tap', target: 'threats', shape: 'sustained', why: 'Two portals and the paths between them would not read on a phone at 667×375.' },

  // --------------------------------------------------------------- PASSIVE
  {
    id: 'droneScreen', cat: 'passive', status: 'keep', from: 'player', name: 'Drone Screen', max: 'Hornet Nest',
    verb: 'auto', target: 'threats', shape: 'stream', proto: 'drones12',
    pitch: 'A steady stream of your own drones flies in from your side of the map and rams the threats.',
    how: 'A friendly drone launches from your edge of the map every 1.2 s (the bottom on most maps; the carrier\'s deck on Kesh and Gauntlet, where the bottom is enemy shore) and rams the threat closest to hitting a hull (one hit). Each goes for a different threat. 420 px/s, so supersonic and ballistic missiles outrun them.',
    strong: 'Drones, guided missiles, motherships\' mini-drones', weak: 'Supersonic and ballistic missiles (too fast); heavies (one hit a drone)',
    levels: ['One every 1.2 s', 'One every 0.9 s', 'Hornet Nest: each ram bursts, hitting everything within 50 px'],
    novel: 'A continuous stream from the map edge, not ships on station: it fills the sky between you and the raid.',
    tune: 'One drone every 0.7 s won {{drones.a}} of runs, among the strongest tested; one every 1.2 s won {{drones12.a}}, in line with the other strong ideas.',
  },
  {
    id: 'gunships', cat: 'passive', status: 'keep', from: 'player', name: 'Gunship Pair', max: 'Hellfire Wing',
    verb: 'auto', target: 'threats', shape: 'sustained', proto: 'gunship', protoNote: 'the two helicopters fired alternately from either end of the convoy',
    pitch: 'Two attack helicopters hover over the convoy and rocket the thickest cluster.',
    how: 'Two helicopters follow the convoy, one either end. Each fires a rocket pod every 1.4 s at the densest spot within 380 px: a 65 px blast, one hit. They stay with the ships, so threats far from the convoy are not theirs.',
    strong: 'Swarms and packs closing on the convoy', weak: 'Anything far from the ships; supersonic missiles (no time to aim)',
    levels: ['Every 1.4 s', 'Every 1.0 s', 'Hellfire Wing: a third helicopter, and each pod hits for 2'],
    novel: 'Area damage that moves with the convoy, unlike frigates, which hold station and fire single shots.',
  },
  {
    id: 'bomberWing', cat: 'passive', status: 'keep', from: 'player', name: 'Bomber Wing', max: 'Carpet Raid',
    verb: 'auto', target: 'launchers', shape: 'periodic', proto: 'bomber',
    pitch: 'Bombers hit the enemy shore: trucks are destroyed, silos and tunnels go quiet.',
    how: 'A bomber crosses every 6 s. It destroys a missile truck on screen; if there is none, it bombs the silo or tunnel with the most launches coming and silences it for 6 s. Launches due in that time are cancelled, not delayed. Land only: subs are the Hunter-Killer\'s.',
    strong: 'Trucks, tunnels and silos: the launches before they happen', weak: 'Everything already in the air; subs',
    levels: ['Every 6 s', 'Every 4.5 s', 'Carpet Raid: each pass silences two silos'],
    novel: 'Stops threats before they exist. Silos fire 62% of launches and trucks 15%; today nothing touches a silo, and only Carpet Strike (Air Strike at MAX) can hit a truck.',
    tune: 'Cancelling the launches won {{bomber.a}} of runs ({{none.a}} without); delaying the same launches won {{bomberDelay.a}}: they just pile up later. Silenced must mean cancelled.',
  },
  {
    id: 'hunterKiller', cat: 'passive', status: 'keep', from: 'new', name: 'Hunter-Killer Sub', max: 'Wolfpack',
    verb: 'auto', target: 'sea', shape: 'periodic', proto: 'hunter',
    pitch: 'Your own submarine stalks the enemy\'s at sea.',
    how: 'A friendly sub shadows the convoy underwater (its periscope is the only sign). Every 3 s it torpedoes an enemy sub that is surfacing, before its salvo, or a fast boat or mine; against the Dreadnought it hits for 1 every 4 s. Nothing in the air.',
    strong: 'Enemy subs, fast boats, mines, the Dreadnought', weak: 'Everything in the air',
    levels: ['Every 3 s', 'Every 2 s', 'Wolfpack: a second sub, and a torpedo hit on the Dreadnought does 3'],
    novel: 'Fights under the sea, a layer no weapon touches today. On Strait and Harbor a third of launches come from subs.',
  },
  {
    id: 'helm', cat: 'passive', status: 'keep', from: 'new', name: 'Evasive Helm', max: 'Ghost Fleet',
    verb: 'auto', target: 'own-ships', shape: 'reactive', proto: 'helm',
    pitch: 'Your ships dodge: a hull about to be hit swerves out of the way.',
    how: 'When a ballistic, cluster, heavy or strafing run is about to hit a hull, that ship swerves clear (once every 4 s a ship). It shoots nothing. Homing threats (guided, drones) follow it, and narrow lanes leave no room to swerve.',
    strong: 'Ballistic, cluster and heavy missiles, strafing runs', weak: 'Guided missiles and drones (they home); narrow lanes (Needle, Saltgate)',
    levels: ['Once every 4 s a ship', 'Every 3 s', 'Ghost Fleet: a dodging ship also drops a decoy the miss chases'],
    novel: 'Defends by moving your ships, not by shooting. Ballistic, cluster, heavy and strafer hits are about half of all sinkings (field data).',
  },
  {
    id: 'tug', cat: 'passive', status: 'keep', from: 'new', name: 'Salvage Tug', max: 'Rescue Fleet',
    verb: 'auto', target: 'loss-rule', shape: 'reactive', proto: 'tug', protoNote: 'it saved 2 ships a run in total, not 2 per pickup, so this understates it',
    pitch: 'A tug catches a sinking ship and tows it home: it doesn\'t count as lost.',
    how: 'A tug sails with the convoy. The next two ships that sink while it is out are caught before they go down and towed off: they don\'t count against the six-ship limit (and still deliver half their cargo). It does no fighting.',
    strong: 'Bad moments: a strafing run or a lucky salvo', weak: 'Everything; it never fires',
    levels: ['Saves 2', 'Saves 2 and returns them repaired next wave', 'Rescue Fleet: saves 3'],
    novel: 'Changes the loss rule itself. Playtest logs ended runs at full carrier health on the six-ship limit; this is aimed straight at that.',
  },
  {
    id: 'orbital', cat: 'passive', status: 'keep', from: 'new', name: 'Orbital Strike', max: 'Sky Spear',
    verb: 'auto', target: 'threats', shape: 'periodic', proto: 'orbital',
    pitch: 'A satellite picks the biggest thing on screen and spears it from space.',
    how: 'Every 2.5 s a beam comes down on the toughest threat on screen (most hit points) for 3 hits. It always picks the biggest, so a swarm gets nothing.',
    strong: 'Heavies, motherships, bombers, rigs, generators, the Dreadnought', weak: 'Swarms and anything small (always picks the biggest)',
    levels: ['3 hits every 2.5 s', 'Every 1.8 s', 'Sky Spear: the beam stays 1 s and sweeps to the next biggest'],
    novel: 'A targeting rule no weapon has: biggest first. It frees your gun for the small stuff.',
  },
  {
    id: 'jammer', cat: 'passive', status: 'keep', from: 'new', name: 'Jammer Ship', max: 'Blackout',
    verb: 'auto', target: 'enemy-aim', shape: 'sustained', proto: null,
    pitch: 'An electronic-warfare ship scrambles locks around the convoy.',
    how: 'A jammer sails with the convoy inside a visible 250 px bubble. Guided missiles and drones that enter lose their lock and wander for 2 s; a supersonic\'s lock-on line takes 1 s longer. Ballistic shots (no lock), heavies and aircraft (crewed) are unaffected, and the jammer kills nothing.',
    strong: 'Guided missiles, drones, supersonic lock-ons', weak: 'Ballistic, heavies, aircraft; it never kills',
    levels: ['250 px bubble', '330 px', 'Blackout: a jammed missile that wanders out turns back at its own side'],
    novel: 'Acts on the enemy\'s aim, not its health: the threats are still there, just lost. Not Decoy Flares (one-shot flares that were cut): this is a lasting zone.',
    echo: 'Decoy Flares (cut, round 3)',
  },
  {
    id: 'storm', cat: 'passive', status: 'keep', from: 'new', name: 'Storm Front', max: 'Hurricane',
    verb: 'auto', target: 'weather', shape: 'sustained', proto: null,
    pitch: 'Call in the weather: a squall rolls across, lightning hits what flies through it.',
    how: 'A storm cell (about 300 px wide) drifts across the map with the wind. Lightning strikes a drone or aircraft inside it every 0.8 s, and missiles crossing it are blown off course (half of them miss). You can\'t steer it.',
    strong: 'Drones and aircraft inside the cell; missiles crossing it', weak: 'Everything outside the cell; it goes where the wind blows',
    levels: ['300 px cell', 'A bigger, slower cell', 'Hurricane: two cells'],
    novel: 'Weather as a weapon: big and unaimed, so where it drifts changes where you shoot.',
  },
  {
    id: 'ammoShip', cat: 'passive', status: 'keep', from: 'new', name: 'Ammunition Ship', max: 'Arsenal Ship',
    verb: 'auto', target: 'ammo', shape: 'sustained', proto: null,
    pitch: 'A supply ship joins the convoy: your rack reloads twice as fast, but the enemy goes for it.',
    how: 'An ammunition ship sails in the middle of the convoy. While it floats, the rack reloads twice as fast. Missiles prefer it as a target (a decoy, by its nature), and if it is sunk the bonus ends (it doesn\'t count as a lost ship).',
    strong: 'Running dry: it is the reload; it also draws fire off the cargo ships', weak: 'Nothing by itself; you must protect it',
    levels: ['Reload ×2, 4 hits to sink', 'Reload ×2.5, 6 hits', 'Arsenal Ship: it also fires a round of your loaded weapon every 2 s'],
    novel: 'Risk and reward on the water: a ship worth protecting that pays you back in ammo.',
  },
  // cut passives
  { id: 'goalkeeper', cat: 'passive', status: 'cut', name: 'Goalkeeper Destroyer', verb: 'auto', target: 'own-ships', shape: 'reactive', why: 'A ship that soaks hits is the Shield power-up plus Aegis.' },
  { id: 'awacs', cat: 'passive', status: 'cut', name: 'AWACS', verb: 'auto', target: 'threats', shape: 'sustained', why: 'Launch warnings and faster shots at tracked threats are the radar tower (Lee of Marrow).' },
  { id: 'minelayer', cat: 'passive', status: 'cut', name: 'Minelayer', verb: 'auto', target: 'sea', shape: 'sustained', why: 'Round 1\'s Sea Mines; Hunter-Killer covers surface threats.' },
  { id: 'commando', cat: 'passive', status: 'cut', name: 'Commando Raid', verb: 'auto', target: 'launchers', shape: 'periodic', why: 'Folded into Bomber Wing: two ideas for silenced silos is one too many.' },
  { id: 'repairShip', cat: 'passive', status: 'cut', name: 'Repair Ship', verb: 'auto', target: 'own-ships', shape: 'periodic', why: 'Patching hulls is the Armory\'s Damage Control.' },
  { id: 'ciws', cat: 'passive', status: 'cut', name: 'CIWS Turret', verb: 'auto', target: 'threats', shape: 'sustained', why: 'The Armory\'s Point Defense.' },

  // ----------------------------------------------------------------- BOOST
  {
    id: 'fireAtWill', cat: 'boost', status: 'keep', from: 'player', name: 'Fire at Will', max: null,
    verb: 'finger-down', target: 'ammo', shape: 'sustained', proto: 'fireatwill', protoNote: 'the bit a bot can use: 6 more rounds and twice the reload; the bot never holds, so full-auto itself was not tested',
    pitch: 'Hold to fire full-auto, with a bigger magazine.',
    how: 'While it lasts, holding fires every 0.15 s instead of every 0.6 s, the rack holds 6 more rounds and reloads twice as fast. Whatever is loaded fires that fast.',
    strong: 'Big raids, running dry', weak: 'Wasted on spraying: it is ammo that wins, not taps',
    novel: 'The player\'s idea: today\'s hold-to-fire becomes a real full-auto. Not Overdrive (5 s of free rounds): this is rate and capacity while it lasts.',
    echo: 'Overdrive power-up (5 s of free rounds)',
  },
  {
    id: 'supplyRun', cat: 'boost', status: 'keep', from: 'player', name: 'Supply Run', max: null,
    verb: 'auto', target: 'drops', shape: 'sustained', proto: 'supply', protoNote: 'drop chances ×3; the bot collects drops anyway, so flying to the carrier was not tested',
    pitch: 'For a while every kill is three times as likely to drop something, and drops fly to you.',
    how: 'Power-up and weapon drop chances ×3, and every drop floats straight to the carrier (no tap to collect).',
    strong: 'Turning a raid into a stockpile', weak: 'Quiet moments (no kills, no drops)',
    novel: 'The player\'s "Up Power": a boost that feeds the drop economy rather than the gun. Pickups that fly to you mean no taps away from the fight.',
  },
  {
    id: 'scavenger', cat: 'boost', status: 'keep', from: 'new', name: 'Scavenger Rounds', max: null,
    verb: 'tap', target: 'ammo', shape: 'sustained', proto: 'scavenger',
    pitch: 'Every kill gives its round back.',
    how: 'While it lasts, a shot that kills refunds its round to the rack. Misses still cost.',
    strong: 'Careful aim: a sharp player never runs dry', weak: 'Spraying (misses aren\'t refunded)',
    novel: 'Accuracy turns into ammo. It should help an accurate player far more than a tap-happy one, and it does (below).',
  },
  {
    id: 'overclock', cat: 'boost', status: 'keep', from: 'new', name: 'Overclock', max: null,
    verb: 'auto', target: 'loaded-weapon', shape: 'sustained', proto: 'overclock',
    pitch: 'The loaded weapon jumps a level, and its timer stops.',
    how: 'While it lasts, the loaded weapon plays one level higher (a level 3 one gets its MAX behaviour if it doesn\'t have it) and its 15 s timer stops. With nothing loaded, it waits for the next weapon you pick up.',
    strong: 'A good weapon at the right moment', weak: 'Nothing loaded (it waits)',
    novel: 'Acts on the weapon you hold: a free taste of an evolution before you draft it.',
  },
  {
    id: 'dualWield', cat: 'boost', status: 'keep', from: 'new', name: 'Dual Wield', max: null,
    verb: 'tap', target: 'loaded-weapon', shape: 'sustained', proto: null,
    pitch: 'The next weapon you pick up joins the loaded one instead of replacing it.',
    how: 'While it lasts, the next weapon pickup doesn\'t replace the loaded one: both stay loaded together for the rest of their time, and every tap fires both (Flak and Tesla: a cloud that arcs). Passives join too.',
    strong: 'Combos: two weapons at once', weak: 'No second weapon pickup before it runs out',
    novel: 'Breaks the one-weapon rule for a moment: the combo maker. The rule "a boost never overrides" becomes "and here, nothing overrides".',
  },
  {
    id: 'hotStreak', cat: 'boost', status: 'keep', from: 'new', name: 'Hot Streak', max: null,
    verb: 'tap', target: 'threats', shape: 'sustained', proto: 'streak', protoNote: 'the extra damage only; piercing at 10 was not modelled',
    pitch: 'Hit, hit, hit: a streak of hits makes every shot hit harder.',
    how: 'While it lasts, hits in a row build heat on the rail: after 5, shots do double; after 10, triple and they pierce. A tap that hits nothing resets the streak.',
    strong: 'A sharp player in a big raid', weak: 'Tapping everywhere (a miss resets it)',
    novel: 'Risk on every tap: chase the streak or play safe. Like Scavenger, it pays the accurate player (below).',
  },
  {
    id: 'wildCard', cat: 'boost', status: 'keep', from: 'new', name: 'Wild Card', max: null,
    verb: 'tap', target: 'loaded-weapon', shape: 'random', proto: null,
    pitch: 'Every plain shot is a random weapon at its MAX.',
    how: 'While it lasts and no weapon is loaded, each tap fires a random weapon\'s level 3 (MAX) shot: a Daisy Cutter, then a Mass Driver, then Twin Blades. If a weapon is loaded, it waits until that runs out.',
    strong: 'Anything, by luck; and a preview of every evolution', weak: 'You don\'t choose: a Railgun beam at a swarm',
    novel: 'Randomness and discovery: it shows a player what every MAX does.',
  },
  {
    id: 'wingman', cat: 'boost', status: 'keep', from: 'new', name: 'Wingman', max: null,
    verb: 'tap', target: 'threats', shape: 'echo', proto: 'wingman', protoNote: 'a second hit on the same target 0.35 s later; the jet\'s different starting point was not modelled',
    pitch: 'A friendly jet copies every shot you take, from the other side of the map.',
    how: 'While it lasts, every shot you fire (whatever is loaded) is fired again by a jet from the screen edge nearest the target, 0.3 s later.',
    strong: 'Far threats (the copy starts nearer) and anything that takes two hits', weak: 'Nothing extra on its own; it doubles what you do',
    novel: 'A second gun position: shots that come from the other side of the map.',
  },
  {
    id: 'shore', cat: 'boost', status: 'keep', from: 'new', name: 'Shore Bombardment', max: null,
    verb: 'tap', target: 'launchers', shape: 'sustained', proto: 'shoreA', protoNote: 'measured with a player who shoots early; see the results table for one who doesn\'t',
    pitch: 'Hit a threat as it launches and the hit carries on to whatever fired it.',
    how: 'While it lasts, any shot (whatever is loaded) that hits a threat within 350 px of where it was launched also hits its launcher: a truck there is destroyed, a silo there goes quiet for 4 s (its launches cancelled).',
    strong: 'Trucks and busy silos, if you shoot early', weak: 'Late shots near your ships (nothing to carry on to)',
    novel: 'Gives every weapon a second target, the shore. It pays most if you change where you shoot: a player who shoots early won {{shoreA.a}} of runs ({{none.a}} without it), one who kept shooting late {{shore.a}}.',
  },
  {
    id: 'focus', cat: 'boost', status: 'keep', from: 'new', name: 'Focus', max: null,
    verb: 'finger-down', target: 'time', shape: 'sustained', proto: null,
    pitch: 'Time slows while your finger is on the screen.',
    how: 'A bank of slow motion, as long as the boost lasts (the whole game at half speed), spent only while a finger is down. Lift it to save the rest.',
    strong: 'The moment everything arrives at once', weak: 'Long raids (the bank runs out)',
    novel: 'You choose when time slows. Not Time Warp (4 s, threats only, starts the moment you collect it).',
    echo: 'Time Warp power-up (4 s, threats only)',
  },
  // cut boosts
  { id: 'volatile', cat: 'boost', status: 'cut', name: 'Volatile Rounds', verb: 'tap', target: 'threats', shape: 'instant', proto: 'volatile', why: 'Every kill explodes. Small effect ({{volatile.da}} accurate, {{volatile.ds}} tap-happy): fewer than 6 threats are on screen about 90% of the time, so a blast rarely reaches a second threat.' },
  { id: 'adrenaline', cat: 'boost', status: 'cut', name: 'Adrenaline', verb: 'tap', target: 'threats', shape: 'sustained', proto: 'adrenaline', why: 'Stronger the more threats on screen. {{adrenaline.da}} accurate, {{adrenaline.ds}} tap-happy, for the same reason, and one more "your shots do more" boost.' },
  { id: 'ricochet', cat: 'boost', status: 'cut', name: 'Ricochet Rounds', verb: 'tap', target: 'threats', shape: 'instant', proto: 'ricochet', why: 'A miss bounces to the nearest threat. {{ricochet.da}} accurate, {{ricochet.ds}} tap-happy: forgiving misses is a job for an aim-assist setting, not a feature.' },
  { id: 'overwatch', cat: 'boost', status: 'cut', name: 'Overwatch', verb: 'auto', target: 'threats', shape: 'periodic', proto: 'overwatch', why: 'The gun fires itself. {{overwatch.da}} accurate, {{overwatch.ds}} tap-happy: it spends the same rack, and the rack, not tapping, is the limit.' },
  { id: 'lockOn', cat: 'boost', status: 'cut', name: 'Lock-On', verb: 'tap', target: 'threats', shape: 'sustained', why: 'Aim assist: useful, but no new decision. Better as an accessibility setting.' },
  { id: 'overtime', cat: 'boost', status: 'cut', name: 'Overtime', verb: 'auto', target: 'loaded-weapon', shape: 'sustained', why: 'Kills add time to the loaded weapon: a weaker Overclock.' },
  { id: 'bounty', cat: 'boost', status: 'cut', name: 'Bounty', verb: 'auto', target: 'drops', shape: 'sustained', why: 'Folded into Supply Run.' },
  { id: 'longShot', cat: 'boost', status: 'cut', name: 'Long Shot', verb: 'tap', target: 'threats', shape: 'sustained', proto: 'longshotA', why: 'Triple damage far from the carrier. It works ({{longshotA.a}} when the player shoots early), but it is a third "your shots do more if…" boost beside Hot Streak and Wingman. Shore Bombardment asks for the same early shot, with a visible effect, and measured higher ({{shoreA.a}}).' },
  { id: 'bigTips', cat: 'boost', status: 'cut', name: 'Explosive Tips', verb: 'auto', target: 'threats', shape: 'sustained', why: 'Bigger blasts: a number, not a feature (round 1\'s Big Bore).' },
];
