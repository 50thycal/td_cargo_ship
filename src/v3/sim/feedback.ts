// PLAYTEST FEEDBACK (playtest-notes round). What a run's log carries beyond
// its inputs, so the player's comments reach Claude with their context:
//
//   - notes: the player paused and said something (tags and text), stamped
//     with the step and a snapshot of the game as it stood, because a later
//     build can no longer replay an old log to that moment;
//   - volleys: the attack groups as the player meets them (a run of raids of
//     one kind back to back, the way the warning cards call them out), each
//     with what it did, and the player's rating of it if they gave one;
//   - moments: the run's hard moments, marked automatically (a ship sunk, the
//     carrier hit, three ships lost in ten seconds, tapping an empty rack, a
//     new threat), so the player can comment on them after the run.
//
// Pure: no DOM. The Recorder owns a Watch and feeds it the game each frame.

import { RAID, STRUCTURE_KINDS, type RaidTheme, type ThreatKind } from '../data/config';
import type { AbilityId } from '../data/abilities';
import type { FormationId } from '../data/formations';
import type { Game } from './game';

export type NoteTag = 'bug' | 'hard' | 'easy' | 'unfair' | 'confusing' | 'fun' | 'idea';
export const NOTE_TAGS: { id: NoteTag; label: string }[] = [
  { id: 'bug', label: 'Bug' },
  { id: 'hard', label: 'Too hard' },
  { id: 'easy', label: 'Too easy' },
  { id: 'unfair', label: 'Unfair' },
  { id: 'confusing', label: 'Confusing' },
  { id: 'fun', label: 'Fun' },
  { id: 'idea', label: 'Idea' },
];

/** 1 to 5 each. Difficulty: 1 easy, 5 brutal. Fun: 1 a chore, 5 a blast.
 *  Intensity: 1 calm, 5 frantic. */
export interface Rating {
  difficulty?: number;
  fun?: number;
  intensity?: number;
}
export const RATING_AXES: { id: keyof Rating; label: string; low: string; high: string }[] = [
  { id: 'difficulty', label: 'Difficulty', low: 'easy', high: 'brutal' },
  { id: 'fun', label: 'Fun', low: 'a chore', high: 'a blast' },
  { id: 'intensity', label: 'Intensity', low: 'calm', high: 'frantic' },
];

/** The game as it stood when a note was made. */
export interface NoteContext {
  phase: Game['phase'];
  wave: number;
  waveT: number;
  score: number;
  lost: number;
  carrierHp: number;
  ammo: number;
  rack: number;
  flow: number;
  formation: FormationId;
  weapons: { id: AbilityId; level: number }[];
  loaded?: AbilityId;
  /** Threats in play, by kind (enemy structures left out). */
  threats: Partial<Record<ThreatKind, number>>;
}

export interface PlayNote {
  /** The sim step it was made on (the game was paused there). */
  step: number;
  at: string;
  /** Where it was made: the pause screen, a volley's rating, the result
   *  screen's review (about a marked moment, or the run), or the menu. */
  where: 'pause' | 'volley' | 'review' | 'menu';
  tags: NoteTag[];
  text: string;
  ctx?: NoteContext;
  /** The volley it rates or the moment it is about (indexes into the log's
   *  `volleys` and `moments`). */
  volley?: number;
  moment?: number;
  /** A small JPEG of the battlefield (data URL). */
  thumb?: string;
}

export interface Volley {
  wave: number;
  theme: RaidTheme;
  /** Raids in the group. */
  raids: number;
  /** Steps it started (its warning) and ended (launches over and the field
   *  clear, or the next volley's warning); `to` is absent while it runs. */
  from: number;
  to?: number;
  /** Threats it brought, by kind (children such as bomblets left out). */
  threats: Partial<Record<ThreatKind, number>>;
  sunk: number;
  carrierHits: number;
  /** Shots fired, and taps on an empty rack. */
  shots: number;
  dry: number;
  rating?: Rating;
}

export type MomentKind = 'sunk' | 'carrier' | 'burst' | 'dry' | 'debut';
export interface Moment {
  step: number;
  wave: number;
  waveT: number;
  kind: MomentKind;
  text: string;
}

/** Three ships lost within this many seconds is a burst. */
export const BURST = { ships: 3, seconds: 10 };
/** This many dry taps within this many seconds is worth a mark (at most one
 *  per `gap` seconds). */
export const DRY_STREAK = { taps: 5, seconds: 3, gap: 10 };
const MAX_MOMENTS = 60;

