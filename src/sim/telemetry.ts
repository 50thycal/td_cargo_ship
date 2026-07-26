// Game-log export. Pure data assembly (no DOM) so it can be unit-tested and
// reused; the UI is responsible for turning the returned object into a
// downloadable file. Captures the whole session so a playtester can hand the
// file back and every decision point is visible.

import { SHIP_CLASSES } from '../data/defs';
import { LOSS_CAUSE_TO_ENEMY_BRANCH } from '../data/counters';
import type { CampaignState } from './types';

export interface TelemetryExport {
  game: 'straitwatch';
  formatVersion: number;
  generatedAt: string;
  seed: string;
  saveVersion: number;
  roundsPlayed: number;
  campaignOver: boolean;
  finalScore: number;
  capacity: number;
  confidence: number;
  cash: number;
  intel: number;
  bases: number;
  escorts: number;
  completedResearch: string[];
  /** Player loadout at export time (the per-round history is in rounds[]). */
  loadout: {
    classModules: CampaignState['classModules'];
    escortModules: CampaignState['escortModules'];
    baseModules: CampaignState['baseModules'];
  };
  enemyTracks: CampaignState['evolution']['tracks'];
  totals: {
    launched: number;
    delivered: number;
    lost: number;
    valueDelivered: number;
    missilesSpawned: number;
    missilesIntercepted: number;
    baseIntercepts: number;
    escortIntercepts: number;
    pdKills: number;
    minesDetonated: number;
  };
  /** Player-counter totals across the campaign (per-weapon shots/kills,
   *  detection events, auto vs manual, mitigation) — the player half of the
   *  seesaw evaluation. */
  counterTotals: {
    manualShots: number;
    autoShots: number;
    manualIntercepts: number;
    autoIntercepts: number;
    duplicateShots: number;
    duplicateShotsAvoided: number;
    selfDefenseKills: number;
    droneKills: number;
    depthChargeKills: number;
    deckGunKills: number;
    counterBatterySuppressions: number;
    flakKills: number;
    detections: Record<string, number>;
    damagePrevented: Record<string, number>;
    spendByBranch: Record<string, number>;
  };
  /** Campaign-wide view of the ENEMY's economy: what it spent per branch,
   *  what that spend earned (ROI), and what it wasted. This is what makes the
   *  arms race measurable instead of inferred. */
  enemyEconomy: {
    totalBudget: number;
    totalCommitted: number;
    totalScrapped: number;
    spendByBranch: Record<string, number>;
    killsByBranch: Record<string, number>;
    /** Campaign ROI per branch = total result ÷ total spend. */
    roiByBranch: Record<string, number>;
    /** Per-round share of budget by branch — the pivot, round by round. */
    shareByRound: { round: number; shares: Record<string, number> }[];
    finalTargetingTier: number;
    finalTargetingName: string;
    openBranches: string[];
  };
  lossesByCause: Record<string, number>;
  /** Every loss cause mapped to its enemy branch ('collateral'/'attrition'
   *  mark secondary-blast and lost-at-sea outcomes explicitly). */
  lossesByEnemyBranch: Record<string, number>;
  lossesByClass: Record<string, number>;
  rounds: CampaignState['telemetry'];
}

export const TELEMETRY_FORMAT_VERSION = 3;

