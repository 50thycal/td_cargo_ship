// THE SOUND MANIFEST: the only place a sound is chosen. To change a sound,
// edit its entry here, or replace its file in public/v3/audio/ (see
// docs/design/v3-sound-round1.md, "Swapping a sound").
//
// A Record over CueId: a cue with no entry here does not compile.
//
//   files      shipped files, under public/v3/audio/ (several: played
//              round-robin, so a frequent sound doesn't repeat itself)
//   bus        sfx | ui | alert | music. Every file is levelled to its bus's
//              loudness target when it is prepared (BUS_LUFS), so `volume`
//              is purely the mix: how loud this cue sits against the others
//   volume     0..1 linear gain on top of the levelled file
//   pitch      playback-rate range picked at random per play (variety)
//   cooldownMs the least time between two plays (real time, so 3× speed
//              doesn't machine-gun)
//   maxVoices  how many of this cue may sound at once
//   duck       an alert: how far (0..1 gain) the sfx bus dips under it

import type { CueId } from './cues';

export type Bus = 'sfx' | 'ui' | 'alert' | 'music';

export interface SoundDef {
  files: string[];
  bus: Bus;
  volume: number;
  pitch?: [number, number];
  cooldownMs?: number;
  maxVoices?: number;
  duck?: number;
  /** How long the duck lasts (ms; default policy DUCK_MS). */
  duckMs?: number;
  /** Plays across the screen with its source (jets): pan follows cue.vx. */
  moving?: boolean;
}

/** Loudness each bus's files are levelled to when prepared (LUFS: the
 *  loudest 400 ms for a one-shot, the whole file for loops and music).
 *  True peak is held at or under -1 dBTP. */
export const BUS_LUFS: Record<Bus, number> = { sfx: -18, ui: -20, alert: -14, music: -20 };

/** Loops and music ship with this many seconds of their own tail before and
 *  head after the loop: AAC smears a file's edges, so the engine loops
 *  between LOOP_PAD and duration − LOOP_PAD, clear of them. */
export const LOOP_PAD = 0.1;

/** The voices the engine allows at once, all cues together. */
export const MAX_VOICES = 24;

