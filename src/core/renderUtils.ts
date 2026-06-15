import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './viewport';

/** 文本渲染倍率，减轻高 DPI 屏幕上的发糊 */
export function getTextResolution(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

export function applyTextResolution(text: Phaser.GameObjects.Text): Phaser.GameObjects.Text {
  text.setResolution(getTextResolution());
  return text;
}

/** 恢复全屏相机视口（节奏关嵌入竖屏后进入其他场景时调用） */
export function resetSceneCamera(
  scene: Phaser.Scene,
  width = GAME_WIDTH,
  height = GAME_HEIGHT,
): void {
  const camera = scene.cameras.main;
  camera.setViewport(0, 0, width, height);
  camera.setZoom(1);
  camera.setScroll(0, 0);
  camera.centerOn(width / 2, height / 2);
}
