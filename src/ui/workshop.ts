// REGION WORKSHOP — the in-game level-authoring tool (docs/design/region-workshop.md).
//
// Two screens: a region LIBRARY (packaged templates + local drafts) and the
// BUILDER (header, environment, pressure, the round TIMELINE MATRIX and a
// type-aware inspector). Pure DOM over the pure data layer in
// data/regionAuthoring.ts; every mutation goes through that module's helpers
// and is re-validated on the spot. Nothing here touches localStorage directly
// — platform/workshopStore.ts is the adapter.
//
// The matrix is an explanation of the level, not a spreadsheet skin: a strong
// leading marker is an INTRODUCTION, a lighter band is CUMULATIVE
// availability, a patterned marker is a SCRIPTED BEAT, a stop marker ends a
// band, and a warning icon points at the exact responsible cell.

import { h } from './dom';
import { icon, type IconName } from './icons';
import { screenShell, toggleRow } from './screens';
import {
  ENEMY_BRANCHES,
  ENEMY_BRANCH_ORDER,
  TARGETING_DOCTRINE,
  type EnemyBranchKey,
} from '../data/enemyBranches';
import { geography, islandHalfHeight } from '../data/geography';
import { WORLD } from '../data/tuning';
import { REGIONS } from '../data/regions';
import {
  arsenalEntries,
  availabilityAtRound,
  beatsAtRound,
  blankRegion,
  cellState,
  clearRound,
  clone,
  compileRegion,
  deleteRound,
  duplicateRound,
  ENVIRONMENT_PRESETS,
  environmentPreset,
  insertRound,
  milestoneAt,
  pressureAtRound,
  pruneMilestone,
  refKey,
  type ArsenalEntry,
  type BeatBudget,
  type BeatPattern,
  type EncounterBeatDef,
  type EnemyLoadoutRef,
  type RegionAuthoringDef,
  type ValidationIssue,
} from '../data/regionAuthoring';
import { sweepPanel } from './workshopSweep';
import {
  deleteDraft,
  exportJson,
  freshId,
  hasDraft,
  libraryEntries,
  loadDraft,
  packagedIds,
  packagedTemplate,
  parseImport,
  saveDraft,
  validateDraft,
  type WorkshopEntry,
} from '../platform/workshopStore';

// ---------------------------------------------------------------------------
// Callbacks the game controller supplies
// ---------------------------------------------------------------------------

export interface PlaytestRequest {
  regionId: string;
  source: 'packaged' | 'local';
  round: number;
  god: boolean;
  seed: string;
}

export interface WorkshopHost {
  onBack: () => void;
  /** Start an isolated playtest of a registered (packaged or saved-valid) region. */
  onPlaytest: (req: PlaytestRequest) => void;
  /** A saved playtest exists — offer to resume it. */
  resumable: () => boolean;
  onResume: () => void;
  /** Re-render whichever workshop screen is current. */
  rerender: () => void;
}

// ---------------------------------------------------------------------------
// Editor state (module scope so re-renders keep the designer's place)
// ---------------------------------------------------------------------------

type Selection =
  | { kind: 'none' }
  | { kind: 'cell'; round: number; key: string }
  | { kind: 'pressure'; round: number }
  | { kind: 'round'; round: number }
  | { kind: 'beat'; round: number; beatId: string };

interface EditorState {
  def: RegionAuthoringDef;
  source: 'packaged' | 'local';
  dirty: boolean;
  selection: Selection;
  collapsed: Set<string>;
  view: 'matrix' | 'rounds';
  savedAt: string | null;
  notice: string | null;
  playRound: number;
  playGod: boolean;
  playSeed: string;
}

let editor: EditorState | null = null;
/** Which workshop screen is showing, for the host's rerender. */
export function workshopMode(): 'library' | 'editor' {
  return editor ? 'editor' : 'library';
}
export function closeEditor(): void {
  editor = null;
}

function openEditor(def: RegionAuthoringDef, source: 'packaged' | 'local', savedAt: string | null): void {
  editor = {
    def: clone(def),
    source,
    dirty: false,
    selection: { kind: 'none' },
    collapsed: new Set(),
    view: typeof window !== 'undefined' && window.innerWidth < 760 ? 'rounds' : 'matrix',
    savedAt,
    notice: null,
    playRound: 1,
    playGod: false,
    playSeed: `ws-${Date.now().toString(36)}`,
  };
}

// ---------------------------------------------------------------------------
// Small controls
// ---------------------------------------------------------------------------

function textInput(
  value: string,
  onChange: (v: string) => void,
  opts: { placeholder?: string; readOnly?: boolean; multiline?: boolean; className?: string } = {},
): HTMLElement {
  const el = opts.multiline ? document.createElement('textarea') : document.createElement('input');
  el.className = `ws-input ${opts.className ?? ''}`.trim();
  el.value = value;
  if (opts.placeholder) el.placeholder = opts.placeholder;
  if (opts.readOnly) el.readOnly = true;
  // Commit only on a REAL change. A commit re-renders the screen, which
  // detaches this element; Chrome then fires blur/change on the detached
  // node, and without this guard the handler would re-enter mid-removal.
  let last = el.value;
  el.addEventListener('change', () => {
    if (el.value === last) return;
    last = el.value;
    onChange(el.value);
  });
  return el;
}

function numberInput(
  value: number | null,
  onChange: (v: number | null) => void,
  opts: { min?: number; step?: number; readOnly?: boolean; allowEmpty?: boolean; width?: string } = {},
): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.className = 'ws-input ws-num';
  if (opts.width) el.style.width = opts.width;
  el.value = value === null ? '' : String(value);
  if (opts.min !== undefined) el.min = String(opts.min);
  if (opts.step !== undefined) el.step = String(opts.step);
  if (opts.readOnly) el.readOnly = true;
  let last = el.value;
  el.addEventListener('change', () => {
    if (el.value === last) return;
    last = el.value;
    if (el.value === '' && opts.allowEmpty) return onChange(null);
    const n = Number(el.value);
    onChange(Number.isFinite(n) ? n : null);
  });
  return el;
}

function selectInput(
  value: string,
  options: { value: string; label: string; disabled?: boolean }[],
  onChange: (v: string) => void,
  readOnly = false,
): HTMLSelectElement {
  const el = document.createElement('select');
  el.className = 'ws-input';
  for (const o of options) {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    if (o.disabled) opt.disabled = true;
    if (o.value === value) opt.selected = true;
    el.append(opt);
  }
  el.disabled = readOnly;
  let last = el.value;
  el.addEventListener('change', () => {
    if (el.value === last) return;
    last = el.value;
    onChange(el.value);
  });
  return el;
}

function field(label: string, control: HTMLElement, hint?: string): HTMLElement {
  const el = h('label', { className: 'ws-field' }, [h('span', { className: 'ws-field-label', text: label }), control]);
  if (hint) el.append(h('span', { className: 'hint', text: hint }));
  return el;
}

function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const BRANCH_ICON: Record<EnemyBranchKey, IconName> = {
  missiles: 'missile',
  mines: 'mine',
  torpedoes: 'sonar',
  attackBoats: 'escortShip',
  artillery: 'turret',
  smoke: 'eye',
  electronic: 'jam',
};

// ---------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------

export function workshopLibraryScreen(host: WorkshopHost): HTMLElement {
  const { root, body, footer } = screenShell(
    'Region Workshop',
    'Timeline-driven level authoring — templates, drafts, import/export, playtest',
    null,
    'workshop',
  );
  root.classList.add('workshop');

  const entries = libraryEntries();
  const table = h('table', { className: 'ws-table ws-library' });
  table.append(
    h('thead', {}, [
      h('tr', {}, [
        'Name', 'ID', 'Source', 'Environment', 'Rounds', 'Branches / loadouts', 'State', 'Edited', 'Actions',
      ].map((t) => h('th', { text: t }))),
    ]),
  );
  const tbody = h('tbody');
  for (const e of entries) tbody.append(libraryRow(e, host));
  table.append(tbody);

  const actions = h('div', { className: 'ws-actions' }, [
    h('button', { className: 'primary', text: 'New Region', onClick: () => newRegionDialog(body, host) }),
    h('button', { text: 'Import JSON', onClick: () => importDialog(body, host) }),
  ]);
  if (host.resumable()) {
    actions.append(h('button', { text: 'Resume playtest', onClick: host.onResume }));
  }

  body.append(
    h('div', { className: 'hint' }, [
      icon('alert'),
      h('span', {
        text:
          ' Packaged regions are read-only templates — clone one to experiment. Drafts save to this device; export the JSON to keep it, share it, or hand it to a Claude session to build on.',
      }),
    ]),
    actions,
    h('div', { className: 'ws-scroll' }, [table]),
  );
  footer.append(h('button', { text: 'Back', onClick: host.onBack }));
  return root;
}

