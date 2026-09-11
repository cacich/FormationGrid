import type { CellState, Deduction } from './types.ts';

export type DoublePuzzle = {
  regions: number[][];
  solution: number[][];
  cowsPerUnit: 2;
};
type RegionGrid = {
  regions: number[][];
  cowsPerUnit?: 1 | 2;
  regionQuotas?: number[];
  blocked?: number[];
};
export const unitQuota = (puzzle: RegionGrid, unit: number) =>
  unit < puzzle.regions.length * 2
    ? (puzzle.cowsPerUnit ?? 1)
    : (puzzle.regionQuotas?.[unit - puzzle.regions.length * 2] ??
      puzzle.cowsPerUnit ??
      1);
export function unitsFor(puzzle: RegionGrid) {
  const n = puzzle.regions.length,
    cells = Array.from({ length: n * n }, (_, i) => i);
  return [
    ...Array.from({ length: n }, (_, r) =>
      cells.filter((i) => Math.floor(i / n) === r),
    ),
    ...Array.from({ length: n }, (_, c) => cells.filter((i) => i % n === c)),
    ...Array.from({ length: Math.max(...puzzle.regions.flat()) + 1 }, (_, z) =>
      cells.filter((i) => puzzle.regions[Math.floor(i / n)][i % n] === z),
    ),
  ];
}
export const touching = (a: number, b: number, n: number) =>
  a !== b &&
  Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1 &&
  Math.abs((a % n) - (b % n)) <= 1;

// Enumerate row pairs, tracking independent column/region quotas and neighbor masks.
// A budget failure is an error, NEVER evidence that a puzzle has a unique solution.
export function doubleSolutions(
  puzzle: RegionGrid,
  limit = 2,
  board?: CellState[],
  budget = 2000000,
): number[][][] {
  const n = puzzle.regions.length,
    results: number[][][] = [];
  const options = Array.from({ length: n }, (_, r) => {
    const pairs: {
      a: number;
      b: number;
      mask: number;
      za: number;
      zb: number;
    }[] = [];
    for (let a = 0; a < n; a++)
      for (let b = a + 2; b < n; b++) {
        if (
          puzzle.blocked?.includes(r * n + a) ||
          puzzle.blocked?.includes(r * n + b)
        )
          continue;
        if (
          board &&
          (board[r * n + a] === 1 ||
            board[r * n + b] === 1 ||
            board.some(
              (v, i) =>
                v === 2 &&
                Math.floor(i / n) === r &&
                i % n !== a &&
                i % n !== b,
            ))
        )
          continue;
        pairs.push({
          a,
          b,
          mask: (1 << a) | (1 << b),
          za: puzzle.regions[r][a],
          zb: puzzle.regions[r][b],
        });
      }
    return pairs;
  });
  const columns = Array(n).fill(0),
    regions = Array(n).fill(0),
    solution: number[][] = [];
  let nodes = 0;
  function visit(row: number, previous: number) {
    if (++nodes > budget) throw new Error('Double-cow search budget exceeded');
    if (row === n) {
      if (columns.every((v) => v === 2) && regions.every((v) => v === 2))
        results.push(solution.map((p) => [...p]));
      return;
    }
    const blocked = previous | (previous << 1) | (previous >> 1);
    for (const p of options[row]) {
      if (
        p.mask & blocked ||
        columns[p.a] >= 2 ||
        columns[p.b] >= 2 ||
        regions[p.za] >= 2 ||
        regions[p.zb] >= 2 ||
        (p.za === p.zb && regions[p.za] > 0)
      )
        continue;
      columns[p.a]++;
      columns[p.b]++;
      regions[p.za]++;
      regions[p.zb]++;
      // Each future row contributes at most one cow to any column, and at most two to a region.
      let possible = true;
      for (let c = 0; c < n && possible; c++) {
        const remaining = n - row - 1 - (p.mask & (1 << c) ? 1 : 0);
        if (2 - columns[c] > Math.ceil(Math.max(0, remaining) / 2))
          possible = false;
      }
      if (possible) {
        const colCapacity = Array(n).fill(0),
          regionCapacity = Array(n).fill(0);
        for (let r = row + 1; r < n; r++) {
          const viable = options[r].filter(
            (q) =>
              !(
                r === row + 1 &&
                q.mask & (p.mask | (p.mask << 1) | (p.mask >> 1))
              ) &&
              columns[q.a] < 2 &&
              columns[q.b] < 2 &&
              regions[q.za] < 2 &&
              regions[q.zb] < 2 &&
              !(q.za === q.zb && regions[q.za] > 0),
          );
          if (!viable.length) {
            possible = false;
            break;
          }
          for (let z = 0; z < n; z++) {
            if (viable.some((q) => q.a === z || q.b === z)) colCapacity[z]++;
            regionCapacity[z] += viable.some((q) => q.za === z && q.zb === z)
              ? 2
              : viable.some((q) => q.za === z || q.zb === z)
                ? 1
                : 0;
          }
        }
        for (let z = 0; z < n && possible; z++)
          if (
            columns[z] + colCapacity[z] < 2 ||
            regions[z] + regionCapacity[z] < 2
          )
            possible = false;
      }
      if (possible) {
        solution.push([p.a, p.b]);
        visit(row + 1, p.mask);
        solution.pop();
      }
      columns[p.a]--;
      columns[p.b]--;
      regions[p.za]--;
      regions[p.zb]--;
      if (results.length >= limit) return;
    }
  }
  visit(0, 0);
  return results;
}

