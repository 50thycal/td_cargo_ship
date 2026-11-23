// A vertical stepped slider built from divs, because a rotated <input range>
// still behaves differently on every mobile browser. Step 0 is at the bottom.
// Drag anywhere on the track or tap a notch.

export interface StepSlider {
  el: HTMLElement;
  set(step: number): void;
}

export function stepSlider(
  steps: number,
  initial: number,
  label: (step: number) => string,
  onChange: (step: number) => void,
): StepSlider {
  const el = document.createElement('div');
  el.className = 'v2-slider';
  const track = document.createElement('div');
  track.className = 'v2-track';
  const fill = document.createElement('div');
  fill.className = 'v2-fill';
  const thumb = document.createElement('div');
  thumb.className = 'v2-thumb';
  track.append(fill);
  for (let i = 0; i < steps; i++) {
    const notch = document.createElement('div');
    notch.className = 'v2-notch';
    notch.style.bottom = `${(i / (steps - 1)) * 100}%`;
    track.append(notch);
  }
  track.append(thumb);
  const value = document.createElement('div');
  value.className = 'v2-slider-value';
  el.append(track, value);

  let current = -1;
  const set = (step: number) => {
    if (step === current) return;
    current = step;
    const pct = (step / (steps - 1)) * 100;
    thumb.style.bottom = `${pct}%`;
    fill.style.height = `${pct}%`;
    value.textContent = label(step);
  };
  set(initial);

  const fromPointer = (e: PointerEvent) => {
    const r = track.getBoundingClientRect();
    const u = 1 - (e.clientY - r.top) / r.height;
    const step = Math.max(0, Math.min(steps - 1, Math.round(u * (steps - 1))));
    if (step !== current) {
      set(step);
      onChange(step);
    }
  };
  track.addEventListener('pointerdown', (e) => {
    track.setPointerCapture(e.pointerId);
    fromPointer(e);
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (track.hasPointerCapture(e.pointerId)) fromPointer(e);
  });
  return { el, set };
}
