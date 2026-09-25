// REGION WORKSHOP — the Round Planner, the workshop's default view.
//
// One question per screen: "what does the enemy do in THIS round?" The map is
// the editor. A round is either AUTO (the adaptive enemy spends its budget from
// the region's menu) or SCRIPTED (exactly the attacks listed, nothing more).
// A scripted attack is one weapon, one place on the map, one count and one
// timing pattern — so "try a five-missile salvo instead of three" is one tap on
// a + button, and the preview under the map replays the real round with the
// change in it a moment later.
//
// Every mutation goes through the pure helpers in data/regionAuthoring.ts'
// schema; this module only arranges the DOM and owns transient view state
// (selected round/attack, preview playback). It rebuilds ITSELF on an edit
// rather than asking the host to re-render the screen, so the playing preview,
// a drag in progress and the scroll position all survive typing a number.

import { h } from './dom';
import { icon, type IconName } from './icons';
import { ENEMY_BRANCHES, ENEMY_BRANCH_ORDER, type EnemyBranchKey } from '../data/enemyBranches';
import { geography, islandHalfHeight, type Geography } from '../data/geography';
import { ROUND1, WORLD } from '../data/tuning';
import {
  ATTACK_DEFAULTS,
  ATTACK_PATTERNS,
  arsenalEntries,
  attackFamily,
  availabilityAtRound,
  compileRegion,
  deleteRound,
  duplicateRound,
  environmentPreset,
  extrapolateRound,
  roundAdapts,
  scaledCount,
  type ScaleMode,
  insertRound,
  milestoneAt,
  pressureAtRound,
  pruneMilestone,
  runtimeAttack,
  type ArsenalEntry,
  type AttackPattern,
  type CompiledRegion,
  type RegionAuthoringDef,
  type ScriptedAttack,
  type ValidationIssue,
} from '../data/regionAuthoring';
import { launchTimes } from '../sim/scriptedPlan';
import { runPreview, type PreviewFrame, type PreviewRequest, type PreviewResult, type PreviewSummary } from './workshopPreviewSim';
import type { PreviewReply } from './previewWorker';
import { enhanceTable } from './tableKit';
import { SCRIPT_SCALE_MAX, SCRIPT_SCALE_MIN } from '../sim/evolution';

// ---------------------------------------------------------------------------
// Host contract
// ---------------------------------------------------------------------------

export interface PlannerCtx {
  def: RegionAuthoringDef;
  readOnly: boolean;
  issues: () => ValidationIssue[];
  /** Called after every edit (marks the draft dirty, refreshes header chrome). */
  changed: () => void;
  /** Clone a read-only template into an editable draft. */
  onClone?: () => void;
  /** The selected round changed (the host's Play button follows it). */
  roundChanged?: () => void;
}

// ---------------------------------------------------------------------------
// View state (module scope: survives the host re-rendering the screen)
// ---------------------------------------------------------------------------

interface CompareRow {
  pattern: AttackPattern;
  summary: PreviewSummary | null;
}

interface PlannerState {
  regionKey: string;
  round: number;
  attackId: string | null;
  defences: boolean;
  seed: string;
  speed: number;
  preview: PreviewResult | null;
  /** Key of the request in flight / last answered. */
  previewKey: string;
  /** Key of the most recently SCHEDULED request (debounced). */
  scheduledKey: string;
  pending: boolean;
  error: string | null;
  playing: boolean;
  playT: number;
  compare: { attackId: string; key: string; rows: CompareRow[] } | null;
  /** Attacks removed by switching a round back to Auto, so switching again
   *  restores them rather than starting over. */
  stash: Record<number, ScriptedAttack[]>;
  /** The "scale this round to later rounds" tool. */
  scale: { open: boolean; to: number; amount: number; mode: ScaleMode };
  /** One-line confirmation shown after a bulk action (cleared on next edit). */
  flash: string | null;
}

let ps: PlannerState = freshState('');

function freshState(regionKey: string): PlannerState {
  return {
    regionKey,
    round: 1,
    attackId: null,
    defences: true,
    seed: 'preview-1',
    speed: 6,
    preview: null,
    previewKey: '',
    scheduledKey: '',
    pending: false,
    error: null,
    playing: false,
    playT: 0,
    compare: null,
    stash: {},
    scale: { open: false, to: 0, amount: 2, mode: 'add' },
    flash: null,
  };
}

/** Called by the workshop when a region is opened. */
export function resetPlanner(regionKey: string): void {
  ps = freshState(regionKey);
}

export function plannerRound(): number {
  return ps.round;
}

