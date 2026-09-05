// REGION WORKSHOP — the balance sweep panel.
//
// The statistical half of playtesting, inside the editor: the same persona
// sweep the CLI runs (src/sim/playtest/sweep.ts), played in a Web Worker so
// the timeline stays usable, with the result kept against the preset's content
// hash so an edit can be read against what came before it.
//
// What it can tell a designer: win and loss rates, how campaigns ended, what
// the money did, which enemy branch did the killing, whether the enemy's
// economy was actually spending, and the seesaw north-star signals. What it
// cannot: whether the region FEELS good. That still needs a human.

import { h } from './dom';
import { contentHash, clone, type RegionAuthoringDef } from '../data/regionAuthoring';
import { ENEMY_BRANCH_NAMES } from '../data/counters';
import { PERSONAS } from '../sim/playtest/personas';
import type { SweepSummary, PersonaSummary } from '../sim/playtest/analyze';
import { deleteSweeps, listSweeps, saveSweep, type SweepRecord } from '../platform/workshopStore';
import type { SweepReply, SweepRequest } from './sweepWorker';

// ---------------------------------------------------------------------------
// State (module scope: survives the editor's re-renders)
// ---------------------------------------------------------------------------

interface SweepState {
  seeds: number;
  personas: Set<string>;
  rounds: number;
  running: boolean;
  worker: Worker | null;
  startedAt: number;
  progress: { done: number; total: number; line: string } | null;
  /** The record just produced (also persisted), or the one picked from history. */
  current: SweepRecord | null;
  /** A second record to read `current` against. */
  compare: SweepRecord | null;
  error: string | null;
  /** Persona whose curve is drawn beside the overall mean. */
  focusPersona: string | null;
  /** Which region the state belongs to; switching regions resets it. */
  regionId: string | null;
}

const DEFAULT_SEEDS = 3;

const sweep: SweepState = {
  seeds: DEFAULT_SEEDS,
  personas: new Set(PERSONAS.map((p) => p.name)),
  rounds: 0,
  running: false,
  worker: null,
  startedAt: 0,
  progress: null,
  current: null,
  compare: null,
  error: null,
  focusPersona: null,
  regionId: null,
};

function resetFor(regionId: string): void {
  if (sweep.regionId === regionId) return;
  if (sweep.worker) cancelSweep();
  sweep.regionId = regionId;
  sweep.current = listSweeps(regionId)[0] ?? null;
  sweep.compare = null;
  sweep.error = null;
  sweep.progress = null;
  sweep.focusPersona = null;
}

export function cancelSweep(): void {
  sweep.worker?.postMessage({ type: 'cancel' });
}

function startSweep(def: RegionAuthoringDef, regionName: string, rerender: () => void): void {
  if (sweep.running) return;
  const personas = PERSONAS.map((p) => p.name).filter((n) => sweep.personas.has(n));
  if (personas.length === 0) {
    sweep.error = 'Pick at least one persona.';
    rerender();
    return;
  }
  let worker: Worker;
  try {
    worker = new Worker(new URL('./sweepWorker.ts', import.meta.url), { type: 'module' });
  } catch (err) {
    sweep.error = `Could not start the sweep worker: ${err instanceof Error ? err.message : String(err)}`;
    rerender();
    return;
  }
  const snapshot = clone(def);
  const hash = contentHash(snapshot);
  const options = { seeds: sweep.seeds, personas, rounds: sweep.rounds };
  sweep.worker = worker;
  sweep.running = true;
  sweep.error = null;
  sweep.startedAt = Date.now();
  sweep.progress = { done: 0, total: sweep.seeds * personas.length, line: 'starting…' };
  worker.onmessage = (ev: MessageEvent<SweepReply>) => {
    const msg = ev.data;
    if (msg.type === 'progress') {
      sweep.progress = {
        done: msg.done,
        total: msg.total,
        line: `${msg.persona} · ${msg.seed} → ${msg.roundsPlayed} rounds, ${msg.endReason}`,
      };
      rerender();
      return;
    }
    if (msg.type === 'error') {
      sweep.error = msg.message;
    } else {
      const record: SweepRecord = {
        regionId: snapshot.id,
        hash,
        regionName,
        ranAt: new Date().toISOString(),
        options: { ...options, seeds: msg.cancelled ? Math.ceil(msg.summary.campaigns / Math.max(1, personas.length)) : options.seeds },
        seconds: msg.seconds,
        summary: msg.summary,
      };
      if (msg.summary.campaigns > 0) saveSweep(record);
      sweep.compare = sweep.current && sweep.current.hash !== hash ? sweep.current : null;
      sweep.current = msg.summary.campaigns > 0 ? record : sweep.current;
      if (msg.cancelled) sweep.error = `Stopped after ${msg.summary.campaigns} campaign(s); the partial result is shown.`;
    }
    finish();
    rerender();
  };
  worker.onerror = (ev) => {
    sweep.error = ev.message || 'The sweep worker failed.';
    finish();
    rerender();
  };
  const req: SweepRequest = { type: 'run', def: snapshot, ...options };
  worker.postMessage(req);
  rerender();
}

