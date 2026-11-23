// Top-level game controller: routes between phases, owns the Commander
// Profile (permanent) and the active Regional Run (temporary), and persists
// both at every boundary so a reload always resumes cleanly.
//
// The run-start flow the redesign locks in:
//   Main Menu → Region Select → Commander Loadout → Start Run → Preparation
// and within a run: Prep → Transit → After-Action → Technology Draft → Prep.
// Losing or completing a region clears ONLY the run save; the profile is
// settled exactly once per run (applyRunToProfile is idempotent).

import {
  createRoundTransit,
  newDevCampaign,
  newRegionalRun,
  newWorkshopPlaytest,
  planCurrentRound,
  resolveTransit,
  type DevOptions,
} from '../sim/campaign';
import {
  applyRunToProfile,
  recordRunStart,
  sanitizedLoadout,
  sanitizedLegacyLoadout,
  type CommanderProfile,
  type RunSettlement,
} from '../sim/commander';
import {
  clearRun,
  clearWorkshopRun,
  loadOrCreateProfile,
  loadRun,
  loadWorkshopRun,
  saveProfile,
  saveRun,
} from '../platform/save';
import { registerSavedDrafts } from '../platform/workshopStore';
import { closeEditor, workshopScreen, type PlaytestRequest } from './workshop';
import type { RegionId } from '../data/regions';
import type { CampaignState, TransitState } from '../sim/types';
import { h } from './dom';
import {
  menuScreen,
  aarScreen,
  devScreen,
  draftScreen,
  loadoutScreen,
  prepScreen,
  regionSelectScreen,
  runOverScreen,
  settingsScreen,
} from './screens';
import { TransitView } from './transitView';

/** Dev tools are gated behind an explicit opt-in so they never surface for a
 *  normal player: turn Developer mode on in Settings, add `?dev` (or `#dev`) to
 *  the URL, or run the Vite dev server. An existing dev save also keeps the
 *  door open.
 *
 *  Settings is the one that matters on a phone, where getting a query string
 *  onto the URL is a chore. The others are kept because they cost nothing and
 *  desktop habits rely on them. */