/** Jump the planner to a round (e.g. keep the designer's place across a clone). */
export function setPlannerRound(round: number): void {
  ps.round = Math.max(1, Math.floor(round));
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const BRANCH_COLOR: Record<EnemyBranchKey, string> = {
  missiles: '#ff6f5e',
  mines: '#c792ea',
  torpedoes: '#56cfe0',
  attackBoats: '#ffb454',
  artillery: '#e6ecd9',
  smoke: '#93a284',
  electronic: '#93a284',
};

const BRANCH_ICON: Record<EnemyBranchKey, IconName> = {
  missiles: 'missile',
  mines: 'mine',
  torpedoes: 'sonar',
  attackBoats: 'escortShip',
  artillery: 'turret',
  smoke: 'eye',
  electronic: 'jam',
};

/** Short plural nouns for the one-line attack summaries. */
const NODE_NOUN: Record<string, [string, string]> = {
  unguided: ['unguided missile', 'unguided missiles'],
  guided: ['guided missile', 'guided missiles'],
  standard: ['mine', 'mines'],
  lowSig: ['low-signature mine', 'low-signature mines'],
  straight: ['torpedo', 'torpedoes'],
  homing: ['homing torpedo', 'homing torpedoes'],
  lowSigTorpedo: ['quiet torpedo', 'quiet torpedoes'],
  smallArms: ['gunboat', 'gunboats'],
  rocket: ['rocket boat', 'rocket boats'],
  boarding: ['boarding boat', 'boarding boats'],
  coastalGun: ['coastal gun', 'coastal guns'],
  ranging: ['ranging gun', 'ranging guns'],
  rollingBarrage: ['barrage gun', 'barrage guns'],
};

const PATTERN_LABEL: Record<AttackPattern, string> = {
  salvo: 'Salvo',
  volleys: 'Volleys',
  stream: 'Stream',
  spread: 'Spread',
};

const PATTERN_HINT: Record<AttackPattern, string> = {
  salvo: 'all at once',
  volleys: 'in groups',
  stream: 'one by one',
  spread: 'across the crossing',
};

/** Weapons a scripted attack can use: implemented, with a place on the map. */
function scriptableEntries(): ArsenalEntry[] {
  return arsenalEntries().filter((e) => e.implemented && attackFamily(e.branch) !== null);
}

function noun(nodeId: string, n: number): string {
  const pair = NODE_NOUN[nodeId];
  if (!pair) return nodeId;
  return n === 1 ? pair[0] : pair[1];
}

function clock(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Plain-English description of one attack. */
export function describeAttack(a: ScriptedAttack): string {
  const family = attackFamily(a.ref.branch);
  const n = a.count;
  const what = `${n} ${noun(a.ref.nodeId, n)}`;
  if (family === 'field') return `${what} laid as a field at the marker.`;
  if (family === 'emplaced') return `${what} dug in on the shore at the marker, firing all round.`;
  const r = runtimeAttack(a);
  switch (r.pattern) {
    case 'salvo':
      return `${what} fired together at ${clock(r.start)}.`;
    case 'volleys': {
      const volleys = Math.ceil(n / r.perVolley);
      return volleys <= 1
        ? `${what} fired together at ${clock(r.start)}.`
        : `${what} in ${volleys} volleys of ${Math.min(r.perVolley, n)}, every ${r.gap}s from ${clock(r.start)}.`;
    }
    case 'stream':
      return `${what}, one every ${r.gap}s from ${clock(r.start)} to ${clock(r.start + (n - 1) * r.gap)}.`;
    case 'spread':
      return `${what} spread evenly from ${clock(r.start)} to the end of the crossing.`;
  }
}

// ---------------------------------------------------------------------------
// Preview plumbing
// ---------------------------------------------------------------------------

let worker: Worker | null | undefined;
let requestSeq = 0;
const pendingCallbacks = new Map<number, (r: PreviewResult | null, err: string | null) => void>();

function previewWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./previewWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<PreviewReply>) => {
      const cb = pendingCallbacks.get(ev.data.id);
      if (!cb) return;
      pendingCallbacks.delete(ev.data.id);
      if (ev.data.type === 'done') cb(ev.data.result, null);
      else cb(null, ev.data.message);
    };
    worker.onerror = () => {
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

function simulate(req: PreviewRequest, cb: (r: PreviewResult | null, err: string | null) => void): void {
  const id = ++requestSeq;
  const w = previewWorker();
  if (w) {
    pendingCallbacks.set(id, cb);
    w.postMessage({ id, req });
    return;
  }
  // No worker (old browser / test harness): same function on the main thread.
  setTimeout(() => {
    try {
      cb(runPreview(req), null);
    } catch (err) {
      cb(null, err instanceof Error ? err.message : String(err));
    }
  }, 0);
}

function previewKeyFor(def: RegionAuthoringDef): string {
  return JSON.stringify([def, ps.round, ps.defences, ps.seed]);
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/** Mounted root and its render closure, so async preview replies can refresh
 *  the right element. */
let mounted: { root: HTMLElement; render: () => void } | null = null;
let previewTimer: number | undefined;
let rafHandle = 0;
let lastFrameAt = 0;

export function plannerView(ctx: PlannerCtx): HTMLElement {
  const def = ctx.def;
  ps.round = Math.max(1, Math.min(def.completionRound, ps.round));
  const root = h('div', { className: 'pl' });

  const commit = (opts: { keepCompare?: boolean; keepFlash?: boolean } = {}) => {
    if (!opts.keepCompare) ps.compare = null;
    if (!opts.keepFlash) ps.flash = null;
    ctx.changed();
    render();
    schedulePreview(ctx);
  };

  const render = () => {
    const compiled = compileRegion(def);
    const issues = ctx.issues();
    // Rebuilding in place must not move the page. Swapping every child out at
    // once leaves the scroll box momentarily shorter and loses the browser's
    // scroll anchor, so a tap on "+" threw the designer back up the screen.
    // Save every scroll position this view owns and put them back.
    const restore = saveScroll(root);
    root.replaceChildren(
      ...(ctx.readOnly ? [readOnlyBanner(ctx)] : []),
      regionBar(ctx, compiled, commit),
      roundStrip(ctx, compiled, commit),
      h('div', { className: 'pl-main' }, [
        h('div', { className: 'pl-mapcol' }, [mapPanel(ctx, compiled, commit), playerBar(ctx), resultPanel(ctx, commit)]),
        sidePanel(ctx, compiled, issues, commit),
      ]),
      overviewTable(ctx, compiled, commit),
    );
    restore();
    drawLive();
  };
  mounted = { root, render };
  render();
  // First paint: fetch a preview for whatever round is showing (a no-op when
  // the current state is already previewed or scheduled).
  schedulePreview(ctx, 0);
  startLoop();
  return root;
}

/** Snapshot the scroll positions around and inside the planner; the returned
 *  function puts them back after a rebuild. */
function saveScroll(root: HTMLElement): () => void {
  const body = root.closest('.screen-body') as HTMLElement | null;
  const top = body?.scrollTop ?? 0;
  const inner = ['.pl-rounds', '.pl-overview-wrap .ws-scroll'].map((sel) => {
    const el = root.querySelector(sel) as HTMLElement | null;
    return { sel, left: el?.scrollLeft ?? 0, top: el?.scrollTop ?? 0 };
  });
  return () => {
    if (body) body.scrollTop = top;
    for (const s of inner) {
      const el = root.querySelector(s.sel) as HTMLElement | null;
      if (!el) continue;
      el.scrollLeft = s.left;
      el.scrollTop = s.top;
    }
  };
}

function selectRound(r: number, ctx: PlannerCtx): void {
  if (ps.round === r) return;
  ps.round = r;
  ps.attackId = null;
  ps.compare = null;
  mounted?.render();
  ctx.roundChanged?.();
  schedulePreview(ctx, 0);
}

function schedulePreview(ctx: PlannerCtx, delay = 350): void {
  const key = previewKeyFor(ctx.def);
  // Deduplicate against what was last SCHEDULED, not what last came back: an
  // edit reverted inside the debounce must cancel the intermediate request.
  if (key === ps.scheduledKey) return;
  ps.scheduledKey = key;
  window.clearTimeout(previewTimer);
  ps.pending = true;
  ps.error = null;
  updatePlayerChrome();
  previewTimer = window.setTimeout(() => {
    const req: PreviewRequest = { def: JSON.parse(JSON.stringify(ctx.def)), round: ps.round, seed: ps.seed, defences: ps.defences };
    ps.previewKey = key;
    simulate(req, (result, err) => {
      if (ps.previewKey !== key) return; // superseded by a newer edit
      ps.pending = false;
      ps.error = err;
      ps.preview = result;
      if (result) {
        // Start just before the action so a salvo at 0:20 is not 20s of
        // empty water at the top of every replay.
        const first = result.launches.length ? result.launches[0].t : 0;
        ps.playT = Math.max(0, first - 4);
        ps.playing = true;
      }
      mounted?.render();
    });
  }, delay);
}

// --- read-only banner ----------------------------------------------------------

function readOnlyBanner(ctx: PlannerCtx): HTMLElement {
  return h('div', { className: 'pl-banner' }, [
    icon('lock'),
    h('span', { text: ' Built-in region — you can look around and preview it. Clone it to change anything.' }),
    ...(ctx.onClone ? [h('button', { className: 'primary', text: 'Clone to edit', onClick: ctx.onClone })] : []),
  ]);
}

// --- region-wide controls -------------------------------------------------------------

const ADAPT_HINT =
  `Scripted rounds scale with the player: up to ×${SCRIPT_SCALE_MAX} when they are cruising, down to ×${SCRIPT_SCALE_MIN} when they are struggling — ` +
  'the same signal the Auto enemy’s budget follows. Your counts are the middle of that range.';

function regionBar(ctx: PlannerCtx, compiled: CompiledRegion, commit: (o?: { keepFlash?: boolean }) => void): HTMLElement {
  const def = ctx.def;
  const on = !!def.scriptAdapt;
  const overrides = def.milestones.filter((m) => m.attacks && m.adapt !== undefined && m.adapt !== on).length;
  const scriptedCount = Object.keys(compiled.attacks).length;
  return h('div', { className: 'pl-regionbar' }, [
    h('span', { className: 'pl-label', text: 'Whole region' }),
    h('button', {
      className: on ? 'dev-toggle on' : 'dev-toggle',
      text: on ? 'Adapt to player: ON' : 'Adapt to player: OFF',
      disabled: ctx.readOnly,
      attrs: { title: ADAPT_HINT, 'aria-pressed': String(on) },
      onClick: () => {
        def.scriptAdapt = !on;
        if (!def.scriptAdapt) delete def.scriptAdapt;
        // "Apply to the whole region" means every round: clear the per-round
        // overrides so nothing silently disagrees with the switch.
        for (const m of def.milestones) {
          delete m.adapt;
          pruneMilestone(def, m.round);
        }
        ps.flash = `${def.scriptAdapt ? 'All' : 'No'} scripted rounds adapt to the player now${scriptedCount ? ` (${scriptedCount} scripted)` : ''}.`;
        commit({ keepFlash: true });
      },
    }),
    h('span', {
      className: 'hint',
      text: overrides ? `${overrides} round${overrides === 1 ? '' : 's'} set differently` : 'applies to every scripted round',
    }),
    ...(ps.flash ? [h('span', { className: 'pl-flash', text: ps.flash })] : []),
  ]);
}

// --- round strip ------------------------------------------------------------------

function roundSummaryChips(compiled: CompiledRegion, r: number): HTMLElement {
  const attacks = compiled.attacks[r];
  const wrap = h('span', { className: 'pl-chipline' });
  if (!attacks) {
    wrap.append(h('span', { className: 'pl-auto', text: 'auto' }));
    return wrap;
  }
  if (attacks.length === 0) {
    wrap.append(h('span', { className: 'pl-auto', text: 'quiet' }));
    return wrap;
  }
  const byBranch = new Map<EnemyBranchKey, number>();
  for (const a of attacks) byBranch.set(a.ref.branch, (byBranch.get(a.ref.branch) ?? 0) + a.count);
  for (const [branch, n] of byBranch) {
    const chip = h('span', { className: 'pl-mini' }, [icon(BRANCH_ICON[branch]), h('span', { text: String(n) })]);
    chip.style.color = BRANCH_COLOR[branch];
    wrap.append(chip);
  }
  return wrap;
}

function roundStrip(ctx: PlannerCtx, compiled: CompiledRegion, commit: () => void): HTMLElement {
  const def = ctx.def;
  const strip = h('div', { className: 'pl-rounds', attrs: { role: 'tablist' } });
  const issues = ctx.issues();
  for (let r = 1; r <= def.completionRound; r++) {
    const bad = issues.some((i) => i.round === r && i.severity === 'error');
    const btn = h(
      'button',
      {
        className: `pl-round ${r === ps.round ? 'on' : ''} ${compiled.attacks[r] ? 'scripted' : ''} ${bad ? 'bad' : ''}`.trim(),
        attrs: { 'data-round': String(r), role: 'tab', 'aria-selected': String(r === ps.round) },
        onClick: () => selectRound(r, ctx),
      },
      [h('span', { className: 'pl-round-n', text: `R${r}` }), roundSummaryChips(compiled, r)],
    );
    strip.append(btn);
  }
  if (!ctx.readOnly) {
    strip.append(
      h('div', { className: 'pl-round-count' }, [
        h('button', {
          text: '−',
          attrs: { 'aria-label': 'Remove last round', title: 'Remove the last round' },
          disabled: def.completionRound <= 1,
          onClick: () => {
            deleteRound(def, def.completionRound);
            ps.round = Math.min(ps.round, def.completionRound);
            commit();
          },
        }),
        h('span', { text: `${def.completionRound} rounds` }),
        h('button', {
          text: '+',
          attrs: { 'aria-label': 'Add a round', title: 'Add a round at the end' },
          onClick: () => {
            def.completionRound++;
            commit();
          },
        }),
      ]),
    );
  }
  return strip;
}

// --- map ------------------------------------------------------------------------------

/** The slice of the world the planner shows: the water, both shorelines and a
 *  strip of each coast. The deep hinterland is scenery. */
const VIEW = { x: 0, y: 800, w: WORLD.width, h: 1700 };

function mapSvgBase(geo: Geography): string {
  const W = WORLD.width;
  const step = W / 80;
  const pts = (fn: (x: number) => number) => {
    const out: string[] = [];
    for (let x = 0; x <= W; x += step) out.push(`${x.toFixed(0)},${fn(x).toFixed(0)}`);
    return out.join(' ');
  };
  const top = VIEW.y - 10;
  const bottom = VIEW.y + VIEW.h + 10;
  let lanes = '';
  for (let i = 0; i < geo.laneCount; i++) {
    lanes += `<polyline points="${pts((x) => geo.laneY(i, x))}" fill="none" stroke="#56cfe0" stroke-width="6" stroke-dasharray="40 50" opacity="0.35"/>`;
  }
  const islands = geo.islands
    .map((island) => {
      const upper: string[] = [];
      const lower: string[] = [];
      for (let x = island.fromX; x <= island.toX; x += 20) {
        const hh = islandHalfHeight(island, x);
        upper.push(`${x.toFixed(0)},${(island.centerY - hh).toFixed(0)}`);
        lower.unshift(`${x.toFixed(0)},${(island.centerY + hh).toFixed(0)}`);
      }
      return `<polygon points="${upper.join(' ')} ${lower.join(' ')}" fill="#3a3f2a" stroke="#6b7355" stroke-width="6"/>`;
    })
    .join('');
  const sites = geo.launchSites
    .map((s) => `<circle cx="${s.x}" cy="${geo.launchY(s.x)}" r="26" fill="none" stroke="#ff6f5e" stroke-width="5" stroke-dasharray="10 8" opacity="0.55"/>`)
    .join('');
  return (
    `<rect x="${VIEW.x}" y="${top}" width="${VIEW.w}" height="${bottom - top}" fill="#0f2a33"/>` +
    `<polygon points="0,${top} ${pts((x) => geo.hostileShoreY(x))} ${W},${top}" fill="#3a3f2a"/>` +
    `<polygon points="0,${bottom} ${pts((x) => geo.friendlyShoreY(x))} ${W},${bottom}" fill="#2f3a26"/>` +
    `<polyline points="${pts((x) => geo.launchY(x))}" fill="none" stroke="#ff6f5e" stroke-width="4" stroke-dasharray="6 26" opacity="0.35"/>` +
    lanes +
    islands +
    sites +
    `<line x1="${WORLD.deliverX}" y1="${top}" x2="${WORLD.deliverX}" y2="${bottom}" stroke="#52e595" stroke-width="6" stroke-dasharray="20 20" opacity="0.4"/>` +
    `<text x="40" y="${top + 90}" fill="#93a284" font-size="64" font-family="monospace">ENEMY SHORE</text>` +
    `<text x="${WORLD.deliverX - 20}" y="${top + 90}" fill="#52e595" font-size="56" font-family="monospace" text-anchor="end">EXIT ▸</text>`
  );
}

function geoFor(def: RegionAuthoringDef): Geography {
  const preset = environmentPreset(def.environmentPresetId);
  return geography(preset?.geographyId ?? 'strait');
}

/** Where an attack's marker sits in world space. */
function markerPos(a: ScriptedAttack, geo: Geography): { x: number; y: number } {
  const family = attackFamily(a.ref.branch);
  if (family === 'field') return { x: a.x, y: a.y ?? geo.laneY(1, a.x) };
  return { x: a.x, y: geo.launchY(a.x) };
}

/** Snap a map point to where an attack of this weapon can sit. */
function placeAttack(a: ScriptedAttack, p: { x: number; y: number }, geo: Geography): void {
  a.x = Math.round(Math.max(40, Math.min(WORLD.width - 40, p.x)));
  if (attackFamily(a.ref.branch) === 'field') {
    const top = geo.hostileShoreY(a.x) + 60;
    const bottom = geo.friendlyShoreY(a.x) - 60;
    a.y = Math.round(Math.max(top, Math.min(bottom, p.y)));
  } else {
    delete a.y;
  }
}

function markerSvg(a: ScriptedAttack, geo: Geography, selected: boolean): string {
  const p = markerPos(a, geo);
  const color = BRANCH_COLOR[a.ref.branch];
  const family = attackFamily(a.ref.branch);
  const ring = selected ? `<circle r="92" fill="none" stroke="#ffd08a" stroke-width="12"/>` : '';
  const body =
    family === 'field'
      ? `<circle r="150" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="8" stroke-dasharray="24 16"/><circle r="64" fill="#12140d" stroke="${color}" stroke-width="10"/>`
      : family === 'emplaced'
        ? `<rect x="-62" y="-62" width="124" height="124" rx="14" fill="#12140d" stroke="${color}" stroke-width="10"/>`
        : `<circle r="64" fill="#12140d" stroke="${color}" stroke-width="10"/>`;
  const arrow =
    family === 'launched'
      ? `<path d="M0 70 L0 170 M-30 140 L0 175 L30 140" stroke="${color}" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.8"/>`
      : '';
  return (
    `<g class="pl-marker${selected ? ' sel' : ''}" data-attack="${a.id}" transform="translate(${p.x.toFixed(0)},${p.y.toFixed(0)})">` +
    arrow +
    body +
    ring +
    `<text y="22" text-anchor="middle" fill="${color}" font-size="64" font-weight="bold" font-family="monospace">${a.count}</text>` +
    `</g>`
  );
}

let liveLayer: SVGGElement | null = null;

function mapPanel(ctx: PlannerCtx, compiled: CompiledRegion, commit: () => void): HTMLElement {
  const def = ctx.def;
  const geo = geoFor(def);
  const attacks = compiled.attacks[ps.round] ?? null;
  const scripted = attacks !== null;
  const markers = (def.milestones.find((m) => m.round === ps.round)?.attacks ?? [])
    .filter((a) => attackFamily(a.ref.branch))
    .map((a) => markerSvg(a, geo, a.id === ps.attackId))
    .join('');
  const wrap = h('div', { className: 'pl-map' });
  wrap.innerHTML =
    `<svg viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}" preserveAspectRatio="xMidYMid meet">` +
    mapSvgBase(geo) +
    `<g class="pl-live"></g>` +
    `<g class="pl-markers">${markers}</g>` +
    `</svg>`;
  const svg = wrap.querySelector('svg')!;
  liveLayer = svg.querySelector('g.pl-live');

  const hint = h('div', { className: 'pl-map-hint' });
  if (!scripted) hint.textContent = 'Auto round — the enemy chooses where to fire from.';
  else if (ctx.readOnly) hint.textContent = '';
  else if (ps.attackId) hint.textContent = 'Drag the marker, or tap the map, to move the selected attack.';
  else if (attacks.length === 0) hint.textContent = 'Tap the enemy shore to place a missile launcher.';
  else hint.textContent = 'Tap a marker to select it · tap the map to add another launcher.';
  if (hint.textContent) wrap.append(hint);

  if (ctx.readOnly || !scripted) return wrap;

  // --- interaction: select, drag, tap-to-place --------------------------
  const toWorld = (ev: PointerEvent): { x: number; y: number } => {
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const m = svg.getScreenCTM();
    const w = m ? pt.matrixTransform(m.inverse()) : pt;
    return { x: w.x, y: w.y };
  };
  const milestone = () => milestoneAt(def, ps.round, true);
  let drag: { id: string; moved: boolean; startX: number; startY: number } | null = null;
  svg.addEventListener('pointerdown', (ev) => {
    const target = (ev.target as Element).closest('.pl-marker') as SVGGElement | null;
    if (target) {
      const id = target.getAttribute('data-attack')!;
      drag = { id, moved: false, startX: ev.clientX, startY: ev.clientY };
      svg.setPointerCapture(ev.pointerId);
      if (ps.attackId !== id) {
        ps.attackId = id;
        for (const g of svg.querySelectorAll('.pl-marker')) g.classList.toggle('sel', g.getAttribute('data-attack') === id);
      }
      ev.preventDefault();
      return;
    }
    const p = toWorld(ev);
    const list = milestone().attacks ?? [];
    const selected = list.find((a) => a.id === ps.attackId);
    if (selected) {
      placeAttack(selected, p, geo);
    } else {
      const a = newAttack(def, lastWeapon(def));
      placeAttack(a, p, geo);
      (milestone().attacks ??= []).push(a);
      ps.attackId = a.id;
    }
    commit();
  });
  svg.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 4) return;
    drag.moved = true;
    const a = (milestone().attacks ?? []).find((x) => x.id === drag!.id);
    if (!a) return;
    placeAttack(a, toWorld(ev), geo);
    const g = svg.querySelector(`.pl-marker[data-attack="${a.id}"]`);
    if (g) {
      const p = markerPos(a, geo);
      g.setAttribute('transform', `translate(${p.x.toFixed(0)},${p.y.toFixed(0)})`);
    }
  });
  const end = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) commit();
    else mounted?.render();
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  return wrap;
}

