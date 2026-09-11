import assert from 'node:assert/strict';
import { LEVELS } from '../src/lib/level-data.ts';
import { HARD } from '../src/lib/source/hard-data.ts';
import { doubleSolutions } from '../src/lib/double-logic.ts';
import { solutionCells, solveAssignment } from '../src/lib/assign.ts';
import {
  answerBoard,
  automaticExclusions,
  conflictsFor,
  coveredCells,
  emptyBoard,
  isSolved,
  usedCounts,
  type Board,
  type Level,
} from '../src/lib/game.ts';
import { nextHint } from '../src/lib/hints.ts';
import { coverage, decodePiece, encodePiece, rotate } from '../src/lib/units.ts';
import { parseProgress, emptyProgress, unlockedLevel } from '../src/lib/progress.ts';

// Unit geometry: facing right turns "forward" into +col.
assert.deepEqual(rotate(-1, 0, 1), [0, 1]);
assert.deepEqual(rotate(-1, 0, 2), [1, 0]);
assert.deepEqual(rotate(-1, 0, 3), [0, -1]);
assert.deepEqual(coverage(55, 1, 0, 10), [45, 35, 25]);
assert.deepEqual(coverage(55, 1, 1, 10), [56, 57, 58]);
assert.deepEqual(coverage(0, 0, 0, 10), [], 'ranges clip at the edge');
assert.deepEqual(decodePiece('K3'), { unit: 3, dir: 3 });
assert.equal(decodePiece('x'), null);
assert.equal(encodePiece({ unit: 5, dir: 2 }), 'G2');

function playWithHints(level: Level, start: Board) {
  let board = [...start];
  for (let step = 0; step < 400 && !isSolved(level, board); step++) {
    const hint = nextHint(level, board, automaticExclusions(level, board));
    assert.ok(hint, `${level.id}: hint available until solved`);
    board = [...board];
    for (const { cell, value } of hint.apply) board[cell] = value;
  }
  return board;
}

assert.equal(LEVELS.length, 40);
assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
for (const level of LEVELS) {
  const source = HARD.find((p) => p.id === level.source)!,
    cells = solutionCells(level),
    n = level.regions.length;
  assert.deepEqual(level.regions, source.regions, `${level.id}: regions`);
  assert.deepEqual(level.solution, source.solution, `${level.id}: solution`);
  assert.equal(new Set(level.enemies).size, level.enemies.length);
  assert.ok(level.enemies.every((e) => e >= 0 && e < n * n && !cells.includes(e)));
  assert.equal(level.quotas.reduce((a, b) => a + b, 0), cells.length);
  const found = doubleSolutions({ ...level, blocked: level.enemies });
  assert.equal(found.length, 1, `${level.id}: unique positions`);
  assert.deepEqual(found[0], level.solution);

  const answer = answerBoard(level);
  assert.deepEqual(usedCounts(answer), level.quotas, `${level.id}: answer quotas`);
  assert.equal(conflictsFor(level, answer).size, 0);
  const covered = coveredCells(level, answer);
  assert.ok(level.enemies.every((e) => covered.has(e)), `${level.id}: coverage`);
  assert.ok(isSolved(level, answer));
  assert.ok(solveAssignment(level), `${level.id}: assignment solver`);

  assert.ok(isSolved(level, playWithHints(level, emptyBoard(n))), `${level.id}: hints from empty`);
  // Every answer piece rotated away forces the hint system to repair facings.
  const turned = answer.map((code) => {
    const p = decodePiece(code);
    return p ? encodePiece({ ...p, dir: ((p.dir + 2) % 4) as 0 }) : code;
  });
  assert.ok(isSolved(level, playWithHints(level, turned)), `${level.id}: hint repair`);
  // A misplaced unit and a note on a required cell must also be cleared by hints.
  const messy = emptyBoard(n);
  messy[cells[0]] = 'x';
  messy[[...Array(n * n).keys()].find((i) => !cells.includes(i) && !level.enemies.includes(i))!] = 'S0';
  assert.ok(isSolved(level, playWithHints(level, messy)), `${level.id}: hint cleanup`);
}

// Saves reject malformed boards and only unlock sequentially.
const progress = parseProgress({
  version: 1,
  records: { [LEVELS[0].id]: { board: ['bad'], elapsed: 3, hints: 0 } },
  completed: [LEVELS[0].id, LEVELS[1].id, 'nope'],
  flawless: [LEVELS[0].id],
  last: 1,
});
assert.deepEqual(progress.records, {});
assert.deepEqual(progress.completed, [LEVELS[0].id, LEVELS[1].id]);
assert.equal(unlockedLevel(progress), 2);
assert.equal(unlockedLevel(emptyProgress()), 0);
assert.throws(() => parseProgress({ version: 99 }));

console.log(`verified ${LEVELS.length} levels`);
