# Map Topology — which geometries are worth building

Companion to `roguelite-redesign.md`. That document defines a region as *enemy
menu + pacing + starting state*. This one asks the next question: **what happens
if a region also owns the water it is fought in?**

Ten candidate map shapes, each measured against the systems that would actually
have to live on them — merchant navigation, escort routing, mine behaviour,
coastlines, enemy spawn geometry, and the phone camera.

Nothing here is a proposal to rebalance a weapon. The constraint in
`regions.ts` holds throughout: *a missile is the same missile everywhere.* The
whole point of the exercise is that geography can move the numbers that decide a
fight without touching a single weapon stat — and the sections below show, with
the constants, exactly how much it can move them.

---

## 1. The test a map shape has to pass

A shape is only interesting if **some system already reads geography and would
return a different number on it.** If nothing in the sim consults the new
geometry, the shape is scenery: it changes the picture and not the game.

So the first thing to establish is which systems are geography-sensitive today.

| System | What it reads | Sensitive to |
| --- | --- | --- |
| Missile / torpedo flight | straight-line distance from launch site to target | how close the hostile shore is to the lane |
| Escort interceptors | `COMBAT.interceptor.range = 780` from the escort | how spread the convoy is vs. escort count |
| Shore batteries (player) | **unlimited range** — engages any missile on the map | *nothing.* Geography cannot weaken it |
| Coastal gun | `\|laneY − gunY\| ≤ 540` | lane-to-shore distance |
| Ranging gun | `\|laneY − gunY\| ≤ 830` | lane-to-shore distance |
| Rolling barrage | picks the reachable lane holding the most hulls | lane-to-shore distance + convoy spread |
| Attack boats | run from shore at `speed 42` vs. merchants at `22–34` | shore-to-lane distance; where boats *start* |
| Mines | local avoidance, `mineAvoidLookahead 200`, berth `8 × hull radius` | **channel width** — how much room there is to skirt a field |
| Escort coverage | `NAV.escortSpeed = 50` against the distance to the problem | how far apart the things needing escorting are |
| A-10 / scan plane / smoke | operate on a lane and a water y-band | lane geometry |

Two entries in that table are the levers. Everything else is a follow-on.

**Lever A — distance from the hostile shore to the lane.** Today:

```
launch line y = 985     missile speed 60
  north lane  1405   →   420 units   →   7.0 s of warning
  centre lane 1685   →   700 units   →  11.7 s
  south lane  1965   →   980 units   →  16.3 s
```

The south lane already gives the player **2.3× the reaction time** of the north
lane. The game has been shipping its strongest difficulty lever since the first
build and has never varied it per region. Move the hostile shore 400 units south
at mid-map and the centre lane's warning drops to **5 seconds** — that is Missile
Alley, produced by moving a coastline.

The same move does something even sharper to artillery. A coastal gun on the
launch line reaches `y ≤ 1525`: the north lane and nothing else, exactly as the
comment in `evolution.ts` says. Drop the gun line 400 units with the coast and it
reaches `y ≤ 1925` — **two and a half lanes.** A ranging gun goes from covering
two lanes to covering the entire strait including the friendly shore. That is The
Headlands, and it costs zero balance changes.

**Lever B — channel width against mine berth.** A merchant holds `8 × hull
radius` off a charted mine: 88 units for a cargo hull, 112 for a tanker. In the
983-unit-wide strait there is always somewhere to go. Put the same field in a
400-unit channel and the berth no longer fits — the hull must either accept a
close pass or leave the channel. *That* is what makes a minefield coercive rather
than merely annoying, and it is a property of the water, not the mine.

Every shape below is graded on whether it moves lever A, lever B, or neither.

---

## 2. Six engine facts that decide what is buildable

These came out of reading the sim, not out of taste. They rule several attractive
shapes out and make two unattractive ones cheap.

**C1 — Progress is one-dimensional and irreversible.**
`ship.heading` is clamped to `±NAV.headingClamp` (1.2 rad) around due east
(`transit.ts:3955`), delivery is `x ≥ WORLD.deliverX`, and straggling is measured
against `spawnX + elapsed × speed`. A merchant cannot sail west, cannot stop
making easting, and cannot be measured along anything but x.

