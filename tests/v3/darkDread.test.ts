// Log v67: the Black Strait and Blackout always dark (no Star Shell), and the
// Dreadnought's artillery on three gun turrets the player can shoot out.
import { describe, expect, it } from 'vitest';
import { BOSS, PICKUPS, THREATS, TURRET } from '../../src/v3/data/config';
import { DREAD_PASSES, ENCOUNTER_REV } from '../../src/v3/data/encounters';
import { eventDropWeights } from '../../src/v3/sim/events';
import { applyEncounters, createGame, damageThreat, launchBoss, step, timeToImpact, worthShooting, type Game } from '../../src/v3/sim/game';
import { PERSONAS, playMimic } from '../../src/v3/sim/mimic';

const DT = 1 / 60;
const VER = { rev: ENCOUNTER_REV, version: 'v1' as const };
const tough = (g: Game): Game => {
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = 999;
  return g;
};
const turrets = (g: Game) => g.threats.filter((t) => !t.dead && t.kind === 'turret');
const shells = (g: Game) => g.threats.filter((t) => t.kind === 'ballistic' && t.parent === 'dreadnought');

describe('always dark (log v67)', () => {
  it('no Star Shell drops on the Black Strait or in Blackout', () => {
    for (const map of ['lantern', 'battery'] as const) {
      const g = tough(createGame(map, 3, 5));
      let seen = 0;
      for (let i = 0; i < 90 / DT; i++) {
        step(g, DT);
        if (g.pickups.some((p) => p.kind === 'starshell')) seen++;
      }
      expect(seen, map).toBe(0);
    }
    const w: Record<string, number> = { starshell: 0, ammo: 10 };
    const g = createGame('battery', 1, 5);
    g.event = { id: 'blackout', rules: ['night'] } as never;
    eventDropWeights(g, w);
    expect(w.starshell).toBe(0);
    expect(PICKUPS.weights.starshell).toBe(0);
  });
});

describe('the Dreadnought\'s gun turrets (log v67, under the encounter layer)', () => {
  const pass = DREAD_PASSES[3];
  const sail = () => {
    const g = tough(createGame('dreadnought', 5, 3));
    applyEncounters(g, VER);
    return g;
  };

  it('a pass carries three turrets on its centre line, four hits each; the campaign\'s battleship has none', () => {
    const g = sail();
    const th = launchBoss(g, pass);
    expect(turrets(g)).toHaveLength(3);
    for (const t of turrets(g)) {
      expect(t.from).toBe(th.id);
      expect(t.hp).toBe(THREATS.turret.hp);
    }
    step(g, DT);
    // They ride the deck, in the hull's own frame.
    const t0 = turrets(g)[0];
    const lx = TURRET.slots[t0.slot!];
    expect(Math.hypot(t0.x - th.x, t0.y - th.y)).toBeCloseTo(Math.abs(lx), 0);
    const camp = tough(createGame('dreadnought', 5, 3));
    launchBoss(camp);
    expect(turrets(camp)).toHaveLength(0);
  });

  it('the artillery shells come off the turrets, one at a time; the silo launches the rest', () => {
    const g = sail();
    const th = launchBoss(g, { ...pass, first: 1, every: 4 });
    // Park it on screen, so its guns can fire.
    th.speed = 0;
    th.along = 600;
    let fired = 0;
    const by = new Set<number>();
    for (let i = 0; i < 40 / DT; i++) {
      const before = shells(g).length;
      step(g, DT);
      if (shells(g).length > before) fired++;
      for (const t of turrets(g)) if (t.shotT !== undefined) by.add(t.slot!);
    }
    expect(fired).toBeGreaterThan(2);
    expect(by.size).toBe(3);
    // The broadside's ballistic is not the hull's: the silo's launches are drones.
    expect(th.shotT).toBeDefined();
  });

  it('a turret shot out (four hits) fires no more, and the others go on; the ship sunk takes them all', () => {
    const g = sail();
    const th = launchBoss(g, { ...pass, first: 1, every: 4 });
    // Park it on screen, so its guns can fire.
    th.speed = 0;
    th.along = 600;
    const t0 = turrets(g)[0];
    for (let k = 0; k < 3; k++) damageThreat(g, t0, 1, true, 'gun');
    expect(t0.dead).toBe(false);
    damageThreat(g, t0, 1, true, 'gun');
    expect(t0.dead).toBe(true);
    expect(g.events.some((e) => e.kind === 'bigKill' && e.label === 'TURRET DOWN')).toBe(true);
    for (let i = 0; i < 30 / DT; i++) step(g, DT);
    expect(turrets(g).length).toBe(2);
    expect(turrets(g).every((t) => t.slot !== t0.slot)).toBe(true);
    // Sunk, the rest go with it.
    th.hp = 1;
    damageThreat(g, th, 3, true, 'gun');
    step(g, DT);
    expect(turrets(g)).toHaveLength(0);
  });

  it('a turret is worth a shot, and as urgent as its next shell is near', () => {
    const g = sail();
    launchBoss(g, { ...pass, first: 5, every: 8 });
    const t0 = turrets(g)[0];
    expect(worthShooting(g, g.threats).some((t) => t.id === t0.id)).toBe(true);
    t0.fireT = 2;
    expect(timeToImpact(g, t0)).toBe(5);
    expect(BOSS.every).toBeGreaterThan(0);
  });

  it('the bot plays a whole Dreadnought card with turrets, and a turret falls to it now and then', () => {
    const r = playMimic('dreadnought', 11, { persona: PERSONAS.you, encounters: VER });
    expect(r.game.steps).toBeGreaterThan(0);
    expect(r.game.kills.turret).toBeGreaterThan(0);
  }, 120_000);
});
