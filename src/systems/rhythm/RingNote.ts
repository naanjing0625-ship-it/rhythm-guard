import {
  APPROACH_DURATION,
  BLUE_HOLD,
  COLOR_SWITCH_GAP,
  NOTE_COLORS,
  RED_MASH,
  RING_OVERRUN,
  MIN_SHRINK_DURATION,
  getRingStartRadius,
  getRingStroke,
  getGuideRingRadius,
  getRingContactRadius,
  getJudgeBlueGoodOuterEdge,
  getJudgeRedMissOuterEdge,
  getScaledEdgeJudge,
  type NoteColor,
} from '../../config/rhythm';
import { isShrinkRingOnScreen } from '../../config/rhythmViewport';

export interface ChartNote {
  time: number;
  /** 进入关卡前由 randomizeChartNoteTypes 赋值 */
  type?: NoteColor;
  /** 实际判定时刻；排队延迟出场时由场景写入 */
  hitTime?: number;
}

function getHitTime(note: ChartNote): number {
  return note.hitTime ?? note.time;
}

export function getRingOuterEdge(ringRadius: number, stroke = getRingStroke()): number {
  return ringRadius + stroke / 2;
}

/** 玩家肉眼能看到缩圈（已缩入屏幕，而非屏外大圈） */
export function isShrinkRingVisible(ringRadius: number): boolean {
  return isShrinkRingOnScreen(getRingOuterEdge(ringRadius));
}

export function getRingInnerEdge(ringRadius: number, stroke = getRingStroke()): number {
  return ringRadius - stroke / 2;
}

export function getApproachAnchor(note: ChartNote, spawnTime: number): number {
  const ideal = getHitTime(note) - APPROACH_DURATION;
  return Math.max(ideal, spawnTime);
}

function getNoteContactRadius(): number {
  return getRingContactRadius(getGuideRingRadius());
}

/** 缩圈连续运动：在 note.time 经过引导圈，不停留，之后继续向内 */
export function getRingRadius(
  note: ChartNote,
  songTime: number,
  approachAnchor: number,
): number | null {
  if (songTime < approachAnchor) return null;

  const contactRadius = getNoteContactRadius();
  const approachDuration = getHitTime(note) - approachAnchor;
  if (approachDuration <= MIN_SHRINK_DURATION * 0.05) return contactRadius;

  const elapsed = songTime - approachAnchor;
  const effectiveDuration = Math.max(approachDuration, MIN_SHRINK_DURATION);
  const endRadius = contactRadius * 0.15;

  if (elapsed <= effectiveDuration) {
    const progress = elapsed / effectiveDuration;
    const eased = 1 - Math.pow(1 - progress, 3);
    const startR = getRingStartRadius();
    return startR + (contactRadius - startR) * eased;
  }

  const overrun = elapsed - effectiveDuration;
  const t = Math.min(1, overrun / RING_OVERRUN);
  return contactRadius + (endRadius - contactRadius) * t;
}

/** 与中心 colorRing 有重叠 */
export function ringOverlapsGuide(ringRadius: number): boolean {
  const outer = getRingOuterEdge(ringRadius);
  const inner = getRingInnerEdge(ringRadius);
  const guideOuter = getGuideRingRadius();
  const guideInner = guideOuter - getRingStroke();
  return inner < guideOuter && outer > guideInner;
}

/** 过早：缩圈外缘仍在蓝色 Good 参考圈之外 */
export function isRingTooEarly(ringRadius: number): boolean {
  const outer = getRingOuterEdge(ringRadius);
  const { earlyPx } = getScaledEdgeJudge(getGuideRingRadius());
  return outer > getJudgeBlueGoodOuterEdge() + earlyPx;
}

/** 过晚：缩圈外缘已越过红色 Miss 线（未点击） */
export function isRingTooLate(ringRadius: number): boolean {
  const outer = getRingOuterEdge(ringRadius);
  const { lateMissPx } = getScaledEdgeJudge(getGuideRingRadius());
  return outer < getJudgeRedMissOuterEdge() - lateMissPx;
}

