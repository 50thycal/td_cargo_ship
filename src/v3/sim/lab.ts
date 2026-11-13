// The Test Lab in the sim (docs/design/v3-test-lab.md): a test run is a
// Free Play run with a card. Its waves keep a good pace from the start and
// rotate scenarios; the card's enemy opens every wave and makes about a
// third of the new-enemy mix; the run doesn't end at wave 10; and the game
// counts the evidence for the card (how many came, how many you stopped
// before they did harm, what they cost you).

import type { ThreatKind } from '../data/config';
import { FOES, FOES_BUILT, type FoeId } from '../data/foes';
import { LAB_EVENT_RUNS, LAB_LENGTH, LAB_MIX, LAB_SCENARIOS, LAB_SET, LAB_SHARE, labCard, type LabCard, type LabLength, type LabMix, type LabPair } from '../data/lab';
import { campaignWaves, type EventId } from '../data/events';
import type { ConvoyPolicy } from '../data/convoy';
import { ABILITIES, type AbilityId } from '../data/abilities';
import { RULES, VIEW } from '../data/config';
import { isOldThreat, memberKind, type PairMember } from '../data/pairs';
import { foeHarmed, newFoeState } from './foes';
import type { Game, Launch, Threat } from './game';

/** How a map card is played (Test Lab round 10, docs/design/
 *  v3-map-cards-production.md): `full`, the whole map as the campaign plays
 *  it (wave 1 to 10, its drafts, then its event ending); `slice`, the old
 *  short lab run (the lab's start wave, kit, mix and Quick or Full length).
 *  Absent on every other card, and on a map card's log from before round 10
 *  (which was a slice). */
export type LabPlays = 'full' | 'slice';

/** What a full map run was set up with, as a record for whoever reads the
 *  log (the sim never reads it: it plays the log's own `convoy` and
 *  `encounters`). `production`: the map's production setup, unchanged. */
export interface LabMapConfig {
  convoy: ConvoyPolicy;
  /** The authored encounters' revision, or 0 for the shared waves. */
  encounters: number;
  production: boolean;
}

/** What a test run is set up with (it goes in the play log). */
export interface LabSetup {
  card: string;
  /** A lab test's length and mix (absent on a full map run: it has
   *  neither). */
  length?: LabLength;
  mix?: LabMix;
  /** A map card: the full map, or a quick slice (see LabPlays). */
  plays?: LabPlays;
  /** A full map run: its setup, as a record (see LabMapConfig). */
  config?: LabMapConfig;
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
  /** An event card: how each run of it went (absent on other cards). */
  clean?: number;
  held?: number;
  broken?: number;
}

export interface LabState {
  setup: LabSetup;
  foes: FoeId[];
  kinds: ThreatKind[];
  weapon?: AbilityId;
  map: boolean;
  /** A map card's full run (round 10): the campaign's own map, waves and
   *  ending; the lab only watches. */
  full: boolean;
  /** Waves cleared in this test. */
  waves: number;
  cursor: number;
  stats: LabStats;
  /** Featured threats shown and not yet shot at: id → when they came. */
  pending: Record<number, number>;
  /** A combo: how its set comes in, and this wave's sets still to come. */
  pair?: LabPair;
  sets: LabSet[];
  /** An event card: the special event every wave of the test is. */
  event?: EventId;
}

/** A combo's set this wave (Test Lab round 4): its lead and the others,
 *  launched together and timed to overlap (its card's `pair`, data/lab.ts). */
export interface LabSet {
  /** When the lead launches (wave clock). */
  at: number;
  /** The bases the wave planned for its members, where it planned them. */
  bases: Partial<Record<PairMember, number>>;
  /** The shore road a placed Rocket Truck takes (its Repair Ship's). */
  road?: number;
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
    full: card.kind === 'map' && setup.plays === 'full',
    waves: 0,
    cursor: 0,
    stats: { came: 0, killed: 0, early: 0, harm: 0, sunk: 0, weaponKills: 0, weaponUses: 0, firstShot: [] },
    pending: {},
    ...(card.pair ? { pair: card.pair } : {}),
    sets: [],
    ...(card.event ? { event: card.event } : {}),
  };
}

/** Give a game its card: every new enemy in the mix (a map card keeps its
 *  chapter's, as the campaign does), and no win at wave 10. A full map run
 *  changes nothing in the game: it plays to its win as the campaign does. */
export function setUpLab(g: Game, setup: LabSetup): void {
  const lab = newLabState(setup);
  if (!lab) return;
  g.lab = lab;
  if (lab.full) return;
  g.endless = true;
  // An event card plays its own map's waves and enemies, like a map card.
  if (!lab.map && !lab.event) {
    g.foe = newFoeState(g.map.id, 'all');
    g.foe.pool = [...FOES_BUILT];
  }
}

/** The new enemies a lab wave brings: the card's first (it opens the wave),
 *  then a third of the rest the card's, the others any built enemy. */
