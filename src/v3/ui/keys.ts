// The in-game touch keyboard (palate-keys, shared with Palate and other apps):
// the player's note boxes use it in place of the phone's keyboard, which
// covers most of a landscape screen. Playtest build only (the store build has
// no text boxes); desktop keeps its real keyboard.
//
// What the game adds on top of the typing keyboard:
//  - a strip of note hotkeys (stamp the wave and time, quick verdicts: tap for
//    one word, swipe up for its opposite);
//  - the game's own words (foes, weapons) so they are predicted, not "fixed";
//  - the dark command-room colours (style.css, "In-game keyboard").
//
// `?keys=always` forces it on a desktop (for a test), `?keys=off` turns it off.

import { decorate, init, lang, type Hotkey } from 'palate-keys';
import 'palate-keys/css/keyboard.css';
import { ABILITIES } from '../data/abilities';
import { THREATS } from '../data/config';
import { FOES } from '../data/foes';

export interface KeysHooks {
  /** Where the run is, "Wave 8, 31 s", or null outside a run. */
  stamp(): string | null;
  /** The keyboard came up, moved or went away: refit the dialog above it. */
  onChange(): void;
}

/** The hotkey set the note boxes use (data-pk-hotkeys="note"). */
function noteKeys(hooks: KeysHooks): Hotkey[] {
  return [
    { label: '🎤', title: 'Dictate with the phone keyboard', dictate: true, style: 'plain' },
    {
      label: '@ now',
      title: 'Stamp the wave and time',
      run: (ctx) => {
        const at = hooks.stamp();
        if (at) ctx.insert(`${at}: `);
        else ctx.flash('Not in a run');
      },
    },
    { label: 'too hard', insert: 'too hard. ', alt: { label: 'easy', insert: 'too easy. ' }, hold: { label: 'ok', insert: 'about right. ' } },
    { label: 'unfair', insert: 'felt unfair: ', alt: { label: 'cheap', insert: 'felt cheap: ' } },
    { label: 'fun', insert: 'fun: ', alt: 'boring: ' },
    { label: 'unclear', insert: 'confusing: ', alt: { label: 'lost', insert: "couldn't tell what to do. " } },
    { label: 'bug', insert: 'BUG: ', alt: 'crash: ' },
  ];
}

/** Foe, threat and weapon names, so a note about a "Torpedo Sub" isn't autocorrected. */
function gameVocabulary(): Map<string, number> {
  const names = [
    ...Object.values(THREATS).map((t) => t.label),
    ...Object.values(FOES).map((f) => f.name),
    ...Object.values(ABILITIES).flatMap((a) => [a.name, a.evolved]),
  ];
  const words = new Map<string, number>();
  for (const name of names) {
    for (const w of name.toLowerCase().match(/[a-z]{3,}/g) ?? []) words.set(w, 3);
  }
  return words;
}

function wanted(): 'auto' | 'always' | 'off' {
  const v = new URLSearchParams(location.search).get('keys');
  return v === 'always' || v === 'off' ? v : 'auto';
}

export function startKeys(root: HTMLElement, hooks: KeysHooks): void {
  const mode = wanted();
  if (mode === 'off') return;
  // The keyboard's colours key off the page's theme.
  document.documentElement.dataset.theme = 'dark';
  lang.setPersonalVocabulary(gameVocabulary());
  init({
    mode,
    storagePrefix: 'straitwatch.keys.',
    hotkeys: { note: noteKeys(hooks) },
    onVisibility: () => hooks.onChange(),
  });

  // Every text box a dialog builds (the note, the wave rating's note, the
  // Test Lab's note) takes the keyboard: no per-box wiring.
  const claim = (node: Node): void => {
    if (!(node instanceof Element)) return;
    const boxes = [node, ...node.querySelectorAll('textarea, input[type="text"]')].filter(
      (e): e is HTMLTextAreaElement | HTMLInputElement =>
        (e instanceof HTMLTextAreaElement || (e instanceof HTMLInputElement && e.type === 'text')) && !('pk' in e.dataset),
    );
    for (const box of boxes) {
      box.dataset.pk = '';
      box.dataset.pkHotkeys = 'note';
      if (box instanceof HTMLInputElement) box.enterKeyHint = 'done';
      decorate(box);
    }
  };
  claim(root);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(claim))).observe(root, { childList: true, subtree: true });
}
