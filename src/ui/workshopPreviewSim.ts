// REGION WORKSHOP — the attack preview, as a recording of the REAL round.
//
// The preview is not an animation of what the designer typed. It compiles the
// draft exactly as a playtest would, builds the round's plan with the same
// planner the game uses (scripted or adaptive), and plays the transit sim
// headlessly with no player input — the region's starting fleet on
// auto-defence, or with its defences switched off to see the raw attack. What
// comes back is a compact recording the editor's map replays, plus the tally.
//
// Runs in a Web Worker (previewWorker.ts) and falls back to the main thread;
// either way it is the same function.

import { compileRegion, toRegionDef, type RegionAuthoringDef } from '../data/regionAuthoring';
import { registerCustomRegion } from '../data/regions';
import { TARGETING_DOCTRINE } from '../data/enemyBranches';
import { createRoundTransit, newWorkshopPlaytest, planCurrentRound } from '../sim/campaign';
import { stepTransit } from '../sim/transit';
import type { AutoSystem, ThreatKind, TransitCommand } from '../sim/types';
import { decideCommands, newTransitMemory, personaByName } from '../sim/playtest/personas';

export const PREVIEW_REGION_ID = '__workshopPreview';

export interface PreviewRequest {
  def: RegionAuthoringDef;
  round: number;
  seed: string;
  /** true: the `balanced` bot persona defends (taps interceptors, sends
   *  escorts, flies support) — the same player the balance sweep uses.
   *  false: nobody defends, to see the raw attack. */
  defences: boolean;
}

/** Threat kind codes in a frame (keeps the recording small). */
export const THREAT_CODE: Partial<Record<ThreatKind, number>> = {
  missile: 0,
  guidedMissile: 1,
  mine: 2,
  torpedo: 3,
  attackBoat: 4,
};

export interface PreviewFrame {
  t: number;
  /** [x, y, hpFraction (−1 = lost), delivered 0/1] */
  ships: [number, number, number, number][];
  /** [x, y, alive 0/1] */
  escorts: [number, number, number][];
  /** [id, x, y, kindCode] — live threats only. */
  threats: [number, number, number, number][];
  /** [x, y] */
  interceptors: [number, number][];
}

export interface PreviewLaunch {
  t: number;
  x: number;
  kind: number;
}

export interface PreviewSummary {
  launched: number;
  minesLaid: number;
  guns: number;
  shotDown: number;
  hits: number;
  shipsLost: number;
  shipsSailed: number;
  delivered: number;
  escortsLost: number;
}

export interface PreviewResult {
  round: number;
  scripted: boolean;
  duration: number;
  frames: PreviewFrame[];
  launches: PreviewLaunch[];
  /** Gun emplacements: [x, y]. */
  guns: [number, number][];
  summary: PreviewSummary;
  /** What the plan fielded, per catalogue node (`branch:nodeId` → units) —
   *  on an Auto round, this is what the adaptive enemy chose to buy. */
  fielded: Record<string, number>;
  /** First launch time per launched node, for turning Auto into a script. */
  firstLaunch: Record<string, number>;
  /** Enemy doctrine name in force — explains why shots pick the ships they do. */
  targeting: string;
}

/** Seconds of sim time between recorded frames. */
const FRAME_DT = 0.2;

