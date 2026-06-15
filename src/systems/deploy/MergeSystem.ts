import { canMerge, mergeItems, type ItemInstance } from '../../config/items';
import type { GridBoard } from './GridBoard';

export interface MergeResult {
  success: boolean;
  merged?: ItemInstance;
  consumed?: ItemInstance;
  targetRow: number;
  targetCol: number;
  sourceRow: number;
  sourceCol: number;
}

export class MergeSystem {
  tryMerge(board: GridBoard, sourceRow: number, sourceCol: number, targetRow: number, targetCol: number): MergeResult {
    const source = board.getCell(sourceRow, sourceCol);
    const target = board.getCell(targetRow, targetCol);
    const fail = (): MergeResult => ({
      success: false,
      targetRow,
      targetCol,
      sourceRow,
      sourceCol,
    });

    if (!source?.item || !target) return fail();
    if (target.isCore) return fail();

    if (!target.item) {
      board.remove(sourceRow, sourceCol);
      board.place(targetRow, targetCol, source.item);
      return { success: true, targetRow, targetCol, sourceRow, sourceCol };
    }

    if (!canMerge(source.item, target.item)) return fail();

    const merged = mergeItems(source.item, target.item);
    board.remove(sourceRow, sourceCol);
    board.remove(targetRow, targetCol);
    board.place(targetRow, targetCol, merged);

    return {
      success: true,
      merged,
      consumed: source.item,
      targetRow,
      targetCol,
      sourceRow,
      sourceCol,
    };
  }

  findMergeablePair(board: GridBoard): { a: { row: number; col: number }; b: { row: number; col: number } } | null {
    const towers = board.getPlacedTowers();
    for (const t of towers) {
      for (const n of board.getNeighbors(t.row, t.col)) {
        if (n.item && canMerge(t.item, n.item)) {
          return { a: { row: t.row, col: t.col }, b: { row: n.row, col: n.col } };
        }
      }
    }
    return null;
  }
}
