# Straitwatch V2: upgrade card redesign (round 10)

The player sent a mobile-game ad, *Last Extract*, as a reference for upgrade cards:

> "Simple and it clearly is unique for each one … take a creative stab at updating the graphics and UI for the upgrade cards and that screen, make the cards more detailed and the graphics more interesting."

They want our game's own style, not a copy, built for landscape, and without the tutorial finger.

What the reference does well:
- one bold, illustrated picture per card, in a framed panel that takes up most of the card;
- a short plain-language effect underneath;
- a strong "CHOOSE YOUR UPGRADE" header;
- a consistent frame, so the art is the only thing that changes from card to card.

## Success, from the player's side

| # | Goal | How it's checked |
|---|---|---|
| C1 | **Every card is recognisable at a glance by its picture.** All 18 have their own illustration and colour. None could be mistaken for another, even at phone size. | A contact sheet of all 18 at phone scale, plus a greyscale pass so no card is told apart by colour alone. |
| C2 | **It reads like the reference.** Big art, the name, a short effect line, a clean frame. The effect fits on the card at every level, with no cut-off or "…" text, and stays readable (≥ 11 CSS px). | Every card at every level is measured in the browser for overflowing text. |
| C3 | **It fits a landscape phone.** Three cards, and four when Resupply joins, fit at 844×390 and 874×402 with nothing scrolled or cropped, in the normal, slots-full and swap states. It also looks right on a 1280×720 desktop. | Screenshots at each size, plus a check that the panel doesn't scroll. |
| C4 | **It matches Straitwatch.** A dark naval palette, the cyan and gold accents, the game's own pictures (ships, missiles, drones), and a frame that reads as a naval combat display. | Side-by-side screenshot review against the battlefield. |
| C5 | **Nothing is lost.** The card still shows NEW / LEVEL UP / SWAP IN, the level reached and the max, and the threat it answers. Locked cards, the swap flow, Resupply, the bot's pick highlight and dev "skipped" titles all still work. | The existing e2e tests (`v2`, `v2-watch`) plus screenshots of each state. |
| C6 | **It feels good.** Cards deal in, react to a press, and a pick lands with a beat, without slowing play or making the bot wait. | A frame-by-frame look at the animation, plus timing measurements. |
| C7 | **Nothing else breaks.** | `npm test`, `e2e:v2`, `e2e:v2:watch`. |

## Cycle log

### Cycle 1: a picture for every card (C1, C4)

**Built.** `src/v2/ui/cardArt.ts` holds 18 illustrated scenes (120×76) drawn in the battlefield's own language:
- the convoy's container ships, our white interceptors with flame;
- red hostile missiles and drones;
- the sea along the bottom, and a soft glow in the card's colour.

Each scene is built around the one thing its card does. A few examples:
- **Faster Interceptors:** an interceptor tearing across the frame on speed lines.
- **Wide Warhead:** one huge blast ring swallowing a swarm.
- **Chain Detonation:** explosions linked by sparks.
- **Early-Warning Radar:** a radar sweep finding blips.
- **Smoke Screen:** a ship laying smoke while a homing missile veers off.
- **Combat Rhythm:** a heartbeat line that spits out a round.

The art is pure SVG strings, so tools can render it too. A scratch tool lays all 18 out as a contact sheet at phone size, in colour and in greyscale.

**Tested.** I rendered the contact sheet in Chromium (190×120 tiles, about phone size), plus a greyscale version and 3× close-ups.

**Found.**
- 15 of 18 read at a glance, and **all 18 stay distinct in greyscale**, so no card depends on colour alone.
- Three didn't read well:
  1. **Twin Launch:** the launcher was an empty outline that read as a table.
  2. **Flak Burst:** the red jet's shape was a muddle and didn't read as an aircraft.
  3. **Rapid Hold:** in greyscale the finger was just a cylinder.

**Fixed and re-checked in close-ups.**
- **Twin Launch** now launches from a grey carrier deck with a launch flash.
- **Flak Burst** has a proper jet silhouette: fuselage, swept wings, tail fin and canopy.
- **Rapid Hold**'s finger has a nail and knuckle creases.
- The dull brown launch glow was replaced with a bright burst.

### Cycle 2: the card frame and the screen (C2, C3, C4)

**Built.** The draft screen now reads from top to bottom:
1. A "WAVE 3 CLEARED" eyebrow above a big, letter-spaced **CHOOSE YOUR UPGRADE**.
2. The cards.
3. A **LOADOUT** row: the held cards as chips in their own colours.
4. The rule line.

Each card is a naval-display panel:
- chamfered corners, a thin edge in the card's colour, and a face tinted with that colour at the top;
- threat and badge across the top;
- the illustration in a window with a dotted plotting grid and corner brackets;
- the name, then level pips (dim for levels held, bright with a glow for the one this card adds) with "LV 2/3";
- one effect line.

The test and bot hooks are unchanged: `.v2-card`, `data-upgrade`, `.v2-slot.swap`, `data-slot` and `.bot-pick`.

**Tested.** A screenshot harness forces the draft screen with four hands (fresh, level-up, slots full with Resupply, long text) at 874×402, 844×390 and 1280×720. For each it measures panel scroll, card sizes, overflowing elements and the smallest font.

**Found.**
- **The fit is good.** No hand scrolls at any size.
  - At 844×390 the panel uses 322–335 of 390 px.
  - Cards are 263×221 px, or 194×209 px in the four-card hand.
- **Desktop cards were small:** 289 px wide, leaving a lot of empty screen at 1280×720.
- **Resupply's "REPAIRS" label was red,** the colour every other card uses for the threat it answers.
- **The long effects run to three lines** (Radar, Smoke Screen, Twin Launch), unlike the reference's one short line. Carried to cycle 3.
- **One unnamed element overflows** in the level-up hand. Carried to cycle 3's audit.

