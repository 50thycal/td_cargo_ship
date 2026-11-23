// The note keyboard's words and fixes (src/v3/ui/noteWords.ts, noteModel.json,
// keys.ts hotkeys): learned from the player's playtest notes. Their spelling
// is rough and much of it is dictated, so nothing the keyboard offers or
// writes may itself be misspelled, and nothing the game defines may be
// "corrected".

import { readFileSync } from 'node:fs';
import { lang } from 'palate-keys';
import { beforeAll, describe, expect, it } from 'vitest';
import { hotkeyTexts, noteVocabulary } from '../src/v3/ui/keys';
import model from '../src/v3/ui/noteModel.json';
import { gameWords } from '../src/v3/ui/noteVocab';
import { DICTATION_FIXES, EXTRA_WORDS, fixText, TYPO_FIXES } from '../src/v3/ui/noteWords';

const dictionary = readFileSync(new URL('../vendor/palate-keys/data/words-en.txt', import.meta.url), 'utf8')
  .split('\n')
  .map((w) => w.trim());
const dict = new Set(dictionary);

const fix = (t: string) => fixText(t, (w, o) => lang.correct(w, o));

beforeAll(() => {
  lang.setDictionary(dictionary);
  lang.setPersonalVocabulary(noteVocabulary());
});

describe('spelling of what the keyboard offers', () => {
  const known = new Set<string>([...dict, ...EXTRA_WORDS, ...gameWords()]);
  const words = (s: string) => s.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];

  it('every word on every hotkey (label, tap, swipe, hold) is spelled right', () => {
    const bad = new Set<string>();
    for (const text of hotkeyTexts()) for (const w of words(text)) if (!known.has(w) && !['fix', 'fixed'].includes(w)) bad.add(w);
    expect([...bad]).toEqual([]);
  });

  it('every right-hand side of a fix is spelled right', () => {
    const bad = new Set<string>();
    for (const to of [...Object.values(TYPO_FIXES), ...DICTATION_FIXES.map(([, t]) => (typeof t === 'string' ? t : 'a-10 warthog'))]) {
      for (const w of words(to)) if (!known.has(w) && w !== 'a') bad.add(w);
    }
    expect([...bad]).toEqual([]);
  });

  it('every word the phrase model suggests is a real word or a game word', () => {
    const bad = new Set<string>();
    const all = new Set<string>(Object.keys(model.words));
    for (const nx of Object.values(model.bigrams)) for (const w of Object.keys(nx)) all.add(w);
    for (const nx of Object.values(model.trigrams)) for (const w of Object.keys(nx)) all.add(w);
    for (const w of all) if (!known.has(w) && !w.includes("'")) bad.add(w);
    expect([...bad]).toEqual([]);
  });
});

describe('the game\'s own words are never corrected', () => {
  it('no weapon, foe, map, event or id is changed by the corrector', () => {
    const changed = gameWords()
      .map((w) => [w, lang.correct(w, { sentenceStart: false })] as const)
      .filter(([, c]) => c !== null);
    expect(changed).toEqual([]);
  });

  it('the design words the dictionary lacks are known', () => {
    for (const w of ['rework', 'projectiles', 'frigate', 'grapple', 'aegis', 'railgun', 'saltgate', 'hydras']) {
      expect(lang.isKnown(w), w).toBe(true);
    }
  });
});

describe('the Fix key', () => {
  it('fixes the typos from the notes', () => {
    expect(fix('The missle did damange and I cna see the radui')).toBe('The missile did damage and I can see the radius');
    expect(fix('Frigets just overlap, iust a prbs of the senarjos')).toBe('Frigates just overlap, just a probably of the scenarios');
  });

  it('fixes voice dictation of the game\'s names', () => {
    expect(fix('Dual weld is great')).toBe('Dual Wield is great');
    expect(fix('I dual wheel it')).toBe('I Dual Wield it');
    expect(fix('Make the plane look like a 10 warthog')).toBe('Make the plane look like an A-10 Warthog');
    expect(fix('Make it faster and an a ten worthhog')).toBe('Make it faster and an A-10 Warthog');
    expect(fix('the 10 warthog is cool')).toBe('the A-10 Warthog is cool');
    expect(fix('Stargate Matt is better')).toBe('Saltgate map is better');
    expect(fix('in this Tesla lab')).toBe('in this Test Lab');
    expect(fix('the oral strike upgrade')).toBe('the Orbital Strike upgrade');
    expect(fix('The can all gate did not work')).toBe('The canal gate did not work');
    expect(fix('slow down Hydro a bit')).toBe('slow down Hydra a bit');
  });

  it('leaves right text, contractions and the game\'s words alone', () => {
    for (const t of [
      "She'll say it's fine, we're done, wasn't it? What’s next",
      'The Torpedo Sub and the railgun, frigate, grapnel, Saltgate and Kesh.',
      'Good overall. Make sure the nuke clears the screen.',
      'Wayyyy too easy, ooooh well',
    ]) {
      expect(fix(t), t).toBe(t);
    }
  });

  it('is undoable text in, text out: nothing to fix returns the same string', () => {
    expect(fix('')).toBe('');
    expect(fix('All good.')).toBe('All good.');
  });
});

describe('suggestions from the player\'s own phrasing', () => {
  it('knows what usually follows', () => {
    const next = (w: string) => Object.keys((model.bigrams as Record<string, Record<string, number>>)[w] ?? {});
    expect(next('good')).toContain('overall');
    expect(next('make')).toEqual(expect.arrayContaining(['sure', 'it']));
    expect(next('works')).toContain('good');
    expect((model.trigrams as Record<string, unknown>)['needs to']).toBeTruthy();
  });

  it('opens sentences the way they do', () => {
    expect(model.starters).toEqual(expect.arrayContaining(['Good', 'Make']));
  });

  it('weights their habitual words above the rest', () => {
    const v = noteVocabulary();
    expect((v.get('should') ?? 0) > 20).toBe(true);
  });

  it('keeps no full notes: only phrases that came up at least twice', () => {
    for (const nx of Object.values(model.bigrams)) for (const n of Object.values(nx)) expect(n).toBeGreaterThanOrEqual(2);
    for (const nx of Object.values(model.trigrams)) for (const n of Object.values(nx)) expect(n).toBeGreaterThanOrEqual(2);
  });
});
