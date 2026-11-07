# Enemy round 1: the build–test–review–improve cycles

How the enemy round ([v3-enemy-ideas.md](v3-enemy-ideas.md)) was checked before it went to the player. Each cycle had one focus; what it found and what changed is recorded here as it happened.

## What success looks like (the player's view)

1. **Taxonomy:** three categories, each with subcategories, and every enemy in one:
   - today's 21;
   - the player's 18;
   - the 10 new ones.
2. **The player's list:** the best of the 18 are picked, each for a reason that holds up against the actual game.
3. **New ideas:** twenty or more were made and thinned to ten, and every cut says why.
4. **Novelty:** none of the ten is "just another version of another weapon". This is checked by rule (no kept idea shares its answer and its pressure with anything else) and by an unanchored reviewer, not just claimed.
5. **Fair on a phone:** every idea has a visible tell, at least two counters from today's arsenal, and a picture drawn over a real game frame at 667×375.
6. **True:** every claim about today's game matches the code.
7. **The page works:**
   - 390 px wide, light and dark;
   - no errors and no sideways scroll;
   - marks save to the store and read back.
8. **Easy to decide:** verdict buttons on every idea, my recommendation visible, and questions that stand on their own.

## Cycle 1: novelty and fit (an unanchored review)

**Test:**
- `node tools/v3/enemy-ideas/check.mjs` passed on the first draft.
- An independent reviewer then read the data cold, with no view of mine. It scored each kept idea for novelty and fun, checked the claims against `config.ts`, `formations.ts` and `game.ts`, and judged the taxonomy.
- I re-checked its code claims myself before acting.

**Found, all confirmed in the code:**
- **The flow slider doesn't set the convoy's speed.** It sets the gap between ships and the score multiplier (`FLOW_STEPS`). Speed comes from the formation (Column ×1.3 down to Box ×0.8) and Full Steam (`shipSpeed`). The Acoustic Mine ("slowed by the flow control") was built on a control that doesn't do that.
- **Your shots home with lead** (`updateInterceptors`) and burst with a radius:
  - the **Jinking Missile's** sidestep would be followed or caught by the blast;
  - the **Flak Picket's** "aim around it" can't happen.
- **The Limpet Boat** was a test of fingers, not a decision: a tiny target on your own hull, mid-raid. A tap also snaps to the nearest threat, so "exactly on the charge" wouldn't hold.
- **Counter-Fire Radar:** "the next missile aims at the carrier" was weak and abstract, because missiles already go for the carrier (`CARRIER_STRIKE`). Its name also clashed with the allied radar post.
- **Hydra Missile:** "today the last-moment kill is always right" was false; the Cluster missile already punishes a late kill.
- **Lure Beacon:** the helpers it fools would sink a two-hit buoy in a second. Seeker Pod is fired by you, so it can't be both "fooled" and "your own taps".
- **Wrong claims about today's game:**
  - "a heavy hits for four": a direct hit sinks any ship, or takes half the carrier's health;
  - "Air Strike and Bomber Wing hit subs": only Carpet Strike and Bomber Wing at MAX do;
  - "nothing today stays in the air": the Drone Mothership does;
  - "the torpedo is the first threat aimed where a ship will be": the Ballistic missile aims at a predicted point with a reticle;
  - "the Rocket Truck is the first launcher your gun can kill": the Rigs, the Dreadnought and the Citadel can be killed.
- **Taxonomy misfiles:**
  - the Mothership launches and stays, so it is a Platform, not a Strike;
  - the Hijacker Tug acts on a hull itself, so it is a Strike;
  - the Flak Picket works on your shots, so it is Sabotage, not Shield;
  - "Missile" and "Tough" overlapped, because the heavy is a missile.
- **Cost:** pulling a ship off its lane is engine work, so the Tug is large, not medium.

