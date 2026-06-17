import type { ItemType } from '../../config/items';
import type { AttackMode } from '../../config/tdContent';
import type { DefenseBgmProfile } from '../../config/chapterDefense';
import { DEFAULT_DEFENSE_BGM_PROFILE, getRunDefenseBgmProfile } from '../../config/chapterDefense';
/** 塔防战斗 — 四职业程序化攻击音效 */
export class CombatSfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.8;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
  private bgmProfile: DefenseBgmProfile = DEFAULT_DEFENSE_BGM_PROFILE;
  async ensureReady(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.applyVolume();
  }

  /** 确保 AudioContext 就绪并启动 BGM（守卫阶段入口） */
  async ensureBattleBgm(profile?: DefenseBgmProfile): Promise<void> {
    await this.ensureReady();
    if (!this.ctx || !this.master) return;
    this.startBattleBgm(profile);
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.volume * 0.85;
  }

  startBattleBgm(profile?: DefenseBgmProfile): void {
    if (!this.ctx || !this.master) return;
    this.stopBattleBgm();
    this.bgmProfile = profile ?? getRunDefenseBgmProfile();
    this.bgmStep = 0;
    this.bgmTimer = setInterval(() => this.tickBgm(), this.bgmProfile.stepMs);
    this.tickBgm();
  }
  stopBattleBgm(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  /** 核心塔被怪物击中 */
  playCoreHurt(damage: number): void {
    if (!this.ctx || !this.master) return;
    const intensity = Math.min(1.4, 0.55 + damage * 0.08);
    const when = this.now();

    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140 * intensity, when);
    thud.frequency.exponentialRampToValueAtTime(48, when + 0.1);
    thudGain.gain.setValueAtTime(0.42 * intensity, when);
    thudGain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    thud.connect(thudGain);
    thudGain.connect(this.master);
    thud.start(when);
    thud.stop(when + 0.24);

    this.playNoiseBurst(when + 0.01, 0.07, 0.2 * intensity, 900, 'bandpass');

    const crack = this.ctx.createOscillator();
    const crackGain = this.ctx.createGain();
    crack.type = 'triangle';
    crack.frequency.setValueAtTime(320, when + 0.02);
    crack.frequency.exponentialRampToValueAtTime(120, when + 0.08);
    crackGain.gain.setValueAtTime(0.16 * intensity, when + 0.02);
    crackGain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    crack.connect(crackGain);
    crackGain.connect(this.master);
    crack.start(when + 0.02);
    crack.stop(when + 0.14);
  }

  playTowerAttack(type: ItemType, mode: AttackMode, tier = 1, appliedSlow = false): void {
    if (!this.ctx || !this.master) return;
    const tierBoost = 1 + (tier - 1) * 0.07;
    switch (type) {
      case 'kick':
        this.playKick(tierBoost);
        break;
      case 'snare':
        this.playSnareSplash(tierBoost);
        break;
      case 'hihat':
        this.playHihatStrike(tierBoost, mode === 'chain');
        break;
      case 'crash':
        this.playFrostStrike(tierBoost, appliedSlow);
        break;
    }
  }

  /** 节拍拳 — 底鼓 */
  private playKick(boost: number): void {
    const when = this.now();
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.07);
    g.gain.setValueAtTime(0.55 * boost, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(when);
    osc.stop(when + 0.28);
  }

  /** 毒囊炮 — 军鼓 + 短噪声溅射 */
  private playSnareSplash(boost: number): void {
    const when = this.now();
    this.playNoiseBurst(when, 0.09, 0.38 * boost, 1400, 'highpass');
    const body = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(220, when);
    body.frequency.exponentialRampToValueAtTime(90, when + 0.05);
    g.gain.setValueAtTime(0.22 * boost, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
    body.connect(g);
    g.connect(this.master!);
    body.start(when);
    body.stop(when + 0.14);
    this.playNoiseBurst(when + 0.02, 0.14, 0.18 * boost, 600, 'bandpass');
  }

  /** 弧光术 — 清脆 hi-hat；连锁时连打 */
  private playHihatStrike(boost: number, chain: boolean): void {
    const hits = chain ? 4 : 1;
    for (let i = 0; i < hits; i++) {
      const when = this.now() + i * 0.035;
      this.playNoiseBurst(when, 0.035, (0.28 - i * 0.04) * boost, 7000, 'highpass');
      const tick = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      tick.type = 'square';
      tick.frequency.value = 9200 + i * 120;
      g.gain.setValueAtTime(0.08 * boost, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
      tick.connect(g);
      g.connect(this.master!);
      tick.start(when);
      tick.stop(when + 0.05);
    }
  }

  /** 凝霜律 — 冰晶击打 */
  private playFrostStrike(boost: number, appliedSlow: boolean): void {
    const when = this.now();
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(appliedSlow ? 880 : 660, when);
    osc.frequency.exponentialRampToValueAtTime(280, when + 0.12);
    g.gain.setValueAtTime(0.32 * boost, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(when);
    osc.stop(when + 0.22);
    this.playNoiseBurst(when, 0.1, 0.12 * boost, 3200, 'highpass');
    if (appliedSlow) {
      const shimmer = this.ctx!.createOscillator();
      const sg = this.ctx!.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(1200, when + 0.04);
      shimmer.frequency.linearRampToValueAtTime(1800, when + 0.18);
      sg.gain.setValueAtTime(0.14 * boost, when + 0.04);
      sg.gain.exponentialRampToValueAtTime(0.001, when + 0.28);
      shimmer.connect(sg);
      sg.connect(this.master!);
      shimmer.start(when + 0.04);
      shimmer.stop(when + 0.3);
    }
  }

  private playNoiseBurst(
    when: number,
    duration: number,
    vol: number,
    filterHz: number,
    filterType: BiquadFilterType,
  ): void {
    const sampleCount = Math.max(1, Math.floor(this.ctx!.sampleRate * duration));
    const buffer = this.ctx!.createBuffer(1, sampleCount, this.ctx!.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = this.ctx!.createBufferSource();
    src.buffer = buffer;
    const filt = this.ctx!.createBiquadFilter();
    filt.type = filterType;
    filt.frequency.value = filterHz;
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + duration);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master!);
    src.start(when);
    src.stop(when + duration + 0.02);
  }

  private now(): number {
    return this.ctx!.currentTime;
  }

  private tickBgm(): void {
    if (!this.ctx || !this.master) return;
    const profile = this.bgmProfile;
    const len = profile.bassLine.length;
    const step = this.bgmStep % len;
    const bassLine = profile.bassLine;
    this.playBgmBass(
      bassLine[step],
      step === 0 || step === Math.floor(len / 2) ? profile.bassVolStrong : profile.bassVolWeak,
      profile.bassWave,
    );
    if (step % 2 === 0) this.playBgmHat(profile.hatVol);
    if (step === Math.floor(len * 0.375) || step === len - 1) this.playBgmSnare(profile.snareVol);
    this.bgmStep++;
  }

  private playBgmBass(freq: number, vol: number, wave: OscillatorType): void {
    const when = this.now();
    const osc = this.ctx!.createOscillator();
    const g = this.ctx!.createGain();
    osc.type = wave;    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0.001, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
    osc.connect(g);
    g.connect(this.master!);
    osc.start(when);
    osc.stop(when + 0.24);
  }

  private playBgmHat(vol: number): void {
    const when = this.now();
    this.playNoiseBurst(when, 0.03, vol, 6000, 'highpass');
  }

  private playBgmSnare(vol: number): void {
    const when = this.now();
    this.playNoiseBurst(when, 0.05, vol, 1600, 'highpass');
  }

  destroy(): void {
    this.stopBattleBgm();
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}

export const combatSfx = new CombatSfxEngine();
