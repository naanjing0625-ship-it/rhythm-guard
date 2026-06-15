/**
 * 无 Phaser 的塔防平衡模拟：按评级生成掉落 → 自动合成 → 均匀布阵 → 跑完整波次。
 */
import { getScaledEnemy } from '../config/enemies';
import {
  CORE_CELLS,
  getCorePixelPosition,
  GRID_CELL_SIZE,
  GRID_SIZE,
  isCoreCell,
  mergeItems,
  type ItemInstance,
} from '../config/items';
import { LEVELS } from '../config/levels';
import {
  computeMergeUses,
  getLevelRepairLimit,
  type AccuracyGrade,
} from '../config/rhythmBalance';
import { TD_CONTENT, getTdLevelScaling } from '../config/tdContent';
import { CombatSystem } from '../systems/defense/CombatSystem';
import { updateEnemyAbilities } from '../systems/defense/EnemyAbilities';
import {
  createEnemy,
  getEnemyMoveSpeed,
  tickEnemySlow,
  type EnemyState,
} from '../systems/defense/Enemy';
import { createTowerState, type TowerState } from '../systems/defense/Tower';
import { generateLoot } from '../systems/rhythm/LootTable';
import { WaveManager } from '../systems/defense/WaveManager';
import { GAME_WIDTH } from '../core/viewport';
import { analyzeLevelThreat, ANTI_AIR_TYPES, GROUND_ONLY_TYPES } from '../systems/rhythm/LevelLootProfile';

const GRID_X = (GAME_WIDTH - GRID_SIZE * GRID_CELL_SIZE) / 2;
const GRID_Y = 60;
const CORE_POS = getCorePixelPosition(GRID_CELL_SIZE, GRID_X, GRID_Y);
const CORE_RADIUS = TD_CONTENT.defense.core.radius;
const DT_MS = 50;
const MAX_SIM_MS = 600_000;

const GRADE_ACCURACY: Record<AccuracyGrade, number> = {
  B: 0.68,
  A: 0.77,
  S: 0.89,
  SS: 0.94,
  SSS: 0.99,
};

export interface SimTrialResult {
  win: boolean;
  coreHpLeft: number;
  coreHpMax: number;
  repairCount: number;
}

export interface SimSummary {
  levelId: string;
  grade: AccuracyGrade;
  trials: number;
  wins: number;
  passRate: number;
  avgCoreHpRatio: number;
  avgRepairCount: number;
  avgRepairCountOnWin: number;
  repairLimit: number;
}

/** 简易可复现 RNG（LCG） */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function autoMergeItems(items: ItemInstance[], mergeUses: number): ItemInstance[] {
  const pool = items.map((item) => ({ ...item }));
  let usesLeft = mergeUses;

  while (usesLeft > 0) {
    const pairs = new Map<string, number[]>();
    for (let i = 0; i < pool.length; i++) {
      const key = `${pool[i].type}_T${pool[i].tier}`;
      const list = pairs.get(key) ?? [];
      list.push(i);
      pairs.set(key, list);
    }

    const mergeable = [...pairs.entries()]
      .filter(([, idxs]) => idxs.length >= 2 && pool[idxs[0]].tier < 4)
      .sort((a, b) => {
        const tierA = pool[a[1][0]].tier;
        const tierB = pool[b[1][0]].tier;
        if (tierB !== tierA) return tierB - tierA;
        return b[1].length - a[1].length;
      });

    if (mergeable.length === 0) break;

    const [, idxs] = mergeable[0];
    pool[idxs[0]] = mergeItems(pool[idxs[0]], pool[idxs[1]]);
    pool.splice(idxs[1], 1);
    usesLeft--;
  }

  return pool;
}

function placementCells(): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number; dist: number }> = [];
  const coreRows = CORE_CELLS.map((c) => c.row);
  const coreCols = CORE_CELLS.map((c) => c.col);
  const coreRow = (Math.min(...coreRows) + Math.max(...coreRows) + 1) / 2;
  const coreCol = (Math.min(...coreCols) + Math.max(...coreCols) + 1) / 2;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      if (isCoreCell(row, col)) continue;
      const dist = Math.hypot(row - coreRow, col - coreCol);
      cells.push({ row, col, dist });
    }
  }

  cells.sort((a, b) => b.dist - a.dist);
  return cells.map(({ row, col }) => ({ row, col }));
}

function buildTowers(items: ItemInstance[], levelId: string): TowerState[] {
  const slots = placementCells();
  const threat = analyzeLevelThreat(levelId);
  const antiAir = items.filter((i) => ANTI_AIR_TYPES.includes(i.type));
  const ground = items.filter((i) => GROUND_ONLY_TYPES.includes(i.type));
  const ordered = threat.flyingUnits > 0
    ? [...antiAir, ...ground]
    : [...items].sort((a, b) => b.tier - a.tier);

  const towers: TowerState[] = [];
  for (let i = 0; i < ordered.length && i < slots.length; i++) {
    const { row, col } = slots[i];
    towers.push(createTowerState(row, col, ordered[i], GRID_CELL_SIZE, GRID_X, GRID_Y));
  }
  return towers;
}

