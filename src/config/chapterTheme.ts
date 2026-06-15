import { gameState } from '../core/GameState';

export interface ChapterTheme {
  id: string;
  name: string;
  bgTop: number;
  bgBottom: number;
  /** 条纹、节拍柱、舞台边线 */
  accent: number;
  /** 漂浮装饰次要色 */
  accentSoft: number;
  decorEmojis: readonly string[];
  decorAlpha: number;
}

/** 装饰 emoji 归一化坐标 [x, y] */
export const BACKDROP_DECOR_POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [0.06, 0.12], [0.94, 0.1], [0.05, 0.88], [0.95, 0.85],
  [0.18, 0.5], [0.82, 0.48],
];

const THEMES: Record<string, ChapterTheme> = {
  default: {
    id: 'default',
    name: '律动大厅',
    bgTop: 0xfff8f0,
    bgBottom: 0xffecd6,
    accent: 0x7b4fff,
    accentSoft: 0xf1c40f,
    decorEmojis: ['🎵', '🎶', '⭐', '🎸', '🥁', '🎹'],
    decorAlpha: 0.22,
  },
  tutorial: {
    id: 'tutorial',
    name: '新手引导',
    bgTop: 0xfff9e8,
    bgBottom: 0xffe8b0,
    accent: 0xf39c12,
    accentSoft: 0xf1c40f,
    decorEmojis: ['📖', '✨', '🎵', '🥁', '⭐', '💡'],
    decorAlpha: 0.24,
  },
  chapter1: {
    id: 'chapter1',
    name: '王国乐章',
    bgTop: 0xf4fff6,
    bgBottom: 0xd8f5de,
    accent: 0x27ae60,
    accentSoft: 0xf1c40f,
    decorEmojis: ['🏰', '🌿', '☀️', '🥁', '🎵', '🌻'],
    decorAlpha: 0.26,
  },
  chapter2: {
    id: 'chapter2',
    name: '暗影森林',
    bgTop: 0xeaf0f4,
    bgBottom: 0xcddae6,
    accent: 0x2c3e50,
    accentSoft: 0x3498db,
    decorEmojis: ['🌲', '🌙', '🍄', '🦇', '🎵', '🌫️'],
    decorAlpha: 0.24,
  },
  chapter3: {
    id: 'chapter3',
    name: '雷霆高地',
    bgTop: 0xf5ecff,
    bgBottom: 0xddd0f2,
    accent: 0x8e44ad,
    accentSoft: 0xf1c40f,
    decorEmojis: ['⚡', '⛰️', '🌩️', '✨', '🥁', '🎶'],
    decorAlpha: 0.26,
  },
};

export function resolveChapterTheme(chapter: number | 'default' | 'tutorial'): ChapterTheme {
  if (chapter === 'default') return THEMES.default;
  if (chapter === 'tutorial' || chapter === 0) return THEMES.tutorial;
  if (chapter === 1) return THEMES.chapter1;
  if (chapter === 2) return THEMES.chapter2;
  if (chapter === 3) return THEMES.chapter3;
  return THEMES.default;
}

export function getRunChapterTheme(): ChapterTheme {
  if (gameState.tutorialMode) return THEMES.tutorial;
  const chapter = gameState.run?.level.chapter;
  if (chapter == null || chapter === 0) return THEMES.tutorial;
  return resolveChapterTheme(chapter);
}

export function getLevelSelectChapterTheme(): ChapterTheme {
  return resolveChapterTheme(gameState.selectedChapter);
}
