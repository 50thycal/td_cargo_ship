// A FIRST LOOK at the baseline's telemetry on the real maps: not the slice 2
// viewer (no filters, no scrub, no drill-down), only enough to judge whether
// the data is right before that is built. It reads the twelve stored
// baseline logs, replays each with telemetry, and adds the four runs of
// each reference map together.
//
// Six layers, each for two scopes (the ten normal waves; the map's event
// and the bonus wave):
//   launches  where attacks were launched, by platform
//   sources   hull points removed, traced back to where the attacker was launched
//   damage    where the hulls were when they were hit
//   exposure  ship-seconds by 50 x 50 cell
//   risk      hull points lost per ship-minute in the cell (thin cells masked)
//   pickups   where each dropped, and whether it was taken
//
// Used by tools/v3/map-lab/page.ts (the review page).

import { readFileSync } from 'node:fs';
import { VIEW } from '../../../src/v3/data/config';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { BASELINE, REFERENCE_MAPS } from '../../../src/v3/sim/mapLab';
import { replay, type PlayLog } from '../../../src/v3/sim/playlog';
import type { TelEvent, TelPhaseKind, TelemetrySidecar } from '../../../src/v3/sim/telemetry';
import { fromMapDef, renderMap } from '../maps-plan/svg';

const DIR = 'tests/v3/fixtures/map-lab';
export const GRID = { w: 32, h: 18, cell: 50 };
/** A cell with less traffic than this is too thin to give a rate for. */
export const THIN = 30;

export type Scope = 'waves' | 'events';
export const SCOPES: { id: Scope; name: string; kinds: TelPhaseKind[] }[] = [
  { id: 'waves', name: 'Normal waves', kinds: ['wave'] },
  { id: 'events', name: 'Map event and bonus wave', kinds: ['mapEvent', 'bonusEvent', 'labEvent'] },
];

export type Layer = 'launches' | 'sources' | 'damage' | 'exposure' | 'risk' | 'pickups';
export const LAYERS: { id: Layer; name: string; says: string }[] = [
  { id: 'launches', name: 'Launches', says: 'Where attacks were launched from. A bigger mark is more launches from that spot.' },
  { id: 'sources', name: 'Damage by source', says: 'Hull points removed, traced back to where the attacker was launched. A bigger mark did more damage.' },
  { id: 'damage', name: 'Hits', says: 'Where each hull was when it was hit. A bigger dot took more hull points; a cross is a sinking.' },
  { id: 'exposure', name: 'Traffic', says: 'Ship-seconds in each 50 x 50 square: how long hulls spent there. Lighter is longer.' },
  { id: 'risk', name: 'Risk', says: 'Hull points lost per ship-minute spent in the square. Lighter is worse. Hatched: too little traffic to say.' },
  { id: 'pickups', name: 'Pickups', says: 'Where each pickup dropped. Filled: taken. Hollow: it expired or went with the wave.' },
];

type Spawn = Extract<TelEvent, { k: 'thr+' }>;
type Hit = Extract<TelEvent, { k: 'hit' }>;
export type Platform = 'base' | 'mobile' | 'air';
export const PLATFORMS: { id: Platform; name: string; color: string; shape: string }[] = [
  { id: 'base', name: 'Base', color: '#3987e5', shape: 'circle' },
  { id: 'mobile', name: 'Truck or submarine', color: '#d95926', shape: 'square' },
  { id: 'air', name: 'Aircraft', color: '#199e70', shape: 'triangle' },
];

const platformOf = (e: Spawn): Platform => (e.o === 'base' || e.o === 'structure' ? 'base' : e.o === 'air' ? 'air' : 'mobile');
const clampX = (x: number) => Math.max(14, Math.min(VIEW.width - 14, x));
const clampY = (y: number) => Math.max(14, Math.min(VIEW.height - 14, y));

interface Mark {
  x: number;
  y: number;
  n: number;
  platform?: Platform;
  kinds?: Record<string, number>;
  sunk?: number;
  taken?: number;
}