function devEnabled(saved: CampaignState | null, profile: CommanderProfile): boolean {
  if (profile.devMode) return true;
  try {
    const url = typeof location !== 'undefined' ? location.href.toLowerCase() : '';
    if (/[?#&]dev\b/.test(url) || url.includes('dev=1')) return true;
  } catch {
    /* no location (tests) */
  }
  const viteDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV;
  return !!viteDev || !!saved?.dev;
}

export class Game {
  private readonly stage: HTMLElement;
  private profile: CommanderProfile;
  private run: CampaignState | null = null;
  private currentScreen: HTMLElement | null = null;
  /** Kept only for the AAR defensive-summary line; not persisted. */
  private lastTransit: TransitState | null = null;
  /** What the just-finished run paid into the profile (for the end screen).
   *  Null after a reload — the XP is already banked, only the recap is lost. */
  private lastSettlement: RunSettlement | null = null;

  constructor(root: HTMLElement) {
    this.stage = h('div', { attrs: { id: 'stage' } });
    root.append(this.stage);
    this.profile = loadOrCreateProfile();
    // Region Workshop drafts are registered at boot so a saved playtest on a
    // custom region still resolves its definition after a reload.
    registerSavedDrafts();
  }

  start(): void {
    this.showMenu();
  }

  private swapScreen(el: HTMLElement | null): void {
    // Preserve scroll position across rerenders (prep/loadout rebuild the
    // whole screen on every purchase — losing scroll would be brutal on
    // phone-height viewports). The prep screen scrolls a section pane
    // (.prep-content) instead of the body; its scroll only carries over when
    // the SAME section is still open (data-section), so switching sections
    // starts at the top.
    const oldBody = this.currentScreen?.querySelector('.screen-body');
    const oldScreenId = this.currentScreen?.getAttribute('data-screen');
    const scrollTop = oldBody?.scrollTop ?? 0;
    const oldPane = this.currentScreen?.querySelector('.prep-content');
    const paneSection = oldPane?.getAttribute('data-section');
    const paneScrollTop = oldPane?.scrollTop ?? 0;
    // The Region Workshop timeline matrix is a wide, tall table with its OWN
    // scroll box (independent of .screen-body) — a designer scrolled deep into
    // later rounds who taps a cell should not be thrown back to round 1. There
    // is only ever one on screen, so it needs no identity check the way
    // .prep-content's section does.
    const oldMatrix = this.currentScreen?.querySelector('.ws-matrix-wrap');
    const matrixScrollLeft = oldMatrix?.scrollLeft ?? 0;
    const matrixScrollTop = oldMatrix?.scrollTop ?? 0;
    // The Inspector drawer scrolls independently too. Preserved only when the
    // SAME thing is still selected (editing a field inside it triggers a
    // rerender) — a genuinely new selection should open at the top of its
    // own content, the same distinction .prep-content's data-section draws.
    const oldDrawer = this.currentScreen?.querySelector('.ws-drawer-content');
    const drawerSelection = oldDrawer?.getAttribute('data-selection');
    const drawerScrollTop = oldDrawer?.scrollTop ?? 0;
    // A screen can already be detached if a change handler re-rendered from
    // inside a removal (a focused input's change fires as it leaves the DOM);
    // `remove()` on a detached node is a no-op, but not on one mid-removal.
    if (this.currentScreen?.isConnected) this.currentScreen.remove();
    this.currentScreen = el;
    if (el) {
      this.stage.append(el);
      if (el.getAttribute('data-screen') === oldScreenId) {
        if (scrollTop > 0) {
          const newBody = el.querySelector('.screen-body');
          if (newBody) newBody.scrollTop = scrollTop;
        }
        if (paneScrollTop > 0) {
          const newPane = el.querySelector('.prep-content');
          if (newPane && newPane.getAttribute('data-section') === paneSection) {
            newPane.scrollTop = paneScrollTop;
          }
        }
        if (matrixScrollLeft > 0 || matrixScrollTop > 0) {
          const newMatrix = el.querySelector('.ws-matrix-wrap');
          if (newMatrix) {
            newMatrix.scrollLeft = matrixScrollLeft;
            newMatrix.scrollTop = matrixScrollTop;
          }
        }
        if (drawerScrollTop > 0) {
          const newDrawer = el.querySelector('.ws-drawer-content');
          if (newDrawer && newDrawer.getAttribute('data-selection') === drawerSelection) {
            newDrawer.scrollTop = drawerScrollTop;
          }
        }
      }
    }
  }

  private showMenu(): void {
    // A finished run still counts as continuable: route() lands on the final
    // report, so the tally isn't lost to a reload.
    const saved = loadRun();
    this.swapScreen(
      menuScreen({
        profile: this.profile,
        saved,
        onNewRun: () => this.showRegionSelect(),
        onContinue: () => {
          if (!saved) return;
          this.run = saved;
          this.route();
        },
        devAvailable: devEnabled(saved, this.profile),
        onDev: () => this.showDev(),
        onSettings: () => this.showSettings(),
      }),
    );
  }

  private showRegionSelect(): void {
    this.swapScreen(
      regionSelectScreen(
        this.profile,
        (regionId) => this.showLoadout(regionId),
        () => this.showMenu(),
      ),
    );
  }

  private showLoadout(regionId: RegionId): void {
    this.swapScreen(
      loadoutScreen(
        this.profile,
        regionId,
        () => this.startRun(regionId),
        () => {
          // Unlocks and loadout edits are PERMANENT state — persist on every
          // change, not just on run start.
          saveProfile(this.profile);
          this.showLoadout(regionId);
        },
        () => this.showRegionSelect(),
      ),
    );
  }

  private startRun(regionId: RegionId): void {
    // Starting a new run replaces any existing one (the menu warns). The
    // profile is never touched by clearing the run — separate saves.
    clearRun();
    saveProfile(this.profile);
    this.run = newRegionalRun(
      `run-${Date.now().toString(36)}`,
      regionId,
      sanitizedLoadout(this.profile),
      sanitizedLegacyLoadout(this.profile),
    );
    recordRunStart(this.profile, regionId);
    saveProfile(this.profile);
    saveRun(this.run);
    this.lastSettlement = null;
    this.route();
  }

  private showDev(): void {
    this.swapScreen(
      devScreen(
        (opts: DevOptions) => {
          clearRun();
          this.run = newDevCampaign(`dev-${Date.now().toString(36)}`, opts);
          saveRun(this.run);
          this.lastSettlement = null;
          this.route();
        },
        () => this.showMenu(),
        () => this.showWorkshop(),
      ),
    );
  }

  /** The Region Workshop — level authoring. Dev-gated like everything else
   *  reachable from Dev Mode and Settings. */
  private showWorkshop(): void {
    const host = {
      onBack: () => {
        closeEditor();
        this.showMenu();
      },
      onPlaytest: (req: PlaytestRequest) => this.startWorkshopPlaytest(req),
      resumable: () => loadWorkshopRun() !== null,
      onResume: () => {
        const saved = loadWorkshopRun();
        if (!saved) return;
        this.run = saved;
        this.route();
      },
      rerender: () => this.showWorkshop(),
    };
    this.swapScreen(workshopScreen(host));
  }

  /** An ISOLATED playtest: its own save slot, no profile settlement, and the
   *  player's campaign run untouched. */
  private startWorkshopPlaytest(req: PlaytestRequest): void {
    clearWorkshopRun();
    this.run = newWorkshopPlaytest(req.seed, req.regionId, {
      round: req.round,
      god: req.god,
      source: req.source,
    });
    saveRun(this.run);
    this.lastSettlement = null;
    this.route();
  }

  private showSettings(): void {
    this.swapScreen(
      settingsScreen(
        this.profile,
        () => {
          // Same rule as the loadout screen: permanent state is persisted the
          // moment it changes. The re-render is load-bearing here — the
          // dev-only rows appear and disappear with the switch above them.
          saveProfile(this.profile);
          this.showSettings();
        },
        () => this.showMenu(),
        () => this.showWorkshop(),
      ),
    );
  }

  /** Save the current run and return to the menu (Save & Quit). A workshop
   *  playtest goes back to the workshop instead. */
  private quitToMenu(): void {
    if (this.run) saveRun(this.run);
    if (this.run?.workshop) return this.showWorkshop();
    this.showMenu();
  }

  /** Send the player to whatever phase the run says it is in. */
  private route(): void {
    const c = this.run;
    if (!c) return this.showMenu();
    if (c.campaignOver) {
      // Reload during the final report: show it once more before the tally.
      if (c.phase === 'aar' && c.lastReport) return this.showAar();
      return this.showRunOver();
    }
    switch (c.phase) {
      case 'prep':
        return this.showPrep();
      case 'transit':
        return this.startTransit();
      case 'aar':
        return this.showAar();
      case 'draft':
        return this.showDraft();
    }
  }

  private showPrep(): void {
    const c = this.run!;
    c.phase = 'prep';
    saveRun(c);
    this.swapScreen(
      prepScreen(
        c,
        () => {
          c.phase = 'transit';
          saveRun(c);
          this.startTransit();
        },
        () => this.showPrep(),
        () => this.quitToMenu(),
      ),
    );
  }

  private startTransit(): void {
    const c = this.run!;
    this.swapScreen(null);
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    new TransitView(
      this.stage,
      state,
      rng,
      c.round,
      c.confidence,
      c.round === 1,
      // The clock's fast-forward rungs follow the same gate as every other dev
      // tool: Settings, `?dev`, the Vite dev server, or an existing dev run.
      devEnabled(c, this.profile),
      c.quota.pointsEarned,
      c.quota.pointsNeeded,
      c.targetPriority,
      (priority) => {
        c.targetPriority = priority; // persisted with the next saveRun
      },
      () => {
        // Straight back to preparation. The campaign has not been touched —
        // resolveTransit is the only thing that mutates it and it has not run —
        // so the fleet, the cash and everything bought are exactly as they were
        // when Begin Transit was pressed. planCurrentRound is derived from the
        // run's seed and round, so the enemy's plan is the SAME plan: this is a
        // second visit to the shop, not a re-roll of the round.
        this.showPrep();
      },
      (finished) => {
        this.lastTransit = finished;
        resolveTransit(c, finished);
        if (c.campaignOver && !c.workshop) {
          // Settle the profile the moment the run ends — before any screen —
          // so a reload can never lose the XP. Idempotent via profileApplied.
          // A workshop playtest never settles: it proves a level, not progress.
          this.lastSettlement = applyRunToProfile(this.profile, c);
          saveProfile(this.profile);
        }
        saveRun(c);
        this.showAar();
      },
    );
  }

  private showAar(): void {
    const c = this.run!;
    const report = c.lastReport;
    if (!report) return this.showPrep();
    this.swapScreen(
      aarScreen(c, report, this.lastTransit, () => {
        if (c.campaignOver) return this.showRunOver();
        c.phase = c.pendingDraft ? 'draft' : 'prep';
        saveRun(c);
        this.route();
      }),
    );
  }

  private showDraft(): void {
    const c = this.run!;
    if (!c.pendingDraft) {
      c.phase = 'prep';
      saveRun(c);
      return this.showPrep();
    }
    this.swapScreen(
      draftScreen(
        c,
        () => {
          saveRun(c);
          // A draft can carry more than one pick. The sim clears pendingDraft
          // when the last one is spent, so "still pending" is the signal to
          // rebuild the table rather than route on — the screen must not decide
          // for itself how many picks a draft was worth.
          if (c.pendingDraft) return this.showDraft();
          this.showPrep();
        },
        () => this.quitToMenu(),
      ),
    );
  }

  private showRunOver(): void {
    const c = this.run!;
    if (!c.workshop) {
      // Belt-and-braces: settle the profile even if the run ended before this
      // build (or the transit callback was skipped by a reload).
      const settlement = applyRunToProfile(this.profile, c);
      if (settlement.xpEarned > 0) this.lastSettlement = settlement;
      saveProfile(this.profile);
    }
    saveRun(c);
    this.swapScreen(
      runOverScreen(c, this.lastSettlement, () => {
        // Clearing the RUN save is the whole reset: the profile survives.
        if (c.workshop) {
          clearWorkshopRun();
          this.run = null;
          this.lastSettlement = null;
          return this.showWorkshop();
        }
        clearRun();
        this.run = null;
        this.lastSettlement = null;
        this.showMenu();
      }),
    );
  }
}
