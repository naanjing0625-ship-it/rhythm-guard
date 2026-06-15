import { LEVELS } from '../config/levels';
import { META_UPGRADES } from '../config/meta';
import type { AccuracyGrade } from '../config/rhythmBalance';
import { isGradeBetter, normalizeAccuracyGrade } from '../config/rhythmBalance';

export interface SaveData {
  unlockedLevels: string[];
  levelStars: Record<string, number>;
  levelRhythmGrades: Record<string, AccuracyGrade>;
  totalStars: number;
  metaLevels: Record<string, number>;
  tutorialCompleted: boolean;
  settings: {
    audioOffset: number;
    volume: number;
  };
}

const DB_NAME = 'rhythm-guard-save';
const STORE_NAME = 'save';
const SAVE_KEY = 'main';

const DEFAULT_SAVE: SaveData = {
  unlockedLevels: ['level_01'],
  levelStars: {},
  levelRhythmGrades: {},
  totalStars: 0,
  metaLevels: {},
  tutorialCompleted: false,
  settings: { audioOffset: 0, volume: 0.8 },
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class SaveManager {
  private data: SaveData = { ...DEFAULT_SAVE };

  async load(): Promise<SaveData> {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const result = await new Promise<SaveData | undefined>((resolve, reject) => {
        const req = store.get(SAVE_KEY);
        req.onsuccess = () => resolve(req.result as SaveData | undefined);
        req.onerror = () => reject(req.error);
      });
      db.close();
      if (result) {
        const levelRhythmGrades: Record<string, AccuracyGrade> = {};
        for (const [levelId, raw] of Object.entries(result.levelRhythmGrades ?? {})) {
          const grade = normalizeAccuracyGrade(raw as string);
          if (grade) levelRhythmGrades[levelId] = grade;
        }
        this.data = {
          ...DEFAULT_SAVE,
          ...result,
          levelRhythmGrades,
          tutorialCompleted: result.tutorialCompleted ?? false,
          settings: { ...DEFAULT_SAVE.settings, ...result.settings },
        };
        this.syncUnlockedLevels();
      }
    } catch {
      this.data = { ...DEFAULT_SAVE };
    }
    return this.data;
  }

  async save(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(this.data, SAVE_KEY);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  getData(): SaveData {
    return this.data;
  }

  /** 各关星级之和（累计获得，不受 Meta 消耗影响） */
  getEarnedStars(): number {
    return Object.values(this.data.levelStars).reduce((sum, n) => sum + n, 0);
  }

  isLevelUnlocked(levelId: string): boolean {
    return this.data.unlockedLevels.includes(levelId);
  }

  canUnlockLevel(levelId: string): boolean {
    const level = LEVELS.find((l) => l.id === levelId);
    if (!level || !level.starsRequired) return true;
    return this.getEarnedStars() >= level.starsRequired;
  }

  /** 按通关进度与累计星级补全应解锁关卡（含 Meta 消费后 retroactive 解锁） */
  private syncUnlockedLevels(): void {
    if (!this.data.unlockedLevels.includes('level_01')) {
      this.data.unlockedLevels.push('level_01');
    }
    for (let i = 1; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      if (this.data.unlockedLevels.includes(level.id)) continue;
      const prev = LEVELS[i - 1];
      const prevBeaten = (this.data.levelStars[prev.id] ?? 0) > 0;
      if (prevBeaten && this.canUnlockLevel(level.id)) {
        this.data.unlockedLevels.push(level.id);
      }
    }
  }

  recordVictory(levelId: string, stars: number, rhythmGrade?: AccuracyGrade): void {
    const prev = this.data.levelStars[levelId] ?? 0;
    if (stars > prev) {
      this.data.totalStars += stars - prev;
      this.data.levelStars[levelId] = stars;
    }
    if (rhythmGrade) {
      const prevGrade = this.data.levelRhythmGrades[levelId];
      if (!prevGrade || isGradeBetter(rhythmGrade, prevGrade)) {
        this.data.levelRhythmGrades[levelId] = rhythmGrade;
      }
    }
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    if (idx >= 0 && idx < LEVELS.length - 1) {
      this.syncUnlockedLevels();
    }
  }

  completeTutorial(): void {
    this.data.tutorialCompleted = true;
    if (!this.data.unlockedLevels.includes('level_01')) {
      this.data.unlockedLevels.push('level_01');
    }
  }

  isTutorialCompleted(): boolean {
    return this.data.tutorialCompleted;
  }

  purchaseMeta(upgradeId: string): boolean {
    const upgrade = META_UPGRADES.find((u) => u.id === upgradeId);
    if (!upgrade) return false;
    const current = this.data.metaLevels[upgradeId] ?? 0;
    if (current >= upgrade.maxLevel) return false;
    const cost = upgrade.costPerLevel;
    if (this.data.totalStars < cost) return false;
    this.data.totalStars -= cost;
    this.data.metaLevels[upgradeId] = current + 1;
    return true;
  }
}

export const saveManager = new SaveManager();