**Fixed and re-checked.**
- **Desktop size:** a desktop rule widens the panel, grows the art to 200 px tall and the text to 14 px. Cards are now 343×336 px.
- **Resupply's label** is now green.
- **Desktop labels:** 11 px instead of 9.

### Cycle 3: short, readable effect lines (C2)

**Measured first.** I listed every effect line by length.
- The longest were Escort Frigate L1 (106 characters), Early-Warning Radar L1 (102) and Smoke Screen L1 (87).
- Nine lines were over 62 characters, against about 60 on the reference's cards.

**Changed.** I rewrote those nine to ≤ 63 characters. The numbers that matter are kept (1.5 s sooner, 8% slower, 7 s / 8 s recharges, 0.32 s instead of 0.6 s, 2+ hits). Examples:
- **Escort Frigate:** "A frigate joins the carrier: taps fire from whichever is nearer".
- **Early-Warning Radar:** "Threats spotted 1.5 s sooner, impact points shown, 8% slower".
- **Smoke Screen:** "Hit ships lay smoke that breaks missile locks (7 s recharge)".

The rack-sharing detail now comes from Escort Frigate L2's "gets its own 2-round rack". No test checks these strings, and the unit tests still pass.

**Tested.** An audit tool renders **every card at every level** (38 card-levels), three at a time beside Resupply, so it uses the narrowest four-card layout. It ran at 844×390, 874×402 and 1280×720, and for each card measured:
- the lines of effect text and of the name;
- any overflowing HTML element;
- the panel's scroll.

**Found.**
- At all three sizes, every effect fits in **1 or 2 lines** (at 844×390: 17 one-line, 21 two-line).
- **No overflowing text** anywhere, and **no hand scrolls**: panel height 322–341 px of 390.
- The text is 11 px on phones, 12 px at the larger phone size and 14 px on desktop. The only text below 11 px is the uppercase label row (badge and threat), at 9–10 px, which is the same as before.
- "Supercharged Pickups" is the only name that wraps to two lines, and only in the four-card layout on phones. It still fits.
- The cycle-2 overflow turned out to be an SVG glow layer, which is cropped on purpose, not text. No change needed.

### Cycle 4: the special states (C5)

**Tested.** I screenshotted each state at 844×390 with real taps:
1. **Swap:** a full loadout, tap a new card, then tap the held card it replaces.
2. **Locked:** a maxed card in the hand.
3. **Bot pick:** watch mode, waiting for the bot's draft.

Then I ran both browser suites, which drive the swap flow and the bot's draft.

**Found.**
1. **The chosen card had no highlight,** both in swap mode (Flak Burst) and for the bot's pick (Combat Rhythm). The old gold ring was a `box-shadow`, and the new chamfered clip-path cuts off anything drawn outside the card.
2. **Cards waiting during a swap kept full-colour art,** so the chosen card didn't stand out against them.
3. **A maxed card read "LV 4/3" with a LEVEL UP badge.** The game never deals a maxed card, but the label was wrong if one ever showed.
4. **The `e2e:v2:watch` stride check failed.** It looked for "skipped" in the screen's `h2`, which now reads "Choose your upgrade"; "Wave 3 skipped" moved into the eyebrow line. This was a test coupling, not a behaviour change: the flow still reached wave 4.
5. **A harness bug:** I had set a fractional wave number to force redraws, and that threw a page error when the next wave started. This was only in my screenshot harness, not the game.

**Fixed and re-checked.**
- **Picked cards** (`.chosen`, `.bot-pick`) show it inside their own frame: the edge turns gold and thickens to 3.5 px, and the card lifts 4 px.
- **Cards that step back** (locked, or waiting during a swap) get a dark edge and their art goes greyscale and dimmed. They stay solid, with no battlefield showing through.
- **A maxed card** shows a grey MAXED badge and "MAX" by its pips.
- **The e2e** now reads the eyebrow.
- **The harness** uses whole wave numbers.

Re-shot screenshots show all four states clearly. `e2e:v2` passed, including the swap flow on the iPhone viewport. `e2e:v2:watch` passed all sections after the selector fix.

### Cycle 5: motion and feel (C6)

**Built.**
- **Deal-in.** The header settles, then the cards deal in left to right: rising and scaling up over 0.34 s, 70 ms apart.
- **Gain pip.** The pip for the level this card would give you breathes gently.
- **A beat on the pick.** When you tap a card, it flashes: gold edge, a 3% pop, and a sheen across its art. The pick lands 180 ms later. A guard ignores further taps meanwhile, so a fast double-tap can't pick twice.
- **Bot unchanged.** The bot's draft timing is the same as before, since it calls the pick directly.
- **Reduced motion.** With `prefers-reduced-motion`, all of these animations are off.

**Tested** in Chromium at 844×390, with real touch taps:

| Check | Result |
|---|---|
| Card opacity at 0 / 90 / 180 / 300 ms | 0/0/0 → 0.93/0.79/0.31 → 0.99/0.96/0.87 → 1/1/1. A clean left-to-right stagger, done by 300 ms. |
| Fast double-tap on Twin Launch | **1** pick logged. Levels became `{blast:1, twin:1}`. |
| Tap → next wave | 257 ms (the 180 ms beat plus frames and test overhead). |
| Reduced motion | Cards fully visible at 0 ms. Tap → wave 201 ms, 1 pick. |
| Screenshots | The mid-deal frame shows the stagger. The tapped frame shows the gold edge and the sheen across the art. |

**Found.** Nothing to fix. The beat was meant to be short, and at 180 ms (about 0.26 s from tap to wave) it is. While dealing in, cards are briefly see-through. That lasts under 0.3 s and the screenshots don't suffer from it, so I've left it.
