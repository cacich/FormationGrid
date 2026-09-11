import { UNITS, type Piece, type UnitId } from '../lib/units.ts';

export function PieceToken({
  piece,
  ghost,
  conflict,
  small,
}: {
  piece: Piece;
  ghost?: boolean;
  conflict?: boolean;
  small?: boolean;
}) {
  const unit = UNITS[piece.unit];
  return (
    <span
      className={`piece piece-${unit.code} ${ghost ? 'ghost' : ''} ${conflict ? 'conflict' : ''} ${small ? 'small' : ''}`}
      aria-hidden="true"
    >
      <span
        className="piece-facing"
        style={{ transform: `rotate(${piece.dir * 90}deg)` }}
      >
        <span className="piece-arrow" />
      </span>
      <span className="piece-glyph">{unit.glyph}</span>
    </span>
  );
}

// 5×5 diagram facing up: rows -3..+1, cols -2..+2 around the unit.
export function RangeDiagram({ unit }: { unit: UnitId }) {
  const hits = new Set(UNITS[unit].range.map(([r, c]) => `${r},${c}`));
  return (
    <span className="range-diagram" aria-hidden="true">
      {Array.from({ length: 25 }, (_, i) => {
        const r = Math.floor(i / 5) - 3,
          c = (i % 5) - 2;
        return (
          <span
            key={i}
            className={r === 0 && c === 0 ? 'self' : hits.has(`${r},${c}`) ? 'hit' : ''}
          />
        );
      })}
    </span>
  );
}

export function EnemyToken({ suppressed }: { suppressed: boolean }) {
  return (
    <span className={`enemy ${suppressed ? 'suppressed' : ''}`} aria-hidden="true">
      <span className="enemy-glyph">敵</span>
    </span>
  );
}
