// The Commander Profile — the PERMANENT progression layer.
//
// Persists across every regional attempt: Commander XP, unlocked abilities,
// the equipped loadout, permanently unlocked regions, and long-term records.
// It never contains run state, and clearing or replacing the active Regional
// Run (src/sim/campaign.ts) must never touch it — the two layers are saved
// separately (src/platform/save.ts).

import { COMMANDER } from '../data/tuning';
import { COMMANDER_ABILITIES, loadoutPointsUsed } from '../data/commanderAbilities';
import { FIRST_REGION, REGIONS, regionDef, type RegionId } from '../data/regions';
import type { CampaignState } from './types';

export const PROFILE_VERSION = 1;

export interface RegionRecord {
  /** Highest round reached in this region (any attempt). */
  bestRound: number;
  attempts: number;
  completions: number;
}

export interface CommanderProfile {
  version: number;
  /** Spendable Commander XP (unlocking an ability deducts its cost). */
  xp: number;
  /** Lifetime XP earned, never reduced — the long-term progression readout. */
  totalXpEarned: number;
  unlockedAbilities: string[];
  /** Equipped ability loadout, carried between runs and snapshotted into each
   *  run at start. Always kept valid against slots/points/unlocks. */
  loadout: string[];
  unlockedRegions: RegionId[];
  records: Record<RegionId, RegionRecord>;
  /** Lifetime run tallies. */
  totalRuns: number;
  totalRegionCompletions: number;
}

export function newProfile(): CommanderProfile {
  return {
    version: PROFILE_VERSION,
    xp: 0,
    totalXpEarned: 0,
    // Zero-cost abilities are standing commissions — held from the start so
    // the very first loadout screen has real choices on it.
    unlockedAbilities: Object.values(COMMANDER_ABILITIES)
      .filter((a) => a.xpCost === 0)
      .map((a) => a.id),
    loadout: [],
    unlockedRegions: [FIRST_REGION],
    records: {},
    totalRuns: 0,
    totalRegionCompletions: 0,
  };
}

// ---------------------------------------------------------------------------
// Ability unlocks & the equipped loadout
// ---------------------------------------------------------------------------

/** Why an ability cannot be unlocked right now (null = it can). */
export function unlockBlockReason(p: CommanderProfile, id: string): string | null {
  const def = COMMANDER_ABILITIES[id];
  if (!def) return 'Unknown ability';
  if (p.unlockedAbilities.includes(id)) return 'Already unlocked';
  if (p.xp < def.xpCost) return `Requires ${def.xpCost} Commander XP`;
  return null;
}

export function unlockAbility(p: CommanderProfile, id: string): boolean {
  if (unlockBlockReason(p, id) !== null) return false;
  p.xp -= COMMANDER_ABILITIES[id].xpCost;
  p.unlockedAbilities.push(id);
  return true;
}

/** Why a loadout is invalid for this profile (null = valid). Enforces the
 *  bounded pre-run build: unlocked abilities only, no duplicates, at most
 *  COMMANDER.abilitySlots of them, within COMMANDER.loadoutPoints. */
export function loadoutBlockReason(p: CommanderProfile, ids: readonly string[]): string | null {
  if (new Set(ids).size !== ids.length) return 'Duplicate ability';
  for (const id of ids) {
    if (!COMMANDER_ABILITIES[id]) return 'Unknown ability';
    if (!p.unlockedAbilities.includes(id)) return 'Ability not unlocked';
  }
  if (ids.length > COMMANDER.abilitySlots) {
    return `At most ${COMMANDER.abilitySlots} abilities may be equipped`;
  }
  const points = loadoutPointsUsed(ids);
  if (points > COMMANDER.loadoutPoints) {
    return `Loadout exceeds ${COMMANDER.loadoutPoints} points (${points})`;
  }
  return null;
}

export function setLoadout(p: CommanderProfile, ids: readonly string[]): boolean {
  if (loadoutBlockReason(p, ids) !== null) return false;
  p.loadout = [...ids];
  return true;
}

/** The loadout as it may actually sail: silently drops anything that is no
 *  longer valid (retired ids, over-cap edits) rather than refusing to start. */
export function sanitizedLoadout(p: CommanderProfile): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of p.loadout) {
    if (seen.has(id) || !COMMANDER_ABILITIES[id] || !p.unlockedAbilities.includes(id)) continue;
    if (out.length >= COMMANDER.abilitySlots) break;
    if (loadoutPointsUsed([...out, id]) > COMMANDER.loadoutPoints) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export function regionUnlocked(p: CommanderProfile, id: RegionId): boolean {
  return p.unlockedRegions.includes(id);
}

function record(p: CommanderProfile, id: RegionId): RegionRecord {
  return (p.records[id] ??= { bestRound: 0, attempts: 0, completions: 0 });
}

/** Note that a run has begun (attempt counting). */
export function recordRunStart(p: CommanderProfile, regionId: RegionId): void {
  record(p, regionId).attempts++;
  p.totalRuns++;
}

// ---------------------------------------------------------------------------
// Run settlement — the ONE place a finished run touches permanent progress
// ---------------------------------------------------------------------------

export interface RunSettlement {
  xpEarned: number;
  regionUnlocked: RegionId | null;
  completed: boolean;
}

/** Apply a finished regional run to the profile: award Commander XP, update
 *  records, and unlock the next region on completion.
 *
 *  Idempotent via run.profileApplied — a reload of the final report can call
 *  this again safely and nothing is double-counted. Defeat and victory both
 *  award the per-round XP (losses must feel productive); only completion pays
 *  the region bonus and unlocks the next region. */
export function applyRunToProfile(p: CommanderProfile, run: CampaignState): RunSettlement {
  const region = regionDef(run.regionId);
  const completed = run.runOutcome === 'victory';
  const settlement: RunSettlement = {
    xpEarned: 0,
    regionUnlocked: null,
    completed,
  };
  if (!run.campaignOver || run.profileApplied) return settlement;
  run.profileApplied = true;

  // `run.round` is the round ABOUT to be played; the last resolved round is
  // one behind it. On victory that equals the completion round.
  const roundsCompleted = Math.max(0, run.round - 1);
  let xp = roundsCompleted * COMMANDER.xpPerRound;
  if (completed) xp += region.completionXp;
  // Dev runs prove systems, not progression — they never mint XP or unlocks.
  if (run.dev) xp = 0;

  p.xp += xp;
  p.totalXpEarned += xp;
  settlement.xpEarned = xp;

  const rec = record(p, region.id);
  rec.bestRound = Math.max(rec.bestRound, roundsCompleted);
  if (completed && !run.dev) {
    rec.completions++;
    p.totalRegionCompletions++;
    if (region.unlocks && REGIONS[region.unlocks] && !p.unlockedRegions.includes(region.unlocks)) {
      p.unlockedRegions.push(region.unlocks);
      settlement.regionUnlocked = region.unlocks;
    }
  }
  return settlement;
}
