// Saltgate Canal's shared waves (threat scale 0.9), for the encounter budget:
//   npx vite-node tools/v3/saltgate/spec.ts
import { waveSpec } from '../../../src/v3/data/waves';
for (let w = 1; w <= 10; w++) console.log(w, JSON.stringify(waveSpec(w, 0.9)));
