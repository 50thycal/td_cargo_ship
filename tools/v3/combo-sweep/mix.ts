// What each map throws (docs/design/v3-combo-diversity.md): the threats that
// show on screen, by kind, in waves 1-10 and in the boss rounds, over a few
// seeds of the map's Test Lab card on its production setup (the "you" bot
// drafting for itself, played tough so every wave is seen). Two maps whose
// mixes match ask the same question of a loadout.
//
//   npx vite-node tools/v3/combo-sweep/mix.ts -- [--maps=strait,...] [--seeds=3] [--json=out.json]

import { writeFileSync } from 'node:fs';
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const maps = (opt('maps')?.split(',') ?? ['strait', 'gauntlet', 'harbor', 'kesh', 'marrow', 'island', 'behemoth', 'needle', 'archipelago', 'saltgate']) as MapId[];
const seeds = Number(opt('seeds') ?? 3);

export type Mix = Record<'waves' | 'boss', Record<string, number>>;

/** Threats that showed, by kind, a run (mean over the seeds). */
export function mixOf(map: MapId, nSeeds: number): Mix {
  const out: Mix = { waves: {}, boss: {} };
  for (let s = 0; s < nSeeds; s++) {
    const card = labCard(mapCardId(map, VERSION_DEFAULT))!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
    const run = new BotRun(map, 900 + s, { persona: PERSONAS.you, armory: PLAYER_ARMORY, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
    const g = run.game;
    g.tempo = { ...g.tempo, lossLimit: 999 };
    g.carrierHp = g.stats.carrierHp = 1e6;
    const seen = new Set<number>();
    while (!run.done) {
      run.advance(1);
      if (g.phase !== 'wave') continue;
      for (const th of g.threats) {
        if (seen.has(th.id)) continue;
        seen.add(th.id);
        const part = g.wave >= 11 ? out.boss : out.waves;
        part[th.kind] = (part[th.kind] ?? 0) + 1 / nSeeds;
      }
    }
  }
  return out;
}

if (!process.env.VITEST) {
  const res: Record<string, Mix> = {};
  for (const m of maps) {
    res[m] = mixOf(m, seeds);
    const line = (o: Record<string, number>) => {
      const tot = Object.values(o).reduce((a, b) => a + b, 0);
      return Object.entries(o)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`)
        .join(', ') + ` (${Math.round(tot)})`;
    };
    console.log(`${m}\n  waves 1-10: ${line(res[m].waves)}\n  boss: ${line(res[m].boss)}`);
  }
  const file = opt('json');
  if (file) writeFileSync(file, `${JSON.stringify(res, null, 1)}\n`);
}
