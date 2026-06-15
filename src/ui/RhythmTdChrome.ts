import Phaser from 'phaser';
import {
  BACKDROP_DECOR_POSITIONS,
  type ChapterTheme,
  resolveChapterTheme,
} from '../config/chapterTheme';
import { drawChapterSilhouettes } from './ChapterBackdropLayers';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/Game';

export interface ChapterBackdropOptions {
  depth?: number;
  emojiSize?: number;
  /** 节奏关由 EmojiBackground 自行放置可动装饰 */
  decor?: boolean;
  /** 窄条侧栏简化剪影 */
  variant?: 'full' | 'strip';
  /** 雾效、闪电等 */
  animate?: boolean;
}

export function drawChapterBackdrop(
  scene: Phaser.Scene,
  theme: ChapterTheme,
  width: number,
  height: number,
  options: ChapterBackdropOptions = {},
): void {
  const depth = options.depth ?? 0;
  const emojiSize = options.emojiSize ?? 28;
  const showDecor = options.decor ?? true;
  const variant = options.variant ?? 'full';

  const gradient = scene.add.graphics().setDepth(depth);
  gradient.fillGradientStyle(theme.bgTop, theme.bgTop, theme.bgBottom, theme.bgBottom, 1);
  gradient.fillRect(0, 0, width, height);

  drawChapterSilhouettes(scene, theme, 0, 0, width, height, {
    depth: depth + 1,
    variant,
    animate: options.animate ?? false,
  });

  if (!showDecor) return;

  theme.decorEmojis.slice(0, BACKDROP_DECOR_POSITIONS.length).forEach((emoji, i) => {
    const [px, py] = BACKDROP_DECOR_POSITIONS[i];
    scene.add.text(width * px, height * py, emoji, {
      fontSize: `${emojiSize}px`,
    }).setOrigin(0.5).setAlpha(theme.decorAlpha).setDepth(depth + 1);
  });
}

/** 章节渐变底 + 主题 emoji 装饰 */
export function addRhythmTdBackdrop(scene: Phaser.Scene, theme?: ChapterTheme, depth = 0): void {
  drawChapterBackdrop(scene, theme ?? resolveChapterTheme('default'), GAME_WIDTH, GAME_HEIGHT, { depth });
}

export interface RhythmGridOptions {
  gridX: number;
  gridY: number;
  cellSize: number;
  gridSize: number;
  isCore: (row: number, col: number) => boolean;
  depth?: number;
  /** deploy=白格底板；defense=仅描边无填充蒙层 */
  variant?: 'deploy' | 'defense';
  interactive?: boolean;
  onCellClick?: (row: number, col: number) => void;
}

export function drawRhythmGrid(scene: Phaser.Scene, opts: RhythmGridOptions): void {
  const depth = opts.depth ?? 2;
  const defense = opts.variant === 'defense';
  for (let r = 0; r < opts.gridSize; r++) {
    for (let c = 0; c < opts.gridSize; c++) {
      const x = opts.gridX + c * opts.cellSize + opts.cellSize / 2;
      const y = opts.gridY + r * opts.cellSize + opts.cellSize / 2;
      const core = opts.isCore(r, c);
      const fillColor = core ? RHYTHM_THEME.coreCell : RHYTHM_THEME.gridCell;
      const fillAlpha = defense ? 0 : core ? RHYTHM_THEME.coreCellAlpha : RHYTHM_THEME.gridCellAlpha;
      const rect = scene.add.rectangle(
        x,
        y,
        opts.cellSize - 6,
        opts.cellSize - 6,
        fillColor,
        fillAlpha,
      ).setStrokeStyle(core ? 2 : 1, core ? RHYTHM_THEME.coreStroke : RHYTHM_THEME.gridStroke, defense ? 0.45 : core ? 0.9 : 0.65)
        .setDepth(depth);

      if (opts.interactive) {
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => opts.onCellClick?.(r, c));
      }
    }
  }
}

export interface RhythmCoreOptions {
  onClick?: () => void;
  visual?: {
    faceColor: number;
    ringColor: number;
    strokeColor: number;
    labelColor: string;
  };
}

export function drawRhythmCore(
  scene: Phaser.Scene,
  x: number,
  y: number,
  radius: number,
  label: string,
  options: RhythmCoreOptions = {},
): Phaser.GameObjects.Arc | null {
  const visual = options.visual ?? {
    faceColor: RHYTHM_THEME.coreFace,
    ringColor: RHYTHM_THEME.primary,
    strokeColor: RHYTHM_THEME.coreStroke,
    labelColor: RHYTHM_THEME.textAccent,
  };

  const ring = scene.add.circle(x, y, radius + 6, visual.ringColor, 0.12);
  ring.setStrokeStyle(3, visual.strokeColor, 0.85).setDepth(4);

  scene.add.circle(x, y, radius, visual.faceColor, 0.92)
    .setStrokeStyle(2, visual.strokeColor, 0.5)
    .setDepth(5);

  const eyeY = y - radius * 0.12;
  const eyeX = radius * 0.22;
  scene.add.circle(x - eyeX, eyeY, radius * 0.08, 0x111111, 1).setDepth(6);
  scene.add.circle(x + eyeX, eyeY, radius * 0.08, 0x111111, 1).setDepth(6);

  scene.add.text(x, y - radius - 12, label, {
    fontSize: '12px',
    color: visual.labelColor,
    fontFamily: 'Arial',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(6);

  if (!options.onClick) return null;

  const hitZone = scene.add.circle(x, y, radius + 10, 0xffffff, 0.001);
  hitZone.setDepth(150);
  hitZone.setInteractive({ useHandCursor: true });
  hitZone.on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, event?: Phaser.Types.Input.EventData) => {
    event?.stopPropagation();
    options.onClick?.();
  });
  return hitZone;
}

export function createRhythmProgressBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): { bg: Phaser.GameObjects.Rectangle; fill: Phaser.GameObjects.Rectangle } {
  const bg = scene.add.rectangle(x, y, width, height, RHYTHM_THEME.progressBg).setDepth(280);
  const fill = scene.add.rectangle(x - width / 2, y, width, height, RHYTHM_THEME.progressFill)
    .setOrigin(0, 0.5)
    .setDepth(281);
  return { bg, fill };
}

export function showRhythmToast(
  scene: Phaser.Scene,
  text: string,
  color: number = RHYTHM_THEME.primary,
  duration = 1200,
  y = 52,
): void {
  const toast = scene.add.text(GAME_WIDTH / 2, y, text, {
    fontSize: '14px',
    color: colorHex(color),
    fontFamily: 'Arial',
    fontStyle: 'bold',
    wordWrap: { width: GAME_WIDTH - 48 },
    align: 'center',
    backgroundColor: '#ffffffcc',
    padding: { x: 10, y: 6 },
  }).setOrigin(0.5).setDepth(100);

  scene.tweens.add({
    targets: toast,
    y: y - 8,
    alpha: 0,
    duration,
    onComplete: () => toast.destroy(),
  });
}

function colorHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}
