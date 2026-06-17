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

const ALL_ITEM_TYPES: ItemType[] = ['kick', 'snare', 'hihat', 'crash'];

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

/** 关卡级掉落倾向（乘到类型权重上） */
const LEVEL_TYPE_BIAS: Record<string, Partial<Record<ItemType, number>>> = {
  level_05: { snare: 1.25, hihat: 1.15, kick: 0.75 },
  level_06: { snare: 1.3, hihat: 1.2, kick: 0.7 },
  level_07: { snare: 1.55, hihat: 1.45, kick: 0.4, crash: 0.65 },
};

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

  if (profile.flyingRatio >= 0.15 || profile.flyingUnits >= 8) {
    w.snare *= 1.25;
    w.hihat *= 1.2;
    w.kick *= 0.5;
    w.crash *= 0.68;
  }

  const levelBias = LEVEL_TYPE_BIAS[profile.levelId];
  if (levelBias) {
    for (const type of ALL_ITEM_TYPES) {
      if (levelBias[type] != null) w[type] *= levelBias[type]!;
    }
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

/** 关卡保底对空道具数（覆盖通用公式） */
const LEVEL_ANTI_AIR_FLOOR: Record<string, number> = {
  level_05: 2,
  level_06: 3,
  level_07: 6,
};

/** 按关卡飞行怪数量保证最低对空道具数 */
export function minAntiAirItems(profile: LevelThreatProfile, totalCount = 0): number {
  if (profile.flyingUnits === 0) return 0;
  let min = 0;
  if (profile.flyingUnits <= 4) min = 1;
  else if (profile.flyingUnits <= 8) min = 2;
  else min = Math.min(5, Math.ceil(profile.flyingUnits / 3));

  const floor = LEVEL_ANTI_AIR_FLOOR[profile.levelId];
  if (floor != null) min = Math.max(min, floor);

  if (totalCount > 0 && profile.flyingRatio >= 0.12) {
    min = Math.max(min, Math.ceil(totalCount * 0.35));
  }

  return Math.min(totalCount || min, min);
}

export function rebalanceLootForThreat(types: ItemType[], profile: LevelThreatProfile): ItemType[] {
  const required = minAntiAirItems(profile, types.length);
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
