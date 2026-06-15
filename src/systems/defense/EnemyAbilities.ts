import { healEnemy, type EnemyState } from './Enemy';

export interface HealAuraConfig {
  id: 'heal_aura';
  radius: number;
  amount: number;
  intervalMs: number;
}

export interface EnrageConfig {
  id: 'enrage';
  thresholdHpRatio: number;
  speedMult: number;
  damageMult: number;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function getHealAura(def: EnemyState['def']): HealAuraConfig | null {
  const raw = def.abilities?.find((a) => a.id === 'heal_aura');
  if (!raw) return null;
  return raw as unknown as HealAuraConfig;
}

function getEnrage(def: EnemyState['def']): EnrageConfig | null {
  const raw = def.abilities?.find((a) => a.id === 'enrage');
  if (!raw) return null;
  return raw as unknown as EnrageConfig;
}

export interface AbilityUpdateResult {
  healed: EnemyState[];
  enraged: EnemyState[];
}

export function updateEnemyAbilities(enemies: EnemyState[], deltaMs: number): AbilityUpdateResult {
  const healed: EnemyState[] = [];
  const enraged: EnemyState[] = [];

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const enrage = getEnrage(enemy.def);
    if (enrage && !enemy.enraged && enemy.hp / enemy.maxHp <= enrage.thresholdHpRatio) {
      enemy.enraged = true;
      enemy.speedMult = enrage.speedMult;
      enemy.damageMult = enrage.damageMult;
      enraged.push(enemy);
    }
  }

  for (const healer of enemies) {
    if (!healer.alive) continue;
    const aura = getHealAura(healer.def);
    if (!aura) continue;

    healer.healTimerMs -= deltaMs;
    if (healer.healTimerMs > 0) continue;
    healer.healTimerMs = aura.intervalMs;

    for (const ally of enemies) {
      if (!ally.alive || ally.id === healer.id) continue;
      if (dist(healer.x, healer.y, ally.x, ally.y) > aura.radius) continue;
      if (healEnemy(ally, aura.amount)) healed.push(ally);
    }
  }

  return { healed, enraged };
}
