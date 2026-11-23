// Run: apply proto.patch to src/v3/sim/game.ts first (it exports damageThreat and
// adds a dodge hook), then: npx tsx tools/v3/weapon-ideas/proto.mts <idea> <average|spammer> <seeds>
// Prints one line: runs won, ships lost, wave reached. Revert the patch after.
// Prototype effects injected into real bot-played runs (all maps). Each idea
// is "on" in the same windows of every wave (8–23 s and 40–55 s: about the
// share of time a picked-up weapon is loaded), so ideas compare like for like.
import { createGame, step, tap, damageThreat, timeToImpact, canFire, type Game, type Threat } from '../../../src/v3/sim/game';
import { Bot, SKILLS } from '../../../src/v3/sim/bot';
import { MAP_ORDER } from '../../../src/v3/data/maps';
import { ABILITY_ORDER } from '../../../src/v3/data/abilities';
import { makeRng } from '../../../src/sim/rng';
const [, , ideaArg = 'none', skillName = 'average', seedsArg = '3'] = process.argv;
const SEEDS = Number(seedsArg);
const DT = 1 / 30;
const STRUCT = new Set(['rig', 'generator', 'citadel', 'dreadnought']);
const on = (g: Game) => g.phase === 'wave' && ((g.waveT >= 8 && g.waveT < 23) || (g.waveT >= 40 && g.waveT < 55));
const live = (g: Game) => g.threats.filter((t) => !t.dead && !STRUCT.has(t.kind) && t.x > -20 && t.x < 1620 && t.y > -20 && t.y < 920);
const killsOf = (g: Game) => Object.values(g.kills).reduce((a, b) => a + b, 0);
interface Ally { x: number; y: number; target: number | null; life: number }

