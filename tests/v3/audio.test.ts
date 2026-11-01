// V3 sound (docs/design/v3-sound-round1.md). Every mechanic has a cue, every
// cue has a file with a recorded free licence, each cue lands on the step its
// visual happens, and the mix rules hold. Sound must never change the sim.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUE_IDS, LOOP_CUES, MUSIC_CUES, UI_CUES, type Cue, type CueId } from '../../src/v3/audio/cues';
import { BUS_LUFS, MAX_VOICES, SOUNDS, UISFX_SOURCE } from '../../src/v3/audio/manifest';
import { MixPolicy, MusicDirector } from '../../src/v3/audio/policy';
import { activeLoops, battleMusic } from '../../src/v3/audio/state';
import { ABILITY_ORDER, AB, WEAPON, type AbilityId } from '../../src/v3/data/abilities';
import { PICKUP_KINDS, SUPERSONIC, type ThreatKind } from '../../src/v3/data/config';
import { playMimic } from '../../src/v3/sim/mimic';
import { replay } from '../../src/v3/sim/playlog';
import {
  BALLISTIC_WHISTLE,
  CARRIER_TARGET,
  KILL_CUE,
  LAUNCH_CUE,
  PICKUP_CUE,
  createGame,
  step,
  tap,
  type Game,
  type GameEvent,
  type Threat,
} from '../../src/v3/sim/game';

const DT = 1 / 60;
const AUDIO_DIR = 'public/v3/audio';

function quietGame(seed = 1): Game {
  const g = createGame('strait', seed, 1);
  g.queue = [{ at: 1e9, kind: 'drone', base: 0 }];
  g.raiderQueue = [];
  g.cues.length = 0;
  return g;
}

function addThreat(g: Game, over: Partial<Threat>): Threat {
  const th: Threat = {
    id: g.nextId++, kind: 'drone', x: 800, y: 300, vx: 0, vy: 0, hp: 1, speed: 70, heading: Math.PI / 2,
    target: CARRIER_TARGET, age: 0, phase: 0, dead: false, sx: 0, sy: 0, ix: 0, iy: 0, dur: 1, apex: 0, spawnT: 0, ...over,
  };
  g.threats.push(th);
  return th;
}

/** Cues with the step they were asked for on (taps belong to the next step). */
type Heard = { id: CueId; step: number; cue: Cue };
function listen(g: Game, heard: Heard[]): void {
  for (const c of g.cues) heard.push({ id: c.id, step: g.steps, cue: c });
  g.cues.length = 0;
}
function runHeard(g: Game, seconds: number, heard: Heard[]): void {
  for (let i = 0; i < seconds / DT && g.phase === 'wave'; i++) {
    listen(g, heard);
    step(g, DT);
    listen(g, heard);
  }
}

