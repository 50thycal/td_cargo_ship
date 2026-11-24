// Authored encounters for the three reference maps
// (docs/design/v3-map-convoy-lab-plan.md, §7, slice 5). Lab only: a game
// with no encounter layer plays the shared waves as it always has.
//
// What must hold: only enemies the map already has at that wave (or, said
// so, a version's guests: v3's enemy pairs); launchers that exist and sit
// where the map puts them; a wave no bigger than the shared one; a warning
// before every authored launch; the same thing every time; and the map's
// own event and the bonus wave untouched.
//
// Round 12 (docs/design/v3-round12-encounter-versions.md): three versions a
// map: v1 (the original nine, unchanged), v2 "Set pieces", v3 "Enemy pairs".

import { describe, expect, it } from 'vitest';
import { FIRESHIP, PLANE, RAID, SHIP, SOW, SUB, THREATS, TOW, VIEW } from '../../src/v3/data/config';
import {
  BUSY,
  ENCOUNTERS,
  ENCOUNTER_MAPS,
  FILLER_WEIGHT,
  ENCOUNTER_REV,
  ENCOUNTER_VERSIONS,
  LAYER_MAPS,
  MAP_VERSIONS,
  REBUILT_MAPS,
  CHAPTER_FOUR_MAPS,
  SPOTTER,
  hasEncounters,
  arc,
  calloutsOn,
  encountersFor,
  playsAt,
  MAP_BOSS,
  MAP_SIGNATURE,
  DREAD_PASSES,
  dreadPasses,
  MAP_FOE_SWAP,
  MAP_TIDE,
  TIDE_EBB,
  TIDE_LOW,
  tideClock,
  signatureOf,
  hiddenMinesOn,
  swapFoe,
  type BossRound,
  paradeBeats,
  versionDef,
  waveScale,
  type Encounter,
  type EncounterVersion,
} from '../../src/v3/data/encounters';
import { BOSS_FOES, FOE, FOES, FOES_BUILT, FOE_ORDER, HEAVY_FOES, foeCount, foeDebutTag, foesUpTo, type FoeId } from '../../src/v3/data/foes';
import { MAPS, MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { mapDebutsFoe } from '../../src/v3/data/mapRules';
import { OLD_THREATS, enemyPair, isOldThreat, memberKind } from '../../src/v3/data/pairs';
import { WAVE_TABLE, waveSpec } from '../../src/v3/data/waves';
import { flatsBand, sandEdge, tideAt, TIDE_TURN } from '../../src/v3/sim/tide';
import { laneLength, lanePoint, laneSamples } from '../../src/v3/sim/lanes';
import { CONVOY_REV } from '../../src/v3/data/convoy';
import { CARRIER_TARGET, aimBeat, tideNow, applyEncounters, createGame, damageThreat, highTide, lightFireShip, rigAt, rigStations, spawnThreat, step, towRig, vipRoute, type Game } from '../../src/v3/sim/game';
import { beaconMark } from '../../src/v3/sim/events';
import { crossingPair, isFoe, onLand, siegeSpotAt, truckMark } from '../../src/v3/sim/foes';
import { EV, bossIntroCards, eventName } from '../../src/v3/data/events';
import { lockstep, stateHash } from '../../src/v3/sim/mapLab';
import { BotRun, PERSONAS, playMimic } from '../../src/v3/sim/mimic';
import { LOG_VERSION, logTelemetry, replay } from '../../src/v3/sim/playlog';
import { reconcile, type TelEvent, type TelemetrySidecar } from '../../src/v3/sim/telemetry';

const DT = 1 / 60;
/** The Delta's boss test seed (tools/v3/delta/probe-boss.ts): the tryhard
 *  bot plays all three rounds of the Long Gauntlet there. */
const DELTA_BOSS_SEED = 220;
const ON = { rev: ENCOUNTER_REV };
const VER = (version: EncounterVersion, rev = ENCOUNTER_REV) => ({ rev, version });
/** The versions a map has: three on a reference map, the original (v1)
 *  only on a map rebuilt after them (chapter 1's Kesh and Marrow). */
const versionsOf = (map: Encounter['map']): EncounterVersion[] => (ENCOUNTER_MAPS.includes(map) ? ENCOUNTER_VERSIONS : ['v1']);
/** The last rev an encounter plays in (one replaced in rev 4 plays to 3). */
const lastRev = (e: Encounter) => e.until ?? ENCOUNTER_REV;

/** A wave of a map, with or without its encounters (v1 unless said, at
 *  encounter rev `rev`), nobody shooting, with telemetry: played to its end
 *  (or `seconds`). */
function wave(map: Encounter['map'], n: number, on: boolean, seed = 9, seconds = 90, version: EncounterVersion = 'v1', rev = ENCOUNTER_REV): { g: Game; sc: TelemetrySidecar } {
  const g = createGame(map, seed, n);
  if (on) applyEncounters(g, VER(version, rev));
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  logTelemetry(g, { id: 'enc-test', build: 'test', v: LOG_VERSION, firstWave: n, device: { w: 0, h: 0, dpr: 1, touch: false, ua: 'test' } }, 'sim', 'none');
  for (let i = 0; i < seconds / DT && g.phase === 'wave' && g.wave === n; i++) step(g, DT);
  return { g, sc: g.tel!.sidecar(g) };
}
const launches = (sc: TelemetrySidecar) => sc.events.filter((e): e is Extract<TelEvent, { k: 'thr+' }> => e.k === 'thr+' && e.pid === undefined && e.o !== 'structure' && !e.back);
/** A beat's launches among an encounter's: not part of an enemy pair (a
 *  pair's swarm is `paired`; its other members are the new enemies). */
const beatLaunch = (l: Extract<TelEvent, { k: 'thr+' }>) => !l.paired && !isFoe(l.kind);

/** An enemy pair's members by the game's own accounting: an original
 *  threat by its size, a new enemy as the drone swarm it stands in for (a
 *  heavy one a missile too), as the wave planner does. */
function pairCost(id: string, swarm: number): number {
  return enemyPair(id)!.members.reduce((a, m) => a + (isOldThreat(m) ? OLD_THREATS[m].size : Math.min(5, swarm - 1) + (HEAVY_FOES.includes(m as FoeId) ? 1 : 0)), 0);
}

/** What a freshly planned wave will send: its queue, its launchers' loads,
 *  and its enemy pairs' sets. `weighed`: a pair's new enemies by the
 *  game's accounting (pairCost) rather than one launch each. */
// An encounter's easy filler (log v47, Beat `filler`) weighs FILLER_WEIGHT
// of a launch, as the bot report's wave budget counts it.
const planned = (g: Game, weighed = false) =>
  g.queue.filter((l) => l.at < 1e8).reduce((a, l) => a + (l.filler ? FILLER_WEIGHT : 1), 0) +
  g.raiderQueue.reduce((a, r) => a + r.units.reduce((b, u) => b + u.size, 0), 0) +
  (g.enc?.sets ?? []).reduce(
    (a, s) =>
      a +
      [s.pair!.lead, ...s.pair!.follow.map((f) => f.foe)].reduce(
        (b, m) => b + (isOldThreat(m) ? OLD_THREATS[m].size : weighed ? Math.min(5, waveSpec(g.wave, g.map.threatScale).swarm - 1) + (HEAVY_FOES.includes(m as FoeId) ? 1 : 0) : 1),
        0,
      ),
    0,
  );

describe('a campaign run has no encounter layer', () => {
  it('a new game carries none, and its waves are the shared ones', () => {
    const g = createGame('strait', 3, 5);
    expect(g.enc).toBeNull();
    expect(g.queue.some((l) => l.enc)).toBe(false);
  });

  it('three versions on each reference map, none anywhere else: v1\'s nine unchanged, v2 four set pieces, v3 an encounter in most waves', () => {
    expect(new Set(ENCOUNTERS.map((e) => e.id)).size).toBe(ENCOUNTERS.length);
    expect(ENCOUNTER_VERSIONS).toEqual(['v1', 'v2', 'v3']);
    for (const map of ENCOUNTER_MAPS) {
      const of = (v: EncounterVersion) => ENCOUNTERS.filter((e) => e.map === map && e.version === v);
      // Rev 3 (round 12's fixes): wave 1's opener on top (Harbor Mouth's v1
      // already opens with its first encounter).
      const big = (v: EncounterVersion, rev = ENCOUNTER_REV) => of(v).filter((e) => !e.opener && playsAt(e, rev));
      // Rev 4 (map rebuild phase 4): the three maps' v1 plans are rebuilt, one
      // encounter a wave (docs/design/v3-p4-*.md): The Strait and The Gauntlet
      // keep wave 1's opener; Harbor Mouth's wave 1 is its own. A rev 3 log
      // still plays the original three.
      expect(big('v1', 3), map).toHaveLength(3);
      expect(big('v1'), map).toHaveLength(map === 'harbor' ? 10 : 9);
      expect(big('v2'), map).toHaveLength(4);
      expect(big('v3').length, map).toBeGreaterThanOrEqual(7);
      for (const v of ENCOUNTER_VERSIONS) expect(of(v).filter((e) => e.opener), `${map} ${v}`).toHaveLength(map === 'harbor' && v === 'v1' ? 0 : 1);
      for (const v of ENCOUNTER_VERSIONS) {
        const d = versionDef(map, v)!;
        expect(d.name.length, `${map} ${v}`).toBeGreaterThan(4);
        expect(d.idea.length, `${map} ${v}`).toBeGreaterThan(30);
      }
    }
    expect(ENCOUNTERS.filter((e) => e.version === 'v1' && !e.opener && playsAt(e, 3)).map((e) => e.id)).toEqual([
      'strait-ranging-shots', 'strait-screen', 'strait-rolling-push',
      'gauntlet-north-then-south', 'gauntlet-overlap', 'gauntlet-crossfire',
      'harbor-open-water', 'harbor-funnel-salvo', 'harbor-last-mile',
    ]);
    // The Strait's rev 4 plan: a different encounter on each of waves 2-10.
    expect(arc('strait').map((a) => a.encounters.map((e) => e.id).join())).toEqual([
      'strait-ranging-opener', 'strait-far-silo', 'strait-silo-to-silo', 'strait-periscope', 'strait-swarm-screen',
      'strait-both-ways', 'strait-down-the-lane', 'strait-sweep-east', 'strait-ambush', 'strait-final-approach',
    ]);
    for (const id of ['strait-ranging-shots', 'strait-screen', 'strait-rolling-push']) expect(ENCOUNTERS.find((e) => e.id === id)!.until, id).toBe(3);
    // Rev 4: the Gauntlet's three are replaced (until 3), its new plan one a wave.
    for (const id of ['gauntlet-north-then-south', 'gauntlet-overlap', 'gauntlet-crossfire']) expect(ENCOUNTERS.find((e) => e.id === id)!.until, id).toBe(3);
    expect(arc('gauntlet').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'gauntlet-north-south-opener', 'gauntlet-p4-shell-each-shore', 'gauntlet-p4-way-in', 'gauntlet-p4-periscope', 'gauntlet-p4-overlap',
      'gauntlet-p4-crossing', 'gauntlet-p4-strafing-run', 'gauntlet-p4-long-way-round', 'gauntlet-p4-crossfire', 'gauntlet-p4-run-the-gauntlet',
    ]);
    for (const e of ENCOUNTERS.filter((x) => x.id.startsWith('gauntlet-p4-'))) expect(e.rev, e.id).toBe(4);
    expect(ENCOUNTERS.filter((e) => e.map === 'harbor' && e.version === 'v1' && playsAt(e)).map((e) => [e.id, ...e.waves])).toEqual([
      ['harbor-first-look', 1], ['harbor-wide-water', 2], ['harbor-periscope', 3], ['harbor-south-headland', 4], ['harbor-funnel-tail', 5],
      ['harbor-both-headlands', 6], ['harbor-front-and-back', 7], ['harbor-wolf-pack', 8], ['harbor-crossfire', 9], ['harbor-final-mile', 10],
    ]);
    // The ones they replace keep playing in a rev 3 log, and only there.
    for (const id of ['harbor-open-water', 'harbor-funnel-salvo', 'harbor-last-mile']) {
      const e = ENCOUNTERS.find((x) => x.id === id)!;
      expect(e.until, id).toBe(3);
      expect(playsAt(e, 3), id).toBe(true);
      expect(playsAt(e, 4), id).toBe(false);
    }
    // Chapter 1's Kesh and Marrow (docs/design/v3-ch1-kesh.md,
    // v3-ch1-marrow.md): rev 4, the original (v1) only, one encounter a
    // wave; nothing at rev 3, so an older log plays them as it did.
    expect(REBUILT_MAPS).toEqual(['kesh', 'marrow', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'sowers', 'rigs', 'dreadnought', 'lantern', 'coves', 'delta', 'crossing', 'tide', 'citadel']);
    // Chapter 4, Open War (log v53): its own table, as chapter 3's; the
    // Delta (log v57), Dunmar Crossing (log v58), the Citadel (log v60) and the
    // Tide (log v61) join it.
    expect(CHAPTER_FOUR_MAPS).toEqual(['coves', 'delta', 'crossing', 'tide', 'citadel']);
    expect(arc('kesh').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'kesh-first-turn', 'kesh-long-reach', 'kesh-apex-shells', 'kesh-hook-periscope', 'kesh-two-banks',
      'kesh-bunch', 'kesh-strafe-the-turn', 'kesh-outer-bank', 'kesh-crossfire', 'kesh-round-the-hook',
    ]);
    expect(arc('marrow').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'marrow-under-the-sweep', 'marrow-shell-at-tower', 'marrow-under-the-island', 'marrow-shells-below', 'marrow-tower-or-ship',
      'marrow-both-shores', 'marrow-down-the-lane', 'marrow-wolf-pack', 'marrow-crossfire', 'marrow-last-stand',
    ]);
    // Chapter 2's Island and Behemoth Run (docs/design/v3-ch2-island.md,
    // v3-ch2-behemoth.md): the same.
    expect(arc('island').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'island-point-blank', 'island-far-shore', 'island-quiet-water', 'island-two-lanes', 'island-both-lanes',
      'island-behind', 'island-strafe', 'island-crossfire', 'island-north-gap', 'island-run-past',
    ]);
    expect(arc('behemoth').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'behemoth-first-tanker', 'behemoth-tanker-shell', 'behemoth-headland', 'behemoth-periscope', 'behemoth-tanker-or-convoy',
      'behemoth-both-sides', 'behemoth-strafe', 'behemoth-wolves', 'behemoth-heavies', 'behemoth-last-run',
    ]);
    // The Needle of Bosk (docs/design/v3-ch2-needle.md): the same.
    expect(arc('needle').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'needle-the-mouth', 'needle-open-water', 'needle-queue', 'needle-periscope', 'needle-both-headlands',
      'needle-way-out', 'needle-strafe', 'needle-heavy', 'needle-crossfire', 'needle-run',
    ]);
    // The Archipelago (docs/design/v3-ch2-archipelago.md): the same.
    expect(arc('archipelago').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'archipelago-west-islet', 'archipelago-gap', 'archipelago-front-back', 'archipelago-islet-chain', 'archipelago-both-ends',
      'archipelago-behind', 'archipelago-strafe', 'archipelago-both-gaps', 'archipelago-cluster', 'archipelago-run',
    ]);
    // Saltgate Canal (docs/design/v3-ch2-saltgate.md): the same.
    expect(arc('saltgate').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'saltgate-first-lock', 'saltgate-chamber', 'saltgate-both-locks', 'saltgate-cluster', 'saltgate-two-gates',
      'saltgate-periscope', 'saltgate-strafe', 'saltgate-both-chambers', 'saltgate-gate-by-gate', 'saltgate-climax',
    ]);
    // Chapter 3's Battery Point (docs/design/v3-ch3-battery.md): the same.
    expect(arc('battery').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'battery-guns', 'battery-ranging', 'battery-gap', 'battery-silence', 'battery-under-headland',
      'battery-both-ends', 'battery-dark-jet', 'battery-counter-battery', 'battery-crossfire', 'battery-last-light',
    ]);
    // Sowers' Reach (docs/design/v3-ch3-sowers.md, log v48): the same.
    expect(arc('sowers').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'sowers-current', 'sowers-gap', 'sowers-crossing', 'sowers-sown', 'sowers-hold',
      'sowers-two-fields', 'sowers-periscope', 'sowers-carpet', 'sowers-whole-reach', 'sowers-last-sowing',
    ]);
    // The Rig Field (docs/design/v3-ch3-rigs.md, log v49): the same.
    expect(arc('rigs').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'rigs-point-blank', 'rigs-bring-down', 'rigs-under', 'rigs-relief', 'rigs-rig-or-volley',
      'rigs-periscope', 'rigs-supersonic', 'rigs-two-tows', 'rigs-whole-field', 'rigs-last-tow',
    ]);
    // Dreadnought Pass (docs/design/v3-ch3-dreadnought.md, log v51): the same.
    expect(arc('dreadnought').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'dread-smoke', 'dread-long-reach', 'dread-first-pass', 'dread-spotted', 'dread-both-sides',
      'dread-gun-laying', 'dread-crossfire', 'dread-two-spotters', 'dread-gunline', 'dread-full-ahead',
    ]);
    // The Black Strait, the Lantern (docs/design/v3-ch3-lantern.md, log v52): the same.
    expect(arc('lantern').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'lantern-first-light', 'lantern-from-behind', 'lantern-both-banks', 'lantern-gun-in-the-dark', 'lantern-periscope',
      'lantern-front-and-back', 'lantern-two-guns', 'lantern-dark-water', 'lantern-crossfire', 'lantern-last-light',
    ]);
    // The Coves (docs/design/v3-ch4-coves.md, log v53): the same.
    expect(arc('coves').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'coves-white-wake', 'coves-cove-by-cove', 'coves-south-cove', 'coves-fire-ship', 'coves-two-ends',
      'coves-periscope', 'coves-crossfire', 'coves-north-shore', 'coves-facing', 'coves-every-cove',
    ]);
    // Chapter 4's Delta (docs/design/v3-ch4-delta.md, log v57; the long river, log v68): the same.
    expect(arc('delta').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'delta-long-river', 'delta-round-the-bend', 'delta-island-guns', 'delta-truck-bank', 'delta-both-ends',
      'delta-island', 'delta-down-the-river', 'delta-every-leg', 'delta-trucks-and-raid', 'delta-the-long-run',
    ]);
    // Dunmar Crossing (docs/design/v3-ch4-crossing.md, log v58): the same.
    expect(arc('crossing').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'crossing-two-fronts', 'crossing-shore-to-shore', 'crossing-meeting', 'crossing-spotter', 'crossing-both-edges',
      'crossing-periscopes', 'crossing-two-spotters', 'crossing-crossfire', 'crossing-passing-fire', 'crossing-the-crossing',
    ]);
    // The Citadel (docs/design/v3-ch4-citadel.md, log v60), the game's last map: the same.
    expect(arc('citadel').map((a) => a.encounters.map((e) => e.id).join('+'))).toEqual([
      'citadel-under-the-guns', 'citadel-generators', 'citadel-narrows', 'citadel-dome', 'citadel-two-ends',
      'citadel-periscope', 'citadel-keep', 'citadel-crossfire', 'citadel-fortress', 'citadel-grand-salvo',
    ]);
    for (const map of REBUILT_MAPS) {
      expect(hasEncounters(map), map).toBe(true);
      for (const e of ENCOUNTERS.filter((x) => x.map === map)) {
        expect(e.rev, e.id).toBe(4);
        expect(e.version, e.id).toBe('v1');
        expect(playsAt(e, 3), e.id).toBe(false);
      }
      for (let w = 1; w <= 10; w++) {
        expect(encountersFor(map, w, 'v1', 3), `${map} wave ${w}`).toEqual([]);
        for (const v of ['v2', 'v3'] as const) expect(encountersFor(map, w, v), `${map} ${v}`).toEqual([]);
      }
      expect(versionDef(map, 'v1')!.idea.length, map).toBeGreaterThan(30);
      expect(versionDef(map, 'v2'), map).toBeUndefined();
    }
    // Every map has its own since the Tide and the Citadel (log v61, v60).
    expect(MAP_ORDER.filter((m) => !hasEncounters(m))).toEqual([]);
    expect(LAYER_MAPS).toEqual([...ENCOUNTER_MAPS, ...REBUILT_MAPS]);
    for (const e of ENCOUNTERS) for (const k of ['name', 'premise', 'decision', 'counters', 'succeeds', 'callout'] as const) expect(e[k].length, `${e.id}.${k}`).toBeGreaterThan(k === 'name' ? 4 : 10);
    // The call-out is short: it sits in a corner card on a phone.
    for (const e of ENCOUNTERS) expect(e.callout.length, e.id).toBeLessThanOrEqual(42);
  });

  it('v1 is the original: no wave budget of its own on the reference maps, no call-outs, no pairs', () => {
    for (const map of LAYER_MAPS) {
      expect(versionDef(map, 'v1')!.callouts, map).toBe(false);
      // Log v30: Kesh and Marrow move a little of their shared waves' fire
      // from waves 9-10 to waves 2-7 (a climb, not a cliff), within ±15% of
      // each wave and never more than the ten.
      if ((REBUILT_MAPS as string[]).includes(map)) {
        const scale = Array.from({ length: 10 }, (_, k) => waveScale(map, 'v1', k + 1));
        expect(scale.reduce((a, b) => a + b, 0), map).toBeLessThanOrEqual(10 + 1e-9);
        for (const x of scale) expect(Math.abs(x - 1), map).toBeLessThanOrEqual(0.15 + 1e-9);
        expect(waveScale(map, 'v1', 11)).toBe(1);
        continue;
      }
      expect(versionDef(map, 'v1')!.scale, map).toBeUndefined();
      for (let w = 1; w <= 10; w++) expect(waveScale(map, 'v1', w)).toBe(1);
    }
    for (const e of ENCOUNTERS.filter((x) => x.version === 'v1')) expect(e.pairs, e.id).toBeUndefined();
  });
});

