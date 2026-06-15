import Phaser from 'phaser';
import { getRingStroke } from '../config/rhythm';

export interface ShrinkRingDraw {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha?: number;
}

export class ShrinkRing {
  private graphics: Phaser.GameObjects.Graphics;
  private active = false;

  constructor(scene: Phaser.Scene) {
    // 让缩圈显示在进度条之上，避免顶部被进度条遮挡
    this.graphics = scene.add.graphics().setDepth(32);
  }

  begin(): void {
    this.active = true;
  }

  draw(x: number, y: number, radius: number, color: number, alpha = 0.95): void {
    this.drawMultiple([{ x, y, radius, color, alpha }]);
  }

  drawMultiple(rings: ShrinkRingDraw[]): void {
    this.graphics.clear();
    if (rings.length === 0) {
      this.active = false;
      return;
    }

    this.active = true;
    const stroke = getRingStroke();
    for (const ring of rings) {
      if (ring.radius <= 0) continue;
      this.graphics.lineStyle(stroke, ring.color, ring.alpha ?? 0.95);
      this.graphics.strokeCircle(ring.x, ring.y, ring.radius);
    }
  }

  clear(): void {
    this.graphics.clear();
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
