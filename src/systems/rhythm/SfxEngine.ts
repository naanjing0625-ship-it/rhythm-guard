export class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  attach(ctx: AudioContext, master: GainNode): void {
    this.ctx = ctx;
    this.master = master;
  }

  playPerfect(): void {
    this.tone(880, 'sine', 0.15, 0.35);
    this.tone(1320, 'sine', 0.15, 0.28, 0.02);
  }

  playGreat(): void {
    this.tone(660, 'sine', 0.18, 0.32);
  }

  playGood(): void {
    this.tone(440, 'triangle', 0.16, 0.28);
  }

  playMiss(): void {
    this.tone(150, 'sawtooth', 0.22, 0.35);
  }

  playRedTap(): void {
    const freq = 600 + Math.random() * 200;
    this.tone(freq, 'square', 0.06, 0.22);
  }

  private tone(freq: number, type: OscillatorType, decay: number, vol: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const now = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  }
}
