// The Citadel of Vey, rebuilt to the map and wave rules (log v60,
// docs/design/v3-ch4-citadel.md): the shield rises again every wave, the
// generators and the Citadel count shots, the Citadel's fire under its dome
// can't be shot while the shield stands (the signature), a silenced
// Citadel's fire comes off the far silos, and the Last Stand is its boss.
// Lab only, under the encounter layer: the campaign plays the map as before.
import { describe, expect, it } from 'vitest';
import { CITADEL } from '../../src/v3/data/config';
import { ENCOUNTER_REV, MAP_BOSS, MAP_SIGNATURE, encountersFor, signatureOf, shieldRisesOn, shotRigsOn, swapFoe } from '../../src/v3/data/encounters';
import { eventName } from '../../src/v3/data/events';
import { MAPS } from '../../src/v3/data/maps';
import { applyEncounters, createGame, damageThreat, domed, pickUpgrade, raiseShield, rigStandIn, shieldUp, spawnThreat, step, worthShooting, type Game, type Threat } from '../../src/v3/sim/game';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';

const DT = 1 / 60;
const VER = { rev: ENCOUNTER_REV, version: 'v1' as const };
/** The Last Stand's test seed (tools/v3/citadel/probe-boss.ts): the tryhard
 *  bot plays all three rounds there. */
const BOSS_SEED = 230;

const tough = (g: Game): Game => {
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  return g;
};
const layer = (seed: number, wave: number): Game => {
  const g = createGame('citadel', seed, wave);
  applyEncounters(g, VER);
  return tough(g);
};
const gens = (g: Game) => g.threats.filter((t) => !t.dead && t.kind === 'generator');
const keep = (g: Game) => g.threats.find((t) => !t.dead && t.kind === 'citadel');
/** Shoot a structure down a shot at a time (each shot one, whatever it does). */
const shootDown = (g: Game, th: Threat) => {
  for (let k = 0; k < 100 && !th.dead; k++) damageThreat(g, th, 3, true, 'gun');
};
const nextWave = (g: Game) => {
  const w = g.wave;
  for (let i = 0; i < 400 / DT && g.wave === w; i++) {
    // Between waves: take the draft's first card.
    if (g.phase === 'draft' && g.offer.length) pickUpgrade(g, g.offer[0]);
    step(g, DT);
  }
  expect(g.wave).toBe(w + 1);
};

