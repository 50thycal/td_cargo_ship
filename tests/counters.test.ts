// Counter-boundary tests: the deterministic guarantees the player-counter
// design rests on. Each weapon family may engage exactly its declared threat
// kinds (docs/PLAYER_COUNTERS.md → coverage matrix); detection gates clearing;
// automation is independent of and subordinate to manual control; the same
// stat tier always means the same number; and old saves migrate whole.
//
// Threats whose ENEMY-side implementation has not landed yet (boats,
// artillery, aircraft) are injected directly into TransitState — that
// exercises the player-side compatibility layer without inventing any enemy
// behavior. Torpedoes are injected here too, but only to pin the compatibility
// boundaries in isolation; the live branch is exercised end to end in
// tests/torpedoes.test.ts.

import { describe, expect, it } from 'vitest';
import {
  createRoundTransit,
  newCampaign,
  newDevCampaign,
  planCurrentRound,
  resolveTransit,
  setProtectedChannels,
} from '../src/sim/campaign';
import { stepTransit, deriveEffects } from '../src/sim/transit';
import { migrateCampaign } from '../src/platform/save';
import {
  canEngage,
  deriveCounterEffects,
  RESEARCH_INDEX,
  WEAPON_TARGETS,
  COUNTER_BRANCHES,
  effectiveResearch,
} from '../src/data/counters';
import { STAT_TIERS, tierValue, TIER_ORDER } from '../src/data/statTiers';
import { WORLD } from '../src/data/tuning';
import type {
  CampaignState,
  EnemyInstallation,
  Threat,
  ThreatKind,
  TransitCommand,
  TransitState,
} from '../src/sim/types';

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** A quiet transit: no enemy plan, no ships spawning noise removed — threats
 *  are injected per test. */
function quietTransit(mutate?: (c: CampaignState) => void): {
  c: CampaignState;
  state: TransitState;
  rng: ReturnType<typeof createRoundTransit>['rng'];
} {
  const c = newCampaign('counter-bounds');
  mutate?.(c);
  const { state, rng } = createRoundTransit(c, planCurrentRound(c));
  state.spawnQueue = [];
  state.threats = [];
  return { c, state, rng };
}

let injectId = 900_000;
function inject(state: TransitState, kind: ThreatKind, over: Partial<Threat> = {}): Threat {
  const threat: Threat = {
    id: injectId++,
    kind,
    x: 900,
    y: WORLD.lanes[0],
    vx: 0,
    vy: 0,
    speed: 0,
    alive: true,
    revealed: true,
    lowSig: false,
    claimedByInterceptor: false,
    // Unguided missiles need a far-away aim point so they never self-resolve.
    ...(kind === 'missile' ? { targetX: 4000, targetY: WORLD.lanes[0] } : {}),
    ...over,
  };
  state.threats.push(threat);
  return threat;
}

function injectArtillery(state: TransitState, over: Partial<EnemyInstallation> = {}): EnemyInstallation {
  const pos: EnemyInstallation = {
    id: injectId++,
    kind: 'artillery',
    x: 900,
    y: 70,
    variant: 'coastalGun',
    suppressedUntil: 0,
    strikes: 0,
    destroyed: false,
    ...over,
  };
  state.installations.push(pos);
  return pos;
}

function step(state: TransitState, rng: ReturnType<typeof createRoundTransit>['rng'], cmds: TransitCommand[] = [], ticks = 1): void {
  stepTransit(state, cmds, rng);
  for (let i = 1; i < ticks; i++) stepTransit(state, [], rng);
}

// ---------------------------------------------------------------------------
// 1–4: missile interceptors engage missiles, and nothing else
// ---------------------------------------------------------------------------

