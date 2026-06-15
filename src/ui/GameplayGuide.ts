import Phaser from 'phaser';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/viewport';
import { createTextButton, UI_BUTTON_DEPTH } from './HUD';

interface GuideSection {
  title: string;
  lines: string[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: '一局流程',
    lines: [
      '① 节奏 — 跟随音乐判定，按准确度获得道具',
      '② 部署 — 放置手牌并合成升阶',
      '③ 守卫 — 道具自动攻击怪物，守护节拍核心',
    ],
  },
  {
    title: '节奏判定',
    lines: [
      '🟡 黄圈：缩圈与中心重合时点击（Perfect）',
      '🔵 蓝圈：缩圈到达时长按约 3 秒',
      '🔴 红圈：1.25 秒内连击 6 次 Perfect 或 4 次 Good',
    ],
  },
  {
    title: '四轨道具',
    lines: [
      '🥁 节拍拳 — 近战单体，无法打飞行',
      '🪘 毒囊炮 — 范围溅射，克制护甲',
      '🎵 弧光术 — 弹射连锁，可打飞行',
      '✨ 凝霜律 — 近战减速，无法打飞行',
    ],
  },
  {
    title: '部署与合成',
    lines: [
      '· 拖拽或点击选中后放到棋盘（核心格不可放）',
      '· 同类型同阶相邻可合成，每局合成次数有限',
      '· 关卡敌人会影响掉落（飞行关多给对空道具）',
    ],
  },
  {
    title: '守卫目标',
    lines: [
      '· 守住节拍核心 HP，清空波次即胜利',
      '· 飞行怪用毒囊炮 / 弧光术；护甲怪怕溅射',
      '· 祝福牧师会治疗，需优先击杀',
    ],
  },
];

export class GameplayGuideOverlay {
  private parts: Phaser.GameObjects.GameObject[] = [];

  show(scene: Phaser.Scene): void {
    this.hide();

    const depth = UI_BUTTON_DEPTH + 10;
    const marginX = 48;
    const marginY = 24;
    const panelW = GAME_WIDTH - marginX * 2;
    const panelH = GAME_HEIGHT - marginY * 2;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const top = cy - panelH / 2;
    const contentW = Math.min(520, panelW - 64);
    const contentX = cx - contentW / 2;
    const titleH = 48;
    const footerH = 54;
    const bodyTop = top + titleH + 4;
    const bodyH = panelH - titleH - footerH - 8;

    const dim = scene.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.58).setDepth(depth);
    dim.setInteractive();
    this.parts.push(dim);

    const panel = scene.add.rectangle(cx, cy, panelW, panelH, RHYTHM_THEME.bg, 0.98)
      .setStrokeStyle(2, RHYTHM_THEME.primary, 0.45)
      .setDepth(depth + 1);
    this.parts.push(panel);

    const title = scene.add.text(cx, top + 28, '📖 玩法说明', {
      fontSize: '24px',
      color: RHYTHM_THEME.textAccent,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 2);
    this.parts.push(title);

    const titleRule = scene.add.rectangle(cx, top + titleH, contentW, 1, RHYTHM_THEME.primary, 0.18)
      .setDepth(depth + 2);
    this.parts.push(titleRule);

    const maskGfx = scene.make.graphics({ x: 0, y: 0 });
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(contentX, bodyTop, contentW, bodyH);
    const bodyMask = maskGfx.createGeometryMask();
    this.parts.push(maskGfx);

    let y = bodyTop + 6;
    const sectionGap = 10;
    const lineGap = 3;
    const titleSize = 15;
    const bodySize = 14;
    const titleLineH = titleSize + 8;

    for (const section of GUIDE_SECTIONS) {
      const header = scene.add.text(contentX + 14, y + 6, section.title, {
        fontSize: `${titleSize}px`,
        color: RHYTHM_THEME.textAccent,
        fontFamily: 'Arial',
        fontStyle: 'bold',
      }).setOrigin(0, 0).setDepth(depth + 3);

      const bodyText = scene.add.text(contentX + 14, y + titleLineH, section.lines.join('\n'), {
        fontSize: `${bodySize}px`,
        color: RHYTHM_THEME.textDark,
        fontFamily: 'Arial',
        wordWrap: { width: contentW - 28 },
        lineSpacing: lineGap,
      }).setOrigin(0, 0).setDepth(depth + 3);

      const sectionH = titleLineH + bodyText.height + 12;
      const card = scene.add.rectangle(
        cx,
        y + sectionH / 2,
        contentW,
        sectionH,
        RHYTHM_THEME.gridCell,
        0.55,
      ).setStrokeStyle(1, RHYTHM_THEME.primary, 0.12).setDepth(depth + 2);

      header.setMask(bodyMask);
      bodyText.setMask(bodyMask);
      card.setMask(bodyMask);
      this.parts.push(card, header, bodyText);

      y += sectionH + sectionGap;
    }

    const closeBtn = createTextButton(
      scene,
      cx,
      top + panelH - footerH / 2,
      '关闭',
      () => this.hide(),
      RHYTHM_THEME.primary,
      depth + 4,
    );
    this.parts.push(closeBtn);

    dim.on('pointerdown', () => this.hide());
  }

  hide(): void {
    for (const part of this.parts) {
      if (part instanceof Phaser.GameObjects.Container) {
        const hitZone = part.getData('hitZone') as Phaser.GameObjects.Zone | undefined;
        hitZone?.destroy();
      }
      part.destroy();
    }
    this.parts = [];
  }
}
