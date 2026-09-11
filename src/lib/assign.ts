import {
  DIRS,
  UNIT_IDS,
  coverage,
  type Dir,
  type Piece,
  type UnitId,
} from './units.ts';

export type AssignLevel = {
  regions: number[][];
  solution: number[][];
  enemies: number[];
  quotas: number[];
};
export type Constraint = { unit?: UnitId; dir?: Dir };

export const solutionCells = (level: Pick<AssignLevel, 'regions' | 'solution'>) =>
  level.solution.flatMap((cols, r) =>
    cols.map((c) => r * level.regions.length + c),
  );

type Option = { unit: UnitId; dir: Dir; hits: number[] };

// Finds a unit type and facing for every solution cell so that all enemies are
// covered and each type is used exactly its quota. Constraints pin cells the
// player already decided. Returns null when no such assignment exists.
export function solveAssignment(
  level: AssignLevel,
  fixed: ReadonlyMap<number, Constraint> = new Map(),
  budget = 500000,
): Map<number, Piece> | null {
  const n = level.regions.length,
    cells = solutionCells(level),
    enemyIndex = new Map(level.enemies.map((e, i) => [e, i])),
    remaining = [...level.quotas];
  if (remaining.reduce((a, b) => a + b, 0) !== cells.length) return null;
  for (const [cell, c] of fixed)
    if (cells.includes(cell) && c.unit !== undefined && --remaining[c.unit] < 0)
      return null;
  const pinnedUnit = cells.map((cell) => fixed.get(cell)?.unit !== undefined);
  const options: Option[][] = cells.map((cell) => {
    const f = fixed.get(cell) ?? {},
      list: Option[] = [];
    for (const unit of UNIT_IDS) {
      if (f.unit === undefined ? level.quotas[unit] === 0 : f.unit !== unit)
        continue;
      for (const dir of DIRS)
        if (f.dir === undefined || f.dir === dir)
          list.push({
            unit,
            dir,
            hits: coverage(cell, unit, dir, n).flatMap((x) =>
              enemyIndex.has(x) ? [enemyIndex.get(x)!] : [],
            ),
          });
    }
    return list;
  });
  const cover = Array<number>(level.enemies.length).fill(0),
    chosen: (Option | null)[] = cells.map(() => null);
  const place = (k: number, option: Option, delta: 1 | -1) => {
    chosen[k] = delta > 0 ? option : null;
    for (const h of option.hits) cover[h] += delta;
    if (!pinnedUnit[k]) remaining[option.unit] -= delta;
  };
  // Fully pinned cells contribute their coverage up front.
  cells.forEach((_, k) => {
    if (pinnedUnit[k] && options[k].length === 1) place(k, options[k][0], 1);
  });
  let nodes = 0;
  function search(): boolean {
    if (++nodes > budget) throw new Error('Assignment search budget exceeded');
    let best: [number, Option][] | null = null;
    for (let e = 0; e < cover.length; e++) {
      if (cover[e]) continue;
      const list: [number, Option][] = [];
      for (let k = 0; k < cells.length; k++) {
        if (chosen[k]) continue;
        for (const option of options[k])
          if (
            option.hits.includes(e) &&
            (pinnedUnit[k] || remaining[option.unit] > 0)
          )
            list.push([k, option]);
      }
      if (!list.length) return false;
      if (!best || list.length < best.length) best = list;
    }
    if (!best) return true;
    for (const [k, option] of best) {
      place(k, option, 1);
      if (search()) return true;
      place(k, option, -1);
    }
    return false;
  }
  if (cells.some((_, k) => !options[k].length) || !search()) return null;
  const result = new Map<number, Piece>();
  cells.forEach((cell, k) => {
    const option = chosen[k];
    if (option) {
      result.set(cell, { unit: option.unit, dir: option.dir });
      return;
    }
    const f = fixed.get(cell) ?? {};
    let unit = f.unit;
    if (unit === undefined) {
      unit = UNIT_IDS.find((u) => remaining[u] > 0)!;
      remaining[unit]--;
    }
    result.set(cell, { unit, dir: f.dir ?? 0 });
  });
  return result;
}
