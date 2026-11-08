// The Test Lab's bridge to the review pages (tools/v3/test-lab/results.mts),
// as a pure function: from game logs, one document per card for the Test
// Lab page's `results/{cardId}` and, for enemy cards, the enemy page's
// `builds/{id}`. Logs are grouped by card and test round (a log from before
// rounds is round 1): a card's document is its latest round's latest
// verdict, with the earlier rounds' verdicts as its history.

import { cardChangeList, labCard } from '../data/lab';
import { evidenceLines } from './lab';
import type { LabResult, PlayLog } from './playlog';

export interface LabResultDoc {
  verdict: LabResult['verdict'];
  tags: string[];
  note: string;
  evidence: string;
  ended: LabResult['ended'];
  log: string;
  at: string;
  /** The round it was tested in, the card's version then, and what changed
   *  in the card in that round. */
  round: number;
  rev: number;
  changes: string[];
  /** The latest verdict of each earlier round, newest first. */
  history: { round: number; verdict: LabResult['verdict']; note: string; at: string; log: string }[];
}

export interface LabBuildDoc {
  verdict: NonNullable<LabResult['verdict']>;
  note: string;
  at: string;
  round: number;
}

const when = (l: PlayLog) => l.endedAt ?? l.startedAt;
/** A log's round: what it says, else round 1 (logs from before rounds). */
export const logRound = (l: PlayLog): number => l.labResult?.round ?? l.lab?.round ?? 1;

export function labResultDocs(logs: PlayLog[]): { results: Record<string, LabResultDoc>; builds: Record<string, LabBuildDoc> } {
  // card → round → its latest log.
  const byCard = new Map<string, Map<number, PlayLog>>();
  for (const l of logs) {
    if (!l.lab || !l.labResult) continue;
    const rounds = byCard.get(l.lab.card) ?? new Map<number, PlayLog>();
    byCard.set(l.lab.card, rounds);
    const r = logRound(l);
    const prev = rounds.get(r);
    if (!prev || when(l) > when(prev)) rounds.set(r, l);
  }
  const results: Record<string, LabResultDoc> = {};
  const builds: Record<string, LabBuildDoc> = {};
  for (const [id, rounds] of byCard) {
    const card = labCard(id);
    if (!card) continue;
    const order = [...rounds.keys()].sort((a, b) => b - a);
    const l = rounds.get(order[0])!;
    const r = l.labResult!;
    const round = order[0];
    const doc: LabResultDoc = {
      verdict: r.verdict,
      tags: r.tags,
      note: r.note,
      evidence: evidenceLines(card, r.stats, r.waves).join(' · '),
      ended: r.ended,
      log: l.id,
      at: when(l),
      round,
      rev: r.rev ?? l.lab!.rev ?? 1,
      changes: cardChangeList(id).filter((c) => c.round === round).map((c) => c.what),
      history: order.slice(1).map((n) => {
        const o = rounds.get(n)!;
        return { round: n, verdict: o.labResult!.verdict, note: o.labResult!.note, at: when(o), log: o.id };
      }),
    };
    results[id] = doc;
    // An enemy card's verdict also goes on the enemy page's Build tab.
    if (card.kind === 'enemy' && r.verdict) builds[id] = { verdict: r.verdict, note: [r.note, r.tags.join(', ')].filter(Boolean).join(' · '), at: doc.at, round };
  }
  return { results, builds };
}