describe('sound coverage', () => {
  it('the manifest has an entry for every cue, with files on its bus', () => {
    for (const id of CUE_IDS) {
      const d = SOUNDS[id];
      expect(d, id).toBeTruthy();
      expect(d.files.length, id).toBeGreaterThan(0);
      expect(BUS_LUFS[d.bus], id).toBeDefined();
      expect(d.volume, id).toBeGreaterThan(0);
      expect(d.volume, id).toBeLessThanOrEqual(1);
    }
    expect(Object.keys(SOUNDS).sort()).toEqual([...CUE_IDS].sort());
    for (const m of MUSIC_CUES) expect(SOUNDS[m].bus).toBe('music');
  });

  it('every cue is asked for somewhere: the sim, the loop state or the UI', () => {
    const src = ['src/v3/sim/game.ts', 'src/v3/ui/app.ts', 'src/v3/audio/state.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const id of CUE_IDS) expect(src.includes(`'${id}'`), `${id} is never emitted`).toBe(true);
    for (const id of UI_CUES) expect(readFileSync('src/v3/ui/app.ts', 'utf8').includes(`'${id}'`), id).toBe(true);
  });

  it('every game event, threat, pickup and weapon maps to its sound', () => {
    const kinds: GameEvent['kind'][] = ['wave', 'debut', 'vector', 'shipLost', 'carrierHit', 'bigKill', 'pickup', 'newPickup', 'weapon', 'dry'];
    const EVENT_CUES: Record<GameEvent['kind'], CueId[]> = {
      wave: ['wave.start'], debut: ['debut.sting'], vector: ['debut.sting'], shipLost: ['ship.sunk'], carrierHit: ['carrier.hit'],
      bigKill: ['kill.big', 'sub.destroyed', 'truck.destroyed'], pickup: Object.values(PICKUP_CUE), newPickup: ['powerup.drop', 'weapon.drop'],
      weapon: ['weapon.load'], dry: ['gun.dry'],
    };
    for (const k of kinds) for (const c of EVENT_CUES[k]) expect(CUE_IDS).toContain(c);
    const threats: ThreatKind[] = ['drone', 'ballistic', 'guided', 'supersonic', 'heavy', 'cluster', 'mothership', 'strafer', 'bomber', 'bomblet', 'minidrone'];
    for (const t of threats) {
      expect(CUE_IDS, t).toContain(KILL_CUE[t]);
      expect(CUE_IDS, t).toContain(LAUNCH_CUE[t]);
    }
    for (const p of PICKUP_KINDS) expect(CUE_IDS, p).toContain(PICKUP_CUE[p]);
    expect(Object.keys(WEAPON_SIGNATURE).sort()).toEqual([...ABILITY_ORDER].sort());
  });
});

describe('sound files', () => {
  const credits = JSON.parse(readFileSync(`${AUDIO_DIR}/CREDITS.json`, 'utf8')) as { file: string; licence: string; source: string; sourceUrl: string; author: string }[];
  const files = [...new Set(Object.values(SOUNDS).flatMap((d) => d.files))];
  const ALLOWED = ['CC0-1.0'];
  const musicFiles = new Set(MUSIC_CUES.flatMap((m) => SOUNDS[m].files));

  it('every manifest file is shipped, credited, and under a licence that allows selling the game', () => {
    for (const f of files) {
      expect(existsSync(`${AUDIO_DIR}/${f}`), f).toBe(true);
      const c = credits.find((x) => x.file === f);
      expect(c, `${f} has no CREDITS.json entry`).toBeTruthy();
      expect(ALLOWED, f).toContain(c!.licence);
      expect(c!.source && c!.sourceUrl && c!.author, f).toBeTruthy();
    }
    // No orphans: a credit for a file nobody plays, or a file nobody credits.
    expect(credits.map((c) => c.file).sort()).toEqual([...files].sort());
    for (const [cue, path] of Object.entries(UISFX_SOURCE)) expect(credits.find((c) => c.file === SOUNDS[cue as CueId].files[0])!.source).toContain(path);
  });

  it('all shipped audio stays within the phone budget (≤ 4 MB)', () => {
    const total = files.reduce((n, f) => n + statSync(`${AUDIO_DIR}/${f}`).size, 0);
    expect(total).toBeLessThanOrEqual(4 * 1024 * 1024);
  });

  const probe = (() => {
    try {
      execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  })();
  it.skipIf(!probe)('every file decodes as AAC (ffprobe), mono for effects and stereo for music', () => {
    for (const f of files) {
      const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'csv=p=0', `${AUDIO_DIR}/${f}`], { encoding: 'utf8' }).trim();
      const [codec, rate, ch] = out.split(',');
      expect(codec, f).toBe('aac');
      expect(Number(rate), f).toBe(44100);
      expect(Number(ch), f).toBe(musicFiles.has(f) ? 2 : 1);
    }
  });
});

/** What a weapon must sound like: the cues only it makes. */
const WEAPON_SIGNATURE: Record<AbilityId, CueId[]> = {
  airstrike: ['jet.flyby', 'jet.guns', 'napalm.drop', 'napalm.burst'],
  shrapnel: ['gun.fire', 'shrapnel.burst'],
  frigate: ['frigate.arrive', 'frigate.fire'],
  thermo: ['gun.fire', 'thermo.burst'],
  scatter: ['scatter.blast'],
  boomerang: ['blade.throw', 'blade.hit', 'blade.catch'],
  flak: ['gun.fire', 'flak.burst', 'flak.cloud'],
  seeker: ['seeker.launch'],
  aegis: ['aegis.launch'],
  well: ['gun.fire', 'well.open', 'well.implode'],
  railgun: ['rail.beam'],
  tesla: ['gun.fire', 'tesla.arc'],
};

describe('every weapon sounds, through real taps', () => {
  for (const id of ABILITY_ORDER) {
    it(`${id}: loaded from its pickup, fired at a pack of drones`, () => {
      const g = quietGame(3);
      for (let i = 0; i < 6 / DT; i++) step(g, DT);
      g.cues.length = 0;
      const ship = g.ships.find((s) => s.x > 200) ?? g.ships[0];
      g.levels[id] = 3;
      g.slots = [id];
      g.pickups.push({ id: g.nextId++, kind: 'weapon', weapon: id, x: 300, y: 820, age: 0 });
      const heard: Heard[] = [];
      expect(tap(g, 300, 820, 30)).toBe('pickup');
      listen(g, heard);
      const pack: Threat[] = [];
      for (let k = 0; k < 6; k++) pack.push(addThreat(g, { x: 700 + (k % 3) * 40, y: 280 + Math.floor(k / 3) * 40, hp: 2, target: ship.id }));
      for (let shot = 0; shot < 4; shot++) {
        const t = g.threats.find((o) => !o.dead);
        if (t) tap(g, t.x, t.y, 60);
        listen(g, heard);
        runHeard(g, 1.5, heard);
      }
      runHeard(g, 4, heard);
      const ids = new Set(heard.map((h) => h.id));
      expect(ids.has('weapon.load'), 'weapon.load').toBe(true);
      for (const c of WEAPON_SIGNATURE[id]) expect(ids.has(c), `${id} → ${c}`).toBe(true);
    });
  }
});

