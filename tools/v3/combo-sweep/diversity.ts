// ARE THE BEST KITS DIFFERENT ON EACH MAP? (docs/design/v3-combo-diversity.md)
//
// The player: "Main action item here is to see if there is diversity of best
// combos per the maps. If one combo is the top for all maps, then that
// suggests our design for the maps and waves are all the same."
//
// The combo sweep's triples stage extends the best pairs over all maps
// together, so it can only find kits that are good everywhere. This picks
// each map's own: per map, its `--top` best pairs (from the pairs stage)
// with each third weapon its chapter's draft deals, screened on `--seeds`
// seeds of that map alone; then the map's `--confirm` best triples again on
// `--confirm-seeds` seeds. Then the overlap between maps:
//   - Jaccard of the maps' top-5 kits, and the same split-half on one map
//     (the confirm seeds in two halves: how much two top-5s agree on the
//     SAME map, from noise alone);
//   - Spearman rank correlation of the singles (weapons alone);
//   - the share of maps whose #1 kit, #1 weapon alone, are the same.
//
//   npx vite-node tools/v3/combo-sweep/diversity.ts -- \
//     --dirs=tools/v3/combo-sweep/results/v31,tools/v3/combo-sweep/results/v31-ch2 \
//     [--maps=strait,...] [--top=6] [--seeds=6] [--confirm=10] [--confirm-seeds=16] [--json=out.json]
//
// Every run is the sweep's (play.ts, the "you" bot, the player's Armory,
// seeds 900..), cached with the sweep's runs.

import { readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { ABILITIES, ABILITY_ORDER, type AbilityId } from '../../../src/v3/data/abilities';
import { MAPS, type MapId } from '../../../src/v3/data/maps';
import { LOG_VERSION } from '../../../src/v3/sim/playlog';
import { BOT_REV } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';
import type { ComboJob, ComboRun } from './play';
import { runJobs } from './pool';
import { summarize, type Summary } from './stats';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const CACHE = `tools/v3/combo-sweep/results/cache/v${LOG_VERSION}-bot${BOT_REV}.jsonl`;
const procs = Number(opt('procs') ?? availableParallelism());
const top = Number(opt('top') ?? 6);
const screenSeeds = Array.from({ length: Number(opt('seeds') ?? 6) }, (_, k) => 900 + k);
const nConfirm = Number(opt('confirm') ?? 10);
const confirmSeeds = Array.from({ length: Number(opt('confirm-seeds') ?? 16) }, (_, k) => 900 + k);
const persona = opt('persona') ?? 'you';
const UNMEASURED: AbilityId[] = ['cutter'];

interface Cfg {
  key: string;
  kind: string;
  weapons?: AbilityId[];
  perMap: Partial<Record<MapId, Summary>>;
}
interface Stage {
  maps: MapId[];
  pool: AbilityId[];
  configs: Cfg[];
}

const canon = (ws: AbilityId[]) => [...ws].sort((a, b) => ABILITY_ORDER.indexOf(a) - ABILITY_ORDER.indexOf(b));
const name = (ws: AbilityId[]) => ws.map((w) => ABILITIES[w].name).join(' + ');
const keyOf = (ws: AbilityId[]) => canon(ws).join('+');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Each map's pairs and singles, from whichever folder swept it. */
function load(dirs: string[]): { maps: MapId[]; pool: Record<string, AbilityId[]>; pairs: Record<string, Cfg[]>; singles: Record<string, Cfg[]> } {
  const out = { maps: [] as MapId[], pool: {} as Record<string, AbilityId[]>, pairs: {} as Record<string, Cfg[]>, singles: {} as Record<string, Cfg[]> };
  for (const d of dirs) {
    const pairs = JSON.parse(readFileSync(`${d}/pairs.json`, 'utf8')) as Stage;
    const singles = JSON.parse(readFileSync(`${d}/singles.json`, 'utf8')) as Stage;
    for (const m of pairs.maps) {
      out.maps.push(m);
      out.pool[m] = pairs.pool.filter((w) => !UNMEASURED.includes(w));
      out.pairs[m] = pairs.configs.filter((c) => c.kind === 'pair');
      out.singles[m] = singles.configs.filter((c) => c.kind === 'single' || c.kind === 'plain' || c.kind === 'self');
    }
  }
  return out;
}

const job = (m: MapId, seed: number, ws: AbilityId[]): ComboJob => ({ map: m, seed, armory: PLAYER_ARMORY, loadout: canon(ws), ...(persona !== 'you' ? { persona } : {}) });

async function playOn(m: MapId, kits: AbilityId[][], seeds: number[], label: string): Promise<{ ws: AbilityId[]; runs: ComboRun[]; s: Summary }[]> {
  const jobs = kits.flatMap((ws) => seeds.map((sd) => job(m, sd, ws)));
  const runs = await runJobs(jobs, CACHE, { procs, label });
  return kits.map((ws, k) => {
    const rs = runs.slice(k * seeds.length, (k + 1) * seeds.length);
    return { ws: canon(ws), runs: rs, s: summarize(rs) };
  });
}

/** Spearman's rank correlation of two score lists (lower = better; ties averaged). */
export function spearman(a: number[], b: number[]): number {
  const rank = (xs: number[]) => {
    const idx = xs.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(xs.length);
    for (let i = 0; i < idx.length; ) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

export const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter);
};

async function main(): Promise<void> {
  const dirs = (opt('dirs') ?? 'tools/v3/combo-sweep/results').split(',');
  const src = load(dirs);
  const maps = (opt('maps')?.split(',') as MapId[] | undefined) ?? src.maps;
  const result: Record<string, unknown> = { about: 'Each map\'s own best kits (tools/v3/combo-sweep/diversity.ts).', logVersion: LOG_VERSION, botRev: BOT_REV, persona, top, screenSeeds: screenSeeds.length, confirmSeeds: confirmSeeds.length, maps: {} };
  const best: Record<string, { key: string; name: string; lostAll: number; won: number; lost10: number; boss: number; se: number; halves: [number, number] }[]> = {};
  for (const m of maps) {
    const pool = src.pool[m];
    const pairs = [...src.pairs[m]].sort((a, b) => a.perMap[m]!.lostAll - b.perMap[m]!.lostAll).slice(0, top);
    const seen = new Set<string>();
    const kits: AbilityId[][] = [];
    for (const p of pairs)
      for (const w of pool) {
        if (p.weapons!.includes(w)) continue;
        const k = keyOf([...p.weapons!, w]);
        if (seen.has(k)) continue;
        seen.add(k);
        kits.push(canon([...p.weapons!, w]));
      }
    console.log(`${MAPS[m].name}: best pairs ${pairs.map((p) => name(p.weapons!)).join('; ')}; ${kits.length} triples`);
    const screen = await playOn(m, kits, screenSeeds, `${m} screen`);
    screen.sort((a, b) => a.s.lostAll - b.s.lostAll || b.s.won - a.s.won);
    const conf = await playOn(
      m,
      screen.slice(0, nConfirm).map((x) => x.ws),
      confirmSeeds,
      `${m} confirm`,
    );
    conf.sort((a, b) => a.s.lostAll - b.s.lostAll || b.s.won - a.s.won);
    const half = confirmSeeds.length / 2;
    best[m] = conf.map((x) => {
      const tot = x.runs.map((r) => sum(r.lost));
      const sd = Math.sqrt(mean(tot.map((v) => (v - x.s.lostAll) ** 2)));
      return {
        key: keyOf(x.ws),
        name: name(x.ws),
        lostAll: x.s.lostAll,
        won: x.s.won,
        lost10: x.s.lost10,
        boss: x.s.boss,
        se: sd / Math.sqrt(tot.length),
        halves: [mean(tot.slice(0, half)), mean(tot.slice(half))] as [number, number],
      };
    });
    (result.maps as Record<string, unknown>)[m] = { pairs: pairs.map((p) => ({ key: keyOf(p.weapons!), lostAll: p.perMap[m]!.lostAll })), screened: screen.map((x) => ({ key: keyOf(x.ws), lostAll: x.s.lostAll, won: x.s.won })), best: best[m] };
  }

  // ---- Overlap ----
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const top5 = (m: string) => best[m].slice(0, 5).map((b) => b.key);
  const jac: Record<string, Record<string, number>> = {};
  for (const a of maps) {
    jac[a] = {};
    for (const b of maps) jac[a][b] = r2(jaccard(top5(a), top5(b)));
  }
  // Same map, two halves of the confirm seeds: the top-5 by each half.
  const selfJ: Record<string, number> = {};
  for (const m of maps) {
    const h0 = [...best[m]].sort((x, y) => x.halves[0] - y.halves[0]).slice(0, 5).map((b) => b.key);
    const h1 = [...best[m]].sort((x, y) => x.halves[1] - y.halves[1]).slice(0, 5).map((b) => b.key);
    selfJ[m] = r2(jaccard(h0, h1));
  }
  // Singles: rank correlation over the weapons both maps deal.
  const single = (m: string, w: AbilityId) => src.singles[m].find((c) => c.kind === 'single' && c.weapons?.[0] === w)?.perMap[m as MapId]?.lostAll;
  const rho: Record<string, Record<string, number>> = {};
  for (const a of maps) {
    rho[a] = {};
    for (const b of maps) {
      const ws = src.pool[a].filter((w) => src.pool[b].includes(w) && single(a, w) !== undefined && single(b, w) !== undefined);
      rho[a][b] = r2(spearman(ws.map((w) => single(a, w)!), ws.map((w) => single(b, w)!)));
    }
  }
  const firstKit = Object.fromEntries(maps.map((m) => [m, best[m][0].key]));
  const firstSingle = Object.fromEntries(maps.map((m) => [m, [...src.pool[m]].filter((w) => single(m, w) !== undefined).sort((x, y) => single(m, x)! - single(m, y)!)[0]]));
  const share = (o: Record<string, string>) => {
    const counts: Record<string, number> = {};
    for (const v of Object.values(o)) counts[v] = (counts[v] ?? 0) + 1;
    const [k, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return { most: k, maps: n, of: maps.length };
  };
  // Weapons in each map's top-5 kits.
  const inTop5: Record<string, Record<string, number>> = {};
  for (const m of maps) for (const b of best[m].slice(0, 5)) for (const w of b.key.split('+')) ((inTop5[w] ??= {})[m] = (inTop5[w][m] ?? 0) + 1);
  result.overlap = { jaccardTop5: jac, sameMapHalves: selfJ, spearmanSingles: rho, firstKit, firstKitShare: share(firstKit), firstSingle, firstSingleShare: share(firstSingle), inTop5 };
  const offDiag = (o: Record<string, Record<string, number>>) => mean(maps.flatMap((a, i) => maps.slice(i + 1).map((b) => o[a][b])));
  console.log(`\nJaccard of top-5 kits between maps: mean ${r2(offDiag(jac))}; same map, two halves of the seeds: mean ${r2(mean(Object.values(selfJ)))}`);
  console.log(`Spearman of the singles between maps: mean ${r2(offDiag(rho))}`);
  console.log(`#1 kit: ${JSON.stringify(share(firstKit))}; #1 weapon alone: ${JSON.stringify(share(firstSingle))}`);
  for (const m of maps) console.log(`${MAPS[m].name}: ${best[m].slice(0, 5).map((b) => `${b.name} ${b.lostAll.toFixed(1)}`).join('; ')}`);
  const file = opt('json');
  if (file) writeFileSync(file, `${JSON.stringify(result, null, 1)}\n`);
}

if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