function spawnPosition(rng: () => number): { x: number; y: number } {
  const edges = TD_CONTENT.defense.spawn.edges;
  const edge = edges[Math.floor(rng() * edges.length)];
  const gridW = GRID_SIZE * GRID_CELL_SIZE;
  const gridH = GRID_SIZE * GRID_CELL_SIZE;
  switch (edge) {
    case 'top':
      return { x: GRID_X + rng() * gridW, y: GRID_Y - 20 };
    case 'right':
      return { x: GRID_X + gridW + 20, y: GRID_Y + rng() * gridH };
    case 'bottom':
      return { x: GRID_X + rng() * gridW, y: GRID_Y + gridH + 20 };
    default:
      return { x: GRID_X - 20, y: GRID_Y + rng() * gridH };
  }
}

function moveEnemies(enemies: EnemyState[], deltaSec: number): void {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    tickEnemySlow(enemy, deltaSec);
    const dx = CORE_POS.x - enemy.x;
    const dy = CORE_POS.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 5) {
      const speed = getEnemyMoveSpeed(enemy);
      enemy.x += (dx / dist) * speed * deltaSec;
      enemy.y += (dy / dist) * speed * deltaSec;
    }
  }
}

export function simulateTrial(
  levelId: string,
  grade: AccuracyGrade,
  rng: () => number,
): SimTrialResult {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);

  const accuracy = GRADE_ACCURACY[grade];
  const originalRandom = Math.random;
  Math.random = rng;
  let loot;
  try {
    loot = generateLoot({
      accuracy,
      typeHits: { yellow: 1, blue: 1, red: 1 },
      lootBonus: 0,
      judgements: { perfect: 0, great: 0, good: 0, miss: 0 },
      levelId,
    });
  } finally {
    Math.random = originalRandom;
  }

  const mergeUses = computeMergeUses(loot.totalCount);
  const mergedItems = autoMergeItems(loot.items, mergeUses);
  const towers = buildTowers(mergedItems, levelId);
  const combat = new CombatSystem();
  const levelScaling = getTdLevelScaling(levelId);
  const waveManager = new WaveManager(level.waves);
  const economy = TD_CONTENT.defense.economy;
  const repairLimit = getLevelRepairLimit(levelId);

  let coreHp = level.coreHp;
  const coreHpMax = level.coreHp;
  let shield = combat.computeShield(towers);
  let defenseGold = 0;
  const wavesSpawnFinished = new Set<number>();
  const wavesRewarded = new Set<number>();
  const enemies: EnemyState[] = [];
  let elapsed = 0;
  let repairCount = 0;

  const tryRepair = (): void => {
    if (repairCount >= repairLimit) return;
    if (
      coreHp > 0
      && coreHp / coreHpMax < 0.35
      && defenseGold >= economy.repairCost
      && coreHp < coreHpMax
    ) {
      defenseGold -= economy.repairCost;
      coreHp = Math.min(coreHpMax, coreHp + economy.repairHp);
      repairCount++;
    }
  };

  const tryWaveBonus = (): void => {
    if (enemies.some((e) => e.alive)) return;
    const bonus = economy.waveClearBonus;
    for (const waveIdx of wavesSpawnFinished) {
      if (wavesRewarded.has(waveIdx)) continue;
      wavesRewarded.add(waveIdx);
      defenseGold += bonus;
    }
  };

  while (elapsed < MAX_SIM_MS) {
    const deltaSec = DT_MS / 1000;

    const waveResult = waveManager.update(DT_MS, (type, waveIdx) => {
      const def = getScaledEnemy(type, waveIdx, levelScaling);
      const pos = spawnPosition(rng);
      return createEnemy(def, pos.x, pos.y);
    });

    for (const event of waveResult.spawned) {
      enemies.push(event.enemy);
    }

    if (waveResult.waveSpawnFinished !== null) {
      wavesSpawnFinished.add(waveResult.waveSpawnFinished);
    }

    updateEnemyAbilities(enemies, DT_MS);
    moveEnemies(enemies, deltaSec);

    const result = combat.update(
      towers,
      enemies,
      deltaSec,
      CORE_POS.x,
      CORE_POS.y,
      CORE_RADIUS,
      shield,
    );

    if (result.shieldAbsorbed > 0) {
      shield = Math.max(0, shield - result.shieldAbsorbed);
    }
    coreHp -= result.coreDamage;

    if (economy.killRewardEnabled) {
      for (const killed of result.towerKilled) {
        defenseGold += killed.def.reward;
      }
    }

    for (const reached of result.coreReached) {
      void reached;
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      if (!enemies[i].alive) enemies.splice(i, 1);
    }

    tryWaveBonus();
    tryRepair();

    if (coreHp <= 0) {
      return { win: false, coreHpLeft: 0, coreHpMax, repairCount };
    }

    if (waveManager.isDone && enemies.every((e) => !e.alive)) {
      tryWaveBonus();
      return { win: true, coreHpLeft: coreHp, coreHpMax, repairCount };
    }

    elapsed += DT_MS;
  }

  return { win: false, coreHpLeft: coreHp, coreHpMax, repairCount };
}

