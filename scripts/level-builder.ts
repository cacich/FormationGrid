// Shared level construction for the story and campaign generators.
// Enemies only occupy non-solution cells, so every level keeps its grid's unique
// unit positions. Each level is built from a concrete answer, so full coverage
// is always achievable. The random call order is part of the frozen output:
// changing it would alter published levels.
import { solutionCells, solveAssignment } from '../src/lib/assign.ts';
import { DIRS, UNITS, coverage, encodePiece, type Dir, type UnitId } from '../src/lib/units.ts';
import type { Level } from '../src/lib/game.ts';

export function rng(seed: number) {
  let state = ((seed + 1) * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function quotasFor(units: UnitId[], total: number, random: () => number) {
  const quotas = UNITS.map(() => 0),
    newest = units.at(-1)!,
    cap = (u: UnitId) => (u === 5 ? 3 : total);
  for (const u of units) quotas[u] = u === newest && units.length > 2 ? 3 : 1;
  while (quotas.reduce((a, b) => a + b, 0) < total) {
    const open = units.filter((u) => quotas[u] < cap(u));
    quotas[open[Math.floor(random() * open.length)]]++;
  }
  return quotas;
}

export type BuildOptions = {
  id: string;
  source: { id: string; regions: number[][]; solution: number[][] };
  units: UnitId[];
  enemies: number;
  seed: number;
  // Guarantee one enemy that only this unit covers in the planted answer.
  feature?: UnitId;
  // Random jitter added to each square's reach when ranking enemy squares;
  // larger values pick less constrained (easier) enemies.
  noise?: number;
  // Candidate answers tried; the most constrained candidate is kept.
  attempts?: number;
  // Extra ranking weight per solution cell able to cover a square. 0 keeps the
  // original reach-only ranking the published story levels were built with.
  cellWeight?: number;
};

export function buildLevel({
  id,
  source,
  units,
  enemies: enemyTarget,
  seed,
  feature,
  noise = 6,
  attempts = 600,
  cellWeight = 0,
}: BuildOptions): { level: Level; score: number } {
  const n = source.regions.length,
    cells = solutionCells(source),
    solutionSet = new Set(cells),
    random = rng(seed);
  // How many (cell, type, facing) choices could reach each square, plus a
  // penalty per distinct cell that could reach it.
  const reachAll = Array<number>(n * n).fill(0);
  for (const cell of cells) {
    const reachable = new Set<number>();
    for (const u of units)
      for (const d of DIRS)
        for (const x of coverage(cell, u, d, n)) {
          reachAll[x]++;
          reachable.add(x);
        }
    for (const x of reachable) reachAll[x] += cellWeight;
  }
  let best: { score: number; level: Level } | null = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const quotas = quotasFor(units, cells.length, random),
      types = shuffle(
        quotas.flatMap((q, u) => Array<UnitId>(q).fill(u as UnitId)),
        random,
      );
    const answer = cells.map((cell, k) => {
      const unit = types[k],
        useful = DIRS.filter((d) => coverage(cell, unit, d, n).some((x) => !solutionSet.has(x))),
        dirs = useful.length ? useful : [...DIRS];
      return { unit, dir: dirs[Math.floor(random() * dirs.length)] as Dir };
    });
    const reach = new Map<number, number>();
    cells.forEach((cell, k) => {
      for (const x of coverage(cell, answer[k].unit, answer[k].dir, n))
        if (!solutionSet.has(x)) reach.set(x, reachAll[x]);
    });
    if (reach.size < enemyTarget) continue;
    const picked = new Set<number>();
    if (feature !== undefined) {
      const featured = cells.flatMap((cell, k) =>
        answer[k].unit === feature
          ? coverage(cell, feature, answer[k].dir, n).filter((x) => reach.has(x))
          : [],
      );
      if (!featured.length) continue;
      picked.add(featured[Math.floor(random() * featured.length)]);
    }
    const ranked = [...reach.keys()]
      .filter((x) => !picked.has(x))
      .map((x) => ({ x, key: reach.get(x)! + random() * noise }))
      .sort((a, b) => a.key - b.key);
    for (const { x } of ranked) {
      if (picked.size >= enemyTarget) break;
      picked.add(x);
    }
    const enemies = [...picked].sort((a, b) => a - b),
      score = enemies.reduce((sum, x) => sum + reach.get(x)!, 0);
    if (best && score >= best.score) continue;
    best = {
      score,
      level: {
        id,
        source: source.id,
        regions: source.regions,
        solution: source.solution,
        cowsPerUnit: 2,
        enemies,
        quotas,
        answer: answer.map(encodePiece),
      },
    };
  }
  if (!best) throw new Error(`No candidate for ${id}`);
  if (!solveAssignment(best.level)) throw new Error(`${id} has no full-coverage assignment`);
  return best;
}

export function levelFile(name: string, header: string, levels: Level[]) {
  return (
    `${header}\n` +
    `import type { Level } from './game.ts';\n\n` +
    `export const ${name}: Level[] = [\n` +
    levels.map((l) => `  ${JSON.stringify(l)},`).join('\n') +
    `\n];\n`
  );
}
