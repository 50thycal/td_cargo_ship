// Test Lab round 8 (docs/design/v3-enemy-pairs.md): the combos are enemy
// pairs. The player: "the pairs should be enemy pairs, not player and enemy
// attack pairs. Basically looking for good synergy combos to add to the
// maps." (Every pair arriving together, first wave and Bring one, is in
// lab.test.ts, "combos meet".)

import { describe, expect, it } from 'vitest';
import { ABILITY_ORDER } from '../../src/v3/data/abilities';
import { FOE, FOES } from '../../src/v3/data/foes';
import { LAB_CARDS, LAB_RETIRED, LAB_ROUNDS, LAB_SECTIONS, LAB_START_WAVE, cardRev, labCard } from '../../src/v3/data/lab';
import { OLD_THREATS, PAIRS, enemyPair, isOldThreat, pairCardId, pairChapter, pairFoes } from '../../src/v3/data/pairs';
import { ROSTER } from '../../src/v3/data/roster';
import { guardFor } from '../../src/v3/sim/foes';
import { applyFreePlay, applyLab, createGame, damageThreat, dist, step, type Game } from '../../src/v3/sim/game';
import { foeOnBoard } from '../../src/v3/sim/lab';
import { labResultDocs } from '../../src/v3/sim/labDocs';
import { Recorder, replay, type PlayLog } from '../../src/v3/sim/playlog';

const DT = 1 / 60;

function quiet(id: string, seed: number): Game {
  const card = labCard(id)!;
  const g = createGame(card.map, seed, LAB_START_WAVE);
  applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
  applyLab(g, { card: id, length: 'full', mix: 'normal' });
  g.lost = -99;
  g.carrierHp = g.stats.carrierHp = 1e6;
  return g;
}

const COMBOS = LAB_CARDS.filter((c) => c.kind === 'combo');

describe('the pairs list (data/pairs.ts)', () => {
  it('one Test Lab combo card per pair, in the same order, ids matching', () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(12);
    expect(COMBOS.map((c) => c.id)).toEqual(PAIRS.map((p) => pairCardId(p.id)));
    expect(new Set(PAIRS.map((p) => p.id)).size).toBe(PAIRS.length);
    for (const p of PAIRS) {
      const c = labCard(pairCardId(p.id))!;
      expect(c.name).toBe(p.name);
      expect(c.pair).toBe(p.pair);
      expect(c.foes).toEqual(pairFoes(p));
      expect(enemyPair(p.id)).toBe(p);
    }
  });

  it('no combo card has a player weapon as a pair member, or a weapon of its own', () => {
    for (const c of COMBOS) {
      expect(c.weapon, c.id).toBeUndefined();
      const p = enemyPair(c.id.replace(/^combo-/, ''))!;
      for (const m of p.members) {
        expect(ABILITY_ORDER as string[], `${c.id} ${m}`).not.toContain(m);
        expect(m in FOES || m in OLD_THREATS, `${c.id} ${m}`).toBe(true);
      }
      // Two enemies at least: a pair, not one enemy and a weapon.
      expect(new Set(p.members).size, c.id).toBeGreaterThanOrEqual(2);
    }
    // The four cut ones are gone from the hub, kept only for their verdicts.
    expect(LAB_RETIRED.map((c) => c.id)).toEqual(['combo-lure-screen', 'combo-cloud-flak', 'combo-guard-seeker', 'combo-hydra-tesla']);
    for (const r of LAB_RETIRED) expect(labCard(r.id)).toBeUndefined();
  });

  it('each pair: a name, a synergy line, a question for its card, its chapter (every member out by then) and a kit from that chapter', () => {
    for (const p of PAIRS) {
      expect(p.synergy.length, p.id).toBeGreaterThan(40);
      expect(p.look.endsWith('?'), p.id).toBe(true);
      expect(p.chapter, p.id).toBe(pairChapter(p.members));
      expect(p.kit, p.id).toHaveLength(3);
      for (const w of p.kit) expect(ROSTER[w].unlock, `${p.id} ${w}`).toBeLessThanOrEqual(p.chapter);
    }
    // Across all four chapters, and the original threats mixed in.
    for (const ch of [1, 2, 3, 4]) expect(PAIRS.filter((p) => p.chapter === ch).length, `chapter ${ch}`).toBeGreaterThanOrEqual(2);
    expect(PAIRS.filter((p) => p.members.some(isOldThreat)).length).toBeGreaterThanOrEqual(3);
    // The ones the player kept.
    for (const id of ['decoy-sprint', 'spotter-siege', 'tender-bodyguard', 'siege-truck']) expect(enemyPair(id), id).toBeDefined();
  });

  it('round 8 is in the lab, the Combos section says enemy pairs, and every pair card is new or changed in it', () => {
    expect(LAB_ROUNDS.find((r) => r.n === 8)).toEqual({ n: 8, date: '2026-11-10', name: 'Enemy pairs; weapon and enemy notes', since: '2026-11-10T19:00' });
    expect(LAB_SECTIONS.find((s) => s.kind === 'combo')!.blurb).toMatch(/enemy pairs/i);
    for (const p of PAIRS.filter((o) => !['decoy-sprint', 'spotter-siege', 'tender-bodyguard'].includes(o.id))) expect(cardRev(pairCardId(p.id)), p.id).toBe(8);
  });
});