describe('the Citadel (log v60): the shield and the Citadel under the layer', () => {
  it('the generators and the Citadel count shots, the Citadel only once the shield is down', () => {
    expect(shotRigsOn('citadel', VER)).toBe(true);
    expect(shieldRisesOn('citadel', VER)).toBe(true);
    expect(shieldRisesOn('citadel', { rev: 3 })).toBe(false);
    expect(shieldRisesOn('citadel', { ...VER, only: [] })).toBe(false);
    const g = layer(1, 2);
    expect(gens(g).map((t) => t.hp)).toEqual([CITADEL.generator, CITADEL.generator, CITADEL.generator]);
    const c = keep(g)!;
    expect(c.hp).toBe(CITADEL.citadel);
    // A big hit is one shot.
    const g0 = gens(g)[0];
    damageThreat(g, g0, 8, true, 'gun');
    expect(g0.hp).toBe(CITADEL.generator - 1);
    // Shielded, the Citadel takes nothing.
    damageThreat(g, c, 5, true, 'gun');
    expect(c.hp).toBe(CITADEL.citadel);
    for (const t of gens(g)) shootDown(g, t);
    expect(shieldUp(g)).toBe(false);
    damageThreat(g, c, 5, true, 'gun');
    expect(c.hp).toBe(CITADEL.citadel - 1);
    // The campaign: 10 hits of damage a generator, 40 the Citadel.
    const camp = tough(createGame('citadel', 1, 2));
    expect(gens(camp).map((t) => t.hp)).toEqual([10, 10, 10]);
    damageThreat(camp, gens(camp)[0], 3, true, 'gun');
    expect(gens(camp)[0].hp).toBe(7);
  });

  it('the shield rises again at the next wave until the Citadel falls; once destroyed it stays down for the waves (log v67); in the campaign they stay down', () => {
    const g = layer(1, 2);
    // Generators down only: they stand again next wave, the Citadel keeps what it has.
    for (const t of gens(g)) shootDown(g, t);
    damageThreat(g, keep(g)!, 3, true, 'gun');
    expect(keep(g)!.hp).toBe(CITADEL.citadel - 1);
    nextWave(g);
    expect(shieldUp(g)).toBe(true);
    expect(gens(g).map((t) => t.hp)).toEqual([CITADEL.generator, CITADEL.generator, CITADEL.generator]);
    expect(keep(g)?.hp).toBe(CITADEL.citadel - 1);
    // Destroyed: it and its generators stay down for every wave after.
    for (const t of gens(g)) shootDown(g, t);
    shootDown(g, keep(g)!);
    expect(shieldUp(g)).toBe(false);
    expect(keep(g)).toBeUndefined();
    expect(g.baseDown[0]).toBe(true);
    expect(g.cit.fellAt).toBeGreaterThanOrEqual(0);
    nextWave(g);
    expect(shieldUp(g)).toBe(false);
    expect(gens(g)).toEqual([]);
    expect(keep(g)).toBeUndefined();
    expect(g.baseDown.slice(0, 4)).toEqual([true, true, true, true]);
    nextWave(g);
    expect(keep(g)).toBeUndefined();
    const camp = tough(createGame('citadel', 1, 2));
    for (const t of gens(camp)) shootDown(camp, t);
    nextWave(camp);
    expect(shieldUp(camp)).toBe(false);
    expect(gens(camp)).toEqual([]);
  }, 90_000);

  it('the Citadel is rebuilt for the boss: the Last Stand raises the shield and mans a fallen Citadel again, with the round\'s numbers', () => {
    const g = layer(1, 2);
    for (const t of gens(g)) shootDown(g, t);
    shootDown(g, keep(g)!);
    expect(keep(g)).toBeUndefined();
    raiseShield(g, 3, 12);
    expect(g.cit.domeUpAt).toBe(g.t);
    expect(shieldUp(g)).toBe(true);
    expect(keep(g)?.hp).toBe(12);
    // A keep still up is brought down to the round's numbers.
    const h = layer(2, 2);
    expect(keep(h)!.hp).toBe(CITADEL.citadel);
    raiseShield(h, 4, 14);
    expect(keep(h)!.hp).toBe(14);
    expect(keep(h)!.maxHp).toBe(14);
  });

  it('a silenced Citadel\'s fire comes off the far silos, not under the dome', () => {
    const g = layer(3, 4);
    for (const t of gens(g)) shootDown(g, t);
    shootDown(g, keep(g)!);
    expect([4, 5]).toContain(rigStandIn(g, 0));
    expect(g.queue.filter((l) => l.base === 0 && l.at < 1e8 && l.at > g.waveT).length).toBeGreaterThan(0);
    const id0 = g.nextId;
    const core = MAPS.citadel.bases[0];
    const seen = new Map<number, Threat>();
    for (let i = 0; i < 90 / DT && g.wave === 4; i++) {
      step(g, DT);
      for (const t of g.threats) if (t.id >= id0 && g.wave === 4) seen.set(t.id, t);
    }
    const launched = [...seen.values()].filter((t) => t.kind !== 'citadel' && t.kind !== 'generator');
    expect(launched.length).toBeGreaterThan(0);
    for (const t of launched) {
      expect(t.dome ?? false).toBe(false);
      expect(t.sx === core.x && t.sy === core.y, t.kind).toBe(false);
    }
  }, 60_000);
});

