import type { ChartData } from './ChartLoader';
import { MUSIC_BPM } from '../../config/rhythm';
import { SfxEngine } from './SfxEngine';

/** 实时节拍器：每拍只创建少量节点，避免一次性调度数百个 Oscillator 卡死主线程 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfx = new SfxEngine();
  private startTime = 0;
  private frozenTime = 0;
  private playing = false;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private beatIndex = 0;
  private chartDuration = 0;

  getSfx(): SfxEngine {
    return this.sfx;
  }

  async init(volume = 0.8): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = volume;
      this.masterGain.connect(this.ctx.destination);
      this.sfx.attach(this.ctx, this.masterGain);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.masterGain) this.masterGain.gain.value = volume;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  songTime(): number {
    if (!this.ctx) return this.frozenTime;
    if (!this.playing) return this.frozenTime;
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  async play(chart: ChartData, _offset = 0): Promise<void> {
    await this.init();
    if (!this.ctx || !this.masterGain) return;

    this.clearTimers();
    this.chartDuration = chart.duration;
    this.startTime = this.ctx.currentTime + 0.12;
    this.frozenTime = 0;
    this.playing = true;
    this.beatIndex = 0;

    const beatMs = (60 / MUSIC_BPM) * 1000;
    this.beatTimer = setInterval(() => this.tickBeat(), beatMs);
    this.tickBeat();

    this.stopTimer = setTimeout(() => this.stop(), (chart.duration + 1) * 1000);
  }

  stop(): void {
    if (this.ctx && this.playing) {
      this.frozenTime = Math.max(0, this.ctx.currentTime - this.startTime);
    }
    this.playing = false;
    this.clearTimers();
  }

  /** 引导弹板暂停：冻结当前 songTime，停止 BGM 节拍 */
  pause(): void {
    if (!this.playing) return;
    this.frozenTime = Math.max(0, this.songTime());
    this.playing = false;
    this.clearTimers();
  }

  /** 从 pause() 冻结的时刻继续 */
  resume(): void {
    if (this.playing || !this.ctx || !this.masterGain) return;
    this.startTime = this.ctx.currentTime - this.frozenTime;
    this.playing = true;

    const beatMs = (60 / MUSIC_BPM) * 1000;
    this.beatTimer = setInterval(() => this.tickBeat(), beatMs);

    const remainingMs = (this.chartDuration + 1 - this.frozenTime) * 1000;
    if (remainingMs > 0) {
      this.stopTimer = setTimeout(() => this.stop(), remainingMs);
    }
  }

  get paused(): boolean {
    return !this.playing && this.frozenTime > 0 && this.ctx !== null;
  }

  private clearTimers(): void {
    if (this.beatTimer) {
      clearInterval(this.beatTimer);
      this.beatTimer = null;
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
  }

  private tickBeat(): void {
    if (!this.playing || !this.ctx || !this.masterGain) return;

    const t = this.songTime();
    if (t > this.chartDuration + 0.5) {
      this.stop();
      return;
    }

    const bar = this.beatIndex % 4;
    this.playKick(bar === 0 || bar === 2 ? 0.5 : 0.32);
    if (bar === 1 || bar === 3) this.playSnare();
    if (bar === 0) this.playBass(this.beatIndex);
    this.beatIndex++;
  }

  private playKick(vol: number): void {
    if (!this.ctx || !this.masterGain) return;
    const when = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.08);
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + 0.25);
  }

  private playSnare(): void {
    if (!this.ctx || !this.masterGain) return;
    const when = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.06);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = 1200;
    g.gain.setValueAtTime(0.3, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.masterGain);
    src.start(when);
    src.stop(when + 0.12);
  }

  private playBass(beat: number): void {
    if (!this.ctx || !this.masterGain) return;
    const when = this.ctx.currentTime;
    const notes = [55, 65.41, 73.42, 82.41];
    const idx = Math.floor(beat / 4) % notes.length;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = notes[idx];
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(0.2, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(when);
    osc.stop(when + 0.5);
  }

  destroy(): void {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}