// --- preview playback -------------------------------------------------------------------

const THREAT_STYLE = [
  { color: '#ff6f5e', r: 16 }, // missile
  { color: '#ff9d6e', r: 18 }, // guided
  { color: '#c792ea', r: 20 }, // mine
  { color: '#56cfe0', r: 16 }, // torpedo
  { color: '#ffb454', r: 26 }, // boat
];

function frameIndex(result: PreviewResult, t: number): number {
  const i = Math.round(t / 0.2);
  return Math.max(0, Math.min(result.frames.length - 1, i));
}

function drawLive(): void {
  if (!liveLayer || !liveLayer.isConnected) return;
  const result = ps.preview;
  if (!result || result.frames.length === 0) {
    liveLayer.innerHTML = '';
    return;
  }
  const i = frameIndex(result, ps.playT);
  const f = result.frames[i];
  const back = result.frames[Math.max(0, i - 4)];
  const trailFrom = new Map<number, [number, number]>();
  for (const th of back.threats) trailFrom.set(th[0], [th[1], th[2]]);
  let out = '';
  // Guns emplaced this round.
  for (const [gx, gy] of result.guns) {
    out += `<rect x="${gx - 34}" y="${gy - 34}" width="68" height="68" fill="#e6ecd9" opacity="0.8"/>`;
  }
  // Blasts: threats that vanished in the last second.
  for (let k = Math.max(1, i - 5); k <= i; k++) {
    const prev = result.frames[k - 1];
    const cur = new Set(result.frames[k].threats.map((th) => th[0]));
    const age = (i - k) * 0.2;
    for (const th of prev.threats) {
      if (cur.has(th[0]) || th[3] === 2) continue;
      const r = 40 + age * 160;
      out += `<circle cx="${th[1]}" cy="${th[2]}" r="${r.toFixed(0)}" fill="none" stroke="#ffd08a" stroke-width="10" opacity="${(1 - age).toFixed(2)}"/>`;
    }
  }
  for (const [x, y, hp, delivered] of f.ships) {
    if (delivered) continue;
    if (hp < 0) {
      out += `<path d="M${x - 30} ${y - 30} L${x + 30} ${y + 30} M${x + 30} ${y - 30} L${x - 30} ${y + 30}" stroke="#ff6f5e" stroke-width="12"/>`;
      continue;
    }
    const color = hp > 0.66 ? '#e6ecd9' : hp > 0.33 ? '#ffb454' : '#ff6f5e';
    out += `<rect x="${x - 36}" y="${y - 14}" width="72" height="28" rx="10" fill="${color}"/>`;
  }
  for (const [x, y, alive] of f.escorts) {
    if (!alive) continue;
    out += `<path d="M${x} ${y - 34} L${x + 30} ${y} L${x} ${y + 34} L${x - 30} ${y} Z" fill="#52e595"/>`;
  }
  for (const [id, x, y, code] of f.threats) {
    const s = THREAT_STYLE[code] ?? THREAT_STYLE[0];
    const from = trailFrom.get(id);
    if (from && code !== 2) {
      out += `<line x1="${from[0]}" y1="${from[1]}" x2="${x}" y2="${y}" stroke="${s.color}" stroke-width="8" opacity="0.45" stroke-linecap="round"/>`;
    }
    if (code === 4) out += `<path d="M${x} ${y - s.r} L${x + s.r} ${y + s.r} L${x - s.r} ${y + s.r} Z" fill="${s.color}"/>`;
    else out += `<circle cx="${x}" cy="${y}" r="${s.r}" fill="${s.color}"/>`;
  }
  for (const [x, y] of f.interceptors) {
    out += `<circle cx="${x}" cy="${y}" r="11" fill="#ffffff"/>`;
  }
  liveLayer.innerHTML = out;
}

