import type Phaser from "phaser";
import { viewportSizeFromScale } from "../game/Viewport";

// Safe areas move only important game objects. Canvas always reaches all four edges.
export function safeUiInsets(scene: Phaser.Scene): { left: number; right: number; top: number; bottom: number } {
  const css = getComputedStyle(document.documentElement);
  const rect = scene.game.canvas.getBoundingClientRect();
  const size = viewportSizeFromScale(scene.scale);
  const value = (edge: string, ratio: number): number => Math.ceil((parseFloat(css.getPropertyValue(`--safe-${edge}`)) || 0) * ratio);
  return {
    left: value("left", size.width / rect.width), right: value("right", size.width / rect.width),
    top: value("top", size.height / rect.height), bottom: value("bottom", size.height / rect.height),
  };
}
