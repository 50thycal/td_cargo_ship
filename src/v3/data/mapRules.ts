// The map rules' data checks (docs/design/v3-map-data-checks.md; the rules:
// docs/design/v3-map-wave-rules.md). Pure data: what a map's waves 1-10 can
// send and from which wave, the chapter each enemy kind first comes in, and
// each kind's debut in the campaign. tests/v3/mapRules.test.ts checks these
// against the wave planner itself (sim/game.ts, sim/foes.ts).
//
// Designer-only: nothing in the game reads this file.

import type { ThreatKind } from './config';
import { DEBUT_SLOTS, FOES, FOE_OF_KIND, foeCount, foesInChapter, type FoeId } from './foes';
import { MAPS, MAP_ORDER, chapterOf, type MapId } from './maps';
import { WAVE_TABLE, waveSpec } from './waves';

/** The waves a map's own plan covers (then the map's event and boss rounds). */
export const PLAN_WAVES = 10;

/** The new enemy a campaign map leads with: DEBUT_SLOTS, or the chapter's
 *  new enemies in turn. The same rule as sim/foes.ts's mapDebut (the test
 *  checks the two agree), kept here so this file needs no sim. */
function leadStart(map: MapId): number {
  const lead = foesInChapter(chapterOf(map));
  if (!lead.length) return 0;
  const k = Math.max(0, MAP_ORDER.indexOf(map)) % 5;
  const slots = DEBUT_SLOTS[chapterOf(map)];
  const id = slots ? slots[k % slots.length] : lead[k % lead.length];
  return id && lead.includes(id) ? lead.indexOf(id) : 0;
}

/** The first wave (1-10) a campaign run of the map sends each kind, as the
 *  wave planner schedules it:
 *  - drones, shells and guided missiles: the shared wave table at the map's
 *    threat scale (the first wave whose count is above zero);
 *  - the map's extras: from their `from` wave;
 *  - strafers and bombers: from the map's `vectors` wave;
 *  - the new enemies: a wave's first foe is always the next of the
 *    chapter's own (sim/foes.ts, planFoes), from the map's debut on wave 2,
 *    one more each wave, so the chapter's own come in at waves 2, 3, 4...
 *    Earlier chapters' foes come only as a wave's second or third foe, at
 *    random (wave 6 on): they are not listed (they debuted on an earlier map).
 *  A bomber or a heavy foe takes a guided missile's place, so on some maps
 *  the first guided missile comes a wave or two later than listed; never
 *  earlier (the test checks it against the planner). */
export function mapKindWaves(map: MapId): Map<ThreatKind, number> {
  const m = MAPS[map];
  const out = new Map<ThreatKind, number>();
  const see = (k: ThreatKind, w: number) => {
    if (w >= 1 && w <= PLAN_WAVES && w < (out.get(k) ?? Infinity)) out.set(k, w);
  };
  for (let w = 1; w <= Math.min(PLAN_WAVES, WAVE_TABLE.length); w++) {
    const s = waveSpec(w, m.threatScale);
    if (s.drones > 0) see('drone', w);
    if (s.ballistic > 0) see('ballistic', w);
    if (s.guided > 0) see('guided', w);
  }
  for (const x of m.extras) {
    for (let w = x.from; w <= PLAN_WAVES; w++) {
      if (Math.round(x.count + x.growth * (w - x.from)) > 0) {
        see(x.kind, w);
        break;
      }
    }
  }
  see('strafer', m.vectors.strafers);
  see('bomber', m.vectors.bombers);
  const lead = foesInChapter(chapterOf(map));
  if (lead.length) {
    let cursor = leadStart(map);
    for (let w = 1; w <= PLAN_WAVES; w++) {
      if (foeCount(w) < 1) continue;
      see(FOES[lead[cursor++ % lead.length]].kind, w);
    }
  }
  return out;
}

/** The kinds a map lists: what its bases can launch, its extras, the shared
 *  table's three, and its aircraft if they come by wave 10. */
export function mapListedKinds(map: MapId): Set<ThreatKind> {
  const m = MAPS[map];
  const out = new Set<ThreatKind>(['drone', 'ballistic', 'guided']);
  for (const b of m.bases) for (const k of b.kinds) out.add(k);
  for (const x of m.extras) out.add(x.kind);
  if (m.vectors.strafers <= PLAN_WAVES) out.add('strafer');
  if (m.vectors.bombers <= PLAN_WAVES) out.add('bomber');
  return out;
}

/** The chapter a kind first comes in. A new enemy: its own chapter
 *  (data/foes.ts, the one source for those). Any other kind has no chapter
 *  of its own in the data, so it is derived: the earliest chapter with a map
 *  that lists it (mapListedKinds). Undefined: no map lists it. */
export function kindChapter(kind: ThreatKind): number | undefined {
  const foe = FOE_OF_KIND[kind];
  if (foe) return FOES[foe].chapter;
  let best: number | undefined;
  for (const map of MAP_ORDER) if (mapListedKinds(map).has(kind)) best = Math.min(best ?? Infinity, chapterOf(map));
  return best;
}

export interface Debut {
  kind: ThreatKind;
  /** The new enemy it stands for, if it is one. */
  foe?: FoeId;
  map: MapId;
  chapter: number;
  wave: number;
}

/** A Test Lab map card's run (round 8, the player: each new enemy's
 *  debut is part of the map, banner and all): does this map debut this new
 *  enemy? Then its first sight on the card always gets the "NEW · <chapter>"
 *  card, even on a device that has met it (the campaign says it once per
 *  device, as before). Only the new enemies (data/foes.ts), not the
 *  original threats. */
export function mapDebutsFoe(map: MapId, kind: ThreatKind): boolean {
  if (!FOE_OF_KIND[kind]) return false;
  DEBUT_MAPS ??= new Map(debuts().map((d) => [d.kind, d.map]));
  return DEBUT_MAPS.get(kind) === map;
}
let DEBUT_MAPS: Map<ThreatKind, MapId> | undefined;

/** Each kind's debut: the first map (in MAP_ORDER) and wave a campaign run
 *  sends it, in campaign order. The rule m-enemy wants each new enemy alone
 *  (or with drones only) for its debut wave; that is not checked yet, only
 *  listed. */
export function debuts(): Debut[] {
  const seen = new Map<ThreatKind, Debut>();
  for (const map of MAP_ORDER) {
    const waves = [...mapKindWaves(map)].sort((a, b) => a[1] - b[1]);
    for (const [kind, wave] of waves) {
      if (seen.has(kind)) continue;
      const foe = FOE_OF_KIND[kind];
      seen.set(kind, { kind, ...(foe ? { foe } : {}), map, chapter: chapterOf(map), wave });
    }
  }
  const order = (d: Debut) => MAP_ORDER.indexOf(d.map) * 100 + d.wave;
  return [...seen.values()].sort((a, b) => order(a) - order(b));
}
