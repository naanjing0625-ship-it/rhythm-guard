import type { ItemType } from './items';
import {
  getRhythmColorRingRadius,
  getRhythmRingStartRadius,
  getRhythmRingStroke,
} from './rhythmViewport';

export type NoteColor = 'yellow' | 'blue' | 'red';

export const NOTE_COLORS: Record<NoteColor, number> = {
  yellow: 0xf1c40f,
  blue: 0x3498db,
  red: 0xe74c3c,
};

export const NOTE_TO_ITEM: Record<NoteColor, ItemType> = {
  yellow: 'kick',
  blue: 'snare',
  red: 'hihat',
};

export const TARGET_SIZE = 100;
export const TARGET_RADIUS = TARGET_SIZE / 2;
export const FACE_RADIUS = TARGET_RADIUS - 4;
export const FACE_STROKE = 4;
/** 浅黄色 colorRing 外缘 — 黄圈对齐目标 */
export const COLOR_RING_RADIUS = TARGET_RADIUS + 6;
/** 黄/蓝/红缩圈描边宽度（统一） */
export const RING_STROKE = 10;
/** 缩圈中心线：外缘与 COLOR_RING_RADIUS 重合时 */
export const RING_CONTACT_RADIUS = COLOR_RING_RADIUS - RING_STROKE / 2;

/** 判定目标外缘 — 中心 colorRing 外缘（律动竖屏尺寸） */
export function getGuideRingRadius(): number {
  return getRhythmColorRingRadius();
}

export function getRingStroke(): number {
  return getRhythmRingStroke();
}

export function getGuideRingInnerEdge(): number {
  return getGuideRingRadius() - getRingStroke();
}

export function getRingContactRadius(targetRadius: number, stroke = getRingStroke()): number {
  return targetRadius - stroke / 2;
}
/** @deprecated 保留兼容，判定请用 COLOR_RING_RADIUS */
export const HIT_TARGET_RADIUS = COLOR_RING_RADIUS;
export const APPROACH_DURATION = 3.5;
/** 黄圈点完后立即进场的缩圈时长 */
export const IMMEDIATE_YELLOW_APPROACH = 2.6;
export const IMMEDIATE_OTHER_APPROACH = 1.5;
/** 缩圈最短时长，防止 hitTime 异常导致瞬间过圈 */
export const MIN_SHRINK_DURATION = 1.4;
/** 蓝圈长按进度达到此比例后，允许预出下一圈并对齐到长按结束 */
export const BLUE_HOLD_LATE_SPAWN_PROGRESS = 0.82;
/** 两波之间的最短间隔（黄圈流水线模式下仅用于防抖） */
export const MIN_WAVE_GAP = 0.15;
export function getRingStartRadius(): number {
  return getRhythmRingStartRadius();
}
export const RING_OVERRUN = 0.4;

/**
 * 判定参考圈（相对黄色底板外缘 getGuideRingRadius() 的比例）
 * 由外向内：蓝 = Good，黄底外缘 = Perfect，越过红圈（靠内）未点 = Miss
 */
export const JUDGE_REFERENCE = {
  /** 蓝色参考圈外缘 — 缩圈外缘对齐此处点击判 Good */
  blueGoodOuterRatio: 1.18,
  /** 绿色参考圈 — 仅作 UI 提示 */
  greenOuterRatio: 1.1,
  /**
   * 红色 Miss 线 — 缩圈外缘低于此半径仍未点击则自动 Miss（位于黄底内侧）
   */
  redMissOuterRatio: 0.94,
} as const;

/** 蓝色 Good 参考圈外缘半径 */
export function getJudgeBlueGoodOuterEdge(): number {
  return getGuideRingRadius() * JUDGE_REFERENCE.blueGoodOuterRatio;
}

/** 绿色参考圈外缘（展示用） */
export function getJudgeGreenOuterEdge(): number {
  return getGuideRingRadius() * JUDGE_REFERENCE.greenOuterRatio;
}

