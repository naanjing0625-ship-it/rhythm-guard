import type { NoteColor } from '../../config/rhythm';
import { NOTE_COLOR_WEIGHTS } from './RandomChart';

/** 60 秒阶段内红/蓝出现上限 */
export const PHASE_BLUE_CAP = 2;
export const PHASE_RED_CAP = 3;

/** 出现一次后，下次权重衰减系数（越大越容易连续出现） */
const REPEAT_PENALTY = 0.42;

export class SpawnColorBudget {
  private readonly maxBlue: number;
  private readonly maxRed: number;
  blueCount = 0;
  redCount = 0;
  private bluePenalty = 1;
  private redPenalty = 1;

  constructor(phaseDurationSec: number) {
    const scale = phaseDurationSec / 60;
    this.maxBlue = Math.max(1, Math.round(PHASE_BLUE_CAP * scale));
    this.maxRed = Math.max(1, Math.round(PHASE_RED_CAP * scale));
  }

  pickNext(): NoteColor {
    let yW = NOTE_COLOR_WEIGHTS.yellow;
    let rW = NOTE_COLOR_WEIGHTS.red * this.redPenalty;
    let bW = NOTE_COLOR_WEIGHTS.blue * this.bluePenalty;

    if (this.blueCount >= this.maxBlue) bW = 0;
    if (this.redCount >= this.maxRed) rW = 0;

    const total = yW + rW + bW;
    if (total <= 0) return 'yellow';

    const r = Math.random() * total;
    if (r < yW) return 'yellow';
    if (r < yW + rW) return 'red';
    return 'blue';
  }

  onSpawned(type: NoteColor): void {
    if (type === 'blue') {
      this.blueCount++;
      this.bluePenalty *= REPEAT_PENALTY;
    } else if (type === 'red') {
      this.redCount++;
      this.redPenalty *= REPEAT_PENALTY;
    }
  }

  canSpawn(type: NoteColor): boolean {
    if (type === 'blue') return this.blueCount < this.maxBlue;
    if (type === 'red') return this.redCount < this.maxRed;
    return true;
  }
}