/** Perfect：缩圈外缘与黄色底板外缘重合 */
export function isRingPerfectAlign(ringRadius: number, bonusPercent = 0): boolean {
  const guide = getGuideRingRadius();
  const outer = getRingOuterEdge(ringRadius);
  const { perfectPx } = getScaledEdgeJudge(guide);
  const bonus = (bonusPercent / 100) * guide;
  if (Math.abs(outer - guide) <= perfectPx + bonus) return true;
  // 与黄底重叠且更贴近黄底外缘而非蓝圈参考
  if (ringOverlapsGuide(ringRadius)) {
    const goodOuter = getJudgeBlueGoodOuterEdge();
    return Math.abs(outer - guide) <= Math.abs(outer - goodOuter);
  }
  return false;
}

/** Good：缩圈外缘与蓝色参考圈外缘重合 */
export function isRingGoodAlign(ringRadius: number, bonusPercent = 0): boolean {
  const goodOuter = getJudgeBlueGoodOuterEdge();
  const outer = getRingOuterEdge(ringRadius);
  const { goodPx } = getScaledEdgeJudge(getGuideRingRadius());
  const bonus = (bonusPercent / 100) * getGuideRingRadius();
  return Math.abs(outer - goodOuter) <= goodPx + bonus;
}

/** 落在黄底与缩圈重叠带内（可点击、非 Perfect 时至少 Good） */
export function isRingInGuideOverlap(ringRadius: number): boolean {
  return ringOverlapsGuide(ringRadius);
}

/** 蓝圈长按起始：Good / Perfect 区或稍早按住等待 */
export function canStartBlueHold(ringRadius: number, bonusPercent = 0): boolean {
  if (isRingTooLate(ringRadius)) return false;
  if (isRingPerfectAlign(ringRadius, bonusPercent) || isRingGoodAlign(ringRadius, bonusPercent)) {
    return true;
  }

  const guide = getGuideRingRadius();
  const outer = getRingOuterEdge(ringRadius);
  const { goodPx, earlyPx } = getScaledEdgeJudge(guide);
  const bonus = (bonusPercent / 100) * guide;
  const goodOuter = getJudgeBlueGoodOuterEdge();
  return outer <= goodOuter + goodPx + bonus && outer >= goodOuter - earlyPx - bonus;
}

/** 黄/蓝/红可点击窗口 */
export function canInteractWithRing(ringRadius: number, bonusPercent = 0): boolean {
  if (isRingTooLate(ringRadius) || isRingTooEarly(ringRadius)) return false;
  if (canStartBlueHold(ringRadius, bonusPercent)) return true;

  const guide = getGuideRingRadius();
  const outer = getRingOuterEdge(ringRadius);
  const { goodPx, perfectPx } = getScaledEdgeJudge(guide);
  const bonus = (bonusPercent / 100) * guide;
  const goodOuter = getJudgeBlueGoodOuterEdge();
  const inBand =
    Math.abs(outer - guide) <= perfectPx * 2 + bonus
    || Math.abs(outer - goodOuter) <= goodPx * 1.5 + bonus;
  return inBand;
}

/**
 * 点击判定：
 * - Perfect：缩圈外缘与黄底外缘重合（或重叠带内更贴黄底）
 * - Good：与蓝圈参考对齐，或与黄底有重叠
 * - Miss：过早 / 过晚 / 完全不在可判区
 */
export function judgeRingTiming(ringRadius: number, bonusPercent = 0): 'perfect' | 'good' | 'miss' {
  if (isRingTooEarly(ringRadius) || isRingTooLate(ringRadius)) return 'miss';
  if (isRingPerfectAlign(ringRadius, bonusPercent)) return 'perfect';
  if (isRingGoodAlign(ringRadius, bonusPercent)) return 'good';
  if (isRingInGuideOverlap(ringRadius)) return 'good';
  return 'miss';
}

export function isRingAligned(
  note: ChartNote,
  songTime: number,
  approachAnchor: number,
): boolean {
  const radius = getRingRadius(note, songTime, approachAnchor);
  if (radius === null) return false;
  return ringOverlapsGuide(radius);
}

export function getInteractionEnd(note: ChartNote): number {
  const hit = getHitTime(note);
  if (note.type === 'yellow') return hit + RING_OVERRUN + COLOR_SWITCH_GAP;
  if (note.type === 'blue') return hit + BLUE_HOLD.duration + RING_OVERRUN + COLOR_SWITCH_GAP;
  return hit + RED_MASH.window + RING_OVERRUN + COLOR_SWITCH_GAP;
}

export function isNoteExpired(note: ChartNote, songTime: number): boolean {
  return songTime > getInteractionEnd(note);
}

export function getNoteColor(note: ChartNote): number {
  return NOTE_COLORS[note.type ?? 'yellow'];
}
