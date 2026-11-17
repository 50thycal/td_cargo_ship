// The map rules' automatic data checks (docs/design/v3-map-data-checks.md;
// the rules: docs/design/v3-map-wave-rules.md).
//
// - g-named: every encounter has internal notes (sites, target, how it uses
//   the map); its call-out stays short and plain.
// - q-bots / m-enemy: no later-chapter foes, in the maps' own waves or in
//   any encounter.
// - w-variety: no encounter two waves in a row (v1, the style kept).
// - w-encounter: an encounter on each of waves 1-10 (v1).
// - m-enemy: each enemy kind's debut in the campaign (listed, not yet
//   enforced).
//
// Where the data breaks a rule today, the test holds the list of known
// breaks (an EXPECTED_ table): it fails if a new one appears or a listed one
// goes away, so the list is kept true while the rebuild fixes them.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ThreatKind } from '../../src/v3/data/config';
import { ENCOUNTERS, ENCOUNTER_MAPS, arc, encountersFor, type EncounterVersion } from '../../src/v3/data/encounters';
import { FOES, FOE_OF_KIND, FOE_ORDER, foeCount } from '../../src/v3/data/foes';
import { MAP_ORDER, chapterOf, type MapId } from '../../src/v3/data/maps';
import { debuts, kindChapter, mapKindWaves, mapListedKinds, PLAN_WAVES } from '../../src/v3/data/mapRules';
import { enemyPair, memberChapter, memberKind } from '../../src/v3/data/pairs';
import { createGame } from '../../src/v3/sim/game';
import { isFoe, mapDebut, newFoeState, planFoes } from '../../src/v3/sim/foes';

/** The style kept on every map (round 1): the original encounters. */
const KEPT: EncounterVersion = 'v1';
const SEEDS = [1, 2, 3, 4];

describe('g-named: internal notes on every encounter, a plain call-out', () => {
  it('every encounter (every version) has its notes: sites, target and how it uses the map, one sentence each', () => {
    expect(ENCOUNTERS.length).toBeGreaterThan(0);
    for (const e of ENCOUNTERS) {
      for (const k of ['sites', 'target', 'usesMap'] as const) {
        const s = e.notes?.[k] ?? '';
        expect(s.trim().length, `${e.id}.notes.${k}`).toBeGreaterThan(10);
        // One sentence: a capital, one full stop at the end, none inside.
        expect(s, `${e.id}.notes.${k}`).toMatch(/^[A-Z].*\.$/);
        expect(s.slice(0, -1), `${e.id}.notes.${k} is one sentence`).not.toMatch(/\.\s/);
      }
    }
  });

  it('the notes name the launch sites the encounter really uses', () => {
    for (const e of ENCOUNTERS) {
      const sites = e.notes.sites.toLowerCase();
      for (const b of e.beats) {
        if ('sub' in b.from) expect(sites, `${e.id}: a sub fires`).toMatch(/sub/);
        else if ('air' in b.from) expect(sites, `${e.id}: from the ${b.from.air > 0 ? 'west' : 'east'} edge`).toContain(`${b.from.air > 0 ? 'west' : 'east'} edge`);
        else expect(sites, `${e.id}: a base fires`).toMatch(/silo/);
      }
    }
  });

  it('the call-out is short and names the threat, not the site (at most 40 characters; no silo, base, lane or pad)', () => {
    for (const e of ENCOUNTERS) {
      expect(e.callout.length, `${e.id}: "${e.callout}"`).toBeLessThanOrEqual(40);
      expect(e.callout, `${e.id}: "${e.callout}"`).not.toMatch(/\b(silos?|bases?|lanes?|pads?|launch sites?|sub spots?)\b/i);
    }
  });

  it('the notes are never shown: no game code outside the data reads them', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? files(join(dir, d.name)) : d.name.endsWith('.ts') ? [join(dir, d.name)] : []));
    for (const f of [...files('src/v3/ui'), ...files('src/v3/sim')]) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/notes\??\.(sites|target|usesMap)\b|\busesMap\b|EncounterNotes/);
    }
  });
});

