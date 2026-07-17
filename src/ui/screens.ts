// Phase screens: menu, after-action report, research, procurement, game over.
// Pure DOM construction — every mutation goes through the campaign helpers so
// nothing here can put the game into an invalid state.
//
// Presentation notes: screens are built from a shared card/chip/icon design
// system (see icons.ts + style.css). Entry animations only replay when the
// player NAVIGATES to a screen — a purchase rerender rebuilds the DOM with the
// same screen id and must not re-trigger the stagger, so `entering()` tracks
// the last screen id at module scope.

import { COMBAT, ECONOMY } from '../data/tuning';
import {
  FORMATIONS,
  MODULES,
  RESEARCH,
  RESEARCH_BRANCH_NAMES,
  SHIP_CLASSES,
} from '../data/defs';
import {
  buyAmmo,
  buyBase,
  buyDroneAmmo,
  buyEscort,
  buyModule,
  buyPdAmmo,
  buyShip,
  canStartResearch,
  moduleCost,
  removeModule,
  repairCost,
  repairFleet,
  setComposition,
  setFormation,
  shipCost,
  startResearch,
  totalComposition,
  totalPendingDamage,
  unlockEcm,
  unlockScan,
} from '../sim/campaign';
import { formatInterceptSummary } from '../sim/aar';
import { downloadGameLog } from './download';
import { formationFigure, icon, shipFigure, SHIP_TINTS, type IconName } from './icons';
import type {
  AarCard,
  AarCardKind,
  AfterActionReport,
  CampaignState,
  FormationId,
  ModuleId,
  ResearchBranch,
  ResearchId,
  ShipClassId,
  TransitState,
} from '../sim/types';
import { h } from './dom';

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Screen-entry tracker: true only when the player navigated here from a
 *  different screen (not a same-screen purchase rerender). */
let lastScreenId = '';
function entering(screenId: string): boolean {
  const fresh = lastScreenId !== screenId;
  lastScreenId = screenId;
  if (fresh && screenId === 'research') selectedResearch = null;
  if (fresh && screenId === 'prep') prepModuleTab = 'cargo';
  return fresh;
}

/** Make a non-button element keyboard-operable (Enter/Space = click). Used for
 *  the formation cards and tech-tree nodes, which are styled divs. */
function clickable(el: HTMLElement): HTMLElement {
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      el.click();
    }
  });
  return el;
}

/** Which ship class's module loadout is open in the prep screen (persists
 *  across purchase rerenders so the tab doesn't jump). */
let prepModuleTab: ShipClassId = 'cargo';

/** Tech-tree node the player has tapped (persists across rerenders). */
let selectedResearch: ResearchId | null = null;

/** Set by a node tap so the rebuilt screen scrolls the dossier into view —
 *  the tree can be taller than the viewport and the panel sits below it. */
let revealResearchDetail = false;

function resourceBar(c: CampaignState): HTMLElement {
  return h('div', { className: 'resource-bar' }, [
    h('span', { className: 'res-chip cash' }, [icon('coin'), h('span', { text: `$${c.cash}` })]),
    h('span', { className: 'res-chip intel' }, [icon('intel'), h('span', { text: `${c.intel}` })]),
    h('span', { className: 'res-chip conf' }, [icon('star'), h('span', { text: `${c.confidence}` })]),
  ]);
}

function screenShell(
  title: string,
  sub: string,
  c: CampaignState | null,
  screenId: string,
): { root: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  const animate = entering(screenId);
  const body = h('div', { className: 'screen-body' });
  const footer = h('div', { className: 'screen-footer' });
  const header = h('div', { className: 'screen-header' }, [
    h('h1', { text: title }),
    h('span', { className: 'sub', text: sub }),
  ]);
  if (c) header.append(resourceBar(c));
  const root = h(
    'div',
    { className: animate ? 'screen enter' : 'screen', attrs: { 'data-screen': screenId } },
    [header, body, footer],
  );
  return { root, body, footer };
}

/** A tiny labelled progress bar. The fill animates in on the next frame so the
 *  bar visibly sweeps to its value. */
function progressBar(fraction: number, tone: '' | 'good' | 'warn' | 'bad' = ''): HTMLElement {
  const fill = h('div', { className: `fill ${tone}`.trim() });
  const bar = h('div', { className: 'bar' }, [fill]);
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fill.style.width = `${pct}%`;
  }));
  return bar;
}

function chip(iconName: IconName, text: string, title = ''): HTMLElement {
  const el = h('span', { className: 'chip' }, [icon(iconName), h('span', { text })]);
  if (title) el.title = title;
  return el;
}

/** Animate a numeric value counting up inside an element. Stops on its own if
 *  the element leaves the DOM (screen swapped away mid-animation). */
