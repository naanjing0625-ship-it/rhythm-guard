import { computeDamageAfterArmor, type EnemyDef } from '../../config/enemies';
import type { DamageType } from '../../config/tdContent';

export interface EnemyState {
  id: string;
  def: EnemyDef;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  pathIndex: number;
  alive: boolean;
  speedMult: number;
  damageMult: number;
  enraged: boolean;
  healTimerMs: number;
  slowRemainingSec: number;
  slowStrength: number;
  /** Boss 抵达核心后持续围攻，不会被「漏怪」逻辑移除 */
  siegingCore?: boolean;
  coreSiegeCooldownSec?: number;
}

export function isBossEnemy(enemy: EnemyState | EnemyDef): boolean {
  const def = 'def' in enemy ? enemy.def : enemy;
  return def.armorType === 'boss' || !!def.tags?.includes('boss');
}

let enemyIdCounter = 0;

function getHealAuraIntervalMs(def: EnemyDef): number {
  const aura = def.abilities?.find((a) => a.id === 'heal_aura') as { intervalMs?: number } | undefined;
  return aura?.intervalMs ?? 0;
}

export function createEnemy(def: EnemyDef, x: number, y: number): EnemyState {
  return {
    id: `enemy_${++enemyIdCounter}`,
    def,
    hp: def.hp,
    maxHp: def.hp,
    x,
    y,
    pathIndex: 0,
    alive: true,
    speedMult: 1,
    damageMult: 1,
    enraged: false,
    healTimerMs: getHealAuraIntervalMs(def),
    slowRemainingSec: 0,
    slowStrength: 0,
  };
}

export function healEnemy(enemy: EnemyState, amount: number): boolean {
  if (!enemy.alive) return false;
  const before = enemy.hp;
  enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
  return enemy.hp > before;
}

export function applySlow(enemy: EnemyState, strength: number, durationSec: number): void {
  if (!enemy.alive) return;
  enemy.slowStrength = Math.max(enemy.slowStrength, strength);
  enemy.slowRemainingSec = Math.max(enemy.slowRemainingSec, durationSec);
}

export function tickEnemySlow(enemy: EnemyState, deltaSec: number): void {
  if (enemy.slowRemainingSec <= 0) return;
  enemy.slowRemainingSec -= deltaSec;
  if (enemy.slowRemainingSec <= 0) {
    enemy.slowRemainingSec = 0;
    enemy.slowStrength = 0;
  }
}

export function isEnemySlowed(enemy: EnemyState): boolean {
  return enemy.slowRemainingSec > 0 && enemy.slowStrength > 0;
}

export function getEnemyMoveSpeed(enemy: EnemyState): number {
  const slowFactor = isEnemySlowed(enemy) ? Math.max(0.15, 1 - enemy.slowStrength) : 1;
  return enemy.def.speed * enemy.speedMult * slowFactor;
}

export function getEnemyCoreDamage(enemy: EnemyState): number {
  return Math.round(enemy.def.damage * enemy.damageMult);
}

export interface DamageResult {
  killed: boolean;
  dealt: number;
  resisted: boolean;
}

export function damageEnemy(enemy: EnemyState, amount: number, damageType: DamageType = 'physical'): DamageResult {
  const dealt = computeDamageAfterArmor(amount, enemy.def, damageType);
  const resisted = dealt < amount;
  enemy.hp -= dealt;
  if (enemy.hp <= 0) {
    enemy.alive = false;
    return { killed: true, dealt, resisted };
  }
  return { killed: false, dealt, resisted };
}
