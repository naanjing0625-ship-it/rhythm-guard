import Phaser from 'phaser';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import { getTutorialStep, type TutorialPhase } from '../config/tutorial';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/viewport';
import { createTextButton } from './HUD';

export interface CoachLayout {
  width: number;
  height: number;
  depth?: number;
  /** 挂到指定容器（如节奏竖屏 stageRoot），坐标使用 0…width / 0…height */
  parent?: Phaser.GameObjects.Container;
  /** 弹板出现时（如节奏暂停） */
  onShow?: () => void;
  /** 弹板关闭时（如节奏继续） */
  onHide?: () => void;
}

const DEFAULT_DEPTH = 600;
const LANDSCAPE_PANEL_MAX_W = 540;

export class TutorialCoach {
  private root: Phaser.GameObjects.Container | null = null;
  private shownSteps = new Set<string>();
  private activeHooks: Pick<CoachLayout, 'onHide'> | null = null;

  isVisible(): boolean {
    return this.root !== null;
  }

  hasShown(stepId: string): boolean {
    return this.shownSteps.has(stepId);
  }

  show(
    scene: Phaser.Scene,
    stepId: string,
    onDismiss?: () => void,
    layout?: CoachLayout,
  ): void {
    if (this.shownSteps.has(stepId)) {
      onDismiss?.();
      return;
    }

    const step = getTutorialStep(stepId);
    if (!step) {
      onDismiss?.();
      return;
    }

    this.dismissPanel();
    this.shownSteps.add(stepId);

    const vw = layout?.width ?? GAME_WIDTH;
    const vh = layout?.height ?? GAME_HEIGHT;
    const depth = layout?.depth ?? DEFAULT_DEPTH;
    const cx = vw / 2;
    const isPortrait = vh >= vw;
    const margin = Math.max(14, Math.round((isPortrait ? vw : vh) * 0.04));
    const panelW = isPortrait
      ? vw - margin * 2
      : Math.min(LANDSCAPE_PANEL_MAX_W, vw - margin * 2);
    const titleSize = isPortrait ? 16 : 18;
    const bodySize = isPortrait ? 13 : 14;
    const labelSize = isPortrait ? 13 : 14;
    const padX = Math.max(18, Math.round(panelW * 0.08));
    const innerW = panelW - padX * 2;
    const padY = 14;
    const titleGap = 10;
    const bodyGap = 14;
    const btnH = 44;

    const bodyH = this.measureBodyHeight(scene, step.body, innerW, bodySize, labelSize);
    const titleBlock = titleSize + titleGap;
    const panelH = padY + titleBlock + bodyH + bodyGap + btnH + padY;
    const panelY = vh - panelH / 2 - Math.max(12, Math.round(vh * 0.04));
    const panelTop = panelY - panelH / 2;
    const contentLeft = cx - panelW / 2 + padX;

    this.activeHooks = { onHide: layout?.onHide };
    layout?.onShow?.();

    const root = scene.add.container(0, 0).setDepth(depth);

    const dim = scene.add.rectangle(cx, vh / 2, vw, vh, 0x000000, 0.48);
    root.add(dim);

    const panel = scene.add.rectangle(cx, panelY, panelW, panelH, 0xffffff, 0.98);
    panel.setStrokeStyle(2, RHYTHM_THEME.primary, 0.35);
    root.add(panel);

    const titleY = panelTop + padY + titleSize / 2;
    root.add(scene.add.text(cx, titleY, step.title, {
      fontSize: `${titleSize}px`,
      color: RHYTHM_THEME.textAccent,
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const ruleY = panelTop + padY + titleSize + titleGap / 2;
    root.add(scene.add.rectangle(cx, ruleY, innerW, 1, RHYTHM_THEME.primary, 0.15));

    const bodyY = panelTop + padY + titleBlock;
    this.renderBodyLines(root, scene, contentLeft, bodyY, innerW, step.body, bodySize, labelSize);

    const btnY = panelTop + panelH - padY - btnH / 2;
    const btn = createTextButton(scene, cx, btnY, '知道了', () => {
      this.dismissPanel();
      onDismiss?.();
    }, RHYTHM_THEME.primary, depth + 1);
    root.add(btn);

    if (layout?.parent) {
      layout.parent.add(root);
    }

    this.root = root;
  }

  private measureBodyHeight(
    scene: Phaser.Scene,
    body: string,
    innerW: number,
    bodySize: number,
    labelSize: number,
  ): number {
    let y = 0;
    for (const line of body.split('\n')) {
      if (line.trim() === '') {
        y += 6;
        continue;
      }
      const isLabel = line.endsWith('：') || line.endsWith(':');
      const isBullet = line.startsWith('·');
      const style = this.lineStyle(innerW, isLabel ? labelSize : bodySize, isLabel);
      const text = isBullet ? line.slice(1).trimStart() : line;
      const probe = scene.add.text(0, 0, text, style).setOrigin(0, 0);
      y += probe.height + (isLabel ? 4 : 6);
      probe.destroy();
    }
    return y;
  }

  private lineStyle(
    innerW: number,
    fontSize: number,
    isLabel: boolean,
  ): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize: `${fontSize}px`,
      color: isLabel ? RHYTHM_THEME.textAccent : RHYTHM_THEME.textDark,
      fontFamily: 'Arial',
      fontStyle: isLabel ? 'bold' : 'normal',
      wordWrap: { width: innerW, useAdvancedWrap: true },
      align: 'left',
      lineSpacing: 4,
    };
  }

  private renderBodyLines(
    root: Phaser.GameObjects.Container,
    scene: Phaser.Scene,
    x: number,
    startY: number,
    innerW: number,
    body: string,
    bodySize: number,
    labelSize: number,
  ): void {
    let y = startY;
    const bulletW = 16;

    for (const raw of body.split('\n')) {
      if (raw.trim() === '') {
        y += 6;
        continue;
      }

      const isLabel = raw.endsWith('：') || raw.endsWith(':');
      const isBullet = raw.startsWith('·');
      const text = isBullet ? raw.slice(1).trimStart() : raw;
      const style = this.lineStyle(isBullet ? innerW - bulletW : innerW, isLabel ? labelSize : bodySize, isLabel);
      const textX = isBullet ? x + bulletW : x;

      if (isBullet) {
        root.add(scene.add.text(x, y, '·', {
          fontSize: `${bodySize}px`,
          color: RHYTHM_THEME.textAccent,
          fontFamily: 'Arial',
          fontStyle: 'bold',
        }).setOrigin(0, 0));
      }

      const line = scene.add.text(textX, y, text, style).setOrigin(0, 0);
      root.add(line);
      y += line.height + (isLabel ? 4 : 6);
    }
  }

  /** 按顺序展示多步引导，每步点「知道了」后进入下一步 */
  showSequence(scene: Phaser.Scene, stepIds: string[], layout?: CoachLayout, onComplete?: () => void): void {
    const run = (index: number): void => {
      if (index >= stepIds.length) {
        onComplete?.();
        return;
      }
      const id = stepIds[index];
      if (this.shownSteps.has(id)) {
        run(index + 1);
        return;
      }
      this.show(scene, id, () => run(index + 1), layout);
    };
    run(0);
  }

  showOnce(
    scene: Phaser.Scene,
    stepId: string,
    layout?: CoachLayout,
    onDismiss?: () => void,
  ): void {
    this.show(scene, stepId, onDismiss, layout);
  }

  resetPhase(phase: TutorialPhase): void {
    for (const step of [...this.shownSteps]) {
      const def = getTutorialStep(step);
      if (def?.phase === phase) this.shownSteps.delete(step);
    }
  }

  resetAll(): void {
    this.shownSteps.clear();
  }

  private dismissPanel(): void {
    this.activeHooks?.onHide?.();
    this.activeHooks = null;
    this.root?.destroy(true);
    this.root = null;
  }

  hide(): void {
    this.dismissPanel();
  }

  destroy(): void {
    this.hide();
    this.shownSteps.clear();
  }
}

/** 横屏场景（部署 / 守卫）默认布局 */
export function landscapeCoachLayout(depth = DEFAULT_DEPTH): CoachLayout {
  return { width: GAME_WIDTH, height: GAME_HEIGHT, depth };
}
