import { getGuideRingRadius } from '../../config/rhythm';
import { getRingOuterEdge, judgeRingTiming } from './RingNote';

export type JudgementType = 'perfect' | 'great' | 'good' | 'miss';

export interface JudgementResult {
  type: JudgementType;
  score: number;
  tierWeight: number;
  errorPercent: number;
}

const SCORES = { perfect: 1.5, great: 1.0, good: 0.5, miss: 0 } as const;
const TIER_WEIGHTS = { perfect: 3, great: 1, good: 0, miss: -1 } as const;

/**
 * 单击音符 — 参考圈判定：
 * Perfect：缩圈外缘与黄色底板外缘重合
 * Good：缩圈外缘与蓝色参考圈外缘重合
 * Miss：过早 / 过晚（越过红色 Miss 线未点）
 */
export function judgeYellowClick(ringRadius: number, _targetRadius?: number, bonusPercent = 0): JudgementResult {
  const type = judgeRingTiming(ringRadius, bonusPercent);
  const outer = getRingOuterEdge(ringRadius);
  const guide = getGuideRingRadius();
  const err = Math.round(Math.abs(outer - guide));
  return mk(type, err);
}

/** 红圈连点评分：窗口内 6 次 Perfect，4 次 Good，少于 4 次 Miss */
export function judgeRedTaps(taps: number): JudgementResult {
  if (taps >= 6) return mk('perfect', 0);
  if (taps >= 4) return mk('good', 5);
  return mk('miss', 100);
}

function mk(type: JudgementType, errorPercent: number): JudgementResult {
  return { type, score: SCORES[type], tierWeight: TIER_WEIGHTS[type], errorPercent };
}

export function getJudgementColor(type: JudgementType): number {
  switch (type) {
    case 'perfect': return 0xffd700;
    case 'great': return 0x2ecc71;
    case 'good': return 0x3498db;
    case 'miss': return 0xe74c3c;
  }
}

export function getJudgementLabel(type: JudgementType): string {
  switch (type) {
    case 'perfect': return 'PERFECT';
    case 'great': return 'GREAT';
    case 'good': return 'GOOD';
    case 'miss': return 'MISS';
  }
}
