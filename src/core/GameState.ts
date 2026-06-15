import type { ItemInstance } from '../config/items';
import { getTutorialLevel, type LevelConfig } from '../config/levels';
import type { MetaEffects } from '../config/meta';
import { computeMetaEffects } from '../config/meta';
import { computeMergeUses } from '../config/rhythmBalance';
import { isTutorialLevel, TUTORIAL_MERGE_USES } from '../config/tutorial';
import type { SaveData } from '../save/SaveManager';

export interface PlacedTower {
  row: number;
  col: number;
  item: ItemInstance;
}

export interface RhythmResult {
  score: number;
  maxScore: number;
  accuracy: number;
  laneHits: Record<number, number>;
  judgements: { perfect: number; great: number; good: number; miss: number };
}

export interface RunState {
  level: LevelConfig;
  loot: ItemInstance[];
  rhythmResult: RhythmResult | null;
  placedTowers: PlacedTower[];
  coreHp: number;
  coreMaxHp: number;
  shield: number;
  mergeUsesLeft: number;
  removeUsesLeft: number;
  starsEarned: number;
  victory: boolean;
  defenseGold: number;
  killCount: number;
  wavesCleared: number;
  repairsUsed: number;
}

class GameStateManager {
  save: SaveData | null = null;
  run: RunState | null = null;
  selectedLevelId = 'level_01';
  selectedChapter = 1;
  /** 战斗模拟器模式：跳过存档与结算 */
  simulatorMode = false;
  /** 新手引导关：固定掉落与 Coach 提示 */
  tutorialMode = false;

  get metaEffects(): MetaEffects {
    if (!this.save) return computeMetaEffects({});
    return computeMetaEffects(this.save.metaLevels);
  }

  startTutorialRun(): void {
    this.startRun(getTutorialLevel());
  }

  startRun(level: LevelConfig): void {    this.tutorialMode = isTutorialLevel(level.id);
    const meta = this.metaEffects;
    this.run = {
      level,
      loot: [],
      rhythmResult: null,
      placedTowers: [],
      coreHp: level.coreHp + meta.coreHpBonus,
      coreMaxHp: level.coreHp + meta.coreHpBonus,
      shield: 0,
      mergeUsesLeft: 0,
      removeUsesLeft: 3,
      starsEarned: 0,
      victory: false,
      defenseGold: 0,
      killCount: 0,
      wavesCleared: 0,
      repairsUsed: 0,
    };
  }

  setRhythmResult(result: RhythmResult, loot: ItemInstance[]): void {
    if (!this.run) return;
    this.run.rhythmResult = result;
    this.run.loot = loot;
    this.run.mergeUsesLeft = this.tutorialMode
      ? TUTORIAL_MERGE_USES
      : computeMergeUses(loot.length, this.metaEffects.mergeLimitBonus);
  }

  clearRun(): void {
    this.tutorialMode = false;
    this.run = null;
  }
}

export const gameState = new GameStateManager();
