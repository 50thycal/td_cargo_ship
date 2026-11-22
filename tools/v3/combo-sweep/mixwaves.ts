// A map's threat mix by wave band (round 9, the signature threats: docs/
// design/v3-combo-diversity.md): the share of what shows that is each kind,
// in waves 1-3, 4-10 and 6-10 and the boss rounds, as mix.ts reads it (the
// "you" bot drafting for itself on the map's Test Lab card, played tough).
// A signature threat counts with what it fires (an attack helicopter with
// its rockets). Two shares: of the threats that show (mix.ts's), and of
// the hits it takes to clear them (each threat by its hit points as it
// shows: a heavy missile is 8, a drone 1, an armored drone 2 and its plate
// 4), since a few big threats can be
// a large part of a wave's work while a small part of its count.
//
//   npx vite-node tools/v3/combo-sweep/mixwaves.ts -- [--maps=island,behemoth,needle,archipelago,saltgate,battery,sowers,rigs,lantern] [--seeds=4]

import { VERSION_DEFAULT } from '../../../src/v3/data/encounters';
import { labCard, mapCardId } from '../../../src/v3/data/lab';
import type { MapId } from '../../../src/v3/data/maps';
import { defaultSetup, labRunPlan, parseLabProgress } from '../../../src/v3/ui/lab';
import { BotRun, PERSONAS } from '../../../src/v3/sim/mimic';
import { PLAYER_ARMORY } from '../bot-fit/measure';

const args = process.argv.slice(2).filter((a) => a !== '--');
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const maps = (opt('maps')?.split(',') ?? ['island', 'behemoth', 'needle', 'archipelago', 'saltgate']) as MapId[];
const seeds = Number(opt('seeds') ?? 4);

/** Each map's signature (round 9): the kinds that count as it. */
export const SIGNATURE: Partial<Record<MapId, string[]>> = {
  island: ['attackHeli', 'heliRocket'],
  behemoth: ['heavy', 'strafer'],
  // The Needle of Bosk (log v35): the Shield Wall's armored drones.
  needle: ['armored'],
  // The Archipelago (log v37): drone motherships, with the mini-drones they
  // launch.
  archipelago: ['mothership', 'minidrone'],
  // Saltgate Canal (log v42): the trucks come to the locks: Rocket Trucks,
  // and the cluster missiles with their bomblets (log v38-v41: Torpedo Subs
  // with their torpedoes in place of the trucks).
  saltgate: ['rocketTruck', 'cluster', 'bomblet'],
  // Battery Point (log v43): silence the battery: the heavy cruise missiles
  // that go for the shore guns, and the jets that come in dark.
  battery: ['heavy', 'stealthJet'],
  // Sowers' Reach (log v48): sown, the stealth bombers that sow mines just
  // ahead of the ships, and the mines they sow (counted apart from the
  // chutes' own, the map's mechanic, as `sownMine`).
  sowers: ['stealthBomber', 'sownMine'],
  // The Rig Field (log v49): relief rigs, each counted as it shows on its
  // tow (`towRig`, apart from the rigs that stand from the start, the map's
  // mechanic) with the rack it fires as it docks (`rack`).
  rigs: ['towRig', 'rack'],
  // The Black Strait (log v50): guns in the dark, the siege guns that rise
  // on the enemy's dark bank (a gun counts once, by its hits, however many
  // times it rises).
  lantern: ['siege'],
};

/** Threats that showed, by wave and kind (mean a run), and their hit
 *  points (`hp`). */
export function mixByWave(map: MapId, nSeeds: number, hp?: Record<string, number>[]): Record<string, number>[] {
  const out: Record<string, number>[] = Array.from({ length: 13 }, () => ({}));
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
        const w = out[Math.min(13, g.wave) - 1];
        // A mine a stealth bomber sowed (log v48) is the signature's; a
        // chute's is the map's mechanic.
        // A relief rig on its tow and its rack (log v49) are the Rig
        // Field's; its rigs standing from the start are its mechanic.
        const kind = th.kind === 'mine' && th.parent === 'stealthBomber' ? 'sownMine' : th.tow !== undefined ? 'towRig' : th.rack ? 'rack' : th.kind;
        if (w) w[kind] = (w[kind] ?? 0) + 1 / nSeeds;
        const h = hp?.[Math.min(13, g.wave) - 1];
        // An armored drone's plate takes hits too (up to FOE.armored.plate
        // from the front, the way it flies at its ship): counted with its
        // hull (log v35, the Needle's walls).
        if (h) h[kind] = (h[kind] ?? 0) + (th.hp + (th.kind === 'armored' ? (th.foe?.n ?? 0) : 0)) / nSeeds;
      }
    }
  }
  return out;
}

if (!process.env.VITEST) {
  for (const m of maps) {
    const hp: Record<string, number>[] = Array.from({ length: 13 }, () => ({}));
    const ws = mixByWave(m, seeds, hp);
    const sumBand = (src: Record<string, number>[], from: number, to: number) => {
      const o: Record<string, number> = {};
      for (let w = from; w <= to; w++) for (const [k, v] of Object.entries(src[w - 1])) o[k] = (o[k] ?? 0) + v;
      return o;
    };
    const band = (from: number, to: number) => sumBand(ws, from, to);
    const sigShare = (o: Record<string, number>) => {
      const tot = Object.values(o).reduce((a, b) => a + b, 0);
      return Math.round((100 * (SIGNATURE[m] ?? []).reduce((a, k) => a + (o[k] ?? 0), 0)) / tot);
    };
    const line = (o: Record<string, number>) => {
      const tot = Object.values(o).reduce((a, b) => a + b, 0);
      const sig = (SIGNATURE[m] ?? []).reduce((a, k) => a + (o[k] ?? 0), 0);
      return `signature ${Math.round((100 * sig) / tot)}% | ` + Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${Math.round((100 * v) / tot)}%`).join(', ') + ` (${Math.round(tot)})`;
    };
    console.log(m);
    console.log(`  waves 1-3:  ${line(band(1, 3))}`);
    console.log(`  waves 4-10: ${line(band(4, 10))}`);
    console.log(`  waves 6-10: ${line(band(6, 10))}`);
    console.log(`  boss:       ${line(band(11, 13))}`);
    console.log(`  signature by hits: waves 4-10 ${sigShare(sumBand(hp, 4, 10))}%, 6-10 ${sigShare(sumBand(hp, 6, 10))}%, boss ${sigShare(sumBand(hp, 11, 13))}%`);
    console.log('  per wave signature: ' + ws.map((o, k) => {
      const tot = Object.values(o).reduce((a, b) => a + b, 0);
      const sig = (SIGNATURE[m] ?? []).reduce((a, kk) => a + (o[kk] ?? 0), 0);
      return `${k + 1}:${tot ? Math.round((100 * sig) / tot) : 0}%/${Math.round(tot)}`;
    }).join(' '));
  }
}
