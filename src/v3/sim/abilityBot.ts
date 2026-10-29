// How a bot uses its abilities (V3). Shared by the sweep bot (`bot.ts`) and
// the watch-mode personas (`mimic.ts`), so balance numbers and watch mode
// agree on what "using your abilities" means. Plain rules a decent player
// would follow: fire each one when the threat it answers is on screen in
// numbers, aimed where it does the most. It only looks at threats it has
// had time to react to (`seen`).

import { VIEW, type ThreatKind } from '../data/config';
import { AB, ABILITY_ORDER, type AbilityId } from '../data/abilities';
import { abilityReady, dist, timeToImpact, type Aim, type Game, type Raider, type Threat } from './game';

export interface AbilityUse {
  id: AbilityId;
  aim: Aim;
}

const HOMING: ThreatKind[] = ['guided', 'supersonic', 'cluster', 'bomblet'];
const AIRCRAFT: ThreatKind[] = ['strafer', 'bomber'];

/** The ability worth setting off now, if any. */
export function chooseAbility(g: Game, seen: (th: Threat) => boolean): AbilityUse | null {
  const live = g.threats.filter((t) => !t.dead && seen(t));
  for (const id of ABILITY_ORDER) {
    if (!abilityReady(g, id)) continue;
    const lv = g.levels[id] ?? 0;
    const aim = RULES[id](g, live, lv);
    if (aim) return { id, aim };
  }
  return null;
}

type Rule = (g: Game, live: Threat[], lv: number) => Aim | null;

const count = (live: Threat[], kinds: ThreatKind[]) => live.filter((t) => kinds.includes(t.kind)).length;

const RULES: Record<AbilityId, Rule> = {
  emp: (_g, live) => (count(live, ['drone', 'minidrone']) >= 6 ? {} : null),

  airstrike: (g, live, lv) => {
    // The horizontal line with the most under it; an aircraft's line counts triple.
    let best: { y: number; n: number } | null = null;
    for (const t of live) {
      let n = 0;
      for (const o of live) if (Math.abs(o.y - t.y) <= AB.airstrike.band) n += AIRCRAFT.includes(o.kind) ? 3 : 1;
      if (!best || n > best.n) best = { y: t.y, n };
    }
    const raider = lv >= 3 ? g.raiders.find((r) => r.state === 'fire' || r.state === 'raise') : undefined;
    if (raider && (!best || best.n < 4)) best = { y: raider.y, n: 4 };
    if (!best || best.n < 3) return null;
    return { x: 80, y: best.y, x2: VIEW.width - 80, y2: best.y };
  },

  railgun: (_g, live) => (live.some((t) => t.hp >= 3) || live.length >= 6 ? {} : null),

  tesla: (_g, live) => (live.length >= 6 ? {} : null),

  decoy: (g, live, lv) => {
    // Two in the air, or one about to hit.
    const fooled = live.filter((t) => !t.decoy && (lv >= 2 ? HOMING.includes(t.kind) : t.kind === 'guided' || t.kind === 'cluster'));
    return fooled.length >= 2 || fooled.some((t) => timeToImpact(g, t) < 2.5) ? {} : null;
  },

  smoke: (g, live, lv) => {
    // Lay it along the lane of the ship the most homing missiles (or a jet's
    // guns, or, evolved, ballistics) are after, from just behind it forward.
    const aimedAt = new Map<number, number>();
    for (const t of live) {
      const homing = HOMING.includes(t.kind) || (lv >= 3 && t.kind === 'ballistic');
      if (homing && t.target >= 0) aimedAt.set(t.target, (aimedAt.get(t.target) ?? 0) + 1);
    }
    let ship = [...aimedAt.entries()].sort((a, b) => b[1] - a[1])[0];
    // One homing missile about to hit a ship is reason enough.
    if (!ship || ship[1] < 2) {
      const close = live.find((t) => HOMING.includes(t.kind) && t.target >= 0 && timeToImpact(g, t) < 2.5);
      if (close) ship = [close.target, 2];
    }
    if ((!ship || ship[1] < 2) && lv >= 2) {
      const jet = live.find((t) => t.kind === 'strafer');
      const s = jet && g.ships.find((o) => Math.abs(o.y - jet.y) <= 60);
      if (s) ship = [s.id, 2];
    }
    if (!ship || ship[1] < 2) return null;
    const s = g.ships.find((o) => o.id === ship[0]);
    if (!s) return null;
    return { x: Math.max(10, s.x - 80), y: s.y, x2: Math.min(VIEW.width - 10, s.x + 520), y2: s.y };
  },

  salvo: (_g, live) => {
    // The spot with the most around it (a tough threat counts as three).
    let best: { t: Threat; n: number } | null = null;
    for (const t of live) {
      let n = 0;
      for (const o of live) if (dist(o.x, o.y, t.x, t.y) <= AB.salvo.spread * 1.3) n += o.hp >= 3 ? 3 : 1;
      if (!best || n > best.n) best = { t, n };
    }
    return best && best.n >= 3 ? { x: best.t.x, y: best.t.y, power: 1 } : null;
  },

  hunter: (g) => {
    const r = g.raiders.find((o: Raider) => o.state !== 'reverse' && o.state !== 'dive' && (o.kind === 'sub' || o.dist > 0));
    return r ? { x: r.x, y: r.y } : null;
  },
};