describe('every beat is legal on its map at its wave', () => {
  it('only enemies the map already has by then (never a later chapter\'s), from launchers that carry them', () => {
    for (const e of ENCOUNTERS) {
      const m = MAPS[e.map];
      for (const w0 of e.waves) {
        expect(w0, e.id).toBeGreaterThanOrEqual(1);
        expect(w0, e.id).toBeLessThanOrEqual(10);
        // Wave 1's opener (rev 3) may preview what the map has by wave 2
        // (the first shell, the first periscope), never anything later.
        const w = e.opener ? (expect(w0, e.id).toBe(1), 2) : w0;
        const table = WAVE_TABLE[w - 1];
        for (const b of e.beats) {
          const where = `${e.id} wave ${w}: ${b.kind}`;
          // In the shared table by this wave, or one of the map's own extras by this wave.
          const inTable = b.kind === 'drone' || (b.kind === 'ballistic' && table.ballistic > 0) || (b.kind === 'guided' && table.guided > 0);
          const extra = m.extras.some((x) => x.kind === b.kind && x.from <= w);
          const plane = (b.kind === 'strafer' && w >= m.vectors.strafers) || (b.kind === 'bomber' && w >= m.vectors.bombers);
          // Log v42 (Saltgate Canal): a Rocket Truck down a pop-up road, an
          // enemy of the map's chapter or before, from wave 2 (the first a
          // wave sends a new enemy).
          const truck = 'road' in b.from && b.kind === 'rocketTruck' && w >= 2 && foesUpTo(chapterOf(e.map)).includes('rocketTruck');
          // Log v48 (Sowers' Reach): a stealth bomber from an edge, an enemy
          // of the map's chapter or before, from its signature's first wave
          // (the wave's own new enemies come as stealth bombers from then).
          // Log v51 (Dreadnought Pass): the same for its signature's spotter
          // planes.
          const sig = MAP_SIGNATURE[e.map as keyof typeof MAP_SIGNATURE];
          const sower = 'air' in b.from && (b.kind === 'stealthBomber' || b.kind === sig?.foe) && foesUpTo(chapterOf(e.map)).includes(b.kind as FoeId) && w >= (sig?.from ?? 99);
          // Log v49 (The Rig Field): a relief rig towed in from an edge, from
          // its signature's first wave (the wave's own new enemies come as
          // relief rigs from then), on a map with rigs.
          const tow = 'air' in b.from && b.kind === 'rig' && MAP_SIGNATURE[e.map as keyof typeof MAP_SIGNATURE]?.kind === 'rig' && m.bases.some((x) => x.rig) && w >= (MAP_SIGNATURE[e.map as keyof typeof MAP_SIGNATURE]?.from ?? 99);
          // Log v52 (the Black Strait): a siege gun beside a base on the
          // enemy's dark bank (the signature's `beside`), an enemy of the
          // map's chapter or before, from the signature's first wave.
          const gun = 'base' in b.from && b.kind === 'siege' && foesUpTo(chapterOf(e.map)).includes('siege') && w >= (sig?.from ?? 99) && !!sig?.beside?.includes(b.from.base);
          // Log v57 (the Delta): an Incendiary Missile out of a base, an
          // enemy of the map's chapter or before, from its signature's first
          // wave (the wave's own new enemies come as incendiaries from then).
          const firebomb = 'base' in b.from && b.kind === 'cloud' && foesUpTo(chapterOf(e.map)).includes('cloud') && MAP_SIGNATURE[e.map as keyof typeof MAP_SIGNATURE]?.foe === 'cloud' && w >= (MAP_SIGNATURE[e.map as keyof typeof MAP_SIGNATURE]?.from ?? 99);
          // Log v58 (Dunmar Crossing): a spotter beacon rising at the
          // crossing, the signature's own enemy, from its first wave.
          const spotter = 'water' in b.from && b.kind === 'lure' && sig?.foe === 'lure' && !!sig.beacons && foesUpTo(chapterOf(e.map)).includes('lure') && w >= sig.from;
          expect(inTable || extra || plane || truck || sower || tow || gun || firebomb || spotter, where).toBe(true);
          if (gun) expect(m.bases[(b.from as { base: number }).base], where).toBeDefined();
          else if ('base' in b.from) {
            const base = m.bases[b.from.base];
            expect(base, where).toBeDefined();
            if (!firebomb) expect(base.kinds, where).toContain(b.kind);
          } else if ('road' in b.from) {
            expect(m.roads.popups[b.from.road], where).toBeDefined();
            expect(b.kind, where).toBe('rocketTruck');
          } else if ('sub' in b.from) {
            expect(w, where).toBeGreaterThanOrEqual(m.vectors.subs);
            expect(['ballistic', 'drone'], where).toContain(b.kind);
            expect(m.subSpots[b.from.sub], where).toBeDefined();
          } else expect(plane || sower || tow || spotter, where).toBe(true);
          expect(b.count, where).toBeGreaterThan(0);
          expect(b.at, where).toBeGreaterThanOrEqual(0);
          expect(b.at, where).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('an enemy pair is one of the pairs, each member the map\'s own by its chapter or a guest its version names', () => {
    for (const e of ENCOUNTERS) {
      if (!e.pairs) continue;
      expect(e.version, e.id).toBe('v3');
      const guests = versionDef(e.map, e.version)!.guests ?? [];
      const own = foesUpTo(chapterOf(e.map));
      for (const p of e.pairs) {
        const pair = enemyPair(p.pair);
        expect(pair, `${e.id}: ${p.pair}`).toBeDefined();
        for (const m of pair!.members) if (!isOldThreat(m)) expect(own.includes(m) || guests.includes(m), `${e.id}: ${m} is neither the map's nor a guest`).toBe(true);
        if (p.base !== undefined) {
          const base = MAPS[e.map].bases[p.base];
          expect(base, e.id).toBeDefined();
          expect(base.kinds.length, `${e.id}: base ${p.base} launches`).toBeGreaterThan(0);
        }
        expect(p.at, e.id).toBeGreaterThanOrEqual(0);
        expect(p.at, e.id).toBeLessThanOrEqual(1);
      }
    }
    // Every guest is used by one of its version's pairs, and none is one the map has anyway.
    for (const map of ENCOUNTER_MAPS) {
      const d = versionDef(map, 'v3')!;
      const used = new Set(ENCOUNTERS.filter((e) => e.map === map && e.version === 'v3').flatMap((e) => (e.pairs ?? []).flatMap((p) => enemyPair(p.pair)!.members)));
      for (const gst of d.guests ?? []) {
        expect(used.has(gst), `${map}: guest ${gst} unused`).toBe(true);
        expect(foesUpTo(chapterOf(map)), `${map}: ${gst} is no guest`).not.toContain(gst);
      }
    }
  });

  it('every launcher sits where the map puts it: a base on the map, a submarine on open water', () => {
    for (const e of ENCOUNTERS) {
      const g = createGame(e.map, 1, e.waves[0]);
      for (const b of e.beats) {
        const p = 'base' in b.from ? g.map.bases[b.from.base] : 'sub' in b.from ? g.map.subSpots[b.from.sub] : null;
        if (!p) continue;
        expect(p.x > 0 && p.x < VIEW.width && p.y > 0 && p.y < VIEW.height, e.id).toBe(true);
        if ('sub' in b.from) expect(onLand(g, p.x, p.y), `${e.id}: a submarine on land`).toBe(false);
      }
    }
  });

  it('an encounter takes out of the wave what it sends: a wave with one is no bigger than the shared wave', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    for (const version of ENCOUNTER_VERSIONS)
      for (const map of LAYER_MAPS.filter((m) => versionsOf(m).includes(version)))
        for (let w = 1; w <= 10; w++) {
          const list = encountersFor(map, w, version);
          if (!list.length) continue;
          // By the books: what it sends from bases and submarines is covered,
          // launch for launch, by what it takes out (a missile the scaled-down
          // table can't give comes out of the drones). An aircraft stands in
          // for a small drone swarm, as the game's own aircraft do; an enemy
          // pair's new enemies as the game's own new enemies do.
          const spec = waveSpec(w, MAPS[map].threatScale);
          for (const e of list) {
            // (Its easy filler, log v47, is on top of the wave by design: it
            // is held to the wave as planned below, at its weight.)
            const sent = e.beats.filter((b) => !b.filler).reduce((a, b) => a + ('air' in b.from ? Math.min(5, spec.swarm - 1) * b.count : b.count), 0) + (e.pairs ?? []).reduce((a, p) => a + (p.count ?? 1) * pairCost(p.pair, spec.swarm), 0);
            const asked = (e.replaces.drones ?? 0) + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0);
            // Phase 4 (The Strait, docs/design/v3-p4-strait.md): an encounter
            // that takes every shell of its wave also takes the shells the
            // wave's submarines would have topped up (a sub with one shell
            // fills a salvo of four), which the books don't see. It is held
            // to the wave as planned instead (below).
            const allShells = spec.ballistic > 0 && (e.replaces.ballistic ?? 0) >= spec.ballistic && (e.rev ?? 1) >= 4;
            // (The Coves, log v53: its fast boats are the map's own extras, and
            // an encounter's boats come out of the wave's own, one for one.)
            const extras = e.map === 'coves' ? MAPS.coves.extras.filter((x) => x.from <= w).reduce((a, x) => a + Math.min(e.replaces.extras?.[x.kind] ?? 0, Math.round(x.count + x.growth * (w - x.from))), 0) : 0;
            if (!allShells) expect(sent, `${e.id} wave ${w}: sends ${sent}, takes out ${asked + extras}`).toBeLessThanOrEqual(asked + extras);
            expect(asked, `${e.id} wave ${w}: the wave has that much to give`).toBeLessThanOrEqual(spec.drones + spec.ballistic + spec.guided);
          }
          // And as planned: over eight seeds, no more launches than the same
          // version's wave with no encounter on the same dice, give or take
          // the game's own rounding (a submarine always fires a full salvo,
          // so a missile taken from one is topped back up), and not a
          // hollowed-out wave either (an enemy pair's new enemies weighed as
          // the game weighs them: a few launches that each fire many times).
          const shared = mean(
            seeds.map((seed) => {
              const g = createGame(map, seed, w);
              applyEncounters(g, { ...VER(version), only: [] });
              expect(g.enc!.played).toEqual([]);
              return planned(g);
            }),
          );
          const games = seeds.map((seed) => {
            const g = createGame(map, seed, w);
            applyEncounters(g, VER(version));
            return g;
          });
          const got = mean(games.map((g) => planned(g)));
          const weight = mean(games.map((g) => planned(g, true)));
          expect(got, `${map} ${version} wave ${w}: ${got.toFixed(1)} launches against the shared wave's ${shared.toFixed(1)}`).toBeLessThanOrEqual(shared + 2);
          expect(weight, `${map} ${version} wave ${w}`).toBeGreaterThanOrEqual(shared * 0.6);
        }
  });

  it('a version\'s wave budget moves fire between its waves, never adds to the ten', () => {
    for (const map of ENCOUNTER_MAPS)
      for (const v of ENCOUNTER_VERSIONS) {
        const scale = Array.from({ length: 10 }, (_, k) => waveScale(map, v, k + 1));
        const total = scale.reduce((a, b) => a + b, 0);
        expect(total, `${map} ${v}`).toBeLessThanOrEqual(10);
        for (const s of scale) {
          expect(s, `${map} ${v}`).toBeGreaterThanOrEqual(0.6);
          expect(s, `${map} ${v}`).toBeLessThanOrEqual(1.25);
        }
        // Past the tenth wave (the boss rounds, endless) nothing is scaled.
        expect(waveScale(map, v, 11)).toBe(1);
      }
    // A quiet v2 wave plans fewer launches than the same wave in v1 on the same dice.
    const g1 = createGame('strait', 4, 4);
    applyEncounters(g1, { ...VER('v1'), only: [] });
    const g2 = createGame('strait', 4, 4);
    applyEncounters(g2, VER('v2'));
    expect(encountersFor('strait', 4, 'v2')).toEqual([]);
    expect(planned(g2)).toBeLessThan(planned(g1));
  });
});

describe('every authored launch is warned of', () => {
  it('a base lights up a raid\'s warning before it fires; a submarine shows its periscope; an aircraft its arrow', () => {
    for (const e of ENCOUNTERS) {
      const w = e.waves[e.waves.length - 1];
      const { sc } = wave(e.map, w, true, 9, 90, e.version, lastRev(e));
      const mine = launches(sc).filter((l) => l.enc === e.id && beatLaunch(l));
      // Log v43 (Battery Point, MAP_SIGNATURE `stealth`): a jet comes in
      // dark from the signature's first wave, a Stealth Strafer with no
      // arrow (the Blackout's own: only its short run-in); it came, tagged.
      const dark = (b: Encounter['beats'][number]) => b.kind === 'strafer' && !!signatureOf(e.map, w, { rev: lastRev(e) })?.stealth;
      // (Log v49: a relief rig is towed in, a structure on the water, not a
      // launch: its tow is its own warning, slow along the rig line; the
      // Rig Field's tests check it docks.)
      const want = e.beats.filter((b) => !isFoe(b.kind) && !dark(b) && b.kind !== 'rig').reduce((a, b) => a + b.count, 0);
      expect(mine.length, `${e.id}: all its launches came`).toBe(want);
      const darkWant = e.beats.filter(dark).reduce((a, b) => a + b.count, 0);
      expect(launches(sc).filter((l) => l.enc === e.id && l.kind === 'stealthJet').length, `${e.id}: its jets came in dark`).toBe(darkWant);
      // Log v42 (Saltgate Canal): a truck down a road is its own warning (it
      // drives in, then raises its launcher): it came, tagged.
      for (const b of e.beats.filter((x) => 'road' in x.from)) {
        const trucks = launches(sc).filter((l) => l.enc === e.id && l.kind === b.kind);
        expect(trucks.length, `${e.id}: its ${b.kind} came`).toBe(b.count);
      }
      for (const l of mine) {
        // (Log v55: the Sowers' mines drift hidden, unwarned: HIDDEN_MINES.)
        if (l.kind === 'mine' && hiddenMinesOn(e.map, { rev: lastRev(e) })) continue;
        if (l.o === 'base') {
          const warn = sc.events.filter((o): o is Extract<TelEvent, { k: 'warn' }> => o.k === 'warn' && o.what === 'raid' && !!o.bases?.includes(l.base!) && o.t <= l.t);
          const first = Math.max(...warn.map((o) => o.t));
          // Within the raid it belongs to, and that raid was warned of its full time ahead.
          expect(warn.length, `${e.id}: ${l.kind} from base ${l.base} at ${l.t.toFixed(1)} s`).toBeGreaterThan(0);
          expect(warn.some((o) => l.t - o.t >= RAID.warn - 0.1 && l.t - o.t < RAID.warn + 8), `${e.id}: warned ${(l.t - first).toFixed(1)} s ahead`).toBe(true);
        } else if (l.o === 'sub') {
          const up = sc.events.find((o) => o.k === 'rdr' && o.id === l.from && o.st === 'warn');
          expect(up, e.id).toBeDefined();
          expect(l.t - up!.t, e.id).toBeGreaterThanOrEqual(SUB.warn + SUB.surface - 0.05);
        } else {
          // Its own arrow, the warning's time ahead (the Needle of Bosk, log
          // v35: another jet of the wave may be warned of in between, so not
          // only the latest arrow).
          const arrows = sc.events.filter((o) => o.k === 'warn' && o.what === 'aircraft' && o.t <= l.t);
          expect(arrows.length, e.id).toBeGreaterThan(0);
          expect(arrows.some((o) => l.t - o.t >= PLANE.warn - 0.1 && l.t - o.t <= PLANE.warn + 0.5), `${e.id}: an arrow ${PLANE.warn} s ahead`).toBe(true);
        }
      }
      // The wave says which encounter it carried.
      expect(sc.events.filter((o) => o.k === 'env' && o.what === 'encounter').map((o) => (o as { st: string }).st)).toContain(e.id);
    }
  }, 120_000);

  it('an enemy pair comes whole, its members tagged with the encounter, and a lead out of a named base lights it first', () => {
    for (const e of ENCOUNTERS.filter((x) => x.pairs)) {
      const w = e.waves[e.waves.length - 1];
      const { sc } = wave(e.map, w, true, 9, 120, e.version);
      const mine = sc.events.filter((l): l is Extract<TelEvent, { k: 'thr+' }> => l.k === 'thr+' && l.enc === e.id);
      for (const p of e.pairs!) {
        const pair = enemyPair(p.pair)!;
        for (const m of pair.members) {
          const kind = memberKind(m);
          // A Bodyguard Ring's guards; a sub comes up from its periscope.
          expect(mine.some((l) => l.kind === kind || (kind === 'guard' && l.kind === 'guard')), `${e.id}: ${m} came, tagged`).toBe(true);
        }
        if (p.base !== undefined) {
          // (Another pair's swarm may leave the same base: one of these is the lead.)
          const leads = mine.filter((l) => l.kind === memberKind(pair.pair.lead) && l.base === p.base);
          expect(leads.length, `${e.id}: its lead from base ${p.base}`).toBeGreaterThan(0);
          const warned = leads.some((lead) => sc.events.some((o) => o.k === 'warn' && o.what === 'raid' && !!o.bases?.includes(p.base!) && lead.t - o.t >= RAID.warn - 0.1 && lead.t - o.t < RAID.warn + 1));
          expect(warned, `${e.id}: base ${p.base} lit ${RAID.warn} s before its lead`).toBe(true);
        }
      }
    }
  }, 120_000);
});

describe('call-outs (round 12)', () => {
  it('v2 names each encounter as its first warning shows; v1 and v3 only when a run asks', () => {
    for (const map of ENCOUNTER_MAPS) {
      expect(calloutsOn(map, VER('v2')), map).toBe(true);
      expect(calloutsOn(map, VER('v1')), map).toBe(false);
      expect(calloutsOn(map, VER('v3')), map).toBe(false);
      expect(calloutsOn(map, { ...VER('v1'), callouts: true }), map).toBe(true);
      expect(calloutsOn(map, { ...VER('v2'), callouts: false }), map).toBe(false);
    }
    const calls = (map: Encounter['map'], n: number, setup: Parameters<typeof applyEncounters>[1]) => {
      const g = createGame(map, 9, n);
      applyEncounters(g, setup);
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = 999;
      const seen: { id: string; t: number }[] = [];
      for (let i = 0; i < 90 / DT && g.phase === 'wave' && g.wave === n; i++) {
        step(g, DT);
        for (const ev of g.events) if (ev.kind === 'encounter') seen.push({ id: ev.id, t: g.waveT });
        g.events.length = 0;
      }
      return { g, seen };
    };
    for (const e of ENCOUNTERS.filter((x) => x.version === 'v2')) {
      const w = e.waves[0];
      const { g, seen } = calls(e.map, w, VER('v2'));
      expect(seen.map((s) => s.id), e.id).toEqual([e.id]);
      // At its first warning: a raid's lit bases, a periscope, an arrow.
      const firstLaunch = Math.min(...g.raids.filter((r) => r.bases.length).map((r) => r.at));
      expect(seen[0].t, e.id).toBeLessThan(firstLaunch + 60);
    }
    // v1 says nothing; v1 with call-outs asked for names its encounter.
    expect(calls('strait', 6, VER('v1')).seen).toEqual([]);
    expect(calls('strait', 6, { ...VER('v1'), callouts: true }).seen.map((s) => s.id)).toEqual(['strait-both-ways']);
    expect(calls('strait', 6, { rev: 3, version: 'v1', callouts: true }).seen.map((s) => s.id)).toEqual(['strait-screen']);
  }, 60_000);

  it('the call-out comes as the warning starts: a raid\'s warning time before the set piece\'s first launch', () => {
    const g = createGame('gauntlet', 9, 3);
    applyEncounters(g, VER('v2'));
    const c = g.enc!.calls[0];
    expect(c.id).toBe('gauntlet-v2-pincer');
    const first = Math.min(...g.queue.filter((l) => l.enc === 'gauntlet-v2-pincer').map((l) => l.at));
    expect(first - c.at).toBeCloseTo(RAID.warn, 5);
  });
});


describe('each encounter is what it says', () => {
  // The Strait's rev 3 plan (replaced in rev 4, docs/design/v3-p4-strait.md):
  // a rev 3 log still plays it.
  it('The Strait, ranging shots (rev 3): two shells from the middle base alone, at the ship furthest along', () => {
    const { sc } = wave('strait', 3, true, 9, 90, 'v1', 3);
    const mine = launches(sc).filter((l) => l.enc === 'strait-ranging-shots');
    expect(mine.map((l) => [l.kind, l.base])).toEqual([['ballistic', 1], ['ballistic', 1]]);
    expect(mine[1].t - mine[0].t).toBeCloseTo(1.6, 1);
    // Nothing else leaves that base in the two seconds round them: one warning, one place.
    const near = launches(sc).filter((l) => !l.enc && l.base === 1 && Math.abs(l.t - mine[0].t) < 1);
    expect(near).toEqual([]);
    for (const l of mine) expect(l.tg, 'aimed at a ship').toBeGreaterThan(0);
  });

  it('The Strait, the screen (rev 3): a swarm, then a guided missile from the same pad behind it', () => {
    const { sc } = wave('strait', 6, true, 9, 90, 'v1', 3);
    const mine = launches(sc).filter((l) => l.enc === 'strait-screen');
    const drones = mine.filter((l) => l.kind === 'drone');
    const missile = mine.find((l) => l.kind === 'guided')!;
    expect(drones).toHaveLength(6);
    expect(new Set(mine.map((l) => l.base))).toEqual(new Set([2]));
    expect(missile.t).toBeGreaterThan(drones[0].t + 1);
    expect(missile.t).toBeLessThan(drones.at(-1)!.t + 1);
  });

  it('The Gauntlet, crossfire (rev 3, slice 5\'s): both shores open in the same half second, then a strafing run', () => {
    const { g, sc } = wave('gauntlet', 9, true, 9, 90, 'v1', 3);
    const mine = launches(sc).filter((l) => l.enc === 'gauntlet-crossfire');
    const north = mine.filter((l) => l.o === 'base' && g.map.bases[l.base!].y < 450);
    const south = mine.filter((l) => l.o === 'base' && g.map.bases[l.base!].y > 450);
    expect(north.length).toBeGreaterThanOrEqual(4);
    expect(south.length).toBeGreaterThanOrEqual(4);
    expect(Math.abs(north[0].t - south[0].t)).toBeLessThan(0.5);
    const jet = mine.find((l) => l.kind === 'strafer')!;
    expect(jet.o).toBe('air');
    expect(jet.t - north[0].t).toBeGreaterThan(2);
  });

  it('Harbor Mouth, funnel salvo (rev 3): a submarine off the narrows fires its salvo at the ships nearest the mouth', () => {
    const { g, sc } = wave('harbor', 5, true, 9, 90, 'v1', 3);
    const mine = launches(sc).filter((l) => l.enc === 'harbor-funnel-salvo');
    expect(mine).toHaveLength(4);
    const spot = g.map.subSpots[1];
    for (const l of mine) expect(l).toMatchObject({ o: 'sub', kind: 'ballistic', x: spot.x, y: spot.y });
    const mouth = g.map.channels[0].narrow!.fromX;
    // Each shell's landing point is in the funnel's mouth or just inside it.
    for (const l of mine) expect(l.ix!, `lands at x ${l.ix}`).toBeGreaterThan(mouth - 260);
    for (const l of mine) expect(l.ix!).toBeLessThan(mouth + 420);
  });

  it('Harbor Mouth, open water (rev 3): waves 1 to 3 aim nothing of the encounter\'s into the narrows', () => {
    const { sc } = wave('harbor', 2, true, 9, 90, 'v1', 3);
    const mine = launches(sc).filter((l) => l.enc === 'harbor-open-water');
    expect(mine).toHaveLength(5);
    expect(new Set(mine.map((l) => l.base))).toEqual(new Set([0]));
  });

  it('Harbor Mouth (rev 4): the subs\' salvos land in the neck, and the wave\'s own subs still fire theirs', () => {
    // Funnel and tail (wave 5): its sub off the narrows, three shells at the
    // ship nearest the mouth; the wave's own two subs keep their salvos (rev
    // 3's Funnel salvo took the wave's shells and emptied them).
    const { g, sc } = wave('harbor', 5, true);
    const mine = launches(sc).filter((l) => l.enc === 'harbor-funnel-tail' && l.kind === 'ballistic');
    expect(mine).toHaveLength(3);
    const spot = g.map.subSpots[1];
    for (const l of mine) expect(l).toMatchObject({ o: 'sub', x: spot.x, y: spot.y });
    const mouth = g.map.channels[0].narrow!.fromX;
    for (const l of mine) expect(l.ix!, `lands at x ${l.ix}`).toBeGreaterThan(mouth - 260);
    const own = launches(sc).filter((l) => !l.enc && l.o === 'sub' && l.kind === 'ballistic');
    expect(own.length).toBe(8);
  });

  it('Harbor Mouth (rev 4): a breath before the climax, nothing of the wave\'s own in the 5 s before it', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const g = createGame('harbor', seed, 10);
      applyEncounters(g, VER('v1'));
      const climax = Math.min(...g.queue.filter((l) => l.enc === 'harbor-final-mile').map((l) => l.at));
      const own = [
        ...g.queue.filter((l) => !l.enc && l.at < 1e8).map((l) => l.at),
        ...g.raiderQueue.filter((r) => !r.enc).flatMap((r) => r.units.map((_, k) => r.at + SUB.warn + SUB.surface + k * SUB.gap)),
      ];
      const before = own.filter((t) => t < climax);
      expect(climax - Math.max(...before), `seed ${seed}`).toBeGreaterThanOrEqual(5 - 0.01);
      // Rev 3 had none.
      const old = createGame('harbor', seed, 10);
      applyEncounters(old, { rev: 3, version: 'v1' });
      expect(old.queue.some((l) => l.enc === 'harbor-final-mile')).toBe(false);
    }
  });
});

describe('chapter 1\'s Kesh and Marrow (rev 4): the aims they bring', () => {
  /** Each launch of an encounter as it leaves: its threat, and the ships on
   *  the water then. Nobody shoots. */
  function aimed(map: Encounter['map'], n: number, id: string, before?: (g: Game) => void) {
    const g = createGame(map, 9, n);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    before?.(g);
    const seen = new Set<number>();
    const out: { th: Game['threats'][number]; ships: Game['ships'] }[] = [];
    for (let i = 0; i < 90 / DT && g.phase === 'wave' && g.wave === n; i++) {
      step(g, DT);
      // (Its easy filler, log v47, is aimed at no one in particular.)
      for (const th of g.threats)
        if (th.enc === id && !th.filler && !seen.has(th.id)) {
          seen.add(th.id);
          out.push({ th: { ...th }, ships: g.ships.map((s) => ({ ...s })) });
        }
    }
    return { g, out };
  }
  const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('The Kesh Hook: the south silo\'s fire goes at the ship nearest it, the one rounding the apex', () => {
    // Shells at the apex (wave 3; log v30, timed to land with the swarm): a
    // swarm and three shells from the silo, all at the ship nearest it, and
    // two shells from the sub inside the hook at the same moment.
    const { g, out: all } = aimed('kesh', 3, 'kesh-apex-shells');
    expect(all).toHaveLength(10);
    const silo = g.map.bases[0];
    const out = all.filter(({ th }) => th.sx === silo.x && th.sy === silo.y);
    expect(out).toHaveLength(8);
    const shells = out.filter((o) => o.th.kind === 'ballistic');
    expect(shells).toHaveLength(3);
    for (const { th, ships } of shells) {
      expect({ x: th.sx, y: th.sy }).toEqual({ x: silo.x, y: silo.y });
      const target = ships.find((s) => s.id === th.target)!;
      expect(target, `${th.kind} ${th.id}`).toBeDefined();
      // The nearest ship it could aim at (a shell only reaches ships west of x 1280).
      const pool = ships.filter((s) => th.kind !== 'ballistic' || s.x <= VIEW.width - 320);
      expect(d(target, silo)).toBeCloseTo(Math.min(...pool.map((s) => d(s, silo))), 3);
    }
  });

  it('Lee of Marrow: a shot at the radar tower while it stands; once it is gone, at the ship nearest where it stood', () => {
    const tower = MAPS.marrow.posts![0];
    const up = aimed('marrow', 2, 'marrow-shell-at-tower');
    const shell = up.out.find((o) => o.th.kind === 'ballistic')!;
    // Allied posts are targets -10, -11, ...: the tower is post 0.
    expect(shell.th.target).toBe(-10);
    const down = aimed('marrow', 2, 'marrow-shell-at-tower', (g) => {
      g.posts[0].hp = 0;
      g.posts[0].lost = true;
    });
    const s2 = down.out.find((o) => o.th.kind === 'ballistic')!;
    const target = s2.ships.find((s) => s.id === s2.th.target)!;
    expect(target).toBeDefined();
    const pool = s2.ships.filter((s) => s.x <= VIEW.width - 320);
    expect(d(target, tower)).toBeCloseTo(Math.min(...pool.map((s) => d(s, tower))), 3);
  });

  // Chapter 2 (docs/design/v3-ch2-behemoth.md): 'vip', the supertanker.
  it('The Behemoth Run: a launch aimed at the supertanker goes for it while it sails; the tanker is the stake in most waves', () => {
    const { out } = aimed('behemoth', 1, 'behemoth-first-tanker');
    expect(out).toHaveLength(3);
    for (const { th, ships } of out) {
      const target = ships.find((s) => s.id === th.target);
      expect(target?.vip, `drone ${th.id}`).toBe(true);
    }
    const at = arc('behemoth').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.aim === 'vip'))).map((a) => a.wave);
    expect(at.length).toBeGreaterThanOrEqual(3);
    expect(at).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(arc('island').some((a) => a.encounters.some((e) => e.beats.some((b) => b.aim === 'vip')))).toBe(false);
  });

  it('an encounter may stand in for the map\'s own extras: the Island\'s wave 8 plans fewer cluster and supersonic missiles than the shared wave', () => {
    const count = (g: Game, kind: string) => g.queue.filter((l) => l.kind === kind && l.at < 1e8).length;
    for (const seed of [1, 2, 3]) {
      const off = createGame('island', seed, 8);
      applyEncounters(off, { ...VER('v1'), only: [] });
      const on = createGame('island', seed, 8);
      applyEncounters(on, VER('v1'));
      for (const kind of ['cluster', 'supersonic']) expect(count(on, kind), `seed ${seed} ${kind}`).toBe(Math.max(0, count(off, kind) - 1));
    }
    // Only rev 4's chapter 2 encounters do it.
    for (const e of ENCOUNTERS.filter((x) => x.replaces.extras)) expect(['island', 'behemoth', 'needle', 'archipelago', 'saltgate', 'battery', 'sowers', 'rigs', 'dreadnought', 'lantern', 'coves', 'delta', 'crossing', 'tide', 'citadel'], e.id).toContain(e.map);
  });

  // Chapter 2's Saltgate Canal (docs/design/v3-ch2-saltgate.md, log v38):
  // 'lock', the ship held at the lock nearest the launcher.
  it('Saltgate Canal: a launch aimed at the locks goes for a ship held at the lock nearest its silo; the locks are the stake in nine waves of ten', () => {
    const locks = MAPS.saltgate.locks!;
    const held = (s: { x: number }) => locks.some((l) => s.x >= l.x0 - 120 && s.x <= l.x1);
    // Wave 3: a guided missile off the silo over the west lock, as ships
    // wait in it.
    const { g, out } = aimed('saltgate', 3, 'saltgate-both-locks');
    const silo = g.map.bases[1];
    const missile = out.find((o) => o.th.kind === 'guided')!;
    expect(missile).toBeDefined();
    const target = missile.ships.find((s) => s.id === missile.th.target)!;
    expect(held(target), `target at x ${target.x.toFixed(0)}`).toBe(true);
    // The nearest held ship to the silo: in the west lock, under it.
    expect(d(target, silo)).toBeCloseTo(Math.min(...missile.ships.filter(held).map((s) => d(s, silo))), 3);
    expect(target.x).toBeLessThan(locks[0].x1 + 1);
    // With no ship held at a lock, the ship nearest the launcher.
    const early = aimed('saltgate', 1, 'saltgate-first-lock', (gg) => {
      gg.map = { ...gg.map, locks: [] };
    });
    // (Log v42: wave 1's drones come off the west shore, then the east
    // lock's silo; each from the base it was seen leaving.)
    for (const { th, ships } of early.out) {
      const t = ships.find((s) => s.id === th.target)!;
      const from = [early.g.map.bases[0], early.g.map.bases[3]].reduce((a, b) => (d(b, th) < d(a, th) ? b : a));
      expect(d(t, from)).toBeCloseTo(Math.min(...ships.map((s) => d(s, from))), 3);
    }
    // Every wave but the jet's (wave 7, down the canal's line of held ships).
    const at = arc('saltgate').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.aim === 'lock'))).map((a) => a.wave);
    expect(at).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10]);
    expect(LAYER_MAPS.filter((m) => m !== 'saltgate').some((m) => ENCOUNTERS.some((e) => e.map === m && e.beats.some((b) => b.aim === 'lock')))).toBe(false);
  });

  // Chapter 3's Battery Point (docs/design/v3-ch3-battery.md, log v45):
  // 'post', the shore guns: the first that stands; a launch whose gun is
  // knocked out on its way goes for the other (lab only).
  it('Battery Point: a shot at the shore guns goes for the first that stands, then the other; with both down, the ship nearest them', () => {
    const guns = MAPS.battery.posts!;
    expect(guns.map((p) => p.kind)).toEqual(['battery', 'battery']);
    const up = aimed('battery', 2, 'battery-ranging');
    const shells = up.out.filter((o) => o.th.kind === 'ballistic');
    expect(shells).toHaveLength(2);
    for (const o of shells) expect(o.th.target).toBe(-10);
    // Gun 0 knocked out: at gun 1.
    const one = aimed('battery', 2, 'battery-ranging', (g) => {
      g.posts[0].downT = 99;
    });
    for (const o of one.out.filter((x) => x.th.kind === 'ballistic')) expect(o.th.target).toBe(-11);
    // Both down: the ship nearest where the first stood.
    const none = aimed('battery', 2, 'battery-ranging', (g) => {
      g.posts[0].downT = 99;
      g.posts[1].downT = 99;
    });
    const s2 = none.out.find((o) => o.th.kind === 'ballistic')!;
    const target = s2.ships.find((x) => x.id === s2.th.target)!;
    expect(target).toBeDefined();
    const pool = s2.ships.filter((x) => x.x <= VIEW.width - 320);
    expect(d(target, guns[0])).toBeCloseTo(Math.min(...pool.map((x) => d(x, guns[0]))), 3);
    // A heavy at the guns whose gun is knocked out on its way turns for the
    // other gun, under the layer; the campaign's turns for a ship as ever.
    const turn = (lab: boolean) => {
      const g = createGame('battery', 9, 4);
      if (lab) applyEncounters(g, VER('v1'));
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = 999;
      for (let i = 0; i < 60 / DT && !g.threats.some((t) => t.kind === 'heavy' && t.target === -10); i++) {
        step(g, DT);
        if (!lab) for (const t of g.threats) if (t.kind === 'heavy') t.target = -10;
      }
      const heavy = g.threats.find((t) => t.kind === 'heavy' && t.target === -10);
      if (!heavy) return undefined;
      g.posts[0].downT = 99;
      step(g, DT);
      return heavy.target;
    };
    expect(turn(true)).toBe(-11);
    const camp = turn(false);
    expect(camp === undefined || camp >= 0).toBe(true);
  });

  it('the mechanic is in the waves: Marrow\'s tower is the target in at least three waves; Kesh has no mechanic to aim at', () => {
    const at = (map: Encounter['map']) => arc(map).filter((a) => a.encounters.some((e) => e.beats.some((b) => b.aim === 'post'))).map((a) => a.wave);
    expect(at('marrow')).toEqual([2, 5, 8, 10]);
    // Battery Point (log v45): its shore guns are the target in every wave
    // from the first shell (wave 2) to the climax.
    // The Black Strait (log v52): the night is the mechanic; the waves use
    // it through the enemy's dark bank in the south-east (bases 4 and 5,
    // and the sub spot off it), the one shore the lighthouse beam never
    // sweeps: something comes out of it in every wave, and a siege gun
    // rises on it in every wave from the signature's first.
    const n = MAPS.lantern.night!;
    const beamTo = (x: number, y: number) => (Math.atan2(y - n.light.y, x - n.light.x) * 180) / Math.PI;
    for (const i of [4, 5]) {
      const b = MAPS.lantern.bases[i];
      const a = beamTo(b.x, b.y);
      expect(a < n.a0 || a > n.a1, `base ${i} out of the sweep`).toBe(true);
      expect(Math.hypot(b.x - MAPS.lantern.carrier.x, b.y - MAPS.lantern.carrier.y), `base ${i} out of the carrier's lamp`).toBeGreaterThan(200);
    }
    const dark = (b: { from: object }) => ('base' in b.from && [4, 5].includes((b.from as { base: number }).base)) || ('sub' in b.from && (b.from as { sub: number }).sub === 2);
    expect(arc('lantern').filter((a) => a.encounters.some((e) => e.beats.some((b) => !b.filler && dark(b)))).map((a) => a.wave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(arc('lantern').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.kind === 'siege'))).map((a) => a.wave)).toEqual([4, 5, 6, 7, 8, 9, 10]);
    for (const e of ENCOUNTERS.filter((x) => x.map === 'lantern')) for (const b of e.beats.filter((x) => x.kind === 'siege')) expect([4, 5], e.id).toContain((b.from as { base: number }).base);
    expect(at('battery')).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // Sowers' Reach (log v48): its mines are in every wave, off the chutes
    // or sown by a stealth bomber (the signature, from wave 4).
    const mines = (kind: string) => arc('sowers').filter((a) => a.encounters.some((e) => e.beats.some((b) => !b.filler && b.kind === kind))).map((a) => a.wave);
    expect(mines('mine')).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 10]);
    expect(mines('stealthBomber')).toEqual([4, 8, 10]);
    for (const e of ENCOUNTERS.filter((x) => x.map === 'sowers')) for (const b of e.beats.filter((x) => x.kind === 'mine')) expect(MAPS.sowers.bases[(b.from as { base: number }).base].chute, e.id).toBe(true);
    // The Rig Field (log v49): its rigs fire in every wave (a beat out of a
    // rig), and relief rigs are towed in (the signature) in waves 4, 7, 8
    // and 10; a beat out of the far shore's silos is the long flight.
    const rigged = arc('rigs').filter((a) => a.encounters.some((e) => e.beats.some((b) => !b.filler && 'base' in b.from && MAPS.rigs.bases[b.from.base].rig))).map((a) => a.wave);
    expect(rigged).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const towed = arc('rigs').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.kind === 'rig'))).map((a) => a.wave);
    expect(towed).toEqual([4, 7, 8, 10]);
    // The Coves (log v53): a beat out of a cove in every wave 1-10, the
    // south cove (on the ships' own side) from wave 3, and fire ships in
    // waves 4, 7, 8 and 10 (and the signature's from wave 4).
    const coved = (f: (i: number) => boolean) => arc('coves').filter((a) => a.encounters.some((e) => e.beats.some((b) => 'base' in b.from && MAPS.coves.bases[b.from.base].cove && f(b.from.base)))).map((a) => a.wave);
    expect(coved(() => true)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(coved((i) => MAPS.coves.bases[i].y > 700)).toEqual([3, 5, 7, 9, 10]);
    const fired = arc('coves').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.fire))).map((a) => a.wave);
    expect(fired).toEqual([4, 7, 8, 10]);
    for (const e of ENCOUNTERS) for (const b of e.beats.filter((x) => x.fire)) expect(e.map === 'coves' && b.kind === 'fastboat' && 'base' in b.from && MAPS.coves.bases[b.from.base].cove, e.id).toBe(true);
    // The Delta (log v68): the river has no switch, so no beat aims at one,
    // and its fire comes from every silo along the river in turn (all eight
    // are used, the north coast's, the island's, the islets' and the marsh's).
    expect(arc('delta').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.aim === 'switch' || b.kind === 'cloud')))).toEqual([]);
    const silos = new Set(arc('delta').flatMap((a) => a.encounters.flatMap((e) => e.beats.flatMap((b) => ('base' in b.from ? [b.from.base] : [])))));
    expect([...silos].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(at('kesh')).toEqual([]);
    expect(MAPS.kesh.posts).toBeUndefined();
    // Dreadnought Pass (log v51): the battleship passes on the map's own
    // waves (3, 6, 9, 10) and shows itself on wave 1; its spotters lay its
    // guns in waves 4, 6, 8, 9 and 10 (the signature, from wave 4).
    expect(Object.keys(DREAD_PASSES).map(Number)).toEqual([1, ...MAPS.dreadnought.boss!.waves]);
    const spotted = arc('dreadnought').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.kind === 'spotter'))).map((a) => a.wave);
    expect(spotted).toEqual([4, 6, 8, 9, 10]);
  });
});

