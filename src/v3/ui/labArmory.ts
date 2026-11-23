// The Test Lab's Armory editor and a map's notes (DOM only; app.ts shows
// them). The player, 2026-11-23: "in the test lab give me the ability to
// modify my armory and just the strength of the armory based on where the
// map is in the chapters ... In the notes for the test lab, have the latest
// change in there too, why the map was changed or the thing you are
// testing, basically the iteration history."
//
// The Armory is kept on this device per chapter (data/labArmory.ts has the
// ranges and Auto); the campaign's Armory is never touched. The notes come
// from data/mapHistory.ts.

import { ARMORY, BAYS, bayItems } from '../data/armory';
import { chapterRange, autoLevel, labArmoryIsAuto, labBays, parseLabArmory, rangeText, resetLabChapter, setLabEquip, setLabLevel, type LabArmorySettings } from '../data/labArmory';
import { MAP_HISTORY } from '../data/mapHistory';
import { CHAPTERS, MAPS, chapterOf, type MapId } from '../data/maps';
import { kv } from '../platform/store';

const ARMORY_KEY = 'straitwatch.v3.lab.armory';

export function loadLabArmory(): LabArmorySettings {
  try {
    return parseLabArmory(JSON.parse(kv.getItem(ARMORY_KEY) ?? 'null'));
  } catch {
    return parseLabArmory(null);
  }
}

