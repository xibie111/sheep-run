import type Phaser from "phaser";
import { NEW_OBSTACLE_DEFINITIONS, type ObstacleKind } from "../game/ObstacleDefinitions";
import { SEASON_ORDER } from "../environment/SeasonProgress";
import type { ThemeId } from "../environment/types";
import { addCanvasTexture } from "../utils/TextureUtils";
import frames from "../../assets/seasons/new-obstacles-v2/frames.json";

export const NEW_OBSTACLE_ART = {
  key: "new-obstacles-v2-source",
  url: new URL("../../assets/seasons/new-obstacles-v2/runtime/new-obstacles-atlas.png", import.meta.url).href,
} as const;

export const newObstacleTextureKey = (season: ThemeId, kind: ObstacleKind): string => `season-${season}-obstacle-${kind}`;
export function newObstacleRuntimeKeys(): string[] {
  return NEW_OBSTACLE_DEFINITIONS.flatMap(definition => [definition.texture, ...SEASON_ORDER.map(season => newObstacleTextureKey(season, definition.kind))]);
}

/** Crop measured subjects, uniformly fit, and retain the same foot baseline in all seasons. */
export function createNewObstacleTextures(scene: Phaser.Scene): void {
  const source = scene.textures.get(NEW_OBSTACLE_ART.key).getSourceImage() as HTMLImageElement;
  for (const season of SEASON_ORDER) for (const definition of NEW_OBSTACLE_DEFINITIONS) {
    const frame = frames[season][definition.kind as keyof typeof frames.spring];
    if (!frame || frame.width <= 0 || frame.height <= 0 || frame.x + frame.width > source.width || frame.y + frame.height > source.height) {
      throw new Error(`New obstacle frame invalid: ${season}/${definition.kind}`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = definition.width * 4; canvas.height = definition.height * 4;
    const context = canvas.getContext("2d")!; context.imageSmoothingEnabled = false;
    const scale = Math.min(canvas.width / frame.width, canvas.height / frame.height);
    const width = Math.round(frame.width * scale), height = Math.round(frame.height * scale);
    context.drawImage(source, frame.x, frame.y, frame.width, frame.height,
      Math.floor((canvas.width - width) / 2), canvas.height - height, width, height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 3; i < pixels.data.length; i += 4) pixels.data[i] = pixels.data[i]! >= 128 ? 255 : 0;
    context.putImageData(pixels, 0, 0);
    addCanvasTexture(scene, newObstacleTextureKey(season, definition.kind), canvas);
    if (season === "spring") addCanvasTexture(scene, definition.texture, canvas);
  }
  scene.textures.remove(NEW_OBSTACLE_ART.key);
}