function libraryRow(e: WorkshopEntry, host: WorkshopHost): HTMLElement {
  const env = environmentPreset(e.def.environmentPresetId);
  const compiled = compileRegion(e.def);
  const branches = new Set<string>();
  let loadouts = 0;
  for (const k of Object.keys(compiled.windows)) {
    if (compiled.windows[k].length === 0) continue;
    branches.add(compiled.windows[k][0].entry.branch);
    loadouts++;
  }
  const state = e.valid
    ? e.warningCount > 0
      ? h('span', { className: 'ws-badge warn', text: `Valid · ${e.warningCount} warn` })
      : h('span', { className: 'ws-badge good', text: 'Valid' })
    : h('span', { className: 'ws-badge bad', text: `Draft — not playable (${e.errorCount})` });
  const actions = h('div', { className: 'ws-row-actions' }, [
    h('button', {
      text: 'Open',
      onClick: () => {
        openEditor(e.def, e.source, e.updatedAt);
        host.rerender();
      },
    }),
    h('button', {
      text: 'Clone',
      onClick: () => {
        const copy = clone(e.def);
        copy.id = freshId(`${e.def.id}Copy`);
        copy.name = `${e.def.name} (copy)`;
        // Cloning never preserves campaign unlock links (product decision).
        copy.campaign.unlocks = null;
        openEditor(copy, 'local', null);
        editor!.dirty = true;
        host.rerender();
      },
    }),
    h('button', {
      text: 'Playtest',
      disabled: !e.valid,
      onClick: () =>
        host.onPlaytest({
          regionId: e.id,
          source: e.source,
          round: 1,
          god: false,
          seed: `ws-${Date.now().toString(36)}`,
        }),
    }),
    h('button', { text: 'Export', onClick: () => downloadText(`region-${e.id}.json`, exportJson(e.def)) }),
  ]);
  if (e.source === 'local') {
    actions.append(
      h('button', {
        className: 'danger',
        text: 'Delete',
        onClick: () => {
          if (confirm(`Delete draft "${e.def.name}" (${e.id})? Export it first if you want to keep it.`)) {
            deleteDraft(e.id);
            host.rerender();
          }
        },
      }),
    );
  }
  return h('tr', {}, [
    h('td', { text: e.def.name }),
    h('td', {}, [h('code', { text: e.id })]),
    h('td', { text: e.source === 'packaged' ? 'Built-in' : 'Local draft' }),
    h('td', { text: env?.name ?? e.def.environmentPresetId }),
    h('td', { text: String(e.def.completionRound) }),
    h('td', { text: `${branches.size} / ${loadouts}` }),
    h('td', {}, [state]),
    h('td', { text: e.updatedAt ? new Date(e.updatedAt).toLocaleString() : '—' }),
    h('td', {}, [actions]),
  ]);
}

function dialog(parent: HTMLElement, title: string, children: HTMLElement[]): { box: HTMLElement; close: () => void } {
  const overlay = h('div', { className: 'ws-overlay' });
  const box = h('div', { className: 'panel ws-dialog' }, [h('h2', { text: title }), ...children]);
  overlay.append(box);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  parent.append(overlay);
  return { box, close: () => overlay.remove() };
}

function newRegionDialog(parent: HTMLElement, host: WorkshopHost): void {
  let template = 'blank';
  let name = 'New Region';
  const options = [
    { value: 'blank', label: 'Blank' },
    ...packagedIds().map((id) => ({ value: id, label: REGIONS[id].name })),
  ];
  const { box, close } = dialog(parent, 'New Region', [
    field('Name', textInput(name, (v) => (name = v))),
    field('Start from', selectInput(template, options, (v) => (template = v))),
  ]);
  box.append(
    h('div', { className: 'ws-actions' }, [
      h('button', {
        className: 'primary',
        text: 'Create',
        onClick: () => {
          const id = freshId(name.replace(/\s+/g, '') || 'region');
          let def: RegionAuthoringDef;
          if (template === 'blank') {
            def = blankRegion(id, REGIONS.missileCoast.start);
            // The round-1 probe is always missiles; start the timeline with it
            // so a new region is playable the moment it is saved.
            def.milestones = [{ round: 1, add: [{ branch: 'missiles', nodeId: 'unguided' }] }];
          } else {
            def = packagedTemplate(template)!;
            def.id = id;
            def.campaign.unlocks = null;
          }
          def.name = name || def.name;
          close();
          openEditor(def, 'local', null);
          editor!.dirty = true;
          host.rerender();
        },
      }),
      h('button', { text: 'Cancel', onClick: close }),
    ]),
  );
}