describe('no later-chapter foes (q-bots, m-enemy)', () => {
  it('a kind\'s chapter: a new enemy\'s own (data/foes.ts); any other kind, the earliest chapter with a map that lists it', () => {
    for (const f of FOE_ORDER) expect(kindChapter(FOES[f].kind), f).toBe(FOES[f].chapter);
    // The original threats are all in chapter 1 (The Strait and Harbor Mouth
    // list every one); the map mechanics' own come in with their map.
    for (const k of ['drone', 'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'mothership', 'strafer', 'bomber'] as ThreatKind[]) expect(kindChapter(k), k).toBe(1);
    expect(kindChapter('mine')).toBe(chapterOf('sowers'));
    expect(kindChapter('fastboat')).toBe(chapterOf('coves'));
  });

  it('no map lists a kind from a later chapter (its bases, its extras)', () => {
    for (const map of MAP_ORDER) for (const k of mapListedKinds(map)) expect(kindChapter(k)!, `${map}: ${k}`).toBeLessThanOrEqual(chapterOf(map));
  });

  it('no wave 1-10 of a campaign run sends a kind from a later chapter (the wave planner, several seeds)', () => {
    for (const map of MAP_ORDER) {
      const ch = chapterOf(map);
      for (const seed of SEEDS) {
        for (let w = 1; w <= PLAN_WAVES; w++) {
          const g = createGame(map, seed, w);
          const kinds = [...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))];
          for (const k of kinds) if (!isFoe(k)) expect(kindChapter(k)!, `${map} wave ${w}: ${k}`).toBeLessThanOrEqual(ch);
        }
        // The new enemies as one run plans them, wave after wave.
        for (const [w, ids] of runFoes(map, seed)) for (const id of ids) expect(FOES[id].chapter, `${map} wave ${w}: ${id}`).toBeLessThanOrEqual(ch);
      }
    }
  });

  /** v3's enemy pairs bring later-chapter enemies to the chapter 1 maps on
   *  purpose (MAP_VERSIONS' `guests`); v3 is dropped from design (round 1),
   *  kept in the data for old logs. Every other version must have none. */
  const EXPECTED_LATER_FOES: Record<string, string[]> = {
    'strait-v3-scavenger-teach': ['scavenger (ch 2)'],
    'strait-v3-scavenger-combine': ['scavenger (ch 2)'],
    'strait-v3-heli-teach': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'strait-v3-heli-combine': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'strait-v3-escalate-1': ['scavenger (ch 2)'],
    'strait-v3-escalate-2': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'strait-v3-climax': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'gauntlet-v3-armored-teach': ['armored (ch 2)'],
    'gauntlet-v3-armored-combine': ['armored (ch 2)'],
    'gauntlet-v3-siege-teach': ['siege (ch 3)'],
    'gauntlet-v3-siege-combine': ['siege (ch 3)'],
    'gauntlet-v3-escalate-1': ['armored (ch 2)'],
    'gauntlet-v3-escalate-2': ['siege (ch 3)'],
    'gauntlet-v3-climax': ['armored (ch 2)', 'siege (ch 3)'],
    'harbor-v3-heli-teach': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'harbor-v3-heli-combine': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'harbor-v3-spotter-teach': ['spotter (ch 3)', 'siege (ch 3)'],
    'harbor-v3-spotter-combine': ['spotter (ch 3)', 'siege (ch 3)'],
    'harbor-v3-escalate-2': ['attackHeli (ch 2)', 'torpedoSub (ch 2)'],
    'harbor-v3-climax': ['spotter (ch 3)', 'siege (ch 3)'],
  };

  it('no encounter beat or enemy pair uses a kind from a later chapter than its map\'s (v3\'s declared guests the only, listed, exception)', () => {
    const found: Record<string, string[]> = {};
    for (const e of ENCOUNTERS) {
      const ch = chapterOf(e.map);
      const later: string[] = [];
      for (const b of e.beats) {
        const c = kindChapter(b.kind);
        expect(c, `${e.id}: ${b.kind} has a chapter`).toBeDefined();
        if (c! > ch) later.push(`${b.kind} (ch ${c})`);
      }
      for (const p of e.pairs ?? [])
        for (const m of enemyPair(p.pair)!.members) {
          const c = Math.max(memberChapter(m), kindChapter(memberKind(m)) ?? 1);
          const tag = `${m} (ch ${c})`;
          if (c > ch && !later.includes(tag)) later.push(tag);
        }
      if (later.length) found[e.id] = later;
    }
    expect(found).toEqual(EXPECTED_LATER_FOES);
    for (const id of Object.keys(found)) expect(ENCOUNTERS.find((e) => e.id === id)!.version, id).toBe('v3');
  });
});

