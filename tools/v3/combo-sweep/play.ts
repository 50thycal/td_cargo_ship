// One run of the combo sweep (docs/design/v3-combo-sweep.md): a map's Test
// Lab card on its production setup, played by a bot persona, as
// src/v3/sim/mapReportPlay.ts plays the bot report's runs, with these
// changes:
//
//  - FORCED DRAFT. With a `loadout`, every draft is rewritten to offer only
//    the next card of the loadout's plan (`pickPlan`): each weapon at level 1
//    in turn (the slots fill early, as the player fills them), then level 2
//    in turn, then level 3. Once the plan is spent: Resupply, or with
//    `thenSelf` the bot drafts for itself from there. So the run holds
//    exactly the loadout's weapons, levelled the same way on every seed.
//    Without a loadout the bot drafts for itself ("self").
//    This is the harness's doing, not a game rule: the draft's own dice are
//    still drawn (the offer is replaced after the deal), so the rest of the
//    run's dice are untouched. A forced run's log does not replay (the
//    replayed deal would not offer the forced card), so the fun measures'
//    saves (forks of the log) cannot be read on it; the tension reading is
//    taken live instead.
//  - ONE RUN FOR BOTH LIMITS. Every run is played "tough" (no loss limit, a
//    carrier that can't sink), so every wave is played. The run under the
//    normal loss limit is the same run up to the moment it would have been
//    lost (checked: 120 of 120 runs on the five maps agree), so `normalOf`
//    reads it off the tough run: lost when 6 ships have gone in waves 1-10,
//    or 6 more in the boss rounds (the ending restores the convoy and the
//    count starts again, sim/events.ts `restoreConvoy`).
//  - No telemetry: ships lost per wave come from the game's own wave
//    history, which is cheaper.
//
// Pure (no Node): the worker and the unit test share it.

import { type AbilityId, type CardId, ABILITY_MAX } from '../../../src/v3/data/abilities';
import type { ArmoryLevels } from '../../../src/v3/data/armory';
import { RULES } from '../../../src/v3/data/config';
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { tensionNow, tensionStats, type Shape } from '../../../src/v3/sim/funMetrics';

/** Waves 1-10 and the three boss rounds (11-13); 14 = won. */
export const WAVES = 13;
/** The first boss round. */
export const BOSS_FROM = 11;
/** Sim steps a second (the sim runs at 60 Hz). */
const STEPS_S = 60;

/** The draft plan of a loadout: level 1 of each in turn, then level 2,
 *  then level 3. */
export function pickPlan(loadout: readonly AbilityId[]): AbilityId[] {
  const out: AbilityId[] = [];
  for (let lv = 0; lv < ABILITY_MAX; lv++) out.push(...loadout);
  return out;
}

export interface ComboJob {
  map: MapId;
  seed: number;
  /** Forced loadout (absent: the bot drafts for itself). An empty list is
   *  the plain gun: Resupply at every draft. */
  loadout?: AbilityId[];
  /** Once the loadout's plan is spent, the bot drafts for itself (in place
   *  of Resupply). */
  thenSelf?: boolean;
  armory: ArmoryLevels;
  /** Play under the normal loss limit (default: tough, every wave). */
  normal?: boolean;
  persona?: string;
  /** Read the tension each second (cheap). */
  tension?: boolean;
}

export interface WaveTension {
  peak: number;
  peaks: number;
  hot: number;
  calm: number;
  shape: Shape;
}

export interface ComboRun {
  /** Ships lost in each wave 1-13, every wave played (tough). */
  lost: number[];
  /** The weapons held at the end, with levels. */
  held: Partial<Record<AbilityId, number>>;
  /** The cards taken, in order. */
  picks: CardId[];
  /** Per wave (index 0 = wave 1), when read. */
  tension?: (WaveTension | null)[];
  /** Only for a run played with `normal`: how it ended. */
  won?: boolean;
  endWave?: number;
}

/** The run as the normal loss limit would have ended it. */
export function normalOf(lost: readonly number[], limit = RULES.shipLossLimit): { won: boolean; endWave: number; lost: number[] } {
  const out = new Array<number>(WAVES).fill(0);
  let count = 0;
  for (let w = 1; w <= WAVES; w++) {
    if (w === BOSS_FROM) count = 0;
    const take = Math.min(lost[w - 1], limit - count);
    out[w - 1] = take;
    count += take;
    if (count >= limit) return { won: false, endWave: w, lost: out };
  }
  return { won: true, endWave: 14, lost: out };
}

export function playCombo(job: ComboJob): ComboRun {
  const card = labCard(mapCardId(job.map, VERSION_DEFAULT));
  if (!card) throw new Error(`no Test Lab card for ${job.map}`);
  const setup = defaultSetup(card, parseLabProgress(null));
  const plan = labRunPlan(card, setup, null);
  const persona = PERSONAS[job.persona ?? 'you'];
  if (!persona) throw new Error(`unknown persona ${job.persona}`);
  const run = new BotRun(job.map, job.seed, {
    persona,
    armory: job.armory,
    lab: plan.lab,
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
  });
  const g = run.game;
  if (!job.normal) {
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
  }
  const forced = job.loadout ? pickPlan(job.loadout) : null;
  let next = 0;
  const picks: CardId[] = [];
  const series: number[][] = Array.from({ length: WAVES }, () => []);
  while (!run.done) {
    if (g.phase === 'draft') {
      if (forced && (next < forced.length || !job.thenSelf)) {
        const id: CardId = next < forced.length ? forced[next++] : 'resupply';
        g.offer = [id];
        run.rec.pick(id);
        if (g.phase === 'draft' && g.offer[0] === id) throw new Error(`forced pick ${id} refused`);
        picks.push(id);
        continue;
      }
      const before = { ...g.levels };
      run.advance(1);
      const got = (Object.keys(g.levels) as AbilityId[]).find((k) => (g.levels[k] ?? 0) > (before[k] ?? 0));
      picks.push(got ?? 'resupply');
      continue;
    }
    run.advance(1);
    if (job.tension && g.phase === 'wave' && g.steps % STEPS_S === 0 && g.wave >= 1 && g.wave <= WAVES) series[g.wave - 1].push(tensionNow(g));
  }
  const lost = new Array<number>(WAVES).fill(0);
  let prev = 0;
  for (const h of g.history) {
    if (h.wave >= 1 && h.wave <= WAVES) lost[h.wave - 1] += h.lost - prev;
    prev = h.lost;
  }
  const held: Partial<Record<AbilityId, number>> = {};
  for (const [k, v] of Object.entries(g.levels)) if (v) held[k as AbilityId] = v;
  const out: ComboRun = { lost, held, picks };
  if (job.normal) {
    out.won = g.phase === 'won';
    out.endWave = out.won ? 14 : g.wave;
  }
  if (job.tension)
    out.tension = series.map((s) => {
      if (s.length < 3) return null;
      const t = tensionStats(s);
      const r = (v: number) => Math.round(v * 1000) / 1000;
      return { peak: r(t.peak), peaks: t.peaks, hot: r(t.hotShare), calm: r(t.calmShare), shape: t.shape };
    });
  return out;
}
