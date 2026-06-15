import Phaser from 'phaser';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import { createTextButton } from '../ui/HUD';
import { GameplayGuideOverlay } from '../ui/GameplayGuide';
import { addRhythmTdBackdrop } from '../ui/RhythmTdChrome';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Game';
import { gameState } from '../core/GameState';
import { saveManager } from '../save/SaveManager';

export class MenuScene extends Phaser.Scene {
  private gameplayGuide = new GameplayGuideOverlay();
  private welcomePanel: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('MenuScene');
  }

  create(): void {
    addRhythmTdBackdrop(this);

    this.add.text(GAME_WIDTH / 2, 120, '🎵', { fontSize: '64px' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 175, 'Rhythm Guard', {
      fontSize: '52px', color: RHYTHM_THEME.textAccent, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 230, '音乐节奏 × 律动守卫', {
      fontSize: '22px', color: RHYTHM_THEME.textMid, fontFamily: 'Arial',
    }).setOrigin(0.5);

    createTextButton(this, GAME_WIDTH / 2, 300, '开始游戏', () => this.scene.start('LevelSelectScene'), RHYTHM_THEME.primary);
    createTextButton(this, GAME_WIDTH / 2, 365, '新手引导', () => this.startTutorial(), 0xf39c12);
    createTextButton(this, GAME_WIDTH / 2, 430, '战斗模拟器', () => this.scene.start('BattleSimulatorScene'), 0x27ae60);
    createTextButton(this, GAME_WIDTH / 2, 495, 'Meta 升级', () => this.scene.start('MetaScene'), RHYTHM_THEME.noteBlue);
    createTextButton(this, GAME_WIDTH / 2, 560, '玩法说明', () => this.gameplayGuide.show(this), RHYTHM_THEME.noteYellow);

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 40, '🟡单击 🔵长按3秒 🔴连击5下 | 律动手牌 | 守护节拍核心', {
      fontSize: '14px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
    }).setOrigin(0.5);

    if (!saveManager.isTutorialCompleted()) {
      this.time.delayedCall(500, () => this.showWelcomePrompt());
    }
  }

  private startTutorial(): void {
    gameState.startTutorialRun();
    this.scene.start('RhythmScene');
  }

  private showWelcomePrompt(): void {
    if (this.welcomePanel) return;

    const depth = 500;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const panelW = Math.min(480, GAME_WIDTH - 48);

    const root = this.add.container(0, 0).setDepth(depth);
    const dim = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.5).setDepth(depth);
    root.add(dim);

    const panel = this.add.rectangle(cx, cy, panelW, 200, 0xffffff, 0.97).setDepth(depth + 1);
    panel.setStrokeStyle(2, RHYTHM_THEME.primary, 0.35);
    root.add(panel);

    root.add(this.add.text(cx, cy - 56, '欢迎来到 Rhythm Guard', {
      fontSize: '22px', color: RHYTHM_THEME.textAccent, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2));

    root.add(this.add.text(cx, cy - 10, '建议先完成新手引导，学习节奏、部署与守卫三阶段玩法。', {
      fontSize: '15px', color: RHYTHM_THEME.textDark, fontFamily: 'Arial',
      wordWrap: { width: panelW - 40 }, align: 'center',
    }).setOrigin(0.5).setDepth(depth + 2));

    const dismiss = (): void => {
      const buttons = root.getData('buttons') as Phaser.GameObjects.Container[];
      for (const btn of buttons) {
        const hitZone = btn.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
        hitZone?.destroy();
        btn.destroy(true);
      }
      root.destroy(true);
      this.welcomePanel = null;
    };

    const startBtn = createTextButton(this, cx - 90, cy + 56, '开始引导', () => {
      dismiss();
      this.startTutorial();
    }, RHYTHM_THEME.primary, depth + 3);

    const laterBtn = createTextButton(this, cx + 90, cy + 56, '稍后再说', dismiss, 0x888888, depth + 3);

    this.welcomePanel = root;
    root.setData('buttons', [startBtn, laterBtn]);
  }

  shutdown(): void {
    this.gameplayGuide.hide();
    if (this.welcomePanel) {
      const buttons = this.welcomePanel.getData('buttons') as Phaser.GameObjects.Container[] | undefined;
      for (const btn of buttons ?? []) {
        const hitZone = btn.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
        hitZone?.destroy();
        btn.destroy(true);
      }
      this.welcomePanel.destroy(true);
      this.welcomePanel = null;
    }
  }
}