export function runLevelGradeSim(
  levelId: string,
  grade: AccuracyGrade,
  trials: number,
  seedBase: number,
): SimSummary {
  let wins = 0;
  let hpRatioSum = 0;
  let repairSum = 0;
  let repairSumOnWin = 0;

  for (let t = 0; t < trials; t++) {
    const rng = createRng(seedBase + t * 997 + levelId.charCodeAt(6) * 13 + grade.charCodeAt(0));
    const result = simulateTrial(levelId, grade, rng);
    if (result.win) {
      wins++;
      repairSumOnWin += result.repairCount;
    }
    hpRatioSum += result.coreHpLeft / result.coreHpMax;
    repairSum += result.repairCount;
  }

  return {
    levelId,
    grade,
    trials,
    wins,
    passRate: wins / trials,
    avgCoreHpRatio: hpRatioSum / trials,
    avgRepairCount: repairSum / trials,
    avgRepairCountOnWin: wins > 0 ? repairSumOnWin / wins : 0,
    repairLimit: getLevelRepairLimit(levelId),
  };
}

export function runFullBalanceSim(trialsPerCell = 40, seedBase = 42): SimSummary[] {
  const grades: AccuracyGrade[] = ['A', 'S', 'SS', 'SSS'];
  const results: SimSummary[] = [];

  for (const level of LEVELS) {
    for (const grade of grades) {
      results.push(runLevelGradeSim(level.id, grade, trialsPerCell, seedBase));
    }
  }

  return results;
}

function formatPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatNum(n: number, digits = 1): string {
  return n.toFixed(digits);
}

/** CLI 入口 */
export function printBalanceReport(results: SimSummary[]): void {
  const grades: AccuracyGrade[] = ['A', 'S', 'SS', 'SSS'];
  const levelIds = [...new Set(results.map((r) => r.levelId))].sort();

  console.log('\n=== 平衡模拟：各关 × 评级 通过率 ===\n');
  console.log('说明：自动掉落+合成+对空布阵+击杀奖励；修复受关卡上限约束，低血(<35%)时用一次\n');

  const limitHeader = ['关卡', '修复上限', ...grades.map((g) => `${g}通过率`), 'S修复/上限'];
  console.log(limitHeader.join('\t'));

  for (const levelId of levelIds) {
    const level = LEVELS.find((l) => l.id === levelId);
    const name = level?.name ?? levelId;
    const limit = getLevelRepairLimit(levelId);
    const cells = grades.map((g) => {
      const row = results.find((r) => r.levelId === levelId && r.grade === g);
      return row ? formatPct(row.passRate) : '-';
    });
    const sRow = results.find((r) => r.levelId === levelId && r.grade === 'S');
    const sRepair = sRow ? `${formatNum(sRow.avgRepairCount)}/${limit}` : '-';
    console.log(`${levelId} ${name}\t${limit}\t${cells.join('\t')}\t${sRepair}`);
  }

  console.log('\n=== 核心修复次数（场均 / 胜利局，上限见上表） ===\n');
  const repairHeader = ['关卡', ...grades.map((g) => `${g}修复`), 'S胜利局修复'];
  console.log(repairHeader.join('\t'));

  for (const levelId of levelIds) {
    const level = LEVELS.find((l) => l.id === levelId);
    const name = level?.name ?? levelId;
    const cells = grades.map((g) => {
      const row = results.find((r) => r.levelId === levelId && r.grade === g);
      if (!row) return '-';
      return `${formatNum(row.avgRepairCount)}/${formatNum(row.avgRepairCountOnWin)}`;
    });
    const sRow = results.find((r) => r.levelId === levelId && r.grade === 'S');
    const sWinRepair = sRow && sRow.wins > 0 ? formatNum(sRow.avgRepairCountOnWin) : '-';
    console.log(`${levelId} ${name}\t${cells.join('\t')}\t${sWinRepair}`);
  }

  console.log('\n详细：');
  for (const r of results) {
    console.log(
      `  ${r.levelId} ${r.grade}: ${r.wins}/${r.trials} (${formatPct(r.passRate)}), `
      + `均剩HP ${formatPct(r.avgCoreHpRatio)}, `
      + `修复 ${formatNum(r.avgRepairCount)}/${r.repairLimit} (胜利 ${formatNum(r.avgRepairCountOnWin)}次/局)`,
    );
  }
}

declare const process: {
  argv: string[];
  env: Record<string, string | undefined>;
};

if (process.argv[1]?.replace(/\\/g, '/').endsWith('balanceSim.ts')) {
  const trials = Number(process.env.SIM_TRIALS ?? 40);
  const results = runFullBalanceSim(trials);
  printBalanceReport(results);
}
