import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  CircleHelp,
  Clock3,
  Home as HomeIcon,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  Star,
  Swords,
  Undo2,
  X,
} from 'lucide-react';
import { CAMPAIGN_CHAPTERS, STORY_CHAPTERS, chapterIndex, type Chapter } from './lib/chapters.ts';
import {
  MARK,
  NOTE,
  automaticExclusions,
  conflictsFor,
  coveredCells,
  isSolved,
  usedCounts,
  type Board as BoardState,
} from './lib/game.ts';
import { nextHint, type Hint } from './lib/hints.ts';
import { DIR_NAMES, UNITS, UNIT_IDS, decodePiece, encodePiece, type Dir, type UnitId } from './lib/units.ts';
import {
  BANKS,
  PREFS_KEY,
  SAVE_KEY,
  canOpen,
  completedIn,
  emptyProgress,
  emptySession,
  parseProgress,
  recordSession,
  unlockedLevel,
  type Mode,
  type Progress,
  type Selection,
} from './lib/progress.ts';
import { Board, type Tool } from './components/Board.tsx';
import { Modal } from './components/Modal.tsx';
import { PieceToken, RangeDiagram, EnemyToken } from './components/PieceToken.tsx';

export const GAME_NAME = '陣格';
const UNITS_PER_LINE = 2;
const BASE_MESSAGE = '每列、每欄、每個陣地各部署 2 個單位，並覆蓋所有敵軍';
const CHAPTERS: Record<Mode, Chapter[]> = { story: STORY_CHAPTERS, campaign: CAMPAIGN_CHAPTERS };
const MODE_NAME: Record<Mode, string> = { story: '劇情模式', campaign: '關卡模式' };
const CHAPTER_WORD: Record<Mode, string> = { story: '章', campaign: '大關' };
const formatTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const levelLabel = ({ mode, level }: Selection) => {
  if (mode === 'story') return `第 ${level + 1} 關`;
  const chapter = CAMPAIGN_CHAPTERS[chapterIndex(CAMPAIGN_CHAPTERS, level)];
  return `${chapterIndex(CAMPAIGN_CHAPTERS, level) + 1}－${String(level - chapter.from + 1).padStart(2, '0')}`;
};
const openingMessage = ({ mode, level }: Selection) => {
  const c = chapterIndex(CHAPTERS[mode], level),
    chapter = CHAPTERS[mode][c];
  if (level !== chapter.from) return BASE_MESSAGE;
  return mode === 'story' ? chapter.intro : `第 ${c + 1} 大關「${chapter.name}」：${chapter.intro}`;
};

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} className="toggle" onClick={() => onChange(!checked)}>
      <span>{label}</span>
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
    </button>
  );
}