function countUp(
  el: HTMLElement,
  to: number,
  opts: { from?: number; dur?: number; format?: (v: number) => string } = {},
): void {
  const from = opts.from ?? 0;
  const dur = opts.dur ?? 800;
  const format = opts.format ?? ((v: number) => `${v}`);
  el.textContent = format(from);
  const t0 = performance.now();
  const step = (now: number): void => {
    if (!el.isConnected && now - t0 > 100) return;
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Plain-language guidance about the current quota: how much is left and how
 *  many rounds remain. Clearing it immediately starts a new, larger quota. */
function quotaSummary(c: CampaignState): { text: string; met: boolean } {
  const q = c.quota;
  const met = q.pointsEarned >= q.pointsNeeded;
  if (met) {
    return { met: true, text: 'Quota cleared — a larger quota takes over next round.' };
  }
  const need = q.pointsNeeded - q.pointsEarned;
  return {
    met: false,
    text: `Deliver ${need} more cargo point(s) within ${q.roundsLeft} round(s) to clear this quota.`,
  };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function menuScreen(
  hasSave: boolean,
  onNew: () => void,
  onContinue: () => void,
): HTMLElement {
  entering('menu');
  return h('div', { className: 'screen menu', attrs: { 'data-screen': 'menu' } }, [
    h('div', { className: 'menu-emblem' }, [icon('anchor')]),
    h('h1', { text: 'Straitwatch' }),
    h('div', {
      className: 'tagline',
      text:
        'Shepherd civilian convoys through a contested strait. Every convoy that gets through ' +
        'teaches the enemy something — and every attack they invent teaches you. Outlast the arms race.',
    }),
    h('div', { className: 'buttons' }, [
      h('button', { className: 'primary', text: 'New Campaign', onClick: onNew }),
      h('button', { text: 'Continue', disabled: !hasSave, onClick: onContinue }),
    ]),
  ]);
}

// ---------------------------------------------------------------------------
// After-action report — a sequenced debrief the player taps through
// ---------------------------------------------------------------------------

const AAR_CARD_ICONS: Record<AarCardKind, IconName> = {
  loss: 'flame',
  discovery: 'eye',
  warning: 'radar',
  quota: 'coin',
  capacity: 'anchor',
  research: 'flask',
  info: 'alert',
};

export function aarScreen(
  c: CampaignState,
  report: AfterActionReport,
  transit: TransitState | null,
  onContinue: () => void,
): HTMLElement {
  const { root, body, footer } = screenShell(
    `After-Action Report — Round ${report.round}`,
    'What happened, and what the enemy learned',
    c,
    'aar',
  );

  const s = report.stats;
  const deliveredPct = s.launched > 0 ? Math.round((s.delivered / s.launched) * 100) : 0;

  // Each beat is a factory so its animations (count-ups, pop-ins) start when
  // the beat is revealed, not when the screen mounts.
  const beats: (() => HTMLElement)[] = [];

  // --- Beat: convoy outcome banner -------------------------------------------
  beats.push(() => {
    const strip = h('div', { className: 'convoy-strip' });
    if (transit) {
      const ships = [...transit.ships].sort((a, b) => a.spawnTime - b.spawnTime);
      ships.forEach((ship, i) => {
        strip.append(
          h(
            'span',
            {
              className: `convoy-ship ${ship.delivered ? 'ok' : 'lost'}`,
              attrs: {
                style: `color:${SHIP_TINTS[ship.classId]};animation-delay:${i * 45}ms`,
                title: `${ship.name} — ${ship.delivered ? 'delivered' : 'lost'}`,
              },
            },
            [shipFigure(ship.classId)],
          ),
        );
      });
    } else {
      // Resumed campaign: the transit record is gone; show plain counts.
      for (let i = 0; i < s.delivered; i++) {
        strip.append(
          h('span', {
            className: 'convoy-ship ok',
            attrs: { style: `color:${SHIP_TINTS.cargo};animation-delay:${i * 45}ms` },
          }, [shipFigure('cargo')]),
        );
      }
      for (let i = 0; i < s.lost; i++) {
        strip.append(
          h('span', {
            className: 'convoy-ship lost',
            attrs: { style: `color:${SHIP_TINTS.cargo};animation-delay:${(s.delivered + i) * 45}ms` },
          }, [shipFigure('cargo')]),
        );
      }
    }

    const big = h('span', { className: 'aar-big' });
    countUp(big, s.delivered, { dur: 950, format: (v) => `${v}/${s.launched}` });
    return h('div', { className: 'aar-banner card' }, [
      h('div', { className: 'card-head' }, [
        icon('anchor'),
        h('h3', { text: `Transit complete — Round ${report.round}` }),
      ]),
      strip,
      h('div', { className: 'aar-bigrow' }, [
        big,
        h('span', {
          className: 'hint',
          text: `ships delivered · ${deliveredPct}% of the convoy made it through`,
        }),
      ]),
      h('div', { className: 'convoy-legend hint', text: '⬤ delivered   ✕ lost at sea' }),
    ]);
  });

  // --- Beat: headline numbers ---------------------------------------------------
  beats.push(() => {
    const grid = h('div', { className: 'stat-grid' });
    const animStat = (
      label: string,
      to: number,
      format: (v: number) => string,
      tone = '',
    ): void => {
      const value = h('div', { className: `value ${tone}`.trim() });
      countUp(value, to, { dur: 800, format });
      grid.append(h('div', { className: 'stat' }, [h('div', { className: 'label', text: label }), value]));
    };
    animStat('Ships delivered', s.delivered, (v) => `${v}/${s.launched}`,
      deliveredPct >= 85 ? 'good' : deliveredPct < 60 ? 'bad' : '');
    animStat('Ships lost', s.lost, (v) => `${v}`, s.lost > 0 ? 'bad' : 'good');
    animStat('Cargo value', s.valueDelivered, (v) => `${v}`);
    animStat('Cash earned', report.cashEarned, (v) => `+$${v}`, 'good');
    animStat('Intel gained', report.intelEarned, (v) => `+${v}`);
    animStat(
      'Confidence',
      report.confidenceAfter,
      (v) => `${v} (${report.confidenceChange >= 0 ? '+' : ''}${report.confidenceChange})`,
      report.confidenceChange >= 0 ? 'good' : 'bad',
    );
    return grid;
  });

  // --- Beat: defensive summary ----------------------------------------------------
  beats.push(() =>
    h('div', { className: 'card' }, [
      h('div', { className: 'card-head' }, [icon('shield'), h('h3', { text: 'Defensive summary' })]),
      h('p', {
        text: transit
          ? `${formatInterceptSummary(transit)} Interceptors expended: ${s.ammoUsed}.` +
            (s.minesTotal > 0
              ? ` Mines: ${s.minesRevealed}/${s.minesTotal} charted, ${s.minesDetonated} detonated, ${s.minesSwept} swept.`
              : '') +
            (s.launchersDisabled > 0
              ? ` Launchers knocked offline ${s.launchersDisabled} time(s) by enemy fire.`
              : '') +
            (s.escortsLost > 0 ? ` Escorts lost: ${s.escortsLost}.` : '') +
            (s.basesLost > 0 ? ` Shore batteries destroyed: ${s.basesLost}.` : '')
          : 'Transit record unavailable (resumed campaign).',
      }),
    ]),
  );

  // --- Beat: quota progress (only mid-window; evaluation gets its own card) -------
  if (!report.quota.evaluated) {
    const qs = quotaSummary(c);
    beats.push(() =>
      h('div', { className: `card ${qs.met ? 'capacity' : 'quota'}` }, [
        h('div', { className: 'card-head' }, [icon('coin'), h('h3', { text: 'Delivery quota' })]),
        h('p', {
          text: `${c.quota.pointsEarned}/${c.quota.pointsNeeded} cargo points this period. ${qs.text}`,
        }),
        progressBar(
          c.quota.pointsNeeded > 0 ? c.quota.pointsEarned / c.quota.pointsNeeded : 0,
          qs.met ? 'good' : 'warn',
        ),
      ]),
    );
  }

  // --- Beats: report cards. All lost-ship cards are shown TOGETHER in one beat
  //     (the player shouldn't have to click through each sinking); other cards
  //     stay one-per-beat. Order is preserved by flushing the loss group in place.
  const lossGroup: AarCard[] = [];
  const flushLosses = (): void => {
    if (lossGroup.length === 0) return;
    const cards = lossGroup.slice();
    lossGroup.length = 0;
    beats.push(() => {
      const wrap = h('div', { className: 'loss-group' }, [
        h('div', { className: 'loss-group-head' }, [
          icon('flame'),
          h('h3', { text: cards.length === 1 ? 'Ship lost' : `${cards.length} ships lost` }),
        ]),
      ]);
      for (const card of cards) {
        wrap.append(
          h('div', { className: 'card loss' }, [
            h('div', { className: 'card-head' }, [icon('flame'), h('h3', { text: card.title })]),
            h('p', { text: card.body }),
          ]),
        );
      }
      return wrap;
    });
  };
  for (const card of report.cards) {
    if (card.kind === 'loss') {
      lossGroup.push(card);
      continue;
    }
    flushLosses();
    beats.push(() =>
      h('div', { className: `card ${card.kind}` }, [
        h('div', { className: 'card-head' }, [
          icon(AAR_CARD_ICONS[card.kind] ?? 'alert'),
          h('h3', { text: card.title }),
        ]),
        h('p', { text: card.body }),
      ]),
    );
  }
  flushLosses();

  // --- Reveal engine -------------------------------------------------------------
  footer.classList.add('hidden');
  footer.append(
    h('button', { text: 'Download game log', onClick: () => downloadGameLog(c) }),
    h('button', {
      className: 'primary',
      text: report.campaignOver ? 'Final Report' : 'Continue to Intelligence & Research',
      onClick: onContinue,
    }),
  );

  let next = 0;
  let finished = false;
  const advance = h('div', { className: 'aar-advance' }, [
    h('span', { className: 'aar-advance-hint' }, [
      icon('chevrons', 'down'),
      h('span', { text: 'Tap to continue' }),
    ]),
    h('button', {
      className: 'ghost',
      text: 'Skip ▸▸',
      onClick: () => {
        while (next < beats.length) addBeat(true);
        finish();
      },
    }),
  ]);

  const finish = (): void => {
    if (finished) return;
    finished = true;
    advance.remove();
    footer.classList.remove('hidden');
  };

  const addBeat = (fast = false): HTMLElement => {
    const el = beats[next++]();
    el.classList.add('beat');
    if (fast) el.classList.add('fast');
    body.insertBefore(el, advance);
    return el;
  };

  const reveal = (): void => {
    if (finished) return;
    const el = addBeat();
    if (next >= beats.length) {
      finish();
      // The footer sits OUTSIDE the scrolling body — scroll the last beat
      // itself so the final card is actually on screen.
      requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    } else {
      requestAnimationFrame(() => advance.scrollIntoView({ behavior: 'smooth', block: 'end' }));
    }
  };

  body.append(advance);
  // Tapping anywhere in the debrief (except a real button) advances it.
  body.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('button')) return;
    reveal();
  });
  reveal(); // the banner is on screen immediately

  return root;
}