> **No dead ends, no backtracking, no west-bound legs, ever.** Any shape whose
> tactical content is "you went the wrong way and had to come back" is out.

At full helm a merchant makes 24 u/s laterally while still making 9 u/s of
easting, so *lateral* freedom is generous. It is only the axis of progress that
is rigid.

**C2 — "Water" is two scalars, not a shape.**
`waterTop()` / `waterBottom()` are derived from `hostileShoreY` and
`friendlyShoreY`, and `keepAfloat()` clamps `y` between them (`transit.ts:623`).
There is no representation of interior land at all. Three call sites clamp
(ships `:3972`, escorts `:4371`, boats `:2800`), plus `aircraftOverLand()` and
the A-10 run-line validator.

**C3 — A lane is a y-scalar, referenced 112 times across 13 files.**
`WORLD.lanes = [1405, 1685, 1965]` is consumed by convoy spawn, lane-keeping,
mine placement, barrage lane selection, scan-plane charting, the smoke-lane
command, escort screen orders, `nearestLane`, and `clampLane`.

**C4 — Steering is reactive, not planned.**
Goal + separation + avoidance through a turn-rate limit. `NAV.lookAhead` is 135
units; mine avoidance looks 200 ahead. There is no path search anywhere in the
codebase, and the "which side do I pass on" rule is *per obstacle, by whichever
side has more room* — which oscillates on a symmetric obstacle dead ahead.

> Reactive steering can clear an obstacle needing up to roughly 150–200 units of
> lateral displacement. It cannot **choose a channel**, and it cannot recover
> from being committed to the wrong side of a long barrier.

This is the single most important constraint in the document. It means:
**geography must be authored as lane geometry, not discovered by the AI.** The
lane curve does the routing; the steering loop keeps doing local avoidance. Get
that division right and almost everything below is cheap. Get it wrong and every
island becomes an AI project.

**C5 — Every enemy spawns from one y.**
Missiles, torpedoes *and* boats all launch from `{ x: spawn.siteX, y:
WORLD.launchSites[0].y }` (`transit.ts:3491`), and boats put to sea heading due
south. "Boats from coves", "submarines in open water", "a gun on an island" are
all blocked on the same small thing: a per-region spawn-site table carrying a `y`
and an initial heading.

**C6 — The phone camera has a vertical budget of about 1300 units.**
The canvas is a fixed 1280 px wide, height `1280 / aspect` with aspect clamped to
`[1.4, 2.6]`. On a 19.5:9 phone in landscape that is 1280 × 591, giving
`fitZoom 0.175`, `minZoom 0.320`, `openingZoom 0.350`. So:

* At the **opening** zoom the viewport shows **3657 × 1688** world units.
* At the **widest** allowed zoom, **4000 × 1847**.

Two consequences, and they are not the ones you would guess:

1. **The player already sees ~91 % of the map's width at the default zoom.** You
   cannot build tension out of "something is happening far to the east". Along x,
   everything is always visible.
2. **Vertical is the scarce axis.** The water band is 983 units today. Keeping
   ~200 units of each shore on screen for context caps the water at **~1300
   units** — a +32 % budget. That is **one extra lane, or three lanes plus one
   island.** Not both.

Also worth knowing: at the opening zoom a 400-unit island is 140 canvas px (11 %
of the screen — very readable), and a 200-unit channel is 70 px — readable, but
about a thumb's width, so ordering an escort into one will be fiddly at the
default zoom.

---

## 3. Three tiers of engine work

Every shape below is priced in these terms.

**Tier 0 — free.** Move the existing constants per region: shore lines, lane
y-values, launch-site positions, gun-field span. `WORLD` becomes a region-level
struct instead of a module constant. Nothing structural changes; the whole sim
already reads these numbers rather than hard-coding them, which is the payoff of
work already done.

