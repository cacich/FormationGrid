import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { MARK, NOTE, type Board as BoardState, type Level } from '../lib/game.ts';
import type { Hint } from '../lib/hints.ts';
import { DIR_NAMES, UNITS, coverage, decodePiece, type Dir, type Piece, type UnitId } from '../lib/units.ts';
import { EnemyToken, MarkToken, PieceToken } from './PieceToken.tsx';

export type Tool = UnitId | 'note' | 'mark';
type Drag = { index: number; x: number; y: number; id: number; dir: Dir | null };

const KEY_DIRS: Record<string, Dir> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };

export function Board({
  level,
  board,
  auto,
  covered,
  conflicts,
  hint,
  showRanges,
  locked,
  tool,
  onTap,
  onDirect,
}: {
  level: Level;
  board: BoardState;
  auto: Set<number>;
  covered: Set<number>;
  conflicts: Set<number>;
  hint: Hint | null;
  showRanges: boolean;
  locked: boolean;
  tool: Tool;
  onTap: (index: number) => void;
  onDirect: (index: number, dir: Dir) => void;
}) {
  const n = level.regions.length,
    enemies = useMemo(() => new Set(level.enemies), [level]),
    boardRef = useRef<HTMLDivElement>(null),
    drag = useRef<Drag | null>(null),
    [preview, setPreview] = useState<{ index: number; dir: Dir | null } | null>(null);

  // What the pressed cell would hold after release: its own unit re-aimed, or the selected unit.
  let previewPiece: Piece | null = null;
  if (preview) {
    const current = decodePiece(board[preview.index]);
    if (current) previewPiece = { unit: current.unit, dir: preview.dir ?? current.dir };
    else if (typeof tool === 'number') previewPiece = { unit: tool, dir: preview.dir ?? 0 };
  }
  const previewRange = new Set(
    preview && previewPiece ? coverage(preview.index, previewPiece.unit, previewPiece.dir, n) : [],
  );

  const indexFrom = (target: EventTarget) => {
    const cell = (target as HTMLElement).closest<HTMLElement>('[data-index]');
    return cell ? Number(cell.dataset.index) : -1;
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const index = indexFrom(e.target);
    if (index < 0) return;
    if (enemies.has(index)) {
      onTap(index);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { index, x: e.clientX, y: e.clientY, id: e.pointerId, dir: null };
    setPreview({ index, dir: null });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y,
      threshold = Math.max(10, ((boardRef.current?.clientWidth ?? 300) / n) * 0.35);
    const dir: Dir | null =
      Math.hypot(dx, dy) < threshold
        ? null
        : Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? 1
            : 3
          : dy > 0
            ? 2
            : 0;
    if (dir !== d.dir) {
      d.dir = dir;
      setPreview({ index: d.index, dir });
    }
  };
  const finish = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setPreview(null);
    if (cancelled) return;
    if (d.dir === null) onTap(d.index);
    else onDirect(d.index, d.dir);
  };

  return (
    <div
      ref={boardRef}
      className="board"
      role="group"
      aria-label={`${n} 乘 ${n} 戰場`}
      style={{ '--size': n } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {board.map((code, index) => {
        const row = Math.floor(index / n),
          col = index % n,
          region = level.regions[row][col],
          piece = decodePiece(code),
          isEnemy = enemies.has(index),
          isAuto = !code && auto.has(index),
          pressed = preview?.index === index,
          shown = pressed && previewPiece ? previewPiece : piece;
        const edge = (same: boolean) => (same ? 0.5 : 2);
        return (
          <button
            key={index}
            data-index={index}
            className={[
              'cell',
              `region-${region}`,
              isEnemy && 'enemy-cell',
              showRanges && covered.has(index) && !isEnemy && 'in-range',
              previewRange.has(index) && 'preview-range',
              conflicts.has(index) && 'conflict',
              hint?.focus.includes(index) && 'hint-focus',
              hint?.cells.includes(index) && 'hint-target',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              borderTopWidth: edge(row > 0 && level.regions[row - 1][col] === region),
              borderRightWidth: edge(col < n - 1 && level.regions[row][col + 1] === region),
              borderBottomWidth: edge(row < n - 1 && level.regions[row + 1][col] === region),
              borderLeftWidth: edge(col > 0 && level.regions[row][col - 1] === region),
            }}
            aria-label={`第 ${row + 1} 列第 ${col + 1} 欄，陣地 ${region + 1}，${
              isEnemy
                ? covered.has(index)
                  ? '敵軍，已被覆蓋'
                  : '敵軍，尚未覆蓋'
                : piece
                  ? `${UNITS[piece.unit].name}朝${DIR_NAMES[piece.dir]}`
                  : code === MARK
                    ? '佔位標記'
                    : code === NOTE
                    ? '已排除'
                    : isAuto
                      ? '自動排除'
                      : '空白'
            }`}
            aria-invalid={conflicts.has(index) || undefined}
            onClick={(e) => {
              // Pointer input is handled on the board; this only serves keyboard activation.
              if (e.detail === 0) onTap(index);
            }}
            onKeyDown={(e) => {
              const dir = KEY_DIRS[e.key];
              if (dir === undefined || locked || isEnemy) return;
              e.preventDefault();
              onDirect(index, dir);
            }}
          >
            {isEnemy && <EnemyToken suppressed={covered.has(index)} />}
            {!isEnemy && (code === NOTE || isAuto) && !shown && (
              <span className={`note-dot ${isAuto ? 'auto-note' : ''}`} />
            )}
            {code === MARK && !shown && <MarkToken conflict={conflicts.has(index)} />}
            {shown && (
              <PieceToken
                piece={shown}
                ghost={pressed && !piece}
                conflict={!pressed && conflicts.has(index)}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
