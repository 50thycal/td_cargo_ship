# V3 map data checks (phase 3)

The automatic data checks for the map rebuild's rules (`docs/design/v3-map-wave-rules.md`, generated: not edited here). Code: `src/v3/data/mapRules.ts` (pure data, nothing in the game reads it) and `tests/v3/mapRules.test.ts`. The encounter style kept on every map is the original **v1** (round 1); v2 and v3 stay in the data for old logs and are checked only where noted.

Where the data breaks a rule today, the test holds the list of known breaks (an `EXPECTED_…` table). It fails when a new break appears **or** a listed one goes away, so the list stays true while phase 4 fixes them.

## Internal encounter notes (rule `g-named`)

`Encounter` has a required designer-only field:

```ts
notes: { sites: string; target: string; usesMap: string }
```

- `sites`: which launch sites fire, named as the map draws them ("the east silo on the north shore", "the sub spot off the mouth of the narrows", "a strafer in from the west edge").
- `target`: which ship or stretch it aims at (from each beat's `aim`: the lead ship, the ship nearest the narrows, any ship).
- `usesMap`: how it uses the map's shape or mechanic.

All 56 encounters (v1, v2, v3 and the wave 1 openers) have notes, written from their beats (`from`, `aim`) and the map geometry in `maps.ts`. Each field is one sentence. The notes are data only: no code in `src/v3/ui` or `src/v3/sim` reads them, and replay is unchanged (`tests/v3/mapLabBaseline.test.ts` passes).

**Checks:** each field is a non-empty sentence; a beat from a base is named as a silo, from a sub as a sub, from the air by its edge; nothing in the UI or the sim reads the notes.

### The call-out stays short and plain

The player-facing `callout` is at most 40 characters and names the threat, not the site: no "silo", "base", "lane", "pad", "launch site" or "sub spot". Six call-outs broke this and were changed (call-out text only, nothing a run plays):

| Encounter | Was | Now |
|---|---|---|
| `strait-ranging-shots` (v1) | Two shells from the middle base | Two shells, one after the other |
| `strait-ranging-opener` (v1) | One shell from the middle base | One shell: watch where it lands |
| `strait-v2-sweep` | West to east, all three bases | West to east, one after another |
| `strait-v2-both-sides` | Subs north and south of the lane | Subs north and south of the convoy |
| `gauntlet-v2-full-pincer` | All four bases | Everything at once, both shores |
| `strait-v2-first-light` | Three bases, west to east | Drones, a shell, drones: west to east |

## No later-chapter foes (rules `q-bots`, `m-enemy`)

**A kind's chapter.** A new enemy's chapter comes from `data/foes.ts` (`FOES[id].chapter`, the one source for those). The other kinds (drones, missiles, aircraft, the map mechanics' mines and fast boats) have no chapter in the data, so `kindChapter()` derives it: the earliest chapter with a map that lists the kind (its bases' `kinds`, its `extras`, the shared table's drones, shells and guided missiles, and its strafers and bombers if they come by wave 10). Every original threat comes out as chapter 1; mines as chapter 3 (Sowers' Reach), fast boats as chapter 4 (Smugglers' Coves).

**Checks:**
- no map lists a kind from a later chapter;
- no wave 1–10 of any of the 20 maps sends one, by the wave planner itself (`createGame` on four seeds, and the new enemies as one run plans them wave after wave);
- no encounter beat or enemy pair uses one.

**Found:** the maps' own waves are clean. The only later-chapter foes are v3's enemy pairs, which bring them to the chapter 1 maps on purpose (`MAP_VERSIONS` `guests`). The test lists all 20 such encounters (e.g. `strait-v3-heli-teach`: Attack Helicopter and Torpedo Sub, chapter 2; `gauntlet-v3-siege-teach`: Siege Battery, chapter 3) and checks every one is v3. v1 and v2 have none.

## No repeats back to back (rule `w-variety`)

For each v1 encounter map, no encounter id on two waves in a row (`arc(map, 'v1')`).

**Found (known breaks, 19):** each v1 encounter runs over three or four waves in a row, as slice 5 designed it, so every wave inside one repeats it:

| Map | Repeats |
|---|---|
| The Strait | 2–3, 3–4 Ranging shots; 5–6, 6–7 The screen; 8–9, 9–10 Rolling push |
| The Gauntlet | 2–3, 3–4 North, then south; 5–6, 6–7 Overlap; 8–9, 9–10 Crossfire |
| Harbor Mouth | 1–2, 2–3 Open water; 4–5, 5–6, 6–7 Funnel salvo; 8–9, 9–10 The last mile |

Wave 1's openers are different encounters, so waves 1–2 do not repeat on the Strait and the Gauntlet. Phase 4 needs about ten distinct encounters per map (or alternating ones) to pass.

## An encounter on each wave (rule `w-encounter`)

For each v1 encounter map, every wave 1–10 has at least one encounter.

**Found:** no gaps. The Strait and the Gauntlet open with their wave 1 openers and run three encounters over waves 2–10; Harbor Mouth's three cover 1–3, 4–7 and 8–10. The test's expected-gaps table is empty for all three.

## Each kind's debut (rule `m-enemy`)

`debuts()` lists, for every kind a campaign wave sends, the first map (in `MAP_ORDER`) and wave it comes in. `mapKindWaves(map)` gives each kind's first wave on a map from the data: the shared wave table at the map's threat scale, the map's `extras`, its aircraft waves, and the new enemies. A wave's first foe is always the next of the chapter's own new enemies, starting from the map's debut (`DEBUT_SLOTS`) on wave 2, and the planner's cursor carries over from wave to wave, so the chapter's new enemies come in on waves 2, 3, 4… The test checks this against the planner itself: each debut is sent on its debut wave, and no kind is sent before its listed wave.

| Kind | Chapter | Map | Wave |
|---|---|---|---|
| drone | 1 | The Strait | 1 |
| ballistic | 1 | The Strait | 2 |
| Sprint Drones | 1 | The Strait | 2 |
| guided | 1 | The Strait | 3 |
| Hydra Missile | 1 | The Strait | 3 |
| Rocket Truck | 1 | The Strait | 4 |
| strafer | 1 | The Strait | 5 |
| supersonic | 1 | The Strait | 6 |
| bomber | 1 | The Strait | 7 |
| heavy | 1 | The Strait | 10 |
| cluster | 1 | Harbor Mouth | 6 |
| mothership | 1 | Harbor Mouth | 7 |
| Attack Helicopter | 2 | The Island | 2 |
| Torpedo Sub | 2 | The Island | 3 |
| Armored Drone | 2 | The Island | 4 |
| Scavenger Drone | 2 | The Island | 5 |
| Stealth Strafer | 3 | Battery Point | 2 |
| Stealth Bomber | 3 | Battery Point | 3 |
| Dive Bomber | 3 | Battery Point | 4 |
| Siege Battery | 3 | Battery Point | 5 |
| Spotter Plane | 3 | Battery Point | 6 |
| mine | 3 | Sowers' Reach | 1 |
| fast boat | 4 | Smugglers' Coves | 1 |
| Repair Ship | 4 | Smugglers' Coves | 2 |
| Bodyguard Ring | 4 | Smugglers' Coves | 3 |
| Lure Beacon | 4 | Smugglers' Coves | 4 |
| Incendiary Missile | 4 | Smugglers' Coves | 5 |

**What this shows (not enforced yet):** each chapter's first map brings **all** of the chapter's new enemies by waves 2–6, one a wave and mixed into the full wave. So `DEBUT_SLOTS`' intent (the Hydra's debut on Marrow, the Rocket Truck's on The Gauntlet) does not hold in a campaign run: both come first on The Strait (waves 3 and 4). No new enemy has a wave alone (or with drones only), as the rule asks. Phase 4 decides each enemy's debut map and wave, and the "alone for a wave" check goes on then.

Children and structures are left out of the table: they are not sent on their own (darts, bomblets, mini-drones, torpedoes, helicopter rockets come from their parent) or they stand from the start (rigs, generators, the Citadel, the Dreadnought).