export interface ScopeData {
  /** Seconds of play, ship-minutes afloat, and the counts behind every rate. */
  seconds: number;
  shipMinutes: number;
  launches: number;
  hits: number;
  blocked: number;
  hpShip: number;
  hpCarrier: number;
  sunk: number;
  delivered: number;
  sailed: number;
  byKind: [string, number][];
  byPlatform: Record<Platform, { launches: number; hp: number }>;
  /** The lane in three (left, middle, right third of the board). */
  thirds: { shipMinutes: number; hp: number; sunk: number }[];
  pickups: { dropped: number; taken: number; expired: number; cleared: number; open: number };
  taps: { fire: number; pickup: number; dry: number; empty: number };
  marks: Record<'launches' | 'sources' | 'damage' | 'pickups', Mark[]>;
  /** Ship-seconds and ship hull points lost, by cell. */
  exposure: number[];
  hpCell: number[];
}

export interface MapPreview {
  map: MapId;
  name: string;
  runs: { id: string; covers: string; phases: string[] }[];
  scopes: Record<Scope, ScopeData>;
}

function sidecarOf(id: string): TelemetrySidecar {
  const log: PlayLog = JSON.parse(readFileSync(`${DIR}/${id}.json`, 'utf8'));
  const g = replay(log, { telemetry: true });
  return g.tel!.sidecar(g);
}

function emptyScope(): ScopeData {
  return {
    seconds: 0, shipMinutes: 0, launches: 0, hits: 0, blocked: 0, hpShip: 0, hpCarrier: 0, sunk: 0, delivered: 0, sailed: 0,
    byKind: [],
    byPlatform: { base: { launches: 0, hp: 0 }, mobile: { launches: 0, hp: 0 }, air: { launches: 0, hp: 0 } },
    thirds: [0, 1, 2].map(() => ({ shipMinutes: 0, hp: 0, sunk: 0 })),
    pickups: { dropped: 0, taken: 0, expired: 0, cleared: 0, open: 0 },
    taps: { fire: 0, pickup: 0, dry: 0, empty: 0 },
    marks: { launches: [], sources: [], damage: [], pickups: [] },
    exposure: new Array(GRID.w * GRID.h).fill(0),
    hpCell: new Array(GRID.w * GRID.h).fill(0),
  };
}

const cellOf = (x: number, y: number): number => {
  const cx = Math.floor(x / GRID.cell);
  const cy = Math.floor(y / GRID.cell);
  return cx < 0 || cy < 0 || cx >= GRID.w || cy >= GRID.h ? -1 : cy * GRID.w + cx;
};
const thirdOf = (x: number) => Math.max(0, Math.min(2, Math.floor((x / VIEW.width) * 3)));

/** Marks at nearly the same spot become one (a 20-unit grid). */
function bucket(list: Mark[], x: number, y: number, n: number, platform?: Platform, kind?: string, extra?: Partial<Mark>): void {
  const bx = Math.round(clampX(x) / 20) * 20;
  const by = Math.round(clampY(y) / 20) * 20;
  let m = list.find((o) => o.x === bx && o.y === by && o.platform === platform);
  if (!m) {
    m = { x: bx, y: by, n: 0, ...(platform ? { platform } : {}), kinds: {} };
    list.push(m);
  }
  m.n += n;
  if (kind) m.kinds![kind] = (m.kinds![kind] ?? 0) + n;
  if (extra?.sunk) m.sunk = (m.sunk ?? 0) + extra.sunk;
  if (extra?.taken) m.taken = (m.taken ?? 0) + extra.taken;
}

