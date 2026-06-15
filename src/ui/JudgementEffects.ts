import Phaser from 'phaser';

import type { JudgementType } from '../systems/rhythm/Judgement';

import type { SfxEngine } from '../systems/rhythm/SfxEngine';

import { getRhythmJudgementTextY, getRhythmUiScale } from '../config/rhythmViewport';
import { getGuideRingRadius } from '../config/rhythm';

import { ExpandingHalo } from './ExpandingHalo';



const TWEEN_EASE = 'Cubic.easeOut';



export class JudgementEffects {

  private scene: Phaser.Scene;

  private sfx: SfxEngine;

  private halos: ExpandingHalo;

  private judgementText: Phaser.GameObjects.Text;

  private textBaseX: number;

  private layer: Phaser.GameObjects.Container | null;



  constructor(
    scene: Phaser.Scene,
    sfx: SfxEngine,
    cx: number,
    cy: number,
    layer: Phaser.GameObjects.Container | null = null,
  ) {

    this.scene = scene;

    this.sfx = sfx;

    this.layer = layer;

    this.halos = new ExpandingHalo(scene, 33, layer);

    this.textBaseX = cx;

    const judgementSize = Math.max(14, Math.round(40 * getRhythmUiScale()));
    this.judgementText = scene.add.text(cx, getRhythmJudgementTextY(cy), '', {
      fontSize: `${judgementSize}px`, fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 1).setDepth(40).setAlpha(0);

  }



  update(delta: number): void {

    this.halos.update(delta);

  }



  clear(): void {

    this.halos.clear();

  }



  play(type: JudgementType, cx: number, cy: number): void {

    const colors: Record<JudgementType, string> = {

      perfect: '#ffd700', great: '#2ecc71', good: '#3498db', miss: '#e74c3c',

    };

    const labels: Record<JudgementType, string> = {

      perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', miss: 'MISS',

    };



    this.scene.tweens.killTweensOf(this.judgementText);

    this.judgementText.setPosition(this.textBaseX, getRhythmJudgementTextY(cy));

    this.judgementText.setText(labels[type]);

    this.judgementText.setColor(colors[type]);

    this.judgementText.setAlpha(1);

    this.judgementText.setScale(type === 'perfect' ? 1.35 : type === 'miss' ? 1.05 : 1.15);



    if (type === 'perfect') {

      this.halos.perfectBurst(cx, cy);

      this.particles(cx, cy, 0xffd700, 4, getGuideRingRadius());

      this.sfx.playPerfect();

    } else if (type === 'great') {

      this.halos.greatBurst(cx, cy);

      this.sfx.playGreat();

    } else if (type === 'good') {

      this.sfx.playGood();

    } else {

      this.scene.cameras.main.flash(100, 255, 0, 0, false);

      this.scene.tweens.add({

        targets: this.judgementText,

        x: this.textBaseX + 6,

        duration: 45,

        ease: 'Sine.easeInOut',

        yoyo: true,

        repeat: 2,

      });

      this.sfx.playMiss();

    }



    this.scene.tweens.add({

      targets: this.judgementText,

      alpha: 0,

      scale: 1,

      duration: 550,

      delay: 280,

      ease: TWEEN_EASE,

    });

  }



  playRedTap(cx: number, cy: number): void {

    this.halos.redTapBurst(cx, cy);

    this.sfx.playRedTap();

  }



  private particles(cx: number, cy: number, color: number, count: number, spawnRadius = 0, dist = 85): void {

    for (let i = 0; i < count; i++) {

      const a = (Math.PI * 2 * i) / count;

      const sx = cx + Math.cos(a) * spawnRadius;

      const sy = cy + Math.sin(a) * spawnRadius;

      const p = this.scene.add.circle(sx, sy, 4, color).setDepth(34);
      if (this.layer) this.layer.add(p);

      this.scene.tweens.add({

        targets: p,

        x: sx + Math.cos(a) * dist,

        y: sy + Math.sin(a) * dist,

        alpha: 0,

        scale: 0.15,

        duration: 420,

        ease: TWEEN_EASE,

        onComplete: () => p.destroy(),

      });

    }

  }



  destroy(): void {

    this.halos.destroy();

  }

}


