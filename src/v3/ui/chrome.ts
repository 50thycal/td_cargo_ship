// Line icons for the screens around a run (menus round): one stroke style
// in the text's own colour, in place of mixed emoji. The gear and pencil
// are Feather's (MIT).

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  anchor: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21M7.5 11h9M4 13.5c0 4 3.6 7.5 8 7.5s8-3.5 8-7.5"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  note: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
} as const;

export type ChromeIcon = keyof typeof PATHS;

export function chromeSvg(name: ChromeIcon, size = 18): string {
  return `<svg class="v3-ic" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** The game's mark: a radar ring with its sweep over a hull, for the title. */
export const MARK_SVG = `<svg class="v3-mark" viewBox="0 0 64 64" aria-hidden="true">
  <defs><linearGradient id="v3-sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe9ff" stop-opacity="0"/><stop offset="1" stop-color="#7fe9ff" stop-opacity="0.55"/></linearGradient></defs>
  <circle cx="32" cy="32" r="29" fill="#0b1820" stroke="#7fe9ff" stroke-opacity="0.55" stroke-width="2"/>
  <circle cx="32" cy="32" r="19" fill="none" stroke="#7fe9ff" stroke-opacity="0.22" stroke-width="1.5"/>
  <g class="v3-mark-sweep"><path d="M32 32 L61 32 A29 29 0 0 0 52.5 11.5 Z" fill="url(#v3-sweep)"/></g>
  <path d="M17 37h30l-5 6H22z" fill="#f4f1e8"/>
  <path d="M27 31h9v6h-9z" fill="#f4f1e8"/>
  <circle cx="45" cy="19" r="2.4" fill="#ff4d3d"/>
</svg>`;
