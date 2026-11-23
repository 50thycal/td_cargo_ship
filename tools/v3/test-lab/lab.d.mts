// Types for lab.mjs (the Test Lab design round, each round's questions and
// docs), for its tests.
export interface OpenQuestion { id: string; round: number; text: string; options: string[]; why?: string }
export const ROUND_DATE: string;
export const ASK: string;
export const TODAY: string[];
export const PIECES: Record<string, unknown>[];
export const SECTIONS: Record<string, unknown>[];
export const CARDS: Record<string, unknown>[];
export const QUESTIONS: Record<string, unknown>[];
export const OPEN_QUESTIONS: OpenQuestion[];
export const ROUND_DOCS: Record<number, { doc: string; summary: string }>;