function importDialog(parent: HTMLElement, host: WorkshopHost): void {
  let text = '';
  const status = h('div', { className: 'hint', text: 'Paste a region preset, or choose a .json file.' });
  const area = textInput('', (v) => (text = v), { multiline: true, placeholder: '{ "schemaVersion": 1, ... }' });
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'application/json,.json';
  file.className = 'ws-input';
  file.addEventListener('change', () => {
    const f = file.files?.[0];
    if (!f) return;
    f.text().then((t) => {
      text = t;
      (area as HTMLTextAreaElement).value = t;
    });
  });
  const { box, close } = dialog(parent, 'Import JSON', [
    status,
    file,
    area,
  ]);
  const actions = h('div', { className: 'ws-actions' });
  const finish = (def: RegionAuthoringDef) => {
    saveDraft(def);
    close();
    openEditor(def, 'local', new Date().toISOString());
    host.rerender();
  };
  actions.append(
    h('button', {
      className: 'primary',
      text: 'Validate & Import',
      onClick: () => {
        const outcome = parseImport(text || (area as HTMLTextAreaElement).value);
        if (!outcome.ok || !outcome.def) {
          status.textContent = `Rejected: ${outcome.error}`;
          status.className = 'hint ws-bad';
          return;
        }
        const def = outcome.def;
        const v = outcome.validation!;
        const summary = v.ok
          ? `Valid (${v.warnings.length} warnings).`
          : `${v.errors.length} errors — it will import as a non-playable draft.`;
        if (outcome.collision === 'packaged') {
          status.textContent = `"${def.id}" is a packaged region. It will import as a copy. ${summary}`;
          def.id = freshId(`${def.id}Copy`);
          def.campaign.unlocks = def.campaign.unlocks === def.id ? null : def.campaign.unlocks;
          finish(def);
          return;
        }
        if (outcome.collision === 'local') {
          status.textContent = `A draft with id "${def.id}" already exists. ${summary}`;
          actions.replaceChildren(
            h('button', { className: 'primary', text: 'Replace existing', onClick: () => finish(def) }),
            h('button', {
              text: 'Import as copy',
              onClick: () => {
                def.id = freshId(`${def.id}Copy`);
                finish(def);
              },
            }),
            h('button', { text: 'Cancel', onClick: close }),
          );
          return;
        }
        status.textContent = summary;
        finish(def);
      },
    }),
    h('button', { text: 'Cancel', onClick: close }),
  );
  box.append(actions);
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function workshopEditorScreen(host: WorkshopHost): HTMLElement {
  const st = editor!;
  const def = st.def;
  const readOnly = st.source === 'packaged';
  const validation = validateDraft(def);
  const compiled = compileRegion(def);
  const { root, body, footer } = screenShell(
    readOnly ? `${def.name} (built-in, read-only)` : def.name || 'Untitled region',
    readOnly ? 'Packaged template — clone to edit' : st.dirty ? 'Unsaved changes' : st.savedAt ? `Saved ${new Date(st.savedAt).toLocaleTimeString()}` : 'New draft',
    null,
    'workshop-editor',
  );
  root.classList.add('workshop');

  const touch = () => {
    st.dirty = true;
    host.rerender();
  };

  // --- notice -----------------------------------------------------------
  if (st.notice) {
    body.append(h('div', { className: 'hint ws-notice', text: st.notice }));
    st.notice = null;
  }

  // --- header + environment + pressure (side by side on wide screens) ---
  body.append(
    h('div', { className: 'ws-columns' }, [
      headerPanel(st, validation, readOnly, touch),
      environmentPanel(def, readOnly, touch),
      pressurePanel(def, readOnly, touch),
    ]),
  );

  // --- view toggle + timeline --------------------------------------------
  const viewBar = h('div', { className: 'ws-actions ws-viewbar' }, [
    h('button', {
      className: st.view === 'matrix' ? 'ws-tab on' : 'ws-tab',
      text: 'Timeline matrix',
      onClick: () => {
        st.view = 'matrix';
        host.rerender();
      },
    }),
    h('button', {
      className: st.view === 'rounds' ? 'ws-tab on' : 'ws-tab',
      text: 'Round list',
      onClick: () => {
        st.view = 'rounds';
        host.rerender();
      },
    }),
    h('span', { className: 'ws-legend' }, [
      legendItem('intro', 'introduced'),
      legendItem('active', 'available (cumulative)'),
      legendItem('beat', 'scripted beat'),
      legendItem('removed', 'removed after'),
      legendItem('gated', 'before catalogue default'),
      legendItem('warn', 'problem'),
    ]),
  ]);
  body.append(viewBar);
  body.append(
    st.view === 'matrix'
      ? timelineMatrix(st, compiled, validation.issues, readOnly, touch, host)
      : roundList(st, compiled, validation.issues, readOnly, touch, host),
  );

  // --- validation -----------------------------------------------------------
  body.append(validationPanel(validation.issues, st, host));

  // --- balance sweep -------------------------------------------------------
  // Sweeps the timeline as it is on screen (saved or not): the worker compiles
  // the authored preset itself, and the result is keyed by its content hash.
  body.append(sweepPanel(def, validation.ok, host.rerender));

  // --- inspector, as a floating drawer --------------------------------------
  // Pinned to the viewport rather than laid out in the flow: selecting a
  // capability, round or beat from anywhere on a long timeline should never
  // require scrolling down to find where its editor landed. The body gets a
  // right margin to match — the matrix reflows narrower rather than sliding
  // UNDER the drawer, so the drawer never sits on top of a cell a designer
  // just scrolled the wide timeline sideways to reach.
  const drawer = inspectorDrawer(st, compiled, readOnly, touch, host);
  if (drawer) {
    body.classList.add('ws-has-drawer');
    body.append(drawer);
  }

  // --- footer -------------------------------------------------------------
  footer.append(
    h('button', {
      text: 'Library',
      onClick: () => {
        if (st.dirty && !confirm('Discard unsaved changes?')) return;
        closeEditor();
        host.rerender();
      },
    }),
  );
  if (readOnly) {
    footer.append(
      h('button', {
        text: 'Clone to edit',
        onClick: () => {
          const copy = clone(def);
          copy.id = freshId(`${def.id}Copy`);
          copy.name = `${def.name} (copy)`;
          copy.campaign.unlocks = null;
          openEditor(copy, 'local', null);
          editor!.dirty = true;
          host.rerender();
        },
      }),
    );
  } else {
    footer.append(
      h('button', {
        className: 'primary',
        text: validation.ok ? 'Save' : 'Save draft (not playable)',
        onClick: () => {
          if (REGIONS[def.id]) {
            st.notice = `"${def.id}" is a packaged id — choose another.`;
            host.rerender();
            return;
          }
          saveDraft(def);
          st.dirty = false;
          st.savedAt = new Date().toISOString();
          st.notice = validation.ok ? 'Saved — playable from the library and the Playtest button.' : 'Saved as a draft. Fix the errors below to make it playable.';
          host.rerender();
        },
      }),
    );
  }
  footer.append(
    h('button', { text: 'Export JSON', onClick: () => downloadText(`region-${def.id}.json`, exportJson(def)) }),
    h('button', {
      text: 'Copy JSON',
      onClick: () => {
        navigator.clipboard?.writeText(exportJson(def)).then(
          () => {
            st.notice = 'Preset JSON copied to the clipboard — paste it into a Claude session to build on it.';
            host.rerender();
          },
          () => {
            st.notice = 'Clipboard unavailable — use Export JSON instead.';
            host.rerender();
          },
        );
      },
    }),
  );
  const playRow = h('div', { className: 'ws-playrow' }, [
    h('span', { className: 'hint', text: 'Round' }),
    numberInput(st.playRound, (v) => (st.playRound = Math.max(1, Math.floor(v ?? 1))), { min: 1, width: '58px' }),
    h('span', { className: 'hint', text: 'Seed' }),
    textInput(st.playSeed, (v) => (st.playSeed = v || `ws-${Date.now().toString(36)}`), { className: 'ws-seed' }),
    h('button', {
      className: st.playGod ? 'dev-toggle on' : 'dev-toggle',
      text: st.playGod ? 'GOD ON' : 'GOD OFF',
      onClick: () => {
        st.playGod = !st.playGod;
        host.rerender();
      },
    }),
    h('button', {
      className: 'primary',
      text: readOnly ? 'Playtest' : st.dirty ? 'Save & Playtest' : 'Playtest',
      disabled: !validation.ok,
      onClick: () => {
        if (!readOnly) {
          if (REGIONS[def.id]) {
            st.notice = `"${def.id}" is a packaged id — choose another.`;
            host.rerender();
            return;
          }
          saveDraft(def);
          st.dirty = false;
          st.savedAt = new Date().toISOString();
        }
        host.onPlaytest({
          regionId: def.id,
          source: st.source,
          round: st.playRound,
          god: st.playGod,
          seed: st.playSeed,
        });
      },
    }),
  ]);
  footer.append(playRow);
  return root;
}

/** A stable string identifying WHICH thing is selected, so a rerender caused
 *  by editing a field inside the drawer (not by picking something new) can
 *  tell "same selection, preserve scroll" from "new selection, start at the
 *  top" — the same distinction `.prep-content`'s `data-section` draws for the
 *  prep screen. */
function selectionKey(sel: Selection): string {
  switch (sel.kind) {
    case 'none': return 'none';
    case 'cell': return `cell:${sel.round}:${sel.key}`;
    case 'pressure': return `pressure:${sel.round}`;
    case 'round': return `round:${sel.round}`;
    case 'beat': return `beat:${sel.round}:${sel.beatId}`;
  }
}

/** The Inspector as a floating drawer — pinned to the viewport (right side on
 *  desktop, a bottom sheet on phone) so editing a capability, a round or a
 *  beat never requires scrolling down to it, wherever in the timeline it was
 *  opened from. Returns null when nothing is selected. */
function inspectorDrawer(
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
): HTMLElement | null {
  if (st.selection.kind === 'none') return null;
  const onClose = () => {
    st.selection = { kind: 'none' };
    host.rerender();
  };
  const content = inspectorPanel(st, compiled, readOnly, touch, host, onClose);
  content.classList.add('ws-drawer-content');
  content.setAttribute('data-selection', selectionKey(st.selection));
  return h('div', { className: 'ws-drawer' }, [content]);
}

function legendItem(cls: string, label: string): HTMLElement {
  return h('span', { className: 'ws-legend-item' }, [h('span', { className: `ws-cell-swatch ${cls}` }), h('span', { text: label })]);
}

// --- header ------------------------------------------------------------------

function headerPanel(
  st: EditorState,
  validation: ReturnType<typeof validateDraft>,
  readOnly: boolean,
  touch: () => void,
): HTMLElement {
  const def = st.def;
  const badge = validation.ok
    ? h('span', { className: 'ws-badge good', text: validation.warnings.length ? `Valid · ${validation.warnings.length} warnings` : 'Valid' })
    : h('span', { className: 'ws-badge bad', text: `${validation.errors.length} errors — not playable` });
  const unlockOptions = [
    { value: '', label: '— none —' },
    ...packagedIds().filter((id) => id !== def.id).map((id) => ({ value: id, label: REGIONS[id].name })),
  ];
  return h('div', { className: 'panel ws-panel' }, [
    h('div', { className: 'ws-panel-head' }, [h('h2', { text: 'Region' }), badge]),
    field('Name', textInput(def.name, (v) => { def.name = v; touch(); }, { readOnly })),
    field(
      'ID',
      textInput(def.id, (v) => { def.id = v.trim(); touch(); }, { readOnly, className: 'ws-mono' }),
      readOnly ? undefined : 'Stable identifier. Saving under a new ID creates a separate draft.',
    ),
    field('Tagline', textInput(def.tagline, (v) => { def.tagline = v; touch(); }, { readOnly })),
    field('Description', textInput(def.description, (v) => { def.description = v; touch(); }, { readOnly, multiline: true })),
    h('div', { className: 'ws-grid2' }, [
      field(
        'Completion round',
        numberInput(def.completionRound, (v) => {
          const n = Math.max(1, Math.floor(v ?? 1));
          if (n < def.completionRound) {
            // Shrinking drops milestones beyond the new end (validation would flag them anyway).
            def.milestones = def.milestones.filter((m) => m.round <= n);
          }
          def.completionRound = n;
          touch();
        }, { min: 1, readOnly }),
      ),
      field('Completion XP', numberInput(def.campaign.completionXp, (v) => { def.campaign.completionXp = Math.max(0, v ?? 0); touch(); }, { min: 0, readOnly })),
    ]),
    field(
      'Unlocks (campaign)',
      selectInput(def.campaign.unlocks ?? '', unlockOptions, (v) => { def.campaign.unlocks = v || null; touch(); }, readOnly),
      'Promotion into the shipped ladder is a repository action; this only records the intended link.',
    ),
    startPanel(def, readOnly, touch),
  ]);
}

function startPanel(def: RegionAuthoringDef, readOnly: boolean, touch: () => void): HTMLElement {
  const s = def.start;
  const num = (label: string, key: keyof typeof s) =>
    field(label, numberInput(s[key] as number, (v) => { (s as unknown as Record<string, number>)[key] = Math.max(0, v ?? 0); touch(); }, { min: 0, readOnly }));
  const fleet = (cls: keyof typeof s.fleet) =>
    field(`${cls}`, numberInput(s.fleet[cls], (v) => { s.fleet[cls] = Math.max(0, Math.floor(v ?? 0)); touch(); }, { min: 0, readOnly }));
  const det = h('details', { className: 'ws-details' }, [
    h('summary', { text: `Starting state — £${s.cash}, ${s.ammo} interceptors, ${s.escorts} escort${s.escorts === 1 ? '' : 's'}, ${s.bases} base${s.bases === 1 ? '' : 's'}` }),
    h('div', { className: 'ws-grid3' }, [
      num('Cash', 'cash'), num('Interceptors', 'ammo'), num('Drone ammo', 'droneAmmo'),
      num('PD ammo', 'pdAmmo'), num('Bases', 'bases'), num('Escorts', 'escorts'),
      num('Capacity', 'capacity'), num('Confidence', 'confidence'),
    ]),
    h('div', { className: 'ws-grid3' }, [fleet('cargo'), fleet('tanker'), fleet('freighter')]),
  ]);
  return det;
}

// --- environment ---------------------------------------------------------------

function environmentPanel(def: RegionAuthoringDef, readOnly: boolean, touch: () => void): HTMLElement {
  const preset = environmentPreset(def.environmentPresetId);
  const geo = preset ? geography(preset.geographyId) : null;
  const options = ENVIRONMENT_PRESETS.map((p) => ({ value: p.id, label: `${p.name}` }));
  const panel = h('div', { className: 'panel ws-panel' }, [
    h('h2', { text: 'Environment' }),
    field(
      'Preset',
      selectInput(def.environmentPresetId, options, (v) => {
        const p = environmentPreset(v);
        if (!p) return;
        def.environmentPresetId = p.id;
        def.shapeType = p.shapeType;
        touch();
      }, readOnly),
      preset?.desc,
    ),
  ]);
  if (geo) {
    panel.append(mapPreview(preset!.geographyId));
    panel.append(
      h('div', { className: 'chip-row' }, [
        h('span', { className: 'chip' }, [icon('anchor'), h('span', { text: `${geo.laneCount} lanes` })]),
        h('span', { className: 'chip' }, [icon('turret'), h('span', { text: `${geo.launchSites.length} launch sites` })]),
        h('span', { className: 'chip' }, [icon('radar'), h('span', { text: `shape: ${def.shapeType}` })]),
      ]),
    );
  }
  panel.append(
    h('div', {
      className: 'hint',
      text: 'Environments are validated presets — each one is a canonical geography the simulation navigates against, not a backdrop. A freehand coastline editor is not part of this build; see the design doc.',
    }),
  );
  return panel;
}

/** A small SVG map of a geography: land, water, lanes and launch sites. */
function mapPreview(geographyId: string): HTMLElement {
  const geo = geography(geographyId);
  const W = WORLD.width;
  const H = WORLD.height;
  const step = W / 40;
  const pts = (fn: (x: number) => number) => {
    const out: string[] = [];
    for (let x = 0; x <= W; x += step) out.push(`${x.toFixed(0)},${fn(x).toFixed(0)}`);
    return out.join(' ');
  };
  const hostile = `0,0 ${pts((x) => geo.hostileShoreY(x))} ${W},0`;
  const friendly = `0,${H} ${pts((x) => geo.friendlyShoreY(x))} ${W},${H}`;
  let lanes = '';
  for (let i = 0; i < geo.laneCount; i++) {
    lanes += `<polyline points="${pts((x) => geo.laneY(i, x))}" fill="none" stroke="#56cfe0" stroke-width="10" stroke-dasharray="60 40" opacity="0.8"/>`;
  }
  const sites = geo.launchSites
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="34" fill="#ff6f5e" stroke="#12140d" stroke-width="8"/>`)
    .join('');
  // Islands, from the same definition the sim navigates against.
  const islands = geo.islands
    .map((island) => {
      const top: string[] = [];
      const bottom: string[] = [];
      for (let x = island.fromX; x <= island.toX; x += 20) {
        const hh = islandHalfHeight(island, x);
        top.push(`${x.toFixed(0)},${(island.centerY - hh).toFixed(0)}`);
        bottom.unshift(`${x.toFixed(0)},${(island.centerY + hh).toFixed(0)}`);
      }
      return `<polygon points="${top.join(' ')} ${bottom.join(' ')}" fill="#3a3f2a" stroke="#6b7355" stroke-width="6"/>`;
    })
    .join('');
  const svg =
    `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" class="ws-map">` +
    `<rect width="${W}" height="${H}" fill="#0f2a33"/>` +
    `<polygon points="${hostile}" fill="#3a3f2a"/>` +
    `<polygon points="${friendly}" fill="#2f3a26"/>` +
    lanes +
    islands +
    sites +
    `<polyline points="${pts((x) => geo.baseY(x))}" fill="none" stroke="#52e595" stroke-width="8" stroke-dasharray="30 30" opacity="0.6"/>` +
    `</svg>`;
  return h('div', { className: 'ws-map-wrap', html: svg });
}

// --- pressure -----------------------------------------------------------------

function pressurePanel(def: RegionAuthoringDef, readOnly: boolean, touch: () => void): HTMLElement {
  const p = def.pressure;
  const panel = h('div', { className: 'panel ws-panel' }, [h('h2', { text: 'Pressure envelope' })]);
  const useDefault = p.defaultBudget === null;
  panel.append(
    toggleRow(
      'coin',
      'Global economy curve',
      useDefault ? 'Budget follows ENEMY_ECONOMY defaults.' : 'Region-specific budget curve.',
      () => p.defaultBudget === null,
      (v) => {
        if (readOnly) return;
        p.defaultBudget = v ? null : { base: 88, perRound: 98, cap: 2750 };
        touch();
      },
    ),
  );
  if (p.defaultBudget) {
    const b = p.defaultBudget;
    panel.append(
      h('div', { className: 'ws-grid3' }, [
        field('Base', numberInput(b.base, (v) => { b.base = Math.max(0, v ?? 0); touch(); }, { min: 0, readOnly })),
        field('Per round', numberInput(b.perRound, (v) => { b.perRound = Math.max(0, v ?? 0); touch(); }, { min: 0, readOnly })),
        field('Cap', numberInput(b.cap, (v) => { b.cap = Math.max(0, v ?? 0); touch(); }, { min: 0, readOnly })),
      ]),
    );
  }
  panel.append(h('div', { className: 'hint', text: 'Per-branch unit ceilings (replace the catalogue maxUnitsPerRound). Blank = catalogue value.' }));
  const grid = h('div', { className: 'ws-grid3' });
  for (const key of ENEMY_BRANCH_ORDER) {
    const branch = ENEMY_BRANCHES[key];
    grid.append(
      field(
        `${branch.name} (${branch.maxUnitsPerRound})`,
        numberInput(p.defaultBranchCeilings[key] ?? null, (v) => {
          if (v === null || v <= 0) delete p.defaultBranchCeilings[key];
          else p.defaultBranchCeilings[key] = Math.floor(v);
          touch();
        }, { min: 1, readOnly, allowEmpty: true }),
      ),
    );
  }
  panel.append(grid);
  return panel;
}

// --- timeline matrix --------------------------------------------------------------

interface RowSpec {
  kind: 'group' | 'node' | 'tactics' | 'beats' | 'pressure' | 'ceilings' | 'intel' | 'label';
  group: string;
  label: string;
  entry?: ArsenalEntry;
  branch?: EnemyBranchKey;
  key?: string;
}

function rows(collapsed: Set<string>): RowSpec[] {
  const out: RowSpec[] = [];
  out.push({ kind: 'group', group: 'pressure', label: 'Pressure' });
  if (!collapsed.has('pressure')) {
    out.push({ kind: 'pressure', group: 'pressure', label: 'Round budget' });
    out.push({ kind: 'ceilings', group: 'pressure', label: 'Branch ceilings' });
  }
  for (const key of ENEMY_BRANCH_ORDER) {
    const branch = ENEMY_BRANCHES[key];
    out.push({ kind: 'group', group: key, label: branch.name, branch: key });
    if (collapsed.has(key)) continue;
    for (const e of arsenalEntries().filter((x) => x.branch === key)) {
      out.push({ kind: 'node', group: key, label: e.node.name, entry: e, branch: key, key: `${key}:${e.node.id}` });
    }
    out.push({ kind: 'tactics', group: key, label: 'Tactic ladder', branch: key });
    out.push({ kind: 'beats', group: key, label: 'Scripted beats', branch: key });
  }
  out.push({ kind: 'group', group: 'notes', label: 'Doctrine, beats & warnings' });
  if (!collapsed.has('notes')) {
    out.push({ kind: 'intel', group: 'notes', label: 'Intel warning' });
    out.push({ kind: 'label', group: 'notes', label: 'Round label' });
  }
  return out;
}

function issuesFor(issues: ValidationIssue[], round: number, key?: string): ValidationIssue[] {
  return issues.filter((i) => i.round === round && (key === undefined ? !i.ref : i.ref && refKey(i.ref) === key));
}

function timelineMatrix(
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  issues: ValidationIssue[],
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
): HTMLElement {
  const def = st.def;
  const rounds = def.completionRound;
  const table = h('table', { className: 'ws-table ws-matrix' });
  const head = h('tr', {}, [h('th', { className: 'ws-sticky-col', text: 'Capability / rule' })]);
  for (let r = 1; r <= rounds; r++) {
    const sel = st.selection.kind !== 'none' && 'round' in st.selection && st.selection.round === r;
    const th = h('th', { className: sel ? 'ws-round selected' : 'ws-round', attrs: { 'data-round': String(r) } }, [
      h('button', {
        className: 'ws-round-btn',
        text: `R${r}`,
        onClick: () => {
          st.selection = { kind: 'round', round: r };
          host.rerender();
        },
      }),
    ]);
    if (compiled.labels[r]) th.append(h('div', { className: 'ws-round-label', text: compiled.labels[r] }));
    head.append(th);
  }
  table.append(h('thead', {}, [head]));
  const tbody = h('tbody');
  for (const row of rows(st.collapsed)) {
    tbody.append(matrixRow(row, st, compiled, issues, rounds, readOnly, touch, host));
  }
  table.append(tbody);
  return h('div', { className: 'ws-scroll ws-matrix-wrap' }, [table]);
}

function matrixRow(
  row: RowSpec,
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  issues: ValidationIssue[],
  rounds: number,
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
): HTMLElement {
  const tr = h('tr', { className: `ws-row ws-row-${row.kind}` });
  if (row.kind === 'group') {
    const open = !st.collapsed.has(row.group);
    const th = h('th', { className: 'ws-sticky-col ws-group', attrs: { colspan: String(rounds + 1) } }, [
      h('button', {
        className: 'ws-group-btn',
        onClick: () => {
          if (open) st.collapsed.add(row.group);
          else st.collapsed.delete(row.group);
          host.rerender();
        },
      }, [
        h('span', { text: open ? '▾ ' : '▸ ' }),
        ...(row.branch ? [icon(BRANCH_ICON[row.branch])] : []),
        h('span', { text: ` ${row.label}` }),
        ...(row.branch && !ENEMY_BRANCHES[row.branch].implemented ? [h('span', { className: 'ws-badge bad', text: 'not implemented' })] : []),
      ]),
    ]);
    tr.append(th);
    return tr;
  }
  const labelCell = h('th', { className: 'ws-sticky-col' }, [h('span', { text: row.label })]);
  if (row.kind === 'node' && row.entry) {
    labelCell.append(
      h('span', { className: 'hint ws-sub', text: ` default R${row.entry.earliestRound} · ${row.entry.node.cost}cr${row.entry.implemented ? '' : ' · designed only'}` }),
    );
    if (!row.entry.implemented) tr.classList.add('ws-unimplemented');
  }
  tr.append(labelCell);
  for (let r = 1; r <= rounds; r++) {
    tr.append(matrixCell(row, r, st, compiled, issues, readOnly, touch, host));
  }
  return tr;
}

function cellButton(className: string, content: (HTMLElement | string)[], onClick: () => void, title = ''): HTMLElement {
  const b = h('button', { className: `ws-cell ${className}`.trim(), onClick }, content);
  if (title) b.title = title;
  return b;
}

function matrixCell(
  row: RowSpec,
  r: number,
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  issues: ValidationIssue[],
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
): HTMLElement {
  const def = st.def;
  const td = h('td', { attrs: { 'data-round': String(r) } });
  const selected =
    (st.selection.kind === 'cell' && st.selection.round === r && st.selection.key === row.key) ||
    (st.selection.kind === 'pressure' && st.selection.round === r && (row.kind === 'pressure' || row.kind === 'ceilings')) ||
    (st.selection.kind === 'round' && st.selection.round === r && (row.kind === 'intel' || row.kind === 'label'));
  if (selected) td.classList.add('selected');
  if (row.key) td.setAttribute('data-key', row.key);
  const m = def.milestones.find((x) => x.round === r);
  switch (row.kind) {
    case 'node': {
      const entry = row.entry!;
      const key = row.key!;
      const state = cellState(compiled, key, entry, r);
      const problems = issuesFor(issues, r, key);
      const warn = problems.length ? [icon('alert', 'ws-warn')] : [];
      const beatsHere = beatsAtRound(compiled, r).filter((b) => refKey(b.ref) === key);
      const open = () => {
        st.selection = { kind: 'cell', round: r, key };
        host.rerender();
      };
      let cls = 'none';
      let content: (HTMLElement | string)[] = ['·'];
      if (state.kind === 'introduced') { cls = 'intro'; content = ['+']; }
      else if (state.kind === 'active') { cls = 'active'; content = ['']; }
      else if (state.kind === 'removed') { cls = 'removed'; content = ['■']; }
      else if (state.kind === 'gated') { cls = 'gated'; content = ['']; }
      if (beatsHere.length) { cls += ' beat'; content = [beatsHere[0].pattern[0].toUpperCase()]; }
      if (problems.some((p) => p.severity === 'error')) cls += ' error';
      else if (problems.length) cls += ' warning';
      td.append(cellButton(cls, [...content, ...warn], open, problems.map((p) => p.message).join('\n') || describeCell(state, entry, r)));
      break;
    }
    case 'tactics': {
      const branch = ENEMY_BRANCHES[row.branch!];
      const avail = availabilityAtRound(compiled, r).filter((a) => a.branch === row.branch);
      if (avail.length === 0) { td.append(h('span', { className: 'ws-dim', text: '' })); break; }
      const from = Math.min(...avail.map((a) => a.from));
      const invested = r - from;
      const rung = [...branch.tactics].reverse().find((t) => invested >= t.unlockAfterRounds) ?? branch.tactics[0];
      td.append(h('span', { className: 'ws-tactic', text: rung.name }));
      td.title = `Earned by sustained investment: ${branch.tactics.map((t) => `${t.name} after ${t.unlockAfterRounds}`).join(', ')}. Shown for the earliest possible rung.`;
      break;
    }
    case 'beats': {
      const beats = beatsAtRound(compiled, r).filter((b) => b.ref.branch === row.branch);
      const avail = availabilityAtRound(compiled, r).some((a) => a.branch === row.branch);
      if (beats.length) {
        for (const b of beats) {
          td.append(
            cellButton('beat', [`${b.pattern} ×${b.units}${b.groups ? `/${b.groups}` : ''}`], () => {
              st.selection = { kind: 'beat', round: r, beatId: b.id };
              host.rerender();
            }, `${b.pattern}: ${b.units} × ${b.entry.node.name} (${b.budget})`),
          );
        }
      } else if (avail && !readOnly) {
        td.append(cellButton('add-beat', ['+ beat'], () => {
          const first = availabilityAtRound(compiled, r).find((a) => a.branch === row.branch)!;
          const ms = milestoneAt(def, r, true);
          const beat: EncounterBeatDef = {
            id: `beat-${row.branch}-r${r}-${Date.now().toString(36)}`,
            pattern: 'salvo',
            ref: { branch: row.branch!, nodeId: first.node.id },
            units: Math.max(1, Math.min(first.node.firstAppearanceCap, 4)),
            groups: 1,
            budget: 'charged',
          };
          (ms.beats ??= []).push(beat);
          st.selection = { kind: 'beat', round: r, beatId: beat.id };
          touch();
        }));
      }
      break;
    }
    case 'pressure': {
      const p = pressureAtRound(compiled, r);
      const problems = issuesFor(issues, r).filter((i) => ['pressure', 'unaffordable', 'stranded', 'pressureJump', 'beatDominates'].includes(i.code));
      const cls = `pressure ${p.override !== null ? 'override' : p.multiplier !== null ? 'mult' : ''} ${problems.length ? 'warning' : ''}`;
      td.append(cellButton(cls, [String(p.budget), ...(problems.length ? [icon('alert', 'ws-warn')] : [])], () => {
        st.selection = { kind: 'pressure', round: r };
        host.rerender();
      }, problems.map((x) => x.message).join('\n') || (p.override !== null ? 'Authored override' : p.multiplier !== null ? `×${p.multiplier}` : 'Budget curve')));
      break;
    }
    case 'ceilings': {
      const p = pressureAtRound(compiled, r);
      const text = Object.entries(p.branchCeilings).map(([k, v]) => `${ENEMY_BRANCHES[k as EnemyBranchKey].name.slice(0, 3)} ${v}`).join(' ');
      const changed = !!m?.pressure?.branchCeilings && Object.keys(m.pressure.branchCeilings).length > 0;
      td.append(cellButton(changed ? 'pressure override' : 'pressure', [text || '—'], () => {
        st.selection = { kind: 'pressure', round: r };
        host.rerender();
      }, 'Per-branch unit ceilings in force this round'));
      break;
    }
    case 'intel': {
      const text = compiled.intelWarnings[r];
      const noWarn = issuesFor(issues, r).find((i) => i.code === 'noWarning') ?? issues.find((i) => i.code === 'noWarning' && i.round === r);
      td.append(cellButton(text ? 'intel' : noWarn ? 'warning' : 'none', [text ? text.slice(0, 18) + (text.length > 18 ? '…' : '') : noWarn ? [icon('alert', 'ws-warn')][0] : '·'], () => {
        st.selection = { kind: 'round', round: r };
        host.rerender();
      }, text ?? noWarn?.message ?? 'No authored warning (the sim still forecasts catalogue gates)'));
      break;
    }
    case 'label': {
      const text = compiled.labels[r];
      td.append(cellButton(text ? 'intel' : 'none', [text ?? '·'], () => {
        st.selection = { kind: 'round', round: r };
        host.rerender();
      }));
      break;
    }
    default:
      break;
  }
  return td;
}

function describeCell(state: ReturnType<typeof cellState>, entry: ArsenalEntry, r: number): string {
  switch (state.kind) {
    case 'introduced': return `${entry.node.name} introduced on round ${r}${state.until ? ` (until R${state.until})` : ''}`;
    case 'active': return `${entry.node.name} available since round ${state.from}`;
    case 'removed': return `${entry.node.name} removed after round ${r}`;
    case 'gated': return `${entry.node.name}'s catalogue default is round ${state.earliest} — click to introduce it earlier`;
    default: return `Add ${entry.node.name} from round ${r}`;
  }
}

// --- round list (phone) ----------------------------------------------------------

function roundList(
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  issues: ValidationIssue[],
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
): HTMLElement {
  void readOnly;
  void touch;
  const def = st.def;
  const list = h('div', { className: 'ws-roundlist' });
  for (let r = 1; r <= def.completionRound; r++) {
    const avail = availabilityAtRound(compiled, r);
    const p = pressureAtRound(compiled, r);
    const beats = beatsAtRound(compiled, r);
    const problems = issues.filter((i) => i.round === r);
    const card = h('div', { className: `card ws-round-card ${problems.some((x) => x.severity === 'error') ? 'loss' : problems.length ? 'warning' : ''}`, attrs: { 'data-round': String(r) } }, [
      h('div', { className: 'card-head' }, [
        icon('anchor'),
        h('h3', { text: `Round ${r}${compiled.labels[r] ? ` — ${compiled.labels[r]}` : ''}` }),
        h('span', { className: 'ws-badge', text: `budget ${p.budget}` }),
      ]),
    ]);
    const chips = h('div', { className: 'chip-row' });
    for (const a of avail) {
      const key = `${a.branch}:${a.node.id}`;
      const c = h('button', {
        className: `chip ws-chip ${a.introducedThisRound ? 'intro' : 'active'}`,
        onClick: () => {
          st.selection = { kind: 'cell', round: r, key };
          host.rerender();
        },
      }, [icon(BRANCH_ICON[a.branch]), h('span', { text: `${a.introducedThisRound ? '+ ' : ''}${a.node.name}${a.until === r ? ' (last)' : ''}` })]);
      chips.append(c);
    }
    for (const b of beats) {
      chips.append(h('button', {
        className: 'chip ws-chip beat',
        onClick: () => {
          st.selection = { kind: 'beat', round: r, beatId: b.id };
          host.rerender();
        },
      }, [icon('burst'), h('span', { text: `${b.pattern} ×${b.units} ${b.entry.node.name}` })]));
    }
    if (avail.length === 0) chips.append(h('span', { className: 'hint', text: 'No threat available.' }));
    card.append(chips);
    if (compiled.intelWarnings[r]) card.append(h('p', { text: `Intel: ${compiled.intelWarnings[r]}` }));
    for (const i of problems) card.append(h('p', { className: i.severity === 'error' ? 'ws-bad' : 'ws-warn-text', text: i.message }));
    card.append(
      h('div', { className: 'ws-actions' }, [
        h('button', { text: 'Add capability', onClick: () => { st.selection = { kind: 'round', round: r }; host.rerender(); } }),
        h('button', { text: 'Pressure', onClick: () => { st.selection = { kind: 'pressure', round: r }; host.rerender(); } }),
      ]),
    );
    list.append(card);
  }
  return list;
}

// --- inspector ------------------------------------------------------------------------

function inspectorPanel(
  st: EditorState,
  compiled: ReturnType<typeof compileRegion>,
  readOnly: boolean,
  touch: () => void,
  host: WorkshopHost,
  onClose?: () => void,
): HTMLElement {
  const def = st.def;
  const head = h('div', { className: 'ws-panel-head' }, [h('h2', { text: 'Inspector' })]);
  if (onClose) {
    head.append(h('button', { className: 'ws-drawer-close', text: '\u00d7', onClick: onClose, attrs: { 'aria-label': 'Close inspector' } }));
  }
  const panel = h('div', { className: 'panel ws-panel ws-inspector' }, [head]);
  const sel = st.selection;
  if (sel.kind === 'none') {
    panel.append(h('div', { className: 'hint', text: 'Tap a cell to inspect or edit it. Empty cells open “Add capability” scoped to that round; round headers open round actions.' }));
    return panel;
  }
  const r = sel.round;

  if (sel.kind === 'round') {
    const m = def.milestones.find((x) => x.round === r);
    panel.append(h('h3', { text: `Round ${r}` }));
    panel.append(
      field('Label', textInput(m?.label ?? '', (v) => { const ms = milestoneAt(def, r, true); if (v) ms.label = v; else delete ms.label; pruneMilestone(def, r); touch(); }, { readOnly })),
      field('Intel warning (shown the round before)', textInput(m?.intelWarning ?? '', (v) => { const ms = milestoneAt(def, r, true); if (v) ms.intelWarning = v; else delete ms.intelWarning; pruneMilestone(def, r); touch(); }, { readOnly, multiline: true })),
    );
    // Add capability scoped to this round.
    panel.append(h('h3', { text: 'Add capability from this round' }));
    panel.append(arsenalBrowser(st, compiled, r, readOnly, touch));
    if (!readOnly) {
      panel.append(
        h('h3', { text: 'Round actions' }),
        h('div', { className: 'ws-actions' }, [
          h('button', { text: 'Insert before', onClick: () => { insertRound(def, r); touch(); } }),
          h('button', { text: 'Insert after', onClick: () => { insertRound(def, r + 1); touch(); } }),
          h('button', { text: 'Duplicate to next', disabled: r >= def.completionRound, onClick: () => { duplicateRound(def, r, r + 1); touch(); } }),
          h('button', { text: 'Clear authored changes', onClick: () => { clearRound(def, r); touch(); } }),
          h('button', { className: 'danger', text: 'Delete round', disabled: def.completionRound <= 1, onClick: () => { deleteRound(def, r); st.selection = { kind: 'none' }; touch(); } }),
          h('button', { text: `Playtest from R${r}`, onClick: () => { st.playRound = r; host.rerender(); } }),
        ]),
      );
    }
    return panel;
  }

  if (sel.kind === 'pressure') {
    const p = pressureAtRound(compiled, r);
    const m = def.milestones.find((x) => x.round === r);
    panel.append(h('h3', { text: `Round ${r} pressure — resolved budget ${p.budget}` }));
    const setPressure = (fn: (pr: NonNullable<typeof m>['pressure'] & object) => void) => {
      const ms = milestoneAt(def, r, true);
      ms.pressure ??= {};
      fn(ms.pressure);
      if (Object.keys(ms.pressure).length === 0) delete ms.pressure;
      pruneMilestone(def, r);
      touch();
    };
    panel.append(
      h('div', { className: 'ws-grid2' }, [
        field('Budget override', numberInput(m?.pressure?.budgetOverride ?? null, (v) => setPressure((pr) => { if (v === null) delete pr.budgetOverride; else pr.budgetOverride = Math.max(0, v); }), { min: 0, readOnly, allowEmpty: true }), 'Exact purse for this round (bypasses the cap and anti-snowball modifiers).'),
        field('Budget multiplier', numberInput(m?.pressure?.budgetMultiplier ?? null, (v) => setPressure((pr) => { if (v === null) delete pr.budgetMultiplier; else pr.budgetMultiplier = Math.max(0, v); }), { min: 0, step: 0.05, readOnly, allowEmpty: true }), 'Scales the curve figure. Ignored when an override is set.'),
      ]),
    );
    panel.append(h('div', { className: 'hint', text: 'Branch ceilings from this round onward (cumulative). Blank = inherit.' }));
    const grid = h('div', { className: 'ws-grid3' });
    for (const key of ENEMY_BRANCH_ORDER) {
      grid.append(
        field(`${ENEMY_BRANCHES[key].name} (now ${p.branchCeilings[key] ?? ENEMY_BRANCHES[key].maxUnitsPerRound})`, numberInput(m?.pressure?.branchCeilings?.[key] ?? null, (v) => setPressure((pr) => {
          pr.branchCeilings ??= {};
          if (v === null || v <= 0) delete pr.branchCeilings[key]; else pr.branchCeilings[key] = Math.floor(v);
          if (Object.keys(pr.branchCeilings).length === 0) delete pr.branchCeilings;
        }), { min: 1, readOnly, allowEmpty: true })),
      );
    }
    panel.append(grid);
    return panel;
  }

  if (sel.kind === 'beat') {
    const m = def.milestones.find((x) => x.round === r);
    const beat = m?.beats?.find((b) => b.id === sel.beatId);
    if (!beat) { panel.append(h('div', { className: 'hint', text: 'Beat no longer exists.' })); return panel; }
    const avail = availabilityAtRound(compiled, r).filter((a) => a.branch === beat.ref.branch);
    const entry = avail.find((a) => a.node.id === beat.ref.nodeId);
    panel.append(h('h3', { text: `Scripted beat — round ${r}` }));
    panel.append(h('div', { className: 'hint', text: 'SCRIPTED: stronger control than availability. The units below are guaranteed on the water this round; the adaptive enemy spends what is left of the envelope.' }));
    panel.append(
      h('div', { className: 'ws-grid2' }, [
        field('Pattern', selectInput(beat.pattern, (['salvo', 'cluster', 'wave', 'sustained'] as BeatPattern[]).map((v) => ({ value: v, label: v })), (v) => { beat.pattern = v as BeatPattern; touch(); }, readOnly), 'salvo/cluster/wave: the branch’s whole buy launches in N groups; sustained: one unit at a time across the window.'),
        field('Capability', selectInput(beat.ref.nodeId, avail.map((a) => ({ value: a.node.id, label: `${a.node.name} (${a.node.cost}cr)` })), (v) => { beat.ref.nodeId = v; touch(); }, readOnly), 'Only capabilities available on this round are offered.'),
        field('Units', numberInput(beat.units, (v) => { beat.units = Math.max(1, Math.floor(v ?? 1)); touch(); }, { min: 1, readOnly })),
        field('Groups', numberInput(beat.groups ?? null, (v) => { if (v === null) delete beat.groups; else beat.groups = Math.max(1, Math.floor(v)); touch(); }, { min: 1, readOnly, allowEmpty: true })),
        field('Budget', selectInput(beat.budget, [
          { value: 'charged', label: 'Charged to round budget' },
          { value: 'reserved', label: 'Reserved debut (budget lifted by cost)' },
          { value: 'outOfBudget', label: 'Out-of-budget test beat' },
        ], (v) => { beat.budget = v as BeatBudget; touch(); }, readOnly)),
        field('Label', textInput(beat.label ?? '', (v) => { if (v) beat.label = v; else delete beat.label; touch(); }, { readOnly })),
      ]),
    );
    if (entry) {
      const cost = beat.units * entry.node.cost;
      const budget = pressureAtRound(compiled, r).budget;
      panel.append(h('div', { className: 'hint', text: `Cost ${cost}cr = ${budget > 0 ? Math.round((100 * cost) / budget) : 0}% of the ${budget}cr round budget${beat.budget === 'outOfBudget' ? ' (not charged)' : beat.budget === 'reserved' ? ' (budget lifted by this amount)' : ''}. Targeting follows the doctrine ladder — ${TARGETING_DOCTRINE[0].name} upward; beats do not pick targets.` }));
    }
    if (!readOnly) {
      panel.append(h('div', { className: 'ws-actions' }, [
        h('button', { className: 'danger', text: 'Remove beat', onClick: () => { const ms = milestoneAt(def, r, true); ms.beats = ms.beats?.filter((b) => b.id !== beat.id); if (ms.beats?.length === 0) delete ms.beats; pruneMilestone(def, r); st.selection = { kind: 'none' }; touch(); } }),
      ]));
    }
    return panel;
  }

  // --- capability cell ---------------------------------------------------
  const key = sel.key;
  const entry = arsenalEntries().find((e) => `${e.branch}:${e.node.id}` === key);
  if (!entry) return panel;
  const state = cellState(compiled, key, entry, r);
  const ref: EnemyLoadoutRef = { branch: entry.branch, nodeId: entry.node.id };
  const branch = ENEMY_BRANCHES[entry.branch];
  panel.append(
    h('h3', { text: `${branch.name} › ${entry.node.name} — round ${r}` }),
    h('div', { className: 'chip-row' }, [
      h('span', { className: 'chip' }, [icon('coin'), h('span', { text: `${entry.node.cost}cr` })]),
      h('span', { className: 'chip' }, [icon('lock'), h('span', { text: `default R${entry.earliestRound}` })]),
      h('span', { className: 'chip' }, [icon('eye'), h('span', { text: `debut cap ${entry.node.firstAppearanceCap}` })]),
      ...(entry.node.grantsTargeting !== undefined ? [h('span', { className: 'chip' }, [icon('accuracy'), h('span', { text: `grants doctrine T${entry.node.grantsTargeting}: ${TARGETING_DOCTRINE[entry.node.grantsTargeting].name}` })])] : []),
      h('span', { className: `ws-badge ${entry.implemented ? 'good' : 'bad'}`, text: entry.implemented ? 'implemented' : 'designed only' }),
    ]),
    h('p', { className: 'hint', text: describeCell(state, entry, r) }),
    h('p', { className: 'hint', text: `Loadout: ${entry.node.name} is one complete loadout (payload and mount are one catalogue node). Tactic ladder: ${branch.tactics.map((t) => `${t.name} (+${t.unlockAfterRounds}r, ×${t.volumeMult})`).join(' → ')} — earned by sustained investment, not authored.` }),
  );
  if (entry.node.warning) panel.append(h('p', { className: 'hint', text: `Catalogue intel: “${entry.node.warning}”` }));
  if (readOnly) return panel;
  if (!entry.implemented) {
    panel.append(h('div', { className: 'ws-bad', text: 'Designed but not implemented — cannot be added to a playable region.' }));
    return panel;
  }
  const actions = h('div', { className: 'ws-actions' });
  const removeAdd = (round: number) => {
    const ms = milestoneAt(def, round, false);
    if (!ms) return;
    ms.add = ms.add.filter((x) => refKey(x) !== key);
    pruneMilestone(def, round);
  };
  const removeRemove = (round: number) => {
    const ms = milestoneAt(def, round, false);
    if (!ms) return;
    ms.remove = ms.remove?.filter((x) => refKey(x) !== key);
    if (ms.remove?.length === 0) delete ms.remove;
    pruneMilestone(def, round);
  };
  if (state.kind === 'none' || state.kind === 'gated') {
    actions.append(h('button', { className: 'primary', text: `Add from round ${r}`, onClick: () => { milestoneAt(def, r, true).add.push(ref); touch(); } }));
    if (state.kind === 'gated') {
      actions.append(h('span', { className: 'hint', text: `Catalogue default is R${state.earliest} — this is an early introduction. Run the balance sweep to see what it costs.` }));
    }
  }
  if (state.kind === 'introduced') {
    actions.append(h('button', { text: 'Undo introduction', onClick: () => { removeAdd(state.from); touch(); } }));
    if (state.until === null && r < def.completionRound) actions.append(h('button', { text: `Remove after round ${r}`, onClick: () => { (milestoneAt(def, r, true).remove ??= []).push(ref); touch(); } }));
  }
  if (state.kind === 'active') {
    actions.append(h('button', { text: `Remove after round ${r}`, onClick: () => { (milestoneAt(def, r, true).remove ??= []).push(ref); touch(); } }));
    actions.append(h('button', { text: `Move introduction here (R${r})`, onClick: () => { removeAdd(state.from); milestoneAt(def, r, true).add.push(ref); touch(); } }));
  }
  if (state.kind === 'removed') {
    actions.append(h('button', { text: 'Undo removal', onClick: () => { removeRemove(r); touch(); } }));
  }
  if (state.kind === 'introduced' || state.kind === 'active') {
    actions.append(h('button', { text: 'Add scripted beat here', onClick: () => {
      const ms = milestoneAt(def, r, true);
      const beat: EncounterBeatDef = { id: `beat-${entry.branch}-r${r}-${Date.now().toString(36)}`, pattern: 'salvo', ref: { ...ref }, units: Math.max(1, Math.min(entry.node.firstAppearanceCap, 4)), groups: 1, budget: 'charged' };
      (ms.beats ??= []).push(beat);
      st.selection = { kind: 'beat', round: r, beatId: beat.id };
      touch();
    } }));
  }
  panel.append(actions);
  return panel;
}

/** The arsenal browser: every catalogue entry, grouped by branch, with gate,
 *  implementation state, cost and whether it is already used. */
function arsenalBrowser(st: EditorState, compiled: ReturnType<typeof compileRegion>, r: number, readOnly: boolean, touch: () => void): HTMLElement {
  const def = st.def;
  const wrap = h('div', { className: 'ws-arsenal' });
  let filter = '';
  const list = h('div', { className: 'ws-arsenal-list' });
  const render = () => {
    list.replaceChildren();
    for (const key of ENEMY_BRANCH_ORDER) {
      const entries = arsenalEntries().filter((e) => e.branch === key && (!filter || `${e.branchName} ${e.node.name} ${e.node.id}`.toLowerCase().includes(filter)));
      if (entries.length === 0) continue;
      list.append(h('div', { className: 'ws-arsenal-group' }, [icon(BRANCH_ICON[key]), h('span', { text: ` ${ENEMY_BRANCHES[key].name}` })]));
      for (const e of entries) {
        const k = `${e.branch}:${e.node.id}`;
        const state = cellState(compiled, k, e, r);
        const used = state.kind === 'introduced' || state.kind === 'active';
        const row = h('div', { className: `ws-arsenal-row ${e.implemented ? '' : 'ws-unimplemented'}` }, [
          h('span', { className: 'ws-arsenal-name', text: e.node.name }),
          h('span', { className: 'hint', text: `default R${e.earliestRound} · ${e.node.cost}cr${e.implemented ? '' : ' · designed only'}${used ? ' · in use' : ''}` }),
          h('button', {
            text: used ? 'In use' : 'Add',
            disabled: readOnly || used || !e.implemented,
            onClick: () => { milestoneAt(def, r, true).add.push({ branch: e.branch, nodeId: e.node.id }); st.selection = { kind: 'cell', round: r, key: k }; touch(); },
          }),
        ]);
        list.append(row);
      }
    }
  };
  const search = textInput('', () => undefined, { placeholder: 'Search the arsenal…' }) as HTMLInputElement;
  search.addEventListener('input', () => { filter = search.value.toLowerCase(); render(); });
  wrap.append(search, list);
  render();
  return wrap;
}

// --- validation ---------------------------------------------------------------------

function validationPanel(issues: ValidationIssue[], st: EditorState, host: WorkshopHost): HTMLElement {
  void st.def;
  const panel = h('div', { className: 'panel ws-panel' }, [h('h2', { text: `Validation — ${issues.filter((i) => i.severity === 'error').length} errors, ${issues.filter((i) => i.severity === 'warning').length} warnings` })]);
  if (issues.length === 0) {
    panel.append(h('div', { className: 'hint', text: 'No problems. Errors block playtest; warnings do not.' }));
    return panel;
  }
  const list = h('div', { className: 'ws-issues' });
  for (const i of issues) {
    list.append(h('button', {
      className: `ws-issue ${i.severity}`,
      onClick: () => {
        if (i.round !== undefined && i.ref) st.selection = { kind: 'cell', round: i.round, key: refKey(i.ref) };
        else if (i.round !== undefined && ['pressure', 'unaffordable', 'stranded', 'pressureJump', 'beatDominates', 'ceiling'].includes(i.code)) st.selection = { kind: 'pressure', round: i.round };
        else if (i.round !== undefined) st.selection = { kind: 'round', round: i.round };
        host.rerender();
        requestAnimationFrame(() => {
          const sel = document.querySelector('.ws-matrix td.selected, .ws-round-card[data-round]');
          sel?.scrollIntoView({ block: 'nearest', inline: 'center' });
        });
      },
    }, [icon(i.severity === 'error' ? 'alert' : 'eye'), h('span', { text: ` ${i.message}` })]));
  }
  panel.append(list);
  return panel;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/** Render whichever workshop screen is current. */
export function workshopScreen(host: WorkshopHost): HTMLElement {
  return editor ? workshopEditorScreen(host) : workshopLibraryScreen(host);
}

/** Open a saved draft or packaged template directly (deep link from the host). */
export function openWorkshopRegion(id: string): boolean {
  const draft = loadDraft(id);
  if (draft) {
    openEditor(draft.def, 'local', draft.updatedAt);
    return true;
  }
  const packaged = packagedTemplate(id);
  if (packaged) {
    openEditor(packaged, 'packaged', null);
    return true;
  }
  return false;
}

export { hasDraft };
