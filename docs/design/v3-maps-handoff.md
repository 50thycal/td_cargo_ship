# V3 maps — handoff: brainstorm and lay out 20 maps (approval first)

The player wants **20 maps in total** (5 exist). This session **does not
build any maps**. It brainstorms, then shows the player a layout of every
map, the existing five included, to approve or change. A later session
builds the approved set.

## What the player asked for (their words)

- "Make a total of 20 maps to play. They should all have their 'unique'
  items on each map, like how Island has the center island."
- "We will need to get more creative too." Their seed ideas:
  - "a Strait of Hormuz type look, with a bend";
  - "funnels where the strait is wide and then narrows down where only one
    ship can pass at a time";
  - "a canal map where ships have to wait through lock gates";
  - "but yeah, think creative like that."
- "Start first with brainstorming it and giving me a layout of each map,
  including the existing ones, so I can approve it first and get it all
  fleshed out before we actually build the maps."
- "I want to see where enemies come from and where the friendly land is."

## Why 20 maps (context)

The goal is a game good enough for the App Store, with 8+ hours of play,
free to try for the first couple of maps, then a paid unlock. A run is
about 8–10 minutes. The playtime plan counts retries:

- early maps should take an average player 1–2 tries;
- late maps 3–4 tries;
- never more than about 5 losses on one map;
- Armory cards won from lost runs lift a stuck player.

With 20 maps, that's roughly 7–9 hours before any Hard mode. So the order
matters as much as the maps:

- difficulty rises in four chapters of five;
- each map brings **one** new idea, and doesn't stack several new ideas at
  once;
- maps 1–2 are the free trial and must be the most inviting.

## How maps work today (read `src/v3/data/maps.ts`)

- The world is **1600 × 900** units, one screen, landscape (it has to read
  on a phone at 667×375).
