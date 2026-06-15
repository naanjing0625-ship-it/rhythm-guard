import Phaser from 'phaser';
import { getAccuracyTier } from '../config/rhythmBalance';
import { gameState } from '../core/GameState';
import { saveManager } from '../save/SaveManager';
import { RHYTHM_THEME, TD_BODY_STYLE } from '../config/rhythmTheme';
import { createTextButton } from '../ui/HUD';
import { getRunChapterTheme } from '../config/chapterTheme';
import { addRhythmTdBackdrop } from '../ui/RhythmTdChrome';
import { GAME_WIDTH } from '../core/Game';
import { isTutorialLevel } from '../config/tutorial';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }

  async create(): Promise<void> {
    const run = gameState.run;
    if (!run) { this.scene.start('LevelSelectScene'); return; }

    this.children.removeAll(true);
    addRhythmTdBackdrop(this, getRunChapterTheme());

    const isTutorial = gameState.tutorialMode || isTutorialLevel(run.level.id);
    const victory = run.victory;

    if (isTutorial && victory) {
      saveManager.completeTutorial();
      await saveManager.save();
    }

    const title = isTutorial && victory
      ? '🎉 新手引导完成！'
      : victory ? '🎵 律动守护成功！' : '节拍断裂...';
    const color = victory ? RHYTHM_THEME.textAccent : '#e74c3c';

    this.add.text(GAME_WIDTH / 2, 120, title, { fontSize: '40px', color, fontFamily: 'Arial', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 190, run.level.name, { fontSize: '24px', color: RHYTHM_THEME.textDark, fontFamily: 'Arial' }).setOrigin(0.5);

    if (isTutorial && victory) {
      this.add.text(GAME_WIDTH / 2, 260, '你已掌握节奏、部署与守卫的基本玩法。', {
        fontSize: '18px', color: RHYTHM_THEME.textMid, fontFamily: 'Arial',
      }).setOrigin(0.5);
      this.add.text(GAME_WIDTH / 2, 300, '「初醒之鼓」已解锁，开始你的正式冒险吧！', {
        fontSize: '16px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5);
    } else {
      if (run.rhythmResult) {
        const r = run.rhythmResult;
        this.add.text(GAME_WIDTH / 2, 250, `节奏得分: ${Math.round(r.score)} / ${Math.round(r.maxScore)}`, { ...TD_BODY_STYLE, fontSize: '18px' }).setOrigin(0.5);
        this.add.text(GAME_WIDTH / 2, 280, `PERFECT ${r.judgements.perfect} | GREAT ${r.judgements.great} | GOOD ${r.judgements.good} | MISS ${r.judgements.miss}`, {
          fontSize: '14px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
        }).setOrigin(0.5);
      }

      this.add.text(GAME_WIDTH / 2, 320, `节拍核心 HP: ${Math.max(0, Math.round(run.coreHp))}/${run.coreMaxHp}`, { ...TD_BODY_STYLE, fontSize: '18px' }).setOrigin(0.5);
      this.add.text(GAME_WIDTH / 2, 350, `♪ ${run.defenseGold} | 击退 ${run.killCount} | 清空波次 ${run.wavesCleared}`, {
        fontSize: '16px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5);

      if (victory) {
        const stars = '★'.repeat(run.starsEarned) + '☆'.repeat(3 - run.starsEarned);
        this.add.text(GAME_WIDTH / 2, 390, stars, { fontSize: '36px', color: '#ffd700', fontFamily: 'Arial' }).setOrigin(0.5);
        const rhythmGrade = run.rhythmResult
          ? getAccuracyTier(run.rhythmResult.accuracy).grade
          : undefined;
        saveManager.recordVictory(run.level.id, run.starsEarned, rhythmGrade);
        await saveManager.save();
      }
    }

    const replayLevel = (): void => {
      const level = run.level;
      gameState.startRun(level);
      this.scene.start('RhythmScene');
    };

    if (isTutorial) {
      if (victory) {
        createTextButton(this, GAME_WIDTH / 2, 400, '开始正式关卡', () => {
          gameState.clearRun();
          this.scene.start('LevelSelectScene');
        }, 0x27ae60);
        createTextButton(this, GAME_WIDTH / 2, 470, '再练一次引导', () => {
          gameState.startTutorialRun();
          this.scene.start('RhythmScene');
        }, RHYTHM_THEME.primary);
      } else {
        createTextButton(this, GAME_WIDTH / 2, 400, '重新引导', () => {
          gameState.startTutorialRun();
          this.scene.start('RhythmScene');
        }, 0xe74c3c);
      }
      createTextButton(this, GAME_WIDTH / 2, victory ? 540 : 470, '返回主菜单', () => {
        gameState.clearRun();
        this.scene.start('MenuScene');
      }, 0x444444);
      return;
    }

    if (victory) {
      createTextButton(this, GAME_WIDTH / 2, 440, '再玩一次', () => replayLevel(), 0x27ae60);
      createTextButton(this, GAME_WIDTH / 2, 500, '下一关', () => {
        gameState.clearRun();
        this.scene.start('LevelSelectScene');
      });
    } else {
      createTextButton(this, GAME_WIDTH / 2, 470, '重新挑战', () => replayLevel(), 0xe74c3c);
    }

    createTextButton(this, GAME_WIDTH / 2, victory ? 560 : 540, '关卡选择', () => {
      gameState.clearRun();
      this.scene.start('LevelSelectScene');
    }, 0x444444);
  }
}
