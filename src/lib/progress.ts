import { LEVELS } from './level-data.ts';
import { CAMPAIGN_LEVELS } from './campaign-data.ts';
import { FORMATION_LEVELS } from './formation-data.ts';
import { decodePiece } from './units.ts';
import { FLAG, MARK, NOTE, type Level } from './game.ts';

export type Mode = 'story' | 'campaign' | 'formation';
export type Selection = { mode: Mode; level: number };
export type Session = { board: string[]; elapsed: number; hints: number };
export type Progress = {
  version: 1;
  records: Record<string, Session>;
  completed: string[];
  flawless: string[];
  last: Selection | null;
};
export const SAVE_KEY = 'zhen-grid-progress-v1';
export const PREFS_KEY = 'zhen-grid-prefs-v1';
export const BANKS: Record<Mode, Level[]> = {
  story: LEVELS,
  campaign: CAMPAIGN_LEVELS,
  formation: FORMATION_LEVELS,
};
const ALL_LEVELS = Object.values(BANKS).flat();

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

export function unlockedLevel(progress: Progress, mode: Mode = 'story') {
  const bank = BANKS[mode];
  let next = 0;
  while (next < bank.length && progress.completed.includes(bank[next].id)) next++;
  return Math.min(next, bank.length - 1);
}
export const completedIn = (progress: Progress, mode: Mode) =>
  BANKS[mode].filter((l) => progress.completed.includes(l.id)).length;
export const canOpen = (progress: Progress, { mode, level }: Selection) =>
  Object.hasOwn(BANKS, mode) &&
  Number.isInteger(level) &&
  level >= 0 &&
  level < BANKS[mode].length &&
  level <= unlockedLevel(progress, mode);

export function recordSession(
  progress: Progress,
  id: string,
  session: Session,
  solved: boolean,
): Progress {
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
  v === '' || v === NOTE || v === MARK || v === FLAG || (typeof v === 'string' && decodePiece(v) !== null);

export function parseProgress(raw: unknown): Progress {
  if (!raw || typeof raw !== 'object' || (raw as Progress).version !== 1)
    throw new Error('不支援這個存檔格式');
  const source = raw as Partial<Omit<Progress, 'last'>> & { last?: unknown },
    result = emptyProgress(),
    ids = new Set(ALL_LEVELS.map((l) => l.id));
  if (source.records && typeof source.records === 'object')
    for (const [id, value] of Object.entries(source.records)) {
      const level = ALL_LEVELS.find((l) => l.id === id);
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
  // Saves from before the campaign stored the last story level as a bare number.
  const last =
    typeof source.last === 'number'
      ? { mode: 'story' as const, level: source.last }
      : (source.last as Selection | null | undefined);
  if (last && typeof last === 'object' && canOpen(result, last))
    result.last = { mode: last.mode, level: last.level };
  return result;
}
