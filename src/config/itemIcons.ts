import type { ItemType } from './items';

/**
 * 四轨鼓组主图标（与节奏阶段 Kick / Snare / Hi-hat / Crash 对应）
 * 阶数由右下角 lv 角标区分，不再按 tier 换图。
 */
export const ITEM_ICONS: Record<ItemType, string> = {
  kick: '🥁',   // Kick 底鼓
  snare: '🪘',  // Snare 军鼓
  hihat: '🎵',  // Hi-hat 踩镲
  crash: '✨',  // Crash 碎音镲
};

/** 左上角音律角标（音符记号，与主图标区分） */
export const ITEM_LANE_MARKS: Record<ItemType, string> = {
  kick: '♩',
  snare: '♪',
  hihat: '♫',
  crash: '♬',
};

export function getItemIcon(type: ItemType, _tier?: number): string {
  return ITEM_ICONS[type];
}

export function getItemLaneMark(type: ItemType): string {
  return ITEM_LANE_MARKS[type];
}

export function getItemIconFontSize(displaySize: number): string {
  return `${Math.round(displaySize * 0.42)}px`;
}
