// Test Lab round 10 (docs/design/v3-map-cards-production.md): a map card
// is the full production map. It plays the map as the campaign does, wave 1
// to 10 with the campaign's own wave plan, loadout and drafts, then the
// map's event ending; the three reference maps open with their convoy
// commands and authored encounters on; the old short lab run is still on
// the setup sheet as a "Quick slice"; the log says which it was.

import { describe, expect, it } from 'vitest';
import { LAB_CARDS, LAB_LENGTH, LAB_START_WAVE, MAP_CARD_PLAYS, labCard, mapProduction, productionText, type LabCard } from '../../src/v3/data/lab';
import { EVENT_MAPS, EVENT_WAVE, campaignWaves } from '../../src/v3/data/events';
import { MAP_ORDER, type MapId } from '../../src/v3/data/maps';
import { applyLab, createGame, labBring, type Game } from '../../src/v3/sim/game';
import { lastWave, isEventWave } from '../../src/v3/sim/events';
import { evidenceLines, labCountText, labDone, labWaves, type LabSetup } from '../../src/v3/sim/lab';
import { labResultDocs, labSetupText, logPlays } from '../../src/v3/sim/labDocs';
import { rngPrint } from '../../src/v3/sim/mapLab';
import { BotRun, PERSONAS, type RunOpts } from '../../src/v3/sim/mimic';
import { replay, type PlayLog } from '../../src/v3/sim/playlog';
import { defaultSetup, isProduction, labActions, labRunPlan, nextCards, parseLabProgress, productionSetup, type LabEntry } from '../../src/v3/ui/lab';

const REF: MapId[] = ['strait', 'gauntlet', 'harbor'];

/** A map card's run as the app starts it from the hub (no setup given, no
 *  link): the plan labRunPlan makes. */
function fromHub(id: string, link?: string) {
  const card = labCard(id)!;
  const p = parseLabProgress(null);
  return labRunPlan(card, defaultSetup(card, p), link ? new URLSearchParams(link) : null);
}

/** The run options a plan gives a bot game (as app.ts's play() does). */
function opts(plan: ReturnType<typeof fromHub>, more: RunOpts = {}): RunOpts {
  return { persona: PERSONAS.you, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}), ...more };
}

/** A game's whole state but its lab bookkeeping (the lab only watches). */
const withoutLab = (g: Game) =>
  JSON.stringify(g, (k, v) => (k === 'tel' || k === 'rng' || k === 'map' || k === 'lab' ? undefined : (k === 'convoy' || k === 'enc') && v === null ? undefined : v instanceof Set ? [...v] : v));

/** What a wave was planned to send, as it starts. */
const planOf = (g: Game) => JSON.stringify({ wave: g.wave, queue: g.queue, raids: g.raids, raiders: g.raiderQueue, event: g.event?.id ?? null });

/** A game that can't be lost (to see every wave): the same change made to
 *  both games of a comparison. */
function tough(g: Game): void {
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = g.stats.carrierHp = 1e6;
}

/** Two bot games in lockstep, each wave's plan taken as it starts; the
 *  same bot (same persona and seed) plays each, and neither can be lost. */
function lockstep(map: MapId, seed: number, a: RunOpts, b: RunOpts, maxSteps = 60 * 60 * 40): { plansA: string[]; plansB: string[]; A: BotRun; B: BotRun } {
  const A = new BotRun(map, seed, a);
  const B = new BotRun(map, seed, b);
  tough(A.game);
  tough(B.game);
  const plansA = [planOf(A.game)];
  const plansB = [planOf(B.game)];
  for (let n = 0; n < maxSteps && !(A.done && B.done); n++) {
    const wa = A.game.wave;
    const pa = A.game.phase;
    A.advance(1);
    B.advance(1);
    if (A.game.phase === 'wave' && (A.game.wave !== wa || pa !== 'wave')) plansA.push(planOf(A.game));
    if (B.game.phase === 'wave' && (B.game.wave !== wa || pa !== 'wave')) plansB.push(planOf(B.game));
    if (A.game.steps % 600 === 0 && withoutLab(A.game) !== withoutLab(B.game)) break;
  }
  return { plansA, plansB, A, B };
}

