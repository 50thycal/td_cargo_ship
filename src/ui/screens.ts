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

import { COMMANDER, ECONOMY } from '../data/tuning';
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
  CATEGORY_ORDER,
  COUNTER_BRANCHES,
  COUNTER_CATEGORY_NAMES,
  awaitingEnemyCapability,
  ENEMY_BRANCH_NAMES,
  RESEARCH_INDEX,
  type CounterBranchDef,
  type CounterBranchId,
  type CounterNodeDef,
  type CounterRole,
  type CounterTacticDef,
  type PlatformKind,
  type TacticKind,
} from '../data/counters';
import {
  ammoUnitCost,
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
  totalComposition,
  totalPendingDamage,
  unlockWarthog,
  unlockHardened,
  unlockScan,
  unlockSmoke,
  unlockSonar,
  escortSlots,
  renameEscort,
} from '../sim/campaign';
import { draftOptionInfo, selectDraftOption, dismissEmptyDraft } from '../sim/draft';
import {
  loadoutBlockReason,
  setLoadout,
  unlockAbility,
  unlockBlockReason,
  regionUnlocked,
  type CommanderProfile,
  type RunSettlement,
} from '../sim/commander';
import {
  COMMANDER_ABILITIES,
  COMMANDER_ABILITY_ORDER,
  loadoutPointsUsed,
} from '../data/commanderAbilities';
import { REGIONS, REGION_ORDER, regionDef, type RegionId } from '../data/regions';
import { ENEMY_BRANCHES } from '../data/enemyBranches';
import { formatInterceptSummary } from '../sim/aar';
import { downloadGameLog } from './download';
import {
  formationFigure,
  icon,
  shipFigure,
  SHIP_TINTS,
  statTierRow,
  type IconName,
} from './icons';
import type {
  AarCard,
  AarCardKind,
  AfterActionReport,
  CampaignState,
  FormationId,
  ModuleId,
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
  return h('div', { className: 'resource-bar' }, [
    h('span', { className: 'res-chip cash' }, [icon('coin'), h('span', { text: `$${c.cash}` })]),
    h('span', { className: 'res-chip conf', attrs: { title: 'Confidence — the run ends if it reaches zero' } }, [
      icon('star'),
      h('span', { text: `${c.confidence}` }),
    ]),
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

  for (const id of REGION_ORDER) {
    const region = REGIONS[id];
    const unlocked = regionUnlocked(profile, id);
    const rec = profile.records[id];
    const threatNames = region.enemyBranches
      .filter((k) => ENEMY_BRANCHES[k].implemented)
      .map((k) => ENEMY_BRANCH_NAMES[k])
      .join(', ');
    const tags = h('div', { className: 'chip-row' }, [
      chip('alert', threatNames || 'No threats', 'Enemy branches this region can field'),
      chip('anchor', `Secure R${region.completionRound}`, 'Surviving this round completes the region'),
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
      h('div', { className: 'hint', text: unlocked ? region.tagline : 'Complete the previous region to unlock.' }),
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
// Commander Ability loadout — the bounded pre-run build
// ---------------------------------------------------------------------------

export function loadoutScreen(
  profile: CommanderProfile,
  regionId: RegionId,
  onStart: () => void,
  rerender: () => void,
  onBack: () => void,
): HTMLElement {
  const region = regionDef(regionId);
  const { root, body, footer } = screenShell(
    'Commander Loadout',
    `${region.name} — ${COMMANDER.abilitySlots} slots · ${COMMANDER.loadoutPoints} pts`,
    null,
    'loadout',
  );

  const used = loadoutPointsUsed(profile.loadout);
  body.append(
    h('div', { className: 'card' }, [
      h('div', { className: 'card-head' }, [icon('star'), h('h3', { text: 'Commander' })]),
      h('div', { className: 'chip-row' }, [
        chip('intel', `${profile.xp} XP`, 'Commander XP unlocks new abilities'),
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
    const unlocked = profile.unlockedAbilities.includes(id);
    const equipped = profile.loadout.includes(id);
    const rows: HTMLElement[] = [
      h('div', { className: 'card-head' }, [
        icon(unlocked ? (equipped ? 'check' : 'star') : 'lock'),
        h('h3', { text: def.name }),
      ]),
      h('p', { text: def.desc }),
      h('div', { className: 'chip-row' }, [
        chip('coin', `${def.points} points`, 'Loadout points this ability consumes'),
        ...(unlocked ? [] : [chip('intel', `${def.xpCost} XP to unlock`)]),
      ]),
    ];
    if (unlocked) {
      const next = equipped
        ? profile.loadout.filter((a) => a !== id)
        : [...profile.loadout, id];
      const block = equipped ? null : loadoutBlockReason(profile, next);
      rows.push(
        h('button', {
          className: equipped ? '' : 'primary',
          text: equipped ? 'Unequip' : (block ?? 'Equip'),
          disabled: !equipped && block !== null,
          onClick: () => {
            if (setLoadout(profile, next)) rerender();
          },
        }),
      );
    } else {
      const block = unlockBlockReason(profile, id);
      rows.push(
        h('button', {
          className: 'primary',
          text: block === null ? `Unlock — ${def.xpCost} XP` : block,
          disabled: block !== null,
          onClick: () => {
            if (unlockAbility(profile, id)) rerender();
          },
        }),
      );
    }
    body.append(h('div', { className: unlocked ? 'card' : 'card locked' }, rows));
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
  warthog: 'planeGun',
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
function effectRows(def: CounterNodeDef): HTMLElement | null {
  const rows: HTMLElement[] = [];
  for (const s of def.set ?? []) rows.push(statTierRow(s.stat, s.tier));
  for (const [k, v] of Object.entries(def.grant ?? {})) {
    rows.push(chip('ammo', `${GRANT_LABELS[k] ?? k} ×${v}`));
  }
  if (rows.length === 0) return null;
  return h('div', { className: 'effect-rows' }, rows);
}

function branchTagRow(c: CampaignState, branch: CounterBranchDef): HTMLElement {
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
        (eq.id === 'smoke' && c.smokeUnlocked) ||
        (eq.id === 'hardened' && c.hardenedUnlocked);
      label = 'convoy asset';
    } else {
      fitted = eq.id === 'escort' ? c.escortUnits.length > 0 : c.bases > 0;
      label = 'built-in launcher';
    }
    tags.append(chip(fitted ? 'check' : 'lock', fitted ? `${label} ✓` : `${label} — buy in prep`,
      fitted ? 'Equipment installed' : 'Research is ready; the hardware must be bought in Preparation'));
  }
  return tags;
}

/** The technology a run currently holds, grouped by category — the read-only
 *  build overview shown beneath the draft. Replaces the old browsable tech
 *  tree: there is nothing to buy here any more, only what the drafts built. */
function ownedTechSummary(c: CampaignState): HTMLElement {
  const wrap = h('div', { className: 'card' }, [
    h('div', { className: 'card-head' }, [icon('check'), h('h3', { text: 'Technology held this run' })]),
  ]);
  const owned = c.completedResearch.filter((id) => RESEARCH_INDEX[id]);
  if (owned.length === 0) {
    wrap.append(h('p', { className: 'hint', text: 'Nothing drafted yet.' }));
    return wrap;
  }
  for (const category of CATEGORY_ORDER) {
    const inCategory = owned.filter((id) => RESEARCH_INDEX[id].branch.category === category);
    if (inCategory.length === 0) continue;
    const row = h('div', { className: 'chip-row' });
    for (const id of inCategory) {
      const entry = RESEARCH_INDEX[id];
      row.append(chip(BRANCH_ICONS[entry.branch.id], entry.def.name, entry.def.desc));
    }
    wrap.append(
      h('div', { className: 'hint', text: COUNTER_CATEGORY_NAMES[category] }),
      row,
    );
  }
  return wrap;
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
    'Pick one — it activates immediately',
    c,
    'draft',
  );

  if (!draft) {
    // Defensive: routed here without a pending draft — let the player through.
    body.append(h('p', { className: 'hint', text: 'No draft is pending.' }));
    footer.append(h('button', { className: 'primary', text: 'Continue to Preparation', onClick: onPicked }));
    return root;
  }

  body.append(
    h('div', { className: 'chip-row' }, [
      draft.recoveredUnits > 0
        ? chip(
            'crate',
            `Salvage ×${draft.recoveredUnits} — draft widened`,
            'Recovered wreckage widens the draft and aims it at the threats it came from',
          )
        : chip('crate', 'No salvage — base draft', 'Recovering wreckage widens future drafts'),
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
  for (const id of draft.options) {
    const entry = RESEARCH_INDEX[id];
    const info = draftOptionInfo(id);
    if (!entry || !info) continue;
    const def = entry.def;
    const branch = entry.branch;
    const bits: HTMLElement[] = [
      h('div', { className: 'card-head' }, [
        icon(BRANCH_ICONS[branch.id]),
        h('h3', { text: def.name }),
      ]),
      h('div', {
        className: 'role-line',
        text:
          `${branch.name} · ${PLATFORM_LABELS[branch.platform]} · ` +
          (entry.isTactic ? TACTIC_KIND_LABELS[(def as CounterTacticDef).kind] : 'Hardware'),
      }),
      h('p', { text: def.desc }),
    ];
    const effects = effectRows(def);
    if (effects) bits.push(effects);
    bits.push(branchTagRow(c, branch));
    bits.push(
      h('button', {
        className: 'primary',
        text: `Draft ${def.name}`,
        onClick: () => {
          if (selectDraftOption(c, id)) onPicked();
        },
      }),
    );
    optionRow.append(h('div', { className: 'card draft-option' }, bits));
  }
  body.append(optionRow, ownedTechSummary(c));

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
        progressBar(
          c.quota.pointsNeeded > 0 ? c.quota.pointsEarned / c.quota.pointsNeeded : 0,
          qs.met ? 'good' : 'warn',
        ),
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
    else if (block.startsWith('Requires technology')) buyLabel = block;
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
        `Fits every ${activeDef.name} (${Math.max(1, c.fleet[activeClass])} hull(s)); price scales with the fleet. ` +
        'Slots are limited — unequip refunds in full.',
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
    const roster = h('div', { className: 'escort-roster' });
    for (const unit of c.escortUnits) {
      const isSel = unit.id === selected.id;
      const fit =
        unit.modules.length > 0
          ? unit.modules.map((m) => ESCORT_MODULES[m].name.split(' ')[0]).join(' + ')
          : 'no specialists';
      roster.append(
        h('button', {
          className: isSel ? 'escort-tab selected' : 'escort-tab',
          onClick: () => {
            prepEscortId = unit.id;
            rerender();
          },
        }, [
          h('div', { className: 'escort-tab-name', text: unit.name }),
          h('div', { className: 'escort-tab-fit', text: `interceptors + ${fit}` }),
          h('div', {
            className: 'escort-tab-slots',
            text: `${unit.modules.length}/${slotCount} slots${unit.damage > 0 ? ` · ${Math.round(unit.damage)} dmg` : ''}`,
          }),
        ]),
      );
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
          icon('turret'),
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
      const def = ESCORT_MODULES[id];
      const fitted = selected.modules.includes(id);
      const block = escortModuleBlockReason(c, selected.id, id);
      const refund = selected.modulePaid[id] ?? def.cost;
      const branch = branchForEquipment('escortModule', id);
      // How many OTHER escorts already carry this, so the player can see the
      // shape of the flotilla without clicking through every ship.
      const elsewhere = c.escortUnits.filter((u) => u.id !== selected.id && u.modules.includes(id)).length;
      escortGrid.append(
        h('div', { className: fitted ? 'module-card owned' : 'module-card' }, [
          h('div', { className: 'card-head' }, [
            icon(branch ? BRANCH_ICONS[branch.id] : 'turret'),
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
          fitted
            ? h('button', {
                className: 'unequip',
                text: `Remove from ${selected.name} — refund $${refund}`,
                onClick: () => {
                  if (removeEscortModule(c, selected.id, id)) rerender();
                },
              })
            : h('button', {
                text: block === null ? `Fit to ${selected.name} — $${def.cost}` : block,
                disabled: block !== null,
                onClick: () => {
                  if (buyEscortModule(c, selected.id, id)) rerender();
                },
              }),
        ]),
      );
    }
    escortPanel.append(escortGrid);
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
      'missile',
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
        label: `Buy 5 — $${ammoUnitCost(c) * 5}`,
        disabled: c.cash < ammoUnitCost(c) * 5,
        onClick: () => {
          if (buyAmmo(c, 5)) rerender();
        },
      },
    ),
    assetCard(
      'planeGun',
      'A-10 Warthog',
      c.warthogUnlocked ? 'owned' : '—',
      'Wheels over a chosen spot, gunning mines and boats beneath it. Nothing airborne or underwater.',
      c.warthogUnlocked
        ? null
        : {
            label: `Commission — $${ECONOMY.warthogUnlockCost}`,
            disabled: c.cash < ECONOMY.warthogUnlockCost,
            onClick: () => {
              if (unlockWarthog(c)) rerender();
            },
          },
    ),
    assetCard(
      'planeScan',
      'Scan aircraft',
      c.scanUnlocked ? 'owned' : '—',
      'Sweeps one lane, charting its mines. Ships steer around charted mines.',
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
        'Placed ping that reveals torpedoes in an area. Depth charges do the killing.',
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
        'Defensive smoke',
        c.smokeUnlocked ? 'owned' : '—',
        'Placed cloud that dulls enemy targeting for ships inside. Destroys nothing.',
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
        'Hardened systems',
        c.hardenedUnlocked ? 'owned' : '—',
        'Shortens jamming blackouts and keeps chosen sensors partially alive through them.',
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
        'ammo',
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

  const repair = repairCost(c);
  const totalDamage = totalPendingDamage(c);
  assetGrid.append(
    assetCard(
      'wrench',
      'Fleet repairs',
      totalDamage > 0 ? `${totalDamage} hp` : '✓',
      totalDamage > 0
        ? 'Unrepaired damage sails with the next convoy.'
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
      h('div', {
        className: 'hint',
        text: `Protected channel${capacity > 1 ? 's' : ''} (${c.protectedChannels.length}/${capacity}) — stays partially alive through jamming:`,
      }),
      row,
    );
  }

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
      els: [briefStrip, h('div', { className: 'grid-2' }, [compPanel, formPanel])],
    },
    { id: 'modules', label: 'Modules', ic: 'slots', els: [modPanel] },
    { id: 'fleet', label: 'Fleet', ic: 'missile', els: [fleetPanel, escortPanel, basePanel] },
    { id: 'assets', label: 'Support', ic: 'crate', els: [assetPanel] },
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
        ? `${totalComposition(c)} ship(s) ready`
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
