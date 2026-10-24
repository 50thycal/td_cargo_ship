// Formations are lane assignments, nothing more. `offsets` are lateral slots
// as a fraction of the channel's half-width; `group` ships spawn abreast per
// spawn event (the interval stretches to match, so ships/minute is unchanged).

export type FormationId = 'column' | 'pairs' | 'spread' | 'box';

export interface FormationDef {
  id: FormationId;
  name: string;
  hint: string;
  offsets: number[];
  group: number;
}

export const FORMATIONS: Record<FormationId, FormationDef> = {
  column: {
    id: 'column',
    name: 'Column',
    hint: 'One lane. Easiest to cover; ballistics can walk down the line.',
    offsets: [0],
    group: 1,
  },
  pairs: {
    id: 'pairs',
    name: 'Pairs',
    hint: 'Two abreast. A balanced default.',
    offsets: [-0.32, 0.32],
    group: 2,
  },
  spread: {
    id: 'spread',
    name: 'Spread',
    hint: 'Three wide lanes. Splash rarely hits two, but interceptors fly further.',
    offsets: [-0.8, 0, 0.8],
    group: 1,
  },
  box: {
    id: 'box',
    name: 'Box',
    hint: 'Three abreast, tight. Compact to defend, punishing to splash.',
    offsets: [-0.34, 0, 0.34],
    group: 3,
  },
};

export const FORMATION_ORDER: FormationId[] = ['column', 'pairs', 'spread', 'box'];
