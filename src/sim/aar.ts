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
