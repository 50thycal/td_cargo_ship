// Formations set the lanes and how the convoy rides: `offsets` are lateral
// slots as a fraction of the channel's half-width; `group` ships spawn abreast
// per spawn event (the interval stretches to match, so ships/minute is
// unchanged). Round 3 gave each a trade-off (the player saw "not a whole lot
// of strategy" when they only moved lanes):
//   speed  — convoy speed multiplier: faster means fewer seconds under fire;
//   armor  — a direct hit on a ship does this much less damage (minimum 1);
//            splash spilling onto the ships around it is not reduced;
//   splash — how far ballistic and heavy splash reaches to other ships, as a
//            multiple of its radius (0: only the ship it was aimed at);
//   blastCut — splash weapons (ballistics, heavies, bomblets) do this share
//            less damage to a dispersed convoy (rounded up, minimum 1).

export type FormationId = 'column' | 'pairs' | 'spread' | 'box';

export interface FormationDef {
  id: FormationId;
  name: string;
  hint: string;
  /** Short trade-off tags for the picker: [strength, weakness]. */
  tags: [string, string];
  offsets: number[];
  group: number;
  speed: number;
  armor: number;
  splash: number;
  blastCut: number;
}

export const FORMATIONS: Record<FormationId, FormationDef> = {
  column: {
    id: 'column',
    name: 'Column',
    hint: 'One fast lane: ships are through soonest, but a splash catches the ship behind.',
    tags: ['Fast ×1.3', 'Splash chains'],
    offsets: [0],
    group: 1,
    speed: 1.3,
    armor: 0,
    splash: 1.5,
    blastCut: 0,
  },
  pairs: {
    id: 'pairs',
    name: 'Pairs',
    hint: 'Two abreast. No strength, no weakness.',
    tags: ['Balanced', '—'],
    offsets: [-0.32, 0.32],
    group: 2,
    speed: 1,
    armor: 0,
    splash: 1,
    blastCut: 0,
  },
  spread: {
    id: 'spread',
    name: 'Spread',
    hint: 'Three wide lanes: splash weapons do half damage and hit one ship only, but the convoy crawls.',
    tags: ['Splash −50%', 'Slow ×0.85'],
    offsets: [-0.8, 0, 0.8],
    group: 1,
    speed: 0.85,
    armor: 0,
    splash: 0,
    blastCut: 0.5,
  },
  box: {
    id: 'box',
    name: 'Box',
    hint: 'Three tight abreast: a direct hit does 1 less damage, but it is slow and splash rips through the whole box.',
    tags: ['Armour −1 dmg', 'Slow, splash ×1.8'],
    offsets: [-0.34, 0, 0.34],
    group: 3,
    speed: 0.8,
    armor: 1,
    splash: 1.8,
    blastCut: 0,
  },
};

export const FORMATION_ORDER: FormationId[] = ['column', 'pairs', 'spread', 'box'];
