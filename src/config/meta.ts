export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  effect: (level: number) => MetaEffects;
}

export interface MetaEffects {
  judgementBonusMs: number;
  mergeLimitBonus: number;
  coreHpBonus: number;
  lootBonus: number;
}

export const META_UPGRADES: MetaUpgrade[] = [
  {
    id: 'timing',
    name: '节奏感知',
    description: '扩大判定窗口',
    maxLevel: 5,
    costPerLevel: 3,
    effect: (lv) => ({ judgementBonusMs: lv * 5, mergeLimitBonus: 0, coreHpBonus: 0, lootBonus: 0 }),
  },
  {
    id: 'merge',
    name: '合成大师',
    description: '每关额外合成次数',
    maxLevel: 3,
    costPerLevel: 5,
    effect: (lv) => ({ judgementBonusMs: 0, mergeLimitBonus: lv, coreHpBonus: 0, lootBonus: 0 }),
  },
  {
    id: 'fortress',
    name: '堡垒强化',
    description: '核心塔额外生命值',
    maxLevel: 5,
    costPerLevel: 4,
    effect: (lv) => ({ judgementBonusMs: 0, mergeLimitBonus: 0, coreHpBonus: lv * 20, lootBonus: 0 }),
  },
  {
    id: 'fortune',
    name: '幸运律动',
    description: '高阶道具掉落加成',
    maxLevel: 3,
    costPerLevel: 6,
    effect: (lv) => ({ judgementBonusMs: 0, mergeLimitBonus: 0, coreHpBonus: 0, lootBonus: lv * 0.1 }),
  },
];

export function computeMetaEffects(levels: Record<string, number>): MetaEffects {
  const result: MetaEffects = { judgementBonusMs: 0, mergeLimitBonus: 0, coreHpBonus: 0, lootBonus: 0 };
  for (const upgrade of META_UPGRADES) {
    const lv = levels[upgrade.id] ?? 0;
    const fx = upgrade.effect(lv);
    result.judgementBonusMs += fx.judgementBonusMs;
    result.mergeLimitBonus += fx.mergeLimitBonus;
    result.coreHpBonus += fx.coreHpBonus;
    result.lootBonus += fx.lootBonus;
  }
  return result;
}