**Tier 1 — lanes become curves.** `WORLD.lanes[i]` → `laneY(i, x)`, a sampled
polyline per lane, plus a per-region shore profile `shoreY(x)` replacing the
hard-coded sines in the renderer (`transitView.ts:1433`) and in
`waterTop()`/`waterBottom()`. The steering loop is untouched — it already reads
`laneY` into a local and pulls toward it. The blast radius is the 112 reference
sites, most of which are mechanical.

> Tier 1 is the keystone. It is one refactor and it unlocks **five** of the ten
> shapes below, including both regions the campaign wants next.
>
> One invariant must be written into the region schema and tested: **lanes may
> weave but must never cross.** Lane 0 stays north of lane 1 stays north of lane
> 2 at every x. `nearestLane`, `clampLane`, the barrage lane pick and the
> artillery reach ordering all quietly assume it.

**Tier 2 — real land.** A polygon list per region; `keepAfloat` becomes
"push out of the nearest obstacle"; boats, torpedoes and aircraft get terrain
tests; the merchant needs a **commitment wedge** at an island's nose (choose the
side from the ship's *lane assignment*, not from whichever side has more room —
see C4) and, to make minefields coercive rather than lethal, **mid-transit lane
reassignment** at a decision line upstream of the split. Both are small — tens of
lines — but they are new AI behaviour and need their own tests.

---

## 4. The ten shapes

### 4.1 The Strait — the control

```
HOSTILE COAST ═══════════════════════════════════
  → → → → → → → → → → → → → → → →   lane 0  (7.0 s warning)
  → → → → → → → → → → → → → → → →   lane 1  (11.7 s)
  → → → → → → → → → → → → → → → →   lane 2  (16.3 s)
FRIENDLY COAST ══════════════════════════════════
```

What we have. Listed because it is the yardstick: it already contains a 2.3×
difficulty gradient across its three lanes that no region currently exploits.

**Tier 0. Verdict: keep as Home Strait.** The right shape for the region whose
job is teaching air defence, precisely because nothing about the water is a
puzzle.

---

### 4.2 The Squeeze — hostile coast bulges into the lane

```
════════════════╗                       ╔═══════════
                ╚═══════╗     ╔═════════╝
                        ╚═════╝              ← gun line drops 400 with it
  → → → → → → →  ~ ~ MISSILE ALLEY ~ ~  → → → → → →
  → → → → → → → → → → → → → → → → → → → → → → → →
═══════════════════════════════════════════════════
```

**Moves lever A, hard.** Centre-lane warning 11.7 s → 5.0 s in the bulge.
Coastal guns go from one lane to two and a half. Boats reach the convoy in a
third of the time. All of it from one shore profile.

* **Merchant AI** — lanes bend south with the coast. A 300-unit bend over 1000
  x-units is a 17° deflection, comfortably inside `headingClamp`; the existing
  goal force handles it with no change.
* **Escort routing** — unchanged. Drawn routes still work.
* **Mines** — placement moves from `WORLD.lanes[l] + jitter` to
  `laneY(l, cx) + jitter`, one line in `evolution.ts:776`.
* **Coastline** — the renderer's sine becomes a per-region profile.
* **Spawns** — launch sites ride the bulge south. Nothing new needed.
* **Camera** — free. The band's *centre* moves; its width does not, so the
  vertical budget is untouched.

**Tier 1. Verdict: build first.** The cheapest shape in the set and the largest
gameplay delta per unit of work, and it produces Missile Coast almost exactly as
described — including the property the user wanted most, that danger is *not
evenly distributed along the map* and every transit has a recognisable moment.

---

### 4.3 The Headland — a long one-sided intrusion

```
════════╗                                        ╔═
        ╚════════════════════════════════════════╝
             ▲ guns here reach EVERY lane
  → → → → → → → → → → → → → → → → → → → → → → →
  → → → → → → → → → → → → → → → → → → → → → → →
═════════════════════════════════════════════════
```

The Squeeze at full amplitude and sustained for a third of the map: the whole
water band shifts south and narrows, and the convoy is pressed against the
friendly shore for a long, continuous stretch.

