// Types for scores.mjs (the Test Lab page's map scorecards), for its tests.
export interface ScoreOptionDef { id: string; label: string; value: number }
export interface ScoreCatDef { id: string; label: string; help?: string; scale: { kind: 'stars' | 'choice' | 'wave'; options?: ScoreOptionDef[] }; boss?: boolean; retired?: number; since?: number; compare?: boolean }
export interface ScorecardDef { rev: number; bossFrom: number; categories: ScoreCatDef[] }
export interface WaveScoreDef { n: number; difficulty?: number; fun?: number; intensity?: number; note?: string }
export type Score = { rev?: number; waves?: WaveScoreDef[]; [id: string]: number | string | WaveScoreDef[] | undefined };
export interface Run { rev?: number; variant?: string; end?: 'won' | 'lost' | 'quit'; played?: 'full playtest' | 'sim' | 'mixed'; score?: Score; auto?: { delivered: number; deliveredPct: number | null; lost: number; firstLoss: number | null }; [k: string]: unknown }
export type Average = { n: number; mean?: number; near?: string; counts?: Record<string, number>; top?: number; topCount?: number };
export interface Numbers { runs: number; won: number; deliveredPct: number | null; lost: number | null; bot?: number }
export interface Group { variant: string; numbers: Numbers; scored: number; oldScored: number; averages: Record<string, Average> }

export function waveName(n: number, bossFrom: number): string;
export function answerWords(cat: ScoreCatDef, v: number | string, bossFrom: number): string;
export function scoreChips(score: Score | undefined, sc: ScorecardDef): { id: string; label: string; text: string }[];
export function scoreAverages(runs: Run[], sc: ScorecardDef, rev?: number): Record<string, Average>;
export function runNumbers(runs: Run[]): Numbers;
export function scoreGroups(runs: Run[] | undefined, sc: ScorecardDef): { rev: number; groups: Group[]; older: number };
export function waveRatingChips(score: Score | undefined, bossFrom: number): { id: string; label: string; text: string; note?: string }[];
export function waveRatingAverages(runs: Run[] | undefined): Record<string, { n: number; fun?: number; difficulty?: number; intensity?: number }>;
export function suggestionsKept(runs: Run[] | undefined): { best: { suggested: number; kept: number }; weakest: { suggested: number; kept: number } };
export function averageWords(cat: ScoreCatDef, a: Average | undefined, bossFrom: number): string;