export function nextDoubleDeduction(
  puzzle: RegionGrid,
  board: CellState[],
): Deduction | null {
  const n = puzzle.regions.length,
    units = unitsFor(puzzle),
    bulls = board.flatMap((v, i) => (v === 2 ? [i] : []));
  const ids = board.map((_, i) => i),
    unknown = ids.filter((i) => board[i] === 0);
  const groupsOf = (i: number) => [
    Math.floor(i / n),
    n + (i % n),
    n * 2 + puzzle.regions[Math.floor(i / n)][i % n],
  ];
  const counts = units.map((u) => u.filter((i) => board[i] === 2).length);
  const label = (u: number) =>
    `第 ${(u % n) + 1} ${u < n ? '列' : u < n * 2 ? '欄' : '陣地'}`;
  const adjacent = unknown.filter((i) => bulls.some((b) => touching(i, b, n)));
  if (adjacent.length)
    return {
      cells: adjacent,
      value: 1,
      tier: 0,
      focus: bulls,
      reason: '單位不能相鄰，斜角也不行。已有單位周圍的空格都能排除。',
    };
  for (let u = 0; u < units.length; u++) {
    const cells = units[u].filter((i) => board[i] === 0);
    if (counts[u] === unitQuota(puzzle, u) && cells.length)
      return {
        cells,
        value: 1,
        tier: 0,
        focus: units[u].filter((i) => board[i] === 2),
        reason: `${label(u)}已放滿 ${unitQuota(puzzle, u)} 個單位，其餘位置都能排除。`,
      };
  }
  const legalAddition = (cells: number[]) => {
    const extra = Array(units.length).fill(0);
    for (let k = 0; k < cells.length; k++) {
      const i = cells[k];
      if (
        bulls.some((b) => touching(i, b, n)) ||
        cells.slice(0, k).some((b) => touching(i, b, n))
      )
        return false;
      for (const u of groupsOf(i))
        if (++extra[u] + counts[u] > unitQuota(puzzle, u)) return false;
    }
    return true;
  };
  for (let u = 0; u < units.length; u++) {
    const needed = unitQuota(puzzle, u) - counts[u];
    if (needed <= 0) continue;
    const candidates = units[u].filter((i) => board[i] === 0),
      options: number[][] = [];
    if (needed === 1)
      for (const a of candidates) {
        if (legalAddition([a])) options.push([a]);
      }
    else
      for (let a = 0; a < candidates.length; a++)
        for (let b = a + 1; b < candidates.length; b++) {
          if (legalAddition([candidates[a], candidates[b]]))
            options.push([candidates[a], candidates[b]]);
        }
    if (!options.length) continue;
    const forced = candidates.filter((i) =>
      options.every((option) => option.includes(i)),
    );
    if (forced.length)
      return {
        cells: forced,
        value: 2,
        tier: 1,
        focus: candidates,
        reason: `${label(u)}還缺 ${needed} 個單位。考慮不能相鄰與每區上限後，每種可行擺法都包含亮起的位置。`,
      };
    const excluded = unknown.filter((i) =>
      options.every(
        (option) => !option.includes(i) && !legalAddition([...option, i]),
      ),
    );
    if (excluded.length)
      return {
        cells: excluded,
        value: 1,
        tier: 2,
        focus: candidates,
        reason: `${label(u)}還缺 ${needed} 個單位。不論採用哪種可行擺法，亮起的格子都會相鄰或超過列、欄、陣地的上限，因此可以排除。`,
      };
  }
  return null;
}