* **Merchant AI** — the *easiest* case in the set. All lanes shift together;
  there are no choices to make and no obstacle to route around.
* **Escort routing** — unchanged, but the escort's job changes completely:
  suppressing the shore means going *toward* the guns, and the peninsula gives
  the player a clear, drawable geometry to work with.
* **Mines** — the narrowed stretch is where lever B starts to bite, in a mild
  form.
* **Coastline** — a bigger `shoreWave`, essentially.
* **Spawns** — guns on the headland tip sit close to the lanes; the existing
  y-only reach test still works because the lanes stay near-horizontal here.
* **Camera** — the band's centre moves south; width constant. Free.

**Tier 1 — the same mechanism as 4.2 at a different amplitude.**

> **One refactor, two regions.** A per-region shore profile plus lane curves
> yields Missile Coast *and* The Headlands. That is the best return in the
> document and the reason Tier 1 should happen before anything else.

**Verdict: build second.** Artillery finally gets a region where it defines the
experience, without a single artillery number changing.

---

### 4.4 The Open — the hostile shore retreats

```
                    (nothing up here)


   →  →  →  →       ·                    ·
        →   →   →        →   →   →   →
             ·                 →   →   →   →   →
                                        ·
═══════════════════════════════════════════════════
```

Deepwater Passage. The hostile coast is pushed out of frame entirely; threats
arrive from empty water; lanes spread and drift diagonally.

* **Merchant AI** — fine. A diagonal channel is well inside `headingClamp`. One
  subtlety worth catching early: straggling is measured as
  `spawnX + elapsed × speed − x`, so on a diagonal the *path* is longer than the
  *x-extent* and every hull will read as slightly behind schedule. Either
  measure progress along the lane's arc length or scale the straggle threshold
  per region.
* **Escort routing** — this is where the shape earns its keep. Widen the band and
  `escortSpeed 50` becomes the binding constraint: crossing a 1300-unit band
  takes 26 s, so an escort committed to one flank is genuinely out of the fight
  on the other. Coverage becomes an allocation problem instead of a formation.
* **Mines** — near-pointless here, which is correct for the region's identity.
* **Coastline** — the cheapest possible: it is the *absence* of geography.
* **Spawns** — **the real cost.** Torpedoes launching from a shore 2000 units
  north is the wrong fiction and the wrong geometry. This needs submerged launch
  points scattered in open water, ideally unrevealed until they fire (C5).
  Small, but genuinely new.
* **Camera** — **the shape that fights the phone hardest.** A wide band plus a
  convoy strung across the full map means hulls are ~11-unit radii in a
  3657-unit-wide view: about 4 canvas px each.

**Tier 1 for the water, plus the C5 spawn table. Verdict: build it, but get the
identity from absence rather than size.** Do not widen much past 1300. "Open
sea" reads from *the top of the frame being empty water instead of enemy coast*
and from threats appearing out of nothing — not from more square units. The
temptation to make the ocean feel big by making it big is the one trap this
region has, and the camera will punish it.

---

### 4.5 The Bay — the friendly shore recedes

```
════════════════════════════════════════════════════
  → → → → → → → → → → → → → → → → → → → → →   short, exposed
  → → → → ╲                        ╱ → → → →
           ╲___                ___╱              longer, out of reach
═══════════════╲______________╱═════════════════════
```

Geometrically dull. Mechanically the most interesting entry in the document —
because it is the only shape whose value is a **new player verb**.

The southern route is longer and outside coastal-gun reach. The extra path costs
a tanker roughly 23 s against a `transitCrossAllowance` of 350 s, so the trade is
real but affordable — the time budget already supports detours.

But: today the player has **no control over where merchants sail.** Lane index is
assigned at spawn in `scheduleSpawns` and never revisited. Escorts have drawn
routes; the convoy has nothing. A map with a genuine route choice is only
interesting if somebody gets to make it.

* **Merchant AI** — needs lane preference to be settable, per convoy or per
  ship. The plumbing is already there: `nearestLane(y)` exists, and the smoke,
  scan-plane and escort-screen commands all already resolve a tap into a lane.
