import Phaser from 'phaser';
import { EMOJI_BOUNCE_RATIO, MUSIC_BPM } from '../config/rhythm';
import type { ChapterTheme } from '../config/chapterTheme';
import { resolveChapterTheme } from '../config/chapterTheme';
import { drawChapterBackdrop } from './RhythmTdChrome';
import { getRhythmViewHeight, getRhythmViewWidth, getRhythmUiScale } from '../config/rhythmViewport';

interface Toy {
  text: Phaser.GameObjects.Text;
  baseY: number;
  phase: number;
}

function beatPulse(songTime: number): number {
  const beatSec = 60 / MUSIC_BPM;
  const t = songTime % beatSec;
  const ratio = t / beatSec;
  const attack = Math.max(0, 1 - ratio / 0.12);
  const decay = Math.exp(-ratio * 5.5);
  return Math.max(attack * 0.35, decay);
}

export class EmojiBackground {
  private toys: Toy[] = [];

  constructor(scene: Phaser.Scene, theme?: ChapterTheme) {
    const chapterTheme = theme ?? resolveChapterTheme('default');
    const viewW = getRhythmViewWidth();
    const viewH = getRhythmViewHeight();
    const emojiSize = Math.max(22, Math.round(42 * getRhythmUiScale()));

    drawChapterBackdrop(scene, chapterTheme, viewW, viewH, {
      depth: 0,
      emojiSize,
      decor: false,
      animate: true,
    });

    const rhythmPositions: Array<[number, number]> = [
      [0.12, 0.18], [0.88, 0.15], [0.08, 0.78], [0.92, 0.72],
      [0.25, 0.42], [0.75, 0.38], [0.5, 0.82],
    ];

    chapterTheme.decorEmojis.forEach((emoji, i) => {
      const pos = rhythmPositions[i];
      if (!pos) return;
      const [px, py] = pos;
      const text = scene.add.text(
        viewW * px,
        viewH * py,
        emoji,
        { fontSize: `${emojiSize}px` },
      ).setOrigin(0.5).setDepth(2).setAlpha(chapterTheme.decorAlpha);
      this.toys.push({ text, baseY: text.y, phase: i * 1.15 });
    });
  }

  update(songTime: number): void {
    const pulse = beatPulse(songTime);
    const bounce = getRhythmViewHeight() * EMOJI_BOUNCE_RATIO;

    this.toys.forEach((toy) => {
      const wave = Math.sin(songTime * 1.8 + toy.phase) * bounce * 0.18;
      toy.text.y = toy.baseY - pulse * bounce - wave;
      toy.text.setScale(1 + pulse * 0.1);
    });
  }
}
