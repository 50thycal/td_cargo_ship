# V3 weapons: a job and a limit for each (brainstorm, not built)

The player, after the 11-03 Island run:

> "The game should have upgrades that don't counter everything, just to make
> it more balanced and interesting for synergy. Like with the Aegis upgrade,
> I don't think that should shoot down jets, only missiles and drones."

Then: "do a sweep of all the weapons and let's make a proposed nerf or
clarification for each weapon to have a limit or something like that.
Brainstorm first; we build only after the ideas are locked. Also come up with
6 new weapon ideas. We will keep it at 12 for the game."

Nothing here is built. Each weapon gets:
- **Job:** what it is for;
- **Blind spot:** what it can't touch;
- **Limit:** a nerf or a cost;
- **Card line:** the one-line "answers" text, true to the code.

## The threats, for reference

| Group | Threats | Traits |
|---|---|---|
| Swarms | drone (1 hp, slow), mini-drone, mothership (5 hp, spawns drones) | many, slow, low |
| Missiles | guided (2 hp, homing), supersonic (1 hp, very fast), ballistic (1 hp, arcing), cluster (splits into bomblets), heavy (8 hp, slow) | fast or armoured |
| Aircraft | strafer (3 hp, guns a line of ships), bomber (3 hp, drops guided missiles) | fly a line, hit several hulls |
| Surface | fast boat, mine, sub, missile truck, shore runner | on the water or the shore |
| Big | rig, generator, citadel, dreadnought | many hp |

## What the logs say now

| Run | Weapons | Result | Takeaway |
|---|---|---|---|
| Island 11-03 | Flak ×3 by wave 3, then Seeker, Aegis | 9 waves, 0 ships lost | Flak alone carried the run |
| Kesh 11-02 | Aegis ×3, then Thermo ×3 | won, 0 lost | Aegis plus one blast weapon was enough |
| Marrow 11-02 | Aegis ×3, Scatter, Air Strike | lost on wave 10 | Air Strike used 5 times, then left |
| Kesh 11-02 | Shrapnel ×3, Scatter | lost on wave 9 | Air Strike taken and dropped |

Frigates were taken twice and dropped or barely used. The cards' "answers"
lines don't match the code in two places:
- Aegis says "Missiles", but it also fires at jets.
- Frigates say "Everything".

## The twelve: proposals

### 1. Flak Cannon: holds a lane against swarms
- **Now:** clouds hit anything that flies through. The level 3 wall lasts 4 s.
- **Problem:** with three early picks it carried a whole run (Island: 0 lost in 9 waves).
- **Blind spot:** missiles fly too high and fast for the cloud. Ballistic, supersonic and heavy pass through.
- **Limit:** a cloud has a hit budget (e.g. 6 hits) and thins out as it is spent. A big swarm chews through a curtain instead of dying in it.
- **Card line:** "Swarms and jets. Missiles fly over it."

### 2. Seeker Pod: picks off a scattered raid
- **Now:** 3–5 seekers at the threats nearest the tap, each 1/3 of a shot.
- **Blind spot:** no lock on supersonic missiles (too fast) or ballistic ones (on an arc). Against a heavy (8 hp) a seeker is only a third of a hit.
- **Limit:** seekers launch only at threats within reach of the tap (as now), and no two seekers in one salvo chase the same threat. A salvo is breadth, not focus.
- **Card line:** "Scattered raids. Can't catch the fastest."

