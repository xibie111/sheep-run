import type Phaser from "phaser";
import { bindTouchTarget } from "./TouchTarget";

/** The HUD renderer and this single touch owner use the same screen rectangle. */
export function createRunPauseTarget(scene: Phaser.Scene, activate: () => void): Phaser.GameObjects.Container {
  const button = scene.add.container(0, 0, []).setScrollFactor(0).setDepth(30)
    .setName("button:暂停").setData("pressed", false).setData("disabled", false);
  bindTouchTarget(scene, button, 44, 44, activate, pressed => button.setData("pressed", pressed));
  return button;
}
