import Phaser from 'phaser';
import { NOTE_COLORS } from '../config/rhythm';
import { getRhythmHoldProgressRadius, getRhythmHoldProgressStroke } from '../config/rhythmViewport';

/**
 * 长按进度环 — 半径固定，颜色随当前音符
 */
export class HoldProgressRing {
  private graphics: Phaser.GameObjects.Graphics;
  private cx: number;
  private cy: number;
  private radius: number;
  private progress = 0;
  private lastDrawnProgress = -1;
  private visible = false;
  private holding = false;
  private color = NOTE_COLORS.blue;

  constructor(scene: Phaser.Scene, cx: number, cy: number) {
    this.graphics = scene.add.graphics().setDepth(22);
    this.cx = cx;
    this.cy = cy;
    this.radius = getRhythmHoldProgressRadius(1);
  }

  /** 跟随中心圆实时缩放，消除进度环与圆之间的留白 */
  setBodyScale(scale: number): void {
    this.radius = getRhythmHoldProgressRadius(scale);
    if (this.visible) this.redraw();
  }

  setNoteColor(color: number): void {
    this.color = color;
    if (this.visible) this.redraw();
  }

  /** 点击瞬间显示进度环（0% 起） */
  startHold(): void {
    this.holding = true;
    this.progress = 0;
    this.visible = true;
    this.redraw();
  }

  setProgress(value: number): void {
    const next = Math.max(0, Math.min(1, value));
    if (Math.abs(next - this.progress) < 0.004) return;
    this.progress = next;
    if (this.holding) this.visible = true;
    this.redraw();
  }

  private redraw(): void {
    const rounded = Math.round(this.progress * 200) / 200;
    if (rounded === this.lastDrawnProgress && this.visible) return;
    this.lastDrawnProgress = rounded;

    this.graphics.clear();
    if (!this.visible) return;

    const stroke = getRhythmHoldProgressStroke();
    this.graphics.lineStyle(stroke, this.color, 0.25);
    this.graphics.beginPath();
    this.graphics.arc(this.cx, this.cy, this.radius, 0, Math.PI * 2, false);
    this.graphics.strokePath();

    if (this.progress > 0) {
      const start = Phaser.Math.DegToRad(-90);
      const end = start + Phaser.Math.PI2 * this.progress;
      this.graphics.lineStyle(stroke, this.color, 1);
      this.graphics.beginPath();
      this.graphics.arc(this.cx, this.cy, this.radius, start, end, false);
      this.graphics.strokePath();
    }
  }

  clear(): void {
    this.graphics.clear();
    this.progress = 0;
    this.lastDrawnProgress = -1;
    this.visible = false;
    this.holding = false;
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
