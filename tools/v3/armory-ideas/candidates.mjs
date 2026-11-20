// The configs tools/v3/armory-ideas/lift.ts plays: no Armory, three
// references from the middle and top, the three weak upgrades at level 5 as
// they are now, and two candidate level-5 numbers for each (`set`: the run's
// Armory numbers replaced; see lift.ts). Base gun: 1.35 s a round; a weapon
// pickup 15 s; power-up chance and timers ×1.
export const CANDIDATES = [
  { key: 'none', armory: {} },
  { key: 'plating5', armory: { plating: 5 } },
  { key: 'pointdef5', armory: { pointdef: 5 } },
  { key: 'fuse5', armory: { fuse: 5 } },
  { key: 'reload5', armory: { reload: 5 } }, // 0.945 s a round (-30%)
  { key: 'reloadA', armory: { reload: 5 }, set: { reload: 1.35 * 0.6 } }, // -40%
  { key: 'reloadB', armory: { reload: 5 }, set: { reload: 1.35 * 0.5 } }, // -50%
  { key: 'longload5', armory: { longload: 5 } }, // 35 s a weapon
  { key: 'longloadA', armory: { longload: 5 }, set: { weaponTime: 50 } },
  { key: 'longloadB', armory: { longload: 5 }, set: { weaponTime: 65 } },
  // 50 and 65 s changed nothing (a weapon is already loaded nearly all the
  // time at 35 s), so two other levers: a pickup refills the rack, or the
  // weapon pity clock shortens (Supply Lines' lever).
  { key: 'longloadR', armory: { longload: 5 }, refill: true },
  { key: 'longloadRP', armory: { longload: 5 }, refill: true, set: { dropPity: 22 } },
  { key: 'longloadP', armory: { longload: 5 }, set: { dropPity: 20 } },
  { key: 'stockpileC', armory: { stockpile: 5 }, set: { powerShare: 3, powerTime: 2.25 } },
  { key: 'reloadC', armory: { reload: 5 }, set: { reload: 1.35 * 0.65 } }, // -35%
  { key: 'stockpile5', armory: { stockpile: 5 } }, // 1.75x drops, 1.5x time
  { key: 'stockpileA', armory: { stockpile: 5 }, set: { powerShare: 2.5, powerTime: 2 } },
  { key: 'stockpileB', armory: { stockpile: 5 }, set: { powerShare: 3.25, powerTime: 2.5 } },
  // Whole builds: the player's usual three before and after the lift, and the
  // sweep's best build before and after (does the lift make a map trivial?).
  { key: 'player', armory: { reload: 5, repair: 4, stockpile: 5 } },
  { key: 'playerLift', armory: { reload: 5, repair: 4, stockpile: 5 }, set: { reload: 1.35 * 0.6, powerShare: 3.25, powerTime: 2.5 } },
  { key: 'top', armory: { warhead: 5, plating: 5, stockpile: 5 } },
  { key: 'topLift', armory: { warhead: 5, plating: 5, stockpile: 5 }, set: { powerShare: 3.25, powerTime: 2.5 } },
];
