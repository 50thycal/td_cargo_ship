// The in-game touch keyboard (palate-keys, shared with Palate and other apps):
// the player's note boxes use it in place of the phone's keyboard, which
// covers most of a landscape screen. Playtest build only (the store build has
// no text boxes); desktop keeps its real keyboard.
//
// What the game adds on top of the typing keyboard, all drawn from the
// player's own playtest notes (noteWords.ts, noteModel.json):
//  - two hotkey strips, one for Test Lab verdicts and one for notes during a
//    run: the phrases they write most, tap for the usual one, swipe up for its
//    opposite, hold for a third;
//  - a Fix key that corrects a whole note in one tap: typos, voice-dictation
//    mishears of the game's names, then the keyboard's own spell corrector;
//  - suggestions from their own phrasing (after "good" → "overall"), their own
//    sentence openers, and the game's words (foes, weapons, maps) so those are
//    predicted, never "corrected";
//  - the dark command-room colours (style.css, "In-game keyboard").
//
// `?keys=always` forces it on a desktop (for a test), `?keys=off` turns it off.

import { decorate, init, lang, type Hotkey, type KeysContext } from 'palate-keys';
import 'palate-keys/css/keyboard.css';
import model from './noteModel.json';
import { gameWords } from './noteVocab';
import { DICTATION_FIXES, EXTRA_WORDS, fixText, TYPO_FIXES } from './noteWords';

export interface KeysHooks {
  /** Where the run is, "Wave 8, 31 s", or null outside a run. */
  stamp(): string | null;
  /** The keyboard came up, moved or went away: refit the dialog above it. */
  onChange(): void;
}

const LEARNED_KEY = 'straitwatch.keys.learned';

/** 🎤: hand the box to the phone's keyboard for dictation. */
const MIC: Hotkey = { label: '🎤', title: 'Dictate with the phone keyboard', dictate: true, style: 'plain' };

/** ✓ Fix: correct the whole note, or just the selected part. */
const FIX: Hotkey = {
  label: '✓ Fix',
  title: 'Fix spelling and dictation mistakes',
  run: (ctx: KeysContext) => {
    const { start, end, text: picked } = ctx.selection;
    const [a, b] = picked ? [start, end] : [0, ctx.text.length];
    const before = ctx.text.slice(a, b);
    const after = fixText(before, (w, o) => lang.correct(w, o));
    if (after === before) ctx.flash('Nothing to fix');
    else {
      ctx.replace(a, b, after);
      ctx.flash('Fixed');
    }
  },
};

const HARD: Hotkey = {
  label: 'Hard',
  insert: 'Hard but doable. ',
  alt: { label: 'too hard', insert: 'Too hard. ' },
  hold: { label: 'easy', insert: 'Too easy. ' },
};

const MAKE: Hotkey = {
  label: 'Make',
  insert: 'Make sure ',
  alt: { label: 'a little', insert: 'Make it a little ' },
  hold: { label: 'obvious', insert: 'Make it more obvious. ' },
};

/** Test Lab verdicts (111 of the player's notes): a verdict, then what to change. */
function verdictKeys(): Hotkey[] {
  return [
    MIC,
    FIX,
    {
      label: 'Good',
      insert: 'Good overall. ',
      alt: { label: 'works', insert: 'Works as expected. ' },
      hold: { label: 'better', insert: 'Much better. ' },
    },
    HARD,
    {
      label: 'Faster',
      insert: 'Make it a little faster. ',
      alt: { label: 'slower', insert: 'Make it a little slower. ' },
      hold: { label: 'bigger', insert: 'Make it a little bigger. ' },
    },
    MAKE,
    {
      label: 'Rework',
      insert: 'Rework this one. ',
      alt: { label: 'remove', insert: 'Remove this one. ' },
      hold: { label: 'keep', insert: 'Keep as is. ' },
    },
    {
      label: 'Later',
      insert: 'Will tweak later. ',
      alt: { label: 'retry', insert: 'Will try again. ' },
    },
  ];
}

/** Notes during a run (76): what they saw, and the audits they ask for. */
function noteKeys(hooks: KeysHooks): Hotkey[] {
  return [
    MIC,
    FIX,
    {
      label: 'Note',
      insert: 'Note: ',
      alt: { label: 'maps', insert: 'Note for all maps: ' },
      hold: {
        label: '@ now',
        run: (ctx) => {
          const at = hooks.stamp();
          if (at) ctx.insert(`${at}: `);
          else ctx.flash('Not in a run');
        },
      },
    },
    MAKE,
    {
      label: 'Fun',
      insert: 'Very fun round. ',
      alt: { label: 'clutch', insert: 'That was a clutch moment. ' },
      hold: { label: 'tough', insert: 'That was hard. ' },
    },
    {
      label: 'Overlap',
      insert: 'They overlap each other. ',
      alt: { label: 'jitter', insert: 'It is jittery on the turn. ' },
      hold: { label: 'smooth', insert: 'It should move more smoothly. ' },
    },
    {
      label: 'Audit',
      insert: 'Do an audit to make sure ',
      alt: { label: 'map', insert: 'Run an audit on this map. ' },
      hold: { label: 'all', insert: 'Do an audit on all of these. ' },
    },
    HARD,
  ];
}

