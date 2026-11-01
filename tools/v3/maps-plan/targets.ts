// The plan's tries per map (docs/design/v3-maps-plan.md): 1–2 early, 3–4
// late, never more than about 5. Tools aim each slot's clear rate at 1/tries.
export function targetTries(slot: number): number {
  if (slot <= 2) return 1.1;
  if (slot <= 5) return 1.6;
  if (slot <= 10) return 2.1;
  if (slot <= 15) return 2.7;
  return 3.4;
}