describe('a map card is the full production map', () => {
  it('every map card, from the hub, plays the full map: no lab kit, start wave, mix or length, no Free Play setup', () => {
    for (const id of MAP_ORDER) {
      const plan = fromHub(`map-${id}`);
      expect(plan.full, id).toBe(true);
      expect(plan.lab, id).toMatchObject({ card: `map-${id}`, plays: 'full', round: 10, rev: 10 });
      expect(plan.lab.length, id).toBeUndefined();
      expect(plan.lab.mix, id).toBeUndefined();
    }
  });

  it('its first wave is the campaign\'s first wave on the same seed, on every map (the card plans nothing again)', () => {
    for (const id of MAP_ORDER) {
      const camp = createGame(id, 11, 1);
      const card = createGame(id, 11, 1);
      applyLab(card, { card: `map-${id}`, plays: 'full' });
      expect(card.wave, id).toBe(1);
      expect(planOf(card), id).toBe(planOf(camp));
      expect(withoutLab(card), id).toBe(withoutLab(camp));
      expect(card.endless, id).toBe(false);
      expect(card.freePlay, id).toBe(false);
      expect(lastWave(card), id).toBe(campaignWaves(id));
    }
  });

  // The same bot plays a campaign run and the map card's run: waves 1 to 10
  // are planned the same, wave for wave, and the whole game is the same.
  for (const [map, seed] of [['kesh', 3], ['strait', 5], ['harbor', 8]] as [MapId, number][]) {
    it(`${map}: waves 1-10 are planned as the campaign plans them on the same seed, and the game is the campaign's (layers off)`, () => {
      const card = labRunPlan(labCard(`map-${map}`)!, { ...productionSetup(labCard(`map-${map}`)!), convoy: 'current', encounters: false });
      const { plansA, plansB, A, B } = lockstep(map, seed, { persona: PERSONAS.you }, opts(card));
      // Every wave of the map was played: 1 to 10, then the ending's three.
      expect(A.game.phase).toBe('won');
      expect(plansA.map((p) => JSON.parse(p).wave)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
      expect(plansB).toEqual(plansA);
      expect(B.game.phase).toBe('won');
      expect(withoutLab(B.game)).toBe(withoutLab(A.game));
      expect(rngPrint(B.game)).toBe(rngPrint(A.game));
      expect(B.game.lab!.waves).toBe(A.game.history.filter((h) => h.outcome === 'cleared').length);
    }, 120_000);
  }

  it('the reference maps under their production setup: the campaign game with the convoy and encounter layers on, and nothing else', () => {
    for (const map of REF) {
      const plan = fromHub(`map-${map}`);
      const { plansA, plansB, A, B } = lockstep(
        map,
        4,
        { persona: PERSONAS.you, convoy: plan.convoy!, encounters: plan.encounters!, pilot: 'sharp' },
        opts(plan, { pilot: 'sharp' }),
      );
      expect(plansB, map).toEqual(plansA);
      expect(withoutLab(B.game), map).toBe(withoutLab(A.game));
      // Each of its three encounters, in every wave it plays (1-10 only).
      expect(new Set(B.game.enc!.played).size, map).toBe(3);
      expect(B.game.enc!.wave, map).toBeLessThanOrEqual(10);
      expect(B.game.phase, map).toBe('won');
    }
  }, 120_000);

  it('after wave 10 comes the map\'s event ending: the convoy restored, then waves 11-13, then the map won', () => {
    const plan = fromHub('map-strait');
    const run = new BotRun('strait', 6, opts(plan, { pilot: 'sharp' }));
    const g = run.game;
    tough(g);
    const restoredAt: number[] = [];
    const eventWaves = new Map<number, string>();
    for (let n = 0; n < 60 * 60 * 30 && !run.done; n++) {
      run.advance(1);
      if (g.events.some((e) => e.kind === 'restore')) restoredAt.push(g.wave);
      if (g.event && g.phase === 'wave') eventWaves.set(g.wave, `${g.event.id} ${g.event.run}/${g.event.runs}`);
    }
    expect(g.phase).toBe('won');
    expect(restoredAt[0]).toBe(EVENT_WAVE);
    expect(Object.fromEntries(eventWaves)).toEqual({ 11: 'rush 1/3', 12: 'rush 2/3', 13: 'rush 3/3' });
    expect(g.wave).toBe(13);
    expect(g.lab!.waves).toBe(13);
    expect((g.lab!.stats.clean ?? 0) + (g.lab!.stats.held ?? 0) + (g.lab!.stats.broken ?? 0)).toBe(3);
    // Encounters run in waves 1-10 only: none in the ending.
    expect(g.enc!.played.length).toBeGreaterThan(0);
    expect(g.enc!.wave).toBeLessThanOrEqual(10);
    // The lab's own length never ends it early.
    expect(labWaves(g.lab!)).toBe(13);
    expect(labDone(g)).toBe(false);
  }, 120_000);

  it('a map with no event of its own would end at wave 10 (none today: every map has one)', () => {
    for (const id of MAP_ORDER) expect(EVENT_MAPS[id], id).toBeDefined();
    const g = createGame('kesh', 2, 1);
    applyLab(g, { card: 'map-kesh', plays: 'full' });
    g.wave = 10;
    expect(isEventWave(g)).toBe(false);
    g.wave = 11;
    expect(isEventWave(g)).toBe(true);
  });

  it('the lab bar reads "full map · wave 3/13"; Bring one is not there (and does nothing on a map card)', () => {
    const card = labCard('map-strait')!;
    expect(labCountText(card, { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] }, 2, 13, { plays: 'full', wave: 3 })).toBe('full map · wave 3/13');
    for (const c of LAB_CARDS.filter((o) => o.kind === 'map')) expect(labActions(c), c.id).toEqual(['note', 'setup', 'done']);
    expect(labActions(labCard('decoy')!)).toContain('bring');
    expect(labActions(labCard('ev-rush')!)).toContain('bring');
    const g = createGame('strait', 2, 1);
    applyLab(g, { card: 'map-strait', plays: 'full' });
    const before = JSON.stringify(g.queue);
    labBring(g);
    expect(JSON.stringify(g.queue)).toBe(before);
    const run = new BotRun('strait', 2, opts(fromHub('map-strait')));
    run.rec.bring();
    expect(run.rec.log.commands.some((c) => c[1] === 'b')).toBe(false);
  });

  it('the hub card says what it plays and how it opens', () => {
    expect(MAP_CARD_PLAYS).toBe('Full map: waves 1–10 and its event ending');
    expect(productionText('strait')).toBe('Commands: Rush and Disperse · authored encounters');
    expect(productionText('harbor')).toBe('Commands: Hold · authored encounters');
    expect(productionText('kesh')).toMatch(/^Today's convoy controls/);
  });
});

describe('the three reference maps open ready to test', () => {
  const want: Record<string, string> = { strait: 'rush,disperse', gauntlet: 'rush,disperse', harbor: 'hold' };

  it('from the hub: Commands (D) and authored encounters; the other 17: today\'s convoy, no encounters', () => {
    for (const id of MAP_ORDER) {
      const plan = fromHub(`map-${id}`);
      if (REF.includes(id)) {
        expect(plan.convoy, id).toMatchObject({ policy: 'tactical', obligation: 'natural' });
        expect(plan.encounters, id).toEqual({ rev: 1 });
        expect(plan.lab.config, id).toEqual({ convoy: 'tactical', encounters: 1, production: true });
        const g = new BotRun(id, 1, opts(plan)).game;
        expect(g.convoy!.def.commands.join(), id).toBe(want[id]);
      } else {
        expect(plan.convoy, id).toBeNull();
        expect(plan.encounters, id).toBeNull();
        expect(plan.lab.config, id).toEqual({ convoy: 'current', encounters: 0, production: true });
      }
      expect(mapProduction(id).convoy === 'tactical', id).toBe(REF.includes(id));
    }
  });

  it('from Next up: the same setup (Next up starts the card the same way)', () => {
    // Every card tested at its version but the three reference map cards.
    const p = parseLabProgress(null);
    const e = (rev: number): LabEntry => ({ verdict: 'keep', tags: [], note: '', waves: 1, ended: 'done', stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] }, at: '2026-11-13T07:00', rev, round: 10 });
    for (const c of LAB_CARDS) if (!REF.map((m) => `map-${m}`).includes(c.id)) p.results[c.id] = [e(99)];
    const next = nextCards(p, 3);
    expect(next.map((c) => c.id)).toEqual(['map-strait', 'map-gauntlet', 'map-harbor']);
    for (const c of next) {
      // The last setup played (a slice of another card) does not carry over.
      const plan = labRunPlan(c, defaultSetup(c, p, { wave: 9, weapons: [], length: 'quick', mix: 'heavy', convoy: 'auto', encounters: false, plays: 'slice' }));
      expect(plan.full, c.id).toBe(true);
      expect(plan.convoy?.policy, c.id).toBe('tactical');
      expect(plan.encounters, c.id).toEqual({ rev: 1 });
    }
  });

  it('from the bare link (v3.html?lab=map-strait): the same setup; a link can still ask for another, for comparison', () => {
    for (const map of REF) {
      const plan = fromHub(`map-${map}`, `lab=map-${map}`);
      expect(plan.full).toBe(true);
      expect(plan.convoy?.policy).toBe('tactical');
      expect(plan.encounters).toEqual({ rev: 1 });
    }
    const cmp = fromHub('map-strait', 'lab=map-strait&convoy=current&enc=0');
    expect(cmp.convoy).toBeNull();
    expect(cmp.encounters).toBeNull();
    expect(cmp.lab.config).toEqual({ convoy: 'current', encounters: 0, production: false });
    // The old link shape still works (and is now the production setup).
    expect(fromHub('map-strait', 'lab=map-strait&convoy=tactical&enc=1').lab.config?.production).toBe(true);
  });

  it('the setup sheet\'s production mark, and Reset to production setup', () => {
    const card = labCard('map-harbor')!;
    const prod = productionSetup(card);
    expect(isProduction(card, prod)).toBe(true);
    expect(isProduction(card, { ...prod, convoy: 'current' })).toBe(false);
    expect(isProduction(card, { ...prod, encounters: false })).toBe(false);
    expect(isProduction(card, { ...prod, plays: 'slice' })).toBe(false);
    expect(isProduction(labCard('map-kesh')!, productionSetup(labCard('map-kesh')!))).toBe(true);
    expect(isProduction(labCard('decoy')!, prod)).toBe(false);
  });
});