export function App() {
  const [view, setView] = useState<'home' | 'play'>('home');
  const [progress, setProgress] = useState<Progress>(emptyProgress);
  const [hydrated, setHydrated] = useState(false);
  const [selection, setSelection] = useState<Selection>({ mode: 'story', level: 0 });
  const [picker, setPicker] = useState<Mode>('story');
  const [tool, setTool] = useState<Tool>(0);
  const [prefs, setPrefs] = useState({ auto: true, ranges: true });
  const [history, setHistory] = useState<BoardState[]>([]);
  const [hint, setHint] = useState<Hint | null>(null);
  const [message, setMessage] = useState(BASE_MESSAGE);
  const [dialog, setDialog] = useState<null | 'rules' | 'levels' | 'reset'>(null);
  const [storageMessage, setStorageMessage] = useState('');

  const { mode, level: levelIndex } = selection,
    bank = BANKS[mode],
    level = bank[levelIndex],
    n = level.regions.length,
    session = progress.records[level.id] ?? emptySession(n),
    board = session.board;
  const enemies = useMemo(() => new Set(level.enemies), [level]);
  const auto = useMemo(() => automaticExclusions(level, board, prefs.auto), [level, board, prefs.auto]);
  const conflicts = useMemo(() => conflictsFor(level, board), [level, board]);
  const covered = useMemo(() => coveredCells(level, board), [level, board]);
  const used = useMemo(() => usedCounts(board), [board]);
  const solved = useMemo(() => isSolved(level, board), [level, board]);
  const suppressed = level.enemies.filter((e) => covered.has(e)).length,
    placed = used.reduce((a, b) => a + b, 0),
    marks = board.filter((code) => code === MARK).length,
    total = n * UNITS_PER_LINE,
    chapters = CHAPTERS[mode],
    chapterNo = chapterIndex(chapters, levelIndex),
    chapter = chapters[chapterNo],
    unitChoices = UNIT_IDS.filter((u) => level.quotas[u] > 0),
    nextSelection = { mode, level: levelIndex + 1 },
    canNext = canOpen(progress, nextSelection);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) setProgress(parseProgress(JSON.parse(saved)));
    } catch {
      setStorageMessage('無法讀取本機存檔；這次的進度可能無法保存。');
    }
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
      if (saved && typeof saved === 'object')
        setPrefs({ auto: saved.auto !== false, ranges: saved.ranges !== false });
    } catch {
      // Preferences fall back to defaults.
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch {
      setStorageMessage('自動儲存失敗，請檢查瀏覽器的儲存空間。');
    }
  }, [progress, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // Preferences still apply for this visit.
    }
  }, [prefs, hydrated]);
  useEffect(() => {
    if (!hydrated || view !== 'play' || solved || !board.some(Boolean) || dialog) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setProgress((p) => {
        const current = p.records[level.id];
        return current
          ? { ...p, records: { ...p.records, [level.id]: { ...current, elapsed: current.elapsed + 1 } } }
          : p;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hydrated, view, solved, board, dialog, level.id]);

  const openLevel = useCallback(
    (target: Selection) => {
      if (!hydrated || !canOpen(progress, target)) return;
      const next = BANKS[target.mode][target.level];
      setSelection(target);
      setProgress((p) => ({ ...p, last: target }));
      setHistory([]);
      setHint(null);
      setMessage(openingMessage(target));
      setTool((t) => (typeof t === 'number' && next.quotas[t] > 0 ? t : (next.quotas.findIndex((q) => q > 0) as UnitId)));
      setDialog(Object.keys(progress.records).length === 0 ? 'rules' : null);
      setView('play');
    },
    [hydrated, progress],
  );
  const openPicker = (target: Mode) => {
    setPicker(target);
    setDialog('levels');
  };

  const commit = (next: BoardState, feedback?: string) => {
    setHistory((h) => [...h.slice(-99), board]);
    const nextSolved = isSolved(level, next);
    setProgress((p) =>
      recordSession(p, level.id, { ...(p.records[level.id] ?? emptySession(n)), board: next }, nextSolved),
    );
    setHint(null);
    if (nextSolved) navigator.vibrate?.([40, 30, 70]);
    setMessage(feedback ?? BASE_MESSAGE);
  };
  const withCell = (i: number, value: string) => {
    const next = [...board];
    next[i] = value;
    return next;
  };
  const deploy = (i: number, unit: UnitId, dir: Dir) => {
    const current = decodePiece(board[i]);
    if (current?.unit !== unit && level.quotas[unit] - used[unit] <= 0) {
      setMessage(`${UNITS[unit].name}已全部部署。先撤下一個，才能換到這裡。`);
      return;
    }
    if (!current && auto.has(i)) {
      setMessage('這格已自動排除：會碰到其他單位，或所在列、欄、陣地已滿。');
      return;
    }
    commit(withCell(i, encodePiece({ unit, dir })));
  };
  const tap = (i: number) => {
    if (!hydrated || solved) return;
    if (enemies.has(i)) {
      setMessage(covered.has(i) ? '這名敵軍已被我方覆蓋。' : '敵軍佔據的格子不能部署；讓我方單位的射程覆蓋它。');
      return;
    }
    const current = decodePiece(board[i]);
    if (tool === 'mark') {
      if (board[i] === MARK) commit(withCell(i, ''), '已清除佔位標記。');
      else if (!board[i] && auto.has(i)) setMessage('這格已自動排除：會碰到其他單位，或所在列、欄、陣地已滿。');
      else commit(withCell(i, MARK), current ? `已把${UNITS[current.unit].name}改回佔位標記。` : undefined);
      return;
    }
    if (tool === 'note') {
      if (current || board[i] === MARK) setMessage('這格已有單位或佔位標記；用同一個工具再點一次即可清除。');
      else if (!board[i] && auto.has(i)) setMessage('這格已自動排除。');
      else commit(withCell(i, board[i] === NOTE ? '' : NOTE));
      return;
    }
    if (current?.unit === tool) commit(withCell(i, ''), `已撤下${UNITS[tool].name}。`);
    else deploy(i, tool, current?.dir ?? 0);
  };
  const direct = (i: number, dir: Dir) => {
    if (!hydrated || solved || enemies.has(i)) return tap(i);
    const current = decodePiece(board[i]);
    if (current) {
      if (current.dir !== dir)
        commit(withCell(i, encodePiece({ ...current, dir })), `${UNITS[current.unit].name}改為朝${DIR_NAMES[dir]}。`);
    } else if (typeof tool === 'number') deploy(i, tool, dir);
    else tap(i);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setProgress((p) =>
      recordSession(p, level.id, { ...(p.records[level.id] ?? emptySession(n)), board: previous }, false),
    );
    setHint(null);
    setMessage('已復原上一步。');
  };
  const reset = () => {
    setProgress((p) => ({ ...p, records: { ...p.records, [level.id]: emptySession(n) } }));
    setHistory([]);
    setHint(null);
    setMessage('重新佈陣，慢慢來。');
    setDialog(null);
  };
  const requestHint = () => {
    if (solved || hint) return;
    const step = nextHint(level, board, auto);
    if (!step) {
      setMessage('目前沒有可用提示，試著復原上一步。');
      return;
    }
    setHint(step);
    setProgress((p) => {
      const current = p.records[level.id] ?? emptySession(n);
      return { ...p, records: { ...p.records, [level.id]: { ...current, hints: current.hints + 1 } } };
    });
  };
  const applyHint = () => {
    if (!hint) return;
    const next = [...board];
    for (const { cell, value } of hint.apply) next[cell] = value;
    commit(next, '已套用提示，接著找下一條線索。');
  };

  const selectedUnit = typeof tool === 'number' ? tool : null;
  const campaignEntry: Selection = { mode: 'campaign', level: unlockedLevel(progress, 'campaign') };
  const storyFinished = mode === 'story' && completedIn(progress, 'story') === BANKS.story.length;
  const pickerBank = BANKS[picker],
    pickerDone = completedIn(progress, picker),
    pickerEntry: Selection = { mode: picker, level: unlockedLevel(progress, picker) };

  return (
    <div className="app">
      <main className="shell">
        {view === 'home' ? (
          <section className="home" aria-label="主選單">
            <div className="home-banner">
              <span className="emblem" aria-hidden="true">
                陣
              </span>
              <h1>{GAME_NAME}</h1>
              <p>佈下我方陣列，覆蓋每一名敵軍</p>
            </div>
            {progress.last && (
              <button className="home-btn primary" disabled={!hydrated} onClick={() => openLevel(progress.last!)}>
                <Play />
                繼續 · {MODE_NAME[progress.last.mode]} {levelLabel(progress.last)}
              </button>
            )}
            <button className="home-btn" disabled={!hydrated} onClick={() => openPicker('story')}>
              <BookOpen />
              <span className="home-btn-text">
                <span>劇情模式</span>
                <small>
                  新手教學 · {completedIn(progress, 'story')} / {BANKS.story.length}
                </small>
              </span>
            </button>
            <button className="home-btn" disabled={!hydrated} onClick={() => openPicker('campaign')}>
              <Swords />
              <span className="home-btn-text">
                <span>關卡模式</span>
                <small>
                  {CAMPAIGN_CHAPTERS.length} 大關 · {completedIn(progress, 'campaign')} / {BANKS.campaign.length}
                </small>
              </span>
            </button>
            <button className="home-btn" onClick={() => setDialog('rules')}>
              <CircleHelp />
              規則與兵種
            </button>
          </section>
        ) : (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">
                  {mode === 'story' ? '劇情' : '關卡'} · 第 {chapterNo + 1} {CHAPTER_WORD[mode]} · {chapter.name}
                </p>
                <h1>{mode === 'story' ? levelLabel(selection) : `第 ${levelLabel(selection)} 關`}</h1>
              </div>
              <div className="header-actions">
                <button className="icon-btn" aria-label="返回主選單" onClick={() => setView('home')}>
                  <HomeIcon />
                </button>
                <button className="icon-btn" aria-label="規則與兵種" onClick={() => setDialog('rules')}>
                  <CircleHelp />
                </button>
              </div>
            </header>
            <section className="game-card" aria-label="佈陣棋盤">
              <div className="level-row">
                <div className="level-nav">
                  <button
                    className="icon-btn small"
                    aria-label="上一關"
                    disabled={levelIndex === 0}
                    onClick={() => openLevel({ mode, level: levelIndex - 1 })}
                  >
                    <ChevronLeft />
                  </button>
                  <button className="level-pill" onClick={() => openPicker(mode)} aria-label="選擇關卡">
                    {mode === 'story' ? `${levelIndex + 1} / ${bank.length}` : levelLabel(selection)}
                    <ChevronDown size={14} />
                  </button>
                  <button
                    className="icon-btn small"
                    aria-label={canNext ? '下一關' : '下一關尚未解鎖'}
                    disabled={!canNext}
                    onClick={() => openLevel(nextSelection)}
                  >
                    <ChevronRight />
                  </button>
                </div>
                <span className="timer">
                  <Clock3 />
                  {formatTime(session.elapsed)}
                </span>
              </div>
              <div className="stats">
                <span className={placed === total ? 'done' : ''}>
                  部署 {placed} / {total}
                  {marks > 0 && <small className="mark-count">佔位 {marks}</small>}
                </span>
                <span className={suppressed === level.enemies.length ? 'done' : ''}>
                  <EnemyToken suppressed={false} />
                  覆蓋 {suppressed} / {level.enemies.length}
                </span>
              </div>
              <div
                className="palette"
                role="radiogroup"
                aria-label="部署工具"
                style={{ '--tool-cols': unitChoices.length + 2 <= 4 ? 4 : Math.ceil((unitChoices.length + 2) / 2) } as CSSProperties}
              >
                {unitChoices.map((u) => {
                  const left = level.quotas[u] - used[u];
                  return (
                    <button
                      key={u}
                      role="radio"
                      aria-checked={tool === u}
                      className={`tool ${tool === u ? 'active' : ''} ${left === 0 ? 'spent' : ''}`}
                      aria-label={`${UNITS[u].name}，剩 ${left} / ${level.quotas[u]}`}
                      onClick={() => setTool(u)}
                    >
                      <PieceToken piece={{ unit: u, dir: 0 }} small />
                      <span className="tool-count">
                        {left}
                        <small>/{level.quotas[u]}</small>
                      </span>
                    </button>
                  );
                })}
                <button
                  role="radio"
                  aria-checked={tool === 'mark'}
                  className={`tool tool-text ${tool === 'mark' ? 'active' : ''}`}
                  onClick={() => setTool('mark')}
                >
                  <CircleDashed />
                  佔位
                </button>
                <button
                  role="radio"
                  aria-checked={tool === 'note'}
                  className={`tool tool-text ${tool === 'note' ? 'active' : ''}`}
                  onClick={() => setTool('note')}
                >
                  <X />
                  排除
                </button>
              </div>
              <p className="tool-detail">
                {selectedUnit !== null ? (
                  <>
                    <RangeDiagram unit={selectedUnit} />
                    <span>
                      <b>{UNITS[selectedUnit].name}</b>　{UNITS[selectedUnit].summary}
                    </span>
                  </>
                ) : tool === 'note' ? (
                  '點格子標記「這裡不會有單位」，再點一次清除'
                ) : (
                  '確定有單位、未定兵種時佔位；會自動排除周圍與已滿的列欄，但不算兵力'
                )}
              </p>
              <div className="toggles">
                <Toggle label="顯示射程" checked={prefs.ranges} onChange={(v) => setPrefs((p) => ({ ...p, ranges: v }))} />
                <Toggle label="自動排除" checked={prefs.auto} onChange={(v) => setPrefs((p) => ({ ...p, auto: v }))} />
              </div>
              <Board
                level={level}
                board={board}
                auto={auto}
                covered={covered}
                conflicts={conflicts}
                hint={hint}
                showRanges={prefs.ranges}
                locked={solved || !hydrated}
                tool={tool}
                onTap={tap}
                onDirect={direct}
              />
              <output
                aria-live="polite"
                className={`game-message ${solved ? 'success' : conflicts.size ? 'warning' : ''}`}
              >
                {solved
                  ? levelIndex === bank.length - 1
                    ? mode === 'story'
                      ? '劇情完成！六種兵種都已上陣，接著挑戰關卡模式吧。'
                      : `${bank.length} 關全數攻克，王城已被拿下！`
                    : levelIndex === chapter.to
                      ? `第 ${chapterNo + 1} ${CHAPTER_WORD[mode]}「${chapter.name}」完成！`
                      : '全軍就位，所有敵軍都已被覆蓋！'
                  : conflicts.size
                    ? '有單位彼此相鄰、同列／欄／陣地超過 2 個，或兵種超出數量。'
                    : message}
              </output>
              {hint && (
                <div className="hint-panel" aria-live="polite">
                  <p>
                    <Lightbulb size={18} />
                    {hint.reason}
                  </p>
                  <div>
                    <button className="btn ghost" onClick={() => setHint(null)}>
                      自己試試
                    </button>
                    <button className="btn primary" onClick={applyHint}>
                      套用這一步
                    </button>
                  </div>
                </div>
              )}
              <div className="controls">
                <button className="btn" onClick={undo} disabled={!history.length}>
                  <Undo2 />
                  復原
                </button>
                <button className="btn" onClick={requestHint} disabled={solved || !!hint}>
                  <Lightbulb />
                  提示
                </button>
                <button className="btn" onClick={() => setDialog('reset')} disabled={!board.some(Boolean)}>
                  <RotateCcw />
                  {solved ? '重玩' : '重來'}
                </button>
              </div>
              {solved && (
                <>
                  <div className="completion-badge">
                    {session.hints === 0 ? (
                      <>
                        <Star />
                        無提示攻克
                      </>
                    ) : (
                      <>
                        <Check />
                        已攻克 · 使用提示 {session.hints} 次
                      </>
                    )}
                  </div>
                  <button
                    className="btn primary wide"
                    onClick={() =>
                      canNext ? openLevel(nextSelection) : storyFinished ? openLevel(campaignEntry) : setView('home')
                    }
                  >
                    {canNext
                      ? levelIndex === chapter.to
                        ? `前往下一${CHAPTER_WORD[mode]}`
                        : '下一關'
                      : storyFinished
                        ? '挑戰關卡模式'
                        : '返回主選單'}
                    <ChevronRight />
                  </button>
                </>
              )}
              <p className="tap-help">
                點一下格子：部署單位（預設朝上）· 按住往任一方向滑：決定朝向
                <br />
                對已部署的單位滑動可轉向 · 同一工具再點一次即清除
              </p>
            </section>
          </>
        )}
        {storageMessage && <p className="storage-message">{storageMessage}</p>}
        <footer>{hydrated ? '進度儲存在此瀏覽器' : '正在讀取進度…'}</footer>
      </main>

      <Modal open={dialog === 'rules'} title="規則與兵種" onClose={() => setDialog(null)} wide>
        <ol className="rule-list">
          <li>
            <span>1</span>
            <p>
              <b>佈陣</b>每列、每欄、每個粗線圍起的陣地，都剛好部署 2 個我方單位，共 20 個。
            </p>
          </li>
          <li>
            <span>2</span>
            <p>
              <b>間距</b>我方單位不能彼此相鄰，斜角也不行。敵軍所在格不能部署。
            </p>
          </li>
          <li>
            <span>3</span>
            <p>
              <b>制壓</b>每名敵軍都要落在至少一個我方單位的射程內。射程依單位朝向旋轉，不會被任何棋子阻擋。
            </p>
          </li>
          <li>
            <span>4</span>
            <p>
              <b>兵力</b>每關規定各兵種的數量，全部都要上場。
            </p>
          </li>
        </ol>
        <div className="unit-gallery">
          {UNITS.map((unit, u) => (
            <div key={unit.code} className="unit-card">
              <PieceToken piece={{ unit: u as UnitId, dir: 0 }} small />
              <RangeDiagram unit={u as UnitId} />
              <div>
                <b>{unit.name}</b>
                <p>{unit.summary}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="rule-note">
          點一下格子部署目前選擇的兵種，預設朝上；按住格子往上下左右滑動，放開時就朝那個方向。對已部署的單位滑動可以改變朝向；同一工具再點一次即清除。確定有單位但還沒決定兵種時，可先放「佔位」：它和單位一樣會自動排除周圍與已滿的列、欄、陣地，但不算兵力、不覆蓋敵軍，之後選兵種點它即可替換。鍵盤可用方向鍵部署或轉向。提示會先說明理由，使用提示仍可解鎖下一關。
        </p>
      </Modal>

      <Modal open={dialog === 'levels'} title={MODE_NAME[picker]} onClose={() => setDialog(null)} wide>
        <p className="picker-intro">
          {picker === 'story'
            ? '新手教學：每章加入一種新兵種，從基本佈陣一路學到六兵種齊上陣。'
            : `${CAMPAIGN_CHAPTERS.length} 大關、每關 10 小關，敵軍與兵種組合逐步加難。建議先完成劇情模式。`}
        </p>
        <button className="btn primary wide picker-continue" onClick={() => openLevel(pickerEntry)}>
          {pickerDone === pickerBank.length ? '重玩最後一關' : pickerDone ? '繼續' : '開始'} ·{' '}
          {levelLabel(pickerEntry)}
          <ChevronRight />
        </button>
        {CHAPTERS[picker].map((c, ci) => {
          const levels = pickerBank.slice(c.from, c.to + 1);
          return (
            <div key={c.name} className="chapter-block">
              <h3>
                <span>
                  第 {ci + 1} {CHAPTER_WORD[picker]} · {c.name}
                  <small>
                    {levels.filter((l) => progress.completed.includes(l.id)).length} / {levels.length}
                  </small>
                </span>
                <span className="chapter-units">{c.units.map((u) => UNITS[u].glyph).join(' ')}</span>
              </h3>
              <div className="level-grid">
                {levels.map((l, k) => {
                  const target = { mode: picker, level: c.from + k },
                    open = canOpen(progress, target),
                    done = progress.completed.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      className={`level-tile ${done ? 'done' : ''} ${view === 'play' && mode === picker && target.level === levelIndex ? 'current' : ''}`}
                      disabled={!open}
                      aria-label={`${levelLabel(target)}${done ? '，已攻克' : open ? '' : '，未解鎖'}`}
                      onClick={() => openLevel(target)}
                    >
                      {picker === 'story' ? target.level + 1 : k + 1}
                      {progress.flawless.includes(l.id) ? <Star /> : done ? <Check /> : !open ? <Lock /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </Modal>

      <Modal open={dialog === 'reset'} title="重新佈陣？" onClose={() => setDialog(null)}>
        <p className="dialog-text">這關的部署、計時與提示次數會清空；已解鎖的關卡與攻克紀錄都會保留。</p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => setDialog(null)}>
            取消
          </button>
          <button className="btn primary" onClick={reset}>
            重新開始
          </button>
        </div>
      </Modal>
    </div>
  );
}
