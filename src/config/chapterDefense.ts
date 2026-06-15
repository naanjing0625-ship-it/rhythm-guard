import type { ChapterTheme } from './chapterTheme';
import { getRunChapterTheme } from './chapterTheme';

/** 守卫阶段节拍核心外观（按章节） */
export interface ChapterCoreVisual {
  faceColor: number;
  ringColor: number;
  strokeColor: number;
  labelColor: string;
}

const CORE_VISUALS: Record<string, ChapterCoreVisual> = {
  default: {
    faceColor: 0xf1c40f,
    ringColor: 0x7b4fff,
    strokeColor: 0x7b4fff,
    labelColor: '#7b4fff',
  },
  tutorial: {
    faceColor: 0xffe082,
    ringColor: 0xf39c12,
    strokeColor: 0xe67e22,
    labelColor: '#d35400',
  },
  chapter1: {
    faceColor: 0xfff176,
    ringColor: 0x27ae60,
    strokeColor: 0x1e8449,
    labelColor: '#27ae60',
  },
  chapter2: {
    faceColor: 0xaeb6bf,
    ringColor: 0x2c3e50,
    strokeColor: 0x3498db,
    labelColor: '#2c3e50',
  },
  chapter3: {
    faceColor: 0xe8daef,
    ringColor: 0x8e44ad,
    strokeColor: 0x6c3483,
    labelColor: '#8e44ad',
  },
};

export function getChapterCoreVisual(theme: ChapterTheme): ChapterCoreVisual {
  return CORE_VISUALS[theme.id] ?? CORE_VISUALS.default;
}

export function getRunChapterCoreVisual(): ChapterCoreVisual {
  return getChapterCoreVisual(getRunChapterTheme());
}

/** 守卫阶段程序化 BGM（按章节） */
export interface DefenseBgmProfile {
  stepMs: number;
  bassLine: readonly number[];
  bassWave: OscillatorType;
  bassVolStrong: number;
  bassVolWeak: number;
  hatVol: number;
  snareVol: number;
}

const BGM_PROFILES: Record<string, DefenseBgmProfile> = {
  default: {
    stepMs: 250,
    bassLine: [98, 110, 123.47, 110, 87.31, 98, 110, 123.47],
    bassWave: 'triangle',
    bassVolStrong: 0.16,
    bassVolWeak: 0.11,
    hatVol: 0.035,
    snareVol: 0.06,
  },
  tutorial: {
    stepMs: 273,
    bassLine: [87.31, 98, 110, 98, 82.41, 87.31, 98, 110],
    bassWave: 'sine',
    bassVolStrong: 0.13,
    bassVolWeak: 0.09,
    hatVol: 0.028,
    snareVol: 0.045,
  },
  chapter1: {    stepMs: 250,
    bassLine: [98, 110, 130.81, 110, 87.31, 98, 123.47, 110],
    bassWave: 'triangle',
    bassVolStrong: 0.17,
    bassVolWeak: 0.12,
    hatVol: 0.038,
    snareVol: 0.065,
  },
  chapter2: {
    stepMs: 300,
    bassLine: [73.42, 82.41, 92.5, 82.41, 65.41, 73.42, 87.31, 82.41],
    bassWave: 'sine',
    bassVolStrong: 0.15,
    bassVolWeak: 0.1,
    hatVol: 0.03,
    snareVol: 0.055,
  },
  chapter3: {
    stepMs: 231,
    bassLine: [110, 123.47, 146.83, 123.47, 98, 110, 130.81, 146.83],
    bassWave: 'sawtooth',
    bassVolStrong: 0.18,
    bassVolWeak: 0.12,
    hatVol: 0.042,
    snareVol: 0.07,
  },
};

export function getDefenseBgmProfile(theme: ChapterTheme): DefenseBgmProfile {
  return BGM_PROFILES[theme.id] ?? BGM_PROFILES.default;
}

export function getRunDefenseBgmProfile(): DefenseBgmProfile {
  return getDefenseBgmProfile(getRunChapterTheme());
}

export const DEFAULT_DEFENSE_BGM_PROFILE = BGM_PROFILES.default;