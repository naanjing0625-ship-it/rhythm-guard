import Phaser from 'phaser';
import { getItemIcon } from '../config/itemIcons';
import { getItemVisualTheme, type ItemFrameShape } from '../config/itemVisuals';
import { getItemDef, type ItemInstance } from '../config/items';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import { applyTextResolution } from '../core/renderUtils';

export interface TowerVisualOptions {
  displaySize?: number;
  showTier?: boolean;
  /** 显示职业边框与角标（默认开启） */
  showProfession?: boolean;
  /** 手牌区：族名显示在图标上方（可读字号） */
  inventoryMode?: boolean;
  depth?: number;
}

function drawProfessionFrame(
  g: Phaser.GameObjects.Graphics,
  shape: ItemFrameShape,
  radius: number,
  frameColor: number,
  fillColor: number,
): void {
  g.fillStyle(fillColor, 0.28);
  g.lineStyle(Math.max(2, Math.round(radius * 0.12)), frameColor, 0.95);

  switch (shape) {
    case 'square': {
      const s = radius * 0.92;
      const corner = radius * 0.16;
      g.fillRoundedRect(-s, -s, s * 2, s * 2, corner);
      g.strokeRoundedRect(-s, -s, s * 2, s * 2, corner);
      break;
    }
    case 'circle':
      g.fillCircle(0, 0, radius);
      g.strokeCircle(0, 0, radius);
      break;
    case 'diamond':
      g.beginPath();
      g.moveTo(0, -radius);
      g.lineTo(radius, 0);
      g.lineTo(0, radius);
      g.lineTo(-radius, 0);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    case 'shield': {
      const w = radius * 0.82;
      const h = radius * 1.05;
      g.beginPath();
      g.moveTo(0, -h);
      g.lineTo(w, -h * 0.35);
      g.lineTo(w * 0.88, h * 0.42);
      g.lineTo(0, h);
      g.lineTo(-w * 0.88, h * 0.42);
      g.lineTo(-w, -h * 0.35);
      g.closePath();
      g.fillPath();
      g.strokePath();
      break;
    }
  }
}

export function createTowerVisual(
  scene: Phaser.Scene,
  x: number,
  y: number,
  item: ItemInstance,
  options: TowerVisualOptions = {},
): Phaser.GameObjects.Container {
  const {
    displaySize = 52,
    showTier = false,
    showProfession = true,
    inventoryMode = false,
    depth = 15,
  } = options;

  const def = getItemDef(item.type, item.tier);
  const theme = getItemVisualTheme(item.type);
  const children: Phaser.GameObjects.GameObject[] = [];
  const radius = displaySize * 0.44;
  const compact = displaySize < 48 || inventoryMode;

  if (showProfession) {
    const frame = scene.add.graphics();
    drawProfessionFrame(frame, theme.frameShape, radius, theme.frameColor, theme.fillColor);
    children.push(frame);

    const badgeSize = Math.max(9, Math.round(displaySize * (compact ? 0.28 : 0.22)));
    children.push(applyTextResolution(scene.add.text(-radius + 2, radius - 2, theme.categoryIcon, {
      fontSize: `${badgeSize}px`,
    }).setOrigin(0, 1)));

    if (inventoryMode) {
      const nameSize = Math.max(10, Math.round(displaySize * 0.22));
      children.push(applyTextResolution(scene.add.text(0, -radius - 3, theme.familyLabel, {
        fontSize: `${nameSize}px`,
        color: `#${theme.frameColor.toString(16).padStart(6, '0')}`,
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0.5, 1)));
    } else {
      const familySize = Math.max(8, Math.round(displaySize * (compact ? 0.16 : 0.17)));
      children.push(applyTextResolution(scene.add.text(0, -radius + 2, theme.familyLabel, {
        fontSize: `${familySize}px`,
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        backgroundColor: `#${theme.frameColor.toString(16).padStart(6, '0')}dd`,
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0)));
    }
  }

  const iconLift = showProfession ? displaySize * (inventoryMode ? 0.02 : 0.04) : 0;
  const iconRatio = inventoryMode ? 0.5 : 0.42;
  const icon = applyTextResolution(scene.add.text(0, iconLift, getItemIcon(item.type, item.tier), {
    fontSize: `${Math.round(displaySize * iconRatio)}px`,
  }).setOrigin(0.5));
  children.push(icon);

  const lvSize = Math.max(9, Math.round(displaySize * (compact ? 0.24 : 0.2)));
  children.push(applyTextResolution(scene.add.text(radius - 1, radius - 1, `lv${item.tier}`, {
    fontSize: `${lvSize}px`,
    color: '#ffffff',
    fontFamily: 'Arial',
    fontStyle: 'bold',
    backgroundColor: '#2a2038cc',
    padding: { x: compact ? 2 : 3, y: 1 },
  }).setOrigin(1, 1)));

  if (showTier) {
    children.push(applyTextResolution(scene.add.text(0, displaySize * 0.22, `T${item.tier}`, {
      fontSize: `${Math.max(10, Math.round(displaySize * 0.22))}px`,
      color: RHYTHM_THEME.textAccent,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5)));
  }

  const container = scene.add.container(Math.round(x), Math.round(y), children);
  container.setSize(displaySize, displaySize);
  container.setDepth(depth);
  container.setData('itemDef', def);
  container.setData('itemTheme', theme);
  return container;
}
