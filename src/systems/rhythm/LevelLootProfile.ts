import { ENEMY_DEFS } from '../../config/enemies';
import type { ItemType } from '../../config/items';
import { getLevel } from '../../config/levels';

export interface LevelThreatProfile {
  levelId: string;
  totalUnits: number;
  flyingUnits: number;
  armoredUnits: number;
  healerUnits: number;
  bossUnits: number;
  flyingRatio: number;
}

/** 可攻击飞行单位：毒囊炮（溅射）、弧光术（连锁） */
export const ANTI_AIR_TYPES: ItemType[] = ['snare', 'hihat'];

/** 近战单体，无法攻击飞行 */
export const GROUND_ONLY_TYPES: ItemType[] = ['kick', 'crash'];

export function analyzeLevelThreat(levelId: string): LevelThreatProfile {
  const level = getLevel(levelId);
  let flyingUnits = 0;
  let totalUnits = 0;
  let armoredUnits = 0;
  let healerUnits = 0;
  let bossUnits = 0;

  for (const wave of level.waves) {
    for (const group of wave.enemies) {
      const def = ENEMY_DEFS[group.type];
      if (!def) continue;
      totalUnits += group.count;
      if (def.flying) flyingUnits += group.count;
      if (def.armorType === 'armored' || def.armorType === 'boss') armoredUnits += group.count;
      if (def.armorType === 'boss') bossUnits += group.count;
      if (group.type === 'healer' || def.tags?.includes('healer')) healerUnits += group.count;
    }
  }

  return {
    levelId,
    totalUnits,
    flyingUnits,
    armoredUnits,
    healerUnits,
    bossUnits,
    flyingRatio: totalUnits > 0 ? flyingUnits / totalUnits : 0,
  };
}

export function applyThreatToTypeWeights(
  weights: Record<ItemType, number>,
  profile: LevelThreatProfile,
): Record<ItemType, number> {
  const w = { ...weights };

  if (profile.flyingUnits > 0) {
    const flyBoost = 1.2 + profile.flyingRatio * 2.5 + (profile.flyingUnits >= 6 ? 0.4 : 0);
    w.snare *= flyBoost;
    w.hihat *= flyBoost;
    w.kick *= 0.6;
    w.crash *= 0.72;
  }

  if (profile.armoredUnits >= 4) {
    w.snare *= 1.35;
    w.hihat *= 1.12;
  }

  if (profile.healerUnits >= 2) {
    w.hihat *= 1.18;
    w.snare *= 1.12;
  }

  if (profile.bossUnits > 0) {
    w.snare *= 1.1;
    w.hihat *= 1.15;
    w.crash *= 1.08;
  }

  return w;
}

/** 按关卡飞行怪数量保证最低对空道具数 */
export function minAntiAirItems(profile: LevelThreatProfile): number {
  if (profile.flyingUnits === 0) return 0;
  if (profile.flyingUnits <= 4) return 1;
  if (profile.flyingUnits <= 8) return 2;
  return Math.min(4, Math.ceil(profile.flyingUnits / 3));
}

export function rebalanceLootForThreat(types: ItemType[], profile: LevelThreatProfile): ItemType[] {
  const required = minAntiAirItems(profile);
  if (required <= 0) return types;

  const result = [...types];
  let antiCount = result.filter((t) => ANTI_AIR_TYPES.includes(t)).length;
  if (antiCount >= required) return result;

  const cycle: ItemType[] = ['snare', 'hihat'];
  let pick = 0;

  const replaceAt = (i: number): void => {
    result[i] = cycle[pick % cycle.length];
    pick++;
    antiCount++;
  };

  for (let i = result.length - 1; i >= 0 && antiCount < required; i--) {
    if (GROUND_ONLY_TYPES.includes(result[i])) replaceAt(i);
  }
  for (let i = result.length - 1; i >= 0 && antiCount < required; i--) {
    if (!ANTI_AIR_TYPES.includes(result[i])) replaceAt(i);
  }

  return result;
}
