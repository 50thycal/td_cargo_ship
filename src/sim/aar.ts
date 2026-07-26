// After-action report narrative builder. The AAR is a gameplay system, not a
// stats dump: it is where the enemy's evolution becomes visible and where the
// player is given enough forensic detail to diagnose — but not a single
// prescribed fix.

import type { AarCard, TechKey, TransitEvent, TransitState } from './types';

const LOSS_NARRATIVES: Record<string, (name: string) => string> = {
  missile: (name) =>
    `${name} took a direct missile hit and went down with her cargo.`,
  guidedMissile: (name) =>
    `${name} was singled out by a guided missile that tracked her through evasive maneuvering.`,
  mine: (name) =>
    `${name} struck a naval mine. The field was not charted on any of our sensor picture.`,
  chartedMine: (name) =>
    `${name} struck a charted mine — the field was known, but the helm could not clear it in formation. Wider spacing or a lane change would have given her room.`,
  lowSigMine: (name) =>
    `${name} struck a mine that our detection systems failed to register — even where coverage was active.`,
  torpedo: (name) =>
    `${name} was hit below the waterline by a torpedo. Nothing in the air-defense picture could have touched it — the run came in under the surface.`,
  homingTorpedo: (name) =>
    `${name} tried to turn out of the torpedo's path and it followed her around. The weapon was tracking, not running straight.`,
  lowSigTorpedo: (name) =>
    `${name} was struck by a torpedo that left no readable wake and never appeared on the sonar picture before impact.`,
  attackBoat: (name) =>
    `${name} was worked over at close range by an attack boat that stayed on her until she went down. Nothing that shoots at aircraft could be brought to bear.`,
  rocketBoat: (name) =>
    `${name} was broken open by rocket fire from a fast boat alongside. She sank far quicker than small-arms fire would have managed.`,
  captured: (name) =>
    `${name} was boarded and taken. She is under a prize crew making for the hostile shore — hull, cargo and all. This is not a sinking; the enemy has her.`,
  chain: (name) =>
    `${name} was caught by the blast of a missile that struck a ship packed in close alongside her — the price of a tight formation.`,
  fire: (name) =>
    `${name} survived the initial hit but the fire spread out of control before she could reach port.`,
  explosion: (name) =>
    `${name} was caught in the blast of an exploding tanker sailing alongside.`,
  timeout: (name) =>
    `${name} fell behind the convoy and was lost at sea after the escort screen moved on.`,
};

