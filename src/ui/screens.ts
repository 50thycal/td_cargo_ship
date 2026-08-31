// Phase screens: menu, region select, commander loadout, after-action report,
// technology draft, procurement, run over. Pure DOM construction — every
// mutation goes through the campaign/commander helpers so nothing here can
// put the game into an invalid state.
//
// Presentation notes: screens are built from a shared card/chip/icon design
// system (see icons.ts + style.css). Entry animations only replay when the
// player NAVIGATES to a screen — a purchase rerender rebuilds the DOM with the
// same screen id and must not re-trigger the stagger, so `entering()` tracks
// the last screen id at module scope.

import { CAMPAIGN, COMMANDER, DRAFT, ECONOMY, ESCORT_LEGACY } from '../data/tuning';
import type { StatTier } from '../data/statTiers';
import {
  BASE_MODULES,
  BASE_MODULE_SLOTS,
  ESCORT_MODULES,
  ESCORT_NAME_MAX,
  FORMATIONS,
  MODULES,
  SHIP_CLASSES,
} from '../data/defs';
import {
  COUNTER_BRANCHES,
  resolveBranchStats,
  awaitingEnemyCapability,
  ENEMY_BRANCH_NAMES,
  RESEARCH_INDEX,
  type CounterBranchDef,
  type CounterNodeDef,
  type CounterRole,
  type CounterTacticDef,
  type PlatformKind,
  type TacticKind,
} from '../data/counters';
import {
  ammoUnitCost,
  baseModuleBlockReason,
  baseModuleRevealed,
  buyAmmo,
  buyBase,
  equipBaseModule,
  buyDroneAmmo,
  buyEscort,
  equipEscortModule,
  equipModule,
  buyPdAmmo,
  buyShip,
  type DevOptions,
  escortModuleBlockReason,
  escortModuleRevealed,
  hasResearch,
  moduleBlockReason,
  moduleRevealed,
  researchSet,
  moduleSpare,
  moduleStock,
  moduleStockCap,
  classSlots,
  removeBaseModule,
  removeEscortModule,
  removeModule,
  repairCost,
  repairFleet,
  repairPartial,
  repairPartialQuote,
  scopeDamage,
  setComposition,
  setFormation,
  shipCost,
  totalComposition,
  totalPendingDamage,
  warthogCapacity,
  warthogSortieBlockReason,
  buyWarthogSortie,
  scanCapacity,
  scanPulseBlockReason,
  gunShellsBlockReason,
  buyGunShells,
  buyScanPulse,
  escortSlots,
  renameEscort,
  rerollBlockReason,
  rerollDraft,
  confidenceCeiling,
} from '../sim/campaign';
import {
  draftOptionBranch,
  draftOptionInfo,
  draftOptionKey,
  selectDraftOption,
  dismissEmptyDraft,
} from '../sim/draft';
import {
  loadoutBlockReason,
  setLoadout,
  unlockAbility,
  unlockBlockReason,
  legacyLoadoutBlockReason,
  legacyUnlockBlockReason,
  setLegacyLoadout,
  unlockLegacy,
  regionUnlocked,
  setDevMode,
  type CommanderProfile,
  type RunSettlement,
} from '../sim/commander';
import {
  COMMANDER_ABILITIES,
  COMMANDER_ABILITY_ORDER,
  loadoutPointsUsed,
} from '../data/commanderAbilities';
import { escortHull } from '../data/escortHulls';
import {
  ESCORT_LEGACIES,
  ESCORT_LEGACY_ORDER,
  legacyPointsUsed,
} from '../data/escortLegacies';
import { REGIONS, REGION_ORDER, regionDef, type RegionId } from '../data/regions';
import { ENEMY_BRANCHES } from '../data/enemyBranches';
import { formatInterceptSummary } from '../sim/aar';
import { downloadGameLog } from './download';
import {
  formationFigure,
  icon,
  shipFigure,
  escortHullFigure,
  SHIP_TINTS,
  statTierRow,
  statUpgradeRow,
  type IconName,
  BRANCH_ICONS,
  MODULE_ICONS,
} from './icons';
import type {
  AarCard,
  AarCardKind,
  AfterActionReport,
  CampaignState,
  DraftOption,
  DraftOptionKind,
  FormationId,
  ModuleId,
  ModulePlatform,
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
  if (fresh && screenId === 'prep') {
    prepSection = 'convoy';
    prepModuleTab = 'cargo';
    prepEscortId = null;
  }
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

/** Prep-screen sections — one console page per concern, switched by the rail
 *  keys, so the player never scrolls through the whole shop at once. */
type PrepSectionId = 'convoy' | 'modules' | 'fleet' | 'assets';
let prepSection: PrepSectionId = 'convoy';

/** Which ship class's module loadout is open in the prep screen (persists
 *  across purchase rerenders so the tab doesn't jump). */
let prepModuleTab: ShipClassId = 'cargo';

/** Which escort is open in the flotilla panel. Held by unit id rather than
 *  index so it survives a sinking — if the selected escort is gone, the panel
 *  falls back to the first one rather than silently editing a different ship. */
let prepEscortId: number | null = null;

function resourceBar(c: CampaignState): HTMLElement {
  // The ceiling rides on the confidence chip: the bar reads "82/91" once the
  // run's record has cost it headroom, so the cap is visible where the number
  // is rather than only on the debrief.
  const ceiling = Math.round(confidenceCeiling(c));
  const capped = ceiling < CAMPAIGN.maxConfidence;
  return h('div', { className: 'resource-bar' }, [
    h('span', { className: 'res-chip cash' }, [icon('coin'), h('span', { text: `$${c.cash}` })]),
    h(
      'span',
      {
        className: 'res-chip conf',
        attrs: {
          title: capped
            ? `Confidence — the run ends if it reaches zero. Capped at ${ceiling}: ` +
              `${c.record?.lost ?? 0} of ${c.record?.launched ?? 0} hulls lost and ` +
              `${c.crewRescue?.lost ?? 0} crews left in the water. A full bar means a clean record.`
            : 'Confidence — the run ends if it reaches zero',
        },
      },
      [icon('star'), h('span', { text: capped ? `${c.confidence}/${ceiling}` : `${c.confidence}` })],
    ),
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
    h('span', { className: 'hdr-trim', attrs: { 'aria-hidden': 'true' } }, [
      h('span', { className: 'knob' }),
      h('span', { className: 'knob' }),
    ]),
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

/** A progress bar carrying a second, lighter segment stacked on the first: what
 *  is already banked, and what the convoy currently assigned would add on top
 *  of it. Both are fractions of the same total, and the projection is drawn
 *  from where the earned segment ends. */
function projectionBar(
  earnedFraction: number,
  projectedFraction: number,
  tone: '' | 'good' | 'warn' | 'bad' = '',
): HTMLElement {
  const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
  const earned = clamp01(earnedFraction);
  // The projection can only fill what is left of the bar, however big the
  // convoy is — overshooting the quota should read as "clears it", not as a
  // segment hanging off the end.
  const projected = Math.min(clamp01(projectedFraction), 1 - earned);
  const fill = h('div', { className: `fill ${tone}`.trim() });
  const proj = h('div', { className: 'fill projected' });
  const bar = h('div', { className: 'bar' }, [fill, proj]);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fill.style.width = `${earned * 100}%`;
    proj.style.left = `${earned * 100}%`;
    proj.style.width = `${projected * 100}%`;
  }));
  return bar;
}

/** Cargo points the currently assigned convoy is worth if every hull arrives.
 *  This is the same arithmetic resolveTransit does — value delivered IS quota
 *  progress — so the bar cannot drift from what the round will actually pay. */
function projectedQuotaPoints(c: CampaignState): number {
  return (Object.keys(SHIP_CLASSES) as ShipClassId[]).reduce(
    (sum, id) => sum + c.composition[id] * SHIP_CLASSES[id].value,
    0,
  );
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
    return { met: true, text: 'Cleared — a larger quota follows next round.' };
  }
  const need = q.pointsNeeded - q.pointsEarned;
  return {
    met: false,
    text: `Deliver ${need} more cargo point(s) in ${q.roundsLeft} round(s).`,
  };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<CampaignState['phase'], string> = {
  prep: 'Preparation',
  transit: 'Transit',
  aar: 'After-Action',
  draft: 'Technology Draft',
};

export function menuScreen(opts: {
  profile: CommanderProfile;
  saved: CampaignState | null;
  onNewRun: () => void;
  onContinue: () => void;
  devAvailable: boolean;
  onDev: () => void;
  onSettings: () => void;
}): HTMLElement {
  entering('menu');
  const { saved, profile } = opts;
  const savedRegion = saved ? regionDef(saved.regionId) : null;
  const continueLabel = saved
    ? saved.campaignOver
      ? 'View Final Report'
      : `Continue Run — ${savedRegion?.name ?? 'Region'}, Round ${saved.round}`
    : 'Continue Run';
  const buttons = h('div', { className: 'buttons' }, [
    h('button', { className: 'primary', text: 'Begin Regional Run', onClick: opts.onNewRun }),
    h('button', { text: continueLabel, disabled: !saved, onClick: opts.onContinue }),
    h('button', { text: 'Settings', onClick: opts.onSettings }),
  ]);
  const regionsCleared = REGION_ORDER.filter((id) => (profile.records[id]?.completions ?? 0) > 0).length;
  const children: HTMLElement[] = [
    h('div', { className: 'menu-emblem' }, [icon('anchor')]),
    h('h1', { text: 'Straitwatch' }),
    h('div', { className: 'boot-line', text: 'convoy defense command // online' }),
    h('div', {
      className: 'tagline',
      text:
        'Shepherd convoys through hostile straits. Salvage the enemy’s weapons ' +
        'and draft their technology into your fleet.',
    }),
    buttons,
    h('div', { className: 'menu-save-note hint' }, [
      icon('star'),
      h('span', {
        text:
          ` XP ${profile.xp}` +
          ` · Regions ${profile.unlockedRegions.filter((r) => REGION_ORDER.includes(r)).length}/${REGION_ORDER.length}` +
          ` · Secured ${regionsCleared}`,
      }),
    ]),
  ];
  if (saved && !saved.campaignOver) {
    children.push(
      h('div', {
        className: 'menu-save-note hint',
        text:
          `Auto-saved at Round ${saved.round} (${PHASE_LABELS[saved.phase]}). ` +
          'A new run abandons it — Commander progress is never lost.',
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
// Region select — the roguelite campaign map
// ---------------------------------------------------------------------------

export function regionSelectScreen(
  profile: CommanderProfile,
  onPick: (regionId: RegionId) => void,
  onBack: () => void,
): HTMLElement {
  const { root, body, footer } = screenShell(
    'Region Select',
    'Each region is an independent run',
    null,
    'regionSelect',
  );

  if (profile.allRegionsUnlocked) {
    body.append(
      h('div', {
        className: 'hint',
        text: 'Dev: all regions unlocked. Turn it off in Dev Mode to go back to the earned ladder.',
      }),
    );
  }

  for (const id of REGION_ORDER) {
    const region = REGIONS[id];
    const unlocked = regionUnlocked(profile, id);
    // A region opened by the dev flag rather than earned still says so, so a
    // test run is never mistaken for progress.
    const earned = profile.unlockedRegions.includes(id);
    const rec = profile.records[id];
    const threatNames = region.enemyBranches
      .filter((k) => ENEMY_BRANCHES[k].implemented)
      .map((k) => ENEMY_BRANCH_NAMES[k])
      .join(', ');
    const tags = h('div', { className: 'chip-row' }, [
      chip('alert', threatNames || 'No threats', 'Enemy branches this region can field'),
      chip(
        'anchor',
        `Secure R${region.completionRound}`,
        'Reach this round with every delivery quota honoured to complete the region — an open quota window plays out first',
      ),
      chip('star', `+${region.completionXp} XP`),
    ]);
    if (rec && rec.attempts > 0) {
      tags.append(
        chip('check', `Best R${rec.bestRound} · won ${rec.completions}/${rec.attempts}`),
      );
    }
    const card = h('div', { className: unlocked ? 'card' : 'card locked' }, [
      h('div', { className: 'card-head' }, [
        icon(unlocked ? 'radar' : 'lock'),
        h('h3', { text: region.name }),
      ]),
      h('div', {
        className: 'hint',
        text: unlocked
          ? `${region.tagline}${unlocked && !earned ? ' · unlocked for testing' : ''}`
          : 'Complete the previous region to unlock.',
      }),
      tags,
      h('button', {
        className: 'primary',
        text: unlocked ? `Deploy to ${region.name}` : 'Locked',
        disabled: !unlocked,
        onClick: () => onPick(id),
      }),
    ]);
    body.append(card);
  }

  footer.append(h('button', { text: 'Back', onClick: onBack }));
  return root;
}

// ---------------------------------------------------------------------------
// Pre-run loadout — Commander Abilities and Escort Legacies
// ---------------------------------------------------------------------------
// Two banks off one XP pool. The cards are built by the same renderer because
// the player is doing the same thing on both: spend XP to unlock, then fit
// what fits. The difference is in what a slot MEANS — an ability is the
// commander's and simply on for the run; a legacy belongs to a hull and dies
// with her — so the copy has to carry it even though the widget cannot.

/** Which bank is open. Held across rerenders so unlocking something does not
 *  bounce the player back to the other page. */
let loadoutTab: 'commander' | 'flotilla' = 'commander';

/** One unlock/equip card, shared by both banks. */
function progressionCard(opts: {
  name: string;
  desc: string;
  points: number;
  xpCost: number;
  unlocked: boolean;
  equipped: boolean;
  /** null = the toggle is allowed; a string = why it is not. */
  equipBlock: string | null;
  unlockBlock: string | null;
  onToggle: () => void;
  onUnlock: () => void;
}): HTMLElement {
  const rows: HTMLElement[] = [
    h('div', { className: 'card-head' }, [
      icon(opts.unlocked ? (opts.equipped ? 'check' : 'star') : 'lock'),
      h('h3', { text: opts.name }),
    ]),
    h('p', { text: opts.desc }),
    h('div', { className: 'chip-row' }, [
      chip('coin', `${opts.points} points`, 'Loadout points this consumes'),
      ...(opts.unlocked ? [] : [chip('intel', `${opts.xpCost} XP to unlock`)]),
    ]),
  ];
  if (opts.unlocked) {
    rows.push(
      h('button', {
        className: opts.equipped ? '' : 'primary',
        text: opts.equipped ? 'Unequip' : (opts.equipBlock ?? 'Equip'),
        disabled: !opts.equipped && opts.equipBlock !== null,
        onClick: opts.onToggle,
      }),
    );
  } else {
    rows.push(
      h('button', {
        className: 'primary',
        text: opts.unlockBlock === null ? `Unlock — ${opts.xpCost} XP` : opts.unlockBlock,
        disabled: opts.unlockBlock !== null,
        onClick: opts.onUnlock,
      }),
    );
  }
  return h('div', { className: opts.unlocked ? 'card' : 'card locked' }, rows);
}

export function loadoutScreen(
  profile: CommanderProfile,
  regionId: RegionId,
  onStart: () => void,
  rerender: () => void,
  onBack: () => void,
): HTMLElement {
  const region = regionDef(regionId);
  const legacyLoadout = profile.legacyLoadout ?? [];
  const unlockedLegacies = profile.unlockedLegacies ?? [];
  const onCommander = loadoutTab === 'commander';
  const { root, body, footer } = screenShell(
    'Pre-Run Loadout',
    onCommander
      ? `${region.name} — ${COMMANDER.abilitySlots} slots · ${COMMANDER.loadoutPoints} pts`
      : `${region.name} — ${ESCORT_LEGACY.slots} berths · ${ESCORT_LEGACY.loadoutPoints} pts`,
    null,
    'loadout',
  );

  const tabs = h('div', { className: 'tabs' });
  const tabButton = (id: 'commander' | 'flotilla', label: string, sub: string): HTMLElement =>
    h(
      'button',
      {
        className: loadoutTab === id ? 'tab selected' : 'tab',
        onClick: () => {
          loadoutTab = id;
          rerender();
        },
      },
      [
        icon(id === 'commander' ? 'star' : 'shield'),
        h('span', { className: 'tab-label' }, [
          h('strong', { text: label }),
          h('span', { className: 'muted', text: sub }),
        ]),
      ],
    );
  tabs.append(
    tabButton('commander', 'Commander', `${profile.loadout.length}/${COMMANDER.abilitySlots}`),
    tabButton('flotilla', 'Flotilla', `${legacyLoadout.length}/${ESCORT_LEGACY.slots}`),
  );
  body.append(tabs);

  if (onCommander) {
    const used = loadoutPointsUsed(profile.loadout);
    body.append(
      h('div', { className: 'card' }, [
        h('div', { className: 'card-head' }, [icon('star'), h('h3', { text: 'Commander' })]),
        h('div', { className: 'chip-row' }, [
          chip('intel', `${profile.xp} XP`, 'Commander XP unlocks abilities and legacies'),
          chip('slots', `${profile.loadout.length}/${COMMANDER.abilitySlots} slots`),
          chip('coin', `${used}/${COMMANDER.loadoutPoints} pts`),
        ]),
        h('div', {
          className: 'hint',
          text: 'Unlocks are permanent. The equipped loadout locks when the run starts.',
        }),
      ]),
    );

    for (const id of COMMANDER_ABILITY_ORDER) {
      const def = COMMANDER_ABILITIES[id];
      const equipped = profile.loadout.includes(id);
      const next = equipped ? profile.loadout.filter((a) => a !== id) : [...profile.loadout, id];
      body.append(
        progressionCard({
          name: def.name,
          desc: def.desc,
          points: def.points,
          xpCost: def.xpCost,
          unlocked: profile.unlockedAbilities.includes(id),
          equipped,
          equipBlock: equipped ? null : loadoutBlockReason(profile, next),
          unlockBlock: unlockBlockReason(profile, id),
          onToggle: () => {
            if (setLoadout(profile, next)) rerender();
          },
          onUnlock: () => {
            if (unlockAbility(profile, id)) rerender();
          },
        }),
      );
    }
  } else {
    const used = legacyPointsUsed(legacyLoadout);
    body.append(
      h('div', { className: 'card' }, [
        h('div', { className: 'card-head' }, [icon('shield'), h('h3', { text: 'Flotilla' })]),
        h('div', { className: 'chip-row' }, [
          chip('intel', `${profile.xp} XP`, 'Commander XP unlocks abilities and legacies'),
          chip('slots', `${legacyLoadout.length}/${ESCORT_LEGACY.slots} berths`),
          chip('coin', `${used}/${ESCORT_LEGACY.loadoutPoints} pts`),
        ]),
        h('div', {
          className: 'hint',
          text: 'One legacy per escort, handed out as hulls are commissioned. A legacy goes down with its ship for the rest of the region — a replacement hull does not bring it back.',
        }),
      ]),
    );

    for (const id of ESCORT_LEGACY_ORDER) {
      const def = ESCORT_LEGACIES[id];
      const equipped = legacyLoadout.includes(id);
      const next = equipped ? legacyLoadout.filter((a) => a !== id) : [...legacyLoadout, id];
      body.append(
        progressionCard({
          name: def.name,
          desc: def.desc,
          points: def.points,
          xpCost: def.xpCost,
          unlocked: unlockedLegacies.includes(id),
          equipped,
          equipBlock: equipped ? null : legacyLoadoutBlockReason(profile, next),
          unlockBlock: legacyUnlockBlockReason(profile, id),
          onToggle: () => {
            if (setLegacyLoadout(profile, next)) rerender();
          },
          onUnlock: () => {
            if (unlockLegacy(profile, id)) rerender();
          },
        }),
      );
    }
  }

  footer.append(
    h('button', { text: 'Back', onClick: onBack }),
    h('button', {
      className: 'primary launch',
      text: `Start Run — ${region.name}`,
      onClick: onStart,
    }),
  );
  return root;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** One labelled ON/OFF row. Shared by Settings and Dev Mode so the two screens
 *  cannot drift into looking like different games. */
function toggleRow(
  ic: IconName,
  label: string,
  desc: string,
  get: () => boolean,
  set: (v: boolean) => void,
): HTMLElement {
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
}

/** Settings — where the developer tools are switched on.
 *
 *  Exists because `?dev` on the URL is a fine gate on a desktop and a poor one
 *  on the device this game is actually played on. Everything here is permanent
 *  profile state, persisted the moment it changes; `onChange` re-renders so the
 *  dev-only rows appear and disappear with the switch above them. */
export function settingsScreen(
  profile: CommanderProfile,
  onChange: () => void,
  onBack: () => void,
): HTMLElement {
  const { root, body, footer } = screenShell(
    'Settings',
    'Developer tools and testing options',
    null,
    'settings',
  );

  const panel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Developer' }),
    toggleRow(
      'wrench',
      'Developer mode',
      'Adds the Dev Mode launcher to the main menu and the testing options below. Turning it off puts everything back, including any regions opened for testing.',
      () => profile.devMode,
      (v) => {
        setDevMode(profile, v);
        onChange();
      },
    ),
  ]);

  if (profile.devMode) {
    panel.append(
      toggleRow(
        'radar',
        'Unlock all regions',
        `Opens every region (${REGION_ORDER.map((id) => REGIONS[id].name).join(', ')}) for ordinary runs from Region Select. Nothing is granted — your earned progress is untouched, and Region Select marks anything opened this way as unlocked for testing.`,
        () => profile.allRegionsUnlocked,
        (v) => {
          profile.allRegionsUnlocked = v;
          onChange();
        },
      ),
    );
  }

  body.append(
    panel,
    h('div', {
      className: 'hint',
      text: profile.devMode
        ? 'Dev Mode is on the main menu now — that is where god mode and jump-to-round live.'
        : 'Nothing here changes how the game plays until Developer mode is on.',
    }),
  );

  footer.append(h('button', { text: 'Back', onClick: onBack }));
  return root;
}

// ---------------------------------------------------------------------------
// Dev mode — god abilities & level select for testing
// ---------------------------------------------------------------------------

// Persisted across rerenders of the dev screen.
let devRound = 1;
let devGod = true;
let devUnlock = true;

/** Dev Mode — the dev-RUN launcher.
 *
 *  Everything on this screen is an option for the run it launches. Persistent
 *  profile state (the region unlock) lives in Settings instead: it was the odd
 *  one out here, being the only switch that did something without launching
 *  anything. */
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

  body.append(
    h('div', { className: 'panel' }, [
      h('h2', { text: 'Test loadout' }),
      roundRow,
      toggleRow(
        'shield',
        'God mode',
        'Ships, escorts and batteries are invincible; interceptors, drones, PD rounds and aircraft are unlimited.',
        () => devGod,
        (v) => (devGod = v),
      ),
      toggleRow(
        'flask',
        'Unlock everything',
        'All research complete, Warthog & scan installed, max batteries/escorts/capacity, and deep pockets.',
        () => devUnlock,
        (v) => (devUnlock = v),
      ),
    ]),
    h('div', {
      className: 'hint',
      text:
        'A dev run is a normal campaign with these cheats applied and the enemy fast-forwarded to your chosen round — so later rounds field the guided missiles, mines and low-signature mines you would meet there.',
    }),
    // The clock is not a switch on this screen — it lives on the transit HUD,
    // where it is used — but it IS a dev tool, so this is where a tester finds
    // out it exists. It applies to every transit while Dev Mode is on, not
    // only to runs launched from here.
    h('div', {
      className: 'hint',
      text:
        'Dev Mode also adds 4×, 6× and 10× to the transit speed key, on top of the usual 1×/2×/3× — for pushing a build through slow rounds to reach the one you are testing. Above 3× the round is too fast to fight by hand.',
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
  salvage: 'crate',
  rescue: 'star',
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
    if (s.wreckageSpawned > 0) {
      animStat(
        'Wreckage recovered',
        s.wreckageRecovered,
        (v) => `${v}/${s.wreckageSpawned}`,
        s.wreckageRecovered > 0 ? 'good' : '',
      );
    }
    if (s.survivorsSpawned > 0) {
      animStat(
        'Crews rescued',
        s.survivorsRescued,
        (v) => `${v}/${s.survivorsSpawned}`,
        s.survivorsLost > 0 ? 'bad' : 'good',
      );
    }
    animStat(
      'Confidence',
      report.confidenceAfter,
      (v) => `${v} (${report.confidenceChange >= 0 ? '+' : ''}${report.confidenceChange})`,
      report.confidenceChange >= 0 ? 'good' : 'bad',
    );
    // The ceiling is a cap the player cannot see acting on them unless it is
    // shown. Hidden, "why did a 96% round only move me two points" has no
    // answer on the screen anywhere.
    const ceiling = Math.round(confidenceCeiling(c));
    if (ceiling < CAMPAIGN.maxConfidence) {
      animStat('Confidence ceiling', ceiling, (v) => `${v}/${CAMPAIGN.maxConfidence}`, 'bad');
    }
    return grid;
  });

  // --- Beat: defensive summary — one short readout line per system, so the
  //     debrief scans like an instrument panel instead of a paragraph.
  beats.push(() => {
    const lines: { ic: IconName; text: string }[] = [];
    if (transit) {
      lines.push({
        ic: 'missile',
        text: `${formatInterceptSummary(transit)} ${s.ammoUsed} interceptor(s) expended`,
      });
      if (s.minesTotal > 0) {
        lines.push({
          ic: 'mine',
          text: `Mines — ${s.minesRevealed}/${s.minesTotal} charted · ${s.minesDetonated} detonated · ${s.minesSwept} swept`,
        });
      }
      if (s.torpedoesLaunched > 0) {
        lines.push({
          ic: 'sonar',
          text: `Torpedoes — ${s.torpedoesDetected}/${s.torpedoesLaunched} detected · ${s.torpedoesDestroyed} destroyed · ${s.torpedoesHit} hit home`,
        });
      }
      if (s.boatsLaunched > 0) {
        lines.push({
          ic: 'burst',
          text:
            `Attack boats — ${s.boatsSunk}/${s.boatsLaunched} sunk · ${s.boatKills} hull(s) lost` +
            (s.counter.boardingAttempts > 0
              ? ` · ${s.counter.boardingInterrupted} boarding(s) repelled · ${s.shipsCaptured} CAPTURED`
              : ''),
        });
      }
      if (s.shellsFired > 0) {
        lines.push({
          ic: 'battery',
          text:
            `Shore guns — ${s.shellHits}/${s.shellsFired} shells on target` +
            (s.counter.counterBatterySuppressions > 0
              ? ` · ${s.counter.counterBatterySuppressions} suppressed`
              : '') +
            (s.batteriesDestroyed > 0 ? ` · ${s.batteriesDestroyed} silenced` : ''),
        });
      }
      if (s.smokeCloudsLaid > 0) {
        lines.push({
          ic: 'jam',
          text: `Enemy smoke — ${s.smokeCloudsLaid} cloud(s) · targeting blinded ${Math.round(s.concealedSeconds)}s`,
        });
      }
      if (s.reconPlanes + s.disablingDrones > 0) {
        lines.push({
          ic: 'planeScan',
          text:
            `Enemy air — ${s.reconPlanes} recon · ${s.disablingDrones} drone(s) · ${s.aircraftDowned} downed` +
            (s.shipDisabledSeconds > 0 ? ` · ${Math.round(s.shipDisabledSeconds)}s dead in the water` : ''),
        });
      }
      if (s.counter.jammingSeconds > 0) {
        lines.push({
          ic: 'alert',
          text:
            `Sensors jammed ${Math.round(s.counter.jammingSeconds)}s` +
            (s.counter.jammingMitigatedSeconds > 0
              ? ` · ${Math.round(s.counter.jammingMitigatedSeconds)}s recovered`
              : ''),
        });
      }
      if (s.launchersDisabled > 0) {
        lines.push({ ic: 'turret', text: `Launchers knocked offline ×${s.launchersDisabled}` });
      }
      if (s.escortsLost > 0) lines.push({ ic: 'flame', text: `Escorts lost — ${s.escortsLost}` });
      if (s.basesLost > 0) lines.push({ ic: 'flame', text: `Shore batteries destroyed — ${s.basesLost}` });
    }
    const wrap = h('div', { className: 'card' }, [
      h('div', { className: 'card-head' }, [icon('shield'), h('h3', { text: 'Defensive summary' })]),
    ]);
    if (lines.length === 0) {
      wrap.append(h('p', { text: 'Transit record unavailable (resumed campaign).' }));
    } else {
      wrap.append(
        h(
          'div',
          { className: 'report-lines' },
          lines.map((l) => h('div', { className: 'report-line' }, [icon(l.ic), h('span', { text: l.text })])),
        ),
      );
    }
    return wrap;
  });

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
      text: report.campaignOver
        ? 'Final Report'
        : report.draftSize > 0
          ? 'Continue to Technology Draft'
          : 'Continue to Preparation',
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

/** Discrete-grant labels (magazines, charges …) for effect chips. */
const GRANT_LABELS: Record<string, string> = {
  magazine: 'Magazine',
  sorties: 'Sorties',
  charges: 'Charges',
  reboots: 'Reboots',
  channels: 'Channels',
};

/** What a node's tier assignments / grants do, as LED meters and chips — tier
 *  words never reach the player. */
/** The effect rows on a draft card. When a branch is given, each tiered stat
 *  is shown as a CHANGE — where it sits today against where this option would
 *  put it — because "Accuracy: High" means nothing without knowing whether the
 *  fleet is already there. Without a branch (anywhere the option is not a
 *  choice being weighed) it falls back to a plain level. */
function effectRows(def: CounterNodeDef, current?: Record<string, StatTier>): HTMLElement | null {
  const rows: HTMLElement[] = [];
  for (const s of def.set ?? []) {
    rows.push(
      current ? statUpgradeRow(s.stat, current[s.stat], s.tier) : statTierRow(s.stat, s.tier),
    );
  }
  for (const [k, v] of Object.entries(def.grant ?? {})) {
    rows.push(chip('ammo', `${GRANT_LABELS[k] ?? k} ×${v}`));
  }
  if (rows.length === 0) return null;
  return h('div', { className: 'effect-rows' }, rows);
}

function branchTagRow(
  c: CampaignState,
  branch: CounterBranchDef,
  /** True when the option being rendered will FIT this branch's hardware for
   *  free. The "buy in prep" tag would otherwise sit directly above a line
   *  promising the same hardware at no cost, which reads as a contradiction. */
  grantsEquipment = false,
): HTMLElement {
  const tags = h('div', { className: 'chip-row branch-tags' }, [
    chip('anchor', PLATFORM_LABELS[branch.platform], 'Platform this branch belongs to'),
    chip('chevrons', ROLE_LABELS[branch.role], 'Whether it detects, attacks, mitigates or disrupts'),
  ]);
  for (const enemy of branch.counters) {
    tags.append(chip('alert', `vs ${ENEMY_BRANCH_NAMES[enemy]}`, branch.countersDetail));
  }
  if (awaitingEnemyCapability(branch)) {
    tags.append(chip('eye', 'enemy not fielded yet', 'Ready for the day this threat appears.'));
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
      fitted = c.escortUnits.some((u) => u.modules.includes(eq.id));
      label = `escort fit: ${ESCORT_MODULES[eq.id].name}`;
    } else if (eq.kind === 'baseModule') {
      fitted = c.baseModules.includes(eq.id);
      label = `base fit: ${BASE_MODULES[eq.id].name}`;
    } else if (eq.kind === 'ability') {
      fitted =
        (eq.id === 'warthog' && c.warthogUnlocked) ||
        (eq.id === 'scan' && c.scanUnlocked) ||
        (eq.id === 'sonar' && c.sonarUnlocked) ||
        (eq.id === 'hardened' && c.hardenedUnlocked);
      label = 'convoy asset';
    } else {
      fitted = eq.id === 'escort' ? c.escortUnits.length > 0 : c.bases > 0;
      label = 'built-in launcher';
    }
    if (fitted || grantsEquipment) {
      tags.append(
        chip(
          'check',
          grantsEquipment && !fitted ? `${label} — included` : `${label} ✓`,
          grantsEquipment && !fitted
            ? 'Drafting this fits one free unit; more are bought in Preparation'
            : 'Equipment installed',
        ),
      );
    } else {
      tags.append(
        chip(
          'lock',
          `${label} — buy in prep`,
          'Research is ready; the hardware must be bought in Preparation',
        ),
      );
    }
  }
  return tags;
}

/** The technology a run currently holds — the read-only build overview shown
 *  beneath the draft. Grouped by WHAT CARRIES each technology (cargo modules /
 *  escort fit / fleet-wide / consumables) rather than by the enemy it counters:
 *  the question this list answers is "what does my fleet already have", and a
 *  player looks that up by where the thing lives, not by which threat it was
 *  bought against. */
const OWNED_TECH_GROUPS = [
  { key: 'cargo', label: 'Cargo ship modules' },
  { key: 'escort', label: 'Escort modules' },
  { key: 'fleet', label: 'Fleet upgrades' },
  { key: 'consumable', label: 'Consumable upgrades' },
] as const;

function ownedTechGroup(branch: CounterBranchDef): (typeof OWNED_TECH_GROUPS)[number]['key'] {
  const eq = branch.equipment;
  if (!eq) return 'fleet'; // logistics and other fleet-shape branches
  if (eq.kind === 'cargoModule') return 'cargo';
  if (eq.kind === 'escortModule') return 'escort';
  if (eq.kind === 'builtIn') return eq.id === 'escort' ? 'escort' : 'fleet';
  if (eq.kind === 'ability') return 'consumable';
  return 'fleet'; // base modules ride with the fleet's fixed installations
}

function ownedTechSummary(c: CampaignState): HTMLElement {
  const wrap = h('div', { className: 'card owned-tech' }, [
    h('div', { className: 'card-head' }, [icon('check'), h('h3', { text: 'Technology held this run' })]),
  ]);
  const owned = c.completedResearch.filter((id) => RESEARCH_INDEX[id]);
  if (owned.length === 0) {
    wrap.append(h('p', { className: 'hint', text: 'Nothing drafted yet.' }));
    return wrap;
  }
  for (const group of OWNED_TECH_GROUPS) {
    const inGroup = owned.filter((id) => ownedTechGroup(RESEARCH_INDEX[id].branch) === group.key);
    if (inGroup.length === 0) continue;
    const row = h('div', { className: 'chip-row' });
    for (const id of inGroup) {
      const entry = RESEARCH_INDEX[id];
      row.append(chip(BRANCH_ICONS[entry.branch.id], entry.def.name, entry.def.desc));
    }
    wrap.append(h('div', { className: 'hint', text: group.label }), row);
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// Reward categories
// ---------------------------------------------------------------------------
//
// Four categories, four identities. The player should be able to tell what kind
// of reward a card is before reading a word of it, because the four behave
// completely differently: an upgrade improves everything you already carry, a
// module is a physical unit you move between hulls, an asset changes the shape
// of the fleet, and ordnance is spent and gone.
//
// Category owns the FILL, the ICON and the RIBBON. The counter slot owns the
// BORDER and the badge. They are independent axes — a module can also be the
// counter pick — so they must never fight for the same channel.

const CATEGORY_STYLE: Record<DraftOptionKind, { label: string; icon: IconName }> = {
  upgrade: { label: 'Upgrade', icon: 'chevrons' },
  module: { label: 'Equipment', icon: 'slots' },
  asset: { label: 'Fleet Asset', icon: 'anchor' },
  ordnance: { label: 'Ordnance', icon: 'ammo' },
};

const PLATFORM_FIT_LINE: Record<ModulePlatform, string> = {
  cargo: 'One unit — fits an entire ship class, and is never lost with a hull.',
  escort: 'One unit — fits any single escort, and is salvaged if she is lost.',
  base: 'One unit — fits the shore batteries.',
};

function modulePlacementLine(platform: ModulePlatform): string {
  return PLATFORM_FIT_LINE[platform];
}

function draftRoleLine(
  option: DraftOption,
  info: ReturnType<typeof draftOptionInfo> & object,
  branch: CounterBranchDef | null,
  /** True when the card's TITLE is already the branch name, so repeating it
   *  here would just say the same thing twice in two type sizes. */
  branchTitled = false,
): string {
  const lead = branchTitled ? '' : `${info.branchName} · `;
  if (option.kind === 'ordnance') return 'Consumables · delivered once · spent in play';
  if (option.kind === 'asset') return `${lead}the fleet itself · permanent`;
  if (option.kind === 'module') {
    return `${lead}${PLATFORM_LABELS[branch?.platform ?? 'convoy']} · equipment unit`;
  }
  const entry = RESEARCH_INDEX[(option as { id: string }).id];
  const kindLabel = entry?.isTactic
    ? TACTIC_KIND_LABELS[(entry.def as CounterTacticDef).kind]
    : 'Hardware';
  return `${lead}${PLATFORM_LABELS[branch?.platform ?? 'convoy']} · ${kindLabel}`;
}

/** A row of analog lights: filled for what the fleet already holds, one amber
 *  pip pulsing for the rung this card would add. Deliberately ROUND, so it can
 *  never be misread as the skewed LED bars that show stat tiers — two readouts
 *  meaning different things must not share a shape. */
function pipRow(filled: number, total: number, label: string, gaining: boolean): HTMLElement {
  const cells: HTMLElement[] = [];
  for (let i = 0; i < total; i++) {
    const cls =
      i < filled ? 'pip on' : gaining && i === filled ? 'pip gain' : 'pip';
    cells.push(h('span', { className: cls }));
  }
  return h('div', { className: 'pip-row' }, [
    h('span', { className: 'pip-label', text: label }),
    h('div', { className: 'pips' }, cells),
    h('span', { className: 'pip-count', text: `${filled + (gaining ? 1 : 0)}/${total}` }),
  ]);
}

/** How deep a branch runs: what is taken, and the rung this pick adds. */
function depthPips(taken: number, total: number, branchName: string): HTMLElement {
  return pipRow(taken, total, `${branchName} upgrades`, true);
}

/** How many units of a module the run holds, and the one this pick delivers. */
function unitPips(held: number, cap: number): HTMLElement {
  return pipRow(held, cap, 'Units held', held < cap);
}

/** The same read-out on the loadout screens, where nothing is being gained —
 *  it is a statement of what the locker holds, not of what a card would add. */
function unitCountRow(held: number, cap: number, spare: number): HTMLElement {
  const row = pipRow(held, cap, 'Units held', false);
  row.append(
    h('span', {
      className: 'pip-note',
      text: spare > 0 ? `${spare} spare` : held > 0 ? 'all fitted' : 'none',
    }),
  );
  return row;
}

/** The mandatory post-round technology draft. The player MUST take one option
 *  (no skipping, no banking); the pick activates immediately. The only escape
 *  hatch is an exhausted catalogue, which offers nothing to take. */
export function draftScreen(
  c: CampaignState,
  onPicked: () => void,
  onQuit: () => void,
): HTMLElement {
  const draft = c.pendingDraft;
  const { root, body, footer } = screenShell(
    `Technology Draft — Round ${draft?.round ?? c.round - 1}`,
    draft && draft.picksLeft > 1
      ? `Take ${draft.picksLeft} — salvage bought the extra picks`
      : 'Pick one — it activates immediately',
    c,
    'draft',
  );

  if (!draft) {
    // Defensive: routed here without a pending draft — let the player through.
    body.append(h('p', { className: 'hint', text: 'No draft is pending.' }));
    footer.append(h('button', { className: 'primary', text: 'Continue to Preparation', onClick: onPicked }));
    return root;
  }

  const counterName = draft.counterFamily
    ? (ENEMY_BRANCH_NAMES[draft.counterFamily as keyof typeof ENEMY_BRANCH_NAMES] ??
      draft.counterFamily)
    : null;
  // How many picks this table carries, front and centre — the count used to
  // live only in the subtitle, and a player who had earned a triple pick
  // through salvage could walk past two of them without ever knowing.
  const picksTotal = draft.picksTotal ?? draft.picksLeft;
  body.append(
    h('div', { className: 'draft-picks' }, [
      icon('chevrons'),
      h('strong', { text: `Pick ${picksTotal - draft.picksLeft + 1} of ${picksTotal}` }),
      h('span', {
        className: 'hint',
        text:
          picksTotal > 1
            ? `${draft.picksLeft} still to take — salvage bought the extra picks`
            : 'One technology joins the fleet — recover wreckage to earn more picks',
      }),
    ]),
  );
  body.append(
    h('div', { className: 'chip-row' }, [
      draft.recoveredUnits > 0
        ? chip(
            'crate',
            `Salvage ×${draft.recoveredUnits} — draft widened`,
            'Recovered wreckage widens the draft and aims it at the threats it came from',
          )
        : chip('crate', 'No salvage — base draft', 'Recovering wreckage widens future drafts'),
      ...(counterName
        ? [
            chip(
              'alert',
              `Answering: ${counterName}`,
              'One option always answers whatever is getting through to the convoy. ' +
                'It stops appearing once you are actually stopping that threat.',
            ),
          ]
        : []),
      ...(draft.rerolls
        ? [
            chip(
              'reload',
              draft.rerolls > 1 ? `Rerolled ×${draft.rerolls}` : 'Rerolled',
              'This table was redrawn with a reroll earned by rescuing crews',
            ),
          ]
        : []),
    ]),
  );

  if (draft.options.length === 0) {
    body.append(
      h('div', { className: 'card' }, [
        h('div', { className: 'card-head' }, [icon('check'), h('h3', { text: 'Catalogue exhausted' })]),
        h('p', {
          text: 'Every technology this region can use is already in the fleet. The engineers stand down.',
        }),
      ]),
    );
    footer.append(
      h('button', {
        className: 'primary',
        text: 'Continue to Preparation',
        onClick: () => {
          if (dismissEmptyDraft(c)) onPicked();
        },
      }),
    );
    return root;
  }

  const optionRow = h('div', { className: 'grid-2 draft-options' });
  // researchSet(), not the raw completedResearch array: base nodes can be
  // GRANTED rather than drafted, and a stat the fleet already has from a
  // granted node would otherwise read as brand new on the card.
  const researchedSet = researchSet(c);
  for (const option of draft.options) {
    const info = draftOptionInfo(c, option);
    if (!info) continue;
    const branch = draftOptionBranch(option);
    const meta = CATEGORY_STYLE[info.kind];
    // The card is titled by its BRANCH — the system being improved — with the
    // specific node beneath it. "High-Velocity Motor" alone forced the player
    // to deduce what the motor was in; "Escort Missile Interceptors" answers
    // the only question a card has to answer at a glance: what is this FOR.
    const branchTitled = Boolean(branch && info.branchName && info.branchName !== info.name);
    const bits: HTMLElement[] = [
      h('div', { className: 'card-head' }, [
        icon(branch ? BRANCH_ICONS[branch.id] : meta.icon),
        h('h3', { text: branchTitled ? info.branchName : info.name }),
        h('span', { className: `cat-ribbon cat-${info.kind}`, text: meta.label }),
      ]),
      ...(branchTitled ? [h('div', { className: 'draft-node-name', text: info.name })] : []),
      h('div', {
        className: 'role-line',
        text: draftRoleLine(option, info, branch, branchTitled),
      }),
      h('p', { text: info.desc }),
    ];

    if (option.kind === 'upgrade' || option.kind === 'asset') {
      const entry = RESEARCH_INDEX[option.id];
      if (entry) {
        const effects = effectRows(entry.def, resolveBranchStats(entry.branch.id, researchedSet).tiers);
        if (effects) bits.push(effects);
      }
      // How deep this branch already runs, and the rung this card would add.
      // The same read-out appears in Preparation, so "how far along am I" is
      // answered the same way in both places.
      if (info.branchDepth) {
        bits.push(depthPips(info.branchDepth.taken, info.branchDepth.total, info.branchName));
      }
    }

    if (option.kind === 'module') {
      bits.push(unitPips(info.held ?? 0, info.cap ?? 1));
      bits.push(
        h('div', { className: 'grant-line' }, [
          icon('check'),
          h('span', { text: modulePlacementLine(option.platform) }),
        ]),
      );
    }

    if (branch) bits.push(branchTagRow(c, branch, option.kind === 'module'));

    bits.push(
      h('button', {
        className: 'primary',
        text: `Draft ${info.name}`,
        onClick: () => {
          // With picks left the draft stays open, so re-render the same screen
          // rather than routing on; the sim decides when it is spent.
          if (selectDraftOption(c, option)) onPicked();
        },
      }),
    );
    const classes = ['card', 'draft-option', `cat-${info.kind}`];
    if (draftOptionKey(option) === draft.counterOption) classes.push('draft-counter');
    optionRow.append(h('div', { className: classes.join(' ') }, bits));
  }
  body.append(optionRow);

  // Reroll — earned by pulling crews out of the water, so the offer to redraw
  // sits with the table it would replace rather than in a menu somewhere.
  const banked = c.draftRerolls ?? 0;
  const rerollBlock = rerollBlockReason(c);
  body.append(
    h('div', { className: 'card reroll-card' }, [
      h('div', { className: 'card-head' }, [
        icon('reload'),
        h('h3', { text: 'Reroll the table' }),
        ...(banked > 0 ? [h('span', { className: 'cat-ribbon', text: `×${banked}` })] : []),
      ]),
      h('p', {
        text:
          banked > 0
            ? 'Redraw every option. Picks already taken stay taken, and the number of picks does not change.'
            : `Rescuing ${DRAFT.crewsPerReroll} crews in a single round earns a reroll.`,
      }),
      h('button', {
        className: banked > 0 ? 'primary' : '',
        text: banked > 0 ? `Reroll — ${banked} left` : (rerollBlock ?? 'Reroll'),
        disabled: rerollBlock !== null,
        onClick: () => {
          if (rerollDraft(c)) onPicked();
        },
      }),
    ]),
  );
  body.append(ownedTechSummary(c));

  footer.append(
    h('button', {
      className: 'ghost',
      text: '☰ Save & Quit',
      attrs: { style: 'margin-right:auto' },
      onClick: onQuit,
    }),
    h('div', { className: 'hint', text: 'The draft is mandatory.' }),
  );
  return root;
}

// ---------------------------------------------------------------------------
// Procurement / preparation
// ---------------------------------------------------------------------------

const SHIP_TAGLINES: Record<ShipClassId, string> = {
  cargo: 'Dependable hull, dependable value.',
  tanker: 'Twice the payout — goes up violently.',
  freighter: 'Fast, cheap, fragile.',
};


/** The counter branch a piece of equipment belongs to (for the platform /
 *  counters / role line on its card). */
function branchForEquipment(kind: 'cargoModule' | 'escortModule' | 'baseModule', id: string) {
  const exact = Object.values(COUNTER_BRANCHES).find(
    (b) => b.equipment?.kind === kind && b.equipment.id === id,
  );
  if (exact) return exact;
  // A capability can be fitted to more than one kind of hull — mine sonar is
  // sold as a cargo module and as an escort fit, and it is the same sonar. Fall
  // back to matching the id alone so the second fit still shows its branch's
  // icon and "what this is for" line instead of a generic card.
  return Object.values(COUNTER_BRANCHES).find((b) => b.equipment?.id === id);
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
    'Fit the convoy, then sail',
    c,
    'prep',
  );

  // --- Mission brief: capacity + quota at a glance ------------------------------
  const assigned = totalComposition(c);
  const qs = quotaSummary(c);
  const briefStrip =
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
        projectionBar(
          c.quota.pointsNeeded > 0 ? c.quota.pointsEarned / c.quota.pointsNeeded : 0,
          c.quota.pointsNeeded > 0 ? projectedQuotaPoints(c) / c.quota.pointsNeeded : 0,
          qs.met ? 'good' : 'warn',
        ),
        // A stacked bar is only readable if the second colour is named, so the
        // legend is part of the control rather than something to infer.
        h('div', { className: 'bar-legend' }, [
          h('span', { className: 'key earned' }),
          h('span', { text: 'banked' }),
          h('span', { className: 'key projected' }),
          h('span', { text: `this convoy +${projectedQuotaPoints(c)}` }),
        ]),
        h('div', { className: 'hint', text: qs.text }),
      ]),
    ]);

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
            chip(
              'slots',
              `${c.classModules[classId].length}/${classSlots(c, classId)}`,
              'Module slots used',
            ),
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
                'accuracy',
                `${def.interceptAccuracy >= 0 ? '+' : ''}${Math.round(def.interceptAccuracy * 100)}%`,
                'Interceptor accuracy from this formation',
              ),
              chip('range', `×${def.defenseRangeMult}`, 'Point-defense & escort reach'),
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
    h('h2', { text: 'Ship modules — refit the whole class' }),
  ]);
  const tabs = h('div', { className: 'tabs' });
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const def = SHIP_CLASSES[classId];
    const owned = c.classModules[classId];
    const dots = Array.from({ length: classSlots(c, classId) }, (_, i) =>
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
    if (!moduleRevealed(c, activeClass, moduleId)) continue;
    const mod = MODULES[moduleId];
    const isOwned = activeOwned.includes(moduleId);
    const held = moduleStock(c, 'cargo', moduleId);
    const spare = moduleSpare(c, 'cargo', moduleId);
    const block = moduleBlockReason(c, activeClass, moduleId);
    const roleLine = equipmentRoleLine('cargoModule', moduleId);
    let fitLabel: string;
    if (block === null) fitLabel = `Fit to ${activeDef.name}`;
    else if (block === 'No module slots free on this class') fitLabel = 'No slots free';
    else fitLabel = block;
    modGrid.append(
      h('div', { className: isOwned ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon(MODULE_ICONS[moduleId]),
          h('h3', { text: mod.name }),
          isOwned ? h('span', { className: 'badge good', text: 'Fitted' }) : h('span'),
        ]),
        roleLine ? h('div', { className: 'hint role-line', text: roleLine }) : h('span'),
        h('p', { text: mod.desc }),
        unitCountRow(held, moduleStockCap('cargo'), spare),
        isOwned
          ? h('button', {
              className: 'unequip',
              text: 'Unfit — return to the locker',
              onClick: () => {
                if (removeModule(c, activeClass, moduleId)) rerender();
              },
            })
          : h('button', {
              text: fitLabel,
              disabled: block !== null,
              onClick: () => {
                if (equipModule(c, activeClass, moduleId)) rerender();
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
        `One unit fits every ${activeDef.name} afloat (${Math.max(1, c.fleet[activeClass])} hull(s)). ` +
        'Units come from the technology draft, never the bank — fitting and unfitting is free, ' +
        'and a cargo fit is never lost when a hull is.',
    }),
  );

  // --- The escort flotilla: every escort named and fitted on its own ---------
  //
  // This replaced a single fleet-wide loadout panel. Under that model the three
  // module cards described ONE design that every escort copied, so a flotilla
  // could never cover more than two roles no matter how many hulls it had.
  const slotCount = escortSlots(c);
  const refitUnlocked = hasResearch(c, 'logistics.escortRefitBay');
  const selected =
    c.escortUnits.find((u) => u.id === prepEscortId) ?? c.escortUnits[0] ?? null;
  if (selected) prepEscortId = selected.id;

  const escortPanel = h('div', { className: 'panel' }, [
    h('h2', { text: `Escort flotilla — ${c.escortUnits.length}/${ECONOMY.maxEscorts} ships` }),
    h('div', {
      className: 'hint',
      text:
        'Interceptors are built in. Each escort is fitted separately — specialize them.' +
        (c.escortUnits.length === 0 ? ' Hire your first escort above.' : ''),
    }),
  ]);

  if (c.escortUnits.length > 0 && selected) {
    // --- Roster: one row per escort, so roles compare at a glance -------------
    // Built as `tabs`, exactly like the ship-module class tabs above: a profile
    // of the ship, its name, and a row of slot lights that fill as specialists
    // are fitted. The two screens were describing the same idea — pick a
    // platform, see what is on it — in two different visual languages, and the
    // escort one was the weaker of them: three lines of small text with no
    // picture, so a flotilla read as a list rather than as ships.
    const roster = h('div', { className: 'escort-roster' });
    for (const unit of c.escortUnits) {
      const isSel = unit.id === selected.id;
      const hull = escortHull(unit.id);
      const dots = Array.from({ length: slotCount }, (_, i) =>
        h('span', { className: i < unit.modules.length ? 'slot-dot filled' : 'slot-dot' }),
      );
      const fit =
        unit.modules.length > 0
          ? unit.modules.map((m) => ESCORT_MODULES[m].name.split(' ')[0]).join(' + ')
          : 'no specialists';
      roster.append(
        h(
          'button',
          {
            className: isSel ? 'tab escort-tab selected' : 'tab escort-tab',
            onClick: () => {
              prepEscortId = unit.id;
              rerender();
            },
          },
          [
            h('span', { className: 'tab-fig' }, [escortHullFigure(unit.id)]),
            h('span', { className: 'tab-label' }, [
              h('span', { text: unit.name }),
              h('span', { className: 'muted escort-tab-class', text: hull.name }),
              h('span', { className: 'slot-dots' }, dots),
            ]),
          ],
        ),
      );
      // The fit and any damage still have to be readable — they were the point
      // of the old rows — but as a title rather than a third line of type.
      const last = roster.lastElementChild as HTMLElement;
      last.title = `${unit.name} (${hull.name}) — interceptors + ${fit}${
        unit.damage > 0 ? ` · ${Math.round(unit.damage)} damage` : ''
      }`;
    }
    escortPanel.append(roster);

    // --- Rename --------------------------------------------------------------
    const nameInput = h('input', { className: 'escort-name-input' });
    nameInput.setAttribute('type', 'text');
    nameInput.setAttribute('maxlength', String(ESCORT_NAME_MAX));
    nameInput.setAttribute('aria-label', 'Escort name');
    nameInput.value = selected.name;
    const commitName = (): void => {
      if (renameEscort(c, selected.id, nameInput.value)) rerender();
    };
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('keydown', (ev) => {
      if ((ev as KeyboardEvent).key === 'Enter') commitName();
    });
    escortPanel.append(
      h('div', { className: 'escort-name-row' }, [
        h('label', { className: 'hint', text: 'Name' }),
        nameInput,
      ]),
    );

    // --- Built-in, then the slots --------------------------------------------
    escortPanel.append(
      h('div', { className: 'module-card owned built-in' }, [
        h('div', { className: 'card-head' }, [
          icon(BRANCH_ICONS.escortInterceptor),
          h('h3', { text: 'Missile Interceptors' }),
          h('span', { className: 'badge good', text: 'Built in' }),
        ]),
        h('div', { className: 'hint role-line', text: 'Attacks missiles · every escort · no slot' }),
        h('p', { text: 'Standard and free — the slots below are additions, not alternatives.' }),
      ]),
    );

    const usedSlots = selected.modules.length;
    escortPanel.append(
      h('div', {
        className: 'hint',
        text:
          `${selected.name}: ${usedSlots}/${slotCount} specialist slots.` +
          (refitUnlocked ? '' : ' A third slot needs the Escort Refit Bay.'),
      }),
    );

    const escortGrid = h('div', { className: 'module-grid' });
    for (const id of Object.keys(ESCORT_MODULES) as (keyof typeof ESCORT_MODULES)[]) {
      if (!escortModuleRevealed(c, id)) continue;
      const def = ESCORT_MODULES[id];
      const fitted = selected.modules.includes(id);
      const block = escortModuleBlockReason(c, selected.id, id);
      const held = moduleStock(c, 'escort', id);
      const spare = moduleSpare(c, 'escort', id);
      const branch = branchForEquipment('escortModule', id);
      // How many OTHER escorts already carry this, so the player can see the
      // shape of the flotilla without clicking through every ship.
      const elsewhere = c.escortUnits.filter((u) => u.id !== selected.id && u.modules.includes(id)).length;
      escortGrid.append(
        h('div', { className: fitted ? 'module-card owned' : 'module-card' }, [
          h('div', { className: 'card-head' }, [
            icon(branch ? BRANCH_ICONS[branch.id] : 'slots'),
            h('h3', { text: def.name }),
            fitted ? h('span', { className: 'badge good', text: 'Fitted' }) : h('span'),
          ]),
          h('div', { className: 'hint role-line', text: equipmentRoleLine('escortModule', id) }),
          h('p', { text: def.desc }),
          elsewhere > 0
            ? h('div', {
                className: 'hint',
                text: `Also carried by ${elsewhere} other escort${elsewhere === 1 ? '' : 's'}.`,
              })
            : h('span'),
          unitCountRow(held, moduleStockCap('escort'), spare),
          fitted
            ? h('button', {
                className: 'unequip',
                text: `Remove from ${selected.name}`,
                onClick: () => {
                  if (removeEscortModule(c, selected.id, id)) rerender();
                },
              })
            : h('button', {
                text: block === null ? `Fit to ${selected.name}` : block,
                disabled: block !== null,
                onClick: () => {
                  if (equipEscortModule(c, selected.id, id)) rerender();
                },
              }),
        ]),
      );
    }
    // Every escort module is technology-gated, so before the first relevant
    // draft this grid is legitimately empty — say so rather than showing a
    // blank panel that reads as a bug.
    escortPanel.append(
      escortGrid.childElementCount > 0
        ? escortGrid
        : h('p', {
            className: 'hint',
            text: 'No specialist equipment in the locker. Escort weapons and sensors arrive as units from the technology draft — and go down with the escort carrying them.',
          }),
    );
  }

  // --- Shore-base loadout ------------------------------------------------------
  const basePanel = h('div', { className: 'panel' }, [
    h('h2', { text: `Shore-base loadout — ${c.baseModules.length}/${BASE_MODULE_SLOTS} slot` }),
    h('div', {
      className: 'hint',
      text: 'Interceptors are built into every battery. Strategic systems compete for one network slot.',
    }),
  ]);
  const baseGrid = h('div', { className: 'module-grid' });
  for (const id of Object.keys(BASE_MODULES) as (keyof typeof BASE_MODULES)[]) {
    if (!baseModuleRevealed(c, id)) continue;
    const def = BASE_MODULES[id];
    const fitted = c.baseModules.includes(id);
    const block = baseModuleBlockReason(c, id);
    baseGrid.append(
      h('div', { className: fitted ? 'module-card owned' : 'module-card' }, [
        h('div', { className: 'card-head' }, [
          icon(branchForEquipment('baseModule', id)?.id
            ? BRANCH_ICONS[branchForEquipment('baseModule', id)!.id]
            : 'slots'),
          h('h3', { text: def.name }),
          fitted ? h('span', { className: 'badge good', text: 'Fitted' }) : h('span'),
        ]),
        h('div', { className: 'hint role-line', text: equipmentRoleLine('baseModule', id) }),
        h('p', { text: def.desc }),
        unitCountRow(moduleStock(c, 'base', id), moduleStockCap('base'), moduleSpare(c, 'base', id)),
        fitted
          ? h('button', {
              className: 'unequip',
              text: 'Remove from the batteries',
              onClick: () => {
                if (removeBaseModule(c, id)) rerender();
              },
            })
          : h('button', {
              text: block === null ? 'Fit bases' : block,
              disabled: block !== null,
              onClick: () => {
                if (equipBaseModule(c, id)) rerender();
              },
            }),
      ]),
    );
  }
  basePanel.append(
    baseGrid.childElementCount > 0
      ? baseGrid
      : h('p', {
          className: 'hint',
          text: 'No battery equipment in the locker. Shore-battery fits arrive as units from the technology draft.',
        }),
  );

  // --- Support assets: every item explains itself inline ----------------------------
  const assetPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Air defense & support' }),
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

  // Fleet procurement lives beside the flotilla it grows (the Fleet section).
  const fleetGrid = h('div', { className: 'asset-grid' });
  fleetGrid.append(
    assetCard(
      'battery',
      'Shore battery',
      `${c.bases}/${ECONOMY.maxBases}`,
      'Fixed launcher: unlimited range, slow reload, fast interceptors. Can be struck and destroyed.',
      {
        label: `Build battery — $${ECONOMY.baseCost}`,
        disabled: c.bases >= ECONOMY.maxBases || c.cash < ECONOMY.baseCost,
        onClick: () => {
          if (buyBase(c)) rerender();
        },
      },
    ),
    assetCard(
      'escortShip',
      'Escort ship',
      `${c.escortUnits.length}/${ECONOMY.maxEscorts}`,
      'Mobile launcher: quick reload, shorter reach. Fit its specialist slots below; order it around the map in transit.',
      {
        label: `Hire escort — $${ECONOMY.escortCost}`,
        disabled: c.escortUnits.length >= ECONOMY.maxEscorts || c.cash < ECONOMY.escortCost,
        onClick: () => {
          if (buyEscort(c)) rerender();
        },
      },
    ),
  );

  assetGrid.append(
    assetCard(
      'ammo',
      'Interceptor ammo',
      `${c.ammo}`,
      'Shared magazine for every launcher. Unused rounds carry over.',
      {
        label: `Buy ${ECONOMY.ammoPerBuy} — $${ammoUnitCost(c) * ECONOMY.ammoPerBuy}`,
        disabled: c.cash < ammoUnitCost(c) * ECONOMY.ammoPerBuy,
        onClick: () => {
          if (buyAmmo(c, ECONOMY.ammoPerBuy)) rerender();
        },
      },
    ),
    ...(c.escortUnits.some((u) => u.modules.includes('deckGun')) ||
    (c.moduleStock.escort.deckGun ?? 0) > 0 ||
    c.gunAmmo > 0
      ? [
          assetCard(
            BRANCH_ICONS.deckGun,
            'Deck gun shells',
            `${c.gunAmmo}`,
            'Every round a deck gun fires draws one. An empty magazine holds its fire — stock up before the boats come.',
            {
              label: `Buy ${ECONOMY.gunShellsPerBuy} — $${ECONOMY.gunShellCost * ECONOMY.gunShellsPerBuy}`,
              disabled: gunShellsBlockReason(c) !== null,
              onClick: () => {
                if (buyGunShells(c)) rerender();
              },
            },
          ),
        ]
      : []),
    // Sorties and pulses are STOCK, not a refilling allowance: commission the
    // flight once, then buy each one you intend to fly. The count reads
    // "held/apron" so the cap — which research raises — is visible at the point
    // the player would otherwise wonder why they cannot buy another.
    assetCard(
      'planeGun',
      'A-10 Warthog',
      `${c.warthogStock}/${warthogCapacity(c)}`,
      'Guns a line you draw: one target on the way out, one on the way back. Mines and boats only — nothing airborne or underwater.',
      {
        label:
          warthogSortieBlockReason(c) === 'Apron full'
            ? 'Apron full'
            : `Buy sortie — $${ECONOMY.warthogSortieCost}`,
        disabled: warthogSortieBlockReason(c) !== null,
        onClick: () => {
          if (buyWarthogSortie(c)) rerender();
        },
      },
    ),
    assetCard(
      'planeScan',
      'Scan aircraft',
      `${c.scanStock}/${scanCapacity(c)}`,
      'Sweeps one lane, charting its mines. Ships steer around charted mines.',
      {
        label:
          scanPulseBlockReason(c) === 'Stowage full'
            ? 'Stowage full'
            : `Buy pulse — $${ECONOMY.scanPulseCost}`,
        disabled: scanPulseBlockReason(c) !== null,
        onClick: () => {
          if (buyScanPulse(c)) rerender();
        },
      },
    ),
  );

  // The convoy's own assets are in hand from round one — what is bought here is
  // their ORDNANCE. Commissioning them used to cost 150-160 each on top of the
  // technology that unlocked them, which was the same IOU the equipment economy
  // has shed.

  // Drone munitions only appear once the minesweeper branch is researched
  // (nothing to buy them for otherwise).
  if (hasResearch(c, 'mcmDrones.base')) {
    assetGrid.append(
      assetCard(
        BRANCH_ICONS.mcmDrones,
        'Drone munitions',
        `${c.droneAmmo}`,
        'One per mine sweep — in transit, tap a charted mine. Needs an escort drone launcher.',
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
        BRANCH_ICONS.selfDefense,
        'Self-defense rounds',
        `${c.pdAmmo}`,
        'Shared stock for the Self-Defense module — no rounds, no defense. Carries over.',
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

  assetPanel.append(assetGrid);

  // Repairs are bought a SCOPE at a time. A player who cannot afford everything
  // should be choosing which half of the fleet to patch — the merchant hulls
  // that carry the quota, or the warships that protect them — and each
  // single-scope order carries a spend-what-you-have variant underneath it.
  // The cards live with the assets they patch: cargo hulls with the convoy,
  // escorts and batteries on the Defense screen.
  const repairCard = (
    scope: 'cargo' | 'escorts',
    title: string,
    clean: string,
    dirty: string,
  ): HTMLElement => {
    const damage = scopeDamage(c, scope);
    const full = repairCost(c, scope);
    const part = repairPartialQuote(c, scope);
    const card = h('div', { className: 'asset-card' }, [
      h('div', { className: 'card-head' }, [
        icon('wrench'),
        h('h3', { text: title }),
        h('span', { className: 'asset-count', text: damage > 0 ? `${damage} hp` : '✓' }),
      ]),
      h('p', { text: damage > 0 ? dirty : clean }),
      h('button', {
        text: damage > 0 ? `Repair — $${full}` : 'No repairs needed',
        disabled: damage <= 0 || c.cash < full,
        onClick: () => {
          if (repairFleet(c, scope)) rerender();
        },
      }),
    ]);
    // The partial order only earns its place when the full one is out of
    // reach — otherwise it is a second button that does the same thing.
    if (damage > 0 && c.cash < full && part.hp > 0) {
      card.append(
        h('button', {
          text: `Repair what you can — $${part.cost} (${part.hp} of ${damage} hp)`,
          onClick: () => {
            if (repairPartial(c, scope)) rerender();
          },
        }),
      );
    }
    return card;
  };

  const totalDamage = totalPendingDamage(c);
  const repairAll = repairCost(c, 'all');
  const repairPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Fleet repairs' }),
    h('div', { className: 'asset-grid' }, [
      repairCard(
        'cargo',
        'Cargo hull repairs',
        'Every merchant hull is at full strength.',
        'Unrepaired damage sails with the next convoy.',
      ),
      assetCard(
        'anchor',
        'Repair everything',
        totalDamage > 0 ? `${totalDamage} hp` : '✓',
        totalDamage > 0
          ? 'Merchant hulls, escorts and batteries in one order.'
          : 'Nothing in the fleet is carrying damage.',
        {
          label: totalDamage > 0 ? `Repair all — $${repairAll}` : 'No repairs needed',
          disabled: totalDamage <= 0 || c.cash < repairAll,
          onClick: () => {
            if (repairFleet(c, 'all')) rerender();
          },
        },
      ),
    ]),
  ]);
  const escortRepairPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Escort & battery repairs' }),
    h('div', { className: 'asset-grid' }, [
      repairCard(
        'escorts',
        'Escorts & batteries',
        'Every escort and battery is at full strength.',
        'Escorts and batteries carry their damage into the next transit.',
      ),
    ]),
  ]);

  // --- Assemble: a section rail instead of one endless scroll -----------------
  const fleetPanel = h('div', { className: 'panel' }, [
    h('h2', { text: 'Fleet procurement' }),
    fleetGrid,
  ]);

  const sections: { id: PrepSectionId; label: string; ic: IconName; els: HTMLElement[] }[] = [
    {
      id: 'convoy',
      label: 'Convoy',
      ic: 'anchor',
      els: [briefStrip, h('div', { className: 'grid-2' }, [compPanel, formPanel]), repairPanel],
    },
    { id: 'modules', label: 'Modules', ic: 'slots', els: [modPanel] },
    {
      id: 'fleet',
      label: 'Defense',
      ic: 'missile',
      els: [fleetPanel, escortRepairPanel, escortPanel, basePanel],
    },
    { id: 'assets', label: 'Supplies', ic: 'crate', els: [assetPanel] },
  ];

  const rail = h('div', { className: 'prep-rail' });
  const content = h('div', {
    className: 'prep-content',
    attrs: { 'data-section': prepSection },
  });
  for (const sec of sections) {
    rail.append(
      h('button', {
        className: prepSection === sec.id ? 'rail-btn selected' : 'rail-btn',
        onClick: () => {
          if (prepSection === sec.id) return;
          prepSection = sec.id;
          rerender();
        },
      }, [icon(sec.ic), h('span', { text: sec.label }), h('span', { className: 'rail-led' })]),
    );
    content.append(
      h('div', { className: prepSection === sec.id ? 'prep-section active' : 'prep-section' }, sec.els),
    );
  }
  body.append(rail, content);

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
        ? `${totalComposition(c)} / ${c.capacity} ships ready`
        : 'Assign at least one ship.',
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
// Run over — defeat resets the region; victory unlocks the next one.
// Either way the Commander keeps everything the run taught them.
// ---------------------------------------------------------------------------

export function runOverScreen(
  c: CampaignState,
  settlement: RunSettlement | null,
  onContinue: () => void,
): HTMLElement {
  const region = regionDef(c.regionId);
  const victory = c.runOutcome === 'victory';
  const { root, body, footer } = screenShell(
    victory ? `${region.name} Secured` : 'Regional Run Lost',
    victory
      ? 'The completion watermark was reached — the region is yours'
      : c.defeatCause === 'quota'
        ? 'The shipping quota was missed and the consortium pulled out'
        : 'Confidence collapsed — the crews will no longer sail',
    null,
    'runover',
  );
  const totalDelivered = c.history.reduce((a, r) => a + r.delivered, 0);
  const totalLost = c.history.reduce((a, r) => a + r.lost, 0);
  const totalValue = c.history.reduce((a, r) => a + r.valueDelivered, 0);
  const totalWreckage = Object.values(c.wreckageRecovered).reduce((a, b) => a + b, 0);
  body.append(
    h('div', { className: 'stat-grid' }, [
      stat('Final score', `${c.score}`),
      stat('Rounds fought', `${c.history.length}`),
      stat('Ships delivered', `${totalDelivered}`, 'good'),
      stat('Ships lost', `${totalLost}`, 'bad'),
      stat('Cargo value moved', `${totalValue}`),
      stat('Wreckage recovered', `${totalWreckage}`),
      stat('Crews rescued', `${c.crewRescue.rescued}`, c.crewRescue.rescued > 0 ? 'good' : ''),
      stat('Crews lost', `${c.crewRescue.lost}`, c.crewRescue.lost > 0 ? 'bad' : ''),
    ]),
  );
  if (settlement && settlement.xpEarned > 0) {
    body.append(
      h('div', { className: 'card capacity' }, [
        h('div', { className: 'card-head' }, [icon('star'), h('h3', { text: `Commander XP earned: +${settlement.xpEarned}` })]),
        h('p', {
          text: settlement.regionUnlocked
            ? `New region unlocked: ${REGIONS[settlement.regionUnlocked]?.name ?? settlement.regionUnlocked}.`
            : 'XP survives every defeat — spend it on abilities in the Commander Loadout.',
        }),
      ]),
    );
  }
  body.append(
    h('div', { className: 'card' }, [
      h('div', { className: 'card-head' }, [icon('anchor'), h('h3', { text: victory ? 'The lane holds' : 'The strait remembers' })]),
      h('p', {
        text: victory
          ? 'The fleet and its technology retire with the run — only the Commander carries forward.'
          : `The next attempt at ${region.name} restarts at round 1 — fresh fleet, fresh enemy. ` +
            'Nothing the Commander earned is lost.',
      }),
    ]),
  );
  footer.append(
    h('button', { text: 'Download game log', onClick: () => downloadGameLog(c) }),
    h('button', { className: 'primary', text: 'Return to Command', onClick: onContinue }),
  );
  return root;
}

function stat(label: string, value: string, tone = ''): HTMLElement {
  return h('div', { className: 'stat' }, [
    h('div', { className: 'label', text: label }),
    h('div', { className: `value ${tone}`, text: value }),
  ]);
}
