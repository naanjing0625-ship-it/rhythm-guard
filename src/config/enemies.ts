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

export function computeDamageAfterArmor(
  rawDamage: number,
  enemy: EnemyDef,
  damageType: DamageType,
): number {
  const mult = getArmorDamageMultiplier(enemy.armorType, damageType);
  return Math.max(1, Math.round(rawDamage * mult));
}