const DISCOVERY_CARDS: Partial<Record<TechKey, AarCard>> = {
  guidedMissile: {
    kind: 'discovery',
    title: 'New enemy capability: terminal guidance',
    body:
      'Enemy missiles are now correcting course in flight and tracking individual ships. ' +
      'Straight-line interception timing will no longer be reliable. Options include faster ' +
      'interceptors, electronic countermeasures, or hardening the ships they hunt.',
  },
  mine: {
    kind: 'discovery',
    title: 'New enemy capability: naval mines',
    body:
      'The enemy has begun seeding the strait with contact mines. Nothing in the current ' +
      'convoy loadout charts them before impact. Detection sonar, scanning pulses, wider ' +
      'formations, or simply routing around suspect water are all viable responses.',
  },
  lowSigMine: {
    kind: 'discovery',
    title: 'New enemy capability: low-signature mines',
    body:
      'Forensic analysis of the wreck indicates a composite mine casing our sonar cannot ' +
      'register. Existing mine detection is no longer sufficient on its own. Analysts propose ' +
      'composite-signature research; until then, spacing and routing are the only mitigation.',
  },
  torpedo: {
    kind: 'discovery',
    title: 'New enemy capability: torpedoes',
    body:
      'Submerged runs are now coming in against the convoy. Interceptors, point defense and ECM ' +
      'cannot touch a torpedo — they only engage things in the air. Straight-running weapons ' +
      'leave a wake a lookout can read close in; hydrophones hear them much further out, and ' +
      'depth charges are the only thing aboard that can kill one.',
  },
  homingTorpedo: {
    kind: 'discovery',
    title: 'New enemy capability: homing torpedoes',
    body:
      'Enemy torpedoes are steering onto their targets instead of running a fixed bearing. ' +
      'Turning a ship out of the path no longer breaks the run — the weapon follows. Killing ' +
      'the torpedo outright, or hearing it early enough to have time to, is what is left.',
  },
  lowSigTorpedo: {
    kind: 'discovery',
    title: 'New enemy capability: low-signature torpedoes',
    body:
      'The run that hit us left no wake and no passive signature. Standard hydrophone watch and ' +
      'sonar sweeps will not raise these before impact. Analysts propose low-signature processing ' +
      'on the hydrophone array, or a return filter on the active sonar; without one of those, ' +
      'depth charges have nothing to aim at.',
  },
  attackBoat: {
    kind: 'discovery',
    title: 'New enemy capability: attack boats',
    body:
      'Fast craft are now closing with the convoy and staying alongside a ship until she sinks. ' +
      'A boat is not a shot to be blocked — it is a vessel with a crew, it remains on the water, ' +
      'and it moves to the next hull when it finishes. Interceptors point at the sky and cannot ' +
      'depress onto it. Escort deck guns are the weapon for this, and sinking the boat is the ' +
      'only thing that stops it.',
  },
  rocketBoat: {
    kind: 'discovery',
    title: 'New enemy capability: rocket boats',
    body:
      'The boats are carrying rocket racks now and are opening hulls in roughly half the time. ' +
      'They are also built heavier: deck-gun rounds are glancing off until the crews have ' +
      'armour-piercing ammunition to work with.',
  },
  boardingBoat: {
    kind: 'discovery',
    title: 'New enemy capability: boarding parties',
    body:
      'The enemy is no longer trying to sink us — a boarding party took a ship and sailed her ' +
      'away. Absorbing damage is no answer to this: a captured hull costs more than a sunk one ' +
      'and hull plating does not slow a boarding. Anti-boarding countermeasures buy the crew ' +
      'time, and deck guns that kill the boat throw the party off entirely.',
  },
};

/** Cards derived from what happened during the transit. Discovery cards are
 *  only shown for capabilities encountered for the first time this campaign
 *  (newDiscoveries), not on every transit where the tech appears. */
export function buildTransitCards(t: TransitState, newDiscoveries: TechKey[]): AarCard[] {
  const cards: AarCard[] = [];

  // Discoveries first — they are the headline.
  for (const key of newDiscoveries) {
    const card = DISCOVERY_CARDS[key];
    if (card) cards.push(card);
  }

  // One card per lost cargo ship, with cause forensics. Escort and shore-battery
  // losses (cause prefixed 'escort:' / 'base:') carry no ship name and are
  // already reported in the defensive summary — skip them so the report never
  // shows an "undefined lost" card.
  const losses = t.events.filter(
    (e): e is TransitEvent & { shipName: string } =>
      e.type === 'shipLost' && !!e.shipName && !e.cause?.startsWith('escort:') && !e.cause?.startsWith('base:'),
  );
  for (const loss of losses) {
    const narrative = LOSS_NARRATIVES[loss.cause ?? ''] ?? ((n: string) => `${n} was lost.`);
    cards.push({
      kind: 'loss',
      title: `${loss.shipName} lost`,
      body: narrative(loss.shipName),
    });
  }

  return cards;
}

export function formatInterceptSummary(t: TransitState): string {
  const s = t.stats;
  if (s.missilesSpawned === 0) return 'No missile attacks this transit.';
  return (
    `${s.missilesIntercepted} of ${s.missilesSpawned} missiles stopped ` +
    `(${s.playerIntercepts} by interceptor, ${s.pdKills} by point defense` +
    (s.ecmKills > 0 ? `, ${s.ecmKills} by ECM jamming` : '') +
    `).`
  );
}