- `MapDef` holds:
  - `land` (`enemy` or `friendly` polygons, with optional hills);
  - `bases` (enemy launch silos and the threats each fires);
  - `carrier` (the player's gun, a fixed point);
  - `channels`: **straight, horizontal lanes**, ships sailing **left to
    right**. Each lane has a `y`, a `halfWidth`, optionally a `narrow`
    funnel towards the right edge (never below `LANE_FLOOR` = 66, i.e. it
    can't go single-file today), plus a `share` and `speed` for risky
    lanes;
  - `roads` (missile truck routes: `runners` drive a coast road,
    `popups` drive out, fire and reverse);
  - `subSpots` (where submarines surface);
  - `bomberLines` (the lines aircraft fly);
  - `vectors` (from which wave trucks, subs and aircraft join);
  - `extras` (threats this map adds on top of the shared wave table);
  - `threatScale`, `frigate` (Frigate Escort's station), `callout`
    (where banners sit) and `alerts` (the notification tray strip).
- **Threats**: drones, ballistic missiles (arc, with a landing circle),
  guided missiles, supersonic (lock line), heavy cruise missiles, clusters
  (split into bomblets), motherships (spawn mini-drones), strafing jets and
  bombers (from a screen edge), missile trucks, submarines.
- **The convoy's formations**: Pairs, Box, Column, Spread (the player
  picks). The ship-flow slider trades safety for score.
- **The existing five, in order**:
  1. **The Strait**: the enemy on the north shore only, long warning
     times; one wide lane; the carrier on the south shore.
  2. **The Gauntlet**: the enemy on both shores; the carrier mid-channel,
     with ships passing either side (two lanes).
  3. **The Island**: an enemy-held island in the middle **and** the far
     shore. A risky fast north lane (one group in three), the safe south
     lane, island fire with almost no warning, an island road with tunnels,
     caves.
  4. **Harbor Mouth**: the channel funnels into the harbour under enemy
     headlands on both sides; the worst comes right before delivery;
     motherships.
  5. **The Archipelago**: enemy islets with gaps between them, motherships;
     the west end a long reach from the carrier.
- To see them, run `npm run dev:v3`, or `npx vite preview --port 4173` after
  `npm run build`, open `/v3.html`, and turn on dev mode in Settings: it
  unlocks every map. Playwright and Chromium are preinstalled; screenshots
  of each map are worth including.

## What to produce

1. **Brainstorm wide first**: 30+ map concepts, each a line or two. For
   each: the unique feature, the threat it stresses, and the decision it
   gives the player. Then pick the 15 best new ones for variety and fun.
   Push past "more silos". Directions worth exploring (the player's three
   are musts):
   - **Geography**:
     - the Hormuz-like **bend** (lanes that curve, the carrier on the
       inside of the turn);
     - **single-file narrows** (the convoy bunches and slows before the
       gap: vulnerable);
     - **canal with lock gates** (ships wait in a chamber while it fills:
       sitting ducks, timing pressure);
     - a river delta with forking channels;
     - a fjord with high cliffs that hide launches;
     - a wide open sea with no shores, just an enemy fleet;
     - an archipelago maze;
     - ice floes or reefs that narrow lanes over time.
   - **Dynamics**:
     - tides or bridges that open on a timer;
     - a lane that closes mid-wave and reroutes ships;
     - a moving enemy (a battleship that crosses the map);
     - a fortress "boss" map;
     - night with a sweeping searchlight (shorter warning);
     - a storm that slows ships;
     - fog banks that hide threats until they're close;
     - mines that ships must avoid or the player must clear.
   - **Friendly side**:
     - a friendly island the convoy can shelter behind;
     - a friendly shore battery that fires on its own;
     - a second friendly port mid-map;
     - an allied radar that gives longer warnings while it survives;
     - the carrier on the opposite shore, or mid-map.
   - **Direction**: ships sailing right to left, or two convoys at once
     (an inbound and an outbound lane).
2. **A layout for every map, all 20, existing ones included**, for the
   player to look at. Each layout is a diagram at the game's 16:9 shape
   showing:
   - sea and the shipping lane(s), with arrows for the ships' direction;
     narrows, the bend, lock gates and anything else unique;
   - **friendly land** (clearly coloured) and **enemy land**;
   - the **carrier** and the frigate station;
   - **every enemy source**: silos (labelled with what they fire), truck
     roads, sub spots, aircraft lines (with the edge they come from),
     motherships, and anything new;
   - a short caption: the name, its chapter and slot (1–20), the one-line
     pitch, the unique feature, the threats introduced, and the expected
     tries for an average player.
3. **A one-page table of all 20**: the order, chapter, unique idea, new
   threat or mechanic, difficulty, and **engine work needed** (data only /
   small / new system), so the player sees the cost of each idea.
4. **Open questions** for the player, e.g.:
   - "Should the canal map's lock wait be about 4 s or 8 s?"
   - "Do you want a boss map ending each chapter?"
   - "Which 2 maps are the free trial?"

Make the layouts look good and easy to read on a phone:

- Publish them as a single **visual page**, with an SVG diagram per map.
  Generate the existing five's diagrams **from `MAPS` in `maps.ts`** (a
  small script), so they're accurate. Put the new ones' coordinates in the
  same shape as `MapDef`, so approved layouts turn straight into code.
- Also write the design to `docs/design/v3-maps-plan.md`, with the
  diagrams or screenshots alongside, on a branch with a PR. Commit no game
  code changes.
- Use fictional names inspired by real places ("The Narrows of Kesh", not
  "Strait of Hormuz"). A shipped game about shooting down missiles in a
  real, contested strait is a needless risk on the App Store.

## Engine work the new ideas imply (state it per map; don't build it yet)

- **Bend**: channels today are straight and horizontal. A bend needs
  lanes as paths (a polyline or spline per channel), with ships and
  formations following the path's direction, and funnels measured along
  the path. Medium–large.
- **Single file**: `LANE_FLOOR` stops lanes narrowing below a two-abreast
  width. A true single-file gap needs ships to merge into a column and
  queue (slowing) before the gap. Medium.
- **Locks**: a new system. Gates close, ships stop in a chamber, the water
  fills on a timer, then the next gate opens; ships queue behind. A clear
  telegraph (a gate light and timer) is needed so the wait feels fair.
  Medium–large.
- **Right-to-left or two-way traffic**: spawn and delivery sides per
  channel. Small–medium.
- **Moving enemies, timed obstacles, fog and night**: each is its own
  system. Size them in the table.
- **Every map** also needs: `callout` and `alerts` (where the tray sits,
  clear of bases and lanes), a `frigate` station, `subSpots`,
  `bomberLines`, a `vectors` plan, `extras`, and a `threatScale` that fits
  its slot. Note them roughly in the layouts so building is mechanical.

## How this session should work

1. Read this doc, `maps.ts`, and the existing round docs
   (`docs/design/v3-plan.md`, `v3-playtest-round*.md`) for context.
2. Screenshot the existing five, then brainstorm, shortlist, order, and
   lay out all 20.
3. Self-critique before showing anything:
   - **Variety**: no two maps share their headline idea.
   - **Readability**: you can tell the enemy side from the friendly side
     at a glance on a phone.
   - **Fairness**: every threat has a warning and an answer among the
     weapons and the Armory.
   - **The curve**: a new idea arrives on an easier map before it's
     combined with others.
4. Publish the page and the doc, then ask the player to approve or change
   each map. **Build nothing** until they approve.
5. Repo rules: branch off `claude/mobile-game-predator-prey-tu1t5k`, open a
   PR to it. Commits and PRs end with the session's attribution lines; no
   model names in commits or PRs.
