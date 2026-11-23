// The store build has no in-game keyboard (it has no text boxes): vite.config.ts
// swaps ./keys for this, so none of palate-keys or its word list is bundled.
import type { KeysHooks } from './keys';

export type { KeysHooks };
export function startKeys(_root: HTMLElement, _hooks: KeysHooks): void {}
