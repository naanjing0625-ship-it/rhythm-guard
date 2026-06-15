import { getItemDef, type ItemInstance } from '../../config/items';

export interface TowerState {
  row: number;
  col: number;
  item: ItemInstance;
  cooldown: number;
  x: number;
  y: number;
}

export function createTowerState(row: number, col: number, item: ItemInstance, cellSize: number, gridOffsetX: number, gridOffsetY: number): TowerState {
  return {
    row,
    col,
    item,
    cooldown: 0,
    x: gridOffsetX + col * cellSize + cellSize / 2,
    y: gridOffsetY + row * cellSize + cellSize / 2,
  };
}

export function getTowerStats(tower: TowerState) {
  return getItemDef(tower.item.type, tower.item.tier);
}
