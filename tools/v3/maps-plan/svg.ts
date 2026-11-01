// Draws one map layout as an SVG diagram (1600 x 900, the game's world).
// Existing maps come straight from MAPS in src/v3/data/maps.ts; proposed
// ones from proposed.ts. Both go through `fromMapDef` / the ProposedMap shape.

import { halfWidthAt, type MapDef, type Point } from '../../../src/v3/data/maps';
import { offset, resample, tangents } from './geo';
import type { Feature, Kind, Lane, PBase, ProposedMap } from './proposed';

export const KIND: Record<Kind, { c: string; l: string; name: string }> = {
  drone: { c: '#f5b942', l: 'D', name: 'Drones' },
  ballistic: { c: '#ff7a6b', l: 'B', name: 'Ballistic' },
  guided: { c: '#f58ad0', l: 'G', name: 'Guided' },
  supersonic: { c: '#b99bff', l: 'S', name: 'Supersonic' },
  heavy: { c: '#e7ecf3', l: 'H', name: 'Heavy cruise' },
  cluster: { c: '#ffa36b', l: 'C', name: 'Cluster' },
  mothership: { c: '#5fe0c8', l: 'M', name: 'Mothership' },
  mine: { c: '#ffd6d6', l: 'Mi', name: 'Mines' },
  fastboat: { c: '#9fe0ff', l: 'FB', name: 'Fast boats' },
};

export const COL = {
  sea: '#0d3446',
  seaDeep: '#0a2a39',
  enemy: '#5a2f26',
  enemyEdge: '#ff7d62',
  enemyHill: '#6d3a2e',
  friendly: '#2b5236',
  friendlyEdge: '#8fe0a2',
  friendlyHill: '#356443',
  lane: 'rgba(170, 220, 255, 0.13)',
  laneEdge: 'rgba(190, 230, 255, 0.55)',
  arrow: 'rgba(235, 248, 255, 0.85)',
  road: '#d8b878',
  sub: '#c9b6ff',
  air: 'rgba(230, 236, 245, 0.55)',
  carrier: '#47c1ff',
  frigate: '#9ddcff',
  text: '#f2f6fa',
  gold: '#ffd166',
};

/** Convert a live MapDef into the proposal shape so one renderer draws both. */
export function fromMapDef(m: MapDef): ProposedMap {
  return {
    ...m,
    bases: m.bases.map((b) => ({ x: b.x, y: b.y, kinds: b.kinds as Kind[] })),
    lanes: m.channels.map((ch) => {
      const xs = Array.from({ length: 35 }, (_, i) => -40 + (1680 * i) / 34);
      return {
        path: [{ x: -40, y: ch.y }, { x: 1640, y: ch.y }],
        hw: ch.narrow ? (xs.map((x) => [x, halfWidthAt(ch, x)]) as [number, number][]) : ch.halfWidth,
        share: ch.share,
        speed: ch.speed,
        label: ch.speed && ch.speed > 1 ? `fast lane · ${ch.share ?? 1} group in ${m.channels.reduce((s, c) => s + (c.share ?? 1), 0)}` : undefined,
      };
    }),
    extras: m.extras.map((e) => ({ ...e, kind: e.kind as Kind })),
    features: [],
  };
}

const f = (n: number) => Math.round(n * 10) / 10;
const pts = (p: Point[]) => p.map((q) => `${f(q.x)},${f(q.y)}`).join(' ');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function hwAt(lane: Lane, x: number): number {
  if (typeof lane.hw === 'number') return lane.hw;
  const s = lane.hw;
  if (x <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) {
    if (x <= s[i][0]) {
      const u = (x - s[i - 1][0]) / (s[i][0] - s[i - 1][0]);
      return s[i - 1][1] + (s[i][1] - s[i - 1][1]) * u;
    }
  }
  return s[s.length - 1][1];
}

function laneBand(lane: Lane): { band: string; left: Point[]; right: Point[]; mid: Point[] } {
  const mid = resample(lane.path, 12);
  const left = offset(mid, (_, p) => -hwAt(lane, p.x));
  const right = offset(mid, (_, p) => hwAt(lane, p.x));
  return { band: pts([...left, ...right.reverse()]), left, right: right.reverse(), mid };
}