**Changed:**
- **Cut:** Limpet Boat and Jinking Missile, each with the review's reason.
- **In their place:** the **Bodyguard Ring** (brought back from the cuts: with homing shots, drones that take your shots make the order you fire in matter) and the **Fuel Cloud** (the cut Volatile Cloud reworked so its blast burns threats too: a hazard both sides can use).
- **Rebuilt:**
  - the **Acoustic Mine**, on formation and Full Steam;
  - the **Flak Picket**, as a shadow over part of the sky that a burst can push through;
  - the **Counter-Battery Site**, renamed, now lobs a visible shell at the carrier each time your taps fill its meter, so cause and cost are on screen together;
  - the **Lure Beacon**: helpers' shots pass through it, and only your taps hit it.
- **Hydra:** says how it differs from the Cluster.
- **Corrected:** every false claim above.
- **Moved:** Loitering Ambush Drones from maybe to pick, as the reviewer argued (they move and come together, which mines don't).
- **Re-filed:** the Mothership, Tug and Picket. "Missile" is renamed "Precision". The Platform rule now says plainly which ones your gun can't reach.
- **Removed** the question about tapping your own ships (it was only for the Limpet).

**Retest:** `check.mjs`: no problems. Every kept idea still has its own answer and pressure:
- **Answers only the new ideas use:** race, hold, place, throttle.
- **Pressures only they use:** capture, carrier, shots, drops, future, allies.

## Cycle 2: true to the game (claims and counters against the code)

**Test:**
- Each remaining claim in the data was read against the code: `render.ts`'s threat drawing, `game.ts`, `formations.ts` and `config.ts`.
- Each counter was checked against what that weapon actually does after the lock-in build.
- The player's 18 texts, as stored, were printed and compared line by line with the message they came in.

**Found:**
- **Jammer Drone:** "the game already draws target lines" overclaimed. The game draws some indicators (the ballistic reticle, the supersonic lock line, aircraft warning bands, the raid arrows), not a line for every threat.
- **Scavenger Drone's counters** named Drone Screen, which rams "the threat closest to hitting a hull". A drone heading for a pickup would be ignored by it.
- **Fuel Cloud's counters** named Seeker Pod, whose missiles burst, so they would set the cloud off.
- **Attack Helicopter's cost note** pointed to the Gunship Pair's new flight model, which is in the lock-in build (PR #127), not yet on the trunk.
- **The player's 18 texts** match the message exactly.

**Changed:**
- The Jammer's note now lists what the game does draw.
- Scavenger's counters are now Seeker Pod, Laser Cutter and Supply Run (its drops fly straight to the carrier, out of the thief's reach).
- The Fuel Cloud now says beams and cuts don't burst, so the Railgun, Lance and Laser Cutter can fire through it, and those are its counters.
- The helicopter's note names PR #127.

**Retest:** `check.mjs`: no problems.

## Cycle 3: the pictures, as the player will see them

**Test:**
- `tools/v3/enemy-ideas/concepts.mjs` draws each of the 21 ideas (my ten, and the player's eleven picks) over a real paused Free Play frame of The Strait.
- Every picture was looked at, first at full frame, then scaled to a phone card's width (360 px) on contact sheets.

**Found, first pass:**
- An in-game "NEW: Guided missile" banner covered part of the frame.
- Only two ships were on screen, at the far left, so the drawings crowded together.
- A real missile truck on the shore read as part of the Siege Battery picture.
- The real sprites placed for a concept (mines, the heavy, drones, darts) **didn't appear at all**. A paused game redraws only when its step count changes (`App.draw`), so only my overlay showed.
- At card width the labels were about 6 px, too small to read.

**Changed:**
- The banner and the trucks are cleared.
- The convoy is laid out by hand in two even rows of five.
- The step count is nudged after placing sprites, so the game redraws them.
- Each picture is cropped to a 16:9 focus box around its action, about 1.8× zoom.
- The fonts are larger.

**Found, second pass (at 360 px):**
- Labels clipped at the crop's edge (EMP Drone, Torpedo Sub, Flak Picket, Bodyguard Ring, Loitering Drones), because they were kept inside the screen, not the crop.
- Notes fell below the crop (Decoy, Repair Tender, Scavenger, Tug).
- The torpedo sub was too dark to see.
- The Bodyguard Ring's guards (mini-drone sprites) were too small to see.

**Changed:**
- Labels and notes are clamped to the crop box.
- The sub is outlined and lighter.
- The guards are drawn as larger drones.
- The Torpedo Sub's and Attack Helicopter's notes are moved.

**Retest:** all 21 pictures at 360 px. Every label and note is inside its picture and readable, and the sprites are visible. Each picture is about 20 KB (536×300).

## Cycle 4: the page works on a phone

**Test:**
- `tools/v3/enemy-ideas/page.mjs` builds the page.
- Playwright opened it at 390×844 in dark and in light.
- Checks:
  - script errors;
  - sideways scroll on every tab;
  - a Go further mark (saves, and shows "Saved…");
  - My picks gaining and losing a card;
  - a question answer and the tally;
  - a jump from the Overview to an idea's card.
- The Overview, a full card and the Questions tab were screenshotted.

**Found:**
- No script errors, and no sideways scroll (scroll width 390) on any tab, in either theme.
- Marks saved (offline, "Saved in this browser only"). My picks gained and lost the card. The tally counted.
- A jump from the Overview landed the card at y = 0, **under the sticky tab bar**.
- The tabs wrapped to two rows on a phone, so the sticky bar took about 110 px of the screen.

**Changed:**
- The tabs are one row that scrolls inside its own strip, with a smaller tally on a phone.
- Cards, questions and categories got a scroll margin as tall as the bar.

**Retest:** the bar is 83 px, and a jump lands the card at 96 px, just below it. No sideways scroll.

## Cycle 5: plain words and consistency (read as the player)

**Test:**
- The Overview and New 10 tabs were dumped as text (about 3,000 words) and read through as the player would.
- Every label drawn in a picture was compared with its card.
- My own text was scanned for dashes.

**Found:**
- The new cards' answer and pressure chips ("Get there first", "Later raids") had no label. Their explanation was a hover tooltip, which a phone never shows.
- The Attack Helicopter's picture said "12 HITS". No card says that; the player wrote "substantial health".
- Acoustic Mine's decision had a tangled clause ("packed the way that formation packs you").
- Hydra repeated its Cluster comparison in two places.
- The Counter-Battery Site's "a big hit if it lands" was vague. Made exact, "half the carrier's health" every 12 taps was far too harsh for a meter one raid can fill.
- Two cut reasons began "Review:", which means nothing to the player.
- The only dash in my text is a number range ("40–50"), which is fine.

**Changed:**
- The chips read "Answer: …" and "Takes: …".
- "12 HITS" is gone from the picture.
- Acoustic Mine's decision is rewritten.
- Hydra's "what's new" is one sentence.
- The Counter-Battery Site's shell takes a quarter of the carrier's health; it is a proposal for the player to judge.
- The "Review:" prefixes are dropped.

**Retest:** `check.mjs` reports no problems; the page is rebuilt and published (cycle 6).

## Cycle 6: published, and the store checked end to end

**Test:**
- The page was published as its own artifact, with the `db` capability: https://claude.ai/artifact/Sm8d5jmPVxTwihiTiKdtGX
- One `ArtifactData` `list` of each collection the page writes (`reviews`, `answers`).
- A probe document, written in exactly the shape the page writes (`verdict`, `note`, `at`), was read back, then deleted with its version pinned.

**Found:**
- Both collections were empty at publish.
- The probe wrote, read back unchanged, and deleted cleanly. The store is ready for the player's marks.

**Not checked:** the live page inside claude.ai, as the player sees it. That viewer can't be driven from here. The same file passed cycles 4 and 5 in a phone-sized browser.

## Where it stands

All eight success points are met for the page as published. What remains open is for the player:
- the marks;
- the five questions.

**Known limits:**
- Only the 21 ideas I'd build (11 of the player's, my 10) have pictures; the player's "maybe" and "merge" ideas don't.
- The numbers in the new ideas (hits, seconds, the 12-tap meter) are first proposals, not measured; nothing is prototyped yet.
- The novelty check is a rule over two tags plus one independent read, not a playtest.
