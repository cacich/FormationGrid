// Position layer states shared with the double-grid solver: 0 unknown, 1 excluded, 2 unit.
export type CellState = 0 | 1 | 2;
export type Deduction = {
  cells: number[];
  value: CellState;
  reason: string;
  tier: number;
  focus: number[];
};
