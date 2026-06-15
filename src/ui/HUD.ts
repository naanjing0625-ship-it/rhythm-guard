import Phaser from 'phaser';
import { RHYTHM_THEME } from '../config/rhythmTheme';

/** 全局 UI 按钮层级，确保始终在棋盘/怪物/特效之上 */
export const UI_BUTTON_DEPTH = 300;

function getButtonBg(container: Phaser.GameObjects.Container): Phaser.GameObjects.Rectangle {
  return container.list[0] as Phaser.GameObjects.Rectangle;
}

function getButtonText(container: Phaser.GameObjects.Container): Phaser.GameObjects.Text {
  return container.list[1] as Phaser.GameObjects.Text;
}

function applyButtonVisual(
  container: Phaser.GameObjects.Container,
  color: number,
  highlighted: boolean,
  hovered = false,
): void {
  const bg = getButtonBg(container);
  const text = getButtonText(container);
  container.setAlpha(1);

  if (highlighted) {
    const fillAlpha = hovered ? 1 : 0.95;
    bg.setFillStyle(color, fillAlpha);
    bg.setStrokeStyle(2, 0xffffff, hovered ? 0.65 : 0.45);
    text.setColor('#ffffff');
  } else {
    const fillAlpha = hovered ? 0.72 : 0.58;
    bg.setFillStyle(color, fillAlpha);
    bg.setStrokeStyle(2, RHYTHM_THEME.primary, hovered ? 0.35 : 0.22);
    text.setColor(RHYTHM_THEME.textDark);
  }
}

/** 高亮 = 可交互推荐态；暗淡 = 仍可点击但条件不满足 */
export function setTextButtonHighlighted(
  container: Phaser.GameObjects.Container,
  highlighted: boolean,
  color?: number,
): void {
  const btnColor = color ?? (container.getData('btnColor') as number) ?? RHYTHM_THEME.primary;
  container.setData('btnColor', btnColor);
  container.setData('btnHighlighted', highlighted);
  const hitZone = container.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
  if (hitZone) {
    hitZone.setData('btnColor', btnColor);
    hitZone.setData('btnHighlighted', highlighted);
  }
  applyButtonVisual(container, btnColor, highlighted, false);
}

export interface TextButtonStyle {
  fontSize?: number;
  height?: number;
  charWidth?: number;
  paddingX?: number;
}

export function createTextButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  color = 0x7b4fff,
  depth = UI_BUTTON_DEPTH,
  style?: TextButtonStyle,
): Phaser.GameObjects.Container {
  const fontSize = style?.fontSize ?? 18;
  const h = style?.height ?? 44;
  const charW = style?.charWidth ?? 14;
  const padX = style?.paddingX ?? 40;
  const w = label.length * charW + padX;
  const bg = scene.add.rectangle(0, 0, w, h, color, 0.9).setStrokeStyle(2, 0xffffff, 0.3);
  const text = scene.add.text(0, 0, label, {
    fontSize: `${fontSize}px`, color: '#ffffff', fontFamily: 'Arial',
  }).setOrigin(0.5);
  const hitZone = scene.add.zone(0, 0, w, h);
  hitZone.setInteractive({ useHandCursor: true });
  const container = scene.add.container(x, y, [bg, text, hitZone]);
  container.setDepth(depth);
  container.setData('btnColor', color);
  container.setData('btnHighlighted', true);
  hitZone.setData('btnColor', color);
  hitZone.setData('btnHighlighted', true);
  container.setData('hitZone', hitZone);

  const syncHover = (hovered: boolean) => {
    const highlighted = hitZone.getData('btnHighlighted') !== false;
    const btnColor = hitZone.getData('btnColor') as number;
    applyButtonVisual(container, btnColor, highlighted, hovered);
  };

  const fire = (
    _pointer: Phaser.Input.Pointer,
    _localX: number,
    _localY: number,
    event?: Phaser.Types.Input.EventData,
  ) => {
    event?.stopPropagation();
    onClick();
  };

  hitZone.on('pointerdown', fire);
  hitZone.on('pointerover', () => syncHover(true));
  hitZone.on('pointerout', () => syncHover(false));

  applyButtonVisual(container, color, true, false);
  return container;
}

export function createPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, alpha = 0.72): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(x, y, w, h, RHYTHM_THEME.gridCell, alpha)
    .setStrokeStyle(2, RHYTHM_THEME.primary, 0.35)
    .setOrigin(0);
}