/** A wave's raids grouped the way the player meets them: back-to-back raids
 *  of one theme are one volley. Each group: its theme, raid count, when its
 *  warning starts and when its launches are over (wave seconds). */
export function volleyPlan(g: Game): { theme: RaidTheme; raids: number; start: number; launched: number }[] {
  const out: { theme: RaidTheme; raids: number; start: number; launched: number }[] = [];
  for (const r of [...g.raids].sort((a, b) => a.at - b.at)) {
    const last = out[out.length - 1];
    if (last && last.theme === r.theme) {
      last.raids++;
      last.launched = r.at + RAID.window;
    } else out.push({ theme: r.theme, raids: 1, start: Math.max(0, r.at - RAID.warn), launched: r.at + RAID.window });
  }
  return out;
}

const hostile = (kind: ThreatKind) => !STRUCTURE_KINDS.includes(kind);

/** Threats that come out of another (counted under the one that sent them). */
const PARENT: Partial<Record<ThreatKind, ThreatKind[]>> = { bomblet: ['cluster'], minidrone: ['mothership'], guided: ['bomber', 'stealthBomber'], dart: ['hydra'], heliRocket: ['attackHeli'] };

export function noteContext(g: Game): NoteContext {
  const threats: Partial<Record<ThreatKind, number>> = {};
  for (const th of g.threats) if (!th.dead && hostile(th.kind)) threats[th.kind] = (threats[th.kind] ?? 0) + 1;
  return {
    phase: g.phase,
    wave: g.wave,
    waveT: Math.round(g.waveT * 10) / 10,
    score: g.score,
    lost: g.lost,
    carrierHp: g.carrierHp,
    ammo: g.ammo,
    rack: g.stats.rack,
    flow: g.flow,
    formation: g.formation,
    weapons: g.slots.map((id) => ({ id, level: g.levels[id] ?? 0 })),
    ...(g.weapon ? { loaded: g.weapon.id } : {}),
    threats,
  };
}

/** A volley stays open at most this long after its last launch, even if
 *  something it sent is still in the air (trickling drones). */
const VOLLEY_TAIL = 8;

/** Follows a run frame by frame and writes its volleys and moments. */
export class Watch {
  readonly volleys: Volley[] = [];
  readonly moments: Moment[] = [];
  /** Volleys finished so far (the UI offers to rate the newest). */
  closed = 0;
  private wave = -1;
  private plan: ReturnType<typeof volleyPlan> = [];
  /** How many of this wave's planned volleys have opened. */
  private opened = 0;
  /** Open volleys: index into `volleys`, the plan entry, and the ids of the
   *  threats it sent. Raids overlap (the next warning comes up while the
   *  last one's missiles are still in the air), so more than one can be open. */
  private live: { index: number; plan: ReturnType<typeof volleyPlan>[number]; ids: Set<number> }[] = [];
  private seen = new Set<number>();
  private lost = 0;
  private hp = 0;
  private shots = 0;
  private dry = 0;
  private sunkBy: Partial<Record<ThreatKind, number>> = {};
  private sinks: number[] = [];
  private dryAt: number[] = [];
  private lastDryMark = -Infinity;

  constructor(g: Game) {
    this.sync(g);
  }

  private sync(g: Game): void {
    this.lost = g.lost;
    this.hp = g.carrierHp;
    this.shots = g.shots;
    this.dry = g.taps.dry;
    this.sunkBy = { ...g.sunkBy };
  }

  private mark(g: Game, kind: MomentKind, text: string): void {
    if (this.moments.length >= MAX_MOMENTS) return;
    this.moments.push({ step: g.steps, wave: g.wave, waveT: Math.round(g.waveT * 10) / 10, kind, text });
  }

  private closeAll(g: Game): void {
    for (const l of this.live) this.finish(g, l.index);
    this.live = [];
  }

  private finish(g: Game, index: number): void {
    const v = this.volleys[index];
    if (v.to === undefined) {
      v.to = g.steps;
      this.closed++;
    }
  }