describe('the ten-wave arc, and what it leaves alone', () => {
  it('each map (v1): waves 1-3 teach, 4-6 combine, 7-9 escalate, 10 is the climax; no wave is left without its role', () => {
    for (const map of LAYER_MAPS) {
      const a = arc(map);
      expect(a.map((w) => w.role).join()).toBe('teach,teach,teach,combine,combine,combine,escalate,escalate,escalate,climax');
      // Every wave carries an encounter (rev 3: wave 1 too, its opener, or Harbor Mouth's own lesson).
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeGreaterThan(0);
      // A wave has at most one encounter: a decision, not a pile.
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
    }
  });

  it('v2, set pieces: four, one a wave, with a quiet wave between any two; each set piece wave has more of the budget than the quiet ones', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map, 'v2');
      // Wave 1's opener (rev 3) is a small call-out, not a set piece.
      const on = a.filter((w) => w.encounters.some((e) => !e.opener)).map((w) => w.wave);
      expect(a[0].encounters.map((e) => e.opener), map).toEqual([true]);
      expect(on, map).toHaveLength(4);
      for (const w of a) expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
      for (let k = 1; k < on.length; k++) expect(on[k] - on[k - 1], `${map}: set pieces ${on[k - 1]} and ${on[k]}`).toBeGreaterThanOrEqual(2);
      // Teach, combine, escalate, climax in that order; the climax on wave 10.
      expect(on.map((w) => encountersFor(map, w, 'v2')[0].role)).toEqual(['teach', 'combine', 'escalate', 'climax']);
      expect(on[3]).toBe(10);
      // Each one a big moment: two beats or more, or a salvo of five or more.
      for (const w of on) {
        const e = encountersFor(map, w, 'v2')[0];
        expect(e.beats.length >= 2 || e.beats.reduce((x, b) => x + b.count, 0) >= 5, e.id).toBe(true);
      }
      const quiet = a.filter((w) => !w.encounters.some((e) => !e.opener) && w.wave > 1).map((w) => waveScale(map, 'v2', w.wave));
      expect(Math.max(...quiet), map).toBeLessThanOrEqual(1.15);
    }
  });

  it('v3, enemy pairs: an encounter in most waves, each built on a pair; a pair is taught alone before it is combined, and two overlap only once both are known', () => {
    for (const map of ENCOUNTER_MAPS) {
      const a = arc(map, 'v3');
      expect(a.filter((w) => w.encounters.length).length, map).toBeGreaterThanOrEqual(8);
      const known = new Set<string>();
      for (const w of a) {
        expect(w.encounters.length, `${map} wave ${w.wave}`).toBeLessThanOrEqual(1);
        const e = w.encounters[0];
        if (!e) continue;
        expect(e.pairs?.length, e.id).toBeGreaterThan(0);
        const ids = e.pairs!.map((p) => p.pair);
        const fresh = ids.filter((id) => !known.has(id));
        if (fresh.length) {
          // A new pair comes on its own, in a teach wave.
          expect(e.role, `${e.id} brings ${fresh.join()} new`).toBe('teach');
          expect(ids, e.id).toHaveLength(1);
        }
        for (const id of ids) known.add(id);
      }
      expect(known.size, map).toBe(3);
    }
  });

  it('the map\'s own event (runs 1 to 3) and the Siren Field bonus wave play as they do without the layer', () => {
    for (const map of LAYER_MAPS) for (const v of ENCOUNTER_VERSIONS) for (const w of [11, 12, 13]) expect(encountersFor(map, w, v)).toEqual([]);
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 } };
    // From wave 11: the event's three runs, the same game with the layer on or off.
    const off = playMimic('strait', 201, { ...opts, firstWave: 11 });
    for (const v of ENCOUNTER_VERSIONS) {
      const on = playMimic('strait', 201, { ...opts, firstWave: 11, encounters: VER(v) });
      expect(on.game.eventLog.map((e) => [e.id, e.run, e.outcome]), v).toEqual(off.game.eventLog.map((e) => [e.id, e.run, e.outcome]));
      expect(on.log.commands, v).toEqual(off.log.commands);
      expect(on.game.enc!.played, v).toEqual([]);
    }
    // From wave 6 with two passives: Siren Field still comes after wave 6.
    const bonus = playMimic('strait', 8, { ...opts, firstWave: 6, encounters: ON });
    expect(bonus.game.eventLog[0]).toMatchObject({ id: 'siren-field', kind: 'bonus' });
    expect(bonus.game.enc!.played).toContain('strait-both-ways');
  }, 90_000);

  it('Harbor Mouth (rev 4): the Breakout comes to the neck, round 3 a salvo short of round 2 (log v27); a rev 3 log and the campaign play it as it was', () => {
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
    const off = playMimic('harbor', 201, opts);
    const old = playMimic('harbor', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => e.sent.ballistic ?? 0)).toEqual([0, 0, 0]);
    const on = playMimic('harbor', 201, { ...opts, encounters: VER('v1') });
    const tune = MAP_BOSS.harbor!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['breakout', 1], ['breakout', 2], ['breakout', 3]]);
    // Its salvos into the neck: one salvo, then two, then (log v27, the
    // player's choice after the playtest) one again with the fan of 4.
    const salvos = tune.salvos!;
    expect(on.game.eventLog.map((e) => e.sent.ballistic)).toEqual(salvos.map((r) => r.reduce((a, [, n]) => a + n, 0)));
    expect(on.game.eventLog.map((e) => e.sent.hydra)).toEqual(tune.fan);
    expect(salvos.map((r) => r.map(([, n]) => n))).toEqual([[3], [3, 2], [3]]);
    expect(tune.fan).toEqual([3, 3, 4]);
    // Round 3 is still more than round 1 (a Hydra more), less than round 2.
    const weight = salvos.map((r, k) => r.reduce((a, [, n]) => a + n, 0) + tune.fan![k]);
    expect(weight).toEqual([6, 8, 7]);
    roundLengths(on.game.eventLog);
  }, 90_000);
});

/** Each boss round 15-30 s, from its first launch (the first round's longer
 *  calm, EVENT.bossCalm, log v29, comes before its clock starts). */
function roundLengths(log: { run?: number; seconds: number }[]): void {
  for (const e of log) {
    expect(e.seconds, `run ${e.run}`).toBeGreaterThanOrEqual(15);
    expect(e.seconds, `run ${e.run}`).toBeLessThanOrEqual(30);
  }
}

