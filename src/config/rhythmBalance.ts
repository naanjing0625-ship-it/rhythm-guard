/**
 * 音乐 + 合成 核心数值
 *
 * 道具仅按准确度评级一次性发放（不再按每次击打累加）。
 * 6×6 棋盘可部署约 32 格；多给低阶、少给高阶，鼓励部署阶段自行合成升阶。
 */

export type AccuracyGrade = 'B' | 'A' | 'S' | 'SS' | 'SSS';

export interface AccuracyTier {
  grade: AccuracyGrade;
  minAccuracy: number;
  /** 本局发放道具总数 */
  itemCount: number;
  /** Tier 权重偏移（仅微调，高阶仍主要靠合成） */
  tierBias: number;
  label: string;
}

export const LEVEL_RHYTHM_CONFIG: Record<string, { duration: number; bpm: number; waves: number }> = {
  level_01: { duration: 60, bpm: 120, waves: 4 },
  level_02: { duration: 65, bpm: 120, waves: 4 },
  level_03: { duration: 70, bpm: 120, waves: 5 },
  level_04: { duration: 75, bpm: 120, waves: 5 },
  level_05: { duration: 80, bpm: 120, waves: 6 },
  level_06: { duration: 85, bpm: 125, waves: 6 },
  level_07: { duration: 95, bpm: 125, waves: 7 },
  level_08: { duration: 105, bpm: 130, waves: 7 },
};

export const DEFAULT_RHYTHM_DURATION = 60;

/** 单局道具上限（含 Meta 加成后也不超过） */
export const MAX_ITEMS_PER_RUN = 21;

/** 每关按评级发放道具数（后期关卡 S~SSS 略多，B 略少） */
export const LEVEL_LOOT_BY_GRADE: Record<string, Record<AccuracyGrade, number>> = {
  level_01: { B: 9, A: 11, S: 13, SS: 15, SSS: 17 },
  level_02: { B: 9, A: 11, S: 14, SS: 16, SSS: 18 },
  level_03: { B: 8, A: 11, S: 14, SS: 16, SSS: 19 },
  level_04: { B: 8, A: 10, S: 14, SS: 17, SSS: 19 },
  level_05: { B: 8, A: 10, S: 15, SS: 17, SSS: 20 },
  level_06: { B: 7, A: 10, S: 15, SS: 18, SSS: 20 },
  level_07: { B: 7, A: 9, S: 15, SS: 18, SSS: 21 },
  level_08: { B: 7, A: 10, S: 17, SS: 20, SSS: 21 },
};

/** 每关核心修复次数上限 */
export const LEVEL_REPAIR_LIMITS: Record<string, number> = {
  level_tutorial: 1,
  level_01: 1,
  level_02: 1,
  level_03: 1,
  level_04: 2,
  level_05: 2,
  level_06: 2,
  level_07: 3,
  level_08: 4,
};

export function getLevelRepairLimit(levelId: string): number {
  return LEVEL_REPAIR_LIMITS[levelId] ?? 2;
}

export const ACCURACY_TIERS: AccuracyTier[] = [
  { grade: 'SSS', minAccuracy: 0.98, itemCount: 20, tierBias: 1, label: '极致' },
  { grade: 'SS', minAccuracy: 0.93, itemCount: 17, tierBias: 1, label: '极准' },
  { grade: 'S', minAccuracy: 0.88, itemCount: 14, tierBias: 0, label: '精准' },
  { grade: 'A', minAccuracy: 0.75, itemCount: 11, tierBias: 0, label: '稳健' },
  { grade: 'B', minAccuracy: 0, itemCount: 8, tierBias: 0, label: '入门' },
];

export function getAccuracyTier(accuracy: number): AccuracyTier {
  for (const tier of ACCURACY_TIERS) {
    if (accuracy >= tier.minAccuracy) return tier;
  }
  return ACCURACY_TIERS[ACCURACY_TIERS.length - 1];
}

const GRADE_RANK: Record<AccuracyGrade, number> = { B: 0, A: 1, S: 2, SS: 3, SSS: 4 };

export function isGradeBetter(next: AccuracyGrade, prev: AccuracyGrade): boolean {
  return GRADE_RANK[next] > GRADE_RANK[prev];
}

export const GRADE_COLORS: Record<AccuracyGrade, string> = {
  B: '#27ae60',
  A: '#3498db',
  S: '#7b4fff',
  SS: '#ffd700',
  SSS: '#fff8b0',
};

const VALID_GRADES = new Set<string>(Object.keys(GRADE_RANK));

/** 兼容旧存档 C/D 评级，映射为 B */
export function normalizeAccuracyGrade(raw: string | undefined): AccuracyGrade | undefined {
  if (!raw) return undefined;
  if (raw === 'C' || raw === 'D') return 'B';
  if (VALID_GRADES.has(raw)) return raw as AccuracyGrade;
  return undefined;
}

/** 根据评级计算本局道具数（Meta 战利品加成最多 +1） */
export function itemCountForGrade(accuracy: number, lootBonus = 0, levelId?: string): number {
  const tier = getAccuracyTier(accuracy);
  const metaExtra = lootBonus >= 0.5 ? 1 : 0;
  const levelTable = levelId ? LEVEL_LOOT_BY_GRADE[levelId] : undefined;
  const baseCount = levelTable?.[tier.grade] ?? tier.itemCount;
  return Math.min(MAX_ITEMS_PER_RUN, baseCount + metaExtra);
}

/** 合成次数：约每 2 个道具 1 次合成 */
export function computeMergeUses(itemCount: number, metaMergeBonus = 0): number {
  const base = Math.floor(itemCount / 2) + 1;
  return Math.min(10, Math.max(3, base + metaMergeBonus));
}

export function getLevelRhythmConfig(levelId: string): { duration: number; bpm: number; waves: number } {
  return LEVEL_RHYTHM_CONFIG[levelId] ?? { duration: DEFAULT_RHYTHM_DURATION, bpm: 120, waves: 4 };
}
