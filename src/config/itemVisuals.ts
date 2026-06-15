import type { ItemType } from './items';
import { getItemLaneMark } from './itemIcons';

export type ItemRoleCategory = 'melee' | 'ranged' | 'support';

export type ItemFrameShape = 'square' | 'circle' | 'diamond' | 'shield';

export interface ItemVisualTheme {
  category: ItemRoleCategory;
  categoryIcon: string;
  familyLabel: string;
  frameColor: number;
  fillColor: number;
  frameShape: ItemFrameShape;
}

/** 四族职业：鼓组主图标 + 音符角标 + 边框形状 */
export const ITEM_VISUALS: Record<ItemType, ItemVisualTheme> = {
  kick: {
    category: 'melee',
    categoryIcon: getItemLaneMark('kick'),
    familyLabel: '节拍拳',
    frameColor: 0xe74c3c,
    fillColor: 0xff8a65,
    frameShape: 'square',
  },
  snare: {
    category: 'ranged',
    categoryIcon: getItemLaneMark('snare'),
    familyLabel: '毒囊炮',
    frameColor: 0x27ae60,
    fillColor: 0x58d68d,
    frameShape: 'circle',
  },
  hihat: {
    category: 'ranged',
    categoryIcon: getItemLaneMark('hihat'),
    familyLabel: '弧光术',
    frameColor: 0x9b59b6,
    fillColor: 0xc39bd3,
    frameShape: 'diamond',
  },
  crash: {
    category: 'melee',
    categoryIcon: getItemLaneMark('crash'),
    familyLabel: '凝霜律',
    frameColor: 0x3498db,
    fillColor: 0x85c1e9,
    frameShape: 'circle',
  },
};

export function getItemVisualTheme(type: ItemType): ItemVisualTheme {
  return ITEM_VISUALS[type];
}

export function isRangedItem(type: ItemType): boolean {
  return ITEM_VISUALS[type].category === 'ranged';
}

export function isMeleeItem(type: ItemType): boolean {
  return ITEM_VISUALS[type].category === 'melee';
}
