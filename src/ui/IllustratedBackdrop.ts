import type Phaser from "phaser";
import { BACKGROUND_KEYS } from "../data/backgroundAssets";
import { WORLD } from "../game/Constants";
import { watchViewport, viewportOffsetY } from "../game/Viewport";

/** Keep the illustrated path aligned with the existing menu sheep on wide screens. */
export function addIllustratedBackdrop(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const image = scene.add.image(0, 0, BACKGROUND_KEYS.menu).setOrigin(0.5, 196 / WORLD.height);
  const aspect = image.frame.width / image.frame.height;
  const backdrop = scene.add.container(0, 0, [image]).setDepth(-30).setName("ui-pasture-backdrop");
  watchViewport(scene, (size) => {
    const anchor = 196 / WORLD.height;
    const pathY = 196 + viewportOffsetY(size);
    const height = Math.max(size.width / aspect, pathY / anchor, (size.height - pathY) / (1 - anchor));
    image.setPosition(size.width / 2, pathY).setDisplaySize(height * aspect, height);
  });
  return backdrop;
}
