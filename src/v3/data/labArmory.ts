// THE TEST LAB'S ARMORY (the player, 2026-11-23: "in the test lab give me
// the ability to modify my armory and just the strength of the armory based
// on where the map is in the chapters for the entire campaign. So like
// levels 1 to 3 for chapter one, 2 to 4 for chapter two and so on").
//
// A Test Lab map run takes one upgrade from each bay, as a campaign run
// does, but its levels come from the chapter of the map being tested, not
// from the player's own Armory (which stays untouched):
//   chapter 1: levels 1-3; chapter 2: 2-4; chapter 3: 3-5;
//   chapter 4: 4 to the upgrade's max (5 today).
// "Auto" picks a level inside the range (chapter + 1: 2, 3, 4, 5), so the
// player can just hit play. The choices are kept per chapter (ui/lab.ts
// stores them); the run's log records the levels used in its `armory`.

import { ARMORY, BAY_ORDER, bayItems, type ArmoryId, type ArmoryLevels, type BayId } from './armory';

/** The level range an upgrade can take on a map of this chapter. */
export function chapterRange(chapter: number, id: ArmoryId): { lo: number; hi: number } {
  const max = ARMORY[id].max;
  const ch = Math.max(1, Math.min(4, Math.floor(chapter) || 1));
  const lo = Math.min(ch, max);
  // Chapter 4 runs to the upgrade's own top, whatever it is.
  const hi = ch >= 4 ? Math.max(lo, max) : Math.min(ch + 2, max);
  return { lo, hi };
}

/** "Auto": one above the bottom of the range (chapter + 1), inside it. */
export function autoLevel(chapter: number, id: ArmoryId): number {
  const { lo, hi } = chapterRange(chapter, id);
  return Math.min(hi, lo + 1);
}

/** The upgrade a bay takes when the player has not picked one: the player's
 *  usual Armory on the hub's bot reports (Quick Reload, Damage Control,
 *  Stockpile). */
export const LAB_DEFAULT_EQUIP: Record<BayId, ArmoryId> = { gun: 'reload', hull: 'repair', supply: 'stockpile' };

/** One chapter's Test Lab Armory as the player set it: the upgrade each bay
 *  takes, and a level for any upgrade the player set by hand (absent: Auto). */
export interface LabArmoryChapter {
  equip: Partial<Record<BayId, ArmoryId>>;
  levels: Partial<Record<ArmoryId, number>>;
}

/** Every chapter's settings (1-4). */
export type LabArmorySettings = Record<number, LabArmoryChapter>;

const isArmoryId = (v: unknown): v is ArmoryId => typeof v === 'string' && v in ARMORY;

/** Stored settings (parsed JSON, any shape), made safe: unknown ids, bays
 *  holding another bay's upgrade and non-numbers dropped. */
export function parseLabArmory(raw: unknown): LabArmorySettings {
  const out: LabArmorySettings = {};
  for (let ch = 1; ch <= 4; ch++) {
    const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[ch] : undefined;
    const equip: LabArmoryChapter['equip'] = {};
    const levels: LabArmoryChapter['levels'] = {};
    if (c && typeof c === 'object') {
      const e = (c as { equip?: unknown }).equip;
      if (e && typeof e === 'object') {
        for (const bay of BAY_ORDER) {
          const id = (e as Record<string, unknown>)[bay];
          if (isArmoryId(id) && ARMORY[id].bay === bay) equip[bay] = id;
        }
      }
      const l = (c as { levels?: unknown }).levels;
      if (l && typeof l === 'object') {
        for (const [id, n] of Object.entries(l as Record<string, unknown>)) {
          if (isArmoryId(id) && typeof n === 'number' && Number.isFinite(n)) levels[id] = Math.floor(n);
        }
      }
    }
    out[ch] = { equip, levels };
  }
  return out;
}

/** One bay of a chapter's Armory as it will be played. */
export interface LabBay {
  bay: BayId;
  id: ArmoryId;
  level: number;
  /** The level is Auto's (none set by hand). */
  auto: boolean;
}

/** The upgrade a bay takes in this chapter. */
export function labEquip(s: LabArmorySettings, chapter: number, bay: BayId): ArmoryId {
  const id = s[chapter]?.equip[bay];
  return id && ARMORY[id]?.bay === bay ? id : LAB_DEFAULT_EQUIP[bay];
}

/** An upgrade's level in this chapter: the player's, kept inside the
 *  chapter's range, or Auto's. */
export function labLevel(s: LabArmorySettings, chapter: number, id: ArmoryId): { level: number; auto: boolean } {
  const set = s[chapter]?.levels[id];
  if (set === undefined) return { level: autoLevel(chapter, id), auto: true };
  const { lo, hi } = chapterRange(chapter, id);
  return { level: Math.max(lo, Math.min(hi, set)), auto: false };
}

/** A chapter's Armory, bay by bay. */
export function labBays(s: LabArmorySettings, chapter: number): LabBay[] {
  return BAY_ORDER.map((bay) => {
    const id = labEquip(s, chapter, bay);
    return { bay, id, ...labLevel(s, chapter, id) };
  });
}

/** The levels a Test Lab run on a map of this chapter plays with (what
 *  createGame takes, and what the log records). */
export function labArmoryLevels(s: LabArmorySettings, chapter: number): ArmoryLevels {
  const a: ArmoryLevels = {};
  for (const b of labBays(s, chapter)) a[b.id] = b.level;
  return a;
}

/** Is every bay of this chapter on its defaults (the default upgrade, at
 *  Auto)? */
export function labArmoryIsAuto(s: LabArmorySettings, chapter: number): boolean {
  return labBays(s, chapter).every((b) => b.auto && b.id === LAB_DEFAULT_EQUIP[b.bay]);
}

/** Equip an upgrade in its bay for this chapter. */
export function setLabEquip(s: LabArmorySettings, chapter: number, id: ArmoryId): void {
  const c = (s[chapter] ??= { equip: {}, levels: {} });
  c.equip[ARMORY[id].bay] = id;
}

/** Set an upgrade's level for this chapter (null: back to Auto). */
export function setLabLevel(s: LabArmorySettings, chapter: number, id: ArmoryId, level: number | null): void {
  const c = (s[chapter] ??= { equip: {}, levels: {} });
  if (level === null) delete c.levels[id];
  else {
    const { lo, hi } = chapterRange(chapter, id);
    c.levels[id] = Math.max(lo, Math.min(hi, Math.floor(level)));
  }
}

/** A chapter back to its defaults. */
export function resetLabChapter(s: LabArmorySettings, chapter: number): void {
  s[chapter] = { equip: {}, levels: {} };
}

/** The range in words, the same for every upgrade today ("Lv 1–3"); an
 *  upgrade with a higher max would read its own on its row. */
export function rangeText(chapter: number, id: ArmoryId = bayItems('gun')[0]): string {
  const { lo, hi } = chapterRange(chapter, id);
  return lo === hi ? `Lv ${lo}` : `Lv ${lo}–${hi}`;
}

/** One line for the hub and the map card: "Quick Reload 2 · Damage Control 2
 *  · Stockpile 2". */
export function labArmoryText(s: LabArmorySettings, chapter: number): string {
  return labBays(s, chapter)
    .map((b) => `${ARMORY[b.id].name} ${b.level}`)
    .join(' · ');
}