### 3. Aegis Launchers: each hull defends itself against missiles (the player's ask)
- **Now:** each ship fires its own interceptor at a threat about to hit it. It **also fires at any aircraft**, which the card doesn't say.
- **Change:** missiles and drones only; never jets or boats.
- **Blind spot:** aircraft (that's Air Strike's or Frigates' job), surface threats, and threats aimed at another hull.
- **Limit:** one launch per ship per wave of fire, then a reload. At level 3 that's every 3 s, as now.
- **Synergy:** Aegis plus Air Strike or Frigates covers both missiles and air.
- **Card line:** "Missiles and drones aimed at your ships."

### 4. Gravity Well: gathers a wide raid for something else to finish
- **Now:** pulls threats in for 1.5–2 s, then implodes for 2–4.
- **Blind spot:** can't move what is heavy or committed: heavies, aircraft, and ballistic missiles on their arc.
- **Limit:** the implosion hits the nearest 5 only, so it's a setup, not a whole-raid wipe.
- **Synergy:** Well, then Thermobaric or Flak on the pile.
- **Card line:** "Pulls a raid together. Heavies and jets don't budge."

### 5. Air Strike: clears a row of aircraft and surface threats
- **Now:** a jet down the tapped row hits everything under it, for 2 rounds a jet. The player called it "very fun … very op in a good way", but in these logs it was taken and dropped twice.
- **Blind spot:** missiles are a half-damage graze; the jet is over the row for a moment and the missiles have moved on.
- **Limit:** one jet in the air at a time. A second tap waits for the first to clear.
- **Card line:** "Aircraft and boats in a row."

### 6. Railgun: kills heavies and lines
- **Now:** a piercing beam, 1, 2 then 4 damage.
- **Blind spot:** a thin beam is poor against a spread swarm.
- **Limit:** a 0.4 s charge before each shot (with a glow on the gun), so it can't be spammed at drones.
- **Card line:** "Heavies and anything in a line."

### 7. Tesla Arc: crowds of small fliers
- **Now:** every hit arcs to 3 nearby threats; the arcs chain at level 2.
- **Blind spot:** the arcs only jump between small fliers (drones, mini-drones, guided). They never reach heavies, aircraft or anything armoured. A lone target gets nothing extra.
- **Limit:** arcs don't jump across land. That also makes the map matter.
- **Card line:** "Crowds of small fliers."

### 8. Shrapnel Shell: breaks one tight cluster
- **Now:** 10–18 fragments out in every direction. Its card says "Swarms", the same as Flak.
- **Change:** split it from Flak. Shrapnel is an instant burst at one point; Flak holds an area over time.
- **Blind spot:** a fragment does 1 damage, so a heavy, a bomber or a strafer shrugs off all but a few.
- **Limit:** fragments stop at the first thing they hit at levels 1–2 (as now). Fragstorm is the only level that tears through.
- **Card line:** "One tight pack. Armour shrugs it off."

### 9. Frigate Escort: an anti-air and anti-surface picket
- **Now:** two or three frigates fire at anything in range. The card says "Everything", the clearest break of the player's rule.
- **Change:** frigates fire at aircraft, drones and surface threats only, never missiles. Missiles are Aegis's job.
- **Limit:** each frigate covers its own sector (half the map either side of its station), not the whole field.
- **Card line:** "Jets, drones and boats near the convoy."

### 10. Thermobaric Shell: the big slow blast for slow packs
- **Now:** one huge blast, hitting for 1, 2 then 3.
- **Blind spot:** a slow shell that bursts 0.5 s after the tap, so fast missiles are gone before it goes off.
- **Limit:** (choose one)
  - (a) costs 2 rounds a shell;
  - (b) the blast also scorches your own ships inside it (no sink, just 1 hull). This rewards aiming.
- **Card line:** "Slow packs. Fast missiles outrun the shell."

### 11. Scattergun: close defence round the carrier
- **Now:** 8–15 pellets from the gun toward the tap, reaching 650–860 px.
- **Blind spot:** anything far from the gun. The reach is cut to about 450–600 px, so it is genuinely close-in.
- **Limit:** in return, pellets do double damage within 200 px of the gun (a last-ditch weapon).
- **Card line:** "Anything closing on the carrier. Short reach."

### 12. Boomerang: cuts a line of threats
- **Now:** a blade out to the tap and back, cutting on both passes.
- **Blind spot:** clumps (it passes through a pack once each way, for 1–2 damage).
- **Limit:** one blade out at a time (two at level 3). A tap while it is out does nothing (the rack isn't spent).
- **Card line:** "A line of threats. One blade at a time."

### Resupply (not a weapon)
It only refills once, and in two logs the rack still ran dry in wave 10 after picking it. That belongs to the pacing pass, not here.

## Coverage after the changes

✓ = strong, · = some, ✗ = blind spot

| | Swarms | Guided / ballistic | Supersonic | Heavy | Aircraft | Surface |
|---|---|---|---|---|---|---|
| Flak | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Seeker | ✓ | · | ✗ | · | · | · |
| Aegis | · | ✓ | ✓ | · | ✗ | ✗ |
| Well | ✓ | · | · | ✗ | ✗ | ✗ |
| Air Strike | · | · | ✗ | · | ✓ | ✓ |
| Railgun | · | ✓ | ✓ | ✓ | · | · |
| Tesla | ✓ | · | ✗ | ✗ | ✗ | ✗ |
| Shrapnel | ✓ | · | · | ✗ | ✗ | ✗ |
| Frigates | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Thermo | ✓ | · | ✗ | · | · | · |
| Scatter | ✓ | ✓ | · | · | · | · |
| Boomerang | · | · | · | · | · | ✓ |

Every column has at least two strong answers, and no weapon is strong
everywhere.

## Six new weapon ideas (curiosity only; the game stays at 12)

Ideas already tried and cut are left out: EMP Rounds, Hellfire Salvo, Smoke Shells, Decoy Flares, Sub Hunter, Cryo Rounds and a Point-Defense Laser.

1. **Harpoon Battery** (surface)
   - A tap on a boat, truck, sub or rig sends a sea-skimming missile that kills it in one hit. It ignores everything in the air.
   - Level 3 adds a harpoon that also hits the next surface target in line.
2. **Sky Net** (aircraft and drones, area denial)
   - A tap raises a short net across the water at that spot for 6 s. Drones and jets that fly into it are snagged; a strafer caught in it crashes.
   - Missiles fly over it.
   - It answers the strafer runs that sank 4 ships at once.
3. **Counter-Battery** (launchers)
   - Tap an incoming ballistic or guided missile: the shot traces it back and hits the base that fired it, which goes quiet for 8 s.
   - The only weapon that hits the source.
4. **Hunter Drones** (escort)
   - A tap releases two friendly drones that circle the spot for 8 s and ram the first threats that come near.
   - Slow, so fast missiles get past.
5. **Laser Designator** (focus and synergy)
   - A tap marks a target for 5 s. Every shot that hits it, including Aegis, frigates and seekers, does double damage.
   - On its own it barely hurts; with other weapons it melts heavies and bosses.
6. **Evasive Orders** (evasion)
   - A tap on a ship makes the nearest group swerve and sprint for 2 s: strafer lines and ballistic impact points miss.
   - It protects without shooting, a new kind of decision.

## To lock

For each weapon, one of:
- **keep as proposed;**
- **change it;**
- **leave the weapon as it is.**

Also pick Thermobaric's limit (a: 2 rounds, or b: scorches your own ships).

Once locked, the build is a separate round:
- data and sim changes;
- card text;
- tests per weapon, checking that the blind spot is real;
- a bot comparison, so each weapon's pick-and-win rate stays within reason.
