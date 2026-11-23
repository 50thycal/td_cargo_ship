// Upgrade and power-up audit (round 6: "you can just smash and take care of
// everything"). A "smasher" taps every 0.2 s at a random live threat with up
// to 70 px of aim error, grabs pickups, and never prioritises. A card or
// power-up is overpowered when it turns the smasher into a winner: strategy
// stops mattering. The average bot is run alongside for contrast.
//   npm run v2:audit -- [seeds=6] [cards|pickups|loadouts|all] [only=twin,frigate]
//   npm run v2:audit -- 6 combo combo=twin:3,frigate:2,supercharge:2   (held from wave 1)
//   npm run v2:audit -- 6 plan plan=twin,frigate,supercharge          (drafted in that order)
import { FLOW_STEPS, PICKUP_KINDS, PICKUPS, type PickupKind } from '../../src/v2/data/config';
import { MAP_ORDER, type MapId } from '../../src/v2/data/maps';
import { UPGRADES, UPGRADE_ORDER, stats, type UpgradeId } from '../../src/v2/data/upgrades';
import { Bot, SKILLS } from '../../src/v2/sim/bot';
import { makeRng } from '../../src/sim/rng';
import { createGame, pickUpgrade, step, tap, type Game } from '../../src/v2/sim/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seeds = Number(args.find((a) => /^\d+$/.test(a)) ?? 6);
const what = args.find((a) => /^(cards|pickups|loadouts|combo|plan|all)$/.test(a)) ?? 'all';
/** plan=twin,frigate,supercharge — draft normally, wanting these cards first. */
const plan = args.find((a) => a.startsWith('plan='))?.slice(5).split(',') as UpgradeId[] | undefined;
/** combo=twin:3,frigate:2 — one fixed loadout, held all game. */
const combo = args.find((a) => a.startsWith('combo='))?.slice(6);
const DT = 1 / 30;
const FLOW = 2;

/** Hold exactly `levels` all game: drafts are passed through without keeping a card. */
function holdOnly(g: Game, levels: Partial<Record<UpgradeId, number>>): void {
  // Take a throwaway card from an empty loadout (so a full one can't refuse
  // it), then put the loadout under test back.
  const frigate = g.frigate;
  const hp = { carrier: g.carrierHp, ships: g.ships.map((x) => x.hp) };
  g.levels = {};
  g.offer = ['speed'];
  pickUpgrade(g, 'speed');
  g.levels = { ...levels };
  g.stats = stats(g.levels);
  // The throwaway pick must not cost hull or carrier HP (Armored Hulls).
  g.carrierHp = Math.min(g.stats.carrierHp, hp.carrier);
  g.ships.forEach((x, k) => (x.hp = Math.min(g.stats.shipHp, hp.ships[k] ?? x.hp)));
  const st = g.map.frigate;
  g.frigate = levels.frigate ? (frigate ?? { x: st.x, y: st.y, vx: 0, ammo: g.stats.frigateRack, reloadT: 0 }) : null;
}

function smash(g: Game, rng: ReturnType<typeof makeRng>, state: { next: number }): void {
  if (g.t < state.next) return;
  state.next = g.t + 0.2;
  if (g.pickups.length && rng.chance(0.5)) {
    const p = g.pickups[0];
    tap(g, p.x, p.y, 108);
    return;
  }
  const live = g.threats.filter((t) => !t.dead && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900);
  if (!live.length) return;
  const t = rng.pick(live);
  const a = rng.next() * Math.PI * 2;
  const r = rng.next() * 70;
  tap(g, t.x + Math.cos(a) * r, t.y + Math.sin(a) * r, 108);
}

function play(map: MapId, seed: number, player: 'smasher' | 'average', levels: Partial<Record<UpgradeId, number>>): { won: boolean; lost: number } {
  const g = createGame(map, seed);
  g.flow = FLOW;
  holdOnly(g, levels);
  const rng = makeRng(seed * 31 + 7);
  const st = { next: 0 };
  const bot = new Bot({ ...SKILLS.average, prefer: [] }, seed);
  for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'won' && g.phase !== 'lost'; i++) {
    if (g.phase === 'draft') holdOnly(g, levels);
    else if (player === 'smasher') smash(g, rng, st);
    else bot.act(g);
    step(g, DT);
  }
  return { won: g.cleared, lost: g.lost };
}

function cell(player: 'smasher' | 'average', levels: Partial<Record<UpgradeId, number>>): string {
  let won = 0, lost = 0, n = 0;
  for (const map of MAP_ORDER) for (let s = 0; s < seeds; s++) {
    const r = play(map, 4000 + s, player, levels);
    won += r.won ? 1 : 0; lost += r.lost; n++;
  }
  return `${String(won).padStart(2)}/${n} ${(lost / n).toFixed(1).padStart(4)}`;
}

