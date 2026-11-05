// The weapons plan's data for the review page (page2.mjs): what changed after
// the player's round 2 review, the boost levels to confirm, and the open
// questions. Mirrors docs/design/v3-weapons-plan.md; keep the two in step.

export const PLAN_DATE = '2026-11-05';

/** The specs the player's notes changed. */
export const CHANGED = [
  {
    id: 'cadence',
    name: 'Cadence Gun',
    quote: 'Make it a full aura on the screen and not just the aircraft carrier … a single beat beat beat … a lead up to it, so the player can anticipate when the beat will hit.',
    spec: [
      'One steady beat every 0.6 s, the same every time: a single drum hit, no off-beats.',
      'Before each beat a ring closes in from the screen edges and lands exactly on the beat, like the approach circles in a rhythm game.',
      'On the beat the whole play area’s border pulses, not only the carrier; a shot within 0.12 s of the beat lights it gold.',
      'Reduced Motion: the ring becomes a thin progress bar along the top edge. Sound always, and a haptic tap on the phone.',
    ],
  },
  {
    id: 'orbital',
    name: 'Orbital Strike',
    quote: 'It should be like the laser dots too, triangulating on my spot and then the big beam hits.',
    spec: [
      'Three red laser dots appear at the edges of the play area and slide in, converging on the target over 0.8 s: a shrinking triangle.',
      'It locks the toughest threat when the dots appear and follows it as it moves, so the beam doesn’t miss.',
      'Then the beam comes down: 3 hits. The cycle stays 2.5 s (0.8 s locking, 1.7 s gap).',
    ],
  },
  {
    id: 'droneScreen',
    name: 'Drone Screen',
    quote: 'Always the carrier deck.',
    spec: ['Drones lift off the carrier on every map and fan out toward the threats closest to hitting a hull, one every 1.2 s at level 1.'],
  },
];

/** The default drops after the plan, and what happens to today's others. */
export const DROPS = {
  keep: [
    { name: 'Ammo', what: 'Fills the rack.' },
    { name: 'Repair', what: 'Heals.' },
    { name: 'Nuke (new)', what: 'Tap it: every drone, missile, aircraft, boat and mine on screen is destroyed. The rarest drop (weight about 3, against 40 for ammo), not before wave 3, one on the water at a time.' },
  ],
  move: [
    { name: 'Overdrive', to: 'Boost (as you said)' },
    { name: 'Time Warp', to: 'Boost (as you said)' },
    { name: 'Shield', to: 'Boost or cut: question 2' },
    { name: 'Full Steam', to: 'Boost or cut: question 2' },
    { name: 'Star Shell', to: 'Stays, but only on The Black Strait, where it lights the dark sea' },
  ],
};

