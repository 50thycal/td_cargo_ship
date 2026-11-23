// The Test Lab's Armory, all cards, and every map's iteration history (the
// player, 2026-11-23; log v64).

import { describe, expect, it } from 'vitest';
import { ARMORY, ARMORY_ORDER, BAY_ORDER } from '../../src/v3/data/armory';
import { LAB_DEFAULT_EQUIP, autoLevel, chapterRange, labArmoryIsAuto, labArmoryLevels, labBays, parseLabArmory, setLabEquip, setLabLevel } from '../../src/v3/data/labArmory';
import { MAP_HISTORY } from '../../src/v3/data/mapHistory';
import { MAP_ORDER, chapterOf } from '../../src/v3/data/maps';
import { READY_TO_TEST, mapCardId, labCard } from '../../src/v3/data/lab';
import { draftPool } from '../../src/v3/data/roster';
import { LOG_VERSION, Recorder, replay } from '../../src/v3/sim/playlog';
import { applyLab, createGame, rerollDraft, step, type Game } from '../../src/v3/sim/game';
import { labRunPlan, defaultSetup, parseLabProgress } from '../../src/v3/ui/lab';

describe('the Test Lab Armory: levels follow the chapter', () => {
  it('chapter 1 is levels 1-3, 2 is 2-4, 3 is 3-5, 4 is 4 to the max', () => {
    for (const id of ARMORY_ORDER) {
      expect(chapterRange(1, id)).toEqual({ lo: 1, hi: 3 });
      expect(chapterRange(2, id)).toEqual({ lo: 2, hi: 4 });
      expect(chapterRange(3, id)).toEqual({ lo: 3, hi: 5 });
      expect(chapterRange(4, id)).toEqual({ lo: 4, hi: ARMORY[id].max });
      for (let ch = 1; ch <= 4; ch++) {
        const { lo, hi } = chapterRange(ch, id);
        expect(autoLevel(ch, id)).toBeGreaterThanOrEqual(lo);
        expect(autoLevel(ch, id)).toBeLessThanOrEqual(hi);
      }
    }
    expect([1, 2, 3, 4].map((ch) => autoLevel(ch, 'reload'))).toEqual([2, 3, 4, 5]);
  });

  it('defaults to one upgrade a bay at Auto, and keeps a hand-set level inside the range', () => {
    const s = parseLabArmory(null);
    expect(labArmoryIsAuto(s, 2)).toBe(true);
    expect(labArmoryLevels(s, 2)).toEqual({ [LAB_DEFAULT_EQUIP.gun]: 3, [LAB_DEFAULT_EQUIP.hull]: 3, [LAB_DEFAULT_EQUIP.supply]: 3 });
    setLabEquip(s, 2, 'warhead');
    setLabLevel(s, 2, 'warhead', 9);
    expect(labArmoryLevels(s, 2).warhead).toBe(4);
    expect(labArmoryLevels(s, 2).reload).toBeUndefined();
    setLabLevel(s, 2, 'warhead', 0);
    expect(labArmoryLevels(s, 2).warhead).toBe(2);
    // The same upgrade on a chapter 1 map clamps into 1-3.
    setLabEquip(s, 1, 'warhead');
    setLabLevel(s, 1, 'warhead', 5);
    expect(labArmoryLevels(s, 1).warhead).toBe(3);
    expect(labArmoryIsAuto(s, 2)).toBe(false);
    expect(labBays(s, 2).map((b) => b.bay)).toEqual(BAY_ORDER);
  });

  it('reads stored settings safely: junk, unknown ids and a bay holding another bay\'s upgrade are dropped', () => {
    const s = parseLabArmory({ 1: { equip: { gun: 'plating', hull: 'plating', supply: 'nope' }, levels: { warhead: '3', plating: 2, zzz: 1 } }, 3: 'x' });
    expect(s[1].equip).toEqual({ hull: 'plating' });
    expect(s[1].levels).toEqual({ plating: 2 });
    expect(s[3]).toEqual({ equip: {}, levels: {} });
    expect(parseLabArmory('garbage')[4]).toEqual({ equip: {}, levels: {} });
  });
});

