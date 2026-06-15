import Phaser from 'phaser';
import { META_UPGRADES } from '../config/meta';
import { RHYTHM_THEME, TD_BODY_STYLE, TD_TITLE_STYLE } from '../config/rhythmTheme';
import { saveManager } from '../save/SaveManager';
import { createTextButton, createPanel } from '../ui/HUD';
import { addRhythmTdBackdrop } from '../ui/RhythmTdChrome';
import { GAME_WIDTH, GAME_HEIGHT } from '../core/Game';

export class MetaScene extends Phaser.Scene {
  constructor() {
    super('MetaScene');
  }

  create(): void {
    addRhythmTdBackdrop(this);
    const save = saveManager.getData();
    this.add.text(GAME_WIDTH / 2, 36, '⭐ Meta 升级', { ...TD_TITLE_STYLE, fontSize: '30px' }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 72, `可用星星: ${save.totalStars}`, {
      fontSize: '20px', color: RHYTHM_THEME.textGold, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    createPanel(this, 48, 108, GAME_WIDTH - 96, META_UPGRADES.length * 55 + 20, 0.35);

    let y = 132;
    for (const upgrade of META_UPGRADES) {
      const current = save.metaLevels[upgrade.id] ?? 0;
      const maxed = current >= upgrade.maxLevel;
      const label = `${upgrade.name} Lv.${current}/${upgrade.maxLevel} — ${upgrade.description} (${upgrade.costPerLevel}★)`;

      this.add.text(72, y, label, { ...TD_BODY_STYLE, fontSize: '15px', color: RHYTHM_THEME.textDark });

      if (!maxed) {
        createTextButton(this, GAME_WIDTH - 120, y, '升级', async () => {
          if (saveManager.purchaseMeta(upgrade.id)) {
            await saveManager.save();
            this.scene.restart();
          }
        }, RHYTHM_THEME.noteBlue).setScale(0.7);
      } else {
        this.add.text(GAME_WIDTH - 120, y, '已满', {
          fontSize: '14px', color: RHYTHM_THEME.textMuted, fontFamily: 'Arial',
        }).setOrigin(0.5);
      }
      y += 55;
    }

    createTextButton(this, GAME_WIDTH / 2, GAME_HEIGHT - 58, '返回', () => this.scene.start('MenuScene'), RHYTHM_THEME.primary);
  }
}
