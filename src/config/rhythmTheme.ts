import { GAME_HEIGHT, GAME_WIDTH } from '../core/viewport';

/** 与 RhythmScene 一致的暖色律动视觉主题 */
export const RHYTHM_THEME = {
  bg: 0xfff5e6,
  gridCell: 0xffffff,
  gridCellAlpha: 0.72,
  gridStroke: 0xe8dcc8,
  coreCell: 0xf1c40f,
  coreCellAlpha: 0.35,
  coreStroke: 0x7b4fff,
  coreFace: 0xf1c40f,
  primary: 0x7b4fff,
  noteYellow: 0xf1c40f,
  noteBlue: 0x3498db,
  noteRed: 0xe74c3c,
  progressBg: 0xdddddd,
  progressFill: 0x7b4fff,
  hpWarn: 0xf1c40f,
  hpDanger: 0xe74c3c,
  textDark: '#333333',
  textMid: '#666666',
  textMuted: '#888888',
  textAccent: '#7b4fff',
  textGold: '#d4a017',
} as const;

export function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export const TD_TITLE_STYLE = {
  fontSize: '22px',
  color: RHYTHM_THEME.textAccent,
  fontFamily: 'Arial',
  fontStyle: 'bold',
} as const;

export const TD_BODY_STYLE = {
  fontSize: '14px',
  color: RHYTHM_THEME.textMid,
  fontFamily: 'Arial',
} as const;

export const TD_HUD_STYLE = {
  fontSize: '15px',
  color: RHYTHM_THEME.textDark,
  fontFamily: 'Arial',
} as const;

export function getTdViewportSize(): { w: number; h: number } {
  return { w: GAME_WIDTH, h: GAME_HEIGHT };
}
