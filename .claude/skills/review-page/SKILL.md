---
name: review-page
description: |
  The default way to hand the player a larger design or planning round for Straitwatch: a published HTML review page (a claude.ai artifact with a database) where the player marks each item (Go further / Maybe / Drop, or Approve / Change / Cut), writes notes, and answers the open questions, and the next session reads the saved marks back. Use whenever a round has more than a handful of items or decisions: a brainstorm of weapons, maps, enemies or cards; a plan with open questions; a set of specs or numbers to confirm before a build; a review of build phases. Also use when the player asks for "the HTML page", "the review page", "a page to check off", or to "update the page" with new changes. Skip it for small asks (one or two questions, a single bug, a quick tweak): ask those in chat.
---

# Review pages

The player's rule (2026-11-06): "I love this question in the HTML format, make
that the default for working in this repo when working on the game like this.
Sometimes some will be small so you can skip that, but if it is a larger build
like this it makes it a lot more manageable."

**When:** any round with many items or several decisions, e.g. a brainstorm
of 10+ ideas, a plan with open questions, numbers to confirm before building.
**Not when:** one or two questions, a bug, a tweak; ask in chat.

## The loop

1. **Data first.** Put the round's items and questions in a data module in
   the repo (e.g. `tools/v3/<topic>/*.mjs`), not only in the page. Docs and
   the page are both generated from it, so they can't drift.
2. **Generate the page** with a script in the repo. Copy the newest one as the
   starting point:
   - `tools/v3/weapon-ideas/page2.mjs` (weapons: item cards, a Plan tab with
     questions, per-item checks, changed specs, build phases);
   - `tools/v3/maps-plan/page.ts` (maps: diagrams and verdicts).
3. **Publish it as an Artifact** with `capabilities: {db: {}}`. Load the
   `artifact-capabilities` skill first (and follow the Artifact quickstart for
   a new page). Check it once at 390 px wide in dark mode (no page errors, no
   sideways scroll), then publish.
4. **Verify the store:** one `ArtifactData` `list` of each collection the page
   writes. Tell the player in one line what was checked and that they should
   see "Saved." under the first thing they mark.
5. **Put the link in the design doc** (and the PR), with the collection
   layout, so the next session knows where the marks live.
6. **Read the marks back** when the player says they've responded:
   `ArtifactData` `list` on every collection. Copy them into the repo (a dated
   JSON beside the data, e.g. `review-2026-11-05.json`) so the decisions are
   kept with the code. Count verdicts from that file, not by eye.
7. **Rebuild the plan from the marks** (a doc in `docs/design/`), then
   **update the same page**. Republish the same file path, so the URL stays.
   It opens on a new tab for the next round of questions, and keeps the
   earlier marks visible and editable.

## Page conventions (what the player has liked)

- **Each item:**
  - a card with its name, a one-line pitch and a picture where there is one
    (a concept drawn over a real game frame at 667×375);
  - its strong and weak sides;
  - measured numbers as small bars with the baseline marked;
  - "How it plays" folded away.
- **Verdict buttons:**
  - ideas: Go further / Maybe / Drop;
  - designs to approve: Approve / Change / Cut;
  - specs or numbers: Looks right / Change.
  - Tapping the same button again clears it.
- **Notes:** a notes box on every item and every question. Notes save as the
  player types (debounced), and on blur.
- **Questions:**
  - radio options, with the recommended one first and labelled "(recommended)";
  - a notes box on each;
  - one "Anything else?" box at the end.
- **Tabs** along a sticky bar:
  - the current round first (e.g. "Plan");
  - then all items, each category, and "My picks";
  - a running tally (marked, picked, questions answered).
- **Cut items** stay listed with the reason they were cut and a "Bring back" button.
- **Phone first:** it must read and work at 390 px wide, in light and dark.

## Store layout (keep ids stable across rounds)

Each document is `{ ...fields, at: ISO time }`.

| Collection | Fields | Holds |
|---|---|---|
| `reviews/{itemId}` | `verdict`, `note` | A verdict on an item. |
| `answers/{questionId}` | `choice` (option index), `note` | An answer. |
| `levels/{id}`, or another named collection | `verdict`, `note` | Per-item checks of specs or numbers. |

**Each new round** adds new question ids. Never reuse an id from an earlier round: the earlier answers must stay readable.

**Before the store answers,** marks are kept in `localStorage` with `pending: true`. They are pushed once the store connects. Never overwrite the store with stale local data.

## Writing the page

- **Plain words.** Question text must stand on its own, since the player may
  read it on a phone, days later.
- **Show the evidence beside the decision:**
  - the measured numbers;
  - the player's own quote when a spec changed because of it.
- **Keep it truthful.** Every number on the page comes from the data module or
  a results file, not retyped.