* **Escort routing** — unchanged.
* **Mines** — the enemy's counter is obvious and good: mine the safe route.
* **Coastline / spawns / camera** — all Tier 0–1, all cheap.

**Tier 1 plus one new command. Verdict: the sleeper.** Rated low as a *shape*
and highest in the document as a *mechanic*. A convoy-routing order is probably
the single biggest new player decision that geography can unlock, and this is the
map that asks for it. Worth building the verb here even if the bay itself is
never a shipped region.

---

### 4.6 The Split — one long island, two channels

```
════════════════════════════════════════════════════
  → → → → →  ╭──────────────────╮  → → → → → →
  → → → → → ─┤      ISLAND      ├─ → → → → → →
  → → → → →  ╰────────▲─────────╯  → → → → → →
════════════════════▲═╬═▲═══════════════════════════
                    coves
```

Pirate Narrows. The first shape that needs real land, and the first that makes
escort *position* a commitment.

* **Merchant AI** — needs the **commitment wedge** (C4). Reactive avoidance will
  oscillate at a symmetric nose; the passing side must come from the ship's lane
  assignment. ~20 lines and robust.
* **Escort routing** — **the payoff.** An escort in the north channel cannot help
  the south channel until it has cleared the island's length at 50 u/s — 30 s for
  a 1500-unit island, before it has crossed the band it is now on the wrong side
  of. For
  the first time, where an escort *is* costs something. This is the strongest
  single argument in the document for building real land at all.
* **Mines** — and here is the user's ambush idea, working properly. To get *mines
  manipulate where ships travel so boats can ambush them*, and not just *mines
  and boats both hurt ships*, the convoy must **re-choose its channel** at a
  decision line upstream of the island's nose, comparing charted mine counts per
  channel. Without that, a fixed lane index means the ship simply blunders into
  the field and dodges locally, and the two enemy systems never interact.
  With it, the whole tactical question the user wants — *clear the mines or send
  escorts into the ambush?* — exists.
* **Coastline** — polygon + containment. Tier 2.
* **Spawns** — coves on the island at y ≈ 1550 put boats on the convoy in ~3 s
  instead of ~17 s. Needs the C5 table. This is the ambush, quantified.
* **Camera** — two 400-unit channels plus a 200-unit island is 1000 units:
  **inside the budget without widening anything.** But a 200-unit channel is a
  thumb's width at the default zoom, so escort orders into it will want either
  wider channels or a zoom nudge.

**Tier 2. Verdict: build third, and accept that it is the expensive one.** It
buys real land, the commitment wedge, lane reassignment and cove spawns — and
every later island map is then Tier 1 work.

---

### 4.7 The Braid — staggered islands, lanes weave

```
════════════════════════════════════════════════════
  → → →  ╭───╮  → → → → → → →  ╭───╮  → → → →
  → → → ─╯   ╰─ → →  ╭───╮  → ─╯   ╰─ → → → →
  → → → → → → → → → ─╯   ╰─ → → → → → → → → →
════════════════════════════════════════════════════
```

The Archipelago. Three Splits in series with the islands offset, so each lane
weaves and the "safe" lane changes along the map.

* Everything from 4.6 applies, three times.
* **The invariant matters most here.** It is tempting to have the lanes *cross*
  — north lane becomes south lane — to make route choice feel consequential. Do
  not. Crossing tracks means head-on-ish traffic at 26 u/s in a 300-unit channel
  with no give-way rules for it, and it breaks the ordering assumptions in
  `nearestLane`, the barrage pick and artillery reach. **Weave, never cross.**
* **Camera** — three islands plus four channels is the shape most likely to
  exceed the 1300-unit budget. It will need channels narrow enough to be fiddly.

**Tier 1 once 4.6 exists. Verdict: build after The Split proves out.** It is not
a new idea, it is the same idea with more of it — which is exactly why it should
come later and cost almost nothing when it does.

---

### 4.8 The Gate — headlands converge to a single passage