export function saveLabArmory(s: LabArmorySettings): void {
  try {
    kv.setItem(ARMORY_KEY, JSON.stringify(s));
  } catch {
    // not remembered: this session still plays it
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

function button(text: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** The Armory editor: a tab a chapter, each bay's upgrade (one a bay, as
 *  in a campaign run) and its level inside the chapter's range, or Auto.
 *  Every change is saved at once. */
export function labArmoryEditor(chapter: number, onChange?: (chapter: number) => void): HTMLElement {
  const box = el('div', 'v3-lab-armory');
  let ch = Math.max(1, Math.min(CHAPTERS.length, Math.floor(chapter) || 1));
  const render = () => {
    const s = loadLabArmory();
    const commit = () => {
      saveLabArmory(s);
      render();
      onChange?.(ch);
    };
    box.dataset.chapter = String(ch);
    const tabs = el('div', 'v3-lab-arm-tabs');
    tabs.setAttribute('role', 'tablist');
    for (const c of CHAPTERS) {
      const t = button('', `v3-lab-arm-tab${c.n === ch ? ' on' : ''}`, () => {
        ch = c.n;
        render();
        onChange?.(ch);
      });
      t.dataset.labArmoryChapter = String(c.n);
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(c.n === ch));
      t.append(el('b', '', String(c.n)), el('span', 'v3-lab-arm-tab-name', c.name), el('small', '', rangeText(c.n)));
      tabs.append(t);
    }
    const bays = el('div', 'v3-lab-bays');
    for (const b of labBays(s, ch)) {
      const def = ARMORY[b.id];
      const { lo, hi } = chapterRange(ch, b.id);
      const sec = el('section', 'v3-lab-bay');
      sec.dataset.bay = b.bay;
      sec.style.setProperty('--card-color', BAYS[b.bay].color);
      const head = el('div', 'v3-lab-bay-head');
      const eff = el('span', 'v3-lab-bay-eff', def.show(b.level));
      eff.dataset.labEffect = b.bay;
      head.append(el('b', '', BAYS[b.bay].name), eff);
      const picks = el('div', 'v3-lab-bay-picks');
      for (const id of bayItems(b.bay)) {
        const on = id === b.id;
        const p = button(ARMORY[id].name, `v3-lab-pick${on ? ' on' : ''}`, () => {
          if (on) return;
          setLabEquip(s, ch, id);
          commit();
        });
        p.dataset.labEquip = id;
        p.setAttribute('aria-pressed', String(on));
        p.title = ARMORY[id].blurb;
        picks.append(p);
      }
      const lv = el('div', 'v3-lab-len v3-lab-bay-levels');
      lv.setAttribute('role', 'group');
      lv.setAttribute('aria-label', `${def.name} level`);
      const auto = button('', `v3-lab-seg small${b.auto ? ' on' : ''}`, () => {
        setLabLevel(s, ch, b.id, null);
        commit();
      });
      auto.dataset.labLevel = 'auto';
      auto.setAttribute('aria-pressed', String(b.auto));
      auto.append(el('b', '', 'Auto'), el('small', '', `LV ${autoLevel(ch, b.id)}`));
      lv.append(auto);
      for (let k = lo; k <= hi; k++) {
        const on = !b.auto && b.level === k;
        const n = button('', `v3-lab-seg small${on ? ' on' : ''}`, () => {
          setLabLevel(s, ch, b.id, k);
          commit();
        });
        n.dataset.labLevel = String(k);
        n.setAttribute('aria-pressed', String(on));
        n.append(el('b', '', k >= def.max ? 'MAX' : `LV ${k}`));
        lv.append(n);
      }
      sec.append(head, picks, lv);
      bays.append(sec);
    }
    const reset = button('Reset chapter to Auto', 'v2-btn v3-lab-arm-reset', () => {
      resetLabChapter(s, ch);
      commit();
    });
    reset.dataset.labArmoryReset = '1';
    reset.disabled = labArmoryIsAuto(s, ch);
    const foot = el('div', 'v3-lab-arm-foot');
    foot.append(
      el('p', 'v3-hint', `Test Lab only: your campaign Armory, cards and Scrap are untouched. Chapter ${ch} maps play one upgrade a bay at ${rangeText(ch)}; Auto plays LV ${autoLevel(ch, 'reload')}. Every Test Lab draft deals every weapon.`),
      reset,
    );
    box.replaceChildren(tabs, bays, foot);
  };
  render();
  return box;
}

export interface MapNotesHandlers {
  play: () => void;
  armory: () => void;
}

/** A map's card in the Test Lab (data/mapHistory.ts): the latest change and
 *  why, what to look for, the Armory it will play with, and every
 *  iteration, newest first, with its log version. */
export function mapNotesSheet(map: MapId, h: MapNotesHandlers): HTMLElement {
  const ch = chapterOf(map);
  const s = loadLabArmory();
  const notes = MAP_HISTORY[map];
  const box = el('div', 'v3-map-notes');
  box.dataset.mapNotesSheet = map;
  // The Armory this map will play.
  const arm = el('section', 'v3-notes-arm v3-cic-panel');
  arm.dataset.notesArmory = '1';
  const armHead = el('header', 'v3-cic-head');
  const edit = button('Edit', 'v3-text-btn v3-notes-edit', h.armory);
  edit.dataset.notesArmoryEdit = '1';
  armHead.append(el('i', 'v3-led ok'), el('b', '', 'Armory for this run'), el('span', 'v3-cic-meta', `Ch ${ch} · ${rangeText(ch)}${labArmoryIsAuto(s, ch) ? ' · auto' : ''}`), edit);
  const chips = el('div', 'v3-notes-arm-chips');
  for (const b of labBays(s, ch)) {
    const c = el('span', 'v3-notes-arm-chip');
    c.style.setProperty('--card-color', BAYS[b.bay].color);
    c.dataset.armory = b.id;
    c.dataset.level = String(b.level);
    c.append(el('small', '', BAYS[b.bay].name), el('b', '', `${ARMORY[b.id].name} ${b.level}`), el('span', '', ARMORY[b.id].show(b.level)));
    chips.append(c);
  }
  arm.append(armHead, chips);
  const latest = notes.history[0];
  const now = el('section', 'v3-notes-now v3-cic-panel');
  now.dataset.notesLatest = String(latest.log);
  const nowHead = el('header', 'v3-cic-head');
  nowHead.append(el('i', 'v3-led live'), el('b', '', 'Latest change'), el('span', 'v3-cic-meta', `v${latest.log} · ${latest.date}`));
  const why = el('p', 'v3-notes-why');
  why.append(el('b', '', 'Why: '), document.createTextNode(latest.why));
  const look = el('p', 'v3-notes-look');
  look.dataset.notesLook = '1';
  look.append(el('b', '', 'Look for: '), document.createTextNode(notes.look));
  const what = el('p', 'v3-notes-what');
  what.append(el('b', '', `${latest.title}. `), document.createTextNode(latest.what));
  now.append(nowHead, what, why, look);
  const hist = el('section', 'v3-notes-hist v3-cic-panel');
  const histHead = el('header', 'v3-cic-head');
  histHead.append(el('i', 'v3-led'), el('b', '', 'History'), el('span', 'v3-cic-meta', `${notes.history.length} · newest first`));
  const list = el('ol', 'v3-notes-list');
  for (const it of notes.history) {
    const li = el('li', '');
    li.dataset.log = String(it.log);
    const meta = el('span', 'v3-notes-meta');
    meta.append(el('b', '', `v${it.log}`), el('small', '', it.date.slice(5)));
    const text = el('span', 'v3-notes-text');
    text.append(el('b', '', it.title), el('small', '', it.why));
    li.append(meta, text);
    list.append(li);
  }
  hist.append(histHead, list);
  const go = button('', 'v2-btn primary v3-sail v3-notes-play', h.play);
  go.dataset.notesPlay = map;
  go.append(el('span', '', `Play ${MAPS[map].name}`));
  const left = el('div', 'v3-notes-col');
  left.append(now, arm, go);
  const right = el('div', 'v3-notes-col');
  right.append(hist);
  box.append(left, right);
  return box;
}
