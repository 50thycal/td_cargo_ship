// How often the report's bot sinks the Dreadnought, pass by pass and boss
// round by boss round (the map's question: sink it, or ride it out?), and
// the hits it put into the hull when it did not. Tuning only.
//   npx vite-node tools/v3/dreadnought/hull.ts -- [--seeds=24] [--from=900] [--armory=player|latest|plating|none]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { VIEW } from '../../../src/v3/data/config';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const n = Number(opt('seeds') ?? 24);
const from = Number(opt('from') ?? 900);
const a = opt('armory') ?? 'player';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const seen: Record<number, number> = {};
const sunk: Record<number, number> = {};
const left: Record<number, number[]> = {};
for (let seed = from; seed < from + n; seed++) {
  const card = labCard(mapCardId('dreadnought', VERSION_DEFAULT))!;
  const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
  const run = new BotRun('dreadnought', seed, { persona: PERSONAS.you, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
  const g = run.game;
  g.tempo = { ...g.tempo, lossLimit: 999 };
  g.carrierHp = g.stats.carrierHp = 1e6;
  const track = new Map<number, { wave: number; hp: number; max: number; x: number }>();
  while (!run.done) {
    run.advance(0.25);
    for (const t of g.threats) if (t.kind === 'dreadnought') track.set(t.id, { wave: g.wave, hp: Math.max(0, t.hp), max: t.maxHp ?? 50, x: t.x });
  }
  // Gone while still on the screen: sunk (a pass that ends steams off it).
  for (const { wave, hp, max, x } of track.values()) {
    seen[wave] = (seen[wave] ?? 0) + 1;
    if (hp <= 0 || (x > 30 && x < VIEW.width - 30)) sunk[wave] = (sunk[wave] ?? 0) + 1;
    else (left[wave] ??= []).push(1 - hp / max);
  }
}
console.log(`dreadnought armory=${a} tough: ${n} seeds from ${from}`);
for (const w of Object.keys(seen).map(Number).sort((x, y) => x - y)) {
  const l = left[w] ?? [];
  console.log(`  ${w <= 10 ? `w${w}` : `B${w - 10}`}: sunk ${Math.round((100 * (sunk[w] ?? 0)) / seen[w])}% of ${seen[w]}; when not, ${l.length ? Math.round((100 * l.reduce((x, y) => x + y, 0)) / l.length) : 0}% of its hull shot away`);
}