function startLoop(): void {
  if (rafHandle) return;
  lastFrameAt = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.1, (now - lastFrameAt) / 1000);
    lastFrameAt = now;
    if (!mounted || !mounted.root.isConnected) {
      rafHandle = 0;
      return;
    }
    if (ps.playing && ps.preview) {
      ps.playT += dt * ps.speed;
      if (ps.playT >= ps.preview.duration) {
        ps.playT = ps.preview.duration;
        ps.playing = false;
        updatePlayerChrome();
      }
      drawLive();
      updateScrubber();
    }
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);
}

let scrubEl: HTMLInputElement | null = null;
let clockEl: HTMLElement | null = null;
let playBtn: HTMLButtonElement | null = null;
let statusEl: HTMLElement | null = null;

function updateScrubber(): void {
  if (scrubEl && ps.preview) scrubEl.value = String(ps.playT);
  if (clockEl) clockEl.textContent = `${clock(ps.playT)} / ${clock(ps.preview?.duration ?? 0)}`;
}

function updatePlayerChrome(): void {
  if (playBtn) playBtn.textContent = ps.playing ? '❚❚' : '▶';
  if (statusEl) {
    statusEl.textContent = ps.pending ? 'Simulating…' : ps.error ? `Preview failed: ${ps.error}` : '';
    statusEl.className = `pl-status ${ps.error ? 'bad' : ''}`;
  }
}

function playerBar(ctx: PlannerCtx): HTMLElement {
  const result = ps.preview;
  const duration = result?.duration ?? 240;
  playBtn = h('button', {
    className: 'pl-play',
    text: ps.playing ? '❚❚' : '▶',
    attrs: { 'aria-label': 'Play or pause the preview' },
    onClick: () => {
      if (!ps.preview) return;
      if (!ps.playing && ps.playT >= ps.preview.duration - 0.1) ps.playT = 0;
      ps.playing = !ps.playing;
      updatePlayerChrome();
    },
  });
  scrubEl = document.createElement('input');
  scrubEl.type = 'range';
  scrubEl.min = '0';
  scrubEl.max = String(duration);
  scrubEl.step = '0.2';
  scrubEl.value = String(ps.playT);
  scrubEl.className = 'pl-scrub';
  scrubEl.setAttribute('aria-label', 'Preview time');
  scrubEl.addEventListener('input', () => {
    ps.playT = Number(scrubEl!.value);
    ps.playing = false;
    updatePlayerChrome();
    drawLive();
    updateScrubber();
  });
  // Launch ticks under the scrubber: the round's timing at a glance.
  const ticks = h('div', { className: 'pl-ticks' });
  if (result) {
    for (const l of result.launches) {
      const tick = h('span', { className: 'pl-tick' });
      tick.style.left = `${(100 * l.t) / Math.max(1, duration)}%`;
      tick.style.background = THREAT_STYLE[l.kind]?.color ?? '#ff6f5e';
      ticks.append(tick);
    }
  }
  clockEl = h('span', { className: 'pl-clock', text: `${clock(ps.playT)} / ${clock(duration)}` });
  statusEl = h('span', { className: 'pl-status' });
  const speeds = h('div', { className: 'pl-seg pl-speed' });
  for (const s of [2, 6, 12]) {
    speeds.append(
      h('button', {
        className: ps.speed === s ? 'on' : '',
        text: `${s}×`,
        onClick: () => {
          ps.speed = s;
          for (const b of speeds.querySelectorAll('button')) b.classList.toggle('on', b.textContent === `${s}×`);
        },
      }),
    );
  }
  const defences = h('div', { className: 'pl-seg' }, [
    h('button', {
      className: ps.defences ? 'on' : '',
      text: 'Player defends',
      attrs: { title: 'A bot player (the balance sweep’s “balanced” persona) fights back with the region’s starting fleet.' },
      onClick: () => {
        ps.defences = true;
        mounted?.render();
        schedulePreview(ctx, 0);
      },
    }),
    h('button', {
      className: ps.defences ? '' : 'on',
      text: 'No defence',
      attrs: { title: 'Nobody shoots back — see the raw attack.' },
      onClick: () => {
        ps.defences = false;
        mounted?.render();
        schedulePreview(ctx, 0);
      },
    }),
  ]);
  const bar = h('div', { className: 'pl-player' }, [
    playBtn,
    h('div', { className: 'pl-scrubwrap' }, [scrubEl, ticks]),
    clockEl,
    speeds,
    defences,
    h('button', {
      className: 'pl-reseed',
      text: '↻',
      attrs: { title: 'Replay with a different random seed', 'aria-label': 'New seed' },
      onClick: () => {
        const n = Number(ps.seed.split('-').pop()) || 1;
        ps.seed = `preview-${n + 1}`;
        ps.compare = null;
        schedulePreview(ctx, 0);
      },
    }),
    statusEl,
  ]);
  updatePlayerChrome();
  return bar;
}

