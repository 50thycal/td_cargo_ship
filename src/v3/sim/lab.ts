// The Test Lab in the sim (docs/design/v3-test-lab.md): a test run is a
// Free Play run with a card. Its waves keep a good pace from the start and
// rotate scenarios; the card's enemy opens every wave and makes about a
// third of the new-enemy mix; the run doesn't end at wave 10; and the game
// counts the evidence for the card (how many came, how many you stopped
// before they did harm, what they cost you).

import type { ThreatKind } from '../data/config';
import { FOES, FOES_BUILT, type FoeId } from '../data/foes';
import { LAB_LENGTH, LAB_MIX, LAB_SCENARIOS, LAB_SET, LAB_SHARE, labCard, type LabCard, type LabLength, type LabMix, type LabPair } from '../data/lab';
import { ABILITIES, type AbilityId } from '../data/abilities';
import { RULES, VIEW } from '../data/config';
import { foeHarmed, newFoeState } from './foes';
import type { Game, Launch, Threat } from './game';

/** What a test run is set up with (it goes in the play log). */
export interface LabSetup {
  card: string;
  length: LabLength;
  mix: LabMix;
  /** The card's version and the test round it was played in (absent in
   *  logs from before rounds: round 1). Not used by the sim. */
  rev?: number;
  round?: number;
}

/** The evidence counted for the card under test. */
export interface LabStats {
  /** Its enemies that came, were killed, were stopped before doing any
   *  harm, the hull points they cost you and the ships they sank. */
  came: number;
  killed: number;
  early: number;
  harm: number;
  sunk: number;
  /** A weapon card: kills while that weapon was in hand, pickups taken. */
  weaponKills: number;
  weaponUses: number;
  /** Seconds from each of its enemies showing up to your first shot at it. */
  firstShot: number[];
}

export interface LabState {
  setup: LabSetup;
  foes: FoeId[];
  kinds: ThreatKind[];
  weapon?: AbilityId;
  map: boolean;
  /** Waves cleared in this test. */
  waves: number;
  cursor: number;
  stats: LabStats;
  /** Featured threats shown and not yet shot at: id → when they came. */
  pending: Record<number, number>;
  /** A combo: how its set comes in, and this wave's sets still to come. */
  pair?: LabPair;
  sets: LabSet[];
}

/** A combo's set this wave (Test Lab round 4): its lead and the others,
 *  launched together and timed to overlap (its card's `pair`, data/lab.ts). */
export interface LabSet {
  /** When the lead launches (wave clock). */
  at: number;
  /** The bases the wave planned for its members, where it planned them. */
  bases: Partial<Record<FoeId, number>>;
  /** The card's weapon has dropped (or there is none). */
  dropped: boolean;
  /** The lead is out: the first threat id it can have, when, its base; and
   *  when it got to its station. */
  led?: { id: number; t: number; base: number; station?: number };
  /** Which followers are out. */
  done: boolean[];
}

export function newLabState(setup: LabSetup): LabState | null {
  const card = labCard(setup.card);
  if (!card) return null;
  return {
    setup,
    foes: card.foes.filter((f) => FOES_BUILT.includes(f)),
    kinds: card.foes.map((f) => FOES[f].kind),
    ...(card.weapon ? { weapon: card.weapon } : {}),
    map: card.kind === 'map',
    waves: 0,
    cursor: 0,
    stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] },
    pending: {},
    ...(card.pair ? { pair: card.pair } : {}),
    sets: [],
  };
}

/** Give a game its card: every new enemy in the mix (a map card keeps its
 *  chapter's, as the campaign does), and no win at wave 10. */
export function setUpLab(g: Game, setup: LabSetup): void {
  const lab = newLabState(setup);
  if (!lab) return;
  g.lab = lab;
  g.endless = true;
  if (!lab.map) {
    g.foe = newFoeState(g.map.id, 'all');
    g.foe.pool = [...FOES_BUILT];
  }
}

/** The new enemies a lab wave brings: the card's first (it opens the wave),
 *  then a third of the rest the card's, the others any built enemy. */
export function labFoes(g: Game, n: number): FoeId[] | null {
  const lab = g.lab;
  if (!lab || lab.map || !lab.foes.length) return null;
  const rng = g.rng.foes;
  const others = FOES_BUILT.filter((f) => !lab.foes.includes(f));
  const out: FoeId[] = [];
  const total = n + 2;
  for (let k = 0; k < total; k++) {
    const featured = k === 0 || rng.chance(LAB_SHARE);
    out.push(featured || !others.length ? lab.foes[lab.cursor++ % lab.foes.length] : rng.pick(others));
  }
  return out;
}

/** A lab wave's size and company: the mix setting, and the scenario this
 *  wave plays (rotating), on what the wave table gives. */
export function labWave(g: Game, spec: { drones: number; ballistic: number; guided: number }): { planes: number; scenario: string } | null {
  const lab = g.lab;
  if (!lab || lab.map) return null;
  const sc = LAB_SCENARIOS[lab.waves % LAB_SCENARIOS.length];
  const m = LAB_MIX[lab.setup.mix];
  spec.drones = Math.round(spec.drones * m * sc.drones);
  spec.ballistic = Math.round(spec.ballistic * m * sc.missiles);
  spec.guided = Math.round(spec.guided * m * sc.missiles);
  return { planes: sc.planes, scenario: sc.id };
}

/** The card's enemy opens every lab wave: its first launch moves up to the
 *  first seconds. */
