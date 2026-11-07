// Enemy ideas, round 1 (brainstorm data; nothing here is in the game).
//
// The player (2026-11-07): "next I think we need to do the same process we
// did but with the enemy weapons. We need three different types of
// categories and then make subcategories as well for all the weapons. Then
// come up with new weapons for the enemy … Pick the best from that group
// and then come up with 10 weapons as well that a different than this list
// … make like 20 and then pick the best from that … Be Novel and come up
// with new ideas … so they are not just another version of another weapon"
//
// This module is the single source for the round: the taxonomy, today's
// enemies sorted into it, the player's 18 ideas (their text kept exactly),
// and the new ideas (kept and cut). check.mjs tests it; page.mjs and gen.mjs
// build the review page and the design doc from it.
//
// Every enemy is tagged on three axes, so "different" can be checked rather
// than claimed (the same method as the weapons' round 2):
// - answer: what the player has to do about it;
// - pressure: what it takes away from the player;
// - shape: how it plays out in time.

export const ROUND_DATE = '2026-11-07';

/** What the player does about it. */
export const ANSWERS = {
  shoot: 'Shoot it down',
  source: 'Kill the thing doing it',
  time: 'Wait for the right moment',
  pick: 'Choose which one to shoot',
  place: 'Choose where it dies',
  hold: 'Hold fire',
  race: 'Get there first',
  pinpoint: 'Hit one exact spot',
  reposition: 'Move the convoy (formation)',
  throttle: 'Change the convoy’s speed',
};

/** What it takes from the player. */
export const PRESSURES = {
  hulls: 'Your ships’ hulls',
  carrier: 'Your carrier',
  shots: 'Your shots in the air',
  ammo: 'Your rack (ammo and reload)',
  sight: 'What you can see or predict',
  aim: 'Where the enemy aims',
  space: 'Safe water in the lane',
  durability: 'How long enemies survive',
  drops: 'Your pickups',
  allies: 'Your helpers (passives, allied guns)',
  future: 'Later raids',
  capture: 'Your ships themselves (taken, not sunk)',
};

/** How it plays out in time. */
export const SHAPES = {
  instant: 'Hits once',
  delayed: 'A tell, then the hit',
  lasting: 'Stays until dealt with',
  escalating: 'Gets worse the longer it lives',
  trigger: 'Waits for a condition',
};

// ---------------------------------------------------------------------------
// The taxonomy: three categories, each with subcategories. Like the player's
// own weapons (Active / Passive / Boost), they split by role: what the enemy
// does in the fight, which tells the player what kind of answer it needs.

