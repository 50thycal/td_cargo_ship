// Round-5 probe: replays a log step by step and measures what the player
// asked about (repair pickups, frigate movement, ships on screen) plus what
// sank ships.
import { readFileSync } from 'node:fs';
import { SHIP } from '../../src/v2/data/config';
import { continueEndless, createGame, pickUpgrade, setFlow, setFormation, step, tap, type Game } from '../../src/v2/sim/game';
import { SIM_DT, type PlayLog } from '../../src/v2/sim/playlog';

const log = JSON.parse(readFileSync(process.argv[2], 'utf8')) as PlayLog;
const g = createGame(log.map, log.seed, log.firstWave);
const cmds = log.commands;
let i = 0;
const picked: Record<string, number> = {};
const dropped: Record<string, number> = {};
let repairShipHp = 0, repairCarrierHp = 0, repairWasted = 0;
let shipsOnScreen = 0, steps = 0, dry = 0, maxShips = 0;
let frigateMoves = 0, frigateDir = 0, frigateDirChanges = 0, frigateTravel = 0, frigateOnStationSteps = 0;
const hullHpLost: number[] = [];
let lastWave = 0;
const perWave: Record<number, { ships: number; steps: number; dry: number; dmgTaken: number; healed: number }> = {};
const sinks: string[] = [];
let prevLost = 0;
const seenPickup = new Set<number>();
for (let guard = 0; guard < 5_000_000; guard++) {
  while (i < cmds.length && cmds[i][0] <= g.steps) {
    const c = cmds[i++];
    if (c[1] === 't') {
      const before = { hp: g.ships.reduce((s, x) => s + x.hp, 0), carrier: g.carrierHp, pk: g.pickups.map((p) => p.kind) };
      const n = g.pickups.length;
      const r = tap(g, c[2], c[3], c[4]);
      if (r === 'pickup') {
        const gone = before.pk.find((k, j) => !g.pickups.some((p) => p.kind === k)) ?? '?';
        // Which kind was collected: the event says.
        const ev = g.events.filter((e) => e.kind === 'pickup').pop() as { pickup: string } | undefined;
        const kind = ev?.pickup ?? gone;
        picked[kind] = (picked[kind] ?? 0) + 1;
        if (kind === 'repair') {
          const dh = g.ships.reduce((s, x) => s + x.hp, 0) - before.hp;
          const dc = g.carrierHp - before.carrier;
          repairShipHp += dh; repairCarrierHp += dc;
          if (dh + dc < 2) repairWasted++;
          perWave[g.wave].healed += dh + dc;
        }
      }
      void n;
    } else if (c[1] === 'f') setFlow(g, c[2]);
    else if (c[1] === 'm') setFormation(g, c[2]);
    else if (c[1] === 'u') pickUpgrade(g, c[2], c[3]);
    else if (c[1] === 'e') continueEndless(g);
  }
  if (g.phase === 'lost' || (i >= cmds.length && g.steps >= (log.summary?.steps ?? 0))) break;
  if (g.phase !== 'wave') { if (i >= cmds.length) break; continue; }
  const hpBefore = new Map(g.ships.map((s) => [s.id, s.hp]));
  const fx0 = g.frigate?.x;
  for (const p of g.pickups) if (!seenPickup.has(p.id)) { seenPickup.add(p.id); dropped[p.kind] = (dropped[p.kind] ?? 0) + 1; }
  step(g, SIM_DT);
  perWave[g.wave] ??= { ships: 0, steps: 0, dry: 0, dmgTaken: 0, healed: 0 };
  const w = perWave[g.wave];
  const vis = g.ships.filter((s) => s.x > 0 && s.x < 1600).length;
  w.ships += vis; w.steps++;
  shipsOnScreen += vis; steps++; maxShips = Math.max(maxShips, vis);
  if (g.ammo < 1 && !(g.frigate && g.frigate.ammo >= 1) && g.overdriveT <= 0) { dry++; w.dry++; }
  for (const s of g.ships) { const b = hpBefore.get(s.id); if (b !== undefined && s.hp < b) w.dmgTaken += b - s.hp; }
  for (const [id, b] of hpBefore) if (!g.ships.some((s) => s.id === id)) { /* left or sunk */ }
  if (g.lost > prevLost) {
    const by = Object.entries(g.sunkBy).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(',');
    sinks.push(`w${g.wave} t${g.waveT.toFixed(1)}s +${g.lost - prevLost} formation=${g.formation} ships=${vis} [${by}] origins=${JSON.stringify(g.origins)}`);
    prevLost = g.lost;
  }
  if (g.frigate && fx0 !== undefined) {
    const dx = g.frigate.x - fx0;
    if (Math.abs(dx) > 1e-6) {
      frigateMoves++; frigateTravel += Math.abs(dx);
      const d = Math.sign(dx);
      if (frigateDir && d !== frigateDir) frigateDirChanges++;
      frigateDir = d;
    }
    if (Math.abs(g.frigate.x - g.map.frigate.x) < 2) frigateOnStationSteps++;
  }
  lastWave = g.wave;
}
console.log(`=== ${log.map} seed ${log.seed}: wave ${g.wave} ${g.phase}, sunk ${g.lost}, carrier ${g.carrierHp}`);
console.log(`ships on screen: avg ${(shipsOnScreen / steps).toFixed(1)}, max ${maxShips}; rack dry ${((100 * dry) / steps).toFixed(0)}% of the time`);
console.log('per wave (avg ships on screen / dry% / ship HP lost / HP healed):');
for (const [k, v] of Object.entries(perWave)) console.log(`  w${k}: ${(v.ships / v.steps).toFixed(1)} ships, dry ${((100 * v.dry) / v.steps).toFixed(0)}%, hull dmg ${v.dmgTaken}, healed ${v.healed}`);
console.log('pickups dropped:', JSON.stringify(dropped));
console.log('pickups collected:', JSON.stringify(picked));
console.log(`repair: ${picked.repair ?? 0} collected, healed ${repairShipHp} ship HP + ${repairCarrierHp} carrier HP (${repairWasted} partly wasted)`);
if (log.map === 'gauntlet' || g.levels.frigate) console.log(`frigate: moved on ${frigateMoves} of ${steps} steps, travelled ${frigateTravel.toFixed(0)} px, reversed direction ${frigateDirChanges} times; at station ${((100 * frigateOnStationSteps) / steps).toFixed(0)}%`);
console.log('sinks:'); for (const s of sinks) console.log('  ' + s);
void SHIP; void lastWave;