  /** Call once a frame, before the UI drains `g.events`. */
  observe(g: Game): void {
    // What was open when this frame began: a loss that ends the run closes
    // every volley this frame, and still belongs to one of them.
    const open = [...this.live];
    if (g.phase === 'wave' && g.wave !== this.wave) {
      this.closeAll(g);
      this.wave = g.wave;
      this.plan = volleyPlan(g);
      this.opened = 0;
    }
    if (g.phase !== 'wave') this.closeAll(g);
    else {
      // A volley opens with its warning.
      while (this.opened < this.plan.length && g.waveT >= this.plan[this.opened].start) {
        const p = this.plan[this.opened++];
        this.live.push({ index: this.volleys.length, plan: p, ids: new Set() });
        this.volleys.push({ wave: g.wave, theme: p.theme, raids: p.raids, from: g.steps, threats: {}, sunk: 0, carrierHits: 0, shots: 0, dry: 0 });
      }
      // A new threat belongs to the newest volley whose launches have begun.
      const launching = [...this.live].reverse().find((l) => g.waveT >= l.plan.start + RAID.warn) ?? this.live[0];
      for (const th of g.threats) {
        if (this.seen.has(th.id)) continue;
        this.seen.add(th.id);
        if (!launching || th.dead || !hostile(th.kind)) continue;
        launching.ids.add(th.id);
        if (!th.parent) {
          const v = this.volleys[launching.index];
          v.threats[th.kind] = (v.threats[th.kind] ?? 0) + 1;
        }
      }
    }
    if (this.seen.size > 4000) this.seen = new Set(g.threats.map((t) => t.id));

    // Losses and shots count against the oldest volley still open (what hits
    // now was mostly launched earlier), else the newest.
    const was = open.length ? open : this.live;
    const v = was.length ? this.volleys[was[0].index] : this.volleys[this.volleys.length - 1];
    for (const ev of g.events) if (ev.kind === 'debut') this.mark(g, 'debut', `New threat: ${ev.threat}`);

    if (g.lost > this.lost) {
      const n = g.lost - this.lost;
      const by = (Object.keys(g.sunkBy) as ThreatKind[]).filter((k) => g.sunkBy[k] > (this.sunkBy[k] ?? 0));
      // A sinking belongs to the open volley that sent its killer (a bomblet
      // to its cluster, a mini-drone to its mothership, a missile to its
      // bomber). Playtest logs: two ships sunk by strafers were filed under
      // an empty missile volley that opened the frame the run was lost.
      const sent = (vol: Volley) => by.some((k) => (vol.threats[k] ?? 0) > 0 || PARENT[k]?.some((p) => (vol.threats[p] ?? 0) > 0));
      const owner = [...was].reverse().map((l) => this.volleys[l.index]).find(sent) ?? v;
      if (owner) owner.sunk += n;
      this.mark(g, 'sunk', `${n > 1 ? `${n} ships` : 'Ship'} sunk${by.length ? ` by ${by.join(', ')}` : ''} (${g.lost} lost)`);
      for (let i = 0; i < n; i++) this.sinks.push(g.t);
      const recent = this.sinks.filter((t) => g.t - t <= BURST.seconds);
      // One burst mark per burst: when it reaches the threshold.
      if (recent.length >= BURST.ships && recent.length - n < BURST.ships) this.mark(g, 'burst', `${recent.length} ships lost in ${BURST.seconds} s`);
    }
    if (g.carrierHp < this.hp) {
      if (v) v.carrierHits++;
      this.mark(g, 'carrier', `Carrier hit: ${this.hp} → ${g.carrierHp} hull`);
    }
    if (v) v.shots += Math.max(0, g.shots - this.shots);
    if (g.taps.dry > this.dry) {
      const n = g.taps.dry - this.dry;
      if (v) v.dry += n;
      for (let i = 0; i < n; i++) this.dryAt.push(g.t);
      this.dryAt = this.dryAt.filter((t) => g.t - t <= DRY_STREAK.seconds);
      if (this.dryAt.length >= DRY_STREAK.taps && g.t - this.lastDryMark >= DRY_STREAK.gap) {
        this.lastDryMark = g.t;
        this.mark(g, 'dry', `Out of ammo: ${this.dryAt.length} taps on an empty rack in ${DRY_STREAK.seconds} s`);
      }
    }

    // A volley is over once its launches are done and nothing it sent is
    // still in the air (or a while after its last launch, whatever is left).
    if (g.phase === 'wave') {
      const alive = new Set(g.threats.filter((t) => !t.dead).map((t) => t.id));
      this.live = this.live.filter((l) => {
        if (g.waveT < l.plan.launched) return true;
        const done = ![...l.ids].some((id) => alive.has(id)) || g.waveT >= l.plan.launched + VOLLEY_TAIL;
        if (done) this.finish(g, l.index);
        return !done;
      });
    }
    this.sync(g);
  }

  /** The newest finished volley, if it hasn't been rated. */
  latest(): { index: number; volley: Volley } | null {
    for (let i = this.volleys.length - 1; i >= 0; i--) {
      const v = this.volleys[i];
      if (v.to !== undefined) return { index: i, volley: v };
    }
    return null;
  }
}
