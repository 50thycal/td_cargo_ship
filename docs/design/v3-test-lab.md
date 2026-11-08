# V3 Test Lab: the design (not built yet)

A playtest mode for testing new things fast, asked for on 2026-11-08 after the enemy build. The player wanted:
- a screen that says what's being tested and what's left;
- normal-feeling waves with the thing under test mixed in;
- quick changes of wave and weapons;
- notes that are recorded;
- everything lining up with the review pages.

- **Review page:** https://claude.ai/artifact/SzK5Boc4CrB9wrtMbd7249. It is built by `node tools/v3/test-lab/page.mjs <out.html>` from `tools/v3/test-lab/lab.mjs`; edit that, not the page. Its store:
  - `reviews/{pieceId}`: `verdict` (approve, change or cut) and `note`, one per design piece;
  - `cards/{cardId}`: `verdict` (keep or drop) and `note`, one per checklist card;
  - `answers/{questionId}`: `choice` and `note`; ids start `tl-`, and `tl-notes` is the free note.
- **What's in it:** eleven design pieces, the 34-card checklist (21 enemies, 5 reworked weapons, 8 combos) and six questions. All of it is in `lab.mjs`.
- **Next:** read the marks, save them beside `lab.mjs` as a dated JSON, and build what was approved.