describe('chapter 1\'s boss rounds (rev 4, MAP_BOSS): Kesh and Marrow rise; a rev 3 log and the campaign play them as they were', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('The Kesh Hook\'s Drone Storm: more each round, shells and guided missiles with the swarms (log v29)', () => {
    const off = playMimic('kesh', 201, opts);
    const old = playMimic('kesh', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => e.sent.drone)).toEqual([30, 30, 30]);
    const on = playMimic('kesh', 201, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.kesh!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['drone-storm', 1], ['drone-storm', 2], ['drone-storm', 3]]);
    expect(on.game.eventLog.map((e) => e.sent.drone)).toEqual(rounds.map((r) => Math.round(r.swarms! * r.size!)));
    // Log v29 (the playtest: "the boss was way too easy"): shells and guided
    // missiles ride with the swarms.
    expect(on.game.eventLog.map((e) => e.sent.ballistic ?? 0)).toEqual(rounds.map((r) => r.shells ?? 0));
    expect(on.game.eventLog.map((e) => e.sent.guided ?? 0)).toEqual(rounds.map((r) => r.guided ?? 0));
    // Each round sends more than the one before, counting a shell as two
    // drones and a guided missile as three, its second half no later: round
    // 3 is harder than round 2 by what it sends, not only by its timing.
    const weight = rounds.map((r) => r.swarms! * r.size! + 2 * (r.shells ?? 0) + 3 * (r.guided ?? 0));
    for (let k = 1; k < rounds.length; k++) {
      expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
      expect(rounds[k].second!).toBeLessThanOrEqual(rounds[k - 1].second!);
    }
    expect(rounds[2].swarms! * rounds[2].size!).toBeGreaterThan(rounds[1].swarms! * rounds[1].size!);
    expect(rounds[2].guided!).toBeGreaterThan(rounds[1].guided!);
    // Heavier than the event's own (12 swarms, 30 drones) from round 1.
    expect(rounds[0].swarms! * rounds[0].size!).toBeGreaterThan(30);
    roundLengths(on.game.eventLog);
  }, 90_000);

  it('Lee of Marrow\'s Hydra Bloom: each round opens with missiles at the radar tower, and builds up', () => {
    const off = playMimic('marrow', 201, opts);
    const old = playMimic('marrow', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => e.sent.guided ?? 0)).toEqual([0, 0, 0]);
    const on = playMimic('marrow', 201, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.marrow!.rounds!;
    const bases = MAPS.marrow.bases.length;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['hydra-bloom', 1], ['hydra-bloom', 2], ['hydra-bloom', 3]]);
    expect(on.game.eventLog.map((e) => e.sent.guided)).toEqual(rounds.map((r) => r.tower));
    expect(on.game.eventLog.map((e) => e.sent.hydra)).toEqual(rounds.map((r) => r.fans! * bases));
    expect(on.game.eventLog.map((e) => e.sent.drone ?? 0)).toEqual(rounds.map((r) => r.swarms! * r.size!));
    const weight = rounds.map((r) => r.tower! + r.fans! * bases + r.swarms! * r.size!);
    for (let k = 1; k < weight.length; k++) expect(weight[k]).toBeGreaterThan(weight[k - 1]);
    roundLengths(on.game.eventLog);
  }, 90_000);
});

describe('chapter 2\'s boss rounds (rev 4, MAP_BOSS): the Island and the Behemoth Run rise; a rev 3 log and the campaign play them as they were', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  /** What a round adds, by kind (MAP_BOSS `fire`). */
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('The Island\'s Gunship Wall: helicopters, swarms, and shells and missiles off the island, building up', () => {
    const off = playMimic('island', 201, opts);
    const old = playMimic('island', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => e.sent.attackHeli)).toEqual([4, 4, 4]);
    const on = playMimic('island', 201, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.island!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['gunship-wall', 1], ['gunship-wall', 2], ['gunship-wall', 3]]);
    expect(on.game.eventLog.map((e) => e.sent.attackHeli)).toEqual(rounds.map((r) => r.helis));
    expect(on.game.eventLog.map((e) => e.sent.drone ?? 0)).toEqual(rounds.map((r) => r.swarms! * r.size!));
    expect(on.game.eventLog.map((e) => e.sent.ballistic ?? 0)).toEqual(rounds.map((r) => fired(r, 'ballistic')));
    expect(on.game.eventLog.map((e) => e.sent.guided ?? 0)).toEqual(rounds.map((r) => fired(r, 'guided')));
    // A helicopter is worth a swarm and more; each round sends more.
    const weight = rounds.map((r) => 8 * r.helis! + r.swarms! * r.size! + 2 * fired(r, 'ballistic') + 3 * fired(r, 'guided'));
    for (let k = 1; k < weight.length; k++) expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
    roundLengths(on.game.eventLog);
  }, 90_000);

  it('The Behemoth Run\'s boss rounds (log v33): a strike on the supertanker, jets and heavies, that the Shield cannot stop; more each round', () => {
    const off = playMimic('behemoth', 201, opts);
    const old = playMimic('behemoth', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Not the same game step for step: turning the layer on plans the first
    // wave again (applyEncounters), and the Wolf Pack's plan rolls which subs
    // carry a fast torpedo, so its dice are drawn twice. What it sends is
    // the event's own, as without the layer (seven subs a round, nothing
    // added; a round the run is lost in stops short).
    expect(old.game.eventLog.map((e) => [e.id, e.run])).toEqual(off.game.eventLog.map((e) => [e.id, e.run]));
    for (const e of old.game.eventLog) {
      expect(e.sent.torpedoSub, `run ${e.run}`).toBeLessThanOrEqual(7);
      if (e.run! < 3) expect(e.sent.torpedoSub, `run ${e.run}`).toBe(7);
      expect((e.sent.guided ?? 0) + (e.sent.heavy ?? 0), `run ${e.run}`).toBe(0);
    }
    expect(off.game.eventLog.map((e) => e.sent.torpedoSub)).toEqual([7, 7, 7]);
    // Seed 218: the tryhard bot, starting at the boss with no weapon, sees
    // all three rounds (it breaks the first and the third).
    const on = playMimic('behemoth', 204, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.behemoth!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['wolf-pack', 1], ['wolf-pack', 2], ['wolf-pack', 3]]);
    // A round the run is lost in stops short, so it is checked up to there.
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.torpedoSub ?? 0)).toEqual(done.map((e) => rounds[e.run! - 1].packs!.reduce((a, n) => a + n, 0)));
    expect(done.map((e) => e.sent.strafer ?? 0)).toEqual(done.map((e) => fired(rounds[e.run! - 1], 'strafer')));
    expect(done.map((e) => e.sent.heavy ?? 0)).toEqual(done.map((e) => fired(rounds[e.run! - 1], 'heavy')));
    expect(done.map((e) => e.sent.guided ?? 0)).toEqual(done.map((e) => fired(rounds[e.run! - 1], 'guided')));
    for (const r of rounds) {
      // The supertanker is what it goes for: jets down its lane and a heavy
      // at it every round.
      expect(r.fire!.some((f) => f.kind === 'strafer' && f.aim === 'vip')).toBe(true);
      expect(r.fire!.some((f) => f.kind === 'heavy' && f.aim === 'vip')).toBe(true);
      // Round 9 (r9-ch2-split): led by what the Shield cannot stop. Jets
      // outnumber everything it can (subs, heavies, guided missiles).
      const subs = r.packs!.reduce((a, n) => a + n, 0);
      expect(fired(r, 'strafer'), 'jets lead').toBeGreaterThan(subs + fired(r, 'heavy') + fired(r, 'guided'));
      expect(subs, 'what is left of the Wolf Pack').toBeLessThanOrEqual(2);
    }
    // More each round (a heavy is worth four jets: half the tanker).
    const weight = rounds.map((r) => 3 * r.packs!.reduce((a, n) => a + n, 0) + 2 * r.fast! + 3 * fired(r, 'guided') + 4 * fired(r, 'heavy') + fired(r, 'strafer'));
    for (let k = 1; k < weight.length; k++) expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
    roundLengths(done);
  }, 90_000);
});

describe('the Needle of Bosk\'s boss rounds (log v35, MAP_BOSS): the Shield Wall at the mouth rises; a rev 3 log and the campaign play it as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('one block of armored drones a round, bigger each round, with clusters and shells from the headlands at the queue', () => {
    const off = playMimic('needle', 201, opts);
    const old = playMimic('needle', 201, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own block of 12 and nothing else.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => [e.id, e.sent.armored, e.sent.cluster ?? 0, e.sent.ballistic ?? 0])).toEqual([
      ['shield-wall', 12, 0, 0],
      ['shield-wall', 12, 0, 0],
      ['shield-wall', 12, 0, 0],
    ]);
    const on = playMimic('needle', 201, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.needle!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['shield-wall', 1], ['shield-wall', 2], ['shield-wall', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.armored)).toEqual(done.map((e) => rounds[e.run! - 1].block));
    expect(done.map((e) => e.sent.cluster ?? 0)).toEqual(done.map((e) => fired(rounds[e.run! - 1], 'cluster')));
    expect(done.map((e) => e.sent.ballistic ?? 0)).toEqual(done.map((e) => fired(rounds[e.run! - 1], 'ballistic')));
    for (const r of rounds) {
      // The Shield Wall's block leads; what is added goes at the queue (the
      // ship nearest the headland silo it comes from).
      expect(r.block!, 'the block leads').toBeGreaterThan(fired(r, 'cluster') + fired(r, 'ballistic'));
      for (const f of r.fire ?? []) {
        expect(f.aim).toBe('near');
        expect([2, 3]).toContain(f.base);
        expect(MAPS.needle.bases[f.base!].kinds).toContain(f.kind);
      }
    }
    // More each round (a cluster over the queue is worth about four drones).
    const weight = rounds.map((r) => r.block! + 4 * fired(r, 'cluster') + 2 * fired(r, 'ballistic'));
    for (let k = 1; k < weight.length; k++) expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
    roundLengths(done);
  }, 90_000);
});

describe('the Archipelago\'s boss rounds (log v37, MAP_BOSS): the Supply Raid from every side rises; a rev 3 log and the campaign play it as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('more and bigger swarms, drone motherships off the west islet, shells and clusters at the ships coming in, each round more', () => {
    const off = playMimic('archipelago', 218, opts);
    const old = playMimic('archipelago', 218, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own 5 swarms of 6, its scavengers and
    // nothing else.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => [e.id, e.sent.drone, e.sent.scavenger, e.sent.mothership ?? 0, e.sent.ballistic ?? 0])).toEqual([
      ['supply-raid', 30, 6, 0, 0],
      ['supply-raid', 30, 6, 0, 0],
      ['supply-raid', 30, 6, 0, 0],
    ]);
    // Seed 225 (218 before log v41, round 12's cluster climb): the tryhard
    // bot, starting at the boss with no weapon, sees all three rounds.
    const on = playMimic('archipelago', 225, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.archipelago!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['supply-raid', 1], ['supply-raid', 2], ['supply-raid', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.drone)).toEqual(done.map((e) => rounds[e.run! - 1].swarms! * rounds[e.run! - 1].size!));
    // The cargo runs and the scavengers are the event's own.
    expect(done.map((e) => e.sent.scavenger)).toEqual(done.map(() => 6));
    for (const kind of ['mothership', 'ballistic', 'cluster', 'guided'] as const) expect(done.map((e) => e.sent[kind] ?? 0), kind).toEqual(done.map((e) => fired(rounds[e.run! - 1], kind)));
    for (const r of rounds) {
      // One weapon in the round's first cargo run, supplies only in the
      // second (the event's own: one for each weapon held, in both).
      expect(r.cargoWeapons).toEqual([1, 0]);
      // The swarms lead; the map's signature is in every round.
      expect(r.swarms! * r.size!, 'the swarms lead').toBeGreaterThan(r.fire!.reduce((a, f) => a + (f.count ?? 1), 0));
      expect(fired(r, 'mothership'), 'motherships').toBeGreaterThanOrEqual(2);
      for (const f of r.fire ?? []) {
        expect(MAPS.archipelago.bases[f.base!].kinds).toContain(f.kind);
        // The motherships, shells and clusters come at the west end, the
        // long reach (a mothership flies at the carrier, over the convoy).
        if (f.kind === 'mothership' || f.kind === 'cluster') expect(f.base).toBe(0);
        if (f.kind === 'ballistic' || f.kind === 'cluster') expect(f.aim).toBe('rear');
      }
    }
    // More each round (a mothership is worth about four drones, a cluster
    // three, a shell or a missile two).
    const weight = rounds.map((r) => r.swarms! * r.size! + 4 * fired(r, 'mothership') + 3 * fired(r, 'cluster') + 2 * (fired(r, 'ballistic') + fired(r, 'guided')));
    for (let k = 1; k < weight.length; k++) expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
    roundLengths(done);
  }, 90_000);
});

describe('Saltgate Canal\'s boss rounds (log v62, MAP_BOSS): the Gatecrashers, a parade of Missile Trucks along the road, rising; a rev 3 log and the campaign play Run the Canal as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('a parade of Missile Trucks every round (no Rocket Truck, sub, gunship, block or swarm), each round its own patterns, rising', () => {
    const off = playMimic('saltgate', 208, opts);
    const old = playMimic('saltgate', 208, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: Run the Canal, the event's own 2 subs, a gunship, a
    // block of 4 and a swarm of 5, every round.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    expect(off.game.eventLog.map((e) => [e.id, e.sent.torpedoSub, e.sent.attackHeli, e.sent.armored, e.sent.drone, e.sent.rocketTruck ?? 0, e.sent.missileTruck ?? 0])).toEqual([
      ['run-the-canal', 2, 1, 4, 5, 0, 0],
      ['run-the-canal', 2, 1, 4, 5, 0, 0],
      ['run-the-canal', 2, 1, 4, 5, 0, 0],
    ]);
    expect(eventName('run-the-canal', 'saltgate', undefined)).toBe('Run the Canal');
    expect(eventName('run-the-canal', 'saltgate', 3)).toBe('Run the Canal');
    // Under the layer the boss is the Gatecrashers (its name on the intro
    // cards); the event's id stays.
    expect(eventName('run-the-canal', 'saltgate', 4)).toBe('Gatecrashers');
    expect(bossIntroCards('run-the-canal', 1, 3, 6, true, eventName('run-the-canal', 'saltgate', 4)).find((c) => c.key === 'name')!.title).toBe('Gatecrashers');
    for (const m of ['island', 'behemoth', 'needle', 'archipelago'] as const) expect(MAP_BOSS[m]!.name, m).toBeUndefined();
    const rounds = MAP_BOSS.saltgate!.rounds!;
    // The tryhard bot, starting at the boss with no weapon, sees all three
    // rounds through: Missile Trucks only, each round 15-30 s.
    const on = playMimic('saltgate', 204, { ...opts, encounters: VER('v1') });
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['run-the-canal', 1], ['run-the-canal', 2], ['run-the-canal', 3]]);
    const done = on.game.eventLog;
    for (const e of done) expect(e.sent.missileTruck ?? 0).toBeGreaterThanOrEqual(5);
    for (const kind of ['torpedoSub', 'attackHeli', 'armored', 'rocketTruck', 'cluster', 'drone'] as const) expect(done.map((e) => e.sent[kind] ?? 0), kind).toEqual([0, 0, 0]);
    roundLengths(done.filter((e) => e.outcome !== 'broken'));
    // The data: a truck every 1-3 s; the parade denser and its trucks
    // loaded heavier round on round; each round its own patterns (round 1
    // ripples; round 2 synchronized pairs and ripples, the two locks in
    // turn; round 3 volleys at once and the grand rolling barrage).
    for (const r of rounds) {
      const P = r.parade!;
      expect(P.gap[0]).toBeGreaterThanOrEqual(1);
      expect(P.gap[1]).toBeLessThanOrEqual(3);
      expect(r.swarms ?? 0).toBe(0);
    }
    const mean = (r: BossRound) => (r.parade!.gap[0] + r.parade!.gap[1]) / 2;
    expect(mean(rounds[1])).toBeLessThan(mean(rounds[0]));
    expect(mean(rounds[2])).toBeLessThan(mean(rounds[1]));
    expect(rounds[2].parade!.missiles).toBeGreaterThan(rounds[0].parade!.missiles);
    const kinds = (r: BossRound) => new Set(paradeBeats(r.parade!).map((b) => b.pattern));
    expect(kinds(rounds[0])).toEqual(new Set(['ripple']));
    expect(kinds(rounds[1])).toEqual(new Set(['pairs', 'ripple']));
    expect(rounds[1].parade!.cycle.some((b) => b.aim === 'alternate')).toBe(true);
    expect(kinds(rounds[2])).toContain('sync');
    expect(kinds(rounds[2])).toContain('sweep');
    expect(paradeBeats(rounds[2].parade!).slice(-1)[0].pattern).toBe('sweep');
  }, 90_000);

  // One boss round with nothing shot: every ship and the carrier kept
  // afloat, the parade watched from start to end.
  const watch = (seed: number, wave: number) => {
    const g = createGame('saltgate', seed, wave);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    const seen = new Map<number, { born: number; along: number; still: number }>();
    const lobs: { truck: number; moving: boolean; x: number; at: number }[] = [];
    let parade: NonNullable<NonNullable<Game['event']>['parade']> | undefined;
    let lowest = Infinity;
    for (let i = 0; i < 70 / DT && g.phase === 'wave' && g.wave === wave; i++) {
      for (const s of g.ships) s.hp = 99;
      g.carrierHp = 1e6;
      const before = new Map(g.threats.filter((t) => t.kind === 'missileTruck' && !t.dead).map((t) => [t.id, t.foe!.along ?? 0]));
      const known = new Set(g.threats.map((t) => t.id));
      step(g, DT);
      if (g.wave === wave) parade = g.event?.parade ?? parade;
      for (const t of g.threats) {
        if (t.kind === 'missileTruck' && !t.dead) {
          const was = seen.get(t.id);
          const along = t.foe!.along ?? 0;
          if (!was) seen.set(t.id, { born: g.waveT, along, still: 0 });
          else {
            // Never stops: further along every step, at the same pace.
            lowest = Math.min(lowest, (along - was.along) / DT);
            if (along <= was.along) was.still += 1;
            was.along = along;
          }
        }
        if (t.kind === 'ballistic' && !known.has(t.id) && t.from !== undefined) {
          const tr = g.threats.find((o) => o.id === t.from);
          const a0 = before.get(t.from);
          lobs.push({ truck: t.from, moving: !!tr && a0 !== undefined && (tr.foe!.along ?? 0) > a0, x: tr?.x ?? -1, at: g.waveT });
        }
      }
    }
    return { g, seen, lobs, parade: parade!, lowest };
  };

  it('the parade (deterministic): a truck enters every 1-3 s, none ever stops, each fires on the move, and every round plays its patterns', () => {
    const rounds = MAP_BOSS.saltgate!.rounds!;
    const T = MAP_BOSS.saltgate!.truck!;
    const speed = THREATS.missileTruck.speed * T.drive;
    const fired: number[] = [];
    for (const [k, wave] of [11, 12, 13].entries()) {
      const R = { ...rounds[k].parade!, beats: paradeBeats(rounds[k].parade!) };
      const w = watch(208, wave);
      const again = watch(208, wave);
      // Deterministic: the same seed plays the same parade.
      expect(again.parade.spawns).toEqual(w.parade.spawns);
      expect(again.parade.shots).toEqual(w.parade.shots);
      expect(again.lobs).toEqual(w.lobs);
      // A truck every 1-3 s (the round's own gap), from the road's west end
      // to its east end (the map's road behind the silos, across the map).
      const born = [...w.seen.values()].map((s) => s.born).sort((a, b) => a - b);
      expect(born.length, `round ${k + 1}`).toBe(w.parade.spawns.length);
      expect(born.length).toBeGreaterThanOrEqual(5);
      for (let j = 1; j < born.length; j++) {
        const gap = born[j] - born[j - 1];
        expect(gap).toBeGreaterThanOrEqual(Math.max(1, R.gap[0]) - DT - 1e-9);
        expect(gap).toBeLessThanOrEqual(Math.min(3, R.gap[1]) + DT + 1e-9);
      }
      const road = w.parade.road;
      expect(road[0].x).toBeLessThan(0);
      expect(road[road.length - 1].x).toBeGreaterThan(VIEW.width);
      // Never stops, never slows.
      for (const s of w.seen.values()) expect(s.still).toBe(0);
      expect(w.lowest).toBeGreaterThan(speed * 0.99);
      // Every missile from a truck on the move, on screen.
      expect(w.lobs.length).toBeGreaterThan(0);
      for (const l of w.lobs) {
        expect(l.moving).toBe(true);
        expect(l.x).toBeGreaterThan(0);
        expect(l.x).toBeLessThan(VIEW.width);
      }
      // Each launch laid fired (nothing was shot), at its second.
      expect(w.lobs.length).toBe(w.parade.shots.length);
      fired.push(w.lobs.length);
      // The round's patterns, most of them played (one with no truck on
      // screen yet, or none with a missile left, plays nothing).
      const beats = new Set(w.parade.shots.filter((s) => s.beat >= 0).map((s) => s.beat));
      expect(beats.size / R.beats.length, `round ${k + 1}`).toBeGreaterThanOrEqual(0.7);
      const kinds = new Set([...beats].map((b) => R.beats[b].pattern));
      if (k === 0) expect(kinds).toEqual(new Set(['ripple']));
      if (k === 1) expect(kinds).toEqual(new Set(['pairs', 'ripple']));
      if (k === 2) for (const p of ['sync', 'sweep'] as const) expect(kinds).toContain(p);
      for (const [b, B] of R.beats.entries()) {
        const shots = w.parade.shots.filter((s) => s.beat === b).sort((x, y) => x.at - y.at);
        const ats = [...new Set(shots.map((s) => s.at))];
        if (B.pattern === 'ripple' || B.pattern === 'sweep') {
          // Rolling down the column: one launch at a time, `step` apart.
          expect(ats.length, `round ${k + 1} beat ${b}`).toBe(shots.length);
          for (let j = 1; j < ats.length; j++) expect(ats[j] - ats[j - 1]).toBeCloseTo(B.step ?? 0.4, 6);
        }
        if (B.pattern === 'sync') {
          // All at once.
          expect(ats.length).toBeLessThanOrEqual(1);
        }
        if (B.pattern === 'pairs') {
          // Two at a time.
          for (const at of ats) expect(shots.filter((s) => s.at === at).length).toBeLessThanOrEqual(2);
        }
        // The two locks in turn.
        for (const s of shots) expect(s.lock).toBe(B.aim === 'alternate' ? s.lock % 2 : -1);
      }
      const alt = w.parade.shots.filter((s) => s.beat >= 0 && R.beats[s.beat].aim === 'alternate');
      if (alt.length) expect(new Set(alt.map((s) => s.lock))).toEqual(new Set([0, 1]));
      // The rolling barrage: four or more trucks down the column.
      if (k === 2) expect(Math.max(...R.beats.map((B, b) => (B.pattern === 'sweep' ? w.parade.shots.filter((s) => s.beat === b).length : 0)))).toBeGreaterThanOrEqual(4);
      // A volley: three or more at once.
      if (k === 2) expect(Math.max(...R.beats.map((B, b) => (B.pattern === 'sync' ? w.parade.shots.filter((s) => s.beat === b).length : 0)))).toBeGreaterThanOrEqual(3);
      // Pairs fire two at once (a late one may find one truck left).
      const pairs = w.parade.shots.filter((s) => s.beat >= 0 && R.beats[s.beat].pattern === 'pairs');
      if (pairs.length) expect(pairs.some((s) => pairs.filter((o) => o.beat === s.beat && o.at === s.at).length === 2)).toBe(true);
      // A ripple rolls down several trucks (a late one may find few left).
      const ripples = R.beats.flatMap((B, b) => (B.pattern === 'ripple' ? [w.parade.shots.filter((s) => s.beat === b).length] : []));
      if (ripples.length) expect(ripples.reduce((x, y) => x + y, 0) / ripples.length, `round ${k + 1}`).toBeGreaterThanOrEqual(2);
    }
    // More missiles each round.
    expect(fired[1]).toBeGreaterThan(fired[0]);
    expect(fired[2]).toBeGreaterThan(fired[1]);
  }, 60_000);

  it('a Missile Truck can be shot on the road and while it raises, marks a ship held at a lock and lobs a ballistic missile at it that can be shot down; the parade drives on past a wreck', () => {
    const g = createGame('saltgate', 208, 11);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 1e6;
    const locks = MAPS.saltgate.locks!;
    const held = (s: { x: number }) => locks.some((l) => s.x >= l.x0 - 120 && s.x <= l.x1);
    let marked = 0;
    let atLock = 0;
    let killed = false;
    let raisedKill = false;
    let drivesOn = true;
    let shotDown = false;
    const lobs = new Map<number, { dur: number; apex: number; near: boolean }>();
    const seen = new Set<number>();
    for (let i = 0; i < 60 / DT && g.phase === 'wave' && g.wave === 11; i++) {
      for (const s of g.ships) s.hp = 99;
      const was = new Map(g.threats.filter((t) => t.kind === 'missileTruck' && !t.dead).map((t) => [t.id, t.foe!.along ?? 0]));
      step(g, DT);
      const tr = g.threats.filter((t) => t.kind === 'missileTruck' && !t.dead);
      for (const t of tr) {
        seen.add(t.id);
        if (killed && was.has(t.id) && (t.foe!.along ?? 0) <= was.get(t.id)!) drivesOn = false;
        const m = truckMark(g, t);
        if (m) {
          marked++;
          if (held(m)) atLock++;
        }
      }
      // Shoot the parade's lead on the road, before it raises.
      if (!killed) {
        const lead = tr.find((t) => t.foe!.state === 0 && (t.foe!.along ?? 0) > 400 && t.x < VIEW.width / 2);
        if (lead) {
          damageThreat(g, lead, 99, true, 'gun');
          killed = lead.dead;
        }
      }
      // And one with its missile half up.
      if (killed && !raisedKill) {
        const up = tr.find((t) => !t.dead && t.foe?.state === 1 && t.foe.t > 1);
        if (up) {
          damageThreat(g, up, 99, true, 'gun');
          raisedKill = up.dead;
        }
      }
      for (const b of g.threats) {
        if (b.kind !== 'ballistic' || b.dead || lobs.has(b.id) || !seen.has(b.from ?? -1)) continue;
        lobs.set(b.id, { dur: b.dur, apex: b.apex, near: g.ships.some((s) => s.id === b.target && held(s)) });
        // Shoot the first one in the air.
        if (!shotDown) {
          damageThreat(g, b, 99, true, 'gun');
          shotDown = b.dead;
        }
      }
    }
    expect(killed).toBe(true);
    expect(raisedKill).toBe(true);
    expect(drivesOn).toBe(true);
    expect(marked).toBeGreaterThan(0);
    // The ships are mostly at the locks when the trucks are up.
    expect(atLock / marked).toBeGreaterThan(0.5);
    expect(lobs.size).toBeGreaterThan(0);
    expect(shotDown).toBe(true);
    // Lobbed: long in the air, and high.
    for (const l of lobs.values()) expect(l.dur).toBeGreaterThanOrEqual(FOE.missileTruck.flight - 1e-9);
    expect([...lobs.values()].filter((l) => l.apex >= FOE.missileTruck.apex - 1e-9).length / lobs.size).toBeGreaterThan(0.5);
    expect([...lobs.values()].filter((l) => l.near).length / lobs.size).toBeGreaterThan(0.5);
  }, 60_000);

  it('the Missile Truck is a boss-only chapter 2 enemy: no planner draws it, and its first sight on Saltgate says "New on The Narrows"', () => {
    expect(FOES.missileTruck.chapter).toBe(2);
    expect(BOSS_FOES).toEqual(['missileTruck']);
    expect(FOE_ORDER).not.toContain('missileTruck');
    expect(FOES_BUILT).not.toContain('missileTruck');
    expect(isFoe('missileTruck')).toBe(true);
    expect(foeDebutTag('missileTruck')).toBe('New on The Narrows');
    expect(mapDebutsFoe('saltgate', 'missileTruck')).toBe(true);
    expect(mapDebutsFoe('island', 'missileTruck')).toBe(false);
  });
});


