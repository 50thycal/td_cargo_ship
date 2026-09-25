// REGION WORKSHOP — scripted rounds.
//
// A scripted round is played exactly as the designer wrote it: each attack is
// one weapon, one position on the map, one count and one timing pattern, and
// the adaptive allocator sits the round out. This module turns those attacks
// into the same RoundPlan the adaptive planner produces, so the transit sim
// cannot tell the difference — and the workshop's preview uses the very same
// function, so what the designer previews is what the round fires.
//
// Pure and seeded like the rest of sim/: the only randomness is the small
// jitter that stops simultaneous launches from sitting on one pixel.

import type { Geography } from '../data/geography';
import type { RNG } from './rng';
import type {
  ArtilleryVariant,
  BoatVariant,
  InstallationPlacement,
  MinePlacement,
  RoundPlan,
  SpawnEvent,
  TechKey,
} from './types';
import type { RuntimeAttack as AuthoredRuntimeAttack } from '../data/regionAuthoring';

/** The runtime attack shape, as stored on the (serialized) enemy economy. */
export type RuntimeAttack = Omit<AuthoredRuntimeAttack, 'branch'> & { branch: string };

/** Launch times for a launched attack, in transit seconds (before jitter). */
export function launchTimes(a: RuntimeAttack, windowEnd: number): number[] {
  const out: number[] = [];
  const n = Math.max(0, Math.floor(a.count));
  const start = Math.max(0, a.start);
  switch (a.pattern) {
    case 'salvo':
      for (let i = 0; i < n; i++) out.push(start);
      break;
    case 'volleys': {
      const size = Math.max(1, Math.floor(a.perVolley));
      for (let i = 0; i < n; i++) out.push(start + Math.floor(i / size) * a.gap);
      break;
    }
    case 'stream':
      for (let i = 0; i < n; i++) out.push(start + i * a.gap);
      break;
    case 'spread': {
      const span = Math.max(1, windowEnd - start);
      for (let i = 0; i < n; i++) out.push(start + ((i + 0.5) * span) / n);
      break;
    }
  }
  return out;
}

function spawnKind(a: RuntimeAttack): SpawnEvent['kind'] {
  if (a.branch === 'torpedoes') return 'torpedo';
  if (a.branch === 'attackBoats') return 'attackBoat';
  return a.nodeId === 'guided' ? 'guidedMissile' : 'missile';
}

/** The discovery keys a scripted attack introduces (for AAR forensics). */
function debutKeys(a: RuntimeAttack): TechKey[] {
  switch (a.branch) {
    case 'missiles':
      return a.nodeId === 'guided' ? ['guidedMissile'] : ['missile'];
    case 'mines':
      return a.nodeId === 'lowSig' ? ['mine', 'lowSigMine'] : ['mine'];
    case 'torpedoes':
      return a.nodeId === 'lowSigTorpedo' ? ['torpedo', 'lowSigTorpedo'] : ['torpedo'];
    case 'attackBoats':
      return a.nodeId === 'rocket'
        ? ['attackBoat', 'rocketBoat']
        : a.nodeId === 'boarding'
          ? ['attackBoat', 'boardingBoat']
          : ['attackBoat'];
    case 'artillery':
      return a.nodeId === 'ranging'
        ? ['artillery', 'rangingArtillery']
        : a.nodeId === 'rollingBarrage'
          ? ['artillery', 'rollingBarrage']
          : ['artillery'];
    default:
      return [];
  }
}

/** Build a round plan from scripted attacks. `firstSeen` filters the debut
 *  list to what the player has not met yet. */
export function scriptedRoundPlan(
  round: number,
  attacks: readonly RuntimeAttack[],
  geo: Geography,
  rng: RNG,
  windowEnd: number,
  firstSeen: Partial<Record<TechKey, number>> = {},
): RoundPlan {
  const spawns: SpawnEvent[] = [];
  const mines: MinePlacement[] = [];
  const installations: InstallationPlacement[] = [];
  const debuts = new Set<TechKey>();
  for (const a of attacks) {
    for (const key of debutKeys(a)) if (firstSeen[key] === undefined) debuts.add(key);
    if (a.branch === 'missiles' || a.branch === 'torpedoes' || a.branch === 'attackBoats') {
      const kind = spawnKind(a);
      for (const t of launchTimes(a, windowEnd)) {
        const ev: SpawnEvent = {
          // A salvo is a ripple, not one frame: the same stagger the adaptive
          // scheduler puts inside a volley.
          time: t + rng.range(0, 1.4),
          kind,
          siteX: a.x + rng.range(-20, 20),
        };
        if (a.branch === 'torpedoes') {
          if (a.nodeId === 'homing') ev.homing = true;
          if (a.nodeId === 'lowSigTorpedo') {
            ev.homing = true;
            ev.lowSig = true;
          }
        }
        if (a.branch === 'attackBoats') ev.boatVariant = a.nodeId as BoatVariant;
        spawns.push(ev);
      }
    } else if (a.branch === 'mines') {
      const cy = a.y ?? geo.laneY(1, a.x);
      for (let i = 0; i < a.count; i++) {
        // The same cluster footprint the adaptive planner lays.
        mines.push({
          x: a.x + rng.range(-130, 130),
          y: cy + rng.range(-75, 75),
          lowSig: a.nodeId === 'lowSig',
        });
      }
    } else if (a.branch === 'artillery') {
      const spacing = 160;
      for (let i = 0; i < a.count; i++) {
        const gx = a.x + (i - (a.count - 1) / 2) * spacing;
        installations.push({
          x: gx,
          y: geo.launchY(gx) + rng.range(-14, 18),
          variant: a.nodeId as ArtilleryVariant,
        });
      }
    }
  }
  spawns.sort((p, q) => p.time - q.time);
  return {
    round,
    spawns,
    mines,
    installations,
    smoke: [],
    electronic: { reconPlanes: 0, disablingDrones: 0, jamming: 0 },
    debuts: [...debuts],
  };
}