// ---------------------------------------------------------------------------
// Research — an interactive tech tree
// ---------------------------------------------------------------------------

const BRANCH_ORDER: ResearchBranch[] = [
  'sensors',
  'interception',
  'mineWarfare',
  'electronicWarfare',
  'resilience',
  'logistics',
];

const BRANCH_ICONS: Record<ResearchBranch, IconName> = {
  sensors: 'radar',
  interception: 'missile',
  mineWarfare: 'mine',
  resilience: 'shield',
  electronicWarfare: 'jam',
  logistics: 'anchor',
};

const RESEARCH_ICONS: Record<ResearchId, IconName> = {
  sensors1: 'radar',
  sensors2: 'sonar',
  sensors3: 'eye',
  intercept1: 'missile',
  intercept2: 'chevrons',
  mines1: 'drone',
  resilience1: 'shield',
  resilience2: 'flame',
  ew1: 'jam',
  logistics1: 'anchor',
};

type NodeState = 'done' | 'active' | 'ready' | 'known' | 'locked';

function researchNodeState(c: CampaignState, id: ResearchId): NodeState {
  const def = RESEARCH[id];
  if (c.completedResearch.includes(id)) return 'done';
  if (c.activeResearch?.id === id) return 'active';
  if (def.requires && !c.completedResearch.includes(def.requires)) return 'locked';
  return canStartResearch(c, id).ok ? 'ready' : 'known';
}

