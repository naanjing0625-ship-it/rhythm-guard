import { getLevelRepairLimit, type AccuracyGrade } from '../config/rhythmBalance';
import { getTdLevelCoreHp } from '../config/tdContent';
import { runLevelGradeSim } from './balanceSim';

const LEVEL_ID = 'level_08';
const GRADES: AccuracyGrade[] = ['A', 'S', 'SS', 'SSS'];
const TRIALS = 200;

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

console.log(`\n=== L08 终极守护 · 平衡模拟 (${TRIALS} 局/评级) ===`);
console.log(`核心 HP: ${getTdLevelCoreHp(LEVEL_ID)} | 修复上限: ${getLevelRepairLimit(LEVEL_ID)}`);
console.log('模拟策略: 自动掉落+合成+对空布阵+击杀奖励；核心<35%且有钱时自动修复\n');

console.log(['评级', '通关率', '胜利均剩HP', '胜利均剩%', '均星(胜)', '1★/2★/3★(胜)'].join('\t'));

for (const grade of GRADES) {
  const s = runLevelGradeSim(LEVEL_ID, grade, TRIALS, 20260617);
  const dist = s.starDistributionOnWin;
  console.log([
    grade,
    `${s.wins}/${s.trials} (${pct(s.passRate)})`,
    s.avgCoreHpLeftOnWin.toFixed(1),
    pct(s.avgCoreHpRatioOnWin),
    s.avgStarsOnWin.toFixed(2),
    `${dist[1]}/${dist[2]}/${dist[3]}`,
  ].join('\t'));
}

console.log('\n星级规则: 核心>80%→3★ | >50%→2★ | 其余→1★\n');
