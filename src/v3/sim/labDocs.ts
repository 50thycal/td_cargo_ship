// The Test Lab's bridge to the review pages (tools/v3/test-lab/results.mts),
// as a pure function: from game logs, one document per card for the Test
// Lab page's `results/{cardId}` and, for enemy cards, the enemy page's
// `builds/{id}`. Logs are grouped by card and test round (a log from before
// rounds is round 1): a card's document is its latest round's latest
// verdict, with the earlier rounds' verdicts as its history.

import { LAB_ROUNDS, cardChangeList, labCard, retiredCard } from '../data/lab';
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
  /** A card since cut from the lab (LAB_RETIRED): the round it went in,
   *  and why. Its verdicts are kept, under the page's Cut cards. */
  cut?: { round: number; why: string };
}

export interface LabBuildDoc {
  verdict: NonNullable<LabResult['verdict']>;
  note: string;
  at: string;
  round: number;
}

const when = (l: PlayLog) => l.endedAt ?? l.startedAt;
/** A log's round: what it says; a log from before rounds, by the build it
 *  was played on (the latest round whose builds had started); else 1. */
export const logRound = (l: PlayLog): number =>
  l.labResult?.round ?? l.lab?.round ?? Math.max(1, ...LAB_ROUNDS.filter((r) => r.since && /^\d{4}-/.test(l.build ?? '') && l.build >= r.since).map((r) => r.n));

export function labResultDocs(logs: PlayLog[]): { results: Record<string, LabResultDoc>; builds: Record<string, LabBuildDoc> } {
  // card → round → its latest log; and every log of each round (a card
  // tested twice in a round keeps both notes).
  const byCard = new Map<string, Map<number, PlayLog>>();
  const allOf = new Map<string, PlayLog[]>();
  for (const l of logs) {
    if (!l.lab || !l.labResult) continue;
    const rounds = byCard.get(l.lab.card) ?? new Map<number, PlayLog>();
    byCard.set(l.lab.card, rounds);
    const r = logRound(l);
    const prev = rounds.get(r);
    if (!prev || when(l) > when(prev)) rounds.set(r, l);
    const key = `${l.lab.card}#${r}`;
    allOf.set(key, [...(allOf.get(key) ?? []), l]);
  }
  /** A round's notes: each test's own words, oldest first, joined. A later
   *  test's note that starts with an earlier note of the same round (the
   *  verdict sheet fills in the last note, and the player replayed the card
   *  just to set a verdict) keeps only what it adds. */
  const roundNote = (id: string, round: number, earlier: string[]): string => {
    const seen: string[] = [];
    for (const l of [...(allOf.get(`${id}#${round}`) ?? [])].sort((a, b) => (when(a) < when(b) ? -1 : 1))) {
      const n = ownNote(l.labResult!.note, [...earlier, ...seen]).trim();
      if (n && !seen.includes(n)) seen.push(n);
    }
    return seen.join(' · ');
  };
  const results: Record<string, LabResultDoc> = {};
  const builds: Record<string, LabBuildDoc> = {};
  for (const [id, rounds] of byCard) {
    // A card cut since keeps its verdicts (round 8: the four combos with a
    // player weapon in them); an id the lab never had is dropped.
    const gone = retiredCard(id);
    const card = labCard(id) ?? gone;
    if (!card) continue;
    const order = [...rounds.keys()].sort((a, b) => b - a);
    const l = rounds.get(order[0])!;
    const r = l.labResult!;
    const round = order[0];
    const note = roundNote(id, round, order.slice(1).flatMap((n) => (allOf.get(`${id}#${n}`) ?? []).map((o) => o.labResult!.note)));
    const doc: LabResultDoc = {
      verdict: r.verdict,
      tags: r.tags,
      note,
      evidence: evidenceLines(card, r.stats, r.waves).join(' · '),
      ended: r.ended,
      log: l.id,
      at: when(l),
      round,
      // A log from before versions: the card's version as of its round.
      rev: r.rev ?? l.lab!.rev ?? cardChangeList(id).filter((c) => c.round <= round).reduce((m, c) => Math.max(m, c.round), 1),
      changes: cardChangeList(id).filter((c) => c.round === round).map((c) => c.what),
      history: order.slice(1).map((n) => {
        const o = rounds.get(n)!;
        return { round: n, verdict: o.labResult!.verdict, note: o.labResult!.note, at: when(o), log: o.id };
      }),
      ...(gone ? { cut: { round: gone.cut, why: gone.why } } : {}),
    };
    results[id] = doc;
    // An enemy card's verdict also goes on the enemy page's Build tab.
    if (card.kind === 'enemy' && r.verdict) builds[id] = { verdict: r.verdict, note: [note, r.tags.join(', ')].filter(Boolean).join(' · '), at: doc.at, round };
  }
  return { results, builds };
}

/** A note without an earlier round's note copied in at its start (before
 *  rounds, the verdict sheet filled in the last note, and the player typed
 *  under it). */
export function ownNote(note: string, earlier: string[]): string {
  for (const old of earlier) {
    const o = old.trim();
    if (o && note.trimStart().startsWith(o)) return note.trimStart().slice(o.length).trim();
  }
  return note;
}
