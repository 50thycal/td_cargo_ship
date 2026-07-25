// Phase screens: menu, after-action report, research, procurement, game over.
// Pure DOM construction — every mutation goes through the campaign helpers so
// nothing here can put the game into an invalid state.
//
// Presentation notes: screens are built from a shared card/chip/icon design
// system (see icons.ts + style.css). Entry animations only replay when the
// player NAVIGATES to a screen — a purchase rerender rebuilds the DOM with the
// same screen id and must not re-trigger the stagger, so `entering()` tracks
// the last screen id at module scope.

import { ECONOMY } from '../data/tuning';
import {
  BASE_MODULES,
  BASE_MODULE_SLOTS,
  ESCORT_MODULES,
  ESCORT_MODULE_SLOTS,
  FORMATIONS,
  MODULES,
  SHIP_CLASSES,
} from '../data/defs';
import {
  CATEGORY_ORDER,
  COUNTER_BRANCHES,
  COUNTER_CATEGORY_NAMES,
  ENEMY_BRANCH_NAMES,
  RESEARCH_INDEX,
  type CounterBranchDef,
  type CounterBranchId,
  type CounterCategoryId,
  type CounterNodeDef,
  type CounterRole,
  type CounterTacticDef,
  type PlatformKind,
  type TacticKind,
} from '../data/counters';
import {
  baseModuleBlockReason,
  buyAmmo,
  buyBase,
  buyBaseModule,
  buyDroneAmmo,
  buyEscort,
  buyEscortModule,
  buyModule,
  buyPdAmmo,
  buyShip,
  canStartResearch,
  type DevOptions,
  escortModuleBlockReason,
  hasResearch,
  moduleBlockReason,
  moduleCost,
  removeBaseModule,
  removeEscortModule,
  removeModule,
  repairCost,
  repairFleet,
  setComposition,
  setFormation,
  setProtectedChannels,
  shipCost,
  startResearch,
  totalComposition,
  totalPendingDamage,
  unlockEcm,
  unlockHardened,
  unlockScan,
  unlockSmoke,
  unlockSonar,
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
  ResearchId,
  SensorFamily,
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

const PHASE_LABELS: Record<CampaignState['phase'], string> = {
  prep: 'Preparation',
  transit: 'Transit',
  aar: 'After-Action',
  research: 'Research',
};

export function menuScreen(opts: {
  saved: CampaignState | null;
  onNew: () => void;
  onContinue: () => void;
  devAvailable: boolean;
  onDev: () => void;
}): HTMLElement {
  entering('menu');
  const { saved } = opts;
  const continueLabel = saved
    ? saved.campaignOver
      ? 'View Final Report'
      : `Continue Run — Round ${saved.round}`
    : 'Continue';
  const buttons = h('div', { className: 'buttons' }, [
    h('button', { className: 'primary', text: 'New Campaign', onClick: opts.onNew }),
    h('button', { text: continueLabel, disabled: !saved, onClick: opts.onContinue }),
  ]);
  const children: HTMLElement[] = [
    h('div', { className: 'menu-emblem' }, [icon('anchor')]),
    h('h1', { text: 'Straitwatch' }),
    h('div', {
      className: 'tagline',
      text:
        'Shepherd civilian convoys through a contested strait. Every convoy that gets through ' +
        'teaches the enemy something — and every attack they invent teaches you. Outlast the arms race.',
    }),
    buttons,
  ];
  if (saved && !saved.campaignOver) {
    children.push(
      h('div', {
        className: 'menu-save-note hint',
        text: `Your run is saved automatically — pick up at Round ${saved.round} (${PHASE_LABELS[saved.phase]}).`,
      }),
    );
  }
  if (opts.devAvailable) {
    children.push(
      h('button', { className: 'menu-dev-btn', text: '🛠 Dev Mode', onClick: opts.onDev }),
    );
  }
  return h('div', { className: 'screen menu', attrs: { 'data-screen': 'menu' } }, children);
}

// ---------------------------------------------------------------------------
// Dev mode — god abilities & level select for testing
// ---------------------------------------------------------------------------

// Persisted across rerenders of the dev screen.
let devRound = 1;
let devGod = true;
let devUnlock = true;

export function devScreen(onLaunch: (opts: DevOptions) => void, onBack: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    'Dev Mode',
    'God abilities and level select — for testing only',
    null,
    'dev',
  );

  const roundValue = h('span', { className: 'count', text: `${devRound}` });
  const roundRow = h('div', { className: 'dev-row' }, [
    h('div', { className: 'dev-label' }, [icon('anchor'), h('span', { text: 'Jump to round' })]),
    h('div', { className: 'stepper' }, [
      h('button', {
        text: '−',
        onClick: () => {
          devRound = Math.max(1, devRound - 1);
          roundValue.textContent = `${devRound}`;
        },
      }),
      roundValue,
      h('button', {
        text: '+',
        onClick: () => {
          devRound = Math.min(30, devRound + 1);
          roundValue.textContent = `${devRound}`;
        },
      }),
    ]),
  ]);

  const toggle = (
    ic: IconName,
    label: string,
    desc: string,
    get: () => boolean,
    set: (v: boolean) => void,
  ): HTMLElement => {
    const btn = h('button', {
      className: get() ? 'dev-toggle on' : 'dev-toggle',
      text: get() ? 'ON' : 'OFF',
      onClick: () => {
        set(!get());
        btn.textContent = get() ? 'ON' : 'OFF';
        btn.className = get() ? 'dev-toggle on' : 'dev-toggle';
      },
    });
    return h('div', { className: 'dev-row' }, [
      h('div', { className: 'dev-label' }, [icon(ic), h('span', { text: label })]),
      h('div', { className: 'dev-desc hint', text: desc }),
      btn,
    ]);
  };

  body.append(
    h('div', { className: 'panel' }, [
      h('h2', { text: 'Test loadout' }),
      roundRow,
      toggle(
        'shield',
        'God mode',
        'Ships, escorts and batteries are invincible; interceptors, drones, PD rounds and aircraft are unlimited.',
        () => devGod,
        (v) => (devGod = v),
      ),
      toggle(
        'flask',
        'Unlock everything',
        'All research complete, ECM & scan installed, max batteries/escorts/capacity, and deep pockets.',
        () => devUnlock,
        (v) => (devUnlock = v),
      ),
    ]),
    h('div', {
      className: 'hint',
      text:
        'A dev run is a normal campaign with these cheats applied and the enemy fast-forwarded to your chosen round — so later rounds field the guided missiles, mines and low-signature mines you would meet there.',
    }),
  );

  footer.append(
    h('button', { text: 'Back', onClick: onBack }),
    h('button', {
      className: 'primary',
      text: 'Launch Dev Run',
      onClick: () => onLaunch({ round: devRound, god: devGod, unlockAll: devUnlock }),
    }),
  );
  return root;
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

const CATEGORY_ICONS: Record<CounterCategoryId, IconName> = {
  missileDefense: 'missile',
  mineWarfare: 'mine',
  torpedoWarfare: 'sonar',
  antiSurface: 'turret',
  counterArtillery: 'turret',
  concealment: 'eye',
  electronicDefense: 'jam',
  damageControl: 'shield',
  support: 'anchor',
};

const BRANCH_ICONS: Record<CounterBranchId, IconName> = {
  escortInterceptor: 'missile',
  baseInterceptor: 'turret',
  selfDefense: 'turret',
  missileWarning: 'alert',
  mineSonar: 'sonar',
  mcmDrones: 'drone',
  scanPulse: 'planeScan',
  hydrophone: 'sonar',
  depthCharges: 'mine',
  activeSonar: 'radar',
  deckGun: 'turret',
  antiBoarding: 'lock',
  counterBattery: 'turret',
  thermalImaging: 'eye',
  smokeScreen: 'jam',
  flak: 'turret',
  hardened: 'shield',
  ecm: 'planeEcm',
  reinforcedHull: 'shield',
  fireSuppression: 'flame',
  compartmentalization: 'slots',
  logistics: 'anchor',
};

const PLATFORM_LABELS: Record<PlatformKind, string> = {
  cargoModule: 'Cargo module',
  escort: 'Escort',
  shoreBase: 'Shore base',
  convoy: 'Convoy-wide',
};

const ROLE_LABELS: Record<CounterRole, string> = {
  detect: 'detects',
  attack: 'attacks',
  mitigate: 'mitigates',
  disrupt: 'disrupts',
  support: 'support',
};

/** What a tactic changes, so the player can tell automation from information
 *  from operating modes at a glance. */
const TACTIC_KIND_LABELS: Record<TacticKind, string> = {
  manual: 'Manual control',
  automation: 'Automation',
  info: 'Target information',
  coordination: 'Coordinated fire',
  mode: 'Operating mode',
};

type NodeState = 'done' | 'active' | 'ready' | 'known' | 'locked';

function researchNodeState(c: CampaignState, id: ResearchId): NodeState {
  const entry = RESEARCH_INDEX[id];
  if (!entry) return 'locked';
  if (hasResearch(c, id)) return 'done';
  if (c.activeResearch?.id === id) return 'active';
  if (entry.requires.some((r) => !hasResearch(c, r))) return 'locked';
  return canStartResearch(c, id).ok ? 'ready' : 'known';
}

/** Human summary of what a node's tier assignments / grants do (hardware
 *  performance vs targets vs ammo — distinct from tactic behavior). */
function nodeEffectSummary(def: CounterNodeDef): string {
  const parts: string[] = [];
  for (const s of def.set ?? []) {
    parts.push(`${s.stat} → ${s.tier.charAt(0).toUpperCase()}${s.tier.slice(1)}`);
  }
  for (const [k, v] of Object.entries(def.grant ?? {})) parts.push(`${k}: ${v}`);
  return parts.join(' · ');
}

function branchTagRow(c: CampaignState, branch: CounterBranchDef): HTMLElement {
  const tags = h('div', { className: 'chip-row branch-tags' }, [
    chip('anchor', PLATFORM_LABELS[branch.platform], 'Platform this branch belongs to'),
    chip('chevrons', ROLE_LABELS[branch.role], 'Whether it detects, attacks, mitigates or disrupts'),
  ]);
  for (const enemy of branch.counters) {
    tags.append(chip('alert', `vs ${ENEMY_BRANCH_NAMES[enemy]}`, branch.countersDetail));
  }
  if (branch.future) {
    tags.append(chip('eye', 'awaiting enemy capability', 'The countered enemy branch has not been fielded yet — research and equipment are ready for the day it appears.'));
  }
  // Equipment status: what physically carries this branch, and whether it is
  // installed — research alone never equips anything.
  const eq = branch.equipment;
  if (eq) {
    let fitted = false;
    let label = '';
    if (eq.kind === 'cargoModule') {
      fitted = Object.values(c.classModules).some((mods) => mods.includes(eq.id));
      label = `module: ${MODULES[eq.id].name}`;
    } else if (eq.kind === 'escortModule') {
      fitted = c.escortModules.includes(eq.id);
      label = `escort fit: ${ESCORT_MODULES[eq.id].name}`;
    } else if (eq.kind === 'baseModule') {
      fitted = c.baseModules.includes(eq.id);
      label = `base fit: ${BASE_MODULES[eq.id].name}`;
    } else if (eq.kind === 'ability') {
      fitted =
        (eq.id === 'ecm' && c.ecmUnlocked) ||
        (eq.id === 'scan' && c.scanUnlocked) ||
        (eq.id === 'sonar' && c.sonarUnlocked) ||
        (eq.id === 'smoke' && c.smokeUnlocked) ||
        (eq.id === 'hardened' && c.hardenedUnlocked);
      label = 'convoy asset';
    } else {
      fitted = eq.id === 'escort' ? c.escorts > 0 : c.bases > 0;
      label = 'built-in launcher';
    }
    tags.append(chip(fitted ? 'check' : 'lock', fitted ? `${label} ✓` : `${label} — not fitted`,
      fitted ? 'Equipment installed' : 'Research is ready, but the hardware must be bought in Preparation'));
  }
  return tags;
}

/** One row of researchable entries (the branch's Nodes or its Tactics). */
function entryRow(
  c: CampaignState,
  label: string,
  entries: readonly CounterNodeDef[],
  chained: boolean,
  branchIcon: IconName,
  rerender: () => void,
): HTMLElement {
  const nodes = h('div', { className: 'tech-nodes' });
  entries.forEach((def, i) => {
    const state = researchNodeState(c, def.id);
    if (i > 0 && chained) {
      const prevDone = hasResearch(c, entries[i - 1].id);
      nodes.append(h('div', { className: prevDone ? 'tech-connector done' : 'tech-connector' }));
    } else if (i > 0) {
      nodes.append(h('div', { className: 'tech-gap' }));
    }
    const orbIcon =
      state === 'done' ? 'check' : state === 'active' ? 'flask' : state === 'locked' ? 'lock' : branchIcon;
    const costEl = def.granted
      ? h('div', { className: 'tech-cost done', text: 'built-in' })
      : state === 'done'
        ? h('div', { className: 'tech-cost done', text: 'deployed' })
        : state === 'active'
          ? h('div', { className: 'tech-cost active', text: 'in progress' })
          : h('div', { className: 'tech-cost' }, [icon('intel'), h('span', { text: `${def.cost}` })]);
    nodes.append(
      clickable(h(
        'div',
        {
          className: `tech-node ${state}${selectedResearch === def.id ? ' selected' : ''}`,
          onClick: () => {
            selectedResearch = selectedResearch === def.id ? null : def.id;
            revealResearchDetail = selectedResearch !== null;
            rerender();
          },
        },
        [
          h('div', { className: 'orb' }, [icon(orbIcon)]),
          h('div', { className: 'tech-name', text: def.name }),
          costEl,
        ],
      )),
    );
  });
  return h('div', { className: 'tech-row' }, [
    h('div', { className: 'tech-row-label', text: label }),
    nodes,
  ]);
}

export function researchScreen(
  c: CampaignState,
  onContinue: () => void,
  rerender: () => void,
  onQuit: () => void,
): HTMLElement {
  const { root, body, footer } = screenShell(
    'Intelligence & Research',
    'One project at a time; results arrive after the next transit',
    c,
    'research',
  );

  if (c.activeResearch && RESEARCH_INDEX[c.activeResearch.id]) {
    const entry = RESEARCH_INDEX[c.activeResearch.id];
    body.append(
      h('div', { className: 'card research active-banner' }, [
        h('div', { className: 'card-head' }, [
          icon('flask', 'spin-slow'),
          h('h3', { text: `In progress: ${entry.def.name} (${entry.branch.name})` }),
        ]),
        h('p', { text: 'The lab will deliver after the next transit. Choose wisely what the convoy must survive until then.' }),
        h('div', { className: 'bar stripes' }, [h('div', { className: 'fill accent', attrs: { style: 'width:60%' } })]),
      ]),
    );
  }

  // --- The catalogue: Category → Branch → Nodes / Tactics ---------------------
  const tree = h('div', { className: 'tech-tree' });
  const branchEls: Partial<Record<CounterBranchId, HTMLElement>> = {};
  for (const category of CATEGORY_ORDER) {
    const branches = Object.values(COUNTER_BRANCHES).filter((b) => b.category === category);
    if (branches.length === 0) continue;
    tree.append(
      h('div', { className: 'tech-category-label' }, [
        icon(CATEGORY_ICONS[category]),
        h('span', { text: COUNTER_CATEGORY_NAMES[category] }),
      ]),
    );
    for (const branch of branches) {
      const rows: HTMLElement[] = [
        h('div', { className: 'branch-head' }, [
          icon(BRANCH_ICONS[branch.id]),
          h('span', { className: 'branch-name', text: branch.name }),
        ]),
        branchTagRow(c, branch),
        h('div', { className: 'hint', text: branch.short }),
        entryRow(c, 'Nodes', branch.nodes, true, BRANCH_ICONS[branch.id], rerender),
      ];
      if (branch.tactics.length > 0) {
        rows.push(
          entryRow(
            c,
            branch.tacticStyle === 'parallel' ? 'Tactics (parallel paths)' : 'Tactics',
            branch.tactics,
            branch.tacticStyle === 'ladder',
            BRANCH_ICONS[branch.id],
            rerender,
          ),
        );
      }
      const branchEl = h('div', { className: 'counter-branch' }, rows);
      branchEls[branch.id] = branchEl;
      tree.append(branchEl);
    }
  }
  body.append(tree);

  // --- Detail panel for the selected node ----------------------------------------
  const selectedEntry = selectedResearch ? RESEARCH_INDEX[selectedResearch] : undefined;
  if (selectedResearch && selectedEntry) {
    const id = selectedResearch;
    const def = selectedEntry.def;
    const branch = selectedEntry.branch;
    const state = researchNodeState(c, id);
    const check = canStartResearch(c, id);
    const shouldReveal = revealResearchDetail;
    revealResearchDetail = false;
    let status: string;
    switch (state) {
      case 'done':
        status = def.granted
          ? 'Built-in — active whenever the branch is equipped.'
          : 'Deployed — this capability is active on every equipped instance of the branch.';
        break;
      case 'active':
        status = 'In progress — the lab delivers after the next transit.';
        break;
      case 'locked': {
        const missing = selectedEntry.requires.filter((r) => !hasResearch(c, r));
        status = `Requires ${missing.map((m) => RESEARCH_INDEX[m]?.def.name ?? m).join(' + ')} first.`;
        break;
      }
      default:
        status = check.ok
          ? 'The lab is ready to begin immediately.'
          : check.reason === 'A project is already underway'
            ? 'The lab is already committed to another project this round.'
            : check.reason === 'Not enough intel'
              ? `Not enough intel — you have ${c.intel} of ${def.cost}.`
              : check.reason ?? '';
    }
    const infoBits: HTMLElement[] = [
      h('h3', { text: def.name }),
      h('div', {
        className: 'hint',
        text:
          `${branch.name} · ${PLATFORM_LABELS[branch.platform]} · ` +
          (selectedEntry.isTactic
            ? TACTIC_KIND_LABELS[(def as CounterTacticDef).kind]
            : 'Hardware node'),
      }),
      h('p', { text: def.desc }),
    ];
    const effectText = nodeEffectSummary(def);
    if (effectText) {
      infoBits.push(h('div', { className: 'hint', text: `Sets: ${effectText}` }));
    }
    infoBits.push(h('div', { className: 'hint status', text: status }));
    const detail =
      h('div', { className: `tech-detail ${state}` }, [
        h('div', { className: 'tech-detail-orb' }, [icon(BRANCH_ICONS[branch.id])]),
        h('div', { className: 'tech-detail-info' }, infoBits),
        h('div', { className: 'tech-detail-action' }, [
          def.granted ? chip('check', 'built-in') : chip('intel', `${def.cost} intel`, 'Project cost'),
          h('button', {
            className: 'primary',
            text:
              state === 'done'
                ? def.granted ? 'Built-in ✓' : 'Deployed ✓'
                : state === 'active'
                  ? 'In progress…'
                  : 'Begin research',
            disabled: !check.ok,
            onClick: () => {
              if (startResearch(c, id)) rerender();
            },
          }),
        ]),
      ]);
    // Open the dossier inline, right under the branch the node lives in — no
    // scrolling to the bottom of the screen to read or buy it.
    const host = branchEls[branch.id];
    if (host) host.after(detail);
    else body.append(detail);
    if (shouldReveal) {
      // Double-rAF: game.ts restores the old scrollTop right after the swap,
      // and this scroll must land after that restoration.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' })),
      );
    }
  } else {
    tree.append(
      h('div', { className: 'tech-detail empty hint', text: 'Select a project above to review its dossier.' }),
    );
  }

  footer.append(
    h('button', {
      className: 'ghost',
      text: '☰ Save & Quit',
      attrs: { style: 'margin-right:auto' },
      onClick: onQuit,
    }),
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
  selfDefense: 'turret',
  missileWarning: 'alert',
  reinforcedHull: 'shield',
  mineSonar: 'sonar',
  fireSuppression: 'flame',
  hydrophone: 'sonar',
  thermalImaging: 'eye',
  flak: 'turret',
  antiBoarding: 'lock',
  compartmentalization: 'slots',
};

/** The counter branch a piece of equipment belongs to (for the platform /
 *  counters / role line on its card). */
function branchForEquipment(kind: 'cargoModule' | 'escortModule' | 'baseModule', id: string) {
  return Object.values(COUNTER_BRANCHES).find(
    (b) => b.equipment?.kind === kind && b.equipment.id === id,
  );
}

/** One-line "what this equipment is for": role + countered enemy branches. */
function equipmentRoleLine(kind: 'cargoModule' | 'escortModule' | 'baseModule', id: string): string {
  const branch = branchForEquipment(kind, id);
  if (!branch) return '';
  const vs = branch.counters.map((e) => ENEMY_BRANCH_NAMES[e]).join(', ');
  const role = ROLE_LABELS[branch.role];
  return vs ? `${role} · vs ${vs}` : `${role} · all damage`;
}

export function prepScreen(
  c: CampaignState,
  onLaunch: () => void,
  rerender: () => void,
  onQuit: () => void,
): HTMLElement {
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
            chip('coin', `$${def.value * ECONOMY.cashPerValue}`, 'Cash earned when this ship is delivered'),
            chip('crate', `${def.value} pts`, 'Points toward the delivery quota when this ship is delivered'),
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
    const block = moduleBlockReason(c, activeClass, moduleId);
    const refund = c.modulePaid[activeClass]?.[moduleId] ?? cost;
    const roleLine = equipmentRoleLine('cargoModule', moduleId);
    let buyLabel: string;
    if (block === null) buyLabel = `Equip class — $${cost}`;
    else if (block === 'Not enough cash') buyLabel = `Need $${cost}`;
    else if (block.startsWith('Requires research')) buyLabel = block;
    else if (block === 'No module slots free on this class') buyLabel = 'No slots free';
    else buyLabel = block;
    modGrid.append(
      h('div', { className: isOwned ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon(MODULE_ICONS[moduleId]),
          h('h3', { text: mod.name }),
          isOwned ? h('span', { className: 'badge good', text: 'Equipped' }) : h('span'),
        ]),
        roleLine ? h('div', { className: 'hint role-line', text: roleLine }) : h('span'),
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
              text: buyLabel,
              disabled: block !== null,
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
        'Modules unlock through research first, then compete for the class’s limited slots — no hull can carry every counter. ' +
        'Unequip to swap loadouts freely (you get the fitting cost back), and note a fitted module raises the price of buying a new hull of that class.',
    }),
  );

  // --- Escort loadout: optional systems competing for limited escort slots ----
  const escortPanel = h('div', { className: 'panel' }, [
    h('h2', { text: `Escort loadout — ${c.escortModules.length}/${ESCORT_MODULE_SLOTS} slots` }),
    h('div', {
      className: 'hint',
      text:
        'Missile interceptors are built into every escort. These optional systems fit the whole escort group and compete for its limited slots — deck guns, drone launchers and depth charges cannot all sail at once.' +
        (c.escorts === 0 ? ' You own no escorts yet — fit systems now and they apply to every escort you hire.' : ''),
    }),
  ]);
  const escortGrid = h('div', { className: 'module-grid' });
  for (const id of Object.keys(ESCORT_MODULES) as (keyof typeof ESCORT_MODULES)[]) {
    const def = ESCORT_MODULES[id];
    const fitted = c.escortModules.includes(id);
    const block = escortModuleBlockReason(c, id);
    const refund = c.escortModulePaid[id] ?? def.cost;
    const branch = branchForEquipment('escortModule', id);
    escortGrid.append(
      h('div', { className: fitted ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon(branch ? BRANCH_ICONS[branch.id] : 'turret'),
          h('h3', { text: def.name }),
          fitted ? h('span', { className: 'badge good', text: 'Fitted' }) : h('span'),
        ]),
        h('div', { className: 'hint role-line', text: equipmentRoleLine('escortModule', id) }),
        h('p', { text: def.desc }),
        fitted
          ? h('button', {
              className: 'unequip',
              text: `Remove — refund $${refund}`,
              onClick: () => {
                if (removeEscortModule(c, id)) rerender();
              },
            })
          : h('button', {
              text: block === null ? `Fit escorts — $${def.cost}` : block,
              disabled: block !== null,
              onClick: () => {
                if (buyEscortModule(c, id)) rerender();
              },
            }),
      ]),
    );
  }
  escortPanel.append(escortGrid);

  // --- Shore-base loadout ------------------------------------------------------
  const basePanel = h('div', { className: 'panel' }, [
    h('h2', { text: `Shore-base loadout — ${c.baseModules.length}/${BASE_MODULE_SLOTS} slot` }),
    h('div', {
      className: 'hint',
      text: 'Missile interceptors are built into every battery. Optional strategic systems compete for the base network’s limited slots.',
    }),
  ]);
  const baseGrid = h('div', { className: 'module-grid' });
  for (const id of Object.keys(BASE_MODULES) as (keyof typeof BASE_MODULES)[]) {
    const def = BASE_MODULES[id];
    const fitted = c.baseModules.includes(id);
    const block = baseModuleBlockReason(c, id);
    const refund = c.baseModulePaid[id] ?? def.cost;
    baseGrid.append(
      h('div', { className: fitted ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon('turret'),
          h('h3', { text: def.name }),
          fitted ? h('span', { className: 'badge good', text: 'Fitted' }) : h('span'),
        ]),
        h('div', { className: 'hint role-line', text: equipmentRoleLine('baseModule', id) }),
        h('p', { text: def.desc }),
        fitted
          ? h('button', {
              className: 'unequip',
              text: `Remove — refund $${refund}`,
              onClick: () => {
                if (removeBaseModule(c, id)) rerender();
              },
            })
          : h('button', {
              text: block === null ? `Fit bases — $${def.cost}` : block,
              disabled: block !== null,
              onClick: () => {
                if (buyBaseModule(c, id)) rerender();
              },
            }),
      ]),
    );
  }
  basePanel.append(baseGrid);

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
      'Hardened launcher on the friendly shore. Unlimited range with slow reload — it fires the FAST interceptor type, which climbs the speed tiers with Shore-Base Interceptor research. Can be struck, knocked offline and destroyed.',
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
      'Mobile launcher that sails with the convoy: quick reload but slower interceptors and limited range. Carries whatever the Escort Loadout fits (drone launcher, deck gun, depth charges). Tap it in transit to order it around the map.',
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
      'planeEcm',
      'ECM aircraft',
      c.ecmUnlocked ? 'owned' : '—',
      'Call it onto any patch of open water: it orbits there scrambling GUIDED seekers, and a guided missile that lingers inside cooks off. It never touches mines, torpedoes, boats, artillery, smoke or jamming — research its parallel paths for more charges, radius or duration.',
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
      c.scanUnlocked ? 'owned' : '—',
      'Pick a lane and the aircraft sweeps its full length, charting the mines in THAT lane only (low-signature mines need Composite Scan Processing). Ships always steer around charted mines — and your escorts can send drones to clear them.',
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

  // Active sonar: purchasable once its base node is researched.
  if (hasResearch(c, 'activeSonar.base') || c.sonarUnlocked) {
    assetGrid.append(
      assetCard(
        'radar',
        'Active sonar ping',
        c.sonarUnlocked ? 'owned' : '—',
        'Placed, charge-based ping that actively reveals torpedoes in the chosen area — the underwater domain only. Detection, not destruction: depth charges do the killing.',
        c.sonarUnlocked
          ? null
          : {
              label: `Commission — $${ECONOMY.sonarUnlockCost}`,
              disabled: c.cash < ECONOMY.sonarUnlockCost,
              onClick: () => {
                if (unlockSonar(c)) rerender();
              },
            },
      ),
    );
  }
  // Defensive smoke: purchasable once its base node is researched.
  if (hasResearch(c, 'smokeScreen.base') || c.smokeUnlocked) {
    assetGrid.append(
      assetCard(
        'jam',
        'Defensive smoke screen',
        c.smokeUnlocked ? 'owned' : '—',
        'Placed cloud that degrades the enemy’s targeting doctrine for ships inside — the finish-the-wounded / high-value preference falls back a tier. It destroys nothing and never makes a ship invulnerable.',
        c.smokeUnlocked
          ? null
          : {
              label: `Commission — $${ECONOMY.smokeUnlockCost}`,
              disabled: c.cash < ECONOMY.smokeUnlockCost,
              onClick: () => {
                if (unlockSmoke(c)) rerender();
              },
            },
      ),
    );
  }
  // Hardened systems: the sanctioned work-around for un-shootable jamming.
  if (hasResearch(c, 'hardened.base') || c.hardenedUnlocked) {
    assetGrid.append(
      assetCard(
        'shield',
        'Hardened & backup systems',
        c.hardenedUnlocked ? 'owned' : '—',
        'Enemy sensor jamming cannot be shot down — this shortens its blackouts (emergency reboot) and keeps chosen sensor families partially alive through them.',
        c.hardenedUnlocked
          ? null
          : {
              label: `Commission — $${ECONOMY.hardenedUnlockCost}`,
              disabled: c.cash < ECONOMY.hardenedUnlockCost,
              onClick: () => {
                if (unlockHardened(c)) rerender();
              },
            },
      ),
    );
  }

  // Drone munitions only appear once the minesweeper branch is researched
  // (nothing to buy them for otherwise).
  if (hasResearch(c, 'mcmDrones.base')) {
    assetGrid.append(
      assetCard(
        'drone',
        'Drone munitions',
        `${c.droneAmmo}`,
        'One munition per sweep. In transit, TAP a charted mine to send a drone from the nearest escort with a drone launcher fitted. No launcher, no sweeps; no stock, no sweeps.',
        {
          label: `Buy ${ECONOMY.droneAmmoPerBuy} — $${ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy}`,
          disabled: c.cash < ECONOMY.droneAmmoCost * ECONOMY.droneAmmoPerBuy,
          onClick: () => {
            if (buyDroneAmmo(c)) rerender();
          },
        },
      ),
    );
  }

  // Self-defense rounds only appear once the module is actually fitted on a class.
  const hasSelfDefense = Object.values(c.classModules).some((mods) => mods.includes('selfDefense'));
  if (hasSelfDefense) {
    assetGrid.append(
      assetCard(
        'turret',
        'Self-defense rounds',
        `${c.pdAmmo}`,
        'Ammunition for the Self-Defense Interceptor module. Every shot draws from this shared stock (per-round magazine per ship) — a fitted module does nothing without rounds. Stock carries over.',
        {
          label: `Buy ${ECONOMY.pdAmmoPerBuy} — $${ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy}`,
          disabled: c.cash < ECONOMY.pdAmmoCost * ECONOMY.pdAmmoPerBuy,
          onClick: () => {
            if (buyPdAmmo(c)) rerender();
          },
        },
      ),
    );
  }

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

  // --- Protected-channel selection (hardened systems, pre-round choice) -------
  if (c.hardenedUnlocked && hasResearch(c, 'hardened.protectedChannel')) {
    const capacity = hasResearch(c, 'hardened.dualChannel') ? 2 : 1;
    const families: { id: SensorFamily; label: string }[] = [
      { id: 'mineDetection', label: 'Mine detection' },
      { id: 'torpedoDetection', label: 'Torpedo detection' },
      { id: 'missileWarning', label: 'Missile warning' },
      { id: 'smokeImaging', label: 'Smoke-penetrating imaging' },
    ];
    const row = h('div', { className: 'chip-row' });
    for (const fam of families) {
      const selected = c.protectedChannels.includes(fam.id);
      const btn = h('button', {
        className: selected ? 'tab selected' : 'tab',
        text: selected ? `${fam.label} ✓` : fam.label,
        onClick: () => {
          const next = selected
            ? c.protectedChannels.filter((f) => f !== fam.id)
            : [...c.protectedChannels, fam.id].slice(-capacity);
          if (setProtectedChannels(c, next)) rerender();
        },
      });
      row.append(btn);
    }
    assetPanel.append(
      h('div', { className: 'hint', text: `Protected detection channel${capacity > 1 ? 's' : ''} — choose which sensor famil${capacity > 1 ? 'ies stay' : 'y stays'} partially functional if the enemy jams your sensors this round (${c.protectedChannels.length}/${capacity} chosen):` }),
      row,
    );
  }

  body.append(
    h('div', { className: 'grid-2' }, [compPanel, formPanel]),
    modPanel,
    escortPanel,
    basePanel,
    assetPanel,
  );

  const canLaunch = totalComposition(c) > 0;
  footer.append(
    h('button', {
      className: 'ghost',
      text: '☰ Save & Quit',
      attrs: { style: 'margin-right:auto' },
      onClick: onQuit,
    }),
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
