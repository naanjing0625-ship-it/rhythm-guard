import Phaser from 'phaser';
import {
  BLUE_HOLD,
  EYE_LOOK_INTERVAL,
  NOTE_COLORS,
  RED_MASH,
  YELLOW_BREATH,
  type NoteColor,
} from '../config/rhythm';
import {
  getRhythmColorRingRadius,
  getRhythmFaceRadius,
} from '../config/rhythmViewport';

type FaceMode = 'idle' | 'yellow' | 'yellow_tap' | 'blue_hold' | 'red_punch';

export class TargetFace {
  private container: Phaser.GameObjects.Container;
  private leftEye: Phaser.GameObjects.Ellipse;
  private rightEye: Phaser.GameObjects.Ellipse;
  private body: Phaser.GameObjects.Arc;
  private currentScale = 1;
  private targetScale = 1;
  private lerpSpeed: number = YELLOW_BREATH.releaseLerp;
  private eyeOffset = 0;
  private eyeDirection = 1;
  private lastEyeSwitch = 0;
  private mode: FaceMode = 'idle';
  private redPunchPhase: 'none' | 'expand' | 'contract' = 'none';
  private yellowTapPhase: 'none' | 'shrink' | 'release' = 'none';
  private fillColor = NOTE_COLORS.yellow;
  private targetFillColor = NOTE_COLORS.yellow;
  private colorLerpSpeed = 0.14;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    const colorR = getRhythmColorRingRadius();
    const faceR = getRhythmFaceRadius();
    const eyeX = faceR * 0.28;
    const eyeY = -faceR * 0.12;

    this.body = scene.add.circle(0, 0, colorR, NOTE_COLORS.yellow, 1);
    this.leftEye = scene.add.ellipse(-eyeX, eyeY, faceR * 0.2, faceR * 0.28, 0x111111);
    this.rightEye = scene.add.ellipse(eyeX, eyeY, faceR * 0.2, faceR * 0.28, 0x111111);
    this.container = scene.add.container(x, y, [
      this.body,
      this.leftEye,
      this.rightEye,
    ]);
    this.container.setDepth(20);
  }

  getHitTargetRadius(): number {
    return getRhythmColorRingRadius() * this.currentScale;
  }

  getBodyScale(): number {
    return this.currentScale;
  }

  setNoteActive(_active: boolean): void {
    this.body.setFillStyle(this.fillColor, 1);
  }

  /** 中心圈颜色跟随当前音符（黄/蓝/红），平滑过渡 */
  setColor(color: NoteColor): void {
    this.targetFillColor = NOTE_COLORS[color];
  }

  private lerpFillColor(): void {
    const c = this.fillColor;
    const t = this.targetFillColor;
    if (c === t) return;

    const r = Phaser.Math.Linear((c >> 16) & 0xff, (t >> 16) & 0xff, this.colorLerpSpeed);
    const g = Phaser.Math.Linear((c >> 8) & 0xff, (t >> 8) & 0xff, this.colorLerpSpeed);
    const b = Phaser.Math.Linear(c & 0xff, t & 0xff, this.colorLerpSpeed);
    this.fillColor = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);

    if (Math.abs(r - ((t >> 16) & 0xff)) < 1
      && Math.abs(g - ((t >> 8) & 0xff)) < 1
      && Math.abs(b - (t & 0xff)) < 1) {
      this.fillColor = t;
    }
    this.body.setFillStyle(this.fillColor, 1);
  }

  /** 蓝圈点击：立即缩到长按尺寸 */
  beginBlueHold(): void {
    this.mode = 'blue_hold';
    this.currentScale = BLUE_HOLD.holdScale;
    this.targetScale = BLUE_HOLD.holdScale;
    this.container.setScale(this.currentScale);
  }

  setMode(mode: FaceMode): void {
    if (mode === 'red_punch') return;
    this.mode = mode;
    if (mode === 'blue_hold') {
      this.beginBlueHold();
    } else if (mode === 'idle') {
      this.targetScale = 1;
      this.lerpSpeed = YELLOW_BREATH.releaseLerp;
    }
  }

  onYellowPress(): void {
    if (this.mode === 'red_punch' || this.mode === 'blue_hold' || this.mode === 'yellow_tap') return;
    this.mode = 'yellow';
    this.targetScale = YELLOW_BREATH.pressedScale;
    this.lerpSpeed = YELLOW_BREATH.pressLerp;
  }

  /** 黄圈点击：先缩小再弹回 */
  onYellowTap(): void {
    if (this.mode === 'red_punch' || this.mode === 'blue_hold') return;
    this.mode = 'yellow_tap';
    this.yellowTapPhase = 'shrink';
    this.targetScale = YELLOW_BREATH.pressedScale;
    this.lerpSpeed = YELLOW_BREATH.pressLerp;
  }

  onYellowRelease(): void {
    if (this.mode === 'blue_hold' || this.mode === 'red_punch' || this.mode === 'yellow_tap') return;
    this.mode = 'idle';
    this.targetScale = 1;
    this.lerpSpeed = YELLOW_BREATH.releaseLerp;
  }

  onRedTap(): void {
    this.mode = 'red_punch';
    this.redPunchPhase = 'expand';
    this.targetScale = RED_MASH.punchScale;
    this.lerpSpeed = RED_MASH.punchLerp;
  }

  resetForNewNote(): void {
    this.resetScaleState();
  }

  /** 重置缩放/表情，保留当前填充色 */
  resetScaleState(): void {
    this.mode = 'idle';
    this.redPunchPhase = 'none';
    this.yellowTapPhase = 'none';
    this.currentScale = 1;
    this.targetScale = 1;
    this.lerpSpeed = YELLOW_BREATH.releaseLerp;
    this.container.setScale(1);
    this.body.setFillStyle(this.fillColor, 1);
  }

  update(time: number): void {
    this.lerpFillColor();
    if (this.mode === 'yellow_tap') {
      if (this.yellowTapPhase === 'shrink' && this.currentScale <= YELLOW_BREATH.pressedScale + 0.03) {
        this.yellowTapPhase = 'release';
        this.targetScale = 1;
        this.lerpSpeed = YELLOW_BREATH.releaseLerp;
      } else if (this.yellowTapPhase === 'release' && Math.abs(this.currentScale - 1) < 0.025) {
        this.mode = 'idle';
        this.yellowTapPhase = 'none';
        this.currentScale = 1;
        this.targetScale = 1;
      }
    }

    if (this.mode === 'red_punch') {
      if (this.redPunchPhase === 'expand' && this.currentScale >= RED_MASH.punchScale - 0.03) {
        this.redPunchPhase = 'contract';
        this.targetScale = 1;
        this.lerpSpeed = RED_MASH.releaseLerp;
      } else if (this.redPunchPhase === 'contract' && Math.abs(this.currentScale - 1) < 0.025) {
        this.mode = 'idle';
        this.redPunchPhase = 'none';
        this.currentScale = 1;
        this.targetScale = 1;
      }
    }

    this.currentScale += (this.targetScale - this.currentScale) * this.lerpSpeed;
    this.container.setScale(this.currentScale);

    const eyeX = getRhythmFaceRadius() * 0.28;
    if (time - this.lastEyeSwitch > EYE_LOOK_INTERVAL) {
      this.lastEyeSwitch = time;
      this.eyeDirection *= -1;
      this.eyeOffset = this.eyeDirection * eyeX * 0.22;
    }
    this.leftEye.x = -eyeX + this.eyeOffset;
    this.rightEye.x = eyeX + this.eyeOffset;
  }
}
