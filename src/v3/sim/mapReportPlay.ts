// Plays the runs a bot report reads (docs/design/v3-map-report.md): a map's
// Test Lab card on its production setup (the full map from wave 1, its
// convoy policy, the encounters on), by a bot persona, with telemetry and a
// ThreatWatch, as tools/v3/map-lab/versions.ts `playVersion` does. Pure (no
// DOM, no Node): the CLI (tools/v3/map-report/report.ts) and the smoke test
// share it.

import type { AbilityId } from '../data/abilities';
import type { ArmoryLevels } from '../data/armory';
import { VERSION_DEFAULT, type EncounterVersion } from '../data/encounters';
import { labCard, mapCardId } from '../data/lab';
import { MAPS, type MapId } from '../data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../ui/lab';
import { ThreatWatch, digestRun, type RunDigest } from './mapReport';
import { BotRun, PERSONAS } from './mimic';
import { LOG_VERSION, logTelemetry, type PlayLog } from './playlog';

export interface ReportPlayOpts {
  persona?: string;
  armory?: ArmoryLevels;
  /** No loss limit and a carrier that can't sink: every seed plays every
   *  wave (the per-wave curve). Its log does not replay (the limits are
   *  changed after the start), so a tough run keeps no log. */
  tough?: boolean;
  /** The bot's weapon taste in place of its own (a kit). */
  taste?: AbilityId[];
  /** The card's encounters off (the shared waves on the card's setup
   *  otherwise): the budget's baseline. */
  noEncounters?: boolean;
  version?: EncounterVersion;
  /** Keep the play log (for the heat map). */
  keepLog?: boolean;
}

export interface ReportPlay {
  digest: RunDigest;
  log?: PlayLog;
}

export function playReportRun(map: MapId, seed: number, o: ReportPlayOpts = {}): ReportPlay {
  const card = labCard(mapCardId(map, o.version ?? VERSION_DEFAULT));
  if (!card) throw new Error(`no Test Lab card for ${map}`);
  const setup = defaultSetup(card, parseLabProgress(null));
  if (o.noEncounters) setup.encounters = false;
  const plan = labRunPlan(card, setup, null);
  const base = PERSONAS[o.persona ?? 'you'];
  if (!base) throw new Error(`unknown persona ${o.persona}`);
  const run = new BotRun(map, seed, {
    persona: o.taste ? { ...base, taste: o.taste } : base,
    armory: o.armory ?? {},
    lab: plan.lab,
    ...(plan.convoy ? { convoy: plan.convoy } : {}),
    ...(plan.encounters ? { encounters: plan.encounters } : {}),
  });
  const g = run.game;
  if (o.tough) {
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
  }
  logTelemetry(g, { id: `report-${map}-${seed}`, build: 'sim', v: LOG_VERSION, firstWave: 1, device: { w: 0, h: 0, dpr: 1, touch: true, ua: 'map-report' } }, 'sim', o.persona ?? 'you');
  const watch = new ThreatWatch();
  watch.observe(g);
  while (!run.done) {
    run.advance(1);
    watch.observe(g);
  }
  const sc = g.tel!.sidecar(g);
  const digest = digestRun(MAPS[map], seed, sc, watch.data(), { won: g.phase === 'won', wave: g.wave });
  return { digest, ...(o.keepLog && !o.tough ? { log: run.finish() } : {}) };
}
