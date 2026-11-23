// Types for split.mjs (the Test Lab page's live split), for its tests.
export interface Line { round: number; what: string }
export interface SplitCard { id: string; kind: string; rev: number; changes: Line[]; own: Line[]; [k: string]: unknown }
export interface SplitResult { rev?: number; round?: number; verdict?: string | null; [k: string]: unknown }
export type Status = 'new' | 'retest' | 'done';
export interface ToTest<C extends SplitCard = SplitCard> { card: C; result: SplitResult | undefined; status: Status; since: Line[]; now: boolean }
export interface Done<C extends SplitCard = SplitCard> { card: C; result: SplitResult; status: 'done' }
export interface Section { kind: string; name: string; blurb: string }

export function cardStatus(card: SplitCard, result: SplitResult | undefined): Status;
export function changesSince(result: SplitResult | undefined, lines: Line[]): Line[];
export function splitCards<C extends SplitCard>(cards: C[], results: Record<string, SplitResult>, round: number): { toTest: ToTest<C>[]; done: Done<C>[] };
export function groupBySection<E extends { card: SplitCard }>(entries: E[], sections: Section[]): { section: Section; entries: E[] }[];
export function untestedEarlier<C extends SplitCard>(cards: C[], results: Record<string, SplitResult>, round: number): { card: C; lines: Line[]; latest: number }[];
export function isAnswered(a: { choice?: number | null; note?: string } | undefined): boolean;
