// The few Node built-ins the audio tests use (the project has no @types/node;
// vitest runs the tests under Node).
declare module 'node:fs' {
  export function existsSync(path: string): boolean;
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function statSync(path: string): { size: number };
}
declare module 'node:child_process' {
  export function execFileSync(file: string, args: string[], opts?: { stdio?: 'ignore' | 'inherit'; encoding?: 'utf8' }): string;
}
