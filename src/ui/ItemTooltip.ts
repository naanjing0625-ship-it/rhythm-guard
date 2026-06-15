import Phaser from 'phaser';
import { getItemDef, type ItemDef, type ItemInstance } from '../config/items';
import { getItemVisualTheme, type ItemRoleCategory } from '../config/itemVisuals';

const MODE_LABELS: Record<ItemDef['attackMode'], string> = {  melee: '近战',
  aoe: '范围爆炸',
  chain: '弹射连锁',
  shield: '护盾',
};

const DAMAGE_LABELS: Record<ItemDef['damageType'], string> = {
  physical: '物理',
  magic: '魔法',
  explosive: '爆炸',
  chain: '连锁',
  true: '真实',
};

const CATEGORY_LABELS: Record<ItemRoleCategory, string> = {
  melee: '近战',
  ranged: '远程',
  support: '护堡',
};

const STICKY_TARGET_KEY = 'itemTooltipStickyTarget';
const DISMISS_LISTENER_KEY = 'itemTooltipDismissBound';
export interface ItemTooltipFormatOptions {
  count?: number;
  cellSize?: number;
}

export function formatItemTooltipLines(item: ItemInstance, options: ItemTooltipFormatOptions = {}): string[] {
  const def = getItemDef(item.type, item.tier);
  const theme = getItemVisualTheme(item.type);
  const rangeText = options.cellSize
    ? `${(def.range / options.cellSize).toFixed(1)} 格`
    : `${def.range}`;

  const lines = [
    `${theme.categoryIcon} ${theme.familyLabel} · ${def.name} · lv${item.tier}`,
    `${CATEGORY_LABELS[theme.category]} · ${MODE_LABELS[def.attackMode]} · ${DAMAGE_LABELS[def.damageType]}`,
  ];

  if (def.attackMode === 'shield') {
    lines.push(`战斗开始：节拍核心护盾 +${def.shieldAmount ?? 0}`);
  } else {
    lines.push(`伤害 ${def.damage}  |  攻击范围 ${rangeText}  |  攻速 ${def.attackSpeed.toFixed(2)}/s`);
    if (def.attackMode === 'melee') {
      lines.push('单体最近目标 · 无法攻击飞行单位');
    }
    if (def.slowPercent && def.slowDurationSec) {
      lines.push(`命中减速 ${Math.round(def.slowPercent * 100)}%，持续 ${def.slowDurationSec.toFixed(1)} 秒`);
    }
    if (def.aoeRadius && options.cellSize) {
      lines.push(`溅射范围 ${(def.aoeRadius / options.cellSize).toFixed(1)} 格`);
    } else if (def.aoeRadius) {
      lines.push(`溅射范围 ${def.aoeRadius}`);
    }
    if (def.chainCount) lines.push(`弹射连锁 ${def.chainCount} 次 · 可攻击飞行`);
  }
  if (options.count && options.count > 1) {
    lines.push(`持有数量 ×${options.count}`);
  }

  return lines;
}

export class ItemTooltipView {
  private container: Phaser.GameObjects.Container | null = null;

  isVisible(): boolean {
    return this.container !== null;
  }

  show(scene: Phaser.Scene, x: number, y: number, lines: string[]): void {    this.hide();

    const padX = 10;
    const padY = 8;
    const lineHeight = 18;
    const texts = lines.map((line, i) =>
      scene.add.text(padX, padY + i * lineHeight, line, {
        fontSize: '12px',
        color: '#ffffff',
        fontFamily: 'Arial',
      }),
    );

    const contentW = Math.max(...texts.map((t) => t.width), 120);
    const contentH = lines.length * lineHeight + padY * 2;
    const bg = scene.add
      .rectangle(0, 0, contentW + padX * 2, contentH, 0x2a2038, 0.94)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x7b4fff, 0.9);

    let posX = x;
    let posY = y - contentH / 2;
    const margin = 8;
    const gameW = scene.scale.width;
    const gameH = scene.scale.height;

    if (posX + contentW + padX * 2 > gameW - margin) {
      posX = x - contentW - padX * 2 - 12;
    }
    if (posY < margin) posY = margin;
    if (posY + contentH > gameH - margin) posY = gameH - contentH - margin;