function addRun(sc: TelemetrySidecar, into: Record<Scope, ScopeData>): void {
  const scopeOfPhase = sc.phases.map((p) => SCOPES.find((s) => s.kinds.includes(p.kind))!.id);
  for (const p of sc.phases) into[scopeOfPhase[p.i]].seconds += (p.t1 ?? sc.seconds) - p.t0;
  const spawns = new Map<number, Spawn>();
  for (const e of sc.events) if (e.k === 'thr+' && !e.back) spawns.set(e.id, e);
  /** Back from what hit to what a launcher first sent: a bomblet to its
   *  cluster, a dropped missile to its bomber, a torpedo to its sub. */
  const root = (id: number | undefined): Spawn | undefined => {
    let e = id === undefined ? undefined : spawns.get(id);
    for (let k = 0; e && k < 8; k++) {
      const up = e.pid ?? e.from;
      const parent = up === undefined ? undefined : spawns.get(up);
      if (!parent || parent === e) break;
      e = parent;
    }
    return e;
  };
  const kinds: Record<Scope, Record<string, number>> = { waves: {}, events: {} };
  const pk = new Map<number, Extract<TelEvent, { k: 'pk+' }>>();
  for (const e of sc.events) {
    const d = into[scopeOfPhase[e.p]];
    if (e.k === 'thr+' && !e.back && e.pid === undefined && e.o !== 'structure' && e.o !== 'seen') {
      d.launches += 1;
      d.byPlatform[platformOf(e)].launches += 1;
      bucket(d.marks.launches, e.x, e.y, 1, platformOf(e), e.kind);
    } else if (e.k === 'hit') {
      if (e.blk) {
        d.blocked += 1;
        continue;
      }
      d.hits += 1;
      const h: Hit = e;
      if (h.vt === 's') {
        d.hpShip += h.hp;
        const c = cellOf(h.vx, h.vy);
        if (c >= 0) d.hpCell[c] += h.hp;
        d.thirds[thirdOf(h.vx)].hp += h.hp;
        if (h.sunk) d.thirds[thirdOf(h.vx)].sunk += 1;
      } else if (h.vt === 'c') d.hpCarrier += h.hp;
      if (h.vt === 'p') continue;
      kinds[scopeOfPhase[e.p]][h.by] = (kinds[scopeOfPhase[e.p]][h.by] ?? 0) + h.hp;
      bucket(d.marks.damage, h.vx, h.vy, h.hp, undefined, h.by, { sunk: h.sunk ? 1 : 0 });
      const from = root(h.src);
      if (from) {
        d.byPlatform[platformOf(from)].hp += h.hp;
        bucket(d.marks.sources, from.x, from.y, h.hp, platformOf(from), h.by);
      }
    } else if (e.k === 'ship+') d.sailed += 1;
    else if (e.k === 'ship-') {
      if (e.why === 'sunk') d.sunk += 1;
      else d.delivered += 1;
    } else if (e.k === 'pk+') {
      pk.set(e.id, e);
      d.pickups.dropped += 1;
    } else if (e.k === 'pk-') {
      const born = pk.get(e.id);
      pk.delete(e.id);
      const at = born ? into[scopeOfPhase[born.p]] : d;
      const taken = e.why === 'collected';
      if (taken) at.pickups.taken += 1;
      else if (e.why === 'expired') at.pickups.expired += 1;
      else at.pickups.cleared += 1;
      bucket(at.marks.pickups, born?.x ?? e.x, born?.y ?? e.y, 1, undefined, e.kind, { taken: taken ? 1 : 0 });
    } else if (e.k === 'tap') d.taps[e.res] += 1;
  }
  for (const [, born] of pk) into[scopeOfPhase[born.p]].pickups.open += 1;
  for (const s of SCOPES) {
    const d = into[s.id];
    const merged = new Map(d.byKind);
    for (const [k, v] of Object.entries(kinds[s.id])) merged.set(k, (merged.get(k) ?? 0) + v);
    d.byKind = [...merged.entries()].sort((a, b) => b[1] - a[1]);
  }
  // Ship-seconds: each ship's stretch between two samples, laid along the line between them.
  const last = new Map<number, { x: number; y: number; t: number }>();
  for (const s of sc.samples) {
    if (s.k !== 'ship@') continue;
    const d = into[scopeOfPhase[s.p]];
    const seen = new Set<number>();
    for (let i = 0; i < s.v.length; i += 3) {
      const [id, x, y] = [s.v[i], s.v[i + 1], s.v[i + 2]];
      seen.add(id);
      const was = last.get(id);
      if (was) {
        const dt = s.t - was.t;
        const N = 5;
        for (let k = 1; k <= N; k++) {
          const px = was.x + ((x - was.x) * k) / N;
          const py = was.y + ((y - was.y) * k) / N;
          const c = cellOf(px, py);
          if (c >= 0) d.exposure[c] += dt / N;
          if (px >= 0 && px <= VIEW.width) d.thirds[thirdOf(px)].shipMinutes += dt / N / 60;
        }
        d.shipMinutes += dt / 60;
      }
      last.set(id, { x, y, t: s.t });
    }
    for (const id of [...last.keys()]) if (!seen.has(id)) last.delete(id);
  }
}

