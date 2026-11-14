// Types for scores.mjs (the Test Lab page's map scorecards), for its tests.
export interface ScoreOptionDef { id: string; label: string; value: number }
export interface ScoreCatDef { id: string; label: string; help?: string; scale: { kind: 'stars' | 'choice' | 'wave'; options?: ScoreOptionDef[] }; boss?: boolean }
export interface ScorecardDef { rev: number; bossFrom: number; categories: ScoreCatDef[] }
export type Score = { rev?: number; [id: string]: number | string | undefined };
export interface Run { rev?: number; variant?: string; end?: 'won' | 'lost' | 'quit'; score?: Score; auto?: { delivered: number; deliveredPct: number | null; lost: number; firstLoss: number | null }; [k: string]: unknown }
export type Average = { n: number; mean?: number; near?: string; counts?: Record<string, number>; top?: number; topCount?: number };
export interface Numbers { runs: number; won: number; deliveredPct: number | null; lost: number | null }
export interface Group { variant: string; numbers: Numbers; scored: number; averages: Record<string, Average> }

export function waveName(n: number, bossFrom: number): string;
export function answerWords(cat: ScoreCatDef, v: number | string, bossFrom: number): string;
export function scoreChips(score: Score | undefined, sc: ScorecardDef): { id: string; label: string; text: string }[];
export function scoreAverages(runs: Run[], sc: ScorecardDef): Record<string, Average>;
export function runNumbers(runs: Run[]): Numbers;
export function scoreGroups(runs: Run[] | undefined, sc: ScorecardDef): { rev: number; groups: Group[]; older: number };
export function averageWords(cat: ScoreCatDef, a: Average | undefined, bossFrom: number): string;
