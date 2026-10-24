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

const TABLE: WaveSpec[] = [
  { duration: 30, drones: 10, swarm: 3, ballistic: 0, guided: 0, speed: 1.0 },
  { duration: 36, drones: 14, swarm: 3, ballistic: 0, guided: 0, speed: 1.05 },
  { duration: 40, drones: 14, swarm: 4, ballistic: 3, guided: 0, speed: 1.1 },
  { duration: 44, drones: 16, swarm: 5, ballistic: 5, guided: 0, speed: 1.15 },
  { duration: 44, drones: 16, swarm: 6, ballistic: 4, guided: 2, speed: 1.2 },
  { duration: 48, drones: 20, swarm: 6, ballistic: 6, guided: 3, speed: 1.25 },
  { duration: 50, drones: 24, swarm: 8, ballistic: 6, guided: 4, speed: 1.3 },
  { duration: 52, drones: 24, swarm: 8, ballistic: 8, guided: 5, speed: 1.35 },
  { duration: 54, drones: 30, swarm: 10, ballistic: 8, guided: 6, speed: 1.4 },
  { duration: 56, drones: 36, swarm: 12, ballistic: 10, guided: 8, speed: 1.5 },
];

/** Waves past the table (endless mode) keep growing from the last row. */
export function waveSpec(wave: number, threatScale = 1): WaveSpec {
  const base = TABLE[Math.min(wave, TABLE.length) - 1];
  const extra = Math.max(0, wave - TABLE.length);
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