describe('the quick slice: the old short lab run, on the setup sheet', () => {
  it('starts at the lab start wave with the lab kit, mix and length, and says it is a slice', () => {
    const card = labCard('map-gauntlet')!;
    const plan = labRunPlan(card, { ...defaultSetup(card, parseLabProgress(null)), plays: 'slice', length: 'quick', mix: 'heavy' });
    expect(plan.full).toBe(false);
    expect(plan.lab).toEqual({ card: 'map-gauntlet', length: 'quick', mix: 'heavy', rev: 10, round: 10, plays: 'slice' });
    expect(plan.setup.wave).toBe(LAB_START_WAVE);
    expect(plan.setup.weapons.map((w) => w.id)).toEqual(card.kit);
    // Its production convoy and encounters stay on unless changed.
    expect(plan.convoy?.policy).toBe('tactical');
    const g = createGame('gauntlet', 3, LAB_START_WAVE);
    applyLab(g, plan.lab);
    expect(g.endless).toBe(true);
    expect(labWaves(g.lab!)).toBe(LAB_LENGTH.quick);
    expect(labCountText(card, g.lab!.stats, 0, 2, { plays: 'slice' })).toBe('quick slice · 1/2');
    // ?plays=slice on the link asks for one.
    expect(fromHub('map-strait', 'lab=map-strait&plays=slice').lab.plays).toBe('slice');
  });
});