describe('sound timing: a cue lands on the step its visual does', () => {
  it('napalm bursts when each canister bursts (the burn appears), not when it is dropped', () => {
    const g = quietGame();
    g.levels.airstrike = 3;
    g.slots = ['airstrike'];
    g.weapon = { id: 'airstrike', level: 3, t: WEAPON.time };
    const heard: Heard[] = [];
    tap(g, 400, 300, 40);
    listen(g, heard);
    let burns = 0;
    const burstSteps: number[] = [];
    for (let i = 0; i < 5 / DT; i++) {
      step(g, DT);
      const n = g.fields.filter((f) => f.kind === 'burn').length;
      if (n > burns) burstSteps.push(g.steps);
      burns = Math.max(burns, n);
      listen(g, heard);
    }
    const bursts = heard.filter((h) => h.id === 'napalm.burst').map((h) => h.step);
    const drops = heard.filter((h) => h.id === 'napalm.drop').map((h) => h.step);
    expect(bursts.length).toBeGreaterThan(3);
    expect(bursts.length).toBe(drops.length);
    // Every burst step is a step a new stretch of fire appeared on.
    for (const s of bursts) expect(burstSteps).toContain(s);
    // and comes AB.airstrike.fall after its drop.
    expect((bursts[0] - drops[0]) * DT).toBeCloseTo(AB.airstrike.fall, 1);
  });

  it('the railgun crack is on the tap that draws the beam', () => {
    const g = quietGame();
    g.levels.railgun = 1;
    g.slots = ['railgun'];
    g.weapon = { id: 'railgun', level: 1, t: WEAPON.time };
    addThreat(g, { x: 800, y: 300 });
    tap(g, 800, 300, 40);
    expect(g.cues.map((c) => c.id)).toContain('rail.beam');
    expect(g.fx.some((f) => f.kind === 'beam')).toBe(true);
  });

  it('a kill sounds on the step the threat dies, and its burst stays quiet', () => {
    const g = quietGame();
    const th = addThreat(g, { x: 800, y: 500 });
    const heard: Heard[] = [];
    tap(g, th.x, th.y, 40);
    listen(g, heard);
    expect(heard.map((h) => h.id)).toEqual(['gun.fire']);
    let diedAt = -1;
    for (let i = 0; i < 3 / DT && diedAt < 0; i++) {
      step(g, DT);
      if (th.dead) diedAt = g.steps;
      listen(g, heard);
    }
    expect(diedAt).toBeGreaterThan(0);
    const kill = heard.find((h) => h.id === 'kill.small')!;
    expect(kill.step).toBe(diedAt);
    expect(heard.some((h) => h.id === 'gun.burst' && h.step === diedAt)).toBe(false);
  });

  it('a ballistic whistles in the last 0.9 s and splashes as it lands', () => {
    const g = quietGame();
    addThreat(g, { kind: 'ballistic', x: 300, y: 600, sx: 300, sy: 600, ix: 900, iy: 600, dur: 2.5, apex: 200, speed: 380 });
    const heard: Heard[] = [];
    runHeard(g, 3, heard);
    const w = heard.find((h) => h.id === 'ballistic.whistle')!;
    const s = heard.find((h) => h.id === 'impact.splash')!;
    expect(w && s).toBeTruthy();
    expect(Math.abs((s.step - w.step) * DT - BALLISTIC_WHISTLE)).toBeLessThanOrEqual(DT + 1e-9);
    expect(s.cue.x).toBe(900);
  });

  it('a supersonic arming beeps (a loop) only while it arms', () => {
    const g = quietGame();
    addThreat(g, { kind: 'supersonic', x: 300, y: 300, speed: 430 });
    step(g, DT);
    expect(activeLoops(g).map((l) => l.id)).toContain('supersonic.lock');
    for (let i = 0; i < SUPERSONIC.arming / DT + 2; i++) step(g, DT);
    expect(activeLoops(g).map((l) => l.id)).not.toContain('supersonic.lock');
  });

  it('a dry tap clicks; the loaded weapon warns at 2 s and says DONE as it goes', () => {
    const g = quietGame();
    g.ammo = 0;
    g.reloadT = 0;
    addThreat(g, { x: 800, y: 300 });
    tap(g, 800, 300, 40);
    expect(g.cues.map((c) => c.id)).toEqual(['gun.dry']);
    g.cues.length = 0;
    g.levels.flak = 1;
    g.slots = ['flak'];
    g.weapon = { id: 'flak', level: 1, t: 2.5 };
    const heard: Heard[] = [];
    runHeard(g, 3, heard);
    const warn = heard.find((h) => h.id === 'weapon.expiring')!;
    const done = heard.find((h) => h.id === 'weapon.done')!;
    expect((done.step - warn.step) * DT).toBeCloseTo(2, 1);
  });
});

