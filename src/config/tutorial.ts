import { createItemInstance, type ItemInstance } from './items';
import type { NoteColor } from './rhythm';

export const TUTORIAL_LEVEL_ID = 'level_tutorial';

/** 引导关节奏出圈顺序：黄红蓝 → 黄蓝红（仅引导关使用） */
export const TUTORIAL_PIPELINE_COLORS: NoteColor[] = [
  'yellow', 'red', 'blue', 'yellow', 'blue', 'red',
];

/** 每段黄圈连发数量（引导关固定，正式关仍随机） */
export const TUTORIAL_YELLOW_BURST_COUNT = 3;

/** 引导关固定配色步进器（走完 黄红蓝→黄蓝红 后循环） */
export class TutorialColorPlanner {
  private nextIndex = 0;

  reset(): void {
    this.nextIndex = 0;
  }

  private loopIfNeeded(): void {
    if (this.nextIndex >= TUTORIAL_PIPELINE_COLORS.length) {
      this.nextIndex = 0;
    }
  }

  atYellowSegment(): boolean {
    this.loopIfNeeded();
    return TUTORIAL_PIPELINE_COLORS[this.nextIndex] === 'yellow';
  }

  consumeYellowSegment(): void {
    if (this.atYellowSegment()) this.nextIndex++;
  }

  takeNextExclusive(): NoteColor | null {
    this.loopIfNeeded();
    const type = TUTORIAL_PIPELINE_COLORS[this.nextIndex];
    if (type === 'yellow') return null;
    this.nextIndex++;
    this.loopIfNeeded();
    return type;
  }
}
export type TutorialPhase = 'rhythm' | 'deploy' | 'defense';

export interface TutorialStepDef {
  id: string;
  phase: TutorialPhase;
  title: string;
  body: string;
}

export const TUTORIAL_STEPS: TutorialStepDef[] = [
  {
    id: 'rhythm_welcome',
    phase: 'rhythm',
    title: '① 节奏阶段',
    body: '玩法与正式关相同：\n· 黄圈可连发点击\n· 红 / 蓝为独占窗口\n\n点「知道了」后播放 BGM 并出圈。\n点击屏幕或按空格操作。',
  },
  {
    id: 'rhythm_perfect',
    phase: 'rhythm',
    title: '打得很准！',
    body: '继续处理黄圈。\n每次判定成功都会计入得分与掉落。',
  },
  {
    id: 'rhythm_blue',
    phase: 'rhythm',
    title: '🔵 蓝圈长按',
    body: '蓝圈到中心后，按住约 3 秒。\n进度环走满再松开，提前松手会 Miss。',
  },
  {
    id: 'rhythm_red',
    phase: 'rhythm',
    title: '🔴 红圈连击',
    body: '红圈到中心后，1.25 秒内快速连击。\nPerfect 需 6 次，Good 需 4 次。\n自己估算好时间哦',
  },
  {
    id: 'deploy_welcome',
    phase: 'deploy',
    title: '② 部署阶段',
    body: '界面说明：\n· 左侧 — 已获得的手牌道具\n· 右侧 — 6×6 放置棋盘\n· 中央 — 核心格（不可放置）',
  },
  {
    id: 'deploy_drag',
    phase: 'deploy',
    title: '放置道具',
    body: '两种放置方式：\n· 拖拽道具到棋盘空格\n· 先点击道具选中，再点空格',
  },
  {
    id: 'deploy_core',
    phase: 'deploy',
    title: '关于核心格',
    body: '防守提示：\n· 怪物会朝核心移动\n· 外圈布阵，别让怪靠近核心',
  },
  {
    id: 'deploy_placed',
    phase: 'deploy',
    title: '部署成功',
    body: '继续铺满外圈，覆盖多个方向。\n\n四系道具：\n· 🥁 节拍拳 — 近战\n· 🪘 毒囊炮 — 溅射\n· 🎵 弧光术 — 弹射\n· ✨ 凝霜律 — 减速',
  },
  {
    id: 'deploy_merge',
    phase: 'deploy',
    title: '合成升阶',
    body: '合成规则：\n· 同类型、同阶叠在同一格\n· 试试把两个 🥁 节拍拳拖到一起',
  },
  {
    id: 'deploy_merge_done',
    phase: 'deploy',
    title: '合成完成',
    body: '升阶后伤害更高。\n\n本关有 2 次合成机会，\n请继续铺满外圈。',
  },
  {
    id: 'deploy_start',
    phase: 'deploy',
    title: '准备战斗',
    body: '开始条件：\n· 至少放置 3 个道具\n· 尽量多铺外圈、合成升阶\n· 点击底部「进入律动守卫」',
  },
  {
    id: 'defense_welcome',
    phase: 'defense',
    title: '③ 守卫阶段',
    body: '守卫说明：\n· 塔会自动攻击来犯怪物\n· 怪物碰核心会扣 HP\n· 右下角可用音律币修复核心',
  },
  {
    id: 'defense_repair',
    phase: 'defense',
    title: '🔧 修复核心',
    body: '核心受损了！\n\n使用方式：\n· 点击右下角「修复」按钮\n· 消耗音律币恢复核心 HP\n· 本关修复 1 次即可回满',
  },
  {
    id: 'defense_win',
    phase: 'defense',
    title: '守卫成功！',
    body: '你已学会节奏、部署与守卫的基本玩法。\n开始正式冒险吧！',
  },
];

/** 部署阶段首次进入时的连贯引导 */
export const DEPLOY_INTRO_SEQUENCE = [
  'deploy_welcome',
  'deploy_drag',
  'deploy_core',
] as const;

export const TUTORIAL_MIN_TOWERS = 3;
export const TUTORIAL_MERGE_USES = 2;

/** 引导关守卫：修复一次回满核心 HP（仅教学演示） */
export const TUTORIAL_REPAIR_FULL_HEAL = true;

export function isTutorialLevel(levelId: string): boolean {
  return levelId === TUTORIAL_LEVEL_ID;
}

/** 引导关固定掉落：多给手牌便于铺场 + 演示 2 次合成 */
export function getTutorialFixedLoot(): ItemInstance[] {
  return [
    createItemInstance('kick', 1),
    createItemInstance('kick', 1),
    createItemInstance('kick', 1),
    createItemInstance('kick', 1),
    createItemInstance('snare', 1),
    createItemInstance('snare', 1),
    createItemInstance('hihat', 1),
    createItemInstance('hihat', 1),
    createItemInstance('crash', 1),
    createItemInstance('crash', 1),
  ];
}

export function getTutorialStep(id: string): TutorialStepDef | undefined {
  return TUTORIAL_STEPS.find((s) => s.id === id);
}
