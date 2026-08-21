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
  loadOrCreateProfile,
  loadRun,
  saveProfile,
  saveRun,
} from '../platform/save';
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
} from './screens';
import { TransitView } from './transitView';

/** Dev tools are gated behind an explicit opt-in so they never surface for a
 *  normal player: add `?dev` (or `#dev`) to the URL, or run the Vite dev server.
 *  An existing dev save also keeps the door open. */
function devEnabled(saved: CampaignState | null): boolean {
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
    this.currentScreen?.remove();
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
        devAvailable: devEnabled(saved),
        onDev: () => this.showDev(),
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
        this.profile,
        (opts: DevOptions) => {
          clearRun();
          this.run = newDevCampaign(`dev-${Date.now().toString(36)}`, opts);
          saveRun(this.run);
          this.lastSettlement = null;
          this.route();
        },
        // Same rule as the loadout screen: permanent state is persisted the
        // moment it changes, not when something is launched. No re-render —
        // the toggle repaints itself, and rebuilding the screen under the
        // finger that just tapped it would be a jolt for nothing.
        () => saveProfile(this.profile),
        () => this.showMenu(),
      ),
    );
  }

  /** Save the current run and return to the menu (Save & Quit). */
  private quitToMenu(): void {
    if (this.run) saveRun(this.run);
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
        if (c.campaignOver) {
          // Settle the profile the moment the run ends — before any screen —
          // so a reload can never lose the XP. Idempotent via profileApplied.
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
    // Belt-and-braces: settle the profile even if the run ended before this
    // build (or the transit callback was skipped by a reload).
    const settlement = applyRunToProfile(this.profile, c);
    if (settlement.xpEarned > 0) this.lastSettlement = settlement;
    saveProfile(this.profile);
    saveRun(c);
    this.swapScreen(
      runOverScreen(c, this.lastSettlement, () => {
        // Clearing the RUN save is the whole reset: the profile survives.
        clearRun();
        this.run = null;
        this.lastSettlement = null;
        this.showMenu();
      }),
    );
  }
}