/** The baseline's runs, map by map; or, given play logs (a report), those. */
export function buildPreview(logs?: PlayLog[]): MapPreview[] {
  const sources: { map: MapId; id: string; covers: string; sidecar: () => TelemetrySidecar }[] = logs
    ? logs.map((log) => ({
        map: log.map,
        id: log.id,
        covers: `${log.dev?.bot ? `bot ${log.dev.bot}` : 'a person'}, ${log.lab ? `Test Lab card ${log.lab.card}` : `from wave ${log.firstWave}`}, ended ${log.end ?? 'unfinished'}`,
        sidecar: () => {
          const g = replay(log, { telemetry: true });
          return g.tel!.sidecar(g);
        },
      }))
    : BASELINE.map((r) => ({ map: r.map, id: r.id, covers: r.covers, sidecar: () => sidecarOf(r.id) }));
  const maps = logs ? [...new Set(sources.map((s) => s.map))] : REFERENCE_MAPS;
  return maps.map((map) => {
    const scopes: Record<Scope, ScopeData> = { waves: emptyScope(), events: emptyScope() };
    const runs = sources.filter((r) => r.map === map).map((r) => {
      const sc = r.sidecar();
      addRun(sc, scopes);
      return { id: r.id, covers: r.covers, phases: sc.phases.map((p) => `${p.wave}${p.kind === 'wave' ? '' : p.kind === 'bonusEvent' ? '+bonus' : `:run ${p.run}`}`) };
    });
    return { map, name: MAPS[map].name, runs, scopes };
  });
}

// ---------------------------------------------------------------------------
// Drawing

/** One hue, dark to light: on the dark map, near zero sinks into it and the
 *  most stands out. */
const RAMP_BLUE = ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#cde2fb'];
const RAMP_ORANGE = ['#5c2409', '#8a3610', '#b84a1a', '#d95926', '#ee8a5f', '#f6b79a', '#fde0d2'];
export const RAMPS = { exposure: RAMP_BLUE, risk: RAMP_ORANGE };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const fmt = (v: number) => (Number.isInteger(v) || v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));

function shape(p: Platform, x: number, y: number, r: number, attrs: string): string {
  if (p === 'base') return `<circle cx="${x}" cy="${y}" r="${r}" ${attrs}/>`;
  if (p === 'mobile') return `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="3" ${attrs}/>`;
  return `<polygon points="${x},${y - r * 1.15} ${x + r},${y + r * 0.85} ${x - r},${y + r * 0.85}" ${attrs}/>`;
}

