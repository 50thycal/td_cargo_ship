// Round 11, part B (docs/design/v3-round11-map-notes.md): the player's
// notes of 2026-11-13/14. The decoy drones out of the game (Kesh's event is
// the Drone Storm, The Breakout opens with plain drones, the decoy pairs
// and cards retired); Point Defense fires only at munitions, never at the
// aircraft; the Laser Cutter only cuts (a tap fires no shell); Focus's dial
// is its slow motion. The beacon audit is beaconAudit.test.ts.

import { describe, expect, it } from 'vitest';
import { FOE_KINDS, THREATS, type ThreatKind } from '../../src/v3/data/config';
import { WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { DEBUT_SLOTS, FOES, FOES_BUILT, FOE_ORDER, foesUpTo } from '../../src/v3/data/foes';
import { EV, EVENTS, EVENT_MAPS, EVENT_ORDER, EVENT_WAVE, eventMap } from '../../src/v3/data/events';
import { MAP_ORDER } from '../../src/v3/data/maps';
import { PAIRS } from '../../src/v3/data/pairs';
import { LAB_CARDS, LAB_RETIRED, LAB_ROUND, cardChanges, cardRev, labCard } from '../../src/v3/data/lab';
import { foeSetting, launchFoe, mapDebut, newFoeState } from '../../src/v3/sim/foes';
import {
  CARRIER_TARGET,
  SWIPE_HINT,
  applyFreePlay,
  createGame,
  isAircraftKind,
  isMunitionKind,
  press,
  pressMove,
  release,
  spawnThreat,
  step,
  tap,
  type Game,
} from '../../src/v3/sim/game';
import { Bot, SKILLS } from '../../src/v3/sim/bot';
import { labActions } from '../../src/v3/ui/lab';

const DT = 1 / 60;
const run = (g: Game, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds / DT) && g.phase === 'wave'; i++) {
    each?.();
    step(g, DT);
  }
};

