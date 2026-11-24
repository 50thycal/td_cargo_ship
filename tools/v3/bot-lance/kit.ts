// The gesture weapons on a map card (log v68): the "you" persona with a
// fixed kit held from the start (default: Charge Lance 3 + Laser Cutter 1,
// the kit the player's Battery watch run lost wave 5 with), the older
// bot that only tapped (`gestures: 0`) against the one that holds the Lance
// and swipes the Cutter, on the same seeds.
//   npx vite-node tools/v3/bot-lance/kit.ts -- [--map=battery] [--seeds=48] [--from=900]
//       [--kit=lance:3,cutter:1] [--persona=you] [--armory=latest|player|plating|none]
import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import type { AbilityId } from '../../../src/v3/data/abilities';
import { holdWeapons } from '../../../src/v3/sim/game';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS, type Persona } from '../../../src/v3/sim/mimic';
import { LATEST_ARMORY, PLATING_ARMORY, PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const map = (opt('map') ?? 'battery') as MapId;
const n = Number(opt('seeds') ?? 48);
const from = Number(opt('from') ?? 900);
const kit = (opt('kit') ?? 'lance:3,cutter:1').split(',').map((s) => ({ id: s.split(':')[0] as AbilityId, level: Number(s.split(':')[1] ?? 1) }));
const a = opt('armory') ?? 'latest';
const armory = a === 'latest' ? LATEST_ARMORY : a === 'plating' ? PLATING_ARMORY : a === 'none' ? {} : PLAYER_ARMORY;
const base = PERSONAS[opt('persona') ?? 'you'];

function play(persona: Persona): void {
  let won = 0;
  let lost = 0;
  let wave = 0;
  let presses = 0;
  let fired = 0;
  const lostAt = new Array<number>(14).fill(0);
  for (let seed = from; seed < from + n; seed++) {
    const card = labCard(mapCardId(map, VERSION_DEFAULT))!;
    const plan = labRunPlan(card, defaultSetup(card, parseLabProgress(null)), null);
    const run = new BotRun(map, seed, { persona, armory, lab: plan.lab, ...(plan.convoy ? { convoy: plan.convoy } : {}), ...(plan.encounters ? { encounters: plan.encounters } : {}) });
    holdWeapons(run.game, kit);
    while (!run.done) run.advance(60);
    const g = run.game;
    if (g.cleared) won++;
    else lostAt[Math.min(13, g.wave)]++;
    lost += g.lost;
    wave += g.wave;
    for (const c of run.rec.log.commands) if (c[1] === 'd') presses++;
    fired += g.taps.fire;
  }
  const where = lostAt.map((c, w) => (c ? `w${w}:${c}` : '')).filter(Boolean).join(' ');
  console.log(`${persona.id}${persona.gestures ? ` gestures ${persona.gestures}` : ' taps only'}: won ${won}/${n} (${Math.round((won / n) * 100)}%), ships lost ${(lost / n).toFixed(2)}, mean wave ${(wave / n).toFixed(1)}, presses ${(presses / n).toFixed(1)} a run, shots ${(fired / n).toFixed(0)}; lost at ${where || '-'}`);
}

console.log(`${map} armory=${a} kit=${kit.map((k) => `${k.id}${k.level}`).join('+')}: ${n} seeds from ${from}`);
play({ ...base, gestures: 0 });
play({ ...base, gestures: base.gestures || 0.9 });