```
════════════════╗              ╔═══════════════════
                ╚══════╗  ╔════╝
  → → → → → → → → → →  ▓▓  → → → → → → → → → →
                ╔══════╝  ╚════╗
════════════════╝              ╚═══════════════════
```

The most tactical-*looking* shape in the set and the most dangerous to build.

* **Merchant AI — this is where the convoy model breaks.** Three lanes merging
  into one at a 300-unit gate puts twenty hulls into water sized for six.
  `passSideBlocked` will report blocked continuously, which caps every ship to
  the slowest hull's pace, so the entire convoy crawls the gate at tanker speed
  and eats into `transitCrossAllowance`. Then `giveWayExhausted` fires — that
  backstop exists at all because hulls stopping dead has already been seen — and
  ships start barging through each other's bubbles, which looks like a bug even
  though it is the designed failure mode.
* **Escort routing** — likewise congested.
* **Mines** — lever B at maximum. A field in the gate is genuinely coercive. It
  is also close to unfair, since there is nowhere else to go.
* **Camera** — fine.

The shape does have one property nothing else in the set offers: it creates a
**known place and known time where the convoy is dense**, which is exactly what a
saturation volley or a rolling barrage wants to hit. That is a real doctrine
enabler and the reason not to discard it.

**Tier 2 + convoy traffic-model work. Verdict: prototype the pile-up before
committing.** Worth building a throwaway gate purely to watch twenty hulls try to
use it — that test tells you more about the convoy AI than any amount of
analysis. Ship it as a late region, after traffic is hardened, and give it The
Kill Box's combined-arms doctrine so the congestion is the *point*.

---

### 4.9 The Chicane — the whole channel snakes

```
════════╗        ╔══════════╗        ╔═════════════
        ╚════════╝          ╚════════╝
  → → ╲ → → ╱ → → ╲ → → ╱ → → ╲ → → ╱ → →
  → → ╱ → → ╲ → → ╱ → → ╲ → → ╱ → → ╲ → →
════════╗        ╔══════════╗        ╔═════════════
        ╚════════╝          ╚════════╝
```

Both shores in phase, constant channel width, a handsome S-bend the whole way.

Now apply the test from §1: **which system returns a different number?**

None. Shore-to-lane distance is constant, so lever A does not move. Channel width
is constant, so lever B does not move. Nothing else is geography-sensitive —
because **nothing in this codebase models line of sight.** There is no occlusion
anywhere: missiles fly over land, guns shoot through headlands, boats see the
whole map.

**Verdict: pure scenery. Included as the negative control**, because it is the
shape most likely to be built by accident. It is the best-looking map in this
document and the only one that changes nothing at all.

It becomes the *most* interesting map in the set the moment occlusion exists —
see §6.

---

### 4.10 The Shoals — scattered small hazards

```
════════════════════════════════════════════════════
  → → →  ░  → → → → →  ░ ░  → → → →  ░  → → →
  → →  ░ ░  → → →  ░  → → → →  ░  → → → →  ░ →
  → → → →  ░  → → → → →  ░ ░  → → →  ░  → → →
════════════════════════════════════════════════════
```

Many small blobs rather than a few large ones — each small enough (≤ ~200 units)
that reactive steering can genuinely clear it inside its lookahead, so no
commitment wedge and no lane reassignment are needed.

The reason to want them is not what they do to merchants. It is what they do to
**everything that currently travels in a straight line**:

* An **attack boat** can no longer take the direct line from shore to convoy —
  it has to work around, which costs it seconds it does not have.
* A **torpedo** runs on a fixed `vx, vy` with no terrain test at all; giving it
  one turns shoals into cover.

That is a way to change a weapon's *effective reach* without changing its stats
— arguably still inside the `regions.ts` constraint, and worth an explicit
decision rather than being slipped in.

* **Merchant AI** — cheap, per C4.
* **Escort routing** — drawn routes become genuinely skilful; this is the map
  that most rewards the route tool already built.
* **Mines** — a mine tucked against a shoal cannot be berthed properly. Lever B,
  applied locally and repeatedly rather than once.
* **Camera** — small hazards at ~70 canvas px are readable but easy to lose
  against the water; they need to render clearly.

