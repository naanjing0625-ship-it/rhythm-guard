import Phaser from 'phaser';
import {
  getEnemyNoteAngle,
  getEnemyNoteFontSize,
  getEnemyNoteSymbol,
} from '../config/enemyIcons';
import { RHYTHM_THEME } from '../config/rhythmTheme';
import type { EnemyState } from '../systems/defense/Enemy';

export function createEnemyNoteParts(
  scene: Phaser.Scene,
  enemy: EnemyState,
): Phaser.GameObjects.GameObject[] {
  const { def } = enemy;
  const icon = scene.add.text(0, 0, getEnemyNoteSymbol(def.type), {
    fontSize: getEnemyNoteFontSize(def),
    fontFamily: 'Segoe UI Emoji, Apple Color Emoji, Arial',
  }).setOrigin(0.5);

  if (def.flying) {
    icon.setAngle(getEnemyNoteAngle(def));
  }

  const hpOffset = def.size + 16;
  const hpBg = scene.add.rectangle(0, -hpOffset, 34, 4, RHYTHM_THEME.progressBg);
  const hpFill = scene.add.rectangle(-17, -hpOffset, 34, 4, RHYTHM_THEME.primary).setOrigin(0, 0.5);

  const nameTag = scene.add.text(0, -hpOffset - 12, def.name, {
    fontSize: def.tags?.includes('boss') ? '10px' : '9px',
    color: def.tags?.includes('boss') ? RHYTHM_THEME.textGold : RHYTHM_THEME.textDark,
    fontFamily: 'Arial',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  return [icon, hpBg, hpFill, nameTag];
}

export function getEnemyBadgeText(enemy: EnemyState): string {
  if (enemy.def.flying) return '飞行';
  if (enemy.def.abilities?.some((a) => a.id === 'heal_aura')) return '治疗';
  if (enemy.def.armorType === 'armored') return '护甲';
  if (enemy.def.armorType === 'boss') return 'BOSS';
  if (enemy.def.tags?.includes('fast')) return '高速';
  return '';
}
