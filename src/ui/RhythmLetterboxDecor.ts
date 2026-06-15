import Phaser from 'phaser';
import type { ChapterTheme } from '../config/chapterTheme';
import { destroyBackdropAnims, drawChapterSilhouettes, type BackdropLayerResult } from './ChapterBackdropLayers';
import { MUSIC_BPM } from '../config/rhythm';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/viewport';
import { applyTextResolution } from '../core/renderUtils';

export interface RhythmStageBounds {
  stageX: number;
  stageY: number;
  stageWidth: number;
  stageHeight: number;
}

interface FloatDecor {
  obj: Phaser.GameObjects.Text;
  baseX: number;
  baseY: number;
  phase: number;
  bob: number;
}

interface BeatBar {
  rect: Phaser.GameObjects.Rectangle;
  baseH: number;
  phase: number;
}

const SIDE_DECOR = ['♩', '♪', '♫', '♬', '★', '✦', '◎', '◉'] as const;

function beatPulse(songTime: number): number {
  const beatSec = 60 / MUSIC_BPM;
  const t = songTime % beatSec;
  const ratio = t / beatSec;
  const attack = Math.max(0, 1 - ratio / 0.14);
  const decay = Math.exp(-ratio * 5);
  return Math.max(attack * 0.45, decay);
}

function sideGlyphPool(theme: ChapterTheme): string[] {
  return [...theme.decorEmojis, ...SIDE_DECOR];
}

function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

export class RhythmLetterboxDecor {
  private container: Phaser.GameObjects.Container;
  private floats: FloatDecor[] = [];
  private beatBars: BeatBar[] = [];
  private theme: ChapterTheme;
  private layerAnims: BackdropLayerResult['anims'][] = [];

  constructor(scene: Phaser.Scene, bounds: RhythmStageBounds, theme: ChapterTheme) {
    this.theme = theme;
    this.container = scene.add.container(0, 0).setDepth(-10);

    const leftW = bounds.stageX;
    const rightX = bounds.stageX + bounds.stageWidth;
    const rightW = GAME_WIDTH - rightX;

    if (leftW >= 24) this.buildSide(scene, 0, 0, leftW, GAME_HEIGHT, 'left');
    if (rightW >= 24) this.buildSide(scene, rightX, 0, rightW, GAME_HEIGHT, 'right');

    if (leftW >= 8) this.drawStageEdge(scene, bounds.stageX, bounds.stageY, bounds.stageHeight, 'left');
    if (rightW >= 8) this.drawStageEdge(scene, rightX, bounds.stageY, bounds.stageHeight, 'right');
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  update(songTime: number): void {
    const pulse = beatPulse(songTime);
    const accent = this.theme.accent;

    this.floats.forEach((f) => {
      const wave = Math.sin(songTime * 1.6 + f.phase) * f.bob;
      const drift = Math.sin(songTime * 0.45 + f.phase * 1.7) * 4;
      f.obj.setPosition(f.baseX + drift, f.baseY + wave - pulse * 6);
      f.obj.setScale(1 + pulse * 0.08);
      f.obj.setAlpha(this.theme.decorAlpha + 0.16 + pulse * 0.18);
    });

    this.beatBars.forEach((bar) => {
      const wave = 0.55 + Math.abs(Math.sin(songTime * 2.4 + bar.phase)) * 0.45;
      const h = bar.baseH * (0.35 + wave * 0.65 + pulse * 0.25);
      bar.rect.height = h;
      bar.rect.setFillStyle(accent, 0.08 + pulse * 0.1);
    });
  }

  destroy(): void {
    for (const anims of this.layerAnims) destroyBackdropAnims(anims);
    this.layerAnims = [];
    this.container.destroy();
    this.floats = [];
    this.beatBars = [];
  }

  private buildSide(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    side: 'left' | 'right',
  ): void {
    const gradient = scene.add.graphics();
    gradient.fillGradientStyle(
      this.theme.bgTop,
      this.theme.bgTop,
      this.theme.bgBottom,
      this.theme.bgBottom,
      1,
    );
    gradient.fillRect(x, y, w, h);
    this.container.add(gradient);

    const layers = drawChapterSilhouettes(scene, this.theme, x, y, w, h, {
      variant: 'strip',
      animate: true,
      parent: this.container,
    });
    this.layerAnims.push(layers.anims);

    const stripeCount = Math.max(3, Math.floor(w / 28));
    for (let i = 0; i < stripeCount; i++) {
      const t = stripeCount <= 1 ? 0.5 : i / (stripeCount - 1);
      const sx = x + w * (0.15 + t * 0.7);
      const stripe = scene.add.rectangle(
        sx,
        y + h / 2,
        Math.max(2, w * 0.04),
        h,
        this.theme.accent,
        0.035 + t * 0.025,
      );
      this.container.add(stripe);
    }

    this.addBeatBars(scene, x + w * (side === 'left' ? 0.24 : 0.76), y + h * 0.72, w);
    this.scatterDecor(scene, x, y, w, h, side);
  }

  private addBeatBars(scene: Phaser.Scene, cx: number, cy: number, panelW: number): void {
    const barW = Math.max(4, Math.round(panelW * 0.07));
    const gap = barW + 3;
    const bases = [28, 42, 22];
    bases.forEach((baseH, i) => {
      const rect = scene.add.rectangle(cx + (i - 1) * gap, cy, barW, baseH, this.theme.accent, 0.18)
        .setOrigin(0.5, 1);
      this.container.add(rect);
      this.beatBars.push({ rect, baseH, phase: i * 0.9 });
    });
  }

  private scatterDecor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    side: 'left' | 'right',
  ): void {
    const glyphs = sideGlyphPool(this.theme);
    const slots: Array<[number, number, number]> = [
      [0.18, 0.14, 22],
      [0.72, 0.11, 18],
      [0.42, 0.28, 16],
      [0.84, 0.34, 20],
      [0.12, 0.48, 14],
      [0.58, 0.56, 24],
      [0.28, 0.68, 15],
      [0.78, 0.78, 19],
      [0.36, 0.88, 13],
      [0.66, 0.9, 21],
    ];

    slots.forEach(([px, py, size], i) => {
      const mirror = side === 'right' ? 1 - px : px;
      const fx = x + w * mirror;
      const fy = y + h * py;
      const glyph = glyphs[i % glyphs.length];
      const textColor = i % 3 === 0 ? colorHex(this.theme.accentSoft) : colorHex(this.theme.accent);
      const text = applyTextResolution(scene.add.text(fx, fy, glyph, {
        fontSize: `${size}px`,
        color: textColor,
      }).setOrigin(0.5).setAlpha(this.theme.decorAlpha + 0.12));
      this.container.add(text);
      this.floats.push({ obj: text, baseX: fx, baseY: fy, phase: i * 1.1, bob: 5 + (i % 3) * 2 });
    });
  }

  private drawStageEdge(
    scene: Phaser.Scene,
    edgeX: number,
    edgeY: number,
    edgeH: number,
    side: 'left' | 'right',
  ): void {
    const lineX = side === 'left' ? edgeX - 1 : edgeX + 1;
    const edge = scene.add.rectangle(lineX, edgeY + edgeH / 2, 1, edgeH, this.theme.accent, 0.12);
    const accent = scene.add.rectangle(lineX, edgeY + edgeH / 2, 1, edgeH, this.theme.accentSoft, 0.08);
    this.container.add([edge, accent]);
  }
}