function chevron(p: Point, t: Point, s: number): string {
  // A ">" pointing along t.
  const n = { x: -t.y, y: t.x };
  const a = { x: p.x - t.x * s + n.x * s * 0.8, y: p.y - t.y * s + n.y * s * 0.8 };
  const b = { x: p.x - t.x * s - n.x * s * 0.8, y: p.y - t.y * s - n.y * s * 0.8 };
  return `<polyline points="${pts([a, p, b])}" fill="none" stroke="${COL.arrow}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function arrowHead(from: Point, to: Point, s: number, color: string): string {
  const dx = to.x - from.x, dy = to.y - from.y;
  const l = Math.hypot(dx, dy) || 1;
  const t = { x: dx / l, y: dy / l };
  const n = { x: -t.y, y: t.x };
  const a = { x: to.x - t.x * s + n.x * s * 0.6, y: to.y - t.y * s + n.y * s * 0.6 };
  const b = { x: to.x - t.x * s - n.x * s * 0.6, y: to.y - t.y * s - n.y * s * 0.6 };
  return `<polygon points="${pts([a, to, b])}" fill="${color}"/>`;
}

function chips(b: PBase): string {
  if (!b.kinds.length) return '';
  const w = 40, h = 32, gap = 4;
  const total = b.kinds.length * w + (b.kinds.length - 1) * gap;
  const up = b.y > 450 ? false : true;
  // North-half bases put chips above (toward the edge) unless that leaves the screen.
  let cy = up ? b.y - 58 : b.y + 34;
  if (up && cy < 2) cy = b.y + 34;
  if (!up && cy + h > 898) cy = b.y - 58;
  let x = Math.max(4, Math.min(1596 - total, b.x - total / 2));
  return b.kinds
    .map((k) => {
      const K = KIND[k];
      const s = `<g><rect x="${f(x)}" y="${f(cy)}" width="${w}" height="${h}" rx="7" fill="${K.c}" stroke="#1b0d0a" stroke-width="2.5"/><text x="${f(x + w / 2)}" y="${f(cy + h / 2 + 1)}" font-size="${K.l.length > 1 ? 19 : 23}" font-weight="800" fill="#1b0d0a" text-anchor="middle" dominant-baseline="middle">${K.l}</text></g>`;
      x += w + gap;
      return s;
    })
    .join('');
}

function base(b: PBase): string {
  if (b.rig) {
    return `<g><rect x="${b.x - 34}" y="${b.y - 30}" width="68" height="60" rx="6" fill="#3a1d17" stroke="${COL.enemyEdge}" stroke-width="5"/>
      <line x1="${b.x - 34}" y1="${b.y - 30}" x2="${b.x + 34}" y2="${b.y + 30}" stroke="${COL.enemyEdge}" stroke-width="3" opacity=".6"/>
      <line x1="${b.x + 34}" y1="${b.y - 30}" x2="${b.x - 34}" y2="${b.y + 30}" stroke="${COL.enemyEdge}" stroke-width="3" opacity=".6"/>
      <circle cx="${b.x}" cy="${b.y}" r="14" fill="#ff5a3d"/>
      <text x="${b.x + 44}" y="${b.y + 9}" font-size="24" font-weight="700" fill="${COL.text}">${b.rig.hp} hp</text></g>${chips(b)}`;
  }
  if (b.generator) {
    const hex = Array.from({ length: 6 }, (_, i) => ({ x: b.x + Math.cos((i * Math.PI) / 3) * 28, y: b.y + Math.sin((i * Math.PI) / 3) * 28 }));
    return `<g><polygon points="${pts(hex)}" fill="#203a46" stroke="#7fe8ff" stroke-width="5"/><text x="${b.x}" y="${b.y + 2}" font-size="26" font-weight="800" fill="#7fe8ff" text-anchor="middle" dominant-baseline="middle">⚡</text>
      <text x="${b.x}" y="${b.y + 56}" font-size="22" font-weight="700" fill="#7fe8ff" text-anchor="middle">GEN ${b.generator.hp} hp</text></g>`;
  }
  if (b.core) {
    return `<g><circle cx="${b.x}" cy="${b.y}" r="46" fill="#3a1712" stroke="${COL.enemyEdge}" stroke-width="7"/><circle cx="${b.x}" cy="${b.y}" r="28" fill="none" stroke="${COL.enemyEdge}" stroke-width="4"/><circle cx="${b.x}" cy="${b.y}" r="12" fill="#ff5a3d"/>
      <text x="${b.x}" y="${b.y + 82}" font-size="24" font-weight="800" fill="${COL.text}" text-anchor="middle">CITADEL ${b.core.hp} hp</text></g>${chips({ ...b, y: b.y - 30 })}`;
  }
  return `<g><circle cx="${b.x}" cy="${b.y}" r="25" fill="#3a1712" stroke="${COL.enemyEdge}" stroke-width="6"/><circle cx="${b.x}" cy="${b.y}" r="10" fill="#ff5a3d"/></g>${chips(b)}`;
}

function carrier(p: Point): string {
  const h = [{ x: -78, y: -21 }, { x: 52, y: -21 }, { x: 80, y: 0 }, { x: 52, y: 21 }, { x: -78, y: 21 }].map((q) => ({ x: p.x + q.x, y: p.y + q.y }));
  return `<g><polygon points="${pts(h)}" fill="${COL.carrier}" stroke="#e8f7ff" stroke-width="4"/><rect x="${p.x + 4}" y="${p.y - 18}" width="22" height="12" fill="#0d3446"/><line x1="${p.x - 66}" y1="${p.y + 4}" x2="${p.x + 40}" y2="${p.y - 8}" stroke="#0d3446" stroke-width="3" stroke-dasharray="10 7"/></g>`;
}

function frigate(p: Point): string {
  const h = [{ x: -30, y: -10 }, { x: 18, y: -10 }, { x: 32, y: 0 }, { x: 18, y: 10 }, { x: -30, y: 10 }].map((q) => ({ x: p.x + q.x, y: p.y + q.y }));
  return `<g><polygon points="${pts(h)}" fill="${COL.frigate}" stroke="#0d3446" stroke-width="3" stroke-dasharray="6 4"/><text x="${p.x}" y="${p.y - 18}" font-size="20" font-weight="800" fill="${COL.frigate}" text-anchor="middle">F</text></g>`;
}

function sub(p: Point): string {
  return `<g><ellipse cx="${p.x}" cy="${p.y}" rx="26" ry="12" fill="#231a44" stroke="${COL.sub}" stroke-width="4"/><rect x="${p.x - 4}" y="${p.y - 26}" width="8" height="16" fill="${COL.sub}"/><rect x="${p.x - 4}" y="${p.y - 26}" width="16" height="6" fill="${COL.sub}"/></g>`;
}

function plane(x: number, y: number, dir: 1 | -1): string {
  const s = dir;
  const P = (a: number, b: number) => `${f(x + a * s)},${f(y + b)}`;
  return `<polygon points="${P(24, 0)} ${P(-4, -6)} ${P(-10, -24)} ${P(-18, -24)} ${P(-14, -6)} ${P(-24, -5)} ${P(-30, -14)} ${P(-34, -14)} ${P(-30, 0)} ${P(-34, 14)} ${P(-30, 14)} ${P(-24, 5)} ${P(-14, 6)} ${P(-18, 24)} ${P(-10, 24)} ${P(-4, 6)}" fill="#e6ecf5"/>`;
}

function label(x: number, y: number, text: string, opts: { size?: number; anchor?: string; color?: string; weight?: number } = {}): string {
  const s = opts.size ?? 26;
  return `<text x="${f(x)}" y="${f(y)}" font-size="${s}" font-weight="${opts.weight ?? 800}" fill="${opts.color ?? COL.text}" text-anchor="${opts.anchor ?? 'middle'}" letter-spacing="1.5" paint-order="stroke" stroke="#06202c" stroke-width="7" stroke-linejoin="round">${esc(text)}</text>`;
}

function feature(ft: Feature, layer: 'under' | 'over'): string {
  switch (ft.kind) {
    case 'water':
      return layer === 'under' ? `<polygon points="${pts(ft.points)}" fill="${COL.sea}" stroke="${COL.friendlyEdge}" stroke-width="3"/>` : '';
    case 'shelter':
      return layer === 'under' ? `<polygon points="${pts(ft.points)}" fill="url(#hatchG)" stroke="${COL.friendlyEdge}" stroke-width="3" stroke-dasharray="10 8" opacity=".9"/>` : label(ft.lx, ft.ly, ft.label, { color: COL.friendlyEdge, size: 24 });
    case 'radar': {
      const rad = (d: number) => (d * Math.PI) / 180;
      if (layer === 'under') {
        const a = { x: ft.x + Math.cos(rad(ft.beam - 14)) * ft.r, y: ft.y + Math.sin(rad(ft.beam - 14)) * ft.r };
        const b = { x: ft.x + Math.cos(rad(ft.beam + 14)) * ft.r, y: ft.y + Math.sin(rad(ft.beam + 14)) * ft.r };
        return `<circle cx="${ft.x}" cy="${ft.y}" r="${ft.r}" fill="rgba(143,224,162,0.06)" stroke="${COL.friendlyEdge}" stroke-width="3" stroke-dasharray="10 9"/>
          <path d="M${ft.x},${ft.y} L${f(a.x)},${f(a.y)} A${ft.r},${ft.r} 0 0 1 ${f(b.x)},${f(b.y)} Z" fill="url(#sweep)"/>`;
      }
      return `<g><rect x="${ft.x - 9}" y="${ft.y - 44}" width="18" height="44" fill="#15391f" stroke="${COL.friendlyEdge}" stroke-width="4"/>
        <path d="M${ft.x - 30},${ft.y - 52} Q${ft.x},${ft.y - 30} ${ft.x + 30},${ft.y - 52}" fill="none" stroke="${COL.friendlyEdge}" stroke-width="6" stroke-linecap="round"/>
        ${label(ft.x, ft.y - 66, `RADAR · ${ft.hp} hp`, { color: COL.friendlyEdge, size: 22 })}
        ${label(ft.x + ft.r - 10, ft.y + 40, 'SWEEP: tracked threats, faster shots', { color: COL.friendlyEdge, size: 22, anchor: 'end' })}</g>`;
    }
    case 'flats':
      return layer === 'under' ? `<polygon points="${pts(ft.points)}" fill="url(#hatchSand)" stroke="#d8c08a" stroke-width="3" stroke-dasharray="12 8"/>` : label(ft.lx, ft.ly, ft.label, { color: '#ead7a4', size: 22, anchor: 'end' });
    case 'lock': {
      if (layer === 'under') return '';
      const top = ft.y - ft.hw - 10, h = ft.hw * 2 + 20;
      return `<rect x="${ft.x0}" y="${top}" width="${ft.x1 - ft.x0}" height="${h}" fill="rgba(255,209,102,0.10)" stroke="${COL.gold}" stroke-width="4" stroke-dasharray="12 8"/>
        <rect x="${ft.x0 - 7}" y="${top - 6}" width="14" height="${h + 12}" fill="${COL.gold}"/><rect x="${ft.x1 - 7}" y="${top - 6}" width="14" height="${h + 12}" fill="${COL.gold}"/>
        <circle cx="${ft.x0}" cy="${top - 22}" r="9" fill="#ff5a5a"/><circle cx="${ft.x1}" cy="${top - 22}" r="9" fill="#4ade80"/>
        ${label((ft.x0 + ft.x1) / 2, ft.y + ft.hw + 46, `${ft.label} · wait ${ft.wait} s`, { color: COL.gold, size: 24 })}`;
    }
    case 'gap':
      return layer === 'under' ? '' : `<line x1="${ft.x0}" y1="${ft.y}" x2="${ft.x1}" y2="${ft.y}" stroke="${COL.gold}" stroke-width="5" stroke-dasharray="4 10" stroke-linecap="round"/>${label((ft.x0 + ft.x1) / 2, ft.y - 52, ft.label, { color: COL.gold, size: 24 })}`;
    case 'queue': {
      if (layer === 'under') return '';
      const dots = [0, 1, 2, 3, 4].map((i) => `<rect x="${ft.x - 80 + i * 34}" y="${ft.y - 6}" width="26" height="12" rx="3" fill="#cfe7f5" opacity="${0.45 + i * 0.1}"/>`).join('');
      return `${dots}${label(ft.x - 10, ft.y + 46, ft.label, { color: COL.gold, size: 22 })}`;
    }
    case 'battery':
      return layer === 'under'
        ? `<circle cx="${ft.x}" cy="${ft.y}" r="${ft.reach}" fill="rgba(143,224,162,0.07)" stroke="${COL.friendlyEdge}" stroke-width="3" stroke-dasharray="10 9"/>`
        : `<g><circle cx="${ft.x}" cy="${ft.y}" r="22" fill="#15391f" stroke="${COL.friendlyEdge}" stroke-width="5"/><line x1="${ft.x}" y1="${ft.y}" x2="${ft.x + 8}" y2="${ft.y - 40}" stroke="${COL.friendlyEdge}" stroke-width="8" stroke-linecap="round"/></g>`;
    case 'mines': {
      if (layer === 'under') return `<line x1="${ft.from.x}" y1="${ft.from.y}" x2="${ft.to.x}" y2="${ft.to.y}" stroke="#ffb3b3" stroke-width="3" stroke-dasharray="6 10" opacity=".8"/>${arrowHead(ft.from, ft.to, 22, '#ffb3b3')}`;
      const mine = (p: Point) => {
        const spikes = Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return `<line x1="${f(p.x + Math.cos(a) * 10)}" y1="${f(p.y + Math.sin(a) * 10)}" x2="${f(p.x + Math.cos(a) * 18)}" y2="${f(p.y + Math.sin(a) * 18)}" stroke="#ffd6d6" stroke-width="4"/>`;
        }).join('');
        return `<g>${spikes}<circle cx="${p.x}" cy="${p.y}" r="12" fill="#3b1010" stroke="#ffd6d6" stroke-width="3"/><circle cx="${p.x}" cy="${p.y}" r="4" fill="#ff5a5a"/></g>`;
      };
      return `<g><rect x="${ft.from.x - 22}" y="${ft.from.y - 30}" width="44" height="22" rx="4" fill="#3a1d17" stroke="#ffb3b3" stroke-width="3"/>${ft.mines.map(mine).join('')}</g>`;
    }
    case 'night':
      return layer === 'under' ? '' : `<rect x="0" y="0" width="1600" height="900" fill="#020a12" opacity=".42"/>${label(1590, 40, '☾ NIGHT', { anchor: 'end', color: '#cfe0ff', size: 26 })}`;
    case 'searchlight': {
      const rad = (d: number) => (d * Math.PI) / 180;
      const P = (d: number, r: number) => ({ x: ft.x + Math.cos(rad(d)) * r, y: ft.y + Math.sin(rad(d)) * r });
      if (layer === 'under') return '';
      const a = P(ft.beam - ft.width / 2, ft.r), b = P(ft.beam + ft.width / 2, ft.r);
      const sweep = Array.from({ length: 25 }, (_, i) => P(ft.a0 + ((ft.a1 - ft.a0) * i) / 24, 330));
      return `<polygon points="${pts([{ x: ft.x, y: ft.y }, a, b])}" fill="url(#beam)"/>
        <polyline points="${pts(sweep)}" fill="none" stroke="#ffe9a8" stroke-width="3" stroke-dasharray="8 10" opacity=".8"/>${arrowHead(sweep[22], sweep[24], 20, '#ffe9a8')}
        <circle cx="${ft.x}" cy="${ft.y}" r="14" fill="#ffe9a8" stroke="#3b2a00" stroke-width="3"/>`;
    }
    case 'boss': {
      if (layer === 'under') {
        return `<polyline points="${pts(ft.path)}" fill="none" stroke="#ff6b57" stroke-width="5" stroke-dasharray="20 14" opacity=".9"/>`;
      }
      const y = ft.path[0].y;
      const x = ft.at;
      const dir = ft.path[ft.path.length - 1].x < ft.path[0].x ? -1 : 1;
      const hull = [{ x: -120, y: -26 }, { x: 95, y: -26 }, { x: 135, y: 0 }, { x: 95, y: 26 }, { x: -120, y: 26 }].map((q) => ({ x: x + q.x * dir, y: y + q.y }));
      const tur = [-70, -10, 50].map((dx) => `<circle cx="${x + dx * dir}" cy="${y}" r="13" fill="#ff5a3d" stroke="#1b0d0a" stroke-width="3"/><line x1="${x + dx * dir}" y1="${y}" x2="${x + dx * dir}" y2="${y + 44}" stroke="#ff5a3d" stroke-width="6"/>`).join('');
      const arrows = [300, 650, 1450].map((ax) => arrowHead({ x: ax - dir * 10, y }, { x: ax + dir * 20, y }, 26, '#ff6b57')).join('');
      return `${arrows}<polygon points="${pts(hull)}" fill="#4a1f19" stroke="${COL.enemyEdge}" stroke-width="5"/>${tur}${label(x, y - 46, ft.label, { color: '#ffb2a3', size: 24 })}`;
    }
    case 'boatRun':
      return layer === 'under'
        ? `<line x1="${ft.from.x}" y1="${ft.from.y}" x2="${ft.to.x}" y2="${ft.to.y}" stroke="#9fe0ff" stroke-width="5" stroke-dasharray="14 9"/>${arrowHead(ft.from, ft.to, 26, '#9fe0ff')}`
        : `<g><rect x="${ft.from.x - 22}" y="${ft.from.y - 16}" width="44" height="32" rx="7" fill="#9fe0ff" stroke="#1b0d0a" stroke-width="2.5"/><text x="${ft.from.x}" y="${ft.from.y + 1}" font-size="19" font-weight="800" fill="#1b0d0a" text-anchor="middle" dominant-baseline="middle">FB</text></g>`;
    case 'switch':
      return layer === 'under' ? '' : `<g><circle cx="${ft.x}" cy="${ft.y}" r="30" fill="${COL.gold}" stroke="#3b2a00" stroke-width="4"/><text x="${ft.x}" y="${ft.y + 2}" font-size="34" font-weight="900" fill="#3b2a00" text-anchor="middle" dominant-baseline="middle">⑂</text>${label(ft.x, ft.y + 66, ft.label, { color: COL.gold, size: 24 })}</g>`;
    case 'shield':
      return layer === 'under' ? '' : `<circle cx="${ft.x}" cy="${ft.y}" r="${ft.r}" fill="rgba(127,232,255,0.08)" stroke="#7fe8ff" stroke-width="5" stroke-dasharray="16 10"/>${label(ft.x, ft.y - ft.r - 14, 'SHIELD', { color: '#7fe8ff', size: 24 })}`;
    case 'note':
      return layer === 'under' ? '' : label(ft.x, ft.y, ft.text, { anchor: ft.anchor ?? 'middle', color: '#e7f3ff', size: 24 });
  }
}

export function renderMap(m: ProposedMap, opts: { tray?: boolean } = {}): string {
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" font-family="'Barlow Condensed','Arial Narrow',system-ui,sans-serif" role="img" aria-label="${esc(m.name)} layout">`);
  out.push(`<defs>
    <pattern id="hatchG" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="18" fill="rgba(143,224,162,0.10)"/><line x1="0" y1="0" x2="0" y2="18" stroke="rgba(143,224,162,0.45)" stroke-width="5"/></pattern>
    <pattern id="hatchSand" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="20" height="20" fill="rgba(216,192,138,0.16)"/><line x1="0" y1="0" x2="0" y2="20" stroke="rgba(216,192,138,0.42)" stroke-width="4"/></pattern>
    <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff3c4" stop-opacity=".7"/><stop offset="1" stop-color="#fff3c4" stop-opacity=".08"/></linearGradient>
    <radialGradient id="sweep" cx="0" cy="0" r="1"><stop offset="0" stop-color="#8fe0a2" stop-opacity=".05"/><stop offset="1" stop-color="#8fe0a2" stop-opacity=".35"/></radialGradient>
    <clipPath id="frame"><rect width="1600" height="900"/></clipPath>
  </defs>`);
  out.push(`<g clip-path="url(#frame)">`);
  out.push(`<rect width="1600" height="900" fill="${COL.sea}"/>`);
  // Land.
  for (const l of m.land) {
    const fill = l.side === 'enemy' ? COL.enemy : COL.friendly;
    const edge = l.side === 'enemy' ? COL.enemyEdge : COL.friendlyEdge;
    out.push(`<polygon points="${pts(l.points)}" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`);
    // Contour rings only read on a free-standing island (not land tied to the frame).
    if (l.hill && !l.points.some((p) => p.x <= 0 || p.x >= 1600 || p.y <= 0 || p.y >= 900)) {
      const cx = l.points.reduce((s, p) => s + p.x, 0) / l.points.length;
      const cy = l.points.reduce((s, p) => s + p.y, 0) / l.points.length;
      for (const k of [0.66, 0.36]) {
        const ring = l.points.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
        out.push(`<polygon points="${pts(ring)}" fill="${l.side === 'enemy' ? COL.enemyHill : COL.friendlyHill}" stroke="${edge}" stroke-width="2" opacity=".55"/>`);
      }
    }
  }
  for (const ft of m.features) out.push(feature(ft, 'under'));
  // Lanes.
  for (const lane of m.lanes) {
    const { band, left, right, mid } = laneBand(lane);
    const tideDash = lane.tide ? ' stroke-dasharray="18 12"' : '';
    out.push(`<polygon points="${band}" fill="${lane.tide ? 'rgba(127,232,255,0.10)' : lane.vip ? 'rgba(255,209,102,0.12)' : COL.lane}" stroke="none"/>`);
    out.push(`<polyline points="${pts(left)}" fill="none" stroke="${lane.tide ? '#7fe8ff' : lane.vip ? COL.gold : COL.laneEdge}" stroke-width="3"${tideDash || ' stroke-dasharray="3 9"'}/>`);
    out.push(`<polyline points="${pts(right)}" fill="none" stroke="${lane.tide ? '#7fe8ff' : lane.vip ? COL.gold : COL.laneEdge}" stroke-width="3"${tideDash || ' stroke-dasharray="3 9"'}/>`);
    const t = tangents(mid);
    const step = Math.max(8, Math.round(190 / 12));
    for (let i = step; i < mid.length - 4; i += step) {
      if (mid[i].x < 10 || mid[i].x > 1590 || mid[i].y < 10 || mid[i].y > 890) continue;
      out.push(chevron(mid[i], t[i], 20));
    }
  }
  for (const ft of m.features) if (ft.kind === 'night') out.push(feature(ft, 'over'));
  // Roads.
  for (const r of m.roads.runners) out.push(`<polyline points="${pts(r)}" fill="none" stroke="${COL.road}" stroke-width="7" stroke-dasharray="16 10" stroke-linecap="round" opacity=".9"/>`);
  for (const p of m.roads.popups) {
    out.push(`<line x1="${p.from.x}" y1="${p.from.y}" x2="${p.to.x}" y2="${p.to.y}" stroke="${COL.road}" stroke-width="7" stroke-dasharray="16 10" stroke-linecap="round"/>`);
    out.push(arrowHead(p.from, p.to, 26, COL.road));
    if (p.from.x > 0 && p.from.x < 1600 && p.from.y > 0 && p.from.y < 900) out.push(`<rect x="${p.from.x - 16}" y="${p.from.y - 12}" width="32" height="24" rx="12" fill="#140b07" stroke="${COL.road}" stroke-width="4"/>`);
  }
  // Aircraft lines.
  for (const y of m.bomberLines) {
    out.push(`<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="${COL.air}" stroke-width="3" stroke-dasharray="4 14"/>`);
    out.push(plane(52, y, 1), plane(1548, y, -1));
  }
  for (const [a, b] of m.airLines ?? []) {
    out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${COL.air}" stroke-width="3" stroke-dasharray="4 14"/>`);
    const vy = Math.max(40, Math.min(860, a.y < 0 ? 52 : a.y));
    out.push(`<g transform="rotate(90 ${a.x} ${vy})">${plane(a.x, vy, 1)}</g>`);
  }
  for (const s of m.subSpots) out.push(sub(s));
  // Tray (where notices sit) — faint, for the builder.
  if (opts.tray !== false) {
    const a = m.alerts;
    out.push(`<rect x="${a.x0}" y="${a.y - 34}" width="${a.x1 - a.x0}" height="34" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" stroke-dasharray="6 8"/>`);
  }
  for (const ft of m.features) if (ft.kind !== 'night') out.push(feature(ft, 'over'));
  // Lane labels.
  for (const lane of m.lanes) {
    if (!lane.label) continue;
    const mid = resample(lane.path, 12);
    let i = Math.round(mid.length * (lane.labelAt ?? 0.08));
    const inside = (q: Point) => q.x >= 30 && q.x <= 1570 && q.y <= 880 && q.y >= 20;
    while (i < mid.length - 1 && !inside(mid[i])) i++;
    const p = mid[i];
    const w = hwAt(lane, p.x);
    const westward = lane.path[lane.path.length - 1].x < lane.path[0].x;
    const ly = p.y - w - 12 < 30 ? p.y + w + 34 : p.y - w - 12;
    out.push(label(westward ? Math.min(1586, p.x) : Math.max(14, p.x), ly, lane.label, { anchor: westward ? 'end' : 'start', size: 24, color: lane.tide ? '#7fe8ff' : lane.vip ? COL.gold : '#cfe9fa' }));
  }
  for (const b of m.bases) out.push(base(b));
  out.push(frigate(m.frigate));
  out.push(carrier(m.carrier));
  out.push(`</g></svg>`);
  return out.join('\n');
}
