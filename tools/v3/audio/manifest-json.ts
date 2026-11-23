// Print the sound manifest as JSON for the Python prep and QA tools.
//   npx vite-node tools/v3/audio/manifest-json.ts
import { CUE_IDS, LOOP_CUES, MUSIC_CUES } from '../../../src/v3/audio/cues';
import { BUS_LUFS, SOUNDS, UISFX_SOURCE } from '../../../src/v3/audio/manifest';

process.stdout.write(JSON.stringify({ cues: CUE_IDS, loops: LOOP_CUES, music: MUSIC_CUES, busLufs: BUS_LUFS, sounds: SOUNDS, uisfx: UISFX_SOURCE }));
