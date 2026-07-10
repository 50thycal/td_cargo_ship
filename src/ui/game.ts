// Top-level game controller: routes between phases, owns the campaign state,
// and persists at every phase boundary so a reload always resumes cleanly.

import {
  createRoundTransit,
  newCampaign,
  planCurrentRound,
  resolveTransit,
} from '../sim/campaign';
import { clearCampaign, loadCampaign, saveCampaign } from '../platform/save';
import type { CampaignState, TransitState } from '../sim/types';
import { h } from './dom';
import { menuScreen, aarScreen, gameOverScreen, prepScreen, researchScreen } from './screens';
import { TransitView } from './transitView';

export class Game {
  private readonly stage: HTMLElement;
  private campaign: CampaignState | null = null;
  private currentScreen: HTMLElement | null = null;
  /** Kept only for the AAR defensive-summary line; not persisted. */
  private lastTransit: TransitState | null = null;

  constructor(root: HTMLElement) {
    this.stage = h('div', { attrs: { id: 'stage' } });
    root.append(this.stage);
  }

  start(): void {
    this.showMenu();
  }

  private swapScreen(el: HTMLElement | null): void {
    // Preserve scroll position across rerenders (prep/research rebuild the
    // whole screen on every purchase — losing scroll would be brutal on
    // phone-height viewports).
    const oldBody = this.currentScreen?.querySelector('.screen-body');
    const oldScreenId = this.currentScreen?.getAttribute('data-screen');
    const scrollTop = oldBody?.scrollTop ?? 0;
    this.currentScreen?.remove();
    this.currentScreen = el;
    if (el) {
      this.stage.append(el);
      if (scrollTop > 0 && el.getAttribute('data-screen') === oldScreenId) {
        const newBody = el.querySelector('.screen-body');
        if (newBody) newBody.scrollTop = scrollTop;
      }
    }
  }

  private showMenu(): void {
    // A finished campaign still counts as continuable: route() lands on the
    // game-over screen, so the final score isn't lost to a reload.
    const saved = loadCampaign();
    const hasSave = saved !== null;
    this.swapScreen(
      menuScreen(
        hasSave,
        () => {
          clearCampaign();
          this.campaign = newCampaign(`campaign-${Date.now().toString(36)}`);
          saveCampaign(this.campaign);
          this.route();
        },
        () => {
          if (!saved) return;
          this.campaign = saved;
          this.route();
        },
      ),
    );
  }

  /** Send the player to whatever phase the campaign says it is in. */
  private route(): void {
    const c = this.campaign;
    if (!c) return this.showMenu();
    if (c.campaignOver) {
      // Reload during the final report: show it once more before the tally.
      if (c.phase === 'aar' && c.lastReport) return this.showAar();
      return this.showGameOver();
    }
    switch (c.phase) {
      case 'prep':
        return this.showPrep();
      case 'transit':
        return this.startTransit();
      case 'aar':
        return this.showAar();
      case 'research':
        return this.showResearch();
    }
  }

  private showPrep(): void {
    const c = this.campaign!;
    c.phase = 'prep';
    saveCampaign(c);
    this.swapScreen(
      prepScreen(
        c,
        () => {
          c.phase = 'transit';
          saveCampaign(c);
          this.startTransit();
        },
        () => this.showPrep(),
      ),
    );
  }

  private startTransit(): void {
    const c = this.campaign!;
    this.swapScreen(null);
    const plan = planCurrentRound(c);
    const { state, rng } = createRoundTransit(c, plan);
    new TransitView(this.stage, state, rng, c.round, c.confidence, c.round === 1, (finished) => {
      this.lastTransit = finished;
      resolveTransit(c, finished);
      saveCampaign(c);
      this.showAar();
    });
  }

  private showAar(): void {
    const c = this.campaign!;
    const report = c.lastReport;
    if (!report) return this.showPrep();
    this.swapScreen(
      aarScreen(c, report, this.lastTransit, () => {
        if (c.campaignOver) return this.showGameOver();
        c.phase = 'research';
        saveCampaign(c);
        this.showResearch();
      }),
    );
  }

  private showResearch(): void {
    const c = this.campaign!;
    this.swapScreen(
      researchScreen(
        c,
        () => {
          c.phase = 'prep';
          saveCampaign(c);
          this.showPrep();
        },
        () => this.showResearch(),
      ),
    );
  }

  private showGameOver(): void {
    const c = this.campaign!;
    saveCampaign(c);
    this.swapScreen(
      gameOverScreen(c, () => {
        clearCampaign();
        this.campaign = null;
        this.showMenu();
      }),
    );
  }
}