const kindsText = (m: Mark) => Object.entries(m.kinds ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fmt(v)}`).join(', ');
const tip = (text: string) => `<title>${esc(text)}</title>`;
const SURFACE = '#0f161d';

function marksLayer(layer: 'launches' | 'sources', d: ScopeData): string {
  const list = [...d.marks[layer]].sort((a, b) => b.n - a.n);
  const top = Math.max(1, ...list.map((m) => m.n));
  const unit = layer === 'launches' ? 'launches' : 'hull points removed';
  return list
    .map((m) => {
      const p = PLATFORMS.find((o) => o.id === m.platform)!;
      const r = 13 + 34 * Math.sqrt(m.n / top);
      return `<g class="mk" tabindex="0">${shape(m.platform!, m.x, m.y, r, `fill="${p.color}" fill-opacity=".82" stroke="${SURFACE}" stroke-width="4"`)}${tip(`${p.name} at ${m.x}, ${m.y}: ${fmt(m.n)} ${unit} (${kindsText(m)})`)}</g>`;
    })
    .join('') + labels(list.slice(0, 3).map((m) => ({ x: m.x, y: m.y, text: fmt(m.n) })));
}

function damageLayer(d: ScopeData): string {
  const list = [...d.marks.damage].sort((a, b) => b.n - a.n);
  const top = Math.max(1, ...list.map((m) => m.n));
  return list
    .map((m) => {
      const r = 10 + 24 * Math.sqrt(m.n / top);
      const cross = m.sunk ? `<path d="M${m.x - r * 0.6},${m.y - r * 0.6} L${m.x + r * 0.6},${m.y + r * 0.6} M${m.x + r * 0.6},${m.y - r * 0.6} L${m.x - r * 0.6},${m.y + r * 0.6}" stroke="${SURFACE}" stroke-width="5" stroke-linecap="round"/>` : '';
      return `<g class="mk" tabindex="0"><circle cx="${m.x}" cy="${m.y}" r="${r}" fill="#ee8a5f" fill-opacity=".85" stroke="${SURFACE}" stroke-width="4"/>${cross}${tip(`Hulls hit at ${m.x}, ${m.y}: ${fmt(m.n)} hull points removed${m.sunk ? `, ${m.sunk} sunk` : ''} (${kindsText(m)})`)}</g>`;
    })
    .join('');
}

function pickupLayer(d: ScopeData): string {
  return d.marks.pickups
    .map((m) => {
      const taken = m.taken ?? 0;
      const r = 11 + 5 * Math.sqrt(m.n);
      const all = taken === m.n;
      const none = taken === 0;
      return `<g class="mk" tabindex="0"><circle cx="${m.x}" cy="${m.y}" r="${r}" fill="${none ? 'none' : '#9ec5f4'}" fill-opacity="${all ? 0.9 : 0.5}" stroke="#9ec5f4" stroke-width="${none ? 5 : 3}"/>${tip(`Pickups dropped at ${m.x}, ${m.y}: ${m.n} (${kindsText(m)}); ${taken} taken, ${m.n - taken} not`)}</g>`;
    })
    .join('');
}

function labels(list: { x: number; y: number; text: string }[]): string {
  return list.map((l) => `<text x="${Math.max(44, Math.min(VIEW.width - 44, l.x))}" y="${l.y + 9}" text-anchor="middle" font-size="26" font-weight="700" fill="#f0efec" stroke="${SURFACE}" stroke-width="5" paint-order="stroke">${esc(l.text)}</text>`).join('');
}

function gridLayer(kind: 'exposure' | 'risk', d: ScopeData): string {
  const ramp = RAMPS[kind];
  const value = (i: number): number | null => {
    if (kind === 'exposure') return d.exposure[i] > 0.5 ? d.exposure[i] : null;
    if (d.hpCell[i] <= 0) return null;
    return d.exposure[i] >= THIN ? d.hpCell[i] / (d.exposure[i] / 60) : -1;
  };
  const vals = d.exposure.map((_, i) => value(i));
  const top = Math.max(1e-9, ...vals.map((v) => (v === null || v < 0 ? 0 : v)));
  const out: string[] = [];
  const ranked: { x: number; y: number; v: number }[] = [];
  vals.forEach((v, i) => {
    if (v === null) return;
    const x = (i % GRID.w) * GRID.cell;
    const y = Math.floor(i / GRID.w) * GRID.cell;
    const where = `square ${i % GRID.w + 1}, ${Math.floor(i / GRID.w) + 1} (x ${x}-${x + GRID.cell}, y ${y}-${y + GRID.cell})`;
    if (v < 0) {
      out.push(`<g class="mk" tabindex="0"><rect x="${x + 2}" y="${y + 2}" width="${GRID.cell - 4}" height="${GRID.cell - 4}" fill="url(#thin)" stroke="#c3c2b7" stroke-width="2" stroke-dasharray="6 5"/>${tip(`${where}: ${fmt(d.hpCell[i])} hull points lost in only ${fmt(d.exposure[i])} ship-seconds: too little traffic for a rate`)}</g>`);
      return;
    }
    const f = Math.sqrt(v / top);
    const c = ramp[Math.min(ramp.length - 1, Math.floor(f * ramp.length))];
    const text = kind === 'exposure' ? `${fmt(v)} ship-seconds` : `${fmt(v)} hull points per ship-minute (${fmt(d.hpCell[i])} lost in ${fmt(d.exposure[i])} ship-seconds)`;
    out.push(`<g class="mk" tabindex="0"><rect x="${x + 2}" y="${y + 2}" width="${GRID.cell - 4}" height="${GRID.cell - 4}" rx="4" fill="${c}" fill-opacity=".9"/>${tip(`${where}: ${text}`)}</g>`);
    ranked.push({ x: x + GRID.cell / 2, y: y + GRID.cell / 2, v });
  });
  ranked.sort((a, b) => b.v - a.v);
  return out.join('') + labels(ranked.slice(0, 3).map((r) => ({ x: r.x, y: r.y, text: fmt(r.v) })));
}

/** The largest value on a grid layer (the top of its legend). */
export function gridTop(kind: 'exposure' | 'risk', d: ScopeData): number {
  if (kind === 'exposure') return Math.max(0, ...d.exposure);
  return Math.max(0, ...d.exposure.map((e, i) => (e >= THIN && d.hpCell[i] > 0 ? d.hpCell[i] / (e / 60) : 0)));
}

/** One map as an SVG: the game's own map drawing, dimmed, with every layer
 *  for both scopes on top (the page shows one at a time). */
export function renderPreview(p: MapPreview): string {
  // (The diagram renderer draws straight lanes: right for the first five maps. On a map with path lanes the
  // game's own Map Analytics screen has the real picture.)
  const base = renderMap(fromMapDef(MAPS[p.map]));
  const body = base.slice(base.indexOf('>') + 1, base.lastIndexOf('</svg>'));
  const c = MAPS[p.map].carrier;
  const groups = SCOPES.flatMap((s) =>
    LAYERS.map((l) => {
      const d = p.scopes[s.id];
      const inner = l.id === 'launches' || l.id === 'sources' ? marksLayer(l.id, d) : l.id === 'damage' ? damageLayer(d) : l.id === 'pickups' ? pickupLayer(d) : gridLayer(l.id, d);
      return `<g class="lay" data-layer="${l.id}" data-scope="${s.id}"${s.id === 'waves' && l.id === 'sources' ? '' : ' hidden'}>${inner}</g>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" role="img" aria-label="${esc(p.name)}: telemetry of the baseline runs" font-family="system-ui,sans-serif">
<defs><pattern id="thin" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#c3c2b7" stroke-width="3"/></pattern></defs>
<g opacity=".55">${body}</g>
<rect width="1600" height="900" fill="${SURFACE}" opacity=".5"/>
<g class="carrier"><ellipse cx="${c.x}" cy="${c.y}" rx="74" ry="26" fill="none" stroke="#f0efec" stroke-width="4" stroke-dasharray="10 8"/><text x="${c.x}" y="${c.y + 9}" text-anchor="middle" font-size="24" fill="#f0efec">carrier</text></g>
${groups.join('\n')}
</svg>`;
}
