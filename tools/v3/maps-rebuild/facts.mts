// Prints, as JSON, what the map rebuild round needs from the game itself, so
// the review page and the plan doc read it and can't drift from it:
// - each of the 20 maps as it is today: chapter, layout (lanes, bases, roads,
//   features), the original threats each wave brings (the wave table at the
//   map's threat scale, its extras and its attack vectors), the new enemies
//   the raid planner sends wave by wave (planFoes, three seeds), today's
//   debut, its special event, the call-out corner and what it covers;
// - the 17 new enemies, the 13 enemy pairs (src/v3/data/pairs.ts), the
//   events, the weapons each chapter adds;
// - a diagram of each map (tools/v3/maps-plan/svg.ts), drawn from the live
//   MapDef, with the round's proposed overlays (siege hatches, the call-out
//   corner) from plan.mjs.
//
// Usage: npx vite-node tools/v3/maps-rebuild/facts.mts            (JSON on stdout)
//        npx vite-node tools/v3/maps-rebuild/facts.mts -- --out=f.json

import { writeFileSync } from 'node:fs';
import { MAPS, MAP_ORDER, CHAPTERS, chapterOf, type MapId } from '../../../src/v3/data/maps';
import { halfWidthAt, type MapDef, type Point } from '../../../src/v3/data/mapTypes';
import { FOES, FOE_ORDER, FOE_WAVE, HEAVY_FOES, RED_FOES, foesInChapter, type FoeId } from '../../../src/v3/data/foes';
import { PAIRS, pairFoes, memberName } from '../../../src/v3/data/pairs';
import { EVENTS, EVENT_MAPS, BONUS_EVENTS, RULE_TEXT, ENDING } from '../../../src/v3/data/events';
import { WAVE_TABLE, waveSpec } from '../../../src/v3/data/waves';
import { THREATS, RULES } from '../../../src/v3/data/config';
import { ABILITIES } from '../../../src/v3/data/abilities';
import { newInChapter } from '../../../src/v3/data/roster';
import { createGame } from '../../../src/v3/sim/game';
import { planFoes, foeCount } from '../../../src/v3/sim/foes';
import { renderMap } from '../maps-plan/svg';
import type { Feature, Kind, ProposedMap } from '../maps-plan/proposed';
import { PLAN } from './plan.mjs';

const W = 1600;
const H = 900;

/** On-screen length of a polyline (the part inside the 1600 × 900 world). */
function onScreen(path: Point[]): number {
  let n = 0;
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1];
    const b = path[k];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10));
    for (let s = 0; s < steps; s++) {
      const p = { x: a.x + ((b.x - a.x) * (s + 0.5)) / steps, y: a.y + ((b.y - a.y) * (s + 0.5)) / steps };
      if (p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) n += Math.hypot(b.x - a.x, b.y - a.y) / steps;
    }
  }
  return Math.round(n);
}

/** vectorCount in sim/game.ts: how many of an attack vector a wave brings. */
const vectorCount = (wave: number, from: number, every: number, cap: number) => (wave < from ? 0 : Math.min(cap, 1 + Math.floor((wave - from) / every)));

/** The call-out stack (docs/design/v3-callouts.md): the bottom-right of the
 *  field, a third of its width, two short cards tall. In world units. */
export const CALLOUT_BOX = { br: { x0: 1060, y0: 650, x1: 1600, y1: 900 }, bl: { x0: 0, y0: 650, x1: 540, y1: 900 }, tr: { x0: 1060, y0: 0, x1: 1600, y1: 250 } } as const;
type Corner = keyof typeof CALLOUT_BOX;
const inBox = (p: Point, c: Corner) => p.x >= CALLOUT_BOX[c].x0 && p.x <= CALLOUT_BOX[c].x1 && p.y >= CALLOUT_BOX[c].y0 && p.y <= CALLOUT_BOX[c].y1;

/** What sits under a corner: enemy bases, the carrier, the frigate. */
function under(m: MapDef, c: Corner): string[] {
  const out: string[] = [];
  for (const b of m.bases) if (inBox(b, c)) out.push(b.cove ? 'a cove' : b.chute ? 'a mine chute' : b.rig ? 'a rig' : b.generator ? 'a shield generator' : b.core ? 'the Citadel' : 'a launch base');
  if (inBox(m.carrier, c)) out.push('the carrier');
  return out;
}

