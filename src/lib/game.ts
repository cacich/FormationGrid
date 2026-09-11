import { touching, unitsFor } from './double-logic.ts';
import { solutionCells } from './assign.ts';
import { coverage, decodePiece, UNITS, type Piece } from './units.ts';
import type { CellState } from './types.ts';

export type Level = {
  id: string;
  source: string;
  regions: number[][];
  solution: number[][];
  cowsPerUnit: 2;
  enemies: number[];
  quotas: number[];
  // One verified answer, as piece codes in solution-cell order.
  answer: string[];
};

// Board cells: '' empty, 'x' exclusion note, 'o' placeholder (a unit of undecided
// type), otherwise a piece code like 'A2'.
export type Board = string[];
export const NOTE = 'x';
export const MARK = 'o';
// Placeholders count as units for positions, but not for quotas or coverage.
export const occupies = (code: string) => code === MARK || decodePiece(code) !== null;
const occupiedCells = (board: Board) => board.flatMap((code, i) => (occupies(code) ? [i] : []));
export const emptyBoard = (size: number): Board => Array(size * size).fill('');

export const puzzleOf = (level: Level) => ({
  regions: level.regions,
  cowsPerUnit: 2 as const,
  blocked: level.enemies,
});

export function piecesOf(board: Board) {
  const pieces: [number, Piece][] = [];
  board.forEach((code, i) => {
    const piece = decodePiece(code);
    if (piece) pieces.push([i, piece]);
  });
  return pieces;
}

export function usedCounts(board: Board) {
  const counts = UNITS.map(() => 0);
  for (const [, piece] of piecesOf(board)) counts[piece.unit]++;
  return counts;
}

export function coveredCells(level: Level, board: Board) {
  const n = level.regions.length,
    covered = new Set<number>();
  for (const [i, piece] of piecesOf(board))
    for (const cell of coverage(i, piece.unit, piece.dir, n)) covered.add(cell);
  return covered;
}

export function conflictsFor(level: Level, board: Board) {
  const n = level.regions.length,
    occupied = occupiedCells(board),
    bad = new Set<number>(),
    enemies = new Set(level.enemies);
  for (const i of occupied) if (enemies.has(i)) bad.add(i);
  for (let a = 0; a < occupied.length; a++)
    for (let b = a + 1; b < occupied.length; b++)
      if (touching(occupied[a], occupied[b], n)) {
        bad.add(occupied[a]);
        bad.add(occupied[b]);
      }
  for (const unit of unitsFor(level)) {
    const placed = unit.filter((i) => occupies(board[i]));
    if (placed.length > 2) placed.forEach((i) => bad.add(i));
  }
  const counts = usedCounts(board);
  for (const [i, piece] of piecesOf(board))
    if (counts[piece.unit] > level.quotas[piece.unit]) bad.add(i);
  return bad;
}

export function isSolved(level: Level, board: Board) {
  const counts = usedCounts(board),
    covered = coveredCells(level, board);
  return (
    counts.every((c, u) => c === level.quotas[u]) &&
    conflictsFor(level, board).size === 0 &&
    level.enemies.every((e) => covered.has(e))
  );
}

// Position-layer view for the double-grid solver; enemies count as excluded.
export function positionBoard(level: Level, board: Board, auto?: Set<number>) {
  const enemies = new Set(level.enemies);
  return board.map(
    (code, i): CellState =>
      occupies(code)
        ? 2
        : enemies.has(i) || code === NOTE || auto?.has(i)
          ? 1
          : 0,
  );
}

// Derived notes: neighbors of units, and full rows/columns/regions. Never saved.
export function automaticExclusions(level: Level, board: Board, enabled = true) {
  const excluded = new Set<number>();
  if (!enabled) return excluded;
  const n = level.regions.length,
    enemies = new Set(level.enemies),
    units = occupiedCells(board),
    free = (i: number) => board[i] === '' && !enemies.has(i);
  for (let i = 0; i < board.length; i++)
    if (free(i) && units.some((u) => touching(u, i, n))) excluded.add(i);
  for (const unit of unitsFor(level))
    if (unit.filter((i) => occupies(board[i])).length >= 2)
      unit.forEach((i) => free(i) && excluded.add(i));
  return excluded;
}

export const answerBoard = (level: Level): Board => {
  const board = emptyBoard(level.regions.length);
  solutionCells(level).forEach((cell, k) => (board[cell] = level.answer[k]));
  return board;
};
