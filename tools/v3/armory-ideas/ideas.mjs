// The Armory overhaul brainstorm (round ar1, 2026-11-20): every existing
// upgrade with its measured value and a recommendation, the bays, a
// survivor.io-style Scrap design for unlocks, three other ways to change the
// Armory, new upgrade candidates, the short-term lift the player picked, and
// the open questions. The review page (page.mjs) and the design doc
// (doc.mjs → docs/design/v3-armory-overhaul.md) are both made from this.
//
// Numbers: `{{c:id}}` / `{{s:id}}` in text are ships saved a run by that
// upgrade alone at level 5 in the combo sweep's Armory stage (with the map's
// counter kit / with the bot drafting for itself; results/armory.json, 4
// seeds a map); `{{l:key}}` is a config of this round's own measurement
// (lift-results.json, 12 seeds a map, paired with "No Armory"). `fill()`
// swaps them for the numbers, so the text can't drift from the results.

import { readFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const SWEEP = JSON.parse(readFileSync(new URL('../combo-sweep/results/armory.json', here), 'utf8'));
export const LIFT = JSON.parse(readFileSync(new URL('lift-results.json', here), 'utf8'));

export const ROUND = 'ar1';
export const DATE = '2026-11-20';
export const PAGE_TITLE = 'Armory Overhaul Review';

const r1 = (x) => Math.round(x * 10) / 10;
const cfg = (key) => SWEEP.configs.find((c) => c.key === key);
/** Ships saved a run (all 13 waves) by one upgrade alone at level 5 in the
 *  combo sweep: kit 'counter' or 'self'. */
export function sweepSaved(id, kit = 'counter') {
  const none = cfg(`${kit}@none`);
  const c = cfg(`${kit}@${id}5`);
  if (!none || !c) throw new Error(`no sweep result for ${kit}@${id}5`);
  return r1(none.all.lostAll - c.all.lostAll);
}
export function sweepPerMap(id, kit = 'counter') {
  const none = cfg(`${kit}@none`);
  const c = cfg(`${kit}@${id}5`);
  return Object.fromEntries(SWEEP.maps.map((m) => [m, r1(none.perMap[m].lostAll - c.perMap[m].lostAll)]));
}
export const SWEEP_NONE = { counter: cfg('counter@none').all.lostAll, self: cfg('self@none').all.lostAll };
export const SWEEP_SEEDS = SWEEP.seeds.length;
export function lift(key) {
  const c = LIFT.configs[key];
  if (!c) throw new Error(`no lift result ${key}`);
  return c;
}
const fmt = (n) => (n < 0 ? `−${Math.abs(n)}` : String(n));
export function fill(t) {
  return String(t).replace(/\{\{(c|s|l|L|w|se):(\w+)\}\}/g, (_, k, id) =>
    k === 'c' ? fmt(sweepSaved(id, 'counter')) : k === 's' ? fmt(sweepSaved(id, 'self')) : k === 'l' ? fmt(lift(id).saved) : k === 'L' ? fmt(lift(id).lost) : k === 'se' ? String(lift(id).se) : `${lift(id).won}%`,
  );
}

// ---------------------------------------------------------------- today

export const BAYS = {
  gun: { name: 'Gun', blurb: 'The main gun', color: '#38bdf8' },
  hull: { name: 'Hull', blurb: 'The carrier and the convoy', color: '#4ade80' },
  supply: { name: 'Supply', blurb: 'Weapon drops and power-ups', color: '#fbbf24' },
};

/** How upgrades are earned today (src/v3/data/armory.ts, src/v3/platform/save.ts). */
export const TODAY = [
  '11 upgrades in three bays: Gun (5), Hull (3), Supply (3). Each has 5 levels, so 55 cards fill the Armory.',
  'Every level is a card won at the end of a run, never bought: 1 card for a run that cleared at least 3 waves, +1 for clearing the map, +1 more the first time you clear it.',
  'Each card is drawn at random from the upgrades not yet at level 5. A card you already hold adds a level. You never choose which one you get.',
  'A run takes one upgrade from each bay (the one you equip). The first card you win in a bay is equipped for you.',
  'Free Play and dev runs win nothing. Salvage, the round 1 currency you spent on gun upgrades, was removed in round 7.',
];
export const PLAYER_ASK = 'Let’s run a full brainstorm on the armory too this has never gotten an overhaul. So let’s look at all the existing upgrades and decide which ones to keep and also see if we need the change anything about the armory system such as the categories. How they are unlocked such as exp collected in game (I think how survivor io did this is exp and you use that to upgrade the ones you find at the end of game). Then I want you to come up with three ideas on other ways to change the armory system. And then decide how many new upgrades to make if any.';
export const PLAYER_LIFT = 'Lift the weak ones (Stockpile, Quick Reload, Long Loads) toward the middle; leave Armor Plating (no upgrade you own gets worse)';
export const ROUND7_QUOTE = 'they need to get that card at the end of the game. They don’t get to pick which ones… to get the next reload, you need to win another reload from a random drop';

// ---------------------------------------------------------------- a. every upgrade

/** rec: keep | change | merge | cut (the page's Keep / Change / Cut). */
export const UPGRADES = [
  {
    id: 'reload', name: 'Quick Reload', bay: 'gun',
    does: 'Each round loads 6% faster a level.',
    levels: ['1.27 s a round', '1.19 s', '1.11 s', '1.03 s', '0.95 s (−30%)'],
    strong: 'Felt every second of a run. Your usual build uses it, and it is the cleanest “more gun” upgrade.',
    weak: 'Second weakest in the Armory ({{c:reload}} ships saved with the counter kit). It was capped at −30% after V2’s round 6 audit found mashing won with an 11-round rack reloading 55% faster; with one gun card a run that pairing can’t happen any more.',
    rec: 'change', recWhy: 'Lift it to −40% at level 5 (see the lift): measured {{l:reload5}} → {{l:reloadA}} ships saved.',
  },
  {
    id: 'warhead', name: 'Wide Warhead', bay: 'gun',
    does: 'Interceptor blast 40% wider a level.',
    levels: ['140% blast', '180%', '220%', '260%', '300% blast'],
    strong: 'In the two best full builds of the sweep. Huge on swarm maps: +13.3 on Marrow.',
    weak: 'Middling alone ({{c:warhead}}), and swingy: it does nothing on Harbor Mouth.',
    rec: 'keep', recWhy: 'Keep as it is. It makes a build, which is what a gun card should do.',
  },
  {
    id: 'motor', name: 'Fast Motors', bay: 'gun',
    does: 'Interceptors fly 20% faster a level.',
    levels: ['120% speed', '140%', '160%', '180%', '200% speed'],
    strong: 'Even across maps ({{c:motor}} with the counter kit, {{s:motor}} drafting for itself). Easy to feel.',
    weak: 'Never the best at anything; a safe middle pick.',
    rec: 'keep', recWhy: 'Keep. It is where the middle should be.',
  },
  {
    id: 'magazine', name: 'Deep Magazine', bay: 'gun',
    does: 'More rounds in the rack (+1 at levels 1, 2, 4 and 5).',
    levels: ['7 rounds', '8', '8', '9', '10 rounds'],
    strong: 'Middle value ({{c:magazine}}); helps the burst moments, the boss rounds most.',
    weak: 'Level 3 adds nothing (8 → 8). In all three of the worst full builds. Overlaps Quick Reload: both just mean “more shots”.',
    rec: 'change', recWhy: 'Make every level count: 7, 8, 9, 10, 11 rounds (not measured). Safe while it stays in the Gun bay, where it can’t pair with Quick Reload; if it moves to Stores (see Categories), keep 10 at level 5.',
  },
  {
    id: 'fuse', name: 'Proximity Fuse', bay: 'gun',
    does: 'Bursts closer to a fast target; level 5 hits for 2.',
    levels: ['136% fuse reach', '171%', '200%', '221%', '243%, hits for 2'],
    strong: 'The best gun card ({{c:fuse}}; {{s:fuse}} drafting for itself). Level 5 is a real “wow” level.',
    weak: 'Levels 1–4 are hard to feel; the value is in level 5.',
    rec: 'keep', recWhy: 'Keep. The model for what a level 5 should feel like.',
  },
  {
    id: 'plating', name: 'Armor Plating', bay: 'hull',
    does: '8% more of the hits on a ship or the carrier glance off, a level.',
    levels: ['8% glance off', '16%', '24%', '32%', '40% glance off'],
    strong: 'The strongest card by far: {{c:plating}} ships saved, more than most whole weapons. Works on every map.',
    weak: 'It makes the Hull bay a non-choice: once you have it, nothing else in the bay competes.',
    rec: 'keep', recWhy: 'Keep as it is: your call (no upgrade you own gets worse). The lift brings the weak ones up instead.',
  },
  {
    id: 'pointdef', name: 'Point Defense (Armory)', bay: 'hull',
    does: 'The carrier shoots the nearest threat on its own.',
    levels: ['a shot every 3.5 s, 280 m', '3 s, 300 m', '2.6 s, 320 m', '2.3 s, 340 m', 'every 2 s, 360 m'],
    strong: 'Strong ({{c:pointdef}}), and best on Kesh (+14.3), where the drones come at the carrier.',
    weak: 'Shares its name with the Point Defense weapon you draft in a run. Weak on the Strait (+1.3).',
    rec: 'change', recWhy: 'Keep its numbers; rename it (e.g. “Deck Guns”) so it is not confused with the weapon.',
  },
  {
    id: 'repair', name: 'Damage Control', bay: 'hull',
    does: 'Crews patch every damaged hull, ships and carrier.',
    levels: ['+1 hull every 10 s', '8.5 s', '7 s', '5.5 s', 'every 4 s'],
    strong: 'Second best ({{c:repair}}; {{s:repair}} drafting for itself, nearly Armor Plating). In your usual build.',
    weak: 'Invisible: you rarely see a patch land.',
    rec: 'keep', recWhy: 'Keep. Maybe a small “+1” float when a patch lands (art, not balance).',
  },
  {
    id: 'longload', name: 'Long Loads', bay: 'supply',
    does: 'A weapon pickup stays in the gun 4 s longer a level.',
    levels: ['19 s a weapon', '23 s', '27 s', '31 s', '35 s a weapon'],
    strong: 'Simple to read.',
    weak: 'Weak ({{c:longload}}) and can’t be lifted with its own number: at 50 s and 65 s it saved {{l:longloadA}} and {{l:longloadB}}, no more than at 35 s, because a new weapon drops before the old one runs out.',
    rec: 'change', recWhy: 'Give it a new job: every weapon pickup also refills the rack. Measured {{l:longload5}} → {{l:longloadR}} at level 5.',
  },
  {
    id: 'drops', name: 'Supply Lines', bay: 'supply',
    does: 'Weapons drop more often, with a shorter wait for a guaranteed one.',
    levels: ['108%, one every 26 s', '116%, 24 s', '124%, 22 s', '132%, 21 s', '140%, one every 20 s'],
    strong: 'Middle with the counter kit ({{c:drops}}); big on Harbor Mouth (+13.8). In the second best full build.',
    weak: 'The weakest card when the bot drafts for itself ({{s:drops}}): more drops of a random draft help less than more drops of a planned kit.',
    rec: 'keep', recWhy: 'Keep for now and measure it again on more seeds after the lift (it is outside the three you picked).',
  },
  {
    id: 'stockpile', name: 'Stockpile', bay: 'supply',
    does: 'Power-ups drop more often and last longer.',
    levels: ['115% drops, 110% time', '130%, 120%', '145%, 130%', '160%, 140%', '175% drops, 150% time'],
    strong: 'Power-ups are the fun pickups (Overdrive, Shield, the Nuke). In the best full build of the sweep.',
    weak: 'The weakest card alone ({{c:stockpile}}), and in your usual build.',
    rec: 'change', recWhy: 'Lift it to 3.25× drops and 2.5× time at level 5: measured {{l:stockpile5}} → {{l:stockpileB}}.',
  },
];

// ---------------------------------------------------------------- b. categories

export const BAYS_NOW = [
  'Gun has 5 cards, Hull 3, Supply 3, and a run equips one from each. So a random card is a Gun card 5 times in 11, but only one Gun card is ever used: Gun cards are the ones most often wasted.',
  'Hull holds the three strongest cards (Armor Plating, Damage Control, Point Defense: {{c:plating}}, {{c:repair}}, {{c:pointdef}}). Once you own Armor Plating the bay is a non-choice.',
  'Supply holds three of the four weakest ({{c:drops}}, {{c:longload}}, {{c:stockpile}}). Its card often feels like a wasted win (the sweep’s own note).',
  'Two names clash: the Armory’s Point Defense and the Point Defense weapon.',
];

export const BAY_OPTIONS = [
  {
    id: 'move', name: 'Three bays; Deep Magazine moves to Supply (renamed Stores)',
    rec: true,
    what: 'Gun: Quick Reload, Wide Warhead, Fast Motors, Proximity Fuse. Hull: Armor Plating, Damage Control, Deck Guns. Stores: Deep Magazine, Long Loads, Supply Lines, Stockpile. 4 / 3 / 4.',
    why: 'The smallest change that fixes the two worst problems: a Gun card is wasted less often, and Stores gets a middle card. Magazine fits: it is “what the gun carries”, like a weapon load. Runs keep three upgrades, so no big retune. One check: Deep Magazine 5 and the lifted Quick Reload 5 could now be equipped together (10 rounds, −40% reload). That is short of V2’s mashing line (11 rounds, −55%), but needs a sweep.',
  },
  {
    id: 'keep', name: 'Keep the three bays as they are',
    what: 'Only the lift and the rename.',
    why: 'Nothing to relearn. The lift alone brings Supply closer to the middle.',
  },
  {
    id: 'four', name: 'Four bays: Gun, Loader, Hull, Supply',
    what: 'Gun: Wide Warhead, Fast Motors, Proximity Fuse. Loader: Quick Reload, Deep Magazine, Long Loads. Hull: the three. Supply: Supply Lines, Stockpile, and one new card.',
    why: 'Even bays of three, and a fourth card a run makes a build feel bigger. But four equipped upgrades are stronger than three: maps and the bot reports would need a retune.',
  },
  {
    id: 'none', name: 'No bays: a points budget',
    what: 'See idea A (Refit Points).',
    why: 'The most freedom, the most to rebuild.',
  },
];

// ---------------------------------------------------------------- c. unlocks: Scrap

/** The survivor.io loop the player described: XP-like Scrap collected in the
 *  run, spent at the end on cards you have found. */
export const SCRAP = {
  name: 'Scrap',
  pitch: 'Find cards at random, as now. Level them with Scrap you collect in every run, and choose which ones.',
  survivor: 'In Survivor.io, gear drops at random from chests, and you level the gear you own with gold and blueprints earned in every run, win or lose. You choose what to level. In-run XP only levels your skills for that run.',
  loop: [
    'In the run: every wave you clear and every boss round you survive pays Scrap (a counter by the score; nothing to tap, so it adds no work in a busy wave).',
    'End of the run: the Scrap is banked, win or lose. The card drop stays (1, +1 for a clear, +1 for a first clear), but a card is now a FIND: a new card joins the Armory at level 1; a card you already hold turns into 100 Scrap.',
    'In the Armory: tap a card you hold to level it, if you have the Scrap. You choose which cards grow, so the three you equip can reach level 5 long before the rest.',
  ],
  earn: [
    ['A wave cleared (waves 1–10)', 40],
    ['A boss round survived (11–13)', 50],
    ['Clearing the map', 150],
    ['First clear of a map', 250],
    ['A card you already hold', 100],
  ],
  /** Scrap to reach each level (level 1 comes with the find). */
  cost: [0, 150, 300, 500, 800],
  replaces: [
    'A duplicate card no longer adds a level; it pays 100 Scrap.',
    'Levels 2–5 are bought with Scrap, by your choice, not drawn at random.',
    'Kept: cards are still found only at the end of a run, at random, and only one card a bay is equipped.',
  ],
  conflict: 'Round 7 removed Salvage and made every level a random card on purpose (your words: “' + ROUND7_QUOTE + '”). This design keeps the random find but makes the levels a choice, so it brings back half of what round 7 took out. The question below asks which you want now.',
  pacing: 'With Scrap you choose where levels go, so the three cards you equip reach level 5 two to three times sooner for a strong or average player. The whole Armory takes about as long as today. A casual player, who rarely clears a map, earns little Scrap and gains least; a floor (say 100 Scrap for any run that clears 3 waves) would help them, at the cost of a faster Armory for everyone.',
  save: 'Your levels stay. Scrap starts at 0, or (an option) every level you hold above 1 is refunded as Scrap so you can re-spend it.',
};
export const SCRAP_PER_LEVEL_TOTAL = SCRAP.cost.reduce((a, b) => a + b, 0);
const earn = Object.fromEntries(SCRAP.earn.map(([k, v]) => [k, v]));

/** Player types for the pacing table: share of runs won, the wave a lost run
 *  ends on (from the bot reports' ranges, docs/design/v3-plan.md). */
export const PLAYERS = [
  { id: 'strong', name: 'Strong player', win: 0.7, lostAt: 8 },
  { id: 'average', name: 'Average player', win: 0.4, lostAt: 6 },
  { id: 'casual', name: 'Casual player', win: 0.1, lostAt: 4 },
];
const IDS = UPGRADES.map((u) => u.id);
const BAY_OF = Object.fromEntries(UPGRADES.map((u) => [u.id, u.bay]));

/** Runs until (a) one card in each bay is at level 5 (the three you equip)
 *  and (b) all 55 levels, today and with Scrap. A small Monte Carlo
 *  (seeded), 2000 careers a player type; first clears: the first 5 wins
 *  (chapter 1's five maps). Today the player equips the highest card in a
 *  bay; with Scrap they spend on one card a bay first, then the rest. */
export function pacing() {
  let s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const N = 2000;
  const out = [];
  for (const p of PLAYERS) {
    const tot = { todayThree: 0, todayAll: 0, scrapThree: 0, scrapAll: 0, scrapRun: 0 };
    for (let t = 0; t < N; t++) {
      // Today.
      let lv = Object.fromEntries(IDS.map((id) => [id, 0]));
      let wins = 0, three = 0, all = 0;
      for (let run = 1; run <= 400 && !all; run++) {
        const won = rnd() < p.win;
        const first = won && wins < 5;
        if (won) wins++;
        const n = (p.lostAt >= 3 || won ? 1 : 0) + (won ? 1 : 0) + (first ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const open = IDS.filter((id) => lv[id] < 5);
          if (!open.length) break;
          lv[open[Math.floor(rnd() * open.length)]]++;
        }
        if (!three && ['gun', 'hull', 'supply'].every((b) => IDS.some((id) => BAY_OF[id] === b && lv[id] >= 5))) three = run;
        if (IDS.every((id) => lv[id] >= 5)) all = run;
      }
      tot.todayThree += three || 400;
      tot.todayAll += all || 400;
      // Scrap.
      const found = new Set();
      const lvl = {};
      let bank = 0, spent = 0, earned = 0;
      wins = 0; three = 0; all = 0;
      for (let run = 1; run <= 400 && !all; run++) {
        const won = rnd() < p.win;
        const first = won && wins < 5;
        if (won) wins++;
        let got = won ? 10 * earn['A wave cleared (waves 1–10)'] + 3 * earn['A boss round survived (11–13)'] + earn['Clearing the map'] + (first ? earn['First clear of a map'] : 0) : p.lostAt * earn['A wave cleared (waves 1–10)'];
        const n = (p.lostAt >= 3 || won ? 1 : 0) + (won ? 1 : 0) + (first ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const id = IDS[Math.floor(rnd() * IDS.length)];
          if (found.has(id)) got += earn['A card you already hold'];
          else { found.add(id); lvl[id] = 1; }
        }
        bank += got; earned += got;
        // Spend: first one card a bay (the first found there), then anything.
        const pickFirst = ['gun', 'hull', 'supply'].map((b) => [...found].find((id) => BAY_OF[id] === b)).filter(Boolean);
        const order = [...pickFirst, ...[...found].filter((id) => !pickFirst.includes(id))];
        for (const id of order) while (lvl[id] < 5 && bank >= SCRAP.cost[lvl[id]]) { bank -= SCRAP.cost[lvl[id]]; spent += SCRAP.cost[lvl[id]]; lvl[id]++; }
        if (!three && ['gun', 'hull', 'supply'].every((b) => [...found].some((id) => BAY_OF[id] === b && lvl[id] >= 5))) three = run;
        if (IDS.every((id) => (lvl[id] ?? 0) >= 5)) all = run;
        tot.scrapRun += got;
      }
      tot.scrapThree += three || 400;
      tot.scrapAll += all || 400;
    }
    const m = (x) => Math.round(x / N);
    out.push({ ...p, todayThree: m(tot.todayThree), todayAll: m(tot.todayAll), scrapThree: m(tot.scrapThree), scrapAll: m(tot.scrapAll) });
  }
  return out;
}
export const PACING = pacing();
export const SCRAP_WIN = 10 * earn['A wave cleared (waves 1–10)'] + 3 * earn['A boss round survived (11–13)'] + earn['Clearing the map'];

// ---------------------------------------------------------------- d. three other ways

export const ALTERNATIVES = [
  {
    id: 'ar1-alt-refit', name: 'A. Refit Points', tag: 'Loadout budget with trade-offs',
    pitch: 'No bays. Each run you fit cards up to a points budget, and some cards carry a drawback that buys you more points.',
    how: 'The carrier has 10 refit points. A card costs its level in points (Armor Plating 5 = 5 points). Carry any mix: Plating 5 + Damage Control 5, or five cards at level 2. “Heavy” versions trade a drawback for points: Heavy Plating (+2 points, the convoy sails 10% slower), Hot Loads (+2, the rack is 2 rounds smaller). The budget grows with chapters (10, 12, 14, 16).',
    strong: 'Real build choices every run; the bays’ “one each” rule goes, and so does Armor Plating’s lock on the Hull bay. Drawbacks make interesting builds (all-in on the gun).',
    weak: 'Stacking two hull cards may break balance (Plating + Damage Control together is untested). More to think about before every run, on a phone. The budget needs tuning per chapter.',
    cost: 'Medium: about 3–4 days. save.ts (a budget, not one-a-bay), app.ts (the fitting screen), the drawbacks in armory.ts and game.ts, a combo-sweep stage for stacked builds.',
    size: 'M',
  },
  {
    id: 'ar1-alt-commend', name: 'B. Commendations', tag: 'Perks tied to maps and chapters',
    pitch: 'Each map awards one Commendation for a feat on it, a small permanent perk that fits that map. Twenty maps, twenty medals.',
    how: 'Clear Kesh with no ship lost in the Drone Storm: Storm Rigging (drones drift 10% slower everywhere). Clear Marrow with the radar slowed under 30 s: Radar Pickets (a threat is marked 1 s sooner). A chapter’s five medals unlock a chapter perk slot. Medals are a fourth slot beside the bays: equip one.',
    strong: 'Ties the Armory to the campaign and gives every map a replay goal. Each perk teaches the map it came from. Easy to add one per map as maps are built.',
    weak: '20 small perks to design and measure. Feats can feel grindy if too hard. A fourth slot makes runs stronger (needs a check per chapter).',
    cost: 'Medium–large, but spread out: about 2 days for the system (feat tracking in telemetry, a medals screen, one slot), then about half a day a map.',
    size: 'M',
  },
  {
    id: 'ar1-alt-tree', name: 'C. Branching Levels', tag: 'A small tech tree inside each card',
    pitch: 'At level 3 and level 5 each card forks: you choose one of two versions. Same 11 cards, twice the builds.',
    how: 'Wide Warhead 3: Cluster (three small bursts) or Shaped (a long narrow blast). Armor Plating 5: Reactive (a glancing hit shoves the threat back) or Spaced (the carrier takes no hits for 2 s after a ship is hit). Quick Reload 5: Autoloader (−40% reload) or Hot Swap (the rack refills when a weapon loads). You can re-pick a fork in the Armory between runs.',
    strong: 'Gives each level 5 a “wow” moment, like Proximity Fuse already has. Depth without more cards to find. Fits the Scrap system well: Scrap buys the levels, the fork is the choice.',
    weak: '22 forks to design, draw and balance; each fork needs its own sweep. Hard to show on one phone card.',
    cost: 'Large: about 5–7 days. New effects in game.ts for each fork, the fork picker in app.ts, art for 22 forks, a sweep stage per fork.',
    size: 'L',
  },
];

// ---------------------------------------------------------------- e. new upgrades

export const NEW_COUNT = {
  rec: 3,
  why: 'Three, one for each gap below that nothing in the Armory touches today: the in-run draft, the boss rounds, and the convoy’s own movement. Not more: 11 cards already take 30+ runs to fill, and every new card thins the random finds. Build them after the lift and the system choice, so they are tuned against the new numbers.',
};

export const NEW_UPGRADES = [
  {
    id: 'ar1-new-quartermaster', name: 'Quartermaster', bay: 'supply', rec: true,
    gap: 'The draft between waves, the run’s main decision. Nothing in the Armory touches it.',
    pitch: 'Re-roll the draft: 1 re-roll a run at level 1, up to 3 at level 5; level 5 also shows 4 cards instead of 3.',
    risk: 'The sweep found the first weapon matters most; a re-roll makes getting it surer, which may be strong early.',
  },
  {
    id: 'ar1-new-siege', name: 'Siege Shells', bay: 'gun', rec: true,
    gap: 'The boss rounds and structures (launchers, the Dreadnought). Boss rounds cost 1–4 ships a run, and no card is aimed at them.',
    pitch: 'Interceptors deal +1 damage to bosses and structures at level 3, +2 at level 5; lower levels shorten a structure’s rebuild.',
    risk: 'Only matters in the last three rounds and on structure maps; may read as weak on others.',
  },
  {
    id: 'ar1-new-boilers', name: 'Boilers', bay: 'hull', rec: true,
    gap: 'The convoy itself: how long it is exposed. Every hull card soaks hits; none shortens the trip.',
    pitch: 'The convoy sails 4% faster a level (20% at level 5). Level 5: Full Steam pickups last twice as long.',
    risk: 'Faster ships change map timing (radar, lock gates); a map built around a slow crossing may play differently.',
  },
  {
    id: 'ar1-new-firstpick', name: 'Drill Sergeant', bay: 'supply', rec: false,
    gap: 'The opening. The first weapon matters most (combo sweep).',
    pitch: 'Your first drafted weapon starts at level 2.',
    risk: 'A close cousin, Head Start (draft a weapon before wave 1), changed nothing in round 7: late waves decide runs.',
  },
  {
    id: 'ar1-new-salvors', name: 'Salvage Crews', bay: 'supply', rec: false,
    gap: 'Only with the Scrap system: a card that earns more Scrap.',
    pitch: '+10% Scrap a level.',
    risk: 'An economy card, not a battle card: it makes runs no easier, and the best players would always equip it.',
  },
  {
    id: 'ar1-new-lifeboats', name: 'Lifeboats', bay: 'hull', rec: false,
    gap: 'The loss rule: a sunk ship counts fully.',
    pitch: 'The first ship sunk each wave counts as half a loss.',
    risk: 'Changes the loss rule, which the maps’ difficulty is built on. Armor Plating already does much the same job.',
  },
];

// ---------------------------------------------------------------- f. the short-term lift

export const LIFT_NOTE = 'Not applied yet. Each upgrade alone at level 5, with the map’s counter kit forced, the “you” bot, 12 seeds on each of the five chapter 1 maps (60 runs), paired with No Armory on the same seeds; ± is one standard error. The sweep’s middle for comparison: Point Defense {{l:pointdef5}}, Proximity Fuse {{l:fuse5}}; Armor Plating {{l:plating5}} (unchanged).';

export const LIFT_ITEMS = [
  {
    id: 'ar1-lift-reload', name: 'Quick Reload', before: 'reload5', after: 'reloadA',
    tried: [['reloadC', '−35%'], ['reloadA', '−40%'], ['reloadB', '−50%']],
    now: ['1.27', '1.19', '1.11', '1.03', '0.95 s a round'],
    next: ['1.24', '1.13', '1.03', '0.92', '0.81 s a round'],
    rule: '8% faster a level (was 6%): −40% at level 5.',
    why: '−40% lands in the middle ({{l:reloadA}} ± {{se:reloadA}}). −50% saved {{l:reloadB}}, the top of the middle, and is close to V2’s mashing line.',
  },
  {
    id: 'ar1-lift-stockpile', name: 'Stockpile', before: 'stockpile5', after: 'stockpileB',
    tried: [['stockpileA', '2.5× drops, 2× time'], ['stockpileC', '3× drops, 2.25× time'], ['stockpileB', '3.25× drops, 2.5× time']],
    now: ['115% drops, 110% time', '130%, 120%', '145%, 130%', '160%, 140%', '175% drops, 150% time'],
    next: ['145% drops, 130% time', '190%, 160%', '235%, 190%', '280%, 220%', '325% drops, 250% time'],
    rule: '+45% drops and +30% time a level.',
    why: 'Power-ups are rare, so it takes a big multiplier to matter: 2.5× drops saved only {{l:stockpileA}}; 3.25× saves {{l:stockpileB}} ± {{se:stockpileB}}.',
  },
  {
    id: 'ar1-lift-longload', name: 'Long Loads', before: 'longload5', after: 'longloadR',
    tried: [['longloadA', '50 s a weapon'], ['longloadB', '65 s a weapon'], ['longloadP', '35 s, pity 20 s'], ['longloadR', '35 s + refill the rack'], ['longloadRP', '35 s + refill + pity 22 s']],
    now: ['19 s a weapon', '23 s', '27 s', '31 s', '35 s a weapon'],
    next: ['19 s, refills 2 rounds', '23 s, 3 rounds', '27 s, 4 rounds', '31 s, 5 rounds', '35 s, refills the whole rack'],
    rule: 'The load time stays; every weapon or boost pickup also refills rounds into the rack (2 at level 1, the whole rack at level 5).',
    why: 'Longer loads saved nothing ({{l:longloadA}} at 50 s, {{l:longloadB}} at 65 s: a new weapon drops first). Refilling the rack saved {{l:longloadR}} ± {{se:longloadR}}. Adding a shorter pity clock reached {{l:longloadRP}}, but that is Supply Lines’ job. Only level 5 was measured; levels 1–4 are a straight line to it.',
  },
];

/** Whole builds, before and after the lift (the same 60 runs each). */
export const LIFT_BUILDS = [
  { name: 'Your usual build (Quick Reload 5, Damage Control 4, Stockpile 5)', before: 'player', after: 'playerLift' },
  { name: 'The sweep’s best build (Wide Warhead 5, Armor Plating 5, Stockpile 5)', before: 'top', after: 'topLift' },
];
export const LIFT_WATCH = 'Watch Marrow: with the best build and the lifted Stockpile it lost 1.7 ships a run (was 3.5), under the “nearly trivial” line of 2. Marrow already plays easy for the bot (combo sweep), so this is Marrow’s problem more than Stockpile’s, but check it in the next sweep.';

// ---------------------------------------------------------------- g. questions

export const QUESTIONS = [
  {
    id: 'ar1-q-lift', q: 'Apply the lift as measured (Quick Reload −40%, Stockpile 3.25× drops and 2.5× time, Long Loads refills the rack)?',
    options: ['Yes, all three now (recommended)', 'Quick Reload and Stockpile now; Long Loads waits for the overhaul', 'Hold all of it until the overhaul'],
  },
  {
    id: 'ar1-q-longload', q: 'Long Loads can’t be lifted by making loads longer. What should it do?',
    options: ['A weapon or boost pickup also refills the rack (recommended)', 'Refill the rack and a shorter wait for a guaranteed weapon drop (overlaps Supply Lines)', 'Cut it and put a new Supply card in its place'],
  },
  {
    id: 'ar1-q-earn', q: 'How should Armory levels be earned from now on?',
    options: ['Scrap: find cards at random, level the ones you choose with Scrap from every run (recommended)', 'Scrap plus blueprints for each bay (Survivor.io’s two currencies)', 'Keep today’s rule: every level is a random card', 'Both: a duplicate card still adds a level, and Scrap buys levels too'],
  },
  {
    id: 'ar1-q-lost', q: 'Does a lost run keep the Scrap it earned?',
    options: ['Yes, all of it (recommended; Survivor.io does)', 'Half of it', 'No Scrap for a lost run'],
  },
  {
    id: 'ar1-q-save', q: 'When Scrap arrives, what happens to the Armory you have now?',
    options: ['Keep every level; Scrap starts at 0 (recommended)', 'Refund every level above 1 as Scrap, so you can re-spend it', 'Start the Armory again from empty'],
  },
  {
    id: 'ar1-q-bays', q: 'The bays: Gun has 5 cards, Hull 3, Supply 3, and a run uses one of each. Change them?',
    options: BAY_OPTIONS.map((o) => o.name + (o.rec ? ' (recommended)' : '')),
  },
  {
    id: 'ar1-q-pdname', q: 'The Armory’s Point Defense shares its name with the Point Defense weapon. Rename the Armory card?',
    options: ['Deck Guns (recommended)', 'CIWS Mount', 'Keep the name'],
  },
  {
    id: 'ar1-q-next', q: 'After the Scrap system, which other change to the Armory comes first?',
    options: ['B. Commendations: a perk for a feat on each map (recommended)', 'C. Branching levels: a choice at levels 3 and 5', 'A. Refit Points: a points budget instead of bays', 'None for now'],
  },
  {
    id: 'ar1-q-new', q: 'How many new upgrades?',
    options: ['Three: Quartermaster, Siege Shells, Boilers (recommended)', 'One or two (say which in the note)', 'None until the lift and the new system have landed', 'More than three'],
  },
  {
    id: 'ar1-q-drops', q: 'Supply Lines saved only {{s:drops}} ships when the bot drafted for itself (it was {{c:drops}} with the counter kit). Lift it too?',
    options: ['Measure it again on more seeds first (recommended)', 'Lift it now, like the other three', 'Leave it'],
  },
];
export const ELSE_ID = 'ar1-q-else';

/** Every id the page writes, by collection. */
export function allIds() {
  return {
    reviews: [...UPGRADES.map((u) => `ar1-up-${u.id}`), ...ALTERNATIVES.map((a) => a.id), ...NEW_UPGRADES.map((n) => n.id), ...LIFT_ITEMS.map((l) => l.id)],
    answers: [...QUESTIONS.map((q) => q.id), ELSE_ID],
  };
}
