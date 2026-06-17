import {
  TD_CONTENT,
  getArmorDamageMultiplier,
  type DamageType,
  type LevelScaling,
  type TdEnemyDef,
  type WaveConfig,
  type WaveEnemyGroup,
} from './tdContent';

export type { WaveConfig, WaveEnemyGroup };

export type EnemyType = string;

export interface EnemyDef extends TdEnemyDef {
  type: EnemyType;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = TD_CONTENT.enemies;

const DEFAULT_LEVEL_SCALING: LevelScaling = { hp: 1, damage: 1, speed: 1 };

export function getScaledEnemy(
  type: EnemyType,
  waveIndex: number,
  levelScaling: LevelScaling = DEFAULT_LEVEL_SCALING,
): EnemyDef {
  const base = ENEMY_DEFS[type];
  if (!base) throw new Error(`Unknown enemy type: ${type}`);
  const { hpPerWave, damagePerWave, speedPerWave, rewardPerWave } = TD_CONTENT.defense.scaling;
  const hpScale = 1 + waveIndex * hpPerWave;
  return {
    ...base,
    hp: Math.round(base.hp * levelScaling.hp * hpScale),
    damage: Math.round(base.damage * levelScaling.damage * (1 + waveIndex * damagePerWave)),
    speed: base.speed * levelScaling.speed * (1 + waveIndex * speedPerWave),
    reward: Math.round(base.reward * (1 + waveIndex * rewardPerWave)),
  };
}

/** 终局 Boss 波次单独缩放（不影响其它关卡/波次） */
export function applyBossFinaleModifiers(def: EnemyDef, wave?: WaveConfig): EnemyDef {
  if (!wave?.bossFinale || def.armorType !== 'boss') return def;
  const hpMult = wave.bossHpMult ?? 1;
  const dmgMult = wave.bossDamageMult ?? 1;
  if (hpMult === 1 && dmgMult === 1) return def;
  return {
    ...def,
    hp: Math.max(1, Math.round(def.hp * hpMult)),
    damage: Math.max(1, Math.round(def.damage * dmgMult)),
  };
}

export function computeDamageAfterArmor(
  rawDamage: number,
  enemy: EnemyDef,
  damageType: DamageType,
): number {
  const mult = getArmorDamageMultiplier(enemy.armorType, damageType);
  return Math.max(1, Math.round(rawDamage * mult));
}
