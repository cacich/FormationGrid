import { LEVELS } from './level-data.ts';
import { decodePiece } from './units.ts';

export type Session = { board: string[]; elapsed: number; hints: number };
export type Progress = {
  version: 1;
  records: Record<string, Session>;
  completed: string[];
  flawless: string[];
  last: number | null;
};
export const SAVE_KEY = 'zhen-grid-progress-v1';
export const PREFS_KEY = 'zhen-grid-prefs-v1';

export const emptyProgress = (): Progress => ({
  version: 1,
  records: {},
  completed: [],
  flawless: [],
  last: null,
});
export const emptySession = (size: number): Session => ({
  board: Array(size * size).fill(''),
  elapsed: 0,
  hints: 0,
});

export function unlockedLevel(progress: Progress) {
  let next = 0;
  while (next < LEVELS.length && progress.completed.includes(LEVELS[next].id))
    next++;
  return Math.min(next, LEVELS.length - 1);
}
export const canOpen = (progress: Progress, level: number) =>
  Number.isInteger(level) &&
  level >= 0 &&
  level < LEVELS.length &&
  level <= unlockedLevel(progress);

export function recordSession(
  progress: Progress,
  level: number,
  session: Session,
  solved: boolean,
): Progress {
  const id = LEVELS[level].id;
  return {
    ...progress,
    records: { ...progress.records, [id]: session },
    completed:
      solved && !progress.completed.includes(id)
        ? [...progress.completed, id]
        : progress.completed,
    flawless:
      solved && session.hints === 0 && !progress.flawless.includes(id)
        ? [...progress.flawless, id]
        : progress.flawless,
  };
}

const count = (x: unknown) =>
  Number.isSafeInteger(x) && Number(x) >= 0 ? Number(x) : 0;
const validCell = (v: unknown) =>
  v === '' || v === 'x' || (typeof v === 'string' && decodePiece(v) !== null);

export function parseProgress(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object' || (raw as Progress).version !== 1)
    throw new Error('不支援這個存檔格式');
  const source = raw as Partial<Progress>,
    result = emptyProgress(),
    ids = new Set(LEVELS.map((l) => l.id));
  if (source.records && typeof source.records === 'object')
    for (const [id, value] of Object.entries(source.records)) {
      const level = LEVELS.find((l) => l.id === id);
      if (
        level &&
        value &&
        Array.isArray(value.board) &&
        value.board.length === level.regions.length ** 2 &&
        value.board.every(validCell)
      )
        result.records[id] = {
          board: [...value.board],
          elapsed: count(value.elapsed),
          hints: count(value.hints),
        };
    }
  result.completed = Array.isArray(source.completed)
    ? [...new Set(source.completed.filter((id) => ids.has(id)))]
    : [];
  result.flawless = Array.isArray(source.flawless)
    ? [...new Set(source.flawless.filter((id) => result.completed.includes(id)))]
    : [];
  if (typeof source.last === 'number' && canOpen(result, source.last))
    result.last = source.last;
  return result;
}