/** 红色 Miss 参考圈外缘 — 缩圈外缘低于此值视为过晚 */
export function getJudgeRedMissOuterEdge(): number {
  return getGuideRingRadius() * JUDGE_REFERENCE.redMissOuterRatio;
}

/** 黄圈判定容差（像素，以默认 guide 为基准缩放） */
export const EDGE_JUDGE = {
  /** Perfect：缩圈外缘与黄底外缘重合容差（约半圈宽，贴合「刚好重合」） */
  perfectPx: 12,
  /** Good：缩圈外缘与蓝圈参考外缘重合容差 */
  goodPx: 18,
  /** 过早：尚未进入可点击区 */
  earlyPx: 22,
  /** 过晚：已进入红色 Miss 区内侧 */
  lateMissPx: 6,
} as const;

export function getScaledEdgeJudge(targetRadius: number) {
  const scale = targetRadius / getRhythmColorRingRadius();
  return {
    perfectPx: EDGE_JUDGE.perfectPx * scale,
    goodPx: EDGE_JUDGE.goodPx * scale,
    earlyPx: EDGE_JUDGE.earlyPx * scale,
    lateMissPx: EDGE_JUDGE.lateMissPx * scale,
  };
}

/** @deprecated 使用 EDGE_JUDGE + judgeRingTiming */
export function getPerfectEdgeTolerance(): { earlyPx: number; latePx: number } {
  const { perfectPx, lateMissPx } = getScaledEdgeJudge(getGuideRingRadius());
  return { earlyPx: perfectPx, latePx: lateMissPx };
}

export const MUSIC_BPM = 120;
export const COLOR_SWITCH_GAP = 0.35;

/** 同时存在的黄圈缩圈上限 */
export const MAX_CONCURRENT_YELLOW = 3;
export const YELLOW_BURST_GAP = 0.7;
/** 分段黄圈批次之间的间隔（如先 1 个，隔一会再出 2 个） */
export const YELLOW_CHUNK_GAP = 0.9;

/** 律动阶段默认时长（秒），实际以关卡配置为准 */
export const RHYTHM_PHASE_DURATION = 60;

/** 音符结束后的切换间隔（秒） */
export const NOTE_TRANSITION_GAP = {
  default: 0.12,
  /** 蓝圈完成后立即出下一缩圈 */
  afterBlue: 0,
  /** 黄圈波次完成后立即出下一缩圈 */
  afterYellow: 0,
} as const;

/** 红/蓝独占结束后，下一圈再过多久到达中心（独占结束时圈仍在中心外侧、留有空间） */
export const POST_EXCLUSIVE_CENTER_GAP = 0.9;
/**
 * 预出圈在独占结束前多久开始缩入（提前出现一点，独占结束时停在中心外侧）。
 * 由于缩圈是缓出曲线（前快后慢），该值不宜过大，否则结束时已贴近中心。
 */
export const POST_EXCLUSIVE_LEAD_IN = 0.7;

export const YELLOW_BREATH = {
  pressedScale: 0.78,
  pressLerp: 0.38,
  releaseLerp: 0.22,
  tapAnimMs: 180,
} as const;

export const BLUE_HOLD = {
  duration: 3,
  progressStroke: 6,
  holdScale: 0.92,
  holdLerp: 0.08,
  progressRadius: COLOR_RING_RADIUS + 18,
} as const;

export const RED_MASH = {
  /** 连点窗口（秒） */
  window: 1.25,
  perfectTaps: 6,
  goodTaps: 4,
  punchScale: 1.25,
  punchLerp: 0.4,
  releaseLerp: 0.15,
} as const;

/** 红圈结束后、阶段未结束时追加的黄圈波次 */
export const POST_RED_YELLOW = {
  count: 3,
  gap: 0.55,
  maxApproach: 2.2,
  minApproach: 1.2,
} as const;

export const FOLLOW_YELLOW_DELAY = 0.25;
export const EYE_LOOK_INTERVAL = 1500;
export const EMOJI_TOYS = ['🎵', '🎶', '⭐', '🎸', '🥁', '🎹', '🎺'] as const;
export const EMOJI_BOUNCE_RATIO = 0.03;
