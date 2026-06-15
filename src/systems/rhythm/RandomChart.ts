import type { NoteColor } from '../../config/rhythm';
import type { ChartNote } from './RingNote';

/** 基础权重：黄 > 红 > 蓝 */
export const NOTE_COLOR_WEIGHTS = {
  yellow: 0.67,
  red: 0.18,
  blue: 0.15,
} as const;

export const YELLOW_BURST_MIN = 1;
export const YELLOW_BURST_MAX = 3;

/** 随机 1～maxAvailable 个黄圈 */
export function pickYellowBurstCount(maxAvailable: number): number {
  const cap = Math.min(YELLOW_BURST_MAX, Math.max(YELLOW_BURST_MIN, maxAvailable));
  return YELLOW_BURST_MIN + Math.floor(Math.random() * cap);
}

/**
 * 将一批黄圈拆成若干段：可同时出（如 [3]），也可先 1 再间隔出 2（[1,2]）。
 */
export function planYellowBurstChunks(total?: number): number[] {
  const n = total ?? pickYellowBurstCount(YELLOW_BURST_MAX);
  if (n <= 1) return [1];
  if (n === 2) {
    return Math.random() < 0.5 ? [2] : [1, 1];
  }
  const r = Math.random();
  if (r < 0.35) return [3];
  if (r < 0.7) return [1, 2];
  return [1, 1, 1];
}

function groupIntoWaves(notes: ChartNote[]): ChartNote[][] {
  if (notes.length === 0) return [];
  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const waves: ChartNote[][] = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.time - prev.time < 2.5) {
      waves[waves.length - 1].push(cur);
    } else {
      waves.push([cur]);
    }
  }
  return waves;
}

/** 开局曲谱只保留时间槽，颜色由运行时 SpawnColorBudget 决定 */
function randomizeWave(slots: ChartNote[]): ChartNote[] {
  const sorted = [...slots].sort((a, b) => a.time - b.time);
  return sorted.map((slot) => ({ ...slot, type: 'yellow' as NoteColor }));
}

/** 时间槽排序（类型在出圈时动态决定） */
export function randomizeChartNoteTypes(notes: ChartNote[]): ChartNote[] {
  const waves = groupIntoWaves(notes);
  return waves.flatMap((wave) => randomizeWave(wave)).sort((a, b) => a.time - b.time);
}

export function pickRandomNoteColor(): NoteColor {
  const r = Math.random();
  if (r < NOTE_COLOR_WEIGHTS.yellow) return 'yellow';
  if (r < NOTE_COLOR_WEIGHTS.yellow + NOTE_COLOR_WEIGHTS.red) return 'red';
  return 'blue';
}

export function pickWeightedRedOrBlue(): NoteColor {
  const rb = NOTE_COLOR_WEIGHTS.red + NOTE_COLOR_WEIGHTS.blue;
  return Math.random() < NOTE_COLOR_WEIGHTS.red / rb ? 'red' : 'blue';
}

export function spawnFollowUpYellowCount(): number {
  return pickYellowBurstCount(YELLOW_BURST_MAX);
}
