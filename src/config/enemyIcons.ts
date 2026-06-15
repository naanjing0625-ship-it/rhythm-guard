import type { TdEnemyDef } from './tdContent';

/** 10 种入侵者对应怪物 emoji */
export const ENEMY_MONSTER_ICONS: Record<string, string> = {
  goblin: '👹',    // 见习勇者 — 小鬼人海
  grunt: '🧟',     // 王国步兵
  fast: '🦂',      // 疾风游侠
  assassin: '🕷️',  // 暗影剑客
  shielder: '🦁',  // 圣盾骑士
  tank: '🦖',      // 重装圣骑士
  healer: '🐍',    // 祝福牧师
  flyer: '🐉',     // 狮鹫骑士（飞行）
  brute: '👾',     // 攻城巨像
  warlord: '🎃',   // 传奇英雄 Boss
};

export function getEnemyNoteSymbol(type: string): string {
  return ENEMY_MONSTER_ICONS[type] ?? '👹';
}

export function getEnemyNoteFontSize(def: TdEnemyDef): string {
  const scale = def.tags?.includes('boss') ? 3.4 : def.tags?.includes('elite') ? 2.8 : 2.4;
  return `${Math.round(def.size * scale)}px`;
}

export function getEnemyNoteAngle(def: TdEnemyDef): number {
  return def.flying ? -18 : 0;
}

export function getEnemyNoteHitRadius(def: TdEnemyDef): number {
  return def.size + 6;
}