describe('Battery Point\'s boss rounds (log v45, MAP_BOSS): the Blackout at the guns rises; a rev 3 log and the campaign play it as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('more stealth strafers each round, closer together, with shells and heavies at the shore guns', () => {
    const off = playMimic('battery', 218, opts);
    const old = playMimic('battery', 218, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own 8 strafers and nothing else.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('blackout');
      expect(e.sent.stealthJet).toBe(8);
      expect((e.sent.ballistic ?? 0) + (e.sent.heavy ?? 0)).toBe(0);
    }
    const on = playMimic('battery', 218, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.battery!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['blackout', 1], ['blackout', 2], ['blackout', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.stealthJet)).toEqual(done.map((e) => rounds[e.run! - 1].jets));
    for (const kind of ['ballistic', 'heavy'] as const) expect(done.map((e) => e.sent[kind] ?? 0), kind).toEqual(done.map((e) => fired(rounds[e.run! - 1], kind)));
    for (const r of rounds) {
      // The jets lead; every shell and heavy goes for the shore guns, off a
      // silo that launches it.
      expect(r.jets!, 'the jets lead').toBeGreaterThan(fired(r, 'ballistic') + fired(r, 'heavy'));
      expect(fired(r, 'heavy'), 'a heavy at the guns').toBeGreaterThanOrEqual(1);
      for (const f of r.fire ?? []) {
        expect(MAPS.battery.bases[f.base!].kinds).toContain(f.kind);
        expect(f.aim).toBe('post');
      }
    }
    // More each round, and the jets closer together.
    const weight = rounds.map((r) => 3 * r.jets! + 2 * fired(r, 'ballistic') + 8 * fired(r, 'heavy'));
    for (let k = 1; k < weight.length; k++) {
      expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
      expect(rounds[k].jetGap!, `round ${k + 1}`).toBeLessThan(rounds[k - 1].jetGap!);
    }
    roundLengths(done);
    // The boss keeps the event's name, and the shared intro cards.
    expect(eventName('blackout', 'battery', ENCOUNTER_REV)).toBe('Blackout');
  }, 90_000);
});

describe('Sowers\' Reach\'s boss rounds (log v48, MAP_BOSS): the Carpet Run sows and rises; a rev 3 log and the campaign play it as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('more vees of stealth bombers each round, closer together, each sowing mines ahead of the convoy, with mines off the chutes and fire at the lead ship', () => {
    // (Seed 220: the tryhard bot plays all three rounds there; tools/v3/sowers/probe-boss.ts.)
    const off = playMimic('sowers', 220, opts);
    const old = playMimic('sowers', 220, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own two vees of three, and nothing else.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('carpet-run');
      expect(e.sent.stealthBomber).toBe(6);
      expect((e.sent.mine ?? 0) + (e.sent.ballistic ?? 0) + (e.sent.guided ?? 0)).toBe(0);
    }
    const on = playMimic('sowers', 220, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.sowers!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['carpet-run', 1], ['carpet-run', 2], ['carpet-run', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.stealthBomber)).toEqual(done.map((e) => 3 * rounds[e.run! - 1].vees!));
    for (const kind of ['mine', 'ballistic', 'guided'] as const) expect(done.map((e) => e.sent[kind] ?? 0), kind).toEqual(done.map((e) => fired(rounds[e.run! - 1], kind)));
    for (const r of rounds) {
      // Every bomber sows; the chutes drop mines; the rest goes for the lead ship.
      expect(r.sow!).toBeGreaterThanOrEqual(2);
      expect(fired(r, 'mine'), 'mines off the chutes').toBeGreaterThanOrEqual(3);
      for (const f of r.fire ?? []) {
        expect(MAPS.sowers.bases[f.base!].kinds).toContain(f.kind);
        if (f.kind === 'mine') expect(MAPS.sowers.bases[f.base!].chute).toBe(true);
        else expect(f.aim).toBe('lead');
      }
    }
    // More each round (a vee of three, each its hits and its mines), and the
    // vees no further apart.
    const weight = rounds.map((r) => 3 * r.vees! * (r.veeHp! + r.sow!) + fired(r, 'mine') + 2 * (fired(r, 'ballistic') + fired(r, 'guided') + fired(r, 'cluster')));
    for (let k = 1; k < weight.length; k++) {
      expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
      expect(rounds[k].veeGap!, `round ${k + 1}`).toBeLessThanOrEqual(rounds[k - 1].veeGap!);
    }
    roundLengths(done);
    // The boss keeps the event's name, and the shared intro cards.
    expect(eventName('carpet-run', 'sowers', ENCOUNTER_REV)).toBe('Carpet Run');
  }, 90_000);
});

describe('the Rig Field\'s boss rounds (log v49, MAP_BOSS): the Rig Barrage rises; a rev 3 log and the campaign play the Dive Circus as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('the downed rigs rise again each round, more of them, and every rig standing fires its volley together at the ship halfway along', () => {
    // (Seed 220: the tryhard bot plays all three rounds there, every rig
    // still standing from the start; tools/v3/rigs/probe-boss.ts. Since log
    // v55 the rigs count shots, and seed 219's run ends in round 2.)
    const off = playMimic('rigs', 220, opts);
    const old = playMimic('rigs', 220, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own dive bombers and missile pairs.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('dive-circus');
      expect(e.sent.diveBomber).toBe(8);
      expect(e.sent.rig ?? 0).toBe(0);
    }
    const on = playMimic('rigs', 220, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.rigs!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['dive-circus', 1], ['dive-circus', 2], ['dive-circus', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    for (const e of done) {
      // No dive bomber and no missile pair: the rigs are the boss.
      expect(e.sent.diveBomber ?? 0).toBe(0);
      // What the rigs fired: their volleys, each rig its own kind.
      expect((e.sent.guided ?? 0) + (e.sent.ballistic ?? 0) + (e.sent.drone ?? 0), `round ${e.run}`).toBeGreaterThan(0);
    }
    // Rising: more rigs stand, as many volleys or more, no further apart.
    for (let k = 1; k < rounds.length; k++) {
      expect(rounds[k].rigs!, `round ${k + 1}`).toBeGreaterThan(rounds[k - 1].rigs!);
      expect(rounds[k].rigs! * rounds[k].barrage!.count * rounds[k].barrage!.size, `round ${k + 1}`).toBeGreaterThan(rounds[k - 1].rigs! * rounds[k - 1].barrage!.count * rounds[k - 1].barrage!.size);
    }
    for (const r of rounds) {
      expect(r.rigs!).toBeLessThanOrEqual(rigStations(createGame('rigs', 1, 1)).length);
      expect(r.barrage!.warn, 'each volley lit first').toBeGreaterThanOrEqual(1);
    }
    roundLengths(done);
    // The boss has a name of its own; the event's id stays.
    expect(eventName('dive-circus', 'rigs', ENCOUNTER_REV)).toBe('Rig Barrage');
    expect(eventName('dive-circus', 'rigs', 3)).toBe('Dive Circus');
    expect(eventName('dive-circus', 'rigs')).toBe('Dive Circus');
  }, 90_000);

  it('a round raises the downed rigs (the middle two first) until so many stand; a rig still standing keeps its hits', () => {
    const g = createGame('rigs', 3, 11);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    const st = rigStations(g);
    // Every rig down but the east one, worn to 30 hits.
    for (const i of st.slice(0, 3)) {
      const r = rigAt(g, i)!;
      damageThreat(g, r, r.hp, false, 'nuke'); // (log v55: rigs count shots; a nuke's hits count whole)
    }
    rigAt(g, st[3])!.hp = 30;
    expect(st.map((i) => g.baseDown[i])).toEqual([true, true, true, false]);
    for (let i = 0; i < 30 / DT && !g.event; i++) step(g, DT);
    expect(g.event?.id).toBe('dive-circus');
    for (let i = 0; i < 40 / DT && st.filter((i) => !g.baseDown[i]).length < 2; i++) step(g, DT);
    // Round 1: two stand, the east one (still standing) and the west-middle (the first to rise).
    expect(st.map((i) => !g.baseDown[i])).toEqual([false, true, false, true]);
    expect(rigAt(g, st[1])!.hp).toBe(MAP_BOSS.rigs!.rounds![0].rigHp);
    expect(rigAt(g, st[3])!.hp).toBeLessThanOrEqual(30);
  }, 30_000);
});

describe('Dreadnought Pass\'s boss (log v51, MAP_BOSS): the Dreadnought itself on the Fire Mission\'s spotters, rising; a rev 3 log and the campaign play the Fire Mission as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('each round the battleship steams in, heaves to and fires, its spotters calling barrages from its hull; tougher, longer on station, more spotters and swarms each round', () => {
    // (Seed 218: the tryhard bot plays all three rounds there; tools/v3/dreadnought/probe-boss.ts.)
    const off = playMimic('dreadnought', 218, opts);
    const old = playMimic('dreadnought', 218, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the Fire Mission's spotters and swarms, no battleship.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('fire-mission');
      expect(e.sent.dreadnought ?? 0).toBe(0);
    }
    const on = playMimic('dreadnought', 218, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.dreadnought!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['fire-mission', 1], ['fire-mission', 2], ['fire-mission', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    for (const e of done) {
      const R = rounds[e.run! - 1];
      expect(e.sent.dreadnought, `run ${e.run}`).toBe(1);
      expect(e.sent.spotter ?? 0, `run ${e.run}`).toBeLessThanOrEqual(R.spotters! * R.turns!);
      expect(e.sent.drone, `run ${e.run}`).toBe(R.swarms! * R.size!);
    }
    for (const r of rounds) {
      expect(r.dread!.hold).toBeDefined();
      expect(r.dread!.aim).toBe('lead');
    }
    // Rising: a tougher hull, longer on station, more spotter turns and
    // more drones each round.
    for (let k = 1; k < rounds.length; k++) {
      const [a, b] = [rounds[k - 1], rounds[k]];
      expect(b.dread!.hp, `round ${k + 1}`).toBeGreaterThan(a.dread!.hp);
      expect(b.dread!.hold![1], `round ${k + 1}`).toBeGreaterThan(a.dread!.hold![1]);
      expect(b.spotters! * b.turns!, `round ${k + 1}`).toBeGreaterThanOrEqual(a.spotters! * a.turns!);
      expect(b.swarms! * b.size!, `round ${k + 1}`).toBeGreaterThan(a.swarms! * a.size!);
    }
    roundLengths(done);
    // The boss is named for the battleship under the layer, with the shared
    // intro cards; the campaign reads the Fire Mission.
    expect(eventName('fire-mission', 'dreadnought', ENCOUNTER_REV)).toBe('The Dreadnought');
    expect(eventName('fire-mission', 'dreadnought', 3)).toBe('Fire Mission');
  }, 90_000);

  it('sunk, the Dreadnought is silent: its spotters have no guns to call', () => {
    const g = createGame('dreadnought', 218, 11);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    let sunk = false;
    let shells = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 40 / DT && g.wave === 11; i++) {
      step(g, DT);
      const d = g.threats.find((t) => t.kind === 'dreadnought' && !t.dead);
      // Sink it as soon as it is on the map, before its spotter comes.
      if (d && !sunk && d.x < VIEW.width - 20) {
        damageThreat(g, d, d.hp, false, 'gun');
        sunk = true;
      }
      for (const m of g.foe.marks) {
        if (m.kind !== 'shell' || seen.has(m.id)) continue;
        seen.add(m.id);
        shells++;
      }
    }
    expect(sunk).toBe(true);
    expect(shells).toBe(0);
    expect(g.event?.sent.spotter ?? 0).toBe(0);
  }, 60_000);
});

describe('the Black Strait\'s boss rounds (log v52, MAP_BOSS): the Bombardment walks the far shore, then the dark bank, and rises; a rev 3 log and the campaign play it as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  const fired = (r: { fire?: { kind: string; count?: number }[] }, kind: string) => (r.fire ?? []).filter((f) => f.kind === kind).reduce((a, f) => a + (f.count ?? 1), 0);
  it('a line of siege guns along the far shore, more each round and from round 2 on the dark bank too, with fire out of the dark bank at the lead ship', () => {
    // (Seed 225: the tryhard bot plays all three rounds there; tools/v3/lantern/probe-boss.ts.)
    const off = playMimic('lantern', 225, opts);
    const old = playMimic('lantern', 225, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own three hatches and supply swarms.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('bombardment');
      expect(e.sent.siege).toBe(EV.bombardment.guns);
      expect((e.sent.ballistic ?? 0) + (e.sent.guided ?? 0) + (e.sent.cluster ?? 0)).toBe(0);
    }
    const on = playMimic('lantern', 225, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.lantern!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['bombardment', 1], ['bombardment', 2], ['bombardment', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    expect(done.map((e) => e.sent.siege)).toEqual(done.map((e) => rounds[e.run! - 1].guns! + rounds[e.run! - 1].dark!));
    for (const kind of ['ballistic', 'guided', 'cluster'] as const) expect(done.map((e) => e.sent[kind] ?? 0), kind).toEqual(done.map((e) => fired(rounds[e.run! - 1], kind)));
    for (const r of rounds) {
      // The rest comes out of the dark bank (bases 4 and 5) at the lead ship.
      for (const f of r.fire ?? []) {
        expect(MAPS.lantern.bases[f.base!].kinds).toContain(f.kind);
        expect([4, 5]).toContain(f.base);
        expect(f.aim).toBe('lead');
      }
    }
    // Guns on the dark bank from round 2 (the signature's place).
    expect(rounds.map((r) => r.dark)).toEqual([0, 1, 2]);
    // More each round (a gun is five hits and its salvos), the line no
    // further apart.
    const weight = rounds.map((r) => (r.guns! + r.dark!) * (5 + 2 * r.gunSalvos!) + 2 * (fired(r, 'ballistic') + fired(r, 'guided')) + 4 * fired(r, 'cluster'));
    for (let k = 1; k < weight.length; k++) {
      expect(weight[k], `round ${k + 1}`).toBeGreaterThan(weight[k - 1]);
      expect(rounds[k].gunGap!, `round ${k + 1}`).toBeLessThanOrEqual(rounds[k - 1].gunGap!);
    }
    roundLengths(done);
    // The boss keeps the event's name, and the shared intro cards.
    expect(eventName('bombardment', 'lantern', ENCOUNTER_REV)).toBe('Bombardment');
  }, 90_000);

  it('the guns rise beside the far shore\'s silos in a line, west to east, then beside the dark bank\'s', () => {
    const g = createGame('lantern', 3, 13);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    const r = MAP_BOSS.lantern!.rounds![2];
    const hatches: { x: number; y: number; dur: number }[] = [];
    for (let i = 0; i < 40 / DT && !hatches.length; i++) {
      step(g, DT);
      if (g.event) for (const m of g.foe.marks) if (m.kind === 'hatch' && m.spawn) hatches.push({ x: m.x, y: m.y, dur: m.dur });
    }
    expect(g.event?.id).toBe('bombardment');
    expect(g.event?.run).toBe(3);
    expect(hatches.length).toBe(r.guns! + r.dark!);
    const far = hatches.filter((h) => h.y < 450);
    const near = hatches.filter((h) => h.y > 450);
    expect(far.length).toBe(r.guns!);
    expect(near.length).toBe(r.dark!);
    // West to east, each opening after the one before.
    for (let k = 1; k < far.length; k++) {
      expect(far[k].x).toBeGreaterThan(far[k - 1].x);
      expect(far[k].dur).toBeGreaterThan(far[k - 1].dur);
    }
    for (const h of near) expect(h.dur).toBeGreaterThan(far[far.length - 1].dur);
  });
});

describe('the Delta\'s boss rounds (log v68, MAP_BOSS): the Long Gauntlet rises; a rev 3 log and the campaign play the Escort Run as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('the whole shore fires down the river in order (more of it each round) and a raid comes at the ships on the way in; no guarded heavy', () => {
    // (Seed DELTA_BOSS_SEED: the tryhard bot plays the rounds there;
    // tools/v3/delta/probe-boss.ts.)
    const off = playMimic('delta', DELTA_BOSS_SEED, opts);
    const old = playMimic('delta', DELTA_BOSS_SEED, { ...opts, encounters: { rev: 3, version: 'v1' } });
    // Before the layer: the event's own heavy in its rings of guards.
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('escort-run');
      expect(e.sent.heavy ?? 0).toBeGreaterThan(0);
    }
    const on = playMimic('delta', DELTA_BOSS_SEED, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.delta!.rounds!;
    expect(on.game.eventLog.map((e) => e.id)).toEqual(['escort-run', 'escort-run', 'escort-run'].slice(0, on.game.eventLog.length));
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(1);
    for (const e of done) {
      // No heavy and no guard: the fire down the river and the raid are the boss.
      expect(e.sent.heavy ?? 0).toBe(0);
      expect(e.sent.guard ?? 0).toBe(0);
      expect((e.sent.drone ?? 0) + (e.sent.guided ?? 0) + (e.sent.ballistic ?? 0), `round ${e.run}`).toBeGreaterThan(0);
    }
    // Rising: more strikes, more launches in them, a raid at least as big.
    const launches = (r: (typeof rounds)[number]) => r.strikes!.reduce((a, st) => a + st.from.reduce((b, f) => b + f.count, 0), 0);
    const raid = (r: (typeof rounds)[number]) => r.fire!.reduce((a, f) => a + (f.count ?? 1), 0);
    for (let k = 1; k < rounds.length; k++) {
      expect(launches(rounds[k]), `round ${k + 1}`).toBeGreaterThan(launches(rounds[k - 1]));
      expect(rounds[k].strikes!.length, `round ${k + 1}`).toBeGreaterThanOrEqual(rounds[k - 1].strikes!.length);
      expect(raid(rounds[k]), `round ${k + 1}`).toBeGreaterThanOrEqual(raid(rounds[k - 1]));
    }
    // Each strike lights its silos at least 2 s first (m-reads), and the
    // strikes run west to east: the silos of a strike are never further west than the last's.
    const m = MAPS.delta;
    for (const r of rounds) {
      let prev = -Infinity;
      for (const st of r.strikes!) {
        expect(st.warn, 'warned ahead (m-reads)').toBeGreaterThanOrEqual(2);
        expect(st.at, 'lit before the round starts?').toBeGreaterThanOrEqual(st.warn);
        const lead = Math.min(...st.from.map((f) => m.bases[f.base].x));
        expect(lead, 'down the river, west to east').toBeGreaterThanOrEqual(prev - 700);
        prev = lead;
        for (const f of st.from) expect(m.bases[f.base].kinds, `${f.kind} out of base ${f.base}`).toContain(f.kind);
      }
    }
    roundLengths(done);
    // The boss has a name of its own; the event's id stays.
    expect(eventName('escort-run', 'delta', ENCOUNTER_REV)).toBe('Long Gauntlet');
    expect(eventName('escort-run', 'delta', 3)).toBe('Escort Run');
    expect(eventName('escort-run', 'delta')).toBe('Escort Run');
  }, 180_000);

  it('a strike lights its silos first, then fires from them at the ships nearest each', () => {
    const g = createGame('delta', 3, 11);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    for (let i = 0; i < 60 / DT && !g.event; i++) step(g, DT);
    expect(g.event?.id).toBe('escort-run');
    const S = MAP_BOSS.delta!.rounds![0].strikes![0];
    const lit = (b: number) => g.fx.some((f) => f.kind === 'launch' && Math.hypot(f.x - g.map.bases[b].x, f.y - g.map.bases[b].y) < 1 && f.r === 52);
    let litAt = -1;
    let firedAt = -1;
    for (let i = 0; i < 40 / DT && firedAt < 0; i++) {
      step(g, DT);
      if (litAt < 0 && S.from.every((f) => lit(f.base))) litAt = g.t;
      if (litAt >= 0 && firedAt < 0 && g.threats.some((t) => t.kind === S.from[0].kind && Math.hypot(t.sx - g.map.bases[S.from[0].base].x, t.sy - g.map.bases[S.from[0].base].y) < 2)) firedAt = g.t;
    }
    expect(litAt).toBeGreaterThan(0);
    expect(firedAt - litAt, 'lit about the strike\'s warning ahead').toBeGreaterThanOrEqual(S.warn - 0.5);
  }, 60_000);
});