/** The hotkeys' text, for the spelling test. */
export function hotkeyTexts(hooks: KeysHooks = { stamp: () => null, onChange: () => undefined }): string[] {
  const out: string[] = [];
  for (const k of [...verdictKeys(), ...noteKeys(hooks)]) {
    for (const part of [k, typeof k.alt === 'object' ? k.alt : undefined, typeof k.hold === 'object' ? k.hold : undefined]) {
      if (part?.insert) out.push(part.insert);
      if (part?.label) out.push(part.label);
    }
  }
  return out;
}

/** The words the keyboard should know and favour: the player's own (weighted
 *  by how often they write them), the game's names, and the design words the
 *  general dictionary lacks. */
export function noteVocabulary(): Map<string, number> {
  const words = new Map<string, number>(Object.entries(model.words));
  // The right spellings the Fix key writes must be known too, or it would
  // correct its own corrections.
  const fixed = [...Object.values(TYPO_FIXES), ...DICTATION_FIXES.map(([, to]) => (typeof to === 'string' ? to : 'warthog'))].flatMap((s) => s.toLowerCase().match(/[a-z]{3,}/g) ?? []);
  for (const w of [...gameWords(), ...EXTRA_WORDS, ...fixed]) words.set(w, Math.max(words.get(w) ?? 0, 3));
  return words;
}

type Next = { word: string; count: number }[];
const list = (o?: Record<string, number>): Next => Object.entries(o ?? {}).map(([word, count]) => ({ word, count }));

/** After one or two words, what the player usually writes next. */
async function nextWords(context: string[]): Promise<{ bigrams: Next; trigrams: Next }> {
  const last = context[context.length - 1];
  const prev = context[context.length - 2];
  const bigrams = (model.bigrams as Record<string, Record<string, number>>)[last];
  const trigrams = prev ? (model.trigrams as Record<string, Record<string, number>>)[`${prev} ${last}`] : undefined;
  return { bigrams: list(bigrams), trigrams: list(trigrams) };
}

function wanted(): 'auto' | 'always' | 'off' {
  const v = new URLSearchParams(location.search).get('keys');
  return v === 'always' || v === 'off' ? v : 'auto';
}

function readLearned(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LEARNED_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string') : [];
  } catch {
    return [];
  }
}

export function startKeys(root: HTMLElement, hooks: KeysHooks): void {
  const mode = wanted();
  if (mode === 'off') return;
  // The keyboard's colours key off the page's theme.
  document.documentElement.dataset.theme = 'dark';
  lang.setPersonalVocabulary(noteVocabulary());
  lang.setContextSource(nextWords);
  lang.setStarters(model.starters);
  // A word the player un-corrects (backspace right after a correction) is
  // theirs from then on.
  let learned = readLearned();
  lang.setLearnedWords(learned);
  init({
    mode,
    storagePrefix: 'straitwatch.keys.',
    hotkeys: { note: noteKeys(hooks), verdict: verdictKeys() },
    onVisibility: () => hooks.onChange(),
    onLearn: (word: string) => {
      const w = word.toLowerCase();
      if (learned.includes(w)) return;
      learned = [...learned, w].slice(-500);
      lang.setLearnedWords(learned);
      try {
        localStorage.setItem(LEARNED_KEY, JSON.stringify(learned));
      } catch {
        // storage full or blocked: learned for this session only
      }
    },
  });

  // Every text box a dialog builds (the note, the wave rating's note, the
  // Test Lab's verdict note) takes the keyboard: no per-box wiring.
  const claim = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const boxes = [node, ...node.querySelectorAll('textarea, input[type="text"]')].filter(
      (e): e is HTMLTextAreaElement | HTMLInputElement =>
        (e instanceof HTMLTextAreaElement || (e instanceof HTMLInputElement && e.type === 'text')) && !('pk' in e.dataset),
    );
    for (const box of boxes) {
      box.dataset.pk = '';
      box.dataset.pkHotkeys = box.classList.contains('v3-lab-note') ? 'verdict' : 'note';
      if (box instanceof HTMLInputElement) box.enterKeyHint = 'done';
      decorate(box);
    }
  };
  claim(root);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(claim))).observe(root, { childList: true, subtree: true });
}