export function researchScreen(c: CampaignState, onContinue: () => void, rerender: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    'Intelligence & Research',
    'One project at a time; results arrive after the next transit',
    c,
    'research',
  );

  if (c.activeResearch) {
    const def = RESEARCH[c.activeResearch.id];
    body.append(
      h('div', { className: 'card research active-banner' }, [
        h('div', { className: 'card-head' }, [
          icon('flask', 'spin-slow'),
          h('h3', { text: `In progress: ${def.name}` }),
        ]),
        h('p', { text: 'The lab will deliver after the next transit. Choose wisely what the convoy must survive until then.' }),
        h('div', { className: 'bar stripes' }, [h('div', { className: 'fill accent', attrs: { style: 'width:60%' } })]),
      ]),
    );
  }

  // --- The tree ---------------------------------------------------------------
  const tree = h('div', { className: 'tech-tree' });
  for (const branch of BRANCH_ORDER) {
    const ids = (Object.keys(RESEARCH) as ResearchId[]).filter((id) => RESEARCH[id].branch === branch);
    const nodes = h('div', { className: 'tech-nodes' });
    ids.forEach((id, i) => {
      const def = RESEARCH[id];
      const state = researchNodeState(c, id);
      if (i > 0) {
        const prevDone = c.completedResearch.includes(ids[i - 1]);
        nodes.append(h('div', { className: prevDone ? 'tech-connector done' : 'tech-connector' }));
      }
      const orbIcon =
        state === 'done' ? 'check' : state === 'active' ? 'flask' : state === 'locked' ? 'lock' : RESEARCH_ICONS[id];
      const node = clickable(h(
        'div',
        {
          className: `tech-node ${state}${selectedResearch === id ? ' selected' : ''}`,
          onClick: () => {
            selectedResearch = selectedResearch === id ? null : id;
            revealResearchDetail = selectedResearch !== null;
            rerender();
          },
        },
        [
          h('div', { className: 'orb' }, [icon(orbIcon)]),
          h('div', { className: 'tech-name', text: def.name }),
          state === 'done'
            ? h('div', { className: 'tech-cost done', text: 'deployed' })
            : state === 'active'
              ? h('div', { className: 'tech-cost active', text: 'in progress' })
              : h('div', { className: 'tech-cost' }, [icon('intel'), h('span', { text: `${def.cost}` })]),
        ],
      ));
      nodes.append(node);
    });
    tree.append(
      h('div', { className: 'tech-branch' }, [
        h('div', { className: 'tech-branch-label' }, [
          icon(BRANCH_ICONS[branch]),
          h('span', { text: RESEARCH_BRANCH_NAMES[branch] ?? branch }),
        ]),
        nodes,
      ]),
    );
  }
  body.append(tree);

  // --- Detail panel for the selected node ----------------------------------------
  if (selectedResearch) {
    const id = selectedResearch;
    const def = RESEARCH[id];
    const state = researchNodeState(c, id);
    const check = canStartResearch(c, id);
    const shouldReveal = revealResearchDetail;
    revealResearchDetail = false;
    let status: string;
    switch (state) {
      case 'done':
        status = 'Deployed — this capability is active across the fleet.';
        break;
      case 'active':
        status = 'In progress — the lab delivers after the next transit.';
        break;
      case 'locked':
        status = `Requires ${RESEARCH[def.requires!].name} first.`;
        break;
      default:
        status = check.ok
          ? 'The lab is ready to begin immediately.'
          : check.reason === 'A project is already underway'
            ? 'The lab is already committed to another project this round.'
            : `Not enough intel — you have ${c.intel} of ${def.cost}.`;
    }
    const detail =
      h('div', { className: `tech-detail ${state}` }, [
        h('div', { className: 'tech-detail-orb' }, [icon(RESEARCH_ICONS[id])]),
        h('div', { className: 'tech-detail-info' }, [
          h('h3', { text: def.name }),
          h('div', { className: 'hint', text: RESEARCH_BRANCH_NAMES[def.branch] ?? def.branch }),
          h('p', { text: def.desc }),
          h('div', { className: 'hint status', text: status }),
        ]),
        h('div', { className: 'tech-detail-action' }, [
          chip('intel', `${def.cost} intel`, 'Project cost'),
          h('button', {
            className: 'primary',
            text: state === 'done' ? 'Deployed ✓' : state === 'active' ? 'In progress…' : 'Begin research',
            disabled: !check.ok,
            onClick: () => {
              if (startResearch(c, id)) rerender();
            },
          }),
        ]),
      ]);
    body.append(detail);
    if (shouldReveal) {
      // Double-rAF: game.ts restores the old scrollTop right after the swap,
      // and this scroll must land after that restoration.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' })),
      );
    }
  } else {
    body.append(
      h('div', { className: 'tech-detail empty hint', text: 'Select a project above to review its dossier.' }),
    );
  }

  footer.append(
    h('button', { className: 'primary', text: 'Continue to Preparation', onClick: onContinue }),
  );
  return root;
}

