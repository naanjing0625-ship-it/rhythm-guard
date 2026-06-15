import Phaser from 'phaser';
import type { ChapterTheme } from '../config/chapterTheme';

export interface BackdropLayerOptions {
  depth?: number;
  /** 节奏关两侧窄条：简化剪影 */
  variant?: 'full' | 'strip';
  /** 雾效脉动、闪电闪烁（仅节奏关建议开启） */
  animate?: boolean;
  parent?: Phaser.GameObjects.Container;
}

interface LayerAnim {
  targets: Phaser.GameObjects.GameObject[];
  tweens: Phaser.Tweens.Tween[];
}

export interface BackdropLayerResult {
  graphics: Phaser.GameObjects.Graphics[];
  anims: LayerAnim;
}

function addGraphic(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container | undefined,
  depth: number,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  if (parent) parent.add(g);
  return g;
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}

function drawHillLine(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  baseRatio: number,
  amplitude: number,
  color: number,
  alpha: number,
  segments = 8,
): void {
  const baseY = y + h * baseRatio;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x, y + h);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const px = x + w * t;
    const wave = Math.sin(t * Math.PI * 2.4 + baseRatio * 4) * amplitude;
    const bump = Math.sin(t * Math.PI * 5.1 + 1.2) * amplitude * 0.35;
    g.lineTo(px, baseY + wave + bump);
  }
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fillPath();
}

function drawCastle(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  baseY: number,
  scale: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  const w = 48 * scale;
  const h = 36 * scale;
  const x = cx - w / 2;
  g.fillRect(x, baseY - h, w, h);
  const tw = 12 * scale;
  const th = 22 * scale;
  g.fillRect(x - tw * 0.4, baseY - h - th, tw, th);
  g.fillRect(x + w - tw * 0.6, baseY - h - th * 1.1, tw, th);
  g.fillRect(x + w * 0.38, baseY - h - th * 0.85, tw * 0.9, th * 0.85);
  g.fillTriangle(x - tw * 0.4, baseY - h - th, x - tw * 0.4 + tw / 2, baseY - h - th - 10 * scale, x - tw * 0.4 + tw, baseY - h - th);
  g.fillTriangle(x + w - tw * 0.6, baseY - h - th * 1.1, x + w - tw * 0.6 + tw / 2, baseY - h - th * 1.1 - 11 * scale, x + w - tw * 0.6 + tw, baseY - h - th * 1.1);
  g.fillTriangle(x + w * 0.38, baseY - h - th * 0.85, x + w * 0.38 + tw * 0.45, baseY - h - th * 0.85 - 9 * scale, x + w * 0.38 + tw * 0.9, baseY - h - th * 0.85);
}

function drawPineTree(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  scale: number,
  color: number,
  alpha: number,
): void {
  g.fillStyle(color, alpha);
  const trunkW = 5 * scale;
  const trunkH = 14 * scale;
  g.fillRect(x - trunkW / 2, baseY - trunkH, trunkW, trunkH);
  for (let i = 0; i < 3; i++) {
    const tierY = baseY - trunkH - i * 10 * scale;
    const tierW = (22 - i * 4) * scale;
    g.fillTriangle(x, tierY - 14 * scale, x - tierW / 2, tierY, x + tierW / 2, tierY);
  }
}

function drawMountainRange(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  baseRatio: number,
  color: number,
  alpha: number,
  jagged: Array<[number, number]>,
): void {
  const baseY = y + h * baseRatio;
  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, baseY);
  jagged.forEach(([t, peak], i) => {
    const px = x + w * t;
    const py = baseY - h * peak;
    g.lineTo(px, py);
    if (i < jagged.length - 1) {
      const nextT = jagged[i + 1][0];
      const midT = (t + nextT) / 2;
      g.lineTo(x + w * midT, baseY - h * peak * 0.55);
    }
  });
  g.lineTo(x + w, baseY);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fillPath();
}

