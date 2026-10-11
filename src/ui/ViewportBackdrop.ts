import type Phaser from "phaser";
import { WORLD } from "../game/Constants";
import { watchViewport, viewportOffsetY } from "../game/Viewport";
import { BACKGROUND_KEYS } from "../data/backgroundAssets";
import { addIllustratedBackdrop } from "./IllustratedBackdrop";

export function addTiledPastureBackdrop(
  scene: Phaser.Scene,
  texture = "farm-static",
  skyColor = 0xb4ddd1,
  groundColor = 0xb8774d,
): Phaser.GameObjects.Container {
  if (texture === "farm-static" && scene.textures?.exists(BACKGROUND_KEYS.menu)) return addIllustratedBackdrop(scene);
  const sky = scene.add.rectangle(0, 0, WORLD.width, WORLD.height, skyColor).setOrigin(0);
  const ground = scene.add.rectangle(0, WORLD.height, WORLD.width, 1, groundColor).setOrigin(0);
  const landscape = scene.add.tileSprite(0, 0, WORLD.width, WORLD.height, texture).setOrigin(0);
  const backdrop = scene.add.container(0, 0, [sky, ground, landscape]).setDepth(-30);
  watchViewport(scene, (size) => {
    const y = viewportOffsetY(size);
    sky.setSize(size.width, size.height);
    ground.setPosition(0, y + WORLD.height).setSize(size.width, Math.max(1, size.height - y - WORLD.height));
    landscape.setPosition(0, y).setSize(size.width, WORLD.height);
  });
  return backdrop;
}
