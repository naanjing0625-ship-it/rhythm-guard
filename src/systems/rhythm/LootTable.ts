import { createItemInstance, type ItemInstance, type ItemType } from '../../config/items';
import { type NoteColor } from '../../config/rhythm';
import {
  getAccuracyTier,
  itemCountForGrade,
  type AccuracyTier,
} from '../../config/rhythmBalance';
import type { JudgementType } from './Judgement';
import {
  analyzeLevelThreat,
  applyThreatToTypeWeights,
  rebalanceLootForThreat,
  type LevelThreatProfile,
} from './LevelLootProfile';

export interface LootContext {
  accuracy: number;
  typeHits: Record<NoteColor, number>;
  lootBonus: number;
  judgements: Record<JudgementType, number>;
  /** 当前关卡 id，用于按敌人构成调整掉落 */
  levelId?: string;
}

export interface LootSummary {
  items: ItemInstance[];
  grade: AccuracyTier['grade'];
  totalCount: number;
}

const ALL_TYPES: ItemType[] = ['kick', 'snare', 'hihat', 'crash'];
const NOTE_COLORS: NoteColor[] = ['yellow', 'blue', 'red'];

/** 低阶为主：T1/T2 占绝大多数，T3/T4 仅少量奖励 */
function weightedTierPick(score: number, bias = 0): number {
  const s = Math.min(1, Math.max(0, score));
  const weights = [
    Math.max(0.28, 0.74 - s * 0.24 - bias * 0.04),
    Math.max(0.22, 0.22 + s * 0.06 + bias * 0.02),
    Math.max(0.03, 0.03 + s * 0.06 + bias * 0.03),
    Math.max(0.01, s * 0.03 + bias * 0.02),
  ];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}

/** 按击打偏好在四系间分配；至少保证四种道具都会出现（数量≥4 时各 1 个起） */
function pickTypes(
  count: number,
  typeHits: Record<NoteColor, number>,
  threat?: LevelThreatProfile,
): ItemType[] {
  if (count <= 0) return [];

  const hitTotal = NOTE_COLORS.reduce((s, c) => s + typeHits[c], 0);
  const slots: Record<ItemType, number> = { kick: 0, snare: 0, hihat: 0, crash: 0 };

  if (count < ALL_TYPES.length) {
    const priority = threat && threat.flyingUnits > 0
      ? (['snare', 'hihat', 'kick', 'crash'] as ItemType[])
      : ALL_TYPES;
    for (let i = 0; i < count; i++) slots[priority[i]]++;
    return rebalanceLootForThreat(expandSlots(slots), threat ?? emptyThreat());
  }

  for (const type of ALL_TYPES) slots[type] = 1;
  let remain = count - ALL_TYPES.length;

  let weights: Record<ItemType, number> = hitTotal > 0
    ? {
        kick: Math.max(0.25, typeHits.yellow),
        snare: Math.max(0.25, typeHits.blue),
        hihat: Math.max(0.25, typeHits.red),
        crash: Math.max(0.25, (typeHits.yellow + typeHits.blue + typeHits.red) / 3),
      }
    : { kick: 1, snare: 1, hihat: 1, crash: 1 };

  if (threat) weights = applyThreatToTypeWeights(weights, threat);

  const weightTotal = ALL_TYPES.reduce((s, t) => s + weights[t], 0);
  let assigned = 0;
  for (const type of ALL_TYPES) {
    const n = Math.floor(remain * weights[type] / weightTotal);
    slots[type] += n;
    assigned += n;
  }

  const byWeight = [...ALL_TYPES].sort((a, b) => weights[b] - weights[a]);
  let wi = 0;
  while (assigned < remain) {
    slots[byWeight[wi % byWeight.length]]++;
    assigned++;
    wi++;
  }

  return rebalanceLootForThreat(expandSlots(slots), threat ?? emptyThreat());
}

function emptyThreat(): LevelThreatProfile {
  return {
    levelId: '',
    totalUnits: 0,
    flyingUnits: 0,
    armoredUnits: 0,
    healerUnits: 0,
    bossUnits: 0,
    flyingRatio: 0,
  };
}

function expandSlots(slots: Record<ItemType, number>): ItemType[] {
  const types: ItemType[] = [];
  for (const type of ALL_TYPES) {
    for (let i = 0; i < slots[type]; i++) types.push(type);
  }
  return types;
}

/** 仅按准确度评级发放道具，数量见 ACCURACY_TIERS */
export function generateLoot(ctx: LootContext): LootSummary {
  const tierInfo = getAccuracyTier(ctx.accuracy);
  const score = Math.min(1, Math.max(0, ctx.accuracy + ctx.lootBonus));
  const totalCount = itemCountForGrade(ctx.accuracy, ctx.lootBonus, ctx.levelId);
  const threat = ctx.levelId ? analyzeLevelThreat(ctx.levelId) : undefined;
  const itemTypes = pickTypes(totalCount, ctx.typeHits, threat);

  const items = itemTypes.map((type) =>
    createItemInstance(type, weightedTierPick(score, tierInfo.tierBias)),
  );

  return {
    items,
    grade: tierInfo.grade,
    totalCount,
  };
}
