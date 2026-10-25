// THE DIFFICULTY CURVE. One table, read top to bottom. There is no adaptive
// enemy: every run on a map escalates the same way, and only launch timing and
// targets vary with the seed. Tuning the game = editing these rows.

export interface WaveSpec {
  /** Seconds over which this wave's launches are spread. */
  duration: number;
  drones: number;
  /** Drones launch in swarms of up to this many. */
  swarm: number;
  ballistic: number;
  guided: number;
  /** Multiplies every threat's speed. */
  speed: number;
}

export const WAVE_TABLE: WaveSpec[] = [
  // Round 3: ~1.25× the drones and ~1.15× the missiles of round 2, launched in
  // raids (see RAID in config.ts) — the player's runs showed an empty screen
  // a third to half of every wave.
  { duration: 30, drones: 16, swarm: 4, ballistic: 0, guided: 0, speed: 1.0 },
  { duration: 36, drones: 19, swarm: 5, ballistic: 2, guided: 0, speed: 1.05 },
  { duration: 40, drones: 22, swarm: 5, ballistic: 4, guided: 1, speed: 1.1 },
  { duration: 44, drones: 25, swarm: 6, ballistic: 5, guided: 1, speed: 1.15 },
  { duration: 44, drones: 25, swarm: 7, ballistic: 5, guided: 2, speed: 1.2 },
  { duration: 48, drones: 27, swarm: 7, ballistic: 7, guided: 3, speed: 1.25 },
  { duration: 50, drones: 31, swarm: 9, ballistic: 7, guided: 5, speed: 1.3 },
  { duration: 52, drones: 32, swarm: 9, ballistic: 9, guided: 6, speed: 1.35 },
  { duration: 54, drones: 38, swarm: 11, ballistic: 9, guided: 7, speed: 1.4 },
  { duration: 56, drones: 45, swarm: 13, ballistic: 11, guided: 9, speed: 1.5 },
];

/** Waves past the table (endless mode) keep growing from the last row. */
export function waveSpec(wave: number, threatScale = 1): WaveSpec {
  const base = WAVE_TABLE[Math.min(wave, WAVE_TABLE.length) - 1];
  const extra = Math.max(0, wave - WAVE_TABLE.length);
  const grow = 1 + 0.12 * extra;
  const n = (v: number) => Math.round(v * grow * threatScale);
  return {
    duration: base.duration + extra * 2,
    drones: n(base.drones),
    swarm: Math.min(16, base.swarm + Math.floor(extra / 2)),
    ballistic: n(base.ballistic),
    guided: n(base.guided),
    speed: Math.min(1.8, base.speed + 0.05 * extra),
  };
}
