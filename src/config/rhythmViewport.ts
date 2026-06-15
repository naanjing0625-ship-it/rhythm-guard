/** 独立竖屏全屏时的参考分辨率 */
const STANDALONE_WIDTH = 1080;
const STANDALONE_HEIGHT = 1920;

let rhythmViewWidth = STANDALONE_WIDTH;
let rhythmViewHeight = STANDALONE_HEIGHT;

/** 嵌入横屏时的竖屏舞台尺寸（默认等同独立竖屏） */
export function configureRhythmStage(width: number, height: number): void {
  rhythmViewWidth = Math.max(320, Math.round(width));
  rhythmViewHeight = Math.max(480, Math.round(height));
}

export function resetRhythmStage(): void {
  rhythmViewWidth = STANDALONE_WIDTH;
  rhythmViewHeight = STANDALONE_HEIGHT;
}

export function getRhythmViewWidth(): number {
  return rhythmViewWidth;
}

export function getRhythmViewHeight(): number {
  return rhythmViewHeight;
}

/** UI 相对独立竖屏的缩放比（嵌入模式用于字号/间距） */
export function getRhythmUiScale(): number {
  return rhythmViewWidth / STANDALONE_WIDTH;
}

/** @deprecated 请用 getRhythmViewWidth()；保留供少量静态引用 */
export const RHYTHM_VIEW_WIDTH = STANDALONE_WIDTH;
export const RHYTHM_VIEW_HEIGHT = STANDALONE_HEIGHT;

/** 中心圈外缘直径 = 舞台宽度 × 50% */
export function getRhythmColorRingRadius(): number {
  return rhythmViewWidth * 0.25;
}

export function getRhythmTargetRadius(): number {
  return getRhythmColorRingRadius() - rhythmViewWidth * 0.006;
}

export function getRhythmFaceRadius(): number {
  return getRhythmTargetRadius() - rhythmViewWidth * 0.004;
}

export function getRhythmFaceStroke(): number {
  return Math.max(4, Math.round(rhythmViewWidth * 0.004));
}

export function getRhythmRingStroke(): number {
  return Math.max(10, Math.round(rhythmViewWidth * 0.02));
}

export function getRhythmRingStartRadius(): number {
  return Math.max(rhythmViewWidth, rhythmViewHeight) * 0.88;
}

/** 缩圈外缘是否进入屏幕可视区（以外缘距圆心的半径衡量，阈值为屏幕半宽） */
export function isShrinkRingOnScreen(ringOuterEdge: number): boolean {
  const halfSpan = Math.min(rhythmViewWidth, rhythmViewHeight) * 0.5;
  return ringOuterEdge <= halfSpan * 1.05;
}

/** 进度环半径：贴在缩小后圆外缘（bodyRadius + 描边一半） */
export function getRhythmHoldProgressRadius(bodyScale = 1): number {
  const bodyR = getRhythmColorRingRadius() * bodyScale;
  return bodyR + getRhythmHoldProgressStroke() / 2;
}

export function getRhythmHoldProgressStroke(): number {
  return Math.max(6, Math.round(rhythmViewWidth * 0.006));
}

/** 律动区垂直中心 */
export function getRhythmCenterY(): number {
  return rhythmViewHeight * 0.5;
}

/** 中心圆最大缩放（红圈连击弹出），用于计算飘字安全区 */
const JUDGEMENT_BODY_MAX_SCALE = 1.25;

/** 判定飘字 Y — 圆外上方（文字底边贴齐圆顶外侧） */
export function getRhythmJudgementTextY(centerY: number): number {
  const circleTop =
    centerY - getRhythmColorRingRadius() * JUDGEMENT_BODY_MAX_SCALE - getRhythmRingStroke() * 0.5;
  const gap = rhythmViewWidth * 0.05;
  return circleTop - gap;
}
