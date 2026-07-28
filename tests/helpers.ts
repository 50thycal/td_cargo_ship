// Shared test fixtures. Not a suite — vitest only collects *.test.ts.

import { ESCORT_DEFAULT_NAMES } from '../src/data/defs';
import type { CampaignState, EscortModuleId } from '../src/sim/types';

/** Commission escorts with explicit loadouts, bypassing cash and research.
 *
 *  Under the old shared-template model a test wrote `c.escorts = 2` and
 *  `c.escortModules = [...]`; every hull got the same fit implicitly. Escorts
 *  are individual now, so the fleet has to be spelled out — one array per
 *  escort. That is more typing but it is also the point: a test that wants two
 *  gun boats and a test that wants a gun boat plus an ASW picket no longer look
 *  identical.
 *
 *  Appends to whatever the campaign already has rather than replacing it. */
export function fitEscorts(c: CampaignState, loadouts: EscortModuleId[][]): void {
  for (const modules of loadouts) {
    const i = c.escortUnits.length;
    c.escortUnits.push({
      id: c.nextEscortId++,
      name: ESCORT_DEFAULT_NAMES[i] ?? `Escort ${i + 1}`,
      modules: [...modules],
      modulePaid: {},
      damage: 0,
    });
  }
}

/** N escorts all carrying the same thing — the direct translation of the old
 *  `escorts = n; escortModules = mods` pair, for tests that genuinely do not
 *  care about differentiation. */
export function fitUniformEscorts(
  c: CampaignState,
  count: number,
  modules: EscortModuleId[] = [],
): void {
  fitEscorts(
    c,
    Array.from({ length: count }, () => modules),
  );
}