describe('Siege Battery + Rocket Truck take turns', () => {
  it('no siege shell lands within 1.2 s of a rocket: the shells start after the last salvo (first wave, seeds 1 to 3)', () => {
    for (const seed of [1, 2, 3]) {
      const g = quiet('combo-siege-truck', seed);
      const rockets = new Map<number, number>();
      const shells = new Map<number, number>();
      const w = g.wave;
      for (let i = 0; i < 60 * 90 && g.wave === w && g.phase === 'wave'; i++) {
        step(g, DT);
        for (const s of g.foe.shots) if (s.kind === 'rocket' && !rockets.has(s.id)) rockets.set(s.id, g.waveT + s.dur - s.t);
        for (const m of g.foe.marks) if (m.kind === 'shell' && m.dmg === undefined && !shells.has(m.id)) shells.set(m.id, g.waveT + m.dur - m.t);
      }
      expect(rockets.size, `seed ${seed}`).toBeGreaterThan(0);
      expect(shells.size, `seed ${seed}`).toBeGreaterThan(0);
      const r = [...rockets.values()];
      for (const t of shells.values()) expect(Math.min(...r.map((o) => Math.abs(o - t))), `seed ${seed}`).toBeGreaterThanOrEqual(1.2);
      // The first set: its rockets all land before its first shell.
      expect(Math.min(...shells.values()), `seed ${seed}`).toBeGreaterThan(Math.max(...r.filter((t) => t < Math.min(...shells.values()) + 1)));
    }
  });

  it('the pair\'s sets in a wave are far enough apart not to overlap', () => {
    expect(labCard('combo-siege-truck')!.pair!.gap).toBeGreaterThanOrEqual(26);
  });
});

describe('the synergies', () => {
  it('Spotter + Dive Bombers: each dive bomber\'s circle goes on the painted ship, and its bomb lands on it (or it sank first)', () => {
    for (const seed of [1, 2, 3]) {
      const g = quiet('combo-spotter-dive', seed);
      // The ship painted as each circle showed, in order; the bombs in order.
      const circles: { id: number; ship: number }[] = [];
      const bombs: { id: number; at: number; x: number; y: number }[] = [];
      const hit: boolean[] = [];
      for (let i = 0; i < 60 * 40 && hit.length < 2; i++) {
        step(g, DT);
        for (const m of g.foe.marks) if (m.kind === 'dive' && !circles.some((c) => c.id === m.id)) circles.push({ id: m.id, ship: g.foe.paint?.ship ?? -1 });
        for (const s of g.foe.shots) if (s.kind === 'bomb' && !bombs.some((o) => o.id === s.id)) bombs.push({ id: s.id, at: g.waveT + s.dur - s.t, x: s.tx, y: s.ty });
        bombs.forEach((o, k) => {
          if (o.at < 0 || g.waveT < o.at - 0.02) return;
          const ship = circles[k].ship;
          const near = [...g.ships].sort((p, q) => dist(p.x, p.y, o.x, o.y) - dist(q.x, q.y, o.x, o.y))[0];
          hit.push(ship >= 0 && (!g.ships.some((x) => x.id === ship) || near?.id === ship));
          o.at = -1;
        });
      }
      expect(circles.every((c) => c.ship >= 0), `seed ${seed}`).toBe(true);
      expect(hit, `seed ${seed}`).toEqual([true, true]);
    }
  });

  it('Attack Helicopter + Torpedo Sub: the periscope comes up under the helicopter\'s hover', () => {
    for (const seed of [1, 2, 3]) {
      const g = quiet('combo-heli-sub', seed);
      let gap = -1;
      for (let i = 0; i < 60 * 40 && gap < 0; i++) {
        step(g, DT);
        const m = g.foe.marks.find((o) => o.kind === 'periscope');
        const h = g.threats.find((t) => t.kind === 'attackHeli' && !t.dead);
        if (m && h?.foe) gap = dist(m.x, m.y, h.foe.px, h.foe.py);
      }
      expect(gap, `seed ${seed}`).toBeGreaterThanOrEqual(0);
      expect(gap, `seed ${seed}`).toBeLessThan(160);
    }
  });

  it('Repair Ship + Rocket Truck: the ship moors within reach of the truck\'s road end and mends the truck', () => {
    for (const seed of [1, 2, 3]) {
      const g = quiet('combo-tender-truck', seed);
      let truck = g.threats.find((t) => t.kind === 'rocketTruck');
      for (let i = 0; i < 60 * 40 && !(truck?.foe && truck.foe.state >= 1); i++) {
        step(g, DT);
        truck = g.threats.find((t) => t.kind === 'rocketTruck' && !t.dead);
      }
      const tender = g.threats.find((t) => t.kind === 'tender' && !t.dead)!;
      expect(truck, `seed ${seed}`).toBeDefined();
      expect(dist(tender.foe!.px, tender.foe!.py, truck!.x, truck!.y), `seed ${seed}`).toBeLessThan(FOE.tender.reach * 0.6);
      damageThreat(g, truck!, 2);
      const hurt = truck!.hp;
      let best = hurt;
      for (let i = 0; i < 60 * 10 && !truck!.dead; i++) {
        step(g, DT);
        best = Math.max(best, truck!.hp);
      }
      expect(best, `seed ${seed}`).toBeGreaterThan(hurt);
    }
  });

  it('Bodyguard Ring + Spotter: three guards fly in round the Spotter (no heavy) and take the shots at it', () => {
    const g = quiet('combo-guard-spotter', 1);
    let sp = g.threats.find((t) => t.kind === 'spotter');
    for (let i = 0; i < 60 * 10 && !sp; i++) {
      step(g, DT);
      sp = g.threats.find((t) => t.kind === 'spotter');
    }
    step(g, DT);
    const guards = g.threats.filter((t) => t.kind === 'guard' && t.foe?.link === sp!.id);
    expect(guards).toHaveLength(FOE.bodyguard.guards);
    expect(g.threats.some((t) => t.kind === 'heavy' && t.id > sp!.id)).toBe(false);
    for (let i = 0; i < 60 * 6; i++) step(g, DT);
    expect(guardFor(g, sp!, g.map.carrier)?.kind).toBe('guard');
  });

  it('a set\'s own swarm is the pair\'s; the wave\'s drones are not', () => {
    const g = quiet('combo-hydra-swarm', 1);
    for (let i = 0; i < 60 * 8; i++) step(g, DT);
    const mine = g.threats.filter((t) => t.kind === 'drone' && t.paired);
    expect(mine.length).toBeGreaterThan(0);
    // The first set's swarm (the Hydra not yet out to count its set).
    expect(mine.length).toBe(OLD_THREATS.drone.size);
    expect(foeOnBoard(g, 'drone')).toBe(true);
  });
});