function quietGame(map: Parameters<typeof createGame>[0] = 'strait', seed = 3): Game {
  const g = createGame(map, seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.threats = [];
  run(g, 12);
  g.threats = [];
  g.interceptors = [];
  g.tempo = { ...g.tempo, lossLimit: 999 };
  return g;
}

function load(g: Game, id: AbilityId, level = 1, hand: 'weapon' | 'weapon2' = 'weapon'): void {
  g.levels[id] = level;
  if (!g.slots.includes(id)) g.slots.push(id);
  g[hand] = { id, level, t: WEAPON.time, t0: g.t };
}

describe('the decoys are out of the game', () => {
  it('no decoy enemy, kind, card or pair anywhere a player can meet one', () => {
    expect(FOE_ORDER as string[]).not.toContain('decoy');
    expect(FOES_BUILT as string[]).not.toContain('decoy');
    expect(FOE_KINDS as string[]).not.toContain('decoy');
    expect('decoy' in THREATS).toBe(false);
    expect(JSON.stringify(PAIRS)).not.toMatch(/decoy/i);
    for (const c of LAB_CARDS) expect(`${c.id} ${c.name} ${c.look}`, c.id).not.toMatch(/decoy/i);
    for (const id of EVENT_ORDER) expect(`${EVENTS[id].name} ${EVENTS[id].look}`, id).not.toMatch(/decoy/i);
    // Free Play's enemy picker lists the built foes; an old saved "decoy"
    // setting falls back to the campaign's.
    expect(foeSetting('decoy')).toBe('campaign');
  });

  it('a campaign on any map, played by a bot, never launches a decoy', () => {
    for (const map of ['strait', 'kesh', 'harbor', 'island'] as const) {
      const g = createGame(map, 5, 1);
      const bot = new Bot(SKILLS.average, 5);
      const kinds = new Set<string>();
      for (let i = 0; i < 60 * 240 && g.phase !== 'lost' && g.phase !== 'won' && g.wave <= 6; i++) {
        if (g.phase === 'draft') bot.act(g);
        else bot.act(g);
        step(g, DT);
        for (const t of g.threats) kinds.add(t.kind);
      }
      expect([...kinds], map).not.toContain('decoy');
    }
  });

  it('the retired cards keep their verdicts (round 11, "decoys removed from the game"), off the hub', () => {
    const gone = LAB_RETIRED.filter((c) => c.cut === 11);
    expect(gone.map((c) => c.id)).toEqual(['decoy', 'ev-decoy-storm', 'combo-decoy-sprint', 'combo-decoy-cluster']);
    for (const c of gone) {
      expect(c.why).toBe('decoys removed from the game');
      expect(labCard(c.id), c.id).toBeUndefined();
    }
    expect(labCard('ev-drone-storm')).toBeDefined();
    expect(LAB_ROUND).toBeGreaterThanOrEqual(11);
  });
});

describe('chapter 1 debuts: Kesh has none for now; Marrow and The Gauntlet keep theirs', () => {
  it('The Strait the Sprint Drones, Kesh nothing new, Marrow the Hydra, The Gauntlet the Rocket Truck', () => {
    expect(DEBUT_SLOTS[1]).toEqual(['sprinter', null, 'hydra', 'rocketTruck']);
    expect(mapDebut('strait')).toBe('sprinter');
    expect(mapDebut('kesh')).toBeNull();
    expect(mapDebut('marrow')).toBe('hydra');
    expect(mapDebut('gauntlet')).toBe('rocketTruck');
    expect(mapDebut('harbor')).toBe('sprinter');
    // Kesh's waves lead with an enemy already met on The Strait.
    const k = newFoeState('kesh');
    expect(k.lead[k.cursor % k.lead.length]).toBe('sprinter');
    // The other chapters as before: the nth map, the nth new enemy.
    for (const id of MAP_ORDER.slice(5)) {
      const st = newFoeState(id);
      expect(mapDebut(id), id).toBe(st.lead[(MAP_ORDER.indexOf(id) % 5) % st.lead.length]);
    }
    expect(foesUpTo(1)).toEqual(['sprinter', 'hydra', 'rocketTruck']);
  });
});

describe('the Drone Storm (Kesh), in place of the Decoy Storm', () => {
  it('twelve plain drone swarms out of the drone bases in turn, half at the start, half later; no ammo drops', () => {
    expect(EVENT_MAPS.kesh).toBe('drone-storm');
    expect(EVENTS['drone-storm']).toMatchObject({ name: 'Drone Storm', rules: ['noAmmo'] });
    expect(EVENTS['drone-storm'].foe).toBeUndefined();
    expect(labCard('ev-drone-storm')!.foes).toEqual([]);
    // Its bar still has Run it again.
    expect(labActions(labCard('ev-drone-storm')!)).toContain('bring');
    const g = createGame(eventMap('drone-storm'), 2, EVENT_WAVE);
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = 999;
    g.event!.t0 = 0;
    const kinds = new Set<ThreatKind>();
    run(g, 30, () => g.threats.forEach((t) => kinds.add(t.kind)));
    const e = g.eventLog[0] ?? g.event!;
    expect(e.sent).toEqual({ drone: EV['drone-storm'].swarms * EV['drone-storm'].size });
    expect([...kinds].every((k) => k === 'drone' || !FOE_KINDS.includes(k) || k === 'dart')).toBe(true);
    expect(cardChanges('ev-drone-storm')).toEqual(['New event in place of the Decoy Storm (the decoys are gone): twelve plain drone swarms and no ammo drops']);
  });
});

describe('The Breakout opens with plain drone swarms', () => {
  it('built on the Sprint Drones, then the chapter\'s Hydras and trucks; its opening swarms all real drones', () => {
    expect(EVENTS.breakout.foe).toBe('sprinter');
    expect(EVENTS.breakout.also).toEqual(['hydra', 'rocketTruck']);
    expect(labCard('ev-breakout')!.foes).toEqual(['sprinter', 'hydra', 'rocketTruck']);
    // (Round 12's fixes: its trucks sooner and more, driving off at normal speed.)
    expect(cardRev('ev-breakout')).toBe(12);
  });
});

describe('Point Defense: munitions only, never the aircraft', () => {
  it('what counts: missiles, bombs, bomblets, rockets, drones, torpedoes; never a plane, helicopter, dive bomber, Spotter or mothership', () => {
    for (const k of ['guided', 'ballistic', 'supersonic', 'heavy', 'cluster', 'bomblet', 'drone', 'minidrone', 'heliRocket', 'hydra', 'dart', 'torpedo', 'cloud', 'sprinter', 'armored'] as ThreatKind[]) expect(isMunitionKind(k), k).toBe(true);
    for (const k of ['strafer', 'bomber', 'stealthJet', 'stealthBomber', 'attackHeli', 'diveBomber', 'spotter', 'mothership'] as ThreatKind[]) {
      expect(isAircraftKind(k), k).toBe(true);
      expect(isMunitionKind(k), k).toBe(false);
    }
    // Nor a launcher or a support.
    for (const k of ['rocketTruck', 'siege', 'torpedoSub', 'tender', 'guard', 'lure', 'scavenger'] as ThreatKind[]) expect(isMunitionKind(k), k).toBe(false);
  });

  /** An aircraft parked over a ship, aimed at it, and a missile at it. */
  it('a ship\'s interceptors go for the bomber\'s missile, never the bomber above it; the carrier\'s (MAX) the same', () => {
    for (const level of [1, 3]) {
      const g = quietGame();
      load(g, 'aegis', level);
      const s = g.ships[0];
      const planes = (['bomber', 'strafer', 'stealthBomber', 'stealthJet'] as ThreatKind[]).map((k, i) => {
        const p = spawnThreat(g, k, s.x + 30 * (i - 1.5), s.y - 40, 'air');
        p.target = s.id;
        p.speed = 0;
        p.hits = [];
        p.bombs = 0;
        return p;
      });
      const c = g.map.carrier;
      const overCarrier = spawnThreat(g, 'bomber', c.x + 20, c.y - 40, 'air');
      overCarrier.target = CARRIER_TARGET;
      overCarrier.speed = 0;
      overCarrier.hits = [];
      overCarrier.bombs = 0;
      step(g, DT);
      const shotAt = new Set(g.interceptors.filter((i) => i.by === 'aegis').map((i) => i.target));
      for (const p of [...planes, overCarrier]) expect(shotAt.has(p.id), `L${level} ${p.kind}`).toBe(false);
      // Its missile: shot at.
      const m = spawnThreat(g, 'guided', s.x + 60, s.y - 60, 'air');
      m.target = s.id;
      m.parent = 'bomber';
      m.speed = 0;
      step(g, DT);
      expect(g.interceptors.some((i) => i.by === 'aegis' && i.target === m.id), `L${level}`).toBe(true);
    }
  });

  it('a real bomber run over the convoy: its missiles are shot at, the bomber never is', () => {
    const g = quietGame('strait', 4);
    load(g, 'aegis', 3);
    g.queue = [{ at: g.waveT, kind: 'bomber', base: -1 }, { at: 1e9, kind: 'drone', base: 0 }];
    const aimed = new Map<number, ThreatKind>();
    run(g, 14, () => {
      for (const i of g.interceptors) if (i.by === 'aegis' && i.target !== null) aimed.set(i.target, g.threats.find((t) => t.id === i.target)?.kind ?? 'drone');
      g.weapon!.t = WEAPON.time;
    });
    const kinds = [...aimed.values()];
    expect(kinds).toContain('guided');
    expect(kinds.some((k) => isAircraftKind(k))).toBe(false);
  });

  it('the helicopter, the Spotter: never shot at, their missiles are', () => {
    const g = quietGame('strait', 6);
    load(g, 'aegis', 3);
    launchFoe(g, { at: 0, kind: 'attackHeli', base: -1 });
    launchFoe(g, { at: 0, kind: 'spotter', base: -1 });
    const aimed: ThreatKind[] = [];
    run(g, 20, () => {
      for (const t of g.threats) if (t.kind === 'attackHeli' || t.kind === 'spotter') {
        // Keep them over the convoy, in every interceptor's reach.
        t.x = g.ships[0]?.x ?? t.x;
        t.y = (g.ships[0]?.y ?? t.y) - 50;
      }
      for (const i of g.interceptors) if (i.by === 'aegis' && i.life === 0) aimed.push(g.threats.find((t) => t.id === i.target)?.kind ?? 'drone');
      g.weapon!.t = WEAPON.time;
    });
    expect(aimed).not.toContain('attackHeli');
    expect(aimed).not.toContain('spotter');
  });
});

describe('Laser Cutter: only the cut', () => {
  it('a tap (a press let go before it is a swipe) fires no shell, spends no round, and says to swipe', () => {
    const g = quietGame();
    load(g, 'cutter');
    const d = spawnThreat(g, 'drone', 700, 300, 'base');
    d.speed = 0;
    const ammo = g.ammo;
    const n = g.interceptors.length;
    press(g, d.x, d.y, 30);
    expect(release(g, d.x, d.y, 30)).toBe('empty');
    expect(g.interceptors.length).toBe(n);
    expect(g.ammo).toBe(ammo);
    expect(g.fx.filter((f) => f.kind === 'text' && f.text === SWIPE_HINT)).toHaveLength(1);
    // A second tap: still one hint, not a pile of them.
    tap(g, d.x, d.y, 30);
    expect(g.fx.filter((f) => f.kind === 'text' && f.text === SWIPE_HINT)).toHaveLength(1);
    expect(g.interceptors.length).toBe(n);
    run(g, 1);
    expect(d.dead).toBe(false);
    // A swipe cuts.
    press(g, d.x - 100, d.y, 30);
    for (let k = 1; k <= 8; k++) pressMove(g, d.x - 100 + k * 25, d.y);
    release(g, d.x + 100, d.y, 30);
    expect(d.dead).toBe(true);
    expect(g.ammo).toBe(ammo - 1);
    expect(g.interceptors.length).toBe(n);
  });

  it('a pickup under the finger is still taken', () => {
    const g = quietGame();
    load(g, 'cutter');
    g.pickups.push({ id: g.nextId++, kind: 'ammo', x: 500, y: 500, age: 0 });
    press(g, 500, 500, 30);
    expect(release(g, 500, 500, 30)).toBe('pickup');
  });

  it('with Hyper Overdrive: a tap still fires nothing', () => {
    const g = quietGame();
    load(g, 'cutter');
    g.levels.overdrive = 3;
    g.slots.push('overdrive');
    g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: 'overdrive', x: 300, y: 650, age: 0 });
    expect(tap(g, 300, 650, 30)).toBe('pickup');
    expect(g.boost?.id).toBe('overdrive');
    const d = spawnThreat(g, 'drone', 700, 300, 'base');
    d.speed = 0;
    press(g, d.x, d.y, 30);
    expect(release(g, d.x, d.y, 30)).toBe('empty');
    expect(g.interceptors).toHaveLength(0);
  });

  it('under Dual Wield the other hand fires its own shot; the Cutter adds none', () => {
    const g = quietGame();
    load(g, 'cutter');
    load(g, 'railgun', 1, 'weapon2');
    const d = spawnThreat(g, 'drone', 700, 300, 'base');
    d.speed = 0;
    d.hp = 5;
    const fx0 = g.fx.filter((f) => f.kind === 'beam').length;
    press(g, d.x, d.y, 30);
    expect(release(g, d.x, d.y, 30)).toBe('fire');
    // The railgun's beam, and no plain shell.
    expect(g.fx.filter((f) => f.kind === 'beam').length).toBeGreaterThan(fx0);
    expect(g.interceptors).toHaveLength(0);
  });

  it('the bots swipe with it, and a missed tap fires nothing either', () => {
    const g = createGame('strait', 9, 3);
    applyFreePlay(g, { weapons: [{ id: 'cutter', level: 2 }], frequentDrops: false });
    const bot = new Bot(SKILLS.casual, 9);
    let cuts = 0;
    for (let i = 0; i < 60 * 40 && g.phase === 'wave'; i++) {
      if (g.weapon?.id !== 'cutter') load(g, 'cutter', 2);
      g.weapon!.t = WEAPON.time;
      bot.act(g);
      step(g, DT);
      expect(g.interceptors.filter((it) => it.tap && it.src === 'gun')).toHaveLength(0);
      cuts = g.taps.fire;
    }
    expect(cuts).toBeGreaterThan(0);
  });
});

describe('the Test Lab lines (round 11, part B)', () => {
  it('every changed card has one plain line for round 11', () => {
    for (const id of ['ev-drone-storm', 'ev-breakout', 'map-kesh', 'map-harbor', 'w-aegis', 'w-cutter', 'w-focus', 'lure', 'ev-beacon-strike']) {
      // (Harbor Mouth changed again in round 12: its encounter versions; the
      // Breakout in round 12's fixes.)
      expect(cardRev(id), id).toBe(id === 'map-harbor' || id === 'ev-breakout' ? 12 : 11);
      // (Harbor Mouth also has part A's two round 11 lines.)
      expect(cardChanges(id, 10).length - cardChanges(id, 11).length, id).toBe(id === 'map-harbor' ? 3 : 1);
    }
    // A combo with the beacon takes its line on.
    expect(cardChanges('combo-lure-stealth', 10)[0]).toMatch(/^Lure Beacon: /);
    expect(FOES.lure.blurb).not.toMatch(/taps/);
  });
});
