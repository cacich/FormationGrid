import { nextDoubleDeduction, touching, unitsFor } from './double-logic.ts';
import type { CellState, Deduction } from './types.ts';

type Grid = { regions: number[][]; blocked?: number[] };

// Solves by repeated human-style deductions only; unsolved means guessing is needed.
export function logicalDoubleSolve(grid: Grid) {
  const n = grid.regions.length,
    puzzle = { regions: grid.regions, cowsPerUnit: 2 as const },
    board = Array<CellState>(n * n).fill(0),
    steps: Deduction[] = [];
  for (const cell of grid.blocked ?? []) board[cell] = 1;
  for (let i = 0; i < n * n * 2; i++) {
    if (board.filter((v) => v === 2).length === n * 2) break;
    const step = nextDoubleDeduction(puzzle, board);
    if (!step) break;
    for (const cell of step.cells) board[cell] = step.value;
    steps.push(step);
  }
  const units = board.flatMap((v, i) => (v === 2 ? [i] : []));
  const solved =
    units.length === n * 2 &&
    unitsFor(puzzle).every((u) => u.filter((i) => board[i] === 2).length === 2) &&
    units.every((a) => units.every((b) => !touching(a, b, n)));
  const tier = Math.max(0, ...steps.map((s) => s.tier));
  return {
    solved,
    board,
    steps,
    tier,
    score: tier * 100 + steps.reduce((sum, s) => sum + [0, 1, 7, 18, 30][s.tier], 0),
  };
}

// Canonical region shape under the 8 rotations/mirrors, for duplicate detection.
export function gridFingerprint(regions: number[][]) {
  const n = regions.length,
    shapes: string[] = [];
  for (let mirror = 0; mirror < 2; mirror++)
    for (let rotation = 0; rotation < 4; rotation++) {
      const labels = new Map<number, number>();
      shapes.push(
        regions
          .flatMap((row, r) =>
            row.map((_, c) => {
              let y = r,
                x = mirror ? n - 1 - c : c;
              for (let t = 0; t < rotation; t++) [y, x] = [x, n - 1 - y];
              const z = regions[y][x];
              if (!labels.has(z)) labels.set(z, labels.size);
              return labels.get(z);
            }),
          )
          .join(','),
      );
    }
  return shapes.sort()[0];
}