describe('replays and the review page', () => {
  for (const id of ['combo-tender-truck', 'combo-guard-spotter', 'combo-decoy-cluster']) {
    it(`${id}: a test that used Bring one replays exactly`, () => {
      const card = labCard(id)!;
      const g = createGame(card.map, 7, LAB_START_WAVE);
      const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
      applyFreePlay(g, free);
      const lab = { card: id, length: 'quick' as const, mix: 'normal' as const };
      applyLab(g, lab);
      const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
      for (let i = 0; i < 60 * 40; i++) {
        if (i === 300 || i === 1300) rec.bring();
        if (g.phase === 'draft') rec.pick(g.offer[0]);
        if (g.phase === 'lost') break;
        step(g, DT);
      }
      const again = replay(rec.finish('quit'));
      expect(again.steps).toBe(g.steps);
      expect(again.lab!.stats).toEqual(g.lab!.stats);
      expect(again.threats.map((t) => [t.id, t.kind, Math.round(t.x), Math.round(t.y)])).toEqual(g.threats.map((t) => [t.id, t.kind, Math.round(t.x), Math.round(t.y)]));
    });
  }

  it('a verdict on a cut combo is kept, marked cut; one on a card the lab never had is dropped', () => {
    const stats = { came: 3, killed: 2, early: 1, harm: 1, sunk: 0, weaponKills: 4, weaponUses: 2, firstShot: [] };
    const log = (id: string, card: string): PlayLog =>
      ({
        id,
        build: '2026-11-10T07:00',
        startedAt: '2026-11-10T08:00:00Z',
        endedAt: '2026-11-10T08:10:00Z',
        map: 'strait',
        seed: 1,
        firstWave: 5,
        device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' },
        commands: [],
        lab: { card, length: 'quick', mix: 'normal', rev: 7, round: 7 },
        labResult: { verdict: 'cut', tags: [], note: 'Looking for enemy and enemy attack pairs', waves: 2, ended: 'done', stats, rev: 7, round: 7 },
      }) as unknown as PlayLog;
    const { results } = labResultDocs([log('a', 'combo-cloud-flak'), log('b', 'combo-nothing')]);
    expect(results['combo-cloud-flak']).toMatchObject({ verdict: 'cut', round: 7, cut: { round: 8 } });
    expect(results['combo-cloud-flak'].evidence).toContain('Flak');
    expect(results['combo-nothing']).toBeUndefined();
  });
});
