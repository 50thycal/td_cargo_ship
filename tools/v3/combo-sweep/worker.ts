// A combo-sweep worker (tools/v3/combo-sweep/pool.ts forks one a core): takes
// jobs over IPC, plays each (play.ts) and sends the run back.

import { playCombo, type ComboJob } from './play';

type Msg = { id: number; job: ComboJob } | { stop: true };

process.on('message', (m: Msg) => {
  if ('stop' in m) process.exit(0);
  try {
    const run = playCombo(m.job);
    process.send!({ id: m.id, run });
  } catch (e) {
    process.send!({ id: m.id, error: (e as Error).stack ?? String(e) });
  }
});
process.send!({ ready: true });
