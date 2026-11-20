// Test Lab round 11, part A (docs/design/v3-round11-map-notes.md): the
// player's notes from the full-map playtest of The Strait, The Gauntlet and
// Harbor Mouth. The convoy commands (Rush and Disperse cut, Hold on Sowers'
// Reach) are covered in convoy.test.ts and the Afterburner Rush's lost line
// in events.test.ts.

import { describe, expect, it } from 'vitest';
import { LAB_CHANGES, LAB_ROUND, LAB_ROUNDS, MAP_CARD_PLAYS, cardRev, labCard, mapProduction, productionText } from '../../src/v3/data/lab';
import { ENDING, EVENT_WAVE, bossRound } from '../../src/v3/data/events';
import { ENCOUNTERS, arcGroups, beatText } from '../../src/v3/data/encounters';
import { FORMATIONS } from '../../src/v3/data/formations';
import { LANE_FLOOR, MAPS, MAP_ORDER, OPEN_EDGE, halfWidthAt, slotOffset } from '../../src/v3/data/maps';
import { createGame, step, type Game } from '../../src/v3/sim/game';
import { evidenceLines, labCountText } from '../../src/v3/sim/lab';
import { drawFrame } from '../../src/v3/ui/render';

const DT = 1 / 60;

describe('the dotted outlines: a loaded boost no longer leaks its dash', () => {
  // The player: "when there is a overdrive or a boost selected, everything
  // becomes like dotted the outline like the cargo ships too". The boost's
  // ring set its dash before save(), so restore() put it back.
  /** A 2D context that keeps the state save() and restore() keep, and
   *  notes the dash in force at every stroke. */
  function fakeCtx() {
    type State = { dash: number[] };
    let state: State = { dash: [] };
    const stack: State[] = [];
    const strokes: { depth: number; dash: number[] }[] = [];
    const leaks: number[] = [];
    const grad = { addColorStop() {} };
    const own: Record<string, unknown> = {
      save: () => stack.push({ dash: [...state.dash] }),
      restore: () => {
        state = stack.pop() ?? state;
        // Back at the frame's own level: nothing dashed may be left set.
        if (stack.length <= 1 && state.dash.length) leaks.push(strokes.length);
      },
      setLineDash: (d: number[]) => (state.dash = [...d]),
      getLineDash: () => [...state.dash],
      stroke: () => strokes.push({ depth: stack.length, dash: [...state.dash] }),
      createLinearGradient: () => grad,
      createRadialGradient: () => grad,
      createPattern: () => null,
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    };
    const ctx = new Proxy(own, {
      get: (t, k: string) => (k in t ? t[k] : () => undefined),
      set: (t, k: string, v) => {
        if (!(k in own) || typeof own[k] !== 'function') t[k] = v;
        return true;
      },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, strokes, leaks, depth: () => stack.length, dash: () => state.dash };
  }

  function withBoost(): Game {
    const g = createGame('strait', 3);
    for (let i = 0; i < 30 / DT && g.ships.length < 2; i++) step(g, DT);
    expect(g.ships.length).toBeGreaterThan(0);
    g.boost = { id: 'overdrive', level: 1, t: 12, n: 0, bank: 0, crateT: 0, age: 0 } as Game['boost'];
    g.weapon = { id: 'flak', level: 1, t: 10 } as Game['weapon'];
    return g;
  }

  it('after a frame with a boost loaded, no dash is left set, and the frame ends with an empty dash', () => {
    const g = withBoost();
    const f = fakeCtx();
    (globalThis as { Image?: unknown }).Image ??= class {
      complete = false;
      naturalWidth = 0;
      src = '';
    };
    drawFrame(f.ctx, g, [], 0);
    expect(f.depth()).toBe(0);
    expect(f.dash()).toEqual([]);
    expect(f.leaks).toEqual([]);
    // The boost's ring itself is dashed (that is its look).
    expect(f.strokes.some((s) => s.dash.join() === '10,6')).toBe(true);
  });
});

describe('boss rounds: what the player reads for the map\'s ending', () => {
  it('"Boss round 1 of 3"; the lab bar and the verdict say boss rounds too', () => {
    expect(bossRound(1, ENDING.runs)).toBe('Boss round 1 of 3');
    const card = labCard('map-strait')!;
    const s = { came: 0, killed: 0, harm: 0, sunk: 0, early: 0, firstShot: [], weaponKills: 0, clean: 2, held: 1, broken: 0 } as never;
    expect(labCountText(card, s, 9, 13, { plays: 'full', wave: 10 })).toBe('full map · wave 10 of 10');
    expect(labCountText(card, s, 10, 13, { plays: 'full', wave: EVENT_WAVE })).toBe('full map · boss round 1 of 3');
    expect(labCountText(card, s, 12, 13, { plays: 'full', wave: 13 })).toBe('full map · boss round 3 of 3');
    expect(evidenceLines(card, s, 13, 'full')[1]).toBe('Boss rounds: Clean 2 · Held 1 · Broken 0');
    expect(MAP_CARD_PLAYS).toBe('Full map: waves 1–10 and 3 boss rounds');
  });
});

describe('the encounter script, in words, for the pause screen', () => {
  it('each beat as "at 45% of the wave (+1.4 s): 1 guided missile from base 3, aimed at the lead ship"', () => {
    const screen = ENCOUNTERS.find((e) => e.id === 'strait-screen')!;
    expect(screen.beats.map(beatText)).toEqual([
      'at 45% of the wave: 6 drones from base 3, 0.35 s apart, at any ship',
      'at 45% of the wave (+1.4 s): 1 guided missile from base 3, aimed at the lead ship',
    ]);
    const salvo = ENCOUNTERS.find((e) => e.id === 'harbor-funnel-salvo')!;
    expect(beatText(salvo.beats[0])).toBe('at 45% of the wave: 4 ballistic shells from a sub at spot 2, 0.75 s apart, aimed at the ship nearest the narrows');
    const cross = ENCOUNTERS.find((e) => e.id === 'gauntlet-crossfire')!;
    expect(beatText(cross.beats[3])).toBe('at 55% of the wave (+2.5 s): 1 strafer from the left edge, at any ship');
  });

  it('the arc of a map in one line, then its boss rounds', () => {
    // Encounters rev 4 (map rebuild phase 4, docs/design/v3-p4-harbor.md):
    // Harbor Mouth's v1 has one encounter a wave, none twice in a row.
    expect(arcGroups('harbor', 11, 13, 'The Breakout')).toEqual([
      { from: 1, to: 1, name: 'Over the neck' },
      { from: 2, to: 2, name: 'Open water' },
      { from: 3, to: 3, name: 'First periscope' },
      { from: 4, to: 4, name: 'South headland' },
      { from: 5, to: 5, name: 'Funnel and tail' },
      { from: 6, to: 6, name: 'Both headlands' },
      { from: 7, to: 7, name: 'Front and back' },
      { from: 8, to: 8, name: 'Wolf pack' },
      { from: 9, to: 9, name: 'Crossfire at the neck' },
      { from: 10, to: 10, name: 'The last mile' },
      { from: 11, to: 13, name: 'Boss rounds: The Breakout' },
    ]);
    // (Round 12's fixes: wave 1 opens with Ranging shots. Phase 4, rev 4: a
    // different encounter on every wave after it, docs/design/v3-p4-strait.md.)
    expect(arcGroups('strait', 11, 13, 'Afterburner Rush').slice(0, 2)).toEqual([{ from: 1, to: 1, name: 'Ranging shots' }, { from: 2, to: 2, name: 'The long crossing' }]);
  });

  it('no encounter text mentions a command that is gone', () => {
    for (const e of ENCOUNTERS) for (const t of [e.decision, e.counters, e.succeeds]) expect(t, e.id).not.toMatch(/\b(Rush|Disperse|Hold)\b/);
  });
});

describe('Harbor Mouth: pairs sail wide in the open water and close up at the neck', () => {
  it('only Harbor Mouth asks for it; on any other lane a slot is its share of the half-width, as before', () => {
    for (const id of MAP_ORDER) for (const ch of MAPS[id].channels) expect(!!ch.open, id).toBe(id === 'harbor');
    expect(Object.values(FORMATIONS).filter((f) => f.opens).map((f) => f.id)).toEqual(['pairs']);
    const strait = MAPS.strait.channels[0];
    expect(slotOffset(strait, 0.32, 150, true)).toBeCloseTo(48, 6);
    const harbor = MAPS.harbor.channels[0];
    // The Box is tight by design: it never opens.
    expect(slotOffset(harbor, 0.34, 150, false)).toBeCloseTo(51, 6);
  });

  it('wide water: about 210 px between a pair, inside the lane; the neck: the pair\'s own slots', () => {
    const ch = MAPS.harbor.channels[0];
    const wide = slotOffset(ch, 0.32, halfWidthAt(ch, 300), true);
    expect(2 * wide).toBeGreaterThan(200);
    expect(wide).toBeLessThanOrEqual(halfWidthAt(ch, 300) - OPEN_EDGE);
    const neck = slotOffset(ch, 0.32, LANE_FLOOR, true);
    expect(neck).toBeCloseTo(0.32 * LANE_FLOOR, 6);
    // It closes steadily as the lane narrows.
    let last = Infinity;
    for (let x = 700; x <= 1600; x += 100) {
      const o = slotOffset(ch, 0.32, halfWidthAt(ch, x), true);
      expect(o).toBeLessThanOrEqual(last + 1e-9);
      last = o;
    }
  });

  it('in a campaign run the ships come in wide and close up, never touching and never out of the lane', () => {
    const g = createGame('harbor', 7);
    g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
    g.raids = [];
    g.raiderQueue = [];
    const gaps: { x: number; gap: number }[] = [];
    for (let i = 0; i < 70 / DT && g.phase === 'wave'; i++) {
      step(g, DT);
      if (i % 30) continue;
      for (const a of g.ships) {
        const hw = halfWidthAt(g.map.channels[0], a.x);
        expect(Math.abs(a.y - 470), `ship ${a.id} at x ${a.x.toFixed(0)}`).toBeLessThanOrEqual(hw);
        for (const b of g.ships) {
          if (b.id <= a.id) continue;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}/${b.id}`).toBeGreaterThan(30);
          if (Math.abs(a.x - b.x) < 30) gaps.push({ x: (a.x + b.x) / 2, gap: Math.abs(a.y - b.y) });
        }
      }
    }
    const open = gaps.filter((p) => p.x > 150 && p.x < 650);
    const neck = gaps.filter((p) => p.x > 1350);
    expect(open.length).toBeGreaterThan(3);
    expect(neck.length).toBeGreaterThan(3);
    expect(Math.min(...open.map((p) => p.gap))).toBeGreaterThan(170);
    expect(Math.max(...neck.map((p) => p.gap))).toBeLessThan(90);
  });
});

describe('Test Lab round 11', () => {
  it('the round, and the cards it changed', () => {
    expect(LAB_ROUND).toBeGreaterThanOrEqual(11);
    expect(LAB_ROUNDS.find((r) => r.n === 11)).toMatchObject({ n: 11, date: '2026-11-14' });
    // (The Afterburner Rush changed again in round 12's fixes: Hydras in the rush.)
    // (Every map card changed again in round 13: frigates, munitions, the Nuke.)
    for (const id of ['map-sowers', 'ev-rush']) expect(cardRev(id), id).toBe(id === 'ev-rush' ? 12 : 13);
    expect(LAB_CHANGES['ev-rush'].some((c) => c.round === 11), 'ev-rush').toBe(true);
    // (The reference maps changed again in round 12: their encounter versions.)
    for (const id of ['map-strait', 'map-gauntlet', 'map-harbor']) expect(LAB_CHANGES[id].some((c) => c.round === 11), id).toBe(true);
    expect(LAB_CHANGES['map-strait'].filter((c) => c.round === 11)[0].what).toBe('Rush and Disperse are gone: the convoy sails on its own');
    expect(LAB_CHANGES['map-harbor'].filter((c) => c.round === 11)[0].what).toBe('Hold is gone here; ships start wide and close up at the neck');
    expect(LAB_CHANGES['map-sowers'].filter((c) => c.round === 11)[0].what).toMatch(/^New: Hold/);
    // Round 10's lines say what round 10 set up.
    expect(LAB_CHANGES['map-strait'].find((c) => c.round === 10)!.what).toContain('Commands: Rush and Disperse');
  });

  it('the production setups: the reference maps under D with no command and their encounters; Sowers\' Reach under D with Hold', () => {
    expect(mapProduction('strait')).toEqual({ convoy: 'tactical', encounters: true });
    expect(mapProduction('harbor')).toEqual({ convoy: 'tactical', encounters: true });
    expect(mapProduction('sowers')).toEqual({ convoy: 'tactical', encounters: false });
    // Chapter 1's Kesh and Marrow, rebuilt to the rules (docs/design/v3-ch1-*.md):
    // the map's own convoy, no command, and their encounters.
    expect(mapProduction('kesh')).toEqual({ convoy: 'tactical', encounters: true });
    expect(mapProduction('marrow')).toEqual({ convoy: 'tactical', encounters: true });
    // Chapter 2's Island and Behemoth Run (docs/design/v3-ch2-*.md): the same.
    expect(mapProduction('island')).toEqual({ convoy: 'tactical', encounters: true });
    expect(mapProduction('behemoth')).toEqual({ convoy: 'tactical', encounters: true });
    // The Needle of Bosk (docs/design/v3-ch2-needle.md): the same.
    expect(mapProduction('needle')).toEqual({ convoy: 'tactical', encounters: true });
    // The Archipelago (docs/design/v3-ch2-archipelago.md): the same.
    expect(mapProduction('archipelago')).toEqual({ convoy: 'tactical', encounters: true });
    // Saltgate Canal (docs/design/v3-ch2-saltgate.md): the same.
    expect(mapProduction('saltgate')).toEqual({ convoy: 'tactical', encounters: true });
    expect(mapProduction('battery')).toEqual({ convoy: 'current', encounters: false });
    expect(productionText('strait')).toBe("The map's own convoy (no commands) · encounters v1 Original");
    expect(productionText('sowers')).toBe('Commands: Hold');
  });
});
