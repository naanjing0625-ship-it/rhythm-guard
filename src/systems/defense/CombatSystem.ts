import { applySlow, damageEnemy, getEnemyCoreDamage, isBossEnemy, type EnemyState } from './Enemy';
import { getTowerStats, type TowerState } from './Tower';
import type { AttackMode } from '../../config/tdContent';

export interface AttackEvent {
  mode: AttackMode;
  color: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  damage: number;
  resisted: boolean;
  aoeRadius?: number;
  chainPoints?: Array<{ x: number; y: number }>;
  appliedSlow?: boolean;
}

export interface CombatResult {
  towerKilled: EnemyState[];
  coreReached: EnemyState[];
  coreDamage: number;
  shieldAbsorbed: number;
  attacks: AttackEvent[];
}

const BOSS_SIEGE_INTERVAL_SEC = 4.2;
/** Boss 围攻核心的伤害倍率（低于普通漏怪，给玩家反应与修复窗口） */
const BOSS_SIEGE_DAMAGE_MULT = 0.32;
const BOSS_SIEGE_GRACE_SEC = 2.2;
/** 终局 Boss 战阶段，塔对 Boss 额外伤害倍率 */
const BOSS_FINALE_TOWER_DAMAGE_MULT = 1.6;

export class CombatSystem {
  update(
    towers: TowerState[],
    enemies: EnemyState[],
    deltaSec: number,
    coreX: number,
    coreY: number,
    coreRadius: number,
    shield: number,
    bossFinaleActive = false,
  ): CombatResult {
    const towerKilled: EnemyState[] = [];
    const coreReached: EnemyState[] = [];
    const attacks: AttackEvent[] = [];
    let coreDamage = 0;
    let shieldAbsorbed = 0;

    for (const tower of towers) {
      tower.cooldown -= deltaSec;
      const stats = getTowerStats(tower);
      if (tower.cooldown > 0) continue;

      if (stats.attackMode === 'shield') {
        continue;
      }

      const inRange = enemies.filter((e) => e.alive && dist(tower.x, tower.y, e.x, e.y) <= stats.range);
      const targets = inRange.filter((e) => canTowerTarget(e, stats.attackMode));
      if (targets.length === 0) continue;

      tower.cooldown = 1 / stats.attackSpeed;

      if (stats.attackMode === 'melee') {
        const target = nearest(tower, targets);
        const hit = damageEnemy(target, towerDamage(target, stats.damage, bossFinaleActive), stats.damageType);
        if (hit.killed) towerKilled.push(target);
        let appliedSlow = false;
        if (stats.slowPercent && stats.slowDurationSec) {
          applySlow(target, stats.slowPercent, stats.slowDurationSec);
          appliedSlow = true;
        }
        attacks.push({
          mode: 'melee',
          color: stats.color,
          fromX: tower.x,
          fromY: tower.y,
          toX: target.x,
          toY: target.y,
          damage: hit.dealt,
          resisted: hit.resisted,
          appliedSlow,
        });
      } else if (stats.attackMode === 'aoe') {
        const radius = stats.aoeRadius ?? 60;
        const primary = nearest(tower, targets);
        const splash = targets.filter((t) => dist(primary.x, primary.y, t.x, t.y) <= radius);
        let totalDealt = 0;
        let anyResisted = false;
        for (const t of splash) {
          const hit = damageEnemy(t, towerDamage(t, stats.damage, bossFinaleActive), stats.damageType);
          totalDealt += hit.dealt;
          anyResisted = anyResisted || hit.resisted;
          if (hit.killed) towerKilled.push(t);
        }
        attacks.push({
          mode: 'aoe',
          color: stats.color,
          fromX: tower.x,
          fromY: tower.y,
          toX: primary.x,
          toY: primary.y,
          damage: totalDealt,
          resisted: anyResisted,
          aoeRadius: radius,
        });
      } else if (stats.attackMode === 'chain') {
        let chains = stats.chainCount ?? 2;
        let current = nearest(tower, targets);
        const hit = new Set<string>();
        const chainPoints: Array<{ x: number; y: number }> = [{ x: tower.x, y: tower.y }];
        let totalDealt = 0;
        let anyResisted = false;
        let lastX = tower.x;
        let lastY = tower.y;

        while (chains > 0 && current) {
          if (hit.has(current.id)) break;
          hit.add(current.id);
          const result = damageEnemy(current, towerDamage(current, stats.damage, bossFinaleActive), stats.damageType);
          totalDealt += result.dealt;
          anyResisted = anyResisted || result.resisted;
          if (result.killed) towerKilled.push(current);
          chainPoints.push({ x: current.x, y: current.y });
          lastX = current.x;
          lastY = current.y;
          chains--;
          const next = enemies
            .filter((e) => e.alive && !hit.has(e.id) && canTowerTarget(e, stats.attackMode))
            .sort((a, b) => dist(lastX, lastY, a.x, a.y) - dist(lastX, lastY, b.x, b.y))[0];
          current = next;
        }

        attacks.push({
          mode: 'chain',
          color: stats.color,
          fromX: tower.x,
          fromY: tower.y,
          toX: lastX,
          toY: lastY,
          damage: totalDealt,
          resisted: anyResisted,
          chainPoints,
        });
      }
    }

    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (dist(enemy.x, enemy.y, coreX, coreY) > coreRadius) continue;

      if (isBossEnemy(enemy)) {
        pinEnemyAtCore(enemy, coreX, coreY, coreRadius);
        if (!enemy.siegingCore) {
          enemy.siegingCore = true;
          enemy.coreSiegeCooldownSec = BOSS_SIEGE_GRACE_SEC;
          continue;
        }
        enemy.coreSiegeCooldownSec = (enemy.coreSiegeCooldownSec ?? 0) - deltaSec;
        if (enemy.coreSiegeCooldownSec > 0) continue;

        enemy.coreSiegeCooldownSec = BOSS_SIEGE_INTERVAL_SEC;
        let dmg = getBossCoreSiegeDamage(enemy);
        if (shield > 0) {
          const absorbed = Math.min(shield, dmg);
          shieldAbsorbed += absorbed;
          dmg -= absorbed;
        }
        coreDamage += dmg;
        continue;
      }

      let dmg = getEnemyCoreDamage(enemy);
      if (shield > 0) {
        const absorbed = Math.min(shield, dmg);
        shieldAbsorbed += absorbed;
        dmg -= absorbed;
      }
      coreDamage += dmg;
      enemy.alive = false;
      coreReached.push(enemy);
    }

