// Words and fixes for the note boxes' keyboard (keys.ts), learned from the
// player's own playtest notes (201 of them, Oct–Nov 2026): what they write
// most, how their voice dictation mishears the game's names, and the typos
// that keep coming back. Pure: no DOM, no keyboard import, so it is tested.
//
// Rebuild the phrase model (noteModel.json) from fresh notes with
// `npx vite-node tools/keys/note-model.ts -- notes.json` (see docs/KEYBOARD.md).

/** Game and design words the keyboard's general dictionary doesn't have, so
 *  autocorrect would "fix" them. (Names the game defines itself — weapons,
 *  maps, foes, events — are collected from the data in keys.ts.) */
export const EXTRA_WORDS: readonly string[] = [
  'rework', 'reworked', 'projectiles', 'grapple', 'silos', 'overlaps', 'overlapped', 'slowdown',
  'biohazard', 'timings', 'gunship', 'gunships', 'rename', 'categorize', 'unplayable', 'reloading',
  'overclocked', 'leveling', 'sparingly', 'decoys', 'variability', 'pickups', 'hydras', 'quirk',
  'heli', 'launchers', 'prioritizing', 'frigate', 'frigates', 'combos', 'synergies', 'tweaking',
  'laserbeam', 'warthog', 'periscope', 'playtest', 'playtesting', 'tho', 'jittery', 'spottable',
  'intercept', 'munitions', 'nukes', 'boosts', 'passives', 'airdrop', 'scorecard', 'tweaks',
  'aegis', 'invincibility', 'advantageous', 'scenarios', 'retry', 'jitter', 'doable', 'tuneable', 'rebalance', 'cooldown', 'hitbox', 'onscreen', 'offscreen', 'inbound',
];

/** Misspellings seen in the notes → what was meant. Whole words, any case. */
export const TYPO_FIXES: Readonly<Record<string, string>> = {
  missle: 'missile', missles: 'missiles', damange: 'damage', damnabe: 'damage', cna: 'can',
  cirle: 'circle', radui: 'radius', friget: 'frigate', frigets: 'frigates', iust: 'just',
  radom: 'random', gam: 'game', appart: 'apart', prbs: 'probably', invinciblity: 'invincibility',
  senarjos: 'scenarios', toredaos: 'torpedoes', advtentagus: 'advantageous', brining: 'bringing',
  pleasen: 'please', ammon: 'ammo', amoun: 'amount', spotable: 'spottable', projective: 'projectile',
  aeigus: 'aegis', worthhog: 'warthog', hydro: 'hydra', parascope: 'periscope', wayyyyto: 'way too',
  wayyyyyy: 'way', itnshoudl: 'it should', onenote: 'one note', teh: 'the', adn: 'and', taht: 'that',
  rees: 'needs', drom: 'drone', mutinous: 'munitions', tithe: 'to the',
  wiht: 'with', thier: 'their', recieve: 'receive', definately: 'definitely', seperate: 'separate',
  alot: 'a lot', wich: 'which', becuase: 'because', beleive: 'believe', untill: 'until',
};

/** Phrases voice dictation gets wrong → the game's own words. */
export const DICTATION_FIXES: ReadonlyArray<readonly [RegExp, string | ((...m: string[]) => string)]> = [
  [/\bdual (?:weld|wheel|wheels|wield)\b/gi, 'Dual Wield'],
  [/\btesla lab\b/gi, 'Test Lab'],
  [/\bstargate (?:matt|map)\b/gi, 'Saltgate map'],
  [/\bstargate\b/gi, 'Saltgate'],
  // "a 10 warthog", "an a ten warthog", "the 10 warthog" → "an A-10 Warthog" / "the A-10 Warthog"
  [/(?:\b(an?|the)\s+)?(?:a[\s-]?ten|a-10|10|ten)\s+warthog\b/gi, (_m, art) => (/^the$/i.test(art ?? '') ? `${art} ` : art ? 'an ' : '') + 'A-10 Warthog'],
  [/\bcan all gates?\b/gi, 'canal gate'],
  [/\boral strike\b/gi, 'Orbital Strike'],
  [/\bplate testing\b/gi, 'play testing'],
  [/\bwire radius\b/gi, 'wider radius'],
  [/\bdrone s\b/gi, 'drones'],
];

/** Keep the case pattern of what was typed: SHOUT, Title or lower. */
function matchCase(template: string, word: string): string {
  if (template.length > 1 && template === template.toUpperCase() && /[A-Z]/.test(template)) return word.toUpperCase();
  if (template[0] && template[0] !== template[0].toLowerCase()) return word[0].toUpperCase() + word.slice(1);
  return word;
}

/** What the keyboard's own corrector says about a word: a fix, or null. */
export type Corrector = (word: string, opts: { sentenceStart: boolean }) => string | null;

/**
 * Clean up a note: known typos, then dictation mishears of the game's names,
 * then (when given) the keyboard's spell corrector on what's left. Meant for
 * the "Fix" key: one tap over the whole note or the selected part.
 */
export function fixText(text: string, correct?: Corrector): string {
  let out = text.replace(/[A-Za-z]+/g, (w) => {
    const fix = TYPO_FIXES[w.toLowerCase()];
    return fix ? matchCase(w, fix) : w;
  });
  for (const [re, to] of DICTATION_FIXES) out = out.replace(re, to as string);
  if (correct) {
    // Leave contractions alone (the corrector reads "she'll" as "shell"), and
    // stretched words ("wayyyy", "oooo"): those are on purpose.
    out = out.replace(/[A-Za-z]+(?:['’][A-Za-z]+)*/g, (w, at: number) => {
      if (/['’]/.test(w) || /(.)\1{2,}/i.test(w)) return w;
      const before = out.slice(0, at);
      const sentenceStart = /(^|[.!?]\s+|\n\s*)$/.test(before);
      return correct(w, { sentenceStart }) ?? w;
    });
  }
  return out;
}
