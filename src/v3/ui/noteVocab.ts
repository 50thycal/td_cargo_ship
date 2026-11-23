// The game's own names as words, collected from its data: weapons, foes,
// threats, maps, events, formations, commands, armory cards, ship hulls and
// the combo names. Nothing is typed out here, so a new weapon or map is
// known to the keyboard the day it exists.

import * as abilities from '../data/abilities';
import * as armory from '../data/armory';
import * as config from '../data/config';
import * as convoy from '../data/convoy';
import * as events from '../data/events';
import * as foes from '../data/foes';
import * as formations from '../data/formations';
import * as lab from '../data/lab';
import * as maps from '../data/maps';
import * as pairs from '../data/pairs';
import * as roster from '../data/roster';

const MODULES: object[] = [abilities, armory, config, convoy, events, foes, formations, lab, maps, pairs, roster];
const NAME_KEYS = new Set(['name', 'label', 'evolved', 'title', 'short']);

function collect(v: unknown, into: Set<string>, depth = 0): void {
  if (depth > 6 || v == null) return;
  if (Array.isArray(v)) {
    for (const x of v) collect(x, into, depth + 1);
  } else if (typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (NAME_KEYS.has(k) && typeof x === 'string') into.add(x);
      else collect(x, into, depth + 1);
    }
  }
}

/** Ids and record keys are words too ("aegis", "railgun", "dualWield" → dual, wield). */
function collectIds(v: unknown, into: Set<string>): void {
  if (Array.isArray(v) || typeof v !== 'object' || v == null) return;
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    into.add(k);
    if (k === 'id' && typeof x === 'string') into.add(x);
    if (x && typeof x === 'object' && !Array.isArray(x)) {
      const id = (x as Record<string, unknown>).id;
      if (typeof id === 'string') into.add(id);
    }
  }
}

/** Every name the game defines ("Torpedo Sub", "Flak Curtain", "Saltgate"…). */
export function gameNames(): string[] {
  const names = new Set<string>();
  for (const mod of MODULES) {
    for (const v of Object.values(mod)) collect(v, names);
  }
  return [...names];
}

/** The words in those names and ids, lowercase, three letters or more. */
export function gameWords(): string[] {
  const words = new Set<string>();
  const add = (s: string) => {
    // camelCase and kebab-case ids: "dualWield" → "dual", "wield"
    for (const w of s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z]{3,}/g) ?? []) words.add(w);
  };
  for (const n of gameNames()) add(n);
  const ids = new Set<string>();
  for (const mod of MODULES) for (const v of Object.values(mod)) collectIds(v, ids);
  for (const id of ids) add(id);
  return [...words];
}