    return { towerKilled, coreReached, coreDamage, shieldAbsorbed, attacks };
  }

  computeShield(towers: TowerState[]): number {
    let total = 0;
    for (const tower of towers) {
      const stats = getTowerStats(tower);
      if (stats.attackMode === 'shield') total += stats.shieldAmount ?? 0;
    }
    return total;
  }
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function pinEnemyAtCore(
  enemy: EnemyState,
  coreX: number,
  coreY: number,
  coreRadius: number,
): void {
  const dx = enemy.x - coreX;
  const dy = enemy.y - coreY;
  const len = Math.hypot(dx, dy) || 1;
  enemy.x = coreX + (dx / len) * coreRadius;
  enemy.y = coreY + (dy / len) * coreRadius;
}

function getBossCoreSiegeDamage(enemy: EnemyState): number {
  return Math.max(1, Math.round(getEnemyCoreDamage(enemy) * BOSS_SIEGE_DAMAGE_MULT));
}

function towerDamage(enemy: EnemyState, raw: number, bossFinaleActive: boolean): number {
  if (!bossFinaleActive || !isBossEnemy(enemy)) return raw;
  return Math.round(raw * BOSS_FINALE_TOWER_DAMAGE_MULT);
}

function nearest(tower: TowerState, targets: EnemyState[]): EnemyState {
  return targets.sort((a, b) => dist(tower.x, tower.y, a.x, a.y) - dist(tower.x, tower.y, b.x, b.y))[0];
}

/** 近战物理塔无法攻击飞行单位（炮塔/法师链可打） */
function canTowerTarget(enemy: EnemyState, mode: AttackMode): boolean {
  if (!enemy.def.flying) return true;
  return mode === 'aoe' || mode === 'chain';
}