    this.container = scene.add.container(posX, posY, [bg, ...texts]);
    this.container.setDepth(500);
  }

  hide(): void {
    this.container?.destroy();
    this.container = null;
  }
}

export interface AttachItemTooltipOptions extends ItemTooltipFormatOptions {
  isDragActive?: () => boolean;
  getAnchor?: () => { x: number; y: number };
}

function isPointerOverTarget(
  scene: Phaser.Scene,
  pointer: Phaser.Input.Pointer,
  target: Phaser.GameObjects.Container,
): boolean {
  const hits = scene.input.hitTestPointer(pointer) ?? [];
  for (const obj of hits) {
    let node: Phaser.GameObjects.GameObject | null = obj;
    while (node) {
      if (node === target) return true;
      node = (node as Phaser.GameObjects.Container).parentContainer ?? null;
    }
  }
  return false;
}

function bindGlobalDismiss(scene: Phaser.Scene, tooltip: ItemTooltipView): void {
  if (scene.data.get(DISMISS_LISTENER_KEY)) return;
  scene.data.set(DISMISS_LISTENER_KEY, true);
  const handler = (pointer: Phaser.Input.Pointer) => {
    const sticky = scene.data.get(STICKY_TARGET_KEY) as Phaser.GameObjects.Container | null;
    if (!sticky || !tooltip.isVisible()) return;
    if (!isPointerOverTarget(scene, pointer, sticky)) {
      scene.data.set(STICKY_TARGET_KEY, null);
      tooltip.hide();
    }
  };
  scene.input.on('pointerdown', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointerdown', handler);
    scene.data.set(DISMISS_LISTENER_KEY, false);
    scene.data.set(STICKY_TARGET_KEY, null);
  });
}

function clearSticky(scene: Phaser.Scene, tooltip: ItemTooltipView, target?: Phaser.GameObjects.Container): void {
  const sticky = scene.data.get(STICKY_TARGET_KEY) as Phaser.GameObjects.Container | null;
  if (sticky && (!target || sticky === target)) {
    scene.data.set(STICKY_TARGET_KEY, null);
  }
  tooltip.hide();
}

export function attachItemTooltip(
  scene: Phaser.Scene,
  tooltip: ItemTooltipView,
  target: Phaser.GameObjects.Container,
  getItem: () => ItemInstance,
  options: AttachItemTooltipOptions = {},
): void {
  bindGlobalDismiss(scene, tooltip);

  let hoverTimer: Phaser.Time.TimerEvent | null = null;
  let didDrag = false;
  let hoverShowing = false;

  const anchor = () => {
    if (options.getAnchor) return options.getAnchor();
    return { x: target.x, y: target.y };
  };

  const show = () => {
    if (options.isDragActive?.()) return;
    const { x, y } = anchor();
    const lines = formatItemTooltipLines(getItem(), {
      count: options.count,
      cellSize: options.cellSize,
    });
    tooltip.show(scene, x + 30, y, lines);
  };

  const isSticky = () => scene.data.get(STICKY_TARGET_KEY) === target;

  const clearHoverTimer = () => {
    hoverTimer?.remove();
    hoverTimer = null;
  };

  const hideHover = () => {
    clearHoverTimer();
    if (!isSticky() && hoverShowing) {
      hoverShowing = false;
      tooltip.hide();
    }
  };

  target.on('pointerover', () => {
    if (options.isDragActive?.() || isSticky()) return;
    clearHoverTimer();
    hoverTimer = scene.time.delayedCall(200, () => {
      hoverShowing = true;
      show();
    });
  });

  target.on('pointerout', hideHover);

  target.on('pointerdown', () => {
    didDrag = false;
    clearHoverTimer();
  });

  target.on('dragstart', () => {
    didDrag = true;
    hoverShowing = false;
    clearHoverTimer();
    clearSticky(scene, tooltip, target);
  });

  target.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (options.isDragActive?.() || didDrag) return;
    if (pointer.distance > 12) return;

    if (isSticky()) {
      scene.data.set(STICKY_TARGET_KEY, null);
      tooltip.hide();
      return;
    }

    scene.data.set(STICKY_TARGET_KEY, target);
    hoverShowing = false;
    show();
  });

  target.once('destroy', () => {
    hideHover();
    if (isSticky()) clearSticky(scene, tooltip, target);
  });
}