describe('sound never touches the sim', () => {
  it('headless games never pile up cues, and a bot game replays exactly', () => {
    const { game, log } = playMimic('strait', 11, { tempo: { waveLen: 0.25, stride: 4, lossLimit: 3 } });
    expect(game.cues.length).toBeLessThan(50);
    const again = replay(log);
    expect(again.score).toBe(game.score);
    expect(again.steps).toBe(game.steps);
    expect(again.lost).toBe(game.lost);
  });

  it('a busy game asks for every sim cue family over a few seeds', () => {
    const heard = new Set<CueId>();
    for (const seed of [1, 2, 3]) {
      const g = createGame('harbor', seed, 9);
      for (let i = 0; i < 90 / DT && g.phase === 'wave'; i++) {
        for (const c of g.cues) heard.add(c.id);
        step(g, DT);
        for (const c of g.cues) heard.add(c.id);
        for (const l of activeLoops(g)) heard.add(l.id);
      }
    }
    for (const c of ['wave.start', 'drone.launch', 'missile.launch', 'ballistic.launch', 'ballistic.whistle', 'impact.splash', 'ship.hit', 'ship.sunk'] as CueId[]) {
      expect(heard.has(c), c).toBe(true);
    }
  });
});

describe('the mix rules', () => {
  const dur = () => 0.5;
  it('cooldowns and per-cue caps hold however fast cues arrive', () => {
    const p = new MixPolicy(dur, 7);
    let played = 0;
    for (let t = 0; t < 1000; t += 5) if (p.decide({ id: 'gun.fire', x: 800, y: 450 }, t)) played++;
    // 45 ms cooldown, 4 voices of 0.5 s at most.
    expect(played).toBeLessThanOrEqual(Math.ceil(1000 / 45));
    expect(p.active(999).filter((v) => v.id === 'gun.fire').length).toBeLessThanOrEqual(SOUNDS['gun.fire'].maxVoices!);
  });

  it('variants rotate and the pitch varies', () => {
    const p = new MixPolicy(dur, 3);
    const vs = Array.from({ length: 8 }, (_, i) => p.decide({ id: 'kill.small', x: 800, y: 450 }, i * 1000)!);
    expect(new Set(vs.map((v) => v.file)).size).toBe(SOUNDS['kill.small'].files.length);
    expect(new Set(vs.map((v) => v.rate.toFixed(3))).size).toBeGreaterThan(4);
  });

  it('at the voice cap, effects wait but alerts still sound and duck the effects', () => {
    const p = new MixPolicy(() => 5, 1);
    const ids = CUE_IDS.filter((id) => SOUNDS[id].bus === 'sfx' && !LOOP_CUES.includes(id as never));
    for (let i = 0; p.active(0).length < MAX_VOICES && i < ids.length; i++) p.decide({ id: ids[i], x: 0, y: 0 }, 0);
    expect(p.active(0).length).toBe(MAX_VOICES);
    expect(p.decide({ id: 'kill.big', x: 0, y: 0 }, 1)).toBeNull();
    const a = p.decide({ id: 'last.ship', x: 0, y: 0 }, 1)!;
    expect(a).toBeTruthy();
    expect(p.duckFor(a)!.depth).toBeLessThan(1);
  });

  it('pans follow x, and a jet sweeps across', () => {
    const p = new MixPolicy(dur, 1);
    expect(p.decide({ id: 'ship.hit', x: 0, y: 0 }, 0)!.pan).toBeCloseTo(-0.8);
    expect(p.decide({ id: 'kill.big', x: 1600, y: 0 }, 0)!.pan).toBeCloseTo(0.8);
    expect(p.decide({ id: 'jet.flyby', x: -80, y: 300, vx: 900 }, 0)!.panRate).toBeGreaterThan(0);
  });

  it('battle music turns intense late or when crowded, without flapping', () => {
    const g = createGame('strait', 1, 1);
    expect(battleMusic(g)).toBe('battle.music');
    expect(battleMusic(createGame('strait', 1, 6))).toBe('battle.intense');
    const d = new MusicDirector(8000);
    expect(d.pick('battle.music', 0)).toBe('battle.music');
    expect(d.pick('battle.intense', 1000)).toBe('battle.music');
    expect(d.pick('battle.intense', 9000)).toBe('battle.intense');
    expect(d.pick('result.music', 9100)).toBe('result.music');
  });
});
