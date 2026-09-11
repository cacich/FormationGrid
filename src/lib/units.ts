// Direction 0 faces up (toward row 0); each step turns 90° clockwise.
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: readonly Dir[] = [0, 1, 2, 3];
export const DIR_NAMES = ['上', '右', '下', '左'] as const;

export type UnitId = 0 | 1 | 2 | 3 | 4 | 5;
export type Piece = { unit: UnitId; dir: Dir };
export type UnitDef = {
  code: string;
  glyph: string;
  name: string;
  summary: string;
  // Offsets [row, col] while facing up; negative row is forward.
  range: readonly (readonly [number, number])[];
};

export const UNITS: readonly UnitDef[] = [
  { code: 'S', glyph: '兵', name: '步兵', summary: '正前方 1 格', range: [[-1, 0]] },
  {
    code: 'A',
    glyph: '弓',
    name: '弓兵',
    summary: '正前方直線 3 格',
    range: [[-1, 0], [-2, 0], [-3, 0]],
  },
  {
    code: 'W',
    glyph: '劍',
    name: '劍士',
    summary: '左前、正前、右前 3 格',
    range: [[-1, -1], [-1, 0], [-1, 1]],
  },
  {
    code: 'K',
    glyph: '騎',
    name: '騎兵',
    summary: '前方日字跳躍 2 格',
    range: [[-2, -1], [-2, 1]],
  },
  {
    code: 'M',
    glyph: '法',
    name: '法師',
    summary: '左前、右前斜線各 2 格',
    range: [[-1, -1], [-2, -2], [-1, 1], [-2, 2]],
  },
  {
    code: 'G',
    glyph: '將',
    name: '將軍',
    summary: '前方 3 格、左右 2 格、正後 1 格',
    range: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]],
  },
];
export const UNIT_IDS = UNITS.map((_, i) => i as UnitId);

export function rotate(dr: number, dc: number, dir: Dir): [number, number] {
  for (let i = 0; i < dir; i++) [dr, dc] = [dc, -dr];
  return [dr + 0, dc + 0];
}

// Ranges are fixed patterns: nothing on the board blocks them.
export function coverage(cell: number, unit: UnitId, dir: Dir, n: number) {
  const r = Math.floor(cell / n),
    c = cell % n,
    cells: number[] = [];
  for (const [dr, dc] of UNITS[unit].range) {
    const [a, b] = rotate(dr, dc, dir);
    if (r + a >= 0 && r + a < n && c + b >= 0 && c + b < n)
      cells.push((r + a) * n + c + b);
  }
  return cells;
}

export const encodePiece = (piece: Piece) => UNITS[piece.unit].code + piece.dir;
export function decodePiece(code: string | undefined): Piece | null {
  if (!code || code.length !== 2) return null;
  const unit = UNITS.findIndex((u) => u.code === code[0]),
    dir = Number(code[1]);
  if (unit < 0 || !Number.isInteger(dir) || dir < 0 || dir > 3) return null;
  return { unit: unit as UnitId, dir: dir as Dir };
}
