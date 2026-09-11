import assert from 'node:assert/strict';
import { LEVELS } from '../src/lib/level-data.ts';
import { CAMPAIGN_LEVELS } from '../src/lib/campaign-data.ts';
import { HARD } from '../src/lib/source/hard-data.ts';
import { GRIDS } from '../src/lib/source/grid-data.ts';
import { doubleSolutions } from '../src/lib/double-logic.ts';
import { solutionCells, solveAssignment } from '../src/lib/assign.ts';
import { gridFingerprint, logicalDoubleSolve } from '../src/lib/proof.ts';
import { CAMPAIGN_CHAPTERS, STORY_CHAPTERS } from '../src/lib/chapters.ts';
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
import {
  canOpen,
  emptyProgress,
  parseProgress,
  recordSession,
  unlockedLevel,
} from '../src/lib/progress.ts';

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

function verifyLevel(level: Level, source: { regions: number[][]; solution: number[][] }) {
  const cells = solutionCells(level),
    n = level.regions.length;
  assert.deepEqual(level.regions, source.regions, `${level.id}: regions`);
  assert.deepEqual(level.solution, source.solution, `${level.id}: solution`);
  assert.equal(new Set(level.enemies).size, level.enemies.length);
  assert.ok(level.enemies.every((e) => e >= 0 && e < n * n && !cells.includes(e)));
  assert.equal(level.quotas.reduce((a, b) => a + b, 0), cells.length);
  const found = doubleSolutions({ ...level, blocked: level.enemies });
  assert.equal(found.length, 1, `${level.id}: unique positions`);
  assert.deepEqual(found[0], level.solution);
  assert.ok(logicalDoubleSolve({ ...level, blocked: level.enemies }).solved, `${level.id}: logical`);

  const answer = answerBoard(level);
  assert.deepEqual(usedCounts(answer), level.quotas, `${level.id}: answer quotas`);
  assert.equal(conflictsFor(level, answer).size, 0);
  const covered = coveredCells(level, answer);
  assert.ok(level.enemies.every((e) => covered.has(e)), `${level.id}: coverage`);
  assert.ok(isSolved(level, answer));
  assert.ok(solveAssignment(level), `${level.id}: assignment solver`);

  assert.ok(isSolved(level, playWithHints(level, emptyBoard(n))), `${level.id}: hints from empty`);
  // Every answer piece turned around forces the hint system to repair facings.
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

// Story: 40 tutorial levels over the Bullpen bank; chapters cover them contiguously.
assert.equal(LEVELS.length, 40);
assert.equal(STORY_CHAPTERS.at(-1)!.to, LEVELS.length - 1);
for (const level of LEVELS) {
  verifyLevel(level, HARD.find((p) => p.id === level.source)!);
  const chapter = STORY_CHAPTERS.find((c) => LEVELS.indexOf(level) <= c.to)!;
  assert.ok(level.quotas.every((q, u) => q === 0 || chapter.units.includes(u as 0)));
}

// Campaign: 100 levels on a fresh grid bank that never repeats a story grid.
assert.equal(GRIDS.length, 100);
assert.equal(CAMPAIGN_LEVELS.length, 100);
assert.equal(CAMPAIGN_CHAPTERS.length, 10);
assert.equal(CAMPAIGN_CHAPTERS.at(-1)!.to, CAMPAIGN_LEVELS.length - 1);
const fingerprints = [...HARD, ...GRIDS].map((g) => gridFingerprint(g.regions));
assert.equal(new Set(fingerprints).size, fingerprints.length, 'no repeated grids');
let lastScore = 0,
  lastEnemies = 0;
for (const [index, grid] of GRIDS.entries()) {
  const proof = logicalDoubleSolve(grid);
  assert.ok(proof.solved, `${grid.id}: logical without enemies`);
  assert.equal(proof.score, grid.difficulty.score);
  assert.ok(proof.score >= lastScore, `${grid.id}: difficulty ramps`);
  lastScore = proof.score;
  const level = CAMPAIGN_LEVELS[index];
  assert.equal(level.source, grid.id);
  assert.ok(level.enemies.length >= lastEnemies, `${level.id}: enemies ramp`);
  lastEnemies = level.enemies.length;
  const chapter = CAMPAIGN_CHAPTERS.find((c) => index <= c.to)!;
  assert.ok(level.quotas.every((q, u) => q === 0 || chapter.units.includes(u as 0)));
  verifyLevel(level, grid);
}
const ids = [...LEVELS, ...CAMPAIGN_LEVELS].map((l) => l.id);
assert.equal(new Set(ids).size, ids.length, 'level ids unique across modes');

// Saves: malformed boards dropped, old numeric `last` means story, modes unlock separately.
const progress = parseProgress({
  version: 1,
  records: { [LEVELS[0].id]: { board: ['bad'], elapsed: 3, hints: 0 } },
  completed: [LEVELS[0].id, LEVELS[1].id, 'nope'],
  flawless: [LEVELS[0].id],
  last: 1,
});
assert.deepEqual(progress.records, {});
assert.deepEqual(progress.completed, [LEVELS[0].id, LEVELS[1].id]);
assert.deepEqual(progress.last, { mode: 'story', level: 1 });
assert.equal(unlockedLevel(progress), 2);
assert.equal(unlockedLevel(progress, 'campaign'), 0);
assert.ok(canOpen(progress, { mode: 'campaign', level: 0 }));
assert.ok(!canOpen(progress, { mode: 'campaign', level: 1 }));
const advanced = recordSession(progress, CAMPAIGN_LEVELS[0].id, { board: answerBoard(CAMPAIGN_LEVELS[0]), elapsed: 9, hints: 0 }, true);
assert.equal(unlockedLevel(advanced, 'campaign'), 1);
assert.ok(advanced.flawless.includes(CAMPAIGN_LEVELS[0].id));
assert.deepEqual(parseProgress({ ...advanced, last: { mode: 'campaign', level: 1 } }).last, { mode: 'campaign', level: 1 });
assert.equal(parseProgress({ ...advanced, last: { mode: 'campaign', level: 5 } }).last, null, 'locked last dropped');
assert.equal(unlockedLevel(emptyProgress()), 0);
assert.throws(() => parseProgress({ version: 99 }));

console.log(`verified ${LEVELS.length} story + ${CAMPAIGN_LEVELS.length} campaign levels`);