if (what === 'cards' || what === 'all') {
  console.log(`Cards at max level, held alone from wave 1, flow step ${FLOW} of ${FLOW_STEPS.length - 1}, ${seeds} seeds × ${MAP_ORDER.length} maps (clears, avg sunk)`);
  console.log('card          smasher       average');
  const only = args.find((a) => a.startsWith('only='))?.slice(5).split(',');
  for (const id of (['none', ...UPGRADE_ORDER] as (UpgradeId | 'none')[]).filter((c) => !only || only.includes(c))) {
    const levels = id === 'none' ? {} : { [id]: UPGRADES[id].max };
    console.log(`${id.padEnd(12)}  ${cell('smasher', levels)}   ${cell('average', levels)}`);
  }
}
if (what === 'pickups' || what === 'all') {
  console.log(`\nPower-ups: every drop is the one kind (normal drop chance), smasher, no cards`);
  const base = { ...PICKUPS.weights };
  const w = PICKUPS.weights as Record<PickupKind, number>;
  for (const kind of ['default', ...PICKUP_KINDS] as (PickupKind | 'default')[]) {
    for (const k of PICKUP_KINDS) w[k] = kind === 'default' ? base[k] : k === kind ? 1 : 0;
    console.log(`${kind.padEnd(10)}  ${cell('smasher', {})}`);
  }
  Object.assign(w, base);
}

if (what === 'loadouts' || what === 'all') {
  // Real drafting: both players take cards in the same random order of
  // preference per seed; the gap between them is what strategy is worth.
  console.log(`\nNormal drafting, random card preference per seed (clears, avg sunk); strategy is worth the gap`);
  for (const flow of [2, FLOW_STEPS.length - 1]) {
    const row: string[] = [];
    for (const player of ['smasher', 'average'] as const) {
      let won = 0, lost = 0, n = 0;
      for (const map of MAP_ORDER) for (let s = 0; s < seeds; s++) {
        const seed = 4000 + s;
        const prefer = makeRng(seed * 7 + 3).shuffle([...UPGRADE_ORDER]);
        const g = createGame(map, seed);
        g.flow = flow;
        const rng = makeRng(seed * 31 + 7);
        const st = { next: 0 };
        const bot = new Bot({ ...SKILLS.average, prefer }, seed);
        for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'won' && g.phase !== 'lost'; i++) {
          if (g.phase === 'draft' || player === 'average') bot.act(g);
          else smash(g, rng, st);
          step(g, DT);
        }
        won += g.cleared ? 1 : 0; lost += g.lost; n++;
      }
      row.push(`${player} ${String(won).padStart(2)}/${n} ${(lost / n).toFixed(1)}`);
    }
    console.log(`flow ${flow}:  ${row.join('   ')}`);
  }
}

if (what === 'combo' && combo) {
  const levels = Object.fromEntries(combo.split(',').map((p) => [p.split(':')[0], Number(p.split(':')[1])])) as Partial<Record<UpgradeId, number>>;
  console.log(`${combo}:  smasher ${cell('smasher', levels)}   average ${cell('average', levels)}`);
}

if (what === 'plan' && plan) {
  // Both players draft as the game deals, wanting the plan's cards first
  // (the rest in a random order per seed); only how they tap differs.
  const row: string[] = [];
  for (const player of ['smasher', 'average'] as const) {
    let won = 0, lost = 0, n = 0;
    for (const map of MAP_ORDER) for (let s = 0; s < seeds; s++) {
      const seed = 4000 + s;
      const rest = makeRng(seed * 7 + 3).shuffle(UPGRADE_ORDER.filter((c) => !plan.includes(c)));
      const g = createGame(map, seed);
      g.flow = FLOW;
      const rng = makeRng(seed * 31 + 7);
      const st = { next: 0 };
      const bot = new Bot({ ...SKILLS.average, prefer: [...plan, ...rest] }, seed);
      for (let i = 0; i < 60 * 60 * 30 && g.phase !== 'won' && g.phase !== 'lost'; i++) {
        if (g.phase === 'draft' || player === 'average') bot.act(g);
        else smash(g, rng, st);
        step(g, DT);
      }
      won += g.cleared ? 1 : 0; lost += g.lost; n++;
    }
    row.push(`${player} ${String(won).padStart(2)}/${n} ${(lost / n).toFixed(1)}`);
  }
  console.log(`${plan.join('→').padEnd(28)} ${row.join('   ')}`);
}