describe('a chapter 2 map\'s signature threat (log v33, round 9: MAP_SIGNATURE)', () => {
  const kinds = (g: Game, kind: string) => g.queue.filter((l) => l.at < 1e8 && l.kind === kind);
  it('the Island: from wave 6 the wave\'s new enemies are attack helicopters; its debut waves 2-5 are as they were', () => {
    expect(MAP_SIGNATURE.island).toMatchObject({ from: 6, foe: 'attackHeli' });
    for (let w = 2; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('island', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('island', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('island', seed, w);
        if (w >= 6) {
          expect(signatureOf('island', w, on.enc!.setup), `wave ${w}`).toBeDefined();
          expect(kinds(on, 'attackHeli').length, `wave ${w} seed ${seed}`).toBe(foeCount(w));
        } else {
          // Waves 2-5: each its one new enemy, as before (rule m-enemy).
          expect(signatureOf('island', w, on.enc!.setup), `wave ${w}`).toBeUndefined();
        }
        // Lab only: the campaign and the shared wave (`only: []`) draw their own.
        expect(signatureOf('island', w, shared.enc!.setup)).toBeUndefined();
        expect(camp.enc).toBeFalsy();
        // Launch for launch: the helicopters stand in for the drawn enemies,
        // each taking what that one would have (rule w-budget).
        const foes = (g: Game) => g.queue.filter((l) => l.at < 1e8 && isFoe(l.kind)).length + g.raiderQueue.length;
        if (w >= 6) expect(kinds(on, 'attackHeli').length).toBeLessThanOrEqual(foes(on));
      }
    // Never before rev 4, nor past the tenth wave.
    expect(signatureOf('island', 7, { rev: 3 })).toBeUndefined();
    expect(signatureOf('island', 11, { rev: 4 })).toBeUndefined();
  });

  it('the Behemoth Run: from wave 4 the wave\'s jets strafe the supertanker\'s lane and its heavies go for the tanker', () => {
    expect(MAP_SIGNATURE.behemoth).toMatchObject({ from: 4, jets: 'vip', heavies: 'vip' });
    let jets = 0;
    let heavies = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('behemoth', seed, w);
        applyEncounters(on, VER('v1'));
        const camp = createGame('behemoth', seed, w);
        for (const l of kinds(on, 'strafer')) {
          // An authored jet keeps its own aim; the wave's own aim at the tanker.
          if (!l.enc) expect(l.aim, `wave ${w}`).toBe(w >= 4 ? 'vip' : undefined);
          if (l.aim === 'vip') jets++;
        }
        for (const l of kinds(on, 'heavy')) {
          expect(l.aim, `wave ${w}`).toBe('vip');
          heavies++;
        }
        for (const l of [...kinds(camp, 'strafer'), ...kinds(camp, 'heavy')]) expect(l.aim).toBeUndefined();
      }
    expect(jets).toBeGreaterThan(0);
    expect(heavies).toBeGreaterThan(0);
    // A jet aimed at the tanker flies down the middle of its lane.
    const g = createGame('behemoth', 1, 4);
    const lane = g.map.channels.find((c) => c.vip)!;
    expect(vipRoute(g)!.y).toBeCloseTo(lane.y!, 0);
    expect(vipRoute(createGame('strait', 1, 4))).toBeNull();
  });

  it('the Needle of Bosk (log v35): from wave 4 the wave\'s new enemies come as small walls of armored drones, the Shield Wall\'s own', () => {
    const sig = MAP_SIGNATURE.needle!;
    expect(sig).toMatchObject({ from: 4, foe: 'armored', foeShare: 1 });
    expect(sig.block).toBeGreaterThanOrEqual(2);
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('needle', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('needle', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const armored = kinds(on, 'armored');
        if (w >= 4) {
          expect(signatureOf('needle', w, on.enc!.setup), `wave ${w}`).toBeDefined();
          // Each of the wave's new enemies a wall of `block` (no bigger than
          // the swarm it stands in for), each wall out of one base.
          expect(armored.length, `wave ${w} seed ${seed}`).toBe(foeCount(w) * Math.min(sig.block!, waveSpec(w, MAPS.needle.threatScale).swarm));
          expect(new Set(armored.map((l) => l.base)).size, `wave ${w} seed ${seed}`).toBeLessThanOrEqual(foeCount(w));
          // Launch for launch, no bigger than the shared wave (rule w-budget).
          expect(planned(on), `wave ${w} seed ${seed}`).toBeLessThanOrEqual(planned(shared) + 2);
        } else expect(signatureOf('needle', w, on.enc!.setup), `wave ${w}`).toBeUndefined();
        expect(signatureOf('needle', w, shared.enc!.setup)).toBeUndefined();
      }
    // The campaign plays the planner as it was: one of whatever it draws.
    const camp = createGame('needle', 1, 6);
    expect(camp.enc).toBeFalsy();
    expect(kinds(camp, 'armored').length).toBeLessThanOrEqual(foeCount(6));
    // The other signatures are one enemy each, as before.
    expect(MAP_SIGNATURE.island!.block).toBeUndefined();
  });

  it('the Archipelago (log v37): from wave 4 the wave\'s new enemies are drone motherships, out of the bases that launch them, each with a scavenger', () => {
    const sig = MAP_SIGNATURE.archipelago!;
    expect(sig).toMatchObject({ from: 4, kind: 'mothership', foeShare: 1, escort: 'scavenger' });
    expect(sig.foe).toBeUndefined();
    const launchers = MAPS.archipelago.bases.map((b, i) => (b.kinds.includes('mothership') ? i : -1)).filter((i) => i >= 0);
    expect(launchers).toEqual([0, 3]);
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('archipelago', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('archipelago', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const foes = (g: Game) => g.queue.filter((l) => l.at < 1e8 && isFoe(l.kind)).length;
        if (w >= 4) {
          expect(signatureOf('archipelago', w, on.enc!.setup), `wave ${w}`).toBeDefined();
          // Every new enemy the wave draws is a mothership, on top of the
          // map's own (its extras from wave 6; wave 6's encounter stands in
          // for its one), each with a Scavenger Drone: no other new enemy.
          const own = kinds(shared, 'mothership').length - (w === 6 ? 1 : 0);
          expect(kinds(on, 'mothership').length, `wave ${w} seed ${seed}`).toBe(own + foeCount(w));
          expect(kinds(on, 'scavenger').length, `wave ${w} seed ${seed}`).toBe(foeCount(w));
          expect(foes(on), `wave ${w} seed ${seed}`).toBe(foeCount(w));
          for (const l of kinds(on, 'mothership')) expect(launchers).toContain(l.base);
          // Launch for launch, within the wave budget (rule w-budget).
          expect(Math.abs(planned(on) / planned(shared) - 1), `wave ${w} seed ${seed}`).toBeLessThanOrEqual(0.2);
        } else expect(signatureOf('archipelago', w, on.enc!.setup), `wave ${w}`).toBeUndefined();
        expect(signatureOf('archipelago', w, shared.enc!.setup)).toBeUndefined();
      }
    // The campaign plays the planner as it was: the map's own motherships only.
    const camp = createGame('archipelago', 1, 6);
    expect(camp.enc).toBeFalsy();
    expect(kinds(camp, 'mothership').length).toBe(1);
    // The other signatures name a foe, and bring no escort.
    expect(MAP_SIGNATURE.island!.kind).toBeUndefined();
    expect(MAP_SIGNATURE.needle!.escort).toBeUndefined();
  });

  it('Saltgate Canal (log v42): from wave 4 the trucks come to the locks: half the wave\'s new enemies are Rocket Trucks firing at the ships held in a lock, its cluster missiles go there too, and the map sends no Torpedo Sub', () => {
    const sig = MAP_SIGNATURE.saltgate!;
    expect(sig).toMatchObject({ from: 4, foe: 'rocketTruck', foeShare: 0.5, clusters: 'lock', trucks: 'lock' });
    expect(MAP_FOE_SWAP.saltgate).toEqual({ torpedoSub: 'rocketTruck' });
    // Lab only, waves 1-10: the campaign, a rev 3 log and the shared wave
    // keep their subs.
    expect(swapFoe('saltgate', 3, 'torpedoSub', VER('v1'))).toBe('rocketTruck');
    expect(swapFoe('saltgate', 3, 'torpedoSub', { ...VER('v1'), only: [] })).toBe('torpedoSub');
    expect(swapFoe('saltgate', 3, 'torpedoSub', { rev: 3 })).toBe('torpedoSub');
    expect(swapFoe('saltgate', 3, 'torpedoSub', null)).toBe('torpedoSub');
    expect(swapFoe('saltgate', 11, 'torpedoSub', VER('v1'))).toBe('torpedoSub');
    expect(swapFoe('island', 3, 'torpedoSub', VER('v1'))).toBe('torpedoSub');
    // Heavy for heavy: the wave sends the same.
    expect(HEAVY_FOES).toContain('torpedoSub');
    expect(HEAVY_FOES).toContain('rocketTruck');
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('saltgate', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('saltgate', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('saltgate', seed, w);
        expect(kinds(on, 'torpedoSub').length, `wave ${w} seed ${seed}: no sub`).toBe(0);
        if (w >= 4) {
          expect(signatureOf('saltgate', w, on.enc!.setup), `wave ${w}`).toBeDefined();
          // At least half the wave's new enemies (rounded up) are trucks,
          // each at the locks; an encounter's truck keeps its own aim.
          const tr = kinds(on, 'rocketTruck');
          expect(tr.length, `wave ${w} seed ${seed}`).toBeGreaterThanOrEqual(Math.ceil(foeCount(w) / 2));
          for (const l of tr.filter((x) => !x.enc)) expect(l.aim, `wave ${w}`).toBe('lock');
          // The wave's own clusters off a silo fly at the locks; an
          // encounter's keep their own aim.
          for (const l of kinds(on, 'cluster').filter((x) => !x.enc)) expect(l.aim, `wave ${w}`).toBe('lock');
          // Launch for launch, within the wave budget (rule w-budget).
          expect(Math.abs(planned(on) / planned(shared) - 1), `wave ${w} seed ${seed}`).toBeLessThanOrEqual(0.2);
        } else expect(signatureOf('saltgate', w, on.enc!.setup), `wave ${w}`).toBeUndefined();
        expect(signatureOf('saltgate', w, shared.enc!.setup)).toBeUndefined();
        // Lab only: the campaign's and the shared wave's clusters and trucks
        // keep no aim.
        for (const l of [...kinds(camp, 'cluster'), ...kinds(shared, 'cluster'), ...kinds(camp, 'rocketTruck'), ...kinds(shared, 'rocketTruck')]) expect(l.aim).toBeUndefined();
        expect(camp.enc).toBeFalsy();
      }
    // Played (nobody shooting, no ship sunk, so the convoy reaches the
    // locks): every cluster of the wave's own, off a silo or a truck, goes
    // for a ship held at a lock when one is held there.
    const locks = MAPS.saltgate.locks!;
    const held = (s: { x: number }) => locks.some((l) => s.x >= l.x0 - 120 && s.x <= l.x1);
    let seen = 0;
    for (const w of [7, 9, 10])
      for (const seed of [1, 2, 3]) {
        const g = createGame('saltgate', seed, w);
        applyEncounters(g, VER('v1'));
        g.tempo = { ...g.tempo, lossLimit: 999 };
        g.carrierHp = 999;
        const ids = new Set<number>();
        for (let i = 0; i < 80 / DT && g.phase === 'wave' && g.wave === w; i++) {
          for (const s of g.ships) s.hp = 99;
          step(g, DT);
          for (const th of g.threats)
            if (th.kind === 'cluster' && !th.enc && !ids.has(th.id)) {
              ids.add(th.id);
              if (!g.ships.some(held)) continue;
              const t = g.ships.find((s) => s.id === th.target);
              expect(t && held(t), `wave ${w} seed ${seed}: cluster ${th.id} at a held ship`).toBe(true);
              seen++;
            }
        }
      }
    expect(seen).toBeGreaterThan(0);
    // The other signatures leave the clusters alone.
    for (const m of ['island', 'behemoth', 'needle', 'archipelago'] as const) expect(MAP_SIGNATURE[m]!.clusters, m).toBeUndefined();
  });

  it('Battery Point (log v45): from wave 4 the wave\'s heavies go for the shore guns, off a silo or a truck, and its strike jets come in dark; chapter 3\'s debut waves are as they were', () => {
    expect(MAP_SIGNATURE.battery).toMatchObject({ from: 4, heavies: 'post', stealth: true });
    let heavies = 0;
    let dark = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('battery', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('battery', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('battery', seed, w);
        // Every heavy goes for the guns (an encounter's says so itself).
        for (const l of kinds(on, 'heavy')) {
          expect(l.aim, `wave ${w}`).toBe('post');
          heavies++;
        }
        // From wave 4 no jet comes with an arrow: each is a Stealth Strafer.
        if (w >= 4) expect(kinds(on, 'strafer'), `wave ${w}`).toHaveLength(0);
        else expect(kinds(on, 'stealthJet').filter((l) => l.enc), `wave ${w}`).toHaveLength(0);
        if (w >= 4) dark += kinds(on, 'stealthJet').length;
        // The new enemies the wave draws are the planner's own (the debuts
        // of chapter 3's five: waves 2-6).
        const drawn = (g: Game) => g.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && l.kind !== 'stealthJet').map((l) => l.kind).sort();
        expect(drawn(on), `wave ${w}`).toEqual(drawn(shared));
        // The campaign and the shared wave aim their heavies as ever.
        for (const l of [...kinds(camp, 'heavy'), ...kinds(shared, 'heavy')]) expect(l.aim).toBeUndefined();
        // The campaign's jets keep their arrows.
        if (w >= 3) expect(kinds(camp, 'strafer').length, `wave ${w}`).toBeGreaterThan(0);
      }
    expect(heavies).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0);
    // A truck's heavy at the guns too (the layer only).
    const g = createGame('battery', 3, 8);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    const truckHeavies: number[] = [];
    for (let i = 0; i < 70 / DT && g.wave === 8; i++) {
      step(g, DT);
      for (const t of g.threats) if (t.kind === 'heavy' && t.from !== undefined && !truckHeavies.includes(t.id) && g.posts.some((_, k) => g.posts[k].downT <= 0)) {
        truckHeavies.push(t.id);
        expect(t.target, `heavy ${t.id}`).toBeLessThanOrEqual(-10);
      }
    }
    expect(truckHeavies.length).toBeGreaterThan(0);
    expect(signatureOf('battery', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('battery', 4, { rev: 3 })).toBeUndefined();
  });

  it('Sowers\' Reach (log v48): from wave 4 the wave\'s new enemies are stealth bombers that sow mines; the campaign and the shared wave keep the planner\'s own', () => {
    expect(MAP_SIGNATURE.sowers).toMatchObject({ from: 4, foe: 'stealthBomber', foeShare: 1, sow: 3 });
    let sowers = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('sowers', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('sowers', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('sowers', seed, w);
        const bombers = kinds(on, 'stealthBomber');
        if (w < 4) {
          for (const l of bombers) expect(l.sow, `wave ${w}`).toBeUndefined();
        } else {
          // Every new enemy the wave sends is a sowing stealth bomber (but
          // those the wave's encounter sends in its place).
          const drawn = on.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && !l.enc);
          for (const l of drawn) expect([l.kind, l.sow], `wave ${w}`).toEqual(['stealthBomber', 3]);
          for (const l of bombers) expect(l.sow, `wave ${w}`).toBe(3);
          sowers += bombers.length;
        }
        for (const l of [...kinds(camp, 'stealthBomber'), ...kinds(shared, 'stealthBomber')]) expect(l.sow).toBeUndefined();
      }
    expect(sowers).toBeGreaterThan(20);
    expect(signatureOf('sowers', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('sowers', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('sowers', 4, { rev: 4, only: [] })).toBeUndefined();
  });

  it('the Rig Field (log v49): from wave 4 the wave\'s new enemies come as relief rigs towed in; the campaign and the shared wave keep the planner\'s own', () => {
    expect(MAP_SIGNATURE.rigs).toMatchObject({ from: 4, kind: 'rig', foeShare: 1 });
    let tows = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('rigs', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('rigs', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('rigs', seed, w);
        const towed = kinds(on, 'rig');
        // The wave's own: no new enemy but its relief rigs (and none before wave 4).
        const drawn = on.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && !l.enc);
        if (w < 4) expect(towed.filter((l) => !l.enc), `wave ${w}`).toEqual([]);
        else {
          expect(drawn, `wave ${w}`).toEqual([]);
          tows += towed.length;
        }
        for (const l of towed) expect(l.base, `wave ${w}`).toBe(-1);
        expect([...kinds(camp, 'rig'), ...kinds(shared, 'rig')]).toEqual([]);
      }
    expect(tows).toBeGreaterThanOrEqual(18);
    expect(signatureOf('rigs', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('rigs', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('rigs', 4, { rev: 4, only: [] })).toBeUndefined();
  });

  it('a relief rig sails in along the rig line to a downed station and stands there again, firing its rack; sunk on the way, it drops nothing', () => {
    const g = createGame('rigs', 5, 4);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    // Nothing else in the wave, held open (a structure alone does not).
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    const st = rigStations(g);
    const west = rigAt(g, st[0])!;
    damageThreat(g, west, west.hp, false, 'nuke');
    expect(g.baseDown[st[0]]).toBe(true);
    towRig(g, 1);
    const tow = g.threats.find((t) => t.tow !== undefined)!;
    expect(tow.tow).toBe(st[0]);
    expect(tow.hp).toBe(TOW.hp);
    expect(tow.x).toBeLessThan(0);
    expect(tow.y).toBe(MAPS.rigs.bases[st[0]].y);
    let rack = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 20 / DT && g.baseDown[st[0]]; i++) {
      step(g, DT);
      expect(tow.y).toBe(MAPS.rigs.bases[st[0]].y);
    }
    // Docked: the station stands again, TOW.dock hits, and its rack goes off.
    expect(g.baseDown[st[0]]).toBe(false);
    expect(rigAt(g, st[0])!.id).toBe(tow.id);
    expect(tow.hp).toBe(TOW.dock);
    for (let i = 0; i < 4 / DT; i++) {
      step(g, DT);
      for (const t of g.threats) if (!seen.has(t.id) && t.rack) {
        seen.add(t.id);
        rack++;
        expect(t.kind).toBe('guided');
      }
    }
    expect(rack).toBe(TOW.rack);
    // A second, with a rig standing at every station: it mends the most
    // damaged one, and goes.
    const east = rigAt(g, st[3])!;
    east.hp = 10;
    towRig(g);
    const mend = g.threats.find((t) => t.tow !== undefined)!;
    expect(mend.tow).toBe(st[3]);
    expect(mend.x).toBeGreaterThan(VIEW.width);
    for (let i = 0; i < 20 / DT && !mend.dead; i++) step(g, DT);
    expect(east.hp).toBe(10 + TOW.dock);
    // A third, sunk on its way in: no pickup, and the station stays down.
    damageThreat(g, rigAt(g, st[1])!, 99, false, 'nuke');
    towRig(g);
    const sunk = g.threats.find((t) => t.tow !== undefined)!;
    const pickups = g.pickups.length;
    for (let i = 0; i < 2 / DT; i++) step(g, DT);
    // (Log v55: the Rig Field's rigs count shots: one a shot.)
    for (let k = 0; k < 99 && !sunk.dead; k++) damageThreat(g, sunk, 1, true, 'gun');
    expect(sunk.dead).toBe(true);
    expect(g.pickups.length).toBe(pickups);
    expect(g.baseDown[st[1]]).toBe(true);
  });

  it('the Delta (log v68): from wave 4 the wave\'s new enemies are Rocket Trucks on the banks, each at the ship nearest it; the campaign and the shared wave keep the planner\'s own', () => {
    expect(MAP_SIGNATURE.delta).toMatchObject({ from: 4, foe: 'rocketTruck', foeShare: 1, trucks: 'near' });
    let trucks = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('delta', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('delta', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const drawn = on.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && !l.enc);
        if (w >= 4) {
          // The wave's own new enemies: every one a truck on a bank, aimed at the ship nearest it.
          for (const l of drawn) expect([l.kind, l.aim], `wave ${w}`).toEqual(['rocketTruck', 'near']);
          trucks += drawn.length;
        }
        for (const l of shared.queue) expect(l.aim ?? 'any', `wave ${w}`).not.toBe('near');
      }
    expect(trucks).toBeGreaterThanOrEqual(9);
    expect(signatureOf('delta', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('delta', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('delta', 4, { rev: 4, only: [] })).toBeUndefined();
  });

  it('the Delta\'s river (log v68): one lane about three times the usual length, no fork, a pop-up road to a bank over every leg', () => {
    const m = MAPS.delta;
    const world = createGame('delta', 1, 1);
    const onLandAt = (_m: unknown, x: number, y: number) => onLand(world, x, y);
    expect(m.fork).toBeUndefined();
    expect(m.channels.length).toBe(1);
    const usual = laneLength(MAPS.strait.channels[0]);
    const len = laneLength(m.channels[0]);
    expect(len / usual).toBeGreaterThan(2.7);
    expect(len / usual).toBeLessThan(3.3);
    // Three legs: the lane's y at the legs' middles runs north, middle, south.
    const at = (x: number, from: number, to: number) => {
      for (let d = from; d < to; d += 4) {
        const p = lanePoint(m.channels[0], d);
        if (Math.abs(p.x - x) < 3) return p.y;
      }
      return NaN;
    };
    const legs = [at(700, 0, len * 0.3), at(700, len * 0.35, len * 0.65), at(700, len * 0.7, len)];
    expect(legs[0]).toBeLessThan(legs[1]);
    expect(legs[1]).toBeLessThan(legs[2]);
    // Every silo stands on land, every pop-up road ends on the water's edge of some leg.
    for (const b of m.bases) expect(onLandAt(m, b.x, b.y), `silo ${b.x},${b.y}`).toBe(true);
    for (const r of m.roads.popups) {
      const end = r.to;
      const near = Math.min(...laneSamples(m.channels[0], 20).map(({ p }) => Math.hypot(p.x - end.x, p.y - end.y)));
      expect(near, `a road to the bank at ${end.x},${end.y}`).toBeLessThan(110);
    }
    // The carrier and the frigate sit in water, in the bay between the middle and south legs.
    expect(onLandAt(m, m.carrier.x, m.carrier.y)).toBe(false);
    expect(onLandAt(m, m.frigate.x, m.frigate.y)).toBe(false);
  });

  it('the Black Strait (log v52): from wave 4 the wave\'s new enemies are siege guns beside the dark bank; the campaign and the shared wave keep the planner\'s own', () => {
    expect(MAP_SIGNATURE.lantern).toMatchObject({ from: 4, foe: 'siege', foeShare: 1, beside: [4, 5] });
    let guns = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('lantern', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('lantern', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('lantern', seed, w);
        const drawn = on.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && !l.enc);
        if (w >= 4) {
          // Every new enemy the wave sends is a siege gun beside the dark
          // bank (bases 4 and 5, in turn), firing the signature's salvos.
          for (const l of drawn) expect([l.kind, l.base, l.salvos], `wave ${w}`).toEqual(['siege', [4, 5][drawn.indexOf(l) % 2], MAP_SIGNATURE.lantern!.salvos]);
          guns += drawn.length;
          // Launch for launch, within the wave budget (rule w-budget).
          expect(Math.abs(planned(on) / planned(shared) - 1), `wave ${w} seed ${seed}`).toBeLessThanOrEqual(0.2);
        } else for (const l of kinds(on, 'siege')) expect(l.base, `wave ${w}`).toBe(-1);
        // Lab only: the campaign's and the shared wave's siege guns rise beside any base.
        for (const l of [...kinds(camp, 'siege'), ...kinds(shared, 'siege')]) expect(l.base).toBe(-1);
      }
    expect(guns).toBeGreaterThan(20);
    expect(signatureOf('lantern', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('lantern', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('lantern', 4, { rev: 4, only: [] })).toBeUndefined();
    // Played: each gun comes up out of a hatch beside a dark-bank base, the
    // wave's own on the side towards the middle, an encounter's on the
    // other, so no two share a hatch.
    const g = createGame('lantern', 5, 7);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    const spots = new Set<string>();
    for (let i = 0; i < 90 / DT && g.wave === 7; i++) {
      step(g, DT);
      for (const m of g.foe.marks) if (m.kind === 'hatch' && m.spawn) spots.add(`${Math.round(m.x)},${Math.round(m.y)}`);
    }
    const dark = [4, 5].flatMap((i) => [1, -1].map((side) => siegeSpotAt(g, MAPS.lantern.bases[i], side as 1 | -1))).map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
    expect(spots.size).toBeGreaterThanOrEqual(2);
    for (const sp of spots) expect(dark, sp).toContain(sp);
  });

  it('a sowing bomber lays its mines in the water just ahead of a ship, and fires no missile', () => {
    const g = createGame('sowers', 5, 4);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    const ch = MAPS.sowers.channels[0];
    const sown: { x: number; y: number; ahead: number }[] = [];
    const seen = new Set<number>();
    let missiles = 0;
    for (let i = 0; i < 90 / DT && g.wave === 4; i++) {
      step(g, DT);
      for (const t of g.threats) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        if (t.parent === 'stealthBomber' && t.kind === 'guided') missiles++;
        if (t.kind !== 'mine' || t.parent !== 'stealthBomber') continue;
        // The ship it is laid ahead of: the nearest one behind it along the lane.
        const ahead = Math.min(...g.ships.map((s) => t.x - s.x).filter((d) => d > 0));
        sown.push({ x: t.x, y: t.y, ahead });
      }
    }
    expect(sown.length).toBeGreaterThan(0);
    expect(missiles).toBe(0);
    for (const m of sown) {
      // Off the up-current edge of the lane (SOW.line of its half-width),
      // SOW.near to SOW.far ahead of a ship.
      expect(Math.abs(m.y - (ch.y - SOW.line * ch.halfWidth)), JSON.stringify(m)).toBeLessThan(40);
      expect(m.ahead, JSON.stringify(m)).toBeGreaterThanOrEqual(SOW.near - 30);
      expect(m.ahead, JSON.stringify(m)).toBeLessThanOrEqual(SOW.far + 30);
    }
    // The campaign's stealth bombers drop their missiles as ever.
    const c = createGame('sowers', 5, 6);
    c.tempo = { ...c.tempo, lossLimit: 999 };
    c.carrierHp = 999;
    let campMines = 0;
    const cSeen = new Set<number>();
    for (let i = 0; i < 90 / DT && c.wave === 6; i++) {
      step(c, DT);
      for (const t of c.threats) if (!cSeen.has(t.id)) {
        cSeen.add(t.id);
        if (t.kind === 'mine' && t.parent === 'stealthBomber') campMines++;
      }
    }
    expect(campMines).toBe(0);
  });

  it('Dreadnought Pass (log v51): from wave 4 the wave\'s new enemies are spotter planes, whose shells come from the battleship\'s hull while it is on the map; the campaign and the shared wave keep the planner\'s own', () => {
    expect(MAP_SIGNATURE.dreadnought).toMatchObject({ from: 4, foe: 'spotter', foeShare: 1, guns: true });
    let spotters = 0;
    for (let w = 4; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('dreadnought', seed, w);
        applyEncounters(on, VER('v1'));
        const drawn = on.queue.filter((l) => l.at < 1e8 && isFoe(l.kind) && !l.enc);
        for (const l of drawn) expect(l.kind, `wave ${w}`).toBe('spotter');
        spotters += kinds(on, 'spotter').length;
      }
    expect(spotters).toBeGreaterThan(20);
    expect(signatureOf('dreadnought', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('dreadnought', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('dreadnought', 4, { rev: 4, only: [] })).toBeUndefined();
    // Wave 6: the battleship passes while the spotters call; their shells
    // fire from its hull (a flash there), not from over the horizon.
    const g = createGame('dreadnought', 3, 6);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    let hull = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 120 / DT && g.wave === 6; i++) {
      step(g, DT);
      const d = g.threats.find((t) => t.kind === 'dreadnought' && !t.dead && t.x > 0 && t.x < VIEW.width);
      for (const m of g.foe.marks) {
        if (m.kind !== 'shell' || seen.has(m.id)) continue;
        seen.add(m.id);
        if (m.far) continue;
        hull++;
        expect(d, 'the battleship is on the map').toBeDefined();
        expect(Math.abs(m.gy! - d!.y)).toBeLessThan(2);
      }
    }
    expect(hull).toBeGreaterThan(0);
    // The campaign's spotters call the guns over the horizon as ever.
    const c = createGame('dreadnought', 3, 6);
    c.tempo = { ...c.tempo, lossLimit: 999 };
    c.carrierHp = 999;
    for (let i = 0; i < 120 / DT && c.wave === 6; i++) {
      step(c, DT);
      for (const m of c.foe.marks) if (m.kind === 'shell') expect(m.far, 'campaign').toBe(true);
    }
  }, 60_000);

  it('Dreadnought Pass (log v51): each pass under the layer has its own numbers and moment, a glimpse on wave 1 turns back; the campaign and the shared wave pass as before', () => {
    const passOf = (w: number, layer: boolean | 'shared', seed = 2) => {
      const g = createGame('dreadnought', seed, w);
      if (layer) applyEncounters(g, layer === 'shared' ? { ...VER('v1'), only: [] } : VER('v1'));
      g.tempo = { ...g.tempo, lossLimit: 999 };
      g.carrierHp = 999;
      let first: { t: number; hp: number; speed: number } | undefined;
      let minX = Infinity;
      let lastX = 0;
      let broadside = 0;
      let aimed = 0;
      let guns = 0;
      let deck = 0;
      const seen = new Set<number>();
      for (let i = 0; i < 150 / DT && g.wave === w; i++) {
        step(g, DT);
        const d = g.threats.find((t) => t.kind === 'dreadnought');
        if (d) {
          first ??= { t: g.waveT, hp: d.hp, speed: d.speed };
          minX = Math.min(minX, d.x);
          lastX = d.x;
        }
        for (const t of g.threats) {
          if (seen.has(t.id)) continue;
          seen.add(t.id);
          if (t.parent === 'dreadnought') {
            broadside++;
            // The drones off its deck go for the carrier; its guns at a ship.
            if (t.kind === 'drone') {
              if (t.target === CARRIER_TARGET) deck++;
              continue;
            }
            guns++;
            const lead = g.ships.reduce((a, b) => (b.d > a.d ? b : a), g.ships[0]);
            if (t.target === lead?.id) aimed++;
          }
        }
      }
      return { first, minX, lastX, broadside, aimed, guns, deck };
    };
    // The campaign and the shared wave: the map's own pass, as the wave
    // starts, 50 hits, its broadsides untagged.
    for (const layer of [false, 'shared'] as const) {
      expect(dreadPasses('dreadnought', layer ? { ...VER('v1'), only: [] } : null)).toBeUndefined();
      const p = passOf(3, layer);
      expect(p.first, String(layer)).toMatchObject({ hp: MAPS.dreadnought.boss!.hp });
      expect(p.first!.t, String(layer)).toBeLessThan(0.1);
      expect(p.broadside, String(layer)).toBe(0);
      expect(passOf(1, layer).first, `${layer} wave 1`).toBeUndefined();
    }
    expect(dreadPasses('sowers', VER('v1'))).toBeUndefined();
    // Under the layer: each pass its own hits and speed; the broadsides are
    // its own (tagged), aimed at the lead ship where the pass says so.
    for (const w of [3, 6, 9]) {
      const P = DREAD_PASSES[w];
      const p = passOf(w, true);
      expect(p.first, `wave ${w}`).toMatchObject({ hp: P.hp, speed: P.speed });
      expect(p.guns, `wave ${w}`).toBeGreaterThan(0);
      expect(p.deck, `wave ${w}`).toBe(p.broadside - p.guns);
      expect(p.deck, `wave ${w}`).toBeGreaterThan(0);
      if (P.aim === 'lead') expect(p.aimed, `wave ${w}`).toBeGreaterThanOrEqual(p.guns * 0.8);
    }
    // Wave 10's pass comes after the wave's own fire (the climax).
    expect(passOf(10, true).first!.t).toBeGreaterThan(30);
    // Wave 1: a glimpse in the east, turning back the way it came.
    const g1 = passOf(1, true);
    expect(g1.first).toBeDefined();
    expect(g1.minX).toBeGreaterThanOrEqual(DREAD_PASSES[1].turn! - 5);
    expect(g1.lastX).toBeGreaterThan(VIEW.width);
    expect(g1.broadside).toBeGreaterThan(0);
  }, 60_000);

  it('a jet down the supertanker\'s lane strafes the tanker, and the Shield does not stop it', () => {
    const g = createGame('behemoth', 5, 4);
    applyEncounters(g, VER('v1'));
    // Sail until the tanker is well along its lane (a jet strafes only once
    // it is in from the edge), then send one jet down its lane.
    for (let i = 0; i < 60 * 30 && !g.ships.some((s) => s.vip); i++) step(g, 1 / 60);
    const tanker = g.ships.find((s) => s.vip)!;
    expect(tanker).toBeDefined();
    for (let i = 0; i < 60 * 40 && tanker.x < 400; i++) step(g, 1 / 60);
    expect(tanker.x).toBeGreaterThanOrEqual(400);
    expect(g.phase).toBe('wave');
    g.queue = [{ at: g.waveT + PLANE.warn, kind: 'strafer', base: -1, side: 1, aim: 'vip' }];
    // The Shield weapon up (chapter 2's boost): it blocks missiles, drones
    // and boats, never a jet's guns.
    g.boost = { id: 'shield', level: 1, t: 99, n: 0, bank: 0, crateT: 0, age: 0 };
    const hp = tanker.hp;
    for (let i = 0; i < 60 * 12 && tanker.hp === hp; i++) step(g, 1 / 60);
    expect(tanker.hp).toBeLessThan(hp);
  });
});

describe('the same thing every time', () => {
  it('a run with encounters is the same game on the same seed, carries the layer in its log, and replays with telemetry on or off', () => {
    for (const map of LAYER_MAPS)
      for (const v of versionsOf(map)) {
        const setup = VER(v);
        const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: setup };
        const a = playMimic(map, 77, opts);
        const b = playMimic(map, 77, opts);
        expect(b.log.commands, `${map} ${v}`).toEqual(a.log.commands);
        expect(a.log.encounters).toEqual(setup);
        expect(a.log.v).toBe(LOG_VERSION);
        const ls = lockstep(a.log, 600);
        expect(ls.divergedAt, `${map} ${v}`).toBe(-1);
        expect(ls.rngSame, `${map} ${v}`).toBe(true);
        expect(stateHash(replay(a.log)), `${map} ${v}`).toBe(ls.stateHash);
        expect(reconcile(ls.sidecar, ls.game), `${map} ${v}`).toEqual([]);
        expect(ls.sidecar.header.encounters).toBe(ENCOUNTER_REV);
        // The encounters played are the version's own, on this map.
        const played = ls.sidecar.events.filter((e) => e.k === 'env' && e.what === 'encounter').map((e) => (e as { st: string }).st);
        expect(played.length, `${map} ${v}`).toBeGreaterThan(1);
        for (const id of played) expect(ENCOUNTERS.find((e) => e.id === id)!).toMatchObject({ map, version: v });
      }
  }, 240_000);

  it('a log from before the versions (rev 1, no version) plays v1', () => {
    const a = playMimic('harbor', 31, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: { rev: 1 } });
    // (v1 at rev 3: rev 4 rebuilt Harbor Mouth's v1, so a rev 1 log is
    // matched by the last rev that kept its plan.)
    const b = playMimic('harbor', 31, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 4, encounters: { rev: 3, version: 'v1' } });
    expect(a.game.enc!.played).toEqual(b.game.enc!.played);
    expect(a.log.commands).toEqual(b.log.commands);
    // Rev 1's plan, as it was (rev 4 replaced it with Harbor Mouth's ten).
    expect(a.game.enc!.played[0]).toBe('harbor-funnel-salvo');
  }, 60_000);

  it('an encounter is not rolled: its launches leave at the same moments on every seed', () => {
    const at = (seed: number) => launches(wave('gauntlet', 6, true, seed).sc).filter((l) => l.enc).map((l) => [l.kind, l.base, Math.round(l.t * 10)]);
    expect(at(2)).toEqual(at(11));
    const at2 = (seed: number) => launches(wave('harbor', 7, true, seed, 90, 'v2').sc).filter((l) => l.enc).map((l) => [l.kind, Math.round(l.t * 10)]);
    expect(at2(2)).toEqual(at2(11));
  });
});

// Kept for the type: every version is a map's.
void MAP_VERSIONS;

describe('busier early waves (log v47): easy filler on top of waves 1-6', () => {
  it('every filler beat belongs to a rebuilt map\'s v1 encounter of waves 1-6, and is a spaced string of drones out of a drone silo', () => {
    const ids = Object.keys(BUSY);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const e = ENCOUNTERS.find((x) => x.id === id);
      expect(e, id).toBeDefined();
      expect(e!.version, id).toBe('v1');
      expect(playsAt(e!), `${id} plays now`).toBe(true);
      expect(Math.max(...e!.waves), id).toBeLessThanOrEqual(6);
      for (const b of BUSY[id]) {
        expect(e!.beats, id).toContain(b);
        expect(b.filler && b.kind === 'drone' && 'base' in b.from, id).toBe(true);
        expect(b.count, id).toBeLessThanOrEqual(4);
        expect(b.gap ?? 0, id).toBeGreaterThanOrEqual(0.8);
        const base = MAPS[e!.map].bases[(b.from as { base: number }).base];
        expect(base.kinds ?? ['drone'], `${id}: a drone silo`).toContain('drone');
      }
    }
    // Every rebuilt map has it: on wave 1, and on at least two of waves 1-3;
    // the Battery (its waves 3-4 rated well, its wave 1 the busiest of any
    // map) on wave 2 only.
    const maps = new Set(ENCOUNTERS.filter((e) => BUSY[e.id]).map((e) => e.map));
    expect([...maps].sort()).toEqual(['archipelago', 'battery', 'behemoth', 'coves', 'delta', 'dreadnought', 'gauntlet', 'harbor', 'island', 'kesh', 'lantern', 'marrow', 'needle', 'rigs', 'saltgate', 'sowers', 'strait', 'crossing', 'tide', 'citadel'].sort());
    const busyOn = (map: Encounter['map'], w: number) => encountersFor(map, w).some((e) => e.beats.some((b) => b.filler));
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('battery', w))).toEqual([2]);
    // Sowers' Reach (log v48): every one of waves 1-6.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('sowers', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // The Rig Field (log v49): out of its two drone rigs; since log v55
    // (round 15: the player rated waves 1-3 at 1, 2 and 1) waves 1-6, wave
    // 1 two strings off the east rig.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('rigs', w))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(BUSY['rigs-point-blank'].length).toBe(2);
    // Dreadnought Pass (log v51): the same, out of its one drone silo.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('dreadnought', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // The Black Strait (log v52): every one of waves 1-6, out of the far
    // shore's drone silos under the beam.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('lantern', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // The Coves (log v53): waves 1-6, out of its one drone silo (the far north-west).
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('coves', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // The Delta (log v68): waves 1-6 out of the west islet's silo, one of
    // its two drone silos, in the carrier's bay; wave 1 one late string.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('delta', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // Tidewater Flats (log v61): waves 1-6, out of the west and east silos.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('tide', w))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(BUSY['delta-long-river'].length).toBe(1);
    for (const id of Object.keys(BUSY).filter((k) => k.startsWith('delta-'))) for (const b of BUSY[id]) expect(b.from, id).toEqual({ base: 6 });
    // Dunmar Crossing (log v58): waves 1-6, out of the north-west and north-east silos.
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('crossing', w))).toEqual([1, 2, 3, 4, 5, 6]);
    // The Citadel (log v60): waves 1-6, out of its one drone silo (the far north-west).
    expect([1, 2, 3, 4, 5, 6].filter((w) => busyOn('citadel', w))).toEqual([1, 2, 3, 4, 5, 6]);
    for (const id of Object.keys(BUSY).filter((k) => k.startsWith('citadel-'))) for (const b of BUSY[id]) expect(b.from, id).toEqual({ base: 4 });
    for (const map of [...maps].filter((m) => m !== 'battery')) {
      expect(busyOn(map, 1), `${map} wave 1`).toBe(true);
      expect([1, 2, 3].filter((w) => busyOn(map, w)).length, map).toBeGreaterThanOrEqual(2);
    }
    // Nothing past wave 6, and no other version or map gets any.
    for (const e of ENCOUNTERS) if (e.beats.some((b) => b.filler)) expect(BUSY[e.id], e.id).toBeDefined();
  });

  it('a filler drone is a plain drone, tagged in the telemetry as filler', () => {
    const { sc } = wave('strait', 1, true, 9, 60, 'v1', ENCOUNTER_REV);
    const fill = sc.events.filter((e): e is Extract<TelEvent, { k: 'thr+' }> => e.k === 'thr+' && !!e.fill);
    expect(fill.length).toBe(BUSY['strait-ranging-opener'].reduce((a, b) => a + b.count, 0));
    for (const e of fill) expect(e.kind === 'drone' && e.enc === 'strait-ranging-opener').toBe(true);
  });
});

// Chapter 4, Open War: the Coves (docs/design/v3-ch4-coves.md, log v53).
describe('the Coves (log v53): fire ships, the signature and the Fire Fleet', () => {
  const kinds = (g: Game, kind: string) => g.queue.filter((l) => l.at < 1e8 && l.kind === kind);

  it('from wave 4 so many of the wave\'s own fast boats come as fire ships; the campaign and the shared wave keep plain boats', () => {
    expect(MAP_SIGNATURE.coves).toMatchObject({ from: 4 });
    const want = MAP_SIGNATURE.coves!.fireShips!;
    expect(want.length).toBe(7);
    let fires = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('coves', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('coves', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('coves', seed, w);
        const own = kinds(on, 'fastboat').filter((l) => !l.enc && l.fire);
        if (w < 4) expect(own, `wave ${w}`).toEqual([]);
        else expect(own.length, `wave ${w}`).toBeLessThanOrEqual(want[w - 4]);
        fires += own.length;
        // The wave sends as many boats with or without it (one for one).
        for (const l of kinds(on, 'fastboat').filter((x) => x.fire)) expect(MAPS.coves.bases[l.base].cove, `wave ${w}`).toBe(true);
        expect([...kinds(camp, 'fastboat'), ...kinds(shared, 'fastboat')].filter((l) => l.fire)).toEqual([]);
      }
    expect(fires).toBeGreaterThanOrEqual(18);
    expect(signatureOf('coves', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('coves', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('coves', 4, { rev: 4, only: [] })).toBeUndefined();
  });

  it('a fire ship takes FIRESHIP.hp hits; sunk, it burns where it went down; the Nuke puts it out; ramming, it does FIRESHIP.ram and burns on the lane', () => {
    const g = createGame('coves', 5, 4);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    const fires = () => g.foe.marks.filter((m) => m.kind === 'fire');
    const boat = spawnThreat(g, 'fastboat', 911, 200, 'base');
    lightFireShip(boat);
    expect(boat.fire).toBe(true);
    expect(boat.hp).toBe(FIRESHIP.hp);
    expect(boat.maxHp).toBe(FIRESHIP.hp);
    damageThreat(g, boat, FIRESHIP.hp - 1);
    expect(boat.dead).toBe(false);
    damageThreat(g, boat, 1);
    expect(boat.dead).toBe(true);
    expect(fires().map((m) => [Math.round(m.x), Math.round(m.y), m.dur])).toEqual([[911, 200, FIRESHIP.burn]]);
    // The Nuke (no drops): no fire.
    const nuked = spawnThreat(g, 'fastboat', 381, 200, 'base');
    lightFireShip(nuked);
    damageThreat(g, nuked, 99, false, 'nuke');
    expect(fires().length).toBe(1);
    // A plain boat sunk: no fire.
    const plain = spawnThreat(g, 'fastboat', 1401, 200, 'base');
    damageThreat(g, plain, 99);
    expect(fires().length).toBe(1);
    // Ramming: on at a ship, its hull takes FIRESHIP.ram, and the fire burns there.
    for (let i = 0; i < 20 / DT && !g.ships.length; i++) step(g, DT);
    const s = g.ships[0];
    const ram = spawnThreat(g, 'fastboat', s.x, s.y - 60, 'base');
    lightFireShip(ram);
    ram.target = s.id;
    const hp = s.hp;
    for (let i = 0; i < 3 / DT && !ram.dead; i++) step(g, DT);
    expect(ram.dead).toBe(true);
    expect(hp - s.hp).toBeGreaterThanOrEqual(FIRESHIP.ram);
    expect(fires().length).toBe(2);
  });

  it('the Fire Fleet: sorties of fire ships out of more coves each round, the Repair Yard\'s mothership and repair ships gone; a rev 3 log and the campaign play the Repair Yard', () => {
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
    const off = playMimic('coves', 219, opts);
    const old = playMimic('coves', 219, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('repair-yard');
      expect(e.sent.mothership).toBe(1);
      expect(e.sent.tender).toBe(3);
    }
    const on = playMimic('coves', 219, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.coves!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['repair-yard', 1], ['repair-yard', 2], ['repair-yard', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    for (const e of done) {
      expect(e.sent.mothership ?? 0).toBe(0);
      expect(e.sent.tender ?? 0).toBe(0);
      const R = rounds[e.run! - 1];
      const packs = (R.fire ?? []).filter((f) => f.kind === 'fastboat').reduce((a, f) => a + (f.count ?? 1), 0);
      expect(e.sent.fastboat, `round ${e.run}`).toBe(R.fleet!.coves.length * R.fleet!.sorties + packs);
    }
    // Rising: more coves each round, more fire ships; every cove a cove.
    for (let k = 1; k < rounds.length; k++) {
      expect(rounds[k].fleet!.coves.length, `round ${k + 1}`).toBeGreaterThan(rounds[k - 1].fleet!.coves.length);
      expect(rounds[k].fleet!.coves.length * rounds[k].fleet!.sorties).toBeGreaterThan(rounds[k - 1].fleet!.coves.length * rounds[k - 1].fleet!.sorties);
    }
    for (const r of rounds) {
      for (const i of r.fleet!.coves) expect(MAPS.coves.bases[i].cove).toBe(true);
      expect(r.fleet!.warn, 'each sortie lit first').toBeGreaterThanOrEqual(1);
    }
    roundLengths(done);
    expect(eventName('repair-yard', 'coves', ENCOUNTER_REV)).toBe('Fire Fleet');
    expect(eventName('repair-yard', 'coves', 3)).toBe('Repair Yard');
    expect(eventName('repair-yard', 'coves')).toBe('Repair Yard');
  }, 90_000);

  it('chapter 4\'s four new enemies debut here, waves 2-5, each "New on Open War"; the encounters bring none of them and nothing later', () => {
    const lead = ['tender', 'bodyguard', 'lure', 'cloud'] as const;
    lead.forEach((id) => {
      expect(FOES[id].chapter).toBe(4);
      expect(mapDebutsFoe('coves', FOES[id].kind), id).toBe(true);
      expect(foeDebutTag(FOES[id].kind), id).toBe('New on Open War');
    });
    for (const e of ENCOUNTERS.filter((x) => x.map === 'coves')) for (const b of e.beats) expect(isFoe(b.kind), e.id).toBe(false);
  });
});

// Chapter 4, Open War: Dunmar Crossing (docs/design/v3-ch4-crossing.md, log v58).
describe('Dunmar Crossing (log v58): spotter beacons at the crossing, the signature and the Beacon Line', () => {
  const kinds = (g: Game, kind: string) => g.queue.filter((l) => l.at < 1e8 && l.kind === kind);

  it('from wave 4 half the wave\'s new enemies are spotter beacons, each taking its shells out of the wave; the campaign and the shared wave keep plain beacons', () => {
    expect(MAP_SIGNATURE.crossing).toMatchObject({ from: 4, foe: 'lure', foeShare: 0.5, beacons: SPOTTER });
    let spotters = 0;
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = createGame('crossing', seed, w);
        applyEncounters(on, VER('v1'));
        const shared = createGame('crossing', seed, w);
        applyEncounters(shared, { ...VER('v1'), only: [] });
        const camp = createGame('crossing', seed, w);
        const own = kinds(on, 'lure').filter((l) => !l.enc && l.beacon);
        if (w < 4) expect(own, `wave ${w}`).toEqual([]);
        spotters += own.length;
        expect([...kinds(camp, 'lure'), ...kinds(shared, 'lure')].filter((l) => l.beacon)).toEqual([]);
        // Its shells come out of the wave's own: no more shells, guided
        // missiles and drones with the signature than the shared wave's.
        const enc = encountersFor('crossing', w);
        const taken = enc.reduce((a, e) => a + (e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0), 0);
        const calls = own.length * SPOTTER.calls;
        const fire = (g: Game) => kinds(g, 'ballistic').length + kinds(g, 'guided').length;
        if (!taken) expect(fire(on) + calls, `wave ${w} seed ${seed}`).toBeLessThanOrEqual(fire(shared) + 1);
      }
    expect(spotters).toBeGreaterThanOrEqual(12);
    expect(signatureOf('crossing', 3, { rev: 4 })).toBeUndefined();
    expect(signatureOf('crossing', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('crossing', 4, { rev: 4, only: [] })).toBeUndefined();
  });

  it('the encounters\' spotters rise in waves 4 and 7-10, never before the signature\'s first wave; every wave aims at a lane or the crossing', () => {
    const spotted = arc('crossing').filter((a) => a.encounters.some((e) => e.beats.some((b) => b.kind === 'lure'))).map((a) => a.wave);
    expect(spotted).toEqual([4, 7, 8, 9, 10]);
    for (const e of ENCOUNTERS.filter((x) => x.map === 'crossing'))
      for (const b of e.beats.filter((x) => x.kind === 'lure')) {
        expect('water' in b.from && b.from.water, e.id).toBe('cross');
        expect(b.beacon, e.id).toEqual(SPOTTER);
        // Its shells come out of the wave's own (the books).
        expect((e.replaces.ballistic ?? 0) + (e.replaces.guided ?? 0), e.id).toBeGreaterThanOrEqual(SPOTTER.calls);
      }
    for (const a of arc('crossing')) expect(a.encounters.some((e) => e.beats.some((b) => b.lane !== undefined || b.aim === 'cross' || b.kind === 'lure')), `wave ${a.wave}`).toBe(true);
    // Only the Crossing's encounters rise from the water or aim at the crossing.
    for (const e of ENCOUNTERS.filter((x) => x.map !== 'crossing')) for (const b of e.beats) expect('water' in b.from || b.aim === 'cross' || b.lane !== undefined, e.id).toBe(false);
  });

  it('a spotter beacon rises between the lanes at the crossing, takes SPOTTER.hp hits, marks the ship nearest it and calls SPOTTER.calls shells, then sinks back', () => {
    const g = createGame('crossing', 5, 4);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    for (let i = 0; i < 40 / DT; i++) step(g, DT);
    const c = crossingPair(g);
    expect(c).toBeDefined();
    expect(c!.a.channel).toBe(0);
    expect(c!.b.channel).toBe(1);
    g.queue.push({ at: g.waveT, kind: 'lure', base: -1, beacon: SPOTTER });
    g.queue.sort((x, y) => x.at - y.at);
    step(g, DT);
    const b = g.threats.find((t) => t.kind === 'lure' && !t.dead)!;
    expect(b).toBeDefined();
    expect(b.hp).toBe(SPOTTER.hp);
    // Between the lanes: below the north lane's water and above the south's.
    const [n, s] = g.map.channels;
    expect(b.y).toBeGreaterThan(n.y + n.halfWidth);
    expect(b.y).toBeLessThan(s.y - s.halfWidth);
    expect(Math.hypot(b.x - g.map.carrier.x, b.y - g.map.carrier.y)).toBeGreaterThanOrEqual(60);
    let marked = false;
    const called = new Set<number>();
    for (let i = 0; i < 20 / DT && !b.dead; i++) {
      step(g, DT);
      if (beaconMark(g, b)) marked = true;
      for (const t of g.threats) if (t.called) called.add(t.id);
    }
    expect(marked).toBe(true);
    expect(called.size).toBe(SPOTTER.calls);
    expect(b.dead).toBe(true);
    // Shot down early, it calls no more.
    g.queue.push({ at: g.waveT, kind: 'lure', base: -1, beacon: SPOTTER });
    g.queue.sort((x, y) => x.at - y.at);
    step(g, DT);
    const b2 = g.threats.find((t) => t.kind === 'lure' && !t.dead)!;
    for (let i = 0; i < 2 / DT; i++) step(g, DT);
    // Only the player's own weapons sink it (a tap), not a helper.
    damageThreat(g, b2, SPOTTER.hp);
    expect(b2.dead).toBe(false);
    g.foe.byTap = true;
    damageThreat(g, b2, SPOTTER.hp - 1);
    expect(b2.dead).toBe(false);
    damageThreat(g, b2, 1);
    g.foe.byTap = false;
    expect(b2.dead).toBe(true);
    const before = g.queue.filter((l) => l.called).length;
    for (let i = 0; i < 8 / DT; i++) step(g, DT);
    expect(g.queue.filter((l) => l.called).length).toBe(before);
  });

  it('the Beacon Line: lines of spotter beacons calling together, longer each round; a rev 3 log and the campaign play Beacon Strike', () => {
    // (A sturdier Armory than the Coves' test: the line's volleys end a
    // weak run in round 1.)
    const opts = { persona: PERSONAS.tryhard, armory: { reload: 5, repair: 4, stockpile: 5, plating: 5 }, firstWave: 11 };
    const off = playMimic('crossing', 219, opts);
    const old = playMimic('crossing', 219, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('beacon-strike');
      expect(e.sent.lure).toBe(4);
    }
    const on = playMimic('crossing', 219, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.crossing!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['beacon-strike', 1], ['beacon-strike', 2], ['beacon-strike', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    for (const e of done) {
      const R = rounds[e.run! - 1];
      expect(e.sent.lure, `round ${e.run}`).toBe(R.line!.beacons * R.line!.at.length);
      expect(e.sent.ballistic ?? 0, `round ${e.run}`).toBeGreaterThan(0);
    }
    // Rising: more beacons each round.
    const n = (r: (typeof rounds)[number]) => r.line!.beacons * r.line!.at.length;
    for (let k = 1; k < rounds.length; k++) expect(n(rounds[k]), `round ${k + 1}`).toBeGreaterThan(n(rounds[k - 1]));
    for (const r of rounds) expect(r.line!.call.charge, 'each ship marked first').toBeGreaterThanOrEqual(1.5);
    roundLengths(done);
    expect(eventName('beacon-strike', 'crossing', ENCOUNTER_REV)).toBe('Beacon Line');
    expect(eventName('beacon-strike', 'crossing', 3)).toBe('Beacon Strike');
    expect(eventName('beacon-strike', 'crossing')).toBe('Beacon Strike');
  }, 90_000);

  it('chapter 4\'s new enemies are regulars here (they debut on the Coves); the encounters bring only the signature\'s spotter beacons', () => {
    for (const id of ['tender', 'bodyguard', 'lure', 'cloud'] as const) expect(mapDebutsFoe('crossing', FOES[id].kind), id).toBe(false);
    for (const e of ENCOUNTERS.filter((x) => x.map === 'crossing')) for (const b of e.beats) expect(!isFoe(b.kind) || b.kind === 'lure', e.id).toBe(true);
  });
});

// Chapter 4, Open War: Tidewater Flats (docs/design/v3-ch4-tide.md, log v61).
describe('Tidewater Flats (log v61): the tide\'s clock a wave, the crowd, the ebb strike and Low Water', () => {
  // The player: "the ships did not navigate off the low tide area, so just
  // make sure that mechanic actually works". Every step of whole bot runs
  // (the card's production setup, the boss rounds too, and the campaign's
  // own clock): no hull is ever on exposed sand (sim/tide.ts sandEdge: the
  // water leaves the flats from the shore side as the tide falls), none is
  // in the flats at all at low water, a ship on the flats when the tide
  // starts to fall has crossed to the deep channel before the sand reaches
  // it, and no hull stalls on its lane.
  const sweepTide = (seed: number, layer: boolean, waves: number) => {
    const run = new BotRun('tide', seed, { persona: PERSONAS.you, armory: { reload: 5, repair: 4, stockpile: 5 }, ...(layer ? { encounters: VER('v1'), convoy: { policy: 'tactical' as const, obligation: 'natural' as const, rev: CONVOY_REV } } : {}) });
    const g = run.game;
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
    const flats = MAPS.tide.channels.find((c) => c.tide)!;
    const band = flatsBand(flats);
    const seen = { low: 0, falling: 0, rising: 0, crossed: new Set<number>(), onSand: [] as string[], inFlatsLow: [] as string[], stalled: [] as string[] };
    const still = new Map<number, { d: number; n: number }>();
    while (!run.done && g.wave <= waves) {
      run.advance(1);
      if (g.phase !== 'wave') {
        still.clear();
        continue;
      }
      const tide = tideNow(g);
      if (tide.phase !== 'high') seen[tide.phase] += 1;
      const edge = sandEdge(flats, tide.level);
      for (const sh of g.ships) {
        if (sh.cross) seen.crossed.add(sh.id);
        // A hull's whole width (SHIP.hitRadius) clear of the sand.
        if (sh.y + SHIP.hitRadius > edge && sh.y - SHIP.hitRadius < band.bottom && sh.x > 0 && sh.x < VIEW.width) seen.onSand.push(`w${g.wave} t${g.waveT.toFixed(2)} ship ${sh.id} y ${sh.y.toFixed(0)} sand from ${edge.toFixed(0)}`);
        if (tide.phase === 'low' && sh.y > band.top && sh.y < band.bottom) seen.inFlatsLow.push(`w${g.wave} t${g.waveT.toFixed(2)} ship ${sh.id}`);
        const was = still.get(sh.id);
        if (!was || sh.d > was.d + 1e-6) still.set(sh.id, { d: sh.d, n: 0 });
        else if (++was.n === 5 * 60) seen.stalled.push(`w${g.wave} t${g.waveT.toFixed(2)} ship ${sh.id} at d ${sh.d.toFixed(0)}`);
      }
    }
    return seen;
  };

  it('no ship is ever on exposed sand, none is in the flats at low water, the flats ships cross to the deep channel as the tide falls, and none stalls (the card, waves 1-10 and the boss, three seeds)', () => {
    for (const seed of [3, 11, 29]) {
      const r = sweepTide(seed, true, 13);
      expect(r.onSand.slice(0, 3), `seed ${seed}`).toEqual([]);
      expect(r.inFlatsLow.slice(0, 3), `seed ${seed}`).toEqual([]);
      expect(r.stalled.slice(0, 3), `seed ${seed}`).toEqual([]);
      // The tide turned every wave, and ships were caught on the flats by it.
      expect(r.low, `seed ${seed}`).toBeGreaterThan(60 * 60);
      expect(r.falling, `seed ${seed}`).toBeGreaterThan(60 * 20);
      expect(r.rising, `seed ${seed}`).toBeGreaterThan(60 * 10);
      expect(r.crossed.size, `seed ${seed}`).toBeGreaterThan(5);
    }
  }, 240_000);

  it('the same on the campaign\'s own clock (no layer), waves 1-6', () => {
    for (const seed of [5, 17]) {
      const r = sweepTide(seed, false, 6);
      expect(r.onSand.slice(0, 3), `seed ${seed}`).toEqual([]);
      expect(r.inFlatsLow.slice(0, 3), `seed ${seed}`).toEqual([]);
      expect(r.stalled.slice(0, 3), `seed ${seed}`).toEqual([]);
      expect(r.low, `seed ${seed}`).toBeGreaterThan(0);
      expect(r.crossed.size, `seed ${seed}`).toBeGreaterThan(0);
    }
  }, 240_000);

  it('the tide turns smoothly: the water falls over TIDE_TURN.fall s and rises over TIDE_TURN.rise s, never snapping', () => {
    const ebb: [number, number] = [20, 32];
    let prev = tideAt(MAPS.tide, 0, 0, ebb).level;
    for (let t = 0; t < 45; t += 1 / 60) {
      const now = tideAt(MAPS.tide, 0, t, ebb);
      expect(Math.abs(now.level - prev), `t ${t.toFixed(2)}`).toBeLessThanOrEqual(1 / (60 * Math.min(TIDE_TURN.fall, TIDE_TURN.rise)) + 1e-9);
      prev = now.level;
    }
    expect(tideAt(MAPS.tide, 0, 20 - TIDE_TURN.fall - 0.01, ebb).phase).toBe('high');
    expect(tideAt(MAPS.tide, 0, 18, ebb).phase).toBe('falling');
    expect(tideAt(MAPS.tide, 0, 25, ebb)).toMatchObject({ phase: 'low', level: 0 });
    expect(tideAt(MAPS.tide, 0, 33, ebb).phase).toBe('rising');
    expect(tideAt(MAPS.tide, 0, 40, ebb)).toMatchObject({ phase: 'high', level: 1 });
    // The campaign's clock too.
    let p2 = tideAt(MAPS.tide, 0, 0).level;
    for (let t = 0; t < 90; t += 1 / 60) {
      const now = tideAt(MAPS.tide, t, 0);
      expect(Math.abs(now.level - p2), `t ${t.toFixed(2)}`).toBeLessThanOrEqual(1 / (60 * Math.min(TIDE_TURN.fall, TIDE_TURN.rise)) + 1e-9);
      p2 = now.level;
    }
  });

  const crowdAimed = (g: Game) => g.queue.filter((l) => l.at < 1e8 && l.aim === 'crowd');

  it('under the layer each wave opens on high water and the tide goes out once, at its ebb, for its low water; the campaign, a rev 3 log and the shared wave keep the map\'s clock', () => {
    expect(MAP_TIDE.tide).toEqual({ ebb: TIDE_EBB, low: TIDE_LOW });
    expect(TIDE_EBB.length).toBe(10);
    expect(TIDE_LOW.length).toBe(10);
    for (let w = 1; w <= 10; w++) {
      const g = createGame('tide', 3, w);
      applyEncounters(g, VER('v1'));
      const spec = waveSpec(w, MAPS.tide.threatScale);
      const at = 3 + RAID.warn + TIDE_EBB[w - 1] * spec.duration;
      expect(g.ebb![0], `wave ${w}`).toBeCloseTo(at, 5);
      expect(g.ebb![1] - g.ebb![0], `wave ${w}`).toBeCloseTo(TIDE_LOW[w - 1], 6);
      // Every launch aimed at the crowd leaves at low water.
      for (const l of crowdAimed(g)) {
        expect(l.at, `wave ${w}`).toBeGreaterThanOrEqual(g.ebb![0]);
        expect(l.at, `wave ${w}`).toBeLessThan(g.ebb![1]);
      }
      for (const setup of [null, { rev: 3, version: 'v1' as const }, { ...VER('v1'), only: [] }]) {
        const c = createGame('tide', 3, w);
        if (setup) applyEncounters(c, setup);
        expect(c.ebb, `wave ${w}`).toBeUndefined();
      }
    }
    expect(tideClock('tide', 11, VER('v1'))).toBeUndefined();
    expect(tideClock('coves', 4, VER('v1'))).toBeUndefined();
  });

  it('at low water no new ship takes the flats lane, and the flats ships still out sail on; at high water both lanes take ships', () => {
    const g = createGame('tide', 7, 4);
    applyEncounters(g, VER('v1'));
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
    g.queue = [{ at: 9999, kind: 'drone', base: 0 }];
    g.raiderQueue = [];
    const flats = MAPS.tide.channels.findIndex((c) => c.tide);
    const seen = new Set<number>();
    const born: { id: number; lane: number; high: boolean }[] = [];
    for (let i = 0; i < 60 / DT; i++) {
      step(g, DT);
      for (const s of g.ships)
        if (!seen.has(s.id)) {
          seen.add(s.id);
          born.push({ id: s.id, lane: s.channel, high: highTide(g) });
        }
      if (g.phase !== 'wave') break;
    }
    const low = born.filter((b) => !b.high);
    expect(low.length).toBeGreaterThan(0);
    for (const b of low) expect(b.lane).not.toBe(flats);
    expect(born.some((b) => b.high && b.lane === flats)).toBe(true);
  });

  it('\'crowd\' goes for a ship among the most bunched hulls; \'flats\' for a ship on the flats lane, a long flight', () => {
    const g = createGame('tide', 5, 3);
    applyEncounters(g, VER('v1'));
    g.queue = [];
    for (let i = 0; i < 40 / DT && g.ships.length < 6; i++) step(g, DT);
    const th = spawnThreat(g, 'drone', MAPS.tide.bases[0].x, MAPS.tide.bases[0].y, 'base');
    aimBeat(g, th, 'crowd');
    const t = g.ships.find((s) => s.id === th.target)!;
    const around = (x: { x: number; y: number }) => g.ships.filter((o) => Math.hypot(o.x - x.x, o.y - x.y) <= 170).length;
    const best = Math.max(...g.ships.map(around));
    // In the densest group: within reach of its core.
    expect(around(t)).toBeGreaterThanOrEqual(Math.min(2, best));
    const onFlats = g.ships.filter((s) => MAPS.tide.channels[s.channel].tide);
    if (onFlats.length) {
      const f = spawnThreat(g, 'drone', MAPS.tide.bases[0].x, MAPS.tide.bases[0].y, 'base');
      aimBeat(g, f, 'flats');
      expect(MAPS.tide.channels[g.ships.find((s) => s.id === f.target)!.channel].tide).toBe(true);
    }
  });

  it('the ebb strike: from wave 5 the wave\'s own clusters (then shells) come as cluster missiles off the middle silo at the crowd, one for one; none on the shared wave or the campaign', () => {
    const sig = MAP_SIGNATURE.tide!;
    expect(sig).toMatchObject({ from: 4, ebbBase: 1 });
    expect(sig.ebb!.length).toBe(7);
    expect(MAPS.tide.bases[1].kinds).toContain('cluster');
    for (let w = 4; w <= 10; w++) {
      const g = createGame('tide', 2, w);
      applyEncounters(g, VER('v1'));
      const own = crowdAimed(g).filter((l) => !l.enc);
      expect(own.length, `wave ${w}`).toBe(sig.ebb![w - 4]);
      for (const l of own) expect([l.kind, l.base], `wave ${w}`).toEqual(['cluster', 1]);
      const shared = createGame('tide', 2, w);
      applyEncounters(shared, { ...VER('v1'), only: [] });
      expect(crowdAimed(shared), `wave ${w}`).toEqual([]);
      expect(crowdAimed(createGame('tide', 2, w)), `wave ${w}`).toEqual([]);
    }
    expect(signatureOf('tide', 3, VER('v1'))).toBeUndefined();
  });

  it('the Repair Ship and the Bodyguard Ring come as Lure Beacons on the Tide\'s waves (no heavy at the crowd), under the layer only', () => {
    expect(MAP_FOE_SWAP.tide).toEqual({ tender: 'lure', bodyguard: 'lure' });
    expect(swapFoe('tide', 3, 'tender', VER('v1'))).toBe('lure');
    expect(swapFoe('tide', 6, 'bodyguard', VER('v1'))).toBe('lure');
    expect(swapFoe('tide', 3, 'tender', { rev: 3 })).toBe('tender');
    expect(swapFoe('tide', 3, 'tender', null)).toBe('tender');
    expect(swapFoe('tide', 3, 'tender', { ...VER('v1'), only: [] })).toBe('tender');
  });

  it('Low Water: the round\'s own tide out early, strikes at the crowd from the lit silos, more each round; the Firestorm\'s firebombs gone; a rev 3 log and the campaign play the Firestorm', () => {
    const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
    const off = playMimic('tide', 219, opts);
    const old = playMimic('tide', 219, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('firestorm');
      expect(e.sent.cloud).toBeGreaterThan(0);
    }
    const on = playMimic('tide', 219, { ...opts, encounters: VER('v1') });
    const rounds = MAP_BOSS.tide!.rounds!;
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['firestorm', 1], ['firestorm', 2], ['firestorm', 3]]);
    const done = on.game.eventLog.filter((e) => e.outcome !== 'broken' || e.run! < 3);
    expect(done.length).toBeGreaterThanOrEqual(2);
    const total = (R: BossRound) => (R.strikes ?? []).reduce((a, k) => a + k.from.reduce((b, f) => b + f.count, 0), 0);
    for (const e of done) {
      const R = rounds[e.run! - 1];
      expect(e.sent.cloud ?? 0, `round ${e.run}`).toBe(0);
      expect(Object.values(e.sent).reduce((a, b) => a + (b ?? 0), 0), `round ${e.run}`).toBe(total(R));
    }
    for (let k = 1; k < rounds.length; k++) {
      expect(total(rounds[k]), `round ${k + 1}`).toBeGreaterThan(total(rounds[k - 1]));
      expect(rounds[k].ebb!.low, `round ${k + 1}`).toBeGreaterThan(rounds[k - 1].ebb!.low);
    }
    for (const r of rounds) {
      for (const k of r.strikes!) {
        expect(k.warn, 'each strike lit first').toBeGreaterThanOrEqual(RAID.warn);
        // Inside the round's low water.
        expect(k.at).toBeGreaterThan(r.ebb!.at);
        expect(k.at).toBeLessThan(r.ebb!.at + r.ebb!.low);
        for (const f of k.from) expect(MAPS.tide.bases[f.base].kinds, `${f.kind} from base ${f.base}`).toContain(f.kind);
      }
    }
    roundLengths(done);
    expect(eventName('firestorm', 'tide', ENCOUNTER_REV)).toBe('Low Water');
    expect(eventName('firestorm', 'tide', 3)).toBe('Firestorm');
  }, 90_000);
});