function run(map: any, seed: number, idea: string) {
  const g: Game = createGame(map, seed);
  g.flow = 2;
  const prefer = makeRng(seed ^ 0x7a57e).shuffle([...ABILITY_ORDER]);
  const bot = new Bot({ ...SKILLS[skillName], prefer }, seed);
  const rng = makeRng(seed ^ 0xbeef);
  const st: any = { allies: [] as Ally[], next: 0, downUntil: [] as number[], kills: 0, extraKills: 0, silenced: 0, raidersKilled: 0, base: { ...g.stats }, wasOn: false, lvl: null as null | { id: string; level: number }, sliceT: 0, hold: null as any, first: new Map(), seenI: new Set(), sched: [] as any[], lastLost: 0, lastTaps: { ...g.taps }, tug: 0, streak: 0 };
  const dodgeT = new Map<number, number>();
  (globalThis as any).__helm = idea === 'helm' ? (gg: Game, sh: any, by: string) => {
    if (!on(gg) || !['ballistic', 'cluster', 'bomblet', 'heavy', 'strafer'].includes(by)) return false;
    if ((dodgeT.get(sh.id) ?? -99) > gg.t - 4) return false;
    dodgeT.set(sh.id, gg.t); st.dodges = (st.dodges ?? 0) + 1; return true;
  } : undefined;
  for (let i = 0; i < 60 * 60 * 30; i++) {
    const active = on(g) && idea !== 'none';
    // window edges: stat changes
    if (active !== st.wasOn) {
      st.wasOn = active;
      if (idea === 'fireatwill') { g.stats.rack = st.base.rack + (active ? 6 : 0); g.stats.reload = st.base.reload * (active ? 0.5 : 1); if (!active) g.ammo = Math.min(g.ammo, g.stats.rack); }
      if (idea === 'supply') { g.stats.powerShare = st.base.powerShare * (active ? 3 : 1); g.stats.dropShare = st.base.dropShare * (active ? 3 : 1); }
      if (!active && st.lvl && g.weapon && g.weapon.id === st.lvl.id) g.weapon.level = st.lvl.level;
      if (!active) st.lvl = null;
    }
    if (active && idea === 'slice' && g.pickups.some((p) => p.age > SKILLS[skillName].reaction)) bot.act(g);
    else if (active && idea === 'slice') {
      // The gun is a blade: a 320 px swipe through the most urgent threat, 1 round, every 0.3 s.
      if (g.t - st.sliceT >= SKILLS[skillName].tapGap && canFire(g)) {
        const L = live(g);
        if (L.length) {
          const t0 = L.sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b))[0];
          let best: Threat[] = [t0];
          for (const o of L) {
            if (o === t0) continue;
            const dx = o.x - t0.x, dy = o.y - t0.y, len = Math.hypot(dx, dy); if (len > 320 || len < 1) continue;
            const ux = dx / len, uy = dy / len, mx = (o.x + t0.x) / 2, my = (o.y + t0.y) / 2;
            const hit = L.filter((p) => Math.abs((p.x - mx) * ux + (p.y - my) * uy) <= 160 && Math.abs((p.x - mx) * uy - (p.y - my) * ux) <= 30);
            if (hit.length > best.length) best = hit;
          }
          if (g.overdriveT <= 0) g.ammo -= 1;
          for (const t of best) damageThreat(g, t, 1);
          st.sliceT = g.t;
        }
      }
    } else if (active && (idea === 'lance' || idea === 'hijack') && !g.pickups.some((p) => p.age > SKILLS[skillName].reaction)) {
      // lance: tap = 1 instant hit; a target with 3+ hp gets a hold (0.6 s → 3, 1.2 s → 6 and pierce). One round a shot.
      // hijack: a tapped missile/drone (≤2 hp, not aircraft) turns round: it dies and hits everything in a 40 px corridor back the way it came; others take 1.
      if (st.hold) {
        st.hold.t += DT;
        const t = g.threats.find((x) => x.id === st.hold.id && !x.dead);
        if (!t) st.hold = null;
        else if (st.hold.t >= st.hold.need) { damageThreat(g, t, st.hold.need >= 1.2 ? 6 : 3); if (g.overdriveT <= 0) g.ammo -= 1; st.hold = null; st.sliceT = g.t; }
      } else if (g.t - st.sliceT >= SKILLS[skillName].tapGap && canFire(g)) {
        const L = live(g);
        if (L.length) {
          const t0 = L.sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b))[0];
          if (idea === 'lance') {
            if (t0.hp >= 3) st.hold = { id: t0.id, t: 0, need: t0.hp > 3 ? 1.2 : 0.6 };
            else { damageThreat(g, t0, 1); if (g.overdriveT <= 0) g.ammo -= 1; st.sliceT = g.t; }
          } else {
            if (g.overdriveT <= 0) g.ammo -= 1;
            st.sliceT = g.t;
            const air = t0.kind === 'strafer' || t0.kind === 'bomber';
            if (t0.hp <= 2 && !air) {
              const f = st.first.get(t0.id) ?? { x: t0.x, y: t0.y - 300 };
              const dx = f.x - t0.x, dy = f.y - t0.y, len = Math.max(1, Math.hypot(dx, dy));
              damageThreat(g, t0, 99);
              for (const b of L) { if (b === t0) continue; const u = ((b.x - t0.x) * dx + (b.y - t0.y) * dy) / len; if (u < 0 || u > len) continue; if (Math.abs(((b.x - t0.x) * dy - (b.y - t0.y) * dx) / len) < 40) damageThreat(g, b, 2); }
            } else damageThreat(g, t0, 1);
          }
        }
      }
    } else if (active && (idea === 'shoreA' || idea === 'longshotA') && !g.pickups.some((p) => p.age > SKILLS[skillName].reaction)) {
      // The player adapts: shoot threats just after launch (nearest where they appeared), if any are fresh; else as usual.
      if (g.t - st.sliceT >= SKILLS[skillName].tapGap && canFire(g)) {
        const c = g.map.carrier;
        const L = live(g).filter((t) => { const f = st.first.get(t.id); return f && Math.hypot(t.x - f.x, t.y - f.y) < 250 && Math.hypot(t.x - c.x, t.y - c.y) > 600 && !g.interceptors.some((x) => x.target === t.id); });
        if (L.length) { const t = L[0]; tap(g, t.x, t.y, 6); st.sliceT = g.t; } else bot.act(g);
      }
    } else bot.act(g);
    for (const t of g.threats) if (!st.first.has(t.id)) st.first.set(t.id, { x: t.x, y: t.y });
    if (g.phase === 'won' || g.phase === 'lost') break;
    const k0 = killsOf(g);
    const pre = new Map(g.threats.filter((t) => !t.dead).map((t) => [t.id, { x: t.x, y: t.y }]));
    step(g, DT);
    const shotNew = g.interceptors.filter((x) => !st.seenI.has(x.id)); for (const x of shotNew) st.seenI.add(x.id);
    const tapsNow = { ...g.taps };
    const gone = [...pre].filter(([id]) => !g.threats.some((t) => t.id === id && !t.dead)).map(([, p]) => p);
    const newKills = killsOf(g) - k0;
    // scheduled extra hits (wingman, streak, ricochet)
    for (const e of st.sched) if (g.t >= e.at) { const t = g.threats.find((x) => x.id === e.id && !x.dead); if (t) damageThreat(g, t, e.dmg); e.done = 1; }
    st.sched = st.sched.filter((e: any) => !e.done);
    const lostNow = g.lost; const dLost = lostNow - st.lastLost; st.lastLost = lostNow;
    const dEmpty = g.taps.empty - st.lastTaps.empty, dFire = g.taps.fire - st.lastTaps.fire; st.lastTaps = { ...g.taps };
    if (!active) continue;
    if (idea === 'tug' && dLost > 0 && st.tug < 2) { const save = Math.min(dLost, 2 - st.tug); g.lost -= save; st.lastLost -= save; st.tug += save; }
    if (idea === 'wingman') for (const x of shotNew) if (x.src === 'gun' && x.target != null) st.sched.push({ at: g.t + 0.35, id: x.target, dmg: 1 });
    if (idea === 'streak') {
      if (dEmpty > 0) st.streak = 0;
      st.streak += dFire;
      for (const x of shotNew) if (x.src === 'gun' && x.target != null && st.streak >= 5) st.sched.push({ at: g.t + 0.3, id: x.target, dmg: st.streak >= 10 ? 2 : 1 });
    }
    if (idea === 'ricochet' && dEmpty > 0) { const L = live(g).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b)); if (L[0]) st.sched.push({ at: g.t + 0.3, id: L[0].id, dmg: 1 }); }
    if (idea === 'adrenaline') { const n = live(g).length; for (const x of shotNew) if (x.src === 'gun' && x.target != null && rng.chance(Math.min(1, 0.15 * n))) st.sched.push({ at: g.t + 0.3, id: x.target, dmg: 1 }); }
    if (idea === 'longshot' || idea === 'longshotA') { const c = g.map.carrier; for (const x of shotNew) if (x.src === 'gun' && x.target != null) { const t = g.threats.find((q) => q.id === x.target); if (t && Math.hypot(t.x - c.x, t.y - c.y) > 600) st.sched.push({ at: g.t + 0.6, id: t.id, dmg: 2 }); } }
    if (idea === 'shore' || idea === 'shoreA') {
      // Shore Bombardment: a shot at a threat still within 350 px of where it appeared also hits its launcher:
      // a truck there is destroyed, a silo there is silenced for 4 s (launches cancelled).
      for (let b = 0; b < g.baseDown.length; b++) if (st.downUntil[b] && g.t >= st.downUntil[b]) { g.baseDown[b] = false; st.downUntil[b] = 0; }
      for (const x of shotNew) {
        if (x.src !== 'gun' || x.target == null) continue;
        const t = g.threats.find((q) => q.id === x.target); const f = t && st.first.get(t.id); if (!t || !f) continue;
        if (Math.hypot(t.x - f.x, t.y - f.y) > 350) continue;
        const r = g.raiders.find((q) => q.kind !== 'sub' && Math.hypot(q.x - f.x, q.y - f.y) < 80);
        if (r) { g.raiders = g.raiders.filter((q) => q !== r); st.raidersKilled++; continue; }
        const b = g.map.bases.findIndex((bb) => Math.hypot(bb.x - f.x, bb.y - f.y) < 80);
        if (b >= 0 && !g.baseDown[b]) { st.silenced += g.queue.filter((l) => l.base === b && l.at >= g.waveT && l.at - g.waveT < 4).length; g.baseDown[b] = true; st.downUntil[b] = g.t + 4; }
      }
    }
    if (idea === 'overwatch') { st.next -= DT; if (st.next <= 0 && canFire(g)) { st.next = 0.8; const L = live(g).sort((a, b) => timeToImpact(g, a) - timeToImpact(g, b)); if (L[0]) tap(g, L[0].x, L[0].y, 6); } }
    if (idea === 'hunter') {
      st.next -= DT;
      if (st.next <= 0) {
        const sub = g.raiders.find((r) => r.kind === 'sub' && r.rounds.length && (r.state === 'warn' || r.state === 'surface' || r.state === 'fire'));
        const boat = g.threats.find((t) => !t.dead && (t.kind === 'fastboat' || t.kind === 'mine'));
        if (sub) { g.raiders = g.raiders.filter((r) => r !== sub); st.raidersKilled++; st.next = 3; }
        else if (boat) { damageThreat(g, boat, 99); st.next = 3; }
        else if (g.threats.find((t) => !t.dead && t.kind === 'dreadnought')) { damageThreat(g, g.threats.find((t) => !t.dead && t.kind === 'dreadnought')!, 1); st.next = 4; }
      }
    }
    if (idea === 'scavenger' && newKills > 0) g.ammo = Math.min(g.stats.rack, g.ammo + newKills);
    if (idea === 'volatile' && newKills > 0) {
      // every kill this frame bursts: 60 px, 1 hit (chains once per frame)
      // bursts where kills happened (gone this frame, by kill not impact: approx all gone while kills rose)
      for (const p of gone.slice(0, newKills)) for (const o of g.threats) if (!o.dead && Math.hypot(o.x - p.x, o.y - p.y) <= 60) damageThreat(g, o, 1);
    }
    if (idea === 'overclock' && g.weapon) {
      if (!st.lvl || st.lvl.id !== g.weapon.id) { st.lvl = { id: g.weapon.id, level: g.weapon.level }; g.weapon.level = Math.min(3, g.weapon.level + 1); }
      g.weapon.t += DT; // timer frozen
    }
    if (idea === 'drones' || idea === 'drones12') {
      // A stream from the bottom edge: one every 0.7 s, 420 px/s, rams for 1.
      st.next -= DT;
      if (st.next <= 0) { st.next = idea === 'drones12' ? 1.2 : 0.7; const c = g.map.carrier; st.allies.push({ x: c.x + rng.range(-300, 300), y: 920, target: null, life: 4 }); }
      const L = live(g);
      const claimed = new Set(st.allies.map((a: Ally) => a.target));
      for (const a of st.allies as Ally[]) {
        a.life -= DT;
        let t = L.find((x) => x.id === a.target);
        if (!t) { const free = L.filter((x) => !claimed.has(x.id)).sort((p, q) => timeToImpact(g, p) - timeToImpact(g, q)); t = free[0] ?? L[0]; a.target = t?.id ?? null; if (t) claimed.add(t.id); }
        if (!t) continue;
        const dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy);
        if (d < 18) { damageThreat(g, t, 1); a.life = 0; continue; }
        a.x += (dx / d) * 420 * DT; a.y += (dy / d) * 420 * DT;
      }
      st.allies = st.allies.filter((a: Ally) => a.life > 0);
    }
    if (idea === 'gunship') {
      // Two helicopters over the convoy: every 1.4 s each fires a rocket pod at the densest spot within 380 px (65 px blast, 1 hit).
      st.next -= DT;
      if (st.next <= 0) {
        st.next = 0.7; // alternate the two
        const ships = g.ships; if (!ships.length) continue;
        const cx = ships.reduce((s, x) => s + x.x, 0) / ships.length, cy = ships.reduce((s, x) => s + x.y, 0) / ships.length;
        const hx = cx + (rng.chance(0.5) ? -140 : 140), hy = cy - 50;
        const L = live(g).filter((t) => Math.hypot(t.x - hx, t.y - hy) < 380);
        let best: Threat | null = null, bn = 0;
        for (const a of L) { const n = L.filter((b) => Math.hypot(a.x - b.x, a.y - b.y) <= 65).length; if (n > bn) { bn = n; best = a; } }
        if (best) { const bx = best.x, by = best.y; for (const o of live(g)) if (Math.hypot(o.x - bx, o.y - by) <= 65) damageThreat(g, o, 1); }
      }
    }
    if (idea === 'orbital') {
      st.next -= DT;
      if (st.next <= 0) { st.next = 2.5; const L = g.threats.filter((t) => !t.dead && t.x > 0 && t.x < 1600 && t.y > 0 && t.y < 900).sort((a, b) => b.hp - a.hp); if (L[0]) damageThreat(g, L[0], 3); }
    }
    if (idea === 'bomber' || idea === 'bomberDelay') {
      // Every 6 s a bomber pass: kill a truck or sub on screen, else silence the busiest silo for 6 s.
      st.next -= DT;
      for (let b = 0; b < g.baseDown.length; b++) if (st.downUntil[b] && g.t >= st.downUntil[b]) { g.baseDown[b] = false; st.downUntil[b] = 0; }
      if (st.next <= 0) {
        st.next = 6;
        const r = g.raiders.find((x) => x.kind !== 'sub' && x.x > 0 && x.x < 1600 && x.y > 0 && x.y < 900 && x.rounds.length);
        if (r) { g.raiders = g.raiders.filter((x) => x !== r); st.raidersKilled++; }
        else {
          const counts = g.map.bases.map((_, b) => (g.baseDown[b] ? -1 : g.queue.filter((l) => l.base === b && l.at - g.waveT < 8 && l.at >= g.waveT).length));
          const b = counts.indexOf(Math.max(...counts));
          if (b >= 0 && counts[b] > 0) {
            st.silenced += counts[b];
            if (idea === 'bomber') { g.baseDown[b] = true; st.downUntil[b] = g.t + 6; }
            else for (const l of g.queue) if (l.base === b && l.at >= g.waveT && l.at - g.waveT < 6) l.at += 6;
            if (idea === 'bomberDelay') g.queue.sort((p, q) => p.at - q.at);
          }
        }
      }
    }
  }
  for (let b = 0; b < g.baseDown.length; b++) if (st.downUntil[b]) g.baseDown[b] = false;
  return { won: g.cleared, lost: g.lost, wave: g.wave, raidersKilled: st.raidersKilled, dodges: st.dodges ?? 0, silenced: st.silenced, carrier: g.carrierHp };
}
const rs: any[] = [];
for (const m of MAP_ORDER) for (let s = 0; s < SEEDS; s++) rs.push(run(m, 3000 + s, ideaArg));
const avg = (f: (r: any) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
console.log([ideaArg.padEnd(12), skillName.padEnd(8), `clear ${Math.round(avg((r) => (r.won ? 100 : 0)))}%`.padEnd(11), `lost ${avg((r) => r.lost).toFixed(2)}`.padEnd(11), `wave ${avg((r) => r.wave).toFixed(1)}`, `| raiders killed ${avg((r) => r.raidersKilled).toFixed(1)}, launches silenced ${avg((r) => r.silenced).toFixed(1)}, dodges ${avg((r) => r.dodges).toFixed(1)}`].join(' '));