/** Every boost's three levels (each lasts 15 s). `from`: it was a power-up. */
export const BOOST_LEVELS = [
  { id: 'fireAtWill', name: 'Fire at Will', l1: 'Hold for full-auto (every 0.2 s); the rack holds 4 more.', l2: 'Every 0.15 s, 6 more, reloads twice as fast.', max: ['Lead Rain', 'every 4th held shot bursts into flak.'] },
  { id: 'supplyRun', name: 'Supply Run', l1: 'Drops ×2, and they fly to the carrier.', l2: 'Drops ×3.', max: ['Airdrop', 'every 6 s a crate lands holding one of your weapons.'] },
  { id: 'overclock', name: 'Overclock', l1: 'The loaded weapon plays one level higher; its timer stops.', l2: 'The next weapon picked up is overclocked too.', max: ['Overload', 'the loaded weapon jumps straight to MAX.'] },
  { id: 'dualWield', name: 'Dual Wield', l1: 'The next weapon picked up joins the loaded one; every tap fires both.', l2: 'Both timers run at half speed.', max: ['Arsenal', 'a third weapon joins.'] },
  { id: 'hotStreak', name: 'Hot Streak', l1: '5 hits in a row: double damage. 10: triple.', l2: 'The streak survives one miss.', max: ['On Fire', 'at 10, shots pierce and the streak doesn’t decay.'] },
  { id: 'wildCard', name: 'Wild Card', l1: 'Each plain shot is a random weapon’s level 1 shot.', l2: 'Level 2 shots.', max: ['Jackpot', 'every shot is a random weapon’s MAX shot.'] },
  { id: 'focus', name: 'Focus', l1: 'Up to 6 s at half speed, spent while a finger is down.', l2: '9 s, at a third of the speed.', max: ['Deadeye', 'shots fired in slow motion hit for double.'] },
  { id: 'overdrive', name: 'Overdrive', from: true, l1: 'Rounds cost nothing.', l2: 'And the rack keeps refilling, so it is full when the boost ends.', max: ['Hyper Overdrive', 'every shot fires twice.'] },
  { id: 'timewarp', name: 'Time Warp', from: true, l1: 'Threats move at 40% speed.', l2: '25%.', max: ['Stasis', 'a threat hit while slowed is frozen for 1 s.'] },
  { id: 'shield', name: 'Shield', from: true, ifKept: true, l1: 'Ships and carrier take no damage.', l2: 'And the shield blocks strafing runs.', max: ['Reflect', 'a blocked missile bounces back and bursts.'] },
  { id: 'steam', name: 'Full Steam', from: true, ifKept: true, l1: 'Convoy 1.6× speed.', l2: '2× speed.', max: ['Ramming Speed', 'ships at full steam ram drones and boats out of the water.'] },
];

/** The build phases; each is one playable link in Free Play ("Prototype"). */
export const PHASES = [
  ['0', 'Systems', 'Categories on every weapon; boost rules (never replaces the loaded weapon, shares the slots, one at a time); the boost chip and timer; hold = charge/drag with a “HOLD: …” chip; default drops cut to ammo, repair and the Nuke; Overdrive and Time Warp as boosts; a Prototype shelf in Free Play.'],
  ['1', 'Actives', 'Charge Lance, Laser Cutter, Grapnel, Chain Shot, Fire Control, Cadence Gun.'],
  ['2', 'Passives', 'Drone Screen, Gunship Pair, Bomber Wing, Orbital Strike.'],
  ['3', 'Boosts', 'Fire at Will, Supply Run, Overclock, Dual Wield, Hot Streak, Wild Card, Focus, Overdrive, Time Warp (and Shield, Full Steam if kept).'],
  ['4', 'Experiments', 'Tidal Cannon, Storm Front, Ammunition Ship. Hunter-Killer Sub stays parked until there are more sea enemies.'],
];

/** The open questions (ids are new: round 2's answers keep theirs). */
export const QUESTIONS = [
  { id: 'nukeStructures', q: 'The Nuke: what does it do to rigs, generators, the Citadel and the Dreadnought?', options: ['3 hits, not a kill (proposed)', 'Kills them too', 'Nothing: only threats in the air and on the water'] },
  { id: 'nukeRarity', q: 'The Nuke’s rarity: about one every three waves (weight 3, against 40 for ammo), not before wave 3. Right?', options: ['About right', 'Rarer', 'More often'] },
  { id: 'shieldSteam', q: 'Shield and Full Steam aren’t in your default drops. What happens to them?', options: ['Both become boosts (levels below)', 'Shield becomes a boost, Full Steam is cut', 'Full Steam becomes a boost, Shield is cut', 'Cut both'] },
  { id: 'pool', q: 'With 31+ weapons, a weapon you don’t hold turns up in roughly 4% of drafts (11% today). How should the pool work?', options: ['New weapons unlock a few per chapter; Free Play has all (recommended)', 'Before each run, pick about 12 for that run’s pool', 'One big pool'] },
  { id: 'start', q: 'First playable link: systems plus the six actives?', options: ['Yes, start there', 'Different order (note)'] },
];