describe('all cards unlocked in the Test Lab (log v64)', () => {
  const DT = 1 / 60;
  // Quartermaster 5: four cards a hand and three re-rolls, so one draft
  // shows up to 16 cards. Deck Guns and plating keep wave 1 safe.
  const ARM = { pointdef: 5, plating: 5, quartermaster: 5 };
  /** Every card the first draft can show, re-rolls and all. */
  const firstDraft = (g: Game) => {
    for (let i = 0; i < 200 / DT && g.phase === 'wave'; i++) step(g, DT);
    expect(g.phase).toBe('draft');
    const seen = new Set<string>(g.offer);
    while (rerollDraft(g)) for (const c of g.offer) seen.add(c);
    return seen;
  };

  it("a map card's plan asks for every card", () => {
    const card = labCard(mapCardId('strait'))!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)));
    expect(plan.lab.allCards).toBe(true);
  });

  it("a chapter 1 lab run deals later chapters' weapons; the campaign does not", () => {
    const later = draftPool(4).filter((id) => !draftPool(1).includes(id));
    expect(later.length).toBeGreaterThan(0);
    const labSeen = new Set<string>();
    const campSeen = new Set<string>();
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const lab = createGame('strait', seed, 1, undefined, ARM);
      applyLab(lab, { card: mapCardId('strait'), plays: 'full', allCards: true });
      for (const c of firstDraft(lab)) labSeen.add(c);
      for (const c of firstDraft(createGame('strait', seed, 1, undefined, ARM))) campSeen.add(c);
    }
    expect(later.some((id) => labSeen.has(id))).toBe(true);
    expect(later.some((id) => campSeen.has(id))).toBe(false);
  });

  it('a lab log records the Armory it played and replays exactly', () => {
    const armory = { reload: 2, repair: 2, stockpile: 2 };
    const g = createGame('strait', 21, 1, undefined, armory);
    const lab = { card: mapCardId('strait'), plays: 'full' as const, allCards: true, armory: { chapter: chapterOf('strait'), auto: true } };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 'test', startedAt: '2026-11-23T00:00:00Z', firstWave: 1, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    for (let i = 0; i < 150 / DT && g.phase !== 'lost' && g.phase !== 'won'; i++) {
      if (g.phase === 'draft') rec.pick(g.offer.find((c) => c !== 'resupply' && c !== 'lifeboat') ?? g.offer[0]);
      else step(g, DT);
    }
    const log = rec.finish(g.phase === 'lost' ? 'lost' : 'quit');
    expect(log.v).toBe(LOG_VERSION);
    expect(log.armory).toEqual(armory);
    expect(log.lab?.armory).toEqual({ chapter: 1, auto: true });
    const again = replay(log);
    expect(again.steps).toBe(g.steps);
    expect(again.score).toBe(g.score);
    expect(again.levels).toEqual(g.levels);
  });
});

describe('every map has an iteration history', () => {
  it('each of the 20 maps has one, newest first, none past LOG_VERSION', () => {
    expect(MAP_ORDER).toHaveLength(20);
    for (const id of MAP_ORDER) {
      const h = MAP_HISTORY[id];
      expect(h, id).toBeDefined();
      expect(h.look.length, id).toBeGreaterThan(20);
      expect(h.history.length, id).toBeGreaterThan(0);
      expect(h.history[0].log, id).toBeLessThanOrEqual(LOG_VERSION);
      for (let i = 0; i < h.history.length; i++) {
        const it = h.history[i];
        expect(it.date, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(it.title && it.what && it.why, id).toBeTruthy();
        if (i > 0) {
          expect(it.log, `${id} newest first`).toBeLessThanOrEqual(h.history[i - 1].log);
          expect(it.date <= h.history[i - 1].date, `${id} dates newest first`).toBe(true);
        }
      }
    }
  });

  it('the history knows every Ready to test build', () => {
    for (const r of READY_TO_TEST) expect(MAP_HISTORY[r.map].history[0].log, r.map).toBeGreaterThanOrEqual(r.log);
  });
});
