// The Region Workshop's balance sweep, off the main thread.
//
// A sweep is tens of whole campaigns of simulation; on the UI thread it would
// freeze the editor for a minute. The worker receives the authored preset
// (never a compiled region — it compiles and registers exactly as the
// workshop and the CLI do, so all three measure the same thing), plays the
// campaigns and posts progress after each one. A `cancel` message stops it at
// the next campaign boundary; the partial result is still summarised.

import { compileRegion, toRegionDef, type RegionAuthoringDef } from '../data/regionAuthoring';
import { REGIONS, registerCustomRegion } from '../data/regions';
import { personasByName, sweepCampaigns, summarizeSweep } from '../sim/playtest/sweep';
import type { CampaignAnalysis, SweepSummary } from '../sim/playtest/analyze';

export interface SweepRequest {
  type: 'run';
  def: RegionAuthoringDef;
  seeds: number;
  personas: string[];
  rounds: number;
}

export type SweepReply =
  | { type: 'progress'; done: number; total: number; persona: string; seed: string; roundsPlayed: number; endReason: string }
  | { type: 'done'; summary: SweepSummary; cancelled: boolean; seconds: number }
  | { type: 'error'; message: string };

let cancelled = false;

self.onmessage = (ev: MessageEvent<SweepRequest | { type: 'cancel' }>) => {
  const msg = ev.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  cancelled = false;
  const started = Date.now();
  try {
    const def = msg.def;
    // Packaged ids resolve to the packaged region; anything else is compiled.
    if (!REGIONS[def.id]) registerCustomRegion(toRegionDef(compileRegion(def)));
    const personas = personasByName(msg.personas);
    const analyses: CampaignAnalysis[] = [];
    let wasCancelled = false;
    for (const p of sweepCampaigns({ regionId: def.id, seeds: msg.seeds, personas, rounds: msg.rounds })) {
      analyses.push(p.last.analysis);
      const reply: SweepReply = {
        type: 'progress',
        done: p.done,
        total: p.total,
        persona: p.last.analysis.persona,
        seed: p.last.analysis.seed,
        roundsPlayed: p.last.analysis.roundsPlayed,
        endReason: p.last.analysis.endReason,
      };
      self.postMessage(reply);
      if (cancelled) {
        wasCancelled = true;
        break;
      }
    }
    const summary = summarizeSweep(analyses, def.id, new Date().toISOString());
    const reply: SweepReply = {
      type: 'done',
      summary,
      cancelled: wasCancelled,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    };
    self.postMessage(reply);
  } catch (err) {
    const reply: SweepReply = { type: 'error', message: err instanceof Error ? err.message : String(err) };
    self.postMessage(reply);
  }
};