function finish(): void {
  sweep.worker?.terminate();
  sweep.worker = null;
  sweep.running = false;
  sweep.progress = null;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const money = (v: number): string => `£${Math.round(v).toLocaleString()}`;

function tile(label: string, value: string, tone: '' | 'good' | 'warn' | 'bad' = '', sub?: string): HTMLElement {
  const el = h('div', { className: `ws-tile ${tone}`.trim() }, [
    h('div', { className: 'ws-tile-label', text: label }),
    h('div', { className: 'ws-tile-value', text: value }),
  ]);
  if (sub) el.append(h('div', { className: 'ws-tile-sub hint', text: sub }));
  return el;
}

function winTone(rate: number): '' | 'good' | 'warn' | 'bad' {
  // The seesaw wants a region a good build clears and a poor one does not:
  // everyone winning is as broken as nobody winning.
  if (rate >= 0.95 || rate <= 0.05) return 'bad';
  if (rate >= 0.8 || rate <= 0.2) return 'warn';
  return 'good';
}

function endReasonLabel(reason: string): string {
  switch (reason) {
    case 'region-complete': return 'Region cleared';
    case 'round-cap': return 'Reached round cap';
    case 'quota-failed': return 'Quota failed';
    case 'confidence-collapse': return 'Confidence collapsed';
    case 'fleet-wiped': return 'Fleet wiped out';
    default: return reason;
  }
}

/** A delta chip: how `now` reads against `before`. */
function delta(now: number, before: number, format: (v: number) => string, higherIsBetter = true): HTMLElement {
  const d = now - before;
  if (Math.abs(d) < 1e-9) return h('span', { className: 'ws-delta same', text: '=' });
  const good = higherIsBetter ? d > 0 : d < 0;
  return h('span', { className: `ws-delta ${good ? 'good' : 'bad'}`, text: `${d > 0 ? '+' : '−'}${format(Math.abs(d))}` });
}

// ---------------------------------------------------------------------------
// The cash curve
// ---------------------------------------------------------------------------

/** Mean cash in hand after each round: the overall line, and one persona's
 *  beside it when the designer picks one. Two series at most, both direct
 *  labelled, so identity never rests on colour alone. */
function cashChart(summary: SweepSummary, focus: PersonaSummary | null): HTMLElement {
  const overall = summary.overall.cashCurve;
  const series: { name: string; values: number[]; cls: string }[] = [
    { name: 'all personas', values: overall, cls: 'overall' },
  ];
  if (focus) series.push({ name: focus.persona, values: focus.cashCurve, cls: 'focus' });
  const rounds = Math.max(1, ...series.map((s) => s.values.length));
  const maxCash = Math.max(1, ...series.flatMap((s) => s.values));
  const W = 560;
  const H = 150;
  const padL = 46;
  const padR = 84;
  const padT = 10;
  const padB = 22;
  const x = (i: number): number => padL + ((W - padL - padR) * i) / Math.max(1, rounds - 1);
  const y = (v: number): number => padT + (H - padT - padB) * (1 - v / maxCash);
  const gridSteps = 3;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="ws-chart" role="img" aria-label="Mean cash in hand by round">`;
  for (let g = 0; g <= gridSteps; g++) {
    const v = (maxCash * g) / gridSteps;
    svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="ws-chart-grid"/>`;
    svg += `<text x="${padL - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" class="ws-chart-tick">${Math.round(v / 100) * 100 >= 1000 ? `${Math.round(v / 100) / 10}k` : Math.round(v)}</text>`;
  }
  for (let r = 0; r < rounds; r++) {
    svg += `<text x="${x(r).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ws-chart-tick">R${r + 1}</text>`;
  }
  // End labels are nudged apart when the two curves finish together — which
  // they do whenever only one persona is still running at the end, since the
  // overall mean IS that persona by then.
  let lastLabelY: number | null = null;
  for (const s of series) {
    if (s.values.length === 0) continue;
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polyline points="${pts}" class="ws-chart-line ${s.cls}"/>`;
    const lastI = s.values.length - 1;
    const dotY = y(s.values[lastI]);
    svg += `<circle cx="${x(lastI).toFixed(1)}" cy="${dotY.toFixed(1)}" r="4" class="ws-chart-dot ${s.cls}"/>`;
    let labelY = dotY + 4;
    if (lastLabelY !== null && Math.abs(labelY - lastLabelY) < 13) labelY = lastLabelY + 13;
    lastLabelY = labelY;
    svg += `<text x="${(x(lastI) + 8).toFixed(1)}" y="${labelY.toFixed(1)}" class="ws-chart-label">${s.name} ${money(s.values[lastI])}</text>`;
  }
  svg += '</svg>';
  return h('div', { className: 'ws-chart-wrap', html: svg });
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function resultsView(record: SweepRecord, compare: SweepRecord | null, rerender: () => void): HTMLElement {
  const s = record.summary;
  const o = s.overall;
  const b = compare?.summary.overall ?? null;
  const wrap = h('div', { className: 'ws-results' });

  // --- headline ---------------------------------------------------------
  const head = h('div', { className: 'ws-results-head' }, [
    h('div', {}, [
      h('strong', { text: `${s.campaigns} campaigns` }),
      h('span', { className: 'hint', text: ` · ${record.options.personas.length} personas × ${record.options.seeds} seeds · ${record.seconds}s · ${new Date(record.ranAt).toLocaleString()} · preset ${record.hash}` }),
    ]),
  ]);
  if (compare) {
    head.append(h('div', { className: 'hint', text: `Deltas read against the sweep of preset ${compare.hash} (${new Date(compare.ranAt).toLocaleString()}).` }));
  }
  wrap.append(head);

  const tiles = h('div', { className: 'ws-tiles' }, [
    tile('Won', pct(o.winRate), winTone(o.winRate), 'region cleared'),
    tile('Came through', pct(o.survivalRate), '', 'cleared or reached the cap'),
    tile('Rounds', `${o.meanRoundsSurvived}`, '', 'mean survived'),
    tile('Delivered', `${o.meanDeliveredPct}%`, '', 'mean per round'),
    tile('Hulls lost', `${o.meanLosses}`, '', 'mean per campaign'),
    tile('Cash at end', money(o.finalCash.mean), '', `${money(o.finalCash.min)} – ${money(o.finalCash.max)}`),
  ]);
  if (b) {
    const rows: [number, number, number, (v: number) => string, boolean][] = [
      [0, o.winRate, b.winRate, pct, true],
      [1, o.survivalRate, b.survivalRate, pct, true],
      [2, o.meanRoundsSurvived, b.meanRoundsSurvived, (v) => v.toFixed(1), true],
      [3, o.meanDeliveredPct, b.meanDeliveredPct, (v) => `${v.toFixed(1)}%`, true],
      [4, o.meanLosses, b.meanLosses, (v) => v.toFixed(1), false],
      [5, o.finalCash.mean, b.finalCash.mean, money, true],
    ];
    for (const [i, now, before, fmt, hib] of rows) tiles.children[i].append(delta(now, before, fmt, hib));
  }
  wrap.append(tiles);

  // --- how campaigns ended + signals -------------------------------------
  const ends = h('div', { className: 'ws-kv' });
  for (const [reason, n] of Object.entries(o.endReasons).sort((a, c) => c[1] - a[1])) {
    ends.append(h('div', { className: 'ws-kv-row' }, [h('span', { text: endReasonLabel(reason) }), h('span', { className: 'ws-mono', text: `${n} (${pct(n / s.campaigns)})` })]));
  }
  const sig = s.overall.signalPassRates;
  const sigTone = (v: number): string => (v >= 0.6 ? 'good' : v >= 0.3 ? 'warn' : 'bad');
  const signals = h('div', { className: 'ws-kv' }, [
    h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Oscillation — loss-cause mix shifts round to round' }), h('span', { className: `ws-badge ${sigTone(sig.oscillation)}`, text: pct(sig.oscillation) })]),
    h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Balance — delivery oscillates in band' }), h('span', { className: `ws-badge ${sigTone(sig.balance)}`, text: pct(sig.balance) })]),
    h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Scarcity — pressured, not overwhelmed' }), h('span', { className: `ws-badge ${sigTone(sig.scarcity)}`, text: pct(sig.scarcity) })]),
  ]);
  wrap.append(
    h('div', { className: 'ws-columns' }, [
      h('div', { className: 'ws-sub-panel' }, [h('h3', { text: 'How campaigns ended' }), ends]),
      h('div', { className: 'ws-sub-panel' }, [h('h3', { text: 'Seesaw signals (share of campaigns passing)' }), signals]),
    ]),
  );

  // --- per persona ------------------------------------------------------
  const table = h('table', { className: 'ws-table ws-sweep-table' });
  table.append(h('thead', {}, [h('tr', {}, ['Persona', 'Runs', 'Won', 'Through', 'Rounds', 'Deliv%', 'Lost', 'Score', 'Cash end', 'Hoard', 'Ended'].map((t) => h('th', { text: t })))]));
  const tbody = h('tbody');
  for (const p of s.personas) {
    const before = compare?.summary.personas.find((q) => q.persona === p.persona);
    const won = h('td', {}, [h('span', { className: `ws-badge ${winTone(p.winRate)}`, text: pct(p.winRate) })]);
    if (before) won.append(delta(p.winRate, before.winRate, pct));
    const cash = h('td', { text: money(p.finalCash.mean) });
    if (before) cash.append(delta(p.finalCash.mean, before.finalCash.mean, money));
    const ended = Object.entries(p.endReasons).sort((a, c) => c[1] - a[1]).map(([r, n]) => `${endReasonLabel(r)} ×${n}`).join(', ');
    const tr = h('tr', { className: sweep.focusPersona === p.persona ? 'selected' : '' }, [
      h('td', {}, [h('button', { className: 'ws-link', text: p.persona, onClick: () => { sweep.focusPersona = sweep.focusPersona === p.persona ? null : p.persona; rerender(); } })]),
      h('td', { text: `${p.campaigns}` }),
      won,
      h('td', { text: pct(p.survivalRate) }),
      h('td', { text: `${p.meanRoundsSurvived}` }),
      h('td', { text: `${p.meanDeliveredPct}` }),
      h('td', { text: `${p.meanLosses}` }),
      h('td', { text: `${p.meanScore}` }),
      cash,
      h('td', { text: pct(p.hoardRate) }),
      h('td', { className: 'ws-ended', text: ended }),
    ]);
    tbody.append(tr);
  }
  table.append(tbody);
  wrap.append(h('div', { className: 'ws-sub-panel' }, [
    h('h3', { text: 'By persona — tap a name to draw its money curve' }),
    h('div', { className: 'ws-scroll' }, [table]),
  ]));

  // --- money curve ------------------------------------------------------
  const focus = s.personas.find((p) => p.persona === sweep.focusPersona) ?? null;
  wrap.append(h('div', { className: 'ws-sub-panel' }, [
    h('h3', { text: 'Cash in hand after each round (mean of campaigns still running)' }),
    cashChart(s, focus),
    h('div', { className: 'ws-legend' }, [
      h('span', { className: 'ws-legend-item' }, [h('span', { className: 'ws-chart-swatch overall' }), h('span', { text: 'all personas' })]),
      ...(focus ? [h('span', { className: 'ws-legend-item' }, [h('span', { className: 'ws-chart-swatch focus' }), h('span', { text: focus.persona })])] : []),
    ]),
  ]));

  // --- losses + enemy economy -------------------------------------------
  const losses = h('div', { className: 'ws-kv' });
  const totalLosses = Object.values(o.lossesByBranch).reduce((a, c) => a + c, 0);
  for (const [branch, n] of Object.entries(o.lossesByBranch).sort((a, c) => c[1] - a[1])) {
    const name = (ENEMY_BRANCH_NAMES as Record<string, string>)[branch] ?? branch;
    losses.append(h('div', { className: 'ws-kv-row' }, [h('span', { text: name }), h('span', { className: 'ws-mono', text: `${n} (${totalLosses ? pct(n / totalLosses) : '0%'})` })]));
  }
  if (totalLosses === 0) losses.append(h('div', { className: 'hint', text: 'No hulls lost anywhere in the sweep.' }));
  const en = s.enemy;
  const enemy = h('div', { className: 'ws-kv' });
  if (en.campaignsInstrumented > 0) {
    enemy.append(
      h('div', { className: 'ws-kv-row' }, [h('span', { text: 'ROI response — poor branches cut next round' }), h('span', { className: 'ws-mono', text: pct(en.roiResponseRate) })]),
      h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Top-spend pivots per campaign' }), h('span', { className: 'ws-mono', text: `${en.meanPivotsPerCampaign}` })]),
      h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Budget scrapped (want low, not zero)' }), h('span', { className: `ws-badge ${en.meanScrapRate > 0.35 ? 'bad' : en.meanScrapRate > 0.15 ? 'warn' : 'good'}`, text: pct(en.meanScrapRate) })]),
      h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Final targeting rung (mean)' }), h('span', { className: 'ws-mono', text: `T${en.meanFinalTargetingTier}` })]),
      h('div', { className: 'ws-kv-row' }, [h('span', { text: 'Ever the top-spend branch' }), h('span', { className: 'ws-mono', text: Object.entries(en.topSpendBranches).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${(ENEMY_BRANCH_NAMES as Record<string, string>)[k] ?? k} (${n})`).join(', ') || 'none' })]),
    );
  } else enemy.append(h('div', { className: 'hint', text: 'Enemy economy was not instrumented in these campaigns.' }));
  wrap.append(
    h('div', { className: 'ws-columns' }, [
      h('div', { className: 'ws-sub-panel' }, [h('h3', { text: 'Losses by enemy branch' }), losses]),
      h('div', { className: 'ws-sub-panel' }, [h('h3', { text: 'Enemy economy (measured)' }), enemy]),
    ]),
  );

  // --- findings ---------------------------------------------------------
  if (s.findings.length > 0) {
    wrap.append(h('div', { className: 'ws-sub-panel' }, [
      h('h3', { text: 'Findings' }),
      h('ol', { className: 'ws-findings' }, s.findings.map((f) => h('li', { text: f }))),
    ]));
  }
  wrap.append(h('div', { className: 'hint', text: `Could not measure: ${s.instrumentationNotes.join(' · ')}` }));
  return wrap;
}

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export function sweepPanel(
  def: RegionAuthoringDef,
  valid: boolean,
  rerender: () => void,
): HTMLElement {
  resetFor(def.id);
  const panel = h('div', { className: 'panel ws-panel ws-sweep', attrs: { 'data-sweep': sweep.running ? 'running' : 'idle' } }, [
    h('div', { className: 'ws-panel-head' }, [
      h('h2', { text: 'Balance sweep' }),
      h('span', { className: 'hint', text: 'Bot personas play the region headlessly, many seeds each. Statistical, not qualitative.' }),
    ]),
  ]);

  // --- controls -----------------------------------------------------------
  const seeds = document.createElement('input');
  seeds.type = 'number';
  seeds.min = '1';
  seeds.className = 'ws-input ws-num';
  seeds.style.width = '70px';
  seeds.value = String(sweep.seeds);
  seeds.disabled = sweep.running;
  seeds.addEventListener('change', () => { sweep.seeds = Math.max(1, Math.floor(Number(seeds.value) || DEFAULT_SEEDS)); });
  const rounds = document.createElement('input');
  rounds.type = 'number';
  rounds.min = '0';
  rounds.className = 'ws-input ws-num';
  rounds.style.width = '70px';
  rounds.value = String(sweep.rounds);
  rounds.disabled = sweep.running;
  rounds.addEventListener('change', () => { sweep.rounds = Math.max(0, Math.floor(Number(rounds.value) || 0)); });

  const personaBox = h('div', { className: 'ws-personas' });
  for (const p of PERSONAS) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = sweep.personas.has(p.name);
    cb.disabled = sweep.running;
    cb.addEventListener('change', () => {
      if (cb.checked) sweep.personas.add(p.name); else sweep.personas.delete(p.name);
      count.textContent = countText();
    });
    const label = h('label', { className: 'ws-persona' }, [cb, h('span', { text: p.name })]);
    label.title = p.desc;
    personaBox.append(label);
  }
  const countText = (): string => `${sweep.personas.size} persona${sweep.personas.size === 1 ? '' : 's'} × ${sweep.seeds} seeds = ${sweep.personas.size * sweep.seeds} campaigns`;
  const count = h('span', { className: 'hint ws-count', text: countText() });
  seeds.addEventListener('change', () => (count.textContent = countText()));

  panel.append(
    h('div', { className: 'ws-sweep-controls' }, [
      h('label', { className: 'ws-field ws-inline' }, [h('span', { className: 'ws-field-label', text: 'Seeds per persona' }), seeds]),
      h('label', { className: 'ws-field ws-inline' }, [h('span', { className: 'ws-field-label', text: 'Round cap (0 = region)' }), rounds]),
      h('div', { className: 'ws-actions' }, [
        h('button', { text: 'All', disabled: sweep.running, onClick: () => { for (const p of PERSONAS) sweep.personas.add(p.name); rerender(); } }),
        h('button', { text: 'None', disabled: sweep.running, onClick: () => { sweep.personas.clear(); rerender(); } }),
      ]),
    ]),
    personaBox,
    h('div', { className: 'ws-actions' }, [
      sweep.running
        ? h('button', { className: 'danger', text: 'Stop', onClick: () => cancelSweep() })
        : h('button', {
            className: 'primary',
            text: 'Run sweep',
            disabled: !valid,
            onClick: () => startSweep(def, def.name, rerender),
          }),
      count,
      ...(!valid ? [h('span', { className: 'ws-bad', text: 'Fix the validation errors first — an unplayable region cannot be swept.' })] : []),
    ]),
  );

  // --- progress -----------------------------------------------------------
  if (sweep.running && sweep.progress) {
    const p = sweep.progress;
    const frac = p.total > 0 ? p.done / p.total : 0;
    const elapsed = (Date.now() - sweep.startedAt) / 1000;
    const eta = p.done > 0 ? Math.round((elapsed / p.done) * (p.total - p.done)) : null;
    panel.append(
      h('div', { className: 'ws-progress' }, [
        h('div', { className: 'bar' }, [(() => { const f = h('div', { className: 'fill' }); f.style.width = `${Math.round(frac * 100)}%`; return f; })()]),
        h('div', { className: 'hint', text: `${p.done}/${p.total} campaigns · ${p.line}${eta !== null ? ` · ~${eta}s left` : ''}` }),
      ]),
    );
  }
  if (sweep.error) panel.append(h('div', { className: 'ws-bad', text: sweep.error }));

  // --- results + history ----------------------------------------------------
  const history = listSweeps(def.id);
  const liveHash = contentHash(def);
  if (sweep.current) {
    if (sweep.current.hash !== liveHash) {
      panel.append(h('div', { className: 'hint ws-notice', text: 'This result is for an earlier version of the preset; the region has been edited since. Run the sweep again to measure the current timeline.' }));
    }
    panel.append(resultsView(sweep.current, sweep.compare, rerender));
    panel.append(
      h('div', { className: 'ws-actions' }, [
        h('button', {
          text: 'Export result JSON',
          onClick: () => {
            const blob = new Blob([JSON.stringify(sweep.current, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sweep-${def.id}-${sweep.current!.hash}.json`;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 4000);
          },
        }),
        h('button', {
          text: 'Copy result JSON',
          onClick: () => {
            navigator.clipboard?.writeText(JSON.stringify(sweep.current, null, 2)).then(() => {
              sweep.error = 'Sweep result copied — paste it into a Claude session alongside the preset.';
              rerender();
            });
          },
        }),
      ]),
    );
  } else if (!sweep.running) {
    panel.append(h('div', { className: 'hint', text: 'No sweep yet for this region.' }));
  }

  if (history.length > 0) {
    const list = h('div', { className: 'ws-history' });
    for (const rec of history) {
      const isCurrent = sweep.current === rec || (sweep.current?.ranAt === rec.ranAt && sweep.current?.hash === rec.hash);
      const isCompare = sweep.compare?.ranAt === rec.ranAt && sweep.compare?.hash === rec.hash;
      list.append(
        h('div', { className: `ws-history-row ${isCurrent ? 'current' : ''} ${isCompare ? 'compare' : ''}` }, [
          h('span', { className: 'ws-mono', text: rec.hash === liveHash ? `${rec.hash} (current preset)` : rec.hash }),
          h('span', { className: 'hint', text: `${new Date(rec.ranAt).toLocaleString()} · ${rec.summary.campaigns} campaigns · won ${pct(rec.summary.overall.winRate)} · cash ${money(rec.summary.overall.finalCash.mean)}` }),
          h('div', { className: 'ws-row-actions' }, [
            h('button', { text: isCurrent ? 'Showing' : 'Show', disabled: isCurrent, onClick: () => { sweep.current = rec; if (sweep.compare === rec) sweep.compare = null; rerender(); } }),
            h('button', { text: isCompare ? 'Comparing' : 'Compare', disabled: isCurrent, onClick: () => { sweep.compare = isCompare ? null : rec; rerender(); } }),
          ]),
        ]),
      );
    }
    panel.append(
      h('div', { className: 'ws-sub-panel' }, [
        h('div', { className: 'ws-panel-head' }, [
          h('h3', { text: `History (${history.length}, kept with this region)` }),
          h('button', { className: 'danger', text: 'Clear history', onClick: () => { if (confirm('Delete every saved sweep for this region?')) { deleteSweeps(def.id); sweep.current = null; sweep.compare = null; rerender(); } } }),
        ]),
        list,
      ]),
    );
  }
  return panel;
}