/** The live map in the maps-plan diagram's shape (path lanes, widths and
 *  each system drawn from the MapDef, not from the old proposal). */
function layout(m: MapDef): ProposedMap {
  const features: Feature[] = [];
  for (const p of m.posts ?? []) {
    if (p.kind === 'radar') features.push({ kind: 'radar', x: p.x, y: p.y, r: p.reach, hp: p.hp, beam: 20 });
    else features.push({ kind: 'battery', x: p.x, y: p.y, reach: p.reach });
  }
  const ch0 = m.channels[0];
  for (const [k, l] of (m.locks ?? []).entries()) features.push({ kind: 'lock', x0: l.x0, x1: l.x1, y: ch0.y, hw: halfWidthAt(ch0, (l.x0 + l.x1) / 2), label: `Lock ${'AB'[k] ?? k + 1}`, wait: l.wait });
  if (m.night) {
    features.push({ kind: 'night' });
    features.push({ kind: 'searchlight', x: m.night.light.x, y: m.night.light.y, r: 700, a0: m.night.a0, a1: m.night.a1, beam: (m.night.a0 + m.night.a1) / 2, width: m.night.width });
  }
  if (m.boss) features.push({ kind: 'boss', path: m.boss.path, at: 1150, label: `DREADNOUGHT ${m.boss.hp} hp · waves ${m.boss.waves.join(', ')}` });
  if (m.fork) features.push({ kind: 'switch', x: m.fork.x, y: m.fork.y, label: 'Fork buoy' });
  if (m.shield) features.push({ kind: 'shield', x: m.shield.x, y: m.shield.y, r: m.shield.r });
  if (m.current) {
    for (const b of m.bases.filter((b) => b.chute)) {
      const to = { x: b.x + m.current.x * 14, y: b.y + m.current.y * 14 };
      features.push({ kind: 'mines', from: { x: b.x, y: b.y }, to, mines: [0.35, 0.7].map((u) => ({ x: b.x + (to.x - b.x) * u, y: b.y + (to.y - b.y) * u })) });
    }
  }
  for (const b of m.bases.filter((b) => b.cove)) {
    const lane = m.channels[0];
    features.push({ kind: 'boatRun', from: { x: b.x, y: b.y }, to: { x: b.x + (b.y < lane.y ? 40 : -40), y: lane.y + (b.y < lane.y ? -lane.halfWidth + 10 : lane.halfWidth - 10) } });
  }
  return {
    id: m.id,
    name: m.name,
    blurb: m.blurb,
    land: m.land,
    bases: m.bases.filter((b) => !b.cove && !b.chute).map((b) => ({ x: b.x, y: b.y, kinds: b.kinds.filter((k) => k !== 'rig' && k !== 'generator' && k !== 'citadel') as Kind[], rig: b.rig, generator: b.generator, core: b.core })),
    carrier: m.carrier,
    frigate: m.frigate,
    lanes: m.channels.map((ch) => {
      const path = ch.path ?? [{ x: -40, y: ch.y }, { x: 1640, y: ch.y }];
      const xs = Array.from({ length: 41 }, (_, i) => -40 + (1680 * i) / 40);
      const hw: number | [number, number][] = ch.widths ?? (ch.narrow ? xs.map((x) => [x, halfWidthAt(ch, x)] as [number, number]) : ch.halfWidth);
      return {
        path,
        hw,
        share: ch.share,
        speed: ch.speed,
        tide: ch.tide,
        vip: ch.vip,
        label: ch.vip ? 'supertanker lane' : ch.tide ? 'flats lane: high tide only' : ch.speed && ch.speed > 1 ? 'fast lane' : undefined,
      };
    }),
    threatScale: m.threatScale,
    extras: m.extras.map((e) => ({ ...e, kind: e.kind as Kind })),
    callout: m.callout,
    alerts: m.alerts,
    roads: m.roads,
    subSpots: m.subSpots,
    bomberLines: m.bomberLines,
    vectors: m.vectors,
    features,
  };
}