// ---------------------------------------------------------------------------
// Procurement / preparation
// ---------------------------------------------------------------------------

const SHIP_TAGLINES: Record<ShipClassId, string> = {
  cargo: 'The backbone of the operation — dependable hull, dependable value.',
  tanker: 'More than twice the payout — but she goes up violently when lost.',
  freighter: 'Fast, cheap and fragile — first through the strait, first to sink when caught.',
};

const MODULE_ICONS: Record<ModuleId, IconName> = {
  pointDefense: 'turret',
  missileWarning: 'alert',
  reinforcedHull: 'shield',
  mineSonar: 'sonar',
  fireSuppression: 'flame',
};

export function prepScreen(c: CampaignState, onLaunch: () => void, rerender: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    `Preparation — Round ${c.round}`,
    'Fit out the convoy and its defenses, then sail',
    c,
    'prep',
  );

  // --- Mission brief: capacity + quota at a glance ------------------------------
  const assigned = totalComposition(c);
  const qs = quotaSummary(c);
  body.append(
    h('div', { className: 'brief-strip' }, [
      h('div', { className: 'brief' }, [
        h('div', { className: 'brief-row' }, [
          icon('anchor'),
          h('span', { text: 'Convoy capacity' }),
          h('span', { className: 'brief-num', text: `${assigned}/${c.capacity}` }),
        ]),
        progressBar(c.capacity > 0 ? assigned / c.capacity : 0, assigned >= c.capacity ? 'warn' : ''),
      ]),
      h('div', { className: 'brief' }, [
        h('div', { className: 'brief-row' }, [
          icon('coin'),
          h('span', { text: `Quota · ${c.quota.roundsLeft} round(s) left` }),
          qs.met
            ? h('span', { className: 'brief-tag good', text: 'MET' })
            : h('span'),
          h('span', { className: 'brief-num', text: `${c.quota.pointsEarned}/${c.quota.pointsNeeded}` }),
        ]),
        progressBar(
          c.quota.pointsNeeded > 0 ? c.quota.pointsEarned / c.quota.pointsNeeded : 0,
          qs.met ? 'good' : 'warn',
        ),
        h('div', { className: 'hint', text: qs.text }),
      ]),
    ]),
  );

  // --- Convoy composition -----------------------------------------------------
  const compPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Convoy composition' }),
  ]);
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const def = SHIP_CLASSES[classId];
    compPanel.append(
      h('div', { className: 'ship-card' }, [
        h('div', { className: 'ship-fig', attrs: { style: `color:${SHIP_TINTS[classId]}` } }, [
          shipFigure(classId),
        ]),
        h('div', { className: 'ship-info' }, [
          h('div', { className: 'ship-title' }, [
            h('span', { className: 'name', text: def.name }),
            h('span', { className: 'hint', text: `owned ${c.fleet[classId]}` }),
          ]),
          h('div', { className: 'hint', text: SHIP_TAGLINES[classId] }),
          h('div', { className: 'chip-row' }, [
            chip('coin', `${def.value}`, 'Cargo value delivered per run'),
            chip('shield', `${def.hp}`, 'Hull points'),
            chip('speed', `${def.speed}`, 'Cruise speed'),
            chip('slots', `${c.classModules[classId].length}/${def.slots}`, 'Module slots used'),
          ]),
        ]),
        (() => {
          const hullCost = shipCost(c, classId);
          const surcharge = hullCost - def.replaceCost;
          return h('div', { className: 'ship-actions' }, [
            h('div', { className: 'stepper' }, [
              h('button', {
                text: '−',
                onClick: () => {
                  setComposition(c, classId, c.composition[classId] - 1);
                  rerender();
                },
              }),
              h('span', { className: 'count', text: `${c.composition[classId]}` }),
              h('button', {
                text: '+',
                onClick: () => {
                  setComposition(c, classId, c.composition[classId] + 1);
                  rerender();
                },
              }),
            ]),
            h('button', {
              className: 'buy-hull',
              disabled: c.cash < hullCost,
              onClick: () => {
                if (buyShip(c, classId)) rerender();
              },
            }, [
              h('span', { text: `Buy hull $${hullCost}` }),
              surcharge > 0
                ? h('span', { className: 'sub-cost', text: `incl. $${surcharge} modules` })
                : h('span'),
            ]),
          ]);
        })(),
      ]),
    );
  }

  // --- Formation -----------------------------------------------------------------
  const formPanel = h('div', { className: 'panel' }, [h('h2', { text: 'Sailing formation' })]);
  for (const id of Object.keys(FORMATIONS) as FormationId[]) {
    const def = FORMATIONS[id];
    formPanel.append(
      clickable(h(
        'div',
        {
          className: c.formation === id ? 'formation-card selected' : 'formation-card',
          onClick: () => {
            setFormation(c, id);
            rerender();
          },
        },
        [
          formationFigure(id),
          h('div', { className: 'formation-info' }, [
            h('div', { className: 'formation-title' }, [
              h('span', { className: 'name', text: def.name }),
              h('span', { className: 'hint', text: `speed ×${def.speedMult}` }),
            ]),
            h('div', { className: 'chip-row' }, [
              chip(
                'turret',
                `${def.interceptAccuracy >= 0 ? '+' : ''}${Math.round(def.interceptAccuracy * 100)}%`,
                'Interceptor accuracy from this formation',
              ),
              chip('radar', `×${def.defenseRangeMult}`, 'Point-defense & escort reach'),
              chip(
                'flame',
                def.chainSplashRadius > 0 ? 'chains' : 'isolated',
                def.chainSplashRadius > 0
                  ? 'A direct hit splashes into neighboring hulls'
                  : 'Hits stay isolated to one ship',
              ),
            ]),
            h('div', { className: 'hint', text: def.desc }),
          ]),
        ],
      )),
    );
  }

  // --- Ship modules: class tabs + inline-description cards -------------------------
  const modPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Ship modules — refit a whole class' }),
  ]);
  const tabs = h('div', { className: 'tabs' });
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const def = SHIP_CLASSES[classId];
    const owned = c.classModules[classId];
    const dots = Array.from({ length: def.slots }, (_, i) =>
      h('span', { className: i < owned.length ? 'slot-dot filled' : 'slot-dot' }),
    );
    tabs.append(
      h(
        'button',
        {
          className: prepModuleTab === classId ? 'tab selected' : 'tab',
          onClick: () => {
            prepModuleTab = classId;
            rerender();
          },
        },
        [
          h('span', { className: 'tab-fig', attrs: { style: `color:${SHIP_TINTS[classId]}` } }, [
            shipFigure(classId),
          ]),
          h('span', { className: 'tab-label' }, [
            h('span', { text: def.name }),
            h('span', { className: 'slot-dots' }, dots),
          ]),
        ],
      ),
    );
  }
  modPanel.append(tabs);

  const activeClass = prepModuleTab;
  const activeDef = SHIP_CLASSES[activeClass];
  const activeOwned = c.classModules[activeClass];
  const modGrid = h('div', { className: 'module-grid' });
  for (const moduleId of Object.keys(MODULES) as ModuleId[]) {
    const mod = MODULES[moduleId];
    const isOwned = activeOwned.includes(moduleId);
    const cost = moduleCost(c, activeClass, moduleId);
    const full = activeOwned.length >= activeDef.slots;
    const canBuy = !isOwned && !full && c.cash >= cost;
    const refund = c.modulePaid[activeClass]?.[moduleId] ?? cost;
    modGrid.append(
      h('div', { className: isOwned ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon(MODULE_ICONS[moduleId]),
          h('h3', { text: mod.name }),
          isOwned ? h('span', { className: 'badge good', text: 'Equipped' }) : h('span'),
        ]),
        h('p', { text: mod.desc }),
        isOwned
          ? h('button', {
              className: 'unequip',
              text: `Unequip — refund $${refund}`,
              onClick: () => {
                if (removeModule(c, activeClass, moduleId)) rerender();
              },
            })
          : h('button', {
              text: full ? 'No slots free' : c.cash < cost ? `Need $${cost}` : `Equip class — $${cost}`,
              disabled: !canBuy,
              onClick: () => {
                if (buyModule(c, activeClass, moduleId)) rerender();
              },
            }),
      ]),
    );
  }
  modPanel.append(
    modGrid,
    h('div', {
      className: 'hint',
      text:
        `Refits apply to every ${activeDef.name} you own (${Math.max(1, c.fleet[activeClass])} hull(s)) — pricing scales with the fleet. ` +
        'Unequip to swap loadouts freely (you get the fitting cost back), and note a fitted module raises the price of buying a new hull of that class.',
    }),
  );

  // --- Support assets: every item explains itself inline ----------------------------
  const assetPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Air defense & support assets' }),
  ]);
  const assetGrid = h('div', { className: 'asset-grid' });

  const assetCard = (
    ic: IconName,
    title: string,
    count: string,
    desc: string,
    action: { label: string; disabled: boolean; onClick: () => void } | null,
  ): HTMLElement => {
    const card = h('div', { className: 'asset-card' }, [
      h('div', { className: 'card-head' }, [
        icon(ic),
        h('h3', { text: title }),
        h('span', { className: 'asset-count', text: count }),
      ]),
      h('p', { text: desc }),
    ]);
    if (action) {
      card.append(
        h('button', { text: action.label, disabled: action.disabled, onClick: action.onClick }),
      );
    }
    return card;
  };

  assetGrid.append(
    assetCard(
      'turret',
      'Shore battery',
      `${c.bases}/${ECONOMY.maxBases}`,
      `Hardened launcher on the friendly shore. Unlimited range, ${COMBAT.base.reload}s reload — and it fires the FAST interceptor type, which gets much faster with Interception research. Can be struck, knocked offline and destroyed.`,
      {
        label: `Build battery — $${ECONOMY.baseCost}`,
        disabled: c.bases >= ECONOMY.maxBases || c.cash < ECONOMY.baseCost,
        onClick: () => {
          if (buyBase(c)) rerender();
        },
      },
    ),
    assetCard(
      'missile',
      'Escort ship',
      `${c.escorts}/${ECONOMY.maxEscorts}`,
      `Mobile launcher that sails with the convoy: ${COMBAT.interceptor.cooldown}s base reload but slower interceptors and limited range. The ONLY hull that can launch minesweeper drones. Tap it in transit to order it around the map.`,
      {
        label: `Hire escort — $${ECONOMY.escortCost}`,
        disabled: c.escorts >= ECONOMY.maxEscorts || c.cash < ECONOMY.escortCost,
        onClick: () => {
          if (buyEscort(c)) rerender();
        },
      },
    ),
    assetCard(
      'chevrons',
      'Interceptor ammunition',
      `${c.ammo}`,
      'Shared magazine for every launcher — each interceptor fired, from a battery or an escort, expends one round. Unused rounds carry over.',
      {
        label: `Buy 5 — $${ECONOMY.ammoCost * 5}`,
        disabled: c.cash < ECONOMY.ammoCost * 5,
        onClick: () => {
          if (buyAmmo(c, 5)) rerender();
        },
      },
    ),
    assetCard(
      'drone',
      'Drone munitions',
      `${c.droneAmmo}`,
      c.completedResearch.includes('mines1')
        ? 'One munition per sweep. In transit, TAP a charted mine to send a drone from the nearest escort — an escort must be within about 7 ship-lengths, so close in first. No stock, no sweeps.'
        : 'One munition per sweep — requires the Minesweeping Drones research (and an escort close to the mine) before drones can fly. Stock carries over.',
      {
        label: `Buy ${ECONOMY.droneAmmoPerBuy} — $${ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy}`,
        disabled: c.cash < ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy,
        onClick: () => {
          if (buyDroneAmmo(c)) rerender();
        },
      },
    ),
    assetCard(
      'turret',
      'Point-defense rounds',
      `${c.pdAmmo}`,
      'Ammunition for the Point-Defense Turret module. Every turret shot draws from this shared stock (one shot per turret per transit) — a fitted turret does nothing without rounds. Stock carries over.',
      {
        label: `Buy ${ECONOMY.pdAmmoPerBuy} — $${ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy}`,
        disabled: c.cash < ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy,
        onClick: () => {
          if (buyPdAmmo(c)) rerender();
        },
      },
    ),
    assetCard(
      'planeEcm',
      'ECM aircraft',
      c.ecmUnlocked ? `${COMBAT.ecm.chargesPerRound}/round` : '—',
      `Call it onto any patch of open water: it orbits there jamming guided seekers, and any missile that lingers ${COMBAT.ecm.explodeSeconds}s inside the orbit is destroyed. It cannot be stationed over a shore or launcher.`,
      c.ecmUnlocked
        ? null
        : {
            label: `Commission — $${ECONOMY.ecmUnlockCost}`,
            disabled: c.cash < ECONOMY.ecmUnlockCost,
            onClick: () => {
              if (unlockEcm(c)) rerender();
            },
          },
    ),
    assetCard(
      'planeScan',
      'Scan aircraft',
      c.scanUnlocked ? `${COMBAT.scan.chargesPerRound}/round` : '—',
      'Pick a lane and the aircraft sweeps its full length, charting the mines in THAT lane only (low-signature mines may still slip past standard sensors). Ships always steer around charted mines — and your escorts can send drones to clear them.',
      c.scanUnlocked
        ? null
        : {
            label: `Commission — $${ECONOMY.scanUnlockCost}`,
            disabled: c.cash < ECONOMY.scanUnlockCost,
            onClick: () => {
              if (unlockScan(c)) rerender();
            },
          },
    ),
  );

  const repair = repairCost(c);
  const totalDamage = totalPendingDamage(c);
  assetGrid.append(
    assetCard(
      'wrench',
      'Fleet repairs',
      totalDamage > 0 ? `${totalDamage} hp` : '✓',
      totalDamage > 0
        ? 'Unrepaired damage sails with the next convoy — cargo hulls, escorts and batteries all carry their wounds until you pay the yard.'
        : 'Every hull, escort and battery is at full strength.',
      {
        label: repair > 0 ? `Repair all — $${repair}` : 'No repairs needed',
        disabled: repair <= 0 || c.cash < repair,
        onClick: () => {
          if (repairFleet(c)) rerender();
        },
      },
    ),
  );
  assetPanel.append(assetGrid);

  body.append(h('div', { className: 'grid-2' }, [compPanel, formPanel]), modPanel, assetPanel);

  const canLaunch = totalComposition(c) > 0;
  footer.append(
    h('div', {
      className: 'hint',
      text: canLaunch
        ? `${totalComposition(c)} ships will sail this round.`
        : 'Assign at least one ship to the convoy.',
    }),
    h('button', {
      className: canLaunch ? 'primary launch' : 'primary',
      text: 'Begin Transit',
      disabled: !canLaunch,
      onClick: onLaunch,
    }),
  );
  return root;
}

