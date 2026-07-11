// Game-log export. Pure data assembly (no DOM) so it can be unit-tested and
// reused; the UI is responsible for turning the returned object into a
// downloadable file. Captures the whole session so a playtester can hand the
// file back and every decision point is visible.

import { SHIP_CLASSES } from '../data/defs';
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
  lossesByCause: Record<string, number>;
  lossesByClass: Record<string, number>;
  rounds: CampaignState['telemetry'];
}

export const TELEMETRY_FORMAT_VERSION = 1;

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
  const lossesByClass: Record<string, number> = {};

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
      const className = SHIP_CLASSES[loss.classId]?.name ?? loss.classId;
      lossesByClass[className] = (lossesByClass[className] ?? 0) + 1;
    }
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
    enemyTracks: { ...c.evolution.tracks },
    totals,
    lossesByCause,
    lossesByClass,
    rounds: c.telemetry,
  };
}