export function runPreview(req: PreviewRequest): PreviewResult {
  const region = toRegionDef(compileRegion(req.def));
  region.id = PREVIEW_REGION_ID;
  registerCustomRegion(region);
  const round = Math.max(1, Math.min(req.def.completionRound, Math.floor(req.round)));
  const c = newWorkshopPlaytest(req.seed, PREVIEW_REGION_ID, { round, source: 'local' });
  if (!req.defences) {
    c.ammo = 0;
    c.pdAmmo = 0;
    c.gunAmmo = 0;
    c.droneAmmo = 0;
    for (const k of Object.keys(c.autoFire) as AutoSystem[]) c.autoFire[k] = false;
  }
  const plan = planCurrentRound(c);
  const { state, rng } = createRoundTransit(c, plan);
  const frames: PreviewFrame[] = [];
  const capture = () => {
    frames.push({
      t: Math.round(state.time * 10) / 10,
      ships: state.ships
        .filter((s) => s.spawned)
        .map((s) => [Math.round(s.x), Math.round(s.y), s.alive ? Math.round((100 * s.hp) / s.maxHp) / 100 : -1, s.delivered ? 1 : 0]),
      escorts: state.escorts.map((e) => [Math.round(e.x), Math.round(e.y), e.alive ? 1 : 0]),
      threats: state.threats
        .filter((th) => th.alive && THREAT_CODE[th.kind] !== undefined)
        .map((th) => [th.id, Math.round(th.x), Math.round(th.y), THREAT_CODE[th.kind]!]),
      interceptors: state.interceptors.map((i) => [Math.round(i.x), Math.round(i.y)]),
    });
  };
  const persona = req.defences ? personaByName('balanced') : undefined;
  const mem = newTransitMemory();
  let nextFrame = 0;
  let guard = 0;
  while (!state.over && guard++ < 200_000) {
    if (state.time >= nextFrame) {
      capture();
      nextFrame += FRAME_DT;
    }
    const cmds: TransitCommand[] = persona ? decideCommands(state, persona, mem) : [];
    stepTransit(state, cmds, rng);
  }
  capture();

  const count = (type: string, pred: (e: (typeof state.events)[number]) => boolean = () => true) =>
    state.events.filter((e) => e.type === type && pred(e)).length;
  const shotDown =
    count('intercepted') + count('pdKill') + count('flakKill') + count('depthChargeKill') + count('boatSunk') + count('mineSwept');
  const civilianLoss = (e: (typeof state.events)[number]) => !e.cause?.startsWith('escort:') && !e.cause?.startsWith('base:');
  const summary: PreviewSummary = {
    launched: plan.spawns.length,
    minesLaid: plan.mines.length,
    guns: plan.installations.length,
    shotDown,
    hits: count('shipHit'),
    shipsLost: count('shipLost', civilianLoss),
    shipsSailed: state.ships.length,
    delivered: state.ships.filter((s) => s.delivered).length,
    escortsLost: count('shipLost', (e) => !!e.cause?.startsWith('escort:')),
  };
  const fielded: Record<string, number> = {};
  const firstLaunch: Record<string, number> = {};
  const bump = (key: string, t?: number) => {
    fielded[key] = (fielded[key] ?? 0) + 1;
    if (t !== undefined) firstLaunch[key] = Math.min(firstLaunch[key] ?? Infinity, Math.round(t));
  };
  for (const sp of plan.spawns) {
    if (sp.kind === 'missile') bump('missiles:unguided', sp.time);
    else if (sp.kind === 'guidedMissile') bump('missiles:guided', sp.time);
    else if (sp.kind === 'torpedo') bump(`torpedoes:${sp.lowSig ? 'lowSigTorpedo' : sp.homing ? 'homing' : 'straight'}`, sp.time);
    else if (sp.kind === 'attackBoat') bump(`attackBoats:${sp.boatVariant ?? 'smallArms'}`, sp.time);
  }
  for (const m of plan.mines) bump(`mines:${m.lowSig ? 'lowSig' : 'standard'}`);
  for (const g of plan.installations) bump(`artillery:${g.variant}`);
  const kindCode = (k: string) => (k === 'guidedMissile' ? 1 : k === 'torpedo' ? 3 : k === 'attackBoat' ? 4 : 0);
  return {
    round,
    scripted: !!region.scriptedRounds?.[round],
    duration: Math.round(state.time * 10) / 10,
    frames,
    launches: plan.spawns.map((s) => ({ t: Math.round(s.time * 10) / 10, x: Math.round(s.siteX), kind: kindCode(s.kind) })),
    guns: plan.installations.map((g) => [Math.round(g.x), Math.round(g.y)]),
    summary,
    fielded,
    firstLaunch,
    targeting: TARGETING_DOCTRINE[c.evolution.economy.targetingTier]?.name ?? '',
  };
}
