import { ARSENAL, CATEGORIES, PROFILES, ROLES, CUT, ARMORY, POWERUPS } from './arsenal.mjs';
const problems = [], notes = [];
const byCat = (c) => ARSENAL.filter((a) => a.cat === c);
for (const [id, cat] of Object.entries(CATEGORIES)) {
  const all = byCat(id), fresh = all.filter((a) => a.status === 'new');
  const want = id === 'active' ? fresh.length : all.length;
  if (want !== 6) problems.push(`${cat.name}: ${want} ${id === 'active' ? 'new ideas' : 'weapons'} (want 6)`);
  const roles = new Set((id === 'active' ? fresh : all).map((a) => a.role));
  if (roles.size < 4) problems.push(`${cat.name}: only ${roles.size} roles among its six (${[...roles].join(', ')})`);
  for (const a of all) {
    if (!(a.role in ROLES)) problems.push(`${a.name}: unknown role ${a.role}`);
    if (a.r.length !== 5) problems.push(`${a.name}: ratings "${a.r}" not 5 long`);
    if (!cat.blindSpots && a.r.includes('-')) problems.push(`${a.name} (${cat.name}) can't touch ${PROFILES.filter((p, i) => a.r[i] === '-').join(', ')}: actives must reach everything`);
    if (id === 'active' && (!a.r.includes('S') || !a.r.includes('w'))) problems.push(`${a.name}: not a specialist (ratings ${a.r}: needs a strong and a weak side)`);
    if (a.name.length > 17) problems.push(`${a.name}: name ${a.name.length} chars (cards fit 17)`);
    if (a.line.length > 86) problems.push(`${a.name}: line ${a.line.length} chars (cards fit 86)`);
    if (a.echo) notes.push(`${a.name} echoes ${a.echo}`);
    const words = (s) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
    for (const [list, label] of [[CUT, 'cut before'], [ARMORY, 'an Armory card'], [POWERUPS, 'a random power-up']]) {
      for (const other of list) {
        if (a.status !== 'new' && label === 'a random power-up') continue;
        const shared = words(a.name).filter((w) => words(other).includes(w));
        if (a.name.toLowerCase() === other.toLowerCase()) problems.push(`${a.name}: same name as ${label} "${other}"`);
        else if (shared.length) notes.push(`${a.name} shares "${shared.join(', ')}" with ${label} "${other}"`);
      }
    }
  }
}
// Threat coverage: strong answers per profile, actives and the rest.
const strong = (list, i) => list.filter((a) => a.r[i] === 'S').map((a) => a.name);
const table = PROFILES.map((p, i) => ({ p, active: strong(byCat('active'), i), other: strong(ARSENAL.filter((a) => a.cat !== 'active'), i) }));
for (const t of table) {
  if (t.active.length < 2) problems.push(`${t.p}: only ${t.active.length} strong active answers`);
  if (t.other.length < 2) problems.push(`${t.p}: only ${t.other.length} strong answers outside the actives`);
}
// Same role + same ratings across categories: a likely duplicate.
const sig = new Map();
for (const a of ARSENAL) { const k = `${a.role}|${a.r}`; sig.set(k, [...(sig.get(k) ?? []), `${a.name} (${CATEGORIES[a.cat].name})`]); }
for (const [k, v] of sig) if (v.length > 1) notes.push(`same role and ratings (${k}): ${v.join(' / ')}`);
// Role × category map.
const roleMap = Object.keys(ROLES).map((r) => [r, Object.keys(CATEGORIES).map((c) => byCat(c).filter((a) => a.role === r).length)]);
console.log('PROBLEMS', problems.length); for (const p of problems) console.log('  ✗', p);
console.log('NOTES', notes.length); for (const n of notes) console.log('  ·', n);
console.log('\nstrong answers per threat profile:'); for (const t of table) console.log(`  ${t.p.padEnd(8)} active ${t.active.length} · other ${t.other.length}`);
console.log('\nrole × category (' + Object.values(CATEGORIES).map((c) => c.name.slice(0, 6)).join(' ') + ')');
for (const [r, n] of roleMap) console.log('  ' + r.padEnd(12) + n.map((x) => String(x).padStart(6)).join(' '));
