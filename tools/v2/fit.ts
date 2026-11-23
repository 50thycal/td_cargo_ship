// Does the watch-mode bot play like the player? Its tapping style next to
// the player's (from their logs), and its results per map (round 9, S1).
//
//   npm run v2:fit -- [--seeds=12] [--maps=strait,gauntlet,island] player-log.json …

import { readFileSync } from 'node:fs';
import type { MapId } from '../../src/v2/data/maps';
import { playMimic } from '../../src/v2/sim/mimic';
import { emptyStyle, printKinds, printStyle, styleOf } from './style';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const seeds = Number(opt('seeds') ?? 12);
const maps = (opt('maps') ?? 'strait,gauntlet,island').split(',') as MapId[];

const you = emptyStyle();
for (const f of args.filter((a) => a.endsWith('.json'))) styleOf(JSON.parse(readFileSync(f, 'utf8')), 'you', you);
if (you.taps) {
  printStyle('you', you);
  printKinds('you', you);
}

const bot = emptyStyle();
for (const map of maps) {
  const waves: number[] = [];
  let won = 0;
  let sunk = 0;
  const mapStyle = emptyStyle();
  for (let s = 0; s < seeds; s++) {
    const { game, log } = playMimic(map, 9000 + s);
    styleOf(log, 'bot', bot);
    styleOf(log, 'bot', mapStyle);
    waves.push(game.wave);
    if (game.phase === 'won') won++;
    sunk += game.lost;
  }
  printStyle(`bot:${map}`, mapStyle);
  const lostAt = waves.filter((_, k) => k >= 0).sort((a, b) => a - b);
  console.log(`           ${map}: cleared ${won}/${seeds}, sunk avg ${(sunk / seeds).toFixed(1)}, waves reached ${lostAt.join(' ')}`);
}
printStyle('bot(all)', bot);
printKinds('bot(all)', bot);