export function labOpener(g: Game, queue: Launch[]): void {
  const lab = g.lab;
  if (!lab || !lab.kinds.length) return;
  const open = RULES.waveLeadIn + 1.5;
  lab.sets = [];
  if (lab.pair) {
    planSets(lab, queue, open);
    return;
  }
  const first = queue.find((l) => lab.kinds.includes(l.kind));
  if (first) first.at = Math.min(first.at, open);
  queue.sort((a, b) => a.at - b.at);
}

/** A combo's wave (Test Lab round 4): the launches planned for its enemies
 *  come out of the queue and come back as whole sets, as many as the most
 *  planned of its enemies, the first opening the wave and the rest where the
 *  wave had them (at least LAB_SET.gap s apart). The game launches each set's
 *  members on the pairing's cues (updateLabSets in game.ts). */
function planSets(lab: LabState, queue: Launch[], open: number): void {
  const mine = queue.filter((l) => lab.kinds.includes(l.kind));
  for (let i = queue.length - 1; i >= 0; i--) if (lab.kinds.includes(queue[i].kind)) queue.splice(i, 1);
  const per = lab.foes.map((f) => mine.filter((l) => l.kind === FOES[f].kind));
  const n = Math.max(1, ...per.map((p) => p.length));
  const times = mine.map((l) => l.at).sort((a, b) => a - b);
  let prev = -Infinity;
  for (let k = 0; k < n; k++) {
    const planned = k === 0 ? Math.min(open, times[0] ?? open) : times[Math.min(times.length - 1, Math.floor((k * times.length) / n))];
    const at = Math.max(planned, prev + LAB_SET.gap);
    prev = at;
    const bases: Partial<Record<FoeId, number>> = {};
    lab.foes.forEach((f, i) => {
      const b = per[i][k]?.base;
      if (b !== undefined && b >= 0) bases[f] = b;
    });
    lab.sets.push(newSet(lab, at, bases));
  }
}

/** A set of the card's enemies, to launch at `at` (wave clock). */
export function newSet(lab: LabState, at: number, bases: Partial<Record<FoeId, number>> = {}): LabSet {
  return { at, bases, dropped: !lab.weapon, done: (lab.pair?.follow ?? []).map(() => false) };
}

/** Is one of this enemy on the board (on screen)? A siege gun down in its
 *  hatch between salvos, and a torpedo sub at periscope depth, count: they
 *  are there, and coming back up. The Hydra's darts count as the Hydra. */
export function foeOnBoard(g: Game, f: FoeId): boolean {
  const kind = FOES[f].kind;
  const on = (x: number, y: number) => x >= -10 && x <= VIEW.width + 10 && y >= -10 && y <= VIEW.height + 10;
  if (g.threats.some((t) => !t.dead && (t.kind === kind || (f === 'hydra' && t.kind === 'dart')) && on(t.x, t.y))) return true;
  if (f === 'siege') return g.foe.marks.some((m) => m.kind === 'hatch' && !!(m.gun || m.spawn));
  if (f === 'torpedoSub') return g.foe.marks.some((m) => m.kind === 'periscope');
  return false;
}

/** Is a combo set still to come (it holds the wave open)? */
export function labBusy(g: Game): boolean {
  return !!g.lab && g.lab.sets.length > 0;
}

// ---- Evidence --------------------------------------------------------------

export function labCame(g: Game, th: Threat): void {
  const lab = g.lab;
  if (!lab || !lab.kinds.includes(th.kind)) return;
  lab.stats.came += 1;
  lab.pending[th.id] = g.t;
}

export function labShotAt(g: Game, targetId: number): void {
  const lab = g.lab;
  if (!lab) return;
  const t0 = lab.pending[targetId];
  if (t0 === undefined) return;
  lab.stats.firstShot.push(Math.round((g.t - t0) * 10) / 10);
  delete lab.pending[targetId];
}

export function labKilled(g: Game, th: Threat, heldWeapon: boolean): void {
  const lab = g.lab;
  if (!lab) return;
  if (heldWeapon) lab.stats.weaponKills += 1;
  if (!lab.kinds.includes(th.kind)) return;
  lab.stats.killed += 1;
  if (!foeHarmed(th)) lab.stats.early += 1;
  delete lab.pending[th.id];
}

export function labHarm(g: Game, by: ThreatKind, amount: number, sunk: boolean): void {
  const lab = g.lab;
  if (!lab || !lab.kinds.includes(by)) return;
  lab.stats.harm += amount;
  if (sunk) lab.stats.sunk += 1;
}

export function labWaveCleared(g: Game): void {
  if (g.lab) g.lab.waves += 1;
}

/** Has the test run its length? */
export function labDone(g: Game): boolean {
  return !!g.lab && g.lab.waves >= LAB_LENGTH[g.lab.setup.length];
}

/** The evidence, in words. */
export function evidenceLines(card: LabCard, s: LabStats, waves: number): string[] {
  const out: string[] = [];
  if (card.foes.length) {
    out.push(`${s.came} came · you killed ${s.killed}`);
    if (s.came) out.push(`${s.early} stopped before they did harm`);
    out.push(`They cost you ${s.harm} hull hit${s.harm === 1 ? '' : 's'}${s.sunk ? `, ${s.sunk} ship${s.sunk === 1 ? '' : 's'} sunk` : ''}`);
    if (s.firstShot.length) {
      const avg = s.firstShot.reduce((a, b) => a + b, 0) / s.firstShot.length;
      out.push(`${avg.toFixed(1)} s from showing up to your first shot`);
    }
  }
  if (card.weapon) out.push(`${s.weaponKills} kills with ${ABILITIES[card.weapon].name} in hand · ${s.weaponUses} pickups`);
  out.push(`${waves} wave${waves === 1 ? '' : 's'} played`);
  return out;
}

