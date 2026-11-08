// The Test Lab (docs/design/v3-test-lab.md): the hub's cards, and test runs
// in the sim.

import { describe, expect, it } from 'vitest';
import { ABILITY_ORDER } from '../../src/v3/data/abilities';
import { FOES, FOE_ORDER } from '../../src/v3/data/foes';
import { LAB_CARDS, LAB_LENGTH, LAB_SCENARIOS, LAB_START_WAVE, labCard } from '../../src/v3/data/lab';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { RULES } from '../../src/v3/data/config';
import { labDone } from '../../src/v3/sim/lab';
import { Recorder, replay } from '../../src/v3/sim/playlog';
import { applyFreePlay, applyLab, createGame, damageThreat, step, type Game } from '../../src/v3/sim/game';
import { Bot, SKILLS } from '../../src/v3/sim/bot';

const DT = 1 / 60;

function labGame(id: string, seed = 3, length: 'quick' | 'full' = 'full'): Game {
  const card = labCard(id)!;
  const g = createGame(card.map, seed, LAB_START_WAVE);
  applyFreePlay(g, { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true });
  applyLab(g, { card: id, length, mix: 'normal' });
  return g;
}

describe('the hub\'s cards', () => {
  it('every new enemy, every weapon (29), eight combos and every map, each once', () => {
    const ids = LAB_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FOE_ORDER) expect(LAB_CARDS.filter((c) => c.kind === 'enemy' && c.foes[0] === f), f).toHaveLength(1);
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').map((c) => c.weapon).sort()).toEqual([...ABILITY_ORDER].sort());
    expect(LAB_CARDS.filter((c) => c.kind === 'combo')).toHaveLength(8);
    expect(LAB_CARDS.filter((c) => c.kind === 'map').map((c) => c.map)).toEqual(MAP_ORDER);
    // The order: the open questions first, the reworked weapons first.
    expect(ids.slice(0, 3)).toEqual(['diveBomber', 'siege', 'rocketTruck']);
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').slice(0, 5).map((c) => c.weapon)).toEqual(['dualWield', 'cadence', 'focus', 'gunships', 'supplyRun']);
    for (const c of LAB_CARDS) {
      expect(c.kit, c.id).toHaveLength(3);
      for (const w of c.kit) expect(ABILITY_ORDER, c.id).toContain(w);
      expect(c.look.length, c.id).toBeGreaterThan(5);
    }
  });
});

describe('a test run', () => {
  it('opens every wave with the card\'s enemy within seconds, rotates scenarios, and keeps a third or more of the new enemies its own', () => {
    const g = labGame('sprinter');
    g.lost = -99; // the test is about the waves, not the bot's skill
    const bot = new Bot(SKILLS.sharp, 3);
    const kind = FOES.sprinter.kind;
    let waves = 0;
    let featured = 0;
    let others = 0;
    let seen = 0;
    for (let i = 0; i < 60 * 60 * 15 && waves < 4; i++) {
      if (g.phase === 'wave' && g.wave !== seen) {
        seen = g.wave;
        const first = g.queue.find((l) => l.kind === kind);
        expect(first, `wave ${g.wave}`).toBeDefined();
        expect(first!.at).toBeLessThanOrEqual(RULES.waveLeadIn + 1.5);
        const foes = g.queue.filter((l) => FOE_ORDER.some((f) => FOES[f].kind === l.kind));
        featured += foes.filter((l) => l.kind === kind).length;
        others += foes.filter((l) => l.kind !== kind).length;
        waves++;
      }
      bot.act(g);
      step(g, DT);
    }
    expect(waves).toBeGreaterThanOrEqual(3);
    expect(featured / (featured + others)).toBeGreaterThanOrEqual(0.3);
    expect(LAB_SCENARIOS.length).toBeGreaterThan(2);
  });

  it('runs past wave 10 (no win), counts its length, and the evidence', () => {
    const g = labGame('rocketTruck', 5);
    g.lost = -99; // the test is about the clock, not the bot's skill
    g.carrierHp = g.stats.carrierHp = 1e6; // nor the carrier's luck with ballistics
    const bot = new Bot(SKILLS.sharp, 5);
    for (let i = 0; i < 60 * 60 * 30 && !labDone(g); i++) {
      bot.act(g);
      step(g, 1 / 30);
    }
    expect(labDone(g)).toBe(true);
    expect(g.lab!.waves).toBe(LAB_LENGTH.full);
    expect(g.wave).toBeGreaterThan(RULES.wavesToClear);
    expect(g.cleared).toBe(false);
    const s = g.lab!.stats;
    expect(s.came).toBeGreaterThan(0);
    expect(s.killed).toBeLessThanOrEqual(s.came);
    expect(s.early).toBeLessThanOrEqual(s.killed);
  });

  it('a kill before harm counts as early; a truck that fired doesn\'t', () => {
    const g = labGame('rocketTruck', 6);
    for (let i = 0; i < 60 * 12 && !g.threats.some((t) => t.kind === 'rocketTruck'); i++) step(g, DT);
    const t = g.threats.find((o) => o.kind === 'rocketTruck')!;
    damageThreat(g, t, 99);
    expect(g.lab!.stats.killed).toBe(1);
    expect(g.lab!.stats.early).toBe(1);
  });

  it('"Bring one" is a recorded command: a test that used it replays exactly', () => {
    const card = labCard('torpedoSub')!;
    const g = createGame(card.map, 9, LAB_START_WAVE);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: 'torpedoSub', length: 'quick' as const, mix: 'heavy' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    // Only recorded inputs (a bot's taps would bypass the log).
    for (let i = 0; i < 60 * 40; i++) {
      if (i === 200 || i === 900) rec.bring();
      if (g.phase === 'draft') rec.pick(g.offer[0]);
      if (g.phase === 'lost') break;
      step(g, DT);
    }
    expect(rec.log.commands.filter((c) => c[1] === 'b')).toHaveLength(2);
    const log = rec.finish('quit');
    expect(log.lab).toEqual(lab);
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.lab!.stats).toEqual(g.lab!.stats);
  });

  it('a map card plays its map\'s own waves with its chapter\'s enemies', () => {
    const g = labGame('map-coves');
    expect(g.map.id).toBe('coves');
    expect(g.lab!.map).toBe(true);
    expect(g.foe.lead.length).toBeGreaterThan(0);
  });
});
