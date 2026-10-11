/**
 * Walkable grid and A* pathfinding for the avatar in homes and venues. Pure functions, no rendering.
 * Positions are world X/Z; the grid covers a rectangle split into square cells.
 */
export interface NavGrid {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originZ: number;
  blocked: Uint8Array;
}

export type P2 = [number, number];

export function makeGrid(width: number, depth: number, cell: number, originX = -width / 2, originZ = -depth / 2): NavGrid {
  const cols = Math.max(1, Math.round(width / cell));
  const rows = Math.max(1, Math.round(depth / cell));
  return { cols, rows, cell, originX, originZ, blocked: new Uint8Array(cols * rows) };
}

export const inside = (g: NavGrid, i: number, j: number) => i >= 0 && j >= 0 && i < g.cols && j < g.rows;
export const isBlocked = (g: NavGrid, i: number, j: number) => !inside(g, i, j) || g.blocked[j * g.cols + i] === 1;

export function toCell(g: NavGrid, x: number, z: number): P2 {
  return [Math.floor((x - g.originX) / g.cell), Math.floor((z - g.originZ) / g.cell)];
}

export function cellCentre(g: NavGrid, i: number, j: number): P2 {
  return [g.originX + (i + 0.5) * g.cell, g.originZ + (j + 0.5) * g.cell];
}

/** Marks every cell whose centre lies inside the world rectangle (with an optional margin) as blocked. */
export function blockRect(g: NavGrid, x0: number, z0: number, x1: number, z1: number, margin = 0) {
  const [ax, bx] = [Math.min(x0, x1) - margin, Math.max(x0, x1) + margin];
  const [az, bz] = [Math.min(z0, z1) - margin, Math.max(z0, z1) + margin];
  for (let j = 0; j < g.rows; j++)
    for (let i = 0; i < g.cols; i++) {
      const [cx, cz] = cellCentre(g, i, j);
      if (cx > ax && cx < bx && cz > az && cz < bz) g.blocked[j * g.cols + i] = 1;
    }
}

/** Nearest walkable cell to (i, j) by breadth-first search, or null if the grid is full. */
export function nearestFree(g: NavGrid, i: number, j: number): P2 | null {
  const ci = Math.min(g.cols - 1, Math.max(0, i));
  const cj = Math.min(g.rows - 1, Math.max(0, j));
  if (!isBlocked(g, ci, cj)) return [ci, cj];
  const seen = new Uint8Array(g.cols * g.rows);
  const q: P2[] = [[ci, cj]];
  seen[cj * g.cols + ci] = 1;
  while (q.length) {
    const [a, b] = q.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = a + di;
      const nj = b + dj;
      if (!inside(g, ni, nj) || seen[nj * g.cols + ni]) continue;
      if (!isBlocked(g, ni, nj)) return [ni, nj];
      seen[nj * g.cols + ni] = 1;
      q.push([ni, nj]);
    }
  }
  return null;
}

/** True when a straight walk between two world points stays on walkable cells. */
export function lineClear(g: NavGrid, a: P2, b: P2): boolean {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const steps = Math.max(1, Math.ceil(dist / (g.cell * 0.25)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const [i, j] = toCell(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    if (isBlocked(g, i, j)) return false;
  }
  return true;
}

/**
 * Shortest 8-way path between two world points (no corner cutting), smoothed by line of sight.
 * Start and goal snap to the nearest walkable cell. Returns waypoints after the start, ending at the
 * goal itself when it is walkable (or the nearest walkable cell centre otherwise). Empty when unreachable.
 */
export function findPath(g: NavGrid, from: P2, to: P2): P2[] {
  const s = nearestFree(g, ...toCell(g, from[0], from[1]));
  const goalCell = toCell(g, to[0], to[1]);
  const e = nearestFree(g, goalCell[0], goalCell[1]);
  if (!s || !e) return [];
  const goalExact = !isBlocked(g, goalCell[0], goalCell[1]);
  const end: P2 = goalExact ? to : cellCentre(g, e[0], e[1]);
  if (s[0] === e[0] && s[1] === e[1]) return [end];

  const n = g.cols * g.rows;
  const gScore = new Float64Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const idx = (i: number, j: number) => j * g.cols + i;
  const h = (i: number, j: number) => {
    const dx = Math.abs(i - e[0]);
    const dy = Math.abs(j - e[1]);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  // Binary heap of [f, index].
  const heap: [number, number][] = [];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };

  const start = idx(s[0], s[1]);
  const goal = idx(e[0], e[1]);
  gScore[start] = 0;
  push(h(s[0], s[1]), start);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    if (k === goal) break;
    closed[k] = 1;
    const ci = k % g.cols;
    const cj = (k - ci) / g.cols;
    for (const [di, dj] of dirs) {
      const ni = ci + di;
      const nj = cj + dj;
      if (isBlocked(g, ni, nj)) continue;
      if (di && dj && (isBlocked(g, ci + di, cj) || isBlocked(g, ci, cj + dj))) continue;
      const nk = idx(ni, nj);
      const cost = gScore[k] + (di && dj ? Math.SQRT2 : 1);
      if (cost < gScore[nk]) {
        gScore[nk] = cost;
        came[nk] = k;
        push(cost + h(ni, nj), nk);
      }
    }
  }
  if (came[goal] === -1) return [];

  const cells: P2[] = [];
  for (let k = goal; k !== start; k = came[k]) {
    const i = k % g.cols;
    cells.push(cellCentre(g, i, (k - i) / g.cols));
  }
  cells.reverse();
  cells[cells.length - 1] = end;

  // String-pull: keep only the waypoints needed to stay on walkable cells.
  const out: P2[] = [];
  let anchor: P2 = from;
  const fromCell = toCell(g, from[0], from[1]);
  if (isBlocked(g, fromCell[0], fromCell[1])) {
    // Starting inside an obstacle (e.g. getting off a bed): step out to the snapped cell first.
    anchor = cellCentre(g, s[0], s[1]);
    out.push(anchor);
  }
  for (let i = 0; i < cells.length; i++) {
    const next = cells[i + 1];
    if (next && lineClear(g, anchor, next)) continue;
    out.push(cells[i]);
    anchor = cells[i];
  }
  return out;
}
