// The Test Lab (docs/design/v3-test-lab.md): the hub's cards, and test runs
// in the sim.

import { describe, expect, it } from 'vitest';
import { ABILITY_ORDER } from '../../src/v3/data/abilities';
import { FOE, FOES, FOE_ORDER } from '../../src/v3/data/foes';
import { LAB_CARDS, LAB_CHANGES, LAB_LENGTH, LAB_ROUND, LAB_ROUNDS, LAB_SCENARIOS, LAB_START_WAVE, cardChanges, cardRev, labCard } from '../../src/v3/data/lab';
import { enemyPair, type PairMember } from '../../src/v3/data/pairs';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { RULES } from '../../src/v3/data/config';
import { foeOnBoard, labDone } from '../../src/v3/sim/lab';
import { Recorder, replay, type PlayLog } from '../../src/v3/sim/playlog';
import { labResultDocs, logRound, ownNote } from '../../src/v3/sim/labDocs';
import { addLabEntry, currentEntry, labStatus, newVerdictDraft, nextCards, olderEntries, parseLabProgress, verdictResult, type LabEntry } from '../../src/v3/ui/lab';
import { applyFreePlay, applyLab, createGame, damageThreat, labBring, step, type Game } from '../../src/v3/sim/game';
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
  it('every special event (21: round 7 added four), every new enemy (17), every weapon (27: Test Lab round 5 cut two), thirteen enemy pairs (round 8) and every map, each once (98 cards)', () => {
    const ids = LAB_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(98);
    expect(LAB_CARDS.filter((c) => c.kind === 'event')).toHaveLength(21);
    expect(ids).not.toContain('w-overclock');
    expect(ids).not.toContain('w-timeWarp');
    expect(LAB_CARDS.filter((c) => c.kind === 'enemy')).toHaveLength(17);
    for (const f of FOE_ORDER) expect(LAB_CARDS.filter((c) => c.kind === 'enemy' && c.foes[0] === f), f).toHaveLength(1);
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').map((c) => c.weapon).sort()).toEqual([...ABILITY_ORDER].sort());
    expect(LAB_CARDS.filter((c) => c.kind === 'combo')).toHaveLength(13);
    // Round 8: the combos with a player weapon in them are cut.
    for (const id of ['combo-lure-screen', 'combo-cloud-flak', 'combo-guard-seeker', 'combo-hydra-tesla']) expect(ids).not.toContain(id);
    expect(labCard('combo-siege-truck')!.foes).toEqual(['rocketTruck', 'siege']);
    expect(LAB_CARDS.filter((c) => c.kind === 'map').map((c) => c.map)).toEqual(MAP_ORDER);
    // The order: round 5's events first, then the enemies' open questions,
    // the reworked weapons first.
    expect(ids.slice(0, 2)).toEqual(['ev-rush', 'ev-decoy-storm']);
    expect(LAB_CARDS.filter((c) => c.kind === 'enemy').slice(0, 3).map((c) => c.id)).toEqual(['diveBomber', 'siege', 'rocketTruck']);
    // Round 8's reworked weapons first, then round 5's.
    expect(LAB_CARDS.filter((c) => c.kind === 'weapon').slice(0, 13).map((c) => c.weapon)).toEqual(['focus', 'wildCard', 'grapnel', 'overdrive', 'frigate', 'droneScreen', 'aegis', 'well', 'cutter', 'gunships', 'supplyRun', 'bomberWing', 'shield']);
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

// ---- Combos meet (Test Lab round 4) ----------------------------------------
// The player on Spotter + Siege Battery: "the recon drone and then the siege
// cannon never really appeared at the same time". Each combo's set now comes
// in together, timed to overlap (data/lab.ts, each combo's `pair`).

/** The longest stretch (s) with every one of the card's enemies on the
 *  board at once, nobody shooting, over `secs` of this wave. */
function together(g: Game, foes: PairMember[], secs: number): number {
  let run = 0;
  let best = 0;
  const w = g.wave;
  for (let i = 0; i < secs * 30 && g.phase === 'wave' && g.wave === w; i++) {
    step(g, 1 / 30);
    run = foes.every((f) => foeOnBoard(g, f)) ? run + 1 / 30 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** A combo's test with nobody shooting (the convoy can't lose). */
function quietLab(id: string, seed: number): Game {
  const g = labGame(id, seed);
  g.lost = -99;
  g.carrierHp = g.stats.carrierHp = 1e6;
  return g;
}

const COMBOS = LAB_CARDS.filter((c) => c.kind === 'combo');

describe('combos meet (Test Lab round 4)', () => {
  it('every combo has a pairing: a lead and followers from its pair, and a rule in words', () => {
    expect(COMBOS).toHaveLength(13);
    for (const c of COMBOS) {
      const p = c.pair!;
      expect(p, c.id).toBeDefined();
      const pair = enemyPair(c.id.replace(/^combo-/, ''))!;
      expect([p.lead, ...p.follow.map((f) => f.foe)], c.id).toEqual(pair.members);
      for (const f of c.foes) expect(pair.members, c.id).toContain(f);
      expect(p.rule.length, c.id).toBeGreaterThan(20);
    }
  });

  /** Every member of a combo's pair (each once). */
  const members = (id: string): PairMember[] => [...new Set(enemyPair(id.replace(/^combo-/, ''))!.members)];

  for (const c of COMBOS) {
    it(`${c.name}: in the first wave its enemies are on the board together for 4.5 s or more`, () => {
      for (const seed of [1, 2, 3]) expect(together(quietLab(c.id, seed), members(c.id), 90), `seed ${seed}`).toBeGreaterThanOrEqual(4.5);
    });

    it(`${c.name}: Bring one brings the whole set, and it is on the board together too`, () => {
      for (const seed of [1, 2]) {
        const g = quietLab(c.id, seed);
        // Only what the button brings: the wave's own sets are taken out.
        g.lab!.sets = [];
        step(g, DT);
        labBring(g);
        expect(together(g, members(c.id), 40), `seed ${seed}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it('the Spotter paints, then the siege gun rises while it paints: its first shells land with the strike', () => {
    const g = quietLab('combo-spotter-siege', 1);
    let circled = -1;
    let gunUp = -1;
    let shellsLand = -1;
    let strikeLands = -1;
    let called = -1;
    for (let i = 0; i < 60 * 40 && strikeLands < 0; i++) {
      step(g, DT);
      const sp = g.threats.find((t) => t.kind === 'spotter' && !t.dead);
      if (circled < 0 && sp?.foe && sp.foe.state >= 1) circled = g.waveT;
      if (called < 0 && sp?.foe && sp.foe.n === 1) called = g.waveT;
      if (gunUp < 0 && g.threats.some((t) => t.kind === 'siege' && !t.dead)) gunUp = g.waveT;
      const shell = g.foe.marks.find((m) => m.kind === 'shell' && !m.far);
      if (shellsLand < 0 && shell) shellsLand = g.waveT + shell.dur - shell.t;
      // The strike (round 8): the Spotter's shells from off the map, called
      // as it leaves its circle.
      const st = g.foe.marks.find((m) => m.kind === 'shell' && m.far);
      if (strikeLands < 0 && st) strikeLands = g.waveT + st.dur - st.t;
    }
    expect(circled).toBeGreaterThan(0);
    // The gun comes up after the Spotter starts painting, and is up while it
    // paints (it paints from 2 s on its circle until it calls and leaves).
    expect(gunUp).toBeGreaterThan(circled + FOE.spotter.paint);
    expect(gunUp).toBeLessThan(circled + FOE.spotter.paint + FOE.spotter.call);
    expect(Math.abs(shellsLand - strikeLands)).toBeLessThan(1.5);
  });

  it('a combo test that used Bring one replays exactly', () => {
    const card = labCard('combo-hydra-swarm')!;
    const g = createGame(card.map, 9, LAB_START_WAVE);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: card.id, length: 'quick' as const, mix: 'normal' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    for (let i = 0; i < 60 * 40; i++) {
      if (i === 300 || i === 1200) rec.bring();
      if (g.phase === 'draft') rec.pick(g.offer[0]);
      if (g.phase === 'lost') break;
      step(g, DT);
    }
    const again = replay(rec.finish('quit'));
    expect(again.steps).toBe(g.steps);
    expect(again.lab!.stats).toEqual(g.lab!.stats);
    expect(g.lab!.stats.came).toBeGreaterThan(0);
  });
});

// ---- Rounds and versions ----------------------------------------------------

const stats = { came: 3, killed: 2, early: 1, harm: 1, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] };
const today = new Date().toISOString().slice(0, 10);
/** Progress as saved before rounds: one result object per card. */
const oldShape = {
  results: {
    rocketTruck: { verdict: 'keep', tags: ['Fun'], note: 'best one so far', waves: 2, ended: 'done', stats, at: '2026-11-08T01:00:00Z' },
    sprinter: { verdict: 'keep', tags: [], note: '', waves: 2, ended: 'done', stats, at: '2026-11-08T01:10:00Z' },
  },
  length: 'quick',
  mix: 'normal',
  queue: [],
  session: { day: today, ids: ['rocketTruck'] },
};

describe('test rounds and card versions', () => {
  it('the rounds are in order and every change names a real card and round', () => {
    expect(LAB_ROUNDS.map((r) => r.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(LAB_ROUND).toBe(9);
    for (const [id, list] of Object.entries(LAB_CHANGES)) {
      expect(labCard(id), id).toBeDefined();
      for (const c of list) expect(LAB_ROUNDS.map((r) => r.n), id).toContain(c.round);
    }
    expect(cardRev('rocketTruck')).toBe(2);
    // The Torpedo Sub first changed in round 7 (its spread), then round 8
    // (one by one, each at a ship).
    expect(LAB_CHANGES.torpedoSub!.map((c) => c.round)).toEqual([7, 8]);
    expect(cardRev('w-gunships')).toBe(5);
    expect(cardChanges('rocketTruck', 1)).toHaveLength(1);
    expect(cardChanges('rocketTruck', 2)).toEqual([]);
    // Round 3 (the player's round 2 notes): the Dive Bomber, the Incendiary
    // Missile and the Decoy Drones changed again.
    expect(LAB_CHANGES.diveBomber!.find((c) => c.round === 3)).toBeDefined();
    expect(cardChanges('diveBomber', 2)[0]).toBe('Quicker, and now an A-10 Warthog');
    expect(LAB_CHANGES.cloud!.find((c) => c.round === 3)).toBeDefined();
    expect(LAB_CHANGES.decoy!.map((c) => c.round)).toEqual([2, 3, 7, 8, 9]);
    expect(cardChanges('combo-decoy-sprint', 2)).toContain('Decoy Drones: The swarm spreads out; easier to tell apart');
    expect(cardRev('siege')).toBe(2);
    // Round 4 (the player's notes of 2026-11-09): every combo now comes in
    // together, Dual Wield's cases, War Drum blows up platforms.
    // (Lure Beacon + Drone Screen is round 5: Drone Screen changed then.)
    // (Round 8's new pairs have only their round 8 line.)
    for (const c of LAB_CARDS.filter((o) => o.kind === 'combo' && LAB_CHANGES[o.id]!.some((l) => l.round < 8))) {
      expect(cardRev(c.id), c.id).toBeGreaterThanOrEqual(4);
      expect(LAB_CHANGES[c.id]!.some((l) => l.round === 4), c.id).toBe(true);
    }
    expect(cardChanges('combo-spotter-siege', 3)[0]).toBe('Its enemies now arrive together');
    expect(cardRev('w-dualWield')).toBe(4);
    expect(cardRev('w-cadence')).toBe(4);
    expect(LAB_ROUNDS[3]).toEqual({ n: 4, date: '2026-11-09', name: 'Combos meet; Dual Wield and Cadence', since: '2026-11-09T03:00' });
    // Round 5 (the player's round 4 enemy notes): the Dive Bomber, the
    // Incendiary Missile and the Repair Ship, and the combos with them.
    expect(LAB_ROUNDS[4]).toEqual({ n: 5, date: '2026-11-09', name: 'Special events and new notes', since: '2026-11-09T18:00' });
    for (const id of ['diveBomber', 'cloud', 'tender', 'combo-tender-bodyguard']) expect(cardRev(id), id).toBe(5);
    expect(cardChanges('diveBomber', 4)).toEqual(['Flies in from off the screen; its run a little slower (2.0 s)']);
    expect(cardChanges('combo-tender-bodyguard', 4)).toEqual(['Repair Ship: Now called the Repair Ship']);
    expect(labCard('tender')!.name).toBe('Repair Ship');
    expect(labCard('combo-tender-bodyguard')!.name).toBe('Repair Ship + Bodyguard Ring');
    // (It was not changed in round 5; round 8 changed the Spotter, so it took that on.)
    expect(LAB_CHANGES['combo-spotter-siege']!.some((c) => c.round === 5)).toBe(false);
    expect(cardRev('combo-spotter-siege')).toBe(8);
    expect(LAB_CHANGES.decoy!.some((c) => c.round === 5)).toBe(false);
    // Round 5 (the player's round 4 weapon notes): a line for every weapon
    // changed, and nothing for the ones kept as they were.
    const changed = ['aegis', 'well', 'cutter', 'gunships', 'supplyRun', 'bomberWing', 'shield'];
    for (const id of changed) expect(cardRev(`w-${id}`), id).toBe(5);
    // Round 8 (the player's round 7 weapon notes): a line for each weapon
    // whose play changed; the text-only rewrite (every card) asks for no
    // retest, so Gunship Pair stays at 5.
    for (const id of ['grapnel', 'droneScreen', 'focus', 'frigate', 'overdrive', 'wildCard']) expect(cardRev(`w-${id}`), id).toBe(8);
    expect(LAB_ROUNDS.find((r) => r.n === 8)).toEqual({ n: 8, date: '2026-11-10', name: 'Enemy pairs; weapon and enemy notes', since: '2026-11-10T19:00' });
    // Round 9 (docs/design/v3-round9-fixes.md).
    expect(LAB_ROUNDS[LAB_ROUNDS.length - 1]).toEqual({ n: 9, date: '2026-11-12', name: 'Hold fix; decoys flash; wider scavenger lock', since: '2026-11-13T00:00' });
    for (const id of ['decoy', 'scavenger', 'ev-decoy-storm', 'ev-breakout', 'ev-supply-raid', 'map-harbor', 'combo-decoy-sprint', 'combo-decoy-cluster', 'combo-scavenger-swarm']) expect(cardRev(id), id).toBe(9);
    for (const id of ['map-strait', 'map-gauntlet']) expect(cardRev(id), id).toBe(1);
    for (const id of ['airstrike', 'shrapnel', 'thermo', 'scatter', 'boomerang', 'flak', 'seeker', 'railgun', 'tesla', 'cadence', 'dualWield', 'fullSteam', 'orbital', 'lance']) expect(cardRev(`w-${id}`), id).toBeLessThan(5);
    expect(labCard('w-aegis')!.name).toBe('Point Defense');
  });

  it('a combo takes on its enemies\' versions and changes', () => {
    // Siege + Rocket Truck: its own three lines (round 8: they take turns),
    // and both enemies'.
    expect(cardChanges('combo-siege-truck')).toHaveLength(5);
    expect(cardRev('combo-siege-truck')).toBe(8);
    // Repair Ship + Bodyguard Ring: its round 4 line, and the Repair Ship's.
    expect(cardChanges('combo-tender-bodyguard', 3)).toEqual(['Its enemies now arrive together', 'Repair Ship: Now called the Repair Ship']);
    // (Round 7: the Hydra changed, and a combo with it takes its line on.)
    expect(cardChanges('combo-armored-hydra', 6)).toEqual(['Hydra Missile: 25% slower before it splits; its darts as fast as before', 'New pair: a Hydra arrives with two armored drones', 'Hydra Missile: A little slower again: 11% before it splits, its darts 12%']);
  });

  it('progress saved before rounds becomes round 1 history', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    expect(p.results.rocketTruck).toHaveLength(1);
    expect(p.results.rocketTruck[0]).toMatchObject({ verdict: 'keep', note: 'best one so far', rev: 1, round: 1 });
    expect(p.length).toBe('quick');
    expect(p.session.ids).toEqual(['rocketTruck']);
    // Already-migrated progress loads as it is.
    expect(parseLabProgress(JSON.parse(JSON.stringify(p))).results).toEqual(p.results);
  });

  it('a card changed in round 2 with only a round 1 verdict is not tested, and Next up offers it first', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    expect(currentEntry(p, 'rocketTruck')).toBeUndefined();
    expect(olderEntries(p, 'rocketTruck')).toHaveLength(1);
    expect(labStatus(p, 'rocketTruck')).toBe('changed');
    // The Sprint Drones didn't change: their round 1 verdict still counts.
    // (This was the Torpedo Sub until it changed in round 7.)
    expect(labStatus(p, 'sprinter')).toBe('tested');
    expect(currentEntry(p, 'sprinter')!.note).toBe('');
    expect(labStatus(p, 'diveBomber')).toBe('untested');
    // The events come first on the checklist (round 5), but the changed
    // card first.
    const next = nextCards(p, 3).map((c) => c.id);
    expect(next[0]).toBe('rocketTruck');
    expect(next).not.toContain('sprinter');
    expect(nextCards(p, 1, 'rocketTruck')[0].id).toBe('ev-rush');
    expect(nextCards(p, 40, 'rocketTruck').map((c) => c.id).filter((id) => !id.startsWith('ev-'))[0]).toBe('diveBomber');
  });

  it('a new verdict is appended (the old stays) and becomes the current one', () => {
    const p = parseLabProgress(JSON.parse(JSON.stringify(oldShape)));
    const e: LabEntry = { verdict: 'tune', tags: [], note: 'rockets read', waves: 2, ended: 'done', stats, at: '2026-11-09T00:00:00Z', rev: cardRev('rocketTruck'), round: LAB_ROUND, build: 't' };
    addLabEntry(p, 'rocketTruck', e);
    expect(p.results.rocketTruck).toHaveLength(2);
    expect(currentEntry(p, 'rocketTruck')).toEqual(e);
    expect(olderEntries(p, 'rocketTruck').map((o) => o.note)).toEqual(['best one so far']);
    expect(labStatus(p, 'rocketTruck')).toBe('tested');
    expect(nextCards(p, 1)[0].id).not.toBe('rocketTruck');
  });
});

describe('the verdict sheet (Test Lab round 4: seven notes saved with no verdict)', () => {
  it('Save with no verdict saves nothing (the sheet asks for one); with one, it keeps the verdict, the tags and the note', () => {
    expect(verdictResult({ verdict: null, tags: ['Fun'], note: 'the fire looks off' })).toBeNull();
    expect(verdictResult({ verdict: 'keep', tags: ['Fun'], note: '  the fire looks off \n' })).toEqual({ verdict: 'keep', tags: ['Fun'], note: 'the fire looks off' });
  });

  it('a sheet starts from the card\'s verdict at this version, and its picks are one object the sheet keeps through typing and a redraw', () => {
    const p = parseLabProgress(null);
    expect(newVerdictDraft(p, 'cloud')).toEqual({ verdict: null, tags: [], note: '' });
    addLabEntry(p, 'cloud', { verdict: 'tune', tags: ['Bug'], note: 'old words', waves: 2, ended: 'done', stats, at: 'x', rev: cardRev('cloud'), round: LAB_ROUND });
    const d = newVerdictDraft(p, 'cloud');
    expect(d).toEqual({ verdict: 'tune', tags: ['Bug'], note: 'old words' });
    // Its own copy: picks on the sheet don't touch the saved entry.
    d.tags.push('Fun');
    d.verdict = 'keep';
    expect(currentEntry(p, 'cloud')!.tags).toEqual(['Bug']);
    expect(verdictResult(d)).toEqual({ verdict: 'keep', tags: ['Bug', 'Fun'], note: 'old words' });
  });
});

describe('the bridge to the review pages', () => {
  const log = (id: string, card: string, at: string, verdict: 'keep' | 'tune' | 'cut', note: string, round?: number): PlayLog =>
    ({
      v: 17,
      game: 'v3',
      id,
      armory: {},
      build: 't',
      startedAt: at,
      endedAt: at,
      map: 'strait',
      seed: 1,
      firstWave: 5,
      device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' },
      commands: [],
      lab: { card, length: 'full', mix: 'normal', ...(round ? { rev: cardRev(card), round } : {}) },
      labResult: { verdict, tags: [], note, waves: 2, ended: 'done', stats, ...(round ? { rev: cardRev(card), round } : {}) },
    }) as PlayLog;

  it('groups logs by card and round: the latest round on top, earlier rounds as history', () => {
    const { results, builds } = labResultDocs([
      log('a', 'rocketTruck', '2026-11-08T01:00:00Z', 'keep', 'round one, early'),
      log('b', 'rocketTruck', '2026-11-08T02:00:00Z', 'keep', 'round one, later'),
      log('c', 'rocketTruck', '2026-11-09T01:00:00Z', 'tune', 'round two', 2),
      log('d', 'torpedoSub', '2026-11-08T01:00:00Z', 'keep', 'sub'),
    ]);
    const rt = results.rocketTruck;
    expect(rt).toMatchObject({ verdict: 'tune', note: 'round two', round: 2, rev: 2, log: 'c' });
    expect(rt.changes).toEqual(cardChanges('rocketTruck', 1));
    expect(rt.history).toEqual([{ round: 1, verdict: 'keep', note: 'round one, later', at: '2026-11-08T02:00:00Z', log: 'b' }]);
    // A log from before rounds is round 1, version 1.
    expect(results.torpedoSub).toMatchObject({ round: 1, rev: 1, history: [], changes: [] });
    expect(builds.rocketTruck).toMatchObject({ verdict: 'tune', round: 2 });
  });

  it('drops an earlier round\'s note copied in at the start of a new one', () => {
    expect(ownNote('Old words.\n\n\nNew words.', ['Old words.'])).toBe('New words.');
    expect(ownNote('Only new.', ['Old words.'])).toBe('Only new.');
  });

  it('keeps every note from a round: a later test with no note does not drop an earlier one', () => {
    const a = { ...log('g', 'siege', '2026-11-08T16:00:00Z', 'keep', 'rises well', 2) };
    const b = { ...log('h', 'siege', '2026-11-08T22:00:00Z', 'keep', '', 2) };
    expect(labResultDocs([a, b]).results.siege).toMatchObject({ round: 2, note: 'rises well', log: 'h' });
  });

  it('keeps a round\'s note once: a later test of the round whose note starts with an earlier one adds only its own words', () => {
    // Round 4: saved with a note but no verdict, then played again just to
    // set Keep (the sheet filled the note in again).
    const a = log('i', 'cloud', '2026-11-09T05:00:00Z', 'keep', 'the fire looks off', 4);
    a.labResult!.verdict = null;
    const b = log('j', 'cloud', '2026-11-09T05:10:00Z', 'keep', 'the fire looks off', 4);
    const c = log('k', 'cloud', '2026-11-09T05:20:00Z', 'keep', 'the fire looks off\n\nquicker please', 4);
    expect(labResultDocs([a, b]).results.cloud).toMatchObject({ round: 4, verdict: 'keep', note: 'the fire looks off', log: 'j' });
    expect(labResultDocs([a, b, c]).results.cloud).toMatchObject({ verdict: 'keep', note: 'the fire looks off · quicker please', log: 'k' });
  });

  it('places a log from before rounds by its build: a round-2 build counts as round 2', () => {
    const old = { ...log('e', 'rocketTruck', '2026-11-08T04:00:00Z', 'keep', 'first look'), build: '2026-11-08T03:46' };
    const after = { ...log('f', 'rocketTruck', '2026-11-08T16:00:00Z', 'tune', 'salvos'), build: '2026-11-08T15:07' };
    expect(logRound(old)).toBe(1);
    expect(logRound(after)).toBe(2);
    const { results } = labResultDocs([old, after]);
    expect(results.rocketTruck).toMatchObject({ round: 2, rev: 2, note: 'salvos' });
    expect(results.rocketTruck.history).toEqual([{ round: 1, verdict: 'keep', note: 'first look', at: '2026-11-08T04:00:00Z', log: 'e' }]);
  });

  it('a log from before rounds still replays', () => {
    const card = labCard('rocketTruck')!;
    const g = createGame(card.map, 4, LAB_START_WAVE);
    const free = { weapons: card.kit.map((w) => ({ id: w, level: 1 })), frequentDrops: true };
    applyFreePlay(g, free);
    const lab = { card: 'rocketTruck', length: 'quick' as const, mix: 'normal' as const };
    applyLab(g, lab);
    const rec = new Recorder(g, { build: 't', startedAt: '', firstWave: LAB_START_WAVE, freePlay: free, lab, device: { w: 1, h: 1, dpr: 1, touch: false, ua: '' } });
    for (let i = 0; i < 60 * 10; i++) step(g, DT);
    const old = rec.finish('quit');
    expect(old.lab!.round).toBeUndefined();
    expect(replay(old).steps).toBe(g.steps);
  });
});
