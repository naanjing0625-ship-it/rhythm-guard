import Phaser from 'phaser';
import type { AccuracyGrade } from '../config/rhythmBalance';
import { GRADE_COLORS } from '../config/rhythmBalance';

export interface GradeTextOptions {
  depth?: number;
  fontSize?: number;
  animate?: boolean;
}

/** 在指定位置绘制节奏评级；SSS 带发光描边与呼吸动画 */
export function addGradeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  grade: AccuracyGrade,
  options: GradeTextOptions = {},
): Phaser.GameObjects.Text {
  const depth = options.depth ?? 0;
  const fontSize = options.fontSize ?? 16;
  const animate = options.animate ?? true;

  if (grade === 'SSS') {
    const glow = scene.add.text(x, y, grade, {
      fontSize: `${fontSize + 4}px`,
      color: '#ff44cc',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);

    const main = scene.add.text(x, y, grade, {
      fontSize: `${fontSize + 2}px`,
      color: '#fff8b0',
      fontFamily: 'Arial Black, Arial',
      fontStyle: 'bold',
      stroke: '#ff8800',
      strokeThickness: 4,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#ff00aa',
        blur: 12,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5).setDepth(depth + 1);

    if (animate) {
      scene.tweens.add({
        targets: [glow, main],
        scale: { from: 1, to: 1.1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      scene.tweens.add({
        targets: glow,
        alpha: { from: 0.35, to: 0.8 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return main;
  }

  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontSize: `${fontSize}px`,
    color: GRADE_COLORS[grade],
    fontFamily: 'Arial',
    fontStyle: 'bold',
  };
  if (grade === 'SS') {
    style.stroke = '#c9a000';
    style.strokeThickness = 2;
    style.fontFamily = 'Arial Black, Arial';
  } else if (grade === 'S') {
    style.stroke = '#5a3fd4';
    style.strokeThickness = 1;
  }

  return scene.add.text(x, y, grade, style).setOrigin(0.5).setDepth(depth);
}

/** 节奏结束横幅：评级 + 准确度（水平居中） */
export function addRhythmGradeSummary(
  scene: Phaser.Scene,
  centerX: number,
  y: number,
  grade: AccuracyGrade,
  accuracy: number,
  depth = 0,
): void {
  addGradeText(scene, centerX, y - 8, grade, { depth, fontSize: grade === 'SSS' ? 32 : 24, animate: true });
  scene.add.text(centerX, y + 28, `准确度 ${Math.round(accuracy * 100)}%`, {
    fontSize: '18px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(depth);
}
