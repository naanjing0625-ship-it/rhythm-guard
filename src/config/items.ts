import { GAME_HEIGHT, GAME_WIDTH } from '../core/viewport';
import { TD_CONTENT, type AttackMode, type DamageType } from './tdContent';

export type ItemType = 'kick' | 'snare' | 'hihat' | 'crash';
export type { AttackMode };

export interface ItemDef {
  type: ItemType;
  tier: number;
  name: string;
  color: number;
  damage: number;
  range: number;
  attackSpeed: number;
  attackMode: AttackMode;
  damageType: DamageType;
  aoeRadius?: number;
  chainCount?: number;
  shieldAmount?: number;
  slowPercent?: number;
  slowDurationSec?: number;
}

export interface ItemInstance {
  id: string;
  type: ItemType;
  tier: number;
}

export const LANE_KEYS = ['D', 'F', 'J', 'K'] as const;
export const LANE_TYPES: ItemType[] = ['kick', 'snare', 'hihat', 'crash'];
export const MAX_TIER = 4;
export const GRID_SIZE = TD_CONTENT.defense.grid.size;
export const CORE_CELLS = TD_CONTENT.defense.grid.coreCells.map(([row, col]) => ({ row, col }));

/** 自适应棋盘在 960×640 画面内的格子像素尺寸 */
export const GRID_CELL_SIZE = Math.min(
  Math.floor((GAME_WIDTH - 48) / GRID_SIZE),
  Math.floor((GAME_HEIGHT - 160) / GRID_SIZE),
);

export function getCorePixelPosition(cellSize: number, gridX: number, gridY: number): { x: number; y: number } {
  const rows = CORE_CELLS.map((c) => c.row);
  const cols = CORE_CELLS.map((c) => c.col);
  const centerRow = (Math.min(...rows) + Math.max(...rows) + 1) / 2;
  const centerCol = (Math.min(...cols) + Math.max(...cols) + 1) / 2;
  return {
    x: gridX + centerCol * cellSize,
    y: gridY + centerRow * cellSize,
  };
}

export function getItemDef(type: ItemType, tier: number): ItemDef {
  const family = TD_CONTENT.towers[type];
  const attack = TD_CONTENT.attacks[family.attackId];
  const tierDef = family.tiers.find((t) => t.tier === tier) ?? family.tiers[tier - 1];
  if (!tierDef) throw new Error(`Tower tier not found: ${type} T${tier}`);

  return {
    type,
    tier,
    name: tierDef.name,
    color: family.color,
    damage: tierDef.damage,
    range: tierDef.range,
    attackSpeed: tierDef.attackSpeed,
    attackMode: attack.mode,
    damageType: attack.damageType,
    aoeRadius: tierDef.aoeRadius,
    chainCount: tierDef.chainCount,
    shieldAmount: tierDef.shieldAmount,
    slowPercent: tierDef.slowPercent,
    slowDurationSec: tierDef.slowDurationSec,
  };
}

export function createItemInstance(type: ItemType, tier: number): ItemInstance {
  return { id: `${type}_${tier}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, type, tier };
}

export function canMerge(a: ItemInstance, other: ItemInstance): boolean {
  return a.type === other.type && a.tier === other.tier && a.tier < MAX_TIER;
}

export function mergeItems(a: ItemInstance, _other: ItemInstance): ItemInstance {
  return createItemInstance(a.type, a.tier + 1);
}

export function isCoreCell(row: number, col: number): boolean {
  return CORE_CELLS.some((c) => c.row === row && c.col === col);
}
