// THE BALANCE SWEEP ENGINE — plays whole campaigns with bot personas and
// aggregates the result. Pure simulation: no filesystem, no DOM, no timers,
// so the same code drives the CLI runner (tools/playtest/run.ts), the Region
// Workshop's in-game sweep panel (via a Web Worker) and the Node tests.
//
// The engine is a generator so a caller can report progress and stop early
// without the engine knowing what a progress bar or a cancel button is.

import {
  createRoundTransit,
  newRegionalRun,
  planCurrentRound,
  resolveTransit,
} from '../campaign';
import { stepTransit } from '../transit';
import { regionDef, type RegionDef } from '../../data/regions';
import {
  decideCommands,
  newTransitMemory,
  personaByName,
  PERSONAS,
  procure,
  research,
  type Persona,
} from './personas';
import { analyzeCampaign, summarize, type CampaignAnalysis, type EndReason, type SweepSummary } from './analyze';
import type { CampaignState } from '../types';

export interface SweepOptions {
  regionId: string;
  /** Campaigns per persona. */
  seeds: number;
  personas: readonly Persona[];
  /** Max rounds. 0 = the region's own completion watermark (capped at 30). */
  rounds?: number;
  /** Seed base; every persona faces the same seeds so score differences
   *  reflect the build, not the draw. */
  seedBase?: string;
}

export interface CampaignResult {
  campaign: CampaignState;
  analysis: CampaignAnalysis;
}

export interface SweepProgress {
  done: number;
  total: number;
  last: CampaignResult;
}

/** Resolve persona names to definitions; unknown names are an error, never a
 *  silent skip — a sweep that quietly ran fewer builds than asked would be a
 *  measurement of the wrong thing. */
export function personasByName(names: readonly string[]): Persona[] {
  return names.map((name) => {
    const p = personaByName(name);
    if (!p) throw new Error(`Unknown persona "${name}". Available: ${PERSONAS.map((x) => x.name).join(', ')}`);
    return p;
  });
}

export function maxRoundsFor(region: RegionDef, requested = 0): number {
  return requested > 0 ? requested : Math.min(region.completionRound, 30);
}

/** Play one run to defeat, region completion or the round cap, following the
 *  real phase order: prep (procure) → transit → after-action (resolve) →
 *  technology draft. */
export function playCampaign(
  persona: Persona,
  seed: string,
  regionId: string,
  maxRounds: number,
): CampaignResult {
  const c = newRegionalRun(seed, regionId, persona.commander ?? [], persona.legacies ?? []);
  const onHand: { cash: number }[] = [];
  let endReason: EndReason = 'round-cap';
  // A finished run is not automatically a lost one: a shipping region has a
  // completion watermark, so `campaignOver` means defeat OR victory.
  const finishReason = (): EndReason =>
    c.runOutcome === 'victory'
      ? 'region-complete'
      : c.defeatCause === 'quota'
        ? 'quota-failed'
        : 'confidence-collapse';
  for (let round = 0; round < maxRounds; round++) {
    if (c.campaignOver) {
      endReason = finishReason();
      break;
    }
    procure(c, persona);
    // Nothing left to sail: attrition has taken the fleet and the player
    // cannot afford to replace it. A loss, not a survival.
    const assigned = Object.values(c.composition).reduce((a, b) => a + b, 0);
    if (assigned === 0) {
      endReason = 'fleet-wiped';
      break;
    }
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    const mem = newTransitMemory();
    let guard = 0;
    while (!state.over && guard++ < 100_000) {
      stepTransit(state, decideCommands(state, persona, mem), rng);
    }
    resolveTransit(c, state);
    onHand.push({ cash: c.cash });
    research(c, persona);
  }
  if (c.campaignOver) endReason = finishReason();

  const analysis = analyzeCampaign(
    persona.name,
    seed,
    c.telemetry,
    { campaignOver: c.campaignOver, score: c.score, cash: c.cash, endReason },
    onHand,
  );
  return { campaign: c, analysis };
}

/** Play the whole sweep, yielding after every campaign. Consumers that want
 *  the aggregate call `summarizeSweep` on the analyses they collected — or
 *  just drain `runSweep`. */
export function* sweepCampaigns(opts: SweepOptions): Generator<SweepProgress, void, void> {
  const region = regionDef(opts.regionId);
  const maxRounds = maxRoundsFor(region, opts.rounds);
  const base = opts.seedBase ?? 'playtest';
  const total = opts.personas.length * opts.seeds;
  let done = 0;
  for (const persona of opts.personas) {
    for (let s = 0; s < opts.seeds; s++) {
      const last = playCampaign(persona, `${base}-${s}`, opts.regionId, maxRounds);
      done++;
      yield { done, total, last };
    }
  }
}

export function summarizeSweep(analyses: CampaignAnalysis[], regionId: string, generatedAt: string): SweepSummary {
  const region = regionDef(regionId);
  return summarize(analyses, generatedAt, region);
}

/** Convenience: the whole sweep in one call. */
export function runSweep(opts: SweepOptions, onProgress?: (p: SweepProgress) => void): SweepSummary {
  const analyses: CampaignAnalysis[] = [];
  for (const p of sweepCampaigns(opts)) {
    analyses.push(p.last.analysis);
    onProgress?.(p);
  }
  return summarizeSweep(analyses, opts.regionId, new Date().toISOString());
}

export { PERSONAS };
