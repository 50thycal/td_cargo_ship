# V3 playtest round 8 — weapon notes

The player played most of the weapons and went through the list, weapon by
weapon. Kept as they are: Shrapnel, Frigates ("really fun and OP, works
for about any scenario"), Thermobaric ("being able to fire at nothing and
use the blast to intercept is great"), Scattergun, Flak, Gravity Well,
Railgun, Tesla, Resupply and all six power-ups. Boomerang is "mid at best…
it will just always be the weaker choice. I don't think we need to change
anything": kept as it is. Three changes:

## 1. Carpet Strike: a napalm bombing run

> "The fire streak on the last upgrade should be like a napalm bomb that
> spins and then explodes behind the jet, so it's like a bombing run."

Before, the whole row caught fire the instant the jet was called. Now the
jet drops a napalm canister every 130 px as it flies:

- Each canister tumbles end over end for 0.35 s, drifting on a little and
  shrinking towards the water.
- Then it bursts in a fireball and sets its 130 px stretch of the row
  burning for 2 s.
- The stretches meet edge to edge, so the whole row still burns, a beat
  behind the jet (the drift is allowed for, so the fire starts at the
  screen's edge).

The damage is unchanged: the jet's own pass, then the burning row ticking.
A test checks that nothing burns ahead of the jet, that the row ends up
covered edge to edge, and that a plain Air Strike drops nothing.

## 2. Seekers: a third of a shot each

> "Since one shot makes like 3 or more of the seekers, I say each seeker
> should do about a third of the damage of a normal shot."

- Each seeker now hits for a third of a shot (a third of the gun's hit,
  so Proximity Fuse 5 makes it two thirds).
- At a third each, seekers spread one per threat would kill nothing, so
  they go in threes: each threat, nearest the tap first, gets as many as it
  takes to bring it down, and any left over go to the nearest.
- Three seekers bring down a drone; Swarm Pod's five leave a 2-hit guided
  missile at a third.
- Interceptors on their way to a threat now count by the damage they
  carry, so the main gun, the frigates and Point Defense don't pass over a
  threat with only a third of a hit coming.
- A seeker's small splash is its own third of a hit.

## 3. Aegis: every ship's own interceptors

> "I think it will be better if all cargo ships get one interceptor missile
> that they can fire from their ship to hit a threat that is about to hit
> them. This will be applied to all existing cargo ships on the screen and
> all that spawn while it is active. Then it will disappear for all ships
> after the time is up. Come up with the upgrades for this one."

**Aegis Launchers → Bastion** (vs missiles). Picking it up arms every cargo
ship, and every ship that sails in while it is loaded. A ship fires one of
its own interceptors at a threat closing on it within reach: one aimed at
it, or an aircraft over it. When the weapon goes, so do the launchers. Like
the frigates, your gun fires plain shots meanwhile, and the ships' shots
cost nothing from the rack.

| Level | What it does |
|---|---|
| **Aegis Launchers** | 1 interceptor a ship, reach 240 |
| LV 2 | 2 a ship, fired from further out (reach 320) |
| **MAX: Bastion** | Spent ones reload, one every 3 s, and the carrier fires 3 of its own |

Each ship shows its interceptors as small upright missiles over it, in the
weapon's colour. A reloading Bastion slot fills in as it comes back. A
fresh Aegis pickup rearms every hull in full. The domes are gone entirely,
along with their art, icon and death-screen tips (now "Aegis Launchers fire
from every ship").

## Checks

- `npm test`: all pass (V3: 60). New or rewritten tests:
  - **seekers:** three on the nearest drone, bringing it down; the next
    tap goes to the next one; a guided missile left at a third;
  - **Aegis:** holding fire out of reach or at another ship's threat;
    firing at a threat closing in, free to the rack; spent at LV 1; new
    ships armed; all gone with the weapon; the gun still plain;
  - **Bastion:** two a ship that reload; the carrier firing its own;
  - **Carpet Strike:** the canisters, the burn behind the jet, edge to
    edge, a plain strike dropping nothing.
- `npm run e2e:v3`: 56 checks. Aegis's check is now "the ships are armed";
  the log check is at version 12.
- Browser, 844×390:
  - **The napalm run, frame by frame:** canisters fall behind the jet,
    fireballs burst in a line behind it, the row is alight from edge to
    edge.
  - **Bastion against missiles at four ships and a drone at the carrier:**
    each fired, all five threats down.
  - **Found and fixed:** the interceptor marks over the ships were ~4 px on
    a phone. They are now half again as big, outlined.
- **Balance** (average bot):

  | Weapon alone (40 runs) | Before | Now |
  |---|---|---|
  | Seekers | 65% | **25%** |
  | Aegis | 28% | **40%** |
  | Air Strike | 20% | 25% (noise) |

  Random drafts over 32 seeds a map: 46% (49% before, within noise).

## Limitations

- Seekers fall from the second-best weapon alone to among the weakest
  (25%), as the player asked. If they now feel weak, the knobs are the
  share of a shot (`AB.seeker.damage`) and the count (3 / 4 / 5).
- Aegis launchers fire at threats aimed at their own ship. A splash from a
  hit on a neighbour isn't seen coming.