function summaryLine(s: PreviewSummary): HTMLElement {
  const fired = s.launched + s.minesLaid + s.guns;
  const stat = (label: string, value: string, tone = '') =>
    h('span', { className: `pl-stat ${tone}`.trim() }, [h('b', { text: value }), h('span', { text: ` ${label}` })]);
  return h('div', { className: 'pl-stats' }, [
    stat(s.minesLaid || s.guns ? 'fielded' : 'fired', String(fired)),
    stat('shot down', String(s.shotDown), 'good'),
    stat('hits on ships', String(s.hits), s.hits > 0 ? 'warn' : ''),
    stat('ships lost', `${s.shipsLost}/${s.shipsSailed}`, s.shipsLost > 0 ? 'bad' : ''),
    ...(s.escortsLost ? [stat('escorts lost', String(s.escortsLost), 'bad')] : []),
  ]);
}

function resultPanel(ctx: PlannerCtx, commit: (o?: { keepCompare?: boolean }) => void): HTMLElement {
  const panel = h('div', { className: 'pl-result' });
  const result = ps.preview;
  if (result && result.round === ps.round) {
    panel.append(summaryLine(result.summary));
    panel.append(
      h('div', {
        className: 'hint',
        text: `${ps.defences ? 'Defended by a bot player with the region’s starting fleet' : 'Nobody defending'} · enemy aiming: ${result.targeting} · seed ${ps.seed}`,
      }),
    );
    if (result.scripted && roundAdapts(ctx.def, ps.round)) {
      panel.append(
        h('div', {
          className: 'hint pl-adapt-note',
          text:
            result.scriptScale === 1
              ? 'Adapts to the player — no adjustment on this round of the preview.'
              : `Adapts to the player — this preview fired ×${result.scriptScale} of your counts (the preview assumes the player did fairly well so far).`,
        }),
      );
    }
  }
  // Pattern comparison for the selected launched attack.
  const m = ctx.def.milestones.find((x) => x.round === ps.round);
  const selected = m?.attacks?.find((a) => a.id === ps.attackId);
  if (selected && attackFamily(selected.ref.branch) === 'launched') {
    const key = previewKeyFor(ctx.def);
    const cmp = ps.compare && ps.compare.attackId === selected.id && ps.compare.key === key ? ps.compare : null;
    if (!cmp) {
      panel.append(
        h('button', {
          className: 'pl-compare-btn',
          text: `Compare patterns for this attack (${selected.count} ${noun(selected.ref.nodeId, selected.count)})`,
          onClick: () => runCompare(ctx, selected, key),
        }),
      );
    } else {
      const table = h('table', { className: 'pl-compare' });
      table.append(
        h('thead', {}, [h('tr', {}, ['Pattern', 'Shot down', 'Hits', 'Ships lost', ''].map((t) => h('th', { text: t, attrs: t === '' ? { 'data-nosort': '' } : {} })))]),
      );
      const tbody = h('tbody');
      const current = selected.pattern ?? 'salvo';
      for (const row of cmp.rows) {
        const s = row.summary;
        tbody.append(
          h('tr', { className: row.pattern === current ? 'on' : '' }, [
            h('td', { text: `${PATTERN_LABEL[row.pattern]}` }),
            h('td', { text: s ? String(s.shotDown) : '…' }),
            h('td', { text: s ? String(s.hits) : '…' }),
            h('td', { text: s ? `${s.shipsLost}/${s.shipsSailed}` : '…', attrs: { 'data-sort': s ? String(s.shipsLost) : '' } }),
            h('td', {}, [
              row.pattern === current
                ? h('span', { className: 'hint', text: 'current' })
                : h('button', {
                    text: 'Use',
                    disabled: ctx.readOnly,
                    onClick: () => {
                      selected.pattern = row.pattern;
                      // The comparison still holds for the new pattern (same
                      // round, same seed) — re-key it so it stays on screen.
                      ps.compare = { ...cmp, key: previewKeyFor(ctx.def) };
                      commit({ keepCompare: true });
                    },
                  }),
            ]),
          ]),
        );
      }
      table.append(tbody);
      enhanceTable(table, 'planner-compare');
      panel.append(h('div', { className: 'pl-compare-wrap' }, [h('div', { className: 'hint', text: 'Same round, same seed — only the pattern changes:' }), table]));
    }
  }
  return panel;
}

function runCompare(ctx: PlannerCtx, attack: ScriptedAttack, key: string): void {
  const rows: CompareRow[] = ATTACK_PATTERNS.map((pattern) => ({ pattern, summary: null }));
  ps.compare = { attackId: attack.id, key, rows };
  mounted?.render();
  let i = 0;
  const next = () => {
    if (!ps.compare || ps.compare.rows !== rows || i >= rows.length) return;
    const row = rows[i++];
    const def: RegionAuthoringDef = JSON.parse(JSON.stringify(ctx.def));
    const a = def.milestones.find((m) => m.round === ps.round)?.attacks?.find((x) => x.id === attack.id);
    if (a) a.pattern = row.pattern;
    simulate({ def, round: ps.round, seed: ps.seed, defences: ps.defences }, (result) => {
      row.summary = result?.summary ?? null;
      mounted?.render();
      next();
    });
  };
  next();
}

// --- side panel: the round editor ---------------------------------------------------------

