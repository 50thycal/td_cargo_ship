// Test Lab round 12 (docs/design/v3-round12-encounter-versions.md): each
// reference map's encounter versions as Test Lab cards of their own, each
// opening on its production setup with its version, the version in the log
// and the scorecard grouped by it, and the version's script on pause.

import { describe, expect, it } from 'vitest';
import { ENCOUNTER_REV, arcGroups, encountersFor, pairBeatText, versionLabel } from '../../src/v3/data/encounters';
import { LAB_CARDS, LAB_CHANGES, LAB_ROUND, LAB_ROUNDS, cardRev, cardVersion, labCard, mapCardId } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { labResultDocs, labSetupText } from '../../src/v3/sim/labDocs';
import type { PlayLog } from '../../src/v3/sim/playlog';
import { BotRun, PERSONAS } from '../../src/v3/sim/mimic';
import { defaultSetup, isProduction, labRunPlan, parseLabProgress, productionSetup } from '../../src/v3/ui/lab';
import { OPEN_QUESTIONS, ROUND_DOCS } from '../../tools/v3/test-lab/lab.mjs';

const REF = ['strait', 'gauntlet', 'harbor'] as const;
const plan = (id: string, link?: string) => {
  const card = labCard(id)!;
  return labRunPlan(card, defaultSetup(card, parseLabProgress(null)), link ? new URLSearchParams(link) : null);
};

