// Builds the frozen grid-v1 bank of 10×10 two-per-line region puzzles for the
// campaign. Ported from the Bullpen double-cow generator: plant a valid layout,
// join units pairwise into regions, grow the borders, then keep only connected,
// unique, logically solvable grids that differ from the story bank (including
// rotations and mirrors). Never regenerate a published bank in place.
import { existsSync, writeFileSync } from 'node:fs';
import { doubleSolutions } from '../src/lib/double-logic.ts';
import { gridFingerprint, logicalDoubleSolve } from '../src/lib/proof.ts';
import { HARD } from '../src/lib/source/hard-data.ts';

const destination = new URL('../src/lib/source/grid-data.ts', import.meta.url);
if (existsSync(destination) && !process.argv.includes('--replace-unreleased'))
  throw new Error('grid-v1 bank already exists; use a new content version.');

const COUNT = 100,
  POOL = 240,
  n = 10;
let seed = 0x3c6ef372;
function random() {
  seed += 0x6d2b79f5;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const pairs: [number, number][] = [];
for (let a = 0; a < n; a++) for (let b = a + 2; b < n; b++) pairs.push([a, b]);

function plant() {
  const solution: number[][] = [],
    counts = Array(n).fill(0);
  let nodes = 0;
  function visit(row: number, prev: number): boolean {
    if (++nodes > 20000) return false;
    if (row === n) return counts.every((c) => c === 2);
    for (const [a, b] of shuffle([...pairs])) {
      const mask = (1 << a) | (1 << b);
      if (mask & (prev | (prev << 1) | (prev >> 1)) || counts[a] === 2 || counts[b] === 2)
        continue;
      counts[a]++;
      counts[b]++;
      solution.push([a, b]);
      if (counts.every((c) => 2 - c <= Math.ceil((n - row - 1) / 2)) && visit(row + 1, mask))
        return true;
      solution.pop();
      counts[a]--;
      counts[b]--;
    }
    return false;
  }
  return visit(0, 0) ? solution : null;
}

function grow(solution: number[][]) {
  const regions = Array.from({ length: n }, () => Array<number>(n).fill(-1)),
    weights = Array.from({ length: n }, () => 0.03 + random() ** 2),
    frontier: [number, number][] = [],
    unpaired = new Set(solution.flatMap((cols, r) => cols.map((c) => r * n + c)));
  for (let z = 0; z < n; z++) {
    const root = shuffle([...unpaired])[0],
      queue = [root],
      parent = new Map([[root, -1]]);
    let end = -1;
    for (let k = 0; k < queue.length && end < 0; k++) {
      const i = queue[k],
        r = Math.floor(i / n),
        c = i % n;
      for (const [dr, dc] of shuffle([...STEPS])) {
        const nr = r + dr,
          nc = c + dc,
          j = nr * n + nc;
        if (nr < 0 || nr >= n || nc < 0 || nc >= n || regions[nr][nc] >= 0 || parent.has(j))
          continue;
        parent.set(j, i);
        if (unpaired.has(j)) {
          end = j;
          break;
        }
        queue.push(j);
      }
    }
    if (end < 0) return null;
    unpaired.delete(root);
    unpaired.delete(end);
    for (let i = end; i >= 0; i = parent.get(i)!) regions[Math.floor(i / n)][i % n] = z;
  }
  const frontierAt = (i: number, z: number) => {
    for (const [dr, dc] of STEPS) {
      const nr = Math.floor(i / n) + dr,
        nc = (i % n) + dc;
      if (nr >= 0 && nr < n && nc >= 0 && nc < n && regions[nr][nc] < 0)
        frontier.push([nr * n + nc, z]);
    }
  };
  regions.forEach((row, r) => row.forEach((z, c) => z >= 0 && frontierAt(r * n + c, z)));
  while (frontier.length) {
    const k = Math.floor(random() * frontier.length),
      [i, z] = frontier[k],
      r = Math.floor(i / n),
      c = i % n;
    if (regions[r][c] < 0 && random() > weights[z]) continue;
    frontier[k] = frontier.at(-1)!;
    frontier.pop();
    if (regions[r][c] >= 0) continue;
    regions[r][c] = z;
    frontierAt(i, z);
  }
  return regions.every((row) => row.every((v) => v >= 0)) ? regions : null;
}

const seen = new Set(HARD.map((p) => gridFingerprint(p.regions))),
  pool: { regions: number[][]; solution: number[][]; difficulty: { tier: number; score: number; steps: number } }[] = [];
for (let attempt = 0; attempt < 400000 && pool.length < POOL; attempt++) {
  const solution = plant();
  if (!solution) continue;
  const regions = grow(solution);
  if (!regions) continue;
  let answers: number[][][];
  try {
    answers = doubleSolutions({ regions, cowsPerUnit: 2 }, 2, undefined, 80000);
  } catch {
    continue;
  }
  if (answers.length !== 1) continue;
  const proof = logicalDoubleSolve({ regions });
  if (!proof.solved) continue;
  const fingerprint = gridFingerprint(regions);
  if (seen.has(fingerprint)) continue;
  seen.add(fingerprint);
  pool.push({
    regions,
    solution,
    difficulty: { tier: proof.tier, score: proof.score, steps: proof.steps.length },
  });
  if (pool.length % 20 === 0) console.log(`accepted ${pool.length} after ${attempt + 1} attempts`);
}
if (pool.length < COUNT) throw new Error(`Only ${pool.length} grids accepted`);
pool.sort((a, b) => a.difficulty.score - b.difficulty.score);
// Spread picks evenly across the difficulty range so the campaign ramps smoothly.
const grids = Array.from({ length: COUNT }, (_, i) => ({
  id: `grid-v1-${String(i + 1).padStart(3, '0')}`,
  ...pool[Math.floor((i * (pool.length - 1)) / (COUNT - 1))],
}));
writeFileSync(
  destination,
  `// Frozen 10x10 two-per-line grids generated by scripts/generate-grids.ts.\n` +
    `// Each is unique, connected and logically solvable. Never regenerate in place.\n` +
    `export const GRIDS: { id: string; regions: number[][]; solution: number[][]; difficulty: { tier: number; score: number; steps: number } }[] = [\n` +
    grids.map((g) => `  ${JSON.stringify(g)},`).join('\n') +
    `\n];\n`,
);
console.log(
  `saved ${grids.length} grids, scores ${grids[0].difficulty.score}–${grids.at(-1)!.difficulty.score}`,
);
