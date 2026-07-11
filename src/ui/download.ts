// Turns the campaign telemetry into a downloadable JSON file. This is the
// browser-native way to get a "game file" off a hosted web app: the playtester
// clicks the button, gets a file, and can hand it back for analysis.

import { buildTelemetryExport } from '../sim/telemetry';
import type { CampaignState } from '../sim/types';

export function downloadGameLog(c: CampaignState): void {
  const generatedAt = new Date().toISOString();
  const data = buildTelemetryExport(c, generatedAt);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = generatedAt.replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url;
  a.download = `straitwatch-log_r${data.roundsPlayed}_${stamp}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