/** The new enemies one campaign run of a map plans, wave after wave (the
 *  planner's own call, as startWave makes it: its cursor carries over from
 *  wave to wave). */
function runFoes(map: MapId, seed: number): [number, ReturnType<typeof planFoes>][] {
  const g = createGame(map, seed, 1);
  g.foe = newFoeState(map);
  const out: [number, ReturnType<typeof planFoes>][] = [];
  for (let w = 1; w <= PLAN_WAVES; w++) {
    g.wave = w;
    out.push([w, planFoes(g, foeCount(w))]);
  }
  return out;
}

describe('w-variety: no encounter two waves in a row (v1)', () => {
  /** v1's encounters each run over three or four waves in a row (the
   *  original slice 5 design), so every wave inside one repeats it. Known
   *  breaks, for phase 4 to fix: "wave a-b: id". */
  const EXPECTED_REPEATS: Record<string, string[]> = {
    strait: ['2-3: strait-ranging-shots', '3-4: strait-ranging-shots', '5-6: strait-screen', '6-7: strait-screen', '8-9: strait-rolling-push', '9-10: strait-rolling-push'],
    gauntlet: ['2-3: gauntlet-north-then-south', '3-4: gauntlet-north-then-south', '5-6: gauntlet-overlap', '6-7: gauntlet-overlap', '8-9: gauntlet-crossfire', '9-10: gauntlet-crossfire'],
    harbor: ['1-2: harbor-open-water', '2-3: harbor-open-water', '4-5: harbor-funnel-salvo', '5-6: harbor-funnel-salvo', '6-7: harbor-funnel-salvo', '8-9: harbor-last-mile', '9-10: harbor-last-mile'],
  };

  it('the back-to-back repeats are exactly the known ones', () => {
    const found: Record<string, string[]> = {};
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map, KEPT);
      found[map] = [];
      for (let k = 1; k < a.length; k++) {
        const prev = new Set(a[k - 1].encounters.map((e) => e.id));
        for (const e of a[k].encounters) if (prev.has(e.id)) found[map].push(`${a[k - 1].wave}-${a[k].wave}: ${e.id}`);
      }
    }
    expect(found).toEqual(EXPECTED_REPEATS);
  });
});

describe('w-encounter: an encounter on each of waves 1-10 (v1)', () => {
  /** Waves with no v1 encounter, per map (none today). */
  const EXPECTED_GAPS: Record<string, number[]> = { strait: [], gauntlet: [], harbor: [] };

  it('the waves without one are exactly the known gaps', () => {
    const found: Record<string, number[]> = {};
    for (const map of ENCOUNTER_MAPS) found[map] = Array.from({ length: PLAN_WAVES }, (_, k) => k + 1).filter((w) => encountersFor(map, w, KEPT).length === 0);
    expect(found).toEqual(EXPECTED_GAPS);
  });
});