function newAttackId(): string {
  return `atk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function lastWeapon(def: RegionAuthoringDef): { branch: EnemyBranchKey; nodeId: string } {
  const list = def.milestones.find((m) => m.round === ps.round)?.attacks ?? [];
  const last = list[list.length - 1];
  return last ? { ...last.ref } : { branch: 'missiles', nodeId: 'unguided' };
}

function newAttack(def: RegionAuthoringDef, ref: { branch: EnemyBranchKey; nodeId: string }): ScriptedAttack {
  const geo = geoFor(def);
  const site = geo.launchSites[Math.floor(geo.launchSites.length / 2)] ?? { x: WORLD.width / 2 };
  const a: ScriptedAttack = { id: newAttackId(), ref: { ...ref }, count: ATTACK_DEFAULTS.count, x: site.x };
  const family = attackFamily(ref.branch);
  if (family === 'launched') {
    a.pattern = 'salvo';
    a.start = ATTACK_DEFAULTS.start;
  }
  if (family === 'field') {
    a.x = 1300;
    a.y = Math.round(geo.laneY(1, a.x));
    a.count = 4;
  }
  if (family === 'emplaced') {
    a.x = 1800;
    a.count = 1;
  }
  return a;
}

/** Turn what an Auto round fielded in the preview into a script: one attack
 *  per weapon, spread across the crossing the way the adaptive enemy spreads
 *  its buy, launched from the map's middle launch site. A starting point to
 *  tighten into salvos, not a replay of Auto's exact volleys. */
function attacksFromPreview(def: RegionAuthoringDef, result: PreviewResult): ScriptedAttack[] {
  const out: ScriptedAttack[] = [];
  let launchers = 0;
  for (const [key, n] of Object.entries(result.fielded)) {
    const [branch, nodeId] = key.split(':') as [EnemyBranchKey, string];
    if (!attackFamily(branch)) continue;
    const a = newAttack(def, { branch, nodeId });
    a.count = Math.min(ATTACK_DEFAULTS.maxCount, n);
    if (attackFamily(branch) === 'launched') {
      a.pattern = 'spread';
      a.start = result.firstLaunch[key] ?? ATTACK_DEFAULTS.start;
      a.x = Math.min(WORLD.width - 200, a.x + launchers * 300);
      launchers++;
    }
    out.push(a);
  }
  return out;
}

/** Re-shape an attack for a different weapon, keeping what still applies. */
function changeWeapon(a: ScriptedAttack, ref: { branch: EnemyBranchKey; nodeId: string }, geo: Geography): void {
  const before = attackFamily(a.ref.branch);
  a.ref = { ...ref };
  const after = attackFamily(ref.branch);
  if (before === after) return;
  if (after === 'launched') {
    a.pattern ??= 'salvo';
    a.start ??= ATTACK_DEFAULTS.start;
  } else {
    delete a.pattern;
    delete a.start;
    delete a.perVolley;
    delete a.gap;
  }
  if (after === 'field') {
    a.y = Math.round(geo.laneY(1, a.x));
  } else {
    delete a.y;
  }
}

function stepper(
  value: number,
  onChange: (v: number) => void,
  opts: { min: number; max?: number; step?: number; unit?: string; label: string; disabled?: boolean },
): HTMLElement {
  const step = opts.step ?? 1;
  const clamp = (v: number) => Math.max(opts.min, Math.min(opts.max ?? Infinity, v));
  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'ws-input pl-num';
  input.value = String(value);
  input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  input.step = String(step);
  input.disabled = !!opts.disabled;
  input.setAttribute('aria-label', opts.label);
  input.addEventListener('change', () => {
    const n = Number(input.value);
    if (!Number.isFinite(n)) return;
    const v = clamp(step >= 1 ? Math.round(n) : n);
    if (v !== value) onChange(v);
  });
  return h('div', { className: 'pl-stepper' }, [
    h('button', {
      text: '−',
      disabled: opts.disabled || value <= opts.min,
      attrs: { 'aria-label': `Decrease ${opts.label}` },
      onClick: () => onChange(clamp(value - step)),
    }),
    input,
    ...(opts.unit ? [h('span', { className: 'pl-unit', text: opts.unit })] : []),
    h('button', {
      text: '+',
      disabled: opts.disabled || (opts.max !== undefined && value >= opts.max),
      attrs: { 'aria-label': `Increase ${opts.label}` },
      onClick: () => onChange(clamp(value + step)),
    }),
  ]);
}

function weaponSelect(a: ScriptedAttack, onChange: (ref: { branch: EnemyBranchKey; nodeId: string }) => void, disabled: boolean): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'ws-input pl-weapon';
  sel.disabled = disabled;
  sel.setAttribute('aria-label', 'Weapon');
  for (const key of ENEMY_BRANCH_ORDER) {
    const entries = scriptableEntries().filter((e) => e.branch === key);
    if (entries.length === 0) continue;
    const group = document.createElement('optgroup');
    group.label = ENEMY_BRANCHES[key].name;
    for (const e of entries) {
      const opt = document.createElement('option');
      opt.value = `${e.branch}:${e.node.id}`;
      opt.textContent = e.node.name;
      if (e.branch === a.ref.branch && e.node.id === a.ref.nodeId) opt.selected = true;
      group.append(opt);
    }
    sel.append(group);
  }
  sel.addEventListener('change', () => {
    const [branch, nodeId] = sel.value.split(':');
    onChange({ branch: branch as EnemyBranchKey, nodeId });
  });
  return sel;
}

/** A tiny timeline of one attack's launches, drawn from the runtime's own
 *  schedule function — so the dots are where the sim will put them. */
function attackTimeline(a: ScriptedAttack): HTMLElement {
  const span = 240;
  const times = launchTimes({ ...runtimeAttack(a) }, span);
  const color = BRANCH_COLOR[a.ref.branch];
  const dots = times
    .map((t, i) => {
      const x = Math.min(span, t);
      // Stack simultaneous launches so a salvo reads as a column.
      const same = times.slice(0, i).filter((u) => Math.abs(u - t) < 0.01).length;
      return `<circle cx="${((x / span) * 300).toFixed(1)}" cy="${(22 - (same % 5) * 4).toFixed(1)}" r="2.6" fill="${color}"/>`;
    })
    .join('');
  const grid = [0, 60, 120, 180, 240]
    .map((t) => `<line x1="${(t / span) * 300}" y1="4" x2="${(t / span) * 300}" y2="26" stroke="#2b3323"/><text x="${(t / span) * 300 + 2}" y="34" fill="#93a284" font-size="7" font-family="monospace">${clock(t)}</text>`)
    .join('');
  const el = h('div', { className: 'pl-atk-timeline' });
  el.innerHTML = `<svg viewBox="0 0 300 36" preserveAspectRatio="none">${grid}${dots}</svg>`;
  return el;
}

function attackCard(
  ctx: PlannerCtx,
  a: ScriptedAttack,
  list: ScriptedAttack[],
  issues: ValidationIssue[],
  commit: () => void,
): HTMLElement {
  const ro = ctx.readOnly;
  const geo = geoFor(ctx.def);
  const family = attackFamily(a.ref.branch);
  const selected = a.id === ps.attackId;
  const card = h('div', {
    className: `pl-atk ${selected ? 'sel' : ''}`,
    attrs: { 'data-attack': a.id },
  });
  card.style.setProperty('--atk', BRANCH_COLOR[a.ref.branch]);
  card.addEventListener('pointerdown', (ev) => {
    if (ps.attackId === a.id) return;
    if ((ev.target as Element).closest('button, input, select')) {
      ps.attackId = a.id; // select without swallowing the control's own action
      return;
    }
    ps.attackId = a.id;
    mounted?.render();
  });

  const head = h('div', { className: 'pl-atk-head' }, [
    icon(BRANCH_ICON[a.ref.branch]),
    weaponSelect(a, (ref) => {
      changeWeapon(a, ref, geo);
      commit();
    }, ro),
    h('button', {
      className: 'pl-icon-btn',
      text: '⧉',
      disabled: ro,
      attrs: { title: 'Duplicate this attack', 'aria-label': 'Duplicate attack' },
      onClick: () => {
        const copy: ScriptedAttack = { ...JSON.parse(JSON.stringify(a)), id: newAttackId() };
        copy.x = Math.min(WORLD.width - 40, copy.x + 250);
        list.splice(list.indexOf(a) + 1, 0, copy);
        ps.attackId = copy.id;
        commit();
      },
    }),
    h('button', {
      className: 'pl-icon-btn danger',
      text: '✕',
      disabled: ro,
      attrs: { title: 'Delete this attack', 'aria-label': 'Delete attack' },
      onClick: () => {
        list.splice(list.indexOf(a), 1);
        if (ps.attackId === a.id) ps.attackId = null;
        commit();
      },
    }),
  ]);
  card.append(head);

  const countLabel = family === 'emplaced' ? 'Guns' : family === 'field' ? 'Mines' : 'How many';
  const rows = h('div', { className: 'pl-atk-rows' }, [
    h('div', { className: 'pl-row' }, [
      h('span', { className: 'pl-label', text: countLabel }),
      stepper(a.count, (v) => { a.count = v; commit(); }, { min: 1, max: ATTACK_DEFAULTS.maxCount, label: countLabel, disabled: ro }),
    ]),
  ]);
  if (family === 'launched') {
    const r = runtimeAttack(a);
    const seg = h('div', { className: 'pl-seg pl-pattern', attrs: { role: 'radiogroup', 'aria-label': 'Pattern' } });
    for (const p of ATTACK_PATTERNS) {
      seg.append(
        h('button', {
          className: r.pattern === p ? 'on' : '',
          disabled: ro,
          attrs: { role: 'radio', 'aria-checked': String(r.pattern === p), title: PATTERN_HINT[p] },
          onClick: () => {
            a.pattern = p;
            commit();
          },
        }, [h('span', { text: PATTERN_LABEL[p] }), h('small', { text: PATTERN_HINT[p] })]),
      );
    }
    rows.append(h('div', { className: 'pl-row pl-row-wide' }, [seg]));
    rows.append(
      h('div', { className: 'pl-row' }, [
        h('span', { className: 'pl-label', text: 'First launch' }),
        stepper(r.start, (v) => { a.start = v; commit(); }, { min: 0, max: 600, step: 5, unit: 's', label: 'first launch time', disabled: ro }),
      ]),
    );
    if (r.pattern === 'volleys') {
      rows.append(
        h('div', { className: 'pl-row' }, [
          h('span', { className: 'pl-label', text: 'Per volley' }),
          stepper(r.perVolley, (v) => { a.perVolley = v; commit(); }, { min: 1, max: ATTACK_DEFAULTS.maxCount, label: 'units per volley', disabled: ro }),
        ]),
      );
    }
    if (r.pattern === 'volleys' || r.pattern === 'stream') {
      rows.append(
        h('div', { className: 'pl-row' }, [
          h('span', { className: 'pl-label', text: r.pattern === 'stream' ? 'One every' : 'Volley every' }),
          stepper(r.gap, (v) => { a.gap = v; commit(); }, { min: 1, max: 120, unit: 's', label: 'gap in seconds', disabled: ro }),
        ]),
      );
    }
  }
  card.append(rows);
  if (family === 'launched') card.append(attackTimeline(a));
  card.append(h('p', { className: 'pl-atk-desc', text: describeAttack(a) }));
  for (const i of issues.filter((x) => x.round === ps.round && x.ref && x.ref.nodeId === a.ref.nodeId && x.ref.branch === a.ref.branch)) {
    card.append(h('p', { className: i.severity === 'error' ? 'ws-bad' : 'ws-warn-text', text: i.message }));
  }
  return card;
}

function sidePanel(ctx: PlannerCtx, compiled: CompiledRegion, issues: ValidationIssue[], commit: () => void): HTMLElement {
  const def = ctx.def;
  const r = ps.round;
  const ro = ctx.readOnly;
  const m = def.milestones.find((x) => x.round === r);
  const scripted = m?.attacks !== undefined;
  const panel = h('div', { className: 'pl-side panel' });

  const modeSeg = h('div', { className: 'pl-seg pl-mode', attrs: { role: 'radiogroup', 'aria-label': 'Round mode' } }, [
    h('button', {
      className: scripted ? '' : 'on',
      disabled: ro,
      attrs: { role: 'radio', 'aria-checked': String(!scripted) },
      onClick: () => {
        if (!scripted) return;
        const ms = milestoneAt(def, r, true);
        if (ms.attacks && ms.attacks.length > 0) ps.stash[r] = ms.attacks;
        delete ms.attacks;
        pruneMilestone(def, r);
        ps.attackId = null;
        commit();
      },
    }, [h('span', { text: 'Auto' }), h('small', { text: 'enemy decides' })]),
    h('button', {
      className: scripted ? 'on' : '',
      disabled: ro,
      attrs: { role: 'radio', 'aria-checked': String(scripted) },
      onClick: () => {
        if (scripted) return;
        const ms = milestoneAt(def, r, true);
        ms.attacks = ps.stash[r] ?? [newAttack(def, { branch: 'missiles', nodeId: 'unguided' })];
        delete ps.stash[r];
        ps.attackId = ms.attacks[0]?.id ?? null;
        commit();
      },
    }, [h('span', { text: 'Scripted' }), h('small', { text: 'you decide' })]),
  ]);
  panel.append(h('div', { className: 'pl-side-head' }, [h('h2', { text: `Round ${r}` }), modeSeg]));

  if (!scripted) {
    const avail = availabilityAtRound(compiled, r);
    const budget = pressureAtRound(compiled, r).budget;
    panel.append(
      h('p', {
        className: 'pl-lead',
        text:
          r === 1
            ? `Round 1 on Auto is the standard opening probe: ${ROUND1.missileCount} unguided missiles spread across the crossing.`
            : `The adaptive enemy gets about ${budget} to spend and buys what worked last round from this menu:`,
      }),
    );
    if (r > 1) {
      const chips = h('div', { className: 'chip-row' });
      for (const a of avail) {
        const chip = h('span', { className: 'chip' }, [icon(BRANCH_ICON[a.branch]), h('span', { text: `${a.introducedThisRound ? 'NEW ' : ''}${a.node.name}` })]);
        chip.style.color = BRANCH_COLOR[a.branch];
        chips.append(chip);
      }
      if (avail.length === 0) chips.append(h('span', { className: 'ws-bad', text: 'Nothing on the menu — this round will be empty.' }));
      panel.append(chips);
      panel.append(h('p', { className: 'hint', text: 'Change the menu, budget and ceilings on the Adaptive timeline tab.' }));
    }
    const result = ps.preview && ps.preview.round === r && !ps.preview.scripted ? ps.preview : null;
    if (result && Object.keys(result.fielded).length > 0) {
      panel.append(h('h3', { text: 'In the preview, Auto fielded' }));
      const list = h('div', { className: 'pl-fielded' });
      for (const [key, n] of Object.entries(result.fielded)) {
        const [branch, nodeId] = key.split(':') as [EnemyBranchKey, string];
        const row = h('span', { className: 'chip' }, [icon(BRANCH_ICON[branch]), h('span', { text: `${n} ${noun(nodeId, n)}` })]);
        row.style.color = BRANCH_COLOR[branch];
        list.append(row);
      }
      panel.append(list);
      panel.append(h('p', { className: 'hint', text: 'Auto re-decides every playthrough — what it buys depends on how the player did last round.' }));
    }
    if (!ro) {
      panel.append(
        h('div', { className: 'pl-add' }, [
          h('button', {
            className: 'primary',
            text: result ? 'Script it like this' : 'Script this round',
            attrs: { title: result ? 'Switch to Scripted, starting from exactly what Auto fielded in the preview' : 'Switch to Scripted' },
            onClick: () => {
              const ms = milestoneAt(def, r, true);
              ms.attacks = result ? attacksFromPreview(def, result) : ps.stash[r] ?? [newAttack(def, { branch: 'missiles', nodeId: 'unguided' })];
              delete ps.stash[r];
              ps.attackId = ms.attacks[0]?.id ?? null;
              commit();
            },
          }),
        ]),
      );
    }
    panel.append(
      h('p', { className: 'hint', text: 'Scripted rounds fire exactly what you place — nothing more — so a change like “5 missiles instead of 3” is one tap.' }),
    );
  } else {
    const list = m!.attacks!;
    if (list.length === 0) panel.append(h('p', { className: 'pl-lead', text: 'A quiet round — nothing fires. Add an attack, or tap the enemy shore on the map.' }));
    for (const a of list) panel.append(attackCard(ctx, a, list, issues, commit));
    if (!ro) {
      const addRow = h('div', { className: 'pl-add' });
      const quick: { label: string; ref: { branch: EnemyBranchKey; nodeId: string } }[] = [
        { label: '+ Missiles', ref: { branch: 'missiles', nodeId: 'unguided' } },
        { label: '+ Torpedoes', ref: { branch: 'torpedoes', nodeId: 'straight' } },
        { label: '+ Boats', ref: { branch: 'attackBoats', nodeId: 'smallArms' } },
        { label: '+ Mines', ref: { branch: 'mines', nodeId: 'standard' } },
        { label: '+ Gun', ref: { branch: 'artillery', nodeId: 'coastalGun' } },
      ];
      for (const q of quick) {
        addRow.append(
          h('button', {
            text: q.label,
            onClick: () => {
              const a = newAttack(def, q.ref);
              // Spread new launchers along the shore rather than stacking them.
              const used = list.filter((x) => attackFamily(x.ref.branch) === attackFamily(q.ref.branch)).length;
              if (attackFamily(q.ref.branch) !== 'field') a.x = Math.min(WORLD.width - 200, a.x + used * 350);
              list.push(a);
              ps.attackId = a.id;
              commit();
            },
          }),
        );
      }
      panel.append(addRow);
    }
    panel.append(adaptRow(ctx, r, commit));
    if (!ro && list.length > 0) panel.append(scaleTool(ctx, r, list, commit));
  }

  const roundIssues = issues.filter((i) => i.round === r && !i.ref);
  for (const i of roundIssues) panel.append(h('p', { className: i.severity === 'error' ? 'ws-bad' : 'ws-warn-text', text: i.message }));

  if (!ro) {
    panel.append(
      h('div', { className: 'pl-round-actions' }, [
        h('button', {
          text: `Copy to R${r + 1}`,
          disabled: !m || r >= def.completionRound,
          attrs: { title: 'Replace the next round with a copy of this one' },
          onClick: () => {
            duplicateRound(def, r, r + 1);
            ps.round = r + 1;
            ps.attackId = null;
            commit();
          },
        }),
        h('button', {
          text: 'Insert round after',
          onClick: () => {
            insertRound(def, r + 1);
            ps.round = r + 1;
            ps.attackId = null;
            commit();
          },
        }),
        h('button', {
          className: 'danger',
          text: 'Delete round',
          disabled: def.completionRound <= 1,
          onClick: () => {
            deleteRound(def, r);
            ps.round = Math.min(r, def.completionRound);
            ps.attackId = null;
            commit();
          },
        }),
      ]),
    );
  }
  return panel;
}

/** Per-round "adapt to the player" switch. Shows whether the round follows
 *  the region default or overrides it. */
function adaptRow(ctx: PlannerCtx, r: number, commit: () => void): HTMLElement {
  const def = ctx.def;
  const m = def.milestones.find((x) => x.round === r);
  const on = roundAdapts(def, r);
  const own = m?.adapt !== undefined;
  const regionOn = !!def.scriptAdapt;
  return h('div', { className: 'pl-adapt' }, [
    h('div', { className: 'pl-row' }, [
      h('span', { className: 'pl-label', text: 'Adapt to player' }),
      h('button', {
        className: on ? 'dev-toggle on' : 'dev-toggle',
        text: on ? 'ON' : 'OFF',
        disabled: ctx.readOnly,
        attrs: { title: ADAPT_HINT, 'aria-pressed': String(on), 'aria-label': `Round ${r} adapts to player` },
        onClick: () => {
          const ms = milestoneAt(def, r, true);
          const next = !on;
          // Matching the region default is the same as not overriding it.
          if (next === regionOn) delete ms.adapt;
          else ms.adapt = next;
          commit();
        },
      }),
    ]),
    h('p', {
      className: 'hint',
      text: on
        ? `Counts scale ×${SCRIPT_SCALE_MIN}–×${SCRIPT_SCALE_MAX} with how the player is doing.${own ? ' (This round only — the region default is off.)' : ''}`
        : `Fires exactly these counts every playthrough.${own ? ' (This round only — the region default is on.)' : ''}`,
    }),
  ]);
}

/** Extrapolate this round across later ones: same attacks, counts growing by
 *  a fixed number or a percentage per round. */
function scaleTool(ctx: PlannerCtx, r: number, list: ScriptedAttack[], commit: (o?: { keepFlash?: boolean }) => void): HTMLElement {
  const def = ctx.def;
  const sc = ps.scale;
  const maxTo = def.completionRound + 20;
  if (sc.to <= r || sc.to > maxTo) sc.to = Math.max(r + 1, def.completionRound);
  const box = document.createElement('details');
  box.className = 'pl-scale';
  box.open = sc.open;
  box.addEventListener('toggle', () => (sc.open = box.open));
  const refresh = () => mounted?.render();
  box.append(h('summary', { text: `Scale R${r} to later rounds` }));
  const steps = sc.to - r;
  const overwritten = [];
  for (let k = r + 1; k <= sc.to; k++) {
    if (def.milestones.find((m) => m.round === k)?.attacks) overwritten.push(`R${k}`);
  }
  const modeSeg = h('div', { className: 'pl-seg' }, (['add', 'percent'] as ScaleMode[]).map((mode) =>
    h('button', {
      className: sc.mode === mode ? 'on' : '',
      text: mode === 'add' ? '+ units' : '+ %',
      onClick: () => {
        sc.mode = mode;
        sc.amount = mode === 'add' ? 2 : 10;
        refresh();
      },
    }),
  ));
  const preview = h('div', { className: 'pl-scale-preview' });
  for (const a of list) {
    const seq: number[] = [];
    for (let k = 0; k <= steps; k++) seq.push(scaledCount(a.count, k, sc.mode, sc.amount));
    const shown = seq.length > 7 ? [...seq.slice(0, 4), '…', ...seq.slice(-2)] : seq;
    const line = h('div', { className: 'pl-scale-line' }, [
      icon(BRANCH_ICON[a.ref.branch]),
      h('span', { text: ` ${noun(a.ref.nodeId, 2)}: ` }),
      h('b', { text: shown.join(' → ') }),
    ]);
    line.style.color = BRANCH_COLOR[a.ref.branch];
    preview.append(line);
  }
  box.append(
    h('div', { className: 'pl-scale-body' }, [
      h('p', { className: 'hint', text: `Copies this round — same weapons, positions and timing — onto every later round up to the one you pick, growing each count as it goes. Get R${r} feeling right, then stretch it.` }),
      h('div', { className: 'pl-row' }, [
        h('span', { className: 'pl-label', text: 'Through round' }),
        stepper(sc.to, (v) => { sc.to = v; refresh(); }, { min: r + 1, max: maxTo, label: 'last round to fill' }),
      ]),
      h('div', { className: 'pl-row' }, [
        h('span', { className: 'pl-label', text: 'Each round adds' }),
        stepper(sc.amount, (v) => { sc.amount = v; refresh(); }, { min: sc.mode === 'add' ? -50 : -50, max: sc.mode === 'add' ? 50 : 200, step: sc.mode === 'add' ? 1 : 5, unit: sc.mode === 'add' ? '' : '%', label: 'increase per round' }),
      ]),
      h('div', { className: 'pl-row pl-row-wide' }, [modeSeg]),
      preview,
      ...(overwritten.length ? [h('p', { className: 'ws-warn-text', text: `Replaces what is scripted on ${overwritten.join(', ')}.` })] : []),
      ...(sc.to > def.completionRound ? [h('p', { className: 'hint', text: `Adds rounds ${def.completionRound + 1}–${sc.to} to the region.` })] : []),
      h('button', {
        className: 'primary',
        text: `Apply to R${r + 1}–R${sc.to}`,
        onClick: () => {
          const written = extrapolateRound(def, r, sc.to, sc.mode, sc.amount);
          ps.flash = `Filled R${written[0]}–R${written[written.length - 1]} from R${r}.`;
          commit({ keepFlash: true });
        },
      }),
    ]),
  );
  return box;
}

// --- overview table -------------------------------------------------------------------------

const TABLE_BRANCHES: EnemyBranchKey[] = ['missiles', 'torpedoes', 'attackBoats', 'mines', 'artillery'];

function overviewTable(ctx: PlannerCtx, compiled: CompiledRegion, commit: () => void): HTMLElement {
  const def = ctx.def;
  const table = h('table', { className: 'ws-table pl-overview' });
  table.append(
    h('thead', {}, [
      h('tr', {}, [
        h('th', { text: 'Round' }),
        h('th', { text: 'Mode' }),
        ...TABLE_BRANCHES.map((b) => {
          const th = h('th', { attrs: { title: ENEMY_BRANCHES[b].name } }, [icon(BRANCH_ICON[b]), h('span', { className: 'pl-th-name', text: ` ${SHORT_BRANCH[b]}` })]);
          th.style.color = BRANCH_COLOR[b];
          return th;
        }),
        h('th', { text: 'Total' }),
      ]),
    ]),
  );
  const tbody = h('tbody');
  for (let r = 1; r <= def.completionRound; r++) {
    const attacks = def.milestones.find((m) => m.round === r)?.attacks;
    const tr = h('tr', { className: r === ps.round ? 'on' : '', attrs: { 'data-round': String(r) } });
    // Opening a round is an explicit tap on its button, never a stray tap on
    // the row — editing a count in the table must not also switch rounds.
    const open = h('button', {
      className: r === ps.round ? 'pl-open on' : 'pl-open',
      text: `R${r}`,
      attrs: { title: r === ps.round ? 'This round is open above' : `Open round ${r} above`, 'aria-label': `Open round ${r}` },
      onClick: () => selectRound(r, ctx),
    });
    tr.append(h('td', { attrs: { 'data-sort': String(r) } }, [open]));
    if (!attacks) {
      const avail = availabilityAtRound(compiled, r);
      const budget = pressureAtRound(compiled, r).budget;
      tr.append(h('td', { attrs: { 'data-sort': 'auto' } }, [
        h('span', { className: 'pl-auto', text: 'auto' }),
        h('span', { className: 'pl-sub', text: r === 1 ? 'opening probe' : `${budget}cr` }),
      ]));
      for (const b of TABLE_BRANCHES) {
        const may = avail.some((a) => a.branch === b);
        const text = r === 1 ? (b === 'missiles' ? `${ROUND1.missileCount}` : '') : may ? 'may' : '';
        tr.append(h('td', { className: 'pl-dim', text, attrs: { 'data-sort': r === 1 && b === 'missiles' ? String(ROUND1.missileCount) : '' } }));
      }
      tr.append(h('td', { className: 'pl-dim', text: r === 1 ? String(ROUND1.missileCount) : '—', attrs: { 'data-sort': r === 1 ? String(ROUND1.missileCount) : '' } }));
    } else {
      const adapts = roundAdapts(def, r);
      tr.append(h('td', { attrs: { 'data-sort': 'scripted' } }, [
        h('span', { className: 'pl-scripted', text: attacks.length ? 'scripted' : 'quiet' }),
        ...(adapts ? [h('span', { className: 'pl-sub', text: 'adapts' })] : []),
      ]));
      let total = 0;
      for (const b of TABLE_BRANCHES) {
        const mine = attacks.filter((x) => x.ref.branch === b);
        const sum = mine.reduce((n, a) => n + a.count, 0);
        total += sum;
        const td = h('td', { attrs: { 'data-sort': mine.length ? String(sum) : '' } });
        for (const a of mine) {
          const family = attackFamily(b);
          const pattern = family === 'launched' ? PATTERN_LABEL[runtimeAttack(a).pattern].toLowerCase() : '';
          const input = document.createElement('input');
          input.type = 'number';
          input.inputMode = 'numeric';
          input.min = '1';
          input.max = String(ATTACK_DEFAULTS.maxCount);
          input.value = String(a.count);
          input.className = 'pl-cell-num';
          input.disabled = ctx.readOnly;
          input.setAttribute('aria-label', `Round ${r} ${noun(a.ref.nodeId, 2)} count`);
          input.addEventListener('change', () => {
            const n = Math.round(Number(input.value));
            if (!Number.isFinite(n) || n < 1) return;
            a.count = Math.min(ATTACK_DEFAULTS.maxCount, n);
            commit();
          });
          td.append(h('div', { className: 'pl-cell' }, [
            input,
            h('span', { className: 'pl-cell-tag', text: `${SHORT_NODE[a.ref.nodeId] ?? ''}${pattern ? ` ${pattern}` : ''}`.trim() }),
          ]));
        }
        tr.append(td);
      }
      tr.append(h('td', { className: 'pl-total', text: String(total), attrs: { 'data-sort': String(total) } }));
    }
    tbody.append(tr);
  }
  table.append(tbody);
  enhanceTable(table, 'planner-overview');
  return h('div', { className: 'pl-overview-wrap' }, [
    h('h3', { text: 'All rounds' }),
    h('div', { className: 'hint', text: 'Edit scripted counts right in the table. Tap a round number to open it above; tap a column header to sort.' }),
    h('div', { className: 'ws-scroll pl-overview-scroll' }, [table]),
  ]);
}

/** Column headings short enough for a phone. */
const SHORT_BRANCH: Record<EnemyBranchKey, string> = {
  missiles: 'Missiles',
  torpedoes: 'Torps',
  attackBoats: 'Boats',
  mines: 'Mines',
  artillery: 'Guns',
  smoke: 'Smoke',
  electronic: 'EW',
};

/** Variant tags shown next to a count ("guided", "homing"…); the base
 *  variant of each branch is left bare. */
const SHORT_NODE: Record<string, string> = {
  guided: 'guided',
  lowSig: 'low-sig',
  homing: 'homing',
  lowSigTorpedo: 'quiet',
  rocket: 'rocket',
  boarding: 'boarding',
  ranging: 'ranging',
  rollingBarrage: 'barrage',
};

// Re-exported so tests can check the plain-English copy without a DOM.
export type { PreviewFrame };