// ---------------------------------------------------------------------------
// Game over
// ---------------------------------------------------------------------------

export function gameOverScreen(c: CampaignState, onNewCampaign: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    'Campaign Over',
    'The consortium has withdrawn its backing',
    null,
    'gameover',
  );
  const totalDelivered = c.history.reduce((a, r) => a + r.delivered, 0);
  const totalLost = c.history.reduce((a, r) => a + r.lost, 0);
  const totalValue = c.history.reduce((a, r) => a + r.valueDelivered, 0);
  body.append(
    h('div', { className: 'stat-grid' }, [
      stat('Final score', `${c.score}`),
      stat('Rounds survived', `${c.history.length}`),
      stat('Ships delivered', `${totalDelivered}`, 'good'),
      stat('Ships lost', `${totalLost}`, 'bad'),
      stat('Cargo value moved', `${totalValue}`),
      stat('Peak convoy capacity', `${c.capacity}`),
    ]),
    h('div', { className: 'card' }, [
      h('div', { className: 'card-head' }, [icon('anchor'), h('h3', { text: 'The strait remembers' })]),
      h('p', {
        text:
          'Confidence in the operation collapsed and the shipping lanes closed. ' +
          'The enemy doctrine you faced was shaped by every convoy you ran — a different ' +
          'campaign will breed a different predator.',
      }),
    ]),
  );
  footer.append(
    h('button', { text: 'Download game log', onClick: () => downloadGameLog(c) }),
    h('button', { className: 'primary', text: 'New Campaign', onClick: onNewCampaign }),
  );
  return root;
}

function stat(label: string, value: string, tone = ''): HTMLElement {
  return h('div', { className: 'stat' }, [
    h('div', { className: 'label', text: label }),
    h('div', { className: `value ${tone}`, text: value }),
  ]);
}
