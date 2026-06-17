import { getLevelRepairLimit, type AccuracyGrade } from '../config/rhythmBalance';
import { getTdLevelCoreHp } from '../config/tdContent';
import {
  createRng,
  simulateTrial,
} from './balanceSim';

const LEVEL_ID = 'level_07';
const GRADES: AccuracyGrade[] = ['A', 'S', 'SS', 'SSS'];
const TRIALS = 200;

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

console.log(`\n=== L07 修复核心 · 平衡模拟 (${TRIALS} 局/评级) ===`);
console.log(`核心 HP: ${getTdLevelCoreHp(LEVEL_ID)} | 修复上限: ${getLevelRepairLimit(LEVEL_ID)}`);
console.log('规则: 核心 <35% 且 ♪≥20 时自动修复 +15 HP\n');

console.log('【开启自动修复】');
console.log(['评级', '通关率', '用过修复的局', '胜局用过修复', '胜局均星', '1★/2★/3★(胜)', '胜局均剩HP'].join('\t'));

for (const grade of GRADES) {
  let wins = 0;
  let usedRepair = 0;
  let winsUsedRepair = 0;
  let starsSum = 0;
  const starDist = { 1: 0, 2: 0, 3: 0 };
  let hpSum = 0;

  for (let t = 0; t < TRIALS; t++) {
    const rng = createRng(20260617 + t * 997 + grade.charCodeAt(0));
    const r = simulateTrial(LEVEL_ID, grade, rng, { autoRepair: true });
    if (r.repairCount > 0) usedRepair++;
    if (!r.win) continue;
    wins++;
    hpSum += r.coreHpLeft;
    starsSum += r.stars;
    starDist[r.stars as 1 | 2 | 3]++;
    if (r.repairCount > 0) winsUsedRepair++;
  }

  console.log([
    grade,
    `${wins}/${TRIALS} (${pct(wins / TRIALS)})`,
    `${usedRepair}/${TRIALS} (${pct(usedRepair / TRIALS)})`,
    wins > 0 ? `${winsUsedRepair}/${wins} (${pct(winsUsedRepair / wins)})` : '-',
    wins > 0 ? (starsSum / wins).toFixed(2) : '-',
    `${starDist[1]}/${starDist[2]}/${starDist[3]}`,
    wins > 0 ? (hpSum / wins).toFixed(1) : '-',
  ].join('\t'));
}

console.log('\n【关闭自动修复 · 对比】');
console.log(['评级', '通关率', '胜局均星', '1★/2★/3★(胜)'].join('\t'));

for (const grade of GRADES) {
  let wins = 0;
  let starsSum = 0;
  const starDist = { 1: 0, 2: 0, 3: 0 };

  for (let t = 0; t < TRIALS; t++) {
    const rng = createRng(20260617 + t * 997 + grade.charCodeAt(0));
    const r = simulateTrial(LEVEL_ID, grade, rng, { autoRepair: false });
    if (!r.win) continue;
    wins++;
    starsSum += r.stars;
    starDist[r.stars as 1 | 2 | 3]++;
  }

  console.log([
    grade,
    `${wins}/${TRIALS} (${pct(wins / TRIALS)})`,
    wins > 0 ? (starsSum / wins).toFixed(2) : '-',
    `${starDist[1]}/${starDist[2]}/${starDist[3]}`,
  ].join('\t'));
}

console.log('\n星级: 核心>80%→3★ | >50%→2★ | 其余→1★\n');
