import Phaser from 'phaser';

export const eventBus = new Phaser.Events.EventEmitter();

export const Events = {
  JUDGEMENT: 'judgement',
  COMBO_UPDATE: 'combo_update',
  LOOT_READY: 'loot_ready',
  WAVE_START: 'wave_start',
  WAVE_COMPLETE: 'wave_complete',
  CORE_DAMAGED: 'core_damaged',
  ENEMY_KILLED: 'enemy_killed',
  SAVE_UPDATED: 'save_updated',
} as const;