export function buildTelemetryExport(c: CampaignState, generatedAt: string): TelemetryExport {
  const totals = {
    launched: 0,
    delivered: 0,
    lost: 0,
    valueDelivered: 0,
    missilesSpawned: 0,
    missilesIntercepted: 0,
    baseIntercepts: 0,
    escortIntercepts: 0,
    pdKills: 0,
    minesDetonated: 0,
  };
  const lossesByCause: Record<string, number> = {};
  const lossesByEnemyBranch: Record<string, number> = {};
  const enemyEconomy: TelemetryExport['enemyEconomy'] = {
    totalBudget: 0,
    totalCommitted: 0,
    totalScrapped: 0,
    spendByBranch: {},
    killsByBranch: {},
    roiByBranch: {},
    shareByRound: [],
    finalTargetingTier: 0,
    finalTargetingName: 'Unaimed spread',
    openBranches: [],
  };
  const resultByBranch: Record<string, number> = {};
  const lossesByClass: Record<string, number> = {};
  const counterTotals: TelemetryExport['counterTotals'] = {
    manualShots: 0,
    autoShots: 0,
    manualIntercepts: 0,
    autoIntercepts: 0,
    duplicateShots: 0,
    duplicateShotsAvoided: 0,
    selfDefenseKills: 0,
    droneKills: 0,
    depthChargeKills: 0,
    deckGunKills: 0,
    counterBatterySuppressions: 0,
    flakKills: 0,
    detections: {},
    damagePrevented: {},
    spendByBranch: {},
  };

  for (const r of c.telemetry) {
    totals.launched += r.launched;
    totals.delivered += r.delivered;
    totals.lost += r.lost;
    totals.valueDelivered += r.valueDelivered;
    totals.missilesSpawned += r.missilesSpawned;
    totals.missilesIntercepted += r.missilesIntercepted;
    totals.baseIntercepts += r.baseIntercepts;
    totals.escortIntercepts += r.escortIntercepts;
    totals.pdKills += r.pdKills;
    totals.minesDetonated += r.minesDetonated;
    for (const loss of r.losses) {
      lossesByCause[loss.cause] = (lossesByCause[loss.cause] ?? 0) + 1;
      // Strip the escort:/base: asset prefixes so causes map onto branches.
      const bare = loss.cause.replace(/^(escort|base):/, '');
      const branch = LOSS_CAUSE_TO_ENEMY_BRANCH[bare] ?? 'unknown';
      lossesByEnemyBranch[branch] = (lossesByEnemyBranch[branch] ?? 0) + 1;
      const className = SHIP_CLASSES[loss.classId]?.name ?? loss.classId;
      lossesByClass[className] = (lossesByClass[className] ?? 0) + 1;
    }
    // Rounds recorded before the counter overhaul lack this block — tolerate.
    const cs = r.counters?.stats;
    if (cs) {
      counterTotals.manualShots += cs.manualShots;
      counterTotals.autoShots += cs.autoShots;
      counterTotals.manualIntercepts += cs.manualIntercepts;
      counterTotals.autoIntercepts += cs.autoIntercepts;
      counterTotals.duplicateShots += cs.duplicateShots;
      counterTotals.duplicateShotsAvoided += cs.duplicateShotsAvoided;
      counterTotals.selfDefenseKills += cs.selfDefenseKills;
      counterTotals.droneKills += cs.droneKills;
      counterTotals.depthChargeKills += cs.depthChargeKills;
      counterTotals.deckGunKills += cs.deckGunKills;
      counterTotals.counterBatterySuppressions += cs.counterBatterySuppressions;
      counterTotals.flakKills += cs.flakKills;
      for (const [k, v] of Object.entries(cs.detections)) {
        counterTotals.detections[k] = (counterTotals.detections[k] ?? 0) + v;
      }
      for (const [k, v] of Object.entries(cs.damagePrevented)) {
        counterTotals.damagePrevented[k] = (counterTotals.damagePrevented[k] ?? 0) + Math.round(v);
      }
    }
    for (const [k, v] of Object.entries(r.counters?.spendByBranch ?? {})) {
      counterTotals.spendByBranch[k] = (counterTotals.spendByBranch[k] ?? 0) + v;
    }
    // Rounds recorded before the enemy-economy overhaul lack this block.
    const en = r.enemy;
    if (en) {
      enemyEconomy.totalBudget += en.budget;
      enemyEconomy.totalCommitted += en.committed;
      enemyEconomy.totalScrapped += en.scrapped;
      const shares: Record<string, number> = {};
      for (const [branch, entry] of Object.entries(en.branches)) {
        enemyEconomy.spendByBranch[branch] =
          (enemyEconomy.spendByBranch[branch] ?? 0) + entry.spend;
        enemyEconomy.killsByBranch[branch] =
          (enemyEconomy.killsByBranch[branch] ?? 0) + entry.kills;
        resultByBranch[branch] = (resultByBranch[branch] ?? 0) + entry.result;
        if (entry.share > 0) shares[branch] = entry.share;
      }
      enemyEconomy.shareByRound.push({ round: r.round, shares });
      enemyEconomy.finalTargetingTier = en.targetingTier;
      enemyEconomy.finalTargetingName = en.targetingName;
      enemyEconomy.openBranches = en.openBranches;
    }
  }
  for (const [branch, spend] of Object.entries(enemyEconomy.spendByBranch)) {
    enemyEconomy.roiByBranch[branch] =
      spend > 0 ? Math.round(((resultByBranch[branch] ?? 0) / spend) * 1000) / 1000 : 0;
  }

  return {
    game: 'straitwatch',
    formatVersion: TELEMETRY_FORMAT_VERSION,
    generatedAt,
    seed: c.seed,
    saveVersion: c.version,
    roundsPlayed: c.telemetry.length,
    campaignOver: c.campaignOver,
    finalScore: c.score,
    capacity: c.capacity,
    confidence: c.confidence,
    cash: c.cash,
    intel: c.intel,
    bases: c.bases,
    escorts: c.escorts,
    completedResearch: [...c.completedResearch],
    loadout: {
      classModules: {
        cargo: [...c.classModules.cargo],
        tanker: [...c.classModules.tanker],
        freighter: [...c.classModules.freighter],
      },
      escortModules: [...c.escortModules],
      baseModules: [...c.baseModules],
    },
    enemyTracks: { ...c.evolution.tracks },
    totals,
    counterTotals,
    enemyEconomy,
    lossesByCause,
    lossesByEnemyBranch,
    lossesByClass,
    rounds: c.telemetry,
  };
}