export function labFoes(g: Game, n: number): FoeId[] | null {
  const lab = g.lab;
  if (!lab || lab.map || lab.event || !lab.foes.length) return null;
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
  if (!lab || lab.map || lab.event) return null;
  const sc = LAB_SCENARIOS[lab.waves % LAB_SCENARIOS.length];
  const m = LAB_MIX[lab.setup.mix ?? 'normal'];
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
    const at = Math.max(planned, prev + (lab.pair?.gap ?? LAB_SET.gap));
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
export function newSet(lab: LabState, at: number, bases: Partial<Record<PairMember, number>> = {}): LabSet {
  return { at, bases, done: (lab.pair?.follow ?? []).map(() => false) };
}

/** Is one of this pair member on the board (on screen)? A siege gun down
 *  in its hatch between salvos, a torpedo sub at periscope depth and a dive
 *  bomber's circle before its plane count: they are there, and coming. The
 *  Hydra's darts count as the Hydra, a sub's torpedoes as the sub, a cluster
 *  missile's bomblets as it. An original threat counts only as one a pair's
 *  set brought (not the wave's own). */
export function foeOnBoard(g: Game, f: PairMember): boolean {
  const kind = memberKind(f);
  const also: Partial<Record<PairMember, ThreatKind>> = { hydra: 'dart', torpedoSub: 'torpedo', cluster: 'bomblet' };
  const old = isOldThreat(f);
  const on = (x: number, y: number) => x >= -10 && x <= VIEW.width + 10 && y >= -10 && y <= VIEW.height + 10;
  if (g.threats.some((t) => !t.dead && (t.kind === kind ? !old || !!t.paired : t.kind === also[f]) && on(t.x, t.y))) return true;
  if (f === 'siege') return g.foe.marks.some((m) => m.kind === 'hatch' && !!(m.gun || m.spawn));
  if (f === 'torpedoSub') return g.foe.marks.some((m) => m.kind === 'periscope');
  if (f === 'diveBomber') return g.foe.marks.some((m) => m.kind === 'dive');
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
  // An event card counts everything the event costs you.
  if (!lab || (!lab.event && !lab.kinds.includes(by))) return;
  lab.stats.harm += amount;
  if (sunk) lab.stats.sunk += 1;
}

export function labWaveCleared(g: Game): void {
  if (g.lab) g.lab.waves += 1;
}

/** Is this a lab test with its own rules (not a full map run, which plays
 *  the campaign's)? */
export function labTest(g: Game): boolean {
  return !!g.lab && !g.lab.full;
}

/** Has the test run its length? (A full map run ends as the campaign's
 *  does: won or lost.) */
export function labDone(g: Game): boolean {
  return !!g.lab && !g.lab.full && g.lab.waves >= labWaves(g.lab);
}

/** A test's length in waves: Quick or Full, and for an event card that
 *  many runs of the event; a full map run, the map's ten and its ending. */
export function labWaves(lab: { setup: LabSetup; event?: EventId }): number {
  const card = labCard(lab.setup.card);
  if (card?.kind === 'map' && lab.setup.plays === 'full') return campaignWaves(card.map);
  return (lab.event ? LAB_EVENT_RUNS : LAB_LENGTH)[lab.setup.length ?? 'full'];
}

/** The bar's count in play: the card's tally, then how far into the test
 *  it is. An event card counts its runs (Test Lab round 6: "I thought it
 *  would be one and done"): "Run 1 of 3". A full map run (round 10) says
 *  so, and the wave it is on: "full map · wave 3/13"; a map card's quick
 *  slice: "quick slice · 1/8". */
export function labCountText(card: LabCard, s: LabStats, waves: number, length: number, at?: { plays?: LabPlays; wave?: number }): string {
  if (at?.plays === 'full') return `full map · wave ${Math.min(at.wave ?? waves + 1, length)}/${length}`;
  const parts = card.event
    ? [`clean ${s.clean ?? 0}`, `held ${s.held ?? 0}`, `broken ${s.broken ?? 0}`]
    : card.foes.length
      ? [`came ${s.came}`, `killed ${s.killed}`, `hit you ${s.harm}`]
      : card.weapon
        ? [`kills ${s.weaponKills}`]
        : [];
  const n = Math.min(waves + 1, length);
  parts.push(card.event ? `Run ${n} of ${length}` : `${n}/${length}`);
  if (at?.plays === 'slice') parts.unshift('quick slice');
  return parts.join(' · ');
}

/** The evidence, in words. A map card's full run (round 10) says how far
 *  into the map it got and how its ending went. */
export function evidenceLines(card: LabCard, s: LabStats, waves: number, plays?: LabPlays): string[] {
  const out: string[] = [];
  if (card.kind === 'map' && plays === 'full') {
    const total = campaignWaves(card.map);
    out.push(`Full map: ${waves} of ${total} waves cleared${waves >= total ? ' (the map cleared)' : ''}`);
    const runs = (s.clean ?? 0) + (s.held ?? 0) + (s.broken ?? 0);
    if (runs) out.push(`Its ending: Clean ${s.clean ?? 0} · Held ${s.held ?? 0} · Broken ${s.broken ?? 0}`);
    return out;
  }
  if (card.kind === 'map' && plays === 'slice') out.push('Quick slice');
  if (card.kind === 'event') {
    const runs = (s.clean ?? 0) + (s.held ?? 0) + (s.broken ?? 0);
    out.push(runs ? `Clean ${s.clean ?? 0} · Held ${s.held ?? 0} · Broken ${s.broken ?? 0}` : 'Not finished');
    out.push(`They cost you ${s.harm} hull hit${s.harm === 1 ? '' : 's'}${s.sunk ? `, ${s.sunk} ship${s.sunk === 1 ? '' : 's'} sunk` : ''}`);
    out.push(`${runs} run${runs === 1 ? '' : 's'} played`);
    return out;
  }
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

