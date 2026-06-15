/**
 * 模拟黄圈判定概率（与 src 逻辑一致）
 */
const TARGET_RADIUS = 50;
const COLOR_RING_RADIUS = TARGET_RADIUS + 6; // 56
const COLOR_RING_EXPAND = 2;
const RING_STROKE = 10 / 4; // YELLOW_RING_STROKE
const APPROACH_DURATION = 2.5;
const RING_START_RADIUS = 380;
const RING_OVERRUN = 0.4;
const EDGE_JUDGE = { perfectPx: 4, goodBandPx: 20, lateMissPx: 6 };

const targetR = COLOR_RING_RADIUS * COLOR_RING_EXPAND; // 112
const contactR = targetR - RING_STROKE / 2; // 107
const perfectPx = EDGE_JUDGE.perfectPx * COLOR_RING_EXPAND; // 8
const goodBandPx = EDGE_JUDGE.goodBandPx * COLOR_RING_EXPAND; // 40
const lateMissPx = EDGE_JUDGE.lateMissPx * COLOR_RING_EXPAND; // 12

const noteTime = 10;
const anchor = noteTime - APPROACH_DURATION;
const end = noteTime + RING_OVERRUN;

function outerEdge(ringR) {
  return ringR + RING_STROKE / 2;
}
function innerEdge(ringR) {
  return ringR - RING_STROKE / 2;
}

function getRingRadius(songTime) {
  if (songTime < anchor) return null;
  const duration = noteTime - anchor;
  if (duration <= 0.05 || songTime >= noteTime) {
    const overrun = Math.max(0, songTime - noteTime);
    if (overrun === 0) return contactR;
    const minR = contactR * 0.15;
    if (overrun >= RING_OVERRUN) return minR;
    const t = overrun / RING_OVERRUN;
    return contactR + (minR - contactR) * t;
  }
  const progress = (songTime - anchor) / duration;
  const eased = 1 - (1 - Math.min(1, progress)) ** 3;
  return RING_START_RADIUS + (contactR - RING_START_RADIUS) * eased;
}

function judgeYellow(ringR) {
  const outer = outerEdge(ringR);
  if (outer > targetR + goodBandPx) return 'miss';
  if (outer < targetR - lateMissPx) return 'miss';
  const dist = Math.abs(outer - targetR);
  if (dist <= perfectPx) return 'perfect';
  if (dist <= goodBandPx) return 'good';
  return 'miss';
}

function judgeAt(t) {
  const r = getRingRadius(t);
  if (r === null) return 'no-ring';
  return judgeYellow(r);
}

// 时间扫描
const timeCounts = { perfect: 0, good: 0, miss: 0 };
let perfectStart = null;
let perfectEnd = null;
for (let t = anchor; t <= end; t += 0.0001) {
  const j = judgeAt(t);
  if (j === 'no-ring') continue;
  timeCounts[j]++;
  if (j === 'perfect') {
    if (perfectStart === null) perfectStart = t;
    perfectEnd = t;
  }
}
const totalTime = timeCounts.perfect + timeCounts.good + timeCounts.miss;

// 随机点击
const rand = { perfect: 0, good: 0, miss: 0 };
const trials = 200_000;
for (let i = 0; i < trials; i++) {
  const t = anchor + Math.random() * (end - anchor);
  const j = judgeAt(t);
  if (j !== 'no-ring') rand[j]++;
}
const randTotal = rand.perfect + rand.good + rand.miss;

console.log('=== 黄圈判定模拟结果 ===\n');
console.log(`目标外缘: ${targetR}px | Perfect±${perfectPx}px | Good重叠带±${goodBandPx}px\n`);

console.log('【场景A】黄圈出现后，任意时刻等概率点击一次：');
for (const k of ['perfect', 'good', 'miss']) {
  console.log(`  ${k.toUpperCase().padEnd(7)} ${(rand[k] / randTotal * 100).toFixed(2)}%`);
}

console.log('\n【场景B】按缩圈时间占比（每时刻持续点击的结果分布）：');
for (const k of ['perfect', 'good', 'miss']) {
  const ms = (timeCounts[k] / totalTime * (end - anchor) * 1000).toFixed(0);
  console.log(`  ${k.toUpperCase().padEnd(7)} ${(timeCounts[k] / totalTime * 100).toFixed(2)}%  (窗口约 ${ms}ms)`);
}

if (perfectStart !== null) {
  console.log(`\n【Perfect 窗口】${((perfectEnd - perfectStart) * 1000).toFixed(0)}ms (${perfectStart.toFixed(3)}s ~ ${perfectEnd.toFixed(3)}s)`);
}

console.log('\n【场景C】理想玩家（在 note.time 附近正态分布点击，σ=80ms）：');
const ideal = { perfect: 0, good: 0, miss: 0 };
for (let i = 0; i < trials; i++) {
  const noise = (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 80;
  const t = Math.max(anchor, Math.min(end, noteTime + noise / 1000));
  const j = judgeAt(t);
  if (j !== 'no-ring') ideal[j]++;
}
const idealTotal = ideal.perfect + ideal.good + ideal.miss;
for (const k of ['perfect', 'good', 'miss']) {
  console.log(`  ${k.toUpperCase().padEnd(7)} ${(ideal[k] / idealTotal * 100).toFixed(2)}%`);
}