describe('the Citadel\'s signature (log v60, MAP_SIGNATURE `dome`): fire under the dome', () => {
  it('from wave 4 so many of the wave\'s own launches come off the Citadel under its dome; none before, none in the campaign or the shared wave', () => {
    expect(MAP_SIGNATURE.citadel).toMatchObject({ from: 4 });
    expect(signatureOf('citadel', 3, VER)).toBeUndefined();
    expect(signatureOf('citadel', 4, { rev: 3 })).toBeUndefined();
    expect(signatureOf('citadel', 4, { ...VER, only: [] })).toBeUndefined();
    for (let w = 1; w <= 10; w++)
      for (const seed of [1, 2, 3]) {
        const on = layer(seed, w);
        const own = on.queue.filter((l) => l.dome && !l.enc && l.at < 1e8);
        const want = w >= 4 ? MAP_SIGNATURE.citadel!.dome![w - 4] : 0;
        expect(own.length, `wave ${w} seed ${seed}`).toBeLessThanOrEqual(want);
        if (w >= 4) expect(own.length, `wave ${w} seed ${seed}`).toBeGreaterThan(0);
        for (const l of own) {
          expect(l.base).toBe(0);
          expect(['guided', 'ballistic']).toContain(l.kind);
        }
        const shared = createGame('citadel', seed, w);
        applyEncounters(shared, { ...VER, only: [] });
        const camp = createGame('citadel', seed, w);
        for (const g of [shared, camp]) expect(g.queue.filter((l) => l.dome).length, `wave ${w}`).toBe(0);
      }
    // The encounters' own: the signature's first wave and the climax.
    expect(encountersFor('citadel', 4)[0].beats.some((b) => b.dome && b.from && 'base' in b.from && b.from.base === 0)).toBe(true);
    expect(encountersFor('citadel', 10)[0].beats.filter((b) => b.dome).reduce((a, b) => a + b.count, 0)).toBeGreaterThanOrEqual(3);
  });

  it('a missile under the dome can\'t be shot while the shield stands, nor is it worth a shot; out of the dome, or with the shield down, it can', () => {
    const g = layer(1, 4);
    const core = MAPS.citadel.bases[0];
    const m = spawnThreat(g, 'guided', core.x, core.y + 20, 'base');
    m.dome = true;
    expect(domed(g, m)).toBe(true);
    damageThreat(g, m, 5, true, 'gun');
    expect(m.dead).toBe(false);
    expect(m.hp).toBe(2);
    expect(worthShooting(g, g.threats)).not.toContain(m);
    // Out of the dome: an ordinary missile.
    m.y = core.y + MAPS.citadel.shield!.r + 10;
    expect(domed(g, m)).toBe(false);
    expect(worthShooting(g, g.threats)).toContain(m);
    // Back inside, with the shield down.
    m.y = core.y + 20;
    for (const t of gens(g)) shootDown(g, t);
    expect(domed(g, m)).toBe(false);
    damageThreat(g, m, 5, true, 'gun');
    expect(m.dead).toBe(true);
    // Fire with no `dome` (the Citadel's own on waves 1-3) is shot as anywhere.
    const g2 = layer(1, 4);
    const plain = spawnThreat(g2, 'guided', core.x, core.y + 20, 'base');
    damageThreat(g2, plain, 5, true, 'gun');
    expect(plain.dead).toBe(true);
  });

  it('on waves 2-6 the planner\'s Bodyguard Ring comes as a Lure Beacon (its heavy would come off the keep); from wave 7, and in the campaign, as drawn', () => {
    for (const w of [2, 3, 4, 5, 6]) expect(swapFoe('citadel', w, 'bodyguard', VER)).toBe('lure');
    expect(swapFoe('citadel', 7, 'bodyguard', VER)).toBe('bodyguard');
    expect(swapFoe('citadel', 3, 'bodyguard', { rev: 3 })).toBe('bodyguard');
    expect(swapFoe('citadel', 3, 'bodyguard', { ...VER, only: [] })).toBe('bodyguard');
    expect(swapFoe('citadel', 3, 'tender', VER)).toBe('tender');
  });
});

