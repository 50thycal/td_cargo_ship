// Icon identity: every mechanically distinct system has its own symbol, and
// wears the same one on every screen.
//
// This is a real defect class, not a style preference. Five counter branches
// once shared the generic `turret` glyph — among them the shore-base
// interceptor and the cargo self-defense interceptor, which are the two ends
// of missile defense and the two things a player most often has to choose
// between on one draft table. Two options that look identical are not a
// choice, they are a coin toss, and nothing in the build caught it because
// nothing asserted it. This does.

import { describe, expect, it } from 'vitest';
import { BRANCH_ICONS, ICONS, MODULE_BRANCH, MODULE_ICONS, STAT_META } from '../src/ui/icons';
import { COUNTER_BRANCHES } from '../src/data/counters';
import { MODULES } from '../src/data/defs';

describe('icon identity', () => {
  it('gives every counter branch an icon that exists', () => {
    for (const id of Object.keys(COUNTER_BRANCHES)) {
      const name = BRANCH_ICONS[id as keyof typeof BRANCH_ICONS];
      expect(name, `branch ${id} has no icon`).toBeTruthy();
      expect(ICONS[name], `branch ${id} points at a missing icon "${name}"`).toBeTruthy();
    }
  });

  it('never gives two counter branches the same icon', () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [branch, name] of Object.entries(BRANCH_ICONS)) {
      const first = seen.get(name);
      if (first) clashes.push(`${first} and ${branch} both use "${name}"`);
      else seen.set(name, branch);
    }
    expect(clashes).toEqual([]);
  });

  it('keeps the three missile-defense systems visually separate', () => {
    // The specific pair the playtest called out, plus the third system that
    // sits alongside them on the same draft tables.
    const shore = BRANCH_ICONS.baseInterceptor;
    const point = BRANCH_ICONS.selfDefense;
    const escort = BRANCH_ICONS.escortInterceptor;
    expect(new Set([shore, point, escort]).size).toBe(3);
    // ...and none of them falls back to a generic glyph shared with a stat,
    // a category ribbon or a screen heading.
    for (const name of [shore, point, escort]) {
      expect(['turret', 'missile', 'shield', 'ammo', 'slots']).not.toContain(name);
    }
  });

  it('shows a cargo module under the same icon as the branch it belongs to', () => {
    for (const id of Object.keys(MODULES)) {
      const moduleId = id as keyof typeof MODULE_BRANCH;
      const branch = MODULE_BRANCH[moduleId];
      expect(branch, `module ${id} is not mapped to a branch`).toBeTruthy();
      expect(MODULE_ICONS[moduleId]).toBe(BRANCH_ICONS[branch]);
    }
  });

  it('never gives two cargo modules the same icon', () => {
    const names = Object.values(MODULE_ICONS);
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws every icon as a well-formed 24-grid glyph', () => {
    for (const [name, svg] of Object.entries(ICONS)) {
      expect(svg.startsWith('<svg'), `${name} is not an svg`).toBe(true);
      expect(svg.endsWith('</svg>'), `${name} is unterminated`).toBe(true);
      // Same grid and stroke for every glyph, so they sit together at any size.
      expect(svg, `${name} is off the shared grid`).toMatch(/viewBox="0 0 2[46] 24"/);
    }
  });

  it('leaves no icon in the set unused', () => {
    // A glyph nobody references is either a leftover or a wiring mistake — the
    // symptom of the second is exactly the duplicate-icon bug this file exists
    // for, seen from the other side.
    const used = new Set<string>([
      ...Object.values(BRANCH_ICONS),
      ...Object.values(MODULE_ICONS),
      ...Object.values(STAT_META).map((m) => m.icon),
    ]);
    // Glyphs the UI uses for headings, categories, stats and screen furniture
    // rather than for a specific system.
    const furniture = [
      'radar', 'sonar', 'eye', 'alert', 'clock', 'missile', 'battery', 'turret',
      'ammo', 'chevrons', 'shield', 'flame', 'mine', 'drone', 'jam', 'planeScan',
      'coin', 'intel', 'star', 'wrench', 'anchor', 'flask', 'lock', 'check',
      'slots', 'crate', 'escortShip', 'planeGun', 'accuracy', 'burst',
    ];
    const orphans = Object.keys(ICONS).filter((n) => !used.has(n) && !furniture.includes(n));
    expect(orphans).toEqual([]);
  });
});