const v = (cue: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${cue}.${i + 1}.m4a`);

const sfx = (cue: CueId, n: number, volume: number, o: Partial<SoundDef> = {}): SoundDef => ({ files: v(cue, n), bus: 'sfx', volume, ...o });
const ui = (cue: CueId, volume: number, o: Partial<SoundDef> = {}): SoundDef => ({ files: v(cue, 1), bus: 'ui', volume, ...o });
const alert = (cue: CueId, volume: number, o: Partial<SoundDef> = {}): SoundDef => ({ files: v(cue, 1), bus: 'alert', volume, duck: 0.5, ...o });

export const SOUNDS: Record<CueId, SoundDef> = {
  // Gun and ammo: the most frequent sounds in the game. Short, four
  // variants, a pitch spread, and caps so holding fire never stacks up.
  'gun.fire': sfx('gun.fire', 4, 0.5, { pitch: [0.94, 1.06], cooldownMs: 45, maxVoices: 4 }),
  'gun.dry': sfx('gun.dry', 2, 0.55, { pitch: [0.97, 1.03], cooldownMs: 120, maxVoices: 1 }),
  'gun.reload': sfx('gun.reload', 3, 0.16, { pitch: [0.95, 1.08], cooldownMs: 180, maxVoices: 1 }),
  'gun.burst': sfx('gun.burst', 4, 0.32, { pitch: [0.9, 1.1], cooldownMs: 35, maxVoices: 4 }),
  'rack.full': sfx('rack.full', 1, 0.6),

  'jet.flyby': sfx('jet.flyby', 2, 0.6, { moving: true, maxVoices: 2 }),
  'jet.guns': sfx('jet.guns', 3, 0.42, { pitch: [0.95, 1.05], cooldownMs: 90, maxVoices: 2 }),
  'napalm.drop': sfx('napalm.drop', 2, 0.32, { pitch: [0.95, 1.05], cooldownMs: 60, maxVoices: 3 }),
  'napalm.burst': sfx('napalm.burst', 3, 0.55, { pitch: [0.9, 1.08], cooldownMs: 60, maxVoices: 4 }),
  'burn.loop': sfx('burn.loop', 1, 0.3),

  'shrapnel.burst': sfx('shrapnel.burst', 3, 0.6, { pitch: [0.94, 1.06], cooldownMs: 50, maxVoices: 3 }),
  'frigate.arrive': sfx('frigate.arrive', 1, 0.5, { moving: true }),
  'frigate.fire': sfx('frigate.fire', 3, 0.38, { pitch: [0.92, 1.06], cooldownMs: 70, maxVoices: 3 }),
  'frigate.leave': sfx('frigate.leave', 1, 0.35, { moving: true }),
  'thermo.burst': sfx('thermo.burst', 2, 0.85, { pitch: [0.95, 1.03], cooldownMs: 80, maxVoices: 2 }),
  'scatter.blast': sfx('scatter.blast', 3, 0.6, { pitch: [0.93, 1.07], cooldownMs: 50, maxVoices: 3 }),

  'blade.throw': sfx('blade.throw', 2, 0.45, { pitch: [0.95, 1.08], cooldownMs: 50, maxVoices: 3 }),
  'blade.spin': sfx('blade.spin', 1, 0.22),
  'blade.catch': sfx('blade.catch', 2, 0.35, { pitch: [0.97, 1.04], cooldownMs: 60, maxVoices: 2 }),
  'blade.hit': sfx('blade.hit', 3, 0.35, { pitch: [0.92, 1.1], cooldownMs: 30, maxVoices: 3 }),

  'flak.burst': sfx('flak.burst', 3, 0.55, { pitch: [0.92, 1.06], cooldownMs: 50, maxVoices: 3 }),
  'flak.cloud': sfx('flak.cloud', 3, 0.18, { pitch: [0.9, 1.15], cooldownMs: 110, maxVoices: 2 }),
  'seeker.launch': sfx('seeker.launch', 2, 0.5, { pitch: [0.96, 1.05], cooldownMs: 60, maxVoices: 2 }),
  'aegis.launch': sfx('aegis.launch', 3, 0.32, { pitch: [0.93, 1.08], cooldownMs: 60, maxVoices: 3 }),
  'aegis.reload': sfx('aegis.reload', 1, 0.18, { pitch: [0.97, 1.05], cooldownMs: 250, maxVoices: 1 }),

  'well.open': sfx('well.open', 1, 0.6, { cooldownMs: 100, maxVoices: 2 }),
  'well.pull': sfx('well.pull', 1, 0.35),
  'well.implode': sfx('well.implode', 2, 0.75, { pitch: [0.95, 1.05], cooldownMs: 80, maxVoices: 2 }),
  'rail.beam': sfx('rail.beam', 3, 0.75, { pitch: [0.96, 1.04], cooldownMs: 50, maxVoices: 2 }),
  'tesla.arc': sfx('tesla.arc', 4, 0.32, { pitch: [0.9, 1.15], cooldownMs: 40, maxVoices: 3 }),

  'weapon.drop': sfx('weapon.drop', 1, 0.5, { cooldownMs: 200 }),
  'weapon.load': sfx('weapon.load', 2, 0.7, { cooldownMs: 150, maxVoices: 1 }),
  'weapon.expiring': sfx('weapon.expiring', 1, 0.45, { maxVoices: 1 }),
  'weapon.done': sfx('weapon.done', 1, 0.5, { maxVoices: 1 }),

  // Threats. Launches are many in a raid: capped low so a swarm reads as a
  // swarm, not a wall.
  'drone.launch': sfx('drone.launch', 3, 0.22, { pitch: [0.9, 1.12], cooldownMs: 90, maxVoices: 3 }),
  'missile.launch': sfx('missile.launch', 3, 0.3, { pitch: [0.92, 1.08], cooldownMs: 90, maxVoices: 3 }),
  'ballistic.launch': sfx('ballistic.launch', 2, 0.32, { pitch: [0.93, 1.05], cooldownMs: 120, maxVoices: 2 }),
  'ballistic.whistle': sfx('ballistic.whistle', 2, 0.32, { pitch: [0.97, 1.03], cooldownMs: 120, maxVoices: 3 }),
  'impact.splash': sfx('impact.splash', 3, 0.5, { pitch: [0.92, 1.06], cooldownMs: 60, maxVoices: 3 }),
  'cluster.split': sfx('cluster.split', 2, 0.42, { pitch: [0.95, 1.05], cooldownMs: 80, maxVoices: 2 }),
  'mothership.spawn': sfx('mothership.spawn', 1, 0.45, { maxVoices: 2 }),
  'minidrone.spawn': sfx('minidrone.spawn', 2, 0.15, { pitch: [0.9, 1.15], cooldownMs: 150, maxVoices: 2 }),
  'supersonic.lock': alert('supersonic.lock', 0.7, { duck: 0.6 }),
  'aircraft.warn': alert('aircraft.warn', 0.75, { cooldownMs: 600, duck: 0.5, duckMs: 700 }),

  'kill.small': sfx('kill.small', 5, 0.36, { pitch: [0.9, 1.12], cooldownMs: 35, maxVoices: 4 }),
  'kill.missile': sfx('kill.missile', 4, 0.5, { pitch: [0.92, 1.08], cooldownMs: 40, maxVoices: 4 }),
  'kill.big': sfx('kill.big', 3, 0.85, { pitch: [0.94, 1.04], cooldownMs: 80, maxVoices: 2 }),

  'strafer.pass': sfx('strafer.pass', 1, 0.4),
  'strafer.guns': sfx('strafer.guns', 2, 0.5, { pitch: [0.96, 1.04], cooldownMs: 300, maxVoices: 2 }),
  'bomber.pass': sfx('bomber.pass', 1, 0.4),
  'bomber.drop': sfx('bomber.drop', 2, 0.4, { pitch: [0.95, 1.05], cooldownMs: 120, maxVoices: 2 }),

  'sub.surface': sfx('sub.surface', 1, 0.5, { cooldownMs: 200, maxVoices: 2 }),
  'sub.fire': sfx('sub.fire', 2, 0.32, { pitch: [0.94, 1.06], cooldownMs: 100, maxVoices: 2 }),
  'sub.dive': sfx('sub.dive', 1, 0.4, { maxVoices: 2 }),
  'sub.destroyed': sfx('sub.destroyed', 1, 0.85, { maxVoices: 2 }),
  'truck.raise': sfx('truck.raise', 1, 0.3, { pitch: [0.95, 1.05], cooldownMs: 150, maxVoices: 2 }),
  'truck.fire': sfx('truck.fire', 2, 0.28, { pitch: [0.94, 1.06], cooldownMs: 100, maxVoices: 2 }),
  'truck.destroyed': sfx('truck.destroyed', 1, 0.8, { maxVoices: 2 }),
  'debut.sting': alert('debut.sting', 1, { cooldownMs: 1500, duck: 0.35, duckMs: 900 }),

  // Hulls: your losses are louder than your kills.
  'ship.hit': sfx('ship.hit', 3, 0.6, { pitch: [0.94, 1.05], cooldownMs: 60, maxVoices: 3 }),
  'ship.sunk': sfx('ship.sunk', 2, 0.9, { cooldownMs: 120, maxVoices: 2 }),
  'ship.delivered': ui('ship.delivered', 0.28, { pitch: [0.98, 1.02], cooldownMs: 250, maxVoices: 1 }),
  'carrier.hit': sfx('carrier.hit', 2, 0.95, { cooldownMs: 120, maxVoices: 2 }),
  'carrier.critical': alert('carrier.critical', 0.5, { duck: 0.8 }),
  'last.ship': alert('last.ship', 0.6, { cooldownMs: 3000 }),
  glance: sfx('glance', 3, 0.42, { pitch: [0.9, 1.12], cooldownMs: 60, maxVoices: 2 }),
  repair: sfx('repair', 1, 0.4, { cooldownMs: 400 }),
  'pd.fire': sfx('pd.fire', 3, 0.3, { pitch: [0.94, 1.06], cooldownMs: 80, maxVoices: 2 }),

  // Power-ups
  'powerup.drop': sfx('powerup.drop', 1, 0.35, { cooldownMs: 150, maxVoices: 2 }),
  'powerup.expire': sfx('powerup.expire', 1, 0.25, { cooldownMs: 150, maxVoices: 1 }),
  'overdrive.on': sfx('overdrive.on', 1, 0.6),
  'overdrive.off': sfx('overdrive.off', 1, 0.45),
  'timewarp.on': sfx('timewarp.on', 1, 0.6),
  'timewarp.off': sfx('timewarp.off', 1, 0.45),
  'shield.on': sfx('shield.on', 1, 0.6),
  'shield.block': sfx('shield.block', 3, 0.4, { pitch: [0.92, 1.1], cooldownMs: 50, maxVoices: 3 }),
  'shield.off': sfx('shield.off', 1, 0.45),
  'steam.on': sfx('steam.on', 1, 0.55),
  'steam.off': sfx('steam.off', 1, 0.35),
  'repair.pickup': sfx('repair.pickup', 1, 0.55),

  // Waves and flow
  'wave.start': alert('wave.start', 0.4, { duck: 1 }),
  'wave.cleared': alert('wave.cleared', 0.5, { duck: 0.6 }),
  'map.cleared': alert('map.cleared', 0.6, { duck: 0.5 }),
  'run.lost': alert('run.lost', 0.6, { duck: 0.5 }),
  'raid.warning': alert('raid.warning', 0.8, { cooldownMs: 1500, duck: 0.45, duckMs: 1300 }),
  // A wave's later raids: a short ping, not the siren again (round 6: a
  // siren every ~5 s, twelve a minute, from wave 1).
  'raid.next': alert('raid.next', 1, { cooldownMs: 1500, duck: 0.45, duckMs: 650 }),
  notice: ui('notice', 0.4, { cooldownMs: 400, maxVoices: 1 }),

  // UI (CC0 recordings from the uisfx library)
  'ui.tap': ui('ui.tap', 0.6, { pitch: [0.98, 1.02], cooldownMs: 40, maxVoices: 2 }),
  'ui.back': ui('ui.back', 0.6, { cooldownMs: 40, maxVoices: 2 }),
  'ui.toggle': ui('ui.toggle', 0.6, { cooldownMs: 40, maxVoices: 2 }),
  'draft.open': ui('draft.open', 0.6),
  'card.pick': ui('card.pick', 0.7, { maxVoices: 1 }),
  'card.swap': ui('card.swap', 0.6, { maxVoices: 1 }),
  'card.max': ui('card.max', 0.75, { maxVoices: 1 }),
  'armory.equip': ui('armory.equip', 0.6, { maxVoices: 1 }),
  'armory.tab': ui('armory.tab', 0.5, { cooldownMs: 40, maxVoices: 1 }),
  'card.won': ui('card.won', 0.65, { pitch: [0.97, 1.03], maxVoices: 3 }),
  'card.new': ui('card.new', 0.7, { maxVoices: 2 }),

  // Music beds (seamless loops, crossfaded by screen)
  'menu.music': { files: v('menu.music', 1), bus: 'music', volume: 0.5 },
  'battle.music': { files: v('battle.music', 1), bus: 'music', volume: 0.45 },
  'battle.intense': { files: v('battle.intense', 1), bus: 'music', volume: 0.45 },
  'result.music': { files: v('result.music', 1), bus: 'music', volume: 0.5 },
};

/** Where each UI cue's recording came from: a sound in the uisfx library
 *  (CC0; tools/v3/audio/fetch-uisfx.mjs fetches it). Every other cue is
 *  synthesized by tools/v3/audio/synth.py. */
export const UISFX_SOURCE: Partial<Record<CueId, string>> = {
  'ui.tap': 'mechanical/press',
  'ui.back': 'mechanical/back',
  'ui.toggle': 'mechanical/toggle-on',
  'draft.open': 'scifi/expand',
  'card.pick': 'mechanical/select',
  'card.swap': 'scifi/reorder',
  'card.max': 'cinematic/level-up',
  'armory.equip': 'mechanical/lock',
  'armory.tab': 'mechanical/select',
  'card.won': 'cinematic/reward',
  'card.new': 'cinematic/achievement',
  notice: 'scifi/notification',
};
