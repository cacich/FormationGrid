import { nextDoubleDeduction } from './double-logic.ts';
import { solveAssignment, solutionCells, type Constraint } from './assign.ts';
import { MARK, NOTE, occupies, piecesOf, positionBoard, type Board, type Level } from './game.ts';
import { DIR_NAMES, UNITS, decodePiece, encodePiece, type Piece } from './units.ts';

export type Hint = {
  cells: number[];
  focus: number[];
  reason: string;
  apply: { cell: number; value: string }[];
};

const fixedFrom = (pieces: [number, Piece][], skip = -1, keepUnit = false) =>
  new Map<number, Constraint>(
    pieces.flatMap(([i, p]): [number, Constraint][] =>
      i === skip ? (keepUnit ? [[i, { unit: p.unit }]] : []) : [[i, p]],
    ),
  );

export function nextHint(
  level: Level,
  board: Board,
  auto: Set<number>,
): Hint | null {
  const solution = new Set(solutionCells(level)),
    pieces = piecesOf(board);
  const misplaced = board.findIndex((code, i) => occupies(code) && !solution.has(i));
  if (misplaced >= 0)
    return {
      cells: [misplaced],
      focus: [],
      reason:
        board[misplaced] === MARK
          ? '亮起的佔位標記不在唯一的佈陣位置上。先清除它，再繼續推理。'
          : '亮起的單位不在唯一的佈陣位置上。先把它撤下，再繼續推理。',
      apply: [{ cell: misplaced, value: '' }],
    };
  const wrongNote = board.findIndex((v, i) => v === NOTE && solution.has(i));
  if (wrongNote >= 0)
    return {
      cells: [wrongNote],
      focus: [],
      reason: '亮起的排除記號擋住了必須部署單位的位置。先清除這個記號。',
      apply: [{ cell: wrongNote, value: '' }],
    };

  let completion = solveAssignment(level, fixedFrom(pieces));
  if (!completion) {
    // Blame the smallest change that makes full coverage possible again.
    for (const keepUnit of [true, false])
      for (const [i, piece] of pieces) {
        const repaired = solveAssignment(level, fixedFrom(pieces, i, keepUnit));
        if (!repaired) continue;
        const fix = repaired.get(i)!;
        return {
          cells: [i],
          focus: [],
          reason: keepUnit
            ? `這個${UNITS[piece.unit].name}的朝向讓部分敵軍無法被覆蓋。改為朝${DIR_NAMES[fix.dir]}，其他單位仍有辦法完成制壓。`
            : `照目前配置，敵軍無法全數被覆蓋。這格需要改派其他兵種，例如朝${DIR_NAMES[fix.dir]}的${UNITS[fix.unit].name}。`,
          apply: [{ cell: i, value: encodePiece(fix) }],
        };
      }
    completion = solveAssignment(level)!;
    const [i] = pieces.find(
      ([cell, p]) => encodePiece(p) !== encodePiece(completion!.get(cell)!),
    )!;
    return {
      cells: [i],
      focus: pieces.map(([cell]) => cell),
      reason: '目前的兵種與朝向組合無法制壓所有敵軍。先調整亮起的單位。',
      apply: [{ cell: i, value: encodePiece(completion.get(i)!) }],
    };
  }

  const step = nextDoubleDeduction(puzzleForHints(level), positionBoard(level, board, auto));
  if (step)
    return {
      cells: step.cells,
      focus: step.focus,
      reason:
        step.value === 2
          ? `${step.reason}套用時會部署一組能完成制壓的兵種。`
          : step.reason,
      apply: step.cells.map((cell) => ({
        cell,
        value: step.value === 2 ? encodePiece(completion!.get(cell)!) : NOTE,
      })),
    };
  // Every position is known: turn a placeholder (or an empty cell) into a real unit.
  const open = [...solution].find((i) => !decodePiece(board[i]));
  if (open === undefined) return null;
  const fill = completion.get(open)!;
  return {
    cells: [open],
    focus: [],
    reason:
      board[open] === MARK
        ? `這個佔位標記的位置正確。照目前的配置，這裡可以部署朝${DIR_NAMES[fill.dir]}的${UNITS[fill.unit].name}。`
        : '這是答案提示：亮起的格子需要部署單位。',
    apply: [{ cell: open, value: encodePiece(fill) }],
  };
}

const puzzleForHints = (level: Level) => ({
  regions: level.regions,
  cowsPerUnit: 2 as const,
});
