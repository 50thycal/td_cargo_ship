// Probe one bot run on a map: launches by origin, kills and losses by kind.
import { runBot, SKILLS, Bot } from '../../../src/v3/sim/bot';
import { createGame, step } from '../../../src/v3/sim/game';
import type { MapId } from '../../../src/v3/data/maps';
const map = (process.argv[2] ?? 'rigs') as MapId;
const g = createGame(map, 1);
const bot = new Bot(SKILLS.average, 1);
for (let i = 0; i < 30 * 60 * 15 && g.phase !== 'won' && g.phase !== 'lost'; i++) { bot.act(g); step(g, 1 / 30); }
const nz = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v));
console.log(map, g.phase, 'wave', g.wave, 'lost', g.lost, 'delivered', g.delivered);
console.log('origins', g.origins, 'baseDown', g.baseDown.map((d, i) => (d ? i : '')).filter(String).join(','));
console.log('kills', nz(g.kills)); console.log('sunkBy', nz(g.sunkBy)); console.log('carrierBy', nz(g.carrierDamageBy));
void runBot;
