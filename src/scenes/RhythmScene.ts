import Phaser from 'phaser';
import { gameState } from '../core/GameState';
import {
  IMMEDIATE_YELLOW_APPROACH,
  IMMEDIATE_OTHER_APPROACH,
  MIN_SHRINK_DURATION,
  MIN_WAVE_GAP,
  BLUE_HOLD,
  BLUE_HOLD_LATE_SPAWN_PROGRESS,
  RED_MASH,
  NOTE_TRANSITION_GAP,
  POST_EXCLUSIVE_CENTER_GAP,
  POST_EXCLUSIVE_LEAD_IN,
  COLOR_SWITCH_GAP,
  MAX_CONCURRENT_YELLOW,
  YELLOW_BURST_GAP,
  YELLOW_CHUNK_GAP,
  RING_OVERRUN,
  getGuideRingRadius,
  type NoteColor,
} from '../config/rhythm';
import { DEFAULT_RHYTHM_DURATION } from '../config/rhythmBalance';
import { loadChart, type ChartData } from '../systems/rhythm/ChartLoader';
import { AudioEngine } from '../systems/rhythm/AudioEngine';
import {
  judgeYellowClick,
  judgeRedTaps,
  type JudgementType,
} from '../systems/rhythm/Judgement';
import { generateLoot } from '../systems/rhythm/LootTable';
import { randomizeChartNoteTypes, planYellowBurstChunks, pickYellowBurstCount } from '../systems/rhythm/RandomChart';
import { SpawnColorBudget } from '../systems/rhythm/SpawnColorBudget';
import {
  getRingRadius,
  getRingOuterEdge,
  isShrinkRingVisible,
  isNoteExpired,
  isRingTooLate,
  canInteractWithRing,
  ringOverlapsGuide,
  getNoteColor,
  getInteractionEnd,
  type ChartNote,
} from '../systems/rhythm/RingNote';
import { TargetFace } from '../ui/TargetFace';
import { addGradeText } from '../ui/GradeDisplay';
import { ShrinkRing, type ShrinkRingDraw } from '../ui/ShrinkRing';
import { getRunChapterTheme } from '../config/chapterTheme';
import { EmojiBackground } from '../ui/EmojiBackground';
import { RhythmLetterboxDecor, type RhythmStageBounds } from '../ui/RhythmLetterboxDecor';
import { HoldProgressRing } from '../ui/HoldProgressRing';
import { JudgementEffects } from '../ui/JudgementEffects';
import { createTextButton } from '../ui/HUD';
import { TutorialCoach, type CoachLayout } from '../ui/TutorialCoach';
import { getTutorialFixedLoot, TUTORIAL_YELLOW_BURST_COUNT, TutorialColorPlanner } from '../config/tutorial';
import {
  configureRhythmStage,
  getRhythmCenterY,
  getRhythmColorRingRadius,
  getRhythmUiScale,
  getRhythmViewHeight,
  getRhythmViewWidth,
  resetRhythmStage,
} from '../config/rhythmViewport';
import { GAME_WIDTH, GAME_HEIGHT, setGameViewport } from '../core/Game';

interface ActiveNote extends ChartNote {
  type: NoteColor;
  id: string;
  judged: boolean;
  approachAnchor: number;
  insideFrames: number;
  holdStart: number;
  redTaps: number;
  redWindowStart: number;
  colorApplied: boolean;
  pipelineTriggered?: boolean;
  followSpawned?: boolean;
}

const COLOR_PRIORITY: Record<NoteColor, number> = { blue: 3, red: 2, yellow: 1 };

export class RhythmScene extends Phaser.Scene {
  private audio = new AudioEngine();
  private target!: TargetFace;
  private ring!: ShrinkRing;
  private holdRing!: HoldProgressRing;
  private background!: EmojiBackground;
  private letterboxDecor: RhythmLetterboxDecor | null = null;
  private stageRoot!: Phaser.GameObjects.Container;
  private bgCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private effects!: JudgementEffects;
  private centerX = 540;
  private centerY = 960;

  private activeNotes: ActiveNote[] = [];
  private pendingNotes: ChartNote[] = [];
  private spawnColorBudget!: SpawnColorBudget;
  private pipelineInitialized = false;
  private spawnSerial = 0;
  private yellowChunkQueue: { count: number; spawnAt: number }[] = [];
  /** 黄圈未清完时先记下待出的红/蓝 */
  private pendingExclusive: 'red' | 'blue' | null = null;

  private score = 0;
  private maxScore = 0;
  private combo = 0;
  private typeHits: Record<NoteColor, number> = { yellow: 0, blue: 0, red: 0 };
  private judgements: Record<JudgementType, number> = { perfect: 0, great: 0, good: 0, miss: 0 };
  private chartDuration = DEFAULT_RHYTHM_DURATION;
  private finished = false;
  private phaseReady = false;
  private createToken = 0;
  private isPointerDown = false;
  private spawnBlockedUntil = 0;
  private liveNotesCache: ActiveNote[] | null = null;
  private lastScoreText = '';
  private lastComboText = '';
  private tutorialMode = false;
  private tutorialRhythmStarted = false;
  private tutorialRhythmPaused = false;
  private pendingTutorialChart: ChartData | null = null;
  private tutorialColorPlanner = new TutorialColorPlanner();
  private tutorialCoach = new TutorialCoach();
  private tutorialSkipBtn: Phaser.GameObjects.Container | null = null;

  private scoreText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;

  private readonly onKeyDown = (): void => {
    if (!this.phaseReady || this.tutorialRhythmPaused) return;
    const songTime = this.audio.songTime();
    const redMash = this.findActiveRedMashNote(songTime);
    if (redMash) {
      this.registerRedTap(redMash);
      return;
    }
    if (!this.isPointerDown) this.onPointerDown();
  };

  private readonly onKeyUp = (): void => {
    this.onPointerUp();
  };

  constructor() {
    super('RhythmScene');
  }

