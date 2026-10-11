import type Phaser from "phaser";
import { BACKGROUND_KEYS, ILLUSTRATED_REPEAT_WIDTH } from "../data/backgroundAssets";
import { WORLD } from "../game/Constants";
import { addCanvasTexture } from "./TextureUtils";
import { createSceneryRepeat } from "./SceneryRepeat";

/** Build cached scenery bands with forward-facing landscape joins. */
export function createIllustratedPastureLayers(scene: Phaser.Scene): void {
  if (!scene.textures.exists(BACKGROUND_KEYS.runFar) || !scene.textures.exists(BACKGROUND_KEYS.runNear)) return;
  const far = scene.textures.get(BACKGROUND_KEYS.runFar).getSourceImage() as HTMLImageElement;
  const near = scene.textures.get(BACKGROUND_KEYS.runNear).getSourceImage() as HTMLImageElement;
  const farRepeat = scene.textures.exists("pasture-far-mountain") ? undefined : createSceneryRepeat(far, "far");
  const nearRepeat = scene.textures.exists("pasture-treeline") && scene.textures.exists("pasture-ground") ? undefined : createSceneryRepeat(near, "near");
  // The painted hedge belongs to the fast road layer, just behind the fixed foot line.
  const roadTop = WORLD.groundY - 7;
  const register = (key: string, source?: HTMLCanvasElement, top = 0, bottom: number = WORLD.height): void => {
    if (scene.textures.exists(key)) return;
    const canvas = document.createElement("canvas");
    canvas.width = ILLUSTRATED_REPEAT_WIDTH;
    canvas.height = WORLD.height;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    if (source) {
      context.save();
      context.beginPath();
      context.rect(0, top, canvas.width, bottom - top);
      context.clip();
      context.drawImage(source, 0, 0);
      context.restore();
    }
    addCanvasTexture(scene, key, canvas);
  };
  register("pasture-far-mountain", farRepeat);
  register("pasture-treeline", nearRepeat, 0, roadTop);
  register("pasture-ground", nearRepeat, roadTop);
  // These scene slots remain available for weather and seasonal tinting. The art
  // already contains clouds, buildings, fences and flowers, so no duplicate shapes.
  for (const key of ["pasture-sky", "pasture-cloud", "pasture-building", "pasture-field", "pasture-fence", "pasture-foreground-grass"]) register(key);
  for (const [key, source, y] of [
    ["pasture-sky-fill", far, 0],
    ["pasture-soil-fill", near, near.height - 1],
  ] as const) {
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(source, Math.floor(source.width / 2), y, 1, 1, 0, 0, 1, 1);
    addCanvasTexture(scene, key, canvas);
  }
}
