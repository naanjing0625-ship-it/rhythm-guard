import Phaser from 'phaser';
import { getGuideRingRadius } from '../config/rhythm';
import { getRhythmRingStroke } from '../config/rhythmViewport';

interface HaloInstance {
  x: number;
  y: number;
  progress: number;
  duration: number;
  startRadius: number;
  endRadius: number;
  color: number;
  stroke: number;
  startAlpha: number;
  graphics: Phaser.GameObjects.Graphics;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const MAX_HALOS = 8;

export class ExpandingHalo {
  private scene: Phaser.Scene;
  private halos: HaloInstance[] = [];
  private depth: number;
  private layer: Phaser.GameObjects.Container | null;

  constructor(scene: Phaser.Scene, depth = 33, layer: Phaser.GameObjects.Container | null = null) {
    this.scene = scene;
    this.depth = depth;
    this.layer = layer;
  }

  private attach(obj: Phaser.GameObjects.Graphics): Phaser.GameObjects.Graphics {
    if (this.layer) this.layer.add(obj);
    return obj;
  }

  burst(x: number, y: number, color: number, opts?: {
    startRadius?: number;
    endRadius?: number;
    duration?: number;
    stroke?: number;
    alpha?: number;
    delay?: number;
  }): void {
    const g = this.attach(this.scene.add.graphics().setDepth(this.depth));
    const halo: HaloInstance = {
      x,
      y,
      progress: opts?.delay ? -opts.delay : 0,
      duration: opts?.duration ?? 520,
      startRadius: opts?.startRadius ?? 50,
      endRadius: opts?.endRadius ?? 160,
      color,
      stroke: opts?.stroke ?? 6,
      startAlpha: opts?.alpha ?? 0.55,
      graphics: g,
    };
    this.halos.push(halo);
    while (this.halos.length > MAX_HALOS) {
      const old = this.halos.shift();
      old?.graphics.destroy();
    }
  }

  perfectBurst(x: number, y: number): void {
    // 从中间黄圈外缘向外扩散，而非从圆心
    const outer = getGuideRingRadius();
    const stroke = getRhythmRingStroke();
    const expand = outer * 0.55;
    this.burst(x, y, 0xffd700, {
      startRadius: outer,
      endRadius: outer + expand,
      duration: 480,
      stroke: Math.max(8, Math.round(stroke * 0.55)),
      alpha: 0.75,
    });
    this.burst(x, y, 0xffe066, {
      startRadius: outer + stroke * 0.15,
      endRadius: outer + expand * 1.35,
      duration: 680,
      stroke: Math.max(5, Math.round(stroke * 0.35)),
      alpha: 0.4,
      delay: 80,
    });
  }

  greatBurst(x: number, y: number): void {
    this.burst(x, y, 0x2ecc71, { startRadius: 50, endRadius: 140, duration: 450, stroke: 6, alpha: 0.5 });
  }

  redTapBurst(x: number, y: number): void {
    this.burst(x, y, 0xe74c3c, { startRadius: 40, endRadius: 110, duration: 320, stroke: 4, alpha: 0.75 });
  }

  update(delta: number): void {
    for (let i = this.halos.length - 1; i >= 0; i--) {
      const h = this.halos[i];
      h.progress += delta;
      if (h.progress < 0) continue;

      const t = Math.min(1, h.progress / h.duration);
      const eased = easeOutCubic(t);
      const radius = h.startRadius + (h.endRadius - h.startRadius) * eased;
      const alpha = h.startAlpha * (1 - t);

      h.graphics.clear();
      if (alpha > 0.01) {
        h.graphics.lineStyle(h.stroke, h.color, alpha);
        h.graphics.strokeCircle(h.x, h.y, radius);
      }

      if (t >= 1) {
        h.graphics.destroy();
        this.halos.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const h of this.halos) h.graphics.destroy();
    this.halos = [];
  }

  destroy(): void {
    this.clear();
  }
}