describe('m-enemy: each kind\'s debut in the campaign', () => {
  /** "kind map wave", in campaign order (MAP_ORDER, then wave). */
  const EXPECTED_DEBUTS = [
    'drone strait 1', 'ballistic strait 2', 'sprinter strait 2', 'guided strait 3', 'hydra strait 3', 'rocketTruck strait 4',
    'strafer strait 5', 'supersonic strait 6', 'bomber strait 7', 'heavy strait 10',
    'cluster harbor 6', 'mothership harbor 7',
    'attackHeli island 2', 'torpedoSub island 3', 'armored island 4', 'scavenger island 5',
    'stealthJet battery 2', 'stealthBomber battery 3', 'diveBomber battery 4', 'siege battery 5', 'spotter battery 6',
    'mine sowers 1',
    'fastboat coves 1', 'tender coves 2', 'guard coves 3', 'lure coves 4', 'cloud coves 5',
  ];

  it('the debut table (printed below), and its debuts as the planner really sends them', () => {
    const table = debuts();
    console.info(`Debuts in campaign order:\n${table.map((d) => `  ${d.kind.padEnd(14)} ch ${d.chapter}  ${d.map.padEnd(9)} wave ${d.wave}${d.foe && d.foe !== d.kind ? `  (${d.foe})` : ''}`).join('\n')}`);
    expect(table.map((d) => `${d.kind} ${d.map} ${d.wave}`)).toEqual(EXPECTED_DEBUTS);
    // Each debut is in its kind's own chapter.
    for (const d of table) expect(d.chapter, d.kind).toBe(kindChapter(d.kind));
  });

  it('it covers every kind an encounter uses, and every new enemy', () => {
    const have = new Set(debuts().map((d) => d.kind));
    for (const e of ENCOUNTERS) {
      for (const b of e.beats) expect(have.has(b.kind), `${e.id}: ${b.kind}`).toBe(true);
      for (const p of e.pairs ?? []) for (const m of enemyPair(p.pair)!.members) expect(have.has(memberKind(m)), `${e.id}: ${m}`).toBe(true);
    }
    for (const f of FOE_ORDER) expect(have.has(FOES[f].kind), f).toBe(true);
  });

  it('the data\'s waves agree with the planner: a map\'s new enemies on the waves listed, nothing before its listed wave', () => {
    for (const map of MAP_ORDER) {
      const listed = mapKindWaves(map);
      // The debut rule is the game's own (sim/foes.ts).
      const lead = mapDebut(map);
      if (lead) expect(listed.get(FOES[lead].kind), `${map}: ${lead}`).toBe(2);
      const seen = new Map<ThreatKind, number>();
      const see = (k: ThreatKind, w: number) => seen.set(k, Math.min(seen.get(k) ?? Infinity, w));
      for (const seed of SEEDS) {
        for (let w = 1; w <= PLAN_WAVES; w++) {
          const g = createGame(map, seed, w);
          for (const k of [...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))]) if (!isFoe(k)) see(k, w);
        }
        for (const [w, ids] of runFoes(map, seed)) for (const id of ids) see(FOES[id].kind, w);
      }
      for (const [k, w] of seen) {
        const own = FOE_OF_KIND[k] ? FOES[FOE_OF_KIND[k]!].chapter === chapterOf(map) : true;
        // A kind the data lists is never sent before its listed wave; an
        // earlier chapter's foe (a random second or third foe) only from
        // the first wave with two.
        if (own) expect(w, `${map}: ${k}`).toBeGreaterThanOrEqual(listed.get(k) ?? Infinity);
        else expect(foeCount(w), `${map}: ${k} on wave ${w}`).toBeGreaterThanOrEqual(2);
      }
      // The chapter's own new enemies come exactly on their listed waves.
      for (const [k, w] of listed) if (FOE_OF_KIND[k]) expect(seen.get(k), `${map}: ${k}`).toBe(w);
    }
    // And each debut is sent on its debut wave by the planner.
    for (const d of debuts()) {
      const waves = SEEDS.map((seed) => {
        if (d.foe) return runFoes(d.map, seed).find(([, ids]) => ids.some((id) => FOES[id].kind === d.kind))?.[0];
        for (let w = 1; w <= PLAN_WAVES; w++) {
          const g = createGame(d.map, seed, w);
          if ([...g.queue.map((l) => l.kind), ...g.raiderQueue.flatMap((r) => r.units.map((u) => u.kind))].includes(d.kind)) return w;
        }
        return undefined;
      });
      expect(Math.min(...waves.map((w) => w ?? Infinity)), `${d.kind} on ${d.map}`).toBe(d.wave);
    }
  });
});