describe('interceptor target compatibility', () => {
  const rejects = (kind: ThreatKind) => {
    const { state, rng } = quietTransit();
    const threat = inject(state, kind);
    const ammo0 = state.ammo;
    step(state, rng, [{ type: 'intercept', threatId: threat.id }]);
    expect(state.interceptors).toHaveLength(0);
    expect(state.ammo).toBe(ammo0);
    expect(state.events.some((e) => e.type === 'launchFailed')).toBe(true);
  };

  it('cannot target torpedoes', () => rejects('torpedo'));
  it('cannot target mines', () => rejects('mine'));
  it('cannot target attack boats', () => rejects('attackBoat'));

  it('cannot target artillery positions (only counter-battery can)', () => {
    const { state, rng } = quietTransit((c) => {
      c.baseModules = ['counterBattery'];
      c.completedResearch = ['counterBattery.base'];
    });
    const pos = injectArtillery(state);
    const ammo0 = state.ammo;
    // An installation is not a threat: an intercept aimed at its id is a no-op.
    step(state, rng, [{ type: 'intercept', threatId: pos.id }]);
    expect(state.interceptors).toHaveLength(0);
    expect(state.ammo).toBe(ammo0);
    // The dedicated system CAN engage it (a few tries — accuracy is a roll).
    for (let k = 0; k < 6 && pos.suppressedUntil <= 0; k++) {
      step(state, rng, [{ type: 'counterBattery', installationId: pos.id }], 130);
    }
    expect(pos.suppressedUntil).toBeGreaterThan(0);
  });

  it('still engages missiles (its home branch)', () => {
    const { state, rng } = quietTransit();
    const threat = inject(state, 'missile');
    step(state, rng, [{ type: 'intercept', threatId: threat.id }]);
    expect(state.interceptors.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 5: deck guns engage boats only
// ---------------------------------------------------------------------------

describe('deck gun target compatibility', () => {
  it('cannot target missiles or torpedoes', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['deckGun'];
      c.completedResearch = ['deckGun.base'];
    });
    const escort = state.escorts[0];
    const missile = inject(state, 'missile', { x: escort.x + 100, y: escort.y });
    const torpedo = inject(state, 'torpedo', { x: escort.x + 120, y: escort.y });
    step(state, rng, [
      { type: 'engageBoat', threatId: missile.id },
      { type: 'engageBoat', threatId: torpedo.id },
    ]);
    expect(state.escorts[0].gunTargetId).toBeNull();
    expect(
      state.events.filter((e) => e.type === 'launchFailed' && e.detail?.includes('Deck guns')).length,
    ).toBe(2);
  });

  it('sustains fire on a boat until it sinks (persistent HP target, no one-tap kill)', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['deckGun'];
      c.completedResearch = ['deckGun.base'];
    });
    const escort = state.escorts[0];
    escort.stationed = true; // hold position so range stays stable
    const boat = inject(state, 'attackBoat', {
      x: escort.x + 150,
      y: escort.y,
      hp: 36,
      maxHp: 36,
      boatVariant: 'smallArms',
    });
    step(state, rng, [{ type: 'engageBoat', threatId: boat.id }]);
    expect(escort.gunTargetId).toBe(boat.id);
    // One round cannot sink it (damage Medium=12 vs 36 hp).
    expect(boat.alive).toBe(true);
    step(state, rng, [], 30 * 25);
    expect(boat.alive).toBe(false);
    expect(state.stats.counter.deckGunKills).toBe(1);
    expect(state.stats.counter.deckGunRounds).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 6: depth charges destroy torpedoes only
// ---------------------------------------------------------------------------

describe('depth-charge target compatibility', () => {
  it('the blast destroys torpedoes but never missiles, boats, or mines', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['depthCharges'];
      c.completedResearch = ['depthCharges.base'];
    });
    const escort = state.escorts[0];
    escort.stationed = true;
    const px = escort.x + 200;
    const py = escort.y;
    const torpedo = inject(state, 'torpedo', { x: px, y: py });
    const missile = inject(state, 'missile', { x: px + 20, y: py });
    const boat = inject(state, 'attackBoat', { x: px - 20, y: py, hp: 30, maxHp: 30 });
    const mine = inject(state, 'mine', { x: px, y: py + 25 });
    step(state, rng, [{ type: 'depthCharge', x: px, y: py }]);
    expect(state.depthChargeShots.length).toBeGreaterThan(0);
    step(state, rng, [], 30 * 6); // charge flies out and detonates
    expect(torpedo.alive).toBe(false);
    expect(missile.alive).toBe(true);
    expect(boat.alive).toBe(true);
    expect(mine.alive).toBe(true);
    expect(state.stats.counter.depthChargeKills).toBe(1);
  });

  it('is placed at a water point and respects the per-round magazine', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['depthCharges'];
      c.completedResearch = ['depthCharges.base'];
    });
    const escort = state.escorts[0];
    escort.stationed = true;
    expect(escort.dcShots).toBe(1); // base magazine: one launch per round
    step(state, rng, [{ type: 'depthCharge', x: escort.x + 100, y: escort.y }]);
    expect(escort.dcShots).toBe(0);
    const shots0 = state.stats.counter.depthChargesDropped;
    step(state, rng, [{ type: 'depthCharge', x: escort.x + 100, y: escort.y }], 5);
    expect(state.stats.counter.depthChargesDropped).toBe(shots0); // empty → rejected
  });
});

// ---------------------------------------------------------------------------
// 7: counter-battery fires at positions, never projectiles or mobile units
// ---------------------------------------------------------------------------

