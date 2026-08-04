// Counter-value ablation harness.
//
// Answers the one question the playtest sweep cannot: **is this counter worth
// what it costs?** Takes a broad build, removes exactly one counter branch, and
// plays both arms on matched seeds. A counter that earns its slot shows a
// NEGATIVE delta when removed.
//
// Usage:
//   npm run ablate                       # every counter the base build carries
//   npm run ablate -- --seeds 24
//   npm run ablate -- --persona turtle
//   npm run ablate -- --only deckGun,counterBattery
//
// Two things this gets right that a quick hand-rolled probe did not, both of
// which produced confidently wrong answers first time:
//
//   1. It ablates by BRANCH ID, deriving research ids and equipment from the
//      catalogue. Matching persona entries by string fragment silently took
//      whole platforms with it — an "interceptors" ablation that also matched
//      `escortModule` and `baseModule` removed the deck guns and the
//      counter-battery too, and its number got read as an interceptor result.
//   2. It defaults to enough seeds to separate the arms. At 10 seeds this said
//      every counter was worth negative value; at 16, on matched seeds, two of
//      them inverted. Builds that finish within 10% of each other cannot be
//      ranked on a handful of campaigns.

import { createRoundTransit, newCampaign, planCurrentRound, resolveTransit } from '../../src/sim/campaign';
import type { CampaignState } from '../../src/sim/types';
import { stepTransit } from '../../src/sim/transit';
import { COUNTER_BRANCHES } from '../../src/data/counters';
import {
  decideCommands,
  newTransitMemory,
  personaByName,
  procure,
  research,
  type BuyIntent,
  type Persona,
} from './personas';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface Options {
  seeds: number;
  rounds: number;
  persona: string;
  only: string[];
}

function parseArgs(argv: string[]): Options {
  const o: Options = { seeds: 16, rounds: 15, persona: 'balanced', only: [] };
  for (let i = 0; i < argv.length; i++) {
    const next = (): string => argv[++i] ?? '';
    switch (argv[i]) {
      case '--seeds':
        o.seeds = Math.max(1, parseInt(next(), 10) || o.seeds);
        break;
      case '--rounds':
        o.rounds = Math.max(1, parseInt(next(), 10) || o.rounds);
        break;
      case '--persona':
        o.persona = next() || o.persona;
        break;
      case '--only':
        o.only = next().split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--help':
      case '-h':
        console.log(
          [
            'Straitwatch counter-value ablation',
            '',
            '  --seeds N       campaigns per arm (default 16 — fewer cannot separate close builds)',
            '  --rounds N      max rounds per campaign (default 15)',
            '  --persona NAME  build to ablate from (default balanced)',
            '  --only a,b      only these counter branches',
          ].join('\n'),
        );
        process.exit(0);
    }
  }
  return o;
}

// ---------------------------------------------------------------------------
// Ablation
// ---------------------------------------------------------------------------

/** Consumables that are useless once their launcher is gone, so removing a
 *  branch removes its ammunition too — otherwise the ablated arm keeps paying
 *  for rounds it can never fire and the comparison flatters the counter. */
const AMMO_FOR: Record<string, BuyIntent['kind']> = {
  mcmDrones: 'droneAmmo',
  selfDefense: 'selfDefenseAmmo',
  escortInterceptor: 'ammo',
  baseInterceptor: 'ammo',
};

/** Transit-policy flags a branch's equipment drives; switched off with it. */
const POLICY_FOR: Record<string, keyof Persona['transit']> = {
  mcmDrones: 'sweepMines',
  scanPulse: 'useScan',
  warthog: 'useWarthog',
  smokeScreen: 'useSmoke',
  depthCharges: 'useDepthCharges',
  activeSonar: 'useSonar',
};

/** Remove one counter branch from a build: its research, its equipment, its
 *  ammunition and the transit behaviour that uses it. Everything else — hulls,
 *  formation, every other counter — is untouched, which is what makes the two
 *  arms comparable. */
