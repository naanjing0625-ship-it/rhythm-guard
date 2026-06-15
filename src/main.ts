import { createGame } from './core/Game';
import { gameState } from './core/GameState';
import { saveManager } from './save/SaveManager';

async function boot(): Promise<void> {
  const save = await saveManager.load();
  gameState.save = save;
  createGame('game-container');
}

boot();
