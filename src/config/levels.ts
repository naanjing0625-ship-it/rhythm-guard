import type { WaveConfig } from './enemies';
import { getLevelRhythmConfig, getLevelRepairLimit } from './rhythmBalance';
import { getTdLevelCoreHp, getTdLevelWaves } from './tdContent';
import { isTutorialLevel, TUTORIAL_LEVEL_ID } from './tutorial';

export interface LevelConfig {
  id: string;
  name: string;
  chapter: number;
  chartId: string;
  bpm: number;
  /** 律动阶段时长（秒） */
  duration: number;
  coreHp: number;
  /** 本关核心修复次数上限 */
  repairLimit: number;
  waves: WaveConfig[];
  starsRequired?: number;
}

export const CHAPTERS = [
  { id: 1, name: '王国乐章', color: 0x27ae60 },
  { id: 2, name: '暗影森林', color: 0x2c3e50 },
  { id: 3, name: '雷霆高地', color: 0x8e44ad },
];

const LEVEL_META: Omit<LevelConfig, 'coreHp' | 'waves' | 'duration' | 'bpm' | 'repairLimit'>[] = [
  { id: 'level_01', name: '初醒之鼓', chapter: 1, chartId: 'level_01' },
  { id: 'level_02', name: '律动试炼', chapter: 1, chartId: 'level_02' },
  { id: 'level_03', name: '合成之道', chapter: 1, chartId: 'level_03' },
  { id: 'level_04', name: '疾风来袭', chapter: 1, chartId: 'level_04' },
  { id: 'level_05', name: '王国守卫', chapter: 1, chartId: 'level_05' },
  { id: 'level_06', name: '暗影序曲', chapter: 2, chartId: 'level_06', starsRequired: 8 },
  { id: 'level_07', name: '雷鸣合奏', chapter: 2, chartId: 'level_07', starsRequired: 10 },
  { id: 'level_08', name: '终极守护', chapter: 3, chartId: 'level_08', starsRequired: 18 },
];

export const LEVELS: LevelConfig[] = LEVEL_META.map((meta) => {
  const rhythm = getLevelRhythmConfig(meta.id);
  return {
    ...meta,
    bpm: rhythm.bpm,
    duration: rhythm.duration,
    coreHp: getTdLevelCoreHp(meta.id) ?? 100,
    repairLimit: getLevelRepairLimit(meta.id),
    waves: getTdLevelWaves(meta.id),
  };
});

export function getTutorialLevel(): LevelConfig {
  return {
    id: TUTORIAL_LEVEL_ID,
    name: '新手引导',
    chapter: 0,
    chartId: 'level_tutorial',
    bpm: 120,
    duration: 28,
    coreHp: getTdLevelCoreHp(TUTORIAL_LEVEL_ID) ?? 60,
    repairLimit: getLevelRepairLimit(TUTORIAL_LEVEL_ID),
    waves: getTdLevelWaves(TUTORIAL_LEVEL_ID),
  };
}

export function getLevel(id: string): LevelConfig {
  if (isTutorialLevel(id)) return getTutorialLevel();
  const level = LEVELS.find((l) => l.id === id);
  if (!level) throw new Error(`Level not found: ${id}`);
  return level;
}

export function getLevelsByChapter(chapter: number): LevelConfig[] {
  return LEVELS.filter((l) => l.chapter === chapter);
}
