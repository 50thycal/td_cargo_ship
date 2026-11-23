// Small table helpers shared by every Region Workshop table: tap a header to
// sort (tap again to flip), and a frozen first column so the row's name stays
// on screen while a phone scrolls the numbers sideways.
//
// Cells sort by their `data-sort` attribute when present (so a cell can show
// "5 salvo" and sort as 5), otherwise by their text; numbers compare as
// numbers. The chosen sort is remembered per table id, so a table that is
// rebuilt on every edit keeps its order.

export interface SortState {
  col: number;
  dir: 1 | -1;
}

const sorts = new Map<string, SortState>();

function cellKey(row: HTMLTableRowElement, col: number): string {
  const cell = row.cells[col];
  if (!cell) return '';
  return cell.getAttribute('data-sort') ?? cell.textContent?.trim() ?? '';
}

function compare(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  const aNum = a !== '' && Number.isFinite(na);
  const bNum = b !== '' && Number.isFinite(nb);
  if (aNum && bNum) return na - nb;
  // Blank cells sink to the bottom whichever way the column is sorted.
  if (a === '' && b !== '') return 1;
  if (b === '' && a !== '') return -1;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.localeCompare(b, undefined, { numeric: true });
}

/** Make `table` sortable by its header cells and (by default) freeze its first
 *  column. Headers marked `data-nosort` stay plain. */
export function enhanceTable(
  table: HTMLTableElement,
  id: string,
  opts: { freeze?: boolean } = {},
): void {
  table.classList.add('tk-table');
  if (opts.freeze !== false) table.classList.add('tk-freeze');
  const head = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!head || !body) return;
  const original = [...body.rows];
  original.forEach((r, i) => r.setAttribute('data-order', String(i)));

  const apply = () => {
    const st = sorts.get(id);
    const rows = [...body.rows];
    rows.sort((a, b) => {
      if (st) {
        const c = compare(cellKey(a, st.col), cellKey(b, st.col));
        const blankA = cellKey(a, st.col) === '';
        const blankB = cellKey(b, st.col) === '';
        if (c !== 0) return blankA !== blankB ? c : c * st.dir;
      }
      return Number(a.getAttribute('data-order')) - Number(b.getAttribute('data-order'));
    });
    for (const r of rows) body.append(r);
    [...head.cells].forEach((th, i) => {
      if (th.hasAttribute('data-nosort')) return;
      const on = st?.col === i;
      th.setAttribute('aria-sort', on ? (st!.dir === 1 ? 'ascending' : 'descending') : 'none');
      const ind = th.querySelector('.tk-ind');
      if (ind) ind.textContent = on ? (st!.dir === 1 ? '▲' : '▼') : '↕';
    });
  };

  [...head.cells].forEach((th, i) => {
    if (th.hasAttribute('data-nosort')) return;
    th.classList.add('tk-sortable');
    th.setAttribute('role', 'button');
    th.setAttribute('tabindex', '0');
    th.title = 'Sort by this column';
    const ind = document.createElement('span');
    ind.className = 'tk-ind';
    th.append(ind);
    const toggle = () => {
      const st = sorts.get(id);
      if (!st || st.col !== i) sorts.set(id, { col: i, dir: 1 });
      else if (st.dir === 1) sorts.set(id, { col: i, dir: -1 });
      else sorts.delete(id); // third tap: back to the natural order
      apply();
    };
    th.addEventListener('click', toggle);
    th.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        toggle();
      }
    });
  });
  apply();
}
