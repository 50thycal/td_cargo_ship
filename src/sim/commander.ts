// The Commander Profile — the PERMANENT progression layer.
//
// Persists across every regional attempt: Commander XP, unlocked abilities,
// the equipped loadout, permanently unlocked regions, and long-term records.
// It never contains run state, and clearing or replacing the active Regional
// Run (src/sim/campaign.ts) must never touch it — the two layers are saved
// separately (src/platform/save.ts).

import { COMMANDER, ESCORT_LEGACY } from '../data/tuning';
import { COMMANDER_ABILITIES, loadoutPointsUsed } from '../data/commanderAbilities';
import { ESCORT_LEGACIES, legacyPointsUsed } from '../data/escortLegacies';
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
  /** DEV/TESTING: the developer tools are switched on for this profile.
   *
   *  Turned on from Settings, so the tools are reachable on a phone without
   *  having to get `?dev` onto the URL — which is fine on a desktop address bar
   *  and awkward everywhere else. The URL flag and the Vite dev server still
   *  work; this is a third way in, not a replacement.
   *
   *  Turning it OFF also clears `allRegionsUnlocked` below. Leaving that set
   *  with its switch hidden would strand a profile with every region open and
   *  nothing on screen explaining why. */
  devMode: boolean;
  /** DEV/TESTING: treat every region on the ladder as unlocked.
   *
   *  Separate from `unlockedRegions` rather than folded into it, because the
   *  two mean different things and conflating them would be lossy: this says
   *  "show me everything", that says "here is what you have earned". Turn it
   *  off and the earned list is exactly what it was — nothing has been spent
   *  or granted, and the ladder picks up where it left off.
   *
   *  Only reachable from Dev Mode, which is itself behind `?dev` in the URL or
   *  the Vite dev server, so a normal player never sees it. */
  allRegionsUnlocked: boolean;
  /** Escort Legacies unlocked with Commander XP, from the same pool the
   *  abilities are bought with — one progression currency, two things to
   *  spend it on. */
  unlockedLegacies: string[];
  /** Equipped legacy loadout. Handed out to individual escorts at region
   *  start, one per hull; see claimEscortLegacy in campaign.ts. */
  legacyLoadout: string[];
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
    unlockedLegacies: Object.values(ESCORT_LEGACIES)
      .filter((l) => l.xpCost === 0)
      .map((l) => l.id),
    legacyLoadout: [],
    unlockedRegions: [FIRST_REGION],
    devMode: false,
    allRegionsUnlocked: false,
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
// Escort Legacy unlocks & the equipped legacy loadout
// ---------------------------------------------------------------------------
// Deliberately the same shape as the ability functions above, because they are
// the same idea aimed at a different owner: spend the one XP pool, keep a
// bounded equipped set, sanitize rather than refuse. The only thing that makes
// legacies different lives in the run, not here — see escortLegacies.ts.

/** Why a legacy cannot be unlocked right now (null = it can). */
export function legacyUnlockBlockReason(p: CommanderProfile, id: string): string | null {
  const def = ESCORT_LEGACIES[id];
  if (!def) return 'Unknown legacy';
  if ((p.unlockedLegacies ?? []).includes(id)) return 'Already unlocked';
  if (p.xp < def.xpCost) return `Requires ${def.xpCost} Commander XP`;
  return null;
}

export function unlockLegacy(p: CommanderProfile, id: string): boolean {
  if (legacyUnlockBlockReason(p, id) !== null) return false;
  p.xp -= ESCORT_LEGACIES[id].xpCost;
  p.unlockedLegacies = [...(p.unlockedLegacies ?? []), id];
  return true;
}

/** Why a legacy loadout is invalid for this profile (null = valid). */
export function legacyLoadoutBlockReason(
  p: CommanderProfile,
  ids: readonly string[],
): string | null {
  if (new Set(ids).size !== ids.length) return 'Duplicate legacy';
  for (const id of ids) {
    if (!ESCORT_LEGACIES[id]) return 'Unknown legacy';
    if (!(p.unlockedLegacies ?? []).includes(id)) return 'Legacy not unlocked';
  }
  if (ids.length > ESCORT_LEGACY.slots) {
    return `At most ${ESCORT_LEGACY.slots} legacies may be equipped`;
  }
  const points = legacyPointsUsed(ids);
  if (points > ESCORT_LEGACY.loadoutPoints) {
    return `Loadout exceeds ${ESCORT_LEGACY.loadoutPoints} points (${points})`;
  }
  return null;
}

export function setLegacyLoadout(p: CommanderProfile, ids: readonly string[]): boolean {
  if (legacyLoadoutBlockReason(p, ids) !== null) return false;
  p.legacyLoadout = [...ids];
  return true;
}

/** The legacy loadout as it may actually sail. */
export function sanitizedLegacyLoadout(p: CommanderProfile): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of p.legacyLoadout ?? []) {
    if (seen.has(id) || !ESCORT_LEGACIES[id] || !(p.unlockedLegacies ?? []).includes(id)) continue;
    if (out.length >= ESCORT_LEGACY.slots) break;
    if (legacyPointsUsed([...out, id]) > ESCORT_LEGACY.loadoutPoints) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export function regionUnlocked(p: CommanderProfile, id: RegionId): boolean {
  return p.allRegionsUnlocked || p.unlockedRegions.includes(id);
}

/** Switch the developer tools on or off for this profile.
 *
 *  Off is a full retreat: the dev-only settings go with it, so "turn the dev
 *  version off" means the game is exactly the game again. The earned ladder is
 *  never touched either way — see `allRegionsUnlocked`. */
export function setDevMode(p: CommanderProfile, on: boolean): void {
  p.devMode = on;
  if (!on) p.allRegionsUnlocked = false;
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