describe('the log carries the setup, replays exactly, and the bridge reads it', () => {
  function played(map: MapId, seed: number, plan = fromHub(`map-${map}`), steps = 60 * 60 * 4): { run: BotRun; log: PlayLog } {
    const run = new BotRun(map, seed, opts(plan, { pilot: 'sharp' }));
    run.advance(steps);
    const log = run.finish();
    log.labResult = { verdict: 'keep', tags: [], note: 'good', waves: run.game.lab!.waves, ended: 'done', stats: run.game.lab!.stats, rev: 10, round: 10, plays: plan.lab.plays };
    return { run, log };
  }

  it('the log says it is a full production run, with its convoy policy and encounter revision, from wave 1 with no Free Play setup', () => {
    const { log } = played('strait', 3);
    expect(log.lab).toEqual({ card: 'map-strait', rev: 10, round: 10, plays: 'full', config: { convoy: 'tactical', encounters: 1, production: true } });
    expect(log.firstWave).toBe(1);
    expect(log.freePlay).toBeUndefined();
    expect(log.convoy).toMatchObject({ policy: 'tactical', obligation: 'natural', rev: 2 });
    expect(log.encounters).toEqual({ rev: 1 });
    expect(log.commands.some((c) => c[1] === 'k')).toBe(true);
    expect(logPlays(log)).toBe('full');
    expect(labSetupText(log)).toBe('Full map from wave 1 · D · Tactical commands · authored encounters rev 1 · production setup');
  });

  it('replay is exact: a full map run with commands and drafts plays back to the same game', () => {
    for (const [map, seed] of [['harbor', 2], ['kesh', 7]] as [MapId, number][]) {
      const { run, log } = played(map, seed);
      expect(run.game.wave, map).toBeGreaterThan(1);
      expect(log.commands.some((c) => c[1] === 'u'), map).toBe(true);
      const again = replay(log);
      expect(again.steps, map).toBe(run.game.steps);
      expect(again.score, map).toBe(run.game.score);
      expect(withoutLab(again), map).toBe(withoutLab(run.game));
      expect(again.lab, map).toEqual(run.game.lab);
      const tel = replay(log, { telemetry: true });
      expect(tel.tel!.sidecar(tel).header.lab, map).toMatchObject({ card: `map-${map}`, plays: 'full' });
    }
  }, 120_000);

  it('the bridge tells a full run from a quick slice (and a map card\'s log from before round 10 is a slice)', () => {
    const full = played('strait', 3, fromHub('map-strait'), 600).log;
    const slicePlan = fromHub('map-gauntlet', 'lab=map-gauntlet&plays=slice');
    // (A slice starts at the lab's start wave with its kit: the bot game
    // here only stands in for one.)
    const slice = { ...played('gauntlet', 3, slicePlan, 600).log, firstWave: LAB_START_WAVE };
    const old: PlayLog = { ...slice, id: 'old', lab: { card: 'map-kesh', length: 'full', mix: 'normal', rev: 1, round: 9 }, convoy: undefined, encounters: undefined };
    const docs = labResultDocs([full, slice, { ...old, labResult: { ...old.labResult!, round: 9, plays: undefined } }]).results;
    expect(docs['map-strait']).toMatchObject({ plays: 'full', setup: 'Full map from wave 1 · D · Tactical commands · authored encounters rev 1 · production setup' });
    expect(docs['map-strait'].evidence).toMatch(/^Full map: \d+ of 13 waves cleared/);
    expect(docs['map-gauntlet']).toMatchObject({ plays: 'slice', setup: `Quick slice from wave ${LAB_START_WAVE}, full length · D · Tactical commands · authored encounters rev 1` });
    expect(docs['map-gauntlet'].evidence).toMatch(/^Quick slice · /);
    expect(docs['map-kesh']).toMatchObject({ plays: 'slice', setup: `Quick slice from wave ${LAB_START_WAVE}, full length · C · Current controls · shared waves` });
    expect(docs.decoy).toBeUndefined();
    // Other cards' docs carry no setup.
    const other: PlayLog = { ...slice, id: 'x', lab: { card: 'decoy', length: 'full', mix: 'normal', rev: 9, round: 9 } };
    expect(labResultDocs([other]).results.decoy.plays).toBeUndefined();
  }, 60_000);

  it('evidence for a full run counts the map and its ending', () => {
    const card: LabCard = labCard('map-strait')!;
    const s = { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [], clean: 2, held: 1, broken: 0 };
    expect(evidenceLines(card, s, 13, 'full')).toEqual(['Full map: 13 of 13 waves cleared (the map cleared)', 'Its ending: Clean 2 · Held 1 · Broken 0']);
  });

  it('a lab setup without `plays` (every log before round 10) plays as it always did', () => {
    const setup: LabSetup = { card: 'map-coves', length: 'full', mix: 'normal' };
    const g = createGame('coves', 3, LAB_START_WAVE);
    applyLab(g, setup);
    expect(g.lab!.full).toBe(false);
    expect(g.endless).toBe(true);
    expect(labWaves(g.lab!)).toBe(LAB_LENGTH.full);
  });
});