/** The round's proposed overlays on the diagram: the call-out corner, and
 *  the permanent siege hatches. */
function overlay(svg: string, plan: { callouts?: Corner | 'fade'; hatches?: Point[] } | undefined, today: Corner): string {
  const add: string[] = [];
  const want = plan?.callouts ?? today;
  const corner: Corner = want === 'fade' ? today : want;
  const b = CALLOUT_BOX[corner];
  const changed = want !== today;
  const text = want === 'fade' ? 'CALL-OUTS (FADE OVER A LIT BASE)' : changed ? 'CALL-OUTS (MOVED)' : 'CALL-OUTS';
  add.push(`<rect x="${b.x0 + 8}" y="${b.y0 + 8}" width="${b.x1 - b.x0 - 16}" height="${b.y1 - b.y0 - 16}" rx="14" fill="${changed ? 'rgba(255,209,102,0.10)' : 'rgba(255,255,255,0.06)'}" stroke="${changed ? '#ffd166' : 'rgba(255,255,255,0.55)'}" stroke-width="4" stroke-dasharray="14 10"/>`);
  add.push(`<text x="${(b.x0 + b.x1) / 2}" y="${(b.y0 + b.y1) / 2 + 9}" font-size="${want === 'fade' ? 24 : 30}" font-weight="800" fill="${changed ? '#ffd166' : '#e8f0f6'}" text-anchor="middle" letter-spacing="2" paint-order="stroke" stroke="#06202c" stroke-width="7">${text}</text>`);
  for (const h of plan?.hatches ?? []) {
    add.push(`<g><rect x="${h.x - 26}" y="${h.y - 18}" width="52" height="36" rx="5" fill="#2a120d" stroke="#ffd166" stroke-width="5"/><line x1="${h.x - 26}" y1="${h.y}" x2="${h.x + 26}" y2="${h.y}" stroke="#ffd166" stroke-width="3"/><text x="${h.x}" y="${h.y < 80 ? h.y + 46 : h.y - 28}" font-size="22" font-weight="800" fill="#ffd166" text-anchor="middle" paint-order="stroke" stroke="#06202c" stroke-width="6">HATCH</text></g>`);
  }
  return svg.replace(/<\/g><\/svg>$/, `${add.join('')}</g></svg>`);
}

