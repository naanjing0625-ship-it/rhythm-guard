import { GRID_SIZE, isCoreCell, type ItemInstance } from '../../config/items';
import type { PlacedTower } from '../../core/GameState';

export interface GridCell {
  row: number;
  col: number;
  item: ItemInstance | null;
  isCore: boolean;
}

export class GridBoard {
  readonly size = GRID_SIZE;
  private cells: GridCell[][];

  constructor(placed: PlacedTower[] = []) {
    this.cells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      this.cells[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const placedItem = placed.find((p) => p.row === r && p.col === c);
        this.cells[r][c] = {
          row: r,
          col: c,
          item: placedItem?.item ?? null,
          isCore: isCoreCell(r, c),
        };
      }
    }
  }

  getCell(row: number, col: number): GridCell | null {
    if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return null;
    return this.cells[row][col];
  }

  canPlace(row: number, col: number): boolean {
    const cell = this.getCell(row, col);
    return !!cell && !cell.isCore && !cell.item;
  }

  place(row: number, col: number, item: ItemInstance): boolean {
    if (!this.canPlace(row, col)) return false;
    this.cells[row][col].item = item;
    return true;
  }

  remove(row: number, col: number): ItemInstance | null {
    const cell = this.getCell(row, col);
    if (!cell || cell.isCore || !cell.item) return null;
    const item = cell.item;
    cell.item = null;
    return item;
  }

  getNeighbors(row: number, col: number): GridCell[] {
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    return dirs
      .map(([dr, dc]) => this.getCell(row + dr, col + dc))
      .filter((c): c is GridCell => c !== null);
  }

  getPlacedTowers(): PlacedTower[] {
    const result: PlacedTower[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        const item = this.cells[r][c].item;
        if (item) result.push({ row: r, col: c, item });
      }
    }
    return result;
  }

  getCells(): GridCell[][] {
    return this.cells;
  }
}
