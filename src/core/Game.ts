import Phaser from 'phaser';
import { BattleSimulatorScene } from '../scenes/BattleSimulatorScene';
import { BootScene } from '../scenes/BootScene';
import { MenuScene } from '../scenes/MenuScene';
import { RhythmScene } from '../scenes/RhythmScene';
import { DeployScene } from '../scenes/DeployScene';
import { DefenseScene } from '../scenes/DefenseScene';
import { ResultScene } from '../scenes/ResultScene';
import { LevelSelectScene } from '../scenes/LevelSelectScene';
import { MetaScene } from '../scenes/MetaScene';
import { GAME_HEIGHT, GAME_WIDTH } from './viewport';
import { resetSceneCamera } from './renderUtils';

export { GAME_HEIGHT, GAME_WIDTH } from './viewport';
export { getTextResolution, applyTextResolution, resetSceneCamera } from './renderUtils';

export function setGameViewport(game: Phaser.Game, width: number, height: number): void {
  game.scale.setGameSize(width, height);
  game.scale.autoCenter = Phaser.Scale.CENTER_BOTH;
  game.scale.refresh();
}

export function prepareLandscapeScene(scene: Phaser.Scene): void {
  setGameViewport(scene.game, GAME_WIDTH, GAME_HEIGHT);
  resetSceneCamera(scene);
}

export function createGame(parent: string): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.WEBGL,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#fff5e6',
    render: {
      antialias: true,
      antialiasGL: true,
      powerPreference: 'high-performance',
      roundPixels: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: true,
      autoRound: true,
      snap: { width: 1, height: 1 },
    },
    scene: [BootScene, MenuScene, LevelSelectScene, MetaScene, RhythmScene, DeployScene, DefenseScene, ResultScene, BattleSimulatorScene],
  });
}