function ablate(base: Persona, branchId: string): Persona {
  const branch = COUNTER_BRANCHES[branchId as keyof typeof COUNTER_BRANCHES];
  const eq = branch?.equipment as { kind: string; id: string } | undefined;
  const ammoKind = AMMO_FOR[branchId];

  const dropsBuy = (b: BuyIntent): boolean => {
    if (ammoKind && b.kind === ammoKind) return true;
    if (!eq) return false;
    switch (eq.kind) {
      case 'cargoModule':
        return b.kind === 'module' && b.moduleId === eq.id;
      // Escort modules are no longer their own intent — they come out of the
      // persona's escortDoctrine, so the branch is removed from the doctrine
      // below rather than from the buy list.
      case 'escortModule':
        return false;
      case 'baseModule':
        return b.kind === 'baseModule' && b.id === eq.id;
      case 'ability':
        return b.kind === 'ability' && b.id === eq.id;
      case 'builtIn':
        // The platform itself: escorts or shore batteries.
        return b.kind === (eq.id === 'escort' ? 'escort' : 'base');
      default:
        return false;
    }
  };

  // Strip the ablated module from every escort's wanted loadout. Each escort
  // keeps the REST of its fit, so the arm still sails a mixed flotilla — only
  // this one capability is gone from it.
  const doctrine =
    eq?.kind === 'escortModule' && base.escortDoctrine
      ? base.escortDoctrine.map((fit) => fit.filter((m) => m !== eq.id))
      : base.escortDoctrine;
  const wantsAnyFit = (doctrine ?? []).some((fit) => fit.length > 0);

  const policy = POLICY_FOR[branchId];
  return {
    ...base,
    name: `-${branchId}`,
    // Node ids are namespaced by branch, so this is exact rather than fuzzy.
    research: base.research.filter((r) => !r.startsWith(`${branchId}.`)),
    buys: base.buys.filter((b) => !dropsBuy(b) && (b.kind !== 'escortFit' || wantsAnyFit)),
    escortDoctrine: doctrine,
    transit: policy ? { ...base.transit, [policy]: false } : base.transit,
  };
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

interface Result {
  survived: number;
  rounds: number;
  delivered: number;
  score: number;
  losses: number;
  /** Equipment the build actually ended up owning, as `kind:id` keys. Carried
   *  so a branch that was researched but never BOUGHT can be reported as
   *  unmeasured instead of as a number. */
  owned: Set<string>;
}

/** Everything this campaign actually owns, keyed to match a branch's
 *  `equipment` descriptor. */
function ownedEquipment(c: CampaignState, into: Set<string>): void {
  for (const mods of Object.values(c.classModules)) {
    for (const m of mods) into.add(`cargoModule:${m}`);
  }
  // Any escort carrying it counts — the branch is measured as owned as soon as
  // one hull in the flotilla can use it.
  for (const unit of c.escortUnits) {
    for (const m of unit.modules) into.add(`escortModule:${m}`);
  }
  for (const m of c.baseModules) into.add(`baseModule:${m}`);
  if (c.warthogUnlocked) into.add('ability:warthog');
  if (c.scanUnlocked) into.add('ability:scan');
  if (c.sonarUnlocked) into.add('ability:sonar');
  if (c.smokeUnlocked) into.add('ability:smoke');
  if (c.hardenedUnlocked) into.add('ability:hardened');
  if (c.escortUnits.length > 0) into.add('builtIn:escort');
  if (c.bases > 0) into.add('builtIn:base');
}

function play(p: Persona, seeds: number, maxRounds: number): Result {
  const r: Result = { survived: 0, rounds: 0, delivered: 0, score: 0, losses: 0, owned: new Set() };
  let delivSum = 0;
  let delivRounds = 0;
  for (let s = 0; s < seeds; s++) {
    const c = newCampaign(`playtest-${s}`);
    let played = 0;
    for (let round = 0; round < maxRounds; round++) {
      if (c.campaignOver) break;
      procure(c, p);
      if (Object.values(c.composition).reduce((a, b) => a + b, 0) === 0) break;
      ownedEquipment(c, r.owned);
      const plan = planCurrentRound(c);
      const { state, rng } = createRoundTransit(c, plan);
      const mem = newTransitMemory();
      let guard = 0;
      while (!state.over && guard++ < 100_000) {
        stepTransit(state, decideCommands(state, p, mem), rng);
      }
      if (state.stats.launched > 0) {
        delivSum += state.stats.delivered / state.stats.launched;
        delivRounds++;
      }
      r.losses += state.stats.lost;
      resolveTransit(c, state);
      played++;
      research(c, p);
    }
    r.rounds += played;
    r.score += c.score;
    if (played >= maxRounds && !c.campaignOver) r.survived++;
  }
  r.delivered = delivRounds > 0 ? (delivSum / delivRounds) * 100 : 0;
  return r;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const base = personaByName(opts.persona);
if (!base) {
  console.error(`Unknown persona "${opts.persona}".`);
  process.exit(1);
}

/** Only ablate what this build actually carries — removing something it never
 *  had measures nothing, and would report as a confident zero. */
const carried = Object.keys(COUNTER_BRANCHES).filter((id) => {
  const stripped = ablate(base, id);
  return (
    stripped.research.length !== base.research.length || stripped.buys.length !== base.buys.length
  );
});
const targets = opts.only.length > 0 ? opts.only.filter((t) => carried.includes(t)) : carried;
const skipped = opts.only.length > 0 ? opts.only.filter((t) => !carried.includes(t)) : [];

const pad = (s: string, w: number): string => (s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length));
const padL = (s: string, w: number): string => (s.length >= w ? s : ' '.repeat(w - s.length) + s);

console.log(`\nCOUNTER-VALUE ABLATION — "${base.name}", ${opts.seeds} matched seeds`);
console.log('─'.repeat(80));

const baseline = play(base, opts.seeds, opts.rounds);
console.log(
  '  ' + pad('ARM', 22) + padL('WENT', 7) + padL('ROUNDS', 8) + padL('DELIV%', 9) +
    padL('LOSSES', 8) + padL('SCORE', 8) + padL('WORTH', 9),
);
console.log('─'.repeat(80));
console.log(
  '  ' + pad('(full build)', 22) +
    padL(`${Math.round((baseline.survived / opts.seeds) * 100)}%`, 7) +
    padL((baseline.rounds / opts.seeds).toFixed(1), 8) +
    padL(`${baseline.delivered.toFixed(1)}%`, 9) +
    padL(`${baseline.losses}`, 8) +
    padL(`${Math.round(baseline.score / opts.seeds)}`, 8) +
    padL('—', 9),
);

const rows: { id: string; worth: number; counters: string }[] = [];
const unbought: string[] = [];
for (const id of targets) {
  const branch = COUNTER_BRANCHES[id as keyof typeof COUNTER_BRANCHES] as {
    counters?: string;
    equipment?: { kind: string; id: string };
  };
  const eq = branch?.equipment;
  // A branch the build RESEARCHED but never actually bought cannot be measured
  // by removing it: the two arms differ only in a research slot, and the number
  // that falls out describes which project completed instead. Report it as
  // unmeasured rather than as a value — a confident zero here is exactly how
  // the previous ablation misread half its own table.
  if (eq && !baseline.owned.has(`${eq.kind}:${eq.id}`)) {
    unbought.push(id);
    console.log(
      '  ' + pad(`without ${id}`, 22) + padL('—', 7) + padL('—', 8) + padL('—', 9) +
        padL('—', 8) + padL('—', 8) + padL('NEVER BOUGHT', 15),
    );
    continue;
  }
  const r = play(ablate(base, id), opts.seeds, opts.rounds);
  // WORTH is the baseline's advantage over the build without it: positive means
  // the counter earned its slot, negative means the build is better off
  // spending that money and research time on something else.
  const worth = ((baseline.score - r.score) / baseline.score) * 100;
  rows.push({ id, worth, counters: branch?.counters ?? '—' });
  console.log(
    '  ' + pad(`without ${id}`, 22) +
      padL(`${Math.round((r.survived / opts.seeds) * 100)}%`, 7) +
      padL((r.rounds / opts.seeds).toFixed(1), 8) +
      padL(`${r.delivered.toFixed(1)}%`, 9) +
      padL(`${r.losses}`, 8) +
      padL(`${Math.round(r.score / opts.seeds)}`, 8) +
      padL(`${worth >= 0 ? '+' : ''}${worth.toFixed(1)}%`, 9),
  );
}

console.log('\nWORTH = how much the full build beats the build without it.');
console.log('  positive -> the counter earns its slot   negative -> it costs more than it returns');

console.log('\nRANKED');
console.log('─'.repeat(80));
for (const r of [...rows].sort((a, b) => b.worth - a.worth)) {
  const bar = r.worth >= 0 ? '+'.repeat(Math.min(40, Math.round(r.worth))) : '-'.repeat(Math.min(40, Math.round(-r.worth)));
  console.log(`  ${pad(r.id, 22)}${pad(`(vs ${r.counters})`, 18)}${padL(`${r.worth >= 0 ? '+' : ''}${r.worth.toFixed(1)}%`, 8)}  ${bar}`);
}
if (unbought.length > 0) {
  console.log(`\n  RESEARCHED BUT NEVER BOUGHT — unmeasurable, and a finding in itself:`);
  console.log(`    ${unbought.join(', ')}`);
  console.log('    The build completed their research and then never afforded the equipment.');
}
if (skipped.length > 0) {
  console.log(`\n  Not carried by "${base.name}", so not measured: ${skipped.join(', ')}`);
}
console.log('');