describe('counter-battery target compatibility', () => {
  it('rejects threats (projectiles / mobile units); its target table is empty', () => {
    expect(WEAPON_TARGETS.counterBattery).toHaveLength(0);
    const { state, rng } = quietTransit((c) => {
      c.baseModules = ['counterBattery'];
      c.completedResearch = ['counterBattery.base'];
    });
    const missile = inject(state, 'missile');
    const boat = inject(state, 'attackBoat', { hp: 30 });
    step(state, rng, [
      { type: 'counterBattery', installationId: missile.id },
      { type: 'counterBattery', installationId: boat.id },
    ]);
    expect(state.stats.counter.counterBatteryShots).toBe(0);
    expect(missile.alive).toBe(true);
    expect(boat.alive).toBe(true);
  });

  it('cannot engage the ranging node without Extended-Range Fire Control', () => {
    const { state, rng } = quietTransit((c) => {
      c.baseModules = ['counterBattery'];
      c.completedResearch = ['counterBattery.base'];
    });
    const pos = injectArtillery(state, { variant: 'ranging' });
    step(state, rng, [{ type: 'counterBattery', installationId: pos.id }]);
    expect(state.stats.counter.counterBatteryShots).toBe(0);
    expect(state.events.some((e) => e.type === 'launchFailed')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8: flak engages aircraft, never missiles
// ---------------------------------------------------------------------------

describe('flak target compatibility', () => {
  function flakShip(state: TransitState, rng: ReturnType<typeof createRoundTransit>['rng']) {
    let ship;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && !s.delivered && s.modules.includes('flak'));
    }
    expect(ship).toBeDefined();
    return ship!;
  }

  it('never fires at a missile, even one sitting inside its arc', () => {
    const { state, rng } = quietTransit((c) => {
      c.classModules.cargo = ['flak'];
      c.completedResearch = ['flak.base'];
    });
    const ship = flakShip(state, rng);
    inject(state, 'missile', { x: ship.x + 50, y: ship.y });
    step(state, rng, [], 30 * 3);
    expect(state.interceptors.some((i) => i.launcher === 'flak')).toBe(false);
    expect(state.stats.counter.flakShots).toBe(0);
  });

  it('automatically engages a recon plane, and drones only with proximity fuses', () => {
    expect(canEngage('flak', 'reconPlane')).toBe(true);
    expect(canEngage('flak', 'disablingDrone')).toBe(false); // gated
    expect(canEngage('flak', 'disablingDrone', new Set(['flak.proximityFuse']))).toBe(true);
    const { state, rng } = quietTransit((c) => {
      c.classModules.cargo = ['flak'];
      c.completedResearch = ['flak.base'];
    });
    const ship = flakShip(state, rng);
    inject(state, 'reconPlane', { x: ship.x + 50, y: ship.y });
    step(state, rng, [], 3);
    expect(state.stats.counter.flakShots).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 9: sensor jamming is not shootable — only worked around
// ---------------------------------------------------------------------------

describe('sensor jamming', () => {
  it('is not a threat kind and appears in no weapon target table', () => {
    const allTargets = Object.values(WEAPON_TARGETS).flat() as string[];
    expect(allTargets).not.toContain('sensorJamming');
    expect(allTargets).not.toContain('jamming');
    // The hardened branch declares itself mitigation, not attack.
    expect(COUNTER_BRANCHES.hardened.role).toBe('mitigate');
    expect(COUNTER_BRANCHES.hardened.weapon).toBeUndefined();
  });

  it('an emergency reboot shortens the blackout instead of destroying anything', () => {
    const { state, rng } = quietTransit((c) => {
      c.hardenedUnlocked = true;
      c.completedResearch = ['hardened.base'];
    });
    state.jammingSeconds = 20;
    expect(state.rebootCharges).toBe(1);
    step(state, rng, [{ type: 'reboot' }]);
    // Low-tier recovery removes 25% of the remaining blackout.
    expect(state.jammingSeconds).toBeLessThan(16);
    expect(state.jammingSeconds).toBeGreaterThan(0);
    expect(state.rebootCharges).toBe(0);
    expect(state.stats.counter.jammingMitigatedSeconds).toBeGreaterThan(0);
  });

  it('jamming blacks out detection except the protected channel', () => {
    const { c, state, rng } = quietTransit((cc) => {
      cc.classModules.cargo = ['mineSonar', 'hydrophone'];
      cc.completedResearch = [
        'mineSonar.base',
        'hydrophone.base',
        'hardened.base',
        'hardened.protectedChannel',
      ];
      cc.hardenedUnlocked = true;
    });
    expect(setProtectedChannels(c, ['torpedoDetection'])).toBe(true);
    // Recreate with channels applied.
    const fresh = createRoundTransit(c, planCurrentRound(c));
    fresh.state.spawnQueue = [];
    fresh.state.threats = [];
    fresh.state.jammingSeconds = 500;
    let sensorShip;
    for (let i = 0; i < 30 * 12 && !sensorShip; i++) {
      stepTransit(fresh.state, [], fresh.rng);
      sensorShip = fresh.state.ships.find(
        (s) => s.spawned && s.alive && s.modules.includes('mineSonar'),
      );
    }
    const mine = inject(fresh.state, 'mine', { x: sensorShip!.x + 60, y: sensorShip!.y + 60, revealed: false });
    const torpedo = inject(fresh.state, 'torpedo', { x: sensorShip!.x + 60, y: sensorShip!.y - 60, revealed: false });
    step(fresh.state, fresh.rng, [], 10);
    expect(mine.revealed).toBe(false); // mine detection jammed (not protected)
    expect(torpedo.revealed).toBe(true); // torpedo channel protected
    void rng;
    void state;
  });
});

// ---------------------------------------------------------------------------
// 10: mines cannot be cleared before detection
// ---------------------------------------------------------------------------

describe('detection gates clearing', () => {
  it('a drone can never be sent at an unrevealed mine', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['mcmDroneLauncher'];
      c.completedResearch = ['mcmDrones.base'];
      c.droneAmmo = 5;
    });
    const escort = state.escorts[0];
    const mine = inject(state, 'mine', { x: escort.x + 60, y: escort.y, revealed: false });
    step(state, rng, [{ type: 'sweepMine', threatId: mine.id }]);
    expect(state.drones).toHaveLength(0);
    expect(state.droneAmmo).toBe(5);
    expect(state.events.some((e) => e.type === 'launchFailed' && e.detail?.includes('not detected'))).toBe(true);
    // Once revealed, the same tap works.
    mine.revealed = true;
    step(state, rng, [{ type: 'sweepMine', threatId: mine.id }]);
    expect(state.drones).toHaveLength(1);
  });

  it('automatic clearance also refuses unrevealed mines', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.escortModules = ['mcmDroneLauncher'];
      c.completedResearch = ['mcmDrones.base', 'mcmDrones.extendedLink', 'mcmDrones.riskDesignator', 'mcmDrones.localAuto'];
      c.droneAmmo = 5;
    });
    const escort = state.escorts[0];
    inject(state, 'mine', { x: escort.x + 80, y: escort.y, revealed: false });
    step(state, rng, [], 30 * 4);
    expect(state.drones).toHaveLength(0); // undetected → automation blind to it
  });
});

// ---------------------------------------------------------------------------
// 11–12: low-signature variants need the right detection upgrade
// ---------------------------------------------------------------------------

describe('low-signature detection gates', () => {
  function firstSensorShip(state: TransitState, rng: ReturnType<typeof createRoundTransit>['rng'], moduleId: string) {
    let ship;
    for (let i = 0; i < 30 * 12 && !ship; i++) {
      stepTransit(state, [], rng);
      ship = state.ships.find((s) => s.spawned && s.alive && s.modules.includes(moduleId as never));
    }
    expect(ship).toBeDefined();
    return ship!;
  }

  it('low-signature mines require Composite-Signature Analysis', () => {
    const build = (withUpgrade: boolean) => {
      const { state, rng } = quietTransit((c) => {
        c.classModules.cargo = ['mineSonar'];
        c.completedResearch = withUpgrade
          ? ['mineSonar.base', 'mineSonar.improvedRange', 'mineSonar.compositeSignature']
          : ['mineSonar.base', 'mineSonar.improvedRange'];
      });
      const ship = firstSensorShip(state, rng, 'mineSonar');
      const mine = inject(state, 'mine', { x: ship.x + 80, y: ship.y, revealed: false, lowSig: true });
      step(state, rng, [], 5);
      return mine.revealed;
    };
    expect(build(false)).toBe(false);
    expect(build(true)).toBe(true);
  });

  it('low-signature torpedoes require hydrophone Low-Signature Processing', () => {
    const build = (withUpgrade: boolean) => {
      const { state, rng } = quietTransit((c) => {
        c.classModules.cargo = ['hydrophone'];
        c.completedResearch = withUpgrade
          ? ['hydrophone.base', 'hydrophone.improvedLocalization', 'hydrophone.lowSigProcessing']
          : ['hydrophone.base'];
      });
      const ship = firstSensorShip(state, rng, 'hydrophone');
      const torpedo = inject(state, 'torpedo', { x: ship.x + 80, y: ship.y, revealed: false, lowSig: true });
      step(state, rng, [], 5);
      return torpedo.revealed;
    };
    expect(build(false)).toBe(false);
    expect(build(true)).toBe(true);
  });

  it('active sonar reveals low-signature torpedoes only with Return Processing', () => {
    const build = (withUpgrade: boolean) => {
      const { state, rng } = quietTransit((c) => {
        c.sonarUnlocked = true;
        c.completedResearch = withUpgrade
          ? ['activeSonar.base', 'activeSonar.lowSigReturn']
          : ['activeSonar.base'];
      });
      const torpedo = inject(state, 'torpedo', { x: 900, y: WORLD.lanes[1], revealed: false, lowSig: true });
      step(state, rng, [{ type: 'ability', ability: 'sonar', x: 900, y: WORLD.lanes[1] }], 3);
      return torpedo.revealed;
    };
    expect(build(false)).toBe(false);
    expect(build(true)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 13–14: automation — separate cooldown, never replaces manual fire
// ---------------------------------------------------------------------------

describe('automation tactics', () => {
  it('the automatic-fire cooldown is independent of launcher reload', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.completedResearch = ['escortInterceptor.localAuto'];
      c.ammo = 20;
    });
    const escort = state.escorts[0];
    escort.stationed = true;
    inject(state, 'missile', { x: escort.x + 150, y: escort.y });
    step(state, rng, []);
    // Automation fired: BOTH timers are running, at different lengths.
    expect(state.stats.counter.autoShots).toBe(1);
    expect(escort.cooldown).toBeCloseTo(state.effects.escort.reload, 1);
    expect(escort.autoCooldown).toBeCloseTo(state.effects.escort.autoCooldown, 1);
    expect(state.effects.escort.autoCooldown).not.toBeCloseTo(state.effects.escort.reload, 1);
    // Run past the reload but not past the auto cooldown: the launcher is
    // ready for MANUAL fire while automation still waits.
    step(state, rng, [], 30 * 4); // 4s: reload (3.2s) done, auto (7s) not
    expect(escort.cooldown).toBe(0);
    expect(escort.autoCooldown).toBeGreaterThan(0);
    const fresh = inject(state, 'missile', { x: escort.x + 150, y: escort.y + 40 });
    const shotsBefore = state.stats.counter.manualShots;
    step(state, rng, [{ type: 'intercept', threatId: fresh.id }]);
    expect(state.stats.counter.manualShots).toBe(shotsBefore + 1);
  });

  it('base strategic automation starts at the Max cooldown tier and improves to Medium', () => {
    const strategic = deriveCounterEffects(['baseInterceptor.strategicAuto'], { escortModules: [], baseModules: [] });
    expect(strategic.base.autoCooldown).toBe(tierValue('autoFireCooldownSeconds', 'max'));
    const responsive = deriveCounterEffects(
      ['baseInterceptor.strategicAuto', 'baseInterceptor.responsiveAuto'],
      { escortModules: [], baseModules: [] },
    );
    expect(responsive.base.autoCooldown).toBe(tierValue('autoFireCooldownSeconds', 'medium'));
    expect(responsive.base.autoPrioritizeTti).toBe(true);
  });

  it('disabling automatic fire never removes manual fire', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 1;
      c.completedResearch = ['escortInterceptor.localAuto'];
      c.ammo = 20;
    });
    const escort = state.escorts[0];
    escort.stationed = true;
    step(state, rng, [{ type: 'toggleAuto', system: 'escortInterceptor', enabled: false }]);
    const threat = inject(state, 'missile', { x: escort.x + 150, y: escort.y });
    step(state, rng, [], 30 * 3);
    expect(state.stats.counter.autoShots).toBe(0); // automation off
    step(state, rng, [{ type: 'intercept', threatId: threat.id }]);
    expect(state.stats.counter.manualShots).toBe(1); // manual always works
  });

  it('expanded automation never double-fires at an already-covered missile', () => {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 2;
      c.completedResearch = ['escortInterceptor.localAuto', 'escortInterceptor.expandedAuto'];
      c.ammo = 20;
    });
    for (const e of state.escorts) e.stationed = true;
    // One missile between both escorts: only ONE interceptor may fly.
    inject(state, 'missile', {
      x: (state.escorts[0].x + state.escorts[1].x) / 2,
      y: (state.escorts[0].y + state.escorts[1].y) / 2,
    });
    step(state, rng, [], 3);
    expect(state.stats.counter.autoShots).toBe(1);
    expect(state.stats.counter.duplicateShots).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 15: cargo self-defense magazine
// ---------------------------------------------------------------------------

describe('cargo self-defense magazine', () => {
  it('respects the per-round magazine, and Dual-Shot raises it to two', () => {
    const run = (dualShot: boolean) => {
      const { state, rng } = quietTransit((c) => {
        c.classModules.cargo = ['selfDefense'];
        c.completedResearch = dualShot
          ? ['selfDefense.base', 'selfDefense.dualShot']
          : ['selfDefense.base'];
        c.pdAmmo = 20;
        // One equipped ship, so shots measure ONE module's magazine.
        c.composition = { cargo: 1, tanker: 0, freighter: 0 };
      });
      let ship;
      for (let i = 0; i < 30 * 12 && !ship; i++) {
        stepTransit(state, [], rng);
        ship = state.ships.find((s) => s.spawned && s.alive && s.modules.includes('selfDefense'));
      }
      expect(ship!.pdShots).toBe(dualShot ? 2 : 1);
      // Keep feeding targets; the module may only ever spend its magazine.
      for (let k = 0; k < 8; k++) {
        inject(state, 'missile', { x: ship!.x + 60, y: ship!.y });
        step(state, rng, [], 30 * 2);
      }
      return state.stats.counter.selfDefenseShots;
    };
    expect(run(false)).toBe(1);
    expect(run(true)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 16: focus fire vs distributed fire allocate targets differently
// ---------------------------------------------------------------------------

describe('deck-gun fire allocation', () => {
  function twoGunsTwoBoats() {
    const { state, rng } = quietTransit((c) => {
      c.escorts = 2;
      c.escortModules = ['deckGun'];
      c.completedResearch = [
        'deckGun.base',
        'deckGun.stabilizedMount',
        'deckGun.autoNearest',
        'deckGun.focusFire',
        'deckGun.distributedFire',
      ];
    });
    for (const e of state.escorts) e.stationed = true;
    const midX = (state.escorts[0].x + state.escorts[1].x) / 2;
    const midY = (state.escorts[0].y + state.escorts[1].y) / 2;
    const a = inject(state, 'attackBoat', { x: midX - 30, y: midY, hp: 900, maxHp: 900 });
    const b = inject(state, 'attackBoat', { x: midX + 30, y: midY, hp: 900, maxHp: 900 });
    return { state, rng, a, b };
  }

  it('distributed fire spreads guns across boats; focus fire converges them', () => {
    const dist = twoGunsTwoBoats();
    step(dist.state, dist.rng, [], 2);
    const targets = dist.state.escorts.map((e) => e.gunTargetId).sort();
    expect(targets[0]).not.toBe(targets[1]); // one gun per boat — no overkill
    expect(new Set(targets)).toEqual(new Set([dist.a.id, dist.b.id]));

    const focus = twoGunsTwoBoats();
    step(focus.state, focus.rng, [{ type: 'engageBoat', threatId: focus.a.id, focus: true }], 2);
    expect(focus.state.escorts.every((e) => e.gunTargetId === focus.a.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 17: one tier, one number — across every branch in a domain
// ---------------------------------------------------------------------------

describe('stat-tier consistency', () => {
  it('the same tier in the same domain resolves to the same value everywhere', () => {
    // Escort with the High-Velocity Motor flies at exactly the shore base's
    // stock High speed — same tier, same domain, same number.
    const fx = deriveCounterEffects(['escortInterceptor.highVelocityMotor'], {
      escortModules: [],
      baseModules: [],
    });
    expect(fx.escort.speed).toBe(fx.base.speed);
    expect(fx.escort.speed).toBe(tierValue('interceptorSpeed', 'high'));

    // High accuracy means one hit probability across interceptor branches.
    const acc = deriveCounterEffects(
      ['escortInterceptor.precisionGuidance', 'selfDefense.base', 'selfDefense.improvedFireControl'],
      { escortModules: [], baseModules: [] },
    );
    expect(acc.escort.accuracy).toBe(tierValue('weaponAccuracy', 'high'));
    expect(acc.selfDefense.accuracy).toBe(tierValue('weaponAccuracy', 'high'));
    expect(acc.base.accuracy).toBe(tierValue('weaponAccuracy', 'high')); // stock High

    // Medium reload resolves to one duration for everything in the domain.
    const rel = deriveCounterEffects(
      ['baseInterceptor.extendedBurn', 'baseInterceptor.advancedTracking', 'baseInterceptor.improvedLaunchCycle', 'mcmDrones.base', 'mcmDrones.extendedLink', 'mcmDrones.improvedSortie'],
      { escortModules: ['mcmDroneLauncher'], baseModules: [] },
    );
    expect(rel.base.reload).toBe(tierValue('reloadSeconds', 'medium'));
    expect(rel.mcm.reload).toBe(tierValue('reloadSeconds', 'medium'));
    expect(rel.escort.reload).toBe(tierValue('reloadSeconds', 'medium')); // stock Medium
  });

  it('every tier table is complete and orders sensibly within its semantics', () => {
    for (const [domain, table] of Object.entries(STAT_TIERS)) {
      for (const tier of TIER_ORDER) {
        expect(table[tier], `${domain}.${tier}`).toBeTypeOf('number');
      }
      // Monotonic in one direction (magnitude-named domains fall, the rest rise).
      const values = TIER_ORDER.map((t) => table[t]);
      const rising = values.every((v, i) => i === 0 || v > values[i - 1]);
      const falling = values.every((v, i) => i === 0 || v < values[i - 1]);
      expect(rising || falling, `${domain} must be monotonic`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 18: save migration preserves equipment and research value
// ---------------------------------------------------------------------------

describe('save migration (legacy → counter model)', () => {
  it('migrates a full legacy save without losing equipment or research value', () => {
    const old = {
      version: 2,
      seed: 'legacy-full',
      round: 7,
      phase: 'prep',
      cash: 800,
      intel: 44,
      droneAmmo: 6,
      pdAmmo: 3,
      completedResearch: [
        'sensors1', 'sensors2', 'sensors3',
        'intercept1', 'intercept2',
        'mines1', 'resilience1', 'resilience2', 'ew1', 'logistics1',
      ],
      classModules: {
        cargo: ['pointDefense', 'missileWarning'],
        tanker: ['mineSonar'],
        freighter: ['fireSuppression'],
      },
      modulePaid: { cargo: { pointDefense: 220, missileWarning: 90 }, tanker: {}, freighter: {} },
    };
    const m = migrateCampaign(JSON.parse(JSON.stringify(old)))!;
    expect(m).not.toBeNull();
    expect(m.version).toBe(3);

    // Equipment: pointDefense evolved into selfDefense; everything else kept.
    expect(m.classModules.cargo).toContain('selfDefense');
    expect(m.classModules.cargo).not.toContain('pointDefense');
    expect(m.classModules.cargo).toContain('missileWarning');
    expect(m.classModules.tanker).toContain('mineSonar');
    expect(m.classModules.freighter).toContain('fireSuppression');
    expect(m.modulePaid.cargo.selfDefense).toBe(220); // refund value preserved
    // Legacy mine-warfare research implies the escort drone launcher.
    expect(m.escortModules).toContain('mcmDroneLauncher');
    // Legacy fleet-wide compartmentalization equips where a slot is free.
    expect(m.classModules.tanker).toContain('compartmentalization');

    // Research: every legacy id translated, none left behind.
    for (const legacy of old.completedResearch) {
      expect(m.completedResearch).not.toContain(legacy);
    }
    for (const id of [
      'missileWarning.base', 'missileWarning.targetVector',
      'mineSonar.base', 'mineSonar.improvedRange', 'mineSonar.compositeSignature',
      'scanPulse.compositeScan',
      'escortInterceptor.precisionGuidance', 'escortInterceptor.rapidReload',
      'baseInterceptor.extendedBurn', 'baseInterceptor.maxVelocity',
      'mcmDrones.base',
      'compartmentalization.low', 'compartmentalization.medium',
      'fireSuppression.automatic',
      'ecm.improvedJamming', 'logistics.expandedBerthing',
    ]) {
      expect(m.completedResearch, id).toContain(id);
    }
    // Every migrated id is a real catalogue entry.
    for (const id of m.completedResearch) {
      expect(RESEARCH_INDEX[id], id).toBeDefined();
    }

    // Value: the effects the old save had are still there or better.
    const fx = deriveEffects(m.completedResearch, {
      escortModules: m.escortModules,
      baseModules: m.baseModules,
    });
    expect(fx.compartmentReduction).toBe(0.25); // old resilience1's 25%
    expect(fx.escort.accuracy).toBe(tierValue('weaponAccuracy', 'high'));
    expect(fx.base.speed).toBe(tierValue('interceptorSpeed', 'max')); // intercept1+2
    expect(fx.escort.reload).toBe(tierValue('reloadSeconds', 'high')); // dual-launch cells
    expect(fx.mineSonar.detectLowSig).toBe(true); // sensors3
    expect(fx.sweepDrones).toBe(true); // mines1 + implied launcher
    expect(fx.autoExtinguish).toBe(true); // resilience2
    expect(fx.ecmGuidedHitChance).toBe(0.08); // ew1
    expect(m.pdAmmo).toBe(3);
    expect(m.droneAmmo).toBe(6);
  });

  it('an in-flight legacy project is granted rather than lost', () => {
    const m = migrateCampaign({
      version: 2,
      seed: 'legacy-inflight',
      phase: 'research',
      completedResearch: [],
      activeResearch: { id: 'intercept1', roundsLeft: 1 },
    })!;
    expect(m.activeResearch).toBeNull();
    expect(m.completedResearch).toContain('escortInterceptor.precisionGuidance');
    expect(m.completedResearch).toContain('baseInterceptor.extendedBurn');
  });

  it('a new-format save round-trips through migration untouched', () => {
    const c = newCampaign('fresh-format');
    c.completedResearch = ['mineSonar.base'];
    c.escortModules = ['deckGun'];
    const m = migrateCampaign(JSON.parse(JSON.stringify(c)))!;
    expect(JSON.stringify(m)).toBe(JSON.stringify(c));
  });
});

// ---------------------------------------------------------------------------
// 19: replaying the same seed and commands reproduces the outcome
// ---------------------------------------------------------------------------

describe('replay determinism with counter commands', () => {
  it('identical seeds + identical command scripts produce identical rounds', () => {
    const play = (): string => {
      const c = newDevCampaign('replay-seed', { round: 4, god: false, unlockAll: true });
      const { state, rng } = createRoundTransit(c, planCurrentRound(c));
      let tick = 0;
      while (!state.over) {
        const cmds: TransitCommand[] = [];
        if (tick === 30) cmds.push({ type: 'ability', ability: 'scan', x: 1100, y: WORLD.lanes[1] });
        if (tick === 60) cmds.push({ type: 'toggleAuto', system: 'baseInterceptor', enabled: false });
        if (tick === 90) cmds.push({ type: 'ability', ability: 'sonar', x: 900, y: WORLD.lanes[1] });
        if (tick === 120) cmds.push({ type: 'ability', ability: 'smoke', x: 700, y: WORLD.lanes[1] });
        if (tick === 200) {
          const target = state.threats.find((t) => t.alive && t.kind === 'missile');
          if (target) cmds.push({ type: 'intercept', threatId: target.id });
        }
        if (tick === 240 && state.escorts[0]) {
          cmds.push({ type: 'depthCharge', x: state.escorts[0].x + 120, y: state.escorts[0].y });
        }
        stepTransit(state, cmds, rng);
        tick++;
      }
      const report = resolveTransit(c, state);
      return JSON.stringify({ stats: state.stats, events: state.events.length, cash: c.cash, report: report.quota });
    };
    expect(play()).toBe(play());
  });
});

// ---------------------------------------------------------------------------
// 20: every new control is a tap interaction (no hover dependencies)
// ---------------------------------------------------------------------------

describe('touch-input contract', () => {
  it('every automation tactic maps to a toggleable AutoSystem or is base behavior', () => {
    const toggleable = new Set([
      'escortInterceptor.localAuto', 'escortInterceptor.expandedAuto',
      'baseInterceptor.strategicAuto', 'baseInterceptor.responsiveAuto',
      'mcmDrones.localAuto', 'depthCharges.localAutoDrop', 'deckGun.autoNearest',
      'counterBattery.autoReturnFire', 'counterBattery.responsiveCounterFire',
    ]);
    const grantedAutomation = new Set(['selfDefense.autoFire', 'flak.autoLocal']);
    for (const branch of Object.values(COUNTER_BRANCHES)) {
      for (const tactic of branch.tactics) {
        if (tactic.kind !== 'automation') continue;
        expect(
          toggleable.has(tactic.id) || grantedAutomation.has(tactic.id),
          `${tactic.id} must be player-toggleable or documented base behavior`,
        ).toBe(true);
      }
    }
  });

  it('every catalogue entry carries tap-visible name and description text', () => {
    // The research UI shows all information in the tap-opened dossier — no
    // hover tooltips are load-bearing.
    for (const [id, entry] of Object.entries(RESEARCH_INDEX)) {
      expect(entry.def.name.length, id).toBeGreaterThan(0);
      expect(entry.def.desc.length, id).toBeGreaterThan(10);
    }
  });

  it('placed abilities and weapons resolve from a single tap command', () => {
    // Each armed ability places on one tap: the sim accepts the command as a
    // complete interaction (no drag, no hold, no hover).
    const { state, rng } = quietTransit((c) => {
      c.sonarUnlocked = true;
      c.smokeUnlocked = true;
      c.completedResearch = ['activeSonar.base', 'smokeScreen.base'];
    });
    step(state, rng, [
      { type: 'ability', ability: 'sonar', x: 800, y: WORLD.lanes[1] },
      { type: 'ability', ability: 'smoke', x: 1000, y: WORLD.lanes[1] },
    ]);
    expect(state.areaEffects.filter((f) => f.kind === 'sonar')).toHaveLength(1);
    expect(state.areaEffects.filter((f) => f.kind === 'smoke')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Effective research / granted built-ins
// ---------------------------------------------------------------------------

describe('research catalogue integrity', () => {
  it('granted built-ins resolve automatically; prerequisites are real entries', () => {
    const eff = effectiveResearch([]);
    expect(eff.has('escortInterceptor.base')).toBe(true);
    expect(eff.has('baseInterceptor.base')).toBe(true);
    expect(eff.has('scanPulse.base')).toBe(true);
    expect(eff.has('ecm.base')).toBe(true);
    expect(eff.has('selfDefense.base')).toBe(false); // researchable, not granted
    for (const [id, entry] of Object.entries(RESEARCH_INDEX)) {
      for (const req of entry.requires) {
        expect(RESEARCH_INDEX[req], `${id} requires unknown ${req}`).toBeDefined();
      }
    }
  });

  it('supports multi-prerequisite nodes (Pattern Salvo needs pattern AND rack)', () => {
    const entry = RESEARCH_INDEX['depthCharges.patternSalvo'];
    expect(entry.requires).toContain('depthCharges.expandedPattern');
    expect(entry.requires).toContain('depthCharges.dualRack');
  });
});