describe('the Citadel\'s boss (log v60, MAP_BOSS): the Last Stand; a rev 3 log and the campaign play the Siege of Vey as it was', () => {
  const opts = { persona: PERSONAS.tryhard, armory: { warhead: 3 }, firstWave: 11 };
  it('the shield rises and the Citadel fires grand salvos under its dome, more each round; no repair yard, guarded heavy or lure beacons', () => {
    const off = playMimic('citadel', BOSS_SEED, opts);
    const old = playMimic('citadel', BOSS_SEED, { ...opts, encounters: { rev: 3, version: 'v1' } });
    expect(old.game.eventLog).toEqual(off.game.eventLog);
    expect(old.log.commands).toEqual(off.log.commands);
    for (const e of off.game.eventLog) {
      expect(e.id).toBe('siege-of-vey');
      expect(e.sent.tender ?? 0).toBeGreaterThan(0);
    }
    const on = playMimic('citadel', BOSS_SEED, { ...opts, encounters: VER });
    expect(on.game.eventLog.map((e) => [e.id, e.run])).toEqual([['siege-of-vey', 1], ['siege-of-vey', 2], ['siege-of-vey', 3]]);
    for (const e of on.game.eventLog) {
      for (const k of ['tender', 'guard', 'lure', 'cloud', 'mothership'] as const) expect(e.sent[k] ?? 0, `round ${e.run}: ${k}`).toBe(0);
      expect((e.sent.guided ?? 0) + (e.sent.ballistic ?? 0), `round ${e.run}`).toBeGreaterThanOrEqual(3);
      expect(e.seconds, `round ${e.run}`).toBeGreaterThanOrEqual(15);
      expect(e.seconds, `round ${e.run}`).toBeLessThanOrEqual(30);
    }
    const rounds = MAP_BOSS.citadel!.rounds!;
    const salvo = (r: (typeof rounds)[number]) => r.citadel!.salvos * r.citadel!.size;
    const fire = (r: (typeof rounds)[number]) => (r.fire ?? []).reduce((a, f) => a + (f.count ?? 1), 0);
    for (let k = 1; k < rounds.length; k++) {
      expect(salvo(rounds[k]), `round ${k + 1}`).toBeGreaterThanOrEqual(salvo(rounds[k - 1]));
      expect(fire(rounds[k]), `round ${k + 1}`).toBeGreaterThan(fire(rounds[k - 1]));
      expect(rounds[k].citadel!.gen, `round ${k + 1}`).toBeGreaterThanOrEqual(rounds[k - 1].citadel!.gen);
    }
    for (const r of rounds) {
      expect(r.citadel!.warn, 'warned at least 2.5 s ahead (m-reads)').toBeGreaterThanOrEqual(2.5);
      expect(r.citadel!.first).toBeGreaterThanOrEqual(r.citadel!.warn);
    }
    expect(eventName('siege-of-vey', 'citadel', ENCOUNTER_REV)).toBe('The Last Stand');
    expect(eventName('siege-of-vey', 'citadel', 3)).toBe('Siege of Vey');
    expect(eventName('siege-of-vey', 'citadel')).toBe('Siege of Vey');
  }, 180_000);

  it('a round raises the shield and lights the keep before each salvo; the salvo leaves the keep under the dome', () => {
    const g = createGame('citadel', 3, 11);
    applyEncounters(g, VER);
    tough(g);
    for (const t of gens(g)) shootDown(g, t);
    expect(shieldUp(g)).toBe(false);
    for (let i = 0; i < 40 / DT && !g.event; i++) step(g, DT);
    expect(g.event?.id).toBe('siege-of-vey');
    let lit = false;
    let domedSeen = 0;
    for (let i = 0; i < 40 / DT && !domedSeen; i++) {
      step(g, DT);
      lit ||= g.fx.some((f) => f.kind === 'text' && f.text === 'GRAND SALVO');
      domedSeen = g.threats.filter((t) => t.dome && !t.dead).length;
    }
    expect(shieldUp(g)).toBe(true);
    expect(lit).toBe(true);
    expect(domedSeen).toBeGreaterThan(0);
  }, 60_000);
});
