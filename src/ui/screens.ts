// Phase screens: menu, after-action report, research, procurement, game over.
// Pure DOM construction — every mutation goes through the campaign helpers so
// nothing here can put the game into an invalid state.

import { ECONOMY } from '../data/tuning';
import {
  FORMATIONS,
  MODULES,
  RESEARCH,
  RESEARCH_BRANCH_NAMES,
  SHIP_CLASSES,
} from '../data/defs';
import {
  buyAmmo,
  buyEscort,
  buyModule,
  buyShip,
  canStartResearch,
  moduleCost,
  repairCost,
  repairFleet,
  setComposition,
  setFormation,
  startResearch,
  totalComposition,
  unlockEcm,
  unlockScan,
} from '../sim/campaign';
import { formatInterceptSummary } from '../sim/aar';
import type {
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

function resourceBar(c: CampaignState): HTMLElement {
  return h('div', { className: 'resource-bar' }, [
    h('span', { className: 'cash', text: `$${c.cash}` }),
    h('span', { className: 'intel', text: `Intel ${c.intel}` }),
    h('span', { className: 'conf', text: `Confidence ${c.confidence}` }),
  ]);
}

function screenShell(
  title: string,
  sub: string,
  c: CampaignState | null,
  screenId: string,
): { root: HTMLElement; body: HTMLElement; footer: HTMLElement } {
  const body = h('div', { className: 'screen-body' });
  const footer = h('div', { className: 'screen-footer' });
  const header = h('div', { className: 'screen-header' }, [
    h('h1', { text: title }),
    h('span', { className: 'sub', text: sub }),
  ]);
  if (c) header.append(resourceBar(c));
  const root = h('div', { className: 'screen', attrs: { 'data-screen': screenId } }, [
    header,
    body,
    footer,
  ]);
  return { root, body, footer };
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

export function menuScreen(
  hasSave: boolean,
  onNew: () => void,
  onContinue: () => void,
): HTMLElement {
  return h('div', { className: 'screen menu', attrs: { 'data-screen': 'menu' } }, [
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
// After-action report
// ---------------------------------------------------------------------------

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
  body.append(
    h('div', { className: 'stat-grid' }, [
      stat('Ships delivered', `${s.delivered}/${s.launched}`, deliveredPct >= 85 ? 'good' : deliveredPct < 60 ? 'bad' : ''),
      stat('Ships lost', `${s.lost}`, s.lost > 0 ? 'bad' : 'good'),
      stat('Cargo value', `${s.valueDelivered}`),
      stat('Cash earned', `+$${report.cashEarned}`, 'good'),
      stat('Intel gained', `+${report.intelEarned}`),
      stat('Confidence', `${report.confidenceAfter} (${report.confidenceChange >= 0 ? '+' : ''}${report.confidenceChange})`,
        report.confidenceChange >= 0 ? 'good' : 'bad'),
    ]),
    h('div', { className: 'card' }, [
      h('h3', { text: 'Defensive summary' }),
      h('p', {
        text: transit
          ? `${formatInterceptSummary(transit)} Interceptors expended: ${s.ammoUsed}.` +
            (s.minesTotal > 0
              ? ` Mines: ${s.minesRevealed}/${s.minesTotal} charted, ${s.minesDetonated} detonated, ${s.minesSwept} swept.`
              : '')
          : 'Transit record unavailable (resumed campaign).',
      }),
    ]),
  );

  if (!report.quota.evaluated) {
    body.append(
      h('div', { className: 'card' }, [
        h('h3', { text: 'Delivery quota' }),
        h('p', {
          text: `${c.quota.pointsEarned}/${c.quota.pointsNeeded} cargo points this period — ${c.quota.roundsLeft} round(s) remaining.`,
        }),
      ]),
    );
  }

  for (const card of report.cards) {
    body.append(
      h('div', { className: `card ${card.kind}` }, [
        h('h3', { text: card.title }),
        h('p', { text: card.body }),
      ]),
    );
  }

  footer.append(
    h('button', {
      className: 'primary',
      text: report.campaignOver ? 'Final Report' : 'Continue to Intelligence & Research',
      onClick: onContinue,
    }),
  );
  return root;
}

function stat(label: string, value: string, tone = ''): HTMLElement {
  return h('div', { className: 'stat' }, [
    h('div', { className: 'label', text: label }),
    h('div', { className: `value ${tone}`, text: value }),
  ]);
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export function researchScreen(c: CampaignState, onContinue: () => void, rerender: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    'Intelligence & Research',
    'One project at a time; results arrive after the next transit',
    c,
    'research',
  );

  if (c.activeResearch) {
    body.append(
      h('div', { className: 'card research' }, [
        h('h3', { text: `In progress: ${RESEARCH[c.activeResearch.id].name}` }),
        h('p', { text: 'The lab will deliver after the next transit. Choose wisely what the convoy must survive until then.' }),
      ]),
    );
  }

  const branches = new Map<ResearchBranch, ResearchId[]>();
  for (const id of Object.keys(RESEARCH) as ResearchId[]) {
    const branch = RESEARCH[id].branch;
    if (!branches.has(branch)) branches.set(branch, []);
    branches.get(branch)!.push(id);
  }

  const grid = h('div', { className: 'grid-2' });
  for (const [branch, ids] of branches) {
    const panel = h('div', { className: 'panel' }, [
      h('h2', { text: RESEARCH_BRANCH_NAMES[branch] ?? branch }),
    ]);
    for (const id of ids) {
      const def = RESEARCH[id];
      const done = c.completedResearch.includes(id);
      const active = c.activeResearch?.id === id;
      const check = canStartResearch(c, id);
      const classes = ['card', 'research-item'];
      if (done) classes.push('done');
      if (active) classes.push('active-project');
      const item = h('div', { className: classes.join(' ') }, [
        h('h3', { text: `${def.name} — ${done ? 'complete' : active ? 'in progress' : `${def.cost} intel`}` }),
        h('p', { text: def.desc }),
      ]);
      if (!done && !active) {
        item.append(
          h('button', {
            text: check.ok ? 'Begin research' : check.reason ?? 'Unavailable',
            disabled: !check.ok,
            onClick: () => {
              if (startResearch(c, id)) rerender();
            },
          }),
        );
      }
      panel.append(item);
    }
    grid.append(panel);
  }
  body.append(grid);

  footer.append(
    h('button', { className: 'primary', text: 'Continue to Preparation', onClick: onContinue }),
  );
  return root;
}

// ---------------------------------------------------------------------------
// Procurement / preparation
// ---------------------------------------------------------------------------

export function prepScreen(c: CampaignState, onLaunch: () => void, rerender: () => void): HTMLElement {
  const { root, body, footer } = screenShell(
    `Preparation — Round ${c.round}`,
    `Convoy capacity ${totalComposition(c)}/${c.capacity} · Quota ${c.quota.pointsEarned}/${c.quota.pointsNeeded} (${c.quota.roundsLeft} rounds left)`,
    c,
    'prep',
  );

  // --- Convoy composition -----------------------------------------------------
  const compPanel = h('div', { className: 'panel' }, [h('h2', { text: 'Convoy composition' })]);
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const def = SHIP_CLASSES[classId];
    const row = h('div', { className: 'row' }, [
      h('div', { className: 'grow' }, [
        h('div', { className: 'name', text: `${def.name} — value ${def.value}` }),
        h('div', {
          className: 'hint',
          text: `${def.hp} hull · speed ${def.speed} · ${def.slots} module slots · owned ${c.fleet[classId]}`,
        }),
      ]),
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
        text: `Buy hull $${def.replaceCost}`,
        disabled: c.cash < def.replaceCost,
        onClick: () => {
          if (buyShip(c, classId)) rerender();
        },
      }),
    ]);
    compPanel.append(row);
  }

  // --- Formation -----------------------------------------------------------------
  const formPanel = h('div', { className: 'panel' }, [h('h2', { text: 'Formation' })]);
  for (const id of Object.keys(FORMATIONS) as FormationId[]) {
    const def = FORMATIONS[id];
    formPanel.append(
      h('div', { className: 'row' }, [
        h('button', {
          className: c.formation === id ? 'selected' : '',
          text: def.name,
          onClick: () => {
            setFormation(c, id);
            rerender();
          },
        }),
        h('div', { className: 'hint grow', text: def.desc }),
      ]),
    );
  }

  // --- Ship modules -----------------------------------------------------------------
  const modPanel = h('div', { className: 'panel' }, [h('h2', { text: 'Ship modules (equip a whole class)' })]);
  for (const classId of Object.keys(SHIP_CLASSES) as ShipClassId[]) {
    const def = SHIP_CLASSES[classId];
    const owned = c.classModules[classId];
    const slotRow = h('div', { className: 'row' }, [
      h('div', {
        className: 'name grow',
        text: `${def.name} — ${owned.length}/${def.slots} slots used`,
      }),
    ]);
    modPanel.append(slotRow);
    const btnRow = h('div', { className: 'row' });
    for (const moduleId of Object.keys(MODULES) as ModuleId[]) {
      const mod = MODULES[moduleId];
      const isOwned = owned.includes(moduleId);
      const cost = moduleCost(c, classId, moduleId);
      const full = owned.length >= def.slots;
      btnRow.append(
        h('button', {
          className: isOwned ? 'selected' : '',
          text: isOwned ? `${mod.name} ✓` : `${mod.name} $${cost}`,
          disabled: isOwned || full || c.cash < cost,
          onClick: () => {
            if (buyModule(c, classId, moduleId)) rerender();
          },
        }),
      );
    }
    modPanel.append(btnRow);
  }
  modPanel.append(
    h('div', {
      className: 'hint',
      text: 'Module descriptions: ' + Object.values(MODULES).map((m) => `${m.name}: ${m.desc}`).join(' '),
    }),
  );

  // --- Convoy-wide assets -----------------------------------------------------------
  const assetPanel = h('div', { className: 'panel' }, [h('h2', { text: 'Convoy-wide assets' })]);
  assetPanel.append(
    h('div', { className: 'row' }, [
      h('div', { className: 'name grow', text: `Interceptor ammunition: ${c.ammo}` }),
      h('button', {
        text: `Buy 5 for $${ECONOMY.ammoCost * 5}`,
        disabled: c.cash < ECONOMY.ammoCost * 5,
        onClick: () => {
          if (buyAmmo(c, 5)) rerender();
        },
      }),
    ]),
    h('div', { className: 'row' }, [
      h('div', { className: 'name grow', text: `Escort ships: ${c.escorts}/${ECONOMY.maxEscorts} (each adds a launcher)` }),
      h('button', {
        text: `Hire escort $${ECONOMY.escortCost}`,
        disabled: c.escorts >= ECONOMY.maxEscorts || c.cash < ECONOMY.escortCost,
        onClick: () => {
          if (buyEscort(c)) rerender();
        },
      }),
    ]),
    h('div', { className: 'row' }, [
      h('div', {
        className: 'name grow',
        text: `ECM suite: ${c.ecmUnlocked ? `owned (${'2'} bursts/round, scrambles guided seekers)` : 'not installed'}`,
      }),
      h('button', {
        text: c.ecmUnlocked ? 'Installed ✓' : `Install $${ECONOMY.ecmUnlockCost}`,
        disabled: c.ecmUnlocked || c.cash < ECONOMY.ecmUnlockCost,
        onClick: () => {
          if (unlockEcm(c)) rerender();
        },
      }),
    ]),
    h('div', { className: 'row' }, [
      h('div', {
        className: 'name grow',
        text: `Scanning array: ${c.scanUnlocked ? 'owned (2 pulses/round, charts mines ahead)' : 'not installed'}`,
      }),
      h('button', {
        text: c.scanUnlocked ? 'Installed ✓' : `Install $${ECONOMY.scanUnlockCost}`,
        disabled: c.scanUnlocked || c.cash < ECONOMY.scanUnlockCost,
        onClick: () => {
          if (unlockScan(c)) rerender();
        },
      }),
    ]),
  );

  const repair = repairCost(c);
  assetPanel.append(
    h('div', { className: 'row' }, [
      h('div', {
        className: 'name grow',
        text: repair > 0 ? `Fleet damage: ${c.pendingDamage} hull points unrepaired` : 'Fleet fully repaired',
      }),
      h('button', {
        text: repair > 0 ? `Repair all $${repair}` : 'No repairs needed',
        disabled: repair <= 0 || c.cash < repair,
        onClick: () => {
          if (repairFleet(c)) rerender();
        },
      }),
    ]),
  );

  body.append(h('div', { className: 'grid-2' }, [compPanel, formPanel]), modPanel, assetPanel);

  const canLaunch = totalComposition(c) > 0;
  footer.append(
    h('div', {
      className: 'hint',
      text: canLaunch ? `${totalComposition(c)} ships will sail.` : 'Assign at least one ship to the convoy.',
    }),
    h('button', { className: 'primary', text: 'Begin Transit', disabled: !canLaunch, onClick: onLaunch }),
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
      h('h3', { text: 'The strait remembers' }),
      h('p', {
        text:
          'Confidence in the operation collapsed and the shipping lanes closed. ' +
          'The enemy doctrine you faced was shaped by every convoy you ran — a different ' +
          'campaign will breed a different predator.',
      }),
    ]),
  );
  footer.append(h('button', { className: 'primary', text: 'New Campaign', onClick: onNewCampaign }));
  return root;
}