export function drawChapterSilhouettes(
  scene: Phaser.Scene,
  theme: ChapterTheme,
  x: number,
  y: number,
  width: number,
  height: number,
  options: BackdropLayerOptions = {},
): BackdropLayerResult {
  const depth = options.depth ?? 1;
  const strip = options.variant === 'strip';
  const animate = options.animate ?? false;
  const parent = options.parent;
  const graphics: Phaser.GameObjects.Graphics[] = [];
  const animTargets: Phaser.GameObjects.GameObject[] = [];
  const tweens: Phaser.Tweens.Tween[] = [];

  const far = shade(theme.accent, strip ? 0.55 : 0.5);
  const mid = shade(theme.accent, strip ? 0.42 : 0.38);
  const near = shade(theme.accent, strip ? 0.32 : 0.28);

  const push = (g: Phaser.GameObjects.Graphics) => {
    graphics.push(g);
    return g;
  };

  switch (theme.id) {
    case 'chapter1': {
      const g1 = push(addGraphic(scene, parent, depth));
      drawHillLine(g1, x, y, width, height, 0.72, height * (strip ? 0.04 : 0.06), far, strip ? 0.2 : 0.22);
      if (!strip) {
        const gSun = push(addGraphic(scene, parent, depth));
        gSun.fillStyle(theme.accentSoft, 0.35);
        gSun.fillCircle(x + width * 0.78, y + height * 0.14, Math.min(width, height) * 0.07);
      }
      const g2 = push(addGraphic(scene, parent, depth));
      if (!strip) drawCastle(g2, x + width * 0.28, y + height * 0.72, width / 520, mid, 0.28);
      drawHillLine(g2, x, y, width, height, 0.82, height * (strip ? 0.05 : 0.08), mid, strip ? 0.28 : 0.3);
      const g3 = push(addGraphic(scene, parent, depth));
      drawHillLine(g3, x, y, width, height, 0.9, height * (strip ? 0.03 : 0.05), near, strip ? 0.35 : 0.38);
      break;
    }
    case 'chapter2': {
      if (!strip) {
        const gMoon = push(addGraphic(scene, parent, depth));
        gMoon.fillStyle(theme.accentSoft, 0.3);
        gMoon.fillCircle(x + width * 0.72, y + height * 0.12, Math.min(width, height) * 0.055);
      }
      const g1 = push(addGraphic(scene, parent, depth));
      const treeBase = y + height * 0.88;
      const treeCount = strip ? 3 : 7;
      for (let i = 0; i < treeCount; i++) {
        const t = (i + 0.5) / treeCount;
        const tx = x + width * t + Math.sin(i * 2.1) * width * 0.04;
        const sc = (strip ? 0.45 : 0.55) + (i % 3) * 0.12;
        drawPineTree(g1, tx, treeBase, sc, far, strip ? 0.35 : 0.32);
      }
      const g2 = push(addGraphic(scene, parent, depth));
      for (let i = 0; i < treeCount - 1; i++) {
        const t = (i + 1) / treeCount;
        drawPineTree(g2, x + width * t, treeBase + height * 0.02, 0.75 + (i % 2) * 0.2, near, strip ? 0.45 : 0.42);
      }
      const fog = addGraphic(scene, parent, depth + 1);
      fog.fillStyle(0xffffff, strip ? 0.14 : 0.18);
      fog.fillRect(x, y + height * 0.62, width, height * 0.38);
      graphics.push(fog);
      if (animate) {
        animTargets.push(fog);
        tweens.push(scene.tweens.add({
          targets: fog,
          alpha: { from: 0.85, to: 1 },
          duration: 3200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        }));
      }
      break;
    }
    case 'chapter3': {
      const g1 = push(addGraphic(scene, parent, depth));
      drawMountainRange(g1, x, y, width, height, 0.78, far, strip ? 0.22 : 0.24, [
        [0, 0.08], [0.22, 0.22], [0.42, 0.12], [0.58, 0.28], [0.78, 0.14], [1, 0.06],
      ]);
      const g2 = push(addGraphic(scene, parent, depth));
      drawMountainRange(g2, x, y, width, height, 0.86, near, strip ? 0.32 : 0.34, [
        [0, 0.04], [0.18, 0.14], [0.38, 0.08], [0.55, 0.18], [0.72, 0.1], [0.88, 0.16], [1, 0.05],
      ]);
      break;
    }
    case 'tutorial': {
      const g1 = push(addGraphic(scene, parent, depth));
      drawHillLine(g1, x, y, width, height, 0.8, height * 0.05, shade(theme.accent, 0.6), 0.2);
      if (!strip) {
        const gSun = push(addGraphic(scene, parent, depth));
        gSun.fillStyle(theme.accentSoft, 0.4);
        gSun.fillCircle(x + width * 0.2, y + height * 0.16, Math.min(width, height) * 0.06);
      }
      break;
    }
    default: {
      const g1 = push(addGraphic(scene, parent, depth));
      drawHillLine(g1, x, y, width, height, 0.78, height * 0.045, far, 0.18);
      const g2 = push(addGraphic(scene, parent, depth));
      drawHillLine(g2, x, y, width, height, 0.88, height * 0.035, mid, 0.24);
      if (!strip) {
        const gArc = push(addGraphic(scene, parent, depth));
        gArc.lineStyle(2, theme.accent, 0.12);
        gArc.beginPath();
        gArc.arc(x + width * 0.5, y + height * 0.92, width * 0.35, Math.PI, 0);
        gArc.strokePath();
      }
      break;
    }
  }

  return { graphics, anims: { targets: animTargets, tweens } };
}

export function destroyBackdropAnims(anims: LayerAnim): void {
  for (const tween of anims.tweens) tween.stop();
  anims.tweens.length = 0;
}
