import raw from '../data/td/rhythm_guard_td.json';

export type DamageType = 'physical' | 'magic' | 'explosive' | 'chain' | 'true';
export type ArmorType = 'light' | 'armored' | 'flying' | 'boss';
export type AttackMode = 'melee' | 'aoe' | 'chain' | 'shield';

export interface TdAttackDef {
  id: string;
  name: string;
  mode: AttackMode;
  damageType: DamageType;
  targeting: string;
  description: string;
}

export interface TdEnemyDef {
  type: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  reward: number;
  color: number;
  size: number;
  armorType: ArmorType;
  flying?: boolean;
  tags?: string[];
  abilities?: Array<Record<string, unknown>>;
  krAnalogue?: string;
  btdAnalogue?: string;
}

export interface WaveEnemyGroup {
  type: string;
  count: number;
  interval: number;
}

/** @deprecated use WaveEnemyGroup */
export type WaveEnemy = WaveEnemyGroup;

export interface WaveConfig {
  enemies: WaveEnemyGroup[];
  delayBefore: number;
  templateId?: string;
  templateName?: string;
  /** 终局 Boss 战：Boss 必须被击杀才能胜利，抵达核心仅持续扣血 */
  bossFinale?: boolean;
  /** 终局波 Boss 额外 HP 倍率（仅 bossFinale 波次） */
  bossHpMult?: number;
  /** 终局波 Boss 对核伤害倍率 */
  bossDamageMult?: number;
}

export interface TdTowerTier {
  tier: number;
  name: string;
  damage: number;
  range: number;
  attackSpeed: number;
  aoeRadius?: number;
  chainCount?: number;
  shieldAmount?: number;
  slowPercent?: number;
  slowDurationSec?: number;
}

export interface TdTowerFamily {
  family: string;
  role: string;
  attackId: string;
  color: number;
  tiers: TdTowerTier[];
}

export interface TdContent {
  meta: { version: string; referenceGames: string[]; designNotes: string };
  defense: {
    core: { name: string; radius: number; description: string };
    grid: { size: number; coreCells: number[][] };
    spawn: { edges: string[]; defaultEdge: string };
    scaling: {
      hpPerWave: number;
      damagePerWave: number;
      speedPerWave: number;
      rewardPerWave: number;
    };
    economy: {
      killRewardEnabled: boolean;
      waveClearBonus: number;
      sellRefundRatio: number;
      repairCost: number;
      repairHp: number;
    };
    armorRules: Record<ArmorType, Partial<Record<DamageType, number>>>;
  };
  attacks: Record<string, TdAttackDef>;
  towers: Record<string, TdTowerFamily>;
  enemies: Record<string, TdEnemyDef>;
  waveTemplates: Record<string, WaveConfig & { id: string; name: string; threatBudget: number; bossFinale?: boolean }>;
  levels: Record<string, { coreHp: number; scaling?: LevelScaling; waves: string[] }>;
}

export interface LevelScaling {
  hp: number;
  damage: number;
  speed: number;
}

const DEFAULT_LEVEL_SCALING: LevelScaling = { hp: 1, damage: 1, speed: 1 };

export const TD_CONTENT = raw as TdContent;

export function getTdWaveTemplate(id: string): WaveConfig {
  const t = TD_CONTENT.waveTemplates[id];
  if (!t) throw new Error(`Wave template not found: ${id}`);
  return { delayBefore: t.delayBefore, enemies: t.enemies };
}

export function getTdLevelWaves(levelId: string): WaveConfig[] {
  const lvl = TD_CONTENT.levels[levelId];
  if (!lvl) throw new Error(`TD level not found: ${levelId}`);
  return lvl.waves.map((id) => {
    const t = TD_CONTENT.waveTemplates[id];
    if (!t) throw new Error(`Wave template not found: ${id}`);
    return {
      delayBefore: t.delayBefore,
      enemies: t.enemies,
      templateId: id,
      templateName: t.name,
      bossFinale: t.bossFinale,
      bossHpMult: t.bossHpMult,
      bossDamageMult: t.bossDamageMult,
    };
  });
}

export function getTdLevelCoreHp(levelId: string): number | undefined {
  return TD_CONTENT.levels[levelId]?.coreHp;
}

export function getTdLevelScaling(levelId: string): LevelScaling {
  return TD_CONTENT.levels[levelId]?.scaling ?? DEFAULT_LEVEL_SCALING;
}

export function getArmorDamageMultiplier(armorType: ArmorType, damageType: DamageType): number {
  const rule = TD_CONTENT.defense.armorRules[armorType]?.[damageType] ?? 0;
  return 1 + rule;
}