export const CATEGORIES = [
  {
    id: 'strike',
    name: 'Strikes',
    rule: 'Flies or sails at a hull and does the damage itself. You answer it by shooting it, or by where your ships are when it lands. Once it is gone, it is gone.',
    subs: [
      { id: 'swarm', name: 'Swarm', rule: 'Many and weak: the problem is how many at once.' },
      { id: 'missile', name: 'Precision', rule: 'One at a time, aimed at one ship: the problem is reaction.' },
      { id: 'tough', name: 'Tough', rule: 'Takes many hits: the problem is how much fire it soaks up.' },
      { id: 'trick', name: 'Trick', rule: 'The moment you shoot it matters: it splits, ignites or punishes the wrong timing.' },
      { id: 'sea', name: 'Sea', rule: 'On or under the water: in the lane itself, not the sky.' },
    ],
  },
  {
    id: 'platform',
    name: 'Platforms',
    rule: 'Launches or fires from a distance, and stays to do it again. Where your gun can kill it, that stops what it would do next (what it already launched keeps coming); where it can’t, you answer what it launches. Its subcategory says where to look for it.',
    subs: [
      { id: 'air', name: 'Air', rule: 'Aircraft: they come and go, and can be shot down.' },
      { id: 'sea', name: 'Sea', rule: 'Ships, subs and sea structures.' },
      { id: 'shore', name: 'Shore', rule: 'On enemy land: sites, trucks and guns.' },
    ],
  },
  {
    id: 'support',
    name: 'Support',
    rule: 'Never hits a hull itself. It changes the rules for the rest of the raid: what you can see, what survives, what your gun and drops can do, or where the enemy aims. Kill it and the rule goes.',
    subs: [
      { id: 'shield', name: 'Shield', rule: 'Keeps other enemies alive.' },
      { id: 'deceive', name: 'Deceive', rule: 'Hides or fakes what you see.' },
      { id: 'sabotage', name: 'Sabotage', rule: 'Works on your kit: your rack, your shots, your drops, your helpers.' },
      { id: 'coordinate', name: 'Coordinate', rule: 'Makes the rest of the enemy smarter or bigger.' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Today's enemies, sorted into the taxonomy. `where`: how it shows up today.

export const TODAY = [
  { id: 'drone', name: 'Attack drone', cat: 'strike', sub: 'swarm', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'Slow, one hit, comes in swarms.' },
  { id: 'minidrone', name: 'Mini-drone', cat: 'strike', sub: 'swarm', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'Released by a mothership.' },
  { id: 'bomblet', name: 'Bomblet', cat: 'strike', sub: 'swarm', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'What a cluster missile splits into.' },
  { id: 'guided', name: 'Guided missile', cat: 'strike', sub: 'missile', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'Two hits; turns hard near its target.' },
  { id: 'ballistic', name: 'Ballistic missile', cat: 'strike', sub: 'missile', answer: 'shoot', pressure: 'hulls', shape: 'delayed', what: 'Arcs onto a predicted point shown by a reticle; its blast spills onto ships beside it.' },
  { id: 'supersonic', name: 'Supersonic missile', cat: 'strike', sub: 'missile', answer: 'shoot', pressure: 'hulls', shape: 'delayed', what: 'Shows a lock line on the rail, then flies very fast.' },
  { id: 'heavy', name: 'Heavy cruise missile', cat: 'strike', sub: 'tough', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'Slow, eight hits. A direct hit sinks any ship, or takes half the carrier’s health.' },
  { id: 'mothership', name: 'Drone mothership', cat: 'platform', sub: 'air', answer: 'source', pressure: 'hulls', shape: 'escalating', what: 'Five hits; releases mini-drones as it flies toward its target.' },
  { id: 'cluster', name: 'Cluster missile', cat: 'strike', sub: 'trick', answer: 'time', pressure: 'hulls', shape: 'delayed', what: 'Splits into bomblets near its target: kill it before it does.' },
  { id: 'mine', name: 'Drifting mine', cat: 'strike', sub: 'sea', answer: 'shoot', pressure: 'space', shape: 'lasting', what: 'Drifts across the lane on the current (Sowers’ Reach).' },
  { id: 'fastboat', name: 'Fast attack boat', cat: 'strike', sub: 'sea', answer: 'shoot', pressure: 'hulls', shape: 'instant', what: 'Bursts out of a cove to ram (Smugglers’ Coves).' },
  { id: 'strafer', name: 'Strike jet', cat: 'platform', sub: 'air', answer: 'source', pressure: 'hulls', shape: 'delayed', what: 'A 2.2 s warning arrow and flight band, then a gun run along its line. Three hits.' },
  { id: 'bomber', name: 'Missile bomber', cat: 'platform', sub: 'air', answer: 'source', pressure: 'hulls', shape: 'delayed', what: 'Warned like the jet; drops two light guided missiles on its pass. Three hits.' },
  { id: 'sub', name: 'Submarine', cat: 'platform', sub: 'sea', answer: 'shoot', pressure: 'hulls', shape: 'delayed', what: 'Periscope, then surfaces and fires a salvo. Your gun can’t hit it; Carpet Strike (Air Strike at MAX) and Bomber Wing at MAX can.' },
  { id: 'rig', name: 'Oil rig', cat: 'platform', sub: 'sea', answer: 'source', pressure: 'hulls', shape: 'lasting', what: 'Launches from the sea (The Rig Field). Forty hits; down for good.' },
  { id: 'dreadnought', name: 'Dreadnought', cat: 'platform', sub: 'sea', answer: 'source', pressure: 'hulls', shape: 'lasting', what: 'A battleship steams through and fires broadsides. Fifty hits.' },
  { id: 'silo', name: 'Launch site', cat: 'platform', sub: 'shore', answer: 'shoot', pressure: 'hulls', shape: 'lasting', what: 'The shore bases every raid comes from, lit up during a raid’s warning. Your gun can’t hit them; Bomber Wing silences them.' },
  { id: 'popup', name: 'Missile truck', cat: 'platform', sub: 'shore', answer: 'shoot', pressure: 'hulls', shape: 'delayed', what: 'Drives to the shore, raises its launcher, fires, backs off. Your gun can’t hit it; Bomber Wing destroys it.' },
  { id: 'runner', name: 'Shore runner', cat: 'platform', sub: 'shore', answer: 'shoot', pressure: 'hulls', shape: 'lasting', what: 'Drives the whole coast road, stopping to fire.' },
  { id: 'citadel', name: 'The Citadel', cat: 'platform', sub: 'shore', answer: 'source', pressure: 'hulls', shape: 'lasting', what: 'The fortress on Citadel of Vey; shielded until its generators fall.' },
  { id: 'generator', name: 'Shield generator', cat: 'support', sub: 'shield', answer: 'source', pressure: 'durability', shape: 'lasting', what: 'Shields the Citadel until all three are down.' },
];

// ---------------------------------------------------------------------------
// The arsenal the counters name: the 29 weapons kept by the lock-in build
// (PR #127), so a counter never names a cut weapon.

export const ARSENAL = {
  airstrike: 'Air Strike', shrapnel: 'Shrapnel Shell', frigate: 'Frigate Escort', thermo: 'Thermobaric Shell', scatter: 'Scattergun', boomerang: 'Boomerang',
  flak: 'Flak Cannon', seeker: 'Seeker Pod', aegis: 'Aegis Launchers', well: 'Gravity Well', railgun: 'Railgun', tesla: 'Tesla Arc',
  lance: 'Charge Lance', cutter: 'Laser Cutter', grapnel: 'Grapnel', cadence: 'Cadence Gun',
  droneScreen: 'Drone Screen', gunships: 'Gunship Pair', bomberWing: 'Bomber Wing', orbital: 'Orbital Strike',
  supplyRun: 'Supply Run', overclock: 'Overclock', dualWield: 'Dual Wield', wildCard: 'Wild Card', focus: 'Focus', overdrive: 'Overdrive', timeWarp: 'Time Warp', shield: 'Shield', fullSteam: 'Full Steam',
};

// ---------------------------------------------------------------------------
// The player's 18 ideas. `said` is their text, exactly as sent. `yours`: the
// list itself marked it "your idea". `rec`: my read (pick / maybe / merge /
// skip), with the reason; the player's mark decides.

export const PLAYER = [
  {
    id: 'p-rocket-truck', n: 1, yours: true, name: 'Rocket Artillery Truck', cat: 'platform', sub: 'shore', answer: 'source', pressure: 'hulls', shape: 'delayed',
    said: 'A truck drives onto the shore, stops, and slowly raises its launcher. Once ready, it repeatedly fires rockets too fast to intercept. Normal interceptors can target and destroy the truck.\n\nThe decision: interrupt whatever else you’re doing and kill the source. Its setup animation gives you a fair opportunity before the first rocket, and destroying it prevents subsequent shots.',
    tell: 'The slow launcher raise.', counters: ['railgun', 'lance', 'bomberWing', 'airstrike'],
    closest: 'Missile truck: today your gun can’t hit a truck, and its missiles can be shot. This flips both: the truck is the target, the rockets aren’t.',
    cost: 'medium', costWhy: 'Trucks exist; new: a truck your gun can hit, and rockets that ignore interceptors.',
    rec: 'pick', why: 'The first projectile your gun can’t stop, from a source you can kill in a few hits mid-raid (the rigs, Dreadnought and Citadel take 40–50). The clearest “drop everything” moment in the list.',
  },
  {
    id: 'p-stealth-strafer', n: 2, yours: true, name: 'Stealth Strafer', cat: 'platform', sub: 'air', answer: 'shoot', pressure: 'sight', shape: 'delayed',
    said: 'A stealth jet enters without the usual advance warning, arrow, or flight-path band. It suddenly appears and makes a gun run across the convoy.\n\nThe decision: react to the aircraft itself. It should still have a short visible approach before firing, so surprise creates a reaction challenge instead of an unavoidable hit.',
    tell: 'Only the jet itself, on its short run-in.', counters: ['cutter', 'scatter', 'aegis', 'shield'],
    closest: 'Strike jet, without its 2.2 s warning arrow and band.',
    cost: 'small', costWhy: 'The strike jet with its warning switched off.',
    rec: 'merge', why: 'Strong as a twist, thin as its own enemy. With #3: one “Stealth” trait that any aircraft can carry, so it lands on the jet, the bomber and the new helicopter alike.',
  },
  {
    id: 'p-stealth-bomber', n: 3, yours: true, name: 'Stealth Bomber', cat: 'platform', sub: 'air', answer: 'pick', pressure: 'sight', shape: 'delayed',
    said: 'An unannounced bomber appears and begins releasing guided missiles after a short run-in. Destroying the bomber prevents the rest of its payload from launching.\n\nThe decision: shoot the incoming missiles or spend those shots on the bomber. Unlike the stealth strafer, its released weapons remain interceptable even after it escapes.',
    tell: 'Only the bomber itself.', counters: ['railgun', 'seeker', 'aegis'],
    closest: 'Missile bomber, without its warning.',
    cost: 'small', costWhy: 'The missile bomber with its warning switched off.',
    rec: 'merge', why: 'Same as #2: best as the Stealth trait on the existing bomber.',
  },
  {
    id: 'p-attack-heli', n: 4, yours: true, name: 'Attack Helicopter', cat: 'platform', sub: 'air', answer: 'source', pressure: 'hulls', shape: 'lasting',
    said: 'A helicopter enters, takes up a hovering position, and repeatedly fires small missile volleys. It has substantial health and occasionally relocates between firing positions.\n\nThe decision: commit sustained fire to remove a persistent problem, while still answering other threats. Its missiles stay interceptable, so leaving it alive is costly rather than fatal.',
    tell: 'It arrives and settles; the hover spot is visible.', counters: ['lance', 'railgun', 'gunships', 'orbital'],
    closest: 'Drone mothership: it also stays in the air and keeps launching, but drifts at its target; jets and bombers pass through once.',
    cost: 'medium', costWhy: 'The Gunship Pair’s new flight model (the lock-in build, PR #127) already does the flying; it becomes an enemy that hovers and fires volleys.',
    rec: 'pick', why: 'An aircraft that holds a firing position and moves between them, rather than flying a line or drifting in: “sustained fire” becomes a choice you make while a raid is still coming.',
  },
  {
    id: 'p-sprint-drones', n: 5, yours: true, name: 'Sprint Drones', cat: 'strike', sub: 'swarm', answer: 'time', pressure: 'hulls', shape: 'trigger',
    said: 'Small, fragile drones approach at normal speed, then visibly ignite a booster and accelerate toward a ship. One hit destroys each drone.\n\nThe decision: pick them off before their sprint. Their threat comes from timing and speed, rather than simply needing more shots than regular drones.',
    tell: 'The booster flare before the sprint.', counters: ['flak', 'cutter', 'scatter', 'droneScreen'],
    closest: 'Attack drone, with a second speed.',
    cost: 'small', costWhy: 'A drone with a speed change at a distance from its target.',
    rec: 'pick', why: 'Cheap to build and reads at a glance: a swarm with a deadline, which changes how you sort it.',
  },
  {
    id: 'p-jammer', n: 6, name: 'Jammer Drone', cat: 'support', sub: 'deceive', answer: 'pick', pressure: 'sight', shape: 'lasting',
    said: 'A support drone accompanies a raid. Nearby enemies lose their target indicators and predicted paths, although their actual bodies remain visible and manually targetable.\n\nThe decision: spend a shot restoring clarity or keep fighting through the interference. It disrupts information without disabling your controls or making enemies invulnerable.',
    tell: 'A static ring around it; the threats inside lose their lines.', counters: ['railgun', 'seeker', 'orbital'],
    closest: 'Night on The Lantern hides threats map-wide; this is a moving bubble you can kill.',
    cost: 'small', costWhy: 'The game draws some of these today (the ballistic reticle, the supersonic lock line, aircraft warning bands, the raid arrows); inside the bubble they would be hidden.',
    rec: 'pick', why: 'The cleanest support enemy: it attacks information, not hulls, and you can end it with one good shot.',
  },
  {
    id: 'p-decoy', n: 7, name: 'Decoy Drone', cat: 'support', sub: 'deceive', answer: 'pick', pressure: 'ammo', shape: 'instant',
    said: 'A small group contains real attackers and harmless decoys. Decoys look convincing from a distance but reveal differences in their flashing lights or engine trails as they approach.\n\nThe decision: fire early and risk wasting ammunition, or wait until you can identify the real threats. Decoys disappear harmlessly if they reach the convoy.',
    tell: 'Lights and trails differ up close.', counters: ['flak', 'cutter', 'tesla'],
    closest: 'Nothing today wastes your ammo on purpose.',
    cost: 'small', costWhy: 'A drone with no damage and a different look at short range.',
    rec: 'pick', why: 'Makes the rack the thing under attack, and rewards a careful player over a fast one.',
  },
  {
    id: 'p-spotter', n: 8, name: 'Target-Spotter Aircraft', cat: 'support', sub: 'coordinate', answer: 'source', pressure: 'aim', shape: 'lasting',
    said: 'A reconnaissance aircraft circles outside the convoy and paints one cargo ship with a visible targeting beam. Other enemies concentrate their next attacks on that ship.\n\nThe decision: stop the spotter before a focused barrage forms, or defend the marked ship. Destroying it cancels attacks still being prepared, while already-launched threats continue.',
    tell: 'The beam on one ship.', counters: ['railgun', 'aegis', 'frigate', 'shield'],
    closest: 'Nothing today chooses a target for the others.',
    cost: 'medium', costWhy: 'Enemies choose their own targets (guided missiles re-target); this biases those choices to one ship while it lives.',
    rec: 'pick', why: 'Turns a random raid into a readable plan you can break, and makes Aegis and Shield matter more.',
  },
  {
    id: 'p-torpedo-sub', n: 9, name: 'Torpedo Attack Submarine', cat: 'platform', sub: 'sea', answer: 'reposition', pressure: 'hulls', shape: 'delayed',
    said: 'An attack sub briefly surfaces, launches a slow underwater torpedo, and dives. The torpedo follows a visible wake toward a predicted crossing point rather than homing perfectly.\n\nThe decision: destroy the sub during its exposed window, intercept the torpedo’s visible contact, or change formation before the ships reach the crossing point.',
    tell: 'The wake line to the crossing point.', counters: ['airstrike', 'bomberWing', 'grapnel', 'fullSteam'],
    closest: 'Submarine: today it fires missiles, and your gun can’t hit it. The Ballistic missile already aims at a predicted point; a torpedo does it at water level, slowly, along a wake.',
    cost: 'medium', costWhy: 'Subs exist; new: a slow water-level threat on a wake, and a short window when your gun can hit the sub.',
    rec: 'pick', why: 'Three answers in one (the sub, the torpedo, the formation), and the first threat that travels in the lane itself.',
  },
  {
    id: 'p-minelayer', n: 10, name: 'Minelayer Boat', cat: 'platform', sub: 'sea', answer: 'source', pressure: 'space', shape: 'lasting',
    said: 'A boat crosses ahead of the convoy and drops a short line of mines into its route. The mines take a moment to arm and then remain until destroyed.\n\nThe decision: kill the boat before it lays the field, or clear a safe passage afterward. This creates a problem that persists after its source has left the screen.',
    tell: 'The boat’s course across the lane.', counters: ['shrapnel', 'flak', 'tesla'],
    closest: 'Drifting mines (Sowers’ Reach) already deny water; this adds the boat that lays them.',
    cost: 'small', costWhy: 'Mines exist; a boat that drops them along a line.',
    rec: 'maybe', why: 'Good, but mines already exist on one map. Worth it if mines should reach more maps.',
  },
  {
    id: 'p-siege-battery', n: 11, name: 'Coastal Siege Battery', cat: 'platform', sub: 'shore', answer: 'reposition', pressure: 'space', shape: 'delayed',
    said: 'A shore cannon marks several impact circles, then launches shells that cannot be intercepted. Its gun emplacement can be destroyed with normal interceptors.\n\nThe decision: suppress the battery or move the convoy out of the marked areas. Unlike the rocket truck, this attack punishes predictable positioning rather than directly tracking a ship.',
    tell: 'The impact circles on the water.', counters: ['railgun', 'lance', 'fullSteam'],
    closest: 'Ballistic missile: it already shows a reticle and its blast spills, but it can be shot.',
    cost: 'medium', costWhy: 'Marked zones and a shell no interceptor can touch; a shore gun your gun can hit.',
    rec: 'pick', why: '“Can’t be intercepted” turns the reticle from a hint into a must-move, so formation becomes the answer, not just a help. Pick this or the Dive Bomber (#18), not both.',
  },
  {
    id: 'p-loiter', n: 12, name: 'Loitering Ambush Drones', cat: 'strike', sub: 'swarm', answer: 'pick', pressure: 'space', shape: 'trigger',
    said: 'A handful of drones arrive and circle over empty water instead of immediately attacking. When a cargo ship approaches their area, they dive together.\n\nThe decision: clear a threat that is currently doing nothing, or save ammunition for the immediate raid. Ignoring them turns a quiet section of the map into a later ambush.',
    tell: 'The circling group over open water.', counters: ['flak', 'well', 'thermo'],
    closest: 'Drifting mines also wait in the lane, but don’t move together.',
    cost: 'small', costWhy: 'Drones that circle a point until a ship comes near.',
    rec: 'pick', why: 'Moving, coordinated and readable: a real “now or later” choice that mines don’t give, since they don’t come at you together.',
  },
  {
    id: 'p-repair-tender', n: 13, name: 'Repair Tender', cat: 'support', sub: 'shield', answer: 'source', pressure: 'durability', shape: 'lasting',
    said: 'An enemy support vessel accompanies durable attackers and periodically repairs one nearby damaged enemy. A visible beam shows exactly which unit it is helping.\n\nThe decision: finish your current target quickly or destroy the repair vessel first. Repairs should happen in pulses, so you can interrupt the next repair rather than fight endless regeneration.',
    tell: 'The repair beam and its pulse.', counters: ['lance', 'railgun', 'orbital'],
    closest: 'Shield generator (the Citadel) also keeps enemies alive, but stands still and protects one thing.',
    cost: 'medium', costWhy: 'A moving support unit and healing for threats with hit points.',
    rec: 'pick', why: 'Makes tough enemies a puzzle about order, and suits the Dreadnought, rigs and heavies already in the game.',
  },
  {
    id: 'p-armored-drone', n: 14, name: 'Armored Drone', cat: 'strike', sub: 'tough', answer: 'time', pressure: 'hulls', shape: 'lasting',
    said: 'A large drone carries a protective front plate. Ordinary hits damage that plate first, but its rear is exposed when it banks through a clearly visible turning maneuver.\n\nThe decision: spend more shots attacking immediately, or time a shot for its turn. Area attacks could also reach around the plate, giving different weapons a useful advantage.',
    tell: 'The plate, and the bank.', counters: ['thermo', 'well', 'boomerang', 'orbital'],
    closest: 'Heavy cruise missile: also soaks hits, from any side.',
    cost: 'medium', costWhy: 'Hits need a direction; most of today’s shots come straight from the carrier.',
    rec: 'maybe', why: 'Clever, but every shot leaves the carrier, so “from behind” is rare and hard to read on a phone.',
  },
  {
    id: 'p-crossing-wing', n: 15, name: 'Crossing Attack Wing', cat: 'strike', sub: 'swarm', answer: 'time', pressure: 'hulls', shape: 'delayed',
    said: 'Several drones fly across the screen in formation, then peel away toward different ships. Before that split, they briefly pass through a tight intersection.\n\nThe decision: land an area attack at the crossing, or prepare to engage several separated targets afterward. The interesting part is the moving opportunity, rather than a larger swarm.',
    tell: 'The formation converging.', counters: ['flak', 'thermo', 'well', 'airstrike'],
    closest: 'A drone raid with choreography: the drones themselves are today’s.',
    cost: 'small', costWhy: 'A raid pattern, not a new unit.',
    rec: 'maybe', why: 'More a raid pattern than an enemy; it could ride along with any of the others.',
  },
  {
    id: 'p-gunboat', n: 16, name: 'Broadside Gunboat', cat: 'platform', sub: 'sea', answer: 'time', pressure: 'hulls', shape: 'delayed',
    said: 'An armored enemy boat moves alongside the shipping lane. It pauses, turns broadside, and visibly charges a short burst that can strike several ships along one firing line.\n\nThe decision: destroy it during the charge or spread the convoy. Its gun ports open during that charge, temporarily making it more vulnerable to normal interceptors.',
    tell: 'The turn and the charge.', counters: ['lance', 'railgun', 'grapnel'],
    closest: 'Dreadnought: also a ship that fires broadsides.',
    cost: 'medium', costWhy: 'A smaller Dreadnought with a weak spot while it charges.',
    rec: 'maybe', why: 'A good fight, but close to the Dreadnought. Worth it if it is the Dreadnought’s small cousin on more maps.',
  },
  {
    id: 'p-emp-drone', n: 17, name: 'EMP Attack Drone', cat: 'support', sub: 'sabotage', answer: 'shoot', pressure: 'ammo', shape: 'trigger',
    said: 'A distinctive drone heads toward the carrier. If it reaches pulse range, it briefly slows the carrier’s ammunition reload instead of directly damaging its hull.\n\nThe decision: protect your ability to answer the next raid. The pulse should reduce reload speed for a short period rather than completely prevent firing, and repeated pulses should not stack into a permanent shutdown.',
    tell: 'Its look, and the pulse ring.', counters: ['aegis', 'droneScreen', 'cutter'],
    closest: 'Nothing today hits your reload.',
    cost: 'small', costWhy: 'A drone whose hit slows the reload for a while.',
    rec: 'pick', why: 'Cheap, readable, and it makes the rack the thing to defend, which suits the coming pacing pass.',
  },
  {
    id: 'p-dive-bomber', n: 18, name: 'Dive Bomber', cat: 'platform', sub: 'air', answer: 'reposition', pressure: 'hulls', shape: 'delayed',
    said: 'A bomber approaches high, selects a visible impact point, then dives and releases a powerful unguided bomb. Once it commits, that impact point stops tracking the convoy.\n\nThe decision: shoot down the aircraft, intercept its bomb, or shift formation away from the committed strike. Its steep dive gives it a different rhythm from the existing missile bomber’s straight flight across the screen.',
    tell: 'The impact point.', counters: ['railgun', 'aegis', 'fullSteam'],
    closest: 'Coastal Siege Battery (#11): also a marked point you move away from.',
    cost: 'medium', costWhy: 'A new flight path (high, then a dive) and a bomb aimed at a point.',
    rec: 'maybe', why: 'Close to #11 in what you do about it. Pick one of the two “move out of the mark” enemies.',
  },
];

// ---------------------------------------------------------------------------
// New ideas: about twenty, thinned to ten. Each is checked against today’s
// enemies, the player’s 18 and the other kept ideas (check.mjs): no kept idea
// shares its answer and pressure with anything else.

export const NEW = [
  // ------------------------------------------------------------ KEPT (10)
  {
    id: 'tug', status: 'keep', name: 'Hijacker Tug', cat: 'strike', sub: 'sea', answer: 'race', pressure: 'capture', shape: 'escalating',
    pitch: 'A tug latches onto a cargo ship and tows it toward the enemy shore.',
    how: 'A small boat comes alongside a ship and hooks on (1 s, cable drawn). The ship leaves its lane and is dragged toward enemy water at half speed. If it reaches the shore it is captured: lost, and it counts against you like a sinking. Three hits sink the tug; the ship then swings back into the lane.',
    decision: 'The tug sits right beside your own ship, and the longer you wait the further from home the ship is. Drop what you are doing, or let a bigger raid land?',
    tell: 'The cable, and a ship leaving its lane.', counters: ['railgun', 'grapnel', 'lance', 'frigate'],
    novel: 'The first enemy that takes a ship rather than sinking it, and the first that moves one of your ships.',
    cost: 'large', costWhy: 'Ships run on fixed lanes today; pulling one off its lane and back is new engine work.',
  },
  {
    id: 'radar', status: 'keep', name: 'Counter-Battery Site', cat: 'platform', sub: 'shore', answer: 'hold', pressure: 'carrier', shape: 'escalating',
    pitch: 'A shore station that listens to your gun: fire a lot and it fires back at the carrier.',
    how: 'A dish and a mortar pit on the enemy shore. Every tap you fire (not your helpers’ shots) fills a meter beside it; each time it fills (12 taps), the pit lobs one heavy shell at your carrier: two hits to stop it; if it lands it takes a quarter of the carrier’s health. The dish turns toward the carrier as the meter fills. Ten hits destroy the site.',
    decision: 'Fire less and better, spend shots stopping its shells, or spend a burst on the site so you can spray again.',
    tell: 'The dish turning, its meter, and the shell’s arc.', counters: ['railgun', 'lance', 'orbital', 'bomberWing'],
    novel: 'The first enemy that answers how you play: it punishes spraying and rewards the accurate player, and every shell it fires is caused by you, so cause and cost are on screen together.',
    cost: 'small', costWhy: 'A shore structure (like a rig) with a counter on your taps, launching a shell at the carrier when it fills.',
  },
  {
    id: 'picket', status: 'keep', name: 'Flak Picket', cat: 'support', sub: 'sabotage', answer: 'source', pressure: 'shots', shape: 'lasting',
    pitch: 'An enemy ship that shoots down your interceptors as they fly past.',
    how: 'A small warship sits off the lane with a ring around it. Your shots fly from the carrier in near-straight lines, so the ring throws a shadow across part of the sky (drawn faintly). It downs up to two interceptors a second that cross the ring; a burst gets through, a trickle doesn’t. Shots at the picket itself are not shot down. Five hits sink it.',
    decision: 'Threats in its shadow cost more shots. Sink it first, send a burst, or answer them with something that doesn’t fly from the carrier (Air Strike, Orbital Strike, your helpers).',
    tell: 'The ring, its shadow, and puffs where your shots die.', counters: ['airstrike', 'orbital', 'gunships', 'droneScreen'],
    novel: 'The first enemy that attacks your shots rather than your ships, and the first reason to care where the carrier’s fire comes from.',
    cost: 'medium', costWhy: 'Interceptors meet nothing but threats today; this gives them a hazard on their path, and a shadow to draw.',
  },
  {
    id: 'hydra', status: 'keep', name: 'Hydra Missile', cat: 'strike', sub: 'trick', answer: 'place', pressure: 'hulls', shape: 'trigger',
    pitch: 'Shoot it and it splits in two, and both keep coming.',
    how: 'A two-hit missile. The killing hit splits it into two fast one-hit darts aimed at the ships nearest it. Killed far out, the darts have a long way to fly and are easy; killed close, they arrive before you can answer. Area weapons that catch both pieces beat it.',
    decision: 'Kill it early, or with something that catches the pieces. The Cluster missile splits on its own when it nears its target; the Hydra splits only when you kill it, so where it dies is up to you.',
    tell: 'A forked tail on the missile.', counters: ['flak', 'thermo', 'tesla', 'well'],
    novel: 'Your kill is the trigger, so the question is where it dies, not whether.',
    cost: 'small', costWhy: 'A missile that spawns two children on death (the cluster already spawns children).',
  },
  {
    id: 'scavenger', status: 'keep', name: 'Scavenger Drone', cat: 'support', sub: 'sabotage', answer: 'race', pressure: 'drops', shape: 'instant',
    pitch: 'A drone that flies to your pickups and carries them off.',
    how: 'It goes for the nearest pickup on the water (a weapon, ammo, a repair or the Nuke), grabs it and flies off the top of the screen. Shoot it on the way out and it drops the pickup where it dies.',
    decision: 'Tap the pickup first, or shoot the thief and then tap what falls.',
    tell: 'A claw under it, and a line to the pickup it wants.', counters: ['seeker', 'cutter', 'supplyRun'],
    novel: 'Goes after your drop economy, not your ships, and makes the pickups themselves something to defend.',
    cost: 'small', costWhy: 'A drone that targets a pickup instead of a ship.',
  },
  {
    id: 'barge', status: 'keep', name: 'Supply Barge', cat: 'support', sub: 'coordinate', answer: 'source', pressure: 'future', shape: 'escalating',
    pitch: 'An enemy barge rearms the launch sites: while it floats, every raid gets bigger.',
    how: 'It moors off the enemy shore at the start of a wave. Each raid launched while it floats carries one more missile per site. Twelve hits sink it; the next raid shrinks back. It never fires.',
    decision: 'Spend shots on something that is no danger right now, to make every raid after it smaller.',
    tell: 'Crates on deck, and a +1 tag over each site.', counters: ['lance', 'railgun', 'orbital', 'airstrike'],
    novel: 'The first enemy you fight for later raids: it puts the draft’s “invest now, pay off later” choice onto the battlefield.',
    cost: 'small', costWhy: 'A sea structure and a raid-size bonus while it floats.',
  },
  {
    id: 'acoustic', status: 'keep', name: 'Acoustic Mine', cat: 'strike', sub: 'sea', answer: 'throttle', pressure: 'space', shape: 'trigger',
    pitch: 'A mine that only hears fast ships.',
    how: 'A field of mines settles in the lane, each with a pale ring. A ship that crosses a ring at speed sets it off (it sinks or takes three hits). The convoy’s speed comes from its formation (Column is fastest, Box slowest) and Full Steam: in Box or Spread, ships slip past. Mines sit under the water and surface every few seconds, when one hit clears them.',
    decision: 'Switch to a slow formation (Box or Spread) through the field and spend longer under fire, or keep Column’s speed and clear a path in time.',
    tell: 'The rings, pulsing faster as the convoy speeds up.', counters: ['shrapnel', 'tesla', 'flak'],
    novel: 'Puts a price on speed: today Column and Full Steam only buy less time under fire; here they set things off.',
    cost: 'small', costWhy: 'Mines exist; a trigger on a ship’s speed, and a surfacing rhythm.',
  },
  {
    id: 'lure', status: 'keep', name: 'Lure Beacon', cat: 'support', sub: 'sabotage', answer: 'source', pressure: 'allies', shape: 'lasting',
    pitch: 'A buoy that fools your helpers into chasing it.',
    how: 'A flashing buoy bobs in open water. While it flashes, your helpers (Drone Screen, Gunship Pair, Aegis Launchers, Frigate Escort, Orbital Strike and the allied guns) aim at it instead of real threats, and their shots pass through it harmlessly. Only your own taps can hit it: two hits sink it.',
    decision: 'Your hands stay accurate; your helpers don’t. Spend two taps on the buoy to get them back, or fight on without them.',
    tell: 'The flashing buoy, and helpers turning toward it.', counters: ['railgun', 'cutter', 'cadence'],
    novel: 'The first counter to the passives, which the lock-in made a big part of the game: it attacks what plays itself.',
    cost: 'small', costWhy: 'A sea target that the helpers’ targeting prefers and their shots ignore.',
  },
  {
    id: 'bodyguard', status: 'keep', name: 'Bodyguard Ring', cat: 'support', sub: 'shield', answer: 'pick', pressure: 'shots', shape: 'lasting',
    pitch: 'Little drones orbit a heavy missile and throw themselves in front of your shots.',
    how: 'Three one-hit guard drones circle a heavy cruise missile. A shot homing on the heavy meets a guard first: the guard dies, the heavy is untouched. Guards don’t attack. A blast that catches the ring (Flak, Tesla, Thermobaric) clears it; the Lance and Railgun go straight through.',
    decision: 'Your shots home, so a heavy behind its ring costs three extra shots. Clear the ring with one area shot first, or use a weapon that pierces.',
    tell: 'The orbiting ring around the heavy.', counters: ['flak', 'tesla', 'thermo', 'railgun', 'lance'],
    novel: 'Makes the order you shoot in matter, and gives area and piercing weapons a job that plain shots can’t do.',
    cost: 'small', costWhy: 'Drones that orbit a parent and intercept shots aimed at it.',
  },
  {
    id: 'cloud', status: 'keep', name: 'Fuel Cloud', cat: 'strike', sub: 'trick', answer: 'time', pressure: 'space', shape: 'trigger',
    pitch: 'A tanker drone sprays a fuel cloud over the lane; the next burst inside it sets the whole cloud off.',
    how: 'A drone crosses the lane leaving a pale cloud (about two ships wide) that drifts for 12 s. Any burst inside it, yours or a threat’s impact, ignites it: two hits to everything in it, threats and ships alike. Beams and cuts (Railgun, Lance, Laser Cutter) don’t burst, so they can fire through it safely. Shoot the tanker before it sprays, or set the cloud off when a swarm is in it and your ships aren’t.',
    decision: 'Hold fire near it while your ships are under it, then use it: the cloud is the enemy’s trap and your bomb.',
    tell: 'The pale cloud and its edge.', counters: ['cutter', 'railgun', 'lance'],
    novel: 'A hazard both sides can use: the first enemy weapon you can turn on the enemy, by choosing the moment.',
    cost: 'medium', costWhy: 'A lasting zone that bursts react to.',
  },
  // ------------------------------------------------------------- CUT
  { id: 'limpet', status: 'cut', name: 'Limpet Boat', cat: 'strike', sub: 'sea', answer: 'pinpoint', pressure: 'hulls', shape: 'delayed', pitch: 'A boat leaves a ticking charge on a ship’s hull; tap the charge to knock it off.', why: 'A tiny target on your own ship, under your thumb, mid-raid, is a test of fingers, not a decision; and a tap snaps to the nearest threat, so “exactly on the charge” wouldn’t hold.' },
  { id: 'jink', status: 'cut', name: 'Jinking Missile', cat: 'strike', sub: 'trick', answer: 'time', pressure: 'shots', shape: 'instant', pitch: 'A missile that sidesteps your first shot.', why: 'Your shots home and burst, so a sidestep is followed or caught by the blast; in play it would be a two-hit guided missile.' },
  { id: 'volatile', status: 'cut', name: 'Volatile Cloud', cat: 'support', sub: 'sabotage', answer: 'hold', pressure: 'hulls', shape: 'lasting', pitch: 'A gas cloud whose ignition hurts only your ships.', why: 'Reworked into the Fuel Cloud, which burns threats too, so it’s a choice, not a punishment.' },
  { id: 'charge', status: 'cut', name: 'Superweapon Charge', cat: 'platform', sub: 'shore', answer: 'source', pressure: 'hulls', shape: 'escalating', pitch: 'A shore railgun charges all wave and fires a ship-sinking line; damage sets it back.', why: 'Too close to your Rocket Artillery Truck and the Citadel: a big shore thing you must kill before it fires.' },
  { id: 'impostor', status: 'cut', name: 'Impostor Ship', cat: 'platform', sub: 'sea', answer: 'pick', pressure: 'hulls', shape: 'delayed', pitch: 'One “cargo ship” in the convoy is an enemy that blows up beside the others.', why: 'Needs a new rule (shooting your own ships), and telling it apart on a phone would be guesswork.' },
  { id: 'relay', status: 'cut', name: 'Afterburner Relay', cat: 'support', sub: 'coordinate', answer: 'source', pressure: 'hulls', shape: 'lasting', pitch: 'A tower that speeds up every threat that passes near it.', why: 'A plainer support than your Repair Tender and Spotter, which do more with the same “kill the helper” answer.' },
  { id: 'poison', status: 'cut', name: 'Poisoned Drop', cat: 'support', sub: 'deceive', answer: 'pick', pressure: 'drops', shape: 'instant', pitch: 'A fake pickup that jams your gun when you tap it.', why: 'Punishes collecting, which the game wants you to do; Scavenger Drone pressures drops more fairly.' },
  { id: 'thief', status: 'cut', name: 'Weapon Thief', cat: 'support', sub: 'sabotage', answer: 'shoot', pressure: 'drops', shape: 'instant', pitch: 'A drone that steals the weapon you have loaded.', why: 'Same target as Scavenger Drone, and losing a loaded weapon mid-fight feels worse than losing a pickup.' },
  { id: 'fireship', status: 'cut', name: 'Fireship', cat: 'strike', sub: 'sea', answer: 'place', pressure: 'hulls', shape: 'trigger', pitch: 'A burning boat that explodes over everything around it when it is killed.', why: 'Same “where it dies” answer as Hydra Missile, which reads better in the sky.' },
  { id: 'smoke', status: 'cut', name: 'Smoke Layer', cat: 'support', sub: 'deceive', answer: 'pick', pressure: 'sight', shape: 'lasting', pitch: 'A boat that lays smoke over part of the lane, hiding threats inside it.', why: 'Your Jammer Drone does this better: it can be killed, and it hides lines, not whole threats.' },
  { id: 'sync', status: 'cut', name: 'Synchronizer', cat: 'support', sub: 'coordinate', answer: 'time', pressure: 'hulls', shape: 'delayed', pitch: 'Holds a raid back until every missile is ready, then lets all of them go at once.', why: 'A raid pattern like your Crossing Attack Wing, not a new enemy.' },
  { id: 'barrage', status: 'cut', name: 'Walking Barrage', cat: 'platform', sub: 'shore', answer: 'throttle', pressure: 'space', shape: 'delayed', pitch: 'A line of shell impacts walks down the lane toward the convoy.', why: 'Overlaps your Siege Battery (move out of the marks) and Acoustic Mine (the convoy’s speed).' },
  { id: 'harpoon', status: 'cut', name: 'Harpoon Boat', cat: 'platform', sub: 'sea', answer: 'race', pressure: 'space', shape: 'lasting', pitch: 'Harpoons a ship and holds it dead in the water.', why: 'A weaker Hijacker Tug: holding a ship still is half of taking it.' },
  { id: 'blockship', status: 'cut', name: 'Blockship', cat: 'platform', sub: 'sea', answer: 'reposition', pressure: 'space', shape: 'lasting', pitch: 'An old ship scuttles itself in the lane, narrowing it for the rest of the wave.', why: 'Rewriting a lane mid-wave is a big engine change for a small effect; your Minelayer denies water more simply.' },
];

// ---------------------------------------------------------------------------
// Questions for the player (ids new to this round: `en-…`).

export const QUESTIONS = [
  {
    id: 'en-taxonomy',
    q: 'Sort the enemy into three categories by what they do in a fight: Strikes (hit a hull themselves), Platforms (launch or fire from a distance, and stay) and Support (change the rules: sight, survival, your kit, their aim)?',
    options: ['Yes: Strikes, Platforms, Support (recommended)', 'By where they come from: Air, Sea, Shore', 'By what you do about them: shoot it, kill its source, move the convoy'],
  },
  {
    id: 'en-count',
    q: 'How many new enemies in the first enemy build?',
    options: ['Eight, the strongest of both lists, as Free Play prototypes first (recommended)', 'All the ones you mark “Go further”', 'Four, and play them before building more'],
  },
  {
    id: 'en-chapters',
    q: 'Where do new enemies appear in the campaign?',
    options: ['A few debut in each chapter, like the weapons (recommended)', 'Each map gets one signature enemy', 'Mixed into raids everywhere once unlocked'],
  },
  {
    id: 'en-stealth',
    q: 'Your Stealth Strafer and Stealth Bomber: two enemies, or one Stealth trait any aircraft can have (no warning arrow, no band; still a short visible run-in)?',
    options: ['One Stealth trait for every aircraft (recommended)', 'Two separate enemies', 'Neither'],
  },
  {
    id: 'en-unstoppable',
    q: 'Rocket Artillery Truck and Siege Battery fire things no interceptor can stop. The rule for anything like that:',
    options: ['Always a clear tell first, and the source is always killable (recommended)', 'A tell is enough; some sources can’t be killed', 'Nothing should be unstoppable'],
  },
];