**Tier 2 (shares all its machinery with 4.6). Verdict: strong, cheap, and
underrated** — the best value per unit of work of anything in the Tier 2 group,
and the natural texture layer to scatter across the island maps rather than a
region of its own.

---

## 5. Ranking and build order

| # | Shape | Lever A | Lever B | Tier | Value | Region it produces |
| --- | --- | --- | --- | --- | --- | --- |
| 4.2 | The Squeeze | ●●● | ○ | 1 | **highest** | Missile Coast |
| 4.3 | The Headland | ●●● | ● | 1 | **highest** | The Headlands |
| 4.6 | The Split | ● | ●●● | 2 | high | Pirate Narrows |
| 4.5 | The Bay | ● | ○ | 1 + verb | high *(mechanic)* | — |
| 4.4 | The Open | ○ (inverted) | ○ | 1 + spawns | high | Deepwater Passage |
| 4.10 | The Shoals | ○ | ●● | 2 | high *(texture)* | — |
| 4.7 | The Braid | ● | ●● | 1 after 4.6 | medium | Archipelago |
| 4.8 | The Gate | ● | ●●● | 2 + traffic | risky | The Kill Box |
| 4.1 | The Strait | — | — | 0 | baseline | Home Strait |
| 4.9 | The Chicane | ○ | ○ | 1 | **none** | — |

Suggested order:

1. **Tier 0 first** — make `WORLD` a per-region struct. Nothing visible ships,
   but every later step gets cheaper and it is a mechanical change.
2. **Tier 1 — lane curves + shore profiles.** One refactor. Ships **Missile
   Coast** and **The Headlands** back to back, and both are pure geography with
   no balance changes, which is the constraint working as designed.
3. **The Open**, using the same Tier 1 water plus the C5 spawn table. Resist
   widening it.
4. **Tier 2 — real land**, proven on **The Split**. Commitment wedge, mid-transit
   lane reassignment, cove spawns. This is the expensive one; everything after it
   is cheap.
5. **The Shoals** scattered through the island maps as texture.
6. **The Braid** — nearly free once 4.6 exists.
7. **The Gate**, only after a throwaway prototype has shown what twenty hulls do
   to a 300-unit passage.

The campaign the user sketched survives this ordering intact. Only the
implementation order changes: **Missile Coast and The Headlands should be built
before Pirate Narrows gets its island,** because they are Tier 1 and it is
Tier 2 — even though the campaign ladder presents them the other way round. A
region's *position in the ladder* and its *build order* do not have to agree.

---

## 6. Two things that would multiply the design space

Both are out of scope for the first pass. Both are worth knowing about before the
geometry is locked, because each one retroactively changes what a shape is worth.

**Occlusion / line of sight.** Nothing in the sim consults terrain for
visibility, targeting or trajectory. Add it and every bend, headland and island
acquires tactical meaning it does not currently have: The Chicane goes from the
worst map in this document to the best, artillery becomes something you can hide
*from* rather than only suppress, and smoke stops being the only concealment in
the game. It is also the largest single change contemplated here.

**Convoy route orders.** Discussed under 4.5. The player commands escorts,
aircraft, smoke and a targeting priority — and has no say over where the cargo
sails. Every multi-route shape in this document (4.5, 4.6, 4.7, 4.8) is worth
substantially less without it, because a route the player does not choose is just
a route the enemy gets to predict.

---

## 7. What I would cut

* **The Chicane**, unless occlusion happens. It is scenery.
* **Crossing lanes** anywhere. Weave, never cross (§3, invariant).
* **Widening the water past ~1300 units** for any region. The phone decides this,
  not the design (C6).
* **Dead ends, pockets and any west-bound leg.** C1 makes them impossible without
  rebuilding how progress is measured, and the shapes that want them are not
  worth that.
* **Region-specific weapon tuning to compensate for a map.** If a shape only
  works with a nerfed missile, the shape is wrong. Levers A and B are strong
  enough — a 2.3× swing in warning time and a coastal gun going from one lane to
  three — that no weapon should ever need to move.