  /** 重玩 / 下一关时必须重置；create 为 async，update 会在 await 期间先跑 */
  private resetPhaseState(): void {
    this.activeNotes = [];
    this.pendingNotes = [];
    this.spawnColorBudget = new SpawnColorBudget(this.chartDuration);
    this.pipelineInitialized = false;
    this.spawnSerial = 0;
    this.yellowChunkQueue = [];
    this.pendingExclusive = null;
    this.score = 0;
    this.maxScore = 0;
    this.combo = 0;
    this.typeHits = { yellow: 0, blue: 0, red: 0 };
    this.judgements = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.chartDuration = DEFAULT_RHYTHM_DURATION;
    this.finished = false;
    this.phaseReady = false;
    this.isPointerDown = false;
    this.spawnBlockedUntil = 0;
    this.liveNotesCache = null;
    this.lastScoreText = '';
    this.lastComboText = '';
    this.tutorialRhythmStarted = false;
    this.tutorialRhythmPaused = false;
    this.pendingTutorialChart = null;
    this.tutorialColorPlanner.reset();
    this.audio.stop();
  }

  async create(): Promise<void> {
    const run = gameState.run;
    if (!run) { this.scene.start('LevelSelectScene'); return; }

    this.tutorialMode = gameState.tutorialMode;

    const token = ++this.createToken;
    this.phaseReady = false;
    this.resetPhaseState();
    this.tutorialCoach.destroy();
    this.tutorialCoach = new TutorialCoach();
    this.tutorialColorPlanner.reset();
    this.tutorialSkipBtn = null;
    this.children.removeAll(true);
    this.time.removeAllEvents();

    // Keep global game resolution in landscape, then render rhythm into a centered portrait viewport.
    setGameViewport(this.game, GAME_WIDTH, GAME_HEIGHT);
    this.stageRoot = this.add.container(0, 0);
    const stageBounds = this.setupPortraitStageViewport();
    this.setupLetterboxLayer(stageBounds);
    this.centerX = getRhythmViewWidth() / 2;
    this.centerY = getRhythmCenterY();

    const viewW = getRhythmViewWidth();
    const viewH = getRhythmViewHeight();
    const ui = getRhythmUiScale();
    const titleSize = Math.max(14, Math.round(32 * ui));
    const hintSize = Math.max(10, Math.round(22 * ui));
    const hudSize = Math.max(12, Math.round(26 * ui));
    const marginX = Math.max(12, Math.round(32 * ui));
    const progressY = Math.max(56, Math.round(158 * (viewH / 1920)));
    const progressH = Math.max(8, Math.round(12 * ui));

    this.background = new EmojiBackground(this, getRunChapterTheme());
    this.target = new TargetFace(this, this.centerX, this.centerY);
    this.ring = new ShrinkRing(this);
    this.holdRing = new HoldProgressRing(this, this.centerX, this.centerY);
    this.effects = new JudgementEffects(this, this.audio.getSfx(), this.centerX, this.centerY, this.stageRoot);

    this.add.text(viewW / 2, Math.round(72 * (viewH / 1920)), run.level.name, {
      fontSize: `${titleSize}px`, color: '#7b4fff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.add.text(viewW / 2, Math.round(118 * (viewH / 1920)),
      this.tutorialMode
        ? '🟡 点击/空格 Perfect  ·  🔵 到圈长按'
        : '🟡重合=Perfect  🔵到圈长按  🔴1秒6次Perfect/4次Good',
      {
      fontSize: `${hintSize}px`, color: '#666666', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(30);

    this.scoreText = this.add.text(marginX, marginX, 'Score: 0', {
      fontSize: `${hudSize}px`, color: '#333333', fontFamily: 'Arial',
    }).setDepth(30);
    this.comboText = this.add.text(viewW - marginX, marginX, 'Combo: 0', {
      fontSize: `${hudSize}px`, color: '#333333', fontFamily: 'Arial',
    }).setOrigin(1, 0).setDepth(30);
    this.add.rectangle(viewW / 2, progressY, viewW - Math.round(80 * ui), progressH, 0xdddddd).setDepth(30);
    this.progressFill = this.add.rectangle(marginX, progressY, 0, progressH, 0x7b4fff).setOrigin(0, 0.5).setDepth(31);

    this.chartDuration = run.level.duration;
    this.spawnColorBudget = new SpawnColorBudget(this.chartDuration);

    const chart = await loadChart(run.level.chartId);
    if (token !== this.createToken) return;

    this.chartDuration = chart.duration;
    this.spawnColorBudget = new SpawnColorBudget(this.chartDuration);
    this.pendingNotes = randomizeChartNoteTypes(
      [...chart.notes]
        .filter((n) => n.time <= this.chartDuration)
        .sort((a, b) => a.time - b.time),
    );
    this.maxScore = this.pendingNotes.length * 1.5;

    await this.audio.init(gameState.save?.settings.volume ?? 0.8);
    if (token !== this.createToken) return;

    const chartPayload = { ...chart, duration: this.chartDuration };
    if (this.tutorialMode) {
      this.pendingTutorialChart = chartPayload;
    } else {
      await this.audio.play(chartPayload, gameState.save?.settings.audioOffset ?? 0);
    }
    if (token !== this.createToken) return;

    const hitZone = this.add.circle(
      this.centerX,
      this.centerY,
      getRhythmColorRingRadius() + Math.round(80 * ui),
      0xffffff,
      0.001,
    ).setDepth(25);
    hitZone.setInteractive();
    hitZone.on('pointerdown', () => this.onPointerDown());
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.keyboard?.off('keydown-SPACE', this.onKeyDown);
    this.input.keyboard?.off('keyup-SPACE', this.onKeyUp);
    this.input.keyboard?.on('keydown-SPACE', this.onKeyDown);
    this.input.keyboard?.on('keyup-SPACE', this.onKeyUp);

    this.attachStageLayer();
    this.phaseReady = true;

    if (this.tutorialMode) {
      const skipStyle = { fontSize: 13, height: 30, charWidth: 12, paddingX: 16 };
      const skipW = '跳过'.length * skipStyle.charWidth + skipStyle.paddingX;
      this.tutorialSkipBtn = createTextButton(
        this,
        viewW - marginX - skipW / 2,
        progressY + Math.round(20 * ui),
        '跳过',
        () => this.finishPhase(true),
        0x888888,
        45,
        skipStyle,
      );
      this.stageRoot.add(this.tutorialSkipBtn);
      this.time.delayedCall(500, () => {
        if (this.phaseReady && !this.finished) {
          this.tutorialCoach.show(
            this,
            'rhythm_welcome',
            () => this.beginTutorialRhythm(),
            this.rhythmCoachLayout(),
          );
        }
      });
    }
  }

  update(_time: number, delta: number): void {
    if (!this.phaseReady || this.finished || !this.ring || !this.progressFill) return;

    if (this.tutorialMode && !this.tutorialRhythmStarted) {
      this.background.update(0);
      this.letterboxDecor?.update(0);
      this.target.update(this.time.now);
      this.effects.update(delta);
      return;
    }

    const songTime = this.audio.songTime();

    if (this.tutorialMode && this.tutorialRhythmPaused) {
      this.background.update(songTime);
      this.letterboxDecor?.update(songTime);
      this.target.update(this.time.now);
      this.effects.update(delta);
      this.drawAllRings(songTime);
      this.syncCenterColor(songTime);
      return;
    }

    this.liveNotesCache = null;
    this.background.update(songTime);
    this.letterboxDecor?.update(songTime);
    this.target.update(this.time.now);
    this.effects.update(delta);

    if (!this.audio.isPlaying && songTime > 1 && !this.tutorialRhythmPaused) {
      this.finishPhase();
      return;
    }

    this.updateActiveNotes(songTime);
    this.cullStaleNotes(songTime);
    this.ensurePipelineSpawn(songTime);
    this.drawAllRings(songTime);
    this.syncCenterColor(songTime);

    const scoreStr = `Score: ${Math.round(this.score)}`;
    if (scoreStr !== this.lastScoreText) {
      this.lastScoreText = scoreStr;
      this.scoreText.setText(scoreStr);
    }
    const comboStr = `Combo: ${this.combo}`;
    if (comboStr !== this.lastComboText) {
      this.lastComboText = comboStr;
      this.comboText.setText(comboStr);
    }
    const barWidth = getRhythmViewWidth() - Math.round(80 * getRhythmUiScale());
    this.progressFill.width = barWidth * Math.min(1, songTime / this.chartDuration);

    if (songTime >= this.chartDuration) this.finishPhase();
  }

  private hasActiveExclusive(songTime: number): boolean {
    return this.activeNotes.some(
      (n) => (n.type === 'blue' || n.type === 'red') && this.isNoteLive(n, songTime),
    );
  }

  /** 红/蓝连点或长按的「独占窗口」结束时刻 */
  private getExclusiveBlockEnd(note: ActiveNote): number | null {
    if (note.type === 'red' && note.redWindowStart > 0) {
      return note.redWindowStart + RED_MASH.window;
    }
    if (note.type === 'blue' && note.holdStart > 0) {
      return note.holdStart + BLUE_HOLD.duration;
    }
    return null;
  }

  /** 某时刻是否有红/蓝正处于独占窗口（其它圈不可进中心） */
  private isExclusiveBlockingCenter(songTime: number): boolean {
    for (const note of this.activeNotes) {
      if (note.judged || (note.type !== 'red' && note.type !== 'blue')) continue;
      const end = this.getExclusiveBlockEnd(note);
      if (end === null) continue;
      const start = note.type === 'red' ? note.redWindowStart : note.holdStart;
      if (songTime >= start && songTime < end) return true;
    }
    return false;
  }

  /** 黄圈全部判定完后生成待出的红/蓝 */
  private tryCommitPendingExclusive(songTime: number): void {
    if (!this.pendingExclusive) return;
    if (this.getLiveYellows(songTime).length > 0) return;
    if (this.hasActiveExclusive(songTime)) return;
    if (songTime < this.spawnBlockedUntil) return;

    const type = this.pendingExclusive;
    this.pendingExclusive = null;
    if (!this.tutorialMode) this.spawnColorBudget.onSpawned(type);
    this.spawnPipelineNote(songTime, type);
    this.markWaveSpawned(songTime);
  }

  /** 超时未判定的音符强制 Miss，防止卡住后续出圈 */
  private cullStaleNotes(songTime: number): void {
    for (const note of [...this.activeNotes]) {
      if (note.judged) continue;
      if (songTime <= getInteractionEnd(note) + 0.6) continue;
      if (note.type === 'red') {
        this.resolveRed(note);
      } else {
        this.applyJudgement(note, 'miss');
      }
    }
  }

  /** 场上仍有未判定的黄圈（不含已过期） */
  private getLiveYellows(songTime: number): ActiveNote[] {
    return this.getLiveNotes(songTime)
      .filter((n) => n.type === 'yellow' && !n.judged)
      .sort((a, b) => (a.hitTime ?? a.time) - (b.hitTime ?? b.time));
  }

  /** 蓝圈长按快结束时允许预出下一圈并对齐结束时刻 */
  private getBlueHoldForLateSpawn(songTime: number): ActiveNote | null {
    for (const note of this.activeNotes) {
      if (note.judged || note.type !== 'blue' || note.holdStart <= 0) continue;
      const held = songTime - note.holdStart;
      if (held >= BLUE_HOLD.duration * BLUE_HOLD_LATE_SPAWN_PROGRESS && held < BLUE_HOLD.duration) {
        return note;
      }
    }
    return null;
  }

  private async beginTutorialRhythm(): Promise<void> {
    if (this.tutorialRhythmStarted || this.finished || !this.pendingTutorialChart) return;
    this.tutorialRhythmStarted = true;
    const chart = this.pendingTutorialChart;
    this.pendingTutorialChart = null;
    await this.audio.play(chart, gameState.save?.settings.audioOffset ?? 0);
  }

  /** 黄圈流水线：最早黄圈进中心则预约下一圈；红/蓝须等黄圈全部点完 */
  private ensurePipelineSpawn(songTime: number): void {
    if (this.finished || songTime >= this.chartDuration) return;
    if (songTime < this.spawnBlockedUntil) return;

    if (!this.pipelineInitialized) {
      if (this.tutorialMode) {
        this.scheduleTutorialYellowBurst(songTime);
      } else {
        this.scheduleYellowBurst(songTime);
      }
      this.pipelineInitialized = true;
    }

    this.tryCommitPendingExclusive(songTime);

    if (!this.isExclusiveBlockingCenter(songTime) && !this.hasActiveExclusive(songTime)) {
      if (this.tutorialMode) {
        this.processYellowBurstQueue(songTime);
        const yellows = this.getLiveYellows(songTime);
        if (yellows.length === 0 && this.yellowChunkQueue.length === 0 && !this.pendingExclusive) {
          this.scheduleTutorialYellowBurst(songTime);
        }
      } else {
        this.processYellowBurstQueue(songTime);

        const yellows = this.getLiveYellows(songTime);
        if (yellows.length === 0 && this.yellowChunkQueue.length === 0 && !this.pendingExclusive) {
          this.scheduleYellowBurst(songTime);
          this.processYellowBurstQueue(songTime);
        }
      }
    }

    if (this.isExclusiveBlockingCenter(songTime) || this.pendingExclusive) return;

    const yellows = this.getLiveYellows(songTime);
    if (yellows.length === 0) return;

    const oldest = yellows[0];
    if (oldest.pipelineTriggered) return;

    const r = getRingRadius(oldest, songTime, oldest.approachAnchor);
    if (r !== null && ringOverlapsGuide(r)) {
      oldest.pipelineTriggered = true;
      this.pickAndSpawnNext(songTime);
    }
  }

  private markWaveSpawned(songTime: number): void {
    this.spawnBlockedUntil = songTime + MIN_WAVE_GAP;
  }

  private clampHitTime(anchor: number, hitTime: number, minShrink: number): number {
    return Math.max(hitTime, anchor + minShrink);
  }

  private nextNoteId(songTime: number, type: NoteColor): string {
    this.spawnSerial += 1;
    return `pipe_${songTime.toFixed(2)}_${type}_${this.spawnSerial}`;
  }

  private pushPipelineNote(
    songTime: number,
    type: NoteColor,
    anchor: number,
    hitTime: number,
  ): void {
    this.activeNotes.push({
      time: hitTime,
      type,
      hitTime,
      id: this.nextNoteId(songTime, type),
      judged: false,
      approachAnchor: anchor,
      insideFrames: 0,
      holdStart: 0,
      redTaps: 0,
      redWindowStart: 0,
      colorApplied: false,
    });
    this.maxScore += 1.5;
    this.ring.begin();
  }

  private maybeShowRedTutorial(): void {
    if (!this.tutorialMode || this.tutorialCoach.hasShown('rhythm_red')) return;
    if (this.tutorialCoach.isVisible()) return;
    this.tutorialCoach.showOnce(this, 'rhythm_red', this.rhythmCoachLayout());
  }

  /** 蓝圈到中心且当前无红圈独占时才弹板（避免红圈预出下一圈时误触发） */
  private maybeShowBlueTutorial(songTime: number): void {
    if (!this.tutorialMode || this.tutorialCoach.hasShown('rhythm_blue')) return;
    if (this.tutorialCoach.isVisible()) return;
    if (this.findActiveRedMashNote(songTime)) return;
    if (this.isExclusiveBlockingCenter(songTime)) return;
    this.tutorialCoach.showOnce(this, 'rhythm_blue', this.rhythmCoachLayout());
  }

  private scheduleTutorialYellowBurst(songTime: number): void {
    if (!this.tutorialColorPlanner.atYellowSegment()) return;
    if (this.hasActiveExclusive(songTime)) return;

    const live = this.getLiveYellows(songTime).length;
    const room = MAX_CONCURRENT_YELLOW - live;
    if (room <= 0) return;

    const count = Math.min(TUTORIAL_YELLOW_BURST_COUNT, room);
    this.spawnYellowChunk(songTime, count);
    this.tutorialColorPlanner.consumeYellowSegment();
  }

  private scheduleYellowBurst(songTime: number): void {
    if (this.hasActiveExclusive(songTime)) return;

    const live = this.getLiveYellows(songTime).length;
    const room = MAX_CONCURRENT_YELLOW - live;
    if (room <= 0) return;

    const total = Math.min(pickYellowBurstCount(room), room);
    const chunks = planYellowBurstChunks(total);
    let at = songTime;
    for (let i = 0; i < chunks.length; i++) {
      this.yellowChunkQueue.push({ count: chunks[i], spawnAt: at });
      if (i < chunks.length - 1) at += YELLOW_CHUNK_GAP;
    }
  }

  private processYellowBurstQueue(songTime: number): void {
    if (this.hasActiveExclusive(songTime)) return;

    while (this.yellowChunkQueue.length > 0 && this.yellowChunkQueue[0].spawnAt <= songTime) {
      if (songTime < this.spawnBlockedUntil) break;

      const chunk = this.yellowChunkQueue.shift()!;
      const live = this.getLiveYellows(songTime).length;
      const room = MAX_CONCURRENT_YELLOW - live;
      if (room <= 0) {
        this.yellowChunkQueue.unshift({ ...chunk, spawnAt: songTime + MIN_WAVE_GAP });
        break;
      }

      const toSpawn = Math.min(chunk.count, room);
      this.spawnYellowChunk(songTime, toSpawn);
      if (toSpawn < chunk.count) {
        this.yellowChunkQueue.unshift({
          count: chunk.count - toSpawn,
          spawnAt: songTime + YELLOW_CHUNK_GAP,
        });
      }
    }
  }

  private spawnYellowChunk(songTime: number, count: number): void {
    const anchor = songTime;
    const approach = IMMEDIATE_YELLOW_APPROACH;
    const existing = this.getLiveYellows(songTime);
    let lastHit: number | null = existing.length > 0
      ? (existing[existing.length - 1].hitTime ?? existing[existing.length - 1].time)
      : null;

    for (let i = 0; i < count; i++) {
      const hitTime = lastHit === null
        ? this.clampHitTime(anchor, anchor + approach, MIN_SHRINK_DURATION)
        : this.clampHitTime(anchor, lastHit + YELLOW_BURST_GAP, MIN_SHRINK_DURATION);
      lastHit = hitTime;
      this.pushPipelineNote(songTime, 'yellow', anchor, hitTime);
    }
    this.markWaveSpawned(songTime);
  }

  /** 红/蓝独占窗口开始时预出下一圈：独占期间可见缩圈，结束后再过一段才到中心 */
  private spawnPostExclusiveFollowUp(songTime: number, exclusiveEnd: number): void {
    // 预出圈延后出现：独占结束前 LEAD_IN 才开始缩，结束时仍停在中心外侧留有空间，
    // 到达中心的时刻在独占结束之后 CENTER_GAP。
    const anchor = Math.max(songTime, exclusiveEnd - POST_EXCLUSIVE_LEAD_IN);
    const hitTime = this.clampHitTime(
      anchor,
      exclusiveEnd + POST_EXCLUSIVE_CENTER_GAP,
      MIN_SHRINK_DURATION,
    );

    let type: NoteColor;
    if (this.tutorialMode) {
      const next = this.tutorialColorPlanner.takeNextExclusive();
      if (!next) return;
      type = next;
    } else {
      type = this.spawnColorBudget.pickNext();
      let attempts = 0;
      while (attempts < 10) {
        if ((type === 'blue' || type === 'red') && !this.spawnColorBudget.canSpawn(type)) {
          type = this.spawnColorBudget.pickNext();
          attempts++;
          continue;
        }
        break;
      }
      this.spawnColorBudget.onSpawned(type);
    }

    this.pushPipelineNote(songTime, type, anchor, hitTime);
    this.markWaveSpawned(songTime);
  }

  private openRedMashWindow(note: ActiveNote, songTime: number): void {
    if (note.redWindowStart > 0) return;
    note.redWindowStart = songTime;
    note.redTaps = 0;
    this.maybeShowRedTutorial();
    if (!note.followSpawned) {
      note.followSpawned = true;
      this.spawnPostExclusiveFollowUp(songTime, songTime + RED_MASH.window);
    }
  }

  private registerRedTap(note: ActiveNote): void {
    note.redTaps++;
    this.target.onRedTap();
    this.effects.playRedTap(this.centerX, this.centerY);
  }

  private pickAndSpawnNext(songTime: number): void {
    const liveYellowCount = this.getLiveYellows(songTime).length;
    let type: NoteColor;

    if (this.tutorialMode) {
      const next = this.tutorialColorPlanner.takeNextExclusive();
      if (!next) return;
      type = next;
    } else {
      type = this.spawnColorBudget.pickNext();
      let attempts = 0;

      while (attempts < 10) {
        if (type === 'yellow' && liveYellowCount >= MAX_CONCURRENT_YELLOW) {
          type = this.spawnColorBudget.pickNext();
          attempts++;
          continue;
        }
        if ((type === 'blue' || type === 'red') && !this.spawnColorBudget.canSpawn(type)) {
          type = this.spawnColorBudget.pickNext();
          attempts++;
          continue;
        }
        break;
      }

      if (type === 'yellow' && liveYellowCount >= MAX_CONCURRENT_YELLOW) return;
    }

    if ((type === 'red' || type === 'blue') && liveYellowCount > 0) {
      if (!this.pendingExclusive) this.pendingExclusive = type;
      this.markWaveSpawned(songTime);
      return;
    }

    if (!this.tutorialMode) this.spawnColorBudget.onSpawned(type);
    if (type === 'yellow') {
      this.scheduleYellowBurst(songTime);
      this.processYellowBurstQueue(songTime);
    } else {
      this.spawnPipelineNote(songTime, type);
    }
    this.markWaveSpawned(songTime);
  }

  private spawnPipelineNote(songTime: number, type: NoteColor): void {
    const lateBlue = this.getBlueHoldForLateSpawn(songTime);
    const anchor = songTime;
    let hitTime: number;

    if (lateBlue && type !== 'blue') {
      const remaining = BLUE_HOLD.duration - (songTime - lateBlue.holdStart);
      hitTime = this.clampHitTime(anchor, songTime + remaining, MIN_SHRINK_DURATION);
    } else {
      hitTime = this.clampHitTime(anchor, anchor + IMMEDIATE_OTHER_APPROACH, MIN_SHRINK_DURATION);
    }

    this.pushPipelineNote(songTime, type, anchor, hitTime);
  }

  private isNoteLive(note: ActiveNote, songTime: number): boolean {
    if (note.judged) return false;
    if (note.type === 'blue') {
      const hit = note.hitTime ?? note.time;
      if (note.holdStart > 0) {
        return songTime <= note.holdStart + BLUE_HOLD.duration + RING_OVERRUN;
      }
      const approachEnd = note.approachAnchor + Math.max(0.05, hit - note.approachAnchor);
      return songTime <= approachEnd + RING_OVERRUN + COLOR_SWITCH_GAP + 0.5;
    }
    if (note.type === 'red') {
      if (note.redWindowStart > 0) {
        return songTime < note.redWindowStart + RED_MASH.window;
      }
      const hit = note.hitTime ?? note.time;
      const approachEnd = note.approachAnchor + Math.max(0.05, hit - note.approachAnchor);
      return songTime <= approachEnd + RING_OVERRUN + COLOR_SWITCH_GAP + 0.5;
    }
    return !isNoteExpired(note, songTime);
  }

  private getLiveNotes(songTime: number): ActiveNote[] {
    if (this.liveNotesCache) return this.liveNotesCache;
    this.liveNotesCache = this.activeNotes.filter((n) => this.isNoteLive(n, songTime));
    return this.liveNotesCache;
  }

  private syncCenterColor(songTime: number): void {
    for (const note of this.getLiveNotes(songTime)) {
      if (note.type === 'blue' && note.holdStart > 0) {
        this.target.setColor('blue');
        this.holdRing.setNoteColor(getNoteColor(note));
        return;
      }
    }

    let best: ActiveNote | null = null;
    let bestPriority = 0;

    for (const note of this.getLiveNotes(songTime)) {
      const radius = getRingRadius(note, songTime, note.approachAnchor);
      if (radius === null || !isShrinkRingVisible(radius)) continue;
      const p = COLOR_PRIORITY[note.type];
      if (p >= bestPriority) {
        best = note;
        bestPriority = p;
      }
    }

    if (best) {
      this.target.setColor(best.type);
      if (best.type === 'blue') {
        this.holdRing.setNoteColor(getNoteColor(best));
      }
    } else {
      this.target.setColor('yellow');
    }
  }

  private drawAllRings(songTime: number): void {
    const draws: ShrinkRingDraw[] = [];

    for (const note of this.getLiveNotes(songTime)) {
      if (note.type === 'blue' && note.holdStart > 0) continue;

      const radius = getRingRadius(note, songTime, note.approachAnchor);
      if (radius === null) continue;

      draws.push({
        x: this.centerX,
        y: this.centerY,
        radius,
        color: getNoteColor(note),
      });
    }

    this.ring.drawMultiple(draws);
  }

  private updateActiveNotes(songTime: number): void {
    for (const note of [...this.activeNotes]) {
      if (note.judged) continue;

      if (!this.isNoteLive(note, songTime)) {
        if (note.type === 'red') {
          this.resolveRed(note);
        } else if (note.type === 'blue' && note.holdStart > 0) {
          const held = songTime - note.holdStart;
          this.applyJudgement(note, held >= BLUE_HOLD.duration ? 'perfect' : 'miss');
        } else {
          this.applyJudgement(note, 'miss');
        }
        continue;
      }

      const radius = getRingRadius(note, songTime, note.approachAnchor);
      if (radius === null) continue;

      if (note.type === 'yellow') {
        if (isRingTooLate(radius)) {
          note.insideFrames++;
          if (note.insideFrames >= 4) this.applyJudgement(note, 'miss');
        } else {
          note.insideFrames = 0;
        }
        continue;
      }

      if (note.type === 'blue') {
        this.updateBlue(note, songTime, radius);
        continue;
      }

      if (note.type === 'red') {
        this.updateRed(note, songTime, radius);
      }
    }
  }

  private findBlueNote(songTime: number): ActiveNote | undefined {
    return this.activeNotes.find((n) => n.type === 'blue' && !n.judged && this.isNoteLive(n, songTime));
  }

  /** 红圈连点窗口内的音符（须优先于预出的蓝/黄圈响应点击） */
  private findActiveRedMashNote(songTime: number): ActiveNote | undefined {
    return this.activeNotes.find(
      (n) => n.type === 'red'
        && !n.judged
        && n.redWindowStart > 0
        && !this.isRedWindowExpired(n, songTime),
    );
  }

  private findRedNote(songTime: number): ActiveNote | undefined {
    const mashing = this.findActiveRedMashNote(songTime);
    if (mashing) return mashing;
    return this.activeNotes.find((n) => n.type === 'red' && !n.judged && this.isNoteLive(n, songTime));
  }

  private isRedWindowExpired(note: ActiveNote, songTime: number): boolean {
    return note.redWindowStart > 0 && songTime >= note.redWindowStart + RED_MASH.window;
  }

  /** 取最接近重合的黄圈，确保点击有响应（过早/过晚会判 Miss） */
  private pickYellowForClick(songTime: number): { note: ActiveNote; r: number } | null {
    let best: { note: ActiveNote; r: number; align: number } | null = null;

    for (const note of this.getLiveNotes(songTime)) {
      if (note.type !== 'yellow') continue;
      const r = getRingRadius(note, songTime, note.approachAnchor);
      if (r === null) continue;

      const align = -Math.abs(getRingOuterEdge(r) - getGuideRingRadius());
      if (!best || align > best.align) {
        best = { note, r, align };
      }
    }

    return best ? { note: best.note, r: best.r } : null;
  }

  private onPointerDown(): void {
    if (this.tutorialRhythmPaused) return;
    this.isPointerDown = true;
    const songTime = this.audio.songTime();
    const bonus = (gameState.metaEffects.judgementBonusMs ?? 0) * 0.2;

    const redMash = this.findActiveRedMashNote(songTime);
    if (redMash) {
      this.registerRedTap(redMash);
      return;
    }

    const blue = this.findBlueNote(songTime);
    if (blue) {
      if (blue.holdStart > 0) return;
      const r = getRingRadius(blue, songTime, blue.approachAnchor);
      if (r !== null && canInteractWithRing(r, bonus)) {
        this.startBlueHold(blue, songTime);
      }
      return;
    }

    const red = this.findRedNote(songTime);
    if (red) {
      if (this.isRedWindowExpired(red, songTime)) {
        this.resolveRed(red);
        return;
      }

      if (red.redWindowStart > 0) {
        this.registerRedTap(red);
        return;
      }

      const r = getRingRadius(red, songTime, red.approachAnchor);
      if (r !== null && canInteractWithRing(r, bonus)) {
        this.openRedMashWindow(red, songTime);
        this.registerRedTap(red);
      }
      return;
    }

    const yellow = this.pickYellowForClick(songTime);
    if (yellow) {
      this.applyJudgement(yellow.note, judgeYellowClick(yellow.r, undefined, bonus).type);
    }
  }

  private onPointerUp(): void {
    if (!this.isPointerDown) return;
    this.isPointerDown = false;
    this.target.onYellowRelease();

    // 蓝圈松手结算交给 updateBlue（依据 isPointerDown），保证“按住才算长按”
    const songTime = this.audio.songTime();
    const blue = this.findBlueNote(songTime);
    if (!blue || blue.judged || blue.holdStart === 0) return;

    const held = songTime - blue.holdStart;
    this.applyJudgement(blue, held >= BLUE_HOLD.duration ? 'perfect' : 'miss');
  }

  private startBlueHold(note: ActiveNote, songTime: number): void {
    if (note.holdStart > 0) return;
    note.holdStart = songTime;
    this.target.beginBlueHold();
    this.holdRing.setBodyScale(BLUE_HOLD.holdScale);
    this.holdRing.startHold();
    if (!note.followSpawned) {
      note.followSpawned = true;
      this.spawnPostExclusiveFollowUp(songTime, songTime + BLUE_HOLD.duration);
    }
  }

  private updateBlue(note: ActiveNote, songTime: number, radius: number): void {
    if (note.holdStart === 0) {
      if (isRingTooLate(radius)) {
        note.insideFrames++;
        if (note.insideFrames >= 4) {
          this.applyJudgement(note, 'miss');
        }
        return;
      }

      note.insideFrames = 0;
      const bonus = (gameState.metaEffects.judgementBonusMs ?? 0) * 0.2;
      if (canInteractWithRing(radius, bonus)) {
        this.maybeShowBlueTutorial(songTime);
      }
      if (this.isPointerDown && canInteractWithRing(radius, bonus)) {
        this.startBlueHold(note, songTime);
      }
      return;
    }

    const held = Math.max(0, songTime - note.holdStart);

    // 松手即停：手指不再按住时立即结算（满则 Perfect，否则 Miss）
    if (!this.isPointerDown) {
      this.applyJudgement(note, held >= BLUE_HOLD.duration ? 'perfect' : 'miss');
      return;
    }

    this.holdRing.setBodyScale(BLUE_HOLD.holdScale);
    this.holdRing.setProgress(Math.min(1, held / BLUE_HOLD.duration));

    if (held >= BLUE_HOLD.duration) {
      this.applyJudgement(note, 'perfect');
    }
  }

  private updateRed(note: ActiveNote, songTime: number, radius: number): void {
    if (note.redWindowStart === 0) {
      if (isRingTooLate(radius)) {
        note.insideFrames++;
        if (note.insideFrames >= 4) {
          this.applyJudgement(note, 'miss');
        }
        return;
      }

      note.insideFrames = 0;
      if (canInteractWithRing(radius)) {
        this.openRedMashWindow(note, songTime);
      }
      return;
    }

    if (this.isRedWindowExpired(note, songTime)) {
      this.resolveRed(note);
    }
  }

  private resolveRed(note: ActiveNote): void {
    if (note.judged) return;
    if (note.redTaps > 0) {
      this.typeHits.red += 1;
      this.applyJudgement(note, judgeRedTaps(note.redTaps).type);
      return;
    }
    this.applyJudgement(note, 'miss');
  }

  private releaseNote(note: ActiveNote): void {
    const idx = this.activeNotes.indexOf(note);
    if (idx >= 0) this.activeNotes.splice(idx, 1);
    this.liveNotesCache = null;

    const blueAlive = this.activeNotes.some((n) => n.type === 'blue' && !n.judged);
    if (!blueAlive) {
      this.holdRing.clear();
      if (!this.activeNotes.some((n) => !n.judged)) {
        this.target.resetScaleState();
      }
    }
  }

  private applyJudgement(note: ActiveNote, type: JudgementType): void {
    if (note.judged) return;
    note.judged = true;
    this.registerJudgement(type, note.type, note.type !== 'red');
    this.effects.play(type, this.centerX, this.centerY);

    if (note.type === 'yellow') {
      this.target.onYellowTap();
      this.releaseNote(note);
      this.tryCommitPendingExclusive(this.audio.songTime());
      return;
    }

    if (note.type === 'blue') {
      this.holdRing.clear();
      this.target.resetScaleState();
      this.releaseNote(note);
      return;
    }

    if (note.type === 'red') {
      this.target.resetScaleState();
      this.target.setColor('yellow');
      this.releaseNote(note);
      return;
    }

    this.spawnBlockedUntil = this.audio.songTime() + NOTE_TRANSITION_GAP.default;
    this.releaseNote(note);
  }

  private registerJudgement(type: JudgementType, noteType: NoteColor, countTypeHit = true): void {
    this.judgements[type]++;
    if (type === 'miss') {
      this.combo = 0;
    } else {
      this.combo++;
      const mult = type === 'perfect' ? 1.5 : type === 'great' ? 1.0 : 0.5;
      this.score += mult * (1 + this.combo * 0.05);
      if (countTypeHit) this.typeHits[noteType]++;
      if (this.tutorialMode && !this.tutorialCoach.hasShown('rhythm_perfect') && !this.tutorialCoach.isVisible()) {
        this.tutorialCoach.showOnce(this, 'rhythm_perfect', this.rhythmCoachLayout());
      }
    }
  }

  private finishPhase(skipped = false): void {
    if (this.finished) return;
    this.finished = true;
    this.tutorialCoach.hide();
    this.tutorialSkipBtn?.destroy();
    this.tutorialSkipBtn = null;
    this.audio.stop();

    for (const note of this.activeNotes) {
      if (!note.judged) this.judgements.miss++;
    }
    this.activeNotes = [];
    this.ring.clear();
    this.holdRing.clear();
    this.target.resetScaleState();
    this.effects.clear();

    const accuracy = this.maxScore > 0 ? Math.min(1, this.score / this.maxScore) : 0;
    let loot;
    let grade: 'A' | 'B' | 'S' | 'SS' | 'SSS' = 'A';
    if (gameState.tutorialMode) {
      loot = getTutorialFixedLoot();
      grade = skipped ? 'B' : 'A';
    } else {
      const lootResult = generateLoot({
        accuracy,
        typeHits: this.typeHits,
        lootBonus: gameState.metaEffects.lootBonus,
        judgements: this.judgements,
        levelId: gameState.run!.level.id,
      });
      loot = lootResult.items;
      grade = lootResult.grade;
    }

    gameState.setRhythmResult({
      score: this.score,
      maxScore: this.maxScore,
      accuracy: gameState.tutorialMode ? 0.8 : accuracy,
      laneHits: { 0: this.typeHits.yellow, 1: this.typeHits.blue, 2: this.typeHits.red },
      judgements: { ...this.judgements },
    }, loot);

    const viewW = getRhythmViewWidth();
    const viewH = getRhythmViewHeight();
    const ui = getRhythmUiScale();
    const endTitleSize = Math.max(18, Math.round(36 * ui));
    const endSubSize = Math.max(12, Math.round(20 * ui));
    const endBodySize = Math.max(11, Math.round(16 * ui));
    const gradeSize = grade === 'SSS'
      ? Math.max(18, Math.round(36 * ui))
      : Math.max(14, Math.round(28 * ui));

    const centerY = viewH / 2;
    const titleY = centerY - Math.round(118 * ui);
    const gradeY = centerY - Math.round(10 * ui);
    const scoreY = centerY + Math.round(74 * ui);
    const lootY = centerY + Math.round(132 * ui);

    this.stageRoot.add(this.add.rectangle(viewW / 2, viewH / 2, viewW, viewH, 0x000000, 0.5).setDepth(50));
    this.stageRoot.add(this.add.text(viewW / 2, titleY,
      gameState.tutorialMode ? '节奏教学完成！' : '节奏结束！',
      {
      fontSize: `${endTitleSize}px`, color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(51));
    const gradeText = addGradeText(this, viewW / 2, gradeY, grade, {
      depth: 51, fontSize: gradeSize, animate: true,
    });
    this.stageRoot.add(gradeText);
    this.stageRoot.add(this.add.text(viewW / 2, scoreY,
      gameState.tutorialMode
        ? `获得 ${loot.length} 个教学道具`
        : `节奏分: ${Math.round(this.score)}`,
      {
      fontSize: `${endSubSize}px`, color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(51));
    this.stageRoot.add(this.add.text(viewW / 2, lootY,
      gameState.tutorialMode
        ? `下一步：部署并合成升阶`
        : `获得 ${loot.length} 个道具 · 可合成 ${gameState.run!.mergeUsesLeft} 次`,
      {
      fontSize: `${endBodySize}px`, color: '#cccccc', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(51));
    this.attachStageLayer();

    this.time.delayedCall(2000, () => this.scene.start('DeployScene'));
  }

  shutdown(): void {
    this.createToken++;
    this.phaseReady = false;
    this.tutorialCoach.destroy();
    this.tutorialSkipBtn = null;
    this.time.removeAllEvents();
    this.input.off('pointerup', this.onPointerUp, this);
    this.input.keyboard?.off('keydown-SPACE', this.onKeyDown);
    this.input.keyboard?.off('keyup-SPACE', this.onKeyUp);
    this.audio.destroy();
    this.ring?.destroy();
    this.holdRing?.destroy();
    this.effects?.destroy();
    this.letterboxDecor?.destroy();
    this.letterboxDecor = null;
    if (this.bgCamera) {
      this.cameras.remove(this.bgCamera);
      this.bgCamera = null;
    }
    this.finished = true;
    setGameViewport(this.game, GAME_WIDTH, GAME_HEIGHT);
    resetRhythmStage();
  }

  private rhythmCoachLayout(): CoachLayout {
    return {
      width: getRhythmViewWidth(),
      height: getRhythmViewHeight(),
      depth: 900,
      parent: this.stageRoot,
      onShow: () => this.pauseTutorialRhythm(),
      onHide: () => this.resumeTutorialRhythm(),
    };
  }

  private pauseTutorialRhythm(): void {
    if (!this.tutorialMode || !this.tutorialRhythmStarted || this.finished) return;
    this.tutorialRhythmPaused = true;
    this.audio.pause();
  }

  private resumeTutorialRhythm(): void {
    if (!this.tutorialRhythmPaused) return;
    this.tutorialRhythmPaused = false;
    if (this.tutorialRhythmStarted && !this.finished) {
      this.audio.resume();
    }
  }

  private setupLetterboxLayer(bounds: RhythmStageBounds): void {
    const theme = getRunChapterTheme();
    this.bgCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false, 'rhythmBg');
    this.bgCamera.setScroll(0, 0);
    this.bgCamera.setBackgroundColor(theme.bgBottom);
    this.putCameraBehindMain(this.bgCamera);

    this.letterboxDecor = new RhythmLetterboxDecor(this, bounds, theme);
    this.cameras.main.ignore(this.letterboxDecor.getContainer());
    this.bgCamera.ignore(this.stageRoot);
  }

  /** 竖屏舞台内容只在主相机渲染，两侧装饰由背景相机绘制 */
  private attachStageLayer(): void {
    const keep = new Set<Phaser.GameObjects.GameObject>([
      this.stageRoot,
      this.letterboxDecor!.getContainer(),
    ]);
    for (const child of [...this.children.list]) {
      if (keep.has(child)) continue;
      this.stageRoot.add(child);
    }
  }

  private putCameraBehindMain(camera: Phaser.Cameras.Scene2D.Camera): void {
    const list = this.cameras.cameras;
    const idx = list.indexOf(camera);
    if (idx > 0) {
      list.splice(idx, 1);
      list.unshift(camera);
    }
  }

  private setupPortraitStageViewport(): RhythmStageBounds {
    const camera = this.cameras.main;
    const padding = 12;
    const targetAspect = 9 / 16;

    let stageHeight = GAME_HEIGHT - padding * 2;
    let stageWidth = Math.round(stageHeight * targetAspect);
    if (stageWidth > GAME_WIDTH - padding * 2) {
      stageWidth = GAME_WIDTH - padding * 2;
      stageHeight = Math.round(stageWidth / targetAspect);
    }

    configureRhythmStage(stageWidth, stageHeight);

    const viewW = getRhythmViewWidth();
    const viewH = getRhythmViewHeight();
    const x = Math.floor((GAME_WIDTH - stageWidth) / 2);
    const y = Math.floor((GAME_HEIGHT - stageHeight) / 2);

    camera.setViewport(x, y, stageWidth, stageHeight);
    camera.setZoom(1);
    camera.centerOn(viewW / 2, viewH / 2);
    camera.setRoundPixels(true);

    return { stageX: x, stageY: y, stageWidth, stageHeight };
  }
}