const maps = MAP_ORDER.map((id, i) => {
  const m = MAPS[id];
  const ch = chapterOf(id);
  const lead = foesInChapter(ch);
  const cursor0 = i % 5;
  // Today's new enemies, wave by wave, over three seeds (planFoes advances
  // its cursor wave by wave as a run does).
  const byWave: FoeId[][] = Array.from({ length: RULES.wavesToClear }, () => []);
  for (const seed of [1000, 1001, 1002]) {
    const g = createGame(id, seed);
    for (let w = 2; w <= RULES.wavesToClear; w++) {
      g.wave = w;
      for (const f of planFoes(g, foeCount(w))) if (!byWave[w - 1].includes(f)) byWave[w - 1].push(f);
    }
  }
  const waves = WAVE_TABLE.map((_, k) => {
    const w = k + 1;
    const s = waveSpec(w, m.threatScale);
    return {
      wave: w,
      drones: s.drones,
      ballistic: s.ballistic,
      guided: s.guided,
      extras: m.extras.filter((x) => w >= x.from).map((x) => ({ kind: x.kind, n: Math.round(x.count + x.growth * (w - x.from)) })).filter((x) => x.n > 0),
      strafers: vectorCount(w, m.vectors.strafers, 4, 2),
      bombers: vectorCount(w, m.vectors.bombers, 4, 2),
      subs: vectorCount(w, m.vectors.subs, 2, 3),
      trucks: vectorCount(w, m.vectors.trucks, 2, 5),
      foes: FOE_WAVE[k],
      planned: byWave[k],
      boss: !!m.boss?.waves.includes(w),
    };
  });
  const corner: Corner = 'br';
  const features: string[] = [];
  if (m.posts?.some((p) => p.kind === 'radar')) features.push('radar');
  if (m.posts?.some((p) => p.kind === 'battery')) features.push('battery');
  if (m.channels.some((c) => c.vip)) features.push('vip');
  if (m.channels.some((c) => c.widths?.some(([, hw]) => hw < 66))) features.push('single-file');
  if (m.locks) features.push('locks');
  if (m.current) features.push('mines');
  if (m.bases.some((b) => b.rig)) features.push('rigs');
  if (m.night) features.push('night');
  if (m.boss) features.push('dreadnought');
  if (m.bases.some((b) => b.cove)) features.push('fast-boats');
  if (m.fork) features.push('fork');
  if (m.channels.some((c) => c.path && c.path[0].x > c.path[c.path.length - 1].x)) features.push('two-way');
  if (m.tide) features.push('tide');
  if (m.shield) features.push('citadel');
  if (m.land.filter((l) => l.side === 'enemy').some((l) => !l.points.some((p) => p.x <= 0 || p.x >= W || p.y <= 0 || p.y >= H))) features.push('islets');
  if (m.channels.some((c) => c.path && c.path[0].x < c.path[c.path.length - 1].x && Math.abs(c.path[0].y - c.path[c.path.length - 1].y) > 300)) features.push('bend');
  const plan = (PLAN as Record<string, { callouts?: Corner | 'fade'; hatches?: Point[] }>)[id];
  return {
    id,
    slot: i + 1,
    chapter: ch,
    name: m.name,
    blurb: m.blurb,
    threatScale: m.threatScale,
    lanes: m.channels.length,
    bases: m.bases.filter((b) => !b.cove && !b.chute && !b.generator && !b.core).length,
    special: {
      rigs: m.bases.filter((b) => b.rig).length,
      coves: m.bases.filter((b) => b.cove).length,
      chutes: m.bases.filter((b) => b.chute).length,
      generators: m.bases.filter((b) => b.generator).length,
    },
    features,
    roads: { runners: m.roads.runners.length, longest: Math.max(0, ...m.roads.runners.map(onScreen)), popups: m.roads.popups.length },
    subSpots: m.subSpots.length,
    extras: m.extras,
    vectors: m.vectors,
    boss: m.boss ? { hp: m.boss.hp, waves: m.boss.waves } : null,
    debutToday: lead.length ? lead[cursor0 % lead.length] : null,
    newToday: [...new Set(byWave.flat())],
    waves,
    event: EVENT_MAPS[id] ?? null,
    callout: { today: corner, covers: under(m, corner), free: (['bl', 'tr'] as Corner[]).filter((c) => !under(m, c).length) },
    svg: overlay(renderMap(layout(m), { tray: false }), plan, corner),
  };
});

const facts = {
  build: process.env.GIT_SHA ?? null,
  chapters: CHAPTERS.map((c) => ({ n: c.n, name: c.name, foes: foesInChapter(c.n), weapons: newInChapter(c.n).map((w) => ({ id: w, name: ABILITIES[w].name })) })),
  foes: Object.fromEntries(FOE_ORDER.map((id) => [id, { name: FOES[id].name, chapter: FOES[id].chapter, cat: FOES[id].cat, from: FOES[id].from, blurb: FOES[id].blurb, heavy: HEAVY_FOES.includes(id), red: RED_FOES.includes(id) }])),
  pairs: PAIRS.map((p) => ({ id: p.id, name: p.name, chapter: p.chapter, members: p.members.map(memberName), foes: pairFoes(p), synergy: p.synergy, rule: p.pair.rule })),
  events: Object.fromEntries(Object.values(EVENTS).map((e) => [e.id, { name: e.name, kind: e.kind, foe: e.foe, also: e.also ?? [], rules: e.rules.map((r) => RULE_TEXT[r]), look: e.look }])),
  bonus: BONUS_EVENTS.map((b) => ({ id: b.id, after: b.after, why: b.why })),
  ending: ENDING,
  threats: Object.fromEntries(['drone', 'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'mothership', 'strafer', 'bomber', 'mine', 'fastboat'].map((k) => [k, THREATS[k as keyof typeof THREATS].label])),
  wavesToClear: RULES.wavesToClear,
  maps,
};
const out = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1];
if (out) writeFileSync(out, JSON.stringify(facts));
else process.stdout.write(JSON.stringify(facts));