describe('Test Lab round 12', () => {
  it('the round: after round 11\'s builds, and its doc and questions', () => {
    expect(LAB_ROUND).toBe(12);
    const r = LAB_ROUNDS.at(-1)!;
    expect(r).toMatchObject({ n: 12, date: '2026-11-14', name: 'Encounter versions: set pieces and enemy pairs' });
    expect(r.since! > LAB_ROUNDS.at(-2)!.since!).toBe(true);
    expect(ROUND_DOCS[12].doc).toBe('docs/design/v3-round12-encounter-versions.md');
    const qs = OPEN_QUESTIONS.filter((q) => q.round === 12);
    expect(qs.length).toBeGreaterThanOrEqual(1);
    expect(qs.length).toBeLessThanOrEqual(2);
    for (const q of qs) {
      expect(q.options[0], q.id).toMatch(/\(recommended\)$/);
      expect(q.why?.length, q.id).toBeGreaterThan(10);
    }
  });

  it('a card for each version, next to its map\'s own card (v1), named for the player', () => {
    for (const map of REF) {
      const ids = LAB_CARDS.filter((c) => c.kind === 'map' && c.map === map).map((c) => c.id);
      expect(ids).toEqual([`map-${map}`, `map-${map}-v2`, `map-${map}-v3`]);
      expect(cardVersion(labCard(`map-${map}`)!)).toBe('v1');
      expect(labCard(`map-${map}-v2`)!.name).toBe(`${labCard(`map-${map}`)!.name} · v2 Set pieces`);
      expect(labCard(`map-${map}-v3`)!.name).toBe(`${labCard(`map-${map}`)!.name} · v3 Enemy pairs`);
      expect(mapCardId(map, 'v3')).toBe(`map-${map}-v3`);
      // Every card of the map is new or changed this round (play all three again).
      for (const id of ids) expect(cardRev(id), id).toBe(12);
      expect(LAB_CHANGES[`map-${map}-v2`]).toHaveLength(1);
    }
    // No other map has versions.
    for (const map of MAP_ORDER.filter((m) => !(REF as readonly string[]).includes(m))) expect(LAB_CARDS.filter((c) => c.kind === 'map' && c.map === map)).toHaveLength(1);
  });

  it('each version card opens on its production setup, nothing to set: the full map, policy D, its own encounter version', () => {
    for (const map of REF)
      for (const v of ['v1', 'v2', 'v3'] as const) {
        const id = mapCardId(map, v);
        const p = plan(id);
        expect(p.full, id).toBe(true);
        expect(p.convoy?.policy, id).toBe('tactical');
        expect(p.encounters, id).toEqual({ rev: ENCOUNTER_REV, version: v });
        expect(p.lab, id).toMatchObject({ card: id, plays: 'full', variant: v, config: { convoy: 'tactical', encounters: ENCOUNTER_REV, production: true } });
        const card = labCard(id)!;
        expect(isProduction(card, productionSetup(card)), id).toBe(true);
        // Another version's encounters on this card is not its production setup.
        expect(isProduction(card, { ...productionSetup(card), variant: v === 'v1' ? 'v2' : 'v1' }), id).toBe(false);
      }
    // A link can turn the call-outs on or off for a comparison.
    expect(plan('map-strait', 'lab=map-strait&callouts=1').encounters).toEqual({ rev: ENCOUNTER_REV, version: 'v1', callouts: true });
    expect(plan('map-strait-v2', 'lab=map-strait-v2&callouts=0').encounters).toEqual({ rev: ENCOUNTER_REV, version: 'v2', callouts: false });
  });

  it('the run plays that version: its encounters, and its log says so', () => {
    const p = plan('map-harbor-v3');
    const run = new BotRun('harbor', 5, { persona: PERSONAS.tryhard, armory: { warhead: 3 }, lab: p.lab, convoy: p.convoy!, encounters: p.encounters! });
    run.advance(60 * 60 * 3);
    expect(run.game.enc!.played[0]).toBe('harbor-v3-hydra-teach');
    const log = run.finish();
    expect(log.encounters).toEqual({ rev: ENCOUNTER_REV, version: 'v3' });
    expect(log.lab).toMatchObject({ card: 'map-harbor-v3', variant: 'v3' });
    expect(labSetupText(log)).toBe(`Full map from wave 1 · D · Tactical commands · authored encounters rev ${ENCOUNTER_REV} · v3 · production setup`);
  }, 60_000);

  it('the page: the map\'s own card averages every version\'s runs (grouped by version); a version card its own', () => {
    const stats = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
    const log = (card: string, variant: string, at: string, fun: number): PlayLog =>
      ({
        game: 'v3',
        id: `${card}-${at}`,
        v: 22,
        build: '2026-11-15T01:00',
        startedAt: at,
        endedAt: at,
        firstWave: 1,
        end: 'won',
        commands: [],
        lab: { card, plays: 'full', rev: 12, round: 12, variant, config: { convoy: 'tactical', encounters: ENCOUNTER_REV, production: true } },
        labResult: { verdict: 'keep', tags: [], note: '', waves: 13, ended: 'won', stats, rev: 12, round: 12, variant, score: { rev: 1, fun } },
      }) as unknown as PlayLog;
    const { results } = labResultDocs([log('map-strait', 'v1', '2026-11-15T02:00', 3), log('map-strait-v2', 'v2', '2026-11-15T03:00', 5), log('map-strait-v3', 'v3', '2026-11-15T04:00', 4), log('map-gauntlet-v2', 'v2', '2026-11-15T05:00', 2)]);
    expect(results['map-strait'].runs!.map((r) => r.variant).sort()).toEqual(['v1', 'v2', 'v3']);
    expect(results['map-strait-v2'].runs!.map((r) => r.variant)).toEqual(['v2']);
    expect(results['map-strait-v2'].variant).toBe('v2');
    expect(results['map-gauntlet-v2'].runs).toHaveLength(1);
    expect(results['map-gauntlet']).toBeUndefined();
  });

  it('the pause script: the version\'s encounters, its pairs in words, its arc', () => {
    expect(versionLabel('gauntlet', 'v2')).toBe('v2 Set pieces');
    expect(encountersFor('strait', 6, 'v3').map((e) => e.id)).toEqual(['strait-v3-heli-teach']);
    expect(pairBeatText({ at: 0.35, pair: 'hydra-swarm', base: 0 }, 'Hydra + Drone Swarm')).toBe('at 35% of the wave: enemy pair Hydra + Drone Swarm, its lead from base 1');
    expect(arcGroups('harbor', 11, 13, 'The Breakout', 'v2')).toEqual([
      { from: 1, to: 1, name: 'quiet wave' },
      { from: 2, to: 2, name: 'Ambush' },
      { from: 3, to: 3, name: 'quiet wave' },
      { from: 4, to: 4, name: 'Headlands' },
      { from: 5, to: 6, name: 'quiet wave' },
      { from: 7, to: 7, name: 'Wolf pack' },
      { from: 8, to: 9, name: 'quiet wave' },
      { from: 10, to: 10, name: 'Harbor gate' },
      { from: 11, to: 13, name: 'Boss rounds: The Breakout' },
    ]);
    // v1's arc is as it was.
    expect(arcGroups('strait', 11, 13, 'Afterburner Rush')[0]).toEqual({ from: 1, to: 1, name: 'shared wave' });
  });
});
