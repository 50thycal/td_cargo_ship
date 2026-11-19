// Runs combo-sweep jobs over the machine's cores (one forked vite-node
// worker a core) and caches every run to a JSON-lines file as it comes back,
// so a stage that is stopped picks up where it left off.

import { fork, type ChildProcess } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, resolve } from 'node:path';
import type { ComboJob, ComboRun } from './play';

/** A job's cache key: everything that decides the run. */
export function jobKey(j: ComboJob): string {
  const a = Object.entries(j.armory)
    .filter(([, v]) => v)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([k, v]) => `${k}${v}`)
    .join('.');
  const l = j.loadout ? (j.loadout.length ? j.loadout.join('+') : 'plain') : 'self';
  return [j.map, j.seed, l, j.thenSelf ? 'then-self' : '', a || 'no-armory', j.persona ?? 'you', j.normal ? 'normal' : 'tough', j.tension ? 't' : ''].join('|');
}

export function loadCache(file: string): Map<string, ComboRun> {
  const out = new Map<string, ComboRun>();
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const { key, run } = JSON.parse(line) as { key: string; run: ComboRun };
      out.set(key, run);
    } catch {
      // A line cut short by a stop: played again.
    }
  }
  return out;
}

/** Runs played (not read from the cache) by this process so far. */
export const counter = { played: 0 };

const WORKER = resolve(dirname(new URL(import.meta.url).pathname), 'worker.ts');
const VITE_NODE = resolve('node_modules/vite-node/vite-node.mjs');

/** Play every job not in the cache; returns each job's run, in order. */
export async function runJobs(jobs: ComboJob[], cacheFile: string, o: { procs?: number; label?: string } = {}): Promise<ComboRun[]> {
  mkdirSync(dirname(cacheFile), { recursive: true });
  const cache = loadCache(cacheFile);
  const keys = jobs.map(jobKey);
  const todo = [...new Set(keys.filter((k) => !cache.has(k)))].map((k) => jobs[keys.indexOf(k)]);
  const label = o.label ?? 'jobs';
  if (todo.length) {
    const procs = Math.max(1, Math.min(o.procs ?? availableParallelism(), todo.length));
    const t0 = Date.now();
    let done = 0;
    let next = 0;
    let lastLog = 0;
    console.log(`${label}: ${todo.length} runs to play (${jobs.length - todo.length} cached), ${procs} workers`);
    await new Promise<void>((ok, fail) => {
      let live = procs;
      const feed = (w: ChildProcess) => {
        if (next >= todo.length) {
          w.send({ stop: true });
          return;
        }
        const id = next++;
        w.send({ id, job: todo[id] });
      };
      for (let p = 0; p < procs; p++) {
        const w = fork(VITE_NODE, [WORKER], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        w.on('message', (m: { ready?: true; id?: number; run?: ComboRun; error?: string }) => {
          if (m.ready) return feed(w);
          if (m.error) {
            w.kill();
            fail(new Error(`job ${jobKey(todo[m.id!])}: ${m.error}`));
            return;
          }
          const key = jobKey(todo[m.id!]);
          cache.set(key, m.run!);
          appendFileSync(cacheFile, `${JSON.stringify({ key, run: m.run })}\n`);
          done++;
          counter.played++;
          const now = Date.now();
          if (now - lastLog > 15000 || done === todo.length) {
            lastLog = now;
            const s = (now - t0) / 1000;
            const eta = (s / done) * (todo.length - done);
            console.log(`  ${label}: ${done}/${todo.length} in ${s.toFixed(0)} s, ~${(eta / 60).toFixed(1)} min left`);
          }
          feed(w);
        });
        w.on('exit', (code) => {
          live--;
          if (code && code !== 0 && done < todo.length) fail(new Error(`worker exited with ${code}`));
          else if (live === 0) ok();
        });
      }
    });
  } else console.log(`${label}: all ${jobs.length} runs cached`);
  return keys.map((k) => cache.get(k)!);
}
