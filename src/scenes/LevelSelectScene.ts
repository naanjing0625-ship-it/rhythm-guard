import Phaser from 'phaser';
import { CHAPTERS, getLevelsByChapter } from '../config/levels';
import { normalizeAccuracyGrade } from '../config/rhythmBalance';
import { RHYTHM_THEME, TD_TITLE_STYLE } from '../config/rhythmTheme';
import { gameState } from '../core/GameState';
import { saveManager } from '../save/SaveManager';
import { createTextButton, createPanel, setTextButtonHighlighted } from '../ui/HUD';
import { addGradeText } from '../ui/GradeDisplay';
import { getLevelSelectChapterTheme } from '../config/chapterTheme';
import { addRhythmTdBackdrop, showRhythmToast } from '../ui/RhythmTdChrome';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Game';

function chapterHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** 关卡列表列位置（关卡名 → 评级 → 星级 → 时长），四列总宽 400px */
const COL_TABLE_WIDTH = 400;
const COL_TABLE_LEFT = GAME_WIDTH / 2 - COL_TABLE_WIDTH / 2;
const COL_LEVEL = COL_TABLE_LEFT;
const COL_GRADE = COL_TABLE_LEFT + Math.round(COL_TABLE_WIDTH / 3);
const COL_STARS = COL_TABLE_LEFT + Math.round((COL_TABLE_WIDTH * 2) / 3);
const COL_DURATION = COL_TABLE_LEFT + COL_TABLE_WIDTH;
const LIST_PANEL_TOP = 168;
const LIST_HEADER_Y = 180;
const LIST_ROW_START_Y = 218;
const LIST_ROW_HEIGHT = 48;

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create(): void {
    addRhythmTdBackdrop(this, getLevelSelectChapterTheme());
    this.add.text(GAME_WIDTH / 2, 36, '🎵 选择关卡', { ...TD_TITLE_STYLE, fontSize: '30px' }).setOrigin(0.5);

    const chapter = gameState.selectedChapter;
    const chapterInfo = CHAPTERS.find((c) => c.id === chapter)!;

    this.add.text(60, 68, chapterInfo.name, {
      fontSize: '20px', color: chapterHex(chapterInfo.color), fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0, 0);

    for (const ch of CHAPTERS) {
      const active = ch.id === chapter;
      const btn = createTextButton(this, 60 + (ch.id - 1) * 120, 118, `第${ch.id}章`, () => {
        gameState.selectedChapter = ch.id;
        this.scene.restart();
      }, active ? ch.color : RHYTHM_THEME.gridCell);
      btn.setScale(0.8);
      setTextButtonHighlighted(btn, active, active ? ch.color : RHYTHM_THEME.gridCell);
    }

    const levels = getLevelsByChapter(chapter);
    const save = saveManager.getData();
    const earnedStars = saveManager.getEarnedStars();
    const listPanelHeight = (LIST_ROW_START_Y - LIST_PANEL_TOP) + levels.length * LIST_ROW_HEIGHT + 20;
    createPanel(this, 80, LIST_PANEL_TOP, GAME_WIDTH - 160, listPanelHeight, 0.35);

    const headerStyle = { fontSize: '13px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial' };
    this.add.text(COL_LEVEL, LIST_HEADER_Y, '关卡', headerStyle).setOrigin(0.5);
    this.add.text(COL_GRADE, LIST_HEADER_Y, '评级', headerStyle).setOrigin(0.5);
    this.add.text(COL_STARS, LIST_HEADER_Y, '星级', headerStyle).setOrigin(0.5);
    this.add.text(COL_DURATION, LIST_HEADER_Y, '时长', headerStyle).setOrigin(0.5);

    let y = LIST_ROW_START_Y;
    for (const level of levels) {
      const unlocked = saveManager.isLevelUnlocked(level.id);
      const canUnlock = saveManager.canUnlockLevel(level.id);
      const stars = save.levelStars[level.id] ?? 0;
      const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      const rhythmGrade = normalizeAccuracyGrade(save.levelRhythmGrades[level.id]);

      const label = unlocked ? level.name : canUnlock ? `${level.name} (未解锁)` : `${level.name} (需${level.starsRequired}★)`;

      if (unlocked) {
        createTextButton(this, COL_LEVEL, y, label, () => {
          gameState.selectedLevelId = level.id;
          gameState.startRun(level);
          this.scene.start('RhythmScene');
        }, RHYTHM_THEME.primary).setScale(0.8);
        this.add.text(COL_DURATION, y, `${level.duration}s`, {
          fontSize: '13px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
        }).setOrigin(0.5);
        if (stars > 0) {
          if (rhythmGrade) {
            addGradeText(this, COL_GRADE, y, rhythmGrade, { fontSize: 16, animate: rhythmGrade === 'SSS' });
          }
          this.add.text(COL_STARS, y, starStr, {
            fontSize: '16px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial',
          }).setOrigin(0.5);
        }
      } else if (canUnlock) {
        this.add.text(COL_LEVEL, y, label, {
          fontSize: '16px', color: RHYTHM_THEME.textAccent, fontFamily: 'Arial',
        }).setOrigin(0.5);
        this.addLockedHintHitArea(y, '该关卡尚未解锁：请先通关前置关卡', RHYTHM_THEME.noteBlue);
      } else {
        this.add.text(COL_LEVEL, y, label, {
          fontSize: '16px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
        }).setOrigin(0.5);
        const need = level.starsRequired ?? 0;
        const short = Math.max(0, need - earnedStars);
        this.addLockedHintHitArea(y, `该关卡未解锁：累计还差 ${short}★（需 ${need}★）`, RHYTHM_THEME.noteRed);
      }
      y += LIST_ROW_HEIGHT;
    }

    this.add.text(GAME_WIDTH - 60, 68, `⭐ 可用 ${save.totalStars} | 累计 ${earnedStars}`, {
      fontSize: '18px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(1, 0);
    createTextButton(this, GAME_WIDTH - 100, GAME_HEIGHT - 58, '返回', () => this.scene.start('MenuScene'), RHYTHM_THEME.primary);
  }

  private addLockedHintHitArea(rowY: number, message: string, color: number): void {
    const zone = this.add.rectangle(
      GAME_WIDTH / 2,
      rowY,
      COL_TABLE_WIDTH + 120,
      LIST_ROW_HEIGHT - 8,
      0xffffff,
      0.001,
    );
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      showRhythmToast(this, message, color, 1500, 72);
    });
  }
}
