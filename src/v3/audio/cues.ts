// SOUND CUES. The sim says *when* a sound belongs (a cue on the exact step its
// visual happens); the manifest says *what* it sounds like; the engine plays
// it. Pure data: the sim imports this, so nothing here may touch the DOM.
//
// Every cue id is in CUE_IDS, and the manifest is a Record over CueId, so a
// cue without a sound is a compile error (docs/design/v3-sound-handoff.md).

export const CUE_IDS = [
  // Gun and ammo
  'gun.fire',
  'gun.dry',
  'gun.reload',
  'gun.burst',
  'rack.full',
  // Weapons: Air Strike / Carpet Strike
  'jet.flyby',
  'jet.guns',
  'napalm.drop',
  'napalm.burst',
  'burn.loop',
  // Shrapnel, Frigates, Thermobaric, Scattergun
  'shrapnel.burst',
  'frigate.arrive',
  'frigate.fire',
  'frigate.leave',
  'thermo.burst',
  'scatter.blast',
  // Boomerang
  'blade.throw',
  'blade.spin',
  'blade.catch',
  'blade.hit',
  // Flak, Seekers, Aegis
  'flak.burst',
  'flak.cloud',
  'seeker.launch',
  'aegis.launch',
  'aegis.reload',
  // Gravity Well, Railgun, Tesla
  'well.open',
  'well.pull',
  'well.implode',
  'rail.beam',
  'tesla.arc',
  // Weapon state
  'weapon.drop',
  'weapon.load',
  'weapon.expiring',
  'weapon.done',
  // Threat launches and warnings
  'drone.launch',
  'missile.launch',
  'ballistic.launch',
  'ballistic.whistle',
  'impact.splash',
  'cluster.split',
  'mothership.spawn',
  'minidrone.spawn',
  'supersonic.lock',
  'aircraft.warn',
  // Kills
  'kill.small',
  'kill.missile',
  'kill.big',
  // Aircraft
  'strafer.pass',
  'strafer.guns',
  'bomber.pass',
  'bomber.drop',
  // Raiders
  'sub.surface',
  'sub.fire',
  'sub.dive',
  'sub.destroyed',
  'truck.raise',
  'truck.fire',
  'truck.destroyed',
  'debut.sting',
  // Hulls
  'ship.hit',
  'ship.sunk',
  'ship.delivered',
  'carrier.hit',
  'carrier.critical',
  'last.ship',
  'glance',
  'repair',
  'pd.fire',
  // Power-ups
  'powerup.drop',
  'powerup.expire',
  'overdrive.on',
  'overdrive.off',
  'timewarp.on',
  'timewarp.off',
  'shield.on',
  'shield.block',
  'shield.off',
  'steam.on',
  'steam.off',
  'repair.pickup',
  // Waves and flow
  'wave.start',
  'wave.cleared',
  'map.cleared',
  'run.lost',
  'raid.warning',
  'raid.next',
  'notice',
  // UI
  'ui.tap',
  'ui.back',
  'ui.toggle',
  'draft.open',
  'card.pick',
  'card.swap',
  'card.max',
  'armory.equip',
  'armory.tab',
  'card.won',
  'card.new',
  // Music
  'menu.music',
  'battle.music',
  'battle.intense',
  'result.music',
] as const;

export type CueId = (typeof CUE_IDS)[number];

/** A sound the sim asks for, at a place on the battlefield (world units:
 *  x pans it). `vx` (world units/s) moves the pan while it plays, for a
 *  jet crossing the screen. `gain` scales it (1 = the manifest level). */
export interface Cue {
  id: CueId;
  x: number;
  y: number;
  vx?: number;
  gain?: number;
}

/** Cues that are held on while a state lasts, not fired once: the engine
 *  starts each when it appears in `activeLoops` and fades it when it goes. */
export const LOOP_CUES = ['burn.loop', 'blade.spin', 'well.pull', 'supersonic.lock', 'carrier.critical', 'strafer.pass', 'bomber.pass'] as const satisfies readonly CueId[];
export type LoopCue = (typeof LOOP_CUES)[number];

export const MUSIC_CUES = ['menu.music', 'battle.music', 'battle.intense', 'result.music'] as const satisfies readonly CueId[];
export type MusicCue = (typeof MUSIC_CUES)[number];

/** Cues the UI plays itself (screens, buttons, alerts it decides on). The
 *  rest come from the sim. */
export const UI_CUES = [
  'last.ship',
  'wave.cleared',
  'map.cleared',
  'run.lost',
  'raid.warning',
  'raid.next',
  'notice',
  'ui.tap',
  'ui.back',
  'ui.toggle',
  'draft.open',
  'card.pick',
  'card.swap',
  'card.max',
  'armory.equip',
  'armory.tab',
  'card.won',
  'card.new',
] as const satisfies readonly CueId[];
