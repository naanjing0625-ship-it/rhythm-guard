import Phaser from 'phaser';
import type { AttackEvent } from './CombatSystem';

export function playAttackVfx(scene: Phaser.Scene, event: AttackEvent): void {
  switch (event.mode) {
    case 'melee':
      playMeleeVfx(scene, event);
      break;
    case 'aoe':
      playAoeVfx(scene, event);
      break;
    case 'chain':
      playChainVfx(scene, event);
      break;
    default:
      break;
  }
  showDamageNumber(scene, event.toX, event.toY - 12, event.damage, event.resisted, event.color);
}

function playMeleeVfx(scene: Phaser.Scene, event: AttackEvent): void {
  const color = event.appliedSlow ? 0x5dade2 : event.color;
  const line = scene.add.line(0, 0, event.fromX, event.fromY, event.toX, event.toY, color, 0.9);
  line.setLineWidth(3);
  line.setDepth(50);
  scene.tweens.add({
    targets: line,
    alpha: 0,
    duration: 120,
    onComplete: () => line.destroy(),
  });

  const hit = scene.add.circle(event.toX, event.toY, event.appliedSlow ? 12 : 8, color, event.appliedSlow ? 0.55 : 0.5);
  hit.setDepth(50);
  scene.tweens.add({
    targets: hit,
    scale: event.appliedSlow ? 2.2 : 1.8,
    alpha: 0,
    duration: event.appliedSlow ? 260 : 180,
    onComplete: () => hit.destroy(),
  });

  if (event.appliedSlow) {
    const frost = scene.add.text(event.toX, event.toY - 18, '❄', {
      fontSize: '16px',
    }).setOrigin(0.5).setDepth(55);
    scene.tweens.add({
      targets: frost,
      y: event.toY - 32,
      alpha: 0,
      duration: 500,
      onComplete: () => frost.destroy(),
    });
  }
}

function playAoeVfx(scene: Phaser.Scene, event: AttackEvent): void {
  const radius = event.aoeRadius ?? 60;
  const ring = scene.add.circle(event.toX, event.toY, 12, event.color, 0.15);
  ring.setStrokeStyle(3, event.color, 0.85);
  ring.setDepth(50);
  scene.tweens.add({
    targets: ring,
    scale: radius / 12,
    alpha: 0,
    duration: 280,
    ease: 'Cubic.easeOut',
    onComplete: () => ring.destroy(),
  });

  const flash = scene.add.circle(event.fromX, event.fromY, 10, event.color, 0.4);
  flash.setDepth(50);
  scene.tweens.add({
    targets: flash,
    scale: 1.5,
    alpha: 0,
    duration: 150,
    onComplete: () => flash.destroy(),
  });
}

function playChainVfx(scene: Phaser.Scene, event: AttackEvent): void {
  const points = event.chainPoints ?? [{ x: event.fromX, y: event.fromY }, { x: event.toX, y: event.toY }];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const bolt = scene.add.line(0, 0, a.x, a.y, b.x, b.y, event.color, 0.95);
    bolt.setLineWidth(2);
    bolt.setDepth(50);
    scene.tweens.add({
      targets: bolt,
      alpha: 0,
      duration: 200,
      delay: (i - 1) * 40,
      onComplete: () => bolt.destroy(),
    });

    const spark = scene.add.circle(b.x, b.y, 6, 0xffffff, 0.7);
    spark.setDepth(51);
    scene.tweens.add({
      targets: spark,
      scale: 1.4,
      alpha: 0,
      duration: 160,
      delay: (i - 1) * 40,
      onComplete: () => spark.destroy(),
    });
  }
}

export function showDamageNumber(
  scene: Phaser.Scene,
  x: number,
  y: number,
  damage: number,
  resisted: boolean,
  color: number,
): void {
  if (damage <= 0) return;
  const hex = `#${color.toString(16).padStart(6, '0')}`;
  const text = scene.add.text(x, y, resisted ? `-${damage} 抵抗` : `-${damage}`, {
    fontSize: resisted ? '11px' : '13px',
    color: resisted ? '#f1c40f' : hex,
    fontFamily: 'Arial',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(60);

  scene.tweens.add({
    targets: text,
    y: y - 28,
    alpha: 0,
    duration: 650,
    onComplete: () => text.destroy(),
  });
}

export function pulseTower(scene: Phaser.Scene, x: number, y: number, color: number): void {
  const pulse = scene.add.circle(x, y, 18, color, 0.35);
  pulse.setDepth(45);
  scene.tweens.add({
    targets: pulse,
    scale: 1.6,
    alpha: 0,
    duration: 200,
    onComplete: () => pulse.destroy(),
  });
}
