// The rails' stepped controls. Round 16 removed the last vertical slider
// (the ship-flow slider); the speed button (app.ts, speedButton) keeps this
// shape so the rail can set it from code.

export interface StepSlider {
  el: HTMLElement;
  set(step: number): void;
}